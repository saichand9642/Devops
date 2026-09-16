import type { InterviewQuestion } from '../../../types'

/** Python as a DevOps tool: automation, cloud SDKs, testing and packaging. */
export const pythonAutomationQuestions: InterviewQuestion[] = [
  {
    id: 'itv-py-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you write a script to audit cloud resources across many accounts?',
    probing:
      'A realistic DevOps task combining the SDK, pagination, concurrency and error handling.',
    answer: [
      'The shape of it: assume a role in each account, page through the resources, collect what you need, and produce a report. The parts that are easy to get wrong are pagination, concurrency and partial failure.',
      '**Pagination** first, because it is the quietest failure. The AWS SDK returns a page at a time, and a script that ignores that silently reports only the first page - which looks like a successful audit finding fewer resources than exist. **Paginators** handle this and should be used by default rather than manual `NextToken` handling.',
      '**Credentials**: assume a role per account with STS rather than holding credentials for each. One set of credentials with permission to assume a read-only audit role in every account is far easier to manage and to revoke.',
      '**Concurrency**: this is I/O-bound, so a thread pool across accounts and regions turns a job that takes an hour into one that takes a minute. Bound the pool, because the API will rate-limit.',
      '**Partial failure**: one account being inaccessible must not lose the results for the other forty. Collect errors alongside results and report both, so the output distinguishes "nothing found" from "could not check".',
      'And **output something machine-readable** - JSON or CSV - so the audit can be diffed against the previous run rather than read by eye.',
    ],
    code: [
      {
        title: 'Cross-account audit with paginators and threads',
        language: 'python',
        code: `import boto3
import logging
from botocore.exceptions import ClientError
from concurrent.futures import ThreadPoolExecutor, as_completed

log = logging.getLogger(__name__)


def session_for(account_id: str, role: str = "SecurityAudit") -> boto3.Session:
    sts = boto3.client("sts")
    creds = sts.assume_role(
        RoleArn=f"arn:aws:iam::{account_id}:role/{role}",
        RoleSessionName="resource-audit",
    )["Credentials"]
    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    )


def public_buckets(account_id: str) -> dict:
    """Return findings for one account, or the error that prevented checking."""
    try:
        session = session_for(account_id)
        s3 = session.client("s3")
        findings = []

        # Paginator - never hand-roll NextToken handling
        for page in s3.get_paginator("list_buckets").paginate():
            for bucket in page.get("Buckets", []):
                name = bucket["Name"]
                try:
                    block = s3.get_public_access_block(Bucket=name)
                    cfg = block["PublicAccessBlockConfiguration"]
                    if not all(cfg.values()):
                        findings.append({"bucket": name, "config": cfg})
                except ClientError as exc:
                    if exc.response["Error"]["Code"] == "NoSuchPublicAccessBlockConfiguration":
                        findings.append({"bucket": name, "config": None})
                    else:
                        log.warning("%s/%s: %s", account_id, name, exc)

        return {"account": account_id, "findings": findings, "error": None}

    except ClientError as exc:
        # One bad account must not lose the whole audit
        return {"account": account_id, "findings": [], "error": str(exc)}


def audit(accounts: list[str], workers: int = 10) -> list[dict]:
    results = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(public_buckets, a): a for a in accounts}
        for fut in as_completed(futures):
            results.append(fut.result())
    return results`,
      },
    ],
    traps: [
      'Ignoring pagination and silently auditing only the first page.',
      'One failed account aborting the entire run.',
      'Unbounded concurrency, triggering API rate limiting.',
      'Long-lived credentials per account instead of assuming a role.',
      'Human-readable output only, so runs cannot be compared.',
    ],
    followUps: [
      'What happens if you ignore pagination?',
      'How would you distinguish "no findings" from "could not check"?',
    ],
    tags: ['boto3', 'aws', 'automation', 'pagination', 'concurrency'],
  },
  {
    id: 'itv-py-23',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you test a script that calls external services?',
    probing: 'Testability of operational code, which is usually neglected.',
    answer: [
      'The principle is to **separate the logic from the I/O**, so the logic can be tested without any network at all. A function that fetches data, transforms it and writes it somewhere is hard to test; the same split into fetch, transform and write is trivial - the transform is a pure function with no dependencies.',
      'For the parts that do touch external services, there are three approaches. **Mocking** with `unittest.mock` replaces the client and lets you assert what was called; it is fast and can drift from the real API. **`responses` or `requests-mock`** intercept HTTP at the transport level, which is closer to reality and still fast. **`moto`** mocks AWS services convincingly, so `boto3` code can be tested against an in-memory AWS.',
      'The most valuable tests for operational scripts are usually not the happy path. **Failure handling** is where the bugs are: what does the script do on a timeout, a 500, a rate limit, a partial response, malformed data? Those paths are rarely exercised in practice and are exactly the ones that matter at 3am.',
      'And **integration tests** against a real environment - a throwaway account or a local container - have a place, but sparingly: they are slow and flaky, so keep them for the few paths where the mock genuinely cannot tell you anything useful.',
    ],
    code: [
      {
        title: 'Split the logic out, then test it with no I/O at all',
        language: 'python',
        code: `# Hard to test - fetching and logic are tangled
def report_unhealthy():
    r = requests.get("https://api.example.com/hosts")
    return [h["name"] for h in r.json() if h["status"] != "healthy"]

# Easy to test - the logic is a pure function
def unhealthy_hosts(hosts: list[dict]) -> list[str]:
    return [h["name"] for h in hosts if h["status"] != "healthy"]

def fetch_hosts(session) -> list[dict]:
    r = session.get("https://api.example.com/hosts", timeout=10)
    r.raise_for_status()
    return r.json()

# test - no network, no mocking needed
def test_unhealthy_hosts():
    assert unhealthy_hosts([
        {"name": "a", "status": "healthy"},
        {"name": "b", "status": "degraded"},
    ]) == ["b"]`,
      },
      {
        title: 'Testing the failure paths, which is where the bugs are',
        language: 'python',
        code: `import pytest, requests, responses


@responses.activate
def test_retries_then_succeeds():
    responses.add(responses.GET, "https://api.example.com/hosts", status=503)
    responses.add(responses.GET, "https://api.example.com/hosts", status=503)
    responses.add(responses.GET, "https://api.example.com/hosts",
                  json=[{"name": "a", "status": "healthy"}], status=200)

    hosts = fetch_hosts(make_session())
    assert len(hosts) == 1
    assert len(responses.calls) == 3          # it actually retried


@responses.activate
def test_gives_up_and_raises():
    for _ in range(6):
        responses.add(responses.GET, "https://api.example.com/hosts", status=500)
    with pytest.raises(requests.HTTPError):
        fetch_hosts(make_session())`,
      },
      {
        title: 'moto, for boto3 code',
        language: 'python',
        code: `import boto3
from moto import mock_aws


@mock_aws
def test_finds_public_bucket():
    s3 = boto3.client("s3", region_name="eu-west-1")
    s3.create_bucket(
        Bucket="test-bucket",
        CreateBucketConfiguration={"LocationConstraint": "eu-west-1"},
    )
    result = public_buckets_in_session(boto3.Session())
    assert "test-bucket" in [f["bucket"] for f in result]`,
      },
    ],
    traps: [
      'Only testing the happy path, leaving every error branch unexercised.',
      'Mocks that drift from the real API, so tests pass and production fails.',
      'Everything in one function, so nothing can be tested without the network.',
      'Integration tests everywhere, making the suite slow and flaky.',
    ],
    followUps: [
      'Which tests give the most value for an operational script?',
      'What is the risk of heavy mocking?',
    ],
    tags: ['testing', 'pytest', 'mocking', 'moto', 'quality'],
  },
  {
    id: 'itv-py-24',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between `is` and `==`?',
    probing: 'A fundamental with a specific gotcha attached.',
    options: [
      {
        id: 'a',
        text: '`is` compares object identity - whether they are the same object; `==` compares value',
      },
      { id: 'b', text: 'They are equivalent for all types' },
      { id: 'c', text: '`is` is for numbers and `==` for strings' },
      { id: 'd', text: '`is` is a faster version of `==`' },
    ],
    correct: ['a'],
    answer: [
      "`is` asks whether two names refer to **the same object in memory**. `==` asks whether they are **equal in value**, using the type's `__eq__`.",
      'Two lists with identical contents are `==` but not `is`. The same list referenced twice is both.',
      'The rule to apply: **use `is` only for singletons** - `None`, `True`, `False` - and `==` for everything else. `if x is None` is the correct idiom and is also faster.',
      'The gotcha that catches people is that small integers and short strings are **interned** by CPython, so `a = 256; b = 256; a is b` is True, while the same with 257 is False. That is an implementation detail, not a language guarantee, and code that relies on it breaks in ways that are very hard to explain.',
    ],
    code: [
      {
        title: 'Where the difference shows',
        language: 'python',
        code: `a = [1, 2, 3]
b = [1, 2, 3]
c = a

print(a == b)    # True  - same value
print(a is b)    # False - different objects
print(a is c)    # True  - same object

# Interning: an implementation detail, never rely on it
x = 256; y = 256
print(x is y)    # True  (small ints are cached)
x = 257; y = 257
print(x is y)    # False (usually)

# The correct idiom
if value is None:        # right
    ...
if value == None:        # works, but non-idiomatic and slower`,
      },
    ],
    traps: [
      '`is` used to compare values, which works by accident for small integers and fails for larger ones.',
      '`if x == None` instead of `is None`.',
      'Assuming interning behaviour is guaranteed - it varies between implementations and versions.',
    ],
    followUps: ['Why is `x is None` preferred over `x == None`?'],
    tags: ['identity', 'equality', 'gotchas', 'fundamentals'],
  },
  {
    id: 'itv-py-25',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are type hints and are they worth using in scripts?',
    probing: 'Modern Python practice, with a judgement about where it pays off.',
    answer: [
      'Type hints annotate parameters, returns and variables with their expected types. Python **does not enforce them at runtime** - they are checked by a separate tool such as **mypy** or **pyright**, or used by an editor for completion and inline errors.',
      'They are worth it for anything that will be **read or modified by someone else, or by you in six months**. The main value is not catching type errors - though it does - but as **documentation that cannot go stale**, because a checker fails when the annotation and the code disagree. A docstring saying a function returns a list keeps saying that long after it started returning a dict.',
      'For a **ten-line throwaway script** they add noise for little benefit. For a **shared library, a tool other people use, or anything in CI**, they pay for themselves quickly - particularly `Optional` handling, which is where a large share of real Python bugs live. A checker that tells you a value can be `None` on this path catches the class of bug that produces an AttributeError on a None value in production.',
      'The practical approach for an existing codebase is **gradual typing**: annotate new code and the parts you touch, run mypy in non-strict mode in CI, and tighten over time. Trying to annotate everything at once rarely finishes.',
    ],
    code: [
      {
        title: 'Types as documentation the checker enforces',
        language: 'python',
        code: `from dataclasses import dataclass
from typing import Iterator


@dataclass(frozen=True)
class Host:
    name: str
    status: str
    region: str
    tags: dict[str, str]


def unhealthy(hosts: list[Host], region: str | None = None) -> list[Host]:
    """Hosts not reporting healthy, optionally filtered by region."""
    candidates = hosts if region is None else [h for h in hosts if h.region == region]
    return [h for h in candidates if h.status != "healthy"]


def stream_events(path: str) -> Iterator[dict[str, object]]:
    ...


# mypy catches this before it runs:
#   unhealthy(hosts, region=5)
#   error: Argument "region" has incompatible type "int"; expected "str | None"`,
      },
      {
        title: 'In CI, gradually',
        language: 'text',
        code: `# pyproject.toml
[tool.mypy]
python_version = "3.12"
warn_return_any = true
warn_unused_ignores = true
# Start permissive, tighten module by module
disallow_untyped_defs = false

[[tool.mypy.overrides]]
module = "myapp.core.*"
disallow_untyped_defs = true        # fully typed here already`,
      },
    ],
    traps: [
      'Expecting type hints to be enforced at runtime. They are not.',
      'Annotations that have drifted from the code, with no checker in CI to catch it - worse than none.',
      'Over-engineering types on a throwaway script.',
      '`Any` used liberally, which disables checking while looking annotated.',
    ],
    followUps: [
      'What class of bug do type hints catch most often?',
      'How would you introduce typing to an existing codebase?',
    ],
    tags: ['type hints', 'mypy', 'quality', 'documentation'],
  },
  {
    id: 'itv-py-26',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you package and distribute a Python CLI tool for your team?',
    probing: 'Distribution, which is where internal tools usually fall down.',
    answer: [
      'The modern approach is a **`pyproject.toml`** declaring the metadata, dependencies and an **entry point**, which creates a command on the path when installed. Build with `build`, publish to an internal package index, and install with `pipx` so the tool gets its own isolated environment rather than colliding with whatever else is installed.',
      "**`pipx` is the detail that matters** for CLI tools specifically. `pip install` into a user's environment means your tool's dependencies conflict with theirs; `pipx` gives each tool its own virtual environment while putting the command on the path. `uv tool install` does the same thing faster.",
      'The alternative for a team that will not manage Python environments is to **ship a container image** and provide a shell wrapper, or to build a **single-file executable** with PyInstaller or Shiv. Both avoid the environment problem entirely at the cost of size and build complexity.',
      'Whichever you choose, the things that make an internal tool actually get used: **`--help` that explains itself**, **a version flag** so bug reports are actionable, **sensible defaults** so the common case needs no flags, **`--dry-run`** on anything that makes changes, and **clear error messages** that say what to do rather than showing a traceback.',
      'And **version it properly** with a changelog, so upgrading is a decision rather than a surprise.',
    ],
    code: [
      {
        title: 'pyproject.toml with an entry point',
        language: 'text',
        code: `[project]
name = "acme-deploy"
version = "1.4.2"
description = "Deploy releases to Acme environments"
requires-python = ">=3.11"
dependencies = [
    "click>=8.1",
    "requests>=2.32",
    "pydantic-settings>=2.4",
]

[project.scripts]
acme-deploy = "acme_deploy.cli:main"     # creates the command on the path

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"`,
      },
      {
        title: 'A CLI that is pleasant to use',
        language: 'python',
        code: `import click


@click.group()
@click.version_option()                      # --version, for bug reports
def main() -> None:
    """Deploy releases to Acme environments."""


@main.command()
@click.argument("version")
@click.option("--environment", "-e",
              type=click.Choice(["dev", "staging", "prod"]), default="dev")
@click.option("--dry-run", is_flag=True, help="Show what would happen, change nothing")
def deploy(version: str, environment: str, dry_run: bool) -> None:
    """Deploy VERSION to an environment."""
    if dry_run:
        click.echo(f"would deploy {version} to {environment}")
        return
    if environment == "prod":
        click.confirm(f"Deploy {version} to PRODUCTION?", abort=True)
    ...`,
      },
      {
        title: 'Install and use',
        language: 'bash',
        code: `# Isolated environment per tool, command on the path
pipx install --index-url https://pypi.internal.example.com/simple acme-deploy
# or
uv tool install acme-deploy

acme-deploy --version
acme-deploy deploy 1.4.2 -e staging --dry-run`,
      },
    ],
    traps: [
      "`pip install` into the user's environment, causing dependency conflicts.",
      'A tool distributed by telling people to clone the repository and run a script.',
      'No `--version`, so bug reports cannot be tied to a release.',
      'No `--dry-run` on a tool that makes production changes.',
    ],
    followUps: [
      'Why `pipx` rather than `pip` for a CLI tool?',
      'What makes an internal tool one people actually use?',
    ],
    tags: ['packaging', 'cli', 'pipx', 'distribution', 'developer experience'],
  },
  {
    id: 'itv-py-27',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is `asyncio` and when would you use it instead of threads?',
    probing: 'Async concurrency and the practical trade-off against threads.',
    answer: [
      '`asyncio` is **cooperative concurrency in a single thread**. Coroutines run on an event loop and yield control at `await` points, so one thread can have thousands of operations in flight - but only while they are waiting on I/O.',
      'The comparison with threads: **threads** are pre-emptive and managed by the OS, costing perhaps a megabyte of stack each, so a few hundred is practical. **asyncio** tasks are cheap objects, so tens of thousands are practical. For very high concurrency against I/O, asyncio wins substantially.',
      'The costs are real. It requires **async-aware libraries all the way down** - `httpx` or `aiohttp` rather than `requests`, `asyncpg` rather than `psycopg2` in blocking mode. A single **blocking call** in a coroutine stalls the entire event loop and every other task with it, which is a failure mode that does not exist with threads. And async code is harder to reason about and to debug.',
      'For most DevOps scripting, **threads are the right answer**: you are making a few hundred API calls or SSH connections, `ThreadPoolExecutor` handles it in five lines, and every library works. Reach for asyncio when the concurrency is genuinely high - thousands of simultaneous connections - or when you are working in a codebase that is already async.',
    ],
    code: [
      {
        title: 'Very high concurrency with asyncio',
        language: 'python',
        code: `import asyncio
import httpx


async def check(client: httpx.AsyncClient, host: str, sem: asyncio.Semaphore):
    async with sem:                       # bound concurrency, or you DoS the target
        try:
            r = await client.get(f"https://{host}/healthz", timeout=5.0)
            return host, r.status_code
        except httpx.HTTPError:
            return host, None


async def check_all(hosts: list[str], limit: int = 100):
    sem = asyncio.Semaphore(limit)
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(check(client, h, sem) for h in hosts))
    return [(h, s) for h, s in results if s != 200]


unhealthy = asyncio.run(check_all([f"host-{i}.example.com" for i in range(5000)]))`,
      },
      {
        title: 'The same thing with threads - simpler, and usually enough',
        language: 'python',
        code: `from concurrent.futures import ThreadPoolExecutor
import requests

def check(host: str):
    try:
        return host, requests.get(f"https://{host}/healthz", timeout=5).status_code
    except requests.RequestException:
        return host, None

with ThreadPoolExecutor(max_workers=50) as pool:
    unhealthy = [(h, s) for h, s in pool.map(check, hosts) if s != 200]`,
      },
    ],
    traps: [
      'A blocking call inside a coroutine, which stalls the whole event loop.',
      'Using `requests` in async code - it is blocking; use `httpx` or `aiohttp`.',
      'Unbounded `gather`, which opens as many connections as there are items.',
      'Choosing asyncio for a few hundred requests where threads are simpler.',
    ],
    followUps: [
      'What happens if you make a blocking call in a coroutine?',
      'At what point does asyncio become worth the complexity?',
    ],
    tags: ['asyncio', 'concurrency', 'threads', 'performance', 'advanced'],
  },
  {
    id: 'itv-py-28',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you work with JSON and YAML in Python?',
    probing: 'Everyday data handling, including the YAML security issue.',
    answer: [
      '**JSON** is in the standard library: `json.load`/`json.loads` to parse, `json.dump`/`json.dumps` to write. The arguments worth knowing are `indent` for readable output and `default=str` for serialising types like `datetime` that JSON does not handle natively.',
      '**YAML** needs `PyYAML`, and the critical detail is to always use **`yaml.safe_load`**, never `yaml.load` without a safe loader. Plain `yaml.load` can construct arbitrary Python objects from the file, which means a YAML file can execute code. For configuration files that anyone can edit - which is most of them - that is a real vulnerability.',
      '`yaml.safe_dump` is the equivalent for writing, and `sort_keys=False` preserves your ordering rather than alphabetising it.',
      'For **structured validation**, parsing into a `pydantic` model rather than a raw dict gives you type checking, defaults and a clear error naming the bad field - much better than discovering a missing key with a `KeyError` halfway through a run.',
      'And for **large JSON** documents, `ijson` streams rather than loading the whole structure, which matters when a file will not fit in memory.',
    ],
    code: [
      {
        title: 'JSON and YAML, safely',
        language: 'python',
        code: `import json, yaml, pathlib
from datetime import datetime

# JSON
data = json.loads(pathlib.Path("config.json").read_text())
pathlib.Path("out.json").write_text(
    json.dumps(data, indent=2, default=str, sort_keys=True)
)

# YAML - safe_load, always
config = yaml.safe_load(pathlib.Path("config.yaml").read_text())

# NEVER this - it can construct arbitrary objects from the file
# config = yaml.load(open("config.yaml"))

pathlib.Path("out.yaml").write_text(
    yaml.safe_dump(config, sort_keys=False, default_flow_style=False)
)`,
      },
      {
        title: 'Validate on parse rather than failing later',
        language: 'python',
        code: `from pydantic import BaseModel, Field, ValidationError
import yaml, sys


class ServiceConfig(BaseModel):
    name: str
    replicas: int = Field(default=2, ge=1, le=50)
    port: int = Field(default=8080, ge=1, le=65535)
    environment: str


try:
    cfg = ServiceConfig(**yaml.safe_load(open("service.yaml")))
except ValidationError as exc:
    # Names the field and the problem, rather than a KeyError later
    print(exc, file=sys.stderr)
    sys.exit(2)`,
      },
    ],
    traps: [
      '`yaml.load` without a safe loader - arbitrary code execution from a config file.',
      'Assuming YAML preserves key order on a round trip without `sort_keys=False`.',
      'Loading a very large JSON document entirely into memory.',
      'Accessing nested dict keys directly, producing `KeyError` rather than a clear message.',
    ],
    followUps: ['Why is `yaml.load` dangerous?', 'How would you parse a 2 GB JSON file?'],
    tags: ['json', 'yaml', 'security', 'pydantic', 'fundamentals'],
  },
  {
    id: 'itv-py-29',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A long-running Python service is slowly consuming more and more memory. How do you find the leak?',
    probing: 'Memory debugging, which most people have never had to do.',
    answer: [
      "Python has a garbage collector, so a true leak is rare - what usually happens is that **something holds a reference that should have been released**, so objects accumulate legitimately from the interpreter's point of view.",
      'First **confirm the shape of it**: is memory growing linearly with time, with requests handled, or in steps? Linear growth with work done suggests an accumulating collection; steps suggest a cache with no eviction.',
      'Then **find what is accumulating**. `tracemalloc` is in the standard library and is the right first tool: take a snapshot early, another later, and diff them - it tells you which lines allocated the memory that is still held. `objgraph` shows which object types have grown and what is referencing them, which is how you find the container holding them.',
      'The usual causes are a short list. **An unbounded cache or dict** that is only ever added to. **A list that accumulates** - collecting results, or appending to a log buffer that is never flushed. **Event handlers or callbacks registered and never removed**, which keep their closures alive. **Reference cycles involving objects with `__del__`**, which older Python could not collect. And **a C extension leaking**, which Python-level tools will not see.',
      'The fix follows the finding: bound the cache with `lru_cache(maxsize=...)` or a TTL, use `weakref` where the reference should not keep the object alive, or simply stop accumulating.',
      'And as a practical mitigation while you investigate: a **periodic restart** is a legitimate stopgap for a slow leak in a service that can be restarted safely. It is not a fix, and it buys the time to find one.',
    ],
    code: [
      {
        title: 'tracemalloc - what allocated the memory still held?',
        language: 'python',
        code: `import tracemalloc

tracemalloc.start(25)                    # keep 25 frames of traceback
snapshot1 = tracemalloc.take_snapshot()

run_workload_for_a_while()

snapshot2 = tracemalloc.take_snapshot()
for stat in snapshot2.compare_to(snapshot1, "lineno")[:15]:
    print(stat)
# e.g. cache.py:42: size=412 MiB (+410 MiB), count=1048576 (+1047000)`,
      },
      {
        title: 'objgraph - which types grew, and what holds them?',
        language: 'python',
        code: `import objgraph

objgraph.show_growth(limit=15)           # types that grew since last call

# What is keeping these alive?
objgraph.show_backrefs(
    objgraph.by_type("MyRequestContext")[:3],
    max_depth=6,
    filename="backrefs.png",
)`,
      },
      {
        title: 'The common causes and their fixes',
        language: 'python',
        code: `from functools import lru_cache
import weakref

# Unbounded cache - grows forever
_cache: dict[str, Result] = {}

# Bounded - evicts least recently used
@lru_cache(maxsize=1024)
def lookup(key: str) -> Result: ...

# A registry that should not keep its entries alive
_listeners = weakref.WeakSet()     # entries vanish when nothing else holds them

# An accumulating list in a long-running loop
results = []
while True:
    results.append(process())      # never cleared - this is the leak
    # write out and clear periodically instead`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Finding a memory leak',
        caption: 'A periodic restart is a legitimate stopgap while you investigate - not a fix.',
        nodes: [
          {
            label: 'Characterise the growth',
            detail: 'Linear with work, or in steps?',
            tone: 'accent',
          },
          { label: 'tracemalloc snapshot diff', detail: 'Which line allocated what is still held' },
          { label: 'objgraph: which types grew?', detail: 'And what references them' },
          {
            label: 'Usual causes',
            detail: 'Unbounded cache, accumulating list, live callbacks',
            tone: 'warning',
          },
          { label: 'Bound it, or use weakref', tone: 'success' },
          {
            label: 'Restart periodically meanwhile',
            detail: 'Buys time, does not fix it',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      'Memory fragmentation can look like a leak: memory is freed by Python but not returned to the OS, so RSS stays high. `tracemalloc` showing no growth while RSS does is the signature.',
      '`gc.set_debug(gc.DEBUG_LEAK)` surfaces uncollectable cycles, which are rarer in modern Python but still possible with C extensions.',
      'In a container, the memory limit is the thing that turns a slow leak into an OOMKill - so the symptom is often a restart loop rather than a gradual slowdown.',
    ],
    traps: [
      'Assuming Python cannot leak because it has a garbage collector.',
      'Raising the memory limit rather than finding the cause - it buys weeks and recurs.',
      'Missing that the growth is in a C extension, which Python tools will not show.',
      '`lru_cache` with no `maxsize`, which is unbounded by default in older usage.',
    ],
    followUps: [
      'What is the difference between a leak and fragmentation?',
      'Is a periodic restart an acceptable answer?',
    ],
    tags: ['scenario', 'memory', 'tracemalloc', 'debugging', 'advanced'],
  },
  {
    id: 'itv-py-30',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does this print?',
    promptCode: [
      {
        title: 'Shallow versus deep copy',
        language: 'python',
        code: `import copy

original = {"name": "app", "ports": [80, 443]}
shallow = copy.copy(original)
shallow["ports"].append(8080)

print(original["ports"])`,
      },
    ],
    probing: 'Copy semantics, which produce genuinely confusing bugs with nested config.',
    options: [
      { id: 'a', text: '[80, 443]' },
      { id: 'b', text: '[80, 443, 8080]' },
      { id: 'c', text: '[8080]' },
      { id: 'd', text: 'It raises a TypeError' },
    ],
    correct: ['b'],
    answer: [
      'A **shallow copy** creates a new outer object but the values inside are **the same objects**. So `shallow["ports"]` and `original["ports"]` refer to the identical list, and appending through one is visible through the other.',
      '`copy.deepcopy()` recursively copies everything, so the nested list would be independent. It is slower and can fail on objects that are not copyable, but it is what you want when you genuinely need an independent structure.',
      'This bites in real code when a **default configuration dictionary** is shallow-copied per environment and then modified - the modification leaks back into the default and into every other environment that copied it afterwards. It looks like configuration randomly changing.',
      'The same applies to slicing a list of lists, and to `dict.copy()`, both of which are shallow.',
    ],
    code: [
      {
        title: 'Shallow, deep, and the pattern that avoids the question',
        language: 'python',
        code: `import copy

original = {"name": "app", "ports": [80, 443]}

shallow = copy.copy(original)
shallow["ports"].append(8080)
print(original["ports"])          # [80, 443, 8080] - shared

deep = copy.deepcopy(original)
deep["ports"].append(9090)
print(original["ports"])          # unchanged by this one

# Better: build a new structure rather than copying and mutating
def with_overrides(base: dict, **overrides) -> dict:
    return {**base, **overrides}  # still shallow for nested values - be aware`,
      },
    ],
    traps: [
      'A shallow-copied default config mutated per environment, leaking changes back.',
      'Assuming `dict.copy()` or a list slice is deep. Neither is.',
      '`deepcopy` on something holding a file handle or a socket, which fails or does something unexpected.',
    ],
    followUps: ['Where would this bite in a configuration-handling script?'],
    tags: ['copy', 'mutability', 'gotchas', 'configuration'],
  },
  {
    id: 'itv-py-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you write a script that must not run twice at the same time?',
    probing: 'Mutual exclusion, which matters for cron jobs that occasionally overrun.',
    answer: [
      'The situation is a scheduled job that normally takes two minutes but occasionally takes twenty, so the next scheduled run starts while the first is still going - and two instances doing the same work concurrently corrupt something.',
      'On a **single machine**, a file lock is the right answer. `fcntl.flock` with `LOCK_EX | LOCK_NB` acquires a lock or fails immediately, and the kernel **releases it automatically if the process dies** - which is the important property. A lock implemented as "create a file, delete it at the end" leaks the lock on a crash and blocks every subsequent run until someone notices.',
      'Across **multiple machines**, you need a distributed lock: a Redis key with an expiry, a database row with a unique constraint, a DynamoDB conditional write, or a Kubernetes lease. The essential property is a **TTL**, so a holder that dies does not hold the lock forever.',
      'The behaviour on failure to acquire is a design decision: **exit quietly** if a missed run is acceptable, or **fail loudly** if it is not. Exiting silently is usually right for a periodic job and wrong for something that must run.',
      'And the better answer where it applies is to make the work **idempotent**, so a concurrent run is harmless. That removes the problem rather than guarding against it.',
    ],
    code: [
      {
        title: 'A file lock that survives a crash',
        language: 'python',
        code: `import fcntl
import os
import sys
from contextlib import contextmanager


@contextmanager
def single_instance(lock_path: str = "/var/run/myjob.lock"):
    """Exclusive lock, released by the kernel even if the process is killed."""
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        raise RuntimeError("another instance is already running")

    try:
        os.ftruncate(fd, 0)
        os.write(fd, f"{os.getpid()}\\n".encode())
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


try:
    with single_instance():
        do_the_work()
except RuntimeError as exc:
    print(exc, file=sys.stderr)
    sys.exit(0)          # a skipped run is fine here; use 1 if it is not`,
      },
      {
        title: 'Across machines, with a TTL',
        language: 'python',
        code: `import redis, socket, os
from contextlib import contextmanager

r = redis.Redis(host="redis.example.com")


@contextmanager
def distributed_lock(name: str, ttl_seconds: int = 3600):
    token = f"{socket.gethostname()}:{os.getpid()}"
    # SET NX EX - acquire only if absent, expire automatically
    if not r.set(name, token, nx=True, ex=ttl_seconds):
        raise RuntimeError(f"lock {name} held by {r.get(name)}")
    try:
        yield
    finally:
        # Only release if we still hold it - do not delete someone else's lock
        if r.get(name) == token.encode():
            r.delete(name)`,
        explanation:
          'The TTL is what stops a dead holder blocking the job forever; the token check stops releasing a lock that has since been taken by someone else.',
      },
    ],
    traps: [
      'A lock file created and deleted manually, which leaks on a crash.',
      'No TTL on a distributed lock, so a dead process blocks every future run.',
      'Releasing a lock without checking you still hold it.',
      'A TTL shorter than the job can legitimately take, so two instances run anyway.',
    ],
    followUps: [
      'Why is `flock` better than creating a lock file?',
      'What is the better answer if the work can be made idempotent?',
    ],
    tags: ['locking', 'concurrency', 'cron', 'scripting', 'reliability'],
  },
  {
    id: 'itv-py-32',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you work with paths and files portably?',
    probing: '`pathlib` versus string manipulation - a small thing that improves every script.',
    answer: [
      '`pathlib.Path` replaces string manipulation and most of `os.path`. Paths are objects with methods, the `/` operator joins them, and the same code works on Linux, macOS and Windows without thinking about separators.',
      'The methods worth knowing: `.exists()`, `.is_file()`, `.is_dir()`, `.mkdir(parents=True, exist_ok=True)`, `.read_text()` and `.write_text()` (which handle opening and closing for you), `.glob()` and `.rglob()` for finding files, `.stat()` for size and times, `.unlink(missing_ok=True)`, and `.name`, `.stem`, `.suffix`, `.parent` for decomposing a path.',
      'The improvement over string concatenation is not just aesthetic. `"/var/log" + "/" + filename` breaks when `filename` starts with a slash or contains a separator; `Path("/var/log") / filename` handles it correctly and is harder to get wrong.',
      'For **temporary files**, `tempfile.TemporaryDirectory` as a context manager creates one and removes it whatever happens - much safer than constructing a path in `/tmp` yourself, which is both a cleanup problem and a security one (predictable temporary paths are a real vulnerability class).',
    ],
    code: [
      {
        title: 'pathlib for the common operations',
        language: 'python',
        code: `from pathlib import Path
import tempfile

log_dir = Path("/var/log/myapp")
log_dir.mkdir(parents=True, exist_ok=True)

# The / operator joins correctly, whatever the platform
config = Path.home() / ".config" / "myapp" / "config.yaml"
if config.exists():
    settings = config.read_text()

# Find files, recursively, with size and age
for path in sorted(log_dir.rglob("*.log")):
    stat = path.stat()
    print(f"{path.name:40s} {stat.st_size / 1_048_576:8.1f} MB")

# Decompose a path
p = Path("/var/log/myapp/access-2026-09-16.log.gz")
print(p.name)     # access-2026-09-16.log.gz
print(p.stem)     # access-2026-09-16.log
print(p.suffix)   # .gz
print(p.parent)   # /var/log/myapp

# Temporary directory, always cleaned up
with tempfile.TemporaryDirectory() as tmp:
    work = Path(tmp)
    (work / "artifact.tar.gz").write_bytes(download())`,
      },
    ],
    traps: [
      'String concatenation for paths, which breaks on edge cases and platforms.',
      'Constructing a predictable path in `/tmp`, which is both a cleanup and a security problem.',
      'Forgetting `exist_ok=True` on `mkdir`, so a second run fails.',
      'Passing a `Path` to a library expecting a string - most accept it now, but older ones need `str(path)`.',
    ],
    followUps: ['Why is a predictable path in `/tmp` a security problem?'],
    tags: ['pathlib', 'files', 'portability', 'tempfile', 'fundamentals'],
  },
  {
    id: 'itv-py-33',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these belong in a Python script that will run in production automation? Select all that apply.',
    probing: 'Production readiness for operational code.',
    options: [
      { id: 'a', text: 'Structured logging to stderr, with a configurable level' },
      { id: 'b', text: 'Meaningful exit codes, and non-zero on any failure' },
      { id: 'c', text: 'Timeouts on every network call and subprocess' },
      {
        id: 'd',
        text: 'A broad `try/except Exception` at the top that logs and exits zero, so the pipeline never fails',
      },
      { id: 'e', text: 'A `--dry-run` mode, and idempotent operations where possible' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Exiting zero after catching an exception is the wrong one, and it is actively harmful. The caller - CI, a scheduler, another script - decides what to do based on the exit code. A script that fails and reports success means nobody finds out until the consequences surface somewhere else, much later and much harder to trace.',
      'The others are the baseline. **Structured logging to stderr** keeps diagnostic output separate from results and gives you levels and timestamps. **Meaningful exit codes** let a caller distinguish a configuration problem from an unreachable service without parsing text.',
      '**Timeouts everywhere** - `requests` has no default, and neither does `subprocess` - because a script that hangs forever in automation is worse than one that fails, since it holds a runner and blocks a queue.',
      '**`--dry-run` and idempotence** are what make a script safe to run: dry-run lets you check what it would do before it does it, and idempotence means a retry after a partial failure is safe rather than a second set of changes.',
      'I would add: validate inputs at startup, handle SIGTERM so a container stop is graceful, and emit enough context in errors to act on without reading the source.',
    ],
    code: [
      {
        title: 'Graceful shutdown, which containers require',
        language: 'python',
        code: `import signal, sys, logging

log = logging.getLogger(__name__)
_shutting_down = False


def handle_sigterm(signum, frame):
    global _shutting_down
    log.info("SIGTERM received, finishing current item then exiting")
    _shutting_down = True


signal.signal(signal.SIGTERM, handle_sigterm)

for item in work_queue:
    if _shutting_down:
        log.info("stopping cleanly with %d items remaining", remaining)
        sys.exit(0)
    process(item)`,
      },
    ],
    traps: [
      'Exiting zero on failure, so the pipeline reports success.',
      'No timeouts, so a hung call blocks a runner for hours.',
      'No SIGTERM handling, so a container stop kills the script mid-write.',
      'No dry-run on a script that makes production changes.',
    ],
    followUps: ['Why does exiting zero after a failure cause more harm than crashing?'],
    tags: ['production', 'exit codes', 'signals', 'timeouts', 'best practices'],
  },
]
