import type { Topic } from '../../../types'

export const applyAndDestroy: Topic = {
  id: 'tf-apply-and-destroy',
  title: 'terraform apply and terraform destroy',
  domainId: 'tf-workflow',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 5,
  tags: [
    'apply',
    'destroy',
    'auto-approve',
    'parallelism',
    'prevent_destroy',
    'objective-3e',
    'objective-3f',
  ],
  oneLiner:
    'The only two commands that change infrastructure - how they behave, how to make them safe, and how to recover a partial run.',
  explanation: [
    '`terraform apply` executes a plan. Run interactively with no arguments it plans first, shows the result, and asks you to type `yes`. Given a saved plan file it executes exactly that plan with no prompt.',
    '`terraform destroy` is the same machinery with the destroy flag: it plans the removal of everything in state, shows it, and asks for confirmation. `terraform apply -destroy` is the identical operation.',
    'Both write state as they go, not only at the end. That is what makes a partially failed apply recoverable: what succeeded is recorded, so the next run continues rather than duplicating.',
    'Both acquire a **state lock** first if the backend supports one, so two people cannot apply at once.',
  ],
  whyItMatters: [
    'Objectives 3e and 3f are these two commands. Their flags - particularly `-auto-approve` - are common exam material.',
    'These are the only commands that can cause an outage, so their guard rails deserve real attention.',
    'Understanding that state is written incrementally is what stops a failed apply from becoming a panic.',
  ],
  howItWorks: [
    '`apply` with no plan file: lock state, refresh, plan, print, prompt for `yes`, then execute. Anything other than exactly `yes` cancels.',
    '`apply tfplan`: lock state, execute the saved actions. No refresh, no prompt - the approval already happened. Fails if state has moved since the plan was made.',
    'Execution walks the dependency graph, running up to `-parallelism` operations concurrently. The default is 10.',
    'After each resource operation the new state is written. A crash or an error leaves state accurate for everything completed so far.',
    'On error, Terraform stops starting new work, lets in-flight operations finish, then reports. Re-running continues from there.',
    '`destroy` walks the graph in reverse, so dependents are removed before their dependencies.',
    '`lifecycle { prevent_destroy = true }` makes any plan that would destroy the resource a hard error - it cannot be approved, only removed from the configuration deliberately.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Interactive apply, step by step',
      caption:
        'The typed "yes" is the safety mechanism. -auto-approve removes it, which is right in a pipeline and wrong at a terminal.',
      nodes: [
        {
          label: 'terraform apply',
          detail: 'No plan file given',
        },
        {
          label: 'Acquire the state lock',
          detail: 'Blocks if someone else is applying',
          tone: 'accent',
          branch: {
            label: 'Lock held',
            detail: 'Waits, then errors. Do not force-unlock without checking.',
          },
        },
        {
          label: 'Refresh, then plan',
          detail: 'Exactly as terraform plan would',
        },
        {
          label: 'Prompt: type yes',
          detail: 'Anything else cancels. Skipped by -auto-approve.',
          arrowLabel: 'your decision point',
        },
        {
          label: 'Execute the graph',
          detail: 'Up to 10 concurrent operations by default',
          branch: {
            label: 'A resource fails',
            detail: 'State keeps what succeeded; re-run continues',
          },
        },
        {
          label: 'Write state, release the lock',
          detail: 'Apply complete! Resources: N added...',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Is -auto-approve appropriate here?',
      caption:
        'The question is never "is it convenient" but "has a human already reviewed this exact plan".',
      question: 'Who reviewed the plan, and when?',
      branches: [
        {
          condition: 'a person reviewed this exact saved plan',
          result: 'Apply the plan file',
          detail: 'terraform apply tfplan - no prompt needed, and none is skipped',
          tone: 'accent',
        },
        {
          condition: 'a throwaway sandbox you own entirely',
          result: '-auto-approve is fine',
          detail: 'Nothing at risk; speed is the point',
        },
        {
          condition: 'production, and nobody has seen a plan',
          result: 'Do not',
          detail: 'This is how outages happen',
          tone: 'danger',
        },
        {
          condition: 'a scheduled pipeline with no reviewer',
          result: 'Gate the plan instead',
          detail: 'Fail automatically if the plan deletes or replaces anything',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'apply and destroy flags',
      purpose: 'The flags that change behaviour rather than output.',
      fields: [
        {
          path: '-auto-approve',
          meaning: 'Skip the confirmation prompt. Correct in CI, dangerous at a terminal.',
          required: true,
        },
        {
          path: '-input=false',
          meaning: 'Never prompt for anything; fail instead. Always use in CI.',
        },
        { path: '-parallelism=N', meaning: 'Concurrent operations. Default 10.' },
        { path: '-destroy', meaning: 'On apply: destroy everything. Same as terraform destroy.' },
        {
          path: '-refresh-only',
          meaning: 'Update state to match reality, changing no infrastructure.',
        },
        { path: '-replace=ADDRESS', meaning: 'Force one resource to be recreated.' },
        { path: '-target=ADDRESS', meaning: 'Narrow the operation. Debugging only.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The apply that failed halfway',
    story: [
      'An apply creating twelve resources failed on the ninth: a security group rule referenced a CIDR that a policy forbade. Terraform reported the error and stopped.',
      'The engineer assumed the whole apply had rolled back - Terraform has no transactions - and re-ran it from scratch expecting twelve creations.',
      'The plan showed three. State already recorded the eight that succeeded, so Terraform only needed to finish the job. There was nothing to roll back and nothing duplicated.',
      'This is worth internalising: Terraform does not roll back. It records what happened and continues. A failed apply is a partially complete apply, and the correct response is to fix the cause and run it again.',
    ],
    code: [
      {
        title: 'What a partial failure looks like',
        language: 'bash',
        code: `$ terraform apply
aws_vpc.main: Creation complete after 2s
aws_subnet.a: Creation complete after 3s
aws_security_group.web: Creation complete after 1s
aws_security_group_rule.ingress: Creating...
╷
│ Error: creating Security Group Rule: InvalidParameterValue
╵
# 8 resources created and recorded in state. Nothing rolled back.

$ terraform plan
Plan: 3 to add, 0 to change, 0 to destroy.
# Fix the CIDR, apply again, and it finishes the remaining work.`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The three ways to apply',
      language: 'bash',
      explanation:
        'The middle form is the one to prefer in automation: the prompt is not suppressed, it simply already happened at review time.',
      code: `# 1. Interactive: plans, shows, prompts.
terraform apply
#   Do you want to perform these actions?
#     Terraform will perform the actions described above.
#     Only 'yes' will be accepted to approve.
#   Enter a value: yes

# 2. Saved plan: executes exactly what was reviewed, no prompt.
terraform plan -out=tfplan
terraform apply tfplan

# 3. Auto-approve: no plan review at all. Sandboxes only.
terraform apply -auto-approve`,
    },
    {
      title: 'Destroy, and how to survive it',
      language: 'bash',
      explanation:
        'Destroy shows a plan first for a reason. `-target` on a destroy is one of the few genuinely good uses of that flag.',
      code: `# Plan the destruction without doing it:
terraform plan -destroy

# Destroy everything in state, with confirmation:
terraform destroy

# Equivalent:
terraform apply -destroy

# Destroy one resource and its dependents only:
terraform destroy -target=aws_instance.scratch

# In an ephemeral test environment:
terraform destroy -auto-approve -input=false`,
    },
    {
      title: 'Guard rails in configuration',
      language: 'hcl',
      explanation:
        'These live in the configuration, so they protect everyone - including a colleague running destroy in the wrong directory at 6pm.',
      code: `resource "aws_db_instance" "prod" {
  identifier = "prod-db"
  # ...

  lifecycle {
    # terraform destroy now FAILS rather than deleting this.
    # To remove it you must first delete this block, deliberately.
    prevent_destroy = true
  }
}

resource "aws_instance" "web" {
  ami = var.ami_id

  lifecycle {
    # On replacement: create the new instance first, then destroy
    # the old one. No capacity gap during a rollout.
    create_before_destroy = true
  }
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform apply',
      what: 'Plans, shows, prompts, then applies.',
      expected: 'Apply complete! Resources: 3 added, 0 changed, 0 destroyed.',
    },
    {
      command: 'terraform apply tfplan',
      what: 'Applies a saved plan exactly, with no prompt and no re-plan.',
    },
    {
      command: 'terraform apply -auto-approve',
      what: 'Applies without confirmation.',
      namespaceNote: 'Fine in a sandbox or after an approved gate. Never as a terminal habit.',
    },
    {
      command: 'terraform apply -refresh-only',
      what: 'Updates state to match reality. Changes no infrastructure.',
    },
    {
      command: 'terraform apply -replace=aws_instance.web',
      what: 'Recreates one resource without changing the configuration.',
    },
    {
      command: 'terraform destroy',
      what: 'Plans and executes the removal of everything in state.',
      expected: 'Destroy complete! Resources: 3 destroyed.',
    },
    {
      command: 'terraform apply -parallelism=1',
      what: 'Serialises execution. Useful for tracing an ordering problem or respecting an API rate limit.',
    },
  ],
  declarative: {
    steps: [
      'Prefer `plan -out` then `apply FILE` whenever review and execution are separated.',
      'Use `-input=false` in every pipeline so a prompt becomes a failure rather than a hang.',
      'Put `prevent_destroy` on anything whose loss would be an incident.',
      'Use `create_before_destroy` where a replacement must not create a capacity gap.',
      'After a failed apply, read the error and re-run. Do not attempt a manual rollback.',
    ],
    code: [
      {
        title: 'A pipeline that cannot auto-apply a deletion',
        language: 'bash',
        explanation:
          'This is how to get the speed of auto-approve without the risk: the gate, not the human, catches the dangerous plans.',
        code: `set -euo pipefail

terraform init -input=false

set +e
terraform plan -input=false -out=tfplan -detailed-exitcode
code=$?
set -e

[ "$code" -eq 0 ] && { echo "no changes"; exit 0; }
[ "$code" -ne 2 ] && exit "$code"

terraform show -json tfplan > plan.json

# Auto-apply only additive and in-place changes.
if jq -e '[.resource_changes[]
           | select(.change.actions | contains(["delete"]))]
          | length == 0' plan.json >/dev/null; then
  echo "additive plan - applying automatically"
  terraform apply -input=false tfplan
else
  echo "plan deletes or replaces resources - stopping for review"
  terraform show -no-color tfplan
  exit 1
fi`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
      what: 'Run immediately after an apply: exit 0 proves it completed.',
      expected: 'exit=0',
    },
    {
      command: 'terraform state list',
      what: 'Confirms what is now managed - and, after a destroy, that nothing is.',
    },
    {
      command: 'terraform output',
      what: 'Shows the output values the apply produced.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform apply',
      what: 'Reports "Error acquiring the state lock" - another run holds it.',
      expected: 'The message shows who, when and the Lock ID.',
    },
    {
      command: 'terraform force-unlock <LOCK_ID>',
      what: 'Clears a stale lock after a crashed run.',
      namespaceNote:
        'Confirm nothing is actually running first. Forcing a live lock corrupts state.',
    },
    {
      command: 'terraform apply',
      what: 'Reports "Saved plan is stale" - state changed since the plan was made. Re-plan.',
    },
    {
      command: 'terraform apply -parallelism=1',
      what: 'Isolates a rate-limit or ordering failure that only appears under concurrency.',
    },
    {
      command: 'terraform state list',
      what: 'After a failed apply, shows exactly what succeeded so you know where you are.',
    },
  ],
  commonMistakes: [
    'Using `-auto-approve` habitually at a terminal. The prompt is the last line of defence.',
    'Believing a failed apply rolls back. Terraform has no transactions; it records what succeeded and stops.',
    'Running `terraform destroy` in the wrong directory or workspace. Check `terraform workspace show` first.',
    'Force-unlocking a lock that is genuinely held by a running apply. That corrupts state.',
    'Expecting `destroy` to remove hand-created resources. It only removes what is in state.',
    'Using `-target` to work around a dependency problem instead of fixing the dependency.',
  ],
  examTips: [
    '`apply` and `destroy` are the only commands that change infrastructure.',
    'Interactive apply requires typing exactly `yes`; `-auto-approve` skips it.',
    '`terraform destroy` and `terraform apply -destroy` are the same operation.',
    'Destroy removes only what is in state - never resources created outside Terraform.',
    'Default parallelism is 10, changed with `-parallelism=N`.',
    '`prevent_destroy` turns a destroy plan into an error you cannot approve.',
    'There is no rollback. State is written incrementally, so a failed apply is resumable.',
  ],
  summary: [
    '`apply` executes a plan; a saved plan file makes execution match the review exactly.',
    '`-auto-approve` is right in a gated pipeline and wrong as a terminal habit.',
    'State is written as work completes, so a failed apply resumes rather than duplicating.',
    '`destroy` walks the graph in reverse and only touches what is in state.',
    '`prevent_destroy` and `create_before_destroy` are the two guard rails worth using by default.',
  ],
  practice: [
    {
      id: 'tf-apply-p1',
      level: 'beginner',
      prompt: 'What exactly must you type to approve an interactive `terraform apply`?',
      answer: '`yes`. Nothing else is accepted - not `y`, not `Yes`.',
      explanation:
        'The strictness is deliberate: it prevents an accidental keypress from approving a destructive change.',
    },
    {
      id: 'tf-apply-p2',
      level: 'beginner',
      prompt: 'Does `terraform destroy` remove a resource that was created by hand in the console?',
      answer: 'No. Destroy removes only what is recorded in state.',
      explanation:
        'This cuts both ways: hand-created resources survive a destroy, and are also invisible to plan until you import them.',
    },
    {
      id: 'tf-apply-p3',
      level: 'intermediate',
      prompt:
        'An apply fails after creating 8 of 12 resources. What is the state of the world, and what do you do?',
      answer:
        'The 8 exist and are recorded in state; nothing rolled back. Fix the cause of the failure and run apply again - it will create the remaining 4.',
      explanation:
        'Terraform writes state incrementally precisely so that this is safe. Attempting a manual cleanup is what turns a resumable failure into a mess.',
    },
    {
      id: 'tf-apply-p4',
      level: 'advanced',
      prompt:
        'Explain the difference in risk between `terraform apply -auto-approve` and `terraform apply tfplan`, given neither prompts.',
      answer:
        '`apply tfplan` executes a specific reviewed plan and refuses to run if state has moved since - so what happens is what was approved. `-auto-approve` re-plans at apply time and executes whatever that produces, which nobody has seen.',
      explanation:
        'The absence of a prompt is not the risk. The risk is executing an unreviewed plan, and only the saved-plan form eliminates it.',
    },
  ],
  lab: {
    title: 'Partial failure, recovery, and a destroy guard',
    scenario:
      'Cause an apply to fail halfway, prove nothing rolled back, resume it, then block a destroy with `prevent_destroy`.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create three `local_file` resources. Make the third one write into a directory that does not exist, so it will fail.',
        hint: 'e.g. filename = "${path.module}/missing-dir/c.txt"',
      },
      { instruction: 'Run `terraform apply`. Confirm two succeed and the third fails.' },
      {
        instruction:
          'Run `terraform state list` and `terraform plan`. Explain why the plan shows 1 to add and not 3.',
      },
      { instruction: 'Fix the third resource’s path, apply again, and confirm it completes.' },
      {
        instruction:
          'Add `lifecycle { prevent_destroy = true }` to the first resource, then run `terraform destroy`. Read the error.',
      },
      {
        instruction:
          'Remove the `prevent_destroy` block and destroy for real. Confirm state is empty.',
      },
      {
        instruction:
          'Re-apply, then experiment with `terraform apply -parallelism=1` and observe that operations run one at a time.',
      },
      { instruction: 'Destroy and clean up.' },
    ],
    solution: [
      {
        title: 'The deliberately broken configuration',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

resource "local_file" "a" {
  filename = "\${path.module}/a.txt"
  content  = "a\\n"

  # Added in step 5, removed in step 6.
  # lifecycle { prevent_destroy = true }
}

resource "local_file" "b" {
  filename = "\${path.module}/b.txt"
  content  = "b\\n"
}

resource "local_file" "c" {
  # This directory does not exist, so the provider will fail here.
  filename = "\${path.module}/missing-dir/c.txt"
  content  = "c\\n"
}`,
      },
      {
        title: 'The run',
        language: 'bash',
        code: `terraform init
terraform apply -auto-approve
# local_file.a: Creation complete
# local_file.b: Creation complete
# Error: ... no such file or directory  (local_file.c)

terraform state list
# local_file.a
# local_file.b
# Nothing rolled back.

terraform plan
# Plan: 1 to add, 0 to change, 0 to destroy.
# Terraform only needs to finish the remaining work.

# Fix the path:
sed -i 's|/missing-dir/c.txt|/c.txt|' main.tf
terraform apply -auto-approve      # completes
terraform plan                     # No changes.

# --- The destroy guard
# uncomment the lifecycle block on local_file.a, then:
terraform destroy
# Error: Instance cannot be destroyed
#   Resource local_file.a has lifecycle.prevent_destroy set,
#   but the plan calls for this resource to be destroyed.

# Remove the block, then destroy for real:
terraform destroy -auto-approve
terraform state list               # empty

# Parallelism:
terraform apply -auto-approve -parallelism=1   # one resource at a time
terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | wc -l',
        what: 'Counts managed resources - 2 after the partial failure, 3 after the fix, 0 after destroy.',
      },
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms the configuration is settled.',
        expected: 'exit=0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate* missing-dir',
        what: 'Removes resources, files and cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-plan', 'tf-state-locking', 'tf-workflow-overview'],
  docs: [
    {
      title: 'terraform apply',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/apply',
    },
    {
      title: 'terraform destroy',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/destroy',
    },
  ],
}
