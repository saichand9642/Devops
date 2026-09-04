import type { Topic } from '../../../types'

export const init: Topic = {
  id: 'tf-init',
  title: 'terraform init: preparing a working directory',
  domainId: 'tf-workflow',
  difficulty: 'beginner',
  estimatedMinutes: 14,
  order: 2,
  tags: ['init', 'backend', 'modules', 'upgrade', 'migrate-state', 'objective-3b'],
  oneLiner:
    'What init actually does - providers, modules and backend - and which flag to reach for when it complains.',
  explanation: [
    '`terraform init` prepares a directory for use. It does three jobs: initialise the **backend**, install **modules**, and install **providers**. Nothing else works until it has run.',
    'It is safe to run repeatedly. When nothing has changed it takes a second and reports that everything is already installed.',
    'It is also the command that must be re-run whenever dependencies change: a new provider, a new module, an altered `backend` block, or a bumped version constraint.',
    'It never touches infrastructure and it never modifies state except when you explicitly ask it to migrate state between backends.',
  ],
  whyItMatters: [
    'Objective 3b is initialising a working directory, and the flags are exam material - particularly `-upgrade`, `-reconfigure` and `-migrate-state`.',
    'A large share of confusing Terraform errors are resolved by `init`, and the error text usually says so.',
    'The backend-migration prompt is the one moment where init can move your state. Understanding it prevents a genuinely bad afternoon.',
  ],
  howItWorks: [
    '**Backend first.** Terraform reads the `backend` or `cloud` block and connects. If the backend configuration has changed since last time, it stops and asks what you want to do.',
    '**Modules next.** Every `module` block is fetched into `.terraform/modules/`. Registry and Git sources are downloaded; local paths are recorded.',
    '**Providers last.** Constraints from the root and every module are intersected, the registry is queried, binaries are downloaded to `.terraform/providers/`, and `.terraform.lock.hcl` is written or verified.',
    '`-upgrade` re-resolves both module and provider versions to the newest allowed, rewriting the lock file. Without it, locked versions are reused.',
    '`-reconfigure` discards the previously recorded backend configuration and starts fresh, without offering to copy state.',
    '`-migrate-state` accepts the backend change and copies existing state into the new backend. This is the one that moves data.',
    '`-backend-config=...` supplies backend settings from outside the file - necessary because the `backend` block cannot use variables.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'What init does, in order',
      caption:
        'The order matters: a backend problem stops init before it downloads anything, which is why backend errors appear first.',
      nodes: [
        {
          label: 'Read the terraform block',
          detail: 'required_version is checked before anything else',
        },
        {
          label: 'Initialise the backend',
          detail: 'Connect to remote state, or use the local file',
          tone: 'accent',
          branch: {
            label: 'Backend configuration changed',
            detail: 'Stops and asks: -migrate-state or -reconfigure',
          },
        },
        {
          label: 'Install modules',
          detail: 'Into .terraform/modules/ from registry, Git or local path',
          arrowLabel: 'backend ready',
        },
        {
          label: 'Resolve provider constraints',
          detail: 'Root and module constraints intersected',
          branch: {
            label: 'No version satisfies all',
            detail: 'Init fails; run terraform providers to see the conflict',
          },
        },
        {
          label: 'Download providers, write the lock file',
          detail: 'Into .terraform/providers/ and .terraform.lock.hcl',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which init flag do I need?',
      caption:
        'Only -migrate-state moves data. Reach for the others freely; think before that one.',
      question: 'What is init complaining about?',
      branches: [
        {
          condition: 'a locked version no longer satisfies the constraint',
          result: '-upgrade',
          detail: 'Re-resolves providers and modules, rewrites the lock',
          tone: 'accent',
        },
        {
          condition: 'the backend changed and state must come with it',
          result: '-migrate-state',
          detail: 'Copies state into the new backend. The only data-moving flag.',
          tone: 'warning',
        },
        {
          condition: 'the backend changed and you want a clean slate',
          result: '-reconfigure',
          detail: 'Forgets the old backend; does NOT copy state',
        },
        {
          condition: 'backend settings live outside the file',
          result: '-backend-config=...',
          detail: 'A file or key=value; the backend block takes no variables',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'init flags',
      purpose: 'The flags worth knowing by heart, because init is the command you re-run most.',
      fields: [
        {
          path: '-upgrade',
          meaning: 'Re-resolve provider and module versions; rewrite the lock file.',
        },
        {
          path: '-migrate-state',
          meaning: 'Accept a backend change and copy state across.',
          required: true,
        },
        {
          path: '-reconfigure',
          meaning: 'Ignore the previous backend configuration; do not copy state.',
        },
        {
          path: '-backend=false',
          meaning: 'Skip backend initialisation. Useful for validate-only CI jobs.',
        },
        {
          path: '-backend-config=FILE|KEY=VAL',
          meaning: 'Supply backend settings from outside the configuration.',
        },
        { path: '-input=false', meaning: 'Never prompt. Essential in CI.' },
        {
          path: '-plugin-dir=DIR',
          meaning: 'Install providers only from a local directory - the airgapped pattern.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The state that was left behind',
    story: [
      'A team migrated from local state to an S3 backend. They added the `backend "s3"` block and ran `terraform init`. Terraform asked whether to copy existing state, and someone typed `no` because they were not sure what it meant.',
      'Init succeeded. The new backend was empty. The next `plan` proposed creating the entire environment again, on top of infrastructure that already existed.',
      'Nobody applied it - the plan was too obviously wrong - but for twenty minutes the team believed they had lost their state.',
      'The local `terraform.tfstate` was still on disk, untouched. Re-running `terraform init -migrate-state` and answering `yes` copied it up, and the next plan was clean. The lesson: init asks that question precisely because it matters, and `no` means "start empty".',
    ],
    code: [
      {
        title: 'The prompt, and what each answer means',
        language: 'bash',
        code: `$ terraform init

Initializing the backend...
Do you want to copy existing state to the new backend?
  Pre-existing state was found while migrating the previous "local"
  backend to the newly configured "s3" backend. Do you want to copy
  this state to the new "s3" backend? Enter "yes" to copy and "no"
  to start with an empty state.

  Enter a value: yes     # copy the state up. Almost always correct.
                         # "no" means the new backend starts EMPTY.`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'What a first init prints',
      language: 'bash',
      explanation:
        'Read the three sections - backend, modules, providers - and you know exactly what init did.',
      code: `$ terraform init

Initializing the backend...

Initializing modules...
- network in modules/network
- Downloading registry.terraform.io/terraform-aws-modules/vpc/aws 5.8.1 for vpc...
- vpc in .terraform/modules/vpc

Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.60"...
- Installing hashicorp/aws v5.62.0...
- Installed hashicorp/aws v5.62.0 (signed by HashiCorp)

Terraform has created a lock file .terraform.lock.hcl to record the
provider selections it made above.

Terraform has been successfully initialized!`,
    },
    {
      title: 'Backend configuration from outside the file',
      language: 'hcl',
      explanation:
        'The `backend` block cannot use variables, so a partial configuration plus `-backend-config` is how one configuration serves several environments.',
      code: `# backend.tf - a "partial configuration": the bucket and key are absent.
terraform {
  backend "s3" {
    region = "eu-west-1"
    encrypt = true
    use_lockfile = true
  }
}

# staging.s3.tfbackend
# bucket = "acme-tfstate-staging"
# key    = "network/terraform.tfstate"

# production.s3.tfbackend
# bucket = "acme-tfstate-production"
# key    = "network/terraform.tfstate"`,
    },
    {
      title: 'Selecting a backend at init time',
      language: 'bash',
      explanation:
        'The `-reconfigure` on the second init is what stops Terraform offering to copy staging state into production.',
      code: `# Staging
terraform init -backend-config=staging.s3.tfbackend

# Switching to production: -reconfigure discards the recorded
# staging backend rather than offering to migrate state into prod.
terraform init -reconfigure -backend-config=production.s3.tfbackend

# In CI, never prompt:
terraform init -input=false -backend-config=production.s3.tfbackend`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Backend, modules, providers. Idempotent.',
      expected: 'Terraform has been successfully initialized!',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Re-resolves provider and module versions to the newest allowed.',
    },
    {
      command: 'terraform init -reconfigure',
      what: 'Forgets the previous backend configuration without copying state.',
    },
    {
      command: 'terraform init -migrate-state',
      what: 'Accepts a backend change and copies state into the new backend.',
      namespaceNote: 'The only init flag that moves your data. Back up state first.',
    },
    {
      command: 'terraform init -backend=false',
      what: 'Installs providers and modules but skips the backend - enough for `validate` in CI.',
    },
    {
      command: 'terraform init -input=false',
      what: 'Fails rather than prompting. The correct form for any pipeline.',
    },
  ],
  declarative: {
    steps: [
      'Run `init` in a new directory, and again after any dependency or backend change.',
      'Commit `.terraform.lock.hcl`; gitignore `.terraform/`.',
      'Use a partial backend configuration plus `-backend-config` files for multiple environments.',
      'Always pass `-input=false` in automation so a prompt becomes a failure rather than a hang.',
      'Back up state before any `-migrate-state`.',
    ],
    code: [
      {
        title: 'A safe backend migration',
        language: 'bash',
        explanation:
          'The pull is the important line. A copy of the old state on disk turns a bad migration into an inconvenience.',
        code: `# 1. Take a copy of the current state, whatever the backend.
terraform state pull > state-backup-$(date +%F-%H%M).json

# 2. Add or change the backend block in the configuration.

# 3. Migrate, answering "yes" when asked to copy.
terraform init -migrate-state

# 4. Prove the migration worked before doing anything else.
terraform state list          # every resource still listed?
terraform plan                # "No changes." is the goal

# If the plan proposes creating everything, the new backend is
# empty: stop, and re-run the migration with the backup to hand.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform init && terraform plan -detailed-exitcode',
      what: 'Init succeeded and nothing is unexpectedly pending.',
      expected: 'Exit code 0.',
    },
    {
      command: 'ls .terraform/providers/registry.terraform.io/*/*',
      what: 'Confirms provider binaries were installed.',
    },
    {
      command: 'terraform init && git diff --exit-code .terraform.lock.hcl',
      what: 'Proves the committed lock file is complete for this platform.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports "Backend configuration changed" - decide between -migrate-state and -reconfigure.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Fixes "locked provider does not match configured version constraints".',
    },
    {
      command: 'rm -rf .terraform && terraform init',
      what: 'Rebuilds a corrupt cache. Deletes only downloads, never state.',
    },
    {
      command: 'terraform providers',
      what: 'Shows the intersecting constraints behind "no available releases match".',
    },
    {
      command: 'TF_LOG=DEBUG terraform init 2>&1 | grep -i registry',
      what: 'Diagnoses registry or proxy problems behind a corporate firewall.',
    },
  ],
  commonMistakes: [
    'Treating init as one-time setup. It must be re-run after any provider, module or backend change.',
    'Answering "no" to the state-copy prompt without understanding it. That starts the new backend empty.',
    'Using `-reconfigure` when you meant `-migrate-state`. The first leaves your state behind.',
    'Putting variables in the `backend` block. It is evaluated before variables exist; use `-backend-config`.',
    'Omitting `-input=false` in CI, so a pipeline hangs on a prompt nobody can see.',
    'Committing `.terraform/`. It is a cache of platform-specific binaries.',
  ],
  examTips: [
    'Init does three things: backend, modules, providers - in that order.',
    'It is idempotent and safe to re-run.',
    '`-upgrade` re-resolves versions; a plain init honours the lock file.',
    '`-migrate-state` copies state to a new backend; `-reconfigure` does not.',
    'The `backend` block cannot use variables, expressions or locals - hence `-backend-config`.',
    '`-backend=false` skips backend init, which is enough for `terraform validate`.',
  ],
  summary: [
    '`terraform init` prepares the directory: backend, then modules, then providers.',
    'Re-run it whenever dependencies or the backend change.',
    '`-upgrade` moves versions; a plain init keeps the locked ones.',
    '`-migrate-state` is the only flag that moves your state - back up first.',
    'Backend settings come from `-backend-config`, never from variables.',
  ],
  practice: [
    {
      id: 'tf-init-p1',
      level: 'beginner',
      prompt: 'Name the three things `terraform init` initialises, in order.',
      answer: 'The backend, then modules, then providers.',
      explanation:
        'The order explains the output and the error ordering: a backend failure stops init before any download.',
    },
    {
      id: 'tf-init-p2',
      level: 'beginner',
      prompt:
        'You bump a provider constraint and run `terraform init`. It keeps the old version. What do you run?',
      answer: '`terraform init -upgrade`.',
      explanation:
        'A plain init honours `.terraform.lock.hcl` whenever the locked version still satisfies the constraint. Only `-upgrade` re-resolves.',
    },
    {
      id: 'tf-init-p3',
      level: 'intermediate',
      prompt:
        'You are moving state from local to S3. What is the difference between answering the migration prompt with `-migrate-state` and using `-reconfigure`?',
      answer:
        '`-migrate-state` copies the existing state into the new backend. `-reconfigure` discards the record of the old backend and starts with empty state, leaving the old state behind.',
      explanation:
        'Choosing `-reconfigure` here is the classic mistake: init succeeds, and the next plan proposes rebuilding everything.',
    },
    {
      id: 'tf-init-p4',
      level: 'advanced',
      prompt:
        'Why can a `backend` block not reference `var.bucket_name`, and what is the supported alternative?',
      answer:
        'Because the backend is initialised before variables are evaluated - state has to be reachable before Terraform can process anything else. The alternative is a partial configuration completed with `-backend-config=file` or `-backend-config=key=value`.',
      explanation:
        'The same evaluation-order restriction applies to `required_version` and `required_providers`. It is why per-environment backends are selected at init time rather than in the configuration.',
    },
  ],
  lab: {
    title: 'Migrate a backend without losing state',
    scenario:
      'Move state from the default local backend to a different local backend path, using the same `-migrate-state` mechanics as a real cloud migration - no cloud account needed.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a configuration with two `local_file` resources and apply it with default local state.',
      },
      {
        instruction:
          'Confirm `terraform.tfstate` exists and `terraform state list` shows both resources.',
      },
      {
        instruction:
          'Add a `backend "local"` block with `path = "state/terraform.tfstate"` and run `terraform init`.',
        hint: 'Terraform will offer to copy the state. Say yes.',
      },
      {
        instruction:
          'Confirm the state moved: check `state/terraform.tfstate` exists and `terraform plan` is clean.',
      },
      {
        instruction:
          'Now change the path to `state2/terraform.tfstate` and run `terraform init -reconfigure`. Then run `terraform plan`.',
        hint: 'Note what plan proposes, and why.',
      },
      {
        instruction:
          'Recover: point the backend back at `state/terraform.tfstate` and re-init with `-reconfigure`. Confirm the plan is clean again.',
      },
      {
        instruction:
          'Take a state backup with `terraform state pull > backup.json` and inspect the `serial` and resource count with jq.',
      },
      { instruction: 'Destroy and clean up.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }

  # Added in step 3.
  backend "local" {
    path = "state/terraform.tfstate"
  }
}

resource "local_file" "a" {
  filename = "\${path.module}/a.txt"
  content  = "a\\n"
}

resource "local_file" "b" {
  filename = "\${path.module}/b.txt"
  content  = "b\\n"
}`,
      },
      {
        title: 'The migration, and the mistake',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve
terraform state list           # two resources
ls terraform.tfstate           # default local state

# --- Step 3: add the backend block, then:
terraform init
#   Do you want to copy existing state to the new backend?
#   Enter a value: yes
ls state/terraform.tfstate     # state moved here
terraform plan                 # No changes.

# --- Step 5: change the path and use -reconfigure instead
sed -i 's|state/terraform.tfstate|state2/terraform.tfstate|' main.tf
terraform init -reconfigure
terraform plan
# Plan: 2 to add.  The new backend is EMPTY - reconfigure did not
# copy anything. The old state is still in state/terraform.tfstate.

# --- Step 6: recover by pointing back at the populated backend
sed -i 's|state2/terraform.tfstate|state/terraform.tfstate|' main.tf
terraform init -reconfigure
terraform plan                 # No changes. Nothing was ever lost.

terraform state pull > backup.json
jq '{serial, resources: (.resources|length)}' backup.json

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: "jq -r '.resources[].name' state/terraform.tfstate | sort",
        what: 'Confirms both resources live in the migrated backend.',
        expected: 'a and b',
      },
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'A clean plan is the proof a migration worked.',
        expected: 'exit=0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl state state2 backup.json terraform.tfstate*',
        what: 'Removes resources, both backends and the cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-provider-versioning', 'tf-remote-backends', 'tf-workflow-overview'],
  docs: [
    {
      title: 'terraform init',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/init',
    },
    {
      title: 'Backend configuration',
      url: 'https://developer.hashicorp.com/terraform/language/backend',
    },
  ],
}
