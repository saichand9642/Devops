import type { Topic } from '../../../types'

export const hcpIntegrations: Topic = {
  id: 'tf-hcp-integrations',
  title: 'Configuring HCP Terraform integrations',
  domainId: 'tf-hcp',
  difficulty: 'intermediate',
  estimatedMinutes: 14,
  order: 4,
  tags: ['vcs', 'api', 'agents', 'dynamic credentials', 'notifications', 'objective-8d'],
  oneLiner:
    'Connecting HCP to a VCS provider, to private networks with agents, to clouds without stored secrets, and to your tooling by API.',
  explanation: [
    'The **VCS integration** is the one most teams adopt first. Connect a repository to a workspace and a push becomes a plan, a pull request gets a plan comment, and a merge to the default branch becomes an apply. Terraform then runs from the repository rather than from anyone’s machine.',
    '**Agents** solve the reachability problem. A remote run happens on HashiCorp’s infrastructure, which cannot reach a private network. An agent is a lightweight process you run inside your network that polls HCP for work, so the run executes where it can reach your endpoints - with no inbound firewall rule.',
    '**Dynamic provider credentials** solve the secret problem. Instead of storing cloud keys as workspace variables, HCP presents a workload identity token that the cloud exchanges for a short-lived role. There is no long-lived secret anywhere.',
    'Around those sit the **API** and the `tfe` provider (so HCP itself can be managed as code), **notifications** to Slack, email or a webhook, and **run tasks** for calling third-party services mid-run.',
  ],
  whyItMatters: [
    'Objective 8d is configuring and using HCP Terraform integration, which covers all of these.',
    'The VCS integration changes the workflow more than any other single feature: the repository becomes the trigger, and the run history becomes the audit trail.',
    'Dynamic credentials are the clearest available answer to "how do we stop storing cloud keys", which is a question every team eventually has to answer.',
  ],
  howItWorks: [
    '**VCS.** Connect the provider once at organisation level (GitHub, GitLab, Bitbucket, Azure DevOps), then attach a repository to a workspace with a branch, an optional working directory and trigger patterns. A push to a non-default branch produces a **speculative plan**; a merge to the default branch queues an apply.',
    '**Speculative plans** are plan-only runs that can never apply. That is what makes it safe to plan a pull request from a fork or an untrusted branch.',
    '**Agents.** Install an agent in your network with a token, and set the workspace execution mode to `agent`. The agent polls HCP over an outbound connection, so no inbound access is required.',
    '**Dynamic credentials.** Set the provider auth environment variables on the workspace - `TFC_AWS_PROVIDER_AUTH` and `TFC_AWS_RUN_ROLE_ARN`, or the Azure and GCP equivalents. The cloud role trusts HCP’s OIDC issuer, scoped to your organisation, project and workspace.',
    '**API and the tfe provider.** Everything in the UI is available over a documented REST API, and the `tfe` provider lets you manage organisations, workspaces, variables, teams and policy sets as Terraform code.',
    '**Notifications.** Per-workspace webhooks, Slack, Microsoft Teams or email, filtered by run events - needs attention, errored, completed.',
    '**Run tasks** POST the plan to an external HTTP endpoint mid-run; the response passes or fails the run.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'The VCS-driven workflow',
      caption:
        'The pull request gets a plan comment; the merge triggers the apply. Nobody runs Terraform locally against production.',
      participants: [
        { id: 'dev', label: 'Developer' },
        { id: 'vcs', label: 'GitHub' },
        { id: 'hcp', label: 'HCP Terraform' },
      ],
      messages: [
        { from: 'dev', to: 'vcs', label: 'push a branch, open a PR' },
        { from: 'vcs', to: 'hcp', label: 'webhook: PR opened' },
        { from: 'hcp', to: 'hcp', label: 'speculative plan - cannot apply' },
        { from: 'hcp', to: 'vcs', label: 'post the plan as a PR check', kind: 'return' },
        { from: 'dev', to: 'vcs', label: 'review and merge to main' },
        { from: 'vcs', to: 'hcp', label: 'webhook: push to main' },
        { from: 'hcp', to: 'dev', label: 'apply queued, awaiting approval', kind: 'return' },
      ],
    },
    {
      kind: 'decision',
      title: 'Which integration solves this problem?',
      caption: 'Four different problems, four different mechanisms. They compose freely.',
      question: 'What is standing in your way?',
      branches: [
        {
          condition: 'runs should follow the repository',
          result: 'VCS integration',
          detail: 'Push plans, merge applies, PR comments',
          tone: 'accent',
        },
        {
          condition: 'the run must reach a private network',
          result: 'Agents',
          detail: 'An outbound-polling process inside your network',
        },
        {
          condition: 'you do not want stored cloud keys',
          result: 'Dynamic provider credentials',
          detail: 'OIDC to a short-lived role. No secret at all.',
        },
        {
          condition: 'HCP itself should be managed as code',
          result: 'The tfe provider, or the API',
          detail: 'Workspaces, variables, teams and policy sets',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Integration mechanisms',
      purpose: 'What each connects, and the direction of the connection.',
      fields: [
        {
          path: 'VCS connection',
          meaning: 'Repository to workspace. Push plans; merge applies.',
          required: true,
        },
        { path: 'Trigger patterns', meaning: 'Which paths queue a run. Essential in a monorepo.' },
        {
          path: 'Speculative plan',
          meaning: 'A plan-only run that can never apply. Used for pull requests.',
          required: true,
        },
        {
          path: 'Agent + execution mode "agent"',
          meaning: 'Runs execute inside your network, polling outbound.',
          required: true,
        },
        {
          path: 'TFC_<CLOUD>_PROVIDER_AUTH',
          meaning: 'Enables dynamic credentials for that cloud.',
          required: true,
        },
        { path: 'tfe provider', meaning: 'Manage HCP Terraform itself as Terraform code.' },
        {
          path: 'Notifications',
          meaning: 'Webhook, Slack, Teams or email, filtered by run event.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The private database HCP could not reach',
    story: [
      'A team moved to HCP Terraform with remote runs. Everything worked until they reached the configuration managing PostgreSQL roles inside a private VPC, using the `postgresql` provider.',
      'Every plan failed with a connection timeout. HCP runs on HashiCorp’s infrastructure and had no route to a database with no public endpoint - correctly, since exposing it would have been the wrong fix.',
      'Their first instinct was to switch that workspace to local execution, which worked but put the credentials back on laptops and removed the audit trail for exactly the most sensitive workspace they had.',
      'The right answer was an agent: a small process running on an existing instance inside the VPC, polling HCP outbound for work. The run executes inside the network, reaches the database, and everything else - policy, history, RBAC, dynamic credentials - keeps working. No inbound firewall rule was needed.',
    ],
    code: [
      {
        title: 'Running an agent',
        language: 'bash',
        code: `# On a host INSIDE the private network. Only outbound HTTPS
# to app.terraform.io is required - no inbound rule at all.

export TFC_AGENT_TOKEN="<agent pool token>"
export TFC_AGENT_NAME="vpc-agent-01"

./tfc-agent

# Then set the workspace execution mode to "agent" and choose
# this agent pool. Runs for that workspace now execute here.

# In production, run it as a service, and use at least two
# agents so a single host is not a dependency.`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Managing HCP with the tfe provider',
      language: 'hcl',
      explanation:
        'The point of managing HCP as code is the same as for any infrastructure: reviewable changes and no click-ops drift in the platform that governs everything else.',
      code: `terraform {
  required_providers {
    tfe = { source = "hashicorp/tfe", version = "~> 0.60" }
  }
}

provider "tfe" {
  # Token from the TFE_TOKEN environment variable.
}

resource "tfe_project" "platform" {
  organization = "acme-corp"
  name         = "Platform"
}

resource "tfe_workspace" "network" {
  for_each = toset(["staging", "production"])

  organization      = "acme-corp"
  project_id        = tfe_project.platform.id
  name              = "network-\${each.key}"
  working_directory = "network"
  terraform_version = "~> 1.16.0"
  tag_names         = ["network", each.key]

  vcs_repo {
    identifier     = "acme-corp/infrastructure"
    branch         = each.key == "production" ? "main" : "develop"
    oauth_token_id = var.vcs_oauth_token_id
  }

  # Only run when the relevant paths change.
  trigger_patterns = ["network/**", "modules/shared/**"]

  # Production requires a human to approve every apply.
  auto_apply = each.key != "production"
}

# Dynamic credentials, shared by both workspaces.
resource "tfe_variable_set" "aws" {
  organization = "acme-corp"
  name         = "aws-dynamic-credentials"
  description  = "OIDC role assumption. No stored secret."
}

resource "tfe_variable" "provider_auth" {
  variable_set_id = tfe_variable_set.aws.id
  key             = "TFC_AWS_PROVIDER_AUTH"
  value           = "true"
  category        = "env"
}

resource "tfe_variable" "run_role" {
  variable_set_id = tfe_variable_set.aws.id
  key             = "TFC_AWS_RUN_ROLE_ARN"
  value           = var.terraform_role_arn
  category        = "env"
}

resource "tfe_project_variable_set" "aws" {
  variable_set_id = tfe_variable_set.aws.id
  project_id      = tfe_project.platform.id
}

resource "tfe_notification_configuration" "slack" {
  name             = "platform-alerts"
  workspace_id     = tfe_workspace.network["production"].id
  destination_type = "slack"
  url              = var.slack_webhook_url
  enabled          = true
  triggers         = ["run:needs_attention", "run:errored"]
}`,
    },
    {
      title: 'Dynamic credentials, per cloud',
      language: 'bash',
      explanation:
        'The trust policy scoping is the important part: a token from one workspace cannot be used by another.',
      code: `# --- AWS: set as ENVIRONMENT variables on the workspace
TFC_AWS_PROVIDER_AUTH = true
TFC_AWS_RUN_ROLE_ARN  = arn:aws:iam::111122223333:role/hcp-terraform

# The IAM role's trust policy trusts HCP's OIDC issuer, and is
# scoped by subject so only this workspace can assume it:
#   "Federated": "arn:aws:iam::111122223333:oidc-provider/app.terraform.io"
#   "app.terraform.io:sub":
#     "organization:acme-corp:project:Platform:workspace:network-production:run_phase:*"

# --- Azure
TFC_AZURE_PROVIDER_AUTH = true
TFC_AZURE_RUN_CLIENT_ID = <client id of a federated app registration>

# --- GCP
TFC_GCP_PROVIDER_AUTH               = true
TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL   = terraform@project.iam.gserviceaccount.com
TFC_GCP_WORKLOAD_PROVIDER_NAME      = projects/123/locations/global/workloadIdentityPools/hcp/providers/hcp

# --- Vault
TFC_VAULT_PROVIDER_AUTH = true
TFC_VAULT_ADDR          = https://vault.acme-corp.internal
TFC_VAULT_RUN_ROLE      = terraform

# Nothing changes in the configuration itself:
# provider "aws" { region = "eu-west-1" }`,
    },
    {
      title: 'Using the API',
      language: 'bash',
      explanation:
        'Everything the UI does is available over the API, which is how bespoke tooling and reporting is built.',
      code: `TOKEN="$(jq -r '.credentials["app.terraform.io"].token' \\
  ~/.terraform.d/credentials.tfrc.json)"
ORG="acme-corp"
API="https://app.terraform.io/api/v2"

auth=(-H "Authorization: Bearer $TOKEN"
      -H "Content-Type: application/vnd.api+json")

# List workspaces.
curl -s "\${auth[@]}" "$API/organizations/$ORG/workspaces" \\
  | jq -r '.data[] | "\\(.attributes.name)\\t\\(.attributes["terraform-version"])"'

# The most recent runs for one workspace.
WS_ID="$(curl -s "\${auth[@]}" \\
  "$API/organizations/$ORG/workspaces/network-production" | jq -r .data.id)"

curl -s "\${auth[@]}" "$API/workspaces/$WS_ID/runs?page%5Bsize%5D=5" \\
  | jq -r '.data[] | "\\(.attributes["created-at"])\\t\\(.attributes.status)"'

# Queue a plan-only run.
curl -s "\${auth[@]}" -X POST "$API/runs" -d '{
  "data": {
    "attributes": { "plan-only": true, "message": "checking a change" },
    "type": "runs",
    "relationships": {
      "workspace": { "data": { "type": "workspaces", "id": "'"$WS_ID"'" } }
    }
  }
}' | jq -r '.data.id'`,
    },
  ],
  imperative: [
    {
      command: 'terraform login',
      what: 'Obtains the token every integration and API call needs.',
    },
    {
      command:
        'export TFE_TOKEN=$(jq -r \'.credentials["app.terraform.io"].token\' ~/.terraform.d/credentials.tfrc.json)',
      what: 'Reuses the CLI token for the `tfe` provider and for API calls.',
    },
    {
      command: './tfc-agent',
      what: 'Starts an agent inside your network, using TFC_AGENT_TOKEN.',
    },
    {
      command: 'terraform plan',
      what: 'With a VCS-connected workspace, this is usually replaced by a push - the run header tells you which triggered it.',
    },
    {
      command:
        'curl -H "Authorization: Bearer $TFE_TOKEN" https://app.terraform.io/api/v2/organizations/$ORG/workspaces',
      what: 'The API equivalent of listing workspaces.',
    },
  ],
  declarative: {
    steps: [
      'Connect VCS at organisation level once, then attach repositories per workspace.',
      'Always set trigger patterns in a monorepo, or every commit runs everything.',
      'Use dynamic credentials rather than stored cloud keys wherever the provider supports it.',
      'Use agents when a run must reach a private network - never local execution as a workaround.',
      'Manage HCP itself with the `tfe` provider so platform changes are reviewed like any other.',
      'Keep `auto_apply` off for production; require a human approval.',
    ],
    code: [
      {
        title: 'A safe VCS workflow',
        language: 'bash',
        explanation:
          'The two important properties: pull-request plans cannot apply, and production applies require a person.',
        code: `# Workspace: network-production
#   VCS repository:     acme-corp/infrastructure
#   Branch:             main
#   Working directory:  network/
#   Trigger patterns:   network/**, modules/shared/**
#   Auto apply:         OFF   <- a human approves every apply
#   Speculative plans:  ON    <- PR plans, which cannot apply

# Workspace: network-staging
#   Branch:             develop
#   Auto apply:         ON    <- staging can move without a gate

# The resulting flow:
#   1. Push a branch touching network/  -> speculative plan on the PR
#   2. Review the plan in the PR         -> nothing can be applied yet
#   3. Merge to develop                  -> staging applies automatically
#   4. Merge to main                     -> production plan queued,
#                                            awaiting approval
#   5. Approve in the UI                 -> production applies,
#                                            recorded against your user

# Nobody ran Terraform locally against production at any point.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan',
      what: 'The run header states whether it was triggered by the CLI, a VCS push, or the API.',
    },
    {
      command:
        'curl -H "Authorization: Bearer $TFE_TOKEN" "$API/workspaces/$WS_ID" | jq .data.attributes',
      what: 'Confirms a workspace’s execution mode, VCS connection and auto-apply setting.',
    },
    {
      command: 'terraform apply',
      what: 'With dynamic credentials working, the run succeeds with no cloud key stored anywhere.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Times out reaching a private endpoint - the workspace needs an agent, not local execution.',
    },
    {
      command: 'terraform plan',
      what: 'Reports a credentials error with dynamic credentials - the cloud role’s trust policy subject does not match this workspace.',
    },
    {
      command: 'terraform plan',
      what: 'No run is triggered by a push - the trigger patterns do not match the changed paths, or the branch is wrong.',
    },
    {
      command:
        'curl -H "Authorization: Bearer $TFE_TOKEN" "$API/workspaces/$WS_ID/runs" | jq \'.data[0].attributes\'',
      what: 'Shows why the most recent run is in the state it is in.',
    },
  ],
  commonMistakes: [
    'Omitting trigger patterns in a monorepo, so every commit queues a run in every workspace.',
    'Switching to local execution to reach a private network. That puts credentials back on laptops; use an agent.',
    'Enabling `auto_apply` on production. The approval gate is the point of the workflow.',
    'Storing long-lived cloud keys as workspace variables when dynamic credentials are available.',
    'Scoping a dynamic-credential trust policy too broadly, so any workspace in the organisation can assume the role.',
    'Committing an HCP API token. Read it from the credentials file or an environment variable.',
    'Exposing a private endpoint publicly so HCP can reach it, rather than running an agent.',
  ],
  examTips: [
    'A VCS connection makes a push produce a plan and a merge to the default branch produce an apply.',
    'A speculative plan is plan-only and can never apply - that is what makes PR plans safe.',
    'Trigger patterns control which paths queue a run.',
    'Agents run inside your network and poll HCP outbound, so no inbound access is needed. Set the workspace execution mode to `agent`.',
    'Dynamic provider credentials use `TFC_<CLOUD>_PROVIDER_AUTH` plus a role identifier, and store no secret.',
    'The `tfe` provider manages HCP Terraform itself as code.',
    'Everything in the UI is available over the documented REST API.',
  ],
  summary: [
    'VCS integration makes the repository the trigger and the run history the audit trail.',
    'Speculative plans let a pull request be planned without any risk of applying.',
    'Agents let a run reach a private network without inbound access or local execution.',
    'Dynamic credentials remove stored cloud secrets entirely.',
    'The `tfe` provider and the API let HCP itself be managed as code.',
  ],
  practice: [
    {
      id: 'tf-hcpint-p1',
      level: 'beginner',
      prompt: 'What is a speculative plan, and why does it matter for pull requests?',
      answer:
        'A plan-only run that can never be applied. It matters because a pull request - possibly from an untrusted branch or fork - can be planned and reviewed with no possibility of it changing anything.',
      explanation:
        'That is what makes it safe to post a plan as a PR check on a contribution you have not yet read.',
    },
    {
      id: 'tf-hcpint-p2',
      level: 'beginner',
      prompt: 'Why does an agent need no inbound firewall rule?',
      answer:
        'Because the agent polls HCP outbound over HTTPS for work. HCP never connects in to your network.',
      explanation:
        'That is the property that makes agents acceptable in environments where inbound access would not be.',
    },
    {
      id: 'tf-hcpint-p3',
      level: 'intermediate',
      prompt:
        'A remote run cannot reach a private database endpoint. What are your two options, and which is better?',
      answer:
        'Switch the workspace to local execution, or use an agent inside the network. The agent is better: local execution puts cloud credentials back on developer machines and loses the audit trail, while the agent keeps every HCP feature and only changes where the run executes.',
      explanation: 'The wrong third option is exposing the endpoint publicly so HCP can reach it.',
    },
    {
      id: 'tf-hcpint-p4',
      level: 'advanced',
      prompt:
        'How do dynamic provider credentials remove the need for a stored secret, and what must be configured on the cloud side?',
      answer:
        'HCP presents a signed workload identity token for the run, and the cloud exchanges it for short-lived credentials. On the cloud side you configure HCP’s OIDC issuer as an identity provider and a role whose trust policy accepts that issuer, scoped by subject to a specific organisation, project and workspace.',
      explanation:
        'The subject scoping is essential: without it, any workspace in the organisation could assume the role, which would defeat the workspace isolation you set up in the first place.',
    },
  ],
  lab: {
    title: 'Design an integration, and write the platform as code',
    scenario:
      'Write a `tfe` provider configuration describing a real HCP setup. It validates locally without an account, so you can practise the whole design.',
    prerequisites: ['Terraform 1.5 or newer', 'jq', 'An HCP Terraform free account is optional'],
    tasks: [
      {
        instruction:
          'Write a configuration using the `tfe` provider that declares a project and two workspaces, staging and production, from one monorepo directory.',
      },
      {
        instruction:
          'Give each workspace a VCS repository, the correct branch, a working directory and trigger patterns.',
      },
      {
        instruction:
          'Set `auto_apply` true for staging and false for production, and write a comment explaining why.',
      },
      {
        instruction:
          'Add a variable set carrying dynamic credential environment variables, and attach it to the project.',
      },
      {
        instruction:
          'Add a Slack notification on the production workspace for the errored and needs-attention events only.',
      },
      {
        instruction:
          'Run `terraform init` and `terraform validate` to confirm the configuration is correct.',
      },
      {
        instruction:
          'Write down, as comments, the cloud-side trust policy subject that would scope the role to the production workspace only.',
      },
      {
        instruction:
          'Decide whether this estate needs an agent, and justify the answer in a comment.',
      },
      {
        instruction:
          'If you have an account: set TFE_TOKEN and run a plan to see what would be created. Do not apply unless you intend to.',
      },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    tfe = { source = "hashicorp/tfe", version = "~> 0.60" }
  }
}

provider "tfe" {
  # TFE_TOKEN from the environment.
}

variable "organization" {
  type    = string
  default = "acme-corp"
}

variable "vcs_oauth_token_id" {
  type    = string
  default = "ot-placeholder"
}

variable "terraform_role_arn" {
  type    = string
  default = "arn:aws:iam::111122223333:role/hcp-terraform"
}

variable "slack_webhook_url" {
  type      = string
  default   = "https://hooks.slack.com/services/PLACEHOLDER"
  sensitive = true
}

resource "tfe_project" "platform" {
  organization = var.organization
  name         = "Platform"
}

locals {
  environments = {
    staging = {
      branch = "develop"
      # Staging can move without a gate: fast feedback matters
      # more than approval, and the blast radius is contained.
      auto_apply = true
    }
    production = {
      branch = "main"
      # Production requires a human. The approval gate IS the
      # workflow - auto-applying here would remove the only
      # place a person looks at the plan.
      auto_apply = false
    }
  }
}

resource "tfe_workspace" "network" {
  for_each = local.environments

  organization      = var.organization
  project_id        = tfe_project.platform.id
  name              = "network-\${each.key}"
  working_directory = "network"
  terraform_version = "~> 1.16.0"
  tag_names         = ["network", each.key]
  auto_apply        = each.value.auto_apply

  vcs_repo {
    identifier     = "acme-corp/infrastructure"
    branch         = each.value.branch
    oauth_token_id = var.vcs_oauth_token_id
  }

  # Without these, every commit anywhere in the monorepo queues
  # a run in this workspace.
  trigger_patterns = ["network/**", "modules/shared/**"]
}

# Dynamic credentials: no stored cloud secret anywhere.
resource "tfe_variable_set" "aws" {
  organization = var.organization
  name         = "aws-dynamic-credentials"
  description  = "OIDC role assumption. No long-lived keys."
}

resource "tfe_variable" "auth" {
  variable_set_id = tfe_variable_set.aws.id
  key             = "TFC_AWS_PROVIDER_AUTH"
  value           = "true"
  category        = "env"
}

resource "tfe_variable" "role" {
  variable_set_id = tfe_variable_set.aws.id
  key             = "TFC_AWS_RUN_ROLE_ARN"
  value           = var.terraform_role_arn
  category        = "env"
}

resource "tfe_project_variable_set" "aws" {
  variable_set_id = tfe_variable_set.aws.id
  project_id      = tfe_project.platform.id
}

resource "tfe_notification_configuration" "slack" {
  name             = "network-production-alerts"
  workspace_id     = tfe_workspace.network["production"].id
  destination_type = "slack"
  url              = var.slack_webhook_url
  enabled          = true

  # Only the events a human must act on. Notifying on every
  # completed run trains people to ignore the channel.
  triggers = ["run:needs_attention", "run:errored"]
}

# --- The cloud-side trust policy subject, scoped to production
# only. Without the subject condition, ANY workspace in the
# organisation could assume this role.
#
# "app.terraform.io:sub":
#   "organization:acme-corp:project:Platform:workspace:network-production:run_phase:*"
#
# --- Does this estate need an agent?
# Not for the network workspace: it manages VPCs and subnets
# through the public AWS API, which HCP can reach. An agent
# would be required for a workspace using the postgresql or
# kubernetes provider against a private endpoint, because a
# remote run has no route into the VPC.`,
      },
      {
        title: 'Validating it',
        language: 'bash',
        code: `terraform init
terraform validate      # Success - the configuration is correct

# With an account, and only if you mean it:
export TFE_TOKEN="$(jq -r '.credentials["app.terraform.io"].token' \\
  ~/.terraform.d/credentials.tfrc.json)"
terraform plan          # shows what would be created in HCP
# terraform apply       # only if you actually want these workspaces

# Reading the API directly, for comparison:
ORG=acme-corp
curl -s -H "Authorization: Bearer $TFE_TOKEN" \\
  "https://app.terraform.io/api/v2/organizations/$ORG/workspaces" \\
  | jq -r '.data[] | "\\(.attributes.name)\\tauto-apply=\\(.attributes["auto-apply"])"'`,
      },
    ],
    verification: [
      {
        command: 'terraform validate',
        what: 'Confirms the tfe configuration is structurally correct.',
        expected: 'Success! The configuration is valid.',
      },
      {
        command: 'grep -c "trigger_patterns" main.tf',
        what: 'Confirms trigger patterns were not forgotten.',
        expected: '1',
      },
    ],
    cleanup: [
      {
        command: 'rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes local artefacts. Delete any HCP resources you actually created.',
      },
    ],
  },
  relatedTopicIds: [
    'tf-hcp-overview',
    'tf-hcp-collaboration-governance',
    'tf-sensitive-data-and-vault',
  ],
  docs: [
    {
      title: 'VCS integration',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs/vcs',
    },
    {
      title: 'Dynamic provider credentials',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials',
    },
  ],
}
