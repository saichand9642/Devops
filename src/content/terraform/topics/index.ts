import type { Topic } from '../../types'
import { iacTopics } from './iac'
import { fundamentalsTopics } from './fundamentals'
import { workflowTopics } from './workflow'
import { configurationTopics } from './configuration'
import { moduleTopics } from './modules'
import { stateTopics } from './state'
import { maintenanceTopics } from './maintenance'
import { hcpTopics } from './hcp'
import { examPrepTopics } from './exam-prep'

/**
 * Every Terraform Associate lesson, in curriculum order.
 *
 * Grouped by the eight published exam objectives, plus an exam-technique
 * section this app adds.
 */
export const terraformTopics: Topic[] = [
  ...iacTopics,
  ...fundamentalsTopics,
  ...workflowTopics,
  ...configurationTopics,
  ...moduleTopics,
  ...stateTopics,
  ...maintenanceTopics,
  ...hcpTopics,
  ...examPrepTopics,
]

export const terraformTopicById = new Map(terraformTopics.map((topic) => [topic.id, topic]))
