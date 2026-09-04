import type { Topic } from '../../../types'

export const stateLocking: Topic = {
  id: 'tf-state-locking',
  title: 'State locking',
  domainId: 'tf-state',
  difficulty: 'intermediate',
  estimatedMinutes: 12,
  order: 4,
  tags: ['locking', 'force-unlock', 'dynamodb', 'use_lockfile', 'objective-6b'],
  oneLiner:
    'What a lock protects against, which backends support it, and the one command you should be careful with.',
  explanation: [
    'A **state lock** stops two operations writing state at the same time. Without one, two simultaneous applies can each read the same state, each make changes, and each write - so one set of changes is silently lost and state no longer matches reality.',
    'Terraform locks automatically for any operation that could write state: `apply`, `destroy`, `state mv`, `state rm`, `import`, `taint`. Read-only operations such as `plan` also take a lock by default, to get a consistent read.',
    'Lock support depends on the backend. Local uses an OS file lock (same machine only). S3 supports it via `use_lockfile` or a DynamoDB table. Azure and GCS lock natively. HCP Terraform queues runs, which is locking by another name.',
    '`terraform force-unlock` removes a lock. It exists for genuinely stale locks left by a crashed run - and using it on a live lock is one of the few ways to actually corrupt state.',
  ],
  whyItMatters: [
    'Objective 6b is describing state locking, and the backend-support question is exactly what gets examined.',
    'A lost apply is a subtle, hard-to-diagnose failure: nothing errors, and state simply stops matching reality.',
    'The `force-unlock` guidance matters because the command looks like a fix and can be the cause.',
  ],
  howItWorks: [
    'Before a write operation, Terraform asks the backend for a lock. If it is held, Terraform reports who holds it, since when, and the operation - then waits or fails.',
    '`-lock-timeout=5m` makes Terraform wait for a lock rather than failing immediately. Useful in CI where two pipelines may overlap briefly.',
    '`-lock=false` skips locking entirely. It is for exceptional situations only, and it removes the protection this lesson is about.',
    'The lock record contains an ID, the operation, who, from where and when. That information is printed in the error, which is how you decide whether a lock is stale.',
    'S3 `use_lockfile = true` (Terraform 1.10+) creates a `.tflock` object beside the state. It replaces the DynamoDB table, which is still widely deployed and still supported.',
    '`terraform force-unlock <ID>` deletes the lock. Always confirm no run is in progress first - check CI, and ask the person named in the message.',
    'HCP Terraform serialises runs per workspace, so concurrent applies queue instead of racing.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'Two applies, with locking working',
      caption:
        'The second run waits rather than racing. Without a lock, both would read the same state and one write would be lost.',
      participants: [
        { id: 'a', label: 'Alice' },
        { id: 'lock', label: 'Lock' },
        { id: 'b', label: 'Bob' },
      ],
      messages: [
        { from: 'a', to: 'lock', label: 'acquire for apply' },
        { from: 'lock', to: 'a', label: 'granted', kind: 'return' },
        { from: 'b', to: 'lock', label: 'acquire for apply' },
        { from: 'lock', to: 'b', label: 'held by alice since 14:02', kind: 'return' },
        { from: 'a', to: 'lock', label: 'write state, release' },
        { from: 'b', to: 'lock', label: 'retry within -lock-timeout' },
        { from: 'lock', to: 'b', label: 'granted - reads Alice’s state', kind: 'return' },
      ],
    },
    {
      kind: 'decision',
      title: 'A lock error. What now?',
      caption:
        'force-unlock is the last option, not the first. Check whether the lock is genuinely stale.',
      question: 'Is anything actually running?',
      branches: [
        {
          condition: 'yes - a pipeline or a colleague',
          result: 'Wait',
          detail: 'Use -lock-timeout=10m so the next run queues instead of failing',
          tone: 'accent',
        },
        {
          condition: 'unsure',
          result: 'Ask the person named in the error',
          detail: 'The message includes who, where and when',
        },
        {
          condition: 'no - a run crashed and left it',
          result: 'terraform force-unlock <ID>',
          detail: 'Then run a plan to confirm state is coherent',
          tone: 'warning',
        },
        {
          condition: 'it happens constantly',
          result: 'Fix the pipeline',
          detail: 'Serialise runs per state, or split the state',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Locking support and flags',
      purpose: 'Which backends lock, and the flags that change locking behaviour.',
      fields: [
        { path: 'local', meaning: 'OS file lock. Same machine only.', required: true },
        {
          path: 's3 + use_lockfile',
          meaning: 'S3-native lock object (Terraform 1.10+).',
          required: true,
        },
        { path: 's3 + dynamodb_table', meaning: 'The older mechanism. Still supported.' },
        { path: 'azurerm, gcs, consul', meaning: 'Native locking.' },
        { path: 'cloud (HCP Terraform)', meaning: 'Runs are queued per workspace.' },
        {
          path: '-lock-timeout=DURATION',
          meaning: 'Wait this long instead of failing immediately.',
        },
        { path: '-lock=false', meaning: 'Skip locking. Exceptional use only.', required: true },
      ],
    },
  ],
  realWorldExample: {
    title: 'The apply that vanished',
    story: [
      'A team ran Terraform from an S3 backend with no DynamoDB table and, at the time, no `use_lockfile`. Two engineers applied within about thirty seconds of each other.',
      'Both runs read the same state, both succeeded, and both wrote. The second write overwrote the first. Terraform now believed the first engineer’s three new resources did not exist.',
      'Nothing errored. The resources kept running, unmanaged. The problem surfaced two weeks later when a `terraform destroy` in a teardown left three orphaned resources behind, still costing money.',
      'Enabling locking made concurrent applies queue instead of racing. The three orphans had to be imported by hand, which is the usual cost of discovering this the hard way.',
    ],
    code: [
      {
        title: 'The one line that prevents it',
        language: 'hcl',
        code: `terraform {
  backend "s3" {
    bucket  = "acme-tfstate"
    key     = "production/terraform.tfstate"
    region  = "eu-west-1"
    encrypt = true

    # Terraform 1.10+: locking with no extra infrastructure.
    use_lockfile = true
  }
}`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Locking configuration, old and new',
      language: 'hcl',
      explanation:
        'Both are valid. `use_lockfile` needs no extra infrastructure, which is why new setups prefer it.',
      code: `# Terraform 1.10+ - S3-native locking, no extra resources.
terraform {
  backend "s3" {
    bucket       = "acme-tfstate"
    key          = "production/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

# The older mechanism, still very common.
terraform {
  backend "s3" {
    bucket         = "acme-tfstate"
    key            = "production/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "acme-tfstate-locks"
  }
}

# The table it needs - note the exact hash key name.
resource "aws_dynamodb_table" "locks" {
  name         = "acme-tfstate-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"   # must be exactly this

  attribute {
    name = "LockID"
    type = "S"
  }
}`,
    },
    {
      title: 'Reading and handling a lock error',
      language: 'bash',
      explanation:
        'Everything you need in order to decide is in the error: who, where, when and which operation.',
      code: `$ terraform apply
╷
│ Error: Error acquiring the state lock
│
│ Error message: operation error DynamoDB: PutItem,
│ ConditionalCheckFailedException
│ Lock Info:
│   ID:        4a1e8c22-9f3d-4b7e-8c11-2f6a0b9d5e77
│   Path:      acme-tfstate/production/terraform.tfstate
│   Operation: OperationTypeApply
│   Who:       alice@laptop-4
│   Version:   1.16.1
│   Created:   2026-09-04 13:58:12.44 +0000 UTC
╵

# Option 1 - wait. Best in CI, where overlap is brief.
terraform apply -lock-timeout=10m

# Option 2 - it is genuinely stale (Alice's laptop crashed).
#   Confirm with Alice and with CI FIRST.
terraform force-unlock 4a1e8c22-9f3d-4b7e-8c11-2f6a0b9d5e77
terraform plan     # verify state is coherent before applying

# Option 3 - never do this to work around a lock.
# terraform apply -lock=false`,
    },
  ],
  imperative: [
    {
      command: 'terraform apply -lock-timeout=10m',
      what: 'Waits up to ten minutes for a lock instead of failing at once.',
      namespaceNote: 'The right default for CI pipelines that can overlap.',
    },
    {
      command: 'terraform force-unlock <LOCK_ID>',
      what: 'Removes a lock record.',
      namespaceNote: 'Only for a confirmed stale lock. On a live lock this can corrupt state.',
    },
    {
      command: 'terraform force-unlock -force <LOCK_ID>',
      what: 'The same, without the confirmation prompt.',
    },
    {
      command: 'aws dynamodb scan --table-name acme-tfstate-locks',
      what: 'Lists current locks when using the DynamoDB mechanism.',
    },
    {
      command: 'aws s3 ls s3://acme-tfstate/production/ | grep tflock',
      what: 'Shows the lock object when using `use_lockfile`.',
    },
  ],
  declarative: {
    steps: [
      'Enable locking on every shared backend. It is one line.',
      'Use `-lock-timeout` in CI so overlapping runs queue rather than fail.',
      'Never use `-lock=false` to get past a lock.',
      'Before `force-unlock`, confirm with the person and the pipeline named in the error.',
      'After `force-unlock`, run a plan before applying anything.',
      'If lock contention is constant, split the state rather than tuning timeouts.',
    ],
    code: [
      {
        title: 'A pipeline that handles contention properly',
        language: 'yaml',
        explanation:
          'Two mechanisms: the CI platform serialises runs, and `-lock-timeout` handles the residual overlap.',
        code: `# .github/workflows/apply.yml
name: terraform apply

on:
  push:
    branches: [main]

# Serialise at the CI level: never two applies for one state.
concurrency:
  group: terraform-production
  cancel-in-progress: false   # never cancel a running apply

jobs:
  apply:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init -input=false

      # And a lock timeout for anything the concurrency group
      # cannot cover, such as a manual apply from a laptop.
      - run: terraform apply -input=false -auto-approve -lock-timeout=15m`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan',
      what: 'Succeeding means no lock is held and state is readable.',
    },
    {
      command: 'aws dynamodb scan --table-name acme-tfstate-locks --query "Count"',
      what: 'Zero means no locks outstanding.',
    },
    {
      command: 'terraform state pull | jq .serial',
      what: 'Compare before and after a suspected lost write.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform apply -lock-timeout=10m',
      what: 'Handles "Error acquiring the state lock" when another run is genuinely in progress.',
    },
    {
      command: 'terraform force-unlock <ID>',
      what: 'Clears a lock left by a crashed run - after confirming nothing is running.',
    },
    {
      command: 'aws dynamodb scan --table-name <table>',
      what: 'Inspects lock records directly when the error is unclear.',
    },
    {
      command: 'terraform plan',
      what: 'Run this after any force-unlock to confirm state is coherent before applying.',
    },
  ],
  commonMistakes: [
    'Running a shared S3 backend with no locking mechanism at all.',
    'Using `-lock=false` to get past a lock error. It removes the protection rather than resolving the conflict.',
    '`force-unlock` on a live lock. This is one of the few reliable ways to corrupt state.',
    'Assuming the local backend’s file lock protects against a colleague on another machine.',
    'Naming the DynamoDB hash key anything other than `LockID`.',
    'Treating constant lock contention as a timeout problem rather than a state-granularity problem.',
    'Cancelling a running apply job to clear a lock, which leaves both a stale lock and a half-applied change.',
  ],
  examTips: [
    'Locking prevents concurrent state writes and is automatic for any write operation.',
    'Not every backend supports it. Local locks per machine; S3 needs `use_lockfile` or a DynamoDB table; Azure and GCS lock natively.',
    '`-lock-timeout=DURATION` waits; `-lock=false` disables locking.',
    '`terraform force-unlock <ID>` removes a lock and should be used only when it is genuinely stale.',
    'The DynamoDB table’s hash key must be `LockID`.',
    'HCP Terraform queues runs per workspace instead of using an explicit lock.',
  ],
  summary: [
    'A lock stops two writes racing and silently losing one.',
    'Terraform locks automatically; support depends on the backend.',
    '`-lock-timeout` waits, `-lock=false` disables - use the first, avoid the second.',
    '`force-unlock` is for confirmed stale locks only, and always verify with a plan afterwards.',
    'Constant contention means the state is too coarse, not that the timeout is too short.',
  ],
  practice: [
    {
      id: 'tf-lock-p1',
      level: 'beginner',
      prompt: 'What does state locking prevent?',
      answer:
        'Two operations writing state at the same time, which would cause one set of changes to be silently lost and state to diverge from reality.',
      explanation:
        'Nothing errors in that scenario, which is what makes it dangerous. The resources exist but are no longer in state.',
    },
    {
      id: 'tf-lock-p2',
      level: 'beginner',
      prompt: 'Which two S3 backend settings provide locking?',
      answer: '`use_lockfile = true` (Terraform 1.10+) or `dynamodb_table = "<name>"`.',
      explanation:
        'The DynamoDB table must have a hash key named exactly `LockID`. `use_lockfile` needs no extra infrastructure.',
    },
    {
      id: 'tf-lock-p3',
      level: 'intermediate',
      prompt:
        'You get a lock error in CI. What is the right first response, and what is the wrong one?',
      answer:
        'Right: re-run with `-lock-timeout` so the job waits for the other run to finish, and serialise runs at the CI level. Wrong: `force-unlock`, or `-lock=false` - both remove the protection while another run may still be writing.',
      explanation:
        'A lock error in CI is usually two pipelines overlapping, which is exactly the situation locking exists for.',
    },
    {
      id: 'tf-lock-p4',
      level: 'advanced',
      prompt:
        'Why can `terraform force-unlock` on a live lock corrupt state, and what should you check first?',
      answer:
        'Because the running operation still intends to write. Removing its lock lets a second run read the pre-change state and write over the first run’s result, losing changes and leaving state inconsistent with reality. Check the `Who` and `Created` fields in the error, ask that person, and check whether any pipeline job is in progress.',
      explanation:
        'A genuinely stale lock is one whose owning process is definitely gone - a crashed runner, a killed terminal. After clearing it, run a plan before applying.',
    },
  ],
  lab: {
    title: 'Hold a lock and break it',
    scenario:
      'Use the local backend to hold a lock, observe the error another process gets, then clear a genuinely stale lock and verify state.',
    prerequisites: ['Terraform 1.5 or newer', 'Two terminals, or a background process'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `time_sleep` resource (or a local-exec sleep) so an apply takes long enough to observe.',
      },
      {
        instruction:
          'Start an apply in one terminal and, while it runs, start another in a second terminal.',
      },
      { instruction: 'Read the lock error carefully and identify every field it reports.' },
      {
        instruction:
          'Retry the second apply with `-lock-timeout=2m` and confirm it waits rather than failing.',
      },
      {
        instruction:
          'Start an apply and kill it abruptly with Ctrl-C twice, or `kill -9`, to leave a stale lock behind.',
      },
      {
        instruction: 'Run a plan and confirm it now fails on the stale lock.',
      },
      {
        instruction:
          'Clear the lock with `terraform force-unlock`, then run a plan to verify state is coherent.',
      },
      {
        instruction:
          'Finally run an apply with `-lock=false` and reflect on what protection you just removed.',
      },
      { instruction: 'Destroy and clean up.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
    time  = { source = "hashicorp/time", version = "~> 0.11" }
  }
}

# Long enough to run a second command against the same state.
resource "time_sleep" "slow" {
  create_duration = "45s"
}

resource "local_file" "marker" {
  filename   = "\${path.module}/marker.txt"
  content    = "locked apply completed\\n"
  depends_on = [time_sleep.slow]
}`,
      },
      {
        title: 'Two terminals',
        language: 'bash',
        code: `# --- Terminal 1
terraform init
terraform apply -auto-approve      # takes ~45 seconds

# --- Terminal 2, while the first is running
terraform plan
# Error: Error acquiring the state lock
#   Lock Info:
#     ID:        <uuid>
#     Path:      terraform.tfstate
#     Operation: OperationTypeApply
#     Who:       you@host
#     Created:   ...
# Everything you need to decide is in that block.

# Wait instead of failing:
terraform plan -lock-timeout=2m    # blocks, then succeeds

# --- Leaving a stale lock behind
terraform destroy -auto-approve
terraform apply -auto-approve &
sleep 5
kill -9 %1                          # no chance to release the lock

terraform plan
# Error: Error acquiring the state lock ... (stale)

ls -la .terraform.tfstate.lock.info  # the local lock record
terraform force-unlock "$(jq -r .ID .terraform.tfstate.lock.info)"

# ALWAYS verify after force-unlock:
terraform plan
terraform apply -auto-approve

# And the thing not to do:
terraform apply -auto-approve -lock=false
# Succeeds, and would have succeeded even mid-apply from
# another process - which is precisely the danger.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'ls .terraform.tfstate.lock.info 2>/dev/null || echo "no lock held"',
        what: 'Confirms no lock is outstanding.',
        expected: 'no lock held',
      },
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms state is coherent after clearing a lock.',
        expected: 'exit=0',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f marker.txt .terraform.tfstate.lock.info && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes resources, any lock record and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-remote-backends', 'tf-apply-and-destroy', 'tf-state-fundamentals'],
  docs: [
    {
      title: 'State locking',
      url: 'https://developer.hashicorp.com/terraform/language/state/locking',
    },
    {
      title: 'terraform force-unlock',
      url: 'https://developer.hashicorp.com/terraform/cli/commands/force-unlock',
    },
  ],
}
