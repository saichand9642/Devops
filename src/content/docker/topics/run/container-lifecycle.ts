import type { Topic } from '../../../types'

export const containerLifecycle: Topic = {
  id: 'dk-container-lifecycle',
  title: 'The container lifecycle and signals',
  domainId: 'dk-run',
  difficulty: 'beginner',
  estimatedMinutes: 15,
  order: 1,
  tags: ['lifecycle', 'signals', 'sigterm', 'exit codes', 'stop'],
  oneLiner:
    'Created, running, exited - and the ten-second window between SIGTERM and SIGKILL that decides whether you shut down gracefully.',
  explanation: [
    'A container moves through a small set of states. `docker create` makes it **created** - the writable layer exists, nothing is running. `docker start` moves it to **running**. When PID 1 exits, or something stops it, it becomes **exited**, retaining its filesystem and logs until removed. `docker run` is simply create plus start.',
    '**Paused** is a fourth state, reached with `docker pause`: the cgroup freezer suspends every process without them noticing. **Restarting** appears while a restart policy is taking effect, and **dead** is a rare state meaning the daemon could not clean up.',
    'The important behaviour is what happens on stop. `docker stop` sends **SIGTERM** to PID 1 and waits - ten seconds by default. If the process is still running when the timer expires, Docker sends **SIGKILL**, which cannot be caught and gives you no chance to finish anything.',
    'That grace period is where graceful shutdown lives: stop accepting new connections, finish in-flight requests, flush buffers, close database connections, then exit. An application that ignores SIGTERM is killed mid-request on every single deploy, and users see it as occasional unexplained errors during releases.',
  ],
  whyItMatters: [
    'Every deployment stops containers. If shutdown is not graceful, every deployment drops requests - a small, constant error rate that is very hard to attribute after the fact.',
    'Exit codes are the fastest diagnosis available. 0 is a clean finish, 137 is SIGKILL (usually the memory limit), 143 is SIGTERM, and anything else came from your application.',
    'Knowing that a stopped container keeps its logs and filesystem is what makes post-mortem debugging possible - `docker logs` on an exited container is often the whole investigation.',
  ],
  howItWorks: [
    '`docker run` creates the writable layer, sets up namespaces and cgroups, then executes the command as PID 1.',
    '`docker stop` sends SIGTERM to PID 1 and starts a timer set by `--time` (default 10 seconds). On expiry it sends SIGKILL.',
    '`docker kill` skips the grace period and sends SIGKILL immediately - or another signal with `--signal`.',
    'The kernel treats **PID 1 specially**: signals with default dispositions are ignored unless the process installs a handler. A shell script as PID 1 that has no trap simply does not die on SIGTERM.',
    'When PID 1 exits, the container stops and its exit code is recorded. Other processes in the container are killed.',
    'An exited container keeps its writable layer, its logs and its configuration until `docker rm`. `--rm` removes it automatically on exit.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'What docker stop actually does',
      caption:
        'The ten-second window is the entire opportunity for graceful shutdown. Miss it and you are SIGKILLed.',
      nodes: [
        {
          label: 'docker stop issued',
          detail: 'SIGTERM delivered to PID 1 only',
          tone: 'accent',
        },
        {
          label: 'Your handler runs',
          detail: 'stop accepting connections, drain in-flight work, flush',
          arrowLabel: 'if you installed one',
          tone: 'success',
          branch: {
            label: 'No handler, or PID 1 is a shell',
            detail: 'signal ignored, nothing happens',
            tone: 'danger',
          },
        },
        {
          label: 'Process exits cleanly',
          detail: 'exit code 0, container stopped in well under a second',
          arrowLabel: 'best case',
          tone: 'success',
        },
        {
          label: 'Grace period expires',
          detail: 'ten seconds by default, tunable with --time',
          arrowLabel: 'otherwise',
          tone: 'warning',
        },
        {
          label: 'SIGKILL',
          detail: 'uncatchable - exit code 137, in-flight work lost',
          arrowLabel: 'forced',
          tone: 'danger',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'What does this exit code mean?',
      caption: 'The exit code narrows the cause before you read a single log line.',
      question: 'What did docker inspect report as the exit code?',
      branches: [
        {
          condition: '0',
          result: 'Clean exit',
          detail: 'the command finished - normal for a one-shot container',
          tone: 'success',
        },
        {
          condition: '137',
          result: 'SIGKILL',
          detail: '128 + 9 - usually the cgroup memory limit, or a stop that timed out',
          tone: 'danger',
        },
        {
          condition: '143',
          result: 'SIGTERM',
          detail: '128 + 15 - stopped, and the process did not exit 0 in response',
          tone: 'warning',
        },
        {
          condition: '125, 126 or 127',
          result: 'Docker or command problem',
          detail: 'daemon error, command not executable, or command not found',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Container state',
      purpose: 'What docker inspect reports under .State, and the fastest first diagnostic.',
      fields: [
        { path: 'Status', meaning: 'created, running, paused, restarting, exited or dead.' },
        { path: 'Running', meaning: 'Boolean. False for both exited and created.' },
        { path: 'ExitCode', meaning: 'The PID 1 exit status. 137 and 143 are signal deaths.' },
        { path: 'OOMKilled', meaning: 'True when the kernel killed it for exceeding memory.' },
        { path: 'StartedAt', meaning: 'When it last started - useful against a restart loop.' },
        { path: 'RestartCount', meaning: 'How many times a restart policy has re-run it.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The error spike that only happened during deploys',
    story: [
      'A team saw a small spike of 502s every time they deployed. It lasted seconds, affected a few dozen requests, and nobody could reproduce it outside a release.',
      'The application had no SIGTERM handler. On each rolling replacement Docker sent SIGTERM, the process ignored it, and ten seconds later SIGKILL terminated it mid-request. Every in-flight request at that moment failed, and the load balancer had not finished draining.',
      'The fix was about fifteen lines: on SIGTERM, stop accepting new connections, let existing requests finish, then exit. The error spike disappeared entirely, and as a side effect deploys got faster - containers now exited in milliseconds instead of waiting out the full grace period.',
    ],
  },
  yamlExamples: [
    {
      title: 'A graceful shutdown handler',
      language: 'python',
      explanation:
        'The pattern is the same in every language: catch SIGTERM, stop accepting, drain, exit. Without it the ten-second window is wasted.',
      code: `import signal
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


server = HTTPServer(("", 8080), Handler)


def shutdown(signum, _frame):
    print(f"signal {signum} received - draining", flush=True)
    # shutdown() returns once in-flight requests have finished
    threading.Thread(target=server.shutdown).start()


# SIGTERM is what docker stop sends. SIGINT is Ctrl-C.
signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

print("listening on 8080", flush=True)
server.serve_forever()
print("drained cleanly", flush=True)
sys.exit(0)`,
    },
    {
      title: 'An entrypoint script that does not swallow signals',
      language: 'bash',
      explanation:
        'The final `exec` replaces the shell with your program, so it becomes PID 1 and receives signals directly.',
      code: `#!/bin/sh
set -e

# Any initialisation that must happen before the app starts
echo "running migrations..."
/app/migrate

# exec REPLACES the shell - the application becomes PID 1 and
# receives SIGTERM. Without exec, sh stays PID 1 and swallows it.
exec "$@"`,
    },
  ],
  imperative: [
    {
      command: 'docker run -d --name web nginx:1.27',
      what: 'Creates and starts a container in the background.',
      expected: 'A container id, and `docker ps` shows it Up.',
    },
    {
      command: 'docker stop web',
      what: 'SIGTERM, then SIGKILL after the grace period.',
      expected: 'Returns in well under a second for a well-behaved application.',
    },
    {
      command: 'docker stop --time 30 web',
      what: 'Extends the grace period for a service that needs longer to drain.',
    },
    {
      command: 'docker kill --signal SIGUSR1 web',
      what: 'Sends an arbitrary signal - useful for triggering a log rotation or a config reload.',
    },
  ],
  declarative: {
    steps: [
      'Start a container with a signal handler and one without.',
      'Time `docker stop` on each and compare.',
      'Inspect the exit codes to see which was killed.',
      'Restart the stopped container and confirm the filesystem changes survived.',
    ],
    code: [
      {
        title: 'Measuring graceful versus forced shutdown',
        language: 'bash',
        explanation:
          'The difference in both duration and exit code is unmistakable, and it is the same difference your users feel during a deploy.',
        code: `# Ignores SIGTERM entirely
docker run -d --name stubborn alpine sh -c 'trap "" TERM; sleep 600'
time docker stop stubborn          # ~10 seconds
docker inspect -f '{{.State.ExitCode}}' stubborn   # 137 - SIGKILL

# Handles it
docker run -d --name polite alpine sh -c \\
  'trap "echo draining; exit 0" TERM; while true; do sleep 1; done'
time docker stop polite            # immediate
docker logs polite                 # draining
docker inspect -f '{{.State.ExitCode}}' polite     # 0

docker rm stubborn polite`,
      },
    ],
  },
  verification: [
    {
      command: 'docker inspect -f "{{.State.Status}} {{.State.ExitCode}}" <container>',
      what: 'State and exit code in one line - the first thing to check on any failure.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker ps -a --filter "status=exited"',
      what: 'Lists containers that have stopped, with the reason in the STATUS column.',
    },
    {
      command: 'docker inspect -f "{{.State.OOMKilled}}" <container>',
      what: 'Distinguishes an out-of-memory kill from a stop that timed out. Both show 137.',
      expected: 'true means the kernel killed it for exceeding its memory limit.',
      placeholders: ['<container>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker logs --tail 50 <container>',
      what: 'Works on exited containers too - usually the whole investigation.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker events --filter "container=<container>"',
      what: 'Streams lifecycle events live: create, start, die, stop, destroy.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker inspect -f "{{.RestartCount}} {{.State.StartedAt}}" <container>',
      what: 'A climbing restart count with a recent StartedAt means a crash loop.',
      placeholders: ['<container>'],
    },
  ],
  commonMistakes: [
    'No SIGTERM handler, so every deploy kills the process mid-request after a pointless ten-second wait.',
    'A shell script as PID 1 with no `exec`, so the signal reaches the shell and never the application.',
    'Reading 137 as "out of memory" automatically. It means SIGKILL - check `.State.OOMKilled` to tell the two causes apart.',
    'Using `docker kill` habitually. It skips the grace period entirely and guarantees an unclean stop.',
    'Removing a failed container before reading its logs. The evidence goes with it.',
  ],
  examTips: [
    '`docker stop` is SIGTERM then SIGKILL after the grace period; `docker kill` is SIGKILL immediately.',
    'Exit code 137 is 128 + 9 (SIGKILL); 143 is 128 + 15 (SIGTERM).',
    'PID 1 ignores signals with default dispositions unless the process installs a handler.',
    '`exec "$@"` at the end of an entrypoint script is what makes the application PID 1.',
    'A stopped container keeps its logs and filesystem until it is removed.',
  ],
  summary: [
    'Containers move through created, running, paused, restarting and exited.',
    '`docker stop` gives you a grace period - ten seconds by default - before SIGKILL.',
    'Graceful shutdown means handling SIGTERM and draining in-flight work.',
    'Exit codes narrow the cause immediately; check OOMKilled to interpret 137.',
    'An exited container still holds its logs, which is what makes post-mortems possible.',
  ],
  practice: [
    {
      id: 'dk-container-lifecycle-p1',
      level: 'beginner',
      prompt: 'What is the difference between `docker stop` and `docker kill`?',
      answer:
        '`docker stop` sends SIGTERM and waits up to the grace period (ten seconds by default) before sending SIGKILL. `docker kill` sends SIGKILL straight away, with no opportunity to shut down cleanly.',
      explanation:
        'Use stop normally. Reach for kill only when a container is genuinely wedged and you have accepted the loss.',
    },
    {
      id: 'dk-container-lifecycle-p2',
      level: 'intermediate',
      prompt:
        'A container reports exit code 137. Name two different causes and how you would tell them apart.',
      answer:
        'Either the kernel OOM-killed it for exceeding its memory limit, or `docker stop` timed out and Docker sent SIGKILL. `docker inspect -f "{{.State.OOMKilled}}"` returns true only for the first.',
      explanation:
        '137 is just 128 + 9, meaning "died of SIGKILL". Who sent it is the question, and OOMKilled answers it.',
    },
    {
      id: 'dk-container-lifecycle-p3',
      level: 'intermediate',
      prompt:
        'Your entrypoint is a shell script that starts the app on its last line. Why does the app never see SIGTERM?',
      answer:
        'The shell is PID 1 and the application is its child. Docker signals PID 1 only, and a shell without a trap does not forward it. Ending the script with `exec "$@"` (or `exec /app/server`) replaces the shell with the application, so it becomes PID 1 and receives the signal directly.',
      explanation:
        '`docker exec <c> ps -o pid,comm` confirms it - PID 1 should be your application, not sh.',
    },
    {
      id: 'dk-container-lifecycle-p4',
      level: 'advanced',
      prompt:
        'Your service needs forty seconds to drain long-lived connections. What do you change, and what else must agree?',
      answer:
        'Raise the stop grace period - `docker stop --time 45`, or `stop_grace_period: 45s` in Compose. Everything else in the chain must allow at least as long: the orchestrator’s termination grace period, the load balancer’s deregistration delay, and any CI deploy timeout.',
      explanation:
        'A generous application-side drain is useless if the platform still SIGKILLs at thirty seconds. These numbers have to be set together, and the load balancer should stop sending new traffic before SIGTERM is delivered.',
    },
  ],
  lab: {
    title: 'Make a container shut down gracefully',
    scenario:
      'Run a service that ignores SIGTERM, observe the cost, then fix it and measure the difference.',
    prerequisites: ['Docker installed'],
    tasks: [
      {
        instruction:
          'Run a container whose command traps and ignores SIGTERM, then time `docker stop` on it.',
        hint: '`sh -c \'trap "" TERM; sleep 600\'`',
      },
      { instruction: 'Record its exit code and whether OOMKilled is true.' },
      {
        instruction:
          'Run a second container whose command traps SIGTERM, prints a message and exits 0.',
      },
      { instruction: 'Time `docker stop` on it and compare both the duration and the exit code.' },
      {
        instruction: 'Use `docker events` in another terminal to watch the die and stop events.',
      },
      { instruction: 'Remove both containers.' },
    ],
    solution: [
      {
        title: 'The comparison',
        language: 'bash',
        code: `# Terminal 2, to watch lifecycle events live
docker events --filter 'type=container' &

# Ignores the signal
docker run -d --name ignores alpine sh -c 'trap "" TERM; sleep 600'
time docker stop ignores
docker inspect -f 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' ignores
# exit=137 oom=false   <- SIGKILL, but NOT out of memory

# Handles the signal
docker run -d --name handles alpine sh -c \\
  'trap "echo draining; exit 0" TERM; while true; do sleep 1; done'
time docker stop handles
docker logs handles
docker inspect -f 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' handles
# exit=0 oom=false

docker rm ignores handles`,
      },
    ],
    verification: [
      {
        command: 'docker inspect -f "{{.State.ExitCode}}" handles',
        what: 'Confirms the graceful container exited cleanly.',
        expected: '0',
      },
      {
        command: 'docker logs handles',
        what: 'Proves the handler ran before exit.',
        expected: 'draining',
      },
    ],
    cleanup: [
      {
        command: 'docker rm -f ignores handles 2>/dev/null; true',
        what: 'Removes the lab containers.',
      },
    ],
  },
  relatedTopicIds: [
    'dk-what-is-a-container',
    'dk-config-and-resources',
    'dk-logging-and-debugging',
  ],
  docs: [
    { title: 'Run containers', url: 'https://docs.docker.com/engine/containers/run/' },
    {
      title: 'docker stop reference',
      url: 'https://docs.docker.com/reference/cli/docker/container/stop/',
    },
  ],
}
