import type { Topic } from '../../../types'

export const moduleBasics: Topic = {
  id: 'tf-module-basics',
  title: 'What a module is and how to use one',
  domainId: 'tf-modules',
  difficulty: 'beginner',
  estimatedMinutes: 15,
  order: 1,
  tags: ['modules', 'root module', 'child module', 'source', 'objective-5c'],
  oneLiner:
    'Every configuration is already a module - what changes when you call one from another.',
  explanation: [
    'A **module** is any directory containing `.tf` files. That means the configuration you have been writing all along is a module: the **root module**.',
    'Calling a module means adding a `module` block with a `source`. Terraform then treats that directory as a **child module**: it loads its configuration, passes in variables, and makes its outputs available.',
    'The boundary is real. A child module has its own variables and outputs, and nothing else crosses. You cannot reference a resource inside a module, and the module cannot reference anything in its caller except what it was passed.',
    'Modules exist for two reasons: **reuse** (write a network once, use it five times) and **encapsulation** (hide twelve resources behind three inputs). The second matters even when there is no reuse at all.',
  ],
  whyItMatters: [
    'Objective 5c is using modules in configuration, and modules underpin every real-world Terraform codebase.',
    'The module boundary is the single most common source of confusion for people moving beyond a single directory.',
    'A module changes how state addresses look, which matters as soon as you need to run a targeted operation or move state.',
  ],
  howItWorks: [
    'A `module` block needs a `source`. Everything else - the inputs - are the module’s declared variables, passed as ordinary arguments.',
    '`terraform init` installs modules. A new or changed `module` block requires another `init` before `plan` will work.',
    'Local modules (`source = "./modules/network"`) are read in place, so editing them takes effect immediately - no re-init needed for content changes.',
    'Remote modules are downloaded into `.terraform/modules/` and cached, which is why version changes need `init -upgrade`.',
    'Resources inside a module get prefixed state addresses: `module.network.aws_vpc.this`. Nested modules stack: `module.a.module.b.aws_vpc.this`.',
    'A module block accepts `count`, `for_each`, `depends_on` and `providers` as meta-arguments - the same repetition tools as a resource.',
    'The root module is where `provider` blocks and the `backend` belong. A child module should declare provider *requirements* but not provider *configuration*.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Root and child modules',
      caption:
        'Variables go in, outputs come out, and nothing else crosses the boundary. Providers and the backend belong to the root.',
      root: {
        label: 'Root module (where you run terraform)',
        detail: 'Owns the backend and the provider configuration',
        tone: 'accent',
        children: [
          { label: 'backend "s3" { ... }', detail: 'Root only' },
          { label: 'provider "aws" { ... }', detail: 'Root only; inherited by children' },
          {
            label: 'module "network" { source = "./modules/network" }',
            detail: 'A child module call',
            children: [
              { label: 'variable "cidr"', detail: 'The only way values get IN', tone: 'success' },
              { label: 'aws_vpc.this, aws_subnet.private', detail: 'Invisible from outside' },
              { label: 'output "vpc_id"', detail: 'The only way values get OUT', tone: 'success' },
            ],
          },
          {
            label: 'module "app" { ... }',
            detail: 'Consumes module.network.vpc_id',
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'What happens when you add a module block',
      caption: 'The init step is the one people forget. A new module block always needs one.',
      nodes: [
        {
          label: 'You add a module block',
          detail: 'With a source and some input arguments',
        },
        {
          label: 'terraform init installs it',
          detail: 'Local: recorded. Remote: downloaded to .terraform/modules/',
          tone: 'accent',
          branch: {
            label: 'You skip init',
            detail: 'plan fails: "Module not installed"',
          },
        },
        {
          label: 'Its providers are resolved too',
          detail: 'Module constraints intersect with the root’s',
        },
        {
          label: 'Variables are passed in',
          detail: 'A missing required variable is an error here',
        },
        {
          label: 'Its resources join the graph',
          detail: 'Addressed as module.<name>.<type>.<name>',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'module block',
      purpose:
        'Calls a child module. `source` is the only required argument; the rest are the module’s variables.',
      fields: [
        { path: 'source', meaning: 'Where the module comes from. Required.', required: true },
        { path: 'version', meaning: 'Version constraint. Registry sources only.' },
        {
          path: '(any other argument)',
          meaning: 'A value for one of the module’s declared variables.',
        },
        { path: 'count / for_each', meaning: 'Call the module several times.' },
        {
          path: 'providers',
          meaning: 'Map the caller’s provider configurations onto the module’s slots.',
        },
        { path: 'depends_on', meaning: 'Order the whole module after something else.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Encapsulation without reuse',
    story: [
      'A team had one environment and no plans for a second, so they saw no reason to use modules. Their root configuration grew to about 900 lines across nine files.',
      'The problem was not repetition - there was none. It was that any change required understanding the whole file set, because there was no boundary anywhere. A junior engineer changing a subnet tag had to read the load balancer configuration to be sure nothing referenced it.',
      'Splitting it into four local modules - network, data, compute, observability - reduced the root module to about 60 lines: four module blocks and their inputs. Nothing was reused, and the codebase became substantially easier to work in.',
      'Reuse is the advertised benefit of modules. Encapsulation is the one you feel every day.',
    ],
    code: [
      {
        title: 'The root module afterwards',
        language: 'hcl',
        code: `module "network" {
  source = "./modules/network"

  vpc_cidr    = "10.0.0.0/16"
  az_count    = 3
  environment = var.environment
}

module "data" {
  source = "./modules/data"

  subnet_ids  = module.network.private_subnet_ids
  environment = var.environment
}

module "compute" {
  source = "./modules/compute"

  subnet_ids     = module.network.private_subnet_ids
  database_host  = module.data.endpoint
  instance_count = var.environment == "production" ? 6 : 2
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A complete local module',
      language: 'hcl',
      explanation:
        'Three files by convention: inputs, resources, outputs. The module declares which providers it needs but does not configure them.',
      code: `# modules/bucket/variables.tf
variable "name" {
  description = "Bucket name."
  type        = string
}

variable "versioning" {
  description = "Whether to enable object versioning."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply."
  type        = map(string)
  default     = {}
}

# modules/bucket/versions.tf
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 6.0"   # permissive: the caller decides
    }
  }
  # No provider block here. Provider configuration is the root's job.
}

# modules/bucket/main.tf
resource "aws_s3_bucket" "this" {
  bucket = var.name
  tags   = var.tags
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.versioning ? "Enabled" : "Disabled"
  }
}

# modules/bucket/outputs.tf
output "id" {
  description = "Bucket name."
  value       = aws_s3_bucket.this.id
}

output "arn" {
  description = "Bucket ARN."
  value       = aws_s3_bucket.this.arn
}`,
    },
    {
      title: 'Calling it, including repeatedly',
      language: 'hcl',
      explanation:
        'A `for_each` on a module block calls the whole module once per element, with `each` available in its arguments.',
      code: `module "logs_bucket" {
  source = "./modules/bucket"

  name       = "acme-logs"
  versioning = false
  tags       = local.common_tags
}

# for_each on a module: one whole module per element.
module "team_bucket" {
  source   = "./modules/bucket"
  for_each = toset(["platform", "data", "web"])

  name = "acme-\${each.key}"
  tags = merge(local.common_tags, { Team = each.key })
}

# Referencing outputs:
output "log_bucket_arn" {
  value = module.logs_bucket.arn
}

output "team_bucket_arns" {
  value = { for k, m in module.team_bucket : k => m.arn }
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Installs or refreshes every module. Required after adding a module block.',
      expected: '- network in modules/network',
    },
    {
      command: 'terraform state list | grep module',
      what: 'Shows the prefixed addresses of resources inside modules.',
      expected: 'module.network.aws_vpc.this',
    },
    {
      command: 'terraform state show module.network.aws_vpc.this',
      what: 'Inspects a resource inside a module by its full address.',
    },
    {
      command: 'terraform plan -target=module.network',
      what: 'Plans one module and its dependencies. A debugging tool.',
    },
    {
      command: 'terraform output -json | jq .',
      what: 'Root outputs only. Module outputs must be re-exposed by the root to appear here.',
    },
  ],
  declarative: {
    steps: [
      'Split by ownership boundary, not by resource type.',
      'Keep `provider` blocks and the `backend` in the root module only.',
      'Declare permissive provider constraints in modules - they intersect with the caller’s.',
      'Give every variable a description and a type, and every output a description.',
      'Re-run `init` after adding or changing a module block.',
    ],
    code: [
      {
        title: 'A conventional module layout',
        language: 'bash',
        explanation:
          'The file split is convention, not requirement - Terraform concatenates everything. It exists so a reader knows where to look.',
        code: `.
├── main.tf              # root: module calls and glue
├── variables.tf         # root: inputs
├── outputs.tf           # root: outputs
├── providers.tf         # root ONLY: provider blocks
├── backend.tf           # root ONLY: state configuration
└── modules/
    ├── network/
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── outputs.tf
    │   ├── versions.tf  # required_providers, no provider block
    │   └── README.md    # what it does, inputs, outputs
    └── compute/
        └── ...`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state list | cut -d. -f1-2 | sort -u',
      what: 'Lists the modules that actually have resources in state.',
    },
    {
      command: 'terraform providers',
      what: 'Shows which providers each module requires and at which constraints.',
    },
    {
      command: 'terraform plan',
      what: 'A clean plan after adding a module confirms the wiring is complete.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform init',
      what: 'Fixes "Module not installed" after adding a module block.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Unsupported argument" on a module block - you passed something the module does not declare.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Unsupported attribute" on `module.x.y` - `y` is not a declared output.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Missing required argument" - a module variable with no default was not supplied.',
    },
  ],
  commonMistakes: [
    'Forgetting `terraform init` after adding a module block.',
    'Trying to reference a resource inside a module. Only declared outputs cross the boundary.',
    'Putting a `provider` block inside a module, which fixes region and credentials for every caller.',
    'Pinning an exact provider version in a module. Module and root constraints intersect, so an exact pin makes the module hard to use.',
    'Splitting by resource type - all the security groups in one module - which produces modules that cannot be used independently.',
    'Expecting module outputs to appear in `terraform output`. The root must re-export them.',
  ],
  examTips: [
    'Every Terraform directory is a module. The one you run in is the root module.',
    '`source` is the only required argument of a module block.',
    '`terraform init` installs modules; a new module block requires a re-init.',
    'Resources inside modules are addressed `module.<name>.<type>.<name>`.',
    'Modules communicate only through variables in and outputs out.',
    'Provider configuration belongs to the root module; children declare requirements only.',
    'Module blocks accept `count`, `for_each`, `depends_on` and `providers`.',
  ],
  summary: [
    'A module is a directory of `.tf` files; the one you run is the root.',
    'Inputs are variables, outputs are outputs, and nothing else crosses.',
    '`init` installs modules, and a new module block needs a re-init.',
    'State addresses gain a `module.<name>.` prefix.',
    'Providers and the backend belong to the root module.',
  ],
  practice: [
    {
      id: 'tf-modbasics-p1',
      level: 'beginner',
      prompt: 'What is the state address of `aws_vpc.this` inside a module called `network`?',
      answer: '`module.network.aws_vpc.this`',
      explanation:
        'Nested modules stack the prefix: `module.a.module.b.aws_vpc.this`. You need this form for `state show`, `state mv` and `-target`.',
    },
    {
      id: 'tf-modbasics-p2',
      level: 'beginner',
      prompt: 'Which argument of a module block is mandatory?',
      answer:
        '`source`. Everything else is either a meta-argument or one of the module’s variables.',
      explanation:
        '`version` is only meaningful for registry sources, and required variables are mandatory in practice but are not part of the block syntax.',
    },
    {
      id: 'tf-modbasics-p3',
      level: 'intermediate',
      prompt: 'Give two benefits of using modules even when there is no reuse.',
      answer:
        'Encapsulation - a reader deals with three inputs instead of twelve resources - and a smaller change surface, since a change inside a module cannot affect anything the module does not output.',
      explanation:
        'Reuse is the advertised benefit; encapsulation is the one that improves daily work on a single-environment codebase.',
    },
    {
      id: 'tf-modbasics-p4',
      level: 'advanced',
      prompt:
        'Why should a reusable module declare `version = ">= 5.0, < 6.0"` rather than `= 5.62.0` for its provider?',
      answer:
        'Because provider constraints from modules and the root are intersected, not overridden. An exact pin forces every caller onto that exact provider version, and conflicts with any other module that pins differently.',
      explanation:
        'Modules should be permissive; the root configuration and its lock file are where a specific version is chosen.',
    },
  ],
  lab: {
    title: 'Build and call your first module',
    scenario:
      'Write a local module, discover the boundary the hard way, then call it several times with `for_each`.',
    prerequisites: ['Terraform 1.5 or newer'],
    tasks: [
      {
        instruction:
          'Create `modules/greeting/` with a variable `name`, a `local_file` resource, and no outputs yet.',
      },
      {
        instruction:
          'Call it once from the root. Run `plan` WITHOUT `init` first, and read the error.',
      },
      { instruction: 'Run `init`, then `apply`. Inspect `terraform state list`.' },
      {
        instruction:
          'Try to reference the file resource from the root as `module.greeting.local_file.this.filename`. Read the error.',
      },
      { instruction: 'Add an output to the module and reference it successfully from the root.' },
      {
        instruction:
          'Add a `for_each` to the module block over three names, and confirm three modules’ worth of resources appear in state.',
      },
      {
        instruction:
          'Pass an argument the module does not declare, and read the error. Then remove a required argument and read that one.',
      },
      {
        instruction:
          'Re-export a module output from the root and confirm it appears in `terraform output`.',
      },
      { instruction: 'Destroy and clean up.' },
    ],
    solution: [
      {
        title: 'modules/greeting/main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = ">= 2.0, < 3.0"
    }
  }
}

variable "name" {
  description = "Who to greet."
  type        = string
}

variable "excited" {
  description = "Whether to add an exclamation mark."
  type        = bool
  default     = false
}

resource "local_file" "this" {
  filename = "\${path.root}/greeting-\${var.name}.txt"
  content  = "hello \${var.name}\${var.excited ? "!" : ""}\\n"
}

output "path" {
  description = "Path of the generated file."
  value       = local_file.this.filename
}

output "content" {
  description = "The greeting written."
  value       = local_file.this.content
}`,
      },
      {
        title: 'Root main.tf',
        language: 'hcl',
        code: `module "greeting" {
  source   = "./modules/greeting"
  for_each = toset(["alice", "bob", "carol"])

  name    = each.key
  excited = each.key == "alice"
}

# Module outputs do NOT appear in terraform output unless the
# root re-exports them.
output "greeting_paths" {
  value = { for k, m in module.greeting : k => m.path }
}`,
      },
      {
        title: 'The run',
        language: 'bash',
        code: `# Before init:
terraform plan
# Error: Module not installed
#   Run "terraform init" to install all modules required.

terraform init
terraform apply -auto-approve

terraform state list
# module.greeting["alice"].local_file.this
# module.greeting["bob"].local_file.this
# module.greeting["carol"].local_file.this

# Reaching past the boundary fails:
#   output "bad" { value = module.greeting["alice"].local_file.this.filename }
terraform validate
# Error: Unsupported attribute
#   This object does not have an attribute named "local_file".

# Passing an undeclared argument:
#   colour = "blue"
terraform validate
# Error: Unsupported argument
#   An argument named "colour" is not expected here.

# Omitting a required one:
terraform validate
# Error: Missing required argument
#   The argument "name" is required, but no definition was found.

terraform output greeting_paths
terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | grep -c "^module.greeting"',
        what: 'Counts resources created by the module calls.',
        expected: '3',
      },
      {
        command: 'terraform output -json greeting_paths | jq -r \'keys | join(",")\'',
        what: 'Confirms the root re-exported the module outputs.',
        expected: 'alice,bob,carol',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf modules greeting-*.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the module, its files and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-module-sources', 'tf-module-variables-and-scope', 'tf-outputs'],
  docs: [
    {
      title: 'Modules overview',
      url: 'https://developer.hashicorp.com/terraform/language/modules',
    },
    {
      title: 'Module blocks',
      url: 'https://developer.hashicorp.com/terraform/language/modules/syntax',
    },
  ],
}
