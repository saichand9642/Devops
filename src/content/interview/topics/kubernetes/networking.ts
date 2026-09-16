import type { InterviewQuestion } from '../../../types'

/** Services, DNS, Ingress, NetworkPolicy and how traffic actually reaches a Pod. */
export const k8sNetworkingQuestions: InterviewQuestion[] = [
  {
    id: 'itv-k8s-27',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a Service and why do you need one when Pods already have IP addresses?',
    probing: 'Whether you understand that Pod IPs are useless to depend on.',
    answer: [
      'Pods are disposable and get a **new IP every time they are recreated**. A rollout replaces every Pod, so any client holding a Pod IP is immediately pointing at nothing. You cannot build anything on Pod IPs directly.',
      'A Service gives you a **stable virtual IP and DNS name** in front of a changing set of Pods. It uses a **label selector** to find its backends, and the endpoints controller keeps that list up to date as Pods come and go. Traffic to the Service IP is load-balanced across the ready Pods.',
      'The crucial word is **ready**: only Pods passing their readiness probe are in the endpoint list. That is how a Service stops sending traffic to a Pod that is starting up or temporarily unhealthy, and it is why readiness probes and Services are really one mechanism.',
    ],
    code: [
      {
        title: 'A Service and its endpoints',
        language: 'yaml',
        code: `apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api              # any Pod with this label is a candidate backend
  ports:
    - port: 80            # the Service port clients use
      targetPort: 8080    # the port the container listens on`,
      },
      {
        title: 'Checking the Service actually has backends',
        language: 'bash',
        code: `kubectl get svc api
kubectl get endpointslices -l kubernetes.io/service-name=api

# "No endpoints" is nearly always one of two things:
#   - the selector does not match any Pod labels
#   - the Pods exist but are not READY
kubectl get pods -l app=api -o wide`,
      },
    ],
    traps: [
      'A selector that does not match the Pod labels, giving a Service with no endpoints and connection refused.',
      'Confusing `port` and `targetPort`, so the Service points at a port nothing is listening on.',
    ],
    followUps: [
      'Your Service has no endpoints. What are the two most likely causes?',
      'How does a Service know which Pods are healthy?',
    ],
    tags: ['service', 'networking', 'endpoints', 'fundamentals'],
  },
  {
    id: 'itv-k8s-28',
    level: 'basic',
    kind: 'mcq',
    prompt:
      'Which Service type gives you a stable internal IP reachable only from inside the cluster?',
    probing: 'Basic Service type fluency.',
    options: [
      { id: 'a', text: 'NodePort' },
      { id: 'b', text: 'ClusterIP' },
      { id: 'c', text: 'LoadBalancer' },
      { id: 'd', text: 'ExternalName' },
    ],
    correct: ['b'],
    answer: [
      '**ClusterIP** is the default and is internal-only: a virtual IP reachable from inside the cluster, with a DNS name, and no external exposure at all.',
      'The types build on each other. **NodePort** is ClusterIP *plus* a port opened on every node (in the 30000-32767 range), so external traffic reaching any node on that port is forwarded in. **LoadBalancer** is NodePort *plus* a cloud load balancer provisioned in front of it. **ExternalName** is different in kind - it does no proxying at all, just returns a CNAME to an external hostname.',
      'In practice most Services are ClusterIP, and external traffic comes in through a single Ingress or Gateway rather than a LoadBalancer per service - a cloud load balancer per service gets expensive fast.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Service types build on each other',
        caption: 'Each type adds a layer of exposure on top of the one inside it.',
        root: {
          label: 'LoadBalancer',
          detail: 'Cloud LB with an external IP',
          tone: 'accent',
          children: [
            {
              label: 'NodePort',
              detail: 'Port 30000-32767 on every node',
              tone: 'warning',
              children: [
                { label: 'ClusterIP', detail: 'Internal virtual IP + DNS', tone: 'success' },
              ],
            },
          ],
        },
      },
    ],
    traps: [
      'Creating a LoadBalancer per microservice and being surprised by the cloud bill.',
      'Using NodePort in production and hardcoding node IPs, which change.',
    ],
    followUps: ['Why do most clusters use one Ingress rather than many LoadBalancers?'],
    tags: ['service', 'networking', 'clusterip', 'fundamentals'],
  },
  {
    id: 'itv-k8s-29',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does DNS work in Kubernetes? What does a full service DNS name look like?',
    probing:
      'Service discovery in practice, and whether you know why a short name works in one namespace but not another.',
    answer: [
      'CoreDNS runs in the cluster and every Pod is configured to use it. A Service gets a record at **`<service>.<namespace>.svc.cluster.local`**, so `api` in namespace `prod` is `api.prod.svc.cluster.local`.',
      'Short names work because of the **search domains** in each Pod’s `/etc/resolv.conf`. A Pod in `prod` has `prod.svc.cluster.local`, `svc.cluster.local` and `cluster.local` in its search list, so `api` resolves - but only to the `api` in its **own** namespace. To reach another namespace you need at least `api.other`.',
      'A **headless Service** (`clusterIP: None`) behaves differently: instead of one virtual IP, DNS returns the **individual Pod IPs**. That is what StatefulSets use, and it also gives each Pod its own name, `db-0.db.prod.svc.cluster.local`, which is how clustered systems address specific members.',
    ],
    code: [
      {
        title: 'Resolution from inside a Pod',
        language: 'bash',
        code: `kubectl run -it --rm dns-test --image=nicolaka/netshoot --restart=Never -- bash

cat /etc/resolv.conf
# nameserver 10.96.0.10
# search prod.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5

nslookup api                              # same namespace only
nslookup api.other                        # another namespace
nslookup api.prod.svc.cluster.local       # fully qualified, always works

nslookup db.prod.svc.cluster.local        # headless: returns every Pod IP`,
      },
    ],
    deeper: [
      '`ndots:5` means any name with fewer than five dots is tried against every search domain first. `api.example.com` has two dots, so it generates four failed lookups before the real one - a measurable latency cost on high-throughput services. A trailing dot (`api.example.com.`) or `dnsConfig` with a lower `ndots` fixes it.',
      'CoreDNS is a common bottleneck at scale. NodeLocal DNSCache puts a caching resolver on each node and usually removes a whole class of intermittent timeouts.',
      'If DNS fails for everything, check the CoreDNS Pods themselves - they are an ordinary Deployment and can be evicted or under-resourced like anything else.',
    ],
    traps: [
      'Assuming a short name reaches another namespace. It does not.',
      'Ignoring `ndots:5` and paying for four extra DNS lookups on every external call.',
      'Hardcoding `cluster.local` when the cluster was installed with a different domain.',
    ],
    followUps: [
      'Why can an external API call be slower from inside a Pod than from the node?',
      'How would you debug "DNS works for some Pods but not others"?',
    ],
    tags: ['dns', 'coredns', 'service discovery', 'networking', 'performance'],
  },
  {
    id: 'itv-k8s-30',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is an Ingress, and how is it different from a LoadBalancer Service?',
    probing: 'Whether you understand L4 versus L7 and why one Ingress serves many services.',
    answer: [
      'A **LoadBalancer Service** works at **layer 4** - TCP. It gets its own cloud load balancer and external IP, and it forwards whatever arrives on a port to the Pods. One Service, one load balancer, one IP.',
      'An **Ingress** works at **layer 7** - HTTP. It is a set of routing rules (by hostname and path) evaluated by an **ingress controller** running in the cluster. One controller, behind one load balancer, routes to **many** Services based on the request.',
      'That is the practical difference: with Ingress you pay for one load balancer and terminate TLS once, then route `shop.example.com` to one Service and `api.example.com/v2` to another. With LoadBalancer Services you would need one cloud load balancer per service.',
      'The catch people miss is that **an Ingress resource does nothing on its own**. It is only configuration; something has to implement it. If no ingress controller is installed, your Ingress object sits there with no address and no effect.',
      'The Ingress API is effectively frozen, and its limitations - HTTP-only, everything expressed through controller-specific annotations - are why the **Gateway API** is the direction of travel for new clusters.',
    ],
    code: [
      {
        title: 'One Ingress, several backends, TLS terminated once',
        language: 'yaml',
        code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: public
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [shop.example.com, api.example.com]
      secretName: public-tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: shop, port: { number: 80 } } }
    - host: api.example.com
      http:
        paths:
          - path: /v2
            pathType: Prefix
            backend: { service: { name: api-v2, port: { number: 80 } } }`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'How a request reaches a Pod through Ingress',
        caption: 'One load balancer and one TLS certificate serve every backend service.',
        nodes: [
          { label: 'Client', detail: 'https://api.example.com/v2/orders', tone: 'accent' },
          { label: 'Cloud load balancer', detail: 'One, shared', arrowLabel: 'DNS' },
          { label: 'Ingress controller Pod', detail: 'Terminates TLS, reads rules' },
          { label: 'Matches host + path rule', detail: 'api.example.com /v2' },
          { label: 'Service api-v2', detail: 'ClusterIP', arrowLabel: 'to endpoints' },
          { label: 'Pod', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Most controllers bypass the Service virtual IP and send traffic straight to Pod endpoints, which gives better load balancing and keeps session affinity meaningful.',
      'Annotations are controller-specific - an nginx Ingress and an AWS ALB Ingress are not portable between each other despite the shared API.',
      'Gateway API replaces the annotation sprawl with typed resources and separates the infrastructure owner’s concerns (`Gateway`) from the application team’s (`HTTPRoute`).',
    ],
    traps: [
      'Creating an Ingress with no controller installed and waiting for an address that never appears.',
      'Forgetting `ingressClassName` in a cluster with more than one controller.',
      'Trying to route non-HTTP traffic through Ingress. Use a LoadBalancer Service or Gateway API for TCP.',
    ],
    followUps: [
      'Your Ingress has no ADDRESS. What do you check?',
      'What does Gateway API improve on?',
    ],
    tags: ['ingress', 'networking', 'tls', 'gateway api'],
  },
  {
    id: 'itv-k8s-31',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is a NetworkPolicy and what is the default behaviour without one?',
    probing:
      'Cluster security. The default-allow behaviour surprises people and matters a great deal.',
    answer: [
      'By default, **every Pod can reach every other Pod in the cluster**, across all namespaces. There is no network segmentation at all until you create a NetworkPolicy. A compromised front-end Pod can talk directly to your database.',
      'A NetworkPolicy selects Pods with a label selector and defines allowed **ingress** and **egress** traffic. The rules are **additive and allow-only** - there is no deny rule. The moment *any* policy selects a Pod, that Pod switches from default-allow to **default-deny** for the direction the policy covers, and only what is explicitly allowed gets through.',
      'That behaviour is the source of most confusion. A policy with `policyTypes: [Ingress, Egress]` but only ingress rules written will **block all egress** - including DNS, which breaks everything in a way that looks nothing like a network policy problem.',
      'The standard pattern is a **default-deny policy per namespace**, then narrow allow policies per service. And critically: **NetworkPolicies are enforced by the CNI plugin**. Calico, Cilium and Weave enforce them; flannel does not. On a cluster without an enforcing CNI, your policies are accepted by the API server and silently do nothing.',
    ],
    code: [
      {
        title: 'Default deny, then allow exactly what is needed',
        language: 'yaml',
        code: `# 1. Deny everything in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: prod }
spec:
  podSelector: {}                  # every Pod
  policyTypes: [Ingress, Egress]
---
# 2. DNS must be allowed back, or nothing resolves
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: prod }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: kube-system }
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
---
# 3. Only the API may reach the database, on 5432
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: db-from-api, namespace: prod }
spec:
  podSelector:
    matchLabels: { app: db }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app: api }
      ports:
        - { protocol: TCP, port: 5432 }`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Is this traffic allowed?',
        caption: 'A Pod flips to default-deny the moment any policy selects it.',
        question: 'A packet is heading to a Pod',
        branches: [
          {
            condition: 'No policy selects this Pod',
            result: 'Allowed',
            detail: 'The cluster default is wide open',
            tone: 'warning',
          },
          {
            condition: 'A policy selects it and a rule matches',
            result: 'Allowed',
            tone: 'success',
          },
          {
            condition: 'A policy selects it and nothing matches',
            result: 'Dropped silently',
            detail: 'No error - just a timeout',
            tone: 'danger',
          },
          {
            condition: 'The CNI does not enforce policies',
            result: 'Allowed regardless',
            detail: 'Policies exist but do nothing',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Egress policies almost always need an explicit DNS allow. Forgetting it is the most common self-inflicted outage when adopting NetworkPolicy.',
      'Policies are namespaced. `namespaceSelector` is how you allow cross-namespace traffic, and it relies on namespace labels being maintained.',
      'Blocked traffic fails as a **timeout**, not a refusal - which is exactly how you tell a policy drop from a missing endpoint.',
      'Cilium adds L7 policy (allow `GET /healthz` but not `POST /admin`), which plain NetworkPolicy cannot express.',
    ],
    traps: [
      'Writing your first policy and taking down the namespace by blocking DNS.',
      'Assuming policies work without checking the CNI actually enforces them.',
      'Expecting a policy to block traffic that is already established - it filters new connections.',
    ],
    followUps: [
      'You applied a default-deny and everything broke. What did you most likely forget?',
      'How would you verify a policy is actually being enforced?',
    ],
    tags: ['networkpolicy', 'security', 'cni', 'networking', 'advanced'],
  },
  {
    id: 'itv-k8s-32',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Service A cannot reach Service B inside the cluster. Requests time out. How do you debug it?',
    probing: 'Layered network diagnosis. The order matters more than the commands.',
    answer: [
      'Work **outward from the target**, so each step eliminates one layer.',
      '**Does the Service have endpoints?** `kubectl get endpointslices` - if it is empty, this is not a network problem at all. Either the selector does not match the Pod labels, or the Pods are not passing readiness. That is the most common cause by far.',
      '**Does DNS resolve?** From a Pod in the source namespace, `nslookup b.prod.svc.cluster.local`. If the name does not resolve you have a DNS problem, not a connectivity problem - and remember a short name only works within the same namespace.',
      '**Can you reach the Pod IP directly?** If the Pod IP works but the Service IP does not, the problem is in the Service layer - kube-proxy, the port mapping, or `targetPort` pointing at the wrong port. If neither works, it is Pod-level or policy.',
      '**Is a NetworkPolicy dropping it?** This is where the distinction matters: a policy drop gives you a **timeout**, while nothing listening gives you **connection refused**. A timeout with correct endpoints and working DNS points hard at policy. List the policies selecting the target Pod.',
      '**Is the application listening correctly?** A container bound to `127.0.0.1` instead of `0.0.0.0` is only reachable from inside its own Pod. `ss -tlnp` inside the container settles it immediately.',
    ],
    code: [
      {
        title: 'The sequence, one layer at a time',
        language: 'bash',
        code: `# 1. Endpoints - is anything actually behind the Service?
