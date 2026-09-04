import type { Topic } from '../../../types'

export const importingInfrastructure: Topic = {
  id: 'tf-importing-infrastructure',
  title: 'Importing existing infrastructure',
  domainId: 'tf-maintenance',
  difficulty: 'advanced',
  estimatedMinutes: 16,
  order: 1,
  tags: ['import', 'import block', 'generate-config-out', 'objective-7a'],
  oneLiner:
    'Bringing resources Terraform did not create under management - the CLI command, the import block, and config generation.',
  explanation: [
    'Import brings an existing resource into state so Terraform manages it from then on. It creates nothing and changes nothing in the real world - it only records what is already there.',
    'Import has always needed two halves: a **configuration block** describing the resource, and a **state entry** linking it to the real object. Historically you wrote the configuration by hand and then ran `terraform import`.',
    'Terraform 1.5 added the **`import` block**, which is declarative: you write it in configuration, and the import happens as part of the normal plan and apply. Because it appears in the plan, it is reviewable.',
    'Terraform 1.5 also added `-generate-config-out`, which writes a first draft of the configuration for you. It is a starting point, not a finished file - it includes read-only attributes and needs editing.',
  ],
  whyItMatters: [
    'Objective 7a is importing existing infrastructure into your workspace, and the `import` block is the modern mechanism it expects.',
    'Almost every real adoption of Terraform starts with infrastructure that already exists, so import is the on-ramp.',
    'Getting it wrong is expensive: an import with a mismatched configuration produces a plan that wants to change or replace production resources.',
  ],
  howItWorks: [
    '`import { to = <address>, id = "<real id>" }` declares an import. `terraform plan` then shows the resource being imported, and `apply` performs it.',
    'The **id format is provider-specific**. An EC2 instance is `i-0123456789abcdef0`; an IAM role is its name; an S3 bucket policy is the bucket name. Each resource type documents its own form.',
    'After import, run a plan. A clean plan means your configuration matches reality. Anything else means you must reconcile - and a `-/+` replacement means your configuration would destroy the thing you just imported.',
    '`terraform plan -generate-config-out=generated.tf` writes configuration for every `import` block whose target has no configuration yet.',
    'Generated configuration includes attributes you must remove - computed ones such as `id` and `arn` - and often needs sensible defaults filling in. Treat it as a draft.',
    'The older `terraform import <address> <id>` still works. It writes state immediately, is not reviewable, and cannot generate configuration.',
    'Import handles one resource at a time. A large estate is a repeated process, and tools such as Terraformer exist for bulk work.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The import loop, done safely',
      caption:
        'Step 5 is the one people skip. A plan that is not clean after import means your configuration does not describe what you imported.',
      nodes: [
        {
          label: 'Find the resource’s real id',
          detail: 'Console, or a CLI query. The format is provider-specific.',
        },
        {
          label: 'Write an import block',
          detail: 'import { to = aws_instance.web, id = "i-0abc..." }',
          tone: 'accent',
        },
        {
          label: 'Generate a draft configuration',
          detail: 'terraform plan -generate-config-out=generated.tf',
          arrowLabel: 'optional but useful',
        },
        {
          label: 'Edit the draft',
          detail: 'Remove computed attributes; keep only what you mean to manage',
          branch: {
            label: 'Applied the draft unedited',
            detail: 'Plans propose changing or replacing production resources',
          },
        },
        {
          label: 'terraform plan - and read it',
          detail: 'A clean plan is the pass mark',
          arrowLabel: 'the verification step',
          branch: {
            label: 'Plan shows -/+',
            detail: 'STOP. Your configuration would destroy what you imported.',
          },
        },
        {
          label: 'Apply, then delete the import block',
          detail: 'It has served its purpose',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which import mechanism?',
      caption:
        'The import block is the modern default. The CLI command remains useful for one-off surgery.',
      question: 'What are you importing, and how?',
      branches: [
        {
          condition: 'anything, in a reviewed workflow',
          result: 'import block',
          detail: 'Appears in the plan; works in CI; Terraform 1.5+',
          tone: 'accent',
        },
        {
          condition: 'you have no configuration yet',
          result: 'import block + -generate-config-out',
          detail: 'Produces a draft you then edit',
        },
        {
          condition: 'a quick one-off fix in your own shell',
          result: 'terraform import',
          detail: 'Immediate, not reviewable, no config generation',
        },
        {
          condition: 'hundreds of resources',
          result: 'A generator tool, then review',
          detail: 'Import is one resource at a time by design',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'import block',
      purpose: 'Declares an import as part of the configuration, so it appears in the plan.',
      fields: [
        { path: 'to', meaning: 'The resource address to import into. Required.', required: true },
        {
          path: 'id',
          meaning: 'The provider-specific real-world identifier. Required.',
          required: true,
        },
        {
          path: 'provider',
          meaning: 'An aliased provider, when the resource is not in the default one.',
        },
        {
          path: 'for_each',
          meaning: 'Import several instances of one resource type (Terraform 1.7+).',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The import that would have deleted a database',
    story: [
      'A team imported a production RDS instance. They ran `-generate-config-out`, moved the generated block into `main.tf`, and applied.',
      'The plan showed `-/+ must be replaced`, with `# forces replacement` beside `identifier`. The generated configuration had a slightly different identifier than the real instance, because it had been edited during a copy-paste.',
      'They noticed. Had they used `-auto-approve`, the apply would have destroyed a production database and created an empty replacement.',
      'The habit that makes import safe is simple and non-negotiable: after every import, read the plan in full, and treat any `-/+` as a stop signal. Adding `prevent_destroy` to the resource before the first apply is the belt to that braces.',
    ],
    code: [
      {
        title: 'Guard the import',
        language: 'hcl',
        code: `resource "aws_db_instance" "prod" {
  identifier = "prod-db"
  # ... the rest, edited from the generated draft ...

  lifecycle {
    # Added BEFORE the first apply after an import. Any plan
    # that would destroy this becomes an error you cannot
    # approve by accident.
    prevent_destroy = true
  }
}

import {
  to = aws_db_instance.prod
  id = "prod-db"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The declarative import workflow',
      language: 'hcl',
      explanation:
        'Note the `for_each` form: one block can import several instances, keyed the same way the resource is.',
      code: `# Step 1: declare what to import.
import {
  to = aws_s3_bucket.legacy
  id = "acme-legacy-data"
}

# Step 2: after generating and editing, the configuration.
resource "aws_s3_bucket" "legacy" {
  bucket = "acme-legacy-data"

  tags = {
    ManagedBy = "terraform"
    Imported  = "2026-09-04"
  }
}

# Importing into an aliased provider.
import {
  to       = aws_s3_bucket.dr_copy
  id       = "acme-legacy-data-dr"
  provider = aws.us
}

# Several instances at once (Terraform 1.7+).
import {
  for_each = {
    alice = "alice"
    bob   = "bob"
  }
  to = aws_iam_user.team[each.key]
  id = each.value
}

resource "aws_iam_user" "team" {
  for_each = toset(["alice", "bob"])
  name     = each.value
}`,
    },
    {
      title: 'Generating and cleaning up a draft',
      language: 'bash',
      explanation:
        'The generated file always needs editing. Computed attributes must go, and defaults you do not intend to manage should go too.',
      code: `# 1. Write only the import block, with no resource block yet.

# 2. Generate a draft.
terraform plan -generate-config-out=generated.tf

# 3. Read it. Typical things to remove:
#      id        = "acme-legacy-data"      <- computed
#      arn       = "arn:aws:s3:::..."      <- computed
#      region    = "eu-west-1"             <- from the provider
#      Any attribute set to null that you do not intend to manage.

# 4. Move the cleaned resource block into main.tf and delete
#    generated.tf.

# 5. Plan, and READ IT.
terraform plan
#   Ideal:  Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.
#   Fine:   1 to import, 1 to change   (a tag you are adding)
#   STOP:   1 to import, 1 to destroy  (your config would replace it)

terraform apply

# 6. Delete the import block. It has done its job.`,
    },
    {
      title: 'The legacy CLI form',
      language: 'bash',
      explanation:
        'Still supported, and still handy for a single quick fix. It writes state immediately, so there is no plan to review first.',
      code: `# The configuration must already exist for the address.
terraform import aws_s3_bucket.legacy acme-legacy-data

# Quoting for indexed and keyed addresses:
terraform import 'aws_instance.web[0]' i-0123456789abcdef0
terraform import 'aws_iam_user.team["alice"]' alice

# Into a module:
terraform import 'module.network.aws_vpc.this' vpc-0a1b2c3d

# Then, always:
terraform plan          # this is the verification step`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan -generate-config-out=generated.tf',
      what: 'Writes draft configuration for every import block lacking one.',
      namespaceNote: 'Fails if the file already exists, so you cannot overwrite an edited draft.',
    },
    {
      command: 'terraform plan',
      what: 'Shows what will be imported and whether your configuration matches.',
      expected: 'Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.',
    },
    {
      command: 'terraform apply',
      what: 'Performs the import and writes state.',
    },
    {
      command: 'terraform import <address> <id>',
      what: 'The legacy form: imports immediately, with no plan.',
    },
    {
      command: 'terraform state show <address>',
      what: 'After importing, shows every attribute so you can align your configuration.',
      namespaceNote: 'The most useful command in the whole import workflow.',
    },
    {
      command: 'terraform state rm <address>',
      what: 'Undoes an import. The resource keeps running, unmanaged.',
    },
  ],
  declarative: {
    steps: [
      'Prefer the `import` block so the import appears in a plan and works in CI.',
      'Generate a draft with `-generate-config-out`, then edit it - never apply it unedited.',
      'Add `prevent_destroy` before the first apply on anything you would hate to lose.',
      'Read the plan in full. Any `-/+` after an import is a stop signal.',
      'Use `terraform state show` to align your configuration with reality.',
      'Delete the import block once it has been applied.',
    ],
    code: [
      {
        title: 'Aligning configuration with what you imported',
        language: 'bash',
        explanation:
          'The imported state is the ground truth. Read it and make the configuration agree, rather than guessing.',
        code: `# After the import, state holds the real attributes.
terraform state show aws_s3_bucket.legacy

# Read them and adjust the configuration until the plan is clean.
# A useful trick: diff what state has against what you wrote.
terraform state show -no-color aws_s3_bucket.legacy \\
  | sed -n '/^resource/,/^}/p' > from-state.tf

diff <(terraform fmt -write=false from-state.tf) \\
     <(sed -n '/^resource "aws_s3_bucket" "legacy"/,/^}/p' main.tf)

# Remember: some differences are intentional. If you are adding
# tags as part of adoption, "1 to change" is the correct outcome.
# What must never appear is "1 to destroy".`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'Exit 0 after an import means your configuration matches reality exactly.',
    },
    {
      command: 'terraform state list | grep <name>',
      what: 'Confirms the resource is now in state.',
    },
    {
      command: 'terraform state show <address>',
      what: 'Confirms the imported object is the one you meant.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports "Cannot import non-existent remote object" - the id is wrong or in another region or account.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Resource already managed by Terraform" - it is already in state at some address.',
    },
    {
      command: 'terraform plan',
      what: 'Shows `-/+` after import - your configuration differs on a replacement-forcing attribute. Fix the configuration.',
    },
    {
      command: 'terraform state rm <address>',
      what: 'Undoes an import that went to the wrong address.',
    },
    {
      command: 'terraform state show <address>',
      what: 'The reference for making configuration match reality.',
    },
  ],
  commonMistakes: [
    'Applying `-generate-config-out` output unedited. It contains computed attributes and produces confusing plans.',
    'Not reading the plan after an import. A `-/+` there means your configuration would destroy what you just imported.',
    'Guessing the id format. It is provider-specific and documented per resource type.',
    'Importing into an address whose configuration does not exist, with the legacy command - it errors, and the modern block plus generation is the answer.',
    'Forgetting that import creates nothing. If the resource does not exist, import is not the tool.',
    'Leaving import blocks in the configuration forever. Delete them once applied.',
    'Importing production resources without `prevent_destroy` in place first.',
  ],
  examTips: [
    'Import brings existing infrastructure into state. It never creates or modifies anything.',
    'The `import` block (Terraform 1.5+) is declarative and appears in the plan; `terraform import` is the older immediate form.',
    '`terraform plan -generate-config-out=FILE` writes draft configuration, which must be edited.',
    'The id format is provider- and resource-specific.',
    'Always run a plan after importing; a clean plan is the goal.',
    '`terraform state rm` is how you undo an import.',
    'Import handles one resource at a time; `for_each` on an import block covers several instances of one type.',
  ],
  summary: [
    'Import records what exists; it creates nothing.',
    'The `import` block is reviewable and CI-friendly; the CLI command is immediate.',
    '`-generate-config-out` gives you a draft, not a finished configuration.',
    'The plan after an import is the verification step, and `-/+` means stop.',
    '`terraform state show` is how you make configuration match reality.',
  ],
  practice: [
    {
      id: 'tf-import-p1',
      level: 'beginner',
      prompt: 'Does `terraform import` create infrastructure?',
      answer:
        'No. It only records an existing resource in state so Terraform manages it from then on.',
      explanation:
        'If the resource does not exist, import fails with "Cannot import non-existent remote object".',
    },
    {
      id: 'tf-import-p2',
      level: 'beginner',
      prompt: 'What are the two halves an import needs?',
      answer:
        'A configuration block describing the resource, and a state entry linking that address to the real object.',
      explanation:
        'The `import` block plus `-generate-config-out` is the modern way to produce both.',
    },
    {
      id: 'tf-import-p3',
      level: 'intermediate',
      prompt:
        'After importing an EC2 instance, the plan shows `-/+ must be replaced`. What has happened and what do you do?',
      answer:
        'Your configuration differs from reality on an attribute that forces replacement - often the AMI, the subnet or the availability zone. Do not apply. Read the `# forces replacement` comment, run `terraform state show` to see the real value, and correct the configuration until the plan is clean.',
      explanation:
        'Applying would destroy the instance you just imported and create a new one - the exact opposite of adopting it.',
    },
    {
      id: 'tf-import-p4',
      level: 'advanced',
      prompt:
        'Why is the `import` block preferable to `terraform import` in a team, and what must you remember afterwards?',
      answer:
        'Because it lives in the configuration, appears in the plan so a reviewer can see it, and works identically in CI and for every colleague - whereas the CLI command writes state immediately with no review and only for whoever ran it. Afterwards, delete the import block: it has served its purpose and would otherwise be re-evaluated on every plan.',
      explanation:
        'It also composes with `-generate-config-out` and with `for_each`, neither of which the CLI form supports.',
    },
  ],
  lab: {
    title: 'Import a resource you created by hand',
    scenario:
      'Create a file outside Terraform, import it declaratively, generate and clean up a draft configuration, and reproduce the dangerous mismatched-plan case.',
    prerequisites: ['Terraform 1.5 or newer (import blocks)', 'jq'],
    tasks: [
      {
        instruction: 'Create a file `adopted.txt` by hand with `echo`, outside Terraform entirely.',
      },
      {
        instruction:
          'Write a configuration with ONLY an `import` block targeting `local_file.adopted`, with the filename as the id.',
        hint: 'For the local provider, the id of a local_file is its path.',
      },
      {
        instruction:
          'Run `terraform plan -generate-config-out=generated.tf` and read the generated file.',
      },
      {
        instruction:
          'Move the resource block into `main.tf`, removing any computed attributes, and delete `generated.tf`.',
      },
      {
        instruction: 'Run `terraform plan` and confirm it reports an import with no other changes.',
      },
      {
        instruction: 'Apply, then confirm with `terraform state list` and `terraform state show`.',
      },
      {
        instruction:
          'Now reproduce the danger: change `content` in the configuration to something different and plan. Explain what Terraform proposes.',
      },
      {
        instruction:
          'Add `lifecycle { prevent_destroy = true }`, change `filename` instead, and plan. Read the error.',
      },
      { instruction: 'Undo the import with `terraform state rm` and confirm the file survives.' },
      { instruction: 'Clean up by hand.' },
    ],
    solution: [
      {
        title: 'Step 2: import block only',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

import {
  to = local_file.adopted
  id = "./adopted.txt"
}`,
      },
      {
        title: 'Step 4: the cleaned configuration',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

import {
  to = local_file.adopted
  id = "./adopted.txt"
}

resource "local_file" "adopted" {
  filename = "./adopted.txt"
  # Must match what is really in the file, or the plan will
  # propose changing it.
  content  = "created outside terraform\\n"

  lifecycle {
    prevent_destroy = true
  }
}`,
      },
      {
        title: 'The run',
        language: 'bash',
        code: `echo "created outside terraform" > adopted.txt
terraform init

# Generate a draft:
terraform plan -generate-config-out=generated.tf
cat generated.tf
# Note the computed attributes it includes - remove them.

# After cleaning and moving into main.tf:
terraform plan
#   Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.
# That is the pass mark.

terraform apply -auto-approve
terraform state list                    # local_file.adopted
terraform state show local_file.adopted

# The danger, reproduced:
sed -i 's/created outside terraform/something else/' main.tf
terraform plan
#   ~ local_file.adopted  content = ... -> "something else"
# Applying would OVERWRITE the file you just adopted.
sed -i 's/something else/created outside terraform/' main.tf

# prevent_destroy catches the replacement case:
sed -i 's|"./adopted.txt"|"./renamed.txt"|' main.tf
terraform plan
# Error: Instance cannot be destroyed
#   ... lifecycle.prevent_destroy is set
sed -i 's|"./renamed.txt"|"./adopted.txt"|' main.tf

# Undo the import:
terraform state rm local_file.adopted
ls adopted.txt                          # survives - import only records
terraform state list                    # empty

rm -f adopted.txt`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'Exit 0 proves the configuration matches the imported resource.',
        expected: 'exit=0',
      },
      {
        command: 'terraform state show local_file.adopted | grep content',
        what: 'Confirms state recorded the real content.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform state rm local_file.adopted 2>/dev/null; rm -f adopted.txt generated.tf && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Forgets the resource, removes the hand-made file and clears state.',
      },
    ],
  },
  relatedTopicIds: ['tf-inspecting-state', 'tf-drift-and-state-commands', 'tf-plan'],
  docs: [
    {
      title: 'Import',
      url: 'https://developer.hashicorp.com/terraform/language/import',
    },
    {
      title: 'Generating configuration',
      url: 'https://developer.hashicorp.com/terraform/language/import/generating-configuration',
    },
  ],
}
