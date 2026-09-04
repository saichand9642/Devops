import type { Topic } from '../../../types'

export const examTrapsAndChecklist: Topic = {
  id: 'exam-traps-and-checklist',
  title: 'Common CKAD traps and the final revision checklist',
  domainId: 'exam-prep',
  difficulty: 'advanced',
  estimatedMinutes: 22,
  order: 3,
  tags: ['traps', 'checklist', 'revision', 'verification', 'namespace', 'mistakes'],
  oneLiner:
    'The mistakes that cost marks even when you know the material, the verification command for each domain, and a checklist to read the day before.',
  explanation: [
    'Almost every mark lost on CKAD falls into one of three categories: **wrong place** (wrong cluster or namespace), **wrong object** (a Pod where a Deployment was asked for), or **unverified** (created something that silently did not work).',
    'None of those are knowledge failures. They are process failures, and a short checklist eliminates most of them.',
    'The single most expensive trap is the namespace. A perfect object in `default` when the task said `production` scores zero. The remedy is mechanical: read the task for the namespace, set it on the context, and check it again during verification.',
    'The second most expensive is not verifying. `kubectl apply` succeeding means the object was stored, not that it works. A Deployment can exist with zero Ready Pods; a Service can exist with no endpoints; a Role can exist granting nothing useful.',
    'This lesson is deliberately a reference rather than a narrative. It is meant to be read once carefully and then skimmed the day before the exam.',
  ],
  whyItMatters: [
    'These are the marks you already earned and then gave back. Recovering them costs no additional Kubernetes knowledge.',
    'A per-domain verification command turns "I think that worked" into evidence, in one line each.',
    'Knowing the traps in advance means you recognise them while typing rather than afterwards.',
  ],
  howItWorks: [
    'The three-question pre-flight for every task: which context? which namespace? which object kind? All three are stated in the task text, and all three are graded.',
    'The one-line verification per domain: `rollout status` for Deployments, `get endpoints` for Services, `exec -- printenv` for config, `auth can-i --as=` for RBAC, `get pvc` for storage, `describe pod` for probes and failures.',
    'Immutability shapes how you fix mistakes: Deployment selectors, Job templates and most Pod fields cannot be edited. `kubectl replace --force -f` is the escape hatch, and it recreates the object.',
    'Several traps are about defaults rather than errors: `targetPort` defaults to `port`; `timeoutSeconds` on a probe defaults to 1 second; `restartPolicy` defaults to `Always`; `imagePullPolicy` defaults to `Always` for `:latest`; `revisionHistoryLimit` defaults to 10.',
    'Several are about types: ConfigMap and Secret values must be strings; a pull secret must be `kubernetes.io/dockerconfigjson`; a TLS secret must be `kubernetes.io/tls` with `tls.crt`/`tls.key`.',
    'Several are about scope: nodes, PersistentVolumes, StorageClasses, ClusterRoles and IngressClasses are cluster-scoped, so `-n` is ignored and a Role can never grant access to them.',
    'And several are about where errors appear: a quota rejection for a Deployment shows up as a `FailedCreate` event on the ReplicaSet, not on the Deployment and not as a Pending Pod.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The routine to run on every single question',
      caption:
        'Two habits win the most marks: set the context first, and verify before moving on. Both are cheap and both are forgotten under time pressure.',
      nodes: [
        {
          label: 'Read the whole question twice',
          detail: 'Note the namespace and every exact name given',
          tone: 'accent',
        },
        {
          label: 'Set the context and namespace',
          detail: 'kubectl config use-context ...; then -n or set the default',
          arrowLabel: 'before typing anything else',
          branch: {
            label: 'Skipped this',
            detail: 'Perfect work in the wrong namespace scores zero',
          },
        },
        {
          label: 'Generate rather than type',
          detail: '--dry-run=client -o yaml > q7.yaml, then edit',
        },
        {
          label: 'Apply it',
          detail: 'kubectl apply -f q7.yaml',
        },
        {
          label: 'Verify against the wording',
          detail: 'get, describe, and re-read the question one final time',
          arrowLabel: 'do not skip',
          tone: 'success',
          branch: {
            label: 'Cannot finish it',
            detail: 'Flag it and move on. Never spend 20 minutes on one task.',
          },
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Time triage during the exam',
      caption:
        'Two hours, roughly 15 to 20 tasks. Partial credit is real, so a half-finished task beats an untouched one.',
      question: 'How is this task going?',
      branches: [
        {
          condition: 'you know it cold',
          result: 'Do it now, fast',
          detail: 'Bank the easy marks in the first pass',
          tone: 'accent',
        },
        {
          condition: 'you know it but it is long',
          result: 'Flag it, come back',
          detail: 'Clear the quick ones first, then return',
        },
        {
          condition: 'you are stuck past about five minutes',
          result: 'Save what works and move on',
          detail: 'Leave the partial object - it may still score',
        },
        {
          condition: 'time is nearly up',
          result: 'Verify, do not start anything new',
          detail: 'Re-check namespaces and names on what you already did',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Verification commands (not a Kubernetes object)',
      apiVersion: 'n/a',
      purpose: 'One command per domain that proves a task is actually done.',
      fields: [
        { path: 'Deployments', meaning: 'kubectl rollout status deploy/<name> --timeout=60s' },
        {
          path: 'Services',
          meaning: 'kubectl get endpoints <name> - must be non-empty, with the right port',
        },
        {
          path: 'ConfigMaps / Secrets',
          meaning: 'kubectl exec <pod> -- printenv <VAR>, or -- cat /path/file',
        },
        {
          path: 'Probes',
          meaning: 'kubectl get pods (READY column) plus describe for the failure message',
        },
        {
          path: 'RBAC',
          meaning:
            'kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa> -n <ns>',
        },
        {
          path: 'Storage',
          meaning: 'kubectl get pvc (STATUS Bound) plus kubectl exec <pod> -- df -h <mountPath>',
        },
        {
          path: 'Jobs / CronJobs',
          meaning: 'kubectl get job (COMPLETIONS) / kubectl get cronjob (LAST SCHEDULE)',
        },
        {
          path: 'NetworkPolicy',
          meaning: 'A labelled test Pod that should connect, and one that should not',
        },
        {
          path: 'Ingress',
          meaning: 'kubectl describe ingress - endpoints in parentheses; then curl -H "Host: ..."',
        },
        {
          path: 'Resources / QoS',
          meaning: "kubectl get pod <name> -o jsonpath='{.status.qosClass}'",
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Four marks lost, none of them for lack of knowledge',
    story: [
      'A candidate reviewed their failed attempt against the task list and found four tasks where they knew exactly what to do and still scored zero or partial.',
      'Task 3 asked for a Deployment in namespace `production`. They created it in `default`. They had read the namespace, set nothing, and never checked. Zero marks for a correct Deployment.',
      'Task 7 asked to "create a Pod that runs a one-off migration". They created a Deployment, because that is what they usually create. The Deployment restarted the migration container forever. Zero marks, and a CrashLoopBackOff they briefly tried to debug.',
      'Task 11 asked for a Service exposing a Deployment on port 80 targeting container port 8080. They typed `port: 80` and no `targetPort`. The Service existed, had endpoints, and refused every connection. Partial marks.',
      'Task 14 asked for a ServiceAccount able to read Pod logs. They created a Role granting `get` on `pods` and bound it correctly. `kubectl logs` needs `pods/log`. Partial marks.',
      'All four are on the trap list below. All four would have been caught by the three-question pre-flight and one verification command each.',
    ],
    code: [
      {
        title: 'What would have caught each one',
        language: 'bash',
        code: `# Task 3 - namespace
kubectl config view --minify -o jsonpath='{..namespace}{"\\n"}'
kubectl get deploy -A | grep <name>          # finds it in the wrong namespace

# Task 7 - object kind: re-read the task text before creating
#   "a Pod that runs a one-off migration" -> Pod (or Job), never a Deployment

# Task 11 - targetPort
kubectl get endpoints <svc>
# svc  10.244.1.5:80      <- port 80, but the container listens on 8080

# Task 14 - subresource
kubectl auth can-i get pods/log --as=system:serviceaccount:<ns>:<sa> -n <ns>
# no                     <- caught before submitting`,
        explanation: 'Four commands, about twenty seconds in total, and four tasks recovered.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The trap list, by category',
      language: 'text',
      code: `=== PLACE ====================================================================
1.  Wrong namespace. The most expensive mistake there is.
      kubectl config set-context --current --namespace=<ns>
2.  Wrong context/cluster. Every task states one. Switch it first, always.
      kubectl config use-context <ctx>
3.  Manifest metadata.namespace conflicting with -n  -> kubectl refuses.
4.  Cluster-scoped resources ignore -n: nodes, PVs, StorageClasses,
    ClusterRoles, ClusterRoleBindings, IngressClasses, CRDs, namespaces.

=== OBJECT KIND ==============================================================
5.  kubectl run creates a POD, not a Deployment.
6.  "run to completion" -> Job. "on a schedule" -> CronJob.
    "on every node" -> DaemonSet. "stable identity/storage" -> StatefulSet.
    Otherwise -> Deployment.
7.  A Job template must use restartPolicy OnFailure or Never; Always is invalid.
8.  A never-exiting sidecar in a Job must be a NATIVE sidecar
    (initContainers entry + restartPolicy: Always) or the Job never completes.

=== DEFAULTS THAT BITE =======================================================
9.  Service targetPort defaults to port. Set it explicitly, every time.
10. Probe timeoutSeconds defaults to 1 second. Usually too short.
11. Pod restartPolicy defaults to Always - a successful one-shot container
    then crash-loops.
12. imagePullPolicy defaults to Always for :latest, IfNotPresent otherwise.
13. emptyDir with medium: Memory counts against the container memory limit.
14. Pod effective request = max(largest init container, sum of regular
    containers + native sidecars).

=== TYPES AND STRINGS ========================================================
15. ConfigMap/Secret values must be STRINGS: "3", "true", "1.27".
16. Pull secret must be type kubernetes.io/dockerconfigjson
    (kubectl create secret docker-registry), never generic.
17. TLS secret must be type kubernetes.io/tls with keys tls.crt and tls.key.
18. Memory needs a suffix: 512Mi, not 512 (bytes) and not 512M (1000-based).
19. CPU: 100m is 0.1 core; 100 is one hundred cores.
20. Capability names have NO CAP_ prefix: NET_BIND_SERVICE.

=== SUBRESOURCES AND RBAC ====================================================
21. kubectl logs needs pods/log; exec needs pods/exec;
    port-forward needs pods/portforward; scale needs <kind>/scale.
22. A ServiceAccount RBAC subject MUST include its namespace.
23. Deployments are apiGroups: ["apps"], not [""].
24. resourceNames cannot restrict list or create.
25. A ClusterRoleBinding cannot reference a Role.

=== SECURITY CONTEXT LEVELS ==================================================
26. Pod level ONLY: fsGroup, supplementalGroups, sysctls.
27. Container level ONLY: readOnlyRootFilesystem, capabilities, privileged,
    allowPrivilegeEscalation.
28. runAsNonRoot: true without runAsUser fails on a root image.
29. readOnlyRootFilesystem: true needs emptyDir mounts for writable paths.
30. A non-root user cannot bind ports below 1024 without NET_BIND_SERVICE.

=== NETWORKING ===============================================================
31. A bare Service name only resolves within the SAME namespace.
      cross-namespace: <svc>.<ns>  or the full FQDN
32. Unready Pods are never Service endpoints.
33. A default-deny egress NetworkPolicy breaks DNS until you allow port 53
    to kube-system.
34. In a NetworkPolicy from/to block: one list item with two selectors = AND;
    two list items = OR. One hyphen changes the meaning.
35. Ingress requires pathType, uses the nested backend.service shape, and
    can only reference Services in its OWN namespace.
36. An Ingress with an empty ADDRESS means no controller is installed.

=== IMMUTABILITY =============================================================
37. Deployment spec.selector is immutable.
38. Job spec.template is immutable.
39. Most Pod fields are immutable (image is the notable exception).
40. A RoleBinding/ClusterRoleBinding roleRef is immutable.
      All four: kubectl replace --force -f <file>

=== WHERE ERRORS APPEAR ======================================================
41. A quota rejection for a Deployment is a FailedCreate event on the
    REPLICASET. There is no Pending Pod to describe.
42. CrashLoopBackOff logs are in --previous, not the current instance.
43. OOMKilled appears in lastState.terminated.reason with exit code 137;
    nothing appears in the application log.
44. Events expire after about an hour; conditions do not.`,
      explanation:
        'Read this list once slowly, then skim it the day before. Most of these are one line each and cost a whole task when missed.',
    },
    {
      title: 'The pre-flight and post-flight for every task',
      language: 'bash',
      code: `# ---------- BEFORE you type anything (10 seconds) ----------
# 1. Context named in the task?
kubectl config use-context <context-from-task>
# 2. Namespace named in the task?
kubectl config set-context --current --namespace=<ns-from-task>
# 3. Confirm both
kubectl config view --minify -o jsonpath='{.contexts[0].name}{" / "}{..namespace}{"\\n"}'
# 4. Re-read the task and say the OBJECT KIND out loud:
#    Pod? Deployment? Job? CronJob? Service? Which one exactly?

# ---------- AFTER you finish (20 seconds) ----------
# Pick the line that matches what you built:
kubectl rollout status deploy/<name> --timeout=60s          # Deployment
kubectl get endpoints <svc>                                  # Service
kubectl get pods                                             # READY column
kubectl exec <pod> -- printenv <VAR>                         # config
kubectl exec <pod> -- cat <mount>/<file>                     # mounted config
kubectl auth can-i <verb> <res> --as=system:serviceaccount:<ns>:<sa> -n <ns>
kubectl get pvc                                              # STATUS Bound
kubectl get job <name>                                       # COMPLETIONS 1/1
kubectl get cronjob <name>                                   # SCHEDULE, SUSPEND
kubectl describe ingress <name> | grep -A4 Rules             # endpoints present
kubectl get pod <name> -o jsonpath='{.status.qosClass}{"\\n"}' # QoS`,
      explanation:
        'Thirty seconds per task, and it addresses the two largest sources of lost marks directly.',
    },
    {
      title: 'The day-before revision checklist',
      language: 'text',
      code: `SHELL SETUP (be able to type these without thinking)
  alias k=kubectl
  export do="--dry-run=client -o yaml"
  complete -o default -F __start_kubectl k
  vim: set expandtab tabstop=2 shiftwidth=2 autoindent

COMMANDS YOU MUST NOT HESITATE ON
  k run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh
  k create deploy X --image=Y --replicas=N $do > x.yaml
  k expose deploy X --port=80 --target-port=8080
  k create cm X --from-literal=K=V
  k create secret generic X --from-literal=K=V
  k create secret docker-registry X --docker-server=... --docker-username=... --docker-password=...
  k create job X --image=Y -- sh -c '...'
  k create cronjob X --image=Y --schedule="*/5 * * * *" -- date
  k create sa X ; k create role R --verb=... --resource=... ;
    k create rolebinding RB --role=R --serviceaccount=NS:SA
  k create ingress X --class=nginx --rule="host/path*=svc:80"
  k set image deploy/X c=img ; k set env deploy/X K=V ;
    k set resources deploy/X -c=c --requests=... --limits=...
  k rollout status|history|undo|restart deploy/X
  k auth can-i VERB RES --as=system:serviceaccount:NS:SA
  k explain KIND.PATH --recursive
  k replace --force -f file.yaml

YAML BLOCKS YOU SHOULD BE ABLE TO WRITE FROM MEMORY
  readinessProbe / livenessProbe / startupProbe (httpGet, exec, tcpSocket)
  resources.requests and .limits
  volumes: emptyDir / configMap / secret / persistentVolumeClaim
  volumeMounts with subPath and readOnly
  securityContext at Pod level and container level
  env with configMapKeyRef / secretKeyRef / fieldRef / resourceFieldRef
  initContainers, and a native sidecar (restartPolicy: Always)
  NetworkPolicy default-deny, and one allow rule
  PersistentVolumeClaim (accessModes + resources.requests.storage)
  Ingress rule with pathType and the nested backend

API VERSIONS
  v1                            Pod, Service, ConfigMap, Secret, PVC, SA,
                                Namespace, ResourceQuota, LimitRange
  apps/v1                       Deployment, ReplicaSet, StatefulSet, DaemonSet
  batch/v1                      Job, CronJob
  networking.k8s.io/v1          Ingress, IngressClass, NetworkPolicy
  rbac.authorization.k8s.io/v1  Role, ClusterRole, RoleBinding, ClusterRoleBinding
  autoscaling/v2                HorizontalPodAutoscaler
  policy/v1                     PodDisruptionBudget
  discovery.k8s.io/v1           EndpointSlice
  apiextensions.k8s.io/v1       CustomResourceDefinition
  storage.k8s.io/v1             StorageClass

FAILURE SIGNATURES
  Pending             -> scheduler: requests, selectors, taints, unbound PVC
  ImagePullBackOff    -> image name/tag, or missing dockerconfigjson secret
  CrashLoopBackOff    -> app error (logs --previous) OR wrong restartPolicy
  OOMKilled / 137     -> memory LIMIT too low, or app heap larger than limit
  CreateContainerConfigError -> missing ConfigMap/Secret or key
  0/1 Running         -> readiness probe failing
  endpoints <none>    -> selector mismatch, or no Ready Pods
  connection refused  -> wrong targetPort / nothing listening
  connection timeout  -> NetworkPolicy dropping packets
  Forbidden + "cannot <verb>"  -> RBAC
  Forbidden + quota/PodSecurity -> admission control
  Unauthorized (401)  -> credential, not RBAC

ON THE DAY
  - Switch context and set namespace for EVERY task.
  - Generate manifests; do not type boilerplate.
  - Back up before editing: k get X Y -o yaml > /tmp/b.yaml
  - Verify every task with one command.
  - Flag anything over 8 minutes and come back.
  - Never leave a task empty; partial credit is real.`,
      explanation:
        'This is the whole exam distilled into one page. If you can do everything on it comfortably, the remaining variable is time management.',
    },
  ],
  imperative: [
    {
      command:
        'kubectl config view --minify -o jsonpath=\'{.contexts[0].name}{" / "}{..namespace}{"\\n"}\'',
      what: 'Context and namespace in one line - the pre-flight check for every task.',
      expected: 'k8s-c1-a / shop',
    },
    {
      command: 'kubectl get deploy,svc,pod,cm,secret,sa,pvc -n shop',
      what: 'A quick survey that everything a task asked for exists in the right namespace.',
      expected: 'The objects you created.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get all -A | grep <object-name>',
      what: 'Finds an object you created in the wrong namespace - the highest-value recovery command.',
      expected: 'The namespace it actually landed in.',
    },
    {
      command: 'kubectl rollout status deploy/api -n shop --timeout=60s',
      what: 'Deployment verification. Exit code 0 means genuinely rolled out.',
      expected: 'deployment "api" successfully rolled out',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'Service verification. Read both the addresses and the port.',
      expected: 'One IP:targetPort per Ready Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl auth can-i get pods/log --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'RBAC verification, including the subresource that `kubectl logs` needs.',
      expected: 'yes',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command: 'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- printenv LOG_LEVEL',
      what: 'Config verification - what the container actually received.',
      expected: 'The value you configured.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{.status.qosClass}{"\\n"}\'',
      what: 'Resource verification: Guaranteed requires requests == limits on every container.',
      expected: 'Guaranteed, Burstable or BestEffort.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl get pods -A | grep -vE "Running|Completed"',
      what: 'The final sweep. Anything listed here is worth thirty more seconds.',
      expected: 'No output.',
    },
    {
      command:
        'kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp | tail -10',
      what: 'Catches admission rejections and probe failures across every task at once.',
      expected: 'Nothing recent.',
    },
    {
      command: 'kubectl describe rs -n shop | grep -A3 FailedCreate',
      what: 'Where a quota or admission rejection hides when a Deployment has no Pods at all.',
      expected: 'Nothing, or the Forbidden message.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl replace --force -f /tmp/backup.yaml',
      what: 'The universal fix for an immutable-field error, and the undo for a bad edit.',
      expected: 'deleted then replaced.',
    },
  ],
  declarative: {
    steps: [
      'Read the task twice: once for the objective, once for the context, namespace and object kind.',
      'Set context and namespace before typing anything else.',
      'Generate the object rather than hand-writing boilerplate.',
      'Back up before editing anything that already exists.',
      'Run exactly one verification command that proves the requirement.',
      'If it does not verify, fix it now - not in the final sweep, when there may be no time.',
      'Reserve the last ten minutes for the whole-exam sweep: contexts, namespaces, unhealthy Pods, empty endpoints, warning events.',
    ],
    code: [
      {
        title: 'The whole-exam final sweep',
        language: 'bash',
        code: `# Run once per context you worked in, in the last 10 minutes.

kubectl config get-contexts

echo "=== unhealthy pods ==="
kubectl get pods -A | grep -vE 'Running|Completed|NAME'

echo "=== deployments not fully ready ==="
kubectl get deploy -A -o custom-columns='NS:.metadata.namespace,NAME:.metadata.name,READY:.status.readyReplicas,WANT:.spec.replicas' \\
  | awk 'NR>1 && $3 != $4'

echo "=== services with no endpoints ==="
kubectl get endpoints -A | grep '<none>'

echo "=== jobs not complete ==="
kubectl get jobs -A 2>/dev/null | grep -v 'Complete' | grep -v NAME

echo "=== pvcs not bound ==="
kubectl get pvc -A 2>/dev/null | grep -v Bound | grep -v NAME

echo "=== recent warnings ==="
kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp 2>/dev/null | tail -10`,
        explanation: 'Six checks, under a minute, and each one maps to a class of silent failure.',
      },
    ],
  },
  verification: [
    {
      command: 'kubectl config view --minify -o jsonpath=\'{..namespace}{"\\n"}\'',
      what: 'The check that prevents the single most expensive mistake.',
      expected: 'The namespace the task named.',
    },
    {
      command: 'kubectl get pods -A | grep -vE "Running|Completed"',
      what: 'Whole-cluster health in one line.',
      expected: 'No output.',
    },
    {
      command: 'kubectl get endpoints -A | grep "<none>"',
      what: 'Every Service that routes nowhere.',
      expected: 'Only expected headless or selector-less Services.',
    },
    {
      command:
        'kubectl get deploy -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,READY:.status.readyReplicas,WANT:.spec.replicas',
      what: 'Ready versus desired for every Deployment.',
      expected: 'The two numbers equal on everything you touched.',
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get all -A | grep <name>',
      what: '"The object does not exist" is almost always "the object is in another namespace".',
      expected: 'The object with its real namespace.',
    },
    {
      command: 'kubectl describe rs -n shop | grep -A5 FailedCreate',
      what: 'A Deployment with zero Pods and no Pending Pod means admission rejected them; the event is here.',
      expected: 'The Forbidden message naming the quota or policy.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl logs <pod> -n shop --previous',
      what: 'The only place a crash-looping container error is visible.',
      expected: 'The fatal error.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pod <pod> -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{" "}{.status.containerStatuses[0].lastState.terminated.exitCode}{"\\n"}\'',
      what: 'Separates an application failure (Error, 1) from an OOM kill (OOMKilled, 137).',
      expected: 'The reason and exit code.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl auth can-i create pods -n shop',
      what: 'A `yes` alongside a Forbidden error means admission control, not RBAC.',
      expected: 'yes or no.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Not setting the namespace, and doing correct work in `default`.',
    'Not switching context, and doing correct work in the wrong cluster.',
    'Creating a Deployment when the task said Pod, or a Pod when it said Job.',
    'Omitting `targetPort` on a Service whose container port differs from the Service port.',
    'Granting `get pods` and expecting `kubectl logs` to work - it needs `pods/log`.',
    'Unquoted numbers or booleans in ConfigMap and Secret data.',
    'Using `kubectl create secret generic` for a registry pull secret.',
    'Putting `readOnlyRootFilesystem` at Pod level or `fsGroup` at container level.',
    'A default-deny egress NetworkPolicy with no DNS rule.',
    'Fighting an immutable field with `kubectl edit` instead of `replace --force`.',
    'Not verifying, so a task that silently failed is scored as failed.',
    'Spending fifteen minutes on one task and leaving two untouched.',
  ],
  examTips: [
    'Three questions before every task: which context, which namespace, which object kind.',
    'One verification command after every task. Choose it from the per-domain list.',
    '`kubectl get all -A | grep <name>` is the fastest recovery when something "does not exist".',
    '`kubectl replace --force -f` is the answer to every immutable-field error.',
    'Reserve the last ten minutes for the six-check final sweep; it routinely finds a lost mark.',
    'When in doubt about a field name, `kubectl explain` before the docs.',
    'Read the task text for the exact words: "Pod", "Deployment", "in namespace X", "on port Y". They are all graded.',
  ],
  summary: [
    'Marks are lost to wrong place, wrong object kind, and lack of verification - not to lack of knowledge.',
    'Pre-flight: context, namespace, object kind. Post-flight: one verification command.',
    'Know the defaults that bite: targetPort, probe timeout 1s, restartPolicy Always, memory suffixes.',
    'Know the types that are contracts: dockerconfigjson, kubernetes.io/tls, string-only ConfigMap values.',
    'Know where errors hide: ReplicaSet events for quota, `--previous` logs for crash loops, conditions after events expire.',
    '`replace --force -f` handles every immutable field; partial credit means never leaving a task blank.',
  ],
  practice: [
    {
      id: 'trap-p1',
      level: 'beginner',
      prompt:
        'A task says "in namespace production, create a Deployment named api". What are the first two commands you run?',
      answer:
        "kubectl config use-context <context-named-in-task>\nkubectl config set-context --current --namespace=production\n\nThen confirm: `kubectl config view --minify -o jsonpath='{..namespace}'`",
      explanation:
        'Setting the namespace on the context means every subsequent command in that task is in the right place without `-n`, which removes the single most expensive class of mistake.',
    },
    {
      id: 'trap-p2',
      level: 'intermediate',
      prompt:
        'You created a Deployment, a Service and a ServiceAccount with a Role. Name the one verification command for each.',
      answer:
        'Deployment: `kubectl rollout status deploy/<name> --timeout=60s`\nService: `kubectl get endpoints <name>` (non-empty, and check the port)\nRBAC: `kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa> -n <ns>`',
      explanation:
        'Each of these fails independently of whether the object exists. A Deployment can exist with zero Ready Pods, a Service with no endpoints, and a Role that grants nothing the task asked for.',
    },
    {
      id: 'trap-p3',
      level: 'advanced',
      prompt:
        'A Deployment exists but `kubectl get pods` shows nothing at all - not even Pending. Where is the error, and what causes this?',
      answer:
        'On the ReplicaSet, as a `FailedCreate` event:\n`kubectl describe rs -n <ns> | grep -A5 FailedCreate`\n\nThe Pods were rejected at admission, so no Pod objects were ever created - there is nothing to describe. The usual causes are a ResourceQuota (requiring resources the template does not set, or the namespace total being exceeded) or Pod Security Admission rejecting the Pod template.',
      explanation:
        'This is the trap that wastes the most time, because the instinct is to look for a Pending Pod. Remember: no Pods at all means admission; a Pending Pod means the scheduler.',
    },
  ],
  lab: {
    title: 'Walk into every trap once, deliberately',
    scenario:
      'You will reproduce eight of the most expensive traps on purpose, see the exact symptom each produces, and practise the verification command that catches it. Meeting them here means recognising them in the exam.',
    prerequisites: ['A cluster where you can create namespaces, quotas and RBAC objects'],
    tasks: [
      {
        instruction:
          'Create namespaces `trap-lab` and `trap-other`, and set `trap-lab` as default.',
      },
      {
        instruction:
          'Trap 1 (namespace): create a Pod without -n while the context points at trap-other, then find it with the recovery command.',
      },
      {
        instruction:
          'Trap 2 (object kind): run a one-shot command as a Deployment and watch it crash-loop despite succeeding.',
      },
      {
        instruction:
          'Trap 3 (targetPort): expose a Deployment whose container is on 8080 with no targetPort, and read the endpoints.',
      },
      {
        instruction:
          'Trap 4 (subresource): create a Role with get on pods and prove pods/log is still denied.',
      },
      {
        instruction:
          'Trap 5 (string types): apply a ConfigMap with an unquoted number and read the error.',
      },
      {
        instruction:
          'Trap 6 (securityContext level): put readOnlyRootFilesystem at Pod level and read the validation error.',
      },
      {
        instruction:
          'Trap 7 (quota with no Pods): add a quota, create a Deployment with no resources, and find the FailedCreate event.',
      },
      {
        instruction:
          'Trap 8 (immutable field): try to change a Deployment selector, then fix it with replace --force.',
      },
      { instruction: 'Run the six-check final sweep, then delete both namespaces.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the namespace trap',
        language: 'bash',
        code: `kubectl create namespace trap-lab
kubectl create namespace trap-other
kubectl config set-context --current --namespace=trap-other   # deliberately wrong

# "Create a Pod named misplaced in namespace trap-lab"  <- the task
kubectl run misplaced --image=nginx:1.27-alpine               # no -n !

kubectl get pod misplaced -n trap-lab
# Error from server (NotFound): pods "misplaced" not found
#   ^ the grader would see exactly this

# THE RECOVERY COMMAND
kubectl get pods -A | grep misplaced
# trap-other   misplaced   1/1   Running   0   20s
#   ^ found it

# Fix: set the namespace, then recreate
kubectl delete pod misplaced -n trap-other
kubectl config set-context --current --namespace=trap-lab
kubectl config view --minify -o jsonpath='{..namespace}{"\\n"}'
# trap-lab
kubectl run misplaced --image=nginx:1.27-alpine
kubectl get pod misplaced -n trap-lab   # now correct`,
      },
      {
        title: 'Steps 3-4 - object kind, and targetPort',
        language: 'bash',
        code: `# Trap 2: a one-shot job modelled as a Deployment
kubectl create deployment oneshot --image=busybox:1.36 -- sh -c 'echo migrating; exit 0'
sleep 30
kubectl get pods -l app=oneshot
# oneshot-...   0/1   CrashLoopBackOff   3   30s
kubectl get pod -l app=oneshot -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.exitCode}{"\\n"}'
# 0        <- it SUCCEEDED every time; restartPolicy Always is the bug
kubectl delete deployment oneshot
kubectl create job oneshot --image=busybox:1.36 -- sh -c 'echo migrating'
kubectl wait --for=condition=complete job/oneshot --timeout=120s
kubectl get job oneshot        # Complete 1/1

# Trap 3: missing targetPort
kubectl create configmap p8080 --from-literal=default.conf='server { listen 8080; location / { return 200 "ok\\n"; } }'
cat <<'YAML_END' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata: {name: web, namespace: trap-lab}
spec:
  replicas: 1
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}
    spec:
      volumes:
        - name: c
          configMap: {name: p8080}
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - {containerPort: 8080}
          volumeMounts:
            - {name: c, mountPath: /etc/nginx/conf.d}
YAML_END
kubectl rollout status deploy/web --timeout=120s

kubectl create service clusterip web --tcp=80:80    # WRONG: 80->80
kubectl get endpoints web
# web   10.244.1.9:80        <- port 80, container listens on 8080
kubectl run t --rm -i --restart=Never --image=busybox:1.36 -- nc -zv -w3 web 80 2>&1 | tail -1
# Connection refused

kubectl patch svc web -p '{"spec":{"ports":[{"name":"80-80","port":80,"targetPort":8080}]}}'
kubectl get endpoints web
# web   10.244.1.9:8080      <- fixed`,
      },
      {
        title: 'Steps 5-6 - the RBAC subresource, and string types',
        language: 'bash',
        code: `# Trap 4: pods/log
kubectl create serviceaccount reader
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding reader-b --role=pod-reader --serviceaccount=trap-lab:reader

SA=system:serviceaccount:trap-lab:reader
kubectl auth can-i get pods --as=$SA           # yes
kubectl auth can-i get pods/log --as=$SA       # no   <- the trap

kubectl create role log-reader --verb=get --resource=pods/log
kubectl create rolebinding log-b --role=log-reader --serviceaccount=trap-lab:reader
kubectl auth can-i get pods/log --as=$SA       # yes

# Trap 5: unquoted values in a ConfigMap
cat <<'YAML_END' | kubectl apply -f - || true
apiVersion: v1
kind: ConfigMap
metadata: {name: bad-types, namespace: trap-lab}
data:
  MAX_RETRIES: 3
  ENABLED: true
YAML_END
# error: ... invalid type for io.k8s.api.core.v1.ConfigMap.data:
#        got "integer", expected "string"

cat <<'YAML_END' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata: {name: good-types, namespace: trap-lab}
data:
  MAX_RETRIES: "3"
  ENABLED: "true"
YAML_END
# configmap/good-types created`,
      },
      {
        title: 'Steps 7-8 - securityContext level, and the hidden quota error',
        language: 'bash',
        code: `# Trap 6: wrong securityContext level
cat <<'YAML_END' | kubectl apply -f - || true
apiVersion: v1
kind: Pod
metadata: {name: wrong-level, namespace: trap-lab}
spec:
  securityContext:
    readOnlyRootFilesystem: true      # CONTAINER-level field at POD level
  containers:
    - name: c
      image: nginx:1.27-alpine
YAML_END
# error: ... unknown field "spec.securityContext.readOnlyRootFilesystem"

kubectl explain pod.spec.securityContext | grep -E 'fsGroup|runAs' | head -3
kubectl explain pod.spec.containers.securityContext | grep -E 'readOnly|capabilities|privileged'

# Trap 7: a Deployment with NO Pods at all
kubectl create quota strict --hard=requests.cpu=1,requests.memory=1Gi
kubectl create deployment quota-victim --image=nginx:1.27-alpine --replicas=2
sleep 10

kubectl get deploy quota-victim
# READY 0/2
kubectl get pods -l app=quota-victim
# No resources found            <- nothing to describe!

RS=$(kubectl get rs -l app=quota-victim -o jsonpath='{.items[0].metadata.name}')
kubectl describe rs "$RS" | grep -A3 FailedCreate
# Error creating: pods "..." is forbidden: failed quota: strict:
# must specify requests.cpu,requests.memory
#   ^ THE ERROR WAS ON THE REPLICASET`,
      },
      {
        title: 'Steps 9-10 - immutability, the sweep, and cleanup',
        language: 'bash',
        code: `# Trap 8: an immutable field
kubectl get deploy web -o yaml > /tmp/web.backup.yaml     # back up FIRST
kubectl patch deploy web -p '{"spec":{"selector":{"matchLabels":{"app":"web2"}}}}' || true
# The Deployment "web" is invalid: spec.selector: Invalid value: ...
# field is immutable

# The escape hatch
sed 's/app: web$/app: web2/g' /tmp/web.backup.yaml > /tmp/web2.yaml
kubectl replace --force -f /tmp/web2.yaml
# deployment.apps "web" deleted
# deployment.apps/web replaced
kubectl rollout status deploy/web --timeout=120s
kubectl get deploy web -o jsonpath='{.spec.selector.matchLabels}{"\\n"}'

# THE FINAL SWEEP
echo "=== context/namespace ==="
kubectl config view --minify -o jsonpath='{..namespace}{"\\n"}'
echo "=== unhealthy pods ==="
kubectl get pods -n trap-lab | grep -vE 'Running|Completed|NAME' || echo "  none"
echo "=== deployments not ready ==="
kubectl get deploy -n trap-lab -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,WANT:.spec.replicas'
echo "=== empty endpoints ==="
kubectl get endpoints -n trap-lab | grep '<none>' || echo "  none"
echo "=== warnings ==="
kubectl get events -n trap-lab --field-selector type=Warning --sort-by=.lastTimestamp | tail -5

kubectl config set-context --current --namespace=default
kubectl delete namespace trap-lab trap-other
rm -f /tmp/web.backup.yaml /tmp/web2.yaml`,
      },
    ],
    verification: [
      {
        command: 'kubectl get endpoints web -n trap-lab',
        what: 'After the targetPort fix, the endpoint port must be 8080.',
        expected: 'An IP:8080 entry.',
      },
      {
        command:
          'kubectl auth can-i get pods/log --as=system:serviceaccount:trap-lab:reader -n trap-lab',
        what: 'Confirms the subresource trap is resolved.',
        expected: 'yes',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace trap-lab trap-other',
        what: 'Removes every object from the lab.',
        expected: 'Two "deleted" lines.',
      },
    ],
  },
  relatedTopicIds: ['efficient-kubectl', 'using-docs-and-time', 'pod-failure-modes'],
  docs: [
    {
      title: 'kubectl cheat sheet',
      url: 'https://kubernetes.io/docs/reference/kubectl/quick-reference/',
    },
    {
      title: 'CKAD exam page (curriculum and logistics)',
      url: 'https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/',
    },
    {
      title: 'CKA/CKAD/CKS FAQ',
      url: 'https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks',
    },
  ],
}
