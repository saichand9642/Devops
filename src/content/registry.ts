/**
 * Per-course lookup indexes.
 *
 * Pages used to import CKAD's own `topicById` / `domainById` maps directly,
 * which quietly hard-wired the whole UI to one course. Everything now goes
 * through an index resolved from the `:courseId` route segment, so adding a
 * course is a content change rather than a UI change.
 */

import type { Course, Domain, Question, Topic } from './types'
import { courses } from './courses'

export interface CourseIndex {
  course: Course
  domainById: Map<string, Domain>
  topicById: Map<string, Topic>
  questionById: Map<string, Question>
  /** Domain ids that carry an official published exam weight, in order. */
  weightedDomainIds: string[]
  questionsForDomain: (domainId: string) => Question[]
  questionsForTopic: (topicId: string) => Question[]
  topicsForDomain: (domainId: string) => Topic[]
}

function buildIndex(course: Course): CourseIndex {
  const byDomain = new Map<string, Question[]>()
  const byTopic = new Map<string, Question[]>()

  for (const question of course.questions) {
    const domainBucket = byDomain.get(question.domainId)
    if (domainBucket) domainBucket.push(question)
    else byDomain.set(question.domainId, [question])

    const topicBucket = byTopic.get(question.topicId)
    if (topicBucket) topicBucket.push(question)
    else byTopic.set(question.topicId, [question])
  }

  const topicsByDomain = new Map<string, Topic[]>()
  for (const topic of [...course.topics].sort((a, b) => a.order - b.order)) {
    const bucket = topicsByDomain.get(topic.domainId)
    if (bucket) bucket.push(topic)
    else topicsByDomain.set(topic.domainId, [topic])
  }

  return {
    course,
    domainById: new Map(course.domains.map((domain) => [domain.id, domain])),
    topicById: new Map(course.topics.map((topic) => [topic.id, topic])),
    questionById: new Map(course.questions.map((question) => [question.id, question])),
    weightedDomainIds: course.domains
      .filter((domain) => domain.examWeight !== null)
      .sort((a, b) => a.order - b.order)
      .map((domain) => domain.id),
    questionsForDomain: (domainId) => byDomain.get(domainId) ?? [],
    questionsForTopic: (topicId) => byTopic.get(topicId) ?? [],
    topicsForDomain: (domainId) => topicsByDomain.get(domainId) ?? [],
  }
}

/** Built once at module load; all content is static. */
export const courseIndexes: CourseIndex[] = courses.map(buildIndex)

const byId = new Map(courseIndexes.map((index) => [index.course.id, index]))

/**
 * Resolve the index for a route segment. Returns `undefined` for an unknown
 * id so pages can render their own not-found state rather than throwing.
 */
export function courseIndex(courseId: string | undefined): CourseIndex | undefined {
  return courseId ? byId.get(courseId) : undefined
}

/** The course used on pages that are not scoped to one, such as the sidebar. */
export const defaultCourseIndex: CourseIndex = courseIndexes[0]

/**
 * Which course a topic belongs to. Ids are globally unique across courses
 * (enforced by a content test), so a bare topic id is enough to build a link.
 */
export function courseIdForTopic(topicId: string): string | undefined {
  return courseIndexes.find((index) => index.topicById.has(topicId))?.course.id
}

/**
 * The course a URL belongs to, from its first path segment.
 *
 * App chrome (sidebar, tab bar) is rendered by a layout route, and
 * `useParams` there does not see a child route's `:courseId`, so the active
 * course is read from the path instead. Falls back to the first course on
 * pages that belong to no course, such as Home.
 */
export function courseFromPath(pathname: string): CourseIndex {
  const slug = pathname.replace(/^\/+/, '').split('/')[0]
  return courseIndex(slug) ?? defaultCourseIndex
}
