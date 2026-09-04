import type { Topic } from '../../../types'

export const helmFundamentals: Topic = {
  id: 'helm-fundamentals',
  title: 'Helm fundamentals: install, upgrade, rollback',
  domainId: 'deployment',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 4,
  tags: ['helm', 'chart', 'release', 'values', 'repo', 'upgrade', 'rollback', 'template'],
  oneLiner:
    'Deploy existing packages with Helm: repositories, charts, releases, values overrides, and the upgrade/rollback cycle.',
  explanation: [
    'Helm is a package manager for Kubernetes. A **chart** is the package: a directory of templated manifests plus a `values.yaml` of defaults. A **release** is one installation of a chart into a cluster, with a name and a revision number.',
    'The curriculum wording is precise: "use the Helm package manager to **deploy existing packages**". You are expected to install and manage charts other people wrote, not to author charts from scratch.',
    'The workflow is: add a repository (`helm repo add`), search it (`helm search repo`), install a chart with overrides (`helm install -f values.yaml` or `--set`), then upgrade or roll back as the application changes.',
    'Helm renders the chart templates locally into plain Kubernetes manifests and applies them through the API server. It stores the release state in a Secret in the release namespace, which is how `helm history` and `helm rollback` work.',
    '`helm template` renders a chart to stdout without touching the cluster - the equivalent of `--dry-run=client` and the fastest way to understand what a chart will actually create.',
  ],
  whyItMatters: [
    'Helm is one of two named tools in the curriculum (the other is Kustomize), so at least one task is likely to involve installing or upgrading a release.',
    '`--set` versus `-f values.yaml` and `helm upgrade --install` are the practical details that make the difference between finishing the task and fighting the CLI.',
    "`helm rollback` is a genuinely different mechanism from `kubectl rollout undo`: it restores the whole release (every object in the chart), not just one Deployment's Pod template.",
  ],
  howItWorks: [
    'Chart structure: `Chart.yaml` (name, version, appVersion), `values.yaml` (defaults), `templates/` (Go-templated manifests), optional `charts/` (dependencies) and `crds/`.',
    "Values precedence, lowest to highest: chart `values.yaml` → a parent chart's values → `-f myvalues.yaml` (later files win) → `--set` → `--set-string`/`--set-file`. So `--set` always beats a values file.",
    'Release state lives in a Secret named `sh.helm.release.v1.<release>.v<revision>` in the release namespace. Deleting that Secret loses your history, which is why you should not tidy up Secrets you do not recognise.',
    '`helm upgrade` creates a new revision; `helm rollback <release> <revision>` creates *another* new revision whose content matches the target - the same pattern as `kubectl rollout undo`.',
    '`helm upgrade --install` (often written `helm upgrade -i`) installs if absent and upgrades if present, which makes scripts idempotent.',
    '`--atomic` rolls the release back automatically if the upgrade fails, and implies `--wait`. `--wait` blocks until Pods are Ready or the `--timeout` expires.',
    "`helm uninstall` removes the release's objects. It does *not* remove CRDs installed from the `crds/` directory, and by default it also removes the history unless you pass `--keep-history`.",
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'What helm install actually does',
      caption:
        'Helm renders templates into plain manifests and applies them. Nothing new runs in your cluster afterwards.',
      nodes: [
        {
          label: 'Chart',
          detail: 'Chart.yaml, templates/, values.yaml',
          tone: 'accent',
        },
        {
          label: 'Your value overrides',
          detail: '-f my-values.yaml, --set image.tag=1.2.0',
          arrowLabel: 'merged over the defaults',
        },
        {
          label: 'Templates are rendered',
          detail: 'See exactly what with helm template',
          arrowLabel: 'Go templating',
        },
        {
          label: 'Plain Kubernetes manifests',
          detail: 'Ordinary Deployments, Services, ConfigMaps',
        },
        {
          label: 'Applied to the cluster as a release',
          detail: 'Release history is stored in Secrets in the namespace',
          tone: 'success',
          branch: {
            label: 'Rendering error',
            detail: 'Run helm template first - it fails locally, faster',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Chart (files, not a Kubernetes object)',
      apiVersion: 'v2',
      purpose: 'The packaged application: templates plus default values.',
      fields: [
        { path: 'Chart.yaml:name', meaning: 'Chart name.', required: true },
        {
          path: 'Chart.yaml:version',
          meaning: 'Chart version - what you pin with --version.',
          required: true,
        },
        {
          path: 'Chart.yaml:appVersion',
          meaning: 'Version of the application inside, informational only.',
        },
        { path: 'values.yaml', meaning: 'Default values; your overrides are merged over these.' },
        {
          path: 'templates/',
          meaning: 'Go-templated manifests rendered into real Kubernetes objects.',
        },
      ],
    },
    {
      kind: 'Secret',
      apiVersion: 'v1',
      purpose: 'How Helm stores release state - useful to recognise, never to edit.',
      fields: [
        { path: 'type', meaning: 'helm.sh/release.v1' },
        { path: 'metadata.name', meaning: 'sh.helm.release.v1.<release>.v<revision>' },
        {
          path: 'metadata.labels.status',
          meaning: 'deployed, superseded, failed or pending-upgrade.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'An upgrade that broke, and the 20-second recovery',
    story: [
      'A team runs an internal dashboard from a public chart, release name `dash`, in namespace `tools`. They upgrade to a new chart version to pick up a security fix.',
      'The new chart version renamed a values key from `ingress.hosts` to `ingress.hostname`. Their values file still sets the old key, which the new chart ignores, so the rendered Ingress has no host and the dashboard becomes unreachable.',
      '`helm history dash -n tools` shows revision 4 as `deployed` and revision 3 as `superseded`. `helm rollback dash 3 -n tools` restores revision 3 in full - Deployment, Service and Ingress together - and the dashboard is back.',
      'They then fixed it properly: `helm show values <chart> --version <new>` to read the new key names, updated the values file, and re-ran the upgrade with `--atomic` so a future failure rolls itself back.',
      'The general lesson: `helm show values` before every chart-version upgrade, because values keys are not part of any compatibility contract.',
    ],
    code: [
      {
        title: 'History, rollback, and doing it properly next time',
        language: 'bash',
        code: `helm history dash -n tools
# REVISION  UPDATED       STATUS      CHART        APP VERSION  DESCRIPTION
# 3         2026-08-20..  superseded  dash-2.4.1   2.4.0        Upgrade complete
# 4         2026-09-03..  deployed    dash-3.0.0   3.0.0        Upgrade complete

helm rollback dash 3 -n tools
# Rollback was a success! Happy Helming!

# Then find out what actually changed in the new chart:
helm show values <repo>/dash --version 3.0.0 | grep -A5 ingress

# And make future upgrades self-healing:
helm upgrade dash <repo>/dash --version 3.0.0 -n tools \\
  -f values.yaml --atomic --timeout 5m`,
        explanation:
          '`--atomic` is the single most valuable upgrade flag: on failure it rolls back automatically, so you never leave a half-applied release behind.',
        placeholders: ['dash', 'tools', '<repo>'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A values override file',
      language: 'yaml',
      code: `# my-values.yaml - only the keys you want to change
replicaCount: 3

image:
  repository: nginx
  tag: "1.27-alpine"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: shop.example.com
      paths:
        - path: /
          pathType: Prefix

# Deep keys are merged, not replaced - anything you omit keeps the chart default.`,
      explanation:
        'Always start from `helm show values <chart> > my-values.yaml` and delete what you do not need, rather than guessing key names. Chart authors change them between major versions.',
      placeholders: ['shop.example.com'],
    },
    {
      title: 'The shape of a chart directory',
      language: 'text',
      code: `mychart/
├── Chart.yaml          # name, version, appVersion, dependencies
├── values.yaml         # default values
├── charts/             # vendored dependency charts
├── crds/               # CRDs installed before templates, never uninstalled
└── templates/
    ├── deployment.yaml # Go templates: {{ .Values.replicaCount }}
    ├── service.yaml
    ├── ingress.yaml
    ├── _helpers.tpl    # reusable template snippets
    └── NOTES.txt       # printed after install

# Rendered output = templates + merged values. See it with:
#   helm template myrelease ./mychart -f my-values.yaml`,
      explanation:
        'You are not expected to author these for CKAD, but recognising the layout lets you read a chart and find where a value is used.',
    },
  ],
  imperative: [
    {
      command: 'helm repo add bitnami https://charts.bitnami.com/bitnami',
      what: 'Registers a chart repository locally.',
      expected: '"bitnami" has been added to your repositories',
      placeholders: ['bitnami', 'https://charts.bitnami.com/bitnami'],
    },
    {
      command: 'helm repo update',
      what: 'Refreshes the local index of every added repository. Run it before searching or installing.',
      expected: 'Update Complete. Happy Helming!',
    },
    {
      command: 'helm search repo nginx --versions | head',
      what: 'Lists matching charts and their available chart versions.',
      expected: 'NAME, CHART VERSION, APP VERSION, DESCRIPTION columns.',
      placeholders: ['nginx'],
    },
    {
      command: 'helm show values bitnami/nginx > my-values.yaml',
      what: "Dumps the chart's default values so you can see the real key names before overriding them.",
      expected: 'A large YAML file of documented defaults.',
      placeholders: ['bitnami/nginx'],
    },
    {
      command: 'helm install web bitnami/nginx -n shop --create-namespace -f my-values.yaml',
      what: 'Installs the chart as release `web`, creating the namespace if needed.',
      expected: 'NAME: web / STATUS: deployed / REVISION: 1.',
      placeholders: ['web', 'bitnami/nginx', 'shop'],
    },
    {
      command:
        'helm install web bitnami/nginx -n shop --set replicaCount=3 --set service.type=NodePort',
      what: 'Overrides individual values on the command line. `--set` beats any values file.',
      expected: 'STATUS: deployed.',
      placeholders: ['web', 'bitnami/nginx', 'shop'],
    },
    {
      command: 'helm list -n shop',
      what: 'Lists releases in a namespace with revision, status, chart and app version. Add `-A` for all namespaces.',
      expected: 'One row per release with STATUS deployed.',
      placeholders: ['shop'],
    },
    {
      command: 'helm upgrade web bitnami/nginx -n shop -f my-values.yaml --atomic --timeout 5m',
      what: 'Upgrades the release, rolling back automatically if it fails.',
      expected: 'Release "web" has been upgraded. REVISION: 2.',
      placeholders: ['web', 'bitnami/nginx', 'shop'],
    },
    {
      command: 'helm upgrade --install web bitnami/nginx -n shop -f my-values.yaml',
      what: 'Installs if the release does not exist, upgrades if it does - the idempotent form.',
      expected: 'Either "has been upgraded" or a fresh install.',
      placeholders: ['web', 'bitnami/nginx', 'shop'],
    },
    {
      command: 'helm history web -n shop',
      what: 'Shows every revision with its status and description.',
      expected: 'Rows marked deployed / superseded / failed.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'helm rollback web 1 -n shop',
      what: 'Restores the release to revision 1, creating a new revision that matches it.',
      expected: 'Rollback was a success! Happy Helming!',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'helm get values web -n shop',
      what: 'Shows the user-supplied values of the current revision. Add `--all` to include chart defaults.',
      expected: 'The YAML you passed with -f/--set.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'helm get manifest web -n shop | head -40',
      what: 'Shows the rendered Kubernetes objects the release actually created.',
      expected: 'Plain manifests with a "# Source: ..." comment above each.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'helm template web bitnami/nginx -f my-values.yaml | head -40',
      what: 'Renders locally without contacting the cluster - the Helm equivalent of a client-side dry run.',
      expected: 'Rendered YAML on stdout.',
      placeholders: ['web', 'bitnami/nginx'],
    },
    {
      command: 'helm uninstall web -n shop',
      what: 'Deletes the release and its objects. Add `--keep-history` to retain the revision history.',
      expected: 'release "web" uninstalled',
      placeholders: ['web', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Add and update the repository.',
      'Capture the chart defaults with `helm show values <chart> > values.yaml` and edit only what you need - keep this file in version control.',
      'Install with `helm upgrade --install <release> <chart> -n <ns> -f values.yaml`, which is safe to re-run.',
      'Pin the chart version with `--version` so the same command produces the same result later.',
      'Verify with `helm list`, then with `kubectl get` on the objects the chart created.',
    ],
    code: [
      {
        title: 'A repeatable release command',
        language: 'bash',
        code: `helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm show values bitnami/nginx --version 18.2.0 > values.yaml
# edit values.yaml

helm upgrade --install web bitnami/nginx \\
  --version 18.2.0 \\
  -n shop --create-namespace \\
  -f values.yaml \\
  --atomic --timeout 5m

helm list -n shop
kubectl get deploy,svc -n shop -l app.kubernetes.io/instance=web`,
        explanation:
          "Charts label everything they create with `app.kubernetes.io/instance=<release>`, which is how you find a release's objects with kubectl.",
        placeholders: ['web', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'helm list -n shop',
      what: 'Confirms the release exists, its revision and its status.',
      expected: 'STATUS deployed.',
      placeholders: ['shop'],
    },
    {
      command: 'helm status web -n shop',
      what: "Release status plus the chart's NOTES output.",
      expected: 'STATUS: deployed and post-install notes.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get all -n shop -l app.kubernetes.io/instance=web',
      what: 'Lists the objects the release created, using the standard Helm instance label.',
      expected: "The chart's Deployment, Service and Pods.",
      placeholders: ['shop', 'web'],
    },
    {
      command: 'helm get values web -n shop -o json | head -c 200',
      what: 'Proves your overrides were applied to the current revision.',
      expected: 'JSON containing the keys you set.',
      placeholders: ['web', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'helm history web -n shop',
      what: 'A revision marked `failed` or `pending-upgrade` tells you the release is mid-problem.',
      expected: 'The most recent revision marked deployed.',
      placeholders: ['web', 'shop'],
    },
    {
      command:
        'helm upgrade web bitnami/nginx -n shop -f values.yaml --debug --dry-run 2>&1 | head -40',
      what: 'Renders the upgrade and shows the computed values without applying - catches bad value keys and template errors.',
      expected: 'Rendered manifests, or a template error naming the line.',
      placeholders: ['web', 'bitnami/nginx', 'shop'],
    },
    {
      command: 'helm get manifest web -n shop | grep -A3 "kind: Ingress"',
      what: 'When a value seems ignored, look at what was actually rendered rather than what you intended.',
      expected: 'The Ingress as rendered, so you can see whether your host value took effect.',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'helm rollback web -n shop',
      what: 'With no revision number, rolls back to the previous revision.',
      expected: 'Rollback was a success!',
      placeholders: ['web', 'shop'],
    },
    {
      command: 'kubectl get secrets -n shop -l owner=helm',
      what: 'Shows the release-state Secrets. If these are missing, Helm has lost its history for that release.',
      expected: 'One Secret per revision.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Forgetting `helm repo update`, then installing a stale chart version.',
    'Guessing values keys instead of reading `helm show values`. Keys differ between charts and between chart versions.',
    'Expecting a values file to override a `--set` on the same key. `--set` has higher precedence.',
    'Using `helm install` for a release that already exists (it errors) instead of `helm upgrade --install`.',
    'Omitting `-n <namespace>`. Helm release names are namespaced, and the release will not be found from another namespace.',
    'Not pinning `--version`, so an install today and an install next month give different results.',
    'Assuming `helm uninstall` removes CRDs. Charts that install CRDs from `crds/` leave them behind deliberately.',
    'Editing objects a release owns with `kubectl edit`; the next `helm upgrade` overwrites your change.',
  ],
  examTips: [
    '`helm ls -A` finds every release in the cluster when a task does not tell you the namespace.',
    '`helm search repo <term>` and `helm show values <chart>` are the two commands that make an unfamiliar chart usable.',
    '"Install chart X with N replicas" → `helm install <name> <chart> --set replicaCount=N -n <ns>`.',
    '"Roll the release back" → `helm rollback <release> [revision] -n <ns>`; check `helm history` first.',
    'Verify with both `helm list` and `kubectl get` - the release can be `deployed` while its Pods are failing.',
    '`helm template` is the fast way to answer "what does this chart create?" without installing it.',
  ],
  summary: [
    'Chart = package, release = one installation, revision = one version of that release.',
    'Values precedence: chart defaults < `-f` files (later wins) < `--set`.',
    '`helm upgrade --install` is idempotent; `--atomic` rolls back a failed upgrade automatically.',
    '`helm history` then `helm rollback <release> <revision>` restores the whole release, not just one Deployment.',
    'Release state lives in Secrets labelled `owner=helm` in the release namespace.',
  ],
  practice: [
    {
      id: 'helm-p1',
      level: 'beginner',
      prompt:
        'Write the commands to add the `bitnami` repository and install the `bitnami/nginx` chart as release `web` in namespace `shop`, creating the namespace.',
      answer:
        'helm repo add bitnami https://charts.bitnami.com/bitnami\nhelm repo update\nhelm install web bitnami/nginx -n shop --create-namespace',
      explanation:
        '`--create-namespace` saves a separate `kubectl create namespace`. Verify with `helm list -n shop` and `kubectl get pods -n shop`.',
    },
    {
      id: 'helm-p2',
      level: 'intermediate',
      prompt:
        'You pass `-f values.yaml` containing `replicaCount: 5` and also `--set replicaCount=2`. How many replicas does the release get, and what command proves it?',
      answer:
        'Two. `--set` has higher precedence than any values file.\n\nProof: `helm get values <release> -n <ns>` shows the merged user-supplied values, and `kubectl get deploy -n <ns>` shows READY 2/2.',
      explanation:
        'Precedence order, lowest to highest: chart values.yaml → -f files (later files override earlier) → --set → --set-string/--set-file.',
    },
    {
      id: 'helm-p3',
      level: 'advanced',
      prompt:
        'A release named `dash` in namespace `tools` is at revision 5 and broken. Give the commands to see what changed, return to the last working revision, and make future upgrades self-healing.',
      answer:
        'helm history dash -n tools                          # find the last "superseded" revision that worked, say 4\nhelm get values dash -n tools --revision 4          # what values that revision used\nhelm get manifest dash -n tools --revision 4 | head # what it rendered\nhelm rollback dash 4 -n tools\nhelm status dash -n tools\n\nFuture upgrades: add `--atomic --timeout 5m` so a failed upgrade rolls itself back.',
      explanation:
        '`helm get values/manifest --revision N` is the diffing tool people forget exists. The rollback creates revision 6 whose content matches revision 4 - history is append-only.',
    },
  ],
  lab: {
    title: 'Install, override, upgrade and roll back a real chart',
    scenario:
      'You will install a chart from a public repository, override values two different ways, upgrade it, break it deliberately, and roll it back - the full release lifecycle.',
    prerequisites: [
      'Helm 3 installed (`helm version` shows v3.x)',
      'A cluster and internet access to a chart repository',
    ],
    tasks: [
      { instruction: 'Add the bitnami repository and update the local index.' },
      {
        instruction:
          "Inspect the nginx chart's default values and note the key that controls replica count.",
      },
      { instruction: 'Render the chart locally with `helm template` without installing anything.' },
      {
        instruction:
          'Install it as release `web` in namespace `helm-lab` with 2 replicas, creating the namespace.',
      },
      { instruction: 'Verify with both `helm list` and `kubectl get`.' },
      { instruction: 'Upgrade to 3 replicas and confirm the revision incremented.' },
      {
        instruction:
          'Attempt an upgrade with an invalid value to see a failure, using --atomic so it self-heals.',
      },
      { instruction: 'Roll back to revision 1 and confirm the replica count returned to 2.' },
      { instruction: 'Uninstall the release and delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - inspect before installing',
        language: 'bash',
        code: `helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm show values bitnami/nginx | grep -nE '^replicaCount|^  type:' | head
# replicaCount: 1
#   type: LoadBalancer

# Render locally - nothing is created in the cluster
helm template web bitnami/nginx --set replicaCount=2 | grep -E 'kind:|replicas:'
# kind: Service
# kind: Deployment
#   replicas: 2`,
      },
      {
        title: 'Steps 4-5 - install and verify',
        language: 'bash',
        code: `helm install web bitnami/nginx \\
  -n helm-lab --create-namespace \\
  --set replicaCount=2 \\
  --set service.type=ClusterIP \\
  --wait --timeout 5m

helm list -n helm-lab
# NAME  NAMESPACE  REVISION  STATUS     CHART         APP VERSION
# web   helm-lab   1         deployed   nginx-18.x.x  1.27.x

kubectl get deploy,svc,pods -n helm-lab
kubectl get deploy -n helm-lab -o jsonpath='{.items[0].spec.replicas}{"\\n"}'
# 2

# Helm labels everything with the release name:
kubectl get all -n helm-lab -l app.kubernetes.io/instance=web --no-headers | wc -l`,
      },
      {
        title: 'Step 6 - upgrade',
        language: 'bash',
        code: `helm upgrade web bitnami/nginx -n helm-lab \\
  --set replicaCount=3 --set service.type=ClusterIP \\
  --wait --timeout 5m

helm list -n helm-lab
# REVISION 2

kubectl get deploy -n helm-lab -o jsonpath='{.items[0].spec.replicas}{"\\n"}'
# 3

helm history web -n helm-lab
# 1  superseded  Install complete
# 2  deployed    Upgrade complete`,
      },
      {
        title: 'Step 7 - a failing upgrade that rolls itself back',
        language: 'bash',
        code: `# An image tag that cannot be pulled makes the new Pods never become Ready.
helm upgrade web bitnami/nginx -n helm-lab \\
  --set replicaCount=3 --set service.type=ClusterIP \\
  --set image.tag=this-tag-does-not-exist \\
  --atomic --timeout 90s
# Error: UPGRADE FAILED: ... timed out waiting for the condition
# ... and because of --atomic, Helm rolls back automatically.

helm history web -n helm-lab
# 3  failed       Upgrade "web" failed: timed out ...
# 4  deployed     Rollback to 2

kubectl get deploy -n helm-lab -o jsonpath='{.items[0].spec.template.spec.containers[0].image}{"\\n"}'
# the ORIGINAL working image - --atomic restored it`,
      },
      {
        title: 'Steps 8-9 - explicit rollback and cleanup',
        language: 'bash',
        code: `helm rollback web 1 -n helm-lab
helm history web -n helm-lab | tail -2
kubectl get deploy -n helm-lab -o jsonpath='{.items[0].spec.replicas}{"\\n"}'
# 2      <- revision 1's replica count

helm uninstall web -n helm-lab
kubectl get all -n helm-lab
# No resources found

kubectl delete namespace helm-lab`,
      },
    ],
    verification: [
      {
        command: 'helm history web -n helm-lab',
        what: 'The revision list is the record of everything the lab did.',
        expected: 'Revisions 1-5 with statuses superseded / failed / deployed.',
      },
      {
        command: 'kubectl get deploy -n helm-lab -o jsonpath=\'{.items[0].spec.replicas}{"\\n"}\'',
        what: 'Confirms each upgrade and rollback actually changed the cluster.',
        expected: '2, then 3, then 2 again after the rollback to revision 1.',
      },
    ],
    cleanup: [
      {
        command: 'helm uninstall web -n helm-lab',
        what: 'Removes the release and its objects.',
        expected: 'release "web" uninstalled',
      },
      {
        command: 'kubectl delete namespace helm-lab',
        what: 'Removes the namespace.',
        expected: 'namespace "helm-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['kustomize-fundamentals', 'choosing-deployment-tooling'],
  docs: [
    { title: 'Helm documentation', url: 'https://helm.sh/docs/' },
    { title: 'Helm - using Helm', url: 'https://helm.sh/docs/intro/using_helm/' },
  ],
}
