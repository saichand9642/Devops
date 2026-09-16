import type { InterviewQuestion } from '../../../types'

/** The questions that come up in almost every prometheus round. */
export const prometheusCoreQuestions: InterviewQuestion[] = [
  {
    id: 'itv-prom-1',
    level: 'basic',
    kind: 'open',
    prompt: 'How does Prometheus collect metrics? Explain the pull model and its trade-offs.',
    probing:
      'The architectural decision that shapes everything else. They want you to articulate both sides.',
    answer: [
      'Prometheus **pulls**. Each target exposes a plain-text `/metrics` endpoint over HTTP, and Prometheus scrapes it on a schedule - typically every 15 to 60 seconds - then stores the samples in its local time-series database.',
      'The advantages are real. Prometheus knows whether a target is up, because a failed scrape is itself a signal (`up == 0`) - with push you cannot distinguish "healthy but quiet" from "dead". You control the scrape rate centrally rather than having every application decide. And you can curl a `/metrics` endpoint by hand to debug it, which makes the whole system very approachable.',
      'The costs are equally real. Prometheus must be able to **reach** every target, which is awkward across NAT, firewalls or the public internet. And short-lived jobs may finish before they are ever scraped.',
      'The escape hatch for that last case is the **Pushgateway**, where a batch job pushes its result and Prometheus scrapes the gateway. It should be used sparingly - it is explicitly not a general push mechanism, and metrics pushed there persist until deleted, which can produce stale data.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'A scrape cycle',
        caption: 'A failed scrape is itself a metric. That is the strongest argument for pull.',
        participants: [
          { id: 'prom', label: 'Prometheus' },
          { id: 'sd', label: 'Service discovery' },
          { id: 'target', label: 'Your app' },
        ],
        messages: [
          { from: 'prom', to: 'sd', label: 'which targets exist now?' },
          { from: 'sd', to: 'prom', label: 'list of endpoints', kind: 'return' },
          { from: 'prom', to: 'target', label: 'GET /metrics every 15s' },
          { from: 'target', to: 'prom', label: 'text exposition format', kind: 'return' },
          { from: 'prom', to: 'prom', label: 'store samples, record up=1' },
          { from: 'prom', to: 'prom', label: 'evaluate rules and alerts' },
        ],
      },
    ],
    code: [
      {
        title: 'What a target actually exposes',
        language: 'text',
        explanation:
          'Plain text, one sample per line. `# HELP` and `# TYPE` are metadata. You can read this with curl.',
        code: `$ curl -s localhost:8080/metrics

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/users",status="200"} 48231
http_requests_total{method="GET",path="/api/users",status="500"} 17

# HELP process_resident_memory_bytes Resident memory
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 5.8720256e+07

# HELP http_request_duration_seconds Request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 45120
http_request_duration_seconds_bucket{le="0.5"} 48001
http_request_duration_seconds_bucket{le="+Inf"} 48248
http_request_duration_seconds_sum 3021.4
http_request_duration_seconds_count 48248`,
      },
    ],
    traps: [
      'Saying pull is simply better. It has a genuine weakness with short-lived jobs and unreachable networks.',
      'Reaching for the Pushgateway as a general solution. It is for batch jobs only, and it introduces staleness.',
    ],
    followUps: [
      'How do you monitor a cron job that runs for 10 seconds?',
      'How does Prometheus know what to scrape in Kubernetes?',
      'What does the `up` metric tell you?',
    ],
    tags: ['architecture', 'pull model', 'scraping'],
  },
  {
    id: 'itv-prom-2',
    level: 'basic',
    kind: 'mcq',
    prompt:
      'You want the per-second rate of HTTP errors over the last 5 minutes. Which query is correct?',
    options: [
      { id: 'a', text: 'http_requests_total{status="500"}' },
      { id: 'b', text: 'rate(http_requests_total{status="500"}[5m])' },
      { id: 'c', text: 'sum(http_requests_total{status="500"})' },
      { id: 'd', text: 'increase(http_requests_total{status="500"})' },
    ],
    correct: ['b'],
    probing: 'The single most important PromQL habit. A raw counter is almost never what you want.',
    answer: [
      '`rate(metric[5m])` gives the **per-second average rate of increase** over a 5-minute window. That is what you want from a counter.',
      'Option A is the raw counter - a number that only ever goes up since the process started. It tells you nothing about current behaviour, and it resets to zero on restart.',
      'Option C sums those meaningless totals across series, producing a bigger meaningless number.',
      'Option D is nearly right but syntactically incomplete - `increase()` needs a range selector too. `increase(m[5m])` gives the **total** increase over the window rather than a per-second rate, which is what you want for "how many errors in the last hour" rather than "how fast are errors arriving".',
      '`rate()` also handles **counter resets** correctly: if the process restarts and the counter goes back to zero, `rate()` recognises the drop and does not produce a huge negative spike.',
    ],
    code: [
      {
        title: 'The queries you will actually write',
        language: 'text',
        code: `# Per-second error rate
rate(http_requests_total{status=~"5.."}[5m])

# Error RATIO - almost always more useful than a raw count
sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
sum(rate(http_requests_total[5m]))

# Total errors in the last hour (a count, not a rate)
increase(http_requests_total{status=~"5.."}[1h])

# 95th percentile latency from a histogram.
# Note: rate() the buckets FIRST, then aggregate, then quantile.
histogram_quantile(0.95,
  sum by (le, service) (rate(http_request_duration_seconds_bucket[5m]))
)

# rate() vs irate(): rate is averaged and smooth (use for alerting),
# irate uses only the last two samples and is spiky (use for graphs).`,
      },
    ],
    traps: [
      'Graphing a raw counter and wondering why it only ever goes up.',
      'Using `irate()` in an alert - it is too spiky and will flap.',
      'A range window shorter than about 4x the scrape interval, which gives too few samples to be meaningful.',
    ],
    followUps: [
      'What is the difference between rate and irate?',
      'Why does rate handle counter resets correctly?',
      'How would you express an error budget?',
    ],
    tags: ['promql', 'counters', 'rate'],
  },
  {
    id: 'itv-prom-3',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain the four Prometheus metric types and when you would use each.',
    probing:
      'Instrumentation judgement. Picking the wrong type produces metrics that cannot answer the question.',
    answer: [
      '**Counter** only ever increases (or resets to zero on restart). Use it for things you count: requests served, errors, bytes sent, jobs completed. Always wrap it in `rate()` or `increase()`.',
      '**Gauge** goes up and down. Use it for a current value: memory in use, queue depth, active connections, temperature. You read a gauge directly - no `rate()` needed.',
      '**Histogram** counts observations into configurable buckets and exposes `_bucket`, `_sum` and `_count`. Use it for latency and response sizes. Because the buckets are exposed, you can compute quantiles **across instances** server-side with `histogram_quantile()`.',
      '**Summary** computes quantiles on the **client** and exposes them directly. It is cheaper to query but you **cannot aggregate** the quantiles - averaging the 95th percentile of ten instances is mathematically meaningless.',
      'The practical rule: use a **histogram** for latency in any distributed system. Summaries are only appropriate when you have one instance, or when you genuinely only care about per-instance quantiles.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which metric type?',
        caption:
          'The histogram-versus-summary choice is the one that matters, and aggregation is the deciding factor.',
        question: 'What are you measuring?',
        branches: [
          {
            condition: 'a count of events that only accumulates',
            result: 'Counter',
            detail: 'Requests, errors, bytes. Always rate() it.',
            tone: 'accent',
          },
          {
            condition: 'a value that goes up and down',
            result: 'Gauge',
            detail: 'Memory, queue depth, connections. Read directly.',
          },
          {
            condition: 'a distribution you need percentiles from',
            result: 'Histogram',
            detail: 'Latency. Aggregates across instances correctly.',
          },
          {
            condition: 'percentiles, single instance, cheap queries',
            result: 'Summary',
            detail: 'Quantiles cannot be aggregated - rarely the right choice',
            tone: 'warning',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Instrumenting in Python',
        language: 'python',
        explanation:
          'Note the bucket choice: buckets must bracket the latencies you care about, and they are fixed at definition time.',
        code: `from prometheus_client import Counter, Gauge, Histogram, start_http_server
import time

# Counter - monotonic. Labels are LOW cardinality only.
REQUESTS = Counter(
  "http_requests_total",
  "Total HTTP requests",
  ["method", "path", "status"],      # NOT user_id, NOT request_id
)

# Gauge - current value
QUEUE_DEPTH = Gauge("job_queue_depth", "Jobs waiting")

# Histogram - buckets must bracket what you care about.
# The default buckets are tuned for sub-second HTTP latency.
LATENCY = Histogram(
  "http_request_duration_seconds",
  "Request latency",
  ["method", "path"],
  buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)


def handle(method: str, path: str) -> int:
  start = time.perf_counter()
  status = 200
  try:
      ...                                  # do the work
  except Exception:
      status = 500
      raise
  finally:
      # Record on BOTH paths, so errors are not missing from latency.
      LATENCY.labels(method, path).observe(time.perf_counter() - start)
      REQUESTS.labels(method, path, str(status)).inc()
  return status


start_http_server(8000)      # exposes /metrics`,
      },
    ],
    traps: [
      'Using a summary for latency in a multi-instance service, then trying to aggregate the quantiles.',
      'Choosing histogram buckets that do not bracket real latencies - everything lands in `+Inf` and percentiles are useless.',
      'Recording latency only on success, so slow failures are invisible.',
    ],
    followUps: [
      'Why can you not average percentiles?',
      'How do you pick histogram buckets?',
      'What does histogram_quantile actually do?',
    ],
    tags: ['metrics', 'instrumentation', 'histograms'],
  },
  {
    id: 'itv-prom-4',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is cardinality in Prometheus and why does it matter?',
    probing:
      'The number one operational failure mode. Anyone who has run Prometheus at scale has been burned by this.',
    answer: [
      'A time series is identified by its metric name **plus the full set of label values**. Every unique combination is a separate series, each with its own chunk of memory and disk.',
      'Cardinality is the number of those combinations, and it **multiplies**. A metric with 5 methods, 20 paths and 6 status codes is 600 series - fine. Add a `user_id` label with 100,000 values and it becomes 60 million series, which will exhaust memory and take the server down.',
      'The labels that cause this are always the same: user IDs, request IDs, session IDs, email addresses, full URLs with query strings or path parameters, timestamps, and raw error messages.',
      'The rule is that a label value must come from a **small, bounded set** that you could enumerate. If you cannot say roughly how many distinct values there will be in a year, it does not belong in a label.',
      'The fix for high-cardinality data is to put it where it belongs: logs or traces, which are designed for it. Prometheus is for aggregate numbers.',
    ],
    deeper: [
      'A subtle version: templated URL paths. `/api/users/12345` as a path label is unbounded; `/api/users/:id` is bounded. Instrument at the route-pattern level, not the request level.',
      'To find an existing problem: `topk(10, count by (__name__)({__name__=~".+"}))` shows the worst metrics, and the TSDB status page shows the highest-cardinality labels. `sample_limit` on a scrape config is the guard that stops one bad deploy taking the server down.',
    ],
    code: [
      {
        title: 'The multiplication, and how to find it',
        language: 'text',
        code: `# BOUNDED - about 600 series. Fine.
http_requests_total{method="GET", path="/api/users", status="200"}
#   5 methods x 20 paths x 6 statuses = 600

# UNBOUNDED - this will take Prometheus down.
http_requests_total{method="GET", path="/api/users/12345",
                  user_id="u-98a7", request_id="r-4f2b"}
#   5 x unbounded x unbounded x unbounded

# Find the worst offenders
topk(10, count by (__name__)({__name__=~".+"}))
count by (job) ({__name__=~".+"})

# Guard rail in prometheus.yml - fail the scrape rather than
# ingesting a cardinality explosion
scrape_configs:
  - job_name: app
  sample_limit: 10000
  label_limit: 30`,
      },
    ],
    traps: [
      'Adding a label "just for debugging". That is exactly how it happens, and it is hard to undo once the series exist.',
      'Putting the raw URL path in a label instead of the route pattern.',
      'Assuming deleting the label fixes it immediately - the existing series persist until retention expires.',
    ],
    followUps: [
      'Where should high-cardinality data go instead?',
      'How would you find which metric is causing a problem?',
      'How do you prevent a bad deploy from taking Prometheus down?',
    ],
    tags: ['cardinality', 'scaling', 'operations'],
  },
  {
    id: 'itv-prom-5',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you design alerts that people actually act on?',
    probing:
      'Alerting philosophy. Alert fatigue is one of the most common real problems and they want to hear you name it.',
    answer: [
      'The governing principle is: **alert on symptoms users feel, not on causes**. High CPU is not a problem if nobody notices; a 5% error rate is a problem even if every machine looks healthy.',
      'That means alerting on **SLO-style signals** - error rate, latency, availability, and for queues, the backlog - rather than on every individual resource metric.',
      'Every alert should pass a simple test: **is a human required to do something right now?** If the answer is no, it should be a dashboard or a ticket, not a page. An alert that fires and is routinely ignored is worse than no alert, because it trains people to ignore the next one.',
      'Practically: use `for:` so transient blips do not page - a 2-minute window removes most noise. Include a **runbook link** and enough labels in the annotation for the responder to start immediately. Route by severity, so `critical` pages and `warning` goes to a channel.',
      'And crucially, use **burn-rate alerting** rather than a fixed threshold. "Errors above 1%" fires on a harmless one-minute blip. "We are burning our monthly error budget fast enough to exhaust it in 2 days" only fires when it genuinely matters - fast burn pages, slow burn tickets.',
    ],
    code: [
      {
        title: 'A symptom alert with burn rate',
        language: 'yaml',
        explanation:
          'The two windows are the key idea: a short window makes it responsive, a long window stops it firing on a blip.',
        code: `groups:
  - name: checkout-slo
  rules:
    # Fast burn: at this rate the monthly budget is gone in ~2 days.
    # Two windows so a 1-minute spike cannot page anyone.
    - alert: CheckoutErrorBudgetFastBurn
      expr: |
        (
          sum(rate(http_requests_total{job="checkout",status=~"5.."}[5m]))
          / sum(rate(http_requests_total{job="checkout"}[5m]))
        ) > (14.4 * 0.001)
        and
        (
          sum(rate(http_requests_total{job="checkout",status=~"5.."}[1h]))
          / sum(rate(http_requests_total{job="checkout"}[1h]))
        ) > (14.4 * 0.001)
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Checkout burning error budget fast ({{ $value | humanizePercentage }})"
        runbook: "https://runbooks.example.com/checkout-errors"
        dashboard: "https://grafana.example.com/d/checkout"

    # Symptom, not cause: users are waiting.
    - alert: CheckoutLatencyHigh
      expr: |
        histogram_quantile(0.95,
          sum by (le) (rate(http_request_duration_seconds_bucket{job="checkout"}[5m]))
        ) > 1.5
      for: 10m
      labels: { severity: warning }
      annotations:
        summary: "Checkout p95 latency is {{ $value }}s"
        runbook: "https://runbooks.example.com/checkout-latency"

    # A cause alert worth keeping - it predicts an outage
    # with enough lead time to act.
    - alert: DiskWillFillIn4Hours
      expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 4*3600) < 0
      for: 15m
      labels: { severity: warning }`,
      },
    ],
    deeper: [
      'The Alertmanager side matters as much as the rules. **Grouping** collapses fifty Pod alerts into one notification; **inhibition** suppresses downstream alerts when a cause alert is already firing - if the cluster is down, do not also page about every service on it; and **silences** let responders mute known issues during maintenance.',
      'A useful review habit: every month, look at alerts that fired and ask which led to action. Anything that never does should be deleted or downgraded. Alert rules need pruning like any other code.',
    ],
    traps: [
      'Alerting on every resource metric. That is how you get 200 alerts a night and nobody reading them.',
      'No `for:` clause, so every transient spike pages someone.',
      'An alert with no runbook - the responder starts from nothing at 3am.',
    ],
    followUps: [
      'What is an error budget and how does burn rate work?',
      'How would you stop one incident generating fifty pages?',
      'How do you decide what should page versus ticket?',
    ],
    tags: ['alerting', 'slo', 'oncall', 'design'],
  },
  {
    id: 'itv-prom-6',
    level: 'advanced',
    kind: 'scenario',
    prompt: 'Prometheus is using 60GB of RAM and keeps being OOM-killed. What do you do?',
    probing:
      'Real operational experience. The answer is almost always cardinality, and then a scaling decision.',
    answer: [
      'Prometheus memory is dominated by the number of **active time series** it holds in memory, so the first question is always how many series there are and where they came from.',
      'I would check `prometheus_tsdb_head_series` for the total, then use the TSDB status page or `topk(10, count by (__name__)({__name__=~".+"}))` to find which metrics dominate, and the label-cardinality view to find which **label** is responsible. In my experience it is almost always one metric with one unbounded label, added recently.',
      'The immediate fix is to stop ingesting it: a `metric_relabel_configs` rule to drop that metric or that label at scrape time. That takes effect on the next scrape and memory recovers as the head block rotates.',
      'Then the proper fix is in the application - remove the label, or template the path - plus a `sample_limit` on the scrape config so the next occurrence fails the scrape instead of taking the server down.',
      'If cardinality is genuinely legitimate and simply large, the answer is architectural rather than a fix: **shard** Prometheus by team or service with separate instances, and add **Thanos** or **Mimir** for global query and long-term storage. Vertical scaling stops working eventually, and reducing retention only buys a little because retention affects disk far more than RAM.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Diagnosing memory pressure',
        caption:
          'Find the metric, then the label, then stop ingesting it. Scaling is the last resort, not the first.',
        nodes: [
          {
            label: 'How many active series?',
            detail: 'prometheus_tsdb_head_series',
            tone: 'accent',
          },
          {
            label: 'Which metric dominates?',
            detail: 'topk(10, count by (__name__)(...)) or the TSDB status page',
            arrowLabel: 'series count is high',
          },
          {
            label: 'Which label is unbounded?',
            detail: 'Usually user_id, request_id or a raw URL path',
            branch: {
              label: 'No single offender',
              detail: 'Cardinality is genuinely large - shard, or add Thanos/Mimir',
            },
          },
          {
            label: 'Drop it at scrape time',
            detail: 'metric_relabel_configs - effective on the next scrape',
          },
          {
            label: 'Fix the app, then add sample_limit',
            detail: 'So the next bad deploy fails its scrape instead',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Finding it and stopping it',
        language: 'yaml',
        code: `# --- Diagnose
# Total active series
prometheus_tsdb_head_series

# Worst metrics by series count
topk(10, count by (__name__)({__name__=~".+"}))

# Which job is responsible
topk(10, count by (job)({__name__=~".+"}))

# --- Stop the bleeding at scrape time
scrape_configs:
  - job_name: app
  sample_limit: 10000          # fail the scrape rather than ingest a flood
  static_configs: [{ targets: ['app:8080'] }]

  metric_relabel_configs:
    # Drop one runaway metric entirely
    - source_labels: [__name__]
      regex: 'app_request_details_by_user'
      action: drop

    # Or keep the metric but remove the unbounded label
    - regex: 'user_id|request_id|session_id'
      action: labeldrop`,
      },
    ],
    traps: [
      'Adding RAM without finding the cause. It buys days, and the growth continues.',
      'Cutting retention to reduce memory. Retention mostly affects disk; memory is driven by active series.',
      'Dropping the label in the app but expecting instant relief - existing series persist until they age out.',
    ],
    followUps: [
      'What is the difference between metric_relabel_configs and relabel_configs?',
      'When would you introduce Thanos or Mimir?',
      'How do you shard Prometheus?',
    ],
    tags: ['scenario', 'operations', 'scaling', 'cardinality'],
  },
  {
    id: 'itv-prom-7',
    level: 'advanced',
    kind: 'multi',
    prompt: 'Which of these are appropriate uses of Prometheus? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Tracking request rate and error rate per service' },
      { id: 'b', text: 'Storing individual request logs for later search' },
      { id: 'c', text: 'Alerting when p99 latency exceeds an SLO' },
      { id: 'd', text: 'Billing records that must be complete and exact' },
      { id: 'e', text: 'Capacity trends over the last 90 days' },
    ],
    correct: ['a', 'c', 'e'],
    probing:
      'Whether you know what Prometheus is NOT for. B and D are both genuinely wrong, for different reasons.',
    answer: [
      'A, C and E are what Prometheus is designed for. **B and D are not**, and for different reasons.',
      '**B, logs.** Prometheus stores numeric time series, not text events. Individual request logs are high-cardinality event data - that is Loki, Elasticsearch or Splunk. Trying to do it in Prometheus is the cardinality explosion from the previous question.',
      '**D, billing.** Prometheus is explicitly **not** designed for 100% accuracy. It samples on an interval, so a missed scrape is a gap; it does not guarantee delivery; and `rate()` extrapolates. The documentation says plainly that if you need complete and exact data, it is the wrong tool. Billing needs an event stream with delivery guarantees.',
      '**E, 90-day trends** is fine but worth a caveat: default local retention is 15 days, so you need either a longer retention setting or remote storage like Thanos or Mimir.',
    ],
    deeper: [
      'The three pillars framing is useful here: **metrics** (Prometheus) for aggregate numbers and alerting, **logs** (Loki, Splunk, ELK) for detailed events, **traces** (Tempo, Jaeger) for following one request across services. They answer different questions and using one for another’s job is where teams get into trouble.',
    ],
    traps: [
      'Using Prometheus for anything that must be exact. It is a monitoring system, not a ledger.',
      'Putting event detail into labels to make Prometheus behave like a log store.',
    ],
    followUps: [
      'Where would logs and traces fit alongside this?',
      'What is the default retention and how would you extend it?',
      'Why is Prometheus not suitable for billing?',
    ],
    tags: ['observability', 'design', 'limitations'],
  },
]
