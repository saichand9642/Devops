import type { Topic } from '../../../types'

export const plan: Topic = {
  id: 'tf-plan',
  title: 'terraform plan: reading an execution plan',
  domainId: 'tf-workflow',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 4,
  tags: ['plan', 'exit codes', 'refresh', 'replace', 'target', 'objective-3d'],
  oneLiner:
    'Generating, reading and saving a plan - the four action symbols, the exit codes, and the flags that matter.',
  explanation: [
    '`terraform plan` produces an **execution plan**: the ordered set of actions needed to make reality match your configuration. It changes no infrastructure.',
    'Producing one takes three inputs: your configuration, your state, and a **refresh** of each resource in state from its provider. The plan is the diff between them.',
    'The output marks every resource with one of four symbols - `+` create, `-` destroy, `~` update in place, `-/+` destroy and recreate - and ends with a summary line.',
    'A plan can be **saved** with `-out=FILE`. That file is a binary artefact containing the exact planned actions, and `terraform apply FILE` executes precisely those, with no re-planning. This is what makes review meaningful in a pipeline.',
  ],
  whyItMatters: [
    'Objective 3d is generating and reviewing an execution plan. The symbols and the exit codes are prime exam material.',
    'The plan is Terraform’s entire safety story. An engineer who reads plans carefully avoids nearly every destructive accident.',
    '`-/+` is the difference between a config change and data loss, and it is easy to miss when skimming.',
  ],
  howItWorks: [
    '**Refresh.** For each resource in state Terraform asks the provider for current attributes. Differences from state are drift, and the plan reports them separately from configuration changes.',
    '**Diff.** Refreshed state is compared with the configuration. In configuration only means create; in state only means destroy; in both with differences means update or replace.',
    '**Replacement.** Some attributes cannot be changed in place. When one of those differs the plan shows `-/+` and prints `# forces replacement` beside the responsible attribute.',
    '**Unknown values.** Anything computed by the provider appears as `(known after apply)`. Values that depend on it are unknown too, which is why a small change sometimes shows a large plan.',
    '**Exit codes** with `-detailed-exitcode`: 0 means no changes, 1 means error, 2 means changes are pending. Without that flag, plan exits 0 whether or not changes are pending.',
    '**Saving.** `-out=FILE` writes the plan. It contains sensitive values in cleartext, so treat the file as a secret and never commit it.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How a plan is produced',
      caption:
        'The refresh step is why plan needs credentials, and why it can be slow on a large configuration.',
      nodes: [
        {
          label: 'Load configuration and variables',
          detail: 'All .tf files, plus tfvars and TF_VAR_ environment variables',
        },
        {
          label: 'Read state from the backend',
          detail: 'Acquiring a lock if the backend supports one',
          arrowLabel: 'may block on a lock',
        },
        {
          label: 'Refresh every resource in state',
          detail: 'One provider read per resource - the slow part',
          tone: 'accent',
          branch: {
            label: 'Reality differs from state',
            detail: 'Reported as drift, separately from your changes',
          },
        },
        {
          label: 'Diff against the configuration',
          detail: 'Produces +, -, ~ or -/+ per resource',
        },
        {
          label: 'Print the plan, and optionally save it',
          detail: '-out=tfplan makes the apply exact',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Reading the four symbols',
      caption:
        'Three of these are routine. The fourth deserves your full attention every single time.',
      question: 'What symbol is beside the resource?',
      branches: [
        {
          condition: '+ create',
          result: 'A new resource',
          detail: 'Nothing exists yet; nothing is at risk',
        },
        {
          condition: '~ update in-place',
          result: 'Modified, not recreated',
          detail: 'The identifier survives. Usually safe.',
          tone: 'accent',
        },
        {
          condition: '- destroy',
          result: 'Deleted',
          detail: 'Because you removed it from the configuration',
          tone: 'warning',
        },
        {
          condition: '-/+ destroy and then create',
          result: 'REPLACED - read carefully',
          detail: 'New identifier, and any data on it is gone',
          tone: 'danger',
        },
      ],
    },
    {
      kind: 'nested',
      title: 'The flags worth knowing',
      caption:
        'The first group is everyday use. The second group changes what Terraform considers, and should be used deliberately.',
      root: {
        label: 'terraform plan',
        children: [
          {
            label: 'Everyday',
            tone: 'accent',
            children: [
              { label: '-out=tfplan', detail: 'Save the plan so apply is exact' },
              { label: '-detailed-exitcode', detail: '0 none, 1 error, 2 changes pending' },
              { label: '-var / -var-file', detail: 'Supply input variable values' },
              { label: '-no-color', detail: 'Plain text for logs and comments' },
            ],
          },
          {
            label: 'Deliberate',
            detail: 'Each one narrows or skips something',
            tone: 'warning',
            children: [
              { label: '-refresh-only', detail: 'Show drift only; propose no config changes' },
              { label: '-refresh=false', detail: 'Skip the refresh. Fast, and can be wrong.' },
              { label: '-replace=ADDRESS', detail: 'Force one resource to be recreated' },
              { label: '-target=ADDRESS', detail: 'Narrow to one resource. A debugging tool.' },
              { label: '-destroy', detail: 'Plan the destruction of everything in state' },
            ],
          },
        ],
      },
    },
  ],
  keyObjects: [
    {
      kind: 'Plan output anatomy',
      purpose: 'Everything a plan tells you, and the order to read it in.',
      fields: [
        {
          path: 'Note: Objects have changed outside of Terraform',
          meaning:
            'Drift detected during refresh. Read this section first - it is not your change.',
        },
        {
          path: '# resource must be replaced',
          meaning: 'The header above a -/+ block. Always read the reason below it.',
          required: true,
        },
        {
          path: '# forces replacement',
          meaning: 'Marks the specific attribute causing the replacement.',
          required: true,
        },
        {
          path: '(known after apply)',
          meaning: 'A value the provider will compute. Not an error.',
        },
        {
          path: 'Plan: N to add, N to change, N to destroy.',
          meaning: 'The summary. Check it, but never instead of the body.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The tag that replaced a database',
    story: [
      'An engineer added a `Name` tag to a `aws_db_instance`. They expected an in-place update, glanced at the plan, saw "1 to change", and approved.',
      'Except the summary read `1 to add, 0 to change, 1 to destroy`. In the same commit an editor autocomplete had changed `identifier` from `prod-db` to `prod-db-1`, and `identifier` forces replacement.',
      'The apply deleted the production database and created an empty one. The restore from snapshot took four hours.',
      'Two habits would each have prevented it: reading the body rather than the summary, and noticing that "to add" and "to destroy" both being non-zero for one logical change means replacement. `lifecycle { prevent_destroy = true }` on the database would have turned it into an error instead of an outage.',
    ],
    code: [
      {
        title: 'The guard rail',
        language: 'hcl',
        code: `resource "aws_db_instance" "prod" {
  identifier = "prod-db"
  # ...

  lifecycle {
    # Any plan that would destroy this becomes an error
    # rather than something you can approve by accident.
    prevent_destroy = true
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A plan with every symbol in it',
      language: 'bash',
      explanation:
        'Read top to bottom: drift first, then each resource, then the summary. The `# forces replacement` comment is the most important line here.',
      code: `$ terraform plan

Note: Objects have changed outside of Terraform

  # aws_s3_bucket.logs has been changed
  ~ resource "aws_s3_bucket" "logs" {
      ~ tags = {
          + "AddedByHand" = "oops"
        }
    }

Terraform will perform the following actions:

  # aws_instance.api will be created
  + resource "aws_instance" "api" {
      + ami           = "ami-0abc"
      + id            = (known after apply)
      + instance_type = "t3.small"
    }

  # aws_instance.web must be replaced
-/+ resource "aws_instance" "web" {
      ~ availability_zone = "eu-west-1a" -> "eu-west-1b" # forces replacement
      ~ id                = "i-0123" -> (known after apply)
        instance_type     = "t3.micro"
    }

  # aws_s3_bucket.old will be destroyed
  # (because aws_s3_bucket.old is not in configuration)
  - resource "aws_s3_bucket" "old" {
      - bucket = "acme-old" -> null
    }

Plan: 2 to add, 0 to change, 2 to destroy.`,
    },
    {
      title: 'Saving a plan and inspecting it as JSON',
      language: 'bash',
      explanation:
        'The JSON form is how policy tools and pipeline gates read a plan. Note the guard against replacement in the last command.',
      code: `terraform plan -out=tfplan

# Human-readable, from the saved file:
terraform show tfplan

# Machine-readable:
terraform show -json tfplan > plan.json

# Every action, per resource:
jq -r '.resource_changes[] | "\\(.address): \\(.change.actions | join(","))"' plan.json

# A pipeline gate: fail if anything would be replaced or destroyed.
jq -e '[.resource_changes[]
        | select(.change.actions | (contains(["delete"])))]
       | length == 0' plan.json \\
  || { echo "plan destroys or replaces resources - needs manual approval"; exit 1; }`,
    },
    {
      title: 'Exit codes in a pipeline',
      language: 'bash',
      explanation:
        'Without `-detailed-exitcode` a plan exits 0 whether or not changes are pending, so a "did anything change" check needs this flag.',
      code: `set +e
terraform plan -detailed-exitcode -out=tfplan
code=$?
set -e

case $code in
  0) echo "no changes; skipping apply"; exit 0 ;;
  2) echo "changes pending; awaiting approval" ;;
  *) echo "plan failed"; exit $code ;;
esac`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan',
      what: 'Refreshes, diffs and prints proposed actions. Changes nothing.',
      expected: 'Plan: 1 to add, 0 to change, 0 to destroy.',
    },
    {
      command: 'terraform plan -out=tfplan',
      what: 'Saves the plan so a later apply executes exactly it.',
      namespaceNote: 'The file contains sensitive values in cleartext. Never commit it.',
    },
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'Exit 0 no changes, 1 error, 2 changes pending.',
    },
    {
      command: 'terraform plan -refresh-only',
      what: 'Shows drift only - how reality differs from state - proposing no configuration changes.',
    },
    {
      command: 'terraform plan -replace=aws_instance.web',
      what: 'Plans a forced recreation of one resource, without editing the configuration.',
      namespaceNote: 'The modern replacement for `terraform taint`.',
    },
    {
      command: 'terraform plan -var-file=production.tfvars',
      what: 'Supplies variable values from a file.',
    },
    {
      command: 'terraform show -json tfplan | jq .resource_changes',
      what: 'Reads a saved plan programmatically.',
    },
  ],
  declarative: {
    steps: [
      'Read the plan body, not just the summary - especially every `-/+`.',
      'Check the drift section separately: it is not your change.',
      'Save the plan with `-out` whenever the review and the apply are separated in time.',
      'Use `-detailed-exitcode` in automation to decide whether an apply is needed at all.',
      'Add `prevent_destroy` to anything whose accidental replacement would be an incident.',
    ],
    code: [
      {
        title: 'lifecycle guards worth knowing',
        language: 'hcl',
        explanation:
          'These three turn "a plan you might approve by mistake" into either an error or a safe ordering.',
        code: `resource "aws_db_instance" "prod" {
  identifier = "prod-db"

  lifecycle {
    # A plan that would destroy this becomes a hard error.
    prevent_destroy = true

    # Terraform stops proposing changes to these, so an
    # out-of-band password rotation does not show as drift.
    ignore_changes = [password]
  }
}

resource "aws_instance" "web" {
  ami = var.ami_id

  lifecycle {
    # On replacement, create the new one BEFORE destroying the
    # old one - no gap in capacity.
    create_before_destroy = true
  }
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
      what: 'The definitive answer to "is anything pending".',
      expected: 'exit=0 when configuration, state and reality agree.',
    },
    {
      command:
        "terraform show -json tfplan | jq '[.resource_changes[].change.actions] | flatten | unique'",
      what: 'The set of action types in a saved plan.',
      expected: '["no-op"] or ["create"] etc.',
    },
    {
      command: 'terraform plan -refresh-only -detailed-exitcode',
      what: 'Isolates drift: exit 2 means reality has moved.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Proposes replacing something unexpectedly - find the `# forces replacement` comment.',
    },
    {
      command: 'terraform plan -refresh-only',
      what: 'Separates drift from your own changes when a plan is confusingly large.',
    },
    {
      command: 'terraform plan -refresh=false',
      what: 'Skips the refresh to get a fast answer when a provider is slow or partly unreachable.',
      namespaceNote: 'The result can be wrong: it trusts state over reality. Diagnostic use only.',
    },
    {
      command: 'terraform force-unlock <LOCK_ID>',
      what: 'Clears a stale state lock after a crashed run. Confirm nothing is actually running first.',
    },
    {
      command: 'terraform plan -target=module.network',
      what: 'Narrows a huge plan while debugging. Not a normal workflow.',
    },
  ],
  commonMistakes: [
    'Reading only the summary line. `1 to add, 1 to destroy` for one logical change means a replacement.',
    'Ignoring the drift section. Those changes were not made by you, and applying may silently revert someone’s fix.',
    'Committing a saved plan file. It contains sensitive values in cleartext.',
    'Using `-refresh=false` routinely for speed. It plans against possibly stale state.',
    'Using `-target` as a normal workflow. It skips dependency evaluation and leaves drift undetected elsewhere.',
    'Assuming a clean plan means the apply will succeed. Quotas, permissions and collisions still bite at apply time.',
  ],
  examTips: [
    'The four symbols: `+` create, `-` destroy, `~` update in place, `-/+` destroy and recreate.',
    '`-detailed-exitcode`: 0 no changes, 1 error, 2 changes pending. Without it, plan exits 0 either way.',
    '`plan -out=FILE` then `apply FILE` guarantees the apply matches the review.',
    '`plan` never changes infrastructure - though it does refresh state unless you pass `-refresh=false`.',
    '`-replace=ADDRESS` replaced the old `terraform taint` command.',
    '`(known after apply)` is normal for provider-computed values, not an error.',
  ],
  summary: [
    'A plan is the diff between configuration, state and refreshed reality.',
    'Learn the four symbols, and treat `-/+` as a stop signal.',
    'Read the drift section separately from your own changes.',
    '`-out` plus `apply FILE` makes review and execution identical.',
    '`-detailed-exitcode` is how automation knows whether anything is pending.',
  ],
  practice: [
    {
      id: 'tf-plan-p1',
      level: 'beginner',
      prompt: 'What do `~` and `-/+` mean in plan output, and which one should worry you?',
      answer:
        '`~` is an in-place update - the resource keeps its identifier. `-/+` is destroy and recreate, so the identifier changes and any data on it is lost. `-/+` is the one to worry about.',
      explanation:
        'The plan prints `# forces replacement` next to the attribute responsible, which is always where to look next.',
    },
    {
      id: 'tf-plan-p2',
      level: 'beginner',
      prompt: 'What does `terraform plan -detailed-exitcode` return when changes are pending?',
      answer: '2. (0 means no changes, 1 means an error.)',
      explanation:
        'Without the flag, plan exits 0 whether or not changes are pending, so CI cannot distinguish the two cases.',
    },
    {
      id: 'tf-plan-p3',
      level: 'intermediate',
      prompt:
        'Your plan shows a resource nobody edited being modified back to an older value. What happened, and how do you investigate?',
      answer:
        'Drift: someone changed it outside Terraform. Run `terraform plan -refresh-only` to see reality versus state on its own, then decide whether to accept your configuration or update it to match the manual change.',
      explanation:
        'Applying without deciding is what silently reverts a colleague’s emergency fix.',
    },
    {
      id: 'tf-plan-p4',
      level: 'advanced',
      prompt:
        'Why should a saved plan file never be committed to version control, and what should a pipeline do with it instead?',
      answer:
        'Because it contains resolved sensitive values in cleartext - passwords, keys, tokens. A pipeline should pass it between jobs as a short-lived, access-controlled artefact and delete it after the apply.',
      explanation:
        'It is also tied to the exact state serial it was planned against, so it has no value once applied. Treat it as a secret with a lifetime of minutes.',
    },
  ],
  lab: {
    title: 'Produce every plan symbol on purpose',
    scenario:
      'Drive a configuration through create, update, replace and destroy, reading each plan carefully, and use the JSON form to build a pipeline gate.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create two `local_file` resources and a `random_pet` with a `keepers` map. Apply, and note the `+` symbols.',
      },
      {
        instruction:
          'Change one file’s `content` and plan. Confirm you see `~` and explain why it is in-place.',
      },
      {
        instruction:
          'Change one file’s `filename` and plan. Confirm you see `-/+` and find the `# forces replacement` comment.',
        hint: 'filename cannot be changed in place - the provider must delete and rewrite.',
      },
      {
        instruction: 'Delete the second resource block entirely and plan. Confirm you see `-`.',
      },
      {
        instruction:
          'Edit one managed file by hand on disk, then run `terraform plan -refresh-only`. Contrast that output with a normal plan.',
      },
      {
        instruction:
          'Add `lifecycle { prevent_destroy = true }` to a resource, then try to plan its removal. Read the error.',
      },
      {
        instruction:
          'Save a plan with `-out=tfplan`, convert it with `terraform show -json`, and write a jq one-liner that fails when anything would be deleted.',
      },
      { instruction: 'Destroy everything.' },
    ],
    solution: [
      {
        title: 'Starting configuration',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local  = { source = "hashicorp/local", version = "~> 2.5" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

resource "random_pet" "name" {
  length = 2

  keepers = {
    version = "1"
  }
}

resource "local_file" "a" {
  filename = "\${path.module}/a.txt"
  content  = "content v1\\n"
}

resource "local_file" "b" {
  filename = "\${path.module}/b.txt"
  content  = "second file\\n"
}`,
      },
      {
        title: 'Walking through every symbol',
        language: 'bash',
        code: `terraform init
terraform plan     # + + +   Plan: 3 to add
terraform apply -auto-approve

# ~ update in place: content can be changed without recreating
sed -i 's/content v1/content v2/' main.tf
terraform plan
#   ~ resource "local_file" "a" { ~ content = "content v1\\n" -> "content v2\\n" }
terraform apply -auto-approve

# -/+ replacement: filename cannot change in place
sed -i 's|/a.txt|/a-renamed.txt|' main.tf
terraform plan
#   -/+ resource "local_file" "a" {
#         ~ filename = "./a.txt" -> "./a-renamed.txt" # forces replacement
terraform apply -auto-approve

# - destroy: remove the block for local_file.b, then
terraform plan
#   - resource "local_file" "b" { ... }
#   (because local_file.b is not in configuration)

# Drift, on its own:
echo "edited by hand" > a-renamed.txt
terraform plan -refresh-only
#   Note: Objects have changed outside of Terraform
# A plain plan would mix this in with your own changes.

# prevent_destroy turns an approval into an error:
#   add   lifecycle { prevent_destroy = true }   to local_file.a, then
#   remove the resource block and plan:
# Error: Instance cannot be destroyed - lifecycle.prevent_destroy is set

# The pipeline gate:
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
jq -e '[.resource_changes[]
        | select(.change.actions | contains(["delete"]))]
       | length == 0' plan.json \\
  && echo "no deletions - safe to auto-apply" \\
  || echo "deletions present - manual approval required"

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command:
          'terraform show -json tfplan | jq -r \'.resource_changes[] | "\\(.address) \\(.change.actions|join("+"))"\'',
        what: 'Lists the planned action for every resource.',
      },
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms the configuration is settled at the end.',
        expected: 'exit=0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f tfplan plan.json *.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes resources, plan artefacts and cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-apply-and-destroy', 'tf-drift-and-state-commands', 'tf-workflow-overview'],
  docs: [
    {
      title: 'terraform plan',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/plan',
    },
    {
      title: 'The lifecycle meta-argument',
      url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle',
    },
  ],
}
