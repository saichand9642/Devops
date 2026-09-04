import type { Question } from '../../types'

export const observabilityQuestions: Question[] = [
  {
    id: 'obs-q01',
    domainId: 'observability',
    topicId: 'container-logs',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Pod checkout in namespace shop is in CrashLoopBackOff and `kubectl logs checkout -n shop` prints nothing. Write the command that shows the log of the instance that failed.',
    acceptedAnswers: [
      'kubectl logs checkout -n shop --previous',
      'kubectl logs checkout --previous -n shop',
      'kubectl logs -p checkout -n shop',
      'kubectl logs checkout -n shop -p',
      'kubectl -n shop logs checkout --previous',
    ],
    answerHint: 'kubectl logs ...',
    explanation:
      'The current instance is in its restart backoff and has not logged yet. `--previous` (or `-p`) reads the instance before the last restart. Whenever the RESTARTS column is greater than zero, this is the log you want.',
  },
  {
    id: 'obs-q02',
    domainId: 'observability',
    topicId: 'container-logs',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Pod is Running and its application is definitely writing log messages, but `kubectl logs` returns nothing. What is the most likely cause?',
    options: [
      { id: 'a', text: 'The Pod has no logging sidecar' },
      { id: 'b', text: 'The application writes to a file instead of stdout/stderr' },
      { id: 'c', text: 'Log rotation has removed the output' },
      { id: 'd', text: 'kubectl needs the --all-containers flag' },
    ],
    correct: ['b'],
    explanation:
      "Kubernetes collects only stdout and stderr. An application writing to `/var/log/app.log` produces no `kubectl logs` output at all. Confirm with `kubectl exec <pod> -- ls -l /var/log`. The Kubernetes-native fix is a sidecar that tails the file so its content becomes the sidecar's stdout.",
  },
  {
    id: 'obs-q03',
    domainId: 'observability',
    topicId: 'container-logs',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that shows the last 30 log lines from every Pod labelled app=api in namespace shop, with each line identifying its Pod.',
    acceptedAnswers: [
      'kubectl logs -l app=api -n shop --tail=30 --prefix',
      'kubectl logs -l app=api --tail=30 --prefix -n shop',
      'kubectl logs -n shop -l app=api --tail=30 --prefix',
      'kubectl logs --prefix --tail=30 -l app=api -n shop',
    ],
    answerHint: 'kubectl logs -l ...',
    explanation:
      'A selector-based read defaults to only 10 lines per Pod, so `--tail=30` is required. `--prefix` adds `[pod/<name>/<container>]` to each line, which is essential once several Pods are interleaved. `kubectl logs deployment/api` would read only one Pod.',
  },
  {
    id: 'obs-q04',
    domainId: 'observability',
    topicId: 'probes',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Which probe removes a Pod from Service endpoints on failure without restarting the container?',
    options: [
      { id: 'a', text: 'livenessProbe' },
      { id: 'b', text: 'readinessProbe' },
      { id: 'c', text: 'startupProbe' },
      { id: 'd', text: 'All three do' },
    ],
    correct: ['b'],
    explanation:
      'Readiness gates traffic: on failure the Pod is excluded from endpoints but keeps running, which shows as `0/1 Running`. Liveness restarts the container. Startup suspends the other two until it first succeeds and then never runs again.',
  },
  {
    id: 'obs-q05',
    domainId: 'observability',
    topicId: 'probes',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'During a 40-second database outage, every replica of a service restarted simultaneously. The application logs show no errors. What is the design fault?',
    options: [
      { id: 'a', text: 'The readiness probe interval was too short' },
      { id: 'b', text: 'The liveness probe checked the database' },
      { id: 'c', text: 'No startup probe was configured' },
      { id: 'd', text: 'maxUnavailable was set too high' },
    ],
    correct: ['b'],
    explanation:
      "A liveness probe that checks a dependency turns every dependency outage into a mass restart - and restarting cannot fix someone else's outage. Liveness should test only that this process is responsive; dependency checks belong in the readiness probe, where failure stops traffic without killing the container.",
  },
  {
    id: 'obs-q06',
    domainId: 'observability',
    topicId: 'probes',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'An application takes up to four minutes to start. Which configuration allows that while keeping liveness detection at about 30 seconds afterwards?',
    options: [
      { id: 'a', text: 'livenessProbe with initialDelaySeconds: 240 and failureThreshold: 3' },
      {
        id: 'b',
        text: 'startupProbe with periodSeconds: 10 and failureThreshold: 24, plus a normal livenessProbe',
      },
      { id: 'c', text: 'readinessProbe with initialDelaySeconds: 240' },
      { id: 'd', text: 'livenessProbe with timeoutSeconds: 240' },
    ],
    correct: ['b'],
    explanation:
      'The startup budget is `periodSeconds × failureThreshold` = 240 seconds. While the startup probe is failing, the liveness and readiness probes are suspended, so the liveness probe can stay tight (10 × 3 = 30s) once startup succeeds. Option A leaves the container unprotected for the whole four minutes.',
  },
  {
    id: 'obs-q07',
    domainId: 'observability',
    topicId: 'probes',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What is the default value of `timeoutSeconds` on a probe, and why does it matter?',
    options: [
      { id: 'a', text: '1 second - a health endpoint that is slow under load fails every probe' },
      { id: 'b', text: '10 seconds - matching periodSeconds' },
      { id: 'c', text: '3 seconds - the same as failureThreshold' },
      { id: 'd', text: '30 seconds - the same as the termination grace period' },
    ],
    correct: ['a'],
    explanation:
      '`timeoutSeconds` defaults to 1, which is the most commonly missed probe default. An endpoint that takes 1.2 seconds under load will fail every check, causing spurious restarts or endpoint removal. Set it explicitly - usually 2 to 5 seconds - whenever you write a probe.',
  },
  {
    id: 'obs-q08',
    domainId: 'observability',
    topicId: 'pod-failure-modes',
    category: 'troubleshoot',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write a single command that prints the termination reason of the previous instance of container 0 in Pod api in namespace shop, so you can tell an application error from an OOM kill.',
    acceptedAnswers: [
      "kubectl get pod api -n shop -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'",
      'kubectl get pod api -n shop -o jsonpath="{.status.containerStatuses[0].lastState.terminated.reason}"',
      'kubectl get pod api -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{"\\n"}\'',
    ],
    answerHint: "kubectl get pod api -n shop -o jsonpath='...'",
    explanation:
      '`Error` with exit code 1 means the application failed; `OOMKilled` with exit code 137 means the kernel killed it for exceeding `limits.memory`. The fixes are unrelated, which is why CrashLoopBackOff alone is not a diagnosis. `kubectl describe pod` shows the same information in its "Last State" block.',
  },
  {
    id: 'obs-q09',
    domainId: 'observability',
    topicId: 'pod-failure-modes',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt: 'A container exits with code 137. What does that indicate?',
    options: [
      { id: 'a', text: 'The application returned an error' },
      { id: 'b', text: 'The container was killed with SIGKILL, most often an OOM kill' },
      { id: 'c', text: 'The command was not found in the image' },
      { id: 'd', text: 'The container received SIGTERM and shut down cleanly' },
    ],
    correct: ['b'],
    explanation:
      '137 is 128 + 9 (SIGKILL). In Kubernetes it almost always means the memory limit was exceeded - check `lastState.terminated.reason` for `OOMKilled`. For reference: 1 is an application error, 127 is "command not found", and 143 is 128 + 15 (SIGTERM).',
  },
  {
    id: 'obs-q10',
    domainId: 'observability',
    topicId: 'pod-failure-modes',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'A Pod is stuck in `CreateContainerConfigError`. What does this mean?',
    options: [
      { id: 'a', text: 'The image could not be pulled' },
      { id: 'b', text: 'A referenced ConfigMap, Secret or key does not exist' },
      { id: 'c', text: 'The scheduler could not find a node' },
      { id: 'd', text: 'The container command is invalid' },
    ],
    correct: ['b'],
    explanation:
      'The Pod was scheduled and the image is available, but a referenced ConfigMap or Secret is missing. The exact name is in `status.containerStatuses[0].state.waiting.message`. The kubelet keeps retrying, so creating the missing object fixes the Pod without a restart.',
  },
  {
    id: 'obs-q11',
    domainId: 'observability',
    topicId: 'describe-and-events',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Write the command that lists only Warning events in namespace shop, ordered so the newest is last.',
    acceptedAnswers: [
      'kubectl get events -n shop --field-selector type=Warning --sort-by=.lastTimestamp',
      'kubectl get events --field-selector type=Warning --sort-by=.lastTimestamp -n shop',
      'kubectl get events -n shop --sort-by=.lastTimestamp --field-selector type=Warning',
      'kubectl -n shop get events --field-selector type=Warning --sort-by=.lastTimestamp',
    ],
    answerHint: 'kubectl get events ...',
    explanation:
      'Without `--sort-by` the event order is not chronological, which misleads people constantly. Events also expire after about an hour by default, so an empty list is not proof that nothing went wrong - fall back to `status.conditions` for older problems.',
  },
  {
    id: 'obs-q12',
    domainId: 'observability',
    topicId: 'describe-and-events',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A Deployment reports 0/3 replicas and `kubectl get pods` returns nothing at all - not even Pending. Where is the error?',
    options: [
      { id: 'a', text: 'In the Deployment events' },
      { id: 'b', text: 'In the ReplicaSet events, as a FailedCreate' },
      { id: 'c', text: 'In the kubelet logs' },
      { id: 'd', text: 'In the scheduler events' },
    ],
    correct: ['b'],
    explanation:
      'No Pods at all means they were rejected at admission, so no Pod object exists to describe. The ReplicaSet controller records the rejection as a `FailedCreate` event containing the exact Forbidden message - usually a ResourceQuota requiring resources the template does not set, or Pod Security Admission. A *Pending* Pod would instead mean the scheduler.',
  },
  {
    id: 'obs-q13',
    domainId: 'observability',
    topicId: 'monitoring-cli-tools',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Write the command that shows which Pod in namespace shop is using the most CPU.',
    acceptedAnswers: [
      'kubectl top pods -n shop --sort-by=cpu',
      'kubectl top pod -n shop --sort-by=cpu',
      'kubectl top pods --sort-by=cpu -n shop',
      'kubectl -n shop top pods --sort-by=cpu',
    ],
    answerHint: 'kubectl top ...',
    explanation:
      'Highest usage is listed first. Add `--containers` to break a multi-container Pod down. This needs the metrics-server add-on; without it `kubectl top` errors with "Metrics API not available".',
  },
  {
    id: 'obs-q14',
    domainId: 'observability',
    topicId: 'monitoring-cli-tools',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      '`kubectl describe node worker-1` shows CPU requests at 95% while `kubectl top node worker-1` shows 10% CPU usage. What does this mean?',
    options: [
      { id: 'a', text: 'metrics-server is reporting incorrectly' },
      {
        id: 'b',
        text: 'Pods have reserved far more CPU than they use, so the node is full for scheduling but idle in practice',
      },
      { id: 'c', text: 'The node is throttling every container' },
      { id: 'd', text: 'The node is about to be evicted' },
    ],
    correct: ['b'],
    explanation:
      'Requests are a scheduling reservation; usage is reality. A node at 95% requested will refuse new CPU-requesting Pods regardless of how idle it is. The fix is smaller requests sized from measured usage, not more nodes.',
  },
  {
    id: 'obs-q15',
    domainId: 'observability',
    topicId: 'api-deprecations',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'An apply fails with `no matches for kind "Ingress" in version "extensions/v1beta1"`. Besides the apiVersion, what else usually has to change?',
    options: [
      { id: 'a', text: 'Nothing - only the apiVersion' },
      { id: 'b', text: 'The backend shape becomes nested and pathType becomes required' },
      { id: 'c', text: 'The metadata.name must become a DNS subdomain' },
      { id: 'd', text: 'The Service must be recreated' },
    ],
    correct: ['b'],
    explanation:
      'In `networking.k8s.io/v1` the flat `serviceName`/`servicePort` fields became `backend.service.name` and `backend.service.port.number`, `pathType` became mandatory, and the `kubernetes.io/ingress.class` annotation was replaced by `spec.ingressClassName`. `kubectl explain ingress.spec.rules.http.paths --api-version=networking.k8s.io/v1` lists the new shape.',
  },
  {
    id: 'obs-q16',
    domainId: 'observability',
    topicId: 'debugging-pods',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Pod api in namespace shop runs a distroless image with no shell, so `kubectl exec` fails. Write the command that attaches an interactive busybox:1.36 debug container to the running Pod, targeting the container named app.',
    acceptedAnswers: [
      'kubectl debug -it api -n shop --image=busybox:1.36 --target=app',
      'kubectl debug api -it -n shop --image=busybox:1.36 --target=app',
      'kubectl debug -it api --image=busybox:1.36 --target=app -n shop',
      'kubectl -n shop debug -it api --image=busybox:1.36 --target=app',
    ],
    answerHint: 'kubectl debug ...',
    explanation:
      "An ephemeral container shares the Pod's network namespace, so `localhost` reaches the application exactly as the app would see it. `--target` additionally shares the target container's process namespace. Ephemeral containers cannot be removed - they live until the Pod does.",
  },
  {
    id: 'obs-q17',
    domainId: 'observability',
    topicId: 'debugging-pods',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      '`kubectl port-forward` to a Pod works, but no other Pod can reach its Service. Which layers remain as candidates?',
    options: [
      { id: 'a', text: 'The application, the container image and the node' },
      { id: 'b', text: 'DNS, the Service selector or ports, and NetworkPolicy' },
      { id: 'c', text: 'Only the container runtime' },
      { id: 'd', text: 'The scheduler and the kubelet' },
    ],
    correct: ['b'],
    explanation:
      'port-forward goes through the API server, bypassing DNS, the Service, kube-proxy and NetworkPolicies - so a working port-forward proves the application is healthy and eliminates it. That leaves exactly three candidates, checked with `nslookup`, `kubectl get endpoints` and `kubectl get networkpolicies`.',
  },
  {
    id: 'obs-q18',
    domainId: 'observability',
    topicId: 'probes',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create a Deployment named web with 2 replicas of nginx:1.27-alpine that has: a readiness probe on / port 80 with a 2 second timeout that fails after 2 consecutive failures; a liveness probe on / port 80 checked every 15 seconds; and a startup probe allowing up to 60 seconds for the container to begin serving.',
    context: 'Namespace shop exists.',
    checkpoints: [
      { id: 'c1', text: 'Deployment web exists in shop with 2 replicas and reports READY 2/2' },
      {
        id: 'c2',
        text: 'readinessProbe has httpGet / on port 80, timeoutSeconds 2 and failureThreshold 2',
      },
      { id: 'c3', text: 'livenessProbe has httpGet / on port 80 with periodSeconds 15' },
      { id: 'c4', text: 'startupProbe periodSeconds × failureThreshold is at least 60' },
      {
        id: 'c5',
        text: '`kubectl get endpoints` for a Service selecting these Pods lists both addresses',
      },
    ],
    explanation:
      'Probes have no imperative flags, so generate the Deployment and edit the YAML. Naming the container port and referencing it by name in each probe keeps the three blocks consistent if the port number ever changes.',
    solution: [
      {
        title: 'web.yaml',
        language: 'yaml',
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - name: http
              containerPort: 80
          startupProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            failureThreshold: 12 # 5 x 12 = 60s of boot time
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 3`,
      },
      {
        title: 'Apply and verify',
        language: 'bash',
        code: `kubectl apply -f web.yaml
kubectl rollout status deploy/web -n shop --timeout=180s

kubectl get pods -n shop -l app=web
# READY 1/1 for both

kubectl describe pod -n shop -l app=web | grep -E 'Liveness|Readiness|Startup'
# Startup:    http-get http://:http/ delay=0s timeout=1s period=5s #success=1 #failure=12
# Liveness:   http-get http://:http/ delay=0s timeout=3s period=15s #success=1 #failure=3
# Readiness:  http-get http://:http/ delay=0s timeout=2s period=5s #success=1 #failure=2`,
      },
    ],
  },
]
