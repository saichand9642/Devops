import type { InterviewQuestion } from '../../../types'

/** HCL itself: expressions, variables, dependencies, functions and provisioners. */
export const terraformLanguageQuestions: InterviewQuestion[] = [
  {
    id: 'itv-tf-23',
    level: 'basic',
    kind: 'open',
    prompt: 'How do variables, locals and outputs differ?',
    probing: 'Basic language vocabulary.',
    answer: [
      'A **variable** is an **input** to a module. It is supplied from outside - a tfvars file, a `-var` flag, a `TF_VAR_` environment variable, or a module call - and can have a type, a default, a description and validation rules.',
      'A **local** is a **computed value inside** the configuration. It cannot be set from outside; it exists to name an expression you use several times, or to build something from variables and resource attributes. Locals keep the configuration readable and stop the same expression being written five times slightly differently.',
      'An **output** is a **value the module exposes**. For the root module it is printed after apply and readable via `terraform output`; for a child module it is what the caller can reference. Outputs are also how one state file publishes values another can consume through `terraform_remote_state`.',
      'The rule of thumb: variables for things that vary by caller or environment, locals for derived values, outputs for anything a consumer needs.',
    ],
    code: [
      {
        title: 'All three, doing their jobs',
        language: 'hcl',
        code: `variable "environment" {
  type        = string
  description = "dev, staging or prod"
}

variable "project" {
  type    = string
  default = "acme"
}

locals {
  # Derived once, used everywhere - the reason locals exist
  name_prefix = "\${var.project}-\${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = "\${local.name_prefix}-assets"
  tags   = local.common_tags
}

output "bucket_arn" {
  value       = aws_s3_bucket.assets.arn
  description = "Grant this in IAM policies that need asset access."
}`,
      },
    ],
    traps: [
      'Using a variable with a default where a local was meant - callers can then override something that should be fixed.',
      'Outputs that expose sensitive values without `sensitive = true`.',
      'Locals that reference each other in long chains, which becomes hard to follow.',
    ],
    followUps: ['When would you use a local rather than a variable with a default?'],
    tags: ['variables', 'locals', 'outputs', 'hcl', 'fundamentals'],
  },
  {
    id: 'itv-tf-24',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does Terraform work out the order to create resources?',
    probing: 'The dependency graph - implicit versus explicit dependencies.',
    answer: [
      'Terraform builds a **dependency graph** and walks it, creating resources in dependency order and in parallel where there is no dependency (ten at a time by default).',
      'Most dependencies are **implicit**: if resource B references an attribute of resource A - `subnet_id = aws_subnet.main.id` - Terraform knows A must exist first. You should rely on this almost always, because referencing the attribute is both the dependency and the value, so they cannot get out of sync.',
      '**`depends_on`** declares a dependency explicitly, for cases where the ordering requirement is real but not expressed by any reference. The classic example is an IAM role policy that must exist before a service tries to use the role - the resource does not reference the policy, but creating it first matters.',
      'The important caution is that `depends_on` is **often a workaround for a missing reference**. If you find yourself adding it routinely, the usual cause is passing a hardcoded value where an attribute reference would work. And `depends_on` on a **module** makes everything in it wait for everything in the dependency, which can serialise a plan dramatically.',
    ],
    code: [
      {
        title: 'Implicit is better; explicit when there is no reference',
        language: 'hcl',
        code: `# IMPLICIT - the reference IS the dependency. Prefer this.
resource "aws_instance" "web" {
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]
}

# EXPLICIT - the ordering matters but nothing references it
resource "aws_iam_role_policy" "lambda_logs" {
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.logs.json
}

resource "aws_lambda_function" "processor" {
  role = aws_iam_role.lambda.arn

  # Without this, the function can be created before the policy attaches
  # and its first invocation fails on permissions.
  depends_on = [aws_iam_role_policy.lambda_logs]
}`,
      },
      {
        title: 'Look at the graph when ordering is confusing',
        language: 'bash',
        code: `terraform graph | dot -Tsvg > graph.svg

# Or reason about it from the plan
terraform show -json tfplan | jq -r '
  .configuration.root_module.resources[]
  | "\\(.address) -> \\(.depends_on // [] | join(", "))"'`,
      },
    ],
    traps: [
      'Hardcoding an ID instead of referencing the attribute, which removes the dependency Terraform would have inferred.',
      '`depends_on` on a module, serialising far more than intended.',
      'Assuming creation order matches the order in the file. It does not - the graph decides.',
    ],
    followUps: [
      'Why is an implicit dependency better than depends_on?',
      'What is the risk of depends_on on a module?',
    ],
    tags: ['dependencies', 'graph', 'depends_on', 'ordering'],
  },
  {
    id: 'itv-tf-25',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are dynamic blocks and when should you use them?',
    probing: 'A powerful feature that is frequently overused.',
    answer: [
      'A `dynamic` block generates repeated **nested blocks** inside a resource from a collection - several `ingress` rules in a security group, several `setting` blocks in an Elastic Beanstalk environment. Nested blocks cannot use `for_each` directly, so `dynamic` is the mechanism.',
      'It is genuinely useful when the number of nested blocks varies by input - a module that takes a list of ports, for instance.',
      'The caution is readability. A configuration full of dynamic blocks is significantly harder to read than the explicit version, and Terraform’s error messages become much less helpful because they point inside generated content. If a resource has three ingress rules that never change, writing them out is clearer than generating them.',
      'My rule: use `dynamic` when the collection is genuinely variable and comes from a variable. Do not use it to avoid typing three similar blocks.',
    ],
    code: [
      {
        title: 'Dynamic blocks driven by a variable',
        language: 'hcl',
        code: `variable "ingress_rules" {
  type = list(object({
    port        = number
    cidr_blocks = list(string)
    description = string
  }))
  default = [
    { port = 443, cidr_blocks = ["0.0.0.0/0"],   description = "HTTPS" },
    { port = 22,  cidr_blocks = ["10.0.0.0/8"],  description = "SSH from VPN" },
  ]
}

resource "aws_security_group" "web" {
  name   = "web"
  vpc_id = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = "tcp"
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }
}`,
      },
    ],
    traps: [
      'Nested dynamic blocks, which are close to unreadable.',
      'Using `dynamic` for a fixed set of blocks, trading clarity for nothing.',
      'Forgetting that the iterator is named after the block (`ingress.value`), not `each`.',
    ],
    followUps: ['When would writing the blocks out be better?'],
    tags: ['dynamic blocks', 'hcl', 'readability'],
  },
  {
    id: 'itv-tf-26',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'Why are provisioners (`local-exec`, `remote-exec`) discouraged?',
    probing: 'A HashiCorp-documented last resort, and knowing why matters.',
    options: [
      {
        id: 'a',
        text: 'They are not idempotent, run only at create time, and their failures leave resources tainted - Terraform cannot reason about what they did',
      },
      { id: 'b', text: 'They are slower than other approaches' },
      { id: 'c', text: 'They only work on Linux' },
      { id: 'd', text: 'They were removed in recent Terraform versions' },
    ],
    correct: ['a'],
    answer: [
      'The fundamental problem is that Terraform **cannot model what a provisioner does**. Everything else in Terraform has a known desired state that can be compared against reality; a shell script is opaque. So provisioners run **only at create time** (unless they are destroy-time provisioners), are **not idempotent**, and never appear in a plan.',
      'When one fails, Terraform marks the resource **tainted** - it was created but not fully configured - and the next apply destroys and recreates it. That is reasonable behaviour and frequently surprising.',
      'They also introduce **connectivity requirements**: `remote-exec` needs SSH or WinRM reachable from wherever Terraform runs, which often means opening access that would otherwise be unnecessary.',
      'The alternatives are better in every case. Bake configuration into an **image** with Packer. Use **cloud-init** or user data, which the platform runs and which is visible in the resource definition. Use a **configuration management tool** triggered separately. Or use a proper **provider** for the thing you were shelling out to - there is usually one.',
      'The legitimate use is narrow: something genuinely one-off at create time that no provider covers, where you accept it will not be reconciled.',
    ],
    code: [
      {
        title: 'cloud-init instead of remote-exec',
        language: 'hcl',
        code: `# Discouraged: opaque, create-time only, needs SSH reachable
# provisioner "remote-exec" {
#   inline = ["apt-get update", "apt-get install -y nginx"]
# }

# Better: the platform runs it, it is visible in the resource, no SSH needed
resource "aws_instance" "web" {
  ami           = data.aws_ami.base.id
  instance_type = "t3.micro"

  user_data = templatefile("\${path.module}/cloud-init.yaml", {
    app_version = var.app_version
  })

  # Changing user_data replaces the instance - which is usually correct
  user_data_replace_on_change = true
}`,
      },
    ],
    traps: [
      'A provisioner that fails, tainting the resource, so the next apply recreates a database.',
      'Expecting a provisioner to re-run when its script changes. It will not.',
      'Opening SSH to the world so `remote-exec` can reach an instance.',
    ],
    followUps: ['What would you use instead for configuring a new instance?'],
    tags: ['provisioners', 'anti-pattern', 'cloud-init', 'packer'],
  },
  {
    id: 'itv-tf-27',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you test Terraform code?',
    probing:
      'Testing infrastructure is genuinely hard; the layered answer is what distinguishes a senior candidate.',
    answer: [
      'I would think of it in layers, cheapest and fastest first.',
      '**Static checks**: `terraform validate` for syntax and type errors, `terraform fmt -check` for formatting, and **tflint** for provider-specific mistakes - an invalid instance type, a deprecated argument. These take seconds and catch a surprising amount.',
      '**Policy as code**: run **Conftest/OPA**, **Checkov** or **tfsec** against the **plan JSON**. This is the highest-value layer for most teams, because it catches the class of problem review misses - an unencrypted bucket, a security group open to the world, a resource without required tags - and it does so without creating anything.',
      '**Unit-ish tests**: the native `terraform test` framework runs a configuration with given variables and asserts on plan output or on applied resources. Good for module logic - does setting `enabled = false` really create nothing?',
      '**Integration tests**: **Terratest** applies the configuration into a real throwaway environment, asserts that things actually work (the load balancer serves traffic, the database accepts a connection), and destroys it. Slow and costs money, so reserve it for modules many teams depend on.',
      'The honest note: full integration testing every module is rarely worth it. Static analysis and policy checks on every pull request, plus integration tests on the handful of shared modules, is the pragmatic balance.',
    ],
    code: [
      {
        title: 'A policy check against the plan',
        language: 'bash',
        code: `terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# OPA/Conftest policies, run against the plan - nothing is created
conftest test --policy ./policies plan.json

# Or a scanner with a large built-in ruleset
checkov -f plan.json --framework terraform_plan --compact`,
      },
      {
        title: 'A native terraform test',
        language: 'hcl',
        code: `# tests/defaults.tftest.hcl
variables {
  environment = "dev"
  project     = "acme"
}

run "creates_bucket_with_expected_name" {
  command = plan

  assert {
    condition     = aws_s3_bucket.assets.bucket == "acme-dev-assets"
    error_message = "bucket name did not follow the naming convention"
  }
}

run "disabled_creates_nothing" {
  command = plan
  variables { enabled = false }

  assert {
    condition     = length(aws_s3_bucket.assets) == 0
    error_message = "resources were created despite enabled = false"
  }
}`,
      },
    ],
    deeper: [
      'Testing against the **plan** rather than applied infrastructure gives most of the value at a fraction of the cost and time.',
      'Terratest needs a disposable account and reliable cleanup, or failed tests leave resources behind and cost money indefinitely.',
      'Policy as code doubles as documentation of the standards, which is worth as much as the enforcement.',
    ],
    traps: [
      'Only running `validate` and calling it tested - it checks syntax, not behaviour or safety.',
      'Integration tests with no cleanup on failure.',
      'Policies so strict that teams route around them.',
    ],
    followUps: [
      'Which layer gives the best return for the effort?',
      'How would you test that a module creates nothing when disabled?',
    ],
    tags: ['testing', 'policy as code', 'terratest', 'opa', 'advanced'],
  },
  {
    id: 'itv-tf-28',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are provider version constraints and why do they matter?',
    probing: 'Reproducibility. The lock file is the key part of the answer.',
    answer: [
      '`required_providers` declares which providers a configuration needs and which versions are acceptable. Without a constraint, `terraform init` takes the newest available - so a configuration that worked last week can behave differently today because a provider released a new major version.',
      'The idiomatic constraint is the **pessimistic operator**: `~> 5.70` allows 5.70.x and any 5.x above it but not 6.0, so you get bug fixes and new features without a major version’s breaking changes.',
      'The **lock file** (`.terraform.lock.hcl`) is what actually makes it reproducible. It records the exact versions selected and their checksums, and it should be **committed**. Then every developer, and CI, uses identical provider versions - otherwise you get behaviour differences between a laptop and the pipeline with no code change to explain them.',
      'Upgrading is then deliberate: `terraform init -upgrade` within the constraint, or a change to the constraint for a major bump, either way producing a lock file change that is reviewed like any other.',
      'The same reasoning applies to `required_version` for Terraform itself, since state written by a newer version cannot be read by an older one.',
    ],
    code: [
      {
        title: 'Constraints and the lock file',
        language: 'hcl',
        code: `terraform {
  required_version = "~> 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"        # 5.70.x and later 5.x, never 6.0
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}`,
      },
    ],
    traps: [
      'No version constraint, so a provider major release changes behaviour unexpectedly.',
      'Not committing the lock file, so CI and local machines differ.',
      'Pinning to an exact version forever and falling years behind, which makes the eventual upgrade painful.',
      "Forgetting that a newer Terraform writes state an older one cannot read - upgrading one person's CLI can block the rest of the team.",
    ],
    followUps: [
      'What breaks if the lock file is not committed?',
      'Why does `required_version` matter for a team?',
    ],
    tags: ['providers', 'versioning', 'lock file', 'reproducibility'],
  },
  {
    id: 'itv-tf-29',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A `terraform plan` shows it will destroy and recreate your production database. How do you find out why, and what do you do?',
    probing: 'Reading a plan carefully under pressure, and knowing the safety mechanisms.',
    answer: [
      '**Do not apply.** Then find out which attribute is forcing it, because the plan tells you directly - Terraform annotates the specific attribute with `# forces replacement`. That single line is the whole diagnosis.',
      'The usual causes: an attribute that genuinely cannot be changed in place (a database engine version downgrade, an availability zone, a subnet group), a **provider upgrade** that changed a default, someone renaming a resource so Terraform sees a delete and a create rather than a rename, or a **data source** whose value moved - `most_recent = true` on an AMI being the classic.',
      'The response depends on the cause. If it is a **rename or refactor**, use a `moved` block or `terraform state mv` so Terraform understands it is the same resource. If it is a **changed default from a provider upgrade**, set the attribute explicitly to the current value so there is no diff. If the change is **genuinely necessary**, plan it as a real migration - snapshot, new instance, data migration, cutover - not as a Terraform apply.',
      'And I would add `prevent_destroy = true` to the database if it is not already there, so this cannot be applied accidentally by anyone in future. That turns a catastrophic possibility into a plan error.',
      'The broader lesson: plans must be read, not skimmed. In CI I would add a check that **fails any plan containing a destroy of a stateful resource** unless explicitly approved, because relying on human attention to catch this every time is not a control.',
    ],
    code: [
      {
        title: 'Find the forcing attribute, and guard against it',
        language: 'bash',
        code: `# The plan says exactly which attribute is responsible
terraform plan -out=tfplan
terraform show tfplan | grep -B5 'forces replacement'

# Machine-readable: which resources are being replaced?
terraform show -json tfplan | jq -r '
  .resource_changes[]
  | select(.change.actions == ["delete","create"] or .change.actions == ["create","delete"])
  | .address'`,
      },
      {
        title: 'A rename should be a moved block, not a destroy',
        language: 'hcl',
        code: `# Renaming a resource without this looks like delete + create
moved {
  from = aws_db_instance.database
  to   = aws_db_instance.primary
}

resource "aws_db_instance" "primary" {
  # ...
  lifecycle {
    prevent_destroy = true      # this plan would now fail instead of destroying
  }
}`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why is it being replaced?',
        caption: 'The plan names the forcing attribute - read it before doing anything else.',
        question: 'What does "forces replacement" point at?',
        branches: [
          {
            condition: 'The resource was renamed in code',
            result: 'moved block or state mv',
            detail: 'Same resource, new address',
            tone: 'success',
          },
          {
            condition: 'A provider upgrade changed a default',
            result: 'Set the attribute explicitly',
            detail: 'Pin it to the current value',
            tone: 'accent',
          },
          {
            condition: 'A data source value changed',
            result: 'Pin the data source',
            detail: 'most_recent = true is the usual culprit',
            tone: 'warning',
          },
          {
            condition: 'The change is genuinely immutable',
            result: 'Plan a real migration',
            detail: 'Snapshot, migrate, cut over - not an apply',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      '`prevent_destroy` on every stateful resource should be the default, not an exception.',
      'A CI check that fails on any destroy of a resource tagged as stateful catches this reliably, where human review does not.',
      '`create_before_destroy` does not help for a database - the new one would be empty.',
      'Deletion protection at the cloud provider level is a second, independent safety net that Terraform cannot override.',
    ],
    traps: [
      'Skimming a long plan and missing the replacement.',
      'Assuming a rename is safe without a `moved` block.',
      'Using `-target` to apply "just the safe parts", which leaves state and reality inconsistent.',
      'Relying on people reading plans carefully as your only protection.',
    ],
    followUps: [
      'How would you make this impossible to apply by accident?',
      'The change is genuinely required. How would you do it safely?',
    ],
    tags: ['scenario', 'plan', 'safety', 'production', 'advanced'],
  },
  {
    id: 'itv-tf-30',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are the most useful built-in functions, and what would you use them for?',
    probing: 'Practical HCL fluency.',
    answer: [
      'The ones that come up constantly: **`merge`** for combining tag maps so common tags apply everywhere with per-resource additions; **`lookup`** and **`try`** for reading optional values with a fallback; **`coalesce`** for the first non-null of several options; **`templatefile`** for rendering a file with variables, which is how user data and config files are generated; **`jsonencode`** and **`yamlencode`** for building policy documents and manifests without string concatenation.',
      'For collections: **`for` expressions** to transform lists and maps, **`toset`** to convert a list for `for_each`, **`flatten`** for nested structures, and **`zipmap`** to build a map from two lists.',
      'For strings and networks: **`format`**, **`join`**, **`split`**, **`replace`**, and **`cidrsubnet`**, which calculates subnet ranges from a base CIDR - genuinely useful for generating a per-AZ subnet layout without hardcoding.',
      'The one I would emphasise is **`jsonencode` for IAM policies**. Writing JSON as a string literal loses syntax checking and makes interpolation awkward; `jsonencode` gives you a native HCL structure that is validated and readable.',
    ],
    code: [
      {
        title: 'Functions doing real work',
        language: 'hcl',
        code: `locals {
  common_tags = { Project = var.project, ManagedBy = "terraform" }

  # merge: shared tags plus per-resource ones
  bucket_tags = merge(local.common_tags, { Purpose = "assets" })

  # cidrsubnet: derive a /24 per AZ from a /16 without hardcoding
  subnets = {
    for i, az in var.availability_zones :
    az => cidrsubnet(var.vpc_cidr, 8, i)
  }

  # try: tolerate a missing optional value
  log_level = try(var.config.log_level, "info")
}

resource "aws_iam_role_policy" "assets" {
  role = aws_iam_role.app.id

  # jsonencode: validated, readable, interpolates naturally
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "\${aws_s3_bucket.assets.arn}/*"
    }]
  })
}`,
      },
      {
        title: 'Try expressions interactively',
        language: 'bash',
        code: `terraform console
> cidrsubnet("10.0.0.0/16", 8, 3)
"10.0.3.0/24"
> merge({a = 1}, {b = 2})
{ "a" = 1, "b" = 2 }
> [for s in ["a","b"] : upper(s)]
[ "A", "B" ]`,
        explanation:
          '`terraform console` is the fastest way to work out what a function does - use it rather than guessing.',
      },
    ],
    traps: [
      'Building JSON with string concatenation instead of `jsonencode`.',
      '`lookup` on a map that might not have the key and no default, which errors at plan time.',
      'Deeply nested `for` expressions that nobody can read - a local with an intermediate step is clearer.',
    ],
    followUps: ['Why is `jsonencode` better than a JSON string literal for IAM policies?'],
    tags: ['functions', 'hcl', 'expressions', 'practical'],
  },
  {
    id: 'itv-tf-31',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you structure Terraform for a large organisation with many teams?',
    probing:
      'Organisational design at scale - the answer should be about ownership and blast radius.',
    answer: [
      'The organising principle is **blast radius and ownership**. One enormous state file means every change risks everything, plans take many minutes, and one lock blocks everyone. So I would split state along the lines of **who owns what** and **what changes together**.',
      'A typical split: a **platform layer** owned by a central team (networking, shared accounts, DNS, cluster infrastructure), and **application layers** owned by product teams, with separate state per team per environment. Applications consume platform values through **data sources or remote state outputs**, not by duplicating them.',
      '**Shared modules** in a central, versioned repository give the standard patterns - a compliant S3 bucket, a standard service deployment - so teams do not each reinvent them and so security requirements are encoded once. Pinned by version so a module change does not reach everyone at once.',
      '**Guardrails rather than gates**: policy as code in every pipeline enforcing tagging, encryption, allowed regions and instance types. That lets teams move without a central approval queue, while making non-compliant infrastructure impossible rather than merely discouraged.',
      "And **cloud account separation** matching the state separation, so a team's credentials cannot reach another team's infrastructure regardless of what their Terraform says.",
      'The failure mode to design against is the central team becoming a bottleneck. If every change needs the platform team to apply it, teams start working around Terraform. Modules and policy let you decentralise the work while keeping the standards.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'State split by ownership',
        caption: 'Each box is a separate state file with its own lock, lifecycle and owning team.',
        root: {
          label: 'Terraform estate',
          children: [
            {
              label: 'Shared modules repo (versioned)',
              detail: 'Standard patterns, security encoded once',
              tone: 'accent',
            },
            {
              label: 'Platform layer - central team',
              detail: 'Separate state per environment',
              tone: 'warning',
              children: [
                { label: 'network/prod', detail: 'VPC, transit gateway, DNS' },
                { label: 'clusters/prod', detail: 'EKS, node groups' },
              ],
            },
            {
              label: 'Application layers - product teams',
              detail: 'Consume platform outputs, own their state',
              tone: 'success',
              children: [{ label: 'team-a/prod' }, { label: 'team-b/prod' }],
            },
          ],
        },
      },
    ],
    deeper: [
      "Prefer **data sources** over `terraform_remote_state` where possible - reading another team's state file couples you to its internal structure, while a data source queries the real resource.",
      'Publish platform values through a stable interface (SSM parameters, for instance) so consumers depend on a contract rather than on a state layout.',
      'Automate module upgrades with Dependabot or Renovate, so pinning does not mean falling behind.',
      'Measure plan duration. It is the clearest signal that a state file has grown too large.',
    ],
    traps: [
      'One state file for everything, so every apply is high-risk and slow.',
      'The platform team as a manual approval step for every change.',
      "Teams reading each other's remote state directly, creating tight coupling.",
      'Modules unversioned, so a central change breaks every team simultaneously.',
    ],
    followUps: [
      'How do application teams get the VPC ID without duplicating it?',
      'How do you avoid the platform team becoming a bottleneck?',
    ],
    tags: ['structure', 'scale', 'organisation', 'modules', 'advanced'],
  },
  {
    id: 'itv-tf-32',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `terraform destroy` do, and how do you limit the damage it can cause?',
    probing: 'A dangerous command and the guardrails around it.',
    options: [
      {
        id: 'a',
        text: 'Destroys every resource in the current state; limit it with `prevent_destroy`, separate state per component, and restricted credentials',
      },
      { id: 'b', text: 'Deletes the state file but leaves resources running' },
      { id: 'c', text: 'Removes resources from state without deleting them' },
      { id: 'd', text: 'Reverts the last apply' },
    ],
    correct: ['a'],
    answer: [
      '`terraform destroy` deletes **every resource in the current state**, in reverse dependency order. It is not a rollback and it is not selective - it is the complete teardown of whatever that state file manages.',
      'The option that removes a resource from state **without** deleting it is `terraform state rm`, which is a completely different operation and worth not confusing.',
      'The protections that matter, in order: **`prevent_destroy = true`** on stateful resources, which makes the plan fail rather than proceed; **separate state per component**, so a destroy in one place cannot take out everything; **deletion protection at the cloud provider**, which Terraform cannot override; and **credentials that cannot delete production resources** from wherever destroy might be run.',
      'It is genuinely useful for tearing down ephemeral environments - review environments, test infrastructure - which is an argument for keeping those in their own state files where destroy is a normal operation.',
    ],
    traps: [
      'Running destroy in the wrong directory or workspace.',
      'Relying only on the confirmation prompt, which people type through.',
      'Confusing `destroy` with `state rm`.',
    ],
    followUps: ['How would you make it impossible to destroy the production database?'],
    tags: ['destroy', 'safety', 'state', 'fundamentals'],
  },
  {
    id: 'itv-tf-33',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you handle resources that must exist before Terraform runs - the bootstrap problem?',
    probing: 'The chicken-and-egg of the state backend, which everyone hits once.',
    answer: [
      'The problem is that Terraform needs a state backend, but the backend itself - an S3 bucket, a KMS key - is infrastructure that you would want Terraform to manage. It cannot store its own state in a bucket that does not exist yet.',
      'The standard solution is a small, separate **bootstrap configuration** that creates the backend resources using **local state**. You run it once, then migrate its own state into the bucket it just created by adding the backend block and running `terraform init -migrate-state`. After that it manages itself.',
      'The bootstrap configuration should be deliberately minimal - the state bucket with versioning and encryption, the KMS key, and the IAM roles needed to use them. Everything else belongs in a normal configuration.',
      'The alternative some organisations prefer is to create those few resources **by hand or by script** and document them as unmanaged. That is defensible for a handful of foundational resources, provided it is written down - the failure mode is an undocumented manual resource that nobody knows exists until it breaks.',
      "The same reasoning applies to anything genuinely pre-existing: an organisation's root account, a DNS zone delegated by a registrar, an identity provider. Import them or document them; do not leave the situation ambiguous.",
    ],
    code: [
      {
        title: 'Bootstrap, then migrate its own state',
        language: 'bash',
        code: `# 1. In bootstrap/, with NO backend block - local state
terraform init
terraform apply     # creates the state bucket, KMS key and roles

# 2. Add the backend block referring to the bucket just created:
#    terraform { backend "s3" { bucket = "acme-tfstate" ... } }

# 3. Migrate the local state into it
terraform init -migrate-state

# 4. The local state file is now redundant - remove it deliberately
rm terraform.tfstate terraform.tfstate.backup`,
      },
    ],
    traps: [
      "Leaving the bootstrap state local on someone's laptop permanently.",
      'A bootstrap configuration that grows until it manages half the estate.',
      'Manual foundational resources that are never documented.',
      'Deleting the local state before confirming the migration worked.',
    ],
    followUps: ['What belongs in the bootstrap configuration and what does not?'],
    tags: ['bootstrap', 'backend', 'state', 'setup'],
  },
  {
    id: 'itv-tf-34',
    level: 'advanced',
    kind: 'open',
    prompt: 'Compare Terraform with Pulumi, CDK and Crossplane.',
    probing: 'Awareness of the wider IaC landscape and honest trade-offs.',
    answer: [
      '**Terraform** uses HCL, a declarative configuration language. Its strengths are the enormous provider ecosystem, a mature module registry, and the fact that the configuration is limited - you cannot write arbitrary logic, which keeps it readable and reviewable. Its weaknesses are that HCL gets awkward for complex logic, and state management is a real operational burden.',
      '**Pulumi** and **CDK** let you write infrastructure in a general-purpose language - TypeScript, Python, Go. That gives you real abstractions, types, loops, testing frameworks and IDE support. The cost is that you can write infrastructure code that is genuinely hard to review, because a plan is no longer a straightforward reading of the source. CDK compiles to CloudFormation and is AWS-only; Pulumi is multi-cloud and manages its own state.',
      '**Crossplane** is different in kind. It runs **inside Kubernetes** and manages cloud infrastructure through the Kubernetes API, using controllers that **continuously reconcile** - so drift is corrected automatically rather than detected at the next plan. It fits organisations already invested in Kubernetes and GitOps, and it lets a platform team publish composite resources that application teams consume as ordinary Kubernetes objects.',
      'How I would choose: **Terraform** as the default, because the ecosystem and the hiring pool are unmatched and the constrained language is a feature for reviewability. **Pulumi or CDK** when the team is strongly software-engineering oriented and the infrastructure genuinely needs abstraction. **Crossplane** when you are already all-in on Kubernetes and want continuous reconciliation and a self-service platform API.',
      'The honest point is that the differences matter much less than the discipline around whichever you pick - review, testing, state or reconciliation hygiene, and not making changes outside the tool.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which IaC tool?',
        caption: 'The discipline around the tool matters more than the choice between them.',
        question: 'What fits the team and the platform?',
        branches: [
          {
            condition: 'General purpose, broad ecosystem, mixed team',
            result: 'Terraform',
            detail: 'The safe default',
            tone: 'success',
          },
          {
            condition: 'Strong software engineering team, complex abstractions',
            result: 'Pulumi or CDK',
            detail: 'Real language, real tests - and real rope',
            tone: 'accent',
          },
          {
            condition: 'Kubernetes-centric with GitOps',
            result: 'Crossplane',
            detail: 'Continuous reconciliation, self-service API',
            tone: 'accent',
          },
          {
            condition: 'AWS only, want no state to manage',
            result: 'CDK / CloudFormation',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      "Crossplane's continuous reconciliation is a genuine advantage over Terraform's point-in-time apply - drift is corrected rather than reported.",
      'OpenTofu is a fork of Terraform after the licence change; for most purposes it is a drop-in alternative and worth knowing exists.',
      "Terraform's constrained language is often argued as a weakness and is arguably its greatest strength - a reviewer can read the configuration and know what it does.",
    ],
    traps: [
      'Choosing Pulumi for the language and producing infrastructure nobody can review.',
      'Adopting Crossplane without Kubernetes expertise, which adds a large operating burden.',
      'Treating the choice as more important than the process around it.',
    ],
    followUps: [
      'What does Crossplane do that Terraform does not?',
      'When would a general-purpose language be a liability?',
    ],
    tags: ['comparison', 'pulumi', 'cdk', 'crossplane', 'strategy', 'advanced'],
  },
  {
    id: 'itv-tf-35',
    level: 'basic',
    kind: 'open',
    prompt: 'What does it mean that Terraform is declarative, and why does that matter?',
    probing: 'A foundational concept, phrased simply.',
    answer: [
      'Declarative means you describe **the end state you want**, not the steps to reach it. You write "there should be three instances of this type in this subnet", and Terraform works out whether to create, update or destroy anything to make that true.',
      'The contrast is an **imperative** script: "create an instance, then attach a volume, then update the load balancer". That script only works from a known starting point. Run it twice and you get six instances; run it against a half-configured environment and it fails or does something unintended.',
      'Because Terraform compares desired state against actual state, running it repeatedly is **safe and converges** - applying the same configuration twice makes no changes the second time. That property, idempotence, is what lets infrastructure changes be routine rather than frightening.',
      'It also means the configuration **is** the documentation. A script tells you what someone did once; a declarative configuration tells you what should exist right now.',
    ],
    traps: [
      'Writing Terraform as though it were a sequence of steps and being surprised by the order it actually uses.',
      'Reaching for provisioners to run imperative scripts, which reintroduces every problem declarative infrastructure solves.',
    ],
    followUps: ['Why is it safe to run `terraform apply` twice?'],
    tags: ['declarative', 'idempotence', 'fundamentals', 'concepts'],
  },
]
