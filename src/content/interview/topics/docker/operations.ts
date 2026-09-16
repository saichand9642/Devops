import type { InterviewQuestion } from '../../../types'

/** Day-two Docker: registries, cleanup, CI, Swarm and the "why" questions. */
export const dockerOperationsQuestions: InterviewQuestion[] = [
  {
    id: 'itv-docker-43',
    level: 'basic',
    kind: 'open',
    prompt:
      'Your laptop is out of disk space and Docker is the cause. How do you reclaim it safely?',
    probing:
      'Everyday operational hygiene, and whether you know which prune commands are dangerous.',
    answer: [
      'Start with `docker system df`, which breaks the usage down into images, containers, local volumes and build cache. It usually shows one category dominating, and that tells you which command to run.',
      'The safe cleanups are `docker container prune` (removes stopped containers), `docker image prune` (removes dangling untagged images) and `docker builder prune` (removes build cache, which is often the biggest offender on a development machine).',
      'The dangerous one is **`docker volume prune`** - it deletes volumes not currently attached to a container, which includes the database volume of any stack you have stopped. `docker system prune -a --volumes` combines everything including that. Read what it lists before confirming.',
    ],
    code: [
      {
        title: 'Reclaiming space, least to most destructive',
        language: 'bash',
        code: `docker system df                    # where has it actually gone?

docker container prune              # stopped containers - safe
docker image prune                  # dangling images - safe
docker builder prune                # build cache - safe, often the biggest win
docker image prune -a               # ALL unused images - will force re-pulls

docker volume prune                 # DANGEROUS - your stopped database lives here`,
      },
    ],
    traps: [
      'Running `docker system prune -a --volumes` to free space quickly and deleting a development database.',
      'Forgetting the build cache, which on a busy machine is frequently tens of gigabytes.',
    ],
    followUps: ['How would you stop this recurring on a CI runner?'],
    tags: ['cleanup', 'disk', 'operations', 'cli'],
  },
  {
    id: 'itv-docker-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How should images be tagged in a CI/CD pipeline?',
    probing:
      'Release engineering thinking. The answer reveals whether you have debugged a production incident.',
    answer: [
      'Every build should produce an **immutable, traceable tag** - most commonly the **git commit SHA**. That tag is never reused, so an image always corresponds to exactly one commit, and when something breaks in production you can go straight from the running image to the code that produced it.',
      'On top of that, push **moving tags** for convenience: a semantic version like `1.4.2` for releases, and optionally `latest` or `stable` pointing at the current release. These are aliases for humans; the SHA tag is the source of truth.',
      'What you deploy should be the **immutable** reference - ideally the digest. Deploying `latest` means you cannot tell what is running, cannot roll back precisely, and can get different content on two nodes pulling at different times.',
    ],
    code: [
      {
        title: 'Tagging strategy in a pipeline',
        language: 'bash',
        code: `SHA="$(git rev-parse --short HEAD)"
VERSION="$(cat VERSION)"
REPO=registry.example.com/team/api

docker build -t "$REPO:$SHA" .

# Immutable, always
docker push "$REPO:$SHA"

# Moving aliases, only on a release build
if [ "$GIT_REF" = "refs/heads/main" ]; then
  docker tag "$REPO:$SHA" "$REPO:$VERSION"
  docker tag "$REPO:$SHA" "$REPO:latest"
  docker push "$REPO:$VERSION"
  docker push "$REPO:latest"
fi

# Deploy by digest so what you tested is exactly what runs
DIGEST="$(docker inspect --format '{{index .RepoDigests 0}}' "$REPO:$SHA")"
echo "deploying $DIGEST"`,
      },
    ],
    deeper: [
      'Add build metadata as OCI labels - source commit, build time, pipeline URL - so `docker inspect` on a mystery production container tells you where it came from.',
      'Registries can enforce tag immutability. Turning that on for release tags removes a whole class of "someone repushed 1.4.2" incidents.',
      'Retention policies matter: SHA tags accumulate fast, so expire untagged and old SHA images automatically.',
    ],
    traps: [
      'Deploying `latest` and then being unable to say what is in production.',
      'Reusing a version tag for a rebuild, which breaks rollback.',
      'Tagging with a branch name, which changes meaning on every merge.',
    ],
    followUps: [
      'How do you roll back if you only ever pushed `latest`?',
      'How would you trace a running container back to its source commit?',
    ],
    tags: ['ci', 'tagging', 'release', 'registry'],
  },
  {
    id: 'itv-docker-45',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is the difference between `docker stop` and `docker kill`?',
    probing: 'Signal fluency again, from the operator side rather than the Dockerfile side.',
    options: [
      { id: 'a', text: 'They are identical; `kill` is just shorter to type' },
      {
        id: 'b',
        text: '`stop` sends SIGTERM and waits (10s by default) before SIGKILL; `kill` sends SIGKILL immediately',
      },
      { id: 'c', text: '`stop` removes the container as well, `kill` leaves it' },
      { id: 'd', text: '`kill` only works on containers started with `-d`' },
    ],
    correct: ['b'],
    answer: [
      '`docker stop` is the graceful path: it sends **SIGTERM** to PID 1 and waits for the container to exit, up to a grace period that defaults to **10 seconds**. Only if the container is still running after that does it send **SIGKILL**.',
      '`docker kill` skips the courtesy entirely and sends **SIGKILL** straight away (you can choose a different signal with `--signal`). The process gets no chance to finish in-flight requests, flush buffers or close connections.',
      'In production you always want `stop`, and you want the grace period to be longer than your slowest legitimate shutdown. If your service drains connections for 25 seconds, `docker stop --time 30` is the correct call - otherwise you are silently SIGKILLing every deploy.',
    ],
    code: [
      {
        title: 'Give shutdown enough time',
        language: 'bash',
        code: `docker stop --time 30 api     # SIGTERM, wait up to 30s, then SIGKILL
docker kill api               # SIGKILL now
docker kill --signal=HUP api  # some daemons reload config on SIGHUP`,
      },
    ],
    traps: [
      'Leaving the default 10-second grace period on a service that needs longer to drain.',
      'Using `kill` in scripts because it is faster, and losing writes.',
    ],
    followUps: ['How does this relate to `terminationGracePeriodSeconds` on Kubernetes?'],
    tags: ['signals', 'lifecycle', 'cli', 'production'],
  },
  {
    id: 'itv-docker-46',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are Docker restart policies and which would you use in production?',
    probing: 'Whether you have seen a restart loop hide a real bug.',
    answer: [
      'There are four: **`no`** (the default, never restart), **`on-failure[:max]`** (restart only on a non-zero exit, optionally capped), **`always`** (restart whatever happened, including after a daemon restart), and **`unless-stopped`** (like `always`, but a container you stopped manually stays stopped across a reboot).',
      'For a long-running production service, **`unless-stopped`** is usually right: the service comes back after a host reboot, but if an operator deliberately stopped it during an incident it does not silently restart itself.',
      '**`on-failure:5`** is the better choice when you want failures to stay visible. An unbounded `always` policy will cheerfully restart a fundamentally broken container every few seconds forever, which masks the problem and makes the logs almost unreadable.',
      'The thing to understand either way is that **a restart policy is not a fix**. If a container needs restarting regularly, the restart is hiding a bug - a memory leak, an unhandled exception, a dependency that is not being retried properly.',
    ],
    code: [
      {
        title: 'Setting and checking a policy',
        language: 'bash',
        code: `docker run -d --restart=unless-stopped --name api myapi:1.0
docker update --restart=on-failure:5 api        # change it without recreating

# Is something restarting more than it should?
docker inspect api --format '{{.RestartCount}} {{.HostConfig.RestartPolicy.Name}}'`,
      },
    ],
    traps: [
      'Using `always` and never noticing a container has restarted 4,000 times.',
      'Assuming a restart policy applies to a container that exits with code 0 - `on-failure` does not.',
    ],
    followUps: ['How would you alert on a container that is restarting too often?'],
    tags: ['restart', 'reliability', 'production', 'operations'],
  },
  {
    id: 'itv-docker-47',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you scan and secure the images your team ships?',
    probing:
      'Whether you think about supply chain as a pipeline stage rather than a one-off audit.',
    answer: [
      'Scanning has to be **in the pipeline, not a quarterly exercise**. A scanner such as Trivy, Grype or Snyk runs against the built image on every build and fails it on findings above an agreed severity. Scanning only images already in production tells you about problems you have already shipped.',
      'But a scanner mostly finds **known CVEs in packages**, and that is only part of the job. The rest is reducing what there is to find: a minimal base image, multi-stage builds so no compiler ships, pinned base image digests so a rebuild is reproducible, and **secret scanning** so a leaked token is caught before publish.',
      'Beyond that, mature setups add **provenance**: generate an **SBOM** for each image so you can answer "are we affected by this new CVE" in minutes rather than days, and **sign images** (cosign/Sigstore) so the cluster can verify that an image came from your pipeline and not from someone with registry credentials.',
      'The policy point matters as much as the tooling. A scanner that reports 400 medium findings on every build gets ignored within a fortnight. Fail on critical and high with a documented exception path, and track the rest as a backlog rather than a gate.',
    ],
    code: [
      {
        title: 'Scan, SBOM and sign in one pipeline',
        language: 'bash',
        code: `IMAGE="registry.example.com/team/api:$SHA"

# 1. Fail the build on serious, fixable findings
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$IMAGE"

# 2. Catch leaked credentials before they reach the registry
trivy image --scanners secret --exit-code 1 "$IMAGE"

# 3. Record what is inside, for the next CVE announcement
syft "$IMAGE" -o spdx-json > sbom.json

# 4. Sign it so the cluster can verify provenance
cosign sign --yes "$IMAGE"
cosign verify --certificate-identity-regexp '.*' "$IMAGE"`,
        explanation:
          '--ignore-unfixed is the setting that keeps the gate credible: it hides findings you cannot act on.',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Supply-chain checks in the build pipeline',
        caption: 'Each gate fails the build, so nothing unscanned reaches the registry.',
        nodes: [
          { label: 'Build image', tone: 'accent' },
          {
            label: 'Scan for CVEs',
            detail: 'Fail on high/critical, fixable only',
            tone: 'warning',
          },
          { label: 'Scan for secrets', detail: 'Fail on any hit', tone: 'danger' },
          { label: 'Generate SBOM', detail: 'Stored with the artefact' },
          { label: 'Sign the image', detail: 'cosign / Sigstore' },
          { label: 'Push to registry', tone: 'success' },
          { label: 'Cluster verifies signature', detail: 'Admission policy', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Rebuilding regularly matters as much as scanning. Most CVEs in your image come from the base image, and the fix is usually a rebuild on a patched base rather than any change to your code.',
      'Pin base images by digest, then use automation to bump them. Pinning without automation just means you are permanently out of date.',
      'An SBOM turns "are we affected by this new CVE" from a week of investigation into a query.',
    ],
    traps: [
      'Failing builds on every severity, which trains everyone to bypass the gate.',
      'Scanning the image but never rebuilding it, so findings accumulate against an image nobody updates.',
      'Treating a clean scan as "secure". It means no *known* vulnerabilities in *detected* packages.',
    ],
    followUps: [
      'A critical CVE is announced today. How do you find out whether you are affected?',
      'How would you stop an unsigned image from running in your cluster?',
    ],
    tags: ['security', 'scanning', 'supply chain', 'sbom', 'ci'],
  },
  {
    id: 'itv-docker-48',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is the difference between Docker, containerd and runc? Where does the OCI fit?',
    probing:
      'Whether you understand the stack beneath the CLI. It explains why Kubernetes dropped Docker as a runtime.',
    answer: [
      'They are three layers of the same stack. **runc** is the lowest: a small tool that takes a filesystem bundle and a config file and actually creates the container using Linux namespaces and cgroups. It does one thing and then exits.',
      '**containerd** sits above runc as a long-running daemon. It manages the full lifecycle - pulling images, managing storage and networking hooks, supervising running containers - and calls runc to do the actual creation.',
      '**Docker** (the engine) sits above containerd and adds the developer-facing layer: the CLI, image building, Docker Compose, volume and network management, the REST API. Under the hood, `docker run` ends up calling containerd, which calls runc.',
      'The **OCI** - Open Container Initiative - is the set of standards that makes these interchangeable: an **image spec** (what an image looks like) and a **runtime spec** (how to run one). Because of the OCI, an image built by Docker, Podman or Buildah runs on any compliant runtime.',
      'This is the background to Kubernetes removing `dockershim` in 1.24. Kubernetes talks **CRI**, and Docker did not speak it natively, so a shim was required. Since containerd - which Docker already used underneath - speaks CRI directly, the shim was redundant. Nothing about your images changed: they were always OCI images.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'From docker run to a running process',
        caption: 'Kubernetes enters at containerd via CRI, skipping the Docker engine entirely.',
        nodes: [
          { label: 'docker CLI', detail: 'or kubelet, for Kubernetes', tone: 'accent' },
          { label: 'Docker engine', detail: 'build, compose, volumes, API', arrowLabel: 'REST' },
          {
            label: 'containerd',
            detail: 'image pull, lifecycle, supervision',
            arrowLabel: 'gRPC / CRI',
          },
          {
            label: 'runc',
            detail: 'namespaces + cgroups, then exits',
            arrowLabel: 'OCI runtime spec',
          },
          { label: 'Your process', detail: 'An ordinary Linux process, isolated', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Because runc is pluggable, you can swap it for a sandboxed runtime - gVisor for a user-space kernel, or Kata Containers for a lightweight VM - where multi-tenant isolation matters more than startup time.',
      'Podman implements the same OCI specs without a daemon and can run rootless, which is why it appears in security-conscious environments.',
      'The practical takeaway: "Docker images" is a loose phrase. They are OCI images, and that is why the ecosystem interoperates.',
    ],
    traps: [
      'Saying Kubernetes "dropped Docker support" as though images stopped working. Only the runtime shim was removed.',
      'Conflating the Docker CLI, the Docker daemon and the container runtime - they are three different things.',
    ],
    followUps: [
      'Why did removing dockershim not break anyone’s images?',
      'When would you use gVisor or Kata instead of runc?',
    ],
    tags: ['architecture', 'containerd', 'runc', 'oci', 'kubernetes'],
  },
  {
    id: 'itv-docker-49',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A developer says "it works in my container but fails in the pipeline". Same image tag, same commands. How do you find the difference?',
    probing:
      'Systematic differential debugging. The answer should be a method for eliminating variables, not a guess.',
    answer: [
      'Treat it as **finding the variable that differs**, and work through them in order of likelihood rather than guessing.',
      "First, **is it actually the same image?** A tag is mutable and a local cache can be stale. Compare **digests**, not tags - `docker inspect --format '{{index .RepoDigests 0}}'` on both sides. This alone resolves a surprising share of these.",
      'Second, **the environment**: environment variables, mounted files, secrets and the working directory. CI injects things a laptop does not, and often runs as a different user. Dump the environment in both places and diff it.',
      "Third, **the build context**. The developer's machine has untracked files, a populated `node_modules`, a local `.env`; CI has only what is committed. A build that depends on an uncommitted file works locally and fails everywhere else, permanently.",
      'Fourth, **architecture and resources**. An arm64 laptop and an amd64 runner produce different behaviour for native dependencies, and CI runners typically have much less memory - so a test that passes locally gets OOMKilled in the pipeline.',
      'The fastest way to close the loop is to **make the pipeline reproducible locally**: run the exact CI command with the CI environment file and no extra mounts. If it then fails locally, you have the difference in your hands.',
    ],
    code: [
      {
        title: 'Diff the two environments mechanically',
        language: 'bash',
        code: `# 1. Same image, really?
docker inspect --format '{{index .RepoDigests 0}}' myapi:1.4      # locally
docker inspect --format '{{index .RepoDigests 0}}' myapi:1.4      # on the runner

# 2. Same environment?
docker run --rm myapi:1.4 env | sort > /tmp/local.env
# ...run the same on the runner, download the artefact, then:
diff /tmp/local.env /tmp/ci.env

# 3. Same architecture?
docker image inspect myapi:1.4 --format '{{.Os}}/{{.Architecture}}'

# 4. Is anything uncommitted sneaking into the local build?
git status --porcelain
git stash -u && docker build -t myapi:clean . ; git stash pop`,
        explanation:
          'Step 4 is the one that catches "it depends on a file that was never committed".',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Eliminating variables, in order',
        caption: 'Each step removes one class of difference. Stop as soon as one explains it.',
        nodes: [
          { label: 'Compare image digests', detail: 'Tags lie; digests do not', tone: 'accent' },
          { label: 'Diff the environment', detail: 'env vars, mounts, secrets, user' },
          { label: 'Check the build context', detail: 'Uncommitted files, .dockerignore' },
          { label: 'Check arch and resources', detail: 'arm64 vs amd64, memory limits' },
          { label: 'Reproduce CI locally', detail: 'Exact command, CI env file', tone: 'warning' },
          { label: 'Difference found', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'The durable fix is to make the pipeline runnable locally - one script that both CI and a developer invoke, with no hidden steps.',
      'Pinning by digest in the deployment manifest removes the whole "same tag, different content" category permanently.',
      'If CI is the only place with the failure, keeping the workspace after a failed run (or opening a debug shell on the runner) beats adding print statements and pushing again.',
    ],
    traps: [
      'Comparing tags instead of digests and concluding the images are identical.',
      'Adding `--no-cache` as a reflex. It sometimes hides the symptom without explaining it.',
      'Assuming CI is "clean" - it has its own state, especially on a self-hosted runner.',
    ],
    followUps: [
      'How would you make the pipeline reproducible on a laptop?',
      'What would you change so this class of problem cannot recur?',
    ],
    tags: ['scenario', 'troubleshooting', 'ci', 'reproducibility', 'debugging'],
  },
  {
    id: 'itv-docker-50',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is `docker commit`, and why should you almost never use it?',
    probing:
      'Tests whether you hold the line on reproducibility when there is a quick shortcut available.',
    answer: [
      '`docker commit` takes a running container and turns its current filesystem into a new image. It captures whatever state that container happens to be in, including anything you changed by hand.',
      'The reason to avoid it is that the result is **undocumented and unreproducible**. Nobody can tell what is in that image or how to build it again. Six months later the person who ran the commands has left, the image has a CVE, and there is no Dockerfile to rebuild from. It is the container equivalent of editing a server by hand.',
      'The correct workflow is that **every image comes from a Dockerfile in version control**, built by CI. If you fixed something by hand to get a service running, that fix belongs in the Dockerfile before the incident is closed.',
      'It has two legitimate uses: capturing the state of a container for **forensic analysis** after an incident, and occasionally as an exploratory step while you work out what a Dockerfile should say - as a scratchpad, never as an artefact you ship.',
    ],
    code: [
      {
        title: 'The legitimate use: snapshot a container for investigation',
        language: 'bash',
        code: `# A container behaved strangely - preserve it before it is cleaned up
docker commit suspicious-api forensics/api-incident-4821:snapshot
docker save forensics/api-incident-4821:snapshot | gzip > incident-4821.tar.gz

# Then examine it offline, without keeping production waiting
docker run --rm -it --entrypoint sh forensics/api-incident-4821:snapshot`,
      },
    ],
    traps: [
      'Fixing production with `docker exec` plus `docker commit` and never writing it into the Dockerfile.',
      'Assuming the commit captured everything. Volumes are not included - only the container filesystem.',
    ],
    followUps: ['You hotfixed a container at 3am to restore service. What happens next?'],
    tags: ['reproducibility', 'images', 'anti-pattern', 'operations'],
  },
  {
    id: 'itv-docker-51',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `EXPOSE 8080` in a Dockerfile actually do?',
    probing: 'A classic misconception, and quick to check.',
    options: [
      { id: 'a', text: 'It publishes port 8080 so the host can reach the container' },
      {
        id: 'b',
        text: 'It documents the port and is used by `-P`, but publishes nothing on its own',
      },
      { id: 'c', text: 'It opens port 8080 in the host firewall' },
      { id: 'd', text: 'It makes the application listen on 8080' },
    ],
    correct: ['b'],
    answer: [
      '`EXPOSE` is **metadata**. It records in the image that the application is expected to listen on that port, so a human reading `docker inspect` knows, and so `docker run -P` has a list of ports to publish to random host ports.',
      'On its own it publishes nothing. Without `-p` or `-P`, the port is reachable from other containers on the same user-defined network but not from the host.',
      'It also does not make your application listen anywhere. If your app binds to `127.0.0.1` inside the container it is unreachable no matter what `EXPOSE` says - a container must bind `0.0.0.0` to accept traffic from outside its own namespace.',
    ],
    traps: [
      'Adding `EXPOSE` and expecting `curl localhost:8080` on the host to work.',
      'Binding to `127.0.0.1` inside the container, which is the other half of this same confusion.',
    ],
    followUps: ['Your app has `-p 8080:8080` but still refuses connections. What would you check?'],
    tags: ['networking', 'ports', 'dockerfile', 'fundamentals'],
  },
  {
    id: 'itv-docker-52',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is Docker-in-Docker, why is it risky, and what would you use instead in CI?',
    probing:
      'A real CI architecture question. The security angle separates people who have set this up from people who have only used it.',
    answer: [
      'Docker-in-Docker (DinD) runs a full Docker daemon **inside** a container, usually so a CI job running in a container can build images. It requires **`--privileged`**, because a daemon needs to manage cgroups, mounts and networking.',
      'The risk is that `--privileged` effectively **removes the isolation between the container and the host**. Anyone who can influence what runs in that CI job - which, on a shared runner, can include anyone who can open a pull request - has a straightforward path to root on the runner. On a shared runner that means access to other jobs’ secrets and source.',
      'The common alternative, **mounting the host Docker socket** (`-v /var/run/docker.sock:/var/run/docker.sock`), is not safer. Access to the socket is equivalent to root on the host: you can start a container that mounts `/` and read anything.',
      'The modern answer is a **daemonless builder**: **Kaniko**, **Buildah** or **BuildKit in rootless mode** build OCI images without a privileged daemon and without the host socket. In Kubernetes-based CI this is the standard approach. If you must use DinD, isolate it - dedicated ephemeral runners, never shared with untrusted pull requests, and no production credentials in scope.',
    ],
    code: [
      {
        title: 'Kaniko - build and push with no daemon and no privilege',
        language: 'yaml',
        code: `apiVersion: v1
kind: Pod
metadata:
  name: build-api
spec:
  restartPolicy: Never
  containers:
    - name: kaniko
      image: gcr.io/kaniko-project/executor:latest
      args:
        - --context=git://github.com/example/api.git
        - --dockerfile=Dockerfile
        - --destination=registry.example.com/team/api:$(GIT_SHA)
        - --cache=true
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker
      # No privileged, no host socket, no daemon.
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
  volumes:
    - name: docker-config
      secret:
        secretName: registry-credentials`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'How should CI build images?',
        caption: 'The first two options both amount to giving the job root on the runner.',
        question: 'A CI job needs to build a container image',
        branches: [
          {
            condition: 'Docker-in-Docker with --privileged',
            result: 'Effectively root on the runner',
            detail: 'Only on isolated, ephemeral, trusted runners',
            tone: 'danger',
          },
          {
            condition: 'Mounting the host Docker socket',
            result: 'Also root on the host',
            detail: 'Not a safer alternative, despite appearances',
            tone: 'danger',
          },
          {
            condition: 'Kaniko or Buildah',
            result: 'Daemonless, unprivileged build',
            detail: 'The default choice for Kubernetes CI',
            tone: 'success',
          },
          {
            condition: 'Rootless BuildKit',
            result: 'Unprivileged, with full BuildKit features',
            detail: 'Best caching of the safe options',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'DinD also has a practical cost: the inner daemon starts with an empty cache on every job, so builds are slow unless you wire up a remote cache anyway.',
      'If you keep DinD, the mitigation that actually matters is ephemeral single-use runners, so a compromise cannot persist or reach the next job.',
      'Rootless BuildKit gives you `--mount=type=cache` and secret mounts, which Kaniko supports less completely - worth weighing if build time matters.',
    ],
    traps: [
      'Believing socket mounting is a lighter, safer version of DinD. It gives away the same thing.',
      'Running DinD on a shared runner that builds pull requests from forks.',
      'Assuming rootless means unprivileged everywhere - some kernels and storage drivers still need configuration.',
    ],
    followUps: [
      'Why is mounting the Docker socket equivalent to giving away root?',
      'How would you get fast build caching without a privileged daemon?',
    ],
    tags: ['ci', 'security', 'kaniko', 'buildkit', 'privileged'],
  },
]
