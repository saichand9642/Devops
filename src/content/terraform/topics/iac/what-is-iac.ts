import type { Topic } from '../../../types'

export const whatIsIac: Topic = {
  id: 'tf-what-is-iac',
  title: 'What infrastructure as code actually is',
  domainId: 'tf-iac',
  difficulty: 'beginner',
  estimatedMinutes: 14,
  order: 1,
  tags: ['iac', 'declarative', 'imperative', 'idempotence', 'drift', 'objective-1'],
  oneLiner:
    'Managing servers, networks and services by committing text files instead of clicking in a console.',
  explanation: [
    '**Infrastructure as code (IaC)** means describing the infrastructure you want in files, keeping those files in version control, and letting a tool make reality match them. The files are the source of truth; the console is a read-only window.',
    'The opposite is what most people start with: logging into a web console, clicking through wizards, and remembering (or not remembering) what you did. That works for one server. It falls apart at ten, and it is impossible to review, test or reproduce.',
    'IaC tools split into two styles. **Imperative** tools describe the *steps*: create this, then attach that. **Declarative** tools describe the *end state*: there should be one server of this size with this disk. Terraform is declarative - you write what you want, and Terraform works out the steps.',
    'The other word you will meet is **idempotence**: running the same configuration twice produces the same result, and the second run changes nothing. That is what makes `terraform apply` safe to run repeatedly, and it is why Terraform always shows you a plan first.',
  ],
  whyItMatters: [
    'Objective 1 of the exam is entirely conceptual. You will be asked to identify advantages of IaC and to distinguish declarative from imperative - no HCL required.',
    'Everything else in Terraform follows from the declarative model. Once you accept that you describe the destination rather than the journey, `plan`, `state` and `drift` all stop being surprising.',
    'In real work this is the difference between "the person who built it left" and "read the repository". Infrastructure that exists only in someone memory is a liability.',
  ],
  howItWorks: [
    'You write configuration files describing the desired state - in Terraform, `.tf` files written in **HCL** (HashiCorp Configuration Language).',
    'You commit them to version control, so every infrastructure change goes through the same review, history and rollback as application code.',
    'The tool compares your desired state with the real world and computes the difference. Terraform records what it manages in **state**, so it knows the difference between "this does not exist yet" and "this exists and needs changing".',
    'The tool applies only that difference. Nothing you did not ask to change is touched.',
    '**Drift** is when reality stops matching the files - someone resized a disk by hand. The next plan reveals the drift, and applying either restores your declared state or, if the manual change was correct, prompts you to update the files.',
    'Because the files fully describe the environment, you can create a second identical one by pointing the same configuration at a different target - that is how staging and production stay alike.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Imperative or declarative?',
      caption:
        'Ask what the file contains: a list of steps, or a description of the finished result. Terraform is always the second.',
      question: 'What does the configuration describe?',
      branches: [
        {
          condition: 'the steps to take, in order',
          result: 'Imperative',
          detail: 'A shell script, or the AWS CLI called line by line',
        },
        {
          condition: 'the end state you want to exist',
          result: 'Declarative',
          detail: 'Terraform, CloudFormation, Kubernetes manifests',
          tone: 'accent',
        },
        {
          condition: 'you must not care whether it already exists',
          result: 'Declarative, for idempotence',
          detail: 'Running it twice changes nothing the second time',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'The infrastructure-as-code loop',
      caption:
        'The same loop as application code: change a file, review the change, ship it. The plan step is what makes it safe.',
      nodes: [
        {
          label: 'Write the desired state in files',
          detail: 'HCL in .tf files, kept in Git',
          tone: 'accent',
        },
        {
          label: 'Review the change',
          detail: 'Pull request, exactly like application code',
          arrowLabel: 'commit',
        },
        {
          label: 'Tool computes the difference',
          detail: 'Desired state vs recorded state vs reality',
          arrowLabel: 'terraform plan',
        },
        {
          label: 'Apply only that difference',
          detail: 'Nothing you did not ask to change is touched',
          arrowLabel: 'you approve it',
          tone: 'success',
        },
        {
          label: 'Reality matches the files again',
          detail: 'A second run reports no changes - idempotence',
          branch: {
            label: 'Somebody clicks in the console',
            detail: 'That is drift; the next plan shows it',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Configuration file (.tf)',
      purpose:
        'The desired state, written in HCL. Every file in the directory is loaded and concatenated - filenames carry no meaning to Terraform.',
      fields: [
        {
          path: 'main.tf',
          meaning: 'Conventional entry point. A convention only, not a requirement.',
        },
        { path: 'variables.tf', meaning: 'Conventional home for variable blocks.' },
        { path: 'outputs.tf', meaning: 'Conventional home for output blocks.' },
        {
          path: 'terraform.tfvars',
          meaning: 'Values for variables. Loaded automatically. Never commit secrets here.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The Friday afternoon firewall rule',
    story: [
      'A team opens a port by hand to unblock a customer demo. It works. Nobody writes it down.',
      'Three months later the environment is rebuilt from the repository for a region migration. The port is not in the files, so it is not in the new environment. The same customer breaks, and nobody connects the two events for a day and a half.',
      'With infrastructure as code the fix is a two-line commit that is reviewed, dated, attributed and reproduced automatically in every environment. The audit trail is a side effect rather than a chore.',
      'This is the practical argument for IaC: not elegance, but that the repository remembers things people do not.',
    ],
  },
  yamlExamples: [
    {
      title: 'The same server, described declaratively',
      language: 'hcl',
      explanation:
        'Note what is absent: no "if it does not exist" check, no ordering, no API calls. You state the destination and Terraform finds the route.',
      code: `resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"

  tags = {
    Name        = "web-server"
    Environment = "production"
  }
}`,
    },
    {
      title: 'The imperative equivalent, for contrast',
      language: 'bash',
      explanation:
        'This script is not idempotent: run it twice and you get two servers. Making it idempotent means writing the existence checks yourself - which is exactly the work Terraform does for you.',
      code: `# Creates a server. Every single time.
aws ec2 run-instances \\
  --image-id ami-0abcdef1234567890 \\
  --instance-type t3.micro \\
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-server}]'`,
    },
  ],
  imperative: [
    {
      command: 'terraform init',
      what: 'Prepares a directory: downloads providers and configures the backend.',
      expected: 'Terraform has been successfully initialized!',
    },
    {
      command: 'terraform plan',
      what: 'Shows what would change, without changing anything.',
      expected: 'Plan: 1 to add, 0 to change, 0 to destroy.',
    },
    {
      command: 'terraform apply',
      what: 'Makes reality match the configuration, after you approve the plan.',
      expected: 'Apply complete! Resources: 1 added, 0 changed, 0 destroyed.',
    },
    {
      command: 'terraform plan',
      what: 'Run it again straight away to see idempotence for yourself.',
      expected: 'No changes. Your infrastructure matches the configuration.',
    },
  ],
  declarative: {
    steps: [
      'Create an empty directory and a single `main.tf`.',
      'Declare the provider you need and one resource.',
      'Run `terraform init` once to download the provider.',
      'Run `terraform plan` and read every line before approving anything.',
      'Run `terraform apply`, then run `terraform plan` again to confirm it reports no changes.',
    ],
    code: [
      {
        title: 'A complete, minimal configuration',
        language: 'hcl',
        explanation:
          'The local provider needs no credentials, so this really does run anywhere - useful for practising the workflow without a cloud account.',
        code: `terraform {
  required_version = ">= 1.5"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

resource "local_file" "greeting" {
  filename = "\${path.module}/hello.txt"
  content  = "Managed by Terraform.\\n"
}`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform plan -detailed-exitcode',
      what: 'Exits 0 for no changes, 2 for changes pending, 1 for an error.',
      expected: 'Exit code 0 once your infrastructure matches the files.',
      namespaceNote: 'The exit codes make this the right form to use in CI.',
    },
    {
      command: 'terraform show',
      what: 'Prints the current state in human-readable form.',
    },
    {
      command: 'terraform state list',
      what: 'Lists every resource address Terraform is managing.',
      expected: 'local_file.greeting',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform plan',
      what: 'Reports changes you did not make - that is drift.',
      expected: 'A ~ or -/+ marker on a resource nobody edited in the files.',
    },
    {
      command: 'terraform validate',
      what: 'Catches syntax and type errors without contacting any provider.',
    },
    {
      command: 'terraform fmt -recursive',
      what: 'Rewrites files to canonical style, so review diffs stay about substance.',
    },
  ],
  commonMistakes: [
    'Treating the console as a second source of truth. Every manual change becomes drift that someone has to reconcile later.',
    'Confusing declarative with idempotent. They are related but different: declarative is *how you write it*, idempotent is *what happens when you run it twice*.',
    'Assuming IaC means "no more mistakes". It means mistakes are reviewable, revertible and reproducible - which is better, not perfect.',
    'Committing `terraform.tfvars` with credentials in it. The files are the source of truth for *configuration*, not for secrets.',
    'Believing filenames matter. Terraform concatenates every `.tf` file in the directory; `main.tf` is a convention for humans.',
  ],
  examTips: [
    'Learn the four headline advantages of IaC: version control and auditability, repeatability across environments, automation and speed, and self-documenting infrastructure.',
    'If a question contrasts "describe the steps" with "describe the result", the second is declarative and the second is Terraform.',
    'Idempotence is the property that makes repeated applies safe. Expect it as a multiple-choice answer.',
    'Drift means reality no longer matches configuration. The command that reveals it is `terraform plan`.',
    'Terraform is declarative, but the *execution* is imperative under the hood - it derives an ordered graph of API calls. Questions sometimes probe that distinction.',
  ],
  summary: [
    'IaC means the files are the source of truth and the tool makes reality match them.',
    'Terraform is declarative: you describe the end state, not the steps.',
    'Idempotence means a second identical run changes nothing.',
    'Drift is reality diverging from your files, and `terraform plan` is how you find it.',
    'The real payoff is review, history and reproducibility - not typing speed.',
  ],
  practice: [
    {
      id: 'tf-what-is-iac-p1',
      level: 'beginner',
      prompt:
        'A colleague says "our bash script that calls the AWS CLI is infrastructure as code, so we already do IaC". Are they right?',
      answer:
        'Partly. It is infrastructure as code - the infrastructure is defined in a versioned file - but it is *imperative* IaC and almost certainly not idempotent.',
      explanation:
        'IaC is about defining infrastructure in code, which the script does. What it lacks is declarative semantics: run it twice and you get duplicate resources, because the script describes actions rather than a desired end state.',
    },
    {
      id: 'tf-what-is-iac-p2',
      level: 'beginner',
      prompt: 'Name four concrete advantages of IaC that an exam question might list.',
      answer:
        'Version control and audit history; repeatable environments; automation that removes manual error; and configuration that documents itself.',
      explanation:
        'These four map directly onto objective 1b. "Cheaper" and "faster" are consequences rather than the published advantages.',
    },
    {
      id: 'tf-what-is-iac-p3',
      level: 'intermediate',
      prompt:
        'Someone enlarges a disk in the cloud console on a resource Terraform manages. What does the next `terraform plan` show, and what are your two legitimate options?',
      answer:
        'The plan shows the disk shrinking back to the size in your configuration. Either accept your declared state and apply, or - if the manual change was correct - update the configuration to the new size so the plan comes back clean.',
      explanation:
        'This is drift. The wrong third option is to ignore it: unreconciled drift means the next unrelated apply silently reverts someone else’s fix.',
    },
    {
      id: 'tf-what-is-iac-p4',
      level: 'advanced',
      prompt:
        'Why does Terraform need a state file at all, if the configuration already describes the desired end state?',
      answer:
        'Because desired state alone cannot tell Terraform whether a resource already exists, nor which real-world object corresponds to which configuration block. State is the mapping from your addresses to real resource identifiers.',
      explanation:
        'Without state, Terraform would have to discover and match every resource on every run, and it could not detect that a resource you deleted from the configuration should now be destroyed.',
    },
  ],
  lab: {
    title: 'Prove idempotence and create drift on purpose',
    scenario:
      'Use the local provider - no cloud account, no credentials - to run the full workflow, then break it by hand and watch Terraform notice.',
    prerequisites: ['Terraform 1.5 or newer on your PATH', 'An empty directory'],
    tasks: [
      { instruction: 'Create a directory `iac-lab` and change into it.' },
      {
        instruction:
          'Write a `main.tf` that pins the `hashicorp/local` provider and declares a `local_file` resource writing "v1" to `note.txt`.',
        hint: 'Use the `required_providers` block shown in this lesson.',
      },
      {
        instruction:
          'Run `terraform init`, then `terraform plan`. Note how many resources it adds.',
      },
      {
        instruction: 'Run `terraform apply` and confirm `note.txt` exists with the right content.',
      },
      {
        instruction: 'Run `terraform plan` again and confirm it reports no changes.',
        hint: 'This is idempotence. Nothing to do on a second run.',
      },
      {
        instruction:
          'Edit `note.txt` by hand with a text editor, changing the content. Run `terraform plan` again.',
        hint: 'You have just created drift.',
      },
      { instruction: 'Explain in one sentence what the plan proposes and why.' },
      { instruction: 'Run `terraform destroy` and confirm the file is gone.' },
    ],
    solution: [
      {
        title: 'main.tf',
        language: 'hcl',
        code: `terraform {
  required_version = ">= 1.5"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

resource "local_file" "note" {
  filename = "\${path.module}/note.txt"
  content  = "v1\\n"
}`,
      },
      {
        title: 'The whole workflow',
        language: 'bash',
        code: `mkdir iac-lab && cd iac-lab
# ... write main.tf ...

terraform init          # downloads hashicorp/local
terraform plan          # Plan: 1 to add
terraform apply -auto-approve
cat note.txt            # v1

terraform plan          # No changes. Idempotent.

echo "edited by hand" > note.txt
terraform plan          # 1 to change - Terraform wants to restore "v1"

terraform destroy -auto-approve
ls note.txt             # No such file`,
      },
    ],
    verification: [
      {
        command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
        what: 'Confirms a clean plan programmatically.',
        expected: 'exit=0 immediately after a successful apply.',
      },
      {
        command: 'terraform state list',
        what: 'Shows the one address Terraform is managing.',
        expected: 'local_file.note',
      },
    ],
    cleanup: [
      {
        command: 'terraform destroy -auto-approve && cd .. && rm -rf iac-lab',
        what: 'Removes the managed file and the lab directory.',
      },
    ],
  },
  relatedTopicIds: ['tf-terraform-advantages', 'tf-workflow-overview', 'tf-state-fundamentals'],
  docs: [
    {
      title: 'What is Infrastructure as Code with Terraform?',
      url: 'https://developer.hashicorp.com/terraform/tutorials/aws-get-started/infrastructure-as-code',
    },
  ],
}
