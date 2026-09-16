import type { InterviewTopic } from '../../../types'
import { jenkinsCoreQuestions } from './core'
import { jenkinsPipelineQuestions } from './pipelines'
import { jenkinsOperationsQuestions } from './operations'
import { jenkinsPracticeQuestions } from './practice'

export const jenkinsTopic: InterviewTopic = {
  id: 'jenkins',
  title: 'Jenkins & CI/CD',
  shortTitle: 'Jenkins',
  icon: '🔧',
  order: 3,
  oneLiner:
    'Declarative pipelines, agents, shared libraries, credentials and the CI/CD design questions behind them.',
  headlines: [
    'Pipeline as code lives in a `Jenkinsfile` in the repository, so the pipeline is reviewed and versioned like the application.',
    'Declarative pipeline is the default choice; scripted is the escape hatch when you need real Groovy control flow.',
    'The controller schedules and stores; agents execute. Never run builds on the controller.',
    'Credentials come from the credentials store via `withCredentials` or the `credentials()` helper - never as plain text in the Jenkinsfile.',
    'CI is "does this change integrate?"; CD is "can this change be released?". Continuous deployment means it goes automatically.',
    '`post { always { ... } }` is where cleanup and notification belong, because it runs whatever the outcome.',
  ],
  questions: [
    ...jenkinsCoreQuestions,
    ...jenkinsPipelineQuestions,
    ...jenkinsOperationsQuestions,
    ...jenkinsPracticeQuestions,
  ],
}
