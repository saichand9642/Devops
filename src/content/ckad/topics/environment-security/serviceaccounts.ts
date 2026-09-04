import type { Topic } from '../../../types'

export const serviceaccounts: Topic = {
  id: 'serviceaccounts',
  title: 'ServiceAccounts',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 6,
  tags: [
    'serviceaccount',
    'token',
    'projected',
    'automountServiceAccountToken',
    'identity',
    'default',
  ],
  oneLiner:
    'The identity a Pod presents to the API server: how the token gets in, why you should not use the default one, and how to turn it off.',
  explanation: [
    'A **ServiceAccount** is the identity a Pod uses when it talks to the Kubernetes API. Human users authenticate with certificates or an OIDC provider; workloads authenticate with a ServiceAccount token.',
    'Every namespace has a ServiceAccount called `default`, and a Pod that does not name one gets it. By default a token is mounted into every container at `/var/run/secrets/kubernetes.io/serviceaccount/`, alongside the cluster CA certificate and the namespace name.',
    'Modern clusters use **projected, short-lived tokens**: the kubelet requests a bound token from the API server, mounts it, and refreshes it before expiry (roughly hourly). It is audience-scoped and tied to the Pod, so it becomes useless when the Pod goes away. This replaced the old model where each ServiceAccount had a permanent token stored in a Secret.',
    'A ServiceAccount on its own grants nothing beyond the permissions given to any authenticated identity. Permissions come from RBAC - a Role or ClusterRole bound to the ServiceAccount. The pair is the point: the account is *who*, RBAC is *what*.',
    'Two habits matter. Give each workload its own ServiceAccount rather than sharing `default`, so permissions can be scoped per workload. And set `automountServiceAccountToken: false` for Pods that never call the API, so no credential is present to steal.',
  ],
  whyItMatters: [
    '"Understand ServiceAccounts" is a named curriculum competency, and tasks typically pair it with RBAC: create a ServiceAccount, bind a Role, use it in a Pod.',
    'The mounted token path is worth memorising because it is how you test permissions from inside a Pod - and how an attacker would use them.',
    '`automountServiceAccountToken: false` is the single cheapest security improvement available in a Pod spec, and it shows up in hardening-flavoured tasks.',
  ],
  howItWorks: [
    'A Pod names its identity in `spec.serviceAccountName`. If omitted, the admission controller sets it to `default`. The field is immutable once the Pod exists.',
    "Three files are projected into `/var/run/secrets/kubernetes.io/serviceaccount/`: `token` (the JWT), `ca.crt` (the cluster CA, so the Pod can verify the API server) and `namespace` (the Pod's namespace as plain text).",
    'Automount precedence: `spec.automountServiceAccountToken` on the Pod overrides `automountServiceAccountToken` on the ServiceAccount, which overrides the default of true. Setting it false on the ServiceAccount is the way to make a whole workload class token-free.',
    'The projected token is a JWT with an `aud` (audience, by default the API server), an `exp` (expiry), and claims identifying the Pod and ServiceAccount. `kubectl create token <sa>` produces one on demand for testing, with `--duration` controlling its lifetime.',
    'A long-lived token Secret can still be created by hand (type `kubernetes.io/service-account-token` with a `kubernetes.io/service-account.name` annotation), and occasionally must be for an external system. It never expires, which is exactly why the projected form is preferred.',
    '`imagePullSecrets` can be attached to a ServiceAccount rather than to every Pod, in which case every Pod using that account inherits them.',
    'The identity string RBAC matches is `system:serviceaccount:<namespace>:<name>`, and all ServiceAccounts in a namespace belong to the group `system:serviceaccounts:<namespace>`.',
  ],
  diagrams: [
    {
      kind: 'sequence',
      title: 'How a Pod gets an identity',
      caption:
        'Every Pod has a ServiceAccount whether you set one or not. If you did not choose, it is "default", which normally can do nothing.',
      participants: [
        { id: 'pod', label: 'Pod' },
        { id: 'kl', label: 'kubelet' },
        { id: 'api', label: 'API server' },
      ],
      messages: [
        { from: 'pod', to: 'kl', label: 'spec.serviceAccountName: deployer' },
        { from: 'kl', to: 'api', label: 'request a projected token' },
        { from: 'api', to: 'kl', label: 'short-lived, audience-bound token', kind: 'return' },
        { from: 'kl', to: 'pod', label: 'mount it at /var/run/secrets/...', kind: 'return' },
        { from: 'pod', to: 'api', label: 'API call with that bearer token' },
        { from: 'api', to: 'api', label: 'authenticate, then check RBAC' },
        { from: 'api', to: 'pod', label: 'allowed, or 403', kind: 'return' },
      ],
    },
    {
      kind: 'flow',
      title: 'Giving a Pod permission, end to end',
      caption:
        'Four objects. Miss any one and the Pod gets a 403 that looks like a bug in your code.',
      nodes: [
        {
          label: 'Create the ServiceAccount',
          detail: 'kubectl create sa deployer',
          tone: 'accent',
        },
        {
          label: 'Create the Role',
          detail: 'kubectl create role r --verb=get,list --resource=pods',
        },
        {
          label: 'Bind them',
          detail: 'kubectl create rolebinding b --role=r --serviceaccount=ns:deployer',
          arrowLabel: 'the step people skip',
        },
        {
          label: 'Point the Pod at it',
          detail: 'spec.serviceAccountName: deployer',
          arrowLabel: 'not an annotation',
          branch: {
            label: 'Field omitted',
            detail: 'The Pod silently uses "default" and gets 403s',
          },
        },
        {
          label: 'Confirm from the Pod',
          detail: 'kubectl auth can-i --as=system:serviceaccount:ns:deployer list pods',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'ServiceAccount',
      apiVersion: 'v1',
      purpose: 'A namespaced workload identity that RBAC can grant permissions to.',
      fields: [
        {
          path: 'metadata.name',
          meaning: 'Referenced by spec.serviceAccountName and by RBAC subjects.',
          required: true,
        },
        {
          path: 'automountServiceAccountToken',
          meaning: 'false stops token projection for every Pod using this account.',
        },
        {
          path: 'imagePullSecrets[]',
          meaning: 'Registry credentials inherited by every Pod using this account.',
        },
        {
          path: 'secrets[]',
          meaning: 'Legacy list of associated token Secrets; empty on modern clusters.',
        },
      ],
    },
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Selects an identity and controls token projection.',
      fields: [
        {
          path: 'spec.serviceAccountName',
          meaning: 'Which ServiceAccount to use. Defaults to "default". Immutable.',
        },
        {
          path: 'spec.automountServiceAccountToken',
          meaning: 'false suppresses the token mount for this Pod; overrides the SA setting.',
        },
        {
          path: 'spec.volumes[].projected.sources[].serviceAccountToken',
          meaning: 'Explicitly request a token with a chosen audience, path and expiry.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A compromised sidecar with a cluster-admin token',
    story: [
      'A team ran everything with the `default` ServiceAccount. Convenient, until someone bound `cluster-admin` to `default` in a namespace "temporarily" to unblock a deployment, and never removed it.',
      'Months later a vulnerability in an image-processing sidecar allowed arbitrary file reads. The attacker read `/var/run/secrets/kubernetes.io/serviceaccount/token` and had cluster-admin against the API server - from a container whose job was resizing images and which never needed API access at all.',
      'Two changes prevented a repeat. Every workload got its own ServiceAccount with a narrowly scoped Role, so a token is worth almost nothing. And every Pod that does not call the API got `automountServiceAccountToken: false`, so there is no token in the filesystem to read.',
      'The image processor now has no token, no ServiceAccount permissions, and nothing to steal. The audit was mechanical: `kubectl get pods -A -o custom-columns=...serviceAccountName` showed every workload still on `default`.',
      'The general principle: a token that does not exist cannot be exfiltrated, and a token with no permissions is not worth exfiltrating.',
    ],
    code: [
      {
        title: 'The audit, and the two fixes',
        language: 'bash',
        code: `# Which workloads are still using the default account?
kubectl get pods -A \\
  -o custom-columns='NS:.metadata.namespace,POD:.metadata.name,SA:.spec.serviceAccountName' \\
  | grep default

# Does anything dangerous bind to it?
kubectl get rolebindings,clusterrolebindings -A -o json \\
  | grep -B5 '"name": "default"' | grep -E 'roleRef|name' | head

# Fix 1: no token at all for Pods that do not need one
kubectl patch deploy image-processor -n shop \\
  -p '{"spec":{"template":{"spec":{"automountServiceAccountToken":false}}}}'

# Fix 2: a dedicated identity for those that do
kubectl create serviceaccount api-sa -n shop
kubectl set serviceaccount deploy/api api-sa -n shop`,
        explanation:
          'The custom-columns audit is worth running on any cluster you inherit - it is usually revealing.',
        placeholders: ['shop', 'image-processor', 'api-sa', 'api'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A dedicated ServiceAccount and a Pod that uses it',
      language: 'yaml',
      code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-sa
  namespace: shop
# Pods using this account get registry credentials automatically
imagePullSecrets:
  - name: regcred
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      serviceAccountName: api-sa # the identity for API calls
      containers:
        - name: api
          image: registry.example.com/shop/api:1.4.2
          # The token is available at:
          #   /var/run/secrets/kubernetes.io/serviceaccount/token
          #   /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          #   /var/run/secrets/kubernetes.io/serviceaccount/namespace`,
      explanation:
        'Note that `api-sa` has no permissions yet. Without a RoleBinding it can authenticate to the API server and do essentially nothing - which is the correct starting point.',
      placeholders: ['api-sa', 'shop', 'regcred', 'registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'Turning the token off, two ways',
      language: 'yaml',
      code: `# Per ServiceAccount: no Pod using this account gets a token
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-access
  namespace: shop
automountServiceAccountToken: false
---
# Per Pod: overrides whatever the ServiceAccount says
apiVersion: v1
kind: Pod
metadata:
  name: image-processor
  namespace: shop
spec:
  serviceAccountName: default
  automountServiceAccountToken: false # nothing under /var/run/secrets/kubernetes.io
  containers:
    - name: worker
      image: registry.example.com/shop/resize:1.2.0`,
      explanation:
        'Pod-level setting wins. Use the ServiceAccount-level setting for a whole class of workloads, and the Pod-level one for exceptions.',
      placeholders: ['shop', 'registry.example.com/shop/resize:1.2.0'],
    },
    {
      title: 'A projected token with an explicit audience and expiry',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: external-caller
  namespace: shop
spec:
  serviceAccountName: api-sa
  automountServiceAccountToken: false # suppress the default mount...
  volumes:
    - name: sa-token
      projected:
        defaultMode: 0400
        sources:
          # ...and request a token scoped to an external audience instead.
          - serviceAccountToken:
              path: token
              audience: vault.shop.example.com
              expirationSeconds: 3600
          - configMap:
              name: kube-root-ca.crt
              items:
                - key: ca.crt
                  path: ca.crt
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      volumeMounts:
        - name: sa-token
          mountPath: /var/run/secrets/vault
          readOnly: true`,
      explanation:
        'An audience-scoped token is only accepted by the service named in `audience`, so it is useless against the Kubernetes API. This is how workload identity federation with Vault or a cloud provider is wired up.',
      placeholders: ['external-caller', 'shop', 'api-sa', 'vault.shop.example.com'],
    },
  ],
  imperative: [
    {
      command: 'kubectl create serviceaccount api-sa -n shop',
      what: 'Creates a ServiceAccount.',
      expected: 'serviceaccount/api-sa created',
      placeholders: ['api-sa', 'shop'],
    },
    {
      command: 'kubectl get serviceaccounts -n shop',
      what: 'Lists ServiceAccounts. Every namespace has at least `default`.',
      expected: 'default plus any you created.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl set serviceaccount deployment/api api-sa -n shop',
      what: 'Changes the ServiceAccount on an existing Deployment and triggers a rollout.',
      expected: 'deployment.apps/api serviceaccount updated',
      placeholders: ['api', 'api-sa', 'shop'],
    },
    {
      command:
        'kubectl run probe --image=busybox:1.36 --overrides=\'{"spec":{"serviceAccountName":"api-sa"}}\' -n shop --command -- sleep 3600',
      what: 'Creates a Pod with a specific ServiceAccount imperatively - `kubectl run` has no flag for it, so use --overrides.',
      expected: 'pod/probe created',
      placeholders: ['probe', 'api-sa', 'shop'],
    },
    {
      command: 'kubectl create token api-sa -n shop --duration=10m',
      what: 'Mints a short-lived token for testing, without creating a Secret.',
      expected: 'A JWT on stdout.',
      placeholders: ['api-sa', 'shop'],
    },
    {
      command: 'kubectl get pod probe -n shop -o jsonpath=\'{.spec.serviceAccountName}{"\\n"}\'',
      what: 'Confirms which identity a Pod is actually using.',
      expected: 'api-sa',
      placeholders: ['probe', 'shop'],
    },
    {
      command: 'kubectl exec probe -n shop -- ls /var/run/secrets/kubernetes.io/serviceaccount/',
      what: 'Shows the projected token files - or errors if automounting is disabled.',
      expected: 'ca.crt, namespace, token.',
      placeholders: ['probe', 'shop'],
    },
    {
      command:
        'kubectl exec probe -n shop -- cat /var/run/secrets/kubernetes.io/serviceaccount/namespace',
      what: 'A container can learn its own namespace from this file without an API call.',
      expected: 'shop',
      placeholders: ['probe', 'shop'],
    },
    {
      command: 'kubectl auth can-i list pods --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'Tests what a ServiceAccount is permitted to do, without running a Pod.',
      expected: 'yes or no.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command:
        "kubectl get pods -A -o custom-columns='NS:.metadata.namespace,POD:.metadata.name,SA:.spec.serviceAccountName,AUTOMOUNT:.spec.automountServiceAccountToken'",
      what: 'The cluster-wide identity audit.',
      expected: 'A table; `default` with an empty AUTOMOUNT column is the pattern to fix.',
    },
    {
      command:
        'kubectl patch serviceaccount default -n shop -p \'{"automountServiceAccountToken":false}\'',
      what: 'Stops the default account from handing out tokens - a good namespace-wide default.',
      expected: 'serviceaccount/default patched',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      "Create one ServiceAccount per workload, named after it, in the workload's namespace.",
      'Reference it with `spec.serviceAccountName` in the Pod template - never rely on `default`.',
      'Set `automountServiceAccountToken: false` for every Pod that does not call the Kubernetes API.',
      'Grant permissions with a Role and RoleBinding scoped to exactly what the workload needs.',
      'Attach `imagePullSecrets` to the ServiceAccount when many Pods share a registry.',
      'Verify with `kubectl auth can-i --as=system:serviceaccount:<ns>:<sa>` before deploying.',
    ],
    code: [
      {
        title: 'Identity plus permission, together',
        language: 'bash',
        code: `NS=shop

# 1. Identity
kubectl create serviceaccount api-sa -n $NS

# 2. Permission - only what the workload needs
kubectl create role pod-reader -n $NS \\
  --verb=get,list,watch --resource=pods

kubectl create rolebinding api-sa-pod-reader -n $NS \\
  --role=pod-reader --serviceaccount=$NS:api-sa

# 3. Verify before deploying
kubectl auth can-i list pods --as=system:serviceaccount:$NS:api-sa -n $NS
# yes
kubectl auth can-i delete pods --as=system:serviceaccount:$NS:api-sa -n $NS
# no

# 4. Use it
kubectl set serviceaccount deploy/api api-sa -n $NS`,
        placeholders: ['shop', 'api-sa', 'api'],
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl get deploy api -n shop -o jsonpath=\'{.spec.template.spec.serviceAccountName}{"\\n"}\'',
      what: 'Confirms the Pod template uses the intended identity.',
      expected: 'api-sa',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl exec probe -n shop -- ls /var/run/secrets/kubernetes.io/serviceaccount/',
      what: 'Confirms the token is mounted - or, for a hardened Pod, that the directory does not exist.',
      expected: 'Three files, or "No such file or directory" when automounting is off.',
      placeholders: ['probe', 'shop'],
    },
    {
      command: 'kubectl auth can-i --list --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'The full permission set of an identity - the definitive answer to "what can this Pod do?".',
      expected: 'A table of resources and verbs.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command:
        'kubectl exec probe -n shop -- sh -c \'wget -qO- --no-check-certificate --header="Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default.svc/api/v1/namespaces/shop/pods | head -c 120\'',
      what: 'An end-to-end test: uses the projected token to call the API from inside the Pod.',
      expected: 'A PodList JSON fragment, or a 403 Forbidden if RBAC does not allow it.',
      placeholders: ['probe', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl exec probe -n shop -- ls /var/run/secrets/kubernetes.io/serviceaccount/',
      what: 'If the directory is missing, automounting is disabled somewhere - check the Pod then the ServiceAccount.',
      expected: 'The three files, or a not-found error.',
      placeholders: ['probe', 'shop'],
    },
    {
      command:
        'kubectl get pod probe -n shop -o jsonpath=\'{.spec.automountServiceAccountToken}{" "}{.spec.serviceAccountName}{"\\n"}\'',
      what: 'Shows the Pod-level override and the account in use.',
      expected: 'Empty (meaning default true) or false, plus the account name.',
      placeholders: ['probe', 'shop'],
    },
    {
      command: 'kubectl describe pod probe -n shop | grep -i "service account"',
      what: 'A Pod referencing a non-existent ServiceAccount fails at admission with a clear message.',
      expected:
        'error looking up service account shop/missing-sa: serviceaccount "missing-sa" not found.',
      placeholders: ['probe', 'shop'],
    },
    {
      command: 'kubectl auth can-i list pods --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'A 403 from inside a Pod is an RBAC problem, not a token problem. This confirms which.',
      expected: 'no - meaning you need a Role and RoleBinding.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command: 'kubectl get serviceaccount api-sa -n shop -o yaml',
      what: 'Shows automount settings and imagePullSecrets. On modern clusters `secrets` is empty, which is normal.',
      expected: 'The object with no long-lived token Secret listed.',
      placeholders: ['api-sa', 'shop'],
    },
  ],
  commonMistakes: [
    'Using the `default` ServiceAccount for everything, so any permission granted to it is granted to every workload in the namespace.',
    'Believing a ServiceAccount grants permissions. It grants identity; RBAC grants permissions.',
    'Leaving token automounting on for Pods that never call the API - an unnecessary credential in the filesystem.',
    'Trying to change `spec.serviceAccountName` on a running Pod. It is immutable; change the template and let the controller recreate.',
    'Expecting a long-lived token Secret to be created automatically. Modern clusters use projected short-lived tokens.',
    'Referencing a ServiceAccount that does not exist, which blocks the Pod at admission.',
    'Getting the RBAC subject wrong: it must be `kind: ServiceAccount` with `name` and `namespace`, and the identity string is `system:serviceaccount:<ns>:<name>`.',
    'Binding a ClusterRole like `cluster-admin` to a ServiceAccount "temporarily" and leaving it.',
  ],
  examTips: [
    '`kubectl create serviceaccount <name> -n <ns>` then `kubectl set serviceaccount deployment/<name> <sa>` is the two-command answer to most tasks.',
    '`kubectl run` has no `--serviceaccount` flag any more - use `--overrides=\'{"spec":{"serviceAccountName":"x"}}\'` or generate YAML.',
    'The token path `/var/run/secrets/kubernetes.io/serviceaccount/token` is worth memorising; tasks ask you to read or suppress it.',
    '"The Pod should not have API credentials" → `automountServiceAccountToken: false`.',
    '`kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa>` verifies a task without deploying anything.',
    'ServiceAccount tasks almost always continue into RBAC - expect to create a Role and RoleBinding as well.',
  ],
  summary: [
    'A ServiceAccount is a namespaced workload identity; `default` is used when none is named.',
    'Tokens are projected, short-lived and audience-scoped at `/var/run/secrets/kubernetes.io/serviceaccount/`.',
    'Identity alone grants nothing - RBAC grants the permissions.',
    '`automountServiceAccountToken: false` (Pod level wins over ServiceAccount level) removes the credential entirely.',
    'The RBAC subject string is `system:serviceaccount:<namespace>:<name>`.',
  ],
  practice: [
    {
      id: 'sa-p1',
      level: 'beginner',
      prompt:
        'Where is a ServiceAccount token mounted in a Pod, and what two other files sit alongside it?',
      answer:
        "`/var/run/secrets/kubernetes.io/serviceaccount/token`, alongside `ca.crt` (the cluster CA, for verifying the API server) and `namespace` (the Pod's namespace as plain text).",
      explanation:
        'Client libraries use all three automatically when running in-cluster. `cat .../namespace` is also a handy way for a container to learn its own namespace without the downward API.',
    },
    {
      id: 'sa-p2',
      level: 'intermediate',
      prompt:
        'Write the commands that create a ServiceAccount `api-sa` in namespace `shop` and make the existing Deployment `api` use it.',
      answer:
        'kubectl create serviceaccount api-sa -n shop\nkubectl set serviceaccount deployment/api api-sa -n shop',
      explanation:
        "`kubectl set serviceaccount` changes the Pod template, so it triggers a rolling update. Verify with `kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.serviceAccountName}'`.",
    },
    {
      id: 'sa-p3',
      level: 'advanced',
      prompt:
        'A Pod using ServiceAccount `api-sa` gets `403 Forbidden` when listing Pods. The token is mounted and valid. Diagnose and fix.',
      answer:
        'Authentication succeeded (the token is valid) but authorisation failed - `api-sa` has no RBAC permission to list Pods.\n\nConfirm: `kubectl auth can-i list pods --as=system:serviceaccount:shop:api-sa -n shop` → no\n\nFix:\nkubectl create role pod-reader -n shop --verb=get,list,watch --resource=pods\nkubectl create rolebinding api-sa-pod-reader -n shop --role=pod-reader --serviceaccount=shop:api-sa\n\nThen re-check `can-i` → yes.',
      explanation:
        '401 versus 403 is the distinction to hold onto: 401 means the token is missing or invalid (authentication), 403 means the identity is known but not permitted (authorisation). Only 403 is an RBAC problem.',
    },
  ],
  lab: {
    title: 'Give a Pod an identity, then take its token away',
    scenario:
      "You will inspect the default account's token, create a dedicated ServiceAccount, call the API from inside a Pod with and without RBAC permissions, and prove that disabling automounting removes the credential entirely.",
    prerequisites: ['A cluster where you can create ServiceAccounts and RBAC objects'],
    tasks: [
      { instruction: 'Create namespace `sa-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod with no serviceAccountName and confirm it uses `default` and has a mounted token.',
      },
      { instruction: 'Use that token to call the API from inside the Pod and observe the 403.' },
      {
        instruction:
          'Create ServiceAccount `api-sa`, a Role allowing get/list/watch on pods, and a RoleBinding.',
      },
      { instruction: 'Create a Pod using `api-sa` and confirm the same API call now succeeds.' },
      {
        instruction:
          'Verify the permissions with `kubectl auth can-i --as=...` for both allowed and forbidden verbs.',
      },
      {
        instruction:
          'Create a Pod with `automountServiceAccountToken: false` and prove the secrets directory does not exist.',
      },
      { instruction: 'Mint a standalone token with `kubectl create token` and note its expiry.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - the default account and a 403',
        language: 'bash',
        code: `kubectl create namespace sa-lab
kubectl config set-context --current --namespace=sa-lab

kubectl run probe-default --image=curlimages/curl:8.10.1 --command -- sleep 3600
kubectl wait --for=condition=Ready pod/probe-default --timeout=90s

kubectl get pod probe-default -o jsonpath='{.spec.serviceAccountName}{"\\n"}'
# default

kubectl exec probe-default -- ls /var/run/secrets/kubernetes.io/serviceaccount/
# ca.crt
# namespace
# token

kubectl exec probe-default -- sh -c '
  T=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  curl -s -o /dev/null -w "%{http_code}\\n" \\
    --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \\
    -H "Authorization: Bearer $T" \\
    https://kubernetes.default.svc/api/v1/namespaces/sa-lab/pods'
# 403       <- authenticated (the token works) but not authorised`,
      },
      {
        title: 'Steps 4-6 - identity plus RBAC',
        language: 'bash',
        code: `kubectl create serviceaccount api-sa
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding api-sa-pod-reader \\
  --role=pod-reader --serviceaccount=sa-lab:api-sa

kubectl auth can-i list pods --as=system:serviceaccount:sa-lab:api-sa
# yes
kubectl auth can-i delete pods --as=system:serviceaccount:sa-lab:api-sa
# no
kubectl auth can-i --list --as=system:serviceaccount:sa-lab:api-sa | head -5

kubectl run probe-sa --image=curlimages/curl:8.10.1 \\
  --overrides='{"spec":{"serviceAccountName":"api-sa"}}' --command -- sleep 3600
kubectl wait --for=condition=Ready pod/probe-sa --timeout=90s

kubectl exec probe-sa -- sh -c '
  T=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  curl -s -w "\\nHTTP %{http_code}\\n" \\
    --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \\
    -H "Authorization: Bearer $T" \\
    https://kubernetes.default.svc/api/v1/namespaces/sa-lab/pods | tail -3'
# HTTP 200      <- same code path, different identity`,
      },
      {
        title: 'Step 7 - no token at all',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: probe-notoken
  namespace: sa-lab
spec:
  serviceAccountName: api-sa
  automountServiceAccountToken: false
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"]
YAML

kubectl wait --for=condition=Ready pod/probe-notoken --timeout=90s

kubectl exec probe-notoken -- ls /var/run/secrets/kubernetes.io/serviceaccount/ || true
# ls: /var/run/secrets/kubernetes.io/serviceaccount/: No such file or directory

kubectl get pod probe-notoken -o jsonpath='{.spec.volumes[*].name}{"\\n"}'
# (empty - no kube-api-access volume was projected)

# Compare with the Pod that does have one:
kubectl get pod probe-sa -o jsonpath='{.spec.volumes[*].name}{"\\n"}'
# kube-api-access-xxxxx`,
      },
      {
        title: 'Steps 8-9 - a standalone token, then cleanup',
        language: 'bash',
        code: `TOKEN=$(kubectl create token api-sa --duration=10m)
echo "$TOKEN" | cut -c1-40
# eyJhbGciOiJSUzI1NiIsImtpZCI6...

# Decode the payload to see the audience and expiry (base64url of the middle part)
echo "$TOKEN" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | head -c 300; echo
# {"aud":["https://kubernetes.default.svc..."],"exp":...,
#  "kubernetes.io":{"namespace":"sa-lab","serviceaccount":{"name":"api-sa",...}}}

kubectl config set-context --current --namespace=default
kubectl delete namespace sa-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl auth can-i --list --as=system:serviceaccount:sa-lab:api-sa -n sa-lab',
        what: 'The full permission set granted by the RoleBinding.',
        expected: 'pods with get, list and watch.',
      },
      {
        command: 'kubectl exec probe-notoken -n sa-lab -- ls /var/run/secrets/kubernetes.io/',
        what: 'Confirms no credential is present when automounting is disabled.',
        expected: 'No such file or directory.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace sa-lab',
        what: 'Removes the Pods, ServiceAccount, Role and RoleBinding.',
        expected: 'namespace "sa-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['rbac', 'authn-authz-admission', 'secrets'],
  docs: [
    {
      title: 'Configure ServiceAccounts for Pods',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/',
    },
    {
      title: 'ServiceAccounts',
      url: 'https://kubernetes.io/docs/concepts/security/service-accounts/',
    },
  ],
}
