import type { Course, Difficulty } from '../content/types'

export type SearchResultKind = 'topic' | 'command' | 'question' | 'concept'

export interface SearchDocument {
  id: string
  kind: SearchResultKind
  title: string
  /** Short line shown under the title in the results list. */
  snippet: string
  route: string
  domainId: string
  difficulty: Difficulty | null
  /** Lower-cased haystack built once at index time. */
  haystack: string
  keywords: string[]
}

export interface SearchFilters {
  domainId?: string | null
  difficulty?: Difficulty | null
  kind?: SearchResultKind | null
}

export interface SearchResult extends SearchDocument {
  score: number
}

const flatten = (values: (string | undefined)[]): string => values.filter(Boolean).join(' \n ')

/**
 * Builds a flat, in-memory search index over everything a learner might look
 * for: topics, their commands and YAML, the command reference, and the
 * practice question bank.
 *
 * A hand-rolled index keeps the app dependency-free and fully offline; the
 * corpus is a few thousand short documents, so scoring them all on each
 * keystroke is comfortably fast.
 */
export function buildSearchIndex(course: Course): SearchDocument[] {
  const documents: SearchDocument[] = []

  for (const topic of course.topics) {
    documents.push({
      id: `topic:${topic.id}`,
      kind: 'topic',
      title: topic.title,
      snippet: topic.oneLiner,
      route: `${course.route}/topics/${topic.id}`,
      domainId: topic.domainId,
      difficulty: topic.difficulty,
      keywords: topic.tags,
      haystack: flatten([
        topic.title,
        topic.oneLiner,
        topic.tags.join(' '),
        topic.explanation.join(' '),
        topic.whyItMatters.join(' '),
        topic.howItWorks.join(' '),
        topic.summary.join(' '),
        topic.examTips.join(' '),
        topic.commonMistakes.join(' '),
        topic.keyObjects
          .map(
            (object) =>
              `${object.kind} ${object.apiVersion} ${object.fields.map((field) => field.path).join(' ')}`,
          )
          .join(' '),
        topic.imperative.map((command) => `${command.command} ${command.what}`).join(' '),
        topic.verification.map((command) => `${command.command} ${command.what}`).join(' '),
        topic.troubleshooting.map((command) => `${command.command} ${command.what}`).join(' '),
        topic.yamlExamples.map((sample) => `${sample.title} ${sample.code}`).join(' '),
        topic.lab.title,
        topic.lab.scenario,
      ]).toLowerCase(),
    })

    // Each key object is separately findable, so searching "EndpointSlice" or
    // "readOnlyRootFilesystem" lands on the lesson that explains it.
    for (const object of topic.keyObjects) {
      documents.push({
        id: `concept:${topic.id}:${object.kind}`,
        kind: 'concept',
        title: object.apiVersion ? `${object.kind} (${object.apiVersion})` : object.kind,
        snippet: object.purpose,
        route: `${course.route}/topics/${topic.id}#key-objects`,
        domainId: topic.domainId,
        difficulty: topic.difficulty,
        keywords: [object.kind, object.apiVersion ?? ''].filter(Boolean),
        haystack: flatten([
          object.kind,
          object.apiVersion ?? '',
          object.purpose,
          object.fields.map((field) => `${field.path} ${field.meaning}`).join(' '),
          topic.title,
        ]).toLowerCase(),
      })
    }
  }

  for (const group of course.commandGroups) {
    for (const entry of group.entries) {
      documents.push({
        id: `command:${entry.id}`,
        kind: 'command',
        title: entry.command,
        snippet: entry.description,
        route: `${course.route}/commands#${entry.id}`,
        domainId: group.id,
        difficulty: null,
        keywords: entry.tags,
        haystack: flatten([
          entry.command,
          entry.description,
          entry.example,
          entry.notes,
          entry.tags.join(' '),
          group.title,
        ]).toLowerCase(),
      })
    }
  }

  for (const question of course.questions) {
    documents.push({
      id: `question:${question.id}`,
      kind: 'question',
      title: question.prompt,
      snippet: `${question.category} question - ${question.difficulty}`,
      route: `${course.route}/practice/${question.domainId}?q=${encodeURIComponent(question.id)}`,
      domainId: question.domainId,
      difficulty: question.difficulty,
      keywords: [question.category],
      haystack: flatten([
        question.prompt,
        question.explanation,
        question.code?.code,
        question.kind === 'command' ? question.acceptedAnswers.join(' ') : undefined,
        question.kind === 'task' ? question.checkpoints.map((c) => c.text).join(' ') : undefined,
      ]).toLowerCase(),
    })
  }

  return documents
}

const tokenize = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9.:/_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

/**
 * Scores documents against the query.
 *
 * Every token must appear somewhere (AND semantics), then matches are ranked:
 * title hits beat keyword hits, which beat body hits, and an exact title
 * prefix wins outright. Kind is used as a gentle tie-breaker so lessons
 * surface above the raw question bank.
 */
export function searchCourse(
  documents: SearchDocument[],
  query: string,
  filters: SearchFilters = {},
  limit = 60,
): SearchResult[] {
  const tokens = tokenize(query)
  const filtered = documents.filter((document) => {
    if (filters.domainId && document.domainId !== filters.domainId) return false
    if (filters.difficulty && document.difficulty !== filters.difficulty) return false
    if (filters.kind && document.kind !== filters.kind) return false
    return true
  })

  if (tokens.length === 0) {
    // With no query the filters alone are the search: show topics first.
    return filtered
      .filter((document) => document.kind === 'topic' || filters.kind)
      .slice(0, limit)
      .map((document) => ({ ...document, score: 0 }))
  }

  const kindBonus: Record<SearchResultKind, number> = {
    topic: 6,
    concept: 4,
    command: 3,
    question: 0,
  }

  const results: SearchResult[] = []
  for (const document of filtered) {
    const title = document.title.toLowerCase()
    const keywords = document.keywords.join(' ').toLowerCase()
    let score = 0
    let matchedAll = true

    for (const token of tokens) {
      let tokenScore = 0
      if (title.startsWith(token)) tokenScore += 60
      else if (title.includes(token)) tokenScore += 40
      if (keywords.includes(token)) tokenScore += 18
      if (document.haystack.includes(token)) tokenScore += 8
      if (tokenScore === 0) {
        matchedAll = false
        break
      }
      score += tokenScore
    }

    if (!matchedAll) continue
    if (title === query.trim().toLowerCase()) score += 100
    score += kindBonus[document.kind]
    results.push({ ...document, score })
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit)
}
