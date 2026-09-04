import type { Topic } from '../../../types'

export const rollingUpdates: Topic = {
  id: 'rolling-updates',
  title: 'Rolling updates, rollout status, history and rollback',
  domainId: 'deployment',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 1,
  tags: ['rollout', 'rolling update', 'maxSurge', 'maxUnavailable', 'undo', 'history', 'Recreate'],
  oneLiner:
    'Update a Deployment without downtime, watch it, read its revision history, and reverse it in one command when it goes wrong.',
  explanation: [
    'A rolling update happens whenever you change anything inside `spec.template`. The Deployment controller creates a new ReplicaSet for the new template and then shifts replicas from the old one to the new one, a few at a time.',
    'Two fields control the pace. `maxSurge` is how many Pods above the desired count may exist during the update; `maxUnavailable` is how many below the desired count of *available* Pods you will tolerate. Both default to 25%, rounded appropriately.',
    'The alternative strategy is `Recreate`: kill all old Pods, then start the new ones. That means downtime, and it is the right choice only when two versions genuinely cannot coexist - for example when they share a ReadWriteOnce volume or an exclusive lock.',
    'The rollout is only as good as your readiness probe. Kubernetes considers a new Pod "available" when it is Ready for `minReadySeconds`; without a readiness probe, Ready means "the process started", so a broken build can be rolled out to every replica before anyone notices.',
    'Every template change is recorded as a revision, backed by the retained old ReplicaSets. `kubectl rollout undo` moves back to the previous revision, or to a specific one with `--to-revision`.',
  ],
  whyItMatters: [
    'The curriculum lists "understand Deployments and how to perform rolling updates" explicitly, and rollout/undo commands are among the most likely to appear.',
    'Under time pressure, `kubectl rollout status ... --timeout=` converts "I think that worked" into a verified yes or no, and `kubectl rollout undo` is the fastest recovery in the product.',
    'Knowing `maxSurge`/`maxUnavailable` lets you answer the "zero downtime" and "never exceed N Pods" variants of the same task, which is exactly how they are phrased.',
  ],
  howItWorks: [
    'Trigger: any change to `spec.template` (image, env, labels, annotations, resources, probes). Changing `spec.replicas` alone is a scale, not a rollout, and creates no new revision.',
    'Percentages resolve against `spec.replicas`. `maxSurge` rounds up, `maxUnavailable` rounds down - so with 4 replicas and defaults you get maxSurge 1 and maxUnavailable 1.',
    '`maxUnavailable: 0` guarantees you never dip below the desired available count, which requires `maxSurge >= 1` and therefore spare cluster capacity. `maxSurge: 0` with `maxUnavailable: 1` updates in place with no extra capacity but a temporary reduction in serving Pods.',
    '`kubectl rollout status` watches until `spec.replicas == status.updatedReplicas == status.availableReplicas`, then exits 0. If `progressDeadlineSeconds` (default 600) passes with no progress, the Deployment condition `Progressing` becomes False with reason `ProgressDeadlineExceeded` and rollout status exits non-zero.',
    'History: `kubectl rollout history` lists revisions; the CHANGE-CAUSE column is populated from the `kubernetes.io/change-cause` annotation, which you must set yourself (the old `--record` flag is gone).',
    '`kubectl rollout undo` swaps the ReplicaSet scale-ups around: the previous ReplicaSet scales back up and the current one down. This creates a *new* revision number rather than deleting the bad one.',
    '`kubectl rollout pause` stops the controller acting on further template changes, so you can batch several edits and then `resume` for a single rollout. `kubectl rollout restart` re-creates all Pods with the same template by stamping a new annotation on it.',
  ],
  keyObjects: [
    {
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      purpose: 'Owns the rollout mechanism and its revision history.',
      fields: [
        { path: 'spec.strategy.type', meaning: 'RollingUpdate (default) or Recreate.' },
        {
          path: 'spec.strategy.rollingUpdate.maxSurge',
          meaning: 'Extra Pods allowed above desired, count or percentage. Default 25%.',
        },
        {
          path: 'spec.strategy.rollingUpdate.maxUnavailable',
          meaning: 'Available Pods allowed below desired. Default 25%.',
        },
        {
          path: 'spec.minReadySeconds',
          meaning: 'Ready duration before a Pod counts as available. Default 0.',
        },
        {
          path: 'spec.progressDeadlineSeconds',
          meaning: 'Seconds without progress before the rollout is marked failed. Default 600.',
        },
        {
          path: 'spec.revisionHistoryLimit',
          meaning: 'Retained old ReplicaSets, and therefore rollback targets. Default 10.',
        },
        { path: 'spec.paused', meaning: 'true suspends reconciliation of template changes.' },
        {
          path: 'metadata.annotations["kubernetes.io/change-cause"]',
          meaning: 'Text shown in the CHANGE-CAUSE column of rollout history.',
        },
        {
          path: 'metadata.annotations["deployment.kubernetes.io/revision"]',
          meaning: 'Revision number, set by the controller on each ReplicaSet.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A bad image that never reached production traffic',
    story: [
      'A team ships `api:1.5.0`, which fails to start because of a missing environment variable. The Deployment has 6 replicas, `maxUnavailable: 0`, `maxSurge: 1`, and a readiness probe on `/readyz`.',
      'The rollout creates one new Pod. It starts but never becomes Ready, so it never counts as available, so the controller never scales the old ReplicaSet down. Five of six old Pods are still serving - in fact all six, since maxUnavailable is 0.',
      'Users see nothing. `kubectl rollout status` stops progressing, and after `progressDeadlineSeconds` the Deployment reports `ProgressDeadlineExceeded`. The single stuck Pod is visible in `kubectl get pods` as `0/1 Running`.',
      '`kubectl rollout undo deployment/api` returns the template to 1.4.2 and deletes the stuck Pod. The whole incident is contained by two settings - a readiness probe and `maxUnavailable: 0` - and one command.',
      'Without the readiness probe, all six Pods would have been replaced with a non-working build in under a minute.',
    ],
    code: [
      {
        title: 'The contained failure',
        language: 'bash',
        code: `kubectl set image deploy/api api=registry.example.com/shop/api:1.5.0 -n shop
kubectl rollout status deploy/api -n shop --timeout=120s
# Waiting for deployment "api" rollout to finish: 0 of 6 updated replicas are available...
# error: timed out waiting for the condition       <- non-zero exit code

kubectl get pods -n shop -l app=api
# api-5f7c9d8b6-...   1/1   Running   (x6, old revision, still serving)
# api-7c9d8f4a2-...   0/1   Running   (new revision, never Ready)

kubectl rollout undo deploy/api -n shop
# deployment.apps/api rolled back
kubectl rollout status deploy/api -n shop --timeout=120s
# deployment "api" successfully rolled out`,
        explanation:
          'The non-zero exit code from rollout status is what makes this automatable in CI - and what makes it a reliable verification step in the exam.',
        placeholders: ['api', 'shop', 'registry.example.com/shop/api:1.5.0'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Zero-downtime rolling update settings',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
  annotations:
    kubernetes.io/change-cause: "Upgrade to api 1.4.2 for the checkout fix"
spec:
  replicas: 6
  minReadySeconds: 15 # a Pod must stay Ready 15s before counting
  progressDeadlineSeconds: 300 # fail the rollout after 5 minutes of no progress
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1 # at most 7 Pods exist at once
      maxUnavailable: 0 # never fewer than 6 available Pods
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
          # Without this probe, "zero downtime" is a slogan, not a guarantee.
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
            failureThreshold: 3`,
      explanation:
        '`maxUnavailable: 0` is the setting that makes a broken rollout safe: the controller refuses to remove a working Pod until a replacement is genuinely available.',
      placeholders: ['api', 'shop', 'registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'Recreate strategy, and when it is correct',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: legacy-batch
  namespace: shop
spec:
  replicas: 1
  strategy:
    type: Recreate # all old Pods terminate BEFORE any new Pod starts
  selector:
    matchLabels:
      app: legacy-batch
  template:
    metadata:
      labels:
        app: legacy-batch
    spec:
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: legacy-data # ReadWriteOnce - two Pods cannot both mount it
      containers:
        - name: batch
          image: registry.example.com/shop/legacy:2.1.0
          volumeMounts:
            - name: data
              mountPath: /data`,
      explanation:
        'With RollingUpdate the new Pod would try to attach the same RWO volume while the old Pod still holds it, and would stay stuck in ContainerCreating. Recreate accepts brief downtime in exchange for correctness.',
      placeholders: ['legacy-batch', 'shop', 'legacy-data'],
    },
  ],
  imperative: [
    {
      command: 'kubectl set image deployment/api api=registry.example.com/shop/api:1.4.3 -n shop',
      what: 'Changes one container image and starts a rolling update. The name before `=` is the *container* name.',
      expected: 'deployment.apps/api image updated',
      placeholders: ['api', 'registry.example.com/shop/api:1.4.3', 'shop'],
    },
    {
      command: 'kubectl rollout status deployment/api -n shop --timeout=180s',
      what: 'Blocks until the rollout finishes; exits non-zero on timeout. The verification step for every update.',
      expected: 'deployment "api" successfully rolled out',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout history deployment/api -n shop',
      what: 'Lists revisions with their change causes.',
      expected: 'REVISION / CHANGE-CAUSE rows, newest last.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout history deployment/api --revision=3 -n shop',
      what: 'Shows the full Pod template of one revision - how you confirm what a rollback would restore.',
      expected: 'The container image, env and probes of revision 3.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout undo deployment/api -n shop',
      what: 'Rolls back to the immediately previous revision.',
      expected: 'deployment.apps/api rolled back',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout undo deployment/api --to-revision=2 -n shop',
      what: 'Rolls back to a specific revision from the history list.',
      expected: 'deployment.apps/api rolled back',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl annotate deployment/api kubernetes.io/change-cause="Set image to 1.4.3" -n shop',
      what: 'Populates the CHANGE-CAUSE column. Do this *with* the change, since `--record` no longer exists.',
      expected: 'deployment.apps/api annotated',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout restart deployment/api -n shop',
      what: 'Recreates every Pod with an unchanged template - the correct way to pick up a changed Secret or ConfigMap.',
      expected: 'deployment.apps/api restarted',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout pause deployment/api -n shop',
      what: 'Suspends rollouts so several template edits can be batched into one.',
      expected: 'deployment.apps/api paused',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl rollout resume deployment/api -n shop',
      what: 'Resumes and performs a single rollout containing all batched changes.',
      expected: 'deployment.apps/api resumed',
      placeholders: ['api', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Set `strategy`, `minReadySeconds` and a readiness probe in the manifest, not at update time.',
      'Change the image (or any template field) in the file and `kubectl apply -f`.',
      'Set `kubernetes.io/change-cause` in the same apply so the history is meaningful.',
      'Verify with `kubectl rollout status --timeout=`, and check the exit code rather than the screen.',
      'On failure, `kubectl rollout undo` first, then fix the file - never leave a broken revision live while you debug.',
    ],
    code: [
      {
        title: 'A declarative update with a recorded reason',
        language: 'bash',
        code: `# Update the image and the change-cause together in api.yaml, then:
kubectl apply -f api.yaml
kubectl rollout status deploy/api --timeout=180s || kubectl rollout undo deploy/api

kubectl rollout history deploy/api
# REVISION  CHANGE-CAUSE
# 1         Initial deployment of api 1.4.1
# 2         Upgrade to api 1.4.2 for the checkout fix`,
        placeholders: ['api', 'api.yaml'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl rollout status deployment/api -n shop --timeout=180s',
      what: 'The single authoritative check that an update completed.',
      expected: 'deployment "api" successfully rolled out',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.spec.template.spec.containers[0].image}{"\\n"}\'',
      what: 'Confirms the template now carries the intended image.',
      expected: 'registry.example.com/shop/api:1.4.3',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get pods -n shop -l app=api -o jsonpath=\'{range .items[*]}{.spec.containers[0].image}{"\\n"}{end}\' | sort -u',
      what: 'Confirms every *running* Pod is on the new image, not just the template.',
      expected: 'A single image line.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get rs -n shop -l app=api',
      what: 'After a completed rollout exactly one ReplicaSet should have non-zero replicas.',
      expected: 'One row with DESIRED equal to spec.replicas, others 0.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{range .status.conditions[*]}{.type}={.status} {.reason}{"\\n"}{end}\'',
      what: 'Names the reason a rollout is stuck.',
      expected: 'Progressing=False ProgressDeadlineExceeded for a stalled rollout.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop -l app=api',
      what: 'A new Pod at `0/1 Running` means the readiness probe is failing; `CrashLoopBackOff` means the container is exiting.',
      expected: 'Identifies which failure mode you are dealing with.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl describe pod api-7c9d8f4a2-xk2mq -n shop | grep -iA3 "readiness\\|liveness"',
      what: 'Shows the probe failure message and status code.',
      expected: 'Readiness probe failed: HTTP probe failed with statuscode: 500.',
      placeholders: ['api-7c9d8f4a2-xk2mq', 'shop'],
    },
    {
      command: 'kubectl rollout undo deployment/api -n shop',
      what: 'Recover first, investigate afterwards.',
      expected: 'deployment.apps/api rolled back',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get deploy api -n shop -o jsonpath=\'{.spec.paused}{"\\n"}\'',
      what: 'A paused Deployment ignores template changes - the quiet reason "my apply did nothing".',
      expected: 'Empty or false. `true` means run `kubectl rollout resume`.',
      placeholders: ['api', 'shop'],
    },
  ],
  commonMistakes: [
    'Rolling out without a readiness probe, so a broken build replaces every replica before anyone notices.',
    'Using `kubectl set image` with the Deployment name instead of the container name on the left of `=`.',
    'Expecting `--record` to work. It has been removed - set `kubernetes.io/change-cause` with `kubectl annotate` or in the manifest.',
    'Setting both `maxSurge: 0` and `maxUnavailable: 0`, which is rejected because no progress would be possible.',
    'Thinking `kubectl rollout undo` deletes the bad revision. It creates a new revision that matches the old template.',
    'Using `Recreate` on a user-facing service and accepting downtime for no reason.',
    'Deleting Pods to force new ones instead of `kubectl rollout restart`.',
    'Setting `revisionHistoryLimit: 0` and then having nothing to roll back to.',
  ],
  examTips: [
    'Finish every update with `kubectl rollout status deploy/<name> --timeout=60s`. It is fast, and it proves the task is done.',
    '"Update the image" → `kubectl set image deploy/<name> <container>=<image>`. Get the container name from `kubectl get deploy <name> -o jsonpath=\'{.spec.template.spec.containers[*].name}\'`.',
    '"Roll back to the previous version" → `kubectl rollout undo deploy/<name>`. "To a specific version" → add `--to-revision=N` after checking `rollout history`.',
    '"Without downtime" or "keep all replicas serving" → `maxUnavailable: 0` plus `maxSurge: 1`.',
    '"Restart all Pods" → `kubectl rollout restart`, never `kubectl delete pod`.',
    'If a task asks you to record the reason for a change, that is the `kubernetes.io/change-cause` annotation.',
  ],
  summary: [
    'Any `spec.template` change triggers a rollout; changing replicas alone does not.',
    '`maxSurge` bounds extra Pods, `maxUnavailable` bounds missing available Pods; both default to 25%.',
    'A readiness probe is what makes a rolling update safe - without it, availability is meaningless.',
    '`rollout status` verifies, `rollout history` inspects, `rollout undo` recovers, `rollout restart` recycles.',
    'Revision history lives in the retained old ReplicaSets, capped by `revisionHistoryLimit`.',
  ],
  practice: [
    {
      id: 'ru-p1',
      level: 'beginner',
      prompt:
        'A Deployment named `web` in namespace `shop` has a container named `nginx`. Write the command that updates it to `nginx:1.27` and the command that verifies the rollout.',
      answer:
        'kubectl set image deployment/web nginx=nginx:1.27 -n shop\nkubectl rollout status deployment/web -n shop --timeout=120s',
      explanation:
        'The `nginx=` on the left is the container name. If you pass the Deployment name there instead, kubectl reports that the container was not found and nothing changes.',
    },
    {
      id: 'ru-p2',
      level: 'intermediate',
      prompt:
        'With `replicas: 10`, `maxSurge: 2` and `maxUnavailable: 0`, what is the maximum number of Pods that can exist during an update, and the minimum number of available Pods?',
      answer:
        'Maximum 12 Pods (10 + maxSurge 2). Minimum 10 available Pods (10 - maxUnavailable 0).',
      explanation:
        'This configuration needs headroom for two extra Pods. If the cluster cannot schedule them, the rollout stalls at Pending rather than proceeding - a common surprise in tightly packed clusters.',
    },
    {
      id: 'ru-p3',
      level: 'advanced',
      prompt:
        'You updated a Deployment twice; revision 3 is live and broken, revision 2 was also broken, revision 1 was good. Give the exact commands to inspect and return to the good version, and say what the revision number becomes.',
      answer:
        'kubectl rollout history deployment/api -n shop\nkubectl rollout history deployment/api --revision=1 -n shop     # confirm it is the good template\nkubectl rollout undo deployment/api --to-revision=1 -n shop\nkubectl rollout status deployment/api -n shop --timeout=120s\n\nThe live revision becomes 4 - a new revision whose template matches revision 1.',
      explanation:
        'A plain `kubectl rollout undo` would go to revision 2, which is also broken, so `--to-revision=1` is required. Always inspect the target revision before rolling back to it.',
    },
  ],
  lab: {
    title: 'A good rollout, a stuck rollout, and a rollback',
    scenario:
      'You will perform a successful rolling update with zero unavailability, then deliberately roll out a broken image and watch a readiness probe contain the damage, then recover.',
    prerequisites: ['A cluster with capacity for five small Pods'],
    tasks: [
      { instruction: 'Create namespace `ru-lab` and set it as default.' },
      {
        instruction:
          'Create a Deployment `web` with 4 replicas of `nginx:1.26-alpine`, a readiness probe on `/` port 80, maxSurge 1 and maxUnavailable 0.',
      },
      {
        instruction:
          'Record a change cause, then update the image to `nginx:1.27-alpine` and verify the rollout completes.',
      },
      { instruction: 'Show the rollout history and inspect revision 1.' },
      {
        instruction:
          'Update to a non-existent tag `nginx:does-not-exist` and observe that the rollout stalls while the old Pods keep serving.',
      },
      { instruction: 'Prove that 4 Pods are still available despite the stuck rollout.' },
      { instruction: 'Roll back and verify.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the Deployment',
        language: 'yaml',
        code: `# web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: ru-lab
  annotations:
    kubernetes.io/change-cause: "Initial deployment on nginx 1.26"
spec:
  replicas: 4
  minReadySeconds: 5
  progressDeadlineSeconds: 120 # fail fast so the lab does not take 10 minutes
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.26-alpine
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 2
            periodSeconds: 3`,
      },
      {
        title: 'Step 3 - a clean update',
        language: 'bash',
        code: `kubectl create namespace ru-lab
kubectl config set-context --current --namespace=ru-lab
kubectl apply -f web.yaml
kubectl rollout status deploy/web --timeout=180s

kubectl annotate deployment/web kubernetes.io/change-cause="Upgrade to nginx 1.27" --overwrite
kubectl set image deploy/web nginx=nginx:1.27-alpine
kubectl rollout status deploy/web --timeout=180s
# deployment "web" successfully rolled out

# Watch it happen next time with:
#   kubectl get pods -l app=web -w`,
      },
      {
        title: 'Step 4 - history',
        language: 'bash',
        code: `kubectl rollout history deploy/web
# REVISION  CHANGE-CAUSE
# 1         Initial deployment on nginx 1.26
# 2         Upgrade to nginx 1.27

kubectl rollout history deploy/web --revision=1 | grep -i image
#     Image:      nginx:1.26-alpine`,
      },
      {
        title: 'Step 5-6 - the contained failure',
        language: 'bash',
        code: `kubectl set image deploy/web nginx=nginx:does-not-exist
kubectl rollout status deploy/web --timeout=90s
# Waiting for deployment "web" rollout to finish: 0 out of 4 new replicas have been updated...
# error: timed out waiting for the condition

kubectl get pods -l app=web
# web-<old>-...   1/1   Running            (x4)
# web-<new>-...   0/1   ImagePullBackOff   (x1)

kubectl get deploy web
# NAME   READY   UP-TO-DATE   AVAILABLE   AGE
# web    4/4     1            4           3m
#        ^^^ still four available Pods - maxUnavailable: 0 did its job

kubectl get deploy web -o jsonpath='{range .status.conditions[*]}{.type}={.status} {.reason}{"\\n"}{end}'
# Available=True MinimumReplicasAvailable
# Progressing=False ProgressDeadlineExceeded`,
      },
      {
        title: 'Steps 7-8 - recover and clean up',
        language: 'bash',
        code: `kubectl rollout undo deploy/web
kubectl rollout status deploy/web --timeout=180s
# deployment "web" successfully rolled out

kubectl get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}{"\\n"}'
# nginx:1.27-alpine       <- back to the last good image

kubectl rollout history deploy/web
# revision 4 now exists, matching the template of revision 2

kubectl config set-context --current --namespace=default
kubectl delete namespace ru-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get deploy web -n ru-lab',
        what: 'During the broken rollout, AVAILABLE must stay at 4 - the proof that maxUnavailable: 0 protects traffic.',
        expected: 'READY 4/4 and AVAILABLE 4 throughout.',
      },
      {
        command:
          'kubectl get pods -n ru-lab -l app=web -o jsonpath=\'{range .items[*]}{.spec.containers[0].image}{"\\n"}{end}\' | sort -u',
        what: 'After the rollback every running Pod should be on the same good image.',
        expected: 'nginx:1.27-alpine',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace ru-lab',
        what: 'Removes the Deployment and its ReplicaSets.',
        expected: 'namespace "ru-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['deployments-and-replicasets', 'deployment-strategies', 'probes'],
  docs: [
    {
      title: 'Performing a rolling update',
      url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/',
    },
    {
      title: 'Deployments - updating',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#updating-a-deployment',
    },
  ],
}
