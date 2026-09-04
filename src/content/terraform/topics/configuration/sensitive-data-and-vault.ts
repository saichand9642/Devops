import type { Topic } from '../../../types'

export const sensitiveDataAndVault: Topic = {
  id: 'tf-sensitive-data-and-vault',
  title: 'Managing sensitive data, including Vault',
  domainId: 'tf-configuration',
  difficulty: 'advanced',
  estimatedMinutes: 17,
  order: 10,
  tags: ['sensitive', 'secrets', 'vault', 'state encryption', 'ephemeral', 'objective-4h'],
  oneLiner:
    'Where secrets leak in Terraform, what `sensitive` actually protects, and how Vault changes the picture.',
  explanation: [
    'Terraform has one unavoidable property: **anything it manages ends up in state, in plaintext**. A generated password, a private key, a connection string - all of it. `sensitive = true` changes what is displayed, not what is stored.',
    'So the practical question is never "how do I hide this secret from Terraform" but "how do I minimise what passes through Terraform at all, and how do I protect what must".',
    'The three defences, in order of effectiveness: **keep the secret out of state** (reference it rather than create it), **protect state** (encrypted remote backend, tight access control), and **redact display** (`sensitive = true`, so nothing leaks into logs and terminals).',
    '**Vault** helps mainly with the first: a `vault_generic_secret` data source reads a secret at plan time so it never needs to live in your repository. But the value it returns *does* enter state, so Vault reduces the exposure surface rather than eliminating it. Dynamic, short-lived credentials are what genuinely fix it, because a leaked value expires.',
  ],
  whyItMatters: [
    'Objective 4h is explicitly about best practices for sensitive data including Vault, and the state-plaintext fact is the single most examined point.',
    'This is also the area where a misunderstanding causes real harm: teams mark a variable sensitive, believe the job is done, and commit state to a repository.',
    'Knowing which defence solves which problem lets you make a proportionate decision rather than an anxious one.',
  ],
  howItWorks: [
    '`sensitive = true` on a variable or output redacts it from CLI output, plan display and error messages. State and saved plan files still contain the plaintext.',
    'Sensitivity **propagates**: any expression containing a sensitive value becomes sensitive, and Terraform errors if you publish it without marking it. `nonsensitive()` is the deliberate escape hatch.',
    'Provider arguments that a provider marks sensitive are redacted automatically - you do not need to do anything for a `password` field.',
    'State protection is a backend concern: S3 with SSE and bucket policies, Azure Storage with encryption, HCP Terraform (which encrypts state and never exposes it via the API to unauthorised users).',
    'The Vault provider offers data sources for reading secrets and resources for writing them. A read at plan time keeps the value out of your repository, though not out of state.',
    'Terraform 1.10 introduced **ephemeral values** - variables, resources and outputs marked `ephemeral` are not persisted to state at all. This is the first mechanism that genuinely keeps a value out of state, and it is the direction the ecosystem is moving.',
    'Provisioner and `local-exec` command lines are a classic leak: they can appear in logs even when the value is marked sensitive.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Where a secret can leak',
      caption:
        'Only the last box is fixed by sensitive = true. The first three need different defences.',
      nodes: [
        {
          label: 'The repository',
          detail: 'A committed tfvars file or a hard-coded string',
          tone: 'danger',
          branch: {
            label: 'Fix',
            detail: 'TF_VAR_ from a secret store, or a Vault data source',
          },
        },
        {
          label: 'The state file',
          detail: 'Plaintext, always, regardless of the sensitive flag',
          tone: 'danger',
          branch: {
            label: 'Fix',
            detail: 'Encrypted remote backend, tight IAM, or ephemeral values',
          },
        },
        {
          label: 'A saved plan file',
          detail: 'Contains resolved values in cleartext',
          tone: 'warning',
          branch: {
            label: 'Fix',
            detail: 'Treat it as a secret; short-lived CI artefact only',
          },
        },
        {
          label: 'CLI output and CI logs',
          detail: 'Plan display, outputs, error messages',
          arrowLabel: 'the visible leak',
          branch: {
            label: 'Fix',
            detail: 'sensitive = true - this is the one it solves',
            tone: 'success',
          },
        },
      ],
    },
    {
      kind: 'decision',
      title: 'How should this secret be handled?',
      caption: 'The best answer is always the one where Terraform never sees the value.',
      question: 'Who needs to know the value?',
      branches: [
        {
          condition: 'only the running application',
          result: 'Never pass it through Terraform',
          detail: 'Terraform creates the secret reference; the app reads it at runtime',
          tone: 'accent',
        },
        {
          condition: 'Terraform, to configure a resource',
          result: 'Read it from Vault or an env var',
          detail: 'Marked sensitive, and state protected',
        },
        {
          condition: 'Terraform, and it can be short-lived',
          result: 'Dynamic credentials',
          detail: 'A leaked value that expires in an hour is a smaller problem',
        },
        {
          condition: 'Terraform, and it must not enter state',
          result: 'An ephemeral value (1.10+)',
          detail: 'The only mechanism that truly keeps it out of state',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Sensitivity mechanisms',
      purpose: 'What each one actually does, and what it does not.',
      fields: [
        {
          path: 'sensitive = true (variable or output)',
          meaning: 'Redacts display. State still holds plaintext.',
          required: true,
        },
        { path: 'sensitive(expr)', meaning: 'Marks a value sensitive explicitly.' },
        { path: 'nonsensitive(expr)', meaning: 'Removes the mark. Use deliberately and rarely.' },
        {
          path: 'ephemeral = true (Terraform 1.10+)',
          meaning: 'The value is never written to state at all.',
          required: true,
        },
        {
          path: 'Backend encryption',
          meaning: 'Where state protection actually lives - SSE, KMS, access policies.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The state file in the pull request',
    story: [
      'A team new to Terraform committed `terraform.tfstate` so that "everyone has the same state". The configuration created an RDS instance with a `random_password`.',
      'The password appeared in the state file in plaintext. It was in the repository, in the fork every contractor had, and in the CI cache. The variable was marked `sensitive = true` throughout, which is why nobody noticed - the plan output never showed it.',
      'Rotating the password was straightforward. Auditing who had cloned the repository in the preceding four months was not, and the git history had to be rewritten.',
      'The correction was three changes: a remote backend with encryption, `terraform.tfstate` in `.gitignore`, and moving the password into Secrets Manager so Terraform only ever handled its ARN.',
    ],
    code: [
      {
        title: 'The pattern that keeps the value out of Terraform',
        language: 'hcl',
        code: `# Terraform creates the SECRET CONTAINER, not the secret value.
resource "aws_secretsmanager_secret" "db" {
  name = "prod/db/password"
}

# The value is generated and rotated outside Terraform, or by
# a rotation lambda. Terraform never sees it.
resource "aws_secretsmanager_secret_rotation" "db" {
  secret_id           = aws_secretsmanager_secret.db.id
  rotation_lambda_arn = aws_lambda_function.rotate.arn

  rotation_rules {
    automatically_after_days = 30
  }
}

# The application is told WHERE the secret is, not what it is.
resource "aws_ecs_task_definition" "app" {
  family = "app"

  container_definitions = jsonencode([{
    name = "app"
    secrets = [{
      name      = "DB_PASSWORD"
      valueFrom = aws_secretsmanager_secret.db.arn
    }]
  }])
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Reading a secret from Vault',
      language: 'hcl',
      explanation:
        'This keeps the secret out of the repository. It does NOT keep it out of state - the returned value is stored there like any other data source result.',
      code: `terraform {
  required_providers {
    vault = { source = "hashicorp/vault", version = "~> 4.3" }
  }
}

provider "vault" {
  # Address and token come from VAULT_ADDR and VAULT_TOKEN.
  # In CI, prefer a short-lived token from a JWT/OIDC auth method.
}

# KV version 2.
data "vault_kv_secret_v2" "db" {
  mount = "secret"
  name  = "prod/database"
}

resource "aws_db_instance" "main" {
  identifier     = "prod-db"
  engine         = "postgres"
  instance_class = "db.t3.medium"
  username       = data.vault_kv_secret_v2.db.data["username"]
  # Marked sensitive by the provider automatically.
  password       = data.vault_kv_secret_v2.db.data["password"]

  allocated_storage = 20
  skip_final_snapshot = false
}

# Dynamic, short-lived AWS credentials: the value still enters
# state, but it expires, which is the real mitigation.
data "vault_aws_access_credentials" "deploy" {
  backend = "aws"
  role    = "terraform-deploy"
  type    = "sts"
}

provider "aws" {
  alias      = "vault_creds"
  region     = "eu-west-1"
  access_key = data.vault_aws_access_credentials.deploy.access_key
  secret_key = data.vault_aws_access_credentials.deploy.secret_key
  token      = data.vault_aws_access_credentials.deploy.security_token
}`,
    },
    {
      title: 'Ephemeral values: the value that never reaches state',
      language: 'hcl',
      explanation:
        'Available from Terraform 1.10. This is the first mechanism that genuinely keeps a secret out of state, rather than protecting it once it is there.',
      code: `# An ephemeral variable exists only for the duration of one run.
variable "vault_token" {
  type      = string
  ephemeral = true
  sensitive = true
}

# An ephemeral resource is created, used and discarded.
ephemeral "random_password" "session" {
  length = 32
}

# Ephemeral values may only be used where they are not persisted:
# provider configuration, provisioner arguments, other ephemeral
# values, and write-only resource arguments.
provider "vault" {
  token = var.vault_token
}

# Terraform ERRORS if you try to write an ephemeral value into a
# resource argument that would be stored in state:
# resource "local_file" "leak" {
#   content = ephemeral.random_password.session.result
# }
# Error: Invalid use of ephemeral value`,
    },
    {
      title: 'A protected backend, and what to gitignore',
      language: 'hcl',
      explanation:
        'This is where secret protection actually happens. Encryption at rest, a customer-managed key, and access control on the bucket.',
      code: `terraform {
  backend "s3" {
    bucket = "acme-tfstate-prod"
    key    = "database/terraform.tfstate"
    region = "eu-west-1"

    # Encryption at rest with a key you control and can audit.
    encrypt    = true
    kms_key_id = "arn:aws:kms:eu-west-1:111122223333:key/abcd-1234"

    # State locking without a DynamoDB table (Terraform 1.10+).
    use_lockfile = true
  }
}

# .gitignore
# *.tfstate            - plaintext secrets
# *.tfstate.*          - including the backup
# *.tfvars             - variable values are usually secrets
# tfplan               - saved plans contain resolved secrets
# .terraform/`,
    },
  ],
  imperative: [
    {
      command: 'terraform output',
      what: 'Sensitive outputs show as (sensitive value) rather than the value.',
    },
    {
      command: 'terraform output -raw db_password',
      what: 'Reveals a sensitive output deliberately - the redaction is a guard, not access control.',
    },
    {
      command: "terraform state pull | jq -r '.resources[].instances[].attributes | keys[]'",
      what: 'Shows every attribute stored in state. Sobering the first time you run it.',
    },
    {
      command: 'grep -c "password" terraform.tfstate',
      what: 'Demonstrates the central point of this lesson on your own state file.',
    },
    {
      command: 'vault kv get -field=password secret/prod/database',
      what: 'Reads a secret from Vault outside Terraform, e.g. to set TF_VAR_.',
    },
  ],
  declarative: {
    steps: [
      'Prefer designs where Terraform handles a secret *reference* rather than the secret itself.',
      'Never commit state, tfvars or saved plan files.',
      'Use an encrypted remote backend with a customer-managed key and least-privilege access.',
      'Mark every secret variable and output `sensitive = true` so nothing leaks into logs.',
      'Prefer short-lived dynamic credentials over long-lived ones, so a leak has a deadline.',
      'On Terraform 1.10 or newer, use `ephemeral` for values that must never reach state.',
    ],
    code: [
      {
        title: 'The provisioner leak',
        language: 'hcl',
        explanation:
          'Provisioners are the one place a sensitive value routinely escapes redaction, because the command line itself may be logged by the OS or the CI runner.',
        code: `# RISKY: the password may appear in shell history, process
# listings and CI logs, even though Terraform redacts its own
# output.
# resource "null_resource" "seed" {
#   provisioner "local-exec" {
#     command = "psql -c \\"ALTER USER app PASSWORD '\${var.db_password}'\\""
#   }
# }

# BETTER: pass it through the environment, which is not logged
# as part of the command line.
resource "null_resource" "seed" {
  provisioner "local-exec" {
    command = "./seed.sh"

    environment = {
      PGPASSWORD = var.db_password
    }
  }
}

# BEST: do not use a provisioner. Let the application read the
# secret from the secret store at startup.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan | grep -i "sensitive value"',
      what: 'Confirms secrets are redacted in plan output.',
    },
    {
      command: "terraform show -json | jq '.values.outputs | map_values(.sensitive)'",
      what: 'Lists which outputs are marked sensitive.',
    },
    {
      command: 'aws s3api get-bucket-encryption --bucket acme-tfstate-prod',
      what: 'Verifies state encryption at rest is actually configured.',
    },
    {
      command: 'git check-ignore -v terraform.tfstate',
      what: 'Confirms state cannot be committed by accident.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform apply',
      what: 'Reports "Output refers to sensitive values" - add `sensitive = true` to the output.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Invalid use of ephemeral value" - you tried to store one in state.',
    },
    {
      command: 'terraform plan',
      what: 'Reports a Vault permission error - the token lacks a policy for that path.',
    },
    {
      command: 'terraform output -raw <name>',
      what: 'Retrieves a value you need after `terraform output` redacted it.',
    },
  ],
  commonMistakes: [
    'Believing `sensitive = true` encrypts anything. It redacts display only.',
    'Committing `terraform.tfstate`, `*.tfvars` or a saved plan file.',
    'Interpolating a secret into a provisioner command line, where it can be logged by the OS or the runner.',
    'Using `nonsensitive()` to silence an error rather than to publish something genuinely non-secret.',
    'Assuming Vault removes the problem. A Vault data source keeps the secret out of your repository, not out of state.',
    'Using long-lived static credentials in CI when the platform supports OIDC and short-lived ones.',
    'Generating a password with `random_password` and treating it as safe because it never appears in a file - it is in state.',
  ],
  examTips: [
    'State is always plaintext. `sensitive = true` affects display only. This is the key fact for objective 4h.',
    'Sensitivity propagates through expressions; `nonsensitive()` removes the mark.',
    'Saved plan files also contain resolved sensitive values.',
    'Best practices: an encrypted remote backend, no state in version control, secrets from an external store, short-lived credentials.',
    'The Vault provider offers data sources for reading secrets and can issue dynamic, short-lived cloud credentials.',
    '`ephemeral` values (Terraform 1.10+) are the only mechanism that keeps a value out of state entirely.',
  ],
  summary: [
    'Everything Terraform manages is in state in plaintext.',
    '`sensitive` stops leaks into logs and terminals; it protects nothing at rest.',
    'Real protection is an encrypted backend plus access control, and keeping values out of state where possible.',
    'Vault keeps secrets out of your repository and can issue short-lived credentials.',
    '`ephemeral` values are the first genuine "never persisted" mechanism.',
  ],
  practice: [
    {
      id: 'tf-secrets-p1',
      level: 'beginner',
      prompt:
        'A variable is marked `sensitive = true`. Where can its value still be read in plaintext?',
      answer: 'In the state file, and in any saved plan file.',
      explanation:
        'This is the most examined fact in objective 4h, and the one that causes real incidents when misunderstood.',
    },
    {
      id: 'tf-secrets-p2',
      level: 'beginner',
      prompt: 'Name three practices that genuinely protect secrets in a Terraform workflow.',
      answer:
        'An encrypted remote backend with least-privilege access; never committing state, tfvars or plan files; and sourcing secrets from an external store such as Vault rather than the repository.',
      explanation:
        'Short-lived dynamic credentials and `ephemeral` values are the two further steps that reduce exposure rather than just protecting it.',
    },
    {
      id: 'tf-secrets-p3',
      level: 'intermediate',
      prompt: 'Does reading a secret from a Vault data source keep it out of the state file?',
      answer:
        'No. The returned value is stored in state like any other data source result. Vault keeps it out of your repository and lets you rotate and audit it centrally.',
      explanation:
        'The mitigation that does help is dynamic short-lived credentials: the value in state expires, so a leaked state file has a limited window of usefulness.',
    },
    {
      id: 'tf-secrets-p4',
      level: 'advanced',
      prompt:
        'Why is `random_password` in a resource argument still a state exposure, and what is the architectural alternative?',
      answer:
        'Because the generated value is stored in state in plaintext, so anyone who can read state has the password. The alternative is for Terraform to create the secret container and grant access to it, while the value is generated and rotated by the platform - Terraform then only ever handles an ARN or a secret name.',
      explanation:
        'This is the general principle: pass references through Terraform, not values. It also makes rotation possible without a Terraform run.',
    },
  ],
  lab: {
    title: 'Find your own secret in state',
    scenario:
      'Generate a password, mark everything sensitive, confirm the CLI hides it, then find it in plaintext in the state file - and fix the exposure properly.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `random_password` and an output marked `sensitive = true`.',
      },
      { instruction: 'Apply, then run `terraform output` and confirm the value is redacted.' },
      {
        instruction:
          'Run `terraform output -raw` on it and note that the redaction is easily bypassed by anyone who can run Terraform.',
      },
      {
        instruction:
          'Find the password in `terraform.tfstate` using jq or grep. This is the point of the lab.',
      },
      {
        instruction:
          'Add a second output that embeds the password in a connection string WITHOUT `sensitive`, and read the error.',
      },
      {
        instruction:
          'Save a plan with `-out=tfplan`, convert it with `terraform show -json`, and find the password in that too.',
      },
      {
        instruction:
          'Write the password into a `local_sensitive_file` and compare the file permissions with those of a plain `local_file`.',
      },
      {
        instruction:
          'If you are on Terraform 1.10 or newer, convert the password to an `ephemeral` resource and confirm Terraform refuses to store it - then confirm it is absent from state.',
      },
      { instruction: 'Destroy and remove every artefact, including the plan file.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
    local  = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

resource "random_password" "db" {
  length  = 32
  special = true
}

output "password" {
  value     = random_password.db.result
  sensitive = true
}

# A derived value is sensitive too - omitting the flag here is
# an error, which is the language protecting you.
output "connection_string" {
  value     = "postgres://app:\${random_password.db.result}@db.internal:5432/app"
  sensitive = true
}

# 0600 permissions, unlike local_file which is world-readable.
resource "local_sensitive_file" "secret" {
  filename = "\${path.module}/secret.txt"
  content  = random_password.db.result
}`,
      },
      {
        title: 'Finding the leak',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

terraform output
# connection_string = <sensitive>
# password          = <sensitive>

# The redaction is a guard, not access control:
terraform output -raw password

# Now find it in state, in plaintext:
jq -r '.resources[]
       | select(.type == "random_password")
       | .instances[].attributes.result' terraform.tfstate

# And in a saved plan:
terraform plan -out=tfplan
terraform show -json tfplan | grep -o "$(terraform output -raw password)" | head -1
# The plan file is a secret too.

# File permissions differ:
stat -c '%a %n' secret.txt        # 600 from local_sensitive_file

# Omit sensitive = true on connection_string and:
terraform apply
# Error: Output refers to sensitive values

# Terraform 1.10+: ephemeral values are never persisted.
#   ephemeral "random_password" "session" { length = 32 }
#   resource "local_file" "leak" {
#     content = ephemeral.random_password.session.result
#   }
# Error: Invalid use of ephemeral value - it cannot be written
# to a resource argument that is persisted in state.

terraform destroy -auto-approve
rm -f tfplan secret.txt`,
      },
    ],
    verification: [
      {
        command:
          "jq -r '[.resources[].instances[].attributes.result] | map(select(. != null)) | length' terraform.tfstate",
        what: 'Counts plaintext generated secrets in state.',
        expected: '1 - before you destroy',
      },
      {
        command: "stat -c '%a' secret.txt",
        what: 'Confirms local_sensitive_file restricts permissions.',
        expected: '600',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f tfplan secret.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes every artefact containing the secret, including state and plan files.',
      },
    ],
  },
  relatedTopicIds: ['tf-input-variables', 'tf-outputs', 'tf-remote-backends'],
  docs: [
    {
      title: 'Sensitive data in state',
      url: 'https://developer.hashicorp.com/terraform/language/state/sensitive-data',
    },
    {
      title: 'Ephemeral values',
      url: 'https://developer.hashicorp.com/terraform/language/values/ephemeral',
    },
  ],
}
