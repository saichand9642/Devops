import type { Topic } from '../../../types'

export const customConditions: Topic = {
  id: 'tf-custom-conditions',
  title: 'Custom conditions: validation, preconditions and postconditions',
  domainId: 'tf-configuration',
  difficulty: 'intermediate',
  estimatedMinutes: 14,
  order: 9,
  tags: ['validation', 'precondition', 'postcondition', 'check', 'objective-4g'],
  oneLiner:
    'Four ways to assert something must be true, and which one fires at which point in the run.',
  explanation: [
    'Terraform gives you four assertion mechanisms, and they differ in *when* they run and *what they can see*.',
    '**`validation`** inside a `variable` block checks an input. It runs earliest, sees only that variable, and produces your own error message before anything else happens.',
    '**`precondition`** inside a `lifecycle` or `output` block checks something before a resource is created or a value published. It can reference anything - other resources, data sources, locals.',
    '**`postcondition`** checks something after a resource is created, using its real attributes. It catches "it applied but the result is wrong".',
    '**`check`** blocks are different in kind: they produce *warnings*, not errors, and never block an apply. They are for continuous assertions about a healthy system rather than for correctness gates.',
  ],
  whyItMatters: [
    'Objective 4g is validating configuration using custom conditions, and the distinction between these four is exactly what it tests.',
    'A good error message written by you saves far more time than a provider error six layers down.',
    'Assertions turn implicit assumptions - "this CIDR is always /24", "this bucket is always encrypted" - into things the configuration states and checks.',
  ],
  howItWorks: [
    '`validation` takes a `condition` (a boolean expression referencing only `var.<this variable>`) and an `error_message`. Several validation blocks may appear on one variable, and all are evaluated.',
    '`precondition` and `postcondition` live inside `lifecycle` on a resource, or directly inside an `output`. Each takes a `condition` and an `error_message`.',
    'A `precondition` is evaluated during plan where possible, so it fails early. A `postcondition` is evaluated after the resource exists, so it can reference computed attributes.',
    'A failing `validation`, `precondition` or `postcondition` is an **error** that stops the run.',
    'A `check` block contains optional `data` sources and one or more `assert` blocks. Failures are **warnings**: the apply still succeeds. They are reported on every plan and apply.',
    '`error_message` must be a single-sentence literal string. It can interpolate values, and it should say what to do rather than just what is wrong.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'When each assertion fires',
      caption:
        'Earlier is better: a variable validation costs nothing and fails before any API call. A postcondition needs the resource to exist first.',
      nodes: [
        {
          label: 'variable validation',
          detail: 'Checks the input. Sees only that variable.',
          tone: 'accent',
          branch: {
            label: 'Fails',
            detail: 'Run stops immediately, with your message',
          },
        },
        {
          label: 'lifecycle precondition',
          detail: 'Checks assumptions before creating. Sees everything.',
          arrowLabel: 'during plan',
          branch: {
            label: 'Fails',
            detail: 'Plan stops before anything is created',
          },
        },
        {
          label: 'The resource is created',
          detail: 'Real attributes now exist',
        },
        {
          label: 'lifecycle postcondition',
          detail: 'Checks the actual result',
          arrowLabel: 'after apply',
          branch: {
            label: 'Fails',
            detail: 'Apply reports an error - the resource exists but is wrong',
          },
        },
        {
          label: 'check block assertions',
          detail: 'Warnings only. Never block anything.',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which mechanism should I use?',
      caption:
        'Choose by what the assertion needs to see, and whether failing should stop the run.',
      question: 'What are you asserting about?',
      branches: [
        {
          condition: 'a value someone passed in',
          result: 'variable validation',
          detail: 'Earliest failure, cheapest, clearest message',
          tone: 'accent',
        },
        {
          condition: 'an assumption about other resources',
          result: 'lifecycle precondition',
          detail: 'Can reference anything in the configuration',
        },
        {
          condition: 'the result after creation',
          result: 'lifecycle postcondition',
          detail: 'Sees computed attributes',
        },
        {
          condition: 'ongoing health, not correctness',
          result: 'check block',
          detail: 'Warns without ever blocking an apply',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Assertion blocks',
      purpose: 'The four mechanisms, their location and their severity.',
      fields: [
        {
          path: 'variable { validation { condition, error_message } }',
          meaning: 'Input check. May reference only that variable. Error.',
          required: true,
        },
        {
          path: 'resource { lifecycle { precondition { ... } } }',
          meaning: 'Pre-creation assumption. References anything. Error.',
        },
        {
          path: 'resource { lifecycle { postcondition { ... } } }',
          meaning: 'Post-creation result check. Sees computed attributes. Error.',
        },
        {
          path: 'output { precondition { ... } }',
          meaning: 'Assert before publishing a value. Error.',
        },
        {
          path: 'check "name" { data ... assert { ... } }',
          meaning: 'Continuous assertion. WARNING only - never blocks.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A provider error four layers deep',
    story: [
      'A module accepted a `subnet_cidr` variable. Someone passed `10.0.0.0/8` by mistake instead of `10.0.1.0/24`.',
      'Terraform validated fine. The plan looked fine. The apply failed after ninety seconds with an AWS error about the CIDR not being within the VPC range - reported against a subnet resource three modules deep, with no indication of which input was wrong.',
      'It took twenty minutes to trace back to the variable. Adding one `validation` block turned that into an immediate, self-explanatory failure naming the variable and the rule.',
      'The general lesson: every assumption a module makes about its inputs is either checked with a message you wrote, or discovered later as a message someone else wrote about something else.',
    ],
    code: [
      {
        title: 'The validation that would have saved twenty minutes',
        language: 'hcl',
        code: `variable "subnet_cidr" {
  description = "CIDR for the subnet. Must be a /24 inside the VPC range."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.subnet_cidr))
    error_message = "subnet_cidr must be a valid IPv4 CIDR, e.g. 10.0.1.0/24."
  }

  validation {
    condition     = tonumber(split("/", var.subnet_cidr)[1]) == 24
    error_message = "subnet_cidr must be a /24; got \${var.subnet_cidr}."
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'All four mechanisms in one configuration',
      language: 'hcl',
      explanation:
        'Note the severity difference: the first three stop the run, the `check` block only warns.',
      code: `variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging or production."
  }
}

variable "instance_type" {
  type = string

  validation {
    # Production must not run on burstable instances.
    condition     = !startswith(var.instance_type, "t2.")
    error_message = "t2 instances are not permitted; use t3 or newer."
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.private.id

  lifecycle {
    # Checked during plan: an assumption about another resource.
    precondition {
      condition     = data.aws_ami.ubuntu.architecture == "x86_64"
      error_message = "The selected AMI must be x86_64 to match this instance type."
    }

    # Checked after creation, using a computed attribute.
    postcondition {
      condition     = self.private_ip != null
      error_message = "The instance was created without a private IP."
    }
  }
}

output "endpoint" {
  value = aws_instance.web.private_dns

  precondition {
    condition     = var.environment != "production" || aws_instance.web.monitoring
    error_message = "Detailed monitoring must be enabled in production."
  }
}

# Warnings only. This never blocks an apply.
check "certificate_expiry" {
  data "aws_acm_certificate" "web" {
    domain = "www.example.com"
  }

  assert {
    condition = timecmp(
      plantimestamp(),
      timeadd(data.aws_acm_certificate.web.not_after, "-720h")
    ) < 0
    error_message = "The TLS certificate expires within 30 days."
  }
}`,
    },
    {
      title: 'Writing error messages people can act on',
      language: 'hcl',
      explanation:
        'A good message names the variable, states the rule, shows the offending value, and implies the fix.',
      code: `variable "retention_days" {
  type = number

  # Poor: states that something is wrong, not what or why.
  # validation {
  #   condition     = var.retention_days > 0
  #   error_message = "Invalid value."
  # }

  # Good: names the variable, the rule, the value and the fix.
  validation {
    condition     = var.retention_days >= 30 && var.retention_days <= 3653
    error_message = "retention_days must be between 30 and 3653 (10 years); got \${var.retention_days}. Compliance requires at least 30."
  }
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform validate',
      what: 'Runs variable validations that do not depend on unknown values.',
    },
    {
      command: 'terraform plan',
      what: 'Runs every validation and precondition, and reports check-block warnings.',
    },
    {
      command: 'terraform plan -var="environment=nope"',
      what: 'Triggers a validation deliberately, to confirm the message reads well.',
      expected: 'Error: Invalid value for variable',
    },
    {
      command: 'terraform apply',
      what: 'Runs postconditions after resources are created.',
    },
  ],
  declarative: {
    steps: [
      'Validate every variable with a known valid set or range.',
      'Prefer `validation` over `precondition` when the assertion is about one input - it fails earlier and cheaper.',
      'Use `precondition` for cross-resource assumptions and `postcondition` for results.',
      'Use `check` blocks for monitoring-style assertions that must never block a deploy.',
      'Write error messages that name the variable, the rule and the value.',
    ],
    code: [
      {
        title: 'What each mechanism can and cannot see',
        language: 'hcl',
        explanation: 'This is the practical constraint that decides which one you can use.',
        code: `variable "vpc_cidr" {
  type = string

  validation {
    # ALLOWED: this variable only.
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR."
  }

  validation {
    # NOT ALLOWED before Terraform 1.9: referencing another
    # variable from inside a validation block.
    # condition = var.vpc_cidr != var.subnet_cidr
    # Use a precondition on a resource instead, which can see
    # the whole configuration.
    condition     = tonumber(split("/", var.vpc_cidr)[1]) <= 16
    error_message = "vpc_cidr must be /16 or larger."
  }
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  lifecycle {
    precondition {
      # ALLOWED here: any expression at all.
      condition     = var.vpc_cidr != var.subnet_cidr
      error_message = "vpc_cidr and subnet_cidr must differ."
    }
  }
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -var="environment=production"',
      what: 'Confirms a valid value passes every assertion.',
    },
    {
      command: 'terraform plan -var="environment=invalid" 2>&1 | head -12',
      what: 'Confirms the failure message is the one you wrote.',
    },
    {
      command: 'terraform plan | grep -A3 Warning',
      what: 'Shows check-block warnings, which do not affect the exit code.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'Reports "Invalid reference in variable validation" - a validation referenced something other than its own variable.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Invalid value for variable" - your own validation message, working correctly.',
    },
    {
      command: 'terraform apply',
      what: 'Reports "Resource postcondition failed" - the resource exists but its attributes are wrong.',
    },
    {
      command: 'terraform plan',
      what: 'A check block warns but the apply proceeds - that is by design; use a precondition if it must block.',
    },
  ],
  commonMistakes: [
    'Referencing another variable inside a `validation` block on older Terraform versions. Use a `precondition` instead.',
    'Writing "Invalid value." as an error message. Name the variable, the rule and the offending value.',
    'Expecting a `check` block to block an apply. It only ever warns.',
    'Using a `postcondition` for something a `precondition` could catch. Failing after creation is more expensive than failing before.',
    'Forgetting `can()` when validating something that might throw - `cidrnetmask("nonsense")` errors rather than returning false.',
    'Putting business rules in validations that differ per environment, then being unable to express the difference because `validation` sees one variable.',
  ],
  examTips: [
    'Four mechanisms: `validation` (variables), `precondition` and `postcondition` (resources and outputs), `check` (warnings).',
    '`validation` sees only its own variable; preconditions and postconditions see everything.',
    'A `postcondition` can reference `self`, which a precondition cannot.',
    '`check` blocks produce warnings and never block an apply.',
    '`error_message` is required alongside every `condition`.',
    'Use `can()` to turn a potentially-erroring expression into a boolean.',
  ],
  summary: [
    '`validation` for inputs, `precondition` for assumptions, `postcondition` for results, `check` for warnings.',
    'Earlier assertions are cheaper: a variable validation fails before any API call.',
    'Only preconditions and postconditions can see the rest of the configuration.',
    '`check` blocks warn and never block - that is their purpose.',
    'A good error message names the variable, the rule and the value.',
  ],
  practice: [
    {
      id: 'tf-conditions-p1',
      level: 'beginner',
      prompt: 'What can a `validation` block inside a variable reference?',
      answer: 'Only that variable, as `var.<name>`.',
      explanation:
        'Cross-variable and cross-resource assertions belong in a `precondition`, which can see everything.',
    },
    {
      id: 'tf-conditions-p2',
      level: 'beginner',
      prompt: 'Does a failing `check` block assertion stop an apply?',
      answer: 'No. Check blocks produce warnings only.',
      explanation:
        'That is what distinguishes them: they are for continuous health assertions, not for correctness gates.',
    },
    {
      id: 'tf-conditions-p3',
      level: 'intermediate',
      prompt:
        'You need to assert that an instance actually received a public IP. Which mechanism, and why not the others?',
      answer:
        'A `postcondition`. The public IP is a computed attribute that only exists after creation, so a `validation` cannot see it and a `precondition` runs too early.',
      explanation:
        'A postcondition can also reference `self`, which is how it reads the attributes of the resource it is attached to.',
    },
    {
      id: 'tf-conditions-p4',
      level: 'advanced',
      prompt:
        'Why does `condition = cidrnetmask(var.cidr) != ""` fail differently from `condition = can(cidrnetmask(var.cidr))`?',
      answer:
        'Because `cidrnetmask` on an invalid CIDR raises an error rather than returning a value, so the first form produces a function error instead of your validation message. `can()` catches the error and returns false, letting your message be shown.',
      explanation:
        '`can()` and `try()` are the general tools for turning "this might error" into a value you can test.',
    },
  ],
  lab: {
    title: 'Fail early, on purpose',
    scenario:
      'Add all four assertion types to one configuration and trigger each in turn, observing exactly when it fires and whether it blocks.',
    prerequisites: ['Terraform 1.5 or newer (check blocks need 1.5+)'],
    tasks: [
      {
        instruction:
          'Create a variable `tier` with a validation restricting it to a set of three values, and a `local_file` using it.',
      },
      { instruction: 'Run a plan with an invalid value and confirm your message appears.' },
      {
        instruction: 'Add a second validation on a numeric variable using a range, and trigger it.',
      },
      {
        instruction:
          'Add a `precondition` on the resource asserting something about a different variable. Trigger it and note that it fires at plan time.',
      },
      {
        instruction:
          'Add a `postcondition` asserting `self.content` is non-empty, then set the content to an empty string and apply.',
        hint: 'Note that the resource is created before the error appears.',
      },
      {
        instruction:
          'Add an `output` with a `precondition` that fails, and observe that the apply succeeds up to the point of publishing.',
      },
      {
        instruction:
          'Add a `check` block whose assertion fails, and confirm the apply still succeeds with a warning.',
      },
      {
        instruction:
          'Replace a bare erroring expression in a validation with `can()` and compare the messages.',
      },
      { instruction: 'Clean up.' },
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
  type = string

  validation {
    condition     = contains(["bronze", "silver", "gold"], var.tier)
    error_message = "tier must be bronze, silver or gold; got \\"\${var.tier}\\"."
  }
}

variable "replicas" {
  type    = number
  default = 2

  validation {
    condition     = var.replicas >= 1 && var.replicas <= 10
    error_message = "replicas must be between 1 and 10; got \${var.replicas}."
  }
}

variable "body" {
  type    = string
  default = "hello"
}

resource "local_file" "config" {
  filename = "\${path.module}/config.txt"
  content  = "tier=\${var.tier} replicas=\${var.replicas}\\n\${var.body}\\n"

  lifecycle {
    precondition {
      condition     = var.tier != "gold" || var.replicas >= 3
      error_message = "The gold tier requires at least 3 replicas."
    }

    postcondition {
      condition     = length(self.content) > 10
      error_message = "The generated config is suspiciously short."
    }
  }
}

output "summary" {
  value = "\${var.tier}/\${var.replicas}"

  precondition {
    condition     = var.tier != "bronze"
    error_message = "The bronze tier is not published."
  }
}

check "body_not_placeholder" {
  assert {
    condition     = var.body != "CHANGEME"
    error_message = "body still contains the template default CHANGEME."
  }
}`,
      },
      {
        title: 'Triggering each one',
        language: 'bash',
        code: `terraform init

# 1. variable validation - fails immediately, no API call
terraform plan -var="tier=platinum"
# Error: Invalid value for variable
#   tier must be bronze, silver or gold; got "platinum".

terraform plan -var="tier=gold" -var="replicas=99"
# Error: replicas must be between 1 and 10; got 99.

# 2. precondition - fails at PLAN time, referencing two variables
terraform plan -var="tier=gold" -var="replicas=2"
# Error: Resource precondition failed
#   The gold tier requires at least 3 replicas.

# 3. postcondition - fails AFTER creation
terraform apply -auto-approve -var="tier=silver" -var='body='
# local_file.config: Creation complete
# Error: Resource postcondition failed
#   The generated config is suspiciously short.
# Note: the file EXISTS. The postcondition ran after it was made.

# 4. output precondition
terraform apply -auto-approve -var="tier=bronze"
# Error: Module output value precondition failed
#   The bronze tier is not published.

# 5. check block - WARNING only, apply succeeds
terraform apply -auto-approve -var="tier=silver" -var="body=CHANGEME"
# Warning: Check block assertion failed
#   body still contains the template default CHANGEME.
# Apply complete! Resources: 1 added.
echo "exit was $?"   # 0 - a check never blocks

terraform destroy -auto-approve -var="tier=silver"`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -var="tier=silver" -detailed-exitcode; echo "exit=$?"',
        what: 'A valid configuration passes every assertion.',
      },
      {
        command: 'terraform plan -var="tier=silver" -var="body=CHANGEME" 2>&1 | grep -c Warning',
        what: 'Confirms the check block warns without failing.',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve -var="tier=silver" && rm -f config.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the file, state and cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-input-variables', 'tf-dynamic-blocks-and-lifecycle', 'tf-outputs'],
  docs: [
    {
      title: 'Custom conditions',
      url: 'https://developer.hashicorp.com/terraform/language/expressions/custom-conditions',
    },
    {
      title: 'Checks',
      url: 'https://developer.hashicorp.com/terraform/language/checks',
    },
  ],
}
