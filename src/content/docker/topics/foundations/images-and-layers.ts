import type { Topic } from '../../../types'

export const imagesAndLayers: Topic = {
  id: 'dk-images-and-layers',
  title: 'Images, layers and the writable container layer',
  domainId: 'dk-foundations',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 2,
  tags: ['images', 'layers', 'union filesystem', 'copy-on-write', 'storage'],
  oneLiner:
    'An image is a stack of read-only layers; a container adds one thin writable layer on top.',
  explanation: [
    'An **image** is a read-only template: a filesystem plus the metadata saying what to run. A **container** is an image with one thin **writable layer** added on top, plus a running process. One image can back a thousand containers, and they all share the same read-only layers.',
    'Images are built in **layers**. Each instruction in a Dockerfile that changes the filesystem produces a new layer containing only the difference from the layer below. A union filesystem - overlay2 on modern Linux - stacks them so the process sees one merged tree.',
    'Layers are **immutable and content-addressed**. A layer is identified by the hash of its contents, which is what lets two images that share a base image share those layers on disk and over the network. Pull a second image built on the same base and only the new layers come down.',
    'Writes from a running container go to its own writable layer using **copy-on-write**: modifying a file that lives in a lower layer copies the whole file up first, then edits the copy. Delete the container and that layer goes with it - which is the whole reason volumes exist.',
  ],
  whyItMatters: [
    'Layer sharing is why pulling ten images built on the same base is fast and why a 900MB image can cost only 30MB of new download. Build order decides whether you get that benefit.',
    'Copy-on-write explains two things people find odd: why writing to a large file inside a container is slow the first time, and why data disappears when a container is removed.',
    'Almost every image-size problem is a layer problem. Deleting a file in a later layer does not shrink the image, because the earlier layer still contains it.',
  ],
  howItWorks: [
    'Each filesystem-changing Dockerfile instruction creates a layer holding only the delta - the files added, changed or marked deleted.',
    'The layers are stacked by a **union filesystem**. Upper layers win, so a file changed in a later layer hides the version below it.',
    'A deleted file is not removed from the lower layer - it is hidden by a **whiteout** marker in the upper one. The bytes are still in the image, still downloaded, still in every copy.',
    'Starting a container adds a writable layer. Reads fall through to whichever layer holds the file; writes copy the file up into the writable layer first.',
    'Stopping a container keeps its writable layer. **Removing** the container deletes it, taking every change with it.',
    'An image **manifest** lists the layer digests and points at a config blob holding the default command, environment, working directory and exposed ports.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'How an image and a container stack up',
      caption:
        'Everything below the writable layer is shared and read-only. Only the top layer belongs to this container.',
      root: {
        label: 'Running container',
        detail: 'one process, one merged view of the filesystem',
        children: [
          {
            label: 'Writable container layer',
            detail: 'copy-on-write, deleted when the container is removed',
            tone: 'warning',
          },
          {
            label: 'Image layer: COPY app source',
            detail: 'changes on every commit - keep it last',
            tone: 'accent',
          },
          {
            label: 'Image layer: install dependencies',
            detail: 'changes rarely - cached across builds',
            tone: 'success',
          },
          {
            label: 'Base image layers',
            detail: 'shared with every other image built on the same base',
            tone: 'success',
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'What copy-on-write does to a write',
      caption:
        'The first write to a large file copies the whole file upwards. That cost is why hot data belongs in a volume.',
      nodes: [
        {
          label: 'Process opens a file for writing',
          detail: 'the file currently lives in a read-only image layer',
          tone: 'accent',
        },
        {
          label: 'Union filesystem finds it below',
          detail: 'reads fall through the stack until a layer has it',
          arrowLabel: 'lookup',
        },
        {
          label: 'Whole file copied up',
          detail: 'into the writable layer - cost is the file size, not the edit size',
          arrowLabel: 'copy-on-write',
          tone: 'warning',
        },
        {
          label: 'Edit applies to the copy',
          detail: 'the lower layer is never modified',
          arrowLabel: 'write',
        },
        {
          label: 'Container removed',
          detail: 'the writable layer and every change in it are deleted',
          arrowLabel: 'docker rm',
          tone: 'danger',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Image',
      purpose:
        'An ordered list of read-only layers plus a config describing how to run them. Identified by a content digest; tags are mutable names pointing at one.',
      fields: [
        { path: 'RepoTags', meaning: 'Human names such as nginx:1.27. A tag can be moved.' },
        { path: 'Id', meaning: 'sha256 digest of the image config. Immutable.' },
        { path: 'RootFS.Layers', meaning: 'Ordered layer digests making up the filesystem.' },
        { path: 'Config.Cmd', meaning: 'Default command if none is given at run time.' },
        { path: 'Config.Entrypoint', meaning: 'Executable the container always runs.' },
      ],
    },
    {
      kind: 'Layer',
      purpose:
        'An immutable, content-addressed set of filesystem changes. Shared between every image that contains it.',
      fields: [
        { path: 'digest', meaning: 'sha256 of the compressed layer. Identity and cache key.' },
        { path: 'size', meaning: 'Compressed size - what actually crosses the network.' },
        { path: '.wh.<name>', meaning: 'Whiteout marker hiding a file from a lower layer.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The secret that was deleted but not removed',
    story: [
      'A team adds a private key during a build, uses it to fetch a dependency, and deletes it in the next instruction. The final image has no key at `/tmp/id_rsa`, so they ship it to a public registry.',
      'The key is still there. The `RUN rm` created a new layer with a whiteout marker; the layer below still contains the file and is pulled by everyone who pulls the image. Anyone can extract it with `docker save` and `tar`.',
      'The fixes are all about never having the secret in a layer at all: a multi-stage build where the secret only exists in a discarded stage, or a BuildKit secret mount that is never committed to any layer. "Delete it afterwards" does not work, and this is one of the most common real leaks in container images.',
    ],
  },
  yamlExamples: [
    {
      title: 'Layer order decides what the cache can reuse',
      language: 'dockerfile',
      explanation:
        'Dependencies change rarely, source changes constantly. Copying the manifest first means a code edit rebuilds one small layer instead of reinstalling everything.',
      code: `# --- Wasteful: any source change reinstalls every dependency ---
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "server.js"]

# --- Better: the dependency layer is cached until the manifest changes ---
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["node", "server.js"]`,
    },
    {
      title: 'Why deleting in a later layer does not shrink anything',
      language: 'dockerfile',
      explanation:
        'Each RUN is its own layer. The first adds 80MB; the second only hides it. Combining them into one RUN means the file never exists in a committed layer.',
      code: `# --- The image is still 80MB larger ---
RUN curl -o /tmp/big.tar.gz https://example.com/big.tar.gz
RUN tar -xzf /tmp/big.tar.gz -C /opt
RUN rm /tmp/big.tar.gz

# --- One layer: the archive never survives into the image ---
RUN curl -o /tmp/big.tar.gz https://example.com/big.tar.gz \\
 && tar -xzf /tmp/big.tar.gz -C /opt \\
 && rm /tmp/big.tar.gz`,
    },
  ],
  imperative: [
    {
      command: 'docker image history nginx:1.27',
      what: 'Shows every layer with the instruction that created it and its size.',
      expected: 'A list where the largest layers are obvious at a glance.',
    },
    {
      command: 'docker image inspect nginx:1.27 --format "{{json .RootFS.Layers}}"',
      what: 'Prints the ordered layer digests.',
    },
    {
      command: 'docker system df -v',
      what: 'Shows reclaimable space and which images share layers.',
      expected: 'A SHARED SIZE column proving layers are not duplicated per image.',
    },
  ],
  declarative: {
    steps: [
      'Pull two images built on the same base and watch the second reuse layers.',
      'Inspect the layer list of both and confirm the shared digests.',
      'Build an image, change one source file, rebuild and observe which layers are reused.',
      'Write a file inside a running container, remove the container, and confirm the file is gone.',
    ],
    code: [
      {
        title: 'Seeing layer sharing for yourself',
        language: 'bash',
        explanation:
          'The second pull reports "Already exists" for every shared layer - that is content addressing at work.',
        code: `docker pull python:3.12-slim
docker pull python:3.12-slim-bookworm   # many layers already present

# Compare the layer lists - shared digests appear in both
docker image inspect python:3.12-slim \\
  --format '{{range .RootFS.Layers}}{{println .}}{{end}}' | head

# Total vs actually-on-disk, with the shared portion broken out
docker system df -v | head -20`,
      },
    ],
  },
  verification: [
    {
      command: 'docker image history <image> --no-trunc --format "{{.Size}}\\t{{.CreatedBy}}"',
      what: 'Finds which instruction is responsible for the bulk of an image.',
      expected: 'One or two lines dominating the total.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker image inspect <image> --format "{{len .RootFS.Layers}}"',
      what: 'Counts the layers in an image.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker diff <container>',
      what: 'Lists what the container has changed relative to its image.',
      expected: 'A for added, C for changed, D for deleted.',
      placeholders: ['<container>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker system df',
      what: 'Shows how much disk images, containers and volumes are using.',
      expected: 'A RECLAIMABLE column that is often larger than people expect.',
    },
    {
      command: 'docker image prune -a',
      what: 'Removes images no container references. Frees the most space of any cleanup.',
      namespaceNote: 'Without -a it only removes dangling (untagged) images.',
    },
    {
      command: 'docker save <image> | tar -t | head',
      what: 'Lists the layer archives inside an image - how you would confirm a deleted file is still present.',
      placeholders: ['<image>'],
    },
  ],
  commonMistakes: [
    'Believing `RUN rm` in a later layer shrinks the image. It only hides the file; the bytes ship with every pull.',
    'Putting `COPY . .` before the dependency install, which throws away the cache on every source change.',
    'Storing application data in the container filesystem and losing it when the container is replaced.',
    'Adding a secret during a build and deleting it afterwards. It remains extractable from the earlier layer.',
    'Reading `docker images` sizes as additive. Images sharing a base do not each cost their full size on disk.',
  ],
  examTips: [
    'An image is read-only; a container is that image plus one writable layer.',
    'Layers are content-addressed, which is what makes sharing and caching possible.',
    'A deletion in a later layer is a whiteout marker, not a removal.',
    'Copy-on-write copies the whole file on first write, however small the edit.',
    'Removing a container deletes its writable layer. Anything that must survive belongs in a volume.',
  ],
  summary: [
    'Images are stacks of immutable, content-addressed layers; containers add one writable layer.',
    'Shared layers are stored and transferred once, which is why base-image choice matters.',
    'Deleting a file in a later layer hides it but does not remove it from the image.',
    'Copy-on-write makes the first write to a large file expensive.',
    'Everything in the writable layer dies with the container.',
  ],
  practice: [
    {
      id: 'dk-images-and-layers-p1',
      level: 'beginner',
      prompt:
        'You run three containers from the same 800MB image. Roughly how much disk do the images use?',
      answer:
        'About 800MB in total. The read-only layers are shared; each container adds only its own small writable layer.',
      explanation:
        'This is the practical payoff of content-addressed layers, and it is why `docker system df` reports a SHARED SIZE separately from the total.',
    },
    {
      id: 'dk-images-and-layers-p2',
      level: 'intermediate',
      prompt:
        'A Dockerfile downloads a 200MB archive, extracts it, and removes the archive in a separate `RUN`. Why is the image still 200MB larger, and what is the fix?',
      answer:
        'Each `RUN` is its own layer, so the archive is committed in the first one and only hidden by a whiteout in the third. Chain the download, extract and remove into a single `RUN` so the archive never exists in a committed layer.',
      explanation:
        'A multi-stage build is the other fix: extract in a build stage and copy only the extracted result into the final image.',
    },
    {
      id: 'dk-images-and-layers-p3',
      level: 'intermediate',
      prompt:
        'Why does `COPY package.json ./` then `RUN npm ci` then `COPY . .` build faster than `COPY . .` then `RUN npm ci`?',
      answer:
        'The cache is invalidated at the first instruction whose inputs changed, and everything after it rebuilds. Copying only the manifest first means editing source code leaves the dependency layer untouched, so `npm ci` is reused from cache.',
      explanation:
        'The rule generalises: order instructions from least likely to change to most likely to change.',
    },
    {
      id: 'dk-images-and-layers-p4',
      level: 'advanced',
      prompt:
        'A build added a private key, used it, and deleted it in the next instruction. Is the key recoverable from the published image?',
      answer:
        'Yes. The deletion created a whiteout in a later layer, but the layer that added the key is still part of the image and is pulled by everyone. `docker save` plus extracting the layer archives recovers it.',
      explanation:
        'The only real fixes are to keep the secret out of any committed layer: a BuildKit `--mount=type=secret`, or a multi-stage build where the secret lives in a stage that is discarded.',
    },
  ],
  lab: {
    title: 'Watch the cache work, and prove a deleted file is still there',
    scenario:
      'Build a small image twice to see layer reuse, then demonstrate that removing a file in a later layer does not shrink the image.',
    prerequisites: ['Docker installed', 'An empty directory'],
    tasks: [
      {
        instruction:
          'Create a directory with a `Dockerfile` that creates a 50MB file in one `RUN` and removes it in a second `RUN`.',
        hint: 'Use `dd if=/dev/zero of=/big bs=1M count=50`.',
      },
      { instruction: 'Build it as `layers:bad` and record the reported image size.' },
      {
        instruction: 'Write a second Dockerfile that creates and removes the file in one `RUN`.',
      },
      { instruction: 'Build it as `layers:good` and compare the two sizes.' },
      {
        instruction:
          'Run `docker image history layers:bad` and identify the layer holding the 50MB.',
      },
      {
        instruction:
          'Start a container from either image, create a file in it, remove the container, and confirm the file is gone from a fresh container.',
      },
    ],
    solution: [
      {
        title: 'Dockerfile.bad and Dockerfile.good',
        language: 'dockerfile',
        code: `# Dockerfile.bad - three layers, the big file committed in the first
FROM alpine:3.20
RUN dd if=/dev/zero of=/big bs=1M count=50
RUN echo "using the file"
RUN rm /big

# Dockerfile.good - one layer, the file never committed
FROM alpine:3.20
RUN dd if=/dev/zero of=/big bs=1M count=50 \\
 && echo "using the file" \\
 && rm /big`,
      },
      {
        title: 'Build and compare',
        language: 'bash',
        code: `docker build -f Dockerfile.bad  -t layers:bad  .
docker build -f Dockerfile.good -t layers:good .

docker images | grep layers
# layers:bad   ~58MB   <- the removed file is still in there
# layers:good  ~8MB

docker image history layers:bad   # the dd layer is 50MB+

# Writable layer is per-container and disposable
docker run --rm alpine sh -c 'echo hi > /tmp/note; cat /tmp/note'
docker run --rm alpine cat /tmp/note   # No such file - different container`,
      },
    ],
    verification: [
      {
        command: 'docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}" | grep layers',
        what: 'Compares the two image sizes directly.',
        expected: 'layers:bad is roughly 50MB larger than layers:good.',
      },
      {
        command: 'docker image history layers:bad --format "{{.Size}}\\t{{.CreatedBy}}"',
        what: 'Shows which instruction owns the space.',
        expected: 'The dd layer reports about 52MB.',
      },
    ],
    cleanup: [
      {
        command: 'docker rmi layers:bad layers:good 2>/dev/null; true',
        what: 'Removes the lab images.',
      },
    ],
  },
  relatedTopicIds: ['dk-what-is-a-container', 'dk-build-cache', 'dk-volumes-and-mounts'],
  docs: [
    {
      title: 'Images and layers',
      url: 'https://docs.docker.com/engine/storage/drivers/#images-and-layers',
    },
    { title: 'About storage drivers', url: 'https://docs.docker.com/engine/storage/drivers/' },
  ],
}
