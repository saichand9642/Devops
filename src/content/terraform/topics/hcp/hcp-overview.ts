import type { Topic } from '../../../types'

export const hcpOverview: Topic = {
  id: 'tf-hcp-overview',
  title: 'What HCP Terraform is and how to use it',
  domainId: 'tf-hcp',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  order: 1,
  tags: ['hcp terraform', 'cloud block', 'remote runs', 'login', 'objective-8a'],
  oneLiner:
    'The managed platform: remote state, remote runs, and the `cloud` block that connects your CLI to it.',
  explanation: [
    '**HCP Terraform** (previously Terraform Cloud) is HashiCorp’s managed service. Its core offering is a place to keep state and a place to *run* Terraform, rather than running it on laptops and CI runners.',
    'The unit of work is a **workspace**: one state, one set of variables, one run history. Note that this is a *different* concept from a CLI workspace, which is just several states under one backend. HCP workspaces have their own variables and credentials.',
    'You connect to it with a `cloud` block in the `terraform` block, which replaces `backend` and is mutually exclusive with it. After `terraform login`, your CLI authenticates with a stored token.',
    'With HCP configured, `terraform plan` and `terraform apply` become **remote runs**: your configuration is uploaded, executed on HashiCorp’s infrastructure, and the output streamed back. Nothing runs on your machine, and credentials live in the workspace rather than on your laptop.',
  ],
  whyItMatters: [
    'Objective 8 is entirely HCP Terraform, and 8a is using it to create infrastructure - which means the `cloud` block and remote runs.',
    'The distinction between an HCP workspace and a CLI workspace is a frequent exam question and a frequent real-world confusion.',
    'Remote runs solve a genuine problem: cloud credentials stop living on developer machines.',
  ],
  howItWorks: [
    'A `cloud` block names an `organization` and selects workspaces either by `name` (one workspace) or by `tags` (several, chosen with `terraform workspace select`).',
    '`terraform login` obtains and stores an API token in `~/.terraform.d/credentials.tfrc.json`. `terraform logout` removes it.',
    '`terraform init` with a `cloud` block configures the remote backend and creates the workspace if it does not exist.',
    'A **remote** run uploads the configuration directory, executes plan or apply in HCP, and streams logs to your terminal. Provider credentials come from workspace variables, not your environment.',
    '**Local** execution mode is also available: HCP stores state and history but the run happens on your machine. Useful when a run needs network access HCP does not have.',
    'Variables are set in the workspace as either **Terraform variables** (equivalent to `-var`) or **environment variables** (equivalent to exporting them), and either can be marked sensitive.',
    'Runs can be triggered from the CLI, from the UI, from the API, or automatically by a VCS connection on a push.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'What happens during a remote run',
      caption:
        'Your configuration goes up; the run happens there. Credentials never leave the workspace, and never reach your laptop.',
      participants: [
        { id: 'cli', label: 'Your CLI' },
        { id: 'hcp', label: 'HCP Terraform' },
        { id: 'cloud', label: 'Cloud API' },
      ],
      messages: [
        { from: 'cli', to: 'hcp', label: 'terraform apply - upload the config' },
        { from: 'hcp', to: 'hcp', label: 'read workspace variables and credentials' },
        { from: 'hcp', to: 'cloud', label: 'plan: refresh and diff' },
        { from: 'hcp', to: 'cli', label: 'stream the plan output', kind: 'return' },
        { from: 'cli', to: 'hcp', label: 'confirm the apply' },
        { from: 'hcp', to: 'cloud', label: 'apply the changes' },
        { from: 'hcp', to: 'cli', label: 'stream results; state stored remotely', kind: 'return' },
      ],
    },
    {
      kind: 'decision',
      title: 'HCP workspace or CLI workspace?',
      caption: 'They share a name and almost nothing else. This is the distinction the exam tests.',
      question: 'Which "workspace" is meant?',
      branches: [
        {
          condition: 'terraform workspace new/select, with a backend',
          result: 'CLI workspace',
          detail: 'Several states under one backend. No separate variables.',
          tone: 'accent',
        },
        {
          condition: 'an HCP workspace with variables and run history',
          result: 'HCP workspace',
          detail: 'Its own state, variables, credentials, permissions and runs',
        },
        {
          condition: 'you need per-environment credentials',
          result: 'HCP workspaces',
          detail: 'CLI workspaces share one credential set',
        },
        {
          condition: 'you need a throwaway variant of one state',
          result: 'CLI workspaces',
          detail: 'Lighter weight; no platform involved',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'cloud block',
      purpose:
        'Connects a configuration to HCP Terraform. Replaces `backend` and is mutually exclusive with it.',
      fields: [
        { path: 'organization', meaning: 'The HCP organisation name. Required.', required: true },
        { path: 'hostname', meaning: 'For Terraform Enterprise. Defaults to app.terraform.io.' },
        {
          path: 'workspaces { name = "..." }',
          meaning: 'Bind to exactly one workspace.',
          required: true,
        },
        {
          path: 'workspaces { tags = [...] }',
          meaning: 'Bind to several, selected with `terraform workspace select`.',
        },
        {
          path: 'workspaces { project = "..." }',
          meaning: 'Scope tag-based selection to one project.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The credentials that were on nine laptops',
    story: [
      'A team of nine ran Terraform locally with long-lived AWS access keys in `~/.aws/credentials`. Each key had broad permissions, because Terraform needed to create most things.',
      'One laptop was stolen. The key was rotated within an hour, but the audit that followed established that nine sets of powerful credentials had been sitting on nine machines with varying disk-encryption settings, and that nobody could say which key had made which change.',
      'Moving to HCP Terraform with remote runs and dynamic provider credentials removed the keys entirely. Developers authenticate to HCP; HCP assumes a role per run; the credentials are short-lived and never touch a laptop.',
      'The run history also answered the audit question, because every apply records who triggered it and what it changed.',
    ],
    code: [
      {
        title: 'What replaced the local credentials',
        language: 'hcl',
        code: `terraform {
  cloud {
    organization = "acme-corp"

    workspaces {
      name = "production-network"
    }
  }
}

# No provider credentials in the configuration, and none on any
# laptop. The workspace holds either:
#   - environment variables AWS_ACCESS_KEY_ID / SECRET (sensitive), or
#   - dynamic credentials: TFC_AWS_PROVIDER_AUTH and
#     TFC_AWS_RUN_ROLE_ARN, which make HCP assume a role per run
#     using OIDC. No stored secret at all.
provider "aws" {
  region = "eu-west-1"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The cloud block, both binding styles',
      language: 'hcl',
      explanation:
        'Name binds to one workspace. Tags bind to a set, which is how one configuration serves several environments on HCP.',
      code: `# One configuration, one workspace.
terraform {
  cloud {
    organization = "acme-corp"

    workspaces {
      name = "production-network"
    }
  }
}

# One configuration, several workspaces selected by tag.
terraform {
  cloud {
    organization = "acme-corp"

    workspaces {
      tags    = ["network"]
      project = "Platform"
    }
  }
}
# Then: terraform workspace list / select staging-network

# Terraform Enterprise - the same thing, self-hosted.
terraform {
  cloud {
    hostname     = "terraform.acme-corp.internal"
    organization = "acme-corp"

    workspaces {
      name = "production-network"
    }
  }
}

# A cloud block and a backend block together is an ERROR.
# terraform {
#   cloud { ... }
#   backend "s3" { ... }
# }`,
    },
    {
      title: 'Getting started, end to end',
      language: 'bash',
      explanation:
        'Note that `terraform apply` behaves the same as ever - the difference is where the work happens and where the credentials live.',
      code: `# 1. Authenticate. Stores a token in
#    ~/.terraform.d/credentials.tfrc.json
terraform login

# 2. Add the cloud block, then initialise. This creates the
#    workspace if it does not exist.
terraform init

# 3. Set variables in the workspace - UI, API or CLI.
#    Terraform variables behave like -var.
#    Environment variables behave like exporting them.
#    Either can be marked sensitive.

# 4. Run. Plan and apply happen REMOTELY; output is streamed.
terraform plan
terraform apply

# 5. Tag-based workspaces are switched the usual way.
terraform workspace list
terraform workspace select staging-network

# State inspection works exactly as before.
terraform state list
terraform output

# And to disconnect:
terraform logout`,
    },
    {
      title: 'Remote versus local execution',
      language: 'bash',
      explanation:
        'Execution mode is a workspace setting, not a configuration one. Local mode still stores state and history in HCP.',
      code: `# REMOTE (the default)
#   - the config is uploaded and executed by HCP
#   - credentials come from workspace variables
#   - the run appears in history, with logs and an audit trail
#   - policies and run tasks are enforced
#   - your machine needs no cloud access at all

# LOCAL
#   - HCP stores state, variables and history
#   - the run executes on YOUR machine
#   - your machine needs the cloud credentials
#   - the right choice when a run must reach something HCP
#     cannot, such as a private network endpoint

# The same commands either way:
terraform plan
terraform apply

# Which mode a workspace uses is visible in its settings, and
# the plan output tells you where it ran.`,
    },
  ],
  imperative: [
    {
      command: 'terraform login',
      what: 'Authenticates the CLI and stores an API token locally.',
      expected: 'Retrieved token for user ...',
    },
    {
      command: 'terraform init',
      what: 'Configures the HCP backend and creates the workspace if needed.',
    },
    {
      command: 'terraform plan',
      what: 'Runs a plan remotely and streams the output.',
    },
    {
      command: 'terraform apply',
      what: 'Runs an apply remotely, after confirmation.',
    },
    {
      command: 'terraform workspace list',
      what: 'Lists the HCP workspaces this configuration can select, when bound by tags.',
    },
    {
      command: 'terraform logout',
      what: 'Removes the stored token.',
    },
    {
      command: 'terraform state pull > backup.json',
      what: 'Downloads state from HCP - the same command as any other backend.',
    },
  ],
  declarative: {
    steps: [
      'Use a `cloud` block instead of a `backend` block; never both.',
      'Bind by `name` for one environment, by `tags` when one configuration serves several.',
      'Keep provider credentials in workspace variables, or use dynamic credentials so there is no stored secret.',
      'Prefer remote execution so credentials never reach a laptop.',
      'Choose local execution only when a run needs network access HCP does not have.',
    ],
    code: [
      {
        title: 'Dynamic credentials: no stored secret at all',
        language: 'bash',
        explanation:
          'HCP exchanges a workload identity token for a short-lived cloud role. There is no access key anywhere to leak or rotate.',
        code: `# Set these as ENVIRONMENT variables on the HCP workspace.
# No access key, no secret key, nothing long-lived.

TFC_AWS_PROVIDER_AUTH = true
TFC_AWS_RUN_ROLE_ARN  = arn:aws:iam::111122223333:role/hcp-terraform

# The AWS role trusts HCP's OIDC issuer and is scoped to this
# organisation, project and workspace, so a token from one
# workspace cannot be used by another.

# Azure and GCP have direct equivalents:
#   TFC_AZURE_PROVIDER_AUTH, TFC_AZURE_RUN_CLIENT_ID
#   TFC_GCP_PROVIDER_AUTH,   TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL

# Nothing changes in the configuration - the provider block
# still just says region.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform init',
      what: 'Succeeding confirms the token, organisation and workspace are all correct.',
    },
    {
      command: 'terraform workspace show',
      what: 'Confirms which HCP workspace is selected.',
    },
    {
      command: 'terraform plan',
      what: 'The output header states where the run executed.',
    },
    {
      command: 'terraform state list',
      what: 'Confirms state is readable from HCP.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform login',
      what: 'Fixes "Required token could not be found" - no stored credentials for that hostname.',
    },
    {
      command: 'terraform init',
      what: 'Reports the organisation was not found - check the name and that your token has access.',
    },
    {
      command: 'terraform init -reconfigure',
      what: 'Re-selects a workspace after changing the `cloud` block.',
    },
    {
      command: 'terraform plan',
      what: 'Fails with a credentials error - the provider variables are missing from the workspace, not from your shell.',
    },
    {
      command: 'cat ~/.terraform.d/credentials.tfrc.json',
      what: 'Confirms which hostnames you hold tokens for.',
    },
  ],
  commonMistakes: [
    'Declaring both a `cloud` block and a `backend` block. They are mutually exclusive.',
    'Confusing an HCP workspace with a CLI workspace. HCP workspaces have their own variables and credentials.',
    'Setting provider credentials in your shell and expecting a remote run to use them. Remote runs read workspace variables.',
    'Committing an API token. `terraform login` stores it outside the repository for a reason.',
    'Expecting `terraform workspace new` to work with a `name`-bound cloud block. Tag binding is what allows selection.',
    'Using long-lived cloud keys as workspace variables when dynamic credentials are available.',
    'Assuming local execution mode means state is local too. HCP still stores it.',
  ],
  examTips: [
    'The `cloud` block replaces `backend` and cannot be used alongside one.',
    'It requires `organization`, plus `workspaces` bound by either `name` or `tags`.',
    '`terraform login` stores a token in `~/.terraform.d/credentials.tfrc.json`.',
    'An HCP workspace has its own state, variables, credentials and run history - unlike a CLI workspace.',
    'Remote execution runs the plan and apply in HCP; local execution runs them on your machine but still stores state remotely.',
    'Workspace variables come in two kinds: Terraform variables and environment variables.',
    'Dynamic provider credentials remove the need for any stored cloud secret.',
  ],
  summary: [
    'HCP Terraform stores state and runs Terraform for you.',
    'The `cloud` block connects a configuration to it and replaces `backend`.',
    'An HCP workspace is state plus variables plus credentials plus history.',
    'Remote runs keep cloud credentials off developer machines entirely.',
    'Dynamic credentials go further: no stored secret at all.',
  ],
  practice: [
    {
      id: 'tf-hcp-p1',
      level: 'beginner',
      prompt:
        'Which block connects a configuration to HCP Terraform, and what can it not be combined with?',
      answer:
        'The `cloud` block, inside the `terraform` block. It cannot be combined with a `backend` block.',
      explanation:
        'They are two ways of answering the same question - where does state live - so only one may be present.',
    },
    {
      id: 'tf-hcp-p2',
      level: 'beginner',
      prompt: 'Where does `terraform login` store its token?',
      answer: 'In `~/.terraform.d/credentials.tfrc.json`.',
      explanation:
        'Keeping it there rather than in the repository is why the token never gets committed by accident.',
    },
    {
      id: 'tf-hcp-p3',
      level: 'intermediate',
      prompt: 'Give three differences between an HCP workspace and a CLI workspace.',
      answer:
        'An HCP workspace has its own variables, its own provider credentials and its own run history and permissions. CLI workspaces are only several states under one backend, sharing one set of variables and credentials.',
      explanation:
        'This is why HCP workspaces suit environment separation and CLI workspaces suit throwaway variants.',
    },
    {
      id: 'tf-hcp-p4',
      level: 'advanced',
      prompt:
        'You export `AWS_ACCESS_KEY_ID` locally and run `terraform apply` against a remote-execution HCP workspace. Does it use your key?',
      answer:
        'No. The run executes in HCP, which reads its credentials from the workspace’s environment variables. Your local environment is not uploaded.',
      explanation:
        'That is the security benefit: credentials live in one audited place rather than on every machine. In local execution mode the opposite is true - your environment is exactly what is used.',
    },
  ],
  lab: {
    title: 'Read the cloud block, and plan the migration',
    scenario:
      'This lab needs no HCP account. You will work out what a migration involves, and prove the mutual exclusion locally.',
    prerequisites: ['Terraform 1.5 or newer', 'An HCP Terraform free account is optional'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `backend "local"` block and one resource, and apply it.',
      },
      {
        instruction:
          'Add a `cloud` block alongside the `backend` block and run `terraform init`. Read the error.',
        hint: 'This proves the mutual exclusion without needing an account.',
      },
      {
        instruction:
          'Remove the `backend` block, leaving only the `cloud` block, and run `init` without logging in. Read that error too.',
      },
      {
        instruction:
          'Write down, as comments in the file, the exact list of workspace variables this configuration would need if it ran remotely.',
      },
      {
        instruction:
          'Write down which of those should be Terraform variables and which should be environment variables, and which are sensitive.',
      },
      {
        instruction:
          'If you have a free HCP account: run `terraform login`, then `init`, and confirm the workspace is created.',
      },
      {
        instruction:
          'If you have an account: set the variables, run a remote plan, and note where the output says the run executed.',
      },
      { instruction: 'Restore the local backend and clean up.' },
    ],
    solution: [
      {
        title: 'The two configurations',
        language: 'hcl',
        code: `# --- Before: local backend
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

variable "greeting" {
  type    = string
  default = "hello"
}

resource "local_file" "note" {
  filename = "\${path.module}/note.txt"
  content  = "\${var.greeting}\\n"
}

# --- After: HCP Terraform
# terraform {
#   required_providers {
#     local = { source = "hashicorp/local", version = "~> 2.5" }
#   }
#
#   cloud {
#     organization = "your-org"
#
#     workspaces {
#       name = "hcp-lab"
#     }
#   }
# }
#
# Workspace variables this configuration would need:
#   Terraform variable   greeting = "hello"       (not sensitive)
#
# For a real cloud provider you would also need, as ENVIRONMENT
# variables:
#   AWS_ACCESS_KEY_ID       (sensitive)   - or, better:
#   AWS_SECRET_ACCESS_KEY   (sensitive)
#   TFC_AWS_PROVIDER_AUTH = true          - dynamic credentials,
#   TFC_AWS_RUN_ROLE_ARN  = arn:...         with no stored secret`,
      },
      {
        title: 'The two errors, without needing an account',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# Both blocks at once:
terraform init
# Error: Duplicate configuration
#   A backend and a cloud configuration block cannot both be
#   declared within the same module.

# cloud block only, not logged in:
terraform init
# Error: Required token could not be found
#   Run "terraform login" to obtain a token, or manually store
#   a token in the CLI configuration file.

# With an account:
terraform login
terraform init
#   Initializing HCP Terraform...
#   Workspace "hcp-lab" created.
terraform plan
#   Running plan in HCP Terraform. Output will stream here.
#   Preparing the remote plan...
# Note the header: it tells you the run executed remotely.

# Restore the local backend:
terraform init -migrate-state`,
      },
    ],
    verification: [
      {
        command: 'grep -c "cloud {" main.tf',
        what: 'Confirms which backend style the configuration is using.',
      },
      {
        command: 'terraform init && terraform state list',
        what: 'Confirms state is reachable, whichever backend is configured.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f note.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the resource, the file and the local state.',
      },
    ],
  },
  relatedTopicIds: [
    'tf-hcp-workspaces-and-projects',
    'tf-hcp-collaboration-governance',
    'tf-remote-backends',
  ],
  docs: [
    {
      title: 'HCP Terraform overview',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs',
    },
    {
      title: 'The cloud block',
      url: 'https://developer.hashicorp.com/terraform/cli/cloud/settings',
    },
  ],
}
