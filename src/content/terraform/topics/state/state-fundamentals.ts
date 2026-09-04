import type { Topic } from '../../../types'

export const stateFundamentals: Topic = {
  id: 'tf-state-fundamentals',
  title: 'State internals and the backend concept',
  domainId: 'tf-state',
  difficulty: 'intermediate',
  estimatedMinutes: 14,
  order: 1,
  tags: ['state', 'backend', 'serial', 'lineage', 'workspace'],
  oneLiner:
    'What a backend is, what the state file contains, and how workspaces give one configuration several states.',
  explanation: [
    'A **backend** determines where state is stored and whether operations are locked. There are two families: the default `local` backend (a file on disk) and remote backends (S3, Azure Storage, GCS, Consul, HTTP, and HCP Terraform via the `cloud` block).',
    'Every configuration has exactly one backend. It is declared in the `terraform` block, cannot use variables, and is initialised before anything else runs.',
    'The state file carries bookkeeping as well as resources: `serial` increments on every write and is how a backend detects a stale update; `lineage` is a UUID identifying this state’s history, which prevents two unrelated states being mistaken for one another.',
    '**Workspaces** let one configuration have several independent states. Each workspace is a separate state under the same backend, selected with `terraform workspace select`, and readable in configuration as `terraform.workspace`.',
  ],
  whyItMatters: [
    'Objective 6 is state management, and this lesson is the vocabulary the rest of the domain uses.',
    'Understanding `serial` and `lineage` turns two alarming error messages into ordinary diagnostics.',
    'Workspaces are widely misused for environments; knowing what they actually are helps you decide when they fit.',
  ],
  howItWorks: [
    'The `backend` block names a backend type and its settings. At most one per configuration, and it accepts literals only - hence `-backend-config` for anything that varies.',
    'The `cloud` block is the HCP Terraform equivalent and is mutually exclusive with `backend`.',
    'On every write, Terraform increments `serial`. A backend that supports it rejects a write whose `serial` is not what it expects, which is how concurrent writes are caught even without locking.',
    '`lineage` is generated when state is first created. Terraform refuses to overwrite state with a different lineage, which stops you pushing one project’s state over another’s.',
    'Workspaces: `default` always exists. `terraform workspace new staging` creates another. With the local backend they live in `terraform.tfstate.d/<name>/`; with S3 they use a `env:/<name>/` key prefix.',
    '`terraform.workspace` is a string available anywhere in the configuration, including inside modules.',
    'Workspaces share one backend, one set of credentials and one configuration. That is exactly why they suit short-lived variants better than production isolation.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'What is inside a state file',
      caption:
        'The first four fields are bookkeeping. Understanding them explains most state error messages.',
      root: {
        label: 'State (JSON, version 4)',
        children: [
          { label: 'version', detail: 'State FORMAT version - currently 4' },
          {
            label: 'terraform_version',
            detail: 'Which CLI last wrote it. Older CLIs then refuse it.',
            tone: 'warning',
          },
          {
            label: 'serial',
            detail: 'Write counter. A stale serial means someone else wrote first.',
            tone: 'accent',
          },
          {
            label: 'lineage',
            detail: 'UUID for this state’s history. Guards against mixing projects.',
            tone: 'accent',
          },
          {
            label: 'resources[]',
            detail: 'The managed resources and data sources',
            children: [
              { label: 'mode', detail: '"managed" or "data"' },
              { label: 'instances[].attributes', detail: 'Every value, in plaintext' },
              {
                label: 'instances[].dependencies',
                detail: 'So destroy order survives config deletion',
              },
            ],
          },
          { label: 'outputs', detail: 'Read by terraform output and remote-state consumers' },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'Are workspaces the right tool here?',
      caption:
        'Workspaces share a backend, credentials and configuration. That is fine for variants and wrong for isolation.',
      question: 'Why do you want several states?',
      branches: [
        {
          condition: 'short-lived variants of the same thing',
          result: 'Workspaces fit well',
          detail: 'A per-developer sandbox, a per-branch preview',
          tone: 'accent',
        },
        {
          condition: 'production must be isolated from staging',
          result: 'Separate directories and backends',
          detail: 'Different credentials, different blast radius',
        },
        {
          condition: 'environments differ structurally',
          result: 'Separate configurations',
          detail: 'Conditionals on terraform.workspace get unreadable fast',
        },
        {
          condition: 'you are using HCP Terraform',
          result: 'HCP workspaces - a different concept',
          detail: 'They have their own variables and credentials',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'backend block',
      purpose:
        'Declares where state lives. One per configuration, literals only, initialised first.',
      fields: [
        {
          path: 'backend "local" { path = "..." }',
          meaning: 'A file on disk. The default when no block is present.',
        },
        {
          path: 'backend "s3" { bucket, key, region }',
          meaning: 'The most common remote backend.',
          required: true,
        },
        { path: 'backend "azurerm" / "gcs"', meaning: 'The other major cloud object stores.' },
        {
          path: 'cloud { organization, workspaces }',
          meaning: 'HCP Terraform. Mutually exclusive with backend.',
        },
        {
          path: '(no block at all)',
          meaning: 'Implies the local backend, terraform.tfstate in the working directory.',
        },
      ],
    },
    {
      kind: 'workspace commands',
      purpose: 'Managing several states under one backend.',
      fields: [
        { path: 'terraform workspace list', meaning: 'All workspaces; * marks the current one.' },
        {
          path: 'terraform workspace show',
          meaning: 'Just the current name. Worth running before any destroy.',
        },
        {
          path: 'terraform workspace new <name>',
          meaning: 'Create and select a new, empty workspace.',
        },
        {
          path: 'terraform workspace select <name>',
          meaning: 'Switch. This changes which state you operate on.',
        },
        {
          path: 'terraform workspace delete <name>',
          meaning: 'Remove an EMPTY workspace. Refuses if it has resources.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The lineage error that looked like data loss',
    story: [
      'A team reorganised their repository, moving a configuration into a subdirectory. Someone reused the same S3 key for the new location while the old state still existed at that key from a different project.',
      'The next apply failed with a lineage mismatch. The message mentioned two UUIDs and read like a corruption error, and the team’s first instinct was to delete the state and start again.',
      'It was in fact Terraform preventing exactly the damage they were about to do. Two unrelated states had been pointed at the same key, and overwriting would have orphaned one project’s entire infrastructure.',
      'The fix was a different `key` for the new configuration. `lineage` exists precisely for this, and a lineage mismatch is almost always a misconfigured backend rather than corruption.',
    ],
    code: [
      {
        title: 'One key per configuration',
        language: 'hcl',
        code: `# Each configuration gets its own key. Never share one.
terraform {
  backend "s3" {
    bucket = "acme-tfstate"
    # The key identifies THIS configuration and nothing else.
    key    = "production/network/terraform.tfstate"
    region = "eu-west-1"
    encrypt = true
  }
}

# Another configuration in the same bucket:
#   key = "production/database/terraform.tfstate"
#   key = "staging/network/terraform.tfstate"`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The backend options',
      language: 'hcl',
      explanation:
        'Note `use_lockfile` on the S3 backend: since Terraform 1.10 it provides locking without a DynamoDB table.',
      code: `# No backend block at all: local state in ./terraform.tfstate
# (This is the default.)

# Explicit local, with a custom path.
terraform {
  backend "local" {
    path = "state/terraform.tfstate"
  }
}

# S3 - the most common remote backend.
terraform {
  backend "s3" {
    bucket       = "acme-tfstate"
    key          = "production/network/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true   # locking without DynamoDB (1.10+)
  }
}

# Azure Storage.
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "acmetfstate"
    container_name       = "tfstate"
    key                  = "production/network.tfstate"
  }
}

# Google Cloud Storage.
terraform {
  backend "gcs" {
    bucket = "acme-tfstate"
    prefix = "production/network"
  }
}

# HCP Terraform. Mutually exclusive with any backend block.
terraform {
  cloud {
    organization = "acme-corp"

    workspaces {
      name = "production-network"
    }
  }
}`,
    },
    {
      title: 'Using workspaces',
      language: 'hcl',
      explanation:
        'Referencing `terraform.workspace` is fine for naming and sizing. Once you need structural differences, separate configurations are clearer.',
      code: `locals {
  # Reasonable use: naming and sizing per workspace.
  name_prefix = "acme-\${terraform.workspace}"

  instance_count = {
    default = 1
    staging = 2
    sandbox = 1
  }[terraform.workspace]
}

resource "aws_s3_bucket" "data" {
  bucket = "\${local.name_prefix}-data"

  tags = {
    Workspace = terraform.workspace
  }
}

# Unreasonable use: structural differences. When you find
# yourself writing this, separate configurations are clearer.
# resource "aws_cloudfront_distribution" "cdn" {
#   count = terraform.workspace == "production" ? 1 : 0
#   ...
# }`,
    },
  ],
  imperative: [
    {
      command: 'terraform workspace show',
      what: 'The current workspace. Run this before any destroy.',
      expected: 'default',
    },
    {
      command: 'terraform workspace list',
      what: 'All workspaces, with * marking the current one.',
    },
    {
      command: 'terraform workspace new sandbox',
      what: 'Creates and selects a new workspace with empty state.',
    },
    {
      command: 'terraform workspace select default',
      what: 'Switches which state subsequent commands operate on.',
      namespaceNote:
        'This is the state equivalent of switching kubectl contexts. Check before you act.',
    },
    {
      command: "terraform state pull | jq '{serial, lineage, terraform_version}'",
      what: 'Reads the bookkeeping fields from whichever backend is configured.',
    },
    {
      command: 'terraform state push <file>',
      what: 'Uploads a state file. Refuses on a lineage mismatch or a lower serial unless forced.',
      namespaceNote: 'A recovery tool. Never part of a normal workflow.',
    },
  ],
  declarative: {
    steps: [
      'Give every configuration its own backend key. Never share one.',
      'Use a remote backend with encryption for anything more than a personal experiment.',
      'Use separate directories and backends for environments that need isolation.',
      'Reserve workspaces for short-lived variants of the same configuration.',
      'Run `terraform workspace show` before `destroy`, every time.',
    ],
    code: [
      {
        title: 'Environments as directories, not workspaces',
        language: 'bash',
        explanation:
          'Each directory has its own backend key, its own credentials in CI, and its own blast radius. Workspaces give you none of that.',
        code: `environments/
├── staging/
│   ├── backend.tf        # key = "staging/terraform.tfstate"
│   ├── main.tf
│   └── terraform.tfvars
└── production/
    ├── backend.tf        # key = "production/terraform.tfstate"
    ├── main.tf
    └── terraform.tfvars

# Advantages over workspaces:
#   - separate credentials per environment in CI
#   - a mistake in staging cannot reach production state
#   - the configurations may legitimately differ
#   - "which environment am I in?" is answered by pwd

# Workspaces remain a good fit for:
terraform workspace new dev-alice     # a personal sandbox
terraform workspace new pr-1234       # a per-branch preview`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform workspace show && terraform state list | wc -l',
      what: 'Confirms which state you are looking at and how much is in it.',
    },
    {
      command: 'terraform state pull | jq -r .lineage',
      what: 'The lineage UUID - useful when diagnosing a mismatch.',
    },
    {
      command: 'aws s3 ls s3://acme-tfstate/production/ --recursive',
      what: 'Confirms state is where the backend configuration says it is.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports a lineage mismatch - two different states are pointed at one key. Check the backend `key`.',
    },
    {
      command: 'terraform apply',
      what: 'Reports "state snapshot was created by a newer Terraform" - upgrade the CLI.',
    },
    {
      command: 'terraform workspace show',
      what: 'Explains "plan wants to create everything" - you are in a different workspace than you thought.',
    },
    {
      command: 'terraform state pull | jq .serial',
      what: 'Compares serials when two runs appear to have raced.',
    },
  ],
  commonMistakes: [
    'Sharing one backend `key` between two configurations, which produces a lineage error at best and orphaned infrastructure at worst.',
    'Using workspaces for production isolation. They share a backend, credentials and configuration.',
    'Forgetting which workspace is selected before running `destroy`.',
    'Trying to use variables in the `backend` block. It accepts literals only.',
    'Treating a lineage mismatch as corruption and deleting state. It is a guard, not a fault.',
    'Declaring both a `backend` and a `cloud` block. They are mutually exclusive.',
  ],
  examTips: [
    'A configuration has at most one backend, declared in the `terraform` block, using literal values only.',
    'No backend block means the `local` backend and `terraform.tfstate` in the working directory.',
    '`cloud` and `backend` are mutually exclusive.',
    '`serial` is a write counter; `lineage` is a UUID identifying the state’s history.',
    'Workspaces give one configuration several states under one backend, exposed as `terraform.workspace`.',
    'The `default` workspace always exists and cannot be deleted.',
    'Deleting a workspace with resources in it is refused.',
  ],
  summary: [
    'The backend decides where state lives and whether it locks.',
    '`serial` and `lineage` are the bookkeeping that keeps states from clobbering each other.',
    'Workspaces are several states under one backend, not separate environments.',
    'Environment isolation belongs in separate directories and backend keys.',
    'Always check `terraform workspace show` before anything destructive.',
  ],
  practice: [
    {
      id: 'tf-statefund-p1',
      level: 'beginner',
      prompt: 'What happens if a configuration has no `backend` block?',
      answer:
        'It uses the local backend, storing state in `terraform.tfstate` in the working directory.',
      explanation:
        'That is the default, which is why a first `terraform apply` produces a local state file.',
    },
    {
      id: 'tf-statefund-p2',
      level: 'beginner',
      prompt: 'What are `serial` and `lineage` for?',
      answer:
        '`serial` is a write counter used to detect a stale or concurrent write. `lineage` is a UUID identifying the state’s history, preventing one project’s state overwriting another’s.',
      explanation:
        'Both appear in error messages, and both are guards rather than symptoms of corruption.',
    },
    {
      id: 'tf-statefund-p3',
      level: 'intermediate',
      prompt: 'Give two reasons workspaces are a poor fit for production versus staging.',
      answer:
        'They share one backend and one set of credentials, so a mistake in one can reach the other’s state; and they share one configuration, so structural differences between environments have to be expressed as conditionals on `terraform.workspace`.',
      explanation:
        'Separate directories give separate keys, separate credentials in CI and separate blast radius.',
    },
    {
      id: 'tf-statefund-p4',
      level: 'advanced',
      prompt:
        'Why can the `backend` block not use variables, and what is the practical consequence?',
      answer:
        'Because the backend must be initialised before Terraform can evaluate anything else - state has to be reachable first. The consequence is that per-environment backends are selected at init time with `-backend-config`, using a partial configuration in the file.',
      explanation:
        'It is also why environment selection tends to live in directory structure or CI configuration rather than in a variable.',
    },
  ],
  lab: {
    title: 'Workspaces, serial and lineage',
    scenario:
      'Create two workspaces with independent state, inspect the bookkeeping fields, and trigger a lineage mismatch on purpose.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a configuration whose resource name includes `terraform.workspace`, and apply it in the default workspace.',
      },
      { instruction: 'Run `terraform workspace show` and `terraform state list`.' },
      {
        instruction:
          'Create a `staging` workspace, and confirm `terraform state list` is empty in it before applying.',
      },
      { instruction: 'Apply in `staging` and confirm two independent sets of files now exist.' },
      {
        instruction:
          'Inspect `serial` and `lineage` in both workspaces’ state and confirm the lineages differ.',
        hint: 'Local backend workspaces live under terraform.tfstate.d/.',
      },
      {
        instruction:
          'Apply again in `staging` with a trivial change and confirm `serial` incremented.',
      },
      {
        instruction:
          'Copy the default workspace’s state over the staging one and run a plan. Read the lineage error.',
      },
      {
        instruction:
          'Restore the correct state, then try `terraform workspace delete staging` while it has resources. Read the refusal.',
      },
      { instruction: 'Destroy in both workspaces and clean up.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

locals {
  prefix = "acme-\${terraform.workspace}"
}

resource "local_file" "marker" {
  filename = "\${path.module}/\${local.prefix}.txt"
  content  = "workspace=\${terraform.workspace} v1\\n"
}

output "workspace" {
  value = terraform.workspace
}`,
      },
      {
        title: 'The experiment',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve
terraform workspace show          # default
terraform state list              # local_file.marker
ls acme-default.txt

terraform workspace new staging
terraform workspace show          # staging
terraform state list              # EMPTY - independent state
terraform apply -auto-approve
ls acme-*.txt                     # both files now exist

# The bookkeeping fields:
jq '{serial, lineage}' terraform.tfstate
jq '{serial, lineage}' terraform.tfstate.d/staging/terraform.tfstate
# Different lineage UUIDs: these are unrelated histories.

# serial increments on every write:
sed -i 's/v1/v2/' main.tf
terraform apply -auto-approve
jq .serial terraform.tfstate.d/staging/terraform.tfstate   # higher

# Force a lineage mismatch:
cp terraform.tfstate terraform.tfstate.d/staging/terraform.tfstate
terraform plan
# Error: Invalid legacy provider address / lineage mismatch,
# depending on version - Terraform refuses to treat one state
# as the other.

# Restore:
terraform workspace select default
terraform workspace select staging   # re-reads from the backend
# (or restore from terraform.tfstate.d/staging/terraform.tfstate.backup)

# A non-empty workspace cannot be deleted:
terraform workspace select default
terraform workspace delete staging
# Error: Workspace "staging" is not empty
#   Deleting "staging" would leave 1 resource unmanaged.

# Proper cleanup:
terraform workspace select staging && terraform destroy -auto-approve
terraform workspace select default && terraform destroy -auto-approve
terraform workspace delete staging`,
      },
    ],
    verification: [
      {
        command: 'terraform workspace list',
        what: 'Confirms which workspaces exist and which is selected.',
      },
      {
        command:
          'jq -r .lineage terraform.tfstate terraform.tfstate.d/staging/terraform.tfstate 2>/dev/null',
        what: 'Confirms the two states have independent lineages.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform workspace select default && terraform destroy -auto-approve && rm -rf terraform.tfstate.d acme-*.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Destroys both workspaces’ resources and removes all state.',
      },
    ],
  },
  relatedTopicIds: ['tf-state-introduction', 'tf-local-backend', 'tf-remote-backends'],
  docs: [
    {
      title: 'Backends',
      url: 'https://developer.hashicorp.com/terraform/language/backend',
    },
    {
      title: 'Workspaces',
      url: 'https://developer.hashicorp.com/terraform/language/state/workspaces',
    },
  ],
}
