import type { InterviewTopic } from '../../types'

export const pythonTopic: InterviewTopic = {
  id: 'python',
  title: 'Python for DevOps',
  shortTitle: 'Python',
  icon: '🐍',
  order: 10,
  oneLiner:
    'The language features, error handling, API and file work, and the coding exercises that come up in DevOps interviews.',
  headlines: [
    'Use `with` for anything with a resource - files, connections, locks. It closes on exception too.',
    'Mutable default arguments (`def f(x=[])`) are shared across calls. This is the classic Python gotcha.',
    'A list comprehension is the idiomatic transform; a generator (`()` not `[]`) is the memory-safe one.',
    '`dict.get(key, default)` and `collections.defaultdict` remove most `KeyError` handling.',
    'Catch specific exceptions. A bare `except:` swallows `KeyboardInterrupt` and real bugs.',
    'For subprocesses use `subprocess.run` with a **list** of arguments and `check=True`. Never `shell=True` with untrusted input.',
  ],
  questions: [
    {
      id: 'itv-py-1',
      level: 'basic',
      kind: 'mcq',
      prompt: 'What does this print?',
      promptCode: [
        {
          title: 'A function with a default argument',
          language: 'python',
          code: `def add_item(item, items=[]):
    items.append(item)
    return items

print(add_item(1))
print(add_item(2))
print(add_item(3))`,
        },
      ],
      options: [
        { id: 'a', text: '[1] then [2] then [3]' },
        { id: 'b', text: '[1] then [1, 2] then [1, 2, 3]' },
        { id: 'c', text: '[1] then [1] then [1]' },
        { id: 'd', text: 'It raises a TypeError' },
      ],
      correct: ['b'],
      probing:
        'The single most-asked Python gotcha. It tests whether you understand when default arguments are evaluated.',
      answer: [
        'It prints `[1]`, then `[1, 2]`, then `[1, 2, 3]`.',
        'Default arguments are evaluated **once**, when the function is **defined** - not each time it is called. So there is exactly one list object, created at definition time, and every call that does not pass `items` appends to that same list.',
        'This bites hardest with mutable defaults: lists, dicts and sets. Immutable defaults like `0`, `None` or a string are fine, because nothing can modify them in place.',
        'The fix is the standard idiom: default to `None` and create the mutable object inside the function.',
      ],
      code: [
        {
          title: 'The fix, and why it works',
          language: 'python',
          code: `def add_item(item, items=None):
    # A new list per call, unless the caller supplied one.
    if items is None:
        items = []
    items.append(item)
    return items

print(add_item(1))   # [1]
print(add_item(2))   # [2]
print(add_item(3))   # [3]

# Proof of the original behaviour:
def f(x=[]):
    return x

print(f() is f())          # True - the SAME object every time
print(f.__defaults__)      # ([],) - stored on the function object`,
        },
      ],
      traps: [
        'Answering `[1] [2] [3]` - the intuitive answer, and wrong.',
        'Thinking it only affects lists. Dicts and sets behave identically.',
      ],
      followUps: [
        'When are default arguments evaluated?',
        'Why is `None` the conventional sentinel rather than an empty list?',
        'Does this affect immutable defaults?',
      ],
      tags: ['gotchas', 'functions', 'mutability'],
    },
    {
      id: 'itv-py-2',
      level: 'basic',
      kind: 'open',
      prompt: 'How do you read a large log file in Python without running out of memory?',
      probing:
        'A DevOps-flavoured question about iterators. `read()` on a 10GB file is a real mistake people make.',
      answer: [
        'The key is to **iterate** rather than load. A file object is itself an iterator over lines, so `for line in f:` reads one line at a time and never holds more than a buffer in memory.',
        '`f.read()` loads the entire file into a single string, and `f.readlines()` loads every line into a list. On a 10 GB log both will exhaust memory.',
        'I would also use a `with` block, which closes the file even if an exception is raised part-way through - that matters in a long-running process where leaked file descriptors accumulate.',
        'If I need to transform as I go, a **generator function** keeps the whole pipeline lazy: each stage pulls one item at a time, so memory stays constant regardless of file size.',
      ],
      code: [
        {
          title: 'The wrong way, the right way, and a lazy pipeline',
          language: 'python',
          code: `# WRONG - loads 10GB into memory
with open("app.log") as f:
    content = f.read()
    for line in content.splitlines():
        ...

# RIGHT - one line at a time, constant memory
with open("app.log") as f:
    for line in f:
        if "ERROR" in line:
            print(line.rstrip())

# A lazy pipeline: each stage yields, nothing accumulates
import re
from collections import Counter

def read_lines(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        yield from f

def only_errors(lines):
    for line in lines:
        if "ERROR" in line:
            yield line

def extract_codes(lines):
    pattern = re.compile(r"status=(\\d{3})")
    for line in lines:
        match = pattern.search(line)
        if match:
            yield match.group(1)

# Nothing is read until Counter starts consuming.
counts = Counter(extract_codes(only_errors(read_lines("app.log"))))
print(counts.most_common(5))`,
        },
      ],
      deeper: [
        '`errors="replace"` is worth mentioning for log processing: real log files often contain a stray non-UTF-8 byte, and the default would raise `UnicodeDecodeError` half way through a long job.',
        'For a file being actively written to - following a log - you loop with `f.readline()` and sleep when it returns empty, which is the `tail -f` pattern.',
      ],
      traps: [
        'Using `readlines()` and thinking it is lazy. It builds the whole list.',
        'Forgetting `with`, so the file stays open if an exception occurs.',
      ],
      followUps: [
        'What is the difference between a list comprehension and a generator expression?',
        'How would you implement `tail -f`?',
        'Why use a generator rather than returning a list?',
      ],
      tags: ['files', 'generators', 'memory'],
    },
    {
      id: 'itv-py-3',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How do you call a shell command from Python safely?',
      probing:
        'Very common in DevOps scripts, and `shell=True` with interpolation is a genuine security hole.',
      answer: [
        'The modern answer is `subprocess.run()`. I pass the command as a **list of arguments**, set `check=True` so a non-zero exit raises, and `capture_output=True` with `text=True` to get strings back rather than bytes.',
        'The list form matters for security. With a list, the arguments are passed directly to `execve` and **no shell is involved**, so shell metacharacters in a value are just data. With `shell=True` and an f-string, a value containing `; rm -rf /` is executed.',
        'So the rule is: never combine `shell=True` with any input you did not write yourself. If you genuinely need shell features - a pipe, a glob, a redirect - either use `shell=True` with a fully hard-coded string, or better, do the piping in Python.',
        '`check=True` is the other important habit. Without it a failed command returns quietly and the script carries on as though it worked, which is how a deploy script "succeeds" having done nothing.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'How should I run this command?',
          caption:
            'The list form is the default. Reaching for shell=True should be a deliberate, justified choice.',
          question: 'What does the command involve?',
          branches: [
            {
              condition: 'a fixed command with arguments',
              result: 'subprocess.run([...], check=True)',
              detail: 'No shell. Metacharacters in values are harmless.',
              tone: 'accent',
            },
            {
              condition: 'any value comes from outside your code',
              result: 'List form, always',
              detail: 'shell=True here is a command-injection hole',
              tone: 'danger',
            },
            {
              condition: 'you need a pipe between two commands',
              result: 'Two Popen objects, or do it in Python',
              detail: 'Usually the Python version is clearer anyway',
            },
            {
              condition: 'there is a library for it',
              result: 'Use the library',
              detail: 'boto3 rather than shelling out to the aws CLI',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Safe, unsafe, and the patterns worth knowing',
          language: 'python',
          code: `import subprocess

# SAFE - list form, no shell, raises on failure
result = subprocess.run(
    ["kubectl", "get", "pods", "-n", namespace, "-o", "json"],
    check=True,
    capture_output=True,
    text=True,
    timeout=30,
)
pods = json.loads(result.stdout)

# UNSAFE - a shell is involved and namespace is interpolated
# namespace = "default; rm -rf /"  would execute both commands.
subprocess.run(f"kubectl get pods -n {namespace}", shell=True)

# Handling failure explicitly rather than crashing
try:
    subprocess.run(["terraform", "plan", "-detailed-exitcode"], check=True)
except subprocess.CalledProcessError as exc:
    if exc.returncode == 2:
        print("changes pending")       # 2 is not an error for plan
    else:
        raise
except subprocess.TimeoutExpired:
    print("timed out")

# Streaming output from a long-running command
with subprocess.Popen(
    ["ansible-playbook", "site.yml"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
) as proc:
    for line in proc.stdout:
        print(line, end="")
if proc.returncode != 0:
    raise SystemExit(proc.returncode)`,
        },
      ],
      traps: [
        'Using `shell=True` with an f-string. This is command injection, and it is extremely common in internal tooling.',
        'Omitting `check=True`, so failures pass silently.',
        'Omitting `timeout`, so a hung command hangs your automation forever.',
      ],
      followUps: [
        'Why is the list form safer?',
        'How would you handle a command that legitimately returns non-zero?',
        'When would you use a library instead of shelling out?',
      ],
      tags: ['subprocess', 'security', 'automation'],
    },
    {
      id: 'itv-py-4',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Write a function that calls a REST API with retries and handles failures properly.',
      probing:
        'The most common DevOps coding exercise. They want retries with backoff, timeouts and specific exception handling.',
      answer: [
        'The essentials are: a **timeout** on every request, **retry only on retryable failures**, **exponential backoff with jitter**, a **cap** on attempts, and raising a clear error when it finally gives up.',
        'Retryable means connection errors, timeouts, 429 and 5xx. A 400 or 404 will never succeed on retry, so retrying them just wastes time and hides the real problem.',
        'Backoff should be exponential - 1s, 2s, 4s - with **jitter** added. Without jitter, every client that failed at the same moment retries at the same moment, which is the thundering-herd problem that keeps a struggling service down.',
        'A timeout is non-negotiable. `requests` has **no default timeout**, so a hung server hangs your script indefinitely - this is the single most common bug in scripts like this.',
        'In production I would use `urllib3`’s `Retry` via a mounted `HTTPAdapter` rather than hand-rolling, because it handles `Retry-After` headers and connection-level retries correctly.',
      ],
      code: [
        {
          title: 'Hand-rolled, so the logic is visible',
          language: 'python',
          code: `import random
import time
import requests

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def fetch(url, *, token=None, attempts=5, timeout=10):
    """GET a URL, retrying transient failures with exponential backoff."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    last_error = None

    for attempt in range(attempts):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)

            # Success
            if response.ok:
                return response.json()

            # Not retryable - fail immediately rather than wasting 5 attempts
            if response.status_code not in RETRYABLE_STATUS:
                response.raise_for_status()

            last_error = f"HTTP {response.status_code}"

            # Honour Retry-After if the server sent one
            retry_after = response.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                time.sleep(int(retry_after))
                continue

        except (requests.ConnectionError, requests.Timeout) as exc:
            last_error = repr(exc)

        # Exponential backoff with jitter, but not on the last attempt
        if attempt < attempts - 1:
            delay = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)

    raise RuntimeError(f"{url} failed after {attempts} attempts: {last_error}")`,
        },
        {
          title: 'The production version - let the library do it',
          language: 'python',
          code: `import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def make_session(retries=5, backoff=0.5):
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=backoff,                    # 0.5, 1, 2, 4, 8 seconds
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "PUT", "DELETE", "HEAD", "OPTIONS"],
        respect_retry_after_header=True,
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


session = make_session()
response = session.get("https://api.example.com/v1/status", timeout=10)
response.raise_for_status()
data = response.json()`,
        },
      ],
      deeper: [
        'Note that `allowed_methods` deliberately excludes `POST`. Retrying a non-idempotent request can create two resources - so either exclude it, or make the endpoint idempotent with a client-supplied idempotency key.',
        'For anything long-running I would add a **circuit breaker**: after N consecutive failures, stop trying for a period. Retrying forever against a dead dependency turns one outage into a cascading one.',
      ],
      traps: [
        'No timeout. `requests` has no default, so the script can hang forever.',
        'Retrying 4xx errors, which will never succeed.',
        'Backoff without jitter, which synchronises every client into a thundering herd.',
        'Retrying POST by default and creating duplicate resources.',
      ],
      followUps: [
        'Why add jitter?',
        'Why is POST excluded from the retry methods?',
        'What is a circuit breaker and when would you add one?',
      ],
      tags: ['api', 'requests', 'retries', 'resilience'],
    },
    {
      id: 'itv-py-5',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain list comprehensions, dict comprehensions and generators, with examples.',
      probing:
        'Idiomatic Python. Interviewers use this to see whether you write Python or write Java in Python.',
      answer: [
        'A **list comprehension** builds a list from an iterable in one expression: `[f(x) for x in items if cond(x)]`. It is the idiomatic way to transform and filter, and it is faster than an equivalent `for` loop with `append` because the loop runs in C.',
        'A **dict comprehension** is the same shape producing a dict: `{k: v for k, v in pairs}`. A **set comprehension** uses braces without the colon.',
        'A **generator expression** looks identical but with parentheses: `(f(x) for x in items)`. The difference is that it produces items **lazily**, one at a time, instead of building the whole collection. Memory stays constant regardless of input size.',
        'The rule of thumb: use a list comprehension when you need the list - to index it, to iterate more than once, to take its length. Use a generator when you are feeding it straight into something that consumes it once, like `sum()`, `any()`, a `for` loop, or a file write.',
        'And if the comprehension needs more than one condition and a nested loop, write a normal loop instead. Comprehensions stop being clearer at about that point.',
      ],
      code: [
        {
          title: 'All four, and when each fits',
          language: 'python',
          code: `pods = [
    {"name": "api-1", "status": "Running", "restarts": 0},
    {"name": "api-2", "status": "CrashLoopBackOff", "restarts": 12},
    {"name": "web-1", "status": "Running", "restarts": 3},
]

# List comprehension - you want the list
unhealthy = [p["name"] for p in pods if p["status"] != "Running"]
# ['api-2']

# Dict comprehension - a lookup table
restarts_by_name = {p["name"]: p["restarts"] for p in pods}
# {'api-1': 0, 'api-2': 12, 'web-1': 3}

# Set comprehension - unique values
statuses = {p["status"] for p in pods}
# {'Running', 'CrashLoopBackOff'}

# Generator expression - consumed once, nothing built in memory
total_restarts = sum(p["restarts"] for p in pods)
has_crash = any(p["status"] == "CrashLoopBackOff" for p in pods)

# The memory difference is the whole point:
#   sum([x * x for x in range(10_000_000)])   builds a 10M-element list
#   sum(x * x for x in range(10_000_000))     builds nothing

# TOO CLEVER - write a loop instead
result = [transform(x) for sub in matrix for x in sub
          if x > 0 and validate(x) and x not in seen]`,
        },
      ],
      traps: [
        'Using a list comprehension purely for side effects. `[print(x) for x in items]` builds a throwaway list of `None`; use a plain loop.',
        'Consuming a generator twice. After the first pass it is exhausted and the second yields nothing - a genuinely confusing bug.',
      ],
      followUps: [
        'What happens if you iterate a generator twice?',
        'When is a plain for loop clearer?',
        'What is the memory difference in practice?',
      ],
      tags: ['idioms', 'comprehensions', 'generators'],
    },
    {
      id: 'itv-py-6',
      level: 'advanced',
      kind: 'open',
      prompt:
        'Write a script that parses a log file and reports the top 5 IPs by request count. Walk me through your approach.',
      probing:
        'The classic live-coding exercise. They are watching for streaming, `Counter`, and handling malformed lines.',
      answer: [
        'My approach is to **stream** the file, parse each line defensively, count with `collections.Counter`, and report with `most_common`.',
        'Streaming because a production log can be gigabytes - `Counter` only ever holds one entry per unique IP, so memory stays bounded by cardinality rather than by file size.',
        '`Counter` because it is purpose-built: it handles the "increment or initialise" case, and `most_common(5)` does the sort-and-limit in one call, using a heap rather than a full sort.',
        'Defensive parsing because real logs have malformed lines - truncated writes, a different format from an old version, or a binary blob. A single unhandled line should not kill a job that has processed two million others, so I skip and count them.',
        'I would use a **compiled regex** outside the loop, since compiling it per line on a large file is a measurable cost.',
      ],
      code: [
        {
          title: 'The full script',
          language: 'python',
          code: `#!/usr/bin/env python3
"""Report the top N client IPs in an access log."""

import argparse
import re
import sys
from collections import Counter

# Compiled ONCE, not per line.
LINE = re.compile(
    r'^(?P<ip>\\S+) \\S+ \\S+ \\[(?P<time>[^\\]]+)\\] '
    r'"(?P<method>\\S+) (?P<path>\\S+)[^"]*" '
    r'(?P<status>\\d{3}) (?P<size>\\S+)'
)


def count_ips(path, status_filter=None):
    counts = Counter()
    malformed = 0

    with open(path, encoding="utf-8", errors="replace") as handle:
        for line in handle:                     # streaming, constant memory
            match = LINE.match(line)
            if not match:
                malformed += 1                   # skip, do not crash
                continue
            if status_filter and match.group("status") != status_filter:
                continue
            counts[match.group("ip")] += 1

    return counts, malformed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("logfile")
    parser.add_argument("-n", "--top", type=int, default=5)
    parser.add_argument("--status", help="only count this status code")
    args = parser.parse_args()

    try:
        counts, malformed = count_ips(args.logfile, args.status)
    except FileNotFoundError:
        sys.exit(f"No such file: {args.logfile}")
    except PermissionError:
        sys.exit(f"Cannot read: {args.logfile}")

    if not counts:
        sys.exit("No matching lines found.")

    total = sum(counts.values())
    print(f"{total:,} requests from {len(counts):,} unique IPs")
    if malformed:
        print(f"({malformed:,} malformed lines skipped)")
    print()

    width = max(len(ip) for ip, _ in counts.most_common(args.top))
    for ip, n in counts.most_common(args.top):
        print(f"{ip:<{width}}  {n:>8,}  {n / total:6.1%}")


if __name__ == "__main__":
    main()`,
        },
        {
          title: 'Variations they often ask for next',
          language: 'python',
          code: `# Group by minute, to find a traffic spike
from collections import defaultdict
per_minute = defaultdict(Counter)
per_minute[timestamp[:16]][ip] += 1

# Top IPs by ERROR count specifically - the usual follow-up
errors = Counter(
    m.group("ip")
    for m in (LINE.match(line) for line in handle)
    if m and m.group("status").startswith("5")
)

# Bytes transferred per IP rather than request count
traffic = Counter()
traffic[ip] += int(size) if size.isdigit() else 0

# If the log is JSON lines, skip the regex entirely
import json
for line in handle:
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        malformed += 1
        continue
    counts[event["remote_addr"]] += 1`,
        },
      ],
      deeper: [
        'If asked to scale it further: `Counter` is bounded by **unique IPs**, which for a busy public site could be millions. At that point you either accept the memory, or use a probabilistic structure like count-min sketch, or push the aggregation into a system built for it - which in practice usually means the answer is "this belongs in Splunk or a data warehouse, not a Python script".',
        'On performance: for very large files, reading in binary mode and avoiding the decode can be noticeably faster, and `re` is usually the bottleneck - a simple `line.split()` where the format allows is several times quicker than a regex.',
      ],
      traps: [
        'Reading the whole file into memory first.',
        'No handling for malformed lines, so one bad line kills a long job.',
        'Compiling the regex inside the loop.',
        'Sorting the whole dict when `most_common(n)` uses a heap and is cheaper.',
      ],
      followUps: [
        'How would you handle a 50GB file?',
        'What if the log is JSON lines?',
        'How would you find a traffic spike rather than a total?',
      ],
      tags: ['coding exercise', 'parsing', 'collections', 'cli'],
    },
    {
      id: 'itv-py-7',
      level: 'advanced',
      kind: 'multi',
      prompt: 'Which of these are true about Python error handling? (Select all that apply.)',
      options: [
        { id: 'a', text: 'A bare `except:` also catches KeyboardInterrupt and SystemExit' },
        { id: 'b', text: '`finally` runs even if the `try` block returns' },
        { id: 'c', text: 'You can attach an `else` clause to a try/except' },
        { id: 'd', text: '`except Exception` catches everything a bare `except:` does' },
        {
          id: 'e',
          text: 'Raising inside `except` loses the original traceback unless you use `from`',
        },
      ],
      correct: ['a', 'b', 'c'],
      probing: 'Precision about a feature everyone uses. D and E are both subtly wrong.',
      answer: [
        'A, B and C are true. **D and E are both false**, and the reasons are worth knowing.',
        '**A** is why a bare `except:` is discouraged: it catches `BaseException`, which includes `KeyboardInterrupt` and `SystemExit`. Your script then cannot be stopped with Ctrl-C.',
        '**B** is true and occasionally surprising - `finally` runs even when the `try` block executes a `return`, and a `return` in `finally` will override it.',
        '**C** is a genuinely underused feature: `else` runs only if **no** exception was raised. It lets you keep the `try` block down to just the line that might fail, which makes the intent much clearer.',
        '**D is false**: `except Exception` does **not** catch `KeyboardInterrupt` or `SystemExit`, because those inherit from `BaseException` rather than `Exception`. That is exactly why `except Exception` is the right broad catch and a bare `except:` is not.',
        '**E is false** in modern Python: raising inside an `except` block **automatically** chains the original as `__context__`, and the traceback shows "During handling of the above exception, another exception occurred". `raise ... from exc` makes the relationship explicit and changes the wording, but the original is not lost either way. `raise ... from None` is what suppresses it.',
      ],
      code: [
        {
          title: 'The full structure, and chaining',
          language: 'python',
          code: `def load_config(path):
    try:
        handle = open(path)
    except FileNotFoundError:
        raise ConfigError(f"No config at {path}") from None   # suppress chain
    except PermissionError as exc:
        raise ConfigError(f"Cannot read {path}") from exc      # explicit chain
    else:
        # Runs ONLY if no exception - keeps the try block minimal
        with handle:
            return json.load(handle)
    finally:
        # Runs on every path, including a return from try or except
        logging.debug("load_config finished for %s", path)


# Bare except: catches Ctrl-C. Almost never what you want.
try:
    long_running()
except:                    # noqa - catches BaseException
    pass                   # you can no longer interrupt this

# The correct broad catch - leaves KeyboardInterrupt alone
try:
    long_running()
except Exception:
    logging.exception("failed")     # logs the full traceback
    raise`,
        },
      ],
      traps: [
        'Using a bare `except:` and making a script un-interruptible.',
        'Using `logging.error(exc)` instead of `logging.exception(...)`, which drops the traceback.',
        'Wrapping a large block in `try`, so it is unclear which line was expected to fail.',
      ],
      followUps: [
        'When would you use `raise ... from None`?',
        'What is the difference between logging.error and logging.exception?',
        'Why is `else` on a try block useful?',
      ],
      tags: ['exceptions', 'error handling', 'idioms'],
    },
    {
      id: 'itv-py-8',
      level: 'advanced',
      kind: 'open',
      prompt: 'Explain the GIL and its implications for DevOps automation scripts.',
      probing:
        'A senior question. They want to know you can choose correctly between threads, processes and async.',
      answer: [
        'The **Global Interpreter Lock** means only one thread executes Python bytecode at a time in a CPython process. So threads do not give you parallel CPU execution - a CPU-bound task running on four threads is no faster than on one, and often slightly slower.',
        'The crucial exception is that the GIL is **released during I/O**. While a thread is waiting on a network response, a disk read or a subprocess, another thread runs. So for **I/O-bound** work - which is almost all DevOps automation - threads genuinely do help.',
        'That gives a simple decision rule. **I/O-bound** (API calls, file transfers, waiting on kubectl): use threads via `ThreadPoolExecutor`, or `asyncio` for very high concurrency. **CPU-bound** (parsing gigabytes, compression, cryptography): use `ProcessPoolExecutor`, which sidesteps the GIL by using separate processes with separate interpreters.',
        'In practice, DevOps scripts are overwhelmingly I/O-bound, so `ThreadPoolExecutor` is the right default. Checking 500 endpoints sequentially takes minutes; with 20 threads it takes seconds.',
        'Worth noting that Python 3.13 introduced an experimental free-threaded build without the GIL, so this may become a historical constraint - but as of now the rule above is what applies.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Threads, processes or async?',
          caption:
            'The question is only ever "is this waiting, or computing?". DevOps work is nearly always waiting.',
          question: 'What is the work actually doing?',
          branches: [
            {
              condition: 'waiting on network, disk or subprocesses',
              result: 'ThreadPoolExecutor',
              detail: 'The GIL is released during I/O, so threads work well',
              tone: 'accent',
            },
            {
              condition: 'thousands of concurrent connections',
              result: 'asyncio',
              detail: 'One thread, no per-thread stack cost',
            },
            {
              condition: 'CPU-bound: parsing, compressing, hashing',
              result: 'ProcessPoolExecutor',
              detail: 'Separate interpreters, real parallelism',
            },
            {
              condition: 'you are not sure',
              result: 'Measure first',
              detail: 'Guessing wrong here makes it slower, not faster',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The same job, three ways',
          language: 'python',
          code: `from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import requests

URLS = [f"https://api{i}.example.com/health" for i in range(500)]


def check(url):
    try:
        r = requests.get(url, timeout=5)
        return url, r.status_code
    except requests.RequestException as exc:
        return url, repr(exc)


# I/O-BOUND -> threads. 500 checks in a couple of seconds.
with ThreadPoolExecutor(max_workers=20) as pool:
    futures = {pool.submit(check, u): u for u in URLS}
    for future in as_completed(futures):
        url, status = future.result()
        if status != 200:
            print(f"{url}: {status}")


# CPU-BOUND -> processes. Threads would not help at all here.
def count_errors(path):
    with open(path) as f:
        return path, sum(1 for line in f if "ERROR" in line)

with ProcessPoolExecutor() as pool:
    for path, n in pool.map(count_errors, log_files):
        print(f"{path}: {n}")


# Very high concurrency -> asyncio
import asyncio, aiohttp

async def check_async(session, url):
    try:
        async with session.get(url, timeout=5) as r:
            return url, r.status
    except Exception as exc:
        return url, repr(exc)

async def main():
    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(*(check_async(session, u) for u in URLS))
    return results

asyncio.run(main())`,
        },
      ],
      traps: [
        'Using threads for CPU-bound work and being surprised there is no speed-up.',
        'Using processes for I/O-bound work - it works, but process startup and pickling overhead make it slower than threads.',
        'Setting `max_workers` very high. For HTTP you are usually limited by the remote service or connection pool, and hundreds of threads just add contention.',
      ],
      followUps: [
        'Why does the GIL not prevent threads helping with I/O?',
        'When would you pick asyncio over threads?',
        'What changed in Python 3.13?',
      ],
      tags: ['concurrency', 'gil', 'threading', 'performance'],
    },
  ],
}
