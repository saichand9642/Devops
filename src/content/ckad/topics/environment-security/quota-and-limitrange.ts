import type { Topic } from '../../../types'

export const quotaAndLimitRange: Topic = {
  id: 'quota-and-limitrange',
  title: 'ResourceQuota and LimitRange',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 5,
  tags: ['resourcequota', 'limitrange', 'quota', 'defaults', 'admission', 'forbidden'],
  oneLiner:
    'Namespace-level guard rails: a quota caps the total, a LimitRange constrains and defaults each object - and both reject your Pods at admission time.',
  explanation: [
    '**ResourceQuota** caps aggregate consumption in a namespace: total CPU/memory requested and limited, and object counts (how many Pods, Services, PVCs, Secrets). It is enforced at admission - a Pod that would exceed the quota is rejected outright, with a `Forbidden` error.',
    '**LimitRange** constrains *individual* objects in a namespace, and can also supply defaults. It sets minimum and maximum requests and limits per container or per Pod, a default request and default limit for containers that specify none, and a maximum limit-to-request ratio.',
    'The interaction that catches everyone: if a ResourceQuota sets `requests.cpu` or `limits.memory`, then **every container in the namespace must specify that resource**. A Pod with no requests is rejected with "must specify requests.cpu". A LimitRange with defaults fixes this by injecting values, which is why the two are usually deployed together.',
    'Both are admission-time controls, so they do not affect existing objects. Adding a quota that is already exceeded does not delete anything - it only blocks new creations until usage falls below the cap.',
    'You will rarely create these on CKAD, but you will be affected by them, and being able to read `kubectl describe resourcequota` output is what turns a mystifying `Forbidden` error into a five-second fix.',
  ],
  whyItMatters: [
    '"Understand requests, limits, quotas" is a named curriculum competency, and quotas are the "quotas" part.',
    'The classic exam-adjacent failure is a Deployment whose Pods never appear. The Deployment exists, the ReplicaSet exists, and the *ReplicaSet* has a FailedCreate event containing the quota error - the Deployment itself looks fine.',
    'The "quota on requests forces every Pod to declare requests" rule explains a large fraction of real-world `Forbidden` errors.',
  ],
  howItWorks: [
    'Quota accounting is per namespace and is checked by the `ResourceQuota` admission controller. Compute quotas use the names `requests.cpu`, `requests.memory`, `limits.cpu`, `limits.memory` (and `cpu`/`memory` as aliases for the request forms), plus `requests.storage` and `<storageclass>.storageclass.storage.k8s.io/requests.storage`.',
    'Object-count quotas use `count/<resource>.<group>` syntax: `count/pods`, `count/deployments.apps`, `count/services`, `count/secrets`, `count/persistentvolumeclaims`. There are also legacy shorthand names such as `pods` and `services.loadbalancers`.',
    '`scopes` and `scopeSelector` restrict a quota to a subset: `BestEffort`, `NotBestEffort`, `Terminating`, `NotTerminating`, and `PriorityClass`. That lets you cap batch work separately from long-running services.',
    'LimitRange types are `Container`, `Pod`, `PersistentVolumeClaim`. For `Container` you can set `default` (the default limit), `defaultRequest`, `min`, `max` and `maxLimitRequestRatio`. Defaults are injected by the `LimitRanger` admission controller before the quota check runs.',
    'Order of operations at admission: LimitRange defaults are applied first, then the ResourceQuota check happens. So a container with no resources can pass a strict quota if a LimitRange gives it defaults.',
    'If a LimitRange sets a `default` limit but no `defaultRequest`, the request is set equal to the limit. If it sets `defaultRequest` but no `default`, the limit is left unset unless a quota requires one.',
    'A rejected Pod created by a controller (Deployment, Job, StatefulSet) produces a `FailedCreate` event on the *controller*, not a Pending Pod, because the Pod was never admitted.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'LimitRange fills gaps, ResourceQuota says no',
      caption:
        'They run in that order. A LimitRange default can be the reason a Pod that looks fine is rejected by quota.',
      nodes: [
        {
          label: 'You create a Pod with no resources set',
          detail: 'A namespace with both objects in place',
        },
        {
          label: 'LimitRange (mutating admission)',
          detail: 'Injects default requests and limits into the container',
          tone: 'accent',
          arrowLabel: 'fills in the blanks',
          branch: {
            label: 'Outside min or max',
            detail: 'Rejected: must be no more than max, no less than min',
          },
        },
        {
          label: 'The Pod now HAS resource values',
          detail: 'Even though your YAML did not',
        },
        {
          label: 'ResourceQuota (validating admission)',
          detail: 'Adds them to the namespace total',
          arrowLabel: 'checks the sum',
          branch: {
            label: 'exceeded quota',
            detail: 'Error names the resource and the used/limit numbers',
          },
        },
        {
          label: 'Created',
          detail: 'kubectl describe quota shows the new totals',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which object does the task need?',
      caption: 'Per-container rules are LimitRange. Namespace totals are ResourceQuota.',
      question: 'What is being constrained?',
      branches: [
        {
          condition: 'defaults and bounds for each container',
          result: 'LimitRange',
          detail: 'default, defaultRequest, min, max',
          tone: 'accent',
        },
        {
          condition: 'the total the namespace may consume',
          result: 'ResourceQuota',
          detail: 'requests.cpu, limits.memory, pods, configmaps',
        },
        {
          condition: 'a quota exists and Pods are being rejected',
          result: 'Add requests and limits',
          detail: 'With a quota on compute, resources become mandatory',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'ResourceQuota',
      apiVersion: 'v1',
      purpose: 'Caps aggregate resource use and object counts in a namespace.',
      fields: [
        {
          path: 'spec.hard["requests.cpu"]',
          meaning: 'Total CPU that may be requested by all Pods.',
        },
        { path: 'spec.hard["requests.memory"]', meaning: 'Total memory that may be requested.' },
        {
          path: 'spec.hard["limits.cpu"] / ["limits.memory"]',
          meaning: 'Total of all CPU/memory limits.',
        },
        {
          path: 'spec.hard["count/pods"]',
          meaning:
            'Maximum number of Pods. Also count/deployments.apps, count/services, count/secrets.',
        },
        { path: 'spec.hard["requests.storage"]', meaning: 'Total PVC storage requested.' },
        {
          path: 'spec.scopes[]',
          meaning: 'BestEffort, NotBestEffort, Terminating, NotTerminating, PriorityClass.',
        },
        { path: 'status.used', meaning: 'Current consumption against each hard limit.' },
      ],
    },
    {
      kind: 'LimitRange',
      apiVersion: 'v1',
      purpose: 'Constrains and defaults individual containers, Pods and PVCs.',
      fields: [
        {
          path: 'spec.limits[].type',
          meaning: 'Container, Pod or PersistentVolumeClaim.',
          required: true,
        },
        {
          path: 'spec.limits[].default',
          meaning: 'Default *limit* injected when a container specifies none.',
        },
        {
          path: 'spec.limits[].defaultRequest',
          meaning: 'Default *request* injected when a container specifies none.',
        },
        {
          path: 'spec.limits[].min',
          meaning: 'Minimum allowed request; smaller values are rejected.',
        },
        {
          path: 'spec.limits[].max',
          meaning: 'Maximum allowed limit; larger values are rejected.',
        },
        {
          path: 'spec.limits[].maxLimitRequestRatio',
          meaning: 'Maximum limit/request ratio, to stop wild over-commitment.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A Deployment with zero Pods and no error anywhere obvious',
    story: [
      'A developer applies a Deployment with 3 replicas. `kubectl get deploy` shows `0/3`. `kubectl get pods` returns nothing at all - not Pending, not Failed, nothing. `kubectl describe deployment` shows `Progressing=True` and no useful events.',
      'The Pods were never created, so there is nothing to describe. The error is on the ReplicaSet: `kubectl describe rs` shows `FailedCreate ... pods "api-6d4b8f9c7-" is forbidden: failed quota: compute-quota: must specify limits.memory,requests.memory`.',
      'The namespace has a ResourceQuota on `requests.memory` and `limits.memory`. Because the quota mentions those resources, every container must declare them - and this Deployment declared none.',
      "Two fixes. The developer's fix: add `resources` to the Pod template. The platform team's fix: add a LimitRange with `defaultRequest` and `default`, so containers that forget get sensible values injected and the class of error disappears for everyone.",
      'The debugging lesson generalises: when a workload has no Pods at all, describe the ReplicaSet or Job, not the Deployment.',
    ],
    code: [
      {
        title: 'Where the error actually is',
        language: 'bash',
        code: `kubectl get deploy api -n shop
# NAME   READY   UP-TO-DATE   AVAILABLE   AGE
# api    0/3     0            0           2m

kubectl get pods -n shop
# No resources found in shop namespace.        <- nothing to describe

kubectl get rs -n shop -l app=api
# NAME            DESIRED   CURRENT   READY   AGE
# api-6d4b8f9c7   3         0         0       2m

kubectl describe rs api-6d4b8f9c7 -n shop | tail -4
# Warning  FailedCreate  replicaset-controller
#   Error creating: pods "api-6d4b8f9c7-" is forbidden: failed quota:
#   compute-quota: must specify limits.memory,requests.memory

kubectl describe resourcequota -n shop
# Name:            compute-quota
# Resource         Used   Hard
# limits.memory    2Gi    8Gi
# requests.memory  1Gi    4Gi`,
        explanation:
          '"must specify X" means the quota governs X, so every container has to declare it. "exceeded quota" means the namespace total would be too high.',
        placeholders: ['api', 'shop', 'api-6d4b8f9c7'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A ResourceQuota covering compute and object counts',
      language: 'yaml',
      code: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: shop
spec:
  hard:
    # Aggregate compute across all Pods in the namespace
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi

    # Object counts
    count/pods: "20"
    count/deployments.apps: "10"
    count/services: "10"
    count/secrets: "20"
    count/configmaps: "20"
    count/persistentvolumeclaims: "5"

    # Storage
    requests.storage: 50Gi
---
# A scoped quota: cap BestEffort Pods separately so unbounded workloads
# cannot fill the namespace.
apiVersion: v1
kind: ResourceQuota
metadata:
  name: besteffort-quota
  namespace: shop
spec:
  hard:
    count/pods: "5"
  scopes:
    - BestEffort`,
      explanation:
        'Because `compute-quota` mentions `requests.cpu`, `requests.memory`, `limits.cpu` and `limits.memory`, every container in the namespace must now declare all four - unless a LimitRange supplies defaults.',
      placeholders: ['shop'],
    },
    {
      title: 'A LimitRange that makes the quota usable',
      language: 'yaml',
      code: `apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
  namespace: shop
spec:
  limits:
    - type: Container
      # Injected when a container specifies no limits
      default:
        cpu: 500m
        memory: 512Mi
      # Injected when a container specifies no requests
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      # Rejected if outside these bounds
      min:
        cpu: 10m
        memory: 32Mi
      max:
        cpu: "2"
        memory: 4Gi
      # limit / request may not exceed this factor
      maxLimitRequestRatio:
        cpu: "10"
        memory: "4"
    - type: Pod
      # Applies to the SUM of all containers in a Pod
      max:
        cpu: "4"
        memory: 8Gi
    - type: PersistentVolumeClaim
      min:
        storage: 1Gi
      max:
        storage: 20Gi`,
      explanation:
        'With this LimitRange in place, a bare `kubectl run nginx --image=nginx` succeeds even under a strict quota, because the container gets 100m/128Mi requests and 500m/512Mi limits injected.',
      placeholders: ['shop'],
    },
    {
      title: 'What the LimitRange does to a Pod you submit',
      language: 'yaml',
      code: `# WHAT YOU SUBMIT
apiVersion: v1
kind: Pod
metadata:
  name: plain
  namespace: shop
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
      # no resources at all
---
# WHAT IS STORED, after LimitRanger admission
apiVersion: v1
kind: Pod
metadata:
  name: plain
  namespace: shop
  annotations:
    kubernetes.io/limit-ranger: >-
      LimitRanger plugin set: cpu, memory request for container app;
      cpu, memory limit for container app
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
      resources:
        requests: # from defaultRequest
          cpu: 100m
          memory: 128Mi
        limits: # from default
          cpu: 500m
          memory: 512Mi`,
      explanation:
        'The `kubernetes.io/limit-ranger` annotation is the receipt: it records exactly which fields were injected, which is how you confirm a LimitRange is doing its job.',
      placeholders: ['shop'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl create quota compute-quota --hard=requests.cpu=4,requests.memory=8Gi,limits.cpu=8,limits.memory=16Gi -n shop',
      what: 'Creates a compute ResourceQuota imperatively.',
      expected: 'resourcequota/compute-quota created',
      placeholders: ['compute-quota', 'shop'],
    },
    {
      command:
        'kubectl create quota object-quota --hard=count/pods=20,count/services=10,count/secrets=20 -n shop',
      what: 'Creates an object-count quota.',
      expected: 'resourcequota/object-quota created',
      placeholders: ['object-quota', 'shop'],
    },
    {
      command: 'kubectl get resourcequota -n shop',
      what: 'Lists quotas with their request/limit summary.',
      expected: 'NAME, AGE, REQUEST and LIMIT columns.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe resourcequota compute-quota -n shop',
      what: 'The Used versus Hard table - the single most useful quota command.',
      expected: 'A row per resource showing consumption against the cap.',
      placeholders: ['compute-quota', 'shop'],
    },
    {
      command: 'kubectl describe limitrange -n shop',
      what: 'Shows defaults, minimums, maximums and ratios that will be applied to your objects.',
      expected:
        'A table with Type, Resource, Min, Max, Default Request, Default Limit, Max Limit/Request Ratio.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get resourcequota compute-quota -n shop -o jsonpath=\'{range $k,$v := .status.used}{$k}={$v}{"  "}{end}{"\\n"}\'',
      what: 'Current usage as a compact one-liner.',
      expected: 'requests.cpu=1200m requests.memory=2Gi count/pods=6 ...',
      placeholders: ['compute-quota', 'shop'],
    },
    {
      command:
        'kubectl get pod plain -n shop -o jsonpath=\'{.metadata.annotations.kubernetes\\.io/limit-ranger}{"\\n"}\'',
      what: 'The receipt showing which fields a LimitRange injected.',
      expected: 'LimitRanger plugin set: cpu, memory request for container app...',
      placeholders: ['plain', 'shop'],
    },
    {
      command: 'kubectl describe rs api-6d4b8f9c7 -n shop | grep -A3 Events',
      what: 'Where quota rejections for controller-created Pods actually appear.',
      expected: 'FailedCreate with the forbidden message.',
      placeholders: ['api-6d4b8f9c7', 'shop'],
    },
    {
      command: 'kubectl delete resourcequota compute-quota -n shop',
      what: 'Removes a quota. Existing objects are unaffected either way.',
      expected: 'resourcequota "compute-quota" deleted',
      placeholders: ['compute-quota', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Deploy a ResourceQuota and a matching LimitRange together - a quota on requests without defaults breaks every manifest that omits resources.',
      'Set LimitRange `defaultRequest` conservatively and `default` generously; they become the values for anything that forgets.',
      'Use `min`/`max` to stop both extremes: a 1m request that under-reserves and a 64Gi limit that cannot schedule.',
      'Use `scopes: [BestEffort]` to cap unbounded workloads separately from properly-sized ones.',
      'Verify with `kubectl describe resourcequota` after deploying anything significant, so you know how much headroom is left.',
    ],
    code: [
      {
        title: 'Quota plus LimitRange, in the right order',
        language: 'bash',
        code: `# 1. LimitRange FIRST, so nothing breaks when the quota lands
kubectl apply -f limitrange.yaml -n shop

# 2. Then the quota
kubectl apply -f resourcequota.yaml -n shop

# 3. Prove a bare Pod still works, thanks to injected defaults
kubectl run plain --image=nginx:1.27-alpine -n shop
kubectl get pod plain -n shop -o jsonpath='{.spec.containers[0].resources}{"\\n"}'
# {"limits":{"cpu":"500m","memory":"512Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}

# 4. Check the headroom
kubectl describe resourcequota -n shop | head -12`,
        placeholders: ['shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl describe resourcequota -n shop',
      what: 'Confirms the quota exists and shows exactly how much of each resource is consumed.',
      expected: 'Used values below Hard values.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pod plain -n shop -o jsonpath=\'{.spec.containers[0].resources}{"\\n"}\'',
      what: 'Confirms LimitRange defaults were injected into a Pod that declared none.',
      expected: 'The default requests and limits from the LimitRange.',
      placeholders: ['plain', 'shop'],
    },
    {
      command:
        'kubectl get resourcequota -n shop -o jsonpath=\'{.items[0].status.hard["count/pods"]}{" "}{.items[0].status.used["count/pods"]}{"\\n"}\'',
      what: 'Hard cap and current count for Pods in one line.',
      expected: '20 6',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl apply -f pod.yaml -n shop',
      what: 'A direct Pod creation shows the quota error immediately, unlike one created by a controller.',
      expected:
        'Error from server (Forbidden): pods "x" is forbidden: exceeded quota: compute-quota, requested: requests.cpu=2, used: requests.cpu=3, limited: requests.cpu=4',
      placeholders: ['pod.yaml', 'shop'],
    },
    {
      command: 'kubectl describe rs -n shop | grep -A3 FailedCreate',
      what: 'For Deployments, the quota rejection is on the ReplicaSet - this is the command people miss.',
      expected: 'The forbidden message with the specific resource named.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe resourcequota -n shop',
      what: 'Distinguishes "must specify X" (the quota governs X and you declared nothing) from "exceeded quota" (the total is too high).',
      expected: 'The Used/Hard table.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe limitrange -n shop',
      what: 'A rejected Pod may be violating `min`, `max` or `maxLimitRequestRatio` rather than the quota.',
      expected: 'The constraint table; compare your values against Min and Max.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector reason=FailedCreate --sort-by=.lastTimestamp',
      what: 'All admission rejections in the namespace, in one list.',
      expected: 'Forbidden messages naming the quota or LimitRange.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Adding a quota on `requests.*`/`limits.*` without a LimitRange, so every manifest that omits resources starts failing.',
    'Looking for a Pending Pod when a quota rejected the Pod. It was never created - look at the ReplicaSet or Job events.',
    'Confusing "must specify requests.memory" (declare the field) with "exceeded quota" (lower the value or free capacity).',
    'Assuming a new quota deletes over-quota objects. It does not; it only blocks new ones.',
    'Forgetting object-count quotas. A namespace can be under its CPU cap and still refuse a new Service or Secret.',
    "Setting a LimitRange `max` lower than a workload's real need, so the Pod is rejected rather than throttled.",
    'Setting `default` without `defaultRequest`, which makes the request equal the limit and quietly turns everything Guaranteed - and over-reserves the namespace.',
    'Forgetting that init containers and sidecars count towards a Pod-type LimitRange maximum.',
  ],
  examTips: [
    'If a Deployment has no Pods at all, run `kubectl describe rs` - a quota rejection lives there.',
    '`kubectl describe resourcequota -n <ns>` is the first command whenever anything is `Forbidden`.',
    '`kubectl create quota <name> --hard=...` exists and is faster than writing YAML.',
    'When a namespace has a compute quota, always set requests and limits in your Pod template - do not rely on defaults existing.',
    'Read the error text literally: "must specify" and "exceeded quota" require different fixes.',
    '`kubectl describe limitrange` tells you the minimum and maximum you are allowed to ask for.',
  ],
  summary: [
    'ResourceQuota caps namespace totals (compute, storage, object counts); LimitRange constrains and defaults individual objects.',
    'A quota naming a resource forces every container to declare it, unless a LimitRange injects a default.',
    'Both are admission-time: existing objects are untouched, new ones are rejected.',
    'Quota rejections for controller-created Pods appear as FailedCreate on the ReplicaSet or Job.',
    '"must specify X" = declare the field; "exceeded quota" = the total is too high.',
  ],
  practice: [
    {
      id: 'quota-p1',
      level: 'beginner',
      prompt:
        'A namespace has a ResourceQuota on `requests.cpu` and `requests.memory`. You apply a Pod with no `resources` block and it is rejected. Why, and what are the two fixes?',
      answer:
        'Because the quota governs those resources, every container must declare them - the quota cannot account for a container that does not say what it needs. Fixes: (1) add `resources.requests` to the Pod, or (2) add a LimitRange with `defaultRequest` so the values are injected automatically.',
      explanation:
        'The error text is "must specify requests.cpu,requests.memory". That wording is distinct from "exceeded quota", which would mean your values are too large rather than missing.',
    },
    {
      id: 'quota-p2',
      level: 'intermediate',
      prompt:
        'A Deployment shows 0/3 replicas and `kubectl get pods` returns nothing. Give the command that reveals the cause.',
      answer: 'kubectl describe rs -n <namespace> | grep -A5 FailedCreate',
      explanation:
        'The Pods were rejected at admission, so no Pod objects exist to describe. The ReplicaSet controller records the rejection as a `FailedCreate` event containing the exact `Forbidden` message. The same applies to Jobs and StatefulSets.',
    },
    {
      id: 'quota-p3',
      level: 'advanced',
      prompt:
        'A LimitRange sets `default: {memory: 512Mi}` for Containers but no `defaultRequest`. A quota caps `requests.memory` at 2Gi. What happens when you create four bare Pods, and why?',
      answer:
        'When only `default` (the limit) is set, the request is set equal to the limit - so each container gets `requests.memory: 512Mi`. Four Pods consume 2Gi, exactly the cap. A fifth Pod is rejected with "exceeded quota".\n\nAdding an explicit `defaultRequest: {memory: 128Mi}` would let sixteen such Pods fit inside the same 2Gi request quota.',
      explanation:
        'This is a real capacity trap: setting only `default` silently makes everything Guaranteed QoS and reserves the full limit, so the namespace runs out of quota far sooner than expected. Always set `defaultRequest` alongside `default`.',
    },
  ],
  lab: {
    title: 'Get yourself rejected, then fix it two ways',
    scenario:
      'You will apply a strict quota, watch a bare Pod and a Deployment both fail, learn where each error appears, then fix it with explicit resources and with a LimitRange.',
    prerequisites: ['A cluster where you can create quotas (any namespace you own)'],
    tasks: [
      { instruction: 'Create namespace `quota-lab` and set it as default.' },
      {
        instruction:
          'Create a ResourceQuota capping requests.cpu at 1, requests.memory at 1Gi, limits.memory at 2Gi and count/pods at 5.',
      },
      { instruction: 'Try to create a bare nginx Pod with no resources and read the exact error.' },
      {
        instruction:
          'Create the same Pod with explicit requests and limits, and confirm it succeeds.',
      },
      {
        instruction:
          'Create a Deployment with 3 replicas and no resources; confirm 0 Pods, then find the error on the ReplicaSet.',
      },
      {
        instruction:
          'Add a LimitRange with defaults and minimums, then delete and recreate the Deployment; confirm Pods now appear with injected values.',
      },
      { instruction: 'Show the limit-ranger annotation proving the injection.' },
      {
        instruction:
          'Exceed the quota deliberately by scaling up, and read the "exceeded quota" message.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - the quota and the first rejection',
        language: 'bash',
        code: `kubectl create namespace quota-lab
kubectl config set-context --current --namespace=quota-lab

kubectl create quota compute-quota \\
  --hard=requests.cpu=1,requests.memory=1Gi,limits.memory=2Gi,count/pods=5

kubectl describe resourcequota compute-quota
# Resource         Used  Hard
# count/pods       0     5
# limits.memory    0     2Gi
# requests.cpu     0     1
# requests.memory  0     1Gi

kubectl run bare --image=nginx:1.27-alpine
# Error from server (Forbidden): pods "bare" is forbidden: failed quota:
# compute-quota: must specify limits.memory,requests.cpu,requests.memory
#                ^^^^^^^^^^^^ not "exceeded" - the fields are MISSING`,
      },
      {
        title: 'Step 4 - explicit resources succeed',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata: {name: sized, namespace: quota-lab}
spec:
  containers:
    - name: c
      image: nginx:1.27-alpine
      resources:
        requests: {cpu: 100m, memory: 128Mi}
        limits: {memory: 256Mi}
YAML
# pod/sized created

kubectl describe resourcequota compute-quota | tail -5
# requests.cpu     100m   1
# requests.memory  128Mi  1Gi
# limits.memory    256Mi  2Gi
# count/pods       1      5`,
      },
      {
        title: 'Step 5 - the Deployment mystery',
        language: 'bash',
        code: `kubectl create deployment web --image=nginx:1.27-alpine --replicas=3

kubectl get deploy web
# NAME   READY   UP-TO-DATE   AVAILABLE   AGE
# web    0/3     0            0           15s

kubectl get pods -l app=web
# No resources found in quota-lab namespace.       <- nothing to describe!

RS=$(kubectl get rs -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl describe rs "$RS" | tail -4
# Warning  FailedCreate  replicaset-controller
#   Error creating: pods "web-..." is forbidden: failed quota: compute-quota:
#   must specify limits.memory,requests.cpu,requests.memory`,
      },
      {
        title: 'Steps 6-7 - the LimitRange fix',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: LimitRange
metadata: {name: container-limits, namespace: quota-lab}
spec:
  limits:
    - type: Container
      default:
        cpu: 200m
        memory: 256Mi
      defaultRequest:
        cpu: 50m
        memory: 64Mi
      min:
        cpu: 10m
        memory: 32Mi
      max:
        cpu: "1"
        memory: 1Gi
YAML

kubectl describe limitrange container-limits

# Force new Pods to be created now that defaults exist
kubectl rollout restart deployment/web
sleep 15
kubectl get pods -l app=web
# web-...   1/1   Running   0   10s   (x3)

POD=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl get pod "$POD" -o jsonpath='{.spec.containers[0].resources}{"\\n"}'
# {"limits":{"cpu":"200m","memory":"256Mi"},"requests":{"cpu":"50m","memory":"64Mi"}}

kubectl get pod "$POD" -o jsonpath='{.metadata.annotations.kubernetes\\.io/limit-ranger}{"\\n"}'
# LimitRanger plugin set: cpu, memory request for container nginx;
# cpu, memory limit for container nginx`,
      },
      {
        title: 'Steps 8-9 - exceed it, then clean up',
        language: 'bash',
        code: `kubectl scale deployment web --replicas=10
sleep 10

kubectl describe resourcequota compute-quota | grep count/pods
# count/pods   5   5          <- at the cap

kubectl describe rs "$RS" | tail -3
# Error creating: pods "web-..." is forbidden: exceeded quota: compute-quota,
# requested: count/pods=1, used: count/pods=5, limited: count/pods=5
#                          ^^^^^^^^ now it is "exceeded", not "must specify"

kubectl get deploy web
# READY 4/10 - it will never reach 10 under this quota

kubectl config set-context --current --namespace=default
kubectl delete namespace quota-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl describe resourcequota compute-quota -n quota-lab',
        what: 'The Used/Hard table is the authoritative view of what the namespace has consumed.',
        expected: 'count/pods at its cap of 5 after the scale-up.',
      },
      {
        command:
          'kubectl get pods -n quota-lab -l app=web -o jsonpath=\'{.items[0].spec.containers[0].resources}{"\\n"}\'',
        what: 'Confirms LimitRange defaults were injected into Pods that declared nothing.',
        expected: 'requests 50m/64Mi and limits 200m/256Mi.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace quota-lab',
        what: 'Removes the quota, LimitRange, Deployment and Pods.',
        expected: 'namespace "quota-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['resource-requirements', 'authn-authz-admission', 'pod-failure-modes'],
  docs: [
    {
      title: 'Resource quotas',
      url: 'https://kubernetes.io/docs/concepts/policy/resource-quotas/',
    },
    { title: 'Limit Ranges', url: 'https://kubernetes.io/docs/concepts/policy/limit-range/' },
  ],
}
