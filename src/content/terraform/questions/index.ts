import type { Question } from '../../types'
import { iacQuestions } from './iac'
import { fundamentalsQuestions } from './fundamentals'
import { workflowQuestions } from './workflow'
import { configurationQuestions } from './configuration'
import { moduleQuestions } from './modules'
import { stateQuestions } from './state'
import { maintenanceQuestions } from './maintenance'
import { hcpQuestions } from './hcp'
import { examPrepQuestions } from './exam-prep'

/**
 * Every Terraform practice question.
 *
 * All original material written for this app against the published
 * objectives. None are actual exam questions.
 */
export const terraformQuestions: Question[] = [
  ...iacQuestions,
  ...fundamentalsQuestions,
  ...workflowQuestions,
  ...configurationQuestions,
  ...moduleQuestions,
  ...stateQuestions,
  ...maintenanceQuestions,
  ...hcpQuestions,
  ...examPrepQuestions,
]
