import type { InterviewQuestion } from '../../../types'

/** Pipelines as code: syntax, structure, agents, parallelism and shared libraries. */
export const jenkinsPipelineQuestions: InterviewQuestion[] = [
  {
    id: 'itv-jenkins-11',
    level: 'basic',
    kind: 'open',
    prompt:
      'What is a Jenkinsfile and why is pipeline-as-code better than configuring jobs in the UI?',
    probing: 'Whether you have felt the pain of UI-configured jobs, or only heard about it.',
    answer: [
      'A `Jenkinsfile` is a text file in the repository that defines the build pipeline. Jenkins reads it from the branch being built, so the pipeline that runs is the pipeline that was committed alongside the code.',
      'The advantages over clicking through the UI are the ordinary advantages of version control. The pipeline is **reviewed** like code, it is **versioned** so you can see who changed what and when, it can be **rolled back**, and a **branch can change its own pipeline** without affecting anyone else - which is what makes testing a pipeline change possible at all.',
      'It also makes Jenkins itself **disposable**. A UI-configured Jenkins holds critical state in `$JENKINS_HOME` that exists nowhere else; losing the server means reconstructing hundreds of jobs from memory. With Jenkinsfiles plus configuration-as-code for the server, a rebuilt Jenkins picks up where the old one left off.',
    ],
    code: [
      {
        title: 'A minimal but complete declarative pipeline',
        language: 'text',
        code: `pipeline {
  agent { label 'linux' }

  options {
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  stages {
    stage('Build') {
      steps { sh 'make build' }
    }
    stage('Test') {
      steps { sh 'make test' }
      post {
        always { junit 'reports/**/*.xml' }
      }
    }
  }

  post {
    failure { slackSend(channel: '#ci', message: "FAILED \${env.JOB_NAME} #\${env.BUILD_NUMBER}") }
  }
}`,
      },
    ],
    traps: [
      'Keeping "just a few" jobs in the UI, which become the ones nobody can reproduce after an outage.',
      'A Jenkinsfile that calls a hand-configured job, which puts the real logic back in the UI.',
    ],
    followUps: [
      'How would you rebuild your Jenkins from scratch?',
      'How do you test a change to a Jenkinsfile safely?',
    ],
    tags: ['jenkinsfile', 'pipeline as code', 'fundamentals'],
  },
  {
    id: 'itv-jenkins-12',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between declarative and scripted pipeline syntax?',
    probing: 'Syntax fluency and knowing which to reach for.',
    options: [
      {
        id: 'a',
        text: 'Declarative is newer, more structured and validated up front; scripted is full Groovy with more flexibility and less safety',
      },
      { id: 'b', text: 'Scripted is newer and replaced declarative' },
      { id: 'c', text: 'Declarative only works with freestyle jobs' },
      { id: 'd', text: 'They are the same, only the indentation differs' },
    ],
    correct: ['a'],
    answer: [
      '**Declarative** starts with `pipeline { }` and has a fixed structure - `agent`, `stages`, `steps`, `post`. Because the structure is known, Jenkins can **validate it before running**, the Blue Ocean editor understands it, and `post` conditions and `options` work predictably. It is the recommended default.',
      '**Scripted** starts with `node { }` and is essentially a Groovy program. You get loops, conditionals, functions and arbitrary logic - and no structural validation, no guarantee that `post` behaviour works as expected, and far more ways to write something unreadable.',
      'The practical answer is: use declarative, and drop into a `script { }` block for the occasional piece of imperative logic. Reaching for full scripted syntax usually means the logic belongs in a shared library or a shell script instead.',
    ],
    code: [
      {
        title: 'Declarative, with an escape hatch where it is genuinely needed',
        language: 'text',
        code: `pipeline {
  agent any
  stages {
    stage('Deploy') {
      steps {
        script {
          // Imperative logic stays contained in a script block
          def targets = readJSON file: 'targets.json'
          targets.each { t ->
            sh "./deploy.sh \${t.name} \${t.region}"
          }
        }
      }
    }
  }
}`,
      },
    ],
    traps: [
      'Writing large amounts of Groovy in `script` blocks, which runs on the controller and does not scale.',
      'Choosing scripted for "flexibility" and ending up with a pipeline nobody else can modify.',
    ],
    followUps: ['When would you genuinely need scripted syntax?'],
    tags: ['declarative', 'scripted', 'syntax', 'fundamentals'],
  },
  {
    id: 'itv-jenkins-13',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you run stages in parallel, and what should you watch out for?',
    probing: 'Build speed, and whether you have hit the shared-workspace problem.',
    answer: [
      'Declarative pipelines have a `parallel` block containing named branches, each with its own `stages`. With `failFast true`, the first branch to fail aborts the rest - useful when you want fast feedback rather than a complete picture.',
      'The first thing to watch is **agents**. If the parallel branches all run on the same agent they share a workspace, and two builds writing to the same directory corrupt each other in ways that are maddening to debug. Give each branch its own `agent` so they get separate workspaces, or use `dir()` to separate them explicitly.',
      'The second is **capacity**. Ten parallel branches need ten executors; if you have four, six branches queue and the pipeline is no faster while holding resources. Parallelism helps only up to your available capacity.',
      'The third is **artefact collection**. Each branch produces its own test reports and build outputs, and if they all write to the same path the last one wins. Use `stash`/`unstash` to move files between branches, and namespace the report paths.',
    ],
    code: [
      {
        title: 'Parallel branches, each on its own agent',
        language: 'text',
        code: `stage('Test matrix') {
  parallel {
    stage('unit') {
      agent { label 'linux' }
      steps { sh 'make test-unit' }
      post { always { junit 'reports/unit/*.xml' } }
    }
    stage('integration') {
      agent { label 'linux' }
      steps { sh 'make test-integration' }
      post { always { junit 'reports/integration/*.xml' } }
    }
    stage('lint') {
      agent { label 'linux' }
      steps { sh 'make lint' }
    }
  }
}`,
      },
      {
        title: 'A build matrix without writing every combination',
        language: 'text',
        code: `stage('Cross-platform') {
  matrix {
    axes {
      axis { name 'PLATFORM'; values 'linux', 'windows' }
      axis { name 'VERSION';  values '20', '22' }
    }
    stages {
      stage('test') {
        steps { sh "make test PLATFORM=\${PLATFORM} VERSION=\${VERSION}" }
      }
    }
  }
}`,
      },
    ],
    traps: [
      'Parallel branches sharing one workspace and overwriting each other.',
      'More branches than executors, so it queues instead of parallelising.',
      '`failFast` on a test matrix where you actually wanted to see every failure.',
    ],
    followUps: [
      'How do you pass a built artefact from one parallel branch to a later stage?',
      'Your parallel pipeline is no faster than the serial one. Why might that be?',
    ],
    tags: ['parallel', 'performance', 'matrix', 'agents'],
  },
  {
    id: 'itv-jenkins-14',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are Jenkins agents, and how would you run builds on Kubernetes?',
    probing: 'Scaling architecture. The Kubernetes plugin is the standard modern answer.',
    answer: [
      'The **controller** schedules work, stores configuration and serves the UI. **Agents** do the actual building. The rule that matters is that **builds should never run on the controller** - a build that hangs, fills the disk or leaks memory takes down Jenkins for everyone, and build code running on the controller has access to all credentials and all job configuration.',
      'The classic setup is long-lived agents - VMs or machines connected over SSH or JNLP. It works, but agents accumulate state: leftover caches, installed tools, files from previous builds. Over time builds start depending on that state, and "works on agent 3 but not agent 5" appears.',
      'On Kubernetes, the **Kubernetes plugin** gives you **ephemeral agents**: each build gets a fresh Pod, created on demand, destroyed afterwards. That gives you a clean workspace every time, elastic capacity, and per-job tool images - a Go build gets a Go image, a Node build gets a Node image, with no shared agent that needs both.',
      'The trade-off is startup latency (a Pod has to be scheduled and images pulled) and that caching now needs deliberate design - a persistent volume or a remote cache - because nothing survives the Pod.',
    ],
    code: [
      {
        title: 'A Kubernetes agent defined in the pipeline',
        language: 'text',
        code: `pipeline {
  agent {
    kubernetes {
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          containers:
            - name: golang
              image: golang:1.23
              command: ["sleep"]
              args: ["infinity"]
              resources:
                requests: { cpu: "1", memory: 2Gi }
                limits:   { cpu: "2", memory: 4Gi }
            - name: kaniko
              image: gcr.io/kaniko-project/executor:debug
              command: ["sleep"]
              args: ["infinity"]
      '''
    }
  }
  stages {
    stage('Build') {
      steps {
        container('golang') { sh 'go build ./...' }
      }
    }
    stage('Image') {
      steps {
        container('kaniko') {
          sh '/kaniko/executor --context . --destination registry.example.com/app:$GIT_COMMIT'
        }
      }
    }
  }
}`,
        explanation:
          'Kaniko builds the image without a privileged Docker daemon, which is the point of doing this on Kubernetes.',
      },
    ],
    deeper: [
      'Always set resource requests on agent Pods. Without them the scheduler cannot place them sensibly and a big build starves its neighbours.',
      'Cache dependencies through a PVC or a remote cache (Gradle, Maven, Go module proxy), or ephemeral agents will re-download the world on every build.',
      'Give agents their own ServiceAccount with minimal RBAC. A build Pod with cluster-admin is a serious exposure.',
    ],
    traps: [
      'Running builds on the controller because it is easier. It is the fastest way to lose Jenkins.',
      'Long-lived agents that quietly accumulate state until builds are no longer reproducible.',
      'No resource requests on agent Pods, leading to noisy-neighbour problems across the cluster.',
    ],
    followUps: [
      'How do you keep builds fast with ephemeral agents?',
      'Why is running builds on the controller dangerous?',
    ],
    tags: ['agents', 'kubernetes', 'scaling', 'architecture'],
  },
  {
    id: 'itv-jenkins-15',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle credentials in Jenkins without leaking them?',
    probing: 'Security practice. The masking behaviour and its limits are the substance.',
    answer: [
      'Credentials live in the **Credentials store**, scoped globally or to a folder, and are referenced by **ID** from the pipeline. The pipeline never contains the value. `withCredentials` binds a credential to an environment variable for a limited block, and Jenkins **masks** the value in console output.',
      'Masking is genuinely useful but has **limits you should state**. It replaces exact matches of the secret in the log. If your script transforms the value - base64-encodes it, embeds it in a URL, prints it character by character - the transformed form is **not masked** and appears in plain text. `set -x` in a shell step is the classic way people leak a token into a build log.',
      'The stronger practice is to **scope credentials narrowly** using folder-level credentials so a job can only see what it needs, prefer **short-lived tokens** over static ones (OIDC federation to a cloud provider means Jenkins holds no long-lived cloud credentials at all), and **rotate** on a schedule.',
      'Finally, treat build logs as semi-public. Many people can read them, they are retained for a long time, and they are frequently forwarded into log aggregation with weaker access controls than Jenkins itself.',
    ],
    code: [
      {
        title: 'Binding credentials to a scoped block',
        language: 'text',
        code: `stage('Deploy') {
  steps {
    withCredentials([
      usernamePassword(credentialsId: 'registry',
                       usernameVariable: 'REG_USER',
                       passwordVariable: 'REG_PASS'),
      string(credentialsId: 'deploy-token', variable: 'TOKEN')
    ]) {
      // Do NOT use set -x here - it would echo the expanded values
      sh '''
        set +x
        echo "$REG_PASS" | docker login registry.example.com -u "$REG_USER" --password-stdin
        ./deploy.sh
      '''
    }
  }
}`,
      },
    ],
    deeper: [
      'Use `--password-stdin` rather than passing a secret as a command-line argument - arguments are visible in the process list to anything on the agent.',
      'OIDC/workload identity federation removes static cloud credentials entirely: Jenkins presents a signed token and receives a short-lived role.',
      'Audit which jobs can access which credentials. Global credentials plus a permissive job list is how a build script ends up able to deploy to production.',
    ],
    traps: [
      'Assuming masking is absolute. Transform the secret and it appears in the log.',
      '`set -x` inside a `withCredentials` block.',
      'Storing secrets in job parameters or environment variables at the job level, where they are visible in the UI.',
    ],
    followUps: [
      'How can a masked credential still end up in a build log?',
      'How would you remove static cloud credentials from Jenkins entirely?',
    ],
    tags: ['credentials', 'security', 'secrets', 'production'],
  },
  {
    id: 'itv-jenkins-16',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a shared library and when should you create one?',
    probing: 'Whether you have felt the pain of the same 200 lines pasted into forty Jenkinsfiles.',
    answer: [
      'A shared library is a separate git repository of Groovy code that pipelines can import. It gives you **custom steps** (in `vars/`), **classes** (in `src/`) and resource files, so common logic is written once and used everywhere.',
      'The reason to create one is duplication with drift. Once the same build-test-scan-deploy sequence exists in twenty Jenkinsfiles, a fix to the deployment logic has to be applied twenty times, and it will not be. A shared library turns each Jenkinsfile into a short declaration of intent and puts the logic in one reviewed, versioned place.',
      'The big caution is that **shared library code runs on the controller**, not the agent. Heavy logic there does not scale and can destabilise Jenkins for everyone. Keep libraries thin - orchestration and conventions - and put real work in shell scripts or containers that run on the agent.',
      '**Version the library** and pin consumers to a tag. A library referenced by `@master` means someone else\u2019s commit can break every pipeline in the organisation at once.',
    ],
    code: [
      {
        title: 'A custom step in vars/',
        language: 'text',
        code: `// vars/buildAndPush.groovy  - becomes the step buildAndPush(...)
def call(Map config = [:]) {
  String image = config.image ?: error('image is required')
  String tag   = config.tag   ?: env.GIT_COMMIT.take(7)

  // Orchestrate only - the real work happens on the agent
  sh "docker build -t \${image}:\${tag} ."
  sh "trivy image --severity HIGH,CRITICAL --exit-code 1 \${image}:\${tag}"
  sh "docker push \${image}:\${tag}"

  return "\${image}:\${tag}"
}`,
      },
      {
        title: 'The Jenkinsfile that uses it, pinned to a version',
        language: 'text',
        code: `@Library('platform-pipelines@v2.4.0') _

pipeline {
  agent { label 'linux' }
  stages {
    stage('Image') {
      steps {
        script {
          def ref = buildAndPush(image: 'registry.example.com/api')
          echo "published \${ref}"
        }
      }
    }
  }
}`,
        explanation:
          'Pinning to @v2.4.0 means a library change cannot break every pipeline the moment it merges.',
      },
    ],
    deeper: [
      'Shared library code is subject to Groovy sandbox restrictions unless approved, which is a security feature and a frequent source of confusing failures.',
      'Test libraries with the Jenkins Pipeline Unit framework. Untested library code that every pipeline depends on is a large blast radius.',
      'Roll out changes with a version bump per consumer rather than a floating branch, so a bad change affects one team at a time.',
    ],
    traps: [
      'Referencing `@master`, so an untested commit breaks every build in the company.',
      'Putting heavy computation in the library, which runs on the controller.',
      'A library so abstract that debugging a failure means reading three layers of Groovy.',
    ],
    followUps: [
      'Why is pinning a library version important?',
      'How would you test a shared library change before it reaches every team?',
    ],
    tags: ['shared library', 'groovy', 'reuse', 'architecture'],
  },
  {
    id: 'itv-jenkins-17',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you design a Jenkins setup for a company with 200 developers and 500 repositories?',
    probing:
      'System design at senior level. They want capacity, isolation, reliability and maintainability.',
    answer: [
      'I would start with the **controller as a single point of failure** and design around it. Jenkins has no true active-active HA, so the priorities are keeping the controller light, making it reproducible, and keeping recovery fast. That means **no builds on the controller ever**, `JENKINS_HOME` on reliable storage with tested backups, and **Configuration as Code (JCasC)** plus plugin pinning so the whole instance can be rebuilt from a repository.',
      'For **scale**, ephemeral Kubernetes agents rather than static ones - 500 repositories means very bursty load, and elastic capacity handles that far better than a fixed fleet. Per-language agent images, resource requests on every Pod, and a node pool sized for the peak with autoscaling.',
      'For **organisation**, multibranch pipelines with an organisation folder so new repositories are picked up automatically, and **folder-level isolation** per team: folder-scoped credentials, folder RBAC, and separate agent labels where a team needs specific hardware. That way one team cannot read another\u2019s secrets or saturate their capacity.',
      'For **maintainability**, a shared library with the common build patterns so most Jenkinsfiles are ten lines, versioned and rolled out gradually. Plugin count kept deliberately low - plugins are the main source of Jenkins instability and upgrade pain.',
      'And I would be honest about the alternative. At that scale, with 500 repositories, I would seriously evaluate whether Jenkins is the right tool at all compared with GitHub Actions or GitLab CI, where the controller is somebody else\u2019s problem. The case for keeping Jenkins is usually specific: complex existing pipelines, on-premise or air-gapped requirements, or unusual hardware. If none of those apply, the migration is worth costing.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Controller light, isolation by folder, agents ephemeral',
        caption:
          'Nothing valuable and nothing heavy runs on the controller - that is the organising principle.',
        root: {
          label: 'Jenkins platform',
          children: [
            {
              label: 'Controller (no builds)',
              detail: 'JCasC, pinned plugins, backed-up JENKINS_HOME',
              tone: 'accent',
              children: [
                { label: 'Folder: team-a', detail: 'Scoped credentials + RBAC', tone: 'muted' },
                { label: 'Folder: team-b', detail: 'Scoped credentials + RBAC', tone: 'muted' },
              ],
            },
            {
              label: 'Kubernetes agent pool',
              detail: 'Ephemeral Pods, per-language images, autoscaled',
              tone: 'success',
            },
            {
              label: 'Shared library (versioned)',
              detail: 'Thin orchestration, pinned per team',
              tone: 'accent',
            },
          ],
        },
      },
    ],
    deeper: [
      'Plugins are the main operational risk. Pin versions, test upgrades on a staging controller, and remove anything unused - every plugin is code running on your controller with full access.',
      'Consider splitting into several controllers by domain rather than one giant instance. It limits blast radius and makes upgrades survivable, at the cost of duplicated administration.',
      'Instrument it: queue length, executor utilisation, build duration percentiles and agent provisioning time tell you where the bottleneck is before developers do.',
      'Retention matters at this scale - unbounded build history fills the disk and slows the UI. `buildDiscarder` on every job, enforced through the shared library.',
    ],
    traps: [
      'One enormous controller with hundreds of plugins that nobody dares upgrade.',
      'Static agents, so capacity is both insufficient at peak and wasted off-peak.',
      'Global credentials visible to every job.',
      'No JCasC, so the instance cannot be rebuilt and every change is a click nobody recorded.',
    ],
    followUps: [
      'How would you handle a controller failure at 9am on a Monday?',
      'What would make you recommend migrating off Jenkins entirely?',
    ],
    tags: ['architecture', 'scaling', 'system design', 'advanced', 'jcasc'],
  },
  {
    id: 'itv-jenkins-18',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A pipeline that normally takes 8 minutes now takes 45. Nothing obvious changed. How do you investigate?',
    probing: 'Performance debugging with a method rather than guesses.',
    answer: [
      'First **locate the time**, do not guess at it. The pipeline stage view shows per-stage durations, and comparing a slow run against a fast one usually points at one stage immediately. If the time is spread evenly across every stage, that is a different signal - it points at the agent or the infrastructure rather than the pipeline.',
      'Then separate **queue time from execution time**. A build that waits 30 minutes for an executor is not slow, it is starved - and the fix is capacity or label configuration, not the pipeline. The queue page and the build\u2019s own timestamps tell you which.',
      'If it is execution time in one stage, the usual suspects are: a **cache that stopped working** (dependency downloads reappearing in the log is the tell), a **network or registry** that has become slow, **test data growth** making a test suite genuinely slower, or a **noisy neighbour** on a shared agent.',
      'If it is spread across everything, look at the **agent itself**: disk filling up, an undersized node, CPU throttling from a container limit, or many builds landing on one agent. On Kubernetes agents, check whether the Pod is being CPU-throttled - that produces exactly this "everything is uniformly slower" pattern.',
      'The durable fix is to **make this visible before users report it**: record build duration as a metric, alert on a percentile rather than a single slow build, and add timestamps to the console output so every future investigation starts with data.',
    ],
    code: [
      {
        title: 'Instrument the pipeline so the next investigation is quick',
        language: 'text',
        code: `pipeline {
  agent { label 'linux' }
  options {
    timestamps()                                   // every log line gets a time
    timeout(time: 20, unit: 'MINUTES')             // fail rather than hang
  }
  stages {
    stage('Deps') {
      steps {
        sh '''
          start=$(date +%s)
          make deps
          echo "DEPS_SECONDS=$(( $(date +%s) - start ))"
        '''
      }
    }
  }
  post {
    always {
      // Push duration somewhere you can graph over time
      sh "curl -fsS -X POST \\"$METRICS_URL/build_duration?job=\${env.JOB_NAME}&s=\${currentBuild.duration / 1000}\\" || true"
    }
  }
}`,
      },
    ],
    deeper: [
      '`timestamps()` costs nothing and turns an unreadable log into a timeline. Enable it everywhere.',
      'Cache misses are the most common cause. Look for dependency downloads in the log that were not there in the fast run.',
      'On Kubernetes agents, CPU limits cause throttling that looks exactly like "everything got slower". Check `nr_throttled`, or simply raise the limit and compare.',
      'Track build duration as a time series. "Nothing changed" is nearly always false, and a graph shows you the day it started.',
    ],
    traps: [
      'Blaming the build script when the time is actually spent queuing.',
      'Comparing against memory rather than an actual previous build log.',
      'Adding parallelism to a pipeline that is starved of executors, which makes queuing worse.',
    ],
    followUps: [
      'The time is all in queueing. What now?',
      'How would you detect this automatically next time?',
    ],
    tags: ['scenario', 'performance', 'troubleshooting', 'debugging'],
  },
  {
    id: 'itv-jenkins-19',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these are good reasons to fail a Jenkins build? Select all that apply.',
    probing: 'Quality-gate judgement - what belongs in a blocking gate and what does not.',
    options: [
      { id: 'a', text: 'A unit or integration test failed' },
      { id: 'b', text: 'A container image scan found a fixable critical vulnerability' },
      { id: 'c', text: 'Code coverage dropped below the agreed threshold' },
      { id: 'd', text: 'A linter reported a formatting preference that auto-formatting would fix' },
      { id: 'e', text: 'A secret was detected in the committed source' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'A formatting preference should not fail a build. Run the auto-formatter in a pre-commit hook or as a step that fixes and commits, and check formatting as a non-blocking warning at most. Failing builds over whitespace teaches people that red builds are normal, which is the single most damaging thing that can happen to a CI system.',
      'The others are all worth blocking on. **Test failures** are the core purpose of CI. A **fixable critical vulnerability** should not reach production when a version bump resolves it - note "fixable", because failing on unfixable findings is just noise. A **coverage drop** below an agreed line catches new untested code, provided the threshold was agreed rather than imposed. A **detected secret** must block, because once it is pushed it is compromised and the cost rises with every minute.',
      'The underlying principle is that **a failing build must mean something is genuinely wrong**. Every gate that fires on something people will ignore erodes trust in every other gate.',
    ],
    traps: [
      'So many gates that developers routinely re-run builds until they pass.',
      'Failing on unfixable CVEs, which trains everyone to bypass the security gate.',
      'A coverage threshold nobody agreed to, gamed within a week by tests that assert nothing.',
    ],
    followUps: ['How would you introduce a new quality gate without the team revolting?'],
    tags: ['quality gates', 'ci', 'culture', 'security'],
  },
  {
    id: 'itv-jenkins-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you trigger builds? Compare polling, webhooks and scheduled triggers.',
    probing: 'Whether you know why polling is discouraged at scale.',
    answer: [
      '**Polling** (`pollSCM`) has Jenkins ask the repository "has anything changed?" on a schedule. It works anywhere, including behind a firewall where the git host cannot reach Jenkins, but it scales badly: 500 repositories polling every minute is 500 requests a minute, mostly answered "no", and changes are still delayed by up to the polling interval.',
      '**Webhooks** invert it: the git host tells Jenkins the moment a push happens. That is immediate and costs nothing when nothing is happening, which is almost always. It requires the git host to be able to reach Jenkins, and the endpoint needs securing - an unauthenticated build trigger is a denial-of-service waiting to happen.',
      '**Scheduled** triggers (`cron`) are for work that is time-based rather than change-based: nightly integration suites, dependency update checks, scheduled security scans. Use `H` in the schedule (`H 2 * * *`) so Jenkins spreads jobs across the hour rather than starting two hundred builds at exactly 02:00.',
      'For a **multibranch** pipeline, webhooks are effectively required - you want new branches and pull requests discovered immediately, and indexing 500 repositories by polling is painful.',
    ],
    code: [
      {
        title: 'The three trigger types',
        language: 'text',
        code: `triggers {
  // Webhook-driven is preferred; this is the fallback
  pollSCM('H/15 * * * *')

  // Time-based work, spread across the hour by H
  cron('H 2 * * *')

  // Build when an upstream job succeeds
  upstream(upstreamProjects: 'shared-library-build', threshold: hudson.model.Result.SUCCESS)
}`,
        explanation:
          'H is a hash of the job name - it picks a stable but distributed minute, avoiding a thundering herd.',
      },
    ],
    traps: [
      'Polling every minute across hundreds of jobs and overloading the git host.',
      'Literal `0 2 * * *` on many jobs, so everything starts simultaneously at 2am.',
      'An unsecured webhook endpoint that anyone can use to trigger builds.',
    ],
    followUps: ['Why does `H` exist in Jenkins cron syntax?'],
    tags: ['triggers', 'webhooks', 'scaling', 'cron'],
  },
  {
    id: 'itv-jenkins-21',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you implement a deployment approval and rollback flow in Jenkins?',
    probing: 'Release process design, including the failure path most people forget.',
    answer: [
      'The approval itself is the `input` step, which pauses the pipeline until someone approves. Two details matter: **`submitter`** restricts who may approve, so approval means something; and the input must be placed **outside** any `node` block, or a waiting pipeline holds an executor for hours.',
      'For the deploy itself I would use an **immutable reference** - the image digest built earlier in this pipeline - so the thing approved is exactly the thing deployed, with no chance of a tag having moved in between.',
      'The rollback path is where most implementations are weak. It is not enough to have a rollback command documented; the pipeline should **verify the deployment and roll back automatically when verification fails**. `kubectl rollout status` with a timeout, followed by a smoke test against the new version, and a `post { failure { ... } }` block that undoes it. Otherwise your rollback depends on a human noticing during an incident.',
      'And I would record it: who approved, what digest, at what time, and the result. That is both an audit requirement in many places and genuinely useful when reconstructing an incident.',
    ],
    code: [
      {
        title: 'Approval, deploy, verify, auto-rollback',
        language: 'text',
        code: `stage('Approve production') {
  // No agent - do not hold an executor while waiting for a human
  agent none
  steps {
    timeout(time: 4, unit: 'HOURS') {
      script {
        def approval = input(
          message: "Deploy \${env.IMAGE_DIGEST} to production?",
          submitter: 'release-managers',
          submitterParameter: 'approver'
        )
        env.APPROVER = approval
      }
    }
  }
}

stage('Deploy production') {
  steps {
    sh "kubectl set image deployment/api api=\${env.IMAGE_DIGEST} -n prod"
    sh "kubectl rollout status deployment/api -n prod --timeout=5m"
    sh "./smoke-test.sh https://api.example.com"
  }
  post {
    failure {
      echo 'Verification failed - rolling back automatically'
      sh 'kubectl rollout undo deployment/api -n prod'
      sh 'kubectl rollout status deployment/api -n prod --timeout=5m'
      slackSend(channel: '#incidents',
                message: "ROLLED BACK \${env.JOB_NAME} #\${env.BUILD_NUMBER} (approved by \${env.APPROVER})")
    }
    success {
      slackSend(channel: '#releases',
                message: "Deployed \${env.IMAGE_DIGEST} (approved by \${env.APPROVER})")
    }
  }
}`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Approval with an automatic failure path',
        caption:
          'The rollback is part of the pipeline, not a runbook someone has to find during an incident.',
        nodes: [
          { label: 'Build and push by digest', tone: 'accent' },
          { label: 'Deploy to staging + verify' },
          {
            label: 'Await approval',
            detail: 'input with submitter, agent none',
            branch: {
              label: 'Timeout or reject',
              detail: 'Pipeline ends, nothing deployed',
              tone: 'muted',
            },
          },
          { label: 'Deploy production by digest' },
          {
            label: 'rollout status + smoke test',
            branch: { label: 'Fails', detail: 'post failure -> rollout undo', tone: 'danger' },
          },
          { label: 'Notify and record', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'A `timeout` around `input` is essential - without it a forgotten pipeline waits forever and can hold resources indefinitely.',
      'Deploying by digest rather than tag closes the gap between what was tested and what runs.',
      'For anything higher-risk, progressive delivery (canary with automated metric-based rollback) is stronger than an approval gate. A human clicking approve does not actually verify anything.',
      'Record approver, artefact digest and outcome. During an incident the question "what changed and who approved it" comes up within minutes.',
    ],
    traps: [
      '`input` inside a `node` block, holding an executor for hours.',
      'No timeout, so pipelines accumulate forever in a waiting state.',
      'A rollback that exists only as a wiki page.',
      'Deploying a tag rather than a digest, so the approved artefact and the deployed one can differ.',
    ],
    followUps: [
      'Why must `input` be outside a node block?',
      'What would you use instead of a manual approval for a high-frequency service?',
    ],
    tags: ['deployment', 'approval', 'rollback', 'production', 'advanced'],
  },
  {
    id: 'itv-jenkins-22',
    level: 'basic',
    kind: 'open',
    prompt: 'What does the `post` section do, and what are its conditions?',
    probing: 'Basic pipeline structure, and whether you use it for cleanup.',
    answer: [
      'The `post` section runs **after** a stage or the whole pipeline, regardless of what happened, and lets you branch on the outcome. The conditions are `always`, `success`, `failure`, `unstable`, `changed`, `aborted`, `cleanup` and a few more.',
      'It is the right place for anything that must happen whatever the result: publishing test reports, archiving artefacts, sending notifications, and cleaning up the workspace or temporary cloud resources. Putting cleanup in a normal step means it is skipped when the build fails - which is precisely when you most need it.',
      '`changed` is underused and genuinely useful: it fires only when the build result differs from the previous run, which gives you "the build just broke" and "the build is fixed" notifications without spamming a channel on every red build.',
    ],
    code: [
      {
        title: 'post conditions in practice',
        language: 'text',
        code: `post {
  always {
    junit 'reports/**/*.xml'
    archiveArtifacts artifacts: 'build/**', allowEmptyArchive: true
  }
  success {
    echo 'Build passed'
  }
  failure {
    slackSend(channel: '#ci', color: 'danger',
              message: "FAILED \${env.JOB_NAME} #\${env.BUILD_NUMBER}")
  }
  changed {
    // Only when the result differs from last time - no daily spam
    echo 'Build status changed since the previous run'
  }
  cleanup {
    // Runs last, whatever happened - tear down temporary resources
    sh './scripts/teardown-test-env.sh || true'
    cleanWs()
  }
}`,
      },
    ],
    traps: [
      'Cleanup in a regular step, so it never runs on the failure path.',
      'Notifying on every failure rather than on `changed`, until the channel is muted.',
      'Forgetting `allowEmptyArchive`, so a failed build fails again in post.',
    ],
    followUps: ['Where would you put a step that must run even if the build is aborted?'],
    tags: ['post', 'pipeline', 'cleanup', 'notifications'],
  },
  {
    id: 'itv-jenkins-23',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is Jenkins Configuration as Code, and why does it matter?',
    probing: 'Whether you treat the CI server itself as infrastructure.',
    answer: [
      '**JCasC** defines the Jenkins controller\u2019s configuration - security realm, authorisation strategy, credentials, agent clouds, tool installations, plugin settings - in YAML, applied at startup. Combined with a pinned plugin list, it makes the controller **reproducible from a repository**.',
      'It matters because the alternative is a server configured by hundreds of clicks over several years, by people who have since left. Nobody can say what the configuration is, changes are unreviewed and unlogged, and a rebuild after a failure is an archaeology exercise rather than a deployment.',
      'With JCasC you get the properties you expect from infrastructure as code: **reviewable** changes, **versioned** history, a **reproducible** disaster recovery path, and the ability to run a **staging controller** with identical configuration to test a plugin upgrade before it touches production.',
      'The usual pattern is JCasC plus a custom Jenkins image with plugins baked in at pinned versions, deployed to Kubernetes. Then the controller is genuinely disposable: `JENKINS_HOME` holds build history, and everything else comes from git.',
    ],
    code: [
      {
        title: 'A JCasC fragment',
        language: 'yaml',
        code: `jenkins:
  systemMessage: "Managed by JCasC - do not configure through the UI"
  numExecutors: 0                      # never build on the controller
  authorizationStrategy:
    roleBased:
      roles:
        global:
          - name: admin
            permissions: ["Overall/Administer"]
            entries: [{ group: "platform-team" }]
  clouds:
    - kubernetes:
        name: k8s
        namespace: jenkins-agents
        jenkinsUrl: http://jenkins.jenkins.svc.cluster.local:8080
        containerCapStr: "50"

credentials:
  system:
    domainCredentials:
      - credentials:
          - string:
              scope: GLOBAL
              id: deploy-token
              secret: "\${DEPLOY_TOKEN}"   # injected from a Secret, never in git

unclassified:
  location:
    url: https://jenkins.example.com/`,
        explanation:
          'numExecutors: 0 enforces the "no builds on the controller" rule in configuration rather than convention.',
      },
    ],
    deeper: [
      'Secrets come from environment variables backed by Kubernetes Secrets or Vault - the YAML holds references, never values.',
      'Bake plugins into a custom image at pinned versions. Installing plugins at runtime makes startup non-deterministic and upgrades unpredictable.',
      'A staging controller with the same JCasC is the only reliable way to test plugin upgrades, which are the main source of Jenkins breakage.',
    ],
    traps: [
      'Adopting JCasC but still making changes in the UI, so the two drift and the next restart reverts someone\u2019s work.',
      'Secrets committed into the JCasC YAML.',
      'Unpinned plugin versions, which makes the setup non-reproducible in exactly the situation you need it.',
    ],
    followUps: [
      'How would you test a plugin upgrade safely?',
      'What still lives in JENKINS_HOME after adopting JCasC?',
    ],
    tags: ['jcasc', 'configuration as code', 'operations', 'disaster recovery', 'advanced'],
  },
  {
    id: 'itv-jenkins-24',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does the `agent any` directive mean in a declarative pipeline?',
    probing: 'Quick check on agent allocation.',
    options: [
      { id: 'a', text: 'Run on any available agent, including the controller if it has executors' },
      { id: 'b', text: 'Run on every agent simultaneously' },
      { id: 'c', text: 'Do not allocate an agent at all' },
      { id: 'd', text: 'Pick a random agent and fail if it is busy' },
    ],
    correct: ['a'],
    answer: [
      '`agent any` tells Jenkins to allocate **one** executor on **any** available node and run the pipeline there. It does not mean all agents, and it does not mean a random one - Jenkins picks based on availability.',
      'The risk is the "including the controller" part. If the controller has executors configured, `agent any` can schedule builds on it, which is exactly what you do not want. Setting the controller\u2019s executor count to zero removes the possibility entirely.',
      "The alternatives are `agent none` (allocate nothing at pipeline level, so each stage declares its own - the right choice when you have an `input` step), `agent { label 'linux' }` to constrain by capability, and `agent { docker { ... } }` or `agent { kubernetes { ... } }` to run inside a container.",
    ],
    traps: [
      'Leaving executors enabled on the controller, so `agent any` can put builds there.',
      'Using `agent any` on a pipeline that needs specific tools, producing failures that depend on which agent was picked.',
    ],
    followUps: ['When would you use `agent none` at the top level?'],
    tags: ['agents', 'declarative', 'fundamentals'],
  },
]
