import type { Question } from '../../types'

/** Original practice questions for objective 4, the largest objective. */
export const configurationQuestions: Question[] = [
  {
    id: 'tfq-cfg-1',
    domainId: 'tf-configuration',
    topicId: 'tf-resources-and-data-sources',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What is the difference between a `resource` block and a `data` block?',
    options: [
      { id: 'a', text: 'A resource block is declarative; a data block is imperative' },
      { id: 'b', text: 'A resource block creates and manages; a data block only reads' },
      { id: 'c', text: 'A data block is for variables; a resource block is for infrastructure' },
      { id: 'd', text: 'A data block runs at apply time; a resource block runs at plan time' },
    ],
    correct: ['b'],
    explanation:
      'A resource block declares something Terraform owns through its whole lifecycle. A data block reads something that already exists and never creates or modifies anything. Data sources are read during plan, and appear in state with `mode: "data"`.',
  },
  {
    id: 'tfq-cfg-2',
    domainId: 'tf-configuration',
    topicId: 'tf-resources-and-data-sources',
    kind: 'command',
    category: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the full reference expression for the `id` attribute of a data source declared as `data "aws_ami" "ubuntu"`.',
    acceptedAnswers: ['data.aws_ami.ubuntu.id'],
    answerHint: 'data....',
    explanation:
      'A data source address always begins with `data.`. Omitting that prefix - writing `aws_ami.ubuntu.id` - refers to a managed resource that does not exist, and is one of the most common beginner errors.',
  },
  {
    id: 'tfq-cfg-3',
    domainId: 'tf-configuration',
    topicId: 'tf-resources-and-data-sources',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What is wrong with this configuration?',
    code: {
      title: 'main.tf',
      language: 'hcl',
      code: `resource "aws_s3_bucket" "logs" {
  bucket = "acme-logs"
}

data "aws_s3_bucket" "logs" {
  bucket = aws_s3_bucket.logs.id
}

output "arn" {
  value = data.aws_s3_bucket.logs.arn
}`,
    },
    options: [
      { id: 'a', text: 'A resource and a data source cannot share a name' },
      {
        id: 'b',
        text: 'The data source reads a resource in the same configuration, which is unnecessary and fails on a first run',
      },
      { id: 'c', text: 'The output must be marked sensitive' },
      { id: 'd', text: 'The data source needs a depends_on argument' },
    ],
    correct: ['b'],
    explanation:
      'Data sources exist to read things Terraform did not create. On a first apply the bucket does not exist when the data source is read, so its value is unknown. The resource already exposes everything the data source would return - use `aws_s3_bucket.logs.arn` directly. (Sharing a name between a resource and a data source is legal, since their addresses differ.)',
  },
  {
    id: 'tfq-cfg-4',
    domainId: 'tf-configuration',
    topicId: 'tf-references-and-dependencies',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What two things does writing `subnet_id = aws_subnet.a.id` accomplish?',
    options: [
      { id: 'a', text: 'It supplies the value, and it validates that the subnet exists' },
      { id: 'b', text: 'It supplies the value, and it declares a dependency on the subnet' },
      { id: 'c', text: 'It supplies the value, and it creates the subnet if it is missing' },
      { id: 'd', text: 'It supplies the value only; ordering requires depends_on' },
    ],
    correct: ['b'],
    explanation:
      'A reference is both a value and an edge in the dependency graph. That is why ordering in Terraform is normally automatic, and why a hard-coded id is usually a missing dependency as well as a portability problem.',
  },
  {
    id: 'tfq-cfg-5',
    domainId: 'tf-configuration',
    topicId: 'tf-references-and-dependencies',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'When is `depends_on` genuinely required?',
    options: [
      { id: 'a', text: 'Whenever one resource must be created before another' },
      { id: 'b', text: 'When there is an ordering requirement that no reference expresses' },
      { id: 'c', text: 'On every resource, to make ordering explicit' },
      { id: 'd', text: 'Only for resources in different modules' },
    ],
    correct: ['b'],
    explanation:
      'If the dependent resource reads any attribute of the other, the reference already creates the edge. `depends_on` is for relationships with no value exchange - an IAM policy attachment that must exist before an application starts, for instance. Adding it everywhere removes parallelism and hides the real structure.',
  },
  {
    id: 'tfq-cfg-6',
    domainId: 'tf-configuration',
    topicId: 'tf-references-and-dependencies',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Two security groups each need an ingress rule referencing the other. Terraform reports "Cycle". What is the fix?',
    options: [
      { id: 'a', text: 'Add depends_on to both groups' },
      { id: 'b', text: 'Use -target to apply them one at a time' },
      {
        id: 'c',
        text: 'Declare the groups without inline rules, then add the rules as separate resources',
      },
      { id: 'd', text: 'Increase -parallelism so both can be created at once' },
    ],
    correct: ['c'],
    explanation:
      'The general technique for a cycle is to move the mutual reference out of the two resources into a third that depends on both. Separate `aws_security_group_rule` resources each depend on both groups, and the groups depend on nothing. `-target` would hide the problem rather than fix it.',
  },
  {
    id: 'tfq-cfg-7',
    domainId: 'tf-configuration',
    topicId: 'tf-input-variables',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A variable has `default = "eu-west-1"`. `TF_VAR_region=us-east-1` is exported, `terraform.tfvars` sets `region = "ap-south-1"`, and you run `terraform apply -var="region=sa-east-1"`. Which value is used?',
    options: [
      { id: 'a', text: 'eu-west-1' },
      { id: 'b', text: 'us-east-1' },
      { id: 'c', text: 'ap-south-1' },
      { id: 'd', text: 'sa-east-1' },
    ],
    correct: ['d'],
    explanation:
      'Precedence, lowest to highest: default, `TF_VAR_`, `terraform.tfvars`, `terraform.tfvars.json`, `*.auto.tfvars` in lexical order, then `-var` and `-var-file` on the command line. The command line always wins, and later `-var` flags beat earlier ones.',
  },
  {
    id: 'tfq-cfg-8',
    domainId: 'tf-configuration',
    topicId: 'tf-input-variables',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which variable value source has the LOWEST precedence?',
    options: [
      { id: 'a', text: 'The default in the variable block' },
      { id: 'b', text: 'A TF_VAR_ environment variable' },
      { id: 'c', text: 'terraform.tfvars' },
      { id: 'd', text: 'A -var flag' },
    ],
    correct: ['a'],
    explanation:
      'The `default` is the weakest source - it is used only when nothing else supplies a value. Assuming the default wins because "I wrote it in the code" is a common and reliably-examined misconception.',
  },
  {
    id: 'tfq-cfg-9',
    domainId: 'tf-configuration',
    topicId: 'tf-input-variables',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You run `terraform apply -var-file=staging.tfvars`, but one resource is created with production settings. What is the most likely cause?',
    options: [
      { id: 'a', text: '-var-file has lower precedence than the variable default' },
      {
        id: 'b',
        text: 'A stray *.auto.tfvars or terraform.tfvars file is supplying values that staging.tfvars does not mention',
      },
      { id: 'c', text: 'staging.tfvars must be named terraform.tfvars to be loaded' },
      { id: 'd', text: 'A -var-file is ignored unless -input=false is also passed' },
    ],
    correct: ['b'],
    explanation:
      'A higher-precedence source overrides only the variables it actually mentions; the rest keep their lower-precedence values. `terraform.tfvars` and `*.auto.tfvars` are loaded automatically, which makes a stray file an easy trap. Diagnose with `terraform show -json tfplan | jq .variables`, which reports every resolved value.',
  },
  {
    id: 'tfq-cfg-10',
    domainId: 'tf-configuration',
    topicId: 'tf-outputs',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'How do you reference a VPC id created inside a module named `network`?',
    options: [
      { id: 'a', text: 'module.network.aws_vpc.this.id' },
      { id: 'b', text: 'module.network.vpc_id, if the module declares that output' },
      { id: 'c', text: 'data.module.network.vpc_id' },
      { id: 'd', text: 'network.aws_vpc.this.id' },
    ],
    correct: ['b'],
    explanation:
      'Only declared outputs cross a module boundary. Resources inside a module are unreachable from outside, which is what makes a module’s interface stable. Reference outputs as `module.<name>.<output>`.',
  },
  {
    id: 'tfq-cfg-11',
    domainId: 'tf-configuration',
    topicId: 'tf-outputs',
    kind: 'command',
    category: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that prints the output named `endpoint` without surrounding quotes, so it can be assigned to a shell variable.',
    acceptedAnswers: ['terraform output -raw endpoint', 'terraform output --raw endpoint'],
    answerHint: 'terraform output ...',
    explanation:
      '`-raw` prints the bare value. Plain `terraform output endpoint` prints a quoted HCL value, which breaks most scripts. `-json` gives everything with type and sensitivity information.',
  },
  {
    id: 'tfq-cfg-12',
    domainId: 'tf-configuration',
    topicId: 'tf-locals-and-complex-types',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which collection type is unordered, de-duplicated and cannot be indexed?',
    options: [
      { id: 'a', text: 'list(T)' },
      { id: 'b', text: 'set(T)' },
      { id: 'c', text: 'map(T)' },
      { id: 'd', text: 'tuple([...])' },
    ],
    correct: ['b'],
    explanation:
      'A set has no order and no indices, so `mySet[0]` is an error. `toset(["b","a","a"])` yields `["a","b"]` - duplicates and order discarded. Convert with `tolist()` if you genuinely need an index.',
  },
  {
    id: 'tfq-cfg-13',
    domainId: 'tf-configuration',
    topicId: 'tf-locals-and-complex-types',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'How do you reference a value declared in a `locals` block named `name_prefix`?',
    options: [
      { id: 'a', text: 'locals.name_prefix' },
      { id: 'b', text: 'local.name_prefix' },
      { id: 'c', text: 'var.name_prefix' },
      { id: 'd', text: 'self.name_prefix' },
    ],
    correct: ['b'],
    explanation:
      'The block is plural (`locals`) but the reference is singular (`local.`). It is a small inconsistency in the language and a reliably common typo.',
  },
  {
    id: 'tfq-cfg-14',
    domainId: 'tf-configuration',
    topicId: 'tf-expressions-and-functions',
    kind: 'mcq',
    category: 'yaml',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What does this expression produce?',
    code: {
      title: 'Expression',
      language: 'hcl',
      code: `variable "users" {
  default = [
    { name = "alice", admin = true },
    { name = "bob", admin = false },
    { name = "carol", admin = true },
  ]
}

# What is this?
[for u in var.users : u.name if u.admin]`,
    },
    options: [
      { id: 'a', text: 'A map: { alice = true, carol = true }' },
      { id: 'b', text: 'A list: ["alice", "carol"]' },
      { id: 'c', text: 'A list: ["alice", "bob", "carol"]' },
      { id: 'd', text: 'A set: toset(["alice", "carol"])' },
    ],
    correct: ['b'],
    explanation:
      'Square brackets produce a list; the trailing `if` filters. The map form would be `{for u in var.users : u.name => u.admin}`. The bracket is what decides the output type.',
  },
  {
    id: 'tfq-cfg-15',
    domainId: 'tf-configuration',
    topicId: 'tf-expressions-and-functions',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Someone adds `tags = { LastApplied = timestamp() }` to a resource. Why does every subsequent plan show a change?',
    options: [
      { id: 'a', text: 'The provider does not support the tags argument' },
      {
        id: 'b',
        text: '`timestamp()` returns a new value on every evaluation, so state never matches configuration',
      },
      { id: 'c', text: 'Tags are always treated as drift' },
      { id: 'd', text: 'The plan is stale and needs -refresh=false' },
    ],
    correct: ['b'],
    explanation:
      'Resource arguments must be deterministic functions of the configuration and its inputs, or the plan can never be clean. `timestamp()` and `uuid()` break that. Pass a build identifier in as a variable instead - stable within a run, changing only when the build does.',
  },
  {
    id: 'tfq-cfg-16',
    domainId: 'tf-configuration',
    topicId: 'tf-count-and-for-each',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which types does `for_each` accept?',
    options: [
      { id: 'a', text: 'A list or a set' },
      { id: 'b', text: 'A map or a set of strings' },
      { id: 'c', text: 'Any collection type' },
      { id: 'd', text: 'A number, like count' },
    ],
    correct: ['b'],
    explanation:
      'A list is rejected because it has no stable keys - which is exactly the property `for_each` relies on. Convert with `toset()` if the values are unique strings, or build a map so each instance has a meaningful key.',
  },
  {
    id: 'tfq-cfg-17',
    domainId: 'tf-configuration',
    topicId: 'tf-count-and-for-each',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A resource uses `count = length(var.names)` over `["alice","bob","carol","dave"]`. You remove `"bob"`. What does the plan show?',
    options: [
      { id: 'a', text: '1 to destroy - just bob' },
      { id: 'b', text: '2 to add, 3 to destroy - carol and dave are recreated as well' },
      { id: 'c', text: 'No changes, because count still evaluates' },
      { id: 'd', text: 'An error, because the list length changed' },
    ],
    correct: ['b'],
    explanation:
      'Under `count`, identity is the index. Removing bob shifts carol from [2] to [1] and dave from [3] to [2], so Terraform sees different resources at those addresses and replaces them. `for_each = toset(var.names)` keys each instance by its own name, so removing bob affects exactly one resource.',
  },
  {
    id: 'tfq-cfg-18',
    domainId: 'tf-configuration',
    topicId: 'tf-count-and-for-each',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'How do you create a resource only in production?',
    options: [
      { id: 'a', text: 'count = var.environment == "production" ? 1 : 0' },
      { id: 'b', text: 'enabled = var.environment == "production"' },
      { id: 'c', text: 'lifecycle { create = var.environment == "production" }' },
      { id: 'd', text: 'for_each = var.environment == "production"' },
    ],
    correct: ['a'],
    explanation:
      '`count = 0` creates nothing, which is the idiomatic conditional-creation pattern. Reference such a resource with `one(aws_x.y[*].attr)` so the expression yields `null` rather than erroring when the count is zero.',
  },
  {
    id: 'tfq-cfg-19',
    domainId: 'tf-configuration',
    topicId: 'tf-count-and-for-each',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt: 'Which values may be unknown at plan time when using `for_each`?',
    options: [
      { id: 'a', text: 'Both the keys and the values' },
      { id: 'b', text: 'The keys, but not the values' },
      { id: 'c', text: 'The values, but not the keys' },
      { id: 'd', text: 'Neither - everything must be known' },
    ],
    correct: ['c'],
    explanation:
      'Keys determine resource addresses, so Terraform must know how many instances exist and what they are called in order to plan at all. Values are just arguments and can be resolved during apply. In practice: derive keys from variables, locals or data sources, and take values from resources being created in the same run.',
  },
  {
    id: 'tfq-cfg-20',
    domainId: 'tf-configuration',
    topicId: 'tf-dynamic-blocks-and-lifecycle',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What can a `dynamic` block generate?',
    options: [
      { id: 'a', text: 'Any argument, including maps such as tags' },
      { id: 'b', text: 'Only nested blocks that the resource schema already defines' },
      { id: 'c', text: 'Whole resource blocks' },
      { id: 'd', text: 'Provider blocks' },
    ],
    correct: ['b'],
    explanation:
      '`dynamic` repeats a nested *block* - `ingress`, `setting`, `rule`. It cannot invent arguments and cannot generate a map argument such as `tags`; for that you build the map with a `for` expression or `merge()`.',
  },
  {
    id: 'tfq-cfg-21',
    domainId: 'tf-configuration',
    topicId: 'tf-dynamic-blocks-and-lifecycle',
    kind: 'multi',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which are valid `lifecycle` settings? (Select all that apply.)',
    options: [
      { id: 'a', text: 'create_before_destroy' },
      { id: 'b', text: 'prevent_destroy' },
      { id: 'c', text: 'ignore_changes' },
      { id: 'd', text: 'replace_triggered_by' },
      { id: 'e', text: 'retry_on_failure' },
    ],
    correct: ['a', 'b', 'c', 'd'],
    explanation:
      'Those four, plus `precondition` and `postcondition`. There is no retry setting. Note that `lifecycle` accepts literal values only - `prevent_destroy = var.protect` is a hard error.',
  },
  {
    id: 'tfq-cfg-22',
    domainId: 'tf-configuration',
    topicId: 'tf-dynamic-blocks-and-lifecycle',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A workspace has had clean plans for four months, yet a colleague reports their task-definition change was never applied. `ignore_changes = all` is set on the resource. What happened?',
    options: [
      { id: 'a', text: 'The provider is caching the old definition' },
      {
        id: 'b',
        text: 'ignore_changes = all stops Terraform proposing ANY change after creation, so real changes are silently never applied',
      },
      { id: 'c', text: 'The plan needs -refresh=false to detect it' },
      { id: 'd', text: 'prevent_destroy is blocking the update' },
    ],
    correct: ['b'],
    explanation:
      '`ignore_changes = all` makes the resource effectively invisible to Terraform while appearing to be managed - plans stay clean and nothing is ever applied. Always use a specific list of only the attributes another system owns. If a resource genuinely should not be managed, use a data source or `terraform state rm` instead of pretending.',
  },
  {
    id: 'tfq-cfg-23',
    domainId: 'tf-configuration',
    topicId: 'tf-custom-conditions',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What can a `validation` block inside a `variable` reference?',
    options: [
      { id: 'a', text: 'Any variable, local or resource' },
      { id: 'b', text: 'Only the variable it is declared in' },
      { id: 'c', text: 'Only literals' },
      { id: 'd', text: 'Any variable, but no resources' },
    ],
    correct: ['b'],
    explanation:
      'A variable validation sees only `var.<that variable>`. Cross-variable and cross-resource assertions belong in a `precondition`, which can reference anything - at the cost of running later.',
  },
  {
    id: 'tfq-cfg-24',
    domainId: 'tf-configuration',
    topicId: 'tf-custom-conditions',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What happens when an assertion in a `check` block fails?',
    options: [
      { id: 'a', text: 'The plan fails and no apply is possible' },
      { id: 'b', text: 'The apply fails after resources are created' },
      { id: 'c', text: 'A warning is reported and the run continues' },
      { id: 'd', text: 'The resource is marked tainted' },
    ],
    correct: ['c'],
    explanation:
      'Check blocks produce warnings and never block a run - that is the point of them. Only `validation`, `precondition` and `postcondition` are errors. Checks are for continuous health assertions, such as a certificate approaching expiry.',
  },
  {
    id: 'tfq-cfg-25',
    domainId: 'tf-configuration',
    topicId: 'tf-custom-conditions',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'You need to assert that an instance actually received a public IP after creation. Which mechanism, and why not the others?',
    options: [
      { id: 'a', text: 'A variable validation - it runs earliest' },
      { id: 'b', text: 'A lifecycle precondition - it can reference anything' },
      { id: 'c', text: 'A lifecycle postcondition - it can see computed attributes and `self`' },
      { id: 'd', text: 'A check block - it can reference data sources' },
    ],
    correct: ['c'],
    explanation:
      'The public IP is computed and only exists after creation, so a validation cannot see it and a precondition runs too early. A postcondition runs after the resource exists and can reference `self`. A check block would only warn.',
  },
  {
    id: 'tfq-cfg-26',
    domainId: 'tf-configuration',
    topicId: 'tf-sensitive-data-and-vault',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Does reading a secret from a Vault data source keep it out of the Terraform state file?',
    options: [
      { id: 'a', text: 'Yes - Vault values are never persisted' },
      { id: 'b', text: 'Yes, provided the output is marked sensitive' },
      { id: 'c', text: 'No - the returned value is stored in state like any data source result' },
      { id: 'd', text: 'No, unless the backend has encryption enabled' },
    ],
    correct: ['c'],
    explanation:
      'Vault keeps the secret out of your repository and centralises rotation and auditing, but the value it returns enters state like any other data source result. The mitigation that genuinely helps is dynamic, short-lived credentials - a leaked state file then has a limited window - or, on Terraform 1.10+, `ephemeral` values, which are never written to state.',
  },
  {
    id: 'tfq-cfg-27',
    domainId: 'tf-configuration',
    topicId: 'tf-sensitive-data-and-vault',
    kind: 'multi',
    category: 'concept',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'Which of these genuinely protect sensitive data in a Terraform workflow? (Select all that apply.)',
    options: [
      { id: 'a', text: 'An encrypted remote backend with least-privilege access' },
      { id: 'b', text: 'Marking variables and outputs sensitive = true' },
      { id: 'c', text: 'Never committing state, tfvars or saved plan files' },
      { id: 'd', text: 'Using short-lived dynamic credentials rather than long-lived keys' },
      { id: 'e', text: 'Using ephemeral values for anything that must not reach state' },
    ],
    correct: ['a', 'c', 'd', 'e'],
    explanation:
      '`sensitive = true` prevents leaks into logs and terminals, which is worth doing - but it protects nothing at rest, so it is not a protection of the data itself. The other four each reduce real exposure: encryption and access control, keeping plaintext out of repositories, limiting the useful lifetime of a leaked value, and keeping values out of state entirely.',
  },
]
