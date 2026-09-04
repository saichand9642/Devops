import type { Topic } from '../../../types'

export const terraformGotchas: Topic = {
  id: 'tf-terraform-gotchas',
  title: 'The traps that catch people',
  domainId: 'tf-exam-prep',
  difficulty: 'advanced',
  estimatedMinutes: 15,
  order: 2,
  tags: ['gotchas', 'traps', 'distractors', 'revision'],
  oneLiner:
    'The specific misconceptions that produce wrong answers - collected in one place for a final pass.',
  explanation: [
    'Most wrong answers on this exam come from a small set of plausible-sounding misconceptions. They are plausible precisely because they are what you would expect if you had not checked.',
    'This lesson collects them. It is deliberately a list rather than a narrative, because it is designed to be re-read in twenty minutes the day before the exam.',
    'Each entry has the same shape: the thing people believe, and what is actually true. Where the truth is surprising, there is a note on why.',
    'If any entry surprises you, that is a gap - go and read the lesson it links to rather than just noting the correction.',
  ],
  whyItMatters: [
    'Multiple-choice distractors are built from exactly these misconceptions, which is what makes them effective.',
    'Several of these are also production-incident causes, not just exam traps: `sensitive` versus state, `count` renumbering, and the module lock-file gap.',
    'A concentrated final pass over known traps is a better use of the last hour than re-reading a topic you already know.',
  ],
  howItWorks: [
    '**"`sensitive = true` protects the value."** It affects display only. State and saved plan files hold the plaintext.',
    '**"The lock file locks module versions."** It locks providers only. Module versions live in a gitignored cache, which is why module constraints should be narrower.',
    '**"A `default` wins over other values."** It is the *lowest* precedence of the six sources. The command line is the highest.',
    '**"`terraform destroy` removes everything."** Only what is in state. Hand-created resources survive it.',
    '**"`terraform state rm` deletes the resource."** It forgets it. The resource keeps running, unmanaged.',
    '**"A failed apply rolls back."** There are no transactions. State records what succeeded, and re-running continues.',
    '**"`validate` proves an apply will work."** It makes no API calls, so it cannot know about quotas, permissions or name collisions.',
    '**"Terraform configurations are portable between clouds."** The workflow and language are; the resource blocks are provider-specific.',
    '**"Modules inherit variables."** They inherit only default provider configurations. Variables and locals never cross.',
    '**"`for_each` takes a list."** A map or a set of strings. A list is rejected.',
    '**"A bumped version constraint takes effect on the next init."** Only `init -upgrade` re-resolves an already-satisfied version.',
    '**"`~> 1.2` and `~> 1.2.0` are the same."** Two components float the minor; three float only the patch.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'The five traps most likely to cost you a mark',
      caption: 'If you remember nothing else from this lesson, remember these five.',
      question: 'Which belief do you still half-hold?',
      branches: [
        {
          condition: '"sensitive protects the value"',
          result: 'It hides it from OUTPUT only',
          detail: 'State and saved plans hold plaintext',
          tone: 'danger',
        },
        {
          condition: '"the lock file covers modules"',
          result: 'Providers only',
          detail: 'Module versions are in a gitignored cache',
          tone: 'warning',
        },
        {
          condition: '"a default beats other sources"',
          result: 'It is the LOWEST precedence',
          detail: 'The command line is the highest',
          tone: 'warning',
        },
        {
          condition: '"state rm destroys the resource"',
          result: 'It forgets it',
          detail: 'The resource keeps running, unmanaged',
          tone: 'danger',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'How a distractor is built',
      caption:
        'Recognising the shape helps: the wrong answer is usually the reasonable expectation, and the right one is the checked behaviour.',
      nodes: [
        {
          label: 'A reasonable expectation',
          detail: '"Surely a default wins - I wrote it in the code"',
          tone: 'accent',
        },
        {
          label: 'Which happens to be wrong',
          detail: 'default is the lowest of six sources',
          arrowLabel: 'but',
        },
        {
          label: 'Written as a plausible option',
          detail: 'It reads correctly to anyone who has not checked',
          tone: 'warning',
        },
        {
          label: 'You check it once, deliberately',
          detail: 'Run it, or read the precedence list',
        },
        {
          label: 'And the distractor stops working',
          detail: 'This is why "verify, do not assume" is the whole technique',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'The traps, by objective',
      purpose: 'A final-pass checklist. Anything here that surprises you is a gap.',
      fields: [
        {
          path: 'Obj 1',
          meaning: 'Configurations are NOT portable between clouds. The workflow is.',
        },
        {
          path: 'Obj 2',
          meaning:
            '~> 1.2 floats the minor; ~> 1.2.0 floats only the patch. Terraform downloads providers, never itself.',
          required: true,
        },
        {
          path: 'Obj 3',
          meaning:
            'validate makes no API calls. -detailed-exitcode: 2 means changes. plan does refresh state.',
        },
        {
          path: 'Obj 4',
          meaning:
            'default is LOWEST precedence. sensitive hides display only. for_each needs a map or set.',
          required: true,
        },
        {
          path: 'Obj 5',
          meaning:
            'Variables are never inherited. Local sources need ./ . Only registry sources take version.',
          required: true,
        },
        {
          path: 'Obj 6',
          meaning:
            'State is always plaintext. state rm forgets, it does not destroy. The lock file excludes modules.',
          required: true,
        },
        {
          path: 'Obj 7',
          meaning:
            'Import creates nothing. TF_LOG is an env var. A failed apply does not roll back.',
        },
        {
          path: 'Obj 8',
          meaning:
            'cloud and backend are mutually exclusive. HCP workspaces differ from CLI workspaces.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Three of these in one incident',
    story: [
      'A team stored a generated database password with `sensitive = true` and believed it protected. That is trap one.',
      'They committed `terraform.tfstate` so everyone had "the same state". The password was in the repository in plaintext - trap one becoming an incident.',
      'While recovering, someone ran `terraform state rm` on the database expecting it to be destroyed so they could recreate it cleanly. It was not destroyed; it became an unmanaged production database that no longer appeared in any plan. Trap two.',
      'Then an apply failed halfway and they began manually deleting resources, believing the apply had rolled back and left things in an unknown state. It had not - state accurately recorded what succeeded, and re-running would have finished the job. Trap three, and the most expensive of the afternoon.',
    ],
    code: [
      {
        title: 'The three corrections',
        language: 'bash',
        code: `# 1. sensitive does NOT protect the value.
grep -o 'password[^,]*' terraform.tfstate    # it is right there
#    Fix: encrypted remote backend, never commit state, and
#    keep the secret in a secrets manager so Terraform only
#    handles its ARN.

# 2. state rm FORGETS. It does not destroy.
terraform state rm aws_db_instance.prod
#    The database is still running and still costing money.
#    To destroy it: remove the resource block and apply, or
#    terraform destroy -target=...
#    To re-adopt it: terraform import.

# 3. A failed apply does NOT roll back.
terraform state list     # exactly what succeeded is recorded
terraform plan           # exactly what remains to do
#    Fix the cause and apply again. Manual cleanup is what
#    turns a resumable failure into a real problem.`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Every trap, as a checklist',
      language: 'bash',
      explanation:
        'Read this list once the day before. Anything that makes you pause is worth ten minutes in the relevant lesson.',
      code: `# ---------- Objective 1: IaC concepts
# WRONG  A Terraform configuration can be pointed at a different
#        cloud by changing a variable.
# RIGHT  Resource types are provider-specific. The WORKFLOW and
#        the LANGUAGE are portable; the configuration is not.

# WRONG  Declarative and idempotent mean the same thing.
# RIGHT  Declarative is how you write it; idempotent is what
#        happens when you run it twice.

# ---------- Objective 2: fundamentals
# WRONG  ~> 1.2 and ~> 1.2.0 are equivalent.
# RIGHT  Three components float the PATCH (1.2.9 yes, 1.3.0 no).
#        Two components float the MINOR (1.3 yes, 2.0 no).

# WRONG  Terraform downloads the CLI version required_version asks for.
# RIGHT  It downloads PROVIDERS only. An unsatisfied
#        required_version is a hard error you must fix.

# WRONG  The terraform block can use variables.
# RIGHT  Literals only - it is read before variables exist.

# ---------- Objective 3: workflow
# WRONG  terraform validate confirms an apply will succeed.
# RIGHT  It makes NO API calls. Quotas, permissions and name
#        collisions are only discovered at apply time.

# WRONG  terraform plan never touches state.
# RIGHT  It REFRESHES state by default. Use -refresh=false to skip.

# WRONG  plan exits non-zero when there are changes.
# RIGHT  It exits 0 either way, unless you pass
#        -detailed-exitcode (0 none, 1 error, 2 changes).

# WRONG  terraform fmt can change behaviour.
# RIGHT  Formatting only.

# ---------- Objective 4: configuration
# WRONG  A variable default wins over other sources.
# RIGHT  It is the LOWEST of six. The command line is highest.

# WRONG  sensitive = true encrypts or protects the value.
# RIGHT  It redacts DISPLAY. State and saved plans hold plaintext.

# WRONG  for_each accepts a list.
# RIGHT  A map, or a set of strings. Convert with toset().

# WRONG  A set can be indexed with [0].
# RIGHT  Sets are unordered and have no indices.

# WRONG  count and for_each behave the same on removal.
# RIGHT  count renumbers and RECREATES the rest. for_each does not.

# WRONG  lifecycle can reference a variable.
# RIGHT  Literals only.

# WRONG  A check block can block an apply.
# RIGHT  Check blocks WARN. Only validation, precondition and
#        postcondition are errors.

# ---------- Objective 5: modules
# WRONG  A child module can see the caller's variables.
# RIGHT  Nothing is inherited except DEFAULT provider configs.
#        Variables and locals never cross.

# WRONG  source = "modules/network" works.
# RIGHT  A local path must start with ./ or ../ , otherwise it
#        is read as a registry address.

# WRONG  version works with a Git source.
# RIGHT  Registry sources only. Git pins with ?ref=.

# WRONG  You can reference a resource inside a module.
# RIGHT  Only declared outputs cross the boundary.

# ---------- Objective 6: state
# WRONG  .terraform.lock.hcl records module versions.
# RIGHT  PROVIDERS only. Module versions are in a gitignored cache.

# WRONG  terraform state rm destroys the resource.
# RIGHT  It forgets it. The resource keeps running, unmanaged.

# WRONG  terraform destroy removes everything in the account.
# RIGHT  Only what is in state.

# WRONG  The local backend protects against a colleague applying.
# RIGHT  Its lock is same-machine only.

# WRONG  Bumping a constraint moves the version on the next init.
# RIGHT  Only init -upgrade re-resolves an already-satisfied version.

# ---------- Objective 7: maintenance
# WRONG  terraform import creates the resource if it is missing.
# RIGHT  It records an EXISTING resource. It creates nothing.

# WRONG  TF_LOG is a command-line flag.
# RIGHT  An environment variable. TF_LOG_PATH writes to a file.

# WRONG  A failed apply rolls back.
# RIGHT  No transactions. State records what succeeded; re-run
#        to continue.

# ---------- Objective 8: HCP Terraform
# WRONG  cloud and backend can both be declared.
# RIGHT  Mutually exclusive.

# WRONG  An HCP workspace is the same as a CLI workspace.
# RIGHT  HCP workspaces have their own variables, credentials,
#        permissions and run history.

# WRONG  A remote run uses your local environment variables.
# RIGHT  It reads the WORKSPACE variables. Your shell is not
#        uploaded.

# WRONG  A speculative plan can be applied by an admin.
# RIGHT  It is plan-only. Never.`,
    },
    {
      title: 'Verify these yourself, once',
      language: 'bash',
      explanation:
        'Five minutes running these removes five distractors permanently, because you will have seen the behaviour rather than read about it.',
      code: `mkdir /tmp/verify && cd /tmp/verify

cat > main.tf <<'EOF'
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

variable "v" {
  type    = string
  default = "from-default"
}

resource "local_file" "f" {
  filename = "./out.txt"
  content  = "\${var.v}\\n"
}
EOF

terraform init

# 1. A default is the LOWEST precedence.
echo 'v = "from-tfvars"' > terraform.tfvars
terraform apply -auto-approve && cat out.txt      # from-tfvars
terraform apply -auto-approve -var 'v=from-cli'
cat out.txt                                        # from-cli

# 2. plan exits 0 even with changes pending, without the flag.
sed -i 's/from-default/changed/' main.tf
terraform plan >/dev/null; echo "plain: $?"        # 0
terraform plan -detailed-exitcode >/dev/null; echo "detailed: $?"  # 2

# 3. state rm forgets; it does not destroy.
terraform apply -auto-approve >/dev/null
terraform state rm local_file.f
ls out.txt                                         # still there
terraform state list                               # empty

# 4. for_each rejects a list.
cat >> main.tf <<'EOF'
resource "local_file" "bad" {
  for_each = ["a", "b"]
  filename = "./\${each.value}.txt"
  content  = "x\\n"
}
EOF
terraform plan
# Error: Invalid for_each argument - a set of strings or a map
sed -i '/local_file" "bad"/,/^}/d' main.tf

# 5. sensitive does not protect state.
cat >> main.tf <<'EOF'
resource "random_password" "p" { length = 12 }
output "p" { value = random_password.p.result, sensitive = true }
EOF
# (fix the syntax - outputs take separate lines - then:)
# terraform apply -auto-approve
# terraform output          -> <sensitive>
# grep -o "$(terraform output -raw p)" terraform.tfstate   -> found

cd - && rm -rf /tmp/verify`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan -detailed-exitcode; echo $?',
      what: 'Confirms the exit-code behaviour rather than trusting memory.',
    },
    {
      command: 'terraform state rm <addr> && terraform state list',
      what: 'Proves that state rm forgets rather than destroys.',
    },
    {
      command: 'grep -o "<a generated secret>" terraform.tfstate',
      what: 'Proves that `sensitive` does not protect state.',
    },
    {
      command: 'terraform console <<< \'toset(["b","a","a"])\'',
      what: 'Proves de-duplication and loss of order in a set.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Proves that a plain init does not move an already-satisfied version.',
    },
  ],
  declarative: {
    steps: [
      'Read the trap checklist once the day before the exam.',
      'For anything that surprises you, open the linked lesson rather than just noting the correction.',
      'Verify the five most confusable behaviours yourself - it takes five minutes.',
      'In the exam, treat any answer matching a listed misconception as suspect.',
      'Watch for "select all that apply", where a partial answer usually scores nothing.',
    ],
    code: [
      {
        title: 'The five that are also production risks',
        language: 'bash',
        explanation:
          'These matter beyond the exam. Each one has caused real incidents, and each is prevented by a small habit.',
        code: `# 1. sensitive does not protect state.
#    Habit: encrypted remote backend, never commit state, and
#    keep secrets in a secrets manager so Terraform handles
#    only their ARNs.

# 2. state rm forgets rather than destroys.
#    Habit: say out loud which you want before typing. To
#    destroy, remove the block and apply. To hand over, use a
#    removed block with destroy = false.

# 3. count renumbers on removal and recreates the rest.
#    Habit: for_each by default. count only for identical
#    copies and for on/off switches.

# 4. A failed apply does not roll back.
#    Habit: read the error, run terraform plan, and apply
#    again. Never start deleting things by hand.

# 5. Module versions are not in the lock file.
#    Habit: pin modules narrowly - ~> X.Y.0 for registry, a
#    TAG for Git - because nothing else will pin them for you.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
      what: 'The exit codes, confirmed rather than remembered.',
    },
    {
      command: 'terraform console <<< \'toset(["b","a","a"])\'',
      what: 'Set behaviour, confirmed.',
    },
    {
      command: 'terraform state list',
      what: 'What is really managed, after any state operation.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform console',
      what: 'Resolves any uncertainty about an expression or type in seconds.',
    },
    {
      command: 'terraform state show <addr>',
      what: 'Resolves any uncertainty about what state actually records.',
    },
    {
      command: 'terraform plan',
      what: 'The final arbiter. When in doubt about behaviour, run it and read the output.',
    },
  ],
  commonMistakes: [
    'Reading this list and nodding along without checking the ones that surprised you.',
    'Believing `sensitive = true` is a security control rather than a display setting.',
    'Expecting `terraform state rm` to destroy something.',
    'Assuming a variable `default` outranks other sources.',
    'Passing a list to `for_each`.',
    'Expecting a failed apply to have rolled back.',
    'Believing the lock file pins module versions.',
    'Answering a "select all that apply" question with only the most obvious option.',
  ],
  examTips: [
    'When an option matches a common expectation, check it against this list before choosing it.',
    'The five highest-value corrections: sensitive is display-only; the lock file is providers-only; a default is the lowest precedence; `state rm` forgets; there is no rollback.',
    '`~> 1.2` floats the minor; `~> 1.2.0` floats only the patch.',
    '`for_each` takes a map or a set - never a list. Sets cannot be indexed.',
    'Modules inherit default provider configurations and nothing else.',
    '`cloud` and `backend` are mutually exclusive, and HCP workspaces are not CLI workspaces.',
    'Check blocks warn; validation, precondition and postcondition error.',
  ],
  summary: [
    'Most wrong answers come from a small set of reasonable-sounding misconceptions.',
    'The five that matter most: sensitive, the lock file, variable precedence, `state rm`, and rollback.',
    'Anything on the list that surprises you is a gap - go and read that lesson.',
    'Five minutes of verification removes five distractors permanently.',
    'Several of these are production risks, not just exam traps.',
  ],
  practice: [
    {
      id: 'tf-gotchas-p1',
      level: 'intermediate',
      prompt:
        'Which of these are true? (a) `sensitive = true` encrypts state. (b) `state rm` destroys the resource. (c) A default is the lowest variable precedence. (d) `for_each` accepts a list.',
      answer: 'Only (c) is true - a variable default has the lowest precedence of the six sources.',
      explanation:
        '(a) redacts display only; (b) forgets rather than destroys; (d) requires a map or a set of strings.',
    },
    {
      id: 'tf-gotchas-p2',
      level: 'intermediate',
      prompt:
        'What does `.terraform.lock.hcl` lock, and what is the practical consequence of the answer?',
      answer:
        'Provider versions and their checksums - not module versions. The consequence is that module constraints must be narrower, because no lock file guarantees module reproducibility.',
      explanation:
        'Two people with the same configuration and a loose module constraint can legitimately be running different module versions.',
    },
    {
      id: 'tf-gotchas-p3',
      level: 'advanced',
      prompt:
        'An apply fails after creating 8 of 12 resources. A colleague starts deleting the 8 by hand "to get back to a clean state". Why is that wrong?',
      answer:
        'Because Terraform has no rollback and needs none: state accurately records the 8 that succeeded, so the next apply creates only the remaining 4. Deleting them by hand creates drift Terraform will then try to reconcile, turning a resumable failure into a real problem.',
      explanation:
        'The correct response is always: read the error, fix the cause, run `terraform plan` to confirm what remains, and apply again.',
    },
    {
      id: 'tf-gotchas-p4',
      level: 'advanced',
      prompt:
        'Why is "Terraform configurations are portable between cloud providers" a distractor rather than simply false?',
      answer:
        'Because it is nearly true in the way that matters least. The CLI, the workflow, the state model, the language and your skills genuinely are portable - so the statement feels right. What is not portable is the configuration itself, because resource types and their schemas are provider-specific.',
      explanation:
        'The best distractors are true about something adjacent, which is why the precise wording of an option matters.',
    },
  ],
  lab: {
    title: 'Disprove five traps in five minutes',
    scenario:
      'Run each of the five highest-value misconceptions and watch it fail. Having seen the behaviour is worth more than having read it.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Trap 1: create a `random_password` with a `sensitive` output. Apply, confirm `terraform output` redacts it, then find the value in `terraform.tfstate`.',
      },
      {
        instruction:
          'Trap 2: run `terraform state rm` on a `local_file`, then confirm the file still exists and that a plan proposes creating it.',
      },
      {
        instruction:
          'Trap 3: declare a variable with a default, override it from `terraform.tfvars` and then from `-var`, and confirm the ordering.',
      },
      {
        instruction:
          'Trap 4: pass a list to `for_each` and read the error, then fix it with `toset()`.',
      },
      {
        instruction:
          'Trap 5: cause an apply to fail halfway with three resources, then confirm `terraform state list` records what succeeded and a plan shows only what remains.',
      },
      {
        instruction:
          'Bonus: confirm that `terraform plan` exits 0 with changes pending, and 2 with `-detailed-exitcode`.',
      },
      {
        instruction: 'Bonus: confirm a set cannot be indexed, using `terraform console`.',
      },
      { instruction: 'Clean up, and note which of the five surprised you.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local  = { source = "hashicorp/local", version = "~> 2.5" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "v" {
  type    = string
  default = "from-default"
}

resource "random_password" "p" {
  length = 16
}

output "p" {
  value     = random_password.p.result
  sensitive = true
}

resource "local_file" "a" {
  filename = "\${path.module}/a.txt"
  content  = "\${var.v}\\n"
}

resource "local_file" "b" {
  filename = "\${path.module}/b.txt"
  content  = "b\\n"
}

# Trap 5: this one fails, so the apply stops partway.
resource "local_file" "c" {
  filename = "\${path.module}/missing/c.txt"
  content  = "c\\n"
}`,
      },
      {
        title: 'Disproving each one',
        language: 'bash',
        code: `terraform init
terraform apply -auto-approve
# local_file.a and .b succeed; local_file.c FAILS.

# ---- Trap 5: no rollback
terraform state list
# local_file.a
# local_file.b
# random_password.p
# The two that succeeded are recorded. Nothing rolled back.
terraform plan
# Plan: 1 to add.  Only local_file.c remains.

# Fix it and finish:
sed -i 's|/missing/c.txt|/c.txt|' main.tf
terraform apply -auto-approve

# ---- Trap 1: sensitive does not protect state
terraform output
# p = <sensitive>
SECRET="$(terraform output -raw p)"
grep -c "$SECRET" terraform.tfstate     # 1 - plaintext, right there

# ---- Trap 2: state rm forgets, it does not destroy
terraform state rm local_file.b
ls b.txt                                 # still there
terraform plan
# Plan: 1 to add.  Terraform no longer knows about it.
terraform apply -auto-approve            # re-adopts it

# ---- Trap 3: a default is the LOWEST precedence
cat a.txt                                # from-default
echo 'v = "from-tfvars"' > terraform.tfvars
terraform apply -auto-approve && cat a.txt          # from-tfvars
terraform apply -auto-approve -var 'v=from-cli'
cat a.txt                                            # from-cli

# ---- Trap 4: for_each rejects a list
cat >> main.tf <<'EOF'
resource "local_file" "bad" {
  for_each = ["x", "y"]
  filename = "\${path.module}/\${each.value}.txt"
  content  = "z\\n"
}
EOF
terraform plan
# Error: Invalid for_each argument
#   The given "for_each" argument value is unsuitable: the
#   "for_each" argument must be a map, or set of strings.
sed -i 's/for_each = \\["x", "y"\\]/for_each = toset(["x", "y"])/' main.tf
terraform plan                           # now valid

# ---- Bonus: exit codes
terraform apply -auto-approve >/dev/null
sed -i 's/content  = "z/content  = "changed/' main.tf
terraform plan >/dev/null; echo "plain=$?"                    # 0
terraform plan -detailed-exitcode >/dev/null; echo "detailed=$?"  # 2

# ---- Bonus: sets are not indexable
echo 'toset(["a","b"])[0]' | terraform console
# Error: Invalid index - this value does not have any indices.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'grep -c "$(terraform output -raw p)" terraform.tfstate',
        what: 'A non-zero count is the proof that `sensitive` does not protect state.',
        expected: '1',
      },
      {
        command: 'terraform plan -detailed-exitcode >/dev/null; echo "exit=$?"',
        what: 'Confirms the exit codes for yourself.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt terraform.tfvars && rm -rf missing .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes every resource and artefact the lab created.',
      },
    ],
  },
  relatedTopicIds: [
    'tf-exam-format-and-strategy',
    'tf-sensitive-data-and-vault',
    'tf-count-and-for-each',
  ],
  docs: [
    {
      title: 'Exam content list (004)',
      url: 'https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004',
    },
  ],
}
