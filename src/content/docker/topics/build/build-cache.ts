import type { Topic } from '../../../types'

export const buildCache: Topic = {
  id: 'dk-build-cache',
  title: 'The build cache and .dockerignore',
  domainId: 'dk-build',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 2,
  tags: ['cache', 'buildkit', 'dockerignore', 'build context', 'performance'],
  oneLiner:
    'Why instruction order decides build time, and why the wrong build context makes every build slow before it starts.',
  explanation: [
    'Docker caches each built layer. On a rebuild it walks the instructions in order and reuses a layer whenever the instruction and its inputs are unchanged. The moment one instruction misses, **every instruction after it rebuilds** - the cache is a prefix, not a set.',
    'That single rule dictates Dockerfile structure: put what changes **least** at the top and what changes **most** at the bottom. Dependencies change weekly; source changes hourly. Copy the dependency manifest and install before copying the source, and a code edit no longer reinstalls anything.',
    'For `RUN`, the cache key is the instruction text. Docker does not know whether `apt-get update` would fetch something new - it sees the same string and reuses the layer, which is why a stale `apt-get update` layer can persist for months. For `COPY` and `ADD`, the key includes a checksum of the files, so the cache correctly invalidates when content changes.',
    'The **build context** is separate from the cache and often the bigger problem. `docker build .` uploads the entire directory to the builder before anything runs. A context containing `node_modules`, `.git` and build output can be hundreds of megabytes, sent on every build. `.dockerignore` is what stops that, and it also protects you from accidentally copying secrets in with `COPY . .`.',
  ],
  whyItMatters: [
    'A well-ordered Dockerfile turns a three-minute rebuild into fifteen seconds. Across a team and a CI system that is a large amount of time and money.',
    'A missing `.dockerignore` is the most common reason a build feels slow before any instruction has run, and it is a genuine security issue: `COPY . .` with no ignore file will happily bake `.env` and `.git` into the image.',
    'Understanding that cache invalidation cascades is what makes people stop wondering why a one-character change rebuilt everything.',
  ],
  howItWorks: [
    'The client collects the build context, applies `.dockerignore`, and sends what remains to the builder.',
    'For each instruction the builder computes a cache key. For `RUN` it is the command text plus the parent layer; for `COPY` and `ADD` it also includes a checksum of the copied files.',
    'If a layer with that key exists, it is reused and the instruction does not execute. If not, the instruction runs and every subsequent instruction is treated as a miss.',
    '**BuildKit** - the default builder since Docker 23 - improves on this. It builds a dependency graph rather than a strict line-by-line sequence, so independent stages build in parallel, and it supports `--mount=type=cache` for package-manager caches that survive across builds without being committed to a layer.',
    'BuildKit also supports **secret mounts**, which make a file available during one `RUN` without ever writing it into a layer - the correct way to use a token during a build.',
    'Cache can be exported and imported (`--cache-to` and `--cache-from`), which is how a CI runner with no local state still gets cache hits.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How one changed file cascades',
      caption:
        'The cache is a prefix. Everything after the first miss rebuilds, however unrelated it looks.',
      nodes: [
        {
          label: 'FROM node:22-alpine',
          detail: 'unchanged - cache hit',
          tone: 'success',
        },
        {
          label: 'COPY package.json ./',
          detail: 'unchanged content - cache hit',
          arrowLabel: 'hit',
          tone: 'success',
        },
        {
          label: 'RUN npm ci',
          detail: 'parent unchanged, command unchanged - cache hit, 90 seconds saved',
          arrowLabel: 'hit',
          tone: 'success',
        },
        {
          label: 'COPY . .',
          detail: 'you edited one source file - checksum differs, MISS',
          arrowLabel: 'miss',
          tone: 'danger',
        },
        {
          label: 'Everything below rebuilds',
          detail: 'the cache cannot resume after a miss',
          arrowLabel: 'cascade',
          tone: 'warning',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Why did this build not use the cache?',
      caption: 'Work down the list - the first two cover most cases.',
      question: 'Which instruction missed first?',
      branches: [
        {
          condition: 'A COPY near the top',
          result: 'Context or ordering problem',
          detail: 'copying source before installing dependencies, or a missing .dockerignore',
          tone: 'danger',
        },
        {
          condition: 'Everything, on a fresh CI runner',
          result: 'No cache to import',
          detail: 'use --cache-from and --cache-to with a registry',
          tone: 'warning',
        },
        {
          condition: 'A RUN with a date or a random value in it',
          result: 'The key changes every build',
          detail: 'an ARG that changes, or a build timestamp baked into the command',
          tone: 'warning',
        },
        {
          condition: 'Nothing obvious, and the base moved',
          result: 'The base image tag was updated',
          detail: 'a new FROM digest invalidates the entire Dockerfile',
          tone: 'accent',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: '.dockerignore',
      purpose:
        'Excludes paths from the build context before it is uploaded. Same syntax as .gitignore, matched against the context root.',
      fields: [
        {
          path: '.git',
          meaning: 'Often the largest single directory, and never needed in an image.',
        },
        {
          path: 'node_modules',
          meaning: 'Rebuilt inside the image; copying it in is slow and wrong.',
        },
        { path: '**/*.env', meaning: 'Stops secrets being baked into a layer by COPY . .' },
        { path: 'Dockerfile', meaning: 'Rarely needed inside the image itself.' },
        {
          path: '!keep/this',
          meaning: 'A leading ! re-includes a path excluded by an earlier pattern.',
        },
      ],
    },
    {
      kind: 'BuildKit mount',
      purpose:
        'Makes something available during one RUN without committing it to a layer. Requires BuildKit, which is the default.',
      fields: [
        {
          path: '--mount=type=cache,target=/root/.npm',
          meaning: 'Persistent package cache across builds.',
        },
        {
          path: '--mount=type=secret,id=token',
          meaning: 'A secret readable at /run/secrets/token, never in a layer.',
        },
        {
          path: '--mount=type=bind,source=.,target=/src',
          meaning: 'Read the context without copying it in.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Ninety seconds a build, forty builds a day',
    story: [
      'A Node service took three and a half minutes to build in CI. Almost all of it was `npm ci`, and it ran on every build because the Dockerfile started `COPY . .`.',
      'Reordering to copy `package.json` and `package-lock.json` first, install, then copy the source, cut a typical build to about forty seconds - dependencies only reinstall when the lockfile changes. Adding `.dockerignore` for `.git` and `node_modules` cut another twenty seconds of context upload.',
      'Two lines of Dockerfile and a five-line ignore file. Across forty builds a day that is more than an hour of CI time returned daily, and the developer feedback loop got noticeably better - which mattered more than the money.',
    ],
  },
  yamlExamples: [
    {
      title: 'A .dockerignore that earns its place',
      language: 'text',
      explanation:
        'Everything here is either large, secret, or rebuilt inside the image. Start with this and add to it.',
      code: `.git
.gitignore
node_modules
npm-debug.log
dist
build
coverage
.env
.env.*
**/*.pem
**/*.key
.vscode
.idea
Dockerfile*
docker-compose*.yml
README.md
.github`,
    },
    {
      title: 'Cache mounts and secret mounts',
      language: 'dockerfile',
      explanation:
        'The npm cache persists between builds without entering any layer, and the token is readable during the RUN and never committed.',
      code: `# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./

# The cache directory survives across builds and is NOT part of the image
RUN --mount=type=cache,target=/root/.npm \\
    npm ci --omit=dev

# A private registry token, available only during this RUN.
# Build with: docker build --secret id=npmrc,src=$HOME/.npmrc .
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    npm ci --omit=dev

COPY . .
USER node
CMD ["node", "server.js"]`,
    },
  ],
  imperative: [
    {
      command: 'docker build --progress=plain -t myapp .',
      what: 'Shows full output including CACHED markers on each step.',
      expected: 'Lines reading "CACHED [3/6] RUN npm ci" when the cache hits.',
    },
    {
      command: 'docker build --no-cache -t myapp .',
      what: 'Forces a full rebuild. Use to prove a cached layer is stale.',
    },
    {
      command: 'docker build --build-arg VERSION=1.2.3 -t myapp .',
      what: 'Passes a build argument. Changing it invalidates the cache from that ARG onward.',
    },
    {
      command: 'docker builder prune',
      what: 'Reclaims build cache, which grows quietly and can be many gigabytes.',
    },
  ],
  declarative: {
    steps: [
      'Build an image, then rebuild without changing anything and confirm every step is CACHED.',
      'Edit a source file and rebuild, noting which step misses first.',
      'Move the COPY of the source below the dependency install and repeat.',
      'Add a .dockerignore and compare the reported context size.',
    ],
    code: [
      {
        title: 'Measuring the difference',
        language: 'bash',
        explanation:
          'The context size is printed at the start of every build - it is the number most people never look at.',
        code: `# Before: the whole directory, .git and node_modules included
docker build -t myapp . 2>&1 | head -3
#   Sending build context to Docker daemon  248.7MB

printf '.git\\nnode_modules\\ndist\\n.env\\n' > .dockerignore

docker build -t myapp . 2>&1 | head -3
#   Sending build context to Docker daemon   1.2MB

# Which step misses when you touch one source file?
touch src/index.js
docker build --progress=plain -t myapp . 2>&1 | grep -E "CACHED|^#[0-9]+ \\[" | head`,
      },
      {
        title: 'Cache across CI runners with no local state',
        language: 'bash',
        explanation:
          'A fresh runner has no cache at all. Exporting to a registry is what gives it one.',
        code: `docker buildx build \\
  --cache-from type=registry,ref=ghcr.io/acme/myapp:buildcache \\
  --cache-to   type=registry,ref=ghcr.io/acme/myapp:buildcache,mode=max \\
  -t ghcr.io/acme/myapp:$GIT_SHA \\
  --push .`,
      },
    ],
  },
  verification: [
    {
      command: 'docker build --progress=plain -t myapp . 2>&1 | grep CACHED',
      what: 'Lists exactly which steps were reused.',
      expected: 'Every step up to your first real change.',
    },
    {
      command: 'docker system df',
      what: 'Shows how much space the build cache is using.',
      expected: 'A Build Cache row that is often several gigabytes.',
    },
    {
      command: 'du -sh . --exclude=.git',
      what: 'Estimates the build context size before you build.',
    },
  ],
  troubleshooting: [
    {
      command: 'docker build --no-cache --progress=plain -t myapp .',
      what: 'Proves whether a problem is a stale cached layer or a real code issue.',
    },
    {
      command: 'docker builder prune -af',
      what: 'Clears all build cache when disk pressure is the problem.',
      namespaceNote: 'The next build will be slow. Do not do this reflexively.',
    },
    {
      command: 'docker build -t myapp . 2>&1 | head -1',
      what: 'The first line reports the context size - a large number here means .dockerignore is missing or wrong.',
    },
  ],
  commonMistakes: [
    '`COPY . .` before installing dependencies, which discards the most expensive cached layer on every code change.',
    'No `.dockerignore`, so every build uploads `.git` and `node_modules` and `COPY . .` can bake in a `.env`.',
    'Relying on a cached `apt-get update` layer. Its cache key is the command text, so it can serve stale package indexes for months - always combine it with the install in one RUN.',
    'Putting a frequently changing `ARG` near the top, which invalidates everything below it on every build.',
    'Assuming CI has a cache. A fresh runner starts empty unless you export and import it deliberately.',
  ],
  examTips: [
    'Cache invalidation cascades: the first miss rebuilds everything after it.',
    'COPY cache keys include a file checksum; RUN cache keys are only the command text.',
    '`.dockerignore` affects the build context, not the image directly - but it changes both size and safety.',
    'BuildKit cache mounts persist between builds without entering a layer.',
    'A secret mount is the correct way to use a token during a build. Copying it in and deleting it is not.',
  ],
  summary: [
    'Order instructions from least to most frequently changing.',
    'One cache miss invalidates every later instruction.',
    '`.dockerignore` shrinks the context and prevents accidental secret inclusion.',
    'BuildKit adds cache mounts, secret mounts and parallel stages.',
    'CI needs cache exported to a registry to benefit at all.',
  ],
  practice: [
    {
      id: 'dk-build-cache-p1',
      level: 'beginner',
      prompt: 'You change one line in `README.md` and the whole dependency install re-runs. Why?',
      answer:
        '`COPY . .` sits before the install, and its cache key includes a checksum of every copied file. README.md is in the context, so the checksum changed, that step missed, and everything after it rebuilt.',
      explanation:
        'Two fixes, both worth doing: copy only the dependency manifest before installing, and add README.md to `.dockerignore` if the image does not need it.',
    },
    {
      id: 'dk-build-cache-p2',
      level: 'intermediate',
      prompt: 'Why is a cached `RUN apt-get update` layer dangerous?',
      answer:
        'Its cache key is only the command text, which never changes, so Docker reuses a package index that may be months old. Installs then fetch stale versions or fail on packages that have moved.',
      explanation:
        'Always combine update and install in a single RUN - `apt-get update && apt-get install -y ...` - so they share a cache key and can never drift apart.',
    },
    {
      id: 'dk-build-cache-p3',
      level: 'intermediate',
      prompt:
        'Builds are slow in CI even though the Dockerfile is well ordered. Local builds are fast. What is different?',
      answer:
        'CI runners are usually ephemeral and start with no local layer cache, so every build is effectively `--no-cache`. Export the cache to a registry with `--cache-to` and import it with `--cache-from`.',
      explanation:
        'A registry-backed cache is what makes a stateless runner behave like a warm local machine.',
    },
    {
      id: 'dk-build-cache-p4',
      level: 'advanced',
      prompt:
        'You need a private registry token during the build. Why is `COPY .npmrc` then `RUN rm .npmrc` wrong, and what should you do?',
      answer:
        'The COPY commits the token into a layer; the later removal only adds a whiteout, so the token is still extractable from the published image. Use a BuildKit secret mount, which makes the file readable during one RUN and never writes it to any layer.',
      explanation:
        '`RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci`, built with `--secret id=npmrc,src=$HOME/.npmrc`. A multi-stage build where the token lives only in a discarded stage also works.',
    },
  ],
  lab: {
    title: 'Make a slow build fast',
    scenario:
      'Start from a deliberately bad Dockerfile, measure it, then fix the ordering and the context and measure again.',
    prerequisites: ['Docker installed', 'A small Node or Python project, or the files below'],
    tasks: [
      {
        instruction:
          'Create a project directory with a dependency manifest, a source file, and a large dummy `.git` directory.',
        hint: '`mkdir -p .git && dd if=/dev/zero of=.git/pack bs=1M count=80`',
      },
      {
        instruction: 'Write a Dockerfile that does `COPY . .` before installing dependencies.',
      },
      { instruction: 'Build it and record the context size and total time.' },
      {
        instruction: 'Touch the source file, rebuild, and record the time again.',
      },
      {
        instruction:
          'Add a `.dockerignore` excluding `.git`, then reorder the Dockerfile to copy the manifest first.',
      },
      {
        instruction: 'Rebuild twice more and compare both numbers with the originals.',
        hint: 'The second rebuild should show CACHED on the install step.',
      },
    ],
    solution: [
      {
        title: 'Before and after',
        language: 'dockerfile',
        code: `# --- before: context is huge, cache is useless ---
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev || true
CMD ["node", "index.js"]

# --- after: small context, cache survives source edits ---
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \\
    npm ci --omit=dev || true
COPY . .
USER node
CMD ["node", "index.js"]`,
      },
      {
        title: 'Measuring it',
        language: 'bash',
        code: `# Before
time docker build --no-cache -t cache:before . 2>&1 | head -1
touch index.js
time docker build -t cache:before .        # full reinstall

printf '.git\\nnode_modules\\n' > .dockerignore
# ... reorder the Dockerfile ...

# After
time docker build --no-cache -t cache:after . 2>&1 | head -1
touch index.js
time docker build --progress=plain -t cache:after . 2>&1 | grep CACHED
#   CACHED [3/5] RUN npm ci   <- the expensive step was reused`,
      },
    ],
    verification: [
      {
        command: 'docker build --progress=plain -t cache:after . 2>&1 | grep -c CACHED',
        what: 'Counts reused steps after a source-only change.',
        expected: 'At least the FROM, COPY manifest and RUN install steps.',
      },
      {
        command: 'docker build -t cache:after . 2>&1 | head -1',
        what: 'Reports the build context size.',
        expected: 'Kilobytes rather than tens of megabytes.',
      },
    ],
    cleanup: [
      {
        command: 'docker rmi cache:before cache:after 2>/dev/null; true',
        what: 'Removes the lab images.',
      },
    ],
  },
  relatedTopicIds: ['dk-dockerfile-basics', 'dk-multi-stage-builds', 'dk-images-and-layers'],
  docs: [
    { title: 'Build cache', url: 'https://docs.docker.com/build/cache/' },
    {
      title: 'Dockerignore files',
      url: 'https://docs.docker.com/build/concepts/context/#dockerignore-files',
    },
  ],
}
