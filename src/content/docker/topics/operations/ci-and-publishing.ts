import type { Topic } from '../../../types'

export const ciAndPublishing: Topic = {
  id: 'dk-ci-and-publishing',
  title: 'Building and publishing images from CI',
  domainId: 'dk-operations',
  difficulty: 'advanced',
  estimatedMinutes: 17,
  order: 3,
  tags: ['ci', 'buildx', 'multi-arch', 'tagging', 'supply chain'],
  oneLiner:
    'Tag by commit, cache across ephemeral runners, build for more than one architecture, and never put a long-lived registry password in CI.',
  explanation: [
    'A build pipeline has four jobs: produce the image reproducibly, tag it so anybody can trace it back to a commit, get it into a registry, and do all of that without leaking credentials.',
    '**Tagging** is where most pipelines are weakest. An image tagged only `latest` cannot be rolled back to, because nothing records what `latest` meant at deploy time. The pattern that works is to tag every build with the **commit SHA**, add a semantic version on releases, and treat moving tags as convenience labels that are never deployed by name.',
    '**Caching** matters because CI runners are usually ephemeral. A fresh runner has no local layer cache, so every build is effectively `--no-cache` unless you export the cache to a registry and import it on the next run. That one change often halves pipeline time.',
    '**Credentials** should be short-lived. Pushing with a long-lived username and password stored as a CI secret is the common approach and the weakest one; **OIDC federation** - where the CI system proves its identity to the registry and receives a short-lived token - removes the stored secret entirely and is supported by GitHub Actions with ECR, GAR and GHCR.',
  ],
  whyItMatters: [
    'Being unable to answer "which image is running in production and which commit produced it" turns a five-minute rollback into an investigation.',
    'Cache configuration is usually the single largest lever on pipeline duration, and it is a two-line change.',
    'A leaked registry credential lets an attacker publish images your infrastructure will pull and run. It is one of the higher-consequence secrets a pipeline holds.',
  ],
  howItWorks: [
    '**Buildx** is the BuildKit-backed builder. It supports registry cache export, multi-platform builds and build attestations, and it is what `docker build` uses by default in recent versions.',
    '`--cache-to type=registry,mode=max` pushes every layer’s cache, not just the final ones, so a later build can resume from any point. `--cache-from` reads it back.',
    '**Multi-architecture** builds use QEMU emulation or native runners to produce one image per platform, then publish a **manifest list** so a single tag serves both amd64 and arm64.',
    'Tags are cheap - an image can carry several. The commit SHA is the immutable identity; version and channel tags are human conveniences pointing at it.',
    '**Provenance and SBOM attestations** record how an image was built and what is in it. Buildx can generate both, and they are what later supply-chain verification checks against.',
    'With OIDC, the CI job requests a token from its provider, exchanges it with the cloud registry for short-lived credentials, and pushes. Nothing durable is stored anywhere.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'A build pipeline worth having',
      caption:
        'Every stage exists to answer a question later: what is this, where did it come from, is it safe.',
      nodes: [
        {
          label: 'Authenticate with OIDC',
          detail: 'short-lived token - no stored registry password',
          tone: 'success',
        },
        {
          label: 'Build with registry cache',
          detail: 'cache-from and cache-to, so an ephemeral runner is still warm',
          arrowLabel: 'then',
          tone: 'accent',
        },
        {
          label: 'Tag with the commit SHA',
          detail: 'plus version and channel tags as conveniences',
          arrowLabel: 'then',
          tone: 'accent',
        },
        {
          label: 'Scan, and fail on critical findings',
          detail: 'before publishing, not after',
          arrowLabel: 'gate',
          tone: 'warning',
        },
        {
          label: 'Push with provenance and SBOM',
          detail: 'so the image can be verified and audited later',
          arrowLabel: 'publish',
          tone: 'success',
        },
        {
          label: 'Deploy by digest',
          detail: 'the reference that cannot move under you',
          arrowLabel: 'consume',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Buildx build flags',
      purpose: 'The flags that turn a local build into a pipeline build.',
      fields: [
        {
          path: '--platform linux/amd64,linux/arm64',
          meaning: 'Build for several architectures and publish a manifest list.',
        },
        {
          path: '--cache-from type=registry,ref=...',
          meaning: 'Import cache so an ephemeral runner starts warm.',
        },
        {
          path: '--cache-to type=registry,ref=...,mode=max',
          meaning: 'Export cache for every layer, not just the final ones.',
        },
        { path: '--provenance=true', meaning: 'Attach a record of how the image was built.' },
        { path: '--sbom=true', meaning: 'Attach a software bill of materials.' },
        {
          path: '--push',
          meaning: 'Push directly - required for multi-platform, which cannot load locally.',
        },
      ],
    },
    {
      kind: 'Tagging scheme',
      purpose: 'What each tag is for. Only the first is safe to deploy by.',
      fields: [
        { path: 'sha-<commit>', meaning: 'Immutable identity. What deployments should reference.' },
        {
          path: '<major>.<minor>.<patch>',
          meaning: 'Release identity for humans and dependency pins.',
        },
        { path: 'edge / main', meaning: 'Moving channel tag. Convenience only.' },
        { path: 'latest', meaning: 'The default tag. Never deploy by it.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Which build is actually running?',
    story: [
      'A production incident needed a rollback. The deployment referenced `myapp:latest`, and the registry showed twelve pushes that day. Nobody could say which one was running, because the tag had moved eleven times since.',
      'They eventually found it by digest from the container runtime on the host, matched it against the registry, and traced it to a commit - about forty minutes into an outage that a rollback would have ended in two.',
      'The change afterwards was small: tag every build `sha-<commit>`, have the deployment reference that tag, and keep `latest` purely as a human convenience. Rollback became "deploy the previous SHA", and the question "what is running" became a one-line answer instead of an investigation.',
    ],
  },
  yamlExamples: [
    {
      title: 'A GitHub Actions workflow with OIDC, cache and multi-arch',
      language: 'yaml',
      explanation:
        'No stored registry password, cache shared across runs, and one tag that can never move.',
      code: `name: build-and-publish
on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write          # required for OIDC

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3      # for cross-architecture builds
      - uses: docker/setup-buildx-action@v3

      # Short-lived token from the workflow identity - no stored secret
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/\${{ github.repository }}
          tags: |
            type=sha,prefix=sha-,format=long
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}

      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          # Warm cache on an ephemeral runner
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true`,
    },
    {
      title: 'The same thing with plain buildx',
      language: 'bash',
      explanation: 'Useful when the CI system is not GitHub Actions - the mechanics are identical.',
      code: `REG=ghcr.io/acme/api
SHA=$(git rev-parse HEAD)

docker buildx create --use --name ci 2>/dev/null || docker buildx use ci

docker buildx build \\
  --platform linux/amd64,linux/arm64 \\
  --cache-from type=registry,ref=$REG:buildcache \\
  --cache-to   type=registry,ref=$REG:buildcache,mode=max \\
  --provenance=true --sbom=true \\
  -t "$REG:sha-$SHA" \\
  -t "$REG:latest" \\
  --push .

# Capture the digest - this is what the deployment should reference
DIGEST=$(docker buildx imagetools inspect "$REG:sha-$SHA" \\
  --format '{{json .Manifest.Digest}}' | tr -d '"')
echo "deploy $REG@$DIGEST"

# Confirm both architectures are in the manifest list
docker buildx imagetools inspect "$REG:sha-$SHA" | grep -A1 Platform`,
    },
  ],
  imperative: [
    {
      command: 'docker buildx build --platform linux/amd64,linux/arm64 -t <ref> --push .',
      what: 'Builds for two architectures and publishes a manifest list under one tag.',
      placeholders: ['<ref>'],
      namespaceNote: 'Multi-platform builds cannot be loaded locally - --push is required.',
    },
    {
      command: 'docker buildx imagetools inspect <ref>',
      what: 'Shows the manifest list, its platforms and the digest.',
      placeholders: ['<ref>'],
    },
    {
      command: 'echo "$TOKEN" | docker login ghcr.io -u <user> --password-stdin',
      what: 'Authenticates without the credential appearing in the process list or shell history.',
      placeholders: ['<user>'],
    },
  ],
  declarative: {
    steps: [
      'Tag a build with the commit SHA as well as any moving tags.',
      'Add registry cache import and export and compare pipeline duration.',
      'Build for a second architecture and confirm the manifest list contains both.',
      'Capture the digest at build time and deploy by digest rather than by tag.',
    ],
    code: [
      {
        title: 'Proving the cache and the manifest list',
        language: 'bash',
        explanation:
          'The second cold build should be dramatically faster, and the manifest should list both platforms.',
        code: `REG=localhost:5000/demo

# First build on a cold cache
time docker buildx build --cache-to type=registry,ref=$REG:cache,mode=max \\
  -t $REG:sha-aaa --push .

# Simulate a fresh runner - drop everything local
docker buildx prune -af

# Second build imports the cache
time docker buildx build --cache-from type=registry,ref=$REG:cache \\
  -t $REG:sha-bbb --push .
# considerably faster, despite having no local state

# Multi-arch: one tag, two platforms
docker buildx build --platform linux/amd64,linux/arm64 -t $REG:multi --push .
docker buildx imagetools inspect $REG:multi
#   Platform: linux/amd64
#   Platform: linux/arm64`,
      },
    ],
  },
  verification: [
    {
      command: 'docker buildx imagetools inspect <ref> --format "{{json .Manifest.Digest}}"',
      what: 'The immutable digest for a published tag - what deployments should reference.',
      placeholders: ['<ref>'],
    },
    {
      command: 'docker buildx imagetools inspect <ref> | grep -c Platform',
      what: 'Counts the platforms in a manifest list.',
      expected: '2 for an amd64 and arm64 build.',
      placeholders: ['<ref>'],
    },
    {
      command: 'docker image inspect <ref> --format "{{json .Config.Labels}}"',
      what: 'Shows the OCI labels metadata-action added - source repository, revision, created time.',
      placeholders: ['<ref>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker buildx build --platform linux/arm64 -t x . --load',
      what: 'Fails for multi-platform builds - --load supports only one platform. Use --push, or build one platform at a time.',
    },
    {
      command: 'docker buildx ls',
      what: 'Shows builders and their supported platforms. A missing platform means QEMU is not set up.',
    },
    {
      command: 'docker login <registry> 2>&1',
      what: 'A 401 in CI is usually an expired token or a missing permission scope rather than a wrong password.',
      placeholders: ['<registry>'],
    },
  ],
  commonMistakes: [
    'Tagging only `latest`, which makes it impossible to say what is running or to roll back.',
    'Not configuring cache in CI, so every build on an ephemeral runner starts completely cold.',
    'Storing a long-lived registry password as a CI secret when the platform supports OIDC federation.',
    'Passing a credential on the command line, where it appears in process listings and CI logs. Use `--password-stdin`.',
    'Using `--load` with a multi-platform build. The local image store holds one platform, so it fails.',
  ],
  examTips: [
    'Multi-platform builds must be pushed; they cannot be loaded into the local image store.',
    '`mode=max` exports cache for every layer, not only the final ones.',
    'A manifest list is what lets one tag serve several architectures.',
    'The commit SHA tag is the deployable identity; `latest` is a convenience.',
    'OIDC federation removes the stored registry credential entirely.',
  ],
  summary: [
    'Tag every build with its commit SHA and deploy by that or by digest.',
    'Export and import build cache, or every CI build starts cold.',
    'Buildx handles multi-architecture builds and publishes a manifest list.',
    'Prefer short-lived OIDC credentials over a stored registry password.',
    'Attach provenance and an SBOM so the image can be verified and audited later.',
  ],
  practice: [
    {
      id: 'dk-ci-and-publishing-p1',
      level: 'intermediate',
      prompt: 'Why is deploying `myapp:latest` a problem when you need to roll back?',
      answer:
        'Nothing records what `latest` pointed at when the bad version was deployed, and the tag has moved since. There is no earlier reference to roll back to unless the digest was captured at deploy time.',
      explanation:
        'Tag with the commit SHA and deploy that, or capture and deploy the digest. Rollback then becomes "deploy the previous reference" rather than an investigation.',
    },
    {
      id: 'dk-ci-and-publishing-p2',
      level: 'intermediate',
      prompt:
        'Your Dockerfile is well ordered but CI builds still take four minutes every time. Local builds take twenty seconds. Why?',
      answer:
        'CI runners are ephemeral and have no local layer cache, so every build is effectively `--no-cache`. Add `--cache-from` and `--cache-to` against a registry (or the CI provider’s cache backend) so a fresh runner starts warm.',
      explanation:
        '`mode=max` is worth setting - it exports cache for intermediate layers too, so a later build can resume from any point rather than only the end.',
    },
    {
      id: 'dk-ci-and-publishing-p3',
      level: 'intermediate',
      prompt: '`docker buildx build --platform linux/amd64,linux/arm64 --load` fails. Why?',
      answer:
        'The local image store holds one image per tag for one platform, so it cannot represent a manifest list. Multi-platform builds must be pushed to a registry with `--push`, or built one platform at a time if you need a local image.',
      explanation:
        'This is the most common first stumble with multi-arch builds, and the error message is not especially clear about the cause.',
    },
    {
      id: 'dk-ci-and-publishing-p4',
      level: 'advanced',
      prompt:
        'Your pipeline stores a registry username and password as CI secrets. What would you change and why?',
      answer:
        'Move to OIDC federation: the CI job presents a signed identity token to the registry or cloud provider and receives short-lived credentials scoped to that repository and workflow. Nothing durable is stored, so there is no secret to leak, rotate or exfiltrate from a compromised build.',
      explanation:
        'A registry push credential is high value - an attacker who obtains it can publish images your infrastructure will pull and run. Short-lived, workload-bound credentials remove the standing risk rather than managing it.',
    },
  ],
  lab: {
    title: 'Publish an image the way a pipeline should',
    scenario:
      'Build against a local registry with proper tagging, registry cache and a multi-architecture manifest.',
    prerequisites: ['Docker with buildx', 'Port 5000 free', 'A small Dockerfile'],
    tasks: [
      { instruction: 'Start a local registry on port 5000.' },
      {
        instruction:
          'Create a buildx builder and build an image tagged with a fake commit SHA, pushing to the local registry.',
      },
      {
        instruction: 'Add `--cache-to` on that build, then prune the local build cache entirely.',
        hint: '`docker buildx prune -af` simulates a fresh runner.',
      },
      {
        instruction: 'Rebuild with `--cache-from` and compare the duration with the cold build.',
      },
      {
        instruction:
          'Build the same image for `linux/amd64,linux/arm64` and inspect the manifest list.',
      },
      {
        instruction: 'Capture the digest and confirm it resolves independently of the tag.',
      },
      { instruction: 'Remove the registry container.' },
    ],
    solution: [
      {
        title: 'The whole lab',
        language: 'bash',
        code: `docker run -d -p 5000:5000 --name reg registry:2
REG=localhost:5000/demo
printf 'FROM alpine:3.20\\nRUN apk add --no-cache curl\\nCMD ["echo","hi"]\\n' > Dockerfile

docker buildx create --use --name lab --driver docker-container 2>/dev/null || \\
  docker buildx use lab

# Cold build, exporting cache
time docker buildx build \\
  --cache-to type=registry,ref=$REG:cache,mode=max \\
  -t $REG:sha-deadbeef -t $REG:latest --push .

# Simulate a brand-new runner
docker buildx prune -af

# Warm build, importing cache
time docker buildx build \\
  --cache-from type=registry,ref=$REG:cache \\
  -t $REG:sha-cafe1234 --push .

# Multi-architecture
docker buildx build --platform linux/amd64,linux/arm64 \\
  -t $REG:multi --push .
docker buildx imagetools inspect $REG:multi

# Digest: the reference that cannot move
DIGEST=$(docker buildx imagetools inspect $REG:sha-deadbeef \\
  --format '{{json .Manifest.Digest}}' | tr -d '"')
docker run --rm "$REG@$DIGEST"

docker rm -f reg && rm -f Dockerfile`,
      },
    ],
    verification: [
      {
        command: 'docker buildx imagetools inspect localhost:5000/demo:multi | grep -c Platform',
        what: 'Confirms the manifest list contains both architectures.',
        expected: '2',
      },
      {
        command: 'docker buildx imagetools inspect localhost:5000/demo:sha-deadbeef',
        what: 'Shows the digest for the SHA-tagged build.',
        expected: 'A sha256 digest you can deploy by.',
      },
    ],
    cleanup: [
      {
        command:
          'docker rm -f reg 2>/dev/null; docker buildx rm lab 2>/dev/null; rm -f Dockerfile; true',
        what: 'Removes the registry, the builder and the scratch Dockerfile.',
      },
    ],
  },
  relatedTopicIds: ['dk-registries-and-tags', 'dk-image-security', 'dk-build-cache'],
  docs: [
    { title: 'Buildx and BuildKit', url: 'https://docs.docker.com/build/' },
    {
      title: 'Multi-platform builds',
      url: 'https://docs.docker.com/build/building/multi-platform/',
    },
  ],
}
