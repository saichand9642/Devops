import type { InterviewQuestion } from '../../../types'

/** Expressions, contexts, debugging, and day-to-day Actions practice. */
export const ghaPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-gha-23',
    level: 'basic',
    kind: 'open',
    prompt: 'What are contexts in GitHub Actions? Name the ones you use most.',
    probing: 'Everyday syntax fluency.',
    answer: [
      'Contexts are objects of information available to expressions in `${{ }}`. The ones you reach for constantly are **`github`** (the event, the ref, the SHA, the actor, the repository), **`env`** (environment variables), **`secrets`**, **`vars`** (non-secret configuration variables), **`inputs`** (for `workflow_dispatch` and reusable workflows), **`needs`** (outputs and results of jobs you depend on), **`matrix`**, **`runner`** and **`steps`** (outputs of earlier steps in the same job).',
      'The practical points: `github.ref` is the full ref (`refs/heads/main`), `github.sha` is the commit, `github.event` is the entire raw webhook payload - useful for anything the shorthand does not expose, and worth printing when you are unsure what is available.',
      '`secrets` is masked in logs, but that masking works by exact match, so transforming a secret before printing it will leak it. And `vars` exists precisely so that non-secret configuration does not have to be stored as a secret, where it would be needlessly hidden from logs.',
    ],
    code: [
      {
        title: 'Contexts in use, and how to explore them',
        language: 'yaml',
        code: `steps:
  - run: |
      echo "repo:   \${{ github.repository }}"
      echo "ref:    \${{ github.ref }}"
      echo "sha:    \${{ github.sha }}"
      echo "actor:  \${{ github.actor }}"
      echo "event:  \${{ github.event_name }}"
      echo "runner: \${{ runner.os }}"

  # When you are not sure what is in the payload, print it
  - run: echo '\${{ toJSON(github.event) }}'`,
      },
    ],
    traps: [
      'Using `github.ref` where you wanted `github.ref_name` - one is `refs/heads/main`, the other is `main`.',
      'Assuming `github.actor` is trustworthy for authorisation decisions. It is the person who triggered the run, which on a fork PR is not a maintainer.',
    ],
    followUps: ['How would you find out what fields an event payload contains?'],
    tags: ['contexts', 'expressions', 'syntax', 'fundamentals'],
  },
  {
    id: 'itv-gha-24',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do conditionals work, and what is the difference between `if: failure()` and `if: always()`?',
    probing: 'Control flow, especially on the failure path.',
    answer: [
      '`if:` on a step or job decides whether it runs. Inside `if:` you do not need `${{ }}` - the whole value is already an expression.',
      'The status functions are the key part. **`success()`** is the implicit default: a step runs only if everything before it succeeded. **`failure()`** runs only if something earlier failed - the right place for diagnostics and rollback. **`always()`** runs regardless, including when the job was **cancelled** - which is why it is right for cleanup but wrong for notifications, since you get alerts for every cancelled run. **`cancelled()`** is true only for cancellation.',
      "The one that catches people is that adding **any** `if:` condition removes the implicit `success()`. `if: github.ref == 'refs/heads/main'` on a deploy step means it runs on main **even if the tests failed**, because you replaced the default condition. You need `if: success() && github.ref == ...`.",
    ],
    code: [
      {
        title: 'Status functions, and the trap',
        language: 'yaml',
        code: `steps:
  - run: make test

  # WRONG - runs on main even if the tests just failed
  - if: github.ref == 'refs/heads/main'
    run: ./deploy.sh

  # RIGHT - the implicit success() has to be restored explicitly
  - if: success() && github.ref == 'refs/heads/main'
    run: ./deploy.sh

  - if: failure()
    run: ./collect-diagnostics.sh

  - if: always()
    run: ./cleanup.sh           # also runs when the job is cancelled`,
      },
    ],
    traps: [
      'Adding an `if:` and silently losing the implicit `success()`.',
      '`always()` on a notification step, producing alerts for every cancelled run - use `failure()`.',
      'Wrapping the whole `if:` value in `${{ }}`, which works but obscures the expression.',
    ],
    followUps: ['Why does adding an `if:` condition change whether a step runs after a failure?'],
    tags: ['conditionals', 'expressions', 'control flow'],
  },
  {
    id: 'itv-gha-25',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you debug a workflow that fails only in Actions and not locally?',
    probing: 'Practical debugging method for a remote, ephemeral environment.',
    answer: [
      'Start by **enabling debug logging**: set the repository secrets or variables `ACTIONS_STEP_DEBUG` and `ACTIONS_RUNNER_DEBUG` to `true` and re-run. That surfaces a great deal that the normal log hides, including how each action resolved its inputs.',
      'Then **dump the environment**, because the difference is usually environmental rather than logical: environment variables, the working directory, the tool versions actually installed, the contents of the workspace after checkout. Comparing that against your laptop finds most of these.',
      'The common causes are a short list. **Missing files**: `actions/checkout` fetches a shallow single-branch clone by default, so anything relying on git history or tags needs `fetch-depth: 0`. **Different tool versions** than your machine. **Missing environment variables or secrets**, especially on fork pull requests where secrets are deliberately absent. **Case-sensitive filesystems** - a build that works on macOS and fails on Linux is nearly always a filename case mismatch. And **permissions** on the `GITHUB_TOKEN`.',
      'If you still cannot see it, get **interactive access**: a `tmate` step gives you an SSH session into the running runner, which turns a guessing game into a normal debugging session. Restrict it to manual runs, never leave it in a workflow that runs automatically.',
    ],
    code: [
      {
        title: 'Dump everything that might differ',
        language: 'yaml',
        code: `- name: Environment snapshot
  run: |
    echo "--- versions"
    node --version; python3 --version; docker --version
    echo "--- workspace"
    pwd && ls -la
    echo "--- git"
    git log --oneline -3 && git describe --tags --always || true
    echo "--- env (names only, never values)"
    env | cut -d= -f1 | sort

# Interactive SSH into the runner - manual runs only
- if: \${{ github.event_name == 'workflow_dispatch' && failure() }}
  uses: mxschmitt/action-tmate@v3
  timeout-minutes: 20`,
      },
      {
        title: 'The checkout options that fix half of these',
        language: 'yaml',
        code: `- uses: actions/checkout@v4
  with:
    fetch-depth: 0        # full history - needed for tags, versioning, diffs
    submodules: recursive # submodules are NOT fetched by default`,
      },
    ],
    traps: [
      'Printing environment variable values while debugging and leaking a secret into a public log.',
      'Leaving a tmate step in a workflow that runs on every push.',
      'Not realising checkout is shallow, so `git describe` or a changed-files diff behaves differently.',
    ],
    followUps: [
      'Why does `git describe` often fail in Actions but work locally?',
      'It works on your Mac and fails on ubuntu-latest. What is your first guess?',
    ],
    tags: ['debugging', 'troubleshooting', 'checkout', 'logs'],
  },
  {
    id: 'itv-gha-26',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'A workflow needs to run only when files under `src/` change. What is the right mechanism?',
    probing: 'Trigger efficiency.',
    options: [
      { id: 'a', text: 'A `paths` filter on the trigger' },
      { id: 'b', text: 'An `if:` condition on every job checking the diff' },
      { id: 'c', text: 'A separate repository for `src/`' },
      { id: 'd', text: 'There is no way to do this' },
    ],
    correct: ['a'],
    answer: [
      'A **`paths` filter** on the trigger stops the workflow being queued at all when nothing matching changed. That is strictly better than filtering inside the workflow, because no runner is started and no minutes are billed.',
      '`paths-ignore` is the inverse, and is often more maintainable: ignore `**.md` and `docs/**` rather than enumerating every source directory, which otherwise drifts as the project grows.',
      'The one thing to watch is **required status checks**. If a workflow is required for merge and it is skipped by a paths filter, the check never reports and the pull request can be blocked forever. The usual solution is a lightweight always-running job that reports the required check, or configuring the branch protection accordingly.',
    ],
    code: [
      {
        title: 'Path filtering, and the required-check workaround',
        language: 'yaml',
        code: `on:
  pull_request:
    paths:
      - 'src/**'
      - 'package-lock.json'
      - '.github/workflows/ci.yml'

---
# A separate always-running workflow so the required check is never missing
name: CI (required)
on: pull_request
jobs:
  required:
    runs-on: ubuntu-latest
    steps:
      - run: echo "no source changes - nothing to build"`,
      },
    ],
    traps: [
      'A required check skipped by a paths filter, permanently blocking merges.',
      'Forgetting to include the workflow file itself in the paths, so changes to CI do not trigger CI.',
    ],
    followUps: ['Why can a paths filter block a pull request from merging?'],
    tags: ['triggers', 'paths', 'efficiency', 'branch protection'],
  },
  {
    id: 'itv-gha-27',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is `concurrency` and how would you use it for deployments?',
    probing: 'Serialisation and cancellation, with the deployment nuance.',
    answer: [
      'A `concurrency` group serialises runs: only one run per group proceeds at a time. With `cancel-in-progress: true`, a new run **cancels** the running one instead of queueing behind it.',
      'For **CI on pull requests**, `cancel-in-progress: true` keyed on the branch is straightforwardly right. If someone pushes three times in five minutes, only the newest commit matters - testing the two superseded ones wastes minutes and tells you nothing.',
      'For **deployments it is the opposite**. Cancelling a deploy halfway leaves an environment in an indeterminate state: some instances updated, some not, perhaps a migration half-applied. So a deployment group should have `cancel-in-progress: false`, and queue instead.',
      'Key the group by what must not overlap. For CI that is the branch (`ci-${{ github.ref }}`). For deployment it is the **environment** (`deploy-production`), so that deploys from different branches or workflows still serialise against each other - which is the whole point.',
    ],
    code: [
      {
        title: 'Opposite settings for CI and deployment',
        language: 'yaml',
        code: `# CI - newest commit wins, cancel the rest
concurrency:
  group: ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

---
# Deployment - queue, never cancel, keyed by ENVIRONMENT not branch
concurrency:
  group: deploy-production
  cancel-in-progress: false`,
      },
    ],
    deeper: [
      'A cancelled run still shows as cancelled rather than failed, so branch protection treats it correctly - but any `always()` cleanup steps do still run.',
      'Keying a deployment group by branch rather than environment misses the case of two different workflows deploying to the same place.',
      'Queued runs are cancelled if a third arrives - only the most recent waiter survives, which is usually desirable but worth knowing.',
    ],
    traps: [
      '`cancel-in-progress: true` on a deployment workflow, which can abort a rollout mid-flight.',
      'Keying by branch for deployments, so two branches can deploy to production simultaneously.',
      'Forgetting `github.workflow` in the group, so unrelated workflows cancel each other.',
    ],
    followUps: ['What is the worst case if a deploy is cancelled halfway through?'],
    tags: ['concurrency', 'deployment', 'efficiency', 'advanced'],
  },
  {
    id: 'itv-gha-28',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you write a custom action, and what are the three types?',
    probing: 'Extending Actions - useful to know even if you rarely write one.',
    answer: [
      'There are three kinds. A **composite** action is a bundle of steps in YAML - no code, easy to write, and the right answer most of the time. A **JavaScript** action runs on Node directly on the runner, which is fast (no container start) and works on every platform. A **Docker container** action runs inside a container you specify, which gives you any language and full environment control but only works on Linux runners and pays a container start on every use.',
      'The choice is usually straightforward: **composite** if you are sequencing existing steps and shell commands; **JavaScript** if you need real logic, the GitHub API, or cross-platform support; **Docker** only when you need a specific runtime or toolchain that is awkward to install, and you are on Linux.',
      'Every action needs an `action.yml` declaring its `inputs`, `outputs` and `runs` configuration. Outputs are written to the `$GITHUB_OUTPUT` file rather than printed, and that is the mechanism by which later steps consume them.',
    ],
    code: [
      {
        title: 'A composite action',
        language: 'yaml',
        code: `# .github/actions/setup-project/action.yml
name: Setup project
description: Install the toolchain and dependencies the way we do it here
inputs:
  node-version:
    description: Node version
    required: false
    default: '22'
outputs:
  cache-hit:
    description: Whether the dependency cache was restored
    value: \${{ steps.deps.outputs.cache-hit }}

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: \${{ inputs.node-version }}
        cache: npm
    - id: deps
      shell: bash               # REQUIRED on every run step in a composite action
      run: |
        npm ci
        echo "cache-hit=true" >> "$GITHUB_OUTPUT"`,
      },
    ],
    traps: [
      'Forgetting `shell:` on a `run` step in a composite action - it is required and the error is unhelpful.',
      'Choosing a Docker action for convenience and paying a container pull on every single use.',
      'Not versioning your action with tags, so consumers cannot pin it.',
    ],
    followUps: ['When would a Docker action be the right choice?'],
    tags: ['custom actions', 'composite', 'javascript', 'docker'],
  },
  {
    id: 'itv-gha-29',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A workflow that deploys to production ran from a branch it should not have. How did that happen and how do you prevent it?',
    probing:
      'Security incident reasoning about the several independent controls that should have stopped it.',
    answer: [
      'There are a few ways this happens, and I would work out which before fixing anything.',
      "The most common is that the **workflow had no ref condition**. A `workflow_dispatch` trigger lets you choose any branch in the UI, and if the deploy job has no `if: github.ref == 'refs/heads/main'`, it deploys from whatever branch was selected. Similarly a `push` trigger without a `branches` filter runs on every branch.",
      'The second is **no environment protection**. If the production credentials are repository-level secrets rather than environment secrets, any workflow in the repository can read them, from any branch. Environment-scoped secrets plus a deployment branch restriction would have blocked it at the secret level.',
      'The third is an **over-broad OIDC trust policy**. If the cloud role trusts `repo:org/repo:*`, any branch can assume it. Pinning `sub` to a specific branch or environment closes that.',
      'The fix is **defence in depth**, because each of those is a single point of failure on its own: a ref condition on the job, environment protection rules with deployment branch restrictions and required reviewers, an OIDC trust policy pinned to the environment, and branch protection on main so the ref condition means something.',
      'Then I would audit: check the deployment history for other unexpected deploys, confirm what that run actually changed, and treat any credentials it could reach as potentially exposed if the branch was not trusted.',
    ],
    code: [
      {
        title: 'The layered controls, each independently sufficient',
        language: 'yaml',
        code: `on:
  push:
    branches: [main]              # 1. trigger scope
  workflow_dispatch:

jobs:
  deploy:
    # 2. explicit ref condition, even for manual runs
    if: github.ref == 'refs/heads/main'
    # 3. environment: branch restrictions + required reviewers + scoped secrets
    environment: production
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          # 4. OIDC trust policy pinned to repo + environment
          role-to-assume: arn:aws:iam::123456789012:role/deploy-production
          aws-region: eu-west-1
      - run: ./deploy.sh`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Four independent gates',
        caption:
          'Any one of these would have stopped it. Relying on a single one is the underlying mistake.',
        nodes: [
          { label: 'Trigger scope', detail: 'branches: [main]', tone: 'accent' },
          { label: 'Job ref condition', detail: 'Covers workflow_dispatch too' },
          {
            label: 'Environment protection',
            detail: 'Branch restriction + reviewers',
            tone: 'warning',
          },
          { label: 'OIDC sub pinned', detail: 'Cloud refuses the wrong branch', tone: 'danger' },
          {
            label: 'Branch protection on main',
            detail: 'Makes the ref condition meaningful',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'A `workflow_dispatch` trigger is the most commonly missed path - people add a ref condition to the push trigger and forget manual runs can pick any branch.',
      'Environment secrets are the strongest of these controls because they fail closed: without the environment, the secret simply is not there.',
      'Audit the deployment history via the API rather than trusting that this was the first time.',
    ],
    traps: [
      'Fixing only the trigger and leaving `workflow_dispatch` able to run from any branch.',
      'Repository-level production secrets, readable by every workflow.',
      'A wildcard OIDC subject condition.',
      'Assuming a single control is enough.',
    ],
    followUps: [
      'Which single control would you add first if you could only add one?',
      'How would you find out whether this had happened before?',
    ],
    tags: ['scenario', 'security', 'deployment', 'environments', 'advanced'],
  },
  {
    id: 'itv-gha-30',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you set and use environment variables and secrets in a workflow?',
    probing: 'Basic mechanics, plus where each level applies.',
    answer: [
      '`env:` can be set at three levels - **workflow**, **job** or **step** - with the narrower scope winning. Values are available to the process as ordinary environment variables and in expressions via the `env` context.',
      'To set a variable **dynamically** from one step for later steps, you append to the `$GITHUB_ENV` file rather than using `export`, because each `run` step is a separate shell and a normal export does not survive.',
      '**Secrets** come from `secrets.NAME` and are configured at repository, environment or organisation level. They are masked in logs by exact match. The safest pattern is to pass a secret through `env:` rather than interpolating it into a command string, because an interpolated value becomes part of the command line - visible in the process list and in any command echo.',
    ],
    code: [
      {
        title: 'The three levels, and dynamic values',
        language: 'yaml',
        code: `env:
  APP_ENV: production            # workflow level

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      REGION: eu-west-1          # job level
    steps:
      - name: Compute a value for later steps
        run: |
          echo "VERSION=$(cat VERSION)" >> "$GITHUB_ENV"
          echo "::add-mask::$(cat VERSION)"     # mask it if it is sensitive

      - name: Use it
        env:
          TOKEN: \${{ secrets.DEPLOY_TOKEN }}   # via env, not interpolated
        run: ./deploy.sh "$VERSION" "$REGION"`,
      },
    ],
    traps: [
      '`export FOO=bar` in one step and expecting it in the next - use `$GITHUB_ENV`.',
      'Interpolating a secret directly into a `run` command string.',
      'Assuming masking catches a transformed secret. It matches exact values only.',
    ],
    followUps: ['Why pass a secret through `env:` rather than interpolating it?'],
    tags: ['environment variables', 'secrets', 'syntax', 'fundamentals'],
  },
  {
    id: 'itv-gha-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you set up automated dependency updates and keep them from becoming noise?',
    probing:
      'Whether you have operated Dependabot at scale, where the default configuration is overwhelming.',
    answer: [
      'Dependabot (or Renovate) opens pull requests when dependencies have newer versions. The default configuration on a repository with 800 dependencies produces so many pull requests that the team stops reading them, which is worse than not having it - the security updates are buried with everything else.',
      'The things that make it workable: **group** related updates so one pull request covers all patch bumps rather than forty separate ones; **separate security updates from routine ones** so the urgent ones are distinguishable; **limit open pull requests** so the queue stays readable; and **schedule weekly rather than daily**.',
      'The thing that makes it actually succeed is **trustworthy CI**. If the test suite is reliable, a passing dependency bump can be auto-merged for patch and minor versions, and only major versions need human attention. Without reliable tests, every pull request needs manual verification and the whole thing collapses under its own weight.',
      'And do not forget to update **actions themselves** and **Dockerfile base images** - both are supported ecosystems and both are common sources of vulnerabilities that teams overlook because they are not application dependencies.',
    ],
    code: [
      {
        title: 'A dependabot.yml that is actually readable',
        language: 'yaml',
        code: `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: monday }
    open-pull-requests-limit: 5
    groups:
      patch-and-minor:              # one PR instead of forty
        update-types: [minor, patch]
    ignore:
      - dependency-name: "*"
        update-types: [version-update:semver-major]   # majors handled deliberately

  - package-ecosystem: github-actions   # keep the actions themselves current
    directory: /
    schedule: { interval: weekly }

  - package-ecosystem: docker           # and base images
    directory: /
    schedule: { interval: weekly }`,
      },
      {
        title: 'Auto-merge the safe ones when CI is trustworthy',
        language: 'yaml',
        code: `name: Dependabot auto-merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  automerge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: meta
      - if: steps.meta.outputs.update-type != 'version-update:semver-major'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: \${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`,
      },
    ],
    traps: [
      'Default settings producing so many pull requests that everyone ignores them.',
      'Auto-merging with an unreliable test suite, which ships breakage automatically.',
      'Updating application dependencies but never the actions or base images.',
    ],
    followUps: [
      'What has to be true before auto-merge is safe?',
      'How do you make sure a security update is not lost among routine ones?',
    ],
    tags: ['dependabot', 'dependencies', 'security', 'automation'],
  },
  {
    id: 'itv-gha-32',
    level: 'advanced',
    kind: 'open',
    prompt: 'Compare GitHub Actions with Jenkins. When would you choose each?',
    probing:
      'Tool judgement. The strongest answers give a real case for the older tool rather than dismissing it.',
    answer: [
      '**Actions** wins on operational cost and integration. There is no controller to run, patch or back up; runners are provisioned per job; it is configured entirely in the repository; and the integration with pull requests, environments, OIDC and the marketplace is native. For a team on GitHub building ordinary software, it is the lower-effort choice by a large margin.',
      '**Jenkins** wins where you need control that a hosted service does not give you. On-premise or air-gapped environments. Unusual hardware or very long-running jobs. Complex orchestration - fan-out across hundreds of agents with intricate dependencies - where Jenkins’ maturity and plugin ecosystem still lead. Builds that need to reach deep into a private network. And a very large existing investment in pipelines that would be expensive and risky to rewrite.',
      'The trade-off in one sentence: with Actions you accept less control in exchange for not operating a CI server; with Jenkins you accept operating a CI server in exchange for being able to do anything.',
      'There are also things worth naming honestly. Actions billing on private repositories at high volume can be significant, and self-hosted runners bring back part of the operational burden you were avoiding. Jenkins’ plugin ecosystem is both its strength and its main source of instability and security advisories.',
      'For a greenfield project on GitHub I would default to Actions. I would keep or choose Jenkins for a specific, statable reason - not out of familiarity.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Actions or Jenkins?',
        caption: 'The deciding factor is usually an infrastructure constraint, not a feature.',
        question: 'What constrains this choice?',
        branches: [
          {
            condition: 'GitHub-hosted code, ordinary builds',
            result: 'GitHub Actions',
            detail: 'No server to operate',
            tone: 'success',
          },
          {
            condition: 'Air-gapped or strict on-premise',
            result: 'Jenkins (or self-hosted runners)',
            detail: 'Hosted control plane may be disallowed',
            tone: 'accent',
          },
          {
            condition: 'Unusual hardware or very long jobs',
            result: 'Jenkins, or self-hosted runners',
            tone: 'accent',
          },
          {
            condition: 'Large existing Jenkins investment',
            result: 'Keep it, and migrate incrementally if at all',
            detail: 'Rewrites are rarely worth it alone',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Actions has no equivalent of a Jenkins shared library with arbitrary Groovy; reusable workflows and composite actions cover most of it, more declaratively and with less power.',
      'Jenkins gives you a global view across all pipelines; Actions is repository-centric, which makes organisation-wide reporting harder.',
      'OIDC federation is genuinely better in Actions and is often reason enough on its own for security-conscious teams.',
    ],
    traps: [
      'Dismissing Jenkins as legacy. It is still the right answer in several real situations.',
      'Underestimating Actions billing at high volume on private repositories.',
      'Choosing based on familiarity and presenting it as a technical argument.',
    ],
    followUps: [
      'What would make you keep Jenkins at a GitHub-native company?',
      'What does Actions do better that is hard to replicate in Jenkins?',
    ],
    tags: ['comparison', 'jenkins', 'tooling', 'strategy', 'advanced'],
  },
  {
    id: 'itv-gha-33',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you cache dependencies effectively, and why do caches sometimes stop working?',
    probing: 'Practical performance work, including cache scoping which is non-obvious.',
    answer: [
      '`actions/cache` stores a directory under a **key**. If the key matches exactly you get a hit; if not, `restore-keys` gives you the most recent partial match, which is usually still most of the benefit. The key should be derived from whatever determines the content - a hash of the lockfile, plus the OS and architecture.',
      'Many setup actions have caching built in (`actions/setup-node` with `cache: npm`, `setup-python` with `cache: pip`), and using those is simpler and less error-prone than hand-rolling it.',
      "Caches stop working for a few specific reasons. **Key drift**: something in the key changes every run - a timestamp, a run number - so it never hits. **Scope**: caches are scoped to a branch, with read access to the default branch, so a feature branch can read main's cache but **not another feature branch's**, and the first run on a new branch is always slower. **Eviction**: there is a repository-wide size limit and least-recently-used eviction, so a repository caching large directories on many branches evicts its own caches constantly. And **7 days without access** removes a cache entirely.",
      'That eviction behaviour is the one people miss: adding more caching can make caching worse, because each new cache pushes others out.',
    ],
    code: [
      {
        title: 'A key that hits, with a sensible fallback',
        language: 'yaml',
        code: `- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      ~/.cache/ms-playwright
    key: deps-\${{ runner.os }}-\${{ runner.arch }}-\${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      deps-\${{ runner.os }}-\${{ runner.arch }}-

# Or simply let the setup action do it
- uses: actions/setup-node@v4
  with: { node-version: '22', cache: npm }`,
      },
    ],
    traps: [
      'A cache key containing `github.run_id`, so it never hits.',
      'Caching so much that the repository limit evicts everything.',
      'Expecting a feature branch to reuse another feature branch’s cache.',
      'A build that fails when the cache misses, which means it is not really a cache.',
    ],
    followUps: [
      'Why is the first run on a new branch always slower?',
      'How would you tell whether your cache is actually hitting?',
    ],
    tags: ['cache', 'performance', 'ci', 'troubleshooting'],
  },
  {
    id: 'itv-gha-34',
    level: 'basic',
    kind: 'mcq',
    prompt: 'Where must workflow files live for GitHub Actions to run them?',
    probing: 'A basic fact that trips people up on their first workflow.',
    options: [
      { id: 'a', text: 'Anywhere in the repository, as long as the file ends in `.yml`' },
      { id: 'b', text: 'In `.github/workflows/` on the branch being built' },
      { id: 'c', text: 'In a `ci/` directory at the repository root' },
      { id: 'd', text: 'Configured through the GitHub web interface only' },
    ],
    correct: ['b'],
    answer: [
      'Workflows must be in **`.github/workflows/`**. Anywhere else and GitHub simply does not see them - there is no error, the workflow just never runs, which makes the mistake confusing the first time.',
      'The second half matters as much: the workflow that runs is the one **on the branch being built**. A workflow added on a feature branch runs for that branch’s pushes and pull requests, but the version on `main` is what runs for `main`.',
      'The exception is `pull_request_target` and `workflow_run`, which deliberately use the workflow file from the **base** branch. That is a security property - it is why a fork cannot change what a `pull_request_target` workflow does.',
    ],
    traps: [
      'Putting the file in `.github/` rather than `.github/workflows/` and getting no error at all.',
      'Expecting a workflow change on a branch to affect `pull_request_target` runs. It does not.',
    ],
    followUps: ['Why does `pull_request_target` use the base branch’s workflow file?'],
    tags: ['workflows', 'fundamentals', 'branches'],
  },
  {
    id: 'itv-gha-35',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you implement a monorepo CI strategy where only affected projects are built?',
    probing: 'Scaling CI. Naive monorepo pipelines rebuild everything and become unusable.',
    answer: [
      'The problem is that a monorepo with thirty services would, naively, run all thirty pipelines for a one-line change. That is slow, expensive, and it means a failure in an unrelated service blocks your merge.',
      'The simplest approach is **path-based filtering**: a first job computes which paths changed and outputs a list, and downstream jobs use `if:` plus a matrix built from that list. `dorny/paths-filter` does the detection well. This is easy to set up and works fine for a repository of independent services.',
      'It breaks down when there are **shared libraries**. If `libs/auth` changes, every service depending on it needs rebuilding, and a path filter does not know that. At that point you need **dependency-graph-aware tooling** - Nx, Turborepo, Bazel or Pants - which computes the affected set from the actual dependency graph and can also cache build outputs by content hash, so unchanged projects are not rebuilt even when they are technically affected.',
      'Two practical details. The change detection needs **enough git history** to diff against the merge base, so `fetch-depth: 0`. And **required status checks** interact badly with skipped jobs: if the `service-a` check is required and skipped, the pull request cannot merge. The usual solution is a single required aggregate job that depends on the dynamic set and reports success when all of them passed or were skipped.',
    ],
    code: [
      {
        title: 'Detect changes, build a dynamic matrix, aggregate the result',
        language: 'yaml',
        code: `jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      services: \${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }        # needed to diff against the merge base
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:     ['services/api/**',     'libs/shared/**']
            web:     ['services/web/**',     'libs/shared/**']
            worker:  ['services/worker/**',  'libs/shared/**']

  build:
    needs: changes
    if: needs.changes.outputs.services != '[]'
    strategy:
      fail-fast: false
      matrix:
        service: \${{ fromJSON(needs.changes.outputs.services) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make -C services/\${{ matrix.service }} build test

  # ONE required check, so skipped services never block a merge
  ci:
    needs: [changes, build]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - if: contains(needs.*.result, 'failure')
        run: exit 1
      - run: echo "all affected services passed"`,
      },
    ],
    deeper: [
      'Listing shared library paths in every service’s filter is the pragmatic version of dependency awareness, and it works until the graph gets complicated.',
      'Nx and Turborepo add **remote caching keyed by content hash**, so an unchanged project is not rebuilt even across machines - often a bigger win than the affected-set calculation itself.',
      'On pull requests diff against the merge base; on push to main, against the previous commit. Getting this wrong silently builds nothing.',
      'The aggregate required check is the piece most people miss, and it is what makes dynamic matrices usable with branch protection.',
    ],
    traps: [
      'Shallow checkout, so the diff is wrong and either everything or nothing is built.',
      'Required checks on individual services, permanently blocking pull requests that skip them.',
      'Path filters that ignore shared libraries, so a library change ships untested.',
    ],
    followUps: [
      'What breaks when a shared library changes?',
      'Why does the aggregate job need `if: always()`?',
    ],
    tags: ['monorepo', 'scaling', 'matrix', 'branch protection', 'advanced'],
  },
  {
    id: 'itv-gha-36',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a job summary and how would you use it?',
    probing: 'A small feature that shows attention to developer experience.',
    answer: [
      'Writing Markdown to the `$GITHUB_STEP_SUMMARY` file renders it on the workflow run page. It gives you a place to put the **conclusion** of a run rather than making people read a 4,000-line log.',
      'The good uses are the ones that answer "what happened?" at a glance: a test results table, coverage change against the base branch, the image digest that was published, what a Terraform plan would change, or the specific reason a quality gate failed.',
      'It is a small feature with a disproportionate effect on how people experience CI. A failing build that says "3 tests failed, here they are" at the top is a very different experience from one that requires expanding step nine and scrolling.',
    ],
    code: [
      {
        title: 'Writing a useful summary',
        language: 'bash',
        code: `{
  echo "## Build result"
  echo ""
  echo "| Check | Result |"
  echo "| --- | --- |"
  echo "| Unit tests | \${UNIT_RESULT} |"
  echo "| Coverage | \${COVERAGE}% (\${COVERAGE_DELTA}) |"
  echo "| Image | \\\`\${IMAGE_DIGEST}\\\` |"
  echo ""
  if [ -s failed-tests.txt ]; then
    echo "### Failed tests"
    sed 's/^/- /' failed-tests.txt
  fi
} >> "$GITHUB_STEP_SUMMARY"`,
      },
    ],
    traps: [
      'Writing so much that the summary is as unreadable as the log.',
      'Including secrets or internal URLs in a summary on a public repository.',
    ],
    followUps: ['What would you put in a summary for a failed deployment?'],
    tags: ['job summary', 'developer experience', 'reporting'],
  },
]
