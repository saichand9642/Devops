import type { Topic } from '../../../types'

export const imperativeVsDeclarative: Topic = {
  id: 'imperative-vs-declarative',
  title: 'Imperative versus declarative management',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 18,
  order: 5,
  tags: ['imperative', 'declarative', 'apply', 'create', 'replace', 'dry-run', 'generators'],
  oneLiner:
    'When to fire a one-line command and when to write a file, plus the hybrid workflow that is fastest under exam conditions.',
  explanation: [
    '**Imperative** means you tell the cluster what to *do*: `kubectl create deployment`, `kubectl scale`, `kubectl set image`, `kubectl expose`, `kubectl delete`. It is fast and needs no file, but the intent lives only in your shell history.',
    '**Declarative** means you tell the cluster what you *want*, in a file, and let `kubectl apply` work out the difference: create it, change it, or leave it alone. The file is the source of truth and can be re-applied any number of times.',
    'There is also an in-between, sometimes called *imperative object configuration*: `kubectl create -f file.yaml` and `kubectl replace -f file.yaml`. These act on a file but are not idempotent - `create` fails if the object exists, and `replace` overwrites everything, discarding fields you left out.',
    'The winning exam workflow is a hybrid: use an imperative generator with `--dry-run=client -o yaml` to produce a correct skeleton, edit the file for the parts the generator cannot express, then `kubectl apply -f`. You get imperative speed with declarative correctness.',
  ],
  whyItMatters: [
    'Some exam tasks can be done in one imperative line (scale a Deployment, expose a Service, create a ConfigMap from literals). Recognising those saves minutes.',
    'Other tasks need fields no generator supports - probes, resource limits, security contexts, volumes. Trying to force those imperatively wastes time; generate and edit instead.',
    'Knowing that `apply` is idempotent and `replace` is destructive prevents the classic accident where re-applying a trimmed file silently removes probes or environment variables.',
  ],
  howItWorks: [
    '`kubectl apply` performs a three-way merge across your file, the live object, and the `kubectl.kubernetes.io/last-applied-configuration` annotation. That annotation is how apply knows the difference between "field I never mentioned" (leave it) and "field I removed" (delete it).',
    '`kubectl create` is a plain POST. If the object exists you get `AlreadyExists`.',
    '`kubectl replace` is a PUT of the whole object; anything absent from your file is removed. `kubectl replace --force` deletes and recreates, which changes the object UID and restarts Pods.',
    'Imperative generators exist for a fixed set of objects: `run` (Pod), `create deployment|job|cronjob|configmap|secret|service|serviceaccount|role|rolebinding|clusterrole|clusterrolebinding|namespace|quota|ingress`, plus `expose`, `scale`, `set image|env|resources|serviceaccount`, `label`, `annotate`, and `autoscale`.',
    'Server-side apply (`kubectl apply --server-side`) moves the merge to the API server and tracks field ownership, which matters when several controllers manage one object. It is good to know exists; CKAD rarely requires it.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Imperative, declarative, or both?',
      caption:
        'In the exam the answer is almost always "both": generate with a command, then edit the YAML.',
      question: 'What does the task ask for?',
      branches: [
        {
          condition: 'a simple object with no unusual fields',
          result: 'Imperative only',
          detail: 'kubectl create or kubectl run, done in one line',
        },
        {
          condition: 'fields no flag can set',
          result: 'Generate, then edit',
          detail: '--dry-run=client -o yaml > file, edit, kubectl apply -f',
          tone: 'accent',
        },
        {
          condition: 'the object already exists and must change',
          result: 'kubectl edit, or apply an updated file',
          detail: 'kubectl set image and scale also work in place',
        },
        {
          condition: 'you must show or keep the manifest',
          result: 'Declarative only',
          detail: 'Write the file, apply it, keep it',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'The generate-then-edit loop',
      caption:
        'This is the single highest-value habit for the exam: never hand-write YAML you could have generated.',
      nodes: [
        {
          label: 'Pick the closest generator',
          detail: 'kubectl create deployment, run, create job, expose',
        },
        {
          label: 'Add --dry-run=client -o yaml',
          detail: 'Builds the object locally, sends nothing to the cluster',
          arrowLabel: 'do not apply yet',
          tone: 'accent',
        },
        { label: 'Redirect to a file', detail: '> app.yaml', arrowLabel: 'save it' },
        {
          label: 'Edit only what the task needs',
          detail: 'Add probes, volumes, resources, securityContext',
        },
        {
          label: 'kubectl apply -f app.yaml',
          detail: 'Object created, file kept as evidence',
          tone: 'success',
          branch: {
            label: 'Validation error',
            detail: 'Read the field path in the message, fix, apply again',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Any object',
      apiVersion: 'varies',
      purpose:
        'The annotation that makes declarative apply work. Worth recognising when you dump an object with -o yaml.',
      fields: [
        {
          path: 'metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"]',
          meaning: 'A JSON copy of the last manifest you applied, used for the three-way merge.',
        },
        {
          path: 'metadata.managedFields[]',
          meaning: 'Server-side apply ownership tracking: which controller owns which field.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The re-apply that deleted the probes',
    story: [
      'A team creates a Deployment declaratively with a readiness probe and resource limits. Later, someone regenerates a fresh skeleton with `kubectl create deployment ... --dry-run=client -o yaml > api.yaml` to "start clean", and applies it.',
      'Because the new file never mentions the probe, and the old annotation says the probe was previously applied, `apply` removes it. Traffic starts hitting Pods before they are ready, and the team sees intermittent 502s.',
      'The lesson is not "avoid apply" - it is "keep one authoritative file per object". Regenerate skeletons into a scratch file, copy the pieces you need into the real one, and never apply a file that is less complete than the live object.',
      'The recovery: `kubectl rollout undo deploy/api` restores the previous Pod template immediately, then fix the file properly.',
    ],
    code: [
      {
        title: 'Detect the difference before you apply',
        language: 'bash',
        code: `# Show what apply *would* change, without changing anything
kubectl diff -f api.yaml
# - readinessProbe:
# -   httpGet:
# -     path: /healthz
# -     port: 8080
#
# A leading "-" means apply will REMOVE that field.`,
        explanation:
          'kubectl diff is the safest single habit in declarative management: it renders the exact server-side result of your apply.',
        placeholders: ['api.yaml'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The same result, three ways',
      language: 'bash',
      code: `# 1. Purely imperative - fast, no file, intent not recorded
kubectl create deployment web --image=nginx:1.27-alpine --replicas=3 -n shop

# 2. Imperative object configuration - a file, but not idempotent
kubectl create -f web.yaml -n shop     # fails second time: AlreadyExists
kubectl replace -f web.yaml -n shop    # overwrites everything in the object

# 3. Declarative - idempotent, safe to repeat, diffable
kubectl apply -f web.yaml -n shop      # created, then configured, then unchanged`,
      explanation:
        'Only option 3 can be run repeatedly with a predictable result, which is why it is the default choice for anything you will touch more than once.',
      placeholders: ['web', 'shop', 'web.yaml'],
    },
    {
      title: 'Generated skeleton plus the fields only YAML can express',
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
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          # Everything below here has no imperative generator flag:
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi`,
      explanation:
        'This is the hybrid workflow in one file: the top half came from a generator, the bottom half was typed by hand because probes and resources have no create-time flags.',
      placeholders: ['api', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl scale deployment api --replicas=5 -n shop',
      what: 'Changes the replica count immediately, with no file involved.',
      expected: 'deployment.apps/api scaled',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl set image deployment/api api=nginx:1.27 -n shop',
      what: 'Updates one container image and triggers a rolling update. `api=` is the container name, not the Deployment name.',
      expected: 'deployment.apps/api image updated',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl expose deployment api --port=80 --target-port=8080 --name=api -n shop',
      what: "Creates a ClusterIP Service whose selector is copied from the Deployment's Pod labels.",
      expected: 'service/api exposed',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl create configmap app-config --from-literal=LOG_LEVEL=debug -n shop',
      what: 'Creates a ConfigMap from key/value pairs on the command line - much faster than writing YAML.',
      expected: 'configmap/app-config created',
      placeholders: ['app-config', 'shop'],
    },
    {
      command: 'kubectl label deployment api tier=backend -n shop',
      what: 'Adds or changes a label on an existing object in place.',
      expected: 'deployment.apps/api labeled',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl create job manual-run --from=cronjob/nightly-report -n shop',
      what: 'Creates a one-off Job from an existing CronJob - a purely imperative capability with no declarative equivalent.',
      expected: 'job.batch/manual-run created',
      placeholders: ['manual-run', 'nightly-report', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate a skeleton: `kubectl create <kind> <name> ... --dry-run=client -o yaml > obj.yaml`.',
      'Edit the file to add fields the generator cannot express (probes, resources, volumes, securityContext).',
      'Preview with `kubectl diff -f obj.yaml` when the object already exists.',
      'Apply with `kubectl apply -f obj.yaml` and verify with `kubectl get`/`rollout status`.',
      'Keep the file as the authoritative copy; never apply a file less complete than the live object.',
    ],
    code: [
      {
        title: 'Hybrid workflow, start to finish',
        language: 'bash',
        code: `kubectl create deployment api --image=nginx:1.27-alpine --replicas=3 \\
  --dry-run=client -o yaml > api.yaml

# add probes / resources / env by hand
vi api.yaml

kubectl diff -f api.yaml          # nothing yet - object does not exist
kubectl apply -f api.yaml
kubectl rollout status deploy/api --timeout=90s
kubectl get deploy api -o wide`,
        placeholders: ['api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl diff -f api.yaml',
      what: 'Shows exactly what an apply would change. No output means the cluster already matches the file.',
      expected: 'Empty output when in sync.',
      placeholders: ['api.yaml'],
    },
    {
      command:
        "kubectl get deploy api -n shop -o jsonpath='{.metadata.annotations.kubectl\\.kubernetes\\.io/last-applied-configuration}' | head -c 200",
      what: 'Confirms the object is under declarative management and shows the recorded manifest.',
      expected: 'A JSON fragment starting {"apiVersion":"apps/v1"...',
      placeholders: ['api', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl apply -f api.yaml --dry-run=server',
      what: 'Full server-side validation without persisting - catches unknown fields and admission rejections.',
      expected: '"(server dry run)" on success, or a precise validation error.',
      placeholders: ['api.yaml'],
    },
    {
      command: 'kubectl replace -f api.yaml --force',
      what: 'Deletes and recreates the object. Use only when a field is immutable (for example a Deployment selector or a Job template).',
      expected:
        'deployment.apps/api deleted then replaced. Pods restart, so avoid on anything live.',
      placeholders: ['api.yaml'],
    },
    {
      command: 'kubectl rollout undo deployment/api -n shop',
      what: 'Recovers the previous Pod template after a bad apply removed fields.',
      expected: 'deployment.apps/api rolled back',
      placeholders: ['api', 'shop'],
    },
  ],
  commonMistakes: [
    'Applying a regenerated skeleton over a richer live object, silently deleting probes, env vars or resources.',
    'Using `kubectl create -f` for a re-run and hitting AlreadyExists when `apply` would have worked.',
    'Using `kubectl replace -f` with a partial file and losing every field you did not include.',
    'Trying to set a probe or a volume with imperative flags - they do not exist. Generate and edit instead.',
    'Forgetting that `kubectl set image` takes the **container** name on the left of the `=`, not the Deployment name.',
    'Editing an object with `kubectl edit` and forgetting to update the file, so the next apply reverts your change.',
  ],
  examTips: [
    'Ask yourself once per task: "is there a one-line imperative command for this?" Scale, expose, set image, create configmap/secret, label and annotate all have one.',
    'For anything with probes, resources, volumes, securityContext or multiple containers, go straight to generate-and-edit.',
    'Never type `apiVersion`/`kind`/`selector` by hand if a generator can produce them.',
    '`kubectl replace --force -f` is your escape hatch when the API refuses an immutable-field change - remember it exists.',
    'If a task says "without deleting the Deployment", `replace --force` is disqualified.',
  ],
  summary: [
    'Imperative = tell it what to do; fastest for simple, one-shot changes.',
    'Declarative = tell it what you want in a file; idempotent, diffable, safe to repeat.',
    'Hybrid (generate → edit → apply) is the fastest reliable route on the exam.',
    '`apply` merges, `create` fails on existing, `replace` overwrites, `replace --force` recreates.',
  ],
  practice: [
    {
      id: 'impdec-p1',
      level: 'beginner',
      prompt:
        'Give the fastest command to change Deployment `web` in namespace `shop` from 2 replicas to 6, without editing a file.',
      answer: 'kubectl scale deployment web --replicas=6 -n shop',
      explanation:
        'Purely imperative and instant. If the Deployment is managed by a file you also keep in git, remember to update `spec.replicas` there or the next apply will scale it back.',
    },
    {
      id: 'impdec-p2',
      level: 'intermediate',
      prompt:
        'Why can `kubectl apply -f` remove a field you never mentioned, and what command shows you that in advance?',
      answer:
        'Because apply does a three-way merge using the `last-applied-configuration` annotation: a field present in the previous applied config but absent from your new file is treated as deliberately removed. `kubectl diff -f <file>` shows the removal as a `-` line before you apply.',
      explanation:
        'Fields set by other means (a controller, or `kubectl set`) and never present in an applied file are left alone - only previously-applied fields get removed.',
    },
    {
      id: 'impdec-p3',
      level: 'advanced',
      prompt:
        'You must change the `spec.selector` of an existing Deployment. `kubectl apply` fails with an immutable-field error. What are your options, and what side effect must you accept?',
      answer:
        'Either `kubectl replace --force -f deploy.yaml` (deletes and recreates the Deployment) or delete and re-create manually. Side effect: the Deployment gets a new UID, all Pods are recreated, and there is a brief outage with no rolling update.',
      explanation:
        'Selectors are immutable by design because changing one would orphan the existing ReplicaSet. If a task forbids downtime, create a second Deployment with the new selector and shift traffic with the Service instead.',
    },
  ],
  lab: {
    title: 'Feel the difference between apply, create and replace',
    scenario:
      'You will build the same Deployment imperatively and declaratively, watch `apply` silently delete a field, recover with a rollback, and confirm why `replace` is dangerous with a partial file.',
    prerequisites: ['A cluster you can create Deployments in'],
    tasks: [
      { instruction: 'Create namespace `id-lab` and set it as your default.' },
      {
        instruction:
          'Generate `api.yaml` for a Deployment `api` with 2 replicas of `nginx:1.27-alpine`, add a readiness probe on `/` port 80, and apply it.',
      },
      { instruction: 'Confirm the probe exists on the live object.' },
      {
        instruction:
          'Regenerate a bare skeleton over `api.yaml` (no probe), run `kubectl diff`, and confirm it reports the probe being removed.',
      },
      {
        instruction:
          'Apply the bare file, prove the probe is gone, then restore it with `kubectl rollout undo`.',
      },
      { instruction: 'Run `kubectl create -f api.yaml` and observe the AlreadyExists error.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2',
        language: 'bash',
        code: `kubectl create namespace id-lab
kubectl config set-context --current --namespace=id-lab

kubectl create deployment api --image=nginx:1.27-alpine --replicas=2 \\
  --dry-run=client -o yaml > api.yaml`,
      },
      {
        title: 'Step 2b - api.yaml with the probe added',
        language: 'yaml',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: api
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - image: nginx:1.27-alpine
          name: nginx
          readinessProbe: # added by hand
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 2
            periodSeconds: 5`,
      },
      {
        title: 'Steps 2c-3 - apply and confirm',
        language: 'bash',
        code: `kubectl apply -f api.yaml
kubectl rollout status deploy/api --timeout=90s

kubectl get deploy api -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}{"\\n"}'
# /`,
      },
      {
        title: 'Step 4 - the destructive regeneration',
        language: 'bash',
        code: `kubectl create deployment api --image=nginx:1.27-alpine --replicas=2 \\
  --dry-run=client -o yaml > api.yaml     # probe is gone from the file

kubectl diff -f api.yaml
# -          readinessProbe:
# -            httpGet:
# -              path: /
# -              port: 80
# The "-" lines are what apply will delete.`,
      },
      {
        title: 'Step 5 - apply, observe, recover',
        language: 'bash',
        code: `kubectl apply -f api.yaml
kubectl get deploy api -o jsonpath='{.spec.template.spec.containers[0].readinessProbe}{"\\n"}'
# (empty - the probe really was removed)

kubectl rollout undo deployment/api
kubectl rollout status deploy/api --timeout=90s
kubectl get deploy api -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}{"\\n"}'
# /   <- restored`,
      },
      {
        title: 'Steps 6-7 - create vs apply, then clean up',
        language: 'bash',
        code: `kubectl create -f api.yaml
# Error from server (AlreadyExists): error when creating "api.yaml":
# deployments.apps "api" already exists

kubectl config set-context --current --namespace=default
kubectl delete namespace id-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get deploy api -n id-lab -o jsonpath=\'{.spec.template.spec.containers[0].readinessProbe.httpGet.path}{"\\n"}\'',
        what: 'Proves whether the readiness probe is currently present on the live object.',
        expected: '/ when present, empty when apply removed it.',
      },
      {
        command: 'kubectl rollout history deployment/api -n id-lab',
        what: 'Shows the revisions created by the apply and the undo.',
        expected: 'At least two revisions listed.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace id-lab',
        what: 'Removes the lab namespace.',
        expected: 'namespace "id-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['kubectl-basics', 'yaml-and-api-discovery', 'rolling-updates'],
  docs: [
    {
      title: 'Declarative management with configuration files',
      url: 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/',
    },
    {
      title: 'Imperative management',
      url: 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/imperative-command/',
    },
  ],
}
