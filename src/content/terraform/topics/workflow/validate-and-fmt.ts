import type { Topic } from '../../../types'

export const validateAndFmt: Topic = {
  id: 'tf-validate-and-fmt',
  title: 'terraform validate and terraform fmt',
  domainId: 'tf-workflow',
  difficulty: 'beginner',
  estimatedMinutes: 12,
  order: 3,
  tags: ['validate', 'fmt', 'style', 'ci', 'objective-3c', 'objective-3g'],
  oneLiner: 'The two free checks: canonical formatting, and correctness without a single API call.',
  explanation: [
    '`terraform fmt` rewrites configuration files into HashiCorp’s canonical style - indentation, alignment of `=` signs, blank-line handling. It changes formatting only, never meaning.',
    '`terraform validate` checks that the configuration is internally consistent: valid syntax, arguments that exist in the provider schema, correct types, and references that resolve. It makes **no API calls** and needs **no credentials**.',
    'Because validate uses provider schemas, it requires `terraform init` to have run - the schemas come from the downloaded plugins. It does not require a backend, so `init -backend=false` is enough.',
    'What validate cannot do is tell you an apply will succeed. It knows nothing about quotas, name collisions, permissions or anything else that lives on the far side of an API.',
  ],
  whyItMatters: [
    'Objectives 3c and 3g are these two commands, and their flags appear in exam questions - especially `fmt -check` and `validate -json`.',
    'Together they form the fast half of a pipeline: seconds, no credentials, and they catch the majority of authoring mistakes.',
    'Consistent formatting makes plan and pull-request diffs about substance rather than whitespace, which matters more than it sounds.',
  ],
  howItWorks: [
    '`terraform fmt` processes `.tf` and `.tfvars` files in the current directory, printing the name of each file it changed. `-recursive` descends into subdirectories, which is what you usually want in a repository.',
    '`terraform fmt -check` changes nothing and exits non-zero if any file would change. That is the CI form.',
    '`terraform fmt -diff` shows the changes it would make, which is useful when you want to see why a file is non-canonical.',
    '`terraform validate` loads the configuration, resolves modules and variables where it can, and checks everything against the provider schemas.',
    'Values that are only known after apply are treated as unknown rather than as errors, so validate never fails just because an ID does not exist yet.',
    '`terraform validate -json` produces machine-readable diagnostics with file, line and severity - the right form for editor integrations and CI annotations.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Where each check belongs in a pipeline',
      caption:
        'The first three steps need no credentials and finish in seconds. Put them first and most mistakes never reach the slow half.',
      nodes: [
        {
          label: 'terraform fmt -check -recursive',
          detail: 'No init needed, no network, instant',
          tone: 'accent',
          branch: {
            label: 'Exit 3',
            detail: 'A file is not canonical. Run terraform fmt locally.',
          },
        },
        {
          label: 'terraform init -backend=false',
          detail: 'Providers and modules only - no state access',
          arrowLabel: 'formatting clean',
        },
        {
          label: 'terraform validate',
          detail: 'Schema, types and references. Still no credentials.',
          branch: {
            label: 'Invalid configuration',
            detail: 'Caught before any credential is used or API called',
          },
        },
        {
          label: 'terraform init && terraform plan',
          detail: 'Now credentials and state access are required',
          arrowLabel: 'configuration is valid',
        },
        {
          label: 'Reviewed, then applied',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'What validate will and will not catch',
      caption:
        'The dividing line is the API boundary. Anything on the far side of it is a plan or apply problem.',
      question: 'What kind of mistake is it?',
      branches: [
        {
          condition: 'a typo in an argument name',
          result: 'validate catches it',
          detail: 'Unsupported argument - checked against the schema',
          tone: 'accent',
        },
        {
          condition: 'a string where a number belongs',
          result: 'validate catches it',
          detail: 'Type mismatch, reported with file and line',
        },
        {
          condition: 'a reference to a resource that does not exist',
          result: 'validate catches it',
          detail: 'Reference to undeclared resource',
        },
        {
          condition: 'a bucket name already taken globally',
          result: 'only apply catches it',
          detail: 'Requires an API call. validate never makes one.',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'fmt and validate flags',
      purpose:
        'The handful worth memorising, because these two commands run more often than any others.',
      fields: [
        {
          path: 'fmt -recursive',
          meaning: 'Include subdirectories. Usually what you want in a repo.',
        },
        {
          path: 'fmt -check',
          meaning: 'Report without rewriting; non-zero exit if changes are needed. The CI form.',
          required: true,
        },
        { path: 'fmt -diff', meaning: 'Show the changes that would be made.' },
        {
          path: 'validate -json',
          meaning: 'Machine-readable diagnostics with file, line and severity.',
        },
        {
          path: 'validate -no-color',
          meaning: 'Drop ANSI codes, for logs that do not render them.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Ninety seconds saved on every commit',
    story: [
      'A team’s pipeline ran `init`, then `plan`, then a policy check. It needed cloud credentials from the first step and took about four minutes.',
      'Roughly a third of failures were authoring errors: a misspelled argument, a variable referenced before it was declared, a string passed where a list was expected. Each one burned four minutes and a set of credentials to discover.',
      'Adding `fmt -check` and `validate` as a first job - with `init -backend=false`, so no state and no cloud credentials - moved those failures to about twenty seconds, and removed the need to expose credentials to a job that could fail on a typo.',
      'The plan job did not get faster. It just stopped being the place where typos were discovered.',
    ],
    code: [
      {
        title: 'The fast job',
        language: 'bash',
        code: `# No credentials configured for this job at all.
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'What fmt actually changes',
      language: 'hcl',
      explanation:
        'Alignment of `=`, two-space indentation, and consistent blank lines. Meaning is untouched, which is why fmt is safe to run automatically.',
      code: `# Before terraform fmt
resource "aws_instance" "web" {
    ami = "ami-0abc"
  instance_type="t3.micro"
      tags = {
    Name = "web"
        Environment="prod"
  }
}

# After terraform fmt
resource "aws_instance" "web" {
  ami           = "ami-0abc"
  instance_type = "t3.micro"
  tags = {
    Name        = "web"
    Environment = "prod"
  }
}`,
    },
    {
      title: 'Validate diagnostics, both forms',
      language: 'bash',
      explanation:
        'The JSON form is what editors and CI annotations consume - note the file, line and severity for each diagnostic.',
      code: `$ terraform validate
╷
│ Error: Unsupported argument
│
│   on main.tf line 12, in resource "aws_instance" "web":
│   12:   instance_typ = "t3.micro"
│
│ An argument named "instance_typ" is not expected here.
╵

$ terraform validate -json
{
  "format_version": "1.0",
  "valid": false,
  "error_count": 1,
  "warning_count": 0,
  "diagnostics": [
    {
      "severity": "error",
      "summary": "Unsupported argument",
      "detail": "An argument named \\"instance_typ\\" is not expected here.",
      "range": {
        "filename": "main.tf",
        "start": { "line": 12, "column": 3 }
      }
    }
  ]
}`,
    },
    {
      title: 'A pre-commit hook',
      language: 'bash',
      explanation:
        'Formatting is fixed automatically and staged; validation only blocks the commit. That keeps the hook fast and non-annoying.',
      code: `#!/usr/bin/env bash
# .git/hooks/pre-commit
set -euo pipefail

# Fix formatting and stage the result, rather than rejecting the commit.
if ! terraform fmt -recursive -list=true | tee /tmp/fmt.out; then
  exit 1
fi
if [ -s /tmp/fmt.out ]; then
  echo "reformatted:"; cat /tmp/fmt.out
  xargs git add < /tmp/fmt.out
fi

# Validate every directory that has a .terraform (already initialised).
for dir in $(git diff --cached --name-only | xargs -r -n1 dirname | sort -u); do
  [ -d "$dir/.terraform" ] || continue
  echo "validating $dir"
  terraform -chdir="$dir" validate
done`,
    },
  ],
  imperative: [
    {
      command: 'terraform fmt',
      what: 'Rewrites files in the current directory to canonical style; prints the names it changed.',
    },
    {
      command: 'terraform fmt -recursive',
      what: 'The same, descending into subdirectories.',
    },
    {
      command: 'terraform fmt -check -recursive',
      what: 'Reports non-canonical files and exits non-zero. Changes nothing.',
      expected: 'Exit 0 and no output when everything is formatted.',
    },
    {
      command: 'terraform fmt -diff',
      what: 'Shows exactly what would change.',
    },
    {
      command: 'terraform validate',
      what: 'Checks the configuration against provider schemas. No credentials, no API calls.',
      expected: 'Success! The configuration is valid.',
    },
    {
      command: 'terraform validate -json',
      what: 'Machine-readable diagnostics for editors and CI.',
    },
  ],
  declarative: {
    steps: [
      'Run `fmt` on save from your editor, and `fmt -check -recursive` in CI.',
      'Run `validate` after `init`, before `plan`.',
      'Use `init -backend=false` for the validate job so it needs no state access or credentials.',
      'Treat validate as a correctness check, never as a guarantee that apply will succeed.',
    ],
    code: [
      {
        title: 'A two-job pipeline',
        language: 'yaml',
        explanation:
          'The first job holds no credentials and takes seconds. Only the second gets access to state and the cloud.',
        code: `# .github/workflows/terraform.yml
name: terraform

on: [pull_request]

jobs:
  check:
    # Fast, credential-free authoring checks.
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive
      - run: terraform init -backend=false -input=false
      - run: terraform validate -no-color

  plan:
    # Needs credentials and state, so it runs only if check passed.
    needs: check
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # short-lived cloud credentials via OIDC
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init -input=false
      - run: terraform plan -input=false -out=tfplan -no-color`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform fmt -check -recursive && echo "formatting clean"',
      what: 'Confirms every file is canonical.',
      expected: 'formatting clean',
    },
    {
      command: 'terraform validate -json | jq -r .valid',
      what: 'A single boolean for scripting.',
      expected: 'true',
    },
    {
      command:
        'terraform validate -json | jq -r \'.diagnostics[] | "\\(.severity): \\(.summary)"\'',
      what: 'Lists every diagnostic compactly.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'Reports "Missing required provider" - init has not run in this directory.',
    },
    {
      command: 'terraform init -backend=false && terraform validate',
      what: 'Validates without needing state access, when the backend is unreachable.',
    },
    {
      command: 'terraform fmt -diff',
      what: 'Explains why `fmt -check` is failing on a file you thought was fine.',
    },
    {
      command: 'terraform validate -json | jq .diagnostics',
      what: 'Gets file and line numbers when the human-readable output is truncated in a log.',
    },
  ],
  commonMistakes: [
    'Believing `validate` proves an apply will work. It makes no API calls, so it cannot know about quotas, permissions or name collisions.',
    'Running `validate` before `init` and concluding the configuration is broken. Validate needs the provider schemas.',
    'Using plain `fmt` in CI, which rewrites files in a checkout nobody will commit. Use `-check`.',
    'Forgetting `-recursive`, so only the top directory is formatted and modules drift out of style.',
    'Giving the validate job cloud credentials it does not need. `-backend=false` removes the requirement entirely.',
  ],
  examTips: [
    '`terraform fmt` changes formatting only, never behaviour.',
    '`fmt -check` reports without writing and exits non-zero - the CI form. `-recursive` includes subdirectories.',
    '`terraform validate` needs `init` to have run, but needs no credentials and makes no API calls.',
    'Validate checks syntax, argument names, types and references. It cannot check anything provider-side.',
    '`validate -json` is the machine-readable form, with `valid`, `error_count` and `diagnostics`.',
  ],
  summary: [
    '`fmt` normalises style; `fmt -check` gates it in CI.',
    '`validate` checks correctness offline, using schemas from `init`.',
    'Neither command needs credentials, and neither touches infrastructure.',
    'Validate cannot predict apply-time failures - that is what plan and apply are for.',
    'Put both at the front of a pipeline and most mistakes never reach the slow jobs.',
  ],
  practice: [
    {
      id: 'tf-fmt-p1',
      level: 'beginner',
      prompt:
        'Does `terraform validate` require cloud credentials? Does it require `terraform init`?',
      answer: 'No credentials. Yes, it requires init, because it needs the provider schemas.',
      explanation:
        'This pairing is a common exam question. `init -backend=false` satisfies validate without any state access.',
    },
    {
      id: 'tf-fmt-p2',
      level: 'beginner',
      prompt: 'Which fmt flag belongs in CI, and why not the plain command?',
      answer:
        '`-check`. Plain `terraform fmt` rewrites files in an ephemeral checkout, so the fix is discarded and the build passes anyway.',
      explanation:
        '`-check` exits non-zero when a file would change, which makes bad formatting a build failure the author must fix.',
    },
    {
      id: 'tf-fmt-p3',
      level: 'intermediate',
      prompt:
        '`terraform validate` succeeds but `terraform apply` fails with "bucket already exists". Is that a bug in validate?',
      answer:
        'No. Global bucket-name uniqueness is only knowable by asking the API, and validate never does. The configuration was genuinely valid.',
      explanation:
        'The dividing line is the API boundary: validate covers everything Terraform can determine locally, and nothing beyond it.',
    },
    {
      id: 'tf-fmt-p4',
      level: 'advanced',
      prompt:
        'Your validate job runs `terraform init -backend=false`. What does that buy you, and what does it prevent you from doing?',
      answer:
        'It installs providers and modules without contacting the backend, so the job needs no state credentials and cannot be blocked by a backend outage. It prevents anything that reads state - so `plan`, `apply` and the `state` subcommands are unavailable in that job.',
      explanation:
        'This is the standard split: a credential-free authoring job, then a separate job with least-privilege access for plan and apply.',
    },
  ],
  lab: {
    title: 'Break it four ways and see what validate catches',
    scenario:
      'Introduce four different mistakes and observe precisely which ones validate reports and which survive to plan time.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a working configuration with the `local` and `random` providers and apply it once.',
      },
      {
        instruction:
          'Deliberately misformat a file - random indentation, misaligned `=`. Run `fmt -check`, then `fmt -diff`, then `fmt`.',
      },
      {
        instruction:
          'Mistake 1: misspell an argument name, e.g. `contnt` instead of `content`. Run validate.',
        hint: 'Expect "Unsupported argument".',
      },
      {
        instruction:
          'Mistake 2: pass a string where a number is expected, e.g. `length = "two"`. Run validate.',
      },
      {
        instruction:
          'Mistake 3: reference a resource that does not exist, e.g. `random_pet.ghost.id`. Run validate.',
      },
      {
        instruction:
          'Mistake 4: set `filename` to a path in a directory that does not exist. Run validate, then plan, then apply.',
        hint: 'Which of the three finally reports the problem?',
      },
      {
        instruction:
          'Run `terraform validate -json | jq .` on a broken configuration and locate the line numbers.',
      },
      { instruction: 'Fix everything, confirm a clean validate and plan, then destroy.' },
    ],
    solution: [
      {
        title: 'The working configuration',
        language: 'hcl',
        code: `terraform {
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
        title: 'The four mistakes and what reports them',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# --- Formatting
terraform fmt -check   # exit 3, lists main.tf
terraform fmt -diff    # shows the alignment changes
terraform fmt          # fixes it; prints "main.tf"

# --- Mistake 1: misspelled argument
#   contnt = "..."
terraform validate
# Error: Unsupported argument - An argument named "contnt" is not expected here.

# --- Mistake 2: wrong type
#   length = "two"
terraform validate
# Error: Invalid value for input variable / incorrect attribute value type
#   Inappropriate value for attribute "length": a number is required.

# --- Mistake 3: dangling reference
#   content = random_pet.ghost.id
terraform validate
# Error: Reference to undeclared resource

# --- Mistake 4: a path whose directory does not exist
#   filename = "\${path.module}/nope/greeting.txt"
terraform validate     # Success! validate cannot know.
terraform plan         # Also fine - the path is just a string.
terraform apply        # FAILS here: no such file or directory
# The provider only discovers this when it tries to write.

terraform validate -json | jq '.diagnostics[] | {summary, line: .range.start.line}'

# Fix everything:
terraform fmt && terraform validate && terraform plan
terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform validate -json | jq -r \'"valid=\\(.valid) errors=\\(.error_count)"\'',
        what: 'The scriptable summary of validation.',
        expected: 'valid=true errors=0',
      },
      {
        command: 'terraform fmt -check -recursive; echo "exit=$?"',
        what: 'Confirms canonical formatting.',
        expected: 'exit=0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes everything the lab created.',
      },
    ],
  },
  relatedTopicIds: ['tf-workflow-overview', 'tf-plan', 'tf-custom-conditions'],
  docs: [
    {
      title: 'terraform validate',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/validate',
    },
    {
      title: 'terraform fmt',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/fmt',
    },
  ],
}
