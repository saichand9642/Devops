import type { InterviewQuestion } from '../../../types'

/** Text processing, functions, loops and the tools a DevOps shell round covers. */
export const shellScriptingQuestions: InterviewQuestion[] = [
  {
    id: 'itv-shell-21',
    level: 'intermediate',
    kind: 'open',
    prompt: 'When would you use `awk`, `sed`, `grep` or `cut`?',
    probing: 'Text processing tool selection, which is most of practical shell.',
    answer: [
      '**`grep`** filters lines matching a pattern. It is the fastest of the four and should come first in a pipeline so everything downstream sees fewer lines. `-F` for fixed strings is faster still when you do not need a regex.',
      '**`cut`** extracts fields by delimiter or character position. It is simple and fast but rigid: it cannot handle repeated delimiters, which makes it awkward for whitespace-separated columns where the spacing varies.',
      '**`sed`** is a stream editor for substitution and line operations - `s/old/new/`, deleting lines, printing ranges. It works line by line with no memory of what came before.',
      '**`awk`** is a full programming language for line-oriented data. It splits each line into fields automatically, handles repeated whitespace correctly, maintains state between lines, and can aggregate - which is what makes it the right answer for most real log processing.',
      'The practical rule: **grep to filter, awk for anything involving fields or aggregation, sed for substitution**. And if you are chaining four of them together, one `awk` invocation usually does the whole thing more clearly and much faster.',
    ],
    code: [
      {
        title: 'Each tool doing what it is good at',
        language: 'bash',
        code: `# grep - filter, first in the pipeline
grep -F ' 500 ' access.log

# cut - simple fixed delimiter
cut -d: -f1,7 /etc/passwd

# sed - substitution
sed 's/DEBUG/debug/g' app.log
sed -n '100,200p' large.log           # print a line range
sed '/^#/d; /^$/d' config.conf        # strip comments and blank lines

# awk - fields, state, aggregation: all in one pass
awk '$9 >= 500 {errors[$7]++; total++}
     END {printf "%d errors across %d endpoints\\n", total, length(errors)
          for (u in errors) printf "%8d  %s\\n", errors[u], u}' access.log |
  sort -rn`,
      },
      {
        title: 'Four processes replaced by one',
        language: 'bash',
        code: `# Chained - four processes, four passes
grep ' 500 ' access.log | cut -d' ' -f7 | sort | uniq -c | sort -rn | head -10

# One awk - one process, one pass, and clearer
awk '$9 == 500 {c[$7]++} END {for (u in c) print c[u], u}' access.log |
  sort -rn | head -10`,
      },
    ],
    traps: [
      '`cut` on whitespace-separated columns with variable spacing - it does not collapse repeated delimiters.',
      'Expensive tools before cheap filters in a pipeline.',
      "`grep | awk` where awk's own pattern matching would do - though grep first is often still faster on large files.",
      'Chaining five tools where one awk program is clearer.',
    ],
    followUps: [
      'Why does `cut` struggle with whitespace-separated columns?',
      'When is `grep | awk` still worth it over awk alone?',
    ],
    tags: ['awk', 'sed', 'grep', 'text processing', 'pipelines'],
  },
  {
    id: 'itv-shell-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you write functions in shell, and what are the gotchas?',
    probing: 'Structuring a script beyond a linear sequence.',
    answer: [
      'A function is `name() { ... }`. Arguments come in as `$1`, `$2` and `"$@"` exactly as in a script - there are no named parameters. The return value is an **exit status**, not a value: `return 0` for success, non-zero for failure, and only 0-255 are valid.',
      'To get a **value** out, the function writes to stdout and the caller captures it with `$(...)`. That is why diagnostic output from a function must go to **stderr** - anything on stdout becomes part of the return value and corrupts it.',
      "The main gotcha is that **variables are global by default**. A function assigning to `count` overwrites the caller's `count` silently. `local` makes a variable function-scoped and should be used for every variable inside a function, without exception.",
      "The second is that `local x=$(command)` **masks the command's exit status** - `local` itself succeeds, so `set -e` does not catch a failure. Declaring and assigning on separate lines avoids it.",
      'And functions must be **defined before they are called**, since the shell reads top to bottom. The common structure is all functions first, then a `main` function, then a single call to `main "$@"` at the bottom.',
    ],
    code: [
      {
        title: 'The patterns, and the gotchas',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*" >&2; }      # diagnostics to STDERR

get_version() {
  local service="$1"                         # local, always
  local response

  # NOT: local response=$(curl ...)  - that masks curl's exit status
  response=$(curl -fsS --max-time 10 "https://api/\${service}/version") || return 1

  echo "$response" | jq -r '.version'        # the "return value", on stdout
}

deploy() {
  local service="$1" version="$2"
  log "deploying \${service} \${version}"     # stderr - does not corrupt output
  ./deploy.sh "$service" "$version"
}

main() {
  local version
  version=$(get_version "api") || {
    log "could not determine the current version"
    return 1
  }
  deploy "api" "$version"
}

main "$@"`,
      },
    ],
    traps: [
      "Variables not declared `local`, silently overwriting the caller's.",
      "`local x=$(cmd)` masking the command's exit status from `set -e`.",
      'Diagnostic `echo` inside a function whose output is captured, corrupting the value.',
      'Trying to `return` a string - only an exit status, 0-255.',
    ],
    followUps: [
      "Why must a function's logging go to stderr?",
      'What is wrong with `local x=$(command)`?',
    ],
    tags: ['functions', 'local', 'scope', 'stderr', 'structure'],
  },
  {
    id: 'itv-shell-23',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you loop over things in shell?',
    probing: 'Loop forms and the pitfalls in each.',
    answer: [
      '**`for x in list`** iterates a word list - a glob, an array, or the output of a command. **`for ((i=0; i<n; i++))`** is the C-style numeric form. **`while read`** reads a stream line by line, and **`until`** loops while a condition is false.',
      'The pitfalls are mostly about **what is being split**. Iterating over unquoted command output splits on whitespace, so filenames with spaces break. `for f in *.log` uses the glob directly and is safe. Arrays need `"${array[@]}"` with the quotes, or the elements are re-split.',
      'The one that catches everyone is **`while read` in a pipeline creating a subshell**. `cmd | while read x; do count=$((count+1)); done` increments `count` inside a subshell, so after the loop it is unchanged. Redirecting from a file or using process substitution keeps the loop in the current shell.',
      '`while IFS= read -r line` is the correct form for reading lines: `IFS=` stops leading and trailing whitespace being stripped, and `-r` stops backslashes being interpreted. Without both, the content is silently modified.',
    ],
    code: [
      {
        title: 'Safe loop forms',
        language: 'bash',
        code: `# Glob directly, with nullglob so no matches means no iterations
shopt -s nullglob
for f in /var/log/*.log; do
  gzip "$f"
done

# Array - the quotes matter
services=("api" "worker" "web tier")
for s in "\${services[@]}"; do
  echo "restarting $s"
done

# Numeric
for ((i = 1; i <= 5; i++)); do
  echo "attempt $i"
done

# Reading lines - IFS= and -r are both needed
while IFS= read -r line; do
  process "$line"
done < input.txt`,
      },
      {
        title: 'The subshell trap',
        language: 'bash',
        code: `count=0

# WRONG - the loop runs in a subshell; count is unchanged afterwards
grep ERROR app.log | while IFS= read -r line; do
  count=$((count + 1))
done
echo "$count"        # 0

# RIGHT - process substitution keeps the loop in the current shell
while IFS= read -r line; do
  count=$((count + 1))
done < <(grep ERROR app.log)
echo "$count"        # the actual count

# Or avoid the loop entirely
count=$(grep -c ERROR app.log)`,
      },
    ],
    traps: [
      '`while read` in a pipeline, so variables set inside it are lost.',
      '`read` without `-r`, which mangles backslashes.',
      'Missing `IFS=`, which strips leading and trailing whitespace from each line.',
      'Iterating unquoted command output containing filenames.',
    ],
    followUps: [
      'Why does a `while read` in a pipeline lose its variables?',
      'What do `IFS=` and `-r` each prevent?',
    ],
    tags: ['loops', 'subshells', 'read', 'arrays', 'fundamentals'],
  },
  {
    id: 'itv-shell-24',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is wrong with this backup script?',
    promptCode: [
      {
        title: 'A backup script',
        language: 'bash',
        code: `#!/bin/bash
BACKUP_DIR=/backups/$(date +%Y%m%d)
mkdir $BACKUP_DIR
tar czf $BACKUP_DIR/data.tar.gz /var/lib/app
rm -rf /backups/$(date -d '30 days ago' +%Y%m%d)
echo "Backup complete"`,
      },
    ],
    probing: 'Spotting several real problems in a plausible-looking script.',
    options: [
      {
        id: 'a',
        text: 'No `set -euo pipefail`, no quoting, no error checking, and it reports success regardless of whether anything worked',
      },
      { id: 'b', text: '`tar` should use `-j` instead of `-z`' },
      { id: 'c', text: 'The date format is wrong' },
      { id: 'd', text: 'Nothing is wrong with it' },
    ],
    correct: ['a'],
    answer: [
      'The most serious problem is that it **always reports success**. If `tar` fails - disk full, permission denied, the source missing - the script prints "Backup complete" and exits 0. Whatever runs it believes there is a backup. That is worse than no backup, because it removes the prompt to check.',
      '**No `set -euo pipefail`**, so every failure is ignored and the script continues. The `rm -rf` runs even if the backup failed.',
      '**No quoting**, so a path containing a space breaks everything - and the `rm -rf` with an unquoted variable is the dangerous case.',
      '**No verification** that the backup is usable. A tar file that exists is not evidence it can be restored; testing the archive is the minimum, and periodically restoring it is what actually proves it.',
      'And the `rm -rf` with a **computed path and no validation** is the line that could delete the wrong thing if the date command behaves unexpectedly.',
    ],
    code: [
      {
        title: 'The same script, written safely',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

readonly BACKUP_ROOT=/backups
readonly RETENTION_DAYS=30
readonly SOURCE=/var/lib/app

backup_dir="\${BACKUP_ROOT}/$(date +%Y%m%d)"
archive="\${backup_dir}/data.tar.gz"

log() { echo "[$(date -Is)] $*" >&2; }

cleanup() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    log "backup FAILED with status $rc"
    rm -rf "$backup_dir"          # do not leave a partial backup behind
  fi
  exit "$rc"
}
trap cleanup EXIT

[ -d "$SOURCE" ] || { log "source does not exist: $SOURCE"; exit 1; }

mkdir -p "$backup_dir"
log "backing up $SOURCE to $archive"
tar czf "$archive" -C "$(dirname "$SOURCE")" "$(basename "$SOURCE")"

# Verify the archive is readable - not proof of restorability, but a minimum
tar tzf "$archive" >/dev/null || { log "archive is corrupt"; exit 1; }
size=$(stat -c %s "$archive")
[ "$size" -gt 1024 ] || { log "archive is suspiciously small: $size bytes"; exit 1; }

# Prune old backups - find, not a computed rm -rf path
find "$BACKUP_ROOT" -maxdepth 1 -type d -name '20*' -mtime "+\${RETENTION_DAYS}" \\
  -exec rm -rf {} +

log "backup complete: $archive ($size bytes)"`,
      },
    ],
    traps: [
      'Reporting success unconditionally.',
      '`rm -rf` on an unquoted, computed path.',
      'No verification, so a corrupt backup looks identical to a good one.',
      'A partial backup left in place after a failure, which looks like a real one.',
    ],
    followUps: [
      'What would actually prove the backup is usable?',
      'Why is a partial backup worse than none?',
    ],
    tags: ['backup', 'safety', 'error handling', 'verification', 'code review'],
  },
  {
    id: 'itv-shell-25',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you work with JSON in shell?',
    probing: '`jq`, and knowing when shell is the wrong tool for it.',
    answer: [
      '**`jq`** is the tool. It parses JSON properly, filters and transforms with its own query language, and outputs either JSON or raw strings. Using `grep` and `sed` on JSON is fragile - it breaks on reordered keys, whitespace changes and nested structures - and is a reliable source of bugs.',
      'The flags that matter: **`-r`** outputs raw strings without quotes, which is what you want when assigning to a shell variable. **`-e`** sets a non-zero exit status when the result is null or false, so `jq -e` can be used in a condition. And **`--arg`** passes a shell variable in safely, rather than interpolating it into the filter where it could break the syntax.',
      'For **iterating** over JSON objects in shell, the safe pattern is to have `jq` emit one compact object per line and read them, or to emit tab-separated fields and read into variables. Trying to loop over a nested structure in shell quickly becomes unreadable.',
      'And the boundary: once you are writing a jq program of more than a few lines, or need real branching around the data, **Python is the better tool**. jq is excellent for extracting and reshaping; it is not a good place to put application logic.',
    ],
    code: [
      {
        title: 'jq for extraction and iteration',
        language: 'bash',
        code: `# -r for raw output when assigning to a variable
version=$(curl -fsS https://api/status | jq -r '.version')

# --arg passes a shell value in safely
jq --arg env "$ENVIRONMENT" '.services[] | select(.environment == $env) | .name' config.json

# -e for a condition: non-zero exit when null or false
if jq -e '.healthy' status.json >/dev/null; then
  echo "healthy"
fi

# Iterate - tab-separated fields read into variables
jq -r '.instances[] | [.id, .state, .type] | @tsv' instances.json |
  while IFS=$'\\t' read -r id state type; do
    echo "instance $id is $state ($type)"
  done

# Reshape and aggregate
jq -r '
  .items
  | group_by(.team)
  | map({team: .[0].team, cost: (map(.cost) | add)})
  | sort_by(-.cost)
  | .[] | "\\(.team)\\t\\(.cost)"
' costs.json`,
      },
    ],
    traps: [
      '`grep` or `sed` on JSON, which breaks on formatting changes.',
      'Forgetting `-r`, so values carry quotes into shell variables.',
      'Interpolating a shell variable into a jq filter instead of using `--arg`.',
      'A 40-line jq program where Python would be clearer.',
    ],
    followUps: [
      'Why is `--arg` better than interpolating into the filter?',
      'At what point would you switch to Python?',
    ],
    tags: ['jq', 'json', 'parsing', 'tool selection'],
  },
  {
    id: 'itv-shell-26',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you write a script that retries a flaky operation?',
    probing: 'Resilience in shell - the details that make a retry loop actually useful.',
    answer: [
      'The structure is a loop with a bounded attempt count, **exponential backoff** between attempts, and a clear failure when the attempts are exhausted.',
      '**Exponential backoff** matters because a fixed short interval hammers a service that is already struggling. Doubling the delay gives it room to recover. **Jitter** - a random component - matters when many clients retry simultaneously, because without it they all retry in lockstep and produce a synchronised load spike.',
      '**Retry only what is worth retrying.** A network timeout or a 503 is transient; a 401 or a 404 will never succeed and retrying wastes time and obscures the real error. Checking the specific failure before retrying is what separates a useful retry loop from one that just delays the inevitable.',
      '**A total timeout** as well as an attempt count is worth having, so a series of slow attempts cannot exceed a bound - otherwise five attempts with a 60-second timeout each can take five minutes.',
      'And **log each attempt** so the output shows it retried rather than just eventually failing, which makes intermittent problems visible rather than invisible.',
    ],
    code: [
      {
        title: 'A reusable retry function',
        language: 'bash',
        code: `retry() {
  local max_attempts="\${1:?max_attempts required}"; shift
  local base_delay="\${1:?base_delay required}"; shift
  local attempt=1 delay rc

  while true; do
    if "$@"; then
      [ "$attempt" -gt 1 ] && echo "succeeded on attempt $attempt" >&2
      return 0
    fi
    rc=$?

    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "failed after $attempt attempts (last status $rc): $*" >&2
      return "$rc"
    fi

    # Exponential backoff with jitter
    delay=$(( base_delay * (2 ** (attempt - 1)) ))
    delay=$(( delay + RANDOM % (delay > 1 ? delay / 2 : 1) ))
    echo "attempt $attempt failed (status $rc), retrying in \${delay}s" >&2
    sleep "$delay"
    attempt=$(( attempt + 1 ))
  done
}

retry 5 2 curl -fsS --max-time 30 "https://api.example.com/deploy"`,
      },
      {
        title: 'Retrying only what is worth retrying',
        language: 'bash',
        code: `fetch_with_retry() {
  local url="$1" attempt=1 max=5 code

  while [ "$attempt" -le "$max" ]; do
    code=$(curl -sS -o /tmp/resp -w '%{http_code}' --max-time 30 "$url") || code=000

    case "$code" in
      2??)         cat /tmp/resp; return 0 ;;
      408|429|5??) ;;                          # transient - fall through to retry
      000)         ;;                          # connection failure - retry
      *)           echo "permanent failure: HTTP $code" >&2; return 1 ;;
    esac

    echo "HTTP $code on attempt $attempt, retrying" >&2
    sleep $(( 2 ** attempt ))
    attempt=$(( attempt + 1 ))
  done

  echo "gave up after $max attempts" >&2
  return 1
}`,
      },
    ],
    traps: [
      'Retrying a 4xx that will never succeed.',
      'A fixed delay, producing synchronised retries across many clients.',
      'No overall timeout, so slow attempts multiply.',
      'Retries that hide a persistent problem, so nobody notices it is always retrying.',
    ],
    followUps: ['Why does jitter matter?', 'Which failures should not be retried?'],
    tags: ['retry', 'backoff', 'resilience', 'error handling', 'advanced'],
  },
  {
    id: 'itv-shell-27',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are traps, and what would you use them for?',
    probing: 'Signal handling in shell, which matters for cleanup and for containers.',
    answer: [
      '`trap COMMAND SIGNAL` runs a command when the shell receives a signal. The pseudo-signals matter as much as the real ones: **EXIT** fires whenever the shell exits for any reason, **ERR** fires when a command fails under `set -e`, and **DEBUG** fires before every command.',
      'The main use is **cleanup that must happen regardless of outcome**: removing a temporary directory, releasing a lock, restoring a host to a load balancer, deleting a partial output file. `trap cleanup EXIT` is the reliable way to do it, because it covers normal completion, an error, and an interrupt.',
      'The second use is **graceful shutdown**, which matters in containers: SIGTERM is sent on stop, and a script that handles it can finish the current item and exit cleanly rather than being killed mid-operation. Without a trap, the default action terminates immediately.',
      '`trap - SIGNAL` removes a trap, and trapping the empty string **ignores** the signal - which is occasionally what you want around a critical section that must not be interrupted, though it should be scoped narrowly.',
      'The detail worth knowing is that **a trap on EXIT sees the exit status in `$?`**, but only if it is read first - any command inside the handler overwrites it. Capturing it on the first line of the handler is the correct pattern.',
    ],
    code: [
      {
        title: 'Cleanup and graceful shutdown',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

workdir="$(mktemp -d)"
lockfile=/var/run/myjob.lock

cleanup() {
  local rc=$?                     # capture FIRST - anything below overwrites it
  rm -rf "$workdir"
  rm -f "$lockfile"
  if [ "$rc" -ne 0 ]; then
    echo "failed with status $rc" >&2
  fi
  exit "$rc"
}
trap cleanup EXIT

# Report where a failure happened
trap 'echo "error at line $LINENO: $BASH_COMMAND" >&2' ERR

# Graceful shutdown on SIGTERM - finish the current item, then stop
shutting_down=false
trap 'shutting_down=true; echo "SIGTERM received, finishing current item" >&2' TERM

for item in "\${items[@]}"; do
  "$shutting_down" && { echo "stopping cleanly" >&2; exit 0; }
  process "$item"
done`,
      },
    ],
    traps: [
      'Reading `$?` after other commands in the handler, so it reports the wrong status.',
      'A trap that itself fails, masking the original error.',
      'No trap on a script that creates temporary resources, leaking them on failure.',
      'Ignoring SIGTERM entirely in a container, so a stop kills the script mid-write.',
    ],
    followUps: [
      'Why capture `$?` on the first line of the handler?',
      'What happens in a container without a SIGTERM trap?',
    ],
    tags: ['trap', 'signals', 'cleanup', 'graceful shutdown'],
  },
  {
    id: 'itv-shell-28',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A deployment script sometimes leaves a service down. It works most of the time. How do you find and fix it?',
    probing: 'Debugging intermittency in shell, where the causes are fairly specific.',
    answer: [
      'Intermittent means **something is racing or is not being checked**, and in a deployment script there are a small number of likely candidates.',
      '**A missing readiness check.** The script restarts the service and moves on, or marks it healthy, before it is actually accepting connections. Most of the time startup is fast enough; occasionally it is not, and the script proceeds - or finishes - with the service still starting. This is by far the most common cause.',
      '**An unchecked failure.** Without `set -e`, or with `|| true` somewhere, a step fails and the script carries on to the next one. It works whenever that step happens to succeed.',
      '**A race on a shared resource.** Two deployments overlapping, or a config file being written while the service reads it. An unguarded script triggered twice by two merges in quick succession is a common version.',
      '**A partial write.** A config file written directly rather than atomically, so an interrupted or slow write leaves it truncated and the service fails to start on it.',
      'To find it: **`set -x` with timestamps in `PS4`** on a failing run shows exactly where it diverges from a good one, and the timing usually makes a race obvious. Comparing the trace of a successful run against a failed one is the fastest route.',
      'The fixes: an explicit **wait-for-ready loop with a timeout** rather than a `sleep`, `set -euo pipefail`, a **lock** so two runs cannot overlap, **atomic config writes**, and a **rollback on failure** so a bad deploy restores service rather than leaving it down.',
    ],
    code: [
      {
        title: 'Wait for ready, not for a fixed time',
        language: 'bash',
        code: `# The usual cause - hope, with a fixed sleep
systemctl restart app
sleep 5
echo "deployed"

# Actually wait, with a timeout and a real check
wait_for_ready() {
  local url="$1" timeout="\${2:-60}" elapsed=0
  until curl -fsS --max-time 2 "$url" >/dev/null 2>&1; do
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "service did not become ready within \${timeout}s" >&2
      return 1
    fi
    sleep 2
    elapsed=$(( elapsed + 2 ))
  done
  echo "ready after \${elapsed}s" >&2
}

systemctl restart app
wait_for_ready "http://localhost:8080/healthz" 60`,
      },
      {
        title: 'The full pattern: lock, atomic write, verify, roll back',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

exec 200>/var/run/deploy.lock
flock -n 200 || { echo "another deployment is running" >&2; exit 1; }

previous=$(readlink -f /opt/app/current)

rollback() {
  echo "rolling back to $previous" >&2
  ln -sfn "$previous" /opt/app/current
  systemctl restart app
  wait_for_ready "http://localhost:8080/healthz" 60 || true
  exit 1
}
trap rollback ERR

# Atomic config write - never a truncated file
render_config > /etc/app/config.yaml.tmp
mv /etc/app/config.yaml.tmp /etc/app/config.yaml

ln -sfn "/opt/app/releases/\${VERSION}" /opt/app/current
systemctl restart app
wait_for_ready "http://localhost:8080/healthz" 60
./smoke-test.sh

trap - ERR
echo "deployed \${VERSION}"`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why is it intermittent?',
        caption: 'A fixed sleep instead of a readiness check is the usual answer.',
        question: 'What varies between the good and bad runs?',
        branches: [
          {
            condition: 'A sleep, then assumed ready',
            result: 'Missing readiness check',
            detail: 'Works until startup is slower than the sleep',
            tone: 'danger',
          },
          {
            condition: 'A step can fail without stopping the script',
            result: 'Unchecked failure',
            detail: 'set -euo pipefail, and no blanket || true',
            tone: 'danger',
          },
          {
            condition: 'Two runs close together',
            result: 'Race on a shared resource',
            detail: 'Needs a lock',
            tone: 'warning',
          },
          {
            condition: 'Config written directly',
            result: 'Partial write',
            detail: 'Write to a temp file and mv',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      '`PS4` with a timestamp turns a trace into a timeline, which makes a race visible immediately.',
      '`flock` on a file descriptor is released by the kernel if the process dies, unlike a lock file you create and delete.',
      'A rollback in a `trap ERR` means a failed deploy restores service automatically rather than leaving it down while someone investigates.',
    ],
    traps: [
      '`sleep` as a substitute for a readiness check.',
      'No lock, so two deployments interleave.',
      'Config written directly, so an interrupted write breaks startup.',
      'No rollback, so a failure leaves the service down.',
    ],
    followUps: [
      'Why is a fixed `sleep` the wrong way to wait?',
      'How would you compare a good run against a failing one?',
    ],
    tags: ['scenario', 'deployment', 'race conditions', 'debugging', 'advanced'],
  },
  {
    id: 'itv-shell-29',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you find files and act on them?',
    probing: '`find` fluency, which is one of the highest-value shell skills.',
    answer: [
      '`find` walks a directory tree and applies tests, then optionally an action. The tests worth knowing: `-name` and `-iname` for filename patterns, `-type f`/`d`/`l`, `-mtime` and `-mmin` for modification age, `-size`, `-user`, `-perm`, and `-maxdepth` to limit how deep it goes.',
      'For **acting on the results**, `-exec command {} \\;` runs the command once per file, and **`-exec command {} +`** batches as many as fit into one invocation - which is dramatically faster on thousands of files because it spawns one process rather than thousands.',
      '`-delete` is built in and avoids spawning `rm` at all, but note that it acts immediately - unlike `-exec rm`, there is no dry-run equivalent, so run the `find` without it first to see what would go.',
      'For piping to another command, **`-print0` with `xargs -0`** is the safe form, because the null separator is the one character that cannot appear in a filename. Plain `find | xargs` breaks on spaces.',
      'And `-prune` excludes directories from the walk entirely, which matters for performance - skipping `.git` or `node_modules` can make a search on a large tree an order of magnitude faster.',
    ],
    code: [
      {
        title: 'The forms worth knowing',
        language: 'bash',
        code: `# Old log files, deleted efficiently
find /var/log -type f -name '*.log' -mtime +30 -delete

# One process for many files, rather than one per file
find /var/log -name '*.log' -mtime +7 -exec gzip {} +

# Safe piping - null separated
find /data -type f -name '*.tmp' -print0 | xargs -0 rm -f

# Exclude directories from the walk - much faster on a large tree
find . -path ./node_modules -prune -o -path ./.git -prune -o \\
     -type f -name '*.ts' -print

# Large files, biggest first
find / -xdev -type f -size +500M -printf '%10s  %p\\n' 2>/dev/null | sort -rn | head -20

# Recently modified - useful during an incident
find /etc -type f -mmin -60 -ls

# Wrong permissions
find /home -type f -perm -o+w -ls`,
      },
    ],
    traps: [
      '`find | xargs` without `-print0`/`-0`, which breaks on filenames with spaces.',
      '`-exec {} \\;` on thousands of files, spawning a process for each.',
      '`-delete` run before checking what it would match.',
      'Forgetting `-xdev`, so a search crosses into network mounts and takes forever.',
    ],
    followUps: [
      'What is the difference between `-exec {} \\;` and `-exec {} +`?',
      'Why is `-print0` safer?',
    ],
    tags: ['find', 'xargs', 'files', 'performance', 'fundamentals'],
  },
  {
    id: 'itv-shell-30',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does `command1 && command2 || command3` do?',
    probing: 'Short-circuit operators, and a trap in this specific idiom.',
    options: [
      {
        id: 'a',
        text: 'Runs command2 if command1 succeeds; runs command3 if either command1 or command2 fails',
      },
      { id: 'b', text: 'Runs command2 if command1 succeeds, otherwise runs command3' },
      { id: 'c', text: 'Runs all three in sequence' },
      { id: 'd', text: 'Runs command1, then command2 and command3 in parallel' },
    ],
    correct: ['a'],
    answer: [
      'The operators are evaluated left to right with no precedence between them. `&&` runs the next command only if the previous **succeeded**; `||` runs it only if the previous **failed**.',
      'So `a && b || c` runs `b` when `a` succeeds - and then runs `c` if **`b`** fails. It is not an if/else: if `b` can fail, `c` runs even though `a` succeeded, which is usually not what the author intended.',
      'That makes the idiom safe only when `b` cannot fail - an `echo`, typically. For anything else, a real `if` statement says what you mean and is not ambiguous to the next reader.',
      'The related and very common use is `command || { echo "failed" >&2; exit 1; }`, which is a clear and idiomatic way to handle a failure inline.',
    ],
    code: [
      {
        title: 'The trap, and the clearer form',
        language: 'bash',
        code: `# Looks like if/else, is not
deploy && notify_success || notify_failure
# If deploy succeeds but notify_success fails, notify_failure also runs

# Say what you mean
if deploy; then
  notify_success
else
  notify_failure
fi

# Safe use - the middle command cannot fail
[ -f "$config" ] && echo "found" || echo "missing"

# The idiomatic inline failure handler
command -v jq >/dev/null || { echo "jq is required" >&2; exit 3; }
mkdir -p "$dir" || { echo "could not create $dir" >&2; exit 1; }`,
      },
    ],
    traps: [
      'Using `&& ||` as if/else when the middle command can fail.',
      '`|| true` added to silence `set -e`, which hides genuine failures.',
      'Assuming `&&` and `||` have different precedence. They do not.',
    ],
    followUps: ['When is `a && b || c` actually safe?'],
    tags: ['operators', 'control flow', 'short circuit', 'fundamentals'],
  },
  {
    id: 'itv-shell-31',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you run things in parallel in shell?',
    probing: 'Parallelism, which shell handles reasonably well for the right shape of work.',
    answer: [
      'The simplest form is **background jobs** with `&` and `wait`. Start several commands in the background, then `wait` for all of them. `wait -n` waits for the next one to finish, which is how you implement a bounded pool by hand.',
      '**`xargs -P N`** is usually the better answer for a list of items: it runs up to N processes at once, handles the queueing, and combines naturally with `find -print0`. It is in coreutils, so it is available everywhere.',
      '**GNU `parallel`** does more - it can preserve output ordering, handle failures per job, distribute across machines, and gives better progress reporting - at the cost of being an extra dependency.',
      'The things to get right: **bound the concurrency**, because unbounded parallelism against an API or a disk is a denial of service rather than a speedup. **Capture exit statuses**, because a background job that fails is silent unless you check - `wait "$pid"` returns its status. And **be careful with shared output**: several processes writing to the same file or to stdout interleave, so write to per-job files and combine afterwards.',
      'And remember this only helps for **I/O-bound** or independent-process work. Shell has no shared memory, so anything needing coordination between the parallel parts is better in another language.',
    ],
    code: [
      {
        title: 'Background jobs with status checking',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -uo pipefail                  # not -e: we check statuses ourselves

declare -A pids
for host in "\${hosts[@]}"; do
  ( ssh "$host" 'systemctl restart app' ) &
  pids["$host"]=$!
done

failed=0
for host in "\${!pids[@]}"; do
  if wait "\${pids[$host]}"; then
    echo "ok   $host"
  else
    echo "FAIL $host" >&2
    failed=$(( failed + 1 ))
  fi
done

[ "$failed" -eq 0 ] || { echo "$failed hosts failed" >&2; exit 1; }`,
      },
      {
        title: 'Bounded parallelism with xargs and parallel',
        language: 'bash',
        code: `# xargs - available everywhere, 8 at a time
find /var/log -name '*.log' -mtime +7 -print0 |
  xargs -0 -P 8 -I {} gzip {}

# A bounded pool by hand, with wait -n
max=10
for host in "\${hosts[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge "$max" ]; do wait -n; done
  check_host "$host" &
done
wait

# GNU parallel - per-job output files, and a failure summary
parallel --jobs 10 --halt soon,fail=1 --results ./out \\
  'ssh {} "uptime"' ::: "\${hosts[@]}"`,
      },
    ],
    traps: [
      'Unbounded parallelism, overwhelming the target or the local machine.',
      'Not checking exit statuses, so failures are silent.',
      'Several jobs appending to the same file, producing interleaved output.',
      '`set -e` with background jobs, which does not behave as expected.',
    ],
    followUps: [
      'How do you get the exit status of a background job?',
      'Why does output interleave, and how do you avoid it?',
    ],
    tags: ['parallelism', 'xargs', 'background jobs', 'performance', 'advanced'],
  },
  {
    id: 'itv-shell-32',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle secrets in a shell script?',
    probing: 'Security practice specific to shell, where the leaks are easy.',
    answer: [
      'Shell makes leaking secrets unusually easy, and the rules are mostly about avoiding specific mechanisms.',
      '**Never pass a secret as a command-line argument.** Arguments are visible in `ps` to every user on the machine, and in `/proc/<pid>/cmdline`. `curl -H "Authorization: Bearer $TOKEN"` exposes the token for the life of the process. Pass it through the **environment**, through **stdin**, or through a **file with restricted permissions**.',
      '**Be careful with `set -x`.** It prints every command with variables expanded, so a trace around a credential prints it. Disable tracing for that section, or never put the secret in a command line at all - which also solves this.',
      '**Environment variables** are the usual mechanism and are reasonable, with the caveat that they are inherited by child processes and readable from `/proc/<pid>/environ` by the same user.',
      '**Never in the script itself**, and never in a repository. Fetch at runtime from a secret manager where one exists, which also gives you rotation and audit.',
      'And `history` - an interactive command containing a secret is written to the shell history file. `HISTCONTROL=ignorespace` with a leading space avoids it for one-off commands.',
    ],
    code: [
      {
        title: 'The leaks, and how to avoid them',
        language: 'bash',
        code: `TOKEN=$(get_secret prod/api)

# LEAKS - visible in ps to every user on the machine
curl -H "Authorization: Bearer $TOKEN" https://api.example.com

# SAFE - the header comes from a file, not the command line
printf 'Authorization: Bearer %s\\n' "$TOKEN" > "$hdr"
curl -H "@$hdr" https://api.example.com
rm -f "$hdr"

# SAFE - via stdin
echo "$TOKEN" | docker login -u "$USER" --password-stdin registry.example.com

# SAFE - via the child's environment
TOKEN="$TOKEN" ./deploy.sh

# Tracing: disable around the sensitive part
set +x
authenticate "$TOKEN"
set -x`,
      },
      {
        title: 'Temporary files, safely',
        language: 'bash',
        code: `# mktemp creates it with 0600 and an unpredictable name
secret_file="$(mktemp)"
trap 'rm -f "$secret_file"' EXIT       # removed even on failure

umask 077                               # anything created is owner-only
get_secret prod/db > "$secret_file"
./app --config-from "$secret_file"`,
      },
    ],
    traps: [
      'Secrets as command-line arguments.',
      '`set -x` active around a credential.',
      'A temporary file with a predictable name in `/tmp`, which is a real attack.',
      'Secrets in the script, or in a `.env` committed to the repository.',
    ],
    followUps: [
      'Why is a command-line argument worse than an environment variable?',
      'What does `umask 077` protect against?',
    ],
    tags: ['secrets', 'security', 'process list', 'mktemp'],
  },
  {
    id: 'itv-shell-33',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the difference between a login shell, an interactive shell and a script?',
    probing: 'Which startup files run when - the cause of a very common class of confusion.',
    answer: [
      'A **login shell** starts when you log in - SSH, a console login, `su -`. It reads `/etc/profile` and then the first of `~/.bash_profile`, `~/.bash_login` or `~/.profile` that exists.',
      'An **interactive non-login shell** is a new terminal in an existing session. It reads `~/.bashrc` (and `/etc/bash.bashrc` on some systems), not the profile files.',
      'A **script** is non-interactive and reads **neither** - no `.bashrc`, no `.profile`. This is why a script run by cron or CI does not have the PATH, aliases or environment variables you have interactively, and it is the most common cause of "works in my terminal, fails in automation".',
      'The convention that makes this manageable is to put **environment variables and PATH in `~/.profile`** (read at login, inherited by everything started from that session), and **interactive-only things - aliases, prompt, completion - in `~/.bashrc`**. Many systems source `.bashrc` from `.profile`, which blurs it, but the principle holds.',
      'And the practical consequence for scripts: **never rely on the interactive environment**. Set PATH explicitly, use absolute paths for anything unusual, and read configuration from a file the script sources deliberately rather than from whatever happened to be exported.',
    ],
    code: [
      {
        title: 'Which is which, and what a script actually sees',
        language: 'bash',
        code: `# Which kind of shell am I in?
shopt -q login_shell && echo "login" || echo "not login"
[[ $- == *i* ]] && echo "interactive" || echo "not interactive"

# What a cron job actually sees - almost nothing
# * * * * * env > /tmp/cron-env.txt
diff <(env | sort) <(sort /tmp/cron-env.txt)

# Reproduce it deliberately
env -i HOME="$HOME" PATH=/usr/bin:/bin bash ./script.sh

# In the script: do not depend on the interactive environment
export PATH="/usr/local/bin:/usr/bin:/bin"
[ -r /etc/myapp/env ] && . /etc/myapp/env     # explicit, not inherited`,
      },
    ],
    traps: [
      'Expecting a cron job or a CI step to have your interactive PATH.',
      'Aliases in a script - they are not expanded in non-interactive shells by default.',
      'Environment variables set in `.bashrc` and expected in a login shell that does not read it.',
      '`source ~/.bashrc` in a script to get the environment, which drags in interactive settings.',
    ],
    followUps: ['Why does a cron job not see your PATH?', 'Where should PATH be set, and why?'],
    tags: ['shells', 'bashrc', 'profile', 'environment', 'fundamentals'],
  },
  {
    id: 'itv-shell-34',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these belong in a shell script that runs in production automation? Select all that apply.',
    probing: 'Production readiness for shell specifically.',
    options: [
      { id: 'a', text: '`set -euo pipefail` and every variable quoted' },
      { id: 'b', text: 'A `trap` for cleanup that runs on success, failure and interrupt' },
      { id: 'c', text: 'Explicit timeouts on network calls and a lock against concurrent runs' },
      { id: 'd', text: '`|| true` on commands that sometimes fail, so the script never stops' },
      { id: 'e', text: 'shellcheck in CI, and a `--dry-run` mode' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Blanket `|| true` is the wrong one. It suppresses failures indiscriminately, which is exactly the behaviour `set -e` exists to prevent. If a specific command is genuinely allowed to fail, handle that case explicitly and say why - a comment and a checked exit status, not a blanket suppression.',
      '**`set -euo pipefail` with quoting** is the baseline, and between them they prevent most of the ways a shell script does something destructive.',
      '**A `trap` for cleanup** is the only reliable way to release locks and remove temporary files regardless of how the script ends.',
      '**Timeouts and a lock**: `curl --max-time` and `timeout` stop a hung call blocking forever, and `flock` stops two runs interleaving - both are common causes of production incidents.',
      '**shellcheck in CI** catches a genuinely large proportion of shell bugs statically, and **`--dry-run`** lets a change be checked before it is made.',
      'I would add: logging with timestamps to stderr, meaningful exit codes, and validating arguments and dependencies at the start rather than failing partway through.',
    ],
    code: [
      {
        title: 'The skeleton',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail
IFS=$'\\n\\t'

readonly LOCKFILE=/var/run/deploy.lock
DRY_RUN="\${DRY_RUN:-false}"

log() { echo "[$(date -Is)] $*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# Dependencies, checked up front
for cmd in curl jq flock; do
  command -v "$cmd" >/dev/null || die "required command not found: $cmd"
done

# No concurrent runs
exec 200>"$LOCKFILE"
flock -n 200 || die "another run is in progress"

workdir="$(mktemp -d)"
cleanup() {
  local rc=$?
  rm -rf "$workdir"
  [ "$rc" -ne 0 ] && log "failed with status $rc"
  exit "$rc"
}
trap cleanup EXIT

if [ "$DRY_RUN" = "true" ]; then
  log "dry run - no changes will be made"
fi

curl -fsS --max-time 30 "https://api.example.com/x" -o "$workdir/resp.json" \\
  || die "API unreachable"`,
      },
    ],
    traps: [
      '`|| true` used broadly to make `set -e` stop complaining.',
      'No lock, so two scheduled runs overlap.',
      'No timeout, so a hung call blocks a runner indefinitely.',
      'Dependencies discovered missing halfway through.',
    ],
    followUps: ['How do you allow one specific command to fail, properly?'],
    tags: ['production', 'best practices', 'shellcheck', 'locking', 'advanced'],
  },
  {
    id: 'itv-shell-35',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you write a script to check the health of several services?',
    probing: 'A complete practical task bringing several things together.',
    answer: [
      'The shape: read the list of targets, check each in parallel with a timeout, collect the results, and report in a form something else can consume.',
      'The details that matter. **A timeout on every check**, or one hung endpoint blocks the whole run. **Parallelism**, bounded, because checking fifty endpoints sequentially at two seconds each is slow enough that people stop running it. **Per-check output captured separately**, because parallel jobs writing to stdout interleave.',
      '**Distinguish the failure modes** rather than reporting a single "unhealthy": a connection refused, a timeout, and a 500 mean different things, and the exit status or the response code should be reported rather than collapsed.',
      '**A meaningful exit code** so the script can be used as a check: zero when everything is healthy, non-zero otherwise, and the count of failures is useful as the status where it fits in 0-255.',
      'And **machine-readable output** as an option - JSON or a simple field-separated format - so the same script serves both a human running it interactively and a monitoring system consuming it.',
    ],
    code: [
      {
        title: 'Parallel health checks with distinguishable failures',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -uo pipefail

readonly TIMEOUT="\${TIMEOUT:-5}"
readonly PARALLEL="\${PARALLEL:-10}"
readonly FORMAT="\${FORMAT:-text}"      # text | json

check_one() {
  local name="$1" url="$2" code body_time status

  # Separate the outcomes rather than collapsing them into "failed"
  if ! read -r code body_time < <(
        curl -sS -o /dev/null -w '%{http_code} %{time_total}' \\
             --max-time "$TIMEOUT" "$url" 2>/dev/null
      ); then
    status="unreachable"; code="000"; body_time="0"
  elif [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    status="healthy"
  else
    status="unhealthy"
  fi

  printf '%s\\t%s\\t%s\\t%s\\n' "$name" "$status" "$code" "$body_time"
}
export -f check_one
export TIMEOUT

results="$(mktemp)"
trap 'rm -f "$results"' EXIT

# Bounded parallelism; each job writes one complete line
awk -F, 'NF==2 {print $1, $2}' services.csv |
  xargs -P "$PARALLEL" -n 2 bash -c 'check_one "$0" "$1"' > "$results"

if [ "$FORMAT" = "json" ]; then
  jq -Rn '[inputs | split("\\t") |
           {name: .[0], status: .[1], code: .[2], seconds: (.[3]|tonumber)}]' \\
    < "$results"
else
  printf '%-24s %-12s %6s %8s\\n' NAME STATUS CODE SECONDS
  sort "$results" | while IFS=$'\\t' read -r n s c t; do
    printf '%-24s %-12s %6s %8.3f\\n' "$n" "$s" "$c" "$t"
  done
fi

failures=$(grep -cv 'healthy' "$results" || true)
[ "$failures" -eq 0 ] || { echo "$failures unhealthy" >&2; exit 1; }`,
      },
    ],
    traps: [
      'No timeout, so one hung endpoint blocks the whole check.',
      'Parallel jobs writing partial lines to stdout, interleaving.',
      'Collapsing unreachable, timeout and 500 into one "failed" state.',
      'Exiting 0 regardless, so the script cannot be used as a check.',
    ],
    followUps: [
      'Why distinguish unreachable from a 500?',
      'How do you stop parallel output interleaving?',
    ],
    tags: ['health checks', 'parallelism', 'curl', 'monitoring', 'practical'],
  },
]
