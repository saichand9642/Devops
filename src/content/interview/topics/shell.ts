import type { InterviewTopic } from '../../types'

export const shellTopic: InterviewTopic = {
  id: 'shell',
  title: 'Shell scripting',
  shortTitle: 'Shell',
  icon: '🐚',
  order: 11,
  oneLiner:
    'Bash that does not break in production: strict mode, quoting, exit codes, traps and text processing.',
  headlines: [
    '`set -euo pipefail` at the top of every script. It turns silent failures into loud ones.',
    '**Always quote your variables.** `"$var"`, not `$var`. Unquoted expansion is the source of most shell bugs.',
    '`$?` is the exit status of the last command. 0 is success; anything else is failure.',
    '`trap ... EXIT` is how you guarantee cleanup, including on error.',
    '`[[ ]]` is the bash test - safer than `[ ]` because it does not word-split.',
    'When a script grows past about 100 lines of logic, it probably wants to be Python.',
  ],
  questions: [
    {
      id: 'itv-sh-1',
      level: 'basic',
      kind: 'open',
      prompt: 'What does `set -euo pipefail` do, and why should every script start with it?',
      probing:
        'The single most valuable line in shell scripting. Its absence is why scripts fail silently.',
      answer: [
        'Bash defaults are dangerously forgiving, and these four settings fix the worst of it.',
        '`set -e` exits immediately if any command returns non-zero. Without it, a failed command prints an error and the script **carries on to the next line** - which is how a deploy script "succeeds" having done nothing.',
        '`set -u` treats an undefined variable as an error. Without it, `rm -rf "$PREFIX/data"` with `PREFIX` unset becomes `rm -rf /data`. This one has caused real incidents.',
        '`set -o pipefail` makes a pipeline return the exit code of the **first failing** command. By default a pipeline returns only the **last** command’s status, so `curl bad-url | grep foo` reports success because `grep` ran fine.',
        'The `-o` applies only to `pipefail`; `-eu` are short flags. Together they turn a script that fails quietly into one that stops at the first problem.',
      ],
      code: [
        {
          title: 'What each one prevents',
          language: 'bash',
          code: `#!/usr/bin/env bash
set -euo pipefail

# -e   without it:
cd /nonexistent          # prints an error, script CONTINUES
rm -rf ./*               # ...and now deletes the wrong directory

# -u   without it:
PREFIX=""                # or simply never set
rm -rf "$PREFIX/data"    # becomes  rm -rf /data

# pipefail  without it:
curl -sf https://bad-url | grep "ok"
echo "$?"                # 1 from grep - but curl's failure is invisible
                         # If grep HAD matched, this would be 0 despite
                         # curl having failed.

# The escape hatch: when a non-zero exit is expected and fine
set +e
grep -q "pattern" file.txt
found=$?
set -e

# Or, more idiomatically, handle it inline:
if grep -q "pattern" file.txt; then
  echo "found"
fi

# For a command whose failure you genuinely do not care about:
optional_command || true`,
        },
      ],
      deeper: [
        '`set -e` has genuine gotchas worth knowing. It does **not** trigger inside a condition - `if failing_command; then` is fine, which is the point. And it does not trigger for a command in a `&&` or `||` chain except the last one. Those exceptions are why `|| true` works.',
        '`set -x` is the debugging companion: it prints each command before executing it, with variables expanded. Invaluable when a script does something unexpected.',
      ],
      traps: [
        'Omitting it and assuming a script that printed no error succeeded.',
        'Assuming `set -e` catches everything. It has documented exceptions, and a command inside `$( )` in an assignment is a common blind spot.',
      ],
      followUps: [
        'When does `set -e` NOT trigger?',
        'How do you allow one command to fail without ending the script?',
        'What does `set -x` do?',
      ],
      tags: ['bash', 'strict mode', 'reliability'],
    },
    {
      id: 'itv-sh-2',
      level: 'basic',
      kind: 'mcq',
      prompt: 'A file is named `my report.txt`. Which command deletes it correctly?',
      options: [
        { id: 'a', text: 'rm $file' },
        { id: 'b', text: 'rm "$file"' },
        { id: 'c', text: "rm '$file'" },
        { id: 'd', text: 'rm ${file}' },
      ],
      correct: ['b'],
      probing:
        'Quoting. It is the most common shell bug and it fails only on the inputs you did not test with.',
      answer: [
        'Only `rm "$file"` is correct. Double quotes prevent **word splitting** while still allowing the variable to expand.',
        'Option A, unquoted, splits on whitespace: the shell sees `rm my report.txt` - two arguments - and tries to delete two files that do not exist. It also performs glob expansion, so a filename containing `*` would expand unpredictably.',
        'Option C uses single quotes, which suppress expansion entirely: it tries to delete a file literally named `$file`.',
        'Option D, `${file}` without quotes, is identical to A. The braces only delimit the variable name - they do nothing about splitting. `"${file}"` would be correct.',
        'The rule is simple and absolute: **always double-quote variable expansions** unless you specifically want splitting, which is rare. `shellcheck` will flag every violation.',
      ],
      code: [
        {
          title: 'Where unquoted expansion bites',
          language: 'bash',
          code: `file="my report.txt"

rm $file          # rm "my" "report.txt"  - wrong, and may delete the wrong thing
rm "$file"        # rm "my report.txt"    - correct

# Arrays need the "\${arr[@]}" form, quoted
files=("first file.txt" "second file.txt")
for f in "\${files[@]}"; do   # correct: two iterations
  echo "$f"
done
for f in \${files[@]}; do     # wrong: four iterations
  echo "$f"
done

# Command substitution needs quoting too
count="$(wc -l < "$file")"

# Test conditions
[[ -f "$file" ]] && echo "exists"

# The rare legitimate case for NOT quoting: you WANT splitting
flags="-v -x"
command $flags              # intentional - though an array is better:
flags=(-v -x)
command "\${flags[@]}"

# Catch all of this automatically
#   shellcheck script.sh`,
        },
      ],
      traps: [
        'Believing `${var}` is safer than `$var`. The braces delimit the name; only quotes prevent splitting.',
        'Testing only with filenames that have no spaces, so the bug ships.',
      ],
      followUps: [
        'What is the difference between "$@" and "$*"?',
        'When would you deliberately leave a variable unquoted?',
        'What does shellcheck catch?',
      ],
      tags: ['bash', 'quoting', 'gotchas'],
    },
    {
      id: 'itv-sh-3',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do you ensure a script cleans up temporary files even if it fails?',
      probing:
        'The `trap` idiom. Leaked temp files and stale lock files are a real operational annoyance.',
      answer: [
        '`trap` registers a command to run when the shell receives a signal or exits. `trap cleanup EXIT` runs `cleanup` on **every** exit path - normal completion, an error under `set -e`, or an explicit `exit`.',
        'That is the key point: `EXIT` covers the error path too, so cleanup is guaranteed without wrapping everything in conditionals.',
        'I would also trap `INT` and `TERM` so that Ctrl-C or a `kill` from a scheduler also cleans up, since those terminate before the normal exit path.',
        'For the temporary directory itself, `mktemp -d` creates one with a random name and safe permissions. Building a path yourself from `$$` or a fixed name is both predictable - a symlink attack vector - and prone to collisions.',
        'The same pattern handles lock files, which is how you stop two instances of a cron job overlapping.',
      ],
      code: [
        {
          title: 'The cleanup idiom',
          language: 'bash',
          code: `#!/usr/bin/env bash
set -euo pipefail

# Safe, random, correct permissions. Never build this path by hand.
workdir="$(mktemp -d)"

cleanup() {
  local code=$?
  rm -rf "$workdir"
  if (( code != 0 )); then
    echo "Failed with exit code $code" >&2
  fi
  exit "$code"
}

# EXIT covers success AND failure. INT and TERM cover interruption.
trap cleanup EXIT INT TERM

# From here on, any failure still cleans up.
curl -sfL https://example.com/release.tgz -o "$workdir/release.tgz"
tar xzf "$workdir/release.tgz" -C "$workdir"
./deploy.sh "$workdir/release"`,
        },
        {
          title: 'A lock file, so two cron runs cannot overlap',
          language: 'bash',
          code: `#!/usr/bin/env bash
set -euo pipefail

LOCK="/var/lock/myjob.lock"

# flock is the robust way - the lock is released automatically if the
# process dies, which a plain "does the file exist" check cannot do.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Another run is in progress; exiting." >&2
  exit 0
fi

# The lock is held until this script exits, however it exits.
long_running_job

# Or wrap it entirely from cron:
#   * * * * * flock -n /var/lock/myjob.lock /usr/local/bin/myjob.sh`,
        },
      ],
      deeper: [
        'A subtlety: capture `$?` as the **first** line of the cleanup function. Any command inside it resets `$?`, so reading it later gives you the exit status of the cleanup, not of the script.',
        '`flock` is strongly preferable to a "check if the lock file exists" approach, because a kernel-held lock is released automatically when the process dies. A hand-rolled lock file left behind by a crashed job blocks every subsequent run until someone notices.',
      ],
      traps: [
        'Cleaning up only at the end of the happy path, so a failure leaves temp files behind forever.',
        'Trapping only `EXIT` and being surprised Ctrl-C leaves a mess - though `EXIT` does usually fire, adding `INT TERM` is explicit and clearer.',
        'Reading `$?` after running a command inside the trap handler.',
      ],
      followUps: [
        'Why capture $? first in the handler?',
        'Why is flock better than checking for a lock file?',
        'Which signals cannot be trapped?',
      ],
      tags: ['bash', 'trap', 'cleanup', 'locking'],
    },
    {
      id: 'itv-sh-4',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain the common text-processing tools and when you would use each.',
      probing:
        'Daily working knowledge. They want to see you pick the simplest tool that does the job.',
      answer: [
        '**grep** filters lines matching a pattern. `-v` inverts, `-i` ignores case, `-r` recurses, `-c` counts, `-o` prints only the match, `-E` enables extended regex.',
        "**awk** is a small programming language for column-oriented text. It splits each line into fields, so `awk '{print $3}'` prints the third column. It is the right tool whenever the data has columns, and it can aggregate: sums, counts and grouping in one pass.",
        "**sed** is a stream editor for substitution: `sed 's/old/new/g'`. Use it for search-and-replace and for deleting or printing line ranges.",
        '**cut** extracts fields by delimiter - simpler and faster than awk when you only need a column and the delimiter is consistent. **sort** and **uniq** go together: `sort | uniq -c | sort -rn` is the canonical "count and rank" idiom.',
        '**jq** is for JSON, and it is the one worth learning properly now that most tooling outputs JSON. Parsing JSON with grep and sed is fragile and a well-known anti-pattern.',
        'My rule is to reach for the simplest thing that works - `cut` before `awk`, `awk` before a Python script - and to switch to Python once the pipeline stops being readable.',
      ],
      code: [
        {
          title: 'The idioms you will actually use',
          language: 'bash',
          code: `# Count and rank - the single most useful pipeline in operations
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# awk with a condition and aggregation, in one pass
awk '$9 >= 500 { errors[$7]++ } END { for (p in errors) print errors[p], p }' \\
  access.log | sort -rn | head

# Sum a column
awk '{ total += $10 } END { printf "%.2f MB\\n", total/1024/1024 }' access.log

# grep with context - invaluable when reading logs
grep -n -B 3 -A 10 "OutOfMemory" app.log

# Only the matching part, not the whole line
grep -oE '[0-9]{1,3}(\\.[0-9]{1,3}){3}' app.log | sort -u

# sed for substitution and for line ranges
sed -i.bak 's/localhost/db.internal/g' config.ini
sed -n '100,150p' huge.log

# cut when the delimiter is simple
cut -d: -f1,7 /etc/passwd

# jq for JSON - do NOT use grep for this
kubectl get pods -o json \\
  | jq -r '.items[] | select(.status.phase != "Running")
           | "\\(.metadata.name)\\t\\(.status.phase)"'

# Combining: find the 5 largest files, human-readable
find /var/log -type f -printf '%s\\t%p\\n' | sort -rn | head -5 \\
  | awk '{ printf "%.1f MB\\t%s\\n", $1/1024/1024, $2 }'`,
        },
      ],
      traps: [
        'Parsing JSON or XML with grep and sed. It works until the formatting changes, then fails silently.',
        'Using `cat file | grep x` when `grep x file` is simpler - a harmless habit, but interviewers notice.',
        'Building an unreadable ten-stage pipeline where twenty lines of Python would be clearer and testable.',
      ],
      followUps: [
        'When would you use awk over cut?',
        'How would you parse JSON without jq installed?',
        'At what point would you switch to Python?',
      ],
      tags: ['text processing', 'awk', 'grep', 'jq'],
    },
    {
      id: 'itv-sh-5',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'Write a script that checks a list of URLs and alerts if any are down. Walk me through your decisions.',
      probing:
        'A very common live exercise. They watch for strict mode, timeouts, quoting, exit codes and parallelism.',
      answer: [
        'The requirements I would state before writing: a **timeout** on every request so one hung endpoint cannot stall the whole run; **parallelism**, because checking fifty URLs sequentially with a 10-second timeout could take eight minutes; a **meaningful exit code** so a scheduler or CI can act on it; and clear output distinguishing "down" from "slow".',
        'For the request I would use `curl` with `-sS` (quiet but show errors), `--max-time` for the overall timeout, `--connect-timeout` separately, and `-o /dev/null -w "%{http_code}"` to get just the status code.',
        'For parallelism, `xargs -P` is the simplest portable option - it runs N processes at once with no extra dependencies. GNU `parallel` is nicer if available.',
        'For retries, I would try twice before declaring something down, because a single failed check is often a transient blip and alerting on it produces noise.',
        'And I would make the exit code reflect the outcome: 0 if everything is up, 1 if anything is down. That is what makes it usable from cron, a CI job or a monitoring wrapper.',
      ],
      code: [
        {
          title: 'The script',
          language: 'bash',
          code: `#!/usr/bin/env bash
set -euo pipefail

URLS_FILE="\${1:?usage: $0 <urls-file> [parallelism]}"
PARALLEL="\${2:-10}"
TIMEOUT=10
RETRIES=2

failures="$(mktemp)"
trap 'rm -f "$failures"' EXIT INT TERM

check_url() {
  local url="$1"
  local code="" attempt

  for ((attempt = 1; attempt <= RETRIES; attempt++)); do
    # -s quiet, -S still show errors, -o discard body, -w print status.
    # || true so a curl failure does not kill the function under set -e.
    code="$(curl -sS -o /dev/null -w '%{http_code}' \\
              --connect-timeout 5 --max-time "$TIMEOUT" \\
              "$url" 2>/dev/null)" || code="000"

    if [[ "$code" =~ ^(2|3)[0-9][0-9]$ ]]; then
      printf 'OK    %-50s %s\\n' "$url" "$code"
      return 0
    fi
    (( attempt < RETRIES )) && sleep 2
  done

  printf 'DOWN  %-50s %s\\n' "$url" "\${code:-000}" >&2
  echo "$url" >> "$FAILURES_FILE"
  return 1
}

export -f check_url
export TIMEOUT RETRIES
export FAILURES_FILE="$failures"

# Blank lines and # comments are skipped. -P runs N at a time.
grep -vE '^\\s*(#|$)' "$URLS_FILE" \\
  | xargs -P "$PARALLEL" -I{} bash -c 'check_url "$@"' _ {} \\
  || true

down_count="$(wc -l < "$failures" | tr -d ' ')"

if (( down_count > 0 )); then
  echo
  echo "$down_count endpoint(s) DOWN:" >&2
  cat "$failures" >&2
  exit 1
fi

echo
echo "All endpoints healthy."
exit 0`,
        },
        {
          title: 'Using it',
          language: 'bash',
          code: `cat > urls.txt <<'EOF'
# Production endpoints
https://api.example.com/health
https://www.example.com/
https://admin.example.com/healthz
EOF

./check-urls.sh urls.txt 20
echo "exit code: $?"      # 0 all up, 1 something down

# From cron, alerting only on failure
*/5 * * * * /usr/local/bin/check-urls.sh /etc/urls.txt \\
  || mail -s "Endpoint check FAILED" oncall@example.com`,
        },
      ],
      deeper: [
        'The subtle part of the script is the `export -f` plus `bash -c` construction. `xargs` spawns a new shell, which does not inherit shell functions unless you export them - this trips people up constantly, and it is worth being able to explain.',
        'The `|| true` on the `xargs` line is needed because `xargs` returns non-zero if any invocation failed, which under `set -e` would end the script before it could report anything.',
        'For anything beyond this I would say plainly that a real monitoring system is the right answer. A cron script has no history, no deduplication and no escalation - it is a stopgap.',
      ],
      traps: [
        'No timeout, so one hung endpoint stalls the entire check.',
        'Checking sequentially, so fifty URLs take minutes.',
        'Always exiting 0, which makes the script useless to any scheduler.',
        'Forgetting that `xargs` cannot see shell functions without `export -f`.',
      ],
      followUps: [
        'Why do you need export -f there?',
        'How would you avoid alerting on a single transient failure?',
        'When would you stop doing this in bash?',
      ],
      tags: ['scenario', 'scripting', 'curl', 'parallelism'],
    },
    {
      id: 'itv-sh-6',
      level: 'advanced',
      kind: 'multi',
      prompt: 'Which of these are real problems with this script? (Select all that apply.)',
      promptCode: [
        {
          title: 'deploy.sh',
          language: 'bash',
          code: `#!/bin/bash
cd $DEPLOY_DIR
rm -rf *
tar xzf /tmp/release.tar.gz
for f in $(ls *.conf); do
  sed -i "s/VERSION/$VERSION/" $f
done
systemctl restart myapp`,
        },
      ],
      options: [
        { id: 'a', text: 'No `set -euo pipefail`, so a failed `cd` still runs `rm -rf *`' },
        { id: 'b', text: 'Unquoted `$DEPLOY_DIR` and `$f` break on paths containing spaces' },
        { id: 'c', text: 'Parsing `ls` output instead of using a glob directly' },
        { id: 'd', text: 'No check that the tarball exists or extracted successfully' },
        { id: 'e', text: 'The script uses `#!/bin/bash` instead of `#!/usr/bin/env bash`' },
      ],
      correct: ['a', 'b', 'c', 'd'],
      probing:
        'A code-review question. Option E is a real style preference but a much weaker issue than the rest - they want to see you rank severity.',
      answer: [
        'A, B, C and D are all genuine problems. **E is a minor portability preference**, not a bug in the same class.',
        '**A is the dangerous one.** With no `set -e`, if `DEPLOY_DIR` is unset or the directory does not exist, `cd` fails, the script continues **in whatever directory it was launched from**, and `rm -rf *` deletes that instead. This is how people delete their home directory from a cron job.',
        '**B**: unquoted expansions word-split on spaces. A path like `/opt/my app` becomes two arguments.',
        '**C**: parsing `ls` is a well-known anti-pattern - it breaks on spaces and newlines in filenames. A glob does the same job correctly.',
        '**D**: no verification. If the tarball is missing or corrupt, the script has already deleted the old release and now restarts the service with an empty directory.',
        '**E** is a real consideration for portability to systems where bash is not in `/bin` - notably some BSDs and NixOS - but on Linux `#!/bin/bash` works fine. Worth mentioning, not worth leading with.',
      ],
      code: [
        {
          title: 'The rewritten version',
          language: 'bash',
          code: `#!/usr/bin/env bash
set -euo pipefail

# Fail immediately and clearly if a required variable is missing.
: "\${DEPLOY_DIR:?DEPLOY_DIR must be set}"
: "\${VERSION:?VERSION must be set}"

RELEASE="/tmp/release.tar.gz"

[[ -f "$RELEASE" ]] || { echo "Missing $RELEASE" >&2; exit 1; }
[[ -d "$DEPLOY_DIR" ]] || { echo "No such directory: $DEPLOY_DIR" >&2; exit 1; }

# Verify BEFORE destroying anything.
tar tzf "$RELEASE" >/dev/null || { echo "Corrupt archive" >&2; exit 1; }

# Extract to a staging directory, then swap - so a failure leaves the
# current release untouched.
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT INT TERM

tar xzf "$RELEASE" -C "$staging"

# A glob, not $(ls). nullglob so an empty match iterates zero times
# rather than passing the literal "*.conf".
shopt -s nullglob
for f in "$staging"/*.conf; do
  sed -i "s/VERSION/$VERSION/g" "$f"
done
shopt -u nullglob

# Atomic-ish swap, keeping the previous release for rollback.
if [[ -d "$DEPLOY_DIR/current" ]]; then
  rm -rf "$DEPLOY_DIR/previous"
  mv "$DEPLOY_DIR/current" "$DEPLOY_DIR/previous"
fi
mv "$staging" "$DEPLOY_DIR/current"

systemctl restart myapp

# Verify the restart actually worked.
sleep 2
systemctl is-active --quiet myapp || {
  echo "Service failed to start - rolling back" >&2
  rm -rf "$DEPLOY_DIR/current"
  mv "$DEPLOY_DIR/previous" "$DEPLOY_DIR/current"
  systemctl restart myapp
  exit 1
}`,
        },
      ],
      traps: [
        'Leading with the shebang style. It is the least important issue on the list.',
        'Missing that `cd` failing plus `rm -rf *` is a destructive combination, not just untidy.',
      ],
      followUps: [
        'What does `: "${VAR:?message}"` do?',
        'Why extract to staging and then swap?',
        'What does `shopt -s nullglob` protect against?',
      ],
      tags: ['code review', 'safety', 'deployment'],
    },
  ],
}
