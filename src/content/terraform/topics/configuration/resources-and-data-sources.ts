import type { Topic } from '../../../types'

export const resourcesAndDataSources: Topic = {
  id: 'tf-resources-and-data-sources',
  title: 'resource and data blocks',
  domainId: 'tf-configuration',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 1,
  tags: ['resource', 'data', 'managed', 'read-only', 'objective-4a'],
  oneLiner:
    'The two block types that touch infrastructure: one creates and manages, one only reads.',
  explanation: [
    'A **resource block** declares something Terraform creates, updates and destroys. It appears in state as a *managed* resource, and Terraform is responsible for its whole lifecycle.',
    'A **data block** declares something Terraform only reads. It queries the provider for information about something that already exists - an AMI, an existing VPC, the current account ID - and never creates or changes anything.',
    'Both take two labels: `resource "aws_instance" "web"` gives the **type** (which provider and which kind) and the **name** (your local label). Together they form the **address** `aws_instance.web`, which is how everything else refers to it.',
    'Data sources are read during plan, before any changes. That is why a data source cannot depend on something the same apply is about to create - it would have nothing to read.',
  ],
  whyItMatters: [
    'Objective 4a asks you to use and differentiate `resource` and `data` blocks. The distinction is the foundation of the whole language.',
    'Reaching for a data source instead of hard-coding an ID is what makes a configuration portable between accounts and regions.',
    'Understanding that data sources are read early explains a whole class of "value is unknown" errors.',
  ],
  howItWorks: [
    'A resource block’s address is `<type>.<name>`; a data block’s address is `data.<type>.<name>`. The `data.` prefix is part of the address and easy to forget.',
    'Arguments you set are the *configuration*. Attributes the provider fills in - `id`, `arn`, computed defaults - are readable but not settable.',
    'Terraform reads data sources during the plan phase. If a data source’s arguments depend on a not-yet-created resource, its result is unknown, and everything downstream becomes unknown too.',
    'Data sources appear in state, but as `mode: "data"`. They are refreshed on every run and never destroyed.',
    'Both block types accept the meta-arguments `count`, `for_each`, `provider`, `depends_on` and (resources only) `lifecycle`.',
    'A data source that finds nothing is an error by default, not an empty result. Filters that match several objects are an error too, unless the data source supports plural results.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'resource or data?',
      caption:
        'One question decides it: does Terraform own this thing’s lifecycle, or is it just looking it up?',
      question: 'Who is responsible for creating and deleting it?',
      branches: [
        {
          condition: 'Terraform creates and destroys it',
          result: 'resource block',
          detail: 'Managed. Appears in plans as +, ~, - or -/+',
          tone: 'accent',
        },
        {
          condition: 'it already exists and you only need its values',
          result: 'data block',
          detail: 'Read-only. Never appears as a change in a plan.',
        },
        {
          condition: 'another team owns it and you must not touch it',
          result: 'data block',
          detail: 'The safe way to reference infrastructure you do not own',
        },
        {
          condition: 'it exists but you want Terraform to take over',
          result: 'resource block plus import',
          detail: 'A data source would never let you manage it',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'When each block is evaluated',
      caption:
        'Data sources are read before changes are made. That ordering is the reason a data source cannot read something the same run is creating.',
      nodes: [
        {
          label: 'Plan begins',
          detail: 'Configuration and state loaded',
        },
        {
          label: 'Data sources are read',
          detail: 'Provider queries for existing objects',
          tone: 'accent',
          branch: {
            label: 'Arguments not yet known',
            detail: 'Result becomes unknown; the read is deferred to apply',
          },
        },
        {
          label: 'Managed resources are refreshed',
          detail: 'Current attributes fetched from the provider',
        },
        {
          label: 'The diff is computed',
          detail: 'Data source values are inputs to it, never outputs of it',
        },
        {
          label: 'Apply changes managed resources only',
          detail: 'Data sources are never created, changed or destroyed',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'resource block',
      purpose: 'Declares infrastructure Terraform owns: created, updated and destroyed by it.',
      fields: [
        {
          path: 'resource "<TYPE>" "<NAME>"',
          meaning: 'Type and local name; address is TYPE.NAME.',
          required: true,
        },
        { path: '(arguments)', meaning: 'What you set. Provider-specific.' },
        { path: '(attributes)', meaning: 'What the provider computes, e.g. id, arn. Read-only.' },
        { path: 'count / for_each', meaning: 'Create several instances from one block.' },
        { path: 'lifecycle', meaning: 'prevent_destroy, create_before_destroy, ignore_changes.' },
      ],
    },
    {
      kind: 'data block',
      purpose: 'Reads information about something that already exists. Never creates or modifies.',
      fields: [
        {
          path: 'data "<TYPE>" "<NAME>"',
          meaning: 'Address is data.TYPE.NAME - the prefix is required.',
          required: true,
        },
        {
          path: '(query arguments)',
          meaning: 'Filters that select which existing object to read.',
        },
        { path: 'depends_on', meaning: 'Rarely needed, but available to defer the read.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The hard-coded AMI that expired',
    story: [
      'A configuration pinned `ami = "ami-0abc123"`. It worked for a year, then the team copied the configuration into a second region and every instance failed to launch: AMI IDs are region-specific.',
      'They fixed it by adding a region variable and a lookup map. Six months later the AMI was deregistered for a security update and the map was stale again.',
      'Replacing all of it with a `data "aws_ami"` block that filters on name and owner solved both problems at once. The lookup happens at plan time, in whatever region the provider is configured for, and always finds the current image.',
      'The trade-off is honest and worth knowing: because the AMI can change under you, a plan may now propose replacing instances when a new image is published. Teams that want stability pin the AMI in a variable and update it deliberately - the point is that this becomes a choice rather than an accident.',
    ],
    code: [
      {
        title: 'The lookup that replaced the map',
        language: 'hcl',
        code: `data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "web" {
  # Correct in every region, always current.
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Resources and data sources together',
      language: 'hcl',
      explanation:
        'Three data sources feed one resource. None of them appears as a change in the plan - they are inputs, not outputs.',
      code: `# Read-only: information about the account we are running in.
data "aws_caller_identity" "current" {}

# Read-only: a VPC another team owns and manages.
data "aws_vpc" "shared" {
  tags = {
    Name = "shared-services"
  }
}

# Read-only: the subnets inside it.
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.shared.id]
  }

  tags = {
    Tier = "private"
  }
}

# Managed: this is ours, and Terraform owns its lifecycle.
resource "aws_security_group" "app" {
  name   = "app-\${data.aws_caller_identity.current.account_id}"
  vpc_id = data.aws_vpc.shared.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`,
    },
    {
      title: 'The mistake data sources cannot fix',
      language: 'hcl',
      explanation:
        'A data source reads what exists. Reading something the same apply creates is both unnecessary and a source of unknown-value errors - reference the resource directly instead.',
      code: `resource "aws_s3_bucket" "logs" {
  bucket = "acme-logs"
}

# WRONG: reading a bucket this apply is creating.
# On the first run the bucket does not exist yet.
data "aws_s3_bucket" "logs" {
  bucket = aws_s3_bucket.logs.id
}

# RIGHT: the resource already exposes everything the data
# source would have returned.
output "bucket_arn" {
  value = aws_s3_bucket.logs.arn
}

output "bucket_domain" {
  value = aws_s3_bucket.logs.bucket_regional_domain_name
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform state list',
      what: 'Lists managed resources and data sources - data addresses are prefixed with `data.`.',
      expected: 'aws_security_group.app and data.aws_vpc.shared',
    },
    {
      command: 'terraform state show data.aws_vpc.shared',
      what: 'Shows every attribute a data source returned - the fastest way to discover what is available.',
    },
    {
      command: 'terraform console',
      what: 'An interactive prompt for evaluating expressions against real state and data sources.',
      namespaceNote:
        'Type `data.aws_vpc.shared` to dump it, or `aws_instance.web.private_ip` for one value.',
    },
    {
      command:
        "terraform providers schema -json | jq '.provider_schemas[].data_source_schemas | keys'",
      what: 'Lists every data source a provider offers.',
    },
  ],
  declarative: {
    steps: [
      'Use a `resource` block for anything Terraform should own.',
      'Use a `data` block for anything that exists already, especially if another team owns it.',
      'Never write a data source that reads a resource in the same configuration - reference the resource.',
      'Make data source filters specific enough to match exactly one object.',
      'Discover available attributes with `terraform state show` or `terraform console` rather than guessing.',
    ],
    code: [
      {
        title: 'Making a filter unambiguous',
        language: 'hcl',
        explanation:
          'A filter matching several objects is an error, not a random choice. Being specific up front avoids a failure that only appears when the environment grows.',
        code: `# Fragile: matches every VPC once a second one is tagged similarly.
data "aws_vpc" "bad" {
  tags = {
    Environment = "production"
  }
}

# Specific: exactly one object, or a clear error.
data "aws_vpc" "good" {
  tags = {
    Name        = "prod-vpc-eu-west-1"
    Environment = "production"
    ManagedBy   = "platform-team"
  }
}

# When several matches are legitimate, use the plural data source.
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.good.id]
  }
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state show data.aws_ami.ubuntu | head -20',
      what: 'Confirms which object a data source actually resolved to.',
    },
    {
      command: "terraform console <<< 'data.aws_caller_identity.current.account_id'",
      what: 'Evaluates one data source attribute without running a plan.',
    },
    {
      command: 'terraform plan',
      what: 'Data sources never appear as changes. If one does, it is a resource block by mistake.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports "Your query returned no results" - the data source filter matched nothing.',
    },
    {
      command: 'terraform plan',
      what: 'Reports "multiple ... matched" - the filter is too broad; add another tag or use the plural data source.',
    },
    {
      command: 'terraform plan',
      what: 'Reports a value is not known until apply - a data source depends on something being created this run.',
    },
    {
      command: 'terraform state show <address>',
      what: 'Lists the real attribute names when "Unsupported attribute" says your guess was wrong.',
    },
  ],
  commonMistakes: [
    'Forgetting the `data.` prefix in a reference. `aws_vpc.shared` and `data.aws_vpc.shared` are different addresses.',
    'Reading a resource with a data source in the same configuration. Reference the resource directly.',
    'Writing a filter loose enough to match several objects. That is an error, not a lucky guess.',
    'Trying to set a computed attribute such as `id` or `arn`. Those are read-only.',
    'Hard-coding IDs where a data source would work. The configuration then only works in one account and region.',
    'Expecting a data source to appear in a plan as a change. It never does.',
  ],
  examTips: [
    '`resource` creates and manages; `data` only reads. This distinction is objective 4a.',
    'A data source address always begins `data.`, e.g. `data.aws_ami.ubuntu.id`.',
    'Data sources are read during plan, before any changes are applied.',
    'Data sources appear in state with `mode: "data"` and are never destroyed.',
    'A data source returning no match is an error; so is an ambiguous match.',
    'Both block types accept `count`, `for_each`, `provider` and `depends_on`.',
  ],
  summary: [
    '`resource` = Terraform owns it. `data` = Terraform reads it.',
    'The address is `type.name`, or `data.type.name` for a data source.',
    'Data sources are evaluated at plan time and never change anything.',
    'Never read your own resources with a data source - reference them.',
    'Data sources are how a configuration stops being tied to one account or region.',
  ],
  practice: [
    {
      id: 'tf-resources-p1',
      level: 'beginner',
      prompt: 'Write the full reference for the `id` attribute of `data "aws_ami" "ubuntu"`.',
      answer: '`data.aws_ami.ubuntu.id`',
      explanation:
        'The `data.` prefix is part of the address. Omitting it is one of the most common beginner errors.',
    },
    {
      id: 'tf-resources-p2',
      level: 'beginner',
      prompt:
        'Another team manages the shared VPC. Which block type do you use to reference it, and why?',
      answer:
        'A `data` block. It reads the VPC without taking ownership, so Terraform will never modify or destroy something you do not own.',
      explanation:
        'Using a `resource` block would mean either an import - taking over management - or a plan that tries to create a duplicate.',
    },
    {
      id: 'tf-resources-p3',
      level: 'intermediate',
      prompt:
        'What happens on the first `terraform apply` if a data source filters on the ID of a resource created in the same configuration?',
      answer:
        'The data source’s arguments are unknown at plan time, so its result is unknown and everything depending on it is too. The read is deferred to apply, and it may still fail. The correct fix is to reference the resource attributes directly.',
      explanation:
        'Data sources exist to read things Terraform did not create. Anything Terraform created already exposes its own attributes.',
    },
    {
      id: 'tf-resources-p4',
      level: 'advanced',
      prompt:
        'You replace a hard-coded AMI ID with a `most_recent = true` data source. What new behaviour have you introduced, and how would you control it?',
      answer:
        'The AMI can now change between runs, so a plan may propose replacing every instance when a new image is published. To control it, either pin the AMI in a variable and update it deliberately, or add `lifecycle { ignore_changes = [ami] }` so replacement only happens when you choose.',
      explanation:
        'This is a real trade-off between currency and stability. The important thing is that it becomes an explicit decision rather than a surprise during an unrelated change.',
    },
  ],
  lab: {
    title: 'Read, create, and tell the difference',
    scenario:
      'Use credential-free providers to build both block types, inspect them in state, and reproduce the two classic data-source errors.',
    prerequisites: ['Terraform 1.5 or newer', 'jq'],
    tasks: [
      {
        instruction:
          'Create a `local_file` resource, then a `data "local_file"` block that reads a file you create by hand outside Terraform.',
        hint: 'echo "external" > external.txt before you plan.',
      },
      {
        instruction:
          'Apply, then run `terraform state list` and note how the two addresses differ.',
      },
      {
        instruction: 'Run `terraform state show` on both and compare what each contains.',
      },
      {
        instruction:
          'Delete `external.txt` and run a plan. Explain the error and why it is different from a resource going missing.',
      },
      {
        instruction:
          'Recreate the file, then add a data source that reads the file your own `local_file` resource creates. Note the error on a fresh state.',
        hint: 'Destroy first so the resource does not exist yet.',
      },
      {
        instruction:
          'Replace that data source with a direct reference to the resource’s `content` attribute and confirm it works.',
      },
      { instruction: 'Use `terraform console` to evaluate both addresses interactively.' },
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

# Managed: Terraform creates and owns this.
resource "local_file" "managed" {
  filename = "\${path.module}/managed.txt"
  content  = "written by terraform\\n"
}

# Read-only: something that exists outside Terraform.
data "local_file" "external" {
  filename = "\${path.module}/external.txt"
}

output "external_content" {
  value = data.local_file.external.content
}

# The right way to read your own resource: reference it.
output "managed_content" {
  value = local_file.managed.content
}`,
      },
      {
        title: 'The experiment',
        language: 'bash',
        code: `echo "external" > external.txt
terraform init && terraform apply -auto-approve

terraform state list
# data.local_file.external      <- note the prefix
# local_file.managed

terraform state show local_file.managed        # has content, filename, permissions
terraform state show data.local_file.external  # has content and filename only

# Data source target disappears:
rm external.txt
terraform plan
# Error: Invalid function argument / no such file
# Note: this is a READ failure at plan time, not a "resource
# was deleted, I will recreate it" plan like a managed resource.

echo "external" > external.txt

# The anti-pattern, on a fresh state:
terraform destroy -auto-approve
#   add:  data "local_file" "self" { filename = local_file.managed.filename }
terraform plan
# Error: the file does not exist yet - the data source is read
# before the resource that creates it.

# Remove that data source; use the output above instead.
terraform apply -auto-approve
terraform output managed_content

echo 'data.local_file.external.content' | terraform console
echo 'local_file.managed.filename'      | terraform console

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list | grep -c "^data\\."',
        what: 'Counts data sources in state.',
        expected: '1',
      },
      {
        command:
          'terraform show -json | jq -r \'.values.root_module.resources[] | "\\(.address) \\(.mode)"\'',
        what: 'Shows the mode - managed or data - for every entry.',
        expected: 'data.local_file.external data and local_file.managed managed',
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
    'tf-references-and-dependencies',
    'tf-input-variables',
    'tf-importing-infrastructure',
  ],
  docs: [
    {
      title: 'Resources',
      url: 'https://developer.hashicorp.com/terraform/language/resources',
    },
    {
      title: 'Data sources',
      url: 'https://developer.hashicorp.com/terraform/language/data-sources',
    },
  ],
}
