import type { Topic } from '../../../types'

export const kubernetesArchitecture: Topic = {
  id: 'kubernetes-architecture',
  title: 'Kubernetes architecture for application developers',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 25,
  order: 1,
  tags: ['architecture', 'control plane', 'kubelet', 'api server', 'scheduler', 'etcd'],
  oneLiner:
    'What actually happens between "kubectl apply" and a running container, and which parts of that you are responsible for as a developer.',
  explanation: [
    'A Kubernetes cluster is a set of machines (called nodes) that run your containers, plus a control plane that decides what should run where. You never start containers by hand. Instead you send Kubernetes a description of what you want, and Kubernetes works continuously to make reality match that description.',
    "The one component you talk to is the API server. Every `kubectl` command, every dashboard, and every controller talks to the same HTTP API. The API server writes the accepted objects into etcd, a key-value store that holds the cluster's desired state.",
    'From there, controllers take over. The Deployment controller sees a Deployment and creates a ReplicaSet. The ReplicaSet controller sees a ReplicaSet and creates Pods. The scheduler notices Pods with no node assigned and picks a node for each. On that node, the kubelet sees a Pod assigned to it, asks the container runtime to pull the image and start the containers, and then reports status back to the API server.',
    'This loop - "observe the desired state, compare it to the actual state, act on the difference" - is called reconciliation, and it is the single most useful mental model for the whole system. It explains why deleting a Pod that belongs to a Deployment simply brings back a replacement.',
  ],
  whyItMatters: [
    'CKAD is a developer exam, but almost every troubleshooting question is really a question about which part of this pipeline stopped. "Pending" means the scheduler could not place the Pod. "ImagePullBackOff" means the kubelet could not fetch the image. "CrashLoopBackOff" means the container started and then exited.',
    'Knowing that controllers keep reconciling explains behaviour that otherwise looks like magic: a Pod you deleted comes back, an edit to a ReplicaSet gets reverted by its Deployment, and a manual change to a Pod created by a Deployment is lost on the next rollout.',
    'It also tells you where to look. If the API server accepted your object (`kubectl get` shows it), your YAML was valid; the problem is downstream, in scheduling, image pulling, or the application itself.',
  ],
  howItWorks: [
    'Control plane components: **kube-apiserver** (the only entry point; validates and stores objects), **etcd** (stores state), **kube-scheduler** (assigns Pods to nodes), and **kube-controller-manager** (runs the built-in controllers such as Deployment, ReplicaSet, Job and endpoints).',
    'Node components: **kubelet** (the agent that starts and monitors containers for Pods assigned to its node and runs the probes you define), **kube-proxy** or an equivalent (programs the node so Service virtual IPs work), and a **container runtime** such as containerd (actually pulls images and runs containers).',
    'Add-ons you rely on as a developer: **CoreDNS** (gives every Service a DNS name), a **CNI plugin** (gives every Pod an IP and enforces NetworkPolicies), and optionally an **Ingress controller** (turns Ingress objects into real HTTP routing).',
    'Flow of one `kubectl apply -f deployment.yaml`: kubectl → API server (authentication → authorization → admission control → validation → write to etcd) → Deployment controller creates a ReplicaSet → ReplicaSet controller creates Pods → scheduler binds each Pod to a node → kubelet on that node pulls the image and starts containers → kubelet reports Pod status → `kubectl get pods` shows Running.',
    'Nothing in that chain is synchronous. `kubectl apply` returning `created` only means the API server stored the object. Everything after that is asynchronous, which is exactly why `kubectl rollout status` and `kubectl get pods -w` exist.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'What lives inside a cluster',
      caption:
        'You only ever talk to the API server. Everything else reacts to what the API server stores.',
      root: {
        label: 'Kubernetes cluster',
        detail: 'One API, many machines',
        children: [
          {
            label: 'Control plane',
            detail: 'Decides what should be running',
            tone: 'accent',
            children: [
              { label: 'kube-apiserver', detail: 'The only door in' },
              { label: 'etcd', detail: 'Stores every object' },
              { label: 'kube-scheduler', detail: 'Picks a node for each Pod' },
              {
                label: 'kube-controller-manager',
                detail: 'Deployment, ReplicaSet, Job, endpoints controllers',
              },
            ],
          },
          {
            label: 'Worker node',
            detail: 'Actually runs your containers',
            children: [
              { label: 'kubelet', detail: 'Starts containers, runs your probes' },
              { label: 'kube-proxy', detail: 'Makes Service IPs work on this node' },
              { label: 'containerd', detail: 'Pulls images, runs containers' },
              {
                label: 'Pod',
                detail: 'Your container(s) plus a shared network namespace',
                tone: 'success',
              },
            ],
          },
          {
            label: 'Add-ons',
            detail: 'Cluster features you depend on as a developer',
            tone: 'muted',
            children: [
              { label: 'CoreDNS', detail: 'DNS name for every Service' },
              { label: 'CNI plugin', detail: 'Pod IPs and NetworkPolicy enforcement' },
              { label: 'Ingress controller', detail: 'Turns Ingress into real HTTP routing' },
            ],
          },
        ],
      },
    },
    {
      kind: 'sequence',
      title: 'What happens during kubectl apply',
      caption:
        'Only step 2 is finished when kubectl prints "created". Everything after it is asynchronous - which is why rollout status exists.',
      participants: [
        { id: 'you', label: 'kubectl' },
        { id: 'api', label: 'API server' },
        { id: 'ctrl', label: 'Controllers' },
        { id: 'node', label: 'kubelet' },
      ],
      messages: [
        { from: 'you', to: 'api', label: 'POST Deployment' },
        { from: 'api', to: 'api', label: 'authn, authz, admission, validate, write etcd' },
        { from: 'api', to: 'you', label: '"deployment created"', kind: 'return' },
        { from: 'api', to: 'ctrl', label: 'watch event' },
        { from: 'ctrl', to: 'api', label: 'create ReplicaSet, then Pods' },
        { from: 'ctrl', to: 'api', label: 'scheduler writes spec.nodeName' },
        { from: 'api', to: 'node', label: 'assigned Pod appears' },
        { from: 'node', to: 'node', label: 'pull image, start container, run probes' },
        { from: 'node', to: 'api', label: 'Pod status: Running', kind: 'return' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose:
        'The smallest thing Kubernetes schedules. One or more containers that share a network namespace (so they share an IP and can talk over localhost) and can share volumes.',
      fields: [
        {
          path: 'spec.containers[]',
          meaning: 'The containers to run. At least one is required.',
          required: true,
        },
        {
          path: 'spec.nodeName',
          meaning:
            'Set by the scheduler when the Pod is bound to a node. Empty means the Pod is still Pending.',
        },
        {
          path: 'status.phase',
          meaning: 'Pending, Running, Succeeded, Failed or Unknown - reported by the kubelet.',
        },
        {
          path: 'status.conditions[]',
          meaning:
            'PodScheduled, Initialized, ContainersReady, Ready - the checkpoints of the startup pipeline.',
        },
      ],
    },
    {
      kind: 'Node',
      apiVersion: 'v1',
      purpose:
        'A machine that can run Pods. You rarely create these, but you read them constantly when diagnosing scheduling problems.',
      fields: [
        {
          path: 'status.allocatable',
          meaning:
            'CPU and memory actually available to Pods, after system reservations. The scheduler compares your requests against this.',
        },
        {
          path: 'status.conditions[]',
          meaning: 'Ready, MemoryPressure, DiskPressure - a NotReady node takes no new Pods.',
        },
        {
          path: 'spec.taints[]',
          meaning: 'Marks the node as repelling Pods that do not tolerate the taint.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Why did my checkout service stay Pending for 40 minutes?',
    story: [
      'A team deploys a `checkout` service that requests 8 CPUs per Pod. The Deployment is created instantly, and the ReplicaSet is created instantly, but the Pods sit in Pending.',
      '`kubectl describe pod` shows a FailedScheduling event: "0/3 nodes are available: 3 Insufficient cpu". Nothing is broken. The scheduler is doing its job and correctly refusing to place a Pod that no node can satisfy.',
      'The fix is a developer fix, not an operations fix: the request was copied from a load-test manifest. Dropping `requests.cpu` to `500m` lets the Pod schedule immediately, and the service runs comfortably.',
      'The architecture knowledge is what made this a two-minute diagnosis: Pending always points at the scheduler, and the scheduler only ever compares requests against allocatable capacity.',
    ],
    code: [
      {
        title: 'The Pod that could not be scheduled',
        language: 'bash',
        code: `kubectl describe pod checkout-7d9f8b6c4-xk2mq -n shop | grep -A5 Events

# Events:
#   Type     Reason            Age   From               Message
#   ----     ------            ----  ----               -------
#   Warning  FailedScheduling  2m    default-scheduler  0/3 nodes are available: 3 Insufficient cpu.`,
        explanation:
          'The event names the component that is stuck (default-scheduler) and the reason (insufficient CPU), which is why describe is always the second command you run.',
        placeholders: ['checkout-7d9f8b6c4-xk2mq', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A minimal Pod, annotated field by field',
      language: 'yaml',
      code: `apiVersion: v1 # which API group/version validates this object
kind: Pod # the resource type
metadata:
  name: web # must be unique within the namespace
  namespace: shop # omit to use your current namespace
  labels:
    app: web # arbitrary key/value used by selectors
spec: # the desired state you are asking for
  containers:
    - name: web # container name, unique within the Pod
      image: nginx:1.27-alpine # pinned tag, never "latest" in an exam answer
      ports:
        - containerPort: 80 # documentation only; does not open a firewall
status: {} # written by Kubernetes, never by you`,
      explanation:
        "Every Kubernetes object has these four top-level keys. apiVersion + kind tell the API server how to validate the object, metadata identifies it, spec is your request, and status is the cluster's answer.",
      placeholders: ['web', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl cluster-info',
      what: 'Shows the API server endpoint your kubectl is talking to, plus core add-ons such as CoreDNS.',
      expected:
        'Two or three lines, the first being "Kubernetes control plane is running at https://...".',
      namespaceNote: 'Cluster-scoped; namespace is irrelevant here.',
    },
    {
      command: 'kubectl get nodes -o wide',
      what: 'Lists the nodes with their status, roles, Kubernetes version, internal IP and container runtime.',
      expected:
        'One row per node with STATUS Ready. The VERSION column tells you the cluster version, which should read v1.35.x for current CKAD practice.',
      namespaceNote: 'Nodes are cluster-scoped, so -n has no effect.',
    },
    {
      command: 'kubectl get pods -n kube-system',
      what: 'Shows the control-plane and add-on Pods (API server, scheduler, CoreDNS, CNI) on clusters that run them as Pods.',
      expected:
        'A list including coredns-*, kube-proxy-* and, on kubeadm clusters, kube-apiserver-*.',
      namespaceNote:
        'kube-system is where cluster components live. You will not modify anything here on CKAD.',
    },
    {
      command: 'kubectl api-resources | head -20',
      what: 'Lists every resource type this cluster understands, with its short name, API group and whether it is namespaced.',
      expected:
        'A table starting with bindings, componentstatuses, configmaps, endpoints, events...',
    },
    {
      command: 'kubectl get events -n shop --sort-by=.lastTimestamp',
      what: 'Shows recent things the cluster did or refused to do in a namespace, oldest first.',
      expected: 'Scheduled / Pulling / Pulled / Created / Started lines for healthy Pods.',
      namespaceNote: 'Events are namespaced. Add --all-namespaces to see the whole cluster.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Write the desired state in a YAML file and keep it in version control.',
      'Apply it with `kubectl apply -f`, which creates the object or updates it to match the file.',
      'Let the controllers reconcile. Watch with `kubectl get pods -w` or `kubectl rollout status`.',
      'Never hand-edit objects that a controller owns - change the file and re-apply, or the controller will overwrite you.',
    ],
    code: [
      {
        title: 'Apply, then observe the reconciliation',
        language: 'bash',
        code: `# 1. Send the desired state to the API server
kubectl apply -f pod.yaml
# pod/web created   <- only means "stored in etcd"

# 2. Watch the asynchronous part happen
kubectl get pod web -n shop -w
# NAME   READY   STATUS              RESTARTS   AGE
# web    0/1     Pending             0          0s
# web    0/1     ContainerCreating   0          1s
# web    1/1     Running             0          4s

# 3. Press Ctrl+C to stop watching`,
        explanation:
          'The three statuses map exactly onto the pipeline: Pending (scheduler has not bound it yet), ContainerCreating (kubelet is pulling the image), Running (containers started).',
        placeholders: ['shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pod web -n shop -o wide',
      what: 'Confirms the Pod is Running and shows which node it landed on and what Pod IP it received.',
      expected: 'STATUS Running, READY 1/1, a NODE name and an IP such as 10.244.1.7.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get pod web -n shop -o jsonpath=\'{.spec.nodeName}{"\\n"}\'',
      what: 'Prints just the node the scheduler chose. An empty result means the Pod is still unscheduled.',
      expected: 'A node name such as worker-2.',
      placeholders: ['web', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod web -n shop',
      what: 'The single most useful debugging command: shows the resolved spec, container statuses, and the events for that Pod.',
      expected: 'An Events section at the bottom naming the component that acted or failed.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get pod web -n shop -o yaml',
      what: 'Shows the full object as stored, including defaults Kubernetes filled in and the live status/conditions.',
      expected: 'status.conditions listing PodScheduled, Initialized, ContainersReady and Ready.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get nodes',
      what: 'Rules out the boring explanation first: a NotReady node cannot accept Pods.',
      expected: 'Every node Ready.',
    },
  ],
  commonMistakes: [
    'Treating `kubectl apply` as if it were synchronous. It only confirms the object was stored; the container may not exist yet.',
    "Editing a Pod that a Deployment created. The next rollout replaces it and your change disappears. Edit the Deployment's Pod template instead.",
    'Assuming a Pending Pod means a broken cluster. Nine times out of ten it is your own resource request, a nodeSelector, or an unbound PersistentVolumeClaim.',
    'Writing a `status:` block in your YAML. Status is written by the cluster; anything you put there is ignored.',
    'Confusing `containerPort` with publishing a port. It is informational - a Service is what makes a Pod reachable.',
  ],
  examTips: [
    'You will not be asked to install a control plane on CKAD - that is CKA. You will be asked to interpret what the control plane is telling you.',
    'Memorise the failure-to-component mapping: Pending → scheduler, ImagePullBackOff → kubelet/registry, CrashLoopBackOff → your application, no Endpoints → Service selector mismatch.',
    '`kubectl describe` before `kubectl logs`. Describe tells you whether the container ever started; logs are useless if it did not.',
    'The exam cluster runs a recent Kubernetes (v1.35 for current practice). Check with `kubectl version --short` if a field looks unfamiliar.',
  ],
  summary: [
    'You declare desired state; controllers reconcile reality towards it, forever.',
    'The API server is the only way in. etcd stores state. The scheduler places Pods. The kubelet runs them.',
    'Pods are the unit of scheduling: shared network namespace, optionally shared volumes.',
    'Every common Pod failure maps cleanly onto one stage of the apply → schedule → pull → start pipeline.',
  ],
  practice: [
    {
      id: 'arch-p1',
      level: 'beginner',
      prompt:
        'A Pod has been in Pending for five minutes. Which cluster component has not finished its job, and which single command will tell you why?',
      answer:
        'The scheduler (kube-scheduler) has not bound the Pod to a node. Run `kubectl describe pod <pod> -n <namespace>` and read the Events section for a FailedScheduling message.',
      explanation:
        'Pending means `spec.nodeName` is still empty. Common causes: insufficient CPU/memory requests, a nodeSelector or affinity rule nothing matches, an unbound PersistentVolumeClaim, or taints without matching tolerations.',
    },
    {
      id: 'arch-p2',
      level: 'intermediate',
      prompt:
        'You delete a Pod named `web-5f7c9d8b6-abcde` that was created by a Deployment. Seconds later a Pod with a similar name appears. Explain precisely which controller did this and why.',
      answer:
        'The ReplicaSet controller. The Deployment owns a ReplicaSet whose `spec.replicas` still says (for example) 3; when the Pod count dropped to 2 the ReplicaSet controller created a replacement to reconcile actual state back to desired state.',
      explanation:
        'To actually remove the Pod you must change the desired state: scale the Deployment to 0, or delete the Deployment. The new Pod keeps the ReplicaSet hash in its name because it is owned by the same ReplicaSet.',
    },
    {
      id: 'arch-p3',
      level: 'advanced',
      prompt:
        'Write a single kubectl command that prints, for every Pod in the `shop` namespace, the Pod name and the node it is scheduled on, in a plain two-column format.',
      answer: "kubectl get pods -n shop -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName'",
      explanation:
        'custom-columns is faster to write than a JSONPath range and is accepted anywhere the exam asks you to "list X with Y". Unscheduled Pods show `<none>` in the NODE column, which instantly identifies Pending Pods.',
      code: {
        title: 'Expected output',
        language: 'text',
        code: `POD                        NODE
checkout-7d9f8b6c4-xk2mq   <none>
web-5f7c9d8b6-abcde        worker-1
web-5f7c9d8b6-fghij        worker-2`,
      },
    },
  ],
  lab: {
    title: 'Trace one Pod through the whole pipeline',
    scenario:
      'You will create a namespace and a Pod, then observe every stage the cluster puts it through - scheduling, image pull, start - and prove which node ran it. Finally you will deliberately break scheduling so you can recognise it instantly in the exam.',
    prerequisites: [
      'A working cluster you can create objects in (kind, minikube, k3d or a lab cluster)',
      'kubectl configured and `kubectl get nodes` returning Ready nodes',
    ],
    tasks: [
      { instruction: 'Create a namespace called `arch-lab` and make it your current namespace.' },
      {
        instruction:
          'Create a Pod named `tracer` running `nginx:1.27-alpine` in that namespace, using a declarative manifest.',
      },
      {
        instruction:
          'Watch the Pod move from Pending to Running, and capture the events it generated.',
        hint: 'kubectl get pod -w in one shell, kubectl describe in another.',
      },
      { instruction: 'Print only the node name the scheduler chose, using JSONPath.' },
      {
        instruction:
          'Create a second Pod named `too-big` that requests 200 CPUs, and confirm it stays Pending with a FailedScheduling event.',
      },
      { instruction: 'Clean up by deleting the namespace.' },
    ],
    solution: [
      {
        title: 'Step 1 - namespace and context',
        language: 'bash',
        code: `kubectl create namespace arch-lab
kubectl config set-context --current --namespace=arch-lab

# Confirm which namespace you are in now
kubectl config view --minify -o jsonpath='{..namespace}{"\\n"}'
# arch-lab`,
      },
      {
        title: 'Step 2 - the Pod manifest',
        language: 'yaml',
        code: `# tracer.yaml
apiVersion: v1
kind: Pod
metadata:
  name: tracer
  namespace: arch-lab
  labels:
    app: tracer
spec:
  containers:
    - name: web
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80`,
      },
      {
        title: 'Step 3 - apply and observe',
        language: 'bash',
        code: `kubectl apply -f tracer.yaml
kubectl get pod tracer -w      # Ctrl+C once it reads 1/1 Running
kubectl describe pod tracer | sed -n '/Events/,$p'

# Expected events, in order:
#   Scheduled  -> default-scheduler assigned arch-lab/tracer to <node>
#   Pulling    -> kubelet pulling image "nginx:1.27-alpine"
#   Pulled     -> image pulled
#   Created    -> kubelet created container web
#   Started    -> kubelet started container web`,
      },
      {
        title: 'Step 4 - which node ran it',
        language: 'bash',
        code: `kubectl get pod tracer -o jsonpath='{.spec.nodeName}{"\\n"}'
# e.g. kind-worker

# Same answer, exam-friendly formatting:
kubectl get pod tracer -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName'`,
      },
      {
        title: 'Step 5 - break the scheduler on purpose',
        language: 'yaml',
        code: `# too-big.yaml
apiVersion: v1
kind: Pod
metadata:
  name: too-big
  namespace: arch-lab
spec:
  containers:
    - name: greedy
      image: nginx:1.27-alpine
      resources:
        requests:
          cpu: "200" # 200 whole cores - no lab node has this`,
      },
      {
        title: 'Step 5b - confirm the failure signature',
        language: 'bash',
        code: `kubectl apply -f too-big.yaml
kubectl get pod too-big
# NAME      READY   STATUS    RESTARTS   AGE
# too-big   0/1     Pending   0          15s

kubectl describe pod too-big | grep -A3 Events
# Warning  FailedScheduling  default-scheduler  0/2 nodes are available: 2 Insufficient cpu.`,
      },
      {
        title: 'Step 6 - clean up',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace arch-lab
# namespace "arch-lab" deleted  (this deletes every object inside it)`,
      },
    ],
    verification: [
      {
        command: 'kubectl get pods -n arch-lab',
        what: 'Shows both Pods so you can compare a healthy Running Pod with a stuck Pending one side by side.',
        expected: 'tracer 1/1 Running, too-big 0/1 Pending.',
      },
      {
        command:
          'kubectl get pod tracer -n arch-lab -o jsonpath=\'{.status.conditions[*].type}{"\\n"}\'',
        what: 'Lists the Pod conditions in order, showing the checkpoints the Pod passed.',
        expected: 'PodReadyToStartContainers Initialized Ready ContainersReady PodScheduled',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace arch-lab',
        what: 'Deletes the namespace and everything in it.',
        expected: 'namespace "arch-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['kubectl-basics', 'pods', 'debugging-pods'],
  docs: [
    {
      title: 'Kubernetes components',
      url: 'https://kubernetes.io/docs/concepts/overview/components/',
    },
    {
      title: 'Pod lifecycle',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/',
    },
  ],
}
