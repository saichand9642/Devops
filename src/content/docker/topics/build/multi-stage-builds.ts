import type { Topic } from '../../../types'

export const multiStageBuilds: Topic = {
  id: 'dk-multi-stage-builds',
  title: 'Multi-stage builds and choosing a base image',
  domainId: 'dk-build',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 3,
  tags: ['multi-stage', 'base image', 'distroless', 'alpine', 'image size'],
  oneLiner:
    'Build with a full toolchain, ship only the artefact - and pick a base that is small for the right reasons.',
  explanation: [
    'A **multi-stage build** puts several `FROM` instructions in one Dockerfile. Each `FROM` starts a new stage with its own filesystem. A later stage can copy files out of an earlier one with `COPY --from=`, and everything else in that earlier stage is discarded.',
    'This solves a real tension. Building needs compilers, package managers, test frameworks and source code. Running needs none of them. Before multi-stage builds you either shipped all of it - a 1.2GB image full of build tools - or maintained two Dockerfiles and a fragile script between them.',
    'The result is usually dramatic: a Go service goes from around 900MB to about 15MB, a Node service from 1.1GB to 150MB. Less to push, less to pull, less to store, and far less in the image for an attacker to use.',
    '**Base image choice** is the other half. `node:22` ships a full Debian userland; `node:22-slim` trims it; `node:22-alpine` uses musl libc and BusyBox; **distroless** images contain your runtime and nothing else - no shell, no package manager. Smaller is generally better, but not unconditionally: Alpine’s musl can break native modules and has measurably different DNS behaviour, and a distroless image cannot be debugged with `docker exec` because there is no shell in it.',
  ],
  whyItMatters: [
    'Image size is pull time on every node, storage cost in every registry, and cold-start latency in every autoscaling event. It is one of the few optimisations that is nearly free.',
    'Build tools in a production image are attack surface. A compiler, `curl` and a package manager are exactly what an attacker wants after gaining execution.',
    'Multi-stage builds are also the correct place to keep build secrets: a token used in a builder stage never reaches the final image, because that whole stage is discarded.',
  ],
  howItWorks: [
    'Each `FROM` begins a new stage. Name them with `AS builder` so later stages can refer to them by name rather than by index.',
    '`COPY --from=builder /src/app /app` copies from a previous stage’s filesystem. Only what you copy survives.',
    'BuildKit builds the **stage graph**, not every stage. A stage nothing depends on is skipped entirely, and independent stages build in parallel.',
    '`--target` builds up to a named stage and stops, which is how one Dockerfile serves development, test and production images.',
    '`COPY --from` can also name an **external image**: `COPY --from=ghcr.io/acme/certs:1 /certs /certs` pulls files out of another image without a stage at all.',
    'The final stage decides the image. Its base, its `USER`, its `ENTRYPOINT` and its layers are what ship; earlier stages leave no trace.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'What survives a multi-stage build',
      caption:
        'Only the arrow crosses into the final image. Compilers, source and any build secret stay behind.',
      nodes: [
        {
          label: 'Stage 1: builder',
          detail: 'full toolchain, source, dev dependencies, build secrets',
          tone: 'accent',
        },
        {
          label: 'Compile or bundle',
          detail: 'produces one artefact - a binary, a dist directory, a jar',
          arrowLabel: 'RUN',
        },
        {
          label: 'Stage 2: runtime base',
          detail: 'minimal - distroless, alpine, or scratch for a static binary',
          arrowLabel: 'FROM',
          tone: 'success',
        },
        {
          label: 'COPY --from=builder',
          detail: 'the artefact crosses; nothing else does',
          arrowLabel: 'the only bridge',
          tone: 'success',
        },
        {
          label: 'Final image',
          detail: 'megabytes instead of gigabytes, and no build tooling to exploit',
          arrowLabel: 'result',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Which base image should the final stage use?',
      caption: 'Smaller is better until it costs you debuggability or compatibility you need.',
      question: 'What does the runtime actually require?',
      branches: [
        {
          condition: 'A statically linked binary, nothing else',
          result: 'scratch',
          detail: 'a few megabytes, no shell, no libc - the smallest possible',
          tone: 'success',
        },
        {
          condition: 'A runtime, but no shell needed in production',
          result: 'distroless',
          detail: 'runtime plus CA certificates, no package manager, no shell',
          tone: 'success',
        },
        {
          condition: 'Small, but you still want a shell to debug',
          result: 'alpine',
          detail: 'musl libc - verify native dependencies actually work',
          tone: 'accent',
        },
        {
          condition: 'Native modules or glibc-specific behaviour',
          result: 'slim Debian variant',
          detail: 'larger, but no musl surprises',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Build stage',
      purpose:
        'One FROM and everything until the next. Has its own filesystem; contributes to the final image only through COPY --from.',
      fields: [
        { path: 'FROM image AS name', meaning: 'Starts a stage and names it for later reference.' },
        { path: 'COPY --from=name src dest', meaning: 'Copies from a previous stage.' },
        {
          path: 'COPY --from=image src dest',
          meaning: 'Copies from an external image, no stage needed.',
        },
        { path: '--target=name', meaning: 'Build flag: stop at this stage rather than the last.' },
      ],
    },
    {
      kind: 'Base image family',
      purpose: 'The trade between size, compatibility and debuggability.',
      fields: [
        { path: 'scratch', meaning: 'Empty. Only for statically linked binaries.' },
        {
          path: 'distroless',
          meaning: 'Runtime and CA certs. No shell, so no docker exec debugging.',
        },
        {
          path: 'alpine',
          meaning: 'musl libc and BusyBox. Small, with real native-module caveats.',
        },
        { path: 'slim', meaning: 'Debian with the extras removed. glibc, so fewest surprises.' },
        {
          path: 'full',
          meaning: 'Everything. Appropriate for a builder stage, rarely for runtime.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Nine hundred megabytes of compiler',
    story: [
      'A Go service shipped as a 940MB image. The Dockerfile used `golang:1.23` for both building and running, so the final image carried the entire Go toolchain, the module cache and the source code - none of which the compiled binary needs.',
      'Rewriting it as two stages - build in `golang:1.23`, copy the static binary into `scratch` - produced a 14MB image. Pull time on a new node dropped from about forty seconds to under two, which mattered on every scale-out event.',
      'The security review noticed the second benefit before the size one: the old image contained a compiler, `git` and a package manager. Anyone achieving execution in that container had a full build environment. The new one contains a single binary and a CA bundle.',
    ],
  },
  yamlExamples: [
    {
      title: 'Go: toolchain in, binary out',
      language: 'dockerfile',
      explanation:
        'CGO disabled produces a static binary, which is what makes a scratch base possible at all.',
      code: `# ---- build stage ----
FROM golang:1.23-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
# Static binary: no dynamic linker needed in the final image
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/app ./cmd/server

# ---- runtime stage ----
FROM scratch
# Needed for outbound TLS - scratch has no CA bundle
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /out/app /app

USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/app"]`,
    },
    {
      title: 'Node: one Dockerfile for dev, test and production',
      language: 'dockerfile',
      explanation:
        'Build with --target=dev or --target=test locally; the default build produces the lean runtime image.',
      code: `# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS dev
COPY . .
CMD ["npm", "run", "dev"]

FROM deps AS test
COPY . .
RUN npm run lint && npm test

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: no source, no dev dependencies, no build tools ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]`,
    },
  ],
  imperative: [
    {
      command: 'docker build -t myapp:prod .',
      what: 'Builds every stage the final one depends on, and tags the last stage.',
    },
    {
      command: 'docker build --target dev -t myapp:dev .',
      what: 'Stops at the named stage, producing a development image from the same file.',
    },
    {
      command: 'docker images myapp',
      what: 'Compares the sizes of the images you produced.',
      expected: 'The runtime image should be a fraction of a single-stage build.',
    },
  ],
  declarative: {
    steps: [
      'Write a single-stage Dockerfile and record the image size.',
      'Split it into a builder stage and a minimal runtime stage.',
      'Copy only the built artefact across with COPY --from.',
      'Compare sizes, and confirm the build tooling is genuinely absent from the final image.',
    ],
    code: [
      {
        title: 'Proving the toolchain is gone',
        language: 'bash',
        explanation:
          'A failure here is the point: the final image should not contain a compiler or a package manager.',
        code: `docker build -t app:single -f Dockerfile.single .
docker build -t app:multi  -f Dockerfile.multi  .

docker images | grep app
# app  single  940MB
# app  multi    14MB

# The build tooling should not exist in the final image
docker run --rm app:multi go version   2>&1 || echo "no go toolchain - correct"
docker run --rm app:multi sh           2>&1 || echo "no shell - scratch base"

# And the application itself still works
docker run --rm -p 8080:8080 app:multi &
curl -s localhost:8080/healthz`,
      },
    ],
  },
  verification: [
    {
      command: 'docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"',
      what: 'Compares image sizes before and after.',
      expected: 'The multi-stage image is dramatically smaller.',
    },
    {
      command: 'docker image history <image>',
      what: 'Confirms the final image has only the layers you intended.',
      expected: 'A handful of layers, none of them a toolchain install.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker run --rm <image> ls /usr/bin | wc -l',
      what: 'A rough count of what is in the image. Fails entirely on scratch and distroless, which is itself informative.',
      placeholders: ['<image>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker run --rm <image> ldd /app',
      what: 'A "not found" for a shared library means the binary is dynamically linked and the base lacks it.',
      expected: 'For a scratch base you need "statically linked".',
      placeholders: ['<image>'],
    },
    {
      command: 'docker run --rm --entrypoint sh <image>',
      what: 'Fails on distroless and scratch, because there is no shell. Use a debug variant or ephemeral container instead.',
      placeholders: ['<image>'],
    },
    {
      command:
        'docker build --target builder -t debug:builder . && docker run --rm -it debug:builder sh',
      what: 'Gets a shell in the builder stage when the final image has none.',
    },
  ],
  commonMistakes: [
    'Copying the whole build stage across instead of just the artefact, which defeats the entire point.',
    'Using a `scratch` base with a dynamically linked binary. It will not start, and the error is unhelpful.',
    'Forgetting CA certificates on `scratch` or `distroless`, so every outbound HTTPS call fails with an unclear TLS error.',
    'Choosing Alpine for a Node or Python service with native modules without testing them. musl is not glibc.',
    'Assuming distroless can be debugged with `docker exec`. There is no shell - plan for ephemeral debug containers instead.',
  ],
  examTips: [
    'Each FROM starts a new stage; only `COPY --from` carries anything forward.',
    'Name stages with AS and build a specific one with `--target`.',
    'BuildKit skips stages nothing depends on and parallelises independent ones.',
    'A build secret used in a discarded stage never reaches the final image.',
    '`scratch` requires a static binary; distroless has a runtime but no shell.',
  ],
  summary: [
    'Multi-stage builds separate the toolchain from the artefact in one Dockerfile.',
    'Only what you `COPY --from` survives, which is both a size and a security win.',
    '`--target` lets one Dockerfile produce dev, test and production images.',
    'Base image choice trades size against compatibility and debuggability.',
    'scratch and distroless have no shell - decide how you will debug before you adopt them.',
  ],
  practice: [
    {
      id: 'dk-multi-stage-builds-p1',
      level: 'beginner',
      prompt: 'What ends up in the final image from a stage you never COPY --from?',
      answer:
        'Nothing. A stage contributes only through explicit COPY --from, and is otherwise discarded.',
      explanation:
        'This is why a build secret confined to a builder stage is genuinely safe, unlike one copied in and deleted later.',
    },
    {
      id: 'dk-multi-stage-builds-p2',
      level: 'intermediate',
      prompt:
        'Your Go binary works in the builder stage but exits immediately with "no such file or directory" on `scratch`, even though the file is there.',
      answer:
        'The binary is dynamically linked and the message is about the missing dynamic linker, not about your binary. Build with `CGO_ENABLED=0` to produce a static binary, or use a base that provides libc.',
      explanation:
        'The error is famously misleading. `ldd` on the binary tells you immediately whether it is static.',
    },
    {
      id: 'dk-multi-stage-builds-p3',
      level: 'intermediate',
      prompt:
        'A team moves to Alpine and their Python service gets slower and occasionally fails DNS lookups. Why might that be?',
      answer:
        'Alpine uses musl libc rather than glibc. Some Python packages fall back to slower pure-Python wheels or need compiling, and musl’s resolver behaves differently from glibc’s - notably around search domains and parallel A/AAAA queries.',
      explanation:
        'Alpine is an excellent default for Go and static binaries. For Python and Node with native modules, measure before adopting - a slim Debian variant is often the better trade.',
    },
    {
      id: 'dk-multi-stage-builds-p4',
      level: 'advanced',
      prompt:
        'Your production image is distroless and an incident needs a shell inside the running container. What are your options?',
      answer:
        'You cannot `docker exec sh` - there is no shell. Options: attach an ephemeral debug container sharing the target’s namespaces (`docker run --pid=container:<id> --network=container:<id>` with a debug image, or `kubectl debug` in Kubernetes); use the `:debug` variant of the distroless tag, which includes busybox; or rely on logs and metrics rather than a shell.',
      explanation:
        'This is the real trade with distroless, and it should be decided before adoption, not during an incident. Ephemeral debug containers are the modern answer and keep the production image clean.',
    },
  ],
  lab: {
    title: 'Take an image from gigabytes to megabytes',
    scenario:
      'Build a tiny Go service as a single stage, then as a multi-stage build, and compare size and contents.',
    prerequisites: ['Docker installed', 'An empty directory'],
    tasks: [
      {
        instruction: 'Create a minimal Go HTTP server in `main.go` listening on 8080.',
      },
      {
        instruction:
          'Write `Dockerfile.single` that builds and runs it all in `golang:1.23-alpine`.',
      },
      { instruction: 'Build it and record the image size.' },
      {
        instruction:
          'Write `Dockerfile.multi` with a builder stage and a `scratch` runtime stage, copying the binary and the CA bundle.',
        hint: 'Set CGO_ENABLED=0 so the binary is static.',
      },
      { instruction: 'Build it and compare the two sizes.' },
      {
        instruction:
          'Confirm the Go toolchain is absent from the multi-stage image, and that the service still responds.',
      },
    ],
    solution: [
      {
        title: 'Dockerfile.single and Dockerfile.multi',
        language: 'dockerfile',
        code: `# Dockerfile.single - everything shipped
FROM golang:1.23-alpine
WORKDIR /src
COPY . .
RUN go build -o /app ./...
EXPOSE 8080
CMD ["/app"]

# Dockerfile.multi - only the binary ships
FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/app ./...

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /out/app /app
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/app"]`,
      },
      {
        title: 'Build and compare',
        language: 'bash',
        code: `docker build -f Dockerfile.single -t demo:single .
docker build -f Dockerfile.multi  -t demo:multi  .

docker images demo
# demo  single  ~330MB
# demo  multi   ~7MB

docker run --rm demo:multi --version 2>&1 || true
docker run -d --name m -p 8080:8080 demo:multi
curl -s localhost:8080
docker rm -f m`,
      },
    ],
    verification: [
      {
        command: 'docker images demo --format "{{.Tag}} {{.Size}}"',
        what: 'Shows the size difference directly.',
        expected: 'The multi-stage image is one or two orders of magnitude smaller.',
      },
      {
        command: 'docker run --rm demo:multi sh 2>&1 | head -1',
        what: 'Confirms there is no shell in the scratch image.',
        expected: 'An exec format or no-such-file error - which is the intended outcome.',
      },
    ],
    cleanup: [
      {
        command: 'docker rmi demo:single demo:multi 2>/dev/null; true',
        what: 'Removes the lab images.',
      },
    ],
  },
  relatedTopicIds: ['dk-build-cache', 'dk-dockerfile-basics', 'dk-image-security'],
  docs: [
    { title: 'Multi-stage builds', url: 'https://docs.docker.com/build/building/multi-stage/' },
    { title: 'Base images', url: 'https://docs.docker.com/build/building/base-images/' },
  ],
}
