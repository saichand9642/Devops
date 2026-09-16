import type { InterviewTopic } from '../../../types'
import { prometheusCoreQuestions } from './core'
import { promFundamentalQuestions } from './fundamentals'
import { promAlertingQuestions } from './alerting'
import { promPracticeQuestions } from './practice'

export const prometheusTopic: InterviewTopic = {
  id: 'prometheus',
  title: 'Prometheus & monitoring',
  shortTitle: 'Prometheus',
  icon: '📈',
  order: 7,
  oneLiner:
    'Pull-based metrics, PromQL, the four metric types, alerting design and what to do when it stops scaling.',
  headlines: [
    'Prometheus **pulls** metrics over HTTP. Targets expose `/metrics`; Prometheus scrapes them on an interval.',
    'Four metric types: counter (only goes up), gauge (up and down), histogram (bucketed), summary (client-side quantiles).',
    'Always `rate()` a counter before doing anything else with it. A raw counter value is meaningless.',
    'A time series is identified by its name **plus its labels**. Every unique label combination is a separate series.',
    'High-cardinality labels - user IDs, request IDs, full URLs - are the number one way to kill Prometheus.',
    'Alert on **symptoms users feel**, not on causes. Alert fatigue is a bigger risk than missing an alert.',
  ],
  questions: [
    ...prometheusCoreQuestions,
    ...promFundamentalQuestions,
    ...promAlertingQuestions,
    ...promPracticeQuestions,
  ],
}
