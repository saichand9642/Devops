import type { InterviewTopic } from '../../../types'
import { ansibleCoreQuestions } from './core'
import { ansibleFundamentalQuestions } from './fundamentals'
import { ansiblePracticeQuestions } from './practice'
import { ansibleAdvancedQuestions } from './advanced'

export const ansibleTopic: InterviewTopic = {
  id: 'ansible',
  title: 'Ansible',
  shortTitle: 'Ansible',
  icon: '📋',
  order: 9,
  oneLiner:
    'Agentless configuration management: playbooks, inventory, idempotence, roles, Vault and where it fits next to Terraform.',
  headlines: [
    'Agentless and push-based: Ansible connects over SSH (or WinRM) and runs modules, then removes them.',
    '**Idempotence** is the core promise - a module checks state first and reports `changed` only if it acted.',
    'Terraform **provisions** infrastructure; Ansible **configures** what is on it. They overlap but are not substitutes.',
    '`command` and `shell` are the two modules that are **not** idempotent. Everything else usually is.',
    'Roles are the unit of reuse; inventory groups are the unit of targeting.',
    'Secrets go in Ansible Vault, or better, are fetched at runtime from a real secret store.',
  ],
  questions: [
    ...ansibleCoreQuestions,
    ...ansibleFundamentalQuestions,
    ...ansiblePracticeQuestions,
    ...ansibleAdvancedQuestions,
  ],
}
