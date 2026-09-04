import type { Topic } from '../../../types'

export const crdsAndOperators: Topic = {
  id: 'crds-and-operators',
  title: 'CustomResourceDefinitions and operators',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 10,
  tags: [
    'crd',
    'custom resource',
    'operator',
    'apiextensions',
    'shortNames',
    'printercolumns',
    'controller',
  ],
  oneLiner:
    'How Kubernetes gets new resource types, how to discover and use ones that already exist, and what an operator adds on top.',
  explanation: [
    'A **CustomResourceDefinition (CRD)** teaches the API server a new kind. Once one is installed, that kind behaves like any built-in resource: `kubectl get`, `kubectl describe`, RBAC, labels, `kubectl explain` and watch all work on it.',
    'The curriculum wording is "discover and use resources that extend Kubernetes (CRD, Operators)". Discovery and use are the emphasis - you are far more likely to be asked to find and manipulate an existing custom resource than to author a CRD from scratch.',
    'A CRD by itself only stores data. Nothing happens when you create a custom resource unless a **controller** is watching for it. An **operator** is that controller: a program running in the cluster that reconciles custom resources into real Kubernetes objects - creating StatefulSets, Secrets, Services and so on.',
    "The pattern is the same reconciliation loop the built-in controllers use. A `Backup` custom resource is a desired state; the backup operator notices it, creates a Job, watches the Job, and writes the outcome back into the resource's `status`.",
    'Discovery is the practical skill: `kubectl get crd` lists installed CRDs, `kubectl api-resources` shows their short names and groups, and `kubectl explain <kind>` documents their fields from the schema the CRD carries.',
  ],
  whyItMatters: [
    'Real clusters are full of custom resources - Certificates, Ingresses from a mesh, Prometheus ServiceMonitors, database clusters. Being able to explore one you have never seen is a core operational skill.',
    'The "CRD without a controller does nothing" insight explains a genuinely confusing situation: `kubectl apply` succeeds, the object exists, and nothing happens.',
    "CRDs are cluster-scoped objects that define namespaced or cluster-scoped resources, and RBAC for them uses the CRD's own API group - both are easy to get wrong.",
  ],
  howItWorks: [
    'A CRD names a `group`, one or more `versions`, a `scope` (`Namespaced` or `Cluster`), and `names` (plural, singular, kind, shortNames). The resulting API path is `/apis/<group>/<version>/namespaces/<ns>/<plural>`.',
    'In `apiextensions.k8s.io/v1` a **schema is required**: each version needs `schema.openAPIV3Schema`, which the API server uses to validate custom resources and which `kubectl explain` reads. Schemaless CRDs were only possible in the removed v1beta1.',
    '`x-kubernetes-preserve-unknown-fields: true` allows arbitrary extra fields under a subtree, which some CRDs use for pass-through configuration. Without it, unknown fields are pruned silently.',
    'Multiple versions can be served at once; exactly one must have `storage: true`. Conversion between versions is `None` (identical schemas) or a `Webhook`.',
    "The `status` subresource (`subresources: {status: {}}`) splits `/status` from the main resource so a controller can update status without racing the user's spec edits. The `scale` subresource makes `kubectl scale` work on a custom resource.",
    '`additionalPrinterColumns` control what `kubectl get <kind>` shows - which is why a well-built CRD gives useful output instead of just NAME and AGE.',
    'RBAC for custom resources uses the CRD\'s group: `apiGroups: ["shop.example.com"]`, `resources: ["backups"]`. The built-in `view`/`edit`/`admin` roles do *not* automatically cover custom resources unless the CRD ships aggregation labels.',
    'Deleting a CRD deletes every custom resource of that kind, cluster-wide. Finalizers set by an operator can make that deletion hang until the operator releases them.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'A CRD adds a kind; a controller gives it meaning',
      caption:
        'Install a CRD and kubectl accepts the new kind immediately - and does nothing with it. The controller is what makes it real.',
      nodes: [
        {
          label: 'Apply the CustomResourceDefinition',
          detail: 'Declares group, version, kind, and a schema',
          tone: 'accent',
        },
        {
          label: 'The API server serves a new endpoint',
          detail: 'kubectl api-resources now lists your kind',
          arrowLabel: 'API extended',
        },
        {
          label: 'You create a custom resource',
          detail: 'kubectl apply -f my-backup.yaml',
        },
        {
          label: 'It is stored in etcd - and nothing happens',
          detail: 'A CRD alone is only a typed record',
          tone: 'warning',
          branch: {
            label: 'No controller installed',
            detail: 'The object sits there forever. This is expected.',
          },
        },
        {
          label: 'The operator reconciles it',
          detail: 'Watches your kind, creates real Pods and Services',
          arrowLabel: 'controller running',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'sequence',
      title: 'The reconcile loop every operator runs',
      caption:
        'Observe, compare, act, record. Every Kubernetes controller - built-in or custom - is this loop.',
      participants: [
        { id: 'op', label: 'Operator' },
        { id: 'api', label: 'API server' },
        { id: 'real', label: 'Real objects' },
      ],
      messages: [
        { from: 'op', to: 'api', label: 'watch my custom kind' },
        { from: 'api', to: 'op', label: 'a Backup was created', kind: 'return' },
        { from: 'op', to: 'op', label: 'compare spec with what exists' },
        { from: 'op', to: 'real', label: 'create the Job that does the backup' },
        { from: 'real', to: 'op', label: 'Job succeeded', kind: 'return' },
        { from: 'op', to: 'api', label: 'write status.phase: Completed' },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'CustomResourceDefinition',
      apiVersion: 'apiextensions.k8s.io/v1',
      purpose: 'Registers a new resource kind with the API server. Cluster-scoped.',
      fields: [
        { path: 'spec.group', meaning: 'API group, e.g. shop.example.com.', required: true },
        { path: 'spec.scope', meaning: 'Namespaced or Cluster.', required: true },
        {
          path: 'spec.names.plural',
          meaning: 'URL path segment; also the RBAC resource name.',
          required: true,
        },
        { path: 'spec.names.kind', meaning: 'PascalCase kind used in manifests.', required: true },
        { path: 'spec.names.shortNames[]', meaning: 'kubectl aliases, e.g. bkp.' },
        {
          path: 'spec.versions[].name',
          meaning: 'A served version such as v1alpha1 or v1.',
          required: true,
        },
        {
          path: 'spec.versions[].served',
          meaning: 'Whether the API server accepts this version.',
          required: true,
        },
        {
          path: 'spec.versions[].storage',
          meaning: 'Exactly one version must be true.',
          required: true,
        },
        {
          path: 'spec.versions[].schema.openAPIV3Schema',
          meaning: 'Required in v1; drives validation and kubectl explain.',
          required: true,
        },
        {
          path: 'spec.versions[].subresources.status',
          meaning: 'Enables a separate /status endpoint for controllers.',
        },
        {
          path: 'spec.versions[].additionalPrinterColumns[]',
          meaning: 'Extra columns for kubectl get.',
        },
        { path: 'metadata.name', meaning: 'Must be <plural>.<group>.', required: true },
      ],
    },
  ],
  realWorldExample: {
    title: 'The Backup that never ran',
    story: [
      'An engineer is told the platform supports scheduled database backups through a `Backup` custom resource. They write one, apply it, and `kubectl get backups` shows it. Nothing is backed up.',
      '`kubectl get backups shop-nightly -o yaml` shows a `spec` and no `status` at all. That absence is the clue: a controller would have written a status by now.',
      '`kubectl get pods -A | grep backup` returns nothing. The CRD had been installed, but the operator Deployment had never been deployed to this cluster - so the API server was happily storing `Backup` objects that nothing was watching.',
      "After installing the operator, the same unchanged `Backup` object was reconciled within seconds: a Job appeared, `status.phase` moved from `Pending` to `Running` to `Completed`, and `kubectl get backups` showed a useful PHASE column thanks to the CRD's printer columns.",
      'The lesson: a CRD is a schema plus storage. If a custom resource sits there with no status and no side effects, look for the controller before you doubt your YAML.',
    ],
    code: [
      {
        title: 'Diagnosing "the custom resource does nothing"',
        language: 'bash',
        code: `kubectl get backups -n shop
# NAME           SCHEDULE    PHASE   AGE
# shop-nightly   0 2 * * *           4m
#                                ^^^ PHASE is empty - nobody wrote a status

kubectl get backup shop-nightly -n shop -o jsonpath='{.status}{"\\n"}'
# (empty)

# Is there a controller at all?
kubectl get crd backups.shop.example.com -o jsonpath='{.spec.group}{"\\n"}'
# shop.example.com
kubectl get pods -A | grep -i backup
# (nothing)                       <- the operator is not installed

kubectl get deployments -A | grep -i operator
# (nothing)`,
        explanation:
          'An empty `status` on a custom resource that should have one is the single most useful signal that no controller is reconciling it.',
        placeholders: ['shop', 'backups.shop.example.com'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A complete CRD with schema, status and printer columns',
      language: 'yaml',
      code: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  # MUST be <plural>.<group>
  name: backups.shop.example.com
spec:
  group: shop.example.com
  scope: Namespaced
  names:
    plural: backups # /apis/shop.example.com/v1/namespaces/<ns>/backups
    singular: backup
    kind: Backup
    shortNames:
      - bkp
  versions:
    - name: v1
      served: true
      storage: true # exactly one version must be the storage version
      schema:
        openAPIV3Schema: # REQUIRED in apiextensions.k8s.io/v1
          type: object
          properties:
            spec:
              type: object
              required: ["schedule", "target"]
              properties:
                schedule:
                  type: string
                  pattern: '^(\\S+\\s+){4}\\S+$' # five cron fields
                target:
                  type: string
                retentionDays:
                  type: integer
                  minimum: 1
                  maximum: 365
                  default: 7 # applied on create if omitted
                compress:
                  type: boolean
                  default: true
            status:
              type: object
              properties:
                phase:
                  type: string
                  enum: ["Pending", "Running", "Completed", "Failed"]
                lastBackupTime:
                  type: string
                  format: date-time
                message:
                  type: string
      subresources:
        status: {} # /status endpoint, so the controller does not race spec edits
      additionalPrinterColumns:
        - name: Schedule
          type: string
          jsonPath: .spec.schedule
        - name: Target
          type: string
          jsonPath: .spec.target
        - name: Phase
          type: string
          jsonPath: .status.phase
        - name: Last Backup
          type: date
          jsonPath: .status.lastBackupTime
        - name: Age
          type: date
          jsonPath: .metadata.creationTimestamp`,
      explanation:
        'The schema does real work: `required` rejects incomplete objects, `minimum`/`maximum` and `pattern` validate values, and `default` fills in omissions at creation time - all enforced by the API server without any controller.',
      placeholders: ['shop.example.com'],
    },
    {
      title: 'Using the custom resource',
      language: 'yaml',
      code: `apiVersion: shop.example.com/v1 # <group>/<version> from the CRD
kind: Backup # spec.names.kind
metadata:
  name: shop-nightly
  namespace: shop
  labels:
    app: shop # labels and selectors work exactly as on built-ins
spec:
  schedule: "0 2 * * *"
  target: postgres-primary
  retentionDays: 30
  # compress is omitted, so the schema default (true) is applied`,
      explanation:
        'Once the CRD exists, this is an ordinary Kubernetes object: `kubectl apply`, `kubectl get bkp`, `kubectl label`, `kubectl delete`, RBAC and watch all behave normally.',
      placeholders: ['shop.example.com', 'shop-nightly', 'shop', 'postgres-primary'],
    },
    {
      title: 'RBAC for a custom resource',
      language: 'yaml',
      code: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: backup-manager
  namespace: shop
rules:
  # The CRD's own group - NOT "" and not "apps"
  - apiGroups: ["shop.example.com"]
    resources: ["backups"] # the PLURAL name from the CRD
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  # A controller also needs the status subresource
  - apiGroups: ["shop.example.com"]
    resources: ["backups/status"]
    verbs: ["get", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: backup-manager
  namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: backup-manager
subjects:
  - kind: ServiceAccount
    name: backup-operator
    namespace: shop`,
      explanation:
        'The built-in `view`, `edit` and `admin` ClusterRoles do not cover custom resources unless the CRD author ships aggregation-labelled ClusterRoles. Assume you must write the rules.',
      placeholders: ['shop', 'shop.example.com', 'backup-operator'],
    },
    {
      title: 'Two versions served at once',
      language: 'yaml',
      code: `spec:
  versions:
    - name: v1alpha1
      served: true # still accepted, for existing clients
      storage: false
      deprecated: true
      deprecationWarning: "shop.example.com/v1alpha1 Backup is deprecated; use v1"
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                cron: {type: string} # old field name
    - name: v1
      served: true
      storage: true # objects are STORED in this version
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                schedule: {type: string} # renamed field
  conversion:
    strategy: Webhook # required, because the schemas differ
    webhook:
      conversionReviewVersions: ["v1"]
      clientConfig:
        service:
          name: backup-conversion
          namespace: shop
          path: /convert`,
      explanation:
        'This is API deprecation applied to your own resources: serve both versions, mark the old one deprecated so clients see a warning, and convert between them. With identical schemas you can use `strategy: None`.',
      placeholders: ['shop', 'backup-conversion'],
    },
  ],
  imperative: [
    {
      command: 'kubectl get crd',
      what: 'Lists every CRD installed in the cluster - the first discovery command.',
      expected: 'Names of the form <plural>.<group> with creation timestamps.',
    },
    {
      command: 'kubectl get crd | grep -i backup',
      what: 'Finds a CRD when you know roughly what it is called.',
      expected: 'backups.shop.example.com',
    },
    {
      command: 'kubectl api-resources | grep shop.example.com',
      what: 'Shows the short name, API version, scope and kind for custom resources in a group.',
      expected: 'backups bkp shop.example.com/v1 true Backup',
      placeholders: ['shop.example.com'],
    },
    {
      command: 'kubectl explain backup.spec',
      what: 'Field documentation generated from the CRD schema - works exactly as it does for built-ins.',
      expected: 'FIELDS: compress, retentionDays, schedule, target.',
    },
    {
      command: 'kubectl explain backup --recursive | head -30',
      what: 'The whole field tree of a custom resource you have never seen before.',
      expected: 'An indented tree of spec and status fields.',
    },
    {
      command: 'kubectl get backups -A',
      what: "Custom resources list like any other resource, with the CRD's printer columns.",
      expected: 'The columns the CRD author defined.',
    },
    {
      command: 'kubectl get bkp -n shop',
      what: 'Short names from the CRD work in kubectl.',
      expected: 'The same list, less typing.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl describe backup shop-nightly -n shop',
      what: 'Describe works, and shows the object plus any events a controller emitted.',
      expected: 'Spec, Status and Events sections.',
      placeholders: ['shop-nightly', 'shop'],
    },
    {
      command:
        'kubectl get crd backups.shop.example.com -o jsonpath=\'{range .spec.versions[*]}{.name}{" served="}{.served}{" storage="}{.storage}{"\\n"}{end}\'',
      what: 'Which versions exist, which are served, and which is the storage version.',
      expected: 'v1alpha1 served=true storage=false / v1 served=true storage=true',
      placeholders: ['backups.shop.example.com'],
    },
    {
      command:
        'kubectl get crd backups.shop.example.com -o jsonpath=\'{.spec.scope}{" "}{.spec.names.shortNames}{"\\n"}\'',
      what: 'Scope and aliases in one line.',
      expected: 'Namespaced ["bkp"]',
      placeholders: ['backups.shop.example.com'],
    },
    {
      command: 'kubectl auth can-i create backups.shop.example.com -n shop',
      what: 'RBAC checks work on custom resources; note the `<plural>.<group>` form.',
      expected: 'yes or no.',
      placeholders: ['shop.example.com', 'shop'],
    },
    {
      command: 'kubectl get pods -A -l app.kubernetes.io/name=backup-operator',
      what: 'Finds the controller behind a CRD. No controller means nothing will happen.',
      expected: 'The operator Pod, or nothing.',
    },
    {
      command: 'kubectl delete crd backups.shop.example.com',
      what: 'Deletes the CRD **and every custom resource of that kind, cluster-wide**. Destructive.',
      expected: 'customresourcedefinition.apiextensions.k8s.io "backups.shop.example.com" deleted',
      placeholders: ['backups.shop.example.com'],
    },
  ],
  declarative: {
    steps: [
      'Discover first: `kubectl get crd`, then `kubectl api-resources | grep <group>`, then `kubectl explain <kind> --recursive`.',
      'Write the custom resource with `apiVersion: <group>/<version>` and the exact `kind` from the CRD.',
      'Validate with `kubectl apply --dry-run=server`, which runs the CRD schema validation.',
      'Check whether a controller exists before expecting side effects; an absent `status` is the tell.',
      'If you author a CRD: include a real schema, add `subresources: {status: {}}`, and add `additionalPrinterColumns` so `kubectl get` is useful.',
      "Write RBAC rules using the CRD's API group and plural name; built-in roles do not cover custom resources.",
    ],
    code: [
      {
        title: 'Explore an unfamiliar custom resource',
        language: 'bash',
        code: `# 1. What extensions does this cluster have?
kubectl get crd -o custom-columns='NAME:.metadata.name,GROUP:.spec.group,SCOPE:.spec.scope,KIND:.spec.names.kind'

# 2. How do I address one of them?
kubectl api-resources --api-group=shop.example.com
# NAME      SHORTNAMES   APIVERSION              NAMESPACED   KIND
# backups   bkp          shop.example.com/v1     true         Backup

# 3. What fields does it take?
kubectl explain backup.spec --recursive

# 4. Is there an existing example to copy?
kubectl get backups -A
kubectl get backup <name> -n <ns> -o yaml > example.yaml

# 5. Is anything watching it?
kubectl get deploy -A | grep -iE 'operator|controller'`,
        placeholders: ['shop.example.com'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get crd backups.shop.example.com',
      what: 'Confirms the CRD is installed and established.',
      expected: 'The CRD listed with a creation timestamp.',
      placeholders: ['backups.shop.example.com'],
    },
    {
      command:
        'kubectl get crd backups.shop.example.com -o jsonpath=\'{.status.conditions[?(@.type=="Established")].status}{"\\n"}\'',
      what: 'A CRD must be Established before its resources can be created.',
      expected: 'True',
      placeholders: ['backups.shop.example.com'],
    },
    {
      command: 'kubectl get backup shop-nightly -n shop -o yaml',
      what: 'Confirms the object exists and shows whether a controller has written a status.',
      expected: 'The spec, plus a status if a controller is reconciling it.',
      placeholders: ['shop-nightly', 'shop'],
    },
    {
      command: 'kubectl apply -f backup.yaml --dry-run=server',
      what: "Runs the CRD's schema validation without creating anything.",
      expected: 'created (server dry run), or a validation error naming the field.',
      placeholders: ['backup.yaml'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl apply -f backup.yaml',
      what: 'A wrong apiVersion or kind fails with "no matches for kind", exactly like a removed built-in API.',
      expected: 'no matches for kind "Backup" in version "shop.example.com/v2"',
      placeholders: ['backup.yaml'],
    },
    {
      command: 'kubectl api-resources --api-group=shop.example.com',
      what: 'Shows the correct apiVersion and kind to use, which is the fix for the above.',
      expected: 'The served version and kind.',
      placeholders: ['shop.example.com'],
    },
    {
      command: 'kubectl apply -f backup.yaml --dry-run=server',
      what: 'Schema violations are reported here with the failing field path.',
      expected: 'spec.retentionDays in body should be less than or equal to 365',
      placeholders: ['backup.yaml'],
    },
    {
      command: 'kubectl get backup shop-nightly -n shop -o jsonpath=\'{.status}{"\\n"}\'',
      what: 'An empty status usually means no controller is running.',
      expected: 'A status object, or empty.',
      placeholders: ['shop-nightly', 'shop'],
    },
    {
      command: 'kubectl logs -n shop -l app.kubernetes.io/name=backup-operator --tail=30',
      what: 'When a controller exists but nothing happens, its own logs explain why - often an RBAC error.',
      expected: 'Reconciliation log lines, or a Forbidden message.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get backup shop-nightly -n shop -o jsonpath=\'{.metadata.finalizers}{"\\n"}\'',
      what: 'A custom resource stuck Terminating has a finalizer that its (possibly absent) controller must remove.',
      expected:
        'A finalizer list; if the operator is gone, the object will not delete until it is patched away.',
      placeholders: ['shop-nightly', 'shop'],
    },
  ],
  commonMistakes: [
    'Naming the CRD anything other than `<plural>.<group>`. The API server rejects it.',
    'Omitting the schema in `apiextensions.k8s.io/v1`. It is required; only the removed v1beta1 allowed schemaless CRDs.',
    'Expecting something to happen with no controller. A CRD stores data; an operator acts on it.',
    'Marking more than one version, or no version, as `storage: true`.',
    'Writing RBAC with `apiGroups: [""]` for a custom resource. Use the CRD\'s group and the plural resource name.',
    'Assuming `view`/`edit`/`admin` cover custom resources. They do not unless the CRD ships aggregation labels.',
    'Deleting a CRD to "clean up", which silently deletes every custom resource of that kind across the cluster.',
    'Using a singular or PascalCase name in `resources` - it must be the lowercase plural.',
    "Forgetting the `status` subresource, so a controller's status write can clobber a concurrent spec edit.",
  ],
  examTips: [
    '`kubectl get crd` then `kubectl api-resources --api-group=<group>` gives you the apiVersion, kind, scope and short names of anything unfamiliar.',
    '`kubectl explain <kind> --recursive` works on custom resources because the CRD carries a schema - use it instead of guessing fields.',
    'If a task says "create a resource of kind X", copy an existing example with `kubectl get <kind> <name> -o yaml` where possible.',
    'For RBAC on custom resources, remember `--resource=backups.shop.example.com` in the imperative form.',
    'A custom resource with an empty `status` and no effect means no controller - say so rather than debugging your YAML.',
    'You will not be asked to write an operator. You may be asked to install a CRD, create a custom resource, or grant access to one.',
  ],
  summary: [
    'A CRD registers a new kind; custom resources then behave like built-ins for kubectl, RBAC, labels and watch.',
    'A schema is required in apiextensions.k8s.io/v1 and powers validation, defaults and `kubectl explain`.',
    'Exactly one version has `storage: true`; several may be `served`, with conversion None or Webhook.',
    'A CRD stores data; an operator is the controller that reconciles it - no controller, no effect.',
    "RBAC uses the CRD's group and plural name; built-in roles do not cover custom resources.",
    'Deleting a CRD deletes all its custom resources cluster-wide.',
  ],
  practice: [
    {
      id: 'crd-p1',
      level: 'beginner',
      prompt:
        'A cluster has a CRD you have never seen. Give three commands, in order, that tell you its apiVersion, its kind, and what fields it accepts.',
      answer:
        '1. kubectl get crd\n2. kubectl api-resources --api-group=<group>      (gives APIVERSION, KIND, NAMESPACED, SHORTNAMES)\n3. kubectl explain <kind> --recursive',
      explanation:
        'This works because a v1 CRD must carry an OpenAPI schema, which `kubectl explain` reads. It is the same workflow you would use for an unfamiliar built-in resource.',
    },
    {
      id: 'crd-p2',
      level: 'intermediate',
      prompt:
        'You apply a custom resource successfully, but nothing happens and its `status` is empty. What is the most likely cause, and what do you check?',
      answer:
        'No controller (operator) is running to reconcile it. A CRD only teaches the API server to validate and store the kind; something has to watch for it and act.\n\nCheck: `kubectl get deploy,pods -A | grep -iE "operator|controller"`, and if one exists, `kubectl logs` it - an RBAC Forbidden error is the next most likely cause.',
      explanation:
        'An empty `status` on a resource whose CRD defines status fields is the strongest single signal. If the operator is present but failing, its logs usually show a `Forbidden` error because its ServiceAccount lacks permission on the CRD group.',
    },
    {
      id: 'crd-p3',
      level: 'advanced',
      prompt:
        'Write the RBAC rule that lets a ServiceAccount fully manage `Backup` resources in group `shop.example.com`, including updating their status. Explain why `apiGroups: [""]` would not work.',
      answer:
        'rules:\n  - apiGroups: ["shop.example.com"]\n    resources: ["backups"]\n    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]\n  - apiGroups: ["shop.example.com"]\n    resources: ["backups/status"]\n    verbs: ["get", "update", "patch"]\n\n`apiGroups: [""]` is the *core* group (pods, services, configmaps). A custom resource lives in the group its CRD declares, so a rule naming the core group matches nothing.',
      explanation:
        'The `backups/status` rule is separate because the CRD enables the status subresource, and subresources need their own entry - exactly like `pods/log`. Imperatively: `kubectl create role backup-manager --verb=get,list,watch,create,update,patch,delete --resource=backups.shop.example.com`.',
    },
  ],
  lab: {
    title: 'Install a CRD, use it, and prove nothing reconciles it',
    scenario:
      'You will install a real CRD, create custom resources, watch the schema reject bad input and apply defaults, grant RBAC for the new kind, and confirm that without a controller the objects are inert.',
    prerequisites: ['A cluster where you can create CRDs (cluster-admin or equivalent)'],
    tasks: [
      { instruction: 'Create namespace `crd-lab` and set it as default.' },
      {
        instruction:
          'Install the `Backup` CRD from this lesson (group shop.example.com, namespaced, with schema, status subresource and printer columns).',
      },
      { instruction: 'Confirm it is Established and discover it with api-resources and explain.' },
      {
        instruction:
          'Create a valid Backup and confirm the printer columns and the applied schema default.',
      },
      {
        instruction:
          'Try to create an invalid Backup (retentionDays 400, missing target) and read both validation errors.',
      },
      { instruction: 'Use the short name to list them, and label one.' },
      {
        instruction:
          'Create a ServiceAccount, prove it cannot access Backups, then grant RBAC on the custom resource and re-verify.',
      },
      { instruction: 'Confirm the status is empty and no controller exists.' },
      {
        instruction:
          'Write a status by hand via the status subresource to see the PHASE column populate.',
      },
      {
        instruction:
          'Delete the CRD and confirm the custom resources disappear with it, then delete the namespace.',
      },
    ],
    solution: [
      {
        title: 'Steps 1-3 - install and discover',
        language: 'bash',
        code: `kubectl create namespace crd-lab
kubectl config set-context --current --namespace=crd-lab

# (save the CRD from the YAML examples section as backup-crd.yaml)
kubectl apply -f backup-crd.yaml
# customresourcedefinition.apiextensions.k8s.io/backups.shop.example.com created

kubectl get crd backups.shop.example.com \\
  -o jsonpath='{.status.conditions[?(@.type=="Established")].status}{"\\n"}'
# True

kubectl api-resources --api-group=shop.example.com
# NAME      SHORTNAMES   APIVERSION            NAMESPACED   KIND
# backups   bkp          shop.example.com/v1   true         Backup

kubectl explain backup.spec
# FIELDS:
#   compress       <boolean>
#   retentionDays  <integer>
#   schedule       <string> -required-
#   target         <string> -required-`,
      },
      {
        title: 'Steps 4-5 - valid, then invalid',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: shop.example.com/v1
kind: Backup
metadata:
  name: shop-nightly
  namespace: crd-lab
  labels:
    app: shop
spec:
  schedule: "0 2 * * *"
  target: postgres-primary
  retentionDays: 30
YAML

kubectl get backups
# NAME           SCHEDULE    TARGET             PHASE   LAST BACKUP   AGE
# shop-nightly   0 2 * * *   postgres-primary                         5s
#                                                ^ printer columns from the CRD

# The schema default was applied even though we omitted the field:
kubectl get backup shop-nightly -o jsonpath='{.spec.compress}{"\\n"}'
# true

# Now break it two ways
cat <<'YAML' | kubectl apply -f - || true
apiVersion: shop.example.com/v1
kind: Backup
metadata: {name: bad-retention, namespace: crd-lab}
spec:
  schedule: "0 2 * * *"
  target: postgres-primary
  retentionDays: 400
YAML
# The Backup "bad-retention" is invalid: spec.retentionDays: Invalid value: 400:
# spec.retentionDays in body should be less than or equal to 365

cat <<'YAML' | kubectl apply -f - || true
apiVersion: shop.example.com/v1
kind: Backup
metadata: {name: no-target, namespace: crd-lab}
spec:
  schedule: "0 2 * * *"
YAML
# The Backup "no-target" is invalid: spec.target: Required value`,
      },
      {
        title: 'Step 6 - it behaves like any resource',
        language: 'bash',
        code: `kubectl get bkp                       # short name works
kubectl label backup shop-nightly tier=critical
kubectl get bkp -l tier=critical
kubectl describe backup shop-nightly | head -20
kubectl get bkp -o custom-columns='NAME:.metadata.name,TARGET:.spec.target,RETAIN:.spec.retentionDays'`,
      },
      {
        title: 'Step 7 - RBAC on a custom resource',
        language: 'bash',
        code: `kubectl create serviceaccount backup-user
SA=system:serviceaccount:crd-lab:backup-user

kubectl auth can-i list backups.shop.example.com --as=$SA
# no
# Note: the built-in "view" role would NOT help here either.

kubectl create role backup-manager \\
  --verb=get,list,watch,create,update,patch,delete \\
  --resource=backups.shop.example.com
kubectl create rolebinding backup-manager \\
  --role=backup-manager --serviceaccount=crd-lab:backup-user

kubectl auth can-i list backups.shop.example.com --as=$SA
# yes
kubectl auth can-i update backups.shop.example.com/status --as=$SA
# no        <- the status subresource needs its own rule`,
      },
      {
        title: 'Steps 8-9 - no controller, then a hand-written status',
        language: 'bash',
        code: `kubectl get backup shop-nightly -o jsonpath='{.status}{"\\n"}'
# (empty - nothing is reconciling this object)

kubectl get deploy,pods -A | grep -iE 'backup|operator' || echo "no controller installed"
# no controller installed

# Do by hand what an operator would do, through the status subresource:
kubectl patch backup shop-nightly --subresource=status --type=merge \\
  -p '{"status":{"phase":"Completed","lastBackupTime":"2026-09-03T02:00:00Z","message":"written by hand"}}'

kubectl get backups
# NAME           SCHEDULE    TARGET             PHASE       LAST BACKUP   AGE
# shop-nightly   0 2 * * *   postgres-primary   Completed   14h           3m
#                                              ^^^^^^^^^ the column now has a value

# The data is stored and displayed, but no backup was actually taken -
# which is exactly the point: a CRD is schema plus storage, nothing more.`,
      },
      {
        title: 'Step 10 - deleting a CRD is destructive',
        language: 'bash',
        code: `kubectl get backups -A
# one Backup exists

kubectl delete crd backups.shop.example.com
# customresourcedefinition.apiextensions.k8s.io "backups.shop.example.com" deleted

kubectl get backups -A
# error: the server doesn't have a resource type "backups"
#   ^ the CRD AND every Backup in the cluster are gone

kubectl config set-context --current --namespace=default
kubectl delete namespace crd-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get bkp -n crd-lab',
        what: 'Confirms the short name, printer columns and the hand-written status all work.',
        expected: 'shop-nightly with a Completed PHASE.',
      },
      {
        command:
          'kubectl auth can-i list backups.shop.example.com --as=system:serviceaccount:crd-lab:backup-user -n crd-lab',
        what: 'Confirms RBAC on a custom resource behaves like RBAC on a built-in.',
        expected: 'yes',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete crd backups.shop.example.com --ignore-not-found',
        what: 'Removes the CRD and every custom resource of that kind.',
        expected: 'deleted, or no output.',
      },
      {
        command: 'kubectl delete namespace crd-lab',
        what: 'Removes the namespace and its RBAC objects.',
        expected: 'namespace "crd-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['api-deprecations', 'rbac', 'yaml-and-api-discovery'],
  docs: [
    {
      title: 'Extend the Kubernetes API with CustomResourceDefinitions',
      url: 'https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/',
    },
    {
      title: 'Custom resources',
      url: 'https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/',
    },
    {
      title: 'Operator pattern',
      url: 'https://kubernetes.io/docs/concepts/extend-kubernetes/operator/',
    },
  ],
}
