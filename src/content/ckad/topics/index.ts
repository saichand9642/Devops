import type { Topic } from '../../types'

import {
  contextsAndNamespaces,
  coreObjects,
  imperativeVsDeclarative,
  kubectlBasics,
  kubernetesArchitecture,
  labelsSelectorsAnnotations,
  yamlAndApiDiscovery,
} from './foundations'
import {
  commandsAndArgs,
  containerImages,
  cronjobs,
  deploymentsAndReplicaSets,
  initContainers,
  jobs,
  multiContainerPatterns,
  persistentVolumeClaims,
  pods,
  volumesAndEphemeralStorage,
  workloadResources,
} from './design-build'
import {
  choosingDeploymentTooling,
  deploymentStrategies,
  helmFundamentals,
  kustomizeFundamentals,
  rollingUpdates,
  scalingApplications,
} from './deployment'
import {
  apiDeprecations,
  containerLogs,
  debuggingPods,
  describeAndEvents,
  monitoringCliTools,
  podFailureModes,
  probes,
} from './observability'
import {
  authnAuthzAdmission,
  configmaps,
  crdsAndOperators,
  envAndConfigInjection,
  quotaAndLimitRange,
  rbac,
  resourceRequirements,
  secrets,
  securitycontext,
  serviceaccounts,
} from './environment-security'
import {
  dnsAndServiceDiscovery,
  ingress,
  networkpolicy,
  servicePortsAndEndpoints,
  serviceTypes,
  troubleshootingNetworking,
} from './services-networking'
import { efficientKubectl, examTrapsAndChecklist, usingDocsAndTime } from './exam-prep'

/**
 * All CKAD topics, in curriculum order.
 *
 * Ordering within the app comes from `domain.order` and `topic.order`, so this
 * array only needs to be complete, not sorted. Add a new topic to its domain
 * barrel and then to the list below.
 */
export const ckadTopics: Topic[] = [
  // foundations
  contextsAndNamespaces,
  coreObjects,
  imperativeVsDeclarative,
  kubectlBasics,
  kubernetesArchitecture,
  labelsSelectorsAnnotations,
  yamlAndApiDiscovery,
  // design-build
  commandsAndArgs,
  containerImages,
  cronjobs,
  deploymentsAndReplicaSets,
  initContainers,
  jobs,
  multiContainerPatterns,
  persistentVolumeClaims,
  pods,
  volumesAndEphemeralStorage,
  workloadResources,
  // deployment
  choosingDeploymentTooling,
  deploymentStrategies,
  helmFundamentals,
  kustomizeFundamentals,
  rollingUpdates,
  scalingApplications,
  // observability
  apiDeprecations,
  containerLogs,
  debuggingPods,
  describeAndEvents,
  monitoringCliTools,
  podFailureModes,
  probes,
  // environment-security
  authnAuthzAdmission,
  configmaps,
  crdsAndOperators,
  envAndConfigInjection,
  quotaAndLimitRange,
  rbac,
  resourceRequirements,
  secrets,
  securitycontext,
  serviceaccounts,
  // services-networking
  dnsAndServiceDiscovery,
  ingress,
  networkpolicy,
  servicePortsAndEndpoints,
  serviceTypes,
  troubleshootingNetworking,
  // exam-prep
  efficientKubectl,
  examTrapsAndChecklist,
  usingDocsAndTime,
]

export const topicById = new Map(ckadTopics.map((topic) => [topic.id, topic]))
