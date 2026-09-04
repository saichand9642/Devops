import type { Topic } from '../../../types'

export const commandsAndArgs: Topic = {
  id: 'commands-and-args',
  title: 'Container commands, arguments and lifecycle hooks',
  domainId: 'design-build',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 3,
  tags: ['command', 'args', 'entrypoint', 'cmd', 'lifecycle', 'postStart', 'preStop', 'shell'],
  oneLiner:
    'How to run exactly the process you want inside a container, including shell tricks, environment expansion and start/stop hooks.',
  explanation: [
    "`command` and `args` are the Pod-spec equivalents of a Dockerfile's `ENTRYPOINT` and `CMD`. `command` says which executable to run; `args` are the parameters passed to it.",
    'Both are **lists of strings**, in exec form. `command: ["sleep", "3600"]` is correct; `command: "sleep 3600"` is a type error. There is no shell involved unless you ask for one explicitly.',
    'That last point matters: `command: ["echo", "$HOME"]` prints the literal `$HOME`, because there is no shell to expand it. If you need shell features - variable expansion, pipes, `&&`, redirects - you must invoke a shell yourself: `command: ["sh", "-c", "echo $HOME"]`.',
    'Kubernetes does provide its own limited expansion in `args` and `command` using `$(VAR)` syntax, which substitutes environment variables declared in the same container. That works without a shell.',
    "`lifecycle.postStart` and `lifecycle.preStop` hooks run commands at the start and end of a container's life. `preStop` is the one worth knowing: it runs before SIGTERM and is the standard place to drain connections.",
  ],
  whyItMatters: [
    'Exam tasks routinely say "create a Pod that runs `sleep 4800`" or "start the container with the argument `--log-level=debug`". Knowing which field to use, and the exec-form syntax, makes these ten-second tasks.',
    'The `sh -c` distinction explains a whole class of confusing failures where a command "works in Docker" but prints literal `$VARIABLE` in Kubernetes.',
    'A `preStop` hook plus a sensible grace period is the difference between a rolling update that drops requests and one that does not.',
  ],
  howItWorks: [
    'Resolution table. Neither set → image ENTRYPOINT + CMD. `command` only → your command, CMD discarded. `args` only → image ENTRYPOINT + your args. Both → your command + your args.',
    'Exec form means the process is started directly, becoming PID 1 in the container, and therefore receives SIGTERM directly. Wrapping in `sh -c` makes the shell PID 1, and a plain shell does not forward signals to its children - so use `exec` inside the shell (`sh -c "exec myapp"`) when you need clean shutdown.',
    "`$(VAR)` expansion: Kubernetes substitutes environment variables defined in the container's own `env`/`envFrom`. Escape a literal with `$$(VAR)`. This happens before the container starts, without a shell.",
    '`postStart` runs asynchronously with the container entrypoint - there is no ordering guarantee, and a failing `postStart` kills the container.',
    '`preStop` runs *before* SIGTERM and blocks the shutdown sequence until it finishes or the grace period expires. Its duration is counted inside `terminationGracePeriodSeconds`, so allow room for both.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'What overrides what in a container image',
      caption:
        'command overrides ENTRYPOINT. args overrides CMD. Getting this backwards is one of the most common CKAD mistakes.',
      question: 'Which fields did you set in the Pod spec?',
      branches: [
        {
          condition: 'neither command nor args',
          result: 'Image ENTRYPOINT + image CMD',
          detail: 'Exactly what the image author intended',
        },
        {
          condition: 'args only',
          result: 'Image ENTRYPOINT + your args',
          detail: 'The usual way to pass flags to a normal image',
          tone: 'accent',
        },
        {
          condition: 'command only',
          result: 'Your command, image CMD DISCARDED',
          detail: 'A frequent surprise: the default arguments vanish',
          tone: 'warning',
        },
        {
          condition: 'both command and args',
          result: 'Your command + your args',
          detail: 'The image ENTRYPOINT and CMD are both ignored',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Why a shell is sometimes required',
      caption:
        'Kubernetes does not run a shell for you, so $(VAR), pipes and && only work if you invoke one yourself.',
      nodes: [
        {
          label: 'command: ["echo", "$HOME"]',
          detail: 'No shell involved',
          tone: 'accent',
        },
        {
          label: 'Container prints the literal $HOME',
          detail: 'Nothing expanded it',
          arrowLabel: 'exec, not shell',
          tone: 'warning',
        },
        {
          label: 'Wrap it in a shell instead',
          detail: 'command: ["sh", "-c", "echo $HOME && sleep 3600"]',
          arrowLabel: 'fix',
        },
        {
          label: 'Now variables, pipes and && all work',
          detail: 'The shell is PID 1 and does the expanding',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Container process definition and lifecycle hooks.',
      fields: [
        {
          path: 'spec.containers[].command[]',
          meaning: 'Executable and its leading arguments. Overrides ENTRYPOINT.',
        },
        {
          path: 'spec.containers[].args[]',
          meaning: 'Arguments appended to the command. Overrides CMD.',
        },
        {
          path: 'spec.containers[].workingDir',
          meaning: 'Directory the process starts in. Overrides WORKDIR.',
        },
        {
          path: 'spec.containers[].lifecycle.postStart',
          meaning: 'exec / httpGet / sleep hook run just after the container starts.',
        },
        {
          path: 'spec.containers[].lifecycle.preStop',
          meaning: 'exec / httpGet / sleep hook run before SIGTERM.',
        },
        {
          path: 'spec.terminationGracePeriodSeconds',
          meaning: 'Total time allowed for preStop plus graceful exit. Default 30.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The rolling update that dropped 200 requests',
    story: [
      'A team rolls out a new version of an HTTP API twelve times a day. Monitoring shows a small spike of 502s during each rollout - about 200 failed requests per deploy.',
      'The cause is a race: when a Pod is deleted, removal from Service endpoints and delivery of SIGTERM happen at almost the same moment, and the ingress/kube-proxy update takes a second or two to propagate. The app exits immediately on SIGTERM, so requests already in flight to that Pod IP fail.',
      'The fix is a `preStop` hook that sleeps five seconds. The Pod is removed from endpoints, keeps serving for five more seconds while the change propagates, and only then receives SIGTERM. `terminationGracePeriodSeconds` is raised to 40 so the sleep plus a graceful drain both fit.',
      'The 502s go to zero, with no application code change at all.',
    ],
    code: [
      {
        title: 'The five-second fix',
        language: 'yaml',
        code: `spec:
  terminationGracePeriodSeconds: 40 # must exceed the preStop duration
  containers:
    - name: api
      image: registry.example.com/shop/api:1.4.2
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "sleep 5"]`,
        explanation:
          'Shutdown order is: removed from endpoints -> preStop runs to completion -> SIGTERM -> (grace period) -> SIGKILL. The sleep buys time for endpoint propagation.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'No shell, with a shell, and Kubernetes variable expansion',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: expansion-demo
  namespace: shop
spec:
  restartPolicy: Never
  containers:
    # 1. No shell: $HOME is NOT expanded - it prints the literal text
    - name: no-shell
      image: busybox:1.36
      command: ["echo", "$HOME"]

    # 2. Explicit shell: the shell expands the variable
    - name: with-shell
      image: busybox:1.36
      command: ["sh", "-c", "echo $HOME"]

    # 3. Kubernetes $(VAR) expansion: no shell needed, but only works for
    #    variables declared in this container's own env.
    - name: k8s-expansion
      image: busybox:1.36
      env:
        - name: GREETING
          value: hello
        - name: TARGET
          value: world
      command: ["echo"]
      args: ["$(GREETING) $(TARGET)"] # prints: hello world`,
      explanation:
        'Container 3 is the exam-friendly pattern: it works without a shell, so the container image does not even need one, and it keeps the app as PID 1.',
      placeholders: ['expansion-demo', 'shop'],
    },
    {
      title: 'Shell wrapper done properly, with exec',
      language: 'yaml',
      code: `spec:
  containers:
    - name: app
      image: registry.example.com/shop/api:1.4.2
      # Without "exec", sh stays PID 1 and swallows SIGTERM, so every Pod
      # deletion waits the full grace period before SIGKILL.
      command: ["sh", "-c", "exec /app/api --config=/etc/app/config.yaml"]`,
      explanation:
        '`exec` replaces the shell process with the application, so the app becomes PID 1 and receives signals directly. Use it whenever you need `sh -c` for expansion but still want clean shutdown.',
      placeholders: ['registry.example.com/shop/api:1.4.2'],
    },
    {
      title: 'postStart and preStop together',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: hooked
  namespace: shop
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: web
      image: nginx:1.27-alpine
      lifecycle:
        postStart:
          exec:
            command:
              - sh
              - -c
              - "echo started at $(date) >> /usr/share/nginx/html/status.txt"
        preStop:
          exec:
            command: ["/usr/sbin/nginx", "-s", "quit"] # graceful nginx shutdown`,
      explanation:
        'A failing postStart hook terminates the container, so keep it trivial and idempotent. preStop here asks nginx to finish in-flight requests rather than being killed mid-response.',
      placeholders: ['hooked', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl run sleeper --image=busybox:1.36 --command -- sleep 4800',
      what: 'Sets `command` (because of `--command`). Everything after `--` becomes the command list.',
      expected: 'pod/sleeper created, and it stays Running.',
      placeholders: ['sleeper'],
    },
    {
      command: 'kubectl run printer --image=busybox:1.36 --restart=Never -- echo hello world',
      what: 'Without `--command`, the trailing words become `args`, leaving the image entrypoint in place.',
      expected: 'pod/printer created; `kubectl logs printer` prints "hello world".',
      placeholders: ['printer'],
    },
    {
      command:
        "kubectl run shellcmd --image=busybox:1.36 --restart=Never -- sh -c 'echo $HOSTNAME'",
      what: 'Runs a shell so the variable is expanded. Quote the whole shell command so your local shell does not expand it first.',
      expected: 'Logs contain the Pod name.',
      placeholders: ['shellcmd'],
    },
    {
      command:
        'kubectl run sleeper --image=busybox:1.36 --command --dry-run=client -o yaml -- sleep 3600 > sleeper.yaml',
      what: 'Generates the manifest with the command already set, ready to extend with volumes or probes.',
      expected: 'A file whose container has command: ["sleep","3600"].',
      placeholders: ['sleeper'],
    },
    {
      command: 'kubectl exec sleeper -n shop -- ps -o pid,args',
      what: 'Shows what actually became PID 1 - the definitive check on your command/args.',
      expected: 'PID 1 running `sleep 3600`.',
      placeholders: ['sleeper', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Decide whether you are replacing the executable (`command`) or only its parameters (`args`).',
      'Write both as YAML lists of strings, one argument per element.',
      'Add `sh -c` only when you genuinely need shell features, and prefix the real command with `exec`.',
      'Use `$(VAR)` for environment substitution when you want to avoid a shell entirely.',
    ],
    code: [
      {
        title: 'Two equivalent list styles',
        language: 'yaml',
        code: `# Inline (flow) style - compact, fine for short commands
command: ["sh", "-c", "sleep 3600"]

# Block style - easier to read for long commands, and avoids quote escaping
command:
  - sh
  - -c
  - |
    set -e
    echo "starting"
    exec /app/server --port=8080`,
        explanation:
          'The `|` literal block keeps newlines, so you can write a small script inline. `set -e` makes it fail fast, which surfaces problems as a container error instead of a silent no-op.',
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl get pod sleeper -n shop -o jsonpath=\'{.spec.containers[0].command}{" "}{.spec.containers[0].args}{"\\n"}\'',
      what: 'Shows the recorded command and args exactly as stored.',
      expected: '["sleep","3600"]',
      placeholders: ['sleeper', 'shop'],
    },
    {
      command: 'kubectl exec sleeper -n shop -- ps -o pid,args',
      what: 'Confirms which process is PID 1 inside the container.',
      expected: 'A single line: 1 sleep 3600.',
      placeholders: ['sleeper', 'shop'],
    },
    {
      command: 'kubectl logs printer -n shop',
      what: 'For one-shot Pods the log output is the proof the arguments were passed correctly.',
      expected: 'hello world',
      placeholders: ['printer', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl logs mypod -n shop',
      what: 'A command typo shows up here as an exec error from the runtime.',
      expected: 'exec: "sleeep": executable file not found in $PATH',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl describe pod mypod -n shop | grep -iE "reason|message"',
      what: 'Shows StartError / CreateContainerError when the command cannot be executed at all.',
      expected: 'Reason: StartError with a message naming the missing binary.',
      placeholders: ['mypod', 'shop'],
    },
    {
      command: 'kubectl exec mypod -n shop -- sh -c "command -v sleep || echo missing"',
      what: 'Checks whether a binary exists in the image before you rely on it - distroless images have no shell at all.',
      expected: '/bin/sleep, or "missing".',
      placeholders: ['mypod', 'shop'],
    },
  ],
  commonMistakes: [
    'Writing `command: "sleep 3600"` as a single string instead of a list. It must be `["sleep", "3600"]`.',
    'Expecting `$VAR` to be expanded without a shell. Use `sh -c` or Kubernetes `$(VAR)` syntax.',
    'Using `sh -c` without `exec`, so the shell is PID 1 and never forwards SIGTERM - Pods then take the whole grace period to die.',
    'Forgetting `--command` on `kubectl run`, which puts your words into `args` instead of `command`.',
    'Setting `command` and expecting the image CMD to still apply. It is discarded.',
    'A `preStop` hook longer than `terminationGracePeriodSeconds`, so it is cut short by SIGKILL.',
    'Assuming a shell exists. `busybox` and `alpine` have `sh`; distroless images have nothing.',
  ],
  examTips: [
    'Memorise: `--command --` sets command; a bare `--` sets args.',
    '`command: ["sleep", "3600"]` is the standard way to keep a debug Pod alive.',
    'If a task gives you a shell one-liner with pipes or `&&`, you must wrap it: `["sh","-c","<the one-liner>"]`.',
    'Use `$(VAR)` in `args` when a task says "pass the value of environment variable X as an argument" - no shell required.',
    '`kubectl exec <pod> -- ps -o pid,args` is the fastest proof that your override did what you intended.',
  ],
  summary: [
    '`command` overrides ENTRYPOINT; `args` overrides CMD; both are lists of strings in exec form.',
    'No shell is involved unless you write `sh -c`; use `exec` inside it to keep signal handling correct.',
    "Kubernetes expands `$(VAR)` from the container's own env without a shell.",
    '`preStop` runs before SIGTERM and is the standard connection-draining hook; keep it shorter than the grace period.',
  ],
  practice: [
    {
      id: 'cmd-p1',
      level: 'beginner',
      prompt:
        'Write the `kubectl run` command that creates a Pod named `busy` which sleeps for 5000 seconds.',
      answer: 'kubectl run busy --image=busybox:1.36 --command -- sleep 5000',
      explanation:
        'Without `--command` the words `sleep 5000` become `args`, which for busybox happens to still work because its entrypoint is empty - but on an image with a real ENTRYPOINT it would not. Use `--command` when you mean the executable.',
    },
    {
      id: 'cmd-p2',
      level: 'intermediate',
      prompt:
        'A container is defined with `command: ["echo", "$MESSAGE"]` and an env var `MESSAGE=hi`. The logs show `$MESSAGE`. Give two ways to fix it.',
      answer:
        '1. Use Kubernetes expansion: `command: ["echo"]` and `args: ["$(MESSAGE)"]`.\n2. Use a shell: `command: ["sh", "-c", "echo $MESSAGE"]`.',
      explanation:
        'Option 1 is preferable: it needs no shell, keeps the process as PID 1, and works on images without a shell. Note the `$(...)` parentheses - `${MESSAGE}` is not Kubernetes syntax.',
    },
    {
      id: 'cmd-p3',
      level: 'advanced',
      prompt:
        'Write the container fragment for an app at `/app/server` that must (a) shut down gracefully within 60 seconds, (b) stay in Service endpoints for 5 seconds after deletion begins, and (c) read its port from env var `PORT`.',
      answer:
        'containers:\n  - name: app\n    image: registry.example.com/shop/api:1.4.2\n    env:\n      - name: PORT\n        value: "8080"\n    command: ["/app/server"]\n    args: ["--port=$(PORT)"]\n    lifecycle:\n      preStop:\n        exec:\n          command: ["sh", "-c", "sleep 5"]\nAnd at Pod level: terminationGracePeriodSeconds: 60',
      explanation:
        'The grace period must cover the preStop sleep *plus* the application drain, which is why 60 rather than exactly 5. `$(PORT)` avoids a shell, and `command` in exec form keeps the server as PID 1 so it receives SIGTERM.',
    },
  ],
  lab: {
    title: 'Command, args, expansion and hooks',
    scenario:
      'You will demonstrate every resolution rule, prove why `sh -c` without `exec` delays shutdown, and use a preStop hook.',
    prerequisites: ['A cluster and kubectl'],
    tasks: [
      { instruction: 'Create namespace `cmd-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod that prints the literal `$HOME` and another that prints the expanded value; compare their logs.',
      },
      {
        instruction:
          'Create a Pod using Kubernetes `$(VAR)` expansion in `args` and confirm it expands without a shell.',
      },
      {
        instruction:
          'Create a long-running Pod whose command is `sh -c "sleep 3600"` (no exec) and time how long deletion takes.',
      },
      {
        instruction: 'Create the same Pod with `sh -c "exec sleep 3600"` and time deletion again.',
      },
      {
        instruction: 'Add a preStop hook that writes a file, and prove it ran before termination.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 2-3 - expansion comparison',
        language: 'yaml',
        code: `# expansion.yaml
apiVersion: v1
kind: Pod
metadata:
  name: literal
  namespace: cmd-lab
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      command: ["echo", "$HOME"]
---
apiVersion: v1
kind: Pod
metadata:
  name: shell-expanded
  namespace: cmd-lab
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "echo $HOME"]
---
apiVersion: v1
kind: Pod
metadata:
  name: k8s-expanded
  namespace: cmd-lab
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      env:
        - name: WHO
          value: kubernetes
      command: ["echo"]
      args: ["hello $(WHO)"]`,
      },
      {
        title: 'Compare the logs',
        language: 'bash',
        code: `kubectl create namespace cmd-lab
kubectl config set-context --current --namespace=cmd-lab
kubectl apply -f expansion.yaml
sleep 8

kubectl logs literal          # $HOME          <- not expanded
kubectl logs shell-expanded   # /root          <- expanded by sh
kubectl logs k8s-expanded     # hello kubernetes  <- expanded by Kubernetes`,
      },
      {
        title: 'Steps 4-5 - signal handling and shutdown time',
        language: 'bash',
        code: `kubectl run no-exec --image=busybox:1.36 --command -- sh -c "sleep 3600"
kubectl run with-exec --image=busybox:1.36 --command -- sh -c "exec sleep 3600"
kubectl wait --for=condition=Ready pod/no-exec pod/with-exec --timeout=60s

# sh is PID 1 and ignores SIGTERM -> waits the full 30s grace period
time kubectl delete pod no-exec
# real  0m30.4s

# sleep is PID 1 and dies on SIGTERM -> immediate
time kubectl delete pod with-exec
# real  0m2.1s`,
        explanation:
          'This is not an academic difference: it is 28 extra seconds per Pod on every rollout, multiplied by your replica count.',
      },
      {
        title: 'Step 6 - preStop proof',
        language: 'yaml',
        code: `# hook.yaml
apiVersion: v1
kind: Pod
metadata:
  name: hooked
  namespace: cmd-lab
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: c
      image: busybox:1.36
      command: ["sh", "-c", "exec sleep 3600"]
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "echo stopping >> /tmp/hook.log; sleep 3"]`,
      },
      {
        title: 'Step 6b - observe the hook, then clean up',
        language: 'bash',
        code: `kubectl apply -f hook.yaml
kubectl wait --for=condition=Ready pod/hooked --timeout=60s

# Delete in the background, then read the file while the hook is running
kubectl delete pod hooked --wait=false
sleep 1
kubectl exec hooked -- cat /tmp/hook.log
# stopping

kubectl config set-context --current --namespace=default
kubectl delete namespace cmd-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl logs k8s-expanded -n cmd-lab',
        what: 'Confirms Kubernetes $(VAR) expansion happened with no shell in the command.',
        expected: 'hello kubernetes',
      },
      {
        command:
          'kubectl get pod hooked -n cmd-lab -o jsonpath=\'{.spec.containers[0].lifecycle.preStop.exec.command}{"\\n"}\'',
        what: 'Confirms the preStop hook is recorded on the object.',
        expected: '["sh","-c","echo stopping >> /tmp/hook.log; sleep 3"]',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace cmd-lab',
        what: 'Removes the lab namespace.',
        expected: 'namespace "cmd-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['container-images', 'pods', 'env-and-config-injection'],
  docs: [
    {
      title: 'Define a command and arguments for a container',
      url: 'https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/',
    },
    {
      title: 'Container lifecycle hooks',
      url: 'https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/',
    },
  ],
}
