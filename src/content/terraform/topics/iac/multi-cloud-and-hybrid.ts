import type { Topic } from '../../../types'

export const multiCloudAndHybrid: Topic = {
  id: 'tf-multi-cloud-and-hybrid',
  title: 'Multi-cloud, hybrid cloud and portability',
  domainId: 'tf-iac',
  difficulty: 'intermediate',
  estimatedMinutes: 13,
  order: 3,
  tags: ['multi-cloud', 'hybrid', 'portability', 'objective-1c'],
  oneLiner:
    'What Terraform does and does not abstract when your infrastructure spans more than one platform.',
  explanation: [
    '**Multi-cloud** means using more than one public cloud. **Hybrid cloud** means combining public cloud with infrastructure you run yourself. Terraform handles both the same way: one provider per platform, one configuration, one graph.',
    'The important limit: Terraform unifies the *workflow*, not the *resource models*. There is no generic `terraform_virtual_machine` that becomes an EC2 instance on AWS and a VM on Azure. You write `aws_instance` or `azurerm_linux_virtual_machine`, and they have different fields.',
    'So "portability" in Terraform means portability of skills, tooling and process - not lift-and-shift of configuration between clouds. Exam questions sometimes offer the stronger claim as a distractor.',
    'Where Terraform genuinely shines across platforms is **wiring things together**: passing an AWS endpoint into a Kubernetes secret, or an Azure IP into a Cloudflare record, with correct ordering and no human copy-paste.',
  ],
  whyItMatters: [
    'Objective 1c is exactly this topic, and the trap is over-claiming. Knowing the boundary between "one workflow" and "one resource model" is the difference between a right and a wrong answer.',
    'In practice most estates are already hybrid - a cloud account plus DNS plus a SaaS monitoring tool. Terraform is how those stop being three separate manual processes.',
    'It also explains why abstraction has to happen in *modules*, not in Terraform itself.',
  ],
  howItWorks: [
    'Each platform contributes a provider. Providers are independent plugins, downloaded per configuration by `terraform init`.',
    'A configuration may declare as many providers as it needs. They authenticate separately, using their own credentials and environment variables.',
    'Cross-platform ordering comes free: referencing an attribute of a resource in provider A from a resource in provider B creates a graph edge.',
    'Where you genuinely want one interface over two clouds, you build a **module** that takes neutral inputs and contains the per-cloud resources - the abstraction lives in your code, not in Terraform.',
    'For hybrid estates, on-premises providers (vsphere, kubernetes, helm, ad, f5) behave exactly like cloud ones, so private infrastructure joins the same review and audit trail.',
    'State stays single: one state file can hold resources from every provider involved, which is what makes the graph possible in the first place.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'What Terraform does and does not unify',
      caption:
        'The exam trap is the third row. Terraform gives you one workflow, never one resource model.',
      question: 'What are you hoping is portable across clouds?',
      branches: [
        {
          condition: 'the CLI, the workflow and the review process',
          result: 'Yes, fully unified',
          detail: 'init, plan, apply and state are identical everywhere',
          tone: 'accent',
        },
        {
          condition: 'the language and your own skills',
          result: 'Yes, HCL is the same',
          detail: 'One language for every provider',
        },
        {
          condition: 'the resource blocks themselves',
          result: 'No - provider-specific',
          detail: 'aws_instance and azurerm_linux_virtual_machine differ',
          tone: 'warning',
        },
        {
          condition: 'one interface over two clouds',
          result: 'Build a module',
          detail: 'The abstraction is yours to write, not Terraform’s',
        },
      ],
    },
    {
      kind: 'sequence',
      title: 'Wiring two platforms together in one apply',
      caption:
        'The value is not that Terraform hides the clouds. It is that the handover between them stops being a manual step.',
      participants: [
        { id: 'tf', label: 'Terraform' },
        { id: 'aws', label: 'AWS provider' },
        { id: 'k8s', label: 'Kubernetes provider' },
      ],
      messages: [
        { from: 'tf', to: 'aws', label: 'create the RDS instance' },
        { from: 'aws', to: 'tf', label: 'endpoint = db.abc.rds...', kind: 'return' },
        { from: 'tf', to: 'tf', label: 'graph edge satisfied' },
        { from: 'tf', to: 'k8s', label: 'create Secret with that endpoint' },
        { from: 'k8s', to: 'tf', label: 'Secret created', kind: 'return' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'provider block',
      purpose:
        'Configures one platform: region, credentials, endpoints. Several may appear, including several of the same type with different aliases.',
      fields: [
        { path: 'alias', meaning: 'Names an extra copy of a provider, e.g. a second region.' },
        {
          path: 'region / subscription_id / project',
          meaning: 'Platform-specific targeting. Different in every provider.',
        },
        {
          path: 'provider (meta-argument on a resource)',
          meaning: 'Selects which aliased provider a resource uses, e.g. aws.eu.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'One repository, three platforms, no runbook',
    story: [
      'A team runs its application on AWS, its DNS on Cloudflare, and its alerting in Datadog. Before Terraform, deploying a new region meant a nine-step runbook with two "copy this value from the previous step" instructions.',
      'Those two steps caused every incident during a rollout. Not the infrastructure - the copying.',
      'Consolidating into one configuration made the copying into references. The runbook became `terraform apply`, and the ordering became a property of the code rather than of whoever was on shift.',
      'Nothing about AWS or Cloudflare got simpler. What changed was that the seams between them were no longer maintained by hand.',
    ],
  },
  yamlExamples: [
    {
      title: 'A hybrid configuration: cloud plus on-premises',
      language: 'hcl',
      explanation:
        'Two entirely different platforms, one workflow. The vSphere VM and the AWS record are ordered correctly because of the reference.',
      code: `terraform {
  required_providers {
    vsphere = { source = "hashicorp/vsphere", version = "~> 2.8" }
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "vsphere" {
  user           = var.vsphere_user
  password       = var.vsphere_password
  server         = var.vsphere_server
  # Typical for a lab or private datacentre.
  allow_unverified_ssl = true
}

provider "aws" {
  region = "eu-west-1"
}

resource "vsphere_virtual_machine" "app" {
  name             = "app-01"
  resource_pool_id = data.vsphere_compute_cluster.dc.resource_pool_id
  num_cpus         = 4
  memory           = 8192

  network_interface {
    network_id = data.vsphere_network.lan.id
  }
}

# Public DNS for a private VM: the classic hybrid pattern.
resource "aws_route53_record" "app" {
  zone_id = var.zone_id
  name    = "app.internal.example.com"
  type    = "A"
  ttl     = 300
  records = [vsphere_virtual_machine.app.default_ip_address]
}`,
    },
    {
      title: 'Your own abstraction, since Terraform provides none',
      language: 'hcl',
      explanation:
        'If you truly need one interface over two clouds, this is where it lives: a module with neutral inputs and a per-cloud implementation inside.',
      code: `# modules/object-storage/variables.tf
variable "cloud" {
  type = string
  validation {
    condition     = contains(["aws", "azure"], var.cloud)
    error_message = "cloud must be aws or azure."
  }
}

variable "name" {
  type = string
}

# modules/object-storage/main.tf
resource "aws_s3_bucket" "this" {
  count  = var.cloud == "aws" ? 1 : 0
  bucket = var.name
}

resource "azurerm_storage_container" "this" {
  count                 = var.cloud == "azure" ? 1 : 0
  name                  = var.name
  storage_account_name  = var.storage_account_name
  container_access_type = "private"
}

# modules/object-storage/outputs.tf
output "id" {
  description = "Cloud-neutral identifier for the created container."
  value       = var.cloud == "aws" ? one(aws_s3_bucket.this[*].id) : one(azurerm_storage_container.this[*].id)
}`,
    },
  ],
  imperative: [
    {
      command: 'terraform providers',
      what: 'Shows every provider required, and which module required it.',
    },
    {
      command: "terraform providers schema -json | jq '.provider_schemas | keys'",
      what: 'Lists the providers whose schemas are installed in this directory.',
    },
    {
      command: 'terraform state list | cut -d. -f1 | sort -u',
      what: 'Quick answer to "which platforms does this state actually hold?"',
      expected: 'aws_route53_record, vsphere_virtual_machine, ...',
    },
    {
      command: 'terraform plan -target=aws_route53_record.app',
      what: 'Plans one resource and its dependencies. Useful when one provider is unreachable.',
      namespaceNote: 'A debugging tool, not a normal workflow - it can hide drift elsewhere.',
    },
  ],
  declarative: {
    steps: [
      'Declare every platform once in `required_providers`.',
      'Give each provider its own `provider` block and its own credential source.',
      'Pass values between platforms by reference, never by copying strings between runs.',
      'If you need a cloud-neutral interface, write a module - Terraform will not give you one.',
    ],
    code: [
      {
        title: 'One provider, two regions, via alias',
        language: 'hcl',
        explanation:
          'Aliases are how one platform appears twice. The `provider` meta-argument on a resource selects which copy to use.',
        code: `provider "aws" {
  region = "eu-west-1" # the default, used when no alias is given
}

provider "aws" {
  alias  = "us"
  region = "us-east-1"
}

resource "aws_s3_bucket" "eu" {
  bucket = "acme-eu"
}

resource "aws_s3_bucket" "us" {
  # Without this line the bucket would be created in eu-west-1.
  provider = aws.us
  bucket   = "acme-us"
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state show aws_s3_bucket.us | grep region',
      what: 'Confirms an aliased resource really landed in the other region.',
    },
    {
      command: 'terraform validate',
      what: 'Catches a reference to an alias you never declared.',
    },
    {
      command: 'terraform plan',
      what: 'Confirms cross-provider references resolve; unknown values appear as (known after apply).',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports "provider configuration not present" - the alias is referenced but not declared.',
    },
    {
      command: 'terraform init -upgrade',
      what: 'Re-resolves providers after adding a new platform to required_providers.',
    },
    {
      command: 'TF_LOG=DEBUG terraform plan 2>&1 | grep -i "provider\\."',
      what: 'Shows which provider instance handled each request when an alias is suspect.',
    },
  ],
  commonMistakes: [
    'Believing Terraform abstracts cloud differences. It abstracts the workflow; resource schemas stay provider-specific.',
    'Forgetting the `provider` meta-argument on a resource that should use an alias. It silently lands in the default provider - and so, often, the wrong region.',
    'Using `-target` as a normal workflow to avoid touching a second provider. It skips dependency evaluation and hides drift.',
    'Splitting one logically-connected estate into separate states purely by platform, then re-introducing the copy-paste you were trying to remove.',
    'Assuming credentials are shared. Every provider authenticates on its own terms.',
  ],
  examTips: [
    'Multi-cloud = several public clouds. Hybrid = public plus your own datacentre. Terraform handles both through providers.',
    'The distractor to reject: "Terraform configurations are portable between cloud providers without change". They are not.',
    'What IS portable: the CLI, the workflow, the language, the state model and your skills.',
    'One state file can hold resources from many providers - that is what makes cross-platform ordering work.',
    '`alias` plus the `provider` meta-argument is how one platform appears more than once.',
  ],
  summary: [
    'Terraform unifies the workflow across platforms, not the resource models.',
    'Multi-cloud and hybrid cloud are both just "more than one provider".',
    'Cross-platform ordering comes from references, exactly like single-platform ordering.',
    'Cloud-neutral interfaces are something you build in a module.',
    'Use `alias` to configure the same provider more than once.',
  ],
  practice: [
    {
      id: 'tf-multicloud-p1',
      level: 'beginner',
      prompt:
        'True or false: the same Terraform configuration can be pointed at AWS or Azure by changing one variable.',
      answer:
        'False, unless you wrote a module specifically to do that. Resource types are provider-specific, so the configuration itself is not interchangeable.',
      explanation:
        'This is the single most common misconception about Terraform and multi-cloud, and a frequent exam distractor.',
    },
    {
      id: 'tf-multicloud-p2',
      level: 'intermediate',
      prompt:
        'You add a second `provider "aws"` block with `alias = "dr"` for a disaster-recovery region, but the new bucket still appears in the primary region. What did you forget?',
      answer: 'The `provider = aws.dr` meta-argument on the resource itself.',
      explanation:
        'Declaring an alias makes a provider instance available; it does not change any resource. Resources always use the unaliased provider unless told otherwise.',
    },
    {
      id: 'tf-multicloud-p3',
      level: 'intermediate',
      prompt:
        'Give one concrete benefit of putting an AWS resource and a Cloudflare resource in the same configuration rather than two.',
      answer:
        'Ordering and value-passing become automatic: the DNS record can reference the load balancer attribute directly, so it cannot be created before the value exists.',
      explanation:
        'Splitting them means either a manual copy step or a remote-state data source - both more moving parts.',
    },
    {
      id: 'tf-multicloud-p4',
      level: 'advanced',
      prompt:
        'What is the practical downside of holding three platforms in one state file, and how do teams usually manage it?',
      answer:
        'Blast radius and run time: every plan touches every platform, and one unreachable provider blocks the whole run. Teams split state along ownership boundaries and connect them with remote-state data sources or explicit inputs.',
      explanation:
        'The trade-off is real: one state gives you automatic ordering, many states give you isolation. Pick per boundary, not per platform.',
    },
  ],
  lab: {
    title: 'Two providers, one graph',
    scenario:
      'Use two credential-free providers - random and local - to prove that cross-provider references produce correct ordering, then add an alias to see the meta-argument in action.',
    prerequisites: ['Terraform 1.5 or newer', 'No cloud account needed'],
    tasks: [
      {
        instruction:
          'Declare the `random` and `local` providers, generate a `random_password`, and write it into a `local_sensitive_file`.',
        hint: 'Use local_sensitive_file, not local_file, so the value is not echoed in the plan.',
      },
      { instruction: 'Run init and apply, then confirm the file contains the generated value.' },
      {
        instruction: 'Run `terraform graph` and find the edge from the file to the password.',
      },
      {
        instruction:
          'Destroy, then reverse the experiment: remove the reference and instead hard-code a value, and observe that the graph edge disappears.',
        hint: 'This is the point: the reference is the dependency.',
      },
      {
        instruction:
          'Add a second `random` provider with `alias = "short"` and a second password that uses `provider = random.short` with `length = 8`.',
      },
      { instruction: 'Apply and confirm the two passwords differ in length.' },
      { instruction: 'Destroy everything.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
    local  = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

provider "random" {}

provider "random" {
  alias = "short"
}

resource "random_password" "main" {
  length  = 24
  special = true
}

resource "random_password" "short" {
  provider = random.short
  length   = 8
  special  = false
}

resource "local_sensitive_file" "secret" {
  filename = "\${path.module}/secret.txt"
  # The graph edge. Remove this reference and the ordering
  # guarantee disappears with it.
  content  = random_password.main.result
}`,
      },
      {
        title: 'Running it',
        language: 'bash',
        code: `terraform init
terraform apply -auto-approve

# The password is marked sensitive, so read it deliberately:
terraform output 2>/dev/null; wc -c secret.txt   # 25 bytes: 24 chars + newline handling

# The edge:
terraform graph | grep -A1 local_sensitive_file

terraform state show random_password.short | grep length   # 8

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform state list',
        what: 'Shows resources from both providers in one state.',
        expected: 'local_sensitive_file.secret, random_password.main, random_password.short',
      },
      {
        command: 'terraform state show random_password.short | grep -E "^\\s+length"',
        what: 'Proves the aliased provider was used with its own settings.',
        expected: 'length = 8',
      },
    ],
    cleanup: [{ command: 'terraform destroy -auto-approve', what: 'Removes all three resources.' }],
  },
  relatedTopicIds: ['tf-terraform-advantages', 'tf-multiple-providers', 'tf-module-basics'],
  docs: [
    {
      title: 'Provider configuration',
      url: 'https://developer.hashicorp.com/terraform/language/providers/configuration',
    },
  ],
}
