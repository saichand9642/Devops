import type { Topic } from '../../../types'

export const resourceRequirements: Topic = {
  id: 'resource-requirements',
  title: 'Resource requests, limits and QoS',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 4,
  tags: [
    'requests',
    'limits',
    'cpu',
    'memory',
    'millicores',
    'Mi',
    'QoS',
    'OOMKilled',
    'throttling',
  ],
  oneLiner:
    'What requests and limits actually do, the unit rules that trip people up, and how the three QoS classes decide who gets evicted.',
  explanation: [
    'A **request** is a reservation used by the scheduler. It guarantees that the node has at least that much capacity available for the container, and it is what "the node is full" means. It does *not* cap usage.',
    'A **limit** is a ceiling enforced at runtime by the kernel. For CPU it causes **throttling** - the container is slowed down. For memory it causes an **OOM kill** - the container is terminated with exit code 137.',
    'That asymmetry is the single most important fact here: **CPU is compressible, memory is not**. Exceeding a CPU limit makes you slow; exceeding a memory limit makes you dead.',
    'Units. CPU is measured in cores: `1` = one core, `500m` = 0.5 core, `100m` = 0.1 core. Memory uses binary suffixes (`Ki`, `Mi`, `Gi` = 1024-based) or decimal ones (`K`, `M`, `G` = 1000-based). `1Mi` is 1048576 bytes; `1M` is 1000000. Always use `Mi`/`Gi` unless you have a reason not to.',
    'Requests and limits together determine the **QoS class**: `Guaranteed` (every container has requests == limits for both CPU and memory), `Burstable` (requests set, but not equal to limits), `BestEffort` (nothing set). Under node pressure, BestEffort Pods are evicted first, then Burstable, then Guaranteed.',
  ],
  whyItMatters: [
    '"Understand requests, limits, quotas" and "define resource requirements" are two separate named curriculum competencies, so this is heavily weighted.',
    'Every OOMKilled and every Pending Pod traces back to these fields, so the diagnostic value is high.',
    'The unit rules matter in a very concrete way: writing `1000` instead of `1000m` for CPU asks for a thousand cores, and writing `512M` instead of `512Mi` gives you 12% less memory than you expected.',
  ],
  howItWorks: [
    'Scheduling: the scheduler sums the requests of all containers in a Pod (taking the maximum of init-container requests versus the sum of regular container requests, plus native sidecars) and finds a node whose `allocatable` minus already-requested capacity can fit it. Actual usage is irrelevant to this decision.',
    'CPU enforcement: the limit becomes a CFS quota. A container with a 500m limit gets 50 ms of CPU per 100 ms period; when it exhausts that it is throttled until the next period. Requests become CPU **shares**, which decide the relative priority when the node is contended.',
    'Memory enforcement: the limit becomes a cgroup memory limit. Exceeding it triggers the kernel OOM killer, which terminates the process immediately - the container reports `OOMKilled` and exit code 137, and no application log line is written at the moment of death.',
    'A `medium: Memory` emptyDir counts against the container\'s memory limit, as does the page cache attributable to the container. That is why "my app uses 300Mi but was OOMKilled at a 512Mi limit" can still be correct.',
    'Ephemeral storage (`requests.ephemeral-storage` / `limits.ephemeral-storage`) covers the writable layer plus emptyDir volumes. Exceeding the limit evicts the Pod rather than killing the container.',
    'A LimitRange in the namespace can supply defaults for containers that specify nothing, and can enforce minimums, maximums and a maximum limit-to-request ratio. A ResourceQuota can require that requests and limits are set at all.',
    'Guaranteed QoS additionally gets integer CPU pinning on nodes configured with the static CPU manager policy - relevant for latency-sensitive workloads, though not a CKAD topic.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Requests schedule, limits enforce',
      caption:
        'This one sentence answers most resource questions. Requests are a promise used at scheduling time; limits are a ceiling enforced at runtime.',
      nodes: [
        {
          label: 'You set requests and limits',
          detail: 'resources.requests and resources.limits per container',
        },
        {
          label: 'Scheduler adds up the REQUESTS',
          detail: 'Finds a node with that much unreserved capacity',
          tone: 'accent',
          arrowLabel: 'requests only',
          branch: {
            label: 'No node has room',
            detail: 'Pod stays Pending: Insufficient cpu or memory',
          },
        },
        {
          label: 'Container starts on that node',
          detail: 'Requests are now just a reservation',
        },
        {
          label: 'CPU above the limit is throttled',
          detail: 'The app slows down but keeps running',
          arrowLabel: 'CPU is compressible',
        },
        {
          label: 'Memory above the limit is killed',
          detail: 'OOMKilled, exit code 137, then restarted',
          tone: 'warning',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'What QoS class did you just create?',
      caption:
        'QoS decides who gets evicted first when a node runs out of memory. You never set it directly - it follows from your numbers.',
      question: 'How do requests compare with limits?',
      branches: [
        {
          condition: 'set, equal, on every container',
          result: 'Guaranteed',
          detail: 'Evicted last. What you want for important workloads.',
          tone: 'accent',
        },
        {
          condition: 'set, but requests below limits',
          result: 'Burstable',
          detail: 'Evicted after BestEffort. The common case.',
        },
        {
          condition: 'neither set anywhere',
          result: 'BestEffort',
          detail: 'Evicted first, and cannot be scheduled predictably',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Where resources are declared, per container.',
      fields: [
        {
          path: 'spec.containers[].resources.requests.cpu',
          meaning: 'Scheduling reservation in cores or millicores. Not a cap.',
        },
        {
          path: 'spec.containers[].resources.requests.memory',
          meaning: 'Scheduling reservation in bytes (use Mi/Gi).',
        },
        {
          path: 'spec.containers[].resources.limits.cpu',
          meaning: 'Hard ceiling; exceeding it throttles the container.',
        },
        {
          path: 'spec.containers[].resources.limits.memory',
          meaning: 'Hard ceiling; exceeding it OOM-kills the container.',
        },
        {
          path: 'spec.containers[].resources.requests["ephemeral-storage"]',
          meaning: 'Local disk reservation for the writable layer and emptyDirs.',
        },
        {
          path: 'spec.containers[].resources.limits["ephemeral-storage"]',
          meaning: 'Local disk ceiling; exceeding it evicts the Pod.',
        },
        {
          path: 'status.qosClass',
          meaning: 'Guaranteed / Burstable / BestEffort, derived from the above.',
        },
      ],
    },
    {
      kind: 'Node',
      apiVersion: 'v1',
      purpose: 'The capacity requests are measured against.',
      fields: [
        { path: 'status.capacity', meaning: 'Total machine resources.' },
        {
          path: 'status.allocatable',
          meaning:
            'What is available to Pods after system and kubelet reservations - what the scheduler uses.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Two teams, two opposite mistakes',
    story: [
      'Team A copied a load-test manifest and requests `4` CPU and `8Gi` memory per replica for a service that idles at 30m CPU and 200Mi. Their Pods will not schedule beyond two per node, and `kubectl describe node` reports 95% CPU requested while `kubectl top node` shows 6% used. They are paying for capacity nobody uses, and new deployments sit Pending.',
      "Team B set no requests or limits at all, so every Pod is `BestEffort`. When a node came under memory pressure, the kubelet evicted their Pods first - before the noisy neighbour that actually caused the pressure. Their service went down because of someone else's bug.",
      'Both fixes come from measurement. `kubectl top pods --containers` over a representative period gives steady-state usage; requests go slightly above that, limits go above the observed peak.',
      'Team A dropped to `requests: {cpu: 100m, memory: 256Mi}, limits: {cpu: 1, memory: 512Mi}` and fitted twelve replicas per node instead of two. Team B set the same shape and moved from BestEffort to Burstable, and stopped being the first to be evicted.',
      'The rule of thumb they both adopted: request what you steadily need, limit what you are willing to allow, and never leave both blank.',
    ],
    code: [
      {
        title: 'Measure, then decide',
        language: 'bash',
        code: `# Steady-state usage, per container
kubectl top pods -n shop -l app=api --containers
# POD                  NAME   CPU(cores)   MEMORY(bytes)
# api-6d4b8f9c7-2xk4l  api    31m          204Mi

# What was requested
kubectl get pods -n shop -l app=api \\
  -o custom-columns='POD:.metadata.name,REQ_CPU:.spec.containers[0].resources.requests.cpu,REQ_MEM:.spec.containers[0].resources.requests.memory,QOS:.status.qosClass'
# POD                  REQ_CPU   REQ_MEM   QOS
# api-6d4b8f9c7-2xk4l  4         8Gi       Burstable
#                      ^^^ 130x the observed usage

kubectl set resources deploy/api -c=api -n shop \\
  --requests=cpu=100m,memory=256Mi --limits=cpu=1,memory=512Mi`,
        explanation:
          'The QoS column is worth checking on every workload you own: `BestEffort` means you have volunteered to be evicted first.',
        placeholders: ['shop', 'api'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The three QoS classes, side by side',
      language: 'yaml',
      code: `# Guaranteed: requests == limits for BOTH cpu and memory, on EVERY container.
# Evicted last. Use for latency-sensitive or critical workloads.
apiVersion: v1
kind: Pod
metadata:
  name: qos-guaranteed
  namespace: shop
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
      resources:
        requests:
          cpu: 500m
          memory: 512Mi
        limits:
          cpu: 500m # identical to the request
          memory: 512Mi # identical to the request
---
# Burstable: requests set, limits higher (or absent). The normal choice.
apiVersion: v1
kind: Pod
metadata:
  name: qos-burstable
  namespace: shop
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: "1"
          memory: 512Mi
---
# BestEffort: nothing set. Evicted FIRST under node pressure. Avoid.
apiVersion: v1
kind: Pod
metadata:
  name: qos-besteffort
  namespace: shop
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine`,
      explanation:
        'Guaranteed requires requests == limits on *every* container in the Pod, including sidecars. One sidecar without matching values downgrades the whole Pod to Burstable.',
      placeholders: ['shop'],
    },
    {
      title: 'Units, correct and incorrect',
      language: 'yaml',
      code: `resources:
  requests:
    # CPU
    cpu: 100m # 0.1 core        CORRECT for a small service
    # cpu: 100         # 100 CORES - will never schedule
    # cpu: 0.1         # valid, but 100m is the idiomatic form

    # Memory - binary suffixes are 1024-based
    memory: 512Mi # 536,870,912 bytes   CORRECT
    # memory: 512M     # 512,000,000 bytes - 4.6% LESS than 512Mi
    # memory: 512      # 512 BYTES - the Pod will be OOMKilled instantly
  limits:
    cpu: "1" # quoted because YAML would read 1 as an int (also valid)
    memory: 1Gi # 1,073,741,824 bytes
    ephemeral-storage: 2Gi # writable layer + emptyDirs
# Suffix reference:
#   binary  (1024-based): Ki  Mi  Gi  Ti
#   decimal (1000-based): K   M   G   T
#   CPU:                  1 = one core, 1000m = one core, 500m = half a core`,
      explanation:
        'The `memory: 512` mistake (bytes, not MiB) is instantly fatal and produces a confusing OOMKilled with no useful log. Always write a suffix.',
    },
    {
      title: 'Init containers and sidecars change the arithmetic',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: resource-arithmetic
  namespace: shop
spec:
  initContainers:
    # Regular init container: runs alone, so its request is compared
    # against the SUM of the regular containers, and the larger wins.
    - name: migrate
      image: busybox:1.36
      command: ["sh", "-c", "echo migrating"]
      resources:
        requests:
          cpu: 2 # peak requirement during init
          memory: 1Gi
    # Native sidecar: runs ALONGSIDE the app, so it is ADDED to the sum.
    - name: log-shipper
      image: busybox:1.36
      restartPolicy: Always
      command: ["sh", "-c", "sleep infinity"]
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
  containers:
    - name: app
      image: nginx:1.27-alpine
      resources:
        requests:
          cpu: 200m
          memory: 256Mi
# Effective Pod request:
#   regular + native sidecars = 250m CPU, 320Mi memory
#   largest init container    = 2 CPU, 1Gi memory
#   Pod request = max(...)    = 2 CPU, 1Gi memory
# The heavyweight init container is what the scheduler must satisfy.`,
      explanation:
        'A heavyweight init container can make an otherwise small Pod unschedulable. Native sidecars are different because they run concurrently, so their requests add to the total.',
      placeholders: ['resource-arithmetic', 'shop'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl set resources deployment/api -c=api --requests=cpu=100m,memory=256Mi --limits=cpu=1,memory=512Mi -n shop',
      what: 'Sets resources on an existing Deployment container and triggers a rollout.',
      expected: 'deployment.apps/api resource requirements updated',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        "kubectl get pods -n shop -o custom-columns='POD:.metadata.name,QOS:.status.qosClass'",
      what: 'The QoS audit. Anything BestEffort is a Pod you have volunteered for early eviction.',
      expected: 'Guaranteed / Burstable / BestEffort per Pod.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl top pods -n shop --containers',
      what: 'Actual usage per container - the input to sizing decisions.',
      expected: 'CPU and memory per container.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe node worker-2 | grep -A8 "Allocated resources"',
      what: 'Requested and limited totals on a node, which is what "full" means for scheduling.',
      expected: 'CPU and memory Requests/Limits with percentages.',
      placeholders: ['worker-2'],
    },
    {
      command:
        'kubectl get node worker-2 -o jsonpath=\'{.status.allocatable.cpu}{" "}{.status.allocatable.memory}{"\\n"}\'',
      what: 'The capacity the scheduler actually has to work with, after system reservations.',
      expected: 'e.g. 3800m 7823456Ki',
      placeholders: ['worker-2'],
    },
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{.spec.containers[0].resources}{"\\n"}\'',
      what: 'Reads the configured resources exactly as stored.',
      expected:
        '{"limits":{"cpu":"1","memory":"512Mi"},"requests":{"cpu":"100m","memory":"256Mi"}}',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{"\\n"}\'',
      what: 'Confirms an OOM kill.',
      expected: 'OOMKilled',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- cat /sys/fs/cgroup/memory.max',
      what: 'The cgroup v2 memory limit as the kernel sees it - the number that OOM-kills you.',
      expected: '536870912 for a 512Mi limit.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- cat /sys/fs/cgroup/cpu.stat',
      what: 'Shows `nr_throttled` and `throttled_usec` - evidence that a CPU limit is slowing the container.',
      expected: 'Non-zero nr_throttled if the container is hitting its CPU limit.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Always set both requests and limits. Leaving them out makes the Pod BestEffort and first to be evicted.',
      'Set requests from measured steady-state usage plus modest headroom; set limits above the observed peak.',
      'Use `Mi`/`Gi` for memory and `m` for CPU, and never write a bare memory number.',
      'Consider `Guaranteed` (requests == limits) for critical workloads that must not be evicted.',
      'Account for init containers (max) and native sidecars (sum) when a Pod will not schedule.',
      'Set `limits.ephemeral-storage` on anything that writes to an emptyDir.',
    ],
    code: [
      {
        title: 'A sizing workflow',
        language: 'bash',
        code: `NS=shop; APP=api

# 1. Observe over a representative period
kubectl top pods -n $NS -l app=$APP --containers

# 2. Set requests ~1.5-2x steady state, limits above the peak
kubectl set resources deploy/$APP -c=$APP -n $NS \\
  --requests=cpu=100m,memory=256Mi \\
  --limits=cpu=1,memory=512Mi
kubectl rollout status deploy/$APP -n $NS --timeout=180s

# 3. Confirm the QoS class is what you intended
kubectl get pods -n $NS -l app=$APP \\
  -o custom-columns='POD:.metadata.name,QOS:.status.qosClass'

# 4. Watch for throttling; if nr_throttled climbs, raise the CPU limit
POD=$(kubectl get pods -n $NS -l app=$APP -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$POD" -n $NS -- cat /sys/fs/cgroup/cpu.stat | grep throttled`,
        placeholders: ['shop', 'api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pod qos-guaranteed -n shop -o jsonpath=\'{.status.qosClass}{"\\n"}\'',
      what: 'Confirms the QoS class Kubernetes derived from your requests and limits.',
      expected: 'Guaranteed',
      placeholders: ['qos-guaranteed', 'shop'],
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.spec.template.spec.containers[0].resources}{"\\n"}\'',
      what: 'Confirms the values landed on the Pod template, not just on one Pod.',
      expected: 'The requests and limits you set.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl top pod -n shop -l app=api --containers',
      what: 'Confirms actual usage sits comfortably inside the limits after a change.',
      expected: 'Usage well below the limit.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod mypod -n shop | grep -A3 Events',
      what: 'Pending with `Insufficient cpu`/`Insufficient memory` means the request cannot be satisfied.',
      expected: '0/3 nodes are available: 3 Insufficient memory.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl describe pod mypod -n shop | grep -iA4 "last state"',
      what: 'OOMKilled with exit code 137 means the memory *limit* was exceeded.',
      expected: 'Reason: OOMKilled, Exit Code: 137.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl exec mypod -n shop -- cat /sys/fs/cgroup/cpu.stat',
      what: 'A high `nr_throttled` with normal CPU usage means the CPU limit is too low - the app is slow, not broken.',
      expected: 'nr_periods, nr_throttled, throttled_usec.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --field-selector reason=Evicted',
      what: "Node-pressure evictions; check the Pod's QoS class, since BestEffort goes first.",
      expected: 'The node was low on resource: memory / ephemeral-storage.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe limitrange -n shop',
      what: 'A namespace LimitRange may be injecting defaults or rejecting your values.',
      expected: 'Default requests/limits, minimums and maximums.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe resourcequota -n shop',
      what: 'A quota can reject a Pod outright if it has no requests/limits, or if the namespace total would be exceeded.',
      expected: 'Used versus Hard for requests.cpu, limits.memory and so on.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Writing `memory: 512` (512 bytes) instead of `512Mi`. Instant OOM kill with a baffling log.',
    'Writing `cpu: 100` (100 cores) instead of `100m`. The Pod never schedules.',
    'Using `M`/`G` instead of `Mi`/`Gi` and getting 4-7% less memory than intended.',
    'Raising `requests` to fix an OOM kill. The kernel enforces `limits`.',
    'Leaving resources unset, making the Pod BestEffort and the first thing evicted under pressure.',
    'Assuming a CPU limit protects the node. It throttles the container, which usually just makes your own application slow.',
    'Forgetting that a `medium: Memory` emptyDir counts against the memory limit.',
    'Setting `Guaranteed` on the main container but not on a sidecar, and being surprised the Pod is Burstable.',
    'Copying requests from a load-test manifest into production, reserving capacity nobody uses.',
  ],
  examTips: [
    '`kubectl set resources deployment/<name> -c=<container> --requests=cpu=...,memory=... --limits=...` is the one-line answer to most tasks.',
    'There is no `kubectl run` flag for resources beyond `--limits`/`--requests` on some versions - generate the YAML and edit if in doubt.',
    'Memory suffix `Mi`/`Gi`, CPU suffix `m`. Write them every time.',
    '"The Pod must not be evicted before others" → Guaranteed QoS: requests == limits on every container.',
    'OOMKilled → raise `limits.memory`. Pending with Insufficient → lower `requests`.',
    '`kubectl explain pod.spec.containers.resources` confirms the field names in two seconds.',
  ],
  summary: [
    'Requests are a scheduling reservation; limits are a runtime ceiling.',
    'CPU limits throttle (compressible); memory limits OOM-kill (incompressible, exit 137).',
    'CPU in cores/millicores; memory in Mi/Gi (1024-based) - never a bare number.',
    'QoS: Guaranteed (requests == limits everywhere) > Burstable > BestEffort, and eviction goes in reverse.',
    'Pod request = max(largest init container, sum of regular containers + native sidecars).',
  ],
  practice: [
    {
      id: 'res-p1',
      level: 'beginner',
      prompt:
        'What QoS class does a Pod get when its single container has `requests: {cpu: 100m, memory: 128Mi}` and `limits: {cpu: 100m, memory: 128Mi}`?',
      answer: 'Guaranteed - requests equal limits for both CPU and memory on every container.',
      explanation:
        "If either resource differed, or if a second container lacked matching values, it would be Burstable. With nothing set at all it would be BestEffort. Check with `kubectl get pod <name> -o jsonpath='{.status.qosClass}'`.",
    },
    {
      id: 'res-p2',
      level: 'intermediate',
      prompt:
        'A container is OOMKilled with `requests.memory: 256Mi` and `limits.memory: 512Mi`. Which field do you change, and what would raising the other one achieve?',
      answer:
        'Change `limits.memory` - that is what the kernel enforces. Raising `requests.memory` only changes scheduling (it reserves more capacity on the node) and would not prevent the OOM kill at all.',
      explanation:
        "The alternative fix is to reduce the application's own memory ceiling so it fits inside the existing limit - a JVM `-Xmx`, `NODE_OPTIONS=--max-old-space-size`, or fewer workers. `resourceFieldRef` can feed the limit into the application so the two stay in sync.",
    },
    {
      id: 'res-p3',
      level: 'advanced',
      prompt:
        'A Pod has an init container requesting 2 CPU, a native sidecar requesting 100m, and a main container requesting 300m. What CPU request must the scheduler satisfy?',
      answer:
        '2 CPU. The effective Pod request is max(largest init container request, sum of regular containers + native sidecars) = max(2, 0.4) = 2.',
      explanation:
        'Regular init containers run before the others and never concurrently, so only the largest matters. Native sidecars (init containers with `restartPolicy: Always`) *do* run concurrently with the main containers, so they are added to that sum. A heavyweight init container is a common hidden cause of an unschedulable Pod.',
    },
  ],
  lab: {
    title: 'Feel the difference between a request and a limit',
    scenario:
      'You will create Pods in all three QoS classes, make one unschedulable with an oversized request, get one OOM-killed by exceeding its memory limit, and observe CPU throttling.',
    prerequisites: [
      'A cluster with at least one Ready node and metrics-server for the top commands',
    ],
    tasks: [
      { instruction: 'Create namespace `res-lab` and set it as default.' },
      {
        instruction:
          'Create three Pods, one per QoS class, and print the class Kubernetes assigned to each.',
      },
      {
        instruction:
          'Create a Pod requesting 100 CPUs and confirm it stays Pending with the exact scheduler message.',
      },
      {
        instruction:
          'Create a Pod with a 64Mi memory limit that tries to allocate 200Mi, and confirm OOMKilled with exit code 137.',
      },
      {
        instruction:
          'Read the cgroup memory limit from inside a running container and confirm it matches the manifest.',
      },
      {
        instruction:
          'Create a CPU-hungry Pod with a 100m limit and show non-zero throttling counters.',
      },
      { instruction: 'Fix the OOM Pod by raising its limit and confirm it stays Running.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the three QoS classes',
        language: 'bash',
        code: `kubectl create namespace res-lab
kubectl config set-context --current --namespace=res-lab

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: guaranteed, namespace: res-lab}
spec:
  containers:
    - name: c
      image: nginx:1.27-alpine
      resources:
        requests: {cpu: 100m, memory: 128Mi}
        limits: {cpu: 100m, memory: 128Mi}
---
apiVersion: v1
kind: Pod
metadata: {name: burstable, namespace: res-lab}
spec:
  containers:
    - name: c
      image: nginx:1.27-alpine
      resources:
        requests: {cpu: 50m, memory: 64Mi}
        limits: {cpu: 500m, memory: 256Mi}
---
apiVersion: v1
kind: Pod
metadata: {name: besteffort, namespace: res-lab}
spec:
  containers:
    - name: c
      image: nginx:1.27-alpine
YAML

kubectl wait --for=condition=Ready pod/guaranteed pod/burstable pod/besteffort --timeout=120s
kubectl get pods -o custom-columns='POD:.metadata.name,QOS:.status.qosClass'
# POD          QOS
# besteffort   BestEffort
# burstable    Burstable
# guaranteed   Guaranteed`,
      },
      {
        title: 'Steps 3-4 - unschedulable and OOMKilled',
        language: 'bash',
        code: `kubectl run too-big --image=busybox:1.36 --command \\
  --overrides='{"spec":{"containers":[{"name":"c","image":"busybox:1.36",
    "command":["sleep","3600"],"resources":{"requests":{"cpu":"100"}}}]}}' \\
  -- sleep 3600
sleep 10
kubectl get pod too-big
# too-big   0/1   Pending   0   10s
kubectl describe pod too-big | grep -A2 Events
# Warning FailedScheduling  0/1 nodes are available: 1 Insufficient cpu.

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: oomer, namespace: res-lab}
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      # Write 200Mi into shared memory, which counts against the limit
      command: ["sh", "-c", "dd if=/dev/zero of=/dev/shm/fill bs=1M count=200; sleep 60"]
      resources:
        requests: {memory: 32Mi}
        limits: {memory: 64Mi}
YAML

sleep 25
kubectl get pod oomer
# oomer   0/1   OOMKilled   0   25s
kubectl get pod oomer -o jsonpath='{.status.containerStatuses[0].state.terminated.reason}{" exit="}{.status.containerStatuses[0].state.terminated.exitCode}{"\\n"}'
# OOMKilled exit=137`,
      },
      {
        title: 'Steps 5-6 - cgroup values and throttling',
        language: 'bash',
        code: `# The limit as the kernel sees it (cgroup v2; use memory.limit_in_bytes on v1)
kubectl exec guaranteed -- sh -c 'cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes'
# 134217728        <- exactly 128Mi

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: throttled, namespace: res-lab}
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "while true; do :; done"]   # burn CPU
      resources:
        requests: {cpu: 50m}
        limits: {cpu: 100m}                              # 10% of one core
YAML

kubectl wait --for=condition=Ready pod/throttled --timeout=90s
sleep 30
kubectl exec throttled -- sh -c 'cat /sys/fs/cgroup/cpu.stat 2>/dev/null | grep -E "nr_throttled|throttled_usec"'
# nr_throttled 287
# throttled_usec 24500000
#   ^ the container is being slowed down, but NOT killed. CPU is compressible.

kubectl top pod throttled
# CPU(cores) close to 100m - pinned at the limit`,
      },
      {
        title: 'Steps 7-8 - fix and clean up',
        language: 'bash',
        code: `kubectl delete pod oomer
cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: oomer, namespace: res-lab}
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "dd if=/dev/zero of=/dev/shm/fill bs=1M count=200; sleep 120"]
      resources:
        requests: {memory: 128Mi}
        limits: {memory: 512Mi}      # now comfortably above the 200Mi write
YAML

sleep 30
kubectl get pod oomer
# oomer   1/1   Running   0   30s
kubectl get pod oomer -o jsonpath='{.status.containerStatuses[0].lastState}{"\\n"}'
# {}     <- no previous termination: it was never killed

kubectl config set-context --current --namespace=default
kubectl delete namespace res-lab`,
      },
    ],
    verification: [
      {
        command:
          "kubectl get pods -n res-lab -o custom-columns='POD:.metadata.name,QOS:.status.qosClass,PHASE:.status.phase'",
        what: 'The QoS classes and outcomes side by side.',
        expected: 'Guaranteed, Burstable and BestEffort all present; too-big Pending.',
      },
      {
        command:
          'kubectl exec throttled -n res-lab -- sh -c "grep nr_throttled /sys/fs/cgroup/cpu.stat"',
        what: 'Non-zero throttling proves the CPU limit is being enforced by slowing, not killing.',
        expected: 'nr_throttled with a value above 0.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace res-lab',
        what: 'Removes every Pod from the lab.',
        expected: 'namespace "res-lab" deleted',
      },
    ],
  },
  relatedTopicIds: [
    'quota-and-limitrange',
    'pod-failure-modes',
    'monitoring-cli-tools',
    'scaling-applications',
  ],
  docs: [
    {
      title: 'Resource management for Pods and containers',
      url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
    },
    {
      title: 'Quality of Service classes',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/',
    },
    {
      title: 'Assign memory resources to containers',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/',
    },
  ],
}
