import type { InterviewQuestion } from '../../../types'

/** Pods, controllers, scheduling and the workload objects. */
export const k8sWorkloadQuestions: InterviewQuestion[] = [
  {
    id: 'itv-k8s-17',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a Pod, and why does Kubernetes schedule Pods rather than containers?',
    probing:
      'The most fundamental Kubernetes concept. If this is shaky, everything above it is too.',
    answer: [
      'A Pod is the **smallest deployable unit** in Kubernetes: one or more containers that are always **scheduled together on the same node**, share a **network namespace** (so they see the same IP and can talk over `localhost`) and can share **volumes**.',
      'Kubernetes schedules Pods rather than individual containers because some things genuinely belong together. A log shipper that reads files your application writes must be on the same machine with access to the same directory. A service mesh proxy that intercepts your traffic must share your network namespace. Making the Pod the unit lets those patterns exist without special cases.',
      'The important consequence is that a Pod is **mortal and disposable**. It gets a fresh IP, it is never repaired in place, and when a node dies its Pods are not moved - new ones are created elsewhere. Almost nobody creates Pods directly; you create a Deployment or a Job and let a controller manage Pods for you.',
    ],
    code: [
      {
        title: 'A Pod with a sidecar sharing a volume',
        language: 'yaml',
        code: `apiVersion: v1
kind: Pod
metadata:
  name: web-with-logger
spec:
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        - { name: logs, mountPath: /var/log/nginx }
    - name: log-shipper           # same node, same volume, same network
      image: fluent/fluent-bit:3.1
      volumeMounts:
        - { name: logs, mountPath: /var/log/nginx, readOnly: true }
  volumes:
    - name: logs
      emptyDir: {}`,
        explanation:
          'emptyDir lives as long as the Pod - perfect for sharing between containers, useless for persistence.',
      },
    ],
    traps: [
      'Treating a Pod like a small VM you can log into and repair. You replace it, you do not fix it.',
      'Putting two unrelated applications in one Pod. If they can scale independently, they are two Pods.',
    ],
    followUps: [
      'When would you genuinely want two containers in one Pod?',
      'What happens to a Pod when its node fails?',
    ],
    tags: ['pods', 'fundamentals', 'sidecar', 'scheduling'],
  },
  {
    id: 'itv-k8s-18',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the relationship between a Deployment, a ReplicaSet and a Pod?',
    probing: 'Whether you know the ownership chain, which is what makes rollbacks possible.',
    options: [
      { id: 'a', text: 'They are three names for the same object' },
      {
        id: 'b',
        text: 'A Deployment manages ReplicaSets; each ReplicaSet manages a set of identical Pods',
      },
      { id: 'c', text: 'A Pod manages ReplicaSets, which are grouped into a Deployment' },
      { id: 'd', text: 'A ReplicaSet manages Deployments, which create Pods' },
    ],
    correct: ['b'],
    answer: [
      'The chain runs **Deployment → ReplicaSet → Pod**. A ReplicaSet has exactly one job: keep *N* identical Pods running. A Deployment sits above it and manages **versions** - each time you change the Pod template it creates a **new ReplicaSet** and gradually shifts replicas from the old one to the new one.',
      'That is precisely why rollbacks work. The old ReplicaSet is not deleted; it is scaled to zero and kept in history. `kubectl rollout undo` just scales it back up and the new one down.',
      'Each object also sets `ownerReferences` on the one below it, so deleting a Deployment garbage-collects its ReplicaSets and their Pods automatically.',
    ],
    code: [
      {
        title: 'Seeing the chain and the retained history',
        language: 'bash',
        code: `kubectl get deploy,rs,pods -l app=api

# Old ReplicaSets are kept at 0 replicas - that is your rollback history
# NAME                  DESIRED  CURRENT  READY
# replicaset.apps/api-7d4f   3        3        3
# replicaset.apps/api-6b9c   0        0        0     <- previous version

kubectl rollout history deployment/api
kubectl rollout undo deployment/api --to-revision=2`,
      },
    ],
    traps: [
      'Editing or deleting a ReplicaSet directly. The Deployment recreates it and your change vanishes.',
      'Setting `revisionHistoryLimit: 0` and then being unable to roll back.',
    ],
    followUps: ['What actually happens when you run `kubectl rollout undo`?'],
    tags: ['deployment', 'replicaset', 'fundamentals', 'rollback'],
  },
  {
    id: 'itv-k8s-19',
    level: 'intermediate',
    kind: 'open',
    prompt: 'When would you use a StatefulSet instead of a Deployment?',
    probing: 'Whether you can name the specific guarantees, not just say "for stateful apps".',
    answer: [
      'A Deployment treats its Pods as **interchangeable**: random names, random start order, any Pod can serve any request, and they all share whatever storage you give them. That is right for stateless services.',
      'A StatefulSet adds four guarantees that databases and clustered systems need. **Stable network identity**: Pods are named `db-0`, `db-1`, `db-2` and keep those names across restarts and reschedules, with a matching stable DNS name. **Ordered deployment**: `db-0` becomes ready before `db-1` starts. **Ordered, reverse scale-down**: `db-2` goes first. And **stable per-Pod storage**: each Pod gets its own PersistentVolumeClaim from `volumeClaimTemplates`, and `db-1` gets the *same* volume back when it is rescheduled.',
      'You need those when the members of a cluster are not interchangeable - a primary and its replicas, a Kafka broker that owns specific partitions, a ZooKeeper or etcd quorum where each member has an identity in the cluster configuration.',
      'The honest caveat is that a StatefulSet is not a database operator. It gives you identity and storage; it knows nothing about failover, backup or replication. For production databases most teams use an operator built on top of StatefulSets, or a managed service.',
    ],
    code: [
      {
        title: 'StatefulSet with per-Pod storage and a headless Service',
        language: 'yaml',
        code: `apiVersion: v1
kind: Service
metadata:
  name: db                 # headless: gives each Pod a DNS name
spec:
  clusterIP: None
  selector: { app: db }
  ports: [{ port: 5432 }]
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db          # must match the headless Service
  replicas: 3
  selector:
    matchLabels: { app: db }
  template:
    metadata:
      labels: { app: db }
    spec:
      containers:
        - name: postgres
          image: postgres:16
          volumeMounts:
            - { name: data, mountPath: /var/lib/postgresql/data }
  volumeClaimTemplates:    # one PVC per Pod, kept across rescheduling
    - metadata: { name: data }
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests: { storage: 50Gi }`,
        explanation: 'db-0 always gets data-db-0. That stable pairing is the whole point.',
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Deployment or StatefulSet?',
        caption: 'Only reach for a StatefulSet when identity or per-Pod storage genuinely matters.',
        question: 'What kind of workload is this?',
        branches: [
          {
            condition: 'Stateless - any replica can serve any request',
            result: 'Deployment',
            detail: 'Simpler, faster, easier to scale',
            tone: 'success',
          },
          {
            condition: 'Each replica owns its own data on disk',
            result: 'StatefulSet',
            detail: 'volumeClaimTemplates gives stable storage',
            tone: 'accent',
          },
          {
            condition: 'Members must know each other by name',
            result: 'StatefulSet',
            detail: 'Stable DNS via a headless Service',
            tone: 'accent',
          },
          {
            condition: 'One copy on every node',
            result: 'DaemonSet',
            detail: 'Log agents, CNI, node exporters',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      'PVCs created by `volumeClaimTemplates` are **not deleted** when you delete the StatefulSet. That is deliberate data safety, and it surprises people cleaning up a namespace.',
      'Scaling down leaves the PVCs behind too, so scaling back up reattaches the original data.',
      '`podManagementPolicy: Parallel` removes the ordering guarantee when you do not need it, which makes scaling much faster.',
    ],
    traps: [
      'Using a StatefulSet for a stateless app because it "feels more robust". You get slower rollouts and ordering constraints for nothing.',
      'Expecting a StatefulSet to handle database failover. It will not.',
      'Forgetting the headless Service, which leaves the stable DNS names unresolvable.',
    ],
    followUps: [
      'What happens to the PVCs when you delete a StatefulSet?',
      'Why is a headless Service required?',
    ],
    tags: ['statefulset', 'storage', 'databases', 'workloads'],
  },
  {
    id: 'itv-k8s-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain requests and limits. What does each one actually control?',
    probing:
      'Probably the single most consequential thing to get right in a cluster, and widely misunderstood.',
    answer: [
      'A **request** is what the **scheduler** uses. It is a reservation: the scheduler will only place a Pod on a node with that much CPU and memory unreserved. Requests do not restrain a running container at all - a container can happily use more than it requested if the node has spare capacity.',
      'A **limit** is what the **kernel** enforces on the running container through cgroups. Exceed a **CPU limit** and you are **throttled** - slowed down but alive. Exceed a **memory limit** and the container is **OOMKilled** immediately, exit code 137, no chance to clean up.',
      'So requests decide *where* a Pod goes and how much of the cluster is considered used; limits decide what happens when it misbehaves. Setting requests too high wastes money on empty nodes; setting them too low means the scheduler overpacks nodes and everything gets starved under load.',
      'They also determine the Pod’s **QoS class**, which decides who gets evicted when a node runs out of memory: **Guaranteed** (requests equal limits for every container) is evicted last, **Burstable** (requests set, limits higher or absent) next, and **BestEffort** (nothing set) first.',
    ],
    code: [
      {
        title: 'Requests and limits, with the QoS consequence',
        language: 'yaml',
        code: `resources:
  requests:            # scheduler reserves this much
    cpu: "250m"
    memory: "256Mi"
  limits:              # kernel enforces this hard ceiling
    cpu: "1000m"       # throttled above this
    memory: "512Mi"    # OOMKilled above this

# requests == limits for every container  -> QoS Guaranteed (evicted last)
# requests <  limits                       -> QoS Burstable
# neither set                              -> QoS BestEffort (evicted first)`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Requests schedule, limits enforce',
        caption:
          'The two numbers act at different times, on different components, with different failure modes.',
        nodes: [
          { label: 'Pod created', tone: 'accent' },
          {
            label: 'Scheduler reads requests',
            detail: 'Finds a node with capacity free',
            arrowLabel: 'placement',
          },
          { label: 'Kubelet starts the container', detail: 'Applies limits as cgroup settings' },
          {
            label: 'Container exceeds CPU limit',
            detail: 'Throttled - slow, still running',
            tone: 'warning',
          },
          {
            label: 'Container exceeds memory limit',
            detail: 'OOMKilled - exit 137, no cleanup',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'CPU limits are controversial. Aggressive throttling hurts tail latency badly, and many teams deliberately set CPU requests but **no** CPU limit, relying on requests for fair sharing.',
      'Memory limits are not optional in the same way. Without one, a leaking container can take down every other Pod on the node.',
      'Use `LimitRange` to set namespace defaults and `ResourceQuota` to cap a namespace’s total, so an unset Pod does not become BestEffort by accident.',
      'Right-size from real data: `kubectl top`, or better, Vertical Pod Autoscaler in recommendation mode over a week of traffic.',
    ],
    traps: [
      'Setting limits without requests. Kubernetes then defaults the request to the limit, reserving far more than you intended.',
      'Copying requests from a laptop measurement rather than production percentiles.',
      'Assuming CPU limits protect other Pods. Requests do that; limits mostly hurt the container that has them.',
    ],
    followUps: [
      'Why do some teams set CPU requests but no CPU limit?',
      'How would you work out the right values for an existing service?',
    ],
    tags: ['resources', 'scheduling', 'qos', 'oomkill', 'production'],
  },
  {
    id: 'itv-k8s-21',
    level: 'intermediate',
    kind: 'multi',
    prompt:
      'A Pod is stuck in `Pending`. Which of these could be the cause? Select all that apply.',
    probing:
      'Whether you know that Pending is always a scheduling problem, and its several flavours.',
    options: [
      { id: 'a', text: 'No node has enough allocatable CPU or memory for the Pod’s requests' },
      { id: 'b', text: 'The image cannot be pulled from the registry' },
      {
        id: 'c',
        text: 'Its PersistentVolumeClaim is unbound because no PV or StorageClass matches',
      },
      { id: 'd', text: 'Every candidate node has a taint the Pod does not tolerate' },
      { id: 'e', text: 'A nodeSelector or affinity rule matches no node' },
    ],
    correct: ['a', 'c', 'd', 'e'],
    answer: [
      '**Pending means the Pod has not been scheduled onto a node yet** - or has been scheduled but cannot start because a volume will not attach. Every cause is about placement.',
      'An image that cannot be pulled is **not** a Pending cause. The Pod has already been scheduled by then; it sits in `ContainerCreating` and reports `ImagePullBackOff`. Recognising which phase a symptom belongs to is half of Kubernetes troubleshooting.',
      'The others are all genuine: insufficient allocatable resources, an unbound PVC, taints without matching tolerations, and affinity or `nodeSelector` rules that no node satisfies.',
      'In every case `kubectl describe pod` tells you which. The scheduler writes an explicit event - "0/5 nodes are available: 3 Insufficient cpu, 2 node(s) had untolerated taint" - that names the exact reason per node.',
    ],
    code: [
      {
        title: 'Diagnosing Pending',
        language: 'bash',
        code: `# The scheduler's own explanation is in the events, at the bottom
kubectl describe pod api-7d4f-x2k9 | tail -20

# Is there actually room? Compare requests against allocatable
kubectl describe node node-3 | grep -A6 "Allocated resources"

# Unbound volume?
kubectl get pvc
kubectl describe pvc data-api-0

# Taints the Pod would need to tolerate
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints`,
      },
    ],
    traps: [
      'Confusing Pending with ContainerCreating. They point at completely different subsystems.',
      'Looking at node *capacity* instead of *allocatable* - the kubelet and system reserve a slice.',
      'Forgetting that a PVC with no matching StorageClass simply waits forever with no error.',
    ],
    followUps: [
      'How would you tell the difference between Pending and ImagePullBackOff at a glance?',
      'The cluster is full. What are your options?',
    ],
    tags: ['troubleshooting', 'scheduling', 'pending', 'debugging'],
  },
  {
    id: 'itv-k8s-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain liveness, readiness and startup probes. What goes wrong if you confuse them?',
    probing:
      'A production-safety question. Misconfigured probes cause more self-inflicted outages than almost anything else.',
    answer: [
      'They answer three different questions. **Liveness**: is this container broken beyond recovery? If it fails, the kubelet **restarts the container**. **Readiness**: can this Pod serve traffic *right now*? If it fails, the Pod is **removed from Service endpoints** but left running. **Startup**: has this container finished booting? While it is failing, liveness and readiness are **suspended**.',
      'The classic mistake is a liveness probe that checks a **dependency**. If your liveness endpoint queries the database, then a brief database outage causes every replica to fail liveness and be restarted simultaneously. You have converted a degraded dependency into a full outage of your own service, and the restart storm usually makes recovery slower.',
      'The rule is: **liveness checks only the process itself** - am I alive, am I not deadlocked - and **readiness checks whether I can usefully serve a request**, including dependencies. A database blip should take you out of rotation, not restart you.',
      'The **startup probe** exists for slow starters. Without it you must set a long `initialDelaySeconds` on liveness, which also delays detection of real failures forever after. A startup probe lets you be patient at boot and aggressive afterwards.',
    ],
    code: [
      {
        title: 'The three probes, correctly separated',
        language: 'yaml',
        code: `startupProbe:              # up to 5 minutes to boot, then get out of the way
  httpGet: { path: /healthz, port: 8080 }
  failureThreshold: 30
  periodSeconds: 10

livenessProbe:             # ONLY "is this process wedged?"
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3

readinessProbe:            # "can I serve a request right now?" - may check deps
  httpGet: { path: /readyz, port: 8080 }
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 2`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What each probe failure does',
        caption: 'Readiness removes traffic and is reversible. Liveness restarts, and is not free.',
        nodes: [
          { label: 'Container starts', tone: 'accent' },
          {
            label: 'Startup probe running',
            detail: 'Liveness and readiness are suspended',
            branch: {
              label: 'Exceeds failureThreshold',
              detail: 'Container is restarted',
              tone: 'danger',
            },
          },
          {
            label: 'Readiness probe fails',
            detail: 'Removed from Service endpoints',
            tone: 'warning',
            branch: { label: 'Recovers', detail: 'Traffic returns automatically', tone: 'success' },
          },
          {
            label: 'Liveness probe fails',
            detail: 'Container killed and restarted',
            tone: 'danger',
            branch: { label: 'Repeats', detail: 'CrashLoopBackOff', tone: 'danger' },
          },
        ],
      },
    ],
    deeper: [
      'A readiness probe that is too aggressive causes flapping endpoints, which shows up as intermittent 503s that are very hard to trace.',
      '`timeoutSeconds` defaults to 1 second. Under load a healthy service can easily take longer, so the probe kills it exactly when it is busiest.',
      'For gRPC services use a `grpc` probe rather than shelling out, and for anything non-HTTP, `exec` probes cost a process spawn on every interval.',
    ],
    traps: [
      'Checking the database in a liveness probe - the single most damaging probe mistake there is.',
      'No startup probe on a slow JVM, so it is killed mid-boot forever.',
      'A probe endpoint behind authentication, which fails in a way that looks like the app is down.',
    ],
    followUps: [
      'Your liveness probe checks the database and the database had a 30-second blip. What happened to your service?',
      'Why is `timeoutSeconds: 1` risky under load?',
    ],
    tags: ['probes', 'reliability', 'production', 'outage'],
  },
  {
    id: 'itv-k8s-23',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does a rolling update work, and how do you make one zero-downtime?',
    probing:
      'Whether you know the several independent things that must all be right, not just `strategy: RollingUpdate`.',
    answer: [
      'A rolling update creates a **new ReplicaSet** and shifts replicas across gradually, bounded by `maxSurge` (how many extra Pods may exist above the desired count) and `maxUnavailable` (how many may be missing). New Pods only count as available once their **readiness probe** passes.',
      'Zero downtime needs **four** things to be true together, and people usually only do the first. **One**, a correct readiness probe, so traffic is never sent to a Pod that is not ready. **Two**, `maxUnavailable: 0` so you never drop below full capacity. **Three**, **graceful shutdown**: the app must handle SIGTERM, stop accepting new connections and finish in-flight requests within `terminationGracePeriodSeconds`.',
      '**Four** - and this is the one that is almost always missing - a **`preStop` hook with a short sleep**. When a Pod is deleted, two things happen *in parallel*: the container gets SIGTERM, and the endpoint is removed from the Service. Endpoint removal has to propagate to every kube-proxy and every ingress controller, which takes a few seconds. Without a preStop sleep, the container starts shutting down while traffic is still being routed to it, and you get a burst of connection errors on every deploy.',
      'Add a **PodDisruptionBudget** so voluntary disruptions like node drains respect the same minimum, and the rollout is genuinely safe.',
    ],
    code: [
      {
        title: 'The full zero-downtime configuration',
        language: 'yaml',
        code: `spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0        # never go below full capacity
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: api
          readinessProbe:
            httpGet: { path: /readyz, port: 8080 }
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                # Let endpoint removal propagate BEFORE we start shutting down.
                command: ["sh", "-c", "sleep 10"]`,
      },
      {
        title: 'Watching and controlling a rollout',
        language: 'bash',
        code: `kubectl rollout status deployment/api --timeout=5m
kubectl rollout pause deployment/api      # stop mid-way to observe
kubectl rollout resume deployment/api
kubectl rollout undo deployment/api       # back to the previous ReplicaSet`,
      },
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'Why a Pod needs preStop',
        caption:
          'SIGTERM and endpoint removal race. The sleep makes sure removal wins before shutdown starts.',
        participants: [
          { id: 'api', label: 'API server' },
          { id: 'kubelet', label: 'Kubelet' },
          { id: 'ep', label: 'Endpoints/proxy' },
          { id: 'pod', label: 'Pod' },
        ],
        messages: [
          { from: 'api', to: 'kubelet', label: 'delete pod' },
          { from: 'api', to: 'ep', label: 'remove endpoint' },
          { from: 'kubelet', to: 'pod', label: 'run preStop (sleep 10)' },
          { from: 'ep', to: 'ep', label: 'propagates to all nodes', kind: 'return' },
          { from: 'kubelet', to: 'pod', label: 'SIGTERM (after preStop)' },
          { from: 'pod', to: 'pod', label: 'drain in-flight requests', kind: 'return' },
          { from: 'pod', to: 'kubelet', label: 'exit 0', kind: 'return' },
        ],
      },
    ],
    deeper: [
      '`maxUnavailable: 0` with `maxSurge: 1` is the safest pair, but it needs spare cluster capacity for the extra Pod - otherwise the rollout stalls in Pending.',
      'A `Recreate` strategy has guaranteed downtime, but it is the right choice when two versions cannot run at once - an incompatible schema migration, for instance.',
      'For risky releases, a rolling update is a blunt instrument. Blue/green or canary with a service mesh or Argo Rollouts gives you real traffic control and automated rollback on metrics.',
    ],
    traps: [
      'Believing readiness probes alone give zero downtime. They handle startup, not shutdown.',
      'A grace period shorter than the app takes to drain, so it gets SIGKILLed mid-request.',
      '`maxUnavailable: 0` on a full cluster, which deadlocks the rollout.',
    ],
    followUps: [
      'Why does removing the preStop sleep cause errors on every deploy?',
      'When would `Recreate` be the correct strategy?',
    ],
    tags: ['deployment', 'rolling update', 'zero downtime', 'production', 'graceful shutdown'],
  },
  {
    id: 'itv-k8s-24',
    level: 'advanced',
    kind: 'open',
    prompt:
      'Explain taints, tolerations, node affinity and pod anti-affinity. When do you use each?',
    probing: 'Scheduling control. Whether you know which mechanism repels and which attracts.',
    answer: [
      'They work in opposite directions, and that is the key to keeping them straight. A **taint** is on a **node** and **repels** Pods: "nothing runs here unless it explicitly tolerates this". A **toleration** is on a **Pod** and says "I can put up with that taint". Taints are how you reserve nodes - GPU nodes, spot instances, a dedicated tenant pool.',
      '**Node affinity** is on a **Pod** and **attracts** it to nodes matching labels: "schedule me on nodes with `disktype=ssd`". It comes in `requiredDuringScheduling` (a hard constraint - Pending if unmet) and `preferredDuringScheduling` (a weighted preference the scheduler tries to honour).',
      'The critical point is that **a toleration does not attract**. Tolerating a GPU taint means you *may* land on a GPU node, not that you will. To reserve GPU nodes for GPU workloads *and* keep those workloads off other nodes, you need **taint plus toleration plus node affinity** together.',
      '**Pod anti-affinity** is about relationships between Pods rather than nodes: "do not put two of my replicas on the same node". With `topologyKey: kubernetes.io/hostname` that survives a node failure; with `topology.kubernetes.io/zone` it survives a zone failure. This is the mechanism behind real high availability, and it is how you avoid the situation where you have five replicas and all five are on the node that just died.',
    ],
    code: [
      {
        title: 'Reserving GPU nodes properly - all three pieces',
        language: 'yaml',
        code: `# 1. Taint the node so nothing else lands there
#    kubectl taint nodes gpu-1 workload=gpu:NoSchedule

spec:
  # 2. Tolerate the taint so we are ALLOWED on GPU nodes
  tolerations:
    - key: workload
      operator: Equal
      value: gpu
      effect: NoSchedule
  affinity:
    # 3. Require GPU nodes so we do not land anywhere else
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - { key: accelerator, operator: In, values: ["nvidia-a100"] }`,
      },
      {
        title: 'Spreading replicas so a node or zone loss is survivable',
        language: 'yaml',
        code: `affinity:
  podAntiAffinity:
    # Hard rule: never two replicas on one node
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels: { app: api }
        topologyKey: kubernetes.io/hostname

# Modern alternative - more flexible, degrades gracefully
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels: { app: api }`,
        explanation:
          'ScheduleAnyway means an imbalanced cluster degrades spreading rather than blocking the deploy.',
      },
    ],
    deeper: [
      '`NoSchedule` stops new Pods; `NoExecute` also **evicts Pods already running** on the node. Adding a `NoExecute` taint to a busy node is an immediate, cluster-visible event.',
      '`IgnoredDuringExecution` in every affinity name is literal: the rule is checked at scheduling time only. Relabel a node afterwards and nothing moves.',
      'Hard `requiredDuringScheduling` anti-affinity means replicas cannot exceed your node count - a three-node cluster cannot run four replicas. Prefer `preferred` or `topologySpreadConstraints` unless you truly need the guarantee.',
      'Kubernetes taints nodes itself under pressure (`node.kubernetes.io/disk-pressure`, `not-ready`), which is how unhealthy nodes drain automatically.',
    ],
    traps: [
      'Adding a toleration and expecting the Pod to land on the tainted node. Tolerations permit; they do not attract.',
      'Hard anti-affinity plus more replicas than nodes, leaving Pods permanently Pending.',
      'Expecting affinity rules to move running Pods when labels change. They do not.',
    ],
    followUps: [
      'You have five replicas and all five landed on one node, which then failed. What would you add?',
      'What is the difference between NoSchedule and NoExecute?',
    ],
    tags: ['scheduling', 'affinity', 'taints', 'high availability', 'advanced'],
  },
  {
    id: 'itv-k8s-25',
    level: 'advanced',
    kind: 'open',
    prompt: 'How does the Horizontal Pod Autoscaler work, and what are its limits?',
    probing:
      'Whether you understand the control loop and, more importantly, when autoscaling cannot help.',
    answer: [
      'The HPA is a control loop that runs every 15 seconds. It reads a metric for the Pods of a target Deployment - CPU utilisation by default, from metrics-server - and computes `desiredReplicas = ceil(currentReplicas × currentMetric / targetMetric)`. If that differs from the current count it scales the Deployment.',
      'The critical detail is that **CPU utilisation is measured against the CPU *request***, not the limit and not the node. So a Pod requesting 100m and using 80m is at 80%. If requests are wrong, the HPA is wrong - it is the most common reason autoscaling behaves bizarrely.',
      'Its limits matter as much as its behaviour. **It cannot scale below the resources available**: if the cluster is full, new replicas sit Pending, so HPA without Cluster Autoscaler stops at the edge of your capacity. **It is reactive, not predictive**: scaling takes as long as a Pod takes to become ready, so a sudden spike is served by too few replicas for a minute or two regardless. And **it cannot fix a bottleneck it does not own** - if the constraint is a database connection limit, adding Pods makes things worse, not better.',
      'It also cannot be combined naively with the **Vertical Pod Autoscaler** on the same metric, because VPA changes requests and HPA measures against requests, so the two fight.',
    ],
    code: [
      {
        title: 'An HPA with tuned scaling behaviour',
        language: 'yaml',
        code: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }   # % of REQUEST
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0      # react to load immediately
      policies: [{ type: Percent, value: 100, periodSeconds: 30 }]
    scaleDown:
      stabilizationWindowSeconds: 300    # be slow and cautious coming down
      policies: [{ type: Percent, value: 10, periodSeconds: 60 }]`,
        explanation:
          'Asymmetric behaviour - fast up, slow down - is what stops the flapping that plagues default HPAs.',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'The HPA control loop',
        caption:
          'Utilisation is always relative to the CPU request, which is why wrong requests break autoscaling.',
        nodes: [
          {
            label: 'Every 15s: read metrics',
            detail: 'metrics-server or custom adapter',
            tone: 'accent',
          },
          { label: 'Compare to target', detail: 'current / target, per Pod' },
          { label: 'Compute desired replicas', detail: 'ceil(current x ratio)' },
          {
            label: 'Within stabilization window?',
            detail: 'Suppress flapping',
            branch: { label: 'Yes - do nothing', tone: 'muted' },
          },
          { label: 'Scale the Deployment', tone: 'success' },
          {
            label: 'No capacity for new Pods',
            detail: 'Pods go Pending - needs Cluster Autoscaler',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Custom and external metrics are usually better signals than CPU. Queue depth or requests-per-second track the thing users feel; CPU is a proxy for it at best.',
      'For queue workers, KEDA scales on queue length and can scale to zero, which the standard HPA cannot.',
      'Always pair HPA with a PodDisruptionBudget and sane `minReplicas` - autoscaling down to one replica during a quiet period removes your redundancy.',
      'HPA and VPA on the same workload and metric will fight. Use VPA in recommendation mode only, or on different resources.',
    ],
    traps: [
      'CPU requests set arbitrarily, making utilisation percentages meaningless.',
      'No Cluster Autoscaler, so HPA silently stops working when the cluster fills.',
      'Autoscaling a service whose real bottleneck is a shared database.',
      'Default scale-down behaviour causing replica counts to oscillate all day.',
    ],
    followUps: [
      'Your HPA is at maxReplicas but the service is still slow. What now?',
      'Why might scaling out make a database-bound service worse?',
    ],
    tags: ['autoscaling', 'hpa', 'performance', 'production', 'advanced'],
  },
  {
    id: 'itv-k8s-26',
    level: 'advanced',
    kind: 'scenario',
    prompt: 'A Pod is in `CrashLoopBackOff`. Take me through your diagnosis, step by step.',
    probing: 'The single most common Kubernetes interview scenario. They want an ordered method.',
    answer: [
      'First, understand what the status means: the container **starts, exits, and is restarted**, with the kubelet backing off exponentially - 10s, 20s, 40s, up to five minutes. The backoff is a symptom; the exit is the thing to investigate.',
      'Step one is **the logs of the previous instance**, not the current one. `kubectl logs <pod> --previous` shows the output from the run that crashed. The current container may have only just started and have nothing useful yet. This single flag resolves most cases.',
      'Step two is **`kubectl describe pod`**. The container status gives you the **exit code** and reason, and the events give you the history. **137** means SIGKILL - check `OOMKilled: true` for a memory limit. **1** or **2** is usually the application exiting on its own. **127** is "command not found" - a bad `command` or a missing binary in the image.',
      'Step three is to form a hypothesis from the **timing**. Crashing instantly points at configuration - a missing env var, an unreadable Secret, a wrong entrypoint. Crashing after a consistent few seconds points at a failed connection to a dependency, or a liveness probe with no startup probe killing a slow boot. Crashing under load points at memory.',
      'Step four is to **get inside without the crash loop**. Run the same image with the same config but an overridden command - `kubectl debug` with a copy of the Pod, or a temporary Pod running `sleep 3600` - and start the application by hand so you can watch it fail interactively. Also check the ConfigMaps and Secrets actually resolve, since a missing key blocks startup with a message that is easy to miss.',
      'Finally, fix the cause and not the symptom. Increasing a memory limit is right if the limit was too low; it is wrong if there is a leak, and you will be back.',
    ],
    code: [
      {
        title: 'The commands, in the order you should run them',
        language: 'bash',
        code: `POD=api-7d4f9c-x2k9

# 1. Why did the PREVIOUS run die? This is the important one.
kubectl logs $POD --previous --tail=100

# 2. Exit code, OOM flag, restart count, and the event history
kubectl describe pod $POD | sed -n '/Containers:/,/Events:/p'
kubectl get pod $POD -o jsonpath=\\
'{.status.containerStatuses[0].lastState.terminated.reason} {.status.containerStatuses[0].lastState.terminated.exitCode}{"\\n"}'

# 3. Does its configuration actually exist?
kubectl get configmap api-config -o yaml
kubectl get secret api-secrets -o jsonpath='{.data}' | jq 'keys'

# 4. Same image and config, but a shell instead of the crash loop
kubectl debug $POD -it --copy-to=api-debug --container=api -- sh`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Exit code narrows it before you read anything',
        caption: 'Four codes cover the overwhelming majority of crash loops.',
        question: 'What did the container exit with?',
        branches: [
          {
            condition: '137 with OOMKilled true',
            result: 'Memory limit too low, or a leak',
            detail: 'Compare usage over time before raising it',
            tone: 'danger',
          },
          {
            condition: '137 without OOMKilled',
            result: 'Killed by a liveness probe',
            detail: 'Usually a missing startup probe',
            tone: 'warning',
          },
          {
            condition: '127 or 126',
            result: 'Command not found or not executable',
            detail: 'Wrong command, or wrong architecture',
            tone: 'warning',
          },
          {
            condition: '1 or 2',
            result: 'The application exited deliberately',
            detail: 'Config or a dependency - the logs will say',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'An `initContainer` that fails produces `Init:CrashLoopBackOff`, and `kubectl logs` needs `-c <init-container>` to show anything. Easy to miss.',
      'The backoff timer resets only after the container stays up for 10 minutes, so a fix can look ineffective for several minutes.',
      '`kubectl get events --sort-by=.lastTimestamp` across the namespace often reveals it is not just this Pod - a node problem, an evicted DaemonSet, a full disk.',
      'If the same image runs fine elsewhere, compare the two environments: image digest, env vars, mounted Secrets, resource limits, node architecture.',
    ],
    traps: [
      'Forgetting `--previous` and reading logs from a container that has not done anything yet.',
      'Deleting the Pod to "retry", which destroys the evidence.',
      'Raising the memory limit without checking whether usage grows without bound.',
      'Missing that it is an initContainer failing, not the main one.',
    ],
    followUps: [
      'The logs are empty and the exit code is 0. What does that suggest?',
      'It works in staging but crash-loops in production. How do you narrow it down?',
    ],
    tags: ['scenario', 'troubleshooting', 'crashloopbackoff', 'debugging', 'production'],
  },
]
