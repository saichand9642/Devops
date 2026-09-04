import type { Topic } from '../../../types'

export const initContainers: Topic = {
  id: 'init-containers',
  title: 'Init containers',
  domainId: 'design-build',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 9,
  tags: ['initContainers', 'startup order', 'Init:0/1', 'wait-for', 'PodInitializing'],
  oneLiner:
    'Run setup work to completion before the application starts, and read the Init:0/2 status that tells you exactly which step is blocking.',
  explanation: [
    "Init containers run **before** the regular containers, **one at a time**, **in order**, and each must exit successfully before the next begins. If one fails, the kubelet retries it according to the Pod's `restartPolicy`, and the app containers never start.",
    'They use the same fields as regular containers - image, command, env, volumeMounts, resources, securityContext - but they cannot have `lifecycle` hooks or readiness/liveness probes, because they are expected to finish rather than to serve.',
    'Typical uses: wait for a dependency to be reachable, run a database migration, clone configuration from git into a shared volume, fix permissions on a mounted volume, or fetch a secret from an external store.',
    'A regular init container terminates before the app starts. An init container with `restartPolicy: Always` is instead a **native sidecar**: it starts, keeps running, and the next container proceeds as soon as it has started. Same list, different intent - and the exam expects you to know both.',
  ],
  whyItMatters: [
    'Init containers are the clean answer to "my app crashes because the database is not up yet". Without them, people put retry loops and sleeps into application code or entrypoint scripts.',
    'The `Init:0/2` status is a precise diagnostic. It tells you the Pod is not broken - it is waiting on init container 1 of 2 - and `kubectl logs <pod> -c <init-name>` tells you why.',
    'They let you keep tools out of the production image: clone with a git image, migrate with a migration image, then run a minimal app image that contains neither.',
  ],
  howItWorks: [
    'Order of events: scheduling → init container 1 runs to completion → init container 2 → ... → all regular containers start in parallel. Native sidecars start in their init position but do not have to finish.',
    'Status while initialising is `Init:N/M` where N is the number completed. The Pod condition `Initialized` flips to True only when every regular init container has succeeded.',
    'With `restartPolicy: Always` or `OnFailure`, a failed init container is retried with backoff, and the Pod status shows `Init:CrashLoopBackOff`. With `Never`, the Pod goes straight to Failed.',
    'Init containers can mount the same volumes as app containers, which is the mechanism for handing work over: the init container writes into an `emptyDir`, the app container reads it.',
    "Resource accounting: the Pod's effective request is the *maximum* of (the largest init container request) and (the sum of app container requests), because init containers do not run at the same time as the app. Native sidecars are added to the app container sum, since they do run concurrently.",
    'Init containers cannot be added or removed on a running Pod; you change the Pod template and let the workload controller recreate the Pods.',
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Declares ordered setup steps that gate the application start.',
      fields: [
        {
          path: 'spec.initContainers[]',
          meaning: 'Ordered list; each must exit 0 before the next starts.',
        },
        {
          path: 'spec.initContainers[].restartPolicy',
          meaning: 'Set to Always to turn this entry into a native sidecar instead.',
        },
        {
          path: 'spec.initContainers[].volumeMounts[]',
          meaning: 'Mount shared volumes to hand data to the app containers.',
        },
        {
          path: 'status.initContainerStatuses[]',
          meaning: 'Per-init-container state, exit codes and restart counts.',
        },
        {
          path: 'status.conditions[?(@.type=="Initialized")]',
          meaning: 'True once all regular init containers have completed.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'CrashLoopBackOff that was really a startup-order problem',
    story: [
      'An API Pod crash-loops with `could not connect to postgres:5432`. The database Pod takes about 25 seconds to accept connections, and the API exits immediately if its first connection fails.',
      "The team's first instinct was to add a liveness probe with a long `initialDelaySeconds`. That does not help: the container has already exited, and probes do not restart a process that is gone - the restart policy does, into the same race.",
      'The correct fix is an init container that blocks until the dependency answers. The API container then starts only once the port is open, and its own connection succeeds on the first attempt.',
      'The visible improvement is in the status column: instead of `CrashLoopBackOff` with a climbing restart count, the Pod sits at `Init:0/1` for 25 seconds and then goes straight to `1/1 Running`. Nothing crashed, so nothing needs to be explained to whoever is on call.',
    ],
    code: [
      {
        title: 'Before and after, as seen in kubectl get pods',
        language: 'bash',
        code: `# BEFORE - a race, reported as a crash
# NAME       READY   STATUS             RESTARTS   AGE
# api-xxxxx  0/1     CrashLoopBackOff   4          2m

# AFTER - an honest wait, then a clean start
# NAME       READY   STATUS     RESTARTS   AGE
# api-xxxxx  0/1     Init:0/1   0          12s
# api-xxxxx  0/1     PodInitializing  0    26s
# api-xxxxx  1/1     Running    0          28s`,
        explanation:
          '`Init:0/1` and `PodInitializing` are healthy, expected states. Learning to read them stops you from debugging a problem that is not there.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'Wait for a dependency, then start',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: api
  namespace: shop
spec:
  initContainers:
    - name: wait-for-postgres
      image: busybox:1.36
      # nc -z returns 0 as soon as the TCP port accepts a connection
      command:
        - sh
        - -c
        - |
          echo "waiting for postgres:5432"
          until nc -z postgres 5432; do
            echo "not ready, retrying in 2s"
            sleep 2
          done
          echo "postgres is accepting connections"
      resources:
        requests:
          cpu: 10m
          memory: 16Mi
  containers:
    - name: api
      image: registry.example.com/shop/api:1.4.2
      ports:
        - containerPort: 8080`,
      explanation:
        'The init container exits 0 the moment the port opens, so the wait costs exactly as long as it needs to and no longer. `kubectl logs api -c wait-for-postgres` shows the retry lines, which makes the delay self-explanatory.',
      placeholders: ['api', 'shop', 'postgres', 'registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'Two ordered init containers handing work over through a volume',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: web-content
  namespace: shop
spec:
  volumes:
    - name: content
      emptyDir: {}
  initContainers:
    # Step 1: fetch the content
    - name: fetch-content
      image: busybox:1.36
      command:
        - sh
        - -c
        - "echo '<h1>Shop status: OK</h1>' > /work/index.html"
      volumeMounts:
        - name: content
          mountPath: /work
    # Step 2: only runs after step 1 exits 0
    - name: fix-permissions
      image: busybox:1.36
      command: ["sh", "-c", "chmod 0644 /work/index.html && ls -l /work"]
      volumeMounts:
        - name: content
          mountPath: /work
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        - name: content
          mountPath: /usr/share/nginx/html # reads what the init containers wrote
          readOnly: true`,
      explanation:
        'This is the standard pattern for preparing content or configuration: the init containers own the tools, the app image stays minimal, and the emptyDir is the hand-off point.',
      placeholders: ['web-content', 'shop'],
    },
    {
      title: 'Init containers in a Deployment template',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      initContainers:
        - name: migrate
          image: registry.example.com/shop/migrate:1.4.2
          command: ["/app/migrate", "--up"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
      containers:
        - name: api
          image: registry.example.com/shop/api:1.4.2`,
      explanation:
        'Careful: with 3 replicas this migration runs three times, once per Pod, so it must be idempotent. If it is not, run the migration as a Job instead and keep the init container to a read-only readiness check.',
      placeholders: ['api', 'shop', 'db-credentials'],
    },
  ],
  imperative: [
    {
      command: 'kubectl logs api -c wait-for-postgres -n shop',
      what: 'Reads an init container\'s log - the direct answer to "why is this Pod still initialising?".',
      expected: 'The retry lines, then "postgres is accepting connections".',
      placeholders: ['api', 'wait-for-postgres', 'shop'],
    },
    {
      command: 'kubectl get pod api -n shop',
      what: 'The STATUS column reports `Init:N/M` while init containers run.',
      expected: 'Init:0/1, then PodInitializing, then Running.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get pod api -n shop -o jsonpath=\'{range .status.initContainerStatuses[*]}{.name}{": "}{.state}{"\\n"}{end}\'',
      what: 'Per-init-container state including exit code and termination reason.',
      expected: '{"terminated":{"exitCode":0,"reason":"Completed",...}} for a finished step.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl describe pod api -n shop | sed -n "/Init Containers/,/^Containers/p"',
      what: 'Isolates the Init Containers section of describe output.',
      expected: 'One block per init container with State and Exit Code.',
      placeholders: ['api', 'shop'],
    },
    {
      command:
        'kubectl get pod api -n shop -o jsonpath=\'{.status.conditions[?(@.type=="Initialized")].status}{"\\n"}\'',
      what: 'A single true/false answer to "has initialisation finished?".',
      expected: 'True',
      placeholders: ['api', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Add `spec.initContainers` above `spec.containers` - the order in the list is the execution order.',
      'Give each init container a command that exits 0 on success and non-zero on failure; a wait loop should have no timeout only if the Pod may legitimately wait forever.',
      'Share results through a volume mounted in both the init container and the app container.',
      'Give init containers small `resources.requests`; remember the Pod request is max(init, sum(app)).',
      'Apply through the workload controller - you cannot add an init container to a running Pod.',
    ],
    code: [
      {
        title: 'Add an init container to an existing Deployment',
        language: 'bash',
        code: `kubectl get deploy api -n shop -o yaml > api.yaml   # back up first
# edit api.yaml: add spec.template.spec.initContainers
kubectl apply -f api.yaml
kubectl rollout status deploy/api -n shop --timeout=180s

# Confirm the new Pods have it
kubectl get pods -n shop -l app=api \\
  -o jsonpath='{range .items[*]}{.metadata.name}{" init="}{.spec.initContainers[*].name}{"\\n"}{end}'`,
        placeholders: ['api', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pod web-content -n shop',
      what: 'A Pod whose init containers all succeeded reads Running with full readiness.',
      expected: 'READY 1/1, STATUS Running.',
      placeholders: ['web-content', 'shop'],
    },
    {
      command: 'kubectl exec web-content -n shop -- cat /usr/share/nginx/html/index.html',
      what: 'Proves the app container can see what the init containers wrote.',
      expected: '<h1>Shop status: OK</h1>',
      placeholders: ['web-content', 'shop'],
    },
    {
      command:
        'kubectl get pod web-content -n shop -o jsonpath=\'{range .status.initContainerStatuses[*]}{.name}={.state.terminated.exitCode}{" "}{end}{"\\n"}\'',
      what: 'Every init container should report exit code 0.',
      expected: 'fetch-content=0 fix-permissions=0',
      placeholders: ['web-content', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl get pod api -n shop',
      what: 'A Pod stuck at `Init:0/2` is waiting on the first init container; `Init:1/2` means the first finished.',
      expected: 'The N in Init:N/M tells you exactly which step to inspect.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl logs api -c wait-for-postgres -n shop --tail=20',
      what: "The blocking init container's own output, which almost always names the dependency it cannot reach.",
      expected: 'Repeated "not ready, retrying" lines.',
      placeholders: ['api', 'wait-for-postgres', 'shop'],
    },
    {
      command:
        'kubectl get pod api -n shop -o jsonpath="{.status.initContainerStatuses[0].lastState.terminated.exitCode}" && echo',
      what: 'The exit code of a failed init container, for when it crash-loops rather than hangs.',
      expected: 'A non-zero number.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl describe pod api -n shop | grep -iE "init|reason" ',
      what: 'Shows Init:CrashLoopBackOff and the reason together.',
      expected: 'Back-off restarting failed container wait-for-postgres.',
      placeholders: ['api', 'shop'],
    },
  ],
  commonMistakes: [
    'Expecting init containers to run in parallel. They are strictly sequential, in list order.',
    'Adding a readiness or liveness probe to an init container - those fields are not allowed there.',
    'Writing a wait loop with no exit condition and no dependency ever appearing, so the Pod sits at `Init:0/1` forever with no error.',
    'Running a non-idempotent migration as an init container in a multi-replica Deployment, so it runs once per Pod.',
    'Forgetting `-c <init-container>` when reading init container logs.',
    'Mounting the shared volume in the init container but not in the app container, so the prepared files are invisible.',
    'Trying to add an init container to a running Pod. Change the template and let the controller recreate.',
  ],
  examTips: [
    '`Init:0/1` is not an error - read it as "waiting on step 1 of 1" and go straight to that container\'s logs.',
    'A task phrased "the application must not start until X is available" is asking for an init container.',
    'A task phrased "prepare a file for the application" is asking for an init container plus a shared `emptyDir`.',
    'Remember the resource rule: Pod request = max(largest init request, sum of app requests).',
    'If the helper must keep running rather than finish, it is a native sidecar (`restartPolicy: Always`), not a plain init container.',
  ],
  summary: [
    'Init containers run sequentially to completion before any app container starts.',
    'They share volumes with app containers, which is how prepared work is handed over.',
    '`Init:N/M` and `PodInitializing` are normal statuses; the N tells you which step is active.',
    'No probes or lifecycle hooks on init containers.',
    '`restartPolicy: Always` on an init container makes it a native sidecar instead.',
  ],
  practice: [
    {
      id: 'init-p1',
      level: 'beginner',
      prompt: 'A Pod shows `Init:1/3`. What is happening, and which command do you run next?',
      answer:
        "The first of three init containers completed successfully and the second is running (or retrying). Run `kubectl logs <pod> -c <second-init-container>` - get the name from `kubectl get pod <pod> -o jsonpath='{.spec.initContainers[*].name}'`.",
      explanation:
        'Nothing has failed. If it stays at 1/3 for a long time, the second init container is either waiting on something or crash-looping - `kubectl describe pod` distinguishes the two.',
    },
    {
      id: 'init-p2',
      level: 'intermediate',
      prompt:
        'Write the init container that blocks until a Service named `redis` is accepting connections on port 6379.',
      answer:
        'initContainers:\n  - name: wait-for-redis\n    image: busybox:1.36\n    command: ["sh", "-c", "until nc -z redis 6379; do echo waiting for redis; sleep 2; done"]',
      explanation:
        '`nc -z` tests TCP connectivity and exits 0 on success, which is exactly the semantics an init container needs. Using the Service name relies on cluster DNS, so this also proves DNS works.',
    },
    {
      id: 'init-p3',
      level: 'advanced',
      prompt:
        'A Pod has one init container requesting 2Gi memory and two app containers requesting 512Mi each. What memory request does the scheduler use for the Pod, and why?',
      answer:
        '2Gi. The effective Pod request is max(largest init container request, sum of app container requests) = max(2Gi, 1Gi) = 2Gi, because init containers run before - and never at the same time as - the app containers, so the peak requirement is whichever is larger.',
      explanation:
        'This matters when a heavyweight init container makes an otherwise small Pod unschedulable. Native sidecars are different: because they run concurrently with the app containers, their requests are *added* to the app container sum.',
    },
  ],
  lab: {
    title: 'Ordered setup, a deliberate block, and a hand-off volume',
    scenario:
      'You will run two ordered init containers that prepare content for nginx, then create a Pod that blocks on a missing dependency and unblock it by creating that dependency - watching the status change live.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `init-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod `content` with two init containers: the first writes an HTML file into a shared emptyDir, the second lists it; nginx then serves it.',
      },
      { instruction: 'Prove nginx serves the file the init containers created.' },
      { instruction: 'Show the exit code of each init container.' },
      {
        instruction:
          'Create a Pod `blocked` whose init container waits for a Service named `later` on port 80; confirm it sits at Init:0/1.',
      },
      {
        instruction:
          'Create a Deployment and Service named `later`, and watch `blocked` finish initialising and start.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2',
        language: 'yaml',
        code: `# content.yaml
apiVersion: v1
kind: Pod
metadata:
  name: content
  namespace: init-lab
spec:
  volumes:
    - name: html
      emptyDir: {}
  initContainers:
    - name: write
      image: busybox:1.36
      command:
        - sh
        - -c
        - "echo '<h1>prepared by init</h1>' > /work/index.html; echo wrote file"
      volumeMounts:
        - name: html
          mountPath: /work
    - name: verify
      image: busybox:1.36
      command: ["sh", "-c", "ls -l /work && cat /work/index.html"]
      volumeMounts:
        - name: html
          mountPath: /work
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        - name: html
          mountPath: /usr/share/nginx/html
          readOnly: true`,
      },
      {
        title: 'Steps 3-4 - verify the hand-off',
        language: 'bash',
        code: `kubectl create namespace init-lab
kubectl config set-context --current --namespace=init-lab
kubectl apply -f content.yaml
kubectl wait --for=condition=Ready pod/content --timeout=120s

kubectl logs content -c write
# wrote file
kubectl logs content -c verify
# -rw-r--r--    1 root     root            26 Sep  3 12:45 index.html
# <h1>prepared by init</h1>

kubectl exec content -- wget -qO- http://127.0.0.1/
# <h1>prepared by init</h1>

kubectl get pod content -o jsonpath='{range .status.initContainerStatuses[*]}{.name}={.state.terminated.exitCode}{" "}{end}{"\\n"}'
# write=0 verify=0`,
      },
      {
        title: 'Step 5 - the deliberate block',
        language: 'yaml',
        code: `# blocked.yaml
apiVersion: v1
kind: Pod
metadata:
  name: blocked
  namespace: init-lab
spec:
  initContainers:
    - name: wait-for-later
      image: busybox:1.36
      command:
        - sh
        - -c
        - "until nc -z later 80; do echo waiting for later:80; sleep 2; done; echo later is up"
  containers:
    - name: app
      image: nginx:1.27-alpine`,
      },
      {
        title: 'Steps 5b-6 - block, then unblock',
        language: 'bash',
        code: `kubectl apply -f blocked.yaml
sleep 10
kubectl get pod blocked
# NAME      READY   STATUS     RESTARTS   AGE
# blocked   0/1     Init:0/1   0          10s

kubectl logs blocked -c wait-for-later --tail=3
# waiting for later:80
# waiting for later:80

# Now create the dependency
kubectl create deployment later --image=nginx:1.27-alpine
kubectl expose deployment later --port=80
kubectl rollout status deploy/later --timeout=120s

kubectl get pod blocked -w
# blocked   0/1   Init:0/1          0   45s
# blocked   0/1   PodInitializing   0   50s
# blocked   1/1   Running           0   52s      (Ctrl+C)

kubectl logs blocked -c wait-for-later --tail=1
# later is up`,
      },
      {
        title: 'Step 7 - cleanup',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace init-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec content -n init-lab -- wget -qO- http://127.0.0.1/',
        what: 'End-to-end proof the init containers prepared content the app serves.',
        expected: '<h1>prepared by init</h1>',
      },
      {
        command:
          'kubectl get pod blocked -n init-lab -o jsonpath=\'{.status.conditions[?(@.type=="Initialized")].status}{"\\n"}\'',
        what: 'False while blocked, True once the dependency exists.',
        expected: 'True after the `later` Service is created.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace init-lab',
        what: 'Removes all lab objects.',
        expected: 'namespace "init-lab" deleted',
      },
    ],
  },
  relatedTopicIds: [
    'multi-container-patterns',
    'volumes-and-ephemeral-storage',
    'pod-failure-modes',
  ],
  docs: [
    {
      title: 'Init containers',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/init-containers/',
    },
  ],
}
