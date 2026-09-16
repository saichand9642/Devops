import type { InterviewQuestion } from '../../../types'

/** Safety, quoting, exit codes and the basics that make a script reliable. */
export const shellFundamentalQuestions: InterviewQuestion[] = [
  {
    id: 'itv-shell-7',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `set -euo pipefail` do, and why is it the first line of most good scripts?',
    probing: 'Script safety. The default shell behaviour is genuinely dangerous.',
    options: [
      {
        id: 'a',
        text: 'Exit on error, treat unset variables as errors, and make a pipeline fail if any command in it fails',
      },
      { id: 'b', text: 'Enable verbose output for debugging' },
      { id: 'c', text: 'Run the script in a restricted shell' },
      { id: 'd', text: 'Set the script to run in the background' },
    ],
    correct: ['a'],
    answer: [
      '**`-e`** exits immediately when a command returns non-zero. Without it, a script carries on after a failure - so a `cd` that fails is followed by an `rm -rf *` that runs in the wrong directory. That is not a theoretical example.',
      '**`-u`** treats an unset variable as an error. Without it, `rm -rf "$PREFIX/data"` with `PREFIX` unset becomes `rm -rf /data`. A typo in a variable name silently expands to nothing.',
      '**`-o pipefail`** makes a pipeline return the exit status of the **last command that failed**, rather than only the last command. Without it, `curl bad-url | grep something` succeeds if `grep` succeeds, even though `curl` failed entirely.',
      'Together they turn a shell from "carry on regardless" into something that stops when things go wrong, which is what you want in automation. `IFS=$\'\\n\\t\'` is often added too, which stops word splitting on spaces and avoids a class of filename bugs.',
      'The caveat worth knowing: `-e` has surprising exceptions - it does not trigger inside a condition, in a command on the left of `&&`, or for a function called in an `if`. So it is a large improvement, not a guarantee.',
    ],
    code: [
      {
        title: 'The standard preamble, and why each part matters',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail
IFS=$'\\n\\t'

# Without -e: this continues after cd fails, in the wrong directory
cd /opt/app/releases
rm -rf ./*

# Without -u: PREFIX unset makes this "rm -rf /data"
rm -rf "\${PREFIX}/data"

# Without pipefail: succeeds if grep finds the string, even when curl failed
curl -sS https://api.example.com/health | grep -q '"status":"ok"'

# Deliberately allowing a command to fail needs to be explicit
set +e
optional_command
rc=$?
set -e
[ "$rc" -eq 0 ] || echo "optional_command failed, continuing anyway" >&2`,
      },
    ],
    traps: [
      'Assuming `-e` catches everything - it does not fire inside conditions or on the left of `&&`.',
      '`-u` breaking on a legitimately optional variable; use `"${VAR:-default}"`.',
      'Adding `|| true` broadly to work around `-e`, which reintroduces the original problem.',
    ],
    followUps: [
      'Where does `-e` not take effect?',
      'How do you allow one specific command to fail?',
    ],
    tags: ['set -e', 'safety', 'pipefail', 'fundamentals'],
  },
  {
    id: 'itv-shell-8',
    level: 'basic',
    kind: 'open',
    prompt: 'Why should you quote variables in shell, and what happens if you do not?',
    probing:
      'The single most common source of shell bugs. Whether you quote reflexively says a lot.',
    answer: [
      'An unquoted variable undergoes **word splitting** and **glob expansion** before the command sees it. So a variable containing a space becomes two arguments, and one containing `*` expands to matching filenames.',
      'The consequences range from annoying to destructive. `rm $file` with a filename containing a space deletes two wrong things. `for f in $(ls)` breaks on any filename with a space. A variable that is empty and unquoted disappears entirely, so `[ $x = "y" ]` becomes `[ = "y" ]`, which is a syntax error.',
      'The rule is to **quote every variable expansion** unless you specifically want splitting. `"$var"`, `"$@"`, `"${array[@]}"`. There is essentially no cost to quoting and a real cost to not.',
      'The special case worth knowing is **`"$@"` versus `$*`**: quoted `"$@"` preserves each argument as a separate word including spaces, which is what you want when forwarding arguments. `"$*"` joins them into one string. Unquoted `$@` splits on whitespace and loses the distinction entirely.',
      'And `shellcheck` catches almost all of these automatically, which is why it should be in CI for any script that matters.',
    ],
    code: [
      {
        title: 'What goes wrong, and the fix',
        language: 'bash',
        code: `file="my document.txt"

rm $file          # tries to remove "my" and "document.txt"
rm "$file"        # correct

# Empty variable disappears entirely without quotes
x=""
[ $x = "y" ]      # becomes: [ = "y" ]  -> syntax error
[ "$x" = "y" ]    # correct

# Glob expansion from a variable's contents
pattern="*"
echo $pattern     # lists every file in the directory
echo "$pattern"   # prints *

# Forwarding arguments - "$@" is the only correct form
run_with_logging() {
  echo "running: $*" >&2
  "$@"                            # each argument preserved exactly
}
run_with_logging rm "my document.txt"

# Iterating files safely - never parse ls
find . -name '*.log' -print0 | while IFS= read -r -d '' f; do
  process "$f"
done`,
      },
    ],
    traps: [
      '`for f in $(ls)`, which breaks on any filename containing a space.',
      '`$@` unquoted, which loses argument boundaries.',
      'Unquoted variables in `[ ]` tests, producing syntax errors when empty.',
      'Assuming filenames are well-behaved. They are not, especially from user input.',
    ],
    followUps: [
      'What is the difference between `"$@"` and `"$*"`?',
      'Why is `for f in $(ls)` wrong?',
    ],
    tags: ['quoting', 'word splitting', 'safety', 'fundamentals'],
  },
  {
    id: 'itv-shell-9',
    level: 'basic',
    kind: 'open',
    prompt: 'How do exit codes work, and how should a script use them?',
    probing: 'The contract between a script and whatever calls it.',
    answer: [
      'Every command returns an exit status: **0 means success**, non-zero means failure. `$?` holds the status of the last command. A script returns the status of its last command unless it calls `exit` explicitly.',
      'The conventions worth knowing: **1** is a general error, **2** is conventionally a usage or argument error, **126** means the command was found but not executable, **127** means command not found, and **128+N** means the process was killed by signal N - so **130** is SIGINT (Ctrl-C) and **137** is SIGKILL, which in a container almost always means the OOM killer.',
      'For a script that will be automated, **distinct exit codes** let the caller act differently: 2 for bad arguments, 3 for a missing dependency, 4 for the remote service being unreachable. That is much better than the caller having to parse error text.',
      'The rule that matters most: **never exit 0 on failure**. A script that catches an error and exits successfully means CI reports green, the scheduler moves on, and nobody finds out until the consequences surface elsewhere.',
      'And `trap` is what makes cleanup reliable regardless of how the script exits - on success, on error, or on interrupt.',
    ],
    code: [
      {
        title: 'Meaningful exit codes and reliable cleanup',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

readonly E_USAGE=2
readonly E_MISSING_DEP=3
readonly E_UNREACHABLE=4

usage() { echo "usage: $0 <environment> <version>" >&2; exit "$E_USAGE"; }

[ $# -eq 2 ] || usage

command -v jq >/dev/null 2>&1 || {
  echo "jq is required but not installed" >&2
  exit "$E_MISSING_DEP"
}

# Cleanup runs on any exit: success, error, or Ctrl-C
workdir="$(mktemp -d)"
cleanup() {
  local rc=$?
  rm -rf "$workdir"
  [ "$rc" -ne 0 ] && echo "failed with status $rc" >&2
  exit "$rc"
}
trap cleanup EXIT INT TERM

curl -fsS --max-time 30 "https://api.example.com/deploy" -o "$workdir/resp.json" || {
  echo "deployment API unreachable" >&2
  exit "$E_UNREACHABLE"
}

echo "deployed"`,
      },
    ],
    traps: [
      'Exiting 0 after handling an error, so the caller believes it worked.',
      'Cleanup outside a `trap`, so it is skipped on failure or interrupt.',
      'Checking `$?` after an intervening command, which has already overwritten it.',
      'Errors printed to stdout rather than stderr.',
    ],
    followUps: [
      'What does exit code 137 usually mean in a container?',
      'Why use `trap` rather than cleanup at the end?',
    ],
    tags: ['exit codes', 'trap', 'error handling', 'fundamentals'],
  },
  {
    id: 'itv-shell-10',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain stdin, stdout, stderr and redirection.',
    probing: 'Stream handling, which is the foundation of everything in shell.',
    answer: [
      'Every process has three standard streams: **stdin** (file descriptor 0) for input, **stdout** (1) for normal output, and **stderr** (2) for errors and diagnostics.',
      'The separation is the point. **Results go to stdout, diagnostics go to stderr**, so output can be piped or captured without error messages contaminating it, and errors are still visible when stdout is redirected to a file.',
      'The redirections worth knowing: `>` truncates and writes, `>>` appends, `<` reads. `2>` redirects stderr specifically. `2>&1` merges stderr into wherever stdout currently points, and **order matters** - `> file 2>&1` sends both to the file, while `2>&1 > file` sends stderr to the original stdout and only stdout to the file, which is almost never what anyone means. Bash also has `&>` as a shorthand for both.',
      '`/dev/null` discards, and `2>/dev/null` to hide errors should be used deliberately rather than as a habit - it is how genuine failures become invisible.',
      "**Process substitution** `<(command)` gives you a filename that reads a command's output, which lets you diff two commands or feed a command where a file is expected - genuinely useful and not widely known.",
    ],
    code: [
      {
        title: 'Redirection, including the ordering trap',
        language: 'bash',
        code: `command > out.log                  # stdout to file, stderr to terminal
command 2> err.log                 # stderr to file
command > out.log 2>&1             # both to the file
command &> out.log                 # same, bash shorthand

# ORDER MATTERS - this does NOT send both to the file
command 2>&1 > out.log             # stderr to the ORIGINAL stdout, stdout to file

# Diagnostics to stderr so stdout stays clean for piping
log() { echo "[$(date -Is)] $*" >&2; }
log "starting"
echo "result-value"                # the only thing on stdout

# Process substitution - a command where a file is expected
diff <(ssh host1 'rpm -qa | sort') <(ssh host2 'rpm -qa | sort')

# tee - to a file AND onward through the pipe
./build.sh 2>&1 | tee build.log | grep -i error`,
      },
    ],
    traps: [
      '`2>&1 > file`, which does not do what people expect.',
      'Diagnostics on stdout, contaminating piped output.',
      '`2>/dev/null` as a habit, hiding real errors.',
      'Forgetting that `>` truncates immediately, even if the command then fails.',
    ],
    followUps: [
      'Why does the order of `>` and `2>&1` matter?',
      'What is process substitution useful for?',
    ],
    tags: ['streams', 'redirection', 'stderr', 'pipes', 'fundamentals'],
  },
  {
    id: 'itv-shell-11',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle command-line arguments in a script?',
    probing: 'Making a script usable by someone other than its author.',
    answer: [
      'The positional parameters are `$1`, `$2` and so on, `$#` is the count, and `"$@"` is all of them preserving boundaries. For a script with one or two fixed arguments, checking `$#` and assigning them to named variables is enough.',
      'For **options**, `getopts` handles short flags in the standard way - clustering, arguments to options, and the error cases. It only handles short options; long options require a manual `while`/`case` loop, which is what most real scripts end up doing.',
      'What makes a script pleasant to use is mostly not the parsing: a **usage function** printed on bad input and on `--help`, **validation with specific error messages** rather than failing later, **sensible defaults** so the common case needs no flags, and **`--dry-run`** on anything that makes changes.',
      'And the convention that anything read from the environment should have a **command-line override**, so the script works in a container (environment) and interactively (flags) without modification.',
    ],
    code: [
      {
        title: 'A manual parser handling long and short options',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="\${DEPLOY_ENV:-dev}"      # env as the default, flag overrides
VERSION=""
DRY_RUN=false
VERBOSE=false

usage() {
  cat >&2 <<'USAGE'
usage: deploy.sh [options] <version>

  -e, --environment ENV   dev | staging | prod (default: dev, or $DEPLOY_ENV)
  -n, --dry-run           show what would happen, change nothing
  -v, --verbose           more output
  -h, --help              this message
USAGE
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    -e|--environment) ENVIRONMENT="\${2:?--environment needs a value}"; shift 2 ;;
    -n|--dry-run)     DRY_RUN=true;  shift ;;
    -v|--verbose)     VERBOSE=true;  shift ;;
    -h|--help)        usage ;;
    --)               shift; break ;;
    -*)               echo "unknown option: $1" >&2; usage ;;
    *)                VERSION="$1";  shift ;;
  esac
done

[ -n "$VERSION" ] || { echo "version is required" >&2; usage; }

case "$ENVIRONMENT" in
  dev|staging|prod) ;;
  *) echo "invalid environment: $ENVIRONMENT" >&2; usage ;;
esac

"$VERBOSE" && set -x

if "$DRY_RUN"; then
  echo "would deploy $VERSION to $ENVIRONMENT"
  exit 0
fi`,
      },
    ],
    traps: [
      'No usage message, so the script is unusable without reading the source.',
      'Validation after the script has already done work.',
      'No `--dry-run` on something that changes production.',
      '`shift` without checking there is an argument to shift.',
    ],
    followUps: ['Why should environment variables and flags both work?'],
    tags: ['arguments', 'getopts', 'cli', 'usability'],
  },
  {
    id: 'itv-shell-12',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is wrong with this?',
    promptCode: [
      {
        title: 'A common pattern',
        language: 'bash',
        code: `for file in $(ls *.log); do
  gzip "$file"
done`,
      },
    ],
    probing: 'Parsing `ls` - a classic and genuinely harmful anti-pattern.',
    options: [
      {
        id: 'a',
        text: 'Parsing `ls` breaks on filenames with spaces or special characters; the glob can be used directly',
      },
      { id: 'b', text: '`gzip` cannot be used in a loop' },
      { id: 'c', text: 'The variable needs to be called something other than `file`' },
      { id: 'd', text: 'Nothing is wrong with it' },
    ],
    correct: ['a'],
    answer: [
      'The output of `ls` is text, and the shell splits it on whitespace. A file called `application error.log` becomes two iterations, `application` and `error.log`, neither of which exists. Filenames containing newlines break it completely.',
      'The fix is that **the glob already produces the list** - `for file in *.log` iterates the filenames directly, with no text parsing and no splitting. `ls` adds nothing here except the bug.',
      'One detail to handle: if no files match, an unquoted glob expands to the literal string `*.log`. `shopt -s nullglob` makes it expand to nothing instead, so the loop body simply does not run.',
      "For anything recursive or with more complex criteria, `find -print0` piped to `while IFS= read -r -d ''` is the safe form, because the null separator cannot appear in a filename.",
    ],
    code: [
      {
        title: 'The safe forms',
        language: 'bash',
        code: `# Correct - the glob produces the filenames directly
shopt -s nullglob                 # no matches means zero iterations
for file in *.log; do
  gzip "$file"
done

# Recursive or with criteria - null-separated, which no filename can contain
find /var/log -name '*.log' -mtime +7 -print0 |
  while IFS= read -r -d '' file; do
    gzip "$file"
  done

# Or let find do it, with no shell loop at all
find /var/log -name '*.log' -mtime +7 -exec gzip {} +`,
      },
    ],
    traps: [
      'Parsing any command output that contains filenames.',
      'Forgetting `nullglob`, so the loop runs once with the literal pattern.',
      'A `while read` loop in a pipeline running in a subshell, so variables set inside it do not persist.',
    ],
    followUps: ['What does `nullglob` change?', "Why is `-print0` with `read -d ''` safe?"],
    tags: ['globbing', 'find', 'anti-pattern', 'filenames', 'safety'],
  },
  {
    id: 'itv-shell-13',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you debug a shell script?',
    probing: 'Practical debugging technique.',
    answer: [
      '**`set -x`** traces every command as it executes, with variables expanded - so you see what actually ran rather than what you wrote. It is the single most useful debugging tool in shell. `set +x` turns it off, so it can be scoped to the section of interest rather than producing thousands of lines.',
      "**`PS4`** controls the trace prefix, and setting it to include the line number and function name makes the output vastly more readable: `PS4='+ ${BASH_SOURCE}:${LINENO}:${FUNCNAME[0]:-main}: '`.",
      '**`bash -n script.sh`** checks syntax without executing, which is worth doing before running anything destructive.',
      '**`shellcheck`** is the most valuable of all and is static - it catches unquoted variables, useless `cat`, misused test operators, the `2>&1 >` ordering mistake, and a long list of real bugs. It should be in CI for any script that matters, not just run occasionally.',
      'And a **trap on ERR** that prints the failing line number turns "the script failed" into "line 47 failed", which saves a lot of time on a long script.',
    ],
    code: [
      {
        title: 'Tracing with useful context',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

# Line numbers and function names in the trace
export PS4='+ \${BASH_SOURCE##*/}:\${LINENO}:\${FUNCNAME[0]:-main}: '

# Enable tracing with DEBUG=1 rather than editing the script
[ "\${DEBUG:-0}" = "1" ] && set -x

# Report exactly where a failure happened
trap 'echo "ERROR: failed at line $LINENO: $BASH_COMMAND" >&2' ERR

deploy() {
  set -x                          # trace just this function
  rsync -a "$src/" "$dst/"
  set +x
}`,
      },
      {
        title: 'Static checking before it runs',
        language: 'bash',
        code: `bash -n deploy.sh                 # syntax only, no execution
shellcheck deploy.sh              # the real value - catches genuine bugs

# In CI
find . -name '*.sh' -print0 | xargs -0 shellcheck --severity=warning`,
      },
    ],
    traps: [
      '`set -x` left enabled inside a block handling secrets, printing them to the log.',
      'Debugging by adding `echo` statements instead of using `set -x`.',
      'Not running `shellcheck`, and rediscovering bugs it would have found instantly.',
    ],
    followUps: [
      'What is the risk of `set -x` around a credential?',
      'Why is `shellcheck` worth putting in CI?',
    ],
    tags: ['debugging', 'set -x', 'shellcheck', 'tracing'],
  },
  {
    id: 'itv-shell-14',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you write a script that is safe to run twice?',
    probing: 'Idempotence in shell, which requires deliberate effort.',
    answer: [
      'Shell has no idempotence by default - every command just runs. Making a script safe to rerun means **checking state before acting**, which has to be done explicitly for each operation.',
      'The patterns: **`mkdir -p`** rather than `mkdir`, which succeeds whether or not the directory exists. **Check before creating**: `id -u user >/dev/null 2>&1 || useradd user`. **`grep -q` before appending** to a file, or the line accumulates on every run. **Atomic writes** - write to a temporary file and `mv` it into place, so a partial write never becomes the live file.',
      "For **downloads and extractions**, guard on the result existing, which is the shell equivalent of Ansible's `creates`.",
      'For anything that genuinely must happen only once, a **marker file** or a lock is the simple approach - check for it, do the work, create it.',
      'The reason this matters is that a script will be rerun: after a failure partway through, by someone unsure whether it completed, or by an automated retry. If rerunning is dangerous, then recovering from a partial failure is dangerous too, and that is exactly when it will happen.',
    ],
    code: [
      {
        title: 'Each operation guarded',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

# Directory - always safe
mkdir -p /opt/app/{releases,shared,config}

# User - create only if absent
id -u appuser >/dev/null 2>&1 || useradd --system --home /opt/app appuser

# Line in a config file - grep first, or it accumulates
grep -qxF 'appuser soft nofile 65536' /etc/security/limits.conf ||
  echo 'appuser soft nofile 65536' >> /etc/security/limits.conf

# Download - skip if the result already exists and is valid
if [ ! -f /opt/app/releases/app-1.4.2.tar.gz ]; then
  curl -fsSL -o /tmp/app.tar.gz "https://artifacts.example.com/app-1.4.2.tar.gz"
  echo "abc123...  /tmp/app.tar.gz" | sha256sum -c -
  mv /tmp/app.tar.gz /opt/app/releases/app-1.4.2.tar.gz
fi

# Atomic config write - a partial write never becomes the live file
tmp="$(mktemp)"
render_config > "$tmp"
if ! cmp -s "$tmp" /etc/app/config.yaml; then
  mv "$tmp" /etc/app/config.yaml       # mv within a filesystem is atomic
  systemctl reload app
else
  rm -f "$tmp"                          # unchanged: do not reload
fi`,
      },
    ],
    traps: [
      'Appending to a file without checking, so the line accumulates on every run.',
      'Writing a config file directly, so an interrupted write leaves it truncated.',
      'Restarting a service unconditionally rather than only when the config changed.',
      '`mv` across filesystems, which is a copy and delete and therefore not atomic.',
    ],
    followUps: [
      'Why is writing to a temp file and moving it better?',
      'What makes `mv` atomic, and when is it not?',
    ],
    tags: ['idempotence', 'atomic writes', 'safety', 'automation'],
  },
  {
    id: 'itv-shell-15',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is the difference between `$(...)`, backticks, and `${...}`?',
    probing: 'Substitution syntax and why one form is preferred.',
    answer: [
      '**`$(command)`** is command substitution - it runs the command and substitutes its output. **Backticks** do the same thing and are the older syntax.',
      '`$(...)` is preferred for two concrete reasons: it **nests** without escaping, where backticks require increasingly ugly backslashes; and the **quoting rules inside are the ordinary ones**, where backticks treat backslashes specially in a way that surprises people. There is no situation where backticks are better.',
      '**`${variable}`** is parameter expansion - substituting a variable\'s value, with optional modification. The braces are required when the variable name is followed by a character that could be part of a name: `"${file}_backup"` without braces would look for a variable called `file_backup`.',
      'Parameter expansion does considerably more than substitution, and the forms are worth knowing: `${var:-default}` substitutes a default if unset, `${var:?message}` fails with a message if unset, `${var%.txt}` strips a suffix, `${var##*/}` strips everything up to the last slash (a basename), `${var/old/new}` substitutes, and `${#var}` gives the length. They avoid spawning `basename`, `dirname` or `sed` for simple operations.',
    ],
    code: [
      {
        title: 'Substitution and the useful expansions',
        language: 'bash',
        code: `# Command substitution - always use $( ), never backticks
files=$(find . -name '*.log' | wc -l)
newest=$(ls -t "$(dirname "$config_path")" | head -1)     # nests cleanly

# Braces required when a character could continue the name
backup="\${file}_backup"

# Defaults and required values
env="\${DEPLOY_ENV:-dev}"                 # default if unset or empty
token="\${API_TOKEN:?API_TOKEN must be set}"   # fail clearly if unset

# String manipulation without spawning a process
path="/var/log/app/access.log.gz"
echo "\${path##*/}"        # access.log.gz   (basename)
echo "\${path%/*}"         # /var/log/app    (dirname)
echo "\${path%.gz}"        # strip one suffix
echo "\${path%%.*}"        # strip from the first dot
echo "\${path/log/LOG}"    # replace first occurrence
echo "\${#path}"           # length`,
      },
    ],
    traps: [
      'Backticks, which do not nest and have surprising quoting rules.',
      'Missing braces, so `$file_backup` looks for the wrong variable.',
      'Spawning `basename` or `sed` in a loop where parameter expansion would do - noticeably slower at scale.',
      'Forgetting that `$(...)` strips trailing newlines.',
    ],
    followUps: ['Why is `$( )` preferred over backticks?'],
    tags: ['command substitution', 'parameter expansion', 'syntax', 'fundamentals'],
  },
  {
    id: 'itv-shell-16',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A cron script has been failing silently for three weeks and nobody noticed. What went wrong and how do you fix it?',
    probing: 'Observability for scripts - a genuinely common and costly failure.',
    answer: [
      'Several things have to go wrong together for this, and each is worth fixing independently.',
      '**Output went nowhere.** Cron mails stdout and stderr to the user, which on most systems is unconfigured and discarded. If the script did print an error, nobody saw it. The immediate fix is to redirect to a log file, or better, to `logger` so it goes to syslog and is collected centrally.',
      '**The exit code was ignored.** Cron does nothing with a non-zero exit beyond the mail nobody reads. Something has to check it - a wrapper that reports failures, or a monitoring system.',
      '**There was no positive signal.** This is the important one: the absence of a failure alert is not evidence of success. A script that never runs at all produces exactly the same silence as one that runs perfectly. The fix is a **heartbeat**: the script reports success somewhere on completion, and an alert fires when that signal has not been seen for longer than the expected interval. That covers the script failing, the script not being scheduled, cron being broken, and the machine being gone - none of which failure-based alerting catches.',
      'The durable fixes: a **systemd timer** instead of cron, which logs to the journal, records the exit status, and can trigger an `OnFailure` unit; **`logger`** rather than a local file, so output reaches the central log platform; and a **dead-man’s-switch** heartbeat with an alert on its absence.',
      "And for the immediate question of what actually broke: the logs, if any, and running the script manually with `bash -x` under cron's environment - which is usually where the answer is.",
    ],
    code: [
      {
        title: 'A wrapper that cannot fail silently',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

readonly JOB="nightly-report"
readonly HEARTBEAT_URL="https://hc.example.com/ping/\${JOB}"

# Everything the script says goes to syslog, with a tag
exec 1> >(logger -t "$JOB" -p user.info)
exec 2> >(logger -t "$JOB" -p user.err)

report_failure() {
  local rc=$?
  logger -t "$JOB" -p user.err "FAILED with status $rc at line $LINENO"
  curl -fsS --max-time 10 "\${HEARTBEAT_URL}/fail" >/dev/null 2>&1 || true
  exit "$rc"
}
trap report_failure ERR

echo "starting"
do_the_work
echo "completed"

# Positive signal - the monitor alerts if this stops arriving
curl -fsS --max-time 10 "$HEARTBEAT_URL" >/dev/null`,
      },
      {
        title: 'A systemd timer instead, which solves most of this',
        language: 'text',
        code: `# /etc/systemd/system/nightly-report.service
[Unit]
Description=Nightly report
OnFailure=alert@%n.service          # a unit that pages when this fails

[Service]
Type=oneshot
ExecStart=/opt/app/bin/nightly-report.sh
User=app
# Output goes to the journal automatically - nothing to redirect

# /etc/systemd/system/nightly-report.timer
[Unit]
Description=Run the nightly report

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true                     # run on boot if a scheduled run was missed
RandomizedDelaySec=300

[Install]
WantedBy=timers.target`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Why three weeks of silence was possible',
        caption: 'The heartbeat is the only one of these that detects a job that never ran at all.',
        nodes: [
          { label: 'Output mailed and discarded', detail: 'Nobody saw the error', tone: 'danger' },
          { label: 'Exit code checked by nothing', detail: 'Cron does not care', tone: 'danger' },
          {
            label: 'No positive success signal',
            detail: 'Silence looks identical to success',
            tone: 'danger',
          },
          { label: 'Fix: log to syslog', detail: 'Reaches the central platform' },
          { label: 'Fix: alert on failure', detail: 'systemd OnFailure, or a wrapper' },
          { label: 'Fix: heartbeat with absence alerting', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Alerting on absence rather than on failure is the key insight: it is the only thing that detects a job that was never scheduled or a machine that is gone.',
      '`Persistent=true` on a systemd timer runs a missed job on boot, which cron does not do.',
      'Log the duration as well as success. A job that gradually slows will eventually overrun its window, and that is visible long before it fails.',
    ],
    traps: [
      'Fixing the immediate bug and leaving the silence.',
      'Alerting only on failure, which misses the job not running.',
      'A local log file nobody collects or reads.',
      '`MAILTO=""` set to stop the noise, removing the only signal there was.',
    ],
    followUps: [
      'Why alert on absence rather than failure?',
      'What does a systemd timer give you over cron?',
    ],
    tags: ['scenario', 'cron', 'monitoring', 'systemd', 'observability', 'advanced'],
  },
  {
    id: 'itv-shell-17',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are the differences between `[`, `[[` and `((`?',
    probing: 'Test constructs - a genuine source of subtle bugs.',
    answer: [
      '**`[`** is the POSIX test command - it is literally a command, which is why it needs spaces around it and why unquoted empty variables cause syntax errors. It is portable to any POSIX shell.',
      '**`[[`** is a bash keyword, not a command. Because the shell parses it specially, it does **no word splitting or glob expansion** on the variables inside, so an unquoted empty variable does not break it. It also supports `&&` and `||` directly, pattern matching with `==`, and regex matching with `=~`.',
      '**`((` ** is for **arithmetic**: `(( count > 5 ))` evaluates numerically, variables do not need `$`, and C-style operators work. It is much clearer than `[ "$count" -gt 5 ]` for anything numeric.',
      'The practical guidance: **use `[[` in bash scripts** - it is safer and more capable. Use `[` only when the script genuinely must run under `sh` or another POSIX shell, in which case quote everything rigorously. Use `((` for arithmetic.',
      'One trap to know: inside `[[`, the right-hand side of `==` is a **pattern**, not a literal string. `[[ $file == *.log ]]` is a glob match, which is useful and surprising if you expected string equality. Quoting it - `[[ $file == "*.log" ]]` - makes it literal.',
    ],
    code: [
      {
        title: 'Each in its place',
        language: 'bash',
        code: `# [[ - bash, safer, more capable
[[ -z $var ]]                      # no quotes needed; no splitting happens
[[ $name == web-* ]]               # pattern match
[[ $version =~ ^v[0-9]+\\.[0-9]+ ]]  # regex
[[ -f $config && -r $config ]]     # && directly

# (( - arithmetic
(( count > 5 ))
(( total += value ))
(( retries++ ))
if (( $(date +%H) < 6 )); then echo "out of hours"; fi

# [ - POSIX, portable, needs rigorous quoting
[ -z "$var" ]                      # quotes REQUIRED
[ "$a" = "$b" ]                    # = not ==
[ -f "$config" ] && [ -r "$config" ]

# The pattern trap
file="access.log"
[[ $file == *.log ]]               # true  - glob match
[[ $file == "*.log" ]]             # false - literal comparison`,
      },
    ],
    traps: [
      '`[` with unquoted variables, which breaks when they are empty.',
      'Expecting `==` inside `[[` to be literal - it is a pattern match.',
      '`[[` in a script with a `#!/bin/sh` shebang, where it may not exist.',
      '`-eq` used for string comparison, or `=` for numbers.',
    ],
    followUps: ['Why does `[[` not need quoted variables?', 'When must you use `[` instead?'],
    tags: ['tests', 'conditionals', 'bash', 'posix', 'syntax'],
  },
  {
    id: 'itv-shell-18',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you process a large file efficiently in shell?',
    probing: 'Performance and the process-spawning cost that dominates shell.',
    answer: [
      'The governing fact is that **spawning a process is expensive relative to everything else in shell**. A loop that runs `grep`, `awk` or `sed` once per line on a million-line file spawns a million processes and will take hours; the same work done by one `awk` invocation takes seconds.',
      'So the principle is to **let a single tool do the whole file** rather than looping in shell. `awk` in particular can filter, transform and aggregate in one pass, and it is the right answer for most line-oriented processing.',
      '**Order the pipeline so the cheapest filter comes first.** `grep` is much faster than `awk` for a simple match, so `grep pattern file | awk ...` processes far fewer lines in `awk` than `awk` doing both.',
      'Other useful points: **`LC_ALL=C`** disables locale-aware comparison and can make `sort` and `grep` several times faster on ASCII data. **`sort -u`** is faster than `sort | uniq`. And `xargs -P` or GNU `parallel` gives you real parallelism when the work is per-file rather than per-line.',
      'And the honest boundary: once the processing has real logic - parsing JSON, branching, maintaining state - shell stops being the right tool and Python is both clearer and usually faster.',
    ],
    code: [
      {
        title: 'The pattern that is slow, and the one that is not',
        language: 'bash',
        code: `# SLOW - spawns awk once per line; hours on a large file
while read -r line; do
  echo "$line" | awk '{print $7}'
done < access.log

# FAST - one process, one pass
awk '{print $7}' access.log

# Cheap filter first, so awk sees far fewer lines
grep ' 500 ' access.log | awk '{count[$7]++} END {for (u in count) print count[u], u}' |
  sort -rn | head -20

# One awk pass doing filtering AND aggregation
awk '$9 == 500 {errors[$7]++} END {for (u in errors) printf "%8d  %s\\n", errors[u], u}' \\
  access.log | sort -rn | head -20`,
      },
      {
        title: 'Locale, sorting and parallelism',
        language: 'bash',
        code: `# LC_ALL=C - byte comparison instead of locale-aware; often several times faster
LC_ALL=C sort -u large.txt > sorted.txt
LC_ALL=C grep -F 'exact string' huge.log

# sort -u beats sort | uniq
sort -u file.txt

# Parallelism across files, bounded
find /var/log -name '*.log' -print0 |
  xargs -0 -P 8 -I {} gzip {}

# Big sort: give it memory and a sensible temp directory
sort -S 2G -T /var/tmp --parallel=8 -k2,2 huge.csv > sorted.csv`,
      },
    ],
    traps: [
      'A shell loop calling an external command per line.',
      'Expensive filters before cheap ones in a pipeline.',
      '`cat file | grep x` - useless use of cat; `grep x file` reads it directly.',
      'Persisting with shell once the logic needs JSON parsing or branching.',
    ],
    followUps: [
      'Why is a per-line subprocess so slow?',
      'When would you stop and write it in Python?',
    ],
    tags: ['performance', 'awk', 'pipelines', 'parallelism', 'advanced'],
  },
  {
    id: 'itv-shell-19',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between `>` and `>>`?',
    probing: 'A basic distinction with a destructive failure mode.',
    options: [
      { id: 'a', text: '`>` truncates the file and writes; `>>` appends to the end' },
      { id: 'b', text: '`>` writes stdout and `>>` writes stderr' },
      { id: 'c', text: '`>>` is faster for large files' },
      { id: 'd', text: 'They are equivalent' },
    ],
    correct: ['a'],
    answer: [
      '`>` **truncates** the file to zero length and then writes. `>>` **appends** to the existing content.',
      'The detail that makes `>` dangerous is that **truncation happens when the redirection is set up, before the command runs**. So `sort important.txt > important.txt` destroys the file before `sort` reads a single line - the output is an empty file, and the original is gone.',
      'The same applies when the command fails: `generate-config > /etc/app/config` truncates the config immediately, so a command that then errors leaves you with an empty configuration file rather than the previous one.',
      'The protections: `set -o noclobber` makes `>` refuse to overwrite an existing file (with `>|` to force it), and the general pattern of **writing to a temporary file and moving it into place** avoids the problem entirely while also making the replacement atomic.',
    ],
    code: [
      {
        title: 'The destructive case, and the safe pattern',
        language: 'bash',
        code: `# DESTROYS the file - truncated before sort reads it
sort important.txt > important.txt

# Safe - write elsewhere, then move atomically
sort important.txt > important.txt.tmp && mv important.txt.tmp important.txt

# Or use the tool's in-place option where it has one
sed -i.bak 's/old/new/g' config.txt        # keeps config.txt.bak

# noclobber refuses to overwrite
set -o noclobber
echo "x" > existing.txt      # error: cannot overwrite existing file
echo "x" >| existing.txt     # explicit override`,
      },
    ],
    traps: [
      "Redirecting a command's output to its own input file.",
      '`>` on a config file, so a failed command leaves it empty.',
      'Appending to a log with `>` in a loop, so only the last iteration survives.',
    ],
    followUps: ['Why does `sort file > file` produce an empty file?'],
    tags: ['redirection', 'truncation', 'safety', 'fundamentals'],
  },
  {
    id: 'itv-shell-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you make a script that runs on several different systems?',
    probing: 'Portability, which is mostly about knowing where the differences are.',
    answer: [
      'The first decision is **which shell**. `#!/bin/sh` means POSIX and no bash features - no arrays, no `[[`, no `${var,,}`. `#!/usr/bin/env bash` means bash, found wherever it is installed rather than assumed at `/bin/bash`, which matters on systems where it is elsewhere.',
      'The differences that actually bite are in the **utilities**, not the shell. **GNU versus BSD** coreutils differ in ways that break scripts silently: `sed -i` needs an argument on macOS and not on Linux, `date` uses completely different flags for relative times, `readlink -f` does not exist on older macOS, and `grep -P` is GNU-only.',
      '**Detect rather than assume.** `command -v` checks whether a tool exists before using it, and branching on `uname` handles the genuinely platform-specific parts.',
      '**Do not hardcode paths.** `/usr/bin/python3` versus `/usr/local/bin/python3` differs by system; `env` or `command -v` finds it.',
      'And the pragmatic position: for anything more than a little portability, **write for one target and run it in a container**. That removes the entire problem, and it is usually less work than making a complex script portable across four platforms.',
    ],
    code: [
      {
        title: 'Detecting rather than assuming',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

# Check dependencies up front, with a clear message
for cmd in jq curl git; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "required command not found: $cmd" >&2
    exit 3
  }
done

# sed -i differs between GNU and BSD
if sed --version >/dev/null 2>&1; then
  sed_inplace() { sed -i "$@"; }          # GNU
else
  sed_inplace() { sed -i '' "$@"; }       # BSD / macOS
fi

# date relative times differ completely
if date --version >/dev/null 2>&1; then
  yesterday=$(date -d 'yesterday' +%F)     # GNU
else
  yesterday=$(date -v-1d +%F)              # BSD
fi

# Platform-specific branches
case "$(uname -s)" in
  Linux)  PKG="apt-get install -y" ;;
  Darwin) PKG="brew install" ;;
  *)      echo "unsupported platform: $(uname -s)" >&2; exit 1 ;;
esac`,
      },
    ],
    traps: [
      '`#!/bin/bash` hardcoded, which fails where bash is elsewhere.',
      'GNU-only flags in a script that also runs on macOS.',
      'Assuming a tool is installed rather than checking.',
      'Writing for POSIX `sh` and then using bash features, which works until it runs under dash.',
    ],
    followUps: [
      'What is the most common GNU/BSD difference you hit?',
      'When would you just use a container instead?',
    ],
    tags: ['portability', 'posix', 'gnu', 'bsd', 'compatibility'],
  },
]
