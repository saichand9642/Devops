import type { Topic } from '../../../types'

export const examFormatAndStrategy: Topic = {
  id: 'tf-exam-format-and-strategy',
  title: 'Exam format and how to spend the hour',
  domainId: 'tf-exam-prep',
  difficulty: 'beginner',
  estimatedMinutes: 12,
  order: 1,
  tags: ['exam format', 'strategy', 'time management', 'study plan'],
  oneLiner:
    'What HashiCorp publishes about the exam, what it does not, and how to prepare for it honestly.',
  explanation: [
    'The Terraform Associate (004) is **multiple choice**, **one hour**, **online proctored**, costs **$70.50 USD** plus local taxes, and the certification is valid for **two years**. Those are the figures HashiCorp publishes.',
    'What HashiCorp does **not** publish is the number of questions, the pass mark, or a weighting per objective. Any source stating those with confidence is guessing. This app therefore treats its own targets as study aids rather than official figures.',
    'The objectives themselves are published, and they are precise. Eight objectives, thirty-seven sub-objectives, each phrased as something you should be able to do or explain. That list is the syllabus, and the most reliable way to prepare is to be able to answer every sub-objective in a sentence or two.',
    'Because it is multiple choice rather than hands-on, the exam rewards **precise recall** of behaviour and defaults - what `~>` allows, what the lock file locks, which backend supports locking - rather than the ability to build something under time pressure.',
  ],
  whyItMatters: [
    'Preparing for the exam that exists rather than the one you imagine saves real time. Multiple choice needs different revision from a performance-based exam.',
    'Knowing that no official weighting exists stops you over-weighting a topic because a blog post claimed a percentage.',
    'One hour of multiple choice means a steady pace and no long deliberations - a strategy worth deciding in advance rather than at the time.',
  ],
  howItWorks: [
    'The published format: multiple choice, one hour, online proctored, $70.50 USD, two-year validity. Some questions are single-answer, some select-all-that-apply.',
    'The eight objectives are: IaC concepts; Terraform fundamentals; the core workflow; configuration; modules; state management; maintaining infrastructure; and HCP Terraform.',
    'HashiCorp recommends foundational Terraform knowledge plus some professional experience, but sets no formal prerequisite.',
    'Because the exam is proctored, you need a quiet room, a working webcam and a clear desk. Check the technical requirements before booking, not on the day.',
    'A sensible pace for one hour is roughly a minute a question with time to spare - so answer, flag anything uncertain, and move on rather than deliberating.',
    'Practice questions are most useful for finding gaps, not for scoring. A question you get right by luck is a gap you have not found.',
    'The single most valuable preparation activity is running Terraform. Almost every question is easier if you have seen the behaviour it describes.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'A four-week preparation plan',
      caption:
        'The hands-on work in weeks one to three is what makes week four cheap. Reversing the order does not work.',
      nodes: [
        {
          label: 'Week 1: fundamentals, hands on',
          detail: 'Objectives 1-3. Run the full workflow many times.',
          tone: 'accent',
        },
        {
          label: 'Week 2: the language',
          detail: 'Objective 4. Live in terraform console.',
          arrowLabel: 'the largest objective',
        },
        {
          label: 'Week 3: modules and state',
          detail: 'Objectives 5-7. Build a module; migrate a backend; import something.',
        },
        {
          label: 'Week 4: HCP and recall',
          detail: 'Objective 8, then drill defaults and exact behaviours',
          branch: {
            label: 'No HCP account?',
            detail: 'The free tier is enough for every objective-8 sub-objective',
          },
        },
        {
          label: 'Final days: the objective list',
          detail: 'Answer all 37 sub-objectives aloud, in one or two sentences',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'During the exam: what to do with a question',
      caption:
        'One hour of multiple choice rewards steady progress. Long deliberations cost more than they gain.',
      question: 'How does the question feel?',
      branches: [
        {
          condition: 'you know it',
          result: 'Answer and move on',
          detail: 'Do not second-guess a confident answer',
          tone: 'accent',
        },
        {
          condition: 'you can eliminate two options',
          result: 'Pick the best of the rest, flag it',
          detail: 'A flagged guess beats an unanswered question',
        },
        {
          condition: 'you have no idea',
          result: 'Guess, flag, move on immediately',
          detail: 'There is no penalty for a wrong answer',
        },
        {
          condition: 'it says "select all that apply"',
          result: 'Slow down for this one',
          detail: 'Partial answers usually score nothing',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Published exam facts',
      purpose: 'What HashiCorp actually states about the Terraform Associate 004 exam.',
      fields: [
        { path: 'Format', meaning: 'Multiple choice.', required: true },
        { path: 'Duration', meaning: '1 hour.', required: true },
        { path: 'Delivery', meaning: 'Online proctored.' },
        { path: 'Cost', meaning: '$70.50 USD plus applicable taxes and fees.' },
        { path: 'Validity', meaning: 'Two years.' },
        {
          path: 'Objectives',
          meaning: '8 objectives, 37 sub-objectives, all published.',
          required: true,
        },
        {
          path: 'NOT published',
          meaning: 'Question count, pass mark, and per-objective weighting.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Revising for the wrong exam',
    story: [
      'Someone preparing for the Terraform Associate spent three weeks building an elaborate multi-module AWS project. It was genuinely good work and taught them a lot about Terraform.',
      'They then failed on questions about `~>` semantics, which backend supports locking, the order of variable precedence, and what `.terraform.lock.hcl` locks. None of those had come up while building, because their project happened not to exercise them.',
      'The building was not wasted - it is what makes the concepts stick. What was missing was the second half: going through the published objectives one at a time and checking they could answer each in a sentence.',
      'The lesson is not "do less hands-on work". It is that a multiple-choice exam tests recall of specific behaviour, and the objective list is the checklist for that recall.',
    ],
    code: [
      {
        title: 'The self-test that finds the gaps',
        language: 'bash',
        code: `# Work through the published objectives and answer each aloud.
# If you cannot, that is your revision list.

# 2a  What does "~> 1.2.0" allow? And "~> 1.2"?
# 2d  What is in a state file besides resources?
# 3d  What do +, -, ~ and -/+ mean in a plan?
# 4c  List the six variable sources in precedence order.
# 4d  Which collection type is not indexable?
# 5a  What must a local module source begin with?
# 5d  Does the lock file record module versions?
# 6a  What two files does the local backend maintain?
# 6b  Which S3 settings provide locking?
# 7a  What are the two halves an import needs?
# 7c  List the TF_LOG levels.
# 8a  Which block replaces "backend" for HCP?

# Anything you hesitate on is worth ten minutes of reading.`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The objective checklist, in full',
      language: 'text',
      explanation:
        'This is the syllabus, quoted from HashiCorp’s published exam content list. If you can speak to all thirty-seven, you are ready.',
      code: `1. Infrastructure as Code (IaC) with Terraform
   1a  Explain what IaC is
   1b  Describe the advantages of IaC patterns
   1c  Explain how Terraform manages multi-cloud, hybrid cloud
       and service-agnostic workflows

2. Terraform fundamentals
   2a  Install and version Terraform providers
   2b  Describe how Terraform uses providers
   2c  Write Terraform configuration using multiple providers
   2d  Explain how Terraform uses and manages state

3. Core Terraform workflow
   3a  Describe the Terraform workflow
   3b  Initialize a Terraform working directory
   3c  Validate a Terraform configuration
   3d  Generate and review an execution plan
   3e  Apply changes to infrastructure
   3f  Destroy Terraform-managed infrastructure
   3g  Apply formatting and style adjustments

4. Terraform configuration
   4a  Use and differentiate resource and data blocks
   4b  Refer to resource attributes and create cross-resource references
   4c  Use variables and outputs
   4d  Understand and use complex types
   4e  Write dynamic configuration using expressions and functions
   4f  Define resource dependencies in configuration
   4g  Validate configuration using custom conditions
   4h  Understand best practices for managing sensitive data,
       including secrets management with Vault

5. Terraform modules
   5a  Explain how Terraform sources modules
   5b  Describe variable scope within modules
   5c  Use modules in configuration
   5d  Manage module versions

6. Terraform state management
   6a  Describe the local backend
   6b  Describe state locking
   6c  Configure remote state using the backend block
   6d  Manage resource drift and Terraform state

7. Maintain infrastructure with Terraform
   7a  Import existing infrastructure into your workspace
   7b  Use the CLI to inspect state
   7c  Describe when and how to use verbose logging

8. HCP Terraform
   8a  Use HCP Terraform to create infrastructure
   8b  Describe HCP Terraform collaboration and governance features
   8c  Describe how to organize and use HCP workspaces and projects
   8d  Configure and use HCP Terraform integration`,
    },
    {
      title: 'The facts most worth over-learning',
      language: 'bash',
      explanation:
        'These are the specific, memorisable details that multiple choice is good at testing and that hands-on work does not always surface.',
      code: `# Version constraints
#   ~> 1.2.0   allows 1.2.x, refuses 1.3.0
#   ~> 1.2     allows 1.3 and 1.99, refuses 2.0
#   >= 1.0, < 2.0   commas mean AND. There is no OR.

# Variable precedence, LOWEST to HIGHEST
#   default -> TF_VAR_ -> terraform.tfvars ->
#   terraform.tfvars.json -> *.auto.tfvars (lexical) ->
#   -var / -var-file (in the order given)

# The lock file
#   .terraform.lock.hcl locks PROVIDERS only, and is committed.
#   Module versions are NOT in it.
#   Only "terraform init -upgrade" re-resolves.

# Plan symbols
#   +  create      -  destroy
#   ~  update in place       -/+  destroy and recreate

# Exit codes with -detailed-exitcode
#   0 no changes    1 error    2 changes pending

# State
#   Always plaintext. "sensitive" affects DISPLAY only.
#   Local backend: terraform.tfstate + terraform.tfstate.backup
#   Locking: local (file), S3 (use_lockfile or DynamoDB),
#            azurerm and gcs native, HCP queues runs
#   DynamoDB hash key must be exactly "LockID"

# Types
#   list  ordered, indexable, duplicates
#   set   unordered, de-duplicated, NOT indexable
#   map   string keys, lexical iteration order
#   for_each takes a map or a set - never a list

# Modules
#   Local sources must start with ./ or ../
#   Only REGISTRY sources take a version argument
#   Git pins with ?ref= ; //subdir selects a directory
#   Variables and locals are NEVER inherited
#   Default provider configs ARE inherited; aliased ones are not

# Logging
#   TF_LOG: ERROR, WARN, INFO, DEBUG, TRACE (env var, not a flag)
#   TF_LOG_PATH writes to a file

# HCP
#   The "cloud" block replaces "backend" - never both
#   An HCP workspace has its own variables and credentials;
#   a CLI workspace does not
#   Sentinel: advisory / soft-mandatory / hard-mandatory
#   OPA: advisory / mandatory`,
    },
  ],
  imperative: [
    {
      command: 'terraform -help',
      what: 'Skim the full subcommand list once. There are more than you think, and the exam knows them.',
    },
    {
      command: 'terraform version',
      what: 'Know what this prints: the CLI version and every installed provider version.',
    },
    {
      command: 'terraform plan -detailed-exitcode; echo $?',
      what: 'Confirm the exit codes for yourself rather than memorising them cold.',
    },
    {
      command: 'terraform console',
      what: 'The single most useful command for learning the language quickly.',
    },
    {
      command: "terraform providers schema -json | jq '.provider_schemas | keys'",
      what: 'Proves that the provider, not Terraform, defines what a resource accepts.',
    },
  ],
  declarative: {
    steps: [
      'Read the published objectives first, and use them as the syllabus.',
      'Spend the first three weeks running Terraform, not reading about it.',
      'Use the free HCP Terraform tier to cover objective 8 properly.',
      'In the last week, drill defaults and exact behaviours - that is what multiple choice tests.',
      'Self-test by answering each of the thirty-seven sub-objectives aloud.',
      'Check the proctoring technical requirements before booking.',
    ],
    code: [
      {
        title: 'A study loop that actually works',
        language: 'bash',
        explanation:
          'The pattern is the same for every objective: read it, do it, then explain it without looking. The third step is the one people skip.',
        code: `# For each sub-objective:
#
#   1. READ the relevant documentation page once.
#
#   2. DO it, with the credential-free providers if you have no
#      cloud account. local, random, time and null cover a
#      surprising amount:
#        - the full workflow                    (objective 3)
#        - variables, outputs, expressions      (objective 4)
#        - count and for_each                   (objective 4)
#        - modules, sources, versioning         (objective 5)
#        - backends, workspaces, locking        (objective 6)
#        - import, state inspection, logging    (objective 7)
#
#      Only objective 8 genuinely needs an account, and the
#      free tier is sufficient.
#
#   3. EXPLAIN it aloud, without looking. If you cannot, you
#      have not learned it - go back to step 1.
#
# Then, in the final week, drill the numbers:
#   default parallelism (10), TF_LOG levels, plan exit codes,
#   variable precedence order, what the lock file locks.`,
      },
    ],
  },
  verification: [
    {
      command: 'terraform version && terraform providers',
      what: 'Both appear in exam questions. Know what each prints.',
    },
    {
      command: 'terraform plan -detailed-exitcode; echo "exit=$?"',
      what: 'Verify the exit-code behaviour rather than trusting your memory of it.',
    },
    {
      command: "echo '~> 1.2' | cat",
      what: 'A prompt to state, out loud, exactly what that constraint allows.',
    },
  ],
  troubleshooting: [
    {
      command: 'terraform validate',
      what: 'When practice reveals a gap, the fastest way to confirm behaviour is to try it.',
    },
    {
      command: 'terraform console',
      what: 'Resolves any uncertainty about an expression or a type in seconds.',
    },
    {
      command: 'terraform state show <addr>',
      what: 'Resolves any uncertainty about what state actually records.',
    },
  ],
  commonMistakes: [
    'Trusting a blog post’s claimed question count or pass mark. HashiCorp publishes neither.',
    'Preparing as though it were a hands-on exam. It is multiple choice, and rewards precise recall.',
    'Skipping objective 8 because you have no HCP account. The free tier covers every sub-objective.',
    'Building an elaborate project and never checking the objective list against it.',
    'Deliberating for four minutes on one question in a sixty-minute exam.',
    'Leaving a question unanswered. There is no penalty for a wrong answer.',
    'Discovering the proctoring requirements on exam day.',
  ],
  examTips: [
    'Published: multiple choice, 1 hour, online proctored, $70.50 USD, valid 2 years.',
    'Not published: question count, pass mark, per-objective weighting.',
    'Eight objectives, thirty-seven sub-objectives - that list is the syllabus.',
    'Watch for "select all that apply"; partial answers usually score nothing.',
    'Never leave a question blank - a wrong answer costs no more than no answer.',
    'Flag and return rather than deliberating. One hour goes quickly.',
    'The free HCP Terraform tier is enough for objective 8.',
  ],
  summary: [
    'Multiple choice, one hour, proctored - prepare for recall, not for building under pressure.',
    'The published objective list is the syllabus; nothing about weighting is published.',
    'Run Terraform for three weeks, then drill exact behaviours in the fourth.',
    'The credential-free providers cover objectives 1-7 completely.',
    'Answer everything, flag anything uncertain, and keep moving.',
  ],
  practice: [
    {
      id: 'tf-examfmt-p1',
      level: 'beginner',
      prompt:
        'What format and duration does HashiCorp publish for the Terraform Associate 004 exam?',
      answer: 'Multiple choice, one hour, delivered online proctored.',
      explanation:
        'Notably, the question count and pass mark are not published, so treat any specific figure as unverified.',
    },
    {
      id: 'tf-examfmt-p2',
      level: 'beginner',
      prompt: 'How many objectives and sub-objectives does the exam content list contain?',
      answer: 'Eight objectives and thirty-seven sub-objectives.',
      explanation:
        'That list is the most reliable syllabus available, and the best self-test is to answer every sub-objective in one or two sentences.',
    },
    {
      id: 'tf-examfmt-p3',
      level: 'intermediate',
      prompt: 'You have no cloud account. Which objectives can you still prepare for properly?',
      answer:
        'All of objectives 1 through 7, using the local, random, time and null providers. Objective 8 needs an HCP Terraform account, and the free tier is sufficient.',
      explanation:
        'Those providers exercise the whole workflow, the language, modules, backends, workspaces, locking, import, state inspection and logging.',
    },
    {
      id: 'tf-examfmt-p4',
      level: 'advanced',
      prompt:
        'Given that no per-objective weighting is published, how should you allocate revision time?',
      answer:
        'By sub-objective count and by breadth. Objective 4 has eight sub-objectives and covers the whole language, so it deserves the most time; objectives 1 and 7 have three each and are narrower. Beyond that, allocate by your own weakest areas rather than by a guessed weighting.',
      explanation:
        'Using an invented percentage from an unofficial source risks under-preparing a topic that turns out to matter.',
    },
  ],
  lab: {
    title: 'Self-test against the objective list',
    scenario:
      'A revision exercise rather than a build. Work through every sub-objective and produce your own gap list.',
    prerequisites: ['Terraform 1.5 or newer', 'The published objective list from this lesson'],
    tasks: [
      {
        instruction:
          'Write out the eight objectives from memory. Compare with the list in this lesson and note what you missed.',
      },
      {
        instruction:
          'For each of the thirty-seven sub-objectives, write a one-sentence answer without looking anything up.',
      },
      {
        instruction:
          'Mark each answer confident, shaky or blank. The shaky and blank ones are your revision list.',
      },
      {
        instruction:
          'For every shaky item, find the relevant lesson in this app and re-read its Summary and Exam tips.',
      },
      {
        instruction:
          'For every blank item, do the lab in that lesson. Reading alone will not close a genuine gap.',
      },
      {
        instruction:
          'Drill the numbers: variable precedence, TF_LOG levels, plan exit codes, plan symbols, `~>` semantics, default parallelism, what the lock file locks.',
      },
      {
        instruction:
          'Take a full-length mock exam in this app, then review every incorrect answer and identify which sub-objective it belonged to.',
      },
      {
        instruction:
          'Repeat the self-test after a week. Anything still shaky needs the lab, not more reading.',
      },
    ],
    solution: [
      {
        title: 'A worked gap list',
        language: 'text',
        code: `Self-test, 2026-09-04

CONFIDENT
  1a 1b 1c   IaC concepts - fine
  3a-3g      the workflow - fine, I run this daily
  4a 4b 4c   resources, data, references, variables
  6a         the local backend

SHAKY  ->  re-read Summary and Exam tips
  2a   ~> semantics with two vs three components
  4d   which types are indexable
  5d   whether the lock file covers modules
  6b   which backends support locking
  7c   the exact TF_LOG level names

BLANK  ->  do the lab
  4g   precondition vs postcondition vs check
  4h   ephemeral values
  8b   Sentinel enforcement levels
  8d   agents, and why they need no inbound rule

Plan
  Day 1  the four BLANK labs
  Day 2  the five SHAKY summaries, then drill the numbers
  Day 3  a full mock exam, then map every wrong answer to a
         sub-objective
  Day 4  re-test everything marked shaky or blank
  Day 5  a second mock exam. Book the exam if it is clean.`,
      },
      {
        title: 'Drilling the numbers',
        language: 'bash',
        code: `# Cover the answers and work down. Anything you hesitate on
# goes back on the revision list.

# 1. Variable precedence, lowest to highest?
#    default, TF_VAR_, terraform.tfvars, terraform.tfvars.json,
#    *.auto.tfvars (lexical), -var / -var-file

# 2. What does ~> 3.6.0 allow? ~> 3.6?
#    3.6.x only  /  3.7 and 3.99 but not 4.0

# 3. plan -detailed-exitcode: 0, 1, 2?
#    no changes, error, changes pending

# 4. The four plan symbols?
#    + create, - destroy, ~ update in place, -/+ replace

# 5. Default parallelism?
#    10

# 6. TF_LOG levels, least to most verbose?
#    ERROR, WARN, INFO, DEBUG, TRACE

# 7. Does .terraform.lock.hcl lock module versions?
#    No. Providers only.

# 8. Which collection type cannot be indexed?
#    set

# 9. What does for_each accept?
#    a map, or a set of strings. Never a list.

# 10. Which backends support locking?
#     local (file lock), S3 (use_lockfile or DynamoDB),
#     azurerm and gcs natively, HCP queues runs

# 11. What must a local module source begin with?
#     ./ or ../

# 12. Which block replaces backend for HCP Terraform?
#     cloud - and they are mutually exclusive`,
      },
    ],
    verification: [
      {
        command: 'echo "37 sub-objectives - how many can you answer without looking?"',
        what: 'The only verification that matters here is an honest self-assessment.',
      },
      {
        command: 'terraform console <<< \'toset(["b","a","a"])\'',
        what: 'Where you are unsure, confirm behaviour rather than trusting memory.',
      },
    ],
    cleanup: [
      {
        command: 'echo "Keep the gap list. Re-test in a week."',
        what: 'Nothing to clean up - the artefact is your revision list.',
      },
    ],
  },
  relatedTopicIds: ['tf-terraform-gotchas', 'tf-what-is-iac', 'tf-hcp-overview'],
  docs: [
    {
      title: 'Terraform Associate certification',
      url: 'https://developer.hashicorp.com/certifications/infrastructure-automation',
    },
    {
      title: 'Exam content list (004)',
      url: 'https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004',
    },
  ],
}
