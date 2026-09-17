import type { InterviewQuestion } from '../../../types'

/**
 * The troubleshooting round.
 *
 * These are deliberately the failures that do NOT announce themselves: the
 * apply that succeeded and changed nothing, the rollout that is stuck with no
 * error, the autoscaler that will not scale. What is being marked is method -
 * narrowing before changing, and knowing which command settles which question.
 */
export const k8sScenarioQuestions: InterviewQuestion[] = [
  {
    id: 'itv-k8s-52',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Pods are being OOMKilled after a release, but your memory dashboard shows usage well under the limit. Explain what is going on.',
    probing:
      'Whether you know which number the kernel actually kills on, and that an average hides a spike.',
    answer: [
      'The contradiction is nearly always one of three things, and I would work out which before changing any limit.',
      '**The dashboard is showing the wrong metric.** The kernel kills on `container_memory_working_set_bytes` - resident memory minus reclaimable page cache. Many dashboards plot `container_memory_usage_bytes`, which includes cache, or the process RSS, which excludes page cache the cgroup is charged for. Comparing the wrong number against the limit tells you nothing.',
      '**The dashboard is averaging away the spike.** A 30-second scrape interval with a 5-minute average will completely hide a two-second allocation burst that crossed the limit. The kill happens in milliseconds; the graph is smoothed. I would look at `max_over_time` on the working set rather than the mean, and at the container restart count and the pod’s `lastState.terminated.reason`, which records `OOMKilled` and is the ground truth.',
      '**The runtime does not know about the cgroup limit.** This is the classic release-triggered case. A JVM without `-XX:MaxRAMPercentage` or an older Node.js without `--max-old-space-size` sizes its heap from the **node’s** memory, not the container’s. On a 64Gi node with a 512Mi limit, the JVM cheerfully plans for a multi-gigabyte heap, grows into it, and is killed. The application’s own metrics show a healthy heap the whole time, which is exactly why the dashboards disagree with reality.',
      'There is also a fourth, less common case worth naming: the kill was of a **different container in the pod** - a sidecar - or the pod was evicted for node memory pressure rather than killed for its own limit. `kubectl describe pod` distinguishes them: `OOMKilled` on a container status is a cgroup limit; `Evicted` with a node-pressure message is the kubelet reclaiming.',
      'The fix follows the cause: plot the working set at max resolution, make the runtime cgroup-aware, and only then consider raising the limit. Raising the limit first is the common reflex and it just moves the failure later.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which OOM is this?',
        caption: 'The reason field distinguishes them, and each has a different fix.',
        question: 'What does kubectl describe say?',
        branches: [
          {
            condition: 'Container status OOMKilled, exit code 137',
            result: 'Cgroup limit hit',
            detail: 'this container exceeded its own memory limit',
            tone: 'danger',
          },
          {
            condition: 'Pod status Evicted, node memory pressure',
            result: 'Node ran out',
            detail: 'kubelet reclaimed - usually a pod with no requests set',
            tone: 'warning',
          },
          {
            condition: 'Heap looks fine in app metrics',
            result: 'Runtime not cgroup-aware',
            detail: 'JVM or Node sized itself from node memory, not the limit',
            tone: 'warning',
          },
          {
            condition: 'Usage flat on the graph, kills continue',
            result: 'Wrong metric or too much averaging',
            detail: 'plot working set with max_over_time, not the mean',
            tone: 'accent',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Establish the ground truth first',
        language: 'bash',
        explanation: 'The pod status records the kill. Everything else is inference.',
        code: `# Was it actually OOMKilled, and which container?
kubectl get pod checkout-7d9f -o jsonpath=\\
'{range .status.containerStatuses[*]}{.name}{"\\t"}{.lastState.terminated.reason}{"\\t"}{.lastState.terminated.exitCode}{"\\n"}{end}'
# checkout   OOMKilled   137      <- exit 137 = SIGKILL from the OOM killer

# Evicted instead? That is node pressure, not this container's limit.
kubectl get pod checkout-7d9f -o jsonpath='{.status.reason} {.status.message}'

# What limit is actually in force?
kubectl get pod checkout-7d9f -o jsonpath=\\
'{.spec.containers[*].resources}'

# What does the container itself think it has?
kubectl exec checkout-7d9f -- cat /sys/fs/cgroup/memory.max
kubectl exec checkout-7d9f -- nproc    # often ALSO wrong for the same reason`,
      },
      {
        title: 'Plot the number the kernel kills on',
        language: 'text',
        explanation:
          'Working set, at max resolution. The mean will hide the spike that killed you.',
        code: `# The metric the OOM killer actually acts on
max_over_time(
  container_memory_working_set_bytes{pod=~"checkout-.*", container!=""}[5m]
)

# As a fraction of the limit - anything creeping past 0.9 is living dangerously
max_over_time(container_memory_working_set_bytes{pod=~"checkout-.*"}[5m])
  /
container_spec_memory_limit_bytes{pod=~"checkout-.*"}

# Restarts caused by OOM specifically
sum by (pod) (
  kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}
)`,
      },
      {
        title: 'Make the runtime cgroup-aware',
        language: 'yaml',
        explanation:
          'The single most common fix. The JVM must be told to size from the container, not the node.',
        code: `containers:
  - name: checkout
    image: checkout:2.4.0
    env:
      # Heap = 75% of the CONTAINER limit, not of node memory.
      # Without this the JVM reads the node's 64Gi and plans accordingly.
      - name: JAVA_TOOL_OPTIONS
        value: '-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0'
    resources:
      requests:
        memory: 512Mi     # requests == limits gives Guaranteed QoS,
      limits:             # so this pod is last to be evicted
        memory: 512Mi

# Node.js equivalent:
#   NODE_OPTIONS: '--max-old-space-size=384'   (leave headroom below the limit)`,
      },
    ],
    deeper: [
      'Memory is incompressible: exceed the limit and you are killed immediately, with no throttling and no warning. CPU is compressible and merely throttles. That asymmetry is why memory limits deserve far more care than CPU limits.',
      'Setting requests equal to limits gives the pod **Guaranteed** QoS, which makes it the last to be evicted under node pressure. For a latency-critical service that is usually worth the lost bin-packing efficiency.',
      'Page cache counts towards the working set. A container doing heavy file I/O can be OOMKilled by cache it never asked for, although the kernel will try to reclaim first - this is a real cause for log-heavy or backup workloads.',
    ],
    traps: [
      'Raising the limit as the first action. It postpones the kill rather than explaining it.',
      'Trusting the application’s own heap metric, which is exactly the number that looks healthy in the cgroup-unaware case.',
      'Plotting `container_memory_usage_bytes`, which includes reclaimable cache and overstates the number that matters.',
    ],
    followUps: [
      'What is the difference between working set and usage?',
      'Why does exit code 137 mean OOM?',
      'What is QoS class and how does it affect eviction order?',
    ],
    tags: ['kubernetes', 'troubleshooting', 'memory', 'oomkilled'],
  },
  {
    id: 'itv-k8s-53',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A rolling update has been stuck at "2 of 5 updated" for twenty minutes. No error is shown. How do you diagnose it?',
    probing:
      'A rollout that stalls silently is extremely common. The method is to ask why the NEW pod is not becoming ready.',
    answer: [
      'A stalled rollout is almost always the same story: the Deployment created a new pod, that pod has not become **Ready**, and `maxUnavailable` will not let it remove any more old pods until it does. Nothing errors because nothing has failed yet - it is waiting.',
      'So the question is never "why is the rollout stuck", it is **"why is that one new pod not Ready"**. I would find it immediately with `kubectl get pods` and look at the one from the new ReplicaSet.',
      'From there the cause falls into a small set. **It cannot be scheduled**: Pending, and `describe` gives the reason - insufficient CPU or memory, a node selector or affinity nothing satisfies, an unsatisfiable topology spread constraint, or a taint with no toleration. With `maxSurge` the new pod needs capacity the cluster may simply not have.',
      '**It cannot pull the image**: `ImagePullBackOff` from a wrong tag, a missing `imagePullSecret`, or a registry rate limit. Trivially visible in events, and surprisingly often the answer.',
      '**It starts but never passes its readiness probe.** This is the interesting case. The probe path may be wrong, the port may be wrong, a dependency it checks may be down, or the application may simply take longer to start than the probe allows - which is what a `startupProbe` exists to solve. `kubectl describe` shows the probe failures; the container logs usually show a healthy application, which is the confusing part.',
      '**It is crashing**, in which case `CrashLoopBackOff` and the previous container’s logs tell you directly.',
      'Two subtler causes worth mentioning. A **PodDisruptionBudget** cannot block a rollout, but a **stuck terminating old pod** can hold things up - usually a `preStop` hook or a long `terminationGracePeriodSeconds`. And if the Deployment has a `progressDeadlineSeconds`, after it expires the rollout is marked failed with `ProgressDeadlineExceeded`, which is worth checking because it converts "stuck" into a reported condition.',
      'The decision at the end is operational: if this is production and users are affected, `kubectl rollout undo` first and diagnose afterwards. The old ReplicaSet is still there, which is exactly why rollback is instant.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Why a rollout waits',
        caption: 'maxUnavailable is the brake. The new pod not being Ready is the cause.',
        nodes: [
          {
            label: 'New ReplicaSet scaled up',
            detail: 'maxSurge allows extra pods above the desired count',
            tone: 'accent',
          },
          {
            label: 'New pod must become Ready',
            detail: 'scheduled, image pulled, readiness probe passing',
            arrowLabel: 'gate',
            branch: {
              label: 'Not Ready',
              detail: 'rollout waits here indefinitely - this is your bug',
              tone: 'danger',
            },
          },
          {
            label: 'Old pod terminated',
            detail: 'only once maxUnavailable permits it',
            arrowLabel: 'then',
          },
          {
            label: 'Repeat until all replicas replaced',
            detail: 'or progressDeadlineSeconds expires and it is marked failed',
            arrowLabel: 'loop',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Find the pod that is holding it up',
        language: 'bash',
        explanation: 'Go straight to the new ReplicaSet’s pod. Its status is the whole answer.',
        code: `# What does the rollout itself say?
kubectl rollout status deploy/checkout --timeout=10s
kubectl get deploy checkout -o jsonpath='{.status.conditions}' | jq

# Which ReplicaSet is new, and how many are ready?
kubectl get rs -l app=checkout --sort-by=.metadata.creationTimestamp

# THE question: why is the new pod not Ready?
kubectl get pods -l app=checkout
kubectl describe pod <new-pod>      # events are at the bottom - read them

# Cluster-wide events, newest last
kubectl get events --sort-by=.lastTimestamp | tail -20

# If it is a probe: is the endpoint really serving?
kubectl exec <new-pod> -- wget -qO- localhost:8080/healthz
kubectl get endpoints checkout      # empty means nothing is Ready

# Production first, curiosity second
kubectl rollout undo deploy/checkout`,
      },
      {
        title: 'The settings that decide how a rollout behaves',
        language: 'yaml',
        explanation:
          'progressDeadlineSeconds turns a silent stall into a reported failure - set it.',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
spec:
  replicas: 5
  # Do not let a stall hang forever with no signal
  progressDeadlineSeconds: 600
  minReadySeconds: 10          # must stay Ready this long before it counts
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1              # one extra pod above 5 - needs spare capacity
      maxUnavailable: 0        # never drop below 5 Ready - safest, but
                               # requires headroom or the rollout cannot start
  template:
    spec:
      containers:
        - name: checkout
          image: checkout:2.4.0
          # A slow starter needs a startupProbe, not a lenient livenessProbe
          startupProbe:
            httpGet: { path: /healthz, port: 8080 }
            failureThreshold: 30
            periodSeconds: 10          # allows up to 5 minutes to start
          readinessProbe:
            httpGet: { path: /ready, port: 8080 }
            periodSeconds: 5`,
      },
    ],
    deeper: [
      '`maxUnavailable: 0` with `maxSurge: 1` is the safest configuration and also the one that deadlocks on a full cluster: the rollout cannot proceed without capacity for one more pod. On a tightly packed cluster this presents exactly as "stuck with no error".',
      '`minReadySeconds` is worth setting. Without it a pod that passes readiness once and then crashes still counts as progress, and the rollout marches on replacing healthy pods with broken ones.',
      'Check whether the readiness probe depends on a downstream service. A probe that returns 503 when the database is slow will stall every rollout during an unrelated incident - readiness should reflect "can I serve", not "is the whole system healthy".',
    ],
    traps: [
      'Deleting the stuck pod. It is recreated identically and you have learned nothing.',
      'Assuming a PodDisruptionBudget blocked it. PDBs govern voluntary evictions such as drains, not Deployment rollouts.',
      'Diagnosing at length while users are affected instead of rolling back first.',
    ],
    followUps: [
      'What does maxSurge 1 and maxUnavailable 0 require from the cluster?',
      'When would a startupProbe have prevented this?',
      'What does progressDeadlineSeconds actually do?',
    ],
    tags: ['kubernetes', 'troubleshooting', 'deployment', 'rollout'],
  },
  {
    id: 'itv-k8s-54',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'After a node failure, a StatefulSet pod is stuck in Pending and its PVC will not attach. Walk me through it.',
    probing:
      'Storage and topology, which is where most people are weakest. The zone constraint is the key insight.',
    answer: [
      'Two mechanisms explain almost every case of this, and they are different problems.',
      'The first is **volume topology**. An EBS or a zonal persistent disk exists in **one availability zone**. The PersistentVolume carries a `nodeAffinity` recording that zone, and the scheduler will only place the pod on a node in it. If the failed node was the last one in that zone, or the autoscaler replaced it in a different zone, there is nowhere valid to schedule and the pod sits Pending with a `volume node affinity conflict` message. This is the one people miss, and `kubectl describe pod` states it plainly.',
      'The second is **attachment**. Most block storage is `ReadWriteOnce` - attachable to one node at a time. If the old node died without cleanly detaching, the cloud provider may still consider the volume attached to it. Kubernetes has a six-minute default force-detach timeout, so some of these resolve themselves if you wait; the `VolumeAttachment` object shows whether the detach has actually happened.',
      'A third case is specific to StatefulSets and worth naming because it is a genuine trap. When a node is **NotReady but not confirmed dead**, Kubernetes will not delete its pods, because a StatefulSet guarantees at most one pod per ordinal - deleting it while the old one might still be running and writing to the volume risks split-brain corruption. So the replacement pod is deliberately not created. Force-deleting the pod overrides that safety, and on a node that is merely partitioned rather than dead it can cause exactly the corruption the guarantee exists to prevent.',
      'So my sequence is: read the pod events to separate topology from attachment; check the PV’s node affinity and whether any healthy node is in that zone; check the VolumeAttachment for a stale attachment; and confirm the node is genuinely gone - not just unreachable - before force-deleting anything.',
      'If it is topology and no node exists in that zone, the resolutions are to bring up a node there, or to accept that the data is zone-pinned and restore from a snapshot into another zone. There is no way to move a zonal volume by asking Kubernetes nicely.',
      'The prevention is architectural and worth saying: use `volumeBindingMode: WaitForFirstConsumer` so the volume is created in the zone the pod is actually scheduled into rather than being bound in advance, spread the StatefulSet across zones with topology constraints, and for anything that must survive a zone loss use replicated storage or application-level replication rather than relying on a single zonal disk.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Pending pod with an unattached volume',
        caption: 'The event message distinguishes these. They are not the same problem.',
        question: 'What does describe pod report?',
        branches: [
          {
            condition: 'volume node affinity conflict',
            result: 'Zone mismatch',
            detail: 'no healthy node in the volume’s zone - add one or restore elsewhere',
            tone: 'danger',
          },
          {
            condition: 'Multi-Attach error for volume',
            result: 'Stale attachment',
            detail: 'old node still holds it - wait for force-detach or clear it',
            tone: 'warning',
          },
          {
            condition: 'No events, pod simply absent',
            result: 'StatefulSet safety hold',
            detail: 'node NotReady but not confirmed dead - do not force-delete blindly',
            tone: 'warning',
          },
          {
            condition: 'PVC itself is Pending',
            result: 'Provisioning failed',
            detail: 'check the StorageClass, CSI driver and cloud quota',
            tone: 'accent',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Separate the three causes',
        language: 'bash',
        explanation: 'Read the events first, then the PV topology, then the attachment state.',
        code: `# 1. What is it actually waiting for?
kubectl describe pod postgres-0 | tail -20
#   "volume node affinity conflict"  -> zone problem
#   "Multi-Attach error"             -> stale attachment

# 2. Which zone is the volume pinned to?
PV=$(kubectl get pvc data-postgres-0 -o jsonpath='{.spec.volumeName}')
kubectl get pv "$PV" -o jsonpath='{.spec.nodeAffinity}' | jq

# 3. Is there a healthy node in that zone at all?
kubectl get nodes -L topology.kubernetes.io/zone

# 4. Is the volume still attached to the dead node?
kubectl get volumeattachments | grep "$PV"

# 5. Is the node truly gone, or just unreachable? This decides
#    whether force-deleting is safe.
kubectl get node <old-node> -o jsonpath='{.status.conditions}' | jq
aws ec2 describe-instances --instance-ids <id> \\
  --query 'Reservations[].Instances[].State.Name'

# ONLY after confirming the node is genuinely terminated:
kubectl delete pod postgres-0 --force --grace-period=0`,
      },
      {
        title: 'The configuration that prevents it',
        language: 'yaml',
        explanation:
          'WaitForFirstConsumer is the single most valuable setting here - it binds the volume where the pod lands.',
        code: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3-delayed
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
# Do NOT create the volume until a pod is scheduled, so the volume
# is made in the zone the scheduler chose - not the other way round.
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Retain          # do not delete data when the PVC goes

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 3
  template:
    spec:
      # Spread replicas across zones so one zone loss is survivable
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels: { app: postgres }
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        storageClassName: gp3-delayed
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 100Gi`,
      },
    ],
    deeper: [
      'The StatefulSet at-most-one guarantee is the reason the replacement pod is not created automatically. Force-deleting on a partitioned-but-alive node can produce two writers on one volume, which is how data corruption happens - so confirm the instance is terminated, not merely unreachable.',
      '`WaitForFirstConsumer` versus `Immediate` is the single most consequential StorageClass setting in a multi-zone cluster. `Immediate` binds a volume before the scheduler has chosen a node, which is how pods end up permanently unschedulable.',
      'Zonal storage means a zone outage is a data-availability outage for that replica, whatever Kubernetes does. Surviving it needs replication at the application layer - a database replica in another zone - or a genuinely regional volume type.',
    ],
    traps: [
      'Force-deleting the pod before confirming the node is really dead. That is the corruption path.',
      'Assuming a PVC can move zones. A zonal disk cannot; only a snapshot restore can.',
      'Using `volumeBindingMode: Immediate` in a multi-zone cluster and then wondering why pods will not schedule.',
    ],
    followUps: [
      'Why does a StatefulSet not just recreate the pod?',
      'What does WaitForFirstConsumer change?',
      'How would you survive losing an entire zone?',
    ],
    tags: ['kubernetes', 'storage', 'statefulset', 'troubleshooting'],
  },
  {
    id: 'itv-k8s-55',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'CPU is pinned at 95% but the Horizontal Pod Autoscaler is not adding replicas. Why might that be?',
    probing:
      'HPA mechanics. There are several distinct causes and a good answer enumerates rather than guesses.',
    answer: [
      'I would start with `kubectl describe hpa`, because the HPA records its own reasoning in its conditions and usually states the answer outright.',
      'The most common cause by a distance: **the pods have no CPU `requests` set**. HPA targets a percentage *of the request*, so with no request there is no denominator, the metric is `<unknown>`, and the HPA does nothing. The `AbleToScale` condition says so explicitly.',
      'Second: **metrics-server is not running or not reporting**. `kubectl top pods` failing is the quick test. Without a metrics pipeline the HPA has no input.',
      'Third: **it is already at `maxReplicas`**. Obvious once seen and easy to overlook.',
      'Fourth: **the 95% you are looking at is not the number the HPA sees.** The HPA averages CPU across all ready pods relative to their requests. One pod at 95% among ten averages to well under the target. And pods that are not Ready, or still within their scale-up window, are excluded from the calculation.',
      'Fifth: **the stabilisation window**. By default scale-down waits 300 seconds, and scale-up decisions are also smoothed. Watching for two minutes and concluding it is broken is a real mistake.',
      'And a case worth flagging because it is invisible in the HPA: **CPU throttling**. If the container has a CPU *limit* it can be throttled at the limit while its measured usage sits below the request-relative target, so the application is slow, the HPA is satisfied, and both are behaving correctly. `container_cpu_cfs_throttled_seconds_total` is what reveals it.',
      'Finally the design question: CPU is often the wrong signal. For a queue consumer, scale on queue depth; for a web service, requests per second or concurrency usually tracks user experience far better. Those need custom or external metrics via KEDA or the Prometheus adapter, and that is the more senior answer.',
    ],
    code: [
      {
        title: 'The HPA tells you why it is not scaling',
        language: 'bash',
        explanation: 'Read the conditions before assuming anything.',
        code: `# The conditions field usually contains the entire answer
kubectl describe hpa checkout
#   AbleToScale     False   "no recommendation: missing request for cpu"
#   ScalingActive   False   "failed to get cpu utilization"
#   ScalingLimited  True    "at max replica count"

# Is there a metrics pipeline at all?
kubectl top pods -l app=checkout
kubectl get apiservice v1beta1.metrics.k8s.io

# Are CPU requests actually set? No request, no HPA.
kubectl get deploy checkout -o jsonpath=\\
'{.spec.template.spec.containers[*].resources.requests}'

# What does the HPA currently compute?
kubectl get hpa checkout -o jsonpath='{.status}' | jq

# Throttled at the limit while "usage" looks fine?
# sum by (pod) (rate(container_cpu_cfs_throttled_seconds_total{pod=~"checkout-.*"}[5m]))`,
      },
      {
        title: 'Scaling on something users actually feel',
        language: 'yaml',
        explanation:
          'Behaviour policies stop flapping; a queue-depth metric beats CPU for a consumer.',
        code: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70      # 70% OF THE REQUEST, not of the node
    # Usually the better signal: work waiting, not CPU burnt
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: '100'
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30    # react quickly to load
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30             # at most double every 30s
    scaleDown:
      stabilizationWindowSeconds: 300   # retreat slowly - avoids flapping
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60`,
      },
    ],
    deeper: [
      'HPA utilisation is relative to the **request**, never to the node or the limit. A pod requesting 100m and using 200m is at 200% utilisation even though it is using a fifth of a core - which is why badly set requests make the HPA behave bizarrely.',
      'HPA and VPA both adjusting CPU on the same workload fight each other. If you need both, VPA should be in recommendation mode only, or scoped to memory while HPA owns CPU.',
      'Scaling on CPU cannot help a workload that is blocked on I/O. A service waiting on a slow database shows low CPU under heavy load, so the HPA will never act - and adding replicas would worsen the database problem anyway.',
    ],
    traps: [
      'Forgetting that no CPU request means no HPA. This is the single most common cause.',
      'Comparing the node’s CPU graph with the HPA target. They are different denominators.',
      'Concluding it is broken after two minutes, before the stabilisation window has elapsed.',
    ],
    followUps: [
      'What is the HPA utilisation percentage a percentage of?',
      'How would you scale a queue consumer?',
      'Why might CPU be the wrong metric entirely?',
    ],
    tags: ['kubernetes', 'hpa', 'autoscaling', 'troubleshooting'],
  },
  {
    id: 'itv-k8s-56',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Applications across the cluster are seeing intermittent DNS resolution failures and slow lookups. How do you investigate?',
    probing:
      'Cluster DNS is a classic hard problem with several well-known causes. They want the specific ones.',
    answer: [
      'Cluster-wide intermittent DNS is one of the best-known Kubernetes failure modes, and there are four well-documented causes I would work through.',
      '**The `ndots:5` search-path amplification.** Kubernetes sets `ndots: 5` in every pod’s `/etc/resolv.conf`. Any name with fewer than five dots - which is every external name like `api.stripe.com` - is first tried against each cluster search domain in turn. So one external lookup becomes five or six queries, four or five of which are guaranteed NXDOMAIN. At scale that is an enormous multiplier on CoreDNS load, and it makes external lookups slow even when everything is healthy. Appending a trailing dot to fully-qualified external names, or setting a lower `ndots` in `dnsConfig`, removes it.',
      '**CoreDNS under-provisioned.** The default deployment is two replicas regardless of cluster size. Check CPU throttling and request latency on the CoreDNS pods; also check whether both replicas landed on the same node, which turns one node failure into a cluster-wide DNS outage.',
      '**The conntrack race.** This is the classic intermittent case: a kernel race in UDP DNAT means occasional lookups are dropped and only return after the 5-second resolver timeout. The tell-tale symptom is exactly 5-second latencies, not slow ones. Node-local DNS cache is the standard fix - it puts a caching resolver on every node and uses TCP upstream, avoiding the race entirely - and it reduces CoreDNS load substantially as a side effect.',
      '**Scaling and caching effects.** A pod churn spike invalidates caches; a NetworkPolicy that does not allow egress to `kube-dns` breaks resolution for that namespace only; and `hostNetwork` pods bypass cluster DNS unless `dnsPolicy: ClusterFirstWithHostNet` is set.',
      'For evidence I would enable the CoreDNS log plugin briefly, look at its Prometheus metrics for request rate and duration by response code - a high NXDOMAIN proportion is the direct fingerprint of the ndots problem - and time lookups from inside an affected pod to see whether the latency is a clean 5 seconds.',
      'My standing recommendations for any cluster at scale are: deploy NodeLocal DNSCache, scale CoreDNS with the cluster rather than leaving it at two, add anti-affinity so replicas spread across nodes, and fix `ndots` for workloads that mostly call external services.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Why one external lookup becomes six queries',
        caption: 'ndots 5 means anything with fewer than five dots is treated as possibly local.',
        nodes: [
          {
            label: 'App resolves api.stripe.com',
            detail: 'three dots, so fewer than ndots 5',
            tone: 'accent',
          },
          {
            label: 'Try api.stripe.com.prod.svc.cluster.local',
            detail: 'NXDOMAIN',
            arrowLabel: 'search 1',
            tone: 'warning',
          },
          {
            label: 'Try api.stripe.com.svc.cluster.local',
            detail: 'NXDOMAIN',
            arrowLabel: 'search 2',
            tone: 'warning',
          },
          {
            label: 'Try api.stripe.com.cluster.local',
            detail: 'NXDOMAIN',
            arrowLabel: 'search 3',
            tone: 'warning',
          },
          {
            label: 'Finally try api.stripe.com',
            detail: 'succeeds - after four wasted round trips',
            arrowLabel: 'search 4',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Measure it from inside a pod',
        language: 'bash',
        explanation:
          'A clean 5-second timeout points at the conntrack race; a high NXDOMAIN rate points at ndots.',
        code: `# What search path is in force?
kubectl exec -it checkout-7d9f -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search prod.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5            <- the amplifier

# Time an external lookup. Repeat - look for occasional 5s results.
kubectl exec -it checkout-7d9f -- sh -c \\
  'for i in $(seq 1 20); do time nslookup api.stripe.com >/dev/null; done'

# CoreDNS health
kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide   # same node?
kubectl -n kube-system top pods -l k8s-app=kube-dns

# The fingerprint of ndots amplification: lots of NXDOMAIN
# sum by (rcode) (rate(coredns_dns_responses_total[5m]))
# And latency:
# histogram_quantile(0.99, sum by (le) (rate(coredns_dns_request_duration_seconds_bucket[5m])))

# conntrack insertion failures - the race, visible on the node
kubectl debug node/worker-3 -it --image=busybox -- \\
  cat /host/proc/net/stat/nf_conntrack | head`,
      },
      {
        title: 'The two fixes worth applying',
        language: 'yaml',
        explanation:
          'Lower ndots for external-heavy workloads; spread CoreDNS so one node cannot take out DNS.',
        code: `# Per-workload: stop the search-path amplification
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
spec:
  template:
    spec:
      dnsPolicy: ClusterFirst
      dnsConfig:
        options:
          # This service mostly calls external APIs. Two dots is enough
          # for cluster names it does use (svc.namespace).
          - name: ndots
            value: '2'
          - name: timeout
            value: '2'
          - name: attempts
            value: '3'

---
# Cluster-wide: never let both CoreDNS replicas share a node
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
spec:
  replicas: 4
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels: { k8s-app: kube-dns }

# And deploy NodeLocal DNSCache: a caching resolver per node,
# TCP upstream to CoreDNS, which avoids the conntrack race entirely.`,
      },
    ],
    deeper: [
      'The 5-second signature is diagnostic. DNS resolvers retry after 5 seconds by default, so a lookup that takes exactly 5 seconds was dropped, not slow. Any other duration is a different problem.',
      'Using fully-qualified names with a trailing dot - `api.stripe.com.` - bypasses the search path entirely with no cluster configuration change. It is an easy application-side win.',
      'NodeLocal DNSCache is the single highest-value DNS change on a large cluster: it removes the conntrack race, cuts CoreDNS load dramatically, and survives brief CoreDNS unavailability from its cache.',
    ],
    traps: [
      'Restarting CoreDNS and calling it fixed. Intermittent problems return.',
      'Missing that both CoreDNS replicas are on one node, which makes DNS a single point of failure.',
      'Overlooking a NetworkPolicy that blocks egress to kube-dns - the symptom is namespace-scoped, not cluster-wide.',
    ],
    followUps: [
      'What exactly does ndots 5 do?',
      'Why does the conntrack race produce exactly 5-second delays?',
      'What does NodeLocal DNSCache change?',
    ],
    tags: ['kubernetes', 'dns', 'coredns', 'troubleshooting', 'networking'],
  },
  {
    id: 'itv-k8s-57',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'You run kubectl apply, it reports "configured", but the change has no effect on the running pods. What is happening?',
    probing:
      'A confusing symptom with several distinct explanations. It tests precision about what apply actually does.',
    answer: [
      'The first thing to establish is whether the change reached the API server at all, and `kubectl get -o yaml` on the object answers that immediately. From there there are four families of cause.',
      '**You changed something that does not restart pods.** A ConfigMap or Secret consumed as environment variables is read once at container start; updating it changes nothing until the pods are recreated. Mounted as a volume it does update in place, but only after the kubelet sync period - up to a minute or so - and only if the application re-reads the file. This is by far the most common version of this question.',
      '**You changed a field the controller does not act on.** Deployments only roll pods when the **pod template** changes. Editing `spec.replicas`, labels on the Deployment itself, or annotations outside the template will not trigger a rollout.',
      '**Something is overwriting you.** A GitOps controller such as Argo CD or Flux reconciles continuously: your manual apply is accepted, then reverted seconds later. The object’s `managedFields` and the controller’s own status show this clearly. A mutating admission webhook can also silently rewrite the field you set.',
      '**You are not looking where you think you are.** Wrong context, wrong namespace, or a second Deployment with a similar name. Embarrassing, common, and worth ruling out in ten seconds.',
      'There is also the case where the object updated but the field is **immutable** - a Job’s selector, a StatefulSet’s `volumeClaimTemplates`, a Service’s `clusterIP`. Apply usually errors here rather than silently ignoring, but with `--server-side` and certain field managers the behaviour can be confusing.',
      'The standard fix for the ConfigMap case is to make configuration changes **cause** a rollout, either by hashing the config into a pod-template annotation - what Helm’s checksum annotation pattern does - or by using immutable, versioned ConfigMap names so a config change is by definition a template change.',
    ],
    code: [
      {
        title: 'Establish what actually changed',
        language: 'bash',
        explanation: 'Server state first, then who owns the field, then whether pods rolled.',
        code: `# Am I even in the right place?
kubectl config current-context
kubectl config view --minify -o jsonpath='{..namespace}'

# Did the server accept the change?
kubectl get deploy checkout -o yaml | grep -A5 'image:'
kubectl diff -f deployment.yaml          # what apply WOULD change

# Who owns this field? Reveals a GitOps controller or a webhook.
kubectl get deploy checkout -o jsonpath='{.metadata.managedFields}' | jq \\
  '.[] | {manager, operation, time}'

# Did the pod template change - i.e. would it roll at all?
kubectl rollout history deploy/checkout
kubectl get rs -l app=checkout --sort-by=.metadata.creationTimestamp

# Is a mutating webhook rewriting it?
kubectl get mutatingwebhookconfigurations

# ConfigMap consumed as env? Then only a restart applies it.
kubectl rollout restart deploy/checkout`,
      },
      {
        title: 'Make a config change roll the pods',
        language: 'yaml',
        explanation:
          'Hashing the config into the pod template means changing config IS changing the template.',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
spec:
  template:
    metadata:
      annotations:
        # Helm: any change to the ConfigMap changes this hash, which
        # changes the pod template, which triggers a rolling update.
        checksum/config: '{{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}'
    spec:
      containers:
        - name: checkout
          envFrom:
            - configMapRef:
                name: checkout-config    # env vars: read ONCE at start

---
# The alternative: immutable, versioned ConfigMaps.
# Immutable also reduces API server watch load noticeably at scale.
apiVersion: v1
kind: ConfigMap
metadata:
  name: checkout-config-v7      # the name changes with the content
immutable: true
data:
  LOG_LEVEL: info`,
      },
    ],
    deeper: [
      'Volume-mounted ConfigMaps do update in place, but with a delay of up to the kubelet sync period plus the cache TTL, and `subPath` mounts do **not** update at all. That last detail catches people out regularly.',
      '`kubectl diff` before apply is an underused habit - it shows exactly what the server would change, which answers this question before it becomes a mystery.',
      'With GitOps, a manual apply to a managed namespace is always temporary. The right move is to change Git; if you must intervene live, suspend the sync explicitly so the override is visible to everyone else.',
    ],
    traps: [
      'Expecting an environment-variable ConfigMap change to reach running pods. It cannot.',
      'Forgetting that `subPath` volume mounts never receive ConfigMap updates.',
      'Fighting a GitOps controller with repeated manual applies instead of changing the repository.',
    ],
    followUps: [
      'Which ConfigMap consumption methods update live and which do not?',
      'How does Helm force a rollout when config changes?',
      'What would managedFields tell you here?',
    ],
    tags: ['kubernetes', 'troubleshooting', 'configmap', 'gitops'],
  },
  {
    id: 'itv-k8s-58',
    level: 'advanced',
    kind: 'scenario',
    prompt: 'A cluster upgrade is scheduled. How do you prepare, and what typically breaks?',
    probing:
      'Change management on a production cluster. The expected answer leads with deprecated APIs.',
    answer: [
      'The thing that breaks most often is **removed APIs**. Kubernetes deprecates an API version for several releases and then removes it, and manifests or Helm charts still referencing the old version fail to apply after the upgrade. The insidious part is that already-created objects keep working - so nothing breaks until the next deploy, often weeks later, when somebody is not expecting it.',
      'So preparation starts there: scan every manifest, chart and operator for deprecated versions with `kubectl deprecations`, Pluto or kubent, and check the release notes for the target version. This is also why skipping minor versions is not supported - you must upgrade one minor at a time.',
      'Second, **component version skew**. The kubelet may be up to three minor versions behind the API server but never ahead, so the control plane is upgraded first, then nodes. Cloud controllers, CSI drivers, CNI plugins and anything speaking to the API - ingress controllers, cert-manager, metrics-server, operators - each have their own compatibility matrix and frequently need upgrading in step.',
      'Third, **the node strategy**. I strongly prefer replacing nodes over upgrading in place: bring up a new node group on the new version, cordon and drain the old ones gradually, and delete them once empty. Rollback is then just keeping the old group. In-place upgrades have no such escape hatch.',
      'For the drain itself the prerequisites are real: **PodDisruptionBudgets** on every important workload so drains cannot take all replicas at once, and no PDB so strict that it blocks the drain forever - `minAvailable` equal to `replicas` is a classic self-inflicted deadlock. Anything running as a single replica will have downtime, and that should be known in advance rather than discovered.',
      'The sequence I would run: upgrade a non-production cluster of the same shape first; take an etcd backup or confirm the managed-service snapshot; upgrade the control plane; verify the API and core add-ons; then roll nodes in small batches, watching workload health between batches rather than at the end.',
      'What I would watch during it: pods failing to reschedule, PDB violations blocking drains, probes failing on the new kubelet version, and CSI volumes failing to reattach on new nodes - which is the one that turns an upgrade into an incident.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Upgrade order, and why it is that order',
        caption: 'The kubelet may lag the API server, never lead it. That fixes the sequence.',
        nodes: [
          {
            label: 'Scan for removed APIs',
            detail: 'Pluto or kubent across manifests, charts and operators',
            tone: 'accent',
          },
          {
            label: 'Upgrade a staging cluster first',
            detail: 'same version, same add-ons, same shape',
            arrowLabel: 'rehearse',
          },
          {
            label: 'Back up etcd',
            detail: 'or confirm the managed control-plane snapshot exists',
            arrowLabel: 'safety net',
            tone: 'warning',
          },
          {
            label: 'Control plane',
            detail: 'API server, scheduler, controller-manager',
            arrowLabel: 'first',
            tone: 'success',
          },
          {
            label: 'Add-ons',
            detail: 'CNI, CSI, ingress, cert-manager, metrics-server, operators',
            arrowLabel: 'next',
          },
          {
            label: 'Nodes, in batches',
            detail: 'new node group, cordon and drain the old, verify between batches',
            arrowLabel: 'last',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Find what the upgrade will break, before it does',
        language: 'bash',
        explanation: 'Deprecated APIs are the number one cause of a post-upgrade surprise.',
        code: `# Scan live cluster objects and Helm releases for removed APIs
pluto detect-helm --target-versions k8s=v1.32.0
pluto detect-all-in-cluster --target-versions k8s=v1.32.0
kubent                                    # same job, different tool

# What is the current skew?
kubectl version
kubectl get nodes -o wide                 # KUBELET VERSION column

# Which workloads have no PDB, and which have an impossible one?
kubectl get pdb -A
kubectl get deploy -A -o json | jq -r \\
  '.items[] | select(.spec.replicas == 1) | "\\(.metadata.namespace)/\\(.metadata.name)"'
#   ^ single replicas WILL have downtime during a drain

# Rehearse the drain without doing it
kubectl drain worker-3 --ignore-daemonsets --delete-emptydir-data --dry-run=server`,
      },
      {
        title: 'A PDB that protects without deadlocking',
        language: 'yaml',
        explanation:
          'minAvailable equal to replicas blocks every drain forever. Leave room for one.',
        code: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: checkout
spec:
  # With replicas: 5 this allows exactly one pod to be evicted at a time.
  # Setting minAvailable: 5 here would block every drain, permanently.
  minAvailable: 4
  selector:
    matchLabels:
      app: checkout

---
# Percentage form scales with the Deployment and avoids the same trap
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api
spec:
  maxUnavailable: 25%
  selector:
    matchLabels:
      app: api`,
      },
    ],
    deeper: [
      'Objects created under a removed API keep working after the upgrade - the storage version is converted server-side. The failure surfaces at the next `apply`, which decouples the breakage from the upgrade and makes it much harder to attribute.',
      'Managed control planes upgrade the control plane for you but leave node groups to you, and the version skew policy still applies. "EKS upgraded it" is not the same as "the cluster is upgraded".',
      'Replacing node groups rather than upgrading in place gives you a real rollback: keep the old group cordoned but present until you are confident, then delete it.',
    ],
    traps: [
      'Skipping minor versions. Only one minor at a time is supported.',
      'Upgrading nodes ahead of the control plane, which violates the skew policy.',
      'A PDB with `minAvailable` equal to `replicas`, which blocks every drain and stalls the whole upgrade.',
    ],
    followUps: [
      'What is the version skew policy between kubelet and API server?',
      'Why do old API versions keep working until the next apply?',
      'How would you roll back a node group upgrade?',
    ],
    tags: ['kubernetes', 'upgrade', 'operations', 'scenario'],
  },
  {
    id: 'itv-k8s-59',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'A namespace has been stuck in Terminating for an hour. What is blocking it and how do you resolve it safely?',
    probing:
      'A specific, well-known failure with a dangerous shortcut. The interesting part is why the shortcut is dangerous.',
    answer: [
      'A namespace stays Terminating because **something inside it will not finish deleting**, and the namespace controller waits for every resource in it to go. There are two distinct blockers and they need different treatment.',
      '**A finalizer on a resource inside the namespace.** A finalizer is a deliberate hook: the object cannot be removed until the controller that owns the finalizer does its cleanup and removes the entry. If that controller has been uninstalled or is broken, nothing will ever clear it and the object - and therefore the namespace - hangs. Persistent volumes, custom resources and service-mesh objects are common culprits.',
      '**An unavailable aggregated API service.** The namespace controller must enumerate every API resource to confirm the namespace is empty. If an APIService - a metrics adapter, a webhook-backed custom API - is registered but its backing pod is gone, that enumeration fails and the namespace waits forever. This one is easy to miss because the blocked resource is not visible inside the namespace at all.',
      'To diagnose, the namespace status itself names the reason: `DiscoveryFailed` points at a broken APIService, while a list of remaining resource types points at finalizers. Then I would list every resource in the namespace, including custom ones, and read their `metadata.finalizers`.',
      'The right fix depends on which it is. A broken APIService should be deleted or its backing service restored. A stale finalizer should be removed from the specific object once you have confirmed the owning controller really is gone.',
      'The dangerous shortcut is patching the **namespace’s own** finalizer - `kubectl patch namespace ... --type=merge -p \'{"spec":{"finalizers":[]}}\'` or editing it via the finalize subresource. It works instantly, and it forcibly removes the namespace while leaving its contents orphaned: cloud load balancers still running and being billed, disks never detached, DNS records never cleaned up, and objects in etcd with no namespace. I would treat it as a genuine last resort, do it only after identifying what was blocking, and manually clean up whatever was orphaned.',
    ],
    code: [
      {
        title: 'Find the blocker before forcing anything',
        language: 'bash',
        explanation:
          'The status conditions distinguish a finalizer problem from a discovery problem.',
        code: `# The namespace states why it is waiting
kubectl get namespace stuck-ns -o json | jq '.status'
#   "DiscoveryFailed"        -> a broken APIService
#   "SomeResourcesRemain"    -> something inside will not delete

# Broken aggregated API? This is the commonly missed cause.
kubectl get apiservices | grep -v 'True'

# What is actually left in the namespace, including custom resources?
kubectl api-resources --verbs=list --namespaced -o name \\
  | xargs -n1 kubectl get --show-kind --ignore-not-found -n stuck-ns

# Which object holds a finalizer?
kubectl get <kind> <name> -n stuck-ns -o jsonpath='{.metadata.finalizers}'

# Targeted fix: clear the finalizer on THAT object, having confirmed
# its controller is genuinely gone.
kubectl patch <kind> <name> -n stuck-ns --type=merge \\
  -p '{"metadata":{"finalizers":[]}}'`,
      },
      {
        title: 'The last resort, and what it leaves behind',
        language: 'bash',
        explanation: 'This always works and always orphans. Know what you are about to strand.',
        code: `# LAST RESORT. Removes the namespace, orphans its contents.
# Before running this, write down what is in the namespace - anything
# with an external side effect will be left running and billed.

kubectl get svc -n stuck-ns -o wide      # cloud load balancers?
kubectl get pvc -n stuck-ns              # disks that will never detach?

kubectl get namespace stuck-ns -o json \\
  | jq '.spec.finalizers = []' \\
  | kubectl replace --raw "/api/v1/namespaces/stuck-ns/finalize" -f -

# Then clean up manually, in the cloud console or CLI:
#   - delete orphaned load balancers and their security groups
#   - delete orphaned EBS/PD volumes
#   - remove stale external-dns records`,
      },
    ],
    deeper: [
      'Finalizers exist to prevent exactly the orphaning that force-deleting causes. A PVC finalizer stops the volume being deleted while a pod still uses it; a Service finalizer ensures the cloud load balancer is torn down first.',
      'The `DiscoveryFailed` case is worth internalising because the blocker is not in the namespace at all - a leftover metrics-server or a removed webhook API can hold every namespace deletion in the cluster.',
      'If this recurs, the underlying problem is usually an operator uninstalled without removing its custom resources first. Uninstall order matters: delete the CRs, then the operator, then the CRDs.',
    ],
    traps: [
      'Patching the namespace finalizer as the first move. It hides the cause and orphans cloud resources that keep costing money.',
      'Missing a broken APIService, which is invisible from inside the namespace.',
      'Deleting a CRD before its custom resources, which strands objects whose controller no longer exists.',
    ],
    followUps: [
      'What is a finalizer actually for?',
      'What gets orphaned if you force it?',
      'Why can a broken APIService block an unrelated namespace?',
    ],
    tags: ['kubernetes', 'troubleshooting', 'finalizers', 'namespaces'],
  },
  {
    id: 'itv-k8s-60',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Half your pods are crowded onto two nodes while six other nodes sit nearly empty. Why, and how would you fix it?',
    probing:
      'Scheduling behaviour. The key insight is that the scheduler never moves a running pod.',
    answer: [
      'The single most important fact is that **the Kubernetes scheduler places a pod once and never revisits that decision**. There is no rebalancing loop. So an imbalance is either a placement decision that was correct at the time and is now stale, or a constraint that is actively concentrating pods.',
      'The usual causes of a **stale** imbalance: nodes were added after the pods were scheduled, so the pods landed on what existed at the time; or a node was drained and everything it held was rescheduled onto whichever nodes had room, and nothing ever moved back.',
      'The usual causes of an **active** imbalance: requests are set far too low, so the scheduler believes many pods fit comfortably on one node - the `LeastAllocated` scoring is based on requests, not actual usage, so wildly under-set requests produce exactly this; a node affinity or node selector that only a couple of nodes satisfy; or pod affinity drawing pods together deliberately.',
      'And the case that surprises people: **no anti-affinity or topology spread at all**. Without a constraint telling it otherwise, the scheduler has no reason to spread replicas, so a Deployment scaled up quickly can put several replicas on the same node. That is fine until that node fails and takes most of the service with it.',
      'To diagnose I would compare requested versus allocatable per node with `kubectl describe node`, check whether requests reflect reality by comparing against actual usage, and look for selectors or affinities on the concentrated workloads.',
      'The fixes: set **topology spread constraints** so replicas are distributed across nodes and zones by default - this is the modern replacement for pod anti-affinity and is what I would reach for first; correct the requests so the scheduler’s model matches reality; and for the stale case, run **Descheduler**, which is the component that actually evicts pods to rebalance, since the scheduler will not.',
      'One caution on Descheduler: it evicts pods, so it needs PodDisruptionBudgets in place and should be run on a schedule with conservative policies. Rebalancing is not free - it is a controlled disruption.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why are the pods bunched up?',
        caption: 'Stale placement and active constraint need different fixes.',
        question: 'What does the cluster look like?',
        branches: [
          {
            condition: 'Nodes added after the pods were scheduled',
            result: 'Stale placement',
            detail: 'the scheduler never revisits - run Descheduler or restart the workload',
            tone: 'accent',
          },
          {
            condition: 'Requests far below real usage',
            result: 'Scheduler model is wrong',
            detail: 'it thinks many pods fit - correct the requests',
            tone: 'warning',
          },
          {
            condition: 'nodeSelector or affinity matches few nodes',
            result: 'Constraint is concentrating them',
            detail: 'widen the selector or label more nodes',
            tone: 'warning',
          },
          {
            condition: 'No spread constraint on the workload',
            result: 'Nothing is asking it to spread',
            detail: 'add topologySpreadConstraints - a node loss is otherwise an outage',
            tone: 'danger',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Compare what is requested with what is used',
        language: 'bash',
        explanation:
          'The scheduler packs on requests. If requests do not match usage, it will pack badly.',
        code: `# Requested vs allocatable, per node
kubectl describe nodes | grep -A6 'Allocated resources'

# How many pods per node, sorted
kubectl get pods -A -o wide --no-headers \\
  | awk '{print $8}' | sort | uniq -c | sort -rn

# Where are one workload's replicas actually sitting?
kubectl get pods -l app=checkout -o wide

# Requests vs real usage - a big gap explains bad packing
kubectl top pods -l app=checkout
kubectl get pods -l app=checkout -o jsonpath=\\
'{range .items[*]}{.metadata.name}{"\\t"}{.spec.containers[*].resources.requests}{"\\n"}{end}'

# Is a selector restricting the candidate nodes?
kubectl get deploy checkout -o jsonpath='{.spec.template.spec.nodeSelector}{.spec.template.spec.affinity}'`,
      },
      {
        title: 'Spread by default',
        language: 'yaml',
        explanation: 'Two constraints: never more than one replica skew per zone, and per node.',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
spec:
  replicas: 9
  template:
    spec:
      topologySpreadConstraints:
        # Spread across zones first - survives a zone loss
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels: { app: checkout }

        # Then across nodes within a zone - survives a node loss.
        # ScheduleAnyway so a full cluster does not block scheduling.
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels: { app: checkout }

      containers:
        - name: checkout
          resources:
            requests:
              cpu: 250m        # must reflect REAL usage, or packing
              memory: 512Mi    # decisions will be wrong`,
      },
    ],
    deeper: [
      '`whenUnsatisfiable: DoNotSchedule` makes the constraint hard - pods stay Pending rather than violating it. `ScheduleAnyway` makes it a preference. Use the hard form for zones, the soft form for nodes, or a cluster under pressure will refuse to schedule at all.',
      'Topology spread constraints have largely superseded pod anti-affinity: they express the same intent with a skew tolerance instead of a binary rule, and they are considerably cheaper for the scheduler to evaluate at scale.',
      'The cluster autoscaler compounds bad requests. It provisions nodes based on requested resources, so under-set requests mean it adds too few nodes while real usage saturates the ones you have.',
    ],
    traps: [
      'Expecting Kubernetes to rebalance on its own. It never does - that is Descheduler’s job.',
      'Running Descheduler without PodDisruptionBudgets, which turns rebalancing into an outage.',
      'Making both spread constraints `DoNotSchedule` on a busy cluster, which leaves pods permanently Pending.',
    ],
    followUps: [
      'Why does the scheduler not rebalance?',
      'When would you use anti-affinity over topology spread?',
      'How do bad requests affect the cluster autoscaler?',
    ],
    tags: ['kubernetes', 'scheduling', 'topology', 'troubleshooting'],
  },
  {
    id: 'itv-k8s-61',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Someone reports that a production Deployment was scaled to zero overnight. How do you find out who or what did it?',
    probing:
      'Audit and forensics. It also tests whether you know the several non-human things that scale a Deployment.',
    answer: [
      'I would restore service first - scale it back up - and investigate in parallel, because the evidence is not going anywhere but the outage is.',
      'For the investigation, the primary source is the **API server audit log**. Every write carries the authenticated user or service account, the source IP, the verb, the object and a timestamp. Filtering for update or patch requests against that Deployment gives a definitive answer. On a managed cluster this means CloudWatch, Cloud Logging or the equivalent; audit logging must have been enabled beforehand, which is the point worth making.',
      'Before assuming a human, I would consider the non-human causes, because they are more likely.',
      'A **HorizontalPodAutoscaler** can scale down, though not to zero unless it is KEDA, which explicitly supports scale-to-zero when its trigger source is idle - an empty queue overnight would do exactly this and is a very plausible explanation for "overnight".',
      'A **GitOps controller** reconciling a change in Git: someone merged a `replicas: 0`, or a Helm values change, and Argo CD or Flux applied it faithfully. The controller’s own history shows the sync and the commit.',
      'A **cost-saving or scheduling tool** - kube-downscaler and similar - deliberately scales non-production workloads down out of hours. If one was installed and its namespace selector was too broad, this is precisely what it would do.',
      'Failing all that, the Deployment’s own metadata helps: `kubectl rollout history`, the `deployment.kubernetes.io/revision` annotation, and `managedFields`, which records which field manager last wrote `spec.replicas` - that alone often names the culprit without any audit log.',
      'The follow-up I would push for is prevention: audit logging enabled and retained, RBAC tightened so few identities can write to production Deployments, an alert on replicas dropping to zero for anything user-facing, and if a downscaler is installed, an explicit opt-in label rather than an opt-out.',
    ],
    code: [
      {
        title: 'Who wrote the replicas field?',
        language: 'bash',
        explanation: 'managedFields often answers it instantly, with no audit log needed.',
        code: `# Restore first
kubectl scale deploy/checkout --replicas=6

# Which field manager last wrote spec.replicas?
kubectl get deploy checkout -o json \\
  | jq '.metadata.managedFields[] | {manager, operation, time, fields: .fieldsV1.\\"f:spec\\"}'
#   manager "argocd-controller" -> GitOps
#   manager "kubectl-scale"     -> a human ran kubectl scale
#   manager "kube-controller-manager" -> an HPA

# Revision history and annotations
kubectl rollout history deploy/checkout
kubectl get deploy checkout -o jsonpath='{.metadata.annotations}' | jq

# Is an autoscaler involved?
kubectl get hpa,scaledobject -A | grep checkout

# Events, if within the retention window (default 1 hour - often too short)
kubectl get events -n prod --field-selector involvedObject.name=checkout`,
      },
      {
        title: 'The audit log query that settles it',
        language: 'bash',
        explanation:
          'The audit log is the authoritative record. It has to have been enabled in advance.',
        code: `# EKS: audit logs land in CloudWatch
aws logs filter-log-events \\
  --log-group-name /aws/eks/prod-cluster/cluster \\
  --start-time $(date -d '12 hours ago' +%s000) \\
  --filter-pattern '{ $.objectRef.name = "checkout" && $.verb = "update" }' \\
  | jq -r '.events[].message' \\
  | jq -r '[.requestReceivedTimestamp, .user.username, .verb, .sourceIPs[0]] | @tsv'

# Self-managed: the audit log file on the control plane
sudo grep '"name":"checkout"' /var/log/kubernetes/audit.log \\
  | jq -r 'select(.verb=="update" or .verb=="patch")
           | [.requestReceivedTimestamp, .user.username, .sourceIPs[0]] | @tsv'

# Alert so the next one is noticed immediately
# kube_deployment_spec_replicas{deployment="checkout"} == 0`,
      },
    ],
    deeper: [
      'Kubernetes Events default to a one-hour TTL, so for an overnight incident they are usually gone. Audit logs are the only durable record, and they must be enabled and shipped **before** you need them.',
      '`managedFields` is underused for this. Server-side apply records which manager owns each field, so it frequently identifies the actor without touching an audit log at all.',
      'KEDA scale-to-zero is a genuinely common explanation for an overnight disappearance, and it is working as designed - the bug is usually that a user-facing workload was given a queue-based trigger.',
    ],
    traps: [
      'Assuming a human did it. Autoscalers, GitOps controllers and downscalers are more likely.',
      'Relying on `kubectl get events` for something that happened hours ago.',
      'Fixing it live under GitOps without changing Git - the controller will scale it back to zero.',
    ],
    followUps: [
      'What is in a Kubernetes audit log entry?',
      'How would managedFields help here?',
      'What would you alert on to catch this immediately?',
    ],
    tags: ['kubernetes', 'audit', 'security', 'troubleshooting'],
  },
  {
    id: 'itv-k8s-62',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'Pods are being evicted with "The node was low on resource: ephemeral-storage". What is happening and how do you stop it?',
    probing:
      'Ephemeral storage is the forgotten resource. Most candidates only think about CPU and memory.',
    answer: [
      'Ephemeral storage is the node’s local disk used by pods: container **writable layers**, **emptyDir** volumes, and the container **logs** the runtime writes. When the kubelet sees the filesystem crossing its eviction threshold - `nodefs.available` below 10% by default - it starts evicting pods to reclaim space.',
      'The eviction order matters and explains why the wrong pod often dies: the kubelet ranks **BestEffort** pods first, then **Burstable** pods exceeding their requests, and only then **Guaranteed** pods. So a pod with no resource requests can be evicted because a completely different pod filled the disk. That is the detail worth stating - the victim is frequently not the culprit.',
      'The usual causes, in order of how often I see them: an application **writing to its container filesystem** instead of a volume - temp files, caches, uploaded files; an **emptyDir with no size limit** growing without bound; **container logs** from a service logging in a loop; and accumulated **unused images** on long-lived nodes, which the kubelet garbage-collects but only at its own thresholds.',
      'To find the culprit I would look at per-pod ephemeral usage, which the kubelet exposes through the summary API, and at what is actually consuming the disk on the node.',
      'The fixes are layered. **Set ephemeral-storage requests and limits** on workloads - a pod exceeding its ephemeral-storage limit is evicted individually rather than taking down a neighbour, which converts a node-wide incident into a single pod failure. **Put a `sizeLimit` on every emptyDir.** **Bound container logs** at the kubelet. And architecturally, applications should write to a volume or object storage, not to the container filesystem.',
      'The prevention worth adding is an alert on node filesystem usage with enough headroom to act - 80%, not 95% - because by the time evictions start you are already in an incident.',
    ],
    code: [
      {
        title: 'Find what is filling the disk',
        language: 'bash',
        explanation:
          'The kubelet summary API reports per-pod ephemeral usage, which nothing else does.',
        code: `# Confirm the eviction reason
kubectl get events -A --field-selector reason=Evicted \\
  -o custom-columns=NS:.involvedObject.namespace,POD:.involvedObject.name,MSG:.message

# Which pod is using the ephemeral storage? (kubelet summary API)
kubectl get --raw "/api/v1/nodes/worker-3/proxy/stats/summary" \\
  | jq -r '.pods[] | [.podRef.name, (.ephemeral-storage.usedBytes/1048576|floor)] | @tsv' \\
  | sort -k2 -rn | head

# What is on the node itself?
kubectl debug node/worker-3 -it --image=busybox -- sh -c '
  df -h /host/var
  du -sh /host/var/lib/containerd /host/var/log/pods /host/var/lib/kubelet 2>/dev/null
  du -sh /host/var/log/pods/* | sort -rh | head -5'

# Node conditions show the pressure directly
kubectl describe node worker-3 | grep -A5 Conditions`,
      },
      {
        title: 'Bound it so one pod cannot take the node down',
        language: 'yaml',
        explanation:
          'An ephemeral-storage limit evicts the offender alone, instead of its neighbours.',
        code: `apiVersion: v1
kind: Pod
metadata:
  name: importer
spec:
  containers:
    - name: importer
      image: importer:1.4
      resources:
        requests:
          ephemeral-storage: 1Gi    # counted by the scheduler
        limits:
          ephemeral-storage: 4Gi    # exceed this and THIS pod is evicted,
                                    # not an innocent neighbour
      volumeMounts:
        - name: scratch
          mountPath: /tmp/work
  volumes:
    - name: scratch
      emptyDir:
        sizeLimit: 2Gi              # always set this - unbounded by default

---
# A LimitRange gives the namespace a default, so nobody forgets
apiVersion: v1
kind: LimitRange
metadata:
  name: ephemeral-defaults
  namespace: prod
spec:
  limits:
    - type: Container
      default:
        ephemeral-storage: 2Gi
      defaultRequest:
        ephemeral-storage: 512Mi`,
      },
    ],
    deeper: [
      'Eviction ranks by QoS class, so a BestEffort pod with no requests is evicted first even if a Guaranteed pod filled the disk. Setting requests on everything is what makes eviction behaviour predictable.',
      'An `emptyDir` with `medium: Memory` is a tmpfs and counts against the pod’s **memory** limit, not ephemeral storage - a useful trick for speed, and a surprising OOM if you forget it.',
      'Container logs live on this same filesystem, so the kubelet’s `containerLogMaxSize` and `containerLogMaxFiles` settings are part of the ephemeral-storage budget, not a separate concern.',
    ],
    traps: [
      'Only setting CPU and memory. Ephemeral storage is a first-class resource with its own eviction path.',
      'Leaving `emptyDir` unbounded, which lets one pod consume the whole node disk.',
      'Blaming the evicted pod. It is often a bystander with weak QoS.',
    ],
    followUps: [
      'What counts towards ephemeral storage?',
      'Why was a pod that was not filling the disk the one evicted?',
      'What does emptyDir medium Memory change?',
    ],
    tags: ['kubernetes', 'eviction', 'storage', 'troubleshooting'],
  },
]
