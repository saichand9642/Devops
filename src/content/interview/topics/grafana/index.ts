import type { InterviewTopic } from '../../../types'
import { grafanaCoreQuestions } from './core'
import { grafanaLogsQuestions } from './logs'
import { grafanaObservabilityQuestions } from './observability'
import { grafanaPracticeQuestions } from './practice'

export const grafanaTopic: InterviewTopic = {
  id: 'grafana',
  title: 'Grafana & observability',
  shortTitle: 'Grafana',
  icon: '📊',
  order: 8,
  oneLiner:
    'Dashboards as code, the log pipeline from container stdout to Loki, traces and OpenTelemetry, and the incidents that test all three.',
  headlines: [
    'Grafana **stores nothing**. Every panel is a live query against a data source - so a slow dashboard is a query problem.',
    'The log path has six links: app stdout, container runtime, node file, agent DaemonSet, log store, Grafana. Every one can lose lines.',
    'Applications log to **stdout** and nothing else. Collecting, shipping and storing is the platform’s job, not the application’s.',
    'Loki indexes **labels, not content**. That is why it is cheap, and why a high-cardinality label destroys it.',
    'Metrics say *that* something is wrong, traces say *where*, logs say *why*. Correlation between them is configured, not automatic.',
    'Alert on symptoms users feel, with a runbook link. An alert nobody acts on should be fixed or deleted.',
  ],
  questions: [
    ...grafanaCoreQuestions,
    ...grafanaLogsQuestions,
    ...grafanaObservabilityQuestions,
    ...grafanaPracticeQuestions,
  ],
}
