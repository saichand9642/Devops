import type { Topic } from '../../../types'

export const dnsAndServiceDiscovery: Topic = {
  id: 'dns-and-service-discovery',
  title: 'Cluster DNS and service discovery',
  domainId: 'services-networking',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 3,
  tags: ['dns', 'coredns', 'resolv.conf', 'search domains', 'FQDN', 'srv', 'nslookup', 'ndots'],
  oneLiner:
    'How a name becomes an IP inside a cluster: the four-part FQDN, the search domains that make short names work, and the commands that prove where resolution breaks.',
  explanation: [
    'Every Service gets a DNS name from **CoreDNS**, which runs as a Deployment in `kube-system` and is itself fronted by a Service (usually `kube-dns` at a fixed cluster IP). Every Pod is configured to use it.',
    'The fully qualified name of a Service is `<service>.<namespace>.svc.cluster.local`. All four parts matter: the Service name, its namespace, the `svc` record type, and the cluster domain (`cluster.local` by default).',
    "Short names work because of **search domains** in the Pod's `/etc/resolv.conf`: `<namespace>.svc.cluster.local`, `svc.cluster.local`, `cluster.local`. So `api` is tried as `api.<my-namespace>.svc.cluster.local` first, which is why a bare Service name resolves within the same namespace and not across namespaces.",
    'Cross-namespace access needs at least two parts: `api.shop` resolves because the second search domain completes it to `api.shop.svc.cluster.local`. One part only ever finds a Service in your own namespace.',
    'A normal (ClusterIP) Service resolves to its single virtual IP. A **headless** Service resolves to the list of Pod IPs. A **StatefulSet** Pod additionally gets `<pod>.<service>.<namespace>.svc.cluster.local`, which is the whole point of stable identity.',
  ],
  whyItMatters: [
    'Service discovery is how applications find each other, and "cannot resolve host" is one of the most common Kubernetes errors - usually a missing namespace rather than a broken DNS server.',
    'Knowing the search-domain behaviour explains why `api` works from one Pod and fails from another: the difference is which namespace the Pod is in.',
    'The `nslookup`/`getent hosts` test from a temporary Pod is the fastest way to split "DNS is broken" from "the Service has no endpoints", which are different problems with different fixes.',
  ],
  howItWorks: [
    "A Pod's `/etc/resolv.conf` is written by the kubelet: `nameserver <cluster-dns-ip>`, `search <ns>.svc.cluster.local svc.cluster.local cluster.local`, and `options ndots:5`.",
    '`ndots:5` means any name with fewer than five dots is tried against each search domain **before** being tried as an absolute name. That makes short names work, and it also means an external name like `api.example.com` (two dots) performs three failed cluster lookups before succeeding - the reason a trailing dot (`api.example.com.`) is sometimes used for latency-sensitive lookups.',
    'Record types: a ClusterIP Service gets an A/AAAA record for its cluster IP; a headless Service gets one A record per Ready Pod IP; named ports get SRV records at `_<port-name>._<protocol>.<service>.<ns>.svc.cluster.local`; and an ExternalName Service gets a CNAME.',
    'Pods can also have DNS names (`<pod-ip-with-dashes>.<ns>.pod.cluster.local`), but this is rarely used except for StatefulSet peers.',
    "`spec.dnsPolicy` controls resolution: `ClusterFirst` (default - cluster DNS first, then upstream), `Default` (inherit the node's resolv.conf, no cluster DNS), `None` (use `dnsConfig` only), and `ClusterFirstWithHostNet` (needed when `hostNetwork: true`).",
    '`spec.dnsConfig` adds nameservers, search domains and options - including lowering `ndots` for a Pod that mostly resolves external names.',
    'If CoreDNS is down or has no endpoints, *every* name fails including cluster ones. `kubectl get svc,endpoints -n kube-system kube-dns` is the check.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'Resolving a Service name from inside a Pod',
      caption:
        'The search list in /etc/resolv.conf is why a bare Service name works in the same namespace but not across namespaces.',
      participants: [
        { id: 'app', label: 'Your Pod' },
        { id: 'dns', label: 'CoreDNS' },
        { id: 'kp', label: 'kube-proxy' },
        { id: 'pod', label: 'Backend Pod' },
      ],
      messages: [
        { from: 'app', to: 'dns', label: 'A record for "api"' },
        { from: 'dns', to: 'dns', label: 'try the search suffixes in order' },
        { from: 'dns', to: 'app', label: 'ClusterIP 10.96.4.7', kind: 'return' },
        { from: 'app', to: 'kp', label: 'connect to 10.96.4.7:80' },
        { from: 'kp', to: 'pod', label: 'DNAT to a Ready Pod IP:8080' },
        { from: 'pod', to: 'app', label: 'HTTP response', kind: 'return' },
      ],
    },
    {
      kind: 'decision',
      title: 'Which name do I use?',
      caption:
        'The full form always works. Learn service.namespace.svc.cluster.local and shorten only when you are sure.',
      question: 'Where is the thing you are calling?',
      branches: [
        {
          condition: 'the same namespace',
          result: 'api',
          detail: 'The search list completes it for you',
          tone: 'accent',
        },
        {
          condition: 'a different namespace',
          result: 'api.prod',
          detail: 'A bare name will NOT reach another namespace',
        },
        {
          condition: 'you want no ambiguity at all',
          result: 'api.prod.svc.cluster.local',
          detail: 'The fully qualified name. Always correct.',
        },
        {
          condition: 'an individual Pod behind a headless Service',
          result: 'pod-0.api.prod.svc.cluster.local',
          detail: 'Requires clusterIP: None on the Service',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Where DNS behaviour is configured per workload.',
      fields: [
        {
          path: 'spec.dnsPolicy',
          meaning: 'ClusterFirst (default), Default, None, ClusterFirstWithHostNet.',
        },
        { path: 'spec.dnsConfig.nameservers[]', meaning: 'Additional or replacement nameservers.' },
        { path: 'spec.dnsConfig.searches[]', meaning: 'Additional search domains.' },
        {
          path: 'spec.dnsConfig.options[]',
          meaning: 'resolv.conf options such as {name: ndots, value: "2"}.',
        },
        {
          path: 'spec.hostname / spec.subdomain',
          meaning: 'Together with a headless Service, give a plain Pod a stable DNS name.',
        },
      ],
    },
    {
      kind: 'Service',
      apiVersion: 'v1',
      purpose: 'The thing that gets a DNS name.',
      fields: [
        { path: 'metadata.name', meaning: 'The first label of the DNS name.', required: true },
        {
          path: 'spec.clusterIP',
          meaning: 'The A record value. `None` makes DNS return Pod IPs instead.',
        },
        {
          path: 'spec.ports[].name',
          meaning: 'Produces an SRV record _<name>._<protocol>.<svc>.<ns>.svc.cluster.local.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'It works in dev and fails in prod, and DNS is not the problem',
    story: [
      "A front end in namespace `web` calls `http://api/v1/orders`. In the developers' single-namespace setup everything is in `default`, so it works. In production the API lives in namespace `shop`, and the front end reports `getaddrinfo ENOTFOUND api`.",
      'The instinct is to blame CoreDNS. The actual cause is the search-domain rule: from a Pod in `web`, the name `api` is tried as `api.web.svc.cluster.local` first, and there is no `api` Service in `web`.',
      'The one-command proof: `kubectl run tmp --rm -it --restart=Never -n web --image=busybox:1.36 -- nslookup api` returns NXDOMAIN, while `nslookup api.shop` resolves immediately.',
      "The fix is to configure the front end with `api.shop` (or the full `api.shop.svc.cluster.local`). Adding a second Service named `api` in `web` as an ExternalName alias to `api.shop` is the alternative if the application's configuration cannot change.",
      'The habit worth adopting: always write cross-namespace names with at least two labels, and use the full FQDN in anything shared between environments.',
    ],
    code: [
      {
        title: 'Two lookups tell the whole story',
        language: 'bash',
        code: `kubectl run tmp --rm -it --restart=Never -n web --image=busybox:1.36 -- \\
  nslookup api
# ** server can't find api: NXDOMAIN
#   (tried api.web.svc.cluster.local first - no such Service in "web")

kubectl run tmp --rm -it --restart=Never -n web --image=busybox:1.36 -- \\
  nslookup api.shop
# Name:      api.shop.svc.cluster.local
# Address 1: 10.96.140.22
#   (search domain svc.cluster.local completed it)

# Why: look at the search list the kubelet wrote
kubectl run tmp --rm -it --restart=Never -n web --image=busybox:1.36 -- \\
  cat /etc/resolv.conf
# nameserver 10.96.0.10
# search web.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5`,
        explanation:
          'The search list is the explanation for every "works here, fails there" DNS question in Kubernetes.',
        placeholders: ['web', 'shop', 'api'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The name forms, and when each is needed',
      language: 'text',
      code: `Service "api" in namespace "shop", cluster domain cluster.local:

  api                                  from a Pod in "shop" only
  api.shop                             from ANY namespace  (recommended minimum)
  api.shop.svc                         from any namespace
  api.shop.svc.cluster.local           fully qualified, unambiguous
  api.shop.svc.cluster.local.          absolute (trailing dot) - skips the
                                       search list entirely, one lookup

SRV record for a named port "http":
  _http._tcp.api.shop.svc.cluster.local

Headless Service "postgres" in "shop": A records for every Ready Pod IP
  postgres.shop.svc.cluster.local  ->  10.244.1.5, 10.244.2.7

StatefulSet Pod, per-Pod name (needs a headless Service):
  postgres-0.postgres.shop.svc.cluster.local
  postgres-1.postgres.shop.svc.cluster.local

Pod A record (rarely used):
  10-244-1-5.shop.pod.cluster.local`,
      explanation:
        'The practical rule: one label works only within a namespace, two labels work everywhere, four labels are unambiguous and safe to put in configuration shared across environments.',
    },
    {
      title: 'A plain Pod with a stable DNS name',
      language: 'yaml',
      code: `# hostname + subdomain + a headless Service gives even a bare Pod
# a predictable DNS name - useful for peer discovery without a StatefulSet.
apiVersion: v1
kind: Service
metadata:
  name: peers # this is the "subdomain"
  namespace: shop
spec:
  clusterIP: None # must be headless
  selector:
    app: peer
  ports:
    - name: gossip
      port: 7946
---
apiVersion: v1
kind: Pod
metadata:
  name: peer-a
  namespace: shop
  labels:
    app: peer
spec:
  hostname: peer-a # first label of the DNS name
  subdomain: peers # must match the headless Service name
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
# Resolvable as peer-a.peers.shop.svc.cluster.local`,
      explanation:
        'This is the mechanism StatefulSets use, exposed for direct use. Without the headless Service the `hostname`/`subdomain` fields produce no DNS record.',
      placeholders: ['peers', 'shop', 'peer-a'],
    },
    {
      title: 'Tuning DNS for a Pod that mostly resolves external names',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: external-caller
  namespace: shop
spec:
  dnsPolicy: ClusterFirst # keep cluster DNS for internal names
  dnsConfig:
    options:
      # ndots:5 makes api.example.com try three cluster search domains
      # first. Lowering it to 2 sends such names straight upstream.
      - name: ndots
        value: "2"
      - name: timeout
        value: "2"
      - name: attempts
        value: "3"
    searches:
      - shop.svc.cluster.local # keep the useful one explicitly
  containers:
    - name: app
      image: curlimages/curl:8.10.1
      command: ["sleep", "3600"]`,
      explanation:
        'A real optimisation in DNS-heavy applications: with `ndots:5`, every two-dot external name costs three NXDOMAIN round trips before the correct answer.',
      placeholders: ['external-caller', 'shop'],
    },
    {
      title: 'dnsPolicy values in practice',
      language: 'yaml',
      code: `# Default for normal Pods: cluster DNS first, then the node's upstream
spec:
  dnsPolicy: ClusterFirst
---
# "Default" is confusingly named: it means INHERIT THE NODE'S resolv.conf
# and use NO cluster DNS. Cluster Service names will not resolve.
spec:
  dnsPolicy: Default
---
# Required when using the host network, otherwise cluster DNS is bypassed
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
---
# Total control: only what dnsConfig specifies is used
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers: ["10.96.0.10"]
    searches: ["shop.svc.cluster.local", "svc.cluster.local"]
    options:
      - name: ndots
        value: "3"`,
      explanation:
        '`dnsPolicy: Default` is the trap: it sounds like "the normal one" but actually disables cluster DNS. The normal one is `ClusterFirst`.',
    },
  ],
  imperative: [
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup api',
      what: 'The standard in-cluster DNS test. Resolves within the current namespace.',
      expected: 'Name and Address lines, or NXDOMAIN.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup api.other-ns.svc.cluster.local',
      what: 'Tests a fully qualified cross-namespace name, removing search domains from the equation.',
      expected: 'The cluster IP of that Service.',
      placeholders: ['shop', 'api', 'other-ns'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- cat /etc/resolv.conf',
      what: 'Shows the nameserver, search domains and ndots the kubelet configured - the explanation for any short-name behaviour.',
      expected: 'nameserver, search and options lines.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- cat /etc/resolv.conf',
      what: 'The same check from an existing Pod, when you suspect its DNS configuration specifically.',
      expected: 'The cluster DNS IP and search list.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl get svc,endpoints -n kube-system kube-dns',
      what: 'Is cluster DNS itself healthy? Empty endpoints here means every lookup in the cluster fails.',
      expected: 'A ClusterIP Service and two or more endpoint addresses.',
    },
    {
      command: 'kubectl get pods -n kube-system -l k8s-app=kube-dns',
      what: 'The CoreDNS Pods.',
      expected: 'Two Running Pods on a typical cluster.',
    },
    {
      command: 'kubectl logs -n kube-system -l k8s-app=kube-dns --tail=20',
      what: 'CoreDNS logs, which show upstream failures and plugin errors.',
      expected: 'Startup lines, or SERVFAIL messages if upstream DNS is broken.',
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup -type=srv _http._tcp.api.shop.svc.cluster.local',
      what: 'Resolves the SRV record generated by a named Service port.',
      expected: 'A record giving the port number and target name.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup postgres',
      what: 'For a headless Service this returns every Pod IP rather than one virtual IP.',
      expected: 'Several Address lines.',
      placeholders: ['shop', 'postgres'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup postgres-0.postgres',
      what: 'Per-Pod DNS for a StatefulSet member.',
      expected: 'The single Pod IP of postgres-0.',
      placeholders: ['shop', 'postgres'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup kubernetes.default',
      what: 'A known-good control: this Service exists in every cluster, so failure means DNS itself is broken.',
      expected: 'The API server cluster IP, usually 10.96.0.1.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Configure applications with at least `<service>.<namespace>`, and prefer the full FQDN in anything shared across environments.',
      'Leave `dnsPolicy` at the default `ClusterFirst` unless you have a specific reason.',
      'Use `ClusterFirstWithHostNet` whenever `hostNetwork: true`, or the Pod silently loses cluster DNS.',
      'Use a headless Service plus `hostname`/`subdomain` when individual Pods need stable names.',
      'Consider lowering `ndots` for Pods that mostly resolve external names.',
      'Verify with a temporary Pod and `nslookup`, not by reading the manifest.',
    ],
    code: [
      {
        title: 'A DNS diagnosis in four commands',
        language: 'bash',
        code: `NS=shop

# 1. Is cluster DNS itself alive? (kubernetes.default exists everywhere)
kubectl run dnstest --rm -it --restart=Never -n $NS --image=busybox:1.36 -- \\
  nslookup kubernetes.default

# 2. What is the Pod's resolver configuration?
kubectl run dnstest --rm -it --restart=Never -n $NS --image=busybox:1.36 -- \\
  cat /etc/resolv.conf

# 3. Does the FQDN resolve? (removes search domains from the picture)
kubectl run dnstest --rm -it --restart=Never -n $NS --image=busybox:1.36 -- \\
  nslookup api.shop.svc.cluster.local

# 4. If DNS is fine, the problem is endpoints, not names
kubectl get endpoints api -n $NS`,
        placeholders: ['shop', 'api'],
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup api.shop.svc.cluster.local',
      what: 'The FQDN resolving proves DNS and the Service object are both fine.',
      expected: 'The Service cluster IP.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- wget -qO- --timeout=3 http://api.shop',
      what: 'Resolution plus connection - the full path an application takes.',
      expected: 'The application response.',
      placeholders: ['shop', 'api'],
    },
    {
      command: 'kubectl get endpoints kube-dns -n kube-system',
      what: 'Cluster DNS health in one line.',
      expected: 'Two or more IP:53 entries.',
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup postgres-0.postgres.shop.svc.cluster.local',
      what: 'Confirms per-Pod StatefulSet DNS works.',
      expected: 'A single Pod IP.',
      placeholders: ['shop', 'postgres'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup kubernetes.default',
      what: 'Always test this first. If it fails, DNS is broken cluster-wide and your Service name is irrelevant.',
      expected: 'The API server cluster IP.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup api',
      what: 'NXDOMAIN on a short name usually means the Service is in another namespace.',
      expected: 'A resolution, or NXDOMAIN pointing at a namespace mistake.',
      placeholders: ['shop', 'api'],
    },
    {
      command: 'kubectl get svc --all-namespaces | grep api',
      what: 'Finds which namespace a Service actually lives in.',
      expected: 'The namespace in the first column.',
      placeholders: ['api'],
    },
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{.spec.dnsPolicy}{" hostNetwork="}{.spec.hostNetwork}{"\\n"}\'',
      what: '`hostNetwork: true` with `dnsPolicy: ClusterFirst` loses cluster DNS - it needs ClusterFirstWithHostNet.',
      expected: 'ClusterFirst hostNetwork=false for a normal Pod.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command:
        'kubectl logs -n kube-system -l k8s-app=kube-dns --tail=30 | grep -i "error\\|SERVFAIL"',
      what: 'Upstream resolution failures for external names show up here.',
      expected: 'Nothing, ideally.',
    },
    {
      command:
        'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh -c "nslookup api; echo ---; nslookup api.shop.svc.cluster.local"',
      what: 'Short name failing while the FQDN succeeds is definitive proof of a search-domain/namespace issue rather than a DNS fault.',
      expected: 'NXDOMAIN then a successful resolution.',
      placeholders: ['shop', 'api'],
    },
  ],
  commonMistakes: [
    "Using a bare Service name across namespaces. One label only resolves within the Pod's own namespace.",
    'Assuming a DNS failure means CoreDNS is broken. Test `kubernetes.default` first - it almost always works.',
    'Setting `dnsPolicy: Default` thinking it is the normal setting. It disables cluster DNS entirely.',
    'Using `hostNetwork: true` without `dnsPolicy: ClusterFirstWithHostNet`, which silently breaks cluster name resolution.',
    'Expecting `hostname`/`subdomain` to create DNS records without a matching headless Service.',
    'Forgetting that a headless Service returns Pod IPs, so a client caching "the" IP will pin itself to one Pod.',
    'Confusing a resolution problem with an endpoints problem: DNS can resolve perfectly to a Service with no backends.',
    'Not realising that `ndots:5` makes external two-dot names cost three extra failed lookups.',
  ],
  examTips: [
    'Memorise the FQDN shape: `<service>.<namespace>.svc.cluster.local`.',
    '`kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- nslookup <name>` is the DNS command for the exam. Type it from memory.',
    'If a task says "the Pod in namespace A must reach the Service in namespace B", the answer includes the namespace in the name.',
    'DNS resolving but the connection failing means look at endpoints; DNS not resolving means look at the name and the namespace.',
    '`nslookup kubernetes.default` is your control test for whether DNS works at all.',
    'For StatefulSet peer names, remember the headless Service is required: `<pod>.<svc>.<ns>.svc.cluster.local`.',
  ],
  summary: [
    "CoreDNS serves `<service>.<namespace>.svc.cluster.local`; short names work via search domains in the Pod's resolv.conf.",
    "One label resolves only within the Pod's namespace; two or more work anywhere.",
    'ClusterIP → one A record; headless → one A record per Ready Pod; named ports → SRV records; ExternalName → CNAME.',
    'StatefulSet Pods get `<pod>.<svc>.<ns>.svc.cluster.local` when a headless Service exists.',
    '`dnsPolicy: Default` disables cluster DNS; `hostNetwork` requires `ClusterFirstWithHostNet`.',
  ],
  practice: [
    {
      id: 'dns-p1',
      level: 'beginner',
      prompt:
        'A Pod in namespace `web` must reach Service `api` in namespace `shop`. Why does `http://api` fail, and what should it be?',
      answer:
        'Because the first search domain is `web.svc.cluster.local`, so `api` is looked up as `api.web.svc.cluster.local`, which does not exist. Use `http://api.shop` (or the full `http://api.shop.svc.cluster.local`).',
      explanation:
        'Confirm with `kubectl run tmp --rm -it --restart=Never -n web --image=busybox:1.36 -- cat /etc/resolv.conf` and read the search list.',
    },
    {
      id: 'dns-p2',
      level: 'intermediate',
      prompt:
        'Write the fully qualified DNS name for Pod `postgres-1` of a StatefulSet fronted by headless Service `postgres` in namespace `shop`.',
      answer: 'postgres-1.postgres.shop.svc.cluster.local',
      explanation:
        'The pattern is `<pod-name>.<headless-service>.<namespace>.svc.cluster.local`. It only exists because the Service is headless and the StatefulSet sets `spec.serviceName` to it - a normal ClusterIP Service produces no per-Pod records.',
    },
    {
      id: 'dns-p3',
      level: 'advanced',
      prompt:
        'DNS resolves a Service name correctly but connections time out. Is this a DNS problem? Give the command that decides, and the two likely causes.',
      answer:
        'No - resolution succeeded, so DNS did its job. The Service exists as an object with a cluster IP; the question is whether it has working backends.\n\nDeciding command: `kubectl get endpoints <svc> -n <ns>`\n\nLikely causes: (1) empty endpoints - the selector matches nothing or the Pods are not Ready; (2) endpoints present but a NetworkPolicy is dropping the traffic, or `targetPort` points at a closed port.',
      explanation:
        'A ClusterIP is a set of forwarding rules, not a listening socket, so it resolves whether or not there is anything behind it. That is exactly why `kubectl get endpoints` is the next command after a successful lookup.',
    },
  ],
  lab: {
    title: 'Resolve every name form, and break resolution on purpose',
    scenario:
      'You will resolve Services within and across namespaces, inspect the search domains that make short names work, resolve a headless Service and a StatefulSet Pod, and see what `dnsPolicy: Default` does.',
    prerequisites: ['A cluster with CoreDNS (every standard cluster)'],
    tasks: [
      { instruction: 'Create namespaces `dns-a` and `dns-b`.' },
      { instruction: 'Create an nginx Deployment and ClusterIP Service named `api` in `dns-a`.' },
      { instruction: 'From a Pod in `dns-a`, resolve `api`, `api.dns-a` and the full FQDN.' },
      {
        instruction:
          'From a Pod in `dns-b`, show that `api` fails and `api.dns-a` succeeds, and explain it from resolv.conf.',
      },
      { instruction: "Resolve the SRV record for the Service's named port." },
      {
        instruction:
          'Create a headless Service and a 2-replica StatefulSet in `dns-a`; resolve the Service and one Pod name.',
      },
      {
        instruction:
          'Create a Pod with `dnsPolicy: Default` and show that cluster names no longer resolve.',
      },
      { instruction: 'Verify CoreDNS health with the kubernetes.default control test.' },
      { instruction: 'Delete both namespaces.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - same-namespace resolution',
        language: 'bash',
        code: `kubectl create namespace dns-a
kubectl create namespace dns-b

kubectl create deployment api --image=nginx:1.27-alpine --replicas=2 -n dns-a
kubectl expose deployment api --port=80 --target-port=80 --name=api -n dns-a
kubectl rollout status deploy/api -n dns-a --timeout=120s

kubectl run t --rm -it --restart=Never -n dns-a --image=busybox:1.36 -- sh -c '
  echo "--- short name ---"; nslookup api | tail -3
  echo "--- two labels ---"; nslookup api.dns-a | tail -3
  echo "--- FQDN ---";       nslookup api.dns-a.svc.cluster.local | tail -3'
# All three resolve to the same cluster IP.`,
      },
      {
        title: 'Step 4 - cross-namespace, and why',
        language: 'bash',
        code: `kubectl run t --rm -it --restart=Never -n dns-b --image=busybox:1.36 -- sh -c '
  echo "--- resolv.conf ---"; cat /etc/resolv.conf
  echo "--- api (short) ---"; nslookup api 2>&1 | tail -2
  echo "--- api.dns-a ---";   nslookup api.dns-a 2>&1 | tail -3'
# --- resolv.conf ---
# nameserver 10.96.0.10
# search dns-b.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
# --- api (short) ---
# ** server can't find api: NXDOMAIN        <- tried api.dns-b... first
# --- api.dns-a ---
# Name: api.dns-a.svc.cluster.local
# Address 1: 10.96.x.x                     <- completed by svc.cluster.local`,
      },
      {
        title: 'Steps 5-6 - SRV records, headless and StatefulSet',
        language: 'bash',
        code: `# Name the Service port so an SRV record exists
kubectl patch svc api -n dns-a -p '{"spec":{"ports":[{"name":"http","port":80,"targetPort":80}]}}'

kubectl run t --rm -it --restart=Never -n dns-a --image=busybox:1.36 -- \\
  nslookup -type=srv _http._tcp.api.dns-a.svc.cluster.local | tail -4

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Service
metadata: {name: db, namespace: dns-a}
spec:
  clusterIP: None
  selector: {app: db}
  ports:
    - {name: pg, port: 5432}
---
apiVersion: apps/v1
kind: StatefulSet
metadata: {name: db, namespace: dns-a}
spec:
  serviceName: db
  replicas: 2
  selector:
    matchLabels: {app: db}
  template:
    metadata:
      labels: {app: db}
    spec:
      containers:
        - name: c
          image: nginx:1.27-alpine
          ports:
            - {name: pg, containerPort: 80}
YAML

kubectl rollout status sts/db -n dns-a --timeout=180s

kubectl run t --rm -it --restart=Never -n dns-a --image=busybox:1.36 -- sh -c '
  echo "--- headless service (POD IPs) ---"; nslookup db | tail -5
  echo "--- per-pod name ---";               nslookup db-0.db | tail -3'
# The headless lookup returns TWO addresses (the Pod IPs);
# db-0.db returns exactly one.`,
      },
      {
        title: 'Steps 7-8 - dnsPolicy: Default, and the control test',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: nodedns, namespace: dns-a}
spec:
  dnsPolicy: Default          # INHERIT the node's resolv.conf, no cluster DNS
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"]
YAML

kubectl wait --for=condition=Ready pod/nodedns -n dns-a --timeout=90s

kubectl exec nodedns -n dns-a -- cat /etc/resolv.conf
# the NODE's resolver - no cluster search domains

kubectl exec nodedns -n dns-a -- nslookup api.dns-a.svc.cluster.local 2>&1 | tail -2
# ** can't find api.dns-a.svc.cluster.local: NXDOMAIN
#   Cluster DNS is not in use at all.

# The control test - this must work in any healthy cluster
kubectl run t --rm -it --restart=Never -n dns-a --image=busybox:1.36 -- \\
  nslookup kubernetes.default | tail -3
kubectl get endpoints kube-dns -n kube-system`,
      },
      {
        title: 'Step 9 - cleanup',
        language: 'bash',
        code: `kubectl delete namespace dns-a dns-b`,
      },
    ],
    verification: [
      {
        command:
          'kubectl run t --rm -it --restart=Never -n dns-b --image=busybox:1.36 -- nslookup api.dns-a',
        what: 'Cross-namespace resolution with two labels must succeed.',
        expected: 'api.dns-a.svc.cluster.local with the Service cluster IP.',
      },
      {
        command:
          'kubectl run t --rm -it --restart=Never -n dns-a --image=busybox:1.36 -- nslookup db-0.db',
        what: 'Per-Pod StatefulSet DNS requires the headless Service and proves it is wired up.',
        expected: 'A single Pod IP for db-0.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace dns-a dns-b',
        what: 'Removes every object from the lab.',
        expected: 'Two "deleted" lines.',
      },
    ],
  },
  relatedTopicIds: ['service-types', 'troubleshooting-networking', 'workload-resources'],
  docs: [
    {
      title: 'DNS for Services and Pods',
      url: 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/',
    },
    {
      title: 'Debugging DNS resolution',
      url: 'https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/',
    },
  ],
}
