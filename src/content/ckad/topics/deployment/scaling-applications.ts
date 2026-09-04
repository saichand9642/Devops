import type { Topic } from '../../../types'

export const scalingApplications: Topic = {
  id: 'scaling-applications',
  title: 'Scaling applications',
  domainId: 'deployment',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 2,
  tags: ['scale', 'replicas', 'hpa', 'autoscale', 'metrics-server', 'pdb'],
  oneLiner:
    'Manual scaling, conditional scaling, horizontal autoscaling, and why requests are the prerequisite for all of it.',
  explanation: [
    'Scaling a Deployment means changing `spec.replicas`. The ReplicaSet controller adds or removes Pods to match, and the Service picks up the new Pods automatically as they become Ready.',
    'Three ways to do it: `kubectl scale` (imperative, immediate), editing `spec.replicas` in the manifest and re-applying (declarative), or a **HorizontalPodAutoscaler** (HPA), which adjusts `spec.replicas` for you based on observed metrics.',
    'An HPA needs two things to work: a metrics source (the metrics-server add-on for CPU and memory) and **resource requests** on the containers. CPU utilisation is expressed as a percentage *of the request*, so a container with no CPU request has no denominator and the HPA reports `<unknown>`.',
    'Scaling down is not free. Pods are terminated, in-flight requests must drain, and if the application holds state in memory that state is lost. A **PodDisruptionBudget** limits how many Pods voluntary operations (like a node drain) may remove at once, which is the guard rail around scaling and maintenance.',
  ],
  whyItMatters: [
    '"Scale the Deployment to N replicas" is one of the simplest and most common exam tasks - a single command, if you know it.',
    'The HPA `<unknown>` failure teaches the connection between resource requests and autoscaling, which is examined in the environment/config domain too.',
    'Knowing that scaling and rolling updates are different operations (one creates no revision, the other does) prevents confusion when reading rollout history.',
  ],
  howItWorks: [
    '`kubectl scale` issues a PATCH against the `scale` subresource. It works on Deployments, ReplicaSets, StatefulSets and ReplicationControllers - but not on DaemonSets, which have no replica count.',
    '`--current-replicas=N` makes the scale conditional: the request fails if the current count differs, which protects you from acting on stale information.',
    'HPA algorithm, simplified: `desiredReplicas = ceil(currentReplicas × currentMetric / targetMetric)`, clamped to `minReplicas`/`maxReplicas`. It scales up quickly and down slowly, with a stabilisation window (5 minutes by default) to avoid flapping.',
    'HPA and a manifest-managed `spec.replicas` conflict: whichever wrote last wins, so re-applying a manifest with `replicas: 2` will undo the HPA until it next reconciles. In practice you remove `replicas` from the manifest when an HPA owns it.',
    'Scaling to 0 is legal for Deployments and is the standard way to stop an application without deleting it. Its Service then has no endpoints.',
    'A PodDisruptionBudget with `minAvailable` or `maxUnavailable` restricts *voluntary* disruptions (drains, evictions). It does not stop you from scaling down deliberately.',
  ],
  keyObjects: [
    {
      kind: 'HorizontalPodAutoscaler',
      apiVersion: 'autoscaling/v2',
      purpose: "Adjusts a workload's replica count to hit a metric target.",
      fields: [
        {
          path: 'spec.scaleTargetRef',
          meaning: 'apiVersion/kind/name of the workload to scale.',
          required: true,
        },
        { path: 'spec.minReplicas', meaning: 'Lower bound. Default 1.' },
        { path: 'spec.maxReplicas', meaning: 'Upper bound.', required: true },
        {
          path: 'spec.metrics[]',
          meaning: 'Resource, Pods, Object or External metric specs with their targets.',
        },
        {
          path: 'spec.behavior',
          meaning: 'Scale-up/scale-down policies and stabilisation windows.',
        },
        {
          path: 'status.currentMetrics[]',
          meaning: 'What the HPA is observing - `<unknown>` here means no metrics.',
        },
      ],
    },
    {
      kind: 'PodDisruptionBudget',
      apiVersion: 'policy/v1',
      purpose:
        'Limits voluntary disruption so scaling and maintenance cannot take an app below a floor.',
      fields: [
        { path: 'spec.selector', meaning: 'Which Pods the budget covers.', required: true },
        {
          path: 'spec.minAvailable',
          meaning: 'Minimum Pods that must stay available (count or percentage).',
        },
        { path: 'spec.maxUnavailable', meaning: 'Alternative to minAvailable; set exactly one.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'An HPA that reported <unknown> for a week',
    story: [
      'A team adds an HPA targeting 70% CPU on their API, from 2 to 10 replicas. Traffic triples and nothing scales. `kubectl get hpa` shows `TARGETS: <unknown>/70%`.',
      'The cause is that the container has no `resources.requests.cpu`. CPU utilisation in an HPA is a percentage of the request, so with no request there is no percentage to compute.',
      'Adding `requests: {cpu: 200m}` to the Pod template fixed it within a minute: the HPA began reporting real utilisation and scaled to 6 replicas under load.',
      'A second lesson followed: their manifest still contained `replicas: 2`, so every deploy briefly scaled the app back down to 2 before the HPA recovered. They removed the field from the manifest and let the HPA own it.',
    ],
    code: [
      {
        title: 'The diagnosis in two commands',
        language: 'bash',
        code: `kubectl get hpa api -n shop
# NAME   REFERENCE        TARGETS         MINPODS   MAXPODS   REPLICAS
# api    Deployment/api   <unknown>/70%   2         10        2

kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[0].resources}{"\\n"}'
# {}      <- no requests, so the HPA has no denominator

kubectl describe hpa api -n shop | grep -i "unable\\|failed"
# failed to get cpu utilization: missing request for cpu in container api of Pod api-...`,
        explanation:
          'The describe output states the cause in plain words. Whenever an HPA shows <unknown>, check requests before you check metrics-server.',
        placeholders: ['api', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'An HPA with the requests that make it work',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  # No spec.replicas: the HPA owns the replica count.
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
          image: registry.example.com/shop/api:1.4.2
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 200m # the denominator for CPU utilisation
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
  namespace: shop
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70 # 70% of 200m = 140m per Pod
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300 # wait 5 minutes before shrinking
    scaleUp:
      stabilizationWindowSeconds: 0 # react immediately to load`,
      explanation:
        'Asymmetric behaviour is deliberate: scaling up late costs you availability, scaling down early costs you availability too, so up is fast and down is slow.',
      placeholders: ['api', 'shop', 'registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'A PodDisruptionBudget as a floor',
      language: 'yaml',
      code: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api
  namespace: shop
spec:
  minAvailable: 2 # a node drain may never take us below 2 Pods
  selector:
    matchLabels:
      app: api`,
      explanation:
        'This constrains voluntary disruptions such as `kubectl drain`. It does not prevent `kubectl scale --replicas=0` - a deliberate scale is not a disruption.',
      placeholders: ['api', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl scale deployment api --replicas=5 -n shop',
      what: 'Sets the replica count immediately.',
      expected: 'deployment.apps/api scaled',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl scale deployment api --current-replicas=3 --replicas=5 -n shop',
      what: 'Conditional scale: fails if the current count is not 3.',
      expected: 'deployment.apps/api scaled, or an error stating the precondition failed.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl scale deployment api --replicas=0 -n shop',
      what: 'Stops the application without deleting anything. Its Service loses all endpoints.',
      expected: 'deployment.apps/api scaled, then READY 0/0.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl scale statefulset store --replicas=3 -n shop',
      what: 'StatefulSets scale too, adding Pods in ordinal order (store-1, store-2) with their own PVCs.',
      expected: 'statefulset.apps/store scaled',
      placeholders: ['store', 'shop'],
    },
    {
      command: 'kubectl autoscale deployment api --min=2 --max=10 --cpu-percent=70 -n shop',
      what: 'Creates an HPA imperatively - much faster than writing the YAML.',
      expected: 'horizontalpodautoscaler.autoscaling/api autoscaled',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get hpa -n shop',
      what: 'Current metric versus target, plus min/max and the live replica count.',
      expected: 'TARGETS showing a real percentage, not <unknown>.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl top pods -n shop',
      what: 'Actual CPU and memory usage per Pod. Requires metrics-server.',
      expected: 'A table of CPU(cores) and MEMORY(bytes).',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl scale --replicas=3 -f api.yaml',
      what: 'Scales the object described by a file, useful when you have the manifest but not the name in mind.',
      expected: 'deployment.apps/api scaled',
      placeholders: ['api.yaml'],
    },
  ],
  declarative: {
    steps: [
      'For a fixed size, set `spec.replicas` in the manifest and apply.',
      'For autoscaling, remove `spec.replicas` from the manifest, add resource requests, and create an HPA.',
      'Never let both a manifest replica count and an HPA fight over the same Deployment.',
      'Verify a scale with `kubectl get deploy` (READY x/x), not with `kubectl get pods` alone.',
    ],
    code: [
      {
        title: 'Hand ownership of replicas to the HPA',
        language: 'bash',
        code: `# 1. Ensure requests exist, otherwise the HPA cannot compute utilisation
kubectl set resources deploy/api -c=api --requests=cpu=200m,memory=256Mi -n shop

# 2. Remove spec.replicas from the manifest so applies stop overriding the HPA
#    (delete the line in api.yaml)

# 3. Create the autoscaler
kubectl autoscale deploy api --min=2 --max=10 --cpu-percent=70 -n shop

# 4. Confirm it is reading metrics
kubectl get hpa api -n shop
# NAME   REFERENCE        TARGETS   MINPODS   MAXPODS   REPLICAS
# api    Deployment/api   3%/70%    2         10        2`,
        placeholders: ['api', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get deploy api -n shop',
      what: 'READY x/y is the scaling verification: both numbers should equal your target.',
      expected: 'READY 5/5 after scaling to 5.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.spec.replicas}/{.status.readyReplicas}{"\\n"}\'',
      what: 'Desired versus ready in one line.',
      expected: '5/5',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'Confirms the Service picked up the new Pods - the point of scaling.',
      expected: 'One IP:port per Ready Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get hpa api -n shop -o jsonpath=\'{.status.currentReplicas}/{.status.desiredReplicas}{"\\n"}\'',
      what: 'What the HPA currently sees and wants.',
      expected: 'Two equal numbers once stable.',
      placeholders: ['api', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe hpa api -n shop',
      what: 'Explains <unknown> targets and any scaling decisions it has made.',
      expected: 'ScalingActive=True; or a "missing request for cpu" message.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl top pods -n shop',
      what: 'If this errors, metrics-server is missing and no CPU/memory HPA can work.',
      expected: 'Usage table, or "Metrics API not available".',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=api',
      what: 'After a scale-up, new Pods stuck Pending mean the cluster has no room - check requests against node capacity.',
      expected: 'All Pods Running.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe pod api-6d4b8f9c7-newone -n shop | grep -A3 Events',
      what: 'A Pending scaled-up Pod names the constraint here (Insufficient cpu/memory, or a quota rejection).',
      expected: 'FailedScheduling with the reason.',
      placeholders: ['api-6d4b8f9c7-newone', 'shop'],
    },
    {
      command: 'kubectl get resourcequota -n shop',
      what: 'A namespace quota can cap total Pods or CPU, silently blocking a scale-up.',
      expected: 'Used versus Hard columns.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Creating an HPA without resource requests, then wondering why TARGETS shows `<unknown>`.',
    'Keeping `spec.replicas` in a manifest that an HPA also manages, so every apply fights the autoscaler.',
    'Trying to scale a DaemonSet. It has no replica count; change its node selector instead.',
    'Assuming `kubectl scale` creates a new rollout revision. It does not - only template changes do.',
    'Scaling up beyond cluster capacity and reading the resulting Pending Pods as a bug.',
    'Expecting a PodDisruptionBudget to prevent a deliberate scale-down. It only limits voluntary disruptions.',
    'Forgetting that scaling to 0 empties the Service endpoints, so callers get connection refused rather than a clean error.',
  ],
  examTips: [
    '`kubectl scale deployment <name> --replicas=<n> -n <ns>` is the whole answer to most scaling tasks.',
    '`kubectl autoscale deployment <name> --min=<n> --max=<m> --cpu-percent=<p>` creates an HPA without writing YAML.',
    'If a task involves an HPA, check for resource requests first - it is the intended trap.',
    'Verify with READY x/x on `kubectl get deploy`; a mismatch means Pods are still starting or cannot schedule.',
    '`kubectl scale --replicas=0` is the right answer to "stop the application without deleting it".',
  ],
  summary: [
    'Scaling = changing `spec.replicas`; `kubectl scale` does it in one line and creates no revision.',
    'An HPA owns `spec.replicas` and needs both metrics-server and CPU/memory requests.',
    'CPU utilisation targets are percentages of the request, which is why a missing request yields `<unknown>`.',
    'Scaling to 0 stops an app cleanly; its Service loses all endpoints.',
    'PodDisruptionBudgets bound voluntary disruption, not deliberate scaling.',
  ],
  practice: [
    {
      id: 'scale-p1',
      level: 'beginner',
      prompt:
        'Write the command that scales Deployment `web` in namespace `shop` to 7 replicas, and the command that verifies it.',
      answer: 'kubectl scale deployment web --replicas=7 -n shop\nkubectl get deploy web -n shop',
      explanation:
        'Verification means READY 7/7. If it reads 5/7, either Pods are still starting or two cannot be scheduled - check `kubectl get pods` for Pending.',
    },
    {
      id: 'scale-p2',
      level: 'intermediate',
      prompt:
        'An HPA targets 50% CPU with `minReplicas: 2`, `maxReplicas: 8`. Containers request 100m CPU and currently 4 Pods each use 80m. What will the HPA do?',
      answer:
        'Utilisation is 80m/100m = 80%, above the 50% target. desiredReplicas = ceil(4 × 80/50) = ceil(6.4) = 7. It scales up to 7 Pods (within the max of 8).',
      explanation:
        'The formula is `ceil(currentReplicas × currentUtilisation / targetUtilisation)`. Scale-up is immediate by default; scale-down waits out the stabilisation window.',
    },
    {
      id: 'scale-p3',
      level: 'advanced',
      prompt:
        'A team reports "the HPA keeps getting overridden and drops us back to 2 replicas after every deploy". Diagnose and fix.',
      answer:
        'Their manifest still sets `spec.replicas: 2`, so each `kubectl apply` writes 2 into the Deployment; the HPA then has to scale back up, causing a dip. Fix: remove `spec.replicas` from the manifest entirely and let the HPA own the field.',
      explanation:
        "Confirm with `kubectl get deploy <name> -o jsonpath='{.spec.replicas}'` immediately after an apply and again a minute later - the value changing on its own shows the two controllers fighting. Server-side apply with field management is the more advanced fix, but removing the field is the CKAD-level answer.",
    },
  ],
  lab: {
    title: 'Scale up, scale to zero, and make an HPA actually work',
    scenario:
      'You will scale manually, use a conditional scale, scale to zero and watch the Service endpoints empty, then create an HPA - first without requests (to see `<unknown>`) and then with them.',
    prerequisites: [
      'A cluster with capacity for six small Pods',
      'metrics-server installed for the HPA steps (minikube: `minikube addons enable metrics-server`)',
    ],
    tasks: [
      { instruction: 'Create namespace `scale-lab` and set it as default.' },
      {
        instruction:
          'Create a Deployment `web` with 2 replicas of `nginx:1.27-alpine` and expose it on port 80.',
      },
      { instruction: 'Scale to 5 and verify READY 5/5 and five Service endpoints.' },
      {
        instruction: 'Attempt a conditional scale that should fail, then one that should succeed.',
      },
      { instruction: 'Scale to 0 and confirm the Service has no endpoints.' },
      {
        instruction:
          'Scale back to 2, create an HPA with no resource requests, and observe TARGETS <unknown>.',
      },
      { instruction: 'Add CPU requests, and confirm the HPA starts reporting a real percentage.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3',
        language: 'bash',
        code: `kubectl create namespace scale-lab
kubectl config set-context --current --namespace=scale-lab

kubectl create deployment web --image=nginx:1.27-alpine --replicas=2
kubectl expose deployment web --port=80
kubectl rollout status deploy/web --timeout=120s

kubectl scale deployment web --replicas=5
kubectl rollout status deploy/web --timeout=120s
kubectl get deploy web
# READY 5/5

kubectl get endpoints web -o jsonpath='{.subsets[0].addresses[*].ip}{"\\n"}' | tr ' ' '\\n' | wc -l
# 5`,
      },
      {
        title: 'Step 4 - conditional scaling',
        language: 'bash',
        code: `# Wrong precondition -> refused, nothing changes
kubectl scale deployment web --current-replicas=2 --replicas=8
# error: Expected replicas to be 2, was 5

kubectl get deploy web -o jsonpath='{.spec.replicas}{"\\n"}'
# 5   <- unchanged, which is the point

# Correct precondition -> applied
kubectl scale deployment web --current-replicas=5 --replicas=3
# deployment.apps/web scaled`,
      },
      {
        title: 'Step 5 - scale to zero',
        language: 'bash',
        code: `kubectl scale deployment web --replicas=0
sleep 10
kubectl get deploy web
# READY 0/0

kubectl get endpoints web
# NAME   ENDPOINTS   AGE
# web    <none>      3m       <- the Service exists but routes nowhere

kubectl get pods -l app=web
# No resources found in scale-lab namespace.`,
      },
      {
        title: 'Steps 6-7 - the HPA, broken then fixed',
        language: 'bash',
        code: `kubectl scale deployment web --replicas=2
kubectl rollout status deploy/web --timeout=120s

kubectl autoscale deployment web --min=2 --max=6 --cpu-percent=70
sleep 45
kubectl get hpa web
# NAME   REFERENCE        TARGETS         MINPODS   MAXPODS   REPLICAS
# web    Deployment/web   <unknown>/70%   2         6         2

kubectl describe hpa web | grep -i "missing request" 
# missing request for cpu in container nginx of Pod web-...

# The fix: give the container a CPU request
kubectl set resources deploy/web -c=nginx --requests=cpu=100m,memory=64Mi
kubectl rollout status deploy/web --timeout=120s

sleep 60
kubectl get hpa web
# web    Deployment/web   0%/70%   2   6   2      <- a real percentage`,
      },
      {
        title: 'Step 8 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace scale-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get hpa web -n scale-lab -o jsonpath=\'{.status.currentMetrics[0].resource.current.averageUtilization}{"\\n"}\'',
        what: 'A number here (even 0) proves the HPA is reading metrics; empty means it still cannot.',
        expected: '0 or another small number.',
      },
      {
        command: 'kubectl get deploy web -n scale-lab',
        what: 'The single check for every scaling step.',
        expected: 'READY matching the replica count you set.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace scale-lab',
        what: 'Removes the Deployment, Service and HPA.',
        expected: 'namespace "scale-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['deployments-and-replicasets', 'resource-requirements', 'rolling-updates'],
  docs: [
    {
      title: 'Horizontal Pod Autoscaling',
      url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/',
    },
    {
      title: 'Scaling a Deployment',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#scaling-a-deployment',
    },
  ],
}
