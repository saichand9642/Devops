import type { CommandGroup } from '../types'

/**
 * Searchable Terraform command and HCL reference.
 *
 * Grouped by what you are trying to do, not alphabetically, because that is
 * how you look things up under time pressure.
 */
export const terraformCommandGroups: CommandGroup[] = [
  {
    id: 'tf-setup',
    title: 'Setup and version',
    description: 'Getting the CLI ready, checking versions, and shell quality-of-life.',
    entries: [
      {
        id: 'tfc-version',
        command: 'terraform version',
        description: 'CLI version, platform, and every installed provider version.',
        tags: ['version', 'providers'],
      },
      {
        id: 'tfc-version-json',
        command: 'terraform version -json',
        description: 'The same, machine-readable, including whether a newer release exists.',
        example: 'terraform version -json | jq -r .terraform_outdated',
        tags: ['version', 'json', 'ci'],
      },
      {
        id: 'tfc-help',
        command: 'terraform -help',
        description: 'Every subcommand. Worth skimming once - there are more than you think.',
        tags: ['help'],
      },
      {
        id: 'tfc-autocomplete',
        command: 'terraform -install-autocomplete',
        description: 'Adds shell completion for subcommands and flags.',
        notes: 'Writes to your shell profile; restart the shell afterwards.',
        tags: ['shell', 'completion'],
      },
      {
        id: 'tfc-chdir',
        command: 'terraform -chdir=<DIR> <command>',
        description: 'Run any command as though from another directory.',
        example: 'terraform -chdir=environments/staging plan',
        notes: 'A global option, so it comes BEFORE the subcommand.',
        placeholders: ['<DIR>'],
        tags: ['directory', 'monorepo'],
      },
      {
        id: 'tfc-tfenv',
        command: 'tfenv install <VERSION> && tfenv use <VERSION>',
        description: 'Install and select a CLI version with the tfenv version manager.',
        notes: 'A .terraform-version file makes the switch automatic per directory.',
        placeholders: ['<VERSION>'],
        tags: ['version', 'tfenv'],
      },
    ],
  },
  {
    id: 'tf-init',
    title: 'init and providers',
    description: 'Preparing a directory, and everything to do with provider installation.',
    entries: [
      {
        id: 'tfc-init',
        command: 'terraform init',
        description: 'Initialise the backend, install modules, download providers. Idempotent.',
        notes: 'Re-run after any provider, module or backend change.',
        tags: ['init', 'backend', 'modules', 'providers'],
      },
      {
        id: 'tfc-init-upgrade',
        command: 'terraform init -upgrade',
        description:
          'Re-resolve provider and module versions to the newest allowed; rewrite the lock file.',
        notes: 'The ONLY command that moves an already-satisfied version.',
        tags: ['init', 'upgrade', 'versions'],
      },
      {
        id: 'tfc-init-migrate',
        command: 'terraform init -migrate-state',
        description: 'Accept a backend change and copy existing state into the new backend.',
        notes:
          'The only init flag that moves your data. Back up with `terraform state pull` first.',
        tags: ['init', 'backend', 'migration'],
      },
      {
        id: 'tfc-init-reconfigure',
        command: 'terraform init -reconfigure',
        description: 'Discard the recorded backend configuration; do NOT copy state.',
        notes: 'The safe form when switching between environments.',
        tags: ['init', 'backend'],
      },
      {
        id: 'tfc-init-backend-config',
        command: 'terraform init -backend-config=<FILE>',
        description: 'Complete a partial backend configuration at init time.',
        example: 'terraform init -backend-config=production.s3.tfbackend',
        notes: 'The backend block accepts literals only, which is why this exists.',
        placeholders: ['<FILE>'],
        tags: ['init', 'backend', 'environments'],
      },
      {
        id: 'tfc-init-backend-false',
        command: 'terraform init -backend=false',
        description: 'Install providers and modules without touching the backend.',
        notes: 'Enough for `terraform validate`, and needs no state credentials.',
        tags: ['init', 'ci', 'validate'],
      },
      {
        id: 'tfc-init-input-false',
        command: 'terraform init -input=false',
        description: 'Never prompt; fail instead. The correct form in any pipeline.',
        tags: ['init', 'ci'],
      },
      {
        id: 'tfc-providers',
        command: 'terraform providers',
        description: 'Every provider the configuration and its modules require, with constraints.',
        notes: 'Shows the namespace, so you know whose provider you are running.',
        tags: ['providers', 'modules'],
      },
      {
        id: 'tfc-providers-schema',
        command: 'terraform providers schema -json',
        description: 'The full provider schema. Discover arguments without leaving the terminal.',
        example:
          'terraform providers schema -json | jq \'.provider_schemas["registry.terraform.io/hashicorp/aws"].resource_schemas | keys\'',
        tags: ['providers', 'schema', 'discovery'],
      },
      {
        id: 'tfc-providers-lock',
        command: 'terraform providers lock -platform=<PLATFORM>',
        description:
          'Record checksums for other platforms, so a mixed-OS team shares one lock file.',
        example: 'terraform providers lock -platform=linux_amd64 -platform=darwin_arm64',
        placeholders: ['<PLATFORM>'],
        tags: ['providers', 'lock', 'team'],
      },
      {
        id: 'tfc-providers-mirror',
        command: 'terraform providers mirror <DIR>',
        description:
          'Download every required provider into a local mirror for an airgapped network.',
        placeholders: ['<DIR>'],
        tags: ['providers', 'airgap'],
      },
    ],
  },
  {
    id: 'tf-workflow',
    title: 'The core workflow',
    description: 'fmt, validate, plan, apply, destroy - and the flags that matter.',
    entries: [
      {
        id: 'tfc-fmt',
        command: 'terraform fmt -recursive',
        description: 'Rewrite every file below the current directory to canonical style.',
        tags: ['fmt', 'style'],
      },
      {
        id: 'tfc-fmt-check',
        command: 'terraform fmt -check -recursive',
        description: 'Report non-canonical files and exit non-zero. Changes nothing.',
        notes: 'The CI form. Plain `fmt` in CI rewrites an ephemeral checkout and passes anyway.',
        tags: ['fmt', 'ci'],
      },
      {
        id: 'tfc-fmt-diff',
        command: 'terraform fmt -diff',
        description: 'Show exactly what formatting would change.',
        tags: ['fmt'],
      },
      {
        id: 'tfc-validate',
        command: 'terraform validate',
        description: 'Check syntax, argument names, types and references. No API calls.',
        notes: 'Needs init (for provider schemas) but no credentials.',
        tags: ['validate', 'ci'],
      },
      {
        id: 'tfc-validate-json',
        command: 'terraform validate -json',
        description: 'Machine-readable diagnostics with file, line and severity.',
        example: 'terraform validate -json | jq -r .valid',
        tags: ['validate', 'json', 'ci'],
      },
      {
        id: 'tfc-plan',
        command: 'terraform plan',
        description: 'Refresh, diff, and print proposed actions. Changes no infrastructure.',
        notes: 'Ends with a summary line: "Plan: 1 to add, 0 to change, 0 to destroy."',
        tags: ['plan'],
      },
      {
        id: 'tfc-plan-out',
        command: 'terraform plan -out=<FILE>',
        description: 'Save the plan so a later apply performs exactly the reviewed actions.',
        notes: 'Contains resolved sensitive values. Treat as a secret; never commit it.',
        placeholders: ['<FILE>'],
        tags: ['plan', 'ci', 'review'],
      },
      {
        id: 'tfc-plan-exitcode',
        command: 'terraform plan -detailed-exitcode',
        description: 'Exit 0 for no changes, 1 for error, 2 for changes pending.',
        notes: 'Without this flag, plan exits 0 either way.',
        tags: ['plan', 'ci', 'exit codes'],
      },
      {
        id: 'tfc-plan-refresh-only',
        command: 'terraform plan -refresh-only',
        description: 'Show drift alone, with no configuration changes mixed in.',
        tags: ['plan', 'drift'],
      },
      {
        id: 'tfc-plan-replace',
        command: 'terraform plan -replace=<ADDRESS>',
        description: 'Plan a forced recreation of one resource without editing the configuration.',
        notes: 'The modern replacement for `terraform taint`.',
        placeholders: ['<ADDRESS>'],
        tags: ['plan', 'replace'],
      },
      {
        id: 'tfc-apply',
        command: 'terraform apply',
        description: 'Plan, show, prompt for `yes`, then apply.',
        notes: 'Ends with "Apply complete! Resources: 1 added, 0 changed, 0 destroyed."',
        tags: ['apply'],
      },
      {
        id: 'tfc-apply-plan',
        command: 'terraform apply <PLANFILE>',
        description: 'Apply a saved plan exactly, with no re-plan and no prompt.',
        notes: 'The safe pipeline form: what was reviewed is what runs.',
        placeholders: ['<PLANFILE>'],
        tags: ['apply', 'ci'],
      },
      {
        id: 'tfc-apply-auto',
        command: 'terraform apply -auto-approve',
        description: 'Apply without confirmation.',
        notes: 'Fine in a sandbox or behind an automated gate. Not as a terminal habit.',
        tags: ['apply', 'ci'],
      },
      {
        id: 'tfc-apply-refresh-only',
        command: 'terraform apply -refresh-only',
        description: 'Update state to match reality. Changes no infrastructure.',
        notes: 'Replaced the deprecated `terraform refresh`.',
        tags: ['apply', 'drift', 'refresh'],
      },
      {
        id: 'tfc-apply-parallelism',
        command: 'terraform apply -parallelism=<N>',
        description: 'Concurrent operations. Default 10.',
        notes: 'Setting 1 serialises execution, which exposes hidden ordering assumptions.',
        placeholders: ['<N>'],
        tags: ['apply', 'parallelism', 'debug'],
      },
      {
        id: 'tfc-destroy',
        command: 'terraform destroy',
        description: 'Plan and execute removal of everything in state.',
        notes: 'Only touches what is in state. Check `terraform workspace show` first.',
        tags: ['destroy'],
      },
      {
        id: 'tfc-destroy-target',
        command: 'terraform destroy -target=<ADDRESS>',
        description: 'Destroy one resource and its dependents.',
        notes: 'One of the few genuinely good uses of -target.',
        placeholders: ['<ADDRESS>'],
        tags: ['destroy', 'target'],
      },
    ],
  },
  {
    id: 'tf-variables',
    title: 'Variables and outputs',
    description: 'Supplying values, and reading what a configuration published.',
    entries: [
      {
        id: 'tfc-var',
        command: 'terraform plan -var="<NAME>=<VALUE>"',
        description: 'Supply one variable at the highest precedence.',
        placeholders: ['<NAME>', '<VALUE>'],
        tags: ['variables'],
      },
      {
        id: 'tfc-var-file',
        command: 'terraform plan -var-file=<FILE>',
        description: 'Load a tfvars file that is not picked up automatically.',
        notes: 'terraform.tfvars and *.auto.tfvars load without this flag.',
        placeholders: ['<FILE>'],
        tags: ['variables', 'environments'],
      },
      {
        id: 'tfc-tf-var',
        command: 'export TF_VAR_<NAME>=<VALUE>',
        description: 'Supply a variable from the environment - the right home for secrets.',
        placeholders: ['<NAME>', '<VALUE>'],
        tags: ['variables', 'secrets', 'ci'],
      },
      {
        id: 'tfc-var-precedence',
        command:
          '# precedence: default < TF_VAR_ < terraform.tfvars < *.json < *.auto.tfvars < -var',
        description: 'Variable value precedence, lowest to highest. The command line always wins.',
        notes: 'Memorise this order - it is one of the most reliably examined facts.',
        tags: ['variables', 'precedence', 'exam'],
      },
      {
        id: 'tfc-show-vars',
        command: 'terraform show -json <PLANFILE> | jq .variables',
        description: 'The value every variable actually resolved to. The definitive answer.',
        placeholders: ['<PLANFILE>'],
        tags: ['variables', 'debug', 'json'],
      },
      {
        id: 'tfc-output',
        command: 'terraform output',
        description: 'Every output. Sensitive ones show as (sensitive value).',
        tags: ['output'],
      },
      {
        id: 'tfc-output-raw',
        command: 'terraform output -raw <NAME>',
        description: 'One value, unquoted - the form to use in scripts.',
        placeholders: ['<NAME>'],
        tags: ['output', 'scripting'],
      },
      {
        id: 'tfc-output-json',
        command: 'terraform output -json',
        description: 'Every output as JSON, with types and sensitivity flags.',
        example: "terraform output -json | jq 'map_values(.sensitive)'",
        tags: ['output', 'json'],
      },
    ],
  },
  {
    id: 'tf-state',
    title: 'State inspection and surgery',
    description:
      'Reading state, and the commands that change addresses. None touch infrastructure.',
    entries: [
      {
        id: 'tfc-state-list',
        command: 'terraform state list',
        description: 'Every managed address, including data sources and module resources.',
        example: 'terraform state list aws_instance',
        tags: ['state', 'inspect'],
      },
      {
        id: 'tfc-state-show',
        command: 'terraform state show <ADDRESS>',
        description: 'All recorded attributes for one resource.',
        notes: 'The answer to most "Unsupported attribute" errors.',
        placeholders: ['<ADDRESS>'],
        tags: ['state', 'inspect', 'debug'],
      },
      {
        id: 'tfc-show',
        command: 'terraform show',
        description:
          'The whole state, human-readable. `terraform show <planfile>` shows a saved plan.',
        tags: ['state', 'inspect'],
      },
      {
        id: 'tfc-show-json',
        command: 'terraform show -json',
        description: 'State or a saved plan as documented, versioned JSON.',
        example:
          'terraform show -json tfplan | jq -r \'.resource_changes[] | "\\(.address) \\(.change.actions|join(","))"\'',
        notes: 'What policy tools and pipeline gates read. Never parse the state file directly.',
        tags: ['state', 'json', 'ci', 'policy'],
      },
      {
        id: 'tfc-console',
        command: 'terraform console',
        description: 'Evaluate expressions against real state, variables and data sources.',
        example: "echo 'aws_instance.web[*].private_ip' | terraform console",
        notes: 'The fastest way to learn the language. Accepts piped input.',
        tags: ['console', 'expressions', 'debug'],
      },
      {
        id: 'tfc-graph',
        command: 'terraform graph | dot -Tsvg > graph.svg',
        description: 'The dependency graph Terraform derived from your references.',
        tags: ['graph', 'dependencies'],
      },
      {
        id: 'tfc-state-pull',
        command: 'terraform state pull > backup.json',
        description: 'Download current state from any backend. Your backup before surgery.',
        notes: 'Do this before every state operation. Always.',
        tags: ['state', 'backup'],
      },
      {
        id: 'tfc-state-push',
        command: 'terraform state push <FILE>',
        description: 'Upload a state file. Refuses on lineage mismatch or a lower serial.',
        notes: 'A recovery tool, never a workflow. Verify with a plan immediately after.',
        placeholders: ['<FILE>'],
        tags: ['state', 'recovery'],
      },
      {
        id: 'tfc-state-mv',
        command: 'terraform state mv <FROM> <TO>',
        description: 'Change a resource address without touching infrastructure.',
        example: "terraform state mv 'aws_iam_user.team[0]' 'aws_iam_user.team[\"alice\"]'",
        notes: 'Prefer a `moved` block - reviewable, and everyone gets the same result.',
        placeholders: ['<FROM>', '<TO>'],
        tags: ['state', 'refactor'],
      },
      {
        id: 'tfc-state-rm',
        command: 'terraform state rm <ADDRESS>',
        description: 'Forget a resource. It keeps running, unmanaged. Does NOT destroy it.',
        notes: 'Prefer a `removed` block with `destroy = false`.',
        placeholders: ['<ADDRESS>'],
        tags: ['state', 'remove'],
      },
      {
        id: 'tfc-state-replace-provider',
        command: 'terraform state replace-provider <FROM> <TO>',
        description: 'Rewrite provider addresses in state after a provider rename.',
        placeholders: ['<FROM>', '<TO>'],
        tags: ['state', 'providers'],
      },
      {
        id: 'tfc-force-unlock',
        command: 'terraform force-unlock <LOCK_ID>',
        description: 'Remove a state lock.',
        notes: 'Only for a confirmed stale lock. On a live lock this can corrupt state.',
        placeholders: ['<LOCK_ID>'],
        tags: ['state', 'locking', 'recovery'],
      },
      {
        id: 'tfc-lock-timeout',
        command: 'terraform apply -lock-timeout=<DURATION>',
        description: 'Wait for a lock rather than failing immediately.',
        example: 'terraform apply -lock-timeout=10m',
        notes: 'The right default for CI pipelines that can overlap.',
        placeholders: ['<DURATION>'],
        tags: ['locking', 'ci'],
      },
    ],
  },
  {
    id: 'tf-workspaces',
    title: 'Workspaces and import',
    description:
      'Several states under one backend, and bringing existing resources under management.',
    entries: [
      {
        id: 'tfc-ws-show',
        command: 'terraform workspace show',
        description: 'The current workspace. Run this before anything destructive.',
        tags: ['workspace'],
      },
      {
        id: 'tfc-ws-list',
        command: 'terraform workspace list',
        description: 'All workspaces; * marks the current one.',
        tags: ['workspace'],
      },
      {
        id: 'tfc-ws-new',
        command: 'terraform workspace new <NAME>',
        description: 'Create and select a new workspace with empty state.',
        placeholders: ['<NAME>'],
        tags: ['workspace'],
      },
      {
        id: 'tfc-ws-select',
        command: 'terraform workspace select <NAME>',
        description: 'Switch which state subsequent commands operate on.',
        notes: 'The state equivalent of switching kubectl contexts. Check before you act.',
        placeholders: ['<NAME>'],
        tags: ['workspace'],
      },
      {
        id: 'tfc-ws-delete',
        command: 'terraform workspace delete <NAME>',
        description: 'Remove an EMPTY workspace. Refuses if it still has resources.',
        placeholders: ['<NAME>'],
        tags: ['workspace'],
      },
      {
        id: 'tfc-import',
        command: 'terraform import <ADDRESS> <ID>',
        description: 'Record an existing resource in state. Creates nothing.',
        example: 'terraform import aws_s3_bucket.legacy acme-legacy-data',
        notes: 'The id format is provider- and resource-specific. Prefer an `import` block.',
        placeholders: ['<ADDRESS>', '<ID>'],
        tags: ['import'],
      },
      {
        id: 'tfc-import-generate',
        command: 'terraform plan -generate-config-out=<FILE>',
        description: 'Write draft configuration for every `import` block lacking one.',
        notes: 'A draft: remove computed attributes such as id and arn before using it.',
        placeholders: ['<FILE>'],
        tags: ['import', 'generate'],
      },
      {
        id: 'tfc-login',
        command: 'terraform login',
        description: 'Authenticate to HCP Terraform; stores a token locally.',
        notes: 'Written to ~/.terraform.d/credentials.tfrc.json',
        tags: ['hcp', 'auth'],
      },
      {
        id: 'tfc-logout',
        command: 'terraform logout',
        description: 'Remove the stored HCP Terraform token.',
        tags: ['hcp', 'auth'],
      },
    ],
  },
  {
    id: 'tf-debug',
    title: 'Debugging and environment variables',
    description: 'Verbose logging, and the environment variables worth knowing.',
    entries: [
      {
        id: 'tfc-tflog',
        command: 'TF_LOG=DEBUG TF_LOG_PATH=./tf.log terraform plan',
        description: 'The standard debugging invocation: verbose, to a file, for one command.',
        notes: 'Levels: ERROR, WARN, INFO, DEBUG, TRACE. Off when unset.',
        tags: ['debug', 'logging'],
      },
      {
        id: 'tfc-tflog-scoped',
        command: 'TF_LOG_CORE=WARN TF_LOG_PROVIDER=DEBUG terraform apply',
        description: 'Provider detail without the volume of core graph-walk logging.',
        tags: ['debug', 'logging', 'providers'],
      },
      {
        id: 'tfc-log-grep',
        command: "grep -E '\\[(ERROR|WARN)\\]' tf.log",
        description: 'The first thing to read in any captured log.',
        tags: ['debug', 'logging'],
      },
      {
        id: 'tfc-log-sanitise',
        command: "grep -icE 'authorization|password|secret|token' tf.log",
        description: 'Run before sharing any log. Logs contain credentials in plaintext.',
        notes: 'Zero is the only acceptable answer. Prefer DEBUG over TRACE.',
        tags: ['debug', 'logging', 'security'],
      },
      {
        id: 'tfc-env-input',
        command: 'export TF_INPUT=false',
        description: 'Never prompt for anything. Equivalent to -input=false everywhere.',
        tags: ['ci', 'environment'],
      },
      {
        id: 'tfc-env-automation',
        command: 'export TF_IN_AUTOMATION=1',
        description: 'Shortens output aimed at interactive users.',
        tags: ['ci', 'environment'],
      },
      {
        id: 'tfc-env-cli-args',
        command: 'export TF_CLI_ARGS_plan="-lock-timeout=10m"',
        description: 'Inject default flags into a specific subcommand.',
        tags: ['ci', 'environment'],
      },
      {
        id: 'tfc-env-workspace',
        command: 'export TF_WORKSPACE=<NAME>',
        description: 'Select a workspace without running `workspace select`.',
        placeholders: ['<NAME>'],
        tags: ['workspace', 'ci', 'environment'],
      },
      {
        id: 'tfc-gitignore',
        command: '# .gitignore: .terraform/  *.tfstate  *.tfstate.*  *.tfvars  tfplan  crash.log',
        description: 'What never to commit. State and plans hold plaintext secrets.',
        notes: 'DO commit: *.tf, .terraform.lock.hcl, .terraform-version',
        tags: ['git', 'security'],
      },
    ],
  },
  {
    id: 'tf-hcl',
    title: 'HCL templates',
    description: 'Block skeletons to copy. The shapes you write most often.',
    entries: [
      {
        id: 'tfh-terraform-block',
        command: `terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  backend "s3" {
    bucket       = "acme-tfstate"
    key          = "production/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}`,
        description: 'The settings block: CLI version, providers, and where state lives.',
        notes: 'Literals only - no variables, locals or expressions anywhere in here.',
        tags: ['template', 'terraform block', 'backend'],
      },
      {
        id: 'tfh-variable',
        command: `variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging or production."
  }
}

variable "subnets" {
  description = "Subnet definitions, keyed by name."
  type = map(object({
    cidr   = string
    az     = string
    public = optional(bool, false)
  }))
  default = {}
}`,
        description:
          'A validated string variable, and the map-of-objects shape that makes for_each clean.',
        tags: ['template', 'variables', 'validation'],
      },
      {
        id: 'tfh-locals-output',
        command: `locals {
  name_prefix = "\${var.project}-\${var.environment}"

  common_tags = merge(var.extra_tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

output "endpoint" {
  description = "Public endpoint of the service."
  value       = aws_lb.web.dns_name

  precondition {
    condition     = length(aws_lb.web.subnets) >= 2
    error_message = "A load balancer needs at least two subnets."
  }
}`,
        description: 'Derived values, and an output with an assertion before it is published.',
        tags: ['template', 'locals', 'outputs'],
      },
      {
        id: 'tfh-foreach',
        command: `resource "aws_subnet" "this" {
  for_each = var.subnets

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(local.common_tags, {
    Name = "subnet-\${each.key}"
  })
}

# Conditional creation, and how to reference it safely.
resource "aws_cloudwatch_dashboard" "prod_only" {
  count          = var.environment == "production" ? 1 : 0
  dashboard_name = "\${local.name_prefix}-overview"
  dashboard_body = jsonencode(local.dashboard)
}

output "dashboard_arn" {
  value = one(aws_cloudwatch_dashboard.prod_only[*].dashboard_arn)
}`,
        description: 'for_each over a map, and count as an on/off switch with a safe reference.',
        notes: 'for_each takes a map or a set of strings - never a list.',
        tags: ['template', 'for_each', 'count'],
      },
      {
        id: 'tfh-dynamic-lifecycle',
        command: `resource "aws_security_group" "app" {
  name   = "\${local.name_prefix}-app"
  vpc_id = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.ingress_rules

    content {
      description = ingress.value.description
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = "tcp"
      cidr_blocks = ingress.value.cidr_blocks
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "prod" {
  identifier = "\${local.name_prefix}-db"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [password]
  }
}`,
        description: 'A dynamic block generating nested rules, plus the lifecycle guard rails.',
        notes: 'create_before_destroy needs name_prefix, not a fixed name, or the copies collide.',
        tags: ['template', 'dynamic', 'lifecycle'],
      },
      {
        id: 'tfh-module',
        command: `module "network" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = local.name_prefix
  cidr = var.vpc_cidr
}

module "replicated" {
  source = "./modules/replicated-bucket"
  name   = local.name_prefix

  providers = {
    aws         = aws
    aws.replica = aws.us
  }
}

# Inside modules/replicated-bucket/versions.tf:
# terraform {
#   required_providers {
#     aws = {
#       source                = "hashicorp/aws"
#       version               = ">= 5.0, < 6.0"
#       configuration_aliases = [aws.replica]
#     }
#   }
# }`,
        description:
          'A registry module with a version, and passing an aliased provider into a local one.',
        notes: 'Local sources must start with ./ or ../ . Only registry sources take `version`.',
        tags: ['template', 'modules', 'providers'],
      },
      {
        id: 'tfh-moved-removed-import',
        command: `# Rename or re-address without destroying anything.
moved {
  from = aws_s3_bucket.old
  to   = aws_s3_bucket.new
}

# Stop managing something without destroying it.
# Delete the resource block at the same time.
removed {
  from = aws_s3_bucket.legacy

  lifecycle {
    destroy = false
  }
}

# Bring an existing resource under management.
import {
  to = aws_s3_bucket.adopted
  id = "acme-existing-bucket"
}`,
        description: 'The three declarative state blocks: moved, removed and import.',
        notes: 'All three appear in the plan, so they are reviewable - unlike the CLI equivalents.',
        tags: ['template', 'moved', 'removed', 'import'],
      },
      {
        id: 'tfh-cloud',
        command: `terraform {
  cloud {
    organization = "acme-corp"

    workspaces {
      # Either one workspace by name...
      name = "production-network"

      # ...or several by tag, selected with
      # terraform workspace select
      # tags    = ["network"]
      # project = "Platform"
    }
  }
}

# Dynamic credentials as workspace ENVIRONMENT variables -
# no stored secret at all:
#   TFC_AWS_PROVIDER_AUTH = true
#   TFC_AWS_RUN_ROLE_ARN  = arn:aws:iam::111122223333:role/hcp-terraform`,
        description: 'The HCP Terraform connection, both binding styles.',
        notes: 'Mutually exclusive with a backend block - declaring both is an error.',
        tags: ['template', 'hcp', 'cloud'],
      },
    ],
  },
]
