import type { Topic } from '../../../types'

export const referencesAndDependencies: Topic = {
  id: 'tf-references-and-dependencies',
  title: 'References, attributes and dependencies',
  domainId: 'tf-configuration',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  order: 2,
  tags: ['references', 'attributes', 'depends_on', 'graph', 'objective-4b', 'objective-4f'],
  oneLiner: 'How one resource reads another, and how that reading becomes the dependency graph.',
  explanation: [
    'A **reference** reads a value from elsewhere: `aws_subnet.a.id`, `var.region`, `data.aws_ami.ubuntu.id`, `local.name_prefix`, `module.network.vpc_id`.',
    'Writing a reference does two things at once. It supplies a value, and it declares a **dependency** - Terraform records that this resource cannot be created until the referenced one exists.',
    'That is why ordering in Terraform is normally automatic. You do not sequence anything; you just use the values, and the graph falls out of the references.',
    '`depends_on` exists for the cases where a real ordering requirement produces no reference. It is the exception, and overusing it removes parallelism and hides the true structure of your configuration.',
  ],
  whyItMatters: [
    'Objective 4b is referring to resource attributes and creating cross-resource references; objective 4f is defining dependencies. This lesson covers both.',
    'Almost every "resource does not exist yet" error is a missing reference where someone hard-coded a value instead.',
    'Knowing when `depends_on` is genuinely required - and when it is a code smell - is the difference between a maintainable configuration and a brittle one.',
  ],
  howItWorks: [
    'The reference forms are: `<TYPE>.<NAME>.<ATTR>` for a resource, `data.<TYPE>.<NAME>.<ATTR>` for a data source, `var.<NAME>`, `local.<NAME>`, `module.<NAME>.<OUTPUT>`, and `each`/`count.index` inside a repeated block.',
    'Terraform builds a directed graph from every reference it finds, then walks it, running independent nodes in parallel.',
    'Attributes that only exist after creation show as `(known after apply)` during plan. Anything referencing them is unknown too - which is normal, not an error.',
    'For a resource using `count`, the address is indexed: `aws_instance.web[0].id`. With `for_each` it is keyed: `aws_instance.web["api"].id`. The whole collection is `aws_instance.web` and `aws_instance.web[*].id` gives every id.',
    '`depends_on` takes a list of addresses and adds graph edges without reading any value. It accepts resources and modules, never individual attributes.',
    'Terraform detects reference cycles and refuses to plan, naming the resources in the cycle.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'A reference becomes a graph edge',
      caption:
        'You never order anything explicitly. Using a value is how you declare that you need it to exist first.',
      nodes: [
        {
          label: 'aws_vpc.main is declared',
          detail: 'No dependencies of its own',
          tone: 'accent',
        },
        {
          label: 'aws_subnet.a references aws_vpc.main.id',
          detail: 'An edge is recorded: subnet depends on vpc',
          arrowLabel: 'the reference',
        },
        {
          label: 'aws_instance.web references aws_subnet.a.id',
          detail: 'A second edge, giving a three-node chain',
        },
        {
          label: 'Terraform walks the chain in order',
          detail: 'vpc, then subnet, then instance',
          tone: 'success',
        },
        {
          label: 'Destroy walks it in reverse',
          detail: 'instance, then subnet, then vpc',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Reference or depends_on?',
      caption:
        'If you can express it as a reference, do. depends_on is for ordering that no value expresses.',
      question: 'Does the dependent resource need a VALUE from the other one?',
      branches: [
        {
          condition: 'yes - an id, arn, name, endpoint',
          result: 'Use a reference',
          detail: 'Supplies the value and the ordering in one line',
          tone: 'accent',
        },
        {
          condition: 'no, but it must still exist first',
          result: 'depends_on',
          detail: 'An IAM policy that must be attached before an app starts',
        },
        {
          condition: 'you can restructure to reference something',
          result: 'Prefer the reference',
          detail: 'It stays correct through future refactoring',
        },
        {
          condition: 'you are adding it "to be safe"',
          result: 'Remove it',
          detail: 'It removes parallelism and hides the real structure',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Reference forms',
      purpose: 'Every way to read a value, and the address syntax for each.',
      fields: [
        { path: 'aws_instance.web.id', meaning: 'A managed resource attribute.', required: true },
        { path: 'data.aws_ami.ubuntu.id', meaning: 'A data source attribute - note the prefix.' },
        { path: 'var.region', meaning: 'An input variable.' },
        { path: 'local.name_prefix', meaning: 'A local value.' },
        {
          path: 'module.network.vpc_id',
          meaning: 'A module output. Only declared outputs are readable.',
        },
        { path: 'aws_instance.web[0].id', meaning: 'One instance of a count-based resource.' },
        {
          path: 'aws_instance.web["api"].id',
          meaning: 'One instance of a for_each-based resource.',
        },
        { path: 'aws_instance.web[*].id', meaning: 'A splat: every instance’s id, as a list.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The hard-coded VPC id',
    story: [
      'A configuration had `vpc_id = "vpc-0a1b2c3d"` copied from the console. It worked in the account it was written in.',
      'Deploying to a second account produced an error deep inside the AWS provider: the subnet could not be created because the VPC did not exist. The message named the VPC, not the mistake.',
      'Worse, because there was no reference, Terraform saw no dependency. It tried to create the subnet in parallel with the VPC rather than after it - so even in the original account the configuration only worked because the VPC already existed from an earlier run.',
      'Replacing the string with `aws_vpc.main.id` fixed the portability problem and the ordering problem in the same edit. That is the pattern: a hard-coded id is almost always a missing edge in the graph.',
    ],
    code: [
      {
        title: 'Two problems, one fix',
        language: 'hcl',
        code: `resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

# WRONG: no reference means no dependency AND no portability.
resource "aws_subnet" "bad" {
  vpc_id     = "vpc-0a1b2c3d"
  cidr_block = "10.0.1.0/24"
}

# RIGHT: the value and the ordering both come from the reference.
resource "aws_subnet" "good" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A chain of references',
      language: 'hcl',
      explanation:
        'Four resources, three references, and not a single explicit ordering instruction. Destroy reverses it automatically.',
      code: `resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "eu-west-1a"
}

resource "aws_security_group" "app" {
  name   = "app"
  vpc_id = aws_vpc.main.id
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.private.id
  vpc_security_group_ids = [aws_security_group.app.id]

  tags = {
    # References work inside strings via interpolation.
    Name = "web-\${aws_vpc.main.id}"
  }
}

output "private_ip" {
  value = aws_instance.web.private_ip
}`,
    },
    {
      title: 'The two legitimate uses of depends_on',
      language: 'hcl',
      explanation:
        'Both cases share one feature: nothing in the dependent block reads a value from the thing it must wait for.',
      code: `# 1. A permission that must exist before the workload runs,
#    but whose attributes the workload never reads.
resource "aws_iam_role_policy_attachment" "s3" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.s3_write.arn
}

resource "aws_instance" "worker" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.small"
  iam_instance_profile = aws_iam_instance_profile.app.name

  # Without this, the instance can boot and start writing
  # before the policy is attached. Nothing above references
  # the attachment, so the graph cannot know.
  depends_on = [aws_iam_role_policy_attachment.s3]
}

# 2. A whole module that must complete first.
module "database" {
  source = "./modules/database"
}

module "application" {
  source = "./modules/application"

  # The application module reads no database output, but the
  # database must be up before the app is deployed.
  depends_on = [module.database]
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform graph | dot -Tsvg > graph.svg',
      what: 'Renders the dependency graph Terraform derived from your references.',
    },
    {
      command: 'terraform console',
      what: 'Evaluate any reference interactively against real state.',
      namespaceNote: 'Type `aws_instance.web.private_ip` or `aws_instance.web[*].id`.',
    },
    {
      command: 'terraform state show <address>',
      what: 'Lists every attribute name available on a resource - the answer to "what can I reference?".',
    },
    {
      command: 'terraform apply -parallelism=1',
      what: 'Serialises execution, which exposes an ordering assumption you did not encode.',
    },
  ],
  declarative: {
    steps: [
      'Never hard-code an id, arn or endpoint that another block in the configuration produces.',
      'Reach for `depends_on` only when no reference expresses the requirement.',
      'Discover attribute names with `terraform state show`, not by guessing.',
      'Use splat expressions to pass every instance of a repeated resource somewhere.',
      'If Terraform reports a cycle, break it by moving the shared value into a `local` or a separate resource.',
    ],
    code: [
      {
        title: 'Breaking a dependency cycle',
        language: 'hcl',
        explanation:
          'Two resources referencing each other is a cycle Terraform refuses to plan. Hoisting the shared value out of both breaks it.',
        code: `# CYCLE: each security group references the other.
# Error: Cycle: aws_security_group.a, aws_security_group.b
#
# resource "aws_security_group" "a" {
#   ingress { security_groups = [aws_security_group.b.id] }
# }
# resource "aws_security_group" "b" {
#   ingress { security_groups = [aws_security_group.a.id] }
# }

# FIX: declare the groups without rules, then add the rules as
# separate resources. Each rule depends on both groups; the
# groups depend on nothing.
resource "aws_security_group" "a" {
  name   = "a"
  vpc_id = aws_vpc.main.id
}

resource "aws_security_group" "b" {
  name   = "b"
  vpc_id = aws_vpc.main.id
}

resource "aws_security_group_rule" "a_from_b" {
  type                     = "ingress"
  security_group_id        = aws_security_group.a.id
  source_security_group_id = aws_security_group.b.id
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "b_from_a" {
  type                     = "ingress"
  security_group_id        = aws_security_group.b.id
  source_security_group_id = aws_security_group.a.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform graph | grep "<resource address>"',
      what: 'Confirms an edge exists between two resources.',
    },
    {
      command: "terraform console <<< 'aws_instance.web[*].id'",
      what: 'Checks a splat expression returns what you expect before using it.',
    },
    {
      command: 'terraform plan',
      what: '`(known after apply)` on a referenced attribute confirms the dependency was detected.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'Reports "Reference to undeclared resource" - a typo in an address, or a missing `data.` prefix.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Unsupported attribute" - the attribute name is wrong; check with `terraform state show`.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Cycle: ..." - two resources reference each other; hoist the shared value out.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Invalid index" - you used `[0]` on a `for_each` resource, or a key that does not exist.',
    },
  ],
  commonMistakes: [
    'Hard-coding an id that another block in the same configuration produces. It breaks portability and ordering at once.',
    'Adding `depends_on` where a reference would work. It costs parallelism and hides the real structure.',
    'Putting an attribute in `depends_on`. It takes resource and module addresses only.',
    'Using `[0]` on a `for_each` resource, or a string key on a `count` resource. The addressing forms are not interchangeable.',
    'Treating `(known after apply)` as an error. It is how Terraform represents a value the provider has not produced yet.',
    'Forgetting that only *declared outputs* of a module are referenceable - internal resources are not.',
  ],
  examTips: [
    'A reference creates a dependency. That is the mechanism behind automatic ordering.',
    'Reference forms: `type.name.attr`, `data.type.name.attr`, `var.x`, `local.x`, `module.x.output`.',
    '`depends_on` is for ordering with no value exchange, and it accepts only resource and module addresses.',
    '`count` gives numeric indexes, `for_each` gives string keys. `[*]` is the splat over all instances.',
    'Destroy order is the reverse of create order, derived from the same graph.',
    'A reference cycle is a hard error that names the resources involved.',
  ],
  summary: [
    'References supply values and declare dependencies simultaneously.',
    'The graph is derived from references, so ordering is usually free.',
    '`depends_on` is the exception, for ordering no reference expresses.',
    '`count` indexes numerically, `for_each` keys by string, `[*]` covers all instances.',
    'Break cycles by hoisting the shared value into separate resources or a local.',
  ],
  practice: [
    {
      id: 'tf-refs-p1',
      level: 'beginner',
      prompt:
        'You write `subnet_id = aws_subnet.a.id`. What two things has that single line accomplished?',
      answer:
        'It supplies the subnet id, and it tells Terraform the instance depends on the subnet - so the subnet is created first and destroyed last.',
      explanation:
        'This is the central idea of objectives 4b and 4f: a reference is both a value and an edge in the graph.',
    },
    {
      id: 'tf-refs-p2',
      level: 'beginner',
      prompt: 'Is `depends_on = [aws_iam_policy.app.arn]` valid?',
      answer:
        'No. `depends_on` takes resource or module addresses, not attributes. It should be `depends_on = [aws_iam_policy.app]`.',
      explanation:
        'If you find yourself wanting to depend on a specific attribute, you almost certainly want a plain reference instead.',
    },
    {
      id: 'tf-refs-p3',
      level: 'intermediate',
      prompt:
        'Two security groups each need an ingress rule referencing the other. Terraform reports a cycle. How do you fix it?',
      answer:
        'Declare both groups with no inline rules, then create the rules as separate `aws_security_group_rule` resources. Each rule depends on both groups, and the groups depend on nothing.',
      explanation:
        'The general technique is to move the mutual reference out of the two resources and into a third that depends on both.',
    },
    {
      id: 'tf-refs-p4',
      level: 'advanced',
      prompt:
        'A configuration works with default parallelism but fails intermittently with `-parallelism=1`... or the reverse. What does either symptom tell you?',
      answer:
        'That there is an ordering requirement the graph does not know about. Intermittent failure under concurrency means a missing dependency; a failure that only appears when serialised usually means something was relying on two things being in flight at once. Either way the fix is to encode the real relationship with a reference or `depends_on`.',
      explanation:
        'Parallelism changes are a diagnostic, never a fix. Leaving `-parallelism=1` in place hides the problem for the next person.',
    },
  ],
  lab: {
    title: 'Build the graph, then break it',
    scenario:
      'Create a three-resource chain with credential-free providers, prove the ordering comes from references, then produce and fix a dependency cycle.',
    prerequisites: ['Terraform 1.5 or newer', 'graphviz for `dot` (optional)'],
    tasks: [
      {
        instruction:
          'Create a `random_pet`, a `local_file` whose content references it, and a second `local_file` whose content references the first file’s `content`.',
      },
      { instruction: 'Apply, then run `terraform graph` and identify both edges.' },
      {
        instruction:
          'Run `terraform destroy` and watch the order in the output. Confirm it is the reverse of creation.',
      },
      {
        instruction:
          'Replace the reference in the second file with a hard-coded string, apply, and run `terraform graph` again. Confirm the edge is gone.',
      },
      {
        instruction:
          'Create a cycle: make two `local_file` resources reference each other’s `content`. Run a plan and read the error.',
      },
      {
        instruction:
          'Break the cycle by moving the shared text into a `locals` block that both files reference.',
      },
      {
        instruction:
          'Add a third resource with `depends_on` pointing at the first, referencing nothing, and confirm the graph shows the edge anyway.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'The chain',
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

resource "local_file" "first" {
  filename = "\${path.module}/first.txt"
  content  = "pet: \${random_pet.name.id}\\n"
}

resource "local_file" "second" {
  filename = "\${path.module}/second.txt"
  # This reference is the second edge.
  content  = "copied: \${local_file.first.content}"
}

# depends_on with no value exchange at all.
resource "local_file" "third" {
  filename   = "\${path.module}/third.txt"
  content    = "independent content\\n"
  depends_on = [local_file.first]
}`,
      },
      {
        title: 'The cycle, and the fix',
        language: 'hcl',
        code: `# CYCLE - Terraform refuses to plan this:
# resource "local_file" "a" {
#   filename = "a.txt"
#   content  = local_file.b.content
# }
# resource "local_file" "b" {
#   filename = "b.txt"
#   content  = local_file.a.content
# }
# Error: Cycle: local_file.a, local_file.b

# FIX: hoist the shared value out of both.
locals {
  shared = "shared content\\n"
}

resource "local_file" "a" {
  filename = "\${path.module}/a.txt"
  content  = local.shared
}

resource "local_file" "b" {
  filename = "\${path.module}/b.txt"
  content  = local.shared
}`,
      },
      {
        title: 'Running it',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# Both edges:
terraform graph | grep -E 'local_file.(first|second|third)'

# Reverse destroy order:
terraform destroy -auto-approve
# local_file.third: Destroying...
# local_file.second: Destroying...
# local_file.first: Destroying...
# random_pet.name: Destroying...

# Remove the reference in local_file.second and re-apply:
terraform apply -auto-approve
terraform graph | grep local_file.second   # no edge to first any more

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform graph | grep -c "\\->"',
        what: 'Counts edges in the graph - it shrinks when you remove a reference.',
      },
      {
        command: "terraform console <<< 'local_file.first.content'",
        what: 'Confirms the referenced value resolves.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt graph.svg && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes everything the lab created.',
      },
    ],
  },
  relatedTopicIds: [
    'tf-resources-and-data-sources',
    'tf-count-and-for-each',
    'tf-locals-and-complex-types',
  ],
  docs: [
    {
      title: 'References to values',
      url: 'https://developer.hashicorp.com/terraform/language/expressions/references',
    },
    {
      title: 'The depends_on meta-argument',
      url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/depends_on',
    },
  ],
}
