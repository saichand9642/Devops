import type { Topic } from '../../../types'

export const countAndForEach: Topic = {
  id: 'tf-count-and-for-each',
  title: 'count and for_each',
  domainId: 'tf-configuration',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 7,
  tags: ['count', 'for_each', 'each', 'count.index', 'objective-4e'],
  oneLiner:
    'The two ways to create many resources from one block, why for_each is usually right, and how to migrate between them.',
  explanation: [
    '`count = N` creates N instances addressed by number: `aws_instance.web[0]`, `[1]`, `[2]`. Inside the block, `count.index` is the position.',
    '`for_each = <map or set>` creates one instance per element, addressed by key: `aws_instance.web["api"]`. Inside the block, `each.key` and `each.value` are available.',
    'The practical difference is **identity**. With `count`, a resource’s identity is its position, so removing an early element renumbers everything after it and Terraform destroys and recreates those resources. With `for_each`, identity is the key, so removing one element affects exactly one resource.',
    'The rule of thumb: use `count` only for "how many of this identical thing" or an on/off switch. Use `for_each` whenever the instances are distinguishable.',
  ],
  whyItMatters: [
    'These meta-arguments appear throughout objective 4, and the count-renumbering problem is one of the most commonly examined gotchas.',
    'Choosing `count` for named things is the most expensive routine mistake in Terraform: it turns a one-line change into an unnecessary rebuild.',
    'Knowing how to migrate between them - with `terraform state mv` or a `moved` block - turns a scary refactor into a routine one.',
  ],
  howItWorks: [
    '`count` accepts a whole number. `count = 0` creates nothing, which is how conditional creation is expressed.',
    '`for_each` accepts a **map** or a **set of strings**. A list is rejected, because a list has no stable keys. Convert with `toset()`, or build a map.',
    'With `count`, the resource as a whole is a list: `aws_instance.web` is a list, `aws_instance.web[0]` one instance, `aws_instance.web[*].id` every id.',
    'With `for_each`, the resource as a whole is a map: `aws_instance.web` is a map, `aws_instance.web["api"]` one instance, `values(aws_instance.web)[*].id` every id.',
    '`count` and `for_each` cannot both appear on the same block.',
    'Neither may depend on a value unknown at plan time. Terraform must know how many instances there are before it can plan them, so `for_each` keys in particular must be known - the values may be unknown.',
    'Migrating from `count` to `for_each` changes every address, so state must be moved. A `moved` block in the configuration is the reviewable way to do it.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'count or for_each?',
      caption:
        'If the instances have names, use for_each. count is for identical copies and for on/off switches.',
      question: 'Are the instances distinguishable from one another?',
      branches: [
        {
          condition: 'yes - they have names or keys',
          result: 'for_each',
          detail: 'Stable identity; removing one affects only that one',
          tone: 'accent',
        },
        {
          condition: 'no - N identical copies',
          result: 'count',
          detail: 'Three interchangeable workers behind a load balancer',
        },
        {
          condition: 'create it only in some environments',
          result: 'count, set to 1 or 0',
          detail: 'count = var.env == "prod" ? 1 : 0 - the on/off switch',
        },
        {
          condition: 'you have a list of names',
          result: 'for_each = toset(names)',
          detail: 'Not count over the list - that renumbers on removal',
          tone: 'warning',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'What happens when you remove the first element',
      caption:
        'This single behaviour is why for_each is the default recommendation. The count version rebuilds two resources to delete one.',
      nodes: [
        {
          label: 'Three resources exist',
          detail: 'count: [0]=alice [1]=bob [2]=carol',
        },
        {
          label: 'You remove "alice" from the list',
          detail: 'A one-line change in your intent',
          tone: 'accent',
        },
        {
          label: 'With count: positions shift',
          detail: '[0] becomes bob, [1] becomes carol, [2] disappears',
          arrowLabel: 'identity is the index',
          branch: {
            label: 'Result: 2 replaced, 1 destroyed',
            detail: 'Terraform rebuilds bob and carol for no reason',
          },
        },
        {
          label: 'With for_each: keys are unchanged',
          detail: '["bob"] and ["carol"] keep their addresses',
          arrowLabel: 'identity is the key',
        },
        {
          label: 'Result: exactly 1 destroyed',
          detail: 'What you actually asked for',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'count and for_each',
      purpose: 'The repetition meta-arguments, and what each exposes inside the block.',
      fields: [
        {
          path: 'count = N',
          meaning: 'N instances, indexed 0..N-1. `count = 0` creates nothing.',
          required: true,
        },
        { path: 'count.index', meaning: 'The zero-based position, available inside the block.' },
        {
          path: 'for_each = map | set',
          meaning: 'One instance per element. A list is rejected.',
          required: true,
        },
        { path: 'each.key', meaning: 'The map key, or the set element.' },
        { path: 'each.value', meaning: 'The map value. For a set, the same as each.key.' },
        { path: 'moved block', meaning: 'Declares an address change so state follows a refactor.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Deleting one user rebuilt two others',
    story: [
      'A configuration created IAM users with `count = length(var.usernames)` over a list of five names. Someone left the company, so their name was removed from the middle of the list.',
      'The plan showed three resources to replace and one to destroy. Removing one user meant deleting and recreating the two users after them in the list, because their indexes had shifted.',
      'For IAM users that meant new access keys - which broke two CI pipelines that had those keys configured. Nobody expected removing a person to rotate someone else’s credentials.',
      'The migration to `for_each = toset(var.usernames)` took an afternoon of `terraform state mv`, and the problem never recurred. Modern Terraform makes it easier still: a `moved` block does the same thing as a reviewable code change.',
    ],
    code: [
      {
        title: 'Migrating with a moved block',
        language: 'hcl',
        code: `# Before: count over a list
# resource "aws_iam_user" "team" {
#   count = length(var.usernames)
#   name  = var.usernames[count.index]
# }

# After: for_each over a set
resource "aws_iam_user" "team" {
  for_each = toset(var.usernames)
  name     = each.value
}

# One moved block per existing instance tells Terraform the
# address changed, so it updates state instead of destroying
# and recreating. Reviewable, and no manual state commands.
moved {
  from = aws_iam_user.team[0]
  to   = aws_iam_user.team["alice"]
}

moved {
  from = aws_iam_user.team[1]
  to   = aws_iam_user.team["bob"]
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'count, for_each and the conditional switch',
      language: 'hcl',
      explanation:
        'The third block is the standard idiom for "create this only in production" - `count` as a boolean.',
      code: `# count: N interchangeable copies.
resource "aws_instance" "worker" {
  count = var.worker_count

  ami           = var.ami_id
  instance_type = "t3.small"

  tags = {
    Name = "worker-\${count.index}"
  }
}

# for_each over a set: one per name, stable identity.
resource "aws_iam_user" "team" {
  for_each = toset(var.usernames)
  name     = each.value
}

# for_each over a map of objects: the richest and most common form.
resource "aws_subnet" "this" {
  for_each = var.subnets

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = {
    Name = "subnet-\${each.key}"
    Tier = each.value.public ? "public" : "private"
  }
}

# count as a switch: 1 or 0.
resource "aws_cloudwatch_dashboard" "prod_only" {
  count = var.environment == "production" ? 1 : 0

  dashboard_name = "production-overview"
  dashboard_body = jsonencode(local.dashboard)
}

# Referencing a conditionally-created resource safely.
output "dashboard_arn" {
  # one() returns the single element or null if the list is empty.
  value = one(aws_cloudwatch_dashboard.prod_only[*].dashboard_arn)
}`,
    },
    {
      title: 'Referencing instances of each kind',
      language: 'hcl',
      explanation:
        'The addressing forms are not interchangeable: `count` gives you a list, `for_each` gives you a map.',
      code: `# --- count: the resource is a LIST
output "worker_ids" {
  value = aws_instance.worker[*].id          # every id
}

output "first_worker" {
  value = aws_instance.worker[0].private_ip  # by index
}

# --- for_each: the resource is a MAP
output "subnet_ids_by_name" {
  value = { for k, s in aws_subnet.this : k => s.id }
}

output "all_subnet_ids" {
  value = values(aws_subnet.this)[*].id      # every id
}

output "one_subnet" {
  value = aws_subnet.this["private-a"].id    # by key
}

# Chaining for_each from another for_each keeps keys aligned.
resource "aws_route_table_association" "this" {
  for_each = aws_subnet.this

  subnet_id      = each.value.id
  route_table_id = aws_route_table.main.id
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform state list',
      what: 'Shows the addressing form in use - numeric indexes or string keys.',
      expected: 'aws_subnet.this["private-a"] for for_each',
    },
    {
      command: "terraform state mv 'aws_iam_user.team[0]' 'aws_iam_user.team[\"alice\"]'",
      what: 'Moves one instance to a new address during a count-to-for_each migration.',
      namespaceNote:
        'A `moved` block in the configuration is preferable - it is reviewable and repeatable.',
    },
    {
      command: 'terraform plan -target=\'aws_subnet.this["private-a"]\'',
      what: 'Targets one keyed instance. Note the quoting required in most shells.',
    },
    {
      command: "echo 'keys(var.subnets)' | terraform console",
      what: 'Confirms the keys `for_each` will produce before you apply.',
    },
  ],
  declarative: {
    steps: [
      'Default to `for_each`. Use `count` only for identical copies or as an on/off switch.',
      'Never use `count` over a list of names.',
      'Pass a map or `toset()` to `for_each` - a list is rejected.',
      'Use `moved` blocks rather than manual `state mv` when addresses change.',
      'Wrap references to conditionally-created resources in `one()` so an absent resource is `null` rather than an index error.',
    ],
    code: [
      {
        title: 'Keys must be known at plan time',
        language: 'hcl',
        explanation:
          'Terraform must know how many instances exist in order to plan them. Values may be unknown; keys may not.',
        code: `# FAILS: the key depends on a value that does not exist until apply.
# resource "aws_route53_record" "bad" {
#   for_each = { (aws_instance.web.private_ip) = "web" }
#   ...
# }
# Error: Invalid for_each argument - the "for_each" map includes
# keys derived from resource attributes that cannot be determined
# until apply.

# WORKS: keys come from a variable, values from the resource.
resource "aws_route53_record" "good" {
  for_each = var.record_names   # known at plan time

  zone_id = var.zone_id
  name    = each.key
  type    = "A"
  ttl     = 300
  # The VALUE may be unknown at plan time. Only keys must be known.
  records = [aws_instance.web[each.value].private_ip]
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state list | grep aws_subnet',
      what: 'Confirms each instance is keyed as you expected.',
    },
    {
      command: 'terraform plan',
      what: 'After a `moved` block, the plan should report moves and no replacements.',
      expected: 'Terraform will perform the following actions: ... has moved to ...',
    },
    {
      command: "echo 'length(aws_subnet.this)' | terraform console",
      what: 'Counts the instances actually created.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports "Invalid for_each argument" - a list was passed. Use `toset()` or build a map.',
    },
    {
      command: 'terraform plan',
      what: 'Reports for_each keys cannot be determined until apply - the keys depend on a resource attribute.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Invalid index" - `[0]` used on a `for_each` resource, or a key that does not exist.',
    },
    {
      command: 'terraform plan',
      what: 'Proposes replacing resources you did not touch - almost always `count` renumbering.',
    },
  ],
  commonMistakes: [
    'Using `count` over a list of names. Removing one element renumbers and rebuilds the rest.',
    'Passing a list to `for_each`. It requires a map or a set of strings.',
    'Building `for_each` keys from resource attributes. Keys must be known at plan time; values need not be.',
    'Indexing a `for_each` resource with `[0]`, or a `count` resource with a string key.',
    'Setting both `count` and `for_each` on one block. Only one is allowed.',
    'Migrating from `count` to `for_each` without `moved` blocks or `state mv`, and destroying everything as a result.',
    'Referencing `aws_x.y[0]` on a `count = 0 ? 1 : 0` resource without `one()`, which errors when the count is zero.',
  ],
  examTips: [
    '`for_each` accepts a map or a set of strings. Never a list.',
    '`count` exposes `count.index`; `for_each` exposes `each.key` and `each.value`.',
    'A `count` resource is addressed `name[0]`; a `for_each` resource is addressed `name["key"]`.',
    '`count = 0` creates nothing - the standard conditional-creation idiom.',
    'A block may use `count` or `for_each`, never both.',
    '`for_each` keys must be known at plan time; the values may be unknown.',
    'Removing an element with `count` renumbers and recreates; with `for_each` it does not.',
  ],
  summary: [
    '`for_each` keys instances by name; `count` indexes them by position.',
    'Positional identity is why `count` rebuilds resources when a list shrinks.',
    'Use `count` for identical copies and as an on/off switch; `for_each` for everything else.',
    '`for_each` needs a map or set, and its keys must be known at plan time.',
    'Use `moved` blocks to change addresses without destroying anything.',
  ],
  practice: [
    {
      id: 'tf-foreach-p1',
      level: 'beginner',
      prompt: 'Which types does `for_each` accept, and which does it reject?',
      answer: 'It accepts a map or a set of strings. It rejects a list.',
      explanation:
        'A list has no stable keys, which is exactly the property `for_each` relies on. `toset()` is the usual conversion.',
    },
    {
      id: 'tf-foreach-p2',
      level: 'beginner',
      prompt: 'How do you create a resource only in production?',
      answer: '`count = var.environment == "production" ? 1 : 0`',
      explanation:
        'And reference it with `one(aws_x.y[*].attr)` so the expression yields `null` rather than erroring when the count is zero.',
    },
    {
      id: 'tf-foreach-p3',
      level: 'intermediate',
      prompt:
        'A configuration uses `count = length(var.names)`. You remove the second of four names. What does the plan show and why?',
      answer:
        'Two replacements and one destroy. The third and fourth names shift down to indexes 1 and 2, and since identity under `count` is the index, Terraform treats them as different resources.',
      explanation:
        'This is the canonical `count` gotcha, and the strongest practical argument for `for_each`.',
    },
    {
      id: 'tf-foreach-p4',
      level: 'advanced',
      prompt: 'Why must `for_each` keys be known at plan time when values need not be?',
      answer:
        'Because the keys determine the resource addresses, and Terraform must know how many instances exist and what they are called in order to produce a plan at all. Values are just arguments, so they can be resolved during apply and shown as unknown until then.',
      explanation:
        'The practical consequence: derive keys from variables, locals or data sources, and only take values from resources being created in the same run.',
    },
  ],
  lab: {
    title: 'Migrate count to for_each without destroying anything',
    scenario:
      'Create resources with `count`, feel the renumbering problem, then migrate to `for_each` using `moved` blocks and confirm nothing is rebuilt.',
    prerequisites: ['Terraform 1.5 or newer (moved blocks need 1.1+)'],
    tasks: [
      {
        instruction:
          'Create three `local_file` resources with `count` over a list of three names, and apply.',
      },
      { instruction: 'Run `terraform state list` and note the numeric addresses.' },
      {
        instruction:
          'Remove the FIRST name from the list and run a plan. Record how many resources are replaced versus destroyed.',
      },
      { instruction: 'Restore the name and re-apply so you are back to three.' },
      {
        instruction:
          'Rewrite the resource to use `for_each = toset(var.names)`, and run a plan WITHOUT moved blocks. Note the destruction.',
      },
      {
        instruction:
          'Add one `moved` block per instance mapping the old index to the new key, then plan again.',
        hint: 'The plan should report moves and zero changes.',
      },
      {
        instruction:
          'Apply, then confirm the state addresses are now keyed and the files were never touched.',
      },
      {
        instruction:
          'Now remove the first name again and plan. Confirm exactly one resource is destroyed.',
      },
      { instruction: 'Destroy and clean up.' },
    ],
    solution: [
      {
        title: 'Step 1: the count version',
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

resource "local_file" "user" {
  count    = length(var.names)
  filename = "\${path.module}/\${var.names[count.index]}.txt"
  content  = "\${var.names[count.index]}\\n"
}`,
      },
      {
        title: 'Step 5-6: for_each plus moved blocks',
        language: 'hcl',
        code: `resource "local_file" "user" {
  for_each = toset(var.names)
  filename = "\${path.module}/\${each.value}.txt"
  content  = "\${each.value}\\n"
}

# One per existing instance. Order in the file does not matter.
moved {
  from = local_file.user[0]
  to   = local_file.user["alice"]
}

moved {
  from = local_file.user[1]
  to   = local_file.user["bob"]
}

moved {
  from = local_file.user[2]
  to   = local_file.user["carol"]
}`,
      },
      {
        title: 'The whole migration',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve
terraform state list
# local_file.user[0]
# local_file.user[1]
# local_file.user[2]

# Feel the renumbering problem:
sed -i 's/\\["alice", "bob", "carol"\\]/["bob", "carol"]/' main.tf
terraform plan
# Plan: 2 to add, 0 to change, 3 to destroy.
# Removing ONE name rebuilds the other two.

# Restore and re-apply:
sed -i 's/\\["bob", "carol"\\]/["alice", "bob", "carol"]/' main.tf
terraform apply -auto-approve

# Switch to for_each WITHOUT moved blocks:
terraform plan
# Plan: 3 to add, 0 to change, 3 to destroy.
# Every address changed, so Terraform sees six different resources.

# Add the moved blocks, then:
terraform plan
#   local_file.user[0] has moved to local_file.user["alice"]
#   ...
# Plan: 0 to add, 0 to change, 0 to destroy.

terraform apply -auto-approve
terraform state list
# local_file.user["alice"]
# local_file.user["bob"]
# local_file.user["carol"]

# Now removal behaves sensibly:
sed -i 's/\\["alice", "bob", "carol"\\]/["bob", "carol"]/' main.tf
terraform plan
# Plan: 0 to add, 0 to change, 1 to destroy.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: "terraform state list | grep -c '\\[\"'",
        what: 'Counts keyed instances - non-zero once the migration is done.',
      },
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'After applying the moved blocks, the plan should be clean.',
        expected: 'exit=0',
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
  relatedTopicIds: [
    'tf-locals-and-complex-types',
    'tf-expressions-and-functions',
    'tf-drift-and-state-commands',
  ],
  docs: [
    {
      title: 'The count meta-argument',
      url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/count',
    },
    {
      title: 'The for_each meta-argument',
      url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/for_each',
    },
  ],
}
