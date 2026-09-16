import type { InterviewQuestion } from '../../../types'

/** The remaining Linux ground: everyday commands, tuning and practical tasks. */
export const linuxPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-linux-34',
    level: 'basic',
    kind: 'open',
    prompt: 'Which commands would you want on any machine you have to work on?',
    probing: 'Breadth of everyday vocabulary, and what you reach for first.',
    answer: [
      'For **orientation**: `uname -a`, `cat /etc/os-release`, `uptime`, `hostnamectl`, `lscpu`, `free -h`, `df -h`, `lsblk` - between them they tell you what the machine is and what state it is in within about thirty seconds.',
      'For **processes**: `ps auxf`, `top` or `htop`, `pgrep`/`pkill`, `lsof`, `pstree`.',
      'For **networking**: `ip addr`, `ip route`, `ss -tulpn`, `dig`, `curl -v`, `nc -zv`, and `tcpdump` when the cheaper tools have not answered it.',
      'For **files and text**: `find`, `grep -rn`, `awk`, `sed`, `sort`, `uniq`, `head`/`tail`, `less`, `du`, `stat`, `file`.',
      'For **services and logs**: `systemctl`, `journalctl`, `dmesg -T`.',
      'And the ones people forget that are genuinely useful: **`watch`** to repeat a command and see something change, **`timeout`** to bound anything that might hang, **`nohup`** or `setsid` to survive a disconnect, **`tee`** to log a pipeline without breaking it, and **`column -t`** to make output readable.',
    ],
    code: [
      {
        title: 'The first thirty seconds on an unfamiliar host',
        language: 'bash',
        code: `cat /etc/os-release | head -2 && uname -r
uptime && nproc && free -h
df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs
lsblk -f
ip -brief addr
ss -tulpn | head -20
systemctl list-units --failed
journalctl -p err -b --no-pager | tail -20`,
      },
      {
        title: 'The underused ones',
        language: 'bash',
        code: `watch -n2 'ss -s'                    # repeat and observe change
timeout 30 ./might-hang.sh           # bound anything that could stick
nohup ./long-job.sh > job.log 2>&1 & # survive a disconnect
./build.sh 2>&1 | tee build.log      # log without breaking the pipeline
mount | column -t                    # readable
dmesg -T --level=err,warn | tail -30 # human timestamps`,
      },
    ],
    traps: [
      'Not checking `systemctl --failed` and `journalctl -p err`, which often name the problem immediately.',
      '`dmesg` without `-T`, giving seconds since boot rather than timestamps.',
      'Long-running commands without `nohup` or `tmux`, lost when the connection drops.',
    ],
    followUps: ['What would you run first on a host you had never seen?'],
    tags: ['commands', 'orientation', 'toolkit', 'fundamentals'],
  },
  {
    id: 'itv-linux-35',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you keep a long-running command alive across a disconnected session?',
    probing: 'A practical problem everyone hits, with several answers.',
    answer: [
      'The problem is that when an SSH session ends, the shell sends **SIGHUP** to its children, which terminates them. A long upgrade or migration dies halfway when the connection drops.',
      '**`tmux`** or **`screen`** is the right answer for interactive work. The session runs on the server independently of your connection; detach with a keystroke, reconnect later and reattach with everything exactly as you left it - including scrollback. It also means a colleague can attach to the same session, which is genuinely useful during an incident.',
      '**`nohup command &`** makes the process ignore SIGHUP and redirects output to a file. It is fine for fire-and-forget, and you lose interactivity - you cannot answer a prompt or see progress except through the log.',
      '**`setsid`** goes further by detaching from the controlling terminal entirely, and **`systemd-run --scope`** runs it under systemd so it survives independently and is visible in `systemctl`.',
      'The practical advice: **start anything that will take more than a minute or two in tmux, by habit**. It costs nothing when the connection holds and saves the job when it does not - and the number of long migrations lost to a dropped connection is not small.',
    ],
    code: [
      {
        title: 'tmux for anything long',
        language: 'bash',
        code: `tmux new -s migration            # start a named session
# ... run the long job ...
# Ctrl-b then d to detach; the job keeps running

tmux ls                          # what sessions exist?
tmux attach -t migration         # reattach, from anywhere

# Useful inside:  Ctrl-b c  new window   Ctrl-b "  split   Ctrl-b [  scrollback`,
      },
      {
        title: 'The non-interactive alternatives',
        language: 'bash',
        code: `nohup ./long-migration.sh > /var/log/migration.log 2>&1 &
echo $! > /var/run/migration.pid

setsid ./long-job.sh > job.log 2>&1 < /dev/null &

# Under systemd - survives independently, visible and manageable
systemd-run --unit=migration --scope ./long-migration.sh
systemctl status migration`,
      },
    ],
    traps: [
      'Starting a long job directly and losing it when the connection drops.',
      '`nohup` without redirecting stdin, which can still block on a terminal read.',
      'Forgetting which tmux session something is in - name them.',
      'Assuming `&` alone protects the job. It does not; SIGHUP still reaches it.',
    ],
    followUps: ['Why does `&` alone not protect a background job?'],
    tags: ['tmux', 'nohup', 'ssh', 'sessions', 'practical'],
  },
  {
    id: 'itv-linux-36',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does `ulimit -n` control, and where does it matter?',
    probing: 'Resource limits and the confusion about where they apply.',
    options: [
      {
        id: 'a',
        text: 'The maximum open file descriptors per process - which includes sockets, so it limits concurrent connections',
      },
      { id: 'b', text: 'The maximum number of processes a user can run' },
      { id: 'c', text: 'The maximum size of a single file' },
      { id: 'd', text: 'The amount of memory a process can allocate' },
    ],
    correct: ['a'],
    answer: [
      '`ulimit -n` is the per-process limit on **open file descriptors**. The thing people miss is that **sockets are file descriptors**, so this limit caps concurrent network connections just as much as open files. A web server hitting it fails with "too many open files" and stops accepting connections.',
      'The default is commonly 1024, which a busy server exceeds easily. There is a **soft** limit (`ulimit -Sn`, which a process can raise itself up to the hard limit) and a **hard** limit (`ulimit -Hn`, which only root can raise).',
      'The confusion that costs time: **`ulimit` in a shell applies to that shell and its children only**. It does **not** apply to a service started by systemd, which uses **`LimitNOFILE=`** in the unit file. Setting `ulimit` in `/etc/security/limits.conf` and expecting a systemd service to pick it up is a common and entirely reasonable mistake.',
      'The authoritative answer for a running process is `/proc/PID/limits`, which shows what it actually has rather than what you think you configured.',
    ],
    code: [
      {
        title: 'Checking and setting, in the right place',
        language: 'bash',
        code: `ulimit -n          # soft, for this shell
ulimit -Hn         # hard

# What does the RUNNING process actually have?
cat /proc/$(pgrep -f '[n]ginx' | head -1)/limits | grep 'open files'
ls /proc/1234/fd | wc -l          # how many is it using?

# For a login session
# /etc/security/limits.conf
# app  soft  nofile  65536
# app  hard  nofile  131072

# For a systemd service - limits.conf does NOT apply here
# systemctl edit app.service
# [Service]
# LimitNOFILE=65536

systemctl show app -p LimitNOFILE`,
      },
    ],
    traps: [
      'Setting `limits.conf` and expecting a systemd service to honour it.',
      'Forgetting that sockets count, so the limit caps concurrent connections.',
      'Raising the soft limit above the hard limit, which fails.',
      "Checking the shell's limit rather than the running process's.",
    ],
    followUps: [
      'Why does `limits.conf` not apply to a systemd service?',
      'Why does this limit affect the number of connections?',
    ],
    tags: ['ulimit', 'file descriptors', 'systemd', 'limits', 'troubleshooting'],
  },
  {
    id: 'itv-linux-37',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you benchmark or capacity-plan a Linux server?',
    probing: 'Measurement method rather than tool names.',
    answer: [
      'The first thing is to **know what you are measuring and why**. "How fast is this server" is not answerable; "can this server handle 2,000 requests per second at under 200 ms p99" is, and it determines everything about how you measure.',
      '**Establish a baseline** with synthetic tools for each resource, so you know the ceiling: `fio` for disk (and crucially with the right I/O pattern - random 4k behaves nothing like sequential 1M), `iperf3` for network, `stress-ng` for CPU and memory. That tells you what the hardware can do.',
      "Then **test the actual application** under a realistic load profile. Synthetic benchmarks tell you the hardware's limits; they tell you very little about your workload, which is usually bound by something other than raw resource - a database connection pool, a lock, a downstream service.",
      '**Find the knee**, not the maximum. Increase load gradually and watch latency: throughput rises linearly and then latency starts climbing sharply while throughput plateaus. The useful capacity number is just below that point, not the maximum throughput at which the system is technically still responding.',
      '**Measure what users experience** - latency percentiles, not averages - and **watch the saturation signals** during the test: CPU, iowait, connection counts, queue depths. The one that saturates first is the constraint, and it is frequently not the one people expected.',
      'And **plan with headroom**: capacity for peak, plus room to lose a node, plus growth. Sizing for average load means being under-provisioned most of the time that matters.',
    ],
    code: [
      {
        title: 'Baseline the resources',
        language: 'bash',
        code: `# Disk - the I/O PATTERN matters more than the tool
fio --name=randwrite --rw=randwrite --bs=4k --size=4G --numjobs=4 \\
    --runtime=60 --time_based --group_reporting --direct=1 \\
    --filename=/var/lib/test/fio.dat

# Network
iperf3 -s                         # on one host
iperf3 -c other-host -t 30 -P 4   # on the other

# CPU and memory
stress-ng --cpu 8 --timeout 60 --metrics-brief
stress-ng --vm 4 --vm-bytes 2G --timeout 60`,
      },
      {
        title: 'Load test the application, and find the knee',
        language: 'bash',
        code: `# Step the load up and watch where latency turns
for rate in 200 500 1000 1500 2000 2500; do
  echo "=== \${rate} rps"
  vegeta attack -rate="\${rate}" -duration=60s -targets=targets.txt |
    vegeta report -type='hist[0,50ms,100ms,200ms,500ms,1s]'
done

# Watch saturation during the test, in another window
watch -n1 'uptime; ss -s | head -3; iostat -x 1 2 | tail -5'`,
      },
    ],
    traps: [
      'Benchmarking with an I/O pattern that does not resemble the workload.',
      'Reporting maximum throughput as capacity, ignoring where latency degraded.',
      'Testing on a machine that is also doing something else.',
      'Sizing for average load rather than peak plus failure headroom.',
    ],
    followUps: [
      'What is the "knee" and why is it the number that matters?',
      'Why does the I/O pattern matter so much for disk benchmarking?',
    ],
    tags: ['benchmarking', 'capacity planning', 'fio', 'load testing', 'advanced'],
  },
  {
    id: 'itv-linux-38',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the filesystem hierarchy, and where do things live?',
    probing: 'Knowing where to look, which saves a lot of searching.',
    answer: [
      '`/etc` is configuration - system-wide, and editable. `/var` is variable data: `/var/log` for logs, `/var/lib` for application state, `/var/spool` for queues. `/usr` is read-only program data: `/usr/bin` and `/usr/sbin` for distribution binaries, `/usr/local` for locally installed software so it is not overwritten by package updates.',
      "`/opt` is for self-contained third-party applications, `/home` for user directories, `/root` for root's, `/srv` for data served by the machine.",
      'The **virtual filesystems** are the ones worth knowing well because they answer questions no command needs to: `/proc` exposes process and kernel information (`/proc/PID/`, `/proc/meminfo`, `/proc/cpuinfo`), and `/sys` exposes devices and kernel objects, including cgroup limits.',
      '`/tmp` is cleared periodically and is often `noexec` and a tmpfs (so in memory); `/dev/shm` is shared memory, also in memory, which is why it is a favourite place for malware to run from.',
      'The practical value is knowing where to look without searching: config in `/etc`, state in `/var/lib`, logs in `/var/log` or the journal, locally installed things in `/usr/local` or `/opt`, and live information about anything running in `/proc`.',
    ],
    code: [
      {
        title: 'The directories that answer questions',
        language: 'bash',
        code: `# /proc - live kernel and process state
cat /proc/loadavg /proc/meminfo /proc/uptime
cat /proc/1234/cmdline | tr '\\0' ' '
cat /proc/1234/limits
ls -l /proc/1234/fd | head

# /sys - devices and cgroups
cat /sys/block/sda/queue/scheduler
cat /sys/fs/cgroup/memory.max            # a container's own limit

# Where did this file come from?
dpkg -S /usr/bin/curl 2>/dev/null || rpm -qf /usr/bin/curl

# In-memory filesystems
df -h /tmp /dev/shm
mount | grep -E 'tmpfs|noexec'`,
      },
    ],
    traps: [
      'Installing into `/usr/bin` rather than `/usr/local/bin`, so a package update overwrites it.',
      'Putting persistent data in `/tmp`, which is cleared.',
      'Not knowing `/proc/PID/` exists, and hunting for a command that shows the same thing.',
      'Assuming `/tmp` is on disk - it is frequently tmpfs, so it consumes memory.',
    ],
    followUps: [
      'Why install into `/usr/local` rather than `/usr`?',
      'What is in `/proc/PID/` that is worth knowing?',
    ],
    tags: ['filesystem', 'proc', 'sys', 'hierarchy', 'fundamentals'],
  },
  {
    id: 'itv-linux-39',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage log rotation, and what goes wrong with it?',
    probing: 'A routine mechanism whose failure modes fill disks.',
    answer: [
      '**`logrotate`** runs on a schedule and rotates files according to per-application configuration in `/etc/logrotate.d/`: rotate daily or by size, keep N old versions, compress the old ones, and optionally run a command afterwards.',
      'The failure mode that matters is the **copytruncate versus create** distinction. By default `logrotate` **renames** the file and creates a new one - but a process that has the file open keeps writing to the **old inode**, so the new file stays empty and the old one keeps growing invisibly. That is why most configurations include a `postrotate` script sending the application a signal (usually SIGHUP) telling it to reopen its log file.',
      '**`copytruncate`** avoids needing the signal: it copies the contents and truncates the original in place, so the file descriptor stays valid. The cost is a small window where writes during the copy are lost, which for most logs is acceptable and for audit logs is not.',
      'The other common failure is **the disk filling anyway** because rotation is by time and the volume spiked - a `size` or `maxsize` directive covers that. And `journalctl` has its own limits (`SystemMaxUse`), which people forget entirely, so the journal fills a disk even when logrotate is configured perfectly.',
      'And the broader point: rotation manages the symptom. **Shipping logs off the host** removes the problem, and is necessary anyway for anything with more than a handful of machines.',
    ],
    code: [
      {
        title: 'A logrotate config, both approaches',
        language: 'text',
        code: `# /etc/logrotate.d/myapp
/var/log/myapp/*.log {
    daily
    rotate 14
    maxsize 500M            # also rotate if it grows fast, not just daily
    compress
    delaycompress
    missingok
    notifempty
    create 0640 app app
    sharedscripts
    postrotate
        # Tell the app to reopen its log - without this it keeps
        # writing to the old, renamed inode
        systemctl reload myapp >/dev/null 2>&1 || true
    endscript
}

# When the application cannot be signalled:
# copytruncate     - copies then truncates in place; small write-loss window`,
      },
      {
        title: 'Checking it works, and bounding the journal',
        language: 'bash',
        code: `logrotate -d /etc/logrotate.d/myapp        # debug - shows what it would do
logrotate -f /etc/logrotate.d/myapp        # force a rotation now
cat /var/lib/logrotate/status | grep myapp # when did it last rotate?

# The classic symptom: old file still growing after rotation
lsof +L1 | grep myapp

# The journal has its own limits, which logrotate does not manage
journalctl --disk-usage
# /etc/systemd/journald.conf:  SystemMaxUse=2G`,
      },
    ],
    traps: [
      'No `postrotate` signal and no `copytruncate`, so the application keeps writing to the rotated file.',
      'Rotation by time only, so a traffic spike fills the disk between rotations.',
      'An unbounded journal, which logrotate does not touch.',
      '`create` with wrong ownership, so the application cannot write to the new file.',
    ],
    followUps: [
      'Why does a rotated log sometimes keep growing?',
      'What does `copytruncate` trade away?',
    ],
    tags: ['logrotate', 'logs', 'disk', 'journald', 'operations'],
  },
  {
    id: 'itv-linux-40',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Users report the application is slow. The server looks fine - low CPU, plenty of memory. Where do you look?',
    probing: 'Looking past the obvious resource metrics, which is where most real slowness lives.',
    answer: [
      'Low CPU and free memory rules out two things and leaves several, and the useful ones are mostly about **waiting** rather than **working**.',
      '**Disk I/O**: iowait may be low in aggregate while a specific device is saturated, or the application is blocked on synchronous writes. `iostat -x` with `await` and queue depth is the check.',
      '**Network**: latency or packet loss to a dependency, DNS resolution being slow (particularly with a high `ndots` generating failed lookups before every external call), or connection setup time. The application is idle because it is waiting on something else.',
      '**Locks and contention**: a database lock, a mutex, a single-threaded bottleneck. The process is neither using CPU nor waiting on I/O - it is blocked on another thread. `top -H` showing one busy thread among many idle ones is the signature.',
      '**Connection and queue limits**: a connection pool exhausted, a listen backlog overflowing, a thread pool saturated. The resource is not CPU or memory but a configured limit, and `ss -lnt` showing a full accept queue names it immediately.',
      '**Downstream**: the server is fine and something it depends on is not. This is extremely common and is why per-dependency latency metrics are worth having - without them, every incident starts with "is it us or them" and no data.',
      "And **is it actually the server?** Latency measured from outside includes the load balancer, TLS, DNS and the network, none of which the host can see. A synthetic probe from a user's perspective answers this in one step.",
    ],
    code: [
      {
        title: 'What to check when CPU and memory are fine',
        language: 'bash',
        code: `# Storage - low aggregate iowait can still hide one saturated device
iostat -x 2 5
# await rising, aqu-sz growing -> saturated regardless of %util

# Connection and queue limits
ss -s                                  # total sockets, TIME-WAIT
ss -lnt                                # Recv-Q on a listener = accept backlog
nstat -az TcpExtListenOverflows        # non-zero = dropping connections
cat /proc/net/nf_conntrack | wc -l     # conntrack table pressure

# One busy thread among many idle - lock contention
top -H -p $(pgrep -f '[a]pp' | head -1)

# Is the process waiting, and on what?
cat /proc/1234/wchan; echo
timeout 10 strace -c -f -p 1234        # which syscall dominates?

# Downstream latency, from this host
time curl -sS -o /dev/null -w '%{time_namelookup} %{time_connect} %{time_total}\\n' \\
  https://dependency.example.com/health`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Slow with idle resources - what is it waiting on?',
        caption:
          'Low CPU and free memory means the process is waiting, not working. Find out for what.',
        question: 'What do the secondary signals show?',
        branches: [
          {
            condition: 'await and queue depth rising on a device',
            result: 'Storage',
            detail: 'Saturated even at low aggregate iowait',
            tone: 'warning',
          },
          {
            condition: 'Listen backlog full, connection errors',
            result: 'A configured limit, not a resource',
            detail: 'Pool, backlog, conntrack',
            tone: 'danger',
          },
          {
            condition: 'One busy thread, others idle',
            result: 'Lock contention or a single-threaded path',
            tone: 'warning',
          },
          {
            condition: 'Time spent in an outbound call',
            result: 'A downstream dependency',
            detail: 'The server is fine',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'DNS is an underrated cause. A high `ndots` inside Kubernetes produces several failed lookups before every external request, adding milliseconds to every call.',
      'Per-dependency latency metrics are what turn "is it us or them" from an investigation into a glance.',
      'Measuring from outside the host - a synthetic probe - is the only thing that reflects what users experience end to end.',
      '`top -H` showing one saturated thread among many is the clearest sign of a single-threaded bottleneck.',
    ],
    traps: [
      'Concluding the server is fine because CPU and memory look fine.',
      'Aggregate iowait hiding one saturated device.',
      'Not checking connection pools and queue limits, which are resources too.',
      'Investigating the host when the latency is in a dependency or the network.',
    ],
    followUps: [
      'How would you tell a lock problem from an I/O problem?',
      'What would you add to make this faster to diagnose?',
    ],
    tags: ['scenario', 'performance', 'latency', 'troubleshooting', 'advanced'],
  },
  {
    id: 'itv-linux-41',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does SSH authentication work, and how do you manage keys at scale?',
    probing: 'Access management, which is a security-critical everyday concern.',
    answer: [
      'Key-based authentication uses a **key pair**: the private key stays with the user, the public key goes in `~/.ssh/authorized_keys` on the server. The server sends a challenge, the client signs it with the private key, and the server verifies with the public one - the private key never leaves the client.',
      'The practices that matter for a single machine: **passphrase-protected private keys** with `ssh-agent` so you type it once, **Ed25519 rather than RSA** for new keys (shorter, faster, and no key-size questions), and **password authentication disabled** on the server.',
      "The problem **at scale** is distribution and revocation. Copying public keys to every host means that removing someone's access requires touching every host, and it is only as fast as your configuration management run. Missing one leaves a route in.",
      'The two answers. **Centralised identity** - LDAP or SSSD, or a cloud provider\'s session manager - so access is granted and revoked in one place. Or **SSH certificates**: a certificate authority signs a short-lived certificate for a user, hosts are configured to trust the CA, and **no public keys are distributed at all**. Revocation becomes "stop issuing certificates", and the short lifetime means access expires naturally.',
      'Certificates are the stronger answer and are underused. They also let you encode principals and constraints in the certificate itself, so one CA can grant different access to different host groups without per-host configuration.',
    ],
    code: [
      {
        title: 'Keys, agent and config',
        language: 'bash',
        code: `ssh-keygen -t ed25519 -C "alice@example.com"
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@host

eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519

# ~/.ssh/config makes a bastion transparent
# Host bastion
#   HostName bastion.example.com
#   User alice
#   IdentityFile ~/.ssh/id_ed25519
#
# Host 10.0.*
#   ProxyJump bastion
#   User app
#   StrictHostKeyChecking accept-new`,
      },
      {
        title: 'Certificates - nothing to distribute, nothing to revoke per host',
        language: 'bash',
        code: `# One-off: the certificate authority
ssh-keygen -t ed25519 -f ssh_user_ca -C 'SSH user CA'

# Sign a short-lived certificate for a user
ssh-keygen -s ssh_user_ca -I alice@example.com \\
  -n alice,app \\
  -V +8h \\
  -O clear -O permit-pty -O permit-agent-forwarding \\
  alice_key.pub

# On every host, once - then no per-user key distribution ever again
# /etc/ssh/sshd_config:
#   TrustedUserCAKeys /etc/ssh/ssh_user_ca.pub

ssh-keygen -L -f alice_key-cert.pub      # inspect what it grants`,
      },
    ],
    traps: [
      'Public keys distributed by configuration management, so revocation is as slow as the next run.',
      'Shared keys between people, which removes any audit trail.',
      'Private keys without a passphrase, on laptops.',
      '`StrictHostKeyChecking no`, which disables host verification entirely - `accept-new` is the reasonable middle ground.',
    ],
    followUps: [
      'Why are SSH certificates better than distributed public keys?',
      "How fast can you revoke someone's access today?",
    ],
    tags: ['ssh', 'keys', 'certificates', 'access management', 'security'],
  },
  {
    id: 'itv-linux-42',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `umask 022` mean?',
    probing: 'Default permissions, which people rarely think about until it matters.',
    options: [
      {
        id: 'a',
        text: 'It masks off write for group and other, so new files are 644 and new directories 755',
      },
      { id: 'b', text: 'It sets new files to mode 022' },
      { id: 'c', text: 'It grants write access to group and other' },
      { id: 'd', text: 'It applies only to directories' },
    ],
    correct: ['a'],
    answer: [
      'The umask is a **mask of bits to remove**, not the permissions to set. The base is **666 for files** and **777 for directories** - files never get execute by default - and the umask is subtracted.',
      'So `umask 022` removes write for group and other: files become **644** (`rw-r--r--`) and directories **755** (`rwxr-xr-x`). That is the common default.',
      '`umask 077` removes all access for group and other, giving **600** and **700** - which is what you want for anything sensitive, and is worth setting at the top of a script that creates files containing credentials.',
      'Where this bites in practice: a script creating a config file or a temporary file inherits the umask of whatever invoked it. A file that is 644 by default is world-readable, which for a file containing a token is a real exposure - and it happens silently, because nothing errors.',
    ],
    code: [
      {
        title: 'Seeing the effect',
        language: 'bash',
        code: `umask                  # 0022

touch f && mkdir d && ls -ld f d
# -rw-r--r--  f       666 - 022 = 644
# drwxr-xr-x  d       777 - 022 = 755

umask 077
touch g && mkdir e && ls -ld g e
# -rw-------  g       600
# drwx------  e       700

# In a script that writes anything sensitive
umask 077
get_secret > /tmp/creds        # created 600, not 644`,
      },
    ],
    traps: [
      'Reading the umask as the permissions rather than the bits removed.',
      'A script writing a credentials file with the inherited default umask, leaving it world-readable.',
      'Expecting umask to affect existing files - it applies only at creation.',
      'Expecting execute on a new file - the base for files is 666, so it never gets it.',
    ],
    followUps: ['What umask would you set in a script that writes a secret?'],
    tags: ['umask', 'permissions', 'security', 'fundamentals'],
  },
  {
    id: 'itv-linux-43',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you set up monitoring for a fleet of Linux servers?',
    probing: 'Bringing the host-level knowledge together into a monitoring design.',
    answer: [
      'The **collection** layer: `node_exporter` as an agent on every host, exposing CPU, memory, disk, network, filesystem and systemd unit state, scraped by Prometheus. For logs, a shipper - Promtail, Fluent Bit or Vector - sending to a central platform.',
      'The **discovery** question matters as much: in a cloud, service discovery from the provider so a new instance is monitored automatically. Anything requiring manual registration means the hosts that matter most during an incident are the ones nobody added.',
      'What to **alert** on, at the host level: **disk projected to fill** (trajectory, not a threshold - `predict_linear`), **memory available** low with active swapping, **the host unreachable** (`up == 0`), **failed systemd units**, and **load or iowait sustained high relative to core count**. That is a short list, and it should be short - host-level alerts are the ones most prone to noise.',
      'The principle that keeps it useful: **alert on what needs action**. A host at 85% CPU is not a problem if it is serving requests fine; a host whose disk will be full in four hours is. Most host metrics belong on a dashboard and in a trend, not in a pager.',
      'And the **service level** matters more than the host level. A single host being unhealthy in a fleet of fifty may need no immediate action at all if the load balancer has already removed it - what matters is whether the **service** is degraded. Alerting on aggregate service health and treating individual host problems as tickets is usually the right split.',
    ],
    code: [
      {
        title: 'The host alerts worth having',
        language: 'yaml',
        code: `groups:
  - name: host
    rules:
      - alert: HostDown
        expr: up{job="node"} == 0
        for: 5m
        labels: { severity: critical }

      - alert: DiskWillFill
        expr: |
          predict_linear(node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}[6h], 4*3600) < 0
            and node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.3
        for: 30m
        labels: { severity: warning }

      - alert: MemoryPressure
        expr: |
          node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.10
            and rate(node_vmstat_pswpin[5m]) > 0
        for: 15m
        labels: { severity: warning }

      - alert: SystemdUnitFailed
        expr: node_systemd_unit_state{state="failed"} == 1
        for: 10m
        labels: { severity: warning }

      - alert: SustainedLoad
        expr: node_load15 / on(instance) count by (instance) (node_cpu_seconds_total{mode="idle"}) > 2
        for: 30m
        labels: { severity: warning }`,
      },
    ],
    deeper: [
      'Normalise load by core count rather than alerting on an absolute value, or the alert is wrong on every machine with a different size.',
      'Pair the memory alert with actual swapping - low available memory alone fires constantly on healthy systems because of page cache.',
      'Host-level alerts should mostly be tickets. Service-level alerts should page.',
      'Automatic discovery is what determines whether coverage is complete; manual registration always has gaps.',
    ],
    traps: [
      'Alerting on "free" memory, which is low on every healthy system.',
      'Absolute load thresholds across machines with different core counts.',
      'Paging on individual host problems in a fleet where the service is unaffected.',
      'Manual host registration, so new hosts are unmonitored.',
    ],
    followUps: [
      'Why alert on disk trajectory rather than a percentage?',
      'When should a host-level problem page someone?',
    ],
    tags: ['monitoring', 'prometheus', 'node_exporter', 'alerting', 'advanced'],
  },
  {
    id: 'itv-linux-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is SELinux or AppArmor, and what do you do when it blocks something?',
    probing: 'Mandatory access control - and specifically resisting the urge to disable it.',
    answer: [
      'They are **mandatory access control** systems: an additional layer of policy beyond the standard permission bits. Even a process running as root is constrained by what its policy allows, which is what makes them valuable - a compromised service is contained rather than free.',
      '**SELinux** (RedHat family) labels every file and process with a **context**, and policy defines which contexts may interact. **AppArmor** (Debian and SUSE) uses **path-based profiles** per binary. SELinux is more powerful and more complex; AppArmor is easier to reason about.',
      'The symptom when it blocks something is the problem: the application reports a **permission denied** that looks entirely ordinary, while `ls -l` shows the permissions are correct. That mismatch is the tell, and the answer is in the audit log rather than anywhere obvious.',
      'The correct process: **check the audit log** (`ausearch -m AVC` or `journalctl -t setroubleshoot`), understand what was denied, and fix it properly - usually by **setting the right file context** (`semanage fcontext` then `restorecon`), enabling a **boolean** that permits the behaviour, or generating a **policy module** for a genuinely new requirement.',
      'What not to do is **`setenforce 0`**. It works immediately, which is why it is the standard response, and it removes a real containment layer permanently because nobody turns it back on. **Permissive mode** is the right diagnostic step - it logs what *would* be denied without blocking, so you can collect every denial in one run and fix them all, then re-enable enforcement.',
    ],
    code: [
      {
        title: 'Diagnose and fix properly',
        language: 'bash',
        code: `getenforce                       # Enforcing / Permissive / Disabled
ausearch -m AVC -ts recent       # what was actually denied
journalctl -t setroubleshoot --since '1 hour ago'

# The most common cause: a file in the wrong context
ls -Z /var/www/html/index.html
semanage fcontext -a -t httpd_sys_content_t '/srv/web(/.*)?'
restorecon -Rv /srv/web

# Sometimes a boolean already permits what you need
getsebool -a | grep httpd | head
setsebool -P httpd_can_network_connect on

# Diagnose without blocking - collect every denial, then fix them together
setenforce 0                     # PERMISSIVE, temporarily
# ... reproduce the problem ...
ausearch -m AVC -ts recent | audit2allow -M myapp
setenforce 1                     # back to enforcing`,
      },
      {
        title: 'AppArmor equivalent',
        language: 'bash',
        code: `aa-status
aa-complain /usr/sbin/nginx      # log but do not block
# ... reproduce ...
aa-logprof                       # interactively update the profile
aa-enforce /usr/sbin/nginx`,
      },
    ],
    traps: [
      '`setenforce 0` as the fix, removing the protection permanently.',
      'Copying a policy module from the internet without understanding what it permits.',
      '`chcon` to set a context, which does not survive a relabel - `semanage fcontext` plus `restorecon` does.',
      'Not checking the audit log, and treating an SELinux denial as an ordinary permission problem.',
    ],
    followUps: [
      'Why is permissive mode better than disabling it?',
      'What is the difference between `chcon` and `semanage fcontext`?',
    ],
    tags: ['selinux', 'apparmor', 'security', 'mac', 'troubleshooting'],
  },
  {
    id: 'itv-linux-45',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you check what is listening on a port and what is using it?',
    probing: 'A very common everyday task.',
    answer: [
      '`ss -tulpn` is the modern answer: **t** for TCP, **u** for UDP, **l** for listening, **p** for the owning process, **n** for numeric ports rather than service names. It replaced `netstat`, which is deprecated and slower on busy hosts.',
      'The column that matters most is the **local address**, not just the port. `127.0.0.1:8080` means loopback only - reachable from the host and from nowhere else, which is the most common cause of "connection refused" from another machine. `0.0.0.0:8080` means all interfaces.',
      '`lsof -i :8080` gives the same information from the file-descriptor side, and is sometimes clearer about which process and user owns it.',
      'For **established connections** rather than listeners, `ss -tn state established` shows what is actually connected, and `ss -s` gives a summary of socket counts by state - which is how you spot a host accumulating TIME-WAIT or a connection leak.',
      'And `fuser -k 8080/tcp` kills whatever holds a port, which is occasionally what you want when something is stuck - though identifying it first is wiser than killing it blind.',
    ],
    code: [
      {
        title: 'Listeners, connections and summaries',
        language: 'bash',
        code: `ss -tulpn                        # everything listening, with the process
ss -tulpn | grep :8080

lsof -i :8080                    # the same, from the file-descriptor side
lsof -i -P -n | grep LISTEN

# Established connections, and where they are going
ss -tn state established
ss -tn state established '( dport = :443 )' | head

# Summary by state - accumulating TIME-WAIT or a connection leak
ss -s

# Bound to loopback? That is why it is refusing remote connections.
ss -tulpn | awk '$5 ~ /^127\\.0\\.0\\.1/ {print "loopback only:", $5, $7}'`,
      },
    ],
    traps: [
      'Seeing a port listening and not noticing it is bound to `127.0.0.1`.',
      '`netstat` on a busy host, which is slow and deprecated.',
      'Running without `sudo`, so the process column is empty for processes you do not own.',
      '`fuser -k` without identifying what it will kill.',
    ],
    followUps: ['Why does a service bound to 127.0.0.1 refuse remote connections?'],
    tags: ['ss', 'netstat', 'ports', 'networking', 'fundamentals'],
  },
  {
    id: 'itv-linux-46',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these would you expect on a well-run production Linux fleet? Select all that apply.',
    probing: 'Operational maturity for hosts.',
    options: [
      { id: 'a', text: 'Configuration managed as code, with drift detected and corrected' },
      {
        id: 'b',
        text: 'Centralised logs and metrics, with hosts contributing rather than storing',
      },
      { id: 'c', text: 'Automated security patching, with reboots coordinated' },
      {
        id: 'd',
        text: 'SSH access for everyone with sudo, so nobody is blocked during an incident',
      },
      {
        id: 'e',
        text: 'Hosts treated as replaceable - rebuilt from an image rather than repaired',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Broad SSH and sudo for everyone is the wrong one. It removes any meaningful access control and any audit trail, and "nobody is blocked during an incident" is solved by a documented escalation path or a break-glass role - not by giving everyone root permanently.',
      '**Configuration as code with drift correction** is what makes the fleet knowable. A host configured by hand is a host nobody can reproduce.',
      '**Centralised logs and metrics** matter because the host with the answer may be gone by the time you look, and searching fifty machines by hand does not scale.',
      '**Automated security patching with coordinated reboots** addresses the most common real cause of compromise - unpatched known vulnerabilities - while keeping the disruption predictable.',
      '**Replaceable hosts** is the one that makes everything else easier. If a host can be rebuilt from an image in minutes, then a compromised host is replaced rather than cleaned, a drifted host is replaced rather than reconciled, and a broken host is replaced rather than debugged under pressure.',
      'I would add: no direct SSH to production where a session manager or a bastion works, and every host in monitoring automatically by discovery rather than registration.',
    ],
    traps: [
      'Permanent broad sudo instead of an escalation path.',
      'Logs kept only on hosts, lost when the host is.',
      'Patching deferred indefinitely because reboots are disruptive.',
      'Pets rather than cattle, so every host is slightly different and none can be rebuilt.',
    ],
    followUps: ['How would you handle emergency access without giving everyone root?'],
    tags: ['best practices', 'fleet', 'operations', 'immutable', 'advanced'],
  },
  {
    id: 'itv-linux-47',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you schedule and manage recurring maintenance on a fleet?',
    probing: 'Fleet maintenance, particularly patching, which is a genuine operational challenge.',
    answer: [
      'The tension is between **patching promptly** - because unpatched vulnerabilities are how compromises actually happen - and **not disrupting service**, which is why patching gets deferred and fleets end up years behind.',
      'The approach that resolves it: **roll rather than batch**. Patch a small proportion at a time, verify service health between batches, and stop on failure. That is the same pattern as any rolling deployment, and it means a bad patch affects a few hosts rather than all of them.',
      '**Separate patching from rebooting.** Most security updates apply without a reboot; a kernel update needs one. Applying updates promptly and scheduling the reboot separately - or using live patching where available - decouples the urgency from the disruption.',
      '**Make the reboot safe**: drain the host from the load balancer first, wait for connections to finish, reboot, wait for the service to be genuinely healthy - not just for SSH to answer - and return it to rotation before moving on.',
      '**Automate the whole thing** and run it on a schedule, because a manual process is a process that gets skipped. Tooling exists for this - `unattended-upgrades` with a reboot policy, `dnf-automatic`, Ansible with `serial`, or a cloud patch manager.',
      'And **measure it**: the proportion of the fleet patched, and the age of the oldest unpatched host. Without that number, "we patch regularly" is an assertion rather than a fact, and the outliers are invisible.',
    ],
    code: [
      {
        title: 'Rolling patch with health verification',
        language: 'yaml',
        code: `- name: Rolling patch
  hosts: all
  serial: "10%"
  max_fail_percentage: 0
  become: true

  pre_tasks:
    - name: Drain from the load balancer
      ansible.builtin.uri:
        url: "https://lb/api/hosts/{{ inventory_hostname }}/drain"
        method: POST
      delegate_to: localhost

  tasks:
    - name: Apply security updates
      ansible.builtin.package:
        name: '*'
        state: latest

    - name: Reboot only if one is actually required
      ansible.builtin.reboot:
        reboot_timeout: 900
        post_reboot_delay: 30
        test_command: systemctl is-system-running --wait
      when: reboot_required.stat.exists

  post_tasks:
    - name: Wait for the service to be genuinely healthy
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/healthz"
        status_code: 200
      retries: 30
      delay: 10
      delegate_to: localhost

    - name: Return to the load balancer
      ansible.builtin.uri:
        url: "https://lb/api/hosts/{{ inventory_hostname }}/enable"
        method: POST
      delegate_to: localhost`,
      },
      {
        title: 'Measure it, or it is not happening',
        language: 'bash',
        code: `# How far behind is each host?
ansible all -m shell -a 'apt list --upgradable 2>/dev/null | grep -c security' \\
  | awk '/SUCCESS/{h=$1} /^[0-9]+$/{print h, $1}'

# Oldest unpatched host - the number that matters
ansible all -m shell -a 'stat -c %Y /var/lib/apt/periodic/update-success-stamp' \\
  --one-line | sort -k2 -n | head -5`,
      },
    ],
    traps: [
      'Patching everything at once, so a bad update takes out the fleet.',
      'Waiting for SSH rather than for the service to be healthy before moving on.',
      'Rebooting unconditionally rather than only when required.',
      'No measurement, so the hosts that never get patched are invisible.',
    ],
    followUps: [
      'Why separate patching from rebooting?',
      'How would you know which hosts are behind?',
    ],
    tags: ['patching', 'maintenance', 'rolling', 'fleet', 'security'],
  },
  {
    id: 'itv-linux-48',
    level: 'basic',
    kind: 'mcq',
    prompt: 'A file is owned by `root:root` with mode 640. Can a user in the `root` group read it?',
    probing: 'Permission evaluation order, which is not what people assume.',
    options: [
      { id: 'a', text: 'Yes - group has read, and they are in the group' },
      { id: 'b', text: 'No - only the owner can read a 640 file' },
      { id: 'c', text: 'Only if they also own the file' },
      { id: 'd', text: 'Only with sudo' },
    ],
    correct: ['a'],
    answer: [
      'Mode 640 is `rw-r-----`: read and write for the **owner**, read for the **group**, nothing for **other**. A user in the `root` group matches the group class and gets read access.',
      'The detail worth knowing is the **evaluation order**, which is not additive. The kernel checks **owner first**: if you are the owner, the owner bits apply and **the group and other bits are not consulted at all**. Otherwise it checks group, then other, and stops at the first match.',
      'That produces a genuinely surprising case: a file owned by you with mode **046** (`---r--rw-`) means **you cannot read it** even though group and other can, because the owner check matched first and the owner has no permissions. It looks wrong and is correct.',
      'The other thing that catches people is that **file permissions are only reached after traversing every parent directory**. A perfectly readable file inside a directory without execute permission is inaccessible, and the error points at the file rather than the directory.',
    ],
    code: [
      {
        title: 'The evaluation order, demonstrated',
        language: 'bash',
        code: `ls -l /etc/shadow
# -rw-r----- 1 root shadow    owner rw, group r, other nothing

# The surprising case - owner matched first, and has no permissions
touch odd && chmod 046 odd && ls -l odd
# ----r--rw-  1 alice alice
cat odd                          # Permission denied, as the OWNER

# Parent directory traversal is checked first
mkdir -p locked/inner && touch locked/inner/file
chmod 644 locked/inner/file      # the file is readable
chmod 600 locked                 # but the directory is not traversable
sudo -u nobody cat locked/inner/file    # Permission denied - the directory`,
      },
    ],
    traps: [
      'Assuming permissions are additive across classes - they are not; the first matching class wins.',
      "Debugging a file's permissions when a parent directory is the problem.",
      'Adding a user to a group and expecting it to take effect in an existing session - group membership is read at login.',
    ],
    followUps: [
      'Why might the owner of a file be unable to read it?',
      'Why does adding someone to a group not take effect immediately?',
    ],
    tags: ['permissions', 'ownership', 'groups', 'fundamentals'],
  },
  {
    id: 'itv-linux-49',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you back up and restore a Linux server?',
    probing: 'Backup strategy, with the emphasis on the part people skip.',
    answer: [
      'The first question is **what actually needs backing up**. On a well-managed fleet, the operating system and configuration come from an image and configuration management, so they do not need backing up - they need rebuilding. What genuinely needs it is **data**: databases, uploaded files, anything generated rather than declared.',
      'That reframing matters, because backing up a whole server is expensive and restoring one is slow, while rebuilding from an image and restoring the data is faster and produces a known-good machine rather than one carrying whatever state it had.',
      'The properties a backup needs: **off the host** (a backup on the same disk protects against nothing), **off the account or region** for anything serious, **encrypted**, **versioned** so you can go back past the point a corruption started, and **immutable or write-once** so ransomware cannot delete it - which is now a primary threat rather than an edge case.',
      "**Application-consistent** matters for databases: a filesystem snapshot of a running database may not be restorable. Either use the database's own backup mechanism, or quiesce it around a snapshot.",
      'And the part that is actually decisive: **test the restore**. An untested backup is a hypothesis. Most backup failures are discovered during the first real restore - a missing dependency, an incomplete set, a format nothing can read, or credentials nobody has. A scheduled restore test into a throwaway environment is what turns it into a capability.',
      'And know the **RTO and RPO** you are designing for, because they determine the frequency and the method, and they are usually unstated.',
    ],
    code: [
      {
        title: 'Data backup with verification',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

readonly TARGET="s3://backups/$(hostname -s)/$(date +%F)"

# Application-consistent database backup - not a filesystem snapshot
pg_dump -Fc --no-owner appdb > /tmp/appdb.dump
pg_restore --list /tmp/appdb.dump >/dev/null    # verify it is readable

# Data, not the whole OS
tar czf /tmp/appdata.tar.gz -C /var/lib appdata
tar tzf /tmp/appdata.tar.gz >/dev/null          # verify

# Off-host, encrypted, versioned
aws s3 cp /tmp/appdb.dump     "$TARGET/appdb.dump"     --sse aws:kms
aws s3 cp /tmp/appdata.tar.gz "$TARGET/appdata.tar.gz" --sse aws:kms

# Positive signal - alert if this stops arriving
curl -fsS --max-time 10 "https://hc.example.com/ping/backup-$(hostname -s)"

rm -f /tmp/appdb.dump /tmp/appdata.tar.gz`,
      },
      {
        title: 'The restore test, which is the part that matters',
        language: 'bash',
        code: `#!/usr/bin/env bash
# Run weekly into a throwaway environment. An untested backup is a hypothesis.
set -euo pipefail

latest=$(aws s3 ls s3://backups/web-01/ | sort | tail -1 | awk '{print $2}')
aws s3 cp "s3://backups/web-01/\${latest}appdb.dump" /tmp/restore.dump

createdb resttest
pg_restore -d resttest /tmp/restore.dump

rows=$(psql -t -A -d resttest -c 'SELECT count(*) FROM orders')
[ "$rows" -gt 0 ] || { echo "restore produced an empty database" >&2; exit 1; }
echo "restore verified: $rows rows"

dropdb resttest`,
      },
    ],
    traps: [
      'Backups never restored, so the first restore is during an incident.',
      'Backups in the same account or region as the thing they protect.',
      'A filesystem snapshot of a running database, which may not be restorable.',
      'Backing up the whole server when rebuilding from an image plus restoring data is faster and cleaner.',
      'No alert when backups stop, so the gap is discovered when one is needed.',
    ],
    followUps: [
      'What is your RPO, and does the schedule meet it?',
      'Why is rebuilding often better than restoring a whole server?',
    ],
    tags: ['backup', 'restore', 'disaster recovery', 'testing', 'data'],
  },
  {
    id: 'itv-linux-50',
    level: 'basic',
    kind: 'open',
    prompt: 'What would you check first on a server you have never seen before?',
    probing: 'Orientation under pressure - a good closing question that shows method.',
    answer: [
      'I would build a picture in three passes, each taking seconds.',
      '**What is this machine?** `hostname`, `/etc/os-release`, `uname -r`, `nproc`, `free -h`, and whether it is physical, virtual or a container. That tells me what I am dealing with and roughly what to expect.',
      '**What state is it in?** `uptime` for load and how long it has been up, `df -h` for disk, `systemctl --failed` for anything broken, and `journalctl -p err -b` for recent errors. Between them these four commands identify a large proportion of problems immediately, before I have asked anyone anything.',
      '**What does it do?** `ss -tulpn` shows what is listening, which tells me what the machine is for better than any documentation. `systemctl list-units --type=service --state=running` shows what is meant to be running, and `ps auxf` shows what actually is.',
      "Then, depending on why I am there: `top` if it is a performance question, the relevant service's journal if something is broken, and `ip addr`/`ip route` if it is networking.",
      'The reason for the order is that it goes from cheap and general to specific, and the general checks frequently answer the question - a full disk or a failed unit explains a great many reported symptoms, and both are visible in the first thirty seconds.',
    ],
    code: [
      {
        title: 'The three passes',
        language: 'bash',
        code: `# 1. What is it?
hostnamectl
cat /etc/os-release | head -2
uname -r; nproc; free -h
systemd-detect-virt              # kvm, docker, none...

# 2. What state is it in?
uptime
df -h -x tmpfs -x devtmpfs
systemctl list-units --failed
journalctl -p err -b --no-pager | tail -20
dmesg -T --level=err | tail -10

# 3. What does it do?
ss -tulpn
systemctl list-units --type=service --state=running | head -25
ps auxf | head -40`,
      },
    ],
    traps: [
      'Going straight to the reported symptom without establishing context.',
      'Skipping `df -h` and `systemctl --failed`, which explain a surprising share of reported problems.',
      'Assuming the documentation describes what the machine actually runs.',
    ],
    followUps: ['Which single command tells you the most about an unfamiliar host?'],
    tags: ['orientation', 'triage', 'method', 'troubleshooting', 'fundamentals'],
  },
]
