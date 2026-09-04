import type { Topic } from '../../../types'

export const describeAndEvents: Topic = {
  id: 'describe-and-events',
  title: 'kubectl describe, events and Pod conditions',
  domainId: 'observability',
  difficulty: 'beginner',
  estimatedMinutes: 18,
  order: 2,
  tags: ['describe', 'events', 'conditions', 'field-selector', 'status', 'reason'],
  oneLiner:
    'The first command in every diagnosis: what describe shows you, how to read the event list, and which condition tells you where startup stopped.',
  explanation: [
    '`kubectl describe` fetches an object *and* the events that reference it, then formats both for humans. That combination is why it is the first command in almost every debugging sequence - it answers "what is the object" and "what has the cluster tried to do with it" together.',
    '**Events** are first-class, namespaced objects with a short lifetime (one hour by default). Each has a `reason` (a machine-readable word such as `Scheduled`, `Pulling`, `FailedScheduling`, `Unhealthy`, `OOMKilling`), a `message`, a type (`Normal` or `Warning`), a count, and the object it refers to.',
    'The healthy Pod event sequence is worth memorising: `Scheduled` → `Pulling` → `Pulled` → `Created` → `Started`. Where that sequence stops tells you which component gave up. No `Scheduled` means the scheduler could not place it; `Pulling` with no `Pulled` means an image problem; `Started` followed by `BackOff` means the application is exiting.',
    '**Conditions** are the structured, non-expiring version of the same story. A Pod has `PodScheduled`, `Initialized`, `ContainersReady` and `Ready`; a Deployment has `Available` and `Progressing`. Conditions do not expire after an hour the way events do, so for anything older than that they are the better source.',
    'Events are attached to objects, not to your intent, so a Deployment problem often has its real event on the ReplicaSet or the Pod. When `describe deployment` shows nothing useful, walk down the ownership chain.',
  ],
  whyItMatters: [
    'The curriculum names "debugging in Kubernetes" and "use built-in CLI tools to monitor Kubernetes applications" - describe and events are the core of both.',
    'Most CKAD troubleshooting tasks are solvable from describe output alone, in one command, if you know which section to read.',
    'Knowing events expire in about an hour prevents the mistake of trusting an empty event list as proof nothing went wrong.',
  ],
  howItWorks: [
    'Describe output sections, in order: metadata (name, namespace, labels, annotations), the resolved spec (including defaults Kubernetes filled in), per-container status (State, Last State, Ready, Restart Count), Conditions, Volumes, QoS class, tolerations, and finally Events.',
    '`kubectl get events` lists events directly. `--sort-by=.lastTimestamp` puts the newest last (the default order is not chronological, which surprises people). `--field-selector` narrows by object, type or reason.',
    'Useful field selectors: `involvedObject.name=<pod>`, `involvedObject.kind=Pod`, `type=Warning`, `reason=FailedScheduling`. They combine with commas.',
    'Event retention is a cluster setting (`--event-ttl`, default 1 hour). An hour-old problem has no events left, only conditions and container statuses.',
    'The `count` field means repetition: a Warning with count 47 is a recurring problem, not a one-off. `describe` shows this as "(x47 over 12m)".',
    'Conditions carry `type`, `status`, `reason`, `message` and `lastTransitionTime`. The transition time tells you *when* a Pod stopped being Ready, which no event will tell you an hour later.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How to read kubectl describe pod',
      caption:
        'Read it bottom-up. Events say what the cluster tried and failed to do, which is usually the whole answer.',
      nodes: [
        {
          label: 'Events, at the very bottom',
          detail: 'Start here. FailedScheduling, Failed, Unhealthy, BackOff.',
          tone: 'accent',
        },
        {
          label: 'Containers: State and Last State',
          detail: 'Exit Code and Reason for the run that ended',
          arrowLabel: 'if Events are quiet',
        },
        {
          label: 'Conditions',
          detail: 'PodScheduled, Initialized, ContainersReady, Ready',
        },
        {
          label: 'Mounts, Environment, Node',
          detail: 'Confirms the config actually reached the container',
        },
        {
          label: 'You know which layer failed',
          detail: 'Scheduling, image, init, app, or probe',
          tone: 'success',
          branch: {
            label: 'No Events at all',
            detail: 'They expire after about an hour. Recreate to regenerate them.',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Event',
      apiVersion: 'v1',
      purpose: 'A short-lived record of something a controller did or refused to do.',
      fields: [
        { path: 'type', meaning: 'Normal or Warning.' },
        {
          path: 'reason',
          meaning:
            'Machine-readable cause: Scheduled, Pulling, FailedScheduling, Unhealthy, OOMKilling, BackOff.',
        },
        { path: 'message', meaning: 'Human-readable detail, usually containing the actual error.' },
        {
          path: 'involvedObject',
          meaning: 'Kind/name/namespace of the object the event is about.',
        },
        { path: 'count', meaning: 'How many times this has repeated.' },
        { path: 'lastTimestamp', meaning: 'Most recent occurrence - sort by this.' },
        {
          path: 'source.component',
          meaning: 'Who emitted it: default-scheduler, kubelet, replicaset-controller.',
        },
      ],
    },
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Its conditions and container statuses are the non-expiring diagnosis.',
      fields: [
        {
          path: 'status.conditions[].type',
          meaning: 'PodScheduled, Initialized, ContainersReady, Ready.',
        },
        {
          path: 'status.conditions[].reason',
          meaning: 'Why it is False, e.g. ContainersNotReady, Unschedulable.',
        },
        {
          path: 'status.conditions[].lastTransitionTime',
          meaning: 'When it changed - survives event expiry.',
        },
        {
          path: 'status.containerStatuses[].state',
          meaning: 'running / waiting / terminated, with a reason.',
        },
        {
          path: 'status.containerStatuses[].lastState',
          meaning: "The previous instance's termination reason and exit code.",
        },
        {
          path: 'status.qosClass',
          meaning: 'Guaranteed, Burstable or BestEffort - decides eviction order.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Four different problems, one command each',
    story: [
      'A team keeps a short crib sheet on the wall, built from real incidents. Each entry is a describe output fragment and the conclusion it forces.',
      '`Warning FailedScheduling ... 0/3 nodes are available: 3 Insufficient memory` - the scheduler. Nothing is broken; the request does not fit. Reduce the request or add capacity.',
      '`Warning Failed ... Failed to pull image "...": not found` - the kubelet and the registry. The image name or tag is wrong, or credentials are missing. No point reading application logs.',
      '`Warning Unhealthy ... Readiness probe failed: HTTP probe failed with statuscode: 503` - the application is up but not ready. Check what `/readyz` actually needs.',
      "`Warning BackOff ... Back-off restarting failed container` with `Last State: Terminated, Reason: OOMKilled, Exit Code: 137` - the kernel killed it for exceeding its memory limit. Raise the limit or reduce the application's memory use.",
      'The point of the crib sheet is that each of these takes one `describe` and no guessing. The reason word is the diagnosis.',
    ],
    code: [
      {
        title: 'The reason word is the answer',
        language: 'bash',
        code: `kubectl describe pod api-6d4b8f9c7-2xk4l -n shop | tail -12
# Events:
#   Type     Reason     Age                 From               Message
#   ----     ------     ----                ----               -------
#   Normal   Scheduled  3m                  default-scheduler  Successfully assigned shop/api-... to worker-2
#   Normal   Pulled     3m                  kubelet            Container image already present on machine
#   Normal   Created    3m                  kubelet            Created container api
#   Normal   Started    3m                  kubelet            Started container api
#   Warning  Unhealthy  2m (x18 over 3m)    kubelet            Readiness probe failed: HTTP probe failed with statuscode: 503

# The (x18 over 3m) means it is persistent, not a startup blip.`,
        explanation:
          'Read events bottom-up: the last line is the current problem, and the lines above it prove which stages succeeded.',
        placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: "What a Pod's conditions look like as data",
      language: 'yaml',
      code: `# kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o yaml   (status section only)
status:
  phase: Running
  qosClass: Burstable
  conditions:
    - type: PodReadyToStartContainers
      status: "True"
      lastTransitionTime: "2026-09-03T13:00:04Z"
    - type: Initialized
      status: "True"
      lastTransitionTime: "2026-09-03T13:00:02Z"
    - type: Ready
      status: "False" # <- the Pod is NOT in Service endpoints
      reason: ContainersNotReady
      message: 'containers with unready status: [api]'
      lastTransitionTime: "2026-09-03T13:00:05Z"
    - type: ContainersReady
      status: "False"
      reason: ContainersNotReady
      message: 'containers with unready status: [api]'
    - type: PodScheduled
      status: "True"
      lastTransitionTime: "2026-09-03T13:00:00Z"
  containerStatuses:
    - name: api
      ready: false
      restartCount: 0
      started: true
      state:
        running:
          startedAt: "2026-09-03T13:00:04Z"`,
      explanation:
        'This is the "Running but not Ready" state in full. `PodScheduled=True` rules out the scheduler, `Initialized=True` rules out init containers, `state: running` proves the container started, and `Ready=False` with `ContainersNotReady` points squarely at the readiness probe.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      title: "A Deployment's conditions",
      language: 'yaml',
      code: `# kubectl get deploy api -n shop -o yaml   (status section only)
status:
  replicas: 4
  updatedReplicas: 1
  readyReplicas: 3
  availableReplicas: 3
  conditions:
    - type: Available
      status: "True" # enough Pods are serving
      reason: MinimumReplicasAvailable
    - type: Progressing
      status: "False" # but the rollout is stuck
      reason: ProgressDeadlineExceeded
      message: ReplicaSet "api-7c9d8f4a2" has timed out progressing.`,
      explanation:
        '`Available=True` with `Progressing=False` is the signature of a failed rollout that has not caused an outage - exactly what a good `maxUnavailable` setting produces. The message names the ReplicaSet to investigate next.',
      placeholders: ['api', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl describe pod api-6d4b8f9c7-2xk4l -n shop',
      what: 'The whole picture for one Pod: resolved spec, container states, conditions, volumes and events.',
      expected: 'Sections ending with Events.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl describe pod api-6d4b8f9c7-2xk4l -n shop | tail -15',
      what: 'Jumps straight to the events, which is what you usually want.',
      expected: 'The event table.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --sort-by=.lastTimestamp',
      what: 'All recent events in the namespace, oldest first. The default order is not chronological, so always sort.',
      expected: 'A table with LAST SEEN, TYPE, REASON, OBJECT, MESSAGE.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get events -n shop --field-selector type=Warning --sort-by=.lastTimestamp',
      what: 'Only the problems, newest last - the fastest namespace-wide triage.',
      expected: 'Warning events only.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector involvedObject.name=api-6d4b8f9c7-2xk4l',
      what: 'Events for one object without the noise of the whole namespace.',
      expected: "That Pod's events only.",
      placeholders: ['shop', 'api-6d4b8f9c7-2xk4l'],
    },
    {
      command: 'kubectl get events -A --field-selector reason=FailedScheduling',
      what: 'Cluster-wide search for one class of problem.',
      expected: 'Every unschedulable Pod in the cluster.',
    },
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{range .status.conditions[*]}{.type}={.status} {.reason}{"\\n"}{end}\'',
      what: 'The conditions as a compact list - non-expiring, unlike events.',
      expected: 'PodScheduled=True, Initialized=True, Ready=False ContainersNotReady.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl describe deploy api -n shop',
      what: 'Deployment-level view: strategy, conditions, and which ReplicaSets are old and new.',
      expected: 'OldReplicaSets and NewReplicaSet lines plus events.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl describe node worker-2 | grep -A6 "Allocated resources"',
      what: 'Why a node could not take another Pod - the requests already committed on it.',
      expected: 'CPU and memory Requests/Limits with percentages.',
      placeholders: ['worker-2'],
    },
    {
      command:
        'kubectl get events -n shop -o custom-columns=TIME:.lastTimestamp,TYPE:.type,REASON:.reason,OBJ:.involvedObject.name,MSG:.message --sort-by=.lastTimestamp',
      what: 'A readable, greppable event table.',
      expected: 'Five columns, chronological.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Diagnosis is read-only - there is nothing declarative to write here. What matters is the order you read things in.',
      'Step 1: `kubectl get pods` to see phase, READY and RESTARTS.',
      'Step 2: `kubectl describe pod <name>` and read the Events section bottom-up.',
      'Step 3: if the container started, `kubectl logs <name>` (with `--previous` if RESTARTS > 0).',
      'Step 4: if events have expired, fall back to `status.conditions` and `status.containerStatuses.lastState`.',
      'Step 5: if the object is owned by a controller, describe the owner and the owned object - the real error may be on either.',
    ],
    code: [
      {
        title: 'A triage script you can type from memory',
        language: 'bash',
        code: `NS=shop

# 1. What is unhealthy?
kubectl get pods -n $NS | grep -vE 'Running|Completed'

# 2. Namespace-wide warnings, newest last
kubectl get events -n $NS --field-selector type=Warning --sort-by=.lastTimestamp | tail -10

# 3. Zoom in on the worst offender
POD=$(kubectl get pods -n $NS --no-headers | grep -vE 'Running|Completed' | head -1 | awk '{print $1}')
kubectl describe pod "$POD" -n $NS | tail -20

# 4. Conditions, which do not expire
kubectl get pod "$POD" -n $NS -o jsonpath='{range .status.conditions[*]}{.type}={.status} {.reason}{"\\n"}{end}'`,
        placeholders: ['shop'],
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{.status.conditions[?(@.type=="Ready")].status}{"\\n"}\'',
      what: 'The single most useful yes/no about a Pod: is it in Service endpoints?',
      expected: 'True',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --field-selector type=Warning | wc -l',
      what: 'A quick health check on a namespace after a change.',
      expected: '0 or 1 (the header) when nothing is wrong.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl describe pod api-6d4b8f9c7-2xk4l -n shop | grep -E "^Status:|Ready:|Restart Count:"',
      what: "Three lines that summarise a Pod's health.",
      expected: 'Status: Running, Ready: True, Restart Count: 0.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod mypod -n shop | grep -A5 Events',
      what: 'Start here for every Pod problem.',
      expected: 'The event that names the failing stage.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --sort-by=.lastTimestamp | tail -20',
      what: 'When the problem spans several objects (quota, admission, scheduling), the namespace view shows the pattern.',
      expected: 'Recent events across all objects.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe rs api-7c9d8f4a2 -n shop | grep -A5 Events',
      what: 'When a Deployment cannot create Pods at all, the FailedCreate event is on the ReplicaSet, not the Deployment.',
      expected: 'FailedCreate with the quota or admission error.',
      placeholders: ['api-7c9d8f4a2', 'shop'],
    },
    {
      command:
        'kubectl get pod mypod -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState}{"\\n"}\'',
      what: 'When events have expired, lastState still holds the termination reason and exit code.',
      expected: '{"terminated":{"exitCode":137,"reason":"OOMKilled",...}}',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --field-selector involvedObject.kind=Node',
      what: 'Node-level events (pressure, eviction) explain Pods that were working and then were not.',
      expected: 'NodeHasDiskPressure or eviction events, or nothing.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Reading `kubectl get events` without `--sort-by=.lastTimestamp` and drawing conclusions from an arbitrary order.',
    'Treating an empty event list as proof of health. Events expire after about an hour.',
    'Describing the Deployment when the error is on the ReplicaSet or the Pod. Walk the ownership chain.',
    'Going to `logs` before `describe`, and reading an empty log for a container that never started.',
    'Ignoring the `(xN over M)` repetition count, which distinguishes a startup blip from a persistent failure.',
    'Missing that events are namespaced - `kubectl get events` without `-n` only shows the current namespace.',
    'Reading the top of the Events list instead of the bottom. The newest event is last when sorted.',
  ],
  examTips: [
    '`kubectl describe pod <name>` is the highest-value single command in the exam. Pipe it to `tail -20` to land on the events.',
    'Memorise the reason-to-cause mapping: FailedScheduling → scheduler/resources; Failed+ErrImagePull → image/credentials; Unhealthy → probe; BackOff → application exiting; OOMKilling → memory limit.',
    '`kubectl get events -n <ns> --field-selector type=Warning --sort-by=.lastTimestamp` triages a whole namespace in one line.',
    'If a task asks you to record *why* something failed, the event `message` is the text to quote.',
    'When describe output is long, `grep -A5 Events`, `grep -i "last state"` and `grep -E "^Status:|Ready:"` get you to the useful parts fast.',
  ],
  summary: [
    '`describe` combines the resolved object with its events - the reason it is the first debugging command.',
    'Healthy Pod events: Scheduled → Pulling → Pulled → Created → Started. Where it stops names the failing component.',
    'Events are namespaced, expire in about an hour, and are not sorted by default - always `--sort-by=.lastTimestamp`.',
    'Conditions (PodScheduled, Initialized, ContainersReady, Ready) do not expire and carry transition times.',
    'Controller-owned objects put errors on the owner or the owned object - check both.',
  ],
  practice: [
    {
      id: 'desc-p1',
      level: 'beginner',
      prompt:
        "A Pod's events end with `Warning FailedScheduling ... 0/3 nodes are available: 3 Insufficient cpu`. Which component reported this and what do you change?",
      answer:
        "The default scheduler. Nothing is broken - no node can satisfy the Pod's CPU request. Reduce `spec.containers[].resources.requests.cpu`, or add cluster capacity.",
      explanation:
        'Confirm the available capacity with `kubectl describe node <node> | grep -A6 "Allocated resources"`. The scheduler compares your request against `status.allocatable`, not against actual usage.',
    },
    {
      id: 'desc-p2',
      level: 'intermediate',
      prompt: 'Write the command that lists only Warning events in namespace `shop`, newest last.',
      answer: 'kubectl get events -n shop --field-selector type=Warning --sort-by=.lastTimestamp',
      explanation:
        'Field selectors on events also accept `reason=`, `involvedObject.name=` and `involvedObject.kind=`, comma-separated for AND. Without `--sort-by` the order is not chronological.',
    },
    {
      id: 'desc-p3',
      level: 'advanced',
      prompt:
        'A Pod has been failing for three hours. `kubectl describe pod` shows an empty Events section. Where do you look instead, and which two fields answer the question?',
      answer:
        'Events have expired (default TTL one hour), so read the Pod status:\n1. `status.conditions[]` - which condition is False, its `reason` and its `lastTransitionTime`.\n2. `status.containerStatuses[].lastState.terminated` - the `reason` and `exitCode` of the last failed instance.\n\nkubectl get pod <name> -n <ns> -o jsonpath=\'{range .status.conditions[*]}{.type}={.status} {.reason}{"\\n"}{end}{.status.containerStatuses[0].lastState}\'',
      explanation:
        'This is why conditions exist: they are the durable summary. `kubectl logs <pod> --previous` may also still work if the container has not restarted more than once since.',
    },
  ],
  lab: {
    title: 'Read four failures from describe alone',
    scenario:
      'You will create four Pods that fail in four different ways, and for each one identify the cause from `kubectl describe` output without reading any application code.',
    prerequisites: ['A cluster with at least one Ready node'],
    tasks: [
      { instruction: 'Create namespace `desc-lab` and set it as default.' },
      { instruction: 'Create a Pod requesting 500 CPUs and identify the failure from describe.' },
      { instruction: 'Create a Pod with a non-existent image and identify the failure.' },
      {
        instruction:
          'Create a Pod whose readiness probe always fails, and identify it from both describe and the Ready condition.',
      },
      {
        instruction:
          'Create a Pod that exits 1 immediately and read its BackOff event and last-state exit code.',
      },
      { instruction: 'List all Warning events in the namespace, newest last.' },
      { instruction: 'Print the conditions of the readiness-failing Pod with jsonpath.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'All four failures in one manifest',
        language: 'yaml',
        code: `# failures.yaml
apiVersion: v1
kind: Pod
metadata:
  name: too-big
  namespace: desc-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"]
      resources:
        requests:
          cpu: "500"
---
apiVersion: v1
kind: Pod
metadata:
  name: bad-image
  namespace: desc-lab
spec:
  containers:
    - name: c
      image: busybox:this-tag-does-not-exist
      command: ["sleep", "3600"]
---
apiVersion: v1
kind: Pod
metadata:
  name: never-ready
  namespace: desc-lab
spec:
  containers:
    - name: c
      image: nginx:1.27-alpine
      readinessProbe:
        httpGet:
          path: /this-path-404s
          port: 80
        periodSeconds: 3
        failureThreshold: 1
---
apiVersion: v1
kind: Pod
metadata:
  name: exiter
  namespace: desc-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo starting; exit 1"]`,
      },
      {
        title: 'Apply, then read each one',
        language: 'bash',
        code: `kubectl create namespace desc-lab
kubectl config set-context --current --namespace=desc-lab
kubectl apply -f failures.yaml
sleep 45

kubectl get pods
# NAME          READY   STATUS             RESTARTS   AGE
# bad-image     0/1     ImagePullBackOff   0          45s
# exiter        0/1     CrashLoopBackOff   2          45s
# never-ready   0/1     Running            0          45s
# too-big       0/1     Pending            0          45s`,
      },
      {
        title: 'Steps 2-3 - scheduler and kubelet failures',
        language: 'bash',
        code: `kubectl describe pod too-big | tail -4
# Warning  FailedScheduling  default-scheduler  0/1 nodes are available: 1 Insufficient cpu.
#          ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^ the SCHEDULER, so it is a request problem

kubectl describe pod bad-image | tail -6
# Normal   Scheduled  ...  kubelet  Successfully assigned ...
# Warning  Failed     ...  kubelet  Failed to pull image "busybox:this-tag-does-not-exist":
#                                   ... manifest unknown
# Warning  Failed     ...  kubelet  Error: ErrImagePull
# Normal   BackOff    ...  kubelet  Back-off pulling image
#          ^ the KUBELET, so it is an image or credentials problem`,
      },
      {
        title: 'Steps 4-5 - probe and application failures',
        language: 'bash',
        code: `kubectl describe pod never-ready | tail -4
# Warning  Unhealthy  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404

kubectl get pod never-ready -o jsonpath='{range .status.conditions[*]}{.type}={.status} {.reason}{"\\n"}{end}'
# PodReadyToStartContainers=True
# Initialized=True
# Ready=False ContainersNotReady
# ContainersReady=False ContainersNotReady
# PodScheduled=True
#   ^ scheduled and initialised fine; only readiness is failing

kubectl describe pod exiter | grep -A5 "Last State"
#     Last State:     Terminated
#       Reason:       Error
#       Exit Code:    1
kubectl logs exiter --previous
# starting`,
      },
      {
        title: 'Steps 6-8 - namespace triage and cleanup',
        language: 'bash',
        code: `kubectl get events --field-selector type=Warning --sort-by=.lastTimestamp \\
  -o custom-columns=TIME:.lastTimestamp,REASON:.reason,OBJ:.involvedObject.name,MSG:.message
# TIME   REASON             OBJ           MSG
# ...    FailedScheduling   too-big       0/1 nodes are available: 1 Insufficient cpu.
# ...    Failed             bad-image     Failed to pull image ...
# ...    BackOff            exiter        Back-off restarting failed container
# ...    Unhealthy          never-ready   Readiness probe failed: ...

kubectl config set-context --current --namespace=default
kubectl delete namespace desc-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get events -n desc-lab --field-selector type=Warning --sort-by=.lastTimestamp | wc -l',
        what: 'Confirms all four failures produced distinct warnings.',
        expected: 'Five or more lines (four reasons plus the header).',
      },
      {
        command:
          'kubectl get pod never-ready -n desc-lab -o jsonpath=\'{.status.conditions[?(@.type=="Ready")].reason}{"\\n"}\'',
        what: 'The durable version of the probe failure, which outlives the event.',
        expected: 'ContainersNotReady',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace desc-lab',
        what: 'Removes all four Pods.',
        expected: 'namespace "desc-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['debugging-pods', 'pod-failure-modes', 'container-logs'],
  docs: [
    {
      title: 'Determine the reason for Pod failure',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-application/determine-reason-pod-failure/',
    },
    {
      title: 'Pod conditions',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-conditions',
    },
  ],
}
