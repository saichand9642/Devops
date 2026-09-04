import type { Topic } from '../../../types'

export const serviceTypes: Topic = {
  id: 'service-types',
  title: 'Service types: ClusterIP, NodePort, LoadBalancer, ExternalName',
  domainId: 'services-networking',
  difficulty: 'beginner',
  estimatedMinutes: 22,
  order: 1,
  tags: ['service', 'clusterip', 'nodeport', 'loadbalancer', 'externalname', 'headless', 'expose'],
  oneLiner:
    'The four Service types, what each one actually creates, and why NodePort and LoadBalancer are supersets of ClusterIP rather than alternatives to it.',
  explanation: [
    'Pod IPs are ephemeral - a Pod recreated by a Deployment gets a new one. A **Service** provides a stable name and virtual IP in front of a changing set of Pods, selected by label.',
    '**ClusterIP** (the default) allocates a virtual IP reachable only from inside the cluster, plus a DNS name. This is what you use for every internal service.',
    '**NodePort** does everything ClusterIP does *and* opens the same port on every node (default range 30000-32767), so traffic to `<any-node-ip>:<nodePort>` reaches the Service. Useful for development and bare-metal clusters.',
    '**LoadBalancer** does everything NodePort does *and* asks the cloud provider for an external load balancer pointing at those node ports. On a cluster with no cloud controller (kind, plain minikube) it stays `<pending>` forever.',
    '**ExternalName** is the odd one out: no selector, no virtual IP, no proxying. It simply makes the Service name a DNS CNAME to an external hostname, so in-cluster clients can use a stable internal name for something outside the cluster.',
    'Separately, a **headless** Service (`clusterIP: None`) has no virtual IP; DNS returns the Pod IPs directly. That is what StatefulSets use for per-Pod DNS, and what clients that do their own load balancing want.',
  ],
  whyItMatters: [
    '"Provide and troubleshoot access to applications via services" is a named curriculum competency, and Service tasks appear constantly - usually "expose this Deployment on port X".',
    'The nesting (LoadBalancer ⊃ NodePort ⊃ ClusterIP) explains why a NodePort Service still has a cluster IP and a DNS name, which surprises people.',
    'Knowing that LoadBalancer stays pending without a cloud provider saves you from debugging a working configuration on a local cluster.',
  ],
  howItWorks: [
    'A Service selects Pods with an equality-only label selector. The endpoints controller watches for matching **Ready** Pods and maintains an EndpointSlice listing their IPs and ports. kube-proxy programs the node (iptables or IPVS rules) so packets to the cluster IP are DNAT-ed to one of those Pod IPs.',
    'An unready Pod is not an endpoint, so a failing readiness probe silently removes a Pod from load balancing. That is a feature, and it is also the most common reason a Service "does not work".',
    "ClusterIP is allocated from the cluster's service CIDR and is immutable for the life of the Service. It is a virtual IP with nothing listening on it - you cannot ping it meaningfully, and it exists only as forwarding rules.",
    'NodePort: if you do not specify `nodePort`, one is allocated from the range. The port is opened on *every* node regardless of where the Pods run, and traffic arriving at a node with no local Pod is forwarded to another node.',
    '`externalTrafficPolicy: Local` stops that second hop - traffic is only served by Pods on the node it arrived at, which preserves the client source IP but means nodes without a Pod refuse connections.',
    'LoadBalancer relies on a cloud controller manager (or MetalLB on bare metal) to populate `status.loadBalancer.ingress`. Without one the EXTERNAL-IP column stays `<pending>`.',
    'ExternalName produces only a DNS CNAME. It does no port mapping, no TLS, and no health checking, and it does not work for hostnames that need an HTTP Host header rewrite.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which Service type?',
      caption:
        'Each type builds on the one above it. NodePort is a ClusterIP plus a node port; LoadBalancer is a NodePort plus an external IP.',
      question: 'Who needs to reach this workload?',
      branches: [
        {
          condition: 'only other Pods in the cluster',
          result: 'ClusterIP',
          detail: 'The default. An internal virtual IP and a DNS name.',
          tone: 'accent',
        },
        {
          condition: 'something outside, on a cluster node IP',
          result: 'NodePort',
          detail: 'Opens the same port 30000-32767 on every node',
        },
        {
          condition: 'the internet, through a cloud load balancer',
          result: 'LoadBalancer',
          detail: 'Cloud-provider only; Pending forever on a local cluster',
        },
        {
          condition: 'an external hostname, aliased inside the cluster',
          result: 'ExternalName',
          detail: 'Just a CNAME. No proxying, no selector, no endpoints.',
        },
      ],
    },
    {
      kind: 'nested',
      title: 'Each type includes the ones before it',
      caption:
        'This is why a LoadBalancer Service still has a ClusterIP, and why you can always reach it internally by DNS.',
      root: {
        label: 'type: LoadBalancer',
        detail: 'External IP from the cloud provider',
        children: [
          {
            label: 'type: NodePort',
            detail: 'A high port on every node',
            tone: 'accent',
            children: [
              {
                label: 'type: ClusterIP',
                detail: 'Virtual IP plus DNS, always present',
                tone: 'success',
                children: [{ label: 'Endpoints', detail: 'The IPs of Ready, matching Pods' }],
              },
            ],
          },
        ],
      },
    },
  ],
  keyObjects: [
    {
      kind: 'Service',
      apiVersion: 'v1',
      purpose: 'Stable virtual IP, DNS name and load balancing for a set of Pods.',
      fields: [
        {
          path: 'spec.type',
          meaning: 'ClusterIP (default), NodePort, LoadBalancer or ExternalName.',
        },
        {
          path: 'spec.selector',
          meaning: 'Equality-only label map identifying backing Pods. Absent for ExternalName.',
        },
        { path: 'spec.ports[].port', meaning: 'The port the Service listens on.', required: true },
        {
          path: 'spec.ports[].targetPort',
          meaning: 'The container port to forward to. Defaults to `port`. May be a named port.',
        },
        {
          path: 'spec.ports[].nodePort',
          meaning: 'NodePort/LoadBalancer only; 30000-32767. Auto-allocated if omitted.',
        },
        { path: 'spec.ports[].protocol', meaning: 'TCP (default), UDP or SCTP.' },
        { path: 'spec.clusterIP', meaning: 'The virtual IP. `None` makes the Service headless.' },
        { path: 'spec.externalName', meaning: 'ExternalName only: the DNS name to CNAME to.' },
        {
          path: 'spec.externalTrafficPolicy',
          meaning: 'Cluster (default) or Local, which preserves the client source IP.',
        },
        { path: 'spec.sessionAffinity', meaning: 'None (default) or ClientIP.' },
        {
          path: 'status.loadBalancer.ingress[]',
          meaning: 'LoadBalancer only: the external IP or hostname, once provisioned.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Four Services for one application',
    story: [
      'A shop application ends up with four Services, each of a different type, for four different reasons.',
      '`api` is **ClusterIP**: the web front end calls it as `http://api`. Nothing outside the cluster should reach it directly, so it has no external exposure at all.',
      "`web` is **LoadBalancer** in production: the cloud provider gives it a public IP and users hit it directly. In the developers' kind clusters the same manifest leaves EXTERNAL-IP `<pending>`, and they use `kubectl port-forward` instead - the manifest does not need to change.",
      '`debug-web` is **NodePort** on the staging bare-metal cluster, where there is no load balancer controller. QA reaches it as `http://staging-node-1:30080`.',
      '`legacy-billing` is **ExternalName** pointing at `billing.internal.example.com`, a system outside the cluster. Application code calls `http://legacy-billing` and knows nothing about the real hostname, so when billing moves the Service changes and no application does.',
      'The unifying idea: the Service name is a stable contract, and the type is a deployment detail that can differ per environment.',
    ],
    code: [
      {
        title: 'The four types side by side',
        language: 'bash',
        code: `kubectl get svc -n shop
# NAME             TYPE           CLUSTER-IP      EXTERNAL-IP                   PORT(S)        AGE
# api              ClusterIP      10.96.140.22    <none>                        80/TCP         2d
# web              LoadBalancer   10.96.201.9     203.0.113.40                  80:31234/TCP   2d
# debug-web        NodePort       10.96.88.7      <none>                        80:30080/TCP   2d
# legacy-billing   ExternalName   <none>          billing.internal.example.com  <none>         2d

# Note: the LoadBalancer has a cluster IP AND a node port AND an external IP.
# The NodePort has a cluster IP and a node port.
# ExternalName has neither - it is only a DNS record.`,
        explanation:
          'The PORT(S) column shows the nesting: `80:31234/TCP` means port 80 on the Service and node port 31234, both present on a LoadBalancer.',
        placeholders: ['shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'ClusterIP: the default and the common case',
      language: 'yaml',
      code: `apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  type: ClusterIP # the default; can be omitted
  selector:
    app: api # must match the Pod labels, equality only
  ports:
    - name: http
      port: 80 # the Service port
      targetPort: 8080 # the CONTAINER port
      protocol: TCP
# Reachable in-cluster as:
#   http://api                       (same namespace)
#   http://api.shop                  (cross-namespace)
#   http://api.shop.svc.cluster.local (fully qualified)`,
      explanation:
        '`port` and `targetPort` differing is normal and useful: callers use a conventional port while the container listens on an unprivileged one.',
      placeholders: ['api', 'shop'],
    },
    {
      title: 'NodePort and LoadBalancer',
      language: 'yaml',
      code: `apiVersion: v1
kind: Service
metadata:
  name: debug-web
  namespace: shop
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80 # cluster IP port
      targetPort: 8080 # container port
      nodePort: 30080 # must be 30000-32767; omit to auto-allocate
# Reachable as http://<any-node-ip>:30080, and also as http://debug-web in-cluster
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: shop
  annotations:
    # Cloud-specific tuning lives in annotations, which vary by provider
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
  # Preserve the real client IP; the cost is that nodes without a
  # matching Pod will refuse connections.
  externalTrafficPolicy: Local`,
      explanation:
        'On a cluster with no cloud controller manager or MetalLB, the LoadBalancer Service still works internally and via its node port - only the external IP stays `<pending>`.',
      placeholders: ['debug-web', 'web', 'shop'],
    },
    {
      title: 'ExternalName and headless',
      language: 'yaml',
      code: `# ExternalName: a DNS alias to something outside the cluster.
# No selector, no cluster IP, no proxying, no ports.
apiVersion: v1
kind: Service
metadata:
  name: legacy-billing
  namespace: shop
spec:
  type: ExternalName
  externalName: billing.internal.example.com
# In-cluster DNS for legacy-billing.shop.svc.cluster.local returns a
# CNAME to billing.internal.example.com.
---
# Headless: no virtual IP; DNS returns the Pod IPs directly.
# Required by StatefulSets, and used by clients that load balance themselves.
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: shop
spec:
  clusterIP: None # this is what makes it headless
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
# DNS for postgres.shop.svc.cluster.local returns every Pod IP (A records),
# and each StatefulSet Pod also gets postgres-0.postgres.shop.svc.cluster.local.`,
      explanation:
        'Headless is not a `type` - it is `clusterIP: None` on a ClusterIP Service. That distinction matters because `kubectl expose` cannot create one; you must write it or patch it.',
      placeholders: ['legacy-billing', 'shop', 'billing.internal.example.com', 'postgres'],
    },
  ],
  imperative: [
    {
      command: 'kubectl expose deployment api --port=80 --target-port=8080 --name=api -n shop',
      what: "Creates a ClusterIP Service whose selector is copied from the Deployment's Pod labels - so it cannot be mistyped.",
      expected: 'service/api exposed',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl expose deployment web --type=NodePort --port=80 --target-port=8080 -n shop',
      what: 'Creates a NodePort Service with an auto-allocated node port.',
      expected: 'service/web exposed',
      placeholders: ['web', 'shop'],
    },
    {
      command:
        'kubectl expose deployment web --type=LoadBalancer --port=80 --target-port=8080 -n shop',
      what: 'Creates a LoadBalancer Service. EXTERNAL-IP stays `<pending>` without a cloud provider.',
      expected: 'service/web exposed',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl create service clusterip api --tcp=80:8080 -n shop',
      what: 'Creates a Service without an existing workload. Note: the selector is `app=api`, which you may need to fix.',
      expected: 'service/api created',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl create service nodeport web --tcp=80:8080 --node-port=30080 -n shop',
      what: 'Creates a NodePort Service with a specific node port.',
      expected: 'service/web created',
      placeholders: ['web', 'shop'],
    },
    {
      command:
        'kubectl create service externalname legacy-billing --external-name=billing.internal.example.com -n shop',
      what: 'The imperative form for an ExternalName Service.',
      expected: 'service/legacy-billing created',
      placeholders: ['legacy-billing', 'billing.internal.example.com', 'shop'],
    },
    {
      command: 'kubectl get svc -n shop -o wide',
      what: 'Adds the SELECTOR column, which is what you compare against Pod labels.',
      expected: 'Type, cluster IP, ports and selector per Service.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'The authoritative check: which Pod IPs is this Service actually routing to?',
      expected: 'One IP:port per Ready Pod, or `<none>`.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl patch svc api -n shop -p \'{"spec":{"type":"NodePort"}}\'',
      what: 'Changes a Service type in place. ClusterIP → NodePort → LoadBalancer all work; the cluster IP is retained.',
      expected: 'service/api patched',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get svc web -n shop -o jsonpath=\'{.spec.ports[0].nodePort}{"\\n"}\'',
      what: 'Reads the allocated node port, which you need to build the test URL.',
      expected: '31234',
      placeholders: ['web', 'shop'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- wget -qO- http://api',
      what: 'Tests a ClusterIP Service from inside the cluster - the only way to reach one.',
      expected: 'The application response.',
      placeholders: ['shop', 'api'],
    },
  ],
  declarative: {
    steps: [
      'Choose the type by who needs to reach it: in-cluster only → ClusterIP; a specific node port for dev/bare metal → NodePort; a real external address on a cloud → LoadBalancer; an alias to something outside → ExternalName.',
      'Make the selector a subset of the Pod labels, and remember it is equality-only.',
      'Set `targetPort` to the container port, ideally by name so it survives a port renumbering.',
      'Give the Service ports names when there is more than one; it is required in that case.',
      'Verify with `kubectl get endpoints`, not by assuming the Service works because it was created.',
    ],
    code: [
      {
        title: 'Generate a Service from a Deployment, then adjust',
        language: 'bash',
        code: `# The safest way to get the selector right: let kubectl copy it
kubectl expose deployment api --port=80 --target-port=8080 \\
  --dry-run=client -o yaml > api-svc.yaml

cat api-svc.yaml | grep -A3 selector
#   selector:
#     app: api

kubectl apply -f api-svc.yaml
kubectl get endpoints api
# api   10.244.1.5:8080,10.244.2.7:8080     <- proof it works`,
        placeholders: ['api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'The single most important Service check. `<none>` means the selector matched no Ready Pods.',
      expected: 'One IP:port per Ready Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl describe svc api -n shop',
      what: 'Shows type, selector, ports, node port and endpoints together.',
      expected: 'A Selector line and a non-empty Endpoints line.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh -c "wget -qO- --timeout=3 http://api:80 | head -3"',
      what: 'End-to-end functional test of a ClusterIP Service.',
      expected: 'The application response.',
      placeholders: ['shop', 'api'],
    },
    {
      command: 'curl -s -o /dev/null -w "%{http_code}\\n" http://<node-ip>:30080',
      what: 'Tests a NodePort from outside the cluster.',
      expected: '200',
      placeholders: ['<node-ip>'],
    },
    {
      command:
        'kubectl get svc web -n shop -o jsonpath=\'{.status.loadBalancer.ingress[0].ip}{"\\n"}\'',
      what: 'The external address of a LoadBalancer, once the cloud provider has provisioned it.',
      expected: 'An IP address, or empty while pending.',
      placeholders: ['web', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get endpoints api -n shop',
      what: '`<none>` is the headline symptom: the selector matches nothing, or the Pods are not Ready.',
      expected: 'Non-empty. Empty means look at labels and readiness next.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get svc api -n shop -o jsonpath=\'{.spec.selector}{"\\n"}\' && kubectl get pods -n shop --show-labels | head -3',
      what: 'Compares the selector with the actual Pod labels, character by character.',
      expected: 'The selector keys and values present on the Pods.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=api',
      what: 'A Pod at `0/1 Running` is excluded from endpoints - a readiness problem masquerading as a Service problem.',
      expected: 'READY 1/1 for each Pod.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get svc api -n shop -o jsonpath=\'{.spec.ports[0].targetPort}{"\\n"}\' && kubectl get pod -n shop -l app=api -o jsonpath=\'{.items[0].spec.containers[0].ports[*].containerPort}{"\\n"}\'',
      what: 'Endpoints can exist while `targetPort` points at a port nothing listens on - connection refused with a healthy-looking Service.',
      expected: 'The two numbers should match (or the name should resolve).',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get svc web -n shop',
      what: 'EXTERNAL-IP stuck at `<pending>` means no cloud controller or MetalLB - not a misconfiguration.',
      expected: 'An address, or `<pending>` on a local cluster.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl port-forward svc/api -n shop 8080:80',
      what: 'Bypasses the Service data path to prove whether the application itself responds.',
      expected: 'Forwarding lines, then a successful local request.',
      placeholders: ['api', 'shop'],
    },
  ],
  commonMistakes: [
    'A Service selector that does not match the Pod labels - the number one cause of an empty endpoints list.',
    'Confusing `port` and `targetPort`. `port` is what callers use; `targetPort` is the container port.',
    'Expecting a ClusterIP Service to be reachable from your laptop. It is cluster-internal only - use `kubectl port-forward` or a NodePort.',
    'Choosing a `nodePort` outside 30000-32767, which the API server rejects.',
    'Debugging a LoadBalancer stuck at `<pending>` on kind or minikube. There is no cloud provider to fulfil it.',
    'Expecting ExternalName to do port mapping or TLS. It only creates a DNS CNAME.',
    'Trying `kubectl expose --type=ExternalName`. Use `kubectl create service externalname` instead.',
    'Forgetting that unready Pods are not endpoints, and blaming the Service for a failing readiness probe.',
    'Omitting port `name`s on a multi-port Service, which is a validation error.',
    'Believing `clusterIP: None` is a `type`. It is a field on a ClusterIP Service.',
  ],
  examTips: [
    '`kubectl expose deployment <name> --port=<p> --target-port=<t>` is the fastest and safest way to create a Service, because it copies the selector.',
    'Read the task for the type: "reachable from outside the cluster on a node port" → NodePort; "only from inside" → ClusterIP; "cloud load balancer" → LoadBalancer.',
    'Always finish with `kubectl get endpoints <svc>`. It is the difference between "I created a Service" and "the Service works".',
    'Test with `kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- http://<svc>` - memorise this command.',
    'For a headless Service, remember `clusterIP: None` must be written in YAML or patched in; no generator produces it.',
    'Node ports must be 30000-32767 unless the cluster was configured otherwise.',
  ],
  summary: [
    'ClusterIP ⊂ NodePort ⊂ LoadBalancer - each adds exposure on top of the previous one.',
    'ExternalName is only a DNS CNAME: no selector, no cluster IP, no proxying.',
    'Headless (`clusterIP: None`) returns Pod IPs from DNS and is required by StatefulSets.',
    '`port` is the Service port, `targetPort` the container port, `nodePort` the port on every node (30000-32767).',
    'Only Ready Pods become endpoints, and `kubectl get endpoints` is the definitive check.',
  ],
  practice: [
    {
      id: 'svc-p1',
      level: 'beginner',
      prompt:
        'Write the command that exposes Deployment `api` in namespace `shop` on Service port 80, forwarding to container port 8080, as a ClusterIP Service.',
      answer: 'kubectl expose deployment api --port=80 --target-port=8080 -n shop',
      explanation:
        "ClusterIP is the default so `--type` can be omitted. `kubectl expose` copies the selector from the Deployment's Pod template labels, which removes the most common source of error.",
    },
    {
      id: 'svc-p2',
      level: 'intermediate',
      prompt:
        'A Service exists with the right selector, and `kubectl get endpoints` shows two IPs, but connections are refused. What is the most likely cause?',
      answer:
        "`targetPort` does not match the port the container actually listens on. Endpoints exist because the selector matched Ready Pods, but packets are being forwarded to a port with nothing on it.\n\nCheck: `kubectl get svc <name> -o jsonpath='{.spec.ports[0].targetPort}'` against `kubectl get pod <pod> -o jsonpath='{.spec.containers[0].ports[*].containerPort}'`, and confirm inside the container with `kubectl exec <pod> -- netstat -tln`.",
      explanation:
        'Endpoints prove the *selector* is right; they say nothing about the port. Using a named `targetPort` that refers to a named `containerPort` avoids this class of mistake entirely.',
    },
    {
      id: 'svc-p3',
      level: 'advanced',
      prompt:
        'You need in-cluster clients to reach `billing.internal.example.com` (outside the cluster) as `http://billing`. Which Service type, and what are its two main limitations?',
      answer:
        'ExternalName:\n\napiVersion: v1\nkind: Service\nmetadata:\n  name: billing\n  namespace: shop\nspec:\n  type: ExternalName\n  externalName: billing.internal.example.com\n\nLimitations: (1) it is only a DNS CNAME, so there is no port mapping - clients must use the port the external host serves; (2) there is no proxying, health checking or TLS termination, and the HTTP `Host` header still says `billing`, which breaks virtual-hosted external services.',
      explanation:
        'The alternative when you need real proxying is a Service with no selector plus a manually managed EndpointSlice pointing at the external IP - that gives you a cluster IP and proper port mapping.',
    },
  ],
  lab: {
    title: 'Create all four Service types and prove what each does',
    scenario:
      'You will expose one Deployment as ClusterIP, then NodePort, then LoadBalancer, observe the nesting, create an ExternalName and a headless Service, and break a selector to see the empty-endpoints signature.',
    prerequisites: [
      'A cluster (kind or minikube is fine - LoadBalancer will stay pending, which is part of the lesson)',
    ],
    tasks: [
      { instruction: 'Create namespace `svc-lab` and set it as default.' },
      { instruction: 'Create a Deployment `web` with 2 replicas of nginx listening on 80.' },
      {
        instruction:
          'Expose it as ClusterIP on port 8080 → 80, confirm endpoints, and test it from a temporary Pod.',
      },
      {
        instruction:
          'Patch the Service to NodePort and note that it keeps its cluster IP and gains a node port.',
      },
      {
        instruction:
          'Patch it to LoadBalancer and observe EXTERNAL-IP pending while the cluster IP and node port remain.',
      },
      { instruction: 'Create an ExternalName Service and resolve it from a temporary Pod.' },
      {
        instruction:
          'Create a headless Service and show that DNS returns Pod IPs instead of a single virtual IP.',
      },
      {
        instruction:
          'Break the ClusterIP Service selector and confirm endpoints go to `<none>`; then fix it.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - ClusterIP',
        language: 'bash',
        code: `kubectl create namespace svc-lab
kubectl config set-context --current --namespace=svc-lab

kubectl create deployment web --image=nginx:1.27-alpine --replicas=2
kubectl rollout status deploy/web --timeout=120s

kubectl expose deployment web --port=8080 --target-port=80 --name=web-ip
kubectl get svc web-ip
# NAME     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)     AGE
# web-ip   ClusterIP   10.96.140.22   <none>        8080/TCP    5s

kubectl get endpoints web-ip
# web-ip   10.244.1.5:80,10.244.2.7:80      <- two Ready Pods

kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://web-ip:8080 | head -4
# <!DOCTYPE html> ...`,
      },
      {
        title: 'Steps 4-5 - the nesting',
        language: 'bash',
        code: `kubectl patch svc web-ip -p '{"spec":{"type":"NodePort"}}'
kubectl get svc web-ip
# NAME     TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)          AGE
# web-ip   NodePort   10.96.140.22   <none>        8080:31543/TCP   1m
#                     ^^^^^^^^^^^^ same cluster IP     ^^^^^ node port added

NODEPORT=$(kubectl get svc web-ip -o jsonpath='{.spec.ports[0].nodePort}')
NODEIP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
echo "try: curl http://$NODEIP:$NODEPORT"
# On kind, the node IP is inside a Docker network - use
# kubectl port-forward, or a kind extraPortMapping, to reach it from the host.

kubectl patch svc web-ip -p '{"spec":{"type":"LoadBalancer"}}'
kubectl get svc web-ip
# NAME     TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)          AGE
# web-ip   LoadBalancer   10.96.140.22   <pending>     8080:31543/TCP   2m
#                                        ^^^^^^^^^ no cloud provider here
# Cluster IP and node port are both still present - and still work.
kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://web-ip:8080 -O /dev/null && echo "clusterIP still works"`,
      },
      {
        title: 'Steps 6-7 - ExternalName and headless',
        language: 'bash',
        code: `kubectl create service externalname upstream --external-name=example.com

kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  nslookup upstream.svc-lab.svc.cluster.local
# Name:      upstream.svc-lab.svc.cluster.local
# Address 1: ...           (resolved via a CNAME to example.com)

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: web-headless
  namespace: svc-lab
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - port: 80
YAML

kubectl get svc web-headless
# NAME           TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
# web-headless   ClusterIP   None         <none>        80/TCP    5s
#                            ^^^^ no virtual IP

kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  nslookup web-headless.svc-lab.svc.cluster.local
# Address 1: 10.244.1.5     <- the POD IPs, not a service IP
# Address 2: 10.244.2.7`,
      },
      {
        title: 'Steps 8-9 - break it, fix it, clean up',
        language: 'bash',
        code: `kubectl patch svc web-ip -p '{"spec":{"selector":{"app":"webs"}}}'
sleep 5
kubectl get endpoints web-ip
# web-ip   <none>            <- the classic failure signature

kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://web-ip:8080 || echo "connection failed, as expected"

# Compare selector with reality
kubectl get svc web-ip -o jsonpath='{.spec.selector}{"\\n"}'
# {"app":"webs"}
kubectl get pods --show-labels | head -2
# web-...   1/1  Running  app=web,pod-template-hash=...

kubectl patch svc web-ip -p '{"spec":{"selector":{"app":"web"}}}'
sleep 5
kubectl get endpoints web-ip
# web-ip   10.244.1.5:80,10.244.2.7:80      <- fixed

kubectl config set-context --current --namespace=default
kubectl delete namespace svc-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get endpoints web-ip -n svc-lab',
        what: 'The definitive Service check at every stage of the lab.',
        expected: 'Two Pod IPs when the selector is correct, `<none>` when it is not.',
      },
      {
        command:
          "kubectl get svc -n svc-lab -o custom-columns='NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP,NODEPORT:.spec.ports[0].nodePort'",
        what: 'Shows the nesting and the headless Service side by side.',
        expected:
          'web-ip with a cluster IP and node port; web-headless with clusterIP None; upstream with neither.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace svc-lab',
        what: 'Removes the Deployment and all four Services.',
        expected: 'namespace "svc-lab" deleted',
      },
    ],
  },
  relatedTopicIds: [
    'service-ports-and-endpoints',
    'dns-and-service-discovery',
    'labels-selectors-annotations',
  ],
  docs: [
    { title: 'Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
    {
      title: 'Connect a frontend to a backend using services',
      url: 'https://kubernetes.io/docs/tasks/access-application-cluster/connecting-frontend-backend/',
    },
  ],
}
