import type { Topic } from '../../../types'

export const probes: Topic = {
  id: 'probes',
  title: 'Liveness, readiness and startup probes',
  domainId: 'observability',
  difficulty: 'intermediate',
  estimatedMinutes: 26,
  order: 3,
  tags: ['livenessProbe', 'readinessProbe', 'startupProbe', 'httpGet', 'exec', 'tcpSocket', 'grpc'],
  oneLiner:
    'Three probes with three different jobs, four handler types, and the timing fields that decide whether a probe protects your app or kills it.',
  explanation: [
    'A probe is a periodic check the **kubelet** runs against a container. There are three kinds, and they do genuinely different things:',
    '**readinessProbe** - "should this Pod receive traffic?" On failure the Pod is removed from Service endpoints but the container keeps running. This is the probe that makes rolling updates and load balancing correct.',
    '**livenessProbe** - "is this container wedged?" On failure the kubelet **kills and restarts the container**. Use it for deadlocks and unrecoverable states, not for slow dependencies.',
    '**startupProbe** - "has this container finished booting?" While it is failing, the liveness and readiness probes are suspended. Once it succeeds it never runs again. This is how you give a slow-starting application time without weakening its liveness probe forever.',
    'Each probe uses one of four handlers: `httpGet` (2xx/3xx is success), `tcpSocket` (a successful connection is success), `exec` (exit code 0 is success), or `grpc` (the standard gRPC health checking protocol). Exactly one handler per probe.',
  ],
  whyItMatters: [
    '"Implement probes and health checks" is a named curriculum competency, and probes are the most common thing an exam task asks you to *add* to an existing Deployment.',
    'The readiness probe is what makes every other availability feature real: rolling updates, `maxUnavailable`, canary splits and Service load balancing all depend on the Ready condition.',
    'A badly configured liveness probe is worse than none at all - it turns a slow application into a restart loop, and it is a genuinely common production outage.',
  ],
  howItWorks: [
    'Timing fields: `initialDelaySeconds` (wait before the first check, default 0), `periodSeconds` (how often, default 10), `timeoutSeconds` (how long to wait for a response, default 1), `successThreshold` (consecutive successes needed, default 1, must be 1 for liveness and startup), `failureThreshold` (consecutive failures before acting, default 3).',
    'Worst-case time before a liveness restart = `initialDelaySeconds + periodSeconds × failureThreshold`. With defaults that is 30 seconds; with `periodSeconds: 5, failureThreshold: 2` it is 10.',
    'Startup probe budget = `periodSeconds × failureThreshold`. The idiomatic slow-start configuration is `periodSeconds: 10, failureThreshold: 30`, giving 300 seconds to boot while keeping a tight liveness probe afterwards.',
    '`timeoutSeconds` defaults to **1 second**, which is the most commonly missed default. A health endpoint that takes 1.2 seconds under load fails every probe.',
    'Readiness failures affect endpoints immediately: the endpoints controller removes the Pod IP from the Service, so traffic stops. Liveness failures restart the container, which increments `restartCount` and produces a `Unhealthy` then `Killing` event.',
    "Probes run from the node against the container's IP, not through a Service. `httpGet.host` defaults to the Pod IP; a named `port` from `containerPort` works and is more readable than a number.",
    'A container with no probes is considered Ready as soon as the process starts, which is almost never the truth for a real application.',
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Carries the three probes per container.',
      fields: [
        {
          path: 'spec.containers[].readinessProbe',
          meaning: 'Gates Service traffic. Failure removes the Pod from endpoints.',
        },
        { path: 'spec.containers[].livenessProbe', meaning: 'Restarts the container on failure.' },
        {
          path: 'spec.containers[].startupProbe',
          meaning: 'Suspends the other two until it first succeeds.',
        },
        {
          path: '...Probe.httpGet.path / .port / .scheme / .httpHeaders',
          meaning:
            'HTTP handler. 2xx-3xx is success. Port may be a number or a named containerPort.',
        },
        {
          path: '...Probe.tcpSocket.port',
          meaning: 'TCP handler. A successful connect is success.',
        },
        {
          path: '...Probe.exec.command[]',
          meaning: 'Exec handler. Exit code 0 is success. Runs inside the container.',
        },
        {
          path: '...Probe.grpc.port / .service',
          meaning: 'gRPC health checking protocol handler.',
        },
        {
          path: '...Probe.initialDelaySeconds',
          meaning: 'Delay before the first probe. Default 0.',
        },
        { path: '...Probe.periodSeconds', meaning: 'Interval between probes. Default 10.' },
        {
          path: '...Probe.timeoutSeconds',
          meaning: 'Per-probe timeout. Default 1 - raise it for real endpoints.',
        },
        {
          path: '...Probe.failureThreshold',
          meaning: 'Consecutive failures before acting. Default 3.',
        },
        {
          path: '...Probe.successThreshold',
          meaning: 'Consecutive successes to be considered healthy. Default 1; readiness only.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The liveness probe that caused the outage it was meant to prevent',
    story: [
      'A Java service has `livenessProbe: httpGet /healthz` with defaults, and its `/healthz` handler checks the database connection.',
      "The database has a brief 40-second incident. Every replica's `/healthz` starts returning 500. After 30 seconds (0 + 10 × 3) the kubelet kills every container, all at once.",
      'Now the outage is much worse: every replica is restarting simultaneously, each takes 90 seconds to warm up, and when they come back they all hammer the recovering database at once. A 40-second database blip becomes a 6-minute total outage.',
      'The fix separates the two questions. `/healthz` (liveness) checks only that the process is responsive - it does not touch the database. `/readyz` (readiness) checks the database. During the next database blip, Pods go **not Ready** (so traffic stops arriving) but are **not restarted**, and when the database recovers they become Ready again within one probe period.',
      'They also added `startupProbe` with `failureThreshold: 30, periodSeconds: 10`, so the 90-second warm-up no longer needs a large `initialDelaySeconds` on the liveness probe.',
    ],
    code: [
      {
        title: 'The rule the incident produced',
        language: 'yaml',
        code: `# Liveness: is THIS PROCESS alive? Never check dependencies.
livenessProbe:
  httpGet:
    path: /healthz # returns 200 if the event loop is responsive
    port: 8080
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

# Readiness: can this Pod SERVE RIGHT NOW? Dependencies belong here.
readinessProbe:
  httpGet:
    path: /readyz # checks the DB, cache, downstream APIs
    port: 8080
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2

# Startup: has it finished booting? Up to 300s, checked every 10s.
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 10
  failureThreshold: 30`,
        explanation:
          'One sentence to remember: a liveness probe that checks a dependency turns every dependency outage into a mass restart.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'All three probes with the four handler types',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: probed
  namespace: shop
spec:
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      ports:
        - name: http # a named port keeps probes readable
          containerPort: 8080
        - name: grpc
          containerPort: 9090

      # 1. HTTP handler - the most common
      readinessProbe:
        httpGet:
          path: /readyz
          port: http # refers to the named port above
          scheme: HTTP # HTTP (default) or HTTPS
          httpHeaders:
            - name: X-Probe
              value: readiness
        initialDelaySeconds: 3
        periodSeconds: 5
        timeoutSeconds: 3 # the default of 1 is often too tight
        failureThreshold: 2

      # 2. Startup handler - buys boot time without weakening liveness
      startupProbe:
        httpGet:
          path: /healthz
          port: http
        periodSeconds: 10
        failureThreshold: 30 # up to 300 seconds to start

      # 3. Liveness with an exec handler - useful when there is no HTTP endpoint
      livenessProbe:
        exec:
          command: ["sh", "-c", "test -f /tmp/healthy"]
        periodSeconds: 15
        timeoutSeconds: 5
        failureThreshold: 3
---
apiVersion: v1
kind: Pod
metadata:
  name: probed-tcp-grpc
  namespace: shop
spec:
  containers:
    # 4. TCP handler - for anything that just needs to accept connections
    - name: cache
      image: redis:7.2-alpine
      ports:
        - containerPort: 6379
      readinessProbe:
        tcpSocket:
          port: 6379
        periodSeconds: 5
      livenessProbe:
        tcpSocket:
          port: 6379
        periodSeconds: 15

    # 5. gRPC handler - uses the standard gRPC health checking protocol
    - name: grpc-api
      image: registry.example.com/shop/grpc-api:1.2.0
      ports:
        - containerPort: 9090
      readinessProbe:
        grpc:
          port: 9090
          service: "" # the empty service name means overall server health
        periodSeconds: 5`,
      explanation:
        'Only one handler per probe - `httpGet`, `tcpSocket`, `exec` or `grpc`. Adding two is a validation error.',
      placeholders: ['probed', 'shop', 'registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'Probes in a Deployment, which is where they usually belong',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 3
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0 # meaningless without the readiness probe below
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: nginx:1.27-alpine
          ports:
            - name: http
              containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 2
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 3`,
      explanation:
        '`maxUnavailable: 0` and the readiness probe are a pair: the promise "never drop below 3 available Pods" only means something if "available" is defined by a real health check.',
      placeholders: ['api', 'shop'],
    },
  ],
  imperative: [
    {
      command:
        'kubectl get pod probed -n shop -o jsonpath=\'{.status.conditions[?(@.type=="Ready")].status}{"\\n"}\'',
      what: "The readiness probe's verdict in one word.",
      expected: 'True',
      placeholders: ['probed', 'shop'],
    },
    {
      command: 'kubectl describe pod probed -n shop | grep -iA2 "readiness\\|liveness\\|startup"',
      what: 'Shows the configured probes and any failure messages.',
      expected:
        'Liveness: http-get http://:8080/healthz delay=10s timeout=3s period=15s #success=1 #failure=3',
      placeholders: ['probed', 'shop'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector reason=Unhealthy --sort-by=.lastTimestamp',
      what: 'Every probe failure in the namespace, with the reason and status code.',
      expected: 'Readiness probe failed: ... or Liveness probe failed: ...',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pod probed -n shop -o jsonpath=\'{.status.containerStatuses[0].restartCount}{"\\n"}\'',
      what: 'A climbing restart count with no application error usually means an over-aggressive liveness probe.',
      expected: '0',
      placeholders: ['probed', 'shop'],
    },
    {
      command: 'kubectl exec probed -n shop -- wget -qO- --timeout=2 http://127.0.0.1:8080/readyz',
      what: 'Runs the probe by hand from inside the container - proves whether the endpoint or the probe config is at fault.',
      expected: 'The endpoint body, or a connection error.',
      placeholders: ['probed', 'shop'],
    },
    {
      command: 'kubectl get endpoints api -n shop',
      what: 'Confirms the readiness probe is actually gating traffic: unready Pods are absent from this list.',
      expected: 'One IP per Ready Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl explain pod.spec.containers.readinessProbe --recursive',
      what: 'The authoritative field list when you cannot remember the nesting or a field name.',
      expected:
        'exec, failureThreshold, grpc, httpGet, initialDelaySeconds, periodSeconds, successThreshold, tcpSocket, terminationGracePeriodSeconds, timeoutSeconds.',
    },
  ],
  declarative: {
    steps: [
      'Decide what each probe should check: liveness = the process only; readiness = the process plus its dependencies.',
      'Pick the handler: `httpGet` if there is an HTTP endpoint, `tcpSocket` if it just needs to accept connections, `exec` otherwise, `grpc` for gRPC servers.',
      'Set `timeoutSeconds` explicitly - the default of 1 second is too tight for most real endpoints.',
      'Give slow-starting applications a `startupProbe` rather than a large liveness `initialDelaySeconds`.',
      'Verify by watching the Ready condition and the Service endpoints, not by assuming the YAML is enough.',
    ],
    code: [
      {
        title: 'Add probes to an existing Deployment',
        language: 'bash',
        code: `kubectl get deploy api -n shop -o yaml > api.yaml   # back it up first

# Add readinessProbe/livenessProbe under
#   spec.template.spec.containers[0]
vi api.yaml

kubectl apply -f api.yaml
kubectl rollout status deploy/api -n shop --timeout=180s

# Confirm the probes are live and doing their job
kubectl get deploy api -n shop \\
  -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}{"\\n"}'
kubectl get endpoints api -n shop`,
        placeholders: ['api', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pods -n shop -l app=api',
      what: 'READY 1/1 means the readiness probe passes; 0/1 with STATUS Running means it does not.',
      expected: 'READY 1/1 for every Pod.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl get pod probed -n shop -o jsonpath=\'{.spec.containers[0].livenessProbe}{"\\n"}\'',
      what: 'Reads back the probe exactly as stored, including defaulted fields.',
      expected: 'A JSON object with the handler and timing fields.',
      placeholders: ['probed', 'shop'],
    },
    {
      command: 'kubectl describe pod probed -n shop | grep -E "Liveness:|Readiness:|Startup:"',
      what: 'The compact human-readable summary of all three probes.',
      expected: 'One line per configured probe with its timings.',
      placeholders: ['probed', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod probed -n shop | grep -iA3 "Readiness probe failed"',
      what: 'The exact failure message, including the HTTP status code or exec output.',
      expected: 'HTTP probe failed with statuscode: 404, or a connection refused message.',
      placeholders: ['probed', 'shop'],
    },
    {
      command: 'kubectl exec probed -n shop -- sh -c "time wget -qO- http://127.0.0.1:8080/readyz"',
      what: 'Measures how long the endpoint takes. Anything over `timeoutSeconds` fails every probe.',
      expected: 'A response in well under the configured timeout.',
      placeholders: ['probed', 'shop'],
    },
    {
      command:
        'kubectl get pod probed -n shop -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{"\\n"}\'',
      what: 'A container killed by a liveness probe shows a termination reason of Error with the Killing event alongside.',
      expected: 'Empty for a healthy Pod; Error after a liveness kill.',
      placeholders: ['probed', 'shop'],
    },
    {
      command:
        'kubectl get events -n shop --field-selector reason=Killing --sort-by=.lastTimestamp',
      what: 'Confirms a restart came from a liveness probe rather than from the application exiting.',
      expected: 'Container app failed liveness probe, will be restarted.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl exec probed -n shop -- netstat -tlnp 2>/dev/null || kubectl exec probed -n shop -- sh -c "cat /proc/net/tcp | head"',
      what: 'Confirms the container is actually listening on the port the probe targets.',
      expected: 'A listening socket on the probe port.',
      placeholders: ['probed', 'shop'],
    },
  ],
  commonMistakes: [
    'Putting a dependency check in the liveness probe, so a dependency outage restarts every replica at once.',
    'Leaving `timeoutSeconds` at its default of 1 second for an endpoint that takes longer under load.',
    'Using a large `initialDelaySeconds` on the liveness probe instead of a `startupProbe`, which leaves the app unprotected for that whole window.',
    'Omitting the readiness probe and then claiming zero-downtime rollouts - "available" then just means "process started".',
    'Setting `successThreshold` greater than 1 on a liveness or startup probe, which is rejected by validation.',
    'Specifying two handlers in one probe. Exactly one of httpGet/tcpSocket/exec/grpc.',
    'Probing a port the container does not listen on, then debugging the application instead of the port number.',
    'Using an `exec` probe with a command the image does not contain (`curl` is absent from most minimal images).',
  ],
  examTips: [
    'Readiness gates traffic, liveness restarts, startup buys boot time. If a task says "should not receive traffic until ready", that is readiness.',
    '`kubectl explain pod.spec.containers.livenessProbe --recursive` gives you the exact field names in two seconds - much faster than the docs.',
    'There is no imperative flag for probes: generate the Deployment, then edit the YAML.',
    'Set `timeoutSeconds` explicitly whenever you write a probe; graders do not mind, and it prevents a self-inflicted failure.',
    '"Restart the container if X" → liveness. "Remove from the load balancer if X" → readiness. "Allow up to N seconds to start" → startup with `periodSeconds × failureThreshold >= N`.',
    'Verify probes with `kubectl get pods` (READY column) and `kubectl get endpoints`, not by re-reading your YAML.',
  ],
  summary: [
    'readiness = traffic gate; liveness = restart trigger; startup = boot-time budget that suspends the other two.',
    'Handlers: httpGet (2xx/3xx), tcpSocket (connect), exec (exit 0), grpc - exactly one per probe.',
    '`timeoutSeconds` defaults to 1; `periodSeconds` to 10; `failureThreshold` to 3.',
    'Liveness must never check dependencies; readiness is where dependency checks belong.',
    'Startup budget = periodSeconds × failureThreshold.',
  ],
  practice: [
    {
      id: 'probe-p1',
      level: 'beginner',
      prompt:
        'Which probe removes a Pod from Service endpoints on failure, and which one restarts the container?',
      answer:
        'Readiness removes it from endpoints (the container keeps running). Liveness restarts the container.',
      explanation:
        'This is the distinction every probe question tests. A Pod showing `0/1 Running` has a failing readiness probe; a Pod with a climbing RESTARTS count and no application error usually has an over-aggressive liveness probe.',
    },
    {
      id: 'probe-p2',
      level: 'intermediate',
      prompt:
        'An application needs up to 4 minutes to start. Write the startupProbe that allows this while keeping a liveness probe that reacts within 30 seconds afterwards.',
      answer:
        'startupProbe:\n  httpGet:\n    path: /healthz\n    port: 8080\n  periodSeconds: 10\n  failureThreshold: 24        # 10 × 24 = 240s = 4 minutes\n\nlivenessProbe:\n  httpGet:\n    path: /healthz\n    port: 8080\n  periodSeconds: 10\n  failureThreshold: 3         # 10 × 3 = 30s after startup succeeds\n  timeoutSeconds: 3',
      explanation:
        'The liveness probe does not run at all until the startup probe first succeeds, so there is no need for `initialDelaySeconds` on it. That is the whole point of startup probes: a long boot window and a short detection window, without compromise.',
    },
    {
      id: 'probe-p3',
      level: 'advanced',
      prompt:
        'Every replica of a Deployment restarted at the same moment during a database outage, with no application errors in the logs. Diagnose it and give the fix.',
      answer:
        'The liveness probe checks the database. When the database failed, every replica\'s liveness probe failed simultaneously and the kubelet killed every container.\n\nDiagnosis:\n- `kubectl get events -n <ns> --field-selector reason=Killing` shows "failed liveness probe, will be restarted"\n- `kubectl describe pod <name>` shows "Liveness probe failed"\n\nFix: make liveness check only the process (a `/healthz` that does no I/O), and move the database check to the readiness probe (`/readyz`). Pods then go not-Ready during a dependency outage - traffic stops - but are not restarted, and recover on their own.',
      explanation:
        'The general principle: liveness answers "is this process broken beyond recovery?" A dependency being down is not that. Restarting cannot fix someone else\'s outage, and doing it to every replica at once makes recovery slower.',
    },
  ],
  lab: {
    title: 'Watch each probe do its specific job',
    scenario:
      'You will create Pods with a failing readiness probe, a failing liveness probe, and a slow start protected by a startup probe - and observe the three different consequences.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `probe-lab` and set it as default.' },
      {
        instruction:
          'Create a Deployment `web` with 2 replicas of nginx, a working readiness probe, and a Service; confirm 2 endpoints.',
      },
      {
        instruction:
          'Break the readiness probe path with a patch and confirm endpoints drop to zero while the containers keep running with 0 restarts.',
      },
      { instruction: 'Fix the readiness probe and confirm the endpoints return.' },
      {
        instruction:
          'Create a Pod `flapper` with an exec liveness probe that fails after 20 seconds, and watch RESTARTS climb.',
      },
      {
        instruction:
          'Create a Pod `slowstart` that takes 40 seconds to serve, with a startup probe allowing 60 seconds and a tight liveness probe; confirm it never restarts.',
      },
      { instruction: 'Show the Unhealthy and Killing events for the namespace.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - a healthy readiness probe',
        language: 'yaml',
        code: `# web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: probe-lab
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
          readinessProbe:
            httpGet:
              path: / # valid path
              port: http
            periodSeconds: 3
            timeoutSeconds: 2
            failureThreshold: 2
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: probe-lab
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: http`,
      },
      {
        title: 'Steps 2b-4 - break and fix readiness',
        language: 'bash',
        code: `kubectl create namespace probe-lab
kubectl config set-context --current --namespace=probe-lab
kubectl apply -f web.yaml
kubectl rollout status deploy/web --timeout=120s

kubectl get endpoints web
# web   10.244.1.5:80,10.244.2.7:80    <- two endpoints

# Break it: point the probe at a 404
kubectl patch deploy web --type=json -p='[{"op":"replace",
  "path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path",
  "value":"/definitely-not-here"}]'
sleep 40

kubectl get pods -l app=web
# web-...   0/1   Running   0   ...     <- running, 0 restarts, NOT ready
kubectl get endpoints web
# web   <none>                          <- no traffic reaches it

kubectl describe pod -l app=web | grep -m1 -A1 "Readiness probe failed"
# Readiness probe failed: HTTP probe failed with statuscode: 404

# Fix it
kubectl patch deploy web --type=json -p='[{"op":"replace",
  "path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path",
  "value":"/"}]'
kubectl rollout status deploy/web --timeout=120s
kubectl get endpoints web
# two endpoints again`,
      },
      {
        title: 'Step 5 - liveness restarts the container',
        language: 'yaml',
        code: `# flapper.yaml
apiVersion: v1
kind: Pod
metadata:
  name: flapper
  namespace: probe-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      # Healthy for 20 seconds, then the marker file disappears.
      command:
        - sh
        - -c
        - "touch /tmp/healthy; sleep 20; rm -f /tmp/healthy; sleep 3600"
      livenessProbe:
        exec:
          command: ["test", "-f", "/tmp/healthy"]
        periodSeconds: 5
        failureThreshold: 2 # killed ~10s after the file goes`,
      },
      {
        title: 'Step 6 - startup probe protects a slow start',
        language: 'yaml',
        code: `# slowstart.yaml
apiVersion: v1
kind: Pod
metadata:
  name: slowstart
  namespace: probe-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      # Takes 40 seconds before it answers on :8080
      command:
        - sh
        - -c
        - "sleep 40; while true; do echo -e 'HTTP/1.1 200 OK\\r\\n\\r\\nok' | nc -l -p 8080 -q 1; done"
      ports:
        - containerPort: 8080
      startupProbe:
        tcpSocket:
          port: 8080
        periodSeconds: 5
        failureThreshold: 12 # 5 × 12 = 60s of boot time allowed
      livenessProbe:
        tcpSocket:
          port: 8080
        periodSeconds: 5
        failureThreshold: 2 # tight - but suspended until startup succeeds`,
      },
      {
        title: 'Steps 5b-8 - observe and clean up',
        language: 'bash',
        code: `kubectl apply -f flapper.yaml -f slowstart.yaml

sleep 90
kubectl get pods flapper slowstart
# NAME        READY   STATUS    RESTARTS      AGE
# flapper     1/1     Running   2 (15s ago)   90s   <- liveness keeps killing it
# slowstart   1/1     Running   0             90s   <- startup probe protected it

kubectl describe pod flapper | grep -m1 -A1 "Liveness probe failed"
# Liveness probe failed:

kubectl get events --field-selector reason=Killing --sort-by=.lastTimestamp | tail -3
# Container c failed liveness probe, will be restarted

kubectl get events --field-selector reason=Unhealthy --sort-by=.lastTimestamp | tail -5

# The key contrast:
#   readiness failure -> 0/1 Running, 0 restarts, no endpoints
#   liveness failure  -> restarts climbing
#   startup probe     -> slow boot allowed, then tight liveness applies

kubectl config set-context --current --namespace=default
kubectl delete namespace probe-lab`,
      },
    ],
    verification: [
      {
        command:
          "kubectl get pods -n probe-lab -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[0].ready,RESTARTS:.status.containerStatuses[0].restartCount'",
        what: 'The table that separates the three probe behaviours.',
        expected: 'slowstart ready with 0 restarts; flapper with a non-zero restart count.',
      },
      {
        command: 'kubectl get endpoints web -n probe-lab',
        what: 'Proves readiness gates traffic: empty while the probe fails, populated when it passes.',
        expected: 'Two IP:80 entries when healthy.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace probe-lab',
        what: 'Removes all lab objects.',
        expected: 'namespace "probe-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['pods', 'rolling-updates', 'pod-failure-modes'],
  docs: [
    {
      title: 'Configure liveness, readiness and startup probes',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/',
    },
    {
      title: 'Pod lifecycle - container probes',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes',
    },
  ],
}
