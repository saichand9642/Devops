import type { Topic } from '../../../types'

export const coreObjects: Topic = {
  id: 'core-objects',
  title: 'Cluster, node, namespace, Pod, container, workload',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 20,
  order: 2,
  tags: ['namespace', 'pod', 'container', 'workload', 'node', 'vocabulary'],
  oneLiner:
    'The six words the whole exam is built from, what each one actually contains, and which of them are namespaced.',
  explanation: [
    'A **cluster** is the whole system: a control plane plus one or more nodes. A **node** is a single machine (virtual or physical) that runs your containers.',
    'A **container** is one running process tree from one image. Kubernetes never schedules a bare container - it always wraps it in a **Pod**. A Pod is one or more containers that are guaranteed to run on the same node, share one IP address and one network namespace, and can share volumes. Containers in the same Pod reach each other on `localhost`.',
    'A **namespace** is a name-scoping boundary inside one cluster. Two namespaces can both contain a Deployment called `web` without conflict. Namespaces are also where quotas, limit ranges, ServiceAccounts and RBAC bindings apply, which is why "in namespace X" appears in almost every exam task.',
    'A **workload** is a higher-level object that manages Pods for you: Deployment, ReplicaSet, StatefulSet, DaemonSet, Job and CronJob. You almost never create bare Pods in production - you create a workload, and it creates and replaces Pods on your behalf.',
    'Not everything is namespaced. Nodes, PersistentVolumes, StorageClasses, ClusterRoles, ClusterRoleBindings, IngressClasses and CustomResourceDefinitions are cluster-scoped: they exist once for the whole cluster and `-n` does nothing to them.',
  ],
  whyItMatters: [
    'Exam tasks are phrased in this vocabulary: "create a Deployment named X in namespace Y with 3 replicas". Misreading "Pod" as "Deployment" costs you the whole task even if your YAML is perfect.',
    'Forgetting the namespace is the single most common way to lose marks. Your object gets created in `default`, the grader looks in `production`, and finds nothing.',
    'Knowing what is namespaced tells you when `-n` matters. Running `kubectl get pv -n shop` looks fine and silently ignores the flag, which can mislead you into thinking a namespace is empty.',
  ],
  howItWorks: [
    'Every object lives at a path in the API: namespaced objects at `/api/v1/namespaces/<ns>/pods/<name>`, cluster-scoped ones at `/api/v1/nodes/<name>`. That path is exactly what `kubectl` builds from your flags.',
    'Deleting a namespace deletes every namespaced object inside it. This is the fastest cleanup in the exam and the most dangerous command outside it.',
    'A Pod is immutable in almost every respect once created. You can change `spec.containers[].image`, and Pod-level tolerations and `activeDeadlineSeconds`, but not much else. Everything else requires deleting and recreating - which is precisely why workloads exist.',
    'Containers inside one Pod share the network and IPC namespaces but have separate filesystems, unless you explicitly mount the same volume into both.',
    'Names must be a valid DNS label for most objects: lowercase letters, digits and `-`, up to 63 characters, starting and ending alphanumeric. `My_Pod` is rejected by the API server.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Every object has the same four top-level fields',
      caption:
        'Learn this shape once and every manifest you ever write becomes predictable, whatever the kind.',
      root: {
        label: 'Any Kubernetes object',
        children: [
          {
            label: 'apiVersion',
            detail: 'Which API group and version, e.g. apps/v1',
            tone: 'accent',
          },
          { label: 'kind', detail: 'Which type, e.g. Deployment', tone: 'accent' },
          {
            label: 'metadata',
            detail: 'Identity: name, namespace, labels, annotations',
            children: [
              { label: 'name', detail: 'Unique within the namespace and kind' },
              { label: 'labels', detail: 'How selectors find this object' },
            ],
          },
          {
            label: 'spec',
            detail: 'What YOU want. The only part you write.',
            tone: 'success',
          },
          {
            label: 'status',
            detail: 'What the cluster observes. Never write this.',
            tone: 'muted',
          },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'Which object do I actually need?',
      caption:
        'Almost every CKAD task starts here. Pick the wrong kind and the rest of the task cannot score.',
      question: 'What are you trying to do?',
      branches: [
        {
          condition: 'run a stateless app and update it safely',
          result: 'Deployment',
          detail: 'Owns a ReplicaSet, which owns the Pods',
        },
        {
          condition: 'run work that finishes',
          result: 'Job, or CronJob on a schedule',
          detail: 'restartPolicy must be Never or OnFailure',
        },
        {
          condition: 'give the app a stable address',
          result: 'Service',
          detail: 'Selects Pods by label, not by name',
        },
        {
          condition: 'supply configuration or credentials',
          result: 'ConfigMap or Secret',
          detail: 'Inject as env vars or mount as a volume',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Namespace',
      apiVersion: 'v1',
      purpose: 'Scopes names, quotas and access control inside a single cluster.',
      fields: [
        {
          path: 'metadata.name',
          meaning: 'The namespace name; must be a DNS label.',
          required: true,
        },
        {
          path: 'status.phase',
          meaning: 'Active or Terminating. A Terminating namespace rejects new objects.',
        },
      ],
    },
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose:
        'The scheduling unit: co-located, co-scheduled containers sharing a network identity.',
      fields: [
        {
          path: 'spec.containers[]',
          meaning: 'Long-running containers, started in parallel.',
          required: true,
        },
        {
          path: 'spec.initContainers[]',
          meaning: 'Run to completion, one at a time, before the main containers start.',
        },
        {
          path: 'spec.restartPolicy',
          meaning: 'Always (default), OnFailure, or Never. Deployments require Always.',
        },
        {
          path: 'spec.serviceAccountName',
          meaning: 'Identity the Pod presents to the API server; defaults to "default".',
        },
      ],
    },
    {
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      purpose:
        'The default workload for stateless applications: manages ReplicaSets, which manage Pods, and gives you rolling updates and rollbacks.',
      fields: [
        { path: 'spec.replicas', meaning: 'How many Pods you want. Defaults to 1.' },
        {
          path: 'spec.selector.matchLabels',
          meaning: 'Which Pods this Deployment owns. Immutable after creation.',
          required: true,
        },
        {
          path: 'spec.template',
          meaning: 'The Pod template - a Pod spec without apiVersion/kind.',
          required: true,
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'One cluster, four namespaces, zero name clashes',
    story: [
      'A team runs `dev`, `staging`, `production` and `monitoring` in one cluster. Each of the first three contains a Deployment named `api`, a Service named `api`, and a ConfigMap named `api-config`. Nothing collides because the namespace is part of the identity.',
      'The `monitoring` namespace has a ResourceQuota capping it at 4 CPUs so a runaway dashboard cannot starve production.',
      'When a developer needs a clean slate for a feature branch, they create namespace `dev-feature-checkout`, apply the same manifests, test, and then delete the namespace - which removes every object in one command.',
      'The DNS consequence is what makes it usable: inside `dev`, `curl http://api` resolves to the `dev` Service, while `curl http://api.staging.svc.cluster.local` reaches staging explicitly.',
    ],
    code: [
      {
        title: 'Same manifest, three namespaces',
        language: 'bash',
        code: `for ns in dev staging production; do
  kubectl apply -n "$ns" -f api-deployment.yaml
done

kubectl get deployments --all-namespaces -l app=api
# NAMESPACE    NAME   READY   UP-TO-DATE   AVAILABLE   AGE
# dev          api    1/1     1            1           10s
# production   api    3/3     3            3           10s
# staging      api    1/1     1            1           10s`,
        explanation:
          'The manifest deliberately does not set metadata.namespace, so -n decides where it lands. Hardcoding a namespace in the file makes it unreusable.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Namespace, then a workload inside it, in one file',
      language: 'yaml',
      code: `apiVersion: v1
kind: Namespace
metadata:
  name: shop
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web # must match the template labels below
  template:
    metadata:
      labels:
        app: web # the Pods get this label
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80`,
      explanation:
        'A single file can hold several objects separated by ---. Kubernetes applies them in file order, so the namespace is created before the Deployment that needs it.',
      placeholders: ['shop', 'web'],
    },
    {
      title: 'A Pod with two containers sharing localhost and a volume',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: web-with-logger
  namespace: shop
spec:
  volumes:
    - name: shared-logs
      emptyDir: {} # lives and dies with the Pod
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/nginx
    - name: log-tailer
      image: busybox:1.36
      command: ["/bin/sh", "-c", "tail -F /logs/access.log"]
      volumeMounts:
        - name: shared-logs
          mountPath: /logs # same volume, different path`,
      explanation:
        'Both containers share one Pod IP, so log-tailer could also reach nginx at http://localhost:80. They have separate filesystems except for the volume mounted into both.',
      placeholders: ['shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl create namespace shop',
      what: 'Creates a namespace.',
      expected: 'namespace/shop created',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl run web --image=nginx:1.27-alpine -n shop',
      what: 'Creates a single bare Pod. `kubectl run` creates Pods only - it does not create Deployments.',
      expected: 'pod/web created',
      namespaceNote: 'Without -n the Pod is created in your current namespace.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl create deployment web --image=nginx:1.27-alpine --replicas=3 -n shop',
      what: 'Creates a Deployment (and therefore a ReplicaSet and three Pods).',
      expected: 'deployment.apps/web created',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get all -n shop',
      what: 'Lists the common namespaced workload and service objects in one shot. Useful for a quick survey.',
      expected: 'pod/..., service/..., deployment.apps/..., replicaset.apps/... rows.',
      namespaceNote:
        '"all" is a curated shortlist, not literally everything - ConfigMaps, Secrets and Ingresses are not included.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl api-resources --namespaced=false',
      what: 'Lists exactly which resource types are cluster-scoped, so you know when -n is pointless.',
      expected:
        'Includes namespaces, nodes, persistentvolumes, clusterroles, ingressclasses, customresourcedefinitions.',
    },
  ],
  declarative: {
    steps: [
      'Keep the namespace out of reusable manifests and pass `-n` at apply time, or set it explicitly when a task names it.',
      'Group related objects in one file separated by `---`, ordered so dependencies come first.',
      'Apply a whole directory with `kubectl apply -f ./manifests/` when you have several files.',
      'Use `kubectl apply --dry-run=server` to have the API server validate without persisting.',
    ],
    code: [
      {
        title: 'Apply a directory and verify placement',
        language: 'bash',
        code: `kubectl apply -f ./manifests/ -n shop
# namespace/shop configured
# deployment.apps/web created
# service/web created

# Prove where things landed - the NAMESPACE column is the check that matters
kubectl get deploy,svc -n shop
kubectl get deploy web -n shop -o jsonpath='{.metadata.namespace}{"\\n"}'
# shop`,
        placeholders: ['shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get namespaces',
      what: 'Confirms the namespace exists and is Active.',
      expected: 'A row with STATUS Active.',
    },
    {
      command: 'kubectl get pods -n shop -o wide',
      what: 'Confirms Pods exist in the right namespace and shows their IPs and nodes.',
      expected: 'READY 1/1 and STATUS Running for each Pod.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pod web-with-logger -n shop -o jsonpath=\'{.spec.containers[*].name}{"\\n"}\'',
      what: 'Lists the container names in a multi-container Pod - the quickest way to confirm both containers are defined.',
      expected: 'web log-tailer',
      placeholders: ['web-with-logger', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get pods --all-namespaces | grep web',
      what: 'Finds an object when you are not sure which namespace it ended up in - the classic "it created fine but I cannot see it" case.',
      expected: 'The namespace name in the first column.',
      placeholders: ['web'],
    },
    {
      command: 'kubectl describe namespace shop',
      what: 'Shows any ResourceQuota and LimitRange that applies, which explains rejected Pods.',
      expected: 'A "No resource quota." line, or a quota table with used/hard columns.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl logs web-with-logger -c log-tailer -n shop',
      what: 'In a multi-container Pod you must name the container with -c, otherwise kubectl errors and lists the choices.',
      expected: 'The tailed log output.',
      placeholders: ['web-with-logger', 'log-tailer', 'shop'],
    },
  ],
  commonMistakes: [
    'Creating an object in `default` when the task said a specific namespace. Always pass `-n`, or set your context namespace once at the start.',
    'Believing `kubectl run` creates a Deployment. It creates a Pod. Use `kubectl create deployment` for a Deployment.',
    'Using `_` or capitals in names. Object names must be lowercase DNS labels.',
    'Assuming `kubectl get all` shows everything. It omits ConfigMaps, Secrets, Ingresses, PVCs, ServiceAccounts and CRs.',
    "Trying to change a Deployment's `spec.selector` after creation. It is immutable; you must delete and recreate.",
    "Forgetting that a Pod's template labels must satisfy the workload selector, or the API server rejects the object.",
  ],
  examTips: [
    'Read the task twice for two things: the exact object kind, and the namespace. They are the two most commonly missed requirements.',
    'Set your namespace once per task with `kubectl config set-context --current --namespace=<ns>` instead of typing `-n` forty times.',
    'When a task says "create a Pod", a Deployment is wrong even though it also produces a Pod, and vice versa.',
    '`kubectl delete namespace <ns>` is the fastest way to clean up your own scratch work between practice attempts.',
  ],
  summary: [
    'Cluster → nodes → Pods → containers. Namespaces scope names and policy inside one cluster.',
    'Pods are co-scheduled containers sharing an IP and optionally volumes; containers in a Pod talk over localhost.',
    'Workloads (Deployment, Job, CronJob, DaemonSet, StatefulSet) create and replace Pods for you.',
    'Nodes, PVs, StorageClasses, ClusterRoles, IngressClasses and CRDs are cluster-scoped - `-n` is ignored for them.',
  ],
  practice: [
    {
      id: 'core-p1',
      level: 'beginner',
      prompt:
        'Two containers are in the same Pod. Container A listens on port 8080. What URL does container B use to reach it, and why?',
      answer:
        '`http://localhost:8080`. Containers in one Pod share a single network namespace and therefore a single IP and loopback interface.',
      explanation:
        'This is why the sidecar and ambassador patterns work without any Service. Containers in *different* Pods must go through a Service or the Pod IP instead.',
    },
    {
      id: 'core-p2',
      level: 'intermediate',
      prompt:
        'You run `kubectl get pv -n shop` and see PersistentVolumes you did not expect in that namespace. What is going on?',
      answer:
        'PersistentVolumes are cluster-scoped, so `-n shop` is silently ignored. You are seeing every PV in the cluster.',
      explanation:
        'Confirm with `kubectl api-resources --namespaced=false | grep persistentvolume`. PersistentVolumeClaims, by contrast, *are* namespaced.',
    },
    {
      id: 'core-p3',
      level: 'advanced',
      prompt:
        'Write the imperative command that creates a Deployment named `api` in namespace `production` with 4 replicas from image `nginx:1.27-alpine`, and then the command that proves the replica count without opening an editor.',
      answer:
        'kubectl create deployment api --image=nginx:1.27-alpine --replicas=4 -n production\nkubectl get deploy api -n production -o jsonpath=\'{.spec.replicas}{"\\n"}\'',
      explanation:
        '`--replicas` on `kubectl create deployment` saves an edit step. The JSONPath check reads desired replicas; `kubectl get deploy api -n production` shows READY 4/4 once the Pods are up.',
    },
  ],
  lab: {
    title: 'Namespaces, scoping and a two-container Pod',
    scenario:
      'You will prove to yourself which objects are namespaced, create the same workload twice without a name clash, and build a Pod whose two containers share a volume and a network namespace.',
    prerequisites: ['A cluster you can create namespaces in'],
    tasks: [
      { instruction: 'Create namespaces `blue` and `green`.' },
      {
        instruction:
          'Create a Deployment named `web` with 1 replica of `nginx:1.27-alpine` in each namespace, using the same command apart from `-n`.',
      },
      { instruction: 'List both Deployments in one command, showing the namespace column.' },
      {
        instruction:
          'Create a Pod named `pair` in `blue` with two containers that share an emptyDir volume; the second container must write a file the first can read.',
      },
      { instruction: 'Prove the file written by container two is visible from container one.' },
      { instruction: 'Prove that `kubectl get nodes -n blue` ignores the namespace flag.' },
      { instruction: 'Delete both namespaces.' },
    ],
    solution: [
      {
        title: 'Step 1-3 - two namespaces, same object name',
        language: 'bash',
        code: `kubectl create namespace blue
kubectl create namespace green

kubectl create deployment web --image=nginx:1.27-alpine --replicas=1 -n blue
kubectl create deployment web --image=nginx:1.27-alpine --replicas=1 -n green

kubectl get deploy -A -l app=web
# NAMESPACE   NAME   READY   UP-TO-DATE   AVAILABLE   AGE
# blue        web    1/1     1            1           8s
# green       web    1/1     1            1           6s
# (-A is short for --all-namespaces)`,
      },
      {
        title: 'Step 4 - the shared-volume Pod',
        language: 'yaml',
        code: `# pair.yaml
apiVersion: v1
kind: Pod
metadata:
  name: pair
  namespace: blue
spec:
  volumes:
    - name: shared
      emptyDir: {}
  containers:
    - name: reader
      image: busybox:1.36
      command: ["/bin/sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: shared
          mountPath: /data
    - name: writer
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - "echo 'written by writer' > /out/note.txt && sleep 3600"
      volumeMounts:
        - name: shared
          mountPath: /out`,
      },
      {
        title: 'Step 5 - prove the sharing',
        language: 'bash',
        code: `kubectl apply -f pair.yaml
kubectl wait --for=condition=Ready pod/pair -n blue --timeout=60s

# Read, from the *reader* container, a file the *writer* container created
kubectl exec pair -n blue -c reader -- cat /data/note.txt
# written by writer

# Both containers share one IP:
kubectl get pod pair -n blue -o jsonpath='{.status.podIP}{"\\n"}'`,
      },
      {
        title: 'Step 6-7 - scope proof and cleanup',
        language: 'bash',
        code: `# The -n flag is accepted and ignored for cluster-scoped resources
kubectl get nodes -n blue
kubectl get nodes -n green
# Both print the identical node list

kubectl api-resources --namespaced=false | grep -E '^nodes|^namespaces|^persistentvolumes'

kubectl delete namespace blue green
# namespace "blue" deleted
# namespace "green" deleted`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec pair -n blue -c reader -- cat /data/note.txt',
        what: 'Confirms the emptyDir volume is genuinely shared between the two containers.',
        expected: 'written by writer',
      },
      {
        command:
          'kubectl get pod pair -n blue -o jsonpath=\'{range .spec.containers[*]}{.name}{"\\n"}{end}\'',
        what: 'Lists both container names, confirming the Pod really has two containers.',
        expected: 'reader\nwriter',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace blue green',
        what: 'Removes both namespaces and everything inside them.',
        expected: 'Two "deleted" lines.',
      },
    ],
  },
  relatedTopicIds: [
    'kubernetes-architecture',
    'contexts-and-namespaces',
    'multi-container-patterns',
  ],
  docs: [
    {
      title: 'Namespaces',
      url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/',
    },
    { title: 'Pods', url: 'https://kubernetes.io/docs/concepts/workloads/pods/' },
  ],
}
