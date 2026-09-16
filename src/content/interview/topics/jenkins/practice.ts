import type { InterviewQuestion } from '../../../types'

/** CI/CD practice questions asked in a Jenkins round: branching, testing, releases. */
export const jenkinsPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-jenkins-38',
    level: 'basic',
    kind: 'open',
    prompt: 'What makes a good CI pipeline? What stages would you expect to see?',
    probing: 'Whether you have a mental model of a pipeline rather than a list of tools.',
    answer: [
      'The organising principle is **fail fast and cheap**. Put the quickest checks first so a broken commit is rejected in seconds rather than after a twenty-minute build, and order everything by how long it takes against how likely it is to catch something.',
      'A typical order: **checkout**, **dependency install with caching**, **lint and static analysis**, **unit tests**, **build the artefact**, **security and dependency scanning**, **integration tests**, **publish the artefact**, then **deploy to a non-production environment and smoke test**.',
      'Beyond the stages, the properties that make it good are: **fast** (single-digit minutes for the feedback loop), **reliable** (a red build means something is genuinely wrong - no flakiness), **reproducible** (the same commit produces the same result), and **build once** (one artefact, promoted through environments, never rebuilt per environment).',
      'That last point is the one people miss. Rebuilding for each environment means the thing you tested is not the thing you shipped.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Cheap checks first',
        caption: 'Each stage is slower and more expensive than the one before it.',
        nodes: [
          { label: 'Checkout + restore cache', detail: 'seconds', tone: 'accent' },
          { label: 'Lint + static analysis', detail: 'under a minute' },
          { label: 'Unit tests', detail: 'a few minutes' },
          { label: 'Build artefact once', detail: 'tagged by commit SHA' },
          {
            label: 'Security + dependency scan',
            detail: 'fail on fixable high/critical',
            tone: 'warning',
          },
          { label: 'Integration tests', detail: 'slowest, needs real dependencies' },
          {
            label: 'Publish + deploy to staging',
            detail: 'promote the same digest',
            tone: 'success',
          },
        ],
      },
    ],
    traps: [
      'Running the slowest tests first, so every failure costs twenty minutes.',
      'Rebuilding the artefact for each environment.',
      'Tolerating flaky tests until nobody trusts a red build.',
    ],
    followUps: ['Why is "build once, promote the artefact" important?'],
    tags: ['ci', 'pipeline design', 'fundamentals'],
  },
  {
    id: 'itv-jenkins-39',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Compare blue/green, canary and rolling deployments. When would you pick each?',
    probing: 'Release strategy. The trade-offs are cost, blast radius and rollback speed.',
    answer: [
      '**Rolling** replaces instances gradually - some old, some new, serving simultaneously. It needs no extra capacity beyond one instance and is the Kubernetes default. The downsides are that rollback is another rolling update (so it is slow), and both versions serve traffic at once, which requires backward compatibility.',
      '**Blue/green** runs two complete environments and switches traffic all at once. Rollback is instant - switch back - and only one version ever serves traffic. The cost is **double the infrastructure** during the deploy, and a shared database still has to be compatible with both.',
      '**Canary** sends a small percentage of traffic to the new version, watches metrics, and increases gradually. The blast radius of a bad release is limited to that percentage, and with automated metric analysis the rollback can be automatic. The cost is complexity: you need traffic splitting and you need metrics good enough to decide on.',
      'How I would pick: **rolling** as the sensible default for most services. **Blue/green** when rollback speed is critical and the cost of double capacity is acceptable - or for a big migration you want to be able to abandon instantly. **Canary** for high-traffic, high-risk services where you have the observability to make the decision automatically. And for anything with a database change, the deployment strategy matters far less than making the schema change backward compatible.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which release strategy?',
        caption: 'Rollback speed and blast radius are what you are really choosing between.',
        question: 'What matters most for this service?',
        branches: [
          {
            condition: 'Simplicity, limited spare capacity',
            result: 'Rolling',
            detail: 'The default; needs backward compatibility',
            tone: 'success',
          },
          {
            condition: 'Instant rollback, cost acceptable',
            result: 'Blue/green',
            detail: 'Double capacity during the switch',
            tone: 'accent',
          },
          {
            condition: 'High traffic, good metrics, high risk',
            result: 'Canary with automated analysis',
            detail: 'Smallest blast radius',
            tone: 'accent',
          },
          {
            condition: 'Incompatible schema change',
            result: 'None of them save you',
            detail: 'Expand/contract the schema first',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Feature flags decouple deploy from release: ship the code dark, enable it for a cohort, and turn it off without a deployment at all.',
      'Expand/contract migrations - add the new column, write both, backfill, switch reads, then remove the old - are what make any of these safe with a database.',
      'Canary needs a decision rule defined in advance. "Watch the dashboard for ten minutes" is not a strategy; error rate and latency thresholds are.',
    ],
    traps: [
      'Blue/green with a shared database and an incompatible schema, which makes the "instant rollback" impossible.',
      'Canary without metrics good enough to decide on.',
      'Assuming rolling gives you fast rollback. It gives you another rolling update.',
    ],
    followUps: [
      'How does a database migration change your answer?',
      'What is the fastest possible rollback for each strategy?',
    ],
    tags: ['deployment', 'release strategy', 'canary', 'blue green'],
  },
  {
    id: 'itv-jenkins-40',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle database migrations in a CI/CD pipeline?',
    probing:
      'One of the hardest parts of real continuous delivery, and where most pipelines are weakest.',
    answer: [
      'The core problem is that **code deploys can be rolled back and schema changes usually cannot**. During a rolling deploy, old and new application versions run simultaneously against one database, so the schema must be compatible with both.',
      'The technique is **expand/contract**, in separate releases. To rename a column: release one **adds** the new column and writes to both; release two **backfills** existing rows; release three **switches reads** to the new column; release four **drops** the old one. At every point, rolling back one release leaves a working system.',
      'In the pipeline, migrations run as a **separate step before** the new application version starts - as a Kubernetes Job or an init step - and must be **idempotent** so a retry is safe. They should never run concurrently from multiple replicas, which means a Job rather than an init container, or an advisory lock.',
      'And they need the same rigour as code: migrations reviewed in pull requests, tested against a copy of production-sized data (a migration that locks a table for eight minutes on 200 million rows passes instantly against an empty test database), and with an explicit plan for what happens if one fails halfway.',
    ],
    code: [
      {
        title: 'Expand/contract, one release at a time',
        language: 'text',
        code: `Release 1 (expand)
  - ALTER TABLE users ADD COLUMN email_address text;   -- nullable, no default
  - App writes BOTH email and email_address
  - App reads email
  -> rollback safe: old app ignores the new column

Release 2 (backfill)
  - Batched UPDATE, in chunks, off-peak
  -> rollback safe: no behaviour change

Release 3 (switch reads)
  - App reads email_address, still writes both
  -> rollback safe: both columns populated

Release 4 (contract)
  - App writes only email_address
  - ALTER TABLE users DROP COLUMN email;
  -> only now is the old column gone, long after the risky part`,
      },
      {
        title: 'Migration as a gated Job, before the rollout',
        language: 'text',
        code: `stage('Migrate') {
  steps {
    // One place runs it, not every replica
    sh 'kubectl apply -f k8s/migration-job.yaml'
    sh 'kubectl wait --for=condition=complete job/migrate-$BUILD_NUMBER -n prod --timeout=10m'
  }
  post {
    failure {
      sh 'kubectl logs job/migrate-$BUILD_NUMBER -n prod'
      error('Migration failed - not deploying the application')
    }
  }
}

stage('Deploy app') {
  steps { sh 'kubectl set image deployment/api api=$IMAGE_DIGEST -n prod' }
}`,
      },
    ],
    deeper: [
      'Test migrations against production-sized data. Lock duration is a function of row count, and an empty test database tells you nothing about it.',
      'Avoid long-held locks: add columns as nullable without defaults, create indexes concurrently, and backfill in batches.',
      'A migration that fails halfway needs a defined recovery. Idempotency plus small, single-purpose migrations make that tractable.',
      'Some changes genuinely need a maintenance window. Saying so is better than pretending otherwise and causing an outage.',
    ],
    traps: [
      'A single migration that renames a column, breaking the old version instantly during a rolling deploy.',
      'Migrations run from every replica simultaneously.',
      'Testing only against an empty database.',
      'Assuming a code rollback undoes the schema change.',
    ],
    followUps: [
      'The migration succeeded but the deploy failed. What is the state and what do you do?',
      'How would you rename a column with zero downtime?',
    ],
    tags: ['database', 'migrations', 'deployment', 'production', 'zero downtime'],
  },
  {
    id: 'itv-jenkins-41',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is the main problem with long-lived feature branches?',
    probing: 'Branching strategy and its relationship to CI.',
    options: [
      { id: 'a', text: 'They use too much disk space on the git server' },
      {
        id: 'b',
        text: 'Integration problems are discovered late and all at once, which is the opposite of continuous integration',
      },
      { id: 'c', text: 'Git cannot merge branches older than two weeks' },
      { id: 'd', text: 'CI systems cannot build non-main branches' },
    ],
    correct: ['b'],
    answer: [
      'The cost of a long-lived branch is **deferred integration**. Everyone is working against a shared codebase that is diverging from what they have; the conflicts, semantic incompatibilities and duplicated work all surface at merge time, in one painful lump.',
      'That is precisely what continuous integration is meant to prevent. "Continuous" means merging to a shared branch at least daily, so divergence never grows large enough to be a problem. A team with three-week feature branches is not doing CI regardless of what their build server is called.',
      'The alternative for large changes is **trunk-based development with feature flags**: merge small, incomplete pieces continuously behind a flag that keeps them inactive, and enable the flag when the feature is complete. You get integration feedback daily and still control when users see the change.',
    ],
    traps: [
      'Calling it CI because there is a build server, while branches live for weeks.',
      'Feature flags that are never removed, leaving a codebase of dead conditionals.',
    ],
    followUps: ['How would you ship a three-month feature without a long-lived branch?'],
    tags: ['branching', 'trunk based', 'ci', 'feature flags'],
  },
  {
    id: 'itv-jenkins-42',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you measure whether your CI/CD is actually good?',
    probing:
      'Whether you measure outcomes or vanity metrics. DORA is the expected reference at senior level.',
    answer: [
      'I would use the **DORA metrics**, because they measure outcomes rather than activity and they are the ones with evidence behind them.',
      '**Deployment frequency** - how often you ship to production. **Lead time for changes** - from commit to running in production. Those two measure **throughput**. **Change failure rate** - what proportion of deployments cause a degradation. **Time to restore service** - how long recovery takes. Those two measure **stability**.',
      'The insight that makes them worth using is that throughput and stability **move together** rather than trading off. Teams that deploy frequently in small increments also have lower failure rates, because small changes are easier to review, test and reverse. So you do not have to choose.',
      'Alongside those I would track a few operational signals that tell you where to act: **pipeline duration** (p95 from push to feedback, which is what developers actually experience), **flaky test rate**, and **queue time**. And I would treat "time developers spend waiting or re-running builds" as the thing all of it is really about.',
      'The caution is to avoid the metrics becoming targets in themselves. Deployment frequency can be gamed by splitting deploys; what matters is whether the team can ship a change safely when it needs to.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'The four DORA metrics',
        caption:
          'Throughput and stability improve together - small, frequent changes are also safer ones.',
        nodes: [
          {
            label: 'Deployment frequency',
            detail: 'Throughput: how often you ship',
            tone: 'accent',
          },
          {
            label: 'Lead time for changes',
            detail: 'Throughput: commit to production',
            tone: 'accent',
          },
          {
            label: 'Change failure rate',
            detail: 'Stability: how often a deploy hurts',
            tone: 'warning',
          },
          {
            label: 'Time to restore service',
            detail: 'Stability: how fast you recover',
            tone: 'warning',
          },
          { label: 'Small batches improve all four', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Time to restore matters more than change failure rate. You cannot prevent every failure; you can make recovery routine and fast.',
      'Lead time exposes non-technical bottlenecks - a two-day wait for a change advisory board shows up immediately.',
      'Measure the distribution, not the mean. A p95 lead time of three days with a mean of four hours tells a very different story.',
    ],
    traps: [
      'Measuring build count or lines of code, which correlate with nothing useful.',
      'Optimising deployment frequency by splitting one deploy into five.',
      'Ignoring time to restore because it feels like admitting failures happen.',
    ],
    followUps: [
      'Your change failure rate is 30%. Where would you start?',
      'Why do throughput and stability not trade off against each other?',
    ],
    tags: ['dora', 'metrics', 'cicd', 'measurement', 'advanced'],
  },
  {
    id: 'itv-jenkins-43',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you deal with flaky tests in a pipeline?',
    probing:
      'A culture and engineering question. The wrong answer - blanket retries - is very common.',
    answer: [
      'A flaky test passes and fails on the same code. The real damage is not the wasted time but the **erosion of trust**: once people learn that red sometimes means nothing, they stop investigating red, and a genuine failure gets re-run and ignored.',
      'The reflex answer is to add automatic retries, and that is a trap. Retries hide flakiness and let it accumulate until a suite needs three attempts to pass. Worse, they hide **real** intermittent bugs - a race condition in the application looks exactly like a flaky test.',
      'What actually works: **detect and quantify** first - record test results over time so you know which tests are flaky and how often, rather than relying on impressions. Then **quarantine** them into a separate non-blocking suite so the main pipeline is trustworthy again, with an **owner and a deadline** for each one. Then **fix them**, because the common causes are a small set: timing assumptions and sleeps, shared state between tests, test-order dependence, real dependencies that occasionally fail, and genuine concurrency bugs in the code.',
      'The rule I would push for is that **quarantine is temporary and bounded**. A test that has been quarantined for three months should be either fixed or deleted - an unquarantined, unfixed, forever-skipped test is worse than no test, because it creates the illusion of coverage.',
    ],
    code: [
      {
        title: 'Quarantine as a separate non-blocking stage',
        language: 'text',
        code: `stage('Tests') {
  parallel {
    stage('stable') {
      steps { sh 'make test EXCLUDE_TAG=flaky' }      // blocking, must be green
    }
    stage('quarantined') {
      steps {
        // Visible, tracked, but does not fail the build
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'make test ONLY_TAG=flaky'
        }
      }
    }
  }
  post {
    always { junit 'reports/**/*.xml' }              // trends over time
  }
}`,
      },
    ],
    traps: [
      'Blanket retries, which hide both flakiness and real intermittent bugs.',
      'Quarantining without an owner or a deadline, so tests stay skipped forever.',
      'Deleting a flaky test that was actually catching a real race condition.',
    ],
    followUps: [
      'How would you tell a flaky test from a real intermittent bug?',
      'What are the most common causes of flakiness you have seen?',
    ],
    tags: ['testing', 'flaky tests', 'culture', 'reliability'],
  },
  {
    id: 'itv-jenkins-44',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A deployment went out at 4pm and error rates are climbing. You are on call. What do you do?',
    probing: 'Incident response. The expected first move is to stop the bleeding, not to diagnose.',
    answer: [
      '**Mitigate first, diagnose second.** The correlation with a deploy fifteen minutes ago is strong enough to act on. I would roll back immediately - `kubectl rollout undo`, or switch traffic back in a blue/green setup - and only then work out what was wrong. Diagnosing while users are affected is the wrong order.',
      'While that is running, **communicate**: declare an incident, post in the channel what is happening and what has been done. People finding out separately and duplicating the investigation makes everything slower.',
      '**Confirm the mitigation worked.** Watch error rate and latency return to baseline. If they do not, the deploy was correlated rather than causal and the real cause is elsewhere - a dependency, a database, traffic - so I would widen the investigation rather than keep rolling things back.',
      '**Then diagnose**, with the pressure off. Compare the two versions: what changed in the diff, what the error logs actually say, whether it is one endpoint or everything, and whether there was a config or schema change alongside the code. The rollback bought the time to do this properly.',
      'Afterwards, a **blameless postmortem** focused on why this reached production and why it was not caught earlier. The useful output is not "be more careful" - it is a concrete change: a test that would have caught it, a canary that would have limited it, or an alert that would have fired sooner.',
      'One caveat worth stating: if the deploy included an **irreversible schema change**, rollback may not be safe. That is the moment to know it, and it is why expand/contract migrations matter.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Incident response order',
        caption:
          'Every minute spent diagnosing before mitigating is a minute of user-visible impact.',
        nodes: [
          { label: 'Errors climbing after a deploy', tone: 'danger' },
          { label: 'Roll back now', detail: 'Do not diagnose first', tone: 'warning' },
          { label: 'Declare and communicate', detail: 'In parallel, not after' },
          {
            label: 'Did it recover?',
            branch: {
              label: 'No - widen the search',
              detail: 'Correlated, not causal',
              tone: 'danger',
            },
          },
          { label: 'Diagnose with pressure off', detail: 'Diff, logs, config, schema' },
          { label: 'Blameless postmortem', detail: 'One concrete prevention', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Rollback should be a single well-practised command. If it takes twenty minutes and a runbook, fix that before the next incident.',
      'Feature flags often give a faster mitigation than a rollback - turn off the new path without redeploying anything.',
      'If the deploy included a migration, know in advance whether it is reversible. That decision belongs at review time, not at 4pm.',
      'Record the timeline as you go. Reconstructing it afterwards from memory is unreliable and postmortems depend on it.',
    ],
    traps: [
      'Debugging in production while users are affected.',
      'Rolling back without verifying that it helped.',
      'Rolling back code while leaving an incompatible schema change in place.',
      'A postmortem that produces "be more careful" instead of a concrete change.',
    ],
    followUps: [
      'The rollback did not help. What now?',
      'The deploy included a migration. Does that change your answer?',
    ],
    tags: ['scenario', 'incident response', 'rollback', 'oncall', 'advanced'],
  },
  {
    id: 'itv-jenkins-45',
    level: 'basic',
    kind: 'open',
    prompt: 'What is an artefact in CI, and what does "promote an artefact" mean?',
    probing: 'Core release vocabulary, asked simply.',
    answer: [
      'An **artefact** is the output of a build: a container image, a JAR, a compiled binary, a package. It is the thing you actually deploy, as opposed to the source code you deploy *from*.',
      '**Promoting** an artefact means moving the **same** artefact through environments - staging, then production - rather than rebuilding it for each. The build happens once, and what gets tested in staging is byte-for-byte what runs in production.',
      'That matters because rebuilding introduces difference. Dependencies resolve to newer versions, a base image has been updated, the build environment has changed. Any of those can mean the thing you tested is not the thing you shipped, and that difference is invisible until it fails.',
      'In practice promotion means keeping an **immutable reference** - an image digest, or a version that cannot be overwritten - and passing that reference through each stage rather than passing the source commit.',
    ],
    traps: [
      'Rebuilding per environment, which quietly breaks the link between what was tested and what runs.',
      'Promoting a mutable tag rather than a digest.',
    ],
    followUps: ['Why is a digest better than a tag for promotion?'],
    tags: ['artifacts', 'promotion', 'fundamentals', 'release'],
  },
  {
    id: 'itv-jenkins-46',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you secure the software supply chain of your CI pipeline?',
    probing: 'Post-SolarWinds thinking. Senior candidates should treat CI as a production system.',
    answer: [
      'The starting point is recognising that **CI is a production system with production-level access**. It holds deploy credentials, it produces the artefacts that run in production, and it is often the least-monitored system in the estate. A compromised pipeline is a compromised production environment, with the added problem that the attacker can sign their work with your identity.',
      '**Inputs**: pin dependencies by version and checksum with lockfiles, use a private proxy or mirror so builds do not depend on public registries being honest or available, and scan dependencies for known vulnerabilities and typosquatting. Pin base images by **digest**, not tag.',
      '**The build itself**: builds should be **reproducible** and **isolated** - ephemeral runners so nothing persists between jobs, no privileged Docker-in-Docker where a daemonless builder will do, and never building untrusted pull requests with access to real credentials.',
      '**Outputs**: generate an **SBOM** per artefact so the next CVE announcement is a query rather than an investigation, **sign** artefacts with cosign/Sigstore, and generate **provenance attestations** (SLSA) that record what was built, from which commit, by which pipeline.',
      '**Deployment**: verify signatures at admission, so an image that did not come from your pipeline cannot run even if someone gets registry credentials. That closes the loop - signing is only useful if something checks.',
      'And **access**: short-lived credentials via OIDC rather than long-lived secrets, least-privilege scoping per pipeline, and audit logging of who changed pipeline definitions - because modifying the pipeline is the easiest way to compromise everything it builds.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Supply chain controls, end to end',
        caption:
          'Signing only matters if the deployment side verifies - otherwise it is a nice gesture.',
        nodes: [
          {
            label: 'Pin dependencies + base digests',
            detail: 'Lockfiles, checksums, private mirror',
            tone: 'accent',
          },
          { label: 'Build on an ephemeral runner', detail: 'No persistence, no privilege' },
          {
            label: 'Scan: CVEs and secrets',
            detail: 'Fail on fixable high/critical',
            tone: 'warning',
          },
          { label: 'Generate SBOM + provenance', detail: 'SLSA attestation' },
          { label: 'Sign the artefact', detail: 'cosign / Sigstore' },
          {
            label: 'Verify signature at admission',
            detail: 'Unsigned images cannot run',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'Protect the pipeline definition itself with branch protection and review. Someone who can edit the Jenkinsfile can exfiltrate every credential the pipeline can reach.',
      'Rebuild regularly. Most CVEs in your artefacts come from base images, and the fix is a rebuild rather than a code change.',
      'An SBOM turns "are we affected by this" from days of investigation into minutes.',
      'Assume compromise is possible and plan detection: alert on unexpected changes to pipeline definitions and on artefacts published outside the normal pipeline.',
    ],
    traps: [
      'Signing artefacts without verifying signatures anywhere, which achieves nothing.',
      'Treating CI as a developer tool rather than production infrastructure.',
      'Long-lived cloud credentials in the CI system.',
      'Building fork pull requests with production credentials in scope.',
    ],
    followUps: [
      'What is the point of signing if nothing verifies?',
      'A critical CVE was announced. How fast can you tell whether you are affected?',
    ],
    tags: ['supply chain', 'security', 'sbom', 'slsa', 'advanced'],
  },
  {
    id: 'itv-jenkins-47',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you manage environment-specific configuration across dev, staging and production?',
    probing: 'Twelve-factor thinking, and where secrets fit.',
    answer: [
      'The principle is that **configuration lives outside the artefact**. One image is built and promoted through every environment; what differs is the configuration injected at runtime. If you have `Dockerfile.prod` and `Dockerfile.staging`, you are testing something other than what you ship.',
      'Non-secret configuration - endpoints, feature toggles, resource sizes, log levels - lives in **version control**, per environment: a values file per environment for Helm, an overlay per environment for Kustomize. It is reviewed like code and its history is visible.',
      '**Secrets** do not go in git even encrypted-by-obscurity. Either an external store (Vault, cloud secrets manager) synced in by the External Secrets Operator, or properly encrypted at rest (Sealed Secrets, SOPS) if you want them in the repository. Either way, applications receive them at runtime as mounted files or environment variables.',
      'Two practices make this reliable. **Validate configuration at startup** and fail fast with a clear message, rather than discovering a missing value when the first request arrives. And **keep the environments structurally identical** - the same keys everywhere, differing only in values - so "it works in staging" means something.',
    ],
    code: [
      {
        title: 'Same artefact, different values per environment',
        language: 'yaml',
        code: `# values.staging.yaml
replicaCount: 2
resources:
  requests: { cpu: 100m, memory: 256Mi }
config:
  logLevel: debug
  apiUrl: https://api.staging.example.com
externalSecrets:
  backend: vault
  path: secret/staging/api

---
# values.prod.yaml - same keys, different values
replicaCount: 10
resources:
  requests: { cpu: 500m, memory: 1Gi }
config:
  logLevel: info
  apiUrl: https://api.example.com
externalSecrets:
  backend: vault
  path: secret/prod/api`,
      },
    ],
    traps: [
      'Different images per environment, which defeats the entire point of promotion.',
      'Secrets committed to git, even in a private repository.',
      'Environments with different sets of keys, so a missing production value is only discovered in production.',
      'Configuration read lazily, so a bad value surfaces hours after deploy.',
    ],
    followUps: [
      'How would you handle a secret that must rotate every 30 days?',
      'Why should config validation happen at startup?',
    ],
    tags: ['configuration', 'twelve-factor', 'secrets', 'environments'],
  },
  {
    id: 'itv-jenkins-48',
    level: 'basic',
    kind: 'mcq',
    prompt:
      'A build fails only sometimes, with no code changes between runs. What is the most likely explanation?',
    probing: 'Pattern recognition for intermittent failures.',
    options: [
      { id: 'a', text: 'Jenkins is corrupting the source code' },
      {
        id: 'b',
        text: 'Something non-deterministic: a flaky test, a race condition, an unpinned dependency, or shared state between builds',
      },
      { id: 'c', text: 'The git repository is damaged' },
      { id: 'd', text: 'The build number has exceeded a limit' },
    ],
    correct: ['b'],
    answer: [
      'Same input, different output means **something varies that you are not controlling**. The usual candidates are a test with a timing assumption, a race condition in the code itself, an unpinned dependency that resolves to a new version, leftover state on a shared agent, or an external service that occasionally fails.',
      'The way to narrow it down is to make the variation visible: log the resolved dependency versions, log which agent ran the build, and add timestamps. Comparing a failing run against a passing one then usually shows the difference immediately.',
      'Two structural fixes remove whole categories: **pin dependencies** with a lockfile so resolution is deterministic, and use **ephemeral agents** so no state survives between builds. Between them they eliminate most "works sometimes" failures.',
    ],
    traps: [
      'Re-running until it passes, which is how a real intermittent bug reaches production.',
      'Assuming it is infrastructure without checking whether the test itself is racy.',
    ],
    followUps: ['How would you prove whether it is the test or the application?'],
    tags: ['troubleshooting', 'flaky', 'determinism', 'debugging'],
  },
  {
    id: 'itv-jenkins-49',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is caching in CI and how do you use it without causing stale-build bugs?',
    probing: 'Build speed with correctness. The invalidation question is the interesting half.',
    answer: [
      'Caching stores something expensive between builds - downloaded dependencies, compiled objects, container layers - so the next build reuses it. On a typical pipeline, dependency downloads are a third or more of the total time, so this is usually the single biggest speed win available.',
      'The risk is **staleness**: a cache that returns something no longer correct produces a build that passes on the wrong inputs, or fails in a way that has nothing to do with your change. The defence is a **cache key derived from the thing that determines the content** - a hash of the lockfile for dependencies, a hash of the Dockerfile plus the manifest for image layers. When the input changes, the key changes, and the cache misses correctly.',
      'What to cache and what not to: cache the **package manager’s download cache** rather than the installed `node_modules` or `vendor` directory. The download cache is content-addressed and safe; an installed tree can be subtly wrong after a dependency change and produces very confusing failures.',
      'And always have an escape hatch: a way to bust the cache manually, and a scheduled build with no cache at all so you discover cache-dependent breakage on a schedule rather than during an incident.',
    ],
    code: [
      {
        title: 'Cache keyed on the lockfile, with a safe fallback',
        language: 'text',
        code: `stage('Dependencies') {
  steps {
    script {
      def key = sh(script: 'sha256sum package-lock.json | cut -c1-16',
                   returnStdout: true).trim()
      // Restore the npm download cache (not node_modules)
      sh "aws s3 cp s3://ci-cache/npm-\${key}.tar.gz - 2>/dev/null | tar xz -C ~/.npm || echo 'cache miss'"

      sh 'npm ci'          // still deterministic - reads the lockfile

      sh "tar cz -C ~/.npm . | aws s3 cp - s3://ci-cache/npm-\${key}.tar.gz"
    }
  }
}`,
        explanation:
          'npm ci still installs from the lockfile; the cache only avoids re-downloading the packages.',
      },
    ],
    deeper: [
      'Container layer caching needs `--cache-from` against a registry image, because a fresh CI runner has no local layer cache at all.',
      'Cache keys should include the OS and architecture. A cache restored on the wrong architecture produces genuinely baffling failures.',
      'Set a retention policy. Cache storage grows without bound and eventually costs more than the time it saves.',
      'A weekly no-cache build catches "it only works because of the cache" before it matters.',
    ],
    traps: [
      'Caching `node_modules` directly rather than the download cache.',
      'A cache key that does not change when the dependencies do.',
      'No way to bust the cache when it is suspected, so the only option is to wait.',
    ],
    followUps: [
      'Why cache the download cache rather than the installed dependencies?',
      'How would you find out whether a failure is cache-related?',
    ],
    tags: ['caching', 'performance', 'ci', 'correctness'],
  },
  {
    id: 'itv-jenkins-50',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you introduce CI/CD to a team that currently deploys manually once a month?',
    probing: 'Change management. A purely technical answer misses the point of the question.',
    answer: [
      'The technical work is the easy part; the difficulty is that **monthly manual deploys are usually a rational response to deploys being risky**. If each release is painful and occasionally breaks production, doing it less often feels safer. Telling that team to deploy daily without changing the risk is asking them to do the scary thing more frequently.',
      'So I would start by **understanding why**. Is it a manual testing phase? A change advisory board? Fear based on past incidents? A database that cannot be changed safely? Each of those needs a different intervention, and building a pipeline without knowing which one is in play just automates the parts that were not the bottleneck.',
      'Then **build confidence before frequency**. Automate the build and tests first so every commit is verified - that is valuable on its own and threatens nobody. Then automate deployment to a **non-production** environment, so the deployment mechanism itself becomes routine and well-tested long before it touches production. Then add smoke tests and a **one-command rollback**, because the single biggest driver of deployment fear is not knowing how to undo it.',
      'Only then increase frequency, and gradually: monthly to fortnightly to weekly. Each step should be accompanied by evidence - failure rate not rising, recovery time falling - because that is what converts scepticism.',
      'Two things I would insist on. **Involve the people who do it now**, because they know the failure modes that are not written down anywhere. And **measure from the start** - lead time, change failure rate, time to restore - so the argument becomes empirical rather than a matter of opinion. The goal is not a pipeline; it is a team that is confident shipping small changes.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Confidence first, frequency second',
        caption:
          'Each step reduces the risk of deploying before anyone is asked to deploy more often.',
        nodes: [
          {
            label: 'Understand why it is monthly',
            detail: 'Fear, process, or a real constraint?',
            tone: 'accent',
          },
          { label: 'Automate build + tests', detail: 'Valuable alone, threatens nobody' },
          { label: 'Automate deploy to non-production', detail: 'Make the mechanism routine' },
          {
            label: 'Smoke tests + one-command rollback',
            detail: 'Removes the main source of fear',
            tone: 'warning',
          },
          { label: 'Increase frequency gradually', detail: 'Monthly - fortnightly - weekly' },
          {
            label: 'Measure and show the evidence',
            detail: 'Failure rate down, recovery faster',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'Deploy size is the hidden variable. A monthly release contains a month of changes, so when it fails the cause is hard to find - which reinforces the fear. Smaller releases are safer, and that is the argument to make.',
      'Feature flags let the team deploy frequently while still releasing on the old schedule, which separates the technical change from the organisational one.',
      'If there is a change advisory board, a demonstrated low change failure rate is the evidence needed to move low-risk changes to a pre-approved path.',
      'Pick a low-risk service for the first end-to-end pipeline. A visible success is worth more than an architecture diagram.',
    ],
    traps: [
      'Building a perfect pipeline nobody was asked for and wondering why it is not used.',
      'Pushing for daily deploys before rollback is reliable.',
      'Treating resistance as irrational rather than as information about real risks.',
      'Ignoring the database, which is often the actual reason releases are monthly.',
    ],
    followUps: [
      'The team is worried about deploying more often. How do you respond?',
      'What would you do first if the real blocker is a manual QA phase?',
    ],
    tags: ['change management', 'cicd', 'culture', 'strategy', 'advanced'],
  },
]
