import type { Topic } from '../../../types'

export const yamlAndApiDiscovery: Topic = {
  id: 'yaml-and-api-discovery',
  title: 'YAML structure, API versions and kubectl explain',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 22,
  order: 6,
  tags: ['yaml', 'apiVersion', 'kubectl explain', 'api-resources', 'api-versions', 'indentation'],
  oneLiner:
    'The YAML rules that actually bite, how to pick the right apiVersion, and how to look up any field without leaving the terminal.',
  explanation: [
    'Kubernetes YAML is plain YAML with one strict rule: **indentation is two spaces and never a tab**. A tab is a parse error, and a wrong indent level silently puts your field in the wrong place, which the API server then rejects as an unknown field.',
    'Three YAML shapes cover everything: a **map** (`key: value`), a **list** (lines starting with `- `), and a **scalar** (a string, number or boolean). Almost every mistake is confusing a list of maps with a map. `containers` is a list, so each container starts with `- name:`.',
    'Every object needs `apiVersion` and `kind`. `apiVersion` is either `v1` (the core group, no group name) or `<group>/<version>` such as `apps/v1`, `batch/v1`, `networking.k8s.io/v1` or `rbac.authorization.k8s.io/v1`. Getting the group wrong is the most common cause of "no matches for kind".',
    "`kubectl explain` is the built-in field reference. `kubectl explain pod.spec.containers` lists every field of a container with its type and description, and `--recursive` prints the whole tree. It reads the live cluster's OpenAPI schema, so it is always correct for the version you are on.",
  ],
  whyItMatters: [
    'On the exam you cannot copy-paste from your notes, but `kubectl explain` is always available - it is the fastest way to recall whether a field is `readinessProbe` or `readynessProbe`, and whether it takes a map or a list.',
    '`kubectl api-resources` tells you the short name, API group and scope of every resource in one screen, which answers "what apiVersion do I use for an Ingress?" in two seconds.',
    'Indentation errors are the single most common reason a candidate loses a task they actually knew how to do. Generating YAML and editing it, rather than typing it, sidesteps most of them.',
  ],
  howItWorks: [
    'The API server validates your object against the OpenAPI schema for that `apiVersion`/`kind`. Unknown fields are rejected (`unknown field "spec.replica"`), and wrongly typed fields produce a type error.',
    '`kubectl api-resources` lists NAME, SHORTNAMES, APIVERSION, NAMESPACED and KIND. `kubectl api-versions` lists every group/version the cluster serves.',
    '`kubectl explain <kind>` uses the preferred version by default. Pin it with `--api-version=apps/v1` when a kind exists in several groups.',
    'Multi-document files separate objects with a line containing only `---`. Objects are applied in file order, which is how you put a Namespace before the things inside it.',
    'YAML quoting matters in two places: a value that looks like a number or boolean but must be a string (`"1.27"`, `"true"`, `"on"`), and multi-line strings. Use `|` to keep newlines and `>` to fold them into spaces.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Finding a field you cannot remember',
      caption:
        'You do not need to memorise the API. You need to be fast at this loop - it works offline and is always current for your cluster.',
      nodes: [
        {
          label: 'Which kind holds the field?',
          detail: 'kubectl api-resources | grep -i <word>',
        },
        {
          label: 'Confirm the apiVersion',
          detail: 'The APIVERSION column, e.g. apps/v1',
          arrowLabel: 'note the group',
        },
        {
          label: 'Walk the field tree',
          detail: 'kubectl explain deployment.spec.template.spec',
          tone: 'accent',
          arrowLabel: 'one level at a time',
        },
        {
          label: 'Read the whole subtree at once',
          detail: 'kubectl explain pod.spec --recursive | grep -i probe',
        },
        {
          label: 'Write the field, then validate',
          detail: 'kubectl apply --dry-run=server -f file.yaml',
          tone: 'success',
          branch: {
            label: 'Unknown field error',
            detail: 'You are on the wrong apiVersion or misspelled the path',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Every object',
      apiVersion: 'varies',
      purpose: 'The four top-level keys shared by every Kubernetes object.',
      fields: [
        {
          path: 'apiVersion',
          meaning: 'Group and version that validates this object, e.g. apps/v1.',
          required: true,
        },
        {
          path: 'kind',
          meaning: 'The resource type, in PascalCase: Pod, Deployment, ConfigMap.',
          required: true,
        },
        {
          path: 'metadata.name',
          meaning: 'Unique name in its scope; a DNS label for most kinds.',
          required: true,
        },
        { path: 'metadata.labels', meaning: 'Key/value pairs used by selectors.' },
        { path: 'spec', meaning: 'Desired state - the part you write.', required: true },
        { path: 'status', meaning: 'Observed state - written by the cluster, never by you.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Two characters of indentation, one failed task',
    story: [
      'A candidate writes a Pod with an environment variable. They indent `env` one level too far, so it becomes a field of the `image` scalar instead of a sibling of it.',
      'The API server answers: `error: error validating data: ValidationError(Pod.spec.containers[0]): unknown field "env" in io.k8s.api.core.v1.Container` - actually a helpful message, because it names the exact path.',
      'The fix took ten seconds once they read the error: `env` belongs at the same indentation as `name` and `image`, and it is a **list** of maps, each with `name` and `value`.',
      'The durable fix is to stop typing YAML: `kubectl create deployment ... --dry-run=client -o yaml` produces a correct container block, and `kubectl set env` can add the variable without editing at all.',
    ],
    code: [
      {
        title: 'Wrong, then right',
        language: 'yaml',
        code: `# WRONG - env indented under image, and written as a map
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
        env:
          LOG_LEVEL: debug

# RIGHT - env is a sibling of image, and a list of {name, value} maps
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
      env:
        - name: LOG_LEVEL
          value: debug`,
        explanation:
          'When in doubt, ask the cluster: `kubectl explain pod.spec.containers.env` prints "env <[]EnvVar>", and the [] tells you it is a list.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Maps, lists and multi-line strings in one manifest',
      language: 'yaml',
      code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: shop
  labels: # a map
    app: web
    tier: frontend
data:
  LOG_LEVEL: debug # scalar string
  MAX_RETRIES: "3" # quoted: keep it a string, not a number
  FEATURE_ON: "true" # quoted: otherwise YAML makes it a boolean
  nginx.conf: | # literal block: newlines preserved
    server {
      listen 8080;
      location /healthz { return 200 'ok'; }
    }
  banner: > # folded block: newlines become spaces
    This message is written
    across two lines but stored
    as one.`,
      explanation:
        'ConfigMap values must be strings. Unquoted `3` and `true` are a number and a boolean in YAML, and the API server rejects them with a type error - this is the most common ConfigMap mistake on the exam.',
      placeholders: ['app-config', 'shop'],
    },
    {
      title: 'Multiple objects in one file, in dependency order',
      language: 'yaml',
      code: `apiVersion: v1
kind: Namespace
metadata:
  name: shop
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: shop
data:
  LOG_LEVEL: info
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
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
        - name: web
          image: nginx:1.27-alpine
          envFrom:
            - configMapRef:
                name: app-config`,
      explanation:
        'Note the three different apiVersions in one file: v1 for Namespace and ConfigMap (core group), apps/v1 for Deployment.',
      placeholders: ['shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl explain pod.spec.containers',
      what: 'Lists every field of a container with its type and a one-line description.',
      expected:
        'FIELDS: args, command, env, envFrom, image, imagePullPolicy, lifecycle, livenessProbe...',
    },
    {
      command: 'kubectl explain deployment.spec.template.spec.containers.livenessProbe --recursive',
      what: 'Prints the whole probe field tree at once - ideal when you need the exact nesting of httpGet or exec.',
      expected:
        'An indented tree including exec, failureThreshold, grpc, httpGet, initialDelaySeconds, tcpSocket.',
    },
    {
      command: 'kubectl api-resources',
      what: 'One-screen reference: every resource type, its short name, API group and whether it is namespaced.',
      expected: 'A table; look for the APIVERSION column to get the right apiVersion.',
    },
    {
      command: 'kubectl api-resources | grep -i ingress',
      what: 'Finds the API group for a kind you half-remember.',
      expected: 'ingresses ing networking.k8s.io/v1 true Ingress',
    },
    {
      command: 'kubectl api-versions',
      what: 'Lists every group/version the cluster serves, which is how you confirm a version exists before using it.',
      expected:
        'Lines such as apps/v1, batch/v1, networking.k8s.io/v1, rbac.authorization.k8s.io/v1.',
    },
    {
      command: 'kubectl explain cronjob.spec --api-version=batch/v1',
      what: 'Pins the version explicitly, useful when a kind has existed in several groups over time.',
      expected:
        'Fields including concurrencyPolicy, jobTemplate, schedule, successfulJobsHistoryLimit.',
    },
  ],
  declarative: {
    steps: [
      'Start from a generated manifest so `apiVersion`, `kind` and `metadata` are already right.',
      'Look up any field you are unsure of with `kubectl explain <kind>.<path>` before typing it.',
      'Validate with `kubectl apply --dry-run=server -f file.yaml`, which reports unknown fields precisely.',
      'Keep one object per concern, several objects per file only when they belong together.',
    ],
    code: [
      {
        title: 'Discover, write, validate',
        language: 'bash',
        code: `# 1. What group is a NetworkPolicy in?
kubectl api-resources | grep -i networkpolic
# networkpolicies   netpol   networking.k8s.io/v1   true   NetworkPolicy

# 2. What does its spec look like?
kubectl explain networkpolicy.spec --recursive | head -20

# 3. Write the file, then let the server check it
kubectl apply -f netpol.yaml --dry-run=server
# networkpolicy.networking.k8s.io/allow-web created (server dry run)`,
        placeholders: ['netpol.yaml'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl apply -f manifest.yaml --dry-run=server',
      what: 'Full validation by the API server without persisting anything.',
      expected: '"(server dry run)" for each valid object.',
      placeholders: ['manifest.yaml'],
    },
    {
      command: 'kubectl get -f manifest.yaml',
      what: 'Looks up the live objects described by a file - a quick way to confirm everything in the file exists.',
      expected: 'One row per object, or a NotFound error naming what is missing.',
      placeholders: ['manifest.yaml'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl apply -f bad.yaml',
      what: 'Read the error carefully - it names the exact field path that is wrong.',
      expected:
        'error: error validating data: ValidationError(Deployment.spec): unknown field "replica" in io.k8s.api.apps.v1.DeploymentSpec',
      placeholders: ['bad.yaml'],
    },
    {
      command: 'kubectl explain deployment.spec.strategy.rollingUpdate',
      what: 'Confirms whether a field is a map or a list, and what its children are called.',
      expected: 'FIELDS: maxSurge <IntOrString>, maxUnavailable <IntOrString>.',
    },
    {
      command: 'grep -Pn "\\t" manifest.yaml',
      what: 'Finds literal tab characters, which YAML forbids and which are invisible in most editors.',
      expected: 'No output when the file is clean; a line number when a tab is present.',
      placeholders: ['manifest.yaml'],
    },
    {
      command: 'kubectl create --dry-run=client -f manifest.yaml -o yaml | head -5',
      what: 'Parses the file locally, which separates "my YAML is malformed" from "the cluster rejected it".',
      expected: 'The first lines of the parsed object, or a YAML parse error with a line number.',
      placeholders: ['manifest.yaml'],
    },
  ],
  commonMistakes: [
    'Using tabs. YAML forbids them outright; always two spaces.',
    'Writing `containers:` as a map instead of a list of maps. Each container begins with `- name:`.',
    'Unquoted numbers and booleans in ConfigMap `data`. Every value must be a string: `"3"`, `"true"`.',
    'Wrong API group: `Deployment` is `apps/v1` (not `v1`), `Job`/`CronJob` are `batch/v1`, `Ingress`/`NetworkPolicy` are `networking.k8s.io/v1`, `Role`/`RoleBinding` are `rbac.authorization.k8s.io/v1`.',
    'Writing a `status:` section by hand. It is ignored.',
    'Guessing field names instead of running `kubectl explain`, which is right there and always correct for the running version.',
  ],
  examTips: [
    '`kubectl explain <kind>.<field> --recursive` is the fastest documentation in the exam and needs no browser tab.',
    '`kubectl api-resources | grep -i <word>` answers "what apiVersion?" faster than searching kubernetes.io.',
    'When an apply fails, read the field path in the error before changing anything - it usually tells you the answer.',
    'If your editor may insert tabs, run `:set expandtab tabstop=2 shiftwidth=2` in vim first. Many candidates put this in their opening 60 seconds.',
    'Prefer `--dry-run=server` over `--dry-run=client` for validation: the client check does not know the schema.',
  ],
  summary: [
    'Two-space indentation, never tabs. Lists start with `- `; maps are `key: value`.',
    'apiVersion is `v1` for core kinds and `<group>/<version>` otherwise - apps/v1, batch/v1, networking.k8s.io/v1, rbac.authorization.k8s.io/v1.',
    '`kubectl explain` and `kubectl api-resources` are your in-terminal reference; both read the live cluster schema.',
    '`--dry-run=server` gives you real validation without creating anything.',
  ],
  practice: [
    {
      id: 'yaml-p1',
      level: 'beginner',
      prompt:
        'Which command tells you the correct apiVersion for a CronJob without opening a browser?',
      answer:
        'kubectl api-resources | grep -i cronjob  →  cronjobs cj batch/v1 true CronJob\n\nSo apiVersion is `batch/v1`.',
      explanation:
        '`kubectl explain cronjob | head -3` also prints the version it resolved. Both are allowed and instant.',
    },
    {
      id: 'yaml-p2',
      level: 'intermediate',
      prompt:
        'A ConfigMap fails to apply with a type error on the value `3`. Show the corrected `data` block and explain the rule.',
      answer:
        'data:\n  MAX_RETRIES: "3"\n\nConfigMap `data` values must be strings. Unquoted `3` is parsed as an integer by YAML, and the schema for `data` is map[string]string.',
      explanation:
        'The same applies to `true`/`false`, `yes`/`no`, `on`/`off`, and to version numbers like `1.27` which YAML reads as a float. Use `binaryData` (base64) for non-text values.',
      code: {
        title: 'The error you will see',
        language: 'text',
        code: `error: error validating data: ValidationError(ConfigMap.data.MAX_RETRIES):
invalid type for io.k8s.api.core.v1.ConfigMap.data: got "integer", expected "string"`,
      },
    },
    {
      id: 'yaml-p3',
      level: 'advanced',
      prompt:
        "Write the single command that prints the complete field tree for a Pod's security context at container level, so you can confirm the exact spelling of the read-only root filesystem field.",
      answer:
        'kubectl explain pod.spec.containers.securityContext --recursive\n\nThe field is `readOnlyRootFilesystem` (note: one word "Filesystem", capital F, lower-case s).',
      explanation:
        'Pod-level and container-level security contexts have different field sets - `fsGroup` exists only at Pod level, `readOnlyRootFilesystem` and `capabilities` only at container level. `explain` is the reliable way to check which is which.',
    },
  ],
  lab: {
    title: 'Use the cluster as your documentation',
    scenario:
      'You will answer four real "what is the field called?" questions using only kubectl, then deliberately produce and read three different validation errors so they stop being scary.',
    prerequisites: ['A cluster reachable with kubectl'],
    tasks: [
      {
        instruction:
          'Find the apiVersion and short name for Ingress, NetworkPolicy, Role and CronJob using one command each.',
      },
      {
        instruction:
          "Use kubectl explain to find the exact field path for a container's liveness HTTP probe path.",
      },
      {
        instruction:
          'Write a ConfigMap manifest with an unquoted numeric value, apply it, and read the error.',
      },
      { instruction: 'Fix the ConfigMap by quoting the value and apply it successfully.' },
      {
        instruction:
          'Write a Deployment manifest with the field `replica` instead of `replicas`, apply with --dry-run=server, and read the error.',
      },
      { instruction: 'List every API group/version your cluster serves.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - discovery',
        language: 'bash',
        code: `kubectl api-resources | grep -iE 'ingresses|networkpolicies|^roles|cronjobs'
# ingresses         ing      networking.k8s.io/v1            true   Ingress
# networkpolicies   netpol   networking.k8s.io/v1            true   NetworkPolicy
# roles                      rbac.authorization.k8s.io/v1    true   Role
# cronjobs          cj       batch/v1                        true   CronJob

kubectl explain pod.spec.containers.livenessProbe.httpGet
# FIELDS:
#   host, httpHeaders, path <string>, port <IntOrString>, scheme
# => full path: spec.containers[].livenessProbe.httpGet.path`,
      },
      {
        title: 'Step 3 - the broken ConfigMap',
        language: 'yaml',
        code: `# cm-bad.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: retry-config
data:
  MAX_RETRIES: 3 # unquoted -> integer -> rejected`,
      },
      {
        title: 'Step 3b - read the error',
        language: 'bash',
        code: `kubectl apply -f cm-bad.yaml
# error: error validating "cm-bad.yaml": error validating data:
# ValidationError(ConfigMap.data.MAX_RETRIES): invalid type for
# io.k8s.api.core.v1.ConfigMap.data: got "integer", expected "string"`,
      },
      {
        title: 'Step 4 - the fix',
        language: 'yaml',
        code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: retry-config
data:
  MAX_RETRIES: "3" # quoted -> string -> accepted`,
      },
      {
        title: 'Step 5 - unknown field',
        language: 'bash',
        code: `cat <<'YAML' > deploy-bad.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: typo
spec:
  replica: 2
  selector:
    matchLabels:
      app: typo
  template:
    metadata:
      labels:
        app: typo
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
YAML

kubectl apply -f deploy-bad.yaml --dry-run=server
# error: error validating data: ValidationError(Deployment.spec):
# unknown field "replica" in io.k8s.api.apps.v1.DeploymentSpec`,
      },
      {
        title: 'Step 6 - group inventory',
        language: 'bash',
        code: `kubectl api-versions | sort
# admissionregistration.k8s.io/v1
# apps/v1
# batch/v1
# networking.k8s.io/v1
# rbac.authorization.k8s.io/v1
# v1
# ...`,
      },
    ],
    verification: [
      {
        command: 'kubectl apply -f cm-good.yaml --dry-run=server',
        what: 'Confirms the quoted ConfigMap now validates.',
        expected: 'configmap/retry-config created (server dry run)',
      },
      {
        command: 'kubectl explain configmap.data',
        what: 'Shows the declared type so the quoting rule is not something you have to remember.',
        expected: 'data <map[string]string>',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete configmap retry-config --ignore-not-found',
        what: 'Removes the ConfigMap if you applied the fixed version.',
        expected: 'configmap "retry-config" deleted, or no output.',
      },
    ],
  },
  relatedTopicIds: ['kubectl-basics', 'imperative-vs-declarative', 'configmaps'],
  docs: [
    {
      title: 'Kubernetes object management',
      url: 'https://kubernetes.io/docs/concepts/overview/working-with-objects/kubernetes-objects/',
    },
    {
      title: 'kubectl explain',
      url: 'https://kubernetes.io/docs/reference/kubectl/generated/kubectl_explain/',
    },
  ],
}
