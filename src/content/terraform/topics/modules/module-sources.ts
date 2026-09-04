import type { Topic } from '../../../types'

export const moduleSources: Topic = {
  id: 'tf-module-sources',
  title: 'How Terraform sources modules',
  domainId: 'tf-modules',
  difficulty: 'intermediate',
  estimatedMinutes: 14,
  order: 2,
  tags: ['source', 'registry', 'git', 'local path', 'objective-5a'],
  oneLiner:
    'Every place a module can come from - local paths, registries, Git, HTTP, S3 - and the syntax for each.',
  explanation: [
    'The `source` argument tells Terraform where a module lives. Terraform infers the source *type* from the string, which is why the exact form matters.',
    'The important behavioural split is between **local paths** and everything else. A local path is read in place, so edits take effect immediately. Every other source is **downloaded and cached** in `.terraform/modules/`, so changes require `terraform init -upgrade`.',
    'Only **registry** sources support the `version` argument. For Git you pin with a `ref` in the URL; for archives you pin by choosing an immutable URL.',
    'A local path must start with `./` or `../`. A string like `modules/network` without the leading dot is interpreted as a *registry* address and will fail confusingly.',
  ],
  whyItMatters: [
    'Objective 5a is explaining how Terraform sources modules - this lesson is the objective.',
    'The `./` requirement for local paths catches nearly everyone once, and the error message points at the registry rather than at the real cause.',
    'Knowing which sources support versioning determines how you pin a shared module, which is the difference between reproducible and not.',
  ],
  howItWorks: [
    '**Local path**: `./modules/network` or `../shared/network`. Must begin with `./` or `../`. Read in place; no download, no cache, no `version` argument.',
    '**Terraform Registry**: `terraform-aws-modules/vpc/aws` - the form `<NAMESPACE>/<NAME>/<PROVIDER>`. Supports `version`. A private registry prepends a hostname: `app.terraform.io/acme/vpc/aws`.',
    '**Git over HTTPS**: `git::https://github.com/acme/modules.git`. Add `//subdir` for a module inside the repository, and `?ref=v1.2.0` to pin a tag, branch or commit.',
    '**Git over SSH**: `git::ssh://git@github.com/acme/modules.git`. Uses your SSH agent, which is how private repositories work without embedding credentials.',
    '**GitHub and Bitbucket shorthand**: `github.com/acme/modules` is detected automatically and expanded to a Git source.',
    '**HTTP archive**: a URL returning a `.zip`, `.tar.gz` or similar. Terraform downloads and unpacks it.',
    '**S3 and GCS**: `s3::https://bucket.s3.amazonaws.com/path/module.zip` and `gcs::https://...`, using your normal cloud credentials.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which source form do I need?',
      caption:
        'The two things to notice: local paths need the leading dot, and only registry sources take a version argument.',
      question: 'Where does the module live?',
      branches: [
        {
          condition: 'in this repository',
          result: './modules/name',
          detail: 'Must start with ./ or ../. Read in place, no version argument.',
          tone: 'accent',
        },
        {
          condition: 'in a public or private registry',
          result: 'namespace/name/provider',
          detail: 'The only form that supports version = "~> 5.0"',
        },
        {
          condition: 'in a Git repository',
          result: 'git::https://... or github.com/...',
          detail: 'Pin with ?ref=v1.2.0; //subdir selects a directory',
        },
        {
          condition: 'in an object store or archive',
          result: 's3::https://... or a .zip URL',
          detail: 'Pin by using an immutable URL',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Local versus remote: what changes',
      caption: 'This is the practical difference that affects your development loop every day.',
      nodes: [
        {
          label: 'source = "./modules/network"',
          detail: 'A local path',
          tone: 'accent',
        },
        {
          label: 'Read in place on every run',
          detail: 'No copy in .terraform/modules/',
          arrowLabel: 'local',
        },
        {
          label: 'Edit the module, run plan',
          detail: 'The change is picked up immediately',
          tone: 'success',
          branch: {
            label: 'Remote source instead',
            detail: 'The cached copy is used until init -upgrade',
          },
        },
        {
          label: 'Adding a NEW module block still needs init',
          detail: 'Even for a local path - installation is per-block',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'source forms',
      purpose: 'Every supported source syntax, with the pinning mechanism for each.',
      fields: [
        {
          path: './modules/x',
          meaning: 'Local path. Leading ./ or ../ required. No version.',
          required: true,
        },
        {
          path: 'namespace/name/provider',
          meaning: 'Registry. Supports version. e.g. terraform-aws-modules/vpc/aws',
        },
        {
          path: 'host/namespace/name/provider',
          meaning: 'Private registry, e.g. app.terraform.io/acme/vpc/aws',
        },
        {
          path: 'git::https://host/repo.git//subdir?ref=v1.0.0',
          meaning: 'Git. //subdir and ?ref are the two extras.',
        },
        { path: 'github.com/org/repo', meaning: 'Shorthand, auto-detected as Git.' },
        { path: 'https://host/module.zip', meaning: 'HTTP archive.' },
        { path: 's3::https://bucket.s3.region.amazonaws.com/key.zip', meaning: 'S3 archive.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The branch that changed under them',
    story: [
      'A team sourced a shared module from `git::https://github.com/acme/modules.git//network` with no `ref`. That defaults to the repository’s default branch.',
      'For months it worked. Then the module’s owners merged a change that renamed an output. The next `terraform init -upgrade` in an unrelated pipeline pulled it, and four configurations broke simultaneously - none of which had changed.',
      'Because there was no `ref`, there was no way to say which version had been working. Recovery meant reading the module repository’s commit history to find the last compatible commit.',
      'Adding `?ref=v1.4.0` to every consumer took an hour and made the dependency explicit, reviewable and upgradable on each team’s own schedule.',
    ],
    code: [
      {
        title: 'Unpinned versus pinned',
        language: 'hcl',
        code: `# FRAGILE: tracks the default branch. Whatever is on it, today.
module "network" {
  source = "git::https://github.com/acme/modules.git//network"
}

# PINNED: an immutable tag. Upgrades are a reviewable commit.
module "network" {
  source = "git::https://github.com/acme/modules.git//network?ref=v1.4.0"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Every source form, in one file',
      language: 'hcl',
      explanation:
        'Note that only the registry blocks have a `version` argument. Everywhere else, pinning is part of the source string.',
      code: `# Local: read in place. Note the leading "./".
module "network" {
  source = "./modules/network"
}

# Local, above the current directory.
module "shared" {
  source = "../../shared-modules/logging"
}

# Public Terraform Registry. The only form with "version".
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = "acme-vpc"
  cidr = "10.0.0.0/16"
}

# Private registry (HCP Terraform or Terraform Enterprise).
module "internal" {
  source  = "app.terraform.io/acme-corp/network/aws"
  version = "~> 2.1"
}

# Git over HTTPS, a subdirectory, pinned to a tag.
module "database" {
  source = "git::https://github.com/acme/terraform-modules.git//database?ref=v3.2.1"
}

# Git over SSH - private repositories, using your SSH agent.
module "private" {
  source = "git::ssh://git@github.com/acme/private-modules.git//vault?ref=v1.0.0"
}

# GitHub shorthand, auto-detected. Also supports ?ref and //subdir.
module "shorthand" {
  source = "github.com/acme/terraform-modules//monitoring?ref=v2.0.0"
}

# An HTTP archive.
module "archive" {
  source = "https://artifacts.acme.com/modules/network-1.4.0.zip"
}

# An S3 archive, using your normal AWS credentials.
module "from_s3" {
  source = "s3::https://acme-modules.s3.eu-west-1.amazonaws.com/network-1.4.0.zip"
}`,
    },
    {
      title: 'The local-path mistake',
      language: 'hcl',
      explanation:
        'The error message names the registry, which is why this takes people longer to diagnose than it should.',
      code: `# WRONG: no leading "./", so Terraform reads this as a registry
# address and fails.
# module "network" {
#   source = "modules/network"
# }
#
# Error: Invalid registry module source address
#   Module source addresses must be in the form
#   NAMESPACE/NAME/PROVIDER

# RIGHT:
module "network" {
  source = "./modules/network"
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Installs every module. Remote sources are downloaded to .terraform/modules/.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Re-fetches remote modules, picking up a moved branch or a newer allowed version.',
      namespaceNote: 'The only way a cached remote module is refreshed.',
    },
    {
      command: 'cat .terraform/modules/modules.json | jq .',
      what: 'Shows exactly which source and directory each module resolved to.',
    },
    {
      command: 'terraform get -update',
      what: 'Downloads modules without doing anything else. Rarely needed; `init` covers it.',
    },
  ],
  declarative: {
    steps: [
      'Use local paths for modules that live in the same repository as their caller.',
      'Pin every remote module: `version` for registry sources, `?ref=` for Git.',
      'Prefer tags over branches for `ref` - a tag is immutable, a branch is not.',
      'Use SSH sources for private Git repositories so no credentials appear in the configuration.',
      'Run `init -upgrade` deliberately, and review the resulting plan.',
    ],
    code: [
      {
        title: 'Where each source form belongs',
        language: 'hcl',
        explanation:
          'A rule of thumb: local for things you change together, registry or pinned Git for things that version independently.',
        code: `# Same repository, changes together with the caller: local.
module "app_network" {
  source = "./modules/network"
}

# Owned by another team, versioned independently: pinned Git.
module "shared_logging" {
  source = "git::ssh://git@github.com/acme/platform-modules.git//logging?ref=v4.1.0"
}

# Third party, well maintained, semantically versioned: registry.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"
}

# Anti-pattern: a local path reaching out of the repository.
# It breaks for anyone whose directory layout differs.
# module "shared" {
#   source = "../../../other-repo/modules/network"
# }`,
      },
    ],
  },
  verification: [
    {
      command: 'jq -r \'.Modules[] | "\\(.Key)\\t\\(.Source)"\' .terraform/modules/modules.json',
      what: 'Lists every module and the source it came from.',
    },
    {
      command: 'ls .terraform/modules/',
      what: 'Shows which modules were downloaded rather than read in place.',
    },
    {
      command: 'terraform init && git diff --exit-code',
      what: 'Confirms init changes nothing in a repository whose modules are all pinned.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports "Invalid registry module source address" - a local path missing its `./`.',
    },
    {
      command: 'terraform init',
      what: 'Reports a Git authentication failure - use an SSH source with an agent, or configure a credential helper.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Fixes a stale cached remote module after the tag or branch moved.',
    },
    {
      command: 'rm -rf .terraform/modules && terraform init',
      what: 'Rebuilds the module cache when it is corrupt. Does not touch state.',
    },
  ],
  commonMistakes: [
    'Omitting `./` on a local path. Terraform then treats it as a registry address.',
    'Adding `version` to a Git or local source. It is only valid for registry sources.',
    'Sourcing Git without a `ref`, so the module tracks a moving branch.',
    'Using a branch name as `ref` and treating it as a version. Tags are immutable; branches are not.',
    'Editing a remote module’s cached copy in `.terraform/modules/`. It is overwritten on the next init.',
    'A local path pointing outside the repository, which breaks for anyone with a different checkout layout.',
  ],
  examTips: [
    'Local paths must begin with `./` or `../`, and are read in place rather than cached.',
    'Only registry sources support the `version` argument.',
    'Registry address form: `<NAMESPACE>/<NAME>/<PROVIDER>`, optionally prefixed with a hostname.',
    'Git sources use `//subdir` for a directory and `?ref=` to pin.',
    '`github.com/org/repo` is detected automatically as a Git source.',
    'Remote modules are cached in `.terraform/modules/` and refreshed only by `init -upgrade`.',
  ],
  summary: [
    'Terraform infers the source type from the string, so the exact form matters.',
    'Local paths need `./` and are read in place; everything else is cached.',
    '`version` works only for registry sources; Git pins with `?ref=`.',
    'Pin every remote module, and prefer tags to branches.',
    '`init -upgrade` is the only thing that refreshes a cached remote module.',
  ],
  practice: [
    {
      id: 'tf-modsrc-p1',
      level: 'beginner',
      prompt: 'What is wrong with `source = "modules/network"`?',
      answer:
        'A local path must start with `./` or `../`. Without it, Terraform reads the string as a registry address and reports an invalid registry module source.',
      explanation:
        'The error message mentioning the registry is what makes this take longer to diagnose than it should.',
    },
    {
      id: 'tf-modsrc-p2',
      level: 'beginner',
      prompt: 'Which source types support the `version` argument?',
      answer: 'Registry sources only - public or private.',
      explanation:
        'For Git you pin with `?ref=`; for archives you pin by choosing an immutable URL.',
    },
    {
      id: 'tf-modsrc-p3',
      level: 'intermediate',
      prompt:
        'Write a source string for the `database` directory of `github.com/acme/modules`, pinned to tag `v2.3.0`.',
      answer: '`git::https://github.com/acme/modules.git//database?ref=v2.3.0`',
      explanation:
        '`//` selects the subdirectory and `?ref=` pins the revision. The shorthand `github.com/acme/modules//database?ref=v2.3.0` also works.',
    },
    {
      id: 'tf-modsrc-p4',
      level: 'advanced',
      prompt:
        'Why does editing a local module take effect immediately while editing a Git-sourced one does not?',
      answer:
        'Local paths are read in place on every run, so there is no copy to go stale. Remote sources are downloaded once into `.terraform/modules/` and reused from there until `terraform init -upgrade` re-fetches them.',
      explanation:
        'This is also why editing the cached copy is pointless: the next `init -upgrade` overwrites it.',
    },
  ],
  lab: {
    title: 'Every source type that works offline',
    scenario:
      'Exercise local paths, trigger the missing-dot error, then source a module from a local Git repository and see caching behaviour for yourself.',
    prerequisites: ['Terraform 1.5 or newer', 'git', 'jq'],
    tasks: [
      {
        instruction:
          'Create a local module in `./modules/greeting` and call it with a correct local path.',
      },
      {
        instruction:
          'Change the source to `modules/greeting` - no leading dot - run `init`, and read the error carefully.',
      },
      {
        instruction:
          'Restore the correct path. Edit the module and confirm a plan picks the change up with no re-init.',
      },
      {
        instruction:
          'Create a local Git repository containing a copy of the module, commit it, and tag it `v1.0.0`.',
      },
      {
        instruction:
          'Add a second module block sourcing that repository with `git::file://...?ref=v1.0.0`, then `init`.',
      },
      {
        instruction:
          'Inspect `.terraform/modules/modules.json` and confirm the local module has no cached copy while the Git one does.',
      },
      {
        instruction:
          'Change the module inside the Git repository, commit, and confirm a plan does NOT pick it up. Then tag `v1.1.0`, update the ref, and `init -upgrade`.',
      },
      {
        instruction: 'Try adding `version = "1.0.0"` to the Git module block and read the error.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'modules/greeting/main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = ">= 2.0, < 3.0" }
  }
}

variable "name" {
  type = string
}

resource "local_file" "this" {
  filename = "\${path.root}/\${var.name}.txt"
  content  = "hello \${var.name} (v1)\\n"
}

output "path" {
  value = local_file.this.filename
}`,
      },
      {
        title: 'Root main.tf',
        language: 'hcl',
        code: `module "local_copy" {
  source = "./modules/greeting"
  name   = "local"
}

module "git_copy" {
  # file:// works exactly like https:// for Git, and needs no network.
  source = "git::file:///tmp/greeting-repo//.?ref=v1.0.0"
  name   = "fromgit"
}`,
      },
      {
        title: 'The experiment',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# The missing-dot error:
sed -i 's|"./modules/greeting"|"modules/greeting"|' main.tf
terraform init
# Error: Invalid registry module source address
sed -i 's|"modules/greeting"|"./modules/greeting"|' main.tf

# Local modules are read in place - no re-init needed for edits:
sed -i 's/(v1)/(v2)/' modules/greeting/main.tf
terraform plan          # 1 to change, without re-running init

# Build a local Git module repository:
mkdir -p /tmp/greeting-repo
cp modules/greeting/*.tf /tmp/greeting-repo/
git -C /tmp/greeting-repo init -q
git -C /tmp/greeting-repo add -A
git -C /tmp/greeting-repo -c user.email=a@b -c user.name=a commit -qm v1
git -C /tmp/greeting-repo tag v1.0.0

terraform init
jq -r '.Modules[] | "\\(.Key)\\t\\(.Source)\\t\\(.Dir)"' .terraform/modules/modules.json
# local_copy has Dir "modules/greeting"  - read in place
# git_copy   has Dir ".terraform/modules/git_copy" - cached

# A remote module change is NOT picked up without -upgrade:
sed -i 's/(v1)/(v3)/' /tmp/greeting-repo/main.tf
git -C /tmp/greeting-repo commit -aqm v3
git -C /tmp/greeting-repo tag v1.1.0
terraform plan          # no change to module.git_copy

sed -i 's/ref=v1.0.0/ref=v1.1.0/' main.tf
terraform init -upgrade
terraform plan          # NOW it changes

# version is registry-only:
#   add  version = "1.0.0"  to the git module block
terraform init
# Error: Invalid combination of arguments
#   "version" can only be used with registry module sources.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'jq -r \'.Modules[] | select(.Key != "") | .Key\' .terraform/modules/modules.json',
        what: 'Lists the installed module keys.',
        expected: 'local_copy and git_copy',
      },
      {
        command: 'ls .terraform/modules/',
        what: 'Only remote modules have a cached directory.',
        expected: 'git_copy and modules.json',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf modules /tmp/greeting-repo *.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the modules, the throwaway repository and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-module-basics', 'tf-module-versioning', 'tf-init'],
  docs: [
    {
      title: 'Module sources',
      url: 'https://developer.hashicorp.com/terraform/language/modules/sources',
    },
  ],
}
