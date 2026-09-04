import type { Topic } from '../../../types'

export const choosingDeploymentTooling: Topic = {
  id: 'choosing-deployment-tooling',
  title: 'Choosing between Helm, Kustomize and plain manifests',
  domainId: 'deployment',
  difficulty: 'intermediate',
  estimatedMinutes: 14,
  order: 6,
  tags: ['helm', 'kustomize', 'manifests', 'gitops', 'decision', 'tooling'],
  oneLiner:
    'A decision procedure for the three ways of shipping Kubernetes YAML, and what each one actually costs you.',
  explanation: [
    'All three approaches end in the same place: manifests applied through the API server. They differ in how the manifests are produced and who owns the customisation.',
    '**Plain manifests** (`kubectl apply -f`) are the simplest thing that works. Nothing to learn, nothing to install, and the file is exactly what the cluster gets. The cost is duplication: three environments means three copies, or a pile of `sed`.',
    '**Kustomize** keeps plain YAML and layers declarative transformations on top. There is no templating language, the base stays independently deployable, and it is built into kubectl. The cost is that it can only transform what is already there - it cannot express conditional logic or loops.',
    '**Helm** is a package manager with a templating language. It is the right tool for *distributing* software to people whose environments you do not know, and the standard way to *consume* third-party software. The cost is a templating language between you and the YAML, plus release state stored in the cluster.',
    'These are not exclusive. A very common real-world combination is Helm for third-party dependencies and Kustomize (or plain manifests) for your own applications.',
  ],
  whyItMatters: [
    'The curriculum names both Helm and Kustomize, and a task may ask you to reason about which one to use, or hand you an existing setup in one of them.',
    'Choosing the heaviest tool by default is a real cost: a templated chart for one application in one cluster adds indirection without adding capability.',
    'Knowing what each tool cannot do prevents you from fighting it - Kustomize has no conditionals, Helm has no first-class notion of "just patch this one field".',
  ],
  howItWorks: [
    'Decision procedure. Are you consuming software someone else packaged? → Helm, because that is how it is distributed. Are you shipping software for strangers to install? → Helm, because they need values, not patches. Do you deploy your own app to several environments that differ in a bounded, declarative way? → Kustomize. One app, one environment, no variation? → plain manifests.',
    'Plain manifests: `kubectl apply -f dir/`. Variation is handled by having different files, or by `-n` at apply time. Rollback is `kubectl rollout undo` per workload, or re-applying an older file from git.',
    'Kustomize: `kubectl apply -k overlays/<env>`. Variation is declarative transformations. Rollback is re-applying the previous commit, plus `kubectl rollout undo` for immediate recovery.',
    'Helm: `helm upgrade --install`. Variation is values. Rollback is `helm rollback`, which restores every object in the release at once - a genuine advantage over per-workload rollback.',
    'State: plain and Kustomize keep no extra state (beyond the `last-applied-configuration` annotation). Helm stores release history in Secrets, which is both the source of `helm rollback` and an extra thing that can be lost.',
    'GitOps tools such as Argo CD and Flux support all three natively, so the choice does not lock you out of GitOps either way.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Plain YAML, Kustomize, or Helm?',
      caption:
        'For the exam: plain YAML unless the task names a tool. Reach for a tool only when the task hands you a chart or a kustomization.',
      question: 'What are you being handed?',
      branches: [
        {
          condition: 'nothing - you are writing it',
          result: 'Plain YAML',
          detail: 'Generate with --dry-run=client -o yaml and edit',
          tone: 'accent',
        },
        {
          condition: 'the same app for several environments',
          result: 'Kustomize',
          detail: 'Built into kubectl as -k; no templating language',
        },
        {
          condition: 'a third-party chart, or many values to parameterise',
          result: 'Helm',
          detail: 'Versioned releases, upgrade and rollback built in',
        },
        {
          condition: 'a kustomization.yaml or a Chart.yaml in the task',
          result: 'Use that tool, not YAML',
          detail: 'The task is testing whether you recognise it',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Comparison (not a Kubernetes object)',
      apiVersion: 'n/a',
      purpose: 'The properties that actually differentiate the three approaches.',
      fields: [
        { path: 'templating', meaning: 'Helm: Go templates. Kustomize: none. Plain: none.' },
        {
          path: 'customisation model',
          meaning: 'Helm: values. Kustomize: transformers and patches. Plain: separate files.',
        },
        {
          path: 'release-level rollback',
          meaning: 'Helm: yes (`helm rollback`). Kustomize/plain: per-workload only.',
        },
        { path: 'cluster-side state', meaning: 'Helm: release Secrets. Kustomize/plain: none.' },
        {
          path: 'built into kubectl',
          meaning: 'Kustomize: yes (`-k`). Helm: no, separate binary.',
        },
        {
          path: 'third-party distribution',
          meaning: 'Helm: the de facto standard. Kustomize/plain: rarely used for this.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A team that used both, deliberately',
    story: [
      'A platform team runs six of their own microservices plus four third-party components (an ingress controller, a metrics stack, a database operator and a secrets operator).',
      'The third-party components are all installed with Helm, because that is how their authors ship them and because `helm rollback` is genuinely useful for an operator upgrade that touches CRDs, RBAC and a Deployment together.',
      'Their own six services use Kustomize: a shared base per service, and dev/staging/prod overlays that differ only in replicas, resource limits, image tags and a handful of config values. No templating language, and every base is readable as ordinary YAML by anyone on the team.',
      'They tried packaging their own services as charts first and abandoned it. The charts existed only to serve three known environments, so every template parameter had exactly three possible values - all the cost of templating for none of the flexibility it exists to provide.',
      'The rule they settled on: Helm for things you did not write, Kustomize for things you did.',
    ],
    code: [
      {
        title: 'Both, side by side',
        language: 'bash',
        code: `# Third-party: Helm
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \\
  -n ingress-nginx --create-namespace --version 4.11.3 -f ingress-values.yaml

# Own services: Kustomize
kubectl apply -k services/checkout/overlays/prod
kubectl apply -k services/payments/overlays/prod

# One cluster, two tools, each doing what it is good at.
helm ls -A                        # what came from charts
kubectl get deploy -A -l app.kubernetes.io/managed-by=kustomize`,
        explanation:
          'Mixing is normal and is not a design failure. The failure mode is using one tool for everything because it is the only one you know.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The same change, three ways',
      language: 'bash',
      code: `# Requirement: production runs 6 replicas of image tag 1.4.2.

# --- Plain manifests -------------------------------------------------------
# Edit prod/deployment.yaml:
#   spec.replicas: 6
#   image: registry.example.com/shop/api:1.4.2
kubectl apply -f prod/deployment.yaml
# Simple, explicit, and duplicated in dev/deployment.yaml and staging/.

# --- Kustomize -------------------------------------------------------------
# overlays/prod/kustomization.yaml:
#   replicas:
#     - name: api
#       count: 6
#   images:
#     - name: registry.example.com/shop/api
#       newTag: 1.4.2
kubectl apply -k overlays/prod
# The base is untouched; dev and staging keep their own numbers.

# --- Helm ------------------------------------------------------------------
helm upgrade --install api ./charts/api -n shop-prod \\
  --set replicaCount=6 --set image.tag=1.4.2
# Needs a chart, but gives release-level rollback across every object.`,
      explanation:
        'Notice the trend: the amount of machinery grows left to right, and so does what you get back. Choose the leftmost option that actually meets the requirement.',
      placeholders: ['registry.example.com/shop/api'],
    },
    {
      title: 'What each tool cannot do',
      language: 'text',
      code: `Plain manifests cannot:
  - avoid duplication across environments
  - change a shared field in one place

Kustomize cannot:
  - express conditionals ("include an Ingress only if enabled")
  - loop over a list to generate N similar objects
  - be handed to a stranger as an installable package
  - roll back a whole set of objects in one command

Helm cannot:
  - be read as plain YAML without rendering it first
  - patch one field of an object the chart author did not parameterise
    (short of a post-renderer or forking the chart)
  - avoid keeping release state in the cluster

All three can:
  - be driven by GitOps (Argo CD and Flux support each natively)
  - be applied by kubectl in the end - they all produce manifests`,
      explanation:
        'The "Helm cannot patch an unparameterised field" limitation is the one that bites hardest in practice, and it is exactly the gap Kustomize fills - which is why some teams render a chart and then kustomize the output.',
    },
  ],
  imperative: [
    {
      command: 'kubectl apply -f ./manifests/',
      what: 'Plain manifests: applies every file in the directory.',
      expected: 'One created/configured line per object.',
      placeholders: ['./manifests/'],
    },
    {
      command: 'kubectl apply -k ./overlays/prod',
      what: 'Kustomize: builds the overlay and applies it. Built into kubectl.',
      expected: 'One line per transformed object.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'helm upgrade --install api ./charts/api -n shop -f values-prod.yaml',
      what: 'Helm: idempotent install-or-upgrade of a release.',
      expected: 'STATUS: deployed with an incremented revision.',
      placeholders: ['api', './charts/api', 'shop'],
    },
    {
      command: 'helm ls -A',
      what: 'Tells you which parts of a cluster are Helm-managed - the first thing to check on an unfamiliar cluster.',
      expected: 'A row per release, or an empty list.',
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.metadata.labels}\' | tr "," "\\n" | grep managed-by',
      what: 'The `app.kubernetes.io/managed-by` label often reveals which tool created an object.',
      expected: '"app.kubernetes.io/managed-by":"Helm" for chart-created objects.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'helm template api ./charts/api -f values-prod.yaml | kubectl apply -k -',
      what: 'The hybrid: render a chart, then post-process it. Shown for awareness - it needs a kustomization that reads stdin, and is rarely needed for CKAD.',
      expected: 'Applied manifests.',
      placeholders: ['api', './charts/api'],
    },
  ],
  declarative: {
    steps: [
      'Start with plain manifests. Move on only when duplication actually hurts.',
      'When you have two or more environments differing in bounded ways, restructure into a Kustomize base and overlays.',
      'Use Helm to consume third-party software, and to distribute software to people whose environment you do not control.',
      'Whichever you choose, keep it in version control and make the apply command idempotent so it can be re-run safely.',
      'Do not mix ownership on a single object: an object should be managed by exactly one of the three.',
    ],
    code: [
      {
        title: 'A decision checklist you can run in your head',
        language: 'text',
        code: `1. Did someone else package this software?
     yes -> Helm (that is how it ships)

2. Am I distributing this for unknown environments?
     yes -> Helm (values are the right interface)

3. Do I deploy my own app to 2+ environments with bounded differences
   (replicas, images, resources, a few config values)?
     yes -> Kustomize base + overlays

4. Do I need conditionals or loops to generate objects?
     yes -> Helm (Kustomize has neither)

5. Do I need to roll back a whole set of objects in one command?
     yes -> Helm (helm rollback); otherwise per-workload rollout undo is fine

6. None of the above?
     -> plain manifests, applied with kubectl apply -f`,
        explanation:
          'Most teams land on 3 for their own services and 1 for everything else, which is why the Helm-plus-Kustomize combination is so common.',
      },
    ],
  },
  verification: [
    {
      command: 'helm ls -A',
      what: 'Identifies Helm-managed releases across the cluster.',
      expected: 'The list of releases, or nothing if Helm is not in use.',
    },
    {
      command: 'kubectl kustomize ./overlays/prod | head -20',
      what: 'Confirms a Kustomize setup builds cleanly before you trust it.',
      expected: 'Rendered manifests.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl diff -k ./overlays/prod',
      what: 'For Kustomize, shows drift between the repository and the cluster.',
      expected: 'Empty output when in sync.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'helm get manifest api -n shop | grep -c "^kind:"',
      what: 'Counts the objects a release owns - useful before deciding whether a release-level rollback matters.',
      expected: 'A small number.',
      placeholders: ['api', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'helm ls -A && kubectl get deploy -A -l app.kubernetes.io/managed-by=Helm',
      what: 'When a `kubectl edit` keeps getting reverted, check whether a Helm release or a GitOps controller owns the object.',
      expected: 'The release that owns it, if any.',
    },
    {
      command: "kubectl get deploy api -n shop -o jsonpath='{.metadata.annotations}' | head -c 300",
      what: 'The `meta.helm.sh/release-name` annotation identifies the owning release; `last-applied-configuration` suggests kubectl apply.',
      expected: 'Annotations naming the manager.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'helm upgrade --install api ./charts/api -n shop --dry-run --debug 2>&1 | head -30',
      what: 'When a chart and a manual edit conflict, the rendered output shows what Helm will impose.',
      expected: 'Computed values and rendered manifests.',
      placeholders: ['api', './charts/api', 'shop'],
    },
  ],
  commonMistakes: [
    'Writing a chart for a single application deployed to a fixed set of environments - all the templating cost, none of the distribution benefit.',
    'Using `sed` on manifests in a CI pipeline instead of Kustomize overlays, which is the problem Kustomize was built to solve.',
    'Managing the same object with two tools, so each apply undoes the other.',
    'Editing Helm-managed objects with `kubectl edit`; the next `helm upgrade` reverts the change.',
    'Assuming Kustomize can express conditionals. It cannot - if you need "include this only when X", you need Helm or a different structure.',
    'Deleting the Helm release Secrets while tidying up, losing all release history and the ability to roll back.',
    'Choosing a tool before knowing whether the variation between environments is bounded and declarative.',
  ],
  examTips: [
    'On an unfamiliar cluster, run `helm ls -A` first. It tells you whether a workload is chart-managed before you start editing it.',
    'If a task hands you a directory containing `kustomization.yaml`, use `kubectl apply -k` - not `apply -f`, which would apply the kustomization file itself as a resource.',
    'If a task says "install this chart", it wants Helm, even if you could hand-write the manifests.',
    'If a task says "change the image tag in the production overlay", it wants a Kustomize `images` entry, not an edit to the base.',
    'For a single object in a single namespace, plain YAML plus `kubectl apply -f` is always an acceptable answer unless the task names a tool.',
  ],
  summary: [
    'All three produce manifests; they differ in how variation and ownership are expressed.',
    'Plain manifests: simplest, duplicates across environments.',
    'Kustomize: plain YAML plus declarative transforms, built into kubectl, no conditionals or loops.',
    'Helm: templating plus release management; the standard for consuming and distributing third-party software, and the only one with whole-release rollback.',
    'Helm for what you did not write, Kustomize for what you did, is a sound default.',
  ],
  practice: [
    {
      id: 'tool-p1',
      level: 'beginner',
      prompt:
        'You need to install a third-party ingress controller that its authors publish as a chart. Which tool, and why not the others?',
      answer:
        "Helm. The software is distributed as a chart, so Helm is how you consume it, and `helm rollback` covers the whole release (Deployment, Service, RBAC, CRDs) in one command. Rewriting it as plain manifests or a Kustomize base would mean maintaining a fork of someone else's packaging.",
      explanation:
        'You can still layer Kustomize on top of the rendered output with a post-renderer if you need a change the chart does not expose, but that is a last resort.',
    },
    {
      id: 'tool-p2',
      level: 'intermediate',
      prompt:
        'Your own service is deployed to dev, staging and production, differing only in replica count, image tag and two config values. Which tool, and what structure?',
      answer:
        'Kustomize. One `base/` containing the Deployment, Service and a configMapGenerator, plus `overlays/dev`, `overlays/staging` and `overlays/prod` each setting `namespace`, a `replicas` entry, an `images` entry with `newTag`, and a merged configMapGenerator for the two values.',
      explanation:
        "The differences are bounded and declarative, which is exactly Kustomize's target. A chart would introduce a templating language whose parameters have three possible values each.",
    },
    {
      id: 'tool-p3',
      level: 'advanced',
      prompt:
        'A colleague says "we should convert everything to Helm so we get rollback". Give the strongest counter-argument and the case where they are right.',
      answer:
        "Counter-argument: for your own applications you already have rollback - `kubectl rollout undo` per workload, plus git history for the manifests, and re-applying a previous commit restores every object. Helm's advantage is *release-level* rollback across many objects at once, which matters mainly when one upgrade changes CRDs, RBAC and workloads together. Converting readable YAML into templates to gain that costs you plain-YAML readability and adds cluster-side state.\n\nThey are right when: an upgrade genuinely spans many coupled objects (an operator, a CRD schema change), or when the software must be installed by people whose environments you do not control.",
      explanation:
        "The honest framing is that Helm's rollback is release-scoped and Kustomize/plain rollback is workload-scoped plus git. Which you need depends on how coupled your objects are.",
    },
  ],
  lab: {
    title: 'Deploy the same application three ways',
    scenario:
      'You will deploy one small application with plain manifests, then with Kustomize, then with a minimal local chart, and compare what each approach required and what it gave you back.',
    prerequisites: ['A cluster, kubectl, and Helm 3 for the third part'],
    tasks: [
      { instruction: 'Create namespace `tool-lab` and set it as default.' },
      {
        instruction:
          'Deploy an nginx Deployment and Service with plain manifests, then change the replica count by editing the file and re-applying.',
      },
      {
        instruction:
          'Convert the same manifests into a Kustomize base plus one overlay that changes replicas and the image tag; apply it.',
      },
      {
        instruction:
          'Create a minimal local Helm chart for the same application and install it as release `plain-helm`.',
      },
      {
        instruction:
          'Change the replica count with each approach and note how many files you touched.',
      },
      {
        instruction:
          'Use `helm rollback` on the Helm release and `kubectl rollout undo` on the plain Deployment, and compare what each reverted.',
      },
      { instruction: 'Delete the namespace and the local directories.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - plain manifests',
        language: 'bash',
        code: `kubectl create namespace tool-lab
kubectl config set-context --current --namespace=tool-lab
mkdir -p tool-lab/{plain,kust/base,kust/overlay,chart}
cd tool-lab

kubectl create deployment plain --image=nginx:1.26-alpine --replicas=1 \\
  --dry-run=client -o yaml > plain/deployment.yaml
kubectl apply -f plain/
kubectl get deploy plain

# Change replicas: edit the file, re-apply
sed -i 's/replicas: 1/replicas: 3/' plain/deployment.yaml
kubectl apply -f plain/
kubectl get deploy plain      # READY 3/3
# Files touched: 1. Environments supported: 1.`,
      },
      {
        title: 'Step 3 - Kustomize',
        language: 'bash',
        code: `kubectl create deployment kust --image=nginx:1.26-alpine --replicas=1 \\
  --dry-run=client -o yaml > kust/base/deployment.yaml

cat > kust/base/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
YAML

cat > kust/overlay/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: tool-lab
resources:
  - ../base
replicas:
  - name: kust
    count: 3
images:
  - name: nginx
    newTag: 1.27-alpine
YAML

kubectl kustomize kust/overlay | grep -E 'replicas:|image:'
kubectl apply -k kust/overlay
kubectl get deploy kust -o jsonpath='{.spec.replicas}{" "}{.spec.template.spec.containers[0].image}{"\\n"}'
# 3 nginx:1.27-alpine
# Files touched to change replicas: 1 (the overlay). The base is untouched
# and still serves every other environment.`,
      },
      {
        title: 'Step 4 - a minimal chart',
        language: 'bash',
        code: `mkdir -p chart/templates

cat > chart/Chart.yaml <<'YAML'
apiVersion: v2
name: mini
version: 0.1.0
appVersion: "1.27"
YAML

cat > chart/values.yaml <<'YAML'
replicaCount: 1
image:
  repository: nginx
  tag: 1.26-alpine
YAML

cat > chart/templates/deployment.yaml <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: nginx
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
YAML

helm install plain-helm ./chart -n tool-lab --set replicaCount=3 --wait
helm list -n tool-lab
kubectl get deploy plain-helm`,
      },
      {
        title: 'Steps 5-6 - change and roll back',
        language: 'bash',
        code: `# Helm: change replicas -> new revision
helm upgrade plain-helm ./chart -n tool-lab --set replicaCount=5 --wait
helm history plain-helm -n tool-lab
# 1  superseded  Install complete
# 2  deployed    Upgrade complete

# Roll the whole release back
helm rollback plain-helm 1 -n tool-lab
kubectl get deploy plain-helm -o jsonpath='{.spec.replicas}{"\\n"}'
# 3      <- revision 1's value, and every other object in the release too

# Plain manifests: rollout undo reverts the Pod TEMPLATE, not spec.replicas
kubectl set image deploy/plain nginx=nginx:1.27-alpine
kubectl rollout status deploy/plain --timeout=90s
kubectl rollout undo deploy/plain
kubectl get deploy plain -o jsonpath='{.spec.template.spec.containers[0].image}{" replicas="}{.spec.replicas}{"\\n"}'
# nginx:1.26-alpine replicas=3
# Note: the image reverted; replicas did NOT, because scaling is not a revision.`,
        explanation:
          'That last observation is the practical difference between the two rollback models: `rollout undo` restores a Pod template, `helm rollback` restores a set of objects.',
      },
      {
        title: 'Step 7 - cleanup',
        language: 'bash',
        code: `helm uninstall plain-helm -n tool-lab
kubectl delete -k kust/overlay
kubectl delete -f plain/
cd .. && rm -rf tool-lab
kubectl config set-context --current --namespace=default
kubectl delete namespace tool-lab`,
      },
    ],
    verification: [
      {
        command: 'helm history plain-helm -n tool-lab',
        what: 'Shows the release-level history that plain manifests and Kustomize do not have.',
        expected: 'Three revisions after the upgrade and rollback.',
      },
      {
        command:
          "kubectl get deploy -n tool-lab -o custom-columns='NAME:.metadata.name,REPLICAS:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image'",
        what: 'Compares the three deployments produced by the three approaches.',
        expected: 'plain, kust and plain-helm each with their configured values.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace tool-lab',
        what: 'Removes everything created by all three approaches.',
        expected: 'namespace "tool-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['helm-fundamentals', 'kustomize-fundamentals', 'imperative-vs-declarative'],
  docs: [
    {
      title: 'Managing Kubernetes objects',
      url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/',
    },
  ],
}
