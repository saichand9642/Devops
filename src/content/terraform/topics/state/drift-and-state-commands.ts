import type { Topic } from '../../../types'

export const driftAndStateCommands: Topic = {
  id: 'tf-drift-and-state-commands',
  title: 'Drift, refresh and the state subcommands',
  domainId: 'tf-state',
  difficulty: 'advanced',
  estimatedMinutes: 17,
  order: 5,
  tags: ['drift', 'refresh-only', 'state mv', 'state rm', 'moved', 'removed', 'objective-6d'],
  oneLiner:
    'Detecting drift, deciding what to do about it, and every state subcommand that gets you out of trouble.',
  explanation: [
    '**Drift** is reality diverging from state: somebody changed something outside Terraform. A plan reveals it because Terraform refreshes state before diffing.',
    '`terraform plan -refresh-only` shows drift *alone*, with no configuration changes mixed in. `terraform apply -refresh-only` accepts reality into state without touching infrastructure. Between them they replace the deprecated `terraform refresh`.',
    'When you find drift you have exactly two honest options: **apply your configuration**, reverting the manual change, or **update the configuration** to match, accepting the manual change. Ignoring it means the next unrelated apply silently reverts someone’s fix.',
    'The `terraform state` subcommands manipulate state without touching infrastructure - `mv` to change an address, `rm` to stop managing something, `list` and `show` to inspect. Modern Terraform prefers the declarative `moved` and `removed` blocks, which are reviewable and repeatable.',
  ],
  whyItMatters: [
    'Objective 6d is managing resource drift and Terraform state, and it covers both halves of this lesson.',
    'Drift is the normal condition of any real environment. Having a routine for it is the difference between a tidy estate and a mysterious one.',
    'State surgery is where irreversible mistakes happen, and knowing the declarative alternatives removes most of the risk.',
  ],
  howItWorks: [
    '`plan -refresh-only` refreshes state, reports differences from reality, and proposes only state changes. `apply -refresh-only` writes those.',
    '`plan -refresh=false` skips the refresh entirely. Fast, and it plans against possibly-stale state - a diagnostic, not a workflow.',
    '`terraform state list` lists addresses. `terraform state show <addr>` prints one resource’s attributes.',
    '`terraform state mv <from> <to>` changes an address - for a rename, a `count`-to-`for_each` migration, or moving a resource into a module.',
    '`terraform state rm <addr>` forgets a resource. The infrastructure survives; Terraform stops managing it. That is how you hand something over, and how you orphan something by accident.',
    '`terraform state pull` and `push` download and upload whole state files. `pull` is your backup; `push` is a last-resort restore.',
    '`terraform state replace-provider` rewrites provider addresses in state, needed after a provider is renamed or re-namespaced.',
    'The declarative equivalents: a `moved` block replaces `state mv`, and a `removed` block replaces `state rm`. Both live in the configuration, appear in the plan, and work identically for everyone who runs it.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The drift routine',
      caption:
        'The decision in the middle is the whole point. Applying without deciding is how someone’s emergency fix gets reverted.',
      nodes: [
        {
          label: 'A plan shows an unexpected change',
          detail: 'On a resource nobody edited',
        },
        {
          label: 'Isolate it: plan -refresh-only',
          detail: 'Drift alone, with no configuration changes mixed in',
          tone: 'accent',
        },
        {
          label: 'Find out who changed it and why',
          detail: 'Cloud audit log, change ticket, ask the team',
          arrowLabel: 'before deciding',
        },
        {
          label: 'Decide: whose version is correct?',
          detail: 'This is a judgement, not a command',
        },
        {
          label: 'Configuration wins: apply',
          detail: 'Reverts the manual change',
          tone: 'success',
          branch: {
            label: 'Reality wins',
            detail: 'Update the configuration, or apply -refresh-only, or ignore_changes',
          },
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which state operation do I need?',
      caption:
        'Prefer the declarative form on the left of each pair - it is reviewable and everyone gets the same result.',
      question: 'What are you trying to change?',
      branches: [
        {
          condition: 'a resource’s address changed',
          result: 'moved block (or state mv)',
          detail: 'Rename, count-to-for_each, move into a module',
          tone: 'accent',
        },
        {
          condition: 'stop managing something without deleting it',
          result: 'removed block (or state rm)',
          detail: 'Handing infrastructure to another team',
        },
        {
          condition: 'accept reality into state',
          result: 'apply -refresh-only',
          detail: 'No infrastructure change at all',
        },
        {
          condition: 'recover from a bad state write',
          result: 'state push a pulled backup',
          detail: 'Last resort. Verify with a plan immediately.',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'state subcommands',
      purpose: 'Every state operation, and whether it touches infrastructure.',
      fields: [
        { path: 'list', meaning: 'List managed addresses. Read-only.' },
        { path: 'show <addr>', meaning: 'Print one resource’s attributes. Read-only.' },
        {
          path: 'mv <from> <to>',
          meaning: 'Change an address. No infrastructure change.',
          required: true,
        },
        {
          path: 'rm <addr>',
          meaning: 'Forget a resource. It keeps running, unmanaged.',
          required: true,
        },
        { path: 'pull / push', meaning: 'Download / upload whole state. Your backup and restore.' },
        { path: 'replace-provider', meaning: 'Rewrite provider addresses after a rename.' },
      ],
    },
    {
      kind: 'Declarative equivalents',
      purpose: 'Configuration blocks that do the same job, but reviewably.',
      fields: [
        {
          path: 'moved { from = ..., to = ... }',
          meaning: 'Replaces state mv. Appears in the plan.',
          required: true,
        },
        {
          path: 'removed { from = ..., lifecycle { destroy = false } }',
          meaning: 'Replaces state rm. `destroy = true` would delete it instead.',
          required: true,
        },
        {
          path: 'import { to = ..., id = "..." }',
          meaning: 'Declarative import (Terraform 1.5+).',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The emergency fix that Terraform undid',
    story: [
      'During an incident, an engineer raised a security group’s rate limit by hand in the console. It worked, the incident closed, and nobody updated the Terraform configuration.',
      'Eleven days later a colleague applied an unrelated tag change. The plan included the rate limit reverting to its configured value; the summary said "2 to change", and nobody read the body.',
      'The same incident recurred that evening. It took two hours to connect the two events, because the Terraform apply looked entirely unrelated.',
      'The routine that prevents this is not technical: read the drift section of every plan, and treat drift as a decision rather than noise. A `plan -refresh-only` in a scheduled job would also have surfaced it within a day.',
    ],
    code: [
      {
        title: 'A scheduled drift check',
        language: 'bash',
        code: `#!/usr/bin/env bash
# Runs nightly. Reports drift; changes nothing.
set -euo pipefail

terraform init -input=false

set +e
terraform plan -refresh-only -input=false -detailed-exitcode -no-color > drift.txt
code=$?
set -e

case $code in
  0) echo "No drift." ;;
  2) echo "DRIFT DETECTED"; cat drift.txt; exit 1 ;;
  *) echo "Drift check failed"; cat drift.txt; exit "$code" ;;
esac`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'moved and removed blocks',
      language: 'hcl',
      explanation:
        'Both appear in the plan, so a reviewer sees them. Both are safe to leave in place for a release or two and then delete.',
      code: `# --- Renaming a resource: no destroy, no recreate.
resource "aws_s3_bucket" "artifacts" {
  bucket = "acme-artifacts"
}

moved {
  from = aws_s3_bucket.build_artifacts   # the old name
  to   = aws_s3_bucket.artifacts         # the new one
}

# --- Moving a resource into a module.
moved {
  from = aws_s3_bucket.logs
  to   = module.logging.aws_s3_bucket.this
}

# --- Migrating count to for_each.
moved {
  from = aws_iam_user.team[0]
  to   = aws_iam_user.team["alice"]
}

# --- Stop managing something WITHOUT destroying it.
#     The resource block must be deleted at the same time.
removed {
  from = aws_s3_bucket.legacy

  lifecycle {
    # false: forget it, leave it running.
    # true:  destroy it. That is just deleting the block.
    destroy = false
  }
}`,
    },
    {
      title: 'The imperative equivalents',
      language: 'bash',
      explanation:
        'These work, and they are sometimes the only option - but only the person who runs them gets the result, and there is no record in the repository.',
      code: `# Always take a backup before any state surgery.
terraform state pull > state-$(date +%F-%H%M%S).json

# Rename:
terraform state mv aws_s3_bucket.build_artifacts aws_s3_bucket.artifacts

# Into a module:
terraform state mv aws_s3_bucket.logs 'module.logging.aws_s3_bucket.this'

# count -> for_each (quoting matters in most shells):
terraform state mv 'aws_iam_user.team[0]' 'aws_iam_user.team["alice"]'

# Forget without destroying:
terraform state rm aws_s3_bucket.legacy

# Verify EVERY time:
terraform state list
terraform plan          # "No changes" is the goal

# Recovery, if it went wrong:
terraform state push state-2026-09-04-140312.json`,
    },
    {
      title: 'Handling drift three ways',
      language: 'hcl',
      explanation:
        'The third option is right when another system legitimately owns the value. The first two are for when someone changed something by hand.',
      code: `# 1. Configuration wins - just apply. Terraform reverts the
#    manual change. Nothing to write.

# 2. Reality wins - update the configuration to match.
resource "aws_instance" "web" {
  instance_type = "t3.large"   # was t3.micro; the manual resize was correct
}

# 3. Another system owns it - stop tracking that attribute.
resource "aws_ecs_service" "app" {
  desired_count = 2

  lifecycle {
    # Application autoscaling owns this. Without the ignore,
    # every plan proposes reverting it.
    ignore_changes = [desired_count]
  }
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan -refresh-only',
      what: 'Shows drift alone, with no configuration changes mixed in.',
      expected: 'Note: Objects have changed outside of Terraform',
    },
    {
      command: 'terraform apply -refresh-only',
      what: 'Accepts reality into state. Changes no infrastructure.',
      namespaceNote: 'The modern replacement for `terraform refresh`.',
    },
    {
      command: 'terraform state pull > backup.json',
      what: 'Back up state before any surgery. Always.',
    },
    {
      command: 'terraform state mv <from> <to>',
      what: 'Changes an address without touching infrastructure.',
    },
    {
      command: 'terraform state rm <addr>',
      what: 'Forgets a resource; it keeps running unmanaged.',
      namespaceNote: 'Prefer a `removed` block, which is reviewable.',
    },
    {
      command: 'terraform state replace-provider <from> <to>',
      what: 'Rewrites provider addresses in state after a provider rename.',
    },
    {
      command: 'terraform plan -refresh=false',
      what: 'Skips the refresh for a fast answer. Trusts state over reality.',
    },
  ],
  declarative: {
    steps: [
      'Run a scheduled `plan -refresh-only` so drift is found in a day rather than a fortnight.',
      'Read the drift section of every plan, separately from your own changes.',
      'Treat drift as a decision: configuration wins, reality wins, or the attribute is not yours.',
      'Prefer `moved` and `removed` blocks over `state mv` and `state rm`.',
      'Always `state pull` before surgery, and always plan afterwards.',
      'Use `ignore_changes` when another system genuinely owns an attribute.',
    ],
    code: [
      {
        title: 'Why declarative beats imperative here',
        language: 'hcl',
        explanation:
          'The imperative form leaves no record and only helps whoever ran it. The declarative form is reviewed, repeated and self-documenting.',
        code: `# IMPERATIVE: works, but...
#   terraform state mv aws_s3_bucket.old aws_s3_bucket.new
#
#   - only the person who ran it gets the result
#   - CI, and every colleague, still sees destroy + create
#   - nothing in the repository records that it happened
#   - it is not repeatable in a fresh clone

# DECLARATIVE: the same effect, reviewably.
resource "aws_s3_bucket" "new" {
  bucket = "acme-data"
}

moved {
  from = aws_s3_bucket.old
  to   = aws_s3_bucket.new
}

# - appears in the plan as "has moved to", not as a replacement
# - every runner and every colleague gets the same result
# - reviewable in the pull request
# - safe to delete a release or two later, once everyone has applied`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -refresh-only -detailed-exitcode; echo "exit=$?"',
      what: 'Exit 0 means state matches reality; 2 means drift.',
    },
    {
      command: 'terraform state list',
      what: 'Confirms addresses after a move, and absence after a removal.',
    },
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'The check to run after every state operation.',
      expected: 'exit=0 after a correct move',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan -refresh-only',
      what: 'Separates drift from your own changes when a plan is confusingly large.',
    },
    {
      command: 'terraform state show <addr>',
      what: 'Shows what state believes, to compare against the console.',
    },
    {
      command: 'terraform state push backup.json',
      what: 'Restores a pulled backup after a bad state operation.',
      namespaceNote: 'Verify with a plan immediately afterwards.',
    },
    {
      command: 'terraform state mv <from> <to>',
      what: 'Fixes an unwanted destroy-and-recreate caused by an address change.',
    },
    {
      command: 'terraform plan -refresh=false',
      what: 'Gets a plan when a provider is slow or partly unreachable. The result may be stale.',
    },
  ],
  commonMistakes: [
    'Applying a plan without reading its drift section, and reverting somebody’s deliberate change.',
    'Running `state rm` expecting the resource to be destroyed. It keeps running, unmanaged.',
    'Doing state surgery with no `state pull` backup first.',
    'Using `state mv` where a `moved` block would let CI and colleagues get the same result.',
    'Leaving `-refresh=false` in a pipeline for speed, so drift is never detected.',
    'Using `ignore_changes` to silence drift nobody has investigated.',
    'Forgetting to delete the resource block when adding a `removed` block - both are required.',
  ],
  examTips: [
    'Drift is reality diverging from state; `terraform plan` detects it during refresh.',
    '`terraform refresh` is deprecated - use `terraform apply -refresh-only`.',
    '`plan -refresh-only` shows drift without proposing configuration changes.',
    '`state rm` forgets a resource without destroying it; `state mv` changes its address.',
    'No `state` subcommand ever touches real infrastructure.',
    '`moved` blocks replace `state mv`; `removed` blocks replace `state rm`.',
    '`removed` needs `lifecycle { destroy = false }` to forget rather than delete.',
  ],
  summary: [
    'Drift is normal; detecting and deciding about it is the skill.',
    '`plan -refresh-only` isolates drift; `apply -refresh-only` accepts it.',
    'State subcommands change bookkeeping only, never infrastructure.',
    'Prefer `moved` and `removed` blocks - reviewable and repeatable.',
    'Back up with `state pull` before surgery, and plan afterwards.',
  ],
  practice: [
    {
      id: 'tf-drift-p1',
      level: 'beginner',
      prompt: 'Does `terraform state rm` destroy the resource?',
      answer:
        'No. It removes the resource from state; the real infrastructure keeps running, now unmanaged by Terraform.',
      explanation:
        'A subsequent plan will propose creating it again, because Terraform no longer knows it exists.',
    },
    {
      id: 'tf-drift-p2',
      level: 'beginner',
      prompt: 'Which command replaced the deprecated `terraform refresh`?',
      answer:
        '`terraform apply -refresh-only` (with `terraform plan -refresh-only` to preview it).',
      explanation:
        'The split exists so that accepting drift into state is a reviewed action rather than a side effect.',
    },
    {
      id: 'tf-drift-p3',
      level: 'intermediate',
      prompt:
        'You rename a resource from `aws_s3_bucket.old` to `.new`. What does a plan show, and what are your two options?',
      answer:
        'It shows a destroy and a create, because the address changed and Terraform sees two different resources. Either add a `moved` block, or run `terraform state mv` - the `moved` block is preferable because it is reviewable and everyone gets the same result.',
      explanation:
        'For a bucket, accepting the destroy-and-create would delete its contents, so this is not a cosmetic concern.',
    },
    {
      id: 'tf-drift-p4',
      level: 'advanced',
      prompt:
        'A colleague fixed an incident by changing a value in the console. What are your three options, and how do you choose?',
      answer:
        'Apply your configuration and revert their change; update the configuration to match reality and keep it; or add `ignore_changes` if another system legitimately owns that attribute. Choose by finding out why the change was made - the audit log or the person - before running anything.',
      explanation:
        'The one option that is always wrong is ignoring the drift, because the next unrelated apply will silently revert it.',
    },
  ],
  lab: {
    title: 'Create drift, then perform state surgery safely',
    scenario:
      'Cause drift and reconcile it three ways, then rename and forget resources using both the imperative and declarative mechanisms.',
    prerequisites: ['Terraform 1.5 or newer (moved and removed blocks)', 'jq'],
    tasks: [
      { instruction: 'Create three `local_file` resources and apply.' },
      {
        instruction:
          'Edit one file by hand on disk, then run `terraform plan -refresh-only`. Note that it proposes a STATE change.',
      },
      {
        instruction:
          'Run `terraform apply -refresh-only`, then a normal plan. Explain what each did and why the second now proposes a change.',
      },
      {
        instruction:
          'Delete a second file from disk entirely and run a normal plan. Contrast with the edit case.',
      },
      {
        instruction: 'Apply to restore both files, then take a backup with `terraform state pull`.',
      },
      {
        instruction:
          'Rename one resource in the configuration and plan. Confirm destroy-and-create, then add a `moved` block and confirm zero changes.',
      },
      {
        instruction:
          'Use `terraform state rm` on the third resource, then plan. Explain why it proposes a create while the file still exists.',
      },
      {
        instruction:
          'Restore with `terraform state push`, then achieve the same removal declaratively with a `removed` block and `destroy = false`.',
      },
      { instruction: 'Confirm the file survives, then clean up by hand.' },
    ],
    solution: [
      {
        title: 'main.tf, after the rename',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

resource "local_file" "alpha" {
  filename = "\${path.module}/alpha.txt"
  content  = "alpha\\n"
}

# Renamed from "beta" - the moved block makes it a move, not a
# destroy and create.
resource "local_file" "bravo" {
  filename = "\${path.module}/beta.txt"
  content  = "beta\\n"
}

moved {
  from = local_file.beta
  to   = local_file.bravo
}

# Step 8: forget this without destroying it.
# The resource block must be DELETED at the same time.
# removed {
#   from = local_file.gamma
#   lifecycle {
#     destroy = false
#   }
# }`,
      },
      {
        title: 'The whole exercise',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# --- Drift from an edit
echo "edited by hand" > alpha.txt
terraform plan -refresh-only
#   ~ local_file.alpha  content = "alpha" -> "edited by hand"
# Note: proposes updating STATE, not infrastructure.

terraform apply -refresh-only -auto-approve
terraform plan
#   ~ local_file.alpha  - now Terraform wants to restore "alpha"
# The refresh-only accepted reality; the normal plan reasserts
# the configuration. Two different questions.

# --- Drift from a deletion
rm beta.txt
terraform plan
#   + local_file.bravo  - it is simply gone, so recreate it
terraform apply -auto-approve

# --- Backup before surgery
terraform state pull > backup.json
jq '{serial, count: (.resources|length)}' backup.json

# --- Rename: with and without a moved block
#   rename local_file.beta -> local_file.bravo in main.tf, then
terraform plan
#   Plan: 1 to add, 0 to change, 1 to destroy.
#   add the moved block, then
terraform plan
#   local_file.beta has moved to local_file.bravo
#   Plan: 0 to add, 0 to change, 0 to destroy.
terraform apply -auto-approve

# --- state rm: forgets, does not destroy
terraform state rm local_file.gamma
ls gamma.txt              # still there
terraform plan
#   Plan: 1 to add.  Terraform no longer knows about the file.

# --- Restore and do it declaratively instead
terraform state push backup.json
terraform state list      # gamma is back
#   delete the resource block AND add the removed block, then
terraform plan
#   local_file.gamma will no longer be managed by Terraform
#   ... but will not be destroyed
terraform apply -auto-approve
ls gamma.txt              # survives
terraform state list      # gamma is gone from state

terraform destroy -auto-approve
rm -f gamma.txt           # by hand: Terraform no longer owns it`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -refresh-only -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms state matches reality.',
        expected: 'exit=0',
      },
      {
        command: 'terraform state list',
        what: 'Confirms addresses after the move and absence after the removal.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt backup.json && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes managed resources, the orphaned file and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-inspecting-state', 'tf-importing-infrastructure', 'tf-plan'],
  docs: [
    {
      title: 'Managing resource drift',
      url: 'https://developer.hashicorp.com/terraform/tutorials/state/resource-drift',
    },
    {
      title: 'The moved block',
      url: 'https://developer.hashicorp.com/terraform/language/moved',
    },
  ],
}
