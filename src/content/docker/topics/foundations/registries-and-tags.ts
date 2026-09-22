import type { Topic } from '../../../types'

export const registriesAndTags: Topic = {
  id: 'dk-registries-and-tags',
  title: 'Registries, tags and digests',
  domainId: 'dk-foundations',
  difficulty: 'intermediate',
  estimatedMinutes: 15,
  order: 3,
  tags: ['registry', 'tags', 'digest', 'immutability', 'supply chain'],
  oneLiner:
    'A tag is a mutable label that can be moved under you; a digest is the only stable way to name an image.',
  explanation: [
    'A **registry** stores and serves images. Docker Hub is the default, but Amazon ECR, Google Artifact Registry, GitHub Container Registry and self-hosted Harbor all speak the same API.',
    'A full image reference is `registry/namespace/repository:tag`. When you write `nginx`, Docker expands it to `docker.io/library/nginx:latest` - the registry, the namespace and the tag are all defaults, which is why the same short name can pull different things in different environments.',
    'A **tag is mutable**. `nginx:1.27` today and `nginx:1.27` next month may be different images, because the publisher can move the tag. `latest` is not special in any way - it is just the tag used when you do not name one, and it usually points at whatever was pushed most recently.',
    'A **digest** is the sha256 hash of the image manifest, written `nginx@sha256:abc123...`. It is immutable by construction: the same digest always means byte-identical content. Pinning by digest is the only way to guarantee that what you tested is what you deploy.',
  ],
  whyItMatters: [
    'Almost every "it worked yesterday" container incident is a tag that moved. The build pulled a different base image than the one that was tested.',
    'Supply-chain controls - reproducible builds, provenance, attestation - all rest on digests. A pipeline that pins tags is not reproducible whatever else it does.',
    'Understanding the default expansion explains why an image name that works on a laptop fails in a cluster pointed at a private registry.',
  ],
  howItWorks: [
    'A pull resolves the reference to a **manifest**. For a multi-architecture image that manifest is a list, and the daemon selects the entry matching the host platform - which is why the same tag gives a different digest on arm64 and amd64.',
    'The manifest names a config blob and the layer blobs by digest. The daemon downloads only the blobs it does not already have.',
    'Layers are shared across images by digest, so pulling a second image on the same base transfers only what is new.',
    'A push uploads any blobs the registry lacks, then the manifest, then associates the tag with it. Moving a tag is just re-associating a name - nothing is overwritten.',
    'Authentication is per registry. `docker login` stores a credential that the daemon presents on later pulls and pushes.',
    'Registries commonly apply **rate limits** and **retention policies**. An anonymous Docker Hub pull is rate-limited by IP, which is a real cause of CI failures at scale.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How a short image name is resolved',
      caption:
        'Three defaults are filled in silently. That is why the same name can mean different things in different environments.',
      nodes: [
        {
          label: 'You write: nginx',
          detail: 'no registry, no namespace, no tag',
          tone: 'accent',
        },
        {
          label: 'Registry defaults to docker.io',
          detail: 'a private-registry environment may default elsewhere',
          arrowLabel: 'expand',
        },
        {
          label: 'Namespace defaults to library',
          detail: 'reserved for official images on Docker Hub',
          arrowLabel: 'expand',
        },
        {
          label: 'Tag defaults to latest',
          detail: 'not special - just the fallback name, and it moves',
          arrowLabel: 'expand',
          tone: 'warning',
        },
        {
          label: 'Manifest resolved to a digest',
          detail: 'multi-arch lists pick the entry matching your platform',
          arrowLabel: 'fetch',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'How should this image reference be pinned?',
      caption: 'The stricter the environment, the further right you should be.',
      question: 'Where is this reference used?',
      branches: [
        {
          condition: 'Local experimentation',
          result: 'A tag is fine',
          detail: 'convenience matters more than reproducibility here',
        },
        {
          condition: 'A Dockerfile base image in CI',
          result: 'Pin a specific version tag, at minimum',
          detail: 'never latest - it changes without warning',
          tone: 'accent',
        },
        {
          condition: 'Production deployment',
          result: 'Pin by digest',
          detail: 'the only reference that cannot change under you',
          tone: 'success',
        },
        {
          condition: 'Regulated or audited supply chain',
          result: 'Digest plus signature verification',
          detail: 'digest proves identity, signature proves origin',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Image reference',
      purpose:
        'The full address of an image. Every part has a default, which is what makes short names ambiguous across environments.',
      fields: [
        { path: 'registry', meaning: 'Host, e.g. ghcr.io. Defaults to docker.io.' },
        {
          path: 'namespace',
          meaning: 'Organisation or user. Defaults to library for official images.',
        },
        { path: 'repository', meaning: 'The image name itself, e.g. nginx.', required: true },
        { path: 'tag', meaning: 'Mutable label. Defaults to latest.' },
        {
          path: '@digest',
          meaning: 'Immutable sha256 of the manifest. Wins over the tag if both are given.',
        },
      ],
    },
    {
      kind: 'Manifest',
      purpose:
        'Describes one image: its config and its layers, all by digest. A manifest LIST describes several, one per platform.',
      fields: [
        { path: 'mediaType', meaning: 'Distinguishes a single manifest from a multi-arch list.' },
        { path: 'config.digest', meaning: 'Points at the config blob holding Cmd, Env and so on.' },
        { path: 'layers[].digest', meaning: 'Ordered layer blobs.' },
        { path: 'platform', meaning: 'In a list: os and architecture for this entry.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The base image that changed overnight',
    story: [
      'A service builds `FROM node:22-alpine`. It has built and deployed cleanly for months. One Tuesday the build succeeds, the image deploys, and the service starts crashing on a native dependency.',
      'Nothing in the repository changed. The `node:22-alpine` tag had been moved to a new patch release with a newer Alpine base, and a shared library the native module linked against had changed. The build was never reproducible - it just happened to be stable.',
      'The fix was two lines: pin the base by digest in the Dockerfile, and add a scheduled job that proposes a digest bump as a reviewable pull request. Upgrades still happen - they just happen deliberately, on a day somebody is watching, instead of silently.',
    ],
  },
  yamlExamples: [
    {
      title: 'Pinning a base image by digest',
      language: 'dockerfile',
      explanation:
        'Keeping the tag alongside the digest is purely for human readability - the digest is what resolves.',
      code: `# Reproducible: this is byte-identical every time, forever
FROM node:22-alpine@sha256:9fcc1a6da2b9eee38638df75c5f7e0e5e1f3a1e59c0f13d3f2f9b81f0e0f2a11

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
USER node
CMD ["node", "server.js"]`,
    },
    {
      title: 'A sensible tagging scheme for your own images',
      language: 'bash',
      explanation:
        'Immutable identity from the commit SHA, convenience from the moving tags. Deployments reference the SHA tag or the digest, never latest.',
      code: `REGISTRY=ghcr.io/acme
IMAGE=checkout
SHA=$(git rev-parse --short HEAD)
VERSION=$(cat VERSION)          # e.g. 2.4.1

docker build \\
  -t "$REGISTRY/$IMAGE:$SHA" \\
  -t "$REGISTRY/$IMAGE:$VERSION" \\
  -t "$REGISTRY/$IMAGE:latest" \\
  .

docker push --all-tags "$REGISTRY/$IMAGE"

# Deploy by the immutable one, never by latest
echo "deploying $REGISTRY/$IMAGE:$SHA"`,
    },
  ],
  imperative: [
    {
      command: 'docker pull nginx:1.27',
      what: 'Downloads an image by tag, selecting the manifest matching your platform.',
      expected: 'Digest: sha256:... printed at the end - that is what you actually got.',
    },
    {
      command: 'docker login ghcr.io -u <user>',
      what: 'Authenticates to a registry so pulls and pushes are permitted.',
      placeholders: ['<user>'],
      namespaceNote: 'Use a token, not a password, and prefer --password-stdin in scripts.',
    },
    {
      command: 'docker tag myapp:dev ghcr.io/acme/myapp:1.2.0',
      what: 'Adds a second name to the same image. No data is copied.',
    },
    {
      command: 'docker push ghcr.io/acme/myapp:1.2.0',
      what: 'Uploads any blobs the registry lacks, then associates the tag.',
    },
  ],
  declarative: {
    steps: [
      'Pull an image by tag and note the digest it reports.',
      'Pull the same image again by digest and confirm it resolves to the identical thing.',
      'Inspect the multi-architecture manifest list to see the per-platform entries.',
      'Pin a Dockerfile base image by digest and rebuild.',
    ],
    code: [
      {
        title: 'Finding and using a digest',
        language: 'bash',
        explanation:
          'RepoDigests is the reference you should be putting in production manifests and Dockerfiles.',
        code: `docker pull alpine:3.20

# The immutable reference for what you just pulled
docker image inspect alpine:3.20 --format '{{index .RepoDigests 0}}'
# alpine@sha256:beefbeef...

# Pull by digest - tag-independent and reproducible
docker pull alpine@sha256:beefbeef...

# What platforms does this tag actually offer?
docker manifest inspect alpine:3.20 \\
  | grep -A3 '"platform"' | head -20

# Or, without the experimental command:
docker buildx imagetools inspect alpine:3.20`,
      },
    ],
  },
  verification: [
    {
      command: 'docker image inspect <image> --format "{{index .RepoDigests 0}}"',
      what: 'Prints the immutable digest reference for a pulled image.',
      expected: 'name@sha256:... - safe to paste into a Dockerfile or deployment.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker buildx imagetools inspect <image>',
      what: 'Shows the manifest, including every platform in a multi-arch list.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker image inspect <image> --format "{{.Architecture}}/{{.Os}}"',
      what: 'Confirms which platform variant you actually pulled.',
      expected: 'amd64/linux or arm64/linux.',
      placeholders: ['<image>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker pull <image>',
      what: 'A denied error is usually authentication, not a missing image.',
      expected:
        '"pull access denied" means log in; "manifest unknown" means the tag does not exist.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker logout && docker login <registry>',
      what: 'Clears a stale credential, which is a common cause of sudden 401s in CI.',
      placeholders: ['<registry>'],
    },
    {
      command: 'docker run --rm <image> uname -m',
      what: 'Detects an architecture mismatch - an amd64 image emulated on arm64 is slow or fails.',
      expected: 'x86_64 or aarch64, matching the host.',
      placeholders: ['<image>'],
    },
  ],
  commonMistakes: [
    'Treating `latest` as "the newest stable release". It is only the default tag name, and it moves whenever somebody pushes.',
    'Pinning a version tag and calling the build reproducible. Version tags move too - only a digest cannot.',
    'Assuming a short name means the same image everywhere. The registry and namespace defaults differ between environments.',
    'Using anonymous Docker Hub pulls in CI and being rate-limited at the worst moment. Authenticate, or mirror.',
    'Pushing `latest` and deploying `latest`, so nobody can say which build is actually running.',
  ],
  examTips: [
    'A tag is a mutable pointer; a digest is immutable. That distinction is the point of this topic.',
    '`nginx` expands to `docker.io/library/nginx:latest`. Know all three defaults.',
    'The same tag gives different digests on different architectures, because a multi-arch tag resolves through a manifest list.',
    '`docker tag` copies no data - it adds a name to an existing image.',
    'If both a tag and a digest are given, the digest wins.',
  ],
  summary: [
    'A full reference is registry/namespace/repository:tag, and every part has a default.',
    'Tags move; digests do not. Production should reference digests.',
    '`latest` carries no meaning beyond being the fallback tag.',
    'Multi-arch tags resolve through a manifest list to a per-platform image.',
    'Registry rate limits and authentication are ordinary causes of CI failure.',
  ],
  practice: [
    {
      id: 'dk-registries-and-tags-p1',
      level: 'beginner',
      prompt: 'What does `docker pull redis` actually pull?',
      answer:
        '`docker.io/library/redis:latest` - the registry defaults to Docker Hub, the namespace to `library`, and the tag to `latest`.',
      explanation:
        'All three defaults are silent, which is why the identical command can pull different images on a laptop and in a cluster configured with a mirror or a private default registry.',
    },
    {
      id: 'dk-registries-and-tags-p2',
      level: 'intermediate',
      prompt:
        'Your CI pins `FROM python:3.12-slim` and the build broke overnight with no repository changes. What happened?',
      answer:
        'The `python:3.12-slim` tag was moved to a newer build - a patch release, or a rebuilt base with updated system packages. A version tag is still mutable, so the build was never reproducible.',
      explanation:
        'Pin the base by digest and bump it deliberately through a reviewed pull request. You still get updates; you get them on a day somebody is watching.',
    },
    {
      id: 'dk-registries-and-tags-p3',
      level: 'intermediate',
      prompt:
        'Why does the same `alpine:3.20` tag give one digest on your Apple laptop and a different one in CI?',
      answer:
        'It is a multi-architecture image. The tag resolves to a manifest list, and the daemon selects the entry matching the host platform - arm64 on the laptop, amd64 in CI - which are different images with different digests.',
      explanation:
        'Pinning the list digest keeps multi-arch behaviour; pinning a per-platform digest locks you to one architecture. Know which one you have pasted.',
    },
    {
      id: 'dk-registries-and-tags-p4',
      level: 'advanced',
      prompt:
        'Your deployments reference `myapp:latest` and a rollback is needed. Why is this difficult?',
      answer:
        'Nothing records which image `latest` pointed at when the bad deployment happened, and the tag has since moved. There is no reference to roll back to unless the digest was captured at deploy time.',
      explanation:
        'Tag every build with the commit SHA and deploy that, or capture the digest at deploy time. `latest` is a convenience for humans, never a deployment reference.',
    },
  ],
  lab: {
    title: 'Prove a tag moves and a digest does not',
    scenario:
      'Use a local registry to publish an image, move its tag to different content, and watch the digest stay honest.',
    prerequisites: ['Docker installed', 'Port 5000 free on localhost'],
    tasks: [
      {
        instruction:
          'Start a local registry: `docker run -d -p 5000:5000 --name registry registry:2`.',
      },
      {
        instruction:
          'Build a tiny image that echoes "v1", tag it `localhost:5000/demo:stable`, and push it.',
      },
      {
        instruction: 'Record the digest reported by the push, and pull by that digest.',
        hint: '`docker image inspect ... --format "{{index .RepoDigests 0}}"`',
      },
      {
        instruction:
          'Build a second image that echoes "v2", tag it with the SAME `:stable` tag, and push it.',
      },
      {
        instruction: 'Pull `:stable` on a clean daemon view and confirm you now get v2.',
        hint: 'Remove the local image first so the pull really happens.',
      },
      {
        instruction: 'Pull the v1 digest you recorded and confirm it still gives v1, unchanged.',
      },
      { instruction: 'Remove the registry container.' },
    ],
    solution: [
      {
        title: 'The whole experiment',
        language: 'bash',
        code: `docker run -d -p 5000:5000 --name registry registry:2

printf 'FROM alpine:3.20\\nCMD ["echo","v1"]\\n' > Dockerfile
docker build -t localhost:5000/demo:stable .
docker push localhost:5000/demo:stable

V1=$(docker image inspect localhost:5000/demo:stable \\
      --format '{{index .RepoDigests 0}}')
echo "v1 digest: $V1"

printf 'FROM alpine:3.20\\nCMD ["echo","v2"]\\n' > Dockerfile
docker build -t localhost:5000/demo:stable .
docker push localhost:5000/demo:stable      # the TAG now points elsewhere

docker rmi localhost:5000/demo:stable
docker run --rm localhost:5000/demo:stable  # v2 - the tag moved

docker run --rm "$V1"                       # v1 - the digest did not`,
      },
    ],
    verification: [
      {
        command: 'docker run --rm localhost:5000/demo:stable',
        what: 'Shows what the tag currently resolves to.',
        expected: 'v2, after the second push.',
      },
      {
        command: 'docker run --rm "$V1"',
        what: 'Shows the digest still resolves to the original content.',
        expected: 'v1, unchanged and unchangeable.',
      },
    ],
    cleanup: [
      {
        command: 'docker rm -f registry 2>/dev/null; rm -f Dockerfile; true',
        what: 'Removes the local registry and the scratch Dockerfile.',
      },
    ],
  },
  relatedTopicIds: ['dk-images-and-layers', 'dk-image-security', 'dk-ci-and-publishing'],
  docs: [
    { title: 'Docker Hub and registries', url: 'https://docs.docker.com/docker-hub/' },
    {
      title: 'OCI image specification',
      url: 'https://github.com/opencontainers/image-spec/blob/main/spec.md',
    },
  ],
}
