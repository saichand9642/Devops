import type { InterviewTopic } from '../../types'

export const kubernetesTopic: InterviewTopic = {
  id: 'kubernetes',
  title: 'Kubernetes',
  shortTitle: 'Kubernetes',
  icon: '☸️',
  order: 2,
  oneLiner:
    'Pods, controllers, Services, probes, scheduling and the troubleshooting rounds that decide the interview.',
  headlines: [
    'Everything is a controller running a reconcile loop: observe the desired state, compare with reality, act, repeat.',
    'You never talk to anything but the API server. Every other component watches it.',
    'Deployment owns a ReplicaSet, which owns Pods. That chain is why rollback is instant.',
    'A Service finds Pods by **label selector**, never by name. No match means no endpoints and no traffic.',
    'Readiness controls traffic; liveness controls restarts. Confusing them causes outages.',
    'Requests decide scheduling; limits decide throttling and OOM kills.',
  ],
  questions: [
    {
      id: 'itv-k8s-1',
      level: 'basic',
      kind: 'open',
      prompt: 'What is Kubernetes and what problem does it solve?',
      probing:
        'Whether you can explain the value proposition without reciting a feature list. They want "declarative desired state" and "self-healing".',
      answer: [
        'Kubernetes is a container orchestrator. You give it a **declarative** description of what you want running - how many replicas, which image, how much memory - and it continuously works to make reality match.',
        'The problem it solves is everything around running containers at scale: scheduling them onto machines with capacity, restarting them when they fail, replacing them when a node dies, rolling out new versions without downtime, giving them stable network addresses, and injecting configuration and secrets.',
        'The important word is **continuously**. You do not tell Kubernetes to start three replicas; you tell it that three replicas should exist. If one dies at 3am, a controller notices the gap and creates another without anyone being paged.',
        'You could do all of this with scripts. The difference is that scripts describe steps and have to handle every failure case you thought of, whereas Kubernetes describes an end state and keeps converging on it.',
      ],
      deeper: [
        'The trade-off is real complexity. For three containers on one host, Docker Compose is the right answer and Kubernetes is overhead. It starts paying for itself when you have multiple machines, need zero-downtime deploys, or have more services than people.',
      ],
      traps: [
        'Listing features ("it does load balancing, scaling, secrets...") instead of naming the model. The declarative reconcile loop is the answer.',
        'Saying Kubernetes runs containers. The **kubelet** and a container runtime run containers; Kubernetes decides what should run where.',
      ],
      followUps: [
        'When would you NOT use Kubernetes?',
        'What does "declarative" mean here, concretely?',
      ],
      tags: ['fundamentals', 'concepts'],
    },
    {
      id: 'itv-k8s-2',
      level: 'basic',
      kind: 'open',
      prompt: 'Walk me through what happens when you run `kubectl apply -f deployment.yaml`.',
      probing:
        'The single best question for separating people who have used Kubernetes from people who understand it. They want the control-plane chain.',
      answer: [
        '`kubectl` sends the manifest to the **API server** over HTTPS. The API server authenticates you, authorises the request against RBAC, runs it through admission controllers, validates the object, and writes it to **etcd**. At that point `kubectl` prints "created" and returns.',
        'Everything after that is **asynchronous**. The **Deployment controller** is watching for Deployments; it sees the new one and creates a **ReplicaSet**. The **ReplicaSet controller** sees that and creates the Pods.',
        'The Pods now exist but have no node. The **scheduler** is watching for unscheduled Pods; it filters nodes that could take the Pod - enough CPU and memory, tolerations matching taints, affinity rules satisfied - scores the survivors, and writes its choice into the Pod.',
        'The **kubelet** on that node is watching for Pods assigned to it. It pulls the image, asks the container runtime to start the containers, runs the probes, and reports status back to the API server. Only then does `kubectl get pods` show Running.',
      ],
      deeper: [
        'The reason nothing talks to anything else directly is that every component **watches the API server**. The scheduler does not know the Deployment controller exists. This is what makes the system extensible - a custom controller is just another watcher.',
        'This chain is also why `kubectl apply` returning successfully tells you almost nothing about whether your app works. It means the object was stored. `kubectl rollout status` is what tells you the Pods are actually ready.',
      ],
      diagrams: [
        {
          kind: 'sequence',
          title: 'From kubectl to a running container',
          caption:
            'Only the first step is synchronous. Everything else is controllers reacting to what they see in the API server.',
          participants: [
            { id: 'cli', label: 'kubectl' },
            { id: 'api', label: 'API server' },
            { id: 'ctrl', label: 'Controllers' },
            { id: 'kubelet', label: 'kubelet' },
          ],
          messages: [
            { from: 'cli', to: 'api', label: 'POST the Deployment' },
            { from: 'api', to: 'api', label: 'authn, authz, admission, write etcd' },
            { from: 'api', to: 'cli', label: 'deployment created', kind: 'return' },
            { from: 'api', to: 'ctrl', label: 'watch event: new Deployment' },
            { from: 'ctrl', to: 'api', label: 'create ReplicaSet, then Pods' },
            { from: 'ctrl', to: 'api', label: 'scheduler writes spec.nodeName' },
            { from: 'api', to: 'kubelet', label: 'a Pod is assigned to you' },
            { from: 'kubelet', to: 'kubelet', label: 'pull image, start, run probes' },
            { from: 'kubelet', to: 'api', label: 'status: Running and Ready', kind: 'return' },
          ],
        },
      ],
      traps: [
        'Saying kubectl talks to the scheduler or the kubelet. It only ever talks to the API server.',
        'Thinking "created" means running. It means stored in etcd.',
      ],
      followUps: [
        'Which component decides which node a Pod goes on?',
        'What if no node has capacity?',
        'How would you watch that whole process happen?',
      ],
      tags: ['architecture', 'control plane', 'scheduling'],
    },
    {
      id: 'itv-k8s-3',
      level: 'basic',
      kind: 'mcq',
      prompt: 'How does a Service decide which Pods to send traffic to?',
      options: [
        { id: 'a', text: 'By the Pod names listed in the Service spec' },
        { id: 'b', text: 'By matching the Service selector against Pod labels' },
        { id: 'c', text: 'By the Deployment that created the Pods' },
        { id: 'd', text: 'By namespace - all Pods in the same namespace' },
      ],
      correct: ['b'],
      probing:
        'Label selectors are the glue of the entire system. Getting this wrong means you cannot debug a broken Service.',
      answer: [
        'A Service has a `spec.selector` - a set of label key/value pairs. The endpoints controller continuously looks for Pods **in the same namespace** whose labels match, and whose status is **Ready**.',
        'Nothing is wired by name. The Service does not know about the Deployment, and the Deployment does not know about the Service. They are connected only because both refer to the same labels.',
        'This is why the first command when a Service is not working is `kubectl get endpoints <service>`. If it shows `<none>`, either no Pod matches the selector or no matching Pod is Ready - and those are two very different fixes.',
      ],
      deeper: [
        'Readiness matters as much as the label match. A Pod that matches the selector but is failing its readiness probe is deliberately excluded, which is exactly the mechanism that keeps traffic off a starting or unhealthy Pod.',
        'A Service can also have no selector at all, in which case you manage the EndpointSlice yourself - that is how you point a Service at a database outside the cluster.',
      ],
      traps: [
        'Assuming the Deployment connects them. Delete the Deployment and recreate the Pods by hand with the right labels, and the Service still finds them.',
        'Forgetting namespaces. A Service only ever selects Pods in its own namespace.',
      ],
      followUps: [
        'The Service has no endpoints. What are the two possible causes?',
        'How would you point a Service at something outside the cluster?',
      ],
      tags: ['services', 'labels', 'networking'],
    },
    {
      id: 'itv-k8s-4',
      level: 'basic',
      kind: 'open',
      prompt: 'Explain the difference between a Deployment, a ReplicaSet and a Pod.',
      probing:
        'The ownership chain. It explains rollback, scaling and why deleting a Pod does not work.',
      answer: [
        'A **Pod** is the smallest deployable unit: one or more containers that share a network namespace and storage, scheduled together onto one node.',
        'A **ReplicaSet** keeps a specified number of identical Pods running. If one is deleted or its node dies, the ReplicaSet creates a replacement.',
        'A **Deployment** manages ReplicaSets and gives you rollouts. When you change the Pod template, the Deployment creates a **new** ReplicaSet and gradually scales it up while scaling the old one down.',
        'The old ReplicaSet is kept at zero replicas rather than deleted - which is exactly why `kubectl rollout undo` is instant. It just scales the previous ReplicaSet back up.',
        'In practice you write Deployments and almost never write a ReplicaSet directly.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'The ownership chain',
          caption:
            'You edit the top box. Everything below is created for you - which is why deleting a Pod by hand never sticks.',
          root: {
            label: 'Deployment: web',
            detail: 'Holds the Pod template and the rollout strategy',
            tone: 'accent',
            children: [
              {
                label: 'ReplicaSet web-7c9f (revision 1)',
                detail: 'Scaled to 0, kept for rollback',
                tone: 'muted',
              },
              {
                label: 'ReplicaSet web-84bd (revision 2)',
                detail: 'One ReplicaSet per distinct Pod template',
                children: [
                  { label: 'Pod web-84bd-a1b2', detail: 'Recreated if deleted' },
                  { label: 'Pod web-84bd-c3d4', detail: 'Recreated if deleted' },
                  { label: 'Pod web-84bd-e5f6', detail: 'Recreated if deleted' },
                ],
              },
            ],
          },
        },
      ],
      traps: [
        'Deleting a Pod to "restart the app". The ReplicaSet immediately recreates it - use `kubectl rollout restart deployment/x` instead.',
        'Saying a Deployment creates Pods. It creates a ReplicaSet; the ReplicaSet creates Pods.',
      ],
      followUps: [
        'Why is rollback instant?',
        'What happens if you edit the Pod template - how many ReplicaSets exist afterwards?',
        'How do you restart all Pods of a Deployment properly?',
      ],
      tags: ['workloads', 'deployments', 'replicasets'],
    },
    {
      id: 'itv-k8s-5',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain liveness, readiness and startup probes. When do you use each?',
      probing:
        'The classic. Confusing readiness with liveness is a real production outage, and interviewers know it.',
      answer: [
        'A **readiness** probe answers "may this Pod receive traffic?". When it fails, the Pod is removed from the Service endpoints. The container is **not** restarted - it just stops getting requests until it recovers.',
        'A **liveness** probe answers "is this process still healthy?". When it fails, the kubelet **kills and restarts the container**. This is for unrecoverable states like a deadlock.',
        'A **startup** probe answers "has it finished booting?". While it is running, liveness and readiness are suspended. It exists for slow-starting applications so you do not need a huge `initialDelaySeconds` on liveness.',
        'The rule of thumb: if you are not sure, use **readiness only**. A wrong readiness probe takes a Pod out of rotation, which is recoverable. A wrong liveness probe restarts a healthy container in a loop, which turns a small problem into an outage.',
      ],
      deeper: [
        'The classic outage is a liveness probe that checks a **dependency**. If the probe hits an endpoint that queries the database, then when the database has a blip every Pod fails liveness simultaneously, every Pod restarts, and you have turned a degraded service into a total one. Liveness should only check the process itself.',
        'Readiness is also the gate for rolling updates: the Deployment will not proceed to the next Pod until the new one is Ready. So a broken readiness probe does not cause an outage, it stalls the rollout - which is the safe failure mode.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'What each probe does when it fails',
          caption:
            'Readiness removes traffic. Liveness restarts the container. That difference is the whole question.',
          nodes: [
            { label: 'Container starts', detail: 'Process is running' },
            {
              label: 'startupProbe runs alone',
              detail: 'Liveness and readiness are suspended',
              tone: 'accent',
              branch: {
                label: 'Fails past its threshold',
                detail: 'Container is killed and restarted - it booted too slowly',
              },
            },
            {
              label: 'livenessProbe begins',
              detail: 'Is the process still healthy?',
              arrowLabel: 'startup succeeded',
              branch: {
                label: 'Liveness fails',
                detail: 'Container RESTARTED. RESTARTS climbs, crash loop follows.',
              },
            },
            {
              label: 'readinessProbe begins',
              detail: 'May it receive traffic yet?',
              branch: {
                label: 'Readiness fails',
                detail: 'Removed from Endpoints. NOT restarted. READY shows 0/1.',
              },
            },
            {
              label: 'Ready and serving',
              detail: 'Both probes keep running for the life of the container',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'All three, with sensible values',
          language: 'yaml',
          explanation:
            'Note the liveness endpoint checks only the process. The readiness endpoint is allowed to check dependencies, because failing it is safe.',
          code: `containers:
  - name: api
    image: registry.example.com/api:1.4.2
    ports:
      - containerPort: 8080

    # Boots slowly? Buy it time here, not with a huge liveness delay.
    startupProbe:
      httpGet: { path: /healthz, port: 8080 }
      periodSeconds: 5
      failureThreshold: 30        # allows up to 150s to start

    # Process health ONLY. No database, no downstream services.
    livenessProbe:
      httpGet: { path: /healthz, port: 8080 }
      periodSeconds: 10
      failureThreshold: 3

    # May check dependencies - failing this is safe.
    readinessProbe:
      httpGet: { path: /ready, port: 8080 }
      periodSeconds: 5
      failureThreshold: 3`,
        },
      ],
      traps: [
        'Pointing liveness at an endpoint that checks the database. A database blip then restarts every Pod at once.',
        'Using the same path for liveness and readiness. They answer different questions and should usually differ.',
        'Setting `initialDelaySeconds` to a huge value on liveness instead of using a startup probe.',
      ],
      followUps: [
        'What happens to a rolling update if the new Pods never become Ready?',
        'Why should liveness not check dependencies?',
        'Which probe failing would you rather have in production?',
      ],
      tags: ['probes', 'reliability', 'production'],
    },
    {
      id: 'itv-k8s-6',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain resource requests and limits, and what QoS class means.',
      probing:
        'Whether you understand scheduling versus enforcement. This drives real cost and reliability decisions.',
      answer: [
        '**Requests** are what the scheduler uses. It adds up the requests of all Pods on a node and will only place your Pod where the requested amount is still unreserved. Requests are a reservation, not a cap.',
        '**Limits** are enforced at runtime by the kernel via cgroups. CPU over the limit is **throttled** - the container just runs slower. Memory over the limit is **killed** - the container is OOMKilled with exit code 137 and restarted.',
        'That asymmetry matters: CPU is compressible, memory is not. You can usually be relaxed about CPU limits and must be careful about memory ones.',
        '**QoS class** is derived, not set. If every container has requests equal to limits, the Pod is **Guaranteed**. If requests are set but lower than limits, it is **Burstable**. If nothing is set, it is **BestEffort**. Under node memory pressure the kubelet evicts BestEffort first, then Burstable, then Guaranteed.',
      ],
      deeper: [
        'A common production stance is: always set memory request = memory limit (so you are Guaranteed on memory and cannot be surprised), set a CPU request, and **omit the CPU limit** - because CPU throttling causes latency spikes that are hard to diagnose, and the request already guarantees your share.',
        'If a Pod is Pending with "Insufficient cpu", that is about **requests**, not actual usage. A cluster can be 20% utilised and still unable to schedule anything if everyone over-requests.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Which QoS class did you just create?',
          caption:
            'You never set QoS directly. It follows from how requests and limits compare, and it decides eviction order.',
          question: 'How do requests compare with limits?',
          branches: [
            {
              condition: 'set, and equal, on every container',
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
      code: [
        {
          title: 'A defensible production setting',
          language: 'yaml',
          code: `resources:
  requests:
    cpu: 100m         # 0.1 of a core, guaranteed share
    memory: 256Mi
  limits:
    # No CPU limit on purpose: throttling causes latency spikes,
    # and the request already guarantees a share.
    memory: 256Mi     # equal to the request - no surprise OOM headroom`,
        },
      ],
      traps: [
        'Saying limits are used for scheduling. Only requests are.',
        'Setting a memory limit far above the request and being surprised when the Pod is OOMKilled on a busy node - the extra was never guaranteed.',
        'Thinking QoS is a field you set.',
      ],
      followUps: [
        'A Pod is Pending with "Insufficient memory" but the node looks idle. Explain.',
        'Why might you deliberately omit a CPU limit?',
        'What exit code do you see on an OOM kill?',
      ],
      tags: ['resources', 'scheduling', 'qos', 'production'],
    },
    {
      id: 'itv-k8s-7',
      level: 'intermediate',
      kind: 'mcq',
      prompt: 'A Pod is stuck in `Pending`. Which is the LEAST likely cause?',
      options: [
        { id: 'a', text: 'No node has enough unreserved CPU or memory for its requests' },
        { id: 'b', text: 'Its PersistentVolumeClaim is not yet Bound' },
        { id: 'c', text: 'The application inside the container is crashing on startup' },
        { id: 'd', text: 'Node taints that the Pod does not tolerate' },
      ],
      correct: ['c'],
      probing:
        'Whether you know that Pending means "not yet scheduled or not yet started", so the application has not run at all.',
      answer: [
        '`Pending` means the Pod has been accepted by the cluster but is **not yet running** - it has either not been scheduled to a node, or it has been scheduled and the kubelet has not started the containers yet.',
        'A crashing application cannot be the cause, because the application has not started. That state would show as `CrashLoopBackOff` or `Error`, not `Pending`.',
        'The real causes are all pre-start: insufficient resources for the requests, taints without matching tolerations, node affinity or selectors that match nothing, an unbound PVC, or the image still pulling (which shows as Pending briefly, then `ContainerCreating`).',
        '`kubectl describe pod` is the command - the **Events** section at the bottom names the reason directly, usually `FailedScheduling` with a per-node explanation.',
      ],
      code: [
        {
          title: 'Diagnosing Pending',
          language: 'bash',
          code: `kubectl describe pod <pod> | tail -20
# Events:
#   Warning  FailedScheduling  0/5 nodes are available:
#     3 Insufficient cpu,
#     1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane},
#     1 node(s) had volume node affinity conflict.

kubectl get pvc                 # is the claim Bound?
kubectl describe node <node> | grep -A 6 "Allocated resources"
kubectl get nodes -o json | jq '.items[].spec.taints'`,
        },
      ],
      traps: [
        'Reaching for `kubectl logs` on a Pending Pod. There are no logs - no container has started.',
      ],
      followUps: [
        'What is the very first command you run?',
        'How do you tell "no capacity" from "no node matches the selector"?',
      ],
      tags: ['troubleshooting', 'scheduling', 'pending'],
    },
    {
      id: 'itv-k8s-8',
      level: 'intermediate',
      kind: 'open',
      prompt: 'What are the Service types and when would you use each?',
      probing: 'Everyday knowledge. They also want to hear that the types build on one another.',
      answer: [
        '**ClusterIP** is the default: a virtual IP reachable only inside the cluster, plus a DNS name. This is what you use for service-to-service traffic.',
        '**NodePort** opens the same port (30000-32767 by default) on **every** node and forwards it to the Service. It is mostly a building block, and a blunt instrument for real external traffic.',
        '**LoadBalancer** asks the cloud provider for a real load balancer pointing at the NodePort. This is how you expose a service to the internet on a managed cluster. On a bare local cluster it stays `Pending` forever because nothing provisions it.',
        '**ExternalName** is different in kind - it is just a CNAME in cluster DNS pointing at an external hostname. No proxying, no selector, no endpoints.',
        'The important detail is that each type **includes** the previous one. A LoadBalancer Service still has a NodePort and still has a ClusterIP, which is why you can still reach it internally by DNS.',
      ],
      deeper: [
        'For HTTP you usually do not want one LoadBalancer per service - that is one cloud load balancer and one bill each. An **Ingress** (or Gateway API) gives you one entry point that routes by host and path to many ClusterIP Services.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'Each type includes the ones before it',
          caption:
            'This is why a LoadBalancer Service still resolves internally by DNS - the ClusterIP never goes away.',
          root: {
            label: 'type: LoadBalancer',
            detail: 'Cloud load balancer with an external IP',
            children: [
              {
                label: 'type: NodePort',
                detail: 'A high port on every node',
                tone: 'accent',
                children: [
                  {
                    label: 'type: ClusterIP',
                    detail: 'Virtual IP plus DNS. Always present.',
                    tone: 'success',
                    children: [
                      { label: 'Endpoints', detail: 'IPs of Ready Pods matching the selector' },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      traps: [
        'Using NodePort for production external traffic. You are then responsible for load balancing across nodes yourself.',
        'Expecting LoadBalancer to work on kind or minikube without something like MetalLB.',
      ],
      followUps: [
        'How would you expose twenty HTTP services without twenty load balancers?',
        'Why is my LoadBalancer stuck in Pending?',
      ],
      tags: ['services', 'networking', 'ingress'],
    },
    {
      id: 'itv-k8s-9',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do ConfigMaps and Secrets work, and what is the difference?',
      probing:
        'Whether you know Secrets are only base64-encoded, and whether you know the env-versus-volume update behaviour.',
      answer: [
        'Both hold key/value configuration data and both can be injected into a Pod as **environment variables** or mounted as **files in a volume**.',
        'The practical difference is small and often overstated. A Secret is **base64-encoded, not encrypted** - anyone who can read the Secret can read the value. What Secrets do give you is a separate RBAC surface (so you can grant access to ConfigMaps but not Secrets), the ability to enable encryption at rest in etcd, and the fact that values are not printed in `kubectl describe`.',
        'The behavioural difference that matters most in practice is how updates propagate. A value mounted as a **file** is updated in place by the kubelet within a minute or two. A value injected as an **environment variable** is fixed when the container starts and never changes.',
        'So if you want configuration changes to be picked up without a redeploy, mount a volume and have the app watch the file. If you want a restart on change - which is often clearer - use env vars and trigger a rollout.',
      ],
      deeper: [
        'A common technique is to put a hash of the ConfigMap into a Pod template annotation. Changing the ConfigMap then changes the Pod template, which triggers a normal rolling update. Helm charts do this with `checksum/config`.',
        'For real secret management most teams do not store secrets in Kubernetes at all - they use External Secrets Operator or the Secrets Store CSI driver to pull from Vault, AWS Secrets Manager or similar at Pod start.',
      ],
      code: [
        {
          title: 'Four ways in',
          language: 'yaml',
          code: `env:
  # One key, renamed
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef: { name: app-config, key: log.level }
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef: { name: db-creds, key: password }

# Every key as an env var
envFrom:
  - configMapRef: { name: app-config }

# As files - this is the form that updates without a restart
volumeMounts:
  - name: config
    mountPath: /etc/app
    readOnly: true
volumes:
  - name: config
    configMap:
      name: app-config`,
        },
      ],
      traps: [
        'Calling Secrets "encrypted". They are base64-encoded; encryption at rest is a separate cluster setting you must enable.',
        'Expecting an env var to update when the ConfigMap changes. It never does.',
        'Mounting a ConfigMap over a directory that already has files - the mount hides them. Use `subPath` to add a single file.',
      ],
      followUps: [
        'How do you make a Deployment restart when its ConfigMap changes?',
        'Are Secrets encrypted? What would you do for real secret management?',
      ],
      tags: ['configuration', 'secrets', 'configmaps'],
    },
    {
      id: 'itv-k8s-10',
      level: 'advanced',
      kind: 'scenario',
      prompt: 'A Pod is in CrashLoopBackOff. Walk me through your debugging, step by step.',
      probing:
        'The single most common scenario question. They want a repeatable method, not a guess.',
      answer: [
        'CrashLoopBackOff means the container starts, exits, and the kubelet is restarting it with an increasing backoff. So the container **is** starting - this is not a scheduling problem.',
        'First, `kubectl describe pod`. I read the **Events** at the bottom and the container **State** and **Last State** blocks. Last State gives me the exit code and reason, which often settles it immediately: 137 with `OOMKilled` is a memory limit, 127 is a command not found, 1 or 2 is an application error.',
        'Second, `kubectl logs <pod> --previous`. The `--previous` flag is the important part - the current container may have only just started, so the useful output is in the one that already died.',
        'Third, if the logs are empty, I check whether the container is even running the right thing: a wrong `command`/`args`, a missing config file, or a missing environment variable. `kubectl get pod -o yaml` shows exactly what was injected.',
        'Fourth, if I still cannot tell, I reproduce it interactively - override the command with something long-running so the container stays up, then exec in and run the real command by hand to see the error directly.',
      ],
      deeper: [
        'A liveness probe can also cause a crash loop, and it looks identical from the outside. If `describe` shows `Unhealthy` events and the RESTARTS count climbing on a schedule matching the probe period, the application may be fine and the probe wrong.',
        'For a container with no shell - distroless - `kubectl debug` attaches an ephemeral container with a full toolkit sharing the same namespaces, which is how you inspect it without changing the image.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'The CrashLoopBackOff routine',
          caption: 'Each step answers a different question. Most cases are settled by step two.',
          nodes: [
            {
              label: 'kubectl describe pod',
              detail: 'Events, plus State and Last State with the exit code',
              tone: 'accent',
              branch: {
                label: 'Exit 137 + OOMKilled',
                detail: 'Memory limit. Raise it, or fix the memory use.',
              },
            },
            {
              label: 'kubectl logs --previous',
              detail: 'The container that actually died',
              arrowLabel: 'exit code was 1 or 2',
              branch: {
                label: 'Logs are empty',
                detail: 'It failed before writing anything - check command and config',
              },
            },
            {
              label: 'Check what was actually injected',
              detail: 'kubectl get pod -o yaml: env, mounts, command, args',
            },
            {
              label: 'Keep it alive and exec in',
              detail: 'Override the command, then run the real one by hand',
              branch: {
                label: 'No shell in the image',
                detail: 'kubectl debug with an ephemeral container',
              },
            },
            {
              label: 'Root cause found',
              detail: 'Fix the manifest or the image, not the live Pod',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The commands, in order',
          language: 'bash',
          code: `kubectl describe pod <pod>
kubectl logs <pod> --previous
kubectl logs <pod> --previous -c <container>     # multi-container Pods

# What did it actually get?
kubectl get pod <pod> -o yaml | less

# Keep it alive so you can look around
kubectl run debug --image=<same-image> --restart=Never \\
  --command -- sleep 3600
kubectl exec -it debug -- sh

# No shell in the image?
kubectl debug -it <pod> --image=busybox --target=<container>

# Is it actually the liveness probe?
kubectl get events --field-selector involvedObject.name=<pod> \\
  --sort-by=.lastTimestamp`,
        },
      ],
      traps: [
        'Running `kubectl logs` without `--previous` and concluding there is nothing there.',
        'Editing the live Pod to fix it. Fix the Deployment - the Pod will be replaced.',
        'Missing that a liveness probe is causing the restarts rather than the application.',
      ],
      followUps: [
        'The logs are completely empty. What now?',
        'How do you debug a distroless image with no shell?',
        'How would you tell a liveness-probe restart from an application crash?',
      ],
      tags: ['scenario', 'troubleshooting', 'crashloop'],
    },
    {
      id: 'itv-k8s-11',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'Users report intermittent 502s from a service. The Pods look healthy. How do you investigate?',
      probing:
        'A genuinely hard scenario. They want structured bisection and awareness of the endpoint/termination race.',
      answer: [
        'Intermittent means some requests succeed, so the path basically works - I am looking for a subset of backends or a timing window. I would bisect the path rather than guess.',
        'First, `kubectl get endpoints <svc>` and compare the count with the Ready Pod count. If endpoints flap or include fewer Pods than expected, the readiness probe is marginal - Pods are dropping in and out of rotation, which produces exactly this symptom.',
        'Second, I would test the Pods **directly**, bypassing the Service: `kubectl port-forward` to individual Pods, or curl Pod IPs from a debug Pod. If one of five Pods fails and four succeed, it is a bad replica, not a routing problem.',
        'Third, I would look at the **termination path**, because this is the classic cause. When a Pod is deleted, it is removed from endpoints **and** sent SIGTERM at the same time. Those propagate independently - kube-proxy on every node has to update its rules. If the app stops accepting connections the instant it gets SIGTERM, there is a window where traffic is still being routed to a Pod that is already refusing it. That produces intermittent 502s during every single rollout.',
        'The fix for that is a `preStop` hook that sleeps a few seconds before the app shuts down, plus graceful shutdown in the app so in-flight requests finish.',
      ],
      deeper: [
        'Other real causes worth ruling out: the ingress controller timing out against a slow upstream; keep-alive connections held open to a Pod that has gone away; `maxUnavailable` too high so too much capacity goes at once; or an HPA scaling down aggressively.',
        'If the 502s correlate exactly with deploys, it is almost certainly the termination race. If they are constant at a low rate, suspect one bad replica or a resource limit causing throttling.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'The termination race that causes 502s on every deploy',
          caption:
            'Endpoint removal and SIGTERM happen at the same time, but propagate at different speeds. The preStop sleep covers the gap.',
          nodes: [
            {
              label: 'Pod marked for deletion',
              detail: 'Rollout, scale-down or eviction',
              tone: 'accent',
            },
            {
              label: 'Two things happen AT ONCE',
              detail: 'Removed from Endpoints, and sent SIGTERM',
              arrowLabel: 'in parallel',
            },
            {
              label: 'Endpoint removal must reach every node',
              detail: 'kube-proxy updates iptables/IPVS - takes time',
              branch: {
                label: 'App exits immediately on SIGTERM',
                detail: 'Traffic still arriving is refused: 502',
              },
            },
            {
              label: 'preStop sleep holds the app open',
              detail: 'lifecycle.preStop: sleep 5-15s',
              arrowLabel: 'the fix',
            },
            {
              label: 'Then graceful shutdown drains in-flight requests',
              detail: 'Within terminationGracePeriodSeconds',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Investigating, then fixing',
          language: 'bash',
          code: `# Do endpoints match Ready Pods, and are they stable?
kubectl get endpoints <svc> -w
kubectl get pods -l app=<label> -o wide

# Has anything been restarting or flapping readiness?
kubectl get pods -l app=<label> \\
  -o custom-columns=NAME:.metadata.name,READY:.status.containerStatuses[0].ready,RESTARTS:.status.containerStatuses[0].restartCount

kubectl get events --sort-by=.lastTimestamp | grep -i unhealthy

# Bypass the Service and hit Pods directly
kubectl port-forward pod/<pod> 8080:8080
kubectl run curl --rm -it --image=curlimages/curl -- \\
  curl -sS -o /dev/null -w '%{http_code}\\n' http://<pod-ip>:8080/`,
        },
        {
          title: 'The graceful-termination fix',
          language: 'yaml',
          explanation:
            'The sleep does nothing except buy time for endpoint removal to propagate to every node before the app stops accepting connections.',
          code: `spec:
  terminationGracePeriodSeconds: 60
  containers:
    - name: api
      lifecycle:
        preStop:
          exec:
            # Give kube-proxy time to remove this Pod from every
            # node's rules before we stop accepting connections.
            command: ["sh", "-c", "sleep 10"]
  # And in the app: handle SIGTERM, stop accepting NEW connections,
  # finish in-flight requests, then exit.`,
        },
      ],
      traps: [
        'Assuming healthy-looking Pods mean the Service is fine. Readiness flapping is invisible in `kubectl get pods` at a glance.',
        'Adding retries at the client and calling it fixed - that hides a rollout bug that will get worse.',
      ],
      followUps: [
        'How would you confirm it only happens during rollouts?',
        'What does terminationGracePeriodSeconds actually control?',
        'Why does the preStop sleep help if the app already handles SIGTERM?',
      ],
      tags: ['scenario', 'troubleshooting', 'networking', 'rollouts'],
    },
    {
      id: 'itv-k8s-12',
      level: 'advanced',
      kind: 'multi',
      prompt: 'Which of these are true about Kubernetes namespaces? (Select all that apply.)',
      options: [
        {
          id: 'a',
          text: 'They scope object names, so two namespaces can each have a Service called "api"',
        },
        { id: 'b', text: 'They provide network isolation by default' },
        { id: 'c', text: 'ResourceQuota and LimitRange are applied per namespace' },
        { id: 'd', text: 'They are a natural boundary for RBAC' },
        { id: 'e', text: 'All Kubernetes objects are namespaced' },
      ],
      correct: ['a', 'c', 'd'],
      probing:
        'B and E are both common misconceptions, and B in particular has real security consequences.',
      answer: [
        'A, C and D are true. **B and E are false**, and both matter.',
        'Namespaces do **not** provide network isolation. By default any Pod can reach any other Pod in the cluster, across every namespace. Isolation requires **NetworkPolicy** objects, and those need a CNI plugin that enforces them - Calico or Cilium, for example. Flannel alone does not.',
        'Not all objects are namespaced. Nodes, PersistentVolumes, StorageClasses, ClusterRoles, ClusterRoleBindings and the namespaces themselves are **cluster-scoped**. `kubectl api-resources --namespaced=false` lists them.',
        'What namespaces genuinely give you is a name scope, a unit for quotas and limit ranges, and a natural boundary for RBAC - which is why they are the usual per-team or per-environment division.',
      ],
      deeper: [
        'The "namespaces are not a security boundary" point is worth being precise about. They are an **authorisation** boundary via RBAC, but not a **network** or **kernel** boundary. A container escape in one namespace lands you on the node, which hosts Pods from other namespaces.',
      ],
      traps: [
        'Assuming a Pod in `dev` cannot reach a Pod in `prod`. Without NetworkPolicy, it can.',
        'Trying to create a namespaced RoleBinding for a cluster-scoped resource like nodes. That needs a ClusterRole and ClusterRoleBinding.',
      ],
      followUps: [
        'How would you actually isolate two namespaces on the network?',
        'Name three cluster-scoped resources.',
      ],
      tags: ['namespaces', 'security', 'rbac', 'networkpolicy'],
    },
    {
      id: 'itv-k8s-13',
      level: 'advanced',
      kind: 'open',
      prompt: 'Explain how a rolling update works, and how you would achieve zero downtime.',
      probing:
        'They want maxSurge/maxUnavailable, readiness as the gate, and the graceful-termination half that people forget.',
      answer: [
        'When you change the Pod template, the Deployment creates a new ReplicaSet and shifts replicas from old to new gradually, governed by two settings. **maxSurge** is how far above the desired replica count it may temporarily go; **maxUnavailable** is how far below. Both default to 25%.',
        'The gate at each step is the **readiness probe**. The Deployment adds a new Pod, waits for it to become Ready, then removes an old one. If new Pods never become Ready, the rollout stalls rather than proceeding - which is the safe behaviour, and why `kubectl rollout status` hangs instead of failing silently.',
        'For genuinely zero downtime you need both halves. On the way **in**: `maxUnavailable: 0` so capacity never dips, plus an accurate readiness probe so traffic only arrives when the Pod can serve it.',
        'On the way **out**: a `preStop` hook and graceful shutdown, because endpoint removal and SIGTERM race each other. Without that you drop requests on every deploy even though the rollout itself looks perfect.',
        'And a **PodDisruptionBudget** so that voluntary disruptions - node drains, cluster upgrades - cannot take down more replicas than you can afford at once.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'One step of a rolling update',
          caption:
            'Readiness is the gate. maxSurge is how far up it may go, maxUnavailable how far down.',
          nodes: [
            { label: 'replicas: 4, all on v1', detail: 'Available: 4 of 4' },
            {
              label: 'Create surge Pods on v2',
              detail: 'maxSurge: 1 permits a fifth Pod',
              arrowLabel: 'template changed',
              tone: 'accent',
            },
            {
              label: 'Wait for the new Pod to be Ready',
              detail: 'The readiness probe decides, not Running',
              arrowLabel: 'this is the gate',
              branch: {
                label: 'Never becomes Ready',
                detail: 'Rollout stalls here. Old Pods keep serving.',
              },
            },
            {
              label: 'Terminate one v1 Pod',
              detail: 'Never dropping below replicas minus maxUnavailable',
            },
            {
              label: 'Repeat until all are v2',
              detail: 'kubectl rollout status blocks until then',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The zero-downtime configuration',
          language: 'yaml',
          code: `apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0        # capacity never dips below 4
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: api
          readinessProbe:      # the gate - must be accurate
            httpGet: { path: /ready, port: 8080 }
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
---
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 3
  selector:
    matchLabels: { app: api }`,
        },
      ],
      traps: [
        'Setting `maxUnavailable: 0` and stopping there. Without graceful termination you still drop requests on every deploy.',
        'Having no readiness probe at all - Kubernetes then considers a Pod Ready as soon as the process starts, and sends traffic to an application that is still booting.',
      ],
      followUps: [
        'What happens if the new version never becomes Ready?',
        'How would you do a canary or blue-green instead?',
        'What does a PodDisruptionBudget protect against, and what does it not?',
      ],
      tags: ['deployments', 'rollouts', 'zero downtime', 'production'],
    },
    {
      id: 'itv-k8s-14',
      level: 'advanced',
      kind: 'open',
      prompt: 'How does a request from outside reach a Pod? Trace the whole path.',
      probing:
        'Senior networking. They want Ingress → Service → kube-proxy → Pod, and ideally CNI and DNS.',
      answer: [
        'A request to `https://shop.example.com/cart` first resolves in public DNS to the address of the **cloud load balancer** created by the Ingress controller’s Service.',
        'The load balancer forwards to the **Ingress controller Pods** - nginx, Traefik or similar - which are ordinary Pods in the cluster. The controller has been watching Ingress objects and has built a routing table from them, so it matches the host and path to a backend Service.',
        'The controller then sends the request to a Pod IP. Depending on the controller it either resolves the Service’s ClusterIP, or - more commonly now - reads the EndpointSlices directly and load-balances across Pod IPs itself.',
        'If it goes via the ClusterIP, **kube-proxy** is what makes that work: on every node it programs iptables or IPVS rules that DNAT the virtual ClusterIP to one of the Ready Pod IPs. There is no process listening on a ClusterIP - it is purely a packet-rewriting rule.',
        'Finally the **CNI plugin** is what makes Pod IPs routable between nodes at all, whether by overlay (VXLAN) or native routing.',
      ],
      deeper: [
        'The fact that ClusterIP is just iptables/IPVS rules explains several things: you cannot ping a ClusterIP meaningfully, `tcpdump` on the node shows the rewritten destination, and a Service with no endpoints causes connection refused rather than a timeout.',
        'Gateway API is the successor to Ingress and is worth mentioning - it separates infrastructure concerns (GatewayClass, Gateway) from routing (HTTPRoute), which fixes Ingress’s reliance on controller-specific annotations.',
      ],
      diagrams: [
        {
          kind: 'sequence',
          title: 'Browser to Pod',
          caption:
            'The Ingress object is only configuration. The controller Pod is what actually receives and forwards the request.',
          participants: [
            { id: 'user', label: 'Browser' },
            { id: 'lb', label: 'Cloud LB' },
            { id: 'ing', label: 'Ingress ctrl' },
            { id: 'pod', label: 'App Pod' },
          ],
          messages: [
            { from: 'user', to: 'lb', label: 'GET shop.example.com/cart' },
            { from: 'lb', to: 'ing', label: 'forward to a controller Pod' },
            { from: 'ing', to: 'ing', label: 'match host, then path rule' },
            { from: 'ing', to: 'pod', label: 'to a Ready endpoint, via kube-proxy or direct' },
            { from: 'pod', to: 'user', label: 'response back the same way', kind: 'return' },
          ],
        },
      ],
      traps: [
        'Saying the Ingress object routes traffic. It is configuration; the controller Pod does the routing, and without a controller installed an Ingress does nothing at all.',
        'Forgetting kube-proxy exists and assuming ClusterIP is a real listening socket.',
      ],
      followUps: [
        'What happens if no Ingress controller is installed?',
        'What does kube-proxy actually do?',
        'How is Gateway API different?',
      ],
      tags: ['networking', 'ingress', 'kube-proxy', 'architecture'],
    },
    {
      id: 'itv-k8s-15',
      level: 'advanced',
      kind: 'scenario',
      prompt: 'A node goes NotReady in production. What happens to its Pods, and what do you do?',
      probing:
        'Operational maturity: do you know the eviction timeline and that StatefulSets behave differently?',
      answer: [
        'The kubelet on each node sends heartbeats. When they stop, the node controller marks the node `NotReady` after about 40 seconds. The Pods on it are **not** rescheduled immediately - they stay in `Running` state from the API server’s point of view, because nothing can confirm they are actually dead.',
        'After a further **5 minutes** by default, the node controller adds an eviction taint and Pods are marked for deletion so their controllers can recreate them elsewhere. That five-minute window is deliberate: rescheduling instantly on a transient network blip would cause more harm than waiting.',
        'The exception is **StatefulSets**. Kubernetes will not automatically recreate a StatefulSet Pod on another node while the original might still be running, because that would risk two Pods with the same identity writing to the same volume. It waits for the Pod to be confirmed deleted - which on a genuinely dead node means you have to force it.',
        'Operationally, I would first determine whether the node is actually dead or just unreachable - `kubectl describe node` for conditions like DiskPressure or MemoryPressure, then check the node itself and the kubelet. If it is recoverable, fix it. If not, `kubectl drain` it (which cordons and evicts respecting PodDisruptionBudgets), then remove it and let the autoscaler replace it.',
      ],
      deeper: [
        'The timings are tunable with `--node-monitor-grace-period` and per-Pod `tolerationSeconds` on the `node.kubernetes.io/unreachable` taint. Shortening them trades faster recovery for more churn on transient issues.',
        'This is also the argument for spreading replicas across nodes and zones with `topologySpreadConstraints` or anti-affinity: if all three replicas were on the one node that died, no eviction policy saves you.',
      ],
      code: [
        {
          title: 'Assessing and handling it',
          language: 'bash',
          code: `kubectl get nodes
kubectl describe node <node> | grep -A 12 Conditions
kubectl get pods -A -o wide --field-selector spec.nodeName=<node>

# On the node itself, if reachable:
systemctl status kubelet
journalctl -u kubelet -n 200 --no-pager
df -h /var/lib/kubelet          # DiskPressure is a common cause

# If it is not coming back: cordon, drain, remove
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl delete node <node>

# StatefulSet Pods stuck Terminating on a dead node need forcing.
# Only do this once you are CERTAIN the node is gone, or you risk
# two Pods writing to the same volume.
kubectl delete pod <pod> --grace-period=0 --force`,
        },
      ],
      traps: [
        'Expecting instant rescheduling. The default wait is about five and a half minutes in total.',
        'Force-deleting a StatefulSet Pod on a node that is merely unreachable. That is how you get split-brain data corruption.',
      ],
      followUps: [
        'Why does Kubernetes wait five minutes rather than rescheduling instantly?',
        'Why are StatefulSets treated differently?',
        'How would you make sure one node dying does not take out a whole service?',
      ],
      tags: ['scenario', 'operations', 'nodes', 'statefulsets'],
    },
    {
      id: 'itv-k8s-16',
      level: 'advanced',
      kind: 'open',
      prompt: 'How does RBAC work in Kubernetes?',
      probing:
        'Security basics for a senior role. They want the four-object chain and the namespaced/cluster distinction.',
      answer: [
        'RBAC is a chain of four things. An **identity** - a ServiceAccount, user or group. A **Role** or **ClusterRole** listing permissions as apiGroups, resources and verbs. And a **RoleBinding** or **ClusterRoleBinding** connecting the two.',
        'The critical point is that a Role grants nothing on its own. The **binding** is what makes it real, and it is the link people forget.',
        'The scope rules: a **Role** is namespaced and can only grant access to namespaced resources in its own namespace. A **ClusterRole** can grant access to cluster-scoped resources like nodes and PersistentVolumes, and can also be reused across namespaces.',
        'The most useful combination is a **ClusterRole bound by a RoleBinding** - you define the permission set once and grant it namespace by namespace, which is how most platform teams manage per-team access.',
        'RBAC is purely additive - there are no deny rules. If something is permitted by any binding, it is permitted.',
      ],
      code: [
        {
          title: 'The full chain, and how to verify it',
          language: 'bash',
          code: `# Create the chain
kubectl create serviceaccount deployer -n team-a
kubectl create role pod-reader -n team-a \\
  --verb=get,list,watch --resource=pods
kubectl create rolebinding deployer-can-read -n team-a \\
  --role=pod-reader --serviceaccount=team-a:deployer

# ALWAYS verify - this is the command interviewers want to hear
kubectl auth can-i list pods \\
  --as=system:serviceaccount:team-a:deployer -n team-a     # yes
kubectl auth can-i delete pods \\
  --as=system:serviceaccount:team-a:deployer -n team-a     # no
kubectl auth can-i --list \\
  --as=system:serviceaccount:team-a:deployer -n team-a`,
        },
      ],
      deeper: [
        'Every Pod runs with a ServiceAccount whether you set one or not. If you do not choose, it is `default`, which normally has almost no permissions - so a Pod that needs the API must have a ServiceAccount explicitly assigned and bound.',
        'Since 1.24, ServiceAccount tokens are short-lived and projected into the Pod rather than stored as long-lived Secrets, which is a meaningful security improvement worth mentioning.',
      ],
      traps: [
        'Creating a Role and forgetting the binding, then wondering why the 403 persists.',
        'Trying to grant access to nodes with a Role. Cluster-scoped resources need a ClusterRole.',
        'Looking for deny rules. There are none.',
      ],
      followUps: [
        'How do you check what a ServiceAccount can do?',
        'When would you use a ClusterRole with a RoleBinding?',
        'What ServiceAccount does a Pod use if you do not specify one?',
      ],
      tags: ['rbac', 'security', 'serviceaccounts'],
    },
  ],
}
