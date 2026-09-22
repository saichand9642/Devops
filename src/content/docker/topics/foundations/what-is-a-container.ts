import type { Topic } from '../../../types'

export const whatIsAContainer: Topic = {
  id: 'dk-what-is-a-container',
  title: 'What a container actually is',
  domainId: 'dk-foundations',
  difficulty: 'beginner',
  estimatedMinutes: 14,
  order: 1,
  tags: ['containers', 'namespaces', 'cgroups', 'vm', 'kernel'],
  oneLiner:
    'An ordinary process on the host, given a private view of the filesystem, the network and the process tree.',
  explanation: [
    'A container is **not a small virtual machine**. It is a normal Linux process running on the host kernel, started in such a way that it cannot see most of the rest of the system. There is no guest operating system and no virtual hardware.',
    'Two kernel features do the work. **Namespaces** control what a process can *see* - its own process tree, its own network interfaces, its own mount table, its own hostname. **Control groups (cgroups)** control what it can *use* - how much CPU time and memory it is allowed.',
    'A **virtual machine** is a genuinely different thing: a hypervisor emulates hardware, and a complete guest kernel boots on top of it. That is why a VM takes tens of seconds to start and hundreds of megabytes of memory before your application has done anything, while a container starts in milliseconds and adds almost nothing.',
    'The trade is **isolation strength**. Containers share the host kernel, so a kernel vulnerability is a shared risk and a container escape lands you on the host. A VM has its own kernel, which is a much stronger boundary. That is the honest reason multi-tenant platforms still use VMs underneath their containers.',
  ],
  whyItMatters: [
    'Almost every wrong belief about Docker traces back to thinking a container is a tiny VM - that it boots, that it has an init system, that it keeps running with nothing to do. It does none of those.',
    'The single-process model explains behaviour people find surprising: why a container exits the moment its command finishes, why signals matter, and why there is no `ps` showing the host processes.',
    'Knowing containers share the host kernel is what tells you a Linux image cannot run on a Windows kernel, and why "it runs anywhere" has a boundary.',
  ],
  howItWorks: [
    'You ask the Docker daemon to run an image. The daemon creates a new set of **namespaces** so the new process gets its own process tree, network stack, mount table and hostname.',
    'It assembles the image layers into a root filesystem and **chroots** the process into it, so `/` inside the container is the image, not the host.',
    'It places the process in a **cgroup** that caps memory and CPU, and applies security settings - dropped capabilities, a seccomp profile restricting which syscalls are allowed, and optionally a read-only root filesystem.',
    'It executes your command as **PID 1** inside that namespace. From the host you can see the same process with its real host PID; from inside, it believes it is the first process on the machine.',
    'When that PID 1 process exits, the container is finished. There is nothing else in there to keep it alive, which is why a container running `bash` with no terminal attached exits immediately.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Containers and virtual machines, side by side',
      caption:
        'The difference is the guest kernel. A container shares the host one, which is why it starts instantly and isolates less.',
      root: {
        label: 'Physical host',
        detail: 'one machine, one set of hardware',
        children: [
          {
            label: 'Host kernel',
            detail: 'shared by every container - this is the boundary',
            tone: 'accent',
            children: [
              {
                label: 'Container A',
                detail: 'your process, namespaced and cgrouped - no guest OS',
                tone: 'success',
              },
              {
                label: 'Container B',
                detail: 'another process, same kernel, different namespaces',
                tone: 'success',
              },
            ],
          },
          {
            label: 'Hypervisor with a virtual machine',
            detail: 'emulated hardware plus a full guest kernel - stronger, heavier',
            tone: 'muted',
          },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'What happens when a container starts',
      caption: 'Five steps, all of them cheap. This is why a container starts in milliseconds.',
      nodes: [
        {
          label: 'Create namespaces',
          detail: 'own process tree, network, mounts and hostname',
          tone: 'accent',
        },
        {
          label: 'Assemble the root filesystem',
          detail: 'image layers stacked, plus a writable layer on top',
          arrowLabel: 'then',
        },
        {
          label: 'Apply cgroup limits',
          detail: 'memory and CPU ceilings enforced by the kernel',
          arrowLabel: 'then',
        },
        {
          label: 'Drop privileges',
          detail: 'capabilities removed, seccomp profile applied',
          arrowLabel: 'then',
          tone: 'success',
        },
        {
          label: 'Exec the command as PID 1',
          detail: 'when this process exits, the container is over',
          arrowLabel: 'finally',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Linux namespace',
      purpose:
        'Controls what a process can see. Each type isolates one dimension of the system, and a container normally gets several at once.',
      fields: [
        { path: 'pid', meaning: 'Own process tree. Your command becomes PID 1 inside.' },
        { path: 'net', meaning: 'Own network interfaces, routing table and ports.' },
        { path: 'mnt', meaning: 'Own mount table, so / is the image rather than the host.' },
        { path: 'uts', meaning: 'Own hostname and domain name.' },
        { path: 'ipc', meaning: 'Own shared memory and semaphores.' },
        { path: 'user', meaning: 'Maps container UIDs to different host UIDs. Not on by default.' },
      ],
    },
    {
      kind: 'Control group (cgroup)',
      purpose: 'Controls what a process can use. The kernel enforces these, not Docker.',
      fields: [
        { path: 'memory.max', meaning: 'Hard memory ceiling. Exceed it and the kernel OOM-kills.' },
        {
          path: 'cpu.max',
          meaning: 'CPU quota per period. Exceeding it throttles rather than kills.',
        },
        { path: 'pids.max', meaning: 'Maximum process count, which contains fork bombs.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The container that would not stay running',
    story: [
      'A developer new to containers runs `docker run ubuntu` and watches it exit immediately. They try `docker run ubuntu bash` and it exits again. They conclude Docker is broken.',
      'Nothing is broken. The image has no long-running program; `bash` with no terminal attached reads end-of-file on stdin and exits, and when PID 1 exits the container is finished. `docker run -it ubuntu bash` gives bash a terminal, so it waits for input and stays alive.',
      'The mental model that fixes this permanently is: a container is a process, not a machine. It lives exactly as long as its command does. A VM sits there idling; a container has nothing to idle.',
    ],
  },
  yamlExamples: [
    {
      title: 'The same isolation, without Docker',
      language: 'bash',
      explanation:
        'Docker is a convenient front end over kernel features you can drive yourself. Running this shows there is no magic involved.',
      code: `# A new PID and mount namespace, with /proc remounted so ps sees
# only the namespace. Inside, bash believes it is PID 1.
sudo unshare --pid --mount --fork --mount-proc bash

# Inside:
#   ps aux        -> just bash and ps, nothing from the host
#   echo $$       -> 1

# Docker does the same thing, plus a root filesystem from an image,
# plus cgroup limits, plus capability and seccomp restrictions.`,
    },
  ],
  imperative: [
    {
      command: 'docker run --rm alpine echo hello',
      what: 'Runs one command in a container and removes the container when it exits.',
      expected: 'hello',
    },
    {
      command: 'docker run -it --rm alpine sh',
      what: 'Interactive shell. -i keeps stdin open, -t allocates a terminal.',
      expected: 'A / # prompt inside the container.',
      namespaceNote: 'Without -it the shell gets no terminal and exits immediately.',
    },
    {
      command: 'docker run --rm alpine ps aux',
      what: 'Shows the process tree from inside - proof of the PID namespace.',
      expected: 'PID 1 is ps itself. No host processes are visible.',
    },
  ],
  declarative: {
    steps: [
      'Run a container with a command that finishes, and watch it exit.',
      'Run one with a command that blocks, and watch it stay up.',
      'Compare the process list inside the container with the one on the host.',
      'Find the same process on the host and confirm it is an ordinary process.',
    ],
    code: [
      {
        title: 'Seeing both sides of the same process',
        language: 'bash',
        explanation:
          'The container process is visible on the host with a normal PID. Isolation is one-way: the host sees in, the container does not see out.',
        code: `# Start something that blocks so the container stays alive
docker run -d --name sleeper alpine sleep 600

# Inside the container: PID 1 is sleep, and nothing else exists
docker exec sleeper ps aux

# On the host: the very same process, with a normal host PID
ps -ef | grep "sleep 600"

# Docker will tell you the host PID directly
docker inspect -f '{{.State.Pid}}' sleeper

# And which namespaces that PID is in
sudo ls -l /proc/$(docker inspect -f '{{.State.Pid}}' sleeper)/ns/`,
      },
    ],
  },
  verification: [
    {
      command: 'docker inspect -f "{{.State.Pid}}" <container>',
      what: 'Prints the host PID of the container process.',
      expected: 'A normal PID that exists in the host process table.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker run --rm alpine hostname',
      what: 'Shows the container gets its own hostname - the UTS namespace.',
      expected: 'A short random hex string, not your machine name.',
    },
    {
      command: 'docker run --rm alpine ip addr',
      what: 'Shows the container has its own network stack.',
      expected: 'lo and eth0 only, with a private address.',
    },
  ],
  troubleshooting: [
    {
      command: 'docker ps -a',
      what: 'Lists stopped containers too, so you can see one that exited immediately.',
      expected: 'STATUS shows "Exited (0) 2 seconds ago" for a command that simply finished.',
    },
    {
      command: 'docker logs <container>',
      what: 'Shows what the process printed before it exited.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker inspect -f "{{.State.ExitCode}}" <container>',
      what: 'The exit code tells you whether it finished or was killed.',
      expected: '0 is a clean exit; 137 means SIGKILL, usually an out-of-memory kill.',
      placeholders: ['<container>'],
    },
  ],
  commonMistakes: [
    'Expecting a container to keep running with nothing to do. It lives exactly as long as its PID 1 process.',
    'Running an interactive shell without `-it`, then concluding the image is broken when it exits instantly.',
    'Believing a container is a security boundary as strong as a VM. It shares the host kernel, which is why multi-tenant platforms still put VMs underneath.',
    'Trying to run a Linux image on a Windows kernel and expecting it to work. Docker Desktop runs a Linux VM precisely because it cannot.',
    'Treating the container as a machine to log into and maintain. It is meant to be replaced, not repaired.',
  ],
  examTips: [
    'Namespaces control what a process can SEE; cgroups control what it can USE. Expect that distinction to be tested directly.',
    'A container shares the host kernel. A virtual machine has its own. That single fact answers most comparison questions.',
    'When PID 1 exits, the container stops. No exceptions.',
    'Exit code 137 means the process received SIGKILL - almost always the cgroup memory limit being enforced.',
    'Docker is a convenience layer over kernel features. Nothing it does is unavailable to a determined shell script.',
  ],
  summary: [
    'A container is a host process with namespaces restricting what it sees and cgroups restricting what it uses.',
    'There is no guest kernel, which is why containers start in milliseconds and isolate less than VMs.',
    'Your command runs as PID 1, and the container ends when it exits.',
    'Images are Linux-kernel specific - the portability claim stops at the kernel.',
    'Isolation is one-way: the host can see into the container, but not the reverse.',
  ],
  practice: [
    {
      id: 'dk-what-is-a-container-p1',
      level: 'beginner',
      prompt:
        '`docker run ubuntu bash` exits straight away. `docker run -it ubuntu bash` stays open. Why?',
      answer:
        'Without `-it` bash has no terminal and immediately reads end-of-file on stdin, so it exits - and when PID 1 exits, the container is over. `-i` keeps stdin open and `-t` allocates a pseudo-terminal, so bash waits for input instead.',
      explanation:
        'Nothing about the image differs between the two runs. The lifetime of a container is exactly the lifetime of its first process.',
    },
    {
      id: 'dk-what-is-a-container-p2',
      level: 'beginner',
      prompt: 'Which kernel feature stops a container using more than 512MB of memory?',
      answer:
        'Control groups (cgroups). Namespaces would hide memory from it; cgroups are what actually cap it.',
      explanation:
        'The memory ceiling is enforced by the kernel, not by Docker. Exceeding it means the kernel OOM-kills the process, which surfaces as exit code 137.',
    },
    {
      id: 'dk-what-is-a-container-p3',
      level: 'intermediate',
      prompt:
        'Your colleague says containers are more secure than VMs because they are smaller. How would you respond?',
      answer:
        'Smaller attack surface inside the image is a genuine benefit, but the isolation boundary is weaker, not stronger: every container shares the host kernel, so one kernel vulnerability affects all of them and a container escape lands on the host. A VM has its own kernel and a much harder boundary.',
      explanation:
        'Both things are true at once - a minimal image has less to exploit, and the container boundary is thinner than a hypervisor boundary. Cloud providers run untrusted workloads in VMs or in VM-backed sandboxes for exactly this reason.',
    },
    {
      id: 'dk-what-is-a-container-p4',
      level: 'advanced',
      prompt:
        'A container shows PID 1 for your application when you run `ps` inside it, but the host shows PID 24815 for the same process. Explain.',
      answer:
        'The PID namespace gives the container its own process-number space starting at 1. The process genuinely exists once, on the host, with host PID 24815; the container simply sees a different numbering.',
      explanation:
        'This is why signals sent from the host use the host PID, and why `docker inspect -f "{{.State.Pid}}"` is the bridge between the two views. It also explains why PID 1 inside a container inherits the kernel special-casing of PID 1, including default signal handling.',
    },
  ],
  lab: {
    title: 'Prove a container is just a process',
    scenario:
      'Start a container, find the same process on the host, and confirm the isolation is one-way.',
    prerequisites: ['Docker installed and running', 'A Linux host, or Docker Desktop'],
    tasks: [
      {
        instruction: 'Run `docker run --rm alpine echo hello` and note that it exits immediately.',
      },
      {
        instruction: 'Run `docker run -d --name sleeper alpine sleep 600` and confirm it stays up.',
        hint: '`docker ps` should show it as Up.',
      },
      {
        instruction: 'Run `ps aux` inside the container and count the processes you can see.',
        hint: 'Use `docker exec sleeper ps aux`.',
      },
      {
        instruction:
          'Find the host PID of that container and confirm the process exists on the host.',
        hint: '`docker inspect -f "{{.State.Pid}}" sleeper`',
      },
      {
        instruction: 'Compare the container hostname with your own machine hostname.',
      },
      {
        instruction:
          'Kill the process from the host with its host PID and watch the container stop.',
        hint: 'That is the clearest possible proof that it is just a process.',
      },
      { instruction: 'Remove the container.' },
    ],
    solution: [
      {
        title: 'The whole lab',
        language: 'bash',
        code: `docker run --rm alpine echo hello          # exits at once - nothing to keep it alive
docker run -d --name sleeper alpine sleep 600
docker ps                                   # Up 3 seconds

docker exec sleeper ps aux                  # PID 1 is sleep. Nothing else.
docker exec sleeper hostname                # a random hex string
hostname                                    # your real machine name

PID=$(docker inspect -f '{{.State.Pid}}' sleeper)
echo "host pid: $PID"
ps -o pid,cmd -p "$PID"                     # the same sleep, from the host

sudo kill -9 "$PID"
docker ps -a | grep sleeper                 # Exited (137) - killed
docker rm sleeper`,
      },
    ],
    verification: [
      {
        command: 'docker exec sleeper ps aux | wc -l',
        what: 'Counts visible processes inside the container.',
        expected: 'A very small number - the PID namespace hides everything on the host.',
      },
      {
        command: 'docker inspect -f "{{.State.ExitCode}}" sleeper',
        what: 'Confirms how the container ended after you killed it.',
        expected: '137, which is 128 + 9 (SIGKILL).',
      },
    ],
    cleanup: [
      { command: 'docker rm -f sleeper 2>/dev/null; true', what: 'Removes the lab container.' },
    ],
  },
  relatedTopicIds: ['dk-images-and-layers', 'dk-container-lifecycle', 'dk-config-and-resources'],
  docs: [
    { title: 'Docker overview', url: 'https://docs.docker.com/get-started/docker-overview/' },
    {
      title: 'Runtime options with memory and CPUs',
      url: 'https://docs.docker.com/engine/containers/resource_constraints/',
    },
  ],
}
