import type { Topic } from '../../../types'

export const outputs: Topic = {
  id: 'tf-outputs',
  title: 'Output values',
  domainId: 'tf-configuration',
  difficulty: 'beginner',
  estimatedMinutes: 13,
  order: 4,
  tags: ['output', 'sensitive', 'remote state', 'module boundary', 'objective-4c'],
  oneLiner:
    'Publishing values out of a configuration or module - the only way anything outside can read what you built.',
  explanation: [
    'An `output` block publishes a value. It has three audiences: a person running the CLI, a parent configuration consuming a module, and another configuration reading remote state.',
    'For a **module**, outputs are the entire public interface. A resource inside a module is invisible to its caller unless an output exposes it. This is the module boundary, and it is deliberate.',
    'Outputs are stored in state. That is what lets `terraform output` work without a plan, and what lets another configuration read them via `terraform_remote_state`.',
    '`sensitive = true` on an output stops it appearing in CLI output and plan display. As with variables, the value is still in state in plaintext.',
  ],
  whyItMatters: [
    'Objective 4c covers variables and outputs together. Outputs also underpin objective 5, because they are how modules return anything.',
    'A module with no outputs is a black box: you cannot wire it to anything. Getting the outputs right is most of designing a good module.',
    'Outputs in state are how separate configurations share values without copy-paste.',
  ],
  howItWorks: [
    '`value` is required and may be any expression. `description` is optional but always worth writing - it appears in generated documentation.',
    '`sensitive = true` redacts the value from CLI and plan output. Referencing a sensitive value elsewhere makes that context sensitive too, which sometimes propagates further than expected.',
    'Outputs are written to state at the end of an apply, so `terraform output` reads state rather than re-planning.',
    '`depends_on` is available on outputs, for the rare case where a consumer must not read the value until something else has completed.',
    'A module’s outputs are referenced by the caller as `module.<NAME>.<OUTPUT>`. Nothing else inside the module is reachable.',
    '`precondition` blocks inside an output let you assert something about the result before it is published.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Outputs are the module boundary',
      caption:
        'The caller can reach exactly the two outputs. The resources inside are unreachable, however much you want them.',
      root: {
        label: 'Root configuration',
        children: [
          {
            label: 'module "network"',
            detail: 'The caller sees only what the module publishes',
            tone: 'accent',
            children: [
              {
                label: 'output "vpc_id"',
                detail: 'Reachable as module.network.vpc_id',
                tone: 'success',
              },
              {
                label: 'output "subnet_ids"',
                detail: 'Reachable as module.network.subnet_ids',
                tone: 'success',
              },
              {
                label: 'aws_vpc.this, aws_subnet.private',
                detail: 'NOT reachable from outside the module',
                tone: 'muted',
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'What should a module output?',
      caption:
        'Output identifiers and endpoints callers need. Do not output your internals just in case.',
      question: 'Will a caller need this value?',
      branches: [
        {
          condition: 'to reference the resource elsewhere',
          result: 'Output the id or arn',
          detail: 'The most common and most useful case',
          tone: 'accent',
        },
        {
          condition: 'to connect to it',
          result: 'Output the endpoint or DNS name',
          detail: 'Host, port, connection string',
        },
        {
          condition: 'only for debugging, today',
          result: 'Do not output it',
          detail: 'Outputs are a contract; removing one is a breaking change',
        },
        {
          condition: 'it is a password or key',
          result: 'Output it with sensitive = true',
          detail: 'And remember state still holds the plaintext',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'output block',
      purpose:
        'Publishes a value to the CLI, to a parent configuration, or to remote state consumers.',
      fields: [
        { path: 'value', meaning: 'The expression to publish. Required.', required: true },
        { path: 'description', meaning: 'What the value is. Appears in generated docs.' },
        { path: 'sensitive', meaning: 'Redacts CLI and plan display. State keeps plaintext.' },
        {
          path: 'depends_on',
          meaning: 'Rarely needed; defers the value until something else completes.',
        },
        { path: 'precondition', meaning: 'Assert something about the value before publishing it.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The module nobody could use',
    story: [
      'A team wrote a reusable networking module. It created a VPC, subnets, route tables and a NAT gateway - correctly, and with sensible variables.',
      'It had one output: `vpc_id`. The first team to adopt it needed subnet ids to place their instances, and there was no way to get them.',
      'They forked the module rather than wait for a change, and within two months there were three divergent copies of the same networking code.',
      'A module’s outputs are its API. Under-specifying them does not keep the module simple; it makes people copy it. Two more outputs at the start would have avoided the fork entirely.',
    ],
    code: [
      {
        title: 'The outputs the module should have had',
        language: 'hcl',
        code: `output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets, in AZ order."
  value       = [for s in aws_subnet.private : s.id]
}

output "public_subnet_ids" {
  description = "IDs of the public subnets, in AZ order."
  value       = [for s in aws_subnet.public : s.id]
}

output "nat_gateway_ip" {
  description = "Public IP used for egress, for allow-listing."
  value       = aws_eip.nat.public_ip
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Outputs of every kind',
      language: 'hcl',
      explanation:
        'The last one shows a `precondition`: the value is only published if the assertion holds, which turns a silent misconfiguration into a clear error.',
      code: `output "instance_id" {
  description = "ID of the web instance."
  value       = aws_instance.web.id
}

output "all_instance_ips" {
  description = "Private IPs of every web instance."
  value       = aws_instance.web[*].private_ip
}

output "connection" {
  description = "Structured connection details for the database."
  value = {
    host = aws_db_instance.main.address
    port = aws_db_instance.main.port
    name = aws_db_instance.main.db_name
  }
}

output "db_password" {
  description = "Generated database password."
  value       = random_password.db.result
  sensitive   = true
}

output "load_balancer_dns" {
  description = "Public DNS name of the load balancer."
  value       = aws_lb.web.dns_name

  precondition {
    condition     = length(aws_lb.web.subnets) >= 2
    error_message = "A load balancer needs at least two subnets to be highly available."
  }
}`,
    },
    {
      title: 'Reading outputs, and sharing them between configurations',
      language: 'bash',
      explanation:
        'The remote-state pattern is how one configuration consumes another’s outputs without copying values by hand.',
      code: `# Human-readable
terraform output

# One value, unquoted - the form to use in scripts
terraform output -raw load_balancer_dns

# Everything as JSON
terraform output -json | jq -r '.connection.value.host'

# A sensitive value must be asked for explicitly
terraform output -raw db_password

# --- Another configuration reading these outputs:
# data "terraform_remote_state" "network" {
#   backend = "s3"
#   config = {
#     bucket = "acme-tfstate"
#     key    = "network/terraform.tfstate"
#     region = "eu-west-1"
#   }
# }
#
# resource "aws_instance" "app" {
#   subnet_id = data.terraform_remote_state.network.outputs.private_subnet_ids[0]
# }`,
    },
  ],
  imperative: [
    {
      command: 'terraform output',
      what: 'Prints every output. Sensitive ones show as (sensitive value).',
    },
    {
      command: 'terraform output -raw <name>',
      what: 'Prints one value with no quotes or formatting - the scripting form.',
    },
    {
      command: 'terraform output -json',
      what: 'Every output as JSON, including type information.',
    },
    {
      command: 'terraform output -raw db_password',
      what: 'Reveals a sensitive output deliberately.',
      namespaceNote: 'The redaction is a guard against accidental display, not an access control.',
    },
    {
      command: 'terraform show -json | jq .values.outputs',
      what: 'Reads outputs out of state directly.',
    },
  ],
  declarative: {
    steps: [
      'Give every output a `description`.',
      'Output identifiers, endpoints and anything a caller must reference - nothing else.',
      'Mark secrets `sensitive = true`, and remember state still holds plaintext.',
      'Treat a module’s outputs as a published API: adding one is safe, removing or renaming one is breaking.',
      'Use `precondition` to assert invariants rather than publishing a value that cannot be right.',
    ],
    code: [
      {
        title: 'Sensitivity propagates further than people expect',
        language: 'hcl',
        explanation:
          'Once a sensitive value is used in an expression, the result is sensitive too - and Terraform will refuse to display it until you say `nonsensitive`.',
        code: `resource "random_password" "db" {
  length = 32
}

# Sensitive, correctly.
output "password" {
  value     = random_password.db.result
  sensitive = true
}

# This output is ALSO sensitive automatically, because it
# contains a sensitive value. Terraform errors if you omit
# sensitive = true here.
output "connection_string" {
  value     = "postgres://admin:\${random_password.db.result}@\${aws_db_instance.main.address}/app"
  sensitive = true
}

# Sometimes only part of a derived value is secret. nonsensitive()
# is the deliberate escape hatch - use it only when you are sure.
output "password_length" {
  value = nonsensitive(length(random_password.db.result))
}`,
      },
    ],
  },
  verification: [
    {
      command: "terraform output -json | jq 'keys'",
      what: 'Lists the names a module or configuration publishes.',
    },
    {
      command: 'terraform output -raw <name> | wc -c',
      what: 'Confirms a sensitive value is non-empty without printing it.',
    },
    {
      command: "terraform show -json | jq '.values.outputs | map_values(.sensitive)'",
      what: 'Shows which outputs are marked sensitive.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform output',
      what: 'Reports "No outputs found" - none are declared, or the apply has not run.',
    },
    {
      command: 'terraform apply',
      what: 'Reports "Output refers to sensitive values" - add `sensitive = true` to the output.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "Unsupported attribute" on `module.x.y` - `y` is not a declared output of that module.',
    },
    {
      command: 'terraform refresh',
      what: 'Outputs are stale after a manual state edit; a refresh-only apply recomputes them.',
    },
  ],
  commonMistakes: [
    'Expecting to reference a resource inside a module. Only declared outputs are reachable.',
    'Believing `sensitive = true` protects the value in state. It redacts display only.',
    'Removing or renaming a module output. That is a breaking change for every caller.',
    'Using `terraform output <name>` in a script - it adds quotes. Use `-raw`.',
    'Outputting internal values "in case they are useful". Outputs are a contract; keep them intentional.',
    'Forgetting that a value derived from a sensitive one is itself sensitive, and being surprised by the resulting error.',
  ],
  examTips: [
    '`value` is the only required argument of an output block.',
    'Module outputs are the only way a caller can read anything from a module.',
    'Reference a module output as `module.<name>.<output>`.',
    'Outputs are stored in state, which is what `terraform output` and `terraform_remote_state` read.',
    '`sensitive = true` redacts CLI display; state keeps plaintext.',
    '`terraform output -raw` is the unquoted form for scripts.',
  ],
  summary: [
    'Outputs publish values to people, to parent configurations and to remote state.',
    'For a module, the outputs are the whole public interface.',
    'Outputs live in state, so `terraform output` needs no plan.',
    '`sensitive` hides values from display, not from state.',
    'Use `-raw` in scripts, and treat output names as a contract.',
  ],
  practice: [
    {
      id: 'tf-outputs-p1',
      level: 'beginner',
      prompt:
        'You need a VPC id created inside a module. Can you reference `module.network.aws_vpc.this.id`?',
      answer: 'No. You must declare an output in the module and reference `module.network.vpc_id`.',
      explanation:
        'The module boundary is strict: only declared outputs cross it. This is what makes a module’s interface stable.',
    },
    {
      id: 'tf-outputs-p2',
      level: 'beginner',
      prompt: 'Which command prints an output suitable for use in a shell variable?',
      answer: '`terraform output -raw <name>` - it omits the surrounding quotes.',
      explanation:
        'Plain `terraform output <name>` prints a quoted HCL value, which breaks most scripts.',
    },
    {
      id: 'tf-outputs-p3',
      level: 'intermediate',
      prompt:
        'You build a connection string containing a sensitive password and Terraform errors on the output. Why, and what are your two options?',
      answer:
        'Because a value derived from a sensitive value is sensitive, and Terraform refuses to publish it unmarked. Either add `sensitive = true` to the output, or wrap the non-secret part in `nonsensitive()` if only part of it needs publishing.',
      explanation:
        'The propagation is deliberate: it stops a secret leaking through a derived value that nobody thought to mark.',
    },
    {
      id: 'tf-outputs-p4',
      level: 'advanced',
      prompt:
        'What is the risk of exposing a database password through a module output, even marked sensitive, and what is the alternative?',
      answer:
        'The value is stored in plaintext in both configurations’ state files, and anyone who can read state can read it. The alternative is to write the secret to a secrets manager inside the module and output only its identifier, so the value never crosses a state boundary.',
      explanation:
        'Outputting an ARN or a secret name rather than the secret itself keeps state free of the credential and lets access control live in the secrets manager.',
    },
  ],
  lab: {
    title: 'Build a module interface',
    scenario:
      'Write a small local module, discover that its internals are unreachable, add the outputs to fix it, and see sensitivity propagate.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create `modules/greeter/` with a `random_pet` and a `local_file`, and NO outputs. Call it from the root.',
      },
      {
        instruction:
          'Try to reference the pet name from the root as `module.greeter.random_pet.name.id` and read the error.',
      },
      {
        instruction:
          'Add outputs for the pet name and the file path, then reference them successfully.',
      },
      { instruction: 'Run `terraform output` and `terraform output -json` and compare.' },
      {
        instruction:
          'Add a `random_password` in the module and output it with `sensitive = true`. Confirm `terraform output` redacts it.',
      },
      {
        instruction:
          'Add a root output that embeds the password in a string WITHOUT marking it sensitive. Read the error, then fix it.',
      },
      {
        instruction: 'Add a `precondition` to one output that fails, and read the message.',
      },
      {
        instruction:
          'Find the password in the state file, and note what that means for state handling.',
      },
      { instruction: 'Clean up.' },
    ],
    solution: [
      {
        title: 'modules/greeter/main.tf',
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

resource "random_password" "token" {
  length = 20
}

resource "local_file" "greeting" {
  filename = "\${path.root}/greeting.txt"
  content  = "hello \${random_pet.name.id}\\n"
}

output "pet_name" {
  description = "Generated pet name."
  value       = random_pet.name.id
}

output "greeting_path" {
  description = "Path of the greeting file."
  value       = local_file.greeting.filename

  precondition {
    condition     = endswith(local_file.greeting.filename, ".txt")
    error_message = "The greeting file must have a .txt extension."
  }
}

output "token" {
  description = "Generated token."
  value       = random_password.token.result
  sensitive   = true
}`,
      },
      {
        title: 'Root main.tf',
        language: 'hcl',
        code: `module "greeter" {
  source = "./modules/greeter"
}

output "pet" {
  value = module.greeter.pet_name
}

# This MUST be marked sensitive: it embeds a sensitive value.
output "auth_header" {
  value     = "Bearer \${module.greeter.token}"
  sensitive = true
}`,
      },
      {
        title: 'The experiment',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

# Reaching into a module fails:
#   output "bad" { value = module.greeter.random_pet.name.id }
terraform validate
# Error: Unsupported attribute
#   This object does not have an attribute named "random_pet".

terraform output
# auth_header = <sensitive>
# pet         = "clever-mongoose"

terraform output -json | jq 'map_values(.sensitive)'
# { "auth_header": true, "pet": false }

terraform output -raw auth_header   # revealed deliberately

# Omit sensitive = true on auth_header and:
terraform apply
# Error: Output refers to sensitive values
#   ... add sensitive = true

# Break the precondition by renaming the file to greeting.log:
terraform apply
# Error: Module output value precondition failed
#   The greeting file must have a .txt extension.

# The password is in state regardless of the sensitive flag:
grep -c "$(terraform output -raw auth_header | sed 's/Bearer //')" terraform.tfstate

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform output -json | jq -r \'keys | join(", ")\'',
        what: 'Lists the root outputs.',
        expected: 'auth_header, pet',
      },
      {
        command: "terraform show -json | jq '.values.outputs.auth_header.sensitive'",
        what: 'Confirms the sensitivity flag is recorded in state.',
        expected: 'true',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf modules greeting.txt .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the module, the file and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-input-variables', 'tf-module-variables-and-scope', 'tf-remote-backends'],
  docs: [
    {
      title: 'Output values',
      url: 'https://developer.hashicorp.com/terraform/language/values/outputs',
    },
  ],
}
