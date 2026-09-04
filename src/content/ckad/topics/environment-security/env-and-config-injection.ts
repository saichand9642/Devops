import type { Topic } from '../../../types'

export const envAndConfigInjection: Topic = {
  id: 'env-and-config-injection',
  title: 'Environment variables, envFrom and the downward API',
  domainId: 'environment-security',
  difficulty: 'beginner',
  estimatedMinutes: 20,
  order: 3,
  tags: ['env', 'envFrom', 'valueFrom', 'fieldRef', 'resourceFieldRef', 'downward API', 'prefix'],
  oneLiner:
    'Every source a container can get configuration from: literals, ConfigMaps, Secrets, Pod metadata, resource limits - and how to choose between env vars and files.',
  explanation: [
    "A container's environment can be built from five sources: a literal `value`, a ConfigMap key, a Secret key, Pod or container metadata (the **downward API**), and bulk imports with `envFrom`.",
    '`env` is a list, each entry either a `value` (a literal string) or a `valueFrom` (one of `configMapKeyRef`, `secretKeyRef`, `fieldRef`, `resourceFieldRef`). Exactly one of the two per entry.',
    '`envFrom` imports every key of a ConfigMap or Secret as an environment variable named after the key. It is fast to write but gives you no renaming, and keys that are not valid identifiers are silently skipped.',
    "The **downward API** exposes information about the Pod to the container without an API call: `fieldRef` for metadata (name, namespace, UID, labels, annotations, node name, Pod IP, service account) and `resourceFieldRef` for the container's own requests and limits.",
    'Precedence: `envFrom` is applied first, then `env`, so an `env` entry overrides a same-named variable from `envFrom`. Within `envFrom`, later sources override earlier ones. Kubernetes also injects `<SERVICE>_SERVICE_HOST`/`_PORT` variables for Services that existed when the Pod started - legacy service discovery you should not rely on.',
  ],
  whyItMatters: [
    'Almost every application configuration task on the exam is an `env` or `envFrom` task, and knowing the four `valueFrom` variants covers all of them.',
    '`resourceFieldRef` is how a JVM or Node process learns its own memory limit, which is the correct fix for the "heap larger than the container limit" OOM problem.',
    'Knowing the precedence rule lets you answer "which value wins?" questions with certainty instead of guessing.',
  ],
  howItWorks: [
    'All environment variables are resolved when the container starts and are immutable for the life of that container. Nothing you change afterwards reaches a running process.',
    "`fieldRef` supports `metadata.name`, `metadata.namespace`, `metadata.uid`, `metadata.labels['key']`, `metadata.annotations['key']`, `spec.nodeName`, `spec.serviceAccountName`, `status.podIP` and `status.hostIP`. Whole label and annotation maps are only available as *files* in a downwardAPI volume, not as env vars.",
    '`resourceFieldRef` reads `requests.cpu`, `requests.memory`, `limits.cpu`, `limits.memory` and `requests.ephemeral-storage`/`limits.ephemeral-storage` for a named container, with an optional `divisor` (for example `1Mi` to get megabytes instead of bytes).',
    "`$(VAR)` interpolation works inside `value`, `command` and `args`, referring to variables declared *earlier* in the same container's `env` list. Escape a literal with `$$(VAR)`.",
    '`envFrom[].prefix` prepends a string to every imported key, which is how you import two ConfigMaps that share key names without collision.',
    'A `downwardAPI` volume projects the same information as files, and unlike env vars it *does* update when labels or annotations change.',
    'Legacy Service environment variables (`REDIS_SERVICE_HOST` and so on) are injected only for Services that already existed when the Pod started - which is why DNS, not env vars, is the correct way to find a Service.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which injection field?',
      caption: 'Four ways in, and the exam expects you to pick by intent rather than habit.',
      question: 'Where does the value come from?',
      branches: [
        {
          condition: 'a literal, fixed in the manifest',
          result: 'env with value',
          detail: 'env: - name: MODE  value: production',
        },
        {
          condition: 'one key of a ConfigMap or Secret',
          result: 'env with valueFrom',
          detail: 'configMapKeyRef or secretKeyRef; lets you rename it',
          tone: 'accent',
        },
        {
          condition: 'every key of a ConfigMap or Secret',
          result: 'envFrom',
          detail: 'Names come straight from the keys',
        },
        {
          condition: 'a fact about the Pod itself',
          result: 'valueFrom fieldRef',
          detail: 'metadata.name, status.podIP, or resourceFieldRef for limits',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'All configuration injection happens in the container spec.',
      fields: [
        {
          path: 'spec.containers[].env[].value',
          meaning: 'A literal string. Supports $(VAR) interpolation of earlier entries.',
        },
        {
          path: 'spec.containers[].env[].valueFrom.configMapKeyRef',
          meaning: 'One ConfigMap key, optionally renamed, with `optional`.',
        },
        {
          path: 'spec.containers[].env[].valueFrom.secretKeyRef',
          meaning: 'One Secret key, optionally renamed, with `optional`.',
        },
        {
          path: 'spec.containers[].env[].valueFrom.fieldRef.fieldPath',
          meaning:
            'Pod metadata: metadata.name, metadata.namespace, status.podIP, spec.nodeName, ...',
        },
        {
          path: 'spec.containers[].env[].valueFrom.resourceFieldRef',
          meaning: "This container's requests/limits, with an optional divisor.",
        },
        {
          path: 'spec.containers[].envFrom[].configMapRef',
          meaning: 'Bulk import of every ConfigMap key.',
        },
        {
          path: 'spec.containers[].envFrom[].secretRef',
          meaning: 'Bulk import of every Secret key.',
        },
        {
          path: 'spec.containers[].envFrom[].prefix',
          meaning: 'Prefix added to every imported key name.',
        },
        {
          path: 'spec.volumes[].downwardAPI.items[]',
          meaning: 'Pod metadata as files, including whole label/annotation maps. Updates live.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Teaching a JVM its own memory limit',
    story: [
      'A Java service is OOMKilled repeatedly. Its container limit is 1Gi and the JVM is starting with a 2Gi maximum heap, because the image hardcodes `-Xmx2g` from a time when it ran on a large VM.',
      'Hardcoding a smaller value would work until someone changed the limit, at which point the two would drift apart again. The team wanted the JVM to derive its heap from the actual container limit.',
      '`resourceFieldRef` gives exactly that: `MEMORY_LIMIT_MB` is populated from `limits.memory` with a divisor of `1Mi`, and the entrypoint computes a heap of 75% of it. Change the limit in the manifest and the heap follows automatically.',
      'The same manifest also injects `POD_NAME`, `POD_IP` and `NODE_NAME` from the downward API, which the application includes in its log lines. Correlating a log entry with a Pod stopped being guesswork.',
      'The OOM kills stopped, and the fix survived two later changes to the memory limit without anyone remembering it was there.',
    ],
    code: [
      {
        title: 'Heap derived from the container limit',
        language: 'yaml',
        code: `containers:
  - name: api
    image: registry.example.com/shop/api:1.4.2
    resources:
      limits:
        memory: 1Gi
    env:
      - name: MEMORY_LIMIT_MB
        valueFrom:
          resourceFieldRef:
            containerName: api
            resource: limits.memory
            divisor: 1Mi # value in MiB, so 1024 rather than 1073741824
      - name: JAVA_OPTS
        # $(VAR) refers to MEMORY_LIMIT_MB, declared above
        value: "-XX:MaxRAMPercentage=75 -Dapp.memLimitMb=$(MEMORY_LIMIT_MB)"
    command: ["sh", "-c", "exec java $JAVA_OPTS -jar /app/api.jar"]`,
        explanation:
          'Modern JVMs read the cgroup limit themselves via `MaxRAMPercentage`, but `resourceFieldRef` is the general mechanism and works for any runtime that needs to be told.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Every env source in one container',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: env-demo
  namespace: shop
  labels:
    app: api
    tier: backend
  annotations:
    build: "2026-09-03"
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "printenv | sort; sleep 3600"]
      resources:
        requests:
          cpu: 250m
          memory: 128Mi
        limits:
          cpu: "1"
          memory: 512Mi
      env:
        # 1. A literal
        - name: APP_MODE
          value: production

        # 2. From a ConfigMap key, renamed
        - name: APP_LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL

        # 3. From a Secret key
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password

        # 4. Downward API - Pod metadata
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: APP_LABEL
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['app']

        # 5. Downward API - this container's own resources
        - name: CPU_REQUEST_MILLICORES
          valueFrom:
            resourceFieldRef:
              containerName: app
              resource: requests.cpu
              divisor: 1m
        - name: MEMORY_LIMIT_MB
          valueFrom:
            resourceFieldRef:
              containerName: app
              resource: limits.memory
              divisor: 1Mi

        # 6. Interpolation of variables declared earlier
        - name: SELF_URL
          value: "http://$(POD_IP):8080/healthz"
      envFrom:
        # 7. Bulk imports, with prefixes to avoid key collisions
        - configMapRef:
            name: app-config
          prefix: CFG_
        - secretRef:
            name: db-credentials
          prefix: SEC_`,
      explanation:
        'The container ends up with APP_MODE, APP_LOG_LEVEL, DB_PASSWORD, POD_NAME, POD_NAMESPACE, POD_IP, NODE_NAME, APP_LABEL, CPU_REQUEST_MILLICORES=250, MEMORY_LIMIT_MB=512, SELF_URL, plus CFG_* and SEC_* for every ConfigMap and Secret key.',
      placeholders: ['env-demo', 'shop', 'app-config', 'db-credentials'],
    },
    {
      title: 'A downwardAPI volume, for whole label maps and live updates',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: downward-files
  namespace: shop
  labels:
    app: api
    tier: backend
spec:
  volumes:
    - name: podinfo
      downwardAPI:
        items:
          - path: name
            fieldRef:
              fieldPath: metadata.name
          # A whole label map is only available as a FILE, not as an env var.
          - path: labels
            fieldRef:
              fieldPath: metadata.labels
          - path: annotations
            fieldRef:
              fieldPath: metadata.annotations
          - path: mem_limit_mb
            resourceFieldRef:
              containerName: app
              resource: limits.memory
              divisor: 1Mi
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      resources:
        limits:
          memory: 256Mi
      volumeMounts:
        - name: podinfo
          mountPath: /etc/podinfo
          readOnly: true`,
      explanation:
        'The `labels` file contains `app="api"` and `tier="backend"`, one per line - and unlike an env var, it is updated if you relabel the Pod.',
      placeholders: ['downward-files', 'shop'],
    },
    {
      title: 'Precedence, demonstrated',
      language: 'yaml',
      code: `# ConfigMap "base" contains  LOG_LEVEL=info
# ConfigMap "override" contains LOG_LEVEL=warn
spec:
  containers:
    - name: app
      image: busybox:1.36
      envFrom:
        - configMapRef:
            name: base # LOG_LEVEL=info
        - configMapRef:
            name: override # LOG_LEVEL=warn  (later envFrom wins)
      env:
        - name: LOG_LEVEL
          value: debug # env ALWAYS wins over envFrom
# Result: LOG_LEVEL=debug`,
      explanation:
        'Order of application: envFrom sources in list order, then env. So `env` is the highest-precedence source, which makes it the right place for a deliberate override.',
    },
  ],
  imperative: [
    {
      command: 'kubectl set env deployment/api LOG_LEVEL=debug APP_MODE=production -n shop',
      what: 'Adds or changes literal env vars on a Deployment and triggers a rollout.',
      expected: 'deployment.apps/api env updated',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl set env deployment/api --from=configmap/app-config -n shop',
      what: 'Adds every key of a ConfigMap as env vars.',
      expected: 'deployment.apps/api env updated',
      placeholders: ['api', 'app-config', 'shop'],
    },
    {
      command: 'kubectl set env deployment/api --from=secret/db-credentials --prefix=DB_ -n shop',
      what: 'Bulk import from a Secret with a prefix, avoiding key collisions.',
      expected: 'deployment.apps/api env updated',
      placeholders: ['api', 'db-credentials', 'shop'],
    },
    {
      command: 'kubectl set env deployment/api LOG_LEVEL- -n shop',
      what: 'Removes an env var. The trailing hyphen is the delete syntax.',
      expected: 'deployment.apps/api env updated',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl set env deployment/api --list -n shop',
      what: 'Lists the env vars configured on the Deployment without opening an editor.',
      expected: 'A list of NAME=value lines plus references.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl exec env-demo -n shop -- printenv | sort',
      what: 'The definitive check of what the container actually received.',
      expected: 'Your variables among the Kubernetes-injected ones.',
      placeholders: ['env-demo', 'shop'],
    },
    {
      command: 'kubectl exec env-demo -n shop -- printenv POD_NAME POD_IP NODE_NAME',
      what: 'Confirms downward API injection.',
      expected: 'The Pod name, its IP and the node name.',
      placeholders: ['env-demo', 'shop'],
    },
    {
      command: 'kubectl exec downward-files -n shop -- cat /etc/podinfo/labels',
      what: 'Reads a whole label map, which is only available as a file.',
      expected: 'app="api" and tier="backend" on separate lines.',
      placeholders: ['downward-files', 'shop'],
    },
    {
      command:
        'kubectl get pod env-demo -n shop -o jsonpath=\'{range .spec.containers[0].env[*]}{.name}{"="}{.value}{" "}{.valueFrom}{"\\n"}{end}\'',
      what: 'Shows the configured env list including the reference forms.',
      expected: 'One line per entry.',
      placeholders: ['env-demo', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Use a literal `value` for anything that is genuinely fixed per environment and not sensitive.',
      'Use `configMapKeyRef`/`secretKeyRef` when you need to rename a key or import just one; use `envFrom` when you want everything.',
      'Add `prefix` to `envFrom` whenever two sources could share a key name.',
      'Use `fieldRef` and `resourceFieldRef` instead of hardcoding a Pod name, IP or memory limit.',
      'Use a `downwardAPI` volume when you need a whole label/annotation map, or live updates.',
      'Remember env changes require a Pod restart; plan for `kubectl rollout restart` or a versioned ConfigMap.',
    ],
    code: [
      {
        title: "Build up a Deployment's environment imperatively, then keep it declarative",
        language: 'bash',
        code: `# Quick wiring while exploring
kubectl set env deploy/api -n shop APP_MODE=production
kubectl set env deploy/api -n shop --from=configmap/app-config
kubectl set env deploy/api -n shop --from=secret/db-credentials --prefix=DB_

# Then capture the result into a file that becomes the source of truth
kubectl get deploy api -n shop -o yaml > api.yaml

kubectl set env deploy/api -n shop --list
# APP_MODE=production
# LOG_LEVEL=info
# DB_username=...`,
        placeholders: ['api', 'shop', 'app-config', 'db-credentials'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl exec env-demo -n shop -- printenv MEMORY_LIMIT_MB CPU_REQUEST_MILLICORES',
      what: 'Confirms resourceFieldRef with divisors produced the expected units.',
      expected: '512 and 250.',
      placeholders: ['env-demo', 'shop'],
    },
    {
      command: 'kubectl exec env-demo -n shop -- printenv SELF_URL',
      what: 'Confirms $(VAR) interpolation resolved against an earlier entry.',
      expected: 'http://10.244.1.7:8080/healthz',
      placeholders: ['env-demo', 'shop'],
    },
    {
      command: 'kubectl exec env-demo -n shop -- sh -c "printenv | grep ^CFG_"',
      what: 'Confirms a prefixed bulk import.',
      expected: 'CFG_LOG_LEVEL=..., CFG_MAX_RETRIES=...',
      placeholders: ['env-demo', 'shop'],
    },
    {
      command: 'kubectl exec downward-files -n shop -- ls /etc/podinfo',
      what: 'Confirms the downwardAPI volume projected all requested items.',
      expected: 'annotations, labels, mem_limit_mb, name.',
      placeholders: ['downward-files', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl exec mypod -n shop -- printenv | sort',
      what: 'Start here: what did the container actually get? It is often not what the manifest suggests.',
      expected: 'The full environment.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl describe pod mypod -n shop | grep -iA3 "skipped"',
      what: '`envFrom` silently skips keys that are not valid identifiers and records an event.',
      expected:
        'Keys [nginx.conf] from ConfigMap app-config were skipped since they are considered invalid environment variable names.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command:
        'kubectl get pod mypod -n shop -o jsonpath=\'{.status.containerStatuses[0].state.waiting.message}{"\\n"}\'',
      what: 'A missing ConfigMap/Secret or key gives CreateContainerConfigError with the name.',
      expected: 'configmap "app-config" not found',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl apply -f pod.yaml',
      what: 'An unsupported `fieldPath` fails validation with the list of allowed paths.',
      expected: 'field label not supported: status.phase',
      placeholders: ['pod.yaml'],
    },
    {
      command: 'kubectl exec mypod -n shop -- printenv LOG_LEVEL',
      what: 'When two sources set the same name, this settles which won. Remember `env` beats `envFrom`.',
      expected: 'The value from the highest-precedence source.',
      placeholders: ['mypod', 'shop'],
    },
  ],
  commonMistakes: [
    'Expecting an env-var change to reach a running container. It cannot - the Pod must be recreated.',
    'Using `envFrom` when the task requires a renamed variable. Only `env[].valueFrom` can rename.',
    'Forgetting `divisor` on `resourceFieldRef` for memory, and getting bytes (536870912) where you wanted MiB (512).',
    'Trying to expose a whole label map as an env var. Only individual labels work; whole maps require a downwardAPI volume.',
    'Using `${VAR}` instead of `$(VAR)` for interpolation - Kubernetes only understands the parentheses form.',
    'Referring to a variable declared *later* in the `env` list; interpolation only sees earlier entries.',
    'Relying on legacy `<SERVICE>_SERVICE_HOST` variables, which only exist for Services created before the Pod.',
    'Importing two ConfigMaps with `envFrom` that share key names, with no `prefix`, and getting a silent override.',
  ],
  examTips: [
    '`kubectl set env deployment/<name> KEY=value` is the fastest way to add a literal; `--from=configmap/x` or `--from=secret/x` for bulk.',
    'A task saying "expose key X as variable Y" means `env[].valueFrom.configMapKeyRef` with a different `name` - not `envFrom`.',
    'A task saying "the container must know its own Pod name / IP / node" means the downward API with `fieldRef`.',
    '`kubectl explain pod.spec.containers.env.valueFrom --recursive` lists all four reference types if you forget one.',
    'Verify with `kubectl exec <pod> -- printenv <VAR>` - that is effectively what a grader checks.',
    'Remember the precedence: `envFrom` first (in order), then `env` wins.',
  ],
  summary: [
    'Five sources: literal `value`, ConfigMap key, Secret key, downward API (`fieldRef`), container resources (`resourceFieldRef`).',
    '`envFrom` imports everything without renaming and skips invalid identifiers; `prefix` avoids collisions.',
    '`env` overrides `envFrom`; later `envFrom` sources override earlier ones.',
    '`$(VAR)` interpolates earlier entries in the same container, in `value`, `command` and `args`.',
    'Whole label/annotation maps and live updates require a `downwardAPI` volume, not env vars.',
  ],
  practice: [
    {
      id: 'env-p1',
      level: 'beginner',
      prompt:
        'Write the env entry that gives a container its own Pod name in the variable `POD_NAME`.',
      answer:
        'env:\n  - name: POD_NAME\n    valueFrom:\n      fieldRef:\n        fieldPath: metadata.name',
      explanation:
        "This is the downward API. The other paths you should know: `metadata.namespace`, `status.podIP`, `spec.nodeName`, `metadata.labels['key']`.",
    },
    {
      id: 'env-p2',
      level: 'intermediate',
      prompt:
        'A container has `envFrom` importing ConfigMap `base` (LOG_LEVEL=info) and an `env` entry setting LOG_LEVEL=debug. What value does the container see, and why?',
      answer:
        'debug. `envFrom` sources are applied first, then `env` entries, so an explicit `env` entry always overrides a bulk import of the same name.',
      explanation:
        'Within `envFrom`, later sources override earlier ones. This ordering makes `env` the natural place for a deliberate per-environment override on top of a shared base ConfigMap.',
    },
    {
      id: 'env-p3',
      level: 'advanced',
      prompt:
        'A container has `limits.memory: 2Gi`. Write the env entry that exposes this as `MEM_LIMIT_MB` in mebibytes, and say what value appears without a divisor.',
      answer:
        'env:\n  - name: MEM_LIMIT_MB\n    valueFrom:\n      resourceFieldRef:\n        containerName: app\n        resource: limits.memory\n        divisor: 1Mi\n\nWith divisor 1Mi the value is 2048. Without a divisor it defaults to 1 (bytes), giving 2147483648.',
      explanation:
        "For CPU, `divisor: 1m` gives millicores and the default `1` gives whole cores (rounded up). `containerName` is required and must name a container in the same Pod - which lets a sidecar read the main container's limits.",
    },
  ],
  lab: {
    title: 'Inject configuration from every source and prove precedence',
    scenario:
      'You will build a container whose environment comes from literals, a ConfigMap, a Secret, Pod metadata and its own resource limits, then demonstrate the precedence rules and the downwardAPI volume.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `env-lab` and set it as default.' },
      {
        instruction:
          'Create ConfigMaps `base` (LOG_LEVEL=info, REGION=eu) and `override` (LOG_LEVEL=warn), and a Secret `creds` with password.',
      },
      {
        instruction:
          'Create a Pod that imports both ConfigMaps via envFrom in order, and also sets LOG_LEVEL explicitly via env; predict then verify the winner.',
      },
      {
        instruction:
          'Add downward API variables for Pod name, namespace, IP, node and the `app` label; verify them.',
      },
      {
        instruction:
          "Add resourceFieldRef variables for the container's CPU request in millicores and memory limit in MiB; verify the units.",
      },
      { instruction: 'Add a prefixed bulk import of the Secret and confirm the prefixed names.' },
      {
        instruction:
          'Create a second Pod with a downwardAPI volume exposing the whole label map as a file, and relabel the Pod to see the file update.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the sources',
        language: 'bash',
        code: `kubectl create namespace env-lab
kubectl config set-context --current --namespace=env-lab

kubectl create configmap base --from-literal=LOG_LEVEL=info --from-literal=REGION=eu
kubectl create configmap override --from-literal=LOG_LEVEL=warn
kubectl create secret generic creds --from-literal=password=s3cret --from-literal=user=app`,
      },
      {
        title: 'Steps 3-6 - one Pod, every source',
        language: 'yaml',
        code: `# env-demo.yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-demo
  namespace: env-lab
  labels:
    app: api
    tier: backend
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      resources:
        requests:
          cpu: 250m
          memory: 128Mi
        limits:
          cpu: "1"
          memory: 512Mi
      envFrom:
        - configMapRef:
            name: base # LOG_LEVEL=info, REGION=eu
        - configMapRef:
            name: override # LOG_LEVEL=warn  (later wins over base)
        - secretRef:
            name: creds
          prefix: SEC_ # SEC_password, SEC_user
      env:
        - name: LOG_LEVEL
          value: debug # env beats every envFrom
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: APP_LABEL
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['app']
        - name: CPU_REQ_M
          valueFrom:
            resourceFieldRef:
              containerName: app
              resource: requests.cpu
              divisor: 1m
        - name: MEM_LIMIT_MB
          valueFrom:
            resourceFieldRef:
              containerName: app
              resource: limits.memory
              divisor: 1Mi
        - name: MEM_LIMIT_BYTES
          valueFrom:
            resourceFieldRef:
              containerName: app
              resource: limits.memory # no divisor -> bytes
        - name: SELF_URL
          value: "http://$(POD_IP):8080/healthz"`,
      },
      {
        title: 'Verify precedence, downward API and units',
        language: 'bash',
        code: `kubectl apply -f env-demo.yaml
kubectl wait --for=condition=Ready pod/env-demo --timeout=90s

# Precedence: base said info, override said warn, env said debug
kubectl exec env-demo -- printenv LOG_LEVEL
# debug

kubectl exec env-demo -- printenv REGION
# eu                    <- only base defines it, so it survives

# Downward API
kubectl exec env-demo -- printenv POD_NAME POD_NAMESPACE POD_IP NODE_NAME APP_LABEL
# env-demo
# env-lab
# 10.244.1.9
# kind-worker
# api

# Units from divisors
kubectl exec env-demo -- printenv CPU_REQ_M MEM_LIMIT_MB MEM_LIMIT_BYTES
# 250
# 512
# 536870912             <- no divisor means bytes

# Interpolation
kubectl exec env-demo -- printenv SELF_URL
# http://10.244.1.9:8080/healthz

# Prefixed bulk import
kubectl exec env-demo -- sh -c 'printenv | grep ^SEC_'
# SEC_password=s3cret
# SEC_user=app`,
      },
      {
        title: 'Step 7 - the downwardAPI volume and a live update',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: downward-files
  namespace: env-lab
  labels:
    app: api
    tier: backend
spec:
  volumes:
    - name: podinfo
      downwardAPI:
        items:
          - path: labels
            fieldRef:
              fieldPath: metadata.labels
          - path: name
            fieldRef:
              fieldPath: metadata.name
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: podinfo
          mountPath: /etc/podinfo
          readOnly: true
YAML

kubectl wait --for=condition=Ready pod/downward-files --timeout=90s
kubectl exec downward-files -- cat /etc/podinfo/labels
# app="api"
# tier="backend"

# Relabel the Pod and the FILE updates (an env var never would)
kubectl label pod downward-files stage=canary
for i in $(seq 1 18); do
  kubectl exec downward-files -- cat /etc/podinfo/labels | grep -q canary && break
  sleep 5
done
kubectl exec downward-files -- cat /etc/podinfo/labels
# app="api"
# stage="canary"
# tier="backend"`,
      },
      {
        title: 'Step 8 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace env-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec env-demo -n env-lab -- printenv LOG_LEVEL MEM_LIMIT_MB APP_LABEL',
        what: 'Three answers in one command: precedence, divisor units and a label from the downward API.',
        expected: 'debug, 512, api.',
      },
      {
        command: 'kubectl exec downward-files -n env-lab -- cat /etc/podinfo/labels',
        what: 'Confirms the whole label map is available as a file and reflects the relabel.',
        expected: 'Three label lines including stage="canary".',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace env-lab',
        what: 'Removes both Pods, the ConfigMaps and the Secret.',
        expected: 'namespace "env-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['configmaps', 'secrets', 'resource-requirements', 'commands-and-args'],
  docs: [
    {
      title: 'Define environment variables for a container',
      url: 'https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/',
    },
    {
      title: 'Expose Pod information to containers through environment variables',
      url: 'https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/',
    },
    {
      title: 'Downward API',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/downward-api/',
    },
  ],
}
