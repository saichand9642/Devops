import type { Topic } from '../../../types'

export const expressionsAndFunctions: Topic = {
  id: 'tf-expressions-and-functions',
  title: 'Expressions and built-in functions',
  domainId: 'tf-configuration',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 6,
  tags: ['expressions', 'functions', 'for', 'conditional', 'splat', 'templatefile', 'objective-4e'],
  oneLiner:
    'Conditionals, for-expressions, splats and the functions you will actually use - plus the fastest way to test them.',
  explanation: [
    'Terraform’s expression language is small but complete: string interpolation, arithmetic and comparison operators, a ternary conditional, `for` expressions that transform collections, splat expressions, and around 150 built-in functions.',
    'There are no user-defined functions and no loops in the imperative sense. Repetition happens through `for` expressions (which transform values) and `count`/`for_each` (which repeat resources) - two different mechanisms that are easy to confuse.',
    'The single most useful tool for learning any of this is `terraform console`. It evaluates expressions against real state, so you can test an idea in seconds rather than by running a plan.',
    'Functions are pure: same input, same output, no side effects. There is no function that makes an API call or reads the clock in a way that would break plan determinism - `timestamp()` is the notable exception, and it is why it should not be used in resource arguments.',
  ],
  whyItMatters: [
    'Objective 4e is writing dynamic configuration using expressions and functions. Expect questions about specific function behaviour and about `for` expression syntax.',
    'Most of the difference between a repetitive configuration and a concise one is fluency with `for` expressions and a handful of functions.',
    'Knowing that functions are pure explains why `timestamp()` in a resource argument produces an endless diff.',
  ],
  howItWorks: [
    '**Interpolation.** `"prefix-\\${var.name}"` embeds an expression in a string. `\\${` and `%{` are escaped by doubling: `$\\${literal}`.',
    '**Conditional.** `condition ? if_true : if_false`. Both branches must produce a compatible type, and both are evaluated for type-checking even though only one result is used.',
    '**for expression, list form.** `[for x in collection : expr]` produces a list. Add `if` to filter: `[for x in list : x if x != ""]`.',
    '**for expression, map form.** `{for k, v in map : k => expr}` produces a map. Over a list, `for i, x in list` gives index and value.',
    '**Splat.** `aws_instance.web[*].id` is shorthand for `[for i in aws_instance.web : i.id]`. It works on lists and on resources with `count` or `for_each`.',
    '**Dynamic membership** with `contains`, `keys`, `values`, `lookup`, `try`, `coalesce`, and `can` for testing whether an expression would error.',
    '**Templates.** `templatefile(path, vars)` renders an external file with `\\${}` substitution and `%{for}`/`%{if}` directives - the right way to generate user-data or config files.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which construct do I need?',
      caption:
        'The commonest confusion is between a for expression, which transforms a value, and for_each, which repeats a resource.',
      question: 'What are you trying to produce?',
      branches: [
        {
          condition: 'a transformed list or map',
          result: 'for expression',
          detail: '[for x in xs : upper(x)] or {for k, v in m : k => v.id}',
          tone: 'accent',
        },
        {
          condition: 'many copies of a resource',
          result: 'for_each or count',
          detail: 'A meta-argument on the resource, not an expression',
        },
        {
          condition: 'one attribute from every instance',
          result: 'splat',
          detail: 'aws_instance.web[*].id',
        },
        {
          condition: 'one of two values',
          result: 'conditional',
          detail: 'var.env == "prod" ? 6 : 2',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Testing an expression before you commit it',
      caption:
        'Two minutes in the console saves ten in a plan. This is the single best habit for learning the language.',
      nodes: [
        {
          label: 'terraform console',
          detail: 'Loads variables, locals, state and data sources',
          tone: 'accent',
        },
        {
          label: 'Evaluate the expression',
          detail: 'Paste it in exactly as it would appear in a file',
        },
        {
          label: 'Check the type as well as the value',
          detail: 'type(expr) - a list and a set behave very differently',
          arrowLabel: 'not just the value',
        },
        {
          label: 'Iterate until it is right',
          detail: 'No plan, no apply, no waiting',
          branch: {
            label: 'It errors',
            detail: 'The message is the same one a plan would give you, immediately',
          },
        },
        {
          label: 'Paste it into the configuration',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Functions worth knowing by name',
      purpose: 'The subset that covers most real configurations, grouped by what they are for.',
      fields: [
        {
          path: 'Collections',
          meaning:
            'length, concat, merge, flatten, distinct, compact, contains, keys, values, lookup, zipmap, element, slice, toset, tolist, tomap, one',
        },
        {
          path: 'Strings',
          meaning:
            'format, join, split, replace, lower, upper, title, trimspace, substr, startswith, endswith, regex, regexall',
        },
        { path: 'Numeric', meaning: 'min, max, abs, ceil, floor, sum, range' },
        {
          path: 'Encoding',
          meaning: 'jsonencode, jsondecode, yamlencode, yamldecode, base64encode, base64decode',
        },
        {
          path: 'Filesystem',
          meaning: 'file, fileexists, templatefile, abspath, dirname, basename',
        },
        { path: 'Network', meaning: 'cidrsubnet, cidrhost, cidrnetmask' },
        { path: 'Safety', meaning: 'try, can, coalesce, nonsensitive, sensitive', required: true },
      ],
    },
  ],
  realWorldExample: {
    title: 'The timestamp that never stopped changing',
    story: [
      'Someone added `tags = { LastApplied = timestamp() }` to a resource, wanting to know when it was last touched.',
      'Every plan thereafter showed a change on that resource, because `timestamp()` returns the current time each time it is evaluated. The plan was never clean, so nobody could tell a real change from the noise.',
      'Worse, because the tag changed on every apply, any resource whose replacement depended on it churned too. CI never reported "no changes", so the drift-detection job became useless.',
      'The correct approach is either to let the provider record it - most clouds have a modification timestamp already - or to pass a build identifier in as a variable, which is stable within a run and changes only when the build does.',
    ],
    code: [
      {
        title: 'The fix',
        language: 'hcl',
        code: `# WRONG: changes on every single plan.
# tags = { LastApplied = timestamp() }

variable "build_id" {
  description = "CI build identifier, e.g. the commit SHA."
  type        = string
  default     = "local"
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "acme-artifacts"

  tags = {
    # Stable within a run; changes only when the build does.
    BuildId = var.build_id
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'for expressions, in every form',
      language: 'hcl',
      explanation:
        'Note the difference between `[...]` producing a list and `{... => ...}` producing a map. That bracket is the whole distinction.',
      code: `variable "users" {
  type = list(object({
    name  = string
    admin = bool
  }))
  default = [
    { name = "alice", admin = true },
    { name = "bob", admin = false },
    { name = "carol", admin = true },
  ]
}

locals {
  # List form: transform each element.
  upper_names = [for u in var.users : upper(u.name)]
  # ["ALICE", "BOB", "CAROL"]

  # List form with a filter.
  admins = [for u in var.users : u.name if u.admin]
  # ["alice", "carol"]

  # Map form: build a lookup table.
  is_admin = { for u in var.users : u.name => u.admin }
  # { alice = true, bob = false, carol = true }

  # Index and value from a list.
  numbered = { for i, u in var.users : u.name => i }
  # { alice = 0, bob = 1, carol = 2 }

  # Grouping with ellipsis: several values per key.
  by_role = { for u in var.users : (u.admin ? "admin" : "user") => u.name... }
  # { admin = ["alice", "carol"], user = ["bob"] }

  # Nested, then flattened - a very common shape.
  pairs = flatten([
    for u in var.users : [
      for suffix in ["read", "write"] : "\${u.name}-\${suffix}"
    ]
  ])
}`,
    },
    {
      title: 'Functions doing useful work',
      language: 'hcl',
      explanation:
        '`try` and `coalesce` are the two that most improve robustness: they turn a missing value into a default rather than an error.',
      code: `locals {
  # Subnet CIDRs derived from one VPC CIDR - no arithmetic by hand.
  subnet_cidrs = [
    for i in range(3) : cidrsubnet(var.vpc_cidr, 8, i)
  ]
  # 10.0.0.0/16 -> ["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"]

  # Merge with later maps winning.
  tags = merge(
    { ManagedBy = "terraform" },
    var.default_tags,
    var.resource_tags,
  )

  # First non-null, non-empty value.
  region = coalesce(var.region, var.default_region, "eu-west-1")

  # try() swallows an error and falls back.
  bucket = try(var.config.bucket, "acme-default")

  # can() tests whether an expression would succeed.
  has_valid_cidr = can(cidrnetmask(var.cidr))

  # Read structured data from a file.
  settings = yamldecode(file("\${path.module}/settings.yaml"))

  # Produce JSON for a provider that wants a policy document.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "\${aws_s3_bucket.data.arn}/*"
    }]
  })
}

# templatefile renders an external file - the right way to build
# user-data rather than a giant heredoc inline.
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = "t3.micro"

  user_data = templatefile("\${path.module}/templates/init.sh.tftpl", {
    hostname = "web-01"
    packages = ["nginx", "curl"]
  })
}`,
    },
    {
      title: 'A template file',
      language: 'bash',
      explanation:
        'The `%{for}` and `%{if}` directives are template-only syntax. `~` trims the surrounding whitespace so the output stays tidy.',
      code: `#!/usr/bin/env bash
# templates/init.sh.tftpl
set -euo pipefail

hostnamectl set-hostname "\${hostname}"

%{ for pkg in packages ~}
apt-get install -y \${pkg}
%{ endfor ~}

%{ if length(packages) > 0 ~}
echo "installed \${length(packages)} packages"
%{ endif ~}`,
    },
  ],
  imperative: [
    {
      command: 'terraform console',
      what: 'Interactive expression evaluation against real variables, locals and state.',
      namespaceNote: 'Ctrl-D to exit. Accepts piped input, which makes it scriptable.',
    },
    {
      command: 'echo \'cidrsubnet("10.0.0.0/16", 8, 3)\' | terraform console',
      what: 'Tests one function without opening the REPL.',
      expected: '"10.0.3.0/24"',
    },
    {
      command: "echo '[for u in var.users : u.name if u.admin]' | terraform console",
      what: 'Checks a for expression against the real variable values.',
    },
    {
      command: "echo 'type(local.subnet_cidrs)' | terraform console",
      what: 'Reveals the type, which matters more than the value for `for_each`.',
    },
    {
      command: 'terraform console -plan',
      what: 'Evaluates against a fresh plan, so values from not-yet-created resources are available as unknown.',
    },
  ],
  declarative: {
    steps: [
      'Test every non-obvious expression in `terraform console` before committing it.',
      'Use `for` expressions to transform values and `for_each` to repeat resources - never confuse the two.',
      'Prefer `try` and `coalesce` over deeply nested conditionals.',
      'Put anything longer than a line or two into a `local` with a descriptive name.',
      'Never call `timestamp()` or `uuid()` in a resource argument.',
    ],
    code: [
      {
        title: 'Making an expression readable',
        language: 'hcl',
        explanation:
          'The second form does exactly the same work. The difference is that a colleague can review it.',
        code: `# Unreadable: correct, and nobody will ever touch it again.
# resource "aws_subnet" "this" {
#   for_each = { for i, az in data.aws_availability_zones.available.names :
#                az => cidrsubnet(var.vpc_cidr, 8, i) if i < var.subnet_count }
#   ...
# }

# Readable: the same logic, built in named steps.
locals {
  available_azs = data.aws_availability_zones.available.names
  chosen_azs    = slice(local.available_azs, 0, var.subnet_count)

  subnets = {
    for index, az in local.chosen_azs :
    az => {
      cidr = cidrsubnet(var.vpc_cidr, 8, index)
      az   = az
    }
  }
}

resource "aws_subnet" "this" {
  for_each = local.subnets

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = { Name = "subnet-\${each.key}" }
}`,
      },
    ],
  },
  verification: [
    {
      command: "echo 'local.subnets' | terraform console",
      what: 'Dumps a derived structure so you can confirm its shape.',
    },
    {
      command: "echo 'keys(local.subnets)' | terraform console",
      what: 'The exact keys `for_each` will use, which become part of resource addresses.',
    },
    {
      command: 'terraform validate',
      what: 'Catches a type mismatch in a conditional, where the branches disagree.',
    },
  ],
  troubleshooting: [
    {
      command: "echo '<your expression>' | terraform console",
      what: 'Reproduces a plan-time expression error immediately, with the same message.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Inconsistent conditional result types" - the two branches produce different types.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Invalid for_each argument" - you passed a list; convert with `toset()` or build a map.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Call to function \\"lookup\\" failed" - use `try()` or supply the third default argument.',
    },
  ],
  commonMistakes: [
    'Confusing a `for` expression with `for_each`. The first transforms a value; the second repeats a resource.',
    'Producing a list where `for_each` needs a map or set. `[for ...]` gives a list; wrap it in `toset()` or use the map form.',
    'Calling `timestamp()` or `uuid()` in a resource argument. Every plan then shows a change.',
    'Writing a conditional whose branches have different types. Both are type-checked even though only one is used.',
    'Nesting three conditionals instead of using `coalesce` or `try`.',
    'Forgetting `flatten` after a nested `for`, and passing a list of lists where a flat list is expected.',
  ],
  examTips: [
    '`[for x in xs : e]` produces a list; `{for k, v in m : k => e}` produces a map. The bracket decides.',
    'Add `if` at the end of a `for` expression to filter.',
    '`aws_instance.web[*].id` is a splat, equivalent to a `for` over every instance.',
    'The conditional is `cond ? a : b`, and `a` and `b` must have compatible types.',
    'Functions are pure and there are no user-defined functions.',
    '`templatefile` supports `%{for}` and `%{if}` directives; `~` trims whitespace.',
    '`try(a, b)` returns `b` if evaluating `a` errors; `can(a)` returns a boolean.',
  ],
  summary: [
    'Interpolation, conditionals, `for` expressions, splats and ~150 pure functions.',
    '`for` transforms values; `for_each` repeats resources.',
    '`terraform console` is the fastest way to learn and to debug an expression.',
    '`try` and `coalesce` handle missing values without nested conditionals.',
    'Never put `timestamp()` in a resource argument.',
  ],
  practice: [
    {
      id: 'tf-expr-p1',
      level: 'beginner',
      prompt:
        'Write a for expression producing a list of the names of users where `admin` is true.',
      answer: '`[for u in var.users : u.name if u.admin]`',
      explanation:
        'Square brackets give a list; the trailing `if` filters. Both are objective 4e material.',
    },
    {
      id: 'tf-expr-p2',
      level: 'beginner',
      prompt: 'What is `aws_instance.web[*].private_ip` equivalent to as a for expression?',
      answer: '`[for i in aws_instance.web : i.private_ip]`',
      explanation:
        'A splat is shorthand for exactly that. It works on lists and on resources created with `count` or `for_each`.',
    },
    {
      id: 'tf-expr-p3',
      level: 'intermediate',
      prompt:
        'Your `for` expression returns a list but `for_each` rejects it. What are the two ways to fix it?',
      answer:
        'Wrap it in `toset(...)` if the values are unique strings, or rewrite it in map form - `{for x in xs : x.name => x}` - so each instance is keyed by something stable.',
      explanation:
        'The map form is usually better: it gives each instance a meaningful key rather than relying on the value itself being unique.',
    },
    {
      id: 'tf-expr-p4',
      level: 'advanced',
      prompt: 'Why is `timestamp()` acceptable in an output but harmful in a resource argument?',
      answer:
        'Because it returns a different value on every evaluation. In an output it is merely noise; in a resource argument it makes the configuration differ from state on every plan, so Terraform proposes a change forever and any dependent replacement churns with it.',
      explanation:
        'The general rule: resource arguments must be deterministic functions of the configuration and its inputs, or the plan can never be clean.',
    },
  ],
  lab: {
    title: 'Live in terraform console for twenty minutes',
    scenario:
      'Build every expression form against a real variable, then use the results to drive actual resources.',
    prerequisites: ['Terraform 1.5 or newer'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `list(object({name, size, enabled}))` variable containing four entries.',
      },
      {
        instruction:
          'In `terraform console`, write a for expression producing a list of names, then one filtered to enabled entries only.',
      },
      {
        instruction:
          'Write a map form keyed by name whose value is the size, and check its `type()`.',
      },
      {
        instruction:
          'Use the grouping ellipsis form to group names by size, and confirm the values are lists.',
      },
      {
        instruction:
          'Test `cidrsubnet`, `merge`, `coalesce`, `try` and `can` in the console, including a case where `try` rescues an error.',
      },
      {
        instruction:
          'Create `local_file` resources with `for_each` over the map you built, and apply.',
      },
      {
        instruction:
          'Write a `templatefile` template that loops over the names, render it into a file, and read the result.',
      },
      {
        instruction:
          'Add `timestamp()` to a file’s content, apply twice, and observe the never-clean plan. Then remove it.',
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

variable "services" {
  type = list(object({
    name    = string
    size    = string
    enabled = bool
  }))
  default = [
    { name = "api", size = "small", enabled = true },
    { name = "web", size = "small", enabled = true },
    { name = "batch", size = "large", enabled = false },
    { name = "cron", size = "large", enabled = true },
  ]
}

locals {
  all_names     = [for s in var.services : s.name]
  enabled_names = [for s in var.services : s.name if s.enabled]
  size_by_name  = { for s in var.services : s.name => s.size }
  names_by_size = { for s in var.services : s.size => s.name... }

  enabled_map = { for s in var.services : s.name => s if s.enabled }
}

resource "local_file" "service" {
  for_each = local.enabled_map

  filename = "\${path.module}/svc-\${each.key}.txt"
  content  = "name=\${each.value.name} size=\${each.value.size}\\n"
}

resource "local_file" "inventory" {
  filename = "\${path.module}/inventory.txt"
  content = templatefile("\${path.module}/inventory.tftpl", {
    names = local.enabled_names
    sizes = local.names_by_size
  })
}`,
      },
      {
        title: 'inventory.tftpl',
        language: 'text',
        code: `Enabled services (\${length(names)}):
%{ for n in names ~}
  - \${n}
%{ endfor ~}

Grouped by size:
%{ for size, members in sizes ~}
  \${size}: \${join(", ", members)}
%{ endfor ~}`,
      },
      {
        title: 'The console session',
        language: 'bash',
        code: `terraform init

terraform console <<'EOF'
[for s in var.services : s.name]
[for s in var.services : s.name if s.enabled]
{ for s in var.services : s.name => s.size }
type({ for s in var.services : s.name => s.size })
{ for s in var.services : s.size => s.name... }
length(local.enabled_names)
cidrsubnet("10.0.0.0/16", 8, 5)
merge({a = 1}, {b = 2}, {a = 99})
coalesce(null, "", "fallback")
try(var.services[99].name, "no such service")
can(var.services[99].name)
join(", ", local.all_names)
EOF

terraform apply -auto-approve
cat inventory.txt
ls svc-*.txt          # three files: api, web, cron. Not batch.

# The timestamp trap:
#   add  content = "\${timestamp()}\\n"  to a new local_file, then
terraform apply -auto-approve
terraform plan         # 1 to change - every single time
# Remove it again.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | grep -c local_file.service',
        what: 'Confirms only enabled services produced a resource.',
        expected: '3',
      },
      {
        command: "echo 'keys(local.enabled_map)' | terraform console",
        what: 'The keys that became resource addresses.',
        expected: '["api", "cron", "web"]',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes generated files, state and cache.',
      },
    ],
  },
  relatedTopicIds: [
    'tf-locals-and-complex-types',
    'tf-count-and-for-each',
    'tf-dynamic-blocks-and-lifecycle',
  ],
  docs: [
    {
      title: 'Expressions',
      url: 'https://developer.hashicorp.com/terraform/language/expressions',
    },
    {
      title: 'Built-in functions',
      url: 'https://developer.hashicorp.com/terraform/language/functions',
    },
  ],
}
