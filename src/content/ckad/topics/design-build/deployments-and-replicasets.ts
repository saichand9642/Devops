import type { Topic } from '../../../types'

export const deploymentsAndReplicaSets: Topic = {
  id: 'deployments-and-replicasets',
  title: 'Deployments and ReplicaSets',
  domainId: 'design-build',
  difficulty: 'beginner',
  estimatedMinutes: 22,
  order: 4,
  tags: ['deployment', 'replicaset', 'replicas', 'pod-template-hash', 'ownerReferences'],
  oneLiner:
    'The default workload for stateless apps: how a Deployment owns ReplicaSets, which own Pods, and what that ownership chain means when things go wrong.',
  explanation: [
    'A **ReplicaSet** has one job: keep exactly `spec.replicas` Pods matching its selector alive. If you delete a Pod it creates another; if you add a matching Pod by hand it deletes one.',
    'A **Deployment** manages ReplicaSets. Each distinct Pod template gets its own ReplicaSet, identified by a `pod-template-hash` label. Changing the template creates a new ReplicaSet and scales it up while scaling the old one down - that is what a rolling update *is*.',
    'You almost never create a ReplicaSet directly. You create a Deployment, and you get versioning, rolling updates and rollbacks for free, because the old ReplicaSets are kept (10 by default) as revision history.',
    'Ownership is recorded in `metadata.ownerReferences`. Pod → ReplicaSet → Deployment. Deleting a Deployment garbage-collects its ReplicaSets and their Pods; deleting with `--cascade=orphan` leaves them running.',
  ],
  whyItMatters: [
    'Deployment is the answer to most "run this application" tasks, and `kubectl create deployment` plus a small edit handles nearly all of them.',
    'Understanding the two-level ownership explains the confusing states: a Deployment reporting `1/3` while three Pods exist (two belong to the old ReplicaSet), or Pods that keep coming back after you delete them.',
    'The immutability of `spec.selector` is a hard rule that shapes how you fix mistakes - you recreate rather than edit.',
  ],
  howItWorks: [
    '`spec.replicas` is the desired count (default 1). `status.replicas`, `status.readyReplicas`, `status.availableReplicas` and `status.updatedReplicas` are what actually exists - the READY/UP-TO-DATE/AVAILABLE columns of `kubectl get deploy`.',
    "`spec.selector` is immutable and must be satisfied by `spec.template.metadata.labels`. The Deployment controller adds `pod-template-hash` to both the ReplicaSet selector and the Pod labels so revisions never steal each other's Pods.",
    'READY means readyReplicas/replicas. UP-TO-DATE means Pods running the current template. AVAILABLE means Pods that have been Ready for at least `minReadySeconds`.',
    '`spec.revisionHistoryLimit` (default 10) caps how many old ReplicaSets are retained for rollback. Setting it to 0 disables rollback entirely.',
    'Scaling a Deployment only changes the current ReplicaSet. Scaling a ReplicaSet directly works but the Deployment will reconcile it back on its next sync.',
    '`spec.paused: true` stops the controller from acting on template changes, which is how you batch several edits into one rollout.',
  ],
  keyObjects: [
    {
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      purpose: 'Declarative updates for Pods via versioned ReplicaSets.',
      fields: [
        { path: 'spec.replicas', meaning: 'Desired Pod count. Default 1.' },
        {
          path: 'spec.selector.matchLabels',
          meaning: 'Which Pods this Deployment owns. Immutable.',
          required: true,
        },
        {
          path: 'spec.template',
          meaning: 'The Pod template. Any change here triggers a new ReplicaSet.',
          required: true,
        },
        { path: 'spec.strategy.type', meaning: 'RollingUpdate (default) or Recreate.' },
        {
          path: 'spec.minReadySeconds',
          meaning: 'How long a new Pod must be Ready before counting as available. Default 0.',
        },
        {
          path: 'spec.revisionHistoryLimit',
          meaning: 'Old ReplicaSets kept for rollback. Default 10.',
        },
        {
          path: 'spec.progressDeadlineSeconds',
          meaning: 'Seconds before a stalled rollout is reported as failed. Default 600.',
        },
        {
          path: 'status.conditions[]',
          meaning:
            'Available and Progressing conditions - Progressing=False means the rollout is stuck.',
        },
      ],
    },
    {
      kind: 'ReplicaSet',
      apiVersion: 'apps/v1',
      purpose: 'Maintains a stable set of identical Pods. Created and owned by a Deployment.',
      fields: [
        {
          path: 'spec.replicas',
          meaning: 'Pods this revision should run. The Deployment sets it during a rollout.',
        },
        {
          path: 'spec.selector',
          meaning: 'Includes pod-template-hash, added by the Deployment controller.',
        },
        {
          path: 'metadata.ownerReferences[]',
          meaning: 'Points back to the Deployment that owns it.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Three Pods, but the Deployment says 1/3',
    story: [
      'An engineer updates the image of a Deployment with 3 replicas. `kubectl get pods` shows five Pods; `kubectl get deploy` shows `READY 1/3, UP-TO-DATE 2, AVAILABLE 1`.',
      'Nothing is broken - this is a rolling update in progress. Two Pods belong to the new ReplicaSet (UP-TO-DATE 2), of which one has passed its readiness probe (READY 1), and three older Pods are still draining.',
      'Ten seconds later the new image turns out to crash on start. Now the numbers stop moving: `UP-TO-DATE 2, READY 1` forever, and after ten minutes the Deployment reports `Progressing=False, ProgressDeadlineExceeded`.',
      'Because old ReplicaSets are retained, recovery is one command: `kubectl rollout undo deployment/api`. The old ReplicaSet scales back to 3, the broken one to 0, and the service is healthy again while the image gets fixed.',
    ],
    code: [
      {
        title: 'Reading a rollout in flight',
        language: 'bash',
        code: `kubectl get deploy api -n shop
# NAME   READY   UP-TO-DATE   AVAILABLE   AGE
# api    1/3     2            1           9m

kubectl get rs -n shop -l app=api
# NAME             DESIRED   CURRENT   READY   AGE
# api-6d4b8f9c7    2         2         1       40s   <- new revision
# api-5f7c9d8b6    2         2         2       9m    <- previous revision

kubectl rollout status deploy/api -n shop --timeout=60s
# Waiting for deployment "api" rollout to finish: 1 of 3 updated replicas are available...
# error: timed out waiting for the condition`,
        explanation:
          'Two ReplicaSets with non-zero replicas always means a rollout is in progress or stuck. `kubectl rollout status` turns that into a single yes/no answer with a timeout.',
        placeholders: ['api', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A complete Deployment with the fields that matter',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
  labels:
    app: api
spec:
  replicas: 3
  revisionHistoryLimit: 5 # keep 5 old ReplicaSets for rollback
  minReadySeconds: 10 # a new Pod must stay Ready 10s to count as available
  progressDeadlineSeconds: 300 # report failure after 5 minutes of no progress
  selector:
    matchLabels:
      app: api # IMMUTABLE
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1 # at most 4 Pods during the update
      maxUnavailable: 0 # never drop below 3 available Pods
  template:
    metadata:
      labels:
        app: api # must satisfy the selector above
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
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi`,
      explanation:
        '`maxUnavailable: 0` with `maxSurge: 1` gives a zero-downtime rollout at the cost of needing capacity for one extra Pod. Without a readiness probe, "Ready" means "process started", and a zero-downtime promise is meaningless.',
      placeholders: ['api', 'shop', 'registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'A bare ReplicaSet (rarely what you want)',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-rs
  template:
    metadata:
      labels:
        app: web-rs
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine`,
      explanation:
        'This works, but changing the image does nothing to running Pods - a ReplicaSet has no update strategy. You would have to delete the Pods by hand. That gap is precisely what Deployments fill.',
      placeholders: ['web-rs', 'shop'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl create deployment api --image=registry.example.com/shop/api:1.4.2 --replicas=3 -n shop',
      what: 'Creates a Deployment with a matching selector and Pod template.',
      expected: 'deployment.apps/api created',
      placeholders: ['api', 'registry.example.com/shop/api:1.4.2', 'shop'],
    },
    {
      command: 'kubectl scale deployment api --replicas=5 -n shop',
      what: 'Changes the desired replica count immediately.',
      expected: 'deployment.apps/api scaled',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl scale deployment api --current-replicas=3 --replicas=5 -n shop',
      what: 'Conditional scale: only acts if the current count is 3. Protects against acting on a stale assumption.',
      expected: 'deployment.apps/api scaled, or an error if the precondition fails.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get rs -n shop -l app=api',
      what: 'Lists the ReplicaSets behind a Deployment, one per revision.',
      expected: 'One row with DESIRED equal to your replica count, others at 0.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pod api-6d4b8f9c7-xk2mq -n shop -o jsonpath=\'{.metadata.ownerReferences[0].name}{"\\n"}\'',
      what: 'Shows which ReplicaSet owns a Pod - the link that explains why deleted Pods come back.',
      expected: 'api-6d4b8f9c7',
      placeholders: ['api-6d4b8f9c7-xk2mq', 'shop'],
    },
    {
      command: 'kubectl delete deployment api -n shop --cascade=orphan',
      what: 'Deletes the Deployment but leaves its ReplicaSets and Pods running - occasionally useful during a migration.',
      expected: 'deployment.apps "api" deleted, and `kubectl get pods` still shows the Pods.',
      placeholders: ['api', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate the skeleton: `kubectl create deployment <name> --image=<img> --replicas=<n> --dry-run=client -o yaml > deploy.yaml`.',
      'Add probes, resources, env and volumes by hand - the generator cannot express them.',
      'Apply, then `kubectl rollout status deploy/<name> --timeout=...` so you find out about failures immediately.',
      'Change the file and re-apply for every subsequent change; keep the file authoritative.',
    ],
    code: [
      {
        title: 'Create, verify, scale, all declaratively',
        language: 'bash',
        code: `kubectl create deployment api --image=nginx:1.27-alpine --replicas=3 \\
  --dry-run=client -o yaml > api.yaml
# edit api.yaml to add probes and resources
kubectl apply -f api.yaml
kubectl rollout status deploy/api --timeout=120s

# To scale declaratively, change spec.replicas in the file and re-apply.
# Scaling imperatively works too, but the next apply would revert it.
sed -i 's/replicas: 3/replicas: 5/' api.yaml
kubectl apply -f api.yaml
kubectl get deploy api`,
        placeholders: ['api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get deploy api -n shop -o wide',
      what: 'READY / UP-TO-DATE / AVAILABLE plus the container image and selector.',
      expected: 'READY 3/3, UP-TO-DATE 3, AVAILABLE 3.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.status.readyReplicas}/{.spec.replicas}{"\\n"}\'',
      what: 'The single number that answers "is it fully rolled out?".',
      expected: '3/3',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout status deployment/api -n shop --timeout=120s',
      what: 'Blocks until the rollout completes or the timeout expires. Exit code 0 means success.',
      expected: 'deployment "api" successfully rolled out',
      placeholders: ['api', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe deploy api -n shop',
      what: 'Conditions, strategy, and events from the Deployment controller.',
      expected: 'Available=True and Progressing=True for a healthy Deployment.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{range .status.conditions[*]}{.type}={.status}: {.message}{"\\n"}{end}\'',
      what: 'Prints the exact reason a rollout is stuck.',
      expected: 'Progressing=False: ReplicaSet "api-6d4b8f9c7" has timed out progressing.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get rs -n shop -l app=api -o wide',
      what: 'When a Deployment is stuck, this shows which revision has Pods and which does not.',
      expected: 'Two ReplicaSets with non-zero DESIRED during a stalled rollout.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe rs api-6d4b8f9c7 -n shop',
      what: "If the ReplicaSet cannot create Pods at all (quota, security policy), the reason appears in its events, not the Deployment's.",
      expected: 'FailedCreate events with the admission or quota error.',
      placeholders: ['api-6d4b8f9c7', 'shop'],
    },
  ],
  commonMistakes: [
    'Selector and template labels that do not match - the apply is rejected with "`selector` does not match template `labels`".',
    'Trying to change `spec.selector` on an existing Deployment. It is immutable; delete and recreate.',
    'Deleting Pods to "restart" an app. Use `kubectl rollout restart deployment/<name>` instead.',
    'Scaling the ReplicaSet instead of the Deployment - the Deployment reconciles it back.',
    'Setting `revisionHistoryLimit: 0` and then being unable to `rollout undo`.',
    'Expecting a rolling update from a bare ReplicaSet. Only Deployments have an update strategy.',
    'Reading UP-TO-DATE as "healthy". It counts Pods with the current template, ready or not.',
  ],
  examTips: [
    '`kubectl create deployment <name> --image=<img> --replicas=<n>` covers the majority of Deployment tasks in one line.',
    'Always follow an update with `kubectl rollout status deploy/<name> --timeout=60s` - it converts "looks fine" into a verified result.',
    '`kubectl rollout restart deployment/<name>` is the correct way to recycle Pods (for example after a Secret change).',
    'If a task says "do not delete the Deployment", remember `replace --force` and `delete` are off the table - use `set image`, `scale`, `patch` or `edit`.',
    'Check `kubectl get rs` when a Deployment behaves oddly; the ReplicaSet events often hold the real error.',
  ],
  summary: [
    'Deployment → ReplicaSet (one per Pod template) → Pods, linked by ownerReferences and pod-template-hash.',
    'READY = ready/desired, UP-TO-DATE = current-template Pods, AVAILABLE = Ready for minReadySeconds.',
    '`spec.selector` is immutable and must match the Pod template labels.',
    'Old ReplicaSets are the rollback mechanism; `revisionHistoryLimit` controls how many are kept.',
    'Use `rollout status` to verify and `rollout restart` to recycle.',
  ],
  practice: [
    {
      id: 'deploy-p1',
      level: 'beginner',
      prompt:
        'How many ReplicaSets does a Deployment have after two image updates, with default settings?',
      answer:
        'Three: one per distinct Pod template (the original plus two updates). Only the newest has non-zero replicas; the other two are kept at 0 for rollback, up to `revisionHistoryLimit` (default 10).',
      explanation:
        'Check with `kubectl get rs -l app=<label>`. Rolling back reuses one of the zero-scaled ReplicaSets rather than creating a new one.',
    },
    {
      id: 'deploy-p2',
      level: 'intermediate',
      prompt:
        'A Deployment shows `READY 3/3` but `UP-TO-DATE 2`. Explain what state the system is in.',
      answer:
        'Three Pods are Ready, but only two of them run the current Pod template - the third is still from the previous ReplicaSet. The rolling update is in progress and has not yet replaced the last old Pod.',
      explanation:
        "`kubectl get rs` will show two ReplicaSets with non-zero DESIRED. `kubectl rollout status` will still be waiting. If it never advances, check the new Pods' readiness probes.",
    },
    {
      id: 'deploy-p3',
      level: 'advanced',
      prompt:
        'Write the commands to create a Deployment `web` in namespace `shop` with 4 replicas of `nginx:1.27-alpine`, then prove which ReplicaSet owns its Pods.',
      answer:
        'kubectl create deployment web --image=nginx:1.27-alpine --replicas=4 -n shop\nkubectl get pods -n shop -l app=web -o jsonpath=\'{range .items[*]}{.metadata.name}{" owner="}{.metadata.ownerReferences[0].name}{"\\n"}{end}\'',
      explanation:
        "Every Pod's ownerReference names the same ReplicaSet, whose name is `web-<pod-template-hash>`. That hash is also a label on each Pod, which is how the ReplicaSet finds them without colliding with other revisions.",
    },
  ],
  lab: {
    title: 'Prove the ownership chain',
    scenario:
      'You will create a Deployment, follow the chain from Pod to ReplicaSet to Deployment, watch a ReplicaSet resurrect a deleted Pod, and see what `--cascade=orphan` does.',
    prerequisites: ['A cluster with capacity for four small Pods'],
    tasks: [
      { instruction: 'Create namespace `rs-lab` and set it as default.' },
      { instruction: 'Create a Deployment `web` with 3 replicas of `nginx:1.27-alpine`.' },
      { instruction: 'List the ReplicaSet and show that its name contains the pod-template-hash.' },
      { instruction: 'Print each Pod together with the ReplicaSet that owns it.' },
      { instruction: 'Delete one Pod and prove a replacement appears within seconds.' },
      {
        instruction:
          'Scale the ReplicaSet directly to 5 and observe the Deployment reconcile it back to 3.',
      },
      {
        instruction:
          'Delete the Deployment with `--cascade=orphan` and confirm the Pods survive; then clean up.',
      },
    ],
    solution: [
      {
        title: 'Steps 1-4 - build and trace',
        language: 'bash',
        code: `kubectl create namespace rs-lab
kubectl config set-context --current --namespace=rs-lab
kubectl create deployment web --image=nginx:1.27-alpine --replicas=3
kubectl rollout status deploy/web --timeout=90s

kubectl get rs -l app=web
# NAME             DESIRED   CURRENT   READY   AGE
# web-5f7c9d8b6    3         3         3       12s
#     ^^^^^^^^^ pod-template-hash

kubectl get pods -l app=web -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.metadata.ownerReferences[0].kind}{"/"}{.metadata.ownerReferences[0].name}{"\\n"}{end}'
# web-5f7c9d8b6-2xk4l -> ReplicaSet/web-5f7c9d8b6
# web-5f7c9d8b6-8n7pq -> ReplicaSet/web-5f7c9d8b6
# web-5f7c9d8b6-hj4rt -> ReplicaSet/web-5f7c9d8b6

kubectl get rs web-5f7c9d8b6 -o jsonpath='{.metadata.ownerReferences[0].kind}{"/"}{.metadata.ownerReferences[0].name}{"\\n"}'
# Deployment/web`,
      },
      {
        title: 'Step 5 - the resurrection',
        language: 'bash',
        code: `VICTIM=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod "$VICTIM"
kubectl get pods -l app=web
# Three Pods again: the deleted name is gone, a new random suffix is present.

kubectl get events --field-selector reason=SuccessfulCreate --sort-by=.lastTimestamp | tail -2
# ... replicaset-controller  Created pod: web-5f7c9d8b6-xxxxx`,
      },
      {
        title: 'Step 6 - who wins, ReplicaSet or Deployment',
        language: 'bash',
        code: `kubectl scale rs web-5f7c9d8b6 --replicas=5
kubectl get rs web-5f7c9d8b6
# DESIRED 5 briefly...

sleep 5
kubectl get rs web-5f7c9d8b6
# DESIRED 3   <- the Deployment controller reconciled it back

# The Deployment is the source of truth:
kubectl scale deployment web --replicas=5
kubectl get rs web-5f7c9d8b6
# DESIRED 5   <- this one sticks`,
      },
      {
        title: 'Step 7 - orphaning, then cleanup',
        language: 'bash',
        code: `kubectl delete deployment web --cascade=orphan
kubectl get deploy       # No resources found
kubectl get rs           # web-5f7c9d8b6 still there, now unowned
kubectl get pods         # still running

# Now really remove them
kubectl delete rs -l app=web
kubectl config set-context --current --namespace=default
kubectl delete namespace rs-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get pods -n rs-lab -l app=web -o jsonpath=\'{range .items[*]}{.metadata.ownerReferences[0].name}{"\\n"}{end}\'',
        what: 'Every Pod should name the same owning ReplicaSet.',
        expected: 'The same web-<hash> repeated once per Pod.',
      },
      {
        command: 'kubectl get rs -n rs-lab -l app=web',
        what: 'Confirms DESIRED tracks the Deployment, not your manual scale.',
        expected: 'DESIRED equal to the Deployment replica count.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace rs-lab',
        what: 'Removes the lab namespace and any orphans in it.',
        expected: 'namespace "rs-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['rolling-updates', 'scaling-applications', 'labels-selectors-annotations'],
  docs: [
    {
      title: 'Deployments',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
    },
    {
      title: 'ReplicaSet',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/',
    },
  ],
}
