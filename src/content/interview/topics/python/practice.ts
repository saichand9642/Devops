import type { InterviewQuestion } from '../../../types'

/** The remaining Python ground: idioms, data handling and code you would review. */
export const pythonPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-py-34',
    level: 'basic',
    kind: 'open',
    prompt: 'What are list comprehensions and when should you not use one?',
    probing: 'An idiom people either overuse or avoid entirely.',
    answer: [
      'A comprehension builds a list, dict or set from an iterable in one expression: `[x * 2 for x in values if x > 0]`. It is more concise than the equivalent loop, and usually faster because the looping happens in C rather than in bytecode.',
      'They are right for a **simple transformation or filter**. They are wrong once the logic needs more than a condition and an expression - a comprehension with two conditions, a nested loop and a ternary is harder to read than the four-line loop it replaces, and the point of the idiom was readability.',
      'The other case to avoid is when you need **side effects**. A comprehension whose purpose is to call a function and discard the result builds a list of `None` for no reason; a plain `for` loop is clearer and does not allocate.',
      'And for **large data**, a **generator expression** - round brackets rather than square - produces items lazily instead of building the whole list in memory. For a pipeline over a large file that is the difference between constant memory and an OOM.',
    ],
    code: [
      {
        title: 'Good, and past the point of usefulness',
        language: 'python',
        code: `# Clear
healthy = [h for h in hosts if h.status == "healthy"]
by_name = {h.name: h for h in hosts}
regions = {h.region for h in hosts}

# Past the point - use a loop
result = [transform(x) if x.valid else fallback(x)
          for group in groups
          for x in group.items
          if x.enabled and x.region in allowed and not x.deprecated]

# Side effects - a loop, not a comprehension
for host in hosts:
    notify(host)                    # not: [notify(h) for h in hosts]

# Generator expression - lazy, constant memory
total = sum(len(line) for line in open("huge.log"))`,
      },
    ],
    traps: [
      'Comprehensions used for side effects, allocating a list of `None`.',
      'Nesting until it is less readable than the loop.',
      'Building a huge list where a generator would use constant memory.',
    ],
    followUps: ['When would you use a generator expression instead?'],
    tags: ['comprehensions', 'generators', 'readability', 'fundamentals'],
  },
  {
    id: 'itv-py-35',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is the difference between a module, a package and `__init__.py`?',
    probing: 'Code organisation and import mechanics.',
    answer: [
      'A **module** is a single `.py` file. A **package** is a directory containing modules, which can be imported as a namespace - `from mypackage.submodule import thing`.',
      "`__init__.py` marks a directory as a package and runs when the package is first imported. Since Python 3.3 it is **optional** - a directory without one is a namespace package and can still be imported - but including it is still the normal choice, because it gives you a place to define the package's public interface and it avoids some subtle behaviour with namespace packages.",
      'What to put in it: re-exports that define the public API, so callers write `from mypackage import Client` rather than reaching into the internal module layout. What **not** to put in it: expensive work. Anything at module level in `__init__.py` runs on every import of anything in the package, so a network call or a large data load there makes every import slow.',
      'The import problem people hit is **circular imports** - module A imports B, B imports A. The usual causes are a layering mistake, and the usual fixes are to extract the shared thing into a third module, or to move the import inside the function where it is used so it happens at call time rather than import time.',
    ],
    code: [
      {
        title: 'Package layout and a useful __init__.py',
        language: 'text',
        code: `src/acme_deploy/
├── __init__.py         # public API: from .client import Client
├── cli.py              # entry point
├── client.py
├── config.py
└── providers/
    ├── __init__.py
    ├── aws.py
    └── gcp.py

# __init__.py
from .client import Client
from .config import Settings

__all__ = ["Client", "Settings"]
__version__ = "1.4.2"`,
      },
      {
        title: 'Breaking a circular import',
        language: 'python',
        code: `# Circular: client.py imports config.py, config.py imports client.py

# Fix 1: extract the shared thing into its own module
# types.py holds what both need; neither imports the other.

# Fix 2: import inside the function, deferring it to call time
def get_client():
    from .client import Client      # not at module level
    return Client()`,
      },
    ],
    traps: [
      'Expensive work at module level in `__init__.py`, slowing every import.',
      'Circular imports fixed by moving imports around rather than by fixing the layering.',
      'Relying on implicit relative imports, which Python 3 removed.',
    ],
    followUps: ['How would you fix a circular import properly?'],
    tags: ['modules', 'packages', 'imports', 'structure', 'fundamentals'],
  },
  {
    id: 'itv-py-36',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does this print?',
    promptCode: [
      {
        title: 'Exception handling order',
        language: 'python',
        code: `def f():
    try:
        return "try"
    finally:
        print("finally")

print(f())`,
      },
    ],
    probing: 'The interaction between `return` and `finally`, which surprises people.',
    options: [
      { id: 'a', text: '"finally" then "try"' },
      { id: 'b', text: '"try" then "finally"' },
      { id: 'c', text: 'Only "try"' },
      { id: 'd', text: 'Only "finally"' },
    ],
    correct: ['a'],
    answer: [
      'The `finally` block runs **before the function actually returns**. The return value is computed, then `finally` executes, then the value is returned to the caller. So `"finally"` is printed first, and then `print(f())` prints `"try"`.',
      'This is the guarantee that makes `finally` useful: it runs on every exit path - normal return, early return, exception, even `break` or `continue` out of a loop.',
      'The trap worth knowing is that a **`return` inside `finally` overrides** the original return value and **swallows any in-flight exception**. A function that raises in `try` and returns in `finally` returns normally, and the exception vanishes without trace - which is extremely confusing to debug.',
      'The practical rule: use `finally` for cleanup only, and never return or raise from it.',
    ],
    code: [
      {
        title: 'The trap',
        language: 'python',
        code: `def bad():
    try:
        raise ValueError("something went wrong")
    finally:
        return "ok"          # swallows the exception entirely

print(bad())                 # "ok" - the ValueError has vanished

# Correct: cleanup only
def good():
    resource = acquire()
    try:
        return resource.do_work()
    finally:
        resource.release()   # always runs; does not affect the result`,
      },
    ],
    traps: [
      '`return` in a `finally` block, silently discarding an exception.',
      'Assuming `finally` runs after the caller receives the value. It runs before.',
      'Cleanup outside `finally`, so it is skipped on the exception path.',
    ],
    followUps: ['What happens if you raise in `try` and return in `finally`?'],
    tags: ['exceptions', 'finally', 'gotchas', 'control flow'],
  },
  {
    id: 'itv-py-37',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you process data with pandas, and when is it the wrong tool?',
    probing: 'Data handling for reporting tasks, with a sense of when it is overkill.',
    answer: [
      'pandas gives you a DataFrame - a table with named, typed columns - and vectorised operations over it. For **aggregation, joining, reshaping and time series** work it is enormously more concise and faster than hand-written loops.',
      'The DevOps uses: turning a CSV export of cloud costs into a report, aggregating log-derived metrics, joining an inventory against a scan result, computing per-team summaries. Anything that is essentially a spreadsheet operation on more rows than a spreadsheet handles well.',
      'It is the **wrong** tool when the data is small - the import alone costs a noticeable fraction of a second, and a dict comprehension over 200 rows is simpler and faster. It is also wrong when the data does not fit in memory, since pandas loads the whole frame; **Polars** handles larger data with a similar API and better memory behaviour, and **DuckDB** lets you query files directly with SQL without loading them at all.',
      'The performance point worth knowing: **vectorised operations, not `iterrows`**. Looping over a DataFrame row by row is typically one to two orders of magnitude slower than the equivalent column operation, and it is the most common reason pandas code is unexpectedly slow.',
    ],
    code: [
      {
        title: 'A cost report, vectorised',
        language: 'python',
        code: `import pandas as pd

df = pd.read_csv("cost-export.csv", parse_dates=["date"])

# Vectorised - fast
df["cost_gbp"] = df["cost_usd"] * 0.79
monthly = (
    df.groupby([pd.Grouper(key="date", freq="ME"), "team", "service"])["cost_gbp"]
      .sum()
      .reset_index()
)

# Month-on-month change per team
pivot = monthly.pivot_table(index="team", columns="date", values="cost_gbp", aggfunc="sum")
change = pivot.pct_change(axis=1).iloc[:, -1].mul(100).round(1)
print(change.sort_values(ascending=False).head(10))`,
      },
      {
        title: 'The pattern to avoid, and the alternatives',
        language: 'python',
        code: `# SLOW - row-by-row iteration, often 100x slower
for idx, row in df.iterrows():
    df.at[idx, "cost_gbp"] = row["cost_usd"] * 0.79

# FAST - the whole column at once
df["cost_gbp"] = df["cost_usd"] * 0.79

# Too large for memory? Query the file directly with SQL
import duckdb
result = duckdb.sql("""
    SELECT team, service, SUM(cost_usd) AS total
    FROM 'cost-export-*.parquet'
    WHERE date >= '2026-08-01'
    GROUP BY team, service ORDER BY total DESC
""").df()`,
      },
    ],
    traps: [
      '`iterrows` in a loop where a vectorised operation would do.',
      'pandas imported for 50 rows of data, where a dict would be simpler.',
      'Loading a file larger than memory.',
      'Chained assignment producing a `SettingWithCopyWarning` and silently not modifying the frame.',
    ],
    followUps: [
      'Why is `iterrows` so slow?',
      'What would you use for data that does not fit in memory?',
    ],
    tags: ['pandas', 'data processing', 'performance', 'reporting'],
  },
  {
    id: 'itv-py-38',
    level: 'advanced',
    kind: 'open',
    prompt: 'You are reviewing a colleague’s automation script. What do you look for?',
    probing: 'Code review judgement for operational code specifically - a good senior signal.',
    answer: [
      'I would look at it in roughly this order, because the early items are the ones that cause incidents.',
      '**Failure behaviour.** What happens when something goes wrong halfway through? Is the exit code non-zero? Is there cleanup on the failure path, or only on success? Is a partial run safe to retry, or does it double-apply changes? This is where operational scripts most often fall down.',
      '**Blast radius.** What does it touch, and is there anything limiting that? A script that iterates over every host with no batching, no confirmation and no dry-run is one typo away from an outage.',
      '**Security.** Secrets in the source or in arguments rather than the environment. `shell=True` with interpolated values. `yaml.load` without a safe loader. Overly broad credentials.',
      '**Correctness details** that are easy to miss: pagination handled, timeouts on every network call and subprocess, `check=True` on subprocesses, mutable default arguments.',
      '**Readability**: names that say what things are, functions small enough to follow, and the logic separated from the I/O so it is testable at all.',
      'And the question I would ask the author rather than infer: **has this been run anywhere other than their machine?** A script that has only ever run interactively usually has assumptions about the environment baked into it that fail the first time CI runs it.',
    ],
    code: [
      {
        title: 'The kinds of thing I would comment on',
        language: 'python',
        code: `# 1. No timeout - will hang forever
requests.get(url)                            -> requests.get(url, timeout=(5, 30))

# 2. Failure silently ignored
subprocess.run(["./deploy.sh"])              -> subprocess.run([...], check=True)

# 3. Command injection
subprocess.run(f"rm -rf {path}", shell=True) -> subprocess.run(["rm", "-rf", path])

# 4. Secret in an argument, visible in the process list
subprocess.run(["curl", "-H", f"Auth: {token}", url])
                                             -> pass it via env or stdin

# 5. Mutable default
def collect(items=[]):                       -> def collect(items=None):

# 6. Only the first page is processed
for item in client.list_things()["Items"]:   -> use the paginator

# 7. Exits zero on failure
except Exception: log.error(...)             -> log.exception(...); sys.exit(1)

# 8. No blast radius control
for host in all_hosts: restart(host)         -> batch, confirm, --dry-run`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Review order for an operational script',
        caption: 'The first two cause incidents; the rest cause bugs. Review them in that order.',
        nodes: [
          {
            label: 'What happens on failure?',
            detail: 'Exit code, cleanup, retry safety',
            tone: 'danger',
          },
          {
            label: 'What is the blast radius?',
            detail: 'Batching, confirmation, dry-run',
            tone: 'danger',
          },
          {
            label: 'Secrets and injection',
            detail: 'shell=True, args, yaml.load',
            tone: 'warning',
          },
          { label: 'Correctness details', detail: 'Pagination, timeouts, check=True' },
          { label: 'Readability and testability', detail: 'Logic separated from I/O' },
          { label: 'Has it run outside a laptop?', tone: 'accent' },
        ],
      },
    ],
    traps: [
      'Reviewing style and missing that the script exits zero on failure.',
      'Approving something with no dry-run that modifies production.',
      "Not asking whether it has been run anywhere other than the author's machine.",
    ],
    followUps: [
      'What is the single thing you would always check?',
      'How would you test a script like this before it runs in production?',
    ],
    tags: ['code review', 'quality', 'security', 'production', 'advanced'],
  },
  {
    id: 'itv-py-39',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you work with dates and times correctly?',
    probing: 'Timezone handling, which is a persistent source of real bugs.',
    answer: [
      'The rule that avoids most problems: **store and compute in UTC, convert to local only for display**. A timestamp without a timezone is ambiguous, and comparing two of them from different machines is meaningless.',
      'In Python that means using **timezone-aware** datetimes. `datetime.now()` returns a **naive** datetime with no timezone attached, which is the default and is almost always wrong for anything operational. `datetime.now(timezone.utc)` is the correct form.',
      'Comparing an aware and a naive datetime raises a `TypeError`, which is Python being helpful - but code that is consistently naive compiles fine and is quietly wrong across a daylight saving boundary.',
      'For **timezone conversion**, `zoneinfo` is in the standard library since 3.9 and uses the system timezone database, so it handles daylight saving correctly. Never do timezone arithmetic by adding hours.',
      'For **formatting and parsing**, ISO 8601 with `isoformat()` and `fromisoformat()` round-trips unambiguously. Log timestamps should be ISO 8601 with an offset, for exactly that reason.',
    ],
    code: [
      {
        title: 'Aware datetimes, and converting for display',
        language: 'python',
        code: `from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

# WRONG - naive, no timezone, ambiguous
now = datetime.now()

# RIGHT - explicit UTC
now = datetime.now(timezone.utc)

# Display in a local timezone, handling DST correctly
london = now.astimezone(ZoneInfo("Europe/London"))
print(london.isoformat())        # 2026-09-16T15:23:01.482+01:00

# Arithmetic in UTC, which has no DST discontinuities
deadline = now + timedelta(hours=4)

# Round-trip unambiguously
s = now.isoformat()
parsed = datetime.fromisoformat(s)
assert parsed == now`,
      },
      {
        title: 'The classic bug',
        language: 'python',
        code: `# A daily job that adds 24 hours to get "the same time tomorrow"
# breaks twice a year on a DST boundary in a local timezone.

# In UTC this is always correct - UTC has no DST
next_run = datetime.now(timezone.utc) + timedelta(days=1)

# If you genuinely need "the same wall-clock time tomorrow", convert
# to the local zone, add, and convert back - zoneinfo handles the shift.`,
      },
    ],
    traps: [
      '`datetime.now()` without a timezone, producing naive values.',
      'Timezone conversion by adding hours, which ignores daylight saving.',
      'Storing local times in a database, making comparison across regions impossible.',
      '`utcnow()`, which returns a **naive** datetime despite the name - a genuinely misleading API, now deprecated.',
    ],
    followUps: [
      'Why is `datetime.utcnow()` a trap?',
      'What breaks in a daily job that adds 24 hours in local time?',
    ],
    tags: ['datetime', 'timezones', 'zoneinfo', 'gotchas', 'fundamentals'],
  },
  {
    id: 'itv-py-40',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you write a script that interacts with the Kubernetes API?',
    probing: 'A common DevOps task, with the practical details.',
    answer: [
      'The official `kubernetes` client handles authentication, the API surface and watching. It loads configuration either from a kubeconfig file (`load_kube_config`) when running outside the cluster, or from the mounted service account (`load_incluster_config`) when running as a pod - and a script that tries both in order works in either place.',
      'The API surface is split by group: `CoreV1Api` for pods, services and configmaps; `AppsV1Api` for deployments and statefulsets; `BatchV1Api` for jobs. Knowing which group a resource is in is most of the learning curve.',
      'The details that matter operationally. **Pagination**: list calls return a limited number with a continue token, and ignoring it silently gives you a partial result. **Watch** rather than poll for anything reactive - `watch.Watch().stream()` gives you events as they happen, with far less API server load than polling in a loop. And **retry on conflict**: an update can fail with a 409 if the resource changed since you read it, which is normal and should be retried with a fresh read.',
      'And for anything the script **creates**, set **owner references** or use labels consistently, so resources can be found and cleaned up later rather than becoming orphans nobody dares delete.',
    ],
    code: [
      {
        title: 'Works inside and outside the cluster, with pagination',
        language: 'python',
        code: `from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException
import logging

log = logging.getLogger(__name__)

try:
    config.load_incluster_config()       # running as a pod
except config.ConfigException:
    config.load_kube_config()            # running on a laptop

v1 = client.CoreV1Api()


def all_pods(namespace: str) -> list:
    """Follow pagination - a plain list_ call returns only the first page."""
    pods, token = [], None
    while True:
        resp = v1.list_namespaced_pod(namespace, limit=200, _continue=token)
        pods.extend(resp.items)
        token = resp.metadata._continue
        if not token:
            return pods


for pod in all_pods("prod"):
    for cs in pod.status.container_statuses or []:
        if cs.restart_count > 5:
            log.warning("%s/%s restarted %d times",
                        pod.metadata.name, cs.name, cs.restart_count)`,
      },
      {
        title: 'Watch rather than poll, and retry on conflict',
        language: 'python',
        code: `# React to events as they happen - far cheaper than polling
w = watch.Watch()
for event in w.stream(v1.list_namespaced_event, namespace="prod", timeout_seconds=0):
    obj = event["object"]
    if obj.type == "Warning" and obj.reason in {"Failed", "BackOff", "Unhealthy"}:
        log.warning("%s: %s - %s", obj.involved_object.name, obj.reason, obj.message)


# A 409 conflict is normal - re-read and retry
from tenacity import retry, retry_if_exception, stop_after_attempt

def is_conflict(exc): return isinstance(exc, ApiException) and exc.status == 409

@retry(retry=retry_if_exception(is_conflict), stop=stop_after_attempt(5))
def scale(name: str, namespace: str, replicas: int) -> None:
    apps = client.AppsV1Api()
    dep = apps.read_namespaced_deployment(name, namespace)   # fresh read each attempt
    dep.spec.replicas = replicas
    apps.replace_namespaced_deployment(name, namespace, dep)`,
      },
    ],
    traps: [
      'Ignoring pagination, silently processing only the first page of pods.',
      'Polling in a loop where a watch would do, loading the API server.',
      'Not handling 409 conflicts, so concurrent updates fail intermittently.',
      'Creating resources with no owner references, leaving orphans.',
    ],
    followUps: [
      'Why use a watch rather than polling?',
      'What does a 409 conflict mean and how do you handle it?',
    ],
    tags: ['kubernetes', 'api', 'automation', 'pagination', 'watch'],
  },
  {
    id: 'itv-py-41',
    level: 'advanced',
    kind: 'open',
    prompt: 'What is `__slots__`, and when would it matter?',
    probing: 'A memory optimisation that shows depth without being obscure.',
    answer: [
      'By default every Python object has a `__dict__` holding its attributes, which makes attributes dynamic and costs memory - typically a few hundred bytes per instance beyond the data itself.',
      '`__slots__` declares a fixed set of attribute names, so the object uses a compact array instead of a dictionary. That saves a substantial amount of memory - often 40-50% per instance - and makes attribute access marginally faster.',
      'It matters when you have **very many instances**: parsing a million log lines into objects, holding a large in-memory index, or a long-running process with a big cache of small objects. At a thousand instances it is irrelevant; at ten million it is the difference between fitting in memory and not.',
      'The costs: you **cannot add attributes** not in the slots, which is usually the point but occasionally inconvenient. It interacts awkwardly with **inheritance** if a subclass does not also define slots. And you lose `__dict__`, which some libraries and serialisation code expect.',
      'In modern code, `@dataclass(slots=True)` gives you the same benefit with none of the boilerplate, which is usually the better way to reach for it. And if the objects are genuinely just data, a `NamedTuple` or an array of primitives may be better still.',
    ],
    code: [
      {
        title: 'The memory difference at scale',
        language: 'python',
        code: `import sys
from dataclasses import dataclass


@dataclass
class EventNormal:
    timestamp: float
    level: str
    service: str
    message: str


@dataclass(slots=True)
class EventSlots:
    timestamp: float
    level: str
    service: str
    message: str


a = EventNormal(1.0, "ERROR", "api", "failed")
b = EventSlots(1.0, "ERROR", "api", "failed")

print(sys.getsizeof(a) + sys.getsizeof(a.__dict__))   # ~150-200 bytes
print(sys.getsizeof(b))                                # ~70-90 bytes

# At 10 million events that is roughly a gigabyte of difference.`,
      },
    ],
    traps: [
      'Reaching for `__slots__` on a handful of objects, where it achieves nothing and reduces flexibility.',
      'A subclass without slots, which reintroduces `__dict__` and loses the saving.',
      'Code or a library that expects `__dict__` to exist.',
    ],
    followUps: [
      'At what scale does this start to matter?',
      'What would you use instead if the objects are pure data?',
    ],
    tags: ['slots', 'memory', 'dataclasses', 'performance', 'advanced'],
  },
  {
    id: 'itv-py-42',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'Which of these is the correct way to check whether a dictionary key exists before using it?',
    probing: 'Idiomatic Python for a very common operation.',
    options: [
      {
        id: 'a',
        text: '`if key in d:` or `d.get(key, default)` depending on whether you need the branch',
      },
      { id: 'b', text: '`if d.has_key(key):`' },
      { id: 'c', text: '`if d[key] is not None:`' },
      { id: 'd', text: '`try: d[key] except: pass`' },
    ],
    correct: ['a'],
    answer: [
      '`key in d` is the membership test, and `d.get(key, default)` returns a fallback without raising - which is usually what you actually want, because it collapses the check and the access into one expression.',
      '`has_key` was removed in Python 3. `d[key] is not None` raises `KeyError` if the key is absent, which is the very thing you were checking for. And a bare `try/except` around it is heavy-handed and, with a bare `except`, catches far more than `KeyError`.',
      'Two related tools worth knowing. **`collections.defaultdict`** creates a default value on first access, which removes the check entirely for accumulator patterns. And **`d.setdefault(key, [])`** returns the existing value or inserts and returns a default, which is the one-line version of the same idea.',
      'For nested structures, chained `.get()` calls with a default - `d.get("a", {}).get("b")` - avoid a `KeyError` at any level, which is much less code than nested checks.',
    ],
    code: [
      {
        title: 'The idiomatic forms',
        language: 'python',
        code: `# Need a branch
if "timeout" in config:
    apply_timeout(config["timeout"])

# Just need a value with a fallback - usually this
timeout = config.get("timeout", 30)

# Accumulating - defaultdict removes the check entirely
from collections import defaultdict
by_service = defaultdict(list)
for event in events:
    by_service[event.service].append(event)      # no key check needed

# Nested, tolerating missing levels
region = config.get("deployment", {}).get("region", "eu-west-1")`,
      },
    ],
    traps: [
      '`d[key]` inside a condition meant to check for the key.',
      'A bare `except` around a dictionary access, catching unrelated errors.',
      '`defaultdict` where a plain dict was wanted - accessing a missing key **creates** it, which can silently grow the dict.',
    ],
    followUps: ['What is the surprising behaviour of `defaultdict` on a read?'],
    tags: ['dictionaries', 'idioms', 'defaultdict', 'fundamentals'],
  },
  {
    id: 'itv-py-43',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A script works when you run it manually but fails when cron runs it. What are the likely causes?',
    probing: 'An extremely common real problem with a fairly predictable set of causes.',
    answer: [
      'Cron runs with a **minimal environment**, and almost every cause follows from that.',
      '**PATH.** Cron\'s PATH is typically just `/usr/bin:/bin`, so a command that works interactively is not found. This is the most common cause by a wide margin, and the symptom is "command not found" for something that clearly exists. Use absolute paths, or set PATH explicitly in the crontab.',
      '**Environment variables.** Anything exported in `.bashrc` or `.profile` is absent - cron does not run a login shell. Credentials, `LANG`, `TZ`, a virtual environment path: none of it is there. Variables the script needs must be set in the crontab or read from a file the script sources explicitly.',
      "**The virtual environment.** `python script.py` uses the system Python, not the one you had activated. Use the venv's interpreter by absolute path - `/opt/app/.venv/bin/python` - which needs no activation at all.",
      "**Working directory.** Cron starts in the user's home directory, so relative paths resolve differently. Either `cd` explicitly or use absolute paths throughout.",
      '**No terminal.** Anything expecting a TTY - a progress bar, an interactive prompt, `sudo` asking for a password - fails or hangs.',
      '**Output goes nowhere.** By default cron mails output, which usually means it is discarded. Redirect stdout and stderr to a file, or the failure is silent.',
      'The way to reproduce it deliberately is `env -i` with an empty environment, which shows you exactly what cron will see.',
    ],
    code: [
      {
        title: 'Reproduce cron’s environment locally',
        language: 'bash',
        code: `# Run with an almost-empty environment, the way cron will
env -i HOME="$HOME" PATH=/usr/bin:/bin /opt/app/.venv/bin/python /opt/app/job.py

# Or capture what cron actually sees, once
# * * * * * env > /tmp/cron-env.txt
diff <(env | sort) <(sort /tmp/cron-env.txt)`,
      },
      {
        title: 'A crontab entry that works',
        language: 'bash',
        code: `SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=""

# Absolute interpreter (no activation needed), absolute script,
# explicit working directory, output captured rather than discarded.
0 2 * * * cd /opt/app && /opt/app/.venv/bin/python -m jobs.nightly \\
  >> /var/log/myapp/nightly.log 2>&1`,
      },
      {
        title: 'Make the script itself fail clearly',
        language: 'python',
        code: `import os, sys, logging

REQUIRED = ["DEPLOY_TOKEN", "DATABASE_URL"]

missing = [v for v in REQUIRED if not os.environ.get(v)]
if missing:
    # A specific message beats an obscure failure three minutes in
    print(f"missing required environment: {', '.join(missing)}", file=sys.stderr)
    sys.exit(2)

logging.basicConfig(
    level="INFO",
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stderr,
)
logging.info("starting, python=%s cwd=%s", sys.executable, os.getcwd())`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why does it fail under cron?',
        caption: 'Nearly all of these are consequences of cron’s minimal environment.',
        question: 'What is the symptom?',
        branches: [
          {
            condition: '"command not found"',
            result: 'PATH',
            detail: 'Cron has a minimal PATH - use absolute paths',
            tone: 'danger',
          },
          {
            condition: 'Missing credentials or config',
            result: 'Environment variables',
            detail: '.bashrc is not sourced',
            tone: 'warning',
          },
          {
            condition: 'ImportError for an installed package',
            result: 'Wrong Python',
            detail: 'Use the venv interpreter by absolute path',
            tone: 'warning',
          },
          {
            condition: 'File not found for a relative path',
            result: 'Working directory',
            detail: 'Cron starts in $HOME',
            tone: 'accent',
          },
          {
            condition: 'No output at all',
            result: 'Output was mailed and discarded',
            detail: 'Redirect to a log file',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      'Using the virtual environment’s interpreter directly is better than activating it - activation is a shell function that does not exist in cron’s minimal shell.',
      'A systemd timer is generally better than cron for anything non-trivial: it has proper logging through journald, dependency ordering, and an explicit environment.',
      'Log the interpreter path and working directory at startup. It turns this entire class of problem into one line of output.',
    ],
    traps: [
      'Assuming the environment matches an interactive shell.',
      '`source .venv/bin/activate` in a crontab, which often does not work.',
      'Output discarded, so the failure is silent.',
      'Relative paths that resolve differently from `$HOME`.',
    ],
    followUps: [
      'How would you reproduce cron’s environment to test?',
      'Why might a systemd timer be better?',
    ],
    tags: ['scenario', 'cron', 'environment', 'troubleshooting', 'advanced'],
  },
  {
    id: 'itv-py-44',
    level: 'basic',
    kind: 'open',
    prompt: 'What are f-strings and what should you be careful about?',
    probing: 'Modern string formatting, plus one genuine security caveat.',
    answer: [
      'An f-string embeds expressions directly: `f"deployed {version} to {env}"`. It is the current standard - more readable than `%` formatting or `.format()`, and faster than both because the formatting is compiled rather than parsed at runtime.',
      'The format specifiers are worth knowing: `f"{value:.2f}"` for decimal places, `f"{name:>20}"` for alignment, `f"{n:,}"` for thousands separators, and `f"{x=}"` which prints both the expression and its value - genuinely useful for debugging.',
      'The thing to be careful about is **logging**. `log.info(f"processed {n} items")` formats the string **immediately**, even if the log level means it will be discarded. `log.info("processed %s items", n)` defers formatting until the record is actually emitted. On a hot path with debug logging disabled, that is a measurable difference - and the lazy form also lets log aggregation group by the message template rather than treating every distinct value as a different message.',
      'And **never build SQL or shell commands with f-strings from untrusted input**. `f"SELECT * FROM users WHERE id = {user_id}"` is a SQL injection; parameterised queries exist for exactly this. The same applies to `subprocess` with `shell=True`.',
    ],
    code: [
      {
        title: 'f-strings, and where not to use them',
        language: 'python',
        code: `version, count, ratio = "1.4.2", 1234567, 0.8532

print(f"deploying {version}")
print(f"{count:,} items")            # 1,234,567
print(f"{ratio:.1%}")                # 85.3%
print(f"{version=}")                 # version='1.4.2'  - handy when debugging

# Logging: use lazy formatting, not an f-string
log.debug("processed %s items in %s", count, elapsed)     # right
log.debug(f"processed {count} items in {elapsed}")        # formats even if discarded

# SQL: parameterise, never interpolate
cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))    # right
cur.execute(f"SELECT * FROM users WHERE id = {user_id}")        # injection`,
      },
    ],
    traps: [
      'f-strings in logging calls, formatting work that is then discarded.',
      'f-strings building SQL or shell commands from user input.',
      'Expecting f-strings to work in Python 3.5 or earlier - they arrived in 3.6.',
    ],
    followUps: ['Why does lazy logging formatting matter beyond performance?'],
    tags: ['f-strings', 'formatting', 'logging', 'security', 'fundamentals'],
  },
  {
    id: 'itv-py-45',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you generate a report and send it somewhere?',
    probing: 'An end-to-end practical task combining several things.',
    answer: [
      'The structure I would use separates three concerns: **gather** the data, **format** it, and **deliver** it. Keeping those apart means the formatting can be tested with no data source and the delivery swapped without touching the logic.',
      'For **gathering**, whatever the source is - a cloud API, a database, a log query - with pagination handled and errors collected rather than aborting.',
      'For **formatting**, a **Jinja2 template** rather than string concatenation. It keeps the layout out of the code, non-developers can edit it, and producing both an HTML and a plain-text version is straightforward. For tabular data, pandas `to_html` or `tabulate` produce a readable table with very little code.',
      'For **delivery**, whatever fits: email via SMTP, a Slack or Teams webhook, writing to object storage, or opening a ticket. A webhook is usually the least friction and the most likely to be read.',
      'The operational details that make it reliable: **schedule it** with a systemd timer or a CronJob rather than cron where you can, so failures are logged and visible. **Fail loudly** - a report that silently does not send is worse than no report, because people assume no news is good news. And **include a timestamp and the period covered** in the report itself, so a stale one is obvious.',
    ],
    code: [
      {
        title: 'Gather, format, deliver - kept separate',
        language: 'python',
        code: `from jinja2 import Environment, FileSystemLoader
from datetime import datetime, timezone
import requests, logging, sys

log = logging.getLogger(__name__)


def gather() -> dict:
    """Pure data collection - testable against a fake client."""
    return {
        "period": "2026-09-09 to 2026-09-16",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "deployments": fetch_deployments(),
        "incidents": fetch_incidents(),
        "top_costs": fetch_costs(limit=10),
    }


def render(data: dict) -> str:
    """Pure formatting - testable with no I/O at all."""
    env = Environment(loader=FileSystemLoader("templates"), autoescape=True)
    return env.get_template("weekly.html.j2").render(**data)


def deliver(html: str) -> None:
    r = requests.post(
        WEBHOOK_URL,
        json={"text": "Weekly platform report", "blocks": to_blocks(html)},
        timeout=(5, 30),
    )
    r.raise_for_status()


def main() -> int:
    try:
        deliver(render(gather()))
    except Exception:
        log.exception("weekly report failed")
        return 1            # fail loudly - a silent non-delivery is worse
    log.info("weekly report sent")
    return 0


if __name__ == "__main__":
    sys.exit(main())`,
      },
    ],
    traps: [
      'Building HTML with string concatenation, which is unreadable and injection-prone.',
      'A report that fails silently, so nobody knows it stopped.',
      'No timestamp in the report, so a stale one looks current.',
      'Gathering, formatting and sending in one function, so none of it can be tested.',
    ],
    followUps: [
      'How would you test the formatting without any data source?',
      'Why does a failed report need to be loud?',
    ],
    tags: ['reporting', 'jinja2', 'automation', 'scheduling', 'structure'],
  },
  {
    id: 'itv-py-46',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these are genuine reasons to choose Python over Bash for an automation task? Select all that apply.',
    probing: 'Tool selection judgement - knowing when Bash is actually better.',
    options: [
      { id: 'a', text: 'The task involves structured data - JSON, YAML, API responses' },
      { id: 'b', text: 'It needs real error handling, retries and control flow' },
      { id: 'c', text: 'It will be maintained by several people over time and needs tests' },
      { id: 'd', text: 'It is a three-line sequence of standard Unix commands' },
      { id: 'e', text: 'It needs to run concurrently across many hosts or endpoints' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'A three-line sequence of Unix commands is exactly what Bash is for. `find | xargs | grep` is clearer, shorter and more obvious in shell than the Python equivalent, and wrapping it in Python adds an interpreter, a dependency and no value.',
      'The others are all genuine reasons to move. **Structured data** is where shell falls apart - parsing JSON with `sed` and `awk` is fragile and unreadable, while Python has it in the standard library.',
      '**Error handling and control flow**: Bash has `set -euo pipefail` and traps, which go a long way, but retries with backoff, distinguishing error types, and anything with real branching become painful quickly.',
      '**Maintainability and testing**: Bash is genuinely hard to unit test, and a 500-line shell script maintained by several people over years is a well-known bad place to be.',
      '**Concurrency**: `xargs -P` handles simple parallelism, but bounded pools, collecting results, and handling partial failure across hundreds of endpoints is much better expressed in Python.',
      'The rule I would state: **Bash for gluing commands together, Python once there is logic**. The transition point is usually when you find yourself parsing structured output or writing a function.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Bash or Python?',
        caption: 'The transition point is usually parsing structured data or writing a function.',
        question: 'What does the task involve?',
        branches: [
          {
            condition: 'Chaining a few standard commands',
            result: 'Bash',
            detail: 'Shorter and clearer',
            tone: 'success',
          },
          {
            condition: 'JSON, YAML or API responses',
            result: 'Python',
            detail: 'Shell parsing of structured data is fragile',
            tone: 'accent',
          },
          {
            condition: 'Retries, branching, error types',
            result: 'Python',
            tone: 'accent',
          },
          {
            condition: 'Long-lived, shared, needs tests',
            result: 'Python',
            detail: 'Bash is hard to test',
            tone: 'warning',
          },
        ],
      },
    ],
    traps: [
      'Rewriting a working ten-line shell script in Python for no reason.',
      'Persisting with Bash past the point it makes sense, ending with 800 lines nobody can modify.',
      'Assuming Python is always the more professional choice - for command chaining it is not.',
    ],
    followUps: ['Where exactly is the transition point for you?'],
    tags: ['bash', 'tool selection', 'judgement', 'scripting', 'advanced'],
  },
  {
    id: 'itv-py-47',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle secrets in a Python script?',
    probing: 'Security practice specific to scripting.',
    answer: [
      'The order of preference: **fetch at runtime from a secret manager**, then **read from the environment**, then **read from a file with restricted permissions**. Never hardcoded in the source, and never in a repository.',
      'Fetching from a **secret manager** - AWS Secrets Manager, Vault, Google Secret Manager - is the strongest because the secret exists only in memory for the life of the process, rotation happens outside the script, and access is audited. Where the script already has an identity (an IAM role, a Kubernetes service account), there is no bootstrap credential to protect either.',
      '**Environment variables** are the pragmatic default and are how containers and CI systems inject secrets. The caveats worth knowing: they are visible in `/proc/<pid>/environ` to anything running as the same user, they are inherited by child processes, and they appear in crash dumps and some error reporters.',
      'The practical rules for a script: **never log a secret**, and be aware that logging an entire config object or an exception containing a request will do so accidentally. **Never pass a secret as a command-line argument** - arguments are visible in the process list to every user on the machine; pass it through the environment or stdin instead.',
      'And if a secret is ever committed or logged, the only real response is **rotation**. Removing the commit does not help; it has been distributed.',
    ],
    code: [
      {
        title: 'Runtime fetch, with environment as the fallback',
        language: 'python',
        code: `import boto3, json, os
from functools import lru_cache


@lru_cache(maxsize=32)
def get_secret(name: str) -> dict:
    """Fetched at runtime; cached for the process, never written to disk."""
    client = boto3.client("secretsmanager")
    return json.loads(client.get_secret_value(SecretId=name)["SecretString"])


def db_password() -> str:
    # Prefer the secret manager; fall back to the environment for local dev
    if os.environ.get("USE_SECRETS_MANAGER", "true").lower() == "true":
        return get_secret("prod/db")["password"]
    pw = os.environ.get("DB_PASSWORD")
    if not pw:
        raise RuntimeError("DB_PASSWORD is not set and secrets manager is disabled")
    return pw`,
      },
      {
        title: 'Not leaking it',
        language: 'python',
        code: `import subprocess

token = get_secret("prod/api")["token"]

# WRONG - visible in the process list to every user on the machine
subprocess.run(["curl", "-H", f"Authorization: Bearer {token}", url])

# RIGHT - via the environment of the child process
subprocess.run(["./deploy.sh"], env={**os.environ, "API_TOKEN": token}, check=True)

# RIGHT - via stdin
subprocess.run(["docker", "login", "-u", user, "--password-stdin"],
               input=token, text=True, check=True)

# And be careful what you log
log.debug("config: %s", config)      # will print the secret if it is in there`,
      },
    ],
    traps: [
      'Secrets as command-line arguments, visible in `ps` to any user.',
      'Logging a config object or an exception that contains the secret.',
      'A `.env` file committed to the repository.',
      'Assuming removing a commit un-leaks a secret. It does not - rotate it.',
    ],
    followUps: [
      'Why is a command-line argument worse than an environment variable?',
      'A secret was logged to CI six months ago. What do you do?',
    ],
    tags: ['secrets', 'security', 'environment', 'subprocess'],
  },
  {
    id: 'itv-py-48',
    level: 'basic',
    kind: 'open',
    prompt: 'What is `if __name__ == "__main__":` for?',
    probing: 'A basic idiom whose purpose people often cannot articulate.',
    answer: [
      'Python sets the module-level variable `__name__` to `"__main__"` when a file is **run directly**, and to the module\'s name when it is **imported**. So the block runs on execution and not on import.',
      'The purpose is to make a file usable as **both a script and an importable module**. Without it, importing the file to reuse one of its functions would execute the whole script as a side effect - which at best is surprising and at worst deploys something.',
      'It also matters for **testing**: a test file importing your script to test its functions would run the script. And for **multiprocessing** on some platforms, child processes import the main module, so without the guard the script re-executes itself recursively.',
      'The convention that goes with it is to keep the block to a single call - `sys.exit(main())` - with all the logic in functions. That keeps everything testable and gives the exit code handling in one place.',
    ],
    code: [
      {
        title: 'The standard shape',
        language: 'python',
        code: `import sys


def do_work(config: dict) -> int:
    """All the logic lives here, so it can be imported and tested."""
    ...
    return 0


def main() -> int:
    args = parse_args()
    return do_work(load_config(args.config))


if __name__ == "__main__":
    sys.exit(main())

# python script.py       -> runs main()
# import script          -> defines the functions, runs nothing
# from script import do_work   -> testable`,
      },
    ],
    traps: [
      'Logic at module level, which runs on import.',
      'Omitting the guard and breaking `multiprocessing` on Windows and macOS with recursive re-execution.',
      'Everything inside the `if` block, so none of it can be imported or tested.',
    ],
    followUps: ['Why does `multiprocessing` need this on some platforms?'],
    tags: ['main guard', 'modules', 'imports', 'testing', 'fundamentals'],
  },
  {
    id: 'itv-py-49',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you make a Python service production-ready in a container?',
    probing: 'Bringing together containerisation, signals, health and observability.',
    answer: [
      'Several things, and most are commonly missing.',
      '**Signal handling.** The container runtime sends SIGTERM and then SIGKILL after a grace period. The service must handle SIGTERM: stop accepting new work, finish what is in flight, and exit. Without it every deployment drops requests. And it must be **PID 1 or have an init**, and started with exec form so the signal reaches Python rather than a shell.',
      '**Health endpoints**, separated: a **liveness** check that only says whether the process is wedged, and a **readiness** check that says whether it can serve right now, including its dependencies. Conflating them turns a database blip into a restart storm.',
      '**Configuration from the environment**, validated at startup so a missing value fails immediately with a clear message rather than at the first request.',
      '**Structured logging to stdout**, with no file handling, log rotation or destinations in the application - the platform collects stdout. JSON with a level, a timestamp and a correlation ID.',
      '**Metrics**, at minimum RED for the request path, exposed on a `/metrics` endpoint.',
      '**Non-root, read-only root filesystem, dropped capabilities**, and a minimal base image. And **resource limits set deliberately**, with the runtime aware of them - a JVM or a worker pool sized from the host rather than the cgroup will OOM.',
    ],
    code: [
      {
        title: 'Graceful shutdown, which most services get wrong',
        language: 'python',
        code: `import asyncio, logging, signal, sys
from contextlib import asynccontextmanager
from fastapi import FastAPI

log = logging.getLogger(__name__)
shutdown = asyncio.Event()


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown.set)

    app.state.pool = await create_pool()
    yield                                   # the application runs here

    # SIGTERM received - drain, then close cleanly
    log.info("shutting down: draining connections")
    await asyncio.sleep(5)                  # let load balancer removal propagate
    await app.state.pool.close()
    log.info("shutdown complete")


app = FastAPI(lifespan=lifespan)


@app.get("/healthz")                        # liveness: am I wedged?
async def healthz():
    return {"status": "ok"}


@app.get("/readyz")                         # readiness: can I serve right now?
async def readyz():
    if shutdown.is_set():
        return JSONResponse({"status": "draining"}, status_code=503)
    try:
        await app.state.pool.execute("SELECT 1")
    except Exception as exc:
        return JSONResponse({"status": "degraded", "error": str(exc)}, status_code=503)
    return {"status": "ready"}`,
      },
      {
        title: 'The Dockerfile half',
        language: 'dockerfile',
        code: `FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --require-hashes -r requirements.txt --target /install

FROM python:3.12-slim
RUN useradd --uid 10001 --create-home app
WORKDIR /app
COPY --from=build /install /usr/local/lib/python3.12/site-packages
COPY --chown=10001:10001 src/ ./src/

USER 10001
EXPOSE 8080
# Exec form - the signal reaches Python, not a shell
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]`,
      },
    ],
    deeper: [
      'The sleep in the shutdown path is the equivalent of a preStop hook: endpoint removal takes a few seconds to propagate, and shutting down before it does drops requests.',
      'Readiness returning 503 during drain is what takes the pod out of rotation before it stops accepting connections.',
      'Worker pool sizing should come from the cgroup limit, not `os.cpu_count()`, which reports the host.',
      'Shell form `CMD` puts a shell at PID 1 which does not forward SIGTERM - the single most common cause of ungraceful shutdown.',
    ],
    traps: [
      'No SIGTERM handling, dropping requests on every deploy.',
      'Shell form `CMD`, so the signal never reaches Python.',
      'Liveness checking the database, causing restart storms during a dependency blip.',
      'Worker count from `os.cpu_count()` in a container with a CPU limit.',
    ],
    followUps: [
      'Why sleep during shutdown rather than exiting immediately?',
      'What happens with shell form `CMD` and a SIGTERM?',
    ],
    tags: ['containers', 'signals', 'health checks', 'production', 'advanced'],
  },
  {
    id: 'itv-py-50',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the output of `print(type([]) == type(()))`?',
    probing: 'A quick check on types and a chance to discuss the better idiom.',
    options: [
      { id: 'a', text: 'False - a list and a tuple are different types' },
      { id: 'b', text: 'True - both are sequences' },
      { id: 'c', text: 'It raises a TypeError' },
      { id: 'd', text: 'None' },
    ],
    correct: ['a'],
    answer: [
      '`type([])` is `list` and `type(())` is `tuple`, which are different type objects, so the comparison is `False`.',
      'The more useful point is that **comparing types directly is not the idiomatic way** to check a type. `isinstance(x, list)` is preferred because it respects inheritance - a subclass of `list` is still a list for every practical purpose, and `type(x) == list` says it is not.',
      '`isinstance` also accepts a tuple of types - `isinstance(x, (list, tuple))` - which reads better than chained comparisons.',
      'And the broader idiom is often to **not check the type at all**. Python\'s convention is duck typing: try the operation and handle the failure, or check for the capability (`hasattr(x, "__iter__")`) rather than the concrete type. Excessive type checking usually indicates a design that would be simpler with a clearer interface.',
    ],
    code: [
      {
        title: 'The idiomatic forms',
        language: 'python',
        code: `print(type([]) == type(()))        # False

# Preferred - respects inheritance
isinstance(value, list)
isinstance(value, (list, tuple))

# Often better - check the capability, not the type
from collections.abc import Iterable, Mapping
isinstance(value, Iterable)
isinstance(value, Mapping)

# Or do not check at all - try it and handle the failure
try:
    items = list(value)
except TypeError:
    items = [value]`,
      },
    ],
    traps: [
      '`type(x) == SomeClass`, which rejects subclasses.',
      'Type checks scattered through code where a clearer interface would remove them.',
      '`isinstance(x, str)` forgotten when iterating - a string is iterable, so it silently iterates character by character.',
    ],
    followUps: ['Why is `isinstance` preferred over comparing types?'],
    tags: ['types', 'isinstance', 'duck typing', 'idioms', 'fundamentals'],
  },
]
