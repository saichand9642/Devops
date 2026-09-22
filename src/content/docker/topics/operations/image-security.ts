import type { Topic } from '../../../types'

export const imageSecurity: Topic = {
  id: 'dk-image-security',
  title: 'Hardening an image and a container',
  domainId: 'dk-operations',
  difficulty: 'advanced',
  estimatedMinutes: 18,
  order: 1,
  tags: ['security', 'non-root', 'capabilities', 'scanning', 'read-only'],
  oneLiner:
    'Run as a non-root user, drop what you do not need, and know why a container escape is a host compromise.',
  explanation: [
    'By default a container process runs as **root** - UID 0 - and that is the same UID 0 as on the host. User namespaces are not enabled by default, so root in the container is root on the host for anything that crosses the boundary. That is the premise for everything else here.',
    'Docker mitigates it by **dropping capabilities**. A default container keeps a small subset of root’s powers, so it cannot load kernel modules or change the system time. But it retains enough - `CAP_CHOWN`, `CAP_SETUID`, `CAP_NET_RAW` - that running as root is still worth avoiding, and `--privileged` removes every restriction at once and should be treated as equivalent to giving away the host.',
    'The practical hardening list is short and most of it costs nothing: run as a **non-root user**, make the root filesystem **read-only** with a tmpfs for the paths that genuinely need writing, **drop all capabilities** and add back only what is needed, and set `--security-opt no-new-privileges` so a setuid binary cannot escalate.',
    'Then there is the image itself. **Scanning** finds known vulnerabilities in the packages you shipped, and the most effective response is usually not patching individual CVEs but shipping less: a smaller base image and a multi-stage build remove whole categories of finding at once.',
  ],
  whyItMatters: [
    'A container escape lands the attacker on the host as whatever UID the container process had. Running as a non-root user is the single highest-value change available, and it is usually two lines of Dockerfile.',
    'Most container images in the wild run as root purely because nobody changed the default, not because anything requires it.',
    'Scanning without a size strategy produces an endless backlog. Moving from a full Debian base to a slim or distroless one routinely removes most findings without touching a single dependency.',
  ],
  howItWorks: [
    '`USER` in a Dockerfile sets the account for later `RUN` steps and for the running container. The UID must exist in the image, or be given numerically.',
    'File ownership is checked by **numeric UID**, not by name. A `node` user inside the container is simply UID 1000 to the host, which is why bind-mount permission problems appear.',
    '`--cap-drop ALL --cap-add NET_BIND_SERVICE` gives a process the ability to bind a low port and nothing else. Most applications need no capabilities at all if they listen above 1024.',
    '`--read-only` mounts the root filesystem read-only. Anything the application genuinely writes - a temp directory, a PID file - gets an explicit `--tmpfs` mount.',
    '`--security-opt no-new-privileges` sets the kernel flag that prevents a process gaining privileges through setuid binaries, closing a common escalation path.',
    'Scanners compare the packages in the image against vulnerability databases. `docker scout` is built in; Trivy and Grype are common alternatives, and all of them work in CI.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'The hardening steps, cheapest first',
      caption:
        'The first two cost nothing and remove most of the risk. The rest are worth the small effort.',
      nodes: [
        {
          label: 'Run as a non-root user',
          detail: 'USER in the Dockerfile - the single highest-value change',
          tone: 'success',
        },
        {
          label: 'Ship less',
          detail: 'slim or distroless base plus multi-stage - fewer packages, fewer CVEs',
          arrowLabel: 'then',
          tone: 'success',
        },
        {
          label: 'Drop all capabilities',
          detail: 'add back only what the process genuinely needs',
          arrowLabel: 'then',
          tone: 'accent',
        },
        {
          label: 'Read-only root plus tmpfs',
          detail: 'a compromised process cannot rewrite its own binaries',
          arrowLabel: 'then',
          tone: 'accent',
        },
        {
          label: 'no-new-privileges and scanning in CI',
          detail: 'close setuid escalation, and fail the build on critical findings',
          arrowLabel: 'finally',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'How dangerous is this run configuration?',
      caption: 'Anything on the lower rows is effectively host access.',
      question: 'What does this container run with?',
      branches: [
        {
          condition: 'Non-root, cap-drop ALL, read-only root',
          result: 'Well hardened',
          detail: 'an escape still matters, but the attacker starts with very little',
          tone: 'success',
        },
        {
          condition: 'Default settings, running as root',
          result: 'Common and avoidable',
          detail: 'reduced capabilities, but UID 0 and a writable filesystem',
          tone: 'warning',
        },
        {
          condition: 'Docker socket mounted into the container',
          result: 'Equivalent to host root',
          detail: 'it can start a privileged container mounting the host filesystem',
          tone: 'danger',
        },
        {
          condition: '--privileged',
          result: 'No isolation worth the name',
          detail: 'every capability, every device - treat as giving away the host',
          tone: 'danger',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Run-time security flags',
      purpose: 'Applied at run time. Most are a single flag and cost nothing in performance.',
      fields: [
        {
          path: '--user 10001:10001',
          meaning: 'Run as this UID and GID regardless of the image default.',
        },
        { path: '--read-only', meaning: 'Root filesystem mounted read-only.' },
        { path: '--tmpfs /tmp', meaning: 'A writable in-memory path alongside a read-only root.' },
        {
          path: '--cap-drop ALL',
          meaning: 'Remove every capability, then add back what is needed.',
        },
        {
          path: '--security-opt no-new-privileges',
          meaning: 'Blocks setuid privilege escalation.',
        },
        { path: '--privileged', meaning: 'Disables essentially all isolation. Avoid.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The CI runner that mounted the Docker socket',
    story: [
      'A team gave their CI job container access to the host Docker socket so it could build images - the well-known `-v /var/run/docker.sock:/var/run/docker.sock` pattern. It worked, and it was in the pipeline for two years.',
      'A security review pointed out what that grant actually is: anything that can talk to the Docker socket can start a new container with `--privileged` and the host root filesystem mounted, then read or modify anything on the host. A compromised dependency in any build would have had full host access, and CI runs untrusted-ish code by definition.',
      'They moved to a rootless builder - BuildKit running as an unprivileged user with no socket mount. Builds got marginally slower and the pipeline lost an entire class of escalation. The general rule they adopted afterwards: mounting the Docker socket into a container is granting host root, and should be treated with the same seriousness.',
    ],
  },
  yamlExamples: [
    {
      title: 'A Dockerfile that does not run as root',
      language: 'dockerfile',
      explanation:
        'Create the user explicitly with a fixed UID so file ownership is predictable across hosts and bind mounts.',
      code: `FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:22-alpine
# A fixed, high UID - predictable, and outside the host's normal range
RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

WORKDIR /app
COPY --from=build --chown=10001:10001 /app/dist ./dist
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules

USER 10001:10001
EXPOSE 8080
CMD ["node", "dist/server.js"]`,
    },
    {
      title: 'The run-time flags, together',
      language: 'bash',
      explanation:
        'Each flag removes a capability an attacker would otherwise inherit. None of them affects a well-behaved application.',
      code: `docker run -d --name api \\
  --user 10001:10001 \\
  --read-only \\
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --pids-limit 200 \\
  --memory 512m --cpus 1.0 \\
  -p 127.0.0.1:8080:8080 \\
  myapp:1.4.0

# If the application must bind port 80 rather than 8080:
#   --cap-add NET_BIND_SERVICE
# ...but listening on 8080 and publishing 80 is usually simpler and safer.

# Verify it took effect
docker exec api id                  # uid=10001 gid=10001
docker exec api touch /probe        # Read-only file system - correct`,
    },
  ],
  imperative: [
    {
      command: 'docker scout cves <image>',
      what: 'Lists known vulnerabilities in an image, by severity.',
      placeholders: ['<image>'],
    },
    {
      command:
        'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image <image>',
      what: 'Scans with Trivy. Note the irony of the socket mount - prefer the standalone binary in CI.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker inspect -f "{{.Config.User}}" <image>',
      what: 'Shows which user an image runs as. Empty means root.',
      placeholders: ['<image>'],
    },
  ],
  declarative: {
    steps: [
      'Check whether an image runs as root, and change it if so.',
      'Add read-only root plus a tmpfs and confirm the application still works.',
      'Drop all capabilities and add back only what is needed.',
      'Scan the image and compare findings before and after switching to a slimmer base.',
    ],
    code: [
      {
        title: 'Measuring the effect of a smaller base',
        language: 'bash',
        explanation:
          'Shipping less is usually a bigger security win than patching individual findings.',
        code: `# A full base image
docker build -t app:debian -f Dockerfile.debian .
docker scout cves app:debian --only-severity critical,high | tail -5

# The same application on a slim base, built multi-stage
docker build -t app:slim -f Dockerfile.slim .
docker scout cves app:slim --only-severity critical,high | tail -5

# Usually a large reduction, with no dependency changes at all
docker images app --format '{{.Tag}} {{.Size}}'

# And confirm neither runs as root
for t in debian slim; do
  echo -n "app:$t user="
  docker inspect -f '{{.Config.User}}' app:$t
done`,
      },
    ],
  },
  verification: [
    {
      command: 'docker exec <container> id',
      what: 'Confirms which UID the process is actually running as.',
      expected: 'A non-zero uid. uid=0(root) means the hardening did not apply.',
      placeholders: ['<container>'],
    },
    {
      command:
        'docker inspect -f "{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}}" <container>',
      what: 'Confirms the read-only root and dropped capabilities took effect.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker exec <container> cat /proc/1/status | grep CapEff',
      what: 'The effective capability set of PID 1, in hex. 0000000000000000 means none.',
      placeholders: ['<container>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker logs <container>',
      what: 'A permission denied after adding --user is almost always file ownership from the build.',
      expected: 'Fix with COPY --chown, or chown in the Dockerfile.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker exec <container> touch /tmp/probe',
      what: 'Checks whether the tmpfs is writable when the root filesystem is read-only.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker run --rm --cap-drop ALL <image> <cmd>',
      what: 'Bisect which capability an application actually needs by adding them back one at a time.',
      placeholders: ['<image>', '<cmd>'],
    },
  ],
  commonMistakes: [
    'Leaving the image running as root because nothing forced the issue. It is two lines to fix and removes most of the risk.',
    'Mounting the Docker socket into a container. That is host root, however the container is otherwise configured.',
    'Reaching for `--privileged` to fix a permission problem instead of identifying the one capability needed.',
    'Adding `--user` without fixing file ownership, so the application cannot read its own files.',
    'Treating scanning as the whole strategy. Shipping less removes findings faster than patching them.',
  ],
  examTips: [
    'Container root is host root - user namespaces are not enabled by default.',
    '`--cap-drop ALL` then add back specific capabilities is the recommended pattern.',
    '`--read-only` plus `--tmpfs` for the paths that genuinely need writing.',
    'Mounting `/var/run/docker.sock` grants effective host root.',
    'A smaller base image removes vulnerabilities wholesale rather than one at a time.',
  ],
  summary: [
    'Run as a non-root user - the highest-value change, and nearly free.',
    'Drop all capabilities and add back only what the process needs.',
    'A read-only root filesystem with an explicit tmpfs stops a compromised process rewriting itself.',
    'The Docker socket and `--privileged` are both equivalent to host access.',
    'Scan in CI, but reduce the image first - it removes whole classes of finding.',
  ],
  practice: [
    {
      id: 'dk-image-security-p1',
      level: 'intermediate',
      prompt: 'Why is running as root inside a container a problem if it is isolated anyway?',
      answer:
        'User namespaces are not enabled by default, so UID 0 in the container is UID 0 on the host. The isolation is namespaces and capabilities, not a different identity - so any escape, or any mounted host path, is accessed as real root.',
      explanation:
        'Docker drops many capabilities by default, which helps, but a non-root USER removes the premise entirely rather than mitigating it.',
    },
    {
      id: 'dk-image-security-p2',
      level: 'intermediate',
      prompt:
        'You add `--user 10001` and the application fails with permission denied on its own files. Why?',
      answer:
        'The files were created during the build as root, so they are owned by UID 0 and the new UID cannot write them. Use `COPY --chown=10001:10001` or chown the directories in the Dockerfile.',
      explanation:
        'Ownership is numeric. The container has no idea what "app user" means on the host - only the UID matters.',
    },
    {
      id: 'dk-image-security-p3',
      level: 'advanced',
      prompt:
        'A CI job mounts `/var/run/docker.sock` so it can build images. What is the actual risk?',
      answer:
        'Anything that can reach the Docker socket can create a container with `--privileged` and the host root filesystem bind-mounted, giving complete host access. In CI, where builds execute code from pull requests and third-party dependencies, that is a direct path from a compromised dependency to host root.',
      explanation:
        'Use a rootless builder, a dedicated build service, or BuildKit running unprivileged. Socket mounting is a well-known escalation path rather than an obscure one.',
    },
    {
      id: 'dk-image-security-p4',
      level: 'advanced',
      prompt:
        'A scan reports 180 high-severity vulnerabilities and your team has no capacity to patch them. What do you do?',
      answer:
        'Look at the base image first. Most findings are usually in operating-system packages the application never uses, and moving from a full base to a slim or distroless one with a multi-stage build typically eliminates the large majority in a single change. Then triage what remains by reachability - a CVE in a package your code never calls is a different priority from one in your HTTP stack.',
      explanation:
        'Patching 180 findings individually is unachievable and mostly pointless. Reducing what ships is both faster and more durable, because the removed packages cannot generate future findings either.',
    },
  ],
  lab: {
    title: 'Harden a container, one flag at a time',
    scenario:
      'Start from a default container running as root and apply each hardening step, verifying the effect of each.',
    prerequisites: ['Docker installed'],
    tasks: [
      {
        instruction: 'Run an nginx container with default settings and confirm it runs as root.',
        hint: '`docker exec <c> id`',
      },
      {
        instruction:
          'Write a Dockerfile based on `nginxinc/nginx-unprivileged` or add a non-root USER, and confirm the UID changed.',
      },
      {
        instruction: 'Run it with `--read-only` and observe what breaks.',
      },
      {
        instruction: 'Add `--tmpfs` mounts for the paths it needs to write and confirm it starts.',
      },
      {
        instruction:
          'Add `--cap-drop ALL --security-opt no-new-privileges` and verify the capability set.',
        hint: '`docker exec <c> cat /proc/1/status | grep CapEff`',
      },
      {
        instruction: 'Scan the image and record the count of high and critical findings.',
      },
    ],
    solution: [
      {
        title: 'Step by step',
        language: 'bash',
        code: `# 1. Default: root
docker run -d --name n1 nginx:1.27
docker exec n1 id          # uid=0(root)

# 2. Unprivileged variant
docker run -d --name n2 -p 127.0.0.1:8080:8080 nginxinc/nginx-unprivileged:1.27
docker exec n2 id          # uid=101(nginx)

# 3. Read-only root - nginx needs writable cache and run directories
docker run -d --name n3 --read-only \\
  nginxinc/nginx-unprivileged:1.27
docker logs n3             # fails - cannot write

# 4. Give it exactly what it needs
docker run -d --name n4 -p 127.0.0.1:8081:8080 \\
  --read-only \\
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \\
  --tmpfs /var/cache/nginx:rw,size=16m \\
  --tmpfs /var/run:rw,size=1m \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  nginxinc/nginx-unprivileged:1.27
curl -s localhost:8081 | head -1

# 5. Verify
docker exec n4 cat /proc/1/status | grep CapEff   # 0000000000000000
docker exec n4 touch /probe                        # Read-only file system

docker rm -f n1 n2 n3 n4`,
      },
    ],
    verification: [
      {
        command: 'docker exec n4 id',
        what: 'Confirms the container is not running as root.',
        expected: 'A non-zero uid.',
      },
      {
        command: 'docker exec n4 cat /proc/1/status | grep CapEff',
        what: 'Confirms every capability was dropped.',
        expected: 'CapEff: 0000000000000000',
      },
    ],
    cleanup: [
      {
        command: 'docker rm -f n1 n2 n3 n4 2>/dev/null; true',
        what: 'Removes the lab containers.',
      },
    ],
  },
  relatedTopicIds: ['dk-multi-stage-builds', 'dk-config-and-resources', 'dk-ci-and-publishing'],
  docs: [
    { title: 'Docker security', url: 'https://docs.docker.com/engine/security/' },
    { title: 'Docker Scout', url: 'https://docs.docker.com/scout/' },
  ],
}
