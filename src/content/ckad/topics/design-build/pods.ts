import type { Topic } from '../../../types'

export const pods: Topic = {
  id: 'pods',
  title: 'Pods in depth',
  domainId: 'design-build',
  difficulty: 'beginner',
  estimatedMinutes: 22,
  order: 2,
  tags: [
    'pod',
    'restartPolicy',
    'lifecycle',
    'phase',
    'conditions',
    'terminationGracePeriodSeconds',
  ],
  oneLiner:
    'The Pod lifecycle, restart policies, the fields you are allowed to change after creation, and how a Pod shuts down.',
  explanation: [
    'A Pod is the smallest object Kubernetes schedules. It wraps one or more containers that always run on the same node, share one network namespace (one IP, one port space, reachable over `localhost`) and can share volumes.',
    'A Pod is mostly **immutable** once created. You may change the container image, Pod tolerations (adding only), `activeDeadlineSeconds`, and - since native sidecar support - the image of an init container. Everything else requires deleting and recreating the Pod, which is why you normally let a Deployment or Job own Pods for you.',
    'A Pod moves through **phases**: `Pending` (accepted but not yet running - scheduling or image pull), `Running` (bound to a node with at least one container running), `Succeeded` (all containers exited 0 and will not restart), `Failed` (all terminated, at least one non-zero), `Unknown`.',
    'Phases are coarse. **Conditions** are the useful detail: `PodScheduled`, `Initialized`, `ContainersReady` and `Ready`. A Pod can be `Running` but not `Ready`, which is exactly what a failing readiness probe looks like - and Services exclude it while that is true.',
  ],
  whyItMatters: [
    'Every workload object ultimately produces a Pod spec, so learning the Pod spec once pays off for Deployments, Jobs, CronJobs, DaemonSets and StatefulSets.',
    'The READY column (`1/2`) and the STATUS column say different things. Reading them correctly is the difference between debugging the app and debugging the probe.',
    "Knowing what is immutable saves time: if a task asks you to change a Pod's resource limits, you already know you must recreate it, and that `kubectl replace --force` is the fast route.",
  ],
  howItWorks: [
    '`restartPolicy` applies to the whole Pod: `Always` (default - restart containers forever), `OnFailure` (restart only on non-zero exit), `Never`. Deployments require `Always`; Jobs require `OnFailure` or `Never`.',
    'Restarts are per container and back off exponentially: 10s, 20s, 40s, up to 5 minutes. That backoff is what `CrashLoopBackOff` reports - the container is not broken *right now*, it is waiting to be retried.',
    'Startup order: init containers run to completion one after another, then all regular containers start in parallel. Native sidecars (init containers with `restartPolicy: Always`) start before the regular containers and keep running alongside them.',
    'Shutdown: the API server sets a `deletionTimestamp`, the Pod is removed from Service endpoints, `preStop` hooks run, then SIGTERM goes to PID 1 of each container. After `terminationGracePeriodSeconds` (default 30) anything still alive gets SIGKILL.',
    "A Pod's IP is assigned by the CNI plugin at start and is not stable across restarts of the Pod. That is the entire reason Services exist.",
    '`spec.nodeName` is set by the scheduler. `spec.nodeSelector`, affinity rules and tolerations constrain which nodes are acceptable.',
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'The scheduling and lifecycle unit for containers.',
      fields: [
        {
          path: 'spec.containers[]',
          meaning: 'Regular containers, started in parallel after init containers finish.',
          required: true,
        },
        {
          path: 'spec.initContainers[]',
          meaning: 'Run sequentially to completion before regular containers start.',
        },
        {
          path: 'spec.restartPolicy',
          meaning: 'Always (default), OnFailure, Never - applies to all containers in the Pod.',
        },
        {
          path: 'spec.terminationGracePeriodSeconds',
          meaning: 'Seconds between SIGTERM and SIGKILL. Default 30.',
        },
        {
          path: 'spec.activeDeadlineSeconds',
          meaning:
            'Hard wall-clock limit; the Pod is marked Failed when exceeded. Mutable after creation.',
        },
        { path: 'spec.nodeSelector', meaning: 'Simple node label requirement for scheduling.' },
        { path: 'status.phase', meaning: 'Pending / Running / Succeeded / Failed / Unknown.' },
        {
          path: 'status.conditions[]',
          meaning:
            'PodScheduled, Initialized, ContainersReady, Ready - with timestamps and reasons.',
        },
        {
          path: 'status.containerStatuses[].restartCount',
          meaning: 'How many times this container has been restarted.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Running but not Ready for eleven minutes',
    story: [
      'A Java service takes about 90 seconds to warm its caches. Its readiness probe has `initialDelaySeconds: 5` and `failureThreshold: 3`, so the probe starts failing almost immediately.',
      '`kubectl get pods` shows `1/1`? No - it shows `0/1 Running`, which confuses the team because the container clearly started and the logs look healthy.',
      '`kubectl describe pod` explains it: `Readiness probe failed: HTTP probe failed with statuscode: 503`. The container is running, but the Pod is not Ready, so the Service has no endpoints and the load balancer returns 503 to users.',
      'The fix is a `startupProbe` with a generous `failureThreshold`, which lets the app take as long as it needs to boot while keeping the readiness probe tight afterwards. The Pod then reaches `1/1` and traffic flows.',
    ],
    code: [
      {
        title: 'Reading READY versus STATUS',
        language: 'bash',
        code: `kubectl get pods -n shop
# NAME                   READY   STATUS    RESTARTS   AGE
# checkout-1             0/1     Running   0          11m    <- started, not Ready
# inventory-1            1/1     Running   0          11m    <- healthy
# reports-1              0/1     Pending   0          11m    <- never scheduled
# mailer-1               0/1     CrashLoopBackOff  6   11m    <- starts then exits

kubectl get pod checkout-1 -n shop -o jsonpath='{range .status.conditions[*]}{.type}={.status}{"  "}{end}{"\\n"}'
# PodScheduled=True  Initialized=True  ContainersReady=False  Ready=False`,
        explanation:
          'READY is "containers ready / containers total". STATUS is the phase or the reason a container is waiting. Different columns, different diagnoses.',
        placeholders: ['shop', 'checkout-1'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A Pod using most of the fields you will be asked about',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: checkout
  namespace: shop
  labels:
    app: checkout
spec:
  restartPolicy: Always # default; Jobs would use OnFailure or Never
  terminationGracePeriodSeconds: 45 # give the app time to drain connections
  serviceAccountName: checkout-sa # identity for API calls
  nodeSelector:
    kubernetes.io/os: linux
  volumes:
    - name: cache
      emptyDir: {}
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ["sh", "-c", "until nc -z postgres 5432; do sleep 2; done"]
  containers:
    - name: app
      image: registry.example.com/shop/checkout:1.4.2
      ports:
        - name: http
          containerPort: 8080
      env:
        - name: LOG_LEVEL
          value: info
      volumeMounts:
        - name: cache
          mountPath: /var/cache/app
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: "1"
          memory: 512Mi
      readinessProbe:
        httpGet:
          path: /readyz
          port: http # a named port works here
        periodSeconds: 5
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "sleep 5"] # let endpoints update before exiting`,
      explanation:
        'The `preStop` sleep is a common production trick: it holds the container open for a few seconds after removal from endpoints, so in-flight requests are not cut off.',
      placeholders: ['checkout', 'shop', 'registry.example.com/shop/checkout:1.4.2'],
    },
    {
      title: 'restartPolicy in practice',
      language: 'yaml',
      code: `# A one-shot Pod that must NOT be restarted when it finishes
apiVersion: v1
kind: Pod
metadata:
  name: migrate-once
  namespace: shop
spec:
  restartPolicy: Never # Succeeded stays Succeeded
  containers:
    - name: migrate
      image: registry.example.com/shop/migrate:1.4.2
      command: ["/app/migrate", "--up"]`,
      explanation:
        'With the default `Always`, a container that exits 0 is restarted, so the Pod cycles and eventually reports CrashLoopBackOff even though nothing failed. Batch work needs `Never` or `OnFailure` - or, better, a Job.',
      placeholders: ['migrate-once', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl run checkout --image=nginx:1.27-alpine --port=8080 -n shop',
      what: 'Creates a single Pod (not a Deployment) with a declared container port.',
      expected: 'pod/checkout created',
      placeholders: ['checkout', 'shop'],
    },
    {
      command: 'kubectl run checkout --image=nginx:1.27-alpine --restart=Never -n shop',
      what: 'Creates a Pod whose restartPolicy is Never - useful for one-shot work.',
      expected: 'pod/checkout created',
      placeholders: ['checkout', 'shop'],
    },
    {
      command: 'kubectl run tmp --image=busybox:1.36 --rm -it --restart=Never -n shop -- sh',
      what: 'Starts an interactive throwaway Pod and deletes it on exit - the standard in-cluster debug shell.',
      expected: 'A shell prompt inside the container; the Pod disappears when you type exit.',
      placeholders: ['tmp', 'shop'],
    },
    {
      command: 'kubectl delete pod checkout -n shop --grace-period=45',
      what: 'Deletes the Pod, allowing 45 seconds of graceful shutdown.',
      expected: 'pod "checkout" deleted',
      placeholders: ['checkout', 'shop'],
    },
    {
      command: 'kubectl wait --for=condition=Ready pod/checkout -n shop --timeout=90s',
      what: 'Blocks until the Pod is Ready, which is far better than sleeping a guessed number of seconds.',
      expected: 'pod/checkout condition met',
      placeholders: ['checkout', 'shop'],
    },
    {
      command:
        'kubectl set image pod/checkout app=registry.example.com/shop/checkout:1.4.3 -n shop',
      what: 'One of the few in-place edits a Pod allows - changing a container image.',
      expected: 'pod/checkout image updated',
      placeholders: ['checkout', 'app', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate a skeleton with `kubectl run <name> --image=<image> --dry-run=client -o yaml > pod.yaml`.',
      'Add the fields you need: env, volumes, probes, resources, securityContext.',
      'Apply, then wait on a condition rather than guessing: `kubectl wait --for=condition=Ready pod/<name>`.',
      'To change an immutable field, edit the file and use `kubectl replace --force -f pod.yaml`, accepting that the Pod is recreated.',
    ],
    code: [
      {
        title: 'Changing an immutable field',
        language: 'bash',
        code: `# Try to change resources on a live Pod
kubectl edit pod checkout -n shop
# error: pods "checkout" is invalid: spec: Forbidden: pod updates may not
# change fields other than \`spec.containers[*].image\`, ... (truncated)

# Correct approach: edit the file, then recreate
kubectl get pod checkout -n shop -o yaml > checkout.yaml
vi checkout.yaml                       # change resources
kubectl replace --force -f checkout.yaml
# pod "checkout" deleted
# pod/checkout replaced`,
        explanation:
          '`replace --force` deletes and recreates in one command. It is the accepted answer whenever an exam task requires changing an immutable Pod field.',
        placeholders: ['checkout', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pod checkout -n shop -o wide',
      what: 'Phase, readiness, restarts, node and Pod IP in one line.',
      expected: 'READY 1/1, STATUS Running, an IP and a NODE.',
      placeholders: ['checkout', 'shop'],
    },
    {
      command:
        'kubectl get pod checkout -n shop -o jsonpath=\'{range .status.conditions[*]}{.type}={.status}{"\\n"}{end}\'',
      what: 'Lists each condition with its value - the precise way to see where startup stopped.',
      expected: 'PodScheduled=True, Initialized=True, ContainersReady=True, Ready=True.',
      placeholders: ['checkout', 'shop'],
    },
    {
      command:
        'kubectl get pod checkout -n shop -o jsonpath=\'{.status.containerStatuses[0].restartCount}{"\\n"}\'',
      what: 'Restart count for the first container - a non-zero value with a Running status means it crashed and recovered.',
      expected: '0 for a healthy Pod.',
      placeholders: ['checkout', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod checkout -n shop',
      what: 'Container states, last termination reason and exit code, probe failures, and the event list.',
      expected:
        'A "Last State: Terminated, Reason: Error, Exit Code: 1" block when a container has crashed.',
      placeholders: ['checkout', 'shop'],
    },
    {
      command: 'kubectl logs checkout -n shop --previous',
      what: 'Logs of the *previous* container instance - the only way to see why a CrashLoopBackOff container died.',
      expected: 'The stack trace or error from the crashed run.',
      placeholders: ['checkout', 'shop'],
    },
    {
      command:
        'kubectl get pod checkout -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.exitCode}{"\\n"}\'',
      what: 'The exit code of the previous run: 1 = application error, 137 = SIGKILL (often OOM), 143 = SIGTERM.',
      expected: 'A number.',
      placeholders: ['checkout', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --field-selector involvedObject.name=checkout',
      what: 'Only the events for this Pod, in one short list.',
      expected: 'Scheduled, Pulled, Created, Started, and any Unhealthy or BackOff warnings.',
      placeholders: ['shop', 'checkout'],
    },
  ],
  commonMistakes: [
    'Creating a bare Pod when the task asked for a Deployment, or vice versa. A bare Pod is never rescheduled if its node dies.',
    'Leaving `restartPolicy: Always` on a one-shot container, producing a fake CrashLoopBackOff for a job that actually succeeded.',
    'Reading `0/1 Running` as "broken container" when it means "readiness probe not passing".',
    'Trying to `kubectl edit` an immutable Pod field and giving up when it errors, instead of using `replace --force`.',
    'Assuming a Pod IP is stable. It changes whenever the Pod is recreated - use a Service.',
    'Forgetting `--previous` when reading logs of a crash-looping container, and seeing only the empty current attempt.',
    'Setting `containerPort` and expecting external access. It documents the port; a Service exposes it.',
  ],
  examTips: [
    '`kubectl run <name> --image=<img> --dry-run=client -o yaml` is the fastest Pod skeleton generator; add `--command -- sleep 3600` for a scratch Pod.',
    '`kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh` is the connectivity-test Pod you will use in networking tasks.',
    'Use `kubectl wait --for=condition=Ready pod/<name> --timeout=60s` instead of sleeping - it is faster and it is self-documenting.',
    'When a task requires changing something immutable, say `replace --force` in your head immediately rather than fighting `edit`.',
    'Exit code 137 almost always means the container was killed - check `describe` for OOMKilled.',
  ],
  summary: [
    'Pods are co-scheduled containers sharing an IP and optional volumes; nearly every field is immutable after creation.',
    'Phases are coarse (Pending/Running/Succeeded/Failed); conditions (PodScheduled, Initialized, ContainersReady, Ready) tell you where startup stopped.',
    '`restartPolicy` is Pod-wide: Always for services, OnFailure/Never for batch work.',
    'Shutdown is remove-from-endpoints → preStop → SIGTERM → grace period → SIGKILL.',
    '`kubectl replace --force -f` is how you change an immutable field.',
  ],
  practice: [
    {
      id: 'pod-p1',
      level: 'beginner',
      prompt:
        'A Pod shows `0/1 Running`. Is the container running, and is the Pod receiving Service traffic?',
      answer:
        'Yes, the container is running. No, it is not receiving traffic: `0/1` means zero of one containers are *Ready*, so the Pod is excluded from Service endpoints. Almost always a failing readiness probe.',
      explanation:
        'Confirm with `kubectl describe pod <name>` and look for "Readiness probe failed". Compare against `1/1 Running`, which is the healthy state.',
    },
    {
      id: 'pod-p2',
      level: 'intermediate',
      prompt:
        'A container that finishes its work successfully keeps restarting and the Pod eventually reports CrashLoopBackOff. The application logs show no errors. What is wrong and how do you fix it?',
      answer:
        '`restartPolicy` is `Always` (the default), so Kubernetes restarts the container every time it exits - even with exit code 0. Set `restartPolicy: Never` or `OnFailure`, or model the work as a Job.',
      explanation:
        "You can confirm it with `kubectl get pod <name> -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'` - an exit code of 0 with restarts climbing is the signature.",
    },
    {
      id: 'pod-p3',
      level: 'advanced',
      prompt:
        'Write the two commands that (a) prove a Pod named `api` in `shop` was killed for exceeding its memory limit, and (b) show the log output from the killed instance.',
      answer:
        "a) kubectl describe pod api -n shop | grep -iE 'reason|exit code'    →  Last State: Terminated, Reason: OOMKilled, Exit Code: 137\nb) kubectl logs api -n shop --previous",
      explanation:
        'OOMKilled comes from the kernel, so nothing appears in the application log at the moment of death - `--previous` shows what it managed to log before being killed. The fix is a higher `resources.limits.memory` or a lower application heap setting.',
    },
  ],
  lab: {
    title: 'Drive a Pod through every phase',
    scenario:
      'You will create Pods that succeed, that fail, that crash-loop and that never schedule, and read the exact field that distinguishes each case. This is the diagnostic muscle the exam tests.',
    prerequisites: ['A cluster with at least one Ready node'],
    tasks: [
      { instruction: 'Create namespace `pod-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod `ok` that runs `echo done` with restartPolicy Never, and confirm it reaches Succeeded.',
      },
      {
        instruction:
          'Create a Pod `fails` that exits with code 3 and restartPolicy Never, and confirm it reaches Failed with exit code 3.',
      },
      {
        instruction:
          'Create a Pod `looper` that exits immediately with the default restartPolicy, and watch it reach CrashLoopBackOff.',
      },
      {
        instruction:
          'Create a Pod `unschedulable` requesting 100 CPUs and confirm it stays Pending with a FailedScheduling event.',
      },
      { instruction: 'For each Pod, print its phase in one command.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'All four Pods in one manifest',
        language: 'yaml',
        code: `# phases.yaml
apiVersion: v1
kind: Pod
metadata:
  name: ok
  namespace: pod-lab
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo done"]
---
apiVersion: v1
kind: Pod
metadata:
  name: fails
  namespace: pod-lab
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo failing; exit 3"]
---
apiVersion: v1
kind: Pod
metadata:
  name: looper
  namespace: pod-lab
spec:
  # restartPolicy defaults to Always, so an immediate exit becomes a crash loop
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo starting; exit 1"]
---
apiVersion: v1
kind: Pod
metadata:
  name: unschedulable
  namespace: pod-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"]
      resources:
        requests:
          cpu: "100"`,
      },
      {
        title: 'Apply and observe',
        language: 'bash',
        code: `kubectl create namespace pod-lab
kubectl config set-context --current --namespace=pod-lab
kubectl apply -f phases.yaml

sleep 20   # let the crash loop back off at least once
kubectl get pods
# NAME            READY   STATUS             RESTARTS   AGE
# fails           0/1     Error              0          20s
# looper          0/1     CrashLoopBackOff   2          20s
# ok              0/1     Completed          0          20s
# unschedulable   0/1     Pending            0          20s`,
      },
      {
        title: 'Step 6 - phases and exit codes',
        language: 'bash',
        code: `kubectl get pods -o custom-columns='POD:.metadata.name,PHASE:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount'
# POD             PHASE       RESTARTS
# fails           Failed      0
# looper          Running     3
# ok              Succeeded   0
# unschedulable   Pending     <none>

kubectl get pod fails -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}{"\\n"}'
# 3

kubectl logs looper --previous
# starting

kubectl describe pod unschedulable | grep -A2 Events
# Warning  FailedScheduling  default-scheduler  0/1 nodes are available: 1 Insufficient cpu.`,
        explanation:
          'Note that `looper` reports phase Running even while STATUS says CrashLoopBackOff - the phase is coarse, the container state is precise.',
      },
      {
        title: 'Step 7 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace pod-lab`,
      },
    ],
    verification: [
      {
        command:
          "kubectl get pods -n pod-lab -o custom-columns='POD:.metadata.name,PHASE:.status.phase'",
        what: 'Shows all four phases side by side.',
        expected: 'Succeeded, Failed, Running (crash-looping) and Pending.',
      },
      {
        command: 'kubectl describe pod looper -n pod-lab | grep -i "back-off"',
        what: 'Confirms the restart backoff is what CrashLoopBackOff actually reports.',
        expected: 'Back-off restarting failed container c in pod looper...',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace pod-lab',
        what: 'Removes the lab namespace.',
        expected: 'namespace "pod-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['core-objects', 'probes', 'pod-failure-modes'],
  docs: [
    {
      title: 'Pod lifecycle',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/',
    },
    { title: 'Pod', url: 'https://kubernetes.io/docs/concepts/workloads/pods/' },
  ],
}
