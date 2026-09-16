import type { InterviewTopic } from '../../types'

export const dockerTopic: InterviewTopic = {
  id: 'docker',
  title: 'Docker & containers',
  shortTitle: 'Docker',
  icon: '🐳',
  order: 1,
  oneLiner:
    'Images, layers, the build cache, networking, volumes, and the debugging questions that come up in every round.',
  headlines: [
    'An image is a read-only template; a container is a running instance of it with a thin writable layer on top.',
    'Containers share the host kernel. That is the whole difference from a VM, and the reason they start in milliseconds.',
    'Every `RUN`, `COPY` and `ADD` creates a layer. Layer order decides whether your build cache hits or misses.',
    '`CMD` is the default command and is easy to override; `ENTRYPOINT` is the thing that always runs.',
    'Isolation is Linux namespaces (what a process can see) plus cgroups (how much it can use).',
    'Data in a container dies with it unless it is on a volume.',
  ],
  questions: [
    {
      id: 'itv-docker-1',
      level: 'basic',
      kind: 'open',
      prompt: 'What is Docker, and how is a container different from a virtual machine?',
      probing:
        'Whether you understand that containers share a kernel. Almost everything else about containers follows from that one fact.',
      answer: [
        'Docker is a platform for packaging an application together with everything it needs to run - the runtime, libraries and configuration - into a single artefact called an **image**, and then running that image as a **container**.',
        'The key difference from a virtual machine is what gets virtualised. A VM includes a **full guest operating system** with its own kernel, running on a hypervisor. A container has **no kernel of its own** - it is just a set of processes on the host, isolated so they cannot see the rest of the machine.',
        'That is why a container starts in milliseconds and a VM takes tens of seconds: there is no operating system to boot. It is also why a container image is tens of megabytes where a VM image is gigabytes.',
        'The trade-off is isolation strength. A VM has a hardware-enforced boundary; a container has a kernel-enforced one. If the kernel is compromised, every container on that host is affected. That is why you do not usually run untrusted multi-tenant workloads in plain containers on a shared host.',
      ],
      deeper: [
        'Containers must match the host kernel. This is why a Linux container cannot run natively on Windows or macOS - Docker Desktop quietly runs a Linux VM for you, and that VM is why builds feel slower on a Mac.',
        'Containers are not a Docker invention. Docker packaged existing Linux kernel features - namespaces and cgroups - behind a usable CLI and an image format, and that packaging is what made them mainstream.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'Virtual machines versus containers',
          caption:
            'Count the kernels. That single difference explains start-up time, image size and isolation strength.',
          root: {
            label: 'Physical host',
            children: [
              {
                label: 'Host OS + kernel',
                detail: 'One kernel, shared by every container',
                tone: 'accent',
                children: [
                  {
                    label: 'Container runtime (containerd)',
                    children: [
                      { label: 'Container A', detail: 'App + libs. No kernel.', tone: 'success' },
                      { label: 'Container B', detail: 'App + libs. No kernel.', tone: 'success' },
                    ],
                  },
                  {
                    label: 'Hypervisor (the VM route)',
                    detail: 'For comparison, on the same host',
                    tone: 'muted',
                    children: [
                      {
                        label: 'VM 1: guest OS + OWN kernel + app',
                        detail: 'Gigabytes, boots in seconds',
                      },
                      {
                        label: 'VM 2: guest OS + OWN kernel + app',
                        detail: 'Gigabytes, boots in seconds',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      traps: [
        'Saying "a container is a lightweight VM". It is not a VM at all - there is no guest operating system.',
        'Claiming containers are more secure than VMs. They are more isolated than plain processes but less isolated than VMs.',
      ],
      followUps: [
        'So what actually provides the isolation?',
        'Can you run a Windows container on a Linux host?',
        'When would you still choose a VM?',
      ],
      tags: ['fundamentals', 'vm', 'isolation'],
    },
    {
      id: 'itv-docker-2',
      level: 'basic',
      kind: 'open',
      prompt: 'What is the difference between an image and a container?',
      probing:
        'The single most common opening question. They want to hear "template versus running instance" without hesitation.',
      answer: [
        'An **image** is a read-only template: a stack of filesystem layers plus metadata saying what command to run, which ports are documented, which user to run as, and so on. It does not execute anything.',
        'A **container** is a running (or stopped) instance of an image. When you start one, Docker takes the image layers, adds a thin **writable layer** on top, and starts the process.',
        'The relationship is like a class and an object, or a program on disk and a process. One image can back hundreds of containers, and each gets its own writable layer, so they do not see one another’s changes.',
        'Anything written inside the container goes into that writable layer, and the writable layer is deleted when the container is removed. That is why data you care about belongs on a volume.',
      ],
      code: [
        {
          title: 'One image, several containers',
          language: 'bash',
          explanation:
            'All three containers share the same read-only layers on disk. Only their writable layers differ, which is why starting the third one is nearly free.',
          code: `docker pull nginx:1.27

docker run -d --name web1 nginx:1.27
docker run -d --name web2 nginx:1.27
docker run -d --name web3 nginx:1.27

docker ps            # three containers
docker images        # still ONE image

# A change inside one container is invisible to the others:
docker exec web1 sh -c 'echo hello > /tmp/note'
docker exec web2 cat /tmp/note      # No such file or directory`,
        },
      ],
      traps: [
        'Saying an image "runs". Images do not run; containers do.',
        'Thinking each container copies the whole image. Layers are shared read-only, and only the thin writable layer is per-container.',
      ],
      followUps: [
        'Where does data written inside a container go?',
        'What happens to that data when the container is removed?',
      ],
      tags: ['fundamentals', 'images', 'containers'],
    },
    {
      id: 'itv-docker-3',
      level: 'basic',
      kind: 'mcq',
      prompt: 'Which Dockerfile instructions create a new image layer?',
      options: [
        { id: 'a', text: 'Only RUN' },
        { id: 'b', text: 'RUN, COPY and ADD' },
        { id: 'c', text: 'Every instruction in the file' },
        { id: 'd', text: 'Only FROM and RUN' },
      ],
      correct: ['b'],
      probing:
        'Whether you understand the build cache well enough to optimise a Dockerfile, rather than just copying one.',
      answer: [
        'Only the instructions that **change the filesystem** create a layer: `RUN`, `COPY` and `ADD`.',
        'Everything else - `ENV`, `WORKDIR`, `EXPOSE`, `CMD`, `ENTRYPOINT`, `LABEL`, `USER`, `ARG` - only changes image **metadata**. In modern Docker those produce zero-byte metadata entries, not filesystem layers.',
        'This matters because layers are the unit of caching and the unit of transfer. Fewer, better-ordered filesystem layers means faster builds and smaller pushes.',
      ],
      deeper: [
        'Layers are also the unit of sharing. If two images are built `FROM` the same base, the base layers are stored once on the host and downloaded once.',
        'A file deleted in a later layer is still present in the earlier one. `RUN apt-get install ... && rm -rf /var/lib/apt/lists/*` in a single instruction genuinely shrinks the image; deleting in a separate `RUN` does not, because the earlier layer still carries the files. This is also why secrets baked into any layer are recoverable even if a later layer removes them.',
      ],
      traps: [
        '"Every instruction creates a layer" was true in very old Docker versions, and is still repeated in a lot of blog posts.',
        'Believing a later `RUN rm` shrinks the image. It adds a layer marking the file deleted; the bytes stay.',
      ],
      followUps: [
        'How would you use that knowledge to make a build cache hit more often?',
        'If a secret was copied in and deleted in the next layer, is it safe?',
      ],
      tags: ['dockerfile', 'layers', 'cache'],
    },
    {
      id: 'itv-docker-4',
      level: 'basic',
      kind: 'open',
      prompt: 'Explain the difference between CMD and ENTRYPOINT.',
      probing:
        'A classic. It separates people who have written a Dockerfile from people who have only run containers.',
      answer: [
        'Both say what runs when the container starts, but they differ in how easily they are overridden.',
        '`ENTRYPOINT` is the **fixed** part - the executable the image is really for. `CMD` is the **default arguments**, and it is replaced by anything you put after the image name in `docker run`.',
        'So with `ENTRYPOINT ["ping"]` and `CMD ["localhost"]`, running `docker run myimage` pings localhost, and `docker run myimage example.com` pings example.com. The `ping` part cannot be replaced without `--entrypoint`.',
        'If you only set `CMD`, the whole command is replaceable - which is what you want for a general-purpose image. If you set `ENTRYPOINT`, the image behaves like a single-purpose executable.',
      ],
      deeper: [
        'Always prefer the **exec form** - `CMD ["nginx", "-g", "daemon off;"]` - over the shell form `CMD nginx -g "daemon off;"`. The shell form wraps your process in `/bin/sh -c`, so your application becomes PID 2 and never receives `SIGTERM`. That means it is killed rather than shut down gracefully, and on Kubernetes it will ignore the entire termination grace period.',
        'A common production pattern is `ENTRYPOINT ["/entrypoint.sh"]` with the real command as `CMD`, so the script can do setup and then `exec "$@"` - the `exec` matters, so the real process replaces the shell and keeps PID 1.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'What actually runs?',
          caption:
            'Arguments after the image name replace CMD. Only --entrypoint replaces ENTRYPOINT.',
          question: 'What is set, and what did you pass on the command line?',
          branches: [
            {
              condition: 'CMD only, no arguments passed',
              result: 'The CMD runs',
              detail: 'The ordinary default case',
              tone: 'accent',
            },
            {
              condition: 'CMD only, arguments passed',
              result: 'Your arguments replace CMD entirely',
              detail: 'docker run img echo hi  runs  echo hi',
            },
            {
              condition: 'ENTRYPOINT and CMD, arguments passed',
              result: 'ENTRYPOINT + your arguments',
              detail: 'Your arguments replace CMD, not ENTRYPOINT',
            },
            {
              condition: 'you need to replace ENTRYPOINT',
              result: 'docker run --entrypoint sh img',
              detail: 'The only way in. Useful for debugging a broken image.',
              tone: 'warning',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The four combinations',
          language: 'dockerfile',
          explanation:
            'The comment above each line is what `docker run myimage` does, and what `docker run myimage example.com` does.',
          code: `# 1. CMD only - fully replaceable
CMD ["ping", "localhost"]
#    docker run img                -> ping localhost
#    docker run img example.com    -> example.com  (not a command: fails)

# 2. ENTRYPOINT only - arguments are appended
ENTRYPOINT ["ping"]
#    docker run img                -> ping        (usage error)
#    docker run img example.com    -> ping example.com

# 3. Both - the usual, most useful pattern
ENTRYPOINT ["ping"]
CMD ["localhost"]
#    docker run img                -> ping localhost
#    docker run img example.com    -> ping example.com

# 4. Shell form - avoid. Your process is not PID 1.
CMD ping localhost
#    actually runs: /bin/sh -c "ping localhost"
#    SIGTERM goes to sh, not to ping`,
        },
      ],
      traps: [
        'Saying "ENTRYPOINT cannot be overridden". It can, with `--entrypoint`.',
        'Using the shell form and then wondering why the container takes 30 seconds to stop - it is being SIGKILLed after the grace period because SIGTERM went to the shell.',
      ],
      followUps: [
        'Why does the exec form matter for graceful shutdown?',
        'How would you get a shell in an image whose ENTRYPOINT is a binary?',
      ],
      tags: ['dockerfile', 'entrypoint', 'cmd', 'signals'],
    },
    {
      id: 'itv-docker-5',
      level: 'basic',
      kind: 'mcq',
      prompt:
        'You run `docker run -d nginx` and then `docker ps` shows nothing. What is the most likely explanation?',
      options: [
        { id: 'a', text: 'The image failed to pull' },
        {
          id: 'b',
          text: 'The container started and exited, so it needs `docker ps -a` to be seen',
        },
        { id: 'c', text: '`-d` means dry-run, so nothing was created' },
        { id: 'd', text: 'nginx does not work in Docker without a volume' },
      ],
      correct: ['b'],
      probing:
        'Basic operational reflex: do you know that `docker ps` only shows running containers?',
      answer: [
        '`docker ps` lists **running** containers only. `docker ps -a` lists all of them, including ones that have exited.',
        'A container exits when its main process exits. If the process ran and finished - or crashed on startup - the container stops immediately, and `docker ps` will not show it.',
        'The next two commands are always the same: `docker ps -a` to find it and see the exit code, then `docker logs <name>` to see why it stopped.',
      ],
      deeper: [
        '`-d` means detached: run in the background and print the container id. It is not a dry run.',
        'The commonest real causes are a missing environment variable, a config file the image cannot read, a port already in use, or - very often - the container having no long-running foreground process at all.',
      ],
      code: [
        {
          title: 'The reflex sequence',
          language: 'bash',
          code: `docker ps -a                     # find it, and read STATUS / exit code
docker logs <container>          # what did it say before dying?
docker logs --tail 50 <container>

# Exit code 0    = it finished normally. Probably no foreground process.
# Exit code 1/2  = the application errored. Read the logs.
# Exit code 125  = the docker daemon itself failed (bad flag)
# Exit code 126  = the command was found but is not executable
# Exit code 127  = the command was not found in the image
# Exit code 137  = SIGKILL. Usually out of memory.
# Exit code 143  = SIGTERM. Something asked it to stop.`,
        },
      ],
      traps: [
        'Assuming the image failed to pull - that produces a visible error from `docker run`, not a silent absence.',
      ],
      followUps: [
        'What does exit code 137 usually mean?',
        'How would you keep a container running for debugging?',
      ],
      tags: ['operations', 'debugging', 'exit codes'],
    },
    {
      id: 'itv-docker-6',
      level: 'intermediate',
      kind: 'open',
      prompt:
        'Explain Docker image layers and the build cache. How do you order a Dockerfile to make builds fast?',
      probing:
        'This is the question that predicts whether you will actually make CI faster. They want the "least-changing first" principle.',
      answer: [
        'A Docker image is a stack of read-only layers, one per filesystem-changing instruction. Each layer is identified by a hash of its content and the instruction that produced it.',
        'During a build Docker walks the Dockerfile top to bottom. For each instruction it checks whether it already has a cached layer for that exact instruction **and** that exact parent layer. If yes it reuses it; if no it rebuilds - and **every instruction after that point is also rebuilt**, because their parent changed.',
        'That cascade is the whole optimisation. Put the things that change **least often** at the top and the things that change **most often** at the bottom.',
        'In practice that means: base image, then system packages, then dependency manifests, then install dependencies, then finally copy your source code. Your source changes on every commit; your `package.json` changes weekly; your base image changes monthly.',
      ],
      deeper: [
        'The classic mistake is `COPY . .` before installing dependencies. That invalidates the dependency layer on every single source change, so every build reinstalls everything. Copying only the manifest first, installing, then copying the rest can turn a four-minute build into twenty seconds.',
        'For `COPY`, the cache key is the **contents** of the copied files, not their timestamps. For `RUN`, it is the literal command string - which is why `RUN apt-get update` alone can serve a months-old cached package list. Always combine it: `RUN apt-get update && apt-get install -y ...` in one instruction.',
        'In CI the cache is often cold because each job gets a fresh machine. `docker build --cache-from` with a registry image, or BuildKit with `--mount=type=cache`, is how you get cache hits across runners.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'How one change cascades through the cache',
          caption:
            'A cache miss invalidates everything below it. That is why instruction order is the single biggest build-speed lever.',
          nodes: [
            {
              label: 'FROM node:20-alpine',
              detail: 'Changes monthly. Cached.',
              tone: 'success',
            },
            {
              label: 'COPY package*.json ./',
              detail: 'Changes when a dependency changes. Usually cached.',
              arrowLabel: 'cache hit',
              tone: 'success',
            },
            {
              label: 'RUN npm ci',
              detail: 'The expensive step. Reused while the manifest is unchanged.',
              arrowLabel: 'cache hit',
              tone: 'success',
            },
            {
              label: 'COPY . .',
              detail: 'Changes on every commit. Always a miss.',
              arrowLabel: 'source changed',
              tone: 'warning',
              branch: {
                label: 'Everything below rebuilds',
                detail: 'Which is fine - there is almost nothing left',
              },
            },
            {
              label: 'RUN npm run build',
              detail: 'Rebuilds, but only compiles - it does not re-download',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Slow versus fast, same result',
          language: 'dockerfile',
          explanation:
            'The only difference is where `COPY . .` sits. On a typical Node project that is minutes per build, on every commit.',
          code: `# SLOW - npm ci reruns on every source change
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
CMD ["node", "dist/server.js"]

# FAST - npm ci only reruns when package-lock.json changes
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/server.js"]`,
        },
      ],
      traps: [
        'Saying "use --no-cache to be safe". That guarantees a slow build every time and is only appropriate for a scheduled clean rebuild.',
        'Forgetting `.dockerignore`. Without it, `COPY . .` copies `node_modules` and `.git`, which both bloats the image and busts the cache constantly.',
      ],
      followUps: [
        'Your CI has no cache at all between runs. What do you do?',
        'Why does `RUN apt-get update` on its own line cause problems?',
      ],
      tags: ['dockerfile', 'cache', 'performance', 'ci'],
    },
    {
      id: 'itv-docker-7',
      level: 'intermediate',
      kind: 'open',
      prompt: 'What is a multi-stage build and why would you use one?',
      probing: 'Whether you have shipped a production image, or only built development ones.',
      answer: [
        'A multi-stage build uses several `FROM` instructions in one Dockerfile. Each `FROM` starts a new stage, and a later stage can copy files out of an earlier one with `COPY --from=<stage>`.',
        'The point is that **only the final stage becomes the image**. Everything in the earlier stages - compilers, build tools, source code, dev dependencies, test fixtures - is discarded.',
        'So you get a build stage with the full toolchain, and a runtime stage with a minimal base image containing nothing but the compiled artefact and its runtime dependencies.',
        'The payoff is size and security together. A Go service goes from about 800 MB to about 15 MB. And because the compiler, package manager and shell are simply not present, most CVE scanner findings disappear along with the attack surface.',
      ],
      deeper: [
        'You can target a specific stage with `docker build --target builder`, which is how you build a test image and a production image from the same Dockerfile.',
        '`COPY --from` also accepts an external image: `COPY --from=nginx:latest /etc/nginx/nginx.conf ./` pulls a file straight out of another image without running it.',
        'For compiled languages the final stage can be `scratch` - literally empty. For anything needing libc or certificates, `gcr.io/distroless/*` or `alpine` are the usual choices. Distroless has no shell, which is excellent for security and means you must use `kubectl debug` or an ephemeral container to inspect it.',
      ],
      code: [
        {
          title: 'Go: 800 MB down to about 15 MB',
          language: 'dockerfile',
          explanation:
            'The final image has no compiler, no source, no package manager and no shell - just a static binary and the CA certificates it needs for TLS.',
          code: `# ---- Stage 1: build
FROM golang:1.23 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO_ENABLED=0 makes a static binary, so it needs no libc at runtime.
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/app ./cmd/server

# ---- Stage 2: runtime
FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/app /app
USER 65532:65532
ENTRYPOINT ["/app"]`,
        },
        {
          title: 'Node: the same idea with a runtime that needs a base image',
          language: 'dockerfile',
          explanation:
            'Note `npm ci --omit=dev` in the runtime stage: the build stage needed devDependencies to compile, the runtime stage does not.',
          code: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]`,
        },
      ],
      traps: [
        'Thinking the intermediate stages are still in the pushed image. They are not - only the last stage is.',
        'Copying `node_modules` from the build stage, which brings the dev dependencies back in and defeats the point.',
      ],
      followUps: [
        'How would you debug a distroless image with no shell?',
        'How do you build a test image and a production image from one Dockerfile?',
      ],
      tags: ['dockerfile', 'multi-stage', 'image size', 'security'],
    },
    {
      id: 'itv-docker-8',
      level: 'intermediate',
      kind: 'mcq',
      prompt: 'What is the difference between COPY and ADD in a Dockerfile?',
      options: [
        { id: 'a', text: 'They are identical; ADD is just the older name' },
        {
          id: 'b',
          text: 'ADD can also fetch a URL and auto-extract local tar archives; COPY only copies files',
        },
        { id: 'c', text: 'COPY works on directories, ADD only on single files' },
        { id: 'd', text: 'ADD preserves file permissions and COPY does not' },
      ],
      correct: ['b'],
      probing:
        'A small factual question that also tests whether you follow the "prefer the predictable tool" instinct.',
      answer: [
        '`COPY` does exactly one thing: copy files or directories from the build context into the image.',
        '`ADD` does that too, but it has two extra behaviours: it can take a **URL** as the source, and it will **automatically extract** a local tar archive into the destination.',
        'The guidance - HashiCorp’s, Docker’s own, and every linter - is to **prefer `COPY`** and only use `ADD` when you specifically want auto-extraction. The reason is predictability: with `ADD` the behaviour depends on what the source happens to be, so adding a `.tar.gz` silently unpacks it while adding a `.zip` does not.',
      ],
      deeper: [
        'Using `ADD` with a URL is a bad pattern anyway: the download is not cached well, you cannot verify a checksum inline, and the remote file can change under you. `RUN curl -fsSL url -o file && echo "<sha> file" | sha256sum -c -` is explicit and verifiable.',
        'Modern BuildKit adds `ADD --checksum=sha256:...` for remote files, which removes the verification objection but not the predictability one.',
      ],
      traps: [
        'Saying they are identical. `hadolint` will flag `ADD` used where `COPY` would do, and interviewers often know this rule.',
      ],
      followUps: ['So when would you actually use ADD?', 'How do you get a remote file in safely?'],
      tags: ['dockerfile', 'copy', 'add'],
    },
    {
      id: 'itv-docker-9',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do you persist data from a container? Explain volumes, bind mounts and tmpfs.',
      probing:
        'Whether you know that container filesystems are ephemeral, and whether you can pick the right storage for a given job.',
      answer: [
        'Anything written inside a container goes to its writable layer, which is destroyed when the container is removed. To keep data you have to mount storage from outside.',
        'A **named volume** is storage Docker manages, under `/var/lib/docker/volumes/`. You refer to it by name and Docker handles the rest. This is the default choice for databases and anything stateful, because it is portable across hosts with the right driver and is not tied to a host path.',
        'A **bind mount** maps a specific host directory into the container. You control exactly where it lives. This is ideal for local development - mount your source directory and edit files with live reload - and risky in production, because the container now depends on the host’s directory layout and can write anywhere you point it.',
        'A **tmpfs mount** lives in the host’s memory and never touches disk. Use it for secrets, caches and scratch files you actively do not want persisted.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Which mount type?',
          caption:
            'The deciding questions are who owns the path and whether the data should survive.',
          question: 'What is the data for?',
          branches: [
            {
              condition: 'it must survive the container, in production',
              result: 'Named volume',
              detail: 'Docker manages the location. Databases, uploads, state.',
              tone: 'accent',
            },
            {
              condition: 'you are editing source on your laptop',
              result: 'Bind mount',
              detail: 'Host path into the container, for live reload',
            },
            {
              condition: 'it is a secret or a scratch file',
              result: 'tmpfs',
              detail: 'Memory only, never written to disk',
            },
            {
              condition: 'it is rebuilt every run and you do not care',
              result: 'No mount at all',
              detail: 'The writable layer is fine for genuinely disposable data',
            },
          ],
        },
      ],
      code: [
        {
          title: 'All three, and how to inspect them',
          language: 'bash',
          code: `# Named volume - Docker owns the location
docker volume create pgdata
docker run -d --name db -v pgdata:/var/lib/postgresql/data postgres:16
docker volume inspect pgdata

# Bind mount - you own the location. Note the absolute host path.
docker run -d --name dev -v "$(pwd)/src:/app/src" node:20 npm run dev

# The modern, more explicit syntax
docker run -d --mount type=volume,source=pgdata,target=/var/lib/postgresql/data postgres:16
docker run -d --mount type=bind,source="$(pwd)/src",target=/app/src,readonly node:20

# tmpfs - memory only
docker run -d --mount type=tmpfs,target=/run/secrets,tmpfs-size=64m myapp

# Proof that the writable layer does not survive:
docker run --name tmp alpine sh -c 'echo data > /file'
docker rm tmp
# /file is gone with the container.`,
        },
      ],
      traps: [
        'Saying "volumes and bind mounts are the same thing with different syntax". The ownership of the path is the whole difference, and it matters in production.',
        'Using a bind mount in production and then being surprised when the container behaves differently on a different host.',
        'Forgetting that a bind mount over a directory **hides** whatever was in the image at that path.',
      ],
      followUps: [
        'How would you back up a named volume?',
        'What happens to a volume when the container using it is deleted?',
      ],
      tags: ['storage', 'volumes', 'bind mounts'],
    },
    {
      id: 'itv-docker-10',
      level: 'intermediate',
      kind: 'open',
      prompt:
        'Explain Docker networking. What are the main network drivers and when do you use each?',
      probing:
        'Container-to-container communication trips up a lot of candidates. They want to hear about the user-defined bridge and DNS.',
      answer: [
        '**bridge** is the default. Docker creates a private virtual network on the host; each container gets an IP on it and reaches the outside through NAT. To reach a container from outside you publish a port with `-p host:container`.',
        'The important detail is the difference between the **default** bridge and a **user-defined** bridge. On a user-defined network, Docker provides automatic DNS: containers can reach each other by **container name**. On the default bridge they cannot - you would need IPs or the deprecated `--link`. So always create a network.',
        '**host** removes network isolation entirely: the container uses the host’s network stack directly, so no NAT and no port publishing. It is faster and occasionally necessary, but the container can bind any host port and there is no isolation left.',
        '**none** gives the container no network at all, for jobs that must not talk to anything. **overlay** spans multiple hosts and is what Swarm and multi-host setups use.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Why containers cannot find each other',
          caption:
            'Nine times out of ten the fix is "put them on the same user-defined network and use the container name".',
          nodes: [
            {
              label: 'App cannot reach the database',
              detail: 'Connection refused, or name not resolving',
              tone: 'warning',
            },
            {
              label: 'Are they on the SAME network?',
              detail: 'docker network inspect <net>',
              tone: 'accent',
              branch: {
                label: 'Different networks',
                detail: 'They are isolated by design. Attach them to one network.',
              },
            },
            {
              label: 'Is it a USER-DEFINED network?',
              detail: 'The default bridge has no DNS between containers',
              arrowLabel: 'same network',
              branch: {
                label: 'Default bridge',
                detail: 'Name resolution does not work. Create a network.',
              },
            },
            {
              label: 'Using the container NAME, not localhost?',
              detail: 'Inside a container, localhost is that container',
              branch: {
                label: 'Using localhost',
                detail: 'The classic error. Use the service or container name.',
              },
            },
            {
              label: 'Using the CONTAINER port, not the published one?',
              detail: 'Container to container bypasses the -p mapping entirely',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The pattern that works',
          language: 'bash',
          explanation:
            'Note the app connects to `db:5432` - the container name and the *container* port, not the published one.',
          code: `docker network create appnet

docker run -d --name db --network appnet \\
  -e POSTGRES_PASSWORD=secret postgres:16

docker run -d --name api --network appnet -p 8080:8080 \\
  -e DATABASE_URL="postgres://postgres:secret@db:5432/postgres" myapi

# From inside the api container, this resolves:
docker exec api getent hosts db

# Common mistakes, and why they fail:
#   DATABASE_URL=postgres://...@localhost:5432    <- localhost is the API itself
#   DATABASE_URL=postgres://...@db:15432          <- 15432 is the HOST port, not
#                                                    the container port
#   (containers on the default bridge)            <- no DNS, name will not resolve`,
        },
      ],
      traps: [
        'Using `localhost` from one container to reach another. Inside a container, `localhost` is that container.',
        'Using the published host port for container-to-container traffic. That traffic never goes through the port mapping.',
        'Assuming the default bridge gives you DNS. It does not; only user-defined networks do.',
      ],
      followUps: [
        'What does `-p 8080:80` actually mean, and which number is which?',
        'How does EXPOSE differ from -p?',
      ],
      tags: ['networking', 'dns', 'bridge', 'debugging'],
    },
    {
      id: 'itv-docker-11',
      level: 'intermediate',
      kind: 'mcq',
      prompt: 'What does the `EXPOSE` instruction in a Dockerfile actually do?',
      options: [
        { id: 'a', text: 'It publishes the port on the host automatically' },
        { id: 'b', text: 'It opens the port in the host firewall' },
        {
          id: 'c',
          text: 'It is documentation and metadata only - you still need -p or -P to publish',
        },
        { id: 'd', text: 'It binds the container process to that port' },
      ],
      correct: ['c'],
      probing:
        'A precise, commonly-misunderstood fact. Getting it right signals you have read the documentation rather than guessed.',
      answer: [
        '`EXPOSE` **does not publish anything**. It records in the image metadata that the application is expected to listen on that port.',
        'Two things use it. Humans - `docker image inspect` shows it, so it documents the image. And `docker run -P` (capital P), which publishes **every** exposed port to a random high host port.',
        'To actually reach the container from the host you still need `-p <host>:<container>`, whether or not `EXPOSE` is present. You can publish a port that was never exposed, and exposing a port you never publish changes nothing.',
      ],
      deeper: [
        'It also does not affect container-to-container traffic on a user-defined network - those containers can reach any listening port on each other regardless of `EXPOSE`.',
        'It is still worth writing, because it is the only machine-readable statement of intent in the image, and some tooling (Compose, some PaaS platforms) reads it.',
      ],
      traps: [
        'Believing EXPOSE opens a firewall port. It touches no firewall and no host networking at all.',
      ],
      followUps: ['What does -P do?', 'In `-p 8080:80`, which is the host port?'],
      tags: ['dockerfile', 'networking', 'ports'],
    },
    {
      id: 'itv-docker-12',
      level: 'intermediate',
      kind: 'multi',
      prompt:
        'Which of these genuinely reduce the size of a production Docker image? (Select all that apply.)',
      options: [
        { id: 'a', text: 'Use a multi-stage build and ship only the final artefact' },
        { id: 'b', text: 'Choose a smaller base image such as alpine, slim or distroless' },
        {
          id: 'c',
          text: 'Add `RUN rm -rf /var/lib/apt/lists/*` as a separate instruction after the install',
        },
        { id: 'd', text: 'Combine apt-get update, install and cleanup into a single RUN' },
        {
          id: 'e',
          text: 'Add a .dockerignore so the build context excludes node_modules and .git',
        },
      ],
      correct: ['a', 'b', 'd', 'e'],
      probing:
        'Option C is the trap. It is extremely common advice and it does nothing, because layers are immutable.',
      answer: [
        'Options A, B, D and E all reduce the image. **C does not**, and that is the point of the question.',
        'Layers are immutable. Deleting a file in a **later** layer writes a whiteout marker; the bytes still exist in the earlier layer and still ship with the image. Only cleanup **within the same `RUN`** actually removes them, which is why D works and C does not.',
        'Multi-stage builds are usually the biggest single win, because the entire toolchain disappears. Base image choice is next: `node:20` is about 1.1 GB, `node:20-alpine` about 130 MB.',
        '`.dockerignore` matters for a slightly different reason: it shrinks the **build context** sent to the daemon, which speeds up builds and stops `COPY . .` accidentally baking in `.git`, `node_modules` and local `.env` files.',
      ],
      code: [
        {
          title: 'The cleanup that works, and the one that does not',
          language: 'dockerfile',
          explanation:
            'Both produce the same running image. One is about 40 MB larger, permanently.',
          code: `# DOES NOT SHRINK - the files are still in the previous layer
RUN apt-get update && apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# DOES SHRINK - install and cleanup happen in one layer
RUN apt-get update \\
 && apt-get install -y --no-install-recommends curl \\
 && rm -rf /var/lib/apt/lists/*

# The same rule everywhere:
RUN pip install --no-cache-dir -r requirements.txt
RUN npm ci --omit=dev && npm cache clean --force`,
        },
      ],
      traps: [
        'The separate-`RUN` cleanup is in a huge number of real Dockerfiles and blog posts. It is pure ceremony.',
        'Assuming alpine is always right - it uses musl instead of glibc, which occasionally breaks native modules and can badly hurt Python performance.',
      ],
      followUps: [
        'Why does a later `rm` not shrink the image?',
        'What would you actually check first on a 2 GB image?',
      ],
      tags: ['image size', 'layers', 'optimisation'],
    },
    {
      id: 'itv-docker-13',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'A team reports their production image is 1.8 GB and deploys are slow. Walk me through how you would reduce it.',
      probing:
        'They want a method, not a list of tips. Measure, find the biggest contributor, fix that, measure again.',
      answer: [
        'First I would **measure before changing anything**. `docker history --no-trunc <image>` shows the size of every layer and the instruction that created it, so within a minute I know whether this is one 1.5 GB layer or fifty 30 MB ones. `dive` is the better tool if it is available - it shows exactly which files are in each layer and flags wasted space.',
        'Then I would look at the base image, because it is usually the single biggest and cheapest win. Moving `node:20` to `node:20-alpine`, or `python:3.12` to `python:3.12-slim`, often removes 800 MB for a one-line change.',
        'Next, is it a multi-stage build? If the image contains a compiler, a package manager, source code or test files, it is shipping its build toolchain. Splitting into a build stage and a runtime stage typically does more than everything else combined.',
        'Then the mechanical fixes: a `.dockerignore` so `.git` and `node_modules` never enter the context; combining `apt-get`/`pip`/`npm` install and cleanup into single `RUN` instructions; `--no-install-recommends`; `--no-cache-dir`.',
        'Finally I would re-measure and set a **budget** in CI - fail the build if the image exceeds an agreed size - so it does not silently creep back.',
      ],
      deeper: [
        'It is worth asking whether size is really the problem. If deploys are slow because every node pulls the full image, a smaller image helps a lot. If they are slow because the rollout waits on readiness probes, shrinking the image changes nothing - so confirm the bottleneck before optimising.',
        'Layer sharing matters too: if ten services share one base image, the nodes download those base layers once. Ten services on ten different bases is worse than ten slightly larger images on a common base.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'The order to attack it in',
          caption:
            'Biggest lever first. Measuring before and after is what separates this from cargo-culting tips.',
          nodes: [
            {
              label: 'Measure: docker history, or dive',
              detail: 'Which layer is actually big?',
              tone: 'accent',
            },
            {
              label: 'Swap the base image',
              detail: 'alpine, slim or distroless. Often 500 MB to 1 GB.',
              arrowLabel: 'usually the biggest win',
            },
            {
              label: 'Introduce a multi-stage build',
              detail: 'Drop the compiler, source and dev dependencies',
              branch: {
                label: 'Already multi-stage?',
                detail: 'Check nothing unnecessary is being COPYed forward',
              },
            },
            {
              label: 'Fix the mechanical waste',
              detail: '.dockerignore, combined RUN, --no-install-recommends',
            },
            {
              label: 'Re-measure, then set a CI size budget',
              detail: 'So it cannot creep back unnoticed',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Finding where the megabytes are',
          language: 'bash',
          code: `# Per-layer size, largest contributors at a glance
docker history --no-trunc --format '{{.Size}}\\t{{.CreatedBy}}' myimage:latest \\
  | sort -h -r | head -15

# The best tool for this, if you can install it
dive myimage:latest

# Compare bases before committing to a change
docker images | grep -E 'node|python'

# A CI size budget - fails the build if the image grows past 250 MB
SIZE=$(docker image inspect myimage:latest --format '{{.Size}}')
LIMIT=$((250 * 1024 * 1024))
[ "$SIZE" -le "$LIMIT" ] || { echo "Image is $((SIZE/1024/1024))MB, limit 250MB"; exit 1; }`,
        },
      ],
      traps: [
        'Jumping straight to alpine without checking. If the app has native dependencies compiled against glibc, alpine can break it or make it slower.',
        'Optimising the image when the actual deploy bottleneck is elsewhere.',
      ],
      followUps: [
        'How would you stop it regressing?',
        'When would you NOT use alpine?',
        'What if the big layer is your application data?',
      ],
      tags: ['scenario', 'image size', 'troubleshooting', 'ci'],
    },
    {
      id: 'itv-docker-14',
      level: 'advanced',
      kind: 'open',
      prompt: 'What actually provides container isolation? Explain namespaces and cgroups.',
      probing:
        'The senior version of "what is a container". They want to know you understand it is kernel features, not magic.',
      answer: [
        'A container is an ordinary Linux process with two kernel mechanisms applied to it.',
        '**Namespaces** control what a process can **see**. Each namespace type virtualises one global resource: `pid` gives the container its own process tree so its main process is PID 1 and it cannot see host processes; `net` gives it its own interfaces, routes and ports; `mnt` gives it its own filesystem view; `uts` its own hostname; `ipc` its own shared memory; and `user` maps container UIDs to different host UIDs.',
        '**cgroups** - control groups - control how much a process can **use**: CPU shares and quota, memory limit, block I/O, PIDs. This is what `--memory` and `--cpus` set, and what makes a container get OOM-killed rather than taking the host down.',
        'So the slogan is: **namespaces are what you can see, cgroups are what you can use**. There is no container object in the kernel - a container is just the combination of these applied to a process, plus a filesystem from an image.',
      ],
      deeper: [
        'This explains the security model exactly. The kernel is shared, so a kernel vulnerability crosses the boundary. It also explains why `--privileged` is so dangerous: it disables most of these restrictions and effectively gives the container the host.',
        'The user namespace is the one most often left off. Without it, root inside the container is root on the host - so a container escape lands you as root. Running as a non-root `USER` and enabling user-namespace remapping both mitigate this.',
        'Related hardening: drop all capabilities and add back only what is needed, set `--read-only` with a tmpfs for writable paths, and apply seccomp and AppArmor or SELinux profiles.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'What makes a process a container',
          caption:
            'There is no container primitive in the kernel. It is a process plus these restrictions plus an image filesystem.',
          root: {
            label: 'A container',
            detail: 'An ordinary Linux process, restricted',
            tone: 'accent',
            children: [
              {
                label: 'Namespaces - what it can SEE',
                tone: 'success',
                children: [
                  { label: 'pid', detail: 'Own process tree. Your app is PID 1.' },
                  { label: 'net', detail: 'Own interfaces, routes and ports' },
                  { label: 'mnt', detail: 'Own filesystem view' },
                  { label: 'uts / ipc / user', detail: 'Hostname, shared memory, UID mapping' },
                ],
              },
              {
                label: 'cgroups - what it can USE',
                tone: 'success',
                children: [
                  { label: 'memory', detail: 'The limit that triggers OOMKilled' },
                  { label: 'cpu', detail: 'Shares and quota, enforced by throttling' },
                  { label: 'pids, blkio', detail: 'Process count and disk I/O' },
                ],
              },
              {
                label: 'Union filesystem',
                detail: 'Read-only image layers plus a writable layer',
                tone: 'muted',
              },
            ],
          },
        },
      ],
      code: [
        {
          title: 'Seeing it for yourself',
          language: 'bash',
          code: `# The container's process tree - it sees only itself
docker run --rm alpine ps aux

# The SAME process, from the host: an ordinary PID
docker run -d --name demo alpine sleep 300
docker inspect -f '{{.State.Pid}}' demo
ps -p "$(docker inspect -f '{{.State.Pid}}' demo)" -o pid,cmd

# Its namespaces, on the host
sudo ls -l /proc/$(docker inspect -f '{{.State.Pid}}' demo)/ns

# Its cgroup limits
docker run -d --name limited --memory=256m --cpus=0.5 alpine sleep 300
docker stats --no-stream limited

# Hardening flags worth knowing by name
docker run -d \\
  --read-only --tmpfs /tmp \\
  --cap-drop=ALL --cap-add=NET_BIND_SERVICE \\
  --security-opt=no-new-privileges \\
  --user 1000:1000 \\
  myapp`,
        },
      ],
      traps: [
        'Saying "Docker provides the isolation". Docker configures it; the Linux kernel provides it.',
        'Forgetting the user namespace, and so not realising that container root is host root by default.',
      ],
      followUps: [
        'What does --privileged actually disable?',
        'Why is running as root inside a container a problem if it is isolated anyway?',
        'What happens when a container hits its memory cgroup limit?',
      ],
      tags: ['internals', 'security', 'namespaces', 'cgroups'],
    },
    {
      id: 'itv-docker-15',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'A container runs fine on a developer laptop but crashes in CI with exit code 137. Walk me through your diagnosis.',
      probing:
        'Whether you recognise 137 immediately and reason about resource limits rather than guessing at the application.',
      answer: [
        'Exit code 137 is 128 + 9, meaning the process received **SIGKILL**. In a container that almost always means the **OOM killer** - it exceeded its memory cgroup limit. It was not a crash in the application; it was killed from outside.',
        'I would confirm that first with `docker inspect` and look at `State.OOMKilled`. If that is true, it is settled and I can stop guessing.',
        'Then the obvious question: why does it work locally? Almost always because the laptop has no limit and CI does. Docker Desktop defaults to several gigabytes; a CI runner might give the container 512 MB. The application has always used 900 MB - it just never hit a ceiling before.',
        'So I would measure the actual usage with `docker stats` during a local run, compare it against the CI limit, and then decide: raise the limit if the usage is legitimate, or fix the application if it is not - a JVM without `-XX:MaxRAMPercentage`, a Node process without `--max-old-space-size`, or an unbounded in-memory cache are the usual culprits.',
      ],
      deeper: [
        'Runtimes that predate cgroup awareness are a classic trap. An old JVM reads the **host** memory and sizes its heap from that, so a 2 GB heap inside a 512 MB container is guaranteed to be OOM-killed. Java 10+ and Node 12+ are container-aware, but only if you do not override the limits manually.',
        'It is worth ruling out the alternatives quickly: 137 can also be a deliberate `docker kill`, or Kubernetes killing a container whose liveness probe failed. `State.OOMKilled` distinguishes them.',
        'The related codes are worth knowing: 143 is SIGTERM (a graceful stop), 139 is SIGSEGV, 1 and 2 are ordinary application errors.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Diagnosing exit code 137',
          caption:
            'The first check settles whether this is a resource problem or something else entirely.',
          nodes: [
            {
              label: 'Container exits with 137',
              detail: '128 + 9 = SIGKILL',
              tone: 'warning',
            },
            {
              label: 'Check State.OOMKilled',
              detail: 'docker inspect -f "{{.State.OOMKilled}}" <c>',
              tone: 'accent',
              branch: {
                label: 'false',
                detail: 'Something sent SIGKILL: a manual kill, or a failed liveness probe',
              },
            },
            {
              label: 'It hit its memory limit',
              detail: 'Not an application crash - killed from outside',
              arrowLabel: 'true',
            },
            {
              label: 'Compare real usage with the limit',
              detail: 'docker stats locally, then read the CI limit',
            },
            {
              label: 'Raise the limit, or fix the memory use',
              detail: 'Runtime heap flags, unbounded caches, a leak',
              tone: 'success',
              branch: {
                label: 'Runtime not cgroup-aware',
                detail: 'An old JVM sizing its heap from HOST memory',
              },
            },
          ],
        },
      ],
      code: [
        {
          title: 'The commands, in order',
          language: 'bash',
          code: `# 1. Was it the OOM killer? This is the question that settles it.
docker inspect -f '{{.State.OOMKilled}} {{.State.ExitCode}}' myapp

# 2. What does it actually use? Watch it while the workload runs.
docker stats myapp

# 3. What limit is it running under?
docker inspect -f '{{.HostConfig.Memory}}' myapp   # bytes; 0 = unlimited

# 4. Reproduce the CI limit locally - this is the key step
docker run --memory=512m --memory-swap=512m myapp

# 5. Host-side evidence, if you have access
dmesg -T | grep -i -E 'killed process|out of memory'

# Container-aware runtime flags
#   Java:   -XX:MaxRAMPercentage=75
#   Node:   --max-old-space-size=384    (for a 512MB limit)
#   Python: usually fine, but watch multiprocessing worker counts`,
        },
      ],
      traps: [
        'Assuming 137 is an application bug and going straight to the code.',
        'Raising the limit without measuring, which hides a genuine leak until it is a production incident.',
        'Forgetting `--memory-swap`. Setting only `--memory` can allow swap and mask the problem locally.',
      ],
      followUps: [
        'What if OOMKilled is false?',
        'How would you set a sensible memory limit in the first place?',
        'How does this present in Kubernetes?',
      ],
      tags: ['scenario', 'troubleshooting', 'memory', 'exit codes'],
    },
    {
      id: 'itv-docker-16',
      level: 'advanced',
      kind: 'multi',
      prompt:
        'Which of these are genuine Docker security best practices for a production image? (Select all that apply.)',
      options: [
        { id: 'a', text: 'Run the process as a non-root USER' },
        { id: 'b', text: 'Pin the base image to a digest or specific version rather than :latest' },
        { id: 'c', text: 'Pass secrets with ARG at build time so they are not in the final CMD' },
        { id: 'd', text: 'Drop all Linux capabilities and add back only what is needed' },
        { id: 'e', text: 'Run the container with --read-only and a tmpfs for writable paths' },
      ],
      correct: ['a', 'b', 'd', 'e'],
      probing:
        'Option C is the trap - a very common and genuinely dangerous misunderstanding about build arguments.',
      answer: [
        'A, B, D and E are all good practice. **C is wrong and actively dangerous.**',
        '`ARG` values are recorded in the image history. Anyone with the image can run `docker history` and read them. The same is true of any secret written into a layer, even if a later layer deletes the file - the bytes remain in the earlier layer.',
        'The correct way to use a secret during a build is BuildKit secret mounts: `RUN --mount=type=secret,id=npmtoken ...`. The secret is mounted into that one instruction only and is never written to any layer.',
        'For secrets at **runtime**, inject them as environment variables from a secret store, or mount them as files. Never bake them into the image.',
      ],
      code: [
        {
          title: 'Leaking a secret, and not leaking it',
          language: 'dockerfile',
          explanation:
            'The first version puts the token in the image history permanently. The second never writes it to a layer at all.',
          code: `# LEAKS - visible via docker history, forever
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > .npmrc \\
 && npm ci \\
 && rm .npmrc
# The rm does NOT help: .npmrc is still in the earlier layer.

# SAFE - BuildKit secret mount, never written to a layer
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmtoken \\
    NPM_TOKEN="$(cat /run/secrets/npmtoken)" \\
    npm ci

# Build with:
#   docker build --secret id=npmtoken,env=NPM_TOKEN .

# Verify nothing leaked:
#   docker history --no-trunc myimage | grep -i token`,
        },
        {
          title: 'A hardened runtime',
          language: 'dockerfile',
          code: `FROM node:20-alpine

# Pin, do not use :latest. A digest is strongest:
# FROM node:20-alpine@sha256:abc123...

WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .

# Non-root. The node image ships this user already.
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \\
  CMD node healthcheck.js

CMD ["node", "server.js"]

# Run it with:
#   docker run --read-only --tmpfs /tmp \\
#     --cap-drop=ALL --security-opt=no-new-privileges myapp`,
        },
      ],
      traps: [
        'Thinking `ARG` is a safe way to pass secrets. It is the single most common container security mistake.',
        'Thinking `rm` in a later layer removes a secret. It does not.',
        'Using `:latest`, which makes builds non-reproducible and silently changes your base under you.',
      ],
      followUps: [
        'How do you pass a private registry token to a build safely?',
        'Why is running as root inside a container a problem?',
        'How would you check an existing image for leaked secrets?',
      ],
      tags: ['security', 'secrets', 'buildkit', 'hardening'],
    },
    {
      id: 'itv-docker-17',
      level: 'advanced',
      kind: 'open',
      prompt:
        'Walk me through what happens between `docker run nginx` and the container actually running.',
      probing:
        'Senior-level architecture. They want to hear that the Docker CLI is a thin client and that containerd and runc do the real work.',
      answer: [
        'The `docker` CLI does almost nothing itself - it sends a REST request over a Unix socket to the **Docker daemon** (`dockerd`).',
        'The daemon checks whether the image is present locally. If not, it contacts the **registry**, authenticates, pulls the manifest, then pulls each layer that is not already on disk, verifying digests as it goes. Layers already present from another image are reused.',
        'The daemon then asks **containerd** - the container runtime - to create the container. containerd prepares the filesystem by stacking the read-only image layers with a writable layer on top using a snapshotter such as overlayfs.',
        'containerd then invokes **runc**, which is the piece that actually talks to the kernel: it creates the namespaces, applies the cgroup limits, sets up the root filesystem, and finally `exec`s your process as PID 1 inside them. runc exits immediately afterwards; a small `containerd-shim` process stays behind to own the container, which is why containers keep running even if the Docker daemon restarts.',
      ],
      deeper: [
        'This layering is the result of standardisation: the **OCI** specifications define the image format and the runtime interface, which is why Kubernetes can drop Docker entirely and talk to containerd directly via CRI. That is exactly what the "Kubernetes deprecates Docker" news was about - the images were never the issue, only the redundant daemon in the path.',
        'The shim also explains `--live-restore`: because the shim owns the container rather than the daemon, `dockerd` can be upgraded without stopping workloads.',
      ],
      diagrams: [
        {
          kind: 'sequence',
          title: 'From CLI to a running process',
          caption:
            'The CLI is a thin HTTP client. runc is the only part that talks to the kernel, and it exits straight away.',
          participants: [
            { id: 'cli', label: 'docker CLI' },
            { id: 'daemon', label: 'dockerd' },
            { id: 'ctr', label: 'containerd' },
            { id: 'runc', label: 'runc + kernel' },
          ],
          messages: [
            { from: 'cli', to: 'daemon', label: 'POST /containers/create' },
            { from: 'daemon', to: 'daemon', label: 'image present? else pull from registry' },
            { from: 'daemon', to: 'ctr', label: 'create container' },
            { from: 'ctr', to: 'ctr', label: 'stack layers, add writable layer' },
            { from: 'ctr', to: 'runc', label: 'create and start' },
            { from: 'runc', to: 'runc', label: 'namespaces, cgroups, pivot_root, exec' },
            { from: 'runc', to: 'ctr', label: 'started; shim owns it now', kind: 'return' },
            { from: 'daemon', to: 'cli', label: 'container id', kind: 'return' },
          ],
        },
      ],
      traps: [
        'Saying "Docker starts the container". Docker orchestrates; containerd and runc do the work.',
        'Thinking Kubernetes removing Docker meant Docker images stopped working. Images are an OCI standard and were never affected.',
      ],
      followUps: [
        'What is the OCI, and why does it matter here?',
        'What actually changed when Kubernetes deprecated dockershim?',
        'Why do containers survive a Docker daemon restart?',
      ],
      tags: ['internals', 'architecture', 'containerd', 'oci'],
    },
    {
      id: 'itv-docker-18',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'Your CI pipeline builds the same image ten times a day and every build takes eight minutes with no cache hits. How would you fix it?',
      probing:
        'Practical CI knowledge. The naive answer is "order the Dockerfile better", which is necessary but not sufficient on ephemeral runners.',
      answer: [
        'First I would separate two different problems: is the Dockerfile ordered badly, or is there simply **no cache to hit**?',
        'On most CI systems every job gets a fresh machine, so the local layer cache is empty every time. Reordering instructions helps nothing if there is no cache at all - so I would check the runner setup before touching the Dockerfile.',
        'The fix for a cold cache is to store the cache somewhere shared. With BuildKit that is `--cache-from` and `--cache-to` pointing at a registry, so layers pushed by yesterday’s build are pulled by today’s. Most CI providers also offer a cache mount or a persistent Docker layer cache.',
        'Alongside that I would fix the ordering - manifests copied and dependencies installed before the source `COPY` - and add a `.dockerignore`, because without one every change to `.git` invalidates `COPY . .`.',
        'Finally, package-manager caches: `RUN --mount=type=cache,target=/root/.npm npm ci` keeps the download cache across builds even when the layer itself is rebuilt.',
      ],
      deeper: [
        'It is worth checking whether the build needs to happen ten times a day at all. If the same commit is built by several jobs, building once and passing the digest between jobs removes the work rather than speeding it up.',
        '`--cache-from` needs the cache image to be pulled, which costs time too. On a fast network it is a clear win; on a slow one, measure - sometimes an inline cache (`--build-arg BUILDKIT_INLINE_CACHE=1`) is the better trade.',
      ],
      code: [
        {
          title: 'A registry-backed cache in CI',
          language: 'bash',
          explanation:
            'The `mode=max` cache exports intermediate layers too, not just the final ones, which is what makes a multi-stage build cache properly.',
          code: `export DOCKER_BUILDKIT=1

docker buildx build \\
  --cache-from type=registry,ref=registry.example.com/myapp:buildcache \\
  --cache-to   type=registry,ref=registry.example.com/myapp:buildcache,mode=max \\
  --tag registry.example.com/myapp:"$GIT_SHA" \\
  --push .`,
        },
        {
          title: 'BuildKit cache mounts, which survive a layer rebuild',
          language: 'dockerfile',
          code: `# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
# The npm download cache persists between builds even when this
# layer itself is rebuilt, so a changed lockfile no longer means
# re-downloading every package.
RUN --mount=type=cache,target=/root/.npm \\
    npm ci

COPY . .
RUN npm run build
CMD ["node", "dist/server.js"]`,
        },
        {
          title: '.dockerignore - small file, large effect',
          language: 'text',
          code: `.git
node_modules
dist
coverage
*.log
.env
.env.*
**/__pycache__
.venv
Dockerfile
docker-compose*.yml
README.md`,
        },
      ],
      traps: [
        'Reordering the Dockerfile and declaring victory without checking whether the runner has any cache at all.',
        'Caching `node_modules` as a directory rather than caching the package manager’s download cache - the first goes stale and causes very confusing bugs.',
      ],
      followUps: [
        'How would you measure whether the cache is actually hitting?',
        'What is the risk of a shared build cache across branches?',
      ],
      tags: ['scenario', 'ci', 'buildkit', 'cache', 'performance'],
    },
  ],
}
