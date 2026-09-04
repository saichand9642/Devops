import type { Question } from '../../types'

/** Original practice questions for objective 3. */
export const workflowQuestions: Question[] = [
  {
    id: 'tfq-wf-1',
    domainId: 'tf-workflow',
    topicId: 'tf-workflow-overview',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What are the three stages of the core Terraform workflow?',
    options: [
      { id: 'a', text: 'Init, plan, apply' },
      { id: 'b', text: 'Write, plan, apply' },
      { id: 'c', text: 'Validate, plan, apply' },
      { id: 'd', text: 'Plan, apply, destroy' },
    ],
    correct: ['b'],
    explanation:
      'Write, plan, apply is the conceptual workflow HashiCorp publishes. The CLI commands are more numerous - init, fmt, validate, plan, apply - but objective 3a asks about these three stages.',
  },
  {
    id: 'tfq-wf-2',
    domainId: 'tf-workflow',
    topicId: 'tf-init',
    kind: 'multi',
    category: 'concept',
    difficulty: 'beginner',
    points: 2,
    prompt: 'What does `terraform init` do? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Initialises the backend' },
      { id: 'b', text: 'Installs modules' },
      { id: 'c', text: 'Downloads provider plugins' },
      { id: 'd', text: 'Creates the infrastructure described in the configuration' },
      { id: 'e', text: 'Refreshes state against the real world' },
    ],
    correct: ['a', 'b', 'c'],
    explanation:
      'Init does three things, in that order: backend, modules, providers. It never touches infrastructure, and it only modifies state if you explicitly pass `-migrate-state`. It is idempotent and must be re-run after any dependency or backend change.',
  },
  {
    id: 'tfq-wf-3',
    domainId: 'tf-workflow',
    topicId: 'tf-init',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You are moving state from the local backend to S3. `terraform init` asks whether to copy existing state and you answer "no". What is the result?',
    options: [
      { id: 'a', text: 'State is copied anyway, since that is the safe default' },
      {
        id: 'b',
        text: 'The new backend starts empty, and the next plan proposes recreating everything',
      },
      { id: 'c', text: 'Initialisation fails and nothing changes' },
      { id: 'd', text: 'Terraform keeps using the local backend' },
    ],
    correct: ['b'],
    explanation:
      '"No" means start with empty state at the new location. The old state file is still on disk, so nothing is lost - but the next plan will propose creating your entire environment again. Re-running `terraform init -migrate-state` and answering "yes" copies it up.',
  },
  {
    id: 'tfq-wf-4',
    domainId: 'tf-workflow',
    topicId: 'tf-init',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which init flag re-resolves provider and module versions to the newest allowed?',
    options: [
      { id: 'a', text: '-reconfigure' },
      { id: 'b', text: '-migrate-state' },
      { id: 'c', text: '-upgrade' },
      { id: 'd', text: '-refresh=true' },
    ],
    correct: ['c'],
    explanation:
      '`-upgrade` re-resolves constraints and rewrites the lock file. `-reconfigure` discards a recorded backend configuration without copying state; `-migrate-state` accepts a backend change and copies state across. Only `-migrate-state` moves data.',
  },
  {
    id: 'tfq-wf-5',
    domainId: 'tf-workflow',
    topicId: 'tf-validate-and-fmt',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which of these does `terraform validate` require, and which does it not?',
    options: [
      { id: 'a', text: 'It requires cloud credentials but not terraform init' },
      { id: 'b', text: 'It requires terraform init but not cloud credentials' },
      { id: 'c', text: 'It requires both' },
      { id: 'd', text: 'It requires neither' },
    ],
    correct: ['b'],
    explanation:
      'Validate checks the configuration against the provider *schemas*, which `init` downloads - so init is required. It makes no API calls, so no credentials are needed. `terraform init -backend=false` is enough, which is why validate belongs in a credential-free CI job.',
  },
  {
    id: 'tfq-wf-6',
    domainId: 'tf-workflow',
    topicId: 'tf-validate-and-fmt',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      '`terraform validate` succeeds but `terraform apply` fails with "bucket already exists". Is validate broken?',
    options: [
      { id: 'a', text: 'Yes - validate should check name availability' },
      {
        id: 'b',
        text: 'No - validate makes no API calls, so it cannot know about global name collisions',
      },
      { id: 'c', text: 'Yes - the provider schema includes uniqueness constraints' },
      { id: 'd', text: 'No - but `terraform plan` would have caught it' },
    ],
    correct: ['b'],
    explanation:
      'The dividing line is the API boundary. Validate covers everything determinable locally - syntax, argument names, types, references. Quotas, permissions and name collisions live on the far side and are only discovered at apply time. Plan would not have caught this either.',
  },
  {
    id: 'tfq-wf-7',
    domainId: 'tf-workflow',
    topicId: 'tf-validate-and-fmt',
    kind: 'command',
    category: 'command',
    difficulty: 'beginner',
    points: 2,
    prompt:
      'Write the command that reports non-canonically-formatted files without rewriting them, including subdirectories. This is the form used in CI.',
    acceptedAnswers: [
      'terraform fmt -check -recursive',
      'terraform fmt -recursive -check',
      'terraform fmt --check --recursive',
      'terraform fmt -check=true -recursive',
    ],
    answerHint: 'terraform fmt ...',
    explanation:
      '`-check` reports and exits non-zero without writing; `-recursive` descends into subdirectories. Plain `terraform fmt` in CI rewrites files in an ephemeral checkout, so the fix is discarded and the build passes anyway.',
  },
  {
    id: 'tfq-wf-8',
    domainId: 'tf-workflow',
    topicId: 'tf-plan',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What does `~` mean beside a resource in plan output?',
    options: [
      { id: 'a', text: 'The resource will be destroyed and recreated' },
      { id: 'b', text: 'The resource will be updated in place, keeping its identifier' },
      { id: 'c', text: 'The resource will be created' },
      { id: 'd', text: 'The resource has drifted and will be ignored' },
    ],
    correct: ['b'],
    explanation:
      'The four symbols are `+` create, `-` destroy, `~` update in place, and `-/+` destroy and recreate. `~` is the safe one: the real identifier survives. `-/+` is the one to slow down and read.',
  },
  {
    id: 'tfq-wf-9',
    domainId: 'tf-workflow',
    topicId: 'tf-plan',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What does `terraform plan -detailed-exitcode` return when changes are pending?',
    options: [
      { id: 'a', text: '0' },
      { id: 'b', text: '1' },
      { id: 'c', text: '2' },
      { id: 'd', text: '3' },
    ],
    correct: ['c'],
    explanation:
      '0 means no changes, 1 means an error, 2 means changes are pending. Without the flag, plan exits 0 whether or not changes are pending - which is why a CI "did anything change" check needs it.',
  },
  {
    id: 'tfq-wf-10',
    domainId: 'tf-workflow',
    topicId: 'tf-plan',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Does `terraform plan` modify anything?',
    options: [
      { id: 'a', text: 'No - it is entirely read-only' },
      { id: 'b', text: 'It refreshes state by default, but changes no infrastructure' },
      { id: 'c', text: 'It changes infrastructure only when -auto-approve is passed' },
      { id: 'd', text: 'It writes a lock file entry for each provider' },
    ],
    correct: ['b'],
    explanation:
      'Plan never changes infrastructure, but it does refresh state - it reads every managed resource from its provider and records what it finds. `-refresh=false` skips that, at the cost of planning against possibly stale state.',
  },
  {
    id: 'tfq-wf-11',
    domainId: 'tf-workflow',
    topicId: 'tf-plan',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A plan shows a resource nobody edited reverting to an older value. What has happened, and which command isolates it?',
    options: [
      { id: 'a', text: 'State corruption; run terraform force-unlock' },
      { id: 'b', text: 'Drift; run terraform plan -refresh-only' },
      { id: 'c', text: 'A provider bug; run terraform init -upgrade' },
      { id: 'd', text: 'A stale lock file; delete .terraform.lock.hcl' },
    ],
    correct: ['b'],
    explanation:
      'Someone changed it outside Terraform. `plan -refresh-only` shows drift on its own, without your configuration changes mixed in. You then have to decide: apply your configuration and revert their change, update the configuration to match, or add `ignore_changes` if another system owns that attribute. Ignoring it means the next unrelated apply silently reverts their fix.',
  },
  {
    id: 'tfq-wf-12',
    domainId: 'tf-workflow',
    topicId: 'tf-apply-and-destroy',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which commands can change real infrastructure?',
    options: [
      { id: 'a', text: 'plan and apply' },
      { id: 'b', text: 'apply and destroy' },
      { id: 'c', text: 'validate, plan and apply' },
      { id: 'd', text: 'apply, destroy and the terraform state subcommands' },
    ],
    correct: ['b'],
    explanation:
      'Only `apply` and `destroy` change infrastructure - and `terraform destroy` is the same operation as `terraform apply -destroy`. No `terraform state` subcommand ever touches real resources; they change bookkeeping only.',
  },
  {
    id: 'tfq-wf-13',
    domainId: 'tf-workflow',
    topicId: 'tf-apply-and-destroy',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'An apply fails after creating 8 of 12 resources. What is the state of the world, and what should you do?',
    options: [
      {
        id: 'a',
        text: 'Everything rolled back; re-run the apply to create all 12',
      },
      {
        id: 'b',
        text: 'The 8 exist and are recorded in state; fix the cause and apply again to create the remaining 4',
      },
      {
        id: 'c',
        text: 'State is now inconsistent; delete the 8 by hand and start again',
      },
      { id: 'd', text: 'State is corrupt; restore it from the backend’s previous version' },
    ],
    correct: ['b'],
    explanation:
      'Terraform has no transactions and no rollback. State is written as each resource completes, which is precisely what makes a failed apply resumable. Deleting the 8 by hand creates drift Terraform will then try to reconcile - turning a resumable failure into a real problem.',
  },
  {
    id: 'tfq-wf-14',
    domainId: 'tf-workflow',
    topicId: 'tf-apply-and-destroy',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Does `terraform destroy` remove a resource that was created by hand in the cloud console?',
    options: [
      { id: 'a', text: 'Yes - it destroys everything in the account or subscription' },
      { id: 'b', text: 'Yes, if it is in the same region as managed resources' },
      { id: 'c', text: 'No - it removes only what is recorded in state' },
      { id: 'd', text: 'Only with the -target flag' },
    ],
    correct: ['c'],
    explanation:
      'Destroy walks the state graph in reverse and removes what Terraform manages. Hand-created resources are invisible to it - which also means they are invisible to plan until you import them.',
  },
  {
    id: 'tfq-wf-15',
    domainId: 'tf-workflow',
    topicId: 'tf-apply-and-destroy',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Neither `terraform apply -auto-approve` nor `terraform apply tfplan` prompts for confirmation. Which is safer in a pipeline, and why?',
    options: [
      {
        id: 'a',
        text: 'They are equivalent; both skip the prompt',
      },
      {
        id: 'b',
        text: '-auto-approve, because it always re-plans against current state',
      },
      {
        id: 'c',
        text: 'apply tfplan, because it executes exactly the reviewed plan and refuses to run if state has moved',
      },
      { id: 'd', text: 'Neither should ever be used in a pipeline' },
    ],
    correct: ['c'],
    explanation:
      'The absence of a prompt is not the risk; executing an unreviewed plan is. A saved plan is a fixed artefact tied to a state serial, so what happens is what was approved. `-auto-approve` re-plans at apply time, so drift or another apply in between is executed unseen.',
  },
  {
    id: 'tfq-wf-16',
    domainId: 'tf-workflow',
    topicId: 'tf-apply-and-destroy',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that updates Terraform state to match reality without changing any infrastructure. (This replaced the deprecated `terraform refresh`.)',
    acceptedAnswers: [
      'terraform apply -refresh-only',
      'terraform apply --refresh-only',
      'terraform apply -refresh-only -auto-approve',
    ],
    answerHint: 'terraform apply ...',
    explanation:
      '`terraform apply -refresh-only` accepts drift into state without touching infrastructure. Preview it first with `terraform plan -refresh-only`. The split exists so that accepting drift is a reviewed action rather than a side effect of another command.',
  },
]
