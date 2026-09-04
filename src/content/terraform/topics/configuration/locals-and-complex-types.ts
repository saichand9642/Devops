import type { Topic } from '../../../types'

export const localsAndComplexTypes: Topic = {
  id: 'tf-locals-and-complex-types',
  title: 'Locals and complex types',
  domainId: 'tf-configuration',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 5,
  tags: ['locals', 'list', 'map', 'set', 'object', 'tuple', 'objective-4d'],
  oneLiner:
    'Named intermediate values, and the collection and structural types Terraform gives you to shape them.',
  explanation: [
    'A `locals` block names an expression so it can be reused. Locals are computed once per run, cannot be overridden from outside, and may reference variables, resources, data sources and other locals.',
    'The rule of thumb: a **variable** is an input someone supplies; a **local** is a value you derive. If nobody outside should be able to set it, it is a local.',
    'Terraform has three **collection** types, whose elements must all share one type: `list(T)` is ordered and allows duplicates, `set(T)` is unordered and de-duplicated, `map(T)` is string keys to values of type T.',
    'It has two **structural** types, whose members may differ: `object({...})` has named attributes with declared types, and `tuple([...])` has positional elements with declared types. These are what you reach for when a value has a shape rather than a list of similar things.',
  ],
  whyItMatters: [
    'Objective 4d is understanding and using complex types, and the list/set/map distinction appears regularly in exam questions.',
    'Locals are the main tool for keeping a configuration readable: one naming convention, defined once, used everywhere.',
    'Choosing `map(object({...}))` for configuration data is the pattern that makes `for_each` clean, which is most of what advanced Terraform looks like.',
  ],
  howItWorks: [
    'A `locals` block may appear any number of times. All locals share one namespace, referenced as `local.<name>` - note the singular.',
    'Locals are evaluated lazily and in dependency order, so one local may reference another. A cycle between locals is an error.',
    '`list(T)`: ordered, indexed by number, duplicates allowed. Iterating gives positions.',
    '`set(T)`: unordered, de-duplicated, not indexable. `toset()` converts a list, discarding order and duplicates.',
    '`map(T)`: string keys, unique, iterated in lexical key order - which makes `for_each` output stable.',
    '`object({name = string, port = number})`: fixed named attributes with types. Missing or extra attributes are errors, unless declared `optional()`.',
    '`tuple([string, number, bool])`: fixed length, position-typed. Rare in practice; usually a sign an object would be clearer.',
    'Terraform converts between compatible types automatically where it safely can - a list to a set, a number to a string - and errors where it cannot.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which type should this value be?',
      caption:
        'The question is whether the elements are alike or different, and whether order or uniqueness matters.',
      question: 'What shape is the data?',
      branches: [
        {
          condition: 'several similar things, order matters',
          result: 'list(T)',
          detail: 'Indexed by number; duplicates allowed',
        },
        {
          condition: 'several similar things, uniqueness matters',
          result: 'set(T)',
          detail: 'Unordered, de-duplicated, not indexable',
        },
        {
          condition: 'named lookups of similar things',
          result: 'map(T)',
          detail: 'String keys; stable lexical iteration order',
          tone: 'accent',
        },
        {
          condition: 'one thing with several differently-typed fields',
          result: 'object({...})',
          detail: 'Named attributes, each with its own type',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Variable or local?',
      caption: 'The deciding question is who is allowed to change the value.',
      nodes: [
        {
          label: 'You need a named value',
          detail: 'Used in more than one place, or too long to inline',
        },
        {
          label: 'Should a caller be able to set it?',
          detail: 'Different per environment, or per module consumer',
          tone: 'accent',
        },
        {
          label: 'Yes: declare a variable',
          detail: 'With a type, a description, and maybe validation',
          arrowLabel: 'it is an input',
        },
        {
          label: 'No: declare a local',
          detail: 'Derived from variables, resources or other locals',
          arrowLabel: 'it is derived',
          tone: 'success',
          branch: {
            label: 'A local that just wraps one variable',
            detail: 'Usually redundant - reference the variable directly',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Type constraints',
      purpose: 'Every type Terraform understands, and the distinguishing property of each.',
      fields: [
        {
          path: 'string, number, bool',
          meaning: 'Primitives. Converted between each other where unambiguous.',
        },
        { path: 'list(T)', meaning: 'Ordered, indexable, duplicates allowed.', required: true },
        { path: 'set(T)', meaning: 'Unordered, de-duplicated, NOT indexable.', required: true },
        {
          path: 'map(T)',
          meaning: 'String keys to values of one type. Lexical iteration order.',
          required: true,
        },
        {
          path: 'object({a = string})',
          meaning: 'Named attributes with declared types. Use optional() for defaults.',
        },
        { path: 'tuple([string, number])', meaning: 'Fixed length, position-typed.' },
        { path: 'any', meaning: 'No constraint. Avoid - it defers errors to apply time.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'One naming convention, defined once',
    story: [
      'A configuration built resource names inline: `"${var.project}-${var.environment}-web"` in eleven places. When the convention changed to include the region, ten of the eleven were updated.',
      'The eleventh created a security group with the old name. Nothing broke immediately, because the name was only used for identification - it was found three months later during a tagging audit.',
      'Hoisting the prefix into a single local turned eleven edits into one, and made the convention visible at the top of the file rather than implied by repetition.',
      'This is the everyday value of locals: not cleverness, but having exactly one place where a decision lives.',
    ],
    code: [
      {
        title: 'One place for the convention',
        language: 'hcl',
        code: `locals {
  # The naming convention, defined exactly once.
  name_prefix = "\${var.project}-\${var.environment}-\${var.region}"

  # Tags every resource should carry.
  common_tags = merge(var.extra_tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

resource "aws_security_group" "web" {
  name = "\${local.name_prefix}-web"
  tags = local.common_tags
}

resource "aws_s3_bucket" "logs" {
  bucket = "\${local.name_prefix}-logs"
  tags   = local.common_tags
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Every complex type, declared',
      language: 'hcl',
      explanation:
        'Note `optional()` in the object type: it gives an attribute a default so callers need not supply it.',
      code: `variable "availability_zones" {
  description = "AZs to use, in order."
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
}

variable "allowed_cidrs" {
  description = "CIDRs allowed inbound. Order is irrelevant."
  type        = set(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12"]
}

variable "instance_sizes" {
  description = "Instance type per role."
  type        = map(string)
  default = {
    web    = "t3.micro"
    worker = "t3.small"
  }
}

variable "database" {
  description = "Database configuration."
  type = object({
    engine         = string
    version        = string
    instance_class = string
    # optional() supplies a default so callers may omit it.
    multi_az       = optional(bool, false)
    backup_days    = optional(number, 7)
  })
}

# The pattern that makes for_each clean: named entries, each an object.
variable "subnets" {
  description = "Subnet definitions, keyed by name."
  type = map(object({
    cidr   = string
    az     = string
    public = optional(bool, false)
  }))
  default = {}
}`,
    },
    {
      title: 'Locals doing real work',
      language: 'hcl',
      explanation:
        'Locals may reference other locals, so a complex derivation can be built in readable steps rather than one unreadable expression.',
      code: `locals {
  name_prefix = "\${var.project}-\${var.environment}"

  # Locals may reference other locals.
  bucket_name = "\${local.name_prefix}-artifacts"

  # A set from a list: duplicates and order discarded.
  unique_azs = toset(var.availability_zones)

  # Derive a map from a list, ready for for_each.
  subnet_cidrs = {
    for index, az in var.availability_zones :
    az => cidrsubnet(var.vpc_cidr, 8, index)
  }

  # Conditional derivation.
  instance_count = var.environment == "production" ? 6 : 2

  # Flatten a nested structure into something iterable.
  all_rules = flatten([
    for name, group in var.security_groups : [
      for rule in group.rules : {
        key       = "\${name}-\${rule.port}"
        group     = name
        port      = rule.port
        cidr      = rule.cidr
      }
    ]
  ])
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform console',
      what: 'The fastest way to understand a type. Evaluate any local or expression interactively.',
      namespaceNote: 'Try `local.subnet_cidrs`, then `type(local.subnet_cidrs)`.',
    },
    {
      command: 'echo \'type(toset(["a","a","b"]))\' | terraform console',
      what: 'Confirms a conversion produced the type you expected.',
      expected: 'set(string)',
    },
    {
      command: 'echo \'toset(["b","a","a"])\' | terraform console',
      what: 'Demonstrates de-duplication and loss of order.',
      expected: 'toset(["a", "b"])',
    },
    {
      command: 'terraform validate',
      what: 'Catches a value whose shape does not match its declared type.',
    },
  ],
  declarative: {
    steps: [
      'Declare a type on every variable. `any` defers errors to apply time.',
      'Use `map(object({...}))` for anything you will iterate with `for_each`.',
      'Use `optional(type, default)` inside an object rather than making the whole variable optional.',
      'Put derived values in `locals`, inputs in `variable`.',
      'Check unfamiliar expressions in `terraform console` before committing them.',
    ],
    code: [
      {
        title: 'The list-versus-set trap',
        language: 'hcl',
        explanation:
          'With a list, removing an early element renumbers everything after it and Terraform recreates those resources. A set keyed by a stable name does not have that problem.',
        code: `variable "users" {
  type    = list(string)
  default = ["alice", "bob", "carol"]
}

# FRAGILE: count is positional. Removing "alice" shifts bob to
# index 0 and carol to index 1, so BOTH are destroyed and recreated.
resource "aws_iam_user" "by_count" {
  count = length(var.users)
  name  = var.users[count.index]
}

# STABLE: for_each over a set keys each instance by its own name.
# Removing "alice" removes exactly one resource.
resource "aws_iam_user" "by_for_each" {
  for_each = toset(var.users)
  name     = each.value
}`,
      },
    ],
  },
  verification: [
    {
      command: "echo 'local.name_prefix' | terraform console",
      what: 'Confirms a derived value is what you intended.',
    },
    {
      command: "echo 'keys(local.subnet_cidrs)' | terraform console",
      what: 'Lists the keys of a derived map - the keys `for_each` will use.',
    },
    {
      command: 'terraform validate',
      what: 'Proves every value satisfies its declared type constraint.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports "Invalid index" - you indexed a set, which is not indexable. Convert with `tolist()` first.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Incorrect attribute value type" - the value does not match the declared object shape.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Attribute is required" on an object - add the attribute or make it `optional()`.',
    },
    {
      command: 'terraform validate',
      what: 'Reports a cycle among locals - one references another that references it back.',
    },
  ],
  commonMistakes: [
    'Writing `locals.name` instead of `local.name`. The block is plural, the reference is singular.',
    'Indexing a set. Sets have no order and no indexes; convert to a list first if you truly need one.',
    'Using `count` over a list of names. Removing an early element renumbers and recreates everything after it.',
    'Declaring `type = any` to avoid thinking about the shape. Errors then surface at apply time instead of plan time.',
    'Creating a local that simply aliases one variable. It adds a layer without adding meaning.',
    'Using a `tuple` where an `object` would be clearer. Positional types are hard to read six months later.',
  ],
  examTips: [
    'Collections hold one type: `list`, `set`, `map`. Structural types hold mixed types: `object`, `tuple`.',
    '`list` is ordered and indexable; `set` is unordered, de-duplicated and not indexable; `map` has string keys.',
    'The reference is `local.name`, singular, even though the block is `locals`.',
    'Locals cannot be overridden from outside the configuration - that is the difference from a variable.',
    '`optional(type, default)` inside an object type gives an attribute a default.',
    '`for_each` accepts a map or a set of strings, never a list.',
  ],
  summary: [
    '`variable` for inputs, `locals` for derived values.',
    'Collections are single-typed; objects and tuples are not.',
    'Sets are unordered and not indexable; maps iterate in lexical key order.',
    '`map(object({...}))` is the shape that makes `for_each` clean.',
    '`terraform console` is the fastest way to learn what an expression actually returns.',
  ],
  practice: [
    {
      id: 'tf-locals-p1',
      level: 'beginner',
      prompt: 'Name the three collection types and the property that distinguishes each.',
      answer:
        '`list(T)` is ordered and indexable with duplicates; `set(T)` is unordered and de-duplicated; `map(T)` has unique string keys.',
      explanation: 'The set-versus-list distinction is what makes `for_each` behave predictably.',
    },
    {
      id: 'tf-locals-p2',
      level: 'beginner',
      prompt: 'Is `locals.name_prefix` a valid reference?',
      answer: 'No. The block is `locals` but the reference is `local.name_prefix`, singular.',
      explanation: 'A small inconsistency in the language, and a reliably common typo.',
    },
    {
      id: 'tf-locals-p3',
      level: 'intermediate',
      prompt:
        'You have `type = list(string)` with three names and use `count`. You remove the first name. What happens, and how would you avoid it?',
      answer:
        'The remaining two shift down one index, so Terraform destroys and recreates both. Use `for_each = toset(var.names)` instead, which keys each instance by its own name.',
      explanation:
        'This is the single most valuable practical reason to prefer `for_each` over `count` for named things.',
    },
    {
      id: 'tf-locals-p4',
      level: 'advanced',
      prompt:
        'Why is `map(object({...}))` the recommended shape for configuration data you will iterate over?',
      answer:
        'Because the map key gives each instance a stable identity independent of order, so adding or removing entries affects only those entries. The object gives each entry a typed, self-documenting shape that Terraform validates at plan time.',
      explanation:
        'Together they give you both stable addressing under `for_each` and type checking - the two things a bare list of strings cannot provide.',
    },
  ],
  lab: {
    title: 'Feel the difference between list, set and map',
    scenario:
      'Use `terraform console` and a real resource to see de-duplication, ordering and the renumbering problem for yourself.',
    prerequisites: ['Terraform 1.5 or newer'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `list(string)` variable of three names, plus locals converting it to a set and to a map of name to length.',
      },
      {
        instruction:
          'Use `terraform console` to evaluate the variable, the set and the map, and to call `type()` on each.',
      },
      {
        instruction: 'In the console, try to index the set with `[0]`. Read the error.',
      },
      {
        instruction:
          'Create `local_file` resources twice: once with `count` over the list, once with `for_each` over the set. Apply.',
      },
      {
        instruction:
          'Remove the FIRST name from the variable and run a plan. Compare how many count-based and for_each-based resources are affected.',
        hint: 'This is the whole point of the lab.',
      },
      {
        instruction:
          'Add a duplicate name to the list and observe what the set does with it in the console.',
      },
      {
        instruction:
          'Add an `object` variable with an `optional()` attribute, omit it, and confirm the default is applied.',
      },
      { instruction: 'Destroy and clean up.' },
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

variable "names" {
  type    = list(string)
  default = ["alice", "bob", "carol"]
}

variable "settings" {
  type = object({
    tier     = string
    replicas = optional(number, 3)
    debug    = optional(bool, false)
  })
  default = { tier = "standard" }
}

locals {
  unique      = toset(var.names)
  by_length   = { for n in var.names : n => length(n) }
  description = "tier=\${var.settings.tier} replicas=\${var.settings.replicas}"
}

# Positional: fragile under removal.
resource "local_file" "by_count" {
  count    = length(var.names)
  filename = "\${path.module}/count-\${var.names[count.index]}.txt"
  content  = "\${var.names[count.index]}\\n"
}

# Keyed: stable under removal.
resource "local_file" "by_for_each" {
  for_each = local.unique
  filename = "\${path.module}/each-\${each.value}.txt"
  content  = "\${each.value}\\n"
}

output "settings_description" {
  value = local.description
}`,
      },
      {
        title: 'The console session and the plan comparison',
        language: 'bash',
        code: `terraform init

terraform console <<'EOF'
var.names
type(var.names)
local.unique
type(local.unique)
local.by_length
toset(["b", "a", "a"])
type(toset(["b", "a", "a"]))
tolist(local.unique)[0]
var.settings.replicas
EOF
# Note: local.unique[0] fails -
#   Error: Invalid index - this value does not have any indices.

terraform apply -auto-approve
terraform state list
# local_file.by_count[0..2]
# local_file.by_for_each["alice"], ["bob"], ["carol"]

# Now remove "alice" from the default and plan:
sed -i 's/\\["alice", "bob", "carol"\\]/["bob", "carol"]/' main.tf
terraform plan
# by_count:    3 changes - [0] and [1] are REPLACED, [2] destroyed
#              because bob moved 1 -> 0 and carol 2 -> 1
# by_for_each: 1 change  - only ["alice"] is destroyed

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | grep for_each',
        what: 'Shows the string keys `for_each` produced.',
        expected: 'local_file.by_for_each["bob"] etc.',
      },
      {
        command: 'terraform output -raw settings_description',
        what: 'Confirms the `optional()` default was applied.',
        expected: 'tier=standard replicas=3',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes files, state and cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-count-and-for-each', 'tf-expressions-and-functions', 'tf-input-variables'],
  docs: [
    {
      title: 'Local values',
      url: 'https://developer.hashicorp.com/terraform/language/values/locals',
    },
    {
      title: 'Type constraints',
      url: 'https://developer.hashicorp.com/terraform/language/expressions/type-constraints',
    },
  ],
}
