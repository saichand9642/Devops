import type { Question } from '../../types'

/** Original practice questions for section 4. */
export const dockerDataQuestions: Question[] = [
  {
    id: 'dkq-dat-1',
    domainId: 'dk-data',
    topicId: 'dk-volumes-and-mounts',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Where should a database container keep its data?',
    options: [
      { id: 'a', text: 'In the container writable layer - it survives restarts' },
      { id: 'b', text: 'In a named volume' },
      { id: 'c', text: 'In a tmpfs mount for speed' },
      { id: 'd', text: 'In the image, added with COPY at build time' },
    ],
    correct: ['b'],
    explanation:
      'The writable layer survives a restart but is deleted by `docker rm`, which is why "it has been fine for months" is never evidence of persistence. A named volume has its own lifecycle and outlives the container. tmpfs is memory-backed and vanishes entirely.',
  },
  {
    id: 'dkq-dat-2',
    domainId: 'dk-data',
    topicId: 'dk-volumes-and-mounts',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Bind-mounting an empty host directory over `/etc/nginx` breaks nginx, but an empty named volume does not. Why?',
    options: [
      { id: 'a', text: 'Named volumes are read-only by default' },
      {
        id: 'b',
        text: 'An empty named volume is populated with the image content on first use; a bind mount never copies anything',
      },
      { id: 'c', text: 'Bind mounts cannot be used on configuration directories' },
      { id: 'd', text: 'nginx refuses to start when SELinux labels are missing' },
    ],
    correct: ['b'],
    explanation:
      'This asymmetry surprises nearly everyone once. Docker copies the image content into an empty named volume the first time it is mounted. A bind mount replaces the path entirely, so an empty host directory hides whatever the image had there.',
  },
  {
    id: 'dkq-dat-3',
    domainId: 'dk-data',
    topicId: 'dk-volumes-and-mounts',
    kind: 'multi',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which statements about `docker rm` and volumes are correct? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Removing a container deletes its writable layer' },
      { id: 'b', text: 'Removing a container also deletes its named volumes by default' },
      { id: 'c', text: '`docker rm -v` removes anonymous volumes attached to the container' },
      { id: 'd', text: '`docker volume prune` deletes volumes no container references' },
    ],
    correct: ['a', 'c', 'd'],
    explanation:
      'Named volumes deliberately survive container removal - that is the point of them. `docker rm -v` removes anonymous volumes, and `docker volume prune` removes unused ones, which is irreversible and worth checking before running.',
  },
  {
    id: 'dkq-dat-4',
    domainId: 'dk-data',
    topicId: 'dk-networking-and-ports',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What does `EXPOSE 3000` in a Dockerfile do at run time?',
    options: [
      { id: 'a', text: 'Publishes port 3000 on the host' },
      { id: 'b', text: 'Nothing directly - it is metadata that documents the listening port' },
      { id: 'c', text: 'Opens port 3000 in the host firewall' },
      { id: 'd', text: 'Makes port 3000 reachable from other containers' },
    ],
    correct: ['b'],
    explanation:
      'EXPOSE records intent so tooling (and `docker run -P`) can act on it. Only `-p` binds a host port. Containers on the same user-defined network can already reach each other on any port without EXPOSE.',
  },
  {
    id: 'dkq-dat-5',
    domainId: 'dk-data',
    topicId: 'dk-networking-and-ports',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Two containers on the default bridge network cannot reach each other by name. What is the fix?',
    options: [
      { id: 'a', text: 'Add EXPOSE to both Dockerfiles' },
      { id: 'b', text: 'Publish both containers’ ports with -p' },
      { id: 'c', text: 'Create a user-defined network and attach both containers to it' },
      { id: 'd', text: 'Use --link, which is the supported mechanism' },
    ],
    correct: ['c'],
    explanation:
      'The default bridge provides no DNS between containers - only user-defined networks run the embedded resolver at 127.0.0.11. This is why every guide starts with `docker network create`, and why Compose creates one automatically.',
  },
  {
    id: 'dkq-dat-6',
    domainId: 'dk-data',
    topicId: 'dk-networking-and-ports',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A container is published with `-p 8080:80` and running, but connections are refused. Inside, the process listens on 127.0.0.1:80. What is wrong?',
    options: [
      { id: 'a', text: 'The published port mapping is reversed' },
      { id: 'b', text: 'The application must listen on 0.0.0.0 to accept forwarded traffic' },
      { id: 'c', text: 'Port 80 requires the NET_BIND_SERVICE capability' },
      { id: 'd', text: 'The container needs to be on a user-defined network' },
    ],
    correct: ['b'],
    explanation:
      'Forwarded traffic arrives on the container’s eth0, not on its loopback. A process bound to 127.0.0.1 accepts only connections originating inside the container, so it refuses everything - however correct the `-p` flag is.',
  },
  {
    id: 'dkq-dat-7',
    domainId: 'dk-data',
    topicId: 'dk-networking-and-ports',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which command creates a user-defined bridge network named `appnet` so containers on it can resolve each other by name?',
    acceptedAnswers: [
      'docker network create appnet',
      'docker network create -d bridge appnet',
      'docker network create --driver bridge appnet',
    ],
    answerHint: 'docker network ... appnet',
    explanation:
      'The bridge driver is the default, so no `-d` is needed. Any user-defined bridge gets Docker’s embedded DNS server, which is the difference from the built-in `bridge` network.',
  },
]
