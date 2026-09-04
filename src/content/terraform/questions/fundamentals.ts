import type { Question } from '../../types'

/** Original practice questions for objective 2. */
export const fundamentalsQuestions: Question[] = [
  {
    id: 'tfq-fund-1',
    domainId: 'tf-fundamentals',
    topicId: 'tf-provider-versioning',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which versions satisfy the constraint `~> 3.6.0`?',
    options: [
      { id: 'a', text: '3.6.0 and 3.6.9 only' },
      { id: 'b', text: '3.6.0, 3.7.0 and 3.9.9' },
      { id: 'c', text: 'Any 3.x version' },
      { id: 'd', text: 'Exactly 3.6.0' },
    ],
    correct: ['a'],
    explanation:
      'With three components written, `~>` allows the rightmost - the patch - to increase. 3.6.9 is allowed; 3.7.0 changes the minor and is refused. Written as `~> 3.6` it would instead allow 3.7 and 3.99 but not 4.0.',
  },
  {
    id: 'tfq-fund-2',
    domainId: 'tf-fundamentals',
    topicId: 'tf-provider-versioning',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which statement about `.terraform.lock.hcl` is correct?',
    options: [
      { id: 'a', text: 'It records provider and module versions, and should be gitignored' },
      { id: 'b', text: 'It records provider versions and checksums, and should be committed' },
      { id: 'c', text: 'It records the Terraform CLI version, and should be committed' },
      { id: 'd', text: 'It is generated at plan time and is not meant to persist' },
    ],
    correct: ['b'],
    explanation:
      'The lock file records the exact provider versions selected and their per-platform checksums, and is meant to be committed so every machine resolves identically. It does NOT record module versions - those live in the gitignored `.terraform/modules/modules.json`, which is why module constraints should be narrower.',
  },
  {
    id: 'tfq-fund-3',
    domainId: 'tf-fundamentals',
    topicId: 'tf-installing-terraform',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Your configuration sets `required_version = ">= 1.10"` but you are running Terraform 1.8. What happens?',
    options: [
      { id: 'a', text: 'Terraform downloads 1.10 automatically and continues' },
      { id: 'b', text: 'Terraform warns and continues with 1.8' },
      { id: 'c', text: 'Terraform stops with an unsupported-version error' },
      { id: 'd', text: 'Only terraform apply fails; plan still works' },
    ],
    correct: ['c'],
    explanation:
      'Terraform downloads providers for you, but never itself. An unsatisfied `required_version` is a hard error raised before anything else runs - before the backend, before provider download. This asymmetry is frequently examined.',
  },
  {
    id: 'tfq-fund-4',
    domainId: 'tf-fundamentals',
    topicId: 'tf-installing-terraform',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Why does this configuration fail?',
    code: {
      title: 'main.tf',
      language: 'hcl',
      code: `variable "tf_version" {
  type    = string
  default = "~> 1.16.0"
}

terraform {
  required_version = var.tf_version
}`,
    },
    options: [
      { id: 'a', text: 'required_version does not accept the ~> operator' },
      {
        id: 'b',
        text: 'The terraform block is evaluated before variables exist, so it accepts literals only',
      },
      { id: 'c', text: 'The variable must be declared inside the terraform block' },
      { id: 'd', text: 'A default value cannot be a version constraint' },
    ],
    correct: ['b'],
    explanation:
      'The `terraform` block is read before variables are available, because Terraform must know its own version requirement and its backend before it can evaluate anything. The same restriction applies to `required_providers` versions and to the `backend` block - which is why backends are configured with `-backend-config` rather than variables.',
  },
  {
    id: 'tfq-fund-5',
    domainId: 'tf-fundamentals',
    topicId: 'tf-how-providers-work',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'What is the fully qualified source address of the provider written as `hashicorp/random`?',
    options: [
      { id: 'a', text: 'registry.terraform.io/hashicorp/random' },
      { id: 'b', text: 'terraform.io/providers/hashicorp/random' },
      { id: 'c', text: 'hashicorp.com/registry/random' },
      { id: 'd', text: 'app.terraform.io/hashicorp/random' },
    ],
    correct: ['a'],
    explanation:
      'A source address is `HOSTNAME/NAMESPACE/TYPE`. The hostname defaults to `registry.terraform.io` when omitted. The namespace matters: `hashicorp` means the official provider, and a different namespace is a different publisher.',
  },
  {
    id: 'tfq-fund-6',
    domainId: 'tf-fundamentals',
    topicId: 'tf-how-providers-work',
    kind: 'multi',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which of these are true about Terraform providers? (Select all that apply.)',
    options: [
      {
        id: 'a',
        text: 'They are separate executables that Terraform launches and talks to over RPC',
      },
      {
        id: 'b',
        text: 'They publish a schema, which is how Terraform validates configuration before any API call',
      },
      { id: 'c', text: 'They are compiled into the Terraform binary' },
      { id: 'd', text: 'They contribute resource types and data sources to the language' },
      { id: 'e', text: 'Terraform core contains the API logic for the major clouds' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Providers are plugins - separate processes speaking gRPC - downloaded into `.terraform/providers/` by `terraform init`. They publish a schema, which is what lets `terraform validate` check argument names and types offline. Terraform core has no platform knowledge of its own.',
  },
  {
    id: 'tfq-fund-7',
    domainId: 'tf-fundamentals',
    topicId: 'tf-provider-versioning',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'The lock file pins aws 5.62.0. You widen the constraint from `~> 5.62.0` to `~> 5.62` and run a plain `terraform init`. Which version is used?',
    options: [
      {
        id: 'a',
        text: '5.62.0 - the locked version still satisfies the constraint, so init reuses it',
      },
      { id: 'b', text: 'The newest 5.x release, because the constraint changed' },
      { id: 'c', text: 'Initialisation fails, because the lock file no longer matches' },
      { id: 'd', text: 'The newest release overall, because ~> was widened' },
    ],
    correct: ['a'],
    explanation:
      'A plain `init` honours the lock file whenever the locked version still satisfies the constraints. Only `terraform init -upgrade` re-resolves. If the locked version no longer satisfied the constraint, init would instead fail and tell you to run `-upgrade`.',
  },
  {
    id: 'tfq-fund-8',
    domainId: 'tf-fundamentals',
    topicId: 'tf-multiple-providers',
    kind: 'mcq',
    category: 'yaml',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'In which region is `aws_s3_bucket.data` created?',
    code: {
      title: 'main.tf',
      language: 'hcl',
      code: `provider "aws" {
  region = "eu-west-1"
}

provider "aws" {
  alias  = "us"
  region = "us-east-1"
}

resource "aws_s3_bucket" "data" {
  bucket = "acme-data"
}`,
    },
    options: [
      { id: 'a', text: 'us-east-1, because the aliased block is more specific' },
      { id: 'b', text: 'eu-west-1, because the unaliased block is the default configuration' },
      { id: 'c', text: 'Both regions, because two provider blocks are declared' },
      { id: 'd', text: 'Neither - the configuration is invalid without a provider meta-argument' },
    ],
    correct: ['b'],
    explanation:
      'A resource with no `provider` meta-argument always uses the default - the unaliased - configuration. Aliases are opt-in, and forgetting the opt-in is a silent failure: the resource is created successfully in the wrong region.',
  },
  {
    id: 'tfq-fund-9',
    domainId: 'tf-fundamentals',
    topicId: 'tf-multiple-providers',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A module needs to create resources in two AWS regions. What must the module and the caller each do?',
    options: [
      {
        id: 'a',
        text: 'The module declares two provider blocks; the caller does nothing',
      },
      {
        id: 'b',
        text: 'The module declares configuration_aliases in required_providers; the caller passes a providers map',
      },
      {
        id: 'c',
        text: 'Nothing special - modules inherit every provider configuration from the caller',
      },
      { id: 'd', text: 'The caller must call the module twice, once per region' },
    ],
    correct: ['b'],
    explanation:
      'Modules inherit only *default* provider configurations. An extra configuration must be declared inside the module with `configuration_aliases = [aws.replica]` and supplied by the caller with `providers = { aws = aws, aws.replica = aws.us }`. A module should never declare its own `provider` block, because that fixes region and credentials for every caller.',
  },
  {
    id: 'tfq-fund-10',
    domainId: 'tf-fundamentals',
    topicId: 'tf-state-introduction',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What is the primary purpose of Terraform state?',
    options: [
      { id: 'a', text: 'To cache provider binaries so plans run faster' },
      { id: 'b', text: 'To map configuration addresses to real-world resource identifiers' },
      { id: 'c', text: 'To store credentials for each configured provider' },
      { id: 'd', text: 'To record the history of every apply for auditing' },
    ],
    correct: ['b'],
    explanation:
      'Configuration says what you want; state says what exists and which real object corresponds to which address. Without it Terraform could not tell "this does not exist yet" from "this exists and needs changing", nor know that a deleted block means "destroy that specific thing".',
  },
  {
    id: 'tfq-fund-11',
    domainId: 'tf-fundamentals',
    topicId: 'tf-state-introduction',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A resource appears in state but no longer appears in the configuration. What does the next plan propose?',
    options: [
      { id: 'a', text: 'Creating it, because the configuration is the source of truth' },
      { id: 'b', text: 'Destroying it' },
      { id: 'c', text: 'No change - Terraform ignores resources absent from configuration' },
      { id: 'd', text: 'An error, because state and configuration disagree' },
    ],
    correct: ['b'],
    explanation:
      'In configuration but not state means create; in state but not configuration means destroy. That is the mechanism behind removing infrastructure. To stop managing something *without* destroying it, use a `removed` block with `destroy = false`, or `terraform state rm`.',
  },
  {
    id: 'tfq-fund-12',
    domainId: 'tf-fundamentals',
    topicId: 'tf-state-introduction',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A configuration generates a database password with `random_password` and exposes it as an output marked `sensitive = true`. Where can the plaintext value be read?',
    options: [
      { id: 'a', text: 'Nowhere - marking it sensitive encrypts it' },
      { id: 'b', text: 'Only in the provider’s own logs' },
      { id: 'c', text: 'In the state file, and in any saved plan file' },
      { id: 'd', text: 'Only by someone with the KMS key used by the backend' },
    ],
    correct: ['c'],
    explanation:
      '`sensitive = true` redacts CLI and plan *display* only. State always stores attribute values in plaintext, and a saved plan file contains resolved values too. The real mitigations are an encrypted remote backend with tight access control, never committing state, and - on Terraform 1.10+ - `ephemeral` values, which are never written to state at all.',
  },
]
