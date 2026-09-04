import type { Topic } from '../../../types'

export const remoteBackends: Topic = {
  id: 'tf-remote-backends',
  title: 'Configuring remote state with the backend block',
  domainId: 'tf-state',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 3,
  tags: [
    'remote state',
    'backend',
    's3',
    'partial configuration',
    'terraform_remote_state',
    'objective-6c',
  ],
  oneLiner:
    'Shared, durable, encrypted state - and how to read one configuration’s outputs from another.',
  explanation: [
    'A **remote backend** stores state somewhere both people and pipelines can reach. That single change gives you sharing, durability independent of any laptop, encryption at rest, version history, and locking.',
    'The `backend` block accepts literal values only, which is a problem when the bucket or key differs per environment. The answer is a **partial configuration**: omit the varying arguments from the file and supply them at init time with `-backend-config`.',
    'Once state is remote, other configurations can read its **outputs** with a `terraform_remote_state` data source. That is how a network configuration hands subnet ids to an application configuration without copy-paste.',
    'The trade-off of remote state is a real dependency: an unreachable backend means you cannot plan at all. That is usually the right trade, but it is a trade.',
  ],
  whyItMatters: [
    'Objective 6c is configuring remote state using the backend block, and partial configuration is the mechanism it expects you to know.',
    'A remote backend is the single highest-value change a team can make to a Terraform setup.',
    '`terraform_remote_state` is how large estates are split into manageable pieces without losing the connections between them.',
  ],
  howItWorks: [
    'Each backend type takes its own arguments. For S3: `bucket`, `key`, `region`, plus `encrypt`, `kms_key_id` and either `use_lockfile` or `dynamodb_table` for locking.',
    'A **partial configuration** omits some arguments. The rest come from `-backend-config=FILE` or `-backend-config=key=value` at `terraform init`. Values supplied this way are not stored in the configuration and so are not committed.',
    'Changing the backend configuration makes the next `init` stop and ask. `-migrate-state` copies existing state across; `-reconfigure` starts with empty state at the new location.',
    'Object versioning on the bucket is what turns "state corrupted" into "restore the previous object version". Enable it.',
    'The `terraform_remote_state` data source reads another configuration’s state and exposes its `outputs`. It needs read access to that state, and it reads the whole state - so it should only be used where you trust the reader.',
    'For HCP Terraform, the `cloud` block replaces `backend`, and the `tfe_outputs` data source is the preferred way to read another workspace’s outputs.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'What a remote backend adds',
      caption:
        'Every row is something the local backend cannot give you, and every row matters as soon as a second person is involved.',
      root: {
        label: 'Remote backend (e.g. S3)',
        tone: 'accent',
        children: [
          { label: 'Shared access', detail: 'People and pipelines read the same state' },
          { label: 'Durability', detail: 'Independent of any one machine' },
          { label: 'Encryption at rest', detail: 'encrypt = true, plus a KMS key you control' },
          { label: 'Version history', detail: 'Bucket versioning turns corruption into a restore' },
          { label: 'Locking', detail: 'use_lockfile, or a DynamoDB table' },
          {
            label: 'Access control',
            detail: 'IAM decides who can read secrets in state',
            tone: 'success',
          },
          {
            label: 'A new dependency',
            detail: 'Backend unreachable means you cannot plan',
            tone: 'warning',
          },
        ],
      },
    },
    {
      kind: 'sequence',
      title: 'Reading another configuration’s outputs',
      caption:
        'This is how a large estate is split without copy-paste. The reader needs read access to the writer’s state.',
      participants: [
        { id: 'app', label: 'App config' },
        { id: 'be', label: 'Backend' },
        { id: 'net', label: 'Network state' },
      ],
      messages: [
        { from: 'app', to: 'be', label: 'read network/terraform.tfstate' },
        { from: 'be', to: 'net', label: 'fetch the object' },
        { from: 'net', to: 'app', label: 'outputs.private_subnet_ids', kind: 'return' },
        { from: 'app', to: 'app', label: 'use them as resource arguments' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'S3 backend arguments',
      purpose: 'The most commonly examined remote backend, and its security-relevant settings.',
      fields: [
        { path: 'bucket', meaning: 'Where state lives. Required.', required: true },
        { path: 'key', meaning: 'The object path. Unique per configuration.', required: true },
        { path: 'region', meaning: 'The bucket’s region. Required.', required: true },
        { path: 'encrypt', meaning: 'Server-side encryption. Set true.', required: true },
        { path: 'kms_key_id', meaning: 'A customer-managed key, for auditable access.' },
        {
          path: 'use_lockfile',
          meaning: 'S3-native locking (Terraform 1.10+). Replaces DynamoDB.',
        },
        { path: 'dynamodb_table', meaning: 'The older locking mechanism. Still widely used.' },
        { path: 'assume_role', meaning: 'Cross-account state access.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'One bucket, one key, two environments',
    story: [
      'A team wanted per-environment backends but could not use variables in the `backend` block. Someone worked around it by keeping two copies of `backend.tf` and switching them with a shell script.',
      'The script had a bug: it left the production backend in place when switching to staging. A staging apply was then planned against production state, and only the plan output - proposing to destroy production resources - stopped it.',
      'Partial configuration is the supported answer. One `backend.tf` with the varying arguments omitted, plus a `.tfbackend` file per environment, means the environment is named explicitly on the command line every single time.',
      'The wider lesson: when a tool seems to be missing a feature, look for the intended mechanism before scripting around it. `-backend-config` existed the whole time.',
    ],
    code: [
      {
        title: 'Partial configuration',
        language: 'hcl',
        code: `# backend.tf - one file, committed, with the varying parts absent.
terraform {
  backend "s3" {
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
    # bucket and key are supplied at init time.
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A production-grade S3 backend',
      language: 'hcl',
      explanation:
        'The four security-relevant lines are `encrypt`, `kms_key_id`, `use_lockfile` and a key that is unique to this configuration.',
      code: `terraform {
  backend "s3" {
    bucket = "acme-tfstate-prod"
    key    = "production/network/terraform.tfstate"
    region = "eu-west-1"

    # Encryption at rest with a key you control and can audit.
    encrypt    = true
    kms_key_id = "arn:aws:kms:eu-west-1:111122223333:key/abcd-1234"

    # Locking without a DynamoDB table (Terraform 1.10+).
    use_lockfile = true

    # Older, still common:
    # dynamodb_table = "acme-tfstate-locks"

    # Cross-account access, if state lives elsewhere.
    # assume_role = {
    #   role_arn = "arn:aws:iam::111122223333:role/terraform-state"
    # }
  }
}`,
    },
    {
      title: 'Partial configuration, per environment',
      language: 'bash',
      explanation:
        'The environment is named on the command line, so it cannot be left over from a previous run. `-reconfigure` is what prevents an accidental cross-environment migration.',
      code: `# staging.s3.tfbackend
bucket = "acme-tfstate-staging"
key    = "network/terraform.tfstate"

# production.s3.tfbackend
bucket = "acme-tfstate-prod"
key    = "network/terraform.tfstate"

# --- Using them:
terraform init -backend-config=staging.s3.tfbackend
terraform plan -var-file=staging.tfvars

# Switching: -reconfigure discards the recorded staging backend
# instead of offering to migrate staging state into production.
terraform init -reconfigure -backend-config=production.s3.tfbackend
terraform plan -var-file=production.tfvars

# Individual values also work:
terraform init \\
  -backend-config="bucket=acme-tfstate-prod" \\
  -backend-config="key=network/terraform.tfstate"

# In CI, never prompt:
terraform init -input=false -backend-config=production.s3.tfbackend`,
    },
    {
      title: 'Reading another configuration’s outputs',
      language: 'hcl',
      explanation:
        'The reader gets the whole state, not just the outputs, so grant this access deliberately. `tfe_outputs` is the narrower equivalent for HCP Terraform.',
      code: `# The network configuration publishes:
# output "private_subnet_ids" { value = [...] }
# output "vpc_id"             { value = aws_vpc.this.id }

# The application configuration reads them:
data "terraform_remote_state" "network" {
  backend = "s3"

  config = {
    bucket = "acme-tfstate-prod"
    key    = "production/network/terraform.tfstate"
    region = "eu-west-1"
  }
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.small"
  subnet_id     = data.terraform_remote_state.network.outputs.private_subnet_ids[0]
}

# Bear in mind: this data source reads the ENTIRE state file,
# including any secrets in it. An alternative that exposes less
# is to publish the values you need to SSM or Secrets Manager
# and read those instead:
data "aws_ssm_parameter" "vpc_id" {
  name = "/production/network/vpc_id"
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform init -backend-config=production.s3.tfbackend',
      what: 'Completes a partial backend configuration at init time.',
    },
    {
      command: 'terraform init -reconfigure -backend-config=staging.s3.tfbackend',
      what: 'Switches backends without offering to migrate state.',
      namespaceNote: 'The safe form when moving between environments.',
    },
    {
      command: 'terraform init -migrate-state',
      what: 'Copies existing state into a newly configured backend.',
      namespaceNote: 'Back up first with `terraform state pull`.',
    },
    {
      command: 'terraform state pull > backup.json',
      what: 'Downloads current state from whatever backend is configured.',
    },
    {
      command: 'aws s3api list-object-versions --bucket acme-tfstate-prod --prefix production/',
      what: 'Lists historical state versions - the recovery path bucket versioning gives you.',
    },
  ],
  declarative: {
    steps: [
      'Use a remote backend for anything more than a personal experiment.',
      'Enable encryption, object versioning and locking on the state store.',
      'Give every configuration a unique `key`.',
      'Use partial configuration plus `-backend-config` for per-environment backends, never a shell script that edits files.',
      'Restrict who can read state with IAM - it contains secrets.',
      'Prefer publishing specific values to a parameter store over `terraform_remote_state` when the consumer should not see everything.',
    ],
    code: [
      {
        title: 'Bootstrapping the state bucket',
        language: 'hcl',
        explanation:
          'The bucket that holds state cannot itself use that bucket for its state - so this configuration is applied once with local state and then usually left alone.',
        code: `# Applied ONCE with local state, then rarely touched.
resource "aws_s3_bucket" "state" {
  bucket = "acme-tfstate-prod"

  lifecycle {
    prevent_destroy = true
  }
}

# Versioning is the difference between "corrupted" and "restore".
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
  }
}

# State contains secrets: nothing public, ever.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform init && terraform state list',
      what: 'Confirms the backend is reachable and holds the expected resources.',
    },
    {
      command: 'aws s3api get-bucket-versioning --bucket acme-tfstate-prod',
      what: 'Confirms the recovery path exists.',
      expected: 'Status: Enabled',
    },
    {
      command: 'aws s3api get-bucket-encryption --bucket acme-tfstate-prod',
      what: 'Confirms encryption at rest is configured.',
    },
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'After a migration, a clean plan is the proof it worked.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports "Backend configuration changed" - choose `-migrate-state` or `-reconfigure` deliberately.',
    },
    {
      command: 'terraform init',
      what: 'Reports access denied - the credentials lack s3:GetObject/PutObject on that key, or KMS decrypt on the key.',
    },
    {
      command: 'terraform plan',
      what: 'Proposes creating everything after a backend change - the new location is empty; you used `-reconfigure`.',
    },
    {
      command: 'aws s3api list-object-versions --bucket B --prefix K',
      what: 'Finds a previous state version to restore after a bad write.',
    },
    {
      command: 'terraform state push backup.json',
      what: 'Restores a downloaded state file. Last resort, and verify with a plan immediately.',
    },
  ],
  commonMistakes: [
    'Trying to use variables in the `backend` block. Use partial configuration and `-backend-config`.',
    'Sharing one `key` between configurations, producing a lineage mismatch or worse.',
    'Forgetting bucket versioning, which removes your only recovery path from a bad state write.',
    'Using `-reconfigure` when you meant `-migrate-state`, leaving state behind and planning to rebuild everything.',
    'Committing a `.tfbackend` file containing anything secret. Bucket names are usually fine; credentials are not.',
    'Granting broad read access to the state bucket. Whoever can read state can read every secret in it.',
    'Using `terraform_remote_state` where the consumer should not see the producer’s secrets.',
  ],
  examTips: [
    'The `backend` block accepts literal values only - no variables, locals or expressions.',
    'A partial configuration omits arguments, supplied at init with `-backend-config=FILE` or `=key=value`.',
    'Changing the backend requires `terraform init` again, with `-migrate-state` or `-reconfigure`.',
    'S3 backend essentials: bucket, key, region, plus encrypt and a locking mechanism.',
    '`terraform_remote_state` reads another configuration’s outputs, and needs read access to its state.',
    'The `cloud` block replaces `backend` for HCP Terraform and is mutually exclusive with it.',
  ],
  summary: [
    'A remote backend gives sharing, durability, encryption, history and locking.',
    'Partial configuration plus `-backend-config` handles per-environment backends.',
    'Give every configuration a unique key, and enable versioning on the bucket.',
    '`terraform_remote_state` connects configurations, and grants full read access to state.',
    'Backend changes always need another `init`, with an explicit migrate or reconfigure.',
  ],
  practice: [
    {
      id: 'tf-remotebe-p1',
      level: 'beginner',
      prompt:
        'Why can a `backend` block not use `var.bucket`, and what is the supported alternative?',
      answer:
        'Because the backend is initialised before variables are evaluated. The alternative is a partial configuration completed with `-backend-config` at init time.',
      explanation:
        'The same restriction applies to `required_version` and `required_providers`, for the same reason.',
    },
    {
      id: 'tf-remotebe-p2',
      level: 'beginner',
      prompt: 'Name four things a remote backend gives you that the local backend does not.',
      answer:
        'Sharing between people and pipelines, durability independent of one machine, encryption at rest, and version history. Locking across machines is a fifth.',
      explanation: 'Together these are why remote state is the norm for anything a team touches.',
    },
    {
      id: 'tf-remotebe-p3',
      level: 'intermediate',
      prompt:
        'You switch from staging to production using `-reconfigure`. A plan then proposes creating everything. What happened?',
      answer:
        'Nothing is wrong with production - the new backend location is genuinely empty because `-reconfigure` does not copy state. Either production state is at a different key than you configured, or production has never been applied.',
      explanation:
        'Check the `key` first. `-reconfigure` is correct when switching between environments; it would be wrong when genuinely moving one environment’s state.',
    },
    {
      id: 'tf-remotebe-p4',
      level: 'advanced',
      prompt:
        'What is the security consideration when using `terraform_remote_state`, and what is a narrower alternative?',
      answer:
        'The data source reads the entire state file, including every secret in it - not just the outputs. Anyone who can run the consuming configuration effectively has read access to the producer’s secrets. A narrower alternative is for the producer to publish specific values to SSM Parameter Store or Secrets Manager, and for the consumer to read those with per-parameter IAM.',
      explanation:
        'On HCP Terraform, the `tfe_outputs` data source is the narrower equivalent: it exposes only the workspace’s declared outputs.',
    },
  ],
  lab: {
    title: 'Partial configuration without a cloud account',
    scenario:
      'Use two local backends as stand-ins for two environments to practise partial configuration, `-reconfigure` and `terraform_remote_state`.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `backend "local"` block that omits `path`, plus two `.tfbackend` files supplying different paths.',
      },
      { instruction: 'Init with the first backend file, apply, and confirm where state landed.' },
      {
        instruction:
          'Init with the second backend file WITHOUT `-reconfigure` and read what Terraform asks you.',
      },
      {
        instruction: 'Answer "no", then run a plan. Explain why it proposes creating everything.',
      },
      {
        instruction:
          'Init back to the first backend with `-reconfigure` and confirm the original state is intact.',
      },
      {
        instruction:
          'Apply in the second backend too, so both have state, and confirm the two are independent.',
      },
      {
        instruction:
          'In a third directory, add a `terraform_remote_state` data source reading the first backend’s state, and output one of its values.',
      },
      {
        instruction:
          'Confirm the consumer can see the producer’s outputs, and inspect the state file to see that everything else is readable too.',
      },
      { instruction: 'Clean up all three directories.' },
    ],
    solution: [
      {
        title: 'producer/main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local  = { source = "hashicorp/local", version = "~> 2.5" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # Partial configuration: path comes from -backend-config.
  backend "local" {}
}

resource "random_pet" "name" {
  length = 2
}

resource "local_file" "marker" {
  filename = "\${path.module}/marker.txt"
  content  = "\${random_pet.name.id}\\n"
}

output "pet_name" {
  value = random_pet.name.id
}

# A secret, to demonstrate what a remote-state reader can see.
resource "random_password" "secret" {
  length = 16
}`,
      },
      {
        title: 'The backend files and the consumer',
        language: 'hcl',
        code: `# producer/alpha.tfbackend
# path = "state-alpha/terraform.tfstate"

# producer/beta.tfbackend
# path = "state-beta/terraform.tfstate"

# consumer/main.tf
data "terraform_remote_state" "producer" {
  backend = "local"

  config = {
    path = "../producer/state-alpha/terraform.tfstate"
  }
}

output "pet_from_producer" {
  value = data.terraform_remote_state.producer.outputs.pet_name
}`,
      },
      {
        title: 'The run',
        language: 'bash',
        code: `cd producer
terraform init -backend-config=alpha.tfbackend
terraform apply -auto-approve
ls state-alpha/terraform.tfstate
terraform output pet_name

# Switching WITHOUT -reconfigure:
terraform init -backend-config=beta.tfbackend
#   Do you want to copy existing state to the new backend?
#   Enter a value: no
terraform plan
# Plan: 3 to add.  The beta backend is empty - "no" meant
# "start with empty state".

# Back to alpha, safely:
terraform init -reconfigure -backend-config=alpha.tfbackend
terraform plan            # No changes. Nothing was lost.

# Give beta its own state:
terraform init -reconfigure -backend-config=beta.tfbackend
terraform apply -auto-approve
jq -r .lineage state-alpha/terraform.tfstate state-beta/terraform.tfstate
# Different lineages: independent states.

# The consumer:
cd ../consumer
terraform init && terraform apply -auto-approve
terraform output pet_from_producer

# What else the consumer could have read:
jq -r '.resources[] | select(.type=="random_password")
       | .instances[].attributes.result' \\
  ../producer/state-alpha/terraform.tfstate
# The password is right there. terraform_remote_state grants
# access to the WHOLE state, not just the outputs.`,
      },
    ],
    verification: [
      {
        command: 'terraform output -raw pet_from_producer',
        what: 'Confirms the consumer read the producer’s output.',
      },
      {
        command:
          'jq -r .lineage ../producer/state-alpha/terraform.tfstate ../producer/state-beta/terraform.tfstate',
        what: 'Confirms the two backends hold independent state.',
      },
    ],
    cleanup: [
      {
        command:
          'cd consumer && terraform destroy -auto-approve; cd ../producer && terraform init -reconfigure -backend-config=alpha.tfbackend && terraform destroy -auto-approve && cd .. && rm -rf producer consumer',
        what: 'Destroys both and removes the lab directories.',
      },
    ],
  },
  relatedTopicIds: ['tf-state-locking', 'tf-local-backend', 'tf-outputs'],
  docs: [
    {
      title: 'Backend configuration',
      url: 'https://developer.hashicorp.com/terraform/language/backend',
    },
    {
      title: 'terraform_remote_state data source',
      url: 'https://developer.hashicorp.com/terraform/language/state/remote-state-data',
    },
  ],
}
