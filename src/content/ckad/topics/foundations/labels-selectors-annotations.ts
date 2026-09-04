import type { Topic } from '../../../types'

export const labelsSelectorsAnnotations: Topic = {
  id: 'labels-selectors-annotations',
  title: 'Labels, selectors and annotations',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 20,
  order: 7,
  tags: ['labels', 'selectors', 'annotations', 'matchLabels', 'matchExpressions', '-l'],
  oneLiner:
    'The glue of Kubernetes: labels connect Services to Pods and Deployments to ReplicaSets, and selectors are how you query anything.',
  explanation: [
    '**Labels** are key/value pairs in `metadata.labels`. They are for identification and selection: `app=web`, `tier=frontend`, `env=prod`. Anything can carry them, and nothing in Kubernetes cares what you choose - only that selectors match.',
    '**Selectors** are queries over labels. A Service uses one to find its Pods. A Deployment uses one to find the Pods it owns. `kubectl get pods -l app=web` uses one interactively. If a selector matches nothing, the object silently does nothing useful - a Service with no matching Pods has no Endpoints and refuses connections.',
    '**Annotations** are also key/value pairs, in `metadata.annotations`, but they are *not* selectable. They hold arbitrary metadata for humans and tools: a change-cause, an Ingress controller setting, a checksum that forces a rollout. Values can be long and structured, unlike label values.',
    'The mental split: if something needs to *find* it, use a label. If something just needs to *read* it, use an annotation.',
  ],
  whyItMatters: [
    'Almost every "my Service returns nothing" problem is a label/selector mismatch. Being able to compare the two in two commands is a core exam skill.',
    'Deployment `spec.selector` is immutable and must match `spec.template.metadata.labels`, or the API server rejects the object outright. Understanding that rule prevents a whole class of failed applies.',
    'Selectors are also how you operate: `kubectl delete pods -l app=web`, `kubectl logs -l app=web --tail=20`, `kubectl get all -l release=canary` all work on sets rather than names.',
  ],
  howItWorks: [
    'Label keys may have an optional prefix: `app.kubernetes.io/name`. The name part is up to 63 characters of alphanumerics, `-`, `_` and `.`. Values follow the same rules and may be empty.',
    'Equality selectors: `app=web`, `app==web`, `app!=web`. Set selectors: `env in (prod,staging)`, `env notin (dev)`, `tier` (key exists), `!tier` (key absent). Multiple comma-separated terms are ANDed.',
    'In YAML, `matchLabels` is a simple map (implicit equality AND). `matchExpressions` is a list of `{key, operator, values}` with operators `In`, `NotIn`, `Exists`, `DoesNotExist`. Both can be combined and are ANDed.',
    'Services use the older `spec.selector` map form and support equality only - no `matchExpressions`. Deployments, ReplicaSets, Jobs and NetworkPolicies use the newer `LabelSelector` form and support both.',
    "A Deployment adds `pod-template-hash` to the labels of the Pods it creates, and includes it in its ReplicaSet selectors. That is how two ReplicaSets from the same Deployment do not fight over each other's Pods - so never set `pod-template-hash` yourself.",
    'Annotations have no size limit worth worrying about at CKAD level (the total object must stay under the etcd value limit), and are not indexed - you cannot query by them.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How a selector finds Pods',
      caption:
        'Nothing is wired by name. If the labels do not match, the Service has no endpoints and the Deployment manages nothing.',
      nodes: [
        {
          label: 'Pod template carries labels',
          detail: 'spec.template.metadata.labels: app=web',
          tone: 'accent',
        },
        {
          label: 'Pods are created with those labels',
          detail: 'Every replica gets the same set',
          arrowLabel: 'controller copies them',
        },
        {
          label: 'Service selector is evaluated',
          detail: 'spec.selector: app=web',
          arrowLabel: 'continuously, not once',
        },
        {
          label: 'Matching Pod IPs become endpoints',
          detail: 'Only Pods that are also Ready',
          tone: 'success',
          branch: {
            label: 'Selector does not match',
            detail: 'ENDPOINTS shows <none> and traffic fails',
          },
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Label or annotation?',
      caption:
        'The rule is simple: if something needs to select on it, it is a label. Otherwise it is an annotation.',
      question: 'Will anything select or group by this value?',
      branches: [
        {
          condition: 'yes, a Service, Deployment or NetworkPolicy needs it',
          result: 'Label',
          detail: 'Short, validated, indexed, usable with -l',
        },
        {
          condition: 'no, it is information for humans or tools',
          result: 'Annotation',
          detail: 'Free-form, can be long, never selectable',
          tone: 'accent',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Service',
      apiVersion: 'v1',
      purpose: 'Selects Pods by label to build its Endpoints. Equality-based selector only.',
      fields: [
        {
          path: 'spec.selector',
          meaning: 'Map of labels a Pod must have, all of them, to receive traffic.',
        },
      ],
    },
    {
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      purpose: 'Owns Pods matching its selector; the selector is immutable after creation.',
      fields: [
        { path: 'spec.selector.matchLabels', meaning: 'Equality terms, ANDed.', required: true },
        {
          path: 'spec.selector.matchExpressions[]',
          meaning: 'In / NotIn / Exists / DoesNotExist terms, ANDed with matchLabels.',
        },
        {
          path: 'spec.template.metadata.labels',
          meaning: 'Labels applied to created Pods; must satisfy the selector.',
          required: true,
        },
      ],
    },
    {
      kind: 'Any object',
      apiVersion: 'varies',
      purpose: 'Annotations: non-selectable metadata read by humans and controllers.',
      fields: [
        {
          path: 'metadata.annotations',
          meaning: 'Map of string keys to string values; not queryable.',
        },
        {
          path: 'metadata.annotations["kubernetes.io/change-cause"]',
          meaning: 'Shown in the CHANGE-CAUSE column of kubectl rollout history.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The Service that pointed at nothing',
    story: [
      'A team deploys `payments` with Pod labels `app=payments,tier=backend`. Someone creates the Service by hand and types `app: payment` - singular, a one-character typo.',
      'The Service is created successfully. `kubectl get svc` looks perfect. `kubectl get endpoints payments` shows `<none>`, and every request gets connection refused.',
      'The two-command diagnosis: `kubectl get svc payments -o jsonpath=\'{.spec.selector}\'` prints `{"app":"payment"}`, and `kubectl get pods --show-labels` shows `app=payments`. Mismatch found in ten seconds.',
      'The lesson that generalises: an empty Endpoints list always means "selector matched no ready Pods", and it is nearly always a typo or a forgotten label rather than a networking fault.',
    ],
    code: [
      {
        title: 'Compare selector against reality',
        language: 'bash',
        code: `kubectl get svc payments -n shop -o jsonpath='{.spec.selector}{"\\n"}'
# {"app":"payment"}

kubectl get pods -n shop --show-labels | head -3
# payments-6d4b8f9c7-2xk4l   1/1   Running   app=payments,tier=backend,pod-template-hash=6d4b8f9c7

kubectl get endpoints payments -n shop
# NAME       ENDPOINTS   AGE
# payments   <none>      4m`,
        explanation:
          'Endpoints being <none> is the single most diagnostic output in Kubernetes networking. Check it before you check DNS, ports or NetworkPolicies.',
        placeholders: ['payments', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Labels, a matching Service, and the immutability rule',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments
  namespace: shop
  labels:
    app: payments # labels on the Deployment itself (not used for matching Pods)
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payments # IMMUTABLE - must match template labels below
  template:
    metadata:
      labels:
        app: payments # required by the selector
        tier: backend # extra labels are fine
    spec:
      containers:
        - name: api
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: payments
  namespace: shop
spec:
  selector:
    app: payments # equality only - every listed label must be present
  ports:
    - port: 80
      targetPort: 80`,
      explanation:
        'The Service selector is a subset of the Pod labels. It does not need to list every label - only the ones that must match.',
      placeholders: ['payments', 'shop'],
    },
    {
      title: 'matchExpressions for set-based selection',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
    matchExpressions:
      - key: env
        operator: In
        values: ["prod", "staging"] # env must be one of these
      - key: deprecated
        operator: DoesNotExist # and must not have this key at all
  template:
    metadata:
      labels:
        app: web
        env: prod # satisfies both terms above
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine`,
      explanation:
        'matchLabels and matchExpressions are ANDed. The Pod template must satisfy every term or the API server rejects the Deployment with "selector does not match template labels".',
      placeholders: ['web', 'shop'],
    },
    {
      title: 'Annotations that do real work',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  annotations:
    kubernetes.io/change-cause: "Bump nginx to 1.27 for CVE fix"
    # A checksum of the ConfigMap forces a rollout when config changes,
    # because changing any template annotation changes the Pod template.
    configmap/checksum: "a1b2c3d4"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9113"
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine`,
      explanation:
        'Annotation values are always strings, so "true" and "9113" are quoted. You cannot select on any of these - that is exactly the difference from a label.',
      placeholders: ['web'],
    },
  ],
  imperative: [
    {
      command: 'kubectl get pods -n shop --show-labels',
      what: 'Adds a LABELS column so you can compare Pod labels against a selector.',
      expected: 'app=payments,pod-template-hash=...,tier=backend on each row.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=payments,tier=backend',
      what: 'Selects Pods matching both labels (comma means AND).',
      expected: 'Only the matching Pods, or "No resources found" if nothing matches.',
      placeholders: ['shop'],
    },
    {
      command: "kubectl get pods -n shop -l 'env in (prod,staging)'",
      what: 'Set-based selection. Quote it so the shell does not interpret the parentheses.',
      expected: 'Pods whose env label is prod or staging.',
      placeholders: ['shop'],
    },
    {
      command: "kubectl get pods -n shop -l '!tier'",
      what: 'Selects Pods that do NOT have the `tier` label key at all.',
      expected: 'Pods missing that label.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl label pod payments-6d4b8f9c7-2xk4l tier=backend -n shop',
      what: 'Adds a label to an existing object.',
      expected: 'pod/payments-6d4b8f9c7-2xk4l labeled',
      placeholders: ['payments-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl label pod payments-6d4b8f9c7-2xk4l tier=frontend --overwrite -n shop',
      what: 'Changes an existing label. Without --overwrite kubectl refuses rather than clobbering.',
      expected: 'pod/... labeled',
      placeholders: ['payments-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl label pod payments-6d4b8f9c7-2xk4l tier- -n shop',
      what: 'Removes a label. The trailing hyphen is the delete syntax.',
      expected: 'pod/... unlabeled',
      placeholders: ['payments-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl annotate deployment web kubernetes.io/change-cause="Bump to 1.27" -n shop',
      what: 'Sets an annotation, here the one that populates rollout history.',
      expected: 'deployment.apps/web annotated',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl delete pods -l app=payments -n shop',
      what: 'Bulk operation by selector rather than by name.',
      expected: 'One "deleted" line per matching Pod.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Put identifying labels in `spec.template.metadata.labels` and make `spec.selector.matchLabels` a subset of them.',
      'Decide selector labels once - they are immutable for Deployments, ReplicaSets and Jobs.',
      'Use annotations for anything a tool or human reads but nothing needs to select.',
      'Follow the recommended label convention (`app.kubernetes.io/name`, `app.kubernetes.io/component`) when you have a free choice.',
    ],
    code: [
      {
        title: 'Recommended labels in practice',
        language: 'yaml',
        code: `metadata:
  labels:
    app.kubernetes.io/name: payments
    app.kubernetes.io/instance: payments-prod
    app.kubernetes.io/component: api
    app.kubernetes.io/part-of: shop
    app.kubernetes.io/version: "1.4.2"`,
        explanation:
          'These are conventions, not requirements - Kubernetes does not treat them specially. They exist so different tools agree on how to group things. On the exam, use whatever labels the task specifies, exactly.',
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get endpoints payments -n shop',
      what: 'The definitive check that a Service selector actually matches ready Pods.',
      expected: 'A list of Pod IP:port pairs. `<none>` means the selector matched nothing.',
      placeholders: ['payments', 'shop'],
    },
    {
      command: 'kubectl get svc payments -n shop -o jsonpath=\'{.spec.selector}{"\\n"}\'',
      what: 'Prints the Service selector as JSON so you can compare it character by character with Pod labels.',
      expected: '{"app":"payments"}',
      placeholders: ['payments', 'shop'],
    },
    {
      command:
        'kubectl get deploy web -n shop -o jsonpath=\'{.spec.selector.matchLabels}{"  "}{.spec.template.metadata.labels}{"\\n"}\'',
      what: 'Prints selector and template labels side by side - the pair that must be compatible.',
      expected: '{"app":"web"}  {"app":"web","env":"prod"}',
      placeholders: ['web', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get pods -n shop --show-labels | grep payments',
      what: 'Shows what labels the Pods actually carry, including the pod-template-hash added by the Deployment.',
      expected: 'The real label set to compare against a selector.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe svc payments -n shop',
      what: 'Shows Selector and Endpoints together, which is usually enough to spot a mismatch immediately.',
      expected: 'Selector: app=payments and Endpoints: 10.244.1.5:80,10.244.2.7:80.',
      placeholders: ['payments', 'shop'],
    },
    {
      command: 'kubectl apply -f deploy.yaml',
      what: 'A selector/template mismatch is rejected at apply time with a clear message.',
      expected: '`selector` does not match template `labels`',
      placeholders: ['deploy.yaml'],
    },
    {
      command: 'kubectl get rs -n shop --show-labels',
      what: 'Shows each ReplicaSet with its pod-template-hash, useful when two revisions coexist during a rollout.',
      expected: 'One ReplicaSet per revision, each with a distinct hash.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'A Service selector that does not match the Pod labels - the number one cause of "connection refused" in Kubernetes.',
    "Trying to change a Deployment's `spec.selector` after creation. It is immutable; you must recreate the Deployment.",
    'Putting a label in `spec.selector` that the Pod template does not have, which the API server rejects at apply time.',
    'Expecting to select on annotations. You cannot - `-l` only reads labels.',
    'Setting `pod-template-hash` by hand. It is managed by the Deployment controller and interfering breaks rollouts.',
    'Forgetting `--overwrite` when changing an existing label, then assuming the command worked.',
    'Unquoted set-based selectors in bash - `-l env in (prod)` is a shell syntax error without quotes.',
  ],
  examTips: [
    '`--show-labels` and `kubectl get endpoints <svc>` are the two commands that solve most Service tasks.',
    'When a task says "select Pods with label X", `-l X` on `get`, `delete` and `logs` all work - no need to list names.',
    'If asked to create a Service for an existing Deployment, `kubectl expose deployment <name>` copies the selector for you and cannot mistype it.',
    'Remember `kubernetes.io/change-cause` if a task asks you to record why a rollout happened.',
    'Labels are the answer whenever a task involves canary, blue/green, or "route only some traffic".',
  ],
  summary: [
    'Labels identify and are selectable; annotations describe and are not.',
    'Service selectors are equality-only maps; workload selectors support matchLabels plus matchExpressions.',
    "A workload's selector is immutable and its Pod template must satisfy it.",
    '`kubectl get endpoints <svc>` proves whether a selector matched anything - always check it first.',
  ],
  practice: [
    {
      id: 'label-p1',
      level: 'beginner',
      prompt:
        'Write the command that lists Pods in namespace `shop` having both `app=web` and `env=prod`.',
      answer: 'kubectl get pods -n shop -l app=web,env=prod',
      explanation:
        "A comma in a selector means AND, not OR. For OR you need a set selector: `-l 'env in (prod,staging)'`.",
    },
    {
      id: 'label-p2',
      level: 'intermediate',
      prompt:
        'A Service named `api` has no endpoints. List, in order, the three commands you would run to find out why.',
      answer:
        "1. kubectl get endpoints api -n <ns>            (confirm it really is empty)\n2. kubectl get svc api -n <ns> -o jsonpath='{.spec.selector}'   (what it looks for)\n3. kubectl get pods -n <ns> --show-labels        (what the Pods actually have)",
      explanation:
        'If the labels match, the next suspects are: Pods not Ready (probe failing, so excluded from endpoints), or the Service `targetPort` not matching the container port.',
    },
    {
      id: 'label-p3',
      level: 'advanced',
      prompt:
        'You need a Deployment that only owns Pods labelled `app=web` whose `track` label is either `stable` or `canary`, and which never own Pods labelled `quarantine`. Write the selector block.',
      answer:
        'selector:\n  matchLabels:\n    app: web\n  matchExpressions:\n    - key: track\n      operator: In\n      values: ["stable", "canary"]\n    - key: quarantine\n      operator: DoesNotExist',
      explanation:
        'All three terms are ANDed. The Pod template must satisfy them, so its labels must include `app: web` and a `track` of `stable` or `canary`, and must not include `quarantine`.',
    },
  ],
  lab: {
    title: 'Break and fix a Service selector',
    scenario:
      'You will create a Deployment and a deliberately mismatched Service, diagnose the empty Endpoints list, fix it, and then use selectors to operate on Pods in bulk.',
    prerequisites: ['A cluster you can create Deployments and Services in'],
    tasks: [
      { instruction: 'Create namespace `label-lab` and set it as default.' },
      {
        instruction:
          'Create a Deployment `shop-api` with 2 replicas of `nginx:1.27-alpine`, whose Pods carry labels `app=shop-api` and `tier=backend`.',
      },
      {
        instruction:
          'Create a Service `shop-api` on port 80 with the deliberately wrong selector `app=shop-apis`.',
      },
      { instruction: 'Prove the Service has no endpoints, and prove why.' },
      { instruction: 'Fix the selector and confirm two endpoints appear.' },
      {
        instruction:
          'Add the label `track=canary` to exactly one Pod, then list only that Pod using a selector.',
      },
      {
        instruction:
          'Delete every Pod with `tier=backend` in one command and watch the Deployment recreate them.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the Deployment with two Pod labels',
        language: 'yaml',
        code: `# shop-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-api
  namespace: label-lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shop-api
  template:
    metadata:
      labels:
        app: shop-api
        tier: backend
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80`,
      },
      {
        title: 'Steps 2b-3 - apply, then the broken Service',
        language: 'bash',
        code: `kubectl create namespace label-lab
kubectl config set-context --current --namespace=label-lab
kubectl apply -f shop-api.yaml
kubectl rollout status deploy/shop-api --timeout=90s

# Deliberately wrong selector (note the trailing s)
kubectl create service clusterip shop-api --tcp=80:80
kubectl patch svc shop-api -p '{"spec":{"selector":{"app":"shop-apis"}}}'`,
      },
      {
        title: 'Step 4 - diagnose',
        language: 'bash',
        code: `kubectl get endpoints shop-api
# NAME       ENDPOINTS   AGE
# shop-api   <none>      20s

kubectl get svc shop-api -o jsonpath='{.spec.selector}{"\\n"}'
# {"app":"shop-apis"}

kubectl get pods --show-labels
# shop-api-...   1/1   Running   app=shop-api,pod-template-hash=...,tier=backend
#                                    ^^^^^^^^ no trailing "s"`,
      },
      {
        title: 'Step 5 - fix and confirm',
        language: 'bash',
        code: `kubectl patch svc shop-api -p '{"spec":{"selector":{"app":"shop-api"}}}'

kubectl get endpoints shop-api
# NAME       ENDPOINTS                       AGE
# shop-api   10.244.1.12:80,10.244.2.9:80    90s

kubectl describe svc shop-api | grep -E 'Selector|Endpoints'`,
      },
      {
        title: 'Steps 6-7 - operate by selector',
        language: 'bash',
        code: `POD=$(kubectl get pods -l app=shop-api -o jsonpath='{.items[0].metadata.name}')
kubectl label pod "$POD" track=canary

kubectl get pods -l track=canary
# exactly one Pod

# Bulk delete by selector; the ReplicaSet immediately recreates them
kubectl delete pods -l tier=backend
kubectl get pods -w      # Ctrl+C once both are Running again`,
      },
      {
        title: 'Step 8 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace label-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get endpoints shop-api -n label-lab',
        what: 'The authoritative check that selector and Pod labels agree.',
        expected: 'Two IP:80 entries after the fix.',
      },
      {
        command: 'kubectl get pods -n label-lab -l track=canary --show-labels',
        what: 'Confirms the single manually labelled Pod is selectable.',
        expected: 'One Pod whose labels include track=canary.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace label-lab',
        what: 'Removes the lab namespace.',
        expected: 'namespace "label-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['service-types', 'deployments-and-replicasets', 'deployment-strategies'],
  docs: [
    {
      title: 'Labels and selectors',
      url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/',
    },
    {
      title: 'Annotations',
      url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/',
    },
  ],
}
