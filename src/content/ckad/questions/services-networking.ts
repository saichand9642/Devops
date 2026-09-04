import type { Question } from '../../types'

export const servicesNetworkingQuestions: Question[] = [
  {
    id: 'net-q01',
    domainId: 'services-networking',
    topicId: 'service-types',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that creates a ClusterIP Service for Deployment api in namespace shop, listening on port 80 and forwarding to container port 8080.',
    acceptedAnswers: [
      'kubectl expose deployment api --port=80 --target-port=8080 -n shop',
      'kubectl expose deploy api --port=80 --target-port=8080 -n shop',
      'kubectl expose deployment api --port=80 --target-port=8080 --name=api -n shop',
      'kubectl -n shop expose deployment api --port=80 --target-port=8080',
      'kubectl expose deployment/api --port=80 --target-port=8080 -n shop',
    ],
    answerHint: 'kubectl expose ...',
    explanation:
      "`kubectl expose` copies the selector from the Deployment's Pod template, which removes the most common source of Service failure. ClusterIP is the default type so `--type` can be omitted. Verify with `kubectl get endpoints api -n shop`.",
  },
  {
    id: 'net-q02',
    domainId: 'services-networking',
    topicId: 'service-types',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which statement about Service types is correct?',
    options: [
      { id: 'a', text: 'A NodePort Service has no cluster IP' },
      { id: 'b', text: 'A LoadBalancer Service also has a node port and a cluster IP' },
      { id: 'c', text: 'ExternalName Services proxy traffic to an external host' },
      { id: 'd', text: 'Headless is a value of spec.type' },
    ],
    correct: ['b'],
    explanation:
      'The types nest: LoadBalancer includes NodePort, which includes ClusterIP. ExternalName only creates a DNS CNAME - no cluster IP, no proxying, no port mapping. Headless is not a type; it is `clusterIP: None` on a ClusterIP Service.',
  },
  {
    id: 'net-q03',
    domainId: 'services-networking',
    topicId: 'service-ports-and-endpoints',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      '`kubectl get endpoints web` shows `10.244.1.5:80,10.244.2.7:80` but every connection is refused. The container listens on 8080. What is wrong?',
    options: [
      { id: 'a', text: 'The Service selector does not match the Pod labels' },
      { id: 'b', text: 'targetPort was omitted, so it defaulted to the value of port (80)' },
      { id: 'c', text: 'The Pods are not Ready' },
      { id: 'd', text: 'A NetworkPolicy is blocking the traffic' },
    ],
    correct: ['b'],
    explanation:
      'Endpoints exist, so the selector is correct and the Pods are Ready - but the resolved port in the endpoints list is 80, where nothing is listening. `targetPort` defaults to `port`, which is why it should always be set explicitly. Note a NetworkPolicy would cause a timeout, not a refusal.',
  },
  {
    id: 'net-q04',
    domainId: 'services-networking',
    topicId: 'service-ports-and-endpoints',
    category: 'troubleshoot',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the single command that proves whether Service api in namespace shop is routing to any Pods at all.',
    acceptedAnswers: [
      'kubectl get endpoints api -n shop',
      'kubectl get ep api -n shop',
      'kubectl -n shop get endpoints api',
      'kubectl get endpoints -n shop api',
    ],
    answerHint: 'kubectl get ...',
    explanation:
      '`<none>` means the selector matched no Ready Pods; a populated list also tells you the resolved target port, which distinguishes a selector problem from a port problem. This is the highest-value single command in the networking domain.',
  },
  {
    id: 'net-q05',
    domainId: 'services-networking',
    topicId: 'service-ports-and-endpoints',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Deployment has 3 replicas but the Service shows only 2 endpoints. What is the most likely reason?',
    options: [
      { id: 'a', text: 'The Service has a maxEndpoints limit' },
      { id: 'b', text: 'One Pod is not Ready, so it is excluded from endpoints' },
      { id: 'c', text: 'EndpointSlices only hold two addresses' },
      { id: 'd', text: 'The third Pod is on a different node' },
    ],
    correct: ['b'],
    explanation:
      'Only Ready Pods become endpoints - that is what makes readiness probes useful for load balancing and rolling updates. `kubectl get pods` will show a `0/1 Running` Pod, and the EndpointSlice records `conditions.ready: false` for its address.',
  },
  {
    id: 'net-q06',
    domainId: 'services-networking',
    topicId: 'dns-and-service-discovery',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'A Pod in namespace web must reach Service api in namespace shop. Why does `http://api` fail, and what works?',
    options: [
      { id: 'a', text: 'CoreDNS is down; restart it' },
      {
        id: 'b',
        text: 'The first search domain is web.svc.cluster.local, so use api.shop instead',
      },
      { id: 'c', text: 'Cross-namespace DNS requires a NetworkPolicy' },
      { id: 'd', text: 'The Service must be of type ExternalName' },
    ],
    correct: ['b'],
    explanation:
      "A bare name is tried against the Pod's own namespace first. Two or more labels (`api.shop`, or the full `api.shop.svc.cluster.local`) resolve from anywhere. `kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- cat /etc/resolv.conf` shows the search list that explains it.",
  },
  {
    id: 'net-q07',
    domainId: 'services-networking',
    topicId: 'dns-and-service-discovery',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that starts a temporary busybox:1.36 Pod in namespace shop, resolves the name api, and deletes itself afterwards.',
    acceptedAnswers: [
      'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nslookup api',
      'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nslookup api',
      'kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -n shop -- nslookup api',
      'kubectl run tmp -n shop --rm -it --restart=Never --image=busybox:1.36 -- nslookup api',
    ],
    answerHint: 'kubectl run tmp --rm ...',
    explanation:
      '`--restart=Never` makes it a bare Pod rather than a Deployment, and `--rm` deletes it on exit. This is the single most useful debugging command in the networking domain - worth being able to type without thinking.',
  },
  {
    id: 'net-q08',
    domainId: 'services-networking',
    topicId: 'dns-and-service-discovery',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'What is the fully qualified DNS name of Pod db-1 of a StatefulSet fronted by headless Service db in namespace shop?',
    options: [
      { id: 'a', text: 'db-1.shop.svc.cluster.local' },
      { id: 'b', text: 'db-1.db.shop.svc.cluster.local' },
      { id: 'c', text: 'db.db-1.shop.svc.cluster.local' },
      { id: 'd', text: 'db-1.pod.shop.cluster.local' },
    ],
    correct: ['b'],
    explanation:
      'The pattern is `<pod>.<headless-service>.<namespace>.svc.cluster.local`. It only exists because the Service is headless and the StatefulSet sets `spec.serviceName` to it - a normal ClusterIP Service produces no per-Pod records.',
  },
  {
    id: 'net-q09',
    domainId: 'services-networking',
    topicId: 'dns-and-service-discovery',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A Service name resolves correctly but connections time out. Is this a DNS problem, and what is the next command?',
    options: [
      { id: 'a', text: 'Yes - restart CoreDNS' },
      { id: 'b', text: 'No - resolution succeeded; run `kubectl get endpoints <svc>`' },
      { id: 'c', text: 'Yes - the search domains are wrong' },
      { id: 'd', text: 'No - the problem must be the container image' },
    ],
    correct: ['b'],
    explanation:
      'A ClusterIP is a set of forwarding rules, not a listening socket, so it resolves whether or not anything is behind it. The two candidates after a successful lookup are empty endpoints and a NetworkPolicy - and a *timeout* rather than a refusal points at the policy.',
  },
  {
    id: 'net-q10',
    domainId: 'services-networking',
    topicId: 'ingress',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that creates an Ingress named shop in namespace shop, class nginx, routing shop.example.com/api and everything below it to Service api on port 80.',
    acceptedAnswers: [
      'kubectl create ingress shop --class=nginx --rule="shop.example.com/api*=api:80" -n shop',
      "kubectl create ingress shop --class=nginx --rule='shop.example.com/api*=api:80' -n shop",
      'kubectl create ingress shop -n shop --class=nginx --rule="shop.example.com/api*=api:80"',
      'kubectl -n shop create ingress shop --class=nginx --rule="shop.example.com/api*=api:80"',
    ],
    answerHint: 'kubectl create ingress ...',
    explanation:
      'The trailing `*` on the path produces `pathType: Prefix`; without it you get `Exact`. Using the generator also produces the correct nested `backend.service.name`/`port` shape, which is the part that is easy to get wrong by hand.',
  },
  {
    id: 'net-q11',
    domainId: 'services-networking',
    topicId: 'ingress',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'With `path: /api` and `pathType: Prefix`, which request path does NOT match?',
    options: [
      { id: 'a', text: '/api' },
      { id: 'b', text: '/api/v1/orders' },
      { id: 'c', text: '/apifoo' },
      { id: 'd', text: '/api/' },
    ],
    correct: ['c'],
    explanation:
      'Prefix matching is by whole path *segments*, so `foo` appended to `api` is a different segment and does not match. Matching `/apifoo` would require `pathType: ImplementationSpecific` with a controller-specific pattern. Prefix matching is also case sensitive.',
  },
  {
    id: 'net-q12',
    domainId: 'services-networking',
    topicId: 'ingress',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'An Ingress exists and `kubectl get ingress` shows an empty ADDRESS column. What does this indicate?',
    options: [
      { id: 'a', text: 'The backend Service has no endpoints' },
      { id: 'b', text: 'No Ingress controller is installed or handling this class' },
      { id: 'c', text: 'The TLS secret is missing' },
      { id: 'd', text: 'The pathType is invalid' },
    ],
    correct: ['b'],
    explanation:
      'The controller writes its address into `status.loadBalancer.ingress`. An empty ADDRESS means nothing is watching the object, so no traffic will ever be routed. Confirm with `kubectl get ingressclass` and `kubectl get pods -A | grep -i ingress`. A missing backend would instead give a 503.',
  },
  {
    id: 'net-q13',
    domainId: 'services-networking',
    topicId: 'ingress',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'An Ingress has an ADDRESS and returns 503. `kubectl describe ingress` shows the backend as `api:80 (<none>)`. What does that tell you?',
    options: [
      { id: 'a', text: 'The Host header does not match any rule' },
      {
        id: 'b',
        text: 'The backend Service has no endpoints, or the referenced port does not exist on it',
      },
      { id: 'c', text: 'The TLS certificate has expired' },
      { id: 'd', text: 'The Ingress class is wrong' },
    ],
    correct: ['b'],
    explanation:
      'The parenthesised part of the describe output is the endpoint list, and `<none>` means the controller had nowhere to send the request - hence 503 rather than 404. Check the Service selector, Pod readiness, and whether the Ingress references a port the Service actually defines. A 404 would instead mean no rule matched.',
  },
  {
    id: 'net-q14',
    domainId: 'services-networking',
    topicId: 'networkpolicy',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What happens to a Pod as soon as any NetworkPolicy selects it?',
    options: [
      { id: 'a', text: 'Nothing changes until an explicit deny rule is added' },
      { id: 'b', text: 'It becomes default-deny for the directions listed in policyTypes' },
      { id: 'c', text: 'All its traffic is blocked in both directions' },
      { id: 'd', text: 'Only ingress traffic is affected, never egress' },
    ],
    correct: ['b'],
    explanation:
      'This is the property that makes policies feel surprising: adding a policy that "allows" something can break traffic that previously worked, because everything not explicitly allowed in those directions is now denied. A policy listing only `Ingress` leaves egress unrestricted.',
  },
  {
    id: 'net-q15',
    domainId: 'services-networking',
    topicId: 'networkpolicy',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'After applying a default-deny egress policy, applications report "host not found" for every dependency. What is missing?',
    options: [
      { id: 'a', text: 'An ingress rule allowing the applications to receive traffic' },
      { id: 'b', text: 'An egress rule allowing UDP and TCP port 53 to kube-system' },
      { id: 'c', text: 'A `policyTypes: [Ingress]` entry' },
      { id: 'd', text: 'A CNI plugin that enforces policies' },
    ],
    correct: ['b'],
    explanation:
      'DNS lookups are themselves egress traffic to CoreDNS, so a default-deny egress policy blocks name resolution before any connection is attempted. Include both UDP and TCP because large responses fall back to TCP. Select the namespace reliably with `kubernetes.io/metadata.name: kube-system`.',
  },
  {
    id: 'net-q16',
    domainId: 'services-networking',
    topicId: 'networkpolicy',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'You need to allow traffic only from Pods labelled app=web that are in namespaces labelled tier=frontend. Which YAML expresses that?',
    options: [
      {
        id: 'a',
        text: 'ingress:\n  - from:\n      - namespaceSelector:\n          matchLabels:\n            tier: frontend\n        podSelector:\n          matchLabels:\n            app: web',
      },
      {
        id: 'b',
        text: 'ingress:\n  - from:\n      - namespaceSelector:\n          matchLabels:\n            tier: frontend\n      - podSelector:\n          matchLabels:\n            app: web',
      },
      {
        id: 'c',
        text: 'ingress:\n  - from:\n      - namespaceSelector:\n          matchLabels:\n            tier: frontend\n            app: web',
      },
      {
        id: 'd',
        text: 'ingress:\n  - from:\n      - podSelector:\n          matchLabels:\n            app: web\n            namespace: frontend',
      },
    ],
    correct: ['a'],
    explanation:
      'Two selectors in ONE list item are ANDed - "Pods with this label in namespaces with that label". Option B has two list items, which are ORed: any Pod in a frontend namespace, or any app=web Pod in the policy\'s own namespace. One hyphen changes the meaning entirely.',
  },
  {
    id: 'net-q17',
    domainId: 'services-networking',
    topicId: 'troubleshooting-networking',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'What does the difference between "connection refused" and "connection timed out" tell you?',
    options: [
      { id: 'a', text: 'They are equivalent; both mean the Service is misconfigured' },
      {
        id: 'b',
        text: 'Refused means a host answered with nothing listening; timeout means packets were dropped',
      },
      { id: 'c', text: 'Refused means DNS failed; timeout means the Pod is not Ready' },
      {
        id: 'd',
        text: 'Refused means a NetworkPolicy blocked it; timeout means the port is wrong',
      },
    ],
    correct: ['b'],
    explanation:
      'This is the most useful single distinction in Kubernetes networking. Refused points at a wrong `targetPort` or an application not listening. A timeout points at packets being silently dropped - a NetworkPolicy, a wrong IP, or no route.',
  },
  {
    id: 'net-q18',
    domainId: 'services-networking',
    topicId: 'troubleshooting-networking',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that tests TCP reachability of Service api on port 80 from a temporary Pod in namespace shop, with a three-second timeout.',
    acceptedAnswers: [
      'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w 3 api 80',
      'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w 3 api 80',
      'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w3 api 80',
      'kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- nc -zv -w3 api 80',
    ],
    answerHint: 'kubectl run tmp ... -- nc ...',
    explanation:
      '`nc -z` tests a port without sending data and reports open, refused or timed out - which is exactly the distinction you need. Use `nc`, not `ping`: a ClusterIP does not answer ICMP, so a failed ping proves nothing.',
  },
  {
    id: 'net-q19',
    domainId: 'services-networking',
    topicId: 'service-types',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create a Deployment named web with 2 replicas of nginx:1.27-alpine listening on port 80, and expose it as a NodePort Service named web on Service port 80, target port 80, using node port 30080.',
    context: 'Namespace shop exists.',
    checkpoints: [
      { id: 'c1', text: 'Deployment web exists in shop with 2 replicas and reports READY 2/2' },
      { id: 'c2', text: 'Service web is of type NodePort with nodePort 30080' },
      { id: 'c3', text: 'The Service port is 80 and targetPort is 80' },
      { id: 'c4', text: '`kubectl get endpoints web -n shop` lists two Pod IPs on port 80' },
      { id: 'c5', text: 'The Service is reachable in-cluster as http://web from a temporary Pod' },
    ],
    explanation:
      'A NodePort Service still has a cluster IP and a DNS name, so it is reachable both internally and on every node. The node port must be in the 30000-32767 range unless the cluster was configured otherwise.',
    solution: [
      {
        title: 'Imperative, then patch the node port',
        language: 'bash',
        code: `kubectl create deployment web --image=nginx:1.27-alpine --replicas=2 -n shop
kubectl rollout status deploy/web -n shop --timeout=120s

kubectl expose deployment web --type=NodePort --port=80 --target-port=80 -n shop
kubectl patch svc web -n shop \\
  -p '{"spec":{"ports":[{"port":80,"targetPort":80,"nodePort":30080}]}}'`,
      },
      {
        title: 'Or declaratively',
        language: 'yaml',
        code: `apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: shop
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080 # must be 30000-32767`,
      },
      {
        title: 'Verify',
        language: 'bash',
        code: `kubectl get svc web -n shop
# TYPE NodePort, PORT(S) 80:30080/TCP
kubectl get endpoints web -n shop
# two IP:80 entries

kubectl run tmp --rm -i --restart=Never -n shop --image=busybox:1.36 -- \\
  wget -qO- --timeout=3 http://web | head -3`,
      },
    ],
  },
  {
    id: 'net-q20',
    domainId: 'services-networking',
    topicId: 'networkpolicy',
    category: 'lab',
    kind: 'task',
    difficulty: 'advanced',
    points: 5,
    prompt:
      'In namespace shop, apply NetworkPolicies so that: no Pod may receive or send traffic by default; every Pod may still resolve DNS; and Pods labelled app=api accept ingress on TCP 8080 only from Pods labelled app=web in the same namespace.',
    context:
      'Namespace shop exists, and the cluster CNI enforces NetworkPolicies (Calico, Cilium or similar).',
    checkpoints: [
      {
        id: 'c1',
        text: 'A policy with podSelector {} and policyTypes [Ingress, Egress] exists in shop',
      },
      { id: 'c2', text: 'A policy allows egress to UDP and TCP port 53 towards kube-system' },
      { id: 'c3', text: 'A policy allows ingress to app=api on TCP 8080 from podSelector app=web' },
      {
        id: 'c4',
        text: 'A temporary Pod labelled app=web can reach the api Service; DNS resolves',
      },
      { id: 'c5', text: 'A temporary Pod with a different label times out when reaching api' },
    ],
    explanation:
      'The order matters in practice: apply the default deny and the DNS rule together, or everything appears catastrophically broken. Remember that both ends must permit traffic - if the web Pods also have an egress policy, they need a matching egress rule to reach api.',
    solution: [
      {
        title: 'policies.yaml',
        language: 'yaml',
        code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: shop
spec:
  podSelector: {} # every Pod in the namespace
  policyTypes: [Ingress, Egress]
---
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
              # added automatically to every namespace
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow-web
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 8080
---
# Both ends must permit: web needs egress to api
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-egress-api
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 8080`,
      },
      {
        title: 'Verify BOTH directions',
        language: 'bash',
        code: `kubectl apply -f policies.yaml
sleep 5

# DNS must still work
kubectl run t --rm -i --restart=Never -n shop --image=busybox:1.36 -- \\
  nslookup kubernetes.default | tail -3

# POSITIVE: an allowed source
kubectl run t --rm -i --restart=Never -n shop --image=busybox:1.36 \\
  --labels=app=web -- nc -zv -w3 api 8080 2>&1 | tail -1
# api (...:8080) open

# NEGATIVE: a non-allowed source (do not skip this)
kubectl run t2 --rm -i --restart=Never -n shop --image=busybox:1.36 \\
  --labels=app=stranger -- nc -zv -w3 api 8080 2>&1 | tail -1
# Operation timed out`,
      },
    ],
  },
  {
    id: 'net-q21',
    domainId: 'services-networking',
    topicId: 'ingress',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create an Ingress named shop of class nginx for host shop.example.com that routes /api and below to Service api port 80, and everything else to Service web port 80.',
    context:
      'Namespace shop exists with Services api and web already created, and an nginx Ingress controller is installed.',
    checkpoints: [
      { id: 'c1', text: 'Ingress shop exists in namespace shop with ingressClassName nginx' },
      { id: 'c2', text: 'A rule for host shop.example.com has two paths' },
      { id: 'c3', text: '/api uses pathType Prefix and points at service api port 80' },
      { id: 'c4', text: '/ uses pathType Prefix and points at service web port 80' },
      {
        id: 'c5',
        text: '`kubectl describe ingress shop -n shop` shows non-empty endpoints for both backends',
      },
    ],
    explanation:
      'This is the fan-out pattern. Both paths use Prefix, and the longer one wins for matching requests, so `/api/v1` reaches api while `/health` reaches web. Both Services must be in the same namespace as the Ingress - an Ingress cannot reference a Service elsewhere.',
    solution: [
      {
        title: 'Imperative',
        language: 'bash',
        code: `kubectl create ingress shop -n shop --class=nginx \\
  --rule="shop.example.com/api*=api:80" \\
  --rule="shop.example.com/*=web:80"`,
      },
      {
        title: 'Declarative equivalent',
        language: 'yaml',
        code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80`,
      },
      {
        title: 'Verify',
        language: 'bash',
        code: `kubectl get ingress shop -n shop
# ADDRESS should become populated once the controller handles it

kubectl describe ingress shop -n shop | grep -A5 Rules
#   shop.example.com
#                     /api   api:80 (10.244.1.5:8080)
#                     /      web:80 (10.244.2.7:8080)

ADDR=$(kubectl get ingress shop -n shop -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -sS -H "Host: shop.example.com" "http://\${ADDR:-localhost}/api" -o /dev/null -w "%{http_code}\\n"`,
      },
    ],
  },
  {
    id: 'net-q22',
    domainId: 'services-networking',
    topicId: 'service-types',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'How do you create a headless Service, and what does DNS return for it?',
    options: [
      { id: 'a', text: '`type: Headless`; DNS returns the cluster IP' },
      { id: 'b', text: '`clusterIP: None`; DNS returns the Pod IPs directly' },
      { id: 'c', text: '`type: ExternalName`; DNS returns a CNAME' },
      { id: 'd', text: 'Omit `spec.ports`; DNS returns nothing' },
    ],
    correct: ['b'],
    explanation:
      'Headless is not a type - it is `clusterIP: None` on a ClusterIP Service. DNS then returns one A record per Ready Pod instead of a single virtual IP, which is what StatefulSets need and what clients doing their own load balancing want. No generator produces one, so it must be written or patched in.',
  },
]
