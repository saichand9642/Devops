import type { Topic } from '../../../types'

export const monitoringCliTools: Topic = {
  id: 'monitoring-cli-tools',
  title: 'Monitoring applications with built-in CLI tools',
  domainId: 'observability',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 6,
  tags: ['kubectl top', 'metrics-server', 'watch', 'jsonpath', 'custom-columns', 'sort-by'],
  oneLiner:
    'What you can measure with kubectl alone: resource usage, live status changes, and the query flags that turn get into a monitoring tool.',
  explanation: [
    'The curriculum says "use built-in CLI tools to monitor Kubernetes applications". That means kubectl - not Prometheus, not Grafana. The exam environment has no dashboards.',
    '`kubectl top` reports live CPU and memory usage for Pods and nodes. It reads the **Metrics API**, which is served by the `metrics-server` add-on. If metrics-server is not installed, `kubectl top` fails and no CPU-based HPA can work.',
    'The important distinction: `kubectl top` shows **actual usage**, while `kubectl describe node` shows **requested** and **limited** amounts. A node can be 100% requested and 5% used, or 30% requested and 90% used. Scheduling uses requests; performance depends on usage.',
    '`kubectl get -w` (watch) streams changes as they happen, which is how you observe a rollout, a scale-up or a probe recovery in real time instead of re-running commands.',
    'The query flags - `-o jsonpath`, `-o custom-columns`, `--sort-by`, `--field-selector`, `-l` - are what turn `kubectl get` from a listing into a monitoring query you can run in one line.',
  ],
  whyItMatters: [
    'Exam tasks say things like "find the Pod using the most CPU in namespace X and write its name to a file". That is `kubectl top pods --sort-by=cpu` plus a redirect, and nothing else.',
    'Understanding requested versus actual usage is the difference between correctly diagnosing "the node is full" (requests) and "the application is slow" (usage).',
    'Watch mode saves real time: watching one rollout beats running `kubectl get pods` fifteen times.',
  ],
  howItWorks: [
    "metrics-server scrapes the kubelet's summary API every 15 seconds by default and serves aggregated values through `metrics.k8s.io`. Values are a short rolling window, not historical - there is no way to ask kubectl about yesterday.",
    '`kubectl top pods` shows per-Pod totals; `--containers` breaks it down per container, which is how you find which container in a multi-container Pod is using the memory.',
    '`--sort-by=cpu` and `--sort-by=memory` sort `kubectl top` output descending. For `kubectl get`, `--sort-by` takes a JSONPath expression such as `.status.startTime` or `.metadata.creationTimestamp` and sorts ascending.',
    '`kubectl get --watch` (`-w`) keeps the connection open and prints a line per change. `--watch-only` skips the initial listing. Add `-o wide` for extra columns.',
    '`--field-selector` filters server-side on a small set of fields (`status.phase`, `spec.nodeName`, `metadata.name`, and for events `type`/`reason`/`involvedObject.*`). Label selectors (`-l`) are the general-purpose filter.',
    '`-o custom-columns=NAME:.path,OTHER:.path` builds a table from arbitrary fields; `-o jsonpath` extracts raw values for scripting. Both read the same object you would see with `-o yaml`.',
    "`kubectl api-resources` and `kubectl get --raw /metrics` exist too - the latter returns the API server's own Prometheus metrics, occasionally useful but not exam material.",
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'Why kubectl top needs metrics-server',
      caption:
        'kubectl top is not built into the API. Without metrics-server it returns an error, not zeros.',
      participants: [
        { id: 'cli', label: 'kubectl top' },
        { id: 'api', label: 'API server' },
        { id: 'ms', label: 'metrics-server' },
        { id: 'kl', label: 'kubelet' },
      ],
      messages: [
        { from: 'cli', to: 'api', label: 'GET metrics.k8s.io' },
        { from: 'api', to: 'ms', label: 'proxied to the API service' },
        { from: 'ms', to: 'kl', label: 'scrape resource usage' },
        { from: 'kl', to: 'ms', label: 'CPU and memory samples', kind: 'return' },
        { from: 'ms', to: 'cli', label: 'usage per Pod and node', kind: 'return' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'PodMetrics',
      apiVersion: 'metrics.k8s.io/v1beta1',
      purpose: 'What `kubectl top pods` reads. Served by metrics-server, not stored in etcd.',
      fields: [
        {
          path: 'containers[].usage.cpu',
          meaning: 'CPU usage in cores or millicores over the scrape window.',
        },
        { path: 'containers[].usage.memory', meaning: 'Working-set memory in bytes (Ki/Mi/Gi).' },
        {
          path: 'timestamp',
          meaning: 'When the sample was taken - values are recent, never historical.',
        },
      ],
    },
    {
      kind: 'Node',
      apiVersion: 'v1',
      purpose: 'Capacity and allocatable amounts, which requests are measured against.',
      fields: [
        { path: 'status.capacity', meaning: 'Total CPU/memory/pods on the machine.' },
        {
          path: 'status.allocatable',
          meaning: 'What is available to Pods after system reservations - what the scheduler uses.',
        },
        {
          path: 'status.conditions[]',
          meaning: 'Ready, MemoryPressure, DiskPressure, PIDPressure.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A node that was full and idle at the same time',
    story: [
      'An operator reports "worker-2 is full, nothing can schedule there". A developer replies "it is doing nothing, look at the CPU graph". Both are right, and they are measuring different things.',
      '`kubectl describe node worker-2` shows CPU requests at 96% of allocatable. The scheduler will not place another Pod that requests CPU, so the node is full *for scheduling*.',
      '`kubectl top node worker-2` shows 8% CPU actual usage. Every Pod on it requested 500m and uses 20m, so the machine is nearly idle *for performance*.',
      'The fix is not more nodes - it is smaller requests. `kubectl top pods --containers --sort-by=cpu` across the namespace shows actual usage per container, and the team drops requests to roughly the observed usage plus headroom. Node utilisation for scheduling falls to 40%, and the same hardware absorbs twice the work.',
      'The habit worth taking away: set requests from measured usage, and use `kubectl top` to measure it.',
    ],
    code: [
      {
        title: 'Requests versus usage, side by side',
        language: 'bash',
        code: `kubectl describe node worker-2 | grep -A6 "Allocated resources"
# Resource   Requests      Limits
# --------   --------      ------
# cpu        3840m (96%)   7000m (175%)
# memory     6Gi (78%)     12Gi (156%)

kubectl top node worker-2
# NAME       CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
# worker-2   320m         8%     2100Mi          27%

# 96% requested, 8% used. The node is full for the SCHEDULER and idle
# in reality - a requests problem, not a capacity problem.`,
        explanation:
          'These two commands answer different questions and are both necessary. Never diagnose "the node is full" from only one of them.',
        placeholders: ['worker-2'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Requests sized from measured usage',
      language: 'yaml',
      code: `# Before: guessed, copied from a load-test manifest
resources:
  requests:
    cpu: 500m # observed usage is 20m
    memory: 1Gi # observed usage is 180Mi
  limits:
    cpu: "2"
    memory: 2Gi
---
# After: measured with kubectl top, plus headroom
resources:
  requests:
    cpu: 50m # ~2.5x observed steady state
    memory: 256Mi # ~1.4x observed steady state
  limits:
    cpu: 500m # allow bursting
    memory: 512Mi # 2x the request, above any observed peak`,
      explanation:
        'The request is a scheduling reservation, so it should reflect steady-state need. The limit is a ceiling, so it should reflect the peak you are willing to allow. Guessing high on requests wastes capacity silently.',
    },
  ],
  imperative: [
    {
      command: 'kubectl top nodes',
      what: 'Actual CPU and memory usage per node, with percentages of allocatable.',
      expected: 'One row per node with CPU(cores), CPU%, MEMORY(bytes), MEMORY%.',
    },
    {
      command: 'kubectl top pods -n shop',
      what: 'Actual usage per Pod in a namespace.',
      expected: 'NAME, CPU(cores), MEMORY(bytes).',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl top pods -n shop --containers',
      what: 'Breaks usage down per container - essential in multi-container Pods.',
      expected: 'A POD and NAME column, one row per container.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl top pods -n shop --sort-by=cpu',
      what: 'Highest CPU first - the direct answer to "which Pod is using the most CPU?".',
      expected: 'Descending by CPU.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl top pods -A --sort-by=memory | head -5',
      what: 'The top memory consumers across the whole cluster.',
      expected: 'The five hungriest Pods.',
    },
    {
      command: 'kubectl top pod -l app=api -n shop --sort-by=memory',
      what: 'Usage for one application only, sorted.',
      expected: 'Only Pods matching the selector.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n shop -w',
      what: 'Streams status changes live. The way to watch a rollout or a scale-up.',
      expected: 'A new line each time a Pod changes state. Ctrl+C to stop.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n shop --field-selector status.phase=Running',
      what: 'Server-side filtering by phase.',
      expected: 'Only Running Pods.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n shop --field-selector spec.nodeName=worker-2',
      what: 'Every Pod on one node - useful when a node is misbehaving.',
      expected: 'Pods bound to that node.',
      placeholders: ['shop', 'worker-2'],
    },
    {
      command:
        "kubectl get pods -n shop --sort-by=.status.startTime -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName,START:.status.startTime'",
      what: 'A chronological table of what started when.',
      expected: 'Oldest first.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe node worker-2 | grep -A6 "Allocated resources"',
      what: 'Requested and limited amounts on a node - what the scheduler cares about.',
      expected: 'CPU and memory requests/limits with percentages.',
      placeholders: ['worker-2'],
    },
    {
      command:
        "kubectl get pods -n shop -o custom-columns='POD:.metadata.name,CPU_REQ:.spec.containers[0].resources.requests.cpu,MEM_REQ:.spec.containers[0].resources.requests.memory,QOS:.status.qosClass'",
      what: 'Compares configured requests and QoS class across Pods - the input to a right-sizing exercise.',
      expected: 'A four-column table; `<none>` marks Pods with no requests.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl top pods -n shop --no-headers | sort -k2 -h -r | head -1 > /tmp/top-cpu-pod.txt',
      what: 'The pattern for "write the name of the busiest Pod to a file" tasks.',
      expected: 'A single line in the file.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Monitoring with kubectl is read-only; the declarative part is making your objects observable.',
      'Set `resources.requests` from measured usage so `describe node` percentages mean something.',
      'Give containers meaningful names so `kubectl top --containers` output is readable.',
      'Use consistent labels so `-l` can scope every query to one application.',
    ],
    code: [
      {
        title: 'A right-sizing loop',
        language: 'bash',
        code: `NS=shop
APP=api

# 1. What does it actually use, per container, right now?
kubectl top pods -n $NS -l app=$APP --containers

# 2. What has it been asking for?
kubectl get pods -n $NS -l app=$APP \\
  -o custom-columns='POD:.metadata.name,C:.spec.containers[*].name,REQ_CPU:.spec.containers[*].resources.requests.cpu,REQ_MEM:.spec.containers[*].resources.requests.memory'

# 3. Adjust to observed usage plus headroom
kubectl set resources deploy/$APP -c=$APP -n $NS \\
  --requests=cpu=50m,memory=256Mi --limits=cpu=500m,memory=512Mi
kubectl rollout status deploy/$APP -n $NS --timeout=180s

# 4. Confirm the node is less "full" for scheduling
kubectl describe node "$(kubectl get pods -n $NS -l app=$APP -o jsonpath='{.items[0].spec.nodeName}')" \\
  | grep -A6 "Allocated resources"`,
        placeholders: ['shop', 'api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl top pods -n shop',
      what: 'Confirms metrics are available and shows current usage.',
      expected: 'A usage table, not an error.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get --raw "/apis/metrics.k8s.io/v1beta1/nodes" | head -c 120',
      what: 'Confirms the Metrics API is registered at all, independently of the kubectl top formatting.',
      expected: 'JSON beginning {"kind":"NodeMetricsList"...',
    },
    {
      command: 'kubectl get apiservices | grep metrics',
      what: 'Shows whether the metrics APIService is Available.',
      expected: 'v1beta1.metrics.k8s.io ... True',
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl top pods -n shop',
      what: 'The error message tells you metrics-server is missing or unhealthy.',
      expected: 'error: Metrics API not available',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n kube-system -l k8s-app=metrics-server',
      what: 'Checks whether metrics-server is running.',
      expected: 'One Running Pod, or nothing if the add-on is not installed.',
    },
    {
      command: 'kubectl top pods -n shop',
      what: 'Freshly created Pods show no metrics for up to a minute - the scrape interval - which is not an error.',
      expected: 'Missing rows for very new Pods.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -A --field-selector status.phase=Pending',
      what: 'Cluster-wide scheduling backlog in one command.',
      expected: 'Ideally nothing.',
    },
    {
      command:
        'kubectl get nodes -o custom-columns=NODE:.metadata.name,READY:.status.conditions[-1].type,ALLOC_CPU:.status.allocatable.cpu,ALLOC_MEM:.status.allocatable.memory',
      what: 'Capacity available for scheduling, per node.',
      expected: 'One row per node.',
    },
  ],
  commonMistakes: [
    'Assuming `kubectl top` works everywhere. It needs metrics-server, which is not installed by default on every distribution.',
    'Confusing requested with used. `describe node` shows requests; `top node` shows usage. They are frequently very different.',
    'Expecting historical data from `kubectl top`. It reports a recent window only.',
    'Using `kubectl top` to size a *limit*. Measure peaks, not the steady state you happen to observe.',
    'Forgetting `--containers` in a multi-container Pod, so you cannot tell which container is responsible.',
    'Using `--field-selector` with a field it does not support - only a small set of fields are indexed. Use `-l` or client-side filtering otherwise.',
    'Re-running `kubectl get pods` repeatedly instead of using `-w`.',
  ],
  examTips: [
    '"Which Pod uses the most CPU/memory?" → `kubectl top pods -n <ns> --sort-by=cpu` (or `memory`). Add `--no-headers | head -1` when the answer must go into a file.',
    '"Write the name to /opt/answer.txt" → append `--no-headers | head -1 | awk \'{print $1}\' > /opt/answer.txt` and then `cat` the file to check it.',
    '`kubectl top pod --containers` is the version to use whenever Pods might have sidecars.',
    'If `kubectl top` errors, say so and fall back to `kubectl describe node` for requests - do not lose the whole task.',
    '`kubectl get pods -w` while a rollout runs is faster and clearer than repeated `get` calls.',
    '`-o custom-columns` is usually the fastest way to produce exactly the table a task asks for.',
  ],
  summary: [
    '`kubectl top` (nodes/pods, `--containers`, `--sort-by`) reports live usage and needs metrics-server.',
    '`describe node` shows requests and limits - what the scheduler uses - which is a different question from usage.',
    '`-w` streams changes; `--field-selector` filters server-side; `-l` filters by label.',
    '`-o custom-columns` builds tables, `-o jsonpath` extracts values for scripts.',
    'Metrics are a recent window only; there is no history in kubectl.',
  ],
  practice: [
    {
      id: 'mon-p1',
      level: 'beginner',
      prompt: 'Write the command that shows the Pod using the most memory in namespace `shop`.',
      answer: 'kubectl top pods -n shop --sort-by=memory | head -2',
      explanation:
        "`head -2` keeps the header plus the top row. For a file-writing task use `--no-headers | head -1 | awk '{print $1}' > /path/file`.",
    },
    {
      id: 'mon-p2',
      level: 'intermediate',
      prompt:
        '`kubectl describe node worker-1` shows CPU requests at 95%, but `kubectl top node worker-1` shows 10% CPU usage. Explain both numbers and what you would change.',
      answer:
        'Requests at 95% means Pods have *reserved* 95% of allocatable CPU, so the scheduler will not place more CPU-requesting Pods there. Usage at 10% means those Pods are barely using what they reserved. Nothing is wrong with the node - the requests are over-sized. Reduce `resources.requests.cpu` on the workloads to reflect measured usage plus headroom.',
      explanation:
        'This is the single most common capacity misunderstanding. Requests drive scheduling; usage drives performance. Over-sized requests waste capacity invisibly, because no graph shows it.',
    },
    {
      id: 'mon-p3',
      level: 'advanced',
      prompt:
        'A multi-container Pod is close to its memory limit. Write the command that identifies which container is responsible, and the command that shows the configured limits for comparison.',
      answer:
        "kubectl top pod <pod> -n <ns> --containers\nkubectl get pod <pod> -n <ns> -o custom-columns='C:.spec.containers[*].name,LIM_MEM:.spec.containers[*].resources.limits.memory'",
      explanation:
        'Without `--containers` you only see the Pod total, which cannot distinguish a leaking sidecar from a hungry application. Note that a `medium: Memory` emptyDir also counts against the container memory limit and will show up in the working-set figure.',
    },
  ],
  lab: {
    title: 'Measure, compare and right-size',
    scenario:
      'You will measure actual usage with `kubectl top`, compare it with requested amounts, watch a rollout live, and build the custom-columns tables that answer exam-style questions.',
    prerequisites: [
      'A cluster with metrics-server (minikube: `minikube addons enable metrics-server`; kind: install the metrics-server manifest)',
      'kubectl',
    ],
    tasks: [
      { instruction: 'Create namespace `mon-lab` and set it as default.' },
      { instruction: 'Confirm the Metrics API is available.' },
      {
        instruction:
          'Create a Deployment `busy` with 2 replicas that burns CPU, and one `idle` Deployment that sleeps, both with oversized requests.',
      },
      { instruction: 'Wait a minute, then show usage sorted by CPU, and per container.' },
      {
        instruction:
          "Build a custom-columns table comparing each Pod's request with its QoS class.",
      },
      {
        instruction:
          'Compare `top node` usage with `describe node` requests and note the difference.',
      },
      {
        instruction:
          'Right-size `idle` with `kubectl set resources`, watching the rollout with `-w`.',
      },
      { instruction: 'Write the name of the highest-CPU Pod to a file, as an exam task would.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3',
        language: 'bash',
        code: `kubectl create namespace mon-lab
kubectl config set-context --current --namespace=mon-lab

kubectl get apiservices | grep metrics
# v1beta1.metrics.k8s.io   kube-system/metrics-server   True

kubectl create deployment busy --image=busybox:1.36 --replicas=2 -- \\
  sh -c 'while true; do :; done'
kubectl create deployment idle --image=busybox:1.36 --replicas=1 -- sleep 86400

# Oversized requests on both, on purpose
kubectl set resources deploy/busy -c=busybox --requests=cpu=500m,memory=256Mi --limits=cpu=1,memory=512Mi
kubectl set resources deploy/idle -c=busybox --requests=cpu=500m,memory=256Mi --limits=cpu=1,memory=512Mi
kubectl rollout status deploy/busy --timeout=120s
kubectl rollout status deploy/idle --timeout=120s`,
      },
      {
        title: 'Steps 4-5 - measure and tabulate',
        language: 'bash',
        code: `sleep 70    # give metrics-server time to scrape the new Pods

kubectl top pods --sort-by=cpu
# NAME                    CPU(cores)   MEMORY(bytes)
# busy-6d4b8f9c7-2xk4l    998m         1Mi
# busy-6d4b8f9c7-8n7pq    997m         1Mi
# idle-5f7c9d8b6-hj4rt    0m           1Mi

kubectl top pods --containers --sort-by=cpu
# POD                     NAME      CPU(cores)   MEMORY(bytes)
# busy-6d4b8f9c7-2xk4l    busybox   998m         1Mi

kubectl get pods -o custom-columns='POD:.metadata.name,REQ_CPU:.spec.containers[0].resources.requests.cpu,LIM_CPU:.spec.containers[0].resources.limits.cpu,QOS:.status.qosClass'
# POD                     REQ_CPU   LIM_CPU   QOS
# busy-6d4b8f9c7-2xk4l    500m      1         Burstable
# idle-5f7c9d8b6-hj4rt    500m      1         Burstable
#
# Note: busy USES 998m while REQUESTING 500m - it is bursting up to its limit.
#       idle USES 0m while RESERVING 500m - pure waste.`,
      },
      {
        title: 'Step 6 - requests versus usage on the node',
        language: 'bash',
        code: `NODE=$(kubectl get pods -o jsonpath='{.items[0].spec.nodeName}')

kubectl top node "$NODE"
# NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%

kubectl describe node "$NODE" | grep -A6 "Allocated resources"
# cpu   1500m (75%)   3 (150%)
#
# 1500m requested = 3 x 500m from our three Pods, regardless of actual use.
# The idle Pod contributes 500m of "full" to the scheduler and 0m of real load.`,
      },
      {
        title: 'Steps 7-8 - right-size while watching',
        language: 'bash',
        code: `# In one shell:
kubectl get pods -l app=idle -w &
WATCH=$!

kubectl set resources deploy/idle -c=busybox --requests=cpu=10m,memory=32Mi --limits=cpu=100m,memory=64Mi
kubectl rollout status deploy/idle --timeout=120s
kill $WATCH 2>/dev/null

kubectl describe node "$NODE" | grep -A3 "Allocated resources"
# cpu requests dropped by 490m

# The exam-style file answer:
kubectl top pods --no-headers --sort-by=cpu | head -1 | awk '{print $1}' > /tmp/top-cpu-pod.txt
cat /tmp/top-cpu-pod.txt
# busy-6d4b8f9c7-2xk4l`,
      },
      {
        title: 'Step 9 - cleanup',
        language: 'bash',
        code: `rm -f /tmp/top-cpu-pod.txt
kubectl config set-context --current --namespace=default
kubectl delete namespace mon-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl top pods -n mon-lab --sort-by=cpu --no-headers | head -1',
        what: 'The busy Pod should be first.',
        expected: 'A busy-* Pod with close to its CPU limit.',
      },
      {
        command:
          'kubectl get deploy idle -n mon-lab -o jsonpath=\'{.spec.template.spec.containers[0].resources.requests.cpu}{"\\n"}\'',
        what: 'Confirms the right-sizing took effect.',
        expected: '10m',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace mon-lab',
        what: 'Removes both Deployments.',
        expected: 'namespace "mon-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['resource-requirements', 'scaling-applications', 'describe-and-events'],
  docs: [
    {
      title: 'Tools for monitoring resources',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-usage-monitoring/',
    },
    {
      title: 'Resource metrics pipeline',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/',
    },
  ],
}
