import type { Topic } from '../../../types'

export const inputVariables: Topic = {
  id: 'tf-input-variables',
  title: 'Input variables and precedence',
  domainId: 'tf-configuration',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 3,
  tags: ['variables', 'tfvars', 'precedence', 'sensitive', 'validation', 'objective-4c'],
  oneLiner:
    'Declaring variables, the six ways to supply values, and the precedence order when several apply.',
  explanation: [
    'A `variable` block **declares** an input: its name, type, an optional default, and optional description and validation. Declaring is not assigning.',
    'Values arrive from six places, and when more than one supplies the same variable, the **last one wins** in a fixed precedence order. Knowing that order is exam material and saves real debugging time.',
    'A variable with no default and no supplied value causes Terraform to prompt for it interactively - or to fail, if `-input=false` is set. That is why CI always passes `-input=false`: a missing value becomes an error rather than a hang.',
    'Marking a variable `sensitive = true` keeps its value out of CLI output and out of plan display. It does **not** keep it out of the state file.',
  ],
  whyItMatters: [
    'Objective 4c covers variables and outputs. The precedence order in particular appears as a multiple-choice question.',
    'Variables are what make one configuration serve several environments, so the precedence rules decide which environment you actually deployed.',
    'The sensitive-but-still-in-state fact is a genuine security point, not a technicality.',
  ],
  howItWorks: [
    'Precedence, lowest to highest: **1** the `default` in the block, **2** environment variables `TF_VAR_name`, **3** `terraform.tfvars`, **4** `terraform.tfvars.json`, **5** `*.auto.tfvars` and `*.auto.tfvars.json` in lexical order, **6** `-var` and `-var-file` on the command line, in the order given.',
    'The highest wins. A `-var` on the command line therefore overrides everything, and a `default` is only used when nothing else supplies a value.',
    '`terraform.tfvars` and `*.auto.tfvars` are loaded automatically. Any other filename must be passed with `-var-file`.',
    'A `type` constraint is optional but strongly recommended: it turns a wrong value into a clear error at plan time rather than a confusing provider error later.',
    '`nullable = false` forbids an explicit `null`. `sensitive = true` redacts output. Both are per-variable settings.',
    'Variables are evaluated before resources but after nothing else - they cannot reference resources, data sources or other variables.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Variable value precedence, lowest to highest',
      caption:
        'Read it bottom-up when debugging: whatever appears latest in this list is the value you actually got.',
      nodes: [
        {
          label: '1. default in the variable block',
          detail: 'Used only when nothing else supplies a value',
          tone: 'muted',
        },
        {
          label: '2. TF_VAR_name environment variable',
          detail: 'Handy in CI, invisible in the repository',
          arrowLabel: 'overrides default',
        },
        {
          label: '3. terraform.tfvars',
          detail: 'Loaded automatically if present',
        },
        {
          label: '4. terraform.tfvars.json',
          detail: 'Same, JSON form',
        },
        {
          label: '5. *.auto.tfvars, in lexical order',
          detail: 'a.auto.tfvars is loaded before b.auto.tfvars',
        },
        {
          label: '6. -var and -var-file, in order given',
          detail: 'Highest precedence. The command line always wins.',
          tone: 'accent',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Where should this value live?',
      caption: 'The deciding question is who needs to change it and whether it is a secret.',
      question: 'What kind of value is it?',
      branches: [
        {
          condition: 'the same in every environment',
          result: 'A default, or a local',
          detail: 'If nobody overrides it, it may not need to be a variable at all',
        },
        {
          condition: 'differs per environment, not secret',
          result: 'A per-environment tfvars file',
          detail: 'Committed, reviewed, obvious in a diff',
          tone: 'accent',
        },
        {
          condition: 'a secret',
          result: 'TF_VAR_ from a secret store',
          detail: 'Never in a committed file. Mark the variable sensitive.',
          tone: 'warning',
        },
        {
          condition: 'a one-off override while debugging',
          result: '-var on the command line',
          detail: 'Highest precedence, leaves no trace in the repo',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'variable block',
      purpose: 'Declares an input. Every argument is optional except the name.',
      fields: [
        {
          path: 'type',
          meaning:
            'string, number, bool, list(...), map(...), set(...), object({...}), tuple([...]), any.',
        },
        { path: 'default', meaning: 'Makes the variable optional. Lowest precedence.' },
        {
          path: 'description',
          meaning: 'Shown in prompts and by documentation tooling. Always write one.',
        },
        {
          path: 'sensitive',
          meaning: 'Redacts the value in CLI output. Does NOT encrypt state.',
          required: true,
        },
        { path: 'nullable', meaning: 'Set false to forbid an explicit null.' },
        {
          path: 'validation',
          meaning: 'One or more custom rules with a condition and an error_message.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Deployed to the wrong environment by an auto.tfvars file',
    story: [
      'A repository had `production.auto.tfvars` left over from an experiment. Because of the `.auto.` in the name, Terraform loaded it automatically in every run, in every directory it sat in.',
      'An engineer ran `terraform apply -var-file=staging.tfvars` and expected staging. The command line does outrank auto files - so the variables they passed were correct.',
      'But `production.auto.tfvars` also set two variables that `staging.tfvars` did not mention. Those two kept their production values, and the apply created staging resources pointing at a production database.',
      'The lesson is not just about precedence but about completeness: overriding some variables from a higher-precedence source leaves the rest at whatever the lower sources said. Deleting the stray auto file was the actual fix.',
    ],
    code: [
      {
        title: 'How to see what you are really getting',
        language: 'bash',
        code: `# Which files will be loaded automatically?
ls terraform.tfvars terraform.tfvars.json *.auto.tfvars* 2>/dev/null

# What did the plan actually resolve?
terraform plan -out=tfplan
terraform show -json tfplan | jq .variables`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Variable declarations, from simple to strict',
      language: 'hcl',
      explanation:
        'Type constraints and validation move errors from apply time to plan time, with a message you wrote rather than one from the provider.',
      code: `variable "region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-west-1"
}

variable "instance_count" {
  description = "How many application instances to run."
  type        = number
  default     = 2

  validation {
    condition     = var.instance_count > 0 && var.instance_count <= 10
    error_message = "instance_count must be between 1 and 10."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging or production."
  }
}

variable "db_password" {
  description = "Database master password. Supply via TF_VAR_db_password."
  type        = string
  sensitive   = true
  # Deliberately no default: a missing secret should be an error.
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}

variable "subnet_config" {
  description = "Per-subnet CIDR and availability zone."
  type = map(object({
    cidr = string
    az   = string
  }))
  default = {}
}`,
    },
    {
      title: 'Supplying values, every way',
      language: 'bash',
      explanation:
        'The last two lines demonstrate precedence: the command line wins over everything, and later `-var` flags win over earlier ones.',
      code: `# 2. Environment variable - the right home for secrets.
export TF_VAR_db_password="$(vault kv get -field=password secret/db)"

# 3. terraform.tfvars - loaded automatically.
cat > terraform.tfvars <<'EOF'
region      = "eu-west-1"
environment = "staging"
EOF

# 5. *.auto.tfvars - also loaded automatically. Beware stray files.
cat > common.auto.tfvars <<'EOF'
tags = { ManagedBy = "terraform" }
EOF

# 6. Command line - highest precedence.
terraform apply -var-file=production.tfvars -var="environment=production"

# Later -var wins over earlier: this applies with environment=dev.
terraform apply -var="environment=staging" -var="environment=dev"`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan -var="environment=production"',
      what: 'Supplies one value at the highest precedence.',
    },
    {
      command: 'terraform plan -var-file=production.tfvars',
      what: 'Loads a file that is not picked up automatically.',
    },
    {
      command: 'TF_VAR_db_password=secret terraform plan',
      what: 'Supplies a value via the environment - the pattern for secrets.',
    },
    {
      command: 'terraform plan -input=false',
      what: 'Fails on a missing required variable instead of prompting. Always use in CI.',
    },
    {
      command: 'terraform show -json tfplan | jq .variables',
      what: 'Shows the values a plan actually resolved. The definitive answer to "which value did I get?".',
    },
    {
      command: 'terraform console',
      what: 'Evaluate `var.name` interactively to check a type or a default.',
    },
  ],
  declarative: {
    steps: [
      'Give every variable a `description` and a `type`.',
      'Omit `default` for anything that must be supplied deliberately - especially secrets.',
      'Add `validation` for values with a known valid set; the error message is yours to write.',
      'Keep secrets in `TF_VAR_` from a secret store, never in a committed file.',
      'Use one explicit `-var-file` per environment and avoid `*.auto.tfvars` in multi-environment repositories.',
    ],
    code: [
      {
        title: 'A per-environment layout that avoids precedence surprises',
        language: 'bash',
        explanation:
          'No `.auto.` files and no `terraform.tfvars`, so nothing is loaded implicitly. Every run states which environment it means.',
        code: `environments/
├── dev.tfvars
├── staging.tfvars
└── production.tfvars

# Every command names the environment explicitly:
terraform plan  -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars

# Secrets never appear in those files:
export TF_VAR_db_password="$(op read 'op://infra/staging-db/password')"

# .gitignore
*.auto.tfvars        # avoid implicit loading entirely
terraform.tfvars     # same
secrets.tfvars`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform show -json tfplan | jq .variables',
      what: 'The resolved value of every variable in a saved plan.',
    },
    {
      command: "terraform console <<< 'var.environment'",
      what: 'Checks one variable without running a plan.',
    },
    {
      command: 'terraform plan -input=false',
      what: 'Proves every required variable is being supplied.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan -input=false',
      what: 'Reports "No value for required variable" - nothing supplied it and there is no default.',
    },
    {
      command: 'ls *.auto.tfvars terraform.tfvars 2>/dev/null',
      what: 'Finds files being loaded implicitly when a value is not what you expected.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Invalid value for variable" - your own `validation` message, working as designed.',
    },
    {
      command: 'terraform plan',
      what: 'Reports an incorrect attribute type - the `type` constraint caught a wrong shape at plan time.',
    },
  ],
  commonMistakes: [
    'Assuming a `default` wins. It has the lowest precedence of all six sources.',
    'Leaving a stray `*.auto.tfvars` in the repository. It is loaded silently in every run.',
    'Believing `sensitive = true` protects the value in state. It only redacts CLI output.',
    'Committing secrets in `terraform.tfvars`. Use `TF_VAR_` from a secret store.',
    'Omitting `-input=false` in CI, so a missing variable hangs the pipeline on an invisible prompt.',
    'Overriding only some variables from a higher-precedence source and assuming the rest changed too.',
  ],
  examTips: [
    'Precedence, lowest to highest: default, TF_VAR_, terraform.tfvars, terraform.tfvars.json, *.auto.tfvars (lexical), -var / -var-file.',
    'Command-line flags always win, and later ones beat earlier ones.',
    '`terraform.tfvars` and `*.auto.tfvars` load automatically; any other name needs `-var-file`.',
    '`sensitive = true` redacts output only - state still holds the plaintext.',
    'A variable with no default and no value prompts interactively, or fails with `-input=false`.',
    'Variables cannot reference resources, data sources or other variables.',
  ],
  summary: [
    'Declare with `variable`, supply from six sources, and the highest precedence wins.',
    'The command line beats everything; a `default` loses to everything.',
    '`*.auto.tfvars` is loaded silently - a common source of surprises.',
    '`sensitive` hides values from output, not from state.',
    'Type constraints and `validation` move errors to plan time with your own message.',
  ],
  practice: [
    {
      id: 'tf-vars-p1',
      level: 'beginner',
      prompt: 'List the six variable value sources from lowest to highest precedence.',
      answer:
        'default in the block; TF_VAR_name; terraform.tfvars; terraform.tfvars.json; *.auto.tfvars (lexical order); -var and -var-file on the command line.',
      explanation:
        'Memorise this list. It is one of the most reliably examined facts in objective 4.',
    },
    {
      id: 'tf-vars-p2',
      level: 'beginner',
      prompt:
        'A variable has `default = "eu-west-1"`, `TF_VAR_region=us-east-1` is exported, and you run `terraform apply -var="region=ap-south-1"`. Which region is used?',
      answer: 'ap-south-1. The command line has the highest precedence.',
      explanation:
        'The default is the weakest source, and `TF_VAR_` sits above it but well below the command line.',
    },
    {
      id: 'tf-vars-p3',
      level: 'intermediate',
      prompt: 'Why is `sensitive = true` not a substitute for a secrets manager?',
      answer:
        'Because it only redacts the value in CLI and plan output. The plaintext is still written to the state file and to any saved plan file.',
      explanation:
        'The mitigations are a remote backend with encryption at rest and tight access control, plus generating secrets outside Terraform where possible.',
    },
    {
      id: 'tf-vars-p4',
      level: 'advanced',
      prompt:
        'You run `terraform apply -var-file=staging.tfvars` but a resource is created with production settings. What are the two most likely causes?',
      answer:
        'Either a `*.auto.tfvars` or `terraform.tfvars` file is supplying values that `staging.tfvars` does not mention, or a `TF_VAR_` environment variable is set for a variable the file omits. In both cases the un-overridden variables kept their lower-precedence values.',
      explanation:
        'Diagnose with `terraform show -json tfplan | jq .variables`, which reports the resolved value of every variable rather than what you intended.',
    },
  ],
  lab: {
    title: 'Prove the precedence order yourself',
    scenario:
      'Set the same variable from five different sources at once and watch which one Terraform actually uses.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Declare a variable `tier` with `default = "from-default"` and write it into a `local_file` so you can see the resolved value.',
      },
      { instruction: 'Apply with nothing else set, and confirm the file says `from-default`.' },
      { instruction: 'Export `TF_VAR_tier=from-env`, apply again, and confirm it changed.' },
      {
        instruction:
          'Create `terraform.tfvars` setting `tier = "from-tfvars"`, apply, and confirm it wins over the environment.',
      },
      {
        instruction:
          'Create `zz.auto.tfvars` setting `tier = "from-auto"`, apply, and confirm it wins over terraform.tfvars.',
      },
      {
        instruction:
          'Apply with `-var="tier=from-cli"` and confirm the command line beats all four.',
      },
      {
        instruction:
          'Add a `validation` block rejecting any value not starting with `from-`, then apply with `-var="tier=nope"` and read your own error message.',
      },
      {
        instruction:
          'Mark the variable sensitive, plan, and then find the value in the state file anyway.',
      },
      { instruction: 'Clean up, including the tfvars files.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

variable "tier" {
  description = "Demonstrates variable precedence."
  type        = string
  default     = "from-default"

  validation {
    condition     = startswith(var.tier, "from-")
    error_message = "tier must start with \\"from-\\" for this lab."
  }
}

resource "local_file" "resolved" {
  filename = "\${path.module}/resolved.txt"
  content  = "\${var.tier}\\n"
}`,
      },
      {
        title: 'Walking up the precedence ladder',
        language: 'bash',
        code: `terraform init

# 1. default
terraform apply -auto-approve && cat resolved.txt        # from-default

# 2. environment variable
export TF_VAR_tier=from-env
terraform apply -auto-approve && cat resolved.txt        # from-env

# 3. terraform.tfvars
echo 'tier = "from-tfvars"' > terraform.tfvars
terraform apply -auto-approve && cat resolved.txt        # from-tfvars

# 5. *.auto.tfvars
echo 'tier = "from-auto"' > zz.auto.tfvars
terraform apply -auto-approve && cat resolved.txt        # from-auto

# 6. command line - beats everything
terraform apply -auto-approve -var="tier=from-cli"
cat resolved.txt                                          # from-cli

# Later -var beats earlier -var:
terraform apply -auto-approve -var="tier=from-a" -var="tier=from-b"
cat resolved.txt                                          # from-b

# Your own validation message:
terraform plan -var="tier=nope"
# Error: Invalid value for variable
#   tier must start with "from-" for this lab.

# Sensitive redacts output but not state:
#   add  sensitive = true  to the variable, then:
terraform plan -var="tier=from-secret"     # shows (sensitive value)
terraform apply -auto-approve -var="tier=from-secret"
grep -o 'from-secret' terraform.tfstate    # still there, in plaintext

unset TF_VAR_tier`,
      },
    ],
    verification: [
      {
        command:
          'terraform plan -out=tfplan >/dev/null && terraform show -json tfplan | jq -r .variables.tier.value',
        what: 'The resolved value, straight from the plan.',
      },
      {
        command: 'ls terraform.tfvars *.auto.tfvars 2>/dev/null',
        what: 'Lists the files being loaded implicitly.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f terraform.tfvars zz.auto.tfvars resolved.txt tfplan && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the resource, the tfvars files and the cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-outputs', 'tf-custom-conditions', 'tf-sensitive-data-and-vault'],
  docs: [
    {
      title: 'Input variables',
      url: 'https://developer.hashicorp.com/terraform/language/values/variables',
    },
  ],
}
