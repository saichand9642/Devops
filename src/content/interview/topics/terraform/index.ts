import type { InterviewTopic } from '../../../types'
import { terraformCoreQuestions } from './core'
import { terraformStateQuestions } from './state-workflow'
import { terraformLanguageQuestions } from './language'
import { terraformPracticeQuestions } from './practice'

export const terraformTopic: InterviewTopic = {
  id: 'terraform',
  title: 'Terraform & IaC',
  shortTitle: 'Terraform',
  icon: '🏗️',
  order: 6,
  oneLiner:
    'State, modules, the plan/apply loop, drift and the team-workflow questions that separate users from designers.',
  headlines: [
    'State maps your configuration addresses to real resource IDs. Without it Terraform cannot tell "create" from "change".',
    'State is stored in **plaintext** and contains secrets. `sensitive = true` only hides values from CLI output.',
    'A plan is a three-way diff: configuration, state, and refreshed reality.',
    '`-/+` in a plan means destroy and recreate. Read those lines every time.',
    '`terraform state rm` forgets a resource; it does **not** destroy it.',
    'There is no rollback. State is written as work completes, so a failed apply is resumable.',
  ],
  questions: [
    ...terraformCoreQuestions,
    ...terraformStateQuestions,
    ...terraformLanguageQuestions,
    ...terraformPracticeQuestions,
  ],
}
