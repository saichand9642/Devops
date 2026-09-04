import type { Topic } from '../../../types'

export const workflowOverview: Topic = {
  id: 'tf-workflow-overview',
  title: 'The core Terraform workflow',
  domainId: 'tf-workflow',
  difficulty: 'beginner',
  estimatedMinutes: 12,
  order: 1,
  tags: ['workflow', 'write', 'plan', 'apply', 'init', 'objective-3a'],
  oneLiner:
    'Write, init, validate, plan, apply - the loop you will run hundreds of times, and where each step actually belongs.',
  explanation: [
    'HashiCorp describes the core workflow as three stages: **write**, **plan**, **apply**. That is the conceptual answer, and it is what the objective asks for.',
    'In practice the commands are five: `terraform init` once per directory (and again when dependencies change), then `fmt` and `validate` while you write, then `plan`, then `apply`. `destroy` is the exit door.',
    'The order is not arbitrary. `init` must come first because nothing else works without providers and a configured backend. `validate` needs no credentials, so it is the cheapest check. `plan` needs credentials and shows consequences. `apply` is the only command that changes anything.',
    'Everything else in Terraform is a variation on this loop: HCP Terraform runs the same steps remotely, and CI pipelines run the same steps with `-out` and `-input=false`.',
  ],
  whyItMatters: [
    'Objective 3a asks you to describe the workflow, and objectives 3b through 3g are the individual commands. This lesson is the map for the whole domain.',
    'Knowing which step needs credentials and which does not is what makes a fast local edit loop possible - `fmt` and `validate` run offline in milliseconds.',
    'Getting the order wrong is the single most common beginner error, and the error messages for it are not always obvious.',
  ],
  howItWorks: [
    '**Write.** Author `.tf` files. Terraform loads every `.tf` and `.tf.json` file in the working directory - not subdirectories - and treats them as one configuration.',
    '**Init.** `terraform init` downloads providers, initialises the backend, and installs modules. It is safe to re-run and required after adding a provider, module or backend.',
    '**Format and validate.** `terraform fmt` normalises style. `terraform validate` checks syntax, types and references using the provider schemas already downloaded - no API calls, no credentials.',
    '**Plan.** `terraform plan` refreshes state, diffs against configuration and prints proposed changes. It changes no infrastructure.',
    '**Apply.** `terraform apply` executes the plan. Interactively it plans and asks for confirmation; given a saved plan file it executes exactly that.',
    '**Destroy.** `terraform destroy` plans and executes the removal of everything in state. It is `apply` with the destroy flag, and it too shows a plan first.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The loop, with the commands in order',
      caption:
        'fmt and validate are free and need no credentials, so run them constantly. Only apply changes anything.',
      nodes: [
        {
          label: 'Write .tf files',
          detail: 'Every .tf in the directory is one configuration',
          tone: 'accent',
        },
        {
          label: 'terraform init',
          detail: 'Providers, backend, modules. Once per directory, plus after changes.',
          arrowLabel: 'first time only',
        },
        {
          label: 'terraform fmt && terraform validate',
          detail: 'Offline, instant, no credentials needed',
          arrowLabel: 'while writing',
          branch: {
            label: 'Syntax or type error',
            detail: 'Fixed here, before any API call is wasted',
          },
        },
        {
          label: 'terraform plan',
          detail: 'Refresh, diff, print. Changes nothing.',
          arrowLabel: 'needs credentials',
        },
        {
          label: 'terraform apply',
          detail: 'The only command that changes infrastructure',
          arrowLabel: 'after you read the plan',
          tone: 'success',
        },
        {
          label: 'terraform destroy',
          detail: 'When the environment is no longer needed',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which command do I need right now?',
      caption:
        'When something is not working, this is usually the question. Most "Terraform is broken" moments are a missing init.',
      question: 'What just changed?',
      branches: [
        {
          condition: 'you added a provider, module or backend',
          result: 'terraform init',
          detail: 'Nothing else will work until you do',
          tone: 'accent',
        },
        {
          condition: 'you edited resource arguments',
          result: 'validate, then plan',
          detail: 'No init needed - dependencies have not changed',
        },
        {
          condition: 'someone changed something by hand',
          result: 'terraform plan -refresh-only',
          detail: 'Shows drift without proposing configuration changes',
        },
        {
          condition: 'you bumped a version constraint',
          result: 'terraform init -upgrade',
          detail: 'A plain init keeps the locked version',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Working directory',
      purpose:
        'The unit Terraform operates on. One directory, one configuration, one state. Subdirectories are separate configurations unless referenced as modules.',
      fields: [
        {
          path: '*.tf',
          meaning: 'Configuration. All files are concatenated; names are for humans.',
        },
        {
          path: '.terraform/',
          meaning: 'Provider binaries and module cache. Created by init, gitignored.',
        },
        {
          path: '.terraform.lock.hcl',
          meaning: 'Provider version lock. Created by init, committed.',
        },
        {
          path: 'terraform.tfstate',
          meaning: 'Local state, if no remote backend is configured.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Ten minutes lost to a missing init',
    story: [
      'An engineer added a `random` provider to an existing configuration and ran `terraform plan`. The error mentioned an inconsistent dependency lock file and a provider that was required but not installed.',
      'They spent ten minutes reading the resource documentation, convinced they had the syntax wrong.',
      'The message had in fact said what to do - "run terraform init" - two lines down from where they stopped reading.',
      'The habit worth building is mechanical: any change to `required_providers`, any new `module` block, any backend change, run `init`. It is idempotent and takes a second when nothing has changed.',
    ],
  },
  yamlExamples: [
    {
      title: 'The whole loop, first time through',
      language: 'bash',
      explanation:
        'Note the final plan. Running it again after apply is how you confirm the configuration is complete and idempotent.',
      code: `mkdir infra && cd infra
# ... write main.tf ...

terraform init                    # once: providers + backend
terraform fmt                     # normalise style
terraform validate                # offline correctness check
terraform plan                    # what would change?
terraform apply                   # make it so (asks yes/no)

terraform plan                    # "No changes." - you are done`,
    },
    {
      title: 'The same loop in a pipeline',
      language: 'bash',
      explanation:
        'Three differences from local use: no interactive prompts, formatting is checked rather than fixed, and the plan is saved so the apply cannot drift from the review.',
      code: `# -input=false: never wait for a prompt in CI
terraform init -input=false

# -check: fail the build on bad formatting instead of rewriting files
terraform fmt -check -recursive

terraform validate

# Save the plan so apply does exactly what was reviewed.
# -detailed-exitcode: 0 = no changes, 2 = changes, 1 = error
terraform plan -input=false -out=tfplan -detailed-exitcode

# ... a human approves the pipeline here ...

terraform apply -input=false tfplan`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Prepares the directory: providers, backend, modules.',
      expected: 'Terraform has been successfully initialized!',
    },
    {
      command: 'terraform fmt -recursive',
      what: 'Rewrites every file below the current directory to canonical style.',
    },
    {
      command: 'terraform validate',
      what: 'Checks syntax, types and references. No credentials, no API calls.',
      expected: 'Success! The configuration is valid.',
    },
    {
      command: 'terraform plan',
      what: 'Shows what would change.',
      expected: 'Plan: 3 to add, 0 to change, 0 to destroy.',
    },
    {
      command: 'terraform apply',
      what: 'Plans, asks for confirmation, then applies.',
      expected: 'Apply complete! Resources: 3 added, 0 changed, 0 destroyed.',
    },
    {
      command: 'terraform destroy',
      what: 'Plans and executes removal of everything in state.',
      expected: 'Destroy complete! Resources: 3 destroyed.',
    },
  ],
  declarative: {
    steps: [
      'One directory per environment or component, each with its own state.',
      'Run `init` after any dependency change; it is idempotent and cheap.',
      'Run `fmt` and `validate` on every save - they need no credentials.',
      'Never apply without reading the plan, and in CI apply a saved plan file.',
      'Finish by re-running `plan` and confirming it reports no changes.',
    ],
    code: [
      {
        title: 'A conventional layout',
        language: 'bash',
        explanation:
          'Filenames are a convention for humans; Terraform concatenates everything. Separate directories, by contrast, really are separate configurations with separate state.',
        code: `infrastructure/
├── modules/
│   └── network/              # a reusable module
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── staging/              # its own state
│   │   ├── main.tf
│   │   ├── backend.tf
│   │   └── terraform.tfvars
│   └── production/           # its own state
│       ├── main.tf
│       ├── backend.tf
│       └── terraform.tfvars
└── README.md

# You run terraform from inside environments/staging,
# not from the repository root.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform validate && terraform plan -detailed-exitcode',
      what: 'The complete pre-apply check. Exit 0 means valid and nothing pending.',
    },
    {
      command: 'terraform plan',
      what: 'Run immediately after an apply to prove the configuration is complete.',
      expected: 'No changes. Your infrastructure matches the configuration.',
    },
    {
      command: 'terraform state list',
      what: 'Confirms the resources you expected are now managed.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Fixes "Missing required provider" and "inconsistent dependency lock file".',
    },
    {
      command: 'terraform init -reconfigure',
      what: 'Fixes "Backend configuration changed" when you deliberately changed backends.',
    },
    {
      command: 'terraform validate',
      what: 'Separates a configuration error from a credentials or API error, because it never calls out.',
    },
    {
      command: 'rm -rf .terraform && terraform init',
      what: 'Rebuilds a corrupt plugin cache. Never touches state.',
    },
  ],
  commonMistakes: [
    'Running `plan` before `init` after adding a provider or module. Init is not a one-time-only command.',
    'Expecting Terraform to read `.tf` files in subdirectories. It does not - subdirectories are separate configurations or modules.',
    'Using `apply -auto-approve` interactively as a habit. The prompt exists because the plan is the safety mechanism.',
    'Assuming `validate` proves an apply will succeed. It never contacts the API, so it cannot catch a name collision or a quota limit.',
    'Running Terraform from the repository root when the configuration lives in a subdirectory. You get "no configuration files" and blame the tool.',
  ],
  examTips: [
    'The three-stage core workflow is write, plan, apply. Learn those three words.',
    '`init` is required first, and again after changing providers, modules or the backend.',
    '`validate` needs no credentials and makes no API calls; `plan` needs both.',
    '`apply` is the only command that changes infrastructure. `plan` never does.',
    'Terraform loads all `.tf` files in one directory only - never recursively.',
  ],
  summary: [
    'Write, plan, apply is the conceptual loop; init, fmt, validate, plan, apply are the commands.',
    '`init` first, and again whenever dependencies change.',
    '`fmt` and `validate` are offline and instant - use them constantly.',
    '`plan` shows consequences; `apply` is the only thing that acts.',
    'A clean `plan` after an apply is your proof the configuration is complete.',
  ],
  practice: [
    {
      id: 'tf-workflow-p1',
      level: 'beginner',
      prompt: 'Name the three stages of the core Terraform workflow as HashiCorp describes them.',
      answer: 'Write, plan, apply.',
      explanation:
        'The CLI commands are more numerous, but objective 3a is about these three stages. Expect the exact wording.',
    },
    {
      id: 'tf-workflow-p2',
      level: 'beginner',
      prompt: 'Which of `validate`, `plan` and `apply` need provider credentials?',
      answer:
        '`plan` and `apply` do. `validate` does not - it checks the configuration against provider schemas already downloaded, without any API call.',
      explanation:
        'This is why `validate` belongs in the fast part of a pipeline and in your editor-save loop.',
    },
    {
      id: 'tf-workflow-p3',
      level: 'intermediate',
      prompt:
        'You add a `module` block pointing at a local directory and run `terraform plan`. It fails. Why?',
      answer:
        'Modules are installed by `terraform init`. A new module block requires another init before plan will work.',
      explanation:
        'The same is true for new providers and any backend change. Init is not a once-per-project command.',
    },
    {
      id: 'tf-workflow-p4',
      level: 'advanced',
      prompt:
        'Why does a CI pipeline use `terraform plan -out=tfplan` followed by `terraform apply tfplan` rather than a single `apply -auto-approve`?',
      answer:
        'So the change that was reviewed is exactly the change that is applied. A bare apply re-plans at apply time, so anything that changed in between - drift, a new provider release, someone else’s apply - is executed unseen.',
      explanation:
        'Applying a saved plan also removes the interactive prompt legitimately, because approval happened at review time rather than being suppressed.',
    },
  ],
  lab: {
    title: 'Run the loop, then break the order on purpose',
    scenario:
      'Walk the full workflow with a credential-free provider, then trigger the classic missing-init error so you recognise it instantly in future.',
    prerequisites: ['Terraform 1.5 or newer', 'An empty directory'],
    tasks: [
      {
        instruction:
          'Create a directory and a `main.tf` with the `local` provider and one `local_file`.',
      },
      { instruction: 'Run `terraform validate` BEFORE `init`. Read the error and explain it.' },
      { instruction: 'Run `init`, then `validate`, `plan` and `apply` in order.' },
      { instruction: 'Run `plan` again and confirm it reports no changes.' },
      {
        instruction:
          'Add a second provider (`random`) and a `random_pet` resource, then run `plan` without re-running init. Read the error.',
        hint: 'This is the mistake this lesson is about.',
      },
      { instruction: 'Run `init`, then `plan` and `apply` successfully.' },
      {
        instruction:
          'Deliberately misformat a file - odd indentation, misaligned `=` - then run `terraform fmt -check` and `terraform fmt` and compare.',
      },
      { instruction: 'Destroy everything and confirm state is empty.' },
    ],
    solution: [
      {
        title: 'main.tf, final state',
        language: 'hcl',
        code: `terraform {
  required_version = ">= 1.5"

  required_providers {
    local  = { source = "hashicorp/local", version = "~> 2.5" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

resource "random_pet" "name" {
  length = 2
}

resource "local_file" "greeting" {
  filename = "\${path.module}/greeting.txt"
  content  = "hello \${random_pet.name.id}\\n"
}`,
      },
      {
        title: 'The run, including the errors',
        language: 'bash',
        code: `mkdir workflow-lab && cd workflow-lab
# ... write main.tf with only the local provider ...

terraform validate
# Error: Missing required provider ... run "terraform init"
# validate still needs the provider SCHEMA, which init downloads.

terraform init
terraform validate      # Success!
terraform plan          # Plan: 1 to add
terraform apply -auto-approve
terraform plan          # No changes.

# ... now add the random provider and random_pet ...
terraform plan
# Error: Inconsistent dependency lock file
#   provider registry.terraform.io/hashicorp/random is required but
#   has no version selected... run "terraform init"

terraform init
terraform apply -auto-approve
cat greeting.txt

# Formatting:
terraform fmt -check    # exits 3 and lists files needing changes
terraform fmt           # rewrites them; prints the filenames
terraform fmt -check    # now silent, exit 0

terraform destroy -auto-approve
terraform state list    # empty`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms a clean, complete configuration.',
        expected: 'exit=0',
      },
      {
        command: 'terraform fmt -check -recursive && echo "formatting clean"',
        what: 'The CI-style formatting gate.',
        expected: 'formatting clean',
      },
    ],
    cleanup: [
      {
        command: 'terraform destroy -auto-approve && cd .. && rm -rf workflow-lab',
        what: 'Removes the resources and the lab directory.',
      },
    ],
  },
  relatedTopicIds: ['tf-init', 'tf-plan', 'tf-apply-and-destroy'],
  docs: [
    {
      title: 'Terraform core workflow',
      url: 'https://developer.hashicorp.com/terraform/intro/core-workflow',
    },
  ],
}
