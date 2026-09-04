import type { Domain } from '../types'

/**
 * Domain weights and competency wording are taken from the official CNCF /
 * Linux Foundation CKAD curriculum (CKAD_Curriculum_v1.35, exam environment
 * Kubernetes v1.35). See `sources` in ./index.ts for the links.
 *
 * `foundations` and `exam-prep` are study aids added by this app. They carry no
 * official exam weight, which is why their `examWeight` is null - the five
 * weighted domains below add up to exactly 100%.
 */
export const ckadDomains: Domain[] = [
  {
    id: 'foundations',
    title: 'Kubernetes Foundations',
    shortTitle: 'Foundations',
    examWeight: null,
    description:
      'The groundwork the exam assumes you already have: what a cluster is, how kubectl talks to it, how YAML manifests are shaped, and how to look things up without guessing.',
    officialCompetencies: [],
    accent: 'slate',
    order: 0,
  },
  {
    id: 'design-build',
    title: 'Application Design and Build',
    shortTitle: 'Design & Build',
    examWeight: 20,
    description:
      'Building container images, picking the right workload resource, composing multi-container Pods, and attaching storage to an application.',
    officialCompetencies: [
      'Define, build and modify container images',
      'Choose and use the right workload resource (Deployment, DaemonSet, CronJob, etc.)',
      'Understand multi-container Pod design patterns (e.g. sidecar, init and others)',
      'Utilize persistent and ephemeral volumes',
    ],
    accent: 'blue',
    order: 1,
  },
  {
    id: 'deployment',
    title: 'Application Deployment',
    shortTitle: 'Deployment',
    examWeight: 20,
    description:
      'Rolling out and rolling back Deployments, implementing blue/green and canary releases with plain Kubernetes primitives, and using Helm and Kustomize.',
    officialCompetencies: [
      'Use Kubernetes primitives to implement common deployment strategies (e.g. blue/green or canary)',
      'Understand Deployments and how to perform rolling updates',
      'Use the Helm package manager to deploy existing packages',
      'Kustomize',
    ],
    accent: 'violet',
    order: 2,
  },
  {
    id: 'observability',
    title: 'Application Observability and Maintenance',
    shortTitle: 'Observability',
    examWeight: 15,
    description:
      'Health checks, logs, events, the built-in CLI monitoring tools, API deprecations, and a repeatable method for debugging broken workloads.',
    officialCompetencies: [
      'Understand API deprecations',
      'Implement probes and health checks',
      'Use built-in CLI tools to monitor Kubernetes applications',
      'Utilize container logs',
      'Debugging in Kubernetes',
    ],
    accent: 'amber',
    order: 3,
  },
  {
    id: 'environment-security',
    title: 'Application Environment, Configuration and Security',
    shortTitle: 'Config & Security',
    examWeight: 25,
    description:
      'The largest domain: ConfigMaps and Secrets, resource requests and limits, quotas, ServiceAccounts, SecurityContexts, RBAC, and extending the API with CRDs.',
    officialCompetencies: [
      'Discover and use resources that extend Kubernetes (CRD, Operators)',
      'Understand authentication, authorization and admission control',
      'Understand requests, limits, quotas',
      'Understand ConfigMaps',
      'Define resource requirements',
      'Create & consume Secrets',
      'Understand ServiceAccounts',
      'Understand Application Security (SecurityContexts, Capabilities, etc.)',
    ],
    accent: 'emerald',
    order: 4,
  },
  {
    id: 'services-networking',
    title: 'Services and Networking',
    shortTitle: 'Services & Networking',
    examWeight: 20,
    description:
      'Exposing applications with Services, resolving them through cluster DNS, routing HTTP with Ingress, restricting traffic with NetworkPolicies, and debugging connectivity.',
    officialCompetencies: [
      'Demonstrate basic understanding of NetworkPolicies',
      'Provide and troubleshoot access to applications via services',
      'Use Ingress rules to expose applications',
    ],
    accent: 'cyan',
    order: 5,
  },
  {
    id: 'exam-prep',
    title: 'Exam Technique',
    shortTitle: 'Exam Technique',
    examWeight: null,
    description:
      'How to actually finish in two hours: fast kubectl habits, generating YAML instead of typing it, navigating the docs, time management, and the traps that cost people marks.',
    officialCompetencies: [],
    accent: 'rose',
    order: 6,
  },
]

/** The five officially weighted domains, in curriculum order. */
export const weightedDomainIds = [
  'design-build',
  'deployment',
  'observability',
  'environment-security',
  'services-networking',
] as const

export const domainById = new Map(ckadDomains.map((domain) => [domain.id, domain]))
