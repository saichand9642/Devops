import type { InterviewQuestion } from '../../../types'

/** Boot, storage, packages, kernel tuning and security on a Linux host. */
export const linuxOperationsQuestions: InterviewQuestion[] = [
  {
    id: 'itv-linux-21',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Walk me through what happens when a Linux machine boots.',
    probing:
      'A classic question. It tests breadth, and the follow-up is usually "where would it fail?".',
    answer: [
      '**Firmware** - BIOS or UEFI - initialises the hardware and finds a bootable device. UEFI reads an EFI system partition and loads a boot loader directly; BIOS reads the MBR.',
      'The **boot loader**, usually GRUB, presents any menu, then loads the **kernel** and the **initramfs** into memory and hands control to the kernel.',
      'The **kernel** initialises, mounts the **initramfs** as a temporary root, and loads the drivers needed to reach the real root filesystem - which is why the initramfs exists at all: the kernel may need a driver for the storage controller or a module for LVM or encryption before it can mount the real root.',
      'The kernel then **pivots to the real root filesystem** and starts **PID 1**, which on modern systems is systemd.',
      '**systemd** reads its units, resolves dependencies, and brings up the system in parallel towards the default target - usually `multi-user.target` or `graphical.target`. Services start as their dependencies are satisfied.',
      'The value of knowing this is in the failure modes: a machine that hangs before GRUB is firmware or disk; one that reaches GRUB and no further is kernel or initramfs; a kernel panic about not finding root is usually a missing driver in the initramfs or a changed device name; and a machine that reaches a login prompt with services failed is a systemd problem, diagnosable normally.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'The boot sequence, and where it fails',
        caption:
          'Knowing which stage failed narrows the cause immediately - that is the point of knowing this.',
        nodes: [
          {
            label: 'Firmware (UEFI/BIOS)',
            detail: 'Hardware init, find a boot device',
            tone: 'accent',
          },
          { label: 'Boot loader (GRUB)', detail: 'Loads kernel + initramfs' },
          { label: 'Kernel + initramfs', detail: 'Drivers needed to reach real root' },
          {
            label: 'Pivot to real root',
            detail: 'Panic here = missing driver or wrong root',
            tone: 'warning',
          },
          { label: 'systemd as PID 1', detail: 'Units, dependencies, parallel start' },
          { label: 'Default target reached', tone: 'success' },
        ],
      },
    ],
    traps: [
      'Forgetting the initramfs, which is where root-mount failures come from.',
      'Editing `/etc/fstab` with a device name that changes, so the next boot fails - use a UUID.',
      'A kernel update without regenerating the initramfs, so the new kernel lacks its drivers.',
    ],
    followUps: [
      'A kernel panic says it cannot mount root. What are the likely causes?',
      'Why does the initramfs exist?',
    ],
    tags: ['boot', 'grub', 'initramfs', 'systemd', 'troubleshooting'],
  },
  {
    id: 'itv-linux-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you add and mount a new disk?',
    probing: 'A routine task with one detail that causes real outages.',
    answer: [
      'The sequence: identify the device with `lsblk`, create a filesystem with `mkfs`, create a mount point, mount it, and add it to `/etc/fstab` so it persists across reboots.',
      'The detail that matters is **how you identify the device in fstab**. Device names like `/dev/sdb` are **not stable** - they depend on detection order, so adding another disk or a controller change can renumber them. An fstab entry referring to `/dev/sdb1` can silently point at a different disk after a reboot, and if it is a critical mount the machine may fail to boot. **Always use the UUID**, which is a property of the filesystem and does not change.',
      'The second detail is **testing before rebooting**. `mount -a` applies fstab immediately, so a mistake is visible now rather than at the next reboot - which might be weeks later, by someone else, at an inconvenient time. A bad fstab entry can leave a machine unbootable and requiring console access to fix.',
      '`nofail` in the options is worth considering for non-essential mounts: without it, a missing or failed disk blocks boot entirely, which for an optional data volume is worse than simply not having it mounted.',
      'And for cloud volumes, the same applies - plus remembering that the volume has to be attached to the instance before any of this, and that detaching it without unmounting risks filesystem corruption.',
    ],
    code: [
      {
        title: 'Adding a disk, persistently and safely',
        language: 'bash',
        code: `lsblk -f                              # what is there, and what is already formatted
mkfs.ext4 -L appdata /dev/nvme1n1     # or mkfs.xfs

mkdir -p /var/lib/appdata
blkid /dev/nvme1n1                    # get the UUID - NOT the device name

# /etc/fstab - UUID, never /dev/sdX
# UUID=8f3c-1e2a  /var/lib/appdata  ext4  defaults,noatime,nofail  0 2

mount -a                              # TEST IT NOW, not at the next reboot
findmnt /var/lib/appdata
df -h /var/lib/appdata`,
      },
      {
        title: 'Growing it later',
        language: 'bash',
        code: `# After expanding the underlying volume (cloud console, LVM, etc.)
lsblk                                  # the block device is bigger
growpart /dev/nvme1n1 1                # grow the partition, if partitioned
resize2fs /dev/nvme1n1p1               # ext4 - can be done while mounted
xfs_growfs /var/lib/appdata            # xfs - takes the mount point

df -h /var/lib/appdata`,
      },
    ],
    traps: [
      'Device names in fstab, which can change and point at the wrong disk.',
      'Not running `mount -a`, so a bad entry is discovered at the next reboot.',
      'No `nofail` on an optional mount, so a missing disk blocks boot.',
      'Detaching a cloud volume without unmounting, risking corruption.',
    ],
    followUps: [
      'Why use a UUID rather than `/dev/sdb1`?',
      'What happens at boot if an fstab entry is wrong?',
    ],
    tags: ['storage', 'fstab', 'mount', 'uuid', 'lvm'],
  },
  {
    id: 'itv-linux-23',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between a hard link and a symbolic link?',
    probing: 'Filesystem fundamentals with practical consequences.',
    options: [
      {
        id: 'a',
        text: 'A hard link is another directory entry for the same inode; a symlink is a separate file containing a path',
      },
      { id: 'b', text: 'Hard links work across filesystems, symlinks do not' },
      { id: 'c', text: 'Symlinks are faster to access' },
      { id: 'd', text: 'They are the same thing with different syntax' },
    ],
    correct: ['a'],
    answer: [
      'A **hard link** is an additional name pointing at the same **inode**. The file data has no single "real" name - every hard link is equally the file, and the data is only freed when the last link is removed. That is why deleting a file with two hard links frees no space.',
      'A **symbolic link** is a small file whose content is a **path**. Following it is a separate lookup, which means it can point at something that does not exist (a broken link), it can cross filesystems, and it can point at a directory - none of which hard links can do.',
      'The restriction is the opposite of option b: **hard links cannot cross filesystems**, because an inode number is only meaningful within one filesystem. Symlinks can, because they store a path.',
      'Practically: symlinks are what you use for a `current` pointer to a release directory, because you can atomically repoint them with `ln -sfn`. Hard links are what `rsync --link-dest` uses to make incremental backups that share unchanged files, so ten daily snapshots cost little more than one.',
    ],
    code: [
      {
        title: 'Both, and where each is used',
        language: 'bash',
        code: `ln file.txt hardlink.txt          # same inode
ln -s file.txt symlink.txt        # a path

ls -li file.txt hardlink.txt symlink.txt
# the first two share an inode number; the symlink has its own

stat -c '%h' file.txt             # link count: 2

# Atomic release switching - the standard deployment pattern
ln -sfn /opt/app/releases/1.4.2 /opt/app/current

# Space-efficient incremental backups via hard links
rsync -a --link-dest=/backups/2026-09-15 /data/ /backups/2026-09-16/`,
      },
    ],
    traps: [
      'Expecting a hard link across filesystems, which is not possible.',
      'Deleting a file with other hard links and expecting the space back.',
      'A relative symlink that breaks when the link is moved.',
      'Tools that follow symlinks unexpectedly - `rm -rf` on a symlink to a directory removes the link, but with a trailing slash behaviour differs.',
    ],
    followUps: [
      'Why can a hard link not cross filesystems?',
      'How does `--link-dest` make backups cheap?',
    ],
    tags: ['links', 'inodes', 'filesystem', 'backups', 'fundamentals'],
  },
  {
    id: 'itv-linux-24',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage packages, and what should you be careful about?',
    probing: 'Package management with the operational caveats.',
    answer: [
      'The two families: **apt/dpkg** on Debian and Ubuntu, **dnf/yum/rpm** on RedHat family. The everyday operations are the same - install, remove, update the index, upgrade, search, and query which package owns a file.',
      'The operational cautions. **Updating and upgrading are different**: `apt update` refreshes the package index, `apt upgrade` actually installs. Running upgrade without update installs from a stale index.',
      '**`apt full-upgrade` and `dnf upgrade` can remove packages** to resolve dependencies. On a production host that is worth reviewing rather than accepting - a dependency resolution that removes something you needed is not hypothetical.',
      '**Unattended upgrades** are a trade-off worth being deliberate about: automatic security patching is good, and an unattended upgrade that restarts a service or requires a reboot at an unpredictable time is not. Security-only, with reboots scheduled and coordinated, is the usual compromise.',
      '**Pin versions** for anything where a change matters, and be aware that a package upgrade can replace a configuration file - `dpkg` prompts, but in a non-interactive run the behaviour depends on the options passed, and silently keeping or replacing a config is a real source of surprise.',
      'And the broader point: **on immutable infrastructure this largely goes away**. Packages are installed at image build time and machines are replaced rather than upgraded, which removes drift and makes the state of every machine knowable.',
    ],
    code: [
      {
        title: 'The operations that matter',
        language: 'bash',
        code: `# Debian/Ubuntu
apt update                          # refresh the index (does not install)
apt list --upgradable
apt install -y nginx=1.24.0-1       # pinned version
apt-mark hold nginx                 # do not upgrade this
dpkg -S /usr/sbin/nginx             # which package owns this file?
dpkg -l | grep nginx

# RedHat family
dnf check-update
dnf install -y nginx-1.24.0
dnf versionlock add nginx
rpm -qf /usr/sbin/nginx
dnf history                         # and: dnf history undo <id>

# Security-only, unattended - the usual compromise
# /etc/apt/apt.conf.d/50unattended-upgrades
# Unattended-Upgrade::Allowed-Origins { "\${distro_id}:\${distro_codename}-security"; };
# Unattended-Upgrade::Automatic-Reboot "false";`,
      },
    ],
    traps: [
      '`apt upgrade` without `apt update`, installing from a stale index.',
      'Accepting a dependency resolution that removes packages, on production.',
      'Unattended upgrades that restart services or reboot at unpredictable times.',
      'A config file silently replaced or kept during a non-interactive upgrade.',
    ],
    followUps: [
      'What is the difference between `apt update` and `apt upgrade`?',
      'How does immutable infrastructure change this?',
    ],
    tags: ['packages', 'apt', 'dnf', 'patching', 'operations'],
  },
  {
    id: 'itv-linux-25',
    level: 'advanced',
    kind: 'open',
    prompt: 'What kernel parameters would you tune for a busy server, and why?',
    probing: 'Kernel tuning - the good answer measures first rather than reciting settings.',
    answer: [
      'The honest starting point is that **modern defaults are reasonable** and blind tuning usually makes things worse. The settings worth changing are the ones where a specific symptom points at a specific limit, and I would want to see the symptom before changing anything.',
      'That said, the ones that come up genuinely for a busy server.',
      '**File descriptors**: `fs.file-max` system-wide and the per-process limit via `ulimit -n` or a systemd `LimitNOFILE`. A busy server handling many connections hits the default per-process limit of 1024 quickly, and the symptom is "too many open files" - unambiguous and easy to fix.',
      "**Connection backlog**: `net.core.somaxconn` and `net.ipv4.tcp_max_syn_backlog`. If connections are being dropped during a burst, the accept queue is overflowing - `ss -lnt` shows the queue and the drops. The application's own `listen()` backlog has to be raised too, or the kernel setting does nothing.",
      '**Ephemeral ports and TIME_WAIT**: `net.ipv4.ip_local_port_range` and `tcp_tw_reuse` matter on a host making very many outbound connections, which runs out of source ports.',
      '**Conntrack**: on anything doing NAT or with connection tracking enabled, `nf_conntrack_max` is a real limit - and exceeding it drops new connections while existing ones work, which is a confusing symptom.',
      '**`vm.swappiness`** is the one people change reflexively. Lowering it makes the kernel prefer dropping cache over swapping, which suits a database; setting it to 0 entirely is usually a mistake, because it makes OOM more likely rather than less.',
      'The discipline: change one thing, measure, and record why. An undocumented `sysctl.conf` full of copied settings is a liability.',
    ],
    code: [
      {
        title: 'Symptom-driven, with the check that justifies it',
        language: 'bash',
        code: `# "Too many open files"
ulimit -n
cat /proc/sys/fs/file-nr              # allocated / free / max
ls /proc/1234/fd | wc -l              # what one process is using

# Connections dropped during a burst? Check the accept queue first.
ss -lnt                               # Send-Q = backlog, Recv-Q = waiting
nstat -az TcpExtListenOverflows TcpExtListenDrops    # non-zero = overflowing

# Conntrack exhaustion - new connections fail, existing ones work
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
dmesg | grep -i 'conntrack table full'`,
      },
      {
        title: 'The settings, applied persistently and documented',
        language: 'text',
        code: `# /etc/sysctl.d/99-tuning.conf
# Each with the symptom that justified it.

# "too many open files" under load, 2026-09
fs.file-max = 2097152

# TcpExtListenOverflows non-zero during traffic bursts, 2026-09
# NOTE: the application's listen() backlog must be raised too
net.core.somaxconn = 8192
net.ipv4.tcp_max_syn_backlog = 8192

# Outbound connection exhaustion on the proxy tier, 2026-08
net.ipv4.ip_local_port_range = 10240 65535
net.ipv4.tcp_tw_reuse = 1

# Database host: prefer dropping cache over swapping (not 0 - that risks OOM)
vm.swappiness = 10

# sysctl --system     to apply
# systemd: LimitNOFILE=65536 in the service unit, not just ulimit`,
      },
    ],
    traps: [
      'Copying a list of sysctl settings from a blog without measuring.',
      "Raising `somaxconn` without raising the application's own listen backlog.",
      '`vm.swappiness=0`, which makes OOM kills more likely.',
      'Setting `ulimit` in a shell and expecting it to apply to a systemd service - it needs `LimitNOFILE`.',
    ],
    followUps: [
      'What symptom would justify raising `somaxconn`?',
      'Why is `swappiness=0` usually wrong?',
    ],
    tags: ['sysctl', 'kernel tuning', 'performance', 'limits', 'advanced'],
  },
  {
    id: 'itv-linux-26',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you harden a Linux server?',
    probing: 'Practical security baseline.',
    answer: [
      'The highest-value items first, because a short list applied consistently beats a long list applied partially.',
      '**SSH**: disable password authentication and root login entirely, use keys or certificates, and put it behind a bastion or a VPN rather than exposing it to the internet. Most brute-force traffic disappears the moment password auth is off.',
      '**Minimise what is running and reachable**: uninstall what is not needed, and a default-deny firewall allowing only the ports that must be open. `ss -tulpn` tells you what is actually listening, which is frequently more than people expect.',
      '**Patch promptly**, with automatic security updates where the risk of an unattended restart is acceptable. Unpatched known vulnerabilities are how most compromises actually happen, not novel attacks.',
      '**Least privilege**: no shared accounts, sudo scoped to specific commands, and services running as dedicated unprivileged users rather than root.',
      '**Mandatory access control** - SELinux or AppArmor - left **enabled**. Disabling it is the standard response to a permission problem and removes a genuinely effective containment layer; fixing the policy is the correct response.',
      '**Audit and logging** shipped off the host, so a compromise cannot erase the evidence. `auditd` for privileged actions.',
      'And **systemd sandboxing** per service - `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp` - which is cheap, well supported and very rarely applied.',
    ],
    code: [
      {
        title: 'SSH and firewall baseline',
        language: 'bash',
        code: `# /etc/ssh/sshd_config.d/99-hardening.conf
# PermitRootLogin no
# PasswordAuthentication no
# KbdInteractiveAuthentication no
# PubkeyAuthentication yes
# MaxAuthTries 3
# ClientAliveInterval 300
# AllowGroups ssh-users

sshd -t && systemctl reload sshd      # validate BEFORE reloading

# Default deny, allow only what is needed
ufw default deny incoming
ufw default allow outgoing
ufw allow from 10.0.0.0/8 to any port 22 proto tcp
ufw allow 443/tcp
ufw enable

ss -tulpn                             # what is actually listening?`,
      },
      {
        title: 'Per-service sandboxing, which is cheap and underused',
        language: 'text',
        code: `# systemctl edit app.service
[Service]
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=/var/lib/app /var/log/app
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
SystemCallFilter=@system-service

# systemd-analyze security app.service    - scores the unit and lists gaps`,
      },
    ],
    traps: [
      'Disabling SELinux or AppArmor to fix a permission error.',
      'Reloading sshd with a broken config and locking yourself out - always `sshd -t` first.',
      'A firewall configured but not enabled, or enabled without an SSH rule.',
      'Logs kept only on the host, so an attacker can remove them.',
    ],
    followUps: [
      'What is the single highest-value change?',
      'Why not disable SELinux when it blocks something?',
    ],
    tags: ['security', 'hardening', 'ssh', 'selinux', 'firewall'],
  },
  {
    id: 'itv-linux-27',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A service works on one server and not on an identical one. How do you find the difference?',
    probing: 'Systematic differential debugging.',
    answer: [
      'The claim that they are identical is the thing to test, because they never are. I would work through the likely differences in order rather than guessing.',
      '**Configuration**: diff the config files directly. `diff <(ssh a cat /etc/app/config.yaml) <(ssh b cat ...)` is one command and resolves a surprising proportion.',
      '**Packages and versions**: diff the installed package lists, and the specific versions of whatever the service depends on. A minor version difference in a library is a very common cause.',
      "**Environment**: the service's environment differs - a systemd `Environment=` line, a drop-in on one host and not the other, an `/etc/default` file. `systemctl show app -p Environment` shows what it actually gets.",
      '**Permissions and ownership**: file modes, ownership, SELinux or AppArmor context. A file with the wrong SELinux label produces a permission error that looks nothing like a labelling problem, and `ausearch` or `audit.log` is where the answer is.',
      '**Network**: routing, DNS resolution, firewall rules, security groups. `ip route get`, `getent hosts` and a direct connection test to whatever it depends on.',
      '**Resources**: different memory or CPU limits, different disk space, a different kernel version.',
      'The systematic way to do this is to **collect the same facts from both and diff them** rather than checking one thing at a time - a small script that dumps versions, config checksums, environment, listening sockets and limits, run on both, turns this into a two-minute comparison.',
      'And afterwards: if the hosts were meant to be identical and were not, the real problem is the configuration management, and that is what needs fixing.',
    ],
    code: [
      {
        title: 'Collect the same facts from both, then diff',
        language: 'bash',
        code: `#!/usr/bin/env bash
# fingerprint.sh - run on both hosts, diff the output
{
  echo "=== os"
  uname -a; cat /etc/os-release | head -2

  echo "=== service"
  systemctl show app -p ExecStart -p Environment -p User -p LimitNOFILE

  echo "=== package versions"
  dpkg -l 2>/dev/null | awk '{print $2, $3}' | sort ||
    rpm -qa --qf '%{NAME} %{VERSION}\\n' | sort

  echo "=== config checksums"
  find /etc/app -type f -exec sha256sum {} + | sort -k2

  echo "=== listening"
  ss -tulpn | sort

  echo "=== limits"
  cat /proc/$(pgrep -f '[a]pp' | head -1)/limits

  echo "=== selinux"
  getenforce 2>/dev/null; ls -Z /etc/app/ 2>/dev/null
} 2>&1`,
      },
      {
        title: 'Then the comparison is one command',
        language: 'bash',
        code: `diff <(ssh host-a 'bash -s' < fingerprint.sh) \\
     <(ssh host-b 'bash -s' < fingerprint.sh)

# SELinux denials, which look like ordinary permission errors
ausearch -m AVC -ts recent
journalctl -t setroubleshoot --since '1 hour ago'`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Finding the difference',
        caption:
          'Collecting the same facts from both and diffing beats checking one thing at a time.',
        nodes: [
          { label: 'Config files', detail: 'diff them directly', tone: 'accent' },
          { label: 'Package and library versions' },
          { label: 'Service environment', detail: 'systemctl show, drop-ins' },
          {
            label: 'Permissions and SELinux context',
            detail: 'Denials look like ordinary errors',
            tone: 'warning',
          },
          { label: 'Network: routing, DNS, firewall' },
          { label: 'Fix the config management, not just the host', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'SELinux denials are the most commonly misdiagnosed cause here, because the error surfaces as a generic permission failure. `ausearch -m AVC` is the check people skip.',
      'A fingerprint script is worth keeping - it turns this class of problem into a two-minute job every time it recurs.',
      'If the hosts drifted, the configuration management is the real defect. Fixing one host leaves the next one to fail the same way.',
    ],
    traps: [
      'Accepting "they are identical" without testing it.',
      'Checking one thing at a time rather than diffing everything.',
      'Missing SELinux, whose denials look like ordinary permission errors.',
      'Fixing the host and not the drift that produced it.',
    ],
    followUps: [
      'Why are SELinux denials so often misdiagnosed?',
      'What would you fix after resolving the immediate problem?',
    ],
    tags: ['scenario', 'troubleshooting', 'drift', 'selinux', 'advanced'],
  },
  {
    id: 'itv-linux-28',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is LVM and when would you use it?',
    probing: 'Logical volume management and its practical value.',
    answer: [
      'LVM puts an abstraction layer between physical disks and filesystems. **Physical volumes** (disks or partitions) are grouped into a **volume group**, and **logical volumes** are carved out of that group and formatted with a filesystem.',
      'The value is **flexibility after the fact**. A logical volume can be **grown** while mounted, by adding space from the volume group - and the volume group can be extended by adding another disk. Without LVM, growing a filesystem means repartitioning, which is far more disruptive.',
      '**Snapshots** are the other major feature: a point-in-time copy of a logical volume, created almost instantly, which is how you take a consistent backup of a running database without stopping it. The snapshot is copy-on-write, so it costs space only as the original changes.',
      'The caveats worth stating: a snapshot is **not a backup** - it lives on the same disks, so it does not protect against hardware failure - and a snapshot that runs out of allocated space becomes invalid, which is a real operational trap.',
      'Where it matters less: on cloud instances the provider already gives you resizable volumes and snapshots, so LVM adds a layer for less benefit. On immutable infrastructure it matters even less, since machines are replaced rather than grown. It remains genuinely valuable on physical servers and long-lived VMs.',
    ],
    code: [
      {
        title: 'Creating and growing',
        language: 'bash',
        code: `pvcreate /dev/sdb /dev/sdc
vgcreate data-vg /dev/sdb /dev/sdc
lvcreate -L 100G -n app-lv data-vg
mkfs.ext4 /dev/data-vg/app-lv
mount /dev/data-vg/app-lv /var/lib/app

# Grow it - online, no downtime
lvextend -L +50G /dev/data-vg/app-lv
resize2fs /dev/data-vg/app-lv          # xfs_growfs for XFS

# Out of space in the group? Add a disk.
pvcreate /dev/sdd
vgextend data-vg /dev/sdd
lvextend -l +100%FREE /dev/data-vg/app-lv

vgs; lvs; pvs                          # current state`,
      },
      {
        title: 'Snapshot for a consistent backup',
        language: 'bash',
        code: `# Quiesce, snapshot, release - the database is paused for seconds, not minutes
mysql -e 'FLUSH TABLES WITH READ LOCK;' &
lvcreate -L 20G -s -n app-snap /dev/data-vg/app-lv
mysql -e 'UNLOCK TABLES;'

mount -o ro /dev/data-vg/app-snap /mnt/snap
tar czf /backups/app-$(date +%F).tar.gz -C /mnt/snap .
umount /mnt/snap
lvremove -f /dev/data-vg/app-snap      # ALWAYS remove it when done

# A snapshot that fills up becomes invalid - watch it
lvs -o lv_name,data_percent,snap_percent`,
      },
    ],
    traps: [
      'A snapshot left in place, which fills up and becomes invalid - and slows writes to the origin meanwhile.',
      'Treating a snapshot as a backup; it is on the same disks.',
      'Extending the logical volume and forgetting to grow the filesystem.',
      'Adding LVM on cloud instances where the provider already offers resize and snapshots.',
    ],
    followUps: [
      'Why is an LVM snapshot not a backup?',
      'What happens when a snapshot runs out of space?',
    ],
    tags: ['lvm', 'storage', 'snapshots', 'volumes'],
  },
  {
    id: 'itv-linux-29',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you transfer files between machines?',
    probing: 'Everyday tooling with the differences that matter.',
    answer: [
      '**`scp`** is the simplest - it copies over SSH and is fine for a single file. It has no resume, no incremental behaviour, and it transfers everything every time.',
      '**`rsync`** is the one worth knowing properly. It transfers **only the differences**, so a second run over a large directory copies almost nothing. `-a` preserves permissions, ownership and timestamps, `-z` compresses in transit, `-P` shows progress and allows resume, and **`-n` is a dry run** that shows exactly what would be transferred - which is worth running first for anything with `--delete`.',
      '**`--delete`** makes the destination match the source by removing extra files, which is powerful and dangerous: a mistyped source path with `--delete` can empty the destination. Always dry-run it.',
      'The **trailing slash** on the source is the detail everyone gets wrong: `rsync -a /src/ /dst/` copies the *contents* of `src` into `dst`, while `rsync -a /src /dst/` copies the *directory itself*, producing `/dst/src/`. Meaning it in one form and typing the other produces a nested mess or overwrites the wrong thing.',
      "For **large one-off transfers**, `tar` piped over SSH avoids per-file overhead and is often faster than rsync for a fresh copy of many small files. And for anything going to or from cloud storage, the provider's own CLI handles parallelism and resume far better than either.",
    ],
    code: [
      {
        title: 'rsync, including the trailing-slash trap',
        language: 'bash',
        code: `# The trailing slash changes the meaning
rsync -avP /src/ user@host:/dst/       # contents of src -> /dst/
rsync -avP /src  user@host:/dst/       # the directory   -> /dst/src/

# ALWAYS dry-run anything with --delete
rsync -avn --delete /src/ user@host:/dst/
rsync -av  --delete /src/ user@host:/dst/

# Resume a large interrupted transfer
rsync -avP --partial --append-verify large.iso user@host:/data/

# Exclusions, and a bandwidth limit so it does not saturate the link
rsync -av --exclude '.git/' --exclude 'node_modules/' \\
      --bwlimit=10000 /src/ user@host:/dst/

# Many small files, fresh copy - tar over ssh beats rsync here
tar czf - -C /src . | ssh user@host 'tar xzf - -C /dst'`,
      },
    ],
    traps: [
      '`--delete` without a dry run, emptying the destination.',
      'The trailing slash, producing a nested directory or overwriting the wrong thing.',
      '`scp` for a large directory that will need to be re-run - rsync is far better.',
      'No `--bwlimit` on a large transfer, saturating the link for everything else.',
    ],
    followUps: ['What does the trailing slash change?', 'When is `tar | ssh` faster than rsync?'],
    tags: ['rsync', 'scp', 'transfer', 'ssh', 'fundamentals'],
  },
  {
    id: 'itv-linux-30',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'A process is consuming 100% of one CPU core and not making progress. Which would help diagnose it? Select all that apply.',
    probing: 'Investigating a spinning process.',
    options: [
      {
        id: 'a',
        text: '`strace -p PID` to see whether it is making syscalls or spinning in userspace',
      },
      { id: 'b', text: '`perf top -p PID` to see which functions are consuming the CPU' },
      {
        id: 'c',
        text: '`cat /proc/PID/stack` and `/proc/PID/wchan` to see where it is blocked in the kernel',
      },
      { id: 'd', text: 'Restarting it immediately to restore service' },
      { id: 'e', text: 'A language-level dump - `jstack` for a JVM, `py-spy` for Python' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Restarting immediately is the wrong one **as a diagnostic step** - it may well be the right operational action if users are affected, but it destroys the evidence, so the same thing happens again next week with nothing learned. Capture first, then restart.',
      '**`strace`** distinguishes the two main cases: a process making the same syscall repeatedly is spinning on something external (a retry loop, a lock, a poll); a process making **no** syscalls at all is spinning in userspace - an infinite loop in the code.',
      '**`perf top`** names the function consuming the CPU, which for a userspace spin usually identifies the loop directly.',
      '**`/proc/PID/stack` and `wchan`** show where a process is blocked in the kernel, which is what you want when it is in uninterruptible sleep rather than running.',
      '**Language-level tools** are often the fastest route for a managed runtime: `jstack` gives a thread dump showing exactly which Java threads are doing what, and `py-spy dump` does the same for Python without stopping the process.',
      'The practical order: capture a `perf` profile and a thread dump, take a core dump if it is worth it, **then** restart.',
    ],
    code: [
      {
        title: 'Capture before restarting',
        language: 'bash',
        code: `PID=1234

# Spinning in userspace, or hammering a syscall?
timeout 10 strace -c -f -p $PID

# Which function?
perf top -p $PID
perf record -p $PID -g -- sleep 20 && perf report

# Blocked in the kernel?
cat /proc/$PID/wchan; echo
sudo cat /proc/$PID/stack

# Managed runtimes - usually the fastest answer
jstack $PID > /tmp/threads.txt        # JVM
py-spy dump --pid $PID                # Python, without stopping it

# Then, if you must, capture a core and restart
gcore -o /tmp/core $PID
kill -TERM $PID`,
      },
    ],
    traps: [
      'Restarting first, so there is nothing to investigate.',
      '`strace` on a heavily loaded production process, which slows it enough to change the behaviour.',
      'Assuming 100% CPU means the code is busy - it can be spinning on a lock or a failing retry.',
      'Not checking whether it is one thread or all of them.',
    ],
    followUps: [
      'What does "no syscalls at all" tell you?',
      'How would you capture enough to investigate before restarting?',
    ],
    tags: ['cpu', 'strace', 'perf', 'debugging', 'advanced'],
  },
  {
    id: 'itv-linux-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does DNS resolution work on a Linux host?',
    probing: 'Name resolution, which is more layered than people expect.',
    answer: [
      'The path is more indirect than "read `/etc/resolv.conf`". An application usually calls `getaddrinfo`, which consults **`/etc/nsswitch.conf`** to decide the order of sources - typically `files` (meaning `/etc/hosts`) then `dns`, and possibly `mdns` or LDAP.',
      'If it reaches DNS, the resolver reads **`/etc/resolv.conf`** for nameservers, search domains and options. On a modern system that file is often a **symlink to something managed** - `systemd-resolved` at `127.0.0.53`, or NetworkManager - so editing it directly is overwritten on the next network change. That surprises people regularly.',
      '**`systemd-resolved`** adds a local caching stub resolver, per-interface DNS configuration, and its own view - which is why `resolvectl status` and `resolvectl query` are the right tools on such a system rather than reading the file.',
      'The distinction that matters when debugging: **`dig` queries DNS directly** and bypasses `nsswitch.conf` and `/etc/hosts` entirely, while **`getent hosts`** follows the same path the application will. So `dig` succeeding and the application failing is entirely possible - usually an `/etc/hosts` entry or an `nsswitch` ordering issue - and checking both is what identifies it.',
      'And `ndots` in `resolv.conf` matters for performance: a high value means short names are tried against every search domain first, which inside Kubernetes generates several failed lookups before every external call.',
    ],
    code: [
      {
        title: 'Checking every layer',
        language: 'bash',
        code: `cat /etc/nsswitch.conf | grep hosts     # the ORDER of sources
cat /etc/resolv.conf                    # nameservers, search, options ndots
ls -l /etc/resolv.conf                  # is it a managed symlink?

# systemd-resolved - the file may not reflect reality
resolvectl status
resolvectl query api.example.com

# These can disagree, and the difference is the diagnosis
dig +short api.example.com              # DNS directly, bypasses hosts/nsswitch
getent hosts api.example.com            # what the application will actually get

# Which server answered, and how long did it take?
dig api.example.com +stats | tail -6`,
      },
    ],
    traps: [
      'Editing `/etc/resolv.conf` directly when it is managed, so the change is reverted.',
      'Testing with `dig` only, missing an `/etc/hosts` entry the application uses.',
      'A high `ndots` value causing several failed lookups before every external call.',
      'Assuming DNS is fine because `ping` by IP works - a name failure looks like connectivity.',
    ],
    followUps: [
      'Why can `dig` succeed while the application cannot resolve the name?',
      'What does `ndots` do, and why does it matter in Kubernetes?',
    ],
    tags: ['dns', 'resolv.conf', 'nsswitch', 'systemd-resolved', 'troubleshooting'],
  },
  {
    id: 'itv-linux-32',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between `kill`, `kill -9` and `kill -15`?',
    probing: 'Signals, and why the default matters.',
    options: [
      {
        id: 'a',
        text: '`kill` sends SIGTERM (15) by default, which can be handled for a clean shutdown; `-9` sends SIGKILL, which cannot be caught or ignored',
      },
      { id: 'b', text: '`kill -9` is a more forceful version of the same signal' },
      { id: 'c', text: '`kill -15` terminates the parent and `-9` the child' },
      { id: 'd', text: 'They are identical' },
    ],
    correct: ['a'],
    answer: [
      '`kill` with no signal sends **SIGTERM (15)**, which is a **request** to terminate. A well-written process handles it: stop accepting work, finish what is in flight, flush buffers, close connections, exit. That is what makes a graceful shutdown possible.',
      '**SIGKILL (9)** is handled by the kernel and **cannot be caught, blocked or ignored**. The process stops immediately with no opportunity to clean up - unflushed writes are lost, connections are dropped, locks are not released, temporary files remain.',
      'So the order is always **SIGTERM first, wait, then SIGKILL if necessary**. Reaching for `-9` immediately is a habit worth breaking; it causes data loss that SIGTERM would have avoided.',
      'The case where SIGKILL genuinely will not work is a process in **uninterruptible sleep** (state `D`), usually blocked on I/O. It cannot be killed at all until the I/O completes or fails - which is itself diagnostic, because it means the problem is storage, not the process.',
      'The other signals worth knowing: **SIGHUP (1)**, conventionally "reload your configuration"; **SIGINT (2)**, what Ctrl-C sends; and **SIGSTOP/SIGCONT** to pause and resume.',
    ],
    code: [
      {
        title: 'Graceful first, forceful only if needed',
        language: 'bash',
        code: `kill 1234                        # SIGTERM - the polite request
kill -TERM 1234                  # the same thing, explicit

# Give it time, then escalate
kill -TERM 1234
for i in $(seq 1 10); do
  kill -0 1234 2>/dev/null || { echo "exited cleanly"; exit 0; }
  sleep 1
done
echo "did not exit, forcing" >&2
kill -KILL 1234

kill -HUP 1234                   # many daemons reload config on this

# A process that will not die at all - check its state
ps -o pid,stat,wchan,comm -p 1234
#  D = uninterruptible sleep - blocked on I/O, cannot be killed`,
      },
    ],
    traps: [
      '`kill -9` as a first resort, causing avoidable data loss.',
      'Expecting SIGKILL to work on a process in state `D`.',
      'Killing the parent and leaving orphaned children still running.',
      'Assuming a process that ignores SIGTERM is broken - some deliberately handle it slowly while draining.',
    ],
    followUps: [
      'Why can a process in state D not be killed?',
      'What should a well-behaved service do on SIGTERM?',
    ],
    tags: ['signals', 'kill', 'processes', 'graceful shutdown', 'fundamentals'],
  },
  {
    id: 'itv-linux-33',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you investigate a suspected compromise on a Linux host?',
    probing:
      'Incident response, including the process discipline that matters as much as the commands.',
    answer: [
      'The first decisions are **not technical**. **Preserve evidence** - do not reboot, because memory contents and running state are lost and much of the useful information is there. **Isolate rather than power off** - remove it from the network or move it to a quarantine security group, which stops further damage while keeping the machine examinable. And **escalate**: a suspected compromise has legal and regulatory dimensions and should not be handled quietly by one engineer.',
      'Then **assume the host cannot be trusted**. A compromised machine may have modified binaries, so `ps`, `ls` and `netstat` may lie. Where possible, examine it from outside - a disk snapshot mounted elsewhere, network flow logs from the infrastructure rather than the host, and centralised logs which the attacker could not alter.',
      'What to look for: **unexpected network connections** and listening ports, **unfamiliar processes** especially running from `/tmp` or `/dev/shm`, **recently modified binaries** in system directories, **new or modified accounts and SSH keys**, **new cron jobs, systemd units or shell profile entries** for persistence, and **gaps or truncation in the logs**, which is itself a strong signal.',
      'The **timeline** is the core of the investigation: establish when the earliest suspicious activity occurred, then work backwards to the entry point. File modification times, auth logs and shell history all contribute, with the caveat that all of them can be altered.',
      'And the conclusion that is usually correct: **rebuild rather than clean**. Determining with confidence that every persistence mechanism has been removed is extremely difficult, and a rebuilt host from a known-good image with the vulnerability patched is both faster and more trustworthy. The investigation matters for understanding the entry point and the blast radius, not for deciding whether to keep the machine.',
    ],
    code: [
      {
        title: 'Evidence collection - assuming the tools may be compromised',
        language: 'bash',
        code: `# Volatile state first - lost on reboot
date -u; uptime; w; last -20
ss -tunap                        # connections and listening sockets
ps auxf                          # full process tree

# Processes running from suspicious locations
ls -l /proc/*/exe 2>/dev/null | grep -E '/tmp|/dev/shm|/var/tmp|deleted'

# Persistence mechanisms
crontab -l; ls -la /etc/cron.*/ /var/spool/cron/
systemctl list-unit-files --state=enabled | tail -30
ls -la /root/.ssh/ /home/*/.ssh/
grep -rE 'curl|wget|base64|nc ' /home/*/.bashrc /home/*/.profile /etc/profile.d/

# Recently modified system binaries
find /usr/bin /usr/sbin /bin /sbin -mtime -14 -type f -ls

# Account changes
awk -F: '$3 == 0 {print "UID 0:", $1}' /etc/passwd     # extra root accounts
grep -E 'Accepted|Failed|sudo' /var/log/auth.log | tail -50`,
      },
      {
        title: 'Verify from outside the host',
        language: 'bash',
        code: `# Package integrity - compares against the package database
rpm -Va 2>/dev/null | grep -E '^..5'       # changed checksums
debsums -c 2>/dev/null                      # Debian equivalent

# Trust the infrastructure's view, not the host's
# - VPC flow logs for actual network activity
# - CloudTrail / audit logs for API calls made with this host's credentials
# - Centralised logs, which the attacker could not alter locally

# Snapshot the disk for offline analysis before doing anything else
# aws ec2 create-snapshot --volume-id vol-abc --description "incident-4821"`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Response order',
        caption: 'Isolate rather than power off - memory and running state are lost on reboot.',
        nodes: [
          { label: 'Escalate and preserve evidence', detail: 'Do not reboot', tone: 'danger' },
          {
            label: 'Isolate from the network',
            detail: 'Stop damage, keep it examinable',
            tone: 'danger',
          },
          { label: 'Snapshot the disk', detail: 'Analyse offline, from outside' },
          { label: 'Collect volatile state', detail: 'Connections, processes, memory' },
          { label: 'Build a timeline to the entry point', tone: 'warning' },
          {
            label: 'Rebuild from a known-good image',
            detail: 'Cleaning is rarely trustworthy',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'Rebooting destroys memory contents, network state and running processes - often the most useful evidence there is.',
      'Any credential that was on the host must be treated as compromised and rotated, including anything the host could reach with its cloud identity.',
      'Centralised logs and infrastructure-level flow logs are the only sources the attacker could not modify, which is a strong argument for having them before you need them.',
      'The output of the investigation should be the entry point and the blast radius, which drives the remediation - not a decision about whether the machine can be salvaged.',
    ],
    traps: [
      'Rebooting or powering off, destroying evidence.',
      "Trusting the host's own tools, which may be modified.",
      'Cleaning and returning it to service without confidence that persistence is gone.',
      'Not rotating every credential the host had access to.',
    ],
    followUps: [
      'Why isolate rather than power off?',
      'Why is rebuilding usually better than cleaning?',
    ],
    tags: ['security', 'incident response', 'forensics', 'compromise', 'advanced'],
  },
]
