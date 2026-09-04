import type { Topic } from '../../../types'

export const loggingAndDebugging: Topic = {
  id: 'tf-logging-and-debugging',
  title: 'Verbose logging and debugging',
  domainId: 'tf-maintenance',
  difficulty: 'intermediate',
  estimatedMinutes: 13,
  order: 3,
  tags: ['TF_LOG', 'TF_LOG_PATH', 'debugging', 'crash log', 'objective-7c'],
  oneLiner:
    'The TF_LOG levels, when each is worth using, and the one thing to remember before sharing a log.',
  explanation: [
    'Terraform’s verbose logging is controlled by the `TF_LOG` environment variable, not a command-line flag. Setting it turns on internal logging to stderr; `TF_LOG_PATH` sends it to a file instead.',
    'The levels, from least to most verbose, are `ERROR`, `WARN`, `INFO`, `DEBUG` and `TRACE`. `DEBUG` is what you usually want. `TRACE` includes every gRPC message between Terraform and its providers and is enormous.',
    'Logging is a **last resort**, not a first step. Almost every problem is better diagnosed by reading the error message, then `terraform validate`, then `terraform plan`, then `terraform state show`. Reach for `TF_LOG` when the error is genuinely opaque or you suspect a provider bug.',
    'The critical caution: **logs contain secrets**. Request and response bodies include credentials, tokens and resource attributes. A log file is as sensitive as a state file, and must be treated that way before it is attached to a support ticket.',
  ],
  whyItMatters: [
    'Objective 7c asks you to describe when and how to use verbose logging, which is exactly this - including the "when", which is "rarely".',
    'Knowing `TF_LOG` exists and how to scope it turns an unhelpful error into a specific one.',
    'The secrets-in-logs point is a real security consideration and one people routinely overlook when asking for help.',
  ],
  howItWorks: [
    '`TF_LOG=DEBUG terraform plan` enables logging for one command. Exporting it turns it on for the shell, which is rarely what you want.',
    '`TF_LOG_PATH=./tf.log` writes the log to a file. Combined with `TF_LOG`, this is the usual form, because DEBUG output is far too long to read in a terminal.',
    '`TF_LOG_CORE` and `TF_LOG_PROVIDER` set the level separately for Terraform core and for provider plugins. Setting `TF_LOG_PROVIDER=DEBUG` with `TF_LOG_CORE=WARN` isolates provider behaviour from the noise of the graph walk.',
    'Levels are cumulative: `DEBUG` includes `INFO`, `WARN` and `ERROR`. `TRACE` adds the full gRPC payloads.',
    'On a panic, Terraform writes `crash.log` in the working directory. That file is what a bug report needs, and it too may contain sensitive data.',
    'The log is line-oriented with timestamps and a `[LEVEL]` tag, so `grep` is the intended way to use it.',
    '`TF_INPUT=false` disables prompts, `TF_IN_AUTOMATION=1` shortens output for CI, and `TF_CLI_ARGS_plan` injects default flags - useful adjacent variables, though not logging.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Debug in this order',
      caption: 'Logging is step five, not step one. Four cheaper steps solve almost everything.',
      nodes: [
        {
          label: 'Read the whole error message',
          detail: 'Including the file, line and the two lines below where you stopped',
          tone: 'accent',
        },
        {
          label: 'terraform validate',
          detail: 'Separates a configuration error from a provider or credential one',
          arrowLabel: 'if it is about syntax or types',
        },
        {
          label: 'terraform plan',
          detail: 'Does the failure survive a plan? Is it drift?',
        },
        {
          label: 'terraform state show / console',
          detail: 'What does Terraform actually believe?',
        },
        {
          label: 'TF_LOG=DEBUG with TF_LOG_PATH',
          detail: 'Now, and only now, turn on verbose logging',
          branch: {
            label: 'Still opaque',
            detail: 'TF_LOG=TRACE, or a provider issue with crash.log attached',
          },
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which log level and scope?',
      caption:
        'Scope the level to what you suspect. TRACE on everything produces a file nobody can read.',
      question: 'What do you suspect is wrong?',
      branches: [
        {
          condition: 'you have no idea yet',
          result: 'TF_LOG=DEBUG to a file',
          detail: 'The usual starting point',
          tone: 'accent',
        },
        {
          condition: 'the provider is misbehaving',
          result: 'TF_LOG_PROVIDER=DEBUG, TF_LOG_CORE=WARN',
          detail: 'Provider detail without the graph-walk noise',
        },
        {
          condition: 'ordering or graph construction',
          result: 'TF_LOG_CORE=TRACE',
          detail: 'Plus terraform graph, which is far easier to read',
        },
        {
          condition: 'Terraform panicked',
          result: 'Attach crash.log',
          detail: 'Redact it first - it may contain secrets',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Logging environment variables',
      purpose: 'Everything that controls Terraform’s verbose logging.',
      fields: [
        {
          path: 'TF_LOG',
          meaning: 'TRACE, DEBUG, INFO, WARN or ERROR. Off when unset.',
          required: true,
        },
        {
          path: 'TF_LOG_PATH',
          meaning: 'Write the log to this file instead of stderr.',
          required: true,
        },
        { path: 'TF_LOG_CORE', meaning: 'Level for Terraform core only.' },
        { path: 'TF_LOG_PROVIDER', meaning: 'Level for provider plugins only.' },
        {
          path: 'crash.log',
          meaning: 'Written automatically on a panic. Needed for a bug report.',
        },
      ],
    },
    {
      kind: 'Adjacent CLI environment variables',
      purpose: 'Other variables worth knowing, particularly for CI.',
      fields: [
        { path: 'TF_INPUT=false', meaning: 'Never prompt. Equivalent to -input=false.' },
        { path: 'TF_IN_AUTOMATION=1', meaning: 'Shortens output aimed at interactive users.' },
        { path: 'TF_CLI_ARGS_plan', meaning: 'Default flags for terraform plan.' },
        { path: 'TF_VAR_<name>', meaning: 'Supplies an input variable value.' },
        { path: 'TF_WORKSPACE', meaning: 'Selects a workspace without a select command.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The support ticket with the credentials in it',
    story: [
      'A team hit an obscure provider error and did the right thing: they enabled `TF_LOG=TRACE`, captured the log, and opened a support ticket with the file attached.',
      'The TRACE log contained the full HTTP request bodies, including the `Authorization` header on every API call. They had just posted long-lived cloud credentials into a ticketing system.',
      'They noticed within an hour and rotated the credentials, so the outcome was a wasted afternoon rather than an incident. The ticket still had to be deleted and reopened.',
      'The habit worth building: before sharing any Terraform log, grep it for anything that looks like a credential, and prefer `DEBUG` over `TRACE` unless the request bodies are genuinely what you need.',
    ],
    code: [
      {
        title: 'Sanitise before sharing',
        language: 'bash',
        code: `# Look for the obvious offenders first.
grep -inE 'authorization|x-amz-security-token|password|secret|token|bearer|private_key' tf.log | head -40

# A blunt but effective redaction pass.
sed -E \\
  -e 's/(Authorization: )[^ ]+/\\1REDACTED/gI' \\
  -e 's/("(password|secret|token|private_key)" *: *")[^"]*/\\1REDACTED/gI' \\
  -e 's/(AKIA[0-9A-Z]{16})/REDACTED_ACCESS_KEY/g' \\
  tf.log > tf-redacted.log

# Then check again before attaching anything.
grep -icE 'authorization|password|secret' tf-redacted.log`,
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Enabling logging, scoped properly',
      language: 'bash',
      explanation:
        'Prefix the variable rather than exporting it, so logging applies to one command and not your whole session.',
      code: `# One command, to a file. The usual form.
TF_LOG=DEBUG TF_LOG_PATH=./tf.log terraform plan

# Provider detail only - much less noise than full DEBUG.
TF_LOG_CORE=WARN TF_LOG_PROVIDER=DEBUG TF_LOG_PATH=./provider.log \\
  terraform apply

# Core only, for graph and ordering questions.
TF_LOG_CORE=TRACE TF_LOG_PROVIDER=WARN TF_LOG_PATH=./core.log \\
  terraform plan

# Everything. Enormous - hundreds of megabytes is normal.
TF_LOG=TRACE TF_LOG_PATH=./trace.log terraform apply

# Exporting affects every subsequent command. Rarely wanted.
export TF_LOG=DEBUG
unset TF_LOG`,
    },
    {
      title: 'Reading a log',
      language: 'bash',
      explanation:
        'The log is line-oriented with a level tag, so grep is the intended interface. These four patterns cover most investigations.',
      code: `# Errors and warnings first.
grep -E '\\[(ERROR|WARN)\\]' tf.log

# What did the provider actually send and receive?
grep -iE 'aws_instance|http request|http response' tf.log | head -50

# Provider startup and version - useful for "is it even the
# provider I think it is?"
grep -iE 'plugin process|provider.*started|starting plugin' tf.log

# The graph walk, for ordering questions.
grep -iE 'walking|visiting|dependenc' tf.log | head -50

# How big is it?
wc -l tf.log && du -h tf.log`,
    },
    {
      title: 'Filing a useful bug report',
      language: 'bash',
      explanation:
        'A maintainer needs versions, a minimal reproduction and a sanitised log. Without all three the report usually stalls.',
      code: `# 1. Versions.
terraform version
terraform providers

# 2. A minimal reproduction - the smallest configuration that
#    still fails. This is the part that gets a bug fixed.

# 3. The log, sanitised.
TF_LOG=DEBUG TF_LOG_PATH=./bug.log terraform apply
grep -icE 'authorization|password|secret|token' bug.log

# 4. crash.log, if Terraform panicked. Also sanitise it.
ls -la crash.log 2>/dev/null

# 5. File against the right repository: the PROVIDER, not
#    Terraform, if the error mentions a resource type.
#    e.g. github.com/hashicorp/terraform-provider-aws`,
    },
  ],
  imperative: [
    {
      command: 'TF_LOG=DEBUG TF_LOG_PATH=./tf.log terraform plan',
      what: 'The standard debugging invocation: verbose, to a file, for one command.',
    },
    {
      command: 'TF_LOG_PROVIDER=DEBUG TF_LOG_CORE=WARN terraform apply',
      what: 'Provider detail without core noise.',
    },
    {
      command: "grep -E '\\[(ERROR|WARN)\\]' tf.log",
      what: 'The first thing to read in any captured log.',
    },
    {
      command: 'TF_LOG=TRACE TF_LOG_PATH=./trace.log terraform apply',
      what: 'Everything, including gRPC payloads. Very large, and full of secrets.',
      namespaceNote: 'Only when DEBUG has not answered the question.',
    },
    {
      command: 'terraform version && terraform providers',
      what: 'The two commands every bug report needs.',
    },
  ],
  declarative: {
    steps: [
      'Read the whole error before anything else. Terraform’s messages usually name the file, line and fix.',
      'Try `validate`, `plan`, `state show` and `console` before enabling logging.',
      'Prefix `TF_LOG` on one command rather than exporting it.',
      'Always pair `TF_LOG` with `TF_LOG_PATH` - DEBUG is unreadable in a terminal.',
      'Scope with `TF_LOG_PROVIDER` and `TF_LOG_CORE` once you have a suspicion.',
      'Treat every log file as a secret, and sanitise before sharing.',
    ],
    code: [
      {
        title: 'Capturing a log in CI without leaking it',
        language: 'yaml',
        explanation:
          'The log is captured only on failure, redacted before upload, and given a short retention. Never print it to the job output, which is often world-readable.',
        code: `# .github/workflows/apply.yml
- name: Apply
  id: apply
  env:
    # Captured to a FILE, never to the job log.
    TF_LOG: DEBUG
    TF_LOG_PATH: \${{ runner.temp }}/terraform.log
    TF_IN_AUTOMATION: '1'
    TF_INPUT: 'false'
  run: terraform apply -auto-approve -lock-timeout=15m

- name: Redact the log
  if: failure()
  run: |
    sed -E \\
      -e 's/(Authorization: )[^ ]+/\\1REDACTED/gI' \\
      -e 's/("(password|secret|token)" *: *")[^"]*/\\1REDACTED/gI' \\
      "\${{ runner.temp }}/terraform.log" > "\${{ runner.temp }}/redacted.log"

- name: Upload for investigation
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: terraform-debug-log
    path: \${{ runner.temp }}/redacted.log
    retention-days: 3      # short-lived, even redacted`,
      },
    ],
  },
  verification: [
    {
      command: 'TF_LOG=DEBUG TF_LOG_PATH=./tf.log terraform plan && wc -l tf.log',
      what: 'Confirms logging is actually being captured.',
    },
    {
      command: "grep -c '\\[DEBUG\\]' tf.log",
      what: 'A non-zero count confirms the level took effect.',
    },
    {
      command: "grep -icE 'authorization|password|secret|token' tf.log",
      what: 'Run this before sharing any log. Zero is the only acceptable answer.',
      expected: '0 after redaction',
    },
  ],
  troubleshooting: [
    {
      command: "grep -E '\\[(ERROR|WARN)\\]' tf.log",
      what: 'Finds the real failure inside a large log.',
    },
    {
      command: 'TF_LOG_PROVIDER=TRACE TF_LOG_CORE=WARN terraform apply',
      what: 'Isolates a suspected provider bug from core noise.',
    },
    {
      command: 'terraform validate',
      what: 'Confirms whether the problem is the configuration at all, before any logging.',
    },
    {
      command: 'ls crash.log',
      what: 'After a panic - this file is what a bug report needs.',
    },
    {
      command: 'terraform version && terraform providers',
      what: 'Confirms which versions are involved, which is frequently the answer.',
    },
  ],
  commonMistakes: [
    'Reaching for `TF_LOG=TRACE` first. Read the error message and try `validate` and `plan` before generating gigabytes of output.',
    'Sharing a log without sanitising it. TRACE logs contain credentials and every resource attribute.',
    'Setting `TF_LOG` without `TF_LOG_PATH` and losing the output in terminal scrollback.',
    'Exporting `TF_LOG` and forgetting, so every later command is slow and noisy.',
    'Filing a provider bug against the Terraform repository. If the error names a resource type, it belongs to the provider.',
    'Printing a debug log to CI job output, which is often visible to more people than the artefact store.',
    'Reporting a bug without a minimal reproduction, which is the part that actually gets it fixed.',
  ],
  examTips: [
    '`TF_LOG` is an environment variable, not a CLI flag.',
    'Levels, least to most verbose: ERROR, WARN, INFO, DEBUG, TRACE. Logging is off when unset.',
    '`TF_LOG_PATH` writes the log to a file.',
    '`TF_LOG_CORE` and `TF_LOG_PROVIDER` scope the level independently.',
    '`crash.log` is written automatically on a panic.',
    'Logs may contain sensitive data and must be sanitised before sharing.',
    'Verbose logging is a last resort, after the error message, validate, plan and state inspection.',
  ],
  summary: [
    '`TF_LOG` plus `TF_LOG_PATH` is the debugging invocation; DEBUG is usually enough.',
    'Scope with `TF_LOG_CORE` and `TF_LOG_PROVIDER` once you have a suspicion.',
    'Try the error message, validate, plan and state inspection first.',
    'Logs contain secrets - sanitise before sharing, and prefer DEBUG to TRACE.',
    '`crash.log` is what a panic bug report needs.',
  ],
  practice: [
    {
      id: 'tf-logging-p1',
      level: 'beginner',
      prompt: 'List the TF_LOG levels from least to most verbose.',
      answer: 'ERROR, WARN, INFO, DEBUG, TRACE.',
      explanation: 'Logging is off when `TF_LOG` is unset. Levels are cumulative.',
    },
    {
      id: 'tf-logging-p2',
      level: 'beginner',
      prompt: 'Which variable sends the log to a file, and why does it matter?',
      answer:
        '`TF_LOG_PATH`. It matters because DEBUG and TRACE output is far too long to read in a terminal and will overflow scrollback.',
      explanation:
        'It also keeps the log out of CI job output, which is usually visible to more people than an access-controlled artefact.',
    },
    {
      id: 'tf-logging-p3',
      level: 'intermediate',
      prompt: 'You suspect a provider bug. Which log settings isolate it?',
      answer: '`TF_LOG_PROVIDER=DEBUG` with `TF_LOG_CORE=WARN`, plus `TF_LOG_PATH` to a file.',
      explanation:
        'This gives provider request and response detail without the very large volume of core graph-walk logging.',
    },
    {
      id: 'tf-logging-p4',
      level: 'advanced',
      prompt:
        'Why must a TRACE log be treated as a secret, and what should you do before attaching one to a ticket?',
      answer:
        'Because TRACE includes the full gRPC and HTTP payloads between Terraform and its providers - authorization headers, tokens and every resource attribute, including passwords. Before sharing, grep for credential patterns, redact them, and re-check; and prefer DEBUG unless the request bodies are genuinely needed.',
      explanation:
        'The same applies to `crash.log`. A short artefact retention period is a sensible additional control in CI.',
    },
  ],
  lab: {
    title: 'Capture, scope and sanitise a log',
    scenario:
      'Generate logs at several levels, compare their size and content, then practise redaction on a log containing a real generated secret.',
    prerequisites: ['Terraform 1.5 or newer'],
    tasks: [
      {
        instruction:
          'Create a configuration with a `random_password` and a `local_sensitive_file`, and apply it normally first.',
      },
      {
        instruction:
          'Re-run a plan with `TF_LOG=INFO TF_LOG_PATH=./info.log` and note the line count.',
      },
      { instruction: 'Repeat with DEBUG and then TRACE, comparing line counts and file sizes.' },
      {
        instruction:
          'Search the TRACE log for the generated password value. Confirm it is present in plaintext.',
        hint: 'Get the value with terraform output -raw, then grep for it.',
      },
      {
        instruction:
          'Use `TF_LOG_CORE=WARN TF_LOG_PROVIDER=DEBUG` and compare the size with full DEBUG.',
      },
      {
        instruction:
          'In each log, find the lines showing provider startup and the provider version.',
      },
      {
        instruction:
          'Write a sed pipeline that redacts the password from the TRACE log, and verify with grep that it is gone.',
      },
      {
        instruction:
          'Delete every log file, and note that they were as sensitive as the state file all along.',
      },
      { instruction: 'Destroy and clean up.' },
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

resource "random_password" "secret" {
  length  = 24
  special = false
}

resource "local_sensitive_file" "secret" {
  filename = "\${path.module}/secret.txt"
  content  = random_password.secret.result
}

output "secret" {
  value     = random_password.secret.result
  sensitive = true
}`,
      },
      {
        title: 'The comparison',
        language: 'bash',
        code: `terraform init && terraform apply -auto-approve

TF_LOG=INFO  TF_LOG_PATH=./info.log  terraform plan >/dev/null
TF_LOG=DEBUG TF_LOG_PATH=./debug.log terraform plan >/dev/null
TF_LOG=TRACE TF_LOG_PATH=./trace.log terraform plan >/dev/null

wc -l info.log debug.log trace.log
du -h  info.log debug.log trace.log
# Each level is roughly an order of magnitude larger.

# The secret is in the logs, in plaintext:
SECRET="$(terraform output -raw secret)"
for f in info.log debug.log trace.log; do
  printf '%s: %s occurrences\\n' "$f" "$(grep -c "$SECRET" "$f" || true)"
done

# Scoped logging is much smaller than full DEBUG:
TF_LOG_CORE=WARN TF_LOG_PROVIDER=DEBUG TF_LOG_PATH=./provider.log \\
  terraform plan >/dev/null
wc -l provider.log debug.log

# Provider startup lines:
grep -iE 'starting plugin|plugin process|provider.*version' debug.log | head

# Redact:
sed -E "s/$SECRET/REDACTED/g" trace.log > trace-redacted.log
grep -c "$SECRET" trace-redacted.log || echo "0 - clean"

# And remove everything. These files were as sensitive as state.
rm -f info.log debug.log trace.log provider.log trace-redacted.log

terraform destroy -auto-approve`,
      },
    ],
    verification: [
      {
        command: "grep -c '\\[DEBUG\\]' debug.log",
        what: 'Confirms the DEBUG level took effect.',
      },
      {
        command: 'ls *.log 2>/dev/null || echo "no logs remaining"',
        what: 'Confirms every log file has been removed.',
        expected: 'no logs remaining',
      },
    ],
    cleanup: [
      {
        command:
          'terraform destroy -auto-approve && rm -f *.log secret.txt && rm -rf .terraform .terraform.lock.hcl terraform.tfstate*',
        what: 'Removes logs, the secret file, state and cache.',
      },
    ],
  },
  relatedTopicIds: ['tf-inspecting-state', 'tf-sensitive-data-and-vault', 'tf-plan'],
  docs: [
    {
      title: 'Debugging Terraform',
      url: 'https://developer.hashicorp.com/terraform/internals/debugging',
    },
    {
      title: 'Environment variables',
      url: 'https://developer.hashicorp.com/terraform/cli/config/environment-variables',
    },
  ],
}
