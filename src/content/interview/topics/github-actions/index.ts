import type { InterviewTopic } from '../../../types'
import { githubActionsCoreQuestions } from './core'
import { ghaWorkflowQuestions } from './workflows'
import { ghaPracticeQuestions } from './practice'
import { ghaAdvancedQuestions } from './advanced'

export const githubActionsTopic: InterviewTopic = {
  id: 'github-actions',
  title: 'GitHub Actions',
  shortTitle: 'GH Actions',
  icon: '⚙️',
  order: 4,
  oneLiner:
    'Workflows, jobs, runners, secrets, OIDC and the supply-chain questions interviewers now always ask.',
  headlines: [
    'Workflow → jobs → steps. Jobs run in parallel on separate runners; steps run in order on one.',
    'Each job gets a **fresh runner**, so nothing carries between jobs except artifacts and outputs you declare.',
    '`needs` creates job dependencies; without it everything runs at once.',
    'Use **OIDC** for cloud credentials instead of long-lived keys in secrets.',
    'Pin third-party actions to a full commit SHA - a tag can be moved by whoever owns the action.',
    '`pull_request_target` runs with write permissions and repository secrets. Treat it as dangerous.',
  ],
  questions: [
    ...githubActionsCoreQuestions,
    ...ghaWorkflowQuestions,
    ...ghaPracticeQuestions,
    ...ghaAdvancedQuestions,
  ],
}
