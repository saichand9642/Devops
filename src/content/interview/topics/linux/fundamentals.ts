import type { InterviewQuestion } from '../../../types'

/** Processes, permissions, the filesystem and the commands used every day. */
export const linuxFundamentalQuestions: InterviewQuestion[] = [
  {
    id: 'itv-linux-8',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you find out what is running on a machine and what it is doing?',
    probing: 'Process investigation - the first thing you do on an unfamiliar or misbehaving host.',
    answer: [
      '`ps aux` gives a snapshot of every process with its CPU and memory usage; `ps -ef` is the other common form. For a **live** view, `top` is everywhere and `htop` is much more readable if it is installed.',
      'For **relationships**, `ps auxf` or `pstree` shows the process tree, which matters when you need to know whether something is a child of systemd, of a shell, or of a runaway parent that is spawning it repeatedly.',
      'For **what a specific process is doing**: `lsof -p PID` lists every file, socket and device it has open, which answers "what is it connected to" and "what is it writing". `ss -tulpn` shows listening sockets and which process owns them. And `strace -p PID` shows the system calls it is making, which tells you whether it is blocked on I/O, spinning, or waiting on a lock.',
      'For **where it came from**, `/proc/PID/` has everything: `cmdline` for the exact arguments, `environ` for its environment, `cwd` for its working directory, `exe` for the binary, and `limits` for its resource limits. That directory is usually faster than remembering which flag of `ps` shows a given field.',
      'The practical sequence on an unfamiliar problem is: `top` to see what is consuming resources, `ps auxf` to see the relationships, then `lsof` or `strace` on the specific process.',
    ],
    code: [
      {
        title: 'The sequence, in order',
        language: 'bash',
        code: `# What is consuming the machine?
top -o %CPU
ps aux --sort=-%cpu | head -20
ps aux --sort=-%mem | head -20

# Relationships - who spawned what
ps auxf
pstree -p 1234

# What is this specific process doing?
lsof -p 1234                    # open files, sockets, devices
ss -tulpn | grep 1234           # what is it listening on?
strace -p 1234 -f -e trace=network,file    # live system calls
cat /proc/1234/cmdline | tr '\\0' ' '       # exact arguments
ls -l /proc/1234/cwd /proc/1234/exe        # where it runs, what it is`,
      },
    ],
    traps: [
      '`ps aux | grep something` matching the grep itself - use `pgrep` instead.',
      'Reading `%CPU` in `ps` as current usage - it is an average over the process lifetime, unlike `top`.',
      '`strace` on a busy production process, which slows it down significantly.',
    ],
    followUps: [
      'Why does `ps` show a different CPU percentage from `top`?',
      'How would you find which process is holding a file open?',
    ],
    tags: ['processes', 'ps', 'lsof', 'proc', 'fundamentals'],
  },
  {
    id: 'itv-linux-9',
    level: 'basic',
    kind: 'open',
    prompt: 'Explain Linux file permissions, including the special bits.',
    probing: 'Permissions in full - most people know the basics and not the special bits.',
    answer: [
      'Each file has permissions for **user**, **group** and **other**, each with read (4), write (2) and execute (1). So `755` is `rwxr-xr-x` - full access for the owner, read and execute for everyone else.',
      'On a **directory** the bits mean something different and this catches people: **read** lists the names in it, **write** creates and deletes entries, and **execute** lets you traverse into it and access files by name. A directory with read but not execute lets you see filenames and nothing else; execute without read lets you access a file you already know the name of but not list the contents.',
      "The **special bits** are the part usually missed. **setuid (4000)** on an executable runs it as the file's owner rather than the invoker - which is how `passwd` can modify `/etc/shadow`. **setgid (2000)** on a directory makes new files inherit the directory's group, which is how shared team directories work. And the **sticky bit (1000)** on a directory means only the owner of a file can delete it, which is why `/tmp` is `1777` and users cannot delete each other's files.",
      'The mental model that helps: **the first octal digit is the special bits**, so `1777` on `/tmp` is sticky plus `rwxrwxrwx`, and `4755` on a binary is setuid plus `rwxr-xr-x`.',
    ],
    code: [
      {
        title: 'Reading and setting permissions',
        language: 'bash',
        code: `ls -l /usr/bin/passwd
# -rwsr-xr-x  the 's' in the user field is setuid

ls -ld /tmp
# drwxrwxrwt  the 't' at the end is the sticky bit

chmod 755 script.sh          # rwxr-xr-x
chmod u+x,go-w file          # symbolic form
chmod 2775 /srv/shared       # setgid: new files inherit the group
chmod 1777 /srv/upload       # sticky: only the owner can delete their files

# Find setuid binaries - worth auditing
find / -xdev -perm -4000 -type f -ls 2>/dev/null

# World-writable files, which usually should not exist
find /etc -xdev -perm -0002 -type f -ls`,
      },
    ],
    traps: [
      'Read without execute on a directory, so the contents are listed but nothing can be opened.',
      '`chmod 777` used to fix a permission problem, which is almost never the actual cause and creates a real one.',
      'setuid on a shell script - most systems ignore it, and where it works it is a serious vulnerability.',
      'Forgetting that permissions on a file are only checked after traversing every parent directory.',
    ],
    followUps: ['What does the execute bit mean on a directory?', 'Why is `/tmp` mode 1777?'],
    tags: ['permissions', 'setuid', 'sticky bit', 'security', 'fundamentals'],
  },
  {
    id: 'itv-linux-10',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you investigate high CPU usage on a server?',
    probing: 'A structured diagnosis rather than a list of commands.',
    answer: [
      'First **characterise it**. `top` or `htop` shows which processes, and the breakdown at the top matters as much as the process list: high **user** time means application code, high **system** time means the kernel is busy (often heavy I/O or syscall churn), high **iowait** means the CPU is idle waiting for disk, and high **steal** on a virtual machine means the hypervisor is giving your CPU to someone else - which you cannot fix from inside.',
      'That distinction matters because "high CPU" with high iowait is a **storage** problem, not a CPU one, and optimising the application will not help.',
      'Then **narrow to a process, then a thread**. `top -H -p PID` shows per-thread usage, which for a multi-threaded application tells you whether it is one runaway thread or the whole thing.',
      'Then **find out what it is doing**. `perf top -p PID` shows which functions are consuming CPU, which usually names the cause directly. `strace -c -p PID` summarises system calls and shows whether it is spinning on something. For a JVM or Python process, the language-specific profiler is more informative than either.',
      'And **check whether it is new**. Comparing against historical metrics tells you whether this is a change or normal behaviour under increased load - and if load increased, the application may be behaving correctly and the answer is capacity rather than a bug.',
    ],
    code: [
      {
        title: 'Working from the summary to the cause',
        language: 'bash',
        code: `# 1. Where is the time going? The header matters as much as the list.
top
# %Cpu(s):  us  user   sy  system   wa  iowait   st  steal
#   high us -> application code
#   high sy -> kernel: syscalls, context switches, I/O
#   high wa -> waiting on disk; the CPU is not the problem
#   high st -> the hypervisor is taking it; not fixable from here

# 2. Per-CPU and over time
mpstat -P ALL 2 5
vmstat 2 10                     # r = runnable queue, cs = context switches

# 3. Which thread, not just which process
top -H -p 1234
ps -L -p 1234 -o tid,pcpu,comm --sort=-pcpu | head

# 4. What is it actually executing?
perf top -p 1234
strace -c -f -p 1234            # syscall summary - spinning shows up here`,
      },
    ],
    traps: [
      'Treating high iowait as a CPU problem - the CPU is idle, waiting for storage.',
      'Missing steal time on a VM, and optimising an application that is being throttled by the hypervisor.',
      'Load average read as a CPU percentage - it counts runnable **and uninterruptible** processes.',
      '`strace` on a busy production process, which slows it down enough to change the behaviour.',
    ],
    followUps: [
      'What does high iowait tell you?',
      'What is steal time and what can you do about it?',
    ],
    tags: ['cpu', 'performance', 'top', 'perf', 'troubleshooting'],
  },
  {
    id: 'itv-linux-11',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'A server has 32 GB of RAM. `free -h` shows 30 GB used and 1 GB free. Is there a problem?',
    probing: 'Linux memory reporting, which is the single most misread thing on a Linux system.',
    options: [
      {
        id: 'a',
        text: 'Not necessarily - Linux uses free memory for page cache; look at "available", not "free"',
      },
      { id: 'b', text: 'Yes, the server is about to run out of memory' },
      { id: 'c', text: 'Yes, a memory leak is certain' },
      { id: 'd', text: 'It depends entirely on the swap usage' },
    ],
    correct: ['a'],
    answer: [
      'Linux deliberately uses memory that would otherwise be idle for the **page cache**, holding recently read file data. That memory is **immediately reclaimable** - if an application needs it, the kernel drops cache and hands it over. Unused memory is wasted memory.',
      'So **"free" is almost always low on a healthy system** and tells you very little. The number that matters is **"available"**, which estimates how much can be given to a new application without swapping, and includes reclaimable cache.',
      'The real signs of memory pressure are: **available** genuinely low, **swap actively being used** (`si`/`so` in `vmstat`, not just swap allocated), and **OOM kills** in `dmesg` or the journal.',
      'Swap being allocated is also not itself a problem - the kernel moves pages that have not been touched for a long time out, which is reasonable. Swap being **actively read and written** is the signal, because that means real work is waiting on disk.',
    ],
    code: [
      {
        title: 'Read the right column',
        language: 'bash',
        code: `free -h
#               total   used   free   shared  buff/cache   available
# Mem:           31Gi   12Gi  1.0Gi    500Mi        18Gi        18Gi
#                                                              ^^^^ this one

# Is swap being USED, or just allocated? si/so are what matter.
vmstat 2 5
#  si   so       swap in / swap out per second - zero is healthy

# Has anything been OOM killed?
dmesg -T | grep -i -E 'out of memory|killed process'
journalctl -k --since '24 hours ago' | grep -i oom

# Who is actually using it?
ps aux --sort=-%mem | head -10
smem -rs pss 2>/dev/null | head       # PSS is fairer than RSS for shared memory`,
      },
    ],
    traps: [
      'Alerting on "free" memory, which fires constantly on a healthy system.',
      'Treating allocated swap as a problem rather than active swapping.',
      'Summing RSS across processes to get total usage - shared memory is counted repeatedly.',
      'Dropping caches with `echo 3 > /proc/sys/vm/drop_caches` to "free" memory, which just makes everything slower.',
    ],
    followUps: [
      'What is the difference between swap being allocated and swap being used?',
      'Why is summing RSS misleading?',
    ],
    tags: ['memory', 'page cache', 'free', 'swap', 'fundamentals'],
  },
  {
    id: 'itv-linux-12',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does systemd work, and how do you manage and troubleshoot a service?',
    probing: 'The init system on essentially every modern Linux distribution.',
    answer: [
      'systemd manages **units** - services, sockets, timers, mounts, targets - with dependencies between them, and starts what it can in parallel. A **service unit** describes how to start, stop and supervise a process.',
      'The everyday commands: `systemctl status` for the current state plus recent log lines, `start`/`stop`/`restart`/`reload`, `enable` to start at boot (which is **separate** from starting it now - `enable --now` does both), and `daemon-reload` after editing a unit file, which people forget and then wonder why their change had no effect.',
      'For **troubleshooting**, `journalctl -u service -f` follows its logs and `journalctl -u service --since` scopes them. `systemctl status` shows the exit code and the last few lines, which is usually enough to see what happened. `systemctl list-dependencies` shows why something did or did not start.',
      'The **`Restart=`** directive is the one that matters operationally: `on-failure` restarts on a non-zero exit, with `RestartSec` controlling the delay and `StartLimitBurst`/`StartLimitIntervalSec` stopping an infinite restart loop. Without a limit, a permanently broken service restarts forever and fills the journal.',
      'And **overrides go in a drop-in**, not by editing the shipped unit: `systemctl edit service` creates `/etc/systemd/system/service.d/override.conf`, which survives package upgrades where an edited unit file does not.',
    ],
    code: [
      {
        title: 'Managing and diagnosing',
        language: 'bash',
        code: `systemctl status app.service            # state, PID, exit code, recent logs
systemctl enable --now app              # start now AND at boot
systemctl daemon-reload                 # after editing any unit file

journalctl -u app -f                    # follow
journalctl -u app --since '1 hour ago' -p err
journalctl -u app -b -1                 # from the previous boot

systemctl list-units --failed           # what is broken on this host?
systemctl list-dependencies app
systemd-analyze blame                   # what made boot slow`,
      },
      {
        title: 'A service unit with sensible supervision',
        language: 'text',
        code: `[Unit]
Description=Application service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=notify
User=app
WorkingDirectory=/opt/app
ExecStart=/opt/app/.venv/bin/python -m app
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=5                # stop after 5 failures in 5 minutes

# Hardening - cheap, and rarely applied
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/app

[Install]
WantedBy=multi-user.target`,
      },
    ],
    traps: [
      'Editing a unit file and not running `daemon-reload`.',
      'Confusing `enable` with `start` - one is for boot, the other is now.',
      'Editing the shipped unit in `/lib/systemd/system`, which a package upgrade overwrites.',
      'No `StartLimit`, so a broken service restarts forever.',
    ],
    followUps: [
      'What is the difference between `enable` and `start`?',
      'Why use `systemctl edit` rather than editing the unit file?',
    ],
    tags: ['systemd', 'services', 'journalctl', 'troubleshooting'],
  },
  {
    id: 'itv-linux-13',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you diagnose a disk I/O problem?',
    probing: 'Storage performance, which is often the real cause of "the server is slow".',
    answer: [
      'The first signal is **iowait** in `top` or `vmstat`: the CPU is idle but processes are blocked waiting for storage. High iowait with low CPU means the bottleneck is the disk, not the processor.',
      '`iostat -x` is the main tool. The columns that matter: **`%util`** (how busy the device is - near 100% means saturated, though this is misleading on SSDs and NVMe which handle parallel requests), **`await`** (average time a request waits, including queueing), **`r_await`** and **`w_await`** separately, and **`aqu-sz`**, the average queue depth. Rising `await` with a growing queue is the clear signature of saturation.',
      'Then **which process**. `iotop` shows per-process I/O directly if it is available. `pidstat -d` is the alternative, and `/proc/PID/io` has the cumulative counters per process.',
      'Then **what kind of I/O**. Sequential reads at a few hundred megabytes a second may be perfectly normal; the same throughput in small random writes may be saturating the device. `iostat` showing high IOPS with low throughput means small random I/O, which is much harder on storage.',
      'And the usual causes worth checking: a **log file being written synchronously**, a **database missing an index** so it is doing table scans, a **backup or batch job** running at the wrong time, **swapping** (which shows as disk I/O but is really a memory problem), and on a cloud volume, **burst credits exhausted** - which produces a sudden, dramatic slowdown with no other change.',
    ],
    code: [
      {
        title: 'From the symptom to the process',
        language: 'bash',
        code: `# 1. Is it iowait at all?
vmstat 2 10                      # wa column; b = blocked on I/O

# 2. Which device, and how saturated?
iostat -x 2 5
# await   average wait per request (ms) - rising is the signal
# aqu-sz  average queue depth - growing means requests are backing up
# %util   how busy; misleading on NVMe, useful on spinning disks

# 3. Which process?
iotop -oPa                       # only processes doing I/O, accumulated
pidstat -d 2 5
cat /proc/1234/io                # cumulative bytes for one process

# 4. Is it actually swapping? That is a memory problem wearing an I/O costume.
vmstat 2 5 | awk '{print $7, $8}'    # si so`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'What kind of I/O problem is it?',
        caption:
          'Swapping and exhausted cloud burst credits both look like disk problems and are not.',
        question: 'What do the numbers say?',
        branches: [
          {
            condition: 'High iowait, high await, growing queue',
            result: 'The device is saturated',
            detail: 'Find the process, or the volume is undersized',
            tone: 'danger',
          },
          {
            condition: 'High disk I/O and si/so non-zero',
            result: 'Swapping - a memory problem',
            detail: 'Adding disk will not help',
            tone: 'warning',
          },
          {
            condition: 'High IOPS, low throughput',
            result: 'Small random I/O',
            detail: 'Much harder on storage than sequential',
            tone: 'accent',
          },
          {
            condition: 'Sudden severe slowdown, no other change',
            result: 'Cloud volume burst credits exhausted',
            detail: 'gp2 dropping to baseline IOPS',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'On AWS gp2 volumes, exhausted burst credits drop you to baseline IOPS with no warning and no other symptom. gp3 has no burst concept and provisions IOPS independently of size.',
      '`%util` is unreliable on NVMe and SSD because they service many requests in parallel - `await` and queue depth are the better signals there.',
      'Filesystem mount options matter: `noatime` avoids a write on every read, which is a free improvement on read-heavy workloads.',
      'Swapping shows up as disk I/O but the fix is memory, not storage.',
    ],
    traps: [
      'Treating swapping as an I/O problem and adding faster disk.',
      'Reading `%util` near 100% on NVMe as saturation.',
      'Missing exhausted burst credits on a cloud volume.',
      'Looking only at throughput and missing that the I/O is small and random.',
    ],
    followUps: [
      'Why is `%util` misleading on SSDs?',
      'A cloud volume suddenly got much slower with no change. What would you check?',
    ],
    tags: ['disk', 'iostat', 'performance', 'iowait', 'troubleshooting', 'advanced'],
  },
  {
    id: 'itv-linux-14',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you troubleshoot a network problem from a Linux host?',
    probing: 'Layered network diagnosis, which is a method rather than a set of commands.',
    answer: [
      'Work **outward in layers**, because each step eliminates one and the order saves a lot of time.',
      '**Interface and link**: `ip addr` and `ip link` - is the interface up and does it have the address you expect? `ethtool` shows link speed and errors.',
      '**Routing**: `ip route get 8.8.8.8` shows exactly which route and interface a packet to that destination would take, which is far more direct than reading the whole routing table.',
      "**DNS**: `dig` or `getent hosts`. A DNS failure looks exactly like a connectivity failure from the application's point of view, and this is worth ruling out early because it is common and quick to check. Note that `dig` queries DNS directly while `getent` follows `nsswitch.conf`, so they can disagree - and the application follows `getent`.",
      '**Connectivity**: `ping` for ICMP (often blocked, so failure is not conclusive), then `nc -zv host port` or `curl -v` for the actual port. The **distinction between connection refused and a timeout** is the single most useful signal here: **refused** means the packet arrived and something actively rejected it, so routing and firewalls in between are fine and the service is simply not listening. A **timeout** means the packet is being dropped - a firewall, a security group, or a missing route.',
      '**On the far end**: `ss -tulpn` shows what is listening and on which address. A service bound to `127.0.0.1` is unreachable from anywhere else, which is a very common cause of a refused connection.',
      'And if all of that looks correct, `tcpdump` shows whether packets are arriving at all - but it is the last step, not the first.',
    ],
    code: [
      {
        title: 'The layers, in order',
        language: 'bash',
        code: `# 1. Interface and address
ip -brief addr
ip -brief link
ethtool eth0 | grep -E 'Speed|Duplex|Link detected'

# 2. Routing - which route would this actually take?
ip route get 10.0.5.20

# 3. DNS - and note these can disagree
dig +short api.example.com
getent hosts api.example.com        # what the application will use

# 4. Connectivity - and read the failure mode
nc -zv api.example.com 443
curl -sv --max-time 5 https://api.example.com/health
#   "Connection refused" -> arrived, nothing listening. Path is fine.
#   "timed out"          -> dropped. Firewall, security group, or routing.

# 5. On the far end - is it listening on the right address?
ss -tulpn | grep :8080
#   127.0.0.1:8080  -> loopback only, unreachable from outside
#   0.0.0.0:8080    -> all interfaces

# 6. Last resort - are packets arriving at all?
tcpdump -ni any host 10.0.5.20 and port 443 -c 20`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Layered network diagnosis',
        caption:
          'Refused versus timeout is the fastest single discriminator - it tells you which half to look in.',
        nodes: [
          { label: 'Interface up, address correct?', tone: 'accent' },
          { label: 'ip route get - which path?' },
          { label: 'DNS resolves?', detail: 'Looks identical to a connectivity failure' },
          {
            label: 'Refused or timeout?',
            detail: 'Refused = path fine, not listening. Timeout = dropped.',
            tone: 'warning',
          },
          { label: 'ss -tulpn on the far end', detail: 'Bound to 127.0.0.1?' },
          { label: 'tcpdump, if still unexplained', tone: 'muted' },
        ],
      },
    ],
    deeper: [
      'A service bound to `127.0.0.1` is the most common cause of "connection refused" from another host, and `ss -tulpn` shows it in one line.',
      '`mtr` combines ping and traceroute over time and shows where packets start being lost, which is much more informative than a single traceroute.',
      'ICMP being blocked means a failed `ping` proves nothing - always test the actual port.',
      'Conntrack table exhaustion on a busy host drops new connections while existing ones work, which is a confusing symptom worth knowing about.',
    ],
    traps: [
      'Starting with `tcpdump` rather than the cheap checks.',
      'Concluding from a failed `ping` that the host is unreachable.',
      'Not distinguishing refused from timeout, and investigating the wrong half.',
      'Checking `dig` and not `getent`, when the application uses the latter.',
    ],
    followUps: [
      'What does "connection refused" tell you that a timeout does not?',
      'Why might `dig` and `getent` disagree?',
    ],
    tags: ['networking', 'dns', 'ss', 'tcpdump', 'troubleshooting'],
  },
  {
    id: 'itv-linux-15',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you find what is using disk space?',
    probing: 'A routine task with one classic trap.',
    answer: [
      '`df -h` shows usage per filesystem, and `df -i` shows **inode** usage - which is worth checking because a filesystem can be out of inodes while showing plenty of free space, and the error message ("No space left on device") is identical.',
      '`du -sh *` in a directory shows what is taking the space, and `du -h --max-depth=1 | sort -h` is the form worth remembering because it gives a readable, sorted breakdown you can descend through.',
      'The classic trap is **`df` and `du` disagreeing** - `df` reports the filesystem 100% full while `du` accounts for far less. The cause is almost always a **deleted file still held open by a process**: the directory entry is gone so `du` cannot see it, but the space is not released until the file descriptor is closed. A log file deleted while the application is still writing to it is the usual case.',
      '`lsof +L1` lists open files with no remaining directory links, which finds it immediately. The fix is to restart the holding process, or better, to truncate the file rather than deleting it next time.',
      'The other common causes: a **large file in a directory hidden by a mount** over it, and **snapshots or reserved blocks** accounting for space `du` does not see.',
    ],
    code: [
      {
        title: 'Finding it, including the deleted-file case',
        language: 'bash',
        code: `df -h
df -i                            # inodes - a separate way to run out

# Readable, sorted breakdown you can descend through
du -h --max-depth=1 /var | sort -h
du -xh --max-depth=1 / 2>/dev/null | sort -h    # -x stays on one filesystem

# Largest files
find / -xdev -type f -size +500M -printf '%10s  %p\\n' 2>/dev/null | sort -rn | head

# df says full, du does not agree -> deleted files held open
lsof +L1
lsof -nP | awk '/deleted/ {print $1, $2, $7, $9}' | sort -k3 -rn | head

# Free the space without restarting: truncate through /proc
: > "/proc/1234/fd/3"`,
      },
    ],
    traps: [
      'Deleting a log file the application still has open, which frees nothing.',
      'Checking `df -h` and not `df -i` when the error is "no space left".',
      '`du` without `-x`, so it descends into network mounts and takes forever.',
      'A large directory hidden underneath a mount point, invisible to `du` on the mounted filesystem.',
    ],
    followUps: [
      'Why do `df` and `du` disagree?',
      'How do you reclaim the space without restarting the process?',
    ],
    tags: ['disk', 'df', 'du', 'lsof', 'troubleshooting', 'fundamentals'],
  },
  {
    id: 'itv-linux-16',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does a load average of 8.0 mean on a 4-core machine?',
    probing: 'Load average, which is very widely misinterpreted.',
    options: [
      {
        id: 'a',
        text: 'On average 8 processes were runnable or in uninterruptible sleep - roughly twice the core count, so there is contention, but I/O wait counts too',
      },
      { id: 'b', text: 'The CPU is at 800% utilisation' },
      { id: 'c', text: '8 processes are running right now' },
      { id: 'd', text: 'The machine is using 8 GB of memory' },
    ],
    correct: ['a'],
    answer: [
      'Load average is the number of processes that are **runnable** (wanting CPU) **or in uninterruptible sleep** (usually blocked on disk I/O), averaged over 1, 5 and 15 minutes.',
      'The comparison that matters is against the **core count**. On a 4-core machine, a load of 4 means roughly fully utilised, and 8 means about twice as much work as capacity - processes are queueing.',
      'The detail that makes it distinctive on Linux is the **uninterruptible sleep** part: processes blocked on disk count toward load even though they are using no CPU. So a machine with a slow or failing disk can show a load of 20 with the CPU almost idle. That is why load average alone does not tell you whether the problem is CPU or I/O - you need `top` or `vmstat` to see the breakdown.',
      'The **three numbers** are the useful part: 1, 5 and 15 minute averages. A high one-minute average with a low fifteen-minute one is a spike; all three high and similar is a sustained problem; and a rising trend across them shows the direction.',
    ],
    code: [
      {
        title: 'Load in context',
        language: 'bash',
        code: `uptime
# load average: 8.15, 4.20, 2.10
#               1min  5min  15min   -> rising, and getting worse

nproc                            # compare load against this

# Is it CPU or I/O? Load alone does not say.
vmstat 2 5
#  r  processes runnable (want CPU)
#  b  processes blocked on I/O (uninterruptible)
#  wa iowait percentage

# High load with a large 'b' and high 'wa' -> storage, not CPU`,
      },
    ],
    traps: [
      'Reading load average as a CPU percentage.',
      'Alerting on an absolute load value without normalising by core count.',
      'Assuming high load means CPU contention when it may be I/O.',
      'Reading only the one-minute figure and reacting to a transient spike.',
    ],
    followUps: [
      'Why can load be high with an idle CPU?',
      'What do the three numbers tell you together?',
    ],
    tags: ['load average', 'cpu', 'iowait', 'monitoring', 'fundamentals'],
  },
  {
    id: 'itv-linux-17',
    level: 'advanced',
    kind: 'scenario',
    prompt: 'A production server is unresponsive - SSH is slow or hangs. What do you do?',
    probing: 'Working under pressure with limited access, and knowing what causes this.',
    answer: [
      'First, **is it the machine or the network?** If ping works and SSH does not, the machine is alive and something is wrong on it. If neither works, it may be a network or hypervisor problem, and the console is the only route in.',
      '**Get in another way.** A cloud serial console or an out-of-band console works when SSH does not, because it does not need `sshd` to be responsive or a login to complete. That is the tool for this situation and it is worth knowing how to reach it **before** you need it.',
      'The common causes, roughly in order. **Memory exhaustion and swapping**: the machine is technically alive but every operation is waiting on disk, so SSH takes minutes to get to a prompt. **Disk full**, which stops `sshd` writing and can prevent login entirely - a full `/` is a very common cause of this exact symptom. **Runaway process** consuming all CPU or forking repeatedly, so there is nothing left for a new login. **Inode exhaustion**, which behaves like a full disk. And **I/O saturation**, where everything is blocked on a storage device.',
      '**Mitigate before diagnosing** if it is production and users are affected: if there is a load balancer, take the host out of rotation so traffic goes elsewhere while you work on it.',
      'Via the console, the first commands are `uptime`, `free -h`, `df -h`, `df -i`, and `top` - between them they identify almost all of these in under a minute.',
      'And afterwards, the preventive work: **alerting on the leading indicators** - disk approaching full, memory pressure, load climbing - so the next one is caught before the machine becomes unreachable, and **reserving resources** so an administrator can always log in.',
    ],
    code: [
      {
        title: 'From the console, in order',
        language: 'bash',
        code: `uptime                           # load, and how long it has been like this
free -h                          # available, and is swap being used
df -h                            # is / full?
df -i                            # inodes
top -bn1 | head -25              # what is consuming the machine

dmesg -T | tail -50              # OOM kills, disk errors, hardware
journalctl -p err -b --no-pager | tail -50

# A runaway process - identify before killing
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head`,
      },
      {
        title: 'Immediate relief, and preventing a recurrence',
        language: 'bash',
        code: `# Free space quickly - safely, without deleting what is in use
journalctl --vacuum-size=200M
find /var/log -name '*.gz' -mtime +7 -delete
lsof +L1 | head                  # deleted files still held open

# Reserve headroom so root can always log in
tune2fs -m 2 /dev/sda1           # 2% reserved for root on ext4

# systemd can bound a service's resources so it cannot take the host down
# [Service]
# MemoryMax=4G
# CPUQuota=200%
# TasksMax=500`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why is the host unresponsive?',
        caption:
          'A full root filesystem and memory exhaustion cause most of these, and both are preventable.',
        question: 'What do the first few commands show?',
        branches: [
          {
            condition: 'Available memory near zero, swap active',
            result: 'Memory exhaustion',
            detail: 'Everything is waiting on swap I/O',
            tone: 'danger',
          },
          {
            condition: 'Root filesystem 100% full',
            result: 'Disk full',
            detail: 'sshd cannot write; login may fail entirely',
            tone: 'danger',
          },
          {
            condition: 'Load very high, one process dominating',
            result: 'Runaway process',
            detail: 'Nothing left for a new login',
            tone: 'warning',
          },
          {
            condition: 'High iowait, load high, CPU idle',
            result: 'Storage saturated or failing',
            detail: 'Check dmesg for device errors',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Knowing how to reach the serial console before you need it is the difference between a five-minute fix and rebuilding the instance.',
      'Reserved blocks (`tune2fs -m`) mean root can still write when a filesystem is full, which is what lets you recover rather than being locked out.',
      'systemd resource limits on services stop one misbehaving process taking the whole host down, and are rarely applied.',
      'If the machine is truly unrecoverable and it is disposable, replacing it is faster than fixing it - which is an argument for treating servers as replaceable.',
    ],
    traps: [
      'Rebooting immediately, which restores service and destroys all the evidence.',
      'Not knowing how to reach the console until the moment it is needed.',
      'Killing the biggest process without checking what it is.',
      'Fixing the symptom and not adding the alert that would have caught it earlier.',
    ],
    followUps: [
      'A full root filesystem stopped logins. How do you prevent that?',
      'What would you check first on the console?',
    ],
    tags: ['scenario', 'incident', 'troubleshooting', 'console', 'advanced'],
  },
  {
    id: 'itv-linux-18',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you read and search logs on a Linux system?',
    probing: 'Log investigation, covering both journald and files.',
    answer: [
      'On a systemd system most logs are in the **journal**, read with `journalctl`. The options worth knowing: `-u` for a unit, `-f` to follow, `--since`/`--until` for a time range, `-p` for a priority level, `-b` for the current boot and `-b -1` for the previous one, and `-k` for kernel messages.',
      'The **boot** selector matters during an incident: `journalctl -b -1 -p err` shows the errors from before the last reboot, which is exactly what you want when a machine has restarted unexpectedly.',
      'For **files**, `/var/log/` still holds a lot - `syslog` or `messages`, `auth.log` or `secure`, plus per-application directories. `tail -F` follows across rotation where `tail -f` does not, which matters for a long-running follow.',
      'For **searching**, `grep` with `-i`, `-C` for surrounding context and `-E` for extended patterns covers most needs. `zgrep` searches compressed rotated logs without decompressing them, which is what you want when the interesting period is a week ago.',
      'And for anything that happens across more than one machine, this stops scaling - which is the argument for shipping logs centrally. Searching fifteen hosts by hand is both slow and unreliable, and the machine that had the answer may be gone by the time you look.',
    ],
    code: [
      {
        title: 'journalctl and files',
        language: 'bash',
        code: `journalctl -u nginx -f                      # follow one unit
journalctl -u app --since '2 hours ago' -p warning
journalctl -b -1 -p err                     # errors from the PREVIOUS boot
journalctl -k --since today                 # kernel messages
journalctl --disk-usage                     # the journal itself can fill a disk

# Files, including rotated and compressed ones
tail -F /var/log/app/access.log             # -F survives rotation
grep -iC3 'connection refused' /var/log/app/*.log
zgrep -i 'error' /var/log/app/access.log.*.gz

# Around a specific time
awk '$0 >= "2026-09-16 14:20" && $0 <= "2026-09-16 14:40"' /var/log/app/app.log`,
      },
    ],
    traps: [
      '`tail -f` on a file that rotates, which silently follows the old inode and stops showing anything.',
      'Searching only the current log when the interesting period is in a rotated, compressed one.',
      'An unbounded journal filling the disk - `SystemMaxUse` in `journald.conf` bounds it.',
      'Investigating across many hosts by hand rather than centralising.',
    ],
    followUps: [
      'Why does `tail -f` stop working after log rotation?',
      'How would you see the errors from before an unexpected reboot?',
    ],
    tags: ['logs', 'journalctl', 'grep', 'troubleshooting', 'fundamentals'],
  },
  {
    id: 'itv-linux-19',
    level: 'advanced',
    kind: 'open',
    prompt: 'What are namespaces and cgroups, and how do they relate to containers?',
    probing: 'The kernel features containers are built from - depth on something used daily.',
    answer: [
      'They are the two kernel mechanisms that make a container, and they do different jobs. **Namespaces control what a process can see; cgroups control how much it can use.**',
      "The **namespaces**: **PID** so the process sees its own process tree and thinks it is PID 1; **network** for its own interfaces, routing table and ports; **mount** for its own filesystem view; **UTS** for its own hostname; **IPC** for its own shared memory; **user** for its own UID mapping, so root inside can be an unprivileged user outside; and **cgroup** so it cannot see the host's cgroup hierarchy.",
      '**cgroups** limit and account for resources - CPU, memory, block I/O, PIDs. That is what `--memory` and `--cpus` set, and what the OOM killer acts on when a container exceeds its memory limit.',
      'A container is those two things plus a **root filesystem from an image**. There is no "container" object in the kernel - it is a normal Linux process with a restricted view and bounded resources, which is exactly why containers start in milliseconds and a VM does not.',
      'The practical consequences follow directly. **Containers share the host kernel**, so a kernel vulnerability affects all of them and a container cannot run a different kernel. **`--privileged` removes most of this**, which is why it is equivalent to running on the host. And **user namespaces** are what make rootless containers possible, by mapping container-root to an unprivileged host user.',
    ],
    code: [
      {
        title: 'Seeing them directly',
        language: 'bash',
        code: `# Every process's namespaces are in /proc
ls -l /proc/self/ns/
lsns                             # all namespaces on the host

# A container is just a process with different namespaces
docker run -d --name test nginx
pid=$(docker inspect -f '{{.State.Pid}}' test)
ls -l /proc/$pid/ns/             # different inode numbers from the host

# Its cgroup limits
cat /sys/fs/cgroup/$(cat /proc/$pid/cgroup | cut -d: -f3)/memory.max

# Build one by hand - this is essentially what a runtime does
unshare --pid --net --mount --uts --ipc --fork --mount-proc bash
# inside: ps aux shows only this shell; hostname is separate; no interfaces`,
      },
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'What a container actually is',
        caption:
          'No kernel object called a container - a process with a restricted view and bounded resources.',
        root: {
          label: 'A container',
          children: [
            {
              label: 'Namespaces: what it can SEE',
              detail: 'pid, net, mnt, uts, ipc, user, cgroup',
              tone: 'accent',
            },
            {
              label: 'cgroups: how much it can USE',
              detail: 'CPU, memory, block I/O, PIDs',
              tone: 'warning',
            },
            {
              label: 'Root filesystem from an image',
              detail: 'Union mount of the image layers',
              tone: 'success',
            },
            {
              label: 'The host kernel - shared',
              detail: 'Not isolated; this is the security boundary',
              tone: 'danger',
            },
          ],
        },
      },
    ],
    deeper: [
      "The shared kernel is the security boundary, and it is thinner than a VM's. gVisor and Kata exist to add a stronger boundary where multi-tenancy demands it.",
      'cgroup v2 unifies the hierarchy and is what modern systemd and container runtimes use; v1 had a separate hierarchy per controller.',
      "A process can join an existing namespace with `nsenter`, which is how debugging tools attach to a container's network without being in the container.",
      'User namespaces are the basis of rootless containers - container-root maps to an unprivileged host UID.',
    ],
    traps: [
      'Describing a container as a lightweight VM - there is no guest kernel.',
      'Assuming namespace isolation is a security boundary as strong as a hypervisor.',
      'Forgetting that `--privileged` disables most of this.',
    ],
    followUps: [
      'Which of these does `--privileged` remove?',
      'What makes a rootless container possible?',
    ],
    tags: ['namespaces', 'cgroups', 'containers', 'kernel', 'advanced'],
  },
  {
    id: 'itv-linux-20',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you manage users, groups and sudo access?',
    probing: 'Basic administration with the security angle.',
    answer: [
      "`useradd`/`usermod`/`userdel` manage users, `groupadd` and friends manage groups. `id` shows a user's UID, primary group and supplementary groups, and `getent passwd` reads from every configured source including LDAP, not just `/etc/passwd`.",
      'The important distinction is **primary versus supplementary groups**: the primary group owns files the user creates, supplementary groups grant additional access. And `usermod -G` **replaces** the supplementary group list while `usermod -aG` **appends** - using the wrong one silently removes someone from every other group, which is a genuinely common mistake.',
      'For **sudo**, the modern practice is files in `/etc/sudoers.d/` rather than editing `/etc/sudoers`, so package upgrades do not conflict and rules can be managed independently. **Always edit with `visudo`** (or `visudo -f`), because it validates the syntax before saving - a broken sudoers file locks everyone out of privilege escalation on that machine.',
      '**Grant narrowly.** `ALL=(ALL) NOPASSWD: ALL` is equivalent to giving root, and it is extremely common. Restricting to specific commands - and being careful that those commands cannot themselves be used to get a shell - is the difference between delegation and handing over the machine.',
      'And at any scale, **centralised identity** (LDAP, SSSD, an SSO provider) is better than managing users per host, because revocation is immediate rather than as fast as your configuration management runs.',
    ],
    code: [
      {
        title: 'Users, groups and scoped sudo',
        language: 'bash',
        code: `useradd -m -s /bin/bash -G developers alice
usermod -aG docker alice         # -aG APPENDS; -G alone REPLACES
id alice
getent passwd alice              # includes LDAP and other sources

# Sudo: a drop-in file, validated before saving
visudo -f /etc/sudoers.d/deploy`,
      },
      {
        title: 'A scoped sudoers rule',
        language: 'text',
        code: `# /etc/sudoers.d/deploy  (mode 0440)

# Narrow: only these commands, no password
%deployers ALL=(ALL) NOPASSWD: /bin/systemctl restart app, \\
                               /bin/systemctl status app, \\
                               /usr/local/bin/deploy.sh

# Effectively root - grant only where it is genuinely intended
# %developers ALL=(ALL) NOPASSWD: ALL

Defaults logfile=/var/log/sudo.log
Defaults!/usr/bin/vi !requiretty`,
        explanation:
          'Beware of commands that can spawn a shell - allowing sudo vi is equivalent to allowing sudo bash.',
      },
    ],
    traps: [
      '`usermod -G` instead of `-aG`, removing the user from every other group.',
      'Editing sudoers without `visudo`, and a syntax error locking everyone out.',
      'Allowing a command that can spawn a shell - `vi`, `less`, `find -exec` - which grants full root.',
      'Managing users per host at a scale where centralised identity is needed.',
    ],
    followUps: [
      'Why is `sudo vi` effectively `sudo bash`?',
      'What is the difference between `-G` and `-aG`?',
    ],
    tags: ['users', 'groups', 'sudo', 'security', 'fundamentals'],
  },
]
