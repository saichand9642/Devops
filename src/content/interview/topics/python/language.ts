import type { InterviewQuestion } from '../../../types'

/** Language fundamentals that come up in a DevOps Python round. */
export const pythonLanguageQuestions: InterviewQuestion[] = [
  {
    id: 'itv-py-9',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does this print?',
    promptCode: [
      {
        title: 'Mutable default argument',
        language: 'python',
        code: `def add_item(item, items=[]):
    items.append(item)
    return items

print(add_item("a"))
print(add_item("b"))`,
      },
    ],
    probing:
      'The classic Python gotcha. It catches people who have written a lot of Python without hitting it.',
    options: [
      { id: 'a', text: "['a'] then ['b']" },
      { id: 'b', text: "['a'] then ['a', 'b']" },
      { id: 'c', text: "['a'] then []" },
      { id: 'd', text: 'It raises a TypeError on the second call' },
    ],
    correct: ['b'],
    answer: [
      'Default arguments are evaluated **once, when the function is defined**, not on each call. So there is a single list object shared by every call that does not pass `items`, and it accumulates across calls.',
      "The first call appends to the empty list and returns `['a']`. The second call appends to that **same** list and returns `['a', 'b']`.",
      'The fix is to use `None` as the default and create the list inside the function, so a new one is made per call.',
      'This matters in real code because it produces state that leaks between calls in ways that are extremely hard to trace - a function that behaves differently depending on what was called before it, with no visible shared state.',
    ],
    code: [
      {
        title: 'The correct pattern',
        language: 'python',
        code: `def add_item(item, items=None):
    if items is None:
        items = []          # a new list on every call
    items.append(item)
    return items

print(add_item("a"))   # ['a']
print(add_item("b"))   # ['b']`,
      },
    ],
    traps: [
      'Any mutable default - list, dict, set - has this behaviour.',
      'It also applies to a default whose value is computed at definition time, such as `timestamp=time.time()`.',
    ],
    followUps: ['What other kinds of default argument have this problem?'],
    tags: ['gotchas', 'functions', 'mutability', 'fundamentals'],
  },
  {
    id: 'itv-py-10',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the difference between a list, a tuple, a set and a dict?',
    probing: 'Data structure fluency and knowing when each is the right choice.',
    answer: [
      'A **list** is ordered and mutable, with O(1) append and O(n) membership testing. A **tuple** is ordered and immutable, which makes it hashable - so it can be a dict key or a set member - and slightly cheaper.',
      'A **set** is unordered, holds unique elements, and has **O(1) membership testing**. That last property is the reason to use one: checking `x in some_list` on a 100,000-element list is O(n) and on a set is effectively constant. Converting a list to a set before repeated membership checks is one of the easiest performance fixes there is.',
      'A **dict** maps keys to values with O(1) lookup. Since Python 3.7 it preserves insertion order as a language guarantee.',
      'For scripting work the decision is usually straightforward: a list for an ordered collection you will modify, a tuple for a fixed record or a dict key, a set when you care about uniqueness or membership, a dict for lookup by key.',
    ],
    code: [
      {
        title: 'The performance difference that matters',
        language: 'python',
        code: `import time

haystack = list(range(200_000))
needles = list(range(0, 200_000, 1000))

t = time.perf_counter()
found = [n for n in needles if n in haystack]        # O(n) per check
print(f"list:  {time.perf_counter() - t:.4f}s")

lookup = set(haystack)                                # build once
t = time.perf_counter()
found = [n for n in needles if n in lookup]          # O(1) per check
print(f"set:   {time.perf_counter() - t:.4f}s")`,
        explanation: 'On these sizes the set version is typically hundreds of times faster.',
      },
    ],
    traps: [
      'Repeated `in` checks against a list where a set would be constant time.',
      'Trying to use a list as a dict key - it is unhashable; use a tuple.',
      'Assuming set operations preserve order. They do not.',
    ],
    followUps: ['When would you use a tuple rather than a list?'],
    tags: ['data structures', 'performance', 'sets', 'fundamentals'],
  },
  {
    id: 'itv-py-11',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are context managers and why do they matter for scripts that touch real systems?',
    probing:
      'Resource handling - the thing that separates a script that works from one that is safe.',
    answer: [
      'A context manager is an object usable with `with`, which guarantees that setup happens on entry and **cleanup happens on exit - including when an exception is raised**. `with open(path) as f:` closes the file whether the block completes, returns early, or raises.',
      'That guarantee is why it matters for operational scripts. A script that opens a file, acquires a lock, starts a database transaction or creates a temporary resource, and then crashes partway through, leaves that resource held. On a long-running process that is a leak; on a script holding a lock it can block everything else indefinitely.',
      'You write one either by implementing `__enter__` and `__exit__` on a class, or - more commonly - with the `@contextmanager` decorator and a generator, which is much less code for simple cases.',
      'The pattern worth knowing for infrastructure scripts is a context manager that **creates something and always cleans it up**: a temporary directory, a maintenance-mode flag, a host taken out of a load balancer. It makes the cleanup impossible to forget, which is the point.',
    ],
    code: [
      {
        title: 'A context manager that always cleans up',
        language: 'python',
        code: `from contextlib import contextmanager
import logging

log = logging.getLogger(__name__)


@contextmanager
def maintenance_mode(host: str, lb_client):
    """Take a host out of the load balancer, and always put it back."""
    log.info("draining %s", host)
    lb_client.drain(host)
    try:
        yield                       # the body of the with-block runs here
    finally:
        # Runs on success, on exception, and on early return
        log.info("restoring %s", host)
        lb_client.enable(host)


with maintenance_mode("web-01", lb):
    deploy_release("web-01", version="1.4.2")
    run_smoke_tests("web-01")
    # Even if this raises, web-01 goes back into the load balancer`,
      },
      {
        title: 'Several resources, and suppressing an expected error',
        language: 'python',
        code: `from contextlib import suppress
import tempfile, pathlib

# Both files closed regardless of what happens
with open("in.csv") as src, open("out.csv", "w") as dst:
    dst.write(src.read())

# A temporary directory that is always removed
with tempfile.TemporaryDirectory() as tmp:
    workdir = pathlib.Path(tmp)
    (workdir / "artifact.tar.gz").write_bytes(download())

# Deliberately ignore a specific expected error
with suppress(FileNotFoundError):
    pathlib.Path("/tmp/stale.lock").unlink()`,
      },
    ],
    traps: [
      'Cleanup in the normal flow rather than in a `finally` or a context manager, so it is skipped on failure.',
      'A `__exit__` that raises, masking the original exception.',
      'Returning `True` from `__exit__`, which silently swallows every exception in the block.',
    ],
    followUps: [
      'What happens if the body of a `with` block raises?',
      'How would you write one that takes a host out of rotation?',
    ],
    tags: ['context managers', 'resources', 'error handling', 'scripting'],
  },
  {
    id: 'itv-py-12',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How should a script handle errors and exit codes?',
    probing: 'Whether you write scripts that behave properly when something else depends on them.',
    answer: [
      'A script that will be run by CI, cron or another script has to **communicate through its exit code**. Zero for success, non-zero for failure. A script that catches every exception and exits zero is worse than one that crashes, because the caller believes it worked.',
      'The structure that works: catch **specific exceptions** you can do something about, let unexpected ones propagate, and use `sys.exit(1)` for a controlled failure. `try/except Exception` at the top level is only appropriate if you log the traceback and then exit non-zero.',
      '**Write errors to stderr and output to stdout**, so a caller can separate them and so piping the output does not include error text.',
      '**Log rather than print** for anything operational - the `logging` module gives you levels, timestamps and the ability to route output, and `log.exception()` includes the traceback automatically.',
      'And **fail early and clearly**: validate arguments and required environment at the start, with a specific message about what is missing, rather than failing obscurely three minutes in.',
    ],
    code: [
      {
        title: 'A script that behaves properly when automated',
        language: 'python',
        code: `#!/usr/bin/env python3
import logging
import os
import sys

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stderr,              # logs to stderr, results to stdout
)
log = logging.getLogger("deploy")


def main() -> int:
    # Validate up front, with a specific message
    token = os.environ.get("DEPLOY_TOKEN")
    if not token:
        log.error("DEPLOY_TOKEN is not set")
        return 2

    try:
        result = deploy(token)
    except ConnectionError as exc:
        log.error("could not reach the deployment API: %s", exc)
        return 3
    except PermissionError as exc:
        log.error("token rejected: %s", exc)
        return 4
    except Exception:
        log.exception("unexpected failure")    # includes the traceback
        return 1

    print(result.version)           # the actual output, on stdout
    return 0


if __name__ == "__main__":
    sys.exit(main())`,
        explanation:
          'Distinct exit codes let a caller distinguish "bad config" from "API down" without parsing text.',
      },
    ],
    traps: [
      'A bare `except:` that also catches `KeyboardInterrupt` and `SystemExit`.',
      'Catching everything and exiting zero, so CI reports success.',
      '`print()` for errors, so they end up mixed into piped output.',
      'No validation up front, so the script fails obscurely after doing half the work.',
    ],
    followUps: ['Why do distinct exit codes matter?', 'What is wrong with a bare `except:`?'],
    tags: ['error handling', 'exit codes', 'logging', 'scripting', 'cli'],
  },
  {
    id: 'itv-py-13',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you run shell commands from Python safely?',
    probing: '`subprocess` usage, including the injection risk that `shell=True` creates.',
    answer: [
      '`subprocess.run()` is the modern interface. The important choice is **passing a list of arguments rather than a string**, because a list is passed directly to the operating system with no shell involved - so there is no quoting, no word splitting, and no injection.',
      '`shell=True` runs the command through a shell, which means **any user-controlled value in that string can execute arbitrary commands**. A filename containing `; rm -rf /` is not a theoretical problem. Use it only when you genuinely need shell features - pipes, globbing, redirection - and never with interpolated input.',
      'The arguments that matter for correctness: **`check=True`** raises on a non-zero exit, which you almost always want - without it, a failed command is silently ignored. **`capture_output=True`** and **`text=True`** give you the output as strings rather than bytes. And **`timeout=`**, because a command that hangs will hang your script forever.',
      'For anything more than a trivial call, prefer a **Python library over shelling out**: `requests` rather than `curl`, `pathlib` rather than `mv`, the cloud SDK rather than the CLI. You get structured results, real exceptions and no parsing.',
    ],
    code: [
      {
        title: 'Safe and unsafe, side by side',
        language: 'python',
        code: `import subprocess

# UNSAFE - if branch contains a shell metacharacter this executes it
branch = get_user_input()
subprocess.run(f"git checkout {branch}", shell=True)

# SAFE - the list is passed straight to exec, no shell involved
result = subprocess.run(
    ["git", "checkout", branch],
    check=True,              # raise on non-zero exit
    capture_output=True,
    text=True,
    timeout=30,              # never hang forever
)
print(result.stdout)`,
      },
      {
        title: 'Handling the failure properly',
        language: 'python',
        code: `import subprocess, logging

log = logging.getLogger(__name__)

def run(cmd: list[str], timeout: int = 60) -> str:
    log.debug("running: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd, check=True, capture_output=True, text=True, timeout=timeout
        )
    except subprocess.CalledProcessError as exc:
        # stderr is where the useful message is - log it, do not discard it
        log.error("command failed (%d): %s", exc.returncode, exc.stderr.strip())
        raise
    except subprocess.TimeoutExpired:
        log.error("command timed out after %ds: %s", timeout, " ".join(cmd))
        raise
    return result.stdout.strip()`,
      },
    ],
    traps: [
      '`shell=True` with any interpolated value - a straightforward command injection.',
      'No `check=True`, so a failed command is silently ignored.',
      'No `timeout`, so a hung command hangs the script.',
      'Discarding stderr, so a failure gives you no information about why.',
    ],
    followUps: [
      'Why is passing a list safer than a string?',
      'When is `shell=True` genuinely necessary?',
    ],
    tags: ['subprocess', 'security', 'shell', 'injection', 'scripting'],
  },
  {
    id: 'itv-py-14',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage Python dependencies and virtual environments?',
    probing: 'Reproducibility, which is where Python has historically been weak.',
    answer: [
      'A **virtual environment** gives a project its own isolated set of packages, so two projects needing different versions of the same library do not conflict and nothing is installed system-wide. `python -m venv .venv` creates one; activating it puts its `python` and `pip` first on the path.',
      '**Pinning** is what makes installs reproducible. `requirements.txt` with exact versions - and ideally with hashes - means the same install today and in six months. A `requirements.in` with loose constraints, compiled by `pip-compile` into a fully pinned `requirements.txt`, gives you both readable intent and reproducible output.',
      'The modern tooling has largely converged on **`pyproject.toml`** as the declaration, with **`uv`** or **Poetry** managing the environment and the lock file. `uv` in particular is dramatically faster and handles the environment, the lock and the Python version itself.',
      'For **containers**, install into the image at build time from a pinned file, and use a multi-stage build so build tooling does not ship. Pin the base image by digest too, or "reproducible" only holds until the base moves.',
      'The failure mode to avoid is unpinned dependencies: a build that worked last week fails today because a transitive dependency released a new version. It is the single most common cause of "it worked yesterday" in Python.',
    ],
    code: [
      {
        title: 'Pinned and reproducible',
        language: 'bash',
        code: `python -m venv .venv
source .venv/bin/activate

# Loose intent in requirements.in, fully pinned output in requirements.txt
pip install pip-tools
pip-compile requirements.in --generate-hashes -o requirements.txt
pip-sync requirements.txt            # installs EXACTLY this, removes extras

# Or with uv, which does all of it and is far faster
uv venv
uv pip compile requirements.in -o requirements.txt
uv pip sync requirements.txt`,
      },
      {
        title: 'In a container, with a multi-stage build',
        language: 'dockerfile',
        code: `FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --require-hashes -r requirements.txt \\
      --target /install

FROM python:3.12-slim
WORKDIR /app
COPY --from=build /install /usr/local/lib/python3.12/site-packages
COPY src/ ./src/
USER 10001
CMD ["python", "-m", "src.app"]`,
        explanation:
          '--require-hashes fails the build if a package does not match its recorded hash - a supply-chain control.',
      },
    ],
    traps: [
      'Unpinned dependencies, so builds are not reproducible.',
      '`pip install` without a virtual environment, polluting the system Python.',
      '`pip freeze` used as the source of truth, which captures the current environment including things you did not intend.',
      'Pinning application dependencies but not the base image.',
    ],
    followUps: [
      'Why is `pip freeze > requirements.txt` not a good workflow?',
      'What does `--require-hashes` protect against?',
    ],
    tags: ['dependencies', 'venv', 'pip', 'reproducibility', 'containers'],
  },
  {
    id: 'itv-py-15',
    level: 'advanced',
    kind: 'open',
    prompt: 'Explain the GIL. When does it matter for a DevOps script?',
    probing: 'Concurrency. The practical framing - I/O versus CPU - is what is being assessed.',
    answer: [
      'The **Global Interpreter Lock** means only one thread executes Python bytecode at a time in a CPython process. Threads exist and are scheduled, but they do not execute Python code in parallel across cores.',
      'The critical detail is that **the GIL is released during I/O**. While a thread is waiting on a network request, a disk read or a subprocess, it holds no lock and other threads run. So for **I/O-bound** work - which is nearly everything in DevOps scripting: API calls, SSH connections, file transfers, database queries - threads give you real concurrency and a large speedup.',
      'For **CPU-bound** work - parsing a very large file, compression, cryptography in pure Python - threads give you nothing, because only one can execute at a time. There you need **`multiprocessing`**, which uses separate processes with separate interpreters, at the cost of inter-process communication and higher memory use.',
      'So the practical rule: **threads (or `asyncio`) for I/O, processes for CPU**. `concurrent.futures` gives you both behind the same interface, which makes switching between them a one-word change.',
      'And the relevant nuance: much numerical work in libraries like NumPy releases the GIL in its C code, so it parallelises with threads despite being CPU-bound. Python 3.13 also introduces an experimental free-threaded build without the GIL, which will change this picture over time.',
    ],
    code: [
      {
        title: 'Threads for I/O - the common DevOps case',
        language: 'python',
        code: `from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

HOSTS = [f"host-{i:03d}.example.com" for i in range(200)]


def check(host: str) -> tuple[str, int | None]:
    try:
        r = requests.get(f"https://{host}/healthz", timeout=5)
        return host, r.status_code
    except requests.RequestException:
        return host, None


# 200 sequential requests at ~200ms each is 40 seconds.
# 20 threads brings it to roughly 2.
with ThreadPoolExecutor(max_workers=20) as pool:
    futures = {pool.submit(check, h): h for h in HOSTS}
    for fut in as_completed(futures):
        host, status = fut.result()
        if status != 200:
            print(f"UNHEALTHY {host}: {status}")`,
      },
      {
        title: 'Processes for CPU-bound work - the same interface',
        language: 'python',
        code: `from concurrent.futures import ProcessPoolExecutor

def parse_and_aggregate(path: str) -> dict:
    """Pure-Python parsing of a large file - CPU bound, threads would not help."""
    ...

# One word changed; now it uses separate processes and all cores
with ProcessPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(parse_and_aggregate, log_files))`,
      },
    ],
    traps: [
      'Reaching for `multiprocessing` for I/O-bound work, paying process overhead for no benefit.',
      'Expecting threads to speed up CPU-bound pure-Python code.',
      'Too many threads against a remote API, which becomes rate limiting rather than speed.',
      'Shared mutable state between threads without a lock.',
    ],
    followUps: [
      'Why do threads help for HTTP requests but not for parsing?',
      'When would you use `asyncio` instead of threads?',
    ],
    tags: ['gil', 'concurrency', 'threading', 'multiprocessing', 'performance'],
  },
  {
    id: 'itv-py-16',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does this print?',
    promptCode: [
      {
        title: 'Late binding in closures',
        language: 'python',
        code: `funcs = []
for i in range(3):
    funcs.append(lambda: i)

print([f() for f in funcs])`,
      },
    ],
    probing: 'Closures and late binding, which produces genuinely confusing bugs.',
    options: [
      { id: 'a', text: '[0, 1, 2]' },
      { id: 'b', text: '[2, 2, 2]' },
      { id: 'c', text: '[None, None, None]' },
      { id: 'd', text: 'It raises a NameError' },
    ],
    correct: ['b'],
    answer: [
      'The lambdas capture the **variable `i`**, not its value at the time they were created. By the time any of them is called, the loop has finished and `i` is 2 - so all three return 2.',
      'This is **late binding**: a closure looks up the variable when it is called, not when it is defined. It is a common source of bugs in code that builds callbacks, handlers or partially-applied functions in a loop.',
      'The fix is to **bind the value at definition time**, most simply with a default argument - `lambda i=i: i` - which is evaluated when the lambda is created. `functools.partial` does the same thing more explicitly.',
      'It shows up in real operational code when building a list of tasks or callbacks per host in a loop and finding every one of them acts on the last host.',
    ],
    code: [
      {
        title: 'Both fixes',
        language: 'python',
        code: `# Default argument - evaluated at definition time
funcs = [lambda i=i: i for i in range(3)]
print([f() for f in funcs])            # [0, 1, 2]

# functools.partial - more explicit about what is being bound
from functools import partial
funcs = [partial(lambda x: x, i) for i in range(3)]
print([f() for f in funcs])            # [0, 1, 2]

# Where it bites in real code
handlers = [partial(restart_service, host) for host in hosts]  # correct
# handlers = [lambda: restart_service(host) for host in hosts] # all use the last host`,
      },
    ],
    traps: [
      'Building callbacks in a loop and having them all act on the last item.',
      'Assuming a comprehension scopes the variable per iteration for closures. The loop variable is still shared.',
    ],
    followUps: ['Where would this bite in a real script?'],
    tags: ['closures', 'late binding', 'gotchas', 'functions'],
  },
  {
    id: 'itv-py-17',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you parse configuration and command-line arguments in a script?',
    probing: 'Practical tooling for operational scripts.',
    answer: [
      'For **command-line arguments**, `argparse` from the standard library handles parsing, types, defaults, required arguments and generates `--help` automatically. `click` and `typer` are nicer for anything with subcommands, and `typer` derives the interface from type hints, which is very little code.',
      'For **configuration**, the layering that works is **defaults in code, overridden by a config file, overridden by environment variables, overridden by command-line arguments**. That order matches how people expect to use a tool, and it means the same script works in a container (environment) and interactively (flags).',
      'For **config files**, use `tomllib` (standard library since 3.11) or `PyYAML` with **`yaml.safe_load`** - never `yaml.load` without a safe loader, which can execute arbitrary Python from the file.',
      '**Validate at startup and fail clearly.** `pydantic` is worth using for anything non-trivial: it validates types, applies defaults, reads from the environment, and produces a specific error message naming the field that is wrong - rather than a `KeyError` three minutes into the run.',
      'And **secrets come from the environment or a secret manager**, never from a config file committed to the repository.',
    ],
    code: [
      {
        title: 'argparse with sensible structure',
        language: 'python',
        code: `import argparse, os

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Deploy a release to an environment")
    p.add_argument("version", help="Version to deploy, e.g. 1.4.2")
    p.add_argument(
        "--environment", "-e",
        choices=["dev", "staging", "prod"],
        default=os.environ.get("DEPLOY_ENV", "dev"),   # env as the fallback
    )
    p.add_argument("--timeout", type=int, default=300, help="Seconds (default: 300)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", "-v", action="count", default=0)
    return p.parse_args()`,
      },
      {
        title: 'Validated configuration with pydantic',
        language: 'python',
        code: `from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_url: str = "https://api.example.com"
    api_token: str                            # required - no default
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    max_retries: int = Field(default=3, ge=0, le=10)

    model_config = {"env_prefix": "DEPLOY_", "env_file": ".env"}

    @field_validator("api_url")
    @classmethod
    def must_be_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("api_url must use https")
        return v


# Fails immediately with a specific message naming the bad field
settings = Settings()`,
      },
    ],
    traps: [
      '`yaml.load` without `SafeLoader`, which can execute arbitrary code from the file.',
      'Reading configuration lazily, so a bad value surfaces after the script has done half its work.',
      'Secrets in a config file in the repository.',
      'No `--dry-run` on a script that makes changes.',
    ],
    followUps: [
      'Why is `yaml.load` dangerous?',
      'What order should config sources override each other in?',
    ],
    tags: ['argparse', 'configuration', 'pydantic', 'yaml', 'cli'],
  },
  {
    id: 'itv-py-18',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you make an API-calling script robust?',
    probing: 'Real-world resilience - retries, backoff, timeouts and rate limiting.',
    answer: [
      'Four things, and scripts usually have none of them.',
      '**Timeouts on every request.** `requests` has **no default timeout** - a request can hang indefinitely, and a script with no timeout will hang forever waiting for a server that has stopped responding. This is the single most common omission.',
      '**Retries with exponential backoff and jitter.** Transient failures - a 502, a connection reset, a rate limit - are normal against any real API. Retry on the ones worth retrying (5xx, 429, connection errors), not on 4xx that will never succeed. Backoff exponentially so you do not hammer a struggling service, and add jitter so many clients do not retry in lockstep.',
      '**Respect rate limits.** A 429 usually carries a `Retry-After` header; honouring it is both more polite and more effective than a fixed backoff.',
      '**Fail clearly when you give up.** After the retries are exhausted, raise with the status code and response body, not a generic message - the API almost always says what was wrong.',
      'And **pagination**: an API that returns a page of results will silently give you the first 100 items if you do not follow the pages, which produces quietly incomplete results rather than an error.',
    ],
    code: [
      {
        title: 'A session with retries, backoff and timeouts',
        language: 'python',
        code: `import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def make_session(retries: int = 5) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=1,                       # 1s, 2s, 4s, 8s, 16s
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods={"GET", "PUT", "DELETE", "POST"},
        respect_retry_after_header=True,        # honour the API's own guidance
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_maxsize=20)
    session.mount("https://", adapter)
    session.headers.update({"User-Agent": "deploy-tool/1.4"})
    return session


session = make_session()

# ALWAYS pass a timeout - requests has no default
response = session.get(
    "https://api.example.com/v1/deployments",
    timeout=(5, 30),            # (connect timeout, read timeout)
)
response.raise_for_status()`,
      },
      {
        title: 'Pagination, done properly',
        language: 'python',
        code: `def fetch_all(session, url: str) -> list[dict]:
    """Follow pagination - otherwise you silently get only the first page."""
    items: list[dict] = []
    while url:
        r = session.get(url, timeout=(5, 30))
        r.raise_for_status()
        payload = r.json()
        items.extend(payload["items"])
        url = payload.get("next")           # None ends the loop
    return items`,
      },
    ],
    traps: [
      'No timeout, so the script hangs indefinitely.',
      'Retrying 4xx errors, which will never succeed.',
      'Fixed-interval retries from many clients simultaneously, creating a thundering herd.',
      'Not following pagination, producing silently incomplete results.',
    ],
    followUps: ['Why does jitter matter in a backoff?', 'Which status codes are worth retrying?'],
    tags: ['requests', 'retries', 'backoff', 'timeouts', 'resilience'],
  },
  {
    id: 'itv-py-19',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you read and process a large file efficiently?',
    probing: 'Memory awareness, which matters for log processing.',
    answer: [
      'The rule is to **iterate, not load**. `f.read()` or `f.readlines()` pulls the whole file into memory, which is fine for a small file and fatal for a 10 GB log - the process is killed by the OOM killer.',
      'Iterating over the file object - `for line in f:` - reads it lazily in buffered chunks, so memory use stays constant regardless of file size. That single change is usually the whole answer.',
      '**Generators** extend the idea to a processing pipeline: each stage yields items rather than building a list, so the whole pipeline processes one record at a time and holds almost nothing. That is how you filter, parse and aggregate a very large file in constant memory.',
      'For **aggregation**, `collections.Counter` and `defaultdict` accumulate results without holding the input.',
      'And where the file is compressed, `gzip.open` iterates the same way, so you never need to decompress it to disk first.',
    ],
    code: [
      {
        title: 'Constant memory, whatever the file size',
        language: 'python',
        code: `# Loads the whole file - fine for 10 MB, fatal for 10 GB
with open("app.log") as f:
    lines = f.readlines()

# Lazy - constant memory
with open("app.log") as f:
    for line in f:
        process(line)`,
      },
      {
        title: 'A generator pipeline over a compressed log',
        language: 'python',
        code: `import gzip, json
from collections import Counter
from typing import Iterator


def read_lines(path: str) -> Iterator[str]:
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt") as f:
        yield from f


def parse(lines: Iterator[str]) -> Iterator[dict]:
    for line in lines:
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            continue                       # skip malformed lines, do not crash


def errors_only(events: Iterator[dict]) -> Iterator[dict]:
    for e in events:
        if e.get("level") == "ERROR":
            yield e


# Nothing is materialised - one record flows through at a time
counts = Counter(
    e.get("service", "unknown")
    for e in errors_only(parse(read_lines("app-2026-09-16.log.gz")))
)
for service, n in counts.most_common(10):
    print(f"{n:8d}  {service}")`,
      },
    ],
    traps: [
      '`readlines()` on a large file.',
      'Building an intermediate list between pipeline stages, which defeats the generators.',
      'No handling for malformed lines, so one bad record crashes a job processing millions.',
      'Forgetting that a generator can only be consumed once.',
    ],
    followUps: [
      'What happens if you try to iterate a generator twice?',
      'How would you process a 50 GB file that does not fit in memory?',
    ],
    tags: ['generators', 'memory', 'file processing', 'logs', 'fundamentals'],
  },
  {
    id: 'itv-py-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are decorators and how would you use one in operational code?',
    probing: 'A language feature with genuinely useful applications in tooling.',
    answer: [
      'A decorator is a function that takes a function and returns a replacement, usually wrapping it with extra behaviour. `@decorator` above a definition is shorthand for `func = decorator(func)`.',
      'The operational uses are the ones worth knowing: **retry with backoff**, **timing and metrics**, **logging entry and exit**, **caching**, **authentication or permission checks**, and **rate limiting**. Each is cross-cutting behaviour you want on many functions without repeating it in every one.',
      'The detail that matters when writing one is **`functools.wraps`**. Without it, the wrapped function loses its name, docstring and signature, which breaks introspection, help output and debugging - a traceback shows `wrapper` instead of the real function name.',
      "`functools.lru_cache` is the standard-library one you will use most: it memoises a function's results, which is genuinely useful for expensive lookups - resolving a host, fetching configuration - within the lifetime of a script.",
      'The caution is readability. A function with four decorators is hard to reason about, and a decorator that silently swallows exceptions makes debugging very difficult. They are best kept simple and few.',
    ],
    code: [
      {
        title: 'A retry decorator with backoff',
        language: 'python',
        code: `import functools
import logging
import random
import time

log = logging.getLogger(__name__)


def retry(attempts: int = 3, base_delay: float = 1.0, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)          # preserve name, docstring, signature
        def wrapper(*args, **kwargs):
            last = None
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    last = exc
                    if attempt == attempts:
                        break
                    delay = base_delay * (2 ** (attempt - 1))
                    delay += random.uniform(0, delay * 0.1)   # jitter
                    log.warning(
                        "%s failed (attempt %d/%d): %s - retrying in %.1fs",
                        func.__name__, attempt, attempts, exc, delay,
                    )
                    time.sleep(delay)
            raise last
        return wrapper
    return decorator


@retry(attempts=5, base_delay=2, exceptions=(ConnectionError, TimeoutError))
def fetch_deployment_status(deployment_id: str) -> dict:
    ...`,
      },
      {
        title: 'Timing, and caching from the standard library',
        language: 'python',
        code: `import functools, time

def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            log.info("%s took %.2fs", func.__name__, time.perf_counter() - start)
    return wrapper


@functools.lru_cache(maxsize=256)
def resolve_host(name: str) -> str:
    """Expensive lookup, cached for the lifetime of the process."""
    ...`,
      },
    ],
    traps: [
      'Omitting `functools.wraps`, so tracebacks and help output show the wrapper.',
      'A decorator that catches and suppresses exceptions, hiding failures.',
      '`lru_cache` on a function whose result changes over time, serving stale data.',
      'Stacking many decorators until the actual behaviour is unclear.',
    ],
    followUps: [
      'What does `functools.wraps` actually preserve?',
      'When would `lru_cache` be the wrong choice?',
    ],
    tags: ['decorators', 'functools', 'retry', 'patterns'],
  },
  {
    id: 'itv-py-21',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A Python script that runs nightly has started taking four hours instead of twenty minutes. How do you investigate?',
    probing: 'Performance debugging with measurement rather than guesses.',
    answer: [
      'First **measure before changing anything**. `cProfile` gives a function-level breakdown of where the time goes, and it almost always points somewhere unexpected. Guessing at the slow part is how people spend a day optimising something that was not the problem.',
      'For a long-running script, **line-level profiling** (`line_profiler`) on the hot function narrows it further, and **`memory_profiler`** if the symptom looks like swapping rather than computation.',
      'The causes, roughly in order of how often they are the answer. **A data volume change**: the script processes whatever is there, and the input has grown. If the algorithm is O(n²), doubling the input quadruples the time - that is the classic pattern for "it was fine until suddenly it was not".',
      '**An external dependency got slower**: an API, a database query without an index, a network share. If the profile shows time in a request or a query rather than in Python, that is where to look.',
      '**Memory pressure**: a script that now loads more than fits starts swapping, and the slowdown is dramatic and non-linear.',
      '**Something changed in a dependency**: an upgraded library with different performance characteristics, which is why pinning matters.',
      'And the fixes follow the finding: an O(n²) lookup replaced with a set or dict, a query fixed or batched, streaming instead of loading, or parallelism for I/O-bound work. **Add timing instrumentation** afterwards so the next regression is visible in a log rather than discovered by someone noticing.',
    ],
    code: [
      {
        title: 'Profile first',
        language: 'bash',
        code: `# Function-level profile, sorted by cumulative time
python -m cProfile -s cumtime nightly_job.py 2>&1 | head -30

# Save it and explore interactively
python -m cProfile -o profile.out nightly_job.py
python -c "import pstats; pstats.Stats('profile.out').sort_stats('tottime').print_stats(20)"

# Line-by-line on the hot function
kernprof -l -v nightly_job.py     # with @profile on the function`,
      },
      {
        title: 'The O(n-squared) pattern, and its fix',
        language: 'python',
        code: `# O(n*m) - fine at 1,000 records, four hours at 100,000
for record in records:                     # 100,000
    for existing in known_items:           # 50,000  -> 5 billion comparisons
        if record.id == existing.id:
            record.mark_seen()

# O(n+m) - the same result, seconds instead of hours
known_ids = {e.id for e in known_items}    # built once
for record in records:
    if record.id in known_ids:             # O(1)
        record.mark_seen()`,
      },
      {
        title: 'Instrument it so the next regression is visible',
        language: 'python',
        code: `import time, logging
from contextlib import contextmanager

log = logging.getLogger(__name__)

@contextmanager
def stage(name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        log.info("stage=%s duration_seconds=%.2f", name, time.perf_counter() - start)


with stage("fetch"):
    records = fetch_records()
with stage("transform"):
    results = transform(records)
with stage("write"):
    write_results(results)`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Investigating the slowdown',
        caption: 'Profile before optimising - the slow part is rarely where people assume.',
        nodes: [
          {
            label: 'Profile with cProfile',
            detail: 'Where does the time actually go?',
            tone: 'accent',
          },
          { label: 'In Python, or waiting on I/O?', detail: 'Very different investigations' },
          {
            label: 'Has the input volume grown?',
            detail: 'O(n squared) is the classic cause',
            tone: 'warning',
          },
          { label: 'Memory pressure and swapping?', detail: 'Non-linear slowdown' },
          { label: 'Dependency or query changed?', detail: 'Check what was upgraded' },
          { label: 'Fix, then instrument per stage', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'A nested loop over two collections is the most common cause of a script that scaled fine and then suddenly did not.',
      'If the profile shows time inside `requests` or a database driver, the problem is not Python - parallelise the I/O or fix the query.',
      'Per-stage timing logged on every run turns the next regression into a visible trend rather than a surprise.',
    ],
    traps: [
      'Optimising before profiling.',
      'Adding parallelism to something that is CPU-bound and GIL-limited.',
      'Assuming the code changed when the data volume did.',
      'Fixing it without adding instrumentation, so the next one is also a surprise.',
    ],
    followUps: [
      'The profile shows most time inside `requests`. What now?',
      'How would you make the next regression obvious?',
    ],
    tags: ['scenario', 'performance', 'profiling', 'debugging', 'advanced'],
  },
]
