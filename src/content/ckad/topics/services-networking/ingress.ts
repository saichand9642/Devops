import type { Topic } from '../../../types'

export const ingress: Topic = {
  id: 'ingress',
  title: 'Ingress, IngressClass and path types',
  domainId: 'services-networking',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 4,
  tags: ['ingress', 'ingressclass', 'pathType', 'Prefix', 'Exact', 'tls', 'host', 'controller'],
  oneLiner:
    'HTTP routing into the cluster: what the Ingress object declares, what the controller actually does, and the three path types that decide which rule wins.',
  explanation: [
    'An **Ingress** declares HTTP and HTTPS routing rules: which host and path go to which Service and port. It is a *declaration*, not an implementation - nothing routes anything unless an **Ingress controller** (nginx, Traefik, HAProxy, a cloud load balancer controller) is installed and watching.',
    'That separation is the single most important fact. `kubectl apply -f ingress.yaml` succeeds on a cluster with no controller, `kubectl get ingress` shows the object, and no traffic is ever routed. The tell is an empty ADDRESS column.',
    'An **IngressClass** names a controller and its parameters. An Ingress selects one with `spec.ingressClassName`. One IngressClass may be marked default via an annotation, in which case an Ingress with no class gets it. The old `kubernetes.io/ingress.class` annotation is deprecated in favour of the field.',
    '**pathType** is required on every path and has three values. `Exact` matches the path exactly. `Prefix` matches by whole path *segments* - so `/api` matches `/api` and `/api/v1` but not `/apifoo`. `ImplementationSpecific` hands matching to the controller, which is how nginx regular expressions are used.',
    'Ingress handles layer-7 HTTP/HTTPS only. TCP and UDP are outside its scope - for those you use a NodePort or LoadBalancer Service, or controller-specific configuration.',
  ],
  whyItMatters: [
    '"Use Ingress rules to expose applications" is a named curriculum competency, and the object is written by hand often enough that its shape must be memorised.',
    'The `networking.k8s.io/v1` shape is genuinely different from the old examples still all over the internet: nested `service.name`/`service.port.number`, required `pathType`, and `ingressClassName` instead of an annotation.',
    'The "no controller, no routing" insight prevents a long, fruitless debugging session on a cluster where Ingress was never going to work.',
  ],
  howItWorks: [
    'The controller watches Ingress objects and configures its own data plane (an nginx configuration, a cloud load balancer, a Traefik router). It then writes the external address back into `status.loadBalancer.ingress`, which is what the ADDRESS column shows.',
    'Routing order: the request Host header selects among `spec.rules` (a rule with no `host` matches any host); then paths are matched, with `Exact` beating `Prefix` and longer prefixes beating shorter ones. `spec.defaultBackend` catches anything unmatched.',
    'Prefix matching is by path segment. `/api` as a Prefix matches `/api`, `/api/`, `/api/v1/orders`, but not `/apifoo`. That segment rule is the detail people get wrong.',
    'The backend is a Service and a port: `service.name` plus either `service.port.number` or `service.port.name`. Using the port *name* is more robust when the Service port number changes.',
    'TLS: `spec.tls[]` lists hosts and a `secretName`. The Secret must be type `kubernetes.io/tls` with keys `tls.crt` and `tls.key`, and it must live in the same namespace as the Ingress.',
    'Path rewriting is not part of the Ingress API. `nginx.ingress.kubernetes.io/rewrite-target` and equivalents are controller-specific annotations, and they usually require `pathType: ImplementationSpecific` with a capture group.',
    'The Gateway API is the successor for advanced routing (`HTTPRoute`, `Gateway`), but Ingress remains what CKAD tests.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'From browser to Pod through an Ingress',
      caption:
        'The Ingress object is only configuration. The controller Pod is what actually receives and forwards the request.',
      participants: [
        { id: 'user', label: 'Browser' },
        { id: 'ctl', label: 'Ingress controller' },
        { id: 'svc', label: 'Service' },
        { id: 'pod', label: 'Pod' },
      ],
      messages: [
        { from: 'user', to: 'ctl', label: 'GET shop.example.com/cart' },
        { from: 'ctl', to: 'ctl', label: 'match host, then path rule' },
        { from: 'ctl', to: 'svc', label: 'forward to cart-svc:80' },
        { from: 'svc', to: 'pod', label: 'to a Ready endpoint:8080' },
        { from: 'pod', to: 'user', label: 'response back through the controller', kind: 'return' },
      ],
    },
    {
      kind: 'flow',
      title: 'Why an Ingress returns 404 or has no address',
      caption:
        'Work outward from the Pod. An Ingress can only be as healthy as the Service it names.',
      nodes: [
        {
          label: 'ADDRESS column is empty',
          detail: 'No controller has claimed this Ingress',
          tone: 'warning',
          branch: {
            label: 'ingressClassName missing',
            detail: 'Set it, or mark an IngressClass as default',
          },
        },
        {
          label: 'Controller has claimed it',
          detail: 'An address or hostname appears',
          arrowLabel: 'class matches',
        },
        {
          label: 'Does the backend Service exist?',
          detail: 'Same namespace as the Ingress, exact name and port',
          branch: {
            label: 'Name or port wrong',
            detail: '404 or 503 - describe ingress reports the bad backend',
          },
        },
        {
          label: 'Does the Service have endpoints?',
          detail: 'kubectl get endpoints <service>',
          arrowLabel: 'Service exists',
          branch: {
            label: 'Empty endpoints',
            detail: 'A Service problem, not an Ingress problem. Fix that first.',
          },
        },
        { label: 'Request reaches the Pod', tone: 'success' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Ingress',
      apiVersion: 'networking.k8s.io/v1',
      purpose: 'Declares HTTP/HTTPS routing rules into cluster Services.',
      fields: [
        {
          path: 'spec.ingressClassName',
          meaning: 'Which controller handles this Ingress. Replaces the old annotation.',
        },
        { path: 'spec.rules[].host', meaning: 'Host header to match. Omit to match any host.' },
        {
          path: 'spec.rules[].http.paths[].path',
          meaning: 'The URL path to match.',
          required: true,
        },
        {
          path: 'spec.rules[].http.paths[].pathType',
          meaning: 'Exact, Prefix or ImplementationSpecific. REQUIRED.',
          required: true,
        },
        {
          path: 'spec.rules[].http.paths[].backend.service.name',
          meaning: 'Target Service in the same namespace.',
          required: true,
        },
        {
          path: 'spec.rules[].http.paths[].backend.service.port.number',
          meaning: 'Service port number (or use port.name).',
        },
        { path: 'spec.defaultBackend', meaning: 'Where unmatched requests go.' },
        { path: 'spec.tls[].hosts[]', meaning: 'Hostnames covered by the certificate.' },
        {
          path: 'spec.tls[].secretName',
          meaning: 'A kubernetes.io/tls Secret in the same namespace.',
        },
        {
          path: 'status.loadBalancer.ingress[]',
          meaning: 'Address assigned by the controller. Empty means no controller acted.',
        },
      ],
    },
    {
      kind: 'IngressClass',
      apiVersion: 'networking.k8s.io/v1',
      purpose: 'Names an Ingress controller. Cluster-scoped.',
      fields: [
        {
          path: 'spec.controller',
          meaning: 'Controller identifier, e.g. k8s.io/ingress-nginx.',
          required: true,
        },
        {
          path: 'spec.parameters',
          meaning: 'Optional reference to controller-specific configuration.',
        },
        {
          path: 'metadata.annotations["ingressclass.kubernetes.io/is-default-class"]',
          meaning: '"true" makes this the class for Ingresses that omit ingressClassName.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Two Ingress problems that look identical',
    story: [
      'A team reports "the Ingress does not work" twice in a month, and the two causes are completely different.',
      'The first time, `kubectl get ingress` shows an empty ADDRESS column. No controller is installed - the cluster is a bare kind cluster. The Ingress object is perfectly valid and utterly inert. The fix is to install ingress-nginx (or, for a quick test, use `kubectl port-forward` and skip Ingress entirely).',
      'The second time, ADDRESS is populated and `curl` returns 503. That means the controller *is* working and could not reach a backend. `kubectl describe ingress` shows the backend as `api:80 (<none>)` - the parenthesised part is the endpoint list, and it is empty.',
      'The cause was a `service.port.number: 80` pointing at a Service whose port was actually 8080. The controller resolved the Service, found no matching port, and had nothing to route to.',
      "The diagnostic rule they wrote down: empty ADDRESS means no controller; ADDRESS present with 503 means the backend Service or its endpoints are wrong; 404 from the controller's default backend means no rule matched the host or path.",
    ],
    code: [
      {
        title: 'The two signatures',
        language: 'bash',
        code: `# Signature 1: no controller
kubectl get ingress -n shop
# NAME   CLASS   HOSTS              ADDRESS   PORTS   AGE
# shop   nginx   shop.example.com             80      5m
#                                   ^^^^^^^ empty = nothing is handling this
kubectl get ingressclass
# No resources found            <- confirms it

# Signature 2: controller working, backend wrong
kubectl get ingress -n shop
# NAME   CLASS   HOSTS              ADDRESS        PORTS   AGE
# shop   nginx   shop.example.com   203.0.113.10   80      5m

kubectl describe ingress shop -n shop | grep -A4 Rules
#   Host               Path  Backends
#   shop.example.com
#                      /     api:80 (<none>)
#                                    ^^^^^^ no endpoints -> 503`,
        explanation:
          'The parenthesised endpoint list in `describe ingress` output is the fastest backend check there is.',
        placeholders: ['shop', 'shop.example.com'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A complete Ingress with host, paths and TLS',
      language: 'yaml',
      code: `apiVersion: networking.k8s.io/v1 # NOT extensions/v1beta1 - that is removed
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: nginx # replaces kubernetes.io/ingress.class
  tls:
    - hosts:
        - shop.example.com
      secretName: shop-tls # type kubernetes.io/tls, SAME namespace
  rules:
    - host: shop.example.com
      http:
        paths:
          # Exact: only /health, not /health/live
          - path: /health
            pathType: Exact
            backend:
              service:
                name: health
                port:
                  number: 80

          # Prefix: /api, /api/, /api/v1/orders - but NOT /apifoo
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  name: http # port NAME is more robust than a number

          # Catch-all for this host, matched last because it is shortest
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
  # Anything that matches no rule at all
  defaultBackend:
    service:
      name: web
      port:
        number: 80`,
      explanation:
        'Note the backend shape: `backend.service.name` plus `backend.service.port.number|name`. The old flat `serviceName`/`servicePort` fields belong to a removed API version.',
      placeholders: ['shop', 'shop.example.com', 'shop-tls'],
    },
    {
      title: 'Path types, precisely',
      language: 'text',
      code: `pathType: Exact
  path: /api
    /api          MATCH
    /api/         no
    /api/v1       no
    /API          no    (case sensitive)

pathType: Prefix          (matches whole path SEGMENTS)
  path: /api
    /api          MATCH
    /api/         MATCH
    /api/v1       MATCH
    /api/v1/x     MATCH
    /apifoo       no    <- "foo" is not a new segment
    /apis         no

  path: /
    everything    MATCH  (the catch-all)

pathType: ImplementationSpecific
  Matching is delegated to the controller. With ingress-nginx this enables
  regular expressions, which rewrite-target needs:

    metadata:
      annotations:
        nginx.ingress.kubernetes.io/rewrite-target: /$2
    spec:
      rules:
        - host: shop.example.com
          http:
            paths:
              - path: /api(/|$)(.*)
                pathType: ImplementationSpecific
                backend:
                  service: {name: api, port: {number: 80}}

  Result: a request for /api/v1/orders reaches the backend as /v1/orders.

Precedence when several paths match: Exact beats Prefix, and among
Prefix matches the LONGEST path wins.`,
      explanation:
        'The `/apifoo` case is the one worth memorising - Prefix is segment-based, not a string prefix.',
    },
    {
      title: 'IngressClass, including a default',
      language: 'yaml',
      code: `apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: nginx
  annotations:
    # Ingresses that omit ingressClassName get this one
    ingressclass.kubernetes.io/is-default-class: "true"
spec:
  controller: k8s.io/ingress-nginx
---
# A second class for an internal-only controller
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: nginx-internal
spec:
  controller: k8s.io/ingress-nginx
  parameters:
    apiGroup: k8s.example.com
    kind: IngressParameters
    name: internal-config`,
      explanation:
        'IngressClass is cluster-scoped. Having exactly one default is convenient; having two is a misconfiguration that makes class selection unpredictable.',
    },
    {
      title: 'Fan-out and name-based virtual hosting',
      language: 'yaml',
      code: `# Fan-out: one host, several paths to different Services
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fanout
  namespace: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend: {service: {name: api, port: {number: 80}}}
          - path: /admin
            pathType: Prefix
            backend: {service: {name: admin, port: {number: 80}}}
          - path: /
            pathType: Prefix
            backend: {service: {name: web, port: {number: 80}}}
---
# Name-based virtual hosting: several hosts, each to its own Service
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vhosts
  namespace: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: {service: {name: web, port: {number: 80}}}
    - host: admin.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: {service: {name: admin, port: {number: 80}}}`,
      explanation:
        'These are the two shapes almost every real Ingress uses. An Ingress can only reference Services in its own namespace, so cross-namespace routing needs one Ingress per namespace.',
      placeholders: ['shop', 'shop.example.com', 'admin.example.com'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl create ingress shop --rule="shop.example.com/api*=api:80" --class=nginx -n shop',
      what: 'The imperative generator. `*` at the end of the path means pathType Prefix; without it, Exact.',
      expected: 'ingress.networking.k8s.io/shop created',
      placeholders: ['shop', 'shop.example.com', 'api', 'shop'],
    },
    {
      command:
        'kubectl create ingress shop --rule="shop.example.com/api*=api:80" --rule="shop.example.com/*=web:80" --class=nginx -n shop',
      what: 'Several rules in one command; repeat `--rule` per path.',
      expected: 'An Ingress with two paths.',
      placeholders: ['shop', 'shop.example.com', 'shop'],
    },
    {
      command:
        'kubectl create ingress shop --rule="shop.example.com/*=web:80,tls=shop-tls" --class=nginx -n shop',
      what: 'Adds TLS to a rule by appending `,tls=<secret>`.',
      expected: 'An Ingress with a spec.tls entry.',
      placeholders: ['shop', 'shop.example.com', 'shop-tls', 'shop'],
    },
    {
      command:
        'kubectl create ingress shop --rule="shop.example.com/*=web:80" --class=nginx --dry-run=client -o yaml > ing.yaml',
      what: 'Generates the correctly shaped manifest to extend by hand - far safer than typing the nested backend.',
      expected: 'A file with networking.k8s.io/v1 and a nested service backend.',
      placeholders: ['shop', 'shop.example.com'],
    },
    {
      command: 'kubectl get ingress -n shop',
      what: 'CLASS, HOSTS, ADDRESS and PORTS. An empty ADDRESS is the no-controller signature.',
      expected: 'An address once a controller has handled it.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe ingress shop -n shop',
      what: 'Shows the rules with their resolved backends and endpoint lists, plus controller events.',
      expected: 'A Rules table where each backend shows endpoints in parentheses.',
      placeholders: ['shop', 'shop'],
    },
    {
      command: 'kubectl get ingressclass',
      what: 'Which controllers exist, and which class is the default.',
      expected: 'nginx k8s.io/ingress-nginx, or nothing on a cluster with no controller.',
    },
    {
      command:
        'kubectl get ingress shop -n shop -o jsonpath=\'{.status.loadBalancer.ingress[0].ip}{"\\n"}\'',
      what: 'The address a controller assigned; empty means no controller acted.',
      expected: 'An IP, or empty.',
      placeholders: ['shop', 'shop'],
    },
    {
      command:
        'curl -sS -H "Host: shop.example.com" http://203.0.113.10/api -o /dev/null -w "%{http_code}\\n"',
      what: 'Tests host-based routing without DNS by setting the Host header explicitly.',
      expected: '200. A 503 means no healthy backend; a 404 means no rule matched.',
      placeholders: ['shop.example.com', '203.0.113.10'],
    },
    {
      command: 'kubectl get pods -n ingress-nginx',
      what: 'Confirms the controller itself is running before you blame the Ingress object.',
      expected: 'A Running controller Pod, or no such namespace.',
    },
  ],
  declarative: {
    steps: [
      'Confirm a controller exists first: `kubectl get ingressclass` and `kubectl get pods -A | grep ingress`.',
      'Generate the skeleton with `kubectl create ingress ... --dry-run=client -o yaml` so the nested backend shape is correct.',
      'Set `ingressClassName` explicitly rather than relying on a default class.',
      'Give every path a `pathType`, and prefer `Prefix` unless the task says otherwise.',
      'For TLS, create a `kubernetes.io/tls` Secret in the same namespace and reference it in `spec.tls`.',
      'Verify with `kubectl describe ingress` (are there endpoints?) and a `curl -H "Host: ..."` against the address.',
    ],
    code: [
      {
        title: 'Generate, extend, verify',
        language: 'bash',
        code: `# 1. Is there a controller at all?
kubectl get ingressclass
# nginx   k8s.io/ingress-nginx   <default>   2d

# 2. Generate the right shape
kubectl create ingress shop -n shop --class=nginx \\
  --rule="shop.example.com/api*=api:80" \\
  --rule="shop.example.com/*=web:80" \\
  --dry-run=client -o yaml > ing.yaml

# 3. Add TLS or annotations by hand, then apply
kubectl apply -f ing.yaml

# 4. Verify the backends resolve to real endpoints
kubectl describe ingress shop -n shop | grep -A6 Rules

# 5. Functional test using the Host header
ADDR=$(kubectl get ingress shop -n shop -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -sS -H "Host: shop.example.com" "http://$ADDR/api" -o /dev/null -w "%{http_code}\\n"`,
        placeholders: ['shop', 'shop.example.com'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get ingress shop -n shop',
      what: 'A populated ADDRESS is the first sign a controller has accepted the Ingress.',
      expected: 'An IP or hostname in the ADDRESS column.',
      placeholders: ['shop', 'shop'],
    },
    {
      command: 'kubectl describe ingress shop -n shop | grep -A6 Rules',
      what: 'Each backend should show a non-empty endpoint list in parentheses.',
      expected: 'api:80 (10.244.1.5:8080,10.244.2.7:8080)',
      placeholders: ['shop', 'shop'],
    },
    {
      command:
        'curl -sS -H "Host: shop.example.com" http://<address>/api -o /dev/null -w "%{http_code}\\n"',
      what: 'The end-to-end test through the controller.',
      expected: '200',
      placeholders: ['shop.example.com', '<address>'],
    },
    {
      command:
        'kubectl get ingress shop -n shop -o jsonpath=\'{range .spec.rules[*].http.paths[*]}{.path}{" "}{.pathType}{" -> "}{.backend.service.name}{":"}{.backend.service.port.number}{"\\n"}{end}\'',
      what: 'The routing table as configured, in one readable list.',
      expected: '/api Prefix -> api:80 and / Prefix -> web:80.',
      placeholders: ['shop', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get ingressclass && kubectl get pods -A | grep -i ingress',
      what: 'Empty ADDRESS almost always means no controller. Check this before anything else.',
      expected: 'An IngressClass and a Running controller Pod.',
    },
    {
      command: 'kubectl describe ingress shop -n shop | grep -A6 Rules',
      what: 'A backend showing `(<none>)` means the Service has no endpoints, which produces 503.',
      expected: 'Endpoints listed after each backend.',
      placeholders: ['shop', 'shop'],
    },
    {
      command: 'kubectl get svc api -n shop && kubectl get endpoints api -n shop',
      what: 'Confirms the backend Service exists, its port matches what the Ingress references, and it has endpoints.',
      expected: 'The port you referenced, and a non-empty endpoints list.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=30',
      what: "The controller's own view: configuration reload errors, TLS problems, and per-request status codes.",
      expected: 'Reload succeeded, or a specific error.',
    },
    {
      command:
        'kubectl get secret shop-tls -n shop -o jsonpath=\'{.type}{" "}{range $k,$v := .data}{$k}{" "}{end}{"\\n"}\'',
      what: 'TLS failures are usually the wrong Secret type or wrong key names, or the Secret being in another namespace.',
      expected: 'kubernetes.io/tls tls.crt tls.key',
      placeholders: ['shop-tls', 'shop'],
    },
    {
      command: 'kubectl apply -f ingress.yaml',
      what: 'A missing `pathType` or the old flat backend shape fails validation here.',
      expected: 'spec.rules[0].http.paths[0].pathType: Required value',
      placeholders: ['ingress.yaml'],
    },
    {
      command:
        'curl -sS -H "Host: wrong.example.com" http://<address>/ -o /dev/null -w "%{http_code}\\n"',
      what: 'A 404 from the controller means the Host or path matched no rule - not a backend problem.',
      expected: '404, confirming host-based routing is in play.',
      placeholders: ['<address>'],
    },
  ],
  commonMistakes: [
    'Applying an Ingress on a cluster with no controller and expecting routing. Empty ADDRESS is the giveaway.',
    'Using `apiVersion: extensions/v1beta1` from an old tutorial. It has been removed.',
    'Using the flat `serviceName`/`servicePort` backend shape instead of the nested `service.name`/`service.port`.',
    'Omitting `pathType`, which is required in networking.k8s.io/v1.',
    'Expecting `Prefix: /api` to match `/apifoo`. Prefix matches whole segments.',
    'Referencing a Service in a different namespace. An Ingress can only target Services in its own namespace.',
    'Putting the TLS Secret in the wrong namespace, or using the wrong type or key names.',
    'Expecting path rewriting from the Ingress API. It is a controller-specific annotation.',
    'Setting the deprecated `kubernetes.io/ingress.class` annotation instead of `spec.ingressClassName`.',
    'Having two IngressClasses marked as default, which makes class selection unpredictable.',
  ],
  examTips: [
    '`kubectl create ingress <name> --class=nginx --rule="host/path*=svc:port"` is the fastest correct answer. The trailing `*` means Prefix.',
    'Generate with `--dry-run=client -o yaml` rather than typing the nested backend from memory.',
    '`pathType` is required - write `Prefix` unless the task says "exactly".',
    'Verify with `kubectl describe ingress` and look for endpoints in parentheses after each backend.',
    'Test with `curl -H "Host: <host>" http://<address>/<path>` - no DNS needed.',
    '503 → backend Service or endpoints. 404 → no matching host/path rule. Empty ADDRESS → no controller.',
    'Remember the Ingress and its target Services must be in the same namespace.',
  ],
  summary: [
    'An Ingress declares HTTP/HTTPS routing; an Ingress controller implements it. No controller, no routing.',
    '`networking.k8s.io/v1` requires `pathType` and uses a nested `backend.service.name`/`port` shape.',
    'Prefix matches whole path segments; Exact matches exactly; ImplementationSpecific delegates to the controller.',
    '`spec.ingressClassName` selects the controller; IngressClass is cluster-scoped and one may be default.',
    'TLS needs a `kubernetes.io/tls` Secret with `tls.crt`/`tls.key` in the same namespace.',
    'Empty ADDRESS = no controller; 503 = no healthy backend; 404 = no matching rule.',
  ],
  practice: [
    {
      id: 'ing-p1',
      level: 'beginner',
      prompt:
        'Write the imperative command that creates an Ingress `shop` in namespace `shop`, class `nginx`, routing `shop.example.com/api` and everything below it to Service `api` on port 80.',
      answer:
        'kubectl create ingress shop -n shop --class=nginx --rule="shop.example.com/api*=api:80"',
      explanation:
        'The trailing `*` on the path makes `pathType: Prefix`; leaving it off produces `Exact`. Verify the generated shape with `kubectl get ingress shop -n shop -o yaml`.',
    },
    {
      id: 'ing-p2',
      level: 'intermediate',
      prompt:
        'With `path: /api` and `pathType: Prefix`, which of these match: `/api`, `/api/v1`, `/apifoo`, `/API`?',
      answer:
        '`/api` MATCH, `/api/v1` MATCH, `/apifoo` NO (Prefix matches whole segments, and `foo` is not a new segment), `/API` NO (matching is case sensitive).',
      explanation:
        'To match `/apifoo` you would need `pathType: ImplementationSpecific` with a controller-specific pattern. The segment rule is the most commonly tested Ingress detail.',
    },
    {
      id: 'ing-p3',
      level: 'advanced',
      prompt:
        'An Ingress has an ADDRESS and `curl` returns 503. Give the diagnosis sequence and the two most likely causes.',
      answer:
        '1. `kubectl describe ingress <name> -n <ns> | grep -A6 Rules` - does the backend show `(<none>)`?\n2. `kubectl get svc <backend> -n <ns>` - does the Service exist, and does its port match the number/name the Ingress references?\n3. `kubectl get endpoints <backend> -n <ns>` - are there Ready Pods?\n\nMost likely causes: (a) the Service has no endpoints because its selector matches nothing or the Pods are not Ready; (b) the Ingress references a port the Service does not define.',
      explanation:
        '503 comes from the controller, which means the controller is healthy and could not find a backend to send the request to. A 404 instead would mean no rule matched the Host or path, which is an Ingress-object problem rather than a backend one.',
    },
  ],
  lab: {
    title: 'Route two paths and two hosts through a real controller',
    scenario:
      'You will install ingress-nginx on a local cluster, build a fan-out Ingress and a virtual-host Ingress, prove the Prefix segment rule, and reproduce the 503 and 404 signatures deliberately.',
    prerequisites: [
      'A cluster where you can install ingress-nginx (kind with extraPortMappings, or minikube with `minikube addons enable ingress`)',
      'curl on your machine',
    ],
    tasks: [
      {
        instruction: 'Install or enable an Ingress controller, and confirm an IngressClass exists.',
      },
      {
        instruction:
          'Create namespace `ing-lab` and two Deployments plus Services, `api` and `web`, serving distinguishable content.',
      },
      {
        instruction:
          'Create a fan-out Ingress: `/api` (Prefix) to api, `/` (Prefix) to web, on host `shop.example.com`.',
      },
      {
        instruction: 'Wait for ADDRESS to be populated, then curl both paths with the Host header.',
      },
      {
        instruction:
          'Prove the Prefix segment rule by requesting `/apifoo` and observing which backend answers.',
      },
      { instruction: 'Request an unknown host and observe the 404 from the controller.' },
      { instruction: 'Break the api Service selector, and observe the 503 while `/` still works.' },
      { instruction: 'Fix it, then inspect the routing table with jsonpath.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Step 1 - a controller',
        language: 'bash',
        code: `# minikube:
minikube addons enable ingress

# kind (cluster must be created with extraPortMappings for 80/443):
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \\
  --for=condition=ready pod \\
  --selector=app.kubernetes.io/component=controller --timeout=180s

kubectl get ingressclass
# NAME    CONTROLLER             PARAMETERS   AGE
# nginx   k8s.io/ingress-nginx   <none>       1m`,
      },
      {
        title: 'Step 2 - two backends with distinguishable output',
        language: 'bash',
        code: `kubectl create namespace ing-lab
kubectl config set-context --current --namespace=ing-lab

for app in api web; do
  kubectl create configmap "$app-page" \\
    --from-literal=default.conf="server { listen 80; location / { return 200 'from $app\\n'; add_header Content-Type text/plain; } }"
done

for app in api web; do
cat <<YAML | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata: {name: $app, namespace: ing-lab}
spec:
  replicas: 1
  selector:
    matchLabels: {app: $app}
  template:
    metadata:
      labels: {app: $app}
    spec:
      volumes:
        - name: conf
          configMap: {name: $app-page}
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - {name: http, containerPort: 80}
          volumeMounts:
            - {name: conf, mountPath: /etc/nginx/conf.d, readOnly: true}
          readinessProbe:
            httpGet: {path: /, port: http}
            periodSeconds: 3
YAML
kubectl expose deployment "$app" --port=80 --target-port=http
done

kubectl rollout status deploy/api --timeout=120s
kubectl rollout status deploy/web --timeout=120s
kubectl get endpoints`,
      },
      {
        title: 'Steps 3-4 - the fan-out Ingress',
        language: 'bash',
        code: `kubectl create ingress shop --class=nginx \\
  --rule="shop.example.com/api*=api:80" \\
  --rule="shop.example.com/*=web:80"

kubectl get ingress shop -o yaml | grep -A8 "paths:"
#       - backend:
#           service:
#             name: api
#             port:
#               number: 80
#         path: /api
#         pathType: Prefix        <- the * produced Prefix

# Wait for the controller to assign an address
for i in $(seq 1 24); do
  ADDR=$(kubectl get ingress shop -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
  [ -n "$ADDR" ] && break; sleep 5
done
echo "address: $ADDR"
# On kind the controller is reachable on localhost:80, so use ADDR=localhost
[ -z "$ADDR" ] && ADDR=localhost

curl -sS -H "Host: shop.example.com" "http://$ADDR/api"
# from api
curl -sS -H "Host: shop.example.com" "http://$ADDR/api/v1/orders"
# from api        <- Prefix matches deeper segments
curl -sS -H "Host: shop.example.com" "http://$ADDR/"
# from web`,
      },
      {
        title: 'Steps 5-6 - the segment rule and the 404',
        language: 'bash',
        code: `curl -sS -H "Host: shop.example.com" "http://$ADDR/apifoo"
# from web
#   ^ NOT api: Prefix /api does not match /apifoo, so the / rule won.

curl -sS -H "Host: unknown.example.com" "http://$ADDR/" -o /dev/null -w "%{http_code}\\n"
# 404
#   ^ the controller's default backend: no rule matched this Host.`,
      },
      {
        title: 'Steps 7-8 - the 503, then fix and inspect',
        language: 'bash',
        code: `kubectl patch svc api -p '{"spec":{"selector":{"app":"nope"}}}'
sleep 8

kubectl get endpoints api
# api   <none>

curl -sS -H "Host: shop.example.com" "http://$ADDR/api" -o /dev/null -w "%{http_code}\\n"
# 503        <- controller is fine; it has no backend to route to
curl -sS -H "Host: shop.example.com" "http://$ADDR/" -o /dev/null -w "%{http_code}\\n"
# 200        <- the other rule is unaffected

kubectl describe ingress shop | grep -A5 Rules
#   shop.example.com
#                     /api   api:80 (<none>)      <- the diagnosis
#                     /      web:80 (10.244.1.7:80)

kubectl patch svc api -p '{"spec":{"selector":{"app":"api"}}}'
sleep 8
curl -sS -H "Host: shop.example.com" "http://$ADDR/api"
# from api

kubectl get ingress shop -o jsonpath='{range .spec.rules[*]}{.host}{"\\n"}{range .http.paths[*]}{"  "}{.path}{" ("}{.pathType}{") -> "}{.backend.service.name}{":"}{.backend.service.port.number}{"\\n"}{end}{end}'
# shop.example.com
#   /api (Prefix) -> api:80
#   / (Prefix) -> web:80`,
      },
      {
        title: 'Step 9 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace ing-lab
# The controller in ingress-nginx is left in place for future labs.`,
      },
    ],
    verification: [
      {
        command: 'kubectl describe ingress shop -n ing-lab | grep -A5 Rules',
        what: 'Both backends should show non-empty endpoint lists in parentheses.',
        expected: 'api:80 and web:80 each with a Pod IP.',
      },
      {
        command: 'curl -sS -H "Host: shop.example.com" http://localhost/apifoo',
        what: 'The Prefix segment rule: /apifoo must NOT reach api.',
        expected: 'from web',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace ing-lab',
        what: 'Removes the Deployments, Services and Ingress.',
        expected: 'namespace "ing-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['service-types', 'secrets', 'api-deprecations', 'troubleshooting-networking'],
  docs: [
    { title: 'Ingress', url: 'https://kubernetes.io/docs/concepts/services-networking/ingress/' },
    {
      title: 'Ingress controllers',
      url: 'https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/',
    },
  ],
}
