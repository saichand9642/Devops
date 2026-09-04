import type { Topic } from '../../../types'

export const multipleProviders: Topic = {
  id: 'tf-multiple-providers',
  title: 'Writing configuration with multiple providers',
  domainId: 'tf-fundamentals',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  order: 4,
  tags: ['alias', 'provider meta-argument', 'configuration_aliases', 'objective-2c'],
  oneLiner:
    'Several platforms, or the same platform twice: aliases, the provider meta-argument, and passing providers into modules.',
  explanation: [
    'There are two different situations people call "multiple providers". The first is **several different platforms** in one configuration - AWS and Cloudflare. The second is **the same provider more than once** with different settings - AWS in two regions. They are solved differently.',
    'Different platforms need nothing special: declare each in `required_providers`, give each a `provider` block, and write resources. Terraform routes each resource to the provider whose name prefixes its type.',
    'The same provider twice needs an **alias**. One `provider` block stays unaliased and becomes the default; each extra block gets `alias = "name"`. A resource then opts in with the `provider = aws.name` meta-argument.',
    'Modules are the subtle part. A child module inherits only the *default* provider configuations. Aliased providers must be passed in explicitly via a `providers` argument, and the module must declare that it expects them with `configuration_aliases`.',
  ],
  whyItMatters: [
    'Objective 2c asks you to write configuration using multiple providers, and the alias mechanism is the substance of it.',
    'Forgetting the `provider` meta-argument is a silent failure: the resource is created successfully, in the wrong place. Nothing errors.',
    'Multi-region and multi-account patterns are extremely common in real work, and both rest entirely on aliases.',
  ],
  howItWorks: [
    'A `provider` block with no `alias` is the **default configuration** for that provider. There can be at most one.',
    'A `provider` block with `alias = "x"` creates an **additional configuration** addressed as `<provider>.x`.',
    'Every resource and data source accepts the `provider` meta-argument. Omit it and the default configuration is used.',
    'Child modules automatically inherit default provider configurations from their caller. They do not inherit aliased ones.',
    'To give a module an aliased provider, the module declares `configuration_aliases = [aws.replica]` inside `required_providers`, and the caller passes `providers = { aws.replica = aws.eu }`.',
    'A module should not contain its own `provider` blocks. Providers belong to the root configuration, because a module cannot know how the caller wants to authenticate.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Default and aliased provider configurations',
      caption:
        'One unaliased block is the default. Everything else must be asked for by name, and resources that do not ask get the default.',
      root: {
        label: 'Root configuration',
        children: [
          {
            label: 'provider "aws" { region = "eu-west-1" }',
            detail: 'No alias, so this is the DEFAULT',
            tone: 'accent',
            children: [
              {
                label: 'aws_s3_bucket.eu',
                detail: 'No provider argument, so it lands here',
                tone: 'success',
              },
            ],
          },
          {
            label: 'provider "aws" { alias = "us", region = "us-east-1" }',
            detail: 'Addressed as aws.us',
            children: [
              {
                label: 'aws_s3_bucket.us',
                detail: 'provider = aws.us - opted in explicitly',
                tone: 'success',
              },
            ],
          },
          {
            label: 'module "network"',
            detail: 'Inherits the default only. Aliases must be passed in.',
            tone: 'muted',
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'Which provider configuration does a resource use?',
      caption:
        'The failure mode here is silent. A missing provider argument does not error - it just uses the default region or account.',
      nodes: [
        { label: 'Terraform reads a resource block' },
        {
          label: 'Does it set the provider meta-argument?',
          detail: 'provider = aws.us',
          tone: 'accent',
        },
        {
          label: 'Yes: use that named configuration',
          detail: 'Errors clearly if the alias was never declared',
          arrowLabel: 'explicit',
          tone: 'success',
        },
        {
          label: 'No: use the default configuration',
          detail: 'The unaliased provider block, or an implicit empty one',
          arrowLabel: 'omitted',
          branch: {
            label: 'This is the silent bug',
            detail: 'Created successfully in the wrong region or account',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'provider meta-argument',
      purpose:
        'Selects which provider configuration a resource, data source or module uses. Available on every one of them.',
      fields: [
        {
          path: 'provider = aws.us',
          meaning: 'On a resource or data source: use that aliased configuration.',
        },
        {
          path: 'providers = { aws = aws.us }',
          meaning:
            'On a module block: map the module’s provider slots onto the caller’s configurations.',
        },
        {
          path: 'configuration_aliases = [aws.replica]',
          meaning: 'Inside a module: declare which aliased providers the caller must pass in.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The bucket that was replicated to itself',
    story: [
      'A team set up cross-region S3 replication: a primary bucket in eu-west-1 and a replica in us-east-1. They added an aliased provider for the second region.',
      'The replica bucket resource was written without the `provider` meta-argument. Terraform created it happily - in eu-west-1, next to the primary.',
      'Nothing failed. The plan was clean, the apply succeeded, and the replication configuration pointed at a bucket in the same region. It was found weeks later during a disaster-recovery review.',
      'This is why the missing meta-argument matters more than a typo: a typo errors, and this does not. Verifying with `terraform state show` and checking the region is the habit that catches it.',
    ],
    code: [
      {
        title: 'The one-line difference',
        language: 'hcl',
        code: `resource "aws_s3_bucket" "replica" {
  # Without this line the bucket is created by the DEFAULT
  # provider - in the primary region. No error, wrong result.
  provider = aws.us
  bucket   = "acme-replica"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The same provider in three regions',
      language: 'hcl',
      explanation:
        'One default plus two aliases. Every resource that should not be in the default region says so explicitly.',
      code: `terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.60" }
  }
}

provider "aws" {
  region = "eu-west-1"
}

provider "aws" {
  alias  = "us"
  region = "us-east-1"
}

provider "aws" {
  alias  = "ap"
  region = "ap-southeast-2"
}

resource "aws_s3_bucket" "eu" {
  bucket = "acme-eu"
}

resource "aws_s3_bucket" "us" {
  provider = aws.us
  bucket   = "acme-us"
}

# Data sources take the meta-argument too.
data "aws_region" "ap" {
  provider = aws.ap
}

output "ap_region" {
  value = data.aws_region.ap.name
}`,
    },
    {
      title: 'Passing an aliased provider into a module',
      language: 'hcl',
      explanation:
        'The module declares the slot with `configuration_aliases`; the caller fills it with `providers`. Both halves are required.',
      code: `# --- modules/replicated-bucket/versions.tf (inside the module)
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
      # Declares: "my caller must give me a second aws configuration
      # that I will refer to as aws.replica".
      configuration_aliases = [aws.replica]
    }
  }
}

# --- modules/replicated-bucket/main.tf
resource "aws_s3_bucket" "primary" {
  bucket = var.name
}

resource "aws_s3_bucket" "replica" {
  provider = aws.replica
  bucket   = "\${var.name}-replica"
}

# --- root main.tf (the caller)
module "bucket" {
  source = "./modules/replicated-bucket"
  name   = "acme-data"

  providers = {
    # Left side: the slot inside the module.
    # Right side: the configuration out here.
    aws         = aws
    aws.replica = aws.us
  }
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform providers',
      what: 'Shows every provider configuration required, including aliases expected by modules.',
    },
    {
      command: 'terraform state show aws_s3_bucket.us',
      what: 'The reliable way to confirm which region a resource actually landed in.',
      expected: 'region = "us-east-1"',
    },
    {
      command:
        'terraform state list | xargs -n1 -I{} sh -c \'echo "{}"; terraform state show "{}" | grep -m1 " region"\'',
      what: 'Audits the region of every resource in state at once.',
    },
    {
      command: 'terraform plan -target=module.bucket',
      what: 'Plans just the module while you are debugging a provider mapping.',
    },
  ],
  declarative: {
    steps: [
      'Keep every `provider` block in the root configuration - never inside a module.',
      'Leave exactly one block unaliased, as the default.',
      'Add `provider = <name>.<alias>` to every resource that must not use the default.',
      'For modules needing a second configuration, declare `configuration_aliases` inside and pass `providers` outside.',
      'Verify with `terraform state show`, not by reading the code back to yourself.',
    ],
    code: [
      {
        title: 'The anti-pattern to avoid',
        language: 'hcl',
        explanation:
          'A provider block inside a module hard-codes authentication for every caller, and makes the module impossible to reuse across accounts.',
        code: `# modules/bad/main.tf - DO NOT DO THIS
provider "aws" {
  region = "eu-west-1"   # every caller is now stuck with this
}

resource "aws_s3_bucket" "this" {
  bucket = var.name
}

# Instead: declare the requirement, let the caller configure it.
# modules/good/versions.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state show <address> | grep -E "^\\s+(region|arn)"',
      what: 'Proves which region or account a resource is really in.',
    },
    {
      command: 'terraform validate',
      what: 'Catches a reference to an alias that was never declared.',
      expected: 'Error: Reference to undeclared provider configuration',
    },
    {
      command: 'terraform providers',
      what: 'Confirms a module’s expected aliases are being satisfied by the caller.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'Reports "Reference to undeclared provider configuration": you used `aws.x` without a matching alias block.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "missing required provider configuration": a module declared `configuration_aliases` and the caller passed no `providers` map.',
    },
    {
      command: 'terraform state show <address> | grep region',
      what: 'Diagnoses the silent case: everything applied, but in the default region.',
    },
  ],
  commonMistakes: [
    'Omitting the `provider` meta-argument on a resource that needs an alias. It succeeds in the wrong place, with no error.',
    'Putting a `provider` block inside a module. Providers are the caller’s concern.',
    'Aliasing every provider block, including the one meant to be the default. Something must be unaliased or every resource needs the meta-argument.',
    'Expecting modules to inherit aliases. Only default configurations are inherited.',
    'Writing `providers = { aws.us = aws.us }` in the caller when the module slot is named `aws.replica`. The left side is the module’s name for it, not yours.',
  ],
  examTips: [
    '`alias` creates an additional provider configuration; the unaliased block is the default.',
    'Resources select a configuration with `provider = <name>.<alias>`; modules use `providers = { ... }`.',
    'Modules inherit default provider configurations automatically, aliased ones never.',
    '`configuration_aliases` inside `required_providers` is how a module declares it needs an extra configuration.',
    'Multiple *different* providers need no aliases at all - only multiple configurations of the *same* provider do.',
  ],
  summary: [
    'Different platforms: just declare and configure each one.',
    'Same platform twice: one default block plus aliased blocks.',
    '`provider = aws.us` on a resource is opt-in and easy to forget - and forgetting it is silent.',
    'Modules inherit defaults only; pass aliases with `providers` and declare them with `configuration_aliases`.',
    'Never put a `provider` block inside a module.',
  ],
  practice: [
    {
      id: 'tf-multiprov-p1',
      level: 'beginner',
      prompt:
        'You have `provider "aws"` with region eu-west-1 and `provider "aws"` with `alias = "us"`. A bucket resource has no `provider` argument. Where is it created?',
      answer: 'In eu-west-1, using the default (unaliased) configuration.',
      explanation:
        'Omitting the meta-argument always means the default configuration. It never means "pick one" or "error".',
    },
    {
      id: 'tf-multiprov-p2',
      level: 'intermediate',
      prompt:
        'A module creates resources in two regions. What must the module declare, and what must the caller pass?',
      answer:
        'The module declares `configuration_aliases = [aws.replica]` inside its `required_providers`. The caller passes `providers = { aws = aws, aws.replica = aws.us }` in the module block.',
      explanation:
        'The left-hand side of the map is the module’s internal name for the slot; the right-hand side is the caller’s configuration.',
    },
    {
      id: 'tf-multiprov-p3',
      level: 'intermediate',
      prompt: 'Why should a reusable module never contain its own `provider` block?',
      answer:
        'Because it fixes region, credentials and endpoints for every caller, so the module cannot be reused across accounts or regions. Provider configuration belongs to the root.',
      explanation:
        'Terraform also warns about this: provider blocks in shared modules make the whole configuration harder to reason about, and cannot be removed once callers depend on them.',
    },
    {
      id: 'tf-multiprov-p4',
      level: 'advanced',
      prompt:
        'You need resources in two AWS accounts. Sketch how you would configure that, and what the security trade-off is.',
      answer:
        'Two `provider "aws"` blocks - one default, one aliased - each with its own `assume_role` block pointing at a role in the respective account. Resources opt in with `provider = aws.other`. The trade-off is that whoever runs Terraform holds credentials able to assume into both accounts, so one compromised runner reaches both.',
      explanation:
        'The alternative is separate state and separate pipelines per account, which reduces blast radius at the cost of the automatic cross-account ordering you get from a single graph.',
    },
  ],
  lab: {
    title: 'Aliases, and the silent mistake',
    scenario:
      'Use the credential-free `random` provider to build the alias mechanism, then reproduce the silent default-provider bug and detect it from state.',
    prerequisites: ['Terraform 1.5 or newer', 'No cloud account needed'],
    tasks: [
      {
        instruction:
          'Declare `hashicorp/random` and write two `provider "random"` blocks: one default, one with `alias = "short"`.',
      },
      {
        instruction:
          'Create two `random_password` resources: one with `length = 24` using the default provider, one with `length = 8` using `provider = random.short`.',
      },
      { instruction: 'Apply, then confirm both lengths from state.' },
      {
        instruction:
          'Now remove the `provider = random.short` line from the second resource and run a plan. Note that it does NOT error.',
        hint: 'This is the silent failure. The resource simply uses the default configuration.',
      },
      {
        instruction:
          'Reference a non-existent alias, `provider = random.nope`, and run `terraform validate`. Contrast that error with the previous silence.',
      },
      {
        instruction:
          'Build a small local module that declares `configuration_aliases = [random.short]`, and pass the alias in from the root.',
      },
      {
        instruction:
          'Remove the `providers` map from the module block and read the resulting error.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'Root main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

provider "random" {}

provider "random" {
  alias = "short"
}

resource "random_password" "long" {
  length = 24
}

resource "random_password" "short" {
  provider = random.short
  length   = 8
}

module "extra" {
  source = "./modules/extra"

  providers = {
    random       = random
    random.short = random.short
  }
}`,
      },
      {
        title: 'modules/extra/main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    random = {
      source                = "hashicorp/random"
      version               = "~> 3.6"
      configuration_aliases = [random.short]
    }
  }
}

resource "random_pet" "from_default" {
  length = 3
}

resource "random_pet" "from_alias" {
  provider = random.short
  length   = 1
}`,
      },
      {
        title: 'The experiment',
        language: 'bash',
        code: `terraform init
terraform apply -auto-approve

# Confirm from state, not from the source:
terraform state show random_password.short | grep -E "^\\s+length"   # 8
terraform state show random_password.long  | grep -E "^\\s+length"   # 24

# Silent failure: delete the "provider = random.short" line, then
terraform plan
# No error at all. The resource would just use the default provider.

# Contrast: reference an alias that does not exist
# add   provider = random.nope
terraform validate
# Error: Reference to undeclared provider configuration

# Remove the providers = { ... } map from the module block:
terraform plan
# Error: missing required provider configuration for random.short

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform providers',
        what: 'Shows the module requiring an aliased configuration.',
        expected: 'A random.short entry under module.extra',
      },
      {
        command: 'terraform state list | wc -l',
        what: 'Counts every resource, root and module.',
        expected: '4',
      },
    ],
    cleanup: [
      {
        command: 'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl modules',
        what: 'Removes everything the lab created.',
      },
    ],
  },
  relatedTopicIds: ['tf-how-providers-work', 'tf-multi-cloud-and-hybrid', 'tf-module-basics'],
  docs: [
    {
      title: 'Provider configuration and aliases',
      url: 'https://developer.hashicorp.com/terraform/language/providers/configuration',
    },
    {
      title: 'Passing providers to modules',
      url: 'https://developer.hashicorp.com/terraform/language/modules/develop/providers',
    },
  ],
}
