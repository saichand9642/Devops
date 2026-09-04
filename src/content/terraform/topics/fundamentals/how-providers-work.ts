import type { Topic } from '../../../types'

export const howProvidersWork: Topic = {
  id: 'tf-how-providers-work',
  title: 'How Terraform uses providers',
  domainId: 'tf-fundamentals',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 2,
  tags: ['providers', 'registry', 'plugins', 'schema', 'authentication', 'objective-2b'],
  oneLiner:
    'Providers are the plugins that turn HCL into API calls - where they come from, how they authenticate, and what they contribute.',
  explanation: [
    'Terraform core knows nothing about AWS, Kubernetes or DNS. It knows how to parse HCL, build a graph, diff state and orchestrate work. Everything platform-specific lives in a **provider**.',
    'A provider is a separate executable that Terraform launches and talks to over RPC. It publishes a **schema** describing the resource types, data sources and configuration arguments it supports - which is how Terraform can validate your configuration before making any API call.',
    'Providers are identified by a **source address** in the form `HOSTNAME/NAMESPACE/TYPE`, for example `registry.terraform.io/hashicorp/aws`. In practice you write `hashicorp/aws` and the default hostname and registry are assumed.',
    'The namespace matters. `hashicorp/aws` is the official AWS provider; a different namespace is a different publisher. Providers are tiered: **official** (HashiCorp), **partner** (verified vendor), and **community**.',
  ],
  whyItMatters: [
    'Objective 2b is precisely this. Expect questions about source addresses, the registry and where the plugin binaries live.',
    'Almost every confusing Terraform error is really a provider error. Knowing that the provider - not Terraform - owns validation, defaults and API behaviour makes those messages readable.',
    'Provider authentication is separate from Terraform. When credentials are the problem, no amount of configuration change will help.',
  ],
  howItWorks: [
    'You declare providers in `required_providers` with a source address and a version constraint.',
    '`terraform init` resolves those constraints against the registry, downloads the matching plugin binaries into `.terraform/providers/`, and records the exact versions and checksums in `.terraform.lock.hcl`.',
    'On every run Terraform starts each provider as a child process and communicates over gRPC. The provider is what actually calls the platform API.',
    'A `provider` block configures an instance: region, endpoints, credentials. It is optional when every argument has a default or comes from the environment.',
    'Providers contribute three things to the language: **resource types** (`resource "aws_instance"`), **data sources** (`data "aws_ami"`), and **provider-defined functions** in newer versions.',
    'Credentials are almost never written in the configuration. Providers read the platform’s own conventions - `AWS_PROFILE`, `~/.aws/credentials`, `ARM_CLIENT_ID`, `KUBECONFIG` - which keeps secrets out of the repository.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'Terraform core talking to a provider',
      caption:
        'Core never calls a cloud API. It asks the provider, which is a separate process. That boundary is why provider errors read differently from Terraform errors.',
      participants: [
        { id: 'core', label: 'Terraform core' },
        { id: 'prov', label: 'Provider plugin' },
        { id: 'api', label: 'Platform API' },
      ],
      messages: [
        { from: 'core', to: 'prov', label: 'start plugin, request schema' },
        { from: 'prov', to: 'core', label: 'resource types and arguments', kind: 'return' },
        { from: 'core', to: 'core', label: 'validate configuration against schema' },
        { from: 'core', to: 'prov', label: 'ReadResource for the current state' },
        { from: 'prov', to: 'api', label: 'DescribeInstances' },
        { from: 'api', to: 'prov', label: 'current attributes', kind: 'return' },
        { from: 'prov', to: 'core', label: 'here is reality', kind: 'return' },
        { from: 'core', to: 'prov', label: 'ApplyResourceChange' },
      ],
    },
    {
      kind: 'nested',
      title: 'Anatomy of a source address',
      caption:
        'Writing "aws" is shorthand. Knowing the full form is what lets you read a lock file or use a private registry.',
      root: {
        label: 'registry.terraform.io/hashicorp/aws',
        detail: 'The fully qualified provider source address',
        tone: 'accent',
        children: [
          {
            label: 'registry.terraform.io',
            detail: 'HOSTNAME - the registry. Omitted means the public one.',
          },
          {
            label: 'hashicorp',
            detail: 'NAMESPACE - the publisher. This one means official.',
          },
          {
            label: 'aws',
            detail: 'TYPE - the provider name, and the prefix on its resources',
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'Where a provider binary comes from',
      caption:
        'After init, everything runs from the local cache. That is why an offline plan works and why deleting .terraform means re-running init.',
      nodes: [
        {
          label: 'required_providers declares a constraint',
          detail: 'source = "hashicorp/aws", version = "~> 5.60"',
        },
        {
          label: 'terraform init queries the registry',
          detail: 'Which published versions satisfy the constraint?',
          arrowLabel: 'needs network',
          tone: 'accent',
        },
        {
          label: 'The newest matching version is chosen',
          detail: 'Unless the lock file already pins one',
          branch: {
            label: 'Lock file present',
            detail: 'The locked version is reused, ignoring newer releases',
          },
        },
        {
          label: 'Binary downloaded and checksummed',
          detail: 'Into .terraform/providers/, recorded in .terraform.lock.hcl',
        },
        {
          label: 'Later commands run from the local cache',
          detail: 'No registry access needed for plan or apply',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'required_providers entry',
      purpose:
        'Declares one provider dependency: where it comes from and which versions are acceptable.',
      fields: [
        {
          path: 'source',
          meaning: 'The source address, e.g. "hashicorp/aws". Required in practice.',
          required: true,
        },
        {
          path: 'version',
          meaning: 'Version constraint. Optional but always worth setting.',
        },
        {
          path: 'configuration_aliases',
          meaning: 'Declares aliased provider instances a module expects to be passed in.',
        },
      ],
    },
    {
      kind: 'provider block',
      purpose:
        'Configures one instance of a provider. Optional if every argument has a default or an environment source.',
      fields: [
        { path: 'alias', meaning: 'Names an additional instance of the same provider.' },
        {
          path: '(platform arguments)',
          meaning: 'region, project, host, token... entirely provider-specific.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The provider that was not official',
    story: [
      'A team copied a snippet from a blog post that declared `source = "mycompany/aws"` instead of `hashicorp/aws`. It initialised fine - the registry had something at that address.',
      'Plans worked. Then a resource argument the official provider had supported for a year turned out to be missing, and the error made no sense against the AWS documentation.',
      '`terraform providers` showed the truth in one line: they were running a stale community fork.',
      'The lesson is not that community providers are bad - many are excellent - but that the namespace is part of the identity. `aws` alone does not tell you whose AWS provider you are running.',
    ],
    code: [
      {
        title: 'The command that reveals it',
        language: 'bash',
        code: `$ terraform providers

Providers required by configuration:
.
├── provider[registry.terraform.io/mycompany/aws] ~> 4.0
└── module.network
    └── provider[registry.terraform.io/hashicorp/aws] ~> 5.0

# Two different AWS providers in one configuration.
# The namespace is the giveaway.`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Declaring and configuring a provider',
      language: 'hcl',
      explanation:
        'Note that no credentials appear. The provider reads them from the environment, which is what keeps them out of Git.',
      code: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = "eu-west-1"

  # Applied to every resource this provider creates.
  default_tags {
    tags = {
      ManagedBy = "terraform"
      Repo      = "acme/infrastructure"
    }
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "acme-logs-eu"
}`,
    },
    {
      title: 'The three things a provider contributes',
      language: 'hcl',
      explanation:
        'Resource types create things, data sources read things, and both carry the provider name as a prefix. That prefix is how you know which plugin owns an error.',
      code: `# 1. A data source: reads something that already exists.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# 2. A resource type: creates and manages something.
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}

# 3. A provider-defined function (Terraform 1.8+).
output "arn_service" {
  value = provider::aws::arn_parse(aws_instance.web.arn).service
}`,
    },
    {
      title: 'Where the plugins actually live',
      language: 'bash',
      explanation:
        'This directory is machine-specific and gitignored. The lock file, which records what should be here, is committed instead.',
      code: `$ tree -L 5 .terraform/providers
.terraform/providers
└── registry.terraform.io
    └── hashicorp
        └── aws
            └── 5.62.0
                └── linux_amd64
                    └── terraform-provider-aws_v5.62.0_x5

# The lock file records the version and checksums:
$ head -8 .terraform.lock.hcl
provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.62.0"
  constraints = "~> 5.60"
  hashes = [
    "h1:...",
    "zh:...",
  ]
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Resolves, downloads and locks every required provider.',
      expected: '- Installing hashicorp/aws v5.62.0...',
    },
    {
      command: 'terraform providers',
      what: 'Shows every provider the configuration and its modules require, with constraints.',
    },
    {
      command: "terraform providers schema -json | jq '.provider_schemas | keys'",
      what: 'Dumps the full schema. Useful for discovering arguments without leaving the terminal.',
    },
    {
      command:
        'terraform providers schema -json | jq \'.provider_schemas["registry.terraform.io/hashicorp/local"].resource_schemas | keys\'',
      what: 'Lists every resource type a provider offers.',
    },
    {
      command: 'terraform providers lock -platform=linux_amd64 -platform=darwin_arm64',
      what: 'Records checksums for several platforms, so a mixed team shares one lock file.',
      namespaceNote:
        'Run this when colleagues on macOS and Linux keep fighting over the lock file.',
    },
  ],
  declarative: {
    steps: [
      'Declare every provider in `required_providers` with an explicit `source`.',
      'Add a `provider` block only when you need to set something - region, host, alias.',
      'Take credentials from the environment or a credentials file, never from HCL.',
      'Commit `.terraform.lock.hcl`; gitignore `.terraform/`.',
      'Use `default_tags` (or the provider’s equivalent) rather than repeating tags on every resource.',
    ],
    code: [
      {
        title: 'Credentials the right way',
        language: 'bash',
        explanation:
          'Every one of these keeps the secret out of your configuration and out of your state file.',
        code: `# AWS: a named profile from ~/.aws/credentials
export AWS_PROFILE=acme-prod
export AWS_REGION=eu-west-1

# Azure: a service principal
export ARM_CLIENT_ID=...
export ARM_CLIENT_SECRET=...
export ARM_TENANT_ID=...
export ARM_SUBSCRIPTION_ID=...

# GCP: a service-account key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Kubernetes: the usual kubeconfig
export KUBE_CONFIG_PATH=~/.kube/config

# In CI, prefer short-lived credentials via OIDC over any of the above.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform version',
      what: 'Lists the exact provider versions in use, not just the constraints.',
    },
    {
      command: 'terraform providers',
      what: 'Confirms the namespace, so you know whose provider you are running.',
    },
    {
      command: 'terraform plan',
      what: 'Fails fast on a schema violation, before any API call, thanks to the provider schema.',
      expected: 'Error: Unsupported argument - An argument named "x" is not expected here.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports "Failed to query available provider packages" - usually no network, a proxy, or a typo in the source.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "No valid credential sources found" - a provider authentication problem, not a configuration one.',
    },
    {
      command: 'rm -rf .terraform && terraform init',
      what: 'Rebuilds the plugin cache when a binary is corrupt or a platform changed.',
      namespaceNote: 'Safe: this deletes only the cache, never state.',
    },
    {
      command: 'TF_LOG=TRACE terraform plan 2>&1 | grep -i "provider.aws"',
      what: 'Shows the actual RPC traffic to one provider when the error is opaque.',
    },
  ],
  commonMistakes: [
    'Omitting `source` and relying on the legacy implicit namespace. Always write it out - it is the provider’s identity.',
    'Putting access keys in a `provider` block. They end up in the repository and often in state.',
    'Assuming an error prefixed with a resource type is a Terraform bug. `aws_instance` errors come from the AWS provider or from AWS itself.',
    'Committing `.terraform/`. It contains platform-specific binaries and can be hundreds of megabytes.',
    'Confusing `required_providers` (which providers) with a `provider` block (how one is configured). You often need both, and they do different jobs.',
  ],
  examTips: [
    'A source address is `HOSTNAME/NAMESPACE/TYPE`, and the default hostname is `registry.terraform.io`.',
    'Provider tiers: official (hashicorp), partner (verified vendor), community.',
    'Providers are downloaded by `terraform init` into `.terraform/providers/` and locked in `.terraform.lock.hcl`.',
    'Providers are separate processes speaking gRPC to Terraform core. Core has no platform knowledge of its own.',
    'A provider supplies resource types and data sources; both are prefixed with the provider name.',
  ],
  summary: [
    'Terraform core is platform-agnostic; providers do all the platform work.',
    'Providers are declared by source address and downloaded by `terraform init`.',
    'The provider schema is what lets Terraform validate before calling any API.',
    'Credentials come from the platform’s own conventions, not from your HCL.',
    '`terraform providers` tells you which plugins - and whose - you are really using.',
  ],
  practice: [
    {
      id: 'tf-providers-p1',
      level: 'beginner',
      prompt: 'Expand `hashicorp/random` into its fully qualified source address.',
      answer: '`registry.terraform.io/hashicorp/random`',
      explanation:
        'The hostname defaults to the public registry when omitted. The three parts are hostname, namespace and type.',
    },
    {
      id: 'tf-providers-p2',
      level: 'beginner',
      prompt:
        'Where do provider binaries live after `terraform init`, and should that directory be committed?',
      answer:
        'In `.terraform/providers/`. No - it holds platform-specific binaries and must be gitignored.',
      explanation:
        'The committed artefact is `.terraform.lock.hcl`, which records which versions and checksums the directory should contain.',
    },
    {
      id: 'tf-providers-p3',
      level: 'intermediate',
      prompt:
        'Your configuration has no `provider "aws"` block at all, yet `terraform plan` still contacts AWS successfully. How?',
      answer:
        'The provider was configured implicitly from the environment - `AWS_REGION` and `AWS_PROFILE` or equivalent. A `provider` block is only needed to set something the environment does not supply.',
      explanation:
        'Terraform creates a default, empty configuration for any required provider that has no block, and the provider then falls back to its own credential and region resolution.',
    },
    {
      id: 'tf-providers-p4',
      level: 'advanced',
      prompt:
        'A teammate on macOS and you on Linux keep overwriting each other’s `.terraform.lock.hcl`. What is the correct fix?',
      answer:
        'Run `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64` (adding any other platforms you use) and commit the result. The lock file then contains checksums valid for everyone.',
      explanation:
        'By default `init` records checksums only for the platform it ran on, so the next person on a different OS legitimately has to add theirs.',
    },
  ],
  lab: {
    title: 'Inspect a provider from the inside',
    scenario:
      'Install a provider, read its schema from the CLI, and discover a resource argument without opening a browser - the skill that makes you fast when documentation is not to hand.',
    prerequisites: ['Terraform 1.5 or newer', 'jq', 'Network access for the first init'],
    tasks: [
      {
        instruction:
          'Create a configuration requiring `hashicorp/local` and `hashicorp/random`, with no resources yet.',
      },
      {
        instruction:
          'Run `terraform init`, then find the downloaded binaries under `.terraform/providers/`.',
      },
      { instruction: 'Run `terraform providers` and note the constraint shown for each.' },
      {
        instruction:
          'Using `terraform providers schema -json` and jq, list every resource type the local provider offers.',
        hint: 'Filter on .provider_schemas["registry.terraform.io/hashicorp/local"].resource_schemas',
      },
      {
        instruction:
          'Using the same command, find the arguments of `random_password` and identify which are optional.',
        hint: 'Look at .block.attributes and each attribute’s "optional" and "required" flags.',
      },
      {
        instruction:
          'Add a `random_password` using an argument you discovered, apply, then deliberately add a misspelled argument and read the error.',
      },
      {
        instruction: 'Open `.terraform.lock.hcl` and identify the version and constraint recorded.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local  = { source = "hashicorp/local", version = "~> 2.5" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

resource "random_password" "example" {
  length           = 20
  override_special = "!#$%"   # discovered from the schema
  min_numeric      = 2
}`,
      },
      {
        title: 'Exploring the schema',
        language: 'bash',
        code: `terraform init

# Where the binaries went:
find .terraform/providers -type f -name 'terraform-provider-*'

# Which providers and constraints:
terraform providers

# Every resource type the local provider offers:
terraform providers schema -json \\
  | jq -r '.provider_schemas["registry.terraform.io/hashicorp/local"].resource_schemas | keys[]'
# local_file
# local_sensitive_file

# Arguments of random_password, and whether each is optional:
terraform providers schema -json \\
  | jq -r '.provider_schemas["registry.terraform.io/hashicorp/random"]
           .resource_schemas.random_password.block.attributes
           | to_entries[]
           | "\\(.key)\\t\\(if .value.required then "REQUIRED" else "optional" end)"' \\
  | sort

terraform apply -auto-approve

# Now break it on purpose:
# add   lenght = 20   and run:
terraform plan
# Error: Unsupported argument - An argument named "lenght" is not expected here.
# The provider schema caught it before any API call.`,
      },
    ],
    verification: [
      {
        command:
          'grep -A2 \'provider "registry.terraform.io/hashicorp/random"\' .terraform.lock.hcl',
        what: 'Shows the resolved version and the constraint that produced it.',
        expected: 'version = "3.6.x" and constraints = "~> 3.6"',
      },
      {
        command: 'terraform state show random_password.example | grep -E "length|min_numeric"',
        what: 'Confirms the arguments you discovered were actually applied.',
        expected: 'length = 20 and min_numeric = 2',
      },
    ],
    cleanup: [
      {
        command: 'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl',
        what: 'Removes the resource and the local plugin cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-provider-versioning', 'tf-multiple-providers', 'tf-init'],
  docs: [
    {
      title: 'Providers',
      url: 'https://developer.hashicorp.com/terraform/language/providers',
    },
    {
      title: 'Provider requirements',
      url: 'https://developer.hashicorp.com/terraform/language/providers/requirements',
    },
  ],
}
