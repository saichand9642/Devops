import type { InterviewQuestion } from '../../../types'

/** Day-to-day Terraform practice: refactoring, upgrades, multi-cloud and habits. */
export const terraformPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-tf-36',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you rename or move a resource without destroying it?',
    probing: 'Refactoring safely - `moved` blocks are the modern answer.',
    answer: [
      'Terraform identifies resources by their **address** in the configuration, not by their name attribute. Rename `aws_instance.web` to `aws_instance.api` and Terraform sees one resource disappear and a new one appear - so it plans a destroy and a create.',
      'The modern fix is a **`moved` block**, which declaratively tells Terraform the address changed. It appears in the plan as a move rather than a replacement, it is committed with the code so the change is reviewable, and it works for anyone who applies afterwards - including CI, which a manual state command does not.',
      'The older approach is `terraform state mv`, run imperatively by whoever does the refactor. It works, but it leaves no record, and everyone else and the pipeline need the same command run in the right place.',
      '`moved` blocks also handle moving a resource **into or out of a module**, and changing from `count` to `for_each` - both of which would otherwise be very destructive. Once every state has been applied, the block can be removed.',
    ],
    code: [
      {
        title: 'Renames, module moves and count-to-for_each',
        language: 'hcl',
        code: `# Simple rename
moved {
  from = aws_instance.web
  to   = aws_instance.api
}

# Moving a resource into a module
moved {
  from = aws_s3_bucket.assets
  to   = module.storage.aws_s3_bucket.assets
}

# count -> for_each, which would otherwise destroy everything
moved {
  from = aws_iam_user.team[0]
  to   = aws_iam_user.team["alice"]
}
moved {
  from = aws_iam_user.team[1]
  to   = aws_iam_user.team["bob"]
}`,
      },
      {
        title: 'The imperative equivalent, if you must',
        language: 'bash',
        code: `terraform state list                       # find the exact current addresses
terraform state mv aws_instance.web aws_instance.api
terraform plan                             # must show no changes`,
        explanation: 'A clean plan afterwards is the confirmation that the move worked.',
      },
    ],
    traps: [
      'Renaming without a `moved` block and applying the resulting destroy.',
      '`state mv` run locally, so CI still plans a replacement.',
      'Forgetting that a `moved` block is needed for every instance when converting count to for_each.',
    ],
    followUps: ['Why is a `moved` block better than `terraform state mv`?'],
    tags: ['refactoring', 'moved', 'state', 'safety'],
  },
  {
    id: 'itv-tf-37',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you upgrade a provider major version safely?',
    probing: 'Change management for something that can silently plan destructive changes.',
    answer: [
      'The risk with a major version is that **defaults and behaviours change**, so a configuration that produced no diff yesterday can plan replacements today - without any change to your code.',
      'The process I would follow: **read the upgrade guide first**, since providers publish one for every major version listing removed arguments and changed defaults. Then upgrade in a **non-production environment**, run `plan`, and read it carefully - the goal is to understand every difference, not to get to a clean plan by trial and error.',
      'Differences fall into three kinds. Ones caused by **changed defaults**, which you fix by setting the attribute explicitly to its current value. Ones caused by **renamed or removed arguments**, which you fix by updating the configuration. And ones that indicate a **genuine behavioural change** you need to accept deliberately.',
      'Then promote through environments in order, one state at a time, with the **lock file committed** at each step so the version is pinned consistently. Upgrading everything at once removes the ability to learn from the first environment.',
      'And upgrade **regularly**. A provider three major versions behind is a much harder upgrade than three upgrades done as they arrived, and being far behind also means missing security fixes.',
    ],
    code: [
      {
        title: 'Upgrade one environment at a time',
        language: 'bash',
        code: `# 1. Widen the constraint deliberately
#    version = "~> 5.70"  ->  version = "~> 6.0"

# 2. Pull the new provider and update the lock file
terraform init -upgrade

# 3. Read the plan properly - what changed and why?
terraform plan -out=tfplan
terraform show tfplan | grep -B5 'forces replacement'

# 4. Only when the diff is understood, apply in dev. Then staging. Then prod.
git add .terraform.lock.hcl && git commit -m 'chore: aws provider 6.x in dev'`,
      },
    ],
    traps: [
      'Running `-upgrade` in production first.',
      'Accepting a plan with replacements without understanding them.',
      'Not committing the lock file, so environments end up on different versions.',
      'Deferring upgrades until the jump is several major versions.',
    ],
    followUps: [
      'The plan shows a replacement after the upgrade. What are the possible causes?',
      'Why upgrade regularly rather than when you need a new feature?',
    ],
    tags: ['providers', 'upgrades', 'change management', 'lock file'],
  },
  {
    id: 'itv-tf-38',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you manage Kubernetes resources - with Terraform, or with something else?',
    probing:
      'A real architectural boundary question. The strong answer draws a line rather than picking a side.',
    answer: [
      'I would draw a line between **cluster infrastructure** and **workloads running on it**, and use different tools for each.',
      'Terraform is a good fit for the **cluster and its cloud dependencies**: the EKS or GKE cluster itself, node groups, IAM roles and IRSA bindings, the VPC, the load balancers, managed databases the applications use. These are cloud resources with cloud lifecycles, and Terraform manages them well.',
      'Terraform is a **poor fit for workloads**. Deployments, Services, ConfigMaps change many times a day, and Terraform’s model - plan, apply, done - does not match. It does not reconcile continuously, so drift persists until someone runs a plan; rollouts are not something it can watch; and every application deploy becoming a Terraform apply puts the platform team in the path of every release.',
      'For workloads I would use **GitOps** - Argo CD or Flux - which reconciles continuously, understands Kubernetes health and rollout status, and lets application teams deploy without touching infrastructure state.',
      'The awkward middle is **cluster add-ons** - ingress controllers, cert-manager, the metrics server. These are arguably infrastructure and often installed with the Terraform Helm provider. That works, but it couples add-on upgrades to Terraform runs, and the Kubernetes and Helm providers have a genuine problem: they need the cluster to exist to plan against, so a single configuration that creates a cluster **and** deploys into it fails on a clean run. Separating them into different states - or managing add-ons with GitOps too - avoids that entirely.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Terraform or GitOps for this resource?',
        caption: 'The dividing question is how often it changes and who owns it.',
        question: 'What kind of thing is being managed?',
        branches: [
          {
            condition: 'Cluster, node groups, cloud IAM, databases',
            result: 'Terraform',
            detail: 'Cloud lifecycle, changes rarely',
            tone: 'success',
          },
          {
            condition: 'Deployments, Services, application config',
            result: 'GitOps (Argo CD / Flux)',
            detail: 'Continuous reconciliation, team-owned',
            tone: 'success',
          },
          {
            condition: 'Cluster add-ons (ingress, cert-manager)',
            result: 'Either - but in a separate state',
            detail: 'Never the same state as the cluster',
            tone: 'warning',
          },
          {
            condition: 'One config creating a cluster and deploying to it',
            result: 'Will fail on a clean run',
            detail: 'The provider cannot plan against a cluster that does not exist',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'The Kubernetes provider requires cluster credentials at **plan** time, which is why combining cluster creation and workload deployment in one configuration breaks from scratch even though it works on a re-apply.',
      'Crossplane occupies the middle ground - cloud resources managed through Kubernetes with continuous reconciliation - and is worth mentioning if the organisation is Kubernetes-centric.',
      'Application teams needing a Terraform apply to deploy is an organisational smell, not just a technical one.',
    ],
    traps: [
      'Managing Deployments in Terraform and finding drift persists until someone runs a plan.',
      'One configuration that creates the cluster and deploys into it.',
      'The platform team becoming the deployment bottleneck for every application.',
    ],
    followUps: [
      'Why does a single config creating and deploying to a cluster fail on a clean run?',
      'Where would you manage cert-manager?',
    ],
    tags: ['kubernetes', 'gitops', 'boundaries', 'architecture', 'advanced'],
  },
  {
    id: 'itv-tf-39',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does `terraform taint` (or its modern replacement) do?',
    probing: 'Forcing replacement - and knowing the command was superseded.',
    options: [
      {
        id: 'a',
        text: 'Marks a resource for replacement on the next apply - now done with `terraform apply -replace=ADDRESS`',
      },
      { id: 'b', text: 'Removes the resource from state without deleting it' },
      { id: 'c', text: 'Prevents the resource from being modified' },
      { id: 'd', text: 'Marks the resource as sensitive so it is hidden in output' },
    ],
    correct: ['a'],
    answer: [
      'Tainting marks a resource as degraded so the next apply **destroys and recreates it**. The `terraform taint` command is deprecated in favour of **`terraform apply -replace=aws_instance.web`**, which is better because the replacement appears in the **plan** and can be reviewed before it happens - the old command changed state immediately with no preview.',
      'It is useful when a resource exists and is recorded correctly but is **broken in a way Terraform cannot see** - a provisioner failed halfway, an instance is in a bad state, a certificate needs regenerating. Terraform has no way to detect that from the configuration, so you tell it.',
      'Terraform also taints resources itself when a **provisioner fails**, since it knows the resource was created but not fully configured.',
      'The thing to be careful about is that replacement is destructive. On a stateful resource it means data loss, which is a good argument for `prevent_destroy` on anything that holds data.',
    ],
    code: [
      {
        title: 'Replace with a plan you can review',
        language: 'bash',
        code: `# Preview what replacing this will do
terraform plan -replace=aws_instance.web -out=tfplan
terraform show tfplan

terraform apply tfplan

# Deprecated equivalent - changes state immediately, no preview
# terraform taint aws_instance.web`,
      },
    ],
    traps: [
      'Replacing a stateful resource and losing its data.',
      'Using replacement to work around a configuration problem rather than fixing it.',
      'Forgetting that a failed provisioner taints the resource, so the next apply recreates it unexpectedly.',
    ],
    followUps: ['Why is `-replace` better than the old `taint` command?'],
    tags: ['taint', 'replace', 'workflow', 'cli'],
  },
  {
    id: 'itv-tf-40',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Two engineers applied at the same time and the state is now inconsistent - some real resources are not in state. How do you recover?',
    probing: 'State recovery under pressure, and the preventive fix.',
    answer: [
      'First **stop further applies** - tell the team, and if necessary remove apply permissions temporarily. Every additional apply against inconsistent state makes the reconciliation harder.',
      'Then **establish what actually exists**. Compare `terraform state list` against the real resources in the provider, for the components involved. A plan will also tell you a lot: resources Terraform wants to **create** that already exist are the orphans; resources it wants to **destroy** that you know are needed may be entries pointing at things that were removed.',
      'Then reconcile in the safer direction. For resources that **exist but are not in state**, `import` them - this is additive and cannot destroy anything. For state entries pointing at resources that **no longer exist**, `state rm` removes the entry without touching infrastructure. Both operations are non-destructive to real resources, which is why this order matters.',
      'If state is badly damaged rather than merely incomplete, **restore the previous version** from the versioned backend and re-plan from there. That is usually cleaner than reconciling entry by entry.',
      'Throughout, **back up the current state** before each operation so every step is reversible.',
      'The preventive fix is the real answer: **state locking** would have prevented this entirely. If it was not enabled, enabling it is the action item. If it was enabled and this still happened, the cause is usually two different backend configurations pointing at the same resources, or someone using local state - both worth finding.',
    ],
    code: [
      {
        title: 'Reconcile in the non-destructive direction',
        language: 'bash',
        code: `# 0. Back up before touching anything
terraform state pull > state-backup-$(date +%s).json

# 1. What does Terraform think exists, and what does the cloud say?
terraform state list | sort > /tmp/in-state.txt
aws ec2 describe-instances \\
  --filters Name=tag:ManagedBy,Values=terraform \\
  --query 'Reservations[].Instances[].InstanceId' --output text | tr '\\t' '\\n' | sort > /tmp/real.txt
comm -13 /tmp/in-state.txt /tmp/real.txt   # exists but unmanaged

# 2. Adopt orphans - additive, cannot destroy anything
terraform import aws_instance.worker i-0abc123

# 3. Drop stale entries - removes from state only
terraform state rm aws_instance.deleted_thing

# 4. Confirm
terraform plan      # should be empty, or show only intended changes`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Recovering inconsistent state',
        caption:
          'Import and state rm are both non-destructive to real infrastructure - do those before anything else.',
        nodes: [
          { label: 'Stop further applies', detail: 'Every apply makes it worse', tone: 'danger' },
          { label: 'Back up current state', detail: 'terraform state pull' },
          {
            label: 'Diff state against reality',
            detail: 'What is orphaned, what is stale',
            tone: 'accent',
          },
          { label: 'Import orphans', detail: 'Additive and safe' },
          { label: 'state rm stale entries', detail: 'Removes the entry, not the resource' },
          { label: 'Plan until clean', tone: 'success' },
          { label: 'Enable locking so it cannot recur', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Bucket versioning on the state object is what makes "restore the previous version" possible - without it this is much harder.',
      'The most common cause of this after locking is enabled is a second backend configuration, or someone running with local state.',
      'Smaller state files reduce the scope of any such incident, which is another argument for splitting.',
    ],
    traps: [
      'Continuing to apply while investigating.',
      'Hand-editing the state JSON.',
      '`state rm` on something that does still exist, which orphans it.',
      'Fixing the state and not fixing the lack of locking.',
    ],
    followUps: [
      'How would locking have prevented this?',
      'When would you restore the previous state version instead of reconciling?',
    ],
    tags: ['scenario', 'state', 'recovery', 'locking', 'advanced'],
  },
  {
    id: 'itv-tf-41',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you share values between separate Terraform configurations?',
    probing: 'Cross-state communication, and the coupling it creates.',
    answer: [
      'There are three approaches, with different amounts of coupling.',
      '**`terraform_remote_state`** reads another configuration’s state file directly and exposes its outputs. It is simple and needs no extra infrastructure, but it couples you to that state’s **location and internal structure**, and it requires read access to a state file containing all of that configuration’s secrets. I would avoid it where there is an alternative.',
      '**Data sources** query the provider for the real resource - looking up a VPC by tag, for instance. This is usually better because you depend on the **infrastructure**, not on another team’s state layout, and the dependency survives the other team restructuring their configuration entirely.',
      '**A published interface**: the producing configuration writes values to a known location - SSM Parameter Store, Consul, a config bucket - and consumers read from there. This is the most decoupled: the contract is explicit, versionable and documented, and neither side can see the other’s state.',
      'For anything crossing a team boundary I would use a data source or a published interface. `terraform_remote_state` is acceptable within a single team’s own configurations, where the coupling is not a problem.',
    ],
    code: [
      {
        title: 'The three approaches',
        language: 'hcl',
        code: `# 1. remote_state - simple, but couples to state layout and needs read access
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "acme-tfstate-prod"
    key    = "platform/network/terraform.tfstate"
    region = "eu-west-1"
  }
}
# use: data.terraform_remote_state.network.outputs.vpc_id

# 2. Data source - depends on reality, not on their state file
data "aws_vpc" "main" {
  tags = { Name = "prod-main", ManagedBy = "terraform" }
}

# 3. Published interface - an explicit contract
data "aws_ssm_parameter" "vpc_id" {
  name = "/platform/prod/vpc_id"
}`,
      },
    ],
    traps: [
      "`terraform_remote_state` across teams, so one team's refactor breaks another's plan.",
      'Granting broad state read access, which exposes every secret in that state.',
      'Data sources matching on tags that are not actually unique, returning the wrong resource.',
    ],
    followUps: [
      'Why is a data source usually better than reading remote state?',
      'What is the risk of granting read access to a state file?',
    ],
    tags: ['remote state', 'data sources', 'coupling', 'design'],
  },
  {
    id: 'itv-tf-42',
    level: 'basic',
    kind: 'open',
    prompt: 'What files does a Terraform project have, and which should be in version control?',
    probing: 'Practical hygiene, quickly checked.',
    answer: [
      'The files you write: **`.tf`** files with the configuration (conventionally split into `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`, though the names are only convention - Terraform reads every `.tf` file in the directory), and **`.tfvars`** files with values.',
      'Generated files: **`.terraform/`** holds downloaded providers and modules; **`.terraform.lock.hcl`** pins provider versions and checksums; **`terraform.tfstate`** is local state if you are not using a backend.',
      'In version control: **all `.tf` files**, and **`.terraform.lock.hcl`** - that one matters, because it is what makes provider versions consistent between machines and CI.',
      'Not in version control: **`.terraform/`** (large, machine-specific, regenerated by `init`), **`terraform.tfstate`** (contains secrets in plain text and has no locking - use a remote backend), and **any `.tfvars` containing secrets**. Non-secret environment tfvars files are fine and usually should be committed.',
    ],
    code: [
      {
        title: 'A .gitignore that gets this right',
        language: 'text',
        code: `# Downloaded providers and modules - regenerated by terraform init
.terraform/

# Local state - use a remote backend instead; contains secrets in plain text
*.tfstate
*.tfstate.*
.terraform.tfstate.lock.info

# Saved plans can contain sensitive values
*.tfplan

# Secret variable files
*.auto.tfvars
secrets.tfvars

# DO commit .terraform.lock.hcl - it pins provider versions`,
      },
    ],
    traps: [
      'Committing state, which publishes every secret it contains.',
      'Gitignoring the lock file, so provider versions drift between machines.',
      'Committing `.terraform/`, which is large and useless to anyone else.',
    ],
    followUps: ['Why does the lock file need to be committed?'],
    tags: ['project structure', 'git', 'lock file', 'fundamentals'],
  },
  {
    id: 'itv-tf-43',
    level: 'advanced',
    kind: 'multi',
    prompt: 'Which of these are good practices for Terraform in production? Select all that apply.',
    probing: 'Broad maturity check across several dimensions.',
    options: [
      {
        id: 'a',
        text: 'Remote state with locking, versioning and encryption, split by blast radius',
      },
      { id: 'b', text: 'Plan reviewed on every pull request, and the saved plan applied on merge' },
      {
        id: 'c',
        text: 'Policy as code checking plans for unencrypted storage, open security groups and missing tags',
      },
      {
        id: 'd',
        text: 'Using `-target` routinely to apply only the parts you are confident about',
      },
      {
        id: 'e',
        text: '`prevent_destroy` on stateful resources, and OIDC rather than stored cloud credentials',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Routine `-target` use is the wrong one. It is a **debugging tool**: it applies a subset while skipping the dependency graph, so state and reality diverge in ways that are hard to reason about, and the next full apply can do something unexpected. HashiCorp documents it as being for exceptional recovery situations. If you feel the need to target routinely, the actual problem is that the state file is too large or the configuration is too coupled.',
      'The others are the baseline. **Remote state** with locking, versioning and encryption, split so one apply cannot risk everything. **Plan on pull request, apply the saved plan on merge**, so what was reviewed is what runs. **Policy as code** catching the class of problem that looks fine in a diff. And **`prevent_destroy` plus OIDC**, which between them remove the two most damaging failure modes - accidental destruction and leaked long-lived credentials.',
      'I would add: modules versioned and pinned, the lock file committed, drift detection on a schedule, and production requiring different credentials from everything else.',
    ],
    traps: [
      '`-target` as a normal part of the workflow.',
      'Applying without a reviewed plan.',
      'Long-lived cloud credentials in CI.',
      'No `prevent_destroy` on anything that holds data.',
    ],
    followUps: ['Why is routine `-target` use a problem rather than just a shortcut?'],
    tags: ['best practices', 'production', 'workflow', 'security', 'advanced'],
  },
  {
    id: 'itv-tf-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage several cloud providers, or several regions, in one configuration?',
    probing: 'Provider aliases - a specific mechanism people often have not used.',
    answer: [
      'Multiple configurations of the same provider are distinguished by **alias**. You declare the default provider plus one or more aliased ones, and then each resource or module specifies which to use with the `provider` argument.',
      'The common cases are a resource that must live in a specific region regardless of the default - an ACM certificate for CloudFront must be in `us-east-1` - and genuinely multi-region deployments.',
      'For **modules**, you pass providers explicitly with a `providers` block mapping the module’s expected provider names to your aliased ones. This is exactly why a reusable module should **not** declare its own provider configuration: if it does, it cannot be used with an alias, and it cannot be used with `for_each` or `count` either.',
      'The caution is that multi-region in one configuration means one state file covering several regions, so a problem in one region blocks changes in all of them. For anything substantial, separate configurations per region with a shared module is usually better than aliases.',
    ],
    code: [
      {
        title: 'Aliased providers, including for a module',
        language: 'hcl',
        code: `provider "aws" {
  region = "eu-west-1"           # the default
}

provider "aws" {
  alias  = "us_east_1"           # CloudFront certificates must live here
  region = "us-east-1"
}

resource "aws_acm_certificate" "cdn" {
  provider          = aws.us_east_1
  domain_name       = "www.example.com"
  validation_method = "DNS"
}

module "dr_region" {
  source = "./modules/service"

  # The module declares required_providers but NOT a provider block
  providers = {
    aws = aws.us_east_1
  }
}`,
      },
    ],
    traps: [
      'A provider block inside a reusable module, which makes aliases and `for_each` impossible.',
      'Forgetting the `provider` argument, so a resource is silently created in the default region.',
      "One state file spanning many regions, so one region's problem blocks all of them.",
    ],
    followUps: [
      'Why must a reusable module not declare its own provider?',
      'When would you use separate configurations per region instead?',
    ],
    tags: ['providers', 'aliases', 'multi-region', 'modules'],
  },
  {
    id: 'itv-tf-45',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What happens if you delete a resource block from your configuration and apply?',
    probing: 'Fundamental Terraform behaviour with a destructive consequence.',
    options: [
      {
        id: 'a',
        text: 'Terraform destroys the real resource, because the configuration is the desired state and it no longer appears there',
      },
      { id: 'b', text: 'Terraform leaves it alone and removes it from state' },
      { id: 'c', text: 'Terraform errors because the resource is still in state' },
      { id: 'd', text: 'Nothing happens until you run `terraform destroy`' },
    ],
    correct: ['a'],
    answer: [
      'The configuration is the **desired state**. A resource that is in state but not in the configuration is, by definition, something that should not exist - so Terraform destroys it.',
      'That is correct and intended behaviour, and it is also how people accidentally delete production resources: commenting out a block, moving a file, or a bad merge that drops a resource all look the same to Terraform.',
      'If you want to **stop managing** a resource without deleting it, the command is **`terraform state rm`**. That removes the state entry, so Terraform forgets the resource exists and leaves it running. You can then delete the configuration block safely.',
      'And `prevent_destroy = true` turns this from a silent destruction into a plan error for anything that matters.',
    ],
    code: [
      {
        title: 'Stop managing without destroying',
        language: 'bash',
        code: `# Terraform forgets it exists; the real resource is untouched
terraform state rm aws_s3_bucket.legacy

# Now the configuration block can be deleted safely
terraform plan     # no longer mentions the bucket at all`,
      },
    ],
    traps: [
      'Commenting out a resource block to "disable" it, and destroying it.',
      'A merge that drops a resource, applied without reading the plan.',
      'Confusing `state rm` with `destroy`.',
    ],
    followUps: ['How would you hand a Terraform-managed resource over to another team?'],
    tags: ['destroy', 'state rm', 'workflow', 'fundamentals'],
  },
  {
    id: 'itv-tf-46',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is policy as code for Terraform, and what would you enforce?',
    probing: 'Governance. The answer should include the rollout approach, not just the tooling.',
    answer: [
      'Policy as code means rules that a **plan is checked against automatically**, so non-compliant infrastructure cannot be applied. The tools are **OPA/Conftest**, **Sentinel** (HCP Terraform), and scanners like **Checkov** and **tfsec** with large built-in rulesets.',
      'It runs against the **plan JSON**, which is the important detail: it evaluates what *would* be created, before anything exists. That is much stronger than scanning deployed infrastructure after the fact.',
      'What I would enforce: **encryption at rest** on storage and databases; **no security groups open to 0.0.0.0/0** except on documented load balancers; **required tags** for ownership and cost attribution; **allowed regions** so nothing appears where it should not; **no public S3 buckets**; **allowed instance types** to prevent an expensive mistake; and **no deletion of stateful resources** without explicit approval.',
      'The thing that determines whether it succeeds is the **rollout**. Start in **warn mode**, see what fails, fix the genuine problems and adjust the rules that are wrong. Enforcing from day one on an existing estate blocks every pull request and the policy gets disabled within a week.',
      'And write policies with **clear failure messages** that say what to change. A policy failure that says "denied by rule 47" teaches people to route around the system; one that says "S3 buckets must set server_side_encryption_configuration" gets fixed.',
    ],
    code: [
      {
        title: 'A Rego policy against the plan',
        language: 'text',
        code: `package terraform.security

import rego.v1

# Deny S3 buckets that are not encrypted
deny contains msg if {
  resource := input.resource_changes[_]
  resource.type == "aws_s3_bucket"
  resource.change.actions[_] in {"create", "update"}
  not encrypted(resource.address)
  msg := sprintf(
    "%s: S3 buckets must have server-side encryption configured",
    [resource.address]
  )
}

encrypted(bucket_address) if {
  enc := input.resource_changes[_]
  enc.type == "aws_s3_bucket_server_side_encryption_configuration"
  enc.change.after.bucket == bucket_address
}

# Deny security groups open to the world, except tagged load balancers
deny contains msg if {
  resource := input.resource_changes[_]
  resource.type == "aws_security_group"
  rule := resource.change.after.ingress[_]
  "0.0.0.0/0" in rule.cidr_blocks
  not resource.change.after.tags.PublicIngress == "approved"
  msg := sprintf("%s: ingress from 0.0.0.0/0 requires tag PublicIngress=approved",
                 [resource.address])
}`,
      },
      {
        title: 'Running it in the pipeline',
        language: 'bash',
        code: `terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# Warn mode during rollout
conftest test --policy ./policies plan.json --output table || true

# Enforcing, once the estate is clean
conftest test --policy ./policies plan.json`,
      },
    ],
    deeper: [
      'Policies double as documentation of the standards - often more accurate than the wiki page describing them.',
      'Exceptions need a mechanism. A tag-based approval, or a documented exemption list, prevents the policy being bypassed wholesale when a genuine exception arises.',
      'Run the same policies on a schedule against existing state, not just on new plans, so pre-existing violations are visible.',
    ],
    traps: [
      'Enforcing from day one on an existing estate, blocking everything.',
      'Opaque failure messages that do not say what to change.',
      'No exception path, so the first genuine exception causes the policy to be disabled.',
      'Policies that duplicate what the provider already validates.',
    ],
    followUps: [
      'How would you introduce this to a team with an existing estate?',
      'How do you handle a legitimate exception?',
    ],
    tags: ['policy as code', 'opa', 'governance', 'security', 'advanced'],
  },
  {
    id: 'itv-tf-47',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What is the difference between Terraform and a configuration management tool like Ansible?',
    probing: 'Provisioning versus configuration - a boundary question.',
    answer: [
      'Terraform **provisions infrastructure**: it creates and destroys the resources themselves - virtual machines, networks, load balancers, managed databases. It is declarative about *what exists*.',
      'Ansible **configures systems**: it installs packages, edits files, manages services, and deploys applications onto machines that already exist. It is procedural about *what is done to them*.',
      'They overlap at the edges - Terraform can run scripts through provisioners, and Ansible has cloud modules that can create instances - but each is poor at the other’s job. Terraform has no model of what a script did; Ansible has no state file tracking what it created and no concept of destroying an environment cleanly.',
      'The common pattern is to use both: Terraform creates the infrastructure and outputs an inventory; Ansible configures what runs on it. Or, increasingly, neither for configuration - immutable images built with Packer or containers, so there is nothing to configure after creation.',
      'The direction of travel is worth mentioning: with containers and managed services, the configuration management layer shrinks. You replace the machine rather than configuring it, which is a simpler model.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Where each tool operates',
        caption: 'With immutable infrastructure the middle step largely disappears.',
        nodes: [
          { label: 'Terraform', detail: 'Creates VMs, networks, databases', tone: 'accent' },
          { label: 'Outputs an inventory', detail: 'Addresses, groups, tags' },
          { label: 'Ansible', detail: 'Installs and configures software', tone: 'warning' },
          { label: 'Application running', tone: 'success' },
          {
            label: 'Immutable alternative',
            detail: 'Packer or containers - no configure step at all',
            tone: 'muted',
          },
        ],
      },
    ],
    traps: [
      'Using Terraform provisioners for configuration management, which loses every property that makes Terraform useful.',
      'Using Ansible to create cloud resources, which gives you no state and no clean teardown.',
      'Maintaining a configuration management layer that immutable images would remove entirely.',
    ],
    followUps: [
      'How would you pass Terraform outputs to Ansible?',
      'When does configuration management become unnecessary?',
    ],
    tags: ['ansible', 'comparison', 'provisioning', 'configuration management'],
  },
  {
    id: 'itv-tf-48',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you handle a Terraform plan that takes fifteen minutes to run?',
    probing: 'Performance, which at scale becomes a real productivity and safety problem.',
    answer: [
      'A fifteen-minute plan is a symptom, and the usual cause is a **state file that is too large**. Plan time is roughly proportional to the number of resources, because the refresh step queries the provider for each one.',
      'The first thing I would check is the resource count - `terraform state list | wc -l`. Several hundred resources in one state is where this starts hurting; a few thousand makes it unworkable.',
      'The structural fix is to **split the state** along ownership and change-frequency lines. Networking that changes monthly does not need to be refreshed every time someone changes an application. Smaller states also reduce blast radius and lock contention, so this fixes three problems at once.',
      'Shorter-term mitigations: increase **`-parallelism`** above the default 10 if the provider and API rate limits allow; use **`-refresh=false`** for a quick check when you know nothing has drifted, understanding that it hides drift; and remove **unnecessary data sources**, which are refreshed every plan and are sometimes the actual bottleneck.',
      'It is also worth checking whether it is the **provider or the API** rather than Terraform - rate limiting shows up as a plan that is slow in bursts, and some resources are simply slow to read.',
      'The reason this matters beyond productivity: a fifteen-minute plan means people stop running plans, start batching changes into large applies, and skim the output. All three make incidents more likely.',
    ],
    code: [
      {
        title: 'Measure before restructuring',
        language: 'bash',
        code: `terraform state list | wc -l          # how many resources?

# Where is the time going?
TF_LOG=INFO terraform plan 2>&1 | ts '%.s' | tail -50

# Quick mitigations
terraform plan -parallelism=30        # if the API can take it
terraform plan -refresh=false         # fast, but hides drift

# How many data sources are being refreshed every run?
grep -rc '^data "' *.tf`,
      },
    ],
    deeper: [
      'Splitting state is the only fix that scales. Everything else buys time.',
      'Data sources are refreshed on every plan; a module that looks up twenty AMIs adds twenty API calls to every run.',
      'Raising parallelism can trigger provider rate limiting, which makes things slower - increase it gradually and measure.',
      'Treat plan duration as a tracked metric. It grows slowly and nobody notices until it is painful.',
    ],
    traps: [
      '`-refresh=false` as a habit, which means drift goes undetected until something breaks.',
      'Raising parallelism until the provider rate-limits, making it worse.',
      'Accepting a slow plan, so people stop reading plans - which is the real risk.',
    ],
    followUps: [
      'How would you decide where to split the state?',
      'Why is a slow plan a safety problem and not just an annoyance?',
    ],
    tags: ['performance', 'state', 'scale', 'productivity', 'advanced'],
  },
  {
    id: 'itv-tf-49',
    level: 'basic',
    kind: 'open',
    prompt: 'What is idempotence and why does it matter for infrastructure as code?',
    probing: 'A foundational property, explained simply.',
    answer: [
      'An operation is **idempotent** if running it repeatedly has the same effect as running it once. `terraform apply` on an unchanged configuration makes no changes - the second run is a no-op.',
      'This matters because it makes operations **safe to repeat**. If an apply fails halfway, you fix the cause and run it again; Terraform works out what still needs doing rather than duplicating what it already did. If you are not sure whether a change was applied, you can just run it and find out.',
      'The contrast is a script that says "create an instance". Run it twice and you have two instances. That means you must know the exact current state before running it, which in a system changing constantly is a bad thing to depend on.',
      'Idempotence is also why declarative tools converge: each run moves reality closer to the desired state and stops when they match. It is the property that makes infrastructure changes routine rather than a carefully sequenced operation.',
    ],
    traps: [
      'Provisioners and shell scripts, which are usually not idempotent and break this property.',
      'Assuming idempotence means "safe" - an idempotent apply of a bad configuration is still bad.',
    ],
    followUps: ['Why does a provisioner break this property?'],
    tags: ['idempotence', 'fundamentals', 'concepts', 'declarative'],
  },
  {
    id: 'itv-tf-50',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you introduce Terraform to an environment built entirely by hand?',
    probing:
      'A migration and change-management question. Incremental adoption is the expected answer.',
    answer: [
      'I would not attempt to import everything. A big-bang import of a hand-built estate takes months, produces a large amount of generated configuration nobody understands, and delivers no value until it is finished.',
      'Instead, **start with new things**. Everything created from now on goes through Terraform. That establishes the workflow, the state backend, the module patterns and the CI pipeline on low-risk work, and it stops the problem growing.',
      'Then **import selectively, by value**. The resources worth importing first are the ones that change often, the ones that are risky to change by hand, and the ones you need to replicate for a new environment. Resources that are stable and never touched can stay unmanaged for a long time without much cost - document them as such.',
      'Then **build the environment-creation path**: the ability to stand up a complete new environment from code is usually the thing that demonstrates the value most clearly and justifies continuing.',
      'Two organisational points. **Restrict console write access progressively** - not on day one, which would block everyone, but as each area comes under management, so it does not drift back. And **expect the imports to be harder than they look**: hand-built resources have settings nobody documented, and getting to a clean plan surfaces all of them. Budget for that rather than being surprised by it.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Incremental adoption',
        caption:
          'New resources first - it stops the problem growing while you work on the backlog.',
        nodes: [
          {
            label: 'Set up backend, CI, module patterns',
            detail: 'On something low-risk',
            tone: 'accent',
          },
          { label: 'All NEW resources via Terraform', detail: 'The problem stops growing' },
          { label: 'Import what changes often', detail: 'Highest value first' },
          {
            label: 'Build a new environment from code',
            detail: 'Demonstrates the value',
            tone: 'success',
          },
          {
            label: 'Restrict console writes per area',
            detail: 'As each comes under management',
            tone: 'warning',
          },
          { label: 'Leave stable resources documented but unmanaged', tone: 'muted' },
        ],
      },
    ],
    traps: [
      'A months-long import project with no value delivered until the end.',
      'Restricting console access before the code can do everything people need.',
      'Generated configuration committed without being understood.',
      'Importing but not preventing new hand-built resources, so the backlog never shrinks.',
    ],
    followUps: [
      'Which resources would you import first, and why?',
      'How do you stop people creating resources by hand during the migration?',
    ],
    tags: ['migration', 'adoption', 'import', 'change management', 'brownfield'],
  },
]
