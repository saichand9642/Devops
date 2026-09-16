import type { InterviewTopic } from '../../types'

export const jenkinsTopic: InterviewTopic = {
  id: 'jenkins',
  title: 'Jenkins & CI/CD',
  shortTitle: 'Jenkins',
  icon: '🔧',
  order: 3,
  oneLiner:
    'Declarative pipelines, agents, shared libraries, credentials and the CI/CD design questions behind them.',
  headlines: [
    'Pipeline as code lives in a `Jenkinsfile` in the repository, so the pipeline is reviewed and versioned like the application.',
    'Declarative pipeline is the default choice; scripted is the escape hatch when you need real Groovy control flow.',
    'The controller schedules and stores; agents execute. Never run builds on the controller.',
    'Credentials come from the credentials store via `withCredentials` or the `credentials()` helper - never as plain text in the Jenkinsfile.',
    'CI is "does this change integrate?"; CD is "can this change be released?". Continuous deployment means it goes automatically.',
    '`post { always { ... } }` is where cleanup and notification belong, because it runs whatever the outcome.',
  ],
  questions: [
    {
      id: 'itv-jenkins-1',
      level: 'basic',
      kind: 'open',
      prompt:
        'What is CI/CD, and what is the difference between continuous delivery and continuous deployment?',
      probing:
        'Terminology precision. A lot of candidates use these interchangeably, and interviewers notice.',
      answer: [
        '**Continuous integration** is the practice of merging every developer’s work into a shared branch frequently - at least daily - with an automated build and test run on every merge. The point is to find integration problems within minutes instead of at the end of a release cycle.',
        '**Continuous delivery** means every change that passes the pipeline is **automatically prepared for release** and could be deployed at any time by pressing a button. The artefact is built, tested and staged; the decision to ship is still human.',
        '**Continuous deployment** goes one step further: there is no button. Every change that passes the pipeline goes to production automatically.',
        'So the distinction is exactly one manual approval gate. Both require the same engineering discipline - good tests, reversible deploys, feature flags. Most organisations do continuous delivery and call it continuous deployment.',
      ],
      deeper: [
        'Continuous deployment is only responsible if you have the safety net for it: strong automated tests, progressive rollout, good observability and fast automated rollback. Without those it is not maturity, it is recklessness.',
      ],
      traps: [
        'Saying CD always means deployment. Say which one you mean, and note the difference is the approval gate.',
        'Describing CI as "we have a build server". CI is the practice of integrating frequently; the server just automates it.',
      ],
      followUps: [
        'What would you need in place before enabling continuous deployment?',
        'What does a good CI pipeline run on every commit?',
      ],
      tags: ['concepts', 'ci', 'cd'],
    },
    {
      id: 'itv-jenkins-2',
      level: 'basic',
      kind: 'mcq',
      prompt:
        'In a Jenkins declarative pipeline, which block runs regardless of whether the build succeeded or failed?',
      options: [
        { id: 'a', text: 'post { success { ... } }' },
        { id: 'b', text: 'post { always { ... } }' },
        { id: 'c', text: 'stage("Cleanup") { ... }' },
        { id: 'd', text: 'finally { ... }' },
      ],
      correct: ['b'],
      probing:
        'Basic pipeline literacy, and whether you know where cleanup and notifications belong.',
      answer: [
        '`post { always { ... } }` runs after the pipeline (or stage) finishes, whatever the result. That is where cleanup, artefact archiving and notifications belong.',
        'The other `post` conditions are `success`, `failure`, `unstable`, `aborted`, `changed` (result differs from the previous run), `fixed` and `regression`.',
        'A normal `stage` will be skipped if an earlier stage failed, so cleanup in a stage does not run when you most need it - which is exactly why `post` exists.',
        '`finally` is Groovy syntax and works in a **scripted** pipeline or inside a `script` block, but it is not a declarative pipeline construct.',
      ],
      code: [
        {
          title: 'Where each post condition fires',
          language: 'text',
          code: `pipeline {
  agent any
  stages {
    stage('Build') { steps { sh 'make build' } }
    stage('Test')  { steps { sh 'make test' } }
  }
  post {
    always {
      junit 'reports/**/*.xml'          // publish results either way
      cleanWs()                          // always clean the workspace
    }
    success  { slackSend "Build \${env.BUILD_NUMBER} passed" }
    failure  { slackSend "Build \${env.BUILD_NUMBER} FAILED" }
    unstable { slackSend "Tests are flaky on \${env.BRANCH_NAME}" }
    changed  { echo 'Result differs from the previous run' }
  }
}`,
        },
      ],
      traps: ['Putting cleanup in a final stage. It is skipped when an earlier stage fails.'],
      followUps: [
        'What is the difference between failure and unstable?',
        'How do you clean the workspace?',
      ],
      tags: ['pipeline', 'declarative', 'post'],
    },
    {
      id: 'itv-jenkins-3',
      level: 'basic',
      kind: 'open',
      prompt: 'What is a Jenkinsfile, and why keep the pipeline in the repository?',
      probing:
        'Whether you understand pipeline-as-code as a practice rather than a Jenkins feature.',
      answer: [
        'A `Jenkinsfile` is a text file in the repository root that defines the whole pipeline. Jenkins reads it from the branch being built rather than from configuration stored in the Jenkins UI.',
        'Keeping it in the repository gives you the same benefits as any other code. It is **version controlled**, so you can see who changed the pipeline and when. It is **reviewed** in the same pull request as the code it builds. It is **branched**, so a feature branch can change its own build without affecting anyone else.',
        'It also makes the pipeline **reproducible** - checking out an old commit gives you the pipeline that built it - and it removes the single biggest Jenkins failure mode, which is a controller whose configuration exists only in its own disk and in nobody’s memory.',
        'The practical version of this is a Multibranch Pipeline job: Jenkins scans the repository, finds every branch with a Jenkinsfile, and creates a job for each automatically.',
      ],
      traps: [
        'Saying "so it is in Git" without saying why that matters. Review, history and per-branch pipelines are the reasons.',
      ],
      followUps: [
        'What is a Multibranch Pipeline?',
        'How would you share pipeline logic between 50 repositories?',
      ],
      tags: ['pipeline', 'jenkinsfile', 'practices'],
    },
    {
      id: 'itv-jenkins-4',
      level: 'intermediate',
      kind: 'open',
      prompt:
        'Declarative versus scripted pipeline - what is the difference and which do you choose?',
      probing:
        'Practical judgement. The expected answer is "declarative by default, scripted only when you must".',
      answer: [
        '**Declarative** pipelines have a fixed, validated structure: `pipeline { agent ... stages { stage { steps { ... } } } post { ... } }`. Jenkins validates the shape before running, the Blue Ocean editor understands it, and it supports `post`, `when`, `options` and `environment` natively.',
        '**Scripted** pipelines are Groovy. They start with `node { ... }` and give you the full language - loops, conditionals, try/catch, functions, arbitrary objects.',
        'The default should be **declarative**, because the structure is the point: it is readable by people who do not know Groovy, it fails fast on a syntax error, and it constrains what a pipeline can become. Most pipelines genuinely are "these stages, in this order".',
        'Reach for scripted - or a `script { }` block inside a declarative pipeline, which is the usual compromise - when you need real control flow: generating stages dynamically, complex retry logic, or iterating over a list to build a matrix.',
      ],
      code: [
        {
          title: 'The same pipeline both ways',
          language: 'text',
          explanation:
            'The declarative version is longer but its shape is enforced. The scripted version is more flexible and easier to make a mess of.',
          code: `// DECLARATIVE - preferred
pipeline {
  agent { label 'linux' }
  options { timeout(time: 30, unit: 'MINUTES') }
  environment { REGISTRY = 'registry.example.com' }
  stages {
    stage('Test') {
      steps { sh 'make test' }
    }
    stage('Deploy') {
      when { branch 'main' }
      steps { sh 'make deploy' }
    }
  }
  post { always { cleanWs() } }
}

// SCRIPTED - when you need real control flow
node('linux') {
  timeout(time: 30, unit: 'MINUTES') {
    stage('Test') { sh 'make test' }
    if (env.BRANCH_NAME == 'main') {
      stage('Deploy') { sh 'make deploy' }
    }
  }
}

// THE COMPROMISE - declarative with an escape hatch
pipeline {
  agent any
  stages {
    stage('Parallel tests') {
      steps {
        script {
          def suites = ['unit', 'integration', 'e2e']
          parallel suites.collectEntries { suite ->
            ["\${suite}": { sh "make test-\${suite}" }]
          }
        }
      }
    }
  }
}`,
        },
      ],
      traps: [
        'Saying scripted is "more powerful so better". Power is the problem - pipelines become unmaintainable Groovy programs nobody can read.',
      ],
      followUps: [
        'When have you actually needed a script block?',
        'How do you run stages in parallel?',
      ],
      tags: ['pipeline', 'declarative', 'scripted', 'groovy'],
    },
    {
      id: 'itv-jenkins-5',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do you handle credentials and secrets in a Jenkins pipeline?',
      probing:
        'Security. They want the credentials store, masking, and awareness that masking is not perfect.',
      answer: [
        'Secrets go in the **Jenkins credentials store**, scoped to a folder or globally, and are referenced from the pipeline by **id** only. The Jenkinsfile never contains the value.',
        "There are two ways to use them. `withCredentials([...])` binds a credential to an environment variable for a block, which is the more explicit and preferred form. Or `environment { X = credentials('my-id') }` binds it for the whole pipeline - and for a username/password credential this helpfully creates `X_USR` and `X_PSW` as well.",
        'Jenkins **masks** credential values in the console output, replacing them with `****`. That is a safety net, not a guarantee: if the secret is transformed - base64-encoded, interpolated into a JSON blob, or echoed by a tool that reformats it - the masking will not catch it.',
        'So the real rules are: never `echo` a secret, never pass one as a command-line argument where it appears in process listings, and prefer passing them through environment variables or files that the tool reads directly.',
      ],
      deeper: [
        'For anything serious, Jenkins should not be the system of record for secrets at all. The HashiCorp Vault plugin, or a cloud secrets manager fetched at runtime, means the secret is short-lived and centrally auditable rather than sitting in Jenkins for years.',
        'The other half of this is **folder-scoped credentials** so that one team’s pipeline cannot read another team’s secrets, and disabling script approval abuse so a rogue Jenkinsfile cannot dump the credential store.',
      ],
      code: [
        {
          title: 'Both binding styles, and the mistakes',
          language: 'text',
          code: `pipeline {
  agent any

  // Whole-pipeline binding. For usernamePassword this also
  // creates REGISTRY_CREDS_USR and REGISTRY_CREDS_PSW.
  environment {
    REGISTRY_CREDS = credentials('registry-login')
  }

  stages {
    stage('Push') {
      steps {
        // Preferred: explicit, scoped to just this block
        withCredentials([usernamePassword(
          credentialsId: 'registry-login',
          usernameVariable: 'USER',
          passwordVariable: 'PASS'
        )]) {
          // Piped via stdin, so it never appears in a process list
          sh 'echo "$PASS" | docker login -u "$USER" --password-stdin registry.example.com'
        }
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
          sh 'kubectl apply -f k8s/'
        }
      }
    }
  }
}

// NEVER do these:
//   sh "echo $PASS"                          - defeats masking
//   sh "docker login -p $PASS"               - visible in ps output
//   sh "curl -H 'Auth: $TOKEN' ... | tee log" - may end up in an artefact`,
        },
      ],
      traps: [
        'Believing masking makes secrets safe. It is a best-effort filter on exact string matches.',
        'Passing a secret as a command-line flag - it shows up in `ps` for anyone on the agent.',
        'Using global credentials for everything, so every job on the controller can use every secret.',
      ],
      followUps: [
        'Why is --password-stdin better than -p?',
        'How would you integrate Vault?',
        'A secret leaked into a build log. What now?',
      ],
      tags: ['security', 'credentials', 'secrets'],
    },
    {
      id: 'itv-jenkins-6',
      level: 'intermediate',
      kind: 'open',
      prompt:
        'Explain Jenkins controller and agent architecture. Why not run builds on the controller?',
      probing:
        'Operational understanding and security awareness. Running builds on the controller is a real and common mistake.',
      answer: [
        'The **controller** (formerly "master") holds the configuration, job definitions, build history and credentials, serves the UI, and schedules work. **Agents** (formerly "slaves") are the machines that actually execute build steps.',
        'You should not run builds on the controller for three reasons. **Security**: a build runs arbitrary code from a repository, and on the controller that code has direct filesystem access to the credentials store, job configuration and every secret Jenkins holds. **Stability**: a build that consumes all memory or fills the disk takes down Jenkins itself, not just that job. **Scalability**: the controller becomes a bottleneck when it is doing both scheduling and compilation.',
        'The usual setup is a controller with **zero executors** and a pool of agents. Agents can be static VMs, but dynamic agents are better - the Kubernetes plugin spins up a Pod per build and destroys it afterwards, so every build starts from a clean, identical environment and you pay for nothing when idle.',
        'Ephemeral agents also eliminate an entire class of flaky-build problems caused by state left behind by a previous job.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'Controller and agents',
          caption:
            'Set controller executors to zero. Build code should never run where the credential store lives.',
          root: {
            label: 'Jenkins controller',
            detail: 'Scheduling, UI, config, build history, CREDENTIALS',
            tone: 'accent',
            children: [
              {
                label: 'Executors: 0',
                detail: 'Deliberately. No build code runs here.',
                tone: 'success',
              },
              {
                label: 'Static agent: build-linux-01',
                detail: 'Long-lived VM. State can accumulate between builds.',
                children: [{ label: 'Executors: 4', detail: 'Four concurrent builds' }],
              },
              {
                label: 'Dynamic agents (Kubernetes plugin)',
                detail: 'One Pod per build, destroyed afterwards',
                tone: 'success',
                children: [
                  { label: 'Pod: jenkins-agent-x7f2', detail: 'Clean every time' },
                  { label: 'Pod: jenkins-agent-k9p1', detail: 'Scales to zero when idle' },
                ],
              },
            ],
          },
        },
      ],
      code: [
        {
          title: 'A Kubernetes pod agent defined in the Jenkinsfile',
          language: 'text',
          explanation:
            'The build gets exactly the tools it declares, in a fresh Pod, and nothing persists between runs.',
          code: `pipeline {
  agent {
    kubernetes {
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          containers:
            - name: maven
              image: maven:3.9-eclipse-temurin-21
              command: ['sleep']
              args: ['infinity']
            - name: kubectl
              image: bitnami/kubectl:1.31
              command: ['sleep']
              args: ['infinity']
      '''
    }
  }
  stages {
    stage('Build') {
      steps { container('maven') { sh 'mvn -B package' } }
    }
    stage('Deploy') {
      steps { container('kubectl') { sh 'kubectl apply -f k8s/' } }
    }
  }
}`,
        },
      ],
      traps: [
        'Saying it is only about performance. The security argument is the stronger one.',
        'Forgetting that a build with controller filesystem access can read `credentials.xml` and the master key.',
      ],
      followUps: [
        'How would you scale agents automatically?',
        'What are the advantages of ephemeral agents?',
        'How do agents connect to the controller?',
      ],
      tags: ['architecture', 'agents', 'security', 'scaling'],
    },
    {
      id: 'itv-jenkins-7',
      level: 'intermediate',
      kind: 'open',
      prompt: 'What is a Jenkins shared library and when would you use one?',
      probing:
        'Whether you have dealt with Jenkins at scale, where copy-pasted Jenkinsfiles become the problem.',
      answer: [
        'A shared library is a separate Git repository of reusable Groovy code that pipelines can import with `@Library(\'name\') _`. It lets fifty repositories share one definition of "how we build and deploy" instead of fifty near-identical Jenkinsfiles.',
        'It has a fixed layout: `vars/` holds global variables and custom steps (a file `vars/buildApp.groovy` becomes a step you call as `buildApp()`), `src/` holds regular Groovy classes, and `resources/` holds non-Groovy files like templates.',
        'The typical use is a `vars/standardPipeline.groovy` that encapsulates the whole company pipeline, so an application repository’s Jenkinsfile is three lines. Changing the deployment process then means one commit in the library rather than fifty pull requests.',
        'The trade-off to acknowledge: a shared library is a deployment dependency for every pipeline. Pin it to a tag rather than tracking `main`, or a bad library commit breaks every build in the organisation simultaneously.',
      ],
      code: [
        {
          title: 'Library layout, definition and use',
          language: 'text',
          code: `// --- Library repository layout
// vars/standardPipeline.groovy
// vars/notifySlack.groovy
// src/com/acme/Docker.groovy
// resources/com/acme/deploy.yaml.tpl

// --- vars/standardPipeline.groovy
def call(Map config) {
  pipeline {
    agent { label config.get('agent', 'linux') }
    options { timeout(time: config.get('timeout', 30), unit: 'MINUTES') }
    stages {
      stage('Test')  { steps { sh config.testCommand } }
      stage('Build') { steps { sh "docker build -t \${config.image} ." } }
      stage('Deploy') {
        when { branch 'main' }
        steps { sh "kubectl set image deploy/\${config.name} app=\${config.image}" }
      }
    }
    post { always { notifySlack(currentBuild.result) } }
  }
}

// --- An application repository's ENTIRE Jenkinsfile
@Library('acme-pipelines@v2.4.0') _        // pin to a TAG, not main

standardPipeline(
  name: 'checkout-api',
  image: "registry.example.com/checkout-api:\${env.GIT_COMMIT.take(7)}",
  testCommand: 'make test'
)`,
        },
      ],
      traps: [
        "Referencing the library by branch (`@Library('x@main')`). One bad commit then breaks every pipeline at once.",
        'Putting everything in the library until nobody can tell what their build actually does. Keep it readable.',
      ],
      followUps: [
        'How do you version a shared library safely?',
        'How would you test changes to a shared library?',
      ],
      tags: ['shared library', 'scale', 'groovy'],
    },
    {
      id: 'itv-jenkins-8',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'A pipeline passes locally and on feature branches but fails intermittently on main. How do you investigate?',
      probing:
        'Systematic debugging of flakiness - one of the most valuable and least teachable DevOps skills.',
      answer: [
        'First I would establish the **pattern**, because "intermittent" usually is not random. I would look at the last twenty runs and ask: does it fail at the same stage? At a particular time of day? Only when runs overlap? Only on a specific agent?',
        'That last one is the most common answer. If failures cluster on one agent, it is environment drift - a different tool version, a full disk, leftover state from a previous build. Ephemeral agents eliminate this entire class, which is a strong argument for them.',
        "Second, **shared state**. Main often differs from feature branches in that it deploys, publishes artefacts or touches a shared environment. Two concurrent main builds using the same namespace, the same database or the same Docker tag will interfere. The fix is either a lock (`lock(resource: 'staging')`) or making the resource per-build.",
        'Third, **test flakiness** - timing-dependent tests, tests that depend on execution order, or tests hitting a real external service with rate limits. Running the failing test in isolation and in a loop usually settles this quickly.',
        'Throughout, I would resist the instinct to add a `retry`. That hides the failure and it will come back at a worse time.',
      ],
      deeper: [
        'A concrete technique: add the agent name, tool versions and relevant environment to the build log at the start of every run. When you are comparing twenty builds after the fact, having that already recorded turns a day of guessing into ten minutes of diffing.',
        'If it really is a slow external dependency and you cannot fix it, `retry` scoped to the **specific** flaky step with a clear comment is defensible. `retry` around the whole pipeline is not.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'What does the failure pattern point at?',
          caption:
            'Intermittent failures almost always have a pattern. Finding it is most of the work.',
          question: 'When you line up the last twenty runs, what correlates?',
          branches: [
            {
              condition: 'failures cluster on one agent',
              result: 'Environment drift',
              detail: 'Tool versions, disk space, leftover state. Use ephemeral agents.',
              tone: 'accent',
            },
            {
              condition: 'failures happen when runs overlap',
              result: 'Shared resource contention',
              detail: 'Same namespace, database or tag. Add a lock, or isolate per build.',
            },
            {
              condition: 'always the same test, any agent',
              result: 'A flaky test',
              detail: 'Timing, ordering, or a real external dependency',
            },
            {
              condition: 'only on main, never on branches',
              result: 'Something only main does',
              detail: 'Deploy, publish, or credentials only main can access',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Making runs comparable, and serialising the shared bit',
          language: 'text',
          code: `pipeline {
  agent { label 'linux' }
  options {
    // Do not let two main builds run at once at all
    disableConcurrentBuilds()
    timestamps()
  }
  stages {
    stage('Fingerprint the environment') {
      steps {
        // Recorded on EVERY build, so comparing runs later is trivial
        sh '''
          echo "agent=$NODE_NAME"
          uname -a
          docker --version; java -version 2>&1; node --version
          df -h /
        '''
      }
    }
    stage('Deploy to staging') {
      steps {
        // Only one build may hold staging at a time
        lock(resource: 'staging-environment') {
          sh 'make deploy-staging && make smoke-test'
        }
      }
    }
  }
}`,
        },
      ],
      traps: [
        'Wrapping the flaky stage in `retry(3)` and moving on. The failure is still there and now it is invisible.',
        'Declaring it "a Jenkins problem" without evidence. It is usually shared state or agent drift.',
      ],
      followUps: [
        'How would you prove it is the agent?',
        'When is a retry actually acceptable?',
        'How do you stop two builds deploying to staging at once?',
      ],
      tags: ['scenario', 'troubleshooting', 'flaky', 'ci'],
    },
    {
      id: 'itv-jenkins-9',
      level: 'advanced',
      kind: 'open',
      prompt: 'How would you design a CI/CD pipeline for a microservice going to Kubernetes?',
      probing:
        'An open design question. They are listening for stage ordering, artefact immutability and a deployment strategy.',
      answer: [
        'I would build it in stages that fail fast - cheapest and most likely to fail first, so feedback is quick.',
        '**On every push**: lint and static analysis, unit tests, then build the image. I would tag the image with the **commit SHA**, never `latest`, so every deployment is traceable to an exact commit and is immutable.',
        '**Then**: security scanning of the image (Trivy or similar), integration tests against the built image, and push to the registry. The key principle is **build once, promote the same artefact** - you never rebuild for staging and again for production, because then you have not tested what you shipped.',
        '**On merge to main**: deploy automatically to staging, run smoke tests, then require a manual approval for production. Production deploy is a rolling update with readiness gates, followed by automated verification and automatic rollback if it fails.',
        'The deployment itself I would do declaratively - either `kubectl apply` of manifests rendered by Kustomize or Helm, or better, GitOps: the pipeline commits the new image tag to a config repository and Argo CD or Flux reconciles it. That makes the cluster state auditable and rollback a git revert.',
      ],
      deeper: [
        'Two things I would insist on. **Immutable tags**: SHA-based, never overwritten, so "which code is in production" always has an answer. And **the same artefact through every environment** - promoting a digest, not rebuilding.',
        'For anything with real traffic I would add progressive delivery - canary or blue-green with automated analysis - so a bad release affects a fraction of users and rolls back on its own metrics rather than on someone noticing.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Stage order, cheapest failure first',
          caption:
            'Build the artefact once and promote it. Rebuilding per environment means production runs something that was never tested.',
          nodes: [
            {
              label: 'Lint and unit tests',
              detail: 'Seconds. Catches most mistakes.',
              tone: 'accent',
            },
            {
              label: 'Build image, tag with commit SHA',
              detail: 'Immutable and traceable. Never :latest.',
              arrowLabel: 'tests pass',
            },
            {
              label: 'Scan and integration-test the image',
              detail: 'Test the artefact you will actually ship',
              branch: {
                label: 'Critical CVE or test failure',
                detail: 'Stop here - nothing is pushed',
              },
            },
            {
              label: 'Push once, deploy to staging',
              detail: 'Same digest promoted onward from here',
            },
            {
              label: 'Smoke tests, then manual approval',
              detail: 'The continuous delivery gate',
            },
            {
              label: 'Production rollout, verify, auto-rollback',
              detail: 'Rolling update gated on readiness',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The shape of it',
          language: 'text',
          code: `pipeline {
  agent { kubernetes { /* pod template */ } }

  environment {
    // Immutable, traceable, built once
    IMAGE = "registry.example.com/checkout:\${env.GIT_COMMIT.take(7)}"
  }

  stages {
    stage('Verify') {
      parallel {
        stage('Lint')  { steps { sh 'make lint' } }
        stage('Unit')  { steps { sh 'make test-unit' } }
      }
    }

    stage('Build') {
      steps { sh "docker build -t \${IMAGE} ." }
    }

    stage('Scan') {
      steps { sh "trivy image --exit-code 1 --severity CRITICAL \${IMAGE}" }
    }

    stage('Integration') {
      steps { sh "IMAGE=\${IMAGE} make test-integration" }
    }

    stage('Publish') {
      when { branch 'main' }
      steps { sh "docker push \${IMAGE}" }
    }

    stage('Staging') {
      when { branch 'main' }
      steps {
        sh "kubectl -n staging set image deploy/checkout app=\${IMAGE}"
        sh "kubectl -n staging rollout status deploy/checkout --timeout=5m"
        sh 'make smoke-test-staging'
      }
    }

    stage('Approve production') {
      when { branch 'main' }
      steps {
        timeout(time: 24, unit: 'HOURS') {
          input message: "Deploy \${IMAGE} to production?", submitter: 'release-managers'
        }
      }
    }

    stage('Production') {
      when { branch 'main' }
      steps {
        // Same digest that passed staging - not a rebuild
        sh "kubectl -n prod set image deploy/checkout app=\${IMAGE}"
        script {
          try {
            sh "kubectl -n prod rollout status deploy/checkout --timeout=10m"
            sh 'make smoke-test-prod'
          } catch (err) {
            sh "kubectl -n prod rollout undo deploy/checkout"
            error "Production deploy failed and was rolled back: \${err}"
          }
        }
      }
    }
  }

  post { always { cleanWs() } }
}`,
        },
      ],
      traps: [
        'Rebuilding the image per environment. You then deploy something that was never tested.',
        'Tagging with `latest` or a branch name, so nobody can say what is running.',
        'No rollback path. A deploy stage without a failure path is half a deploy stage.',
      ],
      followUps: [
        'Why tag with the commit SHA?',
        'How would GitOps change this design?',
        'How do you roll back quickly?',
      ],
      tags: ['design', 'cicd', 'kubernetes', 'gitops'],
    },
    {
      id: 'itv-jenkins-10',
      level: 'advanced',
      kind: 'open',
      prompt: 'How do you make a Jenkins installation reproducible and disaster-recoverable?',
      probing:
        'Senior operational thinking. Snowflake Jenkins controllers are a genuine industry problem.',
      answer: [
        'The failure mode to design against is the classic one: a controller configured by hand over five years, where nobody knows how to rebuild it and the only backup is a VM snapshot.',
        'The main tool is **Configuration as Code (JCasC)**: a YAML file describing the entire controller configuration - security realm, authorisation strategy, clouds, agents, tools, plugin settings - applied at startup. The controller becomes reproducible from that file plus a plugin list.',
        'Plugins are pinned in a `plugins.txt` and baked into a **custom controller image**, so you get the same versions every time and upgrades are a reviewed change rather than a click.',
        'Jobs come from the repositories themselves via Multibranch Pipelines and shared libraries, so almost no job configuration lives on the controller at all.',
        'What genuinely must be backed up is then small: `$JENKINS_HOME` for build history and artefacts, and the credentials store with its master key. And the backup has to be **restore-tested** - an untested backup is a belief, not a control.',
      ],
      code: [
        {
          title: 'JCasC and a pinned image',
          language: 'yaml',
          explanation:
            'The controller is now rebuildable from source control. The only stateful thing left is build history and credentials.',
          code: `# jenkins.yaml - applied by the Configuration as Code plugin
jenkins:
  systemMessage: "Managed by JCasC. Do not change settings in the UI."
  numExecutors: 0                 # never build on the controller
  authorizationStrategy:
    roleBased:
      roles:
        global:
          - name: admin
            permissions: [Overall/Administer]
            entries: [{ group: platform-team }]
  clouds:
    - kubernetes:
        name: k8s
        namespace: jenkins-agents
        jenkinsUrl: http://jenkins:8080

unclassified:
  location:
    url: https://jenkins.example.com/

jobs:
  - script: >
      multibranchPipelineJob('checkout-api') {
        branchSources { git { remote('https://github.com/acme/checkout-api.git') } }
      }`,
        },
        {
          title: 'A reproducible controller image',
          language: 'dockerfile',
          code: `FROM jenkins/jenkins:2.479.1-lts-jdk21

# Pinned plugin versions, reviewed like any other dependency
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli -f /usr/share/jenkins/ref/plugins.txt

COPY jenkins.yaml /var/jenkins_home/casc.yaml
ENV CASC_JENKINS_CONFIG=/var/jenkins_home/casc.yaml

# Skip the setup wizard - configuration comes from JCasC
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"`,
        },
      ],
      traps: [
        'Backing up `$JENKINS_HOME` and calling it disaster recovery. That restores a snowflake; it does not make it reproducible.',
        'Never testing a restore.',
        'Letting people change configuration in the UI alongside JCasC - the next restart silently reverts them.',
      ],
      followUps: [
        'What still has to be backed up with JCasC in place?',
        'How do you handle plugin upgrades safely?',
        'How would you test the restore?',
      ],
      tags: ['operations', 'jcasc', 'disaster recovery', 'infrastructure as code'],
    },
  ],
}
