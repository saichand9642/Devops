import type { Question } from '../../types'

/** Original practice questions for section 6. */
export const dockerOperationsQuestions: Question[] = [
  {
    id: 'dkq-ops-1',
    domainId: 'dk-operations',
    topicId: 'dk-image-security',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Why does running as root inside a container matter, given the isolation?',
    options: [
      {
        id: 'a',
        text: 'It does not - container root is always mapped to an unprivileged host user',
      },
      { id: 'b', text: 'User namespaces are off by default, so container UID 0 is host UID 0' },
      { id: 'c', text: 'Root containers cannot use volumes' },
      { id: 'd', text: 'Docker refuses to publish ports for root containers' },
    ],
    correct: ['b'],
    explanation:
      'Without user namespace remapping, UID 0 in the container is UID 0 on the host. Docker drops many capabilities by default, which helps, but a non-root USER removes the premise instead of mitigating it - and it is usually two lines of Dockerfile.',
  },
  {
    id: 'dkq-ops-2',
    domainId: 'dk-operations',
    topicId: 'dk-image-security',
    kind: 'multi',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt: 'Which of these meaningfully harden a running container? (Select all that apply.)',
    options: [
      { id: 'a', text: '--user with a non-root UID' },
      { id: 'b', text: '--cap-drop ALL, adding back only what is needed' },
      { id: 'c', text: '--read-only with a tmpfs for writable paths' },
      { id: 'd', text: '--privileged, which enables the security subsystem' },
      { id: 'e', text: '--security-opt no-new-privileges' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    explanation:
      '`--privileged` is the opposite - it removes essentially every restriction and should be treated as equivalent to giving away the host. The other four are cheap, have no performance cost for a well-behaved application, and remove most of what an attacker would inherit.',
  },
  {
    id: 'dkq-ops-3',
    domainId: 'dk-operations',
    topicId: 'dk-image-security',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt: 'What is the practical risk of mounting `/var/run/docker.sock` into a container?',
    options: [
      { id: 'a', text: 'It slows down the container’s I/O' },
      {
        id: 'b',
        text: 'Anything in the container can start a privileged container and reach the whole host',
      },
      { id: 'c', text: 'It exposes the container logs to other containers' },
      { id: 'd', text: 'It prevents the container from being restarted' },
    ],
    correct: ['b'],
    explanation:
      'Access to the Docker socket is effectively host root: a process can create a container with `--privileged` and the host filesystem mounted. In CI, where builds run third-party code, that is a direct path from a compromised dependency to host compromise.',
  },
  {
    id: 'dkq-ops-4',
    domainId: 'dk-operations',
    topicId: 'dk-logging-and-debugging',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'A Docker host ran out of disk. Which default is the most likely cause?',
    options: [
      { id: 'a', text: 'Named volumes have no size limit' },
      { id: 'b', text: 'The json-file logging driver has no default size limit' },
      { id: 'c', text: 'Stopped containers are never removed automatically' },
      { id: 'd', text: 'The build cache is never pruned' },
    ],
    correct: ['b'],
    explanation:
      'All four consume disk, but the json-file driver having no default rotation is the classic cause: one chatty container can produce hundreds of gigabytes. Set `max-size` and `max-file` in `/etc/docker/daemon.json` so no container can do it.',
  },
  {
    id: 'dkq-ops-5',
    domainId: 'dk-operations',
    topicId: 'dk-logging-and-debugging',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What does a HEALTHCHECK give you that container status alone does not?',
    options: [
      { id: 'a', text: 'Automatic restarts when the application fails' },
      {
        id: 'b',
        text: 'The distinction between "the process is running" and "the application works"',
      },
      { id: 'c', text: 'Log rotation for the container' },
      { id: 'd', text: 'Protection against out-of-memory kills' },
    ],
    correct: ['b'],
    explanation:
      'Without a healthcheck, a deadlocked container reports `Up` indefinitely. With one it reports `Up (unhealthy)`, and Compose and orchestrators can act on that. The healthcheck itself does not restart anything - a restart policy or an orchestrator does.',
  },
  {
    id: 'dkq-ops-6',
    domainId: 'dk-operations',
    topicId: 'dk-ci-and-publishing',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Why should deployments not reference `myapp:latest`?',
    options: [
      { id: 'a', text: 'Docker deprecated the latest tag' },
      {
        id: 'b',
        text: 'The tag moves, so nothing records which build is running or what to roll back to',
      },
      { id: 'c', text: 'latest images are always pulled from Docker Hub regardless of registry' },
      { id: 'd', text: 'It prevents multi-architecture images from resolving' },
    ],
    correct: ['b'],
    explanation:
      '`latest` is only the default tag name and it moves on every push. Tag builds with the commit SHA and deploy that, or capture the digest at deploy time - otherwise a rollback becomes an investigation.',
  },
  {
    id: 'dkq-ops-7',
    domainId: 'dk-operations',
    topicId: 'dk-ci-and-publishing',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt: '`docker buildx build --platform linux/amd64,linux/arm64 --load` fails. Why?',
    options: [
      { id: 'a', text: 'QEMU emulation must be installed first' },
      {
        id: 'b',
        text: 'The local image store cannot hold a multi-platform manifest list, so --push is required',
      },
      { id: 'c', text: 'arm64 builds require a native arm64 runner' },
      { id: 'd', text: 'buildx does not support the --load flag at all' },
    ],
    correct: ['b'],
    explanation:
      '`--load` imports a single-platform image into the local store, which has no way to represent a manifest list. Multi-platform builds must be pushed to a registry, or built one platform at a time if you need a local image.',
  },
  {
    id: 'dkq-ops-8',
    domainId: 'dk-operations',
    topicId: 'dk-ci-and-publishing',
    kind: 'command',
    category: 'command',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Which command shows the manifest of the published image `ghcr.io/acme/api:1.0`, including every platform it supports?',
    acceptedAnswers: [
      'docker buildx imagetools inspect ghcr.io/acme/api:1.0',
      'docker manifest inspect ghcr.io/acme/api:1.0',
    ],
    answerHint: 'docker ... inspect ghcr.io/acme/api:1.0',
    explanation:
      '`docker buildx imagetools inspect` reads the manifest straight from the registry without pulling the image, and shows each platform entry in a manifest list along with the digest.',
  },
]
