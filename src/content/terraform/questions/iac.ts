import type { Question } from '../../types'

/**
 * Original practice questions for objective 1.
 *
 * Written for this app against the published objectives. None are actual
 * exam questions.
 */
export const iacQuestions: Question[] = [
  {
    id: 'tfq-iac-1',
    domainId: 'tf-iac',
    topicId: 'tf-what-is-iac',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'A team defines its infrastructure in a shell script that calls a cloud CLI in sequence. Which statement best describes it?',
    options: [
      { id: 'a', text: 'It is declarative infrastructure as code' },
      { id: 'b', text: 'It is imperative infrastructure as code, and probably not idempotent' },
      { id: 'c', text: 'It is not infrastructure as code, because it is not written in HCL' },
      { id: 'd', text: 'It is idempotent, because the CLI checks whether resources exist' },
    ],
    correct: ['b'],
    explanation:
      'The infrastructure is defined in a versioned file, so it is IaC - but the script describes actions rather than a desired end state, which makes it imperative. Running it twice normally creates duplicates, so it is not idempotent unless the author wrote the existence checks by hand.',
  },
  {
    id: 'tfq-iac-2',
    domainId: 'tf-iac',
    topicId: 'tf-what-is-iac',
    kind: 'multi',
    category: 'concept',
    difficulty: 'beginner',
    points: 2,
    prompt:
      'Which of these are published advantages of infrastructure-as-code patterns? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Version control and an audit history of infrastructure changes' },
      { id: 'b', text: 'Repeatable environments that can be recreated identically' },
      { id: 'c', text: 'Elimination of all human error' },
      { id: 'd', text: 'Configuration that documents the infrastructure it manages' },
      { id: 'e', text: 'Automatic cost reduction on every cloud provider' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Version control, repeatability and self-documentation are core IaC advantages, along with automation. IaC makes mistakes reviewable and revertible rather than eliminating them, and it does not reduce cost by itself.',
  },
  {
    id: 'tfq-iac-3',
    domainId: 'tf-iac',
    topicId: 'tf-what-is-iac',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What does idempotence mean in the context of Terraform?',
    options: [
      { id: 'a', text: 'Changes are applied in a single transaction that can be rolled back' },
      { id: 'b', text: 'Running the same configuration again produces no further changes' },
      { id: 'c', text: 'The same configuration works on any cloud provider' },
      { id: 'd', text: 'State is encrypted at rest' },
    ],
    correct: ['b'],
    explanation:
      'Idempotence means a repeated run leaves the result unchanged, which is why `terraform apply` is safe to run again. Terraform explicitly has no transactions or rollback.',
  },
  {
    id: 'tfq-iac-4',
    domainId: 'tf-iac',
    topicId: 'tf-what-is-iac',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 1,
    prompt:
      'Someone resizes a disk in the cloud console on a resource Terraform manages. What is this called, and which command reveals it?',
    options: [
      { id: 'a', text: 'Drift, revealed by terraform plan' },
      { id: 'b', text: 'Divergence, revealed by terraform validate' },
      { id: 'c', text: 'Corruption, revealed by terraform force-unlock' },
      { id: 'd', text: 'Drift, revealed by terraform fmt' },
    ],
    correct: ['a'],
    explanation:
      'Reality diverging from state is drift. `terraform plan` refreshes state before diffing, which is how it surfaces. `terraform plan -refresh-only` shows drift on its own, without configuration changes mixed in.',
  },
  {
    id: 'tfq-iac-5',
    domainId: 'tf-iac',
    topicId: 'tf-terraform-advantages',
    kind: 'mcq',
    category: 'yaml',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'What does the marker beside this resource mean, and why should you read further before approving?',
    code: {
      title: 'Plan excerpt',
      language: 'bash',
      code: `  # aws_db_instance.main must be replaced
-/+ resource "aws_db_instance" "main" {
      ~ identifier = "prod-db" -> "prod-db-1" # forces replacement
      ~ endpoint   = "prod-db.abc.rds.amazonaws.com" -> (known after apply)
        instance_class = "db.t3.medium"
    }`,
    },
    options: [
      { id: 'a', text: 'It will be updated in place; the endpoint simply changes' },
      { id: 'b', text: 'It will be destroyed and recreated, so the existing data is lost' },
      { id: 'c', text: 'It will be created; nothing exists yet' },
      { id: 'd', text: 'The plan failed and nothing will happen' },
    ],
    correct: ['b'],
    explanation:
      '`-/+` means destroy and then create a replacement, and the `# forces replacement` comment names `identifier` as the cause. For a database that means the existing instance is deleted. `lifecycle { prevent_destroy = true }` would turn this into an error rather than something approvable.',
  },
  {
    id: 'tfq-iac-6',
    domainId: 'tf-iac',
    topicId: 'tf-terraform-advantages',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 1,
    prompt: 'How does Terraform normally determine the order in which to create resources?',
    options: [
      { id: 'a', text: 'The order the resource blocks appear in the file' },
      { id: 'b', text: 'Alphabetically by resource address' },
      { id: 'c', text: 'From a dependency graph built from the references between resources' },
      { id: 'd', text: 'From explicit depends_on arguments, which are required' },
    ],
    correct: ['c'],
    explanation:
      'References build the graph: writing `subnet_id = aws_subnet.a.id` tells Terraform the subnet must exist first. File order is irrelevant, and `depends_on` is the exception for relationships no reference expresses.',
  },
  {
    id: 'tfq-iac-7',
    domainId: 'tf-iac',
    topicId: 'tf-multi-cloud-and-hybrid',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which statement about Terraform and multiple cloud providers is correct?',
    options: [
      {
        id: 'a',
        text: 'A configuration can be pointed at a different cloud by changing one variable',
      },
      {
        id: 'b',
        text: 'Terraform provides generic resource types that map onto each provider',
      },
      {
        id: 'c',
        text: 'The workflow, language and state model are shared, but resource types remain provider-specific',
      },
      { id: 'd', text: 'Only one provider may be configured per state file' },
    ],
    correct: ['c'],
    explanation:
      'This is the most common misconception about Terraform. It unifies the workflow and the language, not the resource models - you still write `aws_instance` or `azurerm_linux_virtual_machine`. A single state file can hold resources from many providers, which is what enables cross-platform ordering.',
  },
  {
    id: 'tfq-iac-8',
    domainId: 'tf-iac',
    topicId: 'tf-multi-cloud-and-hybrid',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You add a second `provider "aws"` block with `alias = "dr"` for a disaster-recovery region, but the new bucket is still created in the primary region. What is missing?',
    options: [
      { id: 'a', text: 'A second required_providers entry for the aliased provider' },
      { id: 'b', text: 'The provider = aws.dr meta-argument on the bucket resource' },
      { id: 'c', text: 'A second backend block for the DR region' },
      { id: 'd', text: 'terraform init -reconfigure to register the alias' },
    ],
    correct: ['b'],
    explanation:
      'Declaring an alias makes an extra provider configuration available; it changes no resource. A resource uses the default (unaliased) provider unless it opts in with `provider = <name>.<alias>`. This failure is silent - the resource is created successfully, in the wrong place.',
  },
  {
    id: 'tfq-iac-9',
    domainId: 'tf-iac',
    topicId: 'tf-multi-cloud-and-hybrid',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A team wants one module interface that provisions object storage on either AWS or Azure, selected by a variable. What is the correct assessment?',
    options: [
      { id: 'a', text: 'Terraform provides this natively through a generic storage resource' },
      {
        id: 'b',
        text: 'It must be built as a module containing both providers’ resources, gated by count or for_each',
      },
      { id: 'c', text: 'It is impossible, because a module may only use one provider' },
      { id: 'd', text: 'It requires HCP Terraform’s no-code provisioning feature' },
    ],
    correct: ['b'],
    explanation:
      'Terraform offers no cloud-neutral resource types, so the abstraction is yours to write. The usual technique is a module taking neutral inputs, with per-cloud resources conditionally created via `count = var.cloud == "aws" ? 1 : 0`, and outputs normalised with `one()`.',
  },
  {
    id: 'tfq-iac-10',
    domainId: 'tf-iac',
    topicId: 'tf-terraform-advantages',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that saves an execution plan to a file named `tfplan`, so that a later apply performs exactly the reviewed actions.',
    acceptedAnswers: [
      'terraform plan -out=tfplan',
      'terraform plan -out tfplan',
      'terraform plan -out=./tfplan',
    ],
    answerHint: 'terraform plan ...',
    explanation:
      '`terraform plan -out=tfplan` writes the plan, and `terraform apply tfplan` executes exactly it with no re-planning. That is what makes review meaningful in a pipeline. The file contains resolved sensitive values, so treat it as a secret and never commit it.',
  },
]
