import type { Topic } from '../../../types'

export const debuggingPods: Topic = {
  id: 'debugging-pods',
  title: 'Debugging in Kubernetes: exec, debug containers, port-forward',
  domainId: 'observability',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 4,
  tags: ['exec', 'kubectl debug', 'ephemeral containers', 'port-forward', 'cp', 'distroless'],
  oneLiner:
    'Get inside a running Pod, attach a debug container to one that has no shell, copy files out, and reach a Pod directly from your laptop.',
  explanation: [
    'When logs and events are not enough, you need to interact with the running system. Kubernetes gives you four tools, in roughly increasing order of intrusiveness.',
    '`kubectl exec` runs a command in an existing container. It needs the binary you want to run to be present in the image - which is exactly the problem with minimal and distroless images that contain no shell.',
    "`kubectl debug` solves that. It can attach an **ephemeral container** to a running Pod (your choice of image, sharing the Pod's network namespace and optionally its process namespace), create a **copy** of a Pod with a modified spec, or give you a privileged shell on a **node**.",
    '`kubectl port-forward` tunnels a local port to a Pod or Service port through the API server. It bypasses Services, Ingress and NetworkPolicies, which makes it the cleanest way to answer "is the application itself working?".',
    '`kubectl cp` copies files in and out of a container - useful for retrieving a heap dump or a log file, and it needs `tar` in the container image.',
  ],
  whyItMatters: [
    '"Debugging in Kubernetes" is a named curriculum competency, and ephemeral debug containers are the modern answer that many candidates have never used.',
    '`kubectl port-forward` is the fastest way to separate "the application is broken" from "the Service, Ingress or NetworkPolicy is broken" - a distinction that appears in most networking tasks.',
    'Knowing `kubectl debug` means a distroless image is not a dead end, which is increasingly common in real clusters.',
  ],
  howItWorks: [
    '`kubectl exec -it <pod> -- <cmd>`: `-i` keeps stdin open, `-t` allocates a TTY, and everything after `--` runs in the container. Add `-c <container>` in multi-container Pods.',
    "`kubectl debug -it <pod> --image=busybox:1.36 --target=<container>`: adds an ephemeral container to the *running* Pod. It shares the Pod's network namespace (so `localhost` reaches the app) and, with `--target`, the target container's process namespace (so you can see and inspect its processes and `/proc`).",
    "Ephemeral containers cannot be removed, and they have no resource requests, no probes and no restart. They disappear when the Pod does. They are added via the Pod's `ephemeralcontainers` subresource, not by editing the spec.",
    '`kubectl debug <pod> --copy-to=<newname> --image=<img> --share-processes`: creates a *new* Pod based on the original, optionally with a different image or command. Use this when the original is crash-looping and you need to change the entrypoint to keep it alive.',
    '`kubectl debug node/<node> -it --image=busybox:1.36`: creates a Pod on that node with the host filesystem mounted at `/host` and host namespaces shared. This is more of a CKA tool but worth recognising.',
    '`kubectl port-forward pod/<pod> 8080:80` maps local 8080 to container port 80. It works even when the Pod is not Ready and has no Service, because it goes through the API server rather than the data path.',
    '`kubectl cp <pod>:/path/in/container ./local` requires `tar` in the container. For images without it, an ephemeral container that mounts the same volumes is the alternative.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The four-command debugging routine',
      caption:
        'Always in this order. Each command answers a different question, and describe answers most of them.',
      nodes: [
        {
          label: 'kubectl get pod -o wide',
          detail: 'Phase, READY count, RESTARTS, node, IP',
          tone: 'accent',
        },
        {
          label: 'kubectl describe pod',
          detail: 'Read Events at the bottom first, then container State',
          arrowLabel: 'why is it in that state?',
        },
        {
          label: 'kubectl logs, then logs --previous',
          detail: '--previous is the only way to see a crashed container',
          arrowLabel: 'what did the app say?',
        },
        {
          label: 'kubectl exec -it -- sh',
          detail: 'Only useful if the container is actually running',
          arrowLabel: 'look from inside',
          branch: {
            label: 'No shell in the image',
            detail: 'Use kubectl debug to attach an ephemeral container',
          },
        },
        {
          label: 'You know the cause',
          detail: 'Fix the manifest, not the live Pod',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Where the answer lives, by symptom',
      caption:
        'Pending and image problems are cluster-side, so describe has the answer. Crashes are app-side, so logs do.',
      question: 'What does kubectl get pod show?',
      branches: [
        {
          condition: 'Pending',
          result: 'describe pod, Events',
          detail: 'Unschedulable, insufficient CPU, unbound PVC',
          tone: 'accent',
        },
        {
          condition: 'ImagePullBackOff or ErrImagePull',
          result: 'describe pod, Events',
          detail: 'The exact registry error is quoted there',
        },
        {
          condition: 'CrashLoopBackOff',
          result: 'logs --previous',
          detail: 'The container is already gone; only the previous log remains',
        },
        {
          condition: 'Running but READY 0/1',
          result: 'describe pod, readiness probe',
          detail: 'The probe failure message names the path and port',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Debugging targets and the ephemeral container list.',
      fields: [
        {
          path: 'spec.ephemeralContainers[]',
          meaning:
            'Debug containers added at runtime. Written via the ephemeralcontainers subresource, never by apply.',
        },
        {
          path: 'spec.ephemeralContainers[].targetContainerName',
          meaning: "Which container's process namespace to join (set by --target).",
        },
        {
          path: 'spec.shareProcessNamespace',
          meaning:
            "true lets all containers in the Pod see each other's processes; must be set at creation.",
        },
        { path: 'status.ephemeralContainerStatuses[]', meaning: 'State of each debug container.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Debugging a distroless image with no shell',
    story: [
      'A Go service ships in a distroless image: no shell, no `ls`, no `curl`, about 15 MB. It is returning 500s and the logs only say `upstream error`.',
      '`kubectl exec -it checkout-6d4b8f9c7-2xk4l -- sh` fails with `exec: "sh": executable file not found in $PATH`. There is nothing to exec into.',
      "`kubectl debug -it checkout-6d4b8f9c7-2xk4l --image=nicolaka/netshoot --target=api` attaches a fully equipped debug container to the running Pod. Because it shares the Pod's network namespace, `curl http://localhost:8080/readyz` and `nslookup postgres` both run as if from inside the application container.",
      '`nslookup postgres` returns NXDOMAIN. The application was configured with the service name `postgres` but the Service is actually called `postgres-primary` - a configuration error, found in ninety seconds without touching the application image.',
      'The debug container disappeared with the Pod. The production image stayed 15 MB with no shell, which was the point of using distroless in the first place.',
    ],
    code: [
      {
        title: 'exec fails, debug succeeds',
        language: 'bash',
        code: `kubectl exec -it checkout-6d4b8f9c7-2xk4l -n shop -- sh
# error: Internal error occurred: failed to exec in container:
# ... exec: "sh": executable file not found in $PATH

kubectl debug -it checkout-6d4b8f9c7-2xk4l -n shop \\
  --image=busybox:1.36 --target=api
# Targeting container "api". If you don't see processes from this container,
# the container runtime doesn't support this feature.
# Defaulting debug container name to debugger-8xk2m.

/ # wget -qO- http://localhost:8080/readyz     # same network namespace
/ # nslookup postgres
# ** server can't find postgres: NXDOMAIN      <- the actual bug
/ # exit`,
        explanation:
          "`--target` is what gives you the target container's process namespace. Without it you still share the network namespace, which is usually enough for connectivity debugging.",
        placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop', 'api'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'What an ephemeral container looks like on the Pod',
      language: 'yaml',
      code: `# kubectl get pod checkout-... -o yaml   (after kubectl debug)
spec:
  ephemeralContainers:
    - name: debugger-8xk2m
      image: busybox:1.36
      imagePullPolicy: IfNotPresent
      stdin: true
      tty: true
      targetContainerName: api # shares this container's process namespace
      terminationMessagePolicy: File
      # Note what is ABSENT: no resources, no probes, no restartPolicy.
      # Ephemeral containers are not part of the Pod's scheduling or health.
status:
  ephemeralContainerStatuses:
    - name: debugger-8xk2m
      ready: false
      restartCount: 0
      state:
        running:
          startedAt: "2026-09-03T13:20:11Z"`,
      explanation:
        'You cannot add this by editing the Pod and applying - the API rejects it. Ephemeral containers go through their own subresource, which `kubectl debug` uses.',
    },
    {
      title: 'A Pod designed to be debuggable',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: debuggable
  namespace: shop
spec:
  # Set at creation time: lets containers see each other's processes.
  # Cannot be added later, so include it if you know you will need it.
  shareProcessNamespace: true
  volumes:
    - name: dumps
      emptyDir: {}
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      ports:
        - containerPort: 8080
      volumeMounts:
        # A shared volume gives a debug container somewhere to write dumps
        # that you can then retrieve with kubectl cp.
        - name: dumps
          mountPath: /dumps`,
      explanation:
        '`shareProcessNamespace` is immutable after creation. If you might need `ps` across containers, or a debug container that can send signals to the app, set it up front.',
      placeholders: ['debuggable', 'shop', 'registry.example.com/shop/api:1.4.2'],
    },
  ],
  imperative: [
    {
      command: 'kubectl exec -it api-6d4b8f9c7-2xk4l -n shop -- sh',
      what: 'Interactive shell in a container that has one.',
      expected: 'A shell prompt.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl exec api-6d4b8f9c7-2xk4l -n shop -c app -- env | sort',
      what: 'Runs one command without a TTY - ideal for checking environment variables or configuration files.',
      expected: "The container's environment, including injected ConfigMap and Secret values.",
      placeholders: ['api-6d4b8f9c7-2xk4l', 'app', 'shop'],
    },
    {
      command: 'kubectl debug -it api-6d4b8f9c7-2xk4l -n shop --image=busybox:1.36 --target=app',
      what: "Attaches an ephemeral debug container to a running Pod, sharing its network and the target's process namespace.",
      expected: 'A shell prompt in the debug container.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop', 'app'],
    },
    {
      command:
        'kubectl debug api-6d4b8f9c7-2xk4l -n shop --copy-to=api-debug --container=app -- sleep 3600',
      what: 'Copies the Pod with a replaced command, so a crash-looping container stays alive for inspection.',
      expected: 'pod/api-debug created, Running.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command:
        'kubectl debug api-6d4b8f9c7-2xk4l -n shop --copy-to=api-shell --image=busybox:1.36 --share-processes -it',
      what: 'A copy with an extra debug container and a shared process namespace.',
      expected: 'A shell where `ps aux` shows the application processes.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl port-forward pod/api-6d4b8f9c7-2xk4l -n shop 8080:8080',
      what: 'Tunnels localhost:8080 to the Pod. Works even for a not-Ready Pod with no Service.',
      expected: 'Forwarding from 127.0.0.1:8080 -> 8080',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl port-forward svc/api -n shop 8080:80',
      what: 'Forwards to a Service, which picks one of its Ready endpoint Pods.',
      expected: 'Forwarding from 127.0.0.1:8080 -> 8080',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl cp shop/api-6d4b8f9c7-2xk4l:/dumps/heap.hprof ./heap.hprof',
      what: 'Copies a file out of a container. Requires tar in the image.',
      expected: 'A local file.',
      placeholders: ['shop', 'api-6d4b8f9c7-2xk4l'],
    },
    {
      command: 'kubectl cp ./fix.conf shop/api-6d4b8f9c7-2xk4l:/tmp/fix.conf -c app',
      what: 'Copies a file in - useful for testing a configuration change before making it permanent.',
      expected: 'No output on success.',
      placeholders: ['shop', 'api-6d4b8f9c7-2xk4l', 'app'],
    },
    {
      command: 'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh',
      what: 'A throwaway Pod in the same namespace, deleted on exit. The workhorse for DNS and connectivity tests.',
      expected: 'A shell prompt; the Pod disappears when you exit.',
      placeholders: ['tmp', 'shop'],
    },
    {
      command: 'kubectl attach -it api-6d4b8f9c7-2xk4l -n shop -c app',
      what: "Attaches to the main process's stdin/stdout rather than starting a new process. Rarely what you want, but occasionally the only way to interact with an interactive process.",
      expected: "The container's live output.",
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop', 'app'],
    },
  ],
  declarative: {
    steps: [
      'Debugging is imperative by nature, but two spec choices make it possible later: `shareProcessNamespace: true` (immutable after creation) and a shared `emptyDir` for dumps.',
      'Keep production images minimal, and rely on `kubectl debug` rather than shipping a shell and a package manager.',
      'When a task needs a persistent debug surface, prefer `--copy-to` so you never modify the object under investigation.',
    ],
    code: [
      {
        title: 'An escalation ladder',
        language: 'bash',
        code: `POD=api-6d4b8f9c7-2xk4l
NS=shop

# 1. Cheapest: does the object explain itself?
kubectl describe pod $POD -n $NS | tail -20
kubectl logs $POD -n $NS --previous 2>/dev/null || kubectl logs $POD -n $NS

# 2. Is the app itself healthy, bypassing all networking?
kubectl port-forward pod/$POD -n $NS 8080:8080 &
sleep 2 && curl -sS -o /dev/null -w '%{http_code}\\n' localhost:8080/readyz
kill %1

# 3. Look inside (if the image has a shell)
kubectl exec -it $POD -n $NS -- sh -c 'env | sort; ls -l /etc/config'

# 4. No shell? Attach one.
kubectl debug -it $POD -n $NS --image=busybox:1.36 --target=api

# 5. Crash-looping so nothing stays up? Copy it with a harmless command.
kubectl debug $POD -n $NS --copy-to=\${POD}-debug --container=api -- sleep 3600
kubectl exec -it \${POD}-debug -n $NS -c api -- sh`,
        explanation:
          'Work down the ladder, not up. Steps 1 and 2 answer most questions and change nothing about the running system.',
        placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl get pod api-6d4b8f9c7-2xk4l -n shop -o jsonpath=\'{range .status.ephemeralContainerStatuses[*]}{.name}{": "}{.state}{"\\n"}{end}\'',
      what: 'Confirms a debug container attached and is running.',
      expected: 'debugger-xxxxx: {"running":{...}}',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl exec api-6d4b8f9c7-2xk4l -n shop -- ls -l /etc/config',
      what: 'Verifies a mounted ConfigMap or Secret is actually present with the expected keys.',
      expected: 'The projected files as symlinks.',
      placeholders: ['api-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'curl -sS -o /dev/null -w "%{http_code}\\n" localhost:8080/readyz',
      what: 'With a port-forward running, tests the application directly with no Service or Ingress involved.',
      expected: '200',
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl exec -it mypod -n shop -- sh',
      what: 'The "no shell" error tells you to switch to `kubectl debug`.',
      expected: 'exec: "sh": executable file not found in $PATH',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl debug -it mypod -n shop --image=busybox:1.36',
      what: 'Works where exec cannot, because it brings its own image.',
      expected: 'A shell prompt.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl port-forward pod/mypod -n shop 8080:8080',
      what: 'If this works but the Service does not, the problem is the Service, endpoints or a NetworkPolicy - not the application.',
      expected: 'Forwarding lines, then successful local requests.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl debug mypod -n shop --copy-to=mypod-debug --container=app -- sleep 3600',
      what: 'The standard technique for a CrashLoopBackOff container: replace the command so the container stays up and you can look around.',
      expected: 'pod/mypod-debug created.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl exec mypod -n shop -- cat /etc/resolv.conf',
      what: "Confirms the Pod's DNS configuration when name resolution is suspect.",
      expected: 'nameserver 10.96.0.10 and a search list ending in svc.cluster.local.',
      placeholders: ['mypod', 'shop'],
    },
  ],
  commonMistakes: [
    'Forgetting `--` before the command in `kubectl exec`, so kubectl tries to interpret your flags.',
    'Omitting `-c <container>` in a multi-container Pod and being confused by which container you landed in.',
    'Trying to `kubectl exec` into a distroless image instead of using `kubectl debug`.',
    'Expecting to remove an ephemeral container. You cannot - it lives until the Pod does.',
    'Trying to add `spec.ephemeralContainers` with `kubectl apply`. It must go through the subresource, which is what `kubectl debug` does.',
    'Trying to set `shareProcessNamespace` on an existing Pod. It is immutable; use `kubectl debug --copy-to --share-processes` instead.',
    'Using `kubectl exec` on a crash-looping Pod - there is no running container to exec into. Use `--copy-to` with a replaced command.',
    'Assuming `kubectl port-forward` proves the Service works. It deliberately bypasses the Service.',
  ],
  examTips: [
    '`kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh` is the single most useful debugging command in the exam. Memorise it.',
    'No shell in the image → `kubectl debug -it <pod> --image=busybox:1.36 --target=<container>`.',
    'CrashLoopBackOff and you need to look inside → `kubectl debug <pod> --copy-to=<name> --container=<c> -- sleep 3600`.',
    '`kubectl port-forward` is how you prove the application works when a task says "the Service is not reachable" - it isolates the layer.',
    'Remember `kubectl exec <pod> -- env` for checking injected configuration; it is faster than describing the Pod and reading the spec.',
    '`kubectl cp` needs `tar` in the image; if it fails, that is why.',
  ],
  summary: [
    '`exec` runs in an existing container and needs the binary present; `debug` brings its own image.',
    'Ephemeral containers attach to a running Pod, share its network namespace, and cannot be removed.',
    "`--target` also shares the target container's process namespace; `--copy-to` builds a modified copy for crash-looping Pods.",
    '`port-forward` bypasses Services and NetworkPolicies, isolating "is the app working?" from "is the routing working?".',
    'The escalation order is describe → logs → port-forward → exec → debug → copy.',
  ],
  practice: [
    {
      id: 'dbg-p1',
      level: 'beginner',
      prompt:
        'Write the command that starts a temporary interactive busybox Pod in namespace `shop` which deletes itself when you exit.',
      answer: 'kubectl run tmp --rm -it --restart=Never -n shop --image=busybox:1.36 -- sh',
      explanation:
        '`--restart=Never` makes it a bare Pod (not a Deployment), `--rm` deletes it on exit, and `-it` gives you a TTY. This is the Pod you will use for every DNS and connectivity test.',
    },
    {
      id: 'dbg-p2',
      level: 'intermediate',
      prompt:
        'A Pod runs a distroless image and is returning errors. `kubectl exec -- sh` fails. Give the command that gets you a shell able to reach the application on localhost.',
      answer: 'kubectl debug -it <pod> -n <ns> --image=busybox:1.36 --target=<container-name>',
      explanation:
        "The ephemeral container shares the Pod's network namespace, so `wget -qO- http://localhost:<port>/` reaches the application exactly as the app itself would. `--target` additionally shares the target container's process namespace so `ps` shows its processes.",
    },
    {
      id: 'dbg-p3',
      level: 'advanced',
      prompt:
        'A Pod is in CrashLoopBackOff. You need to inspect its filesystem and mounted config, but no container stays running. Give the command and explain why `kubectl debug --target` will not help.',
      answer:
        'kubectl debug <pod> -n <ns> --copy-to=<pod>-debug --container=<container> -- sleep 3600\nkubectl exec -it <pod>-debug -n <ns> -c <container> -- sh\n\n`--target` attaches to a *running* container and shares its namespaces; a crash-looping container has no running instance to attach to. `--copy-to` instead creates a new Pod from the same spec (same image, volumes and config) with the command replaced by `sleep`, so the container stays up with the identical filesystem and mounts.',
      explanation:
        'Remember to delete the copy when you are finished - it is a real Pod and, unlike an ephemeral container, it will keep running. Also note the copy is not managed by the original Deployment.',
    },
  ],
  lab: {
    title: 'Work down the debugging ladder',
    scenario:
      'You will exec into a normal Pod, attach a debug container to one with no shell, port-forward to a Pod with no Service, and copy a Pod that will not stay running.',
    prerequisites: ['A cluster on Kubernetes 1.25 or later (ephemeral containers are stable)'],
    tasks: [
      { instruction: 'Create namespace `dbg-lab` and set it as default.' },
      {
        instruction:
          'Create an nginx Pod `web` and exec into it to read its environment and confirm it listens on port 80.',
      },
      {
        instruction:
          'Port-forward to `web` on local port 8080 and fetch its index page - without creating a Service.',
      },
      {
        instruction:
          'Attach an ephemeral busybox container to `web` with --target and confirm it can reach nginx on localhost.',
      },
      { instruction: 'Show the ephemeral container on the Pod object.' },
      {
        instruction:
          'Create a Pod `broken` that exits immediately, then use --copy-to to create an inspectable copy.',
      },
      { instruction: 'Copy a file out of the nginx container with kubectl cp.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - exec',
        language: 'bash',
        code: `kubectl create namespace dbg-lab
kubectl config set-context --current --namespace=dbg-lab

kubectl run web --image=nginx:1.27-alpine
kubectl wait --for=condition=Ready pod/web --timeout=90s

kubectl exec web -- env | sort | head -5
# HOSTNAME=web
# HOME=/root
# ...

kubectl exec web -- sh -c 'wget -qO- http://127.0.0.1:80 | head -4'
# <!DOCTYPE html> ...

kubectl exec -it web -- sh -c 'ls /etc/nginx/conf.d; exit'`,
      },
      {
        title: 'Step 3 - port-forward, no Service needed',
        language: 'bash',
        code: `kubectl port-forward pod/web 8080:80 &
# Forwarding from 127.0.0.1:8080 -> 80
sleep 2

curl -sS -o /dev/null -w 'status=%{http_code}\\n' http://localhost:8080/
# status=200

kill %1

# Note: there is NO Service in this namespace. port-forward goes through the
# API server, so it proves the application works independently of Services,
# Ingress and NetworkPolicies.
kubectl get svc
# No resources found in dbg-lab namespace.`,
      },
      {
        title: 'Steps 4-5 - ephemeral debug container',
        language: 'bash',
        code: `kubectl debug -it web --image=busybox:1.36 --target=web
# Targeting container "web". ...
# Defaulting debug container name to debugger-xxxxx.

# Inside the debug container:
#   / # wget -qO- http://127.0.0.1:80 | head -2      <- shared network namespace
#   / # ps -o pid,args                                <- shared PID namespace (--target)
#   / # nslookup kubernetes.default
#   / # exit

kubectl get pod web -o jsonpath='{range .spec.ephemeralContainers[*]}{.name}{" image="}{.image}{" target="}{.targetContainerName}{"\\n"}{end}'
# debugger-xxxxx image=busybox:1.36 target=web

kubectl get pod web
# READY 1/1 - ephemeral containers do not count towards readiness`,
      },
      {
        title: 'Step 6 - copy a crash-looping Pod',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: broken
  namespace: dbg-lab
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo 'cannot start'; exit 1"]
YAML

sleep 25
kubectl get pod broken
# broken   0/1   CrashLoopBackOff   2   25s

# exec is impossible - nothing is running
kubectl exec -it broken -- sh || echo "as expected: no running container"

# Copy it with a harmless command instead
kubectl debug broken --copy-to=broken-debug --container=app -- sleep 3600
kubectl wait --for=condition=Ready pod/broken-debug --timeout=90s

kubectl exec -it broken-debug -c app -- sh -c 'echo inside; ls /; exit'
# inside
# bin  dev  etc  home ...

# Same image, same volumes, same config - just a different command.
kubectl get pod broken-debug -o jsonpath='{.spec.containers[0].command}{"\\n"}'
# ["sleep","3600"]`,
      },
      {
        title: 'Steps 7-8 - cp and cleanup',
        language: 'bash',
        code: `kubectl cp dbg-lab/web:/etc/nginx/nginx.conf ./nginx.conf
head -3 ./nginx.conf
# user  nginx;
# worker_processes  auto;

# And copy something in
echo "test" > ./probe.txt
kubectl cp ./probe.txt dbg-lab/web:/tmp/probe.txt
kubectl exec web -- cat /tmp/probe.txt
# test

rm -f ./nginx.conf ./probe.txt
kubectl delete pod broken-debug
kubectl config set-context --current --namespace=default
kubectl delete namespace dbg-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get pod web -n dbg-lab -o jsonpath=\'{.spec.ephemeralContainers[0].name}{"\\n"}\'',
        what: 'Confirms the ephemeral container is recorded on the Pod.',
        expected: 'debugger-<random>',
      },
      {
        command:
          'kubectl get pod broken-debug -n dbg-lab -o jsonpath=\'{.status.phase}{" "}{.spec.containers[0].command}{"\\n"}\'',
        what: 'The copy should be Running with the replaced command.',
        expected: 'Running ["sleep","3600"]',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace dbg-lab',
        what: 'Removes every Pod including the debug copy.',
        expected: 'namespace "dbg-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['pod-failure-modes', 'container-logs', 'troubleshooting-networking'],
  docs: [
    {
      title: 'Debug running Pods',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/',
    },
    {
      title: 'Ephemeral containers',
      url: 'https://kubernetes.io/docs/concepts/workloads/pods/ephemeral-containers/',
    },
    {
      title: 'Use port forwarding to access applications',
      url: 'https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/',
    },
  ],
}
