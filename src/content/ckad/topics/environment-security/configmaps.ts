import type { Topic } from '../../../types'

export const configmaps: Topic = {
  id: 'configmaps',
  title: 'ConfigMaps',
  domainId: 'environment-security',
  difficulty: 'beginner',
  estimatedMinutes: 22,
  order: 1,
  tags: ['configmap', 'from-literal', 'from-file', 'from-env-file', 'immutable', 'binaryData'],
  oneLiner:
    'Keep configuration out of your image: create ConfigMaps four different ways, consume them as env vars or files, and know which consumption method updates live.',
  explanation: [
    'A **ConfigMap** stores non-confidential configuration as key/value pairs. It exists so that the same image can run in dev, staging and production with different settings - the image stays immutable, the ConfigMap changes.',
    'Values in `data` must be **strings**. `MAX_RETRIES: 3` is a validation error because YAML parses `3` as an integer; it must be `"3"`. Binary content goes in `binaryData` as base64.',
    'There are four ways to create one: from literals (`--from-literal=K=V`), from a file whose *name* becomes the key (`--from-file=nginx.conf`), from a file with an explicit key (`--from-file=key=path`), and from a dotenv-style file where each line becomes a key (`--from-env-file=app.env`).',
    'There are three ways to consume one, and the difference matters: individual env vars (`env[].valueFrom.configMapKeyRef`), all keys as env vars (`envFrom.configMapRef`), or files in a volume (`volumes[].configMap`). **Only the volume form updates live** - environment variables are set once at container start and never change.',
    'A ConfigMap marked `immutable: true` cannot be changed afterwards, only deleted and recreated. That protects against accidental edits and lets the kubelet stop watching it, which reduces API load at scale.',
  ],
  whyItMatters: [
    '"Understand ConfigMaps" is a named curriculum competency, and ConfigMap tasks appear in almost every practice exam - usually "create a ConfigMap with these keys and consume it in this Pod".',
    'The env-versus-volume update distinction is the single most commonly tested subtlety: people change a ConfigMap, see nothing happen, and do not know that a rollout is required.',
    'The string-typing rule catches people out constantly, and the error message ("got integer, expected string") is easy to fix once you have seen it.',
  ],
  howItWorks: [
    'ConfigMaps are namespaced and are limited to 1 MiB of data. They are stored in etcd in plain text - anyone with read access to the namespace can read them, which is why credentials belong in a Secret instead.',
    'Volume-mounted ConfigMaps are projected as a directory of symlinks, one per key. The kubelet refreshes them periodically (roughly every minute, based on the sync period plus cache TTL), so a changed value appears in the file without restarting the Pod - if the application re-reads the file.',
    '`subPath` mounts are the exception: they project a single file by copying it, so they never receive updates. If you use `subPath`, changing the ConfigMap requires `kubectl rollout restart`.',
    'Environment variables from a ConfigMap are resolved when the container starts. Changing the ConfigMap has no effect on running containers, ever.',
    'A missing ConfigMap referenced by `env[].valueFrom` or `envFrom` puts the container in `CreateContainerConfigError` until it exists - the kubelet retries, so creating the ConfigMap fixes the Pod without a restart.',
    'Mark a key optional with `optional: true` on the reference, which lets the container start even when the ConfigMap or key is absent.',
    '`envFrom` skips keys whose names are not valid environment-variable identifiers (for example `nginx.conf`) and reports them as an event rather than failing.',
  ],
  keyObjects: [
    {
      kind: 'ConfigMap',
      apiVersion: 'v1',
      purpose: 'Namespaced store of non-confidential configuration.',
      fields: [
        { path: 'data', meaning: 'map[string]string - every value must be a string.' },
        {
          path: 'binaryData',
          meaning: 'map[string][]byte, base64-encoded, for non-UTF-8 content.',
        },
        {
          path: 'immutable',
          meaning: 'true prevents any further change; the object must be recreated.',
        },
      ],
    },
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'The three consumption mechanisms.',
      fields: [
        {
          path: 'spec.containers[].env[].valueFrom.configMapKeyRef',
          meaning: 'One key as one env var. Set at start; never updates.',
        },
        {
          path: 'spec.containers[].envFrom[].configMapRef',
          meaning: 'Every key as an env var. Set at start; never updates.',
        },
        {
          path: 'spec.volumes[].configMap.name',
          meaning: 'Project keys as files. Updates live (except with subPath).',
        },
        {
          path: 'spec.volumes[].configMap.items[]',
          meaning: 'Project only selected keys, optionally renamed and with a file mode.',
        },
        {
          path: 'spec.volumes[].configMap.defaultMode',
          meaning: 'File permissions for projected files, in octal (e.g. 0644).',
        },
        {
          path: 'spec.volumes[].configMap.optional',
          meaning: 'true lets the Pod start if the ConfigMap does not exist.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The config change that "did nothing"',
    story: [
      'An on-call engineer needs to raise the log level to debug. They edit the ConfigMap: `kubectl edit configmap app-config`, change `LOG_LEVEL: info` to `debug`, save. Nothing happens. The logs stay at info level for twenty minutes while they re-read their change and doubt themselves.',
      "The cause: the Deployment consumes the ConfigMap through `envFrom`, so `LOG_LEVEL` was baked into the container's environment when it started. Environment variables cannot be changed in a running process from outside.",
      'The immediate fix is `kubectl rollout restart deployment/api`, which recreates the Pods and picks up the new value.',
      'The durable fix, for settings they expect to change at runtime, is to mount the ConfigMap as a volume and have the application re-read the file. The kubelet updates the projected file within about a minute, with no restart.',
      'They also switched the Kustomize setup to use a `configMapGenerator`, whose hashed name changes when the content changes - which makes the Deployment template change, which triggers a rollout automatically. The class of mistake disappeared.',
    ],
    code: [
      {
        title: 'Which consumption method did you use?',
        language: 'bash',
        code: `# Was it env or a volume? This tells you whether a restart is needed.
kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.containers[0].envFrom}{"\\n"}'
# [{"configMapRef":{"name":"app-config"}}]     <- env: needs a restart

kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.volumes}{"\\n"}'
# null                                          <- no volume mount

# So the change requires:
kubectl rollout restart deployment/api -n shop
kubectl rollout status deployment/api -n shop --timeout=120s
kubectl exec deploy/api -n shop -- printenv LOG_LEVEL
# debug`,
        explanation:
          'Two jsonpath queries answer "why did my config change do nothing?" faster than any amount of re-reading the ConfigMap.',
        placeholders: ['api', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A ConfigMap with simple values and a whole config file',
      language: 'yaml',
      code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: shop
data:
  # Simple key/value settings
  LOG_LEVEL: debug
  MAX_RETRIES: "3" # QUOTED - values must be strings
  FEATURE_CHECKOUT_V2: "true" # QUOTED - otherwise a boolean
  API_TIMEOUT: "30s"

  # A whole file, using a literal block to preserve newlines.
  # The key becomes the filename when mounted as a volume.
  nginx.conf: |
    server {
      listen 8080;
      location /healthz {
        return 200 'ok';
        add_header Content-Type text/plain;
      }
      location / {
        proxy_pass http://127.0.0.1:3000;
      }
    }
binaryData:
  # Non-UTF-8 content, base64-encoded. "aGVsbG8K" is "hello\\n".
  logo.bin: aGVsbG8K`,
      explanation:
        'The three unquoted-value traps are numbers, booleans and version strings like `1.27` (a float). When in doubt, quote it.',
      placeholders: ['app-config', 'shop'],
    },
    {
      title: 'All three consumption methods in one Pod',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: consumer
  namespace: shop
spec:
  volumes:
    # 3. As files - THIS is the one that updates live
    - name: config
      configMap:
        name: app-config
        defaultMode: 0644
        items: # project only these keys
          - key: nginx.conf
            path: nginx.conf
          - key: LOG_LEVEL
            path: log-level.txt
  containers:
    - name: app
      image: nginx:1.27-alpine
      env:
        # 1. One key as one env var, optionally renamed
        - name: LOGGING_LEVEL # the env var name in the container
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL # the key in the ConfigMap
        - name: OPTIONAL_SETTING
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NOT_PRESENT
              optional: true # container starts even if the key is missing
      envFrom:
        # 2. Every key as an env var, named exactly as the key.
        #    Keys that are not valid identifiers (nginx.conf) are skipped.
        - configMapRef:
            name: app-config
      volumeMounts:
        - name: config
          mountPath: /etc/app
          readOnly: true`,
      explanation:
        'The container ends up with `/etc/app/nginx.conf` and `/etc/app/log-level.txt` as files, plus LOGGING_LEVEL, LOG_LEVEL, MAX_RETRIES, FEATURE_CHECKOUT_V2 and API_TIMEOUT as environment variables.',
      placeholders: ['consumer', 'shop', 'app-config'],
    },
    {
      title: 'subPath: one file into an existing directory',
      language: 'yaml',
      code: `spec:
  volumes:
    - name: config
      configMap:
        name: app-config
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        # Without subPath this would REPLACE /etc/nginx/conf.d entirely,
        # deleting the files the image ships there.
        - name: config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: nginx.conf
          readOnly: true
        # Trade-off: subPath mounts do NOT receive ConfigMap updates.
        # Changing app-config requires kubectl rollout restart.`,
      explanation:
        'This is the standard way to inject one config file. Remember the cost: you lose live updates for that file.',
    },
    {
      title: 'An immutable ConfigMap',
      language: 'yaml',
      code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v3
  namespace: shop
immutable: true # cannot be edited; delete and recreate to change
data:
  LOG_LEVEL: info
  MAX_RETRIES: "5"`,
      explanation:
        'Immutable ConfigMaps pair well with a versioned name (`-v3`): to change configuration you create a new object and update the Deployment to reference it, which gives you a rollout and a rollback for free.',
      placeholders: ['app-config-v3', 'shop'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl create configmap app-config --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=3 -n shop',
      what: 'Creates a ConfigMap from key/value pairs. No quoting problems - everything is a string already.',
      expected: 'configmap/app-config created',
      placeholders: ['app-config', 'shop'],
    },
    {
      command: 'kubectl create configmap nginx-config --from-file=nginx.conf -n shop',
      what: 'The filename becomes the key and the file content becomes the value.',
      expected: 'configmap/nginx-config created, with key `nginx.conf`.',
      placeholders: ['nginx-config', 'nginx.conf', 'shop'],
    },
    {
      command:
        'kubectl create configmap nginx-config --from-file=default.conf=./conf/nginx.conf -n shop',
      what: 'Explicit key, so the key name is independent of the local filename.',
      expected: 'A ConfigMap with key `default.conf`.',
      placeholders: ['nginx-config', './conf/nginx.conf', 'shop'],
    },
    {
      command: 'kubectl create configmap app-config --from-env-file=app.env -n shop',
      what: 'Each `KEY=value` line in the file becomes a key. Ideal for existing dotenv files.',
      expected: 'One key per line of the file.',
      placeholders: ['app-config', 'app.env', 'shop'],
    },
    {
      command: 'kubectl create configmap app-config --from-file=./config-dir/ -n shop',
      what: 'Every file in the directory becomes a key. Subdirectories are ignored.',
      expected: 'One key per file.',
      placeholders: ['app-config', './config-dir/', 'shop'],
    },
    {
      command:
        'kubectl create configmap app-config --from-literal=LOG_LEVEL=debug --dry-run=client -o yaml > cm.yaml',
      what: 'Generates the manifest for editing - the fastest way to get valid, correctly quoted YAML.',
      expected: 'A file with a `data` block.',
      placeholders: ['app-config'],
    },
    {
      command: 'kubectl get configmap app-config -n shop -o yaml',
      what: 'Shows the stored keys and values in full.',
      expected: 'The data block as stored.',
      placeholders: ['app-config', 'shop'],
    },
    {
      command: 'kubectl describe configmap app-config -n shop',
      what: 'Human-readable listing with the size of each value - handy for large embedded files.',
      expected: 'Data section listing each key and its content.',
      placeholders: ['app-config', 'shop'],
    },
    {
      command: 'kubectl get configmap app-config -n shop -o jsonpath=\'{.data.LOG_LEVEL}{"\\n"}\'',
      what: 'Reads one value without wading through YAML.',
      expected: 'debug',
      placeholders: ['app-config', 'shop'],
    },
    {
      command: 'kubectl set env deployment/api --from=configmap/app-config -n shop',
      what: 'Adds every key of a ConfigMap as env vars on an existing Deployment, triggering a rollout.',
      expected: 'deployment.apps/api env updated',
      placeholders: ['api', 'app-config', 'shop'],
    },
    {
      command:
        'kubectl create configmap app-config --from-literal=LOG_LEVEL=info -n shop --dry-run=client -o yaml | kubectl apply -f -',
      what: 'The idempotent update pattern: regenerate and apply, since `create` fails on an existing object.',
      expected: 'configmap/app-config configured',
      placeholders: ['app-config', 'shop'],
    },
    {
      command: 'kubectl rollout restart deployment/api -n shop',
      what: 'Required after changing a ConfigMap consumed as environment variables.',
      expected: 'deployment.apps/api restarted',
      placeholders: ['api', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate the ConfigMap with `kubectl create configmap ... --dry-run=client -o yaml` so string quoting is handled for you.',
      'Decide the consumption method: env vars for values fixed at start, a volume for anything you expect to change at runtime.',
      'Reference it from the Pod template, and add `optional: true` only when the container must start without it.',
      'For env-var consumption, plan how the change reaches running Pods: `kubectl rollout restart`, a versioned ConfigMap name, or a Kustomize generator hash.',
      'Verify inside the container with `printenv` or `cat`, not by re-reading the ConfigMap.',
    ],
    code: [
      {
        title: 'Versioned ConfigMaps give you rollouts and rollbacks',
        language: 'bash',
        code: `# Instead of editing app-config in place, create a new version...
kubectl create configmap app-config-v2 -n shop \\
  --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=5

# ...and point the Deployment at it. This changes the Pod template,
# so it triggers a normal rolling update - and rollout undo works.
kubectl set env deployment/api -n shop --from=configmap/app-config-v2
kubectl rollout status deployment/api -n shop --timeout=120s

# If the new config is bad:
kubectl rollout undo deployment/api -n shop`,
        placeholders: ['app-config-v2', 'api', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl exec consumer -n shop -- printenv LOG_LEVEL MAX_RETRIES',
      what: 'Confirms env-var injection actually reached the container.',
      expected: 'debug and 3 on separate lines.',
      placeholders: ['consumer', 'shop'],
    },
    {
      command: 'kubectl exec consumer -n shop -- ls -l /etc/app',
      what: 'Confirms volume projection - the files appear as symlinks into a timestamped directory.',
      expected: 'nginx.conf and log-level.txt.',
      placeholders: ['consumer', 'shop'],
    },
    {
      command: 'kubectl exec consumer -n shop -- cat /etc/app/nginx.conf',
      what: 'Confirms the file content matches the ConfigMap value.',
      expected: 'The nginx server block.',
      placeholders: ['consumer', 'shop'],
    },
    {
      command: 'kubectl get configmap app-config -n shop -o jsonpath=\'{.data}{"\\n"}\'',
      what: 'All keys and values as JSON, for a quick diff against what you intended.',
      expected: '{"LOG_LEVEL":"debug","MAX_RETRIES":"3",...}',
      placeholders: ['app-config', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl get pod consumer -n shop -o jsonpath=\'{.status.containerStatuses[0].state.waiting.message}{"\\n"}\'',
      what: 'A missing ConfigMap or key produces CreateContainerConfigError with the name in the message.',
      expected: 'configmap "app-config" not found',
      placeholders: ['consumer', 'shop'],
    },
    {
      command: 'kubectl apply -f cm.yaml',
      what: 'An unquoted number or boolean fails validation here, with the offending key named.',
      expected:
        'invalid type for io.k8s.api.core.v1.ConfigMap.data: got "integer", expected "string"',
      placeholders: ['cm.yaml'],
    },
    {
      command: 'kubectl exec consumer -n shop -- printenv | sort',
      what: 'The definitive list of what the container actually received, including keys `envFrom` skipped.',
      expected: 'Your keys among the standard Kubernetes variables.',
      placeholders: ['consumer', 'shop'],
    },
    {
      command: 'kubectl describe pod consumer -n shop | grep -iA3 "invalid\\|skipped"',
      what: '`envFrom` skips keys that are not valid identifiers (such as `nginx.conf`) and records an event.',
      expected:
        'Keys [nginx.conf] from ConfigMap app-config were skipped since they are considered invalid environment variable names.',
      placeholders: ['consumer', 'shop'],
    },
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.spec.template.spec.containers[0].envFrom}{"|"}{.spec.template.spec.volumes}{"\\n"}\'',
      what: 'Answers "does a ConfigMap change need a restart?" - env yes, volume no.',
      expected: 'Shows which mechanism the Deployment uses.',
      placeholders: ['api', 'shop'],
    },
  ],
  commonMistakes: [
    'Unquoted numbers, booleans or version strings in `data`. Every value must be a string.',
    'Changing a ConfigMap consumed as env vars and expecting running Pods to pick it up. They never will - restart them.',
    'Using `subPath` and then expecting live updates. subPath mounts are copies and do not refresh.',
    "Mounting a ConfigMap over a directory such as `/etc/nginx/conf.d` and deleting the image's own files.",
    'Putting credentials in a ConfigMap. Use a Secret - ConfigMaps are readable by anyone with namespace read access.',
    'Using `kubectl create configmap` for an update; it fails with AlreadyExists. Use the `--dry-run=client -o yaml | kubectl apply -f -` pattern.',
    'Expecting `envFrom` to import a key named `nginx.conf`. Invalid identifiers are silently skipped.',
    'Exceeding the 1 MiB limit by embedding a large file - store it in an image or a volume instead.',
  ],
  examTips: [
    '`kubectl create configmap <name> --from-literal=K=V --from-literal=K2=V2` is the fastest correct answer and avoids quoting mistakes entirely.',
    'Read the task carefully for the consumption method: "as environment variables" → `envFrom`/`configMapKeyRef`; "as a file at /path" → a volume mount.',
    'When a task renames a key ("expose LOG_LEVEL as APP_LOG"), that is `env[].valueFrom.configMapKeyRef` with a different `name`, not `envFrom`.',
    '`kubectl exec <pod> -- printenv` and `kubectl exec <pod> -- cat /path/file` are the two verification commands graders effectively check.',
    'If a Pod is in `CreateContainerConfigError`, a ConfigMap or Secret reference is wrong - the waiting message names it.',
    '`kubectl set env deployment/x --from=configmap/y` wires up every key in one line.',
  ],
  summary: [
    'ConfigMaps hold non-confidential string key/value data, namespaced, 1 MiB limit, plain text in etcd.',
    'Create from literals, a file (name as key), an explicit key=path, a dotenv file, or a directory.',
    'Consume as single env vars, all env vars (`envFrom`), or files in a volume.',
    'Only volume mounts update live; env vars are fixed at container start; `subPath` mounts never update.',
    'A missing ConfigMap gives `CreateContainerConfigError`, and creating it fixes the Pod without a restart.',
  ],
  practice: [
    {
      id: 'cm-p1',
      level: 'beginner',
      prompt:
        'Write the command that creates a ConfigMap `app-config` in namespace `shop` with `LOG_LEVEL=debug` and `MAX_RETRIES=3`.',
      answer:
        'kubectl create configmap app-config -n shop --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=3',
      explanation:
        'Using the imperative form means no quoting problems - kubectl stores both values as strings. Writing `MAX_RETRIES: 3` in YAML would fail validation.',
    },
    {
      id: 'cm-p2',
      level: 'intermediate',
      prompt:
        'A ConfigMap key `LOG_LEVEL` must appear in a container as the environment variable `APP_LOG_LEVEL`. Write the fragment.',
      answer:
        'env:\n  - name: APP_LOG_LEVEL\n    valueFrom:\n      configMapKeyRef:\n        name: app-config\n        key: LOG_LEVEL',
      explanation:
        '`envFrom` cannot rename - it always uses the key as the variable name. Renaming requires the explicit `env[].valueFrom.configMapKeyRef` form.',
    },
    {
      id: 'cm-p3',
      level: 'advanced',
      prompt:
        'You change a ConfigMap value. Pods consuming it as a volume pick it up within a minute; Pods consuming it via envFrom never do. Explain both, and give the command that fixes the second case.',
      answer:
        'Volume-mounted ConfigMaps are projected files that the kubelet refreshes periodically, so the file content changes in place (as long as the application re-reads it). Environment variables are resolved once when the container process starts and cannot be changed from outside afterwards.\n\nFix: `kubectl rollout restart deployment/<name> -n <ns>` - this recreates the Pods, which re-resolve the ConfigMap.',
      explanation:
        'The exception on the volume side is `subPath`, which copies a single file and does not refresh. For a durable solution, use a versioned ConfigMap name or a Kustomize `configMapGenerator`, whose content hash changes the Pod template and triggers a rollout automatically.',
    },
  ],
  lab: {
    title: 'All four creation methods, all three consumption methods',
    scenario:
      'You will create ConfigMaps from literals, a file and a dotenv file, consume them as single env vars, as a bulk import and as mounted files, and then prove which consumption method sees a live update.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `cm-lab` and set it as default.' },
      {
        instruction:
          'Create `app-config` from two literals; create `nginx-config` from a local nginx.conf file; create `env-config` from a dotenv file.',
      },
      { instruction: 'Inspect all three and confirm the key names came from the right place.' },
      {
        instruction:
          'Create a Pod consuming app-config as a renamed env var, env-config via envFrom, and nginx-config as a mounted file.',
      },
      { instruction: 'Verify each consumption method from inside the container.' },
      {
        instruction:
          'Change a value in app-config and in nginx-config, then show that the mounted file updates while the env var does not.',
      },
      { instruction: "Restart the Pod's owner (or recreate the Pod) to pick up the env change." },
      {
        instruction:
          'Prove that a Pod referencing a missing ConfigMap gets CreateContainerConfigError, then fix it by creating the ConfigMap.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - three creation methods',
        language: 'bash',
        code: `kubectl create namespace cm-lab
kubectl config set-context --current --namespace=cm-lab
mkdir -p /tmp/cm-lab && cd /tmp/cm-lab

kubectl create configmap app-config \\
  --from-literal=LOG_LEVEL=info --from-literal=MAX_RETRIES=3

cat > nginx.conf <<'CONF'
server {
  listen 8080;
  location / { return 200 'v1\\n'; }
}
CONF
kubectl create configmap nginx-config --from-file=nginx.conf

cat > app.env <<'ENV'
FEATURE_A=on
FEATURE_B=off
REGION=eu-west-1
ENV
kubectl create configmap env-config --from-env-file=app.env

kubectl get cm
kubectl get cm nginx-config -o jsonpath='{.data}' | head -c 80; echo
# {"nginx.conf":"server {\\n  listen 8080;..."     <- filename became the key
kubectl get cm env-config -o jsonpath='{range $k,$v := .data}{$k}={$v}{"\\n"}{end}'
# FEATURE_A=on
# FEATURE_B=off
# REGION=eu-west-1`,
      },
      {
        title: 'Step 4 - one Pod, three methods',
        language: 'yaml',
        code: `# consumer.yaml
apiVersion: v1
kind: Pod
metadata:
  name: consumer
  namespace: cm-lab
spec:
  volumes:
    - name: nginxconf
      configMap:
        name: nginx-config
  containers:
    - name: app
      image: nginx:1.27-alpine
      env:
        # renamed single key
        - name: APP_LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
      envFrom:
        # every key of env-config, using the key names as-is
        - configMapRef:
            name: env-config
      volumeMounts:
        - name: nginxconf
          mountPath: /etc/app
          readOnly: true`,
      },
      {
        title: 'Step 5 - verify all three',
        language: 'bash',
        code: `kubectl apply -f - <<'YAML'
$(cat consumer.yaml)
YAML
# (or: kubectl apply -f consumer.yaml)
kubectl apply -f consumer.yaml
kubectl wait --for=condition=Ready pod/consumer --timeout=90s

kubectl exec consumer -- printenv APP_LOG_LEVEL
# info                       <- renamed single key

kubectl exec consumer -- printenv FEATURE_A FEATURE_B REGION
# on
# off
# eu-west-1                  <- bulk import

kubectl exec consumer -- cat /etc/app/nginx.conf
# server { ... return 200 'v1'; ... }    <- mounted file

kubectl exec consumer -- ls -l /etc/app
# nginx.conf -> ..data/nginx.conf        <- symlink, which is how live update works`,
      },
      {
        title: 'Step 6 - the live-update experiment',
        language: 'bash',
        code: `# Change BOTH ConfigMaps
kubectl create configmap app-config --from-literal=LOG_LEVEL=debug \\
  --from-literal=MAX_RETRIES=3 --dry-run=client -o yaml | kubectl apply -f -

sed -i "s/v1/v2/" nginx.conf
kubectl create configmap nginx-config --from-file=nginx.conf \\
  --dry-run=client -o yaml | kubectl apply -f -

echo "waiting up to 90s for the kubelet to refresh the projected volume..."
for i in $(seq 1 18); do
  if kubectl exec consumer -- cat /etc/app/nginx.conf | grep -q v2; then break; fi
  sleep 5
done

kubectl exec consumer -- cat /etc/app/nginx.conf | grep 200
#   location / { return 200 'v2'; }      <- UPDATED without a restart

kubectl exec consumer -- printenv APP_LOG_LEVEL
# info                                    <- NOT updated, still the old value`,
      },
      {
        title: 'Steps 7-9 - restart, the error case, cleanup',
        language: 'bash',
        code: `# Env vars only change when the container is recreated
kubectl delete pod consumer
kubectl apply -f consumer.yaml
kubectl wait --for=condition=Ready pod/consumer --timeout=90s
kubectl exec consumer -- printenv APP_LOG_LEVEL
# debug                                   <- now picked up

# The missing-ConfigMap error
kubectl run broken --image=nginx:1.27-alpine --overrides='
{"spec":{"containers":[{"name":"broken","image":"nginx:1.27-alpine",
 "envFrom":[{"configMapRef":{"name":"not-yet"}}]}]}}'
sleep 10
kubectl get pod broken
# broken   0/1   CreateContainerConfigError   0   10s
kubectl get pod broken -o jsonpath='{.status.containerStatuses[0].state.waiting.message}{"\\n"}'
# configmap "not-yet" not found

kubectl create configmap not-yet --from-literal=OK=yes
sleep 20
kubectl get pod broken
# broken   1/1   Running   0   35s        <- fixed itself, no restart needed

cd - >/dev/null && rm -rf /tmp/cm-lab
kubectl config set-context --current --namespace=default
kubectl delete namespace cm-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec consumer -n cm-lab -- cat /etc/app/nginx.conf',
        what: 'The mounted file should show the updated content without any Pod restart.',
        expected: "return 200 'v2'",
      },
      {
        command: 'kubectl exec consumer -n cm-lab -- printenv APP_LOG_LEVEL',
        what: 'Before the recreate it shows the old value; after, the new one.',
        expected: 'info before, debug after.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace cm-lab',
        what: 'Removes all ConfigMaps and Pods.',
        expected: 'namespace "cm-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['secrets', 'env-and-config-injection', 'volumes-and-ephemeral-storage'],
  docs: [
    { title: 'ConfigMaps', url: 'https://kubernetes.io/docs/concepts/configuration/configmap/' },
    {
      title: 'Configure a Pod to use a ConfigMap',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/',
    },
  ],
}
