import type { Topic } from '../../../types'

export const networkingAndPorts: Topic = {
  id: 'dk-networking-and-ports',
  title: 'Networks, DNS and publishing ports',
  domainId: 'dk-data',
  difficulty: 'intermediate',
  estimatedMinutes: 17,
  order: 2,
  tags: ['networking', 'bridge', 'dns', 'ports', 'publish', 'expose'],
  oneLiner:
    'How containers find each other by name, and the difference between EXPOSE and actually publishing a port.',
  explanation: [
    'Each container gets its own network namespace: its own interfaces, its own routing table, its own port space. Two containers can both listen on port 8080 with no conflict, because those are different port 8080s.',
    'Containers are joined to **networks**. The default `bridge` network is a legacy thing: containers on it can reach each other only by IP address, not by name. A **user-defined bridge** - one you create with `docker network create` - adds an embedded DNS server, so containers resolve each other by **container name**. That single difference is why you should essentially always create a network rather than using the default.',
    '**Publishing** a port maps a host port to a container port: `-p 8080:80` means traffic arriving at host port 8080 is forwarded to port 80 in the container. Without publishing, nothing outside the host can reach the container at all.',
    '`EXPOSE` in a Dockerfile publishes nothing. It is documentation - metadata saying "this image listens here" - which tooling can read and which `-P` uses to publish every exposed port on random host ports. The number of people who have waited for `EXPOSE` to make something reachable is large.',
  ],
  whyItMatters: [
    'Service-to-service communication by container name is the foundation of every multi-container application, and it simply does not work on the default bridge.',
    'Publishing a port binds it on the host, by default on **all** interfaces - which means `-p 5432:5432` on a cloud VM can expose your database to the internet. Binding to `127.0.0.1` is a one-word fix people routinely miss.',
    'Knowing that `localhost` inside a container means the container itself - not the host, and not another container - resolves a large fraction of "connection refused" confusion.',
  ],
  howItWorks: [
    'Docker creates a virtual bridge on the host. Each container gets a veth pair: one end inside its namespace as `eth0`, the other attached to the bridge.',
    'On a **user-defined network**, Docker runs an embedded DNS resolver at 127.0.0.11 inside each container. It resolves container names and network aliases to their current IP addresses, which is what makes names stable across restarts even though IPs are not.',
    'Publishing installs a NAT rule (via iptables on Linux) forwarding host port to container port, plus a userland proxy in some configurations.',
    'Outbound traffic is masqueraded behind the host address, so containers can reach the internet by default without any configuration.',
    '`--network host` removes the network namespace entirely: the container shares the host’s stack, so no publishing is needed and port conflicts are real again. Linux only.',
    '`--network none` gives a container no connectivity beyond loopback, which is a genuine hardening option for a batch job that does not need the network.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How a request reaches a container',
      caption:
        'Nothing outside the host reaches the container without a published port. EXPOSE is not part of this path.',
      nodes: [
        {
          label: 'Client hits host:8080',
          detail: 'the host has the port bound because of -p 8080:80',
          tone: 'accent',
        },
        {
          label: 'NAT rule forwards it',
          detail: 'iptables DNAT to the container IP on port 80',
          arrowLabel: 'published',
        },
        {
          label: 'Bridge delivers to the veth',
          detail: 'the container end of the pair is its eth0',
          arrowLabel: 'bridge',
        },
        {
          label: 'Process listening on 0.0.0.0:80',
          detail: 'binding to 127.0.0.1 inside the container makes it unreachable',
          arrowLabel: 'inside',
          tone: 'success',
          branch: {
            label: 'App bound to 127.0.0.1',
            detail: 'connection refused, however correct the -p flag is',
            tone: 'danger',
          },
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Why can this container not be reached?',
      caption: 'Work outside-in. The first two causes are the overwhelming majority.',
      question: 'Where does the connection fail?',
      branches: [
        {
          condition: 'Nothing listening on the host port',
          result: 'The port was never published',
          detail: 'EXPOSE is documentation - only -p binds a host port',
          tone: 'danger',
        },
        {
          condition: 'Host port bound, container refuses',
          result: 'App bound to 127.0.0.1 inside',
          detail: 'it must listen on 0.0.0.0 to accept forwarded traffic',
          tone: 'danger',
        },
        {
          condition: 'Another container cannot resolve the name',
          result: 'Default bridge network',
          detail: 'name resolution needs a user-defined network',
          tone: 'warning',
        },
        {
          condition: 'Resolves, but connection refused',
          result: 'Wrong port, or the service is not up yet',
          detail: 'use the CONTAINER port between containers, not the published one',
          tone: 'accent',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Network driver',
      purpose:
        'How a container is attached to the network. bridge is the default and the usual choice.',
      fields: [
        { path: 'bridge', meaning: 'Default. User-defined bridges add DNS between containers.' },
        {
          path: 'host',
          meaning: 'Shares the host network namespace. No publishing, real port conflicts.',
        },
        { path: 'none', meaning: 'Loopback only. Good hardening for jobs that need no network.' },
        { path: 'overlay', meaning: 'Spans multiple hosts. Used by Swarm services.' },
        {
          path: 'macvlan',
          meaning: 'Gives the container its own MAC and an address on the physical LAN.',
        },
      ],
    },
    {
      kind: 'Port publishing',
      purpose: 'Maps a host port onto a container port. The only way in from outside the host.',
      fields: [
        { path: '-p 8080:80', meaning: 'Host 8080 to container 80, on ALL host interfaces.' },
        {
          path: '-p 127.0.0.1:8080:80',
          meaning: 'Bound to loopback only - not reachable off the host.',
        },
        { path: '-p 80', meaning: 'Random free host port to container 80.' },
        { path: '-P', meaning: 'Publish every EXPOSEd port on random host ports.' },
        { path: 'EXPOSE 80', meaning: 'Dockerfile metadata. Publishes nothing on its own.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The database that was on the internet',
    story: [
      'A team ran Postgres on a cloud VM with `-p 5432:5432` so they could connect with a local client during development. The VM had a public IP and a permissive security group left over from setup.',
      '`-p 5432:5432` binds on all host interfaces, so the database was listening on the public address. It was found by automated scanners within hours; the logs showed thousands of authentication attempts within a day.',
      'The fix was one string: `-p 127.0.0.1:5432:5432`, which binds only to loopback, plus an SSH tunnel for the developers who needed access. The wider lesson is that the default bind address for a published port is every interface, and on any host with a public IP that default is a decision you did not realise you were making.',
    ],
  },
  yamlExamples: [
    {
      title: 'A user-defined network and name resolution',
      language: 'bash',
      explanation:
        'On a user-defined network the application reaches the database as "db" on the CONTAINER port - the published port is irrelevant between containers.',
      code: `docker network create appnet

# The database is NOT published - nothing outside the host can reach it
docker run -d --name db --network appnet \\
  -e POSTGRES_PASSWORD=secret postgres:17

# The app is published, and talks to the database by NAME
docker run -d --name api --network appnet \\
  -e DATABASE_URL='postgres://postgres:secret@db:5432/postgres' \\
  -p 127.0.0.1:8080:8080 \\
  myapp:1.0

# Proof that DNS works between them
docker exec api getent hosts db
docker exec api sh -c 'nc -z db 5432 && echo reachable'`,
    },
    {
      title: 'Binding addresses, and reaching the host from a container',
      language: 'bash',
      explanation:
        'localhost inside a container is the container. host.docker.internal is the documented way back to the host.',
      code: `# All interfaces - on a public VM this is reachable from the internet
docker run -d -p 8080:80 nginx:1.27

# Loopback only - what you almost always want for a dev dependency
docker run -d -p 127.0.0.1:8080:80 nginx:1.27

# Inside a container, localhost is the CONTAINER
docker run --rm alpine sh -c 'nc -z 127.0.0.1 8080 || echo "nothing here - expected"'

# To reach a service on the HOST from inside a container:
docker run --rm --add-host host.docker.internal:host-gateway alpine \\
  sh -c 'nc -z host.docker.internal 5432 && echo "reached the host"'
# (Docker Desktop provides host.docker.internal automatically)`,
    },
  ],
  imperative: [
    {
      command: 'docker network create appnet',
      what: 'Creates a user-defined bridge with DNS between its containers.',
    },
    {
      command: 'docker network ls',
      what: 'Lists networks. bridge, host and none always exist.',
    },
    {
      command: 'docker network connect appnet <container>',
      what: 'Attaches a running container to another network.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker port <container>',
      what: 'Shows which host ports map to which container ports.',
      expected: '80/tcp -> 127.0.0.1:8080',
      placeholders: ['<container>'],
    },
  ],
  declarative: {
    steps: [
      'Create a user-defined network and run two containers on it.',
      'Resolve one container from the other by name.',
      'Try the same on the default bridge and confirm name resolution fails.',
      'Publish a port on loopback only and confirm it is unreachable from another machine.',
    ],
    code: [
      {
        title: 'Name resolution, with and without a user-defined network',
        language: 'bash',
        explanation:
          'The failure on the default bridge is the clearest argument for always creating a network.',
        code: `# User-defined network: names resolve
docker network create demo
docker run -d --name web --network demo nginx:1.27
docker run --rm --network demo alpine sh -c 'getent hosts web && wget -qO- http://web | head -1'
#   172.18.0.2  web
#   <!DOCTYPE html>

# Default bridge: no DNS between containers
docker run -d --name web2 nginx:1.27
docker run --rm alpine getent hosts web2 || echo "cannot resolve on default bridge"

# An alias gives a second name on the network
docker run -d --name api --network demo --network-alias backend nginx:1.27
docker run --rm --network demo alpine getent hosts backend

docker rm -f web web2 api && docker network rm demo`,
      },
    ],
  },
  verification: [
    {
      command: 'docker network inspect <network> --format "{{json .Containers}}"',
      what: 'Lists which containers are attached and their IPs.',
      placeholders: ['<network>'],
    },
    {
      command: 'docker exec <container> getent hosts <name>',
      what: 'Confirms container DNS resolution from inside.',
      expected: 'An IP and the name. Empty output means it did not resolve.',
      placeholders: ['<container>', '<name>'],
    },
    {
      command: 'ss -ltnp | grep <port>',
      what: 'On the host, shows what address a published port is bound to.',
      expected: '127.0.0.1:8080 for a loopback binding, 0.0.0.0:8080 for all interfaces.',
      placeholders: ['<port>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker exec <container> ss -ltn',
      what: 'Shows what the process is actually listening on inside the container.',
      expected: '0.0.0.0:80 is reachable; 127.0.0.1:80 is not, however you publish it.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker run --rm --network container:<container> nicolaka/netshoot ss -ltn',
      what: 'Attaches a diagnostic toolbox to another container’s network namespace - invaluable when the image has no tools.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker exec <container> cat /etc/resolv.conf',
      what: 'Should show nameserver 127.0.0.11 on a user-defined network - the embedded DNS.',
      placeholders: ['<container>'],
    },
  ],
  commonMistakes: [
    'Expecting `EXPOSE` to make a port reachable. It is metadata; `-p` is what publishes.',
    'Using the published host port for container-to-container traffic. Between containers you use the container port and the container name.',
    'An application listening on `127.0.0.1` inside the container. Forwarded traffic arrives on the container’s external interface and is refused.',
    'Publishing on all interfaces on a public host. Prefix with `127.0.0.1:` unless you genuinely mean to expose it.',
    'Relying on container IPs. They change on every recreate - use names on a user-defined network.',
  ],
  examTips: [
    'The default bridge has no DNS between containers; a user-defined bridge does.',
    'EXPOSE documents, -p publishes, -P publishes all EXPOSEd ports on random host ports.',
    '`localhost` inside a container refers to that container.',
    '`-p 127.0.0.1:8080:80` binds only to loopback - the safe default on a public host.',
    '`--network host` removes the network namespace and is Linux only.',
  ],
  summary: [
    'Each container has its own network namespace, so ports never collide between containers.',
    'Create a user-defined network so containers can find each other by name.',
    'Publishing maps a host port to a container port; EXPOSE does nothing at run time.',
    'Bind published ports to 127.0.0.1 unless you intend them to be publicly reachable.',
    'Between containers, use the container name and the container port.',
  ],
  practice: [
    {
      id: 'dk-networking-and-ports-p1',
      level: 'beginner',
      prompt:
        'Your Dockerfile has `EXPOSE 3000` and you run the image with no `-p`. Why can you not reach it from your browser?',
      answer:
        'EXPOSE is documentation only. It records that the image listens on 3000 so tooling and `-P` can use that information, but it binds nothing on the host. You need `-p 3000:3000`.',
      explanation:
        'This is probably the single most common Docker networking misunderstanding, and the wording of EXPOSE is entirely to blame.',
    },
    {
      id: 'dk-networking-and-ports-p2',
      level: 'intermediate',
      prompt:
        'Two containers are on the default bridge. One tries `curl http://api:8080` and gets "could not resolve host". Why?',
      answer:
        'The default bridge network provides no DNS between containers - only user-defined networks run the embedded resolver. Create a network with `docker network create` and attach both containers, after which the name resolves.',
      explanation:
        'This is why practically every guide starts with `docker network create`, and why Compose creates one for you automatically.',
    },
    {
      id: 'dk-networking-and-ports-p3',
      level: 'intermediate',
      prompt:
        'You publish with `-p 8080:80`, the container is running, but connections are refused. `docker exec` shows the app listening on 127.0.0.1:80. What is wrong?',
      answer:
        'The application is bound to the container’s loopback interface, so it only accepts connections originating inside the container. Forwarded traffic arrives on eth0 and is refused. Configure the application to listen on 0.0.0.0.',
      explanation:
        'Many frameworks default to localhost for safety in development. In a container that default makes the service unreachable, and the publishing configuration is a red herring.',
    },
    {
      id: 'dk-networking-and-ports-p4',
      level: 'advanced',
      prompt:
        'An application in a container needs to reach a Postgres instance running directly on the host. How?',
      answer:
        '`localhost` inside the container is the container itself, so that will not work. Use `host.docker.internal`, which Docker Desktop provides and which Linux supports via `--add-host host.docker.internal:host-gateway`. Alternatively use the bridge gateway IP, or run the container with `--network host` on Linux.',
      explanation:
        'The host service must also be listening on an address the container can reach - a Postgres bound to 127.0.0.1 on the host is unreachable from the bridge network whatever name you use.',
    },
  ],
  lab: {
    title: 'Wire two containers together, safely',
    scenario:
      'Run a web service and a backend on a user-defined network, publish only what needs publishing, and prove the rest is unreachable.',
    prerequisites: ['Docker installed'],
    tasks: [
      { instruction: 'Create a user-defined network called `labnet`.' },
      {
        instruction:
          'Run an nginx container named `backend` on that network, with no published ports.',
      },
      {
        instruction:
          'From a throwaway alpine container on the same network, resolve `backend` and fetch its home page.',
        hint: '`docker run --rm --network labnet alpine wget -qO- http://backend`',
      },
      {
        instruction:
          'Confirm `backend` is NOT reachable from the host, since nothing is published.',
      },
      {
        instruction:
          'Run a second nginx named `frontend` published on `127.0.0.1:8080` and fetch it from the host.',
      },
      {
        instruction: 'Check with `ss -ltn` that port 8080 is bound to loopback only, not 0.0.0.0.',
      },
      { instruction: 'Remove the containers and the network.' },
    ],
    solution: [
      {
        title: 'The whole lab',
        language: 'bash',
        code: `docker network create labnet

# Backend: reachable only from inside the network
docker run -d --name backend --network labnet nginx:1.27

# Name resolution and connectivity from a peer container
docker run --rm --network labnet alpine sh -c \\
  'getent hosts backend; wget -qO- http://backend | head -1'

# Not reachable from the host - nothing was published
curl -s --max-time 2 localhost:80 || echo "unreachable from host - correct"

# Frontend: published on loopback only
docker run -d --name frontend --network labnet -p 127.0.0.1:8080:80 nginx:1.27
curl -s localhost:8080 | head -1

# Confirm the binding address
ss -ltn | grep 8080
# LISTEN 0 4096 127.0.0.1:8080   <- loopback only, not 0.0.0.0

docker rm -f backend frontend
docker network rm labnet`,
      },
    ],
    verification: [
      {
        command: 'docker exec frontend getent hosts backend',
        what: 'Confirms DNS works between containers on the user-defined network.',
        expected: 'An IP address and the name backend.',
      },
      {
        command: 'docker port frontend',
        what: 'Shows the published mapping and its bind address.',
        expected: '80/tcp -> 127.0.0.1:8080',
      },
    ],
    cleanup: [
      {
        command:
          'docker rm -f backend frontend 2>/dev/null; docker network rm labnet 2>/dev/null; true',
        what: 'Removes the lab containers and network.',
      },
    ],
  },
  relatedTopicIds: ['dk-volumes-and-mounts', 'dk-compose-basics', 'dk-logging-and-debugging'],
  docs: [
    { title: 'Networking overview', url: 'https://docs.docker.com/engine/network/' },
    {
      title: 'Bridge network driver',
      url: 'https://docs.docker.com/engine/network/drivers/bridge/',
    },
  ],
}
