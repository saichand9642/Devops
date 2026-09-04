import type { Topic } from '../../../types'

export const moduleVariablesAndScope: Topic = {
  id: 'tf-module-variables-and-scope',
  title: 'Variable scope inside modules',
  domainId: 'tf-modules',
  difficulty: 'intermediate',
  estimatedMinutes: 13,
  order: 3,
  tags: ['scope', 'variables', 'inheritance', 'path', 'objective-5b'],
  oneLiner:
    'What a module can and cannot see: variables are not inherited, providers are, and locals never cross.',
  explanation: [
    'Each module has its **own** variable namespace. A child module cannot see the caller’s variables, and the caller cannot see the child’s. Values cross only as explicit arguments in the `module` block.',
    'This surprises people because it differs from most programming languages: there is no lexical scoping and no inheritance of variables. If a child needs `var.environment`, the caller must pass it.',
    '**Locals** are strictly module-scoped too. `local.name_prefix` in the root is invisible inside a child module, full stop.',
    'The one thing that **is** inherited is **default provider configuration**. A child module uses its caller’s providers automatically - which is why modules should never declare their own.',
  ],
  whyItMatters: [
    'Objective 5b is describing variable scope within modules, and the "not inherited" point is the whole objective.',
    'The commonest module refactoring mistake is assuming a child can read `var.environment` because the root declares it.',
    '`path.module` versus `path.root` matters as soon as a module reads or writes a file, and getting it wrong produces paths that work only from one directory.',
  ],
  howItWorks: [
    'A variable exists only in the module that declares it. `var.x` inside a module refers to that module’s `variable "x"` block, never the caller’s.',
    'Values are passed as arguments: `module "app" { environment = var.environment }`. The argument name is the **child’s** variable name.',
    'A child module’s outputs are its only way to return anything. The caller reads them as `module.<name>.<output>`.',
    'Locals never cross a module boundary in either direction. Neither do data sources - each module declares its own.',
    'Default provider configurations are inherited automatically. Aliased ones are not, and must be passed with `providers = { ... }`.',
    '`path.module` is the directory of the module containing the expression. `path.root` is the root module’s directory. `path.cwd` is where you ran the command.',
    'The `terraform.workspace` value is global - every module sees the same workspace name.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'What crosses the boundary and what does not',
      caption:
        'Only arguments and outputs cross. Providers are the single exception, and only the default ones.',
      root: {
        label: 'Root module',
        children: [
          {
            label: 'var.environment, local.prefix',
            detail: 'NOT visible to any child module',
            tone: 'muted',
          },
          {
            label: 'provider "aws" { region = "eu-west-1" }',
            detail: 'INHERITED by every child module',
            tone: 'success',
          },
          {
            label: 'module "app" { environment = var.environment }',
            detail: 'The argument is how the value crosses',
            tone: 'accent',
            children: [
              {
                label: 'variable "environment"',
                detail: 'A separate variable that happens to share a name',
              },
              { label: 'local.prefix', detail: 'The module’s own local, unrelated to the root’s' },
              {
                label: 'output "url"',
                detail: 'How a value crosses back out',
                tone: 'success',
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'A module needs a value. Where does it come from?',
      caption:
        'There is no mechanism for a module to reach upward. Every value it needs must be declared and passed.',
      question: 'What does the module need?',
      branches: [
        {
          condition: 'a value the caller has',
          result: 'Declare a variable, pass it in',
          detail: 'The only mechanism. There is no inheritance.',
          tone: 'accent',
        },
        {
          condition: 'a value it can look up itself',
          result: 'Its own data source',
          detail: 'Data sources are per-module too',
        },
        {
          condition: 'a derived value',
          result: 'Its own locals',
          detail: 'Built from its own variables',
        },
        {
          condition: 'the same value in twenty modules',
          result: 'Pass an object variable',
          detail: 'One "context" argument beats twenty separate ones',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Scope rules',
      purpose: 'What is and is not visible inside a child module.',
      fields: [
        {
          path: 'Caller variables',
          meaning: 'NOT visible. Must be passed as arguments.',
          required: true,
        },
        { path: 'Caller locals', meaning: 'NOT visible, ever.', required: true },
        { path: 'Caller resources', meaning: 'NOT visible. Pass the attributes you need.' },
        { path: 'Default provider config', meaning: 'INHERITED automatically.', required: true },
        { path: 'Aliased provider config', meaning: 'NOT inherited. Pass with `providers = {}`.' },
        { path: 'terraform.workspace', meaning: 'Global - the same in every module.' },
        { path: 'path.module', meaning: 'The directory of THIS module.' },
        { path: 'path.root', meaning: 'The directory of the root module.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Twenty arguments and a context object',
    story: [
      'A codebase had eleven modules, each needing `environment`, `project`, `region`, `cost_centre` and `common_tags`. Every module block passed all five, and every module declared all five.',
      'Adding a sixth - `compliance_zone` - meant editing twenty-two files: eleven variable declarations and eleven module blocks. The pull request was large, mechanical and easy to get wrong, and two modules were missed.',
      'Replacing the five with one `context` object variable meant the sixth field was added in one place, and every module that needed it could read `var.context.compliance_zone` without any call site changing.',
      'The trade-off is honest: a context object is less explicit about what a module actually uses, and a type constraint on the object is what keeps it from becoming a bag of anything. But for cross-cutting values it removes a real maintenance tax.',
    ],
    code: [
      {
        title: 'The context object pattern',
        language: 'hcl',
        code: `# A shared type, declared identically in each module.
variable "context" {
  description = "Cross-cutting deployment context."
  type = object({
    environment     = string
    project         = string
    region          = string
    cost_centre     = string
    compliance_zone = optional(string, "standard")
    tags            = optional(map(string), {})
  })
}

# Inside the module:
locals {
  name_prefix = "\${var.context.project}-\${var.context.environment}"

  tags = merge(var.context.tags, {
    Environment    = var.context.environment
    CostCentre     = var.context.cost_centre
    ComplianceZone = var.context.compliance_zone
  })
}

# At every call site - one argument, whatever the object contains.
module "network" {
  source  = "./modules/network"
  context = local.context
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Passing values in and out',
      language: 'hcl',
      explanation:
        'Note the two `environment` variables. They share a name and are entirely separate; the argument is what connects them.',
      code: `# --- root/variables.tf
variable "environment" {
  type = string
}

# --- root/main.tf
locals {
  # Invisible inside any child module.
  name_prefix = "acme-\${var.environment}"
}

module "network" {
  source = "./modules/network"

  # Left side: the CHILD's variable name.
  # Right side: an expression evaluated in the ROOT.
  environment = var.environment
  name_prefix = local.name_prefix
  cidr        = "10.0.0.0/16"
}

module "app" {
  source = "./modules/app"

  environment = var.environment
  name_prefix = local.name_prefix
  # Values from one module to another, via the root.
  subnet_ids  = module.network.private_subnet_ids
  vpc_id      = module.network.vpc_id
}

# --- modules/network/variables.tf
# A DIFFERENT variable that happens to share a name.
variable "environment" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "cidr" {
  type = string
}`,
    },
    {
      title: 'path.module versus path.root',
      language: 'hcl',
      explanation:
        'A module reading its own bundled file must use `path.module`. A module writing output for the user usually wants `path.root`.',
      code: `# Inside modules/config/main.tf

# CORRECT: a file that ships WITH the module.
resource "aws_s3_object" "policy" {
  bucket  = var.bucket
  key     = "policy.json"
  content = file("\${path.module}/files/policy.json")
}

# CORRECT: writing something for the person running Terraform,
# in the directory they ran it from.
resource "local_file" "rendered" {
  filename = "\${path.root}/generated/config.yaml"
  content  = yamlencode(local.config)
}

# WRONG: this only works when the module happens to be the root.
# resource "aws_s3_object" "policy" {
#   content = file("\${path.root}/files/policy.json")
# }

# AVOID: depends on where the user was standing.
# filename = "\${path.cwd}/out.txt"`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan',
      what: 'Reports a missing required argument when a module variable was not passed.',
    },
    {
      command: 'terraform console',
      what: 'Evaluates root-scope expressions. Module-internal locals are not reachable from here.',
    },
    {
      command: 'terraform state list | grep "^module"',
      what: 'Shows which resources belong to which module.',
    },
    {
      command: 'terraform plan -target=module.network',
      what: 'Narrows to one module while diagnosing an input problem.',
    },
  ],
  declarative: {
    steps: [
      'Declare every value a module needs as its own variable - there is no inheritance to rely on.',
      'Name a child’s variable after what the child means by it, not after the caller’s name for it.',
      'Group cross-cutting values into one typed `context` object rather than repeating five arguments.',
      'Use `path.module` for files that ship with the module, `path.root` for output intended for the user.',
      'Never declare a `provider` block in a module; rely on inheritance, or accept an alias.',
    ],
    code: [
      {
        title: 'The mistake this lesson is about',
        language: 'hcl',
        explanation:
          'A module referencing a variable it does not declare is not "inheriting" - it is a hard error.',
        code: `# --- root/main.tf
variable "environment" { type = string }

module "app" {
  source = "./modules/app"
  # environment is NOT passed.
}

# --- modules/app/main.tf
resource "aws_s3_bucket" "this" {
  # Error: Reference to undeclared input variable
  #   An input variable with the name "environment" has not been
  #   declared. This variable can be declared with a variable
  #   "environment" {} block.
  bucket = "acme-\${var.environment}"
}

# The fix is two changes, not one:
#   1. declare  variable "environment" {}  in the module
#   2. pass     environment = var.environment  in the module block`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform validate',
      what: 'Catches a module referencing a variable it never declared.',
    },
    {
      command: 'terraform plan',
      what: 'Confirms every required module argument is supplied.',
    },
    {
      command: 'terraform state show module.config.local_file.rendered | grep filename',
      what: 'Confirms `path.module` versus `path.root` resolved as intended.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'Reports "Reference to undeclared input variable" - the module needs its own `variable` block.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Missing required argument" - declared in the module, not passed by the caller.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Unsupported argument" - passed by the caller, not declared in the module.',
    },
    {
      command: 'terraform validate',
      what: 'Reports "Reference to undeclared local value" - a local does not cross the boundary.',
    },
  ],
  commonMistakes: [
    'Expecting a child module to see the caller’s variables. It cannot.',
    'Expecting a child module to see the caller’s locals. It cannot, and there is no workaround but passing them.',
    'Using `path.root` inside a module for a file the module ships with. It breaks whenever the module is not the root.',
    'Declaring a variable in a module and forgetting to pass it, or vice versa. The two halves are separate edits.',
    'Assuming aliased providers are inherited. Only default configurations are.',
    'Passing eight separate cross-cutting arguments to every module, then having to edit every call site to add a ninth.',
  ],
  examTips: [
    'Variables are module-scoped. There is no inheritance in either direction.',
    'Locals never cross a module boundary.',
    'Values go in as arguments and come out as outputs. That is the entire interface.',
    'Default provider configurations ARE inherited; aliased ones are not.',
    '`path.module` is this module’s directory; `path.root` is the root’s.',
    '`terraform.workspace` is the same value in every module.',
  ],
  summary: [
    'Each module has its own variables and locals; nothing is inherited.',
    'Arguments in, outputs out - that is the whole interface.',
    'Default providers are the one thing that is inherited.',
    '`path.module` for module files, `path.root` for user-facing output.',
    'A typed `context` object beats repeating five cross-cutting arguments everywhere.',
  ],
  practice: [
    {
      id: 'tf-modscope-p1',
      level: 'beginner',
      prompt:
        'The root declares `variable "environment"`. Can a child module use `var.environment` without declaring it?',
      answer:
        'No. The child must declare its own `variable "environment"` and the caller must pass it.',
      explanation:
        'Terraform reports "Reference to undeclared input variable". Fixing it requires both the declaration and the argument.',
    },
    {
      id: 'tf-modscope-p2',
      level: 'beginner',
      prompt: 'Which is inherited by a child module: variables, locals, or provider configuration?',
      answer: 'Only default provider configuration.',
      explanation:
        'Aliased providers must be passed explicitly with `providers = { ... }`; variables and locals are never inherited.',
    },
    {
      id: 'tf-modscope-p3',
      level: 'intermediate',
      prompt:
        'A module reads a JSON policy file that lives in its own directory. Which path expression, and what breaks with the other one?',
      answer:
        '`"${path.module}/files/policy.json"`. Using `path.root` resolves relative to the root module, so the file is not found whenever the module is called from anywhere else.',
      explanation:
        '`path.cwd` is worse still: it depends on which directory the person happened to run Terraform from.',
    },
    {
      id: 'tf-modscope-p4',
      level: 'advanced',
      prompt:
        'What is the trade-off of passing one `context` object instead of five separate variables?',
      answer:
        'You gain a single edit point for cross-cutting values, so adding a field does not touch any call site. You lose explicitness: the module’s signature no longer states which of the fields it actually uses, so a strict `object({...})` type is essential to stop it becoming a bag of anything.',
      explanation:
        'The usual compromise is a context object for genuinely cross-cutting values and named variables for anything specific to that module.',
    },
  ],
  lab: {
    title: 'Cross the boundary, and fail to',
    scenario:
      'Prove that variables and locals do not cross a module boundary, then fix it properly and compare `path.module` with `path.root`.',
    prerequisites: ['Terraform 1.5 or newer'],
    tasks: [
      {
        instruction:
          'Create a root with `variable "environment"` and a local `prefix`, plus a module that references `var.environment` WITHOUT declaring it.',
      },
      { instruction: 'Run `terraform validate` and read the error precisely.' },
      {
        instruction:
          'Declare the variable inside the module. Run validate again and read the new error.',
      },
      { instruction: 'Pass the argument from the root. Confirm validate now passes.' },
      {
        instruction:
          'Try to reference `local.prefix` from inside the module. Read the error, then fix it by passing it as an argument.',
      },
      {
        instruction:
          'Inside the module, create two `local_file` resources: one using `path.module` and one using `path.root`. Apply and compare where the files land.',
      },
      {
        instruction:
          'Refactor to a single `context` object variable carrying environment and prefix, and confirm the plan is unchanged.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'Final root main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

variable "environment" {
  type    = string
  default = "staging"
}

locals {
  context = {
    environment = var.environment
    prefix      = "acme-\${var.environment}"
  }
}

module "app" {
  source  = "./modules/app"
  context = local.context
}

output "module_paths" {
  value = module.app.paths
}`,
      },
      {
        title: 'Final modules/app/main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = ">= 2.0, < 3.0" }
  }
}

variable "context" {
  description = "Cross-cutting deployment context."
  type = object({
    environment = string
    prefix      = string
  })
}

# The module's OWN local, unrelated to the root's.
locals {
  filename = "\${var.context.prefix}.txt"
}

# path.module: beside the module's own files.
resource "local_file" "in_module" {
  filename = "\${path.module}/\${local.filename}"
  content  = "written with path.module\\n"
}

# path.root: beside the configuration the user is running.
resource "local_file" "in_root" {
  filename = "\${path.root}/\${local.filename}"
  content  = "written with path.root\\n"
}

output "paths" {
  value = {
    module = local_file.in_module.filename
    root   = local_file.in_root.filename
  }
}`,
      },
      {
        title: 'The errors, in order',
        language: 'bash',
        code: `mkdir -p modules/app

# Step 2: module references var.environment without declaring it
terraform validate
# Error: Reference to undeclared input variable
#   An input variable with the name "environment" has not been
#   declared in module.app.

# Step 3: declared in the module, not passed by the caller
terraform validate
# Error: Missing required argument
#   The argument "environment" is required, but no definition
#   was found.

# Step 5: locals never cross
#   inside the module:  content = local.prefix
terraform validate
# Error: Reference to undeclared local value

terraform init && terraform apply -auto-approve

terraform output module_paths
# {
#   "module" = "./modules/app/acme-staging.txt"
#   "root"   = "./acme-staging.txt"
# }
find . -name 'acme-staging.txt'   # two files, in two places

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: "terraform output -json module_paths | jq -r '.module, .root'",
        what: 'Shows the two paths resolved differently.',
      },
      {
        command: 'find . -name "acme-*.txt" | sort',
        what: 'Confirms both files exist, in different directories.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf modules acme-*.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the module, both files and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-module-basics', 'tf-outputs', 'tf-multiple-providers'],
  docs: [
    {
      title: 'Module composition',
      url: 'https://developer.hashicorp.com/terraform/language/modules/develop/composition',
    },
    {
      title: 'Filesystem and workspace info',
      url: 'https://developer.hashicorp.com/terraform/language/expressions/references#filesystem-and-workspace-info',
    },
  ],
}
