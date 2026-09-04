import type { Topic } from '../../../types'

export const localBackend: Topic = {
  id: 'tf-local-backend',
  title: 'The local backend',
  domainId: 'tf-state',
  difficulty: 'beginner',
  estimatedMinutes: 11,
  order: 2,
  tags: ['local backend', 'tfstate', 'backup', 'objective-6a'],
  oneLiner:
    'The default: a JSON file next to your configuration - what it gives you and everything it does not.',
  explanation: [
    'The **local backend** is what you get with no `backend` block at all. State is written to `terraform.tfstate` in the working directory, and the previous version is kept as `terraform.tfstate.backup`.',
    'It provides two things: durability as good as your disk, and a **local file lock** so two processes on the same machine cannot write at once.',
    'It provides nothing else. No sharing, no encryption, no history, and no protection against two people on two laptops both applying.',
    'That makes it right for exactly one thing: learning and personal experiments. Anything a second person touches belongs in a remote backend.',
  ],
  whyItMatters: [
    'Objective 6a asks you to describe the local backend, including what it does and does not do.',
    'Every Terraform user starts here, and most serious state incidents come from staying here too long.',
    '`terraform.tfstate.backup` is the fastest recovery from a mistaken state command, and many people do not know it exists.',
  ],
  howItWorks: [
    'With no `backend` block, state is `./terraform.tfstate`. An explicit `backend "local" { path = "..." }` moves it.',
    'Writes are atomic: Terraform writes a temporary file and renames it, so a crash mid-write does not truncate state.',
    'Before each write, the current state is copied to `terraform.tfstate.backup`. Exactly one previous version is kept.',
    'Locking uses an OS advisory file lock on the state file. It prevents two processes on the same machine racing, and knows nothing about other machines.',
    'Workspaces live in `terraform.tfstate.d/<workspace>/terraform.tfstate`. The `default` workspace keeps the plain filename.',
    'The file is plaintext JSON containing every attribute value, so it must be gitignored and treated as a secret.',
    'Moving to a remote backend is a matter of adding a `backend` block and running `terraform init -migrate-state`.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'What the local backend puts on disk',
      caption: 'Only the configuration belongs in Git. The rest is either a secret or a cache.',
      root: {
        label: 'Working directory',
        children: [
          { label: 'main.tf, variables.tf', detail: 'Committed', tone: 'success' },
          {
            label: 'terraform.tfstate',
            detail: 'Current state. Plaintext secrets. GITIGNORE.',
            tone: 'danger',
          },
          {
            label: 'terraform.tfstate.backup',
            detail: 'The ONE previous version. Your fastest recovery.',
            tone: 'warning',
          },
          {
            label: 'terraform.tfstate.d/',
            detail: 'Non-default workspaces',
            children: [
              { label: 'staging/terraform.tfstate', detail: 'Independent state' },
              { label: 'sandbox/terraform.tfstate', detail: 'Independent state' },
            ],
          },
          {
            label: '.terraform/',
            detail: 'Provider binaries and module cache. Gitignore.',
            tone: 'muted',
          },
          {
            label: '.terraform.lock.hcl',
            detail: 'Provider lock file. COMMIT this one.',
            tone: 'success',
          },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'Is the local backend acceptable here?',
      caption:
        'The question is never about size. It is about whether more than one person or machine is involved.',
      question: 'Who else needs this state?',
      branches: [
        {
          condition: 'nobody - it is your own experiment',
          result: 'Local is fine',
          detail: 'Simplest thing that works',
          tone: 'accent',
        },
        {
          condition: 'a colleague, now or later',
          result: 'Remote backend',
          detail: 'Local state cannot be shared safely at all',
          tone: 'warning',
        },
        {
          condition: 'a CI pipeline',
          result: 'Remote backend',
          detail: 'A runner’s disk is ephemeral - the state would vanish',
          tone: 'danger',
        },
        {
          condition: 'it manages anything you would miss',
          result: 'Remote backend with versioning',
          detail: 'One deleted directory is otherwise unrecoverable',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Local backend files',
      purpose: 'The files it creates and how each should be treated.',
      fields: [
        {
          path: 'terraform.tfstate',
          meaning: 'Current state. Plaintext. Gitignore.',
          required: true,
        },
        {
          path: 'terraform.tfstate.backup',
          meaning: 'The single previous version. Recovery from one bad command.',
          required: true,
        },
        {
          path: 'terraform.tfstate.d/<ws>/terraform.tfstate',
          meaning: 'State for a non-default workspace.',
        },
        { path: 'backend "local" { path = "..." }', meaning: 'Moves the state file elsewhere.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The laptop that was reimaged',
    story: [
      'An engineer ran a small but real piece of infrastructure - a monitoring stack - from local state on their laptop. It was "temporary", for about fourteen months.',
      'IT reimaged the laptop as part of a routine refresh. The engineer had backed up their documents. State was in a project directory they had not thought of as data.',
      'The infrastructure kept running. Nobody noticed for a week, until a change was needed and Terraform proposed creating everything from scratch.',
      'Recovery meant importing eleven resources by hand. The whole episode was preventable by a five-line `backend "s3"` block written on day one, which would have taken about two minutes.',
    ],
    code: [
      {
        title: 'The two minutes that prevent it',
        language: 'hcl',
        code: `terraform {
  backend "s3" {
    bucket       = "acme-tfstate"
    key          = "monitoring/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

# Then once:
#   terraform init -migrate-state`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Implicit and explicit local state',
      language: 'hcl',
      explanation:
        'An explicit block is useful mainly to keep state out of the directory you are editing, so an over-eager `rm *` cannot reach it.',
      code: `# Implicit: no backend block at all.
# State goes to ./terraform.tfstate
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

# Explicit, with a custom path.
terraform {
  backend "local" {
    path = "state/terraform.tfstate"
  }
}

# Note: like every backend block, this takes literals only.
# terraform {
#   backend "local" {
#     path = "\${var.env}/terraform.tfstate"   # ERROR
#   }
# }`,
    },
    {
      title: 'Recovering from a bad state command',
      language: 'bash',
      explanation:
        'This works exactly once - only one previous version is kept - so verify with a plan immediately afterwards.',
      code: `# You have just run something regrettable:
terraform state rm 'aws_instance.web'    # oops

# The previous state is still on disk:
ls -la terraform.tfstate terraform.tfstate.backup
jq .serial terraform.tfstate terraform.tfstate.backup

# Restore it:
cp terraform.tfstate.backup terraform.tfstate

# ALWAYS verify before doing anything else:
terraform state list
terraform plan          # should report no changes

# Note: the backup now equals the current state, so you have
# used up your one step of history. Take a real copy before
# any further state surgery:
terraform state pull > state-$(date +%F-%H%M%S).json`,
    },
  ],
  imperative: [
    {
      command: 'terraform state list',
      what: 'Reads the local state file.',
    },
    {
      command: 'terraform state pull > backup.json',
      what: 'Takes a copy. Works identically for local and remote backends.',
      namespaceNote: 'Do this before any state surgery, whatever the backend.',
    },
    {
      command: "jq '{serial, lineage, terraform_version}' terraform.tfstate",
      what: 'Reads the bookkeeping fields directly.',
    },
    {
      command: 'cp terraform.tfstate.backup terraform.tfstate',
      what: 'Restores the previous version after a mistake.',
      namespaceNote: 'Local backend only, and it gives you exactly one step back.',
    },
    {
      command: 'terraform init -migrate-state',
      what: 'Moves local state to a newly configured remote backend.',
    },
  ],
  declarative: {
    steps: [
      'Use the local backend only for personal experiments.',
      'Gitignore `*.tfstate` and `*.tfstate.*` from the very first commit.',
      'Take an explicit copy with `terraform state pull` before any state surgery.',
      'Move to a remote backend the moment a second person or a pipeline is involved.',
      'Remember that `terraform.tfstate.backup` is one step of history, not a backup strategy.',
    ],
    code: [
      {
        title: 'The gitignore that matters most',
        language: 'bash',
        explanation:
          'The state lines are the important ones. Committing state is both a secret leak and a source of unmergeable conflicts.',
        code: `# .gitignore

# State: plaintext secrets, and unmergeable.
*.tfstate
*.tfstate.*
terraform.tfstate.d/

# Provider and module cache: machine-specific, large.
.terraform/

# Variable values: usually secrets.
*.tfvars
*.tfvars.json

# Saved plans: contain resolved secrets.
*.tfplan
tfplan

crash.log
crash.*.log

# DO commit:
#   *.tf
#   .terraform.lock.hcl
#   .terraform-version`,
      },
    ],
  },
  verification: [
    {
      command: 'git check-ignore -v terraform.tfstate',
      what: 'Confirms state cannot be committed by accident.',
      expected: '.gitignore:2:*.tfstate	terraform.tfstate',
    },
    {
      command: 'ls -la terraform.tfstate*',
      what: 'Shows the current state and its single backup.',
    },
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'The check to run immediately after restoring a backup.',
      expected: 'Exit 0 if the restore was correct.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Proposes creating everything - state is missing, or you are in the wrong directory or workspace.',
    },
    {
      command: 'pwd && ls terraform.tfstate',
      what: 'The first two things to check when state seems to have vanished.',
    },
    {
      command: 'cp terraform.tfstate.backup terraform.tfstate && terraform plan',
      what: 'Recovers from one bad state command and verifies immediately.',
    },
    {
      command: 'terraform force-unlock <LOCK_ID>',
      what: 'Clears a stale local lock after a crash. Confirm no Terraform process is running first.',
    },
  ],
  commonMistakes: [
    'Using local state for anything a colleague or a pipeline will touch.',
    'Committing `terraform.tfstate`. It contains plaintext secrets and cannot be merged.',
    'Relying on `terraform.tfstate.backup` as a backup strategy. It is one step of history.',
    'Assuming the local file lock protects against a colleague on another machine. It does not.',
    'Running Terraform from a directory synced by a cloud drive, so two machines write the same state file.',
    'Deleting a project directory without realising state was data.',
  ],
  examTips: [
    'The local backend is the default when no `backend` block is present.',
    'State goes to `terraform.tfstate`, and the previous version to `terraform.tfstate.backup`.',
    'It provides local file locking only - nothing across machines.',
    'It offers no sharing, no encryption and no version history.',
    'Non-default workspaces live in `terraform.tfstate.d/<name>/`.',
    'Moving away from it is `terraform init -migrate-state` after adding a backend block.',
  ],
  summary: [
    'No backend block means local state in the working directory.',
    'It gives you a single backup file and a same-machine lock, and nothing more.',
    'It is appropriate for personal experiments only.',
    'Gitignore state from the first commit; it holds plaintext secrets.',
    'Migrate with `init -migrate-state` as soon as anyone else is involved.',
  ],
  practice: [
    {
      id: 'tf-localbe-p1',
      level: 'beginner',
      prompt: 'Which two files does the local backend maintain, and what is the second for?',
      answer:
        '`terraform.tfstate` and `terraform.tfstate.backup`. The backup is the single previous version, written before each new write.',
      explanation:
        'It is the fastest recovery from one mistaken state command, and it gives you exactly one step back.',
    },
    {
      id: 'tf-localbe-p2',
      level: 'beginner',
      prompt: 'Does the local backend support locking?',
      answer:
        'Yes, but only a local OS file lock. It prevents two processes on the same machine from writing at once and offers no protection across machines.',
      explanation:
        'This is why local state plus a shared network drive or cloud sync folder is a genuinely dangerous combination.',
    },
    {
      id: 'tf-localbe-p3',
      level: 'intermediate',
      prompt: 'Name three things the local backend does not provide.',
      answer: 'Sharing between people or machines, encryption at rest, and version history.',
      explanation:
        'A remote backend with object versioning and encryption supplies all three, which is why it is the norm for anything shared.',
    },
    {
      id: 'tf-localbe-p4',
      level: 'advanced',
      prompt:
        'Your laptop dies with local state on it, but the infrastructure is still running. What is the situation and the recovery path?',
      answer:
        'The resources exist but are unmanaged - state records, it does not control. Recovery means recreating the configuration and importing every resource, one at a time, using its real identifier.',
      explanation:
        'This is the concrete argument for a remote backend with versioning: it turns an unrecoverable loss into restoring a previous object version.',
    },
  ],
  lab: {
    title: 'Break local state and recover it',
    scenario:
      'Use the backup file to recover from a bad state command, then migrate to a different local backend path with state intact.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      { instruction: 'Create a configuration with two `local_file` resources and apply it.' },
      {
        instruction:
          'Confirm `terraform.tfstate` and `terraform.tfstate.backup` both exist, and compare their `serial`.',
      },
      {
        instruction:
          'Run `terraform state rm` on one resource, then `terraform plan` and explain what it proposes.',
      },
      {
        instruction:
          'Recover with `cp terraform.tfstate.backup terraform.tfstate` and verify with a plan.',
      },
      {
        instruction:
          'Take an explicit copy with `terraform state pull > backup.json`, then remove BOTH resources from state.',
      },
      {
        instruction:
          'Recover from `backup.json` using `terraform state push`, and verify. Note why the backup file could not have helped this time.',
        hint: 'You performed two writes, and only one step of history is kept.',
      },
      {
        instruction:
          'Add a `backend "local"` block with a different path and migrate with `init -migrate-state`.',
      },
      {
        instruction:
          'Add a `.gitignore` and confirm with `git check-ignore` that state cannot be committed.',
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

  # Added in step 7.
  # backend "local" {
  #   path = "state/terraform.tfstate"
  # }
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
        title: 'The recovery drill',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

jq .serial terraform.tfstate terraform.tfstate.backup
# The backup has a lower serial: it is the previous write.

# One bad command:
terraform state rm local_file.a
terraform plan
# Plan: 1 to add. a.txt still exists on disk, but Terraform
# no longer knows about it, so it wants to create it again.

# Recover one step:
cp terraform.tfstate.backup terraform.tfstate
terraform state list          # local_file.a is back
terraform plan                # No changes.

# Two bad commands exhaust the single backup:
terraform state pull > backup.json      # a REAL copy first
terraform state rm local_file.a
terraform state rm local_file.b
terraform state list                     # empty
cp terraform.tfstate.backup terraform.tfstate
terraform state list                     # only local_file.a -
# the backup is now the state after the FIRST rm.

# The explicit copy is what actually saves you:
terraform state push backup.json
terraform state list                     # both back
terraform plan                           # No changes.

# Migrate to a different local path:
#   uncomment the backend block, then
terraform init -migrate-state
#   Do you want to copy existing state to the new backend? yes
ls state/terraform.tfstate
terraform plan                           # No changes.

# Gitignore:
printf '*.tfstate\\n*.tfstate.*\\n.terraform/\\n' > .gitignore
git init -q
git check-ignore -v terraform.tfstate state/terraform.tfstate

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | wc -l',
        what: 'Confirms both resources are managed after recovery.',
        expected: '2',
      },
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'The check that a recovery actually worked.',
        expected: 'exit=0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf state backup.json .git .gitignore *.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes state, backups, files and the throwaway repository.',
      },
    ],
  },
  relatedTopicIds: ['tf-remote-backends', 'tf-state-fundamentals', 'tf-drift-and-state-commands'],
  docs: [
    {
      title: 'The local backend',
      url: 'https://developer.hashicorp.com/terraform/language/backend/local',
    },
  ],
}
