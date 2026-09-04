import type { Topic } from '../../../types'

export const terraformAdvantages: Topic = {
  id: 'tf-terraform-advantages',
  title: 'Why Terraform, specifically',
  domainId: 'tf-iac',
  difficulty: 'beginner',
  estimatedMinutes: 14,
  order: 2,
  tags: ['advantages', 'plan', 'graph', 'state', 'hcl', 'objective-1'],
  oneLiner:
    'What Terraform gives you that a script does not: a dependency graph, a reviewable plan, and one language for every provider.',
  explanation: [
    'Terraform is a declarative provisioning tool. You describe resources in HCL; Terraform builds a **dependency graph**, works out a safe order, and calls the relevant APIs.',
    'Its distinctive feature is the **plan**. Before touching anything, Terraform shows you exactly what it will add, change and destroy. Nothing else in the ecosystem makes the blast radius this visible before the fact.',
    'It is **provider-based**, which is what "service-agnostic" means in the objectives. AWS, Azure, GCP, Kubernetes, GitHub, Cloudflare, Datadog and thousands more are all providers, and they all use the same language, the same workflow and the same state model.',
    'That combination - one language, one workflow, an explicit graph, and a plan you can review - is the real answer to "why not just use the cloud vendor tool".',
  ],
  whyItMatters: [
    'Objective 1c asks specifically about multi-cloud, hybrid cloud and service-agnostic workflows. The provider model is the answer to all three.',
    'The plan is the feature that makes Terraform safe to use on production, and it appears constantly in exam questions about the workflow.',
    'Understanding the dependency graph explains why you rarely need `depends_on`, and why Terraform can parallelise work you might have assumed was sequential.',
  ],
  howItWorks: [
    '**One language, many targets.** A provider is a plugin that translates HCL resource blocks into API calls for one platform. Adding a new platform means adding a provider block, not learning a new tool.',
    '**Multi-cloud in one configuration.** Because providers are independent, a single configuration can create an AWS load balancer, a Cloudflare DNS record pointing at it and a Datadog monitor watching it - with correct ordering derived automatically.',
    '**Hybrid cloud.** The same applies to on-premises targets: vSphere, Nutanix, F5, Active Directory and Kubernetes all have providers, so private infrastructure sits in the same workflow as public.',
    '**The dependency graph.** Terraform reads your references. Writing `subnet_id = aws_subnet.a.id` tells it the subnet must exist first. It then walks the graph, creating independent resources in parallel.',
    '**The plan.** Terraform diffs desired state against recorded state and reality, then prints the result with `+` for create, `-` for destroy, `~` for update in place and `-/+` for replace.',
    '**State as the ledger.** Because Terraform records what it created, it can destroy exactly what it owns and leave everything else alone.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'One workflow, many providers',
      caption:
        'This is what "service-agnostic" means in objective 1c: the language and the workflow never change, only the provider underneath.',
      root: {
        label: 'Terraform CLI',
        detail: 'One language (HCL), one workflow (init, plan, apply)',
        tone: 'accent',
        children: [
          {
            label: 'Public cloud providers',
            children: [
              { label: 'aws', detail: 'EC2, S3, IAM, RDS...' },
              { label: 'azurerm', detail: 'VMs, storage, AAD...' },
              { label: 'google', detail: 'GCE, GCS, IAM...' },
            ],
          },
          {
            label: 'On-premises providers',
            detail: 'This is the "hybrid" half',
            children: [
              { label: 'vsphere', detail: 'VMs in your own datacentre' },
              { label: 'kubernetes / helm', detail: 'Clusters anywhere' },
            ],
          },
          {
            label: 'Everything-else providers',
            detail: 'Not infrastructure in the narrow sense',
            tone: 'muted',
            children: [
              { label: 'github', detail: 'Repos, teams, branch protection' },
              { label: 'cloudflare', detail: 'DNS, WAF rules' },
              { label: 'datadog', detail: 'Monitors and dashboards' },
            ],
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'How the dependency graph is built',
      caption:
        'You almost never order resources by hand. A reference is a dependency, and that is enough for Terraform to work out the rest.',
      nodes: [
        {
          label: 'You write a reference',
          detail: 'subnet_id = aws_subnet.a.id',
          tone: 'accent',
        },
        {
          label: 'Terraform records an edge',
          detail: 'aws_instance.web depends on aws_subnet.a',
          arrowLabel: 'parsed, not guessed',
        },
        {
          label: 'The graph is sorted',
          detail: 'Dependencies first; unrelated resources in parallel',
        },
        {
          label: 'Independent work runs concurrently',
          detail: 'Default 10 at a time, tunable with -parallelism',
          tone: 'success',
          branch: {
            label: 'A hidden dependency',
            detail: 'No reference exists, so you must add depends_on yourself',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Plan symbols',
      purpose:
        'The four markers that appear beside every resource in a plan. Read them before approving anything.',
      fields: [
        { path: '+ create', meaning: 'A new resource will be created.' },
        { path: '- destroy', meaning: 'An existing resource will be deleted.' },
        {
          path: '~ update in-place',
          meaning: 'Changed without recreating. The safe kind.',
        },
        {
          path: '-/+ destroy and then create replacement',
          meaning:
            'The resource is being replaced. This is the one to slow down and read - it usually means data loss.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The DNS record that pointed at nothing',
    story: [
      'A team ran two tools: CloudFormation for AWS, and a hand-written script for Cloudflare DNS. Deploying a new environment meant running one, waiting, copying the load balancer hostname, then running the other.',
      'One afternoon someone ran the DNS script before the load balancer finished provisioning. The record was created pointing at an empty value, and the outage lasted as long as the DNS cache did.',
      'Moving both into one Terraform configuration removed the failure mode entirely, because the Cloudflare record references the AWS load balancer attribute directly. Terraform will not create the record until the value exists.',
      'That is the concrete argument for a service-agnostic tool: the ordering between two platforms stops being a human responsibility.',
    ],
    code: [
      {
        title: 'Two providers, one graph',
        language: 'hcl',
        explanation:
          'The reference in `value` creates the dependency. No `depends_on`, no waiting, no copy-paste.',
        code: `resource "aws_lb" "web" {
  name               = "web"
  load_balancer_type = "application"
  subnets            = var.subnet_ids
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  # This reference is the dependency. The record cannot be
  # created before the load balancer has a DNS name.
  value   = aws_lb.web.dns_name
  proxied = true
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A configuration spanning three platforms',
      language: 'hcl',
      explanation:
        'One `terraform init`, one `terraform plan`, one `terraform apply`. The providers are independent but the graph is shared.',
      code: `terraform {
  required_providers {
    aws        = { source = "hashicorp/aws", version = "~> 5.0" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.30" }
    github     = { source = "integrations/github", version = "~> 6.0" }
  }
}

provider "aws" {
  region = "eu-west-1"
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "acme-build-artifacts"
}

resource "kubernetes_secret" "bucket" {
  metadata {
    name = "artifact-bucket"
  }
  data = {
    bucket = aws_s3_bucket.artifacts.id
  }
}

resource "github_actions_variable" "bucket" {
  repository    = "acme/app"
  variable_name = "ARTIFACT_BUCKET"
  value         = aws_s3_bucket.artifacts.id
}`,
    },
    {
      title: 'Reading a plan properly',
      language: 'bash',
      explanation:
        'The summary line is the part to check first, and `-/+` in the body is the part that should make you pause.',
      code: `$ terraform plan

Terraform will perform the following actions:

  # aws_instance.web must be replaced
-/+ resource "aws_instance" "web" {
      ~ ami           = "ami-0abc" -> "ami-0def" # forces replacement
      ~ id            = "i-0123456789" -> (known after apply)
        instance_type = "t3.micro"
    }

  # aws_s3_bucket.logs will be updated in-place
  ~ resource "aws_s3_bucket" "logs" {
      ~ tags = {
          + "Owner" = "platform"
        }
    }

Plan: 1 to add, 1 to change, 1 to destroy.`,
    },
  ],
  imperative: [
    {
      command: 'terraform providers',
      what: 'Lists every provider the configuration requires, including those pulled in by modules.',
    },
    {
      command: 'terraform graph',
      what: 'Prints the dependency graph in DOT format.',
      expected: 'digraph { ... } - pipe to `dot -Tsvg` to view it.',
    },
    {
      command: 'terraform plan -out=tfplan',
      what: 'Saves the plan so the apply is guaranteed to do exactly what you reviewed.',
      namespaceNote: 'This is the safe pattern in CI: plan once, apply that artefact.',
    },
    {
      command: 'terraform apply tfplan',
      what: 'Applies a saved plan. No second confirmation, because you already approved it.',
    },
    {
      command: 'terraform apply -parallelism=1',
      what: 'Forces serial execution. Useful for tracing an ordering problem.',
    },
  ],
  declarative: {
    steps: [
      'Declare every provider you need in one `required_providers` block.',
      'Configure each provider with its own `provider` block.',
      'Reference attributes across providers rather than copying values between runs.',
      'Let the graph derive the order; reach for `depends_on` only when no reference exists.',
    ],
    code: [
      {
        title: 'When you genuinely need depends_on',
        language: 'hcl',
        explanation:
          'The bucket policy must exist before the application starts writing, but nothing in the instance block references the policy - so the dependency is invisible to Terraform and you must state it.',
        code: `resource "aws_s3_bucket_policy" "writes" {
  bucket = aws_s3_bucket.artifacts.id
  policy = data.aws_iam_policy_document.writes.json
}

resource "aws_instance" "worker" {
  ami           = var.ami_id
  instance_type = "t3.small"

  # No attribute of the policy appears above, so the graph
  # cannot see this ordering requirement.
  depends_on = [aws_s3_bucket_policy.writes]
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'Machine-readable answer to "is anything pending".',
      expected: '0 = clean, 2 = changes pending, 1 = error.',
    },
    {
      command: "terraform show -json tfplan | jq '.resource_changes[].change.actions'",
      what: 'Lists the action for every resource in a saved plan.',
      expected: '["create"], ["update"], ["delete","create"] ...',
    },
    {
      command: 'terraform graph | dot -Tsvg > graph.svg',
      what: 'Renders the dependency graph so you can see the ordering Terraform derived.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Shows `-/+ must be replaced` on something you expected to change in place.',
      expected: 'A `# forces replacement` comment naming the attribute responsible.',
    },
    {
      command: 'terraform providers',
      what: 'Diagnoses "provider not found": shows which provider a module actually asked for.',
    },
    {
      command: 'terraform apply -parallelism=1',
      what: 'Serialises execution to expose a race that only appears under concurrency.',
    },
  ],
  commonMistakes: [
    'Skimming the plan and reading only the summary line. `1 to change` and `1 to destroy` look similar in a hurry and mean very different things.',
    'Adding `depends_on` everywhere "to be safe". It removes parallelism, hides real relationships and makes refactoring harder. Use a reference instead wherever one exists.',
    'Assuming multi-cloud means one provider that abstracts the clouds. It does not: you still write AWS resources and Azure resources, just in one language and one graph.',
    'Running `terraform apply` without a saved plan in CI. What you reviewed and what gets applied can then differ.',
    'Forgetting that `terraform destroy` removes only what is in state. Resources created by hand survive it.',
  ],
  examTips: [
    'Objective 1c has three words in it - multi-cloud, hybrid cloud, service-agnostic - and one answer: the provider plugin model.',
    'Know the four plan symbols and what each means. `-/+` is replacement, and it is the dangerous one.',
    'Terraform builds a graph from your references. That is why `depends_on` is the exception, not the rule.',
    'The default parallelism is 10.',
    '`terraform plan -out=FILE` then `terraform apply FILE` is the pattern that guarantees you apply what you reviewed.',
  ],
  summary: [
    'Terraform is declarative, provider-based, and plans before it acts.',
    'Providers are what make it service-agnostic: same language for cloud, on-premises and SaaS.',
    'References build the dependency graph, which is why ordering is usually automatic.',
    'The plan is the safety feature. Read the symbols, especially `-/+`.',
    'Save a plan and apply it when the review and the change must match exactly.',
  ],
  practice: [
    {
      id: 'tf-advantages-p1',
      level: 'beginner',
      prompt:
        'What does "service-agnostic" mean in the context of the Terraform Associate objectives?',
      answer:
        'That Terraform is not tied to one platform: any service with a provider plugin - cloud, on-premises or SaaS - is managed with the same language, workflow and state model.',
      explanation:
        'It does not mean Terraform abstracts away the differences between platforms. You still write provider-specific resources.',
    },
    {
      id: 'tf-advantages-p2',
      level: 'intermediate',
      prompt:
        'A plan shows `-/+ resource "aws_db_instance" "main"`. Why should you stop and read further before approving?',
      answer:
        'Because `-/+` means destroy and recreate. For a database that means the existing instance is deleted, so unless a snapshot or lifecycle rule protects it you are about to lose the data.',
      explanation:
        'The plan output includes a `# forces replacement` comment identifying which attribute triggered it, and that is what you should check first.',
    },
    {
      id: 'tf-advantages-p3',
      level: 'intermediate',
      prompt:
        'You need an IAM role to exist before an EC2 instance starts, but the instance block does not reference the role anywhere. What do you do, and why is it unusual?',
      answer:
        'Add `depends_on = [aws_iam_role_policy_attachment.x]` to the instance. It is unusual because a reference normally creates the dependency automatically - `depends_on` is only for relationships Terraform cannot see.',
      explanation:
        'If you can restructure the configuration to reference an attribute of the role instead, prefer that: the graph then stays accurate through future refactoring.',
    },
    {
      id: 'tf-advantages-p4',
      level: 'advanced',
      prompt:
        'Why is `terraform plan -out=tfplan` followed by `terraform apply tfplan` safer in a pipeline than a bare `terraform apply -auto-approve`?',
      answer:
        'Because the saved plan is a fixed artefact. A bare apply re-plans at apply time, so anything that changed between review and execution is applied without anyone seeing it.',
      explanation:
        'Applying a saved plan also skips the interactive prompt legitimately, since the approval already happened at review time.',
    },
  ],
  lab: {
    title: 'Read a plan and see the graph',
    scenario:
      'Build a small two-resource configuration with the local provider, inspect the graph Terraform derives, then force a replacement and read the plan carefully.',
    prerequisites: ['Terraform 1.5 or newer', 'Optionally graphviz, for `dot`'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `local_file` whose content references a `random_pet` name, so one resource genuinely depends on the other.',
        hint: 'Providers: hashicorp/local and hashicorp/random.',
      },
      { instruction: 'Run `terraform init` and `terraform apply`.' },
      {
        instruction: 'Run `terraform graph` and identify the edge between the two resources.',
        hint: 'If you have graphviz: `terraform graph | dot -Tsvg > graph.svg`.',
      },
      {
        instruction:
          'Add `keepers = { version = "1" }` to the random_pet, apply, then change it to "2" and run a plan.',
        hint: 'keepers forces replacement when it changes.',
      },
      {
        instruction:
          'In the plan, find the `-/+` marker and the `# forces replacement` comment. Note that the local_file changes too, and explain why.',
      },
      { instruction: 'Save the plan with `-out=tfplan` and apply that file.' },
      { instruction: 'Destroy everything.' },
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

resource "random_pet" "name" {
  length = 2

  keepers = {
    version = "1"
  }
}

resource "local_file" "greeting" {
  filename = "\${path.module}/pet.txt"
  # This reference is the graph edge: the file cannot be
  # written until the pet name is known.
  content  = "hello \${random_pet.name.id}\\n"
}`,
      },
      {
        title: 'Commands and what to look for',
        language: 'bash',
        code: `terraform init
terraform apply -auto-approve
cat pet.txt

# The edge: local_file.greeting -> random_pet.name
terraform graph | grep -i 'random_pet'

# Force replacement
sed -i 's/version = "1"/version = "2"/' main.tf

terraform plan -out=tfplan
#   -/+ resource "random_pet" "name"   (keepers forces replacement)
#   ~   resource "local_file" "greeting"
# The file changes because its content depends on the pet id,
# which is "known after apply" once the pet is replaced.

terraform apply tfplan
terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command:
          'terraform show -json tfplan | jq -r \'.resource_changes[] | "\\(.address) \\(.change.actions|join(","))"\'',
        what: 'Prints the action per resource from the saved plan.',
        expected: 'random_pet.name delete,create and local_file.greeting update',
      },
      {
        command: 'terraform state list',
        what: 'Confirms both resources are managed.',
        expected: 'local_file.greeting and random_pet.name',
      },
    ],
    cleanup: [{ command: 'terraform destroy -auto-approve', what: 'Removes both resources.' }],
  },
  relatedTopicIds: ['tf-what-is-iac', 'tf-plan', 'tf-references-and-dependencies'],
  docs: [
    {
      title: 'Terraform overview',
      url: 'https://developer.hashicorp.com/terraform/intro',
    },
  ],
}
