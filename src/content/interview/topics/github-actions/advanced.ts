import type { InterviewQuestion } from '../../../types'

/** The remaining Actions ground: scheduling, packages, testing, and edge cases. */
export const ghaAdvancedQuestions: InterviewQuestion[] = [
  {
    id: 'itv-gha-37',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you schedule a workflow, and what should you know about the timing?',
    probing: 'Scheduled triggers, including the reliability caveat people are caught out by.',
    answer: [
      'The `schedule` trigger takes standard cron syntax, and it always runs in **UTC** - there is no timezone option, so a job scheduled for 09:00 local time drifts by an hour twice a year.',
      'The scheduled run always uses the workflow file and code from the **default branch**, regardless of what else exists. That surprises people testing a scheduled workflow on a feature branch and seeing nothing happen.',
      'Two reliability caveats matter. Scheduled workflows are **best-effort**: during periods of high load on GitHub they can be delayed, sometimes by tens of minutes, so nothing time-critical should depend on exact timing. And on a **public repository with no activity for 60 days**, scheduled workflows are disabled automatically - a repository that goes quiet stops running its nightly security scan without telling anyone.',
      'For that reason I would always pair a `schedule` with `workflow_dispatch`, so the job can be run manually - both for testing and when a scheduled run is missed.',
    ],
    code: [
      {
        title: 'Schedule plus a manual trigger',
        language: 'yaml',
        code: `on:
  schedule:
    - cron: '17 2 * * *'     # 02:17 UTC daily - avoid :00, which is congested
  workflow_dispatch:          # always add this, for testing and reruns

jobs:
  nightly:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/nightly-scan.sh`,
        explanation:
          'An offset minute avoids the top-of-hour spike, which is when delays are worst.',
      },
    ],
    traps: [
      'Assuming local time. Schedules are UTC and do not follow daylight saving.',
      'Testing a scheduled workflow on a branch, where it will never fire.',
      'Relying on exact timing for something that matters.',
    ],
    followUps: ['Why would you avoid scheduling at exactly the top of the hour?'],
    tags: ['schedule', 'cron', 'triggers', 'reliability'],
  },
  {
    id: 'itv-gha-38',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you publish a container image to GitHub Container Registry from a workflow?',
    probing: 'A concrete, very common task - including tagging and multi-platform.',
    answer: [
      'Authenticate with the built-in `GITHUB_TOKEN` (granting `packages: write`), build with `docker/build-push-action`, and generate sensible tags with `docker/metadata-action` rather than constructing them by hand.',
      '`metadata-action` is worth knowing because it produces the right set of tags for the event automatically: a branch name for a branch push, a semver set (`1.4.2`, `1.4`, `1`) for a tag, a SHA tag always, and `latest` only for the default branch. Hand-rolling that logic is where tagging bugs come from.',
      'For multi-platform images, `docker/setup-buildx-action` plus `platforms: linux/amd64,linux/arm64` produces a manifest list under one tag. Cache with `cache-from`/`cache-to` pointed at the GitHub Actions cache, because a fresh runner has no layer cache at all and builds are otherwise slow every time.',
      'The output to capture is the **digest**, because that is what downstream jobs should deploy - not the tag.',
    ],
    code: [
      {
        title: 'Build, tag and push to GHCR',
        language: 'yaml',
        code: `jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      digest: \${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/\${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,format=long
            type=raw,value=latest,enable={{is_default_branch}}

      - uses: docker/build-push-action@v6
        id: push
        with:
          push: true
          platforms: linux/amd64,linux/arm64
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max`,
      },
    ],
    traps: [
      'Forgetting `packages: write`, which fails with an unhelpful authentication error.',
      'Tagging `latest` from every branch, so `latest` means nothing.',
      'No layer caching, so every build starts from scratch.',
    ],
    followUps: ['Why capture the digest rather than using the tag downstream?'],
    tags: ['ghcr', 'docker', 'publishing', 'tagging'],
  },
  {
    id: 'itv-gha-39',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'A step needs the output of an earlier step in the same job. How do you pass it?',
    probing: 'Step-level data flow, distinct from job-level.',
    options: [
      { id: 'a', text: 'Set a shell variable with `export` - it persists across steps' },
      {
        id: 'b',
        text: 'Write to `$GITHUB_OUTPUT` with an `id` on the step, then read `steps.<id>.outputs.<name>`',
      },
      { id: 'c', text: 'Upload it as an artifact and download it in the next step' },
      { id: 'd', text: 'Use a global variable in the workflow file' },
    ],
    correct: ['b'],
    answer: [
      'Each `run` step is a **separate shell process**, so `export` does not survive to the next step. The mechanism is to append `name=value` to the file at `$GITHUB_OUTPUT`, give the step an `id`, and read it as `steps.<id>.outputs.<name>`.',
      '`$GITHUB_ENV` is the related mechanism and does something slightly different: it sets an **environment variable** for all *subsequent* steps, rather than a named output. Use `GITHUB_OUTPUT` when you want to reference the value explicitly by step; use `GITHUB_ENV` when you want it in the environment of everything that follows.',
      'For **multi-line** values you need the delimiter form, because a plain `name=value` line cannot express a newline. Getting this wrong silently truncates at the first line.',
    ],
    code: [
      {
        title: 'Single-line and multi-line outputs',
        language: 'yaml',
        code: `- id: version
  run: echo "value=$(cat VERSION)" >> "$GITHUB_OUTPUT"

- id: notes
  run: |
    # Multi-line needs a random delimiter
    {
      echo "body<<EOF_NOTES"
      git log --oneline "$(git describe --tags --abbrev=0)"..HEAD
      echo "EOF_NOTES"
    } >> "$GITHUB_OUTPUT"

- run: |
    echo "version: \${{ steps.version.outputs.value }}"
    echo "notes:   \${{ steps.notes.outputs.body }}"`,
      },
    ],
    traps: [
      'Using `export` and finding the variable gone in the next step.',
      'A multi-line value without the delimiter form, silently truncated.',
      'Forgetting the `id`, which makes the output unreferenceable.',
    ],
    followUps: ['When would you use `$GITHUB_ENV` instead?'],
    tags: ['outputs', 'steps', 'syntax', 'data flow'],
  },
  {
    id: 'itv-gha-40',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you test changes to a workflow without spamming the repository with commits?',
    probing: 'Everyone has pushed "fix ci" fifteen times. The good answer has a real method.',
    answer: [
      'The honest starting point is that workflows are **hard to test** because they only really run in GitHub’s environment, and that is a genuine weakness of the model. But there are several things that cut the cycle substantially.',
      '**`act`** runs workflows locally in Docker. It is not a perfect emulation - some actions, some contexts and anything GitHub-hosted behaves differently - but it catches syntax errors, obvious logic mistakes and most shell problems in seconds rather than minutes.',
      '**Validate the YAML and the schema** before pushing: `actionlint` catches invalid expressions, unknown contexts, shellcheck problems inside `run` blocks and a lot more. Running it as a pre-commit hook removes a whole category of failed runs.',
      '**Use `workflow_dispatch` with inputs** so you can trigger a workflow manually from any branch with different parameters, instead of pushing commits to trigger it. Combined with a scratch branch, that gives a reasonable iteration loop.',
      '**Squash afterwards**. Iterating with many small commits on a scratch branch is fine; what matters is that the history that lands on main is clean. And for shared workflows, having a dedicated **test repository** to validate changes before tagging a release avoids experimenting on repositories other people depend on.',
    ],
    code: [
      {
        title: 'Lint locally, then run locally',
        language: 'bash',
        code: `# Static checks - catches most mistakes without running anything
actionlint                      # expressions, contexts, shellcheck in run blocks

# Run the workflow locally in Docker
act push -j build
act workflow_dispatch -j deploy --input environment=staging

# Pre-commit hook so a broken workflow never gets pushed
cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
set -e
actionlint
HOOK
chmod +x .git/hooks/pre-commit`,
      },
      {
        title: 'workflow_dispatch inputs for manual iteration',
        language: 'yaml',
        code: `on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        default: staging
      dry-run:
        type: boolean
        default: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh "\${{ inputs.environment }}" \\
               \${{ inputs.dry-run && '--dry-run' || '' }}`,
      },
    ],
    traps: [
      'Trusting `act` completely - it differs from the hosted runners in ways that matter.',
      'Testing a workflow change on a branch when the trigger only fires on main.',
      'Leaving a scratch workflow behind after the experiment.',
    ],
    followUps: [
      'What does `act` not reproduce accurately?',
      'How would you test a change to a workflow that twenty repositories depend on?',
    ],
    tags: ['testing', 'act', 'actionlint', 'developer experience', 'advanced'],
  },
  {
    id: 'itv-gha-41',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is `workflow_run` and when would you use it?',
    probing: 'Chaining workflows, which has a specific security purpose.',
    answer: [
      '`workflow_run` triggers one workflow when another **completes**. The triggered workflow runs from the **default branch**, with access to secrets, regardless of which branch the first one ran on.',
      'That property is the point. The standard use is handling pull requests from forks safely: the first workflow runs on `pull_request` with no secrets and builds the untrusted code; the second is triggered by `workflow_run`, has secrets and write access, and does the privileged part - posting a comment, publishing coverage, updating a status - **without ever executing the fork’s code**.',
      'It is also used for genuine pipeline chaining: a build workflow completing successfully triggers a deploy workflow, keeping the two concerns in separate files with separate permissions.',
      "The details to get right: check `github.event.workflow_run.conclusion == 'success'` because it fires on failure too, and download artifacts from the triggering run explicitly - the second workflow starts on a fresh runner with nothing from the first.",
    ],
    code: [
      {
        title: 'Privileged follow-up to an untrusted build',
        language: 'yaml',
        code: `name: PR comment
on:
  workflow_run:
    workflows: ["CI"]           # the name: of the first workflow
    types: [completed]

permissions:
  pull-requests: write

jobs:
  comment:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      # Data only - never check out or execute the fork's code
      - uses: actions/download-artifact@v4
        with:
          name: coverage
          run-id: \${{ github.event.workflow_run.id }}
          github-token: \${{ secrets.GITHUB_TOKEN }}
      - run: gh pr comment "$PR" --body-file coverage.md
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          PR: \${{ github.event.workflow_run.pull_requests[0].number }}`,
      },
    ],
    traps: [
      'Forgetting to check `conclusion`, so the follow-up runs after failures too.',
      'Checking out the PR code in the `workflow_run` job, which reintroduces the exact risk it was avoiding.',
      'Expecting the workflow file from the PR branch to be used - it is always the default branch.',
    ],
    followUps: ['Why is `workflow_run` safer than `pull_request_target` for this?'],
    tags: ['workflow_run', 'security', 'forks', 'chaining'],
  },
  {
    id: 'itv-gha-42',
    level: 'basic',
    kind: 'open',
    prompt: 'What does `actions/checkout` do, and why is it needed in every job?',
    probing: 'The most-used action, and the most common first-workflow mistake.',
    answer: [
      'A runner starts as an **empty machine**. It has the toolchain preinstalled but not your code. `actions/checkout` clones the repository into the workspace, authenticated with the `GITHUB_TOKEN`, at the commit that triggered the run.',
      'It is needed in **every job** because each job gets a fresh runner. Checking out in job one does nothing for job two.',
      'Its defaults are optimised for speed and occasionally surprise people: it fetches a **shallow clone** (`fetch-depth: 1`) of a **single branch**, and it does **not** fetch submodules. So anything that needs git history - `git describe`, a changelog from commits, a diff against the base branch, tag-derived versioning - needs `fetch-depth: 0`, and submodules need to be requested explicitly.',
    ],
    code: [
      {
        title: 'The options worth knowing',
        language: 'yaml',
        code: `- uses: actions/checkout@v4
  with:
    fetch-depth: 0          # full history: tags, git describe, base-branch diffs
    submodules: recursive   # not fetched by default
    ref: \${{ github.event.pull_request.head.sha }}   # a specific commit
    path: app               # check out into a subdirectory
    persist-credentials: false   # do not leave the token in .git/config`,
      },
    ],
    traps: [
      'Omitting it entirely and getting "no such file or directory" on the first command.',
      'Shallow clone breaking `git describe` or a changed-files diff.',
      'Leaving `persist-credentials` on when the job runs untrusted code, which leaves a usable token in `.git/config`.',
    ],
    followUps: ['Why would you set `persist-credentials: false`?'],
    tags: ['checkout', 'git', 'fundamentals'],
  },
  {
    id: 'itv-gha-43',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A contributor reports that CI passes on their fork but fails on the pull request. What is going on?',
    probing: 'Understanding the fork permission model from the symptom end.',
    answer: [
      'The almost-certain cause is **secrets**. On a pull request from a fork, GitHub deliberately withholds repository secrets and issues a **read-only** `GITHUB_TOKEN`. On the contributor’s own fork, the workflow runs with *their* repository’s secrets - which for a personal fork usually means none configured, but the workflow may be taking a different path as a result.',
      'So any step that needs a credential - pushing an image, uploading coverage to a third-party service, deploying a preview environment, commenting on the pull request - fails on the PR and may have been skipped or succeeded differently on the fork.',
      'It can also be **permissions** rather than secrets: a step that writes a comment or a check needs `pull-requests: write`, and the fork PR token is read-only no matter what the workflow declares.',
      'The fix is to **separate the untrusted from the privileged**. The `pull_request` workflow builds and tests with no credentials - and any step needing one is guarded with a condition so it is skipped rather than failing. The privileged follow-up runs via `workflow_run` afterwards, on the default branch with secrets, consuming only **artifacts** from the first run and never executing the fork’s code.',
      'What I would not do is switch to `pull_request_target` to "give it secrets". That is the pattern that has been repeatedly exploited, and it turns an inconvenience into a repository compromise.',
    ],
    code: [
      {
        title: 'Skip cleanly rather than fail, then do privileged work separately',
        language: 'yaml',
        code: `name: CI
on: pull_request

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test          # needs nothing privileged

      # Fork PRs have no secrets - skip, do not fail
      - if: github.event.pull_request.head.repo.full_name == github.repository
        run: ./upload-coverage.sh
        env: { TOKEN: \${{ secrets.COVERAGE_TOKEN }} }

      # Always produce the artifact so the privileged workflow can use it
      - uses: actions/upload-artifact@v4
        with: { name: coverage, path: coverage/ }`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Untrusted build, privileged follow-up',
        caption:
          'The privileged half never sees the fork’s code - only the files the first half produced.',
        nodes: [
          { label: 'Fork opens a pull request', tone: 'accent' },
          { label: 'pull_request workflow runs', detail: 'No secrets, read-only token' },
          { label: 'Build and test the fork code', detail: 'Untrusted, unprivileged' },
          { label: 'Upload artifact', detail: 'Data only, no execution' },
          { label: 'workflow_run fires', detail: 'Default branch, has secrets', tone: 'warning' },
          {
            label: 'Comment, publish, update status',
            detail: 'Never runs fork code',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'GitHub requires approval before running workflows for first-time contributors, which is worth leaving on - it also prevents fork PRs being used to mine your runner minutes.',
      'Artifacts are a safe channel between the two halves because they are data. Scripts from the fork are not.',
      'Tell contributors what to expect. "Some checks are skipped on fork PRs and a maintainer will run them" avoids a lot of confused issues.',
    ],
    traps: [
      'Switching to `pull_request_target` to get secrets - the known-exploited pattern.',
      'Steps that fail rather than skip when a secret is absent, making every fork PR look broken.',
      'Assuming the contributor did something wrong when it is the permission model working as intended.',
    ],
    followUps: [
      'Why does GitHub withhold secrets from fork pull requests at all?',
      'How would you let a maintainer run the full suite after reviewing the diff?',
    ],
    tags: ['scenario', 'forks', 'security', 'permissions', 'troubleshooting'],
  },
  {
    id: 'itv-gha-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you publish a versioned release automatically when a tag is pushed?',
    probing: 'Release automation end to end.',
    answer: [
      'Trigger on `push` with a `tags` filter, so the workflow only runs for version tags. The tag itself becomes the version, which keeps a single source of truth.',
      'The steps are: check out with full history (needed to generate notes from commits since the previous tag), build and test, build the artefacts for every target you ship, generate release notes, and create the GitHub release with the artefacts attached.',
      'The details that make it robust: check that the tag matches the expected pattern rather than assuming, mark pre-release tags (`v1.2.0-rc.1`) as prereleases, and make the build **reproducible from the tag** so the release can be rebuilt if needed.',
      'If the package also goes to a registry - npm, PyPI, a container registry - publish from the same workflow using OIDC or trusted publishing rather than a long-lived token, so no publishing credential is stored.',
    ],
    code: [
      {
        title: 'Tag-triggered release',
        language: 'yaml',
        code: `name: Release
on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write            # to create the release

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }      # needed for notes since the last tag

      - run: make test
      - run: make build VERSION="\${GITHUB_REF_NAME#v}"

      - name: Generate notes
        id: notes
        run: |
          PREV=$(git describe --tags --abbrev=0 "\${GITHUB_REF_NAME}^" 2>/dev/null || echo "")
          {
            echo "body<<EOF_NOTES"
            if [ -n "$PREV" ]; then
              git log --pretty='- %s (%h)' "$PREV..\${GITHUB_REF_NAME}"
            else
              git log --pretty='- %s (%h)'
            fi
            echo "EOF_NOTES"
          } >> "$GITHUB_OUTPUT"

      - uses: softprops/action-gh-release@v2
        with:
          body: \${{ steps.notes.outputs.body }}
          prerelease: \${{ contains(github.ref_name, '-') }}
          files: dist/*`,
      },
    ],
    traps: [
      'Shallow checkout, so there is no previous tag to generate notes from.',
      'Treating `v1.2.0-rc.1` as a full release.',
      'A long-lived publishing token where OIDC or trusted publishing is available.',
    ],
    followUps: [
      'How would you handle a release that needs to be rebuilt identically months later?',
    ],
    tags: ['release', 'tags', 'automation', 'versioning'],
  },
  {
    id: 'itv-gha-45',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these are real limitations of GitHub Actions worth knowing before you commit to it? Select all that apply.',
    probing: 'Whether you know the edges of the tool, not just its happy path.',
    options: [
      {
        id: 'a',
        text: 'A job has a maximum runtime (6 hours) and a workflow run a maximum of 35 days',
      },
      {
        id: 'b',
        text: 'There is no built-in way to share state between jobs other than artifacts and outputs',
      },
      {
        id: 'c',
        text: 'Scheduled workflows are best-effort and can be delayed or disabled on inactive public repositories',
      },
      { id: 'd', text: 'Workflows cannot run shell scripts' },
      {
        id: 'e',
        text: 'Organisation-wide reporting across repositories is weak compared with a central CI server',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Workflows obviously can run shell scripts - that is what `run:` is. The rest are genuine constraints worth knowing before you build on it.',
      'The **6-hour job limit** rules out some long-running builds and test suites outright, and the limit is per job so splitting helps only if the work divides. **No shared state** between jobs beyond artifacts and outputs means anything stateful needs deliberate design.',
      '**Scheduled workflows** being best-effort matters for anything you were treating as a cron replacement, and the auto-disable on inactive public repositories has silently stopped many nightly security scans.',
      '**Organisation-wide reporting** is the one that bites at scale. Actions is repository-centric; answering "how long do our builds take across 200 repositories" requires pulling the API yourself, where a central Jenkins gives you one view.',
      'None of these are reasons to avoid Actions - they are things to know so you are not surprised by them at a bad moment.',
    ],
    deeper: [
      'Concurrent job limits vary by plan and are a real constraint for large organisations at peak times.',
      'API rate limits apply to the `GITHUB_TOKEN`, which matters for workflows that make many API calls in a loop.',
      'Artifact and cache storage is billed and has retention limits, so unbounded uploads become a cost problem.',
    ],
    traps: [
      'Discovering the 6-hour limit when a nightly job starts timing out at 5h55m.',
      'Treating `schedule` as a reliable cron for anything time-critical.',
      'Assuming you will get Jenkins-style cross-project dashboards.',
    ],
    followUps: ['How would you handle a test suite that genuinely takes eight hours?'],
    tags: ['limitations', 'scale', 'planning', 'advanced'],
  },
  {
    id: 'itv-gha-46',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you run a job in a container rather than directly on the runner?',
    probing: 'Container jobs and service containers - useful for integration testing.',
    answer: [
      '`container:` on a job runs **every step inside that image** instead of directly on the runner VM. That gives you an exact, pinned environment - the same image your application runs in, or a build image with an unusual toolchain - rather than depending on whatever `ubuntu-latest` happens to have installed.',
      '`services:` starts **additional containers** alongside the job on the same network, which is how you get a real database or message broker for integration tests. The service is addressable by its label as a hostname when the job itself runs in a container.',
      'The networking detail catches people out. When the **job runs in a container**, services are reachable by **name** on their normal port (`postgres:5432`). When the **job runs directly on the runner**, services are reachable on **`localhost` via a mapped port**, which you have to declare with `ports:`. Getting this backwards produces connection refused errors that look mysterious.',
      'Service containers also need a `health-cmd`, or the job starts before the database is ready and the first test fails intermittently.',
    ],
    code: [
      {
        title: 'Container job with a real database service',
        language: 'yaml',
        code: `jobs:
  integration:
    runs-on: ubuntu-latest
    container:
      image: python:3.12-slim        # every step runs in here
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        options: >-
          --health-cmd="pg_isready -U postgres"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=10
    env:
      # Job is in a container, so the service is reachable BY NAME
      DATABASE_URL: postgres://postgres:test@postgres:5432/testdb
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: pytest tests/integration`,
      },
    ],
    traps: [
      'Using `localhost` for a service when the job runs in a container - it is the container itself.',
      'No health check, producing tests that fail intermittently on a slow database start.',
      'A container image missing `git` or `node`, which some actions require to run.',
    ],
    followUps: [
      'Why does the service hostname differ depending on whether the job is containerised?',
    ],
    tags: ['containers', 'services', 'integration testing', 'networking'],
  },
  {
    id: 'itv-gha-47',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What happens to a workflow run if a step fails partway through a job?',
    probing: 'Default failure semantics.',
    options: [
      {
        id: 'a',
        text: 'Remaining steps in that job are skipped and the job fails, unless a step has `continue-on-error` or an `if` condition that still matches',
      },
      { id: 'b', text: 'All remaining steps run anyway and the job is marked unstable' },
      { id: 'c', text: 'The whole workflow stops immediately, including other jobs' },
      { id: 'd', text: 'The step retries automatically three times' },
    ],
    correct: ['a'],
    answer: [
      'A failed step fails the job, and remaining steps are **skipped** - because every step carries an implicit `if: success()`. Steps with `if: always()` or `if: failure()` still run, which is how cleanup and diagnostics work.',
      'Other **jobs** are not stopped. Independent jobs continue; jobs that `needs` the failed one are skipped. The workflow run as a whole is marked failed.',
      '`continue-on-error: true` on a step lets the job carry on despite that step failing, which is right for a non-blocking check. On a **job**, the same setting means the job’s failure does not fail the workflow - useful for an experimental matrix entry.',
      'There is no automatic retry. If you want one, it is an explicit loop in the script or a retry action.',
    ],
    code: [
      {
        title: 'Non-blocking step and explicit retry',
        language: 'yaml',
        code: `- name: Optional lint
  continue-on-error: true
  run: make lint-experimental

- name: Flaky external call, retried explicitly
  run: |
    for attempt in 1 2 3; do
      ./call-external-api.sh && exit 0
      echo "attempt $attempt failed, retrying"
      sleep $(( attempt * 5 ))
    done
    exit 1

- name: Always collect logs
  if: always()
  run: ./collect-logs.sh`,
      },
    ],
    traps: [
      '`continue-on-error` on a step that actually matters, hiding a real failure.',
      'Assuming a failed job stops other independent jobs. It does not.',
      'Expecting automatic retries.',
    ],
    followUps: ['What is the difference between `continue-on-error` on a step and on a job?'],
    tags: ['failure', 'control flow', 'continue-on-error', 'fundamentals'],
  },
  {
    id: 'itv-gha-48',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you enforce standards - required scans, approved actions, branch protection - across an entire organisation?',
    probing:
      'Governance at scale. Per-repository configuration does not survive contact with fifty teams.',
    answer: [
      'The principle is that anything enforced by convention will drift, so the controls have to be **configured centrally and be hard to bypass**.',
      '**Organisation-level Actions policy** is the first lever: restrict which actions may run to GitHub-verified plus an explicit allow-list, and set the default `GITHUB_TOKEN` permissions to read-only organisation-wide. Both are single settings that apply everywhere.',
      '**Rulesets** (the successor to branch protection) can be defined at organisation level and applied across repositories by pattern - required status checks, required reviews, signed commits, no force pushes - rather than configuring each repository individually.',
      '**Required workflows** let the organisation inject a workflow that runs on repositories regardless of what their own workflows do, which is how you guarantee a security scan actually runs rather than hoping each repository added it.',
      '**Reusable workflows** provide the carrot alongside the stick: if the organisation’s standard pipeline is genuinely good and takes nine lines to adopt, teams use it because it is easier than writing their own. Enforcement and convenience together work far better than enforcement alone.',
      'And **measure compliance** rather than assuming it. A scheduled job that queries every repository for whether it uses the standard workflow, has the required rules, and is pinning actions gives you a real picture - and tells you which teams need help rather than which need a reminder.',
    ],
    code: [
      {
        title: 'Audit compliance across the organisation',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail
ORG=myorg

gh api --paginate "orgs/$ORG/repos" --jq '.[] | select(.archived == false) | .name' |
while read -r repo; do
  uses_standard=no
  if gh api "repos/$ORG/$repo/contents/.github/workflows" --jq '.[].name' 2>/dev/null |
     while read -r wf; do
       gh api "repos/$ORG/$repo/contents/.github/workflows/$wf" --jq '.content' |
         base64 -d | grep -q 'ci-workflows/.github/workflows/standard-build.yml' && exit 0
     done; then uses_standard=yes; fi

  protected=$(gh api "repos/$ORG/$repo/branches/main/protection" >/dev/null 2>&1 \\
              && echo yes || echo no)

  printf '%-40s standard=%-3s protected=%s\\n' "$repo" "$uses_standard" "$protected"
done`,
      },
    ],
    deeper: [
      'Setting the default `GITHUB_TOKEN` permissions to read-only at organisation level is one of the highest-value single changes available - it makes every workflow least-privilege by default.',
      'Required workflows are the only mechanism that guarantees something runs regardless of repository content.',
      'Roll changes out in report-only mode first. Turning on a required check across 200 repositories simultaneously blocks every open pull request.',
      'Publish the standard and make adopting it easy. Governance that is purely restrictive gets routed around.',
    ],
    traps: [
      'Relying on documentation and review to enforce standards.',
      'Enabling a required check everywhere at once and blocking all merges.',
      'Restricting actions so tightly that teams cannot work, which drives shadow processes.',
    ],
    followUps: [
      'How would you roll out a new required scan without blocking every team on day one?',
      'What single organisation-level setting would you change first?',
    ],
    tags: ['governance', 'organisation', 'security', 'policy', 'advanced'],
  },
  {
    id: 'itv-gha-49',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle a workflow that needs to commit back to the repository?',
    probing: 'A common need - version bumps, generated files - with several sharp edges.',
    answer: [
      'You need `contents: write` permission and a git identity, then commit and push as normal using the `GITHUB_TOKEN`.',
      'The first sharp edge is that a push made with `GITHUB_TOKEN` **does not trigger other workflows**. That is deliberate loop prevention, and it surprises people whose version-bump commit is expected to trigger a release build. The workarounds are to do the follow-up work in the same workflow, or to use a GitHub App token (not a personal token, which ties the automation to an individual).',
      'The second is **race conditions**. Two runs bumping a version concurrently will conflict, and the second push fails. A `concurrency` group prevents that, and pulling with rebase before pushing handles the rest.',
      'The third is **loops**. If your workflow commits and the commit triggers the workflow, you have an infinite loop. Guard with `paths-ignore`, a `[skip ci]` marker, or a condition on the actor - and be aware that the `GITHUB_TOKEN` behaviour above already prevents this in the common case, which is easy to forget when you switch to an App token and suddenly have a loop.',
      'And before reaching for any of this: committing generated files is often worth avoiding entirely. Generating them at build time removes the whole problem.',
    ],
    code: [
      {
        title: 'Commit back safely',
        language: 'yaml',
        code: `permissions:
  contents: write

concurrency:
  group: bump-\${{ github.ref }}     # never two bumps at once
  cancel-in-progress: false

jobs:
  bump:
    if: github.actor != 'github-actions[bot]'    # do not react to our own commit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/bump-version.sh
      - run: |
          git config user.name  'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          if git diff --quiet; then
            echo "nothing to commit"; exit 0
          fi
          git add -A
          git commit -m 'chore: bump version [skip ci]'
          git pull --rebase
          git push`,
      },
    ],
    traps: [
      'Expecting the pushed commit to trigger CI - with `GITHUB_TOKEN` it will not.',
      'An infinite loop after switching to an App token, which does trigger workflows.',
      'Concurrent runs racing to push.',
      'Committing without checking whether anything actually changed, producing empty-commit noise.',
    ],
    followUps: [
      'Why does a GITHUB_TOKEN push not trigger workflows, and when is that a problem?',
      'How would you avoid needing to commit generated files at all?',
    ],
    tags: ['git', 'automation', 'permissions', 'concurrency'],
  },
  {
    id: 'itv-gha-50',
    level: 'basic',
    kind: 'open',
    prompt:
      'What is the GitHub Actions marketplace, and how should you evaluate an action before using it?',
    probing: 'Judgement about third-party code, phrased for a beginner.',
    answer: [
      'The marketplace is a directory of published actions - reusable units of behaviour anyone can write and share. Using one is convenient, and it is also **running someone else’s code in your pipeline with access to your repository and whatever secrets that job has**.',
      'What I would check before adopting one: **who publishes it** (a verified organisation, or an individual account with three repositories?), **how actively it is maintained** (recent commits, open issues being answered), **how widely it is used**, and **what it actually does** - reading the source is reasonable for anything that touches credentials.',
      'Then I would ask whether it is **needed at all**. A great many marketplace actions wrap two lines of shell. `run: aws s3 cp ...` has no supply-chain risk, no version to track and no surprises; an action that does the same thing has all three.',
      'If I do use one, I pin it to a **full commit SHA** so the code cannot change underneath me, and let Dependabot propose updates.',
    ],
    traps: [
      'Adopting an action because it is the first search result.',
      'Pinning to a tag and assuming it is immutable.',
      'Using a third-party action for something a one-line shell command does.',
    ],
    followUps: ['What could a malicious action do in a job that has secrets?'],
    tags: ['marketplace', 'security', 'third-party', 'fundamentals'],
  },
]
