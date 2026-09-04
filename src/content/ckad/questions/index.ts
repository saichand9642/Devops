import type { Question } from '../../types'
import { foundationsQuestions } from './foundations'
import { designBuildQuestions } from './design-build'
import { deploymentQuestions } from './deployment'
import { observabilityQuestions } from './observability'
import { environmentSecurityQuestions } from './environment-security'
import { servicesNetworkingQuestions } from './services-networking'
import { examPrepQuestions } from './exam-prep'

/**
 * The whole CKAD question bank.
 *
 * Mock exams draw only from the five officially weighted domains (see
 * `examBlueprint.weights`); the foundations and exam-technique questions are
 * available in the practice section.
 *
 * Every question is written for this app - none are taken from, or reproduce,
 * real exam content.
 */
export const ckadQuestions: Question[] = [
  ...foundationsQuestions,
  ...designBuildQuestions,
  ...deploymentQuestions,
  ...observabilityQuestions,
  ...environmentSecurityQuestions,
  ...servicesNetworkingQuestions,
  ...examPrepQuestions,
]

export const questionById = new Map(ckadQuestions.map((question) => [question.id, question]))

export function questionsForDomain(domainId: string): Question[] {
  return ckadQuestions.filter((question) => question.domainId === domainId)
}

export function questionsForTopic(topicId: string): Question[] {
  return ckadQuestions.filter((question) => question.topicId === topicId)
}
