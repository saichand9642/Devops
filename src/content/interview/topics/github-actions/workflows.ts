import type { InterviewQuestion } from '../../../types'

/** Workflow syntax, triggers, jobs, matrices and reuse. */
export const ghaWorkflowQuestions: InterviewQuestion[] = [
  {
    id: 'itv-gha-9',
    level: 'basic',
    kind: 'open',
    prompt: 'Explain the structure of a GitHub Actions workflow: workflow, job, step, action.',
    probing: 'Vocabulary. Everything else in the round builds on these four words.',
    answer: [
      'A **workflow** is a YAML file in `.github/workflows/` triggered by an event. A workflow contains **jobs**. Each job runs on its **own fresh runner** - a clean virtual machine or container - and jobs run **in parallel** by default unless you declare dependencies with `needs`.',
      'A job contains **steps**, which run **sequentially on the same runner**, sharing a filesystem and a workspace. A step either runs a shell command (`run:`) or invokes an **action** (`uses:`) - a reusable unit of behaviour published in a repository.',
      'The distinction that matters practically is **job versus step**. Steps in one job share disk; separate jobs do not. Anything you need to pass between jobs has to go through **artifacts** (for files) or **job outputs** (for small values), because job two starts on a machine that has never seen job one.',
    ],
    code: [
      {
        title: 'The four levels in one file',
        language: 'yaml',
        code: `name: CI                          # workflow
on: [push, pull_request]

jobs:
  test:                           # job - its own fresh runner
    runs-on: ubuntu-latest
    steps:                        # steps - sequential, shared filesystem
      - uses: actions/checkout@v4          # an action
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci                        # a shell command
      - run: npm test

  build:                          # separate job - separate machine
    needs: test                   # ...but wait for test to pass
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build`,
      },
    ],
    traps: [
      'Expecting a file created in job one to exist in job two. It does not.',
      'Forgetting `actions/checkout` - the runner starts empty, with no source code.',
    ],
    followUps: [
      'How do you pass a built file from one job to another?',
      'Why do jobs run in parallel by default?',
    ],
    tags: ['workflow', 'jobs', 'steps', 'fundamentals'],
  },
  {
    id: 'itv-gha-10',
    level: 'basic',
    kind: 'mcq',
    prompt: 'A workflow has two jobs with no `needs` between them. When does the second job start?',
    probing: 'Job concurrency model.',
    options: [
      { id: 'a', text: 'After the first job finishes successfully' },
      {
        id: 'b',
        text: 'At the same time as the first - jobs run in parallel unless `needs` creates a dependency',
      },
      { id: 'c', text: 'Only if the first job fails' },
      { id: 'd', text: 'In the order they appear in the file, always sequentially' },
    ],
    correct: ['b'],
    answer: [
      'Jobs are **parallel by default**. Order in the file means nothing; `needs` is the only thing that creates sequence. That is deliberate - independent work should not wait.',
      'The consequence people hit is that a `deploy` job placed after `test` in the file will run **simultaneously with** the tests unless it declares `needs: test`. Deploying while the tests are still running is a real and easily made mistake.',
      '`needs` also makes the upstream job’s **outputs** available, and by default a job whose dependency failed is skipped - which is usually what you want, and can be overridden with `if: always()` for cleanup jobs.',
    ],
    code: [
      {
        title: 'Fan out, then fan in',
        language: 'yaml',
        code: `jobs:
  lint:   { runs-on: ubuntu-latest, steps: [{ run: make lint }] }
  test:   { runs-on: ubuntu-latest, steps: [{ run: make test }] }
  build:  { runs-on: ubuntu-latest, steps: [{ run: make build }] }

  deploy:
    needs: [lint, test, build]     # waits for ALL three
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh

  notify:
    needs: [deploy]
    if: always()                   # runs even if deploy failed
    runs-on: ubuntu-latest
    steps:
      - run: ./notify.sh "\${{ needs.deploy.result }}"`,
      },
    ],
    traps: [
      'Assuming file order implies execution order.',
      'A cleanup job that is skipped because its dependency failed - it needs `if: always()`.',
    ],
    followUps: ['How would you run a job only when an earlier one failed?'],
    tags: ['jobs', 'needs', 'parallelism', 'fundamentals'],
  },
  {
    id: 'itv-gha-11',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What events can trigger a workflow, and what is the difference between `pull_request` and `pull_request_target`?',
    probing:
      'The `pull_request_target` distinction is a genuine security question and a known source of breaches.',
    answer: [
      'Workflows trigger on repository events (`push`, `pull_request`, `release`, `issues`), on a schedule (`schedule` with cron), manually (`workflow_dispatch`), from another workflow (`workflow_call`, `workflow_run`), and from external systems (`repository_dispatch`).',
      'The critical pair is `pull_request` versus `pull_request_target`. **`pull_request`** checks out the **PR’s code** and runs with a **read-only token and no access to secrets** when the PR comes from a fork. That is the safe default: untrusted code runs with no privileges.',
      '**`pull_request_target`** runs in the context of the **base repository** - with **full secrets and a write token** - while the PR branch is the thing being proposed. It exists so that workflows can label, comment on or triage PRs from forks, which needs write access.',
      'The danger is that if a `pull_request_target` workflow **checks out and executes the PR’s code**, an attacker opens a pull request containing a malicious build script and it runs with your secrets and write access to the repository. This has been exploited in the wild repeatedly. The rule is: with `pull_request_target`, **never check out the PR head**, and never run anything from it.',
    ],
    code: [
      {
        title: 'Safe and unsafe uses of pull_request_target',
        language: 'yaml',
        code: `# UNSAFE - runs attacker-controlled code with full secrets
on: pull_request_target
jobs:
  bad:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}   # attacker's code
      - run: npm ci && npm test                            # ...executed with secrets

# SAFE - only metadata, no checkout of the PR's code
on: pull_request_target
permissions:
  pull-requests: write
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v5

# SAFE - untrusted code, but no secrets and a read-only token
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which pull request trigger?',
        caption: 'If the workflow must run the PR’s code, it must not have secrets.',
        question: 'What does this workflow need to do?',
        branches: [
          {
            condition: 'Build and test the proposed code',
            result: 'pull_request',
            detail: 'No secrets for forks - and that is correct',
            tone: 'success',
          },
          {
            condition: 'Label, comment or triage only',
            result: 'pull_request_target, no checkout',
            detail: 'Metadata only, never run the PR code',
            tone: 'accent',
          },
          {
            condition: 'Run the PR code AND use secrets',
            result: 'Do not',
            detail: 'This is the exploited pattern',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Even with `pull_request`, a fork PR can read anything in the repository and can consume your runner minutes. Require approval for first-time contributors.',
      'A workflow file change in a fork PR does not take effect for `pull_request_target` - it uses the base branch’s workflow - which is exactly why it appears safe and is not.',
      'If you genuinely need to test a fork PR against secrets, do it in a separate workflow triggered by a maintainer after review, never automatically.',
    ],
    traps: [
      'Checking out `head.sha` under `pull_request_target` - the classic exploited mistake.',
      'Using `pull_request_target` because "`pull_request` does not have secrets", which is the security control working as designed.',
      'Assuming a script in the PR is safe because you skimmed the diff - it can be in a transitive dependency’s install hook.',
    ],
    followUps: [
      'Why does GitHub withhold secrets from fork pull requests?',
      'How would you safely run integration tests that need credentials on a fork PR?',
    ],
    tags: ['triggers', 'security', 'pull_request_target', 'forks'],
  },
  {
    id: 'itv-gha-12',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a matrix strategy and how do you control it?',
    probing: 'Test-across-versions fluency, including exclusions and fail-fast.',
    answer: [
      'A matrix runs the **same job across combinations** of variables - operating systems, language versions, database versions - generating one job per combination without you writing them out.',
      'The controls that matter: **`include`** adds a specific extra combination (often with extra variables attached), **`exclude`** removes combinations that do not make sense, **`fail-fast`** (default `true`) cancels all remaining jobs the moment one fails, and **`max-parallel`** limits how many run at once.',
      '`fail-fast: false` is usually what you want for a test matrix. With the default, one failure cancels every other combination, so you learn that Node 20 on Windows failed but not whether Node 22 on Linux also failed - and you end up re-running to find out.',
      'The other thing to watch is **combinatorial growth**. Three operating systems, four language versions and three database versions is 36 jobs. That is 36 runners, 36 dependency installs, and on private repositories, 36 times the minutes.',
    ],
    code: [
      {
        title: 'A matrix with include, exclude and no fail-fast',
        language: 'yaml',
        code: `jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false          # see every failure, not just the first
      max-parallel: 6
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [20, 22]
        exclude:
          - os: macos-latest    # skip an expensive, low-value combination
            node: 20
        include:
          - os: ubuntu-latest   # one extra combination, with extra variables
            node: 22
            coverage: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: \${{ matrix.node }}, cache: npm }
      - run: npm ci
      - run: npm test
      - if: matrix.coverage
        run: npm run coverage && ./upload-coverage.sh`,
      },
    ],
    traps: [
      'Leaving `fail-fast: true` on a test matrix and losing the full picture.',
      'A matrix that grows to dozens of jobs, costing far more than it catches.',
      'Forgetting that `runs-on` can itself be a matrix variable, and hardcoding it.',
    ],
    followUps: [
      'Why would you set `fail-fast: false`?',
      'How would you reduce a 36-job matrix without losing coverage?',
    ],
    tags: ['matrix', 'testing', 'strategy', 'cost'],
  },
  {
    id: 'itv-gha-13',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you share data between jobs, and what is the difference between artifacts and cache?',
    probing: 'A distinction people routinely get wrong, with real correctness consequences.',
    answer: [
      'Every job gets a **fresh runner**, so nothing on disk survives between jobs. There are three mechanisms, for three purposes.',
      '**Job outputs** pass small values - a version string, an image digest - from one job to another via `needs.<job>.outputs`. They are strings, and there is a size limit; they are not for files.',
      '**Artifacts** (`actions/upload-artifact` / `download-artifact`) pass **files** between jobs and make them downloadable from the run afterwards. They are **scoped to one workflow run**, retained for a configured period, and intended for build outputs, test reports and logs.',
      '**Cache** (`actions/cache`) persists files **across runs** to save time - dependency downloads, compiler caches. It is keyed, it can be **evicted at any time**, and it is **best-effort**. That is the essential difference: a build must never *depend* on the cache being present. If your build only works when the cache hits, it is broken.',
      'The other difference that matters is trust. Caches can be written by workflows running on a pull request branch, so a cache is not a trustworthy source of build inputs in the way an artifact from a verified job is.',
    ],
    code: [
      {
        title: 'Outputs, artifacts and cache in one workflow',
        language: 'yaml',
        code: `jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: \${{ steps.meta.outputs.version }}     # small value, to other jobs
    steps:
      - uses: actions/checkout@v4

      # CACHE - speed only; the build must work without it
      - uses: actions/cache@v4
        with:
          path: ~/.npm
          key: npm-\${{ runner.os }}-\${{ hashFiles('**/package-lock.json') }}
          restore-keys: npm-\${{ runner.os }}-

      - run: npm ci && npm run build
      - id: meta
        run: echo "version=$(cat VERSION)" >> "$GITHUB_OUTPUT"

      # ARTIFACT - files this run produced, needed by a later job
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/, retention-days: 7 }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      - run: ./deploy.sh "\${{ needs.build.outputs.version }}"`,
      },
    ],
    deeper: [
      '`restore-keys` gives you a partial cache hit when the exact key misses - usually the difference between a 90% and a 0% saving after a dependency bump.',
      'Cache the package manager’s **download cache**, not the installed dependency tree. An installed tree restored across a dependency change causes very confusing failures.',
      'Artifacts cost storage and are retained by default for 90 days. Set `retention-days` on anything large.',
      'Caches are scoped by branch with fallback to the default branch, which is why a new branch’s first run is slower.',
    ],
    traps: [
      'Using cache to pass build output between jobs. It is not guaranteed to be there.',
      'A cache key that does not change when dependencies do, serving a stale cache indefinitely.',
      'Uploading huge artifacts on every run and paying for the storage.',
    ],
    followUps: [
      'Why must a build not depend on the cache?',
      'How would you pass a 2 GB build output between jobs?',
    ],
    tags: ['artifacts', 'cache', 'jobs', 'outputs'],
  },
  {
    id: 'itv-gha-14',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you avoid duplicating the same workflow across fifty repositories?',
    probing: 'Reuse at organisational scale - reusable workflows versus composite actions.',
    answer: [
      'Two mechanisms, for two different levels of reuse.',
      'A **composite action** packages a **sequence of steps** that can be dropped into any job. It is the right choice for a reusable fragment - "set up our toolchain", "publish coverage" - that is part of a larger job the caller controls.',
      'A **reusable workflow** packages **entire jobs** and is called with `uses:` at the job level. It takes `inputs` and `secrets`, and it is the right choice when you want to standardise a whole pipeline: "build, scan, publish and deploy, the way we do it here". Callers supply a handful of inputs and get the full standard pipeline.',
      'At fifty repositories I would build a small set of reusable workflows in a central repository, **versioned with tags**, and have each repository call them with a few lines. Then a change to the standard build - a new security scan, an updated action version - is one pull request that repositories adopt by bumping a tag, rather than fifty near-identical edits.',
      'The important discipline is **versioning**. Referencing `@main` means a change to the central repository takes effect everywhere immediately, so one bad commit breaks every pipeline in the organisation at once. Tag releases and let repositories upgrade on their own schedule, with Dependabot raising the pull request.',
    ],
    code: [
      {
        title: 'A reusable workflow in a central repository',
        language: 'yaml',
        code: `# .github/workflows/standard-build.yml in org/ci-workflows
on:
  workflow_call:
    inputs:
      node-version: { type: string, default: '22' }
      deploy:       { type: boolean, default: false }
    secrets:
      REGISTRY_TOKEN: { required: true }

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: \${{ inputs.node-version }}, cache: npm }
      - run: npm ci && npm test && npm run build
      - run: ./scan.sh
      - if: inputs.deploy
        run: ./publish.sh
        env: { REGISTRY_TOKEN: \${{ secrets.REGISTRY_TOKEN }} }`,
      },
      {
        title: 'What each repository then needs',
        language: 'yaml',
        code: `name: CI
on: [push, pull_request]

jobs:
  ci:
    uses: org/ci-workflows/.github/workflows/standard-build.yml@v2.3.0
    with:
      node-version: '22'
      deploy: \${{ github.ref == 'refs/heads/main' }}
    secrets:
      REGISTRY_TOKEN: \${{ secrets.REGISTRY_TOKEN }}`,
        explanation: 'Nine lines per repository, pinned to a version that upgrades deliberately.',
      },
    ],
    deeper: [
      'Reusable workflows can be nested up to four levels, but deep nesting makes failures very hard to trace. Keep it shallow.',
      '`secrets: inherit` passes everything through, which is convenient and too broad. Name the secrets explicitly.',
      'Composite actions cannot define jobs or use `if` at the job level, which is the main reason to choose a reusable workflow instead.',
      'Dependabot can update `uses:` references, so version bumps arrive as reviewable pull requests.',
    ],
    traps: [
      'Referencing `@main`, so an untested central change breaks every repository at once.',
      '`secrets: inherit` everywhere, giving the central workflow access to everything.',
      'Over-abstracting until nobody can work out what their pipeline actually does.',
    ],
    followUps: [
      'When would a composite action be better than a reusable workflow?',
      'How do you roll out a breaking change to a reusable workflow?',
    ],
    tags: ['reusable workflows', 'composite actions', 'scale', 'versioning'],
  },
  {
    id: 'itv-gha-15',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How do you authenticate to AWS from GitHub Actions without storing long-lived credentials?',
    probing: 'OIDC federation. The expected modern answer, and a real security improvement.',
    answer: [
      'With **OIDC federation**. GitHub issues each workflow run a short-lived, signed **JWT** describing the repository, the branch or tag, the environment and the workflow. AWS is configured to trust GitHub’s OIDC provider, and the workflow exchanges that token for **temporary IAM credentials** via `AssumeRoleWithWebIdentity`.',
      'The result is that **no AWS credentials exist in GitHub at all**. Nothing to leak, nothing to rotate, nothing to find in a repository dump. Credentials last for the duration of the job and expire automatically.',
      'The security of the whole arrangement rests on the **trust policy condition**. The `sub` claim encodes the repository *and* the ref, and the condition must pin both. A policy that trusts `repo:myorg/*:*` means **any repository in the organisation on any branch** can assume that role - including a branch someone creates specifically to do so. Pin to the repository and to the specific branch or environment.',
      'Using a GitHub **environment** in the claim is the strongest form, because environments carry protection rules - required reviewers, branch restrictions - so the credential can only be obtained through an approved deployment.',
    ],
    code: [
      {
        title: 'The workflow side - no stored credentials',
        language: 'yaml',
        code: `jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production        # appears in the OIDC claim
    permissions:
      id-token: write              # REQUIRED to request the OIDC token
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-deploy
          aws-region: eu-west-1
          role-session-name: gha-\${{ github.run_id }}
      - run: aws sts get-caller-identity
      - run: ./deploy.sh`,
      },
      {
        title: 'The trust policy - where the security actually lives',
        language: 'json',
        code: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:environment:production"
      }
    }
  }]
}`,
        explanation:
          'Pinning sub to one repository AND one environment. A wildcard here is the whole vulnerability.',
      },
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'OIDC token exchange',
        caption:
          'No secret is ever stored - the identity is proven per run and expires with the job.',
        participants: [
          { id: 'wf', label: 'Workflow' },
          { id: 'gh', label: 'GitHub OIDC' },
          { id: 'sts', label: 'AWS STS' },
          { id: 'aws', label: 'AWS API' },
        ],
        messages: [
          { from: 'wf', to: 'gh', label: 'request token (id-token: write)' },
          { from: 'gh', to: 'wf', label: 'signed JWT: repo, ref, environment', kind: 'return' },
          { from: 'wf', to: 'sts', label: 'AssumeRoleWithWebIdentity(JWT)' },
          { from: 'sts', to: 'sts', label: 'verify signature, check trust policy', kind: 'return' },
          { from: 'sts', to: 'wf', label: 'temporary credentials (1h)', kind: 'return' },
          { from: 'wf', to: 'aws', label: 'deploy with temporary credentials' },
        ],
      },
    ],
    deeper: [
      '`permissions: id-token: write` is required and easy to forget - without it the token request fails with a confusing error.',
      'The same pattern works for GCP (Workload Identity Federation), Azure (federated credentials) and HashiCorp Vault.',
      'Use separate roles per environment with different permissions, rather than one role that can do everything.',
      'CloudTrail records the session name, so using `github.run_id` makes every AWS action traceable back to a specific workflow run.',
    ],
    traps: [
      'A wildcard `sub` condition, which lets any branch in the organisation assume the role.',
      'Forgetting `id-token: write`.',
      'Giving the federated role broad permissions because scoping it is fiddly.',
    ],
    followUps: [
      'What is wrong with `"sub": "repo:myorg/*:*"`?',
      'How would you make the credential obtainable only after a human approval?',
    ],
    tags: ['oidc', 'aws', 'security', 'authentication', 'advanced'],
  },
  {
    id: 'itv-gha-16',
    level: 'intermediate',
    kind: 'multi',
    prompt:
      'Which of these reduce the security risk of using third-party actions? Select all that apply.',
    probing: 'Supply chain awareness in the Actions ecosystem specifically.',
    options: [
      { id: 'a', text: 'Pinning actions to a full commit SHA rather than a tag' },
      { id: 'b', text: 'Setting minimal `permissions` on the workflow or job' },
      { id: 'c', text: 'Restricting which actions may be used via organisation policy' },
      { id: 'd', text: 'Always using `@main` so you get security fixes immediately' },
      { id: 'e', text: 'Reviewing the action’s source before adopting it' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Using `@main` is the opposite of a control. A tag - and `main` especially - is **mutable**: whoever controls the action repository can change what `@v3` or `@main` points at, and your workflow will execute the new code on its next run with whatever permissions and secrets it has. This has happened to real, widely used actions.',
      '**Pinning to a full commit SHA** makes the reference immutable - the code you reviewed is the code that runs. Dependabot can still propose updates, so you get fixes without giving up control.',
      '**Minimal `permissions`** limits what a compromised action can do. The default `GITHUB_TOKEN` is often write-capable; setting `permissions: contents: read` at the top of the workflow and granting more only where needed contains the damage.',
      '**Organisation policy** can restrict actions to a verified allow-list, which is the only control that scales past a handful of repositories. And **reviewing the source** before adoption is basic diligence - an action is arbitrary code running with access to your repository and secrets.',
    ],
    code: [
      {
        title: 'Pinned actions and least-privilege permissions',
        language: 'yaml',
        code: `permissions:
  contents: read              # default everything to read-only

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write         # granted only where genuinely needed
      id-token: write
    steps:
      # Pinned to an immutable SHA, with the version in a comment
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11   # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2`,
      },
    ],
    traps: [
      'Pinning to `@v4` and believing it is immutable. Tags can be moved.',
      'Leaving default permissions, which are broader than most workflows need.',
      'Adopting an action with two stars because it does exactly what you want.',
    ],
    followUps: [
      'How do you keep SHA-pinned actions up to date?',
      'What can a malicious action actually do in your workflow?',
    ],
    tags: ['security', 'supply chain', 'actions', 'permissions'],
  },
  {
    id: 'itv-gha-17',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are GitHub-hosted versus self-hosted runners, and when would you use each?',
    probing: 'Infrastructure trade-off, including the security caveat for self-hosted.',
    answer: [
      '**GitHub-hosted** runners are fresh virtual machines provisioned per job, with a standard toolchain preinstalled, destroyed afterwards. They need no maintenance, they are clean every time, and they are billed per minute (free for public repositories).',
      '**Self-hosted** runners are machines you provide and register. You would use them when you need something GitHub-hosted cannot give you: **access to a private network** (an internal database or artifact store), **specific hardware** (GPUs, large memory, a particular architecture), **specialist software** with licensing constraints, or when the volume makes per-minute billing more expensive than running your own.',
      'The security caveat is important and frequently missed: **never use a self-hosted runner on a public repository**. Anyone can open a pull request, and by default that runs code on your machine - inside your network, with whatever that machine can reach. GitHub documents this explicitly. On public repositories, use hosted runners.',
      'Even on private repositories, self-hosted runners should be **ephemeral** - registered, run one job, then destroyed. A persistent runner accumulates state between jobs, so one workflow can leave something behind that affects the next, including deliberately.',
    ],
    code: [
      {
        title: 'Targeting runners by label',
        language: 'yaml',
        code: `jobs:
  standard:
    runs-on: ubuntu-latest                       # GitHub-hosted

  gpu-training:
    runs-on: [self-hosted, linux, x64, gpu]      # all labels must match

  internal-deploy:
    runs-on: [self-hosted, prod-network]         # can reach private endpoints`,
      },
    ],
    deeper: [
      'Actions Runner Controller runs ephemeral runners as Kubernetes Pods, which gives you clean isolation and autoscaling - the best of both models.',
      'Larger GitHub-hosted runners are available if the constraint is only CPU or memory, and are usually cheaper than operating your own fleet.',
      'Self-hosted runners need patching, monitoring and capacity management like any other fleet. That cost is easy to underestimate when comparing against per-minute billing.',
    ],
    traps: [
      'A self-hosted runner attached to a public repository - a direct path into your network.',
      'Persistent runners where one job can leave state for the next.',
      'A runner with broad cloud credentials attached to the instance, so every workflow inherits them.',
    ],
    followUps: [
      'Why are self-hosted runners dangerous on public repositories?',
      'How would you make a self-hosted fleet safe?',
    ],
    tags: ['runners', 'self-hosted', 'security', 'infrastructure'],
  },
  {
    id: 'itv-gha-18',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Your Actions bill has tripled in three months and nothing obvious changed. How do you investigate and reduce it?',
    probing:
      'Cost awareness, which is increasingly a DevOps responsibility and rarely prepared for.',
    answer: [
      'First **get the data**, because the intuition is usually wrong. The billing page breaks usage down by repository and runner type, and the Actions API gives per-workflow timing. Almost always a small number of workflows account for most of the spend.',
      'Then look for the usual causes, roughly in order of how often they are the answer. **Matrix growth**: someone added an operating system or a version and multiplied the job count. **Trigger scope**: a workflow running on every push to every branch rather than on pull requests and main. **No concurrency control**: three pushes in five minutes run three full pipelines when only the last matters. **Broken caching**: a cache key that stopped matching, so every job re-downloads dependencies. **Larger runners** adopted for one slow job and then copied everywhere. And **macOS runners**, which are billed at ten times the Linux rate - a single macOS job in a matrix can dominate a bill.',
      'The highest-value fixes are usually: **`concurrency` with `cancel-in-progress`** so superseded runs are cancelled, **`paths` filters** so a documentation change does not trigger the full build, **trimming the matrix** to combinations that have actually caught something, and **fixing the cache**.',
      'Then make it visible so it does not silently regress: a scheduled job that reports minutes per workflow, and treating a sudden increase as something to investigate rather than something to notice at the end of the quarter.',
    ],
    code: [
      {
        title: 'The two changes with the biggest effect',
        language: 'yaml',
        code: `name: CI
on:
  pull_request:
  push:
    branches: [main]            # not every branch
    paths-ignore:               # docs changes do not need the full build
      - '**.md'
      - 'docs/**'

# Cancel superseded runs on the same branch - often 30%+ of the saving
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: \${{ github.ref != 'refs/heads/main' }}

jobs:
  test:
    runs-on: ubuntu-latest      # macOS is ~10x, Windows ~2x
    timeout-minutes: 15         # a hung job otherwise bills for 6 hours
`,
      },
      {
        title: 'Find the expensive workflows',
        language: 'bash',
        code: `# Total minutes per workflow over the last 100 runs
for wf in $(gh api repos/:owner/:repo/actions/workflows --jq '.workflows[].id'); do
  name=$(gh api repos/:owner/:repo/actions/workflows/$wf --jq '.name')
  mins=$(gh api "repos/:owner/:repo/actions/workflows/$wf/timing" --jq \\
    '[.billable[]?.total_ms] | add // 0 | ./60000 | floor')
  printf '%8s min  %s\\n' "$mins" "$name"
done | sort -rn | head -10`,
      },
    ],
    deeper: [
      '`timeout-minutes` is the cheapest safety net there is. The default is 360 minutes, so one hung job can cost more than a week of normal usage.',
      'macOS runners are roughly ten times the Linux rate and Windows roughly double. A matrix that includes macOS "for completeness" is frequently the single largest line item.',
      'Self-hosted runners change the economics at high volume, but bring maintenance and the security considerations that come with them.',
      'Public repositories are free, which is why the bill often comes entirely from a few private ones.',
    ],
    traps: [
      'Cutting tests to save money rather than cutting waste.',
      'Missing that one hung job billed for six hours.',
      'Adding a concurrency group that cancels in-progress runs on `main`, which can cancel a deployment mid-flight.',
    ],
    followUps: [
      'Why should `cancel-in-progress` usually be false on main?',
      'How would you detect this earlier next time?',
    ],
    tags: ['scenario', 'cost', 'optimisation', 'billing', 'advanced'],
  },
  {
    id: 'itv-gha-19',
    level: 'basic',
    kind: 'open',
    prompt: 'What is `GITHUB_TOKEN` and how is it different from a personal access token?',
    probing: 'Authentication basics within Actions.',
    answer: [
      '`GITHUB_TOKEN` is a token **generated automatically for each workflow run** and revoked when the run finishes. It authenticates as a special GitHub App installation scoped to the repository, so it can push commits, create releases, comment on issues and so on - within the permissions you grant it.',
      'A **personal access token** belongs to a human and typically has broader scope, no automatic expiry unless configured, and access to everything that user can reach - often many repositories. If one leaks, the blast radius is that person’s entire access.',
      'The guidance is to **use `GITHUB_TOKEN` whenever possible** and set `permissions` explicitly to the minimum. Reach for a PAT only when you genuinely need cross-repository access, and then prefer a **GitHub App** installation token, which is scoped and short-lived, over a personal token tied to an individual.',
      'One behaviour worth knowing: **pushes made with `GITHUB_TOKEN` do not trigger other workflows**. That is deliberate, to prevent infinite loops - and it surprises people whose release automation commits a version bump expecting CI to run on it.',
    ],
    code: [
      {
        title: 'Scoping the token explicitly',
        language: 'yaml',
        code: `permissions:
  contents: read            # everything else is implicitly none

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # to create a tag and release
      packages: write       # to publish a package
    steps:
      - uses: actions/checkout@v4
      - run: gh release create "v\${{ github.run_number }}"
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`,
      },
    ],
    traps: [
      'Using a personal access token out of habit where `GITHUB_TOKEN` would do.',
      'Expecting a `GITHUB_TOKEN` push to trigger another workflow. It will not.',
      'A PAT tied to one employee, which stops working when they leave.',
    ],
    followUps: ['Why does a GITHUB_TOKEN push not trigger other workflows?'],
    tags: ['github_token', 'authentication', 'permissions', 'fundamentals'],
  },
  {
    id: 'itv-gha-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are environments and deployment protection rules?',
    probing: 'Deployment governance within Actions.',
    answer: [
      'An **environment** is a named deployment target - `staging`, `production` - with its own **secrets**, **variables** and **protection rules**. A job declares `environment: production` and is then subject to that environment’s rules.',
      'The protection rules are what make it useful: **required reviewers** (the job pauses until an approved person approves it, in the GitHub UI), a **wait timer** (a forced delay before deployment, useful as a cooling-off period), and **deployment branch restrictions** (only `main` or only tags matching a pattern may deploy to this environment).',
      'The security benefit is that **production secrets live on the production environment**, not at repository level. A workflow that does not declare `environment: production` cannot read them, even if it runs in the same repository. That means a compromised or careless test workflow cannot reach production credentials.',
      'They also integrate with OIDC: the environment name appears in the token claim, so a cloud role can be configured to trust only tokens issued for the production environment - which have already passed the approval gate.',
    ],
    code: [
      {
        title: 'An environment-gated deployment',
        language: 'yaml',
        code: `jobs:
  deploy-staging:
    environment:
      name: staging
      url: https://staging.example.com
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
        env: { API_KEY: \${{ secrets.API_KEY }} }     # staging's secret

  deploy-production:
    needs: deploy-staging
    environment:
      name: production          # required reviewers configured in settings
      url: https://example.com
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
        env: { API_KEY: \${{ secrets.API_KEY }} }     # production's secret`,
        explanation:
          'The same secret name resolves to a different value per environment, and only after approval.',
      },
    ],
    traps: [
      'Production secrets stored at repository level, readable by every workflow.',
      'No branch restriction, so any branch can deploy to production once approved.',
      'Approval rules that a single person can both request and approve.',
    ],
    followUps: ['How do environments improve on repository-level secrets?'],
    tags: ['environments', 'deployment', 'approval', 'secrets'],
  },
  {
    id: 'itv-gha-21',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you build a complete release pipeline with GitHub Actions?',
    probing:
      'End-to-end design. They want to see build-once-promote, OIDC, environments and verification.',
    answer: [
      'I would build it around **build once, promote by digest**, with environments providing the gates.',
      '**On pull request**: lint, test and build, but publish nothing. Fast feedback, no credentials needed, fork-safe.',
      '**On merge to main**: build the artefact **once**, tag it with the commit SHA, scan it, push it to the registry, and capture the **digest** as a job output. That digest is the thing promoted from here on - never the tag, never a rebuild.',
      '**Deploy to staging** automatically, using OIDC for cloud credentials scoped to a staging role, then run smoke tests against the deployed environment. Failure here stops the pipeline.',
      '**Deploy to production** as a separate job with `environment: production`, which brings required reviewers and branch restrictions, and an OIDC role that only trusts tokens issued for that environment. After deploying, verify - health checks and smoke tests - and **roll back automatically** if verification fails, rather than leaving that to whoever is watching.',
      'Cross-cutting: `concurrency` so two merges cannot deploy simultaneously, `timeout-minutes` on every job, actions pinned by SHA, minimal `permissions`, and a release note generated from the commits between tags so there is a record of what shipped.',
    ],
    code: [
      {
        title: 'The shape of the pipeline',
        language: 'yaml',
        code: `name: Release
on:
  push: { branches: [main] }

concurrency:
  group: release-\${{ github.ref }}
  cancel-in-progress: false          # never cancel a deploy mid-flight

permissions: { contents: read }

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions: { contents: read, packages: write, id-token: write }
    outputs:
      digest: \${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v6
        id: push
        with:
          push: true
          tags: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
      - run: trivy image --severity HIGH,CRITICAL --ignore-unfixed \\
               ghcr.io/\${{ github.repository }}@\${{ steps.push.outputs.digest }}

  staging:
    needs: build
    environment: { name: staging, url: 'https://staging.example.com' }
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-staging
          aws-region: eu-west-1
      - run: ./deploy.sh staging "\${{ needs.build.outputs.digest }}"
      - run: ./smoke-test.sh https://staging.example.com

  production:
    needs: [build, staging]
    environment: { name: production, url: 'https://example.com' }   # requires approval
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-production
          aws-region: eu-west-1
      - run: ./deploy.sh production "\${{ needs.build.outputs.digest }}"
      - run: ./smoke-test.sh https://example.com
      - if: failure()
        run: ./rollback.sh production`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Build once, promote the digest',
        caption:
          'The same digest passes through every environment - nothing is ever rebuilt for production.',
        nodes: [
          { label: 'PR: lint, test, build', detail: 'Publishes nothing', tone: 'accent' },
          { label: 'Merge: build + scan + push once', detail: 'Digest becomes a job output' },
          { label: 'Deploy staging by digest', detail: 'OIDC role: staging' },
          { label: 'Smoke test staging', detail: 'Failure stops here', tone: 'warning' },
          { label: 'Approval gate', detail: 'environment: production' },
          { label: 'Deploy production by digest', detail: 'OIDC role: production' },
          { label: 'Verify, or roll back automatically', tone: 'success' },
        ],
      },
    ],
    deeper: [
      '`cancel-in-progress: false` on the release workflow matters - cancelling a deploy halfway leaves an indeterminate state.',
      'Separate OIDC roles per environment mean a staging deploy physically cannot touch production.',
      'Generate and attach an SBOM and sign the image, then verify the signature at admission, so the registry alone is not a trusted path into production.',
      'For higher-risk services, replace the approval gate with a canary and metric-based automated rollback - a human clicking approve does not actually verify anything.',
    ],
    traps: [
      'Rebuilding for production, which breaks the link between what was tested and what runs.',
      'Deploying a tag rather than a digest.',
      'No rollback step, leaving recovery to whoever happens to be watching.',
      'One OIDC role for all environments.',
    ],
    followUps: [
      'Why promote a digest rather than a tag?',
      'What would you change for a service deploying twenty times a day?',
    ],
    tags: ['release', 'pipeline design', 'oidc', 'environments', 'advanced'],
  },
  {
    id: 'itv-gha-22',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `runs-on: ubuntu-latest` actually give you?',
    probing: 'Runner basics and the implicit-version risk.',
    options: [
      { id: 'a', text: 'A persistent server shared with other jobs in your organisation' },
      {
        id: 'b',
        text: 'A fresh, ephemeral virtual machine with a preinstalled toolchain, destroyed after the job',
      },
      { id: 'c', text: 'A Docker container based on the ubuntu image' },
      { id: 'd', text: 'A reference to a self-hosted runner you must provide' },
    ],
    correct: ['b'],
    answer: [
      'You get a **clean virtual machine** provisioned for that job alone, with a large preinstalled toolchain - several language runtimes, Docker, common CLIs - and it is **destroyed when the job ends**. Nothing persists, and nothing is shared with another job.',
      'That is why each job needs its own `actions/checkout`, why caching exists as a separate mechanism, and why a file written in one job is not present in the next.',
      'The thing to be aware of is that `-latest` **moves**. When GitHub promotes a new Ubuntu version, `ubuntu-latest` starts pointing at it, and builds that depended on a preinstalled tool version can break without any change on your side. Pinning to `ubuntu-24.04` trades automatic updates for reproducibility, which is usually the right trade for a release pipeline.',
    ],
    traps: [
      'Assuming state persists between jobs.',
      '`-latest` moving underneath you and breaking a build with no change on your side.',
    ],
    followUps: ['When would you pin the runner version instead of using -latest?'],
    tags: ['runners', 'fundamentals', 'reproducibility'],
  },
]