kubectl get svc b -o wide
kubectl get endpointslices -l kubernetes.io/service-name=b
kubectl get pods -l app=b -o wide        # are they READY?

# 2..5 from a debug Pod in the SOURCE namespace
kubectl run -it --rm net --image=nicolaka/netshoot --restart=Never -n prod -- bash

  nslookup b.prod.svc.cluster.local      # DNS
  curl -sv --max-time 5 http://b.prod.svc.cluster.local/healthz   # via Service
  curl -sv --max-time 5 http://10.244.3.17:8080/healthz           # direct to Pod

# 6. Is the app bound to 0.0.0.0 rather than 127.0.0.1?
kubectl exec -it deploy/b -- ss -tlnp

# 7. Which policies select the target?
kubectl get networkpolicy -n prod -o wide`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Eliminate one layer at a time',
        caption:
          'Timeout points at a policy or a firewall; connection refused points at nothing listening.',
        nodes: [
          {
            label: 'Service has endpoints?',
            detail: 'Empty = selector or readiness',
            tone: 'accent',
          },
          { label: 'DNS resolves?', detail: 'Wrong namespace is common' },
          { label: 'Pod IP reachable directly?', detail: 'Isolates Service vs Pod layer' },
          {
            label: 'Timeout or refused?',
            detail: 'Timeout = policy, refused = not listening',
            tone: 'warning',
          },
          { label: 'App bound to 0.0.0.0?', detail: 'ss -tlnp inside the container' },
          { label: 'Cause identified', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'That timeout-versus-refused distinction is the fastest single discriminator in cluster networking. Learn it and you skip several steps.',
      '`kubectl debug node/<name>` gives you a host-namespace shell for checking iptables/IPVS rules when you suspect kube-proxy.',
      'Intermittent failures rather than total ones usually mean one bad backend Pod - check each endpoint individually rather than the Service.',
      'If it broke after a deploy, compare the Service selector against the new Pod labels. A changed label silently empties the endpoint list.',
    ],
    traps: [
      'Starting with tcpdump. Almost every one of these is endpoints, DNS or policy.',
      'Testing from the wrong namespace, where the short name resolves differently.',
      'Reading "connection refused" as a firewall. It means something answered and said no.',
    ],
    followUps: [
      'It works from one Pod but not another. What does that tell you?',
      'How do you tell a NetworkPolicy drop from a missing endpoint without looking at policies?',
    ],
    tags: ['scenario', 'troubleshooting', 'networking', 'dns', 'debugging'],
  },
  {
    id: 'itv-k8s-33',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'A Service has `port: 80` and `targetPort: 8080`, but the container listens on 3000. What happens?',
    probing: 'Port plumbing, and whether you know which failure mode this produces.',
    options: [
      { id: 'a', text: 'Kubernetes detects the mismatch and refuses to create the Service' },
      {
        id: 'b',
        text: 'The Service is created with endpoints, but connections are refused because nothing listens on 8080',
      },
      { id: 'c', text: 'Traffic is automatically routed to 3000' },
      { id: 'd', text: 'The Pod fails its readiness probe and is removed' },
    ],
    correct: ['b'],
    answer: [
      'Kubernetes does **no validation** that anything is listening on `targetPort`. The Service is created, the endpoints are populated (assuming labels match and Pods are ready), and everything looks healthy in `kubectl get`.',
      'The failure appears only when traffic arrives: it is forwarded to port 8080 in the Pod, nothing is listening there, and the connection is **refused**. "Connection refused" rather than "timeout" is the giveaway - something received the packet and actively rejected it.',
      'This is why `containerPort` in the Pod spec is worth filling in even though it is documentation: it makes the mismatch visible in the YAML. Using a **named port** is better still - name the container port `http` and reference `targetPort: http`, and the two cannot drift apart.',
    ],
    code: [
      {
        title: 'Named ports remove the mismatch entirely',
        language: 'yaml',
        code: `# Pod template
