import type { InterviewQuestion } from '../../../types'

/** Images, Dockerfiles, layers and the build - the bulk of a Docker round. */
export const dockerImageQuestions: InterviewQuestion[] = [
  {
    id: 'itv-docker-19',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a Docker image made of, and what does "layer" actually mean?',
    probing:
      'Whether you picture an image as one opaque blob or as a stack you can reason about. Everything about caching and size follows from the answer.',
    answer: [
      'An image is a **stack of read-only layers** plus a small JSON **manifest** and **config** that describe them. Each layer is a tar archive of filesystem changes - the files added, changed or deleted by one build step.',
      'When you run the image, Docker stacks those layers with a **union filesystem** so they look like one directory tree, then adds a thin **writable layer** on top for the container. Anything the container writes goes in that top layer and disappears when the container is removed.',
      'Layers are identified by a **digest** of their content, which is why two images built `FROM` the same base share those base layers on disk and over the network - you only pull what you do not already have.',
    ],
    code: [
      {
        title: 'Look at the layers of an image',
        language: 'bash',
        code: `# The build steps that produced each layer, newest first
docker history nginx:1.27-alpine

# The layer digests, in order, from the image config
docker image inspect nginx:1.27-alpine --format '{{json .RootFS.Layers}}'`,
        explanation:
          'docker history is the fastest way to see which instruction made an image fat.',
      },
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'How a running container is assembled',
        caption:
          'Only the top layer is writable. Remove the container and that layer goes with it; the image layers below are untouched and shared.',
        root: {
          label: 'Container view of the filesystem',
          children: [
            {
              label: 'Writable container layer',
              detail: 'Everything the process writes at runtime',
              tone: 'warning',
            },
            { label: 'Layer 3: COPY app/', detail: 'Your code', tone: 'accent' },
            { label: 'Layer 2: RUN pip install', detail: 'Dependencies', tone: 'accent' },
            { label: 'Layer 1: base image', detail: 'python:3.12-slim, shared', tone: 'muted' },
          ],
        },
      },
    ],
    traps: [
      'Saying an image "contains an OS". It contains a userland - the libraries and binaries of a distribution - but never a kernel.',
      'Thinking deleting a file in a later layer makes the image smaller. The file is still in the earlier layer; only the union view hides it.',
    ],
    followUps: [
      'Why does deleting a file in a later RUN not shrink the image?',
      'What is the difference between an image digest and a tag?',
    ],
    tags: ['images', 'layers', 'storage', 'fundamentals'],
  },
  {
    id: 'itv-docker-20',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between `docker run` and `docker start`?',
    probing:
      'Basic command fluency. People who have only copied commands from a README get this wrong.',
    options: [
      { id: 'a', text: 'They are aliases for the same thing' },
      {
        id: 'b',
        text: '`docker run` creates a new container from an image; `docker start` restarts an existing stopped container',
      },
      { id: 'c', text: '`docker run` is for foreground and `docker start` is for background' },
      { id: 'd', text: '`docker start` pulls the image first, `docker run` does not' },
    ],
    correct: ['b'],
    answer: [
      '`docker run` takes an **image** and creates a **brand new container** from it, then starts it. `docker start` takes an **existing container** that has been stopped and runs it again, with all the settings it was originally created with.',
      'This matters in practice: if you `docker run` the same image five times you now have five containers, each with its own writable layer. Any data written into the first one is not in the others. People who repeatedly `docker run` instead of `docker start` quietly fill their disk with stopped containers.',
      'You cannot change ports, volumes or environment variables with `docker start` - those are fixed at create time. To change them you must remove the container and `docker run` again, which is exactly why configuration belongs in environment variables and data belongs on volumes.',
    ],
    traps: [
      'Assuming `-d` is the difference. Both foreground and background are controlled by `-d` on `run`.',
      'Trying to add a port mapping to an existing container. There is no supported way; you recreate it.',
    ],
    tags: ['cli', 'lifecycle', 'fundamentals'],
  },
  {
    id: 'itv-docker-21',
    level: 'basic',
    kind: 'open',
    prompt:
      'What is the difference between `COPY` and `ADD` in a Dockerfile, and which should you use?',
    probing: 'Whether you follow the convention or just use whichever you saw first.',
    answer: [
      '`COPY` does exactly one thing: copy files and directories from the build context into the image. `ADD` does that too, but it also **auto-extracts local tar archives** and can **download a URL**.',
      'The guidance is to **use `COPY` unless you specifically need one of those two extras**. The reason is predictability: `ADD some.tar.gz /app` silently unpacks, which surprises the next reader, and `ADD https://...` downloads at build time with no checksum, no caching control and no way to see what changed.',
      'If you need to fetch something remote, use `RUN curl` with a checksum verification instead - then the failure is loud and the artefact is pinned.',
    ],
    code: [
      {
        title: 'COPY, and the safe way to fetch something remote',
        language: 'dockerfile',
        code: `# Prefer COPY - it does one obvious thing
COPY requirements.txt /app/
COPY src/ /app/src/

# If you need a remote file, fetch it explicitly and verify it
RUN curl -fsSL -o /tmp/tool.tar.gz https://example.com/tool-1.4.2.tar.gz \\
 && echo "abc123...  /tmp/tool.tar.gz" | sha256sum -c - \\
 && tar -xzf /tmp/tool.tar.gz -C /usr/local/bin \\
 && rm /tmp/tool.tar.gz`,
        explanation: 'The checksum turns a silent supply-chain swap into a failed build.',
      },
    ],
    traps: [
      'Using `ADD` for a plain file copy. It works, but reviewers read it as "something is being extracted here".',
      'Forgetting that `COPY` invalidates the cache for every later layer when the copied files change.',
    ],
    followUps: [
      'How does `COPY --from` work in a multi-stage build?',
      'What is `COPY --chown` for, and why does it matter for a non-root image?',
    ],
    tags: ['dockerfile', 'copy', 'add', 'fundamentals'],
  },
  {
    id: 'itv-docker-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain multi-stage builds. What problem do they solve?',
    probing:
      'One of the highest-signal Docker questions. It separates people who ship images from people who only run them.',
    answer: [
      'A multi-stage build puts **several `FROM` instructions in one Dockerfile**. Each `FROM` starts a new stage with its own filesystem. A later stage can copy artefacts out of an earlier one with `COPY --from=<stage>`, and **everything else in that earlier stage is thrown away**.',
      'The problem it solves is that the tools you need to *build* software are not the tools you need to *run* it. A Go build needs the compiler; running the binary needs nothing. A Node build needs devDependencies and a bundler; serving the output needs a web server. Without multi-stage you ship all of it.',
      'The win is both **size and security**. A 1.2 GB build image becomes a 15 MB runtime image, and an attacker who gets into the container finds no compiler, no package manager and no source code to work with. Fewer binaries also means fewer CVEs for your scanner to report.',
    ],
    code: [
      {
        title: 'A typical two-stage Node build',
        language: 'dockerfile',
        code: `# ---- build stage: has everything, ships nothing ----
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                      # includes devDependencies
COPY . .
RUN npm run build               # produces /app/dist

# ---- runtime stage: only the built output ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80`,
        explanation:
          'Only /app/dist crosses the boundary. node_modules, the source and npm itself are discarded.',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What survives a multi-stage build',
        caption: 'Everything in the build stage is discarded except the files you explicitly copy.',
        nodes: [
          { label: 'Stage: build', detail: 'Compiler, dev deps, source - 1.2 GB', tone: 'muted' },
          { label: 'COPY --from=build /app/dist', arrowLabel: 'only this crosses', tone: 'accent' },
          { label: 'Stage: runtime', detail: 'Web server + static files - 15 MB', tone: 'success' },
          { label: 'Final image', detail: 'Only the last stage is tagged', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'You can stop at an intermediate stage with `docker build --target build`, which is how you get a test image and a runtime image from one Dockerfile.',
      'Stages build in parallel under BuildKit when they do not depend on each other, so extra stages are often free in wall-clock time.',
      'A stage can be `FROM scratch` - literally nothing - which is viable for a static Go or Rust binary. You then have to add CA certificates and timezone data yourself if you need them.',
    ],
    traps: [
      'Copying `node_modules` from the build stage as well, which undoes the entire benefit.',
      'Forgetting that only the **last** stage is tagged, so putting the runtime stage in the middle produces a surprising image.',
      'Assuming a smaller image is automatically more secure. It is a smaller attack surface, not an audited one.',
    ],
    followUps: [
      'How would you produce both a test image and a production image from one Dockerfile?',
      'When would `distroless` be a better final stage than `alpine`?',
    ],
    tags: ['dockerfile', 'multi-stage', 'image size', 'security'],
  },
  {
    id: 'itv-docker-23',
    level: 'intermediate',
    kind: 'multi',
    prompt:
      'Which of these genuinely reduce the final size of a Docker image? Select all that apply.',
    probing:
      'Whether you understand that layers are additive. Half the "optimisations" people repeat do nothing at all.',
    options: [
      { id: 'a', text: 'Using a multi-stage build and copying only the built artefact' },
      {
        id: 'b',
        text: 'Adding `RUN rm -rf /var/lib/apt/lists/*` as its own separate instruction after the install',
      },
      {
        id: 'c',
        text: 'Combining `apt-get update`, `install` and the cleanup into a single `RUN`',
      },
      { id: 'd', text: 'Choosing a smaller base image such as `-slim` or `alpine`' },
      {
        id: 'e',
        text: 'A well-written `.dockerignore` that keeps `.git` and `node_modules` out of the build context',
      },
    ],
    correct: ['a', 'c', 'd', 'e'],
    answer: [
      'The one that does **not** work is deleting files in a **separate later** `RUN`. Layers are additive: the files were already written into the earlier layer, and a later layer can only record a deletion marker. The bytes are still in the image and still get pulled.',
      'That is why the cleanup has to happen **in the same `RUN`** as the install - the layer is only snapshotted when the instruction finishes, so files created and deleted within one instruction never reach the image at all.',
      'The others all genuinely help: a multi-stage build discards an entire filesystem, a smaller base starts you lower, and `.dockerignore` stops large directories being sent to the builder in the first place (which also speeds up every build).',
    ],
    code: [
      {
        title: 'Wrong and right, side by side',
        language: 'dockerfile',
        code: `# WRONG - the apt lists are already baked into layer 1
RUN apt-get update && apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# RIGHT - created and removed inside one instruction
RUN apt-get update \\
 && apt-get install -y --no-install-recommends curl \\
 && rm -rf /var/lib/apt/lists/*`,
        explanation:
          '--no-install-recommends is worth knowing too; it often halves what apt drags in.',
      },
    ],
    traps: [
      'Believing `docker image prune` shrinks an image. It removes unused images from the host, not bytes from an image.',
      'Squashing layers to hide a secret. The secret is still in the build history and often in the registry.',
    ],
    tags: ['image size', 'layers', 'dockerfile', 'optimisation'],
  },
  {
    id: 'itv-docker-24',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does the Docker build cache decide whether to reuse a layer?',
    probing:
      'The single most useful thing to understand for fast CI. It explains why instruction order matters so much.',
    answer: [
      'Docker walks the Dockerfile top to bottom. For each instruction it computes a **cache key** and looks for an existing layer with that key. For most instructions the key is the **instruction text itself** plus the parent layer. For `COPY` and `ADD` it also includes a **checksum of the files being copied**.',
      'The critical rule is that **a cache miss invalidates everything below it**. Once one instruction has to be rebuilt, every later layer is rebuilt too, because its parent has changed.',
      'That is the whole reason for the standard ordering: copy your dependency manifest and install dependencies **first**, then copy your source code. Your source changes on every commit; your dependencies change once a month. Put them the other way round and every single build reinstalls everything.',
    ],
    code: [
      {
        title: 'Ordering that keeps the cache hot',
        language: 'dockerfile',
        code: `FROM python:3.12-slim
WORKDIR /app

# Changes rarely -> stays cached across almost every build
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Changes every commit -> only this and below rebuild
COPY . .
CMD ["python", "-m", "app"]`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Will this layer come from cache?',
        caption: 'One miss invalidates every layer beneath it, which is why ordering matters.',
        question: 'Docker is evaluating an instruction',
        branches: [
          {
            condition: 'A parent layer was already rebuilt',
            result: 'Miss - rebuild',
            detail: 'Nothing below a miss can be reused',
            tone: 'danger',
          },
          {
            condition: 'COPY/ADD and the file checksums changed',
            result: 'Miss - rebuild',
            detail: 'Content is part of the cache key',
            tone: 'warning',
          },
          {
            condition: 'Instruction text and parent both unchanged',
            result: 'Hit - reuse the layer',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      '`RUN apt-get update` is cached by its text alone, so a build from a week-old cache can install stale packages. Pairing update and install in one `RUN` avoids the classic stale-index bug.',
      'BuildKit adds `RUN --mount=type=cache`, which keeps a package manager cache directory outside the layer - so you get fast installs without the cache ending up in the image.',
      'In CI there is often no cache at all because the runner is fresh. `--cache-from` against a registry image, or a persistent BuildKit cache, is what actually makes CI builds fast.',
    ],
    traps: [
      'Reordering the Dockerfile in CI and seeing no improvement - because the runner had no cache to begin with.',
      '`COPY . .` near the top, which makes every commit a full rebuild no matter what else you do.',
    ],
    followUps: [
      'How do you get build cache on an ephemeral CI runner?',
      'Why can `RUN apt-get update` on its own line cause a hard-to-reproduce bug?',
    ],
    tags: ['build cache', 'dockerfile', 'ci', 'performance'],
  },
  {
    id: 'itv-docker-25',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What does `.dockerignore` do, and why does it affect build speed as well as image size?',
    probing: 'Whether you know that the build context is uploaded before the build even starts.',
    answer: [
      'Before a build begins, the Docker CLI packages the **build context** - the directory you pointed at - and sends it to the daemon or BuildKit. `.dockerignore` lists patterns to exclude from that package, using the same syntax as `.gitignore`.',
      'It affects **speed** because that transfer happens first, every time. A repository with a 500 MB `.git` directory and a `node_modules` tree sends all of it over a socket before a single instruction runs. Excluding them can turn a 40-second build into a 4-second one.',
      'It affects **size and security** because anything in the context can be picked up by a broad `COPY . .` - including `.env` files, private keys, `.git` history and local build output. Excluding them is the simplest way to stop a secret being baked into a published image.',
    ],
    code: [
      {
        title: 'A .dockerignore worth copying',
        language: 'text',
        code: `.git
.gitignore
node_modules
dist
build
*.log
.env
.env.*
**/__pycache__
.venv
.pytest_cache
coverage
Dockerfile
docker-compose*.yml
.github
README.md`,
        explanation:
          'Excluding the Dockerfile itself is fine - the builder is given it separately.',
      },
    ],
    traps: [
      'Assuming `.gitignore` is used. It is not; the two files are entirely separate.',
      'Excluding a file but still referencing it in a `COPY`, which fails with a confusing "file not found".',
    ],
    followUps: ['How would you check what is actually in your build context?'],
    tags: ['dockerignore', 'build context', 'performance', 'security'],
  },
  {
    id: 'itv-docker-26',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'A Dockerfile ends with `CMD ["npm", "start"]`. Someone runs `docker run myimage bash`. What happens?',
    probing:
      'Whether you understand that CMD is a default, not a guarantee. This trips up a lot of people.',
    options: [
      { id: 'a', text: 'It runs `npm start` and ignores the `bash` argument' },
      {
        id: 'b',
        text: 'It runs `bash` instead of `npm start` - the argument replaces `CMD` entirely',
      },
      { id: 'c', text: 'It runs `npm start bash`, appending the argument' },
      { id: 'd', text: 'It fails, because you cannot override `CMD`' },
    ],
    correct: ['b'],
    answer: [
      'Anything you put after the image name on `docker run` **replaces `CMD` completely**. So the container runs `bash` and `npm start` never executes. That is the whole point of `CMD` - it is a *default* for when the user supplies nothing.',
      'If the Dockerfile had an `ENTRYPOINT` instead, the behaviour would be different: the arguments would be **appended to** the entrypoint rather than replacing it. `ENTRYPOINT ["npm"]` with `docker run myimage start` would run `npm start`.',
      'This is exactly why debugging with `docker run -it myimage bash` works on most images - and why it mysteriously fails on images with an `ENTRYPOINT`, where you need `--entrypoint bash` instead.',
    ],
    code: [
      {
        title: 'The four combinations, made concrete',
        language: 'bash',
        code: `# CMD ["npm","start"]
docker run img              # -> npm start
docker run img bash         # -> bash          (CMD replaced)

# ENTRYPOINT ["npm"]  CMD ["start"]
docker run img              # -> npm start
docker run img test         # -> npm test      (CMD replaced, entrypoint kept)
docker run --entrypoint bash img   # -> bash   (entrypoint overridden)`,
      },
    ],
    traps: [
      'Using shell form `CMD npm start`, which wraps the process in `/bin/sh -c` so it becomes PID 1 and swallows signals.',
      'Putting two `CMD` instructions in a Dockerfile. Only the last one counts; the first is silently ignored.',
    ],
    followUps: [
      'Why does shell form break graceful shutdown?',
      'When would you use ENTRYPOINT and CMD together?',
    ],
    tags: ['cmd', 'entrypoint', 'dockerfile', 'fundamentals'],
  },
  {
    id: 'itv-docker-27',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you handle build-time secrets without baking them into the image?',
    probing:
      'A real security question. The wrong answers are extremely common and all leak the secret.',
    answer: [
      'The rule is that **anything written into a layer is permanent and public**. An `ARG` passed at build time, a `COPY` of a key file, even a `RUN` that curls with a token - all of them are recoverable from the image with `docker history` or by unpacking the layers, even if a later instruction deletes the file.',
      'The correct mechanism is **BuildKit secret mounts**: `RUN --mount=type=secret,id=npmtoken`. The secret is mounted into a tmpfs for the duration of that one instruction and is **never written to a layer**. You pass it in with `docker build --secret id=npmtoken,src=./token`.',
      'For SSH access to a private repository there is an equivalent, `--mount=type=ssh`, which forwards your SSH agent socket into the build without copying a key.',
      'The alternative pattern is to keep secrets out of the build entirely: fetch private dependencies in a separate stage that never reaches the final image, or better, do the authenticated fetch in CI before the build and pass the resulting artefact in as a normal file.',
    ],
    code: [
      {
        title: 'BuildKit secret mount',
        language: 'dockerfile',
        code: `# syntax=docker/dockerfile:1

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./

# The token exists only at /run/secrets/npmtoken, only during this RUN,
# and never lands in a layer.
RUN --mount=type=secret,id=npmtoken \\
    NPM_TOKEN=$(cat /run/secrets/npmtoken) \\
    npm ci --registry=https://registry.example.com

COPY . .`,
      },
      {
        title: 'Building with it, and proving nothing leaked',
        language: 'bash',
        code: `DOCKER_BUILDKIT=1 docker build \\
  --secret id=npmtoken,src=./.npmtoken \\
  -t app:1.0 .

# Prove it: neither the history nor the layers contain the token
docker history --no-trunc app:1.0 | grep -i npmtoken || echo "not in history"
docker save app:1.0 | tar -xO | grep -c "npm_" || echo "not in layers"`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Where should this secret come from?',
        caption: 'If it is needed at run time it is not a build secret at all.',
        question: 'A build step needs a credential',
        branches: [
          {
            condition: 'Needed only during one build step',
            result: 'BuildKit secret mount',
            detail: 'tmpfs, never in a layer',
            tone: 'success',
          },
          {
            condition: 'Needed to clone a private repository',
            result: 'SSH agent forwarding mount',
            detail: 'No key file is copied',
            tone: 'success',
          },
          {
            condition: 'Needed when the container runs',
            result: 'Runtime env var or mounted secret',
            detail: 'Never a build concern',
            tone: 'accent',
          },
          {
            condition: 'Passed with ARG or COPY',
            result: 'Leaked - treat as compromised',
            detail: 'Recoverable from the image',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'If a secret has already been built into a published image, rotating it is the only real fix. Rebuilding without it does not help - the old image is still in the registry and in everyone’s local cache.',
      '`ARG` values appear in `docker history` in plain text. This is the single most common way tokens leak from CI.',
      'Image scanning in CI should include secret detection, not just CVEs, so this is caught before publish rather than after.',
    ],
    traps: [
      'Using `ARG TOKEN` and thinking it disappears because it is not `ENV`. It is in the build history.',
      'Deleting the key file in a later `RUN`. The earlier layer still has it.',
      'Using `--squash` to hide it. The registry may still hold the unsquashed layers, and the secret is still compromised.',
    ],
    followUps: [
      'A token was leaked in an image published six months ago. What do you do?',
      'How would you stop this happening again in CI?',
    ],
    tags: ['security', 'secrets', 'buildkit', 'ci'],
  },
  {
    id: 'itv-docker-28',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is a distroless image, and when would you choose it over Alpine?',
    probing:
      'Whether you can reason about the trade-off between debuggability and attack surface rather than repeating "smaller is better".',
    answer: [
      'A **distroless** image contains your application and its runtime dependencies and **nothing else** - no shell, no package manager, no `ls`, no `cat`. Google publishes the best-known set. Alpine is a real, minimal Linux distribution: small, but it still has `busybox`, `apk` and a shell.',
      'Distroless wins on **attack surface**. An attacker who achieves remote code execution in an Alpine container has a shell and a package manager to pull tools with. In a distroless container there is no shell to spawn at all, which stops a large class of exploitation in its tracks.',
      'Alpine wins on **debuggability and compatibility**. You can `exec` into it when something breaks. And critically, Alpine uses **musl** rather than **glibc**, which causes real and often subtle problems: DNS resolution differences, slower or broken performance in some Python and Node native modules, and binaries compiled against glibc simply not running.',
      'The practical answer is: distroless for production services where you have good observability and do not need to exec in; Alpine or a `-slim` Debian variant where compatibility or debuggability matters more. On Kubernetes, ephemeral debug containers remove much of the distroless downside, because you can attach a container with tooling to a running pod without the image carrying it.',
    ],
    code: [
      {
        title: 'Distroless final stage for a Go binary',
        language: 'dockerfile',
        code: `FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

# No shell, no package manager, non-root by default
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]`,
        explanation:
          'CGO_ENABLED=0 produces a static binary, which is what lets the final image be this empty.',
      },
    ],
    deeper: [
      'The musl/glibc difference is the real Alpine trap. A Python image on Alpine often ends up *larger* and slower than `python:3.12-slim`, because wheels have to be compiled from source rather than downloaded.',
      'Distroless images ship a `:debug` variant with busybox, which you can swap in temporarily to investigate an incident.',
      'Neither choice is a substitute for running as non-root, dropping capabilities and using a read-only root filesystem.',
    ],
    traps: [
      'Choosing Alpine purely for size without measuring. For Python and Node it frequently backfires.',
      'Assuming distroless means no CVEs. It means fewer packages to have CVEs; your own dependencies are unaffected.',
    ],
    followUps: [
      'How would you debug a distroless container in production?',
      'Why can Alpine make a Python image bigger rather than smaller?',
    ],
    tags: ['base images', 'distroless', 'alpine', 'security', 'image size'],
  },
  {
    id: 'itv-docker-29',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you build an image that runs on both amd64 and arm64?',
    probing:
      'Increasingly common since Apple Silicon and Graviton. Tests whether you know about manifest lists.',
    answer: [
      'You build a **multi-platform image**, which is really a **manifest list**: a small index in the registry that maps each platform to a different image digest. When a machine pulls the tag, the registry hands it the entry matching its own architecture. The tag looks like one image but is several.',
      'The tool is `docker buildx`. With `--platform linux/amd64,linux/arm64` it builds both variants and pushes them under one tag. Building the non-native architecture happens either through **QEMU emulation** (simple, but slow - often 5 to 10 times slower) or on **native runners of each architecture** (fast, more setup).',
      'The thing to get right in the Dockerfile is to stop hardcoding architecture. BuildKit provides `TARGETARCH`, `TARGETOS` and `TARGETPLATFORM` automatically, so a download URL or a Go build flag can be parameterised rather than fixed to amd64.',
    ],
    code: [
      {
        title: 'Building and pushing for two architectures',
        language: 'bash',
        code: `# One-time: a builder that can do multi-platform
docker buildx create --name multi --use --bootstrap

# Build both and push as a single tag
docker buildx build \\
  --platform linux/amd64,linux/arm64 \\
  -t registry.example.com/app:1.4.0 \\
  --push .

# Confirm the manifest list really has both
docker buildx imagetools inspect registry.example.com/app:1.4.0`,
        explanation:
          'Multi-platform builds must be pushed, not loaded - a local image store holds one platform.',
      },
      {
        title: 'Using the build platform args',
        language: 'dockerfile',
        code: `FROM --platform=$BUILDPLATFORM golang:1.23 AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY . .
# Cross-compile on the native builder instead of emulating it
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/server .

FROM alpine:3.20
COPY --from=build /out/server /server
ENTRYPOINT ["/server"]`,
        explanation:
          'Pinning the build stage to BUILDPLATFORM and cross-compiling avoids QEMU entirely - often a 10x speedup.',
      },
    ],
    deeper: [
      'Cross-compiling beats emulation whenever the language supports it. For Go and Rust this is nearly free; for a C extension it may not be possible.',
      'Base images must themselves be multi-platform. Most official images are, but a random community image often is not, and the build fails only for the missing architecture.',
      'In CI, splitting the two architectures across native runners and merging with `buildx imagetools create` gives the best of both: native speed, one tag.',
    ],
    traps: [
      'Using `docker buildx build --load` with two platforms. The local store cannot hold a manifest list; you must `--push`.',
      'Hardcoding an amd64 binary URL in a `RUN curl`, so the arm64 image builds successfully and then crashes with "exec format error".',
    ],
    followUps: [
      'Why is "exec format error" the classic symptom of getting this wrong?',
      'How would you speed up a multi-platform build in CI?',
    ],
    tags: ['buildx', 'multi-platform', 'arm64', 'ci'],
  },
  {
    id: 'itv-docker-30',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Your production image is 1.8 GB and pulls take four minutes on every deploy, which is slowing rollouts badly. Walk me through how you would reduce it.',
    probing:
      'Whether you measure before optimising, and whether you know which changes actually move the number.',
    answer: [
      'First **measure, do not guess**. `docker history --no-trunc` shows the size of every layer and the instruction that created it. Usually one or two layers are most of the image, and the fix is obvious once you can see them. `dive` is worth using here - it shows wasted space from files added then deleted in later layers.',
      'Then work through the usual culprits in order of payoff. **Base image**: is this `ubuntu` where `python:3.12-slim` or a distroless would do? That alone is often 700 MB. **Build tooling in the runtime image**: compilers, `build-essential`, dev dependencies - move them into a build stage with multi-stage. **Package manager caches**: `apt` lists, `pip` cache, `npm` cache, cleaned in the same `RUN` that created them. **Build context**: a `.dockerignore` that excludes `.git`, `node_modules` and local artefacts.',
      'Then confirm the change did what you expected and lock it in: rebuild, compare `docker images`, and add a **size check to CI** so the image cannot silently grow back. A simple job that fails when the image exceeds an agreed budget is enough.',
      'Finally, remember that pull time is not only size. Layers that **change every build** are re-pulled every deploy even when the total is small - so putting your 5 MB application layer last and keeping the 400 MB base stable means nodes reuse the base and pull only 5 MB. Sharing a common base across services multiplies that benefit.',
    ],
    code: [
      {
        title: 'Find where the bytes are',
        language: 'bash',
        code: `# Biggest layers first, with the instruction that made each one
docker history --no-trunc --format '{{.Size}}\\t{{.CreatedBy}}' app:1.8gb \\
  | sort -hr | head -15

# Total, and a comparison after the change
docker images app --format '{{.Tag}}\\t{{.Size}}'`,
      },
      {
        title: 'A CI guard so it cannot grow back',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

LIMIT_MB=250
SIZE_MB=$(docker image inspect app:ci --format '{{.Size}}' | awk '{print int($1/1048576)}')

echo "image size: \${SIZE_MB} MB (budget \${LIMIT_MB} MB)"
if [ "$SIZE_MB" -gt "$LIMIT_MB" ]; then
  echo "FAIL: image exceeded its size budget" >&2
  exit 1
fi`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Shrinking an image, in payoff order',
        caption: 'Measure first. The first two steps usually account for most of the win.',
        nodes: [
          { label: 'Measure', detail: 'docker history, dive', tone: 'accent' },
          {
            label: 'Change the base',
            detail: 'ubuntu -> slim/distroless',
            arrowLabel: 'biggest single win',
          },
          { label: 'Multi-stage', detail: 'Drop compilers and dev deps' },
          { label: 'Clean in the same RUN', detail: 'apt lists, pip/npm cache' },
          { label: 'Fix .dockerignore', detail: 'Smaller context, faster builds' },
          {
            label: 'Order layers by churn',
            detail: 'Stable base, app layer last',
            tone: 'success',
          },
          { label: 'Guard in CI', detail: 'Fail the build over budget', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'On Kubernetes, `imagePullPolicy` and node-level image caching matter as much as size - a node that already has the base layers pulls only the top layer.',
      'Registry location matters too. Pulling cross-region can dominate the timing; a regional pull-through cache often beats any size optimisation.',
      'Track image size as a metric over time, the same way you would track build duration. It regresses quietly otherwise.',
    ],
    traps: [
      'Jumping straight to Alpine without measuring - for Python this often makes things worse, not better.',
      'Squashing layers, which helps size but destroys layer sharing, so total pull time across many services can get worse.',
      'Optimising the image while the real cost is a cross-region registry pull.',
    ],
    followUps: [
      'How would you stop the image growing again over the next six months?',
      'When would a smaller image not make deploys faster?',
    ],
    tags: ['scenario', 'image size', 'performance', 'ci', 'troubleshooting'],
  },
]
