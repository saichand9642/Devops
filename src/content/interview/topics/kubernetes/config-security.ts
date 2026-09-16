import type { InterviewQuestion } from '../../../types'

/** ConfigMaps, Secrets, RBAC, storage, operators and cluster architecture. */
export const k8sConfigSecurityQuestions: InterviewQuestion[] = [
  {
    id: 'itv-k8s-37',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the difference between a ConfigMap and a Secret?',
    probing:
      'Whether you know Secrets are only base64-encoded by default - a very common misconception.',
    answer: [
      'Both hold key-value configuration data and both can be injected as environment variables or mounted as files. The difference is intent and handling: a **ConfigMap** is for non-sensitive configuration, a **Secret** is for credentials, tokens and keys.',
      'The important honesty is that **a Secret is not encrypted by default**. Its values are **base64-encoded**, which is encoding, not encryption - anyone who can read the Secret can decode it in one command. What Secrets add over ConfigMaps is that they can be RBAC-restricted separately, they are not written to the node’s disk in the same way (they are held in tmpfs when mounted), and they are excluded from many logging and description outputs.',
      'To make them genuinely secret you need **encryption at rest** enabled on etcd, **tight RBAC** so only the workloads that need them can read them, and ideally an **external secret store** - Vault, AWS Secrets Manager, or the External Secrets Operator - so the source of truth is outside the cluster and rotation is automatic.',
    ],
    code: [
      {
        title: 'Base64 is not encryption - here is the proof',
        language: 'bash',
        code: `kubectl create secret generic db --from-literal=password='s3cr3t'

kubectl get secret db -o jsonpath='{.data.password}' | base64 -d
# s3cr3t

# Which is exactly why this matters:
kubectl auth can-i get secrets --namespace prod`,
      },
      {
        title: 'Mounting as a file rather than an env var',
        language: 'yaml',
        code: `spec:
  containers:
    - name: api
      volumeMounts:
        - name: db-creds
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: db-creds
      secret:
        secretName: db
        defaultMode: 0400`,
        explanation:
          'A mounted Secret updates when the Secret changes; an env var does not. Env vars also leak into crash dumps and child processes.',
      },
    ],
    traps: [
      'Believing a Secret is encrypted because it looks like gibberish. It is base64.',
      'Committing Secret YAML to git. The base64 is trivially reversible.',
      'Using env vars for secrets, which end up in logs, crash reports and `/proc`.',
    ],
    followUps: [
      'How would you make Secrets genuinely secure?',
      'Why is mounting a Secret usually better than an env var?',
    ],
    tags: ['secrets', 'configmap', 'security', 'fundamentals'],
  },
  {
    id: 'itv-k8s-38',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you update configuration without downtime, and why does a ConfigMap change not restart Pods?',
    probing: 'A real operational gap that surprises people the first time.',
    answer: [
      'Changing a ConfigMap does **not** restart anything. Kubernetes has no mechanism that says "this Pod depends on this ConfigMap, so roll it". The Deployment spec has not changed, so there is nothing to roll.',
      'What happens depends on how the config is consumed. **Environment variables are set once at container start** and never change - the Pod will run with the old values until it is replaced. **Mounted files are updated** in place by the kubelet, typically within a minute, but only if the application actually re-reads the file.',
      'So there are three workable patterns. **Restart deliberately**: `kubectl rollout restart deployment/api`, which is explicit and safe. **Make the config part of the Pod spec**: put a hash of the ConfigMap in a pod template annotation, so any change to the config changes the template and triggers a rollout automatically - this is what Helm charts do. Or **watch the file** in the application and reload, which gives true zero-restart config changes but requires the app to support it.',
      'The pattern I would recommend by default is the checksum annotation, because it makes the dependency explicit and gives you a rollout you can watch, pause and roll back like any other.',
    ],
    code: [
      {
        title: 'Checksum annotation - config changes trigger a rollout',
        language: 'yaml',
        code: `spec:
  template:
    metadata:
      annotations:
        # Helm: any change to the ConfigMap changes this hash,
        # which changes the Pod template, which triggers a rollout.
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}`,
      },
      {
        title: 'The manual equivalents',
        language: 'bash',
        code: `# Explicit restart - adds a timestamp annotation, triggering a normal rollout
kubectl rollout restart deployment/api
kubectl rollout status deployment/api

# Mounted files DO update in place (env vars never do)
kubectl exec deploy/api -- cat /etc/config/app.yaml`,
      },
    ],
    deeper: [
      'Mark ConfigMaps and Secrets holding fixed config as `immutable: true`. The kubelet then stops watching them, which measurably reduces API server load in large clusters - and forces a new object for each change, which is better practice anyway.',
      'A subPath mount does **not** get updates. This catches people constantly: the file is projected once and never refreshed.',
      'Reloader and similar controllers watch ConfigMaps and trigger rollouts automatically, if you would rather not manage the annotation.',
    ],
    traps: [
      'Editing a ConfigMap in production and assuming it took effect.',
      'Using `subPath` and wondering why the file never updates.',
      'An app that reads config once at startup, with a file mount that updates - so the file is right and the behaviour is wrong.',
    ],
    followUps: [
      'Why does a `subPath` mount behave differently?',
      'How would you roll back a bad config change?',
    ],
    tags: ['configmap', 'deployment', 'rollout', 'production'],
  },
  {
    id: 'itv-k8s-39',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain RBAC in Kubernetes. What are the four objects and how do they fit together?',
    probing: 'Access control fluency, including the namespaced-versus-cluster distinction.',
    answer: [
      'There are two pairs. A **Role** defines permissions **within one namespace**; a **ClusterRole** defines permissions **cluster-wide** or over cluster-scoped resources like nodes and PersistentVolumes. A **RoleBinding** grants a Role (or a ClusterRole) to subjects **in one namespace**; a **ClusterRoleBinding** grants a ClusterRole **across the whole cluster**.',
      'Permissions are **purely additive** - there are no deny rules. Whatever is granted anywhere applies; you restrict by not granting, not by revoking.',
      'The genuinely useful combination is a **ClusterRole bound with a RoleBinding**. You define the permission set once, cluster-wide, then grant it namespace by namespace. That is how you give each team read access to their own namespace without writing the same Role a dozen times.',
      'Subjects are Users, Groups or **ServiceAccounts**. Users and groups are not Kubernetes objects at all - they come from whatever authenticates you (a certificate, OIDC, a cloud IAM integration). ServiceAccounts are the in-cluster identity that Pods run as.',
    ],
    code: [
      {
        title: 'A ClusterRole reused per namespace',
        language: 'yaml',
        code: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: namespace-viewer }
rules:
  - apiGroups: [""]
    resources: [pods, services, configmaps]
    verbs: [get, list, watch]
  - apiGroups: ["apps"]
    resources: [deployments, replicasets]
    verbs: [get, list, watch]
  - apiGroups: [""]
    resources: [pods/log]
    verbs: [get]
---
# Grant it in ONE namespace only, by using a RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: team-a-view, namespace: team-a }
subjects:
  - kind: Group
    name: team-a
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole            # cluster-scoped definition...
  name: namespace-viewer
  apiGroup: rbac.authorization.k8s.io`,
      },
      {
        title: 'Checking permissions instead of guessing',
        language: 'bash',
        code: `kubectl auth can-i delete pods --namespace prod
kubectl auth can-i --list --namespace prod

# What can this ServiceAccount actually do?
kubectl auth can-i --list \\
  --as=system:serviceaccount:prod:api-sa --namespace prod`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which RBAC objects do I need?',
        caption: 'ClusterRole + RoleBinding is the combination worth remembering.',
        question: 'What is the scope of the permission?',
        branches: [
          {
            condition: 'One namespace, one-off',
            result: 'Role + RoleBinding',
            tone: 'accent',
          },
          {
            condition: 'Same permissions in many namespaces',
            result: 'ClusterRole + RoleBinding per namespace',
            detail: 'Define once, grant narrowly',
            tone: 'success',
          },
          {
            condition: 'Cluster-scoped resources (nodes, PVs, CRDs)',
            result: 'ClusterRole + ClusterRoleBinding',
            tone: 'warning',
          },
          {
            condition: 'A Pod needs API access',
            result: 'ServiceAccount + Role/RoleBinding',
            detail: 'Never the default ServiceAccount',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'Every Pod gets a ServiceAccount whether you set one or not. Give workloads a dedicated one with only what they need, and set `automountServiceAccountToken: false` for Pods that never call the API.',
      'Wildcards in rules (`resources: ["*"]`) are how clusters quietly end up with everyone as admin. Audit for them.',
      '`kubectl auth can-i --as` lets you test a binding before you hand it to someone, which is far better than finding out in production.',
    ],
    traps: [
      'Binding `cluster-admin` to solve a permissions error. It works and it is the end of your security model.',
      'Expecting a deny rule to exist. There are none - permissions only add.',
      'Using a RoleBinding to grant access to cluster-scoped resources. It cannot.',
    ],
    followUps: [
      'How would you give a CI pipeline permission to deploy to one namespace only?',
      'Why is the default ServiceAccount a problem?',
    ],
    tags: ['rbac', 'security', 'serviceaccount', 'access control'],
  },
  {
    id: 'itv-k8s-40',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain PersistentVolume, PersistentVolumeClaim and StorageClass.',
    probing: 'Storage fundamentals and whether you know what dynamic provisioning removed.',
    answer: [
      'A **PersistentVolume (PV)** is a piece of storage in the cluster - a disk, a network share - as a cluster-scoped object. A **PersistentVolumeClaim (PVC)** is a namespaced *request* for storage: "I need 50Gi, ReadWriteOnce". Kubernetes binds a claim to a suitable volume, and the Pod references the **claim**, never the volume.',
      'That indirection is the point. The application asks for what it needs; the cluster decides where it comes from. The same manifest works on a laptop with local storage and in a cloud with EBS.',
      'A **StorageClass** enables **dynamic provisioning**: instead of an administrator pre-creating PVs, a PVC naming a StorageClass causes the CSI driver to create a real disk on demand and a PV to represent it. This is what almost everyone uses now - static PVs are mostly for pre-existing storage such as an NFS share.',
      'The `reclaimPolicy` on the StorageClass decides what happens when the PVC is deleted: **Delete** destroys the underlying disk, **Retain** keeps it for manual handling. Most cloud defaults are Delete, which is exactly the wrong default for a database.',
    ],
    code: [
      {
        title: 'StorageClass and a claim that uses it',
        language: 'yaml',
        code: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: fast-retain }
provisioner: ebs.csi.aws.com
parameters: { type: gp3, encrypted: "true" }
reclaimPolicy: Retain             # do NOT delete the disk with the claim
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer   # provision in the right zone
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: db-data, namespace: prod }
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: fast-retain
  resources:
    requests: { storage: 100Gi }`,
      },
    ],
    deeper: [
      '`volumeBindingMode: WaitForFirstConsumer` matters in multi-zone clusters. Without it a volume can be created in a zone where the Pod cannot be scheduled, and the Pod stays Pending forever.',
      'Access modes are properties of the storage, not wishes. **ReadWriteOnce** is one node at a time and is what almost all block storage supports; **ReadWriteMany** needs a file protocol such as NFS or EFS.',
      '`allowVolumeExpansion: true` lets you grow a PVC by editing it. Shrinking is never supported.',
      'Set `reclaimPolicy: Retain` for anything holding real data. Recovering from an accidentally deleted PVC is otherwise a restore-from-backup exercise.',
    ],
    traps: [
      'Requesting ReadWriteMany on block storage, which leaves the PVC Pending with an unhelpful message.',
      'Leaving reclaimPolicy on Delete for a production database.',
      'Assuming deleting a StatefulSet removes its PVCs. It does not - which is a feature, but it surprises people cleaning up.',
    ],
    followUps: [
      'Your PVC is stuck Pending. What do you check?',
      'Why would a PVC bind fine in a single-zone cluster and fail in a multi-zone one?',
    ],
    tags: ['storage', 'pvc', 'storageclass', 'csi', 'production'],
  },
  {
    id: 'itv-k8s-41',
    level: 'advanced',
    kind: 'open',
    prompt: 'What are Custom Resource Definitions and operators? When would you write one?',
    probing: 'Whether you understand the controller pattern rather than just knowing the words.',
    answer: [
      'A **CRD** extends the Kubernetes API with your own object type. After you install one, `kubectl get postgresclusters` works exactly like any built-in resource - it is stored in etcd, validated against your schema, and covered by RBAC. On its own, though, a CRD is **just data**: creating the object does nothing.',
      'An **operator** is the controller that gives it meaning. It runs a **reconciliation loop**: watch objects of that type, compare the **desired state** in the spec against the **actual state** in the world, and take whatever action closes the gap. This is exactly how built-in controllers work - a Deployment controller does the same thing for ReplicaSets.',
      'The point of an operator is to encode **operational knowledge** that a generic controller cannot have. Kubernetes can restart a database Pod; it has no idea how to promote a replica to primary, take a consistent backup, or perform a version upgrade in the right order. An operator encodes that domain expertise so the cluster can do it automatically at 3am.',
      'When to write one: you have a stateful system with **complex, repeatable operational procedures** that you are currently doing by hand or in runbooks. When **not** to: for anything a Deployment plus a Helm chart already handles. An operator is a piece of software you now have to maintain, test and upgrade, and a half-finished one is worse than a runbook.',
    ],
    code: [
      {
        title: 'A CRD with a validated schema',
        language: 'yaml',
        code: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata: { name: backups.ops.example.com }
spec:
  group: ops.example.com
  scope: Namespaced
  names: { plural: backups, singular: backup, kind: Backup, shortNames: [bk] }
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: [source, schedule]
              properties:
                source:   { type: string }
                schedule: { type: string, pattern: '^[-0-9*/, ]+$' }
                retain:   { type: integer, minimum: 1, default: 7 }
      subresources: { status: {} }
      additionalPrinterColumns:
        - { name: Source, type: string, jsonPath: .spec.source }
        - { name: Last, type: string, jsonPath: .status.lastBackupTime }`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'The reconciliation loop',
        caption:
          'Level-triggered, not edge-triggered: it reads current state rather than replaying events.',
        nodes: [
          { label: 'Watch custom resources', detail: 'Informer with a cache', tone: 'accent' },
          { label: 'Read desired state', detail: 'From .spec' },
          { label: 'Observe actual state', detail: 'Query the real world' },
          {
            label: 'Different?',
            branch: { label: 'No - requeue later', detail: 'Nothing to do', tone: 'muted' },
          },
          {
            label: 'Take corrective action',
            detail: 'Create, update, promote, back up',
            tone: 'warning',
          },
          { label: 'Write .status', detail: 'Observable, and drives conditions', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Reconcile must be **idempotent**. It will be called repeatedly with the same state - on resync, on restart, on unrelated events - and must converge rather than act each time.',
      'Being **level-triggered** is what makes operators robust: missing an event does not matter, because the next reconcile reads the actual state anyway.',
      'Use `status` with **conditions** rather than inventing your own fields. Tooling understands conditions.',
      'Kubebuilder and Operator SDK handle the boilerplate; the hard part is the domain logic and the failure modes, not the scaffolding.',
    ],
    traps: [
      'Writing an operator where a Helm chart would do, and acquiring a permanent maintenance burden.',
      'Non-idempotent reconcile logic that creates duplicates on every resync.',
      'Putting state in annotations instead of `status`, which then gets clobbered.',
      'No finalizers, so deleting the custom resource leaks the real-world resources it created.',
    ],
    followUps: [
      'Why must reconcile be idempotent?',
      'What is a finalizer and when do you need one?',
    ],
    tags: ['crd', 'operator', 'controller', 'architecture', 'advanced'],
  },
  {
    id: 'itv-k8s-42',
    level: 'advanced',
    kind: 'open',
    prompt: 'Describe the Kubernetes control plane. What does each component do?',
    probing:
      'Architecture. The follow-up is usually "what happens if this one dies", so know the blast radius of each.',
    answer: [
      'The **API server** is the only component that talks to etcd and the only entry point for everything else. It authenticates, authorises, runs admission controllers, validates, and persists. Every other component is a client of it.',
      '**etcd** is the distributed key-value store holding all cluster state. It is the only stateful component and the only one whose loss is unrecoverable without a backup.',
      'The **scheduler** watches for Pods with no node assigned, filters nodes that could take them (resources, taints, affinity, volumes), scores the survivors, and writes its choice back. It does not start anything - it only decides.',
      'The **controller manager** runs the built-in control loops - Deployment, ReplicaSet, Node, Job, endpoints and many more - each reconciling desired state against actual.',
      'The **cloud controller manager** handles cloud-specific integration: provisioning load balancers, attaching volumes, and reconciling node lifecycle with the provider.',
      'On each node: the **kubelet** is the agent that actually runs containers via the CRI and reports status back, and **kube-proxy** programs the iptables or IPVS rules implementing Services.',
      'The blast radius is worth knowing: if the **API server** is down, nothing can be changed, but **running Pods keep running** - the kubelet does not need the API server to keep containers alive. If the **scheduler** is down, existing Pods run but new ones stay Pending. If **etcd** is lost without a backup, the cluster is gone.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'Creating a Deployment, end to end',
        caption:
          'Nothing talks to etcd except the API server, and components communicate only by watching it.',
        participants: [
          { id: 'cli', label: 'kubectl' },
          { id: 'api', label: 'API server' },
          { id: 'ctrl', label: 'Controllers' },
          { id: 'sched', label: 'Scheduler' },
          { id: 'kubelet', label: 'Kubelet' },
        ],
        messages: [
          { from: 'cli', to: 'api', label: 'create Deployment' },
          {
            from: 'api',
            to: 'api',
            label: 'authn, authz, admission, write to etcd',
            kind: 'return',
          },
          { from: 'ctrl', to: 'api', label: 'watch: new Deployment' },
          { from: 'ctrl', to: 'api', label: 'create ReplicaSet, then Pods' },
          { from: 'sched', to: 'api', label: 'watch: Pods with no node' },
          { from: 'sched', to: 'api', label: 'bind Pod to node-3' },
          { from: 'kubelet', to: 'api', label: 'watch: Pods bound to me' },
          { from: 'kubelet', to: 'kubelet', label: 'pull image, start container', kind: 'return' },
          { from: 'kubelet', to: 'api', label: 'report status Running', kind: 'return' },
        ],
      },
    ],
    deeper: [
      'Components never talk to each other directly. They all watch the API server, which is what makes the system loosely coupled and individually restartable.',
      'etcd backups are the single most important operational task on a self-managed cluster. Managed control planes do this for you, which is most of what you are paying for.',
      'The API server is stateless and horizontally scalable; etcd is not - it is a quorum, so you run 3 or 5 members, never an even number.',
    ],
    traps: [
      'Saying the scheduler starts Pods. It only writes the node assignment; the kubelet starts them.',
      'Assuming an API server outage stops running workloads. It does not.',
      'Forgetting etcd backups on a self-managed cluster.',
    ],
    followUps: [
      'What still works if the API server is down for ten minutes?',
      'Why is etcd always an odd number of members?',
    ],
    tags: ['architecture', 'control plane', 'etcd', 'advanced'],
  },
  {
    id: 'itv-k8s-43',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is the difference between a Job and a CronJob?',
    probing: 'Batch workload basics.',
    options: [
      { id: 'a', text: 'A Job runs continuously; a CronJob runs once' },
      {
        id: 'b',
        text: 'A Job runs a task to completion once; a CronJob creates Jobs on a schedule',
      },
      { id: 'c', text: 'A CronJob is the older API and a Job replaced it' },
      { id: 'd', text: 'They are identical apart from the name' },
    ],
    correct: ['b'],
    answer: [
      'A **Job** runs a Pod until it **completes successfully** and then stops. That is the key difference from a Deployment: a Job expects the process to finish, and tracks completions and retries. A **CronJob** is a higher-level object that creates a Job on a cron schedule.',
      'The settings that matter operationally are `backoffLimit` (how many failures before the Job gives up), `activeDeadlineSeconds` (a wall-clock timeout for a Job that hangs), and `ttlSecondsAfterFinished` (automatic cleanup, without which completed Pods pile up indefinitely).',
      'For CronJobs, `concurrencyPolicy` is the one people get wrong. The default **Allow** will happily start a second run while the first is still going - so a job that normally takes two minutes but occasionally takes twenty will overlap itself. **Forbid** skips the new run; **Replace** kills the old one.',
    ],
    code: [
      {
        title: 'A CronJob with the settings that prevent incidents',
        language: 'yaml',
        code: `apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-report }
spec:
  schedule: "0 2 * * *"
  timeZone: "Europe/London"        # otherwise UTC, which shifts twice a year
  concurrencyPolicy: Forbid        # never overlap with a still-running run
  startingDeadlineSeconds: 300     # skip if we could not start within 5 minutes
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 3600  # kill it if it hangs
      ttlSecondsAfterFinished: 86400
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: reports:2.1`,
      },
    ],
    traps: [
      'Leaving `concurrencyPolicy: Allow` on a job that can run long, and getting overlapping runs.',
      'No `ttlSecondsAfterFinished`, so completed Pods accumulate until the namespace is unusable.',
      'Forgetting `timeZone`, so the schedule is UTC and drifts relative to local time twice a year.',
      '`restartPolicy: Always` in a Job template - it is rejected; Jobs need `OnFailure` or `Never`.',
    ],
    followUps: [
      'A CronJob missed several runs while the cluster was down. What happens when it recovers?',
    ],
    tags: ['jobs', 'cronjob', 'batch', 'production'],
  },
  {
    id: 'itv-k8s-44',
    level: 'advanced',
    kind: 'scenario',
    prompt: 'A node goes NotReady in production. What happens to its Pods, and what do you do?',
    probing:
      'Cluster operations under failure, including the timings, which almost nobody knows precisely.',
    answer: [
      'First, what Kubernetes does on its own. The node controller marks the node `NotReady` after it stops heartbeating (**40 seconds** by default). It then applies a `node.kubernetes.io/unreachable` **NoExecute taint**, and Pods are evicted after their toleration period - **5 minutes** by default. So there is a roughly five-minute window where Pods on a dead node are still listed as Running and **still in Service endpoints**, quietly receiving traffic that goes nowhere.',
      'Pods managed by a controller are then recreated elsewhere. Pods **not** managed by a controller are simply gone. **StatefulSet Pods are a special case**: they are *not* force-deleted, because Kubernetes cannot safely assume the old Pod has stopped writing to its volume - deleting it could cause split-brain. They stay `Terminating` until you intervene.',
      'What I would do: **triage the node first** - is it the node, the kubelet, or the network? `kubectl describe node` shows conditions like `MemoryPressure`, `DiskPressure` and `PIDPressure`, which often name the cause immediately. If I can reach the host, check the kubelet service, disk space and `dmesg` for OOM or hardware errors.',
      'Then **decide between repair and replace**. In a cloud with autoscaling the answer is usually replace: cordon, drain, terminate the instance and let a new one join. Repairing a cattle node is rarely worth the time.',
      'Then the follow-up: why did this hurt? If one node going down caused an outage, the fix is spreading - `topologySpreadConstraints` or anti-affinity so replicas are not concentrated, plus a **PodDisruptionBudget** so voluntary disruptions respect a minimum.',
    ],
    code: [
      {
        title: 'Triage, then drain',
        language: 'bash',
        code: `kubectl get nodes
kubectl describe node node-7 | grep -A12 Conditions

# Stop new work landing there, then move everything off
kubectl cordon node-7
kubectl drain node-7 --ignore-daemonsets --delete-emptydir-data --timeout=300s

# StatefulSet Pods stuck Terminating - only after confirming the node is REALLY dead
kubectl delete pod db-1 --force --grace-period=0`,
        explanation:
          'Force-deleting a StatefulSet Pod while the node is actually alive risks two writers on one volume. Confirm first.',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Node failure timeline',
        caption:
          'The five-minute gap is why a PodDisruptionBudget and spreading matter more than fast detection.',
        nodes: [
          { label: 'Node stops heartbeating', detail: 't = 0', tone: 'accent' },
          { label: 'Marked NotReady', detail: 't = 40s', tone: 'warning' },
          {
            label: 'NoExecute taint applied',
            detail: 'Pods still Running and still in endpoints',
            tone: 'danger',
          },
          { label: 'Eviction begins', detail: 't = 5m 40s default' },
          { label: 'Controllers recreate Pods elsewhere', tone: 'success' },
          {
            label: 'StatefulSet Pods stay Terminating',
            detail: 'Deliberate - needs manual confirmation',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'You can shorten the eviction window per Pod with `tolerationSeconds` on the unreachable taint, but going too low causes unnecessary churn during brief network blips.',
      'Readiness is the real mitigation for the five-minute gap: the endpoint is only removed when the Pod is marked not-ready, so faster health detection at the load-balancer layer beats faster eviction.',
      'A PodDisruptionBudget protects against **voluntary** disruption (drains, upgrades) only. It does not help when a node dies - only spreading does.',
      'Watch for cascades: evicted Pods land on remaining nodes, which may then hit their own limits. Enough headroom to lose a node is a capacity planning decision.',
    ],
    traps: [
      'Force-deleting StatefulSet Pods reflexively, risking two writers on one volume.',
      'Draining without `--ignore-daemonsets`, which just fails.',
      'Assuming eviction is instant. Five minutes of traffic can be a lot of errors.',
      'Fixing the node and not asking why losing one node caused user-visible impact.',
    ],
    followUps: [
      'Why does Kubernetes refuse to force-delete StatefulSet Pods automatically?',
      'How would you make the next node failure invisible to users?',
    ],
    tags: ['scenario', 'node failure', 'operations', 'availability', 'production'],
  },
  {
    id: 'itv-k8s-45',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a PodDisruptionBudget and what does it not protect you from?',
    probing: 'Whether you know the voluntary/involuntary distinction, which is the whole point.',
    answer: [
      'A PDB declares how much of a workload must stay available during **voluntary disruptions** - `minAvailable: 2` or `maxUnavailable: 1`. The eviction API respects it, so `kubectl drain` and the cluster autoscaler will block rather than take you below the threshold.',
      'It protects against **voluntary** disruption only: node drains, cluster upgrades, autoscaler scale-down. It does **not** protect against **involuntary** disruption - a node crashing, a kernel panic, an OOMKill, or someone deleting Pods directly with `kubectl delete pod`, which bypasses the eviction API entirely.',
      'So a PDB stops an operator or an automated process from accidentally taking your service down during maintenance. It does nothing about hardware failure; that is what replica count and spreading are for.',
      'The common mistake is a PDB that makes the cluster unmaintainable: `minAvailable: 3` on a Deployment with 3 replicas means **no** Pod can ever be evicted, so node drains hang forever and cluster upgrades stall. Always leave room for one.',
    ],
    code: [
      {
        title: 'A PDB that leaves room to drain',
        language: 'yaml',
        code: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api }
spec:
  maxUnavailable: 1          # safer than minAvailable as replicas change
  selector:
    matchLabels: { app: api }`,
        explanation:
          'maxUnavailable scales with the Deployment; a fixed minAvailable equal to the replica count deadlocks drains.',
      },
    ],
    traps: [
      'minAvailable equal to the replica count, which blocks every drain permanently.',
      'Expecting a PDB to help when a node dies. It does not.',
      'A PDB on a single-replica Deployment, which makes maintenance impossible while protecting nothing.',
    ],
    followUps: ['Your node drain has been hanging for twenty minutes. What would you check?'],
    tags: ['pdb', 'availability', 'operations', 'production'],
  },
  {
    id: 'itv-k8s-46',
    level: 'advanced',
    kind: 'multi',
    prompt: 'Which of these meaningfully harden a Pod against compromise? Select all that apply.',
    probing: 'Practical `securityContext` knowledge.',
    options: [
      { id: 'a', text: '`runAsNonRoot: true` with an explicit `runAsUser`' },
      { id: 'b', text: '`readOnlyRootFilesystem: true` with tmpfs for paths that need writing' },
      { id: 'c', text: '`allowPrivilegeEscalation: false`' },
      { id: 'd', text: 'Dropping all capabilities and adding back only what is required' },
      { id: 'e', text: 'Setting `hostNetwork: true` so traffic bypasses the CNI' },
    ],
    correct: ['a', 'b', 'c', 'd'],
    answer: [
      '`hostNetwork: true` **weakens** isolation rather than strengthening it. The Pod uses the node’s network namespace directly, so it can see and bind node interfaces, reach things NetworkPolicy would otherwise block, and its ports collide with the host’s. It is occasionally necessary for infrastructure components; it is never a hardening measure.',
      'The other four are the standard baseline and map directly onto the **Restricted** Pod Security Standard. Non-root means a container escape lands unprivileged. A read-only root filesystem means an attacker cannot write a binary or modify your code. `allowPrivilegeEscalation: false` blocks the setuid path. Dropping capabilities removes powers almost no application uses.',
      'Enforce these at the namespace level with **Pod Security Admission** rather than hoping every manifest sets them - a single label puts the whole namespace under the restricted profile.',
    ],
    code: [
      {
        title: 'A hardened Pod spec',
        language: 'yaml',
        code: `spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    fsGroup: 10001
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: api
      image: api:1.4
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
      volumeMounts:
        - { name: tmp, mountPath: /tmp }
  volumes:
    - name: tmp
      emptyDir: {}`,
      },
      {
        title: 'Enforce it for the whole namespace',
        language: 'bash',
        code: `kubectl label namespace prod \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/warn=restricted

# Try it in warn mode first to see what would break
kubectl label namespace prod --overwrite \\
  pod-security.kubernetes.io/enforce=baseline \\
  pod-security.kubernetes.io/warn=restricted`,
      },
    ],
    deeper: [
      'Roll this out in `warn` or `audit` mode first. Turning on `restricted` enforcement in a busy namespace blocks new Pods immediately.',
      '`seccompProfile: RuntimeDefault` is a cheap, high-value addition that blocks a large set of rarely-used syscalls.',
      'A read-only root filesystem is the one that finds hidden write paths. Expect to add a few `emptyDir` mounts.',
    ],
    traps: [
      'Setting `runAsNonRoot` without making the image support it, so the Pod fails to start.',
      'Believing a securityContext replaces NetworkPolicy and RBAC. They cover different layers.',
      'Using `hostNetwork` or `hostPath` for convenience and losing most of your isolation.',
    ],
    followUps: [
      'How would you roll restricted Pod Security out to an existing cluster safely?',
      'What breaks first with `readOnlyRootFilesystem: true`?',
    ],
    tags: ['security', 'securitycontext', 'pod security', 'hardening', 'advanced'],
  },
  {
    id: 'itv-k8s-47',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is Helm and what problem does it actually solve?',
    probing: 'Package management, and whether you know its weaknesses as well as its strengths.',
    answer: [
      'Helm packages a set of Kubernetes manifests as a **chart** with **templating** and **values**, so one definition can be deployed to several environments with different configuration. It tracks each install as a **release** with revision history, so `helm rollback` returns you to a previous set of manifests.',
      'The real problem it solves is duplication. Without it you copy the same YAML per environment and they drift; the staging manifest gets a fix that production never receives. With it you have one chart and a values file per environment.',
      'Its weaknesses are worth naming. It is **string templating over YAML**, so a mis-indented template produces an invalid manifest that only fails at apply time - and template logic gets unreadable quickly. And a Helm release is a **point-in-time apply**, not continuous reconciliation: if someone edits a resource by hand, Helm does not notice or correct it.',
      'That second point is why many teams pair Helm with **Argo CD or Flux** - Helm to template, GitOps to continuously reconcile against git. Kustomize is the main alternative, and it takes the opposite approach: patch real YAML rather than template it, which is simpler to reason about but less flexible for distributing a configurable package.',
    ],
    code: [
      {
        title: 'Everyday Helm',
        language: 'bash',
        code: `helm install api ./chart -f values.prod.yaml --namespace prod

# Always see the rendered manifests before you trust them
helm template api ./chart -f values.prod.yaml | less
helm diff upgrade api ./chart -f values.prod.yaml     # helm-diff plugin

helm upgrade api ./chart -f values.prod.yaml --atomic --timeout 5m
helm history api
helm rollback api 3`,
        explanation:
          '--atomic rolls back automatically if the upgrade fails, rather than leaving a half-applied release.',
      },
    ],
    deeper: [
      '`--atomic` and `--wait` turn a failed upgrade into an automatic rollback instead of a broken release someone has to untangle.',
      'Helm hooks handle ordering - a migration Job that must complete before the new Pods roll - which plain manifests cannot express.',
      'Chart tests (`helm test`) give you a post-install smoke check that runs in the cluster.',
      'Pin chart versions and store rendered output in review. "It worked when I ran it" is not a deployment process.',
    ],
    traps: [
      'Template logic so complex nobody can predict the output. Render and read it.',
      'Assuming Helm reconciles drift. It applies once and forgets.',
      'Secrets in `values.yaml` committed to git.',
    ],
    followUps: [
      'Helm or Kustomize - how would you choose?',
      'What does Argo CD add that Helm alone does not?',
    ],
    tags: ['helm', 'packaging', 'gitops', 'deployment'],
  },
  {
    id: 'itv-k8s-48',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a DaemonSet and what is it for?',
    probing: 'Workload type coverage.',
    answer: [
      'A DaemonSet runs **exactly one copy of a Pod on every node** (or every node matching a selector). When a node joins the cluster it automatically gets one; when a node leaves, its Pod goes with it.',
      'It exists for **node-level infrastructure** - things that must be present wherever workloads run. Log collectors that read the node’s container log directory, metrics agents like node-exporter, CNI plugins, storage drivers and security agents.',
      'The distinction from a Deployment is who decides the replica count. A Deployment runs *N* copies wherever they fit; a DaemonSet runs *one per node*, and the count follows the cluster size. If you find yourself trying to keep a Deployment’s replica count equal to the node count, you want a DaemonSet.',
    ],
    code: [
      {
        title: 'A DaemonSet that must run everywhere, including tainted nodes',
        language: 'yaml',
        code: `apiVersion: apps/v1
kind: DaemonSet
metadata: { name: node-exporter, namespace: monitoring }
spec:
  selector:
    matchLabels: { app: node-exporter }
  template:
    metadata:
      labels: { app: node-exporter }
    spec:
      tolerations:
        - operator: Exists          # run on every node, whatever its taints
      hostNetwork: true
      containers:
        - name: node-exporter
          image: prom/node-exporter:v1.8.2
          ports: [{ containerPort: 9100, hostPort: 9100 }]`,
        explanation:
          'A blanket toleration is normal for monitoring DaemonSets - you want metrics from control-plane nodes too.',
      },
    ],
    traps: [
      'Forgetting tolerations, so the agent is missing from exactly the tainted nodes you most want to watch.',
      'Not setting resource requests, so a DaemonSet competes with workloads on every node at once.',
      'Draining a node and being surprised the DaemonSet Pod stays - `--ignore-daemonsets` exists for that reason.',
    ],
    followUps: ['Why does `kubectl drain` require `--ignore-daemonsets`?'],
    tags: ['daemonset', 'workloads', 'monitoring', 'fundamentals'],
  },
  {
    id: 'itv-k8s-49',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you approach an etcd backup and restore strategy for a self-managed cluster?',
    probing:
      'Disaster recovery. Senior candidates should mention testing restores, not just taking backups.',
    answer: [
      'etcd holds **all** cluster state - every object, every Secret. Losing it without a backup means the cluster is unrecoverable; you would rebuild and reapply from source. So on a self-managed cluster this is the single most important operational task.',
      'The mechanism is `etcdctl snapshot save`, run on an etcd member with the right certificates, on a schedule, with the snapshot **stored off the cluster** - a bucket in another account or region. A backup on the same machines as etcd protects you from almost nothing.',
      'Retention should follow the failure modes you care about: frequent snapshots for recent recovery, and longer-retained ones for a mistake noticed days later. Encrypt them, because they contain every Secret in the cluster in whatever form etcd holds them.',
      'The part that separates a real strategy from a checkbox is **testing the restore**. A restore is not a file copy: you stop the control plane, restore the snapshot to a new data directory on each member, and restart with the correct cluster configuration. It is fiddly enough that doing it for the first time during an incident is a bad plan. Practise it on a throwaway cluster and write down the steps.',
      'And know what a restore **loses**: everything since the snapshot, and the cluster goes back in time - Pods created since then vanish, and the actual running state on the nodes no longer matches what etcd believes. Expect reconciliation churn afterwards.',
    ],
    code: [
      {
        title: 'Snapshot, verify and store off-cluster',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

SNAP="/var/backups/etcd-$(date +%Y%m%dT%H%M%S).db"

ETCDCTL_API=3 etcdctl snapshot save "$SNAP" \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

# A snapshot you have not verified is not a backup
ETCDCTL_API=3 etcdctl snapshot status "$SNAP" --write-out=table

# Off the cluster, encrypted, in another failure domain
aws s3 cp "$SNAP" "s3://cluster-backups/etcd/" --sse aws:kms
rm -f "$SNAP"`,
      },
      {
        title: 'The restore, which you should have rehearsed',
        language: 'bash',
        code: `# On EVERY etcd member, with the control plane stopped:
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-20260901.db \\
  --name etcd-1 \\
  --initial-cluster etcd-1=https://10.0.1.1:2380,etcd-2=https://10.0.1.2:2380 \\
  --initial-advertise-peer-urls https://10.0.1.1:2380 \\
  --data-dir /var/lib/etcd-restored

# Point the etcd manifest at the new data dir, then restart the control plane
kubectl get nodes          # first check once the API server is back`,
      },
    ],
    deeper: [
      'Enable **encryption at rest** for Secrets. Without it, anyone with a snapshot has every credential in the cluster in plain text.',
      'Back up more than etcd: the PKI directory, and any cluster state that lives outside etcd such as PersistentVolume data - restoring etcd does not restore your databases.',
      'A GitOps repository is a complementary form of backup: it lets you rebuild the desired state on a fresh cluster, which is often a cleaner recovery than restoring etcd.',
      'Managed control planes handle this for you. That is a legitimate argument for using one.',
    ],
    traps: [
      'Taking backups and never testing a restore. Extremely common, and only discovered at the worst moment.',
      'Storing snapshots on the etcd nodes themselves.',
      'Forgetting the snapshot contains every Secret, and leaving it unencrypted.',
      'Assuming an etcd restore also restores volume data. It does not.',
    ],
    followUps: [
      'What does a cluster look like immediately after an etcd restore?',
      'How does GitOps change your disaster recovery plan?',
    ],
    tags: ['etcd', 'backup', 'disaster recovery', 'operations', 'advanced'],
  },
  {
    id: 'itv-k8s-50',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are init containers and when would you use one?',
    probing: 'Pod lifecycle detail, and whether you know the sidecar distinction.',
    answer: [
      'Init containers run **before** the main containers, **in order**, and each must **complete successfully** before the next starts. Only when all of them have finished do the application containers begin.',
      'They are for setup work that must happen first and must not be part of the application image: waiting for a dependency to become reachable, running a database migration, fetching configuration or a certificate into a shared volume, or fixing file permissions on a mounted volume.',
      'The reason to use one rather than doing it in an entrypoint script is **separation and tooling**. The init container can use a completely different image - one with `psql` or `git` or `curl` - so your application image stays minimal and does not ship tools an attacker could use.',
      'The distinction from a sidecar matters: an init container **runs to completion and exits**; a sidecar runs **alongside** for the life of the Pod. Recent Kubernetes versions express native sidecars as init containers with `restartPolicy: Always`, which finally gave them a proper lifecycle.',
    ],
    code: [
      {
        title: 'Wait for a dependency, then migrate, then start',
        language: 'yaml',
        code: `spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command:
        - sh
        - -c
        - 'until nc -z db 5432; do echo waiting for db; sleep 2; done'
    - name: migrate
      image: migrate/migrate:v4        # tooling that never reaches the app image
      args: ["-path", "/migrations", "-database", "$(DATABASE_URL)", "up"]
      envFrom:
        - secretRef: { name: db-creds }
  containers:
    - name: api
      image: api:1.4                   # starts only after both init containers succeed`,
      },
    ],
    deeper: [
      'A failing init container puts the Pod in `Init:CrashLoopBackOff`, and `kubectl logs` needs `-c <init-container-name>` to show anything. Easy to overlook.',
      'Running migrations in an init container means every replica tries it. Use a Job or an advisory lock if the migration is not safely concurrent.',
      'Init containers can request more resources than the app containers without cost, because the scheduler uses the maximum, not the sum.',
    ],
    traps: [
      'Migrations in an init container across many replicas, all racing.',
      'An init container with no timeout waiting forever for a dependency that will never come.',
      'Forgetting `-c` and concluding there are no logs.',
    ],
    followUps: [
      'What is the risk of running database migrations in an init container?',
      'How is a native sidecar different from an init container?',
    ],
    tags: ['init containers', 'pods', 'lifecycle', 'migrations'],
  },
  {
    id: 'itv-k8s-51',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is GitOps and how does it differ from a normal CI/CD deployment?',
    probing: 'Modern delivery practice. The pull-versus-push distinction is the substance.',
    answer: [
      'In a conventional pipeline, CI **pushes** to the cluster: the pipeline holds cluster credentials and runs `kubectl apply` or `helm upgrade`. In GitOps, an **agent inside the cluster pulls**: Argo CD or Flux watches a git repository and continuously reconciles the cluster towards what git says.',
      'Three things change as a result. **Credentials**: no external system needs cluster admin, because the agent is already inside and only needs read access to git. That removes a serious attack path - a compromised CI system no longer means a compromised cluster.',
      '**Drift correction**: because it reconciles continuously rather than applying once, a manual `kubectl edit` in production is detected and reverted. With push-based CD, hand edits persist silently until the next deploy overwrites them unpredictably.',
      '**Auditability and rollback**: git is the source of truth, so the history of what was deployed is the commit history, and a rollback is a revert. You can answer "what was running last Tuesday" precisely.',
      'The costs are real too: everything must be in git, which makes secrets awkward (hence Sealed Secrets or External Secrets), emergency changes feel slower because they go through a commit, and you now operate the GitOps controller itself. On balance it is the better default for anything at scale, but it is not free.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Push CD versus pull GitOps',
        caption:
          'The cluster credential never leaves the cluster, and drift is corrected continuously.',
        nodes: [
          { label: 'Developer merges to main', tone: 'accent' },
          { label: 'CI builds and pushes image', detail: 'Tagged with the commit SHA' },
          { label: 'CI updates the manifest repo', detail: 'New image digest committed' },
          {
            label: 'Agent in cluster detects the change',
            detail: 'Argo CD / Flux polls or is notified',
          },
          {
            label: 'Agent applies and reconciles',
            detail: 'Continuously, not once',
            tone: 'success',
          },
          { label: 'Manual edit detected', detail: 'Reverted automatically', tone: 'warning' },
        ],
      },
    ],
    deeper: [
      'Keep application code and manifests in **separate repositories**, or a commit to manifests retriggers CI in a loop.',
      'Secrets need a strategy: Sealed Secrets encrypts them so the ciphertext is safe in git; External Secrets keeps them in Vault or a cloud store and syncs them in.',
      'Argo CD’s sync waves and health checks let you order dependent resources, which matters for migrations and CRDs.',
      'Progressive delivery (Argo Rollouts, Flagger) layers canary and automated rollback on metrics on top of GitOps.',
    ],
    traps: [
      'Continuing to `kubectl apply` by hand alongside GitOps, so changes fight each other.',
      'Plain-text secrets in the manifest repo.',
      'One repo for code and manifests, producing CI loops.',
      'Treating GitOps as only a deployment tool and skipping the drift-correction benefit, which is most of the value.',
    ],
    followUps: [
      'How do you handle secrets in a GitOps repository?',
      'Someone needs an emergency fix at 3am. How does GitOps handle that?',
    ],
    tags: ['gitops', 'argocd', 'flux', 'cicd', 'advanced'],
  },
]
