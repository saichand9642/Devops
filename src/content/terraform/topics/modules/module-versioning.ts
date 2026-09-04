import type { Topic } from '../../../types'

export const moduleVersioning: Topic = {
  id: 'tf-module-versioning',
  title: 'Managing module versions',
  domainId: 'tf-modules',
  difficulty: 'intermediate',
  estimatedMinutes: 13,
  order: 4,
  tags: ['version', 'registry', 'ref', 'upgrade', 'objective-5d'],
  oneLiner:
    'Pinning a module, upgrading it deliberately, and why module versions are not in the lock file.',
  explanation: [
    'Registry modules take a `version` argument accepting the same constraint operators as providers: `= 1.2.0`, `>= 1.0, < 2.0`, `~> 1.2`, `!= 1.3.0`.',
    'Git and archive sources have no `version` argument. You pin them inside the source string with `?ref=v1.2.0` for Git, or by using an immutable URL for an archive.',
    'Crucially, **module versions are not recorded in `.terraform.lock.hcl`**. That file locks providers only. The resolved module version is recorded in `.terraform/modules/modules.json`, which is a gitignored cache.',
    'So the reproducibility story for modules is different: it comes from writing a narrow enough constraint in the configuration, not from a lock file. That is a good reason to pin more tightly for modules than for providers.',
  ],
  whyItMatters: [
    'Objective 5d is managing module versions, and the fact that modules are not in the lock file is a frequently-missed detail.',
    'An unpinned module means your infrastructure can change because somebody else published something.',
    'Knowing that only `init -upgrade` moves a module version explains why bumping a constraint sometimes appears to do nothing.',
  ],
  howItWorks: [
    '`version` is valid only for registry sources. Using it with a Git or local source is an error.',
    'At `terraform init`, Terraform picks the newest published version satisfying the constraint and records it in `.terraform/modules/modules.json`.',
    'A plain `init` reuses the already-installed version. `init -upgrade` re-resolves the constraint and may install a newer one.',
    'Because there is no module lock file, two people with the same configuration and a loose constraint can legitimately be running different module versions.',
    'For Git sources, `?ref=` accepts a tag, a branch or a commit SHA. Tags and SHAs are immutable; branches are not.',
    'Registry modules follow semantic versioning by convention, so `~>` is meaningful. A Git repository may not, which is another reason to pin exactly.',
    'Upgrading a module is a two-step review: the constraint change, and the plan it produces.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'How do I pin this module?',
      caption:
        'Only registry sources have a version argument. Everything else pins inside the source string.',
      question: 'What kind of source is it?',
      branches: [
        {
          condition: 'Terraform Registry',
          result: 'version = "~> 5.8"',
          detail: 'The only form with a version argument',
          tone: 'accent',
        },
        {
          condition: 'Git',
          result: '?ref=v1.4.0 in the source',
          detail: 'A tag or commit SHA. Never a branch.',
        },
        {
          condition: 'an archive URL',
          result: 'Use an immutable URL',
          detail: 'Include the version in the filename',
        },
        {
          condition: 'a local path',
          result: 'It is versioned with your repository',
          detail: 'No pinning needed or possible',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Why bumping a constraint appears to do nothing',
      caption:
        'Modules have no lock file, but the installed copy is still cached - and only -upgrade re-resolves it.',
      nodes: [
        {
          label: 'You widen the version constraint',
          detail: '~> 5.8 becomes ~> 5.9',
        },
        {
          label: 'terraform init',
          detail: 'Sees a module already installed in .terraform/modules/',
          tone: 'accent',
        },
        {
          label: 'Does the installed version still satisfy it?',
          detail: 'Checked against modules.json',
          branch: {
            label: 'No longer satisfies',
            detail: 'Init re-resolves automatically and installs a matching version',
          },
        },
        {
          label: 'Yes: the installed version is kept',
          detail: 'Newer allowed releases are ignored',
          arrowLabel: 'nothing appears to happen',
        },
        {
          label: 'terraform init -upgrade re-resolves',
          detail: 'Picks the newest version the constraint allows',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Module version mechanisms',
      purpose: 'Where a module version is declared and where it is recorded.',
      fields: [
        {
          path: 'version (module block)',
          meaning: 'Constraint. Registry sources only.',
          required: true,
        },
        {
          path: '?ref= (source string)',
          meaning: 'Git revision - tag, branch or SHA.',
          required: true,
        },
        {
          path: '.terraform/modules/modules.json',
          meaning: 'Records the resolved version. Gitignored cache, NOT a lock file.',
          required: true,
        },
        {
          path: '.terraform.lock.hcl',
          meaning: 'Providers only. Module versions are NOT in here.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Two engineers, one configuration, different modules',
    story: [
      'A configuration used `version = "~> 5.0"` for a community VPC module. One engineer had initialised in January and had 5.1.0 cached; another initialised in June and got 5.8.2.',
      'The June engineer’s plan proposed adding tags to nine subnets. They assumed drift, investigated for an hour, and eventually noticed the module version difference in `modules.json`.',
      'Both were correct according to the configuration. The constraint permitted both versions, and there is no module lock file to make them agree.',
      'The team narrowed the constraint to `~> 5.8.0` and added a CI check that fails if `modules.json` reports a version outside a recorded list. That is more machinery than providers need, and it is the direct consequence of modules having no lock file.',
    ],
    code: [
      {
        title: 'A CI check for module drift',
        language: 'bash',
        code: `# There is no module lock file, so pin narrowly and assert.
terraform init -input=false

jq -r '.Modules[] | select(.Version != null) | "\\(.Source)@\\(.Version)"' \\
  .terraform/modules/modules.json | sort > /tmp/modules.actual

# module-versions.txt is committed and reviewed.
if ! diff -u module-versions.txt /tmp/modules.actual; then
  echo "Installed module versions differ from the committed list."
  echo "Review the diff, then update module-versions.txt deliberately."
  exit 1
fi`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Pinning each source type',
      language: 'hcl',
      explanation:
        'Note the last block: `version` with a Git source is not a stricter pin, it is an error.',
      code: `# Registry: version argument, same operators as providers.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8.0"     # 5.8.x only

  name = "acme-vpc"
  cidr = "10.0.0.0/16"
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = ">= 20.0, < 21.0"
}

# Private registry: identical mechanism.
module "internal" {
  source  = "app.terraform.io/acme/network/aws"
  version = "= 2.4.1"
}

# Git: pin with ?ref, using a TAG not a branch.
module "logging" {
  source = "git::https://github.com/acme/modules.git//logging?ref=v3.1.0"
}

# Git: a commit SHA is the strongest pin available.
module "exact" {
  source = "git::https://github.com/acme/modules.git//vault?ref=8f2a1c0e4b3d4a199c772f1e6b0a5d33ab12cd34"
}

# Local: versioned with the surrounding repository.
module "app" {
  source = "./modules/app"
}

# ERROR: version is not valid with a Git source.
# module "bad" {
#   source  = "git::https://github.com/acme/modules.git//x"
#   version = "1.0.0"
# }
# Error: Invalid combination of arguments`,
    },
    {
      title: 'A reviewable module upgrade',
      language: 'bash',
      explanation:
        'The two things a reviewer needs to see are the constraint change and the plan it produces. Neither is visible without doing both steps.',
      code: `# 1. Read the module's changelog first. Module major versions
#    frequently rename inputs and outputs.

# 2. Change the constraint in the module block.
#    version = "~> 5.8.0"  ->  "~> 5.9.0"

# 3. Re-resolve. A plain init would keep the cached version.
terraform init -upgrade

# 4. Confirm which version was installed.
jq -r '.Modules[] | select(.Source | contains("vpc")) | .Version' \\
  .terraform/modules/modules.json

# 5. See what the new version wants to change.
terraform plan -out=tfplan

# 6. Commit the constraint change with the plan output in the
#    pull request description. There is no lock file diff to
#    show, so the plan IS the evidence.`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Installs modules, keeping an already-installed version that still satisfies the constraint.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Re-resolves module and provider versions to the newest allowed.',
      namespaceNote: 'The only command that moves a satisfied module version.',
    },
    {
      command:
        'jq -r \'.Modules[] | "\\(.Key)\\t\\(.Source)\\t\\(.Version)"\' .terraform/modules/modules.json',
      what: 'Shows the resolved version of every installed module.',
    },
    {
      command: 'terraform providers',
      what: 'Shows provider constraints contributed by each module - relevant when a module upgrade changes them.',
    },
  ],
  declarative: {
    steps: [
      'Pin every remote module. Loose constraints plus no lock file means non-reproducible builds.',
      'Prefer `~> X.Y.0` for registry modules - patch releases only - and widen deliberately.',
      'Use tags or commit SHAs for Git sources, never branches.',
      'Read a module’s changelog before a major upgrade; inputs and outputs get renamed.',
      'Show the plan in the pull request, since there is no lock file diff to review.',
    ],
    code: [
      {
        title: 'Providers versus modules: what is locked',
        language: 'bash',
        explanation:
          'This asymmetry is the practical point of the lesson. Providers get a committed lock file; modules do not.',
        code: `# PROVIDERS: constraint in configuration + committed lock file
#   terraform { required_providers { aws = { version = "~> 5.60" } } }
#   .terraform.lock.hcl  ->  committed, exact version + checksums
#   Result: everyone runs the same provider build.

# MODULES: constraint in configuration only
#   module "vpc" { version = "~> 5.8" }
#   .terraform/modules/modules.json  ->  GITIGNORED cache
#   Result: two people can legitimately have different versions.

# Therefore:
#   - Pin providers with ~> and rely on the lock file.
#   - Pin modules more narrowly, because nothing else will.

grep -c "^provider" .terraform.lock.hcl        # providers are locked
grep -c "module" .terraform.lock.hcl 2>/dev/null || echo 0   # modules are not`,
      },
    ],
  },
  verification: [
    {
      command:
        'jq -r \'.Modules[] | select(.Version != null) | "\\(.Source)@\\(.Version)"\' .terraform/modules/modules.json',
      what: 'The exact module versions in use.',
    },
    {
      command: 'grep -rn "source.*git::" --include=*.tf . | grep -v "ref="',
      what: 'Finds Git module sources with no revision pin.',
      expected: 'No output in a well-pinned repository.',
    },
    {
      command: "grep -rn 'source *= *\"[a-z0-9-]*/' --include=*.tf . -A1 | grep -c version",
      what: 'A rough check that registry sources have version constraints.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init -upgrade',
      what: 'Applies a widened constraint that a plain init ignored.',
    },
    {
      command: 'terraform init',
      what: 'Reports no matching module version - the constraint cannot be satisfied by anything published.',
    },
    {
      command: 'rm -rf .terraform/modules && terraform init',
      what: 'Forces a clean module re-resolution when the cache is inconsistent.',
    },
    {
      command: 'jq . .terraform/modules/modules.json',
      what: 'The definitive answer to "which module version am I actually running?".',
    },
  ],
  commonMistakes: [
    'Assuming `.terraform.lock.hcl` locks module versions. It does not - providers only.',
    'Using `version` with a Git or local source. It is only valid for registry sources.',
    'Pinning a Git module to a branch. Branches move; tags and SHAs do not.',
    'Leaving a registry module unpinned, so `init` on a new machine installs something newer.',
    'Bumping a constraint and running a plain `init`, then concluding nothing changed.',
    'Upgrading a module major version without reading its changelog - renamed inputs cause confusing errors.',
    'Committing `.terraform/modules/modules.json` as a substitute for a lock file. It is a cache, not a manifest.',
  ],
  examTips: [
    '`version` works only with registry module sources.',
    'Git sources pin with `?ref=`, which accepts a tag, branch or commit SHA.',
    'Module versions are NOT recorded in `.terraform.lock.hcl` - that file is providers only.',
    'The resolved module version lives in `.terraform/modules/modules.json`, which is gitignored.',
    'Only `terraform init -upgrade` re-resolves an already-satisfied module version.',
    'Version constraint operators are identical to those for providers, including `~>`.',
  ],
  summary: [
    'Registry modules use `version`; Git modules use `?ref=`.',
    'There is no module lock file, so the constraint is your only reproducibility guarantee.',
    'Pin modules more narrowly than providers for exactly that reason.',
    '`init -upgrade` is the only thing that moves a satisfied version.',
    '`modules.json` tells you what you are actually running.',
  ],
  practice: [
    {
      id: 'tf-modver-p1',
      level: 'beginner',
      prompt: 'Does `.terraform.lock.hcl` record module versions?',
      answer: 'No. It records provider versions and checksums only.',
      explanation:
        'This is the most commonly missed fact in objective 5d, and it is why module constraints should be narrower than provider ones.',
    },
    {
      id: 'tf-modver-p2',
      level: 'beginner',
      prompt: 'How do you pin a Git-sourced module, given that `version` is not allowed?',
      answer: 'With `?ref=` in the source string, using a tag or commit SHA.',
      explanation:
        '`?ref=main` is technically valid but is not a pin - the branch moves under you.',
    },
    {
      id: 'tf-modver-p3',
      level: 'intermediate',
      prompt:
        'Two engineers share a configuration with `version = "~> 5.0"`. Why might their plans differ?',
      answer:
        'Because there is no module lock file. Each engineer’s `init` resolved the constraint at a different time, so one may have 5.1.0 cached and the other 5.8.2 - both satisfying the constraint.',
      explanation:
        'Diagnose it by comparing `.terraform/modules/modules.json`. Fix it by narrowing the constraint.',
    },
    {
      id: 'tf-modver-p4',
      level: 'advanced',
      prompt: 'Why is it reasonable to pin providers with `~> 5.60` but modules with `~> 5.8.0`?',
      answer:
        'Because providers have a committed lock file, so the constraint only bounds future upgrades while the lock file guarantees today’s reproducibility. Modules have no lock file, so the constraint is the only guarantee - and a loose one permits different versions on different machines.',
      explanation:
        'The general principle: the narrower your reproducibility mechanism, the wider your constraint can safely be.',
    },
  ],
  lab: {
    title: 'Version a module and upgrade it deliberately',
    scenario:
      'Use a local Git repository as a module source, pin it to a tag, publish a new version, and observe exactly what it takes to move.',
    prerequisites: ['Terraform 1.5 or newer', 'git', 'jq'],
    tasks: [
      {
        instruction:
          'Create a Git repository in /tmp containing a small module, commit it, and tag it `v1.0.0`.',
      },
      {
        instruction:
          'Source it from a root configuration with `?ref=v1.0.0`, then `init` and `apply`.',
      },
      {
        instruction:
          'Inspect `.terraform/modules/modules.json` and note what it records for this module.',
      },
      {
        instruction: 'Confirm the module version is NOT mentioned in `.terraform.lock.hcl`.',
      },
      {
        instruction:
          'Change the module in the repository, commit, and tag `v1.1.0`. Run `plan` and confirm nothing changes.',
      },
      {
        instruction:
          'Update the `ref` to `v1.1.0`, run a plain `init`, then `plan`. Note what happens.',
      },
      {
        instruction: 'Try adding `version = "1.1.0"` to the Git module block and read the error.',
      },
      {
        instruction:
          'Change the ref to a branch name instead of a tag, commit a further change to that branch, and observe that `init -upgrade` silently moves you.',
      },
      { instruction: 'Clean up, including the /tmp repository.' },
    ],
    solution: [
      {
        title: 'The module, in /tmp/tf-module-repo',
        language: 'hcl',
        code: `# /tmp/tf-module-repo/main.tf
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = ">= 2.0, < 3.0" }
  }
}

variable "name" {
  type = string
}

resource "local_file" "this" {
  filename = "\${path.root}/\${var.name}.txt"
  content  = "module version v1.0.0\\n"
}

output "version" {
  value = "v1.0.0"
}`,
      },
      {
        title: 'Root main.tf',
        language: 'hcl',
        code: `module "pinned" {
  source = "git::file:///tmp/tf-module-repo//.?ref=v1.0.0"
  name   = "pinned"
}

output "module_version" {
  value = module.pinned.version
}`,
      },
      {
        title: 'The whole experiment',
        language: 'bash',
        code: `# Build the module repository
mkdir -p /tmp/tf-module-repo && cd /tmp/tf-module-repo
# ... write main.tf as above ...
git init -q && git add -A
git -c user.email=a@b -c user.name=a commit -qm v1
git tag v1.0.0
cd -

terraform init && terraform apply -auto-approve
terraform output module_version        # "v1.0.0"

# What was recorded:
jq -r '.Modules[] | select(.Key=="pinned") | {Source, Version, Dir}' \\
  .terraform/modules/modules.json
# Note: for a Git source, Version is null - the pin is in the source string.

# The lock file knows nothing about modules:
grep -i module .terraform.lock.hcl || echo "no module entries - as expected"

# Publish v1.1.0:
cd /tmp/tf-module-repo
sed -i 's/v1.0.0/v1.1.0/g' main.tf
git commit -aqm v2 && git tag v1.1.0
cd -

terraform plan          # No changes - still pinned to v1.0.0

# Move the pin:
sed -i 's/ref=v1.0.0/ref=v1.1.0/' main.tf
terraform init          # re-resolves: the ref no longer matches the cache
terraform plan          # 1 to change
terraform apply -auto-approve
terraform output module_version        # "v1.1.0"

# version is registry-only:
#   add  version = "1.1.0"  to the module block
terraform init
# Error: Invalid combination of arguments
#   "version" can only be used with registry module sources.

# A branch ref is not a pin:
cd /tmp/tf-module-repo && git branch -f unstable && cd -
sed -i 's/ref=v1.1.0/ref=unstable/' main.tf
terraform init -upgrade
# Now any commit pushed to "unstable" arrives on the next
# init -upgrade, with no configuration change at all.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'grep -o "ref=[^\\"]*" main.tf',
        what: 'Shows the pin currently in effect.',
      },
      {
        command: 'terraform output -raw module_version',
        what: 'Confirms which module version is actually installed.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf /tmp/tf-module-repo *.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the module repository, the files and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-module-sources', 'tf-provider-versioning', 'tf-init'],
  docs: [
    {
      title: 'Module version constraints',
      url: 'https://developer.hashicorp.com/terraform/language/modules/syntax#version',
    },
    {
      title: 'Terraform Registry modules',
      url: 'https://developer.hashicorp.com/terraform/registry/modules/use',
    },
  ],
}
