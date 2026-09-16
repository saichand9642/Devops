import { describe, expect, it } from 'vitest'
import {
  allInterviewQuestions,
  interviewQuestionById,
  interviewTopicById,
  interviewTopics,
  interviewTrack,
} from './interview'
import type { Diagram, InterviewQuestion } from './types'

/**
 * Interview content integrity tests.
 *
 * The interview section is 111 hand-written questions across 12 topic files.
 * These are the guard rails: unique ids, MCQ answer keys that point at real
 * options, no half-written questions, no raw markdown leaking into places
 * that render as plain text, and a level spread that actually reaches senior.
 */

const topicIds = interviewTopics.map((topic) => topic.id)

/** Every string a diagram renders as plain SVG text - markdown would show literally. */
function diagramStrings(diagram: Diagram): string[] {
  return [diagram.caption ?? '', ...svgStrings(diagram)].filter(Boolean)
}

/** Only the strings painted inside the SVG, which cannot wrap and must fit. */
function svgStrings(diagram: Diagram): string[] {
  const out = [diagram.title]
  if (diagram.kind === 'flow') {
    for (const node of diagram.nodes) {
      out.push(node.label, node.detail ?? '', node.arrowLabel ?? '')
      if (node.branch) out.push(node.branch.label, node.branch.detail ?? '')
    }
  } else if (diagram.kind === 'sequence') {
    out.push(...diagram.participants.map((participant) => participant.label))
    out.push(...diagram.messages.map((message) => message.label))
  } else if (diagram.kind === 'nested') {
    const walk = (box: { label: string; detail?: string; children?: unknown[] }) => {
      out.push(box.label, box.detail ?? '')
      for (const child of (box.children ?? []) as (typeof box)[]) walk(child)
    }
    walk(diagram.root)
  } else {
    out.push(diagram.question)
    for (const branch of diagram.branches) {
      out.push(branch.condition, branch.result, branch.detail ?? '')
    }
  }
  return out.filter(Boolean)
}

