import type { Topic } from '../../../types'

export const jobs: Topic = {
  id: 'jobs',
  title: 'Jobs: run to completion',
  domainId: 'design-build',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 6,
  tags: ['job', 'completions', 'parallelism', 'backoffLimit', 'activeDeadlineSeconds', 'ttl'],
  oneLiner:
    'Batch work that finishes: completions, parallelism, retry limits, deadlines and automatic cleanup.',
  explanation: [
    'A **Job** creates one or more Pods and keeps going until a specified number of them complete successfully. When that count is reached the Job is Complete and creates nothing more.',
    "The four fields that define a Job's behaviour are `completions` (how many successful Pods are needed, default 1), `parallelism` (how many may run at once, default 1), `backoffLimit` (how many failures before the Job gives up, default 6), and `activeDeadlineSeconds` (a wall-clock limit for the whole Job).",
    'The Pod template must set `restartPolicy: OnFailure` or `Never`. `Always` is rejected, because a Pod that always restarts can never complete. `OnFailure` restarts the container in the same Pod; `Never` creates a new Pod for each attempt - so with `Never` you keep the failed Pods and their logs, which is usually what you want when debugging.',
    'By default, finished Jobs and their Pods stay around so you can read the logs. `ttlSecondsAfterFinished` deletes a Job automatically some seconds after it finishes, which is how you keep a namespace tidy.',
  ],
  whyItMatters: [
    'Database migrations, batch imports, report generation and one-off maintenance are all Jobs. Modelling them as Deployments produces an endless restart loop even when the work succeeds.',
    '`backoffLimit` and `activeDeadlineSeconds` are the difference between a failed Job that stops and a failed Job that retries all night.',
    'The `OnFailure` versus `Never` distinction directly affects your ability to debug: with `Never` the failed Pods remain, with their logs intact.',
  ],
  howItWorks: [
    'Non-parallel Job (`completions` unset or 1, `parallelism` unset or 1): one Pod runs; when it succeeds the Job completes.',
    'Fixed completion count: set `completions: N`. The Job runs Pods until N have succeeded, at most `parallelism` at a time. Each Pod gets an index in the annotation `batch.kubernetes.io/job-completion-index` when `completionMode: Indexed`.',
    'Work queue: set `parallelism: N` and leave `completions` unset. Pods coordinate externally (via a queue) and the Job finishes when any Pod exits successfully and no others are running.',
    '`backoffLimit` counts *failed Pods* (or container restarts with `OnFailure`) and applies exponential backoff between retries (10s, 20s, 40s...). When exceeded, the Job gets condition `Failed` with reason `BackoffLimitExceeded`.',
    '`activeDeadlineSeconds` overrides everything: when the deadline passes, running Pods are terminated and the Job is `Failed` with reason `DeadlineExceeded`, even mid-retry.',
    '`ttlSecondsAfterFinished` starts counting when the Job reaches Complete or Failed, then the Job *and its Pods* are garbage-collected.',
    '`suspend: true` pauses a Job - existing Pods are deleted and no new ones are created until you set it back to false.',
  ],
  keyObjects: [
    {
      kind: 'Job',
      apiVersion: 'batch/v1',
      purpose: 'Runs Pods until a target number complete successfully.',
      fields: [
        {
          path: 'spec.template',
          meaning: 'Pod template; restartPolicy must be OnFailure or Never.',
          required: true,
        },
        { path: 'spec.completions', meaning: 'Successful Pods required. Default 1.' },
        { path: 'spec.parallelism', meaning: 'Maximum Pods running at once. Default 1.' },
        {
          path: 'spec.backoffLimit',
          meaning: 'Failures tolerated before the Job is marked Failed. Default 6.',
        },
        {
          path: 'spec.activeDeadlineSeconds',
          meaning: 'Wall-clock limit for the whole Job; terminates it as Failed.',
        },
        {
          path: 'spec.ttlSecondsAfterFinished',
          meaning: 'Delete the Job (and Pods) this many seconds after it finishes.',
        },
        {
          path: 'spec.completionMode',
          meaning: 'NonIndexed (default) or Indexed, which gives each Pod a stable index.',
        },
        { path: 'spec.suspend', meaning: 'true pauses the Job and deletes its active Pods.' },
        { path: 'status.succeeded', meaning: 'Count of Pods that completed successfully.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'A migration that retried for six hours',
    story: [
      'A team runs a schema migration as a Job. The migration fails because a required column already exists - a genuine error, not a transient one.',
      'With default settings the Job retries six times with exponential backoff, then stops. That is fine. What went wrong was a copy-pasted `backoffLimit: 100` from an unrelated manifest: the Job retried for hours, each attempt holding a database lock briefly and adding noise to the alerting.',
      'The fix has two parts. `backoffLimit: 2` because a migration that fails twice will not succeed on the tenth try. And `activeDeadlineSeconds: 600`, so even a hanging attempt cannot run past ten minutes.',
      'They also switched to `restartPolicy: Never` so each attempt leaves its own Pod behind, and `kubectl logs job/migrate` was enough to see exactly which statement failed.',
    ],
    code: [
      {
        title: 'Reading a failed Job',
        language: 'bash',
        code: `kubectl get job migrate -n shop
# NAME      STATUS   COMPLETIONS   DURATION   AGE
# migrate   Failed   0/1           7m12s      7m12s

kubectl describe job migrate -n shop | grep -iE 'reason|message|pods statuses'
# Pods Statuses:  0 Active / 0 Succeeded / 3 Failed
# Warning  BackoffLimitExceeded  Job has reached the specified backoff limit

# With restartPolicy: Never each attempt is a separate Pod you can still read:
kubectl get pods -n shop -l batch.kubernetes.io/job-name=migrate
kubectl logs -n shop -l batch.kubernetes.io/job-name=migrate --tail=20`,
        explanation:
          'The label `batch.kubernetes.io/job-name` is added automatically, which is how you collect logs from every attempt in one command.',
        placeholders: ['migrate', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A well-behaved one-shot Job',
      language: 'yaml',
      code: `apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
  namespace: shop
spec:
  backoffLimit: 2 # give up after 2 failures
  activeDeadlineSeconds: 600 # and never run longer than 10 minutes
  ttlSecondsAfterFinished: 3600 # clean up an hour after finishing
  template:
    spec:
      restartPolicy: Never # each attempt is its own Pod, logs preserved
      containers:
        - name: migrate
          image: registry.example.com/shop/migrate:1.4.2
          command: ["/app/migrate", "--up"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi`,
      explanation:
        'Note there is no `selector` and no `metadata.labels` on the template - the Job controller generates both, and hand-writing them causes subtle collisions.',
      placeholders: [
        'migrate',
        'shop',
        'registry.example.com/shop/migrate:1.4.2',
        'db-credentials',
      ],
    },
    {
      title: 'Fixed completions with parallelism',
      language: 'yaml',
      code: `apiVersion: batch/v1
kind: Job
metadata:
  name: thumbnail-batch
  namespace: shop
spec:
  completions: 12 # 12 Pods must succeed in total
  parallelism: 3 # at most 3 running at any moment
  backoffLimit: 4
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: worker
          image: busybox:1.36
          command: ["sh", "-c", "echo processing; sleep 5"]`,
      explanation:
        'Twelve units of work, three at a time, so four waves. Use this shape when each Pod does an equal, independent slice of the work.',
      placeholders: ['thumbnail-batch', 'shop'],
    },
    {
      title: 'Indexed completions, where each Pod knows its slice',
      language: 'yaml',
      code: `apiVersion: batch/v1
kind: Job
metadata:
  name: shard-import
  namespace: shop
spec:
  completions: 4
  parallelism: 4
  completionMode: Indexed # each Pod gets index 0..3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: importer
          image: busybox:1.36
          command:
            - sh
            - -c
            - 'echo "importing shard $JOB_COMPLETION_INDEX"; sleep 3'
          env:
            - name: JOB_COMPLETION_INDEX
              valueFrom:
                fieldRef:
                  fieldPath: metadata.annotations['batch.kubernetes.io/job-completion-index']`,
      explanation:
        'Indexed mode is how you split fixed work without an external queue: shard 0 goes to index 0, and a retried Pod gets the same index, so the work stays deterministic.',
      placeholders: ['shard-import', 'shop'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl create job migrate --image=busybox:1.36 -n shop -- sh -c "echo migrating; sleep 3"',
      what: 'Creates a Job with completions 1. Everything after `--` becomes the container command.',
      expected: 'job.batch/migrate created',
      placeholders: ['migrate', 'shop'],
    },
    {
      command: 'kubectl create job manual --from=cronjob/nightly -n shop',
      what: "Creates a Job immediately from an existing CronJob's template - the standard way to trigger a scheduled task by hand.",
      expected: 'job.batch/manual created',
      placeholders: ['manual', 'nightly', 'shop'],
    },
    {
      command:
        'kubectl create job batch --image=busybox:1.36 --dry-run=client -o yaml -n shop -- sh -c "echo hi" > job.yaml',
      what: 'Generates a Job manifest you can extend with completions, parallelism and deadlines.',
      expected: 'A file with apiVersion batch/v1 and restartPolicy Never.',
      placeholders: ['batch', 'shop'],
    },
    {
      command: 'kubectl get jobs -n shop',
      what: 'Lists Jobs with their completion counts and duration.',
      expected: 'STATUS Complete and COMPLETIONS 1/1 for a successful Job.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl logs job/migrate -n shop',
      what: "Reads the log of one of the Job's Pods. Add `--all-containers` or a selector for multi-Pod Jobs.",
      expected: 'The batch output.',
      placeholders: ['migrate', 'shop'],
    },
    {
      command:
        'kubectl logs -n shop -l batch.kubernetes.io/job-name=thumbnail-batch --tail=5 --prefix',
      what: 'Collects logs from every Pod of a parallel Job, prefixed with the Pod name.',
      expected: 'Interleaved output labelled per Pod.',
      placeholders: ['shop', 'thumbnail-batch'],
    },
    {
      command: 'kubectl wait --for=condition=complete job/migrate -n shop --timeout=300s',
      what: 'Blocks until the Job completes - the correct way to gate a follow-up step.',
      expected: 'job.batch/migrate condition met',
      placeholders: ['migrate', 'shop'],
    },
    {
      command: 'kubectl delete job migrate -n shop',
      what: 'Deletes the Job and, by default, its Pods.',
      expected: 'job.batch "migrate" deleted',
      placeholders: ['migrate', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate with `kubectl create job ... --dry-run=client -o yaml` so `apiVersion: batch/v1` and `restartPolicy: Never` are already correct.',
      'Add `completions`, `parallelism`, `backoffLimit`, `activeDeadlineSeconds` and `ttlSecondsAfterFinished` as the task requires.',
      'Do not write `spec.selector` or template labels - the controller manages them.',
      'Apply, then `kubectl wait --for=condition=complete job/<name>` to verify rather than polling by eye.',
    ],
    code: [
      {
        title: 'Generate then extend',
        language: 'bash',
        code: `kubectl create job importer --image=busybox:1.36 --dry-run=client -o yaml \\
  -- sh -c 'echo importing; sleep 5' > importer.yaml

# add to importer.yaml:
#   spec.completions: 6
#   spec.parallelism: 2
#   spec.backoffLimit: 3
#   spec.ttlSecondsAfterFinished: 300

kubectl apply -f importer.yaml
kubectl wait --for=condition=complete job/importer --timeout=180s
kubectl get job importer
# NAME       STATUS     COMPLETIONS   DURATION   AGE
# importer   Complete   6/6           18s        20s`,
        placeholders: ['importer'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get job migrate -n shop -o wide',
      what: 'Completion count, duration and the container image.',
      expected: 'COMPLETIONS 1/1 and STATUS Complete.',
      placeholders: ['migrate', 'shop'],
    },
    {
      command:
        'kubectl get job migrate -n shop -o jsonpath=\'{.status.succeeded}/{.spec.completions}{"\\n"}\'',
      what: 'The numeric proof a Job did its work.',
      expected: '1/1',
      placeholders: ['migrate', 'shop'],
    },
    {
      command:
        'kubectl get job migrate -n shop -o jsonpath=\'{range .status.conditions[*]}{.type}={.status}{"\\n"}{end}\'',
      what: 'Shows the Complete or Failed condition explicitly.',
      expected: 'Complete=True',
      placeholders: ['migrate', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe job migrate -n shop',
      what: 'Pods Statuses line plus events including BackoffLimitExceeded or DeadlineExceeded.',
      expected: '"Pods Statuses: 0 Active / 1 Succeeded / 0 Failed" when healthy.',
      placeholders: ['migrate', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop -l batch.kubernetes.io/job-name=migrate',
      what: 'Lists every Pod the Job created, including failed attempts (with restartPolicy Never).',
      expected: 'One or more Pods with STATUS Completed or Error.',
      placeholders: ['shop', 'migrate'],
    },
    {
      command: 'kubectl logs -n shop -l batch.kubernetes.io/job-name=migrate --previous --tail=50',
      what: 'With `restartPolicy: OnFailure`, previous container attempts are only visible with --previous.',
      expected: 'Output from the failed attempt.',
      placeholders: ['shop', 'migrate'],
    },
    {
      command: 'kubectl apply -f job.yaml',
      what: 'A template with restartPolicy Always is rejected here.',
      expected: 'Invalid value: "Always": supported values: "OnFailure", "Never"',
      placeholders: ['job.yaml'],
    },
  ],
  commonMistakes: [
    'Leaving `restartPolicy: Always` in the Pod template - the apply is rejected.',
    'Using a Deployment for batch work, so a successful exit is treated as a crash.',
    'Copying a large `backoffLimit`, turning a permanent failure into hours of retries.',
    'Writing `spec.selector` or template labels by hand; the Job controller owns them and collisions cause strange behaviour.',
    "Editing a running Job's template. `spec.template` is immutable - delete and recreate.",
    'Expecting `kubectl logs job/<name>` to show every Pod of a parallel Job. Use the `batch.kubernetes.io/job-name` selector.',
    'Forgetting that finished Jobs persist. Without `ttlSecondsAfterFinished`, a namespace fills with Completed Pods.',
  ],
  examTips: [
    '`kubectl create job <name> --image=<img> -- <cmd>` plus a small edit handles most Job tasks.',
    'If a task gives you a number of runs and a concurrency limit, they map exactly to `completions` and `parallelism`.',
    '"Should stop retrying after N attempts" → `backoffLimit: N`. "Must not run longer than N seconds" → `activeDeadlineSeconds: N`.',
    '`kubectl create job x --from=cronjob/y` is the answer to "trigger the scheduled job now".',
    'Prefer `restartPolicy: Never` in practice tasks so failed attempts leave readable Pods behind.',
  ],
  summary: [
    'A Job runs Pods until `completions` succeed, at most `parallelism` at a time.',
    '`restartPolicy` must be OnFailure or Never; Always is invalid.',
    '`backoffLimit` bounds retries; `activeDeadlineSeconds` bounds total time; `ttlSecondsAfterFinished` cleans up.',
    '`completionMode: Indexed` gives each Pod a stable index for deterministic sharding.',
    'Logs across attempts: `-l batch.kubernetes.io/job-name=<job>`.',
  ],
  practice: [
    {
      id: 'job-p1',
      level: 'beginner',
      prompt:
        'Write the imperative command that creates a Job named `hello` running `busybox:1.36` and printing "hello ckad".',
      answer: 'kubectl create job hello --image=busybox:1.36 -- sh -c "echo hello ckad"',
      explanation:
        'The generator sets `restartPolicy: Never` and `backoffLimit: 6`. Verify with `kubectl logs job/hello`.',
    },
    {
      id: 'job-p2',
      level: 'intermediate',
      prompt:
        'A Job must process 10 items, no more than 2 at a time, give up after 3 failures, and never run for more than 5 minutes. Write the `spec` fields.',
      answer:
        'spec:\n  completions: 10\n  parallelism: 2\n  backoffLimit: 3\n  activeDeadlineSeconds: 300',
      explanation:
        'If the deadline is reached first, the Job is Failed with reason DeadlineExceeded regardless of how many completions succeeded - `activeDeadlineSeconds` outranks the retry budget.',
    },
    {
      id: 'job-p3',
      level: 'advanced',
      prompt:
        'A Job with `restartPolicy: OnFailure` has failed. `kubectl get pods` shows one Pod with 5 restarts. How do you read the error, and why would `restartPolicy: Never` have been easier?',
      answer:
        'Read it with `kubectl logs <pod> --previous` (the current attempt may be empty or mid-restart). With `restartPolicy: Never`, each attempt creates a separate Pod that stays in Error state, so `kubectl logs -l batch.kubernetes.io/job-name=<job>` shows every attempt without needing --previous.',
      explanation:
        'OnFailure restarts the container inside the same Pod, so only the previous attempt is retained. Never trades a few extra Pod objects for much better debuggability.',
    },
  ],
  lab: {
    title: 'Completions, parallelism and failure limits',
    scenario:
      'You will run a successful Job, a parallel Job, a Job that exhausts its backoff limit, and a Job stopped by its deadline - then read the status field that distinguishes each.',
    prerequisites: ['A cluster with capacity for three small Pods at once'],
    tasks: [
      { instruction: 'Create namespace `job-lab` and set it as default.' },
      {
        instruction:
          'Create a Job `once` that prints a message and completes; verify COMPLETIONS 1/1.',
      },
      {
        instruction:
          'Create a Job `batch6` with 6 completions and parallelism 3, and watch it complete in two waves.',
      },
      {
        instruction:
          'Create a Job `doomed` whose container always exits 1, with backoffLimit 2, and confirm it ends Failed with BackoffLimitExceeded.',
      },
      {
        instruction:
          'Create a Job `slow` that sleeps 300 seconds with activeDeadlineSeconds 20, and confirm DeadlineExceeded.',
      },
      { instruction: 'Read the logs of every Pod of `batch6` in one command.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2',
        language: 'bash',
        code: `kubectl create namespace job-lab
kubectl config set-context --current --namespace=job-lab

kubectl create job once --image=busybox:1.36 -- sh -c 'echo one shot done'
kubectl wait --for=condition=complete job/once --timeout=120s
kubectl get job once
# NAME   STATUS     COMPLETIONS   DURATION   AGE
# once   Complete   1/1           4s         8s
kubectl logs job/once
# one shot done`,
      },
      {
        title: 'Steps 3-5 - three more Jobs',
        language: 'yaml',
        code: `# jobs.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch6
  namespace: job-lab
spec:
  completions: 6
  parallelism: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: w
          image: busybox:1.36
          command: ["sh", "-c", "echo working on $(hostname); sleep 4"]
---
apiVersion: batch/v1
kind: Job
metadata:
  name: doomed
  namespace: job-lab
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: w
          image: busybox:1.36
          command: ["sh", "-c", "echo about to fail; exit 1"]
---
apiVersion: batch/v1
kind: Job
metadata:
  name: slow
  namespace: job-lab
spec:
  activeDeadlineSeconds: 20
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: w
          image: busybox:1.36
          command: ["sleep", "300"]`,
      },
      {
        title: 'Apply and observe all three outcomes',
        language: 'bash',
        code: `kubectl apply -f jobs.yaml

kubectl get pods -l batch.kubernetes.io/job-name=batch6 -w
# three Pods Running, then Completed, then three more   (Ctrl+C)

kubectl wait --for=condition=complete job/batch6 --timeout=180s
kubectl get job batch6
# batch6   Complete   6/6   11s   15s

sleep 60
kubectl get jobs
# NAME     STATUS     COMPLETIONS   DURATION   AGE
# batch6   Complete   6/6           11s        70s
# doomed   Failed     0/1           45s        70s
# once     Complete   1/1           4s         2m
# slow     Failed     0/1           25s        70s

kubectl describe job doomed | grep -iE 'reason|message'
# Warning  BackoffLimitExceeded  Job has reached the specified backoff limit

kubectl describe job slow | grep -iE 'reason|message'
# Warning  DeadlineExceeded  Job was active longer than specified deadline`,
      },
      {
        title: 'Step 6 - logs from every Pod, then cleanup',
        language: 'bash',
        code: `kubectl logs -l batch.kubernetes.io/job-name=batch6 --prefix --tail=1
# [pod/batch6-2xk4l/w] working on batch6-2xk4l
# [pod/batch6-8n7pq/w] working on batch6-8n7pq
# ... one line per Pod

kubectl config set-context --current --namespace=default
kubectl delete namespace job-lab`,
      },
    ],
    verification: [
      {
        command:
          "kubectl get jobs -n job-lab -o custom-columns='JOB:.metadata.name,SUCCEEDED:.status.succeeded,FAILED:.status.failed'",
        what: 'Compares the outcome of all four Jobs numerically.',
        expected: 'batch6 6 successes; doomed and slow with failures and no successes.',
      },
      {
        command:
          'kubectl get job doomed -n job-lab -o jsonpath=\'{.status.conditions[?(@.type=="Failed")].reason}{"\\n"}\'',
        what: 'Reads the machine-readable failure reason.',
        expected: 'BackoffLimitExceeded',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace job-lab',
        what: 'Removes the lab namespace and all Jobs.',
        expected: 'namespace "job-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['cronjobs', 'workload-resources', 'pods'],
  docs: [{ title: 'Jobs', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/job/' }],
}
