import type { Topic } from '../../../types'

export const servicePortsAndEndpoints: Topic = {
  id: 'service-ports-and-endpoints',
  title: 'Ports, selectors, Endpoints and EndpointSlices',
  domainId: 'services-networking',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 2,
  tags: ['port', 'targetPort', 'nodePort', 'endpoints', 'endpointslice', 'named ports', 'selector'],
  oneLiner:
    'The three ports that mean three different things, and the Endpoints object that proves whether a Service is wired up at all.',
  explanation: [
    'A Service has up to three port numbers per entry, and they are frequently confused. **`port`** is what the Service itself listens on (on its cluster IP). **`targetPort`** is the port on the Pod that traffic is forwarded to. **`nodePort`** is the port opened on every node, for NodePort and LoadBalancer Services only.',
    'Traffic flows `client → clusterIP:port → podIP:targetPort`. Nothing requires these to be equal, and in practice they often differ: callers use port 80 while a hardened container listens on 8080.',
    '**Endpoints** (and the newer **EndpointSlice**) are objects maintained by the cluster, not by you. When a Service has a selector, the endpoints controller watches for matching **Ready** Pods and records their IPs and ports. If that list is empty, the Service cannot work, whatever else looks correct.',
    'EndpointSlice is the modern, scalable form: instead of one Endpoints object containing thousands of addresses, addresses are sharded across several EndpointSlices of up to 100 each. The legacy `Endpoints` object is still maintained for compatibility and is what `kubectl get endpoints` shows.',
    'A Service with **no selector** gets no automatic endpoints - which is a feature. You can create the EndpointSlice yourself to point a cluster Service at an external IP, giving you a stable in-cluster name with real port mapping (something ExternalName cannot do).',
  ],
  whyItMatters: [
    'Almost every Service problem is one of two things: the selector matched nothing (empty endpoints) or `targetPort` is wrong (endpoints exist, connections refused). Being able to distinguish them in two commands is the core skill.',
    'Named ports make manifests robust: `targetPort: http` keeps working when the container port number changes, and reads better in probes and Services alike.',
    'The manual-endpoints trick is the correct answer to "give this external database a cluster-internal name and port", which appears in real migrations.',
  ],
  howItWorks: [
    '`targetPort` defaults to the value of `port` if omitted. That default is why a Service with `port: 80` and a container listening on 8080 silently fails - the Service is forwarding to port 80 on the Pod.',
    '`targetPort` may be a **name** referring to a `containerPort` name in the Pod spec. The name is resolved per Pod, so different Pods behind one Service could even use different numbers.',
    'A multi-port Service **must** name every port. With one port the name is optional, but naming it anyway makes `targetPort` and Ingress references clearer.',
    'The endpoints controller only includes Pods that are Ready. `publishNotReadyAddresses: true` overrides this and is used mainly by headless Services for StatefulSets that need to discover peers during startup.',
    'EndpointSlice objects carry `addresses`, `conditions` (ready, serving, terminating), `ports`, and a `kubernetes.io/service-name` label linking them to their Service. `endpointslice.kubernetes.io/managed-by` shows whether the controller or you own them.',
    'During a rolling update, terminating Pods are marked `serving: true, terminating: true` for their grace period, which lets kube-proxy drain them rather than cutting connections abruptly.',
    "For a selector-less Service you create an EndpointSlice with a matching `kubernetes.io/service-name` label and the addresses you want. kube-proxy then forwards the Service's cluster IP to those addresses, including port translation.",
  ],
  keyObjects: [
    {
      kind: 'Service',
      apiVersion: 'v1',
      purpose: 'Defines the ports and the selector that produce endpoints.',
      fields: [
        {
          path: 'spec.ports[].name',
          meaning:
            'Required when there is more than one port; referenced by Ingress and by targetPort names.',
        },
        { path: 'spec.ports[].port', meaning: 'Port on the Service cluster IP.', required: true },
        {
          path: 'spec.ports[].targetPort',
          meaning: 'Pod port; number or containerPort name. Defaults to `port`.',
        },
        { path: 'spec.ports[].nodePort', meaning: 'NodePort/LoadBalancer only, 30000-32767.' },
        {
          path: 'spec.ports[].appProtocol',
          meaning: 'Hint such as http, https or grpc, used by some load balancers.',
        },
        {
          path: 'spec.selector',
          meaning: 'Absent means no automatic endpoints - you manage them yourself.',
        },
        {
          path: 'spec.publishNotReadyAddresses',
          meaning: 'true includes unready Pods; used by headless StatefulSet Services.',
        },
      ],
    },
    {
      kind: 'EndpointSlice',
      apiVersion: 'discovery.k8s.io/v1',
      purpose: 'The scalable list of backend addresses for a Service.',
      fields: [
        {
          path: 'metadata.labels["kubernetes.io/service-name"]',
          meaning: 'Links the slice to its Service. Required.',
          required: true,
        },
        { path: 'addressType', meaning: 'IPv4, IPv6 or FQDN.', required: true },
        { path: 'endpoints[].addresses[]', meaning: 'Backend IPs.', required: true },
        {
          path: 'endpoints[].conditions.ready',
          meaning: 'Whether this address should receive traffic.',
        },
        {
          path: 'endpoints[].conditions.terminating',
          meaning: 'true while a Pod is shutting down.',
        },
        {
          path: 'endpoints[].targetRef',
          meaning: 'The Pod this address belongs to, when controller-managed.',
        },
        { path: 'ports[]', meaning: 'Resolved port numbers and names for these addresses.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Endpoints present, connections refused',
    story: [
      'A team hardens their nginx Deployment: non-root user, so it now listens on 8080 instead of 80. The Service manifest is unchanged: `port: 80` with no `targetPort`.',
      'Everything looks healthy. The Pods are `1/1 Running`, `kubectl get endpoints web` lists two addresses, and the Service has a cluster IP. Every request gets connection refused.',
      'The clue is in the endpoints output itself: `10.244.1.5:80,10.244.2.7:80`. Port 80 - because `targetPort` defaults to `port`, and nothing is listening on 80 inside the container any more.',
      'The fix is one line: `targetPort: 8080`. Better still, name the container port `http` and use `targetPort: http`, so the Service follows the container if the number changes again.',
      'The diagnostic rule this produces: empty endpoints means a selector problem; endpoints with the *wrong port number* means a targetPort problem. The endpoints output tells you which, because it prints the resolved port.',
    ],
    code: [
      {
        title: 'The port is right there in the endpoints output',
        language: 'bash',
        code: `kubectl get endpoints web -n shop
# NAME   ENDPOINTS                          AGE
# web    10.244.1.5:80,10.244.2.7:80        5m
#                    ^^ forwarding to port 80...

kubectl get pod -n shop -l app=web \\
  -o jsonpath='{.items[0].spec.containers[0].ports[*].containerPort}{"\\n"}'
# 8080                       # ...but the container listens on 8080

kubectl patch svc web -n shop -p '{"spec":{"ports":[{"port":80,"targetPort":8080}]}}'
kubectl get endpoints web -n shop
# web    10.244.1.5:8080,10.244.2.7:8080    <- fixed`,
        explanation:
          'Reading the port in the endpoints list, not just whether the list is empty, is what makes this a ten-second diagnosis.',
        placeholders: ['web', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Named ports, used consistently',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: nginx:1.27-alpine
          ports:
            - name: http # NAME the container port...
              containerPort: 8080
            - name: metrics
              containerPort: 9090
          readinessProbe:
            httpGet:
              path: /
              port: http # ...and reference it here...
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api
  ports:
    # Multi-port Services MUST name every port
    - name: http
      port: 80 # callers use 80
      targetPort: http # ...and here. Survives a renumbering.
    - name: metrics
      port: 9090
      targetPort: metrics`,
      explanation:
        'Using names in three places (containerPort, probe, targetPort) means changing 8080 to 8081 requires editing exactly one line.',
      placeholders: ['api', 'shop'],
    },
    {
      title: 'What the controller creates for you',
      language: 'yaml',
      code: `# kubectl get endpointslice -l kubernetes.io/service-name=api -o yaml
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: api-x7k2m
  namespace: shop
  labels:
    kubernetes.io/service-name: api # links it to the Service
    endpointslice.kubernetes.io/managed-by: endpointslice-controller.k8s.io
addressType: IPv4
endpoints:
  - addresses: ["10.244.1.5"]
    conditions:
      ready: true
      serving: true
      terminating: false
    nodeName: worker-1
    targetRef:
      kind: Pod
      name: api-6d4b8f9c7-2xk4l
      namespace: shop
  - addresses: ["10.244.2.7"]
    conditions:
      ready: false # failing readiness probe -> no traffic
      serving: false
      terminating: false
    nodeName: worker-2
    targetRef:
      kind: Pod
      name: api-6d4b8f9c7-8n7pq
      namespace: shop
ports:
  - name: http
    port: 8080 # the RESOLVED targetPort
    protocol: TCP
  - name: metrics
    port: 9090
    protocol: TCP`,
      explanation:
        'The per-endpoint `conditions` are richer than the legacy Endpoints object: `ready` controls traffic, and `serving`/`terminating` let kube-proxy drain a Pod during shutdown instead of dropping its connections.',
      placeholders: ['api', 'shop'],
    },
    {
      title: 'A selector-less Service pointing at an external database',
      language: 'yaml',
      code: `# A Service with no selector: nothing populates its endpoints automatically.
apiVersion: v1
kind: Service
metadata:
  name: external-db
  namespace: shop
spec:
  # NO selector
  ports:
    - name: postgres
      port: 5432 # in-cluster port
      targetPort: 5432 # port on the external host
---
# You supply the addresses yourself.
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: external-db-1
  namespace: shop
  labels:
    kubernetes.io/service-name: external-db # MUST match the Service name
addressType: IPv4
endpoints:
  - addresses: ["192.0.2.42"] # the external database IP
    conditions:
      ready: true
ports:
  - name: postgres
    port: 5432
    protocol: TCP`,
      explanation:
        'Unlike ExternalName, this gives you a real cluster IP with port translation, so applications connect to `external-db:5432` and NetworkPolicies and Services behave normally. The cost is that you maintain the address list.',
      placeholders: ['external-db', 'shop', '192.0.2.42'],
    },
    {
      title: 'publishNotReadyAddresses for StatefulSet peer discovery',
      language: 'yaml',
      code: `apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: shop
spec:
  clusterIP: None # headless
  # Include Pods that are not yet Ready, so cluster members can find each
  # other during startup - a chicken-and-egg problem otherwise.
  publishNotReadyAddresses: true
  selector:
    app: postgres
  ports:
    - name: postgres
      port: 5432`,
      explanation:
        'Only correct for headless Services used for peer discovery. On a normal Service this would send traffic to Pods that are not ready to serve it.',
      placeholders: ['postgres', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'The legacy view: which addresses and ports a Service routes to. The fastest health check.',
      expected: '10.244.1.5:8080,10.244.2.7:8080',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get endpointslices -n shop -l kubernetes.io/service-name=api',
      what: 'The modern view; also the only place per-endpoint conditions appear.',
      expected: 'One or more slices with ADDRESSTYPE, PORTS and ENDPOINTS columns.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get endpointslice -n shop -l kubernetes.io/service-name=api -o yaml | grep -A4 conditions',
      what: 'Shows ready/serving/terminating per address - the detail Endpoints hides.',
      expected: 'ready: true for healthy Pods.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get svc api -n shop -o jsonpath=\'{range .spec.ports[*]}{.name}{": port="}{.port}{" target="}{.targetPort}{" node="}{.nodePort}{"\\n"}{end}\'',
      what: 'All three port numbers per entry, laid out clearly.',
      expected: 'http: port=80 target=http node=',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get pod -n shop -l app=api -o jsonpath=\'{range .items[0].spec.containers[0].ports[*]}{.name}{"="}{.containerPort}{" "}{end}{"\\n"}\'',
      what: 'The container ports and their names, to compare against `targetPort`.',
      expected: 'http=8080 metrics=9090',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe svc api -n shop',
      what: 'Selector, ports, targetPort and endpoints in one output.',
      expected: 'Endpoints: 10.244.1.5:8080,10.244.2.7:8080',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl patch svc api -n shop -p \'{"spec":{"ports":[{"name":"http","port":80,"targetPort":8080}]}}\'',
      what: 'Corrects a targetPort. Note a ports patch replaces the whole list, so include every port.',
      expected: 'service/api patched',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- netstat -tln 2>/dev/null || kubectl exec api-6d4b8f9c7-2xk4l -n shop -- sh -c "ss -tln"',
      what: 'What the container is actually listening on - the ground truth for targetPort.',
      expected: 'A LISTEN line on 0.0.0.0:8080.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- wget -qO- --timeout=3 http://10.244.1.5:8080',
      what: 'Bypasses the Service and hits a Pod IP directly - separates "the Pod is broken" from "the Service is misconfigured".',
      expected: 'The application response.',
      placeholders: ['shop', '10.244.1.5'],
    },
  ],
  declarative: {
    steps: [
      'Name the container ports, then reference those names from probes and from `targetPort`.',
      'Always set `targetPort` explicitly - relying on the default equal to `port` is the most common cause of a silently broken Service.',
      'Name every port on a multi-port Service; it is required, and Ingress references need it.',
      'Never write Endpoints or EndpointSlices for a Service that has a selector - the controller owns them.',
      'Do write an EndpointSlice for a selector-less Service pointing at an external address.',
      'Verify by reading the endpoints output, including the port numbers, not just whether it is non-empty.',
    ],
    code: [
      {
        title: 'The two-command Service verification',
        language: 'bash',
        code: `SVC=api; NS=shop

# 1. Are there endpoints, and are the PORTS right?
kubectl get endpoints $SVC -n $NS
# api   10.244.1.5:8080,10.244.2.7:8080

# 2. Does the container agree?
POD=$(kubectl get pods -n $NS -l app=$SVC -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$POD" -n $NS -- sh -c 'netstat -tln 2>/dev/null | grep LISTEN'
# tcp  0.0.0.0:8080  LISTEN

# 3. Functional test through the Service
kubectl run tmp --rm -it --restart=Never -n $NS --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 "http://$SVC" -O /dev/null && echo OK`,
        placeholders: ['api', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'Non-empty with the correct port is the definition of a working Service.',
      expected: 'One IP:targetPort per Ready Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get endpointslice -n shop -l kubernetes.io/service-name=api -o jsonpath=\'{range .items[*].endpoints[*]}{.addresses[0]}{" ready="}{.conditions.ready}{"\\n"}{end}\'',
      what: 'Per-address readiness, which explains a Service with fewer endpoints than Pods.',
      expected: 'ready=true for each serving Pod.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get svc api -n shop -o jsonpath=\'{.spec.ports[0].targetPort}{"\\n"}\'',
      what: 'Confirms the targetPort you intended is what is stored.',
      expected: 'http, or 8080.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- wget -qO- --timeout=3 http://api',
      what: 'The end-to-end check through cluster DNS, the Service and the endpoints.',
      expected: 'The application response.',
      placeholders: ['shop', 'api'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get endpoints api -n shop',
      what: '`<none>` → selector or readiness problem. Present but with an unexpected port → targetPort problem.',
      expected: 'The list, which discriminates between the two failure modes.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get svc api -n shop -o jsonpath=\'{.spec.selector}{"\\n"}\' && kubectl get pods -n shop --show-labels | head -3',
      what: 'For empty endpoints, compare the selector with the real labels.',
      expected: 'Matching keys and values.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=api',
      what: 'For empty endpoints with a correct selector, the Pods are not Ready.',
      expected: 'READY 1/1.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- sh -c "netstat -tln 2>/dev/null | grep LISTEN"',
      what: 'For endpoints present but connections refused, confirm the listening port.',
      expected: 'A LISTEN entry matching the resolved targetPort.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command:
        'kubectl get endpointslice -n shop -l kubernetes.io/service-name=api -o yaml | grep -c "addresses"',
      what: 'With very many Pods, addresses are sharded across several slices - the legacy Endpoints object may be truncated.',
      expected: 'A count matching your Ready Pod count.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl apply -f svc.yaml',
      what: 'A multi-port Service with unnamed ports is rejected here.',
      expected: 'spec.ports[1].name: Required value',
      placeholders: ['svc.yaml'],
    },
  ],
  commonMistakes: [
    'Omitting `targetPort` when the container port differs from `port` - it defaults to `port` and forwards to a closed port.',
    'Reading only whether endpoints exist, not which port they list. The port is the second half of the diagnosis.',
    'Writing Endpoints or EndpointSlices by hand for a Service that has a selector - the controller overwrites them.',
    'Forgetting to name ports on a multi-port Service, which is a validation error.',
    'Using a `targetPort` name that does not exist as a `containerPort` name; it resolves to nothing and the Pod is excluded.',
    'Expecting unready Pods to receive traffic. They are excluded unless `publishNotReadyAddresses: true`.',
    'Patching `spec.ports` with a partial list - a strategic-merge patch on a list replaces it, so include every port.',
    'Setting `publishNotReadyAddresses: true` on a normal Service, which sends traffic to Pods that are not ready.',
  ],
  examTips: [
    'The three-port mnemonic: `port` = the Service, `targetPort` = the Pod, `nodePort` = every node.',
    '`kubectl get endpoints <svc>` is the highest-value networking command in the exam. Read both the addresses and the ports.',
    'Always set `targetPort` explicitly, even when it equals `port` - it costs one line and prevents a silent failure.',
    '`kubectl expose deployment <name> --port=80 --target-port=8080` gets both right in one command.',
    'If a task involves an external endpoint with a cluster-internal name and port, that is a selector-less Service plus a hand-written EndpointSlice.',
    'For "why is only one of three Pods receiving traffic", check per-endpoint `conditions.ready` in the EndpointSlice.',
  ],
  summary: [
    '`port` (Service) → `targetPort` (Pod) → `nodePort` (every node, NodePort/LoadBalancer only).',
    '`targetPort` defaults to `port`, which is the most common silent misconfiguration.',
    'Named container ports referenced from probes and `targetPort` make manifests resilient.',
    'Endpoints/EndpointSlices are controller-managed for Services with a selector, and list only Ready Pods.',
    'A selector-less Service plus a hand-written EndpointSlice gives an external address a real cluster IP and port mapping.',
  ],
  practice: [
    {
      id: 'ep-p1',
      level: 'beginner',
      prompt:
        'A Service has `port: 80` and no `targetPort`. The container listens on 8080. What happens and what is the fix?',
      answer:
        '`targetPort` defaults to `port`, so the Service forwards to port 80 on the Pod, where nothing is listening - every connection is refused even though endpoints exist. Fix: add `targetPort: 8080` (or better, name the container port `http` and use `targetPort: http`).',
      explanation:
        '`kubectl get endpoints <svc>` shows `10.244.1.5:80`, and the wrong port number in that output is the diagnosis.',
    },
    {
      id: 'ep-p2',
      level: 'intermediate',
      prompt:
        'A Deployment has 3 replicas but `kubectl get endpoints` shows only 2 addresses. Give the command that explains why.',
      answer:
        'kubectl get endpointslice -n <ns> -l kubernetes.io/service-name=<svc> -o jsonpath=\'{range .items[*].endpoints[*]}{.addresses[0]}{" ready="}{.conditions.ready}{"\\n"}{end}\'\n\nOr more simply: `kubectl get pods -l <selector>` and look for a Pod at `0/1 Running`.',
      explanation:
        'Only Ready Pods become endpoints. The third Pod is running but failing its readiness probe, so it is deliberately excluded from load balancing.',
    },
    {
      id: 'ep-p3',
      level: 'advanced',
      prompt:
        'You must give an external database at 192.0.2.42:5432 the in-cluster name `db` on port 5432, with real port mapping. Write both objects and say why ExternalName is not suitable.',
      answer:
        'apiVersion: v1\nkind: Service\nmetadata: {name: db, namespace: shop}\nspec:\n  ports:\n    - name: postgres\n      port: 5432\n      targetPort: 5432\n---\napiVersion: discovery.k8s.io/v1\nkind: EndpointSlice\nmetadata:\n  name: db-1\n  namespace: shop\n  labels:\n    kubernetes.io/service-name: db\naddressType: IPv4\nendpoints:\n  - addresses: ["192.0.2.42"]\n    conditions: {ready: true}\nports:\n  - name: postgres\n    port: 5432\n\nExternalName only creates a DNS CNAME - there is no cluster IP, no port translation, and NetworkPolicies cannot select it. A selector-less Service gives a real cluster IP with proxying.',
      explanation:
        'The `kubernetes.io/service-name` label is what links the slice to the Service; without it the Service has no endpoints. Because there is no selector, the endpoints controller leaves your slice alone.',
    },
  ],
  lab: {
    title: 'Break and fix every port, and wire up an external endpoint',
    scenario:
      'You will produce both Service failure modes deliberately - empty endpoints and wrong targetPort - fix each, use named ports, and then point a cluster Service at an external address with a hand-written EndpointSlice.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `ep-lab` and set it as default.' },
      {
        instruction:
          'Create a Deployment whose container listens on 8080 (nginx with a ConfigMap), with the container port named `http`.',
      },
      {
        instruction:
          'Create a Service with `port: 80` and NO targetPort; observe endpoints on the wrong port and a refused connection.',
      },
      {
        instruction:
          'Fix it with `targetPort: http` and confirm the endpoints port changes and requests succeed.',
      },
      {
        instruction:
          'Break the selector; confirm endpoints become `<none>` and note the different symptom.',
      },
      {
        instruction:
          'Fix the selector, then make one Pod unready and watch the endpoint count drop.',
      },
      { instruction: 'Inspect the EndpointSlice conditions for the unready Pod.' },
      {
        instruction:
          "Create a selector-less Service plus an EndpointSlice pointing at another Pod's IP, and reach it through the new name.",
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - a container on 8080 with a named port',
        language: 'bash',
        code: `kubectl create namespace ep-lab
kubectl config set-context --current --namespace=ep-lab

kubectl create configmap nginx-8080 --from-literal=default.conf='
server {
  listen 8080;
  location / { return 200 "hello from 8080\\n"; add_header Content-Type text/plain; }
}'

cat <<'YAML' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata: {name: web, namespace: ep-lab}
spec:
  replicas: 2
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}
    spec:
      volumes:
        - name: conf
          configMap: {name: nginx-8080}
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - name: http          # named container port
              containerPort: 8080
          volumeMounts:
            - {name: conf, mountPath: /etc/nginx/conf.d, readOnly: true}
          readinessProbe:
            httpGet: {path: /, port: http}
            periodSeconds: 3
YAML

kubectl rollout status deploy/web --timeout=120s`,
      },
      {
        title: 'Steps 3-4 - the targetPort failure and fix',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata: {name: web, namespace: ep-lab}
spec:
  selector: {app: web}
  ports:
    - port: 80        # no targetPort -> defaults to 80
YAML

kubectl get endpoints web
# web   10.244.1.5:80,10.244.2.7:80        <- port 80, nothing listening there

kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://web || echo "refused, as expected"

# Fix with the NAMED port
kubectl patch svc web -p '{"spec":{"ports":[{"name":"http","port":80,"targetPort":"http"}]}}'
kubectl get endpoints web
# web   10.244.1.5:8080,10.244.2.7:8080    <- resolved via the port name

kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://web
# hello from 8080`,
      },
      {
        title: 'Steps 5-7 - selector failure, then readiness',
        language: 'bash',
        code: `# Failure mode 2: selector matches nothing
kubectl patch svc web -p '{"spec":{"selector":{"app":"nope"}}}'
sleep 5
kubectl get endpoints web
# web   <none>          <- a DIFFERENT symptom from the wrong-port case

kubectl patch svc web -p '{"spec":{"selector":{"app":"web"}}}'
sleep 5
kubectl get endpoints web       # two addresses again

# Make ONE Pod unready by breaking its probe path via a direct Pod patch
POD=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl patch pod "$POD" --type=json -p='[{"op":"replace",
  "path":"/spec/containers/0/readinessProbe/httpGet/path","value":"/nope"}]' 2>/dev/null \\
  || kubectl exec "$POD" -- sh -c 'rm -f /etc/nginx/conf.d/default.conf 2>/dev/null; true'

sleep 15
kubectl get pods -l app=web
# one Pod at 0/1 Running
kubectl get endpoints web
# web   10.244.2.7:8080            <- only ONE address now

kubectl get endpointslice -l kubernetes.io/service-name=web \\
  -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{" ready="}{.conditions.ready}{"\\n"}{end}'
# 10.244.1.5 ready=false
# 10.244.2.7 ready=true`,
      },
      {
        title: 'Step 8 - a selector-less Service with manual endpoints',
        language: 'bash',
        code: `# Use a real Pod IP as the "external" address so the lab works anywhere
TARGET_IP=$(kubectl get pods -l app=web -o jsonpath='{.items[1].status.podIP}')
echo "pointing at $TARGET_IP"

cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: external-web
  namespace: ep-lab
spec:
  # NO selector - we manage the endpoints ourselves
  ports:
    - name: http
      port: 9000        # in-cluster port
      targetPort: 8080  # port on the "external" host
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: external-web-1
  namespace: ep-lab
  labels:
    kubernetes.io/service-name: external-web
addressType: IPv4
endpoints:
  - addresses: ["$TARGET_IP"]
    conditions:
      ready: true
ports:
  - name: http
    port: 8080
    protocol: TCP
YAML

kubectl get endpoints external-web
# external-web   10.244.2.7:8080

# Port translation works: we ask for 9000, it forwards to 8080
kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://external-web:9000
# hello from 8080`,
      },
      {
        title: 'Step 9 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace ep-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get endpoints -n ep-lab',
        what: 'Both Services should list addresses with port 8080.',
        expected: 'web with the Ready Pods and external-web with the manual address.',
      },
      {
        command:
          'kubectl get endpointslice -n ep-lab -l kubernetes.io/service-name=web -o jsonpath=\'{range .items[*].endpoints[*]}{.conditions.ready}{" "}{end}{"\\n"}\'',
        what: 'Confirms per-endpoint readiness is what excludes a Pod.',
        expected: 'true and false while one Pod is unready.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace ep-lab',
        what: 'Removes the Deployment, Services and EndpointSlice.',
        expected: 'namespace "ep-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['service-types', 'troubleshooting-networking', 'probes'],
  docs: [
    {
      title: 'Service - defining a Service',
      url: 'https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service',
    },
    {
      title: 'EndpointSlices',
      url: 'https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/',
    },
    {
      title: 'Services without selectors',
      url: 'https://kubernetes.io/docs/concepts/services-networking/service/#services-without-selectors',
    },
  ],
}
