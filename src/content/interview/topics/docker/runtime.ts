import type { InterviewQuestion } from '../../../types'

/** Running containers: lifecycle, networking, volumes, logs and signals. */
export const dockerRuntimeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-docker-31',
    level: 'basic',
    kind: 'open',
    prompt:
      'Where does a container store data, and what happens to it when the container is removed?',
    probing:
      'The most common cause of real data loss with containers. Whether you reach for volumes instinctively.',
    answer: [
      'By default everything a container writes goes into its **writable layer** - the thin read-write layer stacked on top of the image. That layer belongs to the container, not the image, and when you `docker rm` the container **it is deleted with it**.',
      'To keep data you have to put it somewhere outside that layer. Docker gives you two options. A **volume** is storage managed by Docker in its own area on the host; you refer to it by name and Docker handles the path. A **bind mount** maps a specific host directory into the container at a path you choose.',
      'The rule of thumb is: **volumes for data, bind mounts for development**. Volumes are portable, can be backed up as a unit, work with volume drivers for network storage, and do not depend on a host path existing. Bind mounts are for mounting your source code into a container while you work on it.',
    ],
    code: [
      {
        title: 'Volume and bind mount, side by side',
        language: 'bash',
        code: `# Named volume - Docker manages the location, data survives rm
docker volume create pgdata
docker run -d --name db -v pgdata:/var/lib/postgresql/data postgres:16
docker rm -f db
docker run -d --name db2 -v pgdata:/var/lib/postgresql/data postgres:16   # same data

# Bind mount - your directory, live-edited during development
docker run -it -v "$PWD/src:/app/src" node:22 bash

# Inspect what a container actually has mounted
docker inspect db2 --format '{{json .Mounts}}'`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Where should this data live?',
        caption: 'If losing it would matter, it must not be in the container layer.',
        question: 'A container needs to write something',
        branches: [
          {
            condition: 'Scratch files, caches, anything disposable',
            result: 'Container layer is fine',
            detail: 'Goes away with the container, as intended',
            tone: 'muted',
          },
          {
            condition: 'Database files, uploads, state that must survive',
            result: 'Named volume',
            detail: 'Managed by Docker, portable, backupable',
            tone: 'success',
          },
          {
            condition: 'Source code you are editing right now',
            result: 'Bind mount',
            detail: 'Development only',
            tone: 'accent',
          },
          {
            condition: 'Secrets or config from outside',
            result: 'Mounted file or env var',
            detail: 'Never baked into the image',
            tone: 'warning',
          },
        ],
      },
    ],
    traps: [
      'Running a database with no volume. It works perfectly until the first restart of the container.',
      'Assuming `docker stop` loses data. It does not - only `docker rm` does.',
      'Using a bind mount in production, which ties the container to one host’s directory layout.',
    ],
    followUps: [
      'How would you back up a named volume?',
      'What happens to a volume when the last container using it is removed?',
    ],
    tags: ['volumes', 'storage', 'data', 'fundamentals'],
  },
  {
    id: 'itv-docker-32',
    level: 'basic',
    kind: 'mcq',
    prompt: 'In `docker run -p 8080:80 nginx`, what does each number mean?',
    probing: 'Port mapping direction. People reverse it constantly.',
    options: [
      { id: 'a', text: 'Container port 8080 maps to host port 80' },
      { id: 'b', text: 'Host port 8080 maps to container port 80' },
      { id: 'c', text: 'Both are host ports, for redundancy' },
      { id: 'd', text: 'It is the port range 80 to 8080' },
    ],
    correct: ['b'],
    answer: [
      'The format is **`-p HOST:CONTAINER`**. So traffic arriving at port **8080 on the host** is forwarded to port **80 inside the container**, which is where nginx is listening.',
      'The mnemonic that sticks: the **outside world is on the left**, the container is on the right. You reach it at `http://localhost:8080`, even though nginx itself knows nothing about 8080.',
      'You can also bind to a specific interface - `-p 127.0.0.1:8080:80` publishes only on loopback, so the container is reachable from the host but not from the network. That is a genuinely useful security default for anything you do not mean to expose.',
    ],
    code: [
      {
        title: 'Variations worth knowing',
        language: 'bash',
        code: `docker run -p 8080:80 nginx              # host 8080 -> container 80
docker run -p 127.0.0.1:8080:80 nginx    # loopback only, not on the LAN
docker run -p 80 nginx                   # random free host port -> container 80
docker run -P nginx                      # publish every EXPOSE to random ports

docker port <container>                  # what did it actually get?`,
      },
    ],
    traps: [
      'Thinking `EXPOSE` in a Dockerfile publishes a port. It is documentation only - you still need `-p`.',
      'Publishing a database to `0.0.0.0` on a cloud VM, which puts it on the public internet.',
    ],
    followUps: ['What does `EXPOSE` actually do then?'],
    tags: ['networking', 'ports', 'cli', 'fundamentals'],
  },
  {
    id: 'itv-docker-33',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain Docker networking. How do two containers talk to each other?',
    probing:
      'Whether you know that the default bridge and a user-defined bridge behave very differently.',
    answer: [
      'Docker has several network drivers. **bridge** is the default: containers get a private IP on a virtual bridge on the host and reach the outside through NAT. **host** removes the isolation entirely - the container uses the host network stack directly, so no port mapping and no overhead, but also no isolation. **none** gives no networking at all. **overlay** spans multiple hosts, which is what Swarm uses.',
      'The important practical detail is the difference between the **default bridge** and a **user-defined bridge**. On a user-defined network, Docker runs an embedded DNS server and containers can reach each other **by container name**. On the default bridge, that does not work - you get IP addresses only.',
      'So the answer to "how do two containers talk" is: put them on the same user-defined network and use the container name as the hostname. `docker compose` does this for you automatically, which is why service names just work there.',
    ],
    code: [
      {
        title: 'Name-based service discovery on a user-defined network',
        language: 'bash',
        code: `docker network create app-net

docker run -d --name db    --network app-net postgres:16
docker run -d --name api   --network app-net myapi:1.0

# Inside the api container, "db" resolves - no IPs anywhere
docker exec api getent hosts db
docker exec api sh -c 'psql -h db -U postgres -c "select 1"'`,
        explanation:
          'The same thing on the default bridge fails to resolve: DNS only exists on user-defined networks.',
      },
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Containers on a user-defined bridge',
        caption:
          'The embedded DNS resolves container names to their addresses on this network only.',
        root: {
          label: 'Docker host',
          children: [
            {
              label: 'Network: app-net (user-defined bridge)',
              detail: 'Embedded DNS - names resolve here',
              tone: 'accent',
              children: [
                { label: 'api', detail: 'connects to "db" by name', tone: 'success' },
                { label: 'db', detail: 'listening on 5432', tone: 'success' },
              ],
            },
            {
              label: 'Network: bridge (default)',
              detail: 'No name resolution between containers',
              tone: 'muted',
              children: [{ label: 'legacy-container', detail: 'IP only', tone: 'muted' }],
            },
          ],
        },
      },
    ],
    deeper: [
      'A container can be attached to several networks, which is how you segment a database onto a back-end network that the public-facing proxy cannot reach.',
      '`host` networking is not available in the same form on Docker Desktop for Mac and Windows, because the containers run inside a VM. This surprises people whose setup works on Linux only.',
      'Publishing with `-p` inserts iptables rules. On a cloud VM those bypass some firewall configurations, which is how databases end up publicly reachable.',
    ],
    traps: [
      'Using `--link`. It is deprecated; user-defined networks replaced it years ago.',
      'Hardcoding container IPs. They change on every restart.',
      'Trying to reach the host from inside a container with `localhost` - that is the container itself. Use `host.docker.internal` on Desktop, or the gateway IP on Linux.',
    ],
    followUps: [
      'How do you isolate a database so only the API can reach it?',
      'How would a container reach a service running on the host machine?',
    ],
    tags: ['networking', 'dns', 'bridge', 'service discovery'],
  },
  {
    id: 'itv-docker-34',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you look at logs from a container, and how should logging work in production?',
    probing:
      'Whether you follow the twelve-factor convention or write log files inside containers.',
    answer: [
      'The convention is that a container writes its logs to **stdout and stderr** and nothing else. Docker captures those streams through a **logging driver**, and `docker logs` reads them back. The application should never manage log files, rotation or destinations itself.',
      'That matters because a container is disposable. A log file written inside the container dies with it, cannot be read once the container has crashed, and quietly fills the writable layer until the disk is full.',
      'In production you configure a **logging driver** to ship logs somewhere durable - `json-file` with rotation limits for simple cases, or `fluentd`, `awslogs`, `gelf` or `journald` to forward into a central system. On Kubernetes this is handled for you by a node-level collector reading the same stdout streams.',
    ],
    code: [
      {
        title: 'Reading logs usefully',
        language: 'bash',
        code: `docker logs -f --tail 100 api            # follow the last 100 lines
docker logs --since 15m api              # only the last 15 minutes
docker logs -t api 2>&1 | grep -i error  # timestamps, both streams

# Which driver is this container using?
docker inspect api --format '{{.HostConfig.LogConfig.Type}}'`,
      },
      {
        title: 'Cap the json-file driver so it cannot fill the disk',
        language: 'json',
        code: `{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  }
}`,
        explanation:
          'Put this in /etc/docker/daemon.json. Without it, json-file logs grow without limit - a genuinely common cause of full disks.',
      },
    ],
    deeper: [
      'Log in **structured JSON** rather than free text. One field per value makes the difference between grepping and querying.',
      '`docker logs` does not work with every driver. With `awslogs` or `gelf` there is nothing stored locally to read, which surprises people mid-incident.',
      'Never log secrets, tokens or full request bodies. Logs are usually the least access-controlled system you have.',
    ],
    traps: [
      'Writing to a file inside the container and then wondering why the logs vanished after a crash.',
      'Leaving the default `json-file` driver uncapped on a busy service until the host disk fills.',
      'Logging at debug level in production and paying for it in both storage and latency.',
    ],
    followUps: [
      'A container crashed and restarted. How do you see the logs from before the crash?',
      'What would you do differently on Kubernetes?',
    ],
    tags: ['logging', 'observability', 'production', 'twelve-factor'],
  },
  {
    id: 'itv-docker-35',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What are health checks in Docker, and why is a TCP port check usually not good enough?',
    probing:
      'Whether you understand the difference between "the process is up" and "the service works".',
    answer: [
      'A `HEALTHCHECK` is a command Docker runs inside the container on an interval. Its exit code sets the container status to `healthy` or `unhealthy`, which orchestrators and `depends_on` conditions can act on.',
      'A TCP port check only proves that **something is listening**. It does not prove the application can serve a request. The classic failure is a service whose database connection pool is exhausted or whose downstream dependency is down: the port is open, the process is alive, and every request returns a 500. A port check says healthy; users say otherwise.',
      'A good health check makes a **real request through the application** - typically an HTTP endpoint that touches the things the service needs to actually work. It should be **cheap**, because it runs constantly, and it should **not** cascade: if your health check fails because a downstream is unhealthy, your service gets restarted for someone else’s problem, which turns one outage into two.',
    ],
    code: [
      {
        title: 'HEALTHCHECK in a Dockerfile',
        language: 'dockerfile',
        code: `HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD curl -fsS http://localhost:8080/healthz || exit 1`,
        explanation:
          'start-period is the one people forget: it gives a slow-starting app time to boot without counting failures.',
      },
      {
        title: 'What the endpoint should actually check',
        language: 'python',
        code: `@app.get("/healthz")            # liveness: am I alive and not deadlocked?
def healthz():
    return {"status": "ok"}

@app.get("/readyz")             # readiness: can I serve traffic right now?
def readyz():
    try:
        db.execute("SELECT 1")          # a real dependency, cheaply
        cache.ping()
    except Exception as exc:
        return JSONResponse({"status": "degraded", "error": str(exc)}, status_code=503)
    return {"status": "ready"}`,
        explanation:
          'Keeping liveness and readiness separate is what stops a slow dependency causing restart loops.',
      },
    ],
    deeper: [
      'Separate **liveness** (restart me if this fails) from **readiness** (stop sending me traffic if this fails). Conflating them is how a brief database blip becomes a full restart storm.',
      'Health checks should not require authentication or they become impossible to call, but they also should not expose internal detail to the internet.',
      'On Kubernetes the same reasoning appears as `livenessProbe`, `readinessProbe` and `startupProbe`; the Dockerfile `HEALTHCHECK` is ignored there.',
    ],
    traps: [
      'No `start-period`, so a service with a 60-second startup is killed before it ever becomes healthy.',
      'A health check that queries the database on every interval, adding meaningful load.',
      'Checking a downstream dependency in a liveness probe, causing cascading restarts.',
    ],
    followUps: [
      'Why should a liveness probe not check the database?',
      'What is the equivalent on Kubernetes?',
    ],
    tags: ['healthcheck', 'reliability', 'production', 'probes'],
  },
  {
    id: 'itv-docker-36',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'A Dockerfile uses `CMD python app.py` (shell form). The container ignores `docker stop` and takes 10 seconds to die. Why?',
    probing:
      'Signal handling and PID 1. A genuinely important production behaviour that almost nobody gets right first time.',
    options: [
      { id: 'a', text: 'Python cannot handle signals' },
      {
        id: 'b',
        text: 'Shell form runs the command under `/bin/sh -c`, so the shell is PID 1 and does not forward SIGTERM to the Python process',
      },
      { id: 'c', text: '`docker stop` sends SIGKILL, which cannot be handled' },
      { id: 'd', text: 'The container needs `--init` to receive any signal at all' },
    ],
    correct: ['b'],
    answer: [
      'Shell form wraps the command as `/bin/sh -c "python app.py"`. That makes **the shell PID 1**, with Python as its child. `docker stop` sends **SIGTERM to PID 1** - the shell - and a plain `sh` does not forward signals to its children. Python never sees the signal, nothing shuts down, and after the 10-second grace period Docker sends **SIGKILL** and the process is killed abruptly.',
      'The fix is **exec form**: `CMD ["python", "app.py"]`. There is no shell; Python is PID 1 and receives SIGTERM directly, so it can close connections, finish in-flight requests and exit cleanly.',
      'Why it matters in production: SIGKILL means dropped requests, unflushed writes and connections left open. On a rolling deploy that is an error spike on every single release.',
    ],
    code: [
      {
        title: 'Exec form plus an actual signal handler',
        language: 'dockerfile',
        code: `# Shell form - shell is PID 1, signals are swallowed
# CMD python app.py

# Exec form - your process is PID 1 and gets SIGTERM
CMD ["python", "app.py"]`,
      },
      {
        title: 'Handling SIGTERM so shutdown is graceful',
        language: 'python',
        code: `import signal, sys, threading

shutting_down = threading.Event()

def handle_sigterm(signum, frame):
    # Stop accepting new work, let in-flight requests finish, then exit.
    print("SIGTERM received, draining", flush=True)
    shutting_down.set()

signal.signal(signal.SIGTERM, handle_sigterm)

server.serve_until(shutting_down)
server.drain(timeout=25)        # must be under the orchestrator's grace period
sys.exit(0)`,
      },
    ],
    traps: [
      'Adding `--init` and thinking it fixes this. `--init` reaps zombies; it does not make a shell forward signals.',
      'Using `ENTRYPOINT ["sh", "-c", "..."]`, which reintroduces exactly the same problem.',
      'A drain timeout longer than the orchestrator grace period, so you get SIGKILLed mid-drain anyway.',
    ],
    followUps: [
      'What does `docker stop --time` change?',
      'What is the equivalent problem with an entrypoint shell script, and how do you fix it?',
    ],
    tags: ['signals', 'pid 1', 'graceful shutdown', 'production'],
  },
  {
    id: 'itv-docker-37',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How do you limit CPU and memory for a container, and what happens when a limit is hit?',
    probing:
      'Whether you know that CPU and memory limits behave completely differently when exceeded.',
    answer: [
      'Both are enforced by **cgroups** on the host. `--memory=512m` caps memory; `--cpus=1.5` caps CPU time.',
      'The behaviours when you exceed them are **not symmetrical, and this is the key insight**. CPU is **compressible**: exceed your CPU limit and you are simply **throttled** - the kernel gives you fewer time slices, so the process runs slower but keeps running. Memory is **incompressible**: exceed the memory limit and the kernel’s OOM killer **terminates the process immediately**, with no chance to clean up. The container exits with code 137.',
      'That asymmetry drives how you should set them. A too-low CPU limit gives you latency problems you can see in metrics. A too-low memory limit gives you a process that dies abruptly under load, often only under the exact traffic pattern that makes it allocate most - which is why OOMKills so often appear first in production.',
    ],
    code: [
      {
        title: 'Setting limits and confirming an OOMKill',
        language: 'bash',
        code: `docker run -d --name api \\
  --memory=512m --memory-reservation=256m \\
  --cpus=1.5 \\
  --pids-limit=200 \\
  myapi:1.0

# Live resource usage
docker stats --no-stream api

# Exit code 137 = 128 + 9 (SIGKILL). OOMKilled tells you which kind.
docker inspect api --format '{{.State.ExitCode}} oom={{.State.OOMKilled}}'`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What happens when a container hits its limits',
        caption:
          'CPU degrades gracefully; memory does not. That is why an OOMKill is always a surprise.',
        nodes: [
          { label: 'Container under load', tone: 'accent' },
          {
            label: 'Exceeds CPU limit',
            detail: 'Throttled - slower, still alive',
            tone: 'warning',
            branch: {
              label: 'Symptom: latency rises',
              detail: 'Visible in metrics first',
              tone: 'warning',
            },
          },
          {
            label: 'Exceeds memory limit',
            detail: 'OOM killer terminates PID 1',
            tone: 'danger',
            branch: {
              label: 'Symptom: exit 137',
              detail: 'No cleanup, no warning',
              tone: 'danger',
            },
          },
          {
            label: 'Restart policy kicks in',
            detail: 'And the cycle repeats under load',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      'A JVM or Node process that is unaware of its cgroup limit will size its heap from the **host** memory and OOM immediately. Modern JVMs read the cgroup; older ones need `-XX:+UseContainerSupport` or explicit sizing.',
      '`--memory-reservation` is a soft target used under host pressure; `--memory` is the hard wall. Kubernetes calls the same pair `requests` and `limits`.',
      '`--pids-limit` is an underused protection: a fork bomb or a runaway thread pool takes down the whole host without it.',
      'CPU throttling shows up as `nr_throttled` in cgroup stats long before users complain - worth alerting on.',
    ],
    traps: [
      'Reading exit 137 as "the app crashed". It means something sent SIGKILL, and it is almost always the OOM killer.',
      'Setting a memory limit equal to observed peak usage, leaving no headroom for a traffic spike.',
      'Assuming the application knows about the limit. Many runtimes still look at the host.',
    ],
    followUps: [
      'A container is OOMKilled twice a day under peak load. How would you investigate?',
      'Why can a JVM container OOM even though the heap setting looks correct?',
    ],
    tags: ['cgroups', 'limits', 'oomkill', 'performance', 'production'],
  },
  {
    id: 'itv-docker-38',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these meaningfully improve the security of a running container? Select all that apply.',
    probing: 'Practical container hardening, beyond "scan the image".',
    options: [
      { id: 'a', text: 'Running the process as a non-root user with `USER`' },
      { id: 'b', text: 'Mounting the root filesystem read-only with `--read-only`' },
      { id: 'c', text: 'Dropping all Linux capabilities and adding back only what is needed' },
      { id: 'd', text: 'Setting `--privileged` so the container manages its own security' },
      { id: 'e', text: 'Setting `--security-opt=no-new-privileges` to block setuid escalation' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      '`--privileged` is the opposite of a hardening measure. It **disables nearly all isolation** - all capabilities, access to host devices, and it effectively makes escaping to the host trivial. It is occasionally needed (Docker-in-Docker, some storage drivers) but it should be treated as "this container is the host".',
      'The others are the standard hardening set. **Non-root** means a container escape lands as an unprivileged user. **Read-only root** means an attacker cannot drop a binary or modify your application, with `tmpfs` mounts for the few paths that genuinely need writing. **Dropping capabilities** removes powers almost no application uses - by default Docker grants around 14 of them, and most apps need none.',
      '**`no-new-privileges`** blocks the `setuid` escalation path, so even a setuid binary inside the image cannot be used to gain privileges.',
    ],
    code: [
      {
        title: 'A hardened run, and the Dockerfile half of it',
        language: 'bash',
        code: `docker run -d \\
  --user 10001:10001 \\
  --read-only \\
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \\
  --cap-drop=ALL \\
  --cap-add=NET_BIND_SERVICE \\
  --security-opt=no-new-privileges \\
  --pids-limit=200 \\
  --memory=512m --cpus=1 \\
  myapi:1.0`,
      },
      {
        title: 'Creating the non-root user in the image',
        language: 'dockerfile',
        code: `FROM python:3.12-slim

# Numeric uid so it works even where the user database is not present
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --chown=10001:10001 . .
RUN pip install --no-cache-dir -r requirements.txt

USER 10001
CMD ["python", "-m", "app"]`,
        explanation:
          'COPY --chown matters: files owned by root in a read-only-root container are a common startup failure.',
      },
    ],
    deeper: [
      'If you drop `NET_BIND_SERVICE` you cannot bind below port 1024 - so listen on 8080 and map it, rather than running as root to get port 80.',
      'Read-only root surfaces every hidden write path: temp files, caches, session data. Finding them is the work; `tmpfs` is the fix.',
      'These settings all have direct Kubernetes equivalents in `securityContext`, and a policy engine can enforce them cluster-wide.',
    ],
    traps: [
      'Reaching for `--privileged` to fix a permission error. It works, and it removes your isolation entirely.',
      'Adding `USER` without `--chown` on the copied files, so the app cannot read its own code.',
      'Assuming non-root is enough on its own. It is the single best step, not the whole job.',
    ],
    followUps: [
      'What breaks first when you turn on `--read-only`, and how do you find it?',
      'When is `--privileged` genuinely unavoidable?',
    ],
    tags: ['security', 'hardening', 'capabilities', 'non-root', 'production'],
  },
  {
    id: 'itv-docker-39',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A container keeps restarting in production. `docker ps` shows it cycling every 30 seconds. Walk me through how you would diagnose it.',
    probing:
      'A pure troubleshooting question. They want an ordered method, not a list of commands.',
    answer: [
      'Start with **what the exit tells you**, before touching anything else. `docker inspect` gives the exit code and whether the OOM killer was involved. **137** with `OOMKilled: true` is a memory limit. **137** without it is an external SIGKILL. **139** is a segfault. **1** or another small number is the application exiting on its own - which means the logs will say why.',
      'Then **read the logs from the previous run**, not the current one. `docker logs --since` on a container that restarts is a common mistake; you want the last lines before each death, which is where the stack trace or the "cannot connect to database" is.',
      'Then form a hypothesis from the pattern. **Crashes immediately** points at configuration - a missing environment variable, an unreadable mounted file, a bad command. **Crashes after a consistent interval** points at a health check killing it, or a startup that is slower than the grace period. **Crashes under load** points at memory.',
      'Then **reproduce it in a state you can inspect**. Override the entrypoint to get a shell in the same image with the same environment and mounts, and run the real command by hand so you can see it fail interactively. If the container dies too fast to catch, `docker run` it with the restart policy removed so the stopped container stays around for inspection.',
      'Finally fix the cause rather than the symptom. Raising a memory limit that is genuinely too low is a fix; raising it to mask a leak is not, and you will be back in a week.',
    ],
    code: [
      {
        title: 'The first three commands, in order',
        language: 'bash',
        code: `# 1. How did it die?
docker inspect api --format \\
  'exit={{.State.ExitCode}} oom={{.State.OOMKilled}} restarts={{.RestartCount}} err={{.State.Error}}'

# 2. What did it say before dying?
docker logs --tail 200 api

# 3. Is it memory? Watch it climb until it dies.
docker stats --no-stream api`,
      },
      {
        title: 'Get a shell in the same image to reproduce it',
        language: 'bash',
        code: `# Same image, same env, same mounts - but a shell instead of the app
docker run --rm -it \\
  --entrypoint sh \\
  --env-file ./prod.env \\
  -v appdata:/data \\
  myapi:1.0

# Then run the real command by hand and watch it fail
/app/entrypoint.sh`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Reading the exit code',
        caption:
          'The exit code narrows it to one of four causes before you read a single log line.',
        question: 'Container exited - what does the code say?',
        branches: [
          {
            condition: '137 and OOMKilled is true',
            result: 'Memory limit hit',
            detail: 'Raise the limit or fix the leak',
            tone: 'danger',
          },
          {
            condition: '137 and OOMKilled is false',
            result: 'Killed from outside',
            detail: 'Health check, orchestrator, or host OOM',
            tone: 'warning',
          },
          {
            condition: '139',
            result: 'Segmentation fault',
            detail: 'Native code or wrong architecture',
            tone: 'danger',
          },
          {
            condition: 'Small non-zero code',
            result: 'Application exited on purpose',
            detail: 'The logs will say why - config, usually',
            tone: 'accent',
          },
          {
            condition: '0, but still restarting',
            result: 'Process finished and the policy restarts it',
            detail: 'Wrong CMD, or a job running as a service',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      'Set `--restart=on-failure:5` rather than `always` in production, so a genuinely broken container stops and stays visible instead of hiding in a restart loop.',
      '`docker events` gives you the timeline - useful when you need to correlate restarts with a deploy or a host event.',
      'If it only fails in production, compare the two environments systematically: env vars, mounted files, image digest (not tag), resource limits, and host kernel.',
      'An exit code of 0 with a restart loop almost always means the main process is not the long-running one - a shell that exits after starting a background daemon, typically.',
    ],
    traps: [
      'Restarting it again and hoping. You lose the evidence every time.',
      'Reading only the current logs, which are from the newest healthy-looking start, not the failure.',
      'Raising the memory limit without checking whether usage is growing without bound.',
      'Assuming the image is the same as the one that worked - compare digests, not tags.',
    ],
    followUps: [
      'The exit code is 0 but it still restarts. What does that tell you?',
      'It works locally but not in production. How would you narrow that down?',
    ],
    tags: ['scenario', 'troubleshooting', 'production', 'exit codes', 'debugging'],
  },
  {
    id: 'itv-docker-40',
    level: 'advanced',
    kind: 'open',
    prompt: 'Explain Docker Compose and where it stops being the right tool.',
    probing: 'Whether you know its actual scope. Plenty of people try to run production on it.',
    answer: [
      'Compose describes a **multi-container application in one YAML file** - services, the networks joining them, the volumes they use - and brings the whole thing up with one command. It creates a user-defined network automatically, so services reach each other by service name, and it handles dependency ordering, rebuilds and per-service scaling on a single host.',
      'It is excellent for **local development, integration testing in CI, and small single-host deployments**. Being able to run the API, database, cache and message broker with `docker compose up` is genuinely the fastest way to onboard someone.',
      'It stops being the right tool the moment you need things a **single host cannot give you**: running across multiple machines, rescheduling a container when a host dies, rolling updates with health-gated rollback, horizontal autoscaling, or anything resembling high availability. Compose has no scheduler and no concept of a cluster - if the host goes down, the application is down.',
      'That is the boundary to Kubernetes (or ECS, or Nomad). The honest framing in an interview is that Compose and Kubernetes are not competitors: Compose is a development and single-host tool, Kubernetes is a cluster scheduler, and most teams use both.',
    ],
    code: [
      {
        title: 'A realistic compose file',
        language: 'yaml',
        code: `services:
  api:
    build: .
    ports: ["8080:8080"]
    environment:
      DATABASE_URL: postgres://app:app@db:5432/app   # "db" is the service name
    depends_on:
      db:
        condition: service_healthy    # wait for healthy, not just started
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:`,
        explanation:
          'depends_on with condition: service_healthy is the fix for "the API starts before the database is ready".',
      },
    ],
    deeper: [
      'Plain `depends_on` only waits for the container to **start**, not to be usable. Without a healthcheck condition you still get startup race conditions.',
      'Compose profiles let one file serve several purposes - `--profile test` to add fixtures without polluting the default `up`.',
      'Multiple compose files layer with `-f base.yml -f override.yml`, which is how you keep one definition across dev and CI without duplication.',
      'Anything secret should come from an env file that is gitignored or from the environment, never committed in the compose file.',
    ],
    traps: [
      'Running production on Compose and discovering the failure mode only when the host reboots.',
      'Relying on `depends_on` alone and getting intermittent CI failures.',
      'Committing passwords into the compose file because "it is only local".',
    ],
    followUps: [
      'How do you make one service wait until another is genuinely ready?',
      'What would you have to add to move this to Kubernetes?',
    ],
    tags: ['compose', 'orchestration', 'development', 'kubernetes'],
  },
  {
    id: 'itv-docker-41',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you get a shell inside a running container, and what do you do if there is no shell?',
    probing: 'Everyday debugging fluency, plus whether you have met a distroless image.',
    answer: [
      '`docker exec -it <container> sh` starts a new process inside the namespaces of a running container. `-i` keeps stdin open and `-t` allocates a terminal; without both you get a shell that appears to hang.',
      'Two things surprise people. `docker exec` only works on a **running** container - if it has crashed there is nothing to exec into, and you need the logs or a fresh `docker run` with an overridden entrypoint instead. And the shell you get is whatever is **in the image**: `bash` often does not exist on Alpine, where you need `sh`.',
      'When the image has **no shell at all** - distroless, `scratch`, some hardened images - the trick is to run a **second container that shares the first one’s namespaces**. `docker run --pid=container:app --network=container:app` puts a fully equipped debug image inside the same process and network namespace, so you can inspect the target’s processes, ports and even its filesystem through `/proc`.',
    ],
    code: [
      {
        title: 'Exec, and the fallbacks when it will not work',
        language: 'bash',
        code: `docker exec -it api bash          # most Debian/Ubuntu images
docker exec -it api sh            # Alpine, busybox, minimal images
docker exec -u 0 -it api sh       # as root, when the app user cannot read something

# Container has crashed - exec is impossible. Run a shell in the same image:
docker run --rm -it --entrypoint sh myapi:1.0

# No shell in the image at all - borrow its namespaces from outside
docker run --rm -it \\
  --pid=container:api \\
  --network=container:api \\
  --cap-add=SYS_PTRACE \\
  nicolaka/netshoot

# Then, inside netshoot: the target's filesystem is visible via /proc
ls /proc/1/root/app
ss -tulpn`,
        explanation:
          'netshoot bundles curl, dig, ss, tcpdump and strace - it is the standard answer to "the image has no tools".',
      },
    ],
    deeper: [
      'Copying files out works even without a shell: `docker cp api:/app/config.yaml .` operates on the filesystem directly.',
      '`docker diff <container>` lists every file changed since the image - a fast way to spot something writing where it should not.',
      'On Kubernetes the same idea is built in as `kubectl debug --image=nicolaka/netshoot --target=app`, using ephemeral containers.',
    ],
    traps: [
      'Forgetting `-t` and concluding the container is broken when it is only the terminal.',
      'Fixing something with `docker exec` and thinking the fix persists. It lives in the writable layer and dies with the container.',
      'Assuming `bash` exists. On Alpine it does not.',
    ],
    followUps: [
      'Why is a fix made with `docker exec` not a real fix?',
      'How would you do the same thing on Kubernetes?',
    ],
    tags: ['debugging', 'exec', 'distroless', 'troubleshooting'],
  },
  {
    id: 'itv-docker-42',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a Docker registry, and what does a full image name actually contain?',
    probing:
      'Whether you can read an image reference properly - it matters for private registries.',
    answer: [
      'A **registry** is the server that stores and distributes images; a **repository** is one named collection of images within it; a **tag** is a human label for one version inside that repository.',
      'A full reference is `registry/namespace/repository:tag`. When you write `nginx:1.27`, Docker expands it to `docker.io/library/nginx:1.27` - the defaults are Docker Hub, the `library` namespace, and tag `latest` if you give none.',
      'The important nuance is that **a tag is mutable**. `myapp:1.4` can be repushed to point at completely different content tomorrow. A **digest** - `myapp@sha256:abc...` - is immutable and refers to exactly one image forever. For anything reproducible, pin by digest.',
    ],
    code: [
      {
        title: 'Reading and pinning references',
        language: 'bash',
        code: `# These are the same thing
docker pull nginx:1.27
docker pull docker.io/library/nginx:1.27

# A private registry
docker login registry.example.com
docker tag myapp:1.4 registry.example.com/team/myapp:1.4
docker push registry.example.com/team/myapp:1.4

# Find the digest, then pin to it
docker inspect --format '{{index .RepoDigests 0}}' registry.example.com/team/myapp:1.4
# -> registry.example.com/team/myapp@sha256:9f2c...`,
      },
    ],
    traps: [
      'Deploying `:latest`. Two machines can pull the same tag on the same day and get different images.',
      'Assuming a tag is immutable. Unless the registry enforces immutability, it is not.',
    ],
    followUps: [
      'Why is deploying `:latest` a problem in production?',
      'How would you guarantee that what you tested is what you deployed?',
    ],
    tags: ['registry', 'tags', 'digests', 'fundamentals'],
  },
]
