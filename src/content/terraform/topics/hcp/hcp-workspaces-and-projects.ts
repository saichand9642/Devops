import type { Topic } from '../../../types'

export const hcpWorkspacesAndProjects: Topic = {
  id: 'tf-hcp-workspaces-and-projects',
  title: 'Organising HCP workspaces and projects',
  domainId: 'tf-hcp',
  difficulty: 'intermediate',
  estimatedMinutes: 14,
  order: 2,
  tags: ['workspaces', 'projects', 'variable sets', 'run triggers', 'objective-8c'],
  oneLiner:
    'How to slice an estate into workspaces, group them into projects, and share variables without repetition.',
  explanation: [
    'An **HCP workspace** holds one state, its variables, its credentials, its run history and its permissions. It is the unit of both isolation and access control.',
    'A **project** groups workspaces. Permissions can be granted at project level, so a team gets access to every workspace in "Platform" without twenty individual grants. Projects also scope tag-based workspace selection.',
    'The organising question is how finely to slice. Too coarse means a huge blast radius and slow runs; too fine means many workspaces to wire together with remote state. The usual answer is one workspace per component per environment.',
    '**Variable sets** solve the repetition that granular workspaces create: define a set once and apply it to a project or a list of workspaces, so a shared credential or region is configured in one place.',
  ],
  whyItMatters: [
    'Objective 8c is describing how to organise and use HCP workspaces and projects, which is exactly this.',
    'Workspace granularity is the decision that most affects how pleasant a large Terraform estate is to operate.',
    'Variable sets are the feature that makes fine-grained workspaces practical rather than tedious.',
  ],
  howItWorks: [
    'Each workspace has a name, a project, an execution mode, a working directory (for a monorepo), a Terraform version, variables, and optionally a VCS connection.',
    'Naming convention matters because it is your only navigation aid at scale. `<component>-<environment>` is the common pattern: `network-production`, `network-staging`.',
    'Projects group workspaces and are the level at which team permissions are usually granted. A workspace belongs to exactly one project.',
    'Tag-based `cloud` blocks let one configuration serve several workspaces: `workspaces { tags = ["network"], project = "Platform" }`, selected with `terraform workspace select`.',
    '**Variable sets** are named collections of variables applied to a project, to specific workspaces, or globally. Workspace-level variables override a variable set of the same name.',
    '**Run triggers** make one workspace run automatically after another succeeds - how a network change can trigger the dependent application workspace.',
    'Cross-workspace values are read either with the `tfe_outputs` data source (which exposes only declared outputs) or with `terraform_remote_state` (which exposes the whole state).',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Organisation, projects, workspaces',
      caption:
        'Permissions are usually granted at the project level, which is what makes projects worth using rather than a flat list of workspaces.',
      root: {
        label: 'Organisation: acme-corp',
        children: [
          {
            label: 'Project: Platform',
            detail: 'Team "platform" has write access to the whole project',
            tone: 'accent',
            children: [
              { label: 'network-production', detail: 'One state, its own credentials' },
              { label: 'network-staging', detail: 'One state, staging credentials' },
              { label: 'dns-production', detail: 'One state' },
            ],
          },
          {
            label: 'Project: Payments',
            detail: 'Team "payments" has write; team "platform" read-only',
            children: [
              { label: 'payments-api-production', detail: 'One state' },
              { label: 'payments-api-staging', detail: 'One state' },
            ],
          },
          {
            label: 'Variable set: aws-eu-west-1',
            detail: 'Applied to both projects - region and shared tags',
            tone: 'success',
          },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'How finely should I slice workspaces?',
      caption:
        'One workspace per component per environment is the default that works. Deviate deliberately.',
      question: 'What is the boundary you care about?',
      branches: [
        {
          condition: 'component and environment',
          result: 'One workspace per pair',
          detail: 'network-prod, network-staging, api-prod, api-staging',
          tone: 'accent',
        },
        {
          condition: 'ownership - different teams',
          result: 'Separate workspaces, separate projects',
          detail: 'So permissions can differ',
        },
        {
          condition: 'change frequency differs greatly',
          result: 'Split them',
          detail: 'A daily app deploy should not re-plan the VPC',
        },
        {
          condition: 'everything in one workspace',
          result: 'Only for something genuinely small',
          detail: 'Otherwise every run risks everything',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Workspace settings',
      purpose: 'The settings that matter when organising an estate.',
      fields: [
        {
          path: 'Name',
          meaning: 'Your only navigation aid at scale. Use a convention.',
          required: true,
        },
        {
          path: 'Project',
          meaning: 'Grouping, and usually where permissions are granted.',
          required: true,
        },
        { path: 'Execution mode', meaning: 'Remote, local, or agent.' },
        { path: 'Working directory', meaning: 'Which subdirectory of the repository to run in.' },
        { path: 'Terraform version', meaning: 'Pinned per workspace.' },
        { path: 'VCS connection', meaning: 'Repository, branch and trigger patterns.' },
        { path: 'Variables', meaning: 'Terraform and environment, each optionally sensitive.' },
      ],
    },
    {
      kind: 'Sharing mechanisms',
      purpose: 'How workspaces avoid repetition and pass values between each other.',
      fields: [
        {
          path: 'Variable set',
          meaning: 'Variables applied to a project, workspaces, or globally.',
          required: true,
        },
        { path: 'Run trigger', meaning: 'Run this workspace after another succeeds.' },
        {
          path: 'tfe_outputs data source',
          meaning: 'Read another workspace’s declared OUTPUTS only.',
          required: true,
        },
        {
          path: 'terraform_remote_state',
          meaning: 'Read another workspace’s whole state. Broader access.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'One workspace, fourteen minutes, everything at risk',
    story: [
      'A team put their whole production estate in one workspace: network, databases, three applications, DNS and monitoring. About four hundred resources.',
      'Every plan took fourteen minutes, because refresh touched all four hundred. Every apply, including a one-line tag change on a monitoring dashboard, could in principle affect the VPC.',
      'Worse, permissions were all-or-nothing. The application team needed to deploy, so they had write access to the networking resources too.',
      'Splitting into six workspaces across two projects reduced the common plan to about ninety seconds, let the application team have write access only where they needed it, and turned "we might break networking" into "we cannot reach networking". Run triggers preserved the ordering they actually relied on.',
    ],
    code: [
      {
        title: 'The layout after splitting',
        language: 'bash',
        code: `Organisation: acme-corp

Project: Platform          (team platform: write)
  network-production       ~40 resources
  dns-production           ~15 resources
  monitoring-production    ~30 resources

Project: Applications      (team apps: write, team platform: read)
  api-production           ~90 resources
  web-production           ~70 resources
  worker-production        ~60 resources

Variable set "aws-production"  -> applied to both projects
  TFC_AWS_PROVIDER_AUTH  = true          (env)
  TFC_AWS_RUN_ROLE_ARN   = arn:aws:...   (env)
  region                 = "eu-west-1"   (terraform)

Run trigger: network-production -> api-production
             (so an API run follows a network change)`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'One configuration, several workspaces by tag',
      language: 'hcl',
      explanation:
        'Tag binding is what lets a single repository directory serve production and staging as separate HCP workspaces.',
      code: `terraform {
  cloud {
    organization = "acme-corp"

    workspaces {
      tags    = ["network"]
      project = "Platform"
    }
  }
}

# terraform workspace list
#   network-production
#   network-staging
# terraform workspace select network-staging

# The workspace name is available in the configuration, so it
# can drive naming - though per-environment VALUES are better
# supplied as workspace variables.
locals {
  environment = trimprefix(terraform.workspace, "network-")
}

resource "aws_vpc" "this" {
  cidr_block = var.vpc_cidr    # a workspace variable

  tags = {
    Name        = "network-\${local.environment}"
    Environment = local.environment
  }
}`,
    },
    {
      title: 'Reading another workspace’s outputs',
      language: 'hcl',
      explanation:
        '`tfe_outputs` is the narrower option: it exposes only declared outputs, where `terraform_remote_state` exposes the whole state including its secrets.',
      code: `terraform {
  required_providers {
    tfe = { source = "hashicorp/tfe", version = "~> 0.60" }
  }
}

# Preferred on HCP: only the DECLARED OUTPUTS are exposed.
data "tfe_outputs" "network" {
  organization = "acme-corp"
  workspace    = "network-production"
}

resource "aws_instance" "api" {
  ami           = var.ami_id
  instance_type = "t3.small"
  subnet_id     = data.tfe_outputs.network.values.private_subnet_ids[0]
}

# The alternative reads the ENTIRE state, including any secrets
# in it. Use only where that access is acceptable.
# data "terraform_remote_state" "network" {
#   backend = "remote"
#   config = {
#     organization = "acme-corp"
#     workspaces = { name = "network-production" }
#   }
# }`,
    },
    {
      title: 'A monorepo across several workspaces',
      language: 'bash',
      explanation:
        'The working directory and VCS trigger patterns are what stop every workspace running on every commit.',
      code: `# Repository layout
infrastructure/
├── network/          -> workspace network-production
│   └── main.tf          working directory: network/
├── database/         -> workspace database-production
│   └── main.tf          working directory: database/
└── applications/
    ├── api/          -> workspace api-production
    └── web/          -> workspace web-production

# Each workspace sets:
#   Working directory:        applications/api
#   VCS branch:               main
#   Trigger patterns:         applications/api/**
#                             modules/shared/**
#
# Without trigger patterns, every commit queues a run in every
# workspace - which is slow, noisy, and trains people to ignore
# run notifications.`,
    },
  ],
  imperative: [
    {
      command: 'terraform workspace list',
      what: 'Lists the HCP workspaces a tag-bound configuration can select.',
    },
    {
      command: 'terraform workspace select network-staging',
      what: 'Switches which HCP workspace subsequent commands operate on.',
      namespaceNote: 'Check with `terraform workspace show` before anything destructive.',
    },
    {
      command: 'terraform workspace show',
      what: 'The currently selected workspace.',
    },
    {
      command: 'terraform state pull > backup.json',
      what: 'Downloads the selected workspace’s state.',
    },
    {
      command: 'terraform output -json',
      what: 'The outputs another workspace could consume via `tfe_outputs`.',
    },
  ],
  declarative: {
    steps: [
      'Default to one workspace per component per environment.',
      'Adopt a naming convention and never deviate - it is your only navigation at scale.',
      'Group by ownership into projects, and grant permissions at project level.',
      'Use variable sets for anything shared, rather than repeating variables per workspace.',
      'Use trigger patterns so a monorepo commit only runs the affected workspaces.',
      'Prefer `tfe_outputs` over `terraform_remote_state` when only outputs are needed.',
    ],
    code: [
      {
        title: 'Variable precedence on HCP',
        language: 'bash',
        explanation:
          'Highest wins, as with the CLI. The point is that a workspace can always override a shared set when it genuinely needs to.',
        code: `# Lowest to highest precedence:

# 1. A default in the variable block, in the configuration.
# 2. A GLOBAL variable set (applied to the whole organisation).
# 3. A PROJECT-scoped variable set.
# 4. A WORKSPACE-scoped variable set.
# 5. A variable set directly ON the workspace.
# 6. A -var on the command line (local execution only).

# So a shared "aws-production" set can supply the region for
# twenty workspaces, and one workspace that needs a different
# region overrides it locally - without changing the set.

# Two kinds, and the distinction matters:
#   Terraform variable  -> equivalent to -var
#   Environment variable -> equivalent to exporting it
# Provider credentials are almost always the second kind.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform workspace show',
      what: 'Confirms which workspace you are about to affect.',
    },
    {
      command: 'terraform plan',
      what: 'The run header names the workspace and where it executed.',
    },
    {
      command: "terraform output -json | jq 'keys'",
      what: 'Confirms which outputs another workspace can consume.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform workspace list',
      what: 'Empty or unexpected - the `tags` in the cloud block do not match any workspace.',
    },
    {
      command: 'terraform init -reconfigure',
      what: 'Re-selects workspaces after changing the tags or project in the cloud block.',
    },
    {
      command: 'terraform plan',
      what: 'Reports a missing variable - it is set on a different workspace, or the variable set is not applied here.',
    },
    {
      command: 'terraform plan',
      what: 'Reports the wrong working directory - check the workspace setting for a monorepo.',
    },
  ],
  commonMistakes: [
    'One workspace for an entire estate. Slow plans and an unnecessary blast radius.',
    'No naming convention, leaving fifty workspaces that nobody can navigate.',
    'Repeating the same credentials in every workspace instead of using a variable set.',
    'Omitting VCS trigger patterns in a monorepo, so every commit queues a run everywhere.',
    'Using `terraform_remote_state` when `tfe_outputs` would expose far less.',
    'Confusing a project with an organisation. A workspace belongs to one project; a project belongs to one organisation.',
    'Setting a provider credential as a Terraform variable rather than an environment variable.',
  ],
  examTips: [
    'An HCP workspace holds one state plus its own variables, credentials, history and permissions.',
    'A project groups workspaces and is typically where team permissions are granted.',
    'A `cloud` block binds by `name` (one workspace) or by `tags` (several, selected with `terraform workspace select`).',
    'Variable sets apply variables to a project, to listed workspaces, or globally.',
    'Workspace-level variables override variable sets.',
    'Run triggers chain one workspace’s run after another’s success.',
    '`tfe_outputs` exposes only declared outputs; `terraform_remote_state` exposes the whole state.',
  ],
  summary: [
    'One workspace per component per environment is the default that works.',
    'Projects group workspaces and carry permissions.',
    'Variable sets remove the repetition that fine-grained workspaces create.',
    'Trigger patterns keep a monorepo from running everything on every commit.',
    'Prefer `tfe_outputs` for cross-workspace values.',
  ],
  practice: [
    {
      id: 'tf-hcpws-p1',
      level: 'beginner',
      prompt: 'What does a project group, and why would you use one?',
      answer:
        'It groups workspaces. You use one so team permissions can be granted at project level rather than workspace by workspace, and so tag-based selection can be scoped.',
      explanation: 'A workspace belongs to exactly one project.',
    },
    {
      id: 'tf-hcpws-p2',
      level: 'beginner',
      prompt: 'How does one configuration serve several HCP workspaces?',
      answer:
        'By binding with `tags` rather than `name` in the `cloud` block, then selecting with `terraform workspace select`.',
      explanation: 'Optionally scope the tags to a project so the selection list stays small.',
    },
    {
      id: 'tf-hcpws-p3',
      level: 'intermediate',
      prompt: 'Twenty workspaces need the same AWS credentials. What is the right mechanism?',
      answer:
        'A variable set containing the credential environment variables, applied to the relevant projects or workspaces. Any workspace needing something different overrides it locally.',
      explanation:
        'Better still, use dynamic credentials in the variable set, so there is no stored secret to rotate across twenty workspaces.',
    },
    {
      id: 'tf-hcpws-p4',
      level: 'advanced',
      prompt:
        'Why prefer `tfe_outputs` over `terraform_remote_state` for reading another workspace’s values?',
      answer:
        'Because `tfe_outputs` exposes only that workspace’s declared outputs, while `terraform_remote_state` reads the entire state file - including every secret in it. The narrower data source is the least-privilege choice.',
      explanation:
        'It also makes the producing workspace’s outputs a genuine interface: the consumer can only depend on what was deliberately published.',
    },
  ],
  lab: {
    title: 'Design a workspace layout',
    scenario:
      'A design exercise plus a local proof of tag-based selection. No HCP account is required for the design half.',
    prerequisites: ['Terraform 1.5 or newer', 'An HCP Terraform free account is optional'],
    tasks: [
      {
        instruction:
          'Write down an estate: a VPC, an RDS database, two applications, DNS and monitoring, across staging and production.',
      },
      {
        instruction:
          'Design a workspace layout for it. Name every workspace, and assign each to a project.',
      },
      {
        instruction:
          'Decide which teams get write access to which projects, and note where read-only access is needed.',
      },
      {
        instruction:
          'List the variables each workspace needs, and identify which belong in a variable set instead.',
      },
      {
        instruction:
          'Identify which workspaces need values from another, and choose `tfe_outputs` or `terraform_remote_state` for each with a reason.',
      },
      {
        instruction:
          'Identify where a run trigger is warranted, and where the dependency is better expressed as an input variable.',
      },
      {
        instruction:
          'If you have an account: create two workspaces sharing a tag, use a tag-bound `cloud` block, and switch between them.',
      },
      {
        instruction:
          'If you have an account: create a variable set, apply it to both workspaces, then override one variable on one workspace and confirm which value wins.',
      },
    ],
    solution: [
      {
        title: 'A worked layout',
        language: 'bash',
        code: `Organisation: acme-corp

Project "Platform"                     team platform: write
                                       team apps:     read
  network-staging          VPC, subnets, security groups
  network-production
  dns-staging              Route 53 records
  dns-production
  monitoring-staging       dashboards, alerts
  monitoring-production

Project "Data"                         team data:     write
                                       team apps:     read
  database-staging         RDS
  database-production

Project "Applications"                 team apps:     write
  api-staging
  api-production
  web-staging
  web-production

Variable sets
  "aws-staging"     -> Platform, Data, Applications (staging workspaces)
      TFC_AWS_PROVIDER_AUTH = true            (env)
      TFC_AWS_RUN_ROLE_ARN  = arn:...staging  (env)
      region                = "eu-west-1"     (terraform)
  "aws-production"  -> the production workspaces
      ... the production role ...
  "common-tags"     -> global
      cost_centre = "CC-1042"                 (terraform)

Cross-workspace reads
  api-* needs subnet ids from network-*      -> tfe_outputs
      only outputs are needed, so use the narrower source
  api-* needs the database endpoint          -> tfe_outputs
      the PASSWORD must NOT come this way - it would be in
      state; put it in a secrets manager and read it there

Run triggers
  network-production -> api-production, web-production
      justified: an application run should follow a network change
  database-production -> api-production
      NOT a trigger: the endpoint rarely changes, and a
      spurious API run on every database tag edit is noise.
      Express it as a tfe_outputs read instead.`,
      },
      {
        title: 'Tag-bound selection, if you have an account',
        language: 'hcl',
        code: `terraform {
  cloud {
    organization = "your-org"

    workspaces {
      tags = ["hcp-lab"]
    }
  }
}

variable "greeting" {
  type    = string
  default = "from the configuration default"
}

output "resolved" {
  value = "\${terraform.workspace}: \${var.greeting}"
}

# Create two workspaces tagged hcp-lab, then:
#   terraform init
#   terraform workspace list
#   terraform workspace select hcp-lab-a
#   terraform apply && terraform output resolved
#   terraform workspace select hcp-lab-b
#   terraform apply && terraform output resolved
#
# Then create a variable set setting greeting = "from the set",
# apply it to both, and re-apply: both change.
# Then set greeting = "from the workspace" on hcp-lab-b only.
# The workspace value wins there; the set still applies to A.`,
      },
    ],
    verification: [
      {
        command: 'terraform workspace list',
        what: 'Confirms the tag matched the workspaces you created.',
      },
      {
        command: 'terraform output -raw resolved',
        what: 'Shows which variable value won for the selected workspace.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve 2>/dev/null; rm -rf .terraform .terraform.lock.hcl',
        what: 'Removes local artefacts. Delete any HCP workspaces from the UI.',
      },
    ],
  },
  relatedTopicIds: ['tf-hcp-overview', 'tf-hcp-collaboration-governance', 'tf-state-fundamentals'],
  docs: [
    {
      title: 'Workspaces in HCP Terraform',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs/workspaces',
    },
    {
      title: 'Projects',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs/projects/manage',
    },
  ],
}
