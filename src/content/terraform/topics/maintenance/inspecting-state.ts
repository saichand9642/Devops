import type { Topic } from '../../../types'

export const inspectingState: Topic = {
  id: 'tf-inspecting-state',
  title: 'Inspecting state from the CLI',
  domainId: 'tf-maintenance',
  difficulty: 'intermediate',
  estimatedMinutes: 13,
  order: 2,
  tags: ['state list', 'state show', 'show -json', 'console', 'output', 'objective-7b'],
  oneLiner:
    'Every read-only way to ask Terraform what it knows - and why you should never open the state file.',
  explanation: [
    'There are five ways to read state, and each answers a different question. `state list` asks *what do you manage?*. `state show` asks *what is this one thing?*. `show` asks *what does the whole picture look like?*. `output` asks *what did you publish?*. `console` asks *what does this expression evaluate to?*.',
    'All of them are read-only, all work with any backend, and all are stable interfaces. Opening `terraform.tfstate` in an editor works too - and tempts you to change it, which is how state gets broken.',
    'Two of them have a `-json` form that is genuinely useful: `terraform show -json` for the whole state or a saved plan, and `terraform output -json` for published values. Both are documented, versioned formats safe to script against.',
    'The single most valuable of the five is `terraform state show`. It is how you find out which attribute names a resource actually has, which is the answer to most "Unsupported attribute" errors.',
  ],
  whyItMatters: [
    'Objective 7b is using the CLI to inspect state, which is precisely this set of commands.',
    'Knowing the right command turns "I think it is configured like this" into "here is what Terraform records".',
    '`terraform show -json` is how policy tools, drift dashboards and pipeline gates read Terraform, so it is worth knowing beyond the exam.',
  ],
  howItWorks: [
    '`terraform state list` prints one address per line, including data sources (prefixed `data.`) and module resources (prefixed `module.`). It accepts a filter argument.',
    '`terraform state show <address>` prints every recorded attribute for one resource, in HCL-like form. Sensitive values are redacted.',
    '`terraform show` prints the whole state in human-readable form. `terraform show <planfile>` prints a saved plan instead.',
    '`terraform show -json` emits the state or plan as documented JSON. State has `values.root_module.resources[]`; a plan has `resource_changes[]` with the actions per resource.',
    '`terraform output` reads published values from state without planning. `-raw` gives one unquoted value; `-json` gives everything with types and sensitivity flags.',
    '`terraform console` evaluates arbitrary expressions against real state, variables and data sources. It accepts piped input, so it works in scripts.',
    '`terraform graph` prints the dependency graph in DOT format, which answers ordering questions the other commands cannot.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which inspection command?',
      caption: 'Pick by the question you are asking. Reaching for an editor is not on the list.',
      question: 'What do you want to know?',
      branches: [
        {
          condition: 'what resources exist in state',
          result: 'terraform state list',
          detail: 'One address per line; accepts a filter',
          tone: 'accent',
        },
        {
          condition: 'the attributes of one resource',
          result: 'terraform state show <addr>',
          detail: 'The answer to most "Unsupported attribute" errors',
        },
        {
          condition: 'a published value',
          result: 'terraform output -raw <name>',
          detail: 'Unquoted, suitable for a shell variable',
        },
        {
          condition: 'anything machine-readable',
          result: 'terraform show -json',
          detail: 'A documented, versioned format',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Answering "what can I reference?"',
      caption:
        'This loop replaces guessing at attribute names, and it works offline against real state.',
      nodes: [
        {
          label: 'You need an attribute you cannot remember',
          detail: 'Is it .dns_name, .domain_name or .endpoint?',
        },
        {
          label: 'terraform state list',
          detail: 'Find the exact address',
          tone: 'accent',
        },
        {
          label: 'terraform state show <address>',
          detail: 'Every attribute name and its current value',
          arrowLabel: 'the answer is here',
        },
        {
          label: 'terraform console to test it',
          detail: 'aws_lb.web.dns_name - confirm before committing',
        },
        {
          label: 'Write the reference',
          tone: 'success',
          branch: {
            label: 'Not in state yet?',
            detail: 'Use terraform providers schema -json instead',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Inspection commands',
      purpose: 'The five read-only ways to query state, and what each is for.',
      fields: [
        {
          path: 'terraform state list [filter]',
          meaning: 'Addresses of everything managed.',
          required: true,
        },
        {
          path: 'terraform state show <addr>',
          meaning: 'All attributes of one resource.',
          required: true,
        },
        { path: 'terraform show [-json] [plan]', meaning: 'The whole state, or a saved plan.' },
        { path: 'terraform output [-raw|-json] [name]', meaning: 'Published values, from state.' },
        { path: 'terraform console', meaning: 'Evaluate expressions against real state.' },
        { path: 'terraform graph', meaning: 'The dependency graph, in DOT format.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Twenty minutes lost to a guessed attribute name',
    story: [
      'An engineer needed the DNS name of a load balancer for a Route 53 record. They tried `aws_lb.web.dns`, then `.domain_name`, then `.hostname`, running a plan each time and waiting for the refresh.',
      'Each attempt took a couple of minutes because plan refreshes the whole configuration. Twenty minutes in, they searched the documentation and found `dns_name`.',
      '`terraform state show aws_lb.web` would have listed every attribute, with values, in under a second - and it works offline against state already on disk.',
      'The habit is worth building because it generalises: the same command answers "what did the provider actually set?", "is this really in the region I think?" and "which attributes changed?".',
    ],
    code: [
      {
        title: 'One second instead of twenty minutes',
        language: 'bash',
        code: `$ terraform state show aws_lb.web | grep -i dns
    dns_name = "web-1234567890.eu-west-1.elb.amazonaws.com"

# Or list every attribute name available:
$ terraform show -json \\
  | jq -r '.values.root_module.resources[]
           | select(.address == "aws_lb.web")
           | .values | keys[]'`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The five commands in practice',
      language: 'bash',
      explanation:
        'Note the filter argument to `state list` and the `-raw` form of `output` - both are the small details that make these commands pleasant to use.',
      code: `# What do you manage?
terraform state list
# aws_instance.web[0]
# aws_instance.web[1]
# data.aws_ami.ubuntu
# module.network.aws_vpc.this

# Filtered - an address prefix or a resource type.
terraform state list aws_instance
terraform state list 'module.network'

# What is this one thing?
terraform state show 'aws_instance.web[0]'
terraform state show data.aws_ami.ubuntu
terraform state show 'module.network.aws_vpc.this'

# The whole picture, human-readable.
terraform show

# A saved plan, human-readable.
terraform plan -out=tfplan && terraform show tfplan

# Published values.
terraform output
terraform output -raw load_balancer_dns      # for a shell variable
terraform output -json | jq -r '.connection.value.host'`,
    },
    {
      title: 'Scripting against the JSON output',
      language: 'bash',
      explanation:
        'Both `show -json` formats are documented and versioned, which is why policy and reporting tools use them rather than parsing the state file.',
      code: `# Every managed resource address and type.
terraform show -json \\
  | jq -r '.values.root_module.resources[] | "\\(.type)\\t\\(.address)"' \\
  | sort

# Including resources inside modules (they nest).
terraform show -json \\
  | jq -r '[.values.root_module | recurse(.child_modules[]?)
            | .resources[]?] | .[] | .address'

# A tag audit: anything missing an Owner tag.
terraform show -json \\
  | jq -r '.values.root_module.resources[]
           | select(.values.tags.Owner == null)
           | .address'

# From a saved plan: which resources would be destroyed?
terraform show -json tfplan \\
  | jq -r '.resource_changes[]
           | select(.change.actions | contains(["delete"]))
           | .address'

# Count actions by type.
terraform show -json tfplan \\
  | jq -r '[.resource_changes[].change.actions | join("+")]
           | group_by(.) | map({action: .[0], count: length})'`,
    },
    {
      title: 'terraform console for exploration',
      language: 'bash',
      explanation:
        'The console sees everything the configuration sees, which makes it the fastest way to check an expression before committing it.',
      code: `# Interactive.
terraform console
> aws_instance.web[0].private_ip
> aws_instance.web[*].id
> length(aws_instance.web)
> keys(module.network.subnet_ids)
> [for i in aws_instance.web : i.tags.Name]
> type(var.subnets)
# Ctrl-D to exit.

# Piped, for scripts and one-liners.
echo 'aws_instance.web[*].private_ip' | terraform console

# Against a fresh plan, so unknown values are visible as unknown.
terraform console -plan`,
    },
  ],
  imperative: [
    {
      command: 'terraform state list',
      what: 'Every managed address, including data sources and module resources.',
    },
    {
      command: 'terraform state show <address>',
      what: 'All recorded attributes for one resource. Sensitive values redacted.',
    },
    {
      command: 'terraform show',
      what: 'The whole state, human-readable.',
    },
    {
      command: 'terraform show -json | jq .',
      what: 'The whole state as documented JSON.',
    },
    {
      command: 'terraform output -raw <name>',
      what: 'One published value, unquoted.',
    },
    {
      command: 'terraform console',
      what: 'Evaluate expressions against real state, variables and data sources.',
    },
    {
      command: 'terraform graph | dot -Tsvg > graph.svg',
      what: 'The dependency graph, for ordering questions.',
    },
  ],
  declarative: {
    steps: [
      'Use `state show` before guessing an attribute name.',
      'Use `output -raw` in scripts, never plain `output`, which quotes the value.',
      'Script against `show -json`, never against the state file directly.',
      'Test expressions in `terraform console` before committing them.',
      'Never open state in an editor - every question has a command.',
    ],
    code: [
      {
        title: 'A small inventory report',
        language: 'bash',
        explanation:
          'Built entirely from documented interfaces, so it keeps working across Terraform versions.',
        code: `#!/usr/bin/env bash
# Inventory of everything Terraform manages here.
set -euo pipefail

echo "== Counts by type"
terraform show -json \\
  | jq -r '[.values.root_module | recurse(.child_modules[]?)
            | .resources[]?]
           | map(select(.mode == "managed"))
           | group_by(.type)
           | map({type: .[0].type, count: length})
           | sort_by(-.count)[]
           | "\\(.count)\\t\\(.type)"'

echo
echo "== Data sources"
terraform state list | grep '^data\\.' || echo "(none)"

echo
echo "== Modules in use"
terraform state list \\
  | grep '^module\\.' \\
  | sed 's/\\(module\\.[^.]*\\).*/\\1/' \\
  | sort -u || echo "(none)"

echo
echo "== Published outputs"
terraform output -json | jq -r 'to_entries[] | "\\(.key)\\t\\(if .value.sensitive then "<sensitive>" else (.value.value | tostring) end)"'`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state list | wc -l',
      what: 'How many resources Terraform believes it manages.',
    },
    {
      command: 'terraform show -json | jq -r .format_version',
      what: 'Confirms the JSON format version you are scripting against.',
      expected: '1.0 or later',
    },
    {
      command: 'terraform output -json | jq -r \'keys | join(", ")\'',
      what: 'Lists published output names.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform state show <address>',
      what: 'Lists real attribute names when a plan reports "Unsupported attribute".',
    },
    {
      command: 'terraform state list | grep -i <partial>',
      what: 'Finds the exact address when you only remember part of it.',
    },
    {
      command: 'terraform output',
      what: 'Reports "No outputs found" - none declared, or the apply has not run.',
    },
    {
      command: "terraform console <<< '<expression>'",
      what: 'Reproduces an expression error immediately, with the same message a plan would give.',
    },
    {
      command: 'terraform state list',
      what: 'Empty output means wrong directory, wrong workspace, or state not yet created.',
    },
  ],
  commonMistakes: [
    'Opening the state file in an editor. Every question has a command, and the editor tempts you to change something.',
    'Using `terraform output <name>` in a script. It quotes the value; `-raw` does not.',
    'Parsing human-readable `terraform show` output with grep. Use `-json`.',
    'Forgetting the `data.` prefix when addressing a data source in `state show`.',
    'Forgetting to quote indexed addresses in a shell - `aws_instance.web[0]` needs quotes.',
    'Expecting `terraform state list` to show resources inside modules without their `module.` prefix.',
    'Missing module resources in a `show -json` script by reading only `root_module.resources`.',
  ],
  examTips: [
    '`terraform state list` lists addresses; `terraform state show <addr>` shows one resource’s attributes.',
    '`terraform show` prints the whole state; `terraform show <planfile>` prints a saved plan.',
    '`terraform show -json` is the documented machine-readable form for both.',
    '`terraform output -raw` prints one value without quotes.',
    '`terraform console` evaluates expressions against real state.',
    'All of these are read-only and work with any backend.',
    'Data source addresses begin with `data.`; module resources with `module.`.',
  ],
  summary: [
    'Five commands, five different questions - pick by what you are asking.',
    '`state show` is the answer to most attribute-name problems.',
    '`show -json` and `output -json` are the documented interfaces to script against.',
    '`terraform console` tests an expression in a second rather than a plan cycle.',
    'Never read state with an editor.',
  ],
  practice: [
    {
      id: 'tf-inspect-p1',
      level: 'beginner',
      prompt:
        'Which command lists every resource Terraform manages, and which shows one in detail?',
      answer: '`terraform state list` and `terraform state show <address>`.',
      explanation: 'Both are read-only and work with any backend, local or remote.',
    },
    {
      id: 'tf-inspect-p2',
      level: 'beginner',
      prompt:
        'Why use `terraform output -raw name` rather than `terraform output name` in a script?',
      answer:
        '`-raw` prints the value with no surrounding quotes, so it can be assigned to a shell variable directly.',
      explanation:
        'Plain `terraform output name` prints a quoted HCL value, which breaks most scripts.',
    },
    {
      id: 'tf-inspect-p3',
      level: 'intermediate',
      prompt:
        'A plan reports "Unsupported attribute" on a resource you already manage. Which command answers it fastest?',
      answer:
        '`terraform state show <address>`, which lists every attribute name with its current value.',
      explanation:
        'For a resource that does not exist yet, `terraform providers schema -json` gives the same information from the provider schema.',
    },
    {
      id: 'tf-inspect-p4',
      level: 'advanced',
      prompt:
        'Why should a pipeline gate read `terraform show -json` rather than parsing the state file or the human-readable plan?',
      answer:
        'Because `show -json` is a documented, versioned format with a `format_version` field, and it works identically for state and for a saved plan. The state file layout is an internal detail that can change, and the human-readable output is formatted for people and changes between versions.',
      explanation:
        'That is why policy tools such as OPA and Sentinel consume the JSON plan rather than anything else.',
    },
  ],
  lab: {
    title: 'Answer eight questions without opening state',
    scenario:
      'Build a configuration with modules, data sources, sensitive outputs and repeated resources, then answer questions about it using only the inspection commands.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `for_each` resource, a data source, a small local module and one sensitive output. Apply it.',
      },
      {
        instruction:
          'Using only the CLI, answer: how many resources are managed, including inside the module?',
      },
      { instruction: 'Answer: what are the exact addresses of the `for_each` instances?' },
      {
        instruction:
          'Answer: what attributes does one of them have? Find one you did not set yourself.',
      },
      { instruction: 'Answer: which outputs are marked sensitive?' },
      {
        instruction:
          'Use `terraform show -json` and jq to list every resource including those inside the module.',
        hint: 'Module resources are under child_modules - use jq recurse.',
      },
      {
        instruction:
          'Use `terraform console` to evaluate a splat expression over the for_each resource.',
      },
      {
        instruction:
          'Save a plan after making a trivial change, then use `show -json` on the plan to list the actions per resource.',
      },
      { instruction: 'Destroy and clean up.' },
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

variable "services" {
  type    = set(string)
  default = ["api", "web", "worker"]
}

resource "random_pet" "svc" {
  for_each = var.services
  length   = 2
}

resource "local_file" "svc" {
  for_each = var.services
  filename = "\${path.module}/\${each.key}.txt"
  content  = "\${each.key}: \${random_pet.svc[each.key].id}\\n"
}

data "local_file" "first" {
  filename   = "\${path.module}/api.txt"
  depends_on = [local_file.svc]
}

module "extra" {
  source = "./modules/extra"
}

resource "random_password" "token" {
  length = 16
}

output "names" {
  value = { for k, p in random_pet.svc : k => p.id }
}

output "token" {
  value     = random_password.token.result
  sensitive = true
}`,
      },
      {
        title: 'modules/extra/main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

resource "random_id" "inner" {
  byte_length = 4
}

output "id" {
  value = random_id.inner.hex
}`,
      },
      {
        title: 'Answering the questions',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# 1. How many resources, including inside modules?
terraform state list | wc -l

# 2. The for_each addresses:
terraform state list local_file
# local_file.svc["api"]
# local_file.svc["web"]
# local_file.svc["worker"]

# 3. Attributes of one - note "id" and "content_base64sha256",
#    which you never set:
terraform state show 'local_file.svc["api"]'

# 4. Which outputs are sensitive?
terraform output -json | jq 'map_values(.sensitive)'
# { "names": false, "token": true }

# 5. Every resource, INCLUDING module ones:
terraform show -json \\
  | jq -r '[.values.root_module | recurse(.child_modules[]?)
            | .resources[]?] | .[] | .address' | sort
# note module.extra.random_id.inner appears

# 6. A splat in the console:
echo 'values(random_pet.svc)[*].id' | terraform console
echo 'keys(local_file.svc)'          | terraform console

# 7. Actions from a saved plan:
sed -i 's/length   = 2/length   = 3/' main.tf
terraform plan -out=tfplan
terraform show -json tfplan \\
  | jq -r '.resource_changes[] | "\\(.address)\\t\\(.change.actions|join("+"))"'

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | grep -c "^module\\."',
        what: 'Confirms module resources are in state and counted.',
        expected: '1',
      },
      {
        command: 'terraform output -json | jq -r \'.token.value // "<redacted>"\'',
        what: 'Sensitive values still require `-raw` to read.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf modules *.txt tfplan .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the module, the files and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-drift-and-state-commands', 'tf-logging-and-debugging', 'tf-outputs'],
  docs: [
    {
      title: 'terraform state list',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/state/list',
    },
    {
      title: 'terraform show',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/show',
    },
  ],
}
