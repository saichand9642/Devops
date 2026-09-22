import type { Topic } from '../../../types'

export const configAndResources: Topic = {
  id: 'dk-config-and-resources',
  title: 'Configuration, limits and restart policies',
  domainId: 'dk-run',
  difficulty: 'intermediate',
  estimatedMinutes: 17,
  order: 2,
  tags: ['environment', 'secrets', 'memory', 'cpu', 'restart policy', 'oom'],
  oneLiner:
    'Getting configuration in without baking it into the image, and deciding what happens when a container uses too much or dies.',
  explanation: [
    'The same image should run in dev, staging and production. That is only possible if configuration comes from **outside** the image - environment variables, mounted files, or a secrets manager - rather than being baked into a layer.',
    'Environment variables are the common mechanism: `-e KEY=value`, or `--env-file` for a file of them. They are convenient and universally supported, but they are **not secret**: anyone who can run `docker inspect` sees them, they appear in `/proc/<pid>/environ`, and they are commonly captured by crash reporters. For real secrets, mount a file and read it, or fetch from a secrets manager at start-up.',
    '**Resource limits** are cgroup settings. `--memory` is a hard ceiling: exceed it and the kernel OOM-kills the process immediately - there is no throttling and no warning. `--cpus` is a quota: exceed it and the process is **throttled**, which shows up as latency rather than failure. That asymmetry is the single most important thing to know about limits.',
    'A **restart policy** tells the daemon what to do when a container exits. `no` is the default. `on-failure` restarts only on a non-zero exit, optionally capped. `always` restarts whatever happens, including after a daemon restart. `unless-stopped` is the same but respects a deliberate manual stop, which is usually what you want for a long-running service.',
  ],
  whyItMatters: [
    'A container with no memory limit can consume the whole host and take unrelated workloads down with it. One limit turns a host outage into a single container restart.',
    'Secrets in environment variables is one of the most common real leaks in container deployments - visible in `docker inspect`, in process listings, and in error-reporting payloads.',
    'Choosing `always` over `unless-stopped` means a container you deliberately stopped comes back after a daemon restart, which is a genuinely confusing incident to debug.',
  ],
  howItWorks: [
    'Environment variables are set in the image (`ENV`) and can be overridden at run time (`-e`, `--env-file`). Run-time values win.',
    '`--memory` writes the cgroup memory ceiling. When the container’s working set exceeds it, the kernel OOM killer terminates the largest process - normally your application - giving exit code 137 and `OOMKilled: true`.',
    '`--memory-reservation` is a soft target the kernel tries to keep you under when the host is under pressure. It does not kill.',
    '`--cpus=1.5` sets a CFS quota and period so the container gets at most 1.5 cores of CPU time per period. Exceeding it pauses the process until the next period - throttling, not killing.',
    'Restart policies are evaluated by the daemon when PID 1 exits. `on-failure` uses the exit code; `always` and `unless-stopped` ignore it. Restarts back off exponentially, so a crash loop does not spin the CPU.',
    'A container that keeps restarting shows a rising `RestartCount` and a `restarting` status - the container equivalent of CrashLoopBackOff.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which restart policy does this workload need?',
      caption:
        'unless-stopped is the usual right answer for a service; the difference from always only shows after a daemon restart.',
      question: 'What should happen when this container exits?',
      branches: [
        {
          condition: 'A one-shot job or a build step',
          result: 'no',
          detail: 'the default - exiting is the expected outcome',
          tone: 'accent',
        },
        {
          condition: 'A job that should retry a few times then give up',
          result: 'on-failure:3',
          detail: 'restarts only on a non-zero exit, capped',
          tone: 'accent',
        },
        {
          condition: 'A long-running service',
          result: 'unless-stopped',
          detail: 'comes back after a reboot, but respects a deliberate stop',
          tone: 'success',
        },
        {
          condition: 'Infrastructure that must always run',
          result: 'always',
          detail: 'restarts even one you stopped by hand, once the daemon restarts',
          tone: 'warning',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Memory limit versus CPU limit',
      caption:
        'Memory is incompressible and kills; CPU is compressible and throttles. That asymmetry drives how you set them.',
      nodes: [
        {
          label: 'Container exceeds its CPU quota',
          detail: 'more work than --cpus allows in this period',
          tone: 'accent',
        },
        {
          label: 'Kernel throttles it',
          detail: 'paused until the next period - latency rises, nothing dies',
          arrowLabel: 'compressible',
          tone: 'warning',
        },
        {
          label: 'Container exceeds its memory limit',
          detail: 'working set above --memory',
          tone: 'accent',
        },
        {
          label: 'Kernel OOM-kills immediately',
          detail: 'no warning, no throttle - exit 137, OOMKilled true',
          arrowLabel: 'incompressible',
          tone: 'danger',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Resource flags',
      purpose: 'Cgroup settings applied at run time. Enforced by the kernel, not by Docker.',
      fields: [
        { path: '--memory 512m', meaning: 'Hard ceiling. Exceeding it is an immediate OOM kill.' },
        {
          path: '--memory-reservation 256m',
          meaning: 'Soft target under host pressure. Never kills.',
        },
        { path: '--cpus 1.5', meaning: 'At most 1.5 cores of CPU time. Exceeding throttles.' },
        { path: '--pids-limit 200', meaning: 'Caps process count - contains a fork bomb.' },
        {
          path: '--memory-swap',
          meaning: 'Memory plus swap. Set equal to --memory to disable swap.',
        },
      ],
    },
    {
      kind: 'Configuration input',
      purpose:
        'How values reach the container. Ordered from least to most appropriate for secrets.',
      fields: [
        {
          path: 'ENV in Dockerfile',
          meaning: 'Baked into the image. Defaults only - never secrets.',
        },
        { path: '-e KEY=value', meaning: 'Run-time override. Visible in docker inspect.' },
        { path: '--env-file .env', meaning: 'Many variables at once. Same visibility caveat.' },
        {
          path: '-v ./secret:/run/secrets/x:ro',
          meaning: 'A mounted file. Not in inspect output.',
        },
        {
          path: 'Secrets manager at start-up',
          meaning: 'Fetched by the app. Nothing sensitive on disk or in config.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'One container, one host, no limits',
    story: [
      'A reporting job ran nightly in a container alongside three production services on the same host. One night an unusually large query made it allocate steadily until the host ran out of memory.',
      'With no `--memory` limit on any container, the kernel OOM killer chose its own victim by score - and picked the busiest production service, not the job that caused the problem. Two services restarted, the reporting job carried on, and the on-call engineer spent an hour looking at the wrong container.',
      'Adding `--memory` to every container changed the failure completely: the reporting job now hits its own ceiling and is killed alone, the production services are untouched, and `OOMKilled: true` on the job names the culprit immediately. The limit did not prevent the bug - it contained the blast radius and made the diagnosis obvious.',
    ],
  },
  yamlExamples: [
    {
      title: 'Configuration from outside, secrets from a file',
      language: 'bash',
      explanation:
        'Non-sensitive settings as environment variables; the database password as a mounted file the application reads.',
      code: `# Non-secret configuration - fine as environment variables
docker run -d --name api \\
  -e NODE_ENV=production \\
  -e LOG_LEVEL=info \\
  -e DB_HOST=postgres.internal \\
  --env-file ./config/production.env \\
  \\
  # Secret as a mounted file, read-only. NOT visible in docker inspect.
  -v /etc/secrets/db-password:/run/secrets/db-password:ro \\
  -e DB_PASSWORD_FILE=/run/secrets/db-password \\
  \\
  --memory 512m --memory-swap 512m \\
  --cpus 1.0 \\
  --restart unless-stopped \\
  myapp:1.4.0

# Why the file, not -e DB_PASSWORD:
docker inspect api --format '{{json .Config.Env}}'
# ...shows every -e value in plain text, to anyone with daemon access`,
    },
    {
      title: 'Reading a secret from a file, with an env fallback',
      language: 'python',
      explanation:
        'The _FILE convention is widely used - Postgres, MySQL and many official images support it directly.',
      code: `import os


def secret(name: str) -> str:
    """Prefer a mounted file; fall back to an environment variable."""
    path = os.environ.get(f"{name}_FILE")
    if path:
        with open(path, encoding="utf-8") as handle:
            return handle.read().strip()
    value = os.environ.get(name)
    if value is None:
        raise RuntimeError(f"{name} is not configured")
    return value


DB_PASSWORD = secret("DB_PASSWORD")   # reads /run/secrets/db-password`,
    },
  ],
  imperative: [
    {
      command: 'docker run -d --memory 256m --cpus 0.5 --restart unless-stopped myapp',
      what: 'Runs with a memory ceiling, a CPU quota and a sensible restart policy.',
    },
    {
      command: 'docker stats --no-stream',
      what: 'Shows live CPU, memory and network use per container against its limits.',
      expected: 'A MEM USAGE / LIMIT column - the ratio is what matters.',
    },
    {
      command: 'docker update --memory 512m --cpus 1 <container>',
      what: 'Changes limits on a running container without recreating it.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker run --env-file ./prod.env myapp',
      what: 'Loads many variables from a file instead of repeating -e.',
    },
  ],
  declarative: {
    steps: [
      'Run a container with a small memory limit and a process that allocates steadily.',
      'Watch it get OOM-killed and confirm the exit code and OOMKilled flag.',
      'Run the same workload with a CPU limit and observe throttling instead of death.',
      'Add a restart policy and watch the container come back.',
    ],
    code: [
      {
        title: 'Demonstrating both limits',
        language: 'bash',
        explanation:
          'The memory container dies; the CPU container simply takes longer. That is the compressible/incompressible distinction made concrete.',
        code: `# Memory: incompressible. Exceed it and you are killed.
docker run --name hungry --memory 64m --memory-swap 64m alpine \\
  sh -c 'dd if=/dev/zero of=/dev/shm/fill bs=1M count=200'
docker inspect -f 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' hungry
# exit=137 oom=true

# CPU: compressible. Exceed it and you are slowed.
time docker run --rm --cpus 0.25 alpine \\
  sh -c 'for i in $(seq 1 3000000); do :; done'
time docker run --rm --cpus 2.0  alpine \\
  sh -c 'for i in $(seq 1 3000000); do :; done'
# the second finishes several times faster - neither is killed

docker rm hungry`,
      },
    ],
  },
  verification: [
    {
      command: 'docker inspect -f "{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}" <container>',
      what: 'Confirms the limits actually applied - 0 means unlimited.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker stats --no-stream --format "{{.Name}} {{.MemUsage}} {{.CPUPerc}}"',
      what: 'Current usage against the limit for every running container.',
      placeholders: [],
    },
    {
      command: 'docker inspect -f "{{.HostConfig.RestartPolicy.Name}}" <container>',
      what: 'Shows which restart policy is in force.',
      expected: 'no, on-failure, always or unless-stopped.',
      placeholders: ['<container>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker inspect -f "{{.State.OOMKilled}} {{.RestartCount}}" <container>',
      what: 'Distinguishes an out-of-memory kill from other 137s, and reveals a restart loop.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker exec <container> cat /sys/fs/cgroup/memory.max',
      what: 'The limit as the kernel sees it - useful when a runtime sized itself from host memory instead.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker events --filter event=oom',
      what: 'Streams OOM events as they happen, across every container.',
    },
  ],
  commonMistakes: [
    'Putting secrets in environment variables. They are readable via `docker inspect`, `/proc/<pid>/environ` and most crash reporters.',
    'Running production containers with no memory limit, so one bad container can take the whole host down and the OOM killer picks the wrong victim.',
    'Setting a CPU limit and expecting the container to be killed when it is exceeded. CPU throttles; only memory kills.',
    'Using `--restart always` for a service you sometimes stop deliberately. Use `unless-stopped`.',
    'Forgetting that a JVM or Node runtime sizes its heap from the host unless told about the cgroup limit, which produces an OOM kill while the application reports plenty of free heap.',
  ],
  examTips: [
    'Memory is incompressible: exceeding the limit is an immediate OOM kill with exit 137.',
    'CPU is compressible: exceeding the quota throttles and raises latency.',
    '`unless-stopped` differs from `always` only in respecting a manual stop across a daemon restart.',
    'Environment variables are configuration, not secrets. Mount a file for anything sensitive.',
    '`docker update` changes limits on a running container without recreating it.',
  ],
  summary: [
    'Configuration belongs outside the image so one image serves every environment.',
    'Environment variables are visible to anyone with daemon access - use files for secrets.',
    '`--memory` kills on breach; `--cpus` throttles. Set both, for different reasons.',
    'Restart policies decide what happens on exit; `unless-stopped` suits most services.',
    'Limits do not prevent bugs - they contain the blast radius and make diagnosis obvious.',
  ],
  practice: [
    {
      id: 'dk-config-and-resources-p1',
      level: 'beginner',
      prompt: 'Why is `-e DB_PASSWORD=hunter2` a poor way to pass a database password?',
      answer:
        'It is visible to anyone who can run `docker inspect`, appears in `/proc/<pid>/environ` inside the container, is inherited by every child process, and is frequently captured by crash reporters and log aggregators. Mount it as a file and read it instead.',
      explanation:
        'The `_FILE` convention - `DB_PASSWORD_FILE=/run/secrets/db-password` - is supported directly by many official images and is the usual fix.',
    },
    {
      id: 'dk-config-and-resources-p2',
      level: 'intermediate',
      prompt:
        'A container with `--cpus 0.5` is slow. A container with `--memory 128m` is being killed. Why the different outcomes?',
      answer:
        'CPU is a compressible resource: exceeding the quota means the kernel pauses the process until the next period, so you get latency. Memory is incompressible: there is nothing to throttle, so the kernel OOM-kills the process immediately.',
      explanation:
        'This asymmetry is why memory limits need headroom and careful measurement, while CPU limits are comparatively safe to set aggressively.',
    },
    {
      id: 'dk-config-and-resources-p3',
      level: 'intermediate',
      prompt:
        'You stop a container deliberately, then restart the Docker daemon, and the container is running again. What policy is set?',
      answer:
        '`always`. It restarts the container whenever the daemon starts, regardless of a manual stop. `unless-stopped` behaves identically except that it remembers you stopped it on purpose.',
      explanation:
        'For anything a human might legitimately stop, `unless-stopped` avoids this genuinely confusing behaviour.',
    },
    {
      id: 'dk-config-and-resources-p4',
      level: 'advanced',
      prompt:
        'A Java service with `--memory 512m` is OOM-killed while its own metrics show the heap comfortably under 200MB. Explain.',
      answer:
        'Two things. The JVM sizes its maximum heap from the machine it thinks it is on - unless it is container-aware, it reads host memory and plans for a much larger heap. And the cgroup limit covers the whole process, not just the heap: metaspace, thread stacks, direct byte buffers, JIT code cache and native allocations all count.',
      explanation:
        'Set `-XX:MaxRAMPercentage=75` so the JVM sizes from the container limit, and leave headroom above the heap for non-heap memory. Modern JVMs detect cgroup limits, but only if the flags are not overriding them.',
    },
  ],
  lab: {
    title: 'Contain a misbehaving container',
    scenario:
      'Run a memory-hungry process without a limit, then with one, and see how the failure changes.',
    prerequisites: ['Docker installed', 'At least 1GB of free memory on the host'],
    tasks: [
      {
        instruction:
          'Run a container with `--memory 64m` that tries to allocate 200MB, and confirm it is killed.',
        hint: 'Use `dd if=/dev/zero of=/dev/shm/fill bs=1M count=200`.',
      },
      {
        instruction: 'Inspect the exit code and the OOMKilled flag.',
      },
      {
        instruction: 'Run the same command with `--memory 512m` and confirm it succeeds.',
      },
      {
        instruction:
          'Start a container with `--restart on-failure:3` whose command exits 1, and watch the restart count climb then stop.',
      },
      {
        instruction: 'Use `docker stats --no-stream` to read current usage against the limits.',
      },
      { instruction: 'Clean up the containers.' },
    ],
    solution: [
      {
        title: 'The whole lab',
        language: 'bash',
        code: `# Killed by its own limit - contained, and obvious in the inspect output
docker run --name oom --memory 64m --memory-swap 64m alpine \\
  sh -c 'dd if=/dev/zero of=/dev/shm/fill bs=1M count=200'
docker inspect -f 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' oom
# exit=137 oom=true

# Same work, enough headroom
docker run --rm --memory 512m --memory-swap 512m alpine \\
  sh -c 'dd if=/dev/zero of=/dev/shm/fill bs=1M count=200 && echo ok'

# Restart policy with a cap
docker run -d --name flaky --restart on-failure:3 alpine \\
  sh -c 'echo starting; sleep 2; exit 1'
sleep 20
docker inspect -f 'restarts={{.RestartCount}} status={{.State.Status}}' flaky
# restarts=3 status=exited   <- gave up after three, as asked

docker stats --no-stream
docker rm -f oom flaky`,
      },
    ],
    verification: [
      {
        command: 'docker inspect -f "{{.State.OOMKilled}}" oom',
        what: 'Confirms the kernel killed it for memory, not something else.',
        expected: 'true',
      },
      {
        command: 'docker inspect -f "{{.RestartCount}}" flaky',
        what: 'Confirms the restart cap was honoured.',
        expected: '3',
      },
    ],
    cleanup: [
      { command: 'docker rm -f oom flaky 2>/dev/null; true', what: 'Removes the lab containers.' },
    ],
  },
  relatedTopicIds: ['dk-container-lifecycle', 'dk-volumes-and-mounts', 'dk-image-security'],
  docs: [
    {
      title: 'Resource constraints',
      url: 'https://docs.docker.com/engine/containers/resource_constraints/',
    },
    {
      title: 'Start containers automatically',
      url: 'https://docs.docker.com/engine/containers/start-containers-automatically/',
    },
  ],
}
