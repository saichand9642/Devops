import type { Domain } from '../types'

/**
 * The eight official Terraform Associate (004) exam objectives.
 *
 * Competencies are quoted from HashiCorp's published exam content list,
 * verified 2026-09-04 against
 * https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004
 *
 * IMPORTANT: HashiCorp publishes the objectives but NOT a per-objective
 * weighting, and not a pass mark. Every domain therefore has
 * `examWeight: null` and shows its objective number instead of a percentage.
 * Inventing percentages and presenting them as official would be misleading.
 */
export const terraformDomains: Domain[] = [
  {
    id: 'tf-iac',
    title: 'Infrastructure as Code with Terraform',
    shortTitle: 'IaC concepts',
    examWeight: null,
    weightLabel: 'Objective 1',
    description:
      'What infrastructure as code is, why teams adopt it, and how Terraform stays useful across more than one cloud.',
    officialCompetencies: [
      'Explain what IaC is',
      'Describe the advantages of IaC patterns',
      'Explain how Terraform manages multi-cloud, hybrid cloud, and service-agnostic workflows',
    ],
    accent: 'violet',
    order: 1,
  },
  {
    id: 'tf-fundamentals',
    title: 'Terraform fundamentals',
    shortTitle: 'Fundamentals',
    examWeight: null,
    weightLabel: 'Objective 2',
    description:
      'Installing Terraform, how providers are found, pinned and used, and a first look at what state is for.',
    officialCompetencies: [
      'Install and version Terraform providers',
      'Describe how Terraform uses providers',
      'Write Terraform configuration using multiple providers',
      'Explain how Terraform uses and manages state',
    ],
    accent: 'blue',
    order: 2,
  },
  {
    id: 'tf-workflow',
    title: 'Core Terraform workflow',
    shortTitle: 'Core workflow',
    examWeight: null,
    weightLabel: 'Objective 3',
    description:
      'Write, init, validate, plan, apply, destroy - and fmt. The loop you will run hundreds of times.',
    officialCompetencies: [
      'Describe the Terraform workflow',
      'Initialize a Terraform working directory',
      'Validate a Terraform configuration',
      'Generate and review an execution plan for Terraform',
      'Apply changes to infrastructure with Terraform',
      'Destroy Terraform-managed infrastructure',
      'Apply formatting and style adjustments to a configuration',
    ],
    accent: 'emerald',
    order: 3,
  },
  {
    id: 'tf-configuration',
    title: 'Terraform configuration',
    shortTitle: 'Configuration',
    examWeight: null,
    weightLabel: 'Objective 4',
    description:
      'The language itself: resources, data sources, variables, outputs, complex types, expressions, loops, dependencies, validation and secrets.',
    officialCompetencies: [
      'Use and differentiate resource and data blocks',
      'Refer to resource attributes and create cross-resource references',
      'Use variables and outputs',
      'Understand and use complex types',
      'Write dynamic configuration using expressions and functions',
      'Define resource dependencies in configuration',
      'Validate configuration using custom conditions',
      'Understand best practices for managing sensitive data, including secrets management with Vault',
    ],
    accent: 'amber',
    order: 4,
  },
  {
    id: 'tf-modules',
    title: 'Terraform modules',
    shortTitle: 'Modules',
    examWeight: null,
    weightLabel: 'Objective 5',
    description:
      'Packaging configuration for reuse: where modules come from, how values cross the boundary, and how to pin versions.',
    officialCompetencies: [
      'Explain how Terraform sources modules',
      'Describe variable scope within modules',
      'Use modules in configuration',
      'Manage module versions',
    ],
    accent: 'cyan',
    order: 5,
  },
  {
    id: 'tf-state',
    title: 'Terraform state management',
    shortTitle: 'State',
    examWeight: null,
    weightLabel: 'Objective 6',
    description:
      'Local and remote backends, locking, drift, and the state subcommands that get you out of trouble.',
    officialCompetencies: [
      'Describe the local backend',
      'Describe state locking',
      'Configure remote state using the backend block',
      'Manage resource drift and Terraform state',
    ],
    accent: 'rose',
    order: 6,
  },
  {
    id: 'tf-maintenance',
    title: 'Maintain infrastructure with Terraform',
    shortTitle: 'Maintenance',
    examWeight: null,
    weightLabel: 'Objective 7',
    description:
      'Bringing existing infrastructure under management, inspecting state from the CLI, and turning on verbose logging when you are stuck.',
    officialCompetencies: [
      'Import existing infrastructure into your Terraform workspace',
      'Use the CLI to inspect state',
      'Describe when and how to use verbose logging',
    ],
    accent: 'slate',
    order: 7,
  },
  {
    id: 'tf-hcp',
    title: 'HCP Terraform',
    shortTitle: 'HCP Terraform',
    examWeight: null,
    weightLabel: 'Objective 8',
    description:
      'The managed platform: remote runs, workspaces and projects, VCS-driven workflows, and the governance features teams rely on.',
    officialCompetencies: [
      'Use HCP Terraform to create infrastructure',
      'Describe HCP Terraform collaboration and governance features',
      'Describe how to organize and use HCP Terraform workspaces and projects',
      'Configure and use HCP Terraform integration',
    ],
    accent: 'violet',
    order: 8,
  },
  {
    id: 'tf-exam-prep',
    title: 'Exam technique',
    shortTitle: 'Exam technique',
    examWeight: null,
    description:
      'How the exam is actually shaped, the traps that catch people, and how to spend the hour. Added by this app - not an official objective.',
    officialCompetencies: [],
    accent: 'slate',
    order: 9,
  },
]

export const terraformDomainById = new Map(terraformDomains.map((domain) => [domain.id, domain]))
