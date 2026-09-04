import type { Topic } from '../../../types'

export const kubectlBasics: Topic = {
  id: 'kubectl-basics',
  title: 'kubectl basics: get, describe, create, apply, delete',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 25,
  order: 3,
  tags: ['kubectl', 'get', 'describe', 'apply', 'delete', 'output formats'],
  oneLiner:
    'The eight kubectl verbs that cover almost every exam task, plus the output formats that turn kubectl into a query tool.',
  explanation: [
    '`kubectl` is a thin HTTP client for the Kubernetes API. Every command becomes a REST call: `kubectl get pods -n shop` is a GET on `/api/v1/namespaces/shop/pods`. Nothing runs locally except the formatting.',
    'The command shape is always the same: `kubectl <verb> <resource-type> [name] [flags]`. Resource types accept short names (`po`, `deploy`, `svc`, `cm`, `sa`, `pvc`, `ns`) and are case-insensitive, singular or plural.',
    'Eight verbs will carry you through CKAD: `get` (list/read), `describe` (human-readable detail plus events), `create` (make new), `apply` (create or update from a file), `edit` (open in $EDITOR and save back), `delete`, `logs`, and `exec`. Add `explain`, `run`, `expose`, `scale` and `rollout` and you have the whole exam surface.',
    'Output formats are what make kubectl fast: `-o wide` adds columns, `-o yaml` dumps the whole stored object, `-o jsonpath=...` extracts one value, and `-o custom-columns=...` builds a table. `--dry-run=client -o yaml` generates a manifest without touching the cluster, which is the single most valuable habit for the exam.',
  ],
  whyItMatters: [
    'CKAD is two hours of typing. The difference between passing and running out of time is almost entirely kubectl fluency, not Kubernetes knowledge.',
    'Generating YAML with `--dry-run=client -o yaml` instead of typing manifests from memory removes indentation mistakes, which are the most common self-inflicted failure.',
    '`describe` is the fastest diagnostic in the product. It resolves the object, shows container state, and appends the events - three separate API calls you would otherwise make by hand.',
  ],
  howItWorks: [
    'kubectl reads its connection details from a kubeconfig file, by default `~/.kube/config`, or from `$KUBECONFIG`. It picks the current-context from that file unless you pass `--context`.',
    '`create` fails if the object exists. `apply` performs a three-way merge between your file, the live object and the previously applied configuration, so it is idempotent and safe to re-run.',
    '`apply` records what you sent in the `kubectl.kubernetes.io/last-applied-configuration` annotation. That is how it knows a field you removed from your file should be removed from the object.',
    '`--dry-run=client` renders the object locally and never contacts the cluster for validation. `--dry-run=server` sends it to the API server, which runs full validation and admission, then discards it - use it when you want real validation.',
    'Deletion is asynchronous: the object gets a `deletionTimestamp` and terminates gracefully within `terminationGracePeriodSeconds` (30 by default). `--force --grace-period=0` skips that wait but can leave a container running - avoid it unless a task demands speed.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'The shape of every kubectl command',
      caption:
        'Once you see the five slots, unfamiliar commands stop being unfamiliar - they are the same slots with different values.',
      root: {
        label: 'kubectl <verb> <type> <name> <flags>',
        children: [
          {
            label: 'verb',
            detail: 'get, describe, create, apply, delete, logs, exec',
            tone: 'accent',
          },
          {
            label: 'type',
            detail: 'pod, deploy, svc, cm - see kubectl api-resources',
          },
          { label: 'name', detail: 'Optional. Omit it to act on all of that type.' },
          {
            label: 'scope flags',
            detail: '-n <namespace>, -A for every namespace',
            tone: 'warning',
          },
          {
            label: 'output flags',
            detail: '-o yaml, -o wide, -o jsonpath=..., --show-labels',
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'What to reach for first',
      caption:
        'get to see it, describe to understand it, logs to hear from the app, explain to write the YAML.',
      nodes: [
        {
          label: 'kubectl get',
          detail: 'Is it there, and what state is it in?',
          tone: 'accent',
        },
        {
          label: 'kubectl describe',
          detail: 'Why is it in that state? Events live here.',
          arrowLabel: 'state looks wrong',
        },
        {
          label: 'kubectl logs',
          detail: 'What does the application itself say?',
          arrowLabel: 'the object looks fine',
        },
        {
          label: 'kubectl explain',
          detail: 'Which field do I need in order to fix it?',
          arrowLabel: 'now write the change',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Config (kubeconfig)',
      apiVersion: 'v1',
      purpose:
        'Local file describing clusters, users and contexts. Not stored in the cluster - it is how kubectl knows where to connect and as whom.',
      fields: [
        { path: 'clusters[].cluster.server', meaning: 'API server URL.' },
        {
          path: 'contexts[].context.namespace',
          meaning: 'Default namespace for that context - set this and stop typing -n.',
        },
        { path: 'current-context', meaning: 'Which context is active right now.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Two minutes saved on every single task',
    story: [
      'A candidate needs a Deployment with a specific environment variable, a resource request, and a readiness probe. Typing that YAML from memory takes four minutes and usually produces one indentation error.',
      'The fast route is to generate the skeleton and then edit only what the task asks for: `kubectl create deployment api --image=nginx:1.27-alpine --dry-run=client -o yaml > api.yaml`, open it, add the three fields, apply.',
      'The generated file is guaranteed to have correct `apiVersion`, `kind`, matching selector and template labels - the parts people get wrong - so the only thing left is the interesting bit.',
      'Across sixteen exam tasks this habit is worth roughly half an hour, which is the margin most people are missing.',
    ],
    code: [
      {
        title: 'Generate, edit, apply',
        language: 'bash',
        code: `# 1. Generate a correct skeleton without touching the cluster
kubectl create deployment api --image=nginx:1.27-alpine \\
  --replicas=2 --dry-run=client -o yaml > api.yaml

# 2. Add only what the task requires
vi api.yaml

# 3. Apply and confirm
kubectl apply -f api.yaml
kubectl rollout status deploy/api --timeout=60s
# deployment "api" successfully rolled out`,
        explanation:
          'Every generator flag you use is one less line you can get wrong. --dry-run=client means step 1 works even if the cluster is busy.',
        placeholders: ['api'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'What --dry-run=client -o yaml actually produces',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    app: api
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: api
    spec:
      containers:
        - image: nginx:1.27-alpine
          name: nginx
          resources: {}
status: {}`,
      explanation:
        'The noise (creationTimestamp: null, strategy: {}, resources: {}, status: {}) is harmless and can be left in place - graders check behaviour, not tidiness. Note the selector and template labels already match.',
    },
  ],
  imperative: [
    {
      command: 'kubectl get pods -n shop -o wide',
      what: 'Lists Pods with extra columns: IP, node, nominated node and readiness gates.',
      expected: 'One row per Pod including an IP and NODE column.',
      namespaceNote: 'Add -A / --all-namespaces to search the whole cluster.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe deploy api -n shop',
      what: 'Human-readable detail: replicas, strategy, Pod template, conditions, and the ReplicaSet events.',
      expected: 'Sections ending with Events and OldReplicaSets/NewReplicaSet lines.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl apply -f api.yaml -n shop',
      what: 'Creates the object, or updates an existing one to match the file. Safe to run repeatedly.',
      expected: 'deployment.apps/api created (first run) or configured (subsequent runs).',
      placeholders: ['api.yaml', 'shop'],
    },
    {
      command: 'kubectl edit deploy api -n shop',
      what: 'Opens the live object in $EDITOR; saving applies the change immediately.',
      expected: 'deployment.apps/api edited, or "Edit cancelled, no changes made."',
      namespaceNote: 'Edits apply to the object in the namespace you name.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get pods -n shop -o jsonpath=\'{.items[*].spec.containers[*].image}{"\\n"}\'',
      what: 'Extracts every container image in the namespace as a space-separated list.',
      expected: 'nginx:1.27-alpine redis:7.2-alpine',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl delete pod web -n shop --grace-period=30',
      what: 'Deletes a Pod, allowing 30 seconds for graceful shutdown.',
      expected: 'pod "web" deleted',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get deploy api -n shop -o yaml > api-backup.yaml',
      what: 'Saves the live object before you edit it - your undo button in the exam.',
      expected: 'A file you can re-apply with kubectl apply -f api-backup.yaml.',
      placeholders: ['api', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate a skeleton with a generator plus `--dry-run=client -o yaml`.',
      'Edit the file to add the fields the task requires.',
      'Apply with `kubectl apply -f`, and keep the file - re-applying is how you fix mistakes.',
      'Verify with `kubectl get`/`describe`, not by assuming the apply succeeded.',
    ],
    code: [
      {
        title: 'Declarative workflow end to end',
        language: 'bash',
        code: `kubectl create deployment web --image=nginx:1.27-alpine \\
  --dry-run=client -o yaml > web.yaml

# Validate against the real API without creating anything
kubectl apply -f web.yaml --dry-run=server
# deployment.apps/web created (server dry run)

kubectl apply -f web.yaml
kubectl get deploy web -o wide`,
        placeholders: ['web'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get deploy api -n shop',
      what: 'Confirms the Deployment exists and how many replicas are ready.',
      expected: 'READY 2/2, UP-TO-DATE 2, AVAILABLE 2.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get pods -n shop --show-labels',
      what: 'Adds a LABELS column, which is how you confirm selectors will match.',
      expected: 'app=api,pod-template-hash=... on each Pod.',
      placeholders: ['shop'],
    },
    {
      command:
        "kubectl get deploy api -n shop -o custom-columns='NAME:.metadata.name,REPLICAS:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image'",
      what: 'Builds exactly the table you need to prove a task is done.',
      expected: 'NAME api, REPLICAS 2, IMAGE nginx:1.27-alpine.',
      placeholders: ['api', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get pods -n shop --sort-by=.status.startTime',
      what: 'Orders Pods by start time so the newest problem is at the bottom.',
      expected: 'Chronological list.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl apply -f broken.yaml --dry-run=server',
      what: 'Runs full server-side validation without creating anything - the fastest way to find a bad field name.',
      expected:
        'Either "(server dry run)" or a precise error such as: error validating data: unknown field "spec.replica".',
      placeholders: ['broken.yaml'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector involvedObject.name=api-7d9f8b6c4-xk2mq',
      what: 'Filters events down to one object instead of scrolling the whole namespace.',
      expected: 'Only events referring to that Pod.',
      placeholders: ['shop', 'api-7d9f8b6c4-xk2mq'],
    },
    {
      command: 'kubectl config view --minify',
      what: 'Shows the cluster, user and namespace kubectl is actually using - run this when commands "work" but change nothing you can see.',
      expected: 'A short YAML block with one cluster, one context and one user.',
    },
  ],
  commonMistakes: [
    'Using `create` where the task expects an update. `create` errors with "already exists"; `apply` is idempotent.',
    'Typing `--dry-run` alone. Bare `--dry-run` is deprecated; always write `--dry-run=client` or `--dry-run=server`.',
    'Forgetting `-o yaml` after `--dry-run=client`, which prints only a confirmation line instead of a manifest.',
    'Editing an object with `kubectl edit` and losing the change because a controller owns the field (for example editing a Pod owned by a Deployment).',
    'Using `-o json`/`-o yaml` and then reading with the eye when `-o jsonpath` would answer the question in one line.',
    'Assuming `kubectl delete -f file.yaml` removes everything you applied. It removes only the objects described in that file.',
  ],
  examTips: [
    'Set up aliases in the first 60 seconds: `alias k=kubectl`, and export `do="--dry-run=client -o yaml"` so you can type `k create deploy api --image=nginx $do`.',
    'Use `kubectl explain <resource>.<field> --recursive` instead of guessing field names - it is allowed and much faster than searching the docs.',
    'Before any risky `kubectl edit`, dump the object: `kubectl get <kind> <name> -o yaml > backup.yaml`.',
    'Prefer `--dry-run=server` when a task involves an unfamiliar field: it catches typos the client-side check cannot.',
    'Remember `kubectl get <kind> <name> -o yaml` is always available as documentation of a working object.',
  ],
  summary: [
    'kubectl is an HTTP client; the command shape is always verb → type → name → flags.',
    'get, describe, create, apply, edit, delete, logs, exec cover nearly every task.',
    '`--dry-run=client -o yaml` generates correct manifests and is the biggest single time saver on the exam.',
    'jsonpath and custom-columns turn kubectl into a query tool for verification.',
  ],
  practice: [
    {
      id: 'kubectl-p1',
      level: 'beginner',
      prompt:
        'Write the command that creates a Pod manifest for image `redis:7.2-alpine` named `cache` in a file called `cache.yaml`, without creating anything in the cluster.',
      answer: 'kubectl run cache --image=redis:7.2-alpine --dry-run=client -o yaml > cache.yaml',
      explanation:
        '`kubectl run` is the Pod generator. `--dry-run=client` keeps it local, `-o yaml` prints the manifest, and the redirect saves it.',
    },
    {
      id: 'kubectl-p2',
      level: 'intermediate',
      prompt:
        'You applied a Deployment and want to know only the image of its first container, with no other output. Write the command.',
      answer:
        'kubectl get deploy api -n shop -o jsonpath=\'{.spec.template.spec.containers[0].image}{"\\n"}\'',
      explanation:
        'Note the path goes through `.spec.template.spec` because the container lives in the Pod template, not on the Deployment directly. The trailing newline directive in the jsonpath expression is what stops the output running into your next prompt.',
    },
    {
      id: 'kubectl-p3',
      level: 'advanced',
      prompt:
        'A task says "update the api Deployment in namespace shop to image nginx:1.27" and asks you to record nothing else. Give two correct one-line ways to do it and say which is safer under time pressure.',
      answer:
        'Either:\n1. `kubectl set image deploy/api nginx=nginx:1.27 -n shop`\n2. `kubectl edit deploy api -n shop` and change the image by hand.\n\n`kubectl set image` is safer: it is one line, cannot introduce YAML indentation errors, and triggers the rollout immediately.',
      explanation:
        "`kubectl set image` needs the *container* name (here `nginx`, the default name generated by `kubectl create deployment`). Check it first with `kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[*].name}'`.",
    },
  ],
  lab: {
    title: 'Build the same object three ways',
    scenario:
      'You will create one Deployment imperatively, once from generated YAML, and then update it declaratively - the exact loop you will repeat all through the exam.',
    prerequisites: ['A cluster and a shell with kubectl'],
    tasks: [
      { instruction: 'Create namespace `kb-lab` and set it as your current namespace.' },
      {
        instruction: 'Create a Deployment `web1` imperatively: 2 replicas of `nginx:1.27-alpine`.',
      },
      {
        instruction:
          'Generate (do not apply) a manifest for a Deployment `web2` with 3 replicas of the same image, save it as `web2.yaml`, then apply it.',
      },
      {
        instruction:
          'Add the label `tier=frontend` to the `web2` Pod template by editing the file and re-applying.',
      },
      {
        instruction: 'Print a two-column table of both Deployments showing name and replica count.',
      },
      { instruction: 'Back up `web2` to a file, delete it, then restore it from the backup.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3',
        language: 'bash',
        code: `kubectl create namespace kb-lab
kubectl config set-context --current --namespace=kb-lab

# Imperative
kubectl create deployment web1 --image=nginx:1.27-alpine --replicas=2

# Generated, then applied
kubectl create deployment web2 --image=nginx:1.27-alpine --replicas=3 \\
  --dry-run=client -o yaml > web2.yaml
kubectl apply -f web2.yaml`,
      },
      {
        title: 'Step 4 - edit the file, not the cluster',
        language: 'yaml',
        code: `# web2.yaml, after adding the label
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: web2
  name: web2
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web2 # selector is immutable - do NOT add tier here
  template:
    metadata:
      labels:
        app: web2
        tier: frontend # new label on the Pods
    spec:
      containers:
        - image: nginx:1.27-alpine
          name: nginx`,
      },
      {
        title: 'Steps 4b-5 - re-apply and verify',
        language: 'bash',
        code: `kubectl apply -f web2.yaml
# deployment.apps/web2 configured   <- "configured", not "created"

kubectl get pods -l tier=frontend --show-labels

kubectl get deploy -o custom-columns='NAME:.metadata.name,REPLICAS:.spec.replicas'
# NAME   REPLICAS
# web1   2
# web2   3`,
      },
      {
        title: 'Step 6 - backup, delete, restore',
        language: 'bash',
        code: `kubectl get deploy web2 -o yaml > web2-backup.yaml
kubectl delete deploy web2
kubectl get deploy
# only web1 remains

kubectl apply -f web2-backup.yaml
kubectl rollout status deploy/web2 --timeout=60s
# deployment "web2" successfully rolled out`,
      },
      {
        title: 'Step 7 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace kb-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get deploy -n kb-lab',
        what: 'Both Deployments should be fully ready.',
        expected: 'web1 2/2 and web2 3/3.',
      },
      {
        command:
          'kubectl get deploy web2 -n kb-lab -o jsonpath=\'{.spec.template.metadata.labels.tier}{"\\n"}\'',
        what: 'Confirms the Pod-template label survived the restore.',
        expected: 'frontend',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace kb-lab',
        what: 'Removes the lab namespace.',
        expected: 'namespace "kb-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['contexts-and-namespaces', 'imperative-vs-declarative', 'efficient-kubectl'],
  docs: [
    { title: 'kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
    {
      title: 'kubectl cheat sheet',
      url: 'https://kubernetes.io/docs/reference/kubectl/quick-reference/',
    },
  ],
}
