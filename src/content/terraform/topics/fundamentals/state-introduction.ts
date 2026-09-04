import type { Topic } from '../../../types'

export const stateIntroduction: Topic = {
  id: 'tf-state-introduction',
  title: 'What state is and why Terraform needs it',
  domainId: 'tf-fundamentals',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 5,
  tags: ['state', 'tfstate', 'mapping', 'refresh', 'sensitive', 'objective-2d'],
  oneLiner:
    'The mapping from your configuration addresses to real-world resources - the file that makes plans possible.',
  explanation: [
    'Terraform records everything it manages in **state**. By default that is a JSON file called `terraform.tfstate` in the working directory.',
    'State is the answer to a question configuration cannot answer: *which real resource does `aws_instance.web` mean?* Your files say what you want; state says what exists and what its real identifier is.',
    'Every plan is a three-way comparison: your **configuration** (desired), your **state** (last known), and **reality** (refreshed from the provider). Remove any one and planning becomes impossible or destructive.',
    'State also holds attribute values Terraform did not choose - IDs, ARNs, computed defaults - which is how one resource can reference another’s generated values. That is also why state must be treated as sensitive: it can contain database passwords in plain text.',
  ],
  whyItMatters: [
    'Objective 2d asks you to explain how Terraform uses and manages state, and objective 6 builds directly on this.',
    'Almost every serious Terraform incident is a state incident: a lost file, two people applying at once, or a resource deleted from state by accident.',
    'Understanding the three-way diff makes plan output predictable rather than mysterious, and explains why `terraform refresh` behaviour matters.',
  ],
  howItWorks: [
    'After every apply, Terraform writes the resource addresses it manages, their real identifiers, and all their attribute values into state.',
    'At plan time it **refreshes**: for each resource in state it asks the provider for current attributes. Differences between state and reality are drift.',
    'It then diffs the refreshed state against your configuration and produces the plan. A resource in configuration but not state is a create; in state but not configuration is a destroy; in both with differences is an update or a replacement.',
    'State records **dependencies** as well, so Terraform can destroy things in the correct order even after you delete the resource blocks from your configuration.',
    'The local file is written atomically and a `terraform.tfstate.backup` copy of the previous version is kept. That backup is often the fastest recovery from a bad state operation.',
    'State is **not encrypted**. Values marked sensitive are hidden in CLI output but stored in full in the file, which is why remote backends with encryption at rest are the norm for anything shared.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The three-way comparison behind every plan',
      caption:
        'Configuration alone cannot produce a plan. State is what turns "this is what I want" into "this is what must change".',
      nodes: [
        {
          label: 'Configuration: what you want',
          detail: 'Your .tf files',
          tone: 'accent',
        },
        {
          label: 'State: what Terraform last recorded',
          detail: 'Addresses, real IDs, attribute values, dependencies',
          arrowLabel: 'read from the backend',
        },
        {
          label: 'Reality: refreshed from the provider',
          detail: 'One read per resource in state',
          arrowLabel: 'refresh',
          branch: {
            label: 'Reality differs from state',
            detail: 'That is drift, and the plan will show it',
          },
        },
        {
          label: 'Diff produces the plan',
          detail: 'create, update, replace or destroy per resource',
        },
        {
          label: 'Apply, then state is rewritten',
          detail: 'State now matches reality again',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'What the plan does, by where a resource appears',
      caption: 'Four combinations, four outcomes. This table is the whole of plan behaviour.',
      question: 'Is the resource in the configuration, in state, or both?',
      branches: [
        {
          condition: 'in configuration, not in state',
          result: 'Create (+)',
          detail: 'Terraform has never made this',
          tone: 'accent',
        },
        {
          condition: 'in both, and they match',
          result: 'No change',
          detail: 'The idempotent case',
        },
        {
          condition: 'in both, but they differ',
          result: 'Update (~) or replace (-/+)',
          detail: 'Which one depends on whether the field forces replacement',
        },
        {
          condition: 'in state, not in configuration',
          result: 'Destroy (-)',
          detail: 'You deleted the block, so Terraform deletes the resource',
          tone: 'warning',
        },
      ],
    },
    {
      kind: 'nested',
      title: 'What is actually inside a state file',
      caption:
        'Note the last line: state holds real attribute values, secrets included. That is why it is sensitive.',
      root: {
        label: 'terraform.tfstate (JSON)',
        children: [
          { label: 'version', detail: 'State format version, e.g. 4' },
          { label: 'terraform_version', detail: 'Which CLI wrote it - the upgrade tripwire' },
          { label: 'serial', detail: 'Increments on every write; used for conflict detection' },
          { label: 'lineage', detail: 'A UUID identifying this state’s history' },
          {
            label: 'resources[]',
            detail: 'One entry per managed resource',
            tone: 'accent',
            children: [
              { label: 'type / name / provider', detail: 'How the address is reconstructed' },
              { label: 'instances[].attributes', detail: 'Every attribute value, in plain text' },
              {
                label: 'instances[].dependencies',
                detail: 'So destroy order survives config deletion',
              },
            ],
          },
          {
            label: 'outputs',
            detail: 'Output values, so other configurations can read them',
            tone: 'muted',
          },
        ],
      },
    },
  ],
  keyObjects: [
    {
      kind: 'terraform.tfstate',
      purpose:
        'The default local state file. JSON, human-readable, and to be treated as sensitive. Never edit it by hand.',
      fields: [
        { path: 'version', meaning: 'State format version. Currently 4.' },
        {
          path: 'terraform_version',
          meaning: 'The CLI that last wrote it. Older CLIs refuse newer state.',
        },
        {
          path: 'serial',
          meaning: 'Write counter. Backends use it to detect a stale write.',
        },
        {
          path: 'lineage',
          meaning: 'UUID for this state’s history; guards against mixing states.',
        },
        {
          path: 'resources[].instances[].attributes',
          meaning: 'The full attribute set, unencrypted. This is why state is a secret.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The deleted state file',
    story: [
      'A developer cleaning up a laptop deleted a project directory including `terraform.tfstate`. It was local state, on one machine, not committed anywhere.',
      'The infrastructure was still running - state does not control anything, it only records. But Terraform now believed nothing existed. The next `plan` proposed creating all forty resources from scratch.',
      'Recovery meant importing forty resources one at a time, each requiring the real identifier looked up in the console. It took two days.',
      'Two things would have prevented it: a remote backend with versioning, and never using local state for anything more than one person’s experiment. `terraform.tfstate.backup` would have helped, but it was in the same deleted directory.',
    ],
  },
  yamlExamples: [
    {
      title: 'A state file, trimmed to the essentials',
      language: 'json',
      explanation:
        'Note `attributes`: the instance ID and every computed value are recorded here. For a database resource, so is the password.',
      code: `{
  "version": 4,
  "terraform_version": "1.16.1",
  "serial": 7,
  "lineage": "8f2a1c0e-4b3d-4a19-9c77-2f1e6b0a5d33",
  "outputs": {
    "bucket_name": {
      "value": "acme-logs-eu",
      "type": "string"
    }
  },
  "resources": [
    {
      "mode": "managed",
      "type": "aws_s3_bucket",
      "name": "logs",
      "provider": "provider[\\"registry.terraform.io/hashicorp/aws\\"]",
      "instances": [
        {
          "schema_version": 0,
          "attributes": {
            "id": "acme-logs-eu",
            "arn": "arn:aws:s3:::acme-logs-eu",
            "bucket": "acme-logs-eu",
            "region": "eu-west-1"
          },
          "dependencies": []
        }
      ]
    }
  ]
}`,
    },
    {
      title: 'Reading state safely from the CLI',
      language: 'bash',
      explanation:
        'Use these commands rather than opening the file. They are stable, they work with any backend, and they will not tempt you to edit anything.',
      code: `# Every address Terraform manages:
terraform state list

# One resource in detail:
terraform state show aws_s3_bucket.logs

# The whole state, human-readable:
terraform show

# The whole state as JSON, for scripting:
terraform show -json | jq '.values.root_module.resources[].address'

# Just the outputs:
terraform output
terraform output -json | jq -r .bucket_name.value`,
    },
  ],
  imperative: [
    {
      command: 'terraform state list',
      what: 'Lists every resource address in state.',
      expected: 'aws_s3_bucket.logs',
    },
    {
      command: 'terraform state show <address>',
      what: 'Prints all recorded attributes for one resource.',
    },
    {
      command: 'terraform show -json | jq .',
      what: 'The whole state as machine-readable JSON.',
    },
    {
      command: 'terraform plan -refresh-only',
      what: 'Shows drift only: how reality differs from state, proposing no configuration changes.',
      namespaceNote: 'The modern replacement for the deprecated `terraform refresh`.',
    },
    {
      command: 'terraform apply -refresh-only',
      what: 'Updates state to match reality without changing any infrastructure.',
    },
  ],
  declarative: {
    steps: [
      'Accept local state only for throwaway experiments.',
      'Move anything shared to a remote backend with encryption, versioning and locking.',
      'Never commit state to version control - it contains secrets and it invites conflicts.',
      'Read state with `terraform state show` and `terraform show`, never with an editor.',
      'Keep `terraform.tfstate.backup` in mind as your first recovery option after a bad state command.',
    ],
    code: [
      {
        title: 'What to gitignore, and why',
        language: 'bash',
        explanation:
          'State is both a secret and a source of merge conflicts. There is no version of committing it that ends well.',
        code: `# .gitignore
.terraform/            # provider binaries, machine-specific
*.tfstate              # contains secrets; belongs in a backend
*.tfstate.*            # includes terraform.tfstate.backup
*.tfvars               # variable values are often secrets
crash.log
crash.*.log

# DO commit:
#   .terraform.lock.hcl   - the provider lock file
#   *.tf                  - the configuration itself
#   .terraform-version    - for version managers`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform state list | wc -l',
      what: 'How many resources Terraform believes it manages.',
    },
    {
      command: 'terraform plan -refresh-only -detailed-exitcode',
      what: 'Exits 0 when state matches reality; 2 when there is drift.',
    },
    {
      command: 'terraform show -json | jq -r .terraform_version',
      what: 'Which CLI last wrote this state - the first thing to check on a version error.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Proposes creating everything: state is missing, empty, or you are in the wrong directory or workspace.',
      expected: 'Plan: 40 to add, 0 to change, 0 to destroy.',
    },
    {
      command: 'terraform plan -refresh-only',
      what: 'Isolates drift from configuration changes, so you can see which is which.',
    },
    {
      command: 'cp terraform.tfstate.backup terraform.tfstate',
      what: 'Restores the previous state after a mistaken state command.',
      namespaceNote:
        'Local backend only, and it recovers exactly one step. Verify with a plan afterwards.',
    },
  ],
  commonMistakes: [
    'Committing `terraform.tfstate` to Git. It contains secrets, and two people applying produces an unmergeable conflict.',
    'Editing state with a text editor. Use the `terraform state` subcommands; hand edits break `serial` and `lineage`.',
    'Believing state controls infrastructure. It records; deleting it orphans resources rather than destroying them.',
    'Assuming sensitive values are safe because the CLI hides them. They are stored in full in the file.',
    'Running `terraform destroy` and expecting resources created by hand to disappear. Destroy only touches what is in state.',
  ],
  examTips: [
    'State maps configuration addresses to real resource identifiers. That is its primary purpose.',
    'The default file is `terraform.tfstate` in the working directory, with `terraform.tfstate.backup` as the previous version.',
    'A plan is a three-way comparison: configuration, state and refreshed reality.',
    'State is stored unencrypted and can contain secrets, so it must be protected.',
    '`terraform refresh` is deprecated; use `terraform apply -refresh-only`.',
    'In configuration but not state = create. In state but not configuration = destroy.',
  ],
  summary: [
    'State is the record of what Terraform manages and what it really is.',
    'Every plan compares configuration, state and refreshed reality.',
    'State holds all attribute values in plain text, so treat it as a secret.',
    'Local state is for experiments; anything shared belongs in a remote backend.',
    'Read state with the CLI, never with an editor.',
  ],
  practice: [
    {
      id: 'tf-state-intro-p1',
      level: 'beginner',
      prompt: 'Why can Terraform not work out what to do from the configuration alone?',
      answer:
        'Because the configuration does not say which real resource each block corresponds to, nor whether it exists yet. State provides that mapping.',
      explanation:
        'Without state Terraform would have to discover and match every resource on every run, and could never know that a deleted block should mean "destroy that specific thing".',
    },
    {
      id: 'tf-state-intro-p2',
      level: 'beginner',
      prompt:
        'You delete a resource block from your configuration and run `terraform plan`. What is proposed?',
      answer:
        'Destroying that resource, because it is in state but no longer in the configuration.',
      explanation:
        'This is the mechanism behind removing infrastructure. If you wanted to stop managing it without destroying it, you would use `terraform state rm` or a `removed` block instead.',
    },
    {
      id: 'tf-state-intro-p3',
      level: 'intermediate',
      prompt:
        'Someone deletes your local state file but the infrastructure is untouched. What is the situation?',
      answer:
        'The resources still exist but are now unmanaged. Terraform will propose creating everything again, and you must import each resource to recover management.',
      explanation:
        'State records rather than controls. This is the argument for a versioned remote backend for anything you care about.',
    },
    {
      id: 'tf-state-intro-p4',
      level: 'advanced',
      prompt:
        'A configuration creates a database with a generated password. Where does that password end up, and what follows from that?',
      answer:
        'In the state file, in plain text, regardless of whether the output is marked sensitive. It follows that state needs encryption at rest, restricted access, and must never be committed or shared casually.',
      explanation:
        'Marking a value sensitive affects CLI output only. The standard mitigations are a remote backend with encryption and tight IAM, and generating secrets in a secrets manager rather than in Terraform where practical.',
    },
  ],
  lab: {
    title: 'Read state, break state, recover state',
    scenario:
      'See the three-way diff for yourself: inspect state, remove a resource from it, watch Terraform propose recreating a thing that already exists, then recover from the backup.',
    prerequisites: ['Terraform 1.5 or newer', 'jq', 'An empty directory'],
    tasks: [
      {
        instruction: 'Create a configuration with two `local_file` resources and apply it.',
      },
      { instruction: 'Run `terraform state list` and `terraform state show` on one of them.' },
      {
        instruction:
          'Open `terraform.tfstate` and find the `serial`, `lineage` and one resource’s `attributes`. Do not edit it.',
      },
      {
        instruction:
          'Delete one of the two files from disk by hand, then run `terraform plan -refresh-only`. Explain what it reports.',
        hint: 'This is drift: state says the file exists, reality disagrees.',
      },
      {
        instruction:
          'Run `terraform state rm` on the other resource, then `terraform plan`. Explain why it now proposes a create even though the file is still there.',
      },
      {
        instruction:
          'Recover by copying `terraform.tfstate.backup` over `terraform.tfstate`, then plan again.',
      },
      {
        instruction:
          'Compare `serial` before and after the state operations, and say what it is for.',
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
  }
}

resource "local_file" "a" {
  filename = "\${path.module}/a.txt"
  content  = "file a\\n"
}

resource "local_file" "b" {
  filename = "\${path.module}/b.txt"
  content  = "file b\\n"
}`,
      },
      {
        title: 'The experiment',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

terraform state list
# local_file.a
# local_file.b

terraform state show local_file.a
jq '{serial, lineage, count: (.resources|length)}' terraform.tfstate

# --- Drift: reality changes, state does not
rm a.txt
terraform plan -refresh-only
# local_file.a has been deleted - state will be updated to match.
# Note: proposes a STATE change, not an infrastructure change.

# --- Forgetting: state changes, reality does not
terraform state rm local_file.b
terraform plan
# Plan: 1 to add.  b.txt still exists on disk, but Terraform
# no longer knows about it, so it wants to create it again.

# --- Recover the previous state
cp terraform.tfstate.backup terraform.tfstate
terraform state list          # local_file.b is back
jq .serial terraform.tfstate  # lower than before: you restored an earlier write

terraform apply -auto-approve # recreates a.txt
terraform plan                # No changes.

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -refresh-only -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms state and reality agree.',
        expected: 'exit=0',
      },
      {
        command: "jq -r '.resources[].name' terraform.tfstate | sort",
        what: 'Confirms both resources are recorded again after recovery.',
        expected: 'a and b',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes the files, the cache and the state.',
      },
    ],
  },
  relatedTopicIds: ['tf-state-fundamentals', 'tf-remote-backends', 'tf-plan'],
  docs: [
    {
      title: 'State',
      url: 'https://developer.hashicorp.com/terraform/language/state',
    },
    {
      title: 'Purpose of Terraform state',
      url: 'https://developer.hashicorp.com/terraform/language/state/purpose',
    },
  ],
}
