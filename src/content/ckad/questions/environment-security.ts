import type { Question } from '../../types'

export const environmentSecurityQuestions: Question[] = [
  {
    id: 'env-q01',
    domainId: 'environment-security',
    topicId: 'configmaps',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that creates a ConfigMap named app-config in namespace shop with the keys LOG_LEVEL=debug and MAX_RETRIES=3.',
    acceptedAnswers: [
      'kubectl create configmap app-config -n shop --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=3',
      'kubectl create cm app-config -n shop --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=3',
      'kubectl create configmap app-config --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=3 -n shop',
      'kubectl -n shop create configmap app-config --from-literal=LOG_LEVEL=debug --from-literal=MAX_RETRIES=3',
    ],
    answerHint: 'kubectl create configmap ...',
    explanation:
      'Using the imperative form avoids the string-typing trap entirely: kubectl stores both values as strings. In YAML you would have to write `MAX_RETRIES: "3"`, because an unquoted 3 is an integer and is rejected.',
  },
  {
    id: 'env-q02',
    domainId: 'environment-security',
    topicId: 'configmaps',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You change a ConfigMap value. Pods that mount it as a volume see the new value within a minute; Pods that consume it via envFrom never do. Why?',
    options: [
      { id: 'a', text: 'envFrom caches values for 24 hours' },
      {
        id: 'b',
        text: 'Environment variables are resolved once at container start and cannot change afterwards',
      },
      { id: 'c', text: 'envFrom requires the ConfigMap to be immutable' },
      { id: 'd', text: 'The kubelet only watches volume-mounted ConfigMaps in the same namespace' },
    ],
    correct: ['b'],
    explanation:
      'A process environment is fixed when the process starts, so the Pods must be recreated: `kubectl rollout restart deployment/<name>`. Volume-mounted ConfigMaps are projected files that the kubelet refreshes - except with `subPath`, which copies the file and never updates.',
  },
  {
    id: 'env-q03',
    domainId: 'environment-security',
    topicId: 'secrets',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that creates a registry pull secret named regcred in namespace shop for server registry.example.com, username ci and password s3cret.',
    acceptedAnswers: [
      'kubectl create secret docker-registry regcred -n shop --docker-server=registry.example.com --docker-username=ci --docker-password=s3cret',
      'kubectl create secret docker-registry regcred --docker-server=registry.example.com --docker-username=ci --docker-password=s3cret -n shop',
      'kubectl -n shop create secret docker-registry regcred --docker-server=registry.example.com --docker-username=ci --docker-password=s3cret',
    ],
    answerHint: 'kubectl create secret docker-registry ...',
    explanation:
      'This generator sets both the `.dockerconfigjson` key and, crucially, the type `kubernetes.io/dockerconfigjson`. `imagePullSecrets` ignores any other type, so a Secret made with `create secret generic` fails silently with ImagePullBackOff.',
  },
  {
    id: 'env-q04',
    domainId: 'environment-security',
    topicId: 'secrets',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which statement about Secrets is accurate?',
    options: [
      { id: 'a', text: 'Values are encrypted, so anyone with read access still cannot see them' },
      {
        id: 'b',
        text: 'Values are base64-encoded; protection comes from RBAC and encryption-at-rest configuration',
      },
      { id: 'c', text: 'Secrets can only be consumed as environment variables' },
      { id: 'd', text: 'Secret volumes are written to the node disk like ConfigMap volumes' },
    ],
    correct: ['b'],
    explanation:
      "Base64 is encoding, not encryption - `kubectl get secret x -o jsonpath='{.data.k}' | base64 -d` reveals the value to anyone with read permission. Secret volumes are tmpfs-backed, so unlike ConfigMap volumes they never touch the node disk.",
  },
  {
    id: 'env-q05',
    domainId: 'environment-security',
    topicId: 'secrets',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which field lets you write Secret values as plain text and have Kubernetes encode them for you?',
    options: [
      { id: 'a', text: 'data' },
      { id: 'b', text: 'stringData' },
      { id: 'c', text: 'binaryData' },
      { id: 'd', text: 'plainData' },
    ],
    correct: ['b'],
    explanation:
      '`stringData` is write-only: Kubernetes base64-encodes it into `data`, and reading the object back shows only `data`. It is the right choice for any hand-written Secret manifest because it removes base64 mistakes - especially the `echo` without `-n` that appends a newline to the value.',
  },
  {
    id: 'env-q06',
    domainId: 'environment-security',
    topicId: 'env-and-config-injection',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A container has envFrom importing ConfigMap `base` (LOG_LEVEL=info) and ConfigMap `override` (LOG_LEVEL=warn, listed second), plus an explicit env entry setting LOG_LEVEL=debug. What value does the container see?',
    options: [
      { id: 'a', text: 'info' },
      { id: 'b', text: 'warn' },
      { id: 'c', text: 'debug' },
      { id: 'd', text: 'The Pod is rejected as ambiguous' },
    ],
    correct: ['c'],
    explanation:
      'Order of application: envFrom sources in list order (so `override` beats `base`), then `env` entries. An explicit `env` entry therefore always wins, which makes it the right place for a deliberate override on top of shared ConfigMaps.',
  },
  {
    id: 'env-q07',
    domainId: 'environment-security',
    topicId: 'env-and-config-injection',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A container has `limits.memory: 2Gi`. Which env entry exposes that as MEM_LIMIT_MB with the value 2048?',
    options: [
      {
        id: 'a',
        text: 'valueFrom.resourceFieldRef with resource: limits.memory and divisor: 1Mi',
      },
      { id: 'b', text: 'valueFrom.resourceFieldRef with resource: limits.memory (no divisor)' },
      {
        id: 'c',
        text: 'valueFrom.fieldRef with fieldPath: spec.containers[0].resources.limits.memory',
      },
      { id: 'd', text: 'value: "$(LIMITS_MEMORY)"' },
    ],
    correct: ['a'],
    explanation:
      "Without a divisor the value is in bytes (2147483648). `divisor: 1Mi` gives mebibytes; for CPU, `divisor: 1m` gives millicores. `resourceFieldRef` also requires `containerName`, which is how a sidecar can read the main container's limits. Resource fields are not available through `fieldRef`.",
  },
  {
    id: 'env-q08',
    domainId: 'environment-security',
    topicId: 'resource-requirements',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'What is the practical difference between exceeding a CPU limit and exceeding a memory limit?',
    options: [
      { id: 'a', text: 'Both cause the container to be killed' },
      { id: 'b', text: 'CPU throttles the container; memory causes an OOM kill' },
      { id: 'c', text: 'CPU causes an OOM kill; memory throttles the container' },
      { id: 'd', text: 'Neither is enforced - limits are advisory' },
    ],
    correct: ['b'],
    explanation:
      'CPU is compressible, so the kernel simply slows the container down (visible as `nr_throttled` in `/sys/fs/cgroup/cpu.stat`). Memory is not compressible, so the kernel OOM-kills the process - exit code 137, reason OOMKilled, and no application log line at the moment of death.',
  },
  {
    id: 'env-q09',
    domainId: 'environment-security',
    topicId: 'resource-requirements',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which Pod gets QoS class Guaranteed?',
    options: [
      { id: 'a', text: 'requests cpu 100m / memory 128Mi, limits cpu 500m / memory 512Mi' },
      {
        id: 'b',
        text: 'requests cpu 500m / memory 512Mi, limits cpu 500m / memory 512Mi, on every container',
      },
      { id: 'c', text: 'No requests or limits at all' },
      { id: 'd', text: 'Limits set but no requests' },
    ],
    correct: ['b'],
    explanation:
      'Guaranteed requires requests to equal limits for *both* CPU and memory on *every* container, including sidecars. One container without matching values downgrades the whole Pod to Burstable. Guaranteed Pods are evicted last under node pressure; BestEffort (option C) are evicted first.',
  },
  {
    id: 'env-q10',
    domainId: 'environment-security',
    topicId: 'resource-requirements',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A container is repeatedly OOMKilled. It has `requests.memory: 256Mi` and `limits.memory: 512Mi`. Which change addresses the kill?',
    options: [
      { id: 'a', text: 'Raise requests.memory to 512Mi' },
      {
        id: 'b',
        text: 'Raise limits.memory, or reduce the application memory ceiling to fit inside it',
      },
      { id: 'c', text: 'Remove requests.memory entirely' },
      { id: 'd', text: 'Add a liveness probe' },
    ],
    correct: ['b'],
    explanation:
      'The kernel enforces the *limit*. Requests only affect scheduling, so raising them changes nothing about the kill. Either give the container more headroom, or lower its own ceiling (a JVM `-Xmx`, `NODE_OPTIONS=--max-old-space-size`, fewer workers) - `resourceFieldRef` can feed the limit into the application so the two stay in sync.',
  },
  {
    id: 'env-q11',
    domainId: 'environment-security',
    topicId: 'quota-and-limitrange',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A namespace has a ResourceQuota on requests.cpu and requests.memory. A Deployment with no resources block produces no Pods at all, and no Pending Pod. Where do you find the error, and what fixes it namespace-wide?',
    options: [
      { id: 'a', text: 'Deployment events; raise the quota' },
      { id: 'b', text: 'ReplicaSet events (FailedCreate); add a LimitRange with defaults' },
      { id: 'c', text: 'Node events; drain the node' },
      { id: 'd', text: 'Scheduler logs; add a nodeSelector' },
    ],
    correct: ['b'],
    explanation:
      'A quota naming a resource forces every container to declare it, so the Pods were rejected at admission and never created - the message "must specify requests.cpu,requests.memory" appears as a FailedCreate event on the ReplicaSet. A LimitRange with `defaultRequest` and `default` injects values for containers that omit them, fixing it for the whole namespace.',
  },
  {
    id: 'env-q12',
    domainId: 'environment-security',
    topicId: 'serviceaccounts',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that makes existing Deployment api in namespace shop use the ServiceAccount api-sa.',
    acceptedAnswers: [
      'kubectl set serviceaccount deployment/api api-sa -n shop',
      'kubectl set serviceaccount deploy/api api-sa -n shop',
      'kubectl -n shop set serviceaccount deployment/api api-sa',
      'kubectl set sa deployment/api api-sa -n shop',
    ],
    answerHint: 'kubectl set serviceaccount ...',
    explanation:
      "This changes the Pod template, so it triggers a rolling update. `spec.serviceAccountName` is immutable on an existing Pod, which is why the change has to go through the controller. Verify with `kubectl get deploy api -n shop -o jsonpath='{.spec.template.spec.serviceAccountName}'`.",
  },
  {
    id: 'env-q13',
    domainId: 'environment-security',
    topicId: 'serviceaccounts',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Pod should have no Kubernetes API credentials at all. Which field achieves this, and where does it take precedence?',
    options: [
      {
        id: 'a',
        text: '`automountServiceAccountToken: false`; the Pod-level setting overrides the ServiceAccount',
      },
      { id: 'b', text: '`serviceAccountName: none`; there is no precedence' },
      { id: 'c', text: '`spec.securityContext.runAsNonRoot: true`' },
      { id: 'd', text: 'Deleting the default ServiceAccount in the namespace' },
    ],
    correct: ['a'],
    explanation:
      'Set it on the Pod for an exception, or on the ServiceAccount for a whole class of workloads; the Pod-level value wins. With it false, `/var/run/secrets/kubernetes.io/serviceaccount/` does not exist - a token that is not there cannot be stolen, which makes this the cheapest hardening step available.',
  },
  {
    id: 'env-q14',
    domainId: 'environment-security',
    topicId: 'securitycontext',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which of these belongs at Pod level, and which at container level?',
    options: [
      { id: 'a', text: 'fsGroup is Pod-level; readOnlyRootFilesystem is container-level' },
      { id: 'b', text: 'Both are Pod-level' },
      { id: 'c', text: 'Both are container-level' },
      { id: 'd', text: 'fsGroup is container-level; readOnlyRootFilesystem is Pod-level' },
    ],
    correct: ['a'],
    explanation:
      '`fsGroup`, `supplementalGroups` and `sysctls` exist only at Pod level (they concern volumes and the Pod sandbox). `readOnlyRootFilesystem`, `capabilities`, `privileged` and `allowPrivilegeEscalation` exist only at container level. Putting either in the wrong place is an "unknown field" validation error.',
  },
  {
    id: 'env-q15',
    domainId: 'environment-security',
    topicId: 'securitycontext',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A container fails to start with `container has runAsNonRoot and image will run as root`. What is the minimal fix?',
    options: [
      { id: 'a', text: 'Remove runAsNonRoot' },
      { id: 'b', text: 'Add a non-zero runAsUser to the securityContext' },
      { id: 'c', text: 'Add privileged: true' },
      { id: 'd', text: 'Add readOnlyRootFilesystem: true' },
    ],
    correct: ['b'],
    explanation:
      '`runAsNonRoot: true` is a check, not a change - it refuses to start a container whose effective UID would be 0. Supplying `runAsUser: <non-zero>` gives it a user to run as. The better long-term fix is a numeric `USER` in the image, so it is safe by default wherever it runs.',
  },
  {
    id: 'env-q16',
    domainId: 'environment-security',
    topicId: 'securitycontext',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'After setting `readOnlyRootFilesystem: true`, nginx crashes with `open() "/var/run/nginx.pid" failed (30: Read-only file system)`. What is the correct fix?',
    options: [
      { id: 'a', text: 'Set readOnlyRootFilesystem back to false' },
      { id: 'b', text: 'Mount emptyDir volumes over the paths the application writes to' },
      { id: 'c', text: 'Add the CAP_DAC_OVERRIDE capability' },
      { id: 'd', text: 'Run the container as root' },
    ],
    correct: ['b'],
    explanation:
      'The root filesystem stays immutable while the specific paths the application needs (`/var/run`, `/var/cache/nginx`, `/tmp`) become writable emptyDir mounts. This is the standard pairing in any hardening task - the flag alone almost always breaks the application until the mounts are added.',
  },
  {
    id: 'env-q17',
    domainId: 'environment-security',
    topicId: 'securitycontext',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which capabilities block is written correctly for allowing a non-root process to bind port 80?',
    options: [
      { id: 'a', text: 'capabilities:\n  add: ["CAP_NET_BIND_SERVICE"]' },
      { id: 'b', text: 'capabilities:\n  drop: ["ALL"]\n  add: ["NET_BIND_SERVICE"]' },
      { id: 'c', text: 'capabilities:\n  allow: ["NET_BIND_SERVICE"]' },
      { id: 'd', text: 'privileged: true' },
    ],
    correct: ['b'],
    explanation:
      'Capability names are written without the `CAP_` prefix - `CAP_NET_BIND_SERVICE` is accepted by the API but matches no real capability. Dropping ALL first and adding back only what is needed is the idiomatic pattern. The better design is usually to listen on 8080 and drop the capability entirely.',
  },
  {
    id: 'env-q18',
    domainId: 'environment-security',
    topicId: 'rbac',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that tests whether ServiceAccount api-sa in namespace shop may read Pod logs in that namespace.',
    acceptedAnswers: [
      'kubectl auth can-i get pods/log --as=system:serviceaccount:shop:api-sa -n shop',
      'kubectl auth can-i get pods/log -n shop --as=system:serviceaccount:shop:api-sa',
      'kubectl -n shop auth can-i get pods/log --as=system:serviceaccount:shop:api-sa',
    ],
    answerHint: 'kubectl auth can-i ...',
    explanation:
      '`kubectl logs` reads the `pods/log` subresource, which `get pods` does not cover. The impersonation string is always `system:serviceaccount:<namespace>:<name>`. The same applies to `pods/exec` and `pods/portforward` - each needs its own rule.',
  },
  {
    id: 'env-q19',
    domainId: 'environment-security',
    topicId: 'rbac',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A ServiceAccount must list Pods in every namespace and read Nodes. Which combination of objects is required?',
    options: [
      { id: 'a', text: 'A Role and a RoleBinding in each namespace' },
      { id: 'b', text: 'A ClusterRole and a ClusterRoleBinding' },
      { id: 'c', text: 'A ClusterRole and a RoleBinding' },
      { id: 'd', text: 'A Role and a ClusterRoleBinding' },
    ],
    correct: ['b'],
    explanation:
      'Nodes are cluster-scoped, so no Role can ever grant access to them, and "every namespace" would otherwise need one RoleBinding per namespace forever. Note that option D is not merely wrong but invalid: a ClusterRoleBinding cannot reference a Role.',
  },
  {
    id: 'env-q20',
    domainId: 'environment-security',
    topicId: 'authn-authz-admission',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A Pod creation returns 403 Forbidden, but `kubectl auth can-i create pods -n shop` says yes. Which stage rejected it?',
    options: [
      { id: 'a', text: 'Authentication' },
      { id: 'b', text: 'Authorization (RBAC)' },
      { id: 'c', text: 'Admission control' },
      { id: 'd', text: 'Schema validation' },
    ],
    correct: ['c'],
    explanation:
      '`kubectl auth can-i` tests only the authorization stage, so a `yes` alongside a Forbidden error means the rejection came later - from a ResourceQuota, Pod Security Admission, or a validating webhook. The error message names the responsible control. A 401 would instead mean authentication.',
  },
  {
    id: 'env-q21',
    domainId: 'environment-security',
    topicId: 'crds-and-operators',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You apply a custom resource successfully, `kubectl get` shows it, and nothing happens. Its status is empty. What is the most likely cause?',
    options: [
      { id: 'a', text: 'The CRD schema is invalid' },
      { id: 'b', text: 'No controller (operator) is running to reconcile it' },
      { id: 'c', text: 'The custom resource is in the wrong API group' },
      { id: 'd', text: 'The CRD is not Established' },
    ],
    correct: ['b'],
    explanation:
      'A CRD teaches the API server to validate and store a kind; something has to watch for it and act. An empty `status` on a resource whose CRD defines status fields is the strongest signal. Check `kubectl get deploy,pods -A | grep -iE "operator|controller"`, and if one exists read its logs - an RBAC Forbidden error is the next most common cause.',
  },
  {
    id: 'env-q22',
    domainId: 'environment-security',
    topicId: 'configmaps',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create a ConfigMap named app-config with LOG_LEVEL=debug and a key nginx.conf containing an nginx server block listening on 8080. Then create a Pod named consumer (nginx:1.27-alpine) that exposes LOG_LEVEL as the environment variable APP_LOG_LEVEL and mounts nginx.conf as a file at /etc/nginx/conf.d/default.conf.',
    context: 'Namespace shop exists.',
    checkpoints: [
      {
        id: 'c1',
        text: 'ConfigMap app-config exists in shop with both LOG_LEVEL and nginx.conf keys',
      },
      { id: 'c2', text: 'Pod consumer is Running' },
      { id: 'c3', text: '`kubectl exec consumer -n shop -- printenv APP_LOG_LEVEL` prints debug' },
      {
        id: 'c4',
        text: '`kubectl exec consumer -n shop -- cat /etc/nginx/conf.d/default.conf` shows the server block',
      },
      { id: 'c5', text: 'The mount uses subPath so the other files in conf.d are still present' },
    ],
    explanation:
      'Renaming a key requires `env[].valueFrom.configMapKeyRef` - `envFrom` always uses the key name as-is. Mounting a single file into an existing directory requires `subPath`; without it the whole directory is replaced and nginx loses the files its image shipped.',
    solution: [
      {
        title: 'Create the ConfigMap',
        language: 'bash',
        code: `kubectl create configmap app-config -n shop \\
  --from-literal=LOG_LEVEL=debug \\
  --from-literal=nginx.conf='server {
  listen 8080;
  location / { return 200 "ok\\n"; add_header Content-Type text/plain; }
}'`,
      },
      {
        title: 'consumer.yaml',
        language: 'yaml',
        code: `apiVersion: v1
kind: Pod
metadata:
  name: consumer
  namespace: shop
spec:
  volumes:
    - name: config
      configMap:
        name: app-config
  containers:
    - name: nginx
      image: nginx:1.27-alpine
      env:
        - name: APP_LOG_LEVEL # renamed, so configMapKeyRef is required
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
      volumeMounts:
        - name: config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: nginx.conf # single file, siblings preserved
          readOnly: true`,
      },
      {
        title: 'Verify',
        language: 'bash',
        code: `kubectl apply -f consumer.yaml
kubectl wait --for=condition=Ready pod/consumer -n shop --timeout=90s

kubectl exec consumer -n shop -- printenv APP_LOG_LEVEL
# debug
kubectl exec consumer -n shop -- cat /etc/nginx/conf.d/default.conf
kubectl exec consumer -n shop -- ls /etc/nginx/conf.d/
# default.conf  (plus anything the image shipped)`,
      },
    ],
  },
  {
    id: 'env-q23',
    domainId: 'environment-security',
    topicId: 'securitycontext',
    category: 'lab',
    kind: 'task',
    difficulty: 'advanced',
    points: 5,
    prompt:
      'In namespace shop, create a Pod named hardened running nginx:1.27-alpine that satisfies the restricted Pod Security Standard: runs as user 101 and not as root, has a read-only root filesystem, drops all Linux capabilities, forbids privilege escalation, uses the RuntimeDefault seccomp profile, and still starts successfully.',
    context: 'Namespace shop exists. nginx needs to write to /var/cache/nginx, /var/run and /tmp.',
    checkpoints: [
      { id: 'c1', text: 'Pod hardened is Running and Ready in namespace shop' },
      { id: 'c2', text: '`kubectl exec hardened -n shop -- id` reports uid=101' },
      { id: 'c3', text: 'Writing to / fails with "Read-only file system"' },
      { id: 'c4', text: 'emptyDir volumes are mounted at /var/cache/nginx, /var/run and /tmp' },
      { id: 'c5', text: '`grep CapEff /proc/1/status` inside the container is all zeros' },
      {
        id: 'c6',
        text: 'The Pod spec sets seccompProfile RuntimeDefault and allowPrivilegeEscalation false',
      },
    ],
    explanation:
      'This is the full hardening pattern. The emptyDir mounts are not optional decoration - with a read-only root filesystem nginx cannot create its PID file or cache and refuses to start. Note also that nginx must be configured to listen above 1024, since a non-root process cannot bind port 80 without NET_BIND_SERVICE.',
    solution: [
      {
        title: 'hardened.yaml',
        language: 'yaml',
        code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-8080
  namespace: shop
data:
  default.conf: |
    server {
      listen 8080;
      location / { return 200 'hardened\\n'; add_header Content-Type text/plain; }
    }
---
apiVersion: v1
kind: Pod
metadata:
  name: hardened
  namespace: shop
spec:
  securityContext: # POD level
    runAsNonRoot: true
    runAsUser: 101
    runAsGroup: 101
    fsGroup: 101
    seccompProfile:
      type: RuntimeDefault
  volumes:
    - name: cache
      emptyDir: { sizeLimit: 64Mi }
    - name: run
      emptyDir: { medium: Memory, sizeLimit: 8Mi }
    - name: tmp
      emptyDir: { sizeLimit: 32Mi }
    - name: conf
      configMap: { name: nginx-8080 }
  containers:
    - name: nginx
      image: nginx:1.27-alpine
      ports:
        - containerPort: 8080 # not 80: non-root cannot bind <1024
      securityContext: # CONTAINER level
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]
      volumeMounts:
        - { name: cache, mountPath: /var/cache/nginx }
        - { name: run, mountPath: /var/run }
        - { name: tmp, mountPath: /tmp }
        - { name: conf, mountPath: /etc/nginx/conf.d, readOnly: true }
      resources:
        requests: { cpu: 50m, memory: 64Mi }
        limits: { cpu: 200m, memory: 128Mi }`,
      },
      {
        title: 'Verify every requirement',
        language: 'bash',
        code: `kubectl apply -f hardened.yaml
kubectl wait --for=condition=Ready pod/hardened -n shop --timeout=120s

kubectl exec hardened -n shop -- id
# uid=101(nginx) gid=101(nginx) groups=101(nginx)

kubectl exec hardened -n shop -- sh -c 'touch /nope 2>&1 || true'
# touch: /nope: Read-only file system

kubectl exec hardened -n shop -- sh -c 'touch /tmp/ok && echo "tmp writable"'
# tmp writable

kubectl exec hardened -n shop -- grep CapEff /proc/1/status
# CapEff: 0000000000000000

kubectl exec hardened -n shop -- wget -qO- http://127.0.0.1:8080/
# hardened`,
      },
    ],
  },
  {
    id: 'env-q24',
    domainId: 'environment-security',
    topicId: 'rbac',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create a ServiceAccount named log-reader, and grant it exactly the permissions needed to run `kubectl get pods` and `kubectl logs` in that namespace - and nothing more.',
    context: 'Namespace shop exists. You have permission to create RBAC objects.',
    checkpoints: [
      { id: 'c1', text: 'ServiceAccount log-reader exists in namespace shop' },
      { id: 'c2', text: 'A Role grants get/list/watch on pods and get on pods/log' },
      {
        id: 'c3',
        text: 'A RoleBinding binds that Role to the ServiceAccount, with the namespace specified',
      },
      {
        id: 'c4',
        text: '`kubectl auth can-i get pods/log --as=system:serviceaccount:shop:log-reader -n shop` returns yes',
      },
      {
        id: 'c5',
        text: '`kubectl auth can-i delete pods --as=system:serviceaccount:shop:log-reader -n shop` returns no',
      },
    ],
    explanation:
      'The trap is `pods/log`: granting `get` on `pods` does not permit `kubectl logs`, because logs are a subresource. Verify in both directions - a permission set that allows too much still passes the positive test.',
    solution: [
      {
        title: 'Imperative (fastest)',
        language: 'bash',
        code: `kubectl create serviceaccount log-reader -n shop

kubectl create role pod-log-reader -n shop \\
  --verb=get,list,watch --resource=pods \\
  --verb=get --resource=pods/log

# If your kubectl version does not accept two --verb groups, create two rules:
#   kubectl create role pod-reader -n shop --verb=get,list,watch --resource=pods
#   kubectl create role log-reader-role -n shop --verb=get --resource=pods/log
# and bind both.

kubectl create rolebinding log-reader-binding -n shop \\
  --role=pod-log-reader --serviceaccount=shop:log-reader`,
      },
      {
        title: 'Declarative equivalent',
        language: 'yaml',
        code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: log-reader
  namespace: shop
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-log-reader
  namespace: shop
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"] # required for kubectl logs
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: log-reader-binding
  namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-log-reader
subjects:
  - kind: ServiceAccount
    name: log-reader
    namespace: shop # REQUIRED for ServiceAccount subjects`,
      },
      {
        title: 'Verify both directions',
        language: 'bash',
        code: `SA=system:serviceaccount:shop:log-reader
kubectl auth can-i list pods    --as=$SA -n shop   # yes
kubectl auth can-i get pods/log --as=$SA -n shop   # yes
kubectl auth can-i delete pods  --as=$SA -n shop   # no
kubectl auth can-i list pods    --as=$SA -n default # no
kubectl auth can-i --list       --as=$SA -n shop`,
      },
    ],
  },
]
