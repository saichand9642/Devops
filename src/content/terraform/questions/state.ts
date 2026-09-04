import type { Question } from '../../types'

/** Original practice questions for objective 6. */
export const stateQuestions: Question[] = [
  {
    id: 'tfq-st-1',
    domainId: 'tf-state',
    topicId: 'tf-local-backend',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which two files does the local backend maintain?',
    options: [
      { id: 'a', text: 'terraform.tfstate and .terraform.lock.hcl' },
      { id: 'b', text: 'terraform.tfstate and terraform.tfstate.backup' },
      { id: 'c', text: 'terraform.tfstate and terraform.tfvars' },
      { id: 'd', text: 'state.json and state.json.bak' },
    ],
    correct: ['b'],
    explanation:
      '`terraform.tfstate.backup` is the single previous version, written before each new write. It is the fastest recovery from one mistaken state command - and it gives you exactly one step back, which is why an explicit `terraform state pull` before surgery matters.',
  },
  {
    id: 'tfq-st-2',
    domainId: 'tf-state',
    topicId: 'tf-local-backend',
    kind: 'multi',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What does the local backend NOT provide? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Sharing between people or machines' },
      { id: 'b', text: 'Encryption at rest' },
      { id: 'c', text: 'Version history' },
      { id: 'd', text: 'Any locking at all' },
      { id: 'e', text: 'A backup of the previous state version' },
    ],
    correct: ['a', 'b', 'c'],
    explanation:
      'It does provide a local OS file lock - preventing two processes on the same machine racing - and one previous-version backup. What it cannot provide is sharing, encryption or history, which is why anything a second person touches belongs in a remote backend.',
  },
  {
    id: 'tfq-st-3',
    domainId: 'tf-state',
    topicId: 'tf-state-locking',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which two S3 backend settings provide state locking?',
    options: [
      { id: 'a', text: 'encrypt and kms_key_id' },
      { id: 'b', text: 'use_lockfile or dynamodb_table' },
      { id: 'c', text: 'versioning or acl' },
      { id: 'd', text: 'lock = true or force_lock = true' },
    ],
    correct: ['b'],
    explanation:
      '`use_lockfile = true` (Terraform 1.10+) creates a lock object beside the state and needs no extra infrastructure. `dynamodb_table` is the older mechanism and is still supported - its hash key must be named exactly `LockID`.',
  },
  {
    id: 'tfq-st-4',
    domainId: 'tf-state',
    topicId: 'tf-state-locking',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 3,
    prompt: 'You get "Error acquiring the state lock" in CI. What is the correct first response?',
    options: [
      { id: 'a', text: 'terraform force-unlock, since CI locks are always stale' },
      { id: 'b', text: 'Re-run with -lock=false to get past it' },
      {
        id: 'c',
        text: 'Re-run with -lock-timeout so the job waits, and serialise runs at the CI level',
      },
      { id: 'd', text: 'Delete the DynamoDB table and let Terraform recreate it' },
    ],
    correct: ['c'],
    explanation:
      'A lock error in CI usually means two pipelines overlapped - exactly the situation locking exists for. `-lock=false` removes the protection, and `force-unlock` on a live lock is one of the few reliable ways to corrupt state. Before force-unlocking, check the Who and Created fields in the error.',
  },
  {
    id: 'tfq-st-5',
    domainId: 'tf-state',
    topicId: 'tf-remote-backends',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Your `backend "s3"` block needs a different bucket per environment. Since it cannot use variables, what is the supported approach?',
    options: [
      { id: 'a', text: 'A shell script that rewrites backend.tf before each run' },
      {
        id: 'b',
        text: 'A partial configuration completed at init time with -backend-config',
      },
      { id: 'c', text: 'Terraform workspaces, one per environment' },
      { id: 'd', text: 'A separate terraform block per environment in the same file' },
    ],
    correct: ['b'],
    explanation:
      'Omit the varying arguments from the file and supply them with `-backend-config=production.s3.tfbackend` or `-backend-config=key=value`. The environment is then named explicitly on every command, so it cannot be left over from a previous run.',
  },
  {
    id: 'tfq-st-6',
    domainId: 'tf-state',
    topicId: 'tf-remote-backends',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 3,
    prompt: 'What is the security consideration when using a `terraform_remote_state` data source?',
    options: [
      { id: 'a', text: 'It requires the producing configuration to be applied first' },
      {
        id: 'b',
        text: 'It reads the entire state file, including secrets - not just the outputs',
      },
      { id: 'c', text: 'It bypasses state locking on the source backend' },
      { id: 'd', text: 'It writes to the source state as well as reading it' },
    ],
    correct: ['b'],
    explanation:
      'Anyone who can run the consuming configuration effectively has read access to the producer’s secrets. Narrower alternatives: publish specific values to a parameter store and read those with per-parameter IAM, or on HCP Terraform use `tfe_outputs`, which exposes only declared outputs.',
  },
  {
    id: 'tfq-st-7',
    domainId: 'tf-state',
    topicId: 'tf-state-fundamentals',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What are `serial` and `lineage` in a state file for?',
    options: [
      { id: 'a', text: 'The Terraform version and the provider version' },
      {
        id: 'b',
        text: 'A write counter for detecting stale writes, and a UUID identifying the state’s history',
      },
      { id: 'c', text: 'The number of resources and their creation order' },
      { id: 'd', text: 'The lock id and the lock holder' },
    ],
    correct: ['b'],
    explanation:
      '`serial` increments on every write, so a backend can reject a write based on stale data. `lineage` prevents one project’s state overwriting another’s - a lineage mismatch is almost always a misconfigured backend `key` rather than corruption.',
  },
  {
    id: 'tfq-st-8',
    domainId: 'tf-state',
    topicId: 'tf-state-fundamentals',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Give the strongest reason workspaces are a poor fit for separating production from staging.',
    options: [
      { id: 'a', text: 'Workspaces cannot hold more than one state each' },
      {
        id: 'b',
        text: 'They share one backend, one set of credentials and one configuration',
      },
      { id: 'c', text: 'terraform.workspace cannot be referenced inside modules' },
      { id: 'd', text: 'Workspaces do not support locking' },
    ],
    correct: ['b'],
    explanation:
      'A mistake in one workspace can reach the other’s state, CI cannot hold different credentials per environment, and structural differences have to be expressed as conditionals on `terraform.workspace`. Separate directories with separate backend keys give separate blast radius and separate credentials.',
  },
  {
    id: 'tfq-st-9',
    domainId: 'tf-state',
    topicId: 'tf-drift-and-state-commands',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What does `terraform state rm` do?',
    options: [
      { id: 'a', text: 'Destroys the resource and removes it from state' },
      { id: 'b', text: 'Removes the resource from state; the real resource keeps running' },
      { id: 'c', text: 'Marks the resource for replacement on the next apply' },
      { id: 'd', text: 'Removes the resource from the configuration file' },
    ],
    correct: ['b'],
    explanation:
      'It forgets rather than destroys. A subsequent plan proposes creating the resource again, because Terraform no longer knows it exists. To destroy something, remove its block and apply; to hand it over, use a `removed` block with `destroy = false`.',
  },
  {
    id: 'tfq-st-10',
    domainId: 'tf-state',
    topicId: 'tf-drift-and-state-commands',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which command replaced the deprecated `terraform refresh`?',
    options: [
      { id: 'a', text: 'terraform plan -refresh=true' },
      { id: 'b', text: 'terraform apply -refresh-only' },
      { id: 'c', text: 'terraform state pull' },
      { id: 'd', text: 'terraform init -upgrade' },
    ],
    correct: ['b'],
    explanation:
      '`terraform apply -refresh-only` accepts drift into state without touching infrastructure, and `terraform plan -refresh-only` previews it. The split exists so that accepting drift is a reviewed action rather than a side effect.',
  },
  {
    id: 'tfq-st-11',
    domainId: 'tf-state',
    topicId: 'tf-drift-and-state-commands',
    kind: 'mcq',
    category: 'yaml',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'You rename a resource from `aws_s3_bucket.old` to `aws_s3_bucket.new`. A plan shows 1 to add and 1 to destroy. Which block makes this a move instead?',
    code: {
      title: 'What to add',
      language: 'hcl',
      code: `resource "aws_s3_bucket" "new" {
  bucket = "acme-data"
}

# Which block goes here?`,
    },
    options: [
      { id: 'a', text: 'import { to = aws_s3_bucket.new, id = "acme-data" }' },
      { id: 'b', text: 'moved { from = aws_s3_bucket.old, to = aws_s3_bucket.new }' },
      { id: 'c', text: 'removed { from = aws_s3_bucket.old }' },
      { id: 'd', text: 'lifecycle { prevent_destroy = true }' },
    ],
    correct: ['b'],
    explanation:
      'A `moved` block tells Terraform the address changed, so it updates state instead of destroying and recreating. It appears in the plan as "has moved to", is reviewable in a pull request, and gives every colleague and CI runner the same result - unlike `terraform state mv`, which only helps whoever ran it.',
  },
  {
    id: 'tfq-st-12',
    domainId: 'tf-state',
    topicId: 'tf-drift-and-state-commands',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that shows only drift - how reality differs from state - without proposing any configuration changes.',
    acceptedAnswers: ['terraform plan -refresh-only', 'terraform plan --refresh-only'],
    answerHint: 'terraform plan ...',
    explanation:
      'This isolates drift from your own changes, which matters when a plan is confusingly large. Having seen it, you then decide: apply your configuration and revert the manual change, update the configuration to match, or add `ignore_changes` if another system owns that attribute.',
  },
  {
    id: 'tfq-st-13',
    domainId: 'tf-state',
    topicId: 'tf-drift-and-state-commands',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which of these `terraform state` subcommands changes real infrastructure?',
    options: [
      { id: 'a', text: 'state rm' },
      { id: 'b', text: 'state mv' },
      { id: 'c', text: 'state push' },
      { id: 'd', text: 'None of them' },
    ],
    correct: ['d'],
    explanation:
      'Every `terraform state` subcommand changes bookkeeping only. That is what makes them useful for refactoring and dangerous for confusion - `state rm` in particular looks like a delete and is not.',
  },
]
