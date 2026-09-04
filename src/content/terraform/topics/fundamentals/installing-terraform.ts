import type { Topic } from '../../../types'

export const installingTerraform: Topic = {
  id: 'tf-installing-terraform',
  title: 'Installing and versioning Terraform',
  domainId: 'tf-fundamentals',
  difficulty: 'beginner',
  estimatedMinutes: 12,
  order: 1,
  tags: ['install', 'version', 'required_version', 'tfenv', 'objective-2a'],
  oneLiner:
    'Getting the CLI onto your machine, pinning the version a configuration needs, and reading what `terraform version` tells you.',
  explanation: [
    'Terraform is a single static binary. There is no server, no daemon and no agent - `terraform` is the whole product, and it runs on your laptop or in your pipeline.',
    'Because it is one binary, installing it means putting that file on your `PATH`. Package managers do this for you; downloading the zip from HashiCorp works just as well.',
    'A configuration can state which CLI versions it supports with `required_version` inside the `terraform` block. Terraform refuses to run when the constraint is not met, which prevents a colleague on an older CLI from producing a state file yours cannot read.',
    'State format upgrades are one-way. A newer Terraform will happily upgrade a state file; an older Terraform will then refuse to touch it. That is the practical reason `required_version` matters on a shared configuration.',
  ],
  whyItMatters: [
    'Objective 2a explicitly covers installing and versioning - both Terraform itself and providers.',
    '`required_version` is a small block that prevents a genuinely nasty class of team problem, and it shows up in exam questions about the `terraform` block.',
    'Reading `terraform version` output correctly tells you whether a problem is the CLI, a provider, or your configuration.',
  ],
  howItWorks: [
    'Download or install the binary, then confirm with `terraform version`. It prints the CLI version and every installed provider version.',
    'Terraform follows semantic versioning: `1.MINOR.PATCH`. Since 1.0, minor releases are backwards compatible for configuration, so upgrading within 1.x is normally safe.',
    '`required_version` in the `terraform` block constrains the CLI. It accepts the usual operators: `>= 1.5`, `~> 1.9.0`, `>= 1.5, < 2.0`.',
    'Note the asymmetry: `required_version` cannot be satisfied by downloading a different Terraform. Terraform will simply stop and tell you which version is needed - unlike providers, which it fetches for you.',
    'Version managers such as `tfenv` keep several CLI versions side by side and switch automatically based on a `.terraform-version` file, which is how teams work across repositories pinned to different versions.',
    '`terraform version -json` gives machine-readable output, including whether a newer release is available - useful in CI checks.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'What happens when required_version is not met',
      caption:
        'Terraform downloads providers for you but never itself. A version constraint failure is a hard stop before anything else runs.',
      nodes: [
        {
          label: 'You run any terraform command',
          detail: 'init, plan, apply - it does not matter which',
        },
        {
          label: 'The terraform block is parsed first',
          detail: 'Before providers, before the backend, before resources',
          tone: 'accent',
        },
        {
          label: 'required_version is checked',
          detail: 'Against the CLI you are actually running',
          branch: {
            label: 'Constraint not satisfied',
            detail: 'Hard error. Terraform will NOT fetch a different CLI for you.',
          },
        },
        {
          label: 'Everything else proceeds',
          detail: 'Backend init, provider download, then your resources',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which version constraint should I write?',
      caption: 'The pessimistic operator ~> is the usual answer: allow patches, refuse surprises.',
      question: 'How much version freedom do you want to allow?',
      branches: [
        {
          condition: 'any reasonably modern CLI',
          result: '>= 1.5',
          detail: 'Common for shared modules, which should be permissive',
          tone: 'accent',
        },
        {
          condition: 'patch upgrades only',
          result: '~> 1.9.0',
          detail: 'Allows 1.9.1 and 1.9.7, refuses 1.10.0',
        },
        {
          condition: 'minor upgrades but never a major one',
          result: '~> 1.9',
          detail: 'Allows 1.10 and 1.11, refuses 2.0',
        },
        {
          condition: 'one exact version, no exceptions',
          result: '= 1.9.5',
          detail: 'Reproducible, but you must bump it deliberately',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'terraform block',
      purpose:
        'Settings for Terraform itself, not for your infrastructure. Cannot use variables - it is read before variables exist.',
      fields: [
        {
          path: 'required_version',
          meaning: 'Constraint on the CLI version. Terraform stops if unmet.',
        },
        {
          path: 'required_providers',
          meaning: 'Which providers, from where, at which versions.',
          required: true,
        },
        { path: 'backend', meaning: 'Where state is stored. At most one.' },
        { path: 'cloud', meaning: 'HCP Terraform integration. Mutually exclusive with backend.' },
        {
          path: 'experiments',
          meaning: 'Opt in to language experiments. Rare, and not exam material.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The state file nobody could open',
    story: [
      'A developer upgraded their local Terraform to try a new feature, then ran `apply` on the shared production configuration. It worked.',
      'The state format had been upgraded in the process. Every colleague on the previous CLI version then got "state snapshot was created by Terraform vX, which is newer than current" and could not plan at all.',
      'The fix was for everyone to upgrade, which is fine - but it happened during a release window, discovered by the person who needed to ship.',
      'Adding `required_version = "~> 1.9.0"` and a `.terraform-version` file would have turned that afternoon into an error message at the start of the developer’s first command.',
    ],
    code: [
      {
        title: 'The two lines that prevent it',
        language: 'hcl',
        code: `terraform {
  # Anyone on a different minor version is stopped before
  # they can upgrade the shared state file.
  required_version = "~> 1.9.0"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A complete terraform block',
      language: 'hcl',
      explanation:
        'Constraints on both the CLI and the providers. This block is the first thing Terraform reads and the last thing you should leave out.',
      code: `terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}`,
    },
    {
      title: 'Reading terraform version',
      language: 'bash',
      explanation:
        'The provider lines matter as much as the first line: they tell you exactly which plugin produced a behaviour you are debugging.',
      code: `$ terraform version
Terraform v1.16.1
on linux_amd64
+ provider registry.terraform.io/hashicorp/aws v5.62.0
+ provider registry.terraform.io/hashicorp/random v3.6.2

# Machine-readable, for CI:
$ terraform version -json
{
  "terraform_version": "1.16.1",
  "platform": "linux_amd64",
  "provider_selections": {
    "registry.terraform.io/hashicorp/aws": "5.62.0"
  },
  "terraform_outdated": false
}`,
    },
    {
      title: 'A version file for a version manager',
      language: 'text',
      explanation:
        'tfenv and similar tools read this file and switch automatically when you change directory, so the right CLI is used without anyone thinking about it.',
      code: `# .terraform-version
1.16.1`,
    },
  ],
  imperative: [
    {
      command: 'terraform version',
      what: 'Prints the CLI version, the platform, and every installed provider version.',
      expected: 'Terraform v1.16.1',
    },
    {
      command: 'terraform version -json',
      what: 'The same information as JSON, including `terraform_outdated`.',
    },
    {
      command: 'terraform -help',
      what: 'Lists every subcommand. Worth skimming once - there are more than you think.',
    },
    {
      command: 'terraform -install-autocomplete',
      what: 'Adds shell completion for subcommands and flags.',
      namespaceNote: 'Writes to your shell profile; restart the shell afterwards.',
    },
    {
      command: 'tfenv install 1.16.1 && tfenv use 1.16.1',
      what: 'Installs and selects a specific CLI version with the tfenv version manager.',
    },
  ],
  declarative: {
    steps: [
      'Add a `terraform` block with `required_version` to every configuration you share with anyone.',
      'Pin providers in `required_providers` at the same time - the two belong together.',
      'Commit a `.terraform-version` file so version managers pick the right CLI automatically.',
      'Commit `.terraform.lock.hcl` so provider versions are identical for everyone.',
    ],
    code: [
      {
        title: 'The files that make a configuration reproducible',
        language: 'bash',
        explanation:
          'The lock file is the one people wrongly gitignore. It is the record of exactly which provider builds were used.',
        code: `project/
├── .terraform-version        # commit: which CLI (for tfenv)
├── .terraform.lock.hcl       # commit: which provider builds
├── .gitignore                # ignore .terraform/ and *.tfstate
├── main.tf
├── variables.tf
└── outputs.tf

# .gitignore
.terraform/
*.tfstate
*.tfstate.*
*.tfvars          # values often contain secrets
crash.log`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform version | head -1',
      what: 'Confirms which CLI you are actually running - not which one you installed.',
    },
    {
      command: 'terraform init',
      what: 'Fails immediately and clearly if `required_version` is not satisfied.',
      expected: 'Error: Unsupported Terraform Core version',
    },
    {
      command: 'terraform version -json | jq -r .terraform_outdated',
      what: 'A one-line CI check for "is a newer release available".',
      expected: 'false',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports "Unsupported Terraform Core version": your CLI does not satisfy `required_version`.',
      expected: 'The message names the constraint and your version.',
    },
    {
      command: 'terraform plan',
      what: 'Reports the state snapshot is newer than the current CLI: someone applied with a newer Terraform.',
    },
    {
      command: 'which -a terraform',
      what: 'Diagnoses two installations shadowing each other on the PATH.',
    },
  ],
  commonMistakes: [
    'Leaving `required_version` out of a shared configuration. The first person to upgrade silently upgrades the state format for everyone.',
    'Trying to use a variable inside the `terraform` block. It is parsed before variables exist, so this is a hard error.',
    'Gitignoring `.terraform.lock.hcl`. It is meant to be committed - that is the whole point of a lock file.',
    'Assuming Terraform will download the CLI version a configuration asks for. It will not; only providers are fetched.',
    'Committing `*.tfvars`. Variable values frequently contain secrets, and they are not part of the reproducibility story.',
  ],
  examTips: [
    'Terraform is a single binary with no server component. Expect this as a true/false style question.',
    '`required_version` constrains the CLI; `required_providers` constrains plugins. Different fields, different jobs.',
    'The `terraform` block cannot reference variables, locals or data sources.',
    'State upgrades are forward-only: a newer CLI upgrades state, and older CLIs then cannot read it.',
    '`~> 1.9.0` allows patch releases only; `~> 1.9` allows minor releases. Know the difference cold.',
  ],
  summary: [
    'Terraform is one binary on your PATH - no server, no agent.',
    '`required_version` stops the wrong CLI before anything else happens.',
    'Providers are downloaded for you; the CLI is not.',
    'Commit `.terraform.lock.hcl` and `.terraform-version`; ignore `.terraform/` and state files.',
    '`terraform version` shows the CLI *and* the providers in use.',
  ],
  practice: [
    {
      id: 'tf-install-p1',
      level: 'beginner',
      prompt:
        'Which does Terraform download automatically when a constraint is not satisfied: the CLI, providers, or both?',
      answer:
        'Providers only. An unsatisfied `required_version` is a hard error you must resolve yourself.',
      explanation:
        'This asymmetry is a favourite exam question. `terraform init` fetches provider plugins; nothing fetches Terraform.',
    },
    {
      id: 'tf-install-p2',
      level: 'beginner',
      prompt: 'What does `required_version = "~> 1.9.0"` allow, and what does it refuse?',
      answer: 'It allows 1.9.1 through 1.9.x and refuses 1.10.0 and above.',
      explanation:
        'With three version segments, `~>` pins the minor and allows the patch to float. With two (`~> 1.9`) it pins the major and allows the minor to float.',
    },
    {
      id: 'tf-install-p3',
      level: 'intermediate',
      prompt: 'Why does putting `required_version = var.tf_version` fail?',
      answer:
        'Because the `terraform` block is evaluated before variables are available. It accepts only literal values.',
      explanation:
        'The same restriction applies to `required_providers` versions and to the `backend` block, which is why backends are configured with `-backend-config` rather than variables.',
    },
    {
      id: 'tf-install-p4',
      level: 'advanced',
      prompt:
        'A colleague reports "state snapshot was created by Terraform v1.16.1, which is newer than current v1.14.2". What happened, and what are the two ways forward?',
      answer:
        'Someone applied using a newer CLI, which upgraded the state format. Either everyone upgrades to at least 1.16.1, or you restore an older state snapshot from backend versioning and re-apply with the older CLI.',
      explanation:
        'The first option is nearly always correct. The second is a recovery path, and it depends on your backend keeping version history - which is one reason to enable it.',
    },
  ],
  lab: {
    title: 'Pin a version and watch it stop you',
    scenario:
      'Prove that `required_version` is enforced before anything else, and that the error message tells you exactly what is wrong.',
    prerequisites: ['Terraform 1.5 or newer', 'An empty directory'],
    tasks: [
      { instruction: 'Run `terraform version` and note your exact version.' },
      {
        instruction:
          'Create a `main.tf` with a `terraform` block whose `required_version` is deliberately impossible, such as `">= 99.0"`.',
      },
      {
        instruction: 'Run `terraform init` and read the error carefully.',
        hint: 'Note that it fails before mentioning providers at all.',
      },
      {
        instruction:
          'Change the constraint to `~> <your major>.<your minor>.0` and add a `local_file` resource.',
      },
      { instruction: 'Run `terraform init` and `terraform apply` - both should now succeed.' },
      {
        instruction:
          'Run `terraform version -json` and find the provider you just installed in the output.',
      },
      {
        instruction:
          'Try adding `required_version = var.v` with a variable declared. Confirm it is rejected, and read the reason.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'Step 2: the deliberately impossible constraint',
        language: 'hcl',
        code: `terraform {
  required_version = ">= 99.0"
}`,
      },
      {
        title: 'Step 4: a working configuration',
        language: 'hcl',
        code: `terraform {
  # Replace with your own major.minor.
  required_version = "~> 1.16.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

resource "local_file" "pinned" {
  filename = "\${path.module}/pinned.txt"
  content  = "version pinning works\\n"
}`,
      },
      {
        title: 'The whole run',
        language: 'bash',
        code: `terraform version                 # note your version

# With ">= 99.0":
terraform init
# Error: Unsupported Terraform Core version
#   This configuration does not support Terraform version 1.16.1.
# Note: no provider download was even attempted.

# After fixing the constraint:
terraform init
terraform apply -auto-approve
terraform version -json | jq .provider_selections

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: "terraform version -json | jq -r '.provider_selections | keys[]'",
        what: 'Confirms the local provider is installed for this directory.',
        expected: 'registry.terraform.io/hashicorp/local',
      },
      {
        command: 'ls -a | grep terraform',
        what: 'Shows the artefacts init produced.',
        expected: '.terraform and .terraform.lock.hcl',
      },
    ],
    cleanup: [
      {
        command: 'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl',
        what: 'Removes the file and the initialisation artefacts.',
      },
    ],
  },
  relatedTopicIds: ['tf-how-providers-work', 'tf-provider-versioning', 'tf-init'],
  docs: [
    {
      title: 'Terraform settings block',
      url: 'https://developer.hashicorp.com/terraform/language/terraform',
    },
    {
      title: 'Install Terraform',
      url: 'https://developer.hashicorp.com/terraform/install',
    },
  ],
}
