import type { InterviewQuestion } from '../../../types'

/** Remaining shell ground: arrays, here-documents, ssh, and everyday tasks. */
export const shellPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-shell-36',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do arrays work in bash, and what are the pitfalls?',
    probing: 'Arrays are the main thing bash has over POSIX sh, and their syntax is unforgiving.',
    answer: [
      'An array is `arr=(a b c)`, indexed from zero. `"${arr[@]}"` expands to all elements **as separate words**, `"${arr[0]}"` is one element, `"${#arr[@]}"` is the length, and `+=` appends.',
      'The quoting is the pitfall and it is not optional. **`"${arr[@]}"`** with the quotes and `@` preserves each element exactly, including elements containing spaces. **`${arr[@]}`** unquoted re-splits every element on whitespace, and **`"${arr[*]}"`** joins them into a single string. Getting this wrong silently breaks on the first element with a space in it.',
      '**Associative arrays** - `declare -A map` - give you key-value lookup, which is genuinely useful for mapping hosts to roles or collecting counts. They need bash 4, which means they are not available on the default macOS bash.',
      'The other trap is that **arrays do not survive export**. You cannot pass an array to a child process through the environment; it has to be serialised, or the work restructured.',
      'And arrays are the correct way to **build a command with variable arguments** - accumulating flags in a string and relying on word splitting breaks as soon as any value contains a space.',
    ],
    code: [
      {
        title: 'Arrays, quoted correctly',
        language: 'bash',
        code: `services=("api" "worker" "web tier")

for s in "\${services[@]}"; do echo "[$s]"; done   # three items, correct
for s in \${services[@]};  do echo "[$s]"; done    # four items - "web" and "tier"

echo "\${#services[@]}"          # 3
services+=("cache")             # append

# Associative array (bash 4+)
declare -A roles=( [web-01]=frontend [db-01]=database )
for host in "\${!roles[@]}"; do
  echo "$host is \${roles[$host]}"
done

# Building a command safely - the right use for an array
args=(--verbose --output "/tmp/my output.txt")
[ "$DRY_RUN" = true ] && args+=(--dry-run)
mycommand "\${args[@]}"          # quoting preserved on every argument`,
      },
    ],
    traps: [
      '`${arr[@]}` without quotes, re-splitting elements containing spaces.',
      '`"${arr[*]}"` where `"${arr[@]}"` was meant.',
      'Associative arrays on a system with bash 3, where `declare -A` does not exist.',
      'Building a command as a string and relying on word splitting.',
    ],
    followUps: [
      'What is the difference between `"${arr[@]}"` and `"${arr[*]}"`?',
      'Why is an array the right way to build a command line?',
    ],
    tags: ['arrays', 'quoting', 'bash', 'gotchas'],
  },
  {
    id: 'itv-shell-37',
    level: 'basic',
    kind: 'open',
    prompt: 'What are here-documents and here-strings?',
    probing: 'Multi-line input, and the quoting behaviour people get wrong.',
    answer: [
      "A **here-document** feeds a block of text to a command's stdin: `command <<EOF ... EOF`. It is how you write a multi-line file, send a script over SSH, or pipe a block of SQL without a temporary file.",
      "The behaviour that matters is **expansion**. With an unquoted delimiter - `<<EOF` - variables and command substitutions inside the block **are expanded**, which is what you want for a template. With a **quoted** delimiter - `<<'EOF'` - nothing is expanded and the text is literal, which is what you want when the block contains shell syntax meant for the far end, such as a script being sent over SSH.",
      'Getting that backwards is the common bug: sending a script over SSH with an unquoted delimiter expands `$var` **locally** before it is sent, so the remote side receives the local value or an empty string.',
      '**`<<-EOF`** strips leading **tabs** (not spaces), which lets the block be indented to match the surrounding code.',
      'A **here-string** - `command <<< "text"` - is the single-line version, useful for feeding one value to something that reads stdin.',
    ],
    code: [
      {
        title: 'Expansion, and the SSH trap',
        language: 'bash',
        code: `VERSION=1.4.2

# Unquoted delimiter - variables expanded locally (right for a template)
cat > /etc/app/config.yaml <<EOF
version: \${VERSION}
host: $(hostname -f)
EOF

# Quoted delimiter - nothing expanded (right for a remote script)
ssh web-01 bash <<'EOF'
  set -euo pipefail
  current=$(readlink -f /opt/app/current)     # $current is evaluated REMOTELY
  echo "remote current release: $current"
EOF

# Mixing: pass values in explicitly, keep the script literal
ssh web-01 "VERSION='$VERSION' bash -s" <<'EOF'
  set -euo pipefail
  echo "deploying $VERSION"                   # comes from the env, not expanded here
EOF

# Here-string
jq -r '.version' <<< "$json_response"`,
      },
    ],
    traps: [
      'Unquoted delimiter when sending a script over SSH, expanding variables locally.',
      '`<<-` expecting it to strip spaces - it only strips tabs.',
      'The closing delimiter indented, so the shell never finds it.',
      'A here-document inside a function without consistent indentation, which is easy to break.',
    ],
    followUps: [
      'Why does an unquoted delimiter break a remote script?',
      'What exactly does `<<-` strip?',
    ],
    tags: ['heredoc', 'ssh', 'quoting', 'expansion', 'fundamentals'],
  },
  {
    id: 'itv-shell-38',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you run commands on many remote hosts?',
    probing: 'Fleet operations from shell, with the safety considerations.',
    answer: [
      'For a handful of hosts, a loop with `ssh` is fine. Beyond that the things that matter are **parallelism**, **not being prompted**, and **collecting results distinguishably**.',
      'The SSH options that make it work unattended: **`-o BatchMode=yes`** so it never prompts for a password and fails instead, **`-o ConnectTimeout=5`** so an unreachable host does not hang the loop, and **`-n`** to stop `ssh` consuming stdin - without it, an `ssh` inside a `while read` loop eats the rest of the input and the loop runs once.',
      'For **parallelism**, `xargs -P` over the host list is the simplest thing that works everywhere. GNU `parallel` adds per-host output files and failure summaries. `pssh` exists for exactly this. For anything recurring, Ansible is the better tool - it handles all of this plus idempotence and reporting.',
      '**Collect results per host**, not to a shared stream, or the output interleaves and is unusable. A file per host, or a single line per host emitted atomically.',
      'And the safety point: **limit the blast radius**. A loop over every host running a command is one typo from a fleet-wide incident. Test on one host, then a batch, then the rest - and have a way to stop partway.',
    ],
    code: [
      {
        title: 'Unattended SSH across a fleet',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -uo pipefail

readonly SSH_OPTS=(-n -o BatchMode=yes -o ConnectTimeout=5
                   -o StrictHostKeyChecking=accept-new)

run_on_host() {
  local host="$1" out rc
  out=$(ssh "\${SSH_OPTS[@]}" "$host" 'uptime' 2>&1) && rc=0 || rc=$?
  # One complete line, printed atomically - no interleaving
  printf '%s\\t%s\\t%s\\n' "$host" "$rc" "\${out//$'\\n'/ }"
}
export -f run_on_host
export SSH_OPTS

# Bounded parallelism across the fleet
xargs -P 20 -I {} bash -c 'run_on_host "$@"' _ {} < hosts.txt | sort > results.tsv

awk -F'\\t' '$2 != 0 {print "FAILED: " $1 " - " $3}' results.tsv
failed=$(awk -F'\\t' '$2 != 0' results.tsv | wc -l)
echo "$failed of $(wc -l < hosts.txt) hosts failed" >&2`,
      },
      {
        title: 'Rolling, with a check between batches',
        language: 'bash',
        code: `batch_size=5
mapfile -t hosts < hosts.txt

for (( i = 0; i < \${#hosts[@]}; i += batch_size )); do
  batch=("\${hosts[@]:i:batch_size}")
  echo "batch: \${batch[*]}" >&2

  printf '%s\\n' "\${batch[@]}" |
    xargs -P "$batch_size" -I {} ssh "\${SSH_OPTS[@]}" {} 'systemctl restart app'

  # Verify before continuing - otherwise you break the fleet slowly
  for h in "\${batch[@]}"; do
    curl -fsS --max-time 10 "http://\${h}:8080/healthz" >/dev/null || {
      echo "ABORT: $h unhealthy after restart" >&2
      exit 1
    }
  done
done`,
      },
    ],
    traps: [
      "Omitting `-n`, so `ssh` consumes the rest of a `while read` loop's input.",
      'No `BatchMode`, so an unattended run hangs on a password prompt.',
      'No `ConnectTimeout`, so one dead host blocks everything.',
      'Parallel output to a shared stream, interleaving into unusable text.',
      'No batching or health check, so a bad command breaks the whole fleet.',
    ],
    followUps: [
      'Why does `ssh` need `-n` inside a `while read` loop?',
      'When would you stop doing this in shell and use Ansible?',
    ],
    tags: ['ssh', 'fleet', 'parallelism', 'safety', 'automation'],
  },
  {
    id: 'itv-shell-39',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `chmod +x script.sh` do, and why might the script still not run?',
    probing: 'Permissions and the shebang - two separate reasons a script fails to execute.',
    options: [
      {
        id: 'a',
        text: 'Adds the execute bit; it can still fail from a missing or wrong shebang, a wrong interpreter path, CRLF line endings, or `noexec` on the filesystem',
      },
      { id: 'b', text: 'Makes the script executable and it will always run' },
      { id: 'c', text: 'Compiles the script' },
      { id: 'd', text: 'Changes the owner of the script' },
    ],
    correct: ['a'],
    answer: [
      '`chmod +x` sets the execute permission, which is necessary but not sufficient. Several other things stop a script running.',
      '**The shebang.** Without a `#!` line the kernel does not know what to run it with; with the wrong path - `#!/bin/bash` on a system where bash is elsewhere - you get "no such file or directory", which confusingly refers to the **interpreter**, not the script. `#!/usr/bin/env bash` finds it on the PATH.',
      '**CRLF line endings.** A file edited on Windows has `\\r` at the end of every line, including the shebang - so the kernel looks for an interpreter called `/bin/bash\\r` and reports "bad interpreter". This is a very common and very confusing failure.',
      '**`noexec` on the filesystem.** `/tmp` is frequently mounted `noexec`, so nothing there can be executed regardless of permissions. Running it as `bash script.sh` works around it.',
      'And **`chmod +x` respects umask** - it adds execute for user, group and other subject to the umask, which occasionally means group and other do not get it.',
    ],
    code: [
      {
        title: 'Diagnosing each cause',
        language: 'bash',
        code: `ls -l script.sh                   # is the execute bit set?
head -1 script.sh | cat -A        # shebang, and CRLF shows as ^M$

file script.sh                    # "with CRLF line terminators" is the tell
dos2unix script.sh                # or: sed -i 's/\\r$//' script.sh

mount | grep ' /tmp '             # noexec?
bash script.sh                    # works even on a noexec filesystem

# The portable shebang
# !/usr/bin/env bash   - finds bash on the PATH, not at a fixed location`,
      },
    ],
    traps: [
      '"bad interpreter: No such file or directory" read as the script missing, when it is CRLF or the interpreter path.',
      'Scripts in `/tmp` on a `noexec` mount.',
      '`#!/bin/bash` hardcoded where bash is elsewhere.',
      '`chmod 777` used to fix a permission problem, which is both excessive and rarely the actual cause.',
    ],
    followUps: ['Why does a CRLF line ending break the shebang?'],
    tags: ['permissions', 'shebang', 'crlf', 'troubleshooting', 'fundamentals'],
  },
  {
    id: 'itv-shell-40',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you compare files and directories from the command line?',
    probing: 'Everyday tooling for configuration drift and verification.',
    answer: [
      '**`diff`** compares two files line by line. `-u` gives unified format, which is what patches and code review use and is much more readable. `-r` recurses through directories, and `-q` reports only whether files differ, which is faster when you do not need the detail.',
      '**`cmp`** compares byte by byte and is the right tool for binary files - it tells you the first differing byte rather than trying to show lines. `cmp -s` is silent and just sets an exit status, which is the cheapest way to test whether two files are identical.',
      '**`md5sum` or `sha256sum`** compare content without having both files locally - checksum on each side and compare the hashes. That is how you verify a transfer or check whether a config is the same on twenty hosts.',
      '**`rsync -avn --delete`** in dry-run mode is an excellent directory comparison: it lists exactly what would change to make one match the other, which is often more useful than a diff.',
      'And **process substitution** lets you diff the **output of commands** rather than files, which is how you compare configuration between two hosts without copying anything: `diff <(ssh a cmd) <(ssh b cmd)`.',
    ],
    code: [
      {
        title: 'Comparing files, directories and command output',
        language: 'bash',
        code: `diff -u old.conf new.conf                 # readable unified diff
diff -rq /etc/app /etc/app.backup         # which files differ, recursively
cmp -s a.bin b.bin && echo identical      # binary, exit status only

# Compare across hosts without copying anything
diff <(ssh web-01 'rpm -qa | sort') <(ssh web-02 'rpm -qa | sort')
diff <(ssh web-01 'cat /etc/app/config.yaml') <(ssh web-02 'cat /etc/app/config.yaml')

# What would it take to make these directories match?
rsync -avn --delete /etc/app/ /etc/app.backup/

# Content comparison by checksum, across many hosts
for h in "\${hosts[@]}"; do
  printf '%s %s\\n' "$h" "$(ssh -n "$h" 'sha256sum /etc/app/config.yaml | cut -d" " -f1')"
done | sort -k2 | awk '{print} END {}' | uniq -f1 -c | sort -rn`,
      },
    ],
    traps: [
      '`diff` on binary files, producing "Binary files differ" and nothing useful - use `cmp`.',
      'Comparing files with different line endings and seeing every line as changed.',
      'Forgetting the trailing slash on `rsync` source paths, which changes the meaning.',
      'Comparing sorted output without sorting both sides.',
    ],
    followUps: [
      'How would you check whether a config file is identical across fifty hosts?',
      'Why is `rsync -n` useful as a comparison tool?',
    ],
    tags: ['diff', 'cmp', 'rsync', 'drift', 'comparison'],
  },
  {
    id: 'itv-shell-41',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you write a script that safely deletes old files?',
    probing:
      'A deceptively dangerous task - `rm -rf` in a script is where real disasters come from.',
    answer: [
      'This is one of the highest-risk things a script can do, and the safety comes from several independent layers rather than one careful line.',
      '**Never build a path by concatenating variables into `rm -rf`.** An unset or empty variable turns `rm -rf "$BASE/$SUB"` into `rm -rf /`. `set -u` prevents the unset case, and `"${VAR:?message}"` fails explicitly if it is empty - both are worth having.',
      '**Validate the target before deleting.** Check it is an absolute path, check it is under the expected root, check it is not `/` or a handful of critical paths, and check it actually exists. A few lines of validation is cheap insurance.',
      '**Use `find` with explicit criteria rather than a glob**, so the selection is precise: `-type f`, `-mtime +30`, `-name` matching what you expect. `find` also refuses to follow symlinks by default, where a glob will happily match one.',
      '**Dry run first, always.** Print what would be deleted, and require a flag to actually do it. For a scheduled job, run it in dry-run mode for a week and read the output before enabling deletion.',
      'And **log what was deleted**, so if something goes wrong there is a record of exactly what went.',
    ],
    code: [
      {
        title: 'Layered safety around deletion',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

readonly BASE="\${BACKUP_ROOT:?BACKUP_ROOT must be set}"
readonly RETENTION_DAYS="\${RETENTION_DAYS:-30}"
DRY_RUN="\${DRY_RUN:-true}"          # safe by default; opt IN to deleting

die() { echo "ERROR: $*" >&2; exit 1; }

# Validate the target before going anywhere near rm
[[ "$BASE" = /* ]]            || die "BASE must be an absolute path: $BASE"
[[ "$BASE" != "/" ]]          || die "refusing to operate on /"
[[ "$BASE" == /backups/* ]]   || die "BASE must be under /backups: $BASE"
[ -d "$BASE" ]                || die "not a directory: $BASE"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "RETENTION_DAYS must be a number"

# Explicit criteria, not a glob
mapfile -t victims < <(
  find "$BASE" -mindepth 1 -maxdepth 1 -type d -name '20*' \\
       -mtime "+\${RETENTION_DAYS}" -print
)

[ "\${#victims[@]}" -gt 0 ] || { echo "nothing to remove"; exit 0; }

echo "would remove \${#victims[@]} directories older than \${RETENTION_DAYS} days:"
printf '  %s\\n' "\${victims[@]}"

if [ "$DRY_RUN" != "false" ]; then
  echo "dry run - set DRY_RUN=false to actually delete"
  exit 0
fi

for d in "\${victims[@]}"; do
  echo "removing $d" | logger -t backup-prune
  rm -rf -- "$d"
done`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Layers before anything is deleted',
        caption:
          'Each layer independently prevents the worst case. Dry-run by default is the most important.',
        nodes: [
          {
            label: 'set -euo pipefail',
            detail: 'Unset variables fail rather than expand',
            tone: 'accent',
          },
          { label: 'Validate: absolute, under the expected root', tone: 'warning' },
          { label: 'find with explicit criteria', detail: 'Not a glob, not a built path' },
          { label: 'Print what would go', detail: 'And how many' },
          { label: 'Dry-run by default', detail: 'Deleting requires opting in', tone: 'danger' },
          { label: 'Log each deletion', tone: 'success' },
        ],
      },
    ],
    deeper: [
      '`rm -rf -- "$path"` with the `--` stops a path beginning with a dash being read as options.',
      'Moving to a holding area and deleting after a delay gives a recovery window that immediate deletion does not.',
      'On a filesystem with snapshots, deletion is recoverable - worth knowing before an incident rather than during one.',
    ],
    traps: [
      '`rm -rf "$BASE/$SUB"` with either variable empty.',
      'A glob instead of `find`, which can match a symlink to somewhere else.',
      'Dry-run as an opt-in flag rather than the default.',
      'No logging, so there is no record of what was removed.',
    ],
    followUps: [
      'Why should dry-run be the default rather than a flag?',
      'What does the `--` in `rm -rf -- "$path"` protect against?',
    ],
    tags: ['rm', 'safety', 'find', 'dry run', 'advanced'],
  },
  {
    id: 'itv-shell-42',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you measure and improve a slow script?',
    probing: 'Performance work in shell, where the causes are predictable.',
    answer: [
      'First **measure**. `time` gives the total, and `PS4` with a timestamp plus `set -x` gives a per-command timeline, which usually makes the slow part obvious immediately. For anything longer, wrapping stages in a timing function and logging each one turns it into data.',
      'The dominant cost in shell is almost always **process spawning**. A loop that calls `grep`, `sed`, `awk`, `date` or `basename` once per iteration spawns thousands of processes, and each one costs a millisecond or more. On ten thousand iterations that is the entire runtime.',
      'So the main improvements are: **use a built-in instead of a command** - parameter expansion instead of `basename` and `sed`, `[[` instead of `expr`; **do the whole file in one tool** rather than looping; and **avoid re-reading the same data** in a loop.',
      'Then **pipeline ordering** - the cheapest, most selective filter first - and **`LC_ALL=C`** for sorting and grepping ASCII, which is often several times faster.',
      'Then **parallelism** with `xargs -P` where the work is independent.',
      'And the honest boundary: if the script is slow because it is doing real computation or complex logic, shell is the wrong tool and rewriting the hot part in Python or awk will beat any amount of shell optimisation.',
    ],
    code: [
      {
        title: 'Timing, and the fixes that matter',
        language: 'bash',
        code: `# Per-command timeline
PS4='+ $(date "+%s.%N") \${BASH_SOURCE##*/}:\${LINENO}: '
set -x

# Per-stage timing
time_stage() {
  local name="$1"; shift
  local start=$SECONDS
  "$@"
  echo "stage=\${name} seconds=$(( SECONDS - start ))" >&2
}
time_stage fetch fetch_data
time_stage transform transform_data`,
      },
      {
        title: 'Built-ins instead of subprocesses',
        language: 'bash',
        code: `# SLOW - two subprocesses per iteration
for f in "\${files[@]}"; do
  name=$(basename "$f")
  ext=$(echo "$f" | sed 's/.*\\.//')
done

# FAST - parameter expansion, no processes at all
for f in "\${files[@]}"; do
  name="\${f##*/}"
  ext="\${f##*.}"
done

# SLOW - date called once per line
while read -r line; do echo "$(date -Is) $line"; done < input

# FAST - one call, reused
now=$(date -Is)
while read -r line; do echo "$now $line"; done < input

# Sorting large ASCII data
LC_ALL=C sort -S 1G --parallel=8 -u large.txt > sorted.txt`,
      },
    ],
    traps: [
      'A subprocess per loop iteration - the single biggest cost in shell.',
      '`cat file | grep` where `grep file` reads it directly.',
      'Re-reading the same file inside a loop.',
      'Optimising shell when the task should be a single `awk` program or a Python script.',
    ],
    followUps: [
      'Why is parameter expansion so much faster than `basename`?',
      'When would you rewrite it rather than optimise it?',
    ],
    tags: ['performance', 'subprocesses', 'parameter expansion', 'profiling', 'advanced'],
  },
  {
    id: 'itv-shell-43',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you schedule a script to run regularly?',
    probing: 'Scheduling options and their differences.',
    answer: [
      '**cron** is the traditional answer: a line per job in a crontab, with five fields for minute, hour, day of month, month and day of week. It is everywhere and it is simple.',
      'Its limitations are real though. Output goes to mail, which is usually discarded, so failures are silent. It does not run a missed job after downtime. There is no dependency ordering, no concurrency control, and the environment is minimal - which is the cause of most "works manually, fails in cron" problems.',
      '**systemd timers** address all of that: output goes to the journal automatically, `Persistent=true` runs a job missed while the machine was off, `OnFailure=` can trigger an alerting unit, the service unit can declare dependencies, and the environment is explicit. The cost is two files instead of one line, and it is Linux-only.',
      'For **containerised** environments, a Kubernetes **CronJob** is the equivalent, with `concurrencyPolicy` to control overlap and `activeDeadlineSeconds` to bound a hung run.',
      'Whichever you use, the things to get right are the same: **capture output somewhere durable**, **prevent overlapping runs**, and **alert on absence** rather than only on failure - because a job that never runs produces no failure to alert on.',
    ],
    code: [
      {
        title: 'cron, done as well as cron allows',
        language: 'bash',
        code: `SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=ops@example.com

# min hour dom mon dow
0    2    *   *   *   /opt/app/bin/nightly.sh >> /var/log/nightly.log 2>&1
*/15 *    *   *   *   /opt/app/bin/sync.sh 2>&1 | logger -t sync
0    */6  *   *   *   flock -n /var/run/report.lock /opt/app/bin/report.sh`,
      },
      {
        title: 'A systemd timer, which solves what cron cannot',
        language: 'text',
        code: `# /etc/systemd/system/nightly.service
[Unit]
Description=Nightly job
OnFailure=alert@%n.service

[Service]
Type=oneshot
ExecStart=/opt/app/bin/nightly.sh
User=app
Environment=DEPLOY_ENV=prod
TimeoutStartSec=3600

# /etc/systemd/system/nightly.timer
[Unit]
Description=Run the nightly job

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true              # run on boot if the scheduled time was missed
RandomizedDelaySec=300       # spread load across a fleet

[Install]
WantedBy=timers.target

# systemctl enable --now nightly.timer
# systemctl list-timers
# journalctl -u nightly.service --since yesterday`,
      },
    ],
    traps: [
      'Relying on cron mail, which is almost always discarded.',
      'No lock, so a job that overruns overlaps with the next run.',
      'Assuming the interactive environment - cron has almost none of it.',
      '`%` unescaped in a crontab, which cron treats as a newline.',
    ],
    followUps: [
      'What does `Persistent=true` give you over cron?',
      'Why does a `%` in a crontab line cause problems?',
    ],
    tags: ['cron', 'systemd timers', 'scheduling', 'kubernetes', 'fundamentals'],
  },
  {
    id: 'itv-shell-44',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does `exec` do in a shell script?',
    probing: 'A construct with two quite different uses.',
    options: [
      {
        id: 'a',
        text: 'Replaces the current shell process with the command, or without a command, applies redirections to the shell itself',
      },
      { id: 'b', text: 'Runs the command in the background' },
      { id: 'c', text: 'Runs the command with elevated privileges' },
      { id: 'd', text: 'Executes the command in a subshell' },
    ],
    correct: ['a'],
    answer: [
      '**With a command**, `exec` replaces the shell process entirely - same PID, no fork, and nothing after it in the script runs. That matters in containers: a wrapper script ending in `exec "$@"` means the real process becomes PID 1 and **receives SIGTERM directly**, rather than the shell holding PID 1 and swallowing it.',
      '**Without a command**, `exec` applies redirections to the **current shell**, so everything after it is redirected. `exec > /var/log/script.log 2>&1` at the top of a script sends all subsequent output to the log without redirecting each command.',
      'The other common use is **file descriptors for locking**: `exec 200>/var/run/x.lock` opens a descriptor that stays open for the life of the script, which is what `flock -n 200` then holds.',
      'The thing to remember is that `exec` with a command is a **point of no return** - the script ends there, and any cleanup after it never runs.',
    ],
    code: [
      {
        title: 'Both uses',
        language: 'bash',
        code: `# Redirect everything from here onward
exec > >(logger -t myjob -p user.info)
exec 2> >(logger -t myjob -p user.err)
echo "this goes to syslog"

# A file descriptor held open, for locking
exec 200>/var/run/myjob.lock
flock -n 200 || { echo "already running" >&2; exit 1; }

# Container entrypoint - the real process becomes PID 1 and gets SIGTERM
#!/usr/bin/env bash
set -euo pipefail
./wait-for-dependencies.sh
exec "$@"                      # nothing after this line runs`,
      },
    ],
    traps: [
      'Cleanup code after `exec <command>`, which never runs.',
      'An entrypoint script that ends with `"$@"` rather than `exec "$@"`, so the shell stays PID 1 and SIGTERM is swallowed.',
      'Redirecting with `exec` early and then losing the ability to write to the terminal.',
    ],
    followUps: [
      'Why does a container entrypoint need `exec "$@"`?',
      'What happens to the code after `exec somecommand`?',
    ],
    tags: ['exec', 'containers', 'signals', 'redirection', 'file descriptors'],
  },
  {
    id: 'itv-shell-45',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'You inherit a 900-line bash script that nobody understands and everyone is afraid of. What do you do?',
    probing: 'Dealing with legacy automation - a judgement question about risk and sequencing.',
    answer: [
      'The instinct is to rewrite it. I would resist that initially, because a 900-line script that works encodes a lot of knowledge that is not written down anywhere else - every workaround in it is there because something broke once.',
      'So I would start by **making it safer without changing what it does**. Run `shellcheck` and fix what it reports - that alone typically removes a large number of latent bugs and costs nothing in behaviour. Add `set -euo pipefail` carefully, testing as you go, because a script written without it may depend on continuing past failures in places.',
      'Then **understand it**. Run it with `set -x` in a safe environment and read the trace - that shows what it actually does rather than what the code appears to say. Document the entry points, the inputs, and what it touches.',
      'Then **make it testable**. Extract the pure parts into functions, add a `--dry-run` that prints rather than acts, and get it into a state where someone can run it without consequences.',
      'Then **improve incrementally**, with the riskiest parts last. Each change small enough to review and revert.',
      'A **rewrite** becomes the right answer when the script is doing something shell is genuinely bad at - parsing JSON, complex branching, maintaining state - or when the incremental path has stalled. Even then, I would do it **strangler-style**: extract one piece into Python, have the shell script call it, and repeat. A big-bang rewrite of something nobody fully understands reliably loses behaviour that mattered.',
      'And throughout, the question to keep asking is **what breaks if this is wrong**. That determines how careful each change needs to be, and it is a better guide than the size of the file.',
    ],
    code: [
      {
        title: 'The first pass - safety without behaviour change',
        language: 'bash',
        code: `# 1. What does shellcheck say? Usually a lot.
shellcheck -f gcc legacy.sh | tee shellcheck.txt
wc -l shellcheck.txt

# 2. What does it actually do? The trace, not the code.
PS4='+ \${LINENO}: ' bash -x ./legacy.sh --dry-run 2>&1 | tee trace.log

# 3. What does it touch? A rough map before changing anything.
grep -nE '(^|[^#])(rm|mv|cp|curl|ssh|systemctl|kubectl|aws|psql)' legacy.sh

# 4. Where are the entry points and the branches?
grep -nE '^[a-z_]+\\(\\)|^\\s*case |^\\s*if ' legacy.sh | head -50`,
      },
      {
        title: 'Strangler extraction - one piece at a time',
        language: 'bash',
        code: `# Before: 200 lines of JSON parsing with sed and awk, in the middle of the script

# After: the same logic in Python, called from the script.
# Small, reviewable, revertible - and the rest is untouched.
inventory_json=$(./bin/build-inventory.py --environment "$ENVIRONMENT") \\
  || die "inventory generation failed"

# Repeat for the next piece. The shell script shrinks over time and
# nothing is ever rewritten wholesale.`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Order of work on inherited automation',
        caption:
          'Safety and understanding first; rewriting is the last resort, and incremental when it happens.',
        nodes: [
          {
            label: 'shellcheck, fix what it finds',
            detail: 'No behaviour change, real risk removed',
            tone: 'success',
          },
          {
            label: 'Read a trace, not the code',
            detail: 'What it does, not what it says',
            tone: 'accent',
          },
          { label: 'Document inputs and side effects' },
          { label: 'Add --dry-run and make it testable', tone: 'warning' },
          { label: 'Improve incrementally, riskiest last' },
          { label: 'Strangler-rewrite only where shell is the wrong tool', tone: 'muted' },
        ],
      },
    ],
    deeper: [
      'Adding `set -e` to a script written without it can change behaviour, because it may rely on continuing past failures. Add it and test rather than assuming it is safe.',
      'The workarounds in an old script are usually load-bearing. Deleting something that looks pointless is how a rewrite loses behaviour.',
      'Getting it into version control with a change history, if it is not already, is sometimes the single most valuable first step.',
    ],
    traps: [
      'Rewriting immediately, losing undocumented behaviour.',
      'Adding `set -e` without testing, changing behaviour silently.',
      'Removing code that looks unnecessary but was added for a reason nobody recorded.',
      'A big-bang rewrite of something nobody fully understands.',
    ],
    followUps: [
      'When is a rewrite actually the right call?',
      'Why is adding `set -e` to an old script not automatically safe?',
    ],
    tags: ['scenario', 'legacy', 'refactoring', 'risk', 'advanced'],
  },
  {
    id: 'itv-shell-46',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you read input from a user or from a file?',
    probing: 'Input handling, with the flags that matter.',
    answer: [
      '`read` reads one line from stdin into variables. The two flags that should be on essentially every use: **`-r`** stops backslashes being interpreted as escapes, and **`IFS=`** before it stops leading and trailing whitespace being stripped. Without both, the input is silently modified.',
      'For **interactive prompts**, `-p` prints a prompt and `-s` suppresses echo, which is what you use for a password. A **timeout** with `-t` is worth adding to anything that might run unattended, so it fails rather than waiting forever.',
      'For **reading a file**, redirect it into the loop - `while IFS= read -r line; do ... done < file` - rather than piping, which puts the loop in a subshell and loses any variables set inside it.',
      'One detail that catches people: `read` returns non-zero at end of file, which is how the loop terminates - but it also means a **final line without a trailing newline is read into the variable and then the loop exits**, skipping it. `while IFS= read -r line || [ -n "$line" ]` handles that case.',
      'And for anything interactive in a script that might be automated, always provide a **non-interactive path** - a flag or an environment variable - because a prompt in an automated run hangs forever.',
    ],
    code: [
      {
        title: 'Reading files and prompting safely',
        language: 'bash',
        code: `# Reading a file - redirect, do not pipe
while IFS= read -r line; do
  process "$line"
done < input.txt

# Handle a final line with no trailing newline
while IFS= read -r line || [ -n "$line" ]; do
  process "$line"
done < input.txt

# Split fields on a delimiter
while IFS=, read -r name url timeout; do
  check "$name" "$url" "\${timeout:-5}"
done < services.csv

# Interactive, with a timeout and a non-interactive escape hatch
if [ -t 0 ] && [ "\${ASSUME_YES:-false}" != "true" ]; then
  read -r -t 30 -p "Deploy to production? [y/N] " answer || answer=n
  [[ "\${answer,,}" == "y" ]] || { echo "cancelled"; exit 0; }
fi

# A password, not echoed
read -r -s -p "Password: " password
echo`,
      },
    ],
    traps: [
      '`read` without `-r`, mangling backslashes.',
      'Missing `IFS=`, stripping whitespace from each line.',
      'Piping into the loop, so variables set inside it are lost.',
      'An unconditional prompt in a script that gets automated, hanging forever.',
    ],
    followUps: ['What do `-r` and `IFS=` each prevent?', 'Why check `[ -t 0 ]` before prompting?'],
    tags: ['read', 'input', 'prompts', 'files', 'fundamentals'],
  },
  {
    id: 'itv-shell-47',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you make a script\u2019s output useful to both humans and machines?',
    probing: 'Interface design for a script, which affects how widely it gets used.',
    answer: [
      'The principle is **structured data on stdout, diagnostics on stderr**. Then a human sees everything, and a pipeline gets only the data. That separation alone makes a script composable.',
      'Beyond that, the useful pattern is an **output format flag**: human-readable by default, with `--json` or `--format=tsv` for machine consumption. Detecting whether stdout is a terminal - `[ -t 1 ]` - lets the default adapt automatically, which is how most good CLI tools behave: colour and alignment when interactive, plain when piped.',
      '**Colour** should follow the same rule and respect `NO_COLOR`, because escape codes in a log file or a pipeline are noise.',
      '**Progress output goes to stderr**, not stdout, so it does not contaminate the data.',
      'And the **exit code** is part of the interface: zero for success, meaningful non-zero values for different failures, so a caller can branch without parsing text.',
    ],
    code: [
      {
        title: 'Adapting to the context',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

FORMAT="\${FORMAT:-auto}"

# auto: human when interactive, plain when piped
if [ "$FORMAT" = "auto" ]; then
  [ -t 1 ] && FORMAT=human || FORMAT=tsv
fi

# Colour only when it will be seen, and never if NO_COLOR is set
if [ -t 1 ] && [ -z "\${NO_COLOR:-}" ]; then
  RED=$'\\033[31m'; GREEN=$'\\033[32m'; RESET=$'\\033[0m'
else
  RED=''; GREEN=''; RESET=''
fi

log() { echo "$*" >&2; }             # diagnostics never on stdout

emit() {
  local name="$1" status="$2" code="$3"
  case "$FORMAT" in
    human) printf '%-24s %s%-10s%s %s\\n' "$name" \\
             "$([ "$status" = healthy ] && echo "$GREEN" || echo "$RED")" \\
             "$status" "$RESET" "$code" ;;
    tsv)   printf '%s\\t%s\\t%s\\n' "$name" "$status" "$code" ;;
    json)  jq -cn --arg n "$name" --arg s "$status" --arg c "$code" \\
             '{name:$n, status:$s, code:$c}' ;;
  esac
}

log "checking \${#services[@]} services"     # progress, on stderr
for s in "\${services[@]}"; do emit "$s" "$(check "$s")" "$code"; done`,
      },
    ],
    traps: [
      'Progress or log output on stdout, contaminating piped data.',
      'Colour escape codes written to a file or a pipe.',
      'Only a human-readable format, so the script cannot be composed.',
      'Ignoring `NO_COLOR`, which users set deliberately.',
    ],
    followUps: [
      'Why check `[ -t 1 ]` before colouring?',
      'What makes a script composable in a pipeline?',
    ],
    tags: ['output', 'json', 'cli design', 'composability', 'colour'],
  },
  {
    id: 'itv-shell-48',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these are real reasons to stop using shell and switch to another language? Select all that apply.',
    probing: 'Knowing the boundaries of the tool.',
    options: [
      {
        id: 'a',
        text: 'The script needs to parse and manipulate structured data - JSON, YAML, XML',
      },
      { id: 'b', text: 'It needs real data structures, error types, or non-trivial control flow' },
      { id: 'c', text: 'It has grown past a few hundred lines and several people maintain it' },
      { id: 'd', text: 'It calls external commands' },
      { id: 'e', text: 'It needs unit tests around its logic' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Calling external commands is what shell is **for**. That is the opposite of a reason to leave it - a script that mostly orchestrates other programs is exactly where shell is strongest and where Python would be more verbose for no benefit.',
      '**Structured data** is the clearest signal. Shell has no data structures beyond strings and arrays, and parsing JSON or YAML in shell means either `jq` for everything or fragile text manipulation. Once the data has real structure, another language is simpler.',
      '**Data structures, error types and control flow**: shell has no exceptions, no typed errors, no nested structures, and no real scoping. Expressing anything with branching logic and state becomes painful quickly.',
      '**Size and shared ownership**: a few hundred lines is roughly where shell stops being readable, and a script several people maintain needs the review, testing and structure that shell makes hard.',
      '**Testability**: shell is genuinely hard to unit test. `bats` exists and works, but testing pure functions in Python is a fraction of the effort.',
      'The rule I would state: **shell for orchestrating commands, another language once there is logic**. The transition point in practice is usually parsing structured data or writing the third function.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Is shell still the right tool?',
        caption:
          'Orchestrating commands is shell\u2019s strength; logic and structured data are not.',
        question: 'What is the script mostly doing?',
        branches: [
          {
            condition: 'Chaining commands, moving files, glue',
            result: 'Shell',
            detail: 'Shorter and clearer than the alternative',
            tone: 'success',
          },
          {
            condition: 'Parsing JSON or YAML throughout',
            result: 'Python',
            detail: 'Shell has no data structures',
            tone: 'accent',
          },
          {
            condition: 'Branching logic, error types, state',
            result: 'Python',
            tone: 'accent',
          },
          {
            condition: 'Several hundred lines, several maintainers',
            result: 'Python, incrementally',
            detail: 'Strangler extraction, not a rewrite',
            tone: 'warning',
          },
        ],
      },
    ],
    traps: [
      'Rewriting a working 30-line shell script for no reason.',
      'Persisting with shell to 1,500 lines because rewriting feels expensive.',
      'A big-bang rewrite rather than extracting pieces incrementally.',
    ],
    followUps: ['Where exactly would you draw the line?'],
    tags: ['tool selection', 'python', 'judgement', 'limits', 'advanced'],
  },
  {
    id: 'itv-shell-49',
    level: 'basic',
    kind: 'open',
    prompt: 'What are the most useful pipeline tools to know?',
    probing: 'Breadth of everyday command-line vocabulary.',
    answer: [
      'The ones that come up constantly: **`sort`** (with `-n` numeric, `-r` reverse, `-u` unique, `-k` by field), **`uniq`** (`-c` to count, and it only works on **adjacent** lines so it nearly always needs `sort` first), **`head`** and **`tail`** (`tail -f` to follow a log), **`wc -l`** to count, and **`tr`** for character translation and deletion.',
      '**`xargs`** turns input into arguments, with `-P` for parallelism and `-0` for null-separated safety. **`tee`** writes to a file and passes the data onward, which is how you keep a log of a pipeline without breaking it.',
      "**`column -t`** aligns output into readable columns, which costs nothing and makes a script's output much more usable. **`paste`** joins lines side by side, **`join`** merges two sorted files on a common field, and **`comm`** compares two sorted files showing what is unique to each and what is common.",
      '`comm` in particular is underused and excellent for comparing sets - which packages are on host A and not host B, for instance - and is far clearer than the equivalent with `grep -v -f`.',
    ],
    code: [
      {
        title: 'The everyday combinations',
        language: 'bash',
        code: `# The classic frequency count - note sort BEFORE uniq
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -20

# Aligned output
df -h | column -t

# Follow and filter a log live
tail -F /var/log/app.log | grep --line-buffered -i error

# Set comparison between two hosts
comm -13 <(ssh a 'rpm -qa|sort') <(ssh b 'rpm -qa|sort')   # only on b
comm -12 <(sort a.txt) <(sort b.txt)                       # in both

# Join two sorted files on a common field
join -t, -1 1 -2 1 <(sort hosts.csv) <(sort owners.csv)

# Keep a log without breaking the pipeline
./build.sh 2>&1 | tee build.log | grep -iE 'error|warning'`,
      },
    ],
    traps: [
      '`uniq` without sorting first - it only collapses adjacent duplicates.',
      '`grep` in a `tail -f` pipeline without `--line-buffered`, so output appears in blocks.',
      '`sort` without `-n` on numbers, giving lexicographic order where 10 comes before 9.',
      '`comm` or `join` on unsorted input, which silently gives wrong results.',
    ],
    followUps: ['Why must `sort` come before `uniq`?', 'What does `--line-buffered` fix?'],
    tags: ['pipelines', 'sort', 'uniq', 'comm', 'fundamentals'],
  },
  {
    id: 'itv-shell-50',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you write a script that generates a report from log files?',
    probing: 'A complete practical task tying several things together.',
    answer: [
      'The structure: **gather** the matching files, **extract and aggregate** in as few passes as possible, **format**, and **deliver**. Keeping those separate makes each testable and lets the format change without touching the parsing.',
      'For **gathering**, `find` with explicit criteria rather than a glob, so rotated and compressed files are handled deliberately. `zcat`/`zgrep` read compressed logs without decompressing to disk.',
      'For **aggregation**, one `awk` program doing the whole job in a single pass rather than a chain of five tools. On a large log that is the difference between seconds and minutes, and it is usually clearer too.',
      'For **formatting**, `column -t` for a readable table, or emit TSV or JSON when something else will consume it - and make that a flag rather than a choice baked in.',
      'And the operational details: **handle no matching data** gracefully rather than producing an empty or broken report, **include the period covered and a generation timestamp** so a stale report is obvious, and **fail loudly** if it cannot be produced - a report that silently does not arrive is worse than one that errors, because people assume no news is good news.',
    ],
    code: [
      {
        title: 'Gather, aggregate in one pass, format, deliver',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

readonly LOG_DIR="\${LOG_DIR:-/var/log/app}"
readonly DAYS="\${DAYS:-7}"
FORMAT="\${FORMAT:-human}"

log() { echo "[$(date -Is)] $*" >&2; }

# 1. Gather - explicit criteria, including rotated files
mapfile -t files < <(
  find "$LOG_DIR" -type f \\( -name 'access.log' -o -name 'access.log.*' \\) \\
       -mtime "-\${DAYS}" | sort
)
[ "\${#files[@]}" -gt 0 ] || { log "no log files found in the last \${DAYS} days"; exit 1; }
log "processing \${#files[@]} files"

# 2. Aggregate - one awk pass over everything, compressed or not
report=$(
  for f in "\${files[@]}"; do
    case "$f" in *.gz) zcat -- "$f" ;; *) cat -- "$f" ;; esac
  done |
  awk '
    { total++; bytes += $10 }
    $9 >= 500 { errors[$7]++; error_total++ }
    $9 ~ /^2/ { ok++ }
    END {
      printf "period_files\\t%d\\n", ARGC
      printf "requests\\t%d\\n", total
      printf "errors\\t%d\\n", error_total
      printf "error_rate\\t%.2f\\n", (total ? error_total/total*100 : 0)
      printf "gb_served\\t%.2f\\n", bytes/1073741824
      for (u in errors) printf "top_error\\t%s\\t%d\\n", u, errors[u]
    }'
)

# 3. Format
case "$FORMAT" in
  human)
    echo "Report generated $(date -Is), covering the last \${DAYS} days"
    echo
    grep -v '^top_error' <<< "$report" | column -t
    echo
    echo "Endpoints with the most 5xx:"
    grep '^top_error' <<< "$report" | cut -f2,3 | sort -k2 -rn | head -10 | column -t
    ;;
  tsv)  echo "$report" ;;
  json) jq -Rn '[inputs | split("\\t")] | map({key: .[0], value: .[1:]})' <<< "$report" ;;
esac`,
      },
    ],
    traps: [
      'Multiple passes over the same large files where one awk program would do.',
      'No handling for zero matching files, producing a broken or empty report.',
      'No timestamp or period in the report, so a stale one looks current.',
      'Failing silently, so nobody knows the report stopped arriving.',
    ],
    followUps: [
      'Why does one awk pass matter on large logs?',
      'Why include the period and a timestamp in the report itself?',
    ],
    tags: ['reporting', 'awk', 'logs', 'aggregation', 'practical'],
  },
]
