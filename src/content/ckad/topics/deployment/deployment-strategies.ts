import type { Topic } from '../../../types'

export const deploymentStrategies: Topic = {
  id: 'deployment-strategies',
  title: 'Blue/green and canary with Kubernetes primitives',
  domainId: 'deployment',
  difficulty: 'advanced',
  estimatedMinutes: 24,
  order: 3,
  tags: ['blue-green', 'canary', 'strategy', 'labels', 'service selector', 'traffic shifting'],
  oneLiner:
    'Implement blue/green and canary releases with nothing but Deployments, Services and labels - no service mesh required.',
  explanation: [
    'The official curriculum says "use Kubernetes primitives to implement common deployment strategies (e.g. blue/green or canary)". The key word is *primitives*: the exam expects Deployments, Services and labels, not Argo Rollouts or Istio.',
    '**Blue/green**: run two complete versions side by side (`blue` = current, `green` = new). All traffic goes to one of them, decided by the Service selector. You cut over by changing one label value in the Service, and you roll back by changing it back. Switching is instant and complete.',
    '**Canary**: send a small fraction of traffic to the new version, watch it, then increase. With plain primitives you approximate the fraction with replica counts: one Service selects a label that *both* Deployments carry, so traffic is distributed roughly in proportion to the number of Ready Pods behind it. 1 canary Pod out of 10 total is roughly 10% of requests.',
    'The mechanism for both is the same insight from the labels lesson: a Service routes to whatever Pods match its selector. Add or remove a label, or change the ratio of matching Pods, and traffic follows.',
    'A rolling update is a third strategy - the built-in one - and it is not the same as either. A rolling update replaces the old version entirely and cannot hold two versions at a stable ratio.',
  ],
  whyItMatters: [
    'This is one of the few genuinely design-flavoured areas of CKAD, and tasks are usually phrased as "route traffic to the new version" or "send about 20% of traffic to v2".',
    'Understanding that traffic split comes from Pod counts (with plain Services) tells you why "exactly 5%" is not achievable with primitives - and prevents you from over-engineering the answer.',
    'Blue/green and canary are also the honest answer to "how do I test in production safely", which is the real-world reason both exist.',
  ],
  howItWorks: [
    'Blue/green mechanics: two Deployments with distinct `version` labels (`blue`, `green`) and a Service whose selector includes `version: blue`. Both Deployments are fully scaled. Cutover = `kubectl patch svc` to change the selector to `version: green`. Rollback = patch it back. No Pods are created or destroyed during the switch, so it is near-instant.',
    'Canary mechanics: two Deployments sharing a common label (`app: api`) plus their own distinguishing label (`track: stable` / `track: canary`). The Service selects only `app: api`, so it matches both. With 9 stable and 1 canary Pod, roughly 10% of connections reach the canary.',
    'Distribution is per *connection*, not per request, and kube-proxy balances approximately evenly across endpoints. HTTP keep-alive means one client can stick to one Pod for many requests, so the split is statistical, not exact.',
    "To increase canary share, scale the canary up and the stable Deployment down, keeping the total constant. To promote, scale the canary to full and the stable to zero (or update the stable Deployment's image and remove the canary).",
    'Readiness probes matter more here than anywhere: an unready canary Pod is simply not in the endpoint list, so a broken canary receives no traffic at all rather than failing 10% of requests.',
    'Two Services are often used alongside: a public one for the split, and a `-canary` Service selecting only `track: canary` so you can test the new version directly before exposing it.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Blue-green: switch the Service selector',
      caption:
        'Both versions run at once. The cutover is a one-field edit, and so is the rollback.',
      nodes: [
        {
          label: 'Deployment app-blue, version: blue',
          detail: 'Serving all traffic',
          tone: 'accent',
        },
        {
          label: 'Deploy app-green, version: green',
          detail: 'Running but receiving nothing',
          arrowLabel: 'no Service points at it',
        },
        {
          label: 'Test green directly',
          detail: 'port-forward, or a second Service for testing',
        },
        {
          label: 'Patch the Service selector to green',
          detail: 'One field: spec.selector.version',
          arrowLabel: 'cutover',
          tone: 'success',
          branch: {
            label: 'Something is wrong',
            detail: 'Patch the selector back to blue - instant rollback',
          },
        },
        {
          label: 'Delete blue when confident',
          detail: 'Or keep it as the next rollback target',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Canary with plain Deployments',
      caption:
        'One Service, one shared label, two Deployments. Traffic share is set by replica counts, so 1 of 10 is roughly 10%.',
      nodes: [
        {
          label: 'Service selects app: web',
          detail: 'Deliberately does NOT select on version',
          tone: 'accent',
        },
        {
          label: 'web-stable: 9 replicas, app: web',
          detail: 'Carries about 90% of requests',
        },
        {
          label: 'web-canary: 1 replica, app: web',
          detail: 'Same Service, so it gets about 10%',
          arrowLabel: 'both are endpoints',
        },
        {
          label: 'Watch the canary only',
          detail: 'Filter logs and metrics by the version label',
          branch: {
            label: 'Errors on the canary',
            detail: 'Scale web-canary to 0 - traffic drains immediately',
          },
        },
        {
          label: 'Shift the ratio',
          detail: 'Scale canary up and stable down until canary is all of it',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which strategy does the task want?',
      caption:
        'The wording gives it away: "no downtime" is rolling, "switch over" is blue-green, "small share of users" is canary.',
      question: 'What matters most for this release?',
      branches: [
        {
          condition: 'gradual, no extra objects, no downtime',
          result: 'RollingUpdate',
          detail: 'The built-in Deployment default',
        },
        {
          condition: 'instant cutover and instant rollback',
          result: 'Blue-green',
          detail: 'Two Deployments, one Service selector to flip',
          tone: 'accent',
        },
        {
          condition: 'expose a small share of real traffic first',
          result: 'Canary',
          detail: 'Two Deployments sharing one Service, tuned by replicas',
        },
        {
          condition: 'the app cannot run two versions at once',
          result: 'strategy: Recreate',
          detail: 'Accepts downtime; all old Pods die before new ones start',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Service',
      apiVersion: 'v1',
      purpose: 'The traffic switch. Its selector decides which Pods receive requests.',
      fields: [
        {
          path: 'spec.selector',
          meaning:
            'Equality-only label map. Change this to cut over (blue/green) or to widen/narrow the target set.',
        },
        {
          path: 'spec.sessionAffinity',
          meaning:
            'None (default) or ClientIP. ClientIP pins a client to one Pod, which distorts a canary split.',
        },
      ],
    },
    {
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      purpose: 'One per version (blue/green) or one per track (stable/canary).',
      fields: [
        {
          path: 'spec.replicas',
          meaning: 'With a shared Service, the ratio of replicas is the approximate traffic split.',
        },
        {
          path: 'spec.template.metadata.labels',
          meaning:
            'Carries both the shared selector label and the distinguishing version/track label.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A 10% canary that caught a memory leak',
    story: [
      'A team is releasing `api:2.0.0`, a substantial rewrite. A rolling update would replace all 10 Pods within a couple of minutes - too fast to notice a slow-burning problem.',
      'Instead they create a second Deployment `api-canary` with 1 replica of 2.0.0, labelled `app: api, track: canary`. The existing `api` Deployment is scaled from 10 to 9 and labelled `track: stable`. The Service selects only `app: api`, so it now has 10 endpoints, one of them the canary.',
      "Twenty minutes later the canary Pod's memory has grown from 180Mi to 900Mi while the stable Pods sit flat. The leak would have taken hours to become an outage at full scale.",
      'They scale the canary to 0, leaving nine healthy stable Pods and no user impact, and go fix the leak. `kubectl top pods` and the `track` label were the whole toolkit.',
      "When 2.0.1 passes the same test they promote it: scale canary to 10, scale stable to 0, then update the stable Deployment's image and remove the canary Deployment.",
    ],
    code: [
      {
        title: 'The comparison that found it',
        language: 'bash',
        code: `kubectl top pods -n shop -l app=api --sort-by=memory
# NAME                        CPU(cores)   MEMORY(bytes)
# api-canary-7c9d8f4a2-xk2mq  120m         912Mi        <- the canary
# api-6d4b8f9c7-2xk4l         95m          181Mi
# api-6d4b8f9c7-8n7pq         98m          179Mi
# ...

kubectl get endpoints api -n shop -o jsonpath='{.subsets[0].addresses[*].ip}' | tr ' ' '\\n' | wc -l
# 10      <- 9 stable + 1 canary, so roughly 10% of traffic

kubectl scale deploy api-canary -n shop --replicas=0
# deployment.apps/api-canary scaled - canary removed from endpoints immediately`,
        explanation:
          'Because the canary shares the Service, removing it is a scale, not a deploy - the fastest possible mitigation.',
        placeholders: ['shop', 'api-canary'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Blue/green: two Deployments, one switchable Service',
      language: 'yaml',
      code: `# Current version, receiving all traffic
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
      version: blue
  template:
    metadata:
      labels:
        app: api
        version: blue
    spec:
      containers:
        - name: api
          image: registry.example.com/shop/api:1.4.2
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
---
# New version, fully scaled but receiving NO traffic yet
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
      version: green
  template:
    metadata:
      labels:
        app: api
        version: green
    spec:
      containers:
        - name: api
          image: registry.example.com/shop/api:2.0.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
---
# The switch: this selector decides who serves production traffic
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api
    version: blue # change to "green" to cut over
  ports:
    - port: 80
      targetPort: 8080
---
# Optional: a direct route to green for pre-cutover testing
apiVersion: v1
kind: Service
metadata:
  name: api-green
  namespace: shop
spec:
  selector:
    app: api
    version: green
  ports:
    - port: 80
      targetPort: 8080`,
      explanation:
        'Note that both Deployment selectors include `version`, so each owns only its own Pods. The Service selector is the only thing you change to release, and changing it back is the rollback.',
      placeholders: [
        'shop',
        'registry.example.com/shop/api:1.4.2',
        'registry.example.com/shop/api:2.0.0',
      ],
    },
    {
      title: 'Canary: one Service matching both tracks',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-stable
  namespace: shop
spec:
  replicas: 9 # 9 of 10 Pods -> ~90% of traffic
  selector:
    matchLabels:
      app: api
      track: stable
  template:
    metadata:
      labels:
        app: api # shared: the Service matches this
        track: stable # distinguishing
    spec:
      containers:
        - name: api
          image: registry.example.com/shop/api:1.4.2
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-canary
  namespace: shop
spec:
  replicas: 1 # 1 of 10 Pods -> ~10% of traffic
  selector:
    matchLabels:
      app: api
      track: canary
  template:
    metadata:
      labels:
        app: api
        track: canary
    spec:
      containers:
        - name: api
          image: registry.example.com/shop/api:2.0.0
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api # deliberately does NOT mention track, so it matches both
  ports:
    - port: 80
      targetPort: 8080`,
      explanation:
        'The split is approximate and connection-based. To move to 20%, scale canary to 2 and stable to 8 - keep the total constant so capacity does not change.',
      placeholders: [
        'shop',
        'registry.example.com/shop/api:1.4.2',
        'registry.example.com/shop/api:2.0.0',
      ],
    },
  ],
  imperative: [
    {
      command:
        'kubectl patch service api -n shop -p \'{"spec":{"selector":{"app":"api","version":"green"}}}\'',
      what: 'The blue/green cutover: one patch, instant switch, no Pod churn.',
      expected: 'service/api patched',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl patch service api -n shop -p \'{"spec":{"selector":{"app":"api","version":"blue"}}}\'',
      what: 'The blue/green rollback - the same command with the old value.',
      expected: 'service/api patched',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl scale deployment api-canary --replicas=2 -n shop && kubectl scale deployment api-stable --replicas=8 -n shop',
      what: 'Shifts the canary from ~10% to ~20% while keeping total capacity at 10 Pods.',
      expected: 'Two "scaled" lines.',
      placeholders: ['api-canary', 'api-stable', 'shop'],
    },
    {
      command: 'kubectl scale deployment api-canary --replicas=0 -n shop',
      what: 'Aborts a canary instantly - the Pods leave the endpoint list as they terminate.',
      expected: 'deployment.apps/api-canary scaled',
      placeholders: ['api-canary', 'shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop -o wide',
      what: 'Shows exactly which Pod IPs the Service is routing to - the ground truth for any strategy.',
      expected: 'The combined endpoint list for whichever Pods currently match.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=api -L version,track',
      what: 'Lists matching Pods with version and track as columns - the fastest way to see the current split.',
      expected: 'A table with VERSION and TRACK columns.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Decide the label scheme first: a shared selector label plus a distinguishing label (`version` for blue/green, `track` for canary).',
      'Give each Deployment a selector that includes its distinguishing label, so it owns only its own Pods.',
      'Point the Service selector at exactly the set you want to receive traffic.',
      'For blue/green, change the Service selector to release; for canary, change replica ratios.',
      'Always give both versions readiness probes, so an unhealthy version receives no traffic at all.',
    ],
    code: [
      {
        title: 'A repeatable blue/green release script',
        language: 'bash',
        code: `NS=shop
NEW=green
OLD=blue

# 1. Confirm the new version is healthy before any traffic reaches it
kubectl rollout status deploy/api-$NEW -n $NS --timeout=180s
kubectl run smoke --rm -it --restart=Never -n $NS --image=busybox:1.36 -- \\
  wget -qO- http://api-$NEW/readyz

# 2. Cut over
kubectl patch svc api -n $NS -p "{\\"spec\\":{\\"selector\\":{\\"app\\":\\"api\\",\\"version\\":\\"$NEW\\"}}}"

# 3. Verify the endpoints changed to the new Pods
kubectl get endpoints api -n $NS
kubectl get pods -n $NS -l version=$NEW -o wide

# 4. Rollback is the same patch with $OLD - keep the old Deployment for a while.`,
        placeholders: ['shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get svc api -n shop -o jsonpath=\'{.spec.selector}{"\\n"}\'',
      what: 'Confirms which version the Service currently targets.',
      expected: '{"app":"api","version":"green"} after a cutover.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'The definitive check: are these the Pod IPs of the version you intended?',
      expected: 'Three IPs, all belonging to the intended Deployment.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get pods -n shop -l version=green -o jsonpath=\'{range .items[*]}{.status.podIP}{"\\n"}{end}\'',
      what: "Cross-check the endpoint IPs against the green Pods' IPs.",
      expected: 'The same IPs listed by the endpoints command.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl run probe --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh -c "for i in 1 2 3 4 5 6 7 8 9 10; do wget -qO- http://api/version; done"',
      what: 'Sends ten requests through the Service so you can observe the split empirically.',
      expected:
        'Roughly nine responses from stable and one from canary, if the app reports its version.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'Empty after a cutover means the new selector matches nothing - almost always a label typo.',
      expected: 'Non-empty. `<none>` is the failure signature.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop --show-labels | grep api',
      what: 'Compare the actual Pod labels with the Service selector, character by character.',
      expected: 'Labels including app=api and the version/track value you expect.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n shop -l track=canary',
      what: 'A canary receiving no traffic despite existing is usually not Ready - check the READY column.',
      expected: 'READY 1/1. `0/1` means the probe is failing and it is excluded from endpoints.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get svc api -n shop -o jsonpath=\'{.spec.sessionAffinity}{"\\n"}\'',
      what: 'ClientIP affinity pins each client to one Pod, which makes a canary split look wrong from a single test client.',
      expected: 'None for a representative split.',
      placeholders: ['api', 'shop'],
    },
  ],
  commonMistakes: [
    "Giving both Deployments identical selectors, so each tries to own the other's Pods and they fight.",
    'Forgetting the shared label on the canary Deployment, so the Service never matches it and the canary gets 0% of traffic.',
    'Including `track` in the canary Service selector when you wanted the split - that Service then routes only to the canary.',
    'Deleting the blue Deployment immediately after cutover, removing your instant rollback.',
    'Expecting an exact percentage from replica ratios. It is statistical, connection-based, and affected by keep-alive.',
    'Testing a canary split from one client with HTTP keep-alive and concluding the split is broken.',
    'Omitting readiness probes, so a broken new version does receive traffic and fails real requests.',
  ],
  examTips: [
    '"Switch traffic to the new version" → patch the Service selector. One command, and the rollback is the same command.',
    '"Send about N% of traffic to the new version" → one Service matching a shared label, and replica counts in the ratio you want.',
    'Remember the Service selector is equality-only - you cannot express "track in (stable, canary)" there. Instead, omit `track` entirely so it matches both.',
    'Verify with `kubectl get endpoints <svc>` every time; it is the only output that proves where traffic goes.',
    'Keep the previous Deployment around after a cutover unless the task tells you to remove it.',
  ],
  summary: [
    'Both strategies are built from Service selectors and Pod labels - no extra tooling.',
    'Blue/green: two fully scaled versions, cut over by changing one label in the Service selector; rollback is instant.',
    'Canary: one Service matching a shared label, traffic split approximated by replica ratio; adjust by scaling.',
    'Readiness probes are what make either safe, because unready Pods are not endpoints.',
    '`kubectl get endpoints` is the ground truth for where traffic is going.',
  ],
  practice: [
    {
      id: 'strat-p1',
      level: 'beginner',
      prompt:
        'Blue is live and green is deployed and healthy. Write the single command that cuts traffic over to green for a Service named `api` in namespace `shop`.',
      answer:
        'kubectl patch service api -n shop -p \'{"spec":{"selector":{"app":"api","version":"green"}}}\'',
      explanation:
        'Include every label the selector should have - a patch on `spec.selector` replaces the whole map, so omitting `app: api` would leave a selector of only `version: green`.',
    },
    {
      id: 'strat-p2',
      level: 'intermediate',
      prompt:
        "You want roughly 25% of traffic on the canary with 12 Pods of total capacity. What replica counts do you set, and what must be true of both Deployments' Pod labels?",
      answer:
        "Canary 3 replicas, stable 9 replicas. Both Pod templates must carry the shared label the Service selects (for example `app: api`), plus their own distinguishing label (`track: canary` / `track: stable`) which appears in each Deployment's own selector but not in the Service selector.",
      explanation:
        '3/12 = 25%. If the Service selector included `track`, it would match only one Deployment and the split would be 100%/0%.',
    },
    {
      id: 'strat-p3',
      level: 'advanced',
      prompt:
        'After a blue/green cutover, `kubectl get endpoints api` shows `<none>` and the application is down. Give the diagnosis sequence and the immediate mitigation.',
      answer:
        'Mitigation first: patch the selector back to the blue version - `kubectl patch svc api -n shop -p \'{"spec":{"selector":{"app":"api","version":"blue"}}}\'`.\n\nThen diagnose:\n1. `kubectl get svc api -o jsonpath=\'{.spec.selector}\'` - what does it actually select?\n2. `kubectl get pods -l app=api --show-labels` - what labels do the green Pods really have?\n3. `kubectl get pods -l version=green` - are they Ready? Unready Pods are never endpoints even with a correct selector.',
      explanation:
        'The two causes are a selector/label mismatch and green Pods that are not Ready. Rolling back first is correct: the Service selector is the fastest thing to change in either direction, so there is no reason to debug while users are affected.',
    },
  ],
  lab: {
    title: 'Run a real blue/green cutover and a real canary split',
    scenario:
      'Using nginx images that serve different content, you will observe traffic actually moving between versions - first an instant blue/green switch, then a proportional canary split you can measure.',
    prerequisites: ['A cluster with capacity for eight small Pods'],
    tasks: [
      { instruction: 'Create namespace `strat-lab` and set it as default.' },
      {
        instruction:
          'Create ConfigMaps `page-v1` and `page-v2` each containing a distinct index.html.',
      },
      {
        instruction:
          'Create Deployments `api-blue` (2 replicas, v1 page) and `api-green` (2 replicas, v2 page), both labelled `app: api` with distinct `version` labels.',
      },
      {
        instruction:
          'Create a Service `api` selecting `app=api,version=blue`; confirm requests return v1.',
      },
      {
        instruction:
          'Cut over to green with a single patch; confirm requests now return v2 and that no Pods were restarted.',
      },
      { instruction: 'Roll back to blue.' },
      {
        instruction:
          'Reconfigure for a canary: change the Service selector to only `app=api`, scale blue to 3 and green to 1, and send 20 requests to measure the split.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the two pages',
        language: 'bash',
        code: `kubectl create namespace strat-lab
kubectl config set-context --current --namespace=strat-lab

kubectl create configmap page-v1 --from-literal=index.html='VERSION-1'
kubectl create configmap page-v2 --from-literal=index.html='VERSION-2'`,
      },
      {
        title: 'Step 3-4 - blue, green and the Service',
        language: 'yaml',
        code: `# bluegreen.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
  namespace: strat-lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
      version: blue
  template:
    metadata:
      labels:
        app: api
        version: blue
    spec:
      volumes:
        - name: page
          configMap:
            name: page-v1
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          volumeMounts:
            - name: page
              mountPath: /usr/share/nginx/html
          readinessProbe:
            httpGet:
              path: /
              port: 80
            periodSeconds: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
  namespace: strat-lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
      version: green
  template:
    metadata:
      labels:
        app: api
        version: green
    spec:
      volumes:
        - name: page
          configMap:
            name: page-v2
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          volumeMounts:
            - name: page
              mountPath: /usr/share/nginx/html
          readinessProbe:
            httpGet:
              path: /
              port: 80
            periodSeconds: 3
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: strat-lab
spec:
  selector:
    app: api
    version: blue
  ports:
    - port: 80
      targetPort: 80`,
      },
      {
        title: 'Step 4b - confirm blue is serving',
        language: 'bash',
        code: `kubectl apply -f bluegreen.yaml
kubectl rollout status deploy/api-blue --timeout=180s
kubectl rollout status deploy/api-green --timeout=180s

kubectl run c --rm -it --restart=Never --image=busybox:1.36 -- \\
  sh -c 'for i in 1 2 3 4 5; do wget -qO- http://api/; echo; done'
# VERSION-1  (x5)

kubectl get pods -l app=api -o wide --no-headers | awk '{print $1, $6}'
# note the Pod names and IPs - none of these will change during cutover`,
      },
      {
        title: 'Steps 5-6 - cut over and back',
        language: 'bash',
        code: `kubectl patch svc api -p '{"spec":{"selector":{"app":"api","version":"green"}}}'

kubectl get endpoints api
# the two GREEN Pod IPs

kubectl run c --rm -it --restart=Never --image=busybox:1.36 -- \\
  sh -c 'for i in 1 2 3 4 5; do wget -qO- http://api/; echo; done'
# VERSION-2  (x5)

kubectl get pods -l app=api
# RESTARTS still 0 for every Pod - nothing was recreated

# Rollback
kubectl patch svc api -p '{"spec":{"selector":{"app":"api","version":"blue"}}}'
kubectl run c --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- http://api/
# VERSION-1`,
      },
      {
        title: 'Step 7 - the canary split',
        language: 'bash',
        code: `# Make the Service match BOTH versions by dropping "version" from the selector.
# A merge patch cannot delete a key, so replace the selector wholesale:
kubectl patch svc api --type=json \\
  -p='[{"op":"replace","path":"/spec/selector","value":{"app":"api"}}]'

kubectl scale deploy api-blue --replicas=3
kubectl scale deploy api-green --replicas=1
kubectl rollout status deploy/api-blue --timeout=120s
kubectl rollout status deploy/api-green --timeout=120s

kubectl get endpoints api
# four IPs: three blue, one green

kubectl run c --rm -it --restart=Never --image=busybox:1.36 -- sh -c \\
  'i=0; while [ $i -lt 20 ]; do wget -qO- http://api/; echo; i=$((i+1)); done' | sort | uniq -c
#      15 VERSION-1
#       5 VERSION-2
# Roughly 3:1, as the replica ratio predicts (exact numbers vary run to run).`,
      },
      {
        title: 'Step 8 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace strat-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get endpoints api -n strat-lab',
        what: 'The endpoint list is the ground truth for which Pods receive traffic at each stage.',
        expected: 'Two blue IPs, then two green IPs, then a mixed list of four.',
      },
      {
        command: 'kubectl get svc api -n strat-lab -o jsonpath=\'{.spec.selector}{"\\n"}\'',
        what: 'Confirms the selector matches what the current stage of the lab requires.',
        expected: '{"app":"api"} during the canary stage.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace strat-lab',
        what: 'Removes both Deployments, the Service and the ConfigMaps.',
        expected: 'namespace "strat-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['labels-selectors-annotations', 'service-types', 'rolling-updates'],
  docs: [
    { title: 'Service', url: 'https://kubernetes.io/docs/concepts/services-networking/service/' },
    {
      title: 'Canary deployments',
      url: 'https://kubernetes.io/docs/concepts/workloads/management/#canary-deployments',
    },
  ],
}
