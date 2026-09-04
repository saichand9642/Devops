import type { Topic } from '../../../types'

export const dynamicBlocksAndLifecycle: Topic = {
  id: 'tf-dynamic-blocks-and-lifecycle',
  title: 'dynamic blocks and the lifecycle meta-argument',
  domainId: 'tf-configuration',
  difficulty: 'advanced',
  estimatedMinutes: 15,
  order: 8,
  tags: ['dynamic', 'lifecycle', 'prevent_destroy', 'ignore_changes', 'create_before_destroy'],
  oneLiner:
    'Generating repeated nested blocks, and the four lifecycle settings that change how Terraform replaces and protects resources.',
  explanation: [
    'Some resource arguments are **nested blocks** rather than attributes: `ingress` on a security group, `setting` on an Elastic Beanstalk environment. You cannot assign a list to a block, so repeating one requires a `dynamic` block.',
    '`dynamic "ingress" { for_each = ...  content { ... } }` generates one `ingress` block per element. Inside `content`, `each.key` and `each.value` refer to the current element.',
    'The `lifecycle` meta-argument changes how Terraform treats a resource: `create_before_destroy` reorders replacement, `prevent_destroy` refuses to destroy, `ignore_changes` stops proposing changes to listed attributes, and `replace_triggered_by` forces replacement when something else changes.',
    'Both features are powerful and both are easy to overuse. A configuration full of `dynamic` blocks is often harder to read than the repetition it replaced, and `ignore_changes` can hide drift you needed to know about.',
  ],
  whyItMatters: [
    'Dynamic blocks are how you write a reusable module for anything with repeated nested configuration, which is most networking and policy resources.',
    '`lifecycle` is the answer to several real operational problems - zero-downtime replacement, protecting production data, and tolerating values changed by other systems.',
    'Both appear in exam questions about dynamic configuration and about resource behaviour.',
  ],
  howItWorks: [
    '`dynamic "<BLOCK_NAME>"` takes `for_each` (a map, set or list), an optional `iterator` to rename `each`, and a required `content` block containing what one instance looks like.',
    'A `dynamic` block can only generate blocks the resource schema already supports. It cannot invent arguments.',
    '`create_before_destroy = true` inverts replacement order: the new resource is created before the old is destroyed. It requires that both can exist at once - names and ports must not collide.',
    '`prevent_destroy = true` turns any plan that would destroy the resource into an error. It cannot be overridden by a flag; you must remove the setting.',
    '`ignore_changes = [attr, ...]` stops Terraform proposing changes to those attributes. `ignore_changes = all` ignores every attribute after creation.',
    '`replace_triggered_by = [refs]` forces replacement when a referenced resource or attribute changes - useful for making a dependent resource follow its dependency.',
    '`lifecycle` accepts only literal values: it cannot reference variables, because it is evaluated too early.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which lifecycle setting solves this problem?',
      caption:
        'Each one exists for a specific operational problem. Reach for them by problem, not by habit.',
      question: 'What behaviour do you need to change?',
      branches: [
        {
          condition: 'replacement must not cause downtime',
          result: 'create_before_destroy = true',
          detail: 'New resource up before the old comes down',
          tone: 'accent',
        },
        {
          condition: 'this must never be destroyed by accident',
          result: 'prevent_destroy = true',
          detail: 'Any destroy plan becomes a hard error',
        },
        {
          condition: 'another system changes this attribute',
          result: 'ignore_changes = [attr]',
          detail: 'Autoscaling desired_count, rotated passwords, external tags',
        },
        {
          condition: 'it must be recreated when something else changes',
          result: 'replace_triggered_by = [ref]',
          detail: 'Makes a dependent follow its dependency',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'How create_before_destroy changes a replacement',
      caption:
        'The default order leaves a gap. Inverting it removes the gap but requires that two copies can coexist.',
      nodes: [
        {
          label: 'A change forces replacement',
          detail: 'An attribute marked "forces replacement" differs',
        },
        {
          label: 'Default: destroy, then create',
          detail: 'There is a window with no resource at all',
          tone: 'warning',
          branch: {
            label: 'Downtime',
            detail: 'As long as creation takes',
          },
        },
        {
          label: 'With create_before_destroy: create first',
          detail: 'Two copies exist briefly',
          arrowLabel: 'order inverted',
          tone: 'accent',
        },
        {
          label: 'Dependents are updated to the new one',
          detail: 'References are re-pointed',
        },
        {
          label: 'Then the old one is destroyed',
          detail: 'No gap in service',
          tone: 'success',
          branch: {
            label: 'Name or port collision',
            detail: 'Two copies cannot coexist - apply fails',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'dynamic block',
      purpose:
        'Generates zero or more instances of a nested block that the resource schema supports.',
      fields: [
        {
          path: 'for_each',
          meaning: 'The collection to iterate. Map, set or list.',
          required: true,
        },
        {
          path: 'content',
          meaning: 'What one generated block looks like. Required.',
          required: true,
        },
        { path: 'iterator', meaning: 'Renames `each`, e.g. `iterator = rule` gives `rule.value`.' },
        { path: 'labels', meaning: 'For blocks that take labels; rarely needed.' },
      ],
    },
    {
      kind: 'lifecycle',
      purpose:
        'Changes how Terraform creates, replaces and protects one resource. Literal values only.',
      fields: [
        {
          path: 'create_before_destroy',
          meaning: 'Create the replacement before destroying the original.',
        },
        { path: 'prevent_destroy', meaning: 'Make any destroy plan a hard error.', required: true },
        { path: 'ignore_changes', meaning: 'A list of attributes to stop tracking, or `all`.' },
        {
          path: 'replace_triggered_by',
          meaning: 'Force replacement when a referenced thing changes.',
        },
        {
          path: 'precondition / postcondition',
          meaning: 'Assertions checked before and after apply.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'ignore_changes that hid a real problem',
    story: [
      'An ECS service had its `desired_count` managed by application autoscaling. Every Terraform plan proposed setting it back to the configured 2, so someone added `ignore_changes = [desired_count]`. Correct fix, correct reason.',
      'Six months later they broadened it to `ignore_changes = all` while debugging something unrelated, and left it in.',
      'For the next four months no change to that service’s task definition, environment variables or load balancer configuration was ever applied. Plans were always clean. Two deployments silently did nothing, and the team spent a day debugging a container image that had never actually been updated.',
      '`ignore_changes` is a scalpel. `ignore_changes = all` is a way to make a resource invisible to Terraform while pretending it is still managed - and there is almost always a better answer.',
    ],
    code: [
      {
        title: 'Narrow, not broad',
        language: 'hcl',
        code: `resource "aws_ecs_service" "app" {
  name            = "app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2

  lifecycle {
    # Exactly the one attribute another system owns.
    ignore_changes = [desired_count]

    # NOT this - it makes every other change invisible too:
    # ignore_changes = all
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A dynamic block generating security group rules',
      language: 'hcl',
      explanation:
        'One variable drives any number of rules. Without `dynamic` you would need one `ingress` block per rule, hard-coded.',
      code: `variable "ingress_rules" {
  description = "Inbound rules, keyed by a descriptive name."
  type = map(object({
    port        = number
    protocol    = optional(string, "tcp")
    cidr_blocks = list(string)
    description = optional(string, "")
  }))
  default = {
    https = { port = 443, cidr_blocks = ["0.0.0.0/0"], description = "public https" }
    ssh   = { port = 22, cidr_blocks = ["10.0.0.0/8"], description = "admin ssh" }
  }
}

resource "aws_security_group" "app" {
  name   = "app"
  vpc_id = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.ingress_rules

    content {
      description = ingress.value.description
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }

  # A single static block alongside dynamic ones is fine.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`,
    },
    {
      title: 'Every lifecycle setting, with its reason',
      language: 'hcl',
      explanation:
        'Note that `lifecycle` takes literals only - you cannot write `prevent_destroy = var.is_production`.',
      code: `resource "aws_db_instance" "prod" {
  identifier = "prod-db"
  # ...

  lifecycle {
    # A destroy plan becomes an error, not something to approve.
    prevent_destroy = true

    # The password is rotated by an external process.
    ignore_changes = [password, final_snapshot_identifier]
  }
}

resource "aws_launch_template" "web" {
  name_prefix = "web-"   # a PREFIX, so two can coexist
  image_id    = var.ami_id

  lifecycle {
    # Zero-downtime replacement. Works because name_prefix
    # generates a unique name rather than a fixed one.
    create_before_destroy = true
  }
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  user_data     = local.user_data

  lifecycle {
    # Recreate the instance whenever the config map changes,
    # even though nothing here references it directly.
    replace_triggered_by = [aws_ssm_parameter.app_config]
  }
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform plan',
      what: 'Shows generated dynamic blocks expanded, so you can confirm what was produced.',
    },
    {
      command: 'terraform state show aws_security_group.app',
      what: 'Shows the rules that actually exist, after dynamic expansion.',
    },
    {
      command: "echo 'var.ingress_rules' | terraform console",
      what: 'Checks the collection driving a dynamic block before applying.',
    },
    {
      command: 'terraform apply -replace=aws_instance.app',
      what: 'Forces replacement once, without adding `replace_triggered_by`.',
    },
  ],
  declarative: {
    steps: [
      'Use `dynamic` only when the number of nested blocks genuinely varies. Two hard-coded blocks are more readable than a dynamic one.',
      'Drive dynamic blocks from a `map(object({...}))` so each generated block has a meaningful key.',
      'Add `prevent_destroy` to stateful production resources as a matter of course.',
      'Keep `ignore_changes` to a specific list. Never use `all` in committed code.',
      'Use `create_before_destroy` with a `name_prefix` rather than a fixed name, or the two copies will collide.',
    ],
    code: [
      {
        title: 'When NOT to use dynamic',
        language: 'hcl',
        explanation:
          'Dynamic blocks cost readability. If the set is fixed and small, write it out.',
        code: `# Over-engineered: the rules never change, and this is harder
# to read and to review than the version below.
# dynamic "ingress" {
#   for_each = [
#     { port = 443, cidr = ["0.0.0.0/0"] },
#     { port = 80, cidr = ["0.0.0.0/0"] },
#   ]
#   content {
#     from_port   = ingress.value.port
#     to_port     = ingress.value.port
#     protocol    = "tcp"
#     cidr_blocks = ingress.value.cidr
#   }
# }

# Clearer, and a reviewer can see both rules at a glance.
ingress {
  description = "https"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
}

ingress {
  description = "http redirect"
  from_port   = 80
  to_port     = 80
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state show aws_security_group.app | grep -c "ingress {"',
      what: 'Counts the rules that were actually generated.',
    },
    {
      command: 'terraform plan',
      what: 'With `prevent_destroy` set, a destroy plan should be an error rather than a proposal.',
      expected: 'Error: Instance cannot be destroyed',
    },
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'With correct `ignore_changes`, an externally-managed attribute should no longer cause exit 2.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'Reports "Blocks of type X are not expected here" - the resource has no such nested block.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Variables not allowed" inside `lifecycle` - it accepts literals only.',
    },
    {
      command: 'terraform apply',
      what: 'With `create_before_destroy`, fails on a duplicate name - use `name_prefix` instead of `name`.',
    },
    {
      command: 'terraform plan',
      what: 'Nothing ever changes on a resource - check for a broad `ignore_changes`.',
    },
  ],
  commonMistakes: [
    'Using `dynamic` for a fixed set of two or three blocks. It costs readability for no benefit.',
    'Trying to `dynamic` an argument rather than a block. Only nested blocks can be generated.',
    'Referencing a variable in `lifecycle`. It is evaluated before variables and accepts literals only.',
    'Using `ignore_changes = all`, which silently stops Terraform managing anything about the resource.',
    '`create_before_destroy` on a resource with a fixed unique name - the two copies collide and the apply fails.',
    'Forgetting that `prevent_destroy` also blocks `terraform destroy` for the whole configuration, not just that resource.',
  ],
  examTips: [
    '`dynamic` generates nested BLOCKS, never arguments, and only ones the schema supports.',
    'Inside `content`, refer to the current element as `<block_name>.value` and `.key`, or rename it with `iterator`.',
    '`lifecycle` has four main settings: create_before_destroy, prevent_destroy, ignore_changes, replace_triggered_by.',
    '`prevent_destroy` produces an error that cannot be overridden by a CLI flag.',
    '`ignore_changes` accepts a list of attribute names or the keyword `all`.',
    '`lifecycle` cannot use variables or any other expression - literals only.',
  ],
  summary: [
    '`dynamic` repeats a nested block from a collection; it cannot invent arguments.',
    'Use it only where the count genuinely varies.',
    '`create_before_destroy` removes replacement downtime, and needs `name_prefix`.',
    '`prevent_destroy` makes destruction an error you must remove code to allow.',
    '`ignore_changes` should always be a specific list, never `all`.',
  ],
  practice: [
    {
      id: 'tf-dynamic-p1',
      level: 'beginner',
      prompt: 'Can a `dynamic` block generate the `tags` argument of a resource?',
      answer:
        'No. `tags` is an argument (a map), not a nested block. `dynamic` only generates nested blocks the schema defines.',
      explanation:
        'For a map argument you build the map with an expression instead - a `for` expression or `merge()`.',
    },
    {
      id: 'tf-dynamic-p2',
      level: 'beginner',
      prompt: 'Why does `prevent_destroy = var.protect` fail?',
      answer:
        'Because `lifecycle` accepts only literal values. It is evaluated too early for variables to be available.',
      explanation:
        'The usual workaround is separate configurations or modules per environment, rather than trying to make the setting conditional.',
    },
    {
      id: 'tf-dynamic-p3',
      level: 'intermediate',
      prompt:
        'You add `create_before_destroy = true` to a resource with `name = "web-lt"` and the next replacement fails. Why?',
      answer:
        'Because the new resource is created while the old one still exists, and both would have the same name. Use `name_prefix = "web-"` so each gets a unique generated name.',
      explanation:
        'The same applies to any uniquely-constrained attribute - ports, DNS records, IAM role names.',
    },
    {
      id: 'tf-dynamic-p4',
      level: 'advanced',
      prompt:
        'What is the operational risk of `ignore_changes = all`, and what should you use instead?',
      answer:
        'Terraform stops proposing any change to the resource after creation, so real configuration changes are silently never applied while plans stay clean. Use a specific list of only the attributes another system owns.',
      explanation:
        'If a resource genuinely should not be managed by Terraform at all, the honest answers are a data source or `terraform state rm` - not pretending to manage it.',
    },
  ],
  lab: {
    title: 'Generate blocks, then protect a resource',
    scenario:
      'Use a dynamic block to drive repeated nested configuration, then exercise all four lifecycle settings and watch each one change Terraform’s behaviour.',
    prerequisites: ['Terraform 1.5 or newer'],
    tasks: [
      {
        instruction:
          'Create a `local_file` and, using the `random` provider, a `random_password` with `keepers` so you can force replacement on demand.',
      },
      {
        instruction:
          'Add `prevent_destroy = true` to the file, then run `terraform destroy` and read the error.',
      },
      { instruction: 'Remove the setting and confirm destroy now works. Re-apply.' },
      {
        instruction:
          'Add `ignore_changes = [content]`, edit the `content` argument in the configuration, and confirm the plan is clean.',
      },
      {
        instruction:
          'Broaden it to `ignore_changes = all`, change the `filename` too, and observe that even that is ignored. Then remove it.',
        hint: 'This is the trap from the story in this lesson.',
      },
      {
        instruction:
          'Add `replace_triggered_by = [random_password.token]` to the file, then bump the password `keepers` and plan. Confirm the file is replaced too.',
      },
      {
        instruction:
          'Write a small module-style resource using a `dynamic` block if you have a provider that supports nested blocks, or otherwise inspect the plan output of one from this lesson.',
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

resource "random_password" "token" {
  length = 16

  keepers = {
    version = "1"
  }
}

resource "local_file" "protected" {
  filename = "\${path.module}/protected.txt"
  content  = "v1\\n"

  lifecycle {
    # Step 2: uncomment, try destroy, then comment out again.
    # prevent_destroy = true

    # Step 4: uncomment, change content above, plan.
    # ignore_changes = [content]

    # Step 6: uncomment, bump keepers, plan.
    # replace_triggered_by = [random_password.token]
  }
}`,
      },
      {
        title: 'Exercising each setting',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# --- prevent_destroy
# uncomment prevent_destroy, then:
terraform destroy
# Error: Instance cannot be destroyed
#   Resource local_file.protected has lifecycle.prevent_destroy set.
# Note: this blocks the WHOLE destroy, not just this resource.

# comment it out again:
terraform destroy -auto-approve && terraform apply -auto-approve

# --- ignore_changes
# uncomment ignore_changes = [content], change content to "v2", then:
terraform plan
# No changes. Terraform is deliberately not tracking content.

# --- ignore_changes = all
# broaden it, and also change filename:
terraform plan
# Still no changes. Even the filename is invisible now.
# This is exactly the failure mode from the story.

# --- replace_triggered_by
# restore a clean lifecycle, add replace_triggered_by, then:
sed -i 's/version = "1"/version = "2"/' main.tf
terraform plan
#   -/+ random_password.token   (keepers forces replacement)
#   -/+ local_file.protected    (replaced by replace_triggered_by)

terraform apply -auto-approve
terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'With `ignore_changes` set, a configuration change should not produce exit 2.',
      },
      {
        command: 'terraform state show local_file.protected | grep content',
        what: 'Shows the value in state, which may now differ from the configuration.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the resources and cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-count-and-for-each', 'tf-custom-conditions', 'tf-plan'],
  docs: [
    {
      title: 'Dynamic blocks',
      url: 'https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks',
    },
    {
      title: 'The lifecycle meta-argument',
      url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle',
    },
  ],
}
