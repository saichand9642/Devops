import type { Topic } from '../../../types'

export const providerVersioning: Topic = {
  id: 'tf-provider-versioning',
  title: 'Provider version constraints and the lock file',
  domainId: 'tf-fundamentals',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  order: 3,
  tags: ['versioning', 'constraints', 'lock file', 'init -upgrade', 'objective-2a'],
  oneLiner:
    'Every constraint operator, what `.terraform.lock.hcl` is for, and why `init -upgrade` is the only thing that moves a pinned version.',
  explanation: [
    'A version constraint says which provider releases are acceptable. The **lock file** records which one was actually chosen. Both matter, and they do different jobs.',
    'Without a constraint, `terraform init` takes the newest published release. That is fine on day one and a liability six months later, when a provider major release changes behaviour under a configuration nobody edited.',
    'Once `.terraform.lock.hcl` exists, `terraform init` honours it: the locked version is reused even if newer releases now satisfy your constraint. The only command that re-resolves is `terraform init -upgrade`.',
    'That combination gives you both reproducibility and a deliberate upgrade path: the lock file freezes today, the constraint bounds tomorrow, and `-upgrade` is the moment you choose to move.',
  ],
  whyItMatters: [
    'Objective 2a covers versioning providers, and the constraint operators are extremely likely to appear as a multiple-choice question.',
    'The lock file is the single most misunderstood file in a Terraform repository. People gitignore it and then wonder why two machines behave differently.',
    'Knowing that only `-upgrade` re-resolves saves real confusion when a bumped constraint appears to do nothing.',
  ],
  howItWorks: [
    '`=` or a bare version means exactly that release. `= 5.62.0` and `5.62.0` are the same thing.',
    '`!=` excludes one release. Useful to skip a known-bad version without widening or narrowing the rest.',
    '`>`, `>=`, `<`, `<=` are ordinary comparisons and can be combined with commas, which mean AND: `>= 5.0, < 6.0`.',
    '`~>` is the **pessimistic constraint operator**. It allows the rightmost specified component to increase and nothing to its left. `~> 5.62.0` allows 5.62.9 but not 5.63.0. `~> 5.62` allows 5.99 but not 6.0.',
    'Terraform picks the newest release satisfying every constraint from the configuration *and* from every module - constraints intersect, they do not override.',
    'The lock file stores the chosen version plus checksums per platform. If a checksum does not match on the next init, Terraform refuses to proceed - that is a supply-chain protection, not a nuisance.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which constraint operator?',
      caption:
        'The pessimistic operator is the default choice. Which component floats depends on how many you write.',
      question: 'How much should be allowed to change on its own?',
      branches: [
        {
          condition: 'patch releases only',
          result: '~> 5.62.0',
          detail: 'Allows 5.62.1 to 5.62.x. Refuses 5.63.0.',
          tone: 'accent',
        },
        {
          condition: 'minor releases too',
          result: '~> 5.62',
          detail: 'Allows 5.63 and 5.99. Refuses 6.0.',
        },
        {
          condition: 'a wide band, bounded by the next major',
          result: '>= 5.0, < 6.0',
          detail: 'Commas mean AND. Common in reusable modules.',
        },
        {
          condition: 'exactly one release, forever',
          result: '= 5.62.0',
          detail: 'Maximum reproducibility, manual upgrades',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'What init does when a lock file already exists',
      caption:
        'This is the behaviour people trip over: bumping the constraint alone changes nothing until you pass -upgrade.',
      nodes: [
        {
          label: 'terraform init',
          detail: 'A lock file is present in the directory',
        },
        {
          label: 'Is the locked version still allowed?',
          detail: 'Checked against the current constraints',
          tone: 'accent',
          branch: {
            label: 'No longer satisfies them',
            detail: 'Error telling you to run init -upgrade',
          },
        },
        {
          label: 'The locked version is reused',
          detail: 'Newer releases are ignored, even if allowed',
          arrowLabel: 'yes',
        },
        {
          label: 'Checksums are verified',
          detail: 'A mismatch is a hard failure, by design',
          branch: {
            label: 'Checksum mismatch',
            detail: 'Refuses to run. Investigate before you delete the lock file.',
          },
        },
        { label: 'Ready to plan', tone: 'success' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: '.terraform.lock.hcl',
      purpose:
        'Records the exact provider versions and checksums used, so every machine and every pipeline resolves identically. Commit it.',
      fields: [
        { path: 'version', meaning: 'The exact release that was selected.', required: true },
        {
          path: 'constraints',
          meaning: 'The constraint that produced it, recorded for human readers.',
        },
        {
          path: 'hashes',
          meaning: 'Per-platform checksums. A mismatch stops Terraform dead.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The unpinned provider that changed a default',
    story: [
      'A configuration had `source = "hashicorp/aws"` with no version constraint. It had worked untouched for eight months.',
      'A routine `terraform init` in CI picked up a new provider major release. A default had changed - server-side encryption on new buckets - and the plan proposed modifying fourteen buckets nobody had edited.',
      'Nothing broke, because someone read the plan. But the team spent a morning establishing that Terraform was right and their expectations were stale.',
      'The fix was two things, not one: add `version = "~> 5.60"` to bound future surprises, and commit the lock file so CI and laptops agree on which release is in play today.',
    ],
    code: [
      {
        title: 'Before and after',
        language: 'hcl',
        code: `# Before: whatever is newest at init time.
terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

# After: bounded by the constraint, frozen by the lock file.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Every operator, with what it accepts',
      language: 'hcl',
      explanation:
        'Read the comments as the answer key. The `~>` cases are the ones exam questions are built from.',
      code: `terraform {
  required_providers {
    # Exactly 5.62.0. Nothing else.
    a = { source = "hashicorp/aws", version = "= 5.62.0" }

    # Anything except 5.61.0 - skip a known-bad release.
    b = { source = "hashicorp/aws", version = "!= 5.61.0" }

    # 5.0.0 or newer, but strictly below 6.0.0. Comma means AND.
    c = { source = "hashicorp/aws", version = ">= 5.0, < 6.0" }

    # Patch only: 5.62.1 yes, 5.63.0 no.
    d = { source = "hashicorp/aws", version = "~> 5.62.0" }

    # Minor too: 5.63 yes, 5.99 yes, 6.0 no.
    e = { source = "hashicorp/aws", version = "~> 5.62" }
  }
}`,
    },
    {
      title: 'Managing versions from the CLI',
      language: 'bash',
      explanation:
        'The distinction in the first two commands is the whole lesson: a plain init respects the lock, `-upgrade` re-resolves it.',
      code: `# Respects the lock file. Newer allowed releases are ignored.
terraform init

# Re-resolves every constraint and rewrites the lock file.
terraform init -upgrade

# Record checksums for every platform your team uses,
# so nobody has to rewrite the lock file just by running init.
terraform providers lock \\
  -platform=linux_amd64 \\
  -platform=darwin_arm64 \\
  -platform=windows_amd64

# See what is actually installed right now:
terraform version

# See what the configuration and its modules ask for:
terraform providers`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Installs providers, honouring an existing lock file.',
      expected: '- Using previously-installed hashicorp/aws v5.62.0',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Re-resolves constraints to the newest allowed release and rewrites the lock file.',
      expected: '- Installing hashicorp/aws v5.70.0...',
    },
    {
      command: 'terraform providers lock -platform=darwin_arm64',
      what: 'Adds checksums for another platform without changing the selected version.',
    },
    {
      command: 'terraform init -plugin-dir=/opt/tf-plugins',
      what: 'Installs only from a local directory - the airgapped pattern.',
      namespaceNote: 'Disables the registry entirely for this init.',
    },
    {
      command: 'terraform providers mirror ./mirror',
      what: 'Downloads every required provider into a local mirror you can copy to an isolated network.',
    },
  ],
  declarative: {
    steps: [
      'Give every provider a `version` constraint - `~>` unless you have a reason.',
      'Commit `.terraform.lock.hcl` alongside the configuration.',
      'Upgrade deliberately: widen the constraint, run `init -upgrade`, then read the plan before applying.',
      'For mixed-OS teams, run `terraform providers lock` with every platform once, and commit that.',
    ],
    code: [
      {
        title: 'A reviewable upgrade',
        language: 'bash',
        explanation:
          'The point is that the diff to the lock file, and the plan, are both visible in the pull request.',
        code: `# 1. Widen the constraint in required_providers, e.g. ~> 5.60 -> ~> 5.70

# 2. Re-resolve. This is the only step that moves the version.
terraform init -upgrade

# 3. The lock file diff shows exactly what moved:
git diff .terraform.lock.hcl

# 4. Find out whether the new provider wants to change anything:
terraform plan

# 5. Commit configuration and lock file together, and let
#    a reviewer see both the version bump and its consequences.
git add main.tf .terraform.lock.hcl`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform version | grep provider',
      what: 'The versions actually in use.',
    },
    {
      command: 'grep -E "^\\s+version" .terraform.lock.hcl',
      what: 'The versions the lock file pins.',
    },
    {
      command: 'terraform init && git diff --exit-code .terraform.lock.hcl',
      what: 'A CI check that init does not modify the lock file - proof it is complete and committed.',
      expected: 'No output and exit code 0.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Reports "locked provider does not match configured version constraints" - the constraint moved past the lock.',
      expected: 'The message tells you to run init -upgrade.',
    },
    {
      command: 'terraform providers lock -platform=<your platform>',
      what: 'Fixes "provider ... does not have a package available for your platform" after a colleague locked on another OS.',
    },
    {
      command: 'terraform providers',
      what: 'Diagnoses "no available releases match": shows the intersecting constraints, including from modules.',
    },
  ],
  commonMistakes: [
    'Gitignoring `.terraform.lock.hcl`. It exists to be committed; ignoring it discards the reproducibility it provides.',
    'Bumping the constraint and expecting a plain `init` to move. Only `init -upgrade` re-resolves.',
    'Deleting the lock file to "fix" a checksum mismatch. Investigate first - that check exists to catch tampering.',
    'Confusing `~> 5.62.0` with `~> 5.62`. Three components float the patch; two float the minor.',
    'Pinning `=` in a reusable module. Module constraints intersect with the caller’s, so an exact pin makes the module nearly unusable.',
  ],
  examTips: [
    '`~>` is the pessimistic constraint operator. Know both forms cold: `~> 1.2.0` is patch-only, `~> 1.2` is minor-and-patch.',
    'Commas mean AND. There is no OR in Terraform version constraints.',
    '`.terraform.lock.hcl` should be committed; `.terraform/` should not.',
    'Only `terraform init -upgrade` re-resolves a locked version.',
    'Constraints from the root configuration and from modules intersect. If they cannot all be satisfied, init fails.',
  ],
  summary: [
    'Constraints bound what is acceptable; the lock file records what was chosen.',
    '`~>` floats the rightmost component you wrote and nothing further left.',
    'A plain `init` respects the lock; `init -upgrade` re-resolves it.',
    'Commit the lock file, and add every platform your team uses.',
    'Module and root constraints intersect - keep module constraints permissive.',
  ],
  practice: [
    {
      id: 'tf-versioning-p1',
      level: 'beginner',
      prompt: 'Which of 3.6.0, 3.6.9, 3.7.0 and 4.0.0 satisfy `~> 3.6.0`?',
      answer: '3.6.0 and 3.6.9 only.',
      explanation:
        'With three components written, `~>` allows the patch to increase. 3.7.0 changes the minor and is refused.',
    },
    {
      id: 'tf-versioning-p2',
      level: 'intermediate',
      prompt:
        'The lock file pins aws 5.62.0. You widen the constraint from `~> 5.62.0` to `~> 5.62` and run a plain `terraform init`. Which version ends up installed, and why?',
      answer:
        'Still 5.62.0. The locked version continues to satisfy the widened constraint, so init reuses it and never looks for anything newer. Only `terraform init -upgrade` re-resolves.',
      explanation:
        'The two behaviours to keep straight: if the locked version still satisfies the constraint, init silently reuses it; if it no longer does, init fails and tells you to run `-upgrade`.',
    },
    {
      id: 'tf-versioning-p3',
      level: 'intermediate',
      prompt:
        'A module requires `>= 4.0, < 5.0` and your root configuration requires `~> 5.60`. What happens at init?',
      answer:
        'Initialisation fails: the constraints intersect to an empty set, so no release satisfies both.',
      explanation:
        'Constraints are intersected, never overridden. The fix is to upgrade the module to one that supports provider 5.x.',
    },
    {
      id: 'tf-versioning-p4',
      level: 'advanced',
      prompt:
        'Why does Terraform refuse to run on a checksum mismatch instead of just re-downloading?',
      answer:
        'Because a mismatch means the package you are about to execute is not the one that was recorded. Silently re-downloading would defeat the purpose - it is a supply-chain integrity check, and it should stop you.',
      explanation:
        'Legitimate mismatches do occur, most often when a colleague locked only their own platform. The correct fix is `terraform providers lock -platform=...`, not deleting the lock file.',
    },
  ],
  lab: {
    title: 'Make the lock file misbehave on purpose',
    scenario:
      'Watch a plain init reuse a locked version, watch it fail when the constraint moves past the lock, and fix it properly with `-upgrade`.',
    prerequisites: ['Terraform 1.5 or newer', 'Network access', 'git, to see the lock file diff'],
    tasks: [
      {
        instruction:
          'Create a configuration requiring `hashicorp/random` with a deliberately old constraint such as `= 3.5.1`.',
      },
      { instruction: 'Run `terraform init` and confirm the version installed.' },
      { instruction: 'Initialise a git repo and commit `main.tf` and `.terraform.lock.hcl`.' },
      {
        instruction:
          'Change the constraint to `~> 3.6` and run a plain `terraform init`. Read the error.',
        hint: 'The locked 3.5.1 no longer satisfies the constraint.',
      },
      { instruction: 'Run `terraform init -upgrade` and confirm a newer version was selected.' },
      { instruction: 'Run `git diff .terraform.lock.hcl` and identify every line that changed.' },
      {
        instruction:
          'Widen the constraint further to `>= 3.0` and run a plain `terraform init`. Confirm it does NOT move, and explain why.',
      },
      {
        instruction:
          'Add checksums for a second platform with `terraform providers lock`, and note what changed.',
      },
    ],
    solution: [
      {
        title: 'main.tf, step 1',
        language: 'hcl',
        code: `terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "= 3.5.1"
    }
  }
}

resource "random_id" "example" {
  byte_length = 4
}`,
      },
      {
        title: 'The whole experiment',
        language: 'bash',
        code: `terraform init
terraform version | grep random     # v3.5.1

git init -q && git add main.tf .terraform.lock.hcl && git commit -qm pin

# Move the constraint past the lock:
sed -i 's/"= 3.5.1"/"~> 3.6"/' main.tf
terraform init
# Error: Failed to query available provider packages
#   locked provider registry.terraform.io/hashicorp/random 3.5.1
#   does not match configured version constraint ~> 3.6;
#   must run terraform init -upgrade

terraform init -upgrade
terraform version | grep random     # v3.6.x
git diff .terraform.lock.hcl        # version, constraints and hashes all changed

# Widen further - and observe that nothing moves:
sed -i 's/"~> 3.6"/">= 3.0"/' main.tf
terraform init
# "Using previously-installed hashicorp/random v3.6.x"
# The lock wins, because 3.6.x still satisfies >= 3.0.

terraform providers lock -platform=darwin_arm64
git diff .terraform.lock.hcl        # extra hashes, same version`,
      },
    ],
    verification: [
      {
        command: 'grep -c "^    \\"h1:" .terraform.lock.hcl',
        what: 'Counts the platform hashes recorded - it grows after `providers lock`.',
      },
      {
        command:
          'terraform init && git diff --exit-code .terraform.lock.hcl && echo "lock is complete"',
        what: 'The CI check: init must not need to modify a committed lock file.',
        expected: 'lock is complete',
      },
    ],
    cleanup: [
      {
        command: 'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl .git',
        what: 'Removes the resource, the cache and the throwaway repository.',
      },
    ],
  },
  relatedTopicIds: ['tf-how-providers-work', 'tf-init', 'tf-module-versioning'],
  docs: [
    {
      title: 'Version constraints',
      url: 'https://developer.hashicorp.com/terraform/language/expressions/version-constraints',
    },
    {
      title: 'Dependency lock file',
      url: 'https://developer.hashicorp.com/terraform/language/files/dependency-lock',
    },
  ],
}
