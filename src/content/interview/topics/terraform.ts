import type { InterviewTopic } from '../../types'

export const terraformTopic: InterviewTopic = {
  id: 'terraform',
  title: 'Terraform & IaC',
  shortTitle: 'Terraform',
  icon: '🏗️',
  order: 6,
  oneLiner:
    'State, modules, the plan/apply loop, drift and the team-workflow questions that separate users from designers.',
  headlines: [
    'State maps your configuration addresses to real resource IDs. Without it Terraform cannot tell "create" from "change".',
    'State is stored in **plaintext** and contains secrets. `sensitive = true` only hides values from CLI output.',
    'A plan is a three-way diff: configuration, state, and refreshed reality.',
    '`-/+` in a plan means destroy and recreate. Read those lines every time.',
    '`terraform state rm` forgets a resource; it does **not** destroy it.',
    'There is no rollback. State is written as work completes, so a failed apply is resumable.',
  ],
  questions: [
    {
      id: 'itv-tf-1',
      level: 'basic',
      kind: 'open',
      prompt: 'What is Terraform state and why does it exist?',
      probing:
        'If you cannot explain state you cannot explain anything else about Terraform. It is the first real question.',
      answer: [
        'State is Terraform’s record of what it manages. It maps each address in your configuration - `aws_instance.web` - to the real resource identifier in the provider - `i-0abc123`.',
        'It exists because configuration alone cannot answer two questions: does this resource already exist, and which real object corresponds to this block? Without state, Terraform would have to discover and match every resource on every run, and it could never know that a block you **deleted** means "destroy that specific thing".',
        'It also caches attribute values the provider computed - IDs, ARNs, endpoints - so one resource can reference another’s generated values, and it records dependencies so destroy happens in the right order even after you remove the code.',
        'The practical consequence is that state is critical data. Lose it and your infrastructure still runs, but Terraform no longer knows about any of it and will propose creating everything again.',
      ],
      deeper: [
        'State is stored **unencrypted** and contains every attribute value, including database passwords. That is why it belongs in a remote backend with encryption at rest and tight access control, never in Git.',
        'The three-way nature of a plan follows from this: Terraform compares your configuration (desired), your state (last known) and a refresh of reality. In configuration but not state means create; in state but not configuration means destroy.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'What a plan does, by where a resource appears',
          caption: 'Four combinations, four outcomes. This is the whole of plan behaviour.',
          question: 'Is the resource in the configuration, in state, or both?',
          branches: [
            {
              condition: 'in configuration, not in state',
              result: 'Create',
              detail: 'Terraform has never made this',
              tone: 'accent',
            },
            {
              condition: 'in both, and matching',
              result: 'No change',
              detail: 'The idempotent case',
            },
            {
              condition: 'in both, but different',
              result: 'Update, or replace',
              detail: 'Depends whether the field forces replacement',
            },
            {
              condition: 'in state, not in configuration',
              result: 'Destroy',
              detail: 'You deleted the block, so the resource goes',
              tone: 'warning',
            },
          ],
        },
      ],
      traps: [
        'Saying state "controls" infrastructure. It records; it does not control. Deleting state orphans resources rather than destroying them.',
        'Committing state to Git. It holds plaintext secrets and cannot be merged.',
      ],
      followUps: [
        'What happens if you lose the state file?',
        'Why should state never be in version control?',
        'Are secrets in state encrypted?',
      ],
      tags: ['state', 'fundamentals'],
    },
    {
      id: 'itv-tf-2',
      level: 'basic',
      kind: 'mcq',
      prompt: 'What does `terraform state rm aws_instance.web` do?',
      options: [
        { id: 'a', text: 'Destroys the EC2 instance and removes it from state' },
        { id: 'b', text: 'Removes it from state; the instance keeps running, unmanaged' },
        { id: 'c', text: 'Marks it for replacement on the next apply' },
        { id: 'd', text: 'Removes the resource block from the configuration file' },
      ],
      correct: ['b'],
      probing:
        'A destructive-sounding command that is not destructive. Getting it wrong in production is expensive in both directions.',
      answer: [
        'It removes the resource from **state only**. The real EC2 instance keeps running and keeps costing money - Terraform simply stops knowing about it.',
        'A subsequent `terraform plan` will propose **creating** it, because from Terraform’s point of view it does not exist. You then have two instances.',
        'The legitimate use is handing a resource to another team or another state file, or removing something you want to manage by hand from now on.',
        'To actually destroy something, remove its block from the configuration and apply, or use `terraform destroy -target`. To stop managing it without destroying it, the modern declarative way is a `removed` block with `lifecycle { destroy = false }`, which is reviewable in a pull request rather than being a command someone ran once.',
      ],
      code: [
        {
          title: 'The three different intentions',
          language: 'hcl',
          code: `# Stop managing it, keep it running - declarative and reviewable
removed {
  from = aws_instance.web
  lifecycle {
    destroy = false
  }
}

# Destroy it - just delete the resource block and apply.

# Take over something that already exists
import {
  to = aws_instance.web
  id = "i-0abc123def456"
}`,
        },
      ],
      traps: [
        'Running `state rm` expecting a delete. You end up paying for an orphaned resource nobody is tracking.',
      ],
      followUps: [
        'How would you actually destroy just one resource?',
        'How do you bring an existing resource under management?',
      ],
      tags: ['state', 'cli', 'safety'],
    },
    {
      id: 'itv-tf-3',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do you manage Terraform state for a team? What problems does that solve?',
      probing: 'Everyday practice. Local state on laptops is a real and common failure mode.',
      answer: [
        'State goes in a **remote backend** - S3, Azure Storage, GCS, or HCP Terraform. That immediately solves four problems that local state cannot.',
        '**Sharing**: everyone and every pipeline reads the same state, so two people do not each think they own the infrastructure.',
        '**Locking**: the backend takes a lock for any operation that writes state. Without it, two simultaneous applies each read the same state, each make changes, and one set is silently lost - with no error anywhere.',
        '**Durability and history**: state survives a laptop being reimaged, and with object versioning enabled a bad write is a restore rather than a disaster.',
        '**Encryption and access control**: state holds secrets, so it needs encryption at rest and IAM restricting who can read it.',
        'Beyond that, I would split state by blast radius - networking separate from applications, and per environment - so a mistake in one cannot destroy another, and so plans stay fast.',
      ],
      code: [
        {
          title: 'A production S3 backend',
          language: 'hcl',
          explanation:
            'The four lines that matter are `key` (unique per configuration), `encrypt`, the KMS key, and a locking mechanism.',
          code: `terraform {
  backend "s3" {
    bucket = "acme-tfstate-prod"
    key    = "production/network/terraform.tfstate"   # unique per config
    region = "eu-west-1"

    encrypt    = true
    kms_key_id = "arn:aws:kms:eu-west-1:111122223333:key/abcd-1234"

    use_lockfile = true      # S3-native locking (Terraform 1.10+)
    # dynamodb_table = "tfstate-locks"   # the older mechanism
  }
}`,
        },
        {
          title: 'One configuration, several environments',
          language: 'bash',
          explanation:
            'The backend block cannot use variables, so a partial configuration plus `-backend-config` is the supported way to switch environments.',
          code: `# backend.tf omits bucket and key; they come from a file per environment.

terraform init -backend-config=staging.s3.tfbackend
terraform plan -var-file=staging.tfvars

# -reconfigure discards the recorded staging backend rather than
# offering to migrate staging state into production.
terraform init -reconfigure -backend-config=production.s3.tfbackend`,
        },
      ],
      traps: [
        'Running a shared S3 backend with no locking at all. Two overlapping applies then silently lose one set of changes.',
        'One giant state file for everything. Slow plans, and one mistake can affect the entire estate.',
        'Trying to put variables in the `backend` block - it is evaluated before variables exist.',
      ],
      followUps: [
        'What happens if two people apply at the same time without locking?',
        'How would you split state, and on what boundary?',
        'Why can the backend block not use variables?',
      ],
      tags: ['state', 'backend', 'teams', 'locking'],
    },
    {
      id: 'itv-tf-4',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain count versus for_each. When would you use each?',
      probing:
        'The single most useful practical distinction in Terraform, with a real operational consequence.',
      answer: [
        '`count = N` creates N instances addressed by **number**: `aws_instance.web[0]`, `[1]`, `[2]`. `for_each` takes a **map or a set of strings** and creates one instance per element, addressed by **key**: `aws_instance.web["api"]`.',
        'The practical difference is **identity**. Under `count`, a resource’s identity is its position in the list. Remove an element from the middle and everything after it shifts down - so Terraform sees different resources at those addresses and **destroys and recreates them**.',
        'Under `for_each`, identity is the key, which does not move. Removing one element affects exactly that one resource.',
        'So: use `for_each` whenever the instances are distinguishable - named users, named subnets, named buckets. Use `count` only for genuinely identical copies, or as the idiomatic on/off switch: `count = var.enabled ? 1 : 0`.',
        'I have seen the `count` version cause a real incident: removing one IAM user from the middle of a list recreated the two after it, which rotated their access keys and broke two pipelines.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Removing the first of three names',
          caption: 'This single behaviour is why for_each is the default recommendation.',
          nodes: [
            {
              label: 'Three resources exist',
              detail: 'count: [0]=alice [1]=bob [2]=carol',
            },
            {
              label: 'You remove "alice"',
              detail: 'A one-line change to your intent',
              tone: 'accent',
            },
            {
              label: 'With count: positions shift',
              detail: '[0] becomes bob, [1] becomes carol',
              arrowLabel: 'identity is the index',
              branch: {
                label: 'Result: 2 replaced, 1 destroyed',
                detail: 'Terraform rebuilds bob and carol for no reason',
              },
            },
            {
              label: 'With for_each: keys never move',
              detail: '["bob"] and ["carol"] keep their addresses',
              arrowLabel: 'identity is the key',
            },
            {
              label: 'Result: exactly 1 destroyed',
              detail: 'What you actually asked for',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Both, and migrating between them',
          language: 'hcl',
          code: `# Fragile - positional identity
resource "aws_iam_user" "by_count" {
  count = length(var.usernames)
  name  = var.usernames[count.index]
}

# Stable - keyed identity
resource "aws_iam_user" "team" {
  for_each = toset(var.usernames)
  name     = each.value
}

# The on/off switch, which is what count is genuinely good for
resource "aws_cloudwatch_dashboard" "prod_only" {
  count          = var.environment == "production" ? 1 : 0
  dashboard_name = "prod-overview"
  dashboard_body = jsonencode(local.dashboard)
}

# Migrating without destroying anything: one moved block per instance
moved {
  from = aws_iam_user.by_count[0]
  to   = aws_iam_user.team["alice"]
}`,
        },
      ],
      traps: [
        'Using `count` over a list of names. It works until the first removal.',
        'Passing a list to `for_each` - it needs a map or a set of strings.',
        'Migrating from count to for_each without `moved` blocks, which destroys and recreates everything.',
      ],
      followUps: [
        'How do you migrate from count to for_each safely?',
        'Why does for_each reject a list?',
        'When is count genuinely the right choice?',
      ],
      tags: ['hcl', 'count', 'for_each', 'refactoring'],
    },
    {
      id: 'itv-tf-5',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do you handle secrets in Terraform?',
      probing:
        'The state-is-plaintext fact. Candidates who think `sensitive = true` solves it are a risk.',
      answer: [
        'The fact everything follows from: **anything Terraform manages ends up in state in plaintext**. A generated password, a private key, a connection string. `sensitive = true` changes what is **displayed**, not what is stored.',
        'So the strategy is, in order: keep the secret **out of state** if you can, **protect state** if you cannot, and **redact display** so nothing leaks into CI logs.',
        'Keeping it out of state means Terraform handles a **reference**, not a value - it creates the Secrets Manager secret or the Vault path and grants access, while the value itself is generated and rotated elsewhere and read by the application at runtime.',
        'Protecting state means an encrypted remote backend with a customer-managed key and tight IAM, never committing state, and treating saved plan files as secrets too - they contain resolved values.',
        'Where a secret must pass through Terraform, it comes from the environment (`TF_VAR_`) or a Vault data source, never a committed `.tfvars`. And on Terraform 1.10+, **ephemeral** values are the first mechanism that genuinely never writes to state.',
      ],
      code: [
        {
          title: 'The pattern that keeps the value out of Terraform',
          language: 'hcl',
          explanation:
            'Terraform creates the container and the access grant. It never sees the secret value, so the value is never in state.',
          code: `# Terraform creates the CONTAINER, not the value
resource "aws_secretsmanager_secret" "db" {
  name = "prod/db/password"
}

# Rotation happens outside Terraform
resource "aws_secretsmanager_secret_rotation" "db" {
  secret_id           = aws_secretsmanager_secret.db.id
  rotation_lambda_arn = aws_lambda_function.rotate.arn
  rotation_rules { automatically_after_days = 30 }
}

# The app is told WHERE the secret is, not what it is
resource "aws_ecs_task_definition" "app" {
  family = "app"
  container_definitions = jsonencode([{
    name    = "app"
    secrets = [{ name = "DB_PASSWORD", valueFrom = aws_secretsmanager_secret.db.arn }]
  }])
}`,
        },
        {
          title: 'Proving the point',
          language: 'bash',
          code: `terraform output                  # password = <sensitive>
terraform output -raw password    # ...but readable on demand

# And in state, in plaintext, regardless of the sensitive flag:
terraform state pull | jq -r '
  .resources[] | select(.type=="random_password")
  | .instances[].attributes.result'`,
        },
      ],
      traps: [
        'Believing `sensitive = true` encrypts anything. It affects CLI display only.',
        'Committing `*.tfvars` with credentials, or a saved `tfplan`.',
        'Assuming a Vault data source keeps the value out of state - the returned value is stored like any other data source result.',
      ],
      followUps: [
        'Does reading from Vault keep the secret out of state?',
        'What are ephemeral values?',
        'How would you audit an existing state file for secrets?',
      ],
      tags: ['security', 'secrets', 'state'],
    },
    {
      id: 'itv-tf-6',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'Someone changed a resource in the cloud console. What happens on the next terraform apply, and what should you do?',
      probing:
        'Drift handling. The interesting part is that the right answer is a decision, not a command.',
      answer: [
        'That is **drift**. Terraform refreshes state before diffing, so the next plan shows the resource changing back to what the configuration says - and the plan may look alarming because it includes a change nobody in the team made.',
        'The first thing is to **isolate it**: `terraform plan -refresh-only` shows drift on its own, with no configuration changes mixed in, so you can see exactly what moved.',
        'Then it is a judgement call, and there are exactly three honest options. **Configuration wins**: apply, which reverts the manual change. **Reality wins**: update the configuration to match, so the plan comes back clean and the change is now recorded. Or **it is not ours**: if another system legitimately owns that attribute - an autoscaler managing `desired_count` - add `lifecycle { ignore_changes = [...] }`.',
        'The one thing you must not do is apply without deciding. That is how someone’s emergency fix gets silently reverted at 2am by an unrelated deploy - I have seen exactly that cause a repeat incident.',
        'Before deciding I would find out **why** it was changed - the cloud audit log or just asking. The fix is usually organisational as much as technical: if people are changing things by hand, either they lack a Terraform path to do it or the pipeline is too slow.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'The drift routine',
          caption:
            'The decision in the middle is the whole point. Applying without deciding is how fixes get reverted.',
          nodes: [
            {
              label: 'A plan shows an unexpected change',
              detail: 'On a resource nobody in the team edited',
            },
            {
              label: 'Isolate it: plan -refresh-only',
              detail: 'Drift alone, with no config changes mixed in',
              tone: 'accent',
            },
            {
              label: 'Find out who changed it and why',
              detail: 'Cloud audit log, change ticket, or just ask',
              arrowLabel: 'before deciding',
            },
            {
              label: 'Decide whose version is correct',
              detail: 'A judgement, not a command',
            },
            {
              label: 'Apply, update the config, or ignore_changes',
              detail: 'Three honest options - pick one deliberately',
              tone: 'success',
              branch: {
                label: 'Apply without deciding',
                detail: 'Silently reverts whatever they fixed',
              },
            },
          ],
        },
      ],
      code: [
        {
          title: 'The commands, and the third option',
          language: 'bash',
          code: `# Drift only - no configuration changes mixed in
terraform plan -refresh-only

# Accept reality into state without touching infrastructure
terraform apply -refresh-only

# A scheduled drift check, so you find out in a day not a fortnight
terraform plan -refresh-only -detailed-exitcode
#   0 = no drift, 2 = drift detected, 1 = error`,
        },
        {
          title: 'When another system genuinely owns the value',
          language: 'hcl',
          code: `resource "aws_ecs_service" "app" {
  name          = "app"
  desired_count = 2

  lifecycle {
    # Application autoscaling owns this. Without the ignore,
    # every apply fights the autoscaler.
    ignore_changes = [desired_count]

    # NOT ignore_changes = all - that makes every real change
    # invisible while plans stay deceptively clean.
  }
}`,
        },
      ],
      traps: [
        'Applying immediately to "get back to a known state", reverting a deliberate fix.',
        'Using `ignore_changes = all`, which silently stops Terraform managing the resource while appearing to.',
        'Treating drift as purely technical. Repeated drift means a process problem.',
      ],
      followUps: [
        'How would you detect drift before it surprises you?',
        'When is ignore_changes the right answer?',
        'How would you stop people making manual changes?',
      ],
      tags: ['scenario', 'drift', 'operations'],
    },
    {
      id: 'itv-tf-7',
      level: 'advanced',
      kind: 'open',
      prompt: 'How do you structure Terraform for multiple environments?',
      probing:
        'A design question with several defensible answers. They want the trade-offs, especially on workspaces.',
      answer: [
        'My default is **separate directories per environment**, each with its own backend key, calling shared **modules**. So `environments/staging/` and `environments/production/` are thin - a few module calls and a tfvars file - while the substance lives in `modules/`.',
        'The reasons are blast radius and credentials. Separate state means a mistake in staging cannot destroy production. Separate directories mean CI can hold different credentials per environment, and `pwd` answers "which environment am I in".',
        'I would **not** use CLI workspaces for environments, which is the common wrong answer. Workspaces share one backend, one set of credentials and one configuration - so the isolation is nominal, and any structural difference between environments has to become a conditional on `terraform.workspace`, which gets unreadable fast.',
        'Workspaces are good for **short-lived variants** of the same thing: a per-developer sandbox, a per-pull-request preview environment.',
        'The other decision is **how finely to split state**. I would separate things with different change rates and different owners - networking, data, applications - and connect them with remote state data sources or, better, by passing explicit inputs.',
      ],
      code: [
        {
          title: 'Layout, and the workspace anti-pattern',
          language: 'bash',
          code: `modules/
├── network/            # reusable, environment-neutral
├── database/
└── service/

environments/
├── staging/
│   ├── main.tf         # module calls only
│   ├── backend.tf      # key = "staging/terraform.tfstate"
│   └── terraform.tfvars
└── production/
    ├── main.tf
    ├── backend.tf      # key = "production/terraform.tfstate"
    └── terraform.tfvars

# You run terraform from inside environments/production,
# with production credentials, against production state.

# The anti-pattern: one config, workspaces for environments
#   resource "aws_instance" "web" {
#     count         = terraform.workspace == "production" ? 6 : 1
#     instance_type = terraform.workspace == "production" ? "m5.xlarge" : "t3.micro"
#   }
# Two conditionals is tolerable. Twenty is unreadable, and one
# typo in the ternary deploys production sizing to staging -
# or worse, the reverse.`,
        },
        {
          title: 'A thin environment root',
          language: 'hcl',
          code: `module "network" {
  source = "../../modules/network"

  environment = "production"
  vpc_cidr    = "10.0.0.0/16"
  az_count    = 3
}

module "api" {
  source = "../../modules/service"

  environment   = "production"
  subnet_ids    = module.network.private_subnet_ids
  desired_count = 6
  instance_type = "m5.xlarge"
}`,
        },
      ],
      deeper: [
        'Terragrunt exists mainly to remove the duplication between those environment directories - it generates the backend configuration and keeps the roots DRY. Worth naming as a known option, with the caveat that it is another tool and another abstraction to learn.',
        'Whichever layout you pick, module **versioning** matters: pin modules to a tag, because there is no lock file for modules the way there is for providers.',
      ],
      traps: [
        'Using workspaces for prod versus staging and calling it isolated. They share a backend and credentials.',
        'One state file for the entire estate - slow plans and a huge blast radius.',
        'Copy-pasting whole configurations per environment instead of sharing modules.',
      ],
      followUps: [
        'Why are workspaces a poor fit for environments?',
        'How do you share values between separate state files?',
        'How would you version your modules?',
      ],
      tags: ['design', 'environments', 'modules', 'workspaces'],
    },
    {
      id: 'itv-tf-8',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'A colleague ran terraform apply and it failed halfway. What is the state of the world and what do you do?',
      probing:
        'Whether you know there is no rollback. Panic-driven manual cleanup here makes things much worse.',
      answer: [
        'Terraform has **no transactions and no rollback**. State is written as each resource completes, so the resources that succeeded exist and are recorded, and the ones after the failure do not exist.',
        'This is by design and it is exactly what makes the situation recoverable: `terraform plan` will show only the remaining work, because state accurately reflects what was done.',
        'So the correct response is: read the error, fix the cause, and run apply again. If eight of twelve resources were created, the next plan says "4 to add" and finishing the job is one command.',
        'The dangerous instinct is to start deleting the eight by hand "to get back to a clean state". That creates drift Terraform will then try to reconcile, and turns a resumable failure into a genuine mess.',
        'The exception worth checking: if the failure was a **lock** problem or the process was killed mid-write, state itself might be stale or locked. `terraform force-unlock` clears a confirmed-stale lock, and a versioned backend lets you restore a previous state version if one was genuinely corrupted - but I would confirm nothing is still running first, because force-unlocking a live lock is one of the few ways to actually corrupt state.',
      ],
      code: [
        {
          title: 'Assessing and resuming',
          language: 'bash',
          code: `# What actually succeeded?
terraform state list

# What remains? This is the answer - usually just the tail.
terraform plan

# Fix the cause, then simply finish the job
terraform apply

# If the process was killed and left a lock behind:
#   FIRST confirm nobody and no pipeline is still running.
terraform force-unlock <LOCK_ID>
terraform plan          # verify state is coherent before applying

# Always take a copy before any state surgery
terraform state pull > state-backup-$(date +%F-%H%M%S).json`,
        },
      ],
      traps: [
        'Manually deleting the resources that succeeded. That is the one action that makes it worse.',
        'Force-unlocking without checking whether an apply is still running.',
        'Assuming state is corrupt because an apply failed. A failed apply is normal and leaves state consistent.',
      ],
      followUps: [
        'Why does Terraform not roll back?',
        'When would you restore a previous state version?',
        'How do you avoid a half-applied change causing an outage?',
      ],
      tags: ['scenario', 'operations', 'state', 'recovery'],
    },
  ],
}
