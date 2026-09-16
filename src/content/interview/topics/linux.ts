import type { InterviewTopic } from '../../types'

export const linuxTopic: InterviewTopic = {
  id: 'linux',
  title: 'Linux & troubleshooting',
  shortTitle: 'Linux',
  icon: '🐧',
  order: 12,
  oneLiner:
    'Permissions, processes, disk, memory, networking and the "the server is slow" question you will definitely be asked.',
  headlines: [
    'Permissions are read/write/execute for user, group and other. On a **directory**, `x` means "may enter", not "may run".',
    'Load average is the number of processes running **or waiting**, including on disk I/O - not CPU percentage.',
    'Linux deliberately uses free memory for cache. Look at **available**, not **free**.',
    'A deleted file still consuming disk means a process holds the file handle open. `lsof +L1` finds it.',
    '`systemctl status`, then `journalctl -u <unit>` - that pair answers most "service is broken" questions.',
    'For "what is it doing?": `strace` for syscalls, `lsof` for open files, `ss` for sockets.',
  ],
  questions: [
    {
      id: 'itv-linux-1',
      level: 'basic',
      kind: 'mcq',
      prompt: 'What does `chmod 754 script.sh` set?',
      options: [
        { id: 'a', text: 'Owner rwx, group r-x, others r--' },
        { id: 'b', text: 'Owner rwx, group rw-, others r-x' },
        { id: 'c', text: 'Owner rw-, group r-x, others r--' },
        { id: 'd', text: 'Owner r-x, group rwx, others -w-' },
      ],
      correct: ['a'],
      probing:
        'Octal permissions. Everyday knowledge, and getting it wrong on a production file is a real incident.',
      answer: [
        'Each digit is a sum: read is 4, write is 2, execute is 1. The three digits are owner, group and others.',
        '7 is 4+2+1 = `rwx`. 5 is 4+1 = `r-x`. 4 is `r--`. So `754` is owner `rwx`, group `r-x`, others `r--`.',
        'The combinations worth knowing by sight: `755` for executables and directories, `644` for regular files, `600` for private files like SSH keys or credentials, and `700` for a private directory.',
        'The one that catches people out is the **directory** meaning. On a directory, `r` lets you list the names, `w` lets you create and delete entries, and `x` lets you **enter it and access things inside**. A directory with `r` but no `x` lets you see the filenames but not read the files - which is a surprisingly common misconfiguration.',
      ],
      code: [
        {
          title: 'Reading and setting permissions',
          language: 'bash',
          code: `ls -l script.sh
# -rwxr-xr--  1 alice devs  1024 Sep 16 10:00 script.sh
#  ^^^         owner  rwx = 7
#     ^^^      group  r-x = 5
#        ^^^   other  r-- = 4

chmod 754 script.sh
chmod u=rwx,g=rx,o=r script.sh       # identical, symbolic form
chmod +x script.sh                    # add execute for everyone
chmod u+x,go-w script.sh              # targeted changes

# The values that matter in practice
chmod 600 ~/.ssh/id_ed25519          # private key - SSH REFUSES anything looser
chmod 644 /etc/app/config.yaml       # readable config
chmod 755 /usr/local/bin/deploy      # executable
chmod 700 ~/.ssh                     # private directory

# Directory x means "may enter", which is easy to get wrong
chmod 644 /srv/data                  # you can list names, NOT read files inside
chmod 755 /srv/data                  # correct for a readable directory

# Special bits
chmod +t /tmp                        # sticky: only the owner may delete
chmod g+s /srv/shared                # setgid: new files inherit the group`,
        },
      ],
      deeper: [
        '`umask` determines the default permissions for newly created files - it is subtracted from 666 for files and 777 for directories. A umask of 022 gives 644 and 755, which is the usual default.',
        'For anything finer-grained than owner/group/other, ACLs (`setfacl`, `getfacl`) let you grant a specific user access without changing ownership.',
      ],
      traps: [
        'Reaching for `chmod 777` to fix a permission problem. It is almost never the right answer and it is a security finding.',
        'Forgetting that `x` on a directory means traverse, not execute.',
      ],
      followUps: [
        'What does the execute bit mean on a directory?',
        'What is umask?',
        'Why does SSH refuse a key with 644?',
      ],
      tags: ['permissions', 'filesystem', 'basics'],
    },
    {
      id: 'itv-linux-2',
      level: 'basic',
      kind: 'open',
      prompt: 'A server is running out of disk space. How do you find what is using it?',
      probing: 'A universal operational task, with one classic twist - the deleted-but-open file.',
      answer: [
        'First `df -h` to see **which filesystem** is full, because it is easy to spend ten minutes searching the wrong one. I would also check `df -i` for inodes - a filesystem can be "full" with plenty of space if it has run out of inodes, typically from millions of tiny files.',
        'Then `du` to narrow it down, working top-down: `du -h --max-depth=1 /` to find the big directory, then repeat inside it. `ncdu` does the same interactively and is much nicer if it is installed.',
        'The usual culprits on a server are `/var/log` (a log with no rotation), `/var/lib/docker` (images and dangling volumes), and application temp directories.',
        'The important twist: if `du` shows far less than `df` reports as used, the space is held by **deleted files that a process still has open**. The file is gone from the directory tree but the inode is not freed until the last file descriptor closes. `lsof +L1` lists exactly those, and restarting the holding process releases the space immediately.',
        'That case comes up constantly with log files that were deleted by hand instead of being truncated or rotated.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Finding the space',
          caption:
            'The df-versus-du mismatch is the one that wastes hours if you do not know to look for it.',
          nodes: [
            {
              label: 'df -h and df -i',
              detail: 'Which filesystem, and is it space or inodes?',
              tone: 'accent',
              branch: {
                label: 'Inodes exhausted',
                detail: 'Millions of small files - find the directory, not the big file',
              },
            },
            {
              label: 'du --max-depth=1, descending',
              detail: 'Narrow down one level at a time',
            },
            {
              label: 'Does du roughly match df?',
              detail: 'The key comparison',
              branch: {
                label: 'du much smaller than df',
                detail: 'Deleted files held open. lsof +L1',
              },
            },
            {
              label: 'Found it: rotate, truncate or prune',
              detail: 'Then fix the cause so it does not recur',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The commands, in order',
          language: 'bash',
          code: `df -h                       # which filesystem is full?
df -i                       # inodes - a different kind of full

# Narrow down, largest first
du -h --max-depth=1 / 2>/dev/null | sort -rh | head -20
du -h --max-depth=1 /var | sort -rh | head -20
ncdu /var                   # interactive, much nicer if available

# Largest individual files
find / -xdev -type f -size +500M -exec ls -lh {} + 2>/dev/null

# THE CLASSIC: du says 20G, df says 95G used
lsof +L1                    # open files with a link count of 0
# COMMAND  PID  USER  FD  TYPE  SIZE/OFF  NLINK  NODE NAME
# java    1234  app   3w  REG   64424509      0  1234 /var/log/app.log (deleted)

# Release it WITHOUT restarting the process:
: > /proc/1234/fd/3         # truncate through the file descriptor

# The right way to empty a live log file in the first place:
: > /var/log/app.log        # truncate - keeps the inode and the handle
# NOT: rm /var/log/app.log  # removes the name, space stays held

# Docker is often the answer on a build host
docker system df
docker system prune -a --volumes    # destructive - read the output first

# Journal logs can grow unbounded
journalctl --disk-usage
journalctl --vacuum-time=7d`,
        },
      ],
      traps: [
        'Deleting a log file that is open. The space is not released, and now you cannot even read the log.',
        'Running `du` from `/` without `-x`, so it crosses into network mounts and takes forever.',
        'Freeing space without fixing the cause - it fills up again the same week.',
      ],
      followUps: [
        'What if du and df disagree?',
        'How do you empty a log file that is being written to?',
        'What does running out of inodes look like?',
      ],
      tags: ['disk', 'troubleshooting', 'filesystem'],
    },
    {
      id: 'itv-linux-3',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain load average. What does "load average: 4.5" actually mean?',
      probing: 'Very commonly misunderstood. People read it as a CPU percentage, which it is not.',
      answer: [
        'Load average is the average number of processes that are either **running on a CPU** or **waiting to run** - and on Linux specifically, it also includes processes in **uninterruptible sleep**, which in practice means blocked on disk or network I/O.',
        'That last inclusion is what makes Linux load average different from other Unixes, and it is why a machine with idle CPUs can show a high load: everything is waiting on a slow disk.',
        'The number must be read **relative to the core count**. A load of 4.5 on a 4-core machine means slightly more work than capacity - mild contention. On a 16-core machine it means the box is 70% idle.',
        'The three numbers are 1-, 5- and 15-minute averages, and the **trend** matters more than any single value. Rising means the problem is growing; falling means it is recovering; all three similar means it is steady.',
        'So load on its own tells you there is pressure but not what kind. I would immediately pair it with `vmstat` to see whether processes are in the run queue (`r`) or blocked on I/O (`b`), which distinguishes CPU saturation from I/O saturation - and those have completely different fixes.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'High load - what kind?',
          caption: 'Load alone cannot distinguish these, and they have entirely different fixes.',
          question: 'What does vmstat show alongside the load?',
          branches: [
            {
              condition: 'high r, low b, high user CPU',
              result: 'CPU saturation',
              detail: 'Genuinely compute-bound. Profile it, or add cores.',
              tone: 'accent',
            },
            {
              condition: 'high b, high iowait, low CPU',
              result: 'I/O bound',
              detail: 'Disk or network is the bottleneck, not the CPU',
            },
            {
              condition: 'high load, si/so non-zero',
              result: 'Swapping',
              detail: 'Memory pressure. Adding CPU will not help.',
              tone: 'warning',
            },
            {
              condition: 'load high but everything idle',
              result: 'Processes stuck in D state',
              detail: 'Usually a hung NFS mount or failing disk',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Interpreting it properly',
          language: 'bash',
          code: `uptime
#  10:42:01 up 40 days,  load average: 4.52, 3.81, 2.15
#                                      1min  5min  15min   - and RISING

nproc                       # 4 cores, so 4.52 means fully loaded
                            # 16 cores, and it means 70% idle

# The decisive command: is it CPU or I/O?
vmstat 1 5
# procs -----------memory---------- ---swap-- -----io---- --system-- ------cpu-----
#  r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
#  1  7      0 123456  45678 890123    0    0  4521   120 1520 3200  5  3 12 80  0
#     ^ 7 processes BLOCKED on I/O                                            ^^ 80% iowait
# Diagnosis: not CPU-bound at all. The disk is the bottleneck.

# Per-CPU and iowait detail
mpstat -P ALL 1 3
iostat -xz 1 3              # %util near 100 and high await = saturated disk

# Which processes are in uninterruptible sleep (D state)?
ps -eo state,pid,comm,wchan | awk '$1 ~ /D/'

top -o %CPU                 # or press "1" in top for per-core breakdown`,
        },
      ],
      traps: [
        'Reading load as a percentage. A load of 1.0 is 100% of one core, not 100% of the machine.',
        'Comparing load between machines with different core counts.',
        'Concluding "CPU problem" from load alone - on Linux, I/O wait is included.',
      ],
      followUps: [
        'What is iowait, and why does it inflate load?',
        'What is a D-state process and why can you not kill it?',
        'How would you tell CPU saturation from disk saturation?',
      ],
      tags: ['performance', 'load', 'monitoring'],
    },
    {
      id: 'itv-linux-4',
      level: 'intermediate',
      kind: 'mcq',
      prompt: '`free -h` shows 500MB free out of 32GB on a production server. Is this a problem?',
      options: [
        { id: 'a', text: 'Yes - the server is nearly out of memory and will start swapping' },
        {
          id: 'b',
          text: 'Not necessarily - Linux uses free memory for cache; check the "available" column',
        },
        { id: 'c', text: 'Yes - you should immediately restart the largest process' },
        { id: 'd', text: 'It cannot be determined without checking swap usage' },
      ],
      correct: ['b'],
      probing:
        'A universal misunderstanding. "Low free memory" alarms cause a lot of unnecessary work.',
      answer: [
        'Low **free** memory on Linux is normal and usually healthy. Linux deliberately uses otherwise-idle RAM for the page cache, because unused memory is wasted memory - cached file data makes everything faster, and it is discarded instantly when an application needs the space.',
        'The column to read is **available**, which is free memory plus the cache that can be reclaimed immediately. If `available` is healthy, there is no memory pressure regardless of what `free` says.',
        'The real signals of memory pressure are: `available` genuinely low, **swap in/out activity** (`si`/`so` in `vmstat` consistently non-zero - swap being *used* is far less concerning than swap being actively *paged*), and OOM killer messages in `dmesg`.',
        'So the answer to "we only have 500MB free" is almost always "that is fine, look at available". Alerting on free memory rather than available memory is a classic source of false pages.',
      ],
      code: [
        {
          title: 'Reading memory correctly',
          language: 'bash',
          code: `free -h
#               total  used   free  shared  buff/cache  available
# Mem:            31Gi  12Gi  500Mi   1.2Gi        18Gi       17Gi
#                              ^^^^                            ^^^^
#                        looks alarming              the number that matters
#
# 17Gi available: the 18Gi of cache is reclaimable on demand. No pressure.

# Actual pressure indicators
vmstat 1 5
#  si  so     <- swap in / swap out. Consistently non-zero = real pressure.

dmesg -T | grep -i -E 'out of memory|killed process'
# [Mon Sep 16 03:14:22] Out of memory: Killed process 4821 (java)

# Which processes use the most?
ps -eo pid,user,rss,comm --sort=-rss | head -10
#                        ^^^ resident set size, in KB

# Modern kernels expose real pressure directly - this is the best signal
cat /proc/pressure/memory
# some avg10=0.00 avg60=0.00 avg300=0.00 total=0
# full avg10=0.00 avg60=0.00 avg300=0.00 total=0
# Non-zero avg10 means tasks ARE stalling on memory right now.`,
        },
      ],
      deeper: [
        '`/proc/pressure/memory` (Pressure Stall Information) is the genuinely modern answer and worth mentioning - it reports the proportion of time tasks were stalled waiting for memory, which is a direct measure of pressure rather than a proxy.',
        'In containers this all changes: a container sees the host’s memory in `free` unless the runtime is careful, but is limited by its **cgroup**. `cat /sys/fs/cgroup/memory.max` and `memory.current` are what matter there, and exceeding the limit means OOMKilled regardless of host free memory.',
      ],
      traps: [
        'Alerting on `free` rather than `available`. It generates constant false alarms.',
        'Treating swap being used as an emergency. Swap **usage** is often just idle pages parked; swap **activity** is the problem.',
        'Running `echo 3 > /proc/sys/vm/drop_caches` to "free memory". It drops useful cache and makes everything slower.',
      ],
      followUps: [
        'What is the difference between free and available?',
        'Is swap being used always bad?',
        'How does this differ inside a container?',
      ],
      tags: ['memory', 'performance', 'troubleshooting'],
    },
    {
      id: 'itv-linux-5',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        '"The application server is slow." You have SSH access and nothing else. Walk me through your first five minutes.',
      probing:
        'The definitive open-ended Linux question. They want a systematic method, not a list of commands.',
      answer: [
        'I would work through the resources in order - CPU, memory, disk, network - because that narrows it fast and stops me guessing. Netflix published this as a "first 60 seconds" checklist and it is a genuinely good structure.',
        '**First, is it real and is it new?** `uptime` gives me load and the trend across 1, 5 and 15 minutes, and tells me whether the box recently rebooted. `dmesg -T | tail` shows OOM kills, disk errors or network resets immediately.',
        '**Then CPU.** `vmstat 1 5` - the `r` column for run queue, `wa` for iowait, `si`/`so` for swapping. That one command distinguishes CPU-bound from I/O-bound from memory-starved, which are three completely different problems.',
        '**Then memory.** `free -h`, reading **available** not free, plus `/proc/pressure/memory` if the kernel supports it.',
        '**Then disk.** `iostat -xz 1 3` - `%util` near 100 with high `await` means the disk is saturated. And `df -h`, because a full disk presents as "everything is slow" surprisingly often.',
        '**Then network and the application itself.** `ss -s` for socket summary, and a check for connection exhaustion or a backlog. Then `top` to find which process is actually responsible, and its logs.',
        'Throughout, I would be asking: what changed? A deploy, a config change, a traffic increase, or a dependency degrading are far more likely than the machine spontaneously becoming slow.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'The first five minutes',
          caption:
            'Resource by resource, in order. vmstat in step two eliminates most of the search space on its own.',
          nodes: [
            {
              label: 'uptime, dmesg -T | tail',
              detail: 'Load trend, recent reboot, OOM kills, disk errors',
              tone: 'accent',
            },
            {
              label: 'vmstat 1 5',
              detail: 'r, b, wa, si, so - CPU vs I/O vs memory in one command',
              arrowLabel: 'the highest-yield step',
              branch: {
                label: 'si/so non-zero',
                detail: 'Swapping - memory pressure is the root cause',
              },
            },
            {
              label: 'free -h and /proc/pressure/memory',
              detail: 'Read available, not free',
            },
            {
              label: 'iostat -xz 1 3, df -h',
              detail: '%util and await; and is a filesystem simply full?',
            },
            {
              label: 'ss -s, then top and the app logs',
              detail: 'Connections, then which process, then why',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The checklist, runnable',
          language: 'bash',
          code: `# 1. Context - is it new, and did something obvious happen?
uptime
dmesg -T | tail -30
last reboot | head -3

# 2. CPU vs I/O vs memory - the single highest-yield command
vmstat 1 5
#  r  b  ...  si  so  ...  us sy id wa st
#  ^ run queue                      ^ iowait
#     ^ blocked on I/O
#                ^^^^^ swapping

mpstat -P ALL 1 3            # is one core pinned, or all of them?

# 3. Memory
free -h                       # read AVAILABLE
cat /proc/pressure/memory 2>/dev/null

# 4. Disk
iostat -xz 1 3                # %util ~100 + high await = saturated
df -h                         # a full disk looks like "everything is slow"

# 5. Network
ss -s                         # socket summary
ss -tan state time-wait | wc -l
netstat -s | grep -i -E 'retransmit|overflow|dropped'

# 6. Now find the culprit process
top -o %CPU
ps -eo pid,ppid,user,%cpu,%mem,etime,cmd --sort=-%cpu | head -15

# 7. What is that process actually doing?
strace -c -p <PID>            # syscall summary - where is time going?
lsof -p <PID> | head -30      # open files and sockets
cat /proc/<PID>/status | grep -E 'Threads|VmRSS|voluntary'`,
        },
      ],
      deeper: [
        'A point worth making: "slow" is not a diagnosis. Before touching the box I would want to know slow **for whom** and **since when** - all users or some, all endpoints or one, starting at a deploy or gradually. That often identifies the cause faster than any command.',
        'And if the machine shows no resource pressure at all, the bottleneck is almost certainly **downstream** - a slow database, a saturated dependency, or DNS. At that point `strace -c` showing time in `recvfrom` or a lot of time in `poll` points straight at waiting on something else.',
      ],
      traps: [
        'Jumping straight to `top` and staring at it. It tells you what is busy, not what kind of pressure the system is under.',
        'Restarting the application before gathering evidence. It often "fixes" it and destroys every clue.',
        'Not asking what changed. Machines rarely become slow on their own.',
      ],
      followUps: [
        'What if every resource looks fine?',
        'How would you check whether the database is the bottleneck?',
        'What does a high number of TIME_WAIT sockets indicate?',
      ],
      tags: ['scenario', 'troubleshooting', 'performance', 'methodology'],
    },
    {
      id: 'itv-linux-6',
      level: 'advanced',
      kind: 'open',
      prompt: 'How do you troubleshoot a systemd service that will not start?',
      probing: 'Everyday operational work on any modern Linux system.',
      answer: [
        'The two commands that answer most cases are `systemctl status <unit>` and `journalctl -u <unit>`.',
        '`systemctl status` gives the current state, the main PID, the **exit code** of the last run, and the last few log lines. The exit code alone often settles it - 203 means the executable was not found or is not executable, 200-series codes generally mean systemd could not start the process at all rather than the process failing.',
        '`journalctl -u <unit> -n 100 --no-pager` gives the full log, and `-b` limits it to the current boot. `-f` follows it while I try to start the service again in another terminal, which is usually the fastest way to see what happens.',
        'If the logs are unhelpful, I would check the unit file itself with `systemctl cat <unit>`, which shows the effective configuration including drop-ins - people forget drop-in overrides exist and then cannot explain the behaviour.',
        'Then the usual suspects: a wrong `ExecStart` path, the `User` lacking permission on a file or directory, a missing `WorkingDirectory`, a dependency not started, an environment variable the service needs that is present in your shell but not in the unit, or SELinux/AppArmor denying something - which shows in `dmesg` or the audit log rather than the service log.',
        'Finally, `systemd-analyze verify` catches syntax problems in the unit file itself.',
      ],
      code: [
        {
          title: 'The sequence',
          language: 'bash',
          code: `systemctl status myapp.service
# ● myapp.service - My Application
#    Loaded: loaded (/etc/systemd/system/myapp.service; enabled)
#    Active: failed (Result: exit-code) since Mon 2026-09-16 10:32:01
#   Process: 4821 ExecStart=/usr/local/bin/myapp (code=exited, status=203/EXEC)
#                                                              ^^^ not found
#                                                                  or not +x

journalctl -u myapp.service -n 100 --no-pager
journalctl -u myapp.service -b            # this boot only
journalctl -u myapp.service -f            # follow, then start it again
journalctl -u myapp.service --since "10 minutes ago" -p err

# The EFFECTIVE unit, including drop-in overrides people forget about
systemctl cat myapp.service
systemctl show myapp.service | grep -E 'ExecStart|User|WorkingDirectory'

# Verify the unit file syntax
systemd-analyze verify /etc/systemd/system/myapp.service

# Reproduce by hand, as the service user - this finds permission problems fast
sudo -u appuser /usr/local/bin/myapp

# Check the obvious
ls -l /usr/local/bin/myapp                # exists? executable? right owner?
id appuser
systemctl list-dependencies myapp.service

# Security policy denials do NOT appear in the service log
dmesg -T | grep -i -E 'denied|avc'
ausearch -m avc -ts recent 2>/dev/null

# After editing a unit file - forgetting this is very common
systemctl daemon-reload
systemctl restart myapp.service`,
        },
        {
          title: 'Common exit codes',
          language: 'text',
          code: `status=203/EXEC       ExecStart binary not found, or not executable
status=200/CHDIR      WorkingDirectory does not exist
status=exited, 1      the application itself errored - read its logs
status=killed, 9      OOM killed, or something sent SIGKILL
status=timeout        did not signal readiness within TimeoutStartSec
                      (very common with Type=notify when the app does
                       not actually send the notification)`,
        },
      ],
      traps: [
        'Editing a unit file and not running `systemctl daemon-reload`. The old definition stays active and nothing you change has any effect.',
        'Assuming the service log has everything. SELinux and AppArmor denials appear in `dmesg` and the audit log instead.',
        'Missing that a drop-in in `/etc/systemd/system/<unit>.d/` is overriding what you are reading.',
      ],
      followUps: [
        'What does exit code 203 mean?',
        'Why might a service work when run by hand but not under systemd?',
        'What does Type=notify require from the application?',
      ],
      tags: ['systemd', 'troubleshooting', 'services'],
    },
    {
      id: 'itv-linux-7',
      level: 'advanced',
      kind: 'open',
      prompt:
        'A service cannot reach another host on port 443. Walk me through diagnosing it layer by layer.',
      probing:
        'Network troubleshooting methodology. They want to see you bisect rather than guess.',
      answer: [
        'I would work up the layers, because each step eliminates a whole class of cause.',
        '**Name resolution first.** `dig` or `getent hosts` - does the name resolve at all, and to the address I expect? A surprising share of "network problems" are DNS, and inside containers it is usually a wrong search domain or a broken resolver.',
        '**Then reachability.** `ping` tells me whether the host answers ICMP, though plenty of hosts block it, so a failed ping is weak evidence. `traceroute` or `mtr` shows where packets stop, which distinguishes "our network" from "their network".',
        '**Then the port specifically.** `nc -zv host 443` or `curl -v telnet://host:443` attempts an actual TCP connection. The **failure mode is the diagnosis**: **connection refused** means something answered and rejected - the host is reachable and nothing is listening, or the service is down. **Timeout** means packets are being dropped silently, which is a firewall, security group or routing problem.',
        'That distinction is the single most useful thing in network debugging, and it is worth saying explicitly.',
        '**Then TLS.** If TCP connects but the application fails, `openssl s_client -connect host:443` shows the certificate, the chain and the negotiated protocol. Expired certificates, missing intermediates and a hostname mismatch all present as vague application errors.',
        '**Then the local side.** `ss -tan` for connection states, local firewall rules, and whether we have exhausted ephemeral ports or hit a connection limit.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Bisecting the path',
          caption:
            'Refused versus timeout is the key distinction - they point at completely different causes.',
          nodes: [
            {
              label: 'Does the name resolve?',
              detail: 'dig +short host, getent hosts host',
              tone: 'accent',
              branch: {
                label: 'No, or wrong address',
                detail: 'DNS: resolver, search domain, or a stale record',
              },
            },
            {
              label: 'Is the host reachable?',
              detail: 'ping, then mtr to see where it stops',
              arrowLabel: 'resolves correctly',
            },
            {
              label: 'Does TCP/443 connect?',
              detail: 'nc -zv host 443',
              branch: {
                label: 'Connection REFUSED',
                detail: 'Reachable, nothing listening. Service down, or wrong port.',
              },
            },
            {
              label: 'TIMEOUT instead?',
              detail: 'Packets silently dropped: firewall, security group, NetworkPolicy',
              tone: 'warning',
            },
            {
              label: 'TCP fine - check TLS and the app',
              detail: 'openssl s_client: expiry, chain, hostname',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Layer by layer',
          language: 'bash',
          code: `# 1. DNS
dig +short api.example.com
getent hosts api.example.com        # uses the same path the app does
cat /etc/resolv.conf

# 2. Reachability
ping -c 3 api.example.com           # may be blocked - weak evidence either way
mtr -rwc 10 api.example.com         # where do packets stop?

# 3. The port. The failure MODE is the diagnosis.
nc -zv api.example.com 443
#   "succeeded"           -> TCP is fine, look higher
#   "Connection refused"  -> reachable, nothing listening there
#   "timed out"           -> silently dropped: firewall / SG / NetworkPolicy

timeout 5 bash -c 'cat < /dev/null > /dev/tcp/api.example.com/443' \\
  && echo open || echo "closed or filtered"

# 4. TLS
openssl s_client -connect api.example.com:443 -servername api.example.com </dev/null \\
  | openssl x509 -noout -subject -issuer -dates

# 5. The application layer
curl -vsS --max-time 10 https://api.example.com/health -o /dev/null

# 6. The local side
ss -tan | awk '{print $1}' | sort | uniq -c        # connection states
ss -tanp 'dst api.example.com'
sudo iptables -L -n -v | head -30                  # or nft list ruleset
sysctl net.ipv4.ip_local_port_range                # ephemeral port exhaustion?

# 7. See the packets if all else fails
sudo tcpdump -ni any host api.example.com and port 443 -c 20
# SYN with no SYN-ACK  -> dropped on the way out or in
# SYN then RST         -> actively refused`,
        },
      ],
      deeper: [
        'Inside Kubernetes the same method applies but with extra layers: check the Service has endpoints, that DNS resolves the service name, and whether a NetworkPolicy is dropping the traffic. A NetworkPolicy denial always presents as a **timeout**, never a refusal, which is exactly the distinction above.',
        'If `tcpdump` shows the SYN leaving and no response, the problem is outside this host. If it shows no SYN at all, the application never attempted the connection - which points at the application config or a local resolver failure.',
      ],
      traps: [
        'Concluding the network is broken because `ping` fails. ICMP is very commonly blocked.',
        'Not distinguishing refused from timeout - they have opposite causes.',
        'Testing from the wrong place. Test from the machine or Pod that is actually failing, not from your laptop.',
      ],
      followUps: [
        'What does a timeout tell you that a refusal does not?',
        'How would this differ inside a Kubernetes Pod?',
        'What would tcpdump showing SYN but no SYN-ACK mean?',
      ],
      tags: ['networking', 'troubleshooting', 'tls', 'methodology'],
    },
  ],
}
