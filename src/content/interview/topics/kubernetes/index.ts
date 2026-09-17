import type { InterviewTopic } from '../../../types'
import { kubernetesCoreQuestions } from './core'
import { k8sWorkloadQuestions } from './workloads'
import { k8sNetworkingQuestions } from './networking'
import { k8sConfigSecurityQuestions } from './config-security'
import { k8sScenarioQuestions } from './scenarios'

export const kubernetesTopic: InterviewTopic = {
  id: 'kubernetes',
  title: 'Kubernetes',
  shortTitle: 'Kubernetes',
  icon: '☸️',
  order: 2,
  oneLiner:
    'Pods, controllers, Services, probes, scheduling and the troubleshooting rounds that decide the interview.',
  headlines: [
    'Everything is a controller running a reconcile loop: observe the desired state, compare with reality, act, repeat.',
    'You never talk to anything but the API server. Every other component watches it.',
    'Deployment owns a ReplicaSet, which owns Pods. That chain is why rollback is instant.',
    'A Service finds Pods by **label selector**, never by name. No match means no endpoints and no traffic.',
    'Readiness controls traffic; liveness controls restarts. Confusing them causes outages.',
    'Requests decide scheduling; limits decide throttling and OOM kills.',
    'The scheduler places a Pod **once** and never moves it. Nothing rebalances a cluster on its own.',
  ],
  questions: [
    ...kubernetesCoreQuestions,
    ...k8sWorkloadQuestions,
    ...k8sNetworkingQuestions,
    ...k8sConfigSecurityQuestions,
    ...k8sScenarioQuestions,
  ],
}
