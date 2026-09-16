import type { InterviewQuestion } from '../../../types'

/** Running Jenkins: plugins, upgrades, security, artefacts and CI/CD practice. */
export const jenkinsOperationsQuestions: InterviewQuestion[] = [
  {
    id: 'itv-jenkins-25',
    level: 'basic',
    kind: 'open',
    prompt:
      'What is the difference between continuous integration, continuous delivery and continuous deployment?',
    probing: 'Vocabulary that people use interchangeably and should not.',
    answer: [
      '**Continuous integration** is about the code: everyone merges to a shared branch frequently - at least daily - and every merge is automatically built and tested. The goal is to find integration problems within minutes rather than at the end of a release cycle.',
      '**Continuous delivery** extends that to the artefact: every commit that passes produces a **deployable** artefact, and deploying it to production is a **business decision** rather than an engineering effort. You could ship at any time; you choose when.',
      '**Continuous deployment** removes that last manual step: every commit that passes every gate **goes to production automatically**, with no human approval.',
      'The distinction that matters in an interview is the last one. Continuous delivery means "we can deploy at any time"; continuous deployment means "we do, automatically". Most organisations do delivery, and describing that as deployment suggests you have not thought about the difference.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Where each term stops',
        caption: 'The only difference between the last two is whether a human presses the button.',
        nodes: [
          { label: 'Commit', tone: 'accent' },
          { label: 'Build + test automatically', detail: 'Continuous integration ends here' },
          { label: 'Produce a deployable artefact', detail: 'Continuous delivery ends here' },
          {
            label: 'Human approves',
            detail: 'Delivery: yes. Deployment: no such step',
            tone: 'warning',
          },
          {
            label: 'Production',
            detail: 'Continuous deployment reaches here unattended',
            tone: 'success',
          },
        ],
      },
    ],
    traps: [
      'Using "continuous deployment" to describe a pipeline with a manual approval gate.',
      'Claiming CI while working on long-lived feature branches that merge monthly - that is not integrating continuously.',
    ],
    followUps: ['What would you need in place before enabling continuous deployment?'],
    tags: ['ci', 'cd', 'fundamentals', 'terminology'],
  },
  {
    id: 'itv-jenkins-26',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage Jenkins plugins, and why are they the main source of instability?',
    probing: 'Operational maturity. Everyone who has run Jenkins has been burned by a plugin.',
    answer: [
      'Plugins are **code running inside the controller JVM** with full access to credentials, job configuration and the filesystem. There is no sandbox between a plugin and Jenkins itself. A badly behaved plugin can leak memory, block threads, break the UI or introduce a security vulnerability affecting the whole instance.',
      'They are also **interdependent and version-sensitive**. Plugin A requires plugin B at a minimum version; upgrading B breaks C. A typical instance has 80 to 150 plugins, and the dependency graph is why "upgrade everything" so often ends in a controller that will not start.',
      'The practices that actually work: **pin versions explicitly** in a plugins list, **bake them into a custom image** so startup is deterministic, **test upgrades on a staging controller** running the same JCasC, and **remove anything unused** - every plugin you do not need is risk with no benefit.',
      'And upgrade **regularly in small batches** rather than rarely in big ones. The instance that has not been upgraded for two years is far harder to move than one upgraded monthly, and plugin security advisories are frequent enough that staying far behind is its own risk.',
    ],
    code: [
      {
        title: 'Pinned plugins baked into an image',
        language: 'dockerfile',
        code: `FROM jenkins/jenkins:2.479.1-lts-jdk21

# Pinned explicitly - no "latest", no runtime installation
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# Configuration comes from git, not from clicks
COPY casc/ /var/jenkins_home/casc_configs/
ENV CASC_JENKINS_CONFIG=/var/jenkins_home/casc_configs
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"`,
      },
      {
        title: 'plugins.txt with exact versions',
        language: 'text',
        code: `workflow-aggregator:600.vb_57cdd26fdd7
kubernetes:4296.v20a_7e4d77cf6
git:5.4.1
configuration-as-code:1850.va_a_8c31d3158b_
credentials-binding:681.vf91669a_32e45
pipeline-utility-steps:2.17.0`,
      },
    ],
    traps: [
      'Clicking "update all" on a production controller.',
      'Unpinned versions, so a rebuild produces a different instance than the one that worked.',
      'Accumulating plugins for one-off experiments and never removing them.',
    ],
    followUps: [
      'How would you test a plugin upgrade before production?',
      'A plugin upgrade broke the controller and it will not start. What do you do?',
    ],
    tags: ['plugins', 'operations', 'upgrades', 'stability'],
  },
  {
    id: 'itv-jenkins-27',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle build artefacts and what belongs in an artefact repository instead?',
    probing: 'Whether you know Jenkins is not an artefact store.',
    answer: [
      '`archiveArtifacts` attaches files to a build so they can be downloaded from the UI. That is appropriate for **build evidence** - test reports, coverage output, logs, a diagnostic bundle - things you want to look at when investigating a specific build.',
      'It is the wrong place for **deployable artefacts**. Jenkins artefact storage lives in `JENKINS_HOME`, so it grows without bound, it is backed up with your Jenkins backups, it is slow to retrieve, and it makes the controller a dependency for every deployment. Losing Jenkins should not mean losing your releases.',
      'Deployable artefacts belong in a purpose-built repository: container images in a **container registry**, libraries in **Nexus** or **Artifactory** or a language-specific registry, binaries in **object storage**. Those give you immutability, retention policies, access control, vulnerability scanning and replication - none of which Jenkins provides.',
      'The pipeline then publishes to the repository and records only the **reference** - the image digest or the artefact version - as the thing that gets promoted through environments.',
    ],
    code: [
      {
        title: 'Archive evidence, publish artefacts elsewhere',
        language: 'text',
        code: `post {
  always {
    // Evidence about this build - fine to keep in Jenkins, with retention
    junit 'reports/**/*.xml'
    archiveArtifacts artifacts: 'reports/**,logs/**', allowEmptyArchive: true
  }
}

stage('Publish') {
  steps {
    // The deployable thing goes to a real registry
    sh 'docker push registry.example.com/api:$GIT_COMMIT'
    script {
      env.IMAGE_DIGEST = sh(
        script: "docker inspect --format '{{index .RepoDigests 0}}' registry.example.com/api:$GIT_COMMIT",
        returnStdout: true
      ).trim()
    }
    echo "promoting \${env.IMAGE_DIGEST}"
  }
}`,
      },
    ],
    traps: [
      'Archiving large binaries on every build until `JENKINS_HOME` fills the disk.',
      'No `buildDiscarder`, so artefacts accumulate for years.',
      'Deployments that pull artefacts from Jenkins, making the CI server a production dependency.',
    ],
    followUps: ['Why is it a problem for deployment to depend on Jenkins being up?'],
    tags: ['artifacts', 'storage', 'registry', 'operations'],
  },
  {
    id: 'itv-jenkins-28',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you secure a Jenkins instance that is reachable from the internet?',
    probing:
      'Security design. Jenkins has been the entry point for a lot of real breaches, so this is a fair question.',
    answer: [
      'The first question I would ask is **whether it needs to be internet-reachable at all**. Usually the only reason is inbound webhooks from a git host, and that can be solved with an allow-list of the provider’s IP ranges, or by polling, or by putting the instance behind a VPN or identity-aware proxy. Reducing exposure beats hardening exposure.',
      'If it must be reachable: **authentication through the company identity provider** (SAML or OIDC) with MFA, never local Jenkins accounts. **Authorisation** with a role strategy and least privilege - most users need read and build, very few need Administer. Anonymous access disabled entirely.',
      'Then the Jenkins-specific hardening: **no builds on the controller**, because build code running there can read every credential. **Folder-scoped credentials** so a job cannot access secrets belonging to another team. **CSRF protection and the agent-to-controller security subsystem** left enabled - they exist because of real exploits. And the **script security sandbox** enabled, with approvals reviewed rather than rubber-stamped, because approving an arbitrary Groovy script is equivalent to granting shell on the controller.',
      'Operationally: **upgrade promptly**, since Jenkins security advisories are frequent and often affect plugins with known public exploits. **Audit logging** forwarded off the box. **Backups tested**. And **network segmentation** so that even a compromised controller cannot reach production databases directly.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Does this really need to be on the internet?',
        caption: 'Most internet exposure exists to receive webhooks, which has cheaper solutions.',
        question: 'Why is Jenkins publicly reachable?',
        branches: [
          {
            condition: 'To receive git webhooks',
            result: 'Allow-list the provider ranges, or use a relay',
            detail: 'No general public exposure needed',
            tone: 'success',
          },
          {
            condition: 'So staff can use it remotely',
            result: 'VPN or identity-aware proxy',
            detail: 'Authentication before Jenkins is reached',
            tone: 'success',
          },
          {
            condition: 'It has always been that way',
            result: 'Close it',
            detail: 'The most common real answer',
            tone: 'warning',
          },
          {
            condition: 'Genuinely required',
            result: 'SSO + MFA, least privilege, prompt patching',
            detail: 'And assume it will be probed constantly',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'The Script Console is effectively remote code execution as the Jenkins user. Administer permission should be held by very few people and audited.',
      'Build agents should not have production credentials. Use short-lived, scoped tokens issued per deployment instead.',
      'A compromised CI system means every artefact it ever built is suspect. That is the argument for signing images and verifying signatures at deploy time.',
    ],
    traps: [
      'Local Jenkins accounts with shared passwords.',
      'Builds on the controller, giving any pipeline access to all credentials.',
      'Disabling the Groovy sandbox because approvals are inconvenient.',
      'Falling years behind on upgrades because upgrading is scary.',
    ],
    followUps: [
      'Why is the Script Console so dangerous?',
      'Your Jenkins was compromised. What do you assume about the artefacts it built?',
    ],
    tags: ['security', 'hardening', 'sso', 'operations', 'advanced'],
  },
  {
    id: 'itv-jenkins-29',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'A pipeline needs a value produced in an earlier stage on a different agent. What is the right mechanism?',
    probing: 'Practical pipeline data flow.',
    options: [
      { id: 'a', text: 'A global Groovy variable, which persists across agents' },
      {
        id: 'b',
        text: '`stash`/`unstash` for files, and `env` or a returned value for small strings',
      },
      { id: 'c', text: 'Write it to `/tmp` and read it back in the next stage' },
      { id: 'd', text: 'Re-run the earlier command in the later stage' },
    ],
    correct: ['b'],
    answer: [
      '**Files** move between agents with `stash` and `unstash`. The stash is stored on the controller and can be retrieved on any agent for the duration of that build. **Small values** - a version string, an image digest - travel in `env` variables set with `script`, which are part of the build and available everywhere.',
      'A **global Groovy variable** does persist within a single pipeline run, but the file it refers to does not - the workspace is per agent, so the variable holds a path that means nothing on the new node. That is the trap in the option.',
      'Writing to `/tmp` fails for the same reason: each agent has its own filesystem. It also happens to work when both stages land on the same agent, which is worse - an intermittent failure that depends on scheduling.',
    ],
    code: [
      {
        title: 'Moving files and values between agents',
        language: 'text',
        code: `stage('Build') {
  agent { label 'linux' }
  steps {
    sh 'make build'
    stash name: 'binaries', includes: 'build/**'
    script {
      env.VERSION = sh(script: 'cat VERSION', returnStdout: true).trim()
    }
  }
}

stage('Package') {
  agent { label 'docker' }
  steps {
    unstash 'binaries'
    sh "docker build -t app:\${env.VERSION} ."
  }
}`,
      },
    ],
    traps: [
      'Assuming the workspace is shared between agents.',
      'Large stashes - they go through the controller and are slow. Use a real artefact store for anything big.',
      'Intermittent failures caused by two stages sometimes landing on the same agent.',
    ],
    followUps: ['Why is stashing a 2 GB directory a bad idea?'],
    tags: ['stash', 'agents', 'pipeline', 'data flow'],
  },
  {
    id: 'itv-jenkins-30',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Builds pass in CI but the same code fails in production. It has happened three times this quarter. How do you address it systematically?',
    probing:
      'Whether you fix the process rather than the individual incidents. A senior-level framing question.',
    answer: [
      'Three times in a quarter is a **process problem**, not three bad luck events, so I would resist fixing only the latest one.',
      'First, **characterise the failures**. Were they the same class each time - configuration, data, load, a dependency version? Three config mismatches point somewhere very different from one config, one load and one data issue. This usually takes half an hour of reading the incident notes and saves days of work aimed at the wrong thing.',
      'The most common root cause is that **CI does not resemble production**. Different data volumes, different configuration, no real dependencies (mocked instead of real), different resource limits, different architecture. The fix is to make the pipeline test against something production-like: real dependencies in ephemeral environments, a representative data volume, the same container image with the same resource limits.',
      'The second most common is **artefact drift** - what was tested is not what was deployed. Rebuilding between test and deploy, or deploying a mutable tag, means the tested artefact and the shipped one can differ. Build once, promote the **digest** through every environment, and this class disappears entirely.',
      'Then add the **safety net**, because some failures will always reach production: automated smoke tests immediately after deploy, canary or progressive rollout so a bad release affects a small fraction, and automated rollback on health signals. The goal is not zero production failures - it is failures that are detected in seconds and reverted automatically.',
      'Finally, close the loop. Each incident should add a test that would have caught it. If the same class recurs a fourth time, the process change did not work and needs revisiting rather than repeating.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Closing the gap between CI and production',
        caption:
          'Build once and promote the digest; make the test environment resemble production; catch the rest at deploy.',
        nodes: [
          {
            label: 'Characterise the three failures',
            detail: 'Same class, or different?',
            tone: 'accent',
          },
          { label: 'Build once, promote by digest', detail: 'Removes artefact drift entirely' },
          {
            label: 'Test against real dependencies',
            detail: 'Ephemeral env, production-like data',
          },
          { label: 'Match resource limits and image', detail: 'Same container, same constraints' },
          {
            label: 'Smoke test after deploy',
            detail: 'Seconds, not user reports',
            tone: 'warning',
          },
          { label: 'Canary + automated rollback', detail: 'Small blast radius', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Ephemeral per-pull-request environments are expensive but decisive - they remove "it only breaks when it is deployed" as a category.',
      'Contract testing catches the integration failures that unit tests miss without needing a full environment.',
      'Feature flags separate deploying code from releasing behaviour, which makes a bad change revertible without a rollback.',
      'Track change failure rate and time to restore. If the failure rate is not falling after the process change, the diagnosis was wrong.',
    ],
    traps: [
      'Adding more tests without knowing which class of failure they would catch.',
      'Rebuilding the artefact for production, reintroducing drift.',
      'Treating each incident in isolation and never noticing the pattern.',
      'Aiming for zero production failures instead of fast, automatic recovery.',
    ],
    followUps: [
      'How would you build a production-like test environment affordably?',
      'What metric would tell you the change worked?',
    ],
    tags: ['scenario', 'cicd', 'process', 'reliability', 'advanced'],
  },
  {
    id: 'itv-jenkins-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a multibranch pipeline and how does it handle pull requests?',
    probing: 'Standard modern Jenkins usage.',
    answer: [
      'A multibranch pipeline **scans a repository** and automatically creates a job for every branch that contains a `Jenkinsfile`. When a branch is deleted, its job is removed. There is no manual job creation at all.',
      'With the branch source configured for pull requests, it also creates jobs for **PRs** - and it can build either the PR head or the **merge result** with the target branch. Building the merge result is usually what you want, because it tests what would actually exist after merging, catching conflicts and semantic breakage that testing the head alone misses.',
      'The behaviour worth configuring is **forks**. Building a pull request from a fork means running untrusted code on your agents with access to whatever those agents can reach. Jenkins can require approval before building fork PRs, and that should stay on for any public repository.',
      '`when { branch ... }` conditions in the Jenkinsfile then let one file serve every branch: run the full pipeline on `main`, tests only on PRs, and deploy only from a release branch.',
    ],
    code: [
      {
        title: 'One Jenkinsfile, different behaviour per branch',
        language: 'text',
        code: `stage('Deploy staging') {
  when { branch 'main' }
  steps { sh './deploy.sh staging' }
}

stage('Deploy production') {
  when {
    allOf {
      branch 'main'
      expression { currentBuild.result == null || currentBuild.result == 'SUCCESS' }
    }
  }
  steps { sh './deploy.sh production' }
}

stage('PR checks only') {
  when { changeRequest() }         // true for pull requests
  steps { sh 'make test lint' }
}`,
      },
    ],
    traps: [
      'Building fork PRs without approval, which runs untrusted code with your credentials.',
      'Scanning very large organisations too frequently and hammering the git API.',
      'No `buildDiscarder`, so every deleted branch leaves build history behind.',
    ],
    followUps: [
      'Why is building a fork pull request risky?',
      'Should you build the PR head or the merge result?',
    ],
    tags: ['multibranch', 'pull requests', 'security', 'scm'],
  },
  {
    id: 'itv-jenkins-32',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you make a slow test suite in CI fast enough that developers do not avoid it?',
    probing:
      'Pragmatic performance work with a product mindset - the goal is developer behaviour, not a number.',
    answer: [
      'The framing matters: the goal is **fast feedback on the thing that just changed**, not making every test fast. A 40-minute suite that runs after merge is fine; a 40-minute wait before a developer can merge is not.',
      'First **measure which tests cost the time**. It is almost always a small minority - a handful of integration tests with sleeps, or a suite that starts a database per test. Fixing the worst ten often halves the total.',
      'Then **split by feedback value**. A fast lane on every push - unit tests, lint, type checks, targeted tests for changed paths - with a target of a few minutes. A full lane including slow integration and end-to-end tests on merge to main or on a schedule. Developers get a quick answer and the thorough answer still happens.',
      '**Parallelise** across agents, splitting by historical timing rather than alphabetically so the shards finish together. **Cache** dependencies properly, since redownloading them is often a third of the time. And **fix flaky tests aggressively** - a suite with 2% flakiness across 300 tests fails more often than it passes, and developers rationally start ignoring it, which destroys the value of the whole thing.',
      'The honest note: sometimes the suite is slow because the **architecture** requires a full environment for every test. That is a design problem, and no amount of parallelism fixes it - it needs better seams and more testing at the unit and contract level.',
    ],
    code: [
      {
        title: 'Fast lane and full lane in one pipeline',
        language: 'text',
        code: `stage('Fast feedback') {
  parallel {
    stage('lint')  { steps { sh 'make lint' } }
    stage('types') { steps { sh 'make typecheck' } }
    stage('unit')  { steps { sh 'make test-unit' } }
  }
}

stage('Full suite') {
  when {
    anyOf { branch 'main'; triggeredBy 'TimerTrigger' }
  }
  steps {
    script {
      // Shard by recorded timings so every shard finishes together
      def shards = [:]
      (1..6).each { i ->
        shards["shard-\${i}"] = {
          node('linux') {
            unstash 'repo'
            sh "make test-integration SHARD=\${i} OF=6"
          }
        }
      }
      parallel shards
    }
  }
}`,
      },
    ],
    deeper: [
      'Split shards by recorded duration, not by name. Alphabetical splits leave one shard running long after the others finish.',
      'Quarantine flaky tests into a separate non-blocking job with an owner and a deadline, rather than leaving them to erode trust in the main suite.',
      'Test-impact analysis - running only tests affected by the changed files - gives the biggest wins on large codebases, at the cost of some tooling.',
      'Track the p95 time from push to feedback. That is the number developers actually experience.',
    ],
    traps: [
      'Parallelising before measuring, and discovering the bottleneck was a single 12-minute test.',
      'Deleting slow tests instead of fixing or moving them.',
      'Ignoring flakiness, which makes every other improvement pointless.',
    ],
    followUps: [
      'How would you handle a test that is flaky but valuable?',
      'What would you measure to know this worked?',
    ],
    tags: ['performance', 'testing', 'developer experience', 'advanced'],
  },
  {
    id: 'itv-jenkins-33',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a webhook, and how does it differ from polling for a CI trigger?',
    probing: 'Basic integration concept, phrased simply.',
    answer: [
      'A webhook is an **HTTP callback**: when something happens in the source system, it sends a POST request to a URL you configured. For CI, the git host posts to Jenkins the moment someone pushes.',
      'The difference from polling is **who initiates**. With polling, Jenkins repeatedly asks "anything new?" - mostly getting "no" - which wastes requests and delays the build by up to the polling interval. With a webhook, nothing happens until something happens, and then the build starts immediately.',
      'The practical trade-off is reachability and security. A webhook needs the git host to be able to reach Jenkins, which is not always true behind a firewall, and the endpoint needs a shared secret so that not just anyone can trigger builds.',
    ],
    traps: [
      'An unauthenticated webhook endpoint that anyone on the internet can call.',
      'Assuming webhooks are reliable - deliveries can be missed, so a low-frequency poll as a fallback is reasonable.',
    ],
    followUps: ['What happens if a webhook delivery fails?'],
    tags: ['webhooks', 'triggers', 'fundamentals'],
  },
  {
    id: 'itv-jenkins-34',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you prevent two deployments of the same service running at the same time?',
    probing: 'Concurrency control - a real source of production incidents.',
    answer: [
      'Jenkins gives you two mechanisms. `disableConcurrentBuilds()` in `options` stops the **same job** running twice simultaneously - the second build waits. That covers the common case of two merges landing close together.',
      'The `lock` step, from the Lockable Resources plugin, is stronger: it takes a **named lock across jobs**, so several different pipelines that deploy to the same environment serialise against each other. That is what you need when the deploy job, the migration job and a scheduled maintenance job all touch production.',
      'The reason this matters is that concurrent deploys interleave in ways that leave the environment in a state neither pipeline expects - two rollouts of different versions racing, or a migration running against a database mid-deploy.',
      'For a busy service, `disableConcurrentBuilds(abortPrevious: true)` is often better than queueing: if three commits merge in five minutes, deploying the first two is pointless. Abort the in-flight one and deploy the newest.',
    ],
    code: [
      {
        title: 'Job-level and cross-job concurrency control',
        language: 'text',
        code: `pipeline {
  agent any
  options {
    // Same job cannot overlap; newer build supersedes the running one
    disableConcurrentBuilds(abortPrevious: true)
  }
  stages {
    stage('Deploy production') {
      steps {
        // Cross-job lock: any pipeline taking this lock waits its turn
        lock(resource: 'prod-environment', inversePrecedence: true) {
          sh './deploy.sh production'
          sh './smoke-test.sh'
        }
      }
    }
  }
}`,
        explanation:
          'inversePrecedence gives the lock to the newest waiter first, which is usually what you want for deploys.',
      },
    ],
    traps: [
      'Relying on `disableConcurrentBuilds` when several different jobs deploy to the same environment.',
      'Queueing every build on a busy repository, so the deploy queue grows longer than the working day.',
      'Holding a lock across a manual approval step, blocking everyone else for hours.',
    ],
    followUps: ['Why might aborting the previous build be better than queueing?'],
    tags: ['concurrency', 'locking', 'deployment', 'production'],
  },
  {
    id: 'itv-jenkins-35',
    level: 'advanced',
    kind: 'open',
    prompt:
      'Jenkins has become the bottleneck and the team wants to migrate to GitHub Actions. How would you approach it?',
    probing:
      'Migration planning. Senior candidates plan for coexistence rather than a big-bang cutover.',
    answer: [
      'First I would confirm the diagnosis. "Jenkins is slow" is often really "our tests are slow" or "we have four executors", and those problems move with you. I would measure where the time goes - queue time, execution time, agent provisioning - before accepting that the tool is the problem. If the real issue is maintaining the controller, plugin upgrades and the operational burden, that is a genuine and common reason to move.',
      'Assuming the decision stands, I would plan for a **long period of coexistence** rather than a cutover. Both systems run; repositories migrate one at a time. That means the migration can be paused, individual moves can be reverted, and no single failure blocks everyone.',
      'I would migrate in order of **simplicity first**: a few straightforward repositories to build confidence and establish patterns, extracting the common pieces into **reusable workflows** and **composite actions** as the equivalent of the shared library. Complex pipelines with unusual hardware or long-running jobs go last, and some may never move.',
      'The parts that need explicit design rather than translation are **secrets** (Actions uses its own store, and OIDC federation to the cloud is usually an improvement over static credentials), **self-hosted runners** if you need specific hardware or network access, and **artefact flow** if Jenkins was storing things it should not have been.',
      'And I would define **done** up front: which repositories, by when, and what happens to Jenkins afterwards. Half-finished migrations are the norm - you end up operating both systems permanently, with the worst of each. If some pipelines genuinely cannot move, decide that deliberately rather than by attrition.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Migration by coexistence, not cutover',
        caption:
          'Every step is reversible, and the decision to stop is made explicitly rather than by drift.',
        nodes: [
          {
            label: 'Measure the real bottleneck',
            detail: 'Queue? Tests? Maintenance?',
            tone: 'accent',
          },
          { label: 'Build shared patterns first', detail: 'Reusable workflows, composite actions' },
          { label: 'Migrate simple repos', detail: 'Establish and refine the pattern' },
          {
            label: 'Both systems run in parallel',
            detail: 'Per-repo, reversible',
            tone: 'warning',
          },
          { label: 'Migrate complex repos', detail: 'Or decide explicitly not to' },
          {
            label: 'Decommission or scope Jenkins',
            detail: 'A decision, not a drift',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'Reusable workflows and composite actions are the direct analogue of shared libraries. Building them first stops fifty repositories inventing fifty patterns.',
      'OIDC federation to AWS or GCP removes static cloud credentials entirely - often the single biggest security improvement from the move.',
      'Self-hosted runners bring back some of the operational burden you were trying to escape. Be honest about how much.',
      'Keep Jenkins read-only for a while after migrating a repository, so historical build logs remain available.',
    ],
    traps: [
      'Migrating because the tool is unfashionable rather than because of a measured problem.',
      'A big-bang cutover with no rollback path.',
      'Translating pipelines one-for-one instead of taking the chance to simplify.',
      'Never finishing, and permanently operating two CI systems.',
    ],
    followUps: [
      'What would convince you NOT to migrate?',
      'How would you handle a pipeline that cannot move?',
    ],
    tags: ['migration', 'github actions', 'strategy', 'advanced'],
  },
  {
    id: 'itv-jenkins-36',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `sh "make build"` versus `sh \'make build\'` change in a Jenkinsfile?',
    probing: 'Groovy string interpolation - a genuine source of secret leaks.',
    options: [
      { id: 'a', text: 'Nothing; Groovy treats both identically' },
      {
        id: 'b',
        text: 'Double quotes interpolate Groovy variables before the shell sees the string; single quotes pass it through literally for the shell to expand',
      },
      { id: 'c', text: 'Single quotes run in a subshell, double quotes do not' },
      { id: 'd', text: 'Double quotes are required for any multi-line script' },
    ],
    correct: ['b'],
    answer: [
      'In Groovy, **double quotes interpolate**: `"deploy \\${env.TARGET}"` is expanded by Groovy before the string is handed to the shell. **Single quotes do not**: `\'deploy $TARGET\'` reaches the shell with the dollar sign intact, and the shell expands it from its own environment.',
      'This matters for **security**. If you interpolate a credential with double quotes, the secret value becomes part of the command string - visible in the process list, and printed in the log if the script echoes commands. With single quotes the shell expands the variable itself and Jenkins’ masking has a chance of working.',
      'The rule to state: **use single quotes and let the shell expand environment variables**; use double quotes only when you genuinely need a Groovy value, and never for a secret.',
    ],
    code: [
      {
        title: 'The safe and unsafe forms',
        language: 'text',
        code: `withCredentials([string(credentialsId: 'token', variable: 'TOKEN')]) {
  // UNSAFE - Groovy expands TOKEN into the command string
  sh "curl -H 'Authorization: Bearer \${TOKEN}' https://api.example.com"

  // SAFE - the shell expands it; the value never appears in the command
  sh 'curl -H "Authorization: Bearer $TOKEN" https://api.example.com'
}`,
      },
    ],
    traps: [
      'Interpolating secrets with double quotes, defeating masking.',
      'Forgetting that a secret passed as a command-line argument is visible in `ps` to anything on the agent.',
    ],
    followUps: ['Why is passing a secret as a command-line argument risky even without logging?'],
    tags: ['groovy', 'security', 'credentials', 'syntax'],
  },
  {
    id: 'itv-jenkins-37',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is the `when` directive and how do you use it well?',
    probing: 'Conditional execution, which keeps one Jenkinsfile serving many contexts.',
    answer: [
      "`when` decides whether a stage runs. It supports conditions on the branch (`branch 'main'`), on changed files (`changeset`), on environment variables, on whether this is a pull request (`changeRequest()`), on build parameters, and arbitrary Groovy through `expression`.",
      'Using it well means **one Jenkinsfile that behaves correctly everywhere** rather than four near-identical files. Tests on every branch, deploy to staging only from `main`, deploy to production only when a release tag is present, and skip the expensive integration suite when only documentation changed.',
      'Two details worth knowing. `beforeAgent true` evaluates the condition **before allocating an agent**, which avoids spinning up a Pod just to decide not to run - worth setting on every skippable stage. And combining conditions needs `allOf`, `anyOf` or `not`, which read better than a single complex `expression`.',
    ],
    code: [
      {
        title: 'Conditions that keep one file serving every context',
        language: 'text',
        code: `stage('Integration tests') {
  when {
    beforeAgent true                    // decide before allocating an agent
    not { changeset 'docs/**' }         // skip for docs-only changes
  }
  agent { label 'heavy' }
  steps { sh 'make test-integration' }
}

stage('Deploy production') {
  when {
    beforeAgent true
    allOf {
      branch 'main'
      expression { return env.TAG_NAME?.startsWith('v') }
      environment name: 'DEPLOY_ENABLED', value: 'true'
    }
  }
  steps { sh './deploy.sh production' }
}`,
      },
    ],
    traps: [
      'Omitting `beforeAgent`, so an agent is allocated and immediately released.',
      'Complex Groovy in `expression` where a built-in condition would be clearer.',
      'A `changeset` rule so broad that important tests get skipped.',
    ],
    followUps: ['Why does `beforeAgent true` matter on a Kubernetes agent?'],
    tags: ['when', 'conditionals', 'pipeline', 'efficiency'],
  },
]
