import type { Topic } from '../../../types'

export const networkpolicy: Topic = {
  id: 'networkpolicy',
  title: 'NetworkPolicies',
  domainId: 'services-networking',
  difficulty: 'advanced',
  estimatedMinutes: 26,
  order: 5,
  tags: [
    'networkpolicy',
    'ingress',
    'egress',
    'podSelector',
    'namespaceSelector',
    'default deny',
    'cni',
  ],
  oneLiner:
    'Pod-level firewall rules: how selecting a Pod flips it to default-deny, why ingress and egress are independent, and the DNS rule everyone forgets.',
  explanation: [
    'By default every Pod can talk to every other Pod in the cluster. A **NetworkPolicy** restricts that, and its most important property is this: **as soon as any policy selects a Pod, that Pod is default-deny for the directions the policy mentions**. Traffic is only allowed if some policy explicitly permits it.',
    'A policy applies to the Pods matched by `spec.podSelector` in its own namespace. `podSelector: {}` selects every Pod in the namespace, which is how you write a namespace-wide default deny.',
    '`policyTypes` says which directions the policy governs: `Ingress` (traffic *to* the selected Pods), `Egress` (traffic *from* them), or both. A policy with `policyTypes: [Ingress]` says nothing about egress, so egress remains unrestricted unless another policy restricts it.',
    'Policies are **additive and allow-only**. There are no deny rules and no ordering or priority. The effective permission is the union of every policy that selects the Pod, and a connection is allowed if any one of them permits it.',
    'The critical detail people miss: **NetworkPolicy is enforced by the CNI plugin**, not by Kubernetes itself. Calico, Cilium and Antrea enforce it; Flannel alone does not. On a cluster whose CNI ignores policies, they are stored, look correct, and have no effect at all.',
  ],
  whyItMatters: [
    '"Demonstrate basic understanding of NetworkPolicies" is a named curriculum competency, and tasks usually ask you to allow traffic from one specific source and nothing else.',
    'The default-deny flip is what makes policies feel unpredictable: adding a policy that "allows" something can break traffic that previously worked, because everything else is now denied.',
    'Egress policies that forget DNS are a real and confusing outage: name resolution stops, so the application reports "host not found" rather than "connection refused".',
  ],
  howItWorks: [
    "The three selector forms inside a rule mean different things. `podSelector` selects Pods **in the policy's own namespace**. `namespaceSelector` selects **all Pods** in matching namespaces. `ipBlock` selects CIDR ranges, and is the only way to express external addresses.",
    'YAML structure matters enormously here. Two selectors in **one list item** are ANDed ("Pods with this label *in* namespaces with that label"); two selectors as **separate list items** are ORed. The difference is a single `-` character.',
    'Ports in a rule further restrict what is allowed: `ports: [{protocol: TCP, port: 8080}]` permits only that port. Omitting `ports` allows all ports from the permitted sources.',
    'Ingress and egress are evaluated independently, and both ends must permit a connection. If Pod A has an egress policy and Pod B has an ingress policy, both must allow the traffic.',
    'Return traffic is allowed automatically - policies are stateful, so you do not need a matching reverse rule for the response.',
    'DNS is egress to UDP and TCP port 53 towards the CoreDNS Pods in `kube-system`. Any default-deny egress policy must permit it explicitly, or every name lookup fails.',
    '`ipBlock` is evaluated against the source IP as the CNI sees it, which for in-cluster traffic is the Pod IP. Selecting a Service cluster IP with `ipBlock` does not work as people expect.',
    'A policy cannot select Pods in another namespace with `podSelector`. To allow traffic from a specific Pod in another namespace you combine `namespaceSelector` and `podSelector` in the same list item.',
  ],
  keyObjects: [
    {
      kind: 'NetworkPolicy',
      apiVersion: 'networking.k8s.io/v1',
      purpose: 'Allow-list firewall rules for the Pods it selects.',
      fields: [
        {
          path: 'spec.podSelector',
          meaning: 'Which Pods in THIS namespace the policy applies to. `{}` means all of them.',
          required: true,
        },
        {
          path: 'spec.policyTypes[]',
          meaning: 'Ingress, Egress, or both. Determines which directions become default-deny.',
        },
        {
          path: 'spec.ingress[].from[].podSelector',
          meaning: "Allowed source Pods in the policy's own namespace.",
        },
        {
          path: 'spec.ingress[].from[].namespaceSelector',
          meaning: 'Allowed source namespaces (all Pods in them, unless ANDed with a podSelector).',
        },
        {
          path: 'spec.ingress[].from[].ipBlock.cidr',
          meaning: 'Allowed source CIDR, with optional `except`.',
        },
        {
          path: 'spec.ingress[].ports[]',
          meaning: 'Allowed destination ports. Omit for all ports.',
        },
        { path: 'spec.egress[].to[]', meaning: 'Same selector forms, for outbound traffic.' },
        {
          path: 'spec.egress[].ports[]',
          meaning: 'Allowed destination ports for outbound traffic.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The egress policy that broke DNS',
    story: [
      'A team adds a default-deny egress policy to their namespace, then a policy allowing the API Pods to reach the database on port 5432. Reasonable, and it looks complete.',
      'Every request immediately fails with `getaddrinfo ENOTFOUND postgres`. Not "connection refused" - the application cannot even resolve the name.',
      'The cause: DNS is itself egress traffic, to UDP/TCP port 53 towards CoreDNS in `kube-system`. The default-deny policy blocked it, so the application could not turn `postgres` into an IP, let alone connect to port 5432.',
      'The fix is an egress rule permitting port 53 to the `kube-system` namespace. With it, resolution works and the database rule does its job.',
      'The confirming test was two commands from a temporary Pod: `nslookup postgres` failed while `nc -zv <pod-ip> 5432` succeeded - proving connectivity was fine and only name resolution was blocked. That pair of tests is the fastest way to identify a missing DNS egress rule.',
    ],
    code: [
      {
        title: 'The symptom and the missing rule',
        language: 'bash',
        code: `# Symptom: resolution fails, but the IP is reachable
kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- \\
  nslookup postgres
# ;; connection timed out; no servers could be reached

kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- \\
  nc -zv 10.244.2.9 5432
# 10.244.2.9 (10.244.2.9:5432) open        <- connectivity is fine

# The missing rule:
#   egress:
#     - to:
#         - namespaceSelector:
#             matchLabels:
#               kubernetes.io/metadata.name: kube-system
#       ports:
#         - protocol: UDP
#           port: 53
#         - protocol: TCP
#           port: 53`,
        explanation:
          'DNS failing while a direct IP connection works is the definitive signature of a default-deny egress policy without a port-53 rule.',
        placeholders: ['shop', '10.244.2.9'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Default deny, in three variants',
      language: 'yaml',
      code: `# Deny all INGRESS to every Pod in the namespace.
# Egress is untouched, because policyTypes does not mention it.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: shop
spec:
  podSelector: {} # every Pod in this namespace
  policyTypes:
    - Ingress
  # No ingress rules at all -> nothing is allowed in
---
# Deny all EGRESS. Remember this breaks DNS until you add a port-53 rule.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Egress
---
# Deny everything in both directions - the usual starting point for a
# zero-trust namespace, to be relaxed by additional allow policies.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress`,
      explanation:
        'These three are worth memorising verbatim - they are short, they appear in tasks directly, and they are the foundation everything else builds on.',
      placeholders: ['shop'],
    },
    {
      title: 'The AND versus OR distinction - one hyphen changes everything',
      language: 'yaml',
      code: `# AND: Pods labelled app=web, but only those in namespaces labelled tier=frontend.
# Both selectors are in ONE list item.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: and-example
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: # <- one "-"
            matchLabels:
              tier: frontend
          podSelector: # <- same list item, so ANDed
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 8080
---
# OR: any Pod in namespaces labelled tier=frontend, OR any Pod labelled
# app=web in THIS namespace. Two SEPARATE list items.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: or-example
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: # <- item 1
            matchLabels:
              tier: frontend
        - podSelector: # <- item 2, so ORed
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 8080`,
      explanation:
        'This is the single most error-prone piece of NetworkPolicy YAML. Count the hyphens: one item with two selectors is AND; two items are OR.',
      placeholders: ['shop'],
    },
    {
      title: 'A realistic three-tier policy set',
      language: 'yaml',
      code: `# 1. Namespace-wide default deny, both directions
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: shop
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# 2. Everyone may do DNS. Without this, nothing resolves anything.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: shop
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              # This label is added automatically to every namespace
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
---
# 3. web may receive traffic from the ingress controller, and may call api
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-policy
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 8080
---
# 4. api may receive traffic only from web, and may call the database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-policy
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
---
# 5. postgres may receive traffic only from api, and needs no egress at all
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-policy
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 5432`,
      explanation:
        'Note that `allow-dns` selects every Pod and is additive with the per-tier policies - permissions are the union of all matching policies, so DNS survives alongside the narrower rules.',
      placeholders: ['shop'],
    },
    {
      title: 'ipBlock for external traffic',
      language: 'yaml',
      code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: external-egress
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Egress]
  egress:
    # Allow HTTPS to the whole internet EXCEPT private ranges -
    # a common way to prevent lateral movement inside the VPC.
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
    # DNS still needs its own rule
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53`,
      explanation:
        '`ipBlock` is the only selector that can express addresses outside the cluster. It matches on IP as the CNI sees it, so it cannot usefully target a Service cluster IP.',
      placeholders: ['shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl get networkpolicies -n shop',
      what: 'Lists policies with their POD-SELECTOR column - the first thing to check when connectivity breaks.',
      expected: 'One row per policy.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe networkpolicy default-deny-all -n shop',
      what: 'Human-readable rendering of the selectors and rules, including "Allowing ingress traffic: <none>".',
      expected: 'PodSelector, Allowing ingress/egress traffic and Policy Types sections.',
      placeholders: ['default-deny-all', 'shop'],
    },
    {
      command:
        "kubectl get networkpolicy -n shop -o custom-columns='NAME:.metadata.name,PODSELECTOR:.spec.podSelector,TYPES:.spec.policyTypes'",
      what: 'Which policies select which Pods, in one table.',
      expected: 'A row per policy showing its selector and directions.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w 3 api 8080',
      what: 'The standard connectivity test. `nc -z` tests a TCP port without sending data.',
      expected: '"api (10.96.x.x:8080) open", or a timeout when denied.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 --labels="app=web" -- nc -zv -w 3 api 8080',
      what: 'Tests as a *labelled* source, which is what a podSelector rule actually matches. Without the label the test Pod is denied.',
      expected: 'open, because app=web is permitted.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup api',
      what: 'Tests DNS specifically - the first casualty of a default-deny egress policy.',
      expected: 'Resolution, or a timeout indicating a missing port-53 egress rule.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- wget -qO- --timeout=3 http://api:8080',
      what: 'Full HTTP test: DNS plus connection plus response.',
      expected: 'The response body, or a timeout.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl get pods -n kube-system -l k8s-app=calico-node -o name 2>/dev/null || kubectl get pods -n kube-system | grep -Ei "calico|cilium|antrea"',
      what: 'Confirms a policy-enforcing CNI is installed. Without one, policies do nothing.',
      expected: 'Calico, Cilium or Antrea Pods, or nothing.',
    },
    {
      command: 'kubectl label namespace shop tier=backend',
      what: 'Namespace labels are what `namespaceSelector` matches, so policies often require you to add them.',
      expected: 'namespace/shop labeled',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get ns --show-labels | grep kubernetes.io/metadata.name',
      what: 'Every namespace carries `kubernetes.io/metadata.name` automatically, which is the reliable way to select one namespace.',
      expected: 'The label present on each namespace.',
    },
  ],
  declarative: {
    steps: [
      'Confirm the CNI enforces policies before you write any - otherwise you are writing documentation, not security.',
      'Start with a namespace-wide default deny, then add narrow allow policies.',
      'Add the DNS egress rule immediately after any default-deny egress policy.',
      'Write each allow policy for one workload, selecting it with `podSelector` and naming exactly the sources, destinations and ports it needs.',
      'Watch the hyphens: one list item with two selectors is AND; two items are OR.',
      'Test from a temporary Pod with the right labels, in the right namespace, before and after each policy.',
    ],
    code: [
      {
        title: 'Build up a policy set safely',
        language: 'bash',
        code: `NS=shop

# 0. Baseline: prove connectivity works BEFORE restricting anything
kubectl run t --rm -it --restart=Never -n $NS --image=busybox:1.36 --labels=app=web -- \\
  sh -c 'nslookup api >/dev/null && nc -zv -w3 api 8080'

# 1. Default deny both directions
kubectl apply -f default-deny-all.yaml -n $NS

# 2. IMMEDIATELY restore DNS, or everything appears broken
kubectl apply -f allow-dns.yaml -n $NS
kubectl run t --rm -it --restart=Never -n $NS --image=busybox:1.36 -- nslookup api

# 3. Add the specific allow rule
kubectl apply -f api-policy.yaml -n $NS

# 4. Verify BOTH directions: permitted source works, other sources do not
kubectl run t --rm -it --restart=Never -n $NS --image=busybox:1.36 --labels=app=web -- \\
  nc -zv -w3 api 8080          # expect: open
kubectl run t --rm -it --restart=Never -n $NS --image=busybox:1.36 --labels=app=other -- \\
  nc -zv -w3 api 8080          # expect: timeout`,
        placeholders: ['shop'],
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 --labels="app=web" -- nc -zv -w 3 api 8080',
      what: 'The positive test: an allowed source reaches the target.',
      expected: 'open',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 --labels="app=blocked" -- nc -zv -w 3 api 8080',
      what: 'The negative test, which is the half people skip. A policy that allows everything passes the positive test.',
      expected: 'A timeout or "bad address" - the connection must fail.',
      placeholders: ['shop', 'api'],
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup kubernetes.default',
      what: 'Confirms DNS still works after adding egress restrictions.',
      expected: 'The API server cluster IP.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe networkpolicy api-policy -n shop',
      what: 'Confirms the rendered selectors and ports match what you intended.',
      expected: 'The pod selector, allowed sources and ports.',
      placeholders: ['api-policy', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get networkpolicies -A',
      what: 'The first command when connectivity breaks unexpectedly. A policy in another namespace can block the far end.',
      expected: 'Every policy in the cluster with its Pod selector.',
    },
    {
      command: 'kubectl get pods -n kube-system | grep -Ei "calico|cilium|antrea|weave"',
      what: 'If no policy-enforcing CNI is present, policies have no effect and you are debugging the wrong thing.',
      expected: 'CNI Pods, or nothing.',
    },
    {
      command:
        'kubectl run t --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh -c "nslookup api; echo ---; nc -zv -w3 10.244.2.9 8080"',
      what: 'The two-part test: DNS failing while a direct Pod IP works means a missing port-53 egress rule.',
      expected: 'Both succeed on a healthy setup.',
      placeholders: ['shop', 'api', '10.244.2.9'],
    },
    {
      command: 'kubectl get pods -n shop --show-labels',
      what: 'Policies match labels. A source Pod without the expected label is denied even if the policy looks right.',
      expected: 'The labels your policies select on.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get ns --show-labels',
      what: 'A `namespaceSelector` matching a label no namespace carries silently allows nothing.',
      expected: 'The labels your namespaceSelectors reference.',
    },
    {
      command:
        'kubectl get networkpolicy api-policy -n shop -o jsonpath=\'{.spec.ingress[0].from}{"\\n"}\'',
      what: 'Reveals whether selectors ended up ANDed (one object with two keys) or ORed (two objects).',
      expected: '[{"namespaceSelector":{...},"podSelector":{...}}] for AND; two entries for OR.',
      placeholders: ['api-policy', 'shop'],
    },
  ],
  commonMistakes: [
    'Forgetting that selecting a Pod makes it default-deny. Adding an "allow" policy can break traffic that worked before.',
    'Writing a default-deny egress policy without a DNS rule, so every name lookup fails and the app reports "host not found".',
    'Confusing AND and OR: one list item with `namespaceSelector` and `podSelector` is AND; two items are OR.',
    'Believing `podSelector` inside a rule can select Pods in another namespace. It cannot - combine it with `namespaceSelector`.',
    'Writing policies on a cluster whose CNI does not enforce them, and assuming they work.',
    'Testing with an unlabelled temporary Pod, which is denied by a `podSelector` rule, and concluding the policy is broken.',
    'Skipping the negative test. A policy that accidentally allows everything passes every positive test.',
    'Expecting a deny rule or priority ordering. Policies are allow-only and purely additive.',
    'Using `ipBlock` with a Service cluster IP. The CNI sees Pod IPs, not virtual service IPs.',
    'Forgetting that both ends must permit the traffic when the source has an egress policy and the destination has an ingress policy.',
  ],
  examTips: [
    'There is no imperative generator for NetworkPolicy - write the YAML. Memorise the default-deny shape; it is only six lines.',
    '`kubectl explain networkpolicy.spec --recursive` gives you the exact nesting when you are unsure.',
    'Whenever a task involves a default-deny egress policy, add the port-53 rule to `kube-system` unless the task explicitly says not to.',
    'Test with labelled temporary Pods: `kubectl run t --rm -it --restart=Never --labels="app=web" --image=busybox:1.36 -- nc -zv -w3 <svc> <port>`.',
    'Always run the negative test too - the grader will.',
    '`kubernetes.io/metadata.name: <namespace>` is the reliable way to select exactly one namespace, because Kubernetes adds that label automatically.',
    'Count the hyphens when writing `from`/`to` blocks: it is the difference between AND and OR.',
  ],
  summary: [
    'Selecting a Pod with any policy makes it default-deny for the directions in `policyTypes`.',
    'Policies are additive and allow-only; there are no deny rules and no priorities.',
    '`podSelector` is same-namespace only; `namespaceSelector` selects whole namespaces; `ipBlock` handles external CIDRs.',
    'One list item with two selectors = AND; two list items = OR.',
    'A default-deny egress policy breaks DNS until you allow UDP/TCP 53 to kube-system.',
    'Enforcement is by the CNI - Calico, Cilium and Antrea do it; Flannel alone does not.',
  ],
  practice: [
    {
      id: 'np-p1',
      level: 'beginner',
      prompt:
        'Write the NetworkPolicy that denies all incoming traffic to every Pod in namespace `shop`, leaving egress untouched.',
      answer:
        'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: shop\nspec:\n  podSelector: {}\n  policyTypes:\n    - Ingress',
      explanation:
        '`podSelector: {}` selects every Pod, and listing `Ingress` in `policyTypes` with no `ingress` rules means nothing is allowed in. Because `Egress` is not listed, outbound traffic is unaffected.',
    },
    {
      id: 'np-p2',
      level: 'intermediate',
      prompt:
        'You add a default-deny egress policy and every application starts reporting "host not found". Explain and give the missing rule.',
      answer:
        'DNS lookups are themselves egress traffic to CoreDNS in `kube-system` on port 53, so the default-deny policy blocked name resolution. Add:\n\negress:\n  - to:\n      - namespaceSelector:\n          matchLabels:\n            kubernetes.io/metadata.name: kube-system\n    ports:\n      - protocol: UDP\n        port: 53\n      - protocol: TCP\n        port: 53',
      explanation:
        'Include both UDP and TCP: large responses fall back to TCP. Confirm the fix with `nslookup kubernetes.default` from a temporary Pod in the namespace.',
    },
    {
      id: 'np-p3',
      level: 'advanced',
      prompt:
        'Write the ingress rule that allows traffic to `app=api` Pods **only** from Pods labelled `app=web` **in namespaces labelled** `tier=frontend`, on TCP 8080 - and explain what a single extra hyphen would change.',
      answer:
        "ingress:\n  - from:\n      - namespaceSelector:\n          matchLabels:\n            tier: frontend\n        podSelector:\n          matchLabels:\n            app: web\n    ports:\n      - protocol: TCP\n        port: 8080\n\nBoth selectors are in ONE list item, so they are ANDed: only `app=web` Pods inside `tier=frontend` namespaces are allowed.\n\nAdding a hyphen before `podSelector` would make them two list items, which are ORed: any Pod in a `tier=frontend` namespace, OR any `app=web` Pod in the policy's own namespace - a far broader rule.",
      explanation:
        "Verify which you got with `kubectl get networkpolicy <name> -o jsonpath='{.spec.ingress[0].from}'`: one object with two keys means AND, two objects mean OR.",
    },
  ],
  lab: {
    title: 'Lock down a namespace without locking yourself out',
    scenario:
      'You will prove connectivity works, apply a default deny, watch DNS break, restore it, add narrow allow rules, and run both positive and negative tests at every step.',
    prerequisites: [
      'A cluster with a policy-enforcing CNI. kind: `kind create cluster --config` with Calico, or use `minikube start --cni=calico`.',
      'If the CNI does not enforce policies, the objects apply but nothing changes - which is itself worth observing.',
    ],
    tasks: [
      { instruction: 'Confirm a policy-enforcing CNI is present.' },
      {
        instruction:
          'Create namespace `np-lab`, label it, and deploy `web`, `api` and `db` Deployments with Services.',
      },
      {
        instruction:
          'Prove unrestricted connectivity: any Pod can reach any Service, and DNS works.',
      },
      {
        instruction:
          'Apply a default-deny-all policy and confirm both DNS and connectivity now fail.',
      },
      {
        instruction:
          'Add the DNS egress rule and confirm resolution works again while connections are still blocked.',
      },
      {
        instruction:
          'Allow api ingress only from app=web on 8080, then run the positive and negative tests.',
      },
      {
        instruction:
          'Allow api egress to db on 5432 and confirm api can reach db while web cannot.',
      },
      { instruction: 'Show the AND versus OR difference with jsonpath on two example policies.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the environment',
        language: 'bash',
        code: `kubectl get pods -n kube-system | grep -Ei 'calico|cilium|antrea' \\
  || echo "WARNING: no policy-enforcing CNI found - policies will have no effect"

kubectl create namespace np-lab
kubectl label namespace np-lab tier=backend
kubectl config set-context --current --namespace=np-lab

for app in web api db; do
  kubectl create deployment "$app" --image=nginx:1.27-alpine
  kubectl expose deployment "$app" --port=80 --target-port=80
  kubectl label deployment "$app" app="$app" --overwrite >/dev/null
done
kubectl rollout status deploy/web --timeout=120s
kubectl rollout status deploy/api --timeout=120s
kubectl rollout status deploy/db  --timeout=120s
kubectl get svc,endpoints`,
      },
      {
        title: 'Step 3 - baseline: everything works',
        language: 'bash',
        code: `kubectl run t --rm -it --restart=Never --image=busybox:1.36 --labels=app=web -- sh -c '
  echo "DNS:"; nslookup api >/dev/null 2>&1 && echo "  ok" || echo "  FAIL"
  echo "api:80:"; nc -zv -w3 api 80 2>&1 | tail -1
  echo "db:80:";  nc -zv -w3 db 80  2>&1 | tail -1'
# DNS:   ok
# api:80: api (10.96.x.x:80) open
# db:80:  db (10.96.y.y:80) open
# No policies exist, so everything is permitted.`,
      },
      {
        title: 'Step 4 - default deny, and DNS breaks',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-all, namespace: np-lab}
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
YAML

kubectl run t --rm -it --restart=Never --image=busybox:1.36 --labels=app=web -- sh -c '
  echo "DNS:"; nslookup api >/dev/null 2>&1 && echo "  ok" || echo "  FAIL"
  echo "api:80:"; nc -zv -w3 api 80 2>&1 | tail -1'
# DNS:   FAIL                    <- egress to port 53 is blocked
# api:80: nc: bad address 'api'  <- cannot even resolve the name

kubectl describe networkpolicy default-deny-all | head -12
# PodSelector:     <none> (Allowing the specific traffic to all pods in this namespace)
# Allowing ingress traffic:
#   <none> (Selected pods are isolated for ingress connectivity)`,
      },
      {
        title: 'Step 5 - restore DNS only',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-dns, namespace: np-lab}
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - {protocol: UDP, port: 53}
        - {protocol: TCP, port: 53}
YAML

sleep 5
kubectl run t --rm -it --restart=Never --image=busybox:1.36 --labels=app=web -- sh -c '
  echo "DNS:"; nslookup api >/dev/null 2>&1 && echo "  ok" || echo "  FAIL"
  echo "api:80:"; nc -zv -w3 api 80 2>&1 | tail -1'
# DNS:   ok                              <- resolution restored
# api:80: nc: api (10.96.x.x:80): Operation timed out
#          ^ still blocked, which is correct - we only allowed DNS.`,
      },
      {
        title: 'Step 6 - allow api ingress from web only',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: api-allow-web, namespace: np-lab}
spec:
  podSelector:
    matchLabels: {app: api}
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: {app: web}
      ports:
        - {protocol: TCP, port: 80}
YAML

sleep 5

# We also need web to be ALLOWED TO EGRESS to api (both ends must permit)
cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: web-egress-api, namespace: np-lab}
spec:
  podSelector:
    matchLabels: {app: web}
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels: {app: api}
      ports:
        - {protocol: TCP, port: 80}
YAML

sleep 5

echo "=== POSITIVE test: app=web -> api (expect open) ==="
kubectl run t --rm -it --restart=Never --image=busybox:1.36 --labels=app=web -- \\
  nc -zv -w3 api 80 2>&1 | tail -1

echo "=== NEGATIVE test: app=stranger -> api (expect timeout) ==="
kubectl run t2 --rm -it --restart=Never --image=busybox:1.36 --labels=app=stranger -- \\
  nc -zv -w3 api 80 2>&1 | tail -1`,
      },
      {
        title: 'Step 7 - api to db',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: api-egress-db, namespace: np-lab}
spec:
  podSelector:
    matchLabels: {app: api}
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels: {app: db}
      ports:
        - {protocol: TCP, port: 80}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-allow-api, namespace: np-lab}
spec:
  podSelector:
    matchLabels: {app: db}
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: {app: api}
      ports:
        - {protocol: TCP, port: 80}
YAML

sleep 5
echo "=== api -> db (expect open) ==="
kubectl run t --rm -it --restart=Never --image=busybox:1.36 --labels=app=api -- \\
  nc -zv -w3 db 80 2>&1 | tail -1

echo "=== web -> db (expect timeout: web is not allowed to reach db) ==="
kubectl run t2 --rm -it --restart=Never --image=busybox:1.36 --labels=app=web -- \\
  nc -zv -w3 db 80 2>&1 | tail -1`,
      },
      {
        title: 'Steps 8-9 - AND vs OR, then cleanup',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: demo-and, namespace: np-lab}
spec:
  podSelector: {matchLabels: {app: api}}
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: {matchLabels: {tier: backend}}
          podSelector: {matchLabels: {app: web}}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: demo-or, namespace: np-lab}
spec:
  podSelector: {matchLabels: {app: api}}
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: {matchLabels: {tier: backend}}
        - podSelector: {matchLabels: {app: web}}
YAML

echo "AND (one item, two keys):"
kubectl get netpol demo-and -o jsonpath='{.spec.ingress[0].from}{"\\n"}'
# [{"namespaceSelector":{...},"podSelector":{...}}]

echo "OR (two items):"
kubectl get netpol demo-or -o jsonpath='{.spec.ingress[0].from}{"\\n"}'
# [{"namespaceSelector":{...}},{"podSelector":{...}}]

kubectl config set-context --current --namespace=default
kubectl delete namespace np-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl run t --rm -it --restart=Never -n np-lab --image=busybox:1.36 --labels=app=web -- nc -zv -w3 api 80',
        what: 'The positive test - an allowed source must succeed.',
        expected: 'api (...:80) open',
      },
      {
        command:
          'kubectl run t --rm -it --restart=Never -n np-lab --image=busybox:1.36 --labels=app=stranger -- nc -zv -w3 api 80',
        what: 'The negative test - a non-allowed source must fail. Skipping this hides an over-broad policy.',
        expected: 'Operation timed out.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace np-lab',
        what: 'Removes every policy, Deployment and Service.',
        expected: 'namespace "np-lab" deleted',
      },
    ],
  },
  relatedTopicIds: [
    'dns-and-service-discovery',
    'troubleshooting-networking',
    'labels-selectors-annotations',
  ],
  docs: [
    {
      title: 'Network Policies',
      url: 'https://kubernetes.io/docs/concepts/services-networking/network-policies/',
    },
    {
      title: 'Declare Network Policy (walkthrough)',
      url: 'https://kubernetes.io/docs/tasks/administer-cluster/declare-network-policy/',
    },
  ],
}
