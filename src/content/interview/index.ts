import type { InterviewQuestion, InterviewTopic, InterviewTrack } from '../types'
import { dockerTopic } from './topics/docker'
import { kubernetesTopic } from './topics/kubernetes'
import { jenkinsTopic } from './topics/jenkins'
import { githubActionsTopic } from './topics/github-actions'
import { awsTopic } from './topics/aws'
import { terraformTopic } from './topics/terraform'
import { prometheusTopic } from './topics/prometheus'
import { ansibleTopic } from './topics/ansible'
import { splunkTopic } from './topics/splunk'
import { pythonTopic } from './topics/python'
import { shellTopic } from './topics/shell'
import { linuxTopic } from './topics/linux'

/**
 * DevOps interview preparation.
 *
 * Separate from the certification courses on purpose: a course teaches a
 * syllabus, this rehearses answers. The unit of study here is a single
 * question you can answer out loud, not a lesson you work through.
 */
export const interviewTopics: InterviewTopic[] = [
  dockerTopic,
  kubernetesTopic,
  jenkinsTopic,
  githubActionsTopic,
  awsTopic,
  terraformTopic,
  prometheusTopic,
  ansibleTopic,
  splunkTopic,
  pythonTopic,
  shellTopic,
  linuxTopic,
].sort((a, b) => a.order - b.order)

export const interviewTrack: InterviewTrack = {
  id: 'interview',
  title: 'DevOps interview preparation',
  subtitle:
    'Questions a real interviewer asks, from first-round basics to senior scenario rounds - with the answer, the trap, and what they will ask next.',
  route: '/interview',
  topics: interviewTopics,
}

export const interviewTopicById = new Map(interviewTopics.map((topic) => [topic.id, topic]))

/** Every question across every topic, with its topic attached. */
export const allInterviewQuestions: { topic: InterviewTopic; question: InterviewQuestion }[] =
  interviewTopics.flatMap((topic) => topic.questions.map((question) => ({ topic, question })))

export const interviewQuestionById = new Map(
  allInterviewQuestions.map((entry) => [entry.question.id, entry]),
)
