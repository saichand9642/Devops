import type { Topic } from '../../../types'

export const containerLogs: Topic = {
  id: 'container-logs',
  title: 'Container and Pod logs',
  domainId: 'observability',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 1,
  tags: ['logs', 'kubectl logs', 'previous', 'follow', 'stern', 'since', 'stdout'],
  oneLiner:
    'Read the right log at the right moment: current versus previous container, one container versus all, one Pod versus a whole selector.',
  explanation: [
    'Kubernetes collects whatever a container writes to **stdout** and **stderr**. It does not read log files inside the container. An application that writes to `/var/log/app.log` produces no `kubectl logs` output at all - which is why containerised applications log to stdout.',
    "The container runtime writes those streams to files on the node, and `kubectl logs` reads them through the kubelet. That means logs survive a container restart (as the *previous* container's log) but not a Pod deletion, and not node log rotation.",
    '`kubectl logs <pod>` shows the current container instance. `kubectl logs <pod> --previous` shows the instance before the last restart - the only way to see why a crash-looping container died, because the current instance may not have logged anything yet.',
    'In a multi-container Pod you must name the container with `-c`, or use `--all-containers=true`. Without either, kubectl errors and helpfully lists the container names.',
    'For anything beyond one Pod, use a selector: `kubectl logs -l app=api --prefix --tail=20` reads from every matching Pod at once, which is how you inspect a Deployment rather than a Pod.',
  ],
  whyItMatters: [
    'The curriculum lists "utilize container logs" as a competency, and logs are the second command in every debugging sequence, after `describe`.',
    '`--previous` is the single most valuable log flag on the exam, because CrashLoopBackOff tasks are common and the current log is usually empty.',
    'Knowing that logs come from stdout/stderr explains the otherwise baffling "the app is definitely logging but kubectl logs shows nothing".',
  ],
  howItWorks: [
    "The kubelet keeps the last container instance's log for each container, which is what `--previous` reads. Two restarts back is gone - so read the log before the next restart cycle if you can.",
    '`--tail=N` limits output (default: everything for a named Pod, 10 lines when using a selector). `--since=5m` and `--since-time=<RFC3339>` limit by time. `--timestamps` prefixes each line with the collection time.',
    '`-f`/`--follow` streams new lines. Combine with `--tail` so you do not have to page through history first: `kubectl logs -f --tail=20 <pod>`.',
    'With a selector, kubectl interleaves output from all matching Pods; `--prefix` labels each line with its Pod and container so the output is readable.',
    "`kubectl logs deployment/api` reads from one Pod chosen by the Deployment's selector - convenient but not exhaustive. Use `-l` to see them all.",
    'Node-level log rotation is configured by the cluster, typically 10Mi per file with a few files retained. Long-running Pods therefore do not keep an unbounded history, which is why real clusters ship logs off-node.',
    "A terminated Pod's logs are readable until the Pod object is deleted. That is why `restartPolicy: Never` (which leaves failed Pods in place) is better for debugging than `OnFailure`.",
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Where kubectl logs gets its text',
      caption:
        'Only stdout and stderr reach kubectl logs. An app that writes to a file inside the container is invisible to it.',
      nodes: [
        {
          label: 'App writes to stdout and stderr',
          detail: 'Anything else is not a container log',
          tone: 'accent',
          branch: {
            label: 'App writes to /var/log/app.log',
            detail: 'kubectl logs shows nothing - use exec cat, or a sidecar',
          },
        },
        {
          label: 'The runtime captures both streams',
          detail: 'containerd writes them to the node filesystem',
          arrowLabel: 'per container',
        },
        {
          label: 'kubelet exposes them through the API',
          detail: 'One current log, plus one rotated previous log',
        },
        {
          label: 'kubectl logs reads them',
          detail: '-c for a container, --previous for the crashed one, -f to follow',
          tone: 'success',
          branch: {
            label: 'Pod was deleted',
            detail: 'The logs are gone with it. Nothing recovers them.',
          },
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'The log source. Its status tells you which log to read.',
      fields: [
        {
          path: 'status.containerStatuses[].restartCount',
          meaning: 'Non-zero means a --previous log exists.',
        },
        {
          path: 'status.containerStatuses[].lastState.terminated.reason',
          meaning: 'Why the previous instance ended: Error, OOMKilled, Completed.',
        },
        {
          path: 'status.containerStatuses[].lastState.terminated.exitCode',
          meaning: 'Exit code of the instance whose log --previous shows.',
        },
        { path: 'spec.containers[].name', meaning: 'What you pass to -c.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The empty log that hid a one-line error',
    story: [
      'A new service is in CrashLoopBackOff. An engineer runs `kubectl logs checkout-6d4b8f9c7-2xk4l` and gets nothing. They conclude the container is failing before the application starts and spend twenty minutes checking the image entrypoint.',
      'The actual output was there all along, in the previous instance: `kubectl logs checkout-6d4b8f9c7-2xk4l --previous` prints `FATAL: environment variable DATABASE_URL is not set`.',
      'The current log was empty because the container had just been restarted and was still in its backoff wait - there was no running instance to have logged anything yet.',
      'The reflex worth building: whenever RESTARTS is greater than zero, read `--previous` first. `kubectl describe` will confirm the restart count and the last termination reason in the same breath.',
    ],
    code: [
      {
        title: 'The two-command reflex',
        language: 'bash',
        code: `kubectl get pod checkout-6d4b8f9c7-2xk4l -n shop
# NAME                        READY   STATUS             RESTARTS      AGE
# checkout-6d4b8f9c7-2xk4l    0/1     CrashLoopBackOff   5 (30s ago)   4m

kubectl logs checkout-6d4b8f9c7-2xk4l -n shop
# (empty - the container is between restarts)

kubectl logs checkout-6d4b8f9c7-2xk4l -n shop --previous
# FATAL: environment variable DATABASE_URL is not set`,
        explanation:
          'RESTARTS greater than 0 is the signal that --previous exists and is probably the log you want.',
        placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'An application that logs where Kubernetes can see it',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: logger
  namespace: shop
spec:
  containers:
    - name: app
      image: busybox:1.36
      # Writing to stdout is what makes kubectl logs work.
      command:
        - sh
        - -c
        - |
          i=0
          while true; do
            echo "$(date -Iseconds) INFO  request handled id=$i"   # stdout
            if [ $((i % 5)) -eq 0 ]; then
              echo "$(date -Iseconds) ERROR upstream timeout id=$i" >&2   # stderr
            fi
            i=$((i+1))
            sleep 2
          done`,
      explanation:
        'Both stdout and stderr are collected and interleaved by `kubectl logs`. There is no way to fetch only stderr - if you need them separated, that is a job for a log pipeline, not kubectl.',
      placeholders: ['logger', 'shop'],
    },
    {
      title: 'A sidecar that exposes a log file as stdout',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: legacy-logger
  namespace: shop
spec:
  volumes:
    - name: logs
      emptyDir: {}
  initContainers:
    # Native sidecar: tails the file the app insists on writing, and
    # re-emits it on ITS stdout so kubectl logs -c tailer can read it.
    - name: tailer
      image: busybox:1.36
      restartPolicy: Always
      command: ["sh", "-c", "touch /logs/app.log; tail -F /logs/app.log"]
      volumeMounts:
        - name: logs
          mountPath: /logs
  containers:
    - name: legacy-app
      image: busybox:1.36
      # This application cannot be changed: it logs to a file.
      command: ["sh", "-c", "while true; do echo \\"$(date) to file\\" >> /var/log/app.log; sleep 3; done"]
      volumeMounts:
        - name: logs
          mountPath: /var/log`,
      explanation:
        'This is the standard remedy for software you cannot modify. `kubectl logs legacy-logger -c legacy-app` shows nothing useful; `kubectl logs legacy-logger -c tailer` shows the file contents.',
      placeholders: ['legacy-logger', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl logs checkout-6d4b8f9c7-2xk4l -n shop',
      what: "Reads the current container instance's log.",
      expected: 'The application output, newest last.',
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl logs checkout-6d4b8f9c7-2xk4l -n shop --previous',
      what: 'Reads the instance before the last restart - the crash-loop log.',
      expected: 'The fatal error that caused the exit.',
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl logs checkout-6d4b8f9c7-2xk4l -n shop -c app',
      what: 'Names a container. Required in multi-container Pods.',
      expected: "That container's log only.",
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'app', 'shop'],
    },
    {
      command: 'kubectl logs checkout-6d4b8f9c7-2xk4l -n shop --all-containers=true --prefix',
      what: 'Every container in the Pod, with each line labelled by container.',
      expected: 'Interleaved, prefixed output.',
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl logs -f --tail=20 checkout-6d4b8f9c7-2xk4l -n shop',
      what: 'Streams new lines after showing the last 20. Ctrl+C to stop.',
      expected: 'Live output.',
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl logs -l app=api -n shop --prefix --tail=50',
      what: 'Reads from every Pod matching the selector - the way to inspect a whole Deployment.',
      expected: 'Lines prefixed with [pod/<name>/<container>].',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl logs deployment/api -n shop --tail=100',
      what: 'Reads from one Pod of the Deployment. Convenient, but not all Pods.',
      expected: 'The last 100 lines from a single Pod.',
      placeholders: ['api', 'shop'],
    },
    {
      command: 'kubectl logs checkout-6d4b8f9c7-2xk4l -n shop --since=10m --timestamps',
      what: 'Limits output by time and adds collection timestamps.',
      expected: 'Only the last ten minutes, each line time-stamped.',
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
    },
    {
      command: 'kubectl logs job/migrate -n shop',
      what: "Reads from a Job's Pod. For a parallel Job use `-l batch.kubernetes.io/job-name=migrate` instead.",
      expected: 'The batch output.',
      placeholders: ['migrate', 'shop'],
    },
    {
      command: 'kubectl logs checkout-6d4b8f9c7-2xk4l -n shop > /tmp/checkout.log',
      what: 'Saves a log before the Pod is deleted or restarted again.',
      expected: 'A file you can grep without racing the restart cycle.',
      placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Design applications to write to stdout and stderr - no log files, no log rotation inside the container.',
      'If you cannot change the application, add a sidecar that tails its file to stdout.',
      'Use `restartPolicy: Never` for batch work so failed Pods (and their logs) remain readable.',
      'Do not rely on node-stored logs for retention; ship them off-node with a DaemonSet collector.',
    ],
    code: [
      {
        title: 'A log-reading routine that works under time pressure',
        language: 'bash',
        code: `POD=checkout-6d4b8f9c7-2xk4l
NS=shop

# 1. Is there a previous instance worth reading?
kubectl get pod $POD -n $NS -o jsonpath='{.status.containerStatuses[0].restartCount}{"\\n"}'

# 2. What containers exist?
kubectl get pod $POD -n $NS -o jsonpath='{range .spec.containers[*]}{.name}{" "}{end}{"\\n"}'

# 3. Read the log that matters, and save it
kubectl logs $POD -n $NS --previous --timestamps | tee /tmp/$POD.prev.log | tail -20`,
        placeholders: ['checkout-6d4b8f9c7-2xk4l', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl logs logger -n shop --tail=5',
      what: 'Confirms the application is producing output at all.',
      expected: 'Recent log lines.',
      placeholders: ['logger', 'shop'],
    },
    {
      command:
        'kubectl get pod logger -n shop -o jsonpath=\'{.status.containerStatuses[0].restartCount}{"\\n"}\'',
      what: 'Tells you whether `--previous` will return anything.',
      expected: '0 for a healthy Pod.',
      placeholders: ['logger', 'shop'],
    },
    {
      command: 'kubectl logs -l app=api -n shop --tail=1 --prefix | wc -l',
      what: 'Confirms you are reading from every Pod, not just one.',
      expected: 'A count equal to the number of Ready Pods.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl logs mypod -n shop',
      what: 'An empty result on a running Pod usually means the app logs to a file, not stdout.',
      expected: 'Output, or nothing - which is itself a finding.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl exec mypod -n shop -- ls -l /var/log',
      what: 'Confirms the suspicion: log files inside the container that Kubernetes never sees.',
      expected: 'app.log with a growing size.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl logs mypod -n shop --previous',
      what: 'Errors with "previous terminated container not found" if the container has never restarted.',
      expected: 'The previous log, or that error.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl describe pod mypod -n shop | grep -iA3 "last state"',
      what: 'When even --previous is empty, the termination reason and exit code still tell you what happened.',
      expected: 'Reason: OOMKilled, Exit Code: 137 - a kernel kill leaves no application log.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl logs mypod -n shop -c wrong-name',
      what: 'A wrong container name errors and lists the valid ones - a fast way to discover them.',
      expected: 'container wrong-name is not valid for pod mypod',
      placeholders: ['mypod', 'shop'],
    },
  ],
  commonMistakes: [
    'Forgetting `--previous` on a crash-looping Pod and concluding "there are no logs".',
    'Omitting `-c` in a multi-container Pod and stopping at the error instead of reading the container list it prints.',
    'Expecting `kubectl logs` to show a file the application writes. Only stdout and stderr are collected.',
    'Using `kubectl logs deployment/api` and believing you have seen all replicas. It reads one Pod.',
    'Deleting a failed Pod before reading its log - the log goes with the Pod object.',
    'Streaming with `-f` and no `--tail`, then scrolling through hours of history.',
    'Relying on node logs for retention; rotation discards them and a node replacement loses them entirely.',
  ],
  examTips: [
    'RESTARTS > 0 → run `kubectl logs <pod> --previous` immediately.',
    'If a task says "save the logs to a file", it means `kubectl logs <pod> > /path/file` - and the grader will check the file.',
    '`kubectl logs -l <selector> --prefix` is the fastest way to scan a whole Deployment.',
    'When `logs` errors about a container name, read the list in the error - do not go looking it up.',
    '`kubectl logs` before `kubectl exec`: if the log answers the question you do not need a shell.',
    'Remember `describe` comes first. If the container never started, there is nothing to log.',
  ],
  summary: [
    'Kubernetes collects stdout and stderr only; log files inside the container are invisible.',
    '`--previous` reads the instance before the last restart, and is the crash-loop log.',
    '`-c` names a container; `--all-containers` reads them all; `-l` reads across Pods.',
    '`--tail`, `--since` and `--timestamps` make large logs usable; `-f` streams.',
    'Logs live on the node and disappear with the Pod, so save them before deleting anything.',
  ],
  practice: [
    {
      id: 'log-p1',
      level: 'beginner',
      prompt: 'A Pod has RESTARTS 4 and `kubectl logs <pod>` is empty. What is the next command?',
      answer: 'kubectl logs <pod> --previous',
      explanation:
        'The current instance is in its restart backoff and has not logged yet. `--previous` reads the instance that actually failed. Follow up with `kubectl describe pod <pod>` for the exit code.',
    },
    {
      id: 'log-p2',
      level: 'intermediate',
      prompt:
        'Write the command that shows the last 30 log lines from every Pod labelled `app=api` in namespace `shop`, with each line identifying its Pod.',
      answer: 'kubectl logs -l app=api -n shop --tail=30 --prefix',
      explanation:
        'Without `--tail`, a selector-based read defaults to only 10 lines per Pod. `--prefix` adds `[pod/<name>/<container>]` to each line, which is essential once you are reading from several Pods.',
    },
    {
      id: 'log-p3',
      level: 'advanced',
      prompt:
        'An application writes to `/var/log/app.log` and cannot be changed. Describe the Kubernetes-native fix and the command that then reads the log.',
      answer:
        "Add a native sidecar (an `initContainers` entry with `restartPolicy: Always`) that mounts the same `emptyDir` as the app and runs `tail -F /logs/app.log`, so the file content becomes the sidecar's stdout.\n\nRead it with: `kubectl logs <pod> -c <sidecar-name>`",
      explanation:
        'A native sidecar rather than a regular one guarantees the tailer is running before the app starts writing, and means the pattern also works inside a Job without blocking completion.',
    },
  ],
  lab: {
    title: 'Read every kind of log',
    scenario:
      'You will read a healthy log, a crash-loop log via --previous, a specific container in a multi-container Pod, a whole Deployment by selector, and expose a file-logging application through a sidecar.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `log-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod `talker` that prints a numbered line to stdout every second; read the last 5 lines and then stream it.',
      },
      {
        instruction:
          'Create a Pod `crasher` that prints an error and exits 1 with the default restart policy; read its log with --previous.',
      },
      {
        instruction:
          'Create a Deployment `api` with 3 replicas of a Pod that prints its own hostname; read logs from all three with one command.',
      },
      {
        instruction:
          'Create a Pod `filelogger` where the app writes to a file and a native sidecar tails it; prove the app container log is empty and the sidecar log is not.',
      },
      { instruction: "Save the crasher's previous log to a file." },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - a healthy log',
        language: 'bash',
        code: `kubectl create namespace log-lab
kubectl config set-context --current --namespace=log-lab

kubectl run talker --image=busybox:1.36 --command -- \\
  sh -c 'i=0; while true; do echo "line $i"; i=$((i+1)); sleep 1; done'
kubectl wait --for=condition=Ready pod/talker --timeout=60s

sleep 6
kubectl logs talker --tail=5
# line 1
# line 2
# ...

kubectl logs -f --tail=3 talker    # Ctrl+C after a few lines

kubectl logs talker --timestamps --tail=3
# 2026-09-03T13:10:05.123456789Z line 6`,
      },
      {
        title: 'Step 3 - the crash-loop log',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: crasher
  namespace: log-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo 'FATAL: config missing'; exit 1"]
YAML

sleep 30
kubectl get pod crasher
# crasher   0/1   CrashLoopBackOff   2   30s

kubectl logs crasher || true
# either empty, or the message if you catch a running instance

kubectl logs crasher --previous
# FATAL: config missing

kubectl describe pod crasher | grep -A4 "Last State"
#     Last State:     Terminated
#       Reason:       Error
#       Exit Code:    1`,
      },
      {
        title: 'Step 4 - logs across a Deployment',
        language: 'bash',
        code: `kubectl create deployment api --image=busybox:1.36 --replicas=3 -- \\
  sh -c 'while true; do echo "hello from $(hostname)"; sleep 5; done'
kubectl rollout status deploy/api --timeout=120s

sleep 6
kubectl logs -l app=api --tail=1 --prefix
# [pod/api-6d4b8f9c7-2xk4l/busybox] hello from api-6d4b8f9c7-2xk4l
# [pod/api-6d4b8f9c7-8n7pq/busybox] hello from api-6d4b8f9c7-8n7pq
# [pod/api-6d4b8f9c7-hj4rt/busybox] hello from api-6d4b8f9c7-hj4rt

# Compare with the single-Pod shortcut:
kubectl logs deployment/api --tail=1
# only ONE Pod's line`,
      },
      {
        title: 'Step 5 - the sidecar that exposes a file',
        language: 'yaml',
        code: `# filelogger.yaml
apiVersion: v1
kind: Pod
metadata:
  name: filelogger
  namespace: log-lab
spec:
  volumes:
    - name: logs
      emptyDir: {}
  initContainers:
    - name: tailer
      image: busybox:1.36
      restartPolicy: Always
      command: ["sh", "-c", "touch /logs/app.log; tail -F /logs/app.log"]
      volumeMounts:
        - name: logs
          mountPath: /logs
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - 'while true; do echo "$(date) written to file" >> /var/log/app.log; sleep 3; done'
      volumeMounts:
        - name: logs
          mountPath: /var/log`,
      },
      {
        title: 'Steps 5b-7 - prove it, save it, clean up',
        language: 'bash',
        code: `kubectl apply -f filelogger.yaml
kubectl wait --for=condition=Ready pod/filelogger --timeout=90s
sleep 8

kubectl logs filelogger -c app
# (empty - the app writes to a file, so Kubernetes sees nothing)

kubectl logs filelogger -c tailer --tail=3
# Wed Sep  3 13:12:00 UTC 2026 written to file
# ... the file content, now visible via the sidecar's stdout

kubectl logs filelogger
# error: a container name must be specified for pod filelogger,
# choose one of: [app] or one of the init containers: [tailer]

# Save a log before it disappears
kubectl logs crasher --previous > /tmp/crasher-previous.log
cat /tmp/crasher-previous.log

kubectl config set-context --current --namespace=default
kubectl delete namespace log-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl logs crasher -n log-lab --previous',
        what: 'The crash-loop log must be readable even though the current instance has none.',
        expected: 'FATAL: config missing',
      },
      {
        command: 'kubectl logs -l app=api -n log-lab --tail=1 --prefix | wc -l',
        what: 'Confirms the selector read from all three replicas.',
        expected: '3',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace log-lab',
        what: 'Removes every Pod created by the lab.',
        expected: 'namespace "log-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['debugging-pods', 'pod-failure-modes', 'multi-container-patterns'],
  docs: [
    {
      title: 'Logging architecture',
      url: 'https://kubernetes.io/docs/concepts/cluster-administration/logging/',
    },
    {
      title: 'Debug running Pods',
      url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/',
    },
  ],
}
