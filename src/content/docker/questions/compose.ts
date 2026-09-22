import type { Question } from '../../types'

/** Original practice questions for section 5. */
export const dockerComposeQuestions: Question[] = [
  {
    id: 'dkq-cmp-1',
    domainId: 'dk-compose',
    topicId: 'dk-compose-basics',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'How does an `api` service reach a `db` service in the same Compose project?',
    options: [
      { id: 'a', text: 'localhost:5432' },
      { id: 'b', text: 'db:5432, using the service name and the container port' },
      { id: 'c', text: 'The published host port, e.g. 127.0.0.1:5432' },
      { id: 'd', text: 'The container IP address, which must be looked up first' },
    ],
    correct: ['b'],
    explanation:
      'Compose creates a user-defined network per project, so service names resolve by DNS. `localhost` is the api container itself, and the published port is only for traffic arriving from outside the host.',
  },
  {
    id: 'dkq-cmp-2',
    domainId: 'dk-compose',
    topicId: 'dk-compose-basics',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Your API crashes on the first `docker compose up` but works after restarting, despite `depends_on: [db]`. What is the correct fix?',
    options: [
      { id: 'a', text: 'Add a longer start_period to the API service' },
      {
        id: 'b',
        text: 'Add a healthcheck to db and use depends_on with condition: service_healthy',
      },
      { id: 'c', text: 'Reverse the order of the services in the file' },
      { id: 'd', text: 'Put both services on separate networks' },
    ],
    correct: ['b'],
    explanation:
      'Plain `depends_on` guarantees start order, not readiness - the db container has started, but Postgres may still be initialising. A healthcheck plus `condition: service_healthy` closes the gap. Connection retry in the application is worth adding too, since production dependencies also restart.',
  },
  {
    id: 'dkq-cmp-3',
    domainId: 'dk-compose',
    topicId: 'dk-compose-basics',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What is the difference between `docker compose down` and `docker compose down -v`?',
    options: [
      { id: 'a', text: 'There is none; -v only adds verbose output' },
      { id: 'b', text: '-v additionally removes the named volumes, deleting their data' },
      { id: 'c', text: '-v removes the images as well as the containers' },
      { id: 'd', text: 'down stops containers; down -v also stops them and the network' },
    ],
    correct: ['b'],
    explanation:
      'Both remove containers and the project network. `-v` also deletes named volumes - which for a database means deleting the data. The default is deliberately safe, and `-v` is worth saying out loud before running.',
  },
  {
    id: 'dkq-cmp-4',
    domainId: 'dk-compose',
    topicId: 'dk-compose-production',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Running `docker compose -f compose.yaml -f compose.prod.yaml up` loses your development bind mounts. Why?',
    options: [
      { id: 'a', text: 'Production overrides always remove volumes' },
      {
        id: 'b',
        text: 'An explicit -f list disables the automatic pickup of compose.override.yaml',
      },
      { id: 'c', text: 'Bind mounts cannot be used with multiple files' },
      { id: 'd', text: 'The files were merged in the wrong order' },
    ],
    correct: ['b'],
    explanation:
      '`compose.override.yaml` is merged automatically only when no `-f` is given. This is exactly why the pattern works: development is the effortless default, and production requires an explicit, visible command.',
  },
  {
    id: 'dkq-cmp-5',
    domainId: 'dk-compose',
    topicId: 'dk-compose-production',
    kind: 'multi',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt: 'Which are true about variables in Compose? (Select all that apply.)',
    options: [
      { id: 'a', text: '.env values are interpolated into the Compose file itself' },
      { id: 'b', text: 'env_file values are passed into the container environment' },
      { id: 'c', text: '.env values are automatically available inside every container' },
      { id: 'd', text: '${VAR:-default} supplies a fallback when VAR is unset' },
      { id: 'e', text: 'An unset variable causes Compose to abort with an error' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'The two mechanisms look similar and do different things, which is a recurring source of confusion. An unset variable interpolates to an empty string with a warning rather than failing, which is why `${VAR:-default}` is worth using.',
  },
  {
    id: 'dkq-cmp-6',
    domainId: 'dk-compose',
    topicId: 'dk-compose-production',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which command prints the fully merged and interpolated Compose configuration without starting anything?',
    acceptedAnswers: ['docker compose config', 'docker-compose config'],
    answerHint: 'docker compose ...',
    explanation:
      '`config` is the authoritative view of what Compose actually read - after file merging, variable interpolation and profile filtering. It settles almost every "why is it doing that" question in seconds.',
  },
  {
    id: 'dkq-cmp-7',
    domainId: 'dk-compose',
    topicId: 'dk-compose-production',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt: 'Which requirement is the clearest signal that Compose is no longer the right tool?',
    options: [
      { id: 'a', text: 'More than three services in the file' },
      { id: 'b', text: 'Zero-downtime deploys or scheduling across several hosts' },
      { id: 'c', text: 'A need for named volumes' },
      { id: 'd', text: 'Using more than one environment' },
    ],
    correct: ['b'],
    explanation:
      'Compose has no rolling update and schedules nothing across machines. Service count, volumes and multiple environments are all comfortably within its scope - overrides and profiles exist for the last one.',
  },
]
