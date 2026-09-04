import type { Topic } from '../../../types'

export const workloadResources: Topic = {
  id: 'workload-resources',
  title: 'Choosing the right workload resource',
  domainId: 'design-build',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 5,
  tags: ['deployment', 'daemonset', 'statefulset', 'job', 'cronjob', 'design', 'primitives'],
  oneLiner:
    'Deployment, StatefulSet, DaemonSet, Job or CronJob - a decision procedure, and how to design an application out of Kubernetes primitives.',
  explanation: [
    'Kubernetes gives you five workload controllers, and picking the wrong one is a design error that no amount of YAML polish fixes. The official CKAD curriculum names this explicitly: "choose and use the right workload resource".',
    '**Deployment** - stateless, interchangeable replicas. Pods get random names, can be replaced in any order, and share nothing. This is the default and covers most web services and APIs.',
    '**StatefulSet** - each replica has a stable identity (`web-0`, `web-1`), stable DNS, and its own PersistentVolumeClaim created from a template. Pods start and terminate in order. Use it for databases, queues and anything that cares which replica it is.',
    '**DaemonSet** - exactly one Pod per node (optionally filtered by node labels). Used for node-level agents: log shippers, metrics exporters, CNI components. No `replicas` field - the node count decides.',
    '**Job** - run to completion. Retries on failure, tracks successes, and finishes. **CronJob** - create a Job on a schedule.',
    'Designing an application means composing these with the supporting primitives: Service for a stable address, ConfigMap and Secret for configuration, PVC for storage, ServiceAccount for identity, probes for health, and requests/limits for capacity.',
  ],
  whyItMatters: [
    'Exam tasks are often phrased as an outcome ("run a task every night at 02:00", "run a log collector on every node") rather than naming the object. Recognising the shape gets you to the right kind immediately.',
    'The wrong choice produces symptoms that look like bugs: a batch container in a Deployment crash-loops on success; a database in a Deployment loses data on every rollout; an agent in a Deployment misses nodes.',
    'Knowing which controller creates PVCs for you (only StatefulSet, via `volumeClaimTemplates`) saves you from hand-creating claims per replica.',
  ],
  howItWorks: [
    'Decision procedure. Does it finish? → Job (once) or CronJob (on a schedule). Must it run on every node? → DaemonSet. Does each replica need a stable name, stable DNS or its own storage? → StatefulSet. Otherwise → Deployment.',
    'Deployment Pods are named `<deploy>-<template-hash>-<random>`; StatefulSet Pods are `<sts>-<ordinal>` and keep that name across restarts. A StatefulSet also needs a headless Service (`clusterIP: None`) to give each Pod DNS as `<pod>.<svc>.<ns>.svc.cluster.local`.',
    'StatefulSet `volumeClaimTemplates` create one PVC per Pod, named `<template>-<sts>-<ordinal>`, and those PVCs are *not* deleted when the StatefulSet is deleted - deliberately, so data survives.',
    'DaemonSets ignore `spec.replicas`; the scheduler places one Pod per eligible node, and they tolerate some control-plane taints depending on configuration.',
    'Jobs require `restartPolicy: OnFailure` or `Never` in the Pod template - `Always` is rejected, because "run to completion" and "always restart" contradict each other.',
    'All five embed the same Pod template, so every skill from the Pod topics transfers directly.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which workload resource?',
      caption:
        'Read the verbs in the task. "Serve", "finish", "every night", "one per node" each map to exactly one answer.',
      question: 'How does the work behave over time?',
      branches: [
        {
          condition: 'runs forever and serves requests',
          result: 'Deployment',
          detail: 'Stateless, interchangeable replicas, safe rollouts',
          tone: 'accent',
        },
        {
          condition: 'runs forever and needs identity or storage per replica',
          result: 'StatefulSet',
          detail: 'Stable names web-0, web-1 and per-replica volumes',
        },
        {
          condition: 'must run on every node',
          result: 'DaemonSet',
          detail: 'Log shippers, node agents; no replica count',
        },
        {
          condition: 'runs to completion, once',
          result: 'Job',
          detail: 'completions, parallelism, backoffLimit',
        },
      ],
    },
    {
      kind: 'nested',
      title: 'Who owns whom',
      caption:
        'You edit the top box. Everything below is created for you - which is why deleting Pods by hand never sticks.',
      root: {
        label: 'Deployment',
        detail: 'You write this. Holds the Pod template and strategy.',
        tone: 'accent',
        children: [
          {
            label: 'ReplicaSet (revision 1)',
            detail: 'Scaled to 0 after a rollout, kept for rollback',
            tone: 'muted',
          },
          {
            label: 'ReplicaSet (revision 2)',
            detail: 'One ReplicaSet per distinct Pod template',
            children: [
              { label: 'Pod web-7c9f-abcde', detail: 'Recreated if deleted' },
              { label: 'Pod web-7c9f-fghij', detail: 'Recreated if deleted' },
            ],
          },
        ],
      },
    },
  ],
  keyObjects: [
    {
      kind: 'StatefulSet',
      apiVersion: 'apps/v1',
      purpose: 'Ordered, stable-identity replicas with per-replica storage.',
      fields: [
        {
          path: 'spec.serviceName',
          meaning: 'Name of the headless Service that provides per-Pod DNS.',
          required: true,
        },
        {
          path: 'spec.volumeClaimTemplates[]',
          meaning: 'One PVC created per Pod, retained after deletion.',
        },
        { path: 'spec.podManagementPolicy', meaning: 'OrderedReady (default) or Parallel.' },
        {
          path: 'spec.updateStrategy.type',
          meaning: 'RollingUpdate (default, highest ordinal first) or OnDelete.',
        },
      ],
    },
    {
      kind: 'DaemonSet',
      apiVersion: 'apps/v1',
      purpose: 'One Pod per (selected) node.',
      fields: [
        {
          path: 'spec.template.spec.nodeSelector',
          meaning: 'Restrict to nodes with these labels.',
        },
        {
          path: 'spec.template.spec.tolerations[]',
          meaning: 'Needed to run on tainted nodes such as control-plane nodes.',
        },
        { path: 'spec.updateStrategy.type', meaning: 'RollingUpdate (default) or OnDelete.' },
        {
          path: 'status.desiredNumberScheduled',
          meaning: 'Derived from the node count - there is no replicas field.',
        },
      ],
    },
    {
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      purpose: 'Interchangeable stateless replicas with rolling updates.',
      fields: [{ path: 'spec.replicas', meaning: 'Desired count; Pods are fungible.' }],
    },
  ],
  realWorldExample: {
    title: 'A four-component application, one controller each',
    story: [
      'A small shop application needs: a web API, a PostgreSQL database, a nightly report, and a log shipper on every node.',
      'The API is a **Deployment** with 3 replicas, a ClusterIP Service, a ConfigMap for settings, a Secret for the database password, readiness and liveness probes, and requests/limits.',
      'PostgreSQL is a **StatefulSet** with 1 replica, a headless Service, and a `volumeClaimTemplate` for its data directory. Identity matters: `postgres-0` must always reattach to the same volume, which a Deployment cannot guarantee.',
      'The nightly report is a **CronJob** at `0 2 * * *` creating a Job with `backoffLimit: 3`. Modelling it as a Deployment would make it restart forever after each successful run.',
      'The log shipper is a **DaemonSet** mounting `/var/log` from the host. A Deployment with 3 replicas would leave some nodes uncovered and double up on others.',
      'The Service, ConfigMap, Secret and PVC are the same primitives in all four cases - only the controller changes.',
    ],
    code: [
      {
        title: 'The whole application, one line per component',
        language: 'bash',
        code: `kubectl get deploy,sts,ds,cronjob -n shop
# NAME                    READY   UP-TO-DATE   AVAILABLE   AGE
# deployment.apps/api     3/3     3            3           2d
#
# NAME                        READY   AGE
# statefulset.apps/postgres   1/1     2d
#
# NAME                       DESIRED   CURRENT   READY   NODE SELECTOR   AGE
# daemonset.apps/log-shipper 3         3         3       <none>          2d
#
# NAME                     SCHEDULE    SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# cronjob.batch/nightly    0 2 * * *   False     0        7h              2d`,
        explanation:
          'Note DaemonSet reports DESIRED 3 with no replicas set anywhere - that number came from the node count.',
        placeholders: ['shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'StatefulSet with per-replica storage and a headless Service',
      language: 'yaml',
      code: `apiVersion: v1
kind: Service
metadata:
  name: postgres # the headless Service the StatefulSet needs
  namespace: shop
spec:
  clusterIP: None # headless: DNS returns Pod IPs, not a virtual IP
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: shop
spec:
  serviceName: postgres # must match the headless Service name
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates: # one PVC per Pod: data-postgres-0
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 5Gi`,
      explanation:
        'The Pod gets DNS name `postgres-0.postgres.shop.svc.cluster.local`. Deleting the StatefulSet leaves `data-postgres-0` behind on purpose, so recreating it reattaches the same data.',
      placeholders: ['postgres', 'shop', 'postgres-secret'],
    },
    {
      title: 'DaemonSet for a node-level agent',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-shipper
  namespace: shop
spec:
  selector:
    matchLabels:
      app: log-shipper
  template:
    metadata:
      labels:
        app: log-shipper
    spec:
      # Only needed if you also want a Pod on tainted control-plane nodes:
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
      containers:
        - name: shipper
          image: busybox:1.36
          command: ["sh", "-c", "tail -F /var/log/containers/*.log"]
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
            type: Directory`,
      explanation:
        'There is deliberately no `replicas` field. Add a node to the cluster and a Pod appears on it automatically; drain a node and its Pod goes away.',
      placeholders: ['log-shipper', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl create deployment api --image=nginx:1.27-alpine --replicas=3 -n shop',
      what: 'The stateless default. Generator exists.',
      expected: 'deployment.apps/api created',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl create job migrate --image=busybox:1.36 -n shop -- sh -c "echo migrating"',
      what: 'Run-to-completion work. Generator exists.',
      expected: 'job.batch/migrate created',
      placeholders: ['migrate', 'shop'],
    },
    {
      command:
        'kubectl create cronjob nightly --image=busybox:1.36 --schedule="0 2 * * *" -n shop -- sh -c "echo report"',
      what: 'Scheduled work. Generator exists.',
      expected: 'cronjob.batch/nightly created',
      placeholders: ['nightly', 'shop'],
    },
    {
      command: 'kubectl get ds -A',
      what: 'Lists DaemonSets across the cluster. There is no `kubectl create daemonset` generator - write YAML.',
      expected: 'Rows including kube-proxy in kube-system.',
    },
    {
      command: 'kubectl get sts -n shop -o wide',
      what: 'Lists StatefulSets. There is no generator for these either.',
      expected: 'READY 1/1 and the container image.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pvc -n shop',
      what: 'Shows the PVCs a StatefulSet created from its volumeClaimTemplates.',
      expected: 'data-postgres-0 Bound with its capacity.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Answer the decision questions first: does it finish, must it be on every node, does identity or storage per replica matter?',
      'For Deployment / Job / CronJob use a generator plus `--dry-run=client -o yaml` and edit.',
      'For StatefulSet and DaemonSet, start from a Deployment skeleton and change `kind` plus the specific fields (`serviceName` + `volumeClaimTemplates`, or remove `replicas`).',
      'Add the supporting primitives: Service, ConfigMap, Secret, PVC, ServiceAccount, probes, resources.',
    ],
    code: [
      {
        title: 'Turning a generated Deployment into a DaemonSet',
        language: 'bash',
        code: `# There is no DaemonSet generator, so borrow the Deployment one
kubectl create deployment log-shipper --image=busybox:1.36 \\
  --dry-run=client -o yaml > ds.yaml

# Then edit three things:
#   kind: Deployment  ->  kind: DaemonSet
#   delete  spec.replicas
#   delete  spec.strategy (DaemonSets use updateStrategy)
vi ds.yaml
kubectl apply -f ds.yaml
kubectl get ds log-shipper`,
        explanation:
          'This borrow-and-edit trick is much faster than typing a DaemonSet from memory, and it guarantees the selector and template labels already match.',
        placeholders: ['log-shipper'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get deploy,sts,ds,job,cronjob -n shop',
      what: 'One command showing every workload kind in the namespace.',
      expected: 'A section per kind that exists.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get ds log-shipper -n shop -o jsonpath=\'{.status.desiredNumberScheduled}/{.status.numberReady}{"\\n"}\'',
      what: 'Confirms a DaemonSet covers every eligible node.',
      expected: 'A number equal to your eligible node count, twice.',
      placeholders: ['log-shipper', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=postgres -o name',
      what: 'StatefulSet Pod names must be ordinal, not random.',
      expected: 'pod/postgres-0',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe sts postgres -n shop',
      what: 'StatefulSet problems are usually storage: an unbound PVC blocks Pod creation and shows here.',
      expected: 'Events, and a Pods Status line.',
      placeholders: ['postgres', 'shop'],
    },
    {
      command: 'kubectl get pvc -n shop',
      what: 'A Pending PVC means no StorageClass could satisfy it, which keeps the StatefulSet Pod Pending too.',
      expected: 'STATUS Bound. Pending means storage is the problem.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe ds log-shipper -n shop | grep -A5 Events',
      what: 'If a DaemonSet has fewer Pods than nodes, the reason (taints, node selector, resources) is here.',
      expected: 'Warning FailedPlacement or nothing at all.',
      placeholders: ['log-shipper', 'shop'],
    },
    {
      command: 'kubectl apply -f job.yaml',
      what: 'A Job with restartPolicy Always is rejected at apply time.',
      expected: 'Invalid value: "Always": supported values: "OnFailure", "Never"',
      placeholders: ['job.yaml'],
    },
  ],
  commonMistakes: [
    'Running a database in a Deployment. Replicas are interchangeable and may reattach to the wrong volume or none at all.',
    'Running batch work in a Deployment, which restarts the container after every successful exit.',
    'Using a Deployment with N replicas as a substitute for a DaemonSet - Pod placement is not one-per-node.',
    'Forgetting `spec.serviceName` and the headless Service for a StatefulSet, which breaks per-Pod DNS.',
    'Expecting `kubectl delete sts` to remove its PVCs. It does not - that is deliberate, and you must delete them explicitly.',
    'Setting `replicas` on a DaemonSet; the field does not exist and the apply fails.',
    'Setting `restartPolicy: Always` in a Job template.',
  ],
  examTips: [
    'Read the task for the giveaway words: "on every node" → DaemonSet; "every night"/"schedule" → CronJob; "run once"/"until completion" → Job; "stable name"/"own volume" → StatefulSet; otherwise Deployment.',
    'Generators exist for Deployment, Job and CronJob but not for StatefulSet or DaemonSet - borrow a Deployment skeleton and edit `kind`.',
    'For a StatefulSet task, check whether the headless Service already exists before writing one.',
    'If you see PVCs named `<something>-<sts>-0`, a StatefulSet made them; do not hand-create claims for a StatefulSet.',
    'DaemonSet coverage is verified with `desiredNumberScheduled`, not with a replica count.',
  ],
  summary: [
    'Finishes? Job/CronJob. Every node? DaemonSet. Stable identity or per-replica storage? StatefulSet. Otherwise Deployment.',
    'StatefulSet needs `serviceName` plus a headless Service, and creates one retained PVC per Pod.',
    'DaemonSet has no `replicas`; coverage comes from the node count.',
    'Jobs must use `restartPolicy: OnFailure` or `Never`.',
    'All five share the same Pod template, so Pod-level skills transfer everywhere.',
  ],
  practice: [
    {
      id: 'wl-p1',
      level: 'beginner',
      prompt:
        'You need a metrics agent running on every node, including nodes added next week. Which workload resource, and which field do you *not* set?',
      answer:
        'A DaemonSet. You do not set `spec.replicas` - it does not exist for DaemonSets; the node count determines the Pod count.',
      explanation:
        'Add `tolerations` if you also need Pods on tainted control-plane nodes, and a `nodeSelector` if you only want a subset of nodes.',
    },
    {
      id: 'wl-p2',
      level: 'intermediate',
      prompt:
        'A team runs Redis as a Deployment with 3 replicas and a PVC. Name two concrete failures this design causes.',
      answer:
        "1. All three Pods try to mount the same ReadWriteOnce PVC; only the Pod on the volume's node can attach, so the others stay Pending or ContainerCreating.\n2. Replicas have no stable identity or DNS, so a client cannot address a specific member, and a rolling update can start a new Pod before the old one has released the volume - risking data corruption.",
      explanation:
        'A StatefulSet fixes both: `volumeClaimTemplates` gives each Pod its own PVC, and ordinal names plus a headless Service give each Pod stable DNS. Ordered termination also guarantees the old Pod releases its volume before the replacement starts.',
    },
    {
      id: 'wl-p3',
      level: 'advanced',
      prompt:
        'Design (in bullet form, naming every object) a minimal but complete deployment of a stateless API that needs a config file, a database password, a stable in-cluster address, health checks and capacity guarantees.',
      answer:
        '- Deployment (3 replicas) with the Pod template\n- ConfigMap mounted as a volume for the config file\n- Secret referenced via `env[].valueFrom.secretKeyRef` for the password\n- Service (ClusterIP) selecting the Pod labels, giving a stable DNS name\n- readinessProbe (gate traffic) and livenessProbe (restart if wedged) on the container\n- resources.requests and resources.limits for CPU and memory\n- ServiceAccount if the app calls the Kubernetes API, otherwise the default',
      explanation:
        'This is the shape of most CKAD multi-part tasks: one workload plus four or five supporting primitives. Being able to list them from memory means you can plan the task before you start typing.',
    },
  ],
  lab: {
    title: 'One application, four controllers',
    scenario:
      'You will deploy the four-component shop application from this lesson in miniature, and observe the behaviour that makes each controller the right choice.',
    prerequisites: ['A cluster with a default StorageClass (kind and minikube both have one)'],
    tasks: [
      { instruction: 'Create namespace `wl-lab` and set it as default.' },
      { instruction: 'Create a Deployment `api` with 2 replicas of `nginx:1.27-alpine`.' },
      {
        instruction:
          'Create a headless Service and a 1-replica StatefulSet `store` using `nginx:1.27-alpine` with a 1Gi volumeClaimTemplate mounted at /usr/share/nginx/html.',
      },
      {
        instruction:
          'Confirm the StatefulSet Pod is named `store-0` and that a PVC named `data-store-0` exists and is Bound.',
      },
      {
        instruction:
          'Create a DaemonSet `agent` running `busybox:1.36` with `sleep 3600`, and confirm one Pod per node.',
      },
      {
        instruction:
          'Create a CronJob `beat` running every minute that echoes the date; wait for one Job to complete.',
      },
      { instruction: 'Delete the StatefulSet only, and prove the PVC survives.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2',
        language: 'bash',
        code: `kubectl create namespace wl-lab
kubectl config set-context --current --namespace=wl-lab
kubectl create deployment api --image=nginx:1.27-alpine --replicas=2`,
      },
      {
        title: 'Step 3 - headless Service plus StatefulSet',
        language: 'yaml',
        code: `# store.yaml
apiVersion: v1
kind: Service
metadata:
  name: store
  namespace: wl-lab
spec:
  clusterIP: None
  selector:
    app: store
  ports:
    - port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: store
  namespace: wl-lab
spec:
  serviceName: store
  replicas: 1
  selector:
    matchLabels:
      app: store
  template:
    metadata:
      labels:
        app: store
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          volumeMounts:
            - name: data
              mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi`,
      },
      {
        title: 'Step 4 - ordinal name and generated PVC',
        language: 'bash',
        code: `kubectl apply -f store.yaml
kubectl rollout status sts/store --timeout=120s

kubectl get pods -l app=store
# NAME      READY   STATUS    RESTARTS   AGE
# store-0   1/1     Running   0          25s     <- ordinal, not random

kubectl get pvc
# NAME           STATUS   VOLUME    CAPACITY   ACCESS MODES   AGE
# data-store-0   Bound    pvc-...   1Gi        RWO            25s

# Per-Pod DNS provided by the headless Service:
kubectl run dnstest --rm -it --restart=Never --image=busybox:1.36 -- \\
  nslookup store-0.store.wl-lab.svc.cluster.local`,
      },
      {
        title: 'Step 5 - DaemonSet',
        language: 'yaml',
        code: `# agent.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: agent
  namespace: wl-lab
spec:
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:
      containers:
        - name: agent
          image: busybox:1.36
          command: ["sleep", "3600"]
          resources:
            requests:
              cpu: 10m
              memory: 16Mi`,
      },
      {
        title: 'Steps 5b-6 - confirm coverage, add the CronJob',
        language: 'bash',
        code: `kubectl apply -f agent.yaml
kubectl get ds agent
# NAME    DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   AGE
# agent   2         2         2       2            2           15s

kubectl get nodes --no-headers | wc -l    # same number as DESIRED

kubectl create cronjob beat --image=busybox:1.36 --schedule="* * * * *" -- sh -c 'date'
sleep 70
kubectl get jobs
# NAME              STATUS     COMPLETIONS   DURATION   AGE
# beat-29123456     Complete   1/1           3s         10s
kubectl logs job/$(kubectl get jobs -o jsonpath='{.items[0].metadata.name}')`,
      },
      {
        title: 'Steps 7-8 - PVC retention, then cleanup',
        language: 'bash',
        code: `kubectl delete sts store
kubectl get pods -l app=store     # No resources found
kubectl get pvc
# data-store-0   Bound   ...      <- deliberately retained

# Recreating the StatefulSet would reattach this exact volume.
kubectl delete pvc data-store-0

kubectl config set-context --current --namespace=default
kubectl delete namespace wl-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get pods -n wl-lab -o name | sort',
        what: 'Shows the naming difference: random suffixes for the Deployment, ordinals for the StatefulSet, one per node for the DaemonSet.',
        expected: 'api-<hash>-<rand>, store-0, agent-<rand> once per node.',
      },
      {
        command:
          'kubectl get ds agent -n wl-lab -o jsonpath=\'{.status.desiredNumberScheduled}{"\\n"}\'',
        what: 'Confirms DaemonSet sizing comes from the node count.',
        expected: 'Your node count.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace wl-lab',
        what: 'Removes everything except PVs already released.',
        expected: 'namespace "wl-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['deployments-and-replicasets', 'jobs', 'cronjobs', 'persistent-volume-claims'],
  docs: [
    { title: 'Workloads', url: 'https://kubernetes.io/docs/concepts/workloads/' },
    {
      title: 'StatefulSets',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/',
    },
    {
      title: 'DaemonSet',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/',
    },
  ],
}
