import type { Topic } from '../../../types'

export const podFailureModes: Topic = {
  id: 'pod-failure-modes',
  title: 'CrashLoopBackOff, ImagePullBackOff, Pending and OOMKilled',
  domainId: 'observability',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 5,
  tags: ['CrashLoopBackOff', 'ImagePullBackOff', 'Pending', 'OOMKilled', 'exit code', 'Evicted'],
  oneLiner:
    'The five statuses you will actually meet, what each one proves about which component failed, and the fix for each.',
  explanation: [
    'Each failure status is a precise statement about how far a Pod got through the apply → schedule → pull → start → run pipeline. Learning the mapping turns guesswork into a lookup.',
    '**Pending** - the scheduler has not bound the Pod to a node. Nothing has been pulled or started. Causes: insufficient CPU/memory for the *requests*, an unsatisfiable nodeSelector or affinity, taints without tolerations, or an unbound PersistentVolumeClaim.',
    '**ImagePullBackOff / ErrImagePull** - the Pod is scheduled and the kubelet cannot fetch the image. Causes: wrong image name or tag, private registry with no or wrong `imagePullSecrets`, or the registry being unreachable. Never an application problem.',
    '**CrashLoopBackOff** - the container started and then exited, repeatedly, and the kubelet is waiting out its exponential backoff before trying again. Causes: a genuine application error, a missing configuration value, a wrong command, or a one-shot process with `restartPolicy: Always`.',
    '**OOMKilled** - the kernel killed the container for exceeding its memory *limit*. Exit code 137. Causes: limit too low, a memory leak, or a JVM/Node heap setting larger than the limit.',
    '**Evicted** - the kubelet removed the Pod because the *node* was under pressure (disk or memory) or the Pod exceeded its ephemeral-storage limit. This is about the node, not the container.',
  ],
  whyItMatters: [
    'Almost every CKAD troubleshooting task presents one of these statuses. Recognising it tells you which command to run next, and which commands would be a waste of time.',
    'The biggest time-saver is knowing what *not* to do: reading application logs for an ImagePullBackOff, or checking the image for a Pending Pod, is pure lost time.',
    'Exit codes are a second, independent signal: 137 means killed (usually OOM), 143 means SIGTERM, 1 means the application chose to fail, 127 means "command not found".',
  ],
  howItWorks: [
    'Restart backoff for CrashLoopBackOff is exponential: 10s, 20s, 40s, 80s, 160s, capped at 5 minutes, and reset after a container runs successfully for 10 minutes. So a Pod with 8 restarts has been failing for roughly 15 minutes.',
    "ImagePullBackOff is also a backoff state; the underlying error appears once as `ErrImagePull` with the registry's actual message, which is why you should read `describe` rather than just the status column.",
    'OOM detection: the container runtime reports the kernel OOM kill, and the kubelet records `reason: OOMKilled` with exit code 137 in `lastState.terminated`. Nothing appears in the application log because the process was killed without warning.',
    'Eviction depends on QoS class. `BestEffort` (no requests or limits) is evicted first, then `Burstable` (requests < limits), and `Guaranteed` (requests == limits for both CPU and memory) last. This is why setting requests matters for stability, not just scheduling.',
    'A Pod stuck `Terminating` is a different class of problem: usually a finalizer, a volume that will not detach, or a container ignoring SIGTERM until the grace period expires.',
    '`Completed` with `restartPolicy: Always` becomes CrashLoopBackOff even though exit code 0 means success - the restart policy, not the exit code, is the problem.',
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Its status fields distinguish the failure modes precisely.',
      fields: [
        { path: 'status.phase', meaning: 'Pending / Running / Succeeded / Failed - coarse.' },
        {
          path: 'status.containerStatuses[].state.waiting.reason',
          meaning: 'ImagePullBackOff, ErrImagePull, CrashLoopBackOff, CreateContainerConfigError.',
        },
        {
          path: 'status.containerStatuses[].lastState.terminated.reason',
          meaning: 'Error, OOMKilled, Completed.',
        },
        {
          path: 'status.containerStatuses[].lastState.terminated.exitCode',
          meaning: '1 = app error, 127 = command not found, 137 = SIGKILL/OOM, 143 = SIGTERM.',
        },
        {
          path: 'status.containerStatuses[].restartCount',
          meaning: 'How long this has been failing, via the backoff schedule.',
        },
        {
          path: 'status.qosClass',
          meaning: 'Guaranteed / Burstable / BestEffort - decides eviction order.',
        },
        { path: 'status.reason', meaning: 'Evicted, with the detail in status.message.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Four Pods, four statuses, four different teams',
    story: [
      'A namespace review finds four broken Pods. Each one belongs to a different problem class, and the status column alone routes it to the right person.',
      "`reports-1  0/1 Pending` - `describe` says `Insufficient memory`. The Pod requests 16Gi and no node has it. This is the application team's manifest, not an infrastructure fault.",
      '`mailer-1  0/1 ImagePullBackOff` - `describe` says `unauthorized: authentication required`. The registry Secret was rotated and the namespace was never updated. Platform team, five-minute fix.',
      '`checkout-1  0/1 CrashLoopBackOff` - `logs --previous` says `FATAL: SMTP_HOST is not set`. A ConfigMap key was renamed. Application team, one-line fix.',
      '`search-1  0/1 CrashLoopBackOff` with `Last State: Terminated, Reason: OOMKilled, Exit Code: 137` - superficially the same status as checkout, but a completely different problem: the JVM heap is set to 2Gi and the container limit is 1Gi.',
      'The last pair is the important lesson: CrashLoopBackOff is not a diagnosis. You must read `lastState.terminated.reason` to know whether the application failed or the kernel killed it.',
    ],
    code: [
      {
        title: 'One table, four routings',
        language: 'bash',
        code: `kubectl get pods -n shop
# NAME         READY   STATUS             RESTARTS   AGE
# checkout-1   0/1     CrashLoopBackOff   7          22m
# mailer-1     0/1     ImagePullBackOff   0          22m
# reports-1    0/1     Pending            0          22m
# search-1     0/1     CrashLoopBackOff   5          22m

# The one query that separates the two CrashLoopBackOffs:
kubectl get pods -n shop -o custom-columns=\\
'POD:.metadata.name,STATUS:.status.containerStatuses[0].state.waiting.reason,LAST:.status.containerStatuses[0].lastState.terminated.reason,CODE:.status.containerStatuses[0].lastState.terminated.exitCode'
# POD          STATUS             LAST        CODE
# checkout-1   CrashLoopBackOff   Error       1
# mailer-1     ImagePullBackOff   <none>      <none>
# reports-1    <none>             <none>      <none>
# search-1     CrashLoopBackOff   OOMKilled   137`,
        explanation:
          'Keep this custom-columns query in your head. It distinguishes an application failure from an OOM kill in one command, with no describe output to read.',
        placeholders: ['shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'One manifest that reproduces every failure mode',
      language: 'yaml',
      code: `# Pending: no node can satisfy the request
apiVersion: v1
kind: Pod
metadata:
  name: fail-pending
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"]
      resources:
        requests:
          memory: 500Gi # nothing has this
---
# ImagePullBackOff: the tag does not exist
apiVersion: v1
kind: Pod
metadata:
  name: fail-imagepull
spec:
  containers:
    - name: c
      image: busybox:no-such-tag-exists
---
# CrashLoopBackOff (application error): exits 1, restartPolicy defaults to Always
apiVersion: v1
kind: Pod
metadata:
  name: fail-crashloop
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo 'FATAL: missing config'; exit 1"]
---
# CrashLoopBackOff (wrong restart policy): exits 0, but Always restarts it
apiVersion: v1
kind: Pod
metadata:
  name: fail-succeeded-loop
spec:
  # restartPolicy: Never or OnFailure is what this workload needs
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo done"]
---
# OOMKilled: allocate more than the limit allows
apiVersion: v1
kind: Pod
metadata:
  name: fail-oom
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "dd if=/dev/zero of=/dev/shm/fill bs=1M count=200; sleep 3600"]
      resources:
        requests:
          memory: 32Mi
        limits:
          memory: 64Mi # 200Mi write into shared memory exceeds this
---
# CreateContainerConfigError: references a ConfigMap that does not exist
apiVersion: v1
kind: Pod
metadata:
  name: fail-missing-config
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"]
      envFrom:
        - configMapRef:
            name: does-not-exist`,
      explanation:
        '`fail-succeeded-loop` is the subtle one: the container succeeds every time, and the Pod still ends up in CrashLoopBackOff, because `restartPolicy: Always` restarts a successful exit too.',
    },
  ],
  imperative: [
    {
      command: 'kubectl get pods -n shop',
      what: 'The status column is the first routing decision.',
      expected: 'Pending / ImagePullBackOff / CrashLoopBackOff / Running.',
      placeholders: ['shop'],
    },
    {
      command:
        "kubectl get pods -n shop -o custom-columns='POD:.metadata.name,WAIT:.status.containerStatuses[0].state.waiting.reason,LAST:.status.containerStatuses[0].lastState.terminated.reason,CODE:.status.containerStatuses[0].lastState.terminated.exitCode'",
      what: 'Separates application failures from OOM kills across a whole namespace in one command.',
      expected: 'A four-column table.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe pod fail-pending -n shop | grep -A3 Events',
      what: 'For Pending, the FailedScheduling message names the exact constraint.',
      expected: '0/3 nodes are available: 3 Insufficient memory.',
      placeholders: ['fail-pending', 'shop'],
    },
    {
      command: 'kubectl describe pod fail-imagepull -n shop | grep -iA2 "failed to pull"',
      what: "For ImagePullBackOff, the registry's own error message.",
      expected: 'manifest unknown, or unauthorized: authentication required.',
      placeholders: ['fail-imagepull', 'shop'],
    },
    {
      command: 'kubectl logs fail-crashloop -n shop --previous',
      what: "For CrashLoopBackOff, the application's last words.",
      expected: 'FATAL: missing config',
      placeholders: ['fail-crashloop', 'shop'],
    },
    {
      command:
        'kubectl get pod fail-oom -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{" exit="}{.status.containerStatuses[0].lastState.terminated.exitCode}{"\\n"}\'',
      what: 'Confirms an OOM kill without reading describe output.',
      expected: 'OOMKilled exit=137',
      placeholders: ['fail-oom', 'shop'],
    },
    {
      command: 'kubectl describe node worker-2 | grep -A6 "Allocated resources"',
      what: 'For Pending, shows how much of the node is already committed.',
      expected: 'Requests and limits with percentages of capacity.',
      placeholders: ['worker-2'],
    },
    {
      command: 'kubectl get events -n shop --field-selector reason=Evicted',
      what: 'Evictions are node-pressure events, distinct from container failures.',
      expected: 'The node had condition: DiskPressure, or an ephemeral-storage message.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pod fail-oom -n shop -o jsonpath=\'{.status.qosClass}{"\\n"}\'',
      what: 'QoS class predicts eviction order under node pressure.',
      expected: 'Guaranteed, Burstable or BestEffort.',
      placeholders: ['fail-oom', 'shop'],
    },
    {
      command: 'kubectl top pod fail-oom -n shop',
      what: 'Live memory usage next to the limit, for confirming a leak rather than a bad limit.',
      expected: 'A memory figure close to the limit.',
      placeholders: ['fail-oom', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Pending → lower `resources.requests`, remove an unsatisfiable `nodeSelector`, add a toleration, or fix the PVC.',
      'ImagePullBackOff → correct the image reference, or create a `docker-registry` Secret and add it to `imagePullSecrets`.',
      'CrashLoopBackOff (exit 1) → fix the configuration or command the application is complaining about.',
      'CrashLoopBackOff (exit 0) → change `restartPolicy` to `Never`/`OnFailure`, or model the work as a Job.',
      "OOMKilled → raise `resources.limits.memory`, or lower the application's own heap setting to fit inside the limit.",
      'Evicted → set requests and limits so the Pod is not BestEffort, and cap `ephemeral-storage`.',
    ],
    code: [
      {
        title: 'The six fixes as commands',
        language: 'bash',
        code: `# Pending - reduce the request
kubectl set resources deploy/reports -c=reports --requests=memory=512Mi -n shop

# ImagePullBackOff - fix the tag
kubectl set image deploy/mailer mailer=registry.example.com/shop/mailer:1.4.2 -n shop
# ... or supply credentials
kubectl create secret docker-registry regcred -n shop \\
  --docker-server=registry.example.com --docker-username=ci --docker-password=<token>
kubectl patch deploy mailer -n shop \\
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'

# OOMKilled - raise the limit
kubectl set resources deploy/search -c=search --limits=memory=2Gi -n shop

# Exit-0 crash loop on a bare Pod - it needs a different restart policy,
# which is immutable, so recreate it (or make it a Job):
kubectl create job onceoff --image=busybox:1.36 -n shop -- sh -c 'echo done'`,
        placeholders: ['shop', '<token>'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pods -n shop',
      what: 'The fix is verified when the status column reads Running with READY 1/1.',
      expected: 'No Pending, BackOff or CrashLoop statuses.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pods -n shop -o jsonpath=\'{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].restartCount}{"\\n"}{end}\'',
      what: 'A restart count that stops climbing is the real proof a crash loop is fixed.',
      expected: 'Counts that stay constant over a minute.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector type=Warning --sort-by=.lastTimestamp | tail -5',
      what: 'Confirms no new warnings are being generated after the fix.',
      expected: 'Only old events, with no recent timestamps.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod mypod -n shop',
      what: 'Always the first command. Events plus container state cover all five failure modes.',
      expected: 'A Warning event naming the failing stage.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl logs mypod -n shop --previous',
      what: 'Only useful once you know the container actually started. Pointless for Pending and ImagePullBackOff.',
      expected: 'The application error.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command:
        'kubectl get pod mypod -n shop -o jsonpath=\'{.status.containerStatuses[0].state}{"\\n"}\'',
      what: 'The waiting reason is the machine-readable status, including CreateContainerConfigError for a missing ConfigMap or Secret.',
      expected:
        '{"waiting":{"reason":"CreateContainerConfigError","message":"configmap \\"x\\" not found"}}',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl get pod mypod -n shop -o yaml | grep -A5 "deletionTimestamp"',
      what: 'A Pod stuck Terminating has a deletionTimestamp; look for finalizers or a volume that will not detach.',
      expected: 'A timestamp and possibly a finalizers list.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl delete pod mypod -n shop --grace-period=0 --force',
      what: 'Last resort for a stuck Terminating Pod. It removes the API object without waiting, which can leave the container running - use only when you must.',
      expected: 'Warning: Immediate deletion does not wait for confirmation...',
      placeholders: ['mypod', 'shop'],
    },
  ],
  commonMistakes: [
    'Reading logs for an ImagePullBackOff or Pending Pod. There is no container, so there are no logs.',
    'Treating CrashLoopBackOff as one problem. Check `lastState.terminated.reason` - Error and OOMKilled need completely different fixes.',
    'Assuming Pending is a cluster fault. It is usually your own request, selector, toleration or PVC.',
    'Raising `requests` instead of `limits` to fix an OOM kill. The kernel enforces the *limit*.',
    'Forgetting that exit code 0 with `restartPolicy: Always` still produces CrashLoopBackOff.',
    'Using `--force --grace-period=0` habitually, which can leave containers running and volumes attached.',
    'Ignoring QoS class when Pods are evicted: a BestEffort Pod is evicted first, and setting requests fixes it.',
    'Confusing OOMKilled (this container exceeded its limit) with Evicted (the node ran out of resources).',
  ],
  examTips: [
    'Learn the status-to-component mapping cold: Pending → scheduler; ImagePullBackOff → kubelet/registry; CrashLoopBackOff → application; OOMKilled → memory limit; Evicted → node pressure.',
    'Exit code 137 means killed - check for OOMKilled before you read any application code.',
    '`CreateContainerConfigError` means a referenced ConfigMap, Secret or key does not exist. The message names it.',
    'For Pending, `kubectl describe pod` and read the FailedScheduling message verbatim; it tells you the exact constraint.',
    'Never read logs before `describe` confirms the container started.',
    'A restart count that stops climbing is your verification that a crash loop is genuinely fixed.',
  ],
  summary: [
    'Pending = not scheduled (requests, selectors, taints, PVC). ImagePullBackOff = image or credentials. CrashLoopBackOff = the container exits.',
    'CrashLoopBackOff splits by `lastState.terminated.reason`: Error (application) versus OOMKilled (memory limit, exit 137).',
    'Exit codes: 0 with Always = wrong restart policy; 1 = app error; 127 = command not found; 137 = SIGKILL/OOM; 143 = SIGTERM.',
    'Evicted is node pressure, and QoS class (BestEffort first) decides who goes.',
    'Restart backoff is exponential to five minutes, so the restart count tells you how long it has been failing.',
  ],
  practice: [
    {
      id: 'fail-p1',
      level: 'beginner',
      prompt: 'A Pod is in ImagePullBackOff. Should you read the application logs? Why or why not?',
      answer:
        'No. The image could not be pulled, so no container was ever created and there is nothing to log. Run `kubectl describe pod <name>` and read the "Failed to pull image" message, which names the registry error.',
      explanation:
        'The two common messages are `manifest unknown` / `not found` (wrong repository or tag) and `unauthorized: authentication required` (missing or wrong `imagePullSecrets`).',
    },
    {
      id: 'fail-p2',
      level: 'intermediate',
      prompt:
        'Two Pods both show CrashLoopBackOff. Give the single command that tells you which one is an application error and which is an OOM kill.',
      answer:
        "kubectl get pods -n <ns> -o custom-columns='POD:.metadata.name,LAST:.status.containerStatuses[0].lastState.terminated.reason,CODE:.status.containerStatuses[0].lastState.terminated.exitCode'",
      explanation:
        'An application error shows `Error` with exit code 1 (or another application-chosen code). An OOM kill shows `OOMKilled` with exit code 137. The fixes are unrelated: fix the config versus raise `limits.memory`.',
    },
    {
      id: 'fail-p3',
      level: 'advanced',
      prompt:
        'A container is OOMKilled. Its `requests.memory` is 256Mi and `limits.memory` is 512Mi, and `kubectl top pod` showed 500Mi before the kill. Give two possible fixes and say which field the kernel actually enforces.',
      answer:
        "The kernel enforces `limits.memory` - 512Mi. Two fixes:\n1. Raise `resources.limits.memory` (for example to 1Gi) if the application legitimately needs more.\n2. Reduce the application's own memory ceiling to fit inside the limit - a JVM `-Xmx`, `NODE_OPTIONS=--max-old-space-size`, or a smaller worker/cache count.\n\nRaising `requests` alone changes nothing: requests only affect scheduling.",
      explanation:
        'A frequent real cause is a runtime that sizes its heap from the *host* memory rather than the cgroup limit. Modern JVMs and Node versions are container-aware, but older ones are not, and will happily configure a heap larger than the limit and be killed.',
    },
  ],
  lab: {
    title: 'Reproduce and fix all five failure modes',
    scenario:
      'You will create Pods that fail in five distinct ways, identify each from status fields alone, then apply the correct fix and verify it.',
    prerequisites: ['A cluster with at least one Ready node'],
    tasks: [
      { instruction: 'Create namespace `fail-lab` and set it as default.' },
      {
        instruction:
          'Apply the five failing Pods from the lesson (Pending, ImagePullBackOff, CrashLoopBackOff, exit-0 loop, OOMKilled) plus one CreateContainerConfigError.',
      },
      { instruction: 'Produce the four-column status table that distinguishes them.' },
      { instruction: 'For each Pod, run the one command that identifies its cause.' },
      { instruction: 'Fix the Pending Pod by recreating it with a realistic request.' },
      { instruction: 'Fix the OOMKilled Pod by recreating it with a higher memory limit.' },
      { instruction: 'Fix the exit-0 loop by recreating it as a Job.' },
      { instruction: 'Fix the CreateContainerConfigError by creating the missing ConfigMap.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - create and classify',
        language: 'bash',
        code: `kubectl create namespace fail-lab
kubectl config set-context --current --namespace=fail-lab

# (apply the manifest from the YAML examples section, saved as failures.yaml)
kubectl apply -f failures.yaml
sleep 60

kubectl get pods
# NAME                   READY   STATUS                       RESTARTS   AGE
# fail-crashloop         0/1     CrashLoopBackOff             3          60s
# fail-imagepull         0/1     ImagePullBackOff             0          60s
# fail-missing-config    0/1     CreateContainerConfigError   0          60s
# fail-oom               0/1     CrashLoopBackOff             2          60s
# fail-pending           0/1     Pending                      0          60s
# fail-succeeded-loop    0/1     CrashLoopBackOff             3          60s

kubectl get pods -o custom-columns='POD:.metadata.name,WAIT:.status.containerStatuses[0].state.waiting.reason,LAST:.status.containerStatuses[0].lastState.terminated.reason,CODE:.status.containerStatuses[0].lastState.terminated.exitCode'
# POD                   WAIT                         LAST        CODE
# fail-crashloop        CrashLoopBackOff             Error       1
# fail-imagepull        ImagePullBackOff             <none>      <none>
# fail-missing-config   CreateContainerConfigError   <none>      <none>
# fail-oom              CrashLoopBackOff             OOMKilled   137
# fail-pending          <none>                       <none>      <none>
# fail-succeeded-loop   CrashLoopBackOff             Completed   0`,
      },
      {
        title: 'Step 4 - one command per cause',
        language: 'bash',
        code: `# Pending -> the scheduler's constraint
kubectl describe pod fail-pending | grep -A2 Events
# Warning FailedScheduling: 0/1 nodes are available: 1 Insufficient memory.

# ImagePullBackOff -> the registry's error
kubectl describe pod fail-imagepull | grep -i "failed to pull" -A1
# Failed to pull image "busybox:no-such-tag-exists": ... manifest unknown

# CrashLoopBackOff (Error) -> the application's message
kubectl logs fail-crashloop --previous
# FATAL: missing config

# CrashLoopBackOff (Completed, exit 0) -> restart policy is wrong
kubectl get pod fail-succeeded-loop -o jsonpath='{.spec.restartPolicy}{"\\n"}'
# Always      <- this is the bug; the container succeeded every time

# OOMKilled -> the limit
kubectl get pod fail-oom -o jsonpath='{.spec.containers[0].resources.limits.memory}{"\\n"}'
# 64Mi

# CreateContainerConfigError -> the message names the missing object
kubectl get pod fail-missing-config -o jsonpath='{.status.containerStatuses[0].state.waiting.message}{"\\n"}'
# configmap "does-not-exist" not found`,
      },
      {
        title: 'Steps 5-7 - fix by recreating (Pod fields are immutable)',
        language: 'bash',
        code: `# Pending: a realistic request
kubectl delete pod fail-pending
kubectl run fail-pending --image=busybox:1.36 --command \\
  --overrides='{"spec":{"containers":[{"name":"c","image":"busybox:1.36","command":["sleep","3600"],"resources":{"requests":{"memory":"32Mi"}}}]}}' \\
  -- sleep 3600
kubectl wait --for=condition=Ready pod/fail-pending --timeout=90s

# OOMKilled: a limit that fits the workload
kubectl delete pod fail-oom
cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: fail-oom
  namespace: fail-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "dd if=/dev/zero of=/dev/shm/fill bs=1M count=200; sleep 3600"]
      resources:
        requests:
          memory: 128Mi
        limits:
          memory: 512Mi      # now larger than the 200Mi write
YAML
kubectl wait --for=condition=Ready pod/fail-oom --timeout=90s

# exit-0 loop: it was never a service, so make it a Job
kubectl delete pod fail-succeeded-loop
kubectl create job onceoff --image=busybox:1.36 -- sh -c 'echo done'
kubectl wait --for=condition=complete job/onceoff --timeout=120s
kubectl get job onceoff
# onceoff   Complete   1/1`,
      },
      {
        title: 'Step 8-9 - the missing ConfigMap, then cleanup',
        language: 'bash',
        code: `kubectl create configmap does-not-exist --from-literal=KEY=value
sleep 15
kubectl get pod fail-missing-config
# fail-missing-config   1/1   Running   0   ...
# The kubelet retries automatically once the ConfigMap exists - no restart needed.

kubectl get pods
# Only fail-crashloop and fail-imagepull remain broken, which is correct:
# they represent a genuine application bug and a genuine wrong image.

kubectl config set-context --current --namespace=default
kubectl delete namespace fail-lab`,
      },
    ],
    verification: [
      {
        command:
          "kubectl get pods -n fail-lab -o custom-columns='POD:.metadata.name,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount'",
        what: 'After the fixes, the repaired Pods should be Running with a stable restart count.',
        expected: 'fail-pending, fail-oom and fail-missing-config all Running.',
      },
      {
        command:
          'kubectl get pod fail-oom -n fail-lab -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{"\\n"}\'',
        what: 'Empty output means it has not been OOM-killed since the fix.',
        expected: 'Empty.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace fail-lab',
        what: 'Removes every Pod and Job from the lab.',
        expected: 'namespace "fail-lab" deleted',
      },
    ],
  },
  relatedTopicIds: [
    'describe-and-events',
    'container-logs',
    'resource-requirements',
    'debugging-pods',
  ],
  docs: [
    {
      title: 'Debug Pods',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/',
    },
    {
      title: 'Node-pressure eviction',
      url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/',
    },
  ],
}
