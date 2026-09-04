import type { Topic } from '../../../types'

export const secrets: Topic = {
  id: 'secrets',
  title: 'Creating and consuming Secrets',
  domainId: 'environment-security',
  difficulty: 'beginner',
  estimatedMinutes: 24,
  order: 2,
  tags: ['secret', 'base64', 'stringData', 'docker-registry', 'tls', 'sa token', 'projected'],
  oneLiner:
    'Store credentials outside your image: the Secret types, base64 versus stringData, the four ways to consume one, and what a Secret does and does not protect.',
  explanation: [
    'A **Secret** is structurally almost identical to a ConfigMap - namespaced key/value data consumed as env vars or files - but with three differences: values are base64-encoded in `data`, Kubernetes handles them slightly more carefully, and there are typed Secrets for specific purposes.',
    'The important honesty: **base64 is encoding, not encryption**. `kubectl get secret -o yaml` plus `base64 -d` reveals the value to anyone with read access. Secrets are protected by RBAC, and optionally by encryption-at-rest configured on the API server. Treat "it is in a Secret" as "it is not in the image and not in a ConfigMap", not as "it is encrypted".',
    'Two ways to write values. `data` requires you to base64-encode them yourself. `stringData` takes plain text and Kubernetes encodes it for you - it is write-only and always what you want in a hand-written manifest.',
    'Types matter. `Opaque` (the default) is arbitrary data. `kubernetes.io/dockerconfigjson` is a registry pull secret and is the only type `imagePullSecrets` accepts. `kubernetes.io/tls` holds `tls.crt` and `tls.key` and is what an Ingress expects. `kubernetes.io/basic-auth`, `ssh-auth` and `kubernetes.io/service-account-token` are the others you may meet.',
    'Consumption mirrors ConfigMaps: single env var (`secretKeyRef`), all keys as env vars (`envFrom.secretRef`), files in a volume, or - for registry credentials - `imagePullSecrets`. As with ConfigMaps, only volume mounts update live.',
  ],
  whyItMatters: [
    '"Create & consume Secrets" is a named curriculum competency, and Secret tasks are extremely common: create one from literals, mount it, or wire up a registry pull secret.',
    'The base64 detail trips people up in both directions: forgetting to encode when writing `data`, and forgetting to decode when reading a value back.',
    'The typed-Secret requirement is a hard rule that produces a confusing failure: a generic Secret used as an `imagePullSecret` silently does not work, and the Pod stays in ImagePullBackOff.',
  ],
  howItWorks: [
    'Secrets are namespaced, limited to 1 MiB, and stored in etcd. Whether they are encrypted at rest depends on cluster configuration (`EncryptionConfiguration`), which is a CKA/CKS concern rather than CKAD.',
    "Secret volumes are backed by **tmpfs** (memory), so their contents never touch the node's disk. ConfigMap volumes are not.",
    '`data` values must be valid base64. `stringData` is merged over `data` at write time and does not appear when you read the object back - only the encoded `data` does.',
    'Volume-mounted Secrets refresh like ConfigMaps (roughly within a minute), except with `subPath`, which does not update. Env vars never update.',
    'A missing Secret referenced by `env` or `envFrom` gives `CreateContainerConfigError`; the kubelet keeps retrying, so creating the Secret fixes the Pod without a restart. `optional: true` lets the container start without it.',
    'ServiceAccount tokens are no longer auto-created as long-lived Secrets. Modern clusters project a short-lived, audience-scoped token into the Pod at `/var/run/secrets/kubernetes.io/serviceaccount/token` via a `projected` volume. A long-lived token Secret can still be created deliberately, and generally should not be.',
    'Default file mode for a Secret volume is 0644; use `defaultMode: 0400` for keys that should not be world-readable inside the container.',
  ],
  keyObjects: [
    {
      kind: 'Secret',
      apiVersion: 'v1',
      purpose: 'Namespaced store for credentials and other sensitive data.',
      fields: [
        {
          path: 'type',
          meaning:
            'Opaque (default), kubernetes.io/dockerconfigjson, kubernetes.io/tls, kubernetes.io/basic-auth, kubernetes.io/ssh-auth.',
        },
        { path: 'data', meaning: 'map[string][]byte - values must be base64-encoded.' },
        {
          path: 'stringData',
          meaning: 'Write-only plain-text input; Kubernetes encodes it into data.',
        },
        { path: 'immutable', meaning: 'true prevents further changes.' },
      ],
    },
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'The four consumption mechanisms.',
      fields: [
        {
          path: 'spec.containers[].env[].valueFrom.secretKeyRef',
          meaning: 'One key as one env var. Fixed at container start.',
        },
        {
          path: 'spec.containers[].envFrom[].secretRef',
          meaning: 'Every key as an env var. Fixed at container start.',
        },
        {
          path: 'spec.volumes[].secret.secretName',
          meaning: 'Project keys as files on tmpfs. Updates live (not with subPath).',
        },
        {
          path: 'spec.volumes[].secret.defaultMode',
          meaning: 'File mode in octal, e.g. 0400 for a private key.',
        },
        {
          path: 'spec.volumes[].secret.items[]',
          meaning: 'Project only selected keys, optionally renamed.',
        },
        {
          path: 'spec.imagePullSecrets[]',
          meaning: 'Registry credentials; requires type kubernetes.io/dockerconfigjson.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A pull secret that was the wrong type',
    story: [
      'A team creates registry credentials with `kubectl create secret generic regcred --from-file=.dockerconfigjson=$HOME/.docker/config.json` and references it in `imagePullSecrets`. Pods stay in ImagePullBackOff with `unauthorized: authentication required`.',
      'The file content is correct. The problem is the *type*: `kubectl create secret generic` produces an `Opaque` Secret, and the kubelet only reads registry credentials from a Secret of type `kubernetes.io/dockerconfigjson`.',
      "`kubectl get secret regcred -o jsonpath='{.type}'` returns `Opaque`, which is the whole diagnosis in one command.",
      'The fix is the purpose-built generator: `kubectl create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...`, which sets both the key name and the type correctly.',
      'The generalisable lesson: whenever a Secret is consumed by Kubernetes itself rather than by your application, the type is part of the contract. That applies to pull secrets and to Ingress TLS.',
    ],
    code: [
      {
        title: 'One command finds it',
        language: 'bash',
        code: `kubectl get secret regcred -n shop -o jsonpath='{.type}{"\\n"}'
# Opaque                                  <- wrong; must be dockerconfigjson

kubectl delete secret regcred -n shop
kubectl create secret docker-registry regcred -n shop \\
  --docker-server=registry.example.com \\
  --docker-username=ci \\
  --docker-password="$REGISTRY_TOKEN"

kubectl get secret regcred -n shop -o jsonpath='{.type}{"\\n"}'
# kubernetes.io/dockerconfigjson          <- correct

kubectl delete pod -l app=api -n shop     # let them be recreated and pull again`,
        explanation:
          'Note the password is passed from an environment variable rather than typed inline, so it does not end up in shell history.',
        placeholders: ['regcred', 'shop', 'registry.example.com', 'ci'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'stringData versus data',
      language: 'yaml',
      code: `# PREFERRED for hand-written manifests: plain text, Kubernetes encodes it
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: shop
type: Opaque
stringData:
  username: shopuser
  password: "S3cret-P@ss!"
  url: "postgres://shopuser:S3cret-P@ss!@postgres:5432/shop"
---
# EQUIVALENT, written the hard way. Values must be valid base64:
#   echo -n 'shopuser' | base64      -> c2hvcHVzZXI=
#   echo -n 'S3cret-P@ss!' | base64  -> UzNjcmV0LVBAc3Mh
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials-encoded
  namespace: shop
type: Opaque
data:
  username: c2hvcHVzZXI=
  password: UzNjcmV0LVBAc3Mh`,
      explanation:
        'Use `echo -n` when encoding by hand - without `-n`, echo appends a newline that becomes part of the secret value and causes authentication failures that are very hard to spot.',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      title: 'All four consumption methods',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: secret-consumer
  namespace: shop
spec:
  # 4. Registry credentials - requires type kubernetes.io/dockerconfigjson
  imagePullSecrets:
    - name: regcred
  volumes:
    # 3. As files on tmpfs - the only method that updates live
    - name: creds
      secret:
        secretName: db-credentials
        defaultMode: 0400 # owner read only
        items:
          - key: password
            path: db-password # projected as /etc/secrets/db-password
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      env:
        # 1. One key as one env var, renamed
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: OPTIONAL_TOKEN
          valueFrom:
            secretKeyRef:
              name: maybe-missing
              key: token
              optional: true # container starts even if absent
      envFrom:
        # 2. Every key as an env var, named exactly as the key
        - secretRef:
            name: db-credentials
      volumeMounts:
        - name: creds
          mountPath: /etc/secrets
          readOnly: true`,
      explanation:
        'Prefer the volume form for anything long-lived: environment variables show up in `kubectl describe pod`, in crash dumps and in child-process environments, whereas a file with mode 0400 does not.',
      placeholders: ['secret-consumer', 'shop', 'db-credentials', 'regcred'],
    },
    {
      title: 'Typed Secrets: TLS and registry credentials',
      language: 'yaml',
      code: `# TLS - the exact key names tls.crt and tls.key are required
apiVersion: v1
kind: Secret
metadata:
  name: shop-tls
  namespace: shop
type: kubernetes.io/tls
data:
  tls.crt: <base64 of the PEM certificate>
  tls.key: <base64 of the PEM private key>
---
# An Ingress consumes it by name
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - shop.example.com
      secretName: shop-tls # must be type kubernetes.io/tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80`,
      explanation:
        'For TLS, both the type *and* the key names are part of the contract. A Secret with the certificate under `cert.pem` will not work no matter how correct the certificate is.',
      placeholders: [
        'shop-tls',
        'shop',
        'shop.example.com',
        '<base64 of the PEM certificate>',
        '<base64 of the PEM private key>',
      ],
    },
    {
      title: 'A projected volume combining a Secret, a ConfigMap and a token',
      language: 'yaml',
      code: `spec:
  serviceAccountName: api-sa
  volumes:
    - name: all-config
      projected:
        defaultMode: 0400
        sources:
          - secret:
              name: db-credentials
              items:
                - key: password
                  path: db/password
          - configMap:
              name: app-config
              items:
                - key: LOG_LEVEL
                  path: app/log-level
          - serviceAccountToken:
              # A short-lived, audience-scoped token - the modern replacement
              # for a long-lived ServiceAccount token Secret.
              path: token
              expirationSeconds: 3600
              audience: api.shop.example.com
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      volumeMounts:
        - name: all-config
          mountPath: /etc/injected
          readOnly: true`,
      explanation:
        'A `projected` volume assembles several sources into one directory tree, which keeps the container filesystem tidy and is the only way to request a short-lived, audience-scoped ServiceAccount token.',
      placeholders: ['api-sa', 'db-credentials', 'app-config', 'api.shop.example.com'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl create secret generic db-credentials --from-literal=username=shopuser --from-literal=password=S3cret -n shop',
      what: 'Creates an Opaque Secret from literals. kubectl base64-encodes the values for you.',
      expected: 'secret/db-credentials created',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command: 'kubectl create secret generic tls-key --from-file=server.key -n shop',
      what: 'The filename becomes the key, the file content the value.',
      expected: 'secret/tls-key created with key `server.key`.',
      placeholders: ['tls-key', 'server.key', 'shop'],
    },
    {
      command: 'kubectl create secret generic app-secrets --from-env-file=secrets.env -n shop',
      what: 'One key per `KEY=value` line of a dotenv file.',
      expected: 'A Secret with one key per line.',
      placeholders: ['app-secrets', 'secrets.env', 'shop'],
    },
    {
      command:
        'kubectl create secret docker-registry regcred --docker-server=registry.example.com --docker-username=ci --docker-password="$TOKEN" -n shop',
      what: 'The only correct way to create a pull secret - sets both the key and the type.',
      expected: 'secret/regcred created, type kubernetes.io/dockerconfigjson.',
      placeholders: ['regcred', 'registry.example.com', 'ci', 'shop'],
    },
    {
      command: 'kubectl create secret tls shop-tls --cert=tls.crt --key=tls.key -n shop',
      what: 'Creates a TLS Secret with the required `tls.crt` and `tls.key` keys and the right type.',
      expected: 'secret/shop-tls created, type kubernetes.io/tls.',
      placeholders: ['shop-tls', 'tls.crt', 'tls.key', 'shop'],
    },
    {
      command:
        "kubectl get secret db-credentials -n shop -o jsonpath='{.data.password}' | base64 -d; echo",
      what: 'Reads one value back in plain text - and demonstrates that base64 is not protection.',
      expected: 'S3cret',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command:
        'kubectl get secret db-credentials -n shop -o go-template=\'{{range $k,$v := .data}}{{$k}}={{$v | base64decode}}{{"\\n"}}{{end}}\'',
      what: 'Decodes every key in one command - the fastest way to inspect a whole Secret.',
      expected: 'username=shopuser and password=S3cret.',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command: 'kubectl get secret db-credentials -n shop -o jsonpath="{.type}"; echo',
      what: 'Confirms the type, which is the contract for pull secrets and TLS.',
      expected: 'Opaque',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command:
        'kubectl create secret generic db-credentials --from-literal=password=NewP@ss -n shop --dry-run=client -o yaml | kubectl apply -f -',
      what: 'The idempotent update pattern, since `create` fails on an existing Secret.',
      expected: 'secret/db-credentials configured',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command: 'kubectl set env deployment/api --from=secret/db-credentials -n shop',
      what: 'Wires every key of a Secret into a Deployment as env vars, triggering a rollout.',
      expected: 'deployment.apps/api env updated',
      placeholders: ['api', 'db-credentials', 'shop'],
    },
    {
      command: 'echo -n "S3cret-P@ss!" | base64',
      what: 'Encoding by hand for a `data` block. The `-n` is essential - a trailing newline becomes part of the value.',
      expected: 'UzNjcmV0LVBAc3Mh',
    },
  ],
  declarative: {
    steps: [
      'Prefer `stringData` in hand-written manifests so you never deal with base64 by hand.',
      'Use the typed generators (`docker-registry`, `tls`) whenever Kubernetes itself will read the Secret.',
      'Consume via a volume with `defaultMode: 0400` for long-lived credentials; env vars are convenient but more exposed.',
      'Never commit a Secret manifest containing real values to version control - keep the manifest and inject values from a secret store or CI variable.',
      'Verify from inside the container, and remember env-var changes need a Pod restart.',
    ],
    code: [
      {
        title: 'Create without leaking into shell history or git',
        language: 'bash',
        code: `# Read the value without echoing it to the terminal
read -rsp "DB password: " DB_PASS; echo

kubectl create secret generic db-credentials -n shop \\
  --from-literal=username=shopuser \\
  --from-literal=password="$DB_PASS" \\
  --dry-run=client -o yaml | kubectl apply -f -

unset DB_PASS

# Confirm without printing the value
kubectl get secret db-credentials -n shop \\
  -o jsonpath='{range $k,$v := .data}{$k}{" "}{end}{"\\n"}'
# username password`,
        placeholders: ['db-credentials', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get secret db-credentials -n shop',
      what: 'Confirms the Secret exists, its type and how many keys it has.',
      expected: 'TYPE Opaque, DATA 2.',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command: 'kubectl exec secret-consumer -n shop -- printenv DB_PASSWORD',
      what: 'Confirms env-var injection reached the container.',
      expected: 'The password value.',
      placeholders: ['secret-consumer', 'shop'],
    },
    {
      command: 'kubectl exec secret-consumer -n shop -- ls -l /etc/secrets',
      what: 'Confirms volume projection and the file mode.',
      expected: 'db-password with mode -r-------- (0400).',
      placeholders: ['secret-consumer', 'shop'],
    },
    {
      command: 'kubectl exec secret-consumer -n shop -- mount | grep /etc/secrets',
      what: 'Confirms Secret volumes are tmpfs, so the value never lands on the node disk.',
      expected: 'tmpfs on /etc/secrets type tmpfs (ro,relatime)',
      placeholders: ['secret-consumer', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl get pod mypod -n shop -o jsonpath=\'{.status.containerStatuses[0].state.waiting.message}{"\\n"}\'',
      what: 'A missing Secret or key produces CreateContainerConfigError naming the object.',
      expected: 'secret "db-credentials" not found',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl get secret regcred -n shop -o jsonpath="{.type}"; echo',
      what: 'The first check for any ImagePullBackOff with an "unauthorized" message.',
      expected: 'kubernetes.io/dockerconfigjson - anything else will not work.',
      placeholders: ['regcred', 'shop'],
    },
    {
      command: 'kubectl apply -f secret.yaml',
      what: 'Invalid base64 in `data` fails here. Use `stringData` to avoid the problem entirely.',
      expected: 'illegal base64 data at input byte N',
      placeholders: ['secret.yaml'],
    },
    {
      command:
        "kubectl get secret db-credentials -n shop -o jsonpath='{.data.password}' | base64 -d | xxd | tail -2",
      what: 'Reveals a trailing newline (0a) accidentally included by `echo` without `-n` - a classic cause of authentication failures.',
      expected: 'No trailing 0a byte.',
      placeholders: ['db-credentials', 'shop'],
    },
    {
      command: 'kubectl describe pod mypod -n shop | grep -iA3 "mount\\|secret"',
      what: 'Shows FailedMount when a Secret volume references something that does not exist.',
      expected: 'MountVolume.SetUp failed for volume "creds": secret "db-credentials" not found.',
      placeholders: ['mypod', 'shop'],
    },
  ],
  commonMistakes: [
    'Believing a Secret is encrypted. Base64 is encoding; protection comes from RBAC and encryption-at-rest configuration.',
    'Using `kubectl create secret generic` for registry credentials. It produces an Opaque Secret, which `imagePullSecrets` ignores.',
    'Using `echo` instead of `echo -n` when encoding, adding a trailing newline to the value.',
    'Writing plain text into `data` instead of `stringData`, which fails with an illegal-base64 error.',
    'Wrong key names in a TLS Secret. They must be exactly `tls.crt` and `tls.key`.',
    'Changing a Secret consumed as env vars and expecting running Pods to notice. They will not - restart them.',
    'Committing a Secret manifest with real values to git.',
    'Leaving the default 0644 mode on a mounted private key, so every process in the container can read it.',
    'Creating long-lived ServiceAccount token Secrets by hand when a projected, short-lived token is available.',
  ],
  examTips: [
    '`kubectl create secret generic <name> --from-literal=k=v` for Opaque; `kubectl create secret docker-registry` for pull secrets; `kubectl create secret tls` for TLS. Three generators, three purposes.',
    'For a hand-written manifest use `stringData` - it removes base64 entirely and graders check behaviour, not encoding.',
    "To read a value: `kubectl get secret <n> -o jsonpath='{.data.<key>}' | base64 -d`.",
    'Whenever a task mentions a private registry, the answer is a `docker-registry` Secret plus `imagePullSecrets` on the Pod (or on the ServiceAccount).',
    'If a task asks for a mounted credential file with restricted permissions, that is `defaultMode: 0400` on the Secret volume.',
    '`CreateContainerConfigError` means a referenced ConfigMap or Secret is missing; the waiting message names it.',
  ],
  summary: [
    'Secrets are ConfigMaps with base64 `data`, typed variants, and tmpfs-backed volumes - not encryption.',
    '`stringData` takes plain text; `data` requires base64 (`echo -n | base64`).',
    'Types are contracts: `dockerconfigjson` for `imagePullSecrets`, `kubernetes.io/tls` with `tls.crt`/`tls.key` for Ingress.',
    'Consume as one env var, all env vars, files in a volume, or `imagePullSecrets`. Only volumes update live.',
    'Prefer volumes with mode 0400 for long-lived credentials; env vars are visible in more places.',
  ],
  practice: [
    {
      id: 'sec-p1',
      level: 'beginner',
      prompt:
        'Write the command that creates a Secret `db-credentials` in namespace `shop` with `username=shopuser` and `password=S3cret`.',
      answer:
        'kubectl create secret generic db-credentials -n shop --from-literal=username=shopuser --from-literal=password=S3cret',
      explanation:
        "kubectl base64-encodes both values. Read one back with `kubectl get secret db-credentials -n shop -o jsonpath='{.data.password}' | base64 -d`.",
    },
    {
      id: 'sec-p2',
      level: 'intermediate',
      prompt:
        'Pods cannot pull from a private registry. The Secret exists and its `.dockerconfigjson` content is correct. What is the most likely cause and the command that confirms it?',
      answer:
        "The Secret has the wrong type - probably `Opaque` from `kubectl create secret generic`. `imagePullSecrets` only reads Secrets of type `kubernetes.io/dockerconfigjson`.\n\nConfirm: `kubectl get secret regcred -n <ns> -o jsonpath='{.type}'`\nFix: recreate with `kubectl create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...`",
      explanation:
        'This fails silently in the sense that no validation error is produced - the Pod simply stays in ImagePullBackOff with an "unauthorized" message, which looks like a credentials problem rather than a type problem.',
    },
    {
      id: 'sec-p3',
      level: 'advanced',
      prompt:
        "A task requires the `password` key of Secret `db-credentials` to appear as the file `/etc/creds/db-password`, readable only by the container's user. Write the volume and mount.",
      answer:
        'volumes:\n  - name: creds\n    secret:\n      secretName: db-credentials\n      defaultMode: 0400\n      items:\n        - key: password\n          path: db-password\n\ncontainers:\n  - name: app\n    image: registry.example.com/shop/api:1.4.2\n    volumeMounts:\n      - name: creds\n        mountPath: /etc/creds\n        readOnly: true',
      explanation:
        '`items` projects only the named key and renames it, so the other keys of the Secret are not exposed. `defaultMode: 0400` gives owner-read-only. Verify with `kubectl exec <pod> -- ls -l /etc/creds`.',
    },
  ],
  lab: {
    title: 'Create, consume and inspect every Secret type you need',
    scenario:
      'You will create Opaque, TLS and registry Secrets, consume one four different ways, prove base64 offers no protection, and reproduce the wrong-type pull-secret failure.',
    prerequisites: ['A cluster with kubectl and openssl (for a self-signed certificate)'],
    tasks: [
      { instruction: 'Create namespace `sec-lab` and set it as default.' },
      {
        instruction:
          'Create an Opaque Secret `db-credentials` with username and password literals, and read the password back in plain text.',
      },
      {
        instruction:
          'Write the same Secret as a manifest using stringData, apply it, and confirm the stored form is base64 `data`.',
      },
      {
        instruction:
          'Generate a self-signed certificate and create a `kubernetes.io/tls` Secret from it; confirm the type and key names.',
      },
      {
        instruction:
          'Create a pull secret the wrong way (generic) and the right way (docker-registry), and compare the types.',
      },
      {
        instruction:
          'Create a Pod consuming db-credentials as a renamed env var, via envFrom, and as a 0400-mode file; verify all three.',
      },
      { instruction: 'Prove the Secret volume is tmpfs.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - Opaque, both ways',
        language: 'bash',
        code: `kubectl create namespace sec-lab
kubectl config set-context --current --namespace=sec-lab
mkdir -p /tmp/sec-lab && cd /tmp/sec-lab

kubectl create secret generic db-credentials \\
  --from-literal=username=shopuser --from-literal=password='S3cret-P@ss!'

kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 -d; echo
# S3cret-P@ss!        <- base64 is NOT protection

kubectl get secret db-credentials \\
  -o go-template='{{range $k,$v := .data}}{{$k}}={{$v | base64decode}}{{"\\n"}}{{end}}'
# password=S3cret-P@ss!
# username=shopuser

cat > secret-stringdata.yaml <<'YAML'
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials-2
  namespace: sec-lab
type: Opaque
stringData:
  username: shopuser
  password: "S3cret-P@ss!"
YAML

kubectl apply -f secret-stringdata.yaml
kubectl get secret db-credentials-2 -o yaml | grep -A3 "^data:"
# data:
#   password: UzNjcmV0LVBAc3Mh
#   username: c2hvcHVzZXI=
# stringData never appears when read back - it is write-only.`,
      },
      {
        title: 'Step 4 - a TLS Secret',
        language: 'bash',
        code: `openssl req -x509 -nodes -newkey rsa:2048 -days 30 \\
  -keyout tls.key -out tls.crt -subj "/CN=shop.example.com" 2>/dev/null

kubectl create secret tls shop-tls --cert=tls.crt --key=tls.key

kubectl get secret shop-tls -o jsonpath='{.type}{"\\n"}'
# kubernetes.io/tls

kubectl get secret shop-tls -o jsonpath='{range $k,$v := .data}{$k}{" "}{end}{"\\n"}'
# tls.crt tls.key        <- these exact names are required by Ingress`,
      },
      {
        title: 'Step 5 - the pull-secret type trap',
        language: 'bash',
        code: `# The WRONG way - produces Opaque
kubectl create secret generic regcred-wrong \\
  --from-literal=.dockerconfigjson='{"auths":{"registry.example.com":{"username":"ci","password":"x"}}}'

# The RIGHT way
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com \\
  --docker-username=ci \\
  --docker-password=x

kubectl get secrets regcred regcred-wrong \\
  -o custom-columns='NAME:.metadata.name,TYPE:.type'
# NAME            TYPE
# regcred         kubernetes.io/dockerconfigjson
# regcred-wrong   Opaque
#
# imagePullSecrets silently ignores the Opaque one.`,
      },
      {
        title: 'Steps 6-7 - consume and verify',
        language: 'yaml',
        code: `# consumer.yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-consumer
  namespace: sec-lab
spec:
  volumes:
    - name: creds
      secret:
        secretName: db-credentials
        defaultMode: 0400
        items:
          - key: password
            path: db-password
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
      envFrom:
        - secretRef:
            name: db-credentials
      volumeMounts:
        - name: creds
          mountPath: /etc/secrets
          readOnly: true`,
      },
      {
        title: 'Verify all three, then clean up',
        language: 'bash',
        code: `kubectl apply -f consumer.yaml
kubectl wait --for=condition=Ready pod/secret-consumer --timeout=90s

# 1. renamed single key
kubectl exec secret-consumer -- printenv DB_PASSWORD
# S3cret-P@ss!

# 2. bulk import (key names as-is)
kubectl exec secret-consumer -- printenv username password
# shopuser
# S3cret-P@ss!

# 3. file with restricted mode
kubectl exec secret-consumer -- ls -l /etc/secrets
# -r--------    1 root     root  12 Sep  3 13:40 db-password
kubectl exec secret-consumer -- cat /etc/secrets/db-password; echo

# tmpfs-backed, so it never touches the node disk
kubectl exec secret-consumer -- mount | grep /etc/secrets
# tmpfs on /etc/secrets type tmpfs (ro,relatime)

cd - >/dev/null && rm -rf /tmp/sec-lab
kubectl config set-context --current --namespace=default
kubectl delete namespace sec-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec secret-consumer -n sec-lab -- ls -l /etc/secrets',
        what: 'Confirms the projected file exists with the requested 0400 mode.',
        expected: '-r-------- for db-password.',
      },
      {
        command:
          "kubectl get secrets -n sec-lab -o custom-columns='NAME:.metadata.name,TYPE:.type'",
        what: 'Shows all four Secrets and their types side by side.',
        expected: 'Opaque, kubernetes.io/tls and kubernetes.io/dockerconfigjson all present.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace sec-lab',
        what: 'Removes every Secret and Pod.',
        expected: 'namespace "sec-lab" deleted',
      },
    ],
  },
  relatedTopicIds: [
    'configmaps',
    'env-and-config-injection',
    'serviceaccounts',
    'container-images',
  ],
  docs: [
    { title: 'Secrets', url: 'https://kubernetes.io/docs/concepts/configuration/secret/' },
    {
      title: 'Distribute credentials securely using Secrets',
      url: 'https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/',
    },
    {
      title: 'Pull an image from a private registry',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/',
    },
  ],
}
