import type { Topic } from '../../../types'

export const multiContainerPatterns: Topic = {
  id: 'multi-container-patterns',
  title: 'Multi-container Pod patterns: sidecar, ambassador, adapter',
  domainId: 'design-build',
  difficulty: 'intermediate',
  estimatedMinutes: 26,
  order: 8,
  tags: ['sidecar', 'ambassador', 'adapter', 'multi-container', 'native sidecar', 'emptyDir'],
  oneLiner:
    'The three classic co-located container patterns, when each applies, and the native sidecar mechanism that fixes the old startup and shutdown problems.',
  explanation: [
    'Containers in one Pod share a network namespace (one IP, `localhost`) and can share volumes. That is the whole toolkit, and the three named patterns are just three uses of it.',
    '**Sidecar** - a helper that augments the main container: ships its logs, refreshes a credential file, syncs content from git, exports metrics. It runs for as long as the main container does and communicates through a shared volume or localhost.',
    "**Ambassador** - a proxy that owns the main container's outbound connections. The app talks to `localhost:6379` and the ambassador handles service discovery, sharding, TLS or connection pooling to the real backend. The app becomes simpler because the network complexity moved out of it.",
    "**Adapter** - the mirror image: it normalises the main container's *output* so an external system can consume it. The classic case is an exporter that turns an application-specific status page into Prometheus metrics format.",
    'Since Kubernetes 1.29 there is a first-class **native sidecar**: an entry in `initContainers` with `restartPolicy: Always`. It starts before the regular containers, keeps running alongside them, is restarted independently, and is terminated *after* the regular containers stop. That solves two long-standing problems - a sidecar that was not ready before the app started, and a sidecar that exited too early in a Job, leaving the Pod hanging.',
  ],
  whyItMatters: [
    'The official curriculum names this explicitly ("understand multi-container Pod design patterns"), and it appears both as a design question and as a build task.',
    'The native sidecar is the notable recent change in this area and is exactly the kind of thing a current-version exam tests. Knowing that a sidecar for a Job must be a native sidecar - otherwise the Job never completes - is a high-value fact.',
    'Choosing correctly between "another container in this Pod" and "another Deployment" is a real design skill: shared lifecycle and shared filesystem mean the same Pod; independent scaling means a separate workload.',
  ],
  howItWorks: [
    'Regular containers in `spec.containers` all start in parallel after init containers finish, and there is no ordering guarantee between them. If your app needs the sidecar ready first, a regular sidecar cannot guarantee that - a native sidecar can.',
    'Native sidecar mechanics: put the container in `spec.initContainers` with `restartPolicy: Always`. Init containers run in order, and a native sidecar is considered "done" as soon as it is started (or passes its startup probe), so the next init container - and eventually the main containers - proceed.',
    "Shutdown order with native sidecars: regular containers get SIGTERM first, then native sidecars in reverse order. That is why a log shipper as a native sidecar can flush the app's final log lines.",
    'For Jobs, a regular sidecar that never exits keeps the Pod Running forever, so the Job never completes. A native sidecar is excluded from completion accounting, so the Job completes when the main container exits. This is the main practical reason native sidecars exist.',
    "Shared state options: an `emptyDir` volume mounted into both containers (most common), the shared network namespace (`localhost`), and shared process namespace (`spec.shareProcessNamespace: true`) if one container must see the other's processes.",
    '`kubectl logs`, `kubectl exec` and `kubectl describe` all need `-c <container>` in a multi-container Pod. Without it, `logs` errors and lists the choices.',
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Hosts the co-located containers and the volume they share.',
      fields: [
        {
          path: 'spec.containers[]',
          meaning: 'Regular containers - start in parallel, no ordering guarantee.',
          required: true,
        },
        {
          path: 'spec.initContainers[].restartPolicy',
          meaning:
            'Set to Always to make this init container a native sidecar: starts first, runs alongside, stops last.',
        },
        {
          path: 'spec.volumes[]',
          meaning: 'Declares the shared volume, usually emptyDir for sidecars.',
        },
        {
          path: 'spec.containers[].volumeMounts[]',
          meaning: 'Mounts the shared volume into each container, possibly at different paths.',
        },
        {
          path: 'spec.shareProcessNamespace',
          meaning: "true lets containers see each other's processes; off by default.",
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A Job that never finished',
    story: [
      'A nightly export Job runs a Python container that writes a file, plus a sidecar that streams the log file to a collector. The export takes four minutes and finishes correctly.',
      'The Job never completes. `kubectl get job` shows `0/1` for hours. The reason: the Pod only reaches `Succeeded` when *all* containers have terminated, and the log sidecar runs `tail -F` forever.',
      'The team first hacked around it by having the main container write a sentinel file that the sidecar polled before exiting. It worked, but it was fragile, and each new sidecar needed the same plumbing.',
      'The proper fix was three lines: move the sidecar into `initContainers` and give it `restartPolicy: Always`. Native sidecars are excluded from Job completion accounting, so the Job completes as soon as the exporter exits, and the sidecar is terminated afterwards - after it has flushed the last log lines.',
    ],
    code: [
      {
        title: 'Before and after',
        language: 'yaml',
        code: `# BEFORE - Job hangs forever
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: export # exits after 4 minutes
          image: registry.example.com/shop/export:1.4.2
        - name: log-shipper # never exits -> Pod never Succeeds
          image: busybox:1.36
          command: ["sh", "-c", "tail -F /shared/export.log"]

# AFTER - native sidecar, Job completes normally
spec:
  template:
    spec:
      restartPolicy: Never
      initContainers:
        - name: log-shipper
          image: busybox:1.36
          restartPolicy: Always # <- this makes it a native sidecar
          command: ["sh", "-c", "tail -F /shared/export.log"]
          volumeMounts:
            - name: shared
              mountPath: /shared
      containers:
        - name: export
          image: registry.example.com/shop/export:1.4.2
          volumeMounts:
            - name: shared
              mountPath: /shared
      volumes:
        - name: shared
          emptyDir: {}`,
        explanation:
          'The only structural change is which list the sidecar lives in, plus one field. Everything else - image, command, mounts - is identical.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Sidecar: log shipping through a shared emptyDir',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: web-with-logshipper
  namespace: shop
  labels:
    app: web
spec:
  volumes:
    - name: logs
      emptyDir: {} # lives and dies with the Pod
  initContainers:
    - name: log-shipper
      image: busybox:1.36
      restartPolicy: Always # native sidecar: ready before nginx starts
      command: ["sh", "-c", "tail -F -n +1 /logs/access.log 2>/dev/null || sleep infinity"]
      volumeMounts:
        - name: logs
          mountPath: /logs
      resources:
        requests:
          cpu: 10m
          memory: 32Mi
        limits:
          memory: 64Mi
  containers:
    - name: web
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80
      volumeMounts:
        - name: logs
          mountPath: /var/log/nginx # nginx writes here, sidecar reads /logs`,
      explanation:
        'The same volume is mounted at two different paths, which is the point: each container sees the shared directory wherever it expects it. `kubectl logs web-with-logshipper -c log-shipper` then shows the web access log.',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      title: 'Ambassador: the app connects to localhost, the proxy does the rest',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: app-with-ambassador
  namespace: shop
spec:
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      env:
        # The application only ever needs to know about localhost.
        - name: REDIS_ADDR
          value: "127.0.0.1:6379"
      ports:
        - containerPort: 8080

    - name: ambassador
      image: haproxy:2.9-alpine
      # HAProxy listens on localhost:6379 and forwards to the real backend,
      # handling retries, TLS and failover so the app does not have to.
      ports:
        - containerPort: 6379
      volumeMounts:
        - name: proxy-config
          mountPath: /usr/local/etc/haproxy
          readOnly: true
  volumes:
    - name: proxy-config
      configMap:
        name: ambassador-config`,
      explanation:
        'Because both containers share a network namespace, `127.0.0.1:6379` in the app reaches the ambassador with no Service, no DNS and no extra hop.',
      placeholders: [
        'app-with-ambassador',
        'shop',
        'registry.example.com/shop/api:1.4.2',
        'ambassador-config',
      ],
    },
    {
      title: 'Adapter: normalise output for an external consumer',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: legacy-with-adapter
  namespace: shop
  labels:
    app: legacy
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9113" # scrape the adapter, not the app
spec:
  containers:
    - name: legacy-app
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80

    - name: metrics-adapter
      # Reads nginx's own status page on localhost:80 and re-publishes it
      # as Prometheus metrics on :9113 - the app is unchanged.
      image: nginx/nginx-prometheus-exporter:1.3.0
      args: ["--nginx.scrape-uri=http://127.0.0.1:80/stub_status"]
      ports:
        - name: metrics
          containerPort: 9113
      resources:
        requests:
          cpu: 10m
          memory: 24Mi`,
      explanation:
        'The adapter converts a proprietary format into the standard one the monitoring system expects. Nothing about the legacy application changes, which is often the only option with software you do not own.',
      placeholders: ['legacy-with-adapter', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl logs web-with-logshipper -c log-shipper -n shop',
      what: "Reads one container's log in a multi-container Pod. `-c` is mandatory here.",
      expected: 'The tailed access log lines.',
      placeholders: ['web-with-logshipper', 'log-shipper', 'shop'],
    },
    {
      command: 'kubectl logs web-with-logshipper --all-containers=true -n shop',
      what: 'Interleaves logs from every container in the Pod.',
      expected: 'Mixed output from both containers.',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command: 'kubectl exec -it web-with-logshipper -c web -n shop -- sh',
      what: 'Opens a shell in a specific container.',
      expected: 'A shell prompt inside the nginx container.',
      placeholders: ['web-with-logshipper', 'web', 'shop'],
    },
    {
      command:
        'kubectl get pod web-with-logshipper -n shop -o jsonpath=\'{range .spec.containers[*]}{.name}{"\\n"}{end}\'',
      what: 'Lists the regular container names - what you need for `-c`.',
      expected: 'web',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command:
        'kubectl get pod web-with-logshipper -n shop -o jsonpath=\'{range .spec.initContainers[*]}{.name}{" restartPolicy="}{.restartPolicy}{"\\n"}{end}\'',
      what: 'Shows init containers and identifies which are native sidecars (`restartPolicy=Always`).',
      expected: 'log-shipper restartPolicy=Always',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command:
        'kubectl exec web-with-logshipper -c web -n shop -- curl -s localhost:80 -o /dev/null -w "%{http_code}\\n"',
      what: 'Proves containers in a Pod reach each other over localhost.',
      expected: '200',
      placeholders: ['web-with-logshipper', 'web', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Decide first whether the helper really belongs in the same Pod: same lifecycle and shared filesystem or localhost → yes; independent scaling → separate Deployment.',
      'Declare the shared volume once in `spec.volumes` (usually `emptyDir: {}`).',
      'Mount it into every container that needs it, at whatever path each expects.',
      'For a helper that must be ready first, or that must not block a Job, put it in `initContainers` with `restartPolicy: Always`.',
      "Give the helper its own modest `resources` block - it counts towards the Pod's total requests.",
    ],
    code: [
      {
        title: 'Generate a single-container Pod, then add the sidecar',
        language: 'bash',
        code: `kubectl run web --image=nginx:1.27-alpine --dry-run=client -o yaml > pod.yaml

# Then add by hand:
#   spec.volumes:            - name: logs
#                              emptyDir: {}
#   spec.initContainers:     the sidecar, with restartPolicy: Always
#   volumeMounts in both containers

kubectl apply -f pod.yaml
kubectl get pod web -o jsonpath='{.spec.initContainers[0].name}{" + "}{.spec.containers[0].name}{"\\n"}'
# log-shipper + web`,
        placeholders: ['web'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pod web-with-logshipper -n shop',
      what: 'The READY column counts native sidecars too, so a Pod with one sidecar and one app container reads 2/2.',
      expected: 'READY 2/2, STATUS Running.',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command: 'kubectl exec web-with-logshipper -c log-shipper -n shop -- ls -l /logs',
      what: 'Confirms the sidecar can see the files the main container writes.',
      expected: 'access.log and error.log listed.',
      placeholders: ['web-with-logshipper', 'log-shipper', 'shop'],
    },
    {
      command: 'kubectl logs web-with-logshipper -c log-shipper -n shop --tail=5',
      what: "End-to-end proof: the sidecar is streaming the other container's output.",
      expected: 'nginx access log lines.',
      placeholders: ['web-with-logshipper', 'log-shipper', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl logs web-with-logshipper -n shop',
      what: 'Without -c on a multi-container Pod this errors and helpfully lists the container names.',
      expected:
        'error: a container name must be specified for pod ..., choose one of: [log-shipper web]',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command: 'kubectl describe pod web-with-logshipper -n shop',
      what: 'Shows each container separately with its own state, restarts and reason.',
      expected: 'Two Containers sections plus an Init Containers section.',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command:
        'kubectl get pod web-with-logshipper -n shop -o jsonpath=\'{range .status.containerStatuses[*]}{.name}={.ready}{" "}{end}{"\\n"}\'',
      what: 'Identifies which container is not Ready when the READY column shows 1/2.',
      expected: 'web=true log-shipper=true',
      placeholders: ['web-with-logshipper', 'shop'],
    },
    {
      command: 'kubectl get job export -n shop -o wide',
      what: 'A Job stuck at 0/1 with all containers healthy is the classic non-native-sidecar symptom.',
      expected: 'COMPLETIONS 1/1 once the sidecar is native.',
      placeholders: ['export', 'shop'],
    },
  ],
  commonMistakes: [
    'Putting a never-exiting sidecar in `spec.containers` of a Job, so the Job never completes. Use a native sidecar.',
    'Assuming regular containers start in a defined order. They do not - use a native sidecar or an init container when order matters.',
    'Forgetting `-c <container>` on `logs` and `exec`.',
    "Declaring the volume in only one container's `volumeMounts` and expecting sharing. Both must mount it.",
    'Using a sidecar where a separate Deployment belongs - if the helper needs to scale independently of the app, it does not belong in the Pod.',
    'Omitting `resources` on the sidecar, so its usage is unaccounted and the Pod can be evicted unexpectedly.',
    'Mounting an `emptyDir` and expecting data to survive the Pod. It does not - use a PVC for that.',
  ],
  examTips: [
    'Task says "add a container that reads the app\'s logs" → sidecar with a shared `emptyDir` mounted into both.',
    'Task says "the app should connect to localhost and the proxy forwards" → ambassador.',
    'Task says "expose the app\'s metrics in a different format" → adapter.',
    'Task involves a sidecar inside a Job or CronJob → it must be a native sidecar (`initContainers` + `restartPolicy: Always`).',
    'Remember the READY column counts native sidecars, so expect `2/2` not `1/1`.',
    '`kubectl explain pod.spec.initContainers.restartPolicy` confirms the native sidecar field if you doubt yourself.',
  ],
  summary: [
    'One Pod = shared network namespace + optional shared volumes. All three patterns are built from those two facts.',
    'Sidecar augments the app; ambassador proxies its outbound traffic; adapter reshapes its output.',
    'Native sidecar = `initContainers` entry with `restartPolicy: Always`: starts first, runs alongside, terminates last, and does not block Job completion.',
    'Multi-container Pods require `-c <container>` for logs and exec.',
    'Separate Deployment, not sidecar, when the helper must scale independently.',
  ],
  practice: [
    {
      id: 'mcp-p1',
      level: 'beginner',
      prompt:
        'Two containers in one Pod need to share files. Which volume type do you use, and where do you declare it?',
      answer:
        'An `emptyDir` volume, declared once in `spec.volumes`, then mounted with `volumeMounts` in *both* containers (the mount paths may differ).',
      explanation:
        'emptyDir is created empty when the Pod starts and deleted when the Pod is removed. For data that must outlive the Pod you need a PersistentVolumeClaim instead.',
    },
    {
      id: 'mcp-p2',
      level: 'intermediate',
      prompt:
        'A Job has a main container that finishes in 30 seconds and a metrics sidecar that runs forever. The Job stays at 0/1. Explain the cause and give the exact fix.',
      answer:
        'A Pod only reaches Succeeded when every regular container has terminated, so the forever-running sidecar keeps the Pod Running and the Job incomplete. Fix: move the sidecar from `spec.containers` into `spec.initContainers` and add `restartPolicy: Always`, making it a native sidecar - native sidecars are excluded from completion accounting and are terminated after the main container exits.',
      explanation:
        'This is the single most exam-relevant fact about native sidecars. Verify with `kubectl get job <name>` showing 1/1 and `kubectl get pod <pod>` showing Completed.',
    },
    {
      id: 'mcp-p3',
      level: 'advanced',
      prompt:
        'Write the Pod fragment for a native sidecar named `config-sync` (image `busybox:1.36`) that must be running before the main container `app` starts, sharing an emptyDir at `/etc/appconfig` in both containers.',
      answer:
        'spec:\n  volumes:\n    - name: config\n      emptyDir: {}\n  initContainers:\n    - name: config-sync\n      image: busybox:1.36\n      restartPolicy: Always\n      command: ["sh", "-c", "while true; do echo synced > /etc/appconfig/state; sleep 30; done"]\n      volumeMounts:\n        - name: config\n          mountPath: /etc/appconfig\n  containers:\n    - name: app\n      image: nginx:1.27-alpine\n      volumeMounts:\n        - name: config\n          mountPath: /etc/appconfig',
      explanation:
        'Because native sidecars are init containers, they are guaranteed to have started before any regular container. A regular sidecar in `spec.containers` would give you no such guarantee - the app might start first and find an empty directory.',
    },
  ],
  lab: {
    title: 'Build all three patterns, and prove the native sidecar difference',
    scenario:
      "You will build a sidecar that reads another container's files, demonstrate localhost communication, and then reproduce the hanging-Job problem and fix it with a native sidecar.",
    prerequisites: ['A cluster on Kubernetes 1.29 or later (native sidecars)'],
    tasks: [
      { instruction: 'Create namespace `mc-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod `pair` where a writer container appends the date to a shared file every 2 seconds and a native sidecar tails it.',
      },
      { instruction: "Read the sidecar's logs and confirm it sees the writer's output." },
      {
        instruction:
          'Create a Pod `web-amb` with nginx plus a busybox container, and prove the busybox container can curl nginx on localhost.',
      },
      {
        instruction:
          'Create a Job `hangs` with a main container that exits after 10 seconds plus a regular forever-running sidecar; confirm the Job never completes.',
      },
      {
        instruction:
          'Create a Job `works` that is identical except the sidecar is native; confirm it completes.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - sidecar reading a shared volume',
        language: 'yaml',
        code: `# pair.yaml
apiVersion: v1
kind: Pod
metadata:
  name: pair
  namespace: mc-lab
spec:
  volumes:
    - name: shared
      emptyDir: {}
  initContainers:
    - name: tailer
      image: busybox:1.36
      restartPolicy: Always # native sidecar
      command: ["sh", "-c", "touch /data/out.log; tail -F /data/out.log"]
      volumeMounts:
        - name: shared
          mountPath: /data
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /out/out.log; sleep 2; done"]
      volumeMounts:
        - name: shared
          mountPath: /out`,
      },
      {
        title: 'Apply and read the sidecar log',
        language: 'bash',
        code: `kubectl create namespace mc-lab
kubectl config set-context --current --namespace=mc-lab
kubectl apply -f pair.yaml
kubectl wait --for=condition=Ready pod/pair --timeout=90s

kubectl get pod pair
# NAME   READY   STATUS    RESTARTS   AGE
# pair   2/2     Running   0          15s      <- native sidecar counts in READY

sleep 8
kubectl logs pair -c tailer --tail=3
# Wed Sep  3 12:40:02 UTC 2026
# Wed Sep  3 12:40:04 UTC 2026
# Wed Sep  3 12:40:06 UTC 2026`,
      },
      {
        title: 'Step 4 - localhost between containers',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: web-amb
  namespace: mc-lab
spec:
  containers:
    - name: web
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80
    - name: client
      image: busybox:1.36
      command: ["sleep", "3600"]
YAML

kubectl wait --for=condition=Ready pod/web-amb --timeout=90s
kubectl exec web-amb -c client -- wget -qO- http://127.0.0.1:80 | head -4
# <!DOCTYPE html> ...   <- the client container reached nginx over localhost`,
      },
      {
        title: 'Step 5 - the hanging Job',
        language: 'yaml',
        code: `# hangs.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: hangs
  namespace: mc-lab
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: work
          image: busybox:1.36
          command: ["sh", "-c", "echo working; sleep 10; echo done"]
        - name: helper # regular container that never exits
          image: busybox:1.36
          command: ["sh", "-c", "sleep infinity"]`,
      },
      {
        title: 'Step 6 - the fixed Job',
        language: 'yaml',
        code: `# works.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: works
  namespace: mc-lab
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      initContainers:
        - name: helper
          image: busybox:1.36
          restartPolicy: Always # native sidecar - excluded from completion
          command: ["sh", "-c", "sleep infinity"]
      containers:
        - name: work
          image: busybox:1.36
          command: ["sh", "-c", "echo working; sleep 10; echo done"]`,
      },
      {
        title: 'Compare the two Jobs, then clean up',
        language: 'bash',
        code: `kubectl apply -f hangs.yaml -f works.yaml
sleep 45

kubectl get jobs
# NAME    STATUS     COMPLETIONS   DURATION   AGE
# hangs   Running    0/1           45s        45s    <- stuck forever
# works   Complete   1/1           13s        45s    <- completed normally

kubectl get pods -l batch.kubernetes.io/job-name=hangs
# 1/2 Running   <- work container finished, helper still going

kubectl config set-context --current --namespace=default
kubectl delete namespace mc-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl get jobs -n mc-lab',
        what: 'The side-by-side comparison is the whole point of the lab.',
        expected: 'hangs at 0/1 Running; works at 1/1 Complete.',
      },
      {
        command:
          'kubectl get pod pair -n mc-lab -o jsonpath=\'{.spec.initContainers[0].restartPolicy}{"\\n"}\'',
        what: 'Confirms the sidecar really is native.',
        expected: 'Always',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace mc-lab',
        what: 'Removes every Pod and Job from the lab.',
        expected: 'namespace "mc-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['init-containers', 'volumes-and-ephemeral-storage', 'jobs'],
  docs: [
    {
      title: 'Sidecar containers',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/',
    },
    {
      title: 'Init containers',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/init-containers/',
    },
  ],
}
