import type { Topic } from '../../../types'

export const authnAuthzAdmission: Topic = {
  id: 'authn-authz-admission',
  title: 'Authentication, authorization and admission control',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 9,
  tags: [
    'authentication',
    'authorization',
    '401',
    '403',
    'admission',
    'webhook',
    'mutating',
    'validating',
  ],
  oneLiner:
    'The three gates every API request passes through, and how to tell from the error which gate stopped you.',
  explanation: [
    'Every request to the API server passes through three stages in order: **authentication** (who are you?), **authorization** (may you do this?), and **admission control** (should this specific object be allowed, and does it need changing first?). Only then is the object validated and written to etcd.',
    '**Authentication** produces an identity or fails with **401 Unauthorized**. Kubernetes has no user objects - identity comes from client certificates, bearer tokens (including ServiceAccount tokens), OIDC, or an authenticating proxy. Failure means the credential was missing, malformed or expired.',
    '**Authorization** answers whether that identity may perform this verb on this resource, and failure is **403 Forbidden**. RBAC is the authoriser you will meet; others exist (Node, ABAC, Webhook) and are usually chained, with any one "allow" being sufficient.',
    '**Admission control** runs a chain of plugins after authorization. **Mutating** admission runs first and can *change* the object - injecting LimitRange defaults, adding a ServiceAccount token volume, setting the default namespace. **Validating** admission runs second and can only accept or reject - ResourceQuota, Pod Security Admission, and any ValidatingAdmissionWebhook or ValidatingAdmissionPolicy.',
    'The practical value is diagnostic. 401 means fix the credential. 403 means fix RBAC. A `Forbidden` message naming a quota or a PodSecurity standard means admission control, which is a different fix again.',
  ],
  whyItMatters: [
    '"Understand authentication, authorization and admission control" is a named curriculum competency, examined mostly through error interpretation.',
    'Knowing that mutating admission changes your object explains why a Pod you submitted is not the Pod you get back - injected defaults, tokens and sidecars all arrive here.',
    'Distinguishing 401 from 403 saves you from debugging RBAC when the real problem is an expired token, and vice versa.',
  ],
  howItWorks: [
    'Order: TLS handshake → authentication → authorization → mutating admission → schema validation → validating admission → persist to etcd. A failure at any stage stops the request, and nothing is written.',
    'Authentication modules are tried in order until one succeeds. A ServiceAccount token is validated by the API server (signature, expiry, audience) and yields the identity `system:serviceaccount:<ns>:<name>` plus the groups `system:serviceaccounts` and `system:serviceaccounts:<ns>`.',
    'Authorizers are also chained. Any explicit "allow" permits the request; if all abstain or deny, the request is denied. This is why RBAC has no deny rules - denial is the default.',
    "Notable built-in admission plugins: `NamespaceLifecycle` (rejects objects in a Terminating namespace), `LimitRanger` (mutating - injects resource defaults), `ServiceAccount` (mutating - sets the default SA and projects its token), `ResourceQuota` (validating), `PodSecurity` (validating), `DefaultStorageClass` (mutating - fills in a PVC's storage class), `MutatingAdmissionWebhook` and `ValidatingAdmissionWebhook`.",
    'Webhooks are how third-party controllers hook in: a service mesh injecting a sidecar, a policy engine rejecting non-compliant objects, a certificate manager mutating an Ingress. A `failurePolicy: Fail` webhook that is down blocks every matching request, which is a memorable outage.',
    'ValidatingAdmissionPolicy is the newer, in-tree alternative to a validating webhook: rules written in CEL and evaluated by the API server, with no external service to keep running.',
    '`kubectl auth can-i` tests only the authorization stage. A request can pass `can-i` and still be rejected by admission - which is exactly what a quota rejection is.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Every request crosses four gates',
      caption:
        'The gate that rejected you determines the fix. 401 is credentials, 403 is RBAC, and an admission denial names the webhook or policy.',
      nodes: [
        {
          label: 'Request reaches kube-apiserver',
          detail: 'kubectl, a controller, or a Pod using its ServiceAccount',
        },
        {
          label: '1. Authentication - who are you?',
          detail: 'Certificate, bearer token, or ServiceAccount token',
          tone: 'accent',
          branch: {
            label: '401 Unauthorized',
            detail: 'Bad or missing credentials. RBAC never even runs.',
          },
        },
        {
          label: '2. Authorization - may you?',
          detail: 'RBAC checks verb + resource + namespace',
          arrowLabel: 'identity established',
          branch: {
            label: '403 Forbidden',
            detail: 'Message names the user, verb and resource. Fix the Role.',
          },
        },
        {
          label: '3. Admission - mutating',
          detail: 'Defaults injected: ServiceAccount, LimitRange defaults',
          arrowLabel: 'permitted',
        },
        {
          label: '4. Admission - validating',
          detail: 'ResourceQuota, Pod Security, webhooks',
          branch: {
            label: 'Denied by admission',
            detail: 'Error quotes the plugin, e.g. exceeded quota',
          },
        },
        {
          label: 'Validated and written to etcd',
          detail: 'Only now does kubectl print "created"',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Reading the error you got',
      caption: 'Do not guess. The verb in the message tells you exactly which rule to add.',
      question: 'What did the API server return?',
      branches: [
        {
          condition: 'Unauthorized',
          result: 'Authentication failed',
          detail: 'Wrong kubeconfig, expired token, wrong context',
        },
        {
          condition: 'forbidden: User cannot list pods',
          result: 'RBAC is missing a rule',
          detail: 'Confirm with kubectl auth can-i list pods',
          tone: 'accent',
        },
        {
          condition: 'exceeded quota',
          result: 'A ResourceQuota denied it',
          detail: 'Add requests and limits, or ask for less',
        },
        {
          condition: 'violates PodSecurity restricted',
          result: 'Namespace policy denied it',
          detail: 'Add the securityContext the policy requires',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'SelfSubjectAccessReview',
      apiVersion: 'authorization.k8s.io/v1',
      purpose: 'What `kubectl auth can-i` creates. Tests the authorization stage only.',
      fields: [
        {
          path: 'spec.resourceAttributes',
          meaning: 'namespace, verb, group, resource, subresource, name.',
        },
        { path: 'status.allowed', meaning: 'true or false, with an optional reason.' },
      ],
    },
    {
      kind: 'ValidatingWebhookConfiguration',
      apiVersion: 'admissionregistration.k8s.io/v1',
      purpose: 'Registers an external validating admission webhook.',
      fields: [
        {
          path: 'webhooks[].rules[]',
          meaning: 'Which operations, apiGroups, versions and resources it applies to.',
        },
        {
          path: 'webhooks[].failurePolicy',
          meaning: 'Fail (block on error) or Ignore (allow on error).',
        },
        {
          path: 'webhooks[].namespaceSelector',
          meaning: 'Limits the webhook to matching namespaces.',
        },
        {
          path: 'webhooks[].timeoutSeconds',
          meaning: 'How long the API server waits before applying failurePolicy.',
        },
      ],
    },
    {
      kind: 'MutatingWebhookConfiguration',
      apiVersion: 'admissionregistration.k8s.io/v1',
      purpose: 'Registers a webhook that can modify objects before persistence.',
      fields: [
        {
          path: 'webhooks[].reinvocationPolicy',
          meaning: 'Never or IfNeeded - whether to call again after other mutations.',
        },
        {
          path: 'webhooks[].sideEffects',
          meaning: 'Declares whether the webhook has out-of-band effects; required field.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Three errors, three completely different fixes',
    story: [
      'A CI pipeline that deploys to Kubernetes fails three times in one week, each time with a different error, and each time somebody suggests "check the RBAC".',
      'Monday: `error: You must be logged in to the server (Unauthorized)`. That is a **401** - authentication. The service account token used by CI had been rotated and the pipeline still had the old one. RBAC was irrelevant.',
      'Wednesday: `Error from server (Forbidden): deployments.apps is forbidden: User "ci" cannot create resource "deployments" in API group "apps" in the namespace "staging"`. That is a **403** - authorization. The RoleBinding existed in `production` but not in `staging`. This one really was RBAC.',
      'Friday: `Error from server (Forbidden): pods "api-xyz" is forbidden: exceeded quota: compute-quota, requested: requests.cpu=2, used: requests.cpu=3, limited: requests.cpu=4`. Also a 403 status, but the message names a quota - this is **admission control**. `kubectl auth can-i create pods` returned `yes`, because authorization had passed and admission rejected it afterwards.',
      'The team put the three signatures on a card: 401 → credential; 403 with "cannot <verb> resource" → RBAC; 403 naming a quota, a PodSecurity standard, or a webhook → admission. Debugging time dropped from hours to minutes.',
    ],
    code: [
      {
        title: 'Reading the three signatures',
        language: 'bash',
        code: `# 401 - authentication failed, no identity established
kubectl get pods
# error: You must be logged in to the server (Unauthorized)
#   -> fix the credential: token expired, wrong kubeconfig, bad cert

# 403 from RBAC - identity known, permission missing
kubectl create deployment web --image=nginx -n staging
# Error from server (Forbidden): deployments.apps is forbidden:
#   User "ci" cannot create resource "deployments" in API group "apps"
#   in the namespace "staging"
#   -> fix RBAC. Confirm with: kubectl auth can-i create deployments.apps -n staging

# 403 from ADMISSION - permission granted, object rejected
kubectl apply -f pod.yaml
# Error from server (Forbidden): pods "api" is forbidden:
#   exceeded quota: compute-quota, requested: requests.cpu=2, ...
kubectl auth can-i create pods -n shop
# yes      <- authorization passed; admission is the gate that refused`,
        explanation:
          'The `kubectl auth can-i` result is the discriminator: `yes` plus a Forbidden error means admission control, not RBAC.',
        placeholders: ['staging', 'shop', 'pod.yaml'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'What mutating admission does to your Pod',
      language: 'yaml',
      code: `# WHAT YOU SUBMIT
apiVersion: v1
kind: Pod
metadata:
  name: plain
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
---
# WHAT IS STORED, after mutating admission plugins have run
apiVersion: v1
kind: Pod
metadata:
  name: plain
  namespace: shop # NamespaceDefault
  annotations:
    kubernetes.io/limit-ranger: "LimitRanger plugin set: cpu, memory request..."
spec:
  serviceAccountName: default # ServiceAccount plugin
  automountServiceAccountToken: true
  volumes:
    - name: kube-api-access-x7k2m # ServiceAccount plugin projected the token
      projected:
        sources:
          - serviceAccountToken:
              expirationSeconds: 3607
              path: token
          - configMap:
              name: kube-root-ca.crt
              items: [{key: ca.crt, path: ca.crt}]
          - downwardAPI:
              items: [{path: namespace, fieldRef: {fieldPath: metadata.namespace}}]
  containers:
    - name: app
      image: nginx:1.27-alpine
      resources: # LimitRanger injected these
        requests: {cpu: 100m, memory: 128Mi}
        limits: {cpu: 500m, memory: 512Mi}
      terminationMessagePath: /dev/termination-log # defaulting
      imagePullPolicy: IfNotPresent # defaulting (tag is not :latest)
  restartPolicy: Always # defaulting
  terminationGracePeriodSeconds: 30 # defaulting
  dnsPolicy: ClusterFirst # defaulting`,
      explanation:
        'Nothing here was in your manifest. This is why `kubectl get pod -o yaml` looks so different from what you applied, and why comparing the two is a useful way to see what the cluster is doing on your behalf.',
      placeholders: ['shop'],
    },
    {
      title: 'A validating webhook registration (read-only understanding)',
      language: 'yaml',
      code: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: require-resource-limits
webhooks:
  - name: limits.policy.shop.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None # required field
    # Fail = block the request if the webhook is unreachable.
    # This is safe for policy but means a webhook outage blocks deployments.
    failurePolicy: Fail
    timeoutSeconds: 5
    rules:
      - operations: ["CREATE", "UPDATE"]
        apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
        scope: Namespaced
    namespaceSelector:
      matchLabels:
        policy-enforced: "true"
    clientConfig:
      service:
        name: policy-webhook
        namespace: policy-system
        path: /validate-pods
        port: 443
      caBundle: <base64 CA bundle>`,
      explanation:
        'You will not write these on CKAD, but recognising one matters: a `failurePolicy: Fail` webhook whose backing service is down produces "failed calling webhook" errors on every matching create, and looks like a broken cluster.',
      placeholders: ['policy-webhook', 'policy-system', '<base64 CA bundle>'],
    },
    {
      title: 'Pod Security Admission: validating admission you configure with labels',
      language: 'yaml',
      code: `apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    pod-security.kubernetes.io/enforce: baseline # reject violations
    pod-security.kubernetes.io/audit: restricted # record violations
    pod-security.kubernetes.io/warn: restricted # warn on violations`,
      explanation:
        'This is the most accessible example of validating admission: no webhook, no external service, just three labels - and Pods that violate the standard are rejected with a message listing every rule they break.',
      placeholders: ['shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl auth can-i create deployments.apps -n shop',
      what: 'Tests the authorization stage for your own identity.',
      expected: 'yes or no.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl auth can-i --list -n shop',
      what: 'Everything your current identity may do in a namespace.',
      expected: 'A resources/verbs table.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl auth whoami',
      what: 'Shows the identity the API server authenticated you as - the authentication stage result.',
      expected: 'ATTRIBUTE / VALUE rows including Username and Groups.',
    },
    {
      command: 'kubectl config view --minify -o jsonpath="{.users[0].name}"; echo',
      what: 'Which kubeconfig user (and therefore which credential) is in use.',
      expected: 'The user name from your kubeconfig.',
    },
    {
      command: 'kubectl get validatingwebhookconfigurations',
      what: 'Lists validating webhooks. Empty on a plain cluster; a service mesh or policy engine adds entries.',
      expected: 'Names and webhook counts.',
    },
    {
      command: 'kubectl get mutatingwebhookconfigurations',
      what: 'Lists mutating webhooks - the things that might be changing your objects.',
      expected: 'Names and webhook counts.',
    },
    {
      command: 'kubectl get pod plain -n shop -o jsonpath=\'{.metadata.annotations}{"\\n"}\'',
      what: 'Annotations often record what admission did (`kubernetes.io/limit-ranger`, injection markers).',
      expected: 'The limit-ranger annotation if a LimitRange applied.',
      placeholders: ['plain', 'shop'],
    },
    {
      command: 'kubectl apply -f pod.yaml --dry-run=server -o yaml | head -40',
      what: 'Runs the full admission chain without persisting, so you can see the mutated result.',
      expected: 'The object as it *would* be stored, including injected defaults.',
      placeholders: ['pod.yaml'],
    },
    {
      command:
        'kubectl get ns shop -o jsonpath=\'{.metadata.labels}\' | tr "," "\\n" | grep pod-security',
      what: 'Which Pod Security level a namespace enforces.',
      expected: 'The enforce/audit/warn labels, or nothing.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector reason=FailedCreate --sort-by=.lastTimestamp',
      what: 'Admission rejections for controller-created Pods land here rather than as a command error.',
      expected: 'Forbidden messages naming the quota, policy or webhook.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Nothing here is a manifest you write on CKAD, apart from namespace Pod Security labels. What matters is the diagnostic procedure.',
      'Read the error status: 401 means authentication, 403 means authorization or admission.',
      'For a 403, run `kubectl auth can-i` for the same verb and resource. `no` means RBAC; `yes` means admission.',
      'For an admission rejection, read the message: it names the quota, the PodSecurity standard, or the webhook.',
      'Use `--dry-run=server` when you want to see what admission would do to an object without creating it.',
    ],
    code: [
      {
        title: 'A decision procedure for any API error',
        language: 'bash',
        code: `# 1. Which gate failed?
#    "Unauthorized"          -> authentication (401)
#    "cannot <verb> ..."     -> authorization (403, RBAC)
#    "exceeded quota" /
#    "violates PodSecurity" /
#    "failed calling webhook" -> admission (403)

# 2. Confirm the identity
kubectl auth whoami

# 3. Confirm authorization for exactly this request
kubectl auth can-i create pods -n shop
# yes -> the failure is admission, not RBAC

# 4. Find the admission control responsible
kubectl describe resourcequota -n shop
kubectl get ns shop -o jsonpath='{.metadata.labels}' | tr ',' '\\n' | grep pod-security
kubectl get validatingwebhookconfigurations mutatingwebhookconfigurations

# 5. See what admission would produce, without creating anything
kubectl apply -f pod.yaml --dry-run=server -o yaml | grep -A6 resources:`,
        placeholders: ['shop', 'pod.yaml'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl auth whoami',
      what: 'Confirms authentication succeeded and shows the identity used for authorization.',
      expected: 'Username and Groups rows.',
    },
    {
      command: 'kubectl auth can-i create pods -n shop',
      what: 'Confirms the authorization stage independently of admission.',
      expected: 'yes',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl apply -f pod.yaml --dry-run=server',
      what: 'Runs authentication, authorization, mutation and validation without persisting - the closest thing to a full pre-flight check.',
      expected: 'pod/x created (server dry run), or the precise rejection.',
      placeholders: ['pod.yaml'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get pods',
      what: 'A 401 here is always a credential problem: expired token, wrong kubeconfig, wrong context.',
      expected: 'error: You must be logged in to the server (Unauthorized)',
    },
    {
      command: 'kubectl auth can-i <verb> <resource> -n shop',
      what: 'The single command that distinguishes an RBAC 403 from an admission 403.',
      expected: 'no for RBAC problems, yes when admission is the gate.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl apply -f pod.yaml 2>&1 | grep -i "webhook"',
      what: 'A "failed calling webhook" error means an admission webhook is unreachable or timing out.',
      expected: 'Internal error occurred: failed calling webhook "...": context deadline exceeded.',
      placeholders: ['pod.yaml'],
    },
    {
      command: 'kubectl get ns shop -o yaml | grep -A3 phase',
      what: 'A Terminating namespace rejects all new objects via the NamespaceLifecycle plugin.',
      expected:
        'phase: Active. `Terminating` explains "unable to create new content in namespace".',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl config current-context && kubectl auth whoami',
      what: 'Together these catch the "correct permissions, wrong identity" case.',
      expected: 'The context and identity you expected.',
    },
  ],
  commonMistakes: [
    'Debugging RBAC when the error is 401. A 401 means no identity was established at all.',
    'Assuming every 403 is RBAC. Quota and Pod Security rejections also return 403 but need different fixes.',
    'Trusting `kubectl auth can-i` as a complete pre-flight check. It tests authorization only, not admission.',
    'Being surprised that `kubectl get pod -o yaml` differs from the manifest. Mutating admission and defaulting did that.',
    'Forgetting that a `failurePolicy: Fail` webhook whose service is down blocks every matching request.',
    'Expecting RBAC deny rules. Authorization is allow-only; denial is the default when nothing allows.',
    'Trying to create objects in a Terminating namespace and reading the rejection as a permissions problem.',
    'Forgetting that admission rejections for controller-created Pods appear as ReplicaSet/Job events, not as command errors.',
  ],
  examTips: [
    'Memorise the three signatures: 401 → credential; "cannot <verb> resource" → RBAC; "exceeded quota" / "violates PodSecurity" / "failed calling webhook" → admission.',
    '`kubectl auth can-i` is the discriminator between an RBAC 403 and an admission 403.',
    '`kubectl auth whoami` answers "who does the cluster think I am?" in one line.',
    '`--dry-run=server` runs the whole admission chain, which is why it catches things `--dry-run=client` cannot.',
    'If a task asks you to explain why an object was rejected, quote the message - it names the responsible control.',
    'CKAD will not ask you to configure webhooks, but it may ask you to recognise that one is interfering.',
  ],
  summary: [
    'Three gates in order: authentication (401), authorization (403), admission control (also 403 but with a policy message).',
    'Mutating admission runs before validating admission and can change your object; validating can only accept or reject.',
    'RBAC is allow-only; denial is the default when no rule matches.',
    '`kubectl auth can-i` tests authorization only - a `yes` plus a Forbidden error means admission.',
    'LimitRanger, ServiceAccount and DefaultStorageClass are mutating; ResourceQuota and PodSecurity are validating.',
  ],
  practice: [
    {
      id: 'aaa-p1',
      level: 'beginner',
      prompt:
        'You get `error: You must be logged in to the server (Unauthorized)`. Which stage failed, and is RBAC involved?',
      answer:
        'Authentication (HTTP 401). RBAC is not involved at all - no identity was established, so authorization never ran. Fix the credential: check `kubectl config current-context`, the kubeconfig user, and whether a token has expired.',
      explanation:
        'A 401 and a 403 are genuinely different failures. Only 403 with a "cannot <verb>" message is an RBAC problem.',
    },
    {
      id: 'aaa-p2',
      level: 'intermediate',
      prompt:
        'A Pod creation returns 403, but `kubectl auth can-i create pods -n shop` says `yes`. What is happening and where do you look?',
      answer:
        "Authorization passed; the rejection came from **admission control**, which runs after authorization. Look at the error message - it will name the responsible control - then check `kubectl describe resourcequota -n shop`, the namespace's `pod-security.kubernetes.io/*` labels, and `kubectl get validatingwebhookconfigurations`.",
      explanation:
        'This is precisely why `kubectl auth can-i` is not a complete pre-flight check. `kubectl apply --dry-run=server` is, because it runs the whole chain.',
    },
    {
      id: 'aaa-p3',
      level: 'advanced',
      prompt:
        'Name three mutating admission plugins whose effects you can see in a Pod you submitted without those fields, and how to observe each.',
      answer:
        "1. **ServiceAccount** - sets `spec.serviceAccountName: default` and adds the `kube-api-access-*` projected volume. Observe: `kubectl get pod x -o jsonpath='{.spec.volumes[*].name}'`.\n2. **LimitRanger** - injects `resources.requests`/`limits` from a namespace LimitRange and records the `kubernetes.io/limit-ranger` annotation. Observe: `kubectl get pod x -o jsonpath='{.metadata.annotations}'`.\n3. **DefaultStorageClass** - fills in `spec.storageClassName` on a PVC that omitted it. Observe: `kubectl get pvc y -o jsonpath='{.spec.storageClassName}'`.\n\nAll three are visible by diffing your manifest against `kubectl apply --dry-run=server -o yaml`.",
      explanation:
        'Understanding that the stored object is not the submitted object explains a large class of "I did not put that there" questions - including sidecars injected by a service mesh, which is the same mechanism.',
    },
  ],
  lab: {
    title: 'Trigger each gate deliberately',
    scenario:
      'You will produce a 401, an RBAC 403 and an admission 403 in the same cluster, use `kubectl auth can-i` to tell the last two apart, and watch mutating admission change an object you submitted.',
    prerequisites: ['A cluster where you can create namespaces, RBAC objects and quotas'],
    tasks: [
      {
        instruction:
          'Create namespace `aaa-lab` and set it as default. Confirm your own identity with `kubectl auth whoami`.',
      },
      {
        instruction:
          'Submit a bare Pod and diff it against what is stored, identifying three fields that mutating admission added.',
      },
      {
        instruction:
          'Create a ServiceAccount with no permissions and use impersonation to produce an RBAC 403; confirm with `auth can-i`.',
      },
      {
        instruction:
          'Grant it create on pods, then add a ResourceQuota requiring resources, and produce an admission 403 while `auth can-i` still says yes.',
      },
      {
        instruction:
          'Add a LimitRange and show that the same bare Pod now succeeds because mutating admission fills in the defaults.',
      },
      {
        instruction:
          'Label the namespace `pod-security.kubernetes.io/enforce=restricted` and produce a PodSecurity admission rejection.',
      },
      {
        instruction:
          'Show that `--dry-run=server` reproduces the rejection while `--dry-run=client` does not.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - identity, and what admission adds',
        language: 'bash',
        code: `kubectl create namespace aaa-lab
kubectl config set-context --current --namespace=aaa-lab

kubectl auth whoami
# ATTRIBUTE   VALUE
# Username    kubernetes-admin
# Groups      [system:masters system:authenticated]

cat > plain.yaml <<'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: plain
  namespace: aaa-lab
spec:
  containers:
    - name: app
      image: nginx:1.27-alpine
YAML

kubectl apply -f plain.yaml
kubectl get pod plain -o yaml > stored.yaml

# Three things you never wrote:
kubectl get pod plain -o jsonpath='{.spec.serviceAccountName}{"\\n"}'
# default                     <- ServiceAccount admission plugin
kubectl get pod plain -o jsonpath='{.spec.volumes[*].name}{"\\n"}'
# kube-api-access-xxxxx       <- token projected by the same plugin
kubectl get pod plain -o jsonpath='{.spec.containers[0].imagePullPolicy}{" "}{.spec.restartPolicy}{" "}{.spec.dnsPolicy}{"\\n"}'
# IfNotPresent Always ClusterFirst   <- defaulting

wc -l plain.yaml stored.yaml
#   9 plain.yaml
# 120 stored.yaml          <- everything else came from admission and defaulting`,
      },
      {
        title: 'Step 3 - an RBAC 403',
        language: 'bash',
        code: `kubectl create serviceaccount limited
SA=system:serviceaccount:aaa-lab:limited

kubectl auth can-i create pods --as=$SA
# no

kubectl run denied --image=nginx:1.27-alpine --as=$SA
# Error from server (Forbidden): pods is forbidden: User
# "system:serviceaccount:aaa-lab:limited" cannot create resource "pods"
# in API group "" in the namespace "aaa-lab"
#                                  ^^^^^^ "cannot create resource" = RBAC`,
      },
      {
        title: 'Step 4 - an admission 403 with authorization passing',
        language: 'bash',
        code: `kubectl create role pod-creator --verb=create,get,list --resource=pods
kubectl create rolebinding limited-pod-creator \\
  --role=pod-creator --serviceaccount=aaa-lab:limited

kubectl auth can-i create pods --as=$SA
# yes        <- authorization now passes

kubectl create quota strict --hard=requests.cpu=1,requests.memory=1Gi

kubectl run admitted --image=nginx:1.27-alpine --as=$SA
# Error from server (Forbidden): pods "admitted" is forbidden: failed quota:
# strict: must specify requests.cpu,requests.memory
#                      ^^^^^^^^^^^ a QUOTA message, not "cannot create"

kubectl auth can-i create pods --as=$SA
# yes        <- still yes! The gate that refused was ADMISSION.`,
      },
      {
        title: 'Step 5 - mutating admission rescues the same request',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: LimitRange
metadata: {name: defaults, namespace: aaa-lab}
spec:
  limits:
    - type: Container
      defaultRequest: {cpu: 50m, memory: 64Mi}
      default: {cpu: 200m, memory: 128Mi}
YAML

# The identical command now succeeds, because LimitRanger (MUTATING) runs
# before ResourceQuota (VALIDATING) and fills in the missing fields.
kubectl run admitted --image=nginx:1.27-alpine --as=$SA
# pod/admitted created

kubectl get pod admitted -o jsonpath='{.spec.containers[0].resources}{"\\n"}'
# {"limits":{"cpu":"200m","memory":"128Mi"},"requests":{"cpu":"50m","memory":"64Mi"}}
kubectl get pod admitted -o jsonpath='{.metadata.annotations.kubernetes\\.io/limit-ranger}{"\\n"}'
# LimitRanger plugin set: cpu, memory request for container admitted; ...`,
      },
      {
        title: 'Steps 6-8 - PodSecurity, dry-run comparison, cleanup',
        language: 'bash',
        code: `kubectl label namespace aaa-lab pod-security.kubernetes.io/enforce=restricted

kubectl run insecure --image=nginx:1.27-alpine
# Error from server (Forbidden): pods "insecure" is forbidden: violates
# PodSecurity "restricted:latest": allowPrivilegeEscalation != false
# (container "insecure" must set securityContext.allowPrivilegeEscalation=false),
# unrestricted capabilities, runAsNonRoot != true, seccompProfile
#              ^^^^^^^^^^^ a POLICY message = admission

# client dry run knows nothing about admission:
kubectl apply -f plain.yaml --dry-run=client
# pod/plain configured (dry run)          <- no complaint

# server dry run runs the whole chain:
kubectl apply -f plain.yaml --dry-run=server
# Error from server (Forbidden): ... violates PodSecurity "restricted:latest" ...

kubectl config set-context --current --namespace=default
kubectl delete namespace aaa-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl auth can-i create pods --as=system:serviceaccount:aaa-lab:limited -n aaa-lab',
        what: 'The discriminator: `yes` while creation still fails proves the rejection is from admission.',
        expected: 'yes',
      },
      {
        command:
          'kubectl get pod admitted -n aaa-lab -o jsonpath=\'{.metadata.annotations.kubernetes\\.io/limit-ranger}{"\\n"}\'',
        what: 'The receipt that a mutating plugin changed the object.',
        expected: 'LimitRanger plugin set: cpu, memory request...',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace aaa-lab',
        what: 'Removes the quota, LimitRange, RBAC objects and Pods.',
        expected: 'namespace "aaa-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['rbac', 'serviceaccounts', 'quota-and-limitrange', 'securitycontext'],
  docs: [
    {
      title: 'Controlling access to the Kubernetes API',
      url: 'https://kubernetes.io/docs/concepts/security/controlling-access/',
    },
    {
      title: 'Admission controllers',
      url: 'https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/',
    },
    {
      title: 'Authenticating',
      url: 'https://kubernetes.io/docs/reference/access-authn-authz/authentication/',
    },
  ],
}
