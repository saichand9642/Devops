import type { InterviewQuestion } from '../../../types'

/** State, the core workflow, and the things that go wrong with both. */
export const terraformStateQuestions: InterviewQuestion[] = [
  {
    id: 'itv-tf-9',
    level: 'basic',
    kind: 'open',
    prompt: 'What is Terraform state and why does it exist?',
    probing:
      'The single most important Terraform concept. Everything difficult about Terraform involves state.',
    answer: [
      'State is a JSON file mapping the resources in your configuration to the **real objects** that exist in the provider. When you write `aws_instance.web`, state records that this corresponds to instance `i-0abc123`.',
      'It exists because Terraform has to answer "what do I need to change?" and the configuration alone cannot tell it. Without state, Terraform would have to query every resource in your account and guess which ones it owns - which is slow, unreliable, and impossible for resources that cannot be identified by their attributes alone.',
      'State also stores **attribute values** so that `plan` can show differences without calling the API for everything, and it records **dependencies** so Terraform knows the order to destroy things in.',
      'The consequence that matters: **state is the source of truth about what Terraform manages**. Lose it and Terraform no longer knows those resources exist - it will try to create them again. Corrupt it and you can get destruction you did not intend. That is why remote state with locking, versioning and encryption is not optional for anything real.',
    ],
    code: [
      {
        title: 'Inspecting state safely',
        language: 'bash',
        code: `terraform state list                       # what does Terraform think it manages?
terraform state show aws_instance.web      # the recorded attributes
terraform show -json | jq '.values.root_module.resources | length'

# Never edit terraform.tfstate by hand - use the state commands
terraform state mv aws_instance.web aws_instance.api
terraform state rm aws_instance.legacy     # forget it WITHOUT destroying it`,
      },
    ],
    traps: [
      'Committing `terraform.tfstate` to git - it contains secrets in plain text and has no locking.',
      'Editing the state file by hand.',
      'Assuming state is a cache that can be regenerated. It cannot.',
    ],
    followUps: ['What happens if you lose the state file?', 'Why is state considered sensitive?'],
    tags: ['state', 'fundamentals', 'terraform'],
  },
  {
    id: 'itv-tf-10',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How should state be stored for a team, and what does locking prevent?',
    probing: 'Remote backends. The locking question is the one that reveals real experience.',
    answer: [
      'State must be in a **remote backend** shared by everyone - S3, Azure Blob, GCS, or HCP Terraform. Local state means each person has a different idea of reality and the first two people to apply on the same day overwrite each other.',
      'The backend needs four properties. **Shared** so everyone reads the same state. **Locked** so two applies cannot run concurrently. **Versioned** so a corrupted or truncated state can be rolled back. And **encrypted**, because state contains every attribute of every resource - including database passwords and generated secrets - in plain text.',
      '**Locking** prevents concurrent writes. Without it, two engineers applying at the same time both read the same state, both make changes, and the second write overwrites the first - leaving state that does not describe reality, with real resources Terraform no longer knows about. With S3 this is now native state locking; older setups used a DynamoDB table.',
      'The other practice that matters is **splitting state by blast radius**. One enormous state file for the whole estate means every apply risks everything, plans take many minutes, and one lock blocks the entire organisation. Separate state per environment and per logically independent component, with `terraform_remote_state` or data sources to read across the boundaries.',
    ],
    code: [
      {
        title: 'S3 backend with locking and encryption',
        language: 'hcl',
        code: `terraform {
  backend "s3" {
    bucket       = "acme-tfstate-prod"
    key          = "platform/network/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    kms_key_id   = "arn:aws:kms:eu-west-1:123456789012:key/abc-123"
    use_lockfile = true     # native S3 state locking
  }
}`,
        explanation:
          'The key path encodes the component, which is how you keep several independent states in one bucket.',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What locking prevents',
        caption: 'Without a lock, the second write silently discards the first engineer’s changes.',
        nodes: [
          { label: 'Engineer A runs apply', detail: 'Acquires the lock', tone: 'accent' },
          { label: 'Engineer B runs apply', detail: 'Blocked, waits', tone: 'warning' },
          { label: 'A writes new state, releases lock', tone: 'success' },
          { label: 'B re-reads the updated state', detail: 'Plans against reality' },
          {
            label: 'Without a lock',
            detail: 'B overwrites A - resources orphaned',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Bucket versioning is what saves you when state is corrupted - restore the previous object version.',
      'Restrict who can write to the state bucket. Write access to state is effectively write access to the infrastructure.',
      'If a lock is left behind by a crashed run, `terraform force-unlock <id>` clears it - but confirm nothing is actually running first.',
    ],
    traps: [
      'Local state on someone’s laptop for shared infrastructure.',
      'No versioning, so a corrupted state has no recovery path.',
      'One state file for everything, so every change risks everything.',
      '`force-unlock` used casually while another apply is genuinely in progress.',
    ],
    followUps: [
      'A colleague’s apply crashed and the state is locked. What do you do?',
      'How would you split state for a large estate?',
    ],
    tags: ['state', 'backend', 'locking', 'collaboration', 'production'],
  },
  {
    id: 'itv-tf-11',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `terraform plan` actually do?',
    probing: 'Core workflow understanding, including the refresh step people forget.',
    options: [
      {
        id: 'a',
        text: 'Refreshes state against the real infrastructure, compares it with the configuration, and shows the actions needed to reconcile them',
      },
      { id: 'b', text: 'Applies the changes but in a reversible way' },
      { id: 'c', text: 'Validates the syntax of the configuration only' },
      { id: 'd', text: 'Downloads providers and modules' },
    ],
    correct: ['a'],
    answer: [
      '`plan` does three things in order. It **refreshes**: queries the provider for the current state of each managed resource, so state reflects reality including any manual changes. It **compares** that against the desired configuration. And it **reports** the create, update, replace and destroy actions needed.',
      'The refresh step is why a plan can show changes when you have not touched the configuration - someone modified something in the console, and Terraform is reporting the drift.',
      'Two things worth knowing. A plan is a **point-in-time prediction**; between plan and apply the world can change, which is why `terraform apply` re-plans unless you pass a saved plan file. And in CI you should **save the plan** (`-out`) and apply exactly that file, so what was reviewed is what runs.',
    ],
    code: [
      {
        title: 'Plan and apply the same thing',
        language: 'bash',
        code: `terraform plan -out=tfplan          # save it
terraform show tfplan               # human-readable review
terraform show -json tfplan | jq '.resource_changes[]
  | select(.change.actions[] | contains("delete"))'   # anything destructive?

terraform apply tfplan              # applies EXACTLY what was reviewed`,
      },
    ],
    traps: [
      'Reviewing a plan then running a bare `apply`, which re-plans and may do something different.',
      'Ignoring a plan that shows unexpected changes rather than investigating the drift.',
      '`-refresh=false` used routinely for speed, which hides drift.',
    ],
    followUps: ['Why does a plan sometimes show changes when nothing in the code changed?'],
    tags: ['plan', 'workflow', 'drift', 'fundamentals'],
  },
  {
    id: 'itv-tf-12',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is drift, and how do you handle it?',
    probing:
      'The gap between code and reality, which is a process problem as much as a technical one.',
    answer: [
      'Drift is when the real infrastructure differs from what the configuration says. It happens because someone changed something in the console during an incident, because another tool modified a resource, or because the provider itself changed a default.',
      'Terraform detects it on every `plan` via the refresh step. The response depends on which is right. If the **code is right**, apply and Terraform corrects reality. If the **change was correct** - an emergency fix that should persist - update the code to match, so the next apply does not revert it.',
      'The dangerous case is the third: drift that goes unnoticed for months, so nobody knows whether the code or reality is correct, and applying becomes frightening. Once a team is afraid to run `terraform apply`, infrastructure as code has stopped working.',
      'Preventing it is mostly organisational. **Restrict console write access** in production so changes have to go through code. **Detect it continuously** with a scheduled plan that alerts on any non-empty diff. And **accept that emergency console changes will happen** - the rule should be that the code is updated before the incident is closed, not that the console is never touched.',
    ],
    code: [
      {
        title: 'Scheduled drift detection',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

terraform init -input=false
# Exit codes: 0 = no changes, 1 = error, 2 = changes present
set +e
terraform plan -detailed-exitcode -lock=false -out=drift.tfplan
code=$?
set -e

case "$code" in
  0) echo "no drift" ;;
  2) terraform show -no-color drift.tfplan > drift.txt
     ./notify.sh "#platform" "Drift detected in $(basename "$PWD")" drift.txt ;;
  *) echo "plan failed" >&2; exit 1 ;;
esac`,
        explanation: '-detailed-exitcode is the flag that makes drift detection scriptable.',
      },
    ],
    traps: [
      'Discovering six months of accumulated drift on the day you urgently need to apply.',
      'Reverting a correct emergency fix because the code was never updated.',
      'Detecting drift and notifying a channel nobody reads.',
    ],
    followUps: [
      'Someone fixed production in the console at 3am. What happens next?',
      'How would you stop drift accumulating?',
    ],
    tags: ['drift', 'state', 'process', 'operations'],
  },
  {
    id: 'itv-tf-13',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you import existing infrastructure into Terraform?',
    probing: 'A real migration task. The import block is the modern answer.',
    answer: [
      'The modern approach is the **`import` block**, which is declarative and works with `plan` - so you can see what will be imported before anything happens, and the import is recorded in code rather than being an untracked command someone ran once.',
      'The workflow is: write the `import` block with the resource address and the provider ID, run `plan -generate-config-out` to have Terraform write a starting configuration, then **refine that generated code** - it is verbose and includes computed attributes you do not want to manage - until `plan` shows **no changes**. A clean plan is the signal that the code genuinely matches reality.',
      'The older `terraform import` command still works and does the same thing imperatively, but you have to write the configuration yourself first and the operation leaves no record.',
      'The hard part is never the mechanics; it is that imported resources were usually created by hand with settings nobody documented. Getting to a no-change plan on a real production resource often surfaces a dozen attributes you did not know were set.',
    ],
    code: [
      {
        title: 'Declarative import with generated configuration',
        language: 'hcl',
        code: `import {
  to = aws_s3_bucket.legacy_assets
  id = "acme-legacy-assets"
}

import {
  to = aws_security_group.database
  id = "sg-0abc123def456"
}`,
      },
      {
        title: 'The workflow',
        language: 'bash',
        code: `# 1. Let Terraform write a first draft of the configuration
terraform plan -generate-config-out=generated.tf

# 2. Move the useful parts into your real files and tidy them up.
#    The generated code includes computed attributes you should remove.

# 3. Iterate until this shows "No changes" - that is the success condition
terraform plan

# 4. Apply to record the import in state
terraform apply`,
      },
    ],
    deeper: [
      'Import brings a resource into state; it does not bring in anything it depends on. Work outward from the leaves.',
      'For a large migration, tools like Terraformer generate bulk configuration - useful as a starting point, still needing substantial cleanup.',
      'Import the resource into a **module** by addressing it fully: `module.network.aws_vpc.main`.',
      'Never import into production state without a state backup first.',
    ],
    traps: [
      'Applying before the plan is clean, which modifies the resource you were trying to adopt.',
      'Using the generated configuration verbatim, including computed attributes that then fight Terraform.',
      'Importing a resource while another tool still manages it.',
    ],
    followUps: [
      'How do you know the import worked correctly?',
      'What would you do before importing into production state?',
    ],
    tags: ['import', 'migration', 'state', 'brownfield'],
  },
  {
    id: 'itv-tf-14',
    level: 'advanced',
    kind: 'open',
    prompt: 'Explain `count` versus `for_each`. Why does `count` cause problems?',
    probing: 'A genuinely important Terraform subtlety with real destructive consequences.',
    answer: [
      'Both create multiple instances of a resource. `count` indexes them by **position**: `aws_instance.web[0]`, `[1]`, `[2]`. `for_each` indexes them by **key** from a map or set: `aws_instance.web["api"]`, `["worker"]`.',
      'The problem with `count` is that the index **is** the identity in state. Remove the first element from a list of three and everything shifts: what was `[1]` becomes `[0]`, `[2]` becomes `[1]`, and `[2]` no longer exists. Terraform sees three resources that all need to change and one that needs destroying - so removing one item can **destroy and recreate every resource in the list**.',
      'With `for_each`, removing `"api"` from the map destroys exactly `aws_instance.web["api"]` and leaves the others untouched, because their keys did not change. The identity is stable and meaningful.',
      'So the rule is: use **`for_each` for anything where the elements are distinct things** - environments, subnets, users, services. Use `count` only for **genuinely identical, interchangeable copies** where position carries no meaning, or for the conditional pattern `count = var.enabled ? 1 : 0`.',
      'The `for_each` keys must be known at plan time, which occasionally forces `count` - but the destructive risk makes that a trade-off worth thinking about rather than a default.',
    ],
    code: [
      {
        title: 'Why count is dangerous',
        language: 'hcl',
        code: `# DANGEROUS: removing "b" shifts every later index
variable "names" { default = ["a", "b", "c"] }

resource "aws_iam_user" "with_count" {
  count = length(var.names)
  name  = var.names[count.index]
}
# Remove "b":  [1] "b"->"c" (replace), [2] "c" -> destroyed
# Two users destroyed and recreated to delete one.

# SAFE: keys are stable, so only the removed one is affected
resource "aws_iam_user" "with_for_each" {
  for_each = toset(var.names)
  name     = each.value
}
# Remove "b":  only aws_iam_user.with_for_each["b"] is destroyed.`,
      },
      {
        title: 'for_each over a map, which is the common real case',
        language: 'hcl',
        code: `variable "services" {
  type = map(object({
    cpu    = number
    memory = number
  }))
  default = {
    api    = { cpu = 512,  memory = 1024 }
    worker = { cpu = 256,  memory = 512 }
  }
}

resource "aws_ecs_service" "this" {
  for_each = var.services

  name          = each.key
  desired_count = 2
  # each.value gives you the whole object
  task_definition = aws_ecs_task_definition.this[each.key].arn
}`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'count or for_each?',
        caption: 'If the elements are distinguishable things, the index is the wrong identity.',
        question: 'What are you creating multiple of?',
        branches: [
          {
            condition: 'Distinct named things - subnets, users, services',
            result: 'for_each',
            detail: 'Stable keys; removal affects only that item',
            tone: 'success',
          },
          {
            condition: 'Identical interchangeable copies',
            result: 'count is acceptable',
            detail: 'Position carries no meaning',
            tone: 'accent',
          },
          {
            condition: 'Create this or not at all',
            result: 'count = var.enabled ? 1 : 0',
            detail: 'The standard conditional pattern',
            tone: 'accent',
          },
          {
            condition: 'Keys are not known until apply',
            result: 'count, reluctantly',
            detail: 'Understand the shifting risk',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Converting an existing `count` resource to `for_each` requires `terraform state mv` for each instance, or Terraform will destroy and recreate everything.',
      '`moved` blocks let you refactor addresses declaratively, which is far safer than a sequence of state commands.',
      'Always read the plan when using `count`. The word "replace" next to a resource you did not intend to change is the warning.',
    ],
    traps: [
      'A list of names with `count`, then removing an item from the middle.',
      'Converting `count` to `for_each` without state moves.',
      '`for_each` over a value derived from another resource, which is unknown at plan time and errors.',
    ],
    followUps: [
      'How would you migrate an existing count-based resource to for_each?',
      'What is a `moved` block for?',
    ],
    tags: ['count', 'for_each', 'state', 'meta-arguments', 'advanced'],
  },
  {
    id: 'itv-tf-15',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are modules, and how should they be structured?',
    probing: 'Reuse and organisation - the answer should mention versioning.',
    answer: [
      'A module is a directory of Terraform files that can be called with inputs and returns outputs. Every configuration is already a module - the **root module** - and calling others is how you avoid writing the same VPC definition five times.',
      'A good module has a **clear, narrow purpose**, a small set of **well-documented variables** with types and sensible defaults, **validated inputs** where constraints exist, and **outputs** exposing what callers actually need. It should not reach outside itself - no provider configuration, no backend, no hardcoded environment names.',
      '**Version them.** A module referenced by a git branch means someone else’s commit changes your infrastructure on the next apply. Reference a tag, and let consumers upgrade deliberately.',
      'The main failure mode is over-abstraction. A module with forty variables that wraps a single resource adds indirection without value - callers have to read the module to know what it does, and any behaviour it does not expose requires modifying the module. Modules should encode a **pattern you repeat**, not wrap every resource by reflex.',
    ],
    code: [
      {
        title: 'A module with validated inputs',
        language: 'hcl',
        code: `variable "environment" {
  type        = string
  description = "Deployment environment - drives sizing and retention."
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}

variable "instance_count" {
  type    = number
  default = 2
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 20
    error_message = "instance_count must be between 1 and 20."
  }
}

output "security_group_id" {
  value       = aws_security_group.this.id
  description = "Attach this to resources that need database access."
}`,
      },
      {
        title: 'Calling a module, pinned to a version',
        language: 'hcl',
        code: `module "network" {
  source = "git::https://github.com/acme/tf-modules.git//network?ref=v2.4.0"

  environment = "prod"
  cidr_block  = "10.20.0.0/16"
  az_count    = 3
}

# Registry modules use a version argument instead
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"
}`,
      },
    ],
    deeper: [
      'Never configure providers inside a reusable module. Pass them in with `providers` if a module needs a non-default one - otherwise the module cannot be used with `for_each` or in multi-region setups.',
      'Keep module composition shallow. Modules calling modules calling modules makes plan output impossible to follow.',
      'Test modules with Terratest or the native `terraform test` framework, especially any module many teams depend on.',
    ],
    traps: [
      'A module referenced by branch rather than tag.',
      'Provider blocks inside a module.',
      'Modules so thin they only add indirection, or so deep nobody can trace a value.',
    ],
    followUps: [
      'Why should a module not contain a provider block?',
      'How do you roll out a breaking module change to twenty consumers?',
    ],
    tags: ['modules', 'reuse', 'versioning', 'design'],
  },
  {
    id: 'itv-tf-16',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      '`terraform apply` failed halfway through. Some resources were created, some were not. What now?',
    probing:
      'Terraform has no transactions, and how you reason about partial failure is revealing.',
    answer: [
      'The first thing to understand is that **Terraform is not transactional**. There is no rollback. Resources created before the failure exist and are recorded in state; the rest were not attempted. State should be accurate for what was done - that is the good news.',
      'So the first action is **read the error**, not re-run. The cause is usually one of a few things: a permissions problem, a provider API error, a quota or limit, a dependency that was not ready, or a genuine conflict such as a name already in use.',
      'Then **run `plan` again**. Because state reflects what was created, the new plan shows only the remaining work. Most of the time, fixing the underlying problem and re-applying is all that is needed - Terraform is designed to converge.',
      'The awkward case is when a resource was **created in the provider but not recorded in state** - which happens if Terraform is interrupted between the API call succeeding and the state write. Then the next apply tries to create it again and fails with "already exists". The fix is to **import** it, so state catches up with reality.',
      'If the state file itself is damaged, restore the **previous version** from the versioned backend rather than hand-editing. And if a lock was left behind by the interrupted run, `force-unlock` after confirming nothing is still running.',
      'Afterwards, the preventive measures are worth stating: **smaller state files** so a failure affects less, **targeted applies** avoided in favour of fixing root causes, and **plan files reviewed in CI** so permission and quota problems surface before apply.',
    ],
    code: [
      {
        title: 'Recovering, in order',
        language: 'bash',
        code: `# 1. What does Terraform believe exists now?
terraform state list
terraform plan          # shows only the remaining work

# 2. "Already exists" means it was created but not recorded - import it
terraform import aws_s3_bucket.assets acme-assets-prod
terraform plan          # should now be clean for that resource

# 3. Lock left behind by the interrupted run (confirm nothing is running first)
terraform force-unlock 1a2b3c4d-5e6f-7890-abcd-ef1234567890

# 4. State genuinely damaged - restore the previous object version
aws s3api list-object-versions --bucket acme-tfstate-prod \\
  --prefix platform/network/terraform.tfstate --max-items 5`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'What kind of partial failure is it?',
        caption: 'Most of the time the answer is: fix the cause and apply again.',
        question: 'What does the error say?',
        branches: [
          {
            condition: 'Permissions, quota or API error',
            result: 'Fix the cause, apply again',
            detail: 'State is accurate; plan shows what remains',
            tone: 'success',
          },
          {
            condition: '"Already exists" on re-apply',
            result: 'Created but not in state - import it',
            tone: 'warning',
          },
          {
            condition: 'State file corrupt or truncated',
            result: 'Restore the previous version from the backend',
            tone: 'danger',
          },
          {
            condition: 'Lock held by a run that is gone',
            result: 'force-unlock, after confirming',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Some providers create a resource and then fail configuring it. The resource is in state but marked **tainted**, and the next apply replaces it - which is usually correct but worth noticing before it happens in production.',
      '`-target` is a debugging tool, not a workflow. Routine targeted applies leave state and reality diverging in ways that are hard to reason about.',
      'Small, frequent applies fail less destructively than large infrequent ones. That is an argument for splitting state, not just for tidiness.',
    ],
    traps: [
      'Re-running apply repeatedly without reading the error.',
      'Hand-editing state to "fix" it.',
      '`force-unlock` while another apply is genuinely still running.',
      'Assuming Terraform rolled back. It does not.',
    ],
    followUps: [
      'A resource exists in AWS but not in state. How did that happen and how do you fix it?',
      'How would you reduce the impact of this next time?',
    ],
    tags: ['scenario', 'state', 'troubleshooting', 'recovery', 'advanced'],
  },
  {
    id: 'itv-tf-17',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these are safe ways to handle secrets with Terraform? Select all that apply.',
    probing:
      'Secrets in Terraform are genuinely awkward because of state, and the answer must acknowledge that.',
    options: [
      {
        id: 'a',
        text: 'Read them at runtime from Vault or a cloud secret manager via a data source',
      },
      {
        id: 'b',
        text: 'Let Terraform create a random password and write it directly to a secret manager, never to a variable file',
      },
      { id: 'c', text: 'Pass them as environment variables (`TF_VAR_`) from a CI secret store' },
      { id: 'd', text: 'Put them in `terraform.tfvars` and add that file to `.gitignore`' },
      {
        id: 'e',
        text: 'Have the application fetch the secret itself at runtime, so Terraform only creates the reference',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      '`.gitignore` on a tfvars file is not a control. The secret is still in plain text on every machine that has it, it gets copied, and one person committing it once is permanent. It is the weakest option on the list.',
      'The essential thing to state is that **anything Terraform touches ends up in state in plain text** - including values read from Vault via a data source. Marking a variable `sensitive` only hides it from CLI output; it does not encrypt it in state. So encrypted state with tight access control is a prerequisite for all of these.',
      'The strongest pattern is **e**: Terraform creates the secret *container* and grants the application permission to read it, but the value never passes through Terraform at all. Nothing in state, nothing to leak.',
      'Next best is **b**: Terraform generates a random value and writes it straight into a secret manager. It is in state, but it was never in a file, never in git, and can be rotated outside Terraform afterwards.',
    ],
    code: [
      {
        title: 'Generate and store, never a variable file',
        language: 'hcl',
        code: `resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db" {
  name       = "prod/db/password"
  kms_key_id = aws_kms_key.secrets.arn
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = random_password.db.result
}

resource "aws_db_instance" "main" {
  password = random_password.db.result   # in state - hence encrypted state
  lifecycle {
    ignore_changes = [password]          # allow rotation outside Terraform
  }
}`,
      },
    ],
    traps: [
      'Believing `sensitive = true` encrypts anything. It only suppresses output.',
      'Reading from Vault and assuming the value therefore stays in Vault. It is copied into state.',
      'tfvars files with secrets, gitignored and then shared over chat.',
    ],
    followUps: [
      'Where does a secret read from Vault end up?',
      'How would you rotate a database password Terraform created?',
    ],
    tags: ['secrets', 'security', 'state', 'vault'],
  },
  {
    id: 'itv-tf-18',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage multiple environments - dev, staging, production?',
    probing: 'A design question with several defensible answers. Workspaces are the trap.',
    answer: [
      'There are three common approaches, and the differences matter.',
      '**Workspaces** give you separate state within one configuration. They are tempting and usually the wrong choice for environments, because every workspace shares the **same code**, so you cannot have production differ structurally from dev, and it is very easy to apply to the wrong workspace - the current workspace is invisible in the code and easy to forget.',
      '**Directory per environment** with shared modules is the most common and most defensible: `environments/prod/`, `environments/staging/`, each with its own backend configuration and tfvars, all calling the same versioned modules. Environments are explicit, can differ where they genuinely need to, and cannot be confused with each other. The cost is some duplication in the root modules.',
      '**Separate repositories or accounts per environment** goes further, adding a hard boundary. Appropriate when the isolation requirement is strong - different teams, different compliance scopes.',
      'What I would actually recommend: **directory per environment**, shared versioned modules, separate state and separate cloud accounts per environment, and production requiring a different credential to apply. The goal is that applying to production should feel deliberate and be impossible to do by accident.',
    ],
    code: [
      {
        title: 'Directory per environment, shared modules',
        language: 'text',
        code: `.
├── modules/
│   ├── network/
│   ├── database/
│   └── service/
└── environments/
    ├── dev/
    │   ├── main.tf          # calls ../../modules/*
    │   ├── backend.tf       # its own state key
    │   └── terraform.tfvars
    ├── staging/
    │   ├── main.tf
    │   ├── backend.tf
    │   └── terraform.tfvars
    └── prod/
        ├── main.tf
        ├── backend.tf       # separate account, separate credentials
        └── terraform.tfvars`,
      },
    ],
    traps: [
      'Workspaces for environments, then needing production to have something dev does not.',
      'Applying to the wrong workspace because `terraform workspace show` was never run.',
      'Copying root modules between environments until they silently diverge.',
      'One AWS account for all environments, so blast radius is unbounded.',
    ],
    followUps: [
      'What are workspaces genuinely good for?',
      'How do you stop someone applying to production by mistake?',
    ],
    tags: ['environments', 'workspaces', 'structure', 'design'],
  },
  {
    id: 'itv-tf-19',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you run Terraform in CI/CD safely?',
    probing: 'Automation design, including the approval and credential questions.',
    answer: [
      'The shape is: **plan on every pull request**, posted as a comment so it is reviewed alongside the code; **apply on merge**, using the **saved plan file** from the pull request so what was reviewed is exactly what runs.',
      'Credentials should come from **OIDC federation** rather than stored keys - the pipeline assumes a role scoped to the environment and receives short-lived credentials. That removes the most attractive target in the whole system.',
      '**Concurrency control** matters: two applies against the same state must not run simultaneously. State locking handles the worst case, but a queue at the pipeline level gives a much better experience than a failed apply.',
      'Then the guardrails. **Policy as code** - OPA/Conftest or Sentinel - checking the plan for things that should never happen: unencrypted storage, public security groups, deletion of stateful resources. **A destroy check** that requires explicit approval when the plan contains deletions. And **environment-gated approval** for production, so the apply pauses for a human.',
      'The failure mode to design against is an apply that runs against stale state or an unreviewed plan. Saving and applying the plan file, plus locking, closes both.',
    ],
    code: [
      {
        title: 'Plan on PR, apply the same plan on merge',
        language: 'yaml',
        code: `jobs:
  plan:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read, pull-requests: write }
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/tf-plan
          aws-region: eu-west-1
      - run: terraform init -input=false
      - run: terraform plan -input=false -lock-timeout=5m -out=tfplan

      - name: Block unreviewed destroys
        run: |
          terraform show -json tfplan \\
            | jq -e '[.resource_changes[]
                | select(.change.actions | index("delete"))] | length == 0' \\
            || echo "DESTROY_PRESENT=true" >> "$GITHUB_ENV"

      - run: conftest test --policy ./policy <(terraform show -json tfplan)

      - uses: actions/upload-artifact@v4
        with: { name: tfplan, path: tfplan }

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    environment: production          # approval gate
    concurrency: terraform-prod      # never two applies at once
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/download-artifact@v4
        with: { name: tfplan }
      - run: terraform apply -input=false tfplan   # exactly what was reviewed`,
      },
    ],
    deeper: [
      'Posting the plan as a pull request comment is what makes infrastructure changes genuinely reviewable - reviewers see the effect, not just the diff.',
      'A plan file can go stale. Set a short window between plan and apply, or re-plan and compare.',
      'Separate roles for plan (read-only) and apply (write) so a pull request from a fork cannot change anything.',
      'Policy as code catches the class of mistakes review misses because they look fine in the diff.',
    ],
    traps: [
      'Running a bare `terraform apply` in CI, which re-plans and may differ from what was reviewed.',
      'Long-lived cloud credentials stored as CI secrets.',
      'No concurrency control, so two merges race.',
      'Auto-approving applies that contain deletions.',
    ],
    followUps: [
      'Why apply the saved plan file rather than re-planning?',
      'How would you stop a pull request from deleting the production database?',
    ],
    tags: ['cicd', 'automation', 'oidc', 'policy as code', 'advanced'],
  },
  {
    id: 'itv-tf-20',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the difference between a provider, a resource and a data source?',
    probing: 'Basic vocabulary, quickly checked.',
    answer: [
      'A **provider** is the plugin that knows how to talk to a platform - AWS, Azure, Kubernetes, GitHub, Datadog. It is configured once and supplies the resource types you can use.',
      'A **resource** is something Terraform **manages**: it creates it, updates it, and destroys it when you remove it from the configuration. It appears in state and Terraform considers itself responsible for it.',
      "A **data source** is something Terraform **reads but does not manage**. It looks up existing infrastructure - an AMI ID, an existing VPC, another team's outputs - so you can reference it without owning it. Removing a data source from the configuration deletes nothing.",
      'The practical distinction is ownership. If you want Terraform to create and destroy it, it is a resource. If it exists already and belongs to someone else, it is a data source.',
    ],
    code: [
      {
        title: 'All three together',
        language: 'hcl',
        code: `provider "aws" {
  region = "eu-west-1"
}

# Read something we do not own
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# Create and manage something we do own
resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}`,
      },
    ],
    traps: [
      'A `most_recent` AMI data source, which silently changes and can trigger instance replacement on an unrelated apply.',
      'Managing a resource another team also manages, so the two configurations fight.',
    ],
    followUps: ['Why can a `most_recent = true` data source cause a surprise replacement?'],
    tags: ['providers', 'resources', 'data sources', 'fundamentals'],
  },
  {
    id: 'itv-tf-21',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is the `lifecycle` block and when would you use each option?',
    probing: 'Fine control over Terraform behaviour - including the ones that are usually a smell.',
    answer: [
      '`lifecycle` changes how Terraform treats a resource. There are four options worth knowing.',
      '**`prevent_destroy = true`** makes any plan that would destroy the resource fail. It is the right protection for a production database or a state bucket - it turns an accidental destroy into an error rather than an incident. Note it blocks the plan; you have to remove it deliberately to proceed.',
      '**`create_before_destroy = true`** reverses the default order for replacements, creating the new resource before destroying the old. This is how you avoid downtime when a change forces replacement, and it is essential for anything in a load balancer’s path. It requires that the two can coexist, so names may need to be unique - usually via `name_prefix` rather than `name`.',
      '**`ignore_changes`** tells Terraform not to react to changes in specific attributes. Legitimate for values modified outside Terraform by design - an autoscaling group’s desired count managed by an autoscaler, or a password rotated by a secret manager. Used more broadly it is a smell: it hides drift rather than resolving it, and the code stops describing reality.',
      '**`replace_triggered_by`** forces replacement when another resource changes, which is occasionally the only way to express a dependency the provider does not model.',
      'The caution I would give: `ignore_changes = all` is almost always the wrong answer to a problem that deserved a real fix.',
    ],
    code: [
      {
        title: 'The options in realistic use',
        language: 'hcl',
        code: `resource "aws_db_instance" "prod" {
  identifier = "prod-main"
  # ...
  lifecycle {
    prevent_destroy = true               # a plan that destroys this will fail
    ignore_changes  = [password]         # rotated by Secrets Manager, not us
  }
}

resource "aws_launch_template" "app" {
  name_prefix = "app-"                   # unique names so both can exist
  # ...
  lifecycle {
    create_before_destroy = true         # no gap during replacement
  }
}

resource "aws_autoscaling_group" "app" {
  desired_capacity = 3
  lifecycle {
    ignore_changes = [desired_capacity]  # the autoscaler owns this at runtime
  }
}`,
      },
    ],
    deeper: [
      '`prevent_destroy` does not stop `terraform destroy` on the whole configuration from failing loudly - which is the point, but it means you cannot tear down an environment without editing code.',
      '`create_before_destroy` propagates to dependencies, which can make a plan much larger than expected. Read it.',
      '`ignore_changes` on a whole resource means Terraform will create it and never manage it again - rarely what anyone actually wants.',
    ],
    traps: [
      '`ignore_changes` used to silence a plan difference nobody investigated.',
      '`create_before_destroy` on a resource with a fixed unique name, which then conflicts with itself.',
      'Relying on `prevent_destroy` as the only protection, rather than also separating state and permissions.',
    ],
    followUps: [
      'When is `ignore_changes` legitimate and when is it hiding a problem?',
      'Why does `create_before_destroy` often need `name_prefix`?',
    ],
    tags: ['lifecycle', 'meta-arguments', 'production', 'safety', 'advanced'],
  },
  {
    id: 'itv-tf-22',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `terraform init` do?',
    probing: 'Workflow basics.',
    options: [
      { id: 'a', text: 'Downloads providers and modules, and configures the backend' },
      { id: 'b', text: 'Creates the infrastructure defined in the configuration' },
      { id: 'c', text: 'Initialises a new empty Terraform project with template files' },
      { id: 'd', text: 'Validates that the configuration is syntactically correct' },
    ],
    correct: ['a'],
    answer: [
      '`init` prepares a working directory. It **downloads the providers** required by the configuration into `.terraform/`, **downloads modules** referenced by source, and **initialises the backend** - connecting to remote state, and offering to migrate state if the backend configuration changed.',
      'It creates nothing in the cloud. It is safe to run repeatedly, and it must be run after adding a provider, adding a module, or changing the backend.',
      'It also writes `.terraform.lock.hcl`, which pins the exact provider versions and their checksums. **That file should be committed**, so every machine and the CI pipeline use identical provider versions - otherwise a provider upgrade can change behaviour between your laptop and CI with no code change.',
    ],
    code: [
      {
        title: 'Useful init variants',
        language: 'bash',
        code: `terraform init                       # normal
terraform init -upgrade              # allow newer provider versions, update the lock
terraform init -reconfigure          # ignore existing backend config, do not migrate
terraform init -backend-config=prod.hcl   # backend settings from a file

# Commit this - it pins provider versions and checksums
git add .terraform.lock.hcl`,
      },
    ],
    traps: [
      'Not committing the lock file, so CI can silently use a different provider version.',
      'Running `-upgrade` casually and pulling in a provider major version with breaking changes.',
      'Committing the `.terraform/` directory, which is large and machine-specific.',
    ],
    followUps: ['Why does the lock file matter for CI?'],
    tags: ['init', 'workflow', 'providers', 'lock file', 'fundamentals'],
  },
]
