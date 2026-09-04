import type { Topic } from '../../../types'

export const troubleshootingNetworking: Topic = {
  id: 'troubleshooting-networking',
  title: 'Troubleshooting DNS, Services and connectivity',
  domainId: 'services-networking',
  difficulty: 'intermediate',
  estimatedMinutes: 22,
  order: 6,
  tags: ['troubleshooting', 'curl', 'wget', 'nslookup', 'nc', 'port-forward', 'endpoints', 'debug'],
  oneLiner:
    'A fixed six-layer procedure that finds any connectivity fault in a few minutes, and the temporary-Pod toolkit it runs on.',
  explanation: [
    'Connectivity problems feel unpredictable because there are six independent things that must all work. Checking them in a fixed order turns guesswork into a short procedure.',
    'The layers, from the application outwards: **(1)** is the application listening at all? **(2)** does the name resolve? **(3)** does the Service have endpoints? **(4)** does the port match? **(5)** is a NetworkPolicy blocking it? **(6)** is the external path (Ingress, NodePort, LoadBalancer) configured?',
    'The key insight is that each layer has a test that *isolates* it. `kubectl port-forward` bypasses Services, DNS and policies, so if it works the application is fine and the fault is further out. `nslookup` tests only resolution. `kubectl get endpoints` tests only the selector and readiness. Connecting to a Pod IP directly bypasses the Service but not policies.',
    'The tool for all of this is a temporary Pod: `kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh`. It gives you `nslookup`, `nc`, `wget` and `ping` inside the cluster network, and deletes itself when you exit. For richer tooling (`curl`, `dig`, `tcpdump`) use `nicolaka/netshoot`.',
    'Symptom names map to layers. "Could not resolve host" is layer 2. "Connection refused" from a Service usually means layer 3 or 4. A *timeout* rather than a refusal often means layer 5 - a policy silently dropping packets rather than rejecting them.',
  ],
  whyItMatters: [
    '"Provide and troubleshoot access to applications via services" is a named curriculum competency, and troubleshooting tasks are where candidates lose the most time.',
    'A fixed order prevents the common failure mode of re-reading YAML for ten minutes when one command would have identified the layer.',
    'The refused-versus-timeout distinction is a genuinely useful shortcut: refusal means something answered, a timeout means something dropped the packet.',
  ],
  howItWorks: [
    'Layer 1 - the application. `kubectl port-forward pod/<pod> 8080:<containerPort>` goes through the API server, bypassing Services, DNS, kube-proxy and NetworkPolicies. If this works, layers 2-6 are where the fault is.',
    'Layer 2 - DNS. Test `kubernetes.default` first as a control; if that fails, cluster DNS is broken for everyone. Then test the short name and the FQDN: short failing while FQDN works means a namespace/search-domain issue.',
    'Layer 3 - endpoints. `kubectl get endpoints <svc>` returning `<none>` means the selector matched no *Ready* Pods. Compare `spec.selector` with `--show-labels`, then check the READY column.',
    'Layer 4 - ports. Endpoints exist but list the wrong port means `targetPort` is wrong. Confirm what the container listens on with `netstat -tln` or `ss -tln` inside it.',
    'Layer 5 - NetworkPolicy. Test with a temporary Pod carrying the *labels a policy would allow*, and again without them. A timeout where a Pod-IP connection also times out, while `port-forward` works, points here.',
    'Layer 6 - external path. For Ingress: empty ADDRESS means no controller, 503 means no backend, 404 means no matching rule. For NodePort: check the port is in range and that you are using a node IP. For LoadBalancer: `<pending>` means no cloud provider.',
    'Response signatures worth memorising: **connection refused** - something is there but nothing is listening on that port; **timeout** - packets are being dropped (policy, wrong IP, no route); **no such host** - DNS; **503** - a proxy found no healthy backend; **404** - a proxy found no matching route.',
  ],
  keyObjects: [
    {
      kind: 'Service',
      apiVersion: 'v1',
      purpose: 'The object whose selector and ports cause layers 3 and 4.',
      fields: [
        { path: 'spec.selector', meaning: 'Compare against Pod labels when endpoints are empty.' },
        {
          path: 'spec.ports[].targetPort',
          meaning: 'Compare against the container port when connections are refused.',
        },
      ],
    },
    {
      kind: 'Endpoints / EndpointSlice',
      apiVersion: 'v1 / discovery.k8s.io/v1',
      purpose: 'The evidence for whether a Service is wired to anything.',
      fields: [
        {
          path: 'subsets[].addresses[]',
          meaning: 'Ready Pod IPs. Empty means selector or readiness failure.',
        },
        {
          path: 'endpoints[].conditions.ready',
          meaning: 'Per-address readiness in an EndpointSlice.',
        },
      ],
    },
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Layers 1 and 2 live here.',
      fields: [
        { path: 'status.podIP', meaning: 'Connect to this directly to bypass the Service.' },
        {
          path: 'status.conditions[?(@.type=="Ready")]',
          meaning: 'False means the Pod is excluded from endpoints.',
        },
        {
          path: 'spec.dnsPolicy',
          meaning: '`Default` disables cluster DNS; hostNetwork needs ClusterFirstWithHostNet.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Same symptom, four different faults, four minutes each',
    story: [
      'Over one week a team reported "the api service is unreachable" four times. The symptom was identical each time; the causes were at four different layers, and the six-step procedure found each one in a few minutes.',
      'Monday: `nslookup api` returned NXDOMAIN from a Pod in another namespace. Layer 2 - the caller needed `api.shop`, not `api`. Fixed in configuration.',
      'Tuesday: DNS resolved, but `kubectl get endpoints api` showed `<none>`. Layer 3 - a Deployment rollout had changed the Pod template labels and the Service selector no longer matched.',
      'Thursday: endpoints existed as `10.244.1.5:80`, but the container had been hardened to listen on 8080. Layer 4 - `targetPort` was still defaulting to 80, so connections were refused.',
      'Friday: everything above was correct, `kubectl port-forward` worked, and connections from other Pods timed out rather than being refused. Layer 5 - a new default-deny NetworkPolicy had been applied to the namespace that morning.',
      'The reason the procedure works is that each step *excludes* layers rather than guessing among them. The timeout-versus-refusal distinction alone separated Thursday from Friday.',
    ],
    code: [
      {
        title: 'The procedure, in one block',
        language: 'bash',
        code: `SVC=api; NS=shop; PORT=80

# Layer 1: is the application itself working? (bypasses everything)
POD=$(kubectl get pods -n $NS -l app=$SVC -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward -n $NS "pod/$POD" 18080:8080 &
sleep 2; curl -sS -o /dev/null -w "app: %{http_code}\\n" localhost:18080; kill %1

# Layer 2: DNS
kubectl run t --rm -i --restart=Never -n $NS --image=busybox:1.36 -- sh -c "
  nslookup kubernetes.default >/dev/null 2>&1 && echo 'dns: cluster ok' || echo 'dns: CLUSTER BROKEN'
  nslookup $SVC >/dev/null 2>&1 && echo 'dns: short ok' || echo 'dns: short FAILS'
  nslookup $SVC.$NS.svc.cluster.local >/dev/null 2>&1 && echo 'dns: fqdn ok' || echo 'dns: fqdn FAILS'"

# Layer 3: endpoints
kubectl get endpoints $SVC -n $NS

# Layer 4: ports
kubectl get svc $SVC -n $NS -o jsonpath='targetPort={.spec.ports[0].targetPort}{"\\n"}'
kubectl exec -n $NS "$POD" -- sh -c 'netstat -tln 2>/dev/null | grep LISTEN'

# Layer 5: policies
kubectl get networkpolicies -n $NS

# Layer 6: external path
kubectl get ingress,svc -n $NS`,
        explanation:
          'Run it top to bottom and stop at the first failure. Each command isolates one layer, so the first failure is the fault.',
        placeholders: ['api', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A debug Pod worth keeping in your notes',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: netshoot
  namespace: shop
  labels:
    # Give it labels a NetworkPolicy would allow, so you are testing the
    # path an application takes rather than an unlabelled stranger.
    app: web
spec:
  containers:
    - name: shell
      # busybox: nslookup, nc, wget, ping - enough for most work
      # nicolaka/netshoot: curl, dig, tcpdump, ss, iperf, mtr
      image: nicolaka/netshoot:v0.13
      command: ["sleep", "3600"]
      resources:
        requests:
          cpu: 10m
          memory: 32Mi
        limits:
          memory: 128Mi`,
      explanation:
        'Labelling the debug Pod matters once NetworkPolicies exist: an unlabelled Pod is denied by a `podSelector` rule, which looks like a broken policy when it is actually working correctly.',
      placeholders: ['netshoot', 'shop'],
    },
    {
      title: 'The symptom-to-layer table',
      language: 'text',
      code: `SYMPTOM                                  LAYER  FIRST COMMAND
-----------------------------------------------------------------------------
"could not resolve host" / NXDOMAIN        2    nslookup kubernetes.default
"connection refused" from a Service        3/4  kubectl get endpoints <svc>
"connection timed out" from a Pod          5    kubectl get networkpolicies -A
port-forward works, Service does not       3-5  kubectl get endpoints <svc>
port-forward also fails                    1    kubectl logs <pod>; describe
endpoints <none>                           3    compare selector vs labels
endpoints present, wrong port number       4    check targetPort vs container
Ingress ADDRESS empty                      6    kubectl get ingressclass
Ingress 503                                6/3  describe ingress -> endpoints
Ingress 404                                6    check host and pathType
LoadBalancer EXTERNAL-IP <pending>         6    no cloud provider / MetalLB
NodePort unreachable from outside          6    port in 30000-32767? node IP?
works in one namespace, not another        2    short name needs <svc>.<ns>

REFUSED vs TIMEOUT is the most useful single distinction:
  refused  -> a host answered; nothing is listening on that port
  timeout  -> packets are being dropped: policy, wrong IP, or no route`,
      explanation:
        'Print this. Most CKAD networking tasks are one row of this table, and knowing the row means knowing the first command.',
    },
  ],
  imperative: [
    {
      command: 'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh',
      what: 'The workhorse: an interactive shell inside the cluster network, deleted on exit.',
      expected: 'A prompt with nslookup, nc, wget and ping available.',
      placeholders: ['tmp', 'shop'],
    },
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nslookup api',
      what: 'Layer 2: does the name resolve from inside this namespace?',
      expected: 'Name and Address lines, or NXDOMAIN.',
      placeholders: ['tmp', 'shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w 3 api 80',
      what: 'Layer 3/4/5: TCP reachability without sending data. Reports open, refused or timed out.',
      expected: '"api (10.96.x.x:80) open".',
      placeholders: ['tmp', 'shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- wget -qO- --timeout=3 http://api',
      what: 'Full HTTP request: DNS plus connection plus response.',
      expected: 'The response body.',
      placeholders: ['tmp', 'shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w 3 10.244.1.5 8080',
      what: 'Bypasses the Service by using a Pod IP. Working here but not via the Service isolates the fault to the Service.',
      expected: 'open',
      placeholders: ['tmp', 'shop', '10.244.1.5'],
    },
    {
      command: 'kubectl port-forward -n shop pod/api-6d4b8f9c7-2xk4l 8080:8080',
      what: 'Layer 1: goes through the API server, bypassing DNS, Services, kube-proxy and policies.',
      expected: 'Forwarding lines, then a successful local request.',
      placeholders: ['shop', 'api-6d4b8f9c7-2xk4l'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'Layer 3: the definitive check that a Service is wired to Ready Pods, and on which port.',
      expected: 'One IP:port per Ready Pod, or `<none>`.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- sh -c "netstat -tln 2>/dev/null || ss -tln"',
      what: 'Layer 4: what the container is actually listening on.',
      expected: 'A LISTEN line on the expected port.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl get networkpolicies -A',
      what: 'Layer 5: policies anywhere in the cluster, including the destination namespace.',
      expected: 'The policies in play, or none.',
    },
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 --labels="app=web" -- nc -zv -w 3 api 80',
      what: 'Layer 5: test as a source a policy would allow. Compare with the unlabelled run.',
      expected: 'open when the label is permitted, timeout when it is not.',
      placeholders: ['tmp', 'shop', 'api'],
    },
    {
      command:
        'kubectl debug -it api-6d4b8f9c7-2xk4l -n shop --image=nicolaka/netshoot:v0.13 --target=api',
      what: 'Attaches a full network toolkit to a running Pod, sharing its network namespace - tests exactly what the app sees.',
      expected: 'A shell with curl, dig, ss and tcpdump.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- cat /etc/resolv.conf',
      what: 'The search domains and nameserver, which explain any short-name resolution behaviour.',
      expected: 'nameserver, search and ndots lines.',
      placeholders: ['tmp', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Troubleshooting is imperative. The discipline is the order, not the manifests.',
      'Work outwards from the application: port-forward, then DNS, then endpoints, then ports, then policies, then the external path.',
      'Stop at the first failing layer - everything beyond it is untestable until that one is fixed.',
      'Use a labelled debug Pod once NetworkPolicies exist, or you will test a path no application uses.',
      'Note whether a failure is a refusal or a timeout before doing anything else; it halves the search space.',
    ],
    code: [
      {
        title: 'A reusable diagnosis script',
        language: 'bash',
        code: `#!/bin/sh
# usage: ./diagnose.sh <namespace> <service> <port> <pod-label-selector>
NS=$1; SVC=$2; PORT=$3; SEL=$4

echo "== 0. objects =="
kubectl get pods,svc,endpoints,networkpolicies,ingress -n "$NS" 2>/dev/null

echo "== 1. pod readiness =="
kubectl get pods -n "$NS" -l "$SEL" \\
  -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[0].ready,IP:.status.podIP'

echo "== 2. dns =="
kubectl run dbg --rm -i --restart=Never -n "$NS" --image=busybox:1.36 -- sh -c "
  nslookup kubernetes.default >/dev/null 2>&1 && echo '  cluster dns ok' || echo '  CLUSTER DNS BROKEN'
  nslookup $SVC >/dev/null 2>&1 && echo '  short name ok' || echo '  short name FAILS'
" 2>/dev/null

echo "== 3/4. endpoints and ports =="
kubectl get endpoints "$SVC" -n "$NS"
kubectl get svc "$SVC" -n "$NS" -o jsonpath='  port={.spec.ports[0].port} target={.spec.ports[0].targetPort}{"\\n"}'

echo "== 5. reachability =="
kubectl run dbg --rm -i --restart=Never -n "$NS" --image=busybox:1.36 -- \\
  nc -zv -w3 "$SVC" "$PORT" 2>&1 | tail -1`,
        explanation:
          'Having this as a script means the order is never skipped under time pressure, which is exactly when people start guessing.',
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- wget -qO- --timeout=3 http://api',
      what: 'The single command that proves the whole path works.',
      expected: 'The application response.',
      placeholders: ['tmp', 'shop', 'api'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'The structural check behind that response.',
      expected: 'One IP:port per Ready Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        "kubectl get pods -n shop -l app=api -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[0].ready,IP:.status.podIP'",
      what: 'Readiness and Pod IPs together - the inputs to the endpoint list.',
      expected: 'READY true for each Pod.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nslookup kubernetes.default',
      what: 'Control test. Failure means cluster DNS is broken and nothing else you check matters yet.',
      expected: 'The API server cluster IP.',
      placeholders: ['tmp', 'shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: '`<none>` narrows the problem to the selector or Pod readiness in one command.',
      expected: 'Addresses, or `<none>`.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get svc api -n shop -o jsonpath=\'{.spec.selector}{"\\n"}\' && kubectl get pods -n shop --show-labels | head -3',
      what: 'Compares the Service selector against the real Pod labels.',
      expected: 'Selector keys and values present on the Pods.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl port-forward -n shop pod/api-6d4b8f9c7-2xk4l 8080:8080',
      what: 'If this works, the application is healthy and the fault is in DNS, the Service, or a policy.',
      expected: 'A successful local request.',
      placeholders: ['shop', 'api-6d4b8f9c7-2xk4l'],
    },
    {
      command:
        'kubectl get networkpolicies -n shop -o custom-columns=NAME:.metadata.name,SELECTOR:.spec.podSelector,TYPES:.spec.policyTypes',
      what: 'When connections time out rather than being refused, this is the next command.',
      expected: 'The policies selecting your Pods.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe ingress shop -n shop | grep -A6 Rules',
      what: 'For Ingress problems, the endpoint list after each backend distinguishes 503 from 404 causes.',
      expected: 'Backends with non-empty endpoint lists.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get events -n shop --sort-by=.lastTimestamp | tail -15',
      what: 'Catches the wider context - failing probes, evictions, admission rejections - that a targeted check misses.',
      expected: 'Recent events, ideally nothing alarming.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Starting by re-reading YAML instead of running one command per layer.',
    'Skipping the `kubernetes.default` control test and debugging a Service when cluster DNS is down.',
    'Treating a timeout and a refusal as the same symptom. They point at different layers.',
    'Testing from an unlabelled debug Pod in a namespace with NetworkPolicies, then blaming the policy.',
    'Assuming `kubectl port-forward` working means the Service works. It deliberately bypasses the Service.',
    'Testing a ClusterIP Service from your laptop. It is cluster-internal only.',
    'Using `ping` to test a Service. ClusterIPs do not answer ICMP; use `nc` or `wget` on the real port.',
    'Forgetting that a policy in the *destination* namespace can block traffic your source namespace permits.',
    'Not checking the READY column - an unready Pod is silently excluded from endpoints.',
  ],
  examTips: [
    'Memorise the debug Pod: `kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh`. You will type it in most networking tasks.',
    'Run the six layers in order and stop at the first failure. It is faster than any amount of inspection.',
    '`kubectl get endpoints <svc>` is the highest-yield single command in this domain.',
    'Refused = nothing listening on that port. Timeout = packets dropped, so suspect a NetworkPolicy.',
    'Use `nc -zv -w3 <host> <port>` rather than ping - it tests the actual TCP port with a bounded timeout.',
    'When a task says "the Pod cannot reach the Service", check DNS and endpoints before touching the manifests.',
    'Add `--labels="app=x"` to your debug Pod whenever NetworkPolicies exist in the namespace.',
  ],
  summary: [
    'Six layers: application, DNS, endpoints, ports, NetworkPolicy, external path. Test in that order.',
    '`port-forward` isolates the application; `nslookup` isolates DNS; `get endpoints` isolates the selector; a Pod-IP connection isolates the Service.',
    'Refused means something answered with nothing listening; timeout means packets were dropped.',
    'A temporary busybox Pod is the toolkit; label it when policies exist; use netshoot when you need curl, dig or tcpdump.',
    '`kubectl get endpoints <svc>` answers more networking questions than any other command.',
  ],
  practice: [
    {
      id: 'net-p1',
      level: 'beginner',
      prompt:
        'A Pod cannot reach `http://api`. `kubectl get endpoints api` shows two addresses and DNS resolves. What is the next thing you check?',
      answer:
        "The port. Compare the Service `targetPort` with the port the container actually listens on:\n`kubectl get svc api -o jsonpath='{.spec.ports[0].targetPort}'` and `kubectl exec <pod> -- netstat -tln`.\n\nIf they match, check for NetworkPolicies - especially if the failure is a timeout rather than a refusal.",
      explanation:
        'DNS working plus endpoints existing eliminates layers 2 and 3, which leaves the port (layer 4) and policies (layer 5). The refused/timeout distinction tells you which of those two to try first.',
    },
    {
      id: 'net-p2',
      level: 'intermediate',
      prompt:
        '`kubectl port-forward` to a Pod works, but no other Pod can reach the Service. List the three layers still in play and the command for each.',
      answer:
        '1. DNS - `kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- nslookup <svc>`\n2. Service/endpoints - `kubectl get endpoints <svc>` (selector and readiness), plus `targetPort` versus the container port\n3. NetworkPolicy - `kubectl get networkpolicies -A`, then retest from a labelled debug Pod\n\nport-forward goes through the API server, so it proves the application works and eliminates layer 1 entirely.',
      explanation:
        'This is the most valuable single deduction in Kubernetes networking: a working port-forward converts an open-ended problem into exactly three candidates.',
    },
    {
      id: 'net-p3',
      level: 'advanced',
      prompt:
        'Connections from Pod A to Service B time out. Endpoints exist, DNS resolves, and the port is correct. Explain what a timeout (rather than a refusal) tells you, and give the two tests that confirm it.',
      answer:
        'A timeout means packets are being silently dropped rather than actively rejected - which is what a NetworkPolicy does. A refusal would mean the packet arrived and nothing was listening.\n\nTests:\n1. `kubectl get networkpolicies -A` - check both the source and destination namespaces; either end can block.\n2. Retest from a debug Pod carrying the labels a policy would allow, and again without them:\n   `kubectl run t --rm -i --restart=Never -n <ns> --image=busybox:1.36 --labels="app=web" -- nc -zv -w3 <svc> <port>`\n   If the labelled Pod succeeds and the unlabelled one times out, the policy is working as designed and Pod A simply lacks the right label.',
      explanation:
        'Remember that with an egress policy on the source and an ingress policy on the destination, *both* must permit the traffic - so checking only the destination namespace can leave you puzzled.',
    },
  ],
  lab: {
    title: 'Break connectivity four ways and diagnose each in order',
    scenario:
      'You will build a working Service, then introduce four faults - one per layer - and use the six-step procedure to identify each from its symptom alone before fixing it.',
    prerequisites: [
      'A cluster with kubectl',
      'For the NetworkPolicy step, a policy-enforcing CNI (Calico/Cilium). Without one that step is a no-op, which is itself informative.',
    ],
    tasks: [
      { instruction: 'Create namespace `net-lab` and set it as default.' },
      {
        instruction:
          'Deploy an nginx app listening on 8080 with a matching Service; confirm end-to-end connectivity and record the working baseline.',
      },
      { instruction: 'Fault 1 (layer 4): change targetPort to 80 and diagnose from the symptom.' },
      { instruction: 'Fault 2 (layer 3): fix the port, then break the selector and diagnose.' },
      {
        instruction:
          'Fault 3 (layer 2): fix the selector, then test from a second namespace using the short name and diagnose.',
      },
      {
        instruction:
          'Fault 4 (layer 5): apply a default-deny policy and diagnose, noting the timeout signature.',
      },
      { instruction: 'Prove with port-forward that the application was healthy throughout.' },
      { instruction: 'Remove the policy and confirm everything works again.' },
      { instruction: 'Delete both namespaces.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - a known-good baseline',
        language: 'bash',
        code: `kubectl create namespace net-lab
kubectl create namespace net-other
kubectl config set-context --current --namespace=net-lab

kubectl create configmap page --from-literal=default.conf='
server { listen 8080; location / { return 200 "healthy\\n"; add_header Content-Type text/plain; } }'

cat <<'YAML' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata: {name: api, namespace: net-lab}
spec:
  replicas: 2
  selector:
    matchLabels: {app: api}
  template:
    metadata:
      labels: {app: api}
    spec:
      volumes:
        - name: conf
          configMap: {name: page}
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - {name: http, containerPort: 8080}
          volumeMounts:
            - {name: conf, mountPath: /etc/nginx/conf.d, readOnly: true}
          readinessProbe:
            httpGet: {path: /, port: http}
            periodSeconds: 3
---
apiVersion: v1
kind: Service
metadata: {name: api, namespace: net-lab}
spec:
  selector: {app: api}
  ports:
    - {name: http, port: 80, targetPort: http}
YAML

kubectl rollout status deploy/api --timeout=120s
kubectl get endpoints api
# api   10.244.1.5:8080,10.244.2.7:8080

kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- wget -qO- --timeout=3 http://api
# healthy      <-- BASELINE WORKS`,
      },
      {
        title: 'Fault 1 - layer 4, the wrong targetPort',
        language: 'bash',
        code: `kubectl patch svc api -p '{"spec":{"ports":[{"name":"http","port":80,"targetPort":80}]}}'
sleep 3

# SYMPTOM
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- \\
  nc -zv -w3 api 80 2>&1 | tail -1
# nc: api (10.96.x.x:80): Connection refused        <- REFUSED, not timeout

# DIAGNOSIS
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- nslookup api >/dev/null && echo "layer2 ok"
kubectl get endpoints api
# api   10.244.1.5:80,10.244.2.7:80
#                    ^^ port 80 - but the container listens on 8080
POD=$(kubectl get pods -l app=api -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$POD" -- sh -c 'netstat -tln 2>/dev/null | grep LISTEN'
# tcp  0.0.0.0:8080  LISTEN

# FIX
kubectl patch svc api -p '{"spec":{"ports":[{"name":"http","port":80,"targetPort":"http"}]}}'
sleep 3
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- wget -qO- --timeout=3 http://api
# healthy`,
      },
      {
        title: 'Fault 2 - layer 3, the wrong selector',
        language: 'bash',
        code: `kubectl patch svc api -p '{"spec":{"selector":{"app":"apis"}}}'
sleep 5

# SYMPTOM (same-looking failure, different cause)
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- \\
  nc -zv -w3 api 80 2>&1 | tail -1
# nc: api (10.96.x.x:80): Operation timed out

# DIAGNOSIS - step 3 answers it immediately
kubectl get endpoints api
# api   <none>                          <- layer 3

kubectl get svc api -o jsonpath='{.spec.selector}{"\\n"}'
# {"app":"apis"}
kubectl get pods --show-labels | head -2
# api-...  1/1  Running  app=api,pod-template-hash=...

# FIX
kubectl patch svc api -p '{"spec":{"selector":{"app":"api"}}}'
sleep 5
kubectl get endpoints api      # two addresses again`,
      },
      {
        title: 'Fault 3 - layer 2, the short name across namespaces',
        language: 'bash',
        code: `# SYMPTOM from a DIFFERENT namespace
kubectl run t --rm -i --restart=Never -n net-other --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://api 2>&1 | tail -1
# wget: bad address 'api'          <- a DNS symptom, not a connection one

# DIAGNOSIS
kubectl run t --rm -i --restart=Never -n net-other --image=busybox:1.36 -- sh -c '
  nslookup kubernetes.default >/dev/null 2>&1 && echo "cluster dns ok"
  cat /etc/resolv.conf | grep search'
# cluster dns ok
# search net-other.svc.cluster.local svc.cluster.local cluster.local
#        ^^^^^^^^^ "api" is tried here first, where it does not exist

# FIX: use the namespace in the name
kubectl run t --rm -i --restart=Never -n net-other --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://api.net-lab
# healthy`,
      },
      {
        title: 'Fault 4 - layer 5, a NetworkPolicy',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny, namespace: net-lab}
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
YAML
sleep 5

# SYMPTOM: timeout, and DNS breaks too
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- sh -c '
  nslookup api >/dev/null 2>&1 && echo "dns ok" || echo "dns FAILS"
  nc -zv -w3 api 80 2>&1 | tail -1'
# dns FAILS
# nc: bad address 'api'

# DIAGNOSIS
kubectl get networkpolicies
# NAME           POD-SELECTOR   AGE
# default-deny   <none>         30s
kubectl describe netpol default-deny | head -10

# Layers 1-4 are all still fine, which port-forward proves:
POD=$(kubectl get pods -l app=api -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward "pod/$POD" 18080:8080 >/dev/null 2>&1 &
sleep 2
wget -qO- --timeout=3 http://localhost:18080
# healthy          <- the application was never the problem
kill %1 2>/dev/null

# FIX (for the lab): remove the policy
kubectl delete networkpolicy default-deny
sleep 5
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- wget -qO- --timeout=3 http://api
# healthy`,
      },
      {
        title: 'Steps 8-9 - final verification and cleanup',
        language: 'bash',
        code: `# The full six-layer check, all green
kubectl get pods,svc,endpoints,networkpolicies
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- sh -c '
  nslookup api >/dev/null 2>&1 && echo "2. dns ok"
  nc -zv -w3 api 80 2>&1 | tail -1
  wget -qO- --timeout=3 http://api'

kubectl config set-context --current --namespace=default
kubectl delete namespace net-lab net-other`,
      },
    ],
    verification: [
      {
        command:
          'kubectl run t --rm -i --restart=Never -n net-lab --image=busybox:1.36 -- wget -qO- --timeout=3 http://api',
        what: 'The single end-to-end check, run after each fix.',
        expected: 'healthy',
      },
      {
        command: 'kubectl get endpoints api -n net-lab',
        what: 'Both addresses on port 8080 confirms layers 3 and 4 are correct.',
        expected: 'Two IP:8080 entries.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace net-lab net-other',
        what: 'Removes both namespaces and everything in them.',
        expected: 'Two "deleted" lines.',
      },
    ],
  },
  relatedTopicIds: [
    'service-ports-and-endpoints',
    'dns-and-service-discovery',
    'networkpolicy',
    'debugging-pods',
  ],
  docs: [
    {
      title: 'Debug Services',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/',
    },
    {
      title: 'Debugging DNS resolution',
      url: 'https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/',
    },
  ],
}
