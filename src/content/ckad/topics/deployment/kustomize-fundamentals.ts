import type { Topic } from '../../../types'

export const kustomizeFundamentals: Topic = {
  id: 'kustomize-fundamentals',
  title: 'Kustomize: bases, overlays, patches and images',
  domainId: 'deployment',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 5,
  tags: ['kustomize', 'kustomization', 'overlay', 'base', 'patch', 'images', 'kubectl -k'],
  oneLiner:
    'Template-free customisation: one base, several overlays, and the patch and image transformers that turn one manifest set into dev, staging and production.',
  explanation: [
    'Kustomize takes plain, valid Kubernetes YAML and applies declarative transformations to it. There are no templates, no placeholders and no `{{ }}` - a base is deployable on its own.',
    'A **kustomization.yaml** lists resources and the transformations to apply. A **base** is a kustomization containing the common manifests. An **overlay** is a kustomization that references the base and layers environment-specific changes on top.',
    'Transformations come in two flavours. **Built-in transformers** handle the common cases declaratively: `namespace`, `namePrefix`/`nameSuffix`, `commonLabels`, `commonAnnotations`, `images`, `replicas`, `configMapGenerator`, `secretGenerator`. **Patches** handle everything else, either as a strategic-merge patch (a YAML fragment that is merged in) or a JSON 6902 patch (explicit add/replace/remove operations).',
    'Kustomize is built into kubectl: `kubectl apply -k ./overlays/prod` builds and applies in one step, and `kubectl kustomize ./overlays/prod` renders to stdout so you can read the result first.',
    'The generators are the feature people underuse. `configMapGenerator` creates a ConfigMap with a content hash appended to its name and rewrites every reference to it, so changing a config value automatically triggers a new rollout.',
  ],
  whyItMatters: [
    'Kustomize is named in the curriculum alongside Helm, and it is the more likely of the two to appear as a "modify this existing setup" task because it needs no repository access.',
    'The base/overlay split is the standard answer to "the same application in three environments", which is a design question as much as a tooling one.',
    'The `images` transformer is the single most common Kustomize exam operation: change an image tag in an overlay without touching the base.',
  ],
  howItWorks: [
    '`kubectl kustomize <dir>` reads `<dir>/kustomization.yaml`, loads its `resources` (files, directories or URLs), applies transformers in a fixed order, and prints the result. `kubectl apply -k <dir>` does the same then applies it.',
    "Overlay resolution: an overlay lists the base in `resources` (e.g. `../../base`). The base is built first, then the overlay's transformers and patches are applied to the built output.",
    '`patches` (the current field) accepts an entry with either `path:` to a file or an inline `patch:` string, plus an optional `target:` selector by kind/name/namespace/labelSelector. This one field covers both strategic-merge and JSON patches - the format is inferred.',
    'Strategic-merge patches merge lists intelligently for known types: a patch adding one container to `spec.template.spec.containers` merges by the `name` key rather than replacing the whole list.',
    'JSON 6902 patches use explicit paths: `{op: replace, path: /spec/replicas, value: 5}`. Use them when you must remove a field or address a list element by index.',
    '`images` replaces `newName` and/or `newTag` for a matching image name anywhere in the built output - across Deployments, StatefulSets, CronJobs, all of it.',
    '`configMapGenerator`/`secretGenerator` append a hash suffix by default (`app-config-7d9f8b6c4`). Disable it with `generatorOptions: {disableNameSuffixHash: true}` if something outside Kustomize references the name.',
    '`namespace:` in a kustomization sets the namespace on every generated object, which is how one overlay targets one environment.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Base plus overlay',
      caption:
        'The base never knows about the overlays. An overlay only records the difference, which is why the diff stays readable.',
      root: {
        label: 'Repository',
        children: [
          {
            label: 'base/',
            detail: 'The full, environment-neutral manifests',
            tone: 'accent',
            children: [
              { label: 'kustomization.yaml', detail: 'resources: deployment, service' },
              { label: 'deployment.yaml', detail: 'replicas: 1, image: app:1.0.0' },
            ],
          },
          {
            label: 'overlays/prod/',
            detail: 'Only what differs in production',
            children: [
              {
                label: 'kustomization.yaml',
                detail: 'resources: ../../base, plus patches and images',
              },
              {
                label: 'replicas-patch.yaml',
                detail: 'replicas: 10 - nothing else',
                tone: 'success',
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'How kubectl apply -k resolves an overlay',
      caption:
        'Always run kubectl kustomize first. It prints the merged result without touching the cluster.',
      nodes: [
        {
          label: 'kubectl apply -k overlays/prod',
          detail: 'Reads overlays/prod/kustomization.yaml',
        },
        {
          label: 'Load the base resources',
          detail: 'Follows the ../../base reference',
          arrowLabel: 'resources:',
        },
        {
          label: 'Apply patches on top',
          detail: 'patches, replicas, images, namePrefix',
          arrowLabel: 'merge',
          tone: 'accent',
        },
        {
          label: 'Add common labels and namespace',
          detail: 'commonLabels and namespace apply to everything',
        },
        {
          label: 'Send the merged manifests to the API',
          detail: 'Identical to applying the printed YAML by hand',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Kustomization',
      apiVersion: 'kustomize.config.k8s.io/v1beta1',
      purpose: 'Declares which manifests to include and how to transform them.',
      fields: [
        {
          path: 'resources[]',
          meaning: 'Files, directories or URLs to include. An overlay lists its base here.',
          required: true,
        },
        { path: 'namespace', meaning: 'Sets metadata.namespace on every resource.' },
        {
          path: 'namePrefix / nameSuffix',
          meaning: 'Prefixes/suffixes every resource name, and updates references.',
        },
        {
          path: 'commonLabels',
          meaning:
            'Adds labels to every resource - and to selectors, so use with care on existing workloads.',
        },
        { path: 'commonAnnotations', meaning: 'Adds annotations to every resource.' },
        {
          path: 'images[]',
          meaning: 'Rewrites image name/tag/digest by matching the original name.',
        },
        { path: 'replicas[]', meaning: 'Overrides replica counts by resource name.' },
        {
          path: 'patches[]',
          meaning: 'Strategic-merge or JSON 6902 patches, with an optional target selector.',
        },
        {
          path: 'configMapGenerator[]',
          meaning: 'Generates ConfigMaps from literals or files, with a content-hash name suffix.',
        },
        { path: 'secretGenerator[]', meaning: 'Same for Secrets.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'One application, three environments, no duplicated YAML',
    story: [
      'A team maintained three copies of the same manifests for dev, staging and production. A change to the readiness probe had to be made three times, and one copy was always out of date.',
      'They restructured into a base containing the Deployment, Service and a ConfigMap, plus three overlays. Dev sets 1 replica and `LOG_LEVEL=debug`. Staging sets 2 replicas. Production sets 6 replicas, higher resource limits and a pinned image tag.',
      'The readiness probe now lives in exactly one place. `kubectl apply -k overlays/prod` deploys production; `kubectl kustomize overlays/dev` shows exactly what dev will get.',
      "The unexpected win was the `configMapGenerator`. Because the generated ConfigMap name carries a content hash, changing `LOG_LEVEL` renames the ConfigMap, which changes the Deployment's Pod template, which triggers a rolling update automatically. Previously they had to remember to run `kubectl rollout restart` after every config change, and often forgot.",
    ],
    code: [
      {
        title: 'The directory layout',
        language: 'text',
        code: `k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml        # the ONLY copy of the probe, ports, etc.
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml # 1 replica, LOG_LEVEL=debug
    │   └── patch-resources.yaml
    ├── staging/
    │   └── kustomization.yaml # 2 replicas
    └── prod/
        ├── kustomization.yaml # 6 replicas, pinned tag
        └── patch-resources.yaml

# Deploy one environment:
#   kubectl apply -k k8s/overlays/prod
# Preview it first:
#   kubectl kustomize k8s/overlays/prod`,
        explanation:
          'The base is deployable by itself (`kubectl apply -k k8s/base`), which is what makes Kustomize easy to adopt gradually.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The base',
      language: 'yaml',
      code: `# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

configMapGenerator:
  - name: app-config
    literals:
      - LOG_LEVEL=info
      - MAX_RETRIES=3

commonLabels:
  app.kubernetes.io/name: api
---
# base/deployment.yaml - plain, valid, deployable YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
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
          image: registry.example.com/shop/api:1.4.0
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: app-config # Kustomize rewrites this to the hashed name
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi`,
      explanation:
        'Note the base has no placeholders. You could `kubectl apply -f base/deployment.yaml` and it would work - Kustomize adds customisation without making the base unusable.',
      placeholders: ['registry.example.com/shop/api:1.4.0'],
    },
    {
      title: 'A production overlay: namespace, replicas, image and a patch',
      language: 'yaml',
      code: `# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: shop-prod # every object lands here

resources:
  - ../../base

namePrefix: prod- # api -> prod-api

commonLabels:
  environment: production

images:
  - name: registry.example.com/shop/api # match the base image name
    newTag: 1.4.2 # override just the tag

replicas:
  - name: api # the ORIGINAL name, before namePrefix
    count: 6

configMapGenerator:
  - name: app-config
    behavior: merge # merge into the base's generator
    literals:
      - LOG_LEVEL=warn

patches:
  - path: patch-resources.yaml
    target:
      kind: Deployment
      name: api
---
# overlays/prod/patch-resources.yaml - a strategic-merge patch
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api # must match the target
spec:
  template:
    spec:
      containers:
        - name: api # merged by container name, not replaced
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 1Gi`,
      explanation:
        'The patch only mentions the fields it changes. Because strategic merge keys containers by `name`, the probe, ports and envFrom from the base survive untouched.',
      placeholders: ['shop-prod', 'registry.example.com/shop/api'],
    },
    {
      title: 'A JSON 6902 patch, for what merge cannot do',
      language: 'yaml',
      code: `# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: shop-dev
resources:
  - ../../base

patches:
  - target:
      kind: Deployment
      name: api
    # Inline JSON 6902: explicit operations, including remove
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 1
      - op: remove
        path: /spec/template/spec/containers/0/resources/limits
      - op: add
        path: /spec/template/spec/containers/0/env
        value:
          - name: DEBUG
            value: "true"`,
      explanation:
        'Use JSON 6902 when you need to *remove* a field or address a list element by index. A strategic-merge patch can add and change, but removing requires the `$patch: delete` directive or a JSON patch.',
      placeholders: ['shop-dev'],
    },
  ],
  imperative: [
    {
      command: 'kubectl kustomize ./overlays/prod',
      what: 'Renders the overlay to stdout without touching the cluster. Always do this before applying.',
      expected: 'The fully transformed manifests.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl apply -k ./overlays/prod',
      what: 'Builds and applies in one step.',
      expected: 'One created/configured line per object.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl diff -k ./overlays/prod',
      what: 'Shows what the apply would change against the live cluster.',
      expected: 'A unified diff, or no output when already in sync.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl delete -k ./overlays/prod',
      what: 'Deletes exactly the objects the overlay describes.',
      expected: 'One "deleted" line per object.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl kustomize ./overlays/prod | grep -E "image:|replicas:|namespace:"',
      what: 'A quick check that the image, replica and namespace transformers did what you expected.',
      expected: 'The overridden values, not the base ones.',
      placeholders: ['./overlays/prod'],
    },
    {
      command:
        'kustomize edit set image registry.example.com/shop/api=registry.example.com/shop/api:1.4.3',
      what: 'If the standalone `kustomize` binary is available, edits kustomization.yaml in place. Run it in the overlay directory.',
      expected: 'kustomization.yaml gains or updates an `images` entry.',
      placeholders: ['registry.example.com/shop/api:1.4.3'],
    },
    {
      command: 'kustomize edit set replicas api=6',
      what: 'Adds or updates a `replicas` entry without hand-editing YAML.',
      expected: 'A replicas block in kustomization.yaml.',
      placeholders: ['api'],
    },
  ],
  declarative: {
    steps: [
      'Put the common, environment-neutral manifests in `base/` with a `kustomization.yaml` listing them.',
      'Create one overlay directory per environment, each referencing `../../base` in `resources`.',
      'Prefer built-in transformers (`namespace`, `images`, `replicas`, `commonLabels`) over patches - they are shorter and harder to get wrong.',
      'Use a strategic-merge patch for structural changes, and a JSON 6902 patch when you must remove a field.',
      'Render with `kubectl kustomize` and read the output before every apply.',
    ],
    code: [
      {
        title: 'Build the structure from scratch',
        language: 'bash',
        code: `mkdir -p k8s/base k8s/overlays/{dev,prod}

# base
kubectl create deployment api --image=registry.example.com/shop/api:1.4.0 \\
  --dry-run=client -o yaml > k8s/base/deployment.yaml

cat > k8s/base/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
YAML

# prod overlay
cat > k8s/overlays/prod/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: shop-prod
resources:
  - ../../base
images:
  - name: registry.example.com/shop/api
    newTag: 1.4.2
replicas:
  - name: api
    count: 6
YAML

kubectl kustomize k8s/overlays/prod | grep -E 'image:|replicas:|namespace:'
#   namespace: shop-prod
#   replicas: 6
#         image: registry.example.com/shop/api:1.4.2`,
        placeholders: ['registry.example.com/shop/api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl kustomize ./overlays/prod | grep "image:"',
      what: 'Confirms the images transformer produced the intended tag.',
      expected: 'image: registry.example.com/shop/api:1.4.2',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl get deploy -n shop-prod',
      what: "Confirms the applied objects landed in the overlay's namespace with the overlay's name prefix.",
      expected: 'prod-api with READY 6/6.',
      placeholders: ['shop-prod'],
    },
    {
      command: 'kubectl get cm -n shop-prod',
      what: 'Shows the hash-suffixed generated ConfigMap name.',
      expected: 'prod-app-config-<hash>',
      placeholders: ['shop-prod'],
    },
    {
      command:
        'kubectl get deploy prod-api -n shop-prod -o jsonpath=\'{.spec.template.spec.containers[0].envFrom[0].configMapRef.name}{"\\n"}\'',
      what: 'Proves Kustomize rewrote the reference to point at the hashed ConfigMap name.',
      expected: 'prod-app-config-<hash>, matching the ConfigMap that exists.',
      placeholders: ['prod-api', 'shop-prod'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl kustomize ./overlays/prod',
      what: 'Almost every Kustomize problem is visible in the rendered output. Read it before debugging the cluster.',
      expected: 'Valid manifests, or an error naming the offending file and field.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl kustomize ./overlays/prod 2>&1 | head -5',
      what: 'A patch whose target does not exist fails the build with a clear message.',
      expected:
        'no matches for Id Deployment.v1.apps/api.[noNs]; failed to find unique target for patch.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'ls ./overlays/prod',
      what: 'The file must be named exactly `kustomization.yaml` (or `kustomization.yml`, or `Kustomization`). Anything else is not found.',
      expected: 'kustomization.yaml present.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl diff -k ./overlays/prod',
      what: 'Distinguishes "the build is wrong" from "the cluster has drifted".',
      expected: 'Empty output when in sync.',
      placeholders: ['./overlays/prod'],
    },
    {
      command: 'kubectl get cm -n shop-prod --show-labels',
      what: 'If Pods reference a ConfigMap that does not exist, the generated name hash has changed but something references the old name.',
      expected: 'The hashed ConfigMap the Deployment references.',
      placeholders: ['shop-prod'],
    },
  ],
  commonMistakes: [
    'Naming the file `kustomize.yaml` or `Kustomization.yaml` with the wrong case. It must be `kustomization.yaml`, `kustomization.yml` or `Kustomization`.',
    'Using `patchesStrategicMerge`/`patchesJson6902`, which are deprecated in favour of the single `patches` field.',
    'Referencing the prefixed name in a `replicas` or `patches` target. Transformers match the *original* resource name; `namePrefix` is applied afterwards.',
    'Adding `commonLabels` to an existing Deployment - it also modifies `spec.selector`, which is immutable, so the apply fails. Use `commonAnnotations` or `labels` without selector inclusion instead.',
    'Forgetting that generated ConfigMap names carry a hash, then hard-coding the un-hashed name somewhere Kustomize cannot rewrite.',
    'Applying without rendering first, then debugging in the cluster what `kubectl kustomize` would have shown instantly.',
    'Putting environment-specific values in the base, which defeats the whole structure.',
  ],
  examTips: [
    '`kubectl kustomize <dir>` first, `kubectl apply -k <dir>` second. Always.',
    '"Change the image tag for the production overlay" → an `images` entry with `newTag`, not a patch.',
    '"Change the replica count per environment" → a `replicas` entry, not a patch.',
    '"Add a field to one container" → a strategic-merge patch that names the container.',
    '"Remove a field" → a JSON 6902 patch with `op: remove`.',
    'Remember Kustomize is built into kubectl, so no extra installation is needed - `kubectl apply -k` works out of the box.',
    'If a build error mentions "failed to find unique target", your patch target selector is wrong.',
  ],
  summary: [
    'Kustomize transforms plain YAML - no templates, and the base stays deployable.',
    'Overlays list the base in `resources` and layer transformers and patches on top.',
    'Prefer built-in transformers (`namespace`, `images`, `replicas`, `namePrefix`) over patches.',
    '`patches` covers both strategic-merge and JSON 6902; JSON 6902 is what you need to remove a field.',
    'Generators hash-suffix ConfigMap/Secret names and rewrite references, so config changes trigger rollouts automatically.',
    '`kubectl kustomize` renders, `kubectl apply -k` applies, `kubectl diff -k` previews.',
  ],
  practice: [
    {
      id: 'kust-p1',
      level: 'beginner',
      prompt: 'Which command renders an overlay without applying it, and which applies it?',
      answer:
        'Render: `kubectl kustomize ./overlays/prod`. Apply: `kubectl apply -k ./overlays/prod`.',
      explanation:
        'Note the difference in form: `kustomize` is a subcommand taking a directory; `-k` is a flag on `apply`, `diff` and `delete`.',
    },
    {
      id: 'kust-p2',
      level: 'intermediate',
      prompt:
        'The base sets `image: registry.example.com/shop/api:1.4.0`. Write the overlay fragment that changes only the tag to 1.4.2 without a patch.',
      answer: 'images:\n  - name: registry.example.com/shop/api\n    newTag: 1.4.2',
      explanation:
        '`name` matches the image name in the base *without* the tag. Add `newName` as well if the repository itself changes. This rewrites the image everywhere it appears in the build - Deployments, CronJobs, StatefulSets.',
    },
    {
      id: 'kust-p3',
      level: 'advanced',
      prompt:
        'An overlay uses `namePrefix: prod-` and needs to set replicas to 6 on the base Deployment named `api`. A `replicas` entry with `name: prod-api` does not work. Why, and what is correct?',
      answer:
        'Transformers match the resource name as it exists in the build *before* `namePrefix` is applied, so the entry must use the original name:\n\nreplicas:\n  - name: api\n    count: 6\n\nThe prefix is added afterwards, producing `prod-api` in the output.',
      explanation:
        'The same applies to `patches` targets and `images` matches. Render with `kubectl kustomize` and look at the resulting name to confirm - if your transformer silently did nothing, a name mismatch is the usual cause.',
    },
  ],
  lab: {
    title: 'Build a base and two overlays from scratch',
    scenario:
      'You will create a real base/overlay structure, use the images and replicas transformers, add a strategic-merge patch, use a configMapGenerator, and observe the hash-suffixed ConfigMap that makes config changes trigger rollouts.',
    prerequisites: ['A cluster and kubectl (Kustomize is built in - no extra install needed)'],
    tasks: [
      {
        instruction:
          'Create the directory structure `kust-lab/base` and `kust-lab/overlays/{dev,prod}`.',
      },
      {
        instruction:
          'Write a base Deployment for `nginx:1.26-alpine` named `web` with 1 replica, plus a base kustomization and a configMapGenerator with `LOG_LEVEL=info`.',
      },
      { instruction: 'Write a dev overlay: namespace `kust-dev`, 1 replica, LOG_LEVEL=debug.' },
      {
        instruction:
          'Write a prod overlay: namespace `kust-prod`, namePrefix `prod-`, image tag 1.27-alpine, 3 replicas, and a patch raising resource requests.',
      },
      { instruction: 'Render both overlays and confirm the differences before applying anything.' },
      { instruction: 'Apply both overlays and verify the objects in each namespace.' },
      {
        instruction:
          'Change LOG_LEVEL in the dev overlay, re-render, and observe the ConfigMap name hash change.',
      },
      { instruction: 'Delete both overlays and the namespaces.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the base',
        language: 'bash',
        code: `mkdir -p kust-lab/base kust-lab/overlays/dev kust-lab/overlays/prod
cd kust-lab

cat > base/deployment.yaml <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
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
          envFrom:
            - configMapRef:
                name: app-config
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
YAML

cat > base/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
configMapGenerator:
  - name: app-config
    literals:
      - LOG_LEVEL=info
YAML`,
      },
      {
        title: 'Steps 3-4 - the two overlays',
        language: 'bash',
        code: `cat > overlays/dev/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: kust-dev
resources:
  - ../../base
replicas:
  - name: web
    count: 1
configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - LOG_LEVEL=debug
YAML

cat > overlays/prod/patch-resources.yaml <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  template:
    spec:
      containers:
        - name: nginx
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi
YAML

cat > overlays/prod/kustomization.yaml <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: kust-prod
namePrefix: prod-
resources:
  - ../../base
commonAnnotations:
  environment: production
images:
  - name: nginx
    newTag: 1.27-alpine
replicas:
  - name: web       # the ORIGINAL name, before namePrefix
    count: 3
patches:
  - path: patch-resources.yaml
    target:
      kind: Deployment
      name: web
YAML`,
      },
      {
        title: 'Step 5 - render and compare',
        language: 'bash',
        code: `kubectl kustomize overlays/dev | grep -E 'name:|namespace:|replicas:|image:|LOG_LEVEL'
#   name: app-config-<hashA>
#   namespace: kust-dev
#   LOG_LEVEL: debug
#   name: web
#   replicas: 1
#         image: nginx:1.26-alpine

kubectl kustomize overlays/prod | grep -E 'name:|namespace:|replicas:|image:|cpu:'
#   name: prod-app-config-<hashB>
#   namespace: kust-prod
#   name: prod-web
#   replicas: 3
#         image: nginx:1.27-alpine
#             cpu: 200m
#             cpu: "1"`,
      },
      {
        title: 'Step 6 - apply and verify',
        language: 'bash',
        code: `kubectl create namespace kust-dev
kubectl create namespace kust-prod

kubectl apply -k overlays/dev
kubectl apply -k overlays/prod

kubectl get deploy,cm -n kust-dev
# deployment.apps/web        1/1
# configmap/app-config-<hashA>

kubectl get deploy,cm -n kust-prod
# deployment.apps/prod-web   3/3
# configmap/prod-app-config-<hashB>

# The reference was rewritten to the hashed name:
kubectl get deploy prod-web -n kust-prod \\
  -o jsonpath='{.spec.template.spec.containers[0].envFrom[0].configMapRef.name}{"\\n"}'
# prod-app-config-<hashB>`,
      },
      {
        title: 'Step 7 - the hash changes when content changes',
        language: 'bash',
        code: `BEFORE=$(kubectl kustomize overlays/dev | grep -m1 'name: app-config')
sed -i 's/LOG_LEVEL=debug/LOG_LEVEL=trace/' overlays/dev/kustomization.yaml
AFTER=$(kubectl kustomize overlays/dev | grep -m1 'name: app-config')

echo "before: $BEFORE"
echo "after:  $AFTER"
# Different hashes - so applying creates a NEW ConfigMap and changes the
# Deployment's Pod template, which triggers a rolling update automatically.

kubectl apply -k overlays/dev
kubectl rollout status deploy/web -n kust-dev --timeout=120s`,
      },
      {
        title: 'Step 8 - cleanup',
        language: 'bash',
        code: `kubectl delete -k overlays/dev
kubectl delete -k overlays/prod
kubectl delete namespace kust-dev kust-prod
cd .. && rm -rf kust-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get deploy -n kust-prod',
        what: 'Confirms namePrefix and the replicas transformer both applied.',
        expected: 'prod-web with READY 3/3.',
      },
      {
        command:
          'kubectl get deploy prod-web -n kust-prod -o jsonpath=\'{.spec.template.spec.containers[0].image}{"\\n"}\'',
        what: 'Confirms the images transformer overrode the base tag.',
        expected: 'nginx:1.27-alpine',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace kust-dev kust-prod',
        what: 'Removes both environments.',
        expected: 'Two "deleted" lines.',
      },
    ],
  },
  relatedTopicIds: ['helm-fundamentals', 'choosing-deployment-tooling', 'configmaps'],
  docs: [
    {
      title: 'Declarative management using Kustomize',
      url: 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/',
    },
    {
      title: 'Kustomize reference',
      url: 'https://kubectl.docs.kubernetes.io/references/kustomize/',
    },
  ],
}
