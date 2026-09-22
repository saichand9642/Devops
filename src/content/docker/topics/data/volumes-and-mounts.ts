import type { Topic } from '../../../types'

export const volumesAndMounts: Topic = {
  id: 'dk-volumes-and-mounts',
  title: 'Volumes, bind mounts and tmpfs',
  domainId: 'dk-data',
  difficulty: 'intermediate',
  estimatedMinutes: 16,
  order: 1,
  tags: ['volumes', 'bind mounts', 'tmpfs', 'persistence', 'storage'],
  oneLiner:
    'Three ways to put data outside the writable layer, and the rule for choosing between them.',
  explanation: [
    'Everything a container writes goes to its writable layer, which is deleted when the container is removed. Anything that must survive a container - a database, uploaded files, a cache you want to keep - has to live somewhere else. Docker offers three somewhere-elses.',
    'A **named volume** is storage Docker manages, stored under its own directory on the host. You refer to it by name and never care where it physically lives. This is the default choice for application data: it survives container removal, it can be backed up and inspected through Docker, and on production hosts it can be backed by a driver that points at network storage.',
    'A **bind mount** maps a specific host path into the container. You control exactly where the data is, which is why it is perfect for development - mount your source directory and edits appear instantly without rebuilding. It is also the least portable option, because the container now depends on the host’s directory layout and permissions.',
    'A **tmpfs mount** is memory-backed and never touches disk. Use it for scratch space and for secrets you do not want written anywhere persistent. It disappears with the container and counts against the container’s memory limit.',
  ],
  whyItMatters: [
    'Losing data because it was in a container’s writable layer is one of the most common and most avoidable container incidents.',
    'Bind-mounting source code is what makes container-based development pleasant; using a bind mount in production is what makes deployment brittle.',
    'Knowing that a volume mounted over a non-empty image directory copies the image content in on first use - but only for named volumes, and only when the volume is empty - explains a whole class of confusing "my files disappeared" reports.',
  ],
  howItWorks: [
    'A mount replaces whatever was at that path inside the container. Reads and writes go to the mount, not to the image layer beneath it.',
    'For an **empty named volume** mounted over a path that has content in the image, Docker copies the image content into the volume the first time. This is why `-v pgdata:/var/lib/postgresql/data` works on a fresh database.',
    'For a **bind mount**, no copying ever happens. The host directory wins, so mounting an empty host directory over a populated image path makes the image content invisible.',
    'Volumes have a lifecycle independent of containers. Removing a container leaves its volumes behind unless you pass `-v` to `docker rm`; `docker volume prune` removes unused ones.',
    'The modern syntax is `--mount type=volume,source=name,target=/path`, which is explicit and fails loudly on a typo. The older `-v name:/path` is shorter and silently creates things you did not intend.',
    'Mount options matter: `:ro` makes it read-only, and on SELinux hosts `:z` or `:Z` relabels the host directory so the container can read it at all.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'Which kind of mount does this data need?',
      caption: 'Named volumes for data you keep, bind mounts for development, tmpfs for secrets.',
      question: 'What is being stored, and who needs to see it?',
      branches: [
        {
          condition: 'Application data that must survive the container',
          result: 'Named volume',
          detail: 'Docker-managed, portable, backup-able, works the same everywhere',
          tone: 'success',
        },
        {
          condition: 'Source code you are editing right now',
          result: 'Bind mount',
          detail: 'host path into the container - edits appear without a rebuild',
          tone: 'accent',
        },
        {
          condition: 'A secret or scratch space that must not hit disk',
          result: 'tmpfs',
          detail: 'memory-backed, vanishes with the container, counts against its memory limit',
          tone: 'accent',
        },
        {
          condition: 'Nothing needs to outlive the container',
          result: 'No mount at all',
          detail: 'the writable layer is fine, and simpler',
          tone: 'muted',
        },
      ],
    },
    {
      kind: 'nested',
      title: 'Where each kind of storage actually lives',
      caption:
        'Only the writable layer dies with the container. Everything else outlives it by design.',
      root: {
        label: 'Docker host',
        detail: 'one machine',
        children: [
          {
            label: 'Container',
            detail: 'sees one merged filesystem',
            children: [
              {
                label: 'Writable layer',
                detail: 'deleted on docker rm - never put data here',
                tone: 'danger',
              },
              {
                label: 'tmpfs at /run/secrets',
                detail: 'in memory only, never written to disk',
                tone: 'accent',
              },
            ],
          },
          {
            label: 'Named volume, managed by Docker',
            detail: 'survives docker rm - the default for application data',
            tone: 'success',
          },
          {
            label: 'Host directory, bind-mounted',
            detail: 'you control the path - ideal for source code in development',
            tone: 'accent',
          },
        ],
      },
    },
  ],
  keyObjects: [
    {
      kind: 'Mount types',
      purpose: 'The three ways data reaches a container from outside its writable layer.',
      fields: [
        { path: 'type=volume', meaning: 'Docker-managed named storage. Survives the container.' },
        { path: 'type=bind', meaning: 'A specific host path. No copy-in behaviour, ever.' },
        { path: 'type=tmpfs', meaning: 'Memory-backed. Never written to disk.' },
        { path: 'readonly', meaning: 'Mount read-only. Use for configuration and secrets.' },
        { path: 'volume-driver', meaning: 'Plugin backing the volume - NFS, cloud block storage.' },
      ],
    },
    {
      kind: 'Volume',
      purpose: 'A first-class Docker object with its own lifecycle, independent of any container.',
      fields: [
        { path: 'Name', meaning: 'How you refer to it. An unnamed volume gets a random hash.' },
        { path: 'Mountpoint', meaning: 'Where it lives on the host. Do not depend on this path.' },
        { path: 'Driver', meaning: 'local by default; plugins provide networked storage.' },
        { path: 'Labels', meaning: 'Metadata, useful for filtering during pruning and backup.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The database that was rebuilt away',
    story: [
      'A team ran Postgres in a container for a staging environment, with no volume. It worked for months, because nobody ever removed the container - they only restarted it, and a restart keeps the writable layer.',
      'Then a deploy script was changed to `docker rm -f postgres && docker run ...` so it would pick up a new image tag. The first run of the new script destroyed several months of staging data, and nobody noticed for two days because the application recreated its schema on start-up and simply had no rows.',
      'The fix was one flag - `-v pgdata:/var/lib/postgresql/data` - plus a `docker volume` backup in the nightly job. The deeper lesson was that "it has been fine for months" was never evidence of persistence; it was evidence that nobody had removed the container yet.',
    ],
  },
  yamlExamples: [
    {
      title: 'The three mount types, side by side',
      language: 'bash',
      explanation:
        'The --mount syntax is verbose on purpose - it fails on a typo instead of silently creating an empty volume.',
      code: `# Named volume: application data that must survive
docker run -d --name db \\
  --mount type=volume,source=pgdata,target=/var/lib/postgresql/data \\
  -e POSTGRES_PASSWORD_FILE=/run/secrets/pg \\
  --mount type=tmpfs,target=/run/secrets,tmpfs-mode=0400 \\
  postgres:17

# Bind mount: live source code in development, read-only config
docker run -d --name dev \\
  --mount type=bind,source="$(pwd)"/src,target=/app/src \\
  --mount type=bind,source="$(pwd)"/config.yaml,target=/app/config.yaml,readonly \\
  myapp:dev

# The short form does the same thing, and hides the mistakes
docker run -v pgdata:/var/lib/postgresql/data postgres:17   # named volume
docker run -v /host/path:/in/container myapp                # bind mount
docker run -v /in/container myapp                           # ANONYMOUS volume`,
    },
    {
      title: 'Backing up and restoring a named volume',
      language: 'bash',
      explanation:
        'A volume has no backup command of its own. The idiom is a throwaway container that mounts both the volume and a host directory.',
      code: `# Back up: mount the volume plus a host directory, tar one into the other
docker run --rm \\
  -v pgdata:/data:ro \\
  -v "$(pwd)":/backup \\
  alpine tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .

# Restore into a fresh volume
docker volume create pgdata-restored
docker run --rm \\
  -v pgdata-restored:/data \\
  -v "$(pwd)":/backup \\
  alpine sh -c 'tar xzf /backup/pgdata-2026-09-22.tar.gz -C /data'

# Stop the database before backing up a live one, or use its own dump tool
docker exec db pg_dump -U postgres appdb > appdb.sql`,
    },
  ],
  imperative: [
    {
      command: 'docker volume create appdata',
      what: 'Creates a named volume explicitly.',
    },
    {
      command: 'docker volume ls',
      what: 'Lists volumes. Long hex names are anonymous volumes nobody meant to create.',
    },
    {
      command: 'docker volume inspect appdata',
      what: 'Shows the driver and the host mountpoint.',
    },
    {
      command: 'docker volume prune',
      what: 'Removes volumes no container references. Irreversible - check first.',
      namespaceNote: 'Add --filter label!=keep to protect volumes you have labelled.',
    },
  ],
  declarative: {
    steps: [
      'Run a container with a named volume and write data into it.',
      'Remove the container and confirm the volume and its data remain.',
      'Start a new container on the same volume and read the data back.',
      'Repeat with no volume and watch the data disappear.',
    ],
    code: [
      {
        title: 'Proving persistence, and its absence',
        language: 'bash',
        explanation:
          'The same sequence with and without a volume. The difference is the whole topic.',
        code: `# With a named volume - data outlives the container
docker volume create demo
docker run --rm -v demo:/data alpine sh -c 'echo "important" > /data/file'
docker run --rm -v demo:/data alpine cat /data/file
# important

# Without - the writable layer goes with the container
docker run --rm alpine sh -c 'echo "important" > /data/file' 2>/dev/null || \\
  docker run --rm alpine sh -c 'mkdir -p /data && echo important > /data/file'
docker run --rm alpine cat /data/file 2>&1
# cat: can't open '/data/file': No such file or directory

# Copy-in behaviour: an EMPTY named volume takes the image content
docker run --rm -v fresh:/etc/nginx nginx:1.27 ls /etc/nginx | head -3
docker run --rm -v fresh:/etc/nginx alpine ls /etc/nginx | head -3   # still there

# A bind mount NEVER copies in - an empty host dir hides the image content
mkdir -p /tmp/empty
docker run --rm -v /tmp/empty:/etc/nginx nginx:1.27 ls /etc/nginx    # nothing

docker volume rm demo fresh`,
      },
    ],
  },
  verification: [
    {
      command: 'docker inspect -f "{{json .Mounts}}" <container>',
      what: 'Shows every mount, its type, source and whether it is read-only.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker volume ls --filter dangling=true',
      what: 'Lists volumes no container is using - often data somebody forgot about.',
    },
    {
      command: 'docker system df -v',
      what: 'Shows volume sizes, which is how you find the one consuming the disk.',
    },
  ],
  troubleshooting: [
    {
      command: 'docker exec <container> ls -la <path>',
      what: 'An empty directory where you expected image content means a bind mount hid it.',
      placeholders: ['<container>', '<path>'],
    },
    {
      command: 'docker exec <container> touch <path>/probe',
      what: 'A permission error points at a UID mismatch between the host directory and the container user.',
      placeholders: ['<container>', '<path>'],
    },
    {
      command: 'docker run --rm -v <volume>:/x alpine ls -la /x',
      what: 'Inspects a volume’s contents without starting the real application.',
      placeholders: ['<volume>'],
    },
  ],
  commonMistakes: [
    'Storing database data in the writable layer. It survives restarts, which makes it look fine until the first `docker rm`.',
    'Bind-mounting an empty host directory over a populated image path and concluding the image is broken. Bind mounts never copy in.',
    'Creating anonymous volumes with `-v /path` and accumulating hundreds of unnamed ones nobody can identify.',
    'Using bind mounts in production, which couples the container to a host directory layout and breaks portability.',
    'Running `docker volume prune` without checking. It deletes data, and there is no undo.',
  ],
  examTips: [
    'A named volume is Docker-managed; a bind mount is a host path you choose; tmpfs is memory only.',
    'An empty named volume copies the image content in on first use. A bind mount never does.',
    'Removing a container does not remove its named volumes - `docker rm -v` does.',
    'Add `:ro` for configuration and secrets so a compromised container cannot rewrite them.',
    '`-v /path` with no source creates an anonymous volume, which is almost never what you wanted.',
  ],
  summary: [
    'The writable layer dies with the container; anything that must survive needs a mount.',
    'Named volumes are the default for application data - portable and Docker-managed.',
    'Bind mounts are for development, where controlling the exact host path is the point.',
    'tmpfs keeps secrets and scratch data off disk entirely.',
    'Volumes outlive containers, which is both the feature and the reason they accumulate.',
  ],
  practice: [
    {
      id: 'dk-volumes-and-mounts-p1',
      level: 'beginner',
      prompt:
        'You restart a database container and the data is still there, so you conclude it is persistent. Why is that wrong?',
      answer:
        'A restart reuses the same container and therefore the same writable layer. The data is not persistent - it is merely undisturbed. The first `docker rm` destroys it.',
      explanation:
        'Persistence is about surviving container removal, not container restart. Test it by removing the container and starting a fresh one.',
    },
    {
      id: 'dk-volumes-and-mounts-p2',
      level: 'intermediate',
      prompt:
        'You bind-mount an empty host directory over `/etc/nginx` and nginx fails to start. With a named volume it works. Why?',
      answer:
        'An empty **named volume** is populated with the image content the first time it is mounted. A **bind mount** never copies anything - the host directory replaces the path entirely, so nginx finds no configuration.',
      explanation:
        'This asymmetry surprises almost everyone once. If you need the image content on the host, copy it out first with `docker cp`.',
    },
    {
      id: 'dk-volumes-and-mounts-p3',
      level: 'intermediate',
      prompt: 'Why might a bind-mounted directory be unwritable from inside the container?',
      answer:
        'The container process runs as a specific UID, and the host directory is owned by a different one. The kernel checks numeric UIDs, not names, so a `node` user inside the container is simply UID 1000 to the host. On SELinux systems the label also matters, which is what `:z` and `:Z` fix.',
      explanation:
        'Fixes: run the container with `--user "$(id -u):$(id -g)"`, chown the host directory to the container UID, or use a named volume where Docker handles it.',
    },
    {
      id: 'dk-volumes-and-mounts-p4',
      level: 'advanced',
      prompt: 'How would you back up a named volume used by a running database?',
      answer:
        'Do not tar the volume from underneath a running database - you get a torn, possibly unusable copy. Either stop the container first and tar the volume with a throwaway helper container, or better, use the database’s own consistent dump tool, such as `docker exec db pg_dump`, which produces a coherent snapshot without downtime.',
      explanation:
        'Filesystem-level volume backups are fine for static content and dangerous for anything with an active write path. Application-consistent dumps exist precisely for this.',
    },
  ],
  lab: {
    title: 'Lose data, then keep it',
    scenario:
      'Demonstrate that the writable layer is disposable, then make the same data survive with a named volume, and back it up.',
    prerequisites: ['Docker installed'],
    tasks: [
      {
        instruction:
          'Run a container with no volume, write a file into it, then remove the container and start a fresh one to confirm the file is gone.',
      },
      {
        instruction: 'Create a named volume and repeat, confirming the file survives.',
      },
      {
        instruction:
          'Mount an empty named volume over `/etc/nginx` in the nginx image and list the contents.',
        hint: 'You should see the image configuration - the copy-in behaviour.',
      },
      {
        instruction: 'Do the same with a bind mount of an empty host directory and compare.',
      },
      {
        instruction: 'Back the named volume up to a tar.gz using a throwaway alpine container.',
      },
      { instruction: 'Remove the volumes and the scratch directory.' },
    ],
    solution: [
      {
        title: 'The whole lab',
        language: 'bash',
        code: `# 1. No volume - the data does not survive removal
docker run --name t1 alpine sh -c 'echo keep-me > /tmp/note'
docker rm t1
docker run --rm alpine cat /tmp/note 2>&1    # No such file

# 2. Named volume - it does
docker volume create labdata
docker run --name t2 -v labdata:/data alpine sh -c 'echo keep-me > /data/note'
docker rm t2
docker run --rm -v labdata:/data alpine cat /data/note    # keep-me

# 3. Empty NAMED volume over a populated path: image content is copied in
docker run --rm -v nginxconf:/etc/nginx nginx:1.27 ls /etc/nginx

# 4. Empty BIND mount over the same path: nothing is copied
mkdir -p /tmp/emptydir
docker run --rm -v /tmp/emptydir:/etc/nginx nginx:1.27 ls /etc/nginx   # empty

# 5. Back up the volume
docker run --rm -v labdata:/data:ro -v "$(pwd)":/backup \\
  alpine tar czf /backup/labdata.tar.gz -C /data .
ls -lh labdata.tar.gz

docker volume rm labdata nginxconf
rm -rf /tmp/emptydir labdata.tar.gz`,
      },
    ],
    verification: [
      {
        command: 'docker run --rm -v labdata:/data alpine cat /data/note',
        what: 'Reads the file back from a completely different container.',
        expected: 'keep-me',
      },
      {
        command: 'docker volume inspect labdata --format "{{.Mountpoint}}"',
        what: 'Shows where Docker put it on the host.',
        expected: 'A path under the Docker data root.',
      },
    ],
    cleanup: [
      {
        command: 'docker volume rm labdata nginxconf 2>/dev/null; rm -rf /tmp/emptydir; true',
        what: 'Removes the lab volumes and scratch directory.',
      },
    ],
  },
  relatedTopicIds: ['dk-images-and-layers', 'dk-networking-and-ports', 'dk-compose-basics'],
  docs: [
    { title: 'Volumes', url: 'https://docs.docker.com/engine/storage/volumes/' },
    { title: 'Bind mounts', url: 'https://docs.docker.com/engine/storage/bind-mounts/' },
  ],
}
