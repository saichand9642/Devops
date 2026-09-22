import type { Topic } from '../../../types'

export const composeBasics: Topic = {
  id: 'dk-compose-basics',
  title: 'Describing an application with Compose',
  domainId: 'dk-compose',
  difficulty: 'beginner',
  estimatedMinutes: 16,
  order: 1,
  tags: ['compose', 'services', 'depends_on', 'healthcheck', 'multi-container'],
  oneLiner:
    'One file describing every service, its network and its data - and why depends_on does not mean what people assume.',
  explanation: [
    '**Docker Compose** describes a multi-container application in a single YAML file. Instead of five `docker run` commands with a dozen flags each, you write `compose.yaml` and run `docker compose up`. The file is versioned alongside the code, which means the way the application runs is reviewable.',
    'The core concept is a **service**: one container image plus how to run it. Compose also creates a **network** for the project automatically - a user-defined bridge - so services resolve each other by service name with no extra work. That single default removes the most common multi-container mistake.',
    'Compose is **project-scoped**. Everything it creates is named after the project (the directory name by default), so `docker compose down` removes exactly what `up` created and two projects on one machine do not collide.',
    'The instruction people misread is **`depends_on`**. By default it only controls start **order** - Compose starts the database container before the application container, and that is all. It does not wait for the database to be *ready to accept connections*. Getting readiness requires a healthcheck and `condition: service_healthy`.',
  ],
  whyItMatters: [
    'A Compose file is the fastest honest answer to "how do I run this locally". A repository with one is far easier to join than one with a README full of `docker run` incantations.',
    'The `depends_on` misunderstanding causes a specific, recurring bug: the application starts, tries to connect to a database that is still initialising, and crashes. It then usually works on the second attempt, which makes it look intermittent.',
    'Compose files are also the clearest way to learn the run-time options - ports, volumes, environment, limits - because they are all in one readable place rather than spread across flags.',
  ],
  howItWorks: [
    'Compose reads `compose.yaml` (or `docker-compose.yml`) and derives a **project name** from the directory, overridable with `-p` or `COMPOSE_PROJECT_NAME`.',
    'It creates a default **network** for the project and attaches every service to it. Services reach each other by service name on the **container** port.',
    'It creates any named **volumes** declared in the top-level `volumes:` block, prefixed with the project name.',
    'It starts services in dependency order derived from `depends_on`, then from network and volume references.',
    '`docker compose up` is idempotent: it recreates only the containers whose configuration or image changed, leaving the rest running.',
    '`docker compose down` removes containers and networks. It leaves **named volumes** alone unless you pass `-v` - which is a deliberate safety default that surprises people the first time.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'What docker compose up creates',
      caption:
        'The automatic network is the reason service names resolve. down removes all of it except named volumes.',
      nodes: [
        {
          label: 'Read compose.yaml',
          detail: 'project name comes from the directory unless overridden',
          tone: 'accent',
        },
        {
          label: 'Create the project network',
          detail: 'a user-defined bridge, so service names resolve by DNS',
          arrowLabel: 'first',
          tone: 'success',
        },
        {
          label: 'Create named volumes',
          detail: 'prefixed with the project name; survive down without -v',
          arrowLabel: 'then',
          tone: 'success',
        },
        {
          label: 'Start services in dependency order',
          detail: 'depends_on decides order - not readiness',
          arrowLabel: 'then',
          tone: 'warning',
        },
        {
          label: 'Application running',
          detail: 'reachable on any published ports',
          arrowLabel: 'result',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Why did the app fail on the first start?',
      caption: 'Order is not readiness. A healthcheck plus service_healthy is what closes the gap.',
      question: 'What does depends_on guarantee here?',
      branches: [
        {
          condition: 'Plain depends_on: [db]',
          result: 'Start order only',
          detail: 'the db CONTAINER started - the database may still be initialising',
          tone: 'danger',
        },
        {
          condition: 'depends_on with condition: service_healthy',
          result: 'Waits for the healthcheck to pass',
          detail: 'this is what people think plain depends_on does',
          tone: 'success',
        },
        {
          condition: 'No depends_on at all',
          result: 'No ordering guarantee',
          detail: 'services start in parallel',
          tone: 'warning',
        },
        {
          condition: 'Application retries its own connection',
          result: 'Correct regardless',
          detail: 'the most robust answer - dependencies restart in production too',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Compose service',
      purpose: 'One containerised component of the application, with everything needed to run it.',
      fields: [
        { path: 'image', meaning: 'Image to run. Mutually exclusive with build in practice.' },
        { path: 'build', meaning: 'Build from a Dockerfile instead of pulling.' },
        {
          path: 'ports',
          meaning: 'Published ports, "host:container". Prefix 127.0.0.1: to keep them local.',
        },
        { path: 'environment', meaning: 'Environment variables. env_file loads them from a file.' },
        { path: 'volumes', meaning: 'Named volumes or bind mounts for this service.' },
        { path: 'depends_on', meaning: 'Start order, and with condition, readiness.' },
        { path: 'healthcheck', meaning: 'How Compose decides this service is healthy.' },
        { path: 'restart', meaning: 'Restart policy, as with docker run.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The application that always failed once',
    story: [
      'A team’s Compose stack had an API service with `depends_on: [db]`. On a cold `docker compose up` the API crashed immediately with a connection error, then its restart policy brought it back and everything worked. Nobody investigated, because the second attempt always succeeded.',
      'The cause was exactly the documented behaviour: `depends_on` waits for the database **container** to start, not for Postgres to finish initialising and begin accepting connections. The first connection attempt landed in that gap.',
      'They fixed it twice over, which is the right answer. A healthcheck on the database plus `condition: service_healthy` removed the failure locally. Adding connection retry with backoff in the application removed it everywhere - because in production the database also restarts, fails over and briefly refuses connections, and no orchestrator can wait on that for you.',
    ],
  },
  yamlExamples: [
    {
      title: 'A complete small application',
      language: 'yaml',
      explanation:
        'Three services, one network created automatically, one named volume for the database, and only the web port published.',
      code: `services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Not published - only reachable from inside the project network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  cache:
    image: redis:7-alpine
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      retries: 5

  api:
    build: .
    # Service names resolve on the project network - 'db', not localhost
    environment:
      DATABASE_URL: postgres://postgres:devpassword@db:5432/appdb
      REDIS_URL: redis://cache:6379
    ports:
      - '127.0.0.1:8080:8080'
    depends_on:
      db:
        condition: service_healthy   # WAITS - plain depends_on does not
      cache:
        condition: service_started
    restart: unless-stopped

volumes:
  pgdata:`,
    },
    {
      title: 'The same thing without Compose, for contrast',
      language: 'bash',
      explanation:
        'Everything Compose does for free: the network, the volume, the naming, the ordering. This is why the file is worth writing.',
      code: `docker network create myapp_default
docker volume create myapp_pgdata

docker run -d --name myapp-db-1 --network myapp_default \\
  -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=appdb \\
  -v myapp_pgdata:/var/lib/postgresql/data \\
  --health-cmd 'pg_isready -U postgres' --health-interval 5s \\
  postgres:17

docker run -d --name myapp-cache-1 --network myapp_default redis:7-alpine

# ...and now write a loop that polls the db healthcheck before this one
docker run -d --name myapp-api-1 --network myapp_default \\
  -e DATABASE_URL=postgres://postgres:devpassword@db:5432/appdb \\
  -p 127.0.0.1:8080:8080 --restart unless-stopped myapp:dev`,
    },
  ],
  imperative: [
    {
      command: 'docker compose up -d',
      what: 'Creates the network, volumes and containers, and starts everything in the background.',
      expected: 'Lines reading "Created" and "Started" for each service.',
    },
    {
      command: 'docker compose ps',
      what: 'Shows the services in this project with their state and health.',
    },
    {
      command: 'docker compose logs -f api',
      what: 'Follows the logs of one service.',
    },
    {
      command: 'docker compose down',
      what: 'Removes containers and the network. Keeps named volumes unless you add -v.',
      namespaceNote: '`down -v` deletes your data. It is not reversible.',
    },
  ],
  declarative: {
    steps: [
      'Write a compose.yaml with a database and an application that depends on it.',
      'Start it and watch the application fail because the database is not ready.',
      'Add a healthcheck and `condition: service_healthy`, and watch the failure disappear.',
      'Stop everything and confirm the named volume survived.',
    ],
    code: [
      {
        title: 'Everyday Compose commands',
        language: 'bash',
        explanation:
          'Compose commands are scoped to the project, so they never touch containers from another directory.',
        code: `docker compose up -d                 # start everything
docker compose ps                    # state and health per service
docker compose logs -f --tail 50     # all services, following

docker compose exec api sh           # a shell inside a running service
docker compose run --rm api npm test # a one-off container, removed after

docker compose up -d --build api     # rebuild and recreate just one service
docker compose restart api

docker compose down                  # containers and network - volumes survive
docker compose down -v               # ...and delete the volumes too

docker compose config                # the fully resolved file, after overrides`,
      },
    ],
  },
  verification: [
    {
      command: 'docker compose ps --format "table {{.Service}}\\t{{.Status}}"',
      what: 'Shows health status alongside state - "healthy" only appears with a healthcheck.',
    },
    {
      command: 'docker compose config',
      what: 'Prints the merged, fully interpolated configuration. The fastest way to check what Compose actually read.',
    },
    {
      command: 'docker compose exec api getent hosts db',
      what: 'Confirms service-name DNS on the project network.',
      expected: 'An IP address and the name db.',
    },
  ],
  troubleshooting: [
    {
      command: 'docker compose logs db',
      what: 'The dependency’s own logs usually explain why the dependent service failed.',
    },
    {
      command: 'docker compose config --services',
      what: 'Lists service names as Compose parsed them - catches indentation mistakes.',
    },
    {
      command: 'docker inspect --format "{{json .State.Health}}" <container>',
      what: 'Shows the last healthcheck outputs, which is how you debug a check that never passes.',
      placeholders: ['<container>'],
    },
  ],
  commonMistakes: [
    'Assuming `depends_on` waits for readiness. It waits for the container to start; use a healthcheck with `condition: service_healthy`.',
    'Connecting to `localhost` from one service to another. Use the service name - `localhost` is that container.',
    'Using the published host port between services. Inside the network you use the container port.',
    'Running `docker compose down -v` casually. The `-v` deletes named volumes, and your database with them.',
    'Publishing every service’s port. Only what needs to be reachable from the host should be published.',
  ],
  examTips: [
    'Compose creates a user-defined network per project, which is why service names resolve.',
    '`depends_on` alone is ordering; `condition: service_healthy` is readiness.',
    '`down` keeps named volumes; `down -v` removes them.',
    'Services address each other by service name and container port.',
    '`docker compose config` shows the resolved file after variable interpolation and overrides.',
  ],
  summary: [
    'One file describes every service, and Compose creates the network and volumes for you.',
    'Service names resolve on the project network - no manual network creation needed.',
    '`depends_on` controls order; readiness needs a healthcheck and a condition.',
    'Compose is project-scoped, so `down` removes exactly what `up` created.',
    'Named volumes survive `down` deliberately - `-v` is what deletes them.',
  ],
  practice: [
    {
      id: 'dk-compose-basics-p1',
      level: 'beginner',
      prompt: 'How does the `api` service reach the `db` service in a Compose project?',
      answer:
        'By the service name and the container port - `db:5432`. Compose puts every service on a user-defined network with DNS, so the name resolves to whatever IP the container currently has.',
      explanation:
        'Not `localhost` (that is the api container itself) and not the published host port (that is for traffic from outside).',
    },
    {
      id: 'dk-compose-basics-p2',
      level: 'intermediate',
      prompt:
        'Your API crashes on the first `docker compose up` but works after its restart. `depends_on: [db]` is set. Why?',
      answer:
        'Plain `depends_on` only waits for the db container to start, not for Postgres to finish initialising and accept connections. The first connection lands in that window. Add a healthcheck to db and `depends_on: {db: {condition: service_healthy}}`.',
      explanation:
        'Also add connection retry to the application - in production the database restarts and fails over, and nothing can wait on that for you.',
    },
    {
      id: 'dk-compose-basics-p3',
      level: 'intermediate',
      prompt: 'What is the difference between `docker compose down` and `docker compose down -v`?',
      answer:
        'Both remove the containers and the project network. `-v` additionally removes the named volumes declared in the file - which for a database means deleting the data.',
      explanation:
        'The default is deliberately safe. `-v` is for resetting a development environment on purpose, and it is worth saying out loud before you run it.',
    },
    {
      id: 'dk-compose-basics-p4',
      level: 'advanced',
      prompt:
        'Two developers run the same Compose file in differently named directories and get separate stacks. One renames their directory and their data seems to vanish. Explain.',
      answer:
        'The project name defaults to the directory name, and every resource is prefixed with it - including named volumes. Renaming the directory changes the project name, so Compose creates a new set of volumes and the old ones are orphaned rather than deleted.',
      explanation:
        'Set `name:` at the top of the Compose file, or `COMPOSE_PROJECT_NAME`, to decouple the project identity from the directory. The old volumes are still there under the previous prefix and can be recovered.',
    },
  ],
  lab: {
    title: 'Build a two-service stack, and fix the readiness bug',
    scenario:
      'Write a Compose file with a database and a client, reproduce the start-order problem, then fix it with a healthcheck.',
    prerequisites: ['Docker with the Compose plugin', 'An empty directory'],
    tasks: [
      {
        instruction:
          'Write a compose.yaml with a `db` service using `postgres:17` and a named volume, and a `client` service that tries to connect immediately.',
        hint: 'The client can be `postgres:17` running `psql`, so you need no application code.',
      },
      { instruction: 'Run `docker compose up` and observe the client failing to connect.' },
      {
        instruction: 'Add a healthcheck to `db` using `pg_isready`.',
      },
      {
        instruction:
          'Change the client to `depends_on` db with `condition: service_healthy` and run again.',
      },
      {
        instruction: 'Confirm with `docker compose ps` that db reports healthy.',
      },
      {
        instruction:
          'Run `docker compose down`, then `up` again, and confirm the database data survived.',
      },
    ],
    solution: [
      {
        title: 'compose.yaml, before and after',
        language: 'yaml',
        code: `# --- before: client races the database ---
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: lab
    volumes:
      - pgdata:/var/lib/postgresql/data

  client:
    image: postgres:17
    depends_on: [db]          # ORDER ONLY - this is the bug
    command: >-
      psql postgresql://postgres:lab@db:5432/postgres -c 'select 1'

volumes:
  pgdata:

# --- after: client waits for readiness ---
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: lab
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 3s
      timeout: 3s
      retries: 10
      start_period: 5s

  client:
    image: postgres:17
    depends_on:
      db:
        condition: service_healthy
    command: >-
      psql postgresql://postgres:lab@db:5432/postgres -c 'select 1'

volumes:
  pgdata:`,
      },
      {
        title: 'Running it',
        language: 'bash',
        code: `docker compose up            # before: client exits with a connection error
docker compose down

# ...add the healthcheck and the condition...

docker compose up            # after: client waits, then prints ?column? 1
docker compose ps            # db shows (healthy)

# Data survives down without -v
docker compose exec -T db psql -U postgres -c 'create table t(x int)'
docker compose down
docker compose up -d
docker compose exec -T db psql -U postgres -c '\\dt'   # table t is still there

docker compose down -v       # now the data is gone`,
      },
    ],
    verification: [
      {
        command: 'docker compose ps --format "table {{.Service}}\\t{{.Status}}"',
        what: 'Confirms the healthcheck is reporting.',
        expected: 'db shows Up (healthy).',
      },
      {
        command: 'docker compose logs client',
        what: 'Shows whether the query succeeded.',
        expected: 'A result row rather than a connection error.',
      },
    ],
    cleanup: [
      { command: 'docker compose down -v', what: 'Removes the containers, network and volumes.' },
    ],
  },
  relatedTopicIds: ['dk-networking-and-ports', 'dk-volumes-and-mounts', 'dk-compose-production'],
  docs: [
    { title: 'Docker Compose overview', url: 'https://docs.docker.com/compose/' },
    { title: 'Compose file reference', url: 'https://docs.docker.com/reference/compose-file/' },
  ],
}