ports:
  - name: http
    containerPort: 3000

---
# Service refers to the name, not the number
spec:
  ports:
    - port: 80
      targetPort: http      # resolves to 3000, and cannot drift`,
      },
    ],
    traps: [
      'Assuming a healthy-looking Service means traffic works. Endpoints only prove the Pods are ready.',
      'Reading "connection refused" as a NetworkPolicy issue - policies produce timeouts.',
    ],
    followUps: ['How would you catch this class of mistake before deploying?'],
    tags: ['service', 'ports', 'troubleshooting', 'networking'],
  },
  {
    id: 'itv-k8s-34',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is a service mesh and when is it worth the complexity?',
    probing:
      'Whether you can argue *against* adopting one. Saying yes to everything is a red flag at senior level.',
    answer: [
      'A service mesh puts a **proxy next to every Pod** - as a sidecar, or in newer designs at the node level - and routes all service-to-service traffic through it. Because every request passes through infrastructure you control, you get **mutual TLS**, **fine-grained traffic control** (canary by percentage, retries, timeouts, circuit breaking) and **uniform telemetry** for every service, without changing application code.',
      'The honest case for it is when you have **many services in several languages** and need those properties consistently. Implementing mTLS, retries with backoff and distributed tracing correctly in five languages is a lot of duplicated, subtly inconsistent work. A mesh does it once.',
      'The case against is real and often stronger. You add a **proxy to the request path of every call** - latency, memory per Pod, and a new component that can fail. You add a **control plane** to operate and upgrade. And you add a large amount of new debugging surface: when something breaks, you now have to determine whether it was the application, the mesh config, or the proxy.',
      'My rule of thumb: with fewer than roughly ten or fifteen services, a mesh usually costs more than it returns - you can get mTLS from the CNI, retries from a client library, and telemetry from an OpenTelemetry SDK. The tipping point is when you genuinely need **per-request traffic control** or **mTLS everywhere by policy**, and the number of services makes doing it per-application untenable.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Do we actually need a mesh?',
        caption: 'Most of what teams want from a mesh has a cheaper answer at small scale.',
        question: 'What problem are we trying to solve?',
        branches: [
          {
            condition: 'mTLS between services only',
            result: 'Cilium or a CNI with transparent encryption',
            detail: 'No sidecars, far less to operate',
            tone: 'success',
          },
          {
            condition: 'Metrics and tracing only',
            result: 'OpenTelemetry in the application',
            detail: 'Better data - the app knows more than a proxy',
            tone: 'success',
          },
          {
            condition: 'Canary by percentage, retries, circuit breaking, across many languages',
            result: 'A mesh earns its cost',
            detail: 'Istio, Linkerd',
            tone: 'accent',
          },
          {
            condition: 'Fewer than ~10 services',
            result: 'Probably not yet',
            detail: 'Revisit when the count grows',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Linkerd is deliberately smaller and simpler than Istio; Istio is more capable and more to run. Ambient mode removes per-Pod sidecars, which changes the cost calculation significantly.',
      'The sidecar lifecycle used to be a real problem - proxies starting after the app, or not terminating for Jobs. Native sidecar containers in recent Kubernetes versions fixed most of it.',
      'A mesh does not remove the need for NetworkPolicy. mTLS proves identity; policy decides who may talk to whom.',
    ],
    traps: [
      'Adopting a mesh for observability alone, which application instrumentation does better and cheaper.',
      'Underestimating the upgrade burden - a mesh sits in the data path of everything you run.',
      'Assuming mTLS means you can stop doing authorisation. It authenticates the workload, nothing more.',
    ],
    followUps: [
      'How would you get mTLS without a mesh?',
      'What breaks first when a mesh control plane goes down?',
    ],
    tags: ['service mesh', 'istio', 'architecture', 'mtls', 'advanced'],
  },
  {
    id: 'itv-k8s-35',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How does traffic get from an external client all the way to a container? Walk the whole path.',
    probing: 'End-to-end understanding. Very revealing - most people can only do part of it.',
    answer: [
      'DNS first: `api.example.com` resolves to the external IP of a **cloud load balancer**, which was provisioned for the ingress controller’s Service.',
      'The load balancer forwards to a **node** on the NodePort backing that Service. On that node, **kube-proxy** rules (iptables or IPVS) rewrite the destination to one of the **ingress controller Pods** - which may be on a different node.',
      'The **ingress controller** terminates TLS and evaluates its rules. It matches the host and path against its Ingress resources and picks a backend Service. Most controllers then resolve that Service to its **endpoints** and send the request **directly to a Pod IP**, bypassing the Service virtual IP.',
      'The packet reaches the target node, crosses the **CNI** network to the Pod’s network namespace via its veth pair, and arrives at the container’s listening port. The application handles it and the response returns along the same path.',
      'The two facts worth stating explicitly: **only ready Pods** are in that endpoint list, and **kube-proxy programs rules rather than proxying traffic** - it is a controller that writes iptables or IPVS entries, and the kernel does the forwarding.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'External request to container',
        caption:
          'The ingress controller usually skips the Service IP and goes straight to a Pod endpoint.',
        participants: [
          { id: 'client', label: 'Client' },
          { id: 'lb', label: 'Cloud LB' },
          { id: 'ic', label: 'Ingress ctrl' },
          { id: 'pod', label: 'App Pod' },
        ],
        messages: [
          { from: 'client', to: 'lb', label: 'GET https://api.example.com/v2' },
          { from: 'lb', to: 'ic', label: 'to NodePort, kube-proxy DNATs' },
          { from: 'ic', to: 'ic', label: 'terminate TLS, match host/path', kind: 'return' },
          { from: 'ic', to: 'pod', label: 'direct to Pod IP:8080' },
          { from: 'pod', to: 'ic', label: '200 OK', kind: 'return' },
          { from: 'ic', to: 'lb', label: 'response', kind: 'return' },
          { from: 'lb', to: 'client', label: 'response', kind: 'return' },
        ],
      },
    ],
    deeper: [
      '`externalTrafficPolicy: Local` stops the extra node-to-node hop and preserves the client source IP, at the cost of uneven load if Pods are unevenly spread.',
      'iptables mode degrades at scale because rule evaluation is linear; IPVS uses hashing and handles thousands of Services far better.',
      'The client IP is lost by default through NodePort DNAT - which is why access logs show node IPs unless you set `externalTrafficPolicy: Local` or trust `X-Forwarded-For` at the controller.',
    ],
    traps: [
      'Thinking kube-proxy proxies packets. It programs rules; the kernel forwards.',
      'Forgetting that an unready Pod is silently absent from the endpoint list.',
      'Expecting the real client IP in application logs without configuring for it.',
    ],
    followUps: [
      'Where is the client IP lost, and how do you preserve it?',
      'What changes if kube-proxy is in IPVS mode?',
    ],
    tags: ['networking', 'kube-proxy', 'ingress', 'architecture', 'advanced'],
  },
  {
    id: 'itv-k8s-36',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a namespace and what is it not good for?',
    probing: 'Whether you know namespaces are not a security boundary on their own.',
    answer: [
      'A namespace is a **logical grouping** of resources in one cluster. It gives you a scope for names (two `api` Services can coexist in different namespaces), a boundary for **RBAC** rules, and a unit for **ResourceQuota** and **LimitRange**.',
      'What it is **not** is an isolation boundary by default. Pods in different namespaces can reach each other over the network with no restriction unless you add NetworkPolicies. Nodes are shared. Cluster-scoped resources - CRDs, ClusterRoles, PersistentVolumes, nodes - are not namespaced at all.',
      'So "we use namespaces for multi-tenancy" is only true if you have also added NetworkPolicies, RBAC, resource quotas and probably Pod Security Standards. For genuinely untrusted tenants, separate clusters remain the stronger answer.',
    ],
    code: [
      {
        title: 'Namespace with a quota and limits',
        language: 'yaml',
        code: `apiVersion: v1
kind: ResourceQuota
metadata: { name: team-quota, namespace: team-a }
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    persistentvolumeclaims: "10"
    count/deployments.apps: "25"
---
apiVersion: v1
kind: LimitRange
metadata: { name: defaults, namespace: team-a }
spec:
  limits:
    - type: Container
      default: { cpu: 500m, memory: 512Mi }        # applied if none given
      defaultRequest: { cpu: 100m, memory: 128Mi }`,
        explanation:
          'A LimitRange stops Pods being created with no resources set at all, which would make them BestEffort.',
      },
    ],
    traps: [
      'Treating namespaces as a security boundary without NetworkPolicy and RBAC.',
      'Expecting a quota to apply retroactively - existing Pods are unaffected.',
      'Forgetting that deleting a namespace deletes everything in it, irreversibly.',
    ],
    followUps: ['What would you add to make a namespace a real tenancy boundary?'],
    tags: ['namespaces', 'multi-tenancy', 'quota', 'rbac', 'fundamentals'],
  },
]