describe('interview track', () => {
  it('covers every topic the track promises', () => {
    expect(topicIds).toEqual(
      expect.arrayContaining([
        'docker',
        'kubernetes',
        'jenkins',
        'github-actions',
        'aws',
        'terraform',
        'prometheus',
        'ansible',
        'splunk',
        'python',
        'shell',
        'linux',
      ]),
    )
    expect(interviewTopics).toHaveLength(12)
  })

  it('is routed apart from the certification courses', () => {
    expect(interviewTrack.route).toBe('/interview')
    expect(interviewTrack.topics).toBe(interviewTopics)
  })

  it('orders topics deterministically and without collisions', () => {
    const orders = interviewTopics.map((topic) => topic.order)
    expect(new Set(orders).size).toBe(orders.length)
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b))
  })

  it('has unique topic ids that the lookup map resolves', () => {
    expect(new Set(topicIds).size).toBe(topicIds.length)
    for (const topic of interviewTopics) {
      expect(interviewTopicById.get(topic.id)).toBe(topic)
    }
  })

  it('gives every topic the fields the hub card renders', () => {
    for (const topic of interviewTopics) {
      expect(topic.title.length, topic.id).toBeGreaterThanOrEqual(3)
      expect(topic.shortTitle.length, topic.id).toBeGreaterThan(2)
      expect(topic.icon.length, topic.id).toBeGreaterThan(0)
      expect(topic.oneLiner.length, topic.id).toBeGreaterThan(20)
      expect(topic.headlines.length, topic.id).toBeGreaterThanOrEqual(3)
    }
  })

  it('has a substantial question bank', () => {
    expect(allInterviewQuestions.length).toBeGreaterThanOrEqual(100)
    for (const topic of interviewTopics) {
      expect(topic.questions.length, topic.id).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('interview questions', () => {
  const questions: InterviewQuestion[] = allInterviewQuestions.map((entry) => entry.question)

  it('has globally unique question ids', () => {
    const ids = questions.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves every question through the lookup map with its topic', () => {
    for (const { topic, question } of allInterviewQuestions) {
      const found = interviewQuestionById.get(question.id)
      expect(found?.question, question.id).toBe(question)
      expect(found?.topic.id, question.id).toBe(topic.id)
    }
  })

  it('prefixes question ids so two topics cannot collide by accident', () => {
    for (const { question } of allInterviewQuestions) {
      expect(question.id, question.id).toMatch(/^itv-[a-z0-9]+-/)
    }
  })

  it('always states the prompt, what is being tested, and the answer', () => {
    for (const question of questions) {
      expect(question.prompt.trim().length, question.id).toBeGreaterThan(15)
      expect(question.probing.trim().length, question.id).toBeGreaterThan(15)
      expect(question.answer.length, question.id).toBeGreaterThanOrEqual(2)
      for (const paragraph of question.answer) {
        expect(paragraph.trim().length, question.id).toBeGreaterThan(20)
      }
    }
  })

  it('tags every question so the revision queue can group them', () => {
    for (const question of questions) {
      expect(question.tags.length, question.id).toBeGreaterThanOrEqual(1)
      for (const tag of question.tags) {
        expect(tag, question.id).toMatch(/^[a-z0-9][a-z0-9 ._+/-]*$/)
      }
    }
  })

  it('contains no placeholder or unfinished text', () => {
    const placeholder = /\b(TODO|TBD|FIXME|lorem ipsum|coming soon|xxx)\b/i
    for (const question of questions) {
      const blob = [
        question.prompt,
        question.probing,
        ...question.answer,
        ...(question.deeper ?? []),
      ].join(' ')
      expect(placeholder.test(blob), question.id).toBe(false)
    }
  })
})

describe('multiple-choice questions', () => {
  const choiceQuestions = allInterviewQuestions
    .map((entry) => entry.question)
    .filter((question) => question.kind === 'mcq' || question.kind === 'multi')

  it('exists in useful numbers, as the brief asked', () => {
    expect(choiceQuestions.length).toBeGreaterThanOrEqual(20)
  })

  it('gives every choice question options and an answer key', () => {
    for (const question of choiceQuestions) {
      expect(question.options?.length, question.id).toBeGreaterThanOrEqual(3)
      expect(question.correct?.length, question.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('points every answer key at an option that exists', () => {
    for (const question of choiceQuestions) {
      const optionIds = new Set((question.options ?? []).map((option) => option.id))
      for (const correct of question.correct ?? []) {
        expect(optionIds.has(correct), `${question.id} -> ${correct}`).toBe(true)
      }
    }
  })

  it('uses unique option ids within a question', () => {
    for (const question of choiceQuestions) {
      const ids = (question.options ?? []).map((option) => option.id)
      expect(new Set(ids).size, question.id).toBe(ids.length)
    }
  })

  it('never makes every option correct, and never none', () => {
    for (const question of choiceQuestions) {
      const correct = question.correct?.length ?? 0
      expect(correct, question.id).toBeGreaterThan(0)
      expect(correct, question.id).toBeLessThan(question.options?.length ?? 0)
    }
  })

  it('marks a single answer as mcq and several as multi', () => {
    for (const question of choiceQuestions) {
      if (question.kind === 'mcq') expect(question.correct, question.id).toHaveLength(1)
      else expect((question.correct ?? []).length, question.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('writes distractors long enough to be plausible, not one-word throwaways', () => {
    for (const question of choiceQuestions) {
      for (const option of question.options ?? []) {
        expect(option.text.trim().length, `${question.id} / ${option.id}`).toBeGreaterThan(3)
      }
      const texts = (question.options ?? []).map((option) => option.text.trim())
      expect(new Set(texts).size, question.id).toBe(texts.length)
    }
  })

  it('leaves open and scenario questions without an answer key', () => {
    for (const { question } of allInterviewQuestions) {
      if (question.kind === 'open' || question.kind === 'scenario') {
        expect(question.correct, question.id).toBeUndefined()
        expect(question.options, question.id).toBeUndefined()
      }
    }
  })
})

describe('difficulty spread', () => {
  it('runs from basic to advanced in every topic', () => {
    for (const topic of interviewTopics) {
      const levels = new Set(topic.questions.map((question) => question.level))
      expect(levels.has('basic'), `${topic.id} basic`).toBe(true)
      expect(levels.has('advanced'), `${topic.id} advanced`).toBe(true)
    }
  })

  it('weights the bank towards the senior end without dropping the basics', () => {
    const count = (level: string) =>
      allInterviewQuestions.filter((entry) => entry.question.level === level).length
    expect(count('basic')).toBeGreaterThanOrEqual(20)
    expect(count('intermediate')).toBeGreaterThanOrEqual(20)
    expect(count('advanced')).toBeGreaterThanOrEqual(30)
  })

  it('includes scenario questions in most topics', () => {
    const withScenarios = interviewTopics.filter((topic) =>
      topic.questions.some((question) => question.kind === 'scenario'),
    )
    expect(withScenarios.length).toBeGreaterThanOrEqual(8)
  })

  it('gives advanced questions the senior-level follow-through', () => {
    const advanced = allInterviewQuestions
      .map((entry) => entry.question)
      .filter((question) => question.level === 'advanced')
    const withDepth = advanced.filter(
      (question) => (question.deeper?.length ?? 0) > 0 || (question.followUps?.length ?? 0) > 0,
    )
    expect(withDepth.length / advanced.length).toBeGreaterThan(0.8)
  })
})

describe('code samples', () => {
  const samples = allInterviewQuestions.flatMap((entry) => [
    ...(entry.question.code ?? []).map((sample) => ({ id: entry.question.id, sample })),
    ...(entry.question.promptCode ?? []).map((sample) => ({ id: entry.question.id, sample })),
  ])

  it('ships plenty of runnable snippets, as the brief asked', () => {
    expect(samples.length).toBeGreaterThanOrEqual(80)
  })

  it('only uses languages the highlighter has registered', () => {
    const registered = new Set(['bash', 'yaml', 'json', 'dockerfile', 'hcl', 'python', 'text'])
    for (const { id, sample } of samples) {
      expect(registered.has(sample.language), `${id} -> ${sample.language}`).toBe(true)
    }
  })

  it('labels and fills every snippet', () => {
    for (const { id, sample } of samples) {
      expect(sample.title.trim().length, id).toBeGreaterThan(2)
      expect(sample.code.trim().length, id).toBeGreaterThan(10)
    }
  })

  it('never leaves a tab-indented YAML sample, which would be invalid', () => {
    for (const { id, sample } of samples) {
      if (sample.language !== 'yaml') continue
      expect(sample.code.includes('\t'), id).toBe(false)
    }
  })

  it('hardcodes no credentials', () => {
    const secret =
      /(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{10,})/
    for (const { id, sample } of samples) {
      expect(secret.test(sample.code), id).toBe(false)
    }
  })
})

describe('diagrams', () => {
  const diagrams = allInterviewQuestions.flatMap((entry) =>
    (entry.question.diagrams ?? []).map((diagram) => ({ id: entry.question.id, diagram })),
  )

  it('illustrates the critical concepts, as the brief asked', () => {
    expect(diagrams.length).toBeGreaterThanOrEqual(40)
    const topicsWithDiagrams = interviewTopics.filter((topic) =>
      topic.questions.some((question) => (question.diagrams?.length ?? 0) > 0),
    )
    expect(topicsWithDiagrams.length).toBeGreaterThanOrEqual(10)
  })

  it('titles every diagram', () => {
    for (const { id, diagram } of diagrams) {
      expect(diagram.title.trim().length, id).toBeGreaterThan(3)
    }
  })

  it('renders no raw markdown, which SVG text would show literally', () => {
    for (const { id, diagram } of diagrams) {
      for (const text of diagramStrings(diagram)) {
        expect(text.includes('`'), `${id}: ${text}`).toBe(false)
        expect(/\*\*/.test(text), `${id}: ${text}`).toBe(false)
      }
    }
  })

  it('keeps labels short enough to fit their boxes', () => {
    for (const { id, diagram } of diagrams) {
      for (const text of svgStrings(diagram)) {
        expect(text.length, `${id}: ${text}`).toBeLessThanOrEqual(120)
      }
    }
  })

  it('stays within a size a phone screen can render legibly', () => {
    for (const { id, diagram } of diagrams) {
      if (diagram.kind === 'flow') expect(diagram.nodes.length, id).toBeLessThanOrEqual(8)
      if (diagram.kind === 'decision') expect(diagram.branches.length, id).toBeLessThanOrEqual(5)
      if (diagram.kind === 'sequence') {
        expect(diagram.participants.length, id).toBeLessThanOrEqual(5)
        expect(diagram.messages.length, id).toBeLessThanOrEqual(12)
      }
    }
  })

  it('points every sequence message at a declared participant', () => {
    for (const { id, diagram } of diagrams) {
      if (diagram.kind !== 'sequence') continue
      const ids = new Set(diagram.participants.map((participant) => participant.id))
      for (const message of diagram.messages) {
        expect(ids.has(message.from), `${id}: from ${message.from}`).toBe(true)
        expect(ids.has(message.to), `${id}: to ${message.to}`).toBe(true)
      }
    }
  })
})
