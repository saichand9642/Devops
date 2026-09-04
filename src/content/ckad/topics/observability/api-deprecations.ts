import type { Topic } from '../../../types'

export const apiDeprecations: Topic = {
  id: 'api-deprecations',
  title: 'Understanding API deprecations',
  domainId: 'observability',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 7,
  tags: ['deprecation', 'apiVersion', 'api-versions', 'convert', 'beta', 'GA', 'removal'],
  oneLiner:
    'How Kubernetes APIs move from alpha to GA, how to spot a manifest using a removed version, and how to migrate it.',
  explanation: [
    '"Understand API deprecations" is an explicit curriculum competency. It is about knowing that `apiVersion` values change over time, how to tell which version a cluster serves, and how to update a manifest that uses an old one.',
    'API maturity levels: **alpha** (`v1alpha1`) - off by default, may change or vanish in any release, no support guarantee. **beta** (`v1beta1`) - enabled by default historically (newer betas are opt-in), may still change, and supported for a bounded number of releases after a successor appears. **stable/GA** (`v1`) - will not be removed from that API group without a major version change.',
    'The deprecation policy in practice: a GA API is supported for at least 12 months or 3 releases after deprecation, whichever is longer. Beta APIs get 9 months or 3 releases. Alpha can go at any time.',
    'When an API version is *removed*, manifests using it stop working with a hard error: `no matches for kind "Ingress" in version "extensions/v1beta1"`. Nothing is silently converted at rest - though the API server will happily serve the same object under a newer version if one exists.',
    'The historical migrations you should recognise, because old tutorials still show them: Deployment moved from `extensions/v1beta1` and `apps/v1beta1`/`apps/v1beta2` to **apps/v1**; Ingress from `extensions/v1beta1` and `networking.k8s.io/v1beta1` to **networking.k8s.io/v1**; CronJob from `batch/v1beta1` to **batch/v1**; CRDs from `apiextensions.k8s.io/v1beta1` to **v1**; PodSecurityPolicy (`policy/v1beta1`) was removed entirely and replaced by Pod Security Admission.',
  ],
  whyItMatters: [
    'Copying a manifest from an old blog post is the fastest way to fail a task with a confusing error. Recognising `extensions/v1beta1` as long dead saves you from debugging YAML that was correct in 2018.',
    'Every cluster upgrade is a deprecation event for someone. Being able to answer "does this cluster still serve that version?" in one command is a practical operational skill.',
    'The Ingress migration in particular changed field *shapes* as well as the version - `serviceName`/`servicePort` became a nested `service` object, and `pathType` became required - so a version change is not always a one-line edit.',
  ],
  howItWorks: [
    '`kubectl api-versions` lists every group/version the cluster currently serves. If a version is not in that list, no manifest using it can be applied.',
    '`kubectl api-resources` maps each kind to its **preferred** version - the one the API server returns by default and the one you should write.',
    'Objects are stored once and served in any supported version of their group. So an object created as `apps/v1beta2` is readable as `apps/v1` after an upgrade; it is your *manifests* that need updating, not the stored data.',
    'Deprecation warnings are returned by the API server and printed by kubectl: `Warning: batch/v1beta1 CronJob is deprecated in v1.21+, unavailable in v1.25+; use batch/v1 CronJob`. Read them - they name the replacement.',
    '`kubectl convert` (a plugin, not built in since 1.20) rewrites a manifest from one version to another. On the exam, expect to edit the `apiVersion` and any changed fields by hand.',
    'For CustomResourceDefinitions, multiple versions can be served simultaneously with one marked `storage: true`, and a conversion webhook can translate between them. That is the CRD-specific version of the same idea.',
    '`kubectl explain <kind> --api-version=<group/version>` shows the field set for a specific version, which is how you find out what changed between two versions.',
  ],
  keyObjects: [
    {
      kind: 'CustomResourceDefinition',
      apiVersion: 'apiextensions.k8s.io/v1',
      purpose: 'Where you can see the versioning machinery applied to your own APIs.',
      fields: [
        { path: 'spec.versions[].name', meaning: 'A served version, e.g. v1alpha1, v1beta1, v1.' },
        {
          path: 'spec.versions[].served',
          meaning: 'Whether the API server accepts requests for this version.',
        },
        {
          path: 'spec.versions[].storage',
          meaning: 'Exactly one version must be the storage version.',
        },
        {
          path: 'spec.versions[].deprecated',
          meaning: 'true makes the API server emit a deprecation warning.',
        },
        {
          path: 'spec.versions[].deprecationWarning',
          meaning: 'Custom warning text returned to clients.',
        },
        {
          path: 'spec.conversion.strategy',
          meaning: 'None or Webhook, for translating between versions.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A manifest that worked for three years and then did not',
    story: [
      'A team upgrades a cluster and their CI pipeline fails: `error: unable to recognize "ingress.yaml": no matches for kind "Ingress" in version "extensions/v1beta1"`.',
      'The manifest had been unchanged since 2019 and had been quietly working because the cluster still served the old version. The upgrade removed it.',
      'Changing `apiVersion` alone was not enough. In `networking.k8s.io/v1` the backend shape changed from `serviceName`/`servicePort` to a nested `service: {name, port: {number}}`, `pathType` became required, and `spec.ingressClassName` replaced the `kubernetes.io/ingress.class` annotation.',
      'The fix took ten minutes with `kubectl explain ingress.spec.rules.http.paths --api-version=networking.k8s.io/v1` open in another terminal - it lists exactly the fields the new version expects.',
      'They then added `kubectl apply --dry-run=server` to CI against the next Kubernetes version, so the *next* removal is caught before it reaches production.',
    ],
    code: [
      {
        title: 'The error, then the check that explains it',
        language: 'bash',
        code: `kubectl apply -f ingress.yaml
# error: unable to recognize "ingress.yaml": no matches for kind "Ingress"
# in version "extensions/v1beta1"

# Which versions DOES this cluster serve?
kubectl api-versions | grep -E 'networking|extensions'
# networking.k8s.io/v1
# (no extensions/v1beta1 - it is gone)

# What is the preferred version for this kind?
kubectl api-resources | grep -i ingress
# ingresses    ing    networking.k8s.io/v1    true    Ingress

# What fields does the new version expect?
kubectl explain ingress.spec.rules.http.paths --api-version=networking.k8s.io/v1`,
        explanation:
          'Three commands take you from an opaque error to the exact new field list. None of them require a browser.',
        placeholders: ['ingress.yaml'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Ingress: the old version and its modern equivalent',
      language: 'yaml',
      code: `# REMOVED - do not use. Kept here only so you recognise it in old material.
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: shop
  annotations:
    kubernetes.io/ingress.class: nginx # became a first-class field
spec:
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            backend:
              serviceName: api # flat fields
              servicePort: 80
---
# CURRENT
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx # replaces the annotation
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix # now REQUIRED
            backend:
              service: # nested object
                name: api
                port:
                  number: 80`,
      explanation:
        'Three separate changes in one migration: a new group/version, a restructured backend, and a newly required field. This is why "just change the apiVersion" is not a general rule.',
      placeholders: ['shop', 'shop.example.com'],
    },
    {
      title: 'The other migrations worth recognising',
      language: 'yaml',
      code: `# Deployment: extensions/v1beta1, apps/v1beta1, apps/v1beta2  ->  apps/v1
# (apps/v1 also made spec.selector REQUIRED, which the betas defaulted)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  selector: # required in apps/v1; was optional in the betas
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
---
# CronJob: batch/v1beta1  ->  batch/v1
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: busybox:1.36
              command: ["sh", "-c", "echo report"]
---
# CustomResourceDefinition: apiextensions.k8s.io/v1beta1  ->  v1
# (v1 made spec.versions[].schema REQUIRED - no more schemaless CRDs)
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.shop.example.com
spec:
  group: shop.example.com
  scope: Namespaced
  names:
    plural: backups
    singular: backup
    kind: Backup
  versions:
    - name: v1
      served: true
      storage: true
      schema: # required in apiextensions.k8s.io/v1
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                schedule:
                  type: string
---
# PodSecurityPolicy (policy/v1beta1) was REMOVED with no successor object.
# Its replacement is Pod Security Admission, configured with namespace labels:
apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted`,
      explanation:
        'Note the pattern: promotions to GA usually *tighten* validation. `apps/v1` made selectors required, `apiextensions.k8s.io/v1` made schemas required, `networking.k8s.io/v1` made pathType required.',
      placeholders: ['shop', 'shop.example.com'],
    },
  ],
  imperative: [
    {
      command: 'kubectl api-versions',
      what: 'Every group/version this cluster serves. If it is not listed, you cannot use it.',
      expected: 'Lines such as apps/v1, batch/v1, networking.k8s.io/v1.',
    },
    {
      command: 'kubectl api-versions | sort | grep -E "beta|alpha"',
      what: 'Which non-GA APIs the cluster still serves - the migration backlog.',
      expected: 'A short list, or nothing on a conservative cluster.',
    },
    {
      command: 'kubectl api-resources | grep -i cronjob',
      what: 'The preferred version for a kind - the one you should write in manifests.',
      expected: 'cronjobs cj batch/v1 true CronJob',
    },
    {
      command: 'kubectl explain ingress --api-version=networking.k8s.io/v1',
      what: 'Field documentation for a specific version, which is how you see what changed.',
      expected: 'FIELDS including ingressClassName, rules, tls.',
    },
    {
      command: 'kubectl version',
      what: 'Client and server versions. The server version tells you which deprecations apply.',
      expected: 'Client Version and Server Version lines.',
    },
    {
      command: 'kubectl apply -f old-manifest.yaml',
      what: 'A deprecated-but-present version applies with a warning; a removed version fails outright.',
      expected: 'Warning: ... is deprecated in v1.x+, unavailable in v1.y+; use ...',
      placeholders: ['old-manifest.yaml'],
    },
    {
      command:
        'kubectl apply -f manifests/ --dry-run=server 2>&1 | grep -i -E "warning|no matches"',
      what: 'Audits a whole directory for deprecation warnings and removed versions without changing anything.',
      expected: 'Warning lines naming each deprecated API in use.',
      placeholders: ['manifests/'],
    },
    {
      command: 'kubectl get deploy api -n shop -o jsonpath=\'{.apiVersion}{"\\n"}\'',
      what: 'The version the API server returned - always the preferred one, regardless of how the object was created.',
      expected: 'apps/v1',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'grep -rhoE "^apiVersion: .*" manifests/ | sort -u',
      what: 'A quick inventory of every apiVersion your manifests use, to compare against `kubectl api-versions`.',
      expected: 'A short deduplicated list.',
      placeholders: ['manifests/'],
    },
  ],
  declarative: {
    steps: [
      'Always write the **preferred** version from `kubectl api-resources`, never a version copied from an old tutorial.',
      'When an apply warns about deprecation, migrate then rather than later - the warning names the replacement.',
      'When migrating, check field shapes as well as the version with `kubectl explain <kind> --api-version=<new>`.',
      'Validate the whole manifest set against the target cluster with `kubectl apply --dry-run=server` before an upgrade.',
      'For your own CRDs, serve the new version alongside the old, mark exactly one as `storage: true`, and set `deprecated: true` on the outgoing one.',
    ],
    code: [
      {
        title: 'A pre-upgrade audit',
        language: 'bash',
        code: `# 1. What versions do our manifests use?
grep -rhoE "^apiVersion: .*" ./manifests/ | sort -u
# apiVersion: apps/v1
# apiVersion: batch/v1beta1        <- suspicious
# apiVersion: networking.k8s.io/v1
# apiVersion: v1

# 2. Does the cluster still serve them?
for v in $(grep -rhoE "^apiVersion: .*" ./manifests/ | awk '{print $2}' | sort -u); do
  kubectl api-versions | grep -qx "$v" && echo "OK      $v" || echo "MISSING $v"
done
# OK      apps/v1
# MISSING batch/v1beta1
# OK      networking.k8s.io/v1
# OK      v1

# 3. Confirm with a server dry run, which also surfaces warnings
kubectl apply -f ./manifests/ --dry-run=server 2>&1 | grep -iE 'warning|no matches'`,
        placeholders: ['./manifests/'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl apply -f manifest.yaml --dry-run=server',
      what: 'Confirms a migrated manifest validates against the live API server.',
      expected: '"(server dry run)" with no warnings.',
      placeholders: ['manifest.yaml'],
    },
    {
      command: 'kubectl api-versions | grep -x "networking.k8s.io/v1"',
      what: 'Confirms the target version is actually served before you rely on it.',
      expected: 'networking.k8s.io/v1',
    },
    {
      command:
        'kubectl get ingress shop -n shop -o jsonpath=\'{.apiVersion}{" "}{.spec.ingressClassName}{"\\n"}\'',
      what: 'Confirms the migrated object is stored and served under the new version with the new field populated.',
      expected: 'networking.k8s.io/v1 nginx',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl apply -f old.yaml',
      what: 'The removed-version error names both the kind and the version.',
      expected: 'no matches for kind "Ingress" in version "extensions/v1beta1"',
      placeholders: ['old.yaml'],
    },
    {
      command: 'kubectl api-resources | grep -i <kind>',
      what: 'Gives the correct current version for that kind, which is the fix.',
      expected: 'The kind with its preferred APIVERSION.',
    },
    {
      command: 'kubectl explain <kind>.spec --api-version=<new-version> --recursive | head -30',
      what: 'Reveals field renames and newly required fields in the new version.',
      expected: 'The new field tree.',
    },
    {
      command: 'kubectl apply -f manifest.yaml 2>&1 | grep -i warning',
      what: 'Deprecation warnings are easy to miss in a wall of output; grep for them.',
      expected: 'Warning lines, or nothing.',
      placeholders: ['manifest.yaml'],
    },
    {
      command:
        'kubectl get crd backups.shop.example.com -o jsonpath=\'{range .spec.versions[*]}{.name}{" served="}{.served}{" storage="}{.storage}{"\\n"}{end}\'',
      what: 'For CRDs, shows which versions are served and which is the storage version.',
      expected: 'v1beta1 served=true storage=false / v1 served=true storage=true',
      placeholders: ['backups.shop.example.com'],
    },
  ],
  commonMistakes: [
    'Copying `apiVersion: extensions/v1beta1` from an old tutorial. It has been removed for years.',
    'Changing only the `apiVersion` when the field shape also changed - the Ingress backend and required `pathType` are the classic example.',
    'Ignoring deprecation warnings from `kubectl apply`. They name the exact replacement and the release it becomes unavailable.',
    'Assuming stored objects break on upgrade. They do not - they are served under the newer version. It is your manifests that break.',
    'Expecting `kubectl convert` to be available. It has been a separate plugin since 1.20; edit by hand instead.',
    'Using an alpha API in anything you care about. It can change or disappear in the next release with no migration path.',
    'Forgetting that `apps/v1` made `spec.selector` required, so a beta-era Deployment manifest fails validation even after the version is corrected.',
  ],
  examTips: [
    '`kubectl api-resources | grep -i <kind>` gives you the right apiVersion in two seconds. Use it instead of remembering.',
    'If an apply says "no matches for kind X in version Y", the version is removed - look up the current one, do not debug the YAML.',
    'After changing a version, run `kubectl explain <kind>.<path> --api-version=<new>` to check the field names still exist.',
    'Read warnings printed by kubectl. On a version-aligned exam cluster they are the fastest hint you will get.',
    'Remember the four migrations by heart: Deployment → apps/v1, CronJob → batch/v1, Ingress → networking.k8s.io/v1, CRD → apiextensions.k8s.io/v1.',
    '`--dry-run=server` surfaces both validation errors and deprecation warnings without creating anything.',
  ],
  summary: [
    'alpha → beta → GA, with support windows: GA 12 months / 3 releases, beta 9 months / 3 releases, alpha none.',
    '`kubectl api-versions` lists what is served; `kubectl api-resources` gives the preferred version to write.',
    'A removed version fails with "no matches for kind ... in version ..." - it is a manifest problem, not a data problem.',
    'Migrations often change field shapes too: Ingress backends, required `pathType`, required `spec.selector` in apps/v1, required CRD schemas.',
    '`kubectl explain --api-version=` and `--dry-run=server` are the two tools that make a migration quick.',
  ],
  practice: [
    {
      id: 'dep-p1',
      level: 'beginner',
      prompt:
        'An apply fails with `no matches for kind "CronJob" in version "batch/v1beta1"`. What is wrong and what is the current version?',
      answer:
        'The `batch/v1beta1` version has been removed from the cluster. The current version is `batch/v1`. Confirm with `kubectl api-resources | grep -i cronjob`.',
      explanation:
        'CronJob went GA as `batch/v1` in Kubernetes 1.21 and `batch/v1beta1` was removed in 1.25. For CronJob the field structure is unchanged, so this really is a one-line edit.',
    },
    {
      id: 'dep-p2',
      level: 'intermediate',
      prompt:
        'You change an Ingress from `extensions/v1beta1` to `networking.k8s.io/v1` and the apply still fails. Name the two other changes required.',
      answer:
        '1. The backend shape: `serviceName: api` / `servicePort: 80` becomes `service: {name: api, port: {number: 80}}`.\n2. `pathType` is now required on each path (`Prefix`, `Exact` or `ImplementationSpecific`).\n\nAlso worth changing: the `kubernetes.io/ingress.class` annotation is replaced by `spec.ingressClassName`.',
      explanation:
        '`kubectl explain ingress.spec.rules.http.paths --api-version=networking.k8s.io/v1 --recursive` lists all of this. A version bump is not always a version bump alone.',
    },
    {
      id: 'dep-p3',
      level: 'advanced',
      prompt:
        'Write the commands that audit a directory of manifests for apiVersions the current cluster does not serve.',
      answer:
        'grep -rhoE "^apiVersion: .*" ./manifests/ | awk \'{print $2}\' | sort -u > /tmp/used.txt\nkubectl api-versions | sort > /tmp/served.txt\ncomm -23 /tmp/used.txt /tmp/served.txt      # used but NOT served\n\nThen confirm with:\nkubectl apply -f ./manifests/ --dry-run=server 2>&1 | grep -iE "warning|no matches"',
      explanation:
        '`comm -23` prints lines only in the first file - exactly the manifests that will fail. The server dry run is the authoritative second check, because it also catches field-level validation changes that a version comparison cannot see.',
    },
  ],
  lab: {
    title: 'Break a manifest with an old API, then migrate it',
    scenario:
      'You will discover which versions your cluster serves, deliberately apply a manifest with a removed version, read the error, and migrate it correctly - including the field changes a version bump alone does not cover.',
    prerequisites: ['A cluster on a recent Kubernetes version'],
    tasks: [
      { instruction: 'Create namespace `dep-lab` and set it as default.' },
      { instruction: 'List every group/version the cluster serves, and pick out the beta ones.' },
      {
        instruction:
          'Find the preferred apiVersion for Deployment, CronJob, Ingress and CRD in one command each.',
      },
      {
        instruction:
          'Write an Ingress manifest using `extensions/v1beta1` and apply it; record the exact error.',
      },
      {
        instruction:
          'Use kubectl explain to find the current field structure for an Ingress path and backend.',
      },
      {
        instruction:
          'Rewrite the Ingress for `networking.k8s.io/v1` with `ingressClassName`, `pathType` and the nested service backend, and apply it successfully.',
      },
      { instruction: 'Confirm the stored object is served as `networking.k8s.io/v1`.' },
      { instruction: 'Audit a small directory of manifests for unserved versions.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - discovery',
        language: 'bash',
        code: `kubectl create namespace dep-lab
kubectl config set-context --current --namespace=dep-lab

kubectl api-versions | sort | head -20
kubectl api-versions | grep -E 'beta|alpha' || echo "no non-GA APIs served"

for k in deployment cronjob ingress customresourcedefinition; do
  kubectl api-resources | grep -iE "^\${k}s? " || kubectl api-resources | grep -i "$k"
done
# deployments    deploy   apps/v1                     true    Deployment
# cronjobs       cj       batch/v1                    true    CronJob
# ingresses      ing      networking.k8s.io/v1        true    Ingress
# customresourcedefinitions  crd  apiextensions.k8s.io/v1  false  CustomResourceDefinition`,
      },
      {
        title: 'Step 4 - the removed version',
        language: 'bash',
        code: `mkdir -p /tmp/dep-lab && cd /tmp/dep-lab

cat > ingress-old.yaml <<'YAML'
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: shop
  namespace: dep-lab
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            backend:
              serviceName: api
              servicePort: 80
YAML

kubectl apply -f ingress-old.yaml
# error: unable to recognize "ingress-old.yaml": no matches for kind "Ingress"
# in version "extensions/v1beta1"`,
      },
      {
        title: 'Step 5 - find the new field shape',
        language: 'bash',
        code: `kubectl explain ingress.spec.rules.http.paths --api-version=networking.k8s.io/v1
# FIELDS:
#   backend  <IngressBackend> -required-
#   path     <string>
#   pathType <string> -required-

kubectl explain ingress.spec.rules.http.paths.backend.service --api-version=networking.k8s.io/v1
# FIELDS:
#   name  <string> -required-
#   port  <ServiceBackendPort>

kubectl explain ingress.spec --api-version=networking.k8s.io/v1 | grep -i class
#   ingressClassName  <string>`,
      },
      {
        title: 'Steps 6-7 - the migrated manifest',
        language: 'bash',
        code: `cat > ingress-new.yaml <<'YAML'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: dep-lab
spec:
  ingressClassName: nginx        # replaces the annotation
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix     # now required
            backend:
              service:           # nested, not flat
                name: api
                port:
                  number: 80
YAML

kubectl apply -f ingress-new.yaml --dry-run=server
# ingress.networking.k8s.io/shop created (server dry run)

kubectl apply -f ingress-new.yaml
kubectl get ingress shop -o jsonpath='{.apiVersion}{" class="}{.spec.ingressClassName}{"\\n"}'
# networking.k8s.io/v1 class=nginx`,
      },
      {
        title: 'Steps 8-9 - audit and cleanup',
        language: 'bash',
        code: `# A directory containing one good and one bad manifest
cat > cronjob-old.yaml <<'YAML'
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: nightly
  namespace: dep-lab
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: c
              image: busybox:1.36
              command: ["echo", "hi"]
YAML

grep -rhoE "^apiVersion: .*" . | awk '{print $2}' | sort -u > /tmp/used.txt
kubectl api-versions | sort > /tmp/served.txt
comm -23 /tmp/used.txt /tmp/served.txt
# batch/v1beta1
# extensions/v1beta1
#   ^ the two that will fail

kubectl apply -f . --dry-run=server 2>&1 | grep -iE 'warning|no matches'

cd - >/dev/null
rm -rf /tmp/dep-lab /tmp/used.txt /tmp/served.txt
kubectl config set-context --current --namespace=default
kubectl delete namespace dep-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get ingress shop -n dep-lab -o jsonpath=\'{.spec.rules[0].http.paths[0].pathType}{"\\n"}\'',
        what: 'Confirms the newly required field is set.',
        expected: 'Prefix',
      },
      {
        command: 'kubectl api-versions | grep -cx "extensions/v1beta1"',
        what: 'Confirms the old version really is absent from the cluster.',
        expected: '0',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace dep-lab',
        what: 'Removes the Ingress and namespace.',
        expected: 'namespace "dep-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['yaml-and-api-discovery', 'ingress', 'crds-and-operators'],
  docs: [
    {
      title: 'Deprecated API migration guide',
      url: 'https://kubernetes.io/docs/reference/using-api/deprecation-guide/',
    },
    {
      title: 'Kubernetes deprecation policy',
      url: 'https://kubernetes.io/docs/reference/using-api/deprecation-policy/',
    },
    {
      title: 'API versioning',
      url: 'https://kubernetes.io/docs/reference/using-api/#api-versioning',
    },
  ],
}
