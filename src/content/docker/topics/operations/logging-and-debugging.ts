import type { Topic } from '../../../types'

export const loggingAndDebugging: Topic = {
  id: 'dk-logging-and-debugging',
  title: 'Logs, healthchecks and debugging a container',
  domainId: 'dk-operations',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 2,
  tags: ['logs', 'healthcheck', 'debugging', 'exec', 'inspect'],
  oneLiner:
    'Where container logs actually go, how to tell a container is genuinely working, and how to get inside one that has no shell.',
  explanation: [
    'A container should write logs to **stdout and stderr** and nothing else. The container runtime captures those streams and writes them to a file on the host, which is what `docker logs` reads and what a log shipper collects. An application that writes to a file inside the container has put its logs somewhere nothing can see.',
    'The **logging driver** decides where the captured output goes. The default `json-file` writes to local disk and is what `docker logs` reads. Other drivers - `local`, `journald`, `awslogs`, `fluentd` - send it elsewhere, and with most of those `docker logs` stops working, which surprises people.',
    'A **healthcheck** is how Docker knows the difference between "the process is running" and "the application is working". Without one, a container that has deadlocked or lost its database connection still shows as `Up`. With one, it shows `Up (unhealthy)` and Compose and orchestrators can act on it.',
    'Debugging depends on what is in the image. A container with a shell is easy: `docker exec -it <c> sh`. A distroless or scratch image has no shell at all, and the answer is to attach a **separate debug container to the same namespaces** rather than putting a shell into production.',
  ],
  whyItMatters: [
    'Logging to a file inside a container is one of the most common packaging mistakes, and it makes the application invisible to every log pipeline that exists.',
    'Without a healthcheck, "the container is up" means nothing. Deadlocked processes stay `Up` indefinitely and route traffic they cannot serve.',
    'Unrotated `json-file` logs are a classic cause of a full disk on a Docker host - the default has no size limit at all.',
  ],
  howItWorks: [
    'The runtime captures the container’s stdout and stderr and writes them through the configured logging driver.',
    'With `json-file`, each line is stored as a JSON object with a timestamp and a stream name, under the container’s directory on the host. **There is no default size limit** - configure `max-size` and `max-file` or a chatty container will fill the disk.',
    '`docker logs` reads that file, which is why it works on stopped containers and why it fails under drivers that do not keep a local copy.',
    'A `HEALTHCHECK` runs a command inside the container on an interval. Exit 0 is healthy, 1 is unhealthy. After `retries` consecutive failures the status flips to `unhealthy`.',
    '`start_period` gives a slow-starting application time before failures count, which avoids marking a container unhealthy during normal start-up.',
    'To debug an image with no shell, run a second container sharing the target’s PID, network and sometimes mount namespaces - the debug toolbox provides the binaries, the target provides the context.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Where a log line goes',
      caption: 'If the application writes to a file instead, nothing in this chain ever sees it.',
      nodes: [
        {
          label: 'Application writes to stdout',
          detail: 'the only contract a containerised app should rely on',
          tone: 'accent',
        },
        {
          label: 'Runtime captures the stream',
          detail: 'stdout and stderr, tagged per line',
          arrowLabel: 'capture',
        },
        {
          label: 'Logging driver handles it',
          detail: 'json-file by default - local disk, no size limit unless configured',
          arrowLabel: 'route',
          tone: 'warning',
        },
        {
          label: 'docker logs reads it back',
          detail: 'works on stopped containers too - often the whole post-mortem',
          arrowLabel: 'read',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'How do you get inside this container?',
      caption:
        'Production images increasingly have no shell, which is a feature - plan for it rather than fighting it.',
      question: 'What does the image contain?',
      branches: [
        {
          condition: 'A shell, and the container is running',
          result: 'docker exec -it sh',
          detail: 'the everyday case',
          tone: 'success',
        },
        {
          condition: 'No shell - distroless or scratch',
          result: 'Attach a debug container to its namespaces',
          detail: 'docker run --pid=container:X --network=container:X with a toolbox image',
          tone: 'accent',
        },
        {
          condition: 'The container will not start at all',
          result: 'Override the entrypoint',
          detail: 'docker run --entrypoint sh to inspect the image as built',
          tone: 'accent',
        },
        {
          condition: 'It already exited',
          result: 'Read the logs and the exit code',
          detail: 'both survive until the container is removed',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'HEALTHCHECK',
      purpose:
        'A command run inside the container on an interval to decide whether it is actually working.',
      fields: [
        { path: 'test', meaning: 'The command. Exit 0 healthy, 1 unhealthy.', required: true },
        { path: 'interval', meaning: 'How often to run it. Default 30s.' },
        { path: 'timeout', meaning: 'How long to wait before counting it as a failure.' },
        { path: 'retries', meaning: 'Consecutive failures before the status flips.' },
        {
          path: 'start_period',
          meaning: 'Grace window during start-up when failures do not count.',
        },
      ],
    },
    {
      kind: 'Logging driver',
      purpose: 'Where captured stdout and stderr are sent.',
      fields: [
        { path: 'json-file', meaning: 'Default. Local disk. NO size limit unless configured.' },
        { path: 'local', meaning: 'More efficient local format, with sensible default rotation.' },
        { path: 'journald', meaning: 'systemd journal. docker logs still works.' },
        {
          path: 'awslogs / fluentd / gelf',
          meaning: 'Ship elsewhere. docker logs generally stops working.',
        },
        { path: 'max-size / max-file', meaning: 'Rotation options - set these on json-file.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The host that filled up with logs',
    story: [
      'A monitoring agent container started logging a connection error every 50 milliseconds after a certificate expired. Nobody noticed, because the errors were not being alerted on.',
      'Eleven days later the Docker host ran out of disk. The `json-file` driver has no default size limit, so a single container’s log file had grown past 300GB. Every container on the host stopped being able to write, which took down four unrelated services.',
      'Two fixes went in. `max-size` and `max-file` were set in the daemon configuration so no container can ever do this again, and an alert was added on log write rate. The underlying certificate problem was fixed in ten minutes once anyone actually looked - the outage was caused entirely by the missing rotation, not by the original error.',
    ],
  },
  yamlExamples: [
    {
      title: 'A healthcheck that checks the right thing',
      language: 'dockerfile',
      explanation:
        'The endpoint should test this instance, not the whole system. A check that calls the database makes every container unhealthy during a database blip.',
      code: `FROM node:22-alpine
WORKDIR /app
COPY . .
USER node
EXPOSE 8080

# start_period covers slow start-up without counting failures
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=20s \\
  CMD wget -qO- http://localhost:8080/healthz || exit 1

CMD ["node", "server.js"]`,
    },
    {
      title: 'Log rotation, set once for the whole daemon',
      language: 'json',
      explanation:
        'Put this in /etc/docker/daemon.json and restart the daemon. It applies to every container that does not override it.',
      code: `{
  "log-driver": "local",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5",
    "compress": "true"
  }
}`,
    },
    {
      title: 'Debugging a container with no shell',
      language: 'bash',
      explanation:
        'The debug container brings the tools; the target container provides the process and network view.',
      code: `TARGET=$(docker ps -qf name=api)

# Share the target's PID and network namespaces. netshoot has the tools
# the distroless image deliberately does not.
docker run --rm -it \\
  --pid="container:$TARGET" \\
  --network="container:$TARGET" \\
  --cap-add SYS_PTRACE \\
  nicolaka/netshoot

# Inside the debug container:
#   ps aux          - sees the target's processes
#   ss -ltnp        - sees the target's listening sockets
#   curl localhost:8080/healthz
#   tcpdump -i any port 5432

# To read the target's filesystem as well, add:
#   --volumes-from "$TARGET"`,
    },
  ],
  imperative: [
    {
      command: 'docker logs -f --tail 100 --timestamps <container>',
      what: 'Follows the last 100 lines with timestamps.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker logs --since 10m <container>',
      what: 'Only recent output, which is usually what an incident needs.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker exec -it <container> sh',
      what: 'A shell inside a running container - when the image has one.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker inspect --format "{{json .State.Health}}" <container>',
      what: 'The healthcheck history, including the output of the failing probes.',
      placeholders: ['<container>'],
    },
  ],
  declarative: {
    steps: [
      'Add a healthcheck to an image and watch the status move from starting to healthy.',
      'Break the endpoint and watch it flip to unhealthy after the configured retries.',
      'Configure log rotation and confirm the file stops growing without bound.',
      'Debug a shell-less container by attaching a toolbox container to its namespaces.',
    ],
    code: [
      {
        title: 'Watching a healthcheck decide',
        language: 'bash',
        explanation:
          'The Log array inside State.Health holds the actual probe output, which is how you debug a check that never passes.',
        code: `docker run -d --name hc \\
  --health-cmd 'wget -qO- http://localhost/ || exit 1' \\
  --health-interval 5s --health-retries 3 --health-start-period 5s \\
  nginx:1.27

docker ps --format 'table {{.Names}}\\t{{.Status}}'
#   hc   Up 3 seconds (health: starting)
sleep 12
docker ps --format 'table {{.Names}}\\t{{.Status}}'
#   hc   Up 15 seconds (healthy)

# Break it and watch it flip
docker exec hc rm /usr/share/nginx/html/index.html
sleep 20
docker ps --format 'table {{.Names}}\\t{{.Status}}'
#   hc   Up 35 seconds (unhealthy)

# Why? The probe output is recorded
docker inspect --format '{{json .State.Health}}' hc | head -c 400

docker rm -f hc`,
      },
    ],
  },
  verification: [
    {
      command: 'docker inspect -f "{{.State.Health.Status}}" <container>',
      what: 'starting, healthy or unhealthy.',
      placeholders: ['<container>'],
    },
    {
      command:
        'docker inspect -f "{{.HostConfig.LogConfig.Type}} {{json .HostConfig.LogConfig.Config}}" <container>',
      what: 'Confirms which driver and rotation settings a container is using.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker ps --filter health=unhealthy',
      what: 'Lists every container currently failing its healthcheck.',
    },
  ],
  troubleshooting: [
    {
      command: 'docker logs <container> 2>&1 | tail -50',
      what: 'Works on exited containers - usually the entire investigation for a crash.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker run --rm -it --entrypoint sh <image>',
      what: 'Inspects the image as built when the container will not start at all.',
      placeholders: ['<image>'],
    },
    {
      command: 'sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -rh | head',
      what: 'Finds the container filling the disk with logs.',
    },
  ],
  commonMistakes: [
    'Writing logs to a file inside the container, where no log pipeline can see them.',
    'Leaving `json-file` unrotated. There is no default size limit, and a chatty container will fill the host disk.',
    'No healthcheck, so a deadlocked container reports `Up` and keeps receiving traffic.',
    'A healthcheck that calls downstream services, which turns a dependency blip into every instance being marked unhealthy at once.',
    'Installing a shell and debugging tools into a production image so it can be debugged. Attach a debug container instead.',
  ],
  examTips: [
    '`docker logs` reads what the runtime captured from stdout and stderr - nothing else.',
    'The `json-file` driver has no default size limit; set `max-size` and `max-file`.',
    'Under a remote logging driver, `docker logs` generally stops working.',
    '`start_period` prevents start-up failures counting towards the retry limit.',
    'A shell-less image is debugged by attaching another container to its namespaces.',
  ],
  summary: [
    'Applications log to stdout and stderr; the runtime and the driver do the rest.',
    'Configure log rotation - the default json-file driver has no size limit.',
    'A healthcheck is the difference between "process running" and "application working".',
    'Health probes should test this instance, not its dependencies.',
    'Debug shell-less images with a toolbox container sharing their namespaces.',
  ],
  practice: [
    {
      id: 'dk-logging-and-debugging-p1',
      level: 'beginner',
      prompt: '`docker logs` shows nothing for a container you know is working. Why might that be?',
      answer:
        'The application is probably writing to a file inside the container rather than to stdout and stderr. Alternatively the container is using a logging driver that does not keep a local copy, in which case `docker logs` cannot read anything back.',
      explanation:
        'Check with `docker exec <c> ls /var/log` and with `docker inspect -f "{{.HostConfig.LogConfig.Type}}"`.',
    },
    {
      id: 'dk-logging-and-debugging-p2',
      level: 'intermediate',
      prompt: 'A container shows `Up 3 days` but is not serving requests. What is missing?',
      answer:
        'A healthcheck. Docker only knows PID 1 is still alive; it has no opinion about whether the application works. With a HEALTHCHECK the status would read `Up 3 days (unhealthy)` and anything watching could react.',
      explanation:
        'This is why orchestrators insist on readiness and liveness probes - process liveness is a very weak signal.',
    },
    {
      id: 'dk-logging-and-debugging-p3',
      level: 'intermediate',
      prompt:
        'A Docker host filled its disk. Which container do you suspect and how do you confirm it?',
      answer:
        'Almost certainly one logging heavily with the default `json-file` driver, which has no size limit. Confirm by sizing the per-container log files under the Docker data root and sorting descending.',
      explanation:
        'Fix it permanently in `/etc/docker/daemon.json` with `max-size` and `max-file`, so no container can do it again regardless of how it is run.',
    },
    {
      id: 'dk-logging-and-debugging-p4',
      level: 'advanced',
      prompt:
        'Your production image is distroless and you need to inspect its open sockets during an incident. How?',
      answer:
        'Run a diagnostic container sharing the target’s namespaces: `docker run --rm -it --pid=container:<id> --network=container:<id> nicolaka/netshoot`. The debug container supplies the tools while seeing the target’s processes and network stack. Add `--volumes-from` to read its files.',
      explanation:
        'This keeps the production image minimal, which was the point of distroless. Putting a shell into the image to make debugging possible gives away the benefit you chose it for.',
    },
  ],
  lab: {
    title: 'Make a container tell you it is broken',
    scenario:
      'Add a healthcheck, watch it detect a real failure, configure log rotation, and debug a container without using its own shell.',
    prerequisites: ['Docker installed'],
    tasks: [
      {
        instruction:
          'Run nginx with a healthcheck polling its home page every 5 seconds, and watch the status reach healthy.',
      },
      {
        instruction:
          'Delete the index page inside the container and watch the status flip to unhealthy.',
      },
      {
        instruction: 'Read the probe output from `docker inspect` to see why it failed.',
      },
      {
        instruction:
          'Run a second container with `--log-opt max-size=1m --log-opt max-file=2` and confirm the setting applied.',
      },
      {
        instruction:
          'Attach a netshoot container to the nginx container’s network namespace and list its listening sockets.',
        hint: '`docker run --rm -it --network=container:<id> nicolaka/netshoot ss -ltn`',
      },
      { instruction: 'Clean up the containers.' },
    ],
    solution: [
      {
        title: 'The whole lab',
        language: 'bash',
        code: `docker run -d --name hc \\
  --health-cmd 'curl -fsS http://localhost/ || exit 1' \\
  --health-interval 5s --health-retries 2 --health-start-period 5s \\
  nginx:1.27

sleep 12 && docker ps --format '{{.Names}} {{.Status}}'      # (healthy)

docker exec hc rm /usr/share/nginx/html/index.html
sleep 15 && docker ps --format '{{.Names}} {{.Status}}'      # (unhealthy)

docker inspect --format '{{json .State.Health.Log}}' hc | head -c 300

# Rotation on a single container
docker run -d --name rotated \\
  --log-opt max-size=1m --log-opt max-file=2 \\
  alpine sh -c 'while true; do echo noisy; sleep 0.01; done'
docker inspect -f '{{json .HostConfig.LogConfig}}' rotated

# Debug without the target's own shell
docker run --rm -it --network="container:hc" nicolaka/netshoot ss -ltn

docker rm -f hc rotated`,
      },
    ],
    verification: [
      {
        command: 'docker inspect -f "{{.State.Health.Status}}" hc',
        what: 'Confirms the healthcheck detected the broken page.',
        expected: 'unhealthy',
      },
      {
        command: 'docker inspect -f "{{json .HostConfig.LogConfig.Config}}" rotated',
        what: 'Confirms rotation options were applied.',
        expected: 'max-size and max-file present.',
      },
    ],
    cleanup: [
      { command: 'docker rm -f hc rotated 2>/dev/null; true', what: 'Removes the lab containers.' },
    ],
  },
  relatedTopicIds: ['dk-container-lifecycle', 'dk-compose-basics', 'dk-image-security'],
  docs: [
    {
      title: 'Configure logging drivers',
      url: 'https://docs.docker.com/engine/logging/configure/',
    },
    {
      title: 'HEALTHCHECK reference',
      url: 'https://docs.docker.com/reference/dockerfile/#healthcheck',
    },
  ],
}
