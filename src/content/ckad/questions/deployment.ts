import type { Question } from '../../types'

export const deploymentQuestions: Question[] = [
  {
    id: 'dep-q01',
    domainId: 'deployment',
    topicId: 'rolling-updates',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Deployment web in namespace shop has a container named nginx. Write the command that updates that container to image nginx:1.27-alpine.',
    acceptedAnswers: [
      'kubectl set image deployment/web nginx=nginx:1.27-alpine -n shop',
      'kubectl set image deploy/web nginx=nginx:1.27-alpine -n shop',
      'kubectl -n shop set image deployment/web nginx=nginx:1.27-alpine',
      'kubectl set image deployment web nginx=nginx:1.27-alpine -n shop',
    ],
    answerHint: 'kubectl set image ...',
    explanation:
      "The name on the left of `=` is the *container* name, not the Deployment name. Get it with `kubectl get deploy web -o jsonpath='{.spec.template.spec.containers[*].name}'`. Follow up with `kubectl rollout status deploy/web -n shop --timeout=60s` to verify.",
  },
  {
    id: 'dep-q02',
    domainId: 'deployment',
    topicId: 'rolling-updates',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that rolls Deployment api in namespace shop back to its previous revision.',
    acceptedAnswers: [
      'kubectl rollout undo deployment/api -n shop',
      'kubectl rollout undo deploy/api -n shop',
      'kubectl -n shop rollout undo deployment/api',
      'kubectl rollout undo deployment api -n shop',
    ],
    answerHint: 'kubectl rollout ...',
    explanation:
      'Add `--to-revision=N` to target a specific revision from `kubectl rollout history`. The undo creates a *new* revision whose template matches the old one - history is append-only, so the bad revision is not deleted.',
  },
  {
    id: 'dep-q03',
    domainId: 'deployment',
    topicId: 'rolling-updates',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Deployment has `replicas: 10`, `maxSurge: 2` and `maxUnavailable: 0`. During an update, what is the maximum number of Pods and the minimum number of available Pods?',
    options: [
      { id: 'a', text: 'Maximum 10, minimum 8' },
      { id: 'b', text: 'Maximum 12, minimum 10' },
      { id: 'c', text: 'Maximum 12, minimum 8' },
      { id: 'd', text: 'Maximum 10, minimum 10' },
    ],
    correct: ['b'],
    explanation:
      'maxSurge is added to the desired count (10 + 2 = 12) and maxUnavailable is subtracted from the available count (10 - 0 = 10). This is the zero-downtime configuration, and it requires headroom in the cluster for two extra Pods - without it the rollout stalls with Pending Pods.',
  },
  {
    id: 'dep-q04',
    domainId: 'deployment',
    topicId: 'rolling-updates',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'After a `kubectl set image`, `kubectl get deploy api` shows `READY 6/6, UP-TO-DATE 1, AVAILABLE 6` and stops changing. What has happened?',
    options: [
      { id: 'a', text: 'The rollout completed successfully' },
      {
        id: 'b',
        text: 'The new Pod is not becoming Ready, and maxUnavailable: 0 is protecting the old ones',
      },
      { id: 'c', text: 'The Deployment is paused' },
      { id: 'd', text: 'The cluster has run out of nodes' },
    ],
    correct: ['b'],
    explanation:
      'One Pod has the new template but has not passed its readiness probe, so it never counts as available and the controller refuses to scale the old ReplicaSet down. All six old Pods keep serving - the failure is contained. `kubectl get pods` will show a `0/1 Running` Pod, and `kubectl describe` names the probe failure or image error.',
  },
  {
    id: 'dep-q05',
    domainId: 'deployment',
    topicId: 'scaling-applications',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Write the command that scales Deployment web in namespace shop to 7 replicas.',
    acceptedAnswers: [
      'kubectl scale deployment web --replicas=7 -n shop',
      'kubectl scale deploy web --replicas=7 -n shop',
      'kubectl -n shop scale deployment web --replicas=7',
      'kubectl scale deployment/web --replicas=7 -n shop',
    ],
    answerHint: 'kubectl scale ...',
    explanation:
      'Verify with `kubectl get deploy web -n shop` and look for READY 7/7. Scaling changes `spec.replicas` only and creates no new revision, so `kubectl rollout undo` will not reverse it.',
  },
  {
    id: 'dep-q06',
    domainId: 'deployment',
    topicId: 'scaling-applications',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'An HPA shows `TARGETS: <unknown>/70%` and never scales. What is the most likely cause?',
    options: [
      { id: 'a', text: 'maxReplicas is set too low' },
      { id: 'b', text: 'The containers have no CPU resource request' },
      { id: 'c', text: 'The Deployment has no readiness probe' },
      { id: 'd', text: 'The HPA apiVersion is wrong' },
    ],
    correct: ['b'],
    explanation:
      'CPU utilisation in an HPA is a percentage *of the request*, so with no `resources.requests.cpu` there is no denominator and the value is unknown. `kubectl describe hpa` states this directly: "missing request for cpu". The second candidate cause is metrics-server not being installed, which `kubectl top pods` reveals.',
  },
  {
    id: 'dep-q07',
    domainId: 'deployment',
    topicId: 'deployment-strategies',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Using only Kubernetes primitives, how do you cut all traffic from a blue version to a green version instantly?',
    options: [
      { id: 'a', text: 'Scale the blue Deployment to 0 and the green Deployment up' },
      { id: 'b', text: 'Change the Service selector to match the green Pod labels' },
      { id: 'c', text: 'Delete the blue Deployment' },
      { id: 'd', text: 'Set `maxUnavailable: 100%` on the blue Deployment' },
    ],
    correct: ['b'],
    explanation:
      'Both versions run fully scaled; the Service selector decides who serves. Patching one label value is instant, causes no Pod churn, and the rollback is the same command with the old value. Scaling would work but is slower and leaves a window with reduced capacity.',
  },
  {
    id: 'dep-q08',
    domainId: 'deployment',
    topicId: 'deployment-strategies',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'You want roughly 25% of traffic on a canary with 12 Pods of total capacity, using one Service. What replica counts and label design do you use?',
    options: [
      { id: 'a', text: 'canary 3 / stable 9; the Service selector includes the track label' },
      { id: 'b', text: 'canary 3 / stable 9; the Service selector uses only the shared app label' },
      { id: 'c', text: 'canary 12 / stable 12; two Services with different selectors' },
      { id: 'd', text: 'canary 1 / stable 12; the Service selector uses only the track label' },
    ],
    correct: ['b'],
    explanation:
      '3 of 12 Pods is about 25%. The Service must match *both* Deployments, so its selector uses only the shared label (`app: api`) and omits `track`. Each Deployment still includes `track` in its own selector so it owns only its own Pods. Including `track` in the Service selector would route 100% to one version.',
  },
  {
    id: 'dep-q09',
    domainId: 'deployment',
    topicId: 'helm-fundamentals',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the Helm command that installs chart bitnami/nginx as release web into namespace shop, creating the namespace if it does not exist.',
    acceptedAnswers: [
      'helm install web bitnami/nginx -n shop --create-namespace',
      'helm install web bitnami/nginx --namespace shop --create-namespace',
      'helm install web bitnami/nginx --create-namespace -n shop',
      'helm install web bitnami/nginx -n shop --create-namespace=true',
    ],
    answerHint: 'helm install ...',
    explanation:
      'The argument order is `helm install <release-name> <chart>`. Use `helm upgrade --install` instead when you want the command to be idempotent. Verify with `helm list -n shop` and `kubectl get all -n shop -l app.kubernetes.io/instance=web`.',
  },
  {
    id: 'dep-q10',
    domainId: 'deployment',
    topicId: 'helm-fundamentals',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You pass `-f values.yaml` containing `replicaCount: 5` and also `--set replicaCount=2`. How many replicas does the release get?',
    options: [
      { id: 'a', text: '5, because files override flags' },
      { id: 'b', text: '2, because --set has higher precedence' },
      { id: 'c', text: 'The install fails with a conflict' },
      { id: 'd', text: '7, because the values are added' },
    ],
    correct: ['b'],
    explanation:
      'Precedence from lowest to highest: chart `values.yaml`, then `-f` files (later files override earlier ones), then `--set`, then `--set-string`/`--set-file`. Confirm what a release actually used with `helm get values <release>`.',
  },
  {
    id: 'dep-q11',
    domainId: 'deployment',
    topicId: 'helm-fundamentals',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Write the Helm command that rolls release dash in namespace tools back to revision 3.',
    acceptedAnswers: [
      'helm rollback dash 3 -n tools',
      'helm rollback dash 3 --namespace tools',
      'helm -n tools rollback dash 3',
    ],
    answerHint: 'helm rollback ...',
    explanation:
      "Check the available revisions first with `helm history dash -n tools`. Unlike `kubectl rollout undo`, which restores one workload's Pod template, `helm rollback` restores every object in the release together - which is its main advantage.",
  },
  {
    id: 'dep-q12',
    domainId: 'deployment',
    topicId: 'kustomize-fundamentals',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the kubectl command that renders the Kustomize overlay in ./overlays/prod to stdout without applying it.',
    acceptedAnswers: [
      'kubectl kustomize ./overlays/prod',
      'kubectl kustomize overlays/prod',
      'kubectl kustomize ./overlays/prod/',
    ],
    answerHint: 'kubectl kustomize ...',
    explanation:
      'Note the two different forms: `kubectl kustomize <dir>` renders, while `kubectl apply -k <dir>` applies. Rendering first is the habit that catches most Kustomize mistakes before they reach the cluster.',
  },
  {
    id: 'dep-q13',
    domainId: 'deployment',
    topicId: 'kustomize-fundamentals',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'The base sets `image: registry.example.com/shop/api:1.4.0`. Which overlay fragment changes only the tag to 1.4.2 without a patch?',
    options: [
      { id: 'a', text: 'images:\n  - name: registry.example.com/shop/api\n    newTag: 1.4.2' },
      {
        id: 'b',
        text: 'images:\n  - name: registry.example.com/shop/api:1.4.0\n    newTag: 1.4.2',
      },
      { id: 'c', text: 'imageTags:\n  - name: api\n    tag: 1.4.2' },
      { id: 'd', text: 'patchesStrategicMerge:\n  - image.yaml' },
    ],
    correct: ['a'],
    explanation:
      '`name` matches the image name *without* the tag; `newTag` replaces the tag wherever that image appears in the build. Use `newName` as well if the repository changes. `patchesStrategicMerge` is deprecated in favour of the unified `patches` field, and is unnecessary here.',
  },
  {
    id: 'dep-q14',
    domainId: 'deployment',
    topicId: 'kustomize-fundamentals',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'An overlay uses `namePrefix: prod-` and a `replicas` entry with `name: prod-api`, but the replica count is not applied. Why?',
    options: [
      { id: 'a', text: '`replicas` only works on StatefulSets' },
      {
        id: 'b',
        text: 'Transformers match the original resource name, before namePrefix is applied',
      },
      { id: 'c', text: '`namePrefix` and `replicas` cannot be combined' },
      { id: 'd', text: 'The base must also declare a replicas entry' },
    ],
    correct: ['b'],
    explanation:
      'Transformers operate on the built output *before* `namePrefix` is added, so the entry must use `name: api`. The same applies to `patches` targets and `images` matches. Render with `kubectl kustomize` and check the resulting name - a silently ineffective transformer is almost always a name mismatch.',
  },
  {
    id: 'dep-q15',
    domainId: 'deployment',
    topicId: 'choosing-deployment-tooling',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which capability does Helm provide that Kustomize does not, and which does Kustomize provide that Helm does not?',
    options: [
      {
        id: 'a',
        text: 'Helm: whole-release rollback in one command. Kustomize: patching a field the chart author did not parameterise.',
      },
      { id: 'b', text: 'Helm: GitOps support. Kustomize: templating.' },
      { id: 'c', text: 'Helm: namespaced installs. Kustomize: cluster-scoped resources.' },
      { id: 'd', text: 'Helm: plain YAML output. Kustomize: conditionals and loops.' },
    ],
    correct: ['a'],
    explanation:
      '`helm rollback` restores every object in a release at once, which matters when an upgrade spans CRDs, RBAC and workloads. Kustomize can patch any field of any rendered object, whereas Helm can only change what the chart exposes as a value. Both are supported by Argo CD and Flux, and Kustomize has no conditionals or loops.',
  },
  {
    id: 'dep-q16',
    domainId: 'deployment',
    topicId: 'rolling-updates',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create a Deployment named api with 4 replicas of nginx:1.26-alpine, configured so that a rollout never reduces the number of available Pods below 4 and never runs more than 5 Pods. It must have a readiness probe on / port 80. Then update it to nginx:1.27-alpine, record the change cause "Upgrade to 1.27", and verify the rollout completed.',
    context: 'Namespace shop exists and has capacity for five small Pods.',
    checkpoints: [
      { id: 'c1', text: 'Deployment api exists in shop with 4 replicas and reports READY 4/4' },
      { id: 'c2', text: 'strategy.rollingUpdate has maxUnavailable 0 and maxSurge 1' },
      { id: 'c3', text: 'The container has a readinessProbe httpGet on / port 80' },
      { id: 'c4', text: 'The current image is nginx:1.27-alpine' },
      {
        id: 'c5',
        text: '`kubectl rollout history deploy/api -n shop` shows the change cause "Upgrade to 1.27"',
      },
    ],
    explanation:
      '`maxUnavailable: 0` with `maxSurge: 1` is the zero-downtime pair, and it is only meaningful with a readiness probe - otherwise "available" just means the process started. The `--record` flag no longer exists, so the change cause must be set with `kubectl annotate` (or in the manifest) using the `kubernetes.io/change-cause` annotation.',
    solution: [
      {
        title: 'Generate then edit',
        language: 'bash',
        code: `kubectl create deployment api --image=nginx:1.26-alpine --replicas=4 \\
  -n shop --dry-run=client -o yaml > api.yaml
# add strategy and the readiness probe, then apply`,
      },
      {
        title: 'api.yaml',
        language: 'yaml',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
  labels:
    app: api
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
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
            periodSeconds: 5`,
      },
      {
        title: 'Update, record and verify',
        language: 'bash',
        code: `kubectl apply -f api.yaml
kubectl rollout status deploy/api -n shop --timeout=120s

kubectl annotate deployment/api -n shop \\
  kubernetes.io/change-cause="Upgrade to 1.27" --overwrite
kubectl set image deploy/api nginx=nginx:1.27-alpine -n shop
kubectl rollout status deploy/api -n shop --timeout=120s

kubectl rollout history deploy/api -n shop
kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[0].image}{"\\n"}'
# nginx:1.27-alpine`,
      },
    ],
  },
  {
    id: 'dep-q17',
    domainId: 'deployment',
    topicId: 'deployment-strategies',
    category: 'lab',
    kind: 'task',
    difficulty: 'advanced',
    points: 4,
    prompt:
      'In namespace shop, set up a canary release: Deployment api-stable with 3 replicas of nginx:1.26-alpine and Deployment api-canary with 1 replica of nginx:1.27-alpine, both selected by a single Service named api on port 80, so roughly 25% of traffic reaches the canary.',
    context: 'Namespace shop exists.',
    checkpoints: [
      { id: 'c1', text: 'Both Deployments exist and are fully ready (3 and 1 replicas)' },
      {
        id: 'c2',
        text: 'Both Pod templates carry a shared label (for example app: api) plus a distinguishing track label',
      },
      {
        id: 'c3',
        text: 'Each Deployment selector includes its own track label so it owns only its own Pods',
      },
      {
        id: 'c4',
        text: 'Service api selects only the shared label, so it matches both Deployments',
      },
      { id: 'c5', text: '`kubectl get endpoints api -n shop` lists 4 addresses' },
    ],
    explanation:
      'The traffic split comes from the ratio of Ready Pods behind one Service - 1 of 4 is about 25%. It is statistical and connection-based rather than exact, and HTTP keep-alive can make a single test client appear to stick to one version. To shift the split, change the replica counts while keeping the total constant.',
    solution: [
      {
        title: 'canary.yaml',
        language: 'yaml',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-stable
  namespace: shop
spec:
  replicas: 3
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
        - name: nginx
          image: nginx:1.26-alpine
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet: { path: /, port: 80 }
            periodSeconds: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-canary
  namespace: shop
spec:
  replicas: 1
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
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet: { path: /, port: 80 }
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api # deliberately omits "track" so it matches BOTH
  ports:
    - port: 80
      targetPort: 80`,
      },
      {
        title: 'Verify the split',
        language: 'bash',
        code: `kubectl apply -f canary.yaml
kubectl rollout status deploy/api-stable -n shop --timeout=120s
kubectl rollout status deploy/api-canary -n shop --timeout=120s

kubectl get endpoints api -n shop
# four addresses: three stable, one canary

kubectl get pods -n shop -l app=api -L track
# TRACK column shows stable x3 and canary x1

# To move to 50%: kubectl scale deploy api-canary -n shop --replicas=2 &&
#                 kubectl scale deploy api-stable -n shop --replicas=2`,
      },
    ],
  },
  {
    id: 'dep-q18',
    domainId: 'deployment',
    topicId: 'rolling-updates',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A ConfigMap consumed as environment variables has changed. Write the command that recreates all Pods of Deployment api in namespace shop so they pick up the new values, without editing the Deployment.',
    acceptedAnswers: [
      'kubectl rollout restart deployment/api -n shop',
      'kubectl rollout restart deploy/api -n shop',
      'kubectl -n shop rollout restart deployment/api',
      'kubectl rollout restart deployment api -n shop',
    ],
    answerHint: 'kubectl rollout ...',
    explanation:
      'Environment variables are resolved when a container starts and cannot change in a running process, so the Pods must be recreated. `kubectl rollout restart` stamps a new annotation on the Pod template, which triggers a normal rolling update - unlike `kubectl delete pod`, which drops capacity abruptly.',
  },
]
