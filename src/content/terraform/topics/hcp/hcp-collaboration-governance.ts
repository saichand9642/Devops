import type { Topic } from '../../../types'

export const hcpCollaborationGovernance: Topic = {
  id: 'tf-hcp-collaboration-governance',
  title: 'Collaboration and governance features',
  domainId: 'tf-hcp',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  order: 3,
  tags: [
    'sentinel',
    'opa',
    'rbac',
    'cost estimation',
    'run tasks',
    'private registry',
    'objective-8b',
  ],
  oneLiner:
    'Policy as code, role-based access, cost estimation, run tasks and the private registry - the features you cannot get from a backend alone.',
  explanation: [
    'A remote backend gives you shared state. HCP Terraform adds the things a *team* needs on top: who may do what, what must be true before an apply, what a change will cost, and where shared modules live.',
    '**Policy as code** is the headline feature. **Sentinel** (HashiCorp’s own language) and **OPA** (open-source Rego) both evaluate the plan JSON and can pass, warn, or hard-fail a run. That is the mechanism for "no unencrypted buckets" or "no instances larger than this outside production".',
    '**RBAC** works through teams and permissions granted at organisation, project or workspace level. Combined with remote runs, it means a developer can trigger an apply without ever holding cloud credentials.',
    'Around those sit **cost estimation** (shown on the plan for supported providers), **run tasks** (calling out to third-party tools mid-run), the **private module registry**, **no-code provisioning**, **audit logs** and **notifications**. Availability varies by plan tier.',
  ],
  whyItMatters: [
    'Objective 8b is describing HCP Terraform collaboration and governance features, and this is the list.',
    'Policy as code is what turns a code-review convention into an enforced rule - the difference between "we agreed not to" and "you cannot".',
    'Understanding that these evaluate the plan JSON connects them to what you already know about `terraform show -json`.',
  ],
  howItWorks: [
    '**Run workflow.** A run moves through plan, then policy check, then optional cost estimation and run tasks, then an approval gate, then apply. A hard policy failure stops it before apply.',
    '**Sentinel** policies are written in Sentinel and attached via policy sets. Enforcement levels are `advisory` (warn), `soft-mandatory` (an authorised user may override) and `hard-mandatory` (nobody can).',
    '**OPA** policies are Rego, evaluated against the same plan JSON, with `advisory` and `mandatory` levels.',
    'Both read the plan in the same structure `terraform show -json` produces, so a policy is checked against what *would* happen rather than against the source text.',
    '**Teams and permissions** are granted at organisation, project or workspace level, with fixed roles - read, plan, write, admin - plus finer-grained custom permissions.',
    '**Cost estimation** runs after the plan for supported providers and shows the monthly delta. A Sentinel policy can gate on it.',
    '**Run tasks** POST the plan to an external service mid-run - security scanners, CMDB checks, ticket validation - which can then pass or fail the run.',
    'The **private module registry** hosts internal modules with versions, discoverable in the UI and referenced as `app.terraform.io/<org>/<name>/<provider>`.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The gates a run passes through',
      caption:
        'Each stage can stop the run. This is the ordering that makes "the plan was reviewed and approved" mean something enforceable.',
      nodes: [
        {
          label: 'Run queued',
          detail: 'From the CLI, the UI, the API, or a VCS push',
        },
        {
          label: 'Plan',
          detail: 'Executed remotely; produces the plan JSON',
          tone: 'accent',
        },
        {
          label: 'Policy check: Sentinel or OPA',
          detail: 'Evaluated against the plan JSON',
          arrowLabel: 'if policy sets apply',
          branch: {
            label: 'hard-mandatory failure',
            detail: 'The run stops. Nobody can override it.',
          },
        },
        {
          label: 'Cost estimation and run tasks',
          detail: 'Monthly delta; external checks',
          branch: {
            label: 'A run task fails',
            detail: 'Stops the run if the task is mandatory',
          },
        },
        {
          label: 'Approval gate',
          detail: 'A user with apply permission confirms',
          arrowLabel: 'all checks passed',
        },
        {
          label: 'Apply, recorded in the audit trail',
          detail: 'Who, what and when',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which enforcement level?',
      caption:
        'Start advisory, learn what it would have blocked, then tighten. Going straight to hard-mandatory blocks legitimate work.',
      question: 'What should happen when the policy fails?',
      branches: [
        {
          condition: 'inform, but never block',
          result: 'advisory',
          detail: 'A warning on the run. Right for a new policy.',
          tone: 'accent',
        },
        {
          condition: 'block, but allow a documented override',
          result: 'soft-mandatory (Sentinel)',
          detail: 'An authorised user can override, and it is recorded',
        },
        {
          condition: 'block absolutely',
          result: 'hard-mandatory (Sentinel) / mandatory (OPA)',
          detail: 'No override. For compliance requirements.',
        },
        {
          condition: 'you are not sure yet',
          result: 'advisory first',
          detail: 'Measure before you enforce',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Governance features',
      purpose: 'What each feature does, and what it evaluates.',
      fields: [
        {
          path: 'Sentinel policies',
          meaning: 'HashiCorp’s policy language. advisory / soft-mandatory / hard-mandatory.',
          required: true,
        },
        {
          path: 'OPA policies',
          meaning: 'Open-source Rego. advisory / mandatory.',
          required: true,
        },
        {
          path: 'Policy sets',
          meaning: 'Group policies and attach them to workspaces or projects.',
        },
        {
          path: 'Teams and permissions',
          meaning: 'RBAC at organisation, project or workspace level.',
          required: true,
        },
        {
          path: 'Cost estimation',
          meaning: 'Monthly cost delta shown on the plan, for supported providers.',
        },
        {
          path: 'Run tasks',
          meaning: 'Call an external service mid-run; it can pass or fail the run.',
        },
        {
          path: 'Private module registry',
          meaning: 'Versioned internal modules, referenced by registry address.',
        },
        { path: 'Audit logs', meaning: 'Who did what and when. Higher tiers.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The convention that became a rule',
    story: [
      'A team had a documented rule: every S3 bucket must have encryption and public access blocked. It was in the wiki, and it was in the pull request template.',
      'Over eighteen months, four buckets were created without encryption. Every one passed code review - reviewers were looking at the change, and the missing block was an absence rather than a mistake to spot.',
      'They wrote a Sentinel policy checking the plan JSON for any `aws_s3_bucket` without a corresponding encryption configuration. Set to advisory for two weeks, it flagged two more in-flight changes; those were fixed, and the policy was promoted to hard-mandatory.',
      'No bucket has been created without encryption since, because it is no longer possible. That is the practical difference between a convention and a policy: conventions rely on attention, and attention is finite.',
    ],
    code: [
      {
        title: 'The Sentinel policy',
        language: 'text',
        code: `# policies/require-bucket-encryption.sentinel
import "tfplan/v2" as tfplan

# Every S3 bucket being created or updated.
buckets = filter tfplan.resource_changes as _, rc {
  rc.type is "aws_s3_bucket" and
    rc.mode is "managed" and
    (rc.change.actions contains "create" or
     rc.change.actions contains "update")
}

# Every encryption configuration in the same plan.
encryptions = filter tfplan.resource_changes as _, rc {
  rc.type is "aws_s3_bucket_server_side_encryption_configuration"
}

encrypted_buckets = [for encryptions as _, e { e.change.after.bucket }]

violations = filter buckets as _, b {
  b.change.after.bucket not in encrypted_buckets
}

main = rule {
  length(violations) is 0
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The same rule in OPA Rego',
      language: 'text',
      explanation:
        'Rego reads the same plan JSON. Which language you choose is mostly about what your organisation already uses.',
      code: `# policies/instance-size.rego
package terraform.policies.instance_size

import future.keywords.in

allowed := {"t3.micro", "t3.small", "t3.medium"}

# Collect every instance being created with a disallowed type.
violations[msg] {
  some rc in input.resource_changes
  rc.type == "aws_instance"
  "create" in rc.change.actions
  size := rc.change.after.instance_type
  not size in allowed
  msg := sprintf("%s uses %s, which is not in %v", [rc.address, size, allowed])
}

# Deny when there are any violations.
deny[msg] {
  violations[msg]
}`,
    },
    {
      title: 'Team permissions worth knowing',
      language: 'bash',
      explanation:
        'The important property is that "may apply" and "holds cloud credentials" are now separate things - which is impossible when Terraform runs on laptops.',
      code: `# Fixed workspace roles, least to most:
#
#   read   - see the workspace, its state and its runs
#   plan   - additionally queue a plan
#   write  - additionally apply, and manage variables
#   admin  - additionally change settings, permissions, delete
#
# Granted at three scopes:
#   Organisation - applies to every workspace
#   Project      - every workspace in that project
#   Workspace    - just that one
#
# A common arrangement:
#
#   team platform    -> Platform project:     admin
#                       Applications project: read
#   team apps        -> Applications project: write
#                       Platform project:     read
#   team security    -> Organisation:         read
#                       plus policy management
#   team contractors -> one workspace:        plan
#
# The key point: a developer with "write" can apply WITHOUT
# holding any cloud credential, because the run executes in HCP
# using the workspace's own credentials. That separation is not
# possible when Terraform runs on laptops.`,
    },
    {
      title: 'The private module registry',
      language: 'hcl',
      explanation:
        'Modules published here get the `version` argument, a browsable interface, and documentation generated from their variables and outputs.',
      code: `# Published from a repository named
#   terraform-<PROVIDER>-<NAME>
# e.g. terraform-aws-network, tagged v1.4.0

module "network" {
  source  = "app.terraform.io/acme-corp/network/aws"
  version = "~> 1.4"

  vpc_cidr    = "10.0.0.0/16"
  environment = var.environment
}

# What the registry adds over a Git source:
#   - the version argument, with constraint operators
#   - generated documentation from variables and outputs
#   - a browsable catalogue for people who do not know it exists
#   - usage counts, so you know who depends on it
#   - no-code provisioning: the module can be deployed from the
#     UI by someone who does not write Terraform`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan',
      what: 'A remote plan shows policy results and any cost estimate in its output.',
    },
    {
      command: "terraform show -json tfplan | jq '.resource_changes[0]'",
      what: 'Shows the structure that Sentinel and OPA policies are evaluated against.',
      namespaceNote: 'The single most useful thing to look at when writing a policy.',
    },
    {
      command: 'sentinel test',
      what: 'Runs a Sentinel policy against mock data locally, before attaching it.',
    },
    {
      command: "opa eval -i plan.json -d policy.rego 'data.terraform.policies'",
      what: 'Tests a Rego policy locally against a real plan.',
    },
    {
      command: 'terraform login && terraform init',
      what: 'Needed before any of these features apply to your runs.',
    },
  ],
  declarative: {
    steps: [
      'Write policies against the plan JSON, not against source text.',
      'Introduce every policy as advisory first, measure what it would have blocked, then tighten.',
      'Reserve hard-mandatory for genuine compliance requirements.',
      'Grant permissions at project level and by team, not per person per workspace.',
      'Publish shared modules to the private registry so they get versions and documentation.',
      'Test policies locally before attaching them to a workspace.',
    ],
    code: [
      {
        title: 'Testing a policy before it blocks anyone',
        language: 'bash',
        explanation:
          'The plan JSON is the contract between Terraform and your policies, so a policy can be developed entirely offline.',
        code: `# 1. Capture a real plan as JSON - the exact input a policy sees.
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# 2. Look at the structure you will be writing against.
jq '.resource_changes[] | {address, type, actions: .change.actions}' plan.json

# 3. Test locally.
opa eval -i plan.json -d policy.rego 'data.terraform.policies.instance_size.deny'
# or, for Sentinel:
sentinel test -verbose

# 4. Attach as ADVISORY. Leave it for a sprint.

# 5. Review what it flagged. Every advisory warning is either
#    a real violation to fix, or a false positive to fix in the
#    policy. Both are cheaper to find now than after enforcement.

# 6. Promote to hard-mandatory once the warnings are zero.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan',
      what: 'The run output lists policy checks and their results.',
    },
    {
      command: "terraform show -json tfplan | jq '.resource_changes | length'",
      what: 'Confirms how many resources a policy will be evaluated over.',
    },
    {
      command: "opa eval -i plan.json -d policy.rego 'data'",
      what: 'Confirms a policy behaves as intended before it can block anyone.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports a policy check failure - the message names the policy and the offending resource.',
    },
    {
      command:
        'terraform show -json tfplan | jq \'.resource_changes[] | select(.address == "<addr>")\'',
      what: 'Shows exactly what the policy saw for one resource.',
    },
    {
      command: 'terraform plan',
      what: 'Reports insufficient permissions - your team lacks plan or write on this workspace.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Picks up a newly published private-registry module version.',
    },
  ],
  commonMistakes: [
    'Introducing a policy as hard-mandatory immediately, blocking legitimate work before the false positives are known.',
    'Writing a policy against configuration text rather than the plan JSON. Policies see the plan.',
    'Granting permissions to individuals per workspace instead of to teams per project.',
    'Assuming every feature is on every plan tier. Cost estimation, audit logs and run tasks vary.',
    'Treating cost estimation as authoritative. It is an estimate for supported resource types only.',
    'Expecting a policy to catch something invisible in the plan - a policy cannot see what the provider does not report.',
    'Publishing a module to the private registry without semantic version tags, so consumers cannot pin it.',
  ],
  examTips: [
    'Sentinel and OPA are the two policy-as-code options; both evaluate the plan JSON.',
    'Sentinel enforcement levels: advisory, soft-mandatory (overridable), hard-mandatory (not overridable). OPA has advisory and mandatory.',
    'RBAC is through teams, with permissions at organisation, project or workspace level.',
    'Fixed workspace roles are read, plan, write and admin.',
    'Cost estimation shows a monthly delta on the plan, for supported providers.',
    'Run tasks call an external service mid-run and can fail it.',
    'The private module registry gives internal modules versioning and documentation.',
  ],
  summary: [
    'HCP adds policy, RBAC, cost estimation, run tasks and a private registry on top of shared state.',
    'Policies evaluate the plan JSON - the same structure `terraform show -json` produces.',
    'Start policies advisory, then tighten to mandatory.',
    'RBAC plus remote runs separates "may apply" from "holds credentials".',
    'The private registry gives internal modules real versioning.',
  ],
  practice: [
    {
      id: 'tf-hcpgov-p1',
      level: 'beginner',
      prompt: 'Name the two policy-as-code options and what they evaluate.',
      answer: 'Sentinel and OPA (Rego). Both evaluate the plan JSON.',
      explanation:
        'Because they see the plan rather than the source, a policy checks what would actually happen.',
    },
    {
      id: 'tf-hcpgov-p2',
      level: 'beginner',
      prompt: 'What are the three Sentinel enforcement levels?',
      answer:
        '`advisory` (warns only), `soft-mandatory` (blocks but an authorised user may override), `hard-mandatory` (blocks with no override).',
      explanation: 'OPA has two: advisory and mandatory.',
    },
    {
      id: 'tf-hcpgov-p3',
      level: 'intermediate',
      prompt:
        'Why can a developer with `write` on an HCP workspace apply changes without holding cloud credentials?',
      answer:
        'Because remote runs execute in HCP using the workspace’s own credentials. The developer’s permission is to trigger and approve a run, not to authenticate to the cloud.',
      explanation:
        'That separation is the core security benefit of remote execution, and it is impossible when Terraform runs on laptops.',
    },
    {
      id: 'tf-hcpgov-p4',
      level: 'advanced',
      prompt:
        'Why introduce a new policy as advisory rather than hard-mandatory, and how do you know when to promote it?',
      answer:
        'Because a new policy almost always has false positives, and hard-mandatory blocks legitimate work while you discover them. Run it advisory, review every warning, fix real violations and correct the policy where it was wrong, and promote it once the warnings are consistently zero.',
      explanation:
        'The same reasoning applies to any enforced control: measure before you enforce, or the control gets disabled the first time it blocks something urgent.',
    },
  ],
  lab: {
    title: 'Write a policy against a real plan',
    scenario:
      'Produce plan JSON locally, inspect the structure policies see, and write a working OPA policy against it. No HCP account needed.',
    prerequisites: ['Terraform 1.5 or newer', 'jq', 'The `opa` binary (optional but recommended)'],
    tasks: [
      {
        instruction:
          'Create a configuration with three `local_file` resources, one of which has a filename NOT ending in `.txt`.',
      },
      { instruction: 'Produce plan JSON with `terraform plan -out` and `terraform show -json`.' },
      {
        instruction:
          'Explore the JSON with jq: list every `resource_changes` entry with its address, type and actions.',
      },
      {
        instruction:
          'Identify where in the JSON the `filename` value appears for a resource being created.',
        hint: 'change.after.filename',
      },
      {
        instruction:
          'Write a Rego policy denying any `local_file` whose filename does not end in `.txt`, and test it with `opa eval`.',
      },
      {
        instruction:
          'Fix the offending resource, regenerate the plan JSON, and confirm the policy now passes.',
      },
      {
        instruction:
          'Extend the policy to require that every file’s content is non-empty, and test that too.',
      },
      {
        instruction:
          'Write down how you would introduce this policy to a team: which enforcement level first, and what would tell you to promote it.',
      },
      { instruction: 'Clean up.' },
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

resource "local_file" "good_one" {
  filename = "\${path.module}/one.txt"
  content  = "one\\n"
}

resource "local_file" "good_two" {
  filename = "\${path.module}/two.txt"
  content  = "two\\n"
}

# The violation: not a .txt file.
resource "local_file" "bad" {
  filename = "\${path.module}/three.log"
  content  = "three\\n"
}`,
      },
      {
        title: 'policy.rego',
        language: 'text',
        code: `package terraform.policies.local_files

import future.keywords.in

# Every local_file being created or updated.
managed[rc] {
  some rc in input.resource_changes
  rc.type == "local_file"
  rc.mode == "managed"
  some action in rc.change.actions
  action in {"create", "update"}
}

# Rule 1: filenames must end in .txt
deny[msg] {
  managed[rc]
  not endswith(rc.change.after.filename, ".txt")
  msg := sprintf("%s: filename %q must end in .txt", [rc.address, rc.change.after.filename])
}

# Rule 2: content must not be empty
deny[msg] {
  managed[rc]
  count(trim_space(rc.change.after.content)) == 0
  msg := sprintf("%s: content must not be empty", [rc.address])
}`,
      },
      {
        title: 'Producing the plan JSON and testing the policy',
        language: 'bash',
        code: `terraform init
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# What a policy actually sees:
jq -r '.resource_changes[] | "\\(.address)\\t\\(.type)\\t\\(.change.actions|join(","))"' plan.json

# Where the filename lives:
jq -r '.resource_changes[] | "\\(.address) -> \\(.change.after.filename)"' plan.json

# Test the policy:
opa eval -f pretty -i plan.json -d policy.rego \\
  'data.terraform.policies.local_files.deny'
# [
#   "local_file.bad: filename \\"./three.log\\" must end in .txt"
# ]

# Fix the violation and re-test:
sed -i 's/three.log/three.txt/' main.tf
terraform plan -out=tfplan && terraform show -json tfplan > plan.json
opa eval -f pretty -i plan.json -d policy.rego \\
  'data.terraform.policies.local_files.deny'
# []   - the policy passes

# Prove rule 2 as well:
sed -i 's/content  = "three\\\\n"/content  = ""/' main.tf
terraform plan -out=tfplan && terraform show -json tfplan > plan.json
opa eval -f pretty -i plan.json -d policy.rego \\
  'data.terraform.policies.local_files.deny'
# [ "local_file.bad: content must not be empty" ]

terraform destroy -auto-approve 2>/dev/null || true`,
      },
    ],
    verification: [
      {
        command: "jq -r '.format_version' plan.json",
        what: 'Confirms the plan JSON format version the policy is written against.',
      },
      {
        command:
          "opa eval -f raw -i plan.json -d policy.rego 'count(data.terraform.policies.local_files.deny)'",
        what: 'Zero means the policy passes.',
        expected: '0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve 2>/dev/null; rm -f tfplan plan.json policy.rego *.txt *.log && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the plan artefacts, the policy and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-hcp-overview', 'tf-hcp-integrations', 'tf-plan'],
  docs: [
    {
      title: 'Policy enforcement',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs/policy-enforcement',
    },
    {
      title: 'Permissions',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions',
    },
  ],
}
