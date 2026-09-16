import type { InterviewQuestion } from '../../../types'

/** Data model, metric types, PromQL and how scraping actually works. */
export const promFundamentalQuestions: InterviewQuestion[] = [
  {
    id: 'itv-prom-8',
    level: 'basic',
    kind: 'open',
    prompt: 'Explain the four Prometheus metric types.',
    probing: 'The most basic Prometheus question, and people routinely confuse counter with gauge.',
    answer: [
      'A **counter** only ever goes up (or resets to zero on restart). Use it for things you count cumulatively: requests served, errors, bytes sent. You almost never look at its raw value - you look at its **rate**, which is why `rate()` exists.',
      'A **gauge** goes up and down. Use it for a current measurement: memory in use, queue depth, temperature, active connections. You can look at the value directly, and `avg`, `min` and `max` are meaningful.',
      'A **histogram** samples observations into configurable **buckets** and also exposes a sum and a count. It is what you use for request durations and response sizes, because it lets you calculate **quantiles across instances** - the bucket counts can be added together, which is the whole point.',
      'A **summary** also gives quantiles, but calculates them **client-side** per instance. That makes it cheaper to query and **impossible to aggregate**: you cannot average two instances’ p99 to get the overall p99. For anything running on more than one instance, a histogram is almost always the right choice.',
    ],
    code: [
      {
        title: 'The four types as exposed on /metrics',
        language: 'text',
        code: `# COUNTER - monotonically increasing; query its rate, not its value
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 48210

# GAUGE - goes up and down; query it directly
# TYPE queue_depth gauge
queue_depth{queue="orders"} 42

# HISTOGRAM - buckets are cumulative, and CAN be aggregated
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"}  9200
http_request_duration_seconds_bucket{le="0.5"}  9850
http_request_duration_seconds_bucket{le="+Inf"} 9900
http_request_duration_seconds_sum   1420.5
http_request_duration_seconds_count 9900

# SUMMARY - quantiles computed in the client; CANNOT be aggregated
# TYPE rpc_duration_seconds summary
rpc_duration_seconds{quantile="0.99"} 0.31`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which metric type?',
        caption:
          'If it can decrease it is a gauge; if you need quantiles across instances, histogram.',
        question: 'What are you measuring?',
        branches: [
          {
            condition: 'A count of events that only accumulates',
            result: 'Counter',
            detail: 'requests, errors, bytes',
            tone: 'success',
          },
          {
            condition: 'A value that goes up and down',
            result: 'Gauge',
            detail: 'memory, queue depth, connections',
            tone: 'success',
          },
          {
            condition: 'Durations or sizes, aggregated across instances',
            result: 'Histogram',
            detail: 'Buckets can be summed',
            tone: 'accent',
          },
          {
            condition: 'Quantiles on a single instance, exact',
            result: 'Summary',
            detail: 'Cannot be aggregated - rarely what you want',
            tone: 'warning',
          },
        ],
      },
    ],
    traps: [
      'Using a gauge for something that only counts up, losing the ability to use `rate()` correctly.',
      'Using a summary for a service with many replicas, then discovering the quantiles cannot be combined.',
      'Graphing a counter’s raw value, which is a meaningless ever-rising line.',
    ],
    followUps: [
      'Why can you not average two instances’ p99 values?',
      'Why is `rate()` almost always applied to counters?',
    ],
    tags: ['metric types', 'counter', 'gauge', 'histogram', 'fundamentals'],
  },
  {
    id: 'itv-prom-9',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain `rate()`, `irate()` and `increase()`. When do you use each?',
    probing: 'The functions people use most and understand least.',
    answer: [
      '**`rate(counter[5m])`** gives the **per-second average rate of increase** over the window, calculated across all the data points in it. It handles counter resets automatically. This is the one you want almost always - for request rates, error rates, throughput.',
      '**`irate(counter[5m])`** uses only the **last two data points** in the window. It is much more responsive to sudden changes but also much noisier, and it can miss spikes entirely if they happen between the two points it happens to pick. It is for graphing volatile signals at high resolution, not for alerting.',
      '**`increase(counter[1h])`** gives the **total increase** over the window rather than a per-second rate. It is really `rate()` multiplied by the window length. Useful when you want to say "how many errors in the last hour" rather than "errors per second".',
      'The rule that matters for alerting: **use `rate()`**. `irate()` is too noisy to alert on reliably - it will fire on a single unlucky pair of samples.',
      'And a practical constraint: the window must contain **at least four scrape intervals** worth of points, or the result is unreliable. With a 30-second scrape interval, `rate(x[1m])` has only two points and is fragile; `rate(x[2m])` or `[5m]` is safe.',
    ],
    code: [
      {
        title: 'The three in practice',
        language: 'text',
        code: `# Requests per second, averaged over 5 minutes - use this
rate(http_requests_total[5m])

# Error ratio - the standard pattern. Note the rate() on BOTH sides.
sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
sum(rate(http_requests_total[5m]))

# Total errors in the last hour, as a count
increase(http_requests_total{status=~"5.."}[1h])

# Responsive but noisy - for a dashboard, never for an alert
irate(node_network_receive_bytes_total[5m])`,
      },
    ],
    deeper: [
      'Always apply `rate()` **before** aggregating: `sum(rate(x[5m]))`, never `rate(sum(x)[5m])`. Summing counters from instances that restart at different times produces nonsense.',
      '`rate()` extrapolates slightly to the window edges, so results can be marginally non-integer. That is expected.',
      'For alerting, a window of `[5m]` with a `for: 5m` clause gives a good balance between responsiveness and noise.',
    ],
    traps: [
      '`rate()` over a window shorter than four scrape intervals, giving unreliable values.',
      '`irate()` in an alerting rule, which fires on noise.',
      'Aggregating before taking the rate, which breaks on counter resets.',
    ],
    followUps: [
      'Why must `rate()` come before `sum()`?',
      'What happens if your rate window is shorter than the scrape interval?',
    ],
    tags: ['promql', 'rate', 'functions', 'alerting'],
  },
  {
    id: 'itv-prom-10',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is cardinality and why does it matter so much in Prometheus?',
    probing: 'The single most common way people break a Prometheus server. Essential knowledge.',
    answer: [
      '**Cardinality** is the number of distinct time series. Every unique combination of metric name and label values is a **separate time series**, stored and indexed separately.',
      'That multiplies fast. A metric with 5 methods, 10 endpoints and 8 status codes is 400 series - fine. Add a `user_id` label with 100,000 users and it is 40 million series, and the server runs out of memory.',
      'This is the classic way to take down a Prometheus server, and the labels that do it are always the same kind: **unbounded, high-cardinality values** - user IDs, request IDs, email addresses, full URL paths with IDs in them, timestamps, container IDs, IP addresses.',
      'The rule is that a label value must come from a **small, bounded set that does not grow with traffic**. Method, status code, endpoint **template** (`/users/:id`, not `/users/12345`), service name, environment - all fine. Anything unique per request or per user is not.',
      'When you genuinely need per-user or per-request detail, that is a **logging or tracing** question, not a metrics one. Prometheus is for aggregated numeric trends; it is the wrong tool for high-cardinality lookup.',
    ],
    code: [
      {
        title: 'Find what is eating the memory',
        language: 'text',
        code: `# The 10 metrics with the most series
topk(10, count by (__name__)({__name__=~".+"}))

# Total series in the head block
prometheus_tsdb_head_series

# For one suspicious metric, which label is responsible?
count(count by (endpoint) (http_requests_total))
count(count by (user_id)  (http_requests_total))   # this is the problem`,
      },
      {
        title: 'Drop a bad label before it is stored',
        language: 'yaml',
        code: `scrape_configs:
  - job_name: app
    metric_relabel_configs:
      # Drop the offending label entirely
      - regex: 'user_id|request_id|session_id'
        action: labeldrop

      # Or drop a whole metric that is hopeless
      - source_labels: [__name__]
        regex: 'app_per_request_detail.*'
        action: drop`,
        explanation:
          'metric_relabel_configs runs after scraping and before storage - the last chance to prevent the series being created.',
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'How a label takes down a server',
        caption: 'Each unique label combination is a separate time series held in memory.',
        nodes: [
          { label: 'http_requests_total', detail: 'One metric name', tone: 'accent' },
          { label: '+ method (5), status (8)', detail: '40 series - fine' },
          { label: '+ endpoint (10)', detail: '400 series - still fine' },
          { label: '+ user_id (100,000)', detail: '40,000,000 series', tone: 'danger' },
          {
            label: 'Prometheus OOMs',
            detail: 'And loses its head block on restart',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Memory usage is roughly proportional to **active series**, not to scrape frequency. Halving the scrape interval costs far less than adding a high-cardinality label.',
      'Labels that churn - a `pod` label in a cluster that redeploys constantly - create new series continuously even if the count at any instant looks reasonable. Watch `prometheus_tsdb_head_series` over time.',
      '`metric_relabel_configs` is the emergency brake when a team ships a bad label and you cannot wait for a fix.',
    ],
    traps: [
      'Adding a label "just in case it is useful" without asking how many values it can take.',
      'A URL path label with IDs in it.',
      'Assuming the problem is scrape frequency when it is cardinality.',
    ],
    followUps: [
      'A team wants per-customer metrics. What do you tell them?',
      'How would you find which metric is causing a memory problem?',
    ],
    tags: ['cardinality', 'performance', 'labels', 'scaling', 'production'],
  },
  {
    id: 'itv-prom-11',
    level: 'basic',
    kind: 'mcq',
    prompt: 'Why does Prometheus pull metrics rather than having applications push them?',
    probing: 'An architectural decision with real consequences.',
    options: [
      {
        id: 'a',
        text: 'Pull means Prometheus controls the rate, can tell whether a target is up, and targets need no configuration about where to send data',
      },
      { id: 'b', text: 'Pull is faster than push' },
      { id: 'c', text: 'Push was not technically possible when Prometheus was designed' },
      { id: 'd', text: 'Pull uses less network bandwidth' },
    ],
    correct: ['a'],
    answer: [
      'The benefits are all about **control and simplicity**. Prometheus decides when and how often to scrape, so a misbehaving application cannot flood the monitoring system. Targets expose a `/metrics` endpoint and know nothing about Prometheus - no configuration, no credentials, no destination.',
      'The most useful property is that **failing to scrape is itself a signal**. The synthetic `up` metric is 0 when a target cannot be reached, so "the service is down" is detected by the monitoring system directly. With push, an application that has crashed simply stops sending, which is indistinguishable from an application with nothing to report.',
      'It also makes debugging easy: you can `curl` any target’s `/metrics` and see exactly what Prometheus sees.',
      'The genuine limitation is **short-lived jobs** that finish before any scrape happens. The **Pushgateway** exists for exactly that case - batch jobs push their final result, and Prometheus scrapes the gateway. It should be used only for that; using it as a general push endpoint loses the `up` signal and creates stale metrics that persist after the job is gone.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'Pull, and the batch-job exception',
        caption:
          'The up metric is generated by the scrape itself, which is why failure is visible.',
        participants: [
          { id: 'prom', label: 'Prometheus' },
          { id: 'app', label: 'Service' },
          { id: 'pgw', label: 'Pushgateway' },
          { id: 'job', label: 'Batch job' },
        ],
        messages: [
          { from: 'prom', to: 'app', label: 'GET /metrics (every 15s)' },
          { from: 'app', to: 'prom', label: 'metrics + up=1', kind: 'return' },
          { from: 'prom', to: 'app', label: 'GET /metrics (target down)' },
          { from: 'prom', to: 'prom', label: 'records up=0 - alertable', kind: 'return' },
          { from: 'job', to: 'pgw', label: 'push final result, then exit' },
          { from: 'prom', to: 'pgw', label: 'GET /metrics' },
        ],
      },
    ],
    traps: [
      'Using the Pushgateway for long-running services, which loses the `up` signal entirely.',
      'Metrics left in the Pushgateway after a job is decommissioned, reported forever.',
      'Assuming pull cannot reach targets behind a firewall - it usually can with the right network design, and where it truly cannot, that is an architecture question rather than a reason to push everything.',
    ],
    followUps: [
      'What is the `up` metric and why is it useful?',
      'When is the Pushgateway the right answer?',
    ],
    tags: ['architecture', 'pull model', 'pushgateway', 'fundamentals'],
  },
  {
    id: 'itv-prom-12',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does service discovery work, and what is relabeling for?',
    probing: 'The part of Prometheus configuration that confuses everyone the first time.',
    answer: [
      '**Service discovery** finds targets dynamically instead of listing them in a file. Prometheus supports Kubernetes, EC2, Consul, DNS and many others - so when a pod is created it is scraped automatically, and when it goes away it stops being scraped.',
      '**Relabeling** is how you filter and transform those discovered targets before scraping. Service discovery typically returns everything - every pod in the cluster - along with a set of **meta labels** (`__meta_kubernetes_pod_annotation_*`, and so on), and relabeling decides which to keep and what to call them.',
      'The standard pattern is **opt-in by annotation**: keep only targets where `prometheus.io/scrape` is `true`, take the port and path from other annotations, and map Kubernetes metadata onto sensible label names like `namespace`, `pod` and `app`.',
      'The critical distinction is between **`relabel_configs`**, which runs **before** the scrape and decides which targets to scrape and how, and **`metric_relabel_configs`**, which runs **after** the scrape and filters or rewrites the metrics themselves. The first controls targets; the second is your defence against a badly behaved exporter flooding you with series.',
      'Labels beginning `__` are **internal** and dropped before storage - which is why `__address__` and `__meta_*` can be used during relabeling but never appear in queries.',
    ],
    code: [
      {
        title: 'Kubernetes service discovery with annotation-based opt-in',
        language: 'yaml',
        code: `scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod

    relabel_configs:
      # Only scrape pods that opt in
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"

      # Let the pod choose its metrics path
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

      # ...and its port
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: '([^:]+)(?::\\d+)?;(\\d+)'
        replacement: '$1:$2'
        target_label: __address__

      # Useful labels for querying
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod

    metric_relabel_configs:
      # After scraping: drop a metric known to be high cardinality
      - source_labels: [__name__]
        regex: 'go_gc_duration_seconds.*'
        action: drop`,
      },
    ],
    traps: [
      'Confusing `relabel_configs` with `metric_relabel_configs` - the first cannot filter metrics, the second cannot filter targets.',
      'Forgetting the `keep` action, so every pod in the cluster is scraped.',
      'Expecting `__meta_*` labels to appear in queries. They are dropped.',
    ],
    followUps: [
      'A team shipped a metric with a million series. What is your emergency fix?',
      'Why do labels starting with `__` not appear in queries?',
    ],
    tags: ['service discovery', 'relabeling', 'kubernetes', 'configuration'],
  },
  {
    id: 'itv-prom-13',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do histograms work, and how do you calculate a p99 correctly?',
    probing:
      'Quantile calculation is subtle and frequently done wrong in ways that produce plausible-looking nonsense.',
    answer: [
      'A histogram counts observations into **cumulative buckets**: `le="0.1"` counts everything at or below 100 ms, `le="0.5"` counts everything at or below 500 ms including those, and so on up to `le="+Inf"`. Because they are cumulative counters, buckets from different instances **can be added together** - which is what makes aggregation possible.',
      'The p99 is calculated with `histogram_quantile(0.99, ...)` over the **rate of the bucket counters**, summed by the `le` label. The order matters and is the part people get wrong: you must take `rate()` **first**, then `sum by (le)`, then `histogram_quantile`. Aggregating raw counters or applying the quantile per instance and averaging both produce wrong answers.',
      'The essential caveat is that the result is an **interpolation within a bucket**, so its accuracy depends entirely on your bucket boundaries. If your largest finite bucket is 1 second and most requests take 2 seconds, every quantile above the bucket will report approximately 1 second - a comfortable number that is completely wrong. Buckets must span the range you actually care about.',
      'And averaging quantiles is never valid. The p99 of two instances is not the average of their p99s; that is precisely why summaries cannot be aggregated and histograms can.',
    ],
    code: [
      {
        title: 'The correct order, and the common mistakes',
        language: 'text',
        code: `# CORRECT: rate first, then sum by (le), then the quantile
histogram_quantile(0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)

# CORRECT: per-service p99
histogram_quantile(0.99,
  sum by (le, service) (rate(http_request_duration_seconds_bucket[5m]))
)

# WRONG: no rate() - uses cumulative totals since process start
histogram_quantile(0.99, sum by (le) (http_request_duration_seconds_bucket))

# WRONG: averaging quantiles is mathematically meaningless
avg(histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])))

# The average is a different question, and is sometimes what you actually want
rate(http_request_duration_seconds_sum[5m])
  / rate(http_request_duration_seconds_count[5m])`,
      },
      {
        title: 'Choosing buckets for your actual latency range',
        language: 'python',
        code: `from prometheus_client import Histogram

# Default buckets stop at 10s and are too coarse for a fast API.
# Pick boundaries around the values you care about and your SLO.
REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "Request duration in seconds",
    labelnames=["method", "endpoint", "status"],   # bounded label values only
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

@REQUEST_DURATION.labels("GET", "/orders", "200").time()
def handle_request():
    ...`,
        explanation:
          'Every bucket is an extra time series per label combination - useful boundaries, not many of them.',
      },
    ],
    deeper: [
      'Each bucket is a separate time series, so a 20-bucket histogram with 30 label combinations is 600 series from one metric. Buckets are a cardinality decision.',
      '**Native histograms** in recent Prometheus versions store an exponential bucket layout far more efficiently and remove most of the bucket-choice problem.',
      'For SLO work, `histogram_quantile` is often the wrong question. "What fraction of requests were under 300 ms" is answered directly and exactly from the bucket at `le="0.3"`, with no interpolation at all.',
    ],
    traps: [
      'Buckets that do not span the real latency range, giving a p99 pinned at the largest bucket.',
      'Applying `histogram_quantile` before aggregating across instances.',
      'Averaging quantiles.',
      'Adding many buckets without considering the series count.',
    ],
    followUps: [
      'Your p99 has been exactly 1.0 seconds for a week. What does that suggest?',
      'How would you measure "99% of requests under 300ms" exactly?',
    ],
    tags: ['histogram', 'promql', 'quantiles', 'slo', 'advanced'],
  },
  {
    id: 'itv-prom-14',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are recording rules and when should you use them?',
    probing: 'Query performance, and when precomputation is worth the complexity.',
    answer: [
      'A **recording rule** evaluates a PromQL expression on a schedule and stores the result as a **new time series**. Dashboards and alerts then query the precomputed series instead of recalculating the expression every time.',
      'They are worth it in three situations. When an expression is **expensive** - aggregating across thousands of series - and appears on a dashboard several people load repeatedly. When the **same expression is used in many places**, so defining it once avoids subtle divergence. And when you want to keep an aggregate over a **long retention** while the raw high-cardinality series expire sooner.',
      'The naming convention matters for keeping a large rule set comprehensible: `level:metric:operation`, as in `job:http_requests:rate5m`. The level says what it is aggregated by, which tells you immediately what you can further aggregate it by.',
      'The caution is that recording rules add a layer of indirection. Someone debugging an alert has to find the rule to know what the expression actually computes, and a stale rule that nobody maintains is worse than no rule. Add them because a query is genuinely slow or genuinely repeated, not by default.',
    ],
    code: [
      {
        title: 'Recording rules with the standard naming',
        language: 'yaml',
        code: `groups:
  - name: http
    interval: 30s
    rules:
      # job:metric:operation - the level tells you what it is grouped by
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

      - record: job:http_errors:rate5m
        expr: sum by (job) (rate(http_requests_total{status=~"5.."}[5m]))

      # Built from the two above - cheap, and consistent everywhere it is used
      - record: job:http_error_ratio:rate5m
        expr: job:http_errors:rate5m / job:http_requests:rate5m

      - record: job:http_request_duration:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum by (le, job) (rate(http_request_duration_seconds_bucket[5m]))
          )`,
      },
    ],
    deeper: [
      'Rules within a group evaluate **in order**, so one rule can depend on another defined above it - as the error ratio above does.',
      'Watch `prometheus_rule_group_last_duration_seconds` against the group interval. A group taking longer than its interval to evaluate is falling behind.',
      'Recording rules do not reduce cardinality of the underlying data; they add series. They save query time, not storage.',
    ],
    traps: [
      'Recording rules for cheap queries, adding indirection for no benefit.',
      'A rule group whose evaluation takes longer than its interval.',
      'Alerts pointing at recording rules nobody can find the definition of.',
    ],
    followUps: [
      'How would you know a rule group is too slow?',
      'Do recording rules reduce storage?',
    ],
    tags: ['recording rules', 'performance', 'promql', 'configuration'],
  },
  {
    id: 'itv-prom-15',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Prometheus is using 60 GB of memory and keeps getting OOMKilled. How do you diagnose and fix it?',
    probing:
      'The most common Prometheus production problem, and it is almost always the same cause.',
    answer: [
      'Prometheus memory usage is dominated by the **number of active time series** held in the head block, so the first question is always how many series there are and which metric is responsible.',
      '`prometheus_tsdb_head_series` gives the total. Then `topk(10, count by (__name__)({__name__=~".+"}))` names the worst metrics. In my experience it is nearly always one metric with a label that should not be there - a user ID, a request ID, a full URL path with IDs in it.',
      'Once identified, drill into **which label** is responsible by counting distinct values per label. That confirms it rather than guessing.',
      'The **immediate fix** is `metric_relabel_configs` to drop the offending label or metric at scrape time. That stops the bleeding without waiting for the owning team to ship a change - though it should be paired with a conversation, because dropping metrics silently is not a long-term answer.',
      'The **structural fixes**, if cardinality is genuinely legitimate: shorten retention so less is held; **federate or shard** so several Prometheus servers each handle a subset of targets; or move to **Thanos, Mimir or Cortex** for long-term storage and a global query view, with the local Prometheus keeping only a short window.',
      'What is usually **not** the fix is adding memory. It buys a few weeks, and cardinality grows.',
    ],
    code: [
      {
        title: 'Find the cause in three queries',
        language: 'text',
        code: `# 1. How bad is it, and is it growing?
prometheus_tsdb_head_series

# 2. Which metrics have the most series?
topk(10, count by (__name__)({__name__=~".+"}))

# 3. For the worst offender, which label is responsible?
count(count by (user_id)   (http_requests_total))
count(count by (endpoint)  (http_requests_total))
count(count by (pod)       (http_requests_total))

# Churn: series created per second (redeploys, restarts)
rate(prometheus_tsdb_head_series_created_total[5m])`,
      },
      {
        title: 'Stop the bleeding at scrape time',
        language: 'yaml',
        code: `scrape_configs:
  - job_name: app
    metric_relabel_configs:
      # Drop the label that is causing the explosion
      - regex: 'user_id|request_id|trace_id'
        action: labeldrop

      # Or drop the whole metric if it is beyond saving
      - source_labels: [__name__]
        regex: 'app_request_detail_.*'
        action: drop

      # Or keep only the series you actually use
      - source_labels: [__name__]
        regex: 'http_requests_total|http_request_duration_seconds_.*|up'
        action: keep`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Diagnosing a Prometheus OOM',
        caption:
          'Adding memory is not on this path - cardinality grows faster than you can buy RAM.',
        nodes: [
          { label: 'Check head series count', detail: 'And whether it is growing', tone: 'accent' },
          { label: 'topk by metric name', detail: 'One metric is usually most of it' },
          { label: 'Count distinct values per label', detail: 'Confirms which label' },
          {
            label: 'Drop it with metric_relabel_configs',
            detail: 'Immediate mitigation',
            tone: 'warning',
          },
          { label: 'Talk to the owning team', detail: 'Silent drops are not a fix' },
          {
            label: 'Shard, federate or move to Thanos/Mimir',
            detail: 'If cardinality is legitimate',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'Series **churn** is as damaging as raw count. Pods that restart constantly create new series continuously, and the head block holds them until they age out.',
      '`--storage.tsdb.retention.time` reduces disk usage but has little effect on memory, which is dominated by the head block.',
      'Prometheus loses its in-memory head block on an unclean shutdown unless the WAL replays - so repeated OOMs also cost you data.',
      'Set a memory limit deliberately and alert on approaching it, rather than discovering the ceiling by being OOMKilled.',
    ],
    traps: [
      'Adding memory as the fix, which delays the problem by weeks.',
      'Reducing the scrape interval, which barely affects memory - cardinality does.',
      'Dropping metrics silently without telling the team that owns them.',
    ],
    followUps: [
      'The cardinality is legitimate and needed. What now?',
      'Why does reducing retention not help with memory?',
    ],
    tags: ['scenario', 'cardinality', 'memory', 'troubleshooting', 'production'],
  },
  {
    id: 'itv-prom-16',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these are good PromQL practices? Select all that apply.',
    probing: 'Query correctness - each wrong option produces plausible but wrong numbers.',
    options: [
      { id: 'a', text: 'Apply `rate()` before `sum()`, never the other way round' },
      { id: 'b', text: 'Use a rate window of at least four scrape intervals' },
      {
        id: 'c',
        text: 'Use `histogram_quantile` over summed bucket rates, not over per-instance quantiles',
      },
      { id: 'd', text: 'Use `irate()` in alerting rules so alerts fire as quickly as possible' },
      {
        id: 'e',
        text: 'Prefer label selectors that are as specific as possible to reduce series scanned',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      '`irate()` in alerting is the wrong one. It uses only the last two data points, so it is extremely sensitive to a single unlucky sample pair and will produce false alerts. Alerting wants the smoothed `rate()` with a `for:` clause.',
      '**`rate()` before `sum()`** is essential for correctness: `rate()` handles counter resets per series, and summing raw counters from instances that restarted at different times produces spikes that never happened.',
      '**A window of at least four scrape intervals** ensures enough data points for a reliable calculation. With 30-second scrapes, `[5m]` is safe and `[1m]` is fragile.',
      '**`histogram_quantile` over summed bucket rates** is the only mathematically valid way to get a quantile across instances.',
      '**Specific selectors** matter for performance - `{job="api", status="500"}` scans far fewer series than a bare regex across everything, and on a large server that is the difference between an instant dashboard and a timeout.',
    ],
    code: [
      {
        title: 'Right and wrong, side by side',
        language: 'text',
        code: `# RIGHT
sum by (service) (rate(http_requests_total{job="api"}[5m]))

# WRONG - counter resets across instances produce phantom spikes
rate(sum by (service) (http_requests_total)[5m:])

# RIGHT
histogram_quantile(0.99, sum by (le) (rate(duration_bucket[5m])))

# WRONG - quantile per instance, then averaged: meaningless
avg(histogram_quantile(0.99, rate(duration_bucket[5m])))`,
      },
    ],
    traps: [
      'Regex selectors matching far more series than intended, making queries slow.',
      '`irate()` used because it "looks more responsive" on a graph, then copied into an alert.',
      'A rate window shorter than the scrape interval, which silently returns nothing.',
    ],
    followUps: ['Why does summing counters before rate() produce phantom spikes?'],
    tags: ['promql', 'best practices', 'correctness', 'performance'],
  },
  {
    id: 'itv-prom-17',
    level: 'basic',
    kind: 'open',
    prompt: 'What is an exporter, and what do you do about software that does not expose metrics?',
    probing: 'The ecosystem, and a practical answer for legacy systems.',
    answer: [
      'An **exporter** is a small process that translates something else’s metrics into the Prometheus format and exposes them on `/metrics`. It exists because most software does not speak Prometheus natively.',
      'The common ones: **node_exporter** for machine metrics (CPU, memory, disk, network), **blackbox_exporter** for probing endpoints from outside (HTTP, TCP, DNS, ICMP), **postgres_exporter**, **redis_exporter**, **kube-state-metrics** for Kubernetes object state, and **cAdvisor** for container resource usage.',
      'For software with no exporter, the options in order of preference: check whether one exists in the community (there usually is), write a small one using a Prometheus client library, or use the **textfile collector** in node_exporter - a script writes metrics to a file on a schedule and node_exporter serves them. That last one is an excellent answer for legacy systems and cron-driven checks, because it needs no long-running process of your own.',
      'For anything you write yourself, instrument it **directly** with a client library rather than writing an exporter. The application knows more about its own behaviour than anything observing it from outside.',
    ],
    code: [
      {
        title: 'Textfile collector for something with no exporter',
        language: 'bash',
        code: `#!/usr/bin/env bash
# Run from cron; node_exporter serves whatever is in this directory.
set -euo pipefail

OUT=/var/lib/node_exporter/textfile_collector/backup.prom

# Write atomically - node_exporter may read mid-write otherwise
{
  echo '# HELP backup_last_success_timestamp_seconds Unix time of last successful backup.'
  echo '# TYPE backup_last_success_timestamp_seconds gauge'
  echo "backup_last_success_timestamp_seconds $(stat -c %Y /backups/latest.tar.gz)"

  echo '# HELP backup_size_bytes Size of the most recent backup.'
  echo '# TYPE backup_size_bytes gauge'
  echo "backup_size_bytes $(stat -c %s /backups/latest.tar.gz)"
} > "\${OUT}.tmp"

mv "\${OUT}.tmp" "$OUT"`,
        explanation:
          'Writing to a temp file and moving it is essential - node_exporter can read a partially written file otherwise.',
      },
    ],
    traps: [
      'Writing the textfile directly rather than atomically, producing parse errors.',
      'A stale textfile that keeps reporting an old value after the job stopped running - always export a timestamp so you can alert on staleness.',
      'Writing an exporter for your own application instead of instrumenting it directly.',
    ],
    followUps: ['How would you alert that a backup has not run, using that metric?'],
    tags: ['exporters', 'node_exporter', 'textfile collector', 'fundamentals'],
  },
  {
    id: 'itv-prom-18',
    level: 'advanced',
    kind: 'open',
    prompt: 'How does Prometheus store data, and what are the implications?',
    probing: 'TSDB internals, which explain most operational behaviour.',
    answer: [
      'Prometheus writes to a local **TSDB**. Incoming samples go into an in-memory **head block** and are simultaneously appended to a **write-ahead log** for crash recovery. Every two hours the head block is compacted into an immutable **persistent block** on disk, and those blocks are later compacted together into larger ones covering longer ranges.',
      'Samples are stored very efficiently - roughly **1 to 2 bytes per sample** after compression, because consecutive values in a time series are usually similar. That is why disk is rarely the constraint and memory usually is.',
      "The operational implications follow from this design. **Memory scales with active series**, not with retention, because the head block holds every currently-active series. **Local storage is not replicated or durable** - the node's disk is the only copy - so Prometheus is explicitly not designed as a long-term durable store. And **blocks are immutable**, so you cannot edit or backfill data in the normal course of operation.",
      'The consequence for architecture is that long-term storage and high availability are handled **outside** Prometheus: **Thanos**, **Mimir** or **Cortex** take blocks (or a remote-write stream) into object storage, deduplicate across replicas, and provide a global query view. Running two identical Prometheus servers scraping the same targets gives you redundancy; something in front of them gives you a single coherent view.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'How a sample reaches disk',
        caption: 'The head block is why memory tracks active series rather than retention.',
        nodes: [
          { label: 'Scrape', detail: 'Every 15-60s', tone: 'accent' },
          {
            label: 'Head block (memory)',
            detail: 'All active series - the memory cost',
            tone: 'warning',
          },
          { label: 'WAL (disk)', detail: 'Written simultaneously, for crash recovery' },
          { label: 'Compact to a 2h block', detail: 'Immutable once written' },
          { label: 'Compacted into larger blocks', detail: 'Over time' },
          {
            label: 'Shipped to object storage',
            detail: 'Thanos / Mimir - optional',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'The WAL is replayed on startup, which is why a Prometheus with many series can take several minutes to become ready after a restart.',
      'Retention is by time (`--storage.tsdb.retention.time`) or size. Reducing it frees disk but has little effect on memory.',
      'Because blocks are immutable and local, backing up Prometheus means copying block directories or shipping them to object storage - there is no built-in backup.',
      'Two identical Prometheus servers scraping the same targets is the standard HA pattern; Thanos Querier deduplicates their overlapping data.',
    ],
    traps: [
      'Treating Prometheus as a durable long-term store. It is a local, short-retention system by design.',
      'Expecting retention settings to solve a memory problem.',
      'Not accounting for WAL replay time when restarting a large server.',
    ],
    followUps: [
      'How would you keep two years of metrics?',
      'Why does a large Prometheus take minutes to start?',
    ],
    tags: ['tsdb', 'storage', 'architecture', 'thanos', 'advanced'],
  },
  {
    id: 'itv-prom-19',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does the `up` metric tell you?',
    probing: 'A small but genuinely important detail.',
    options: [
      {
        id: 'a',
        text: 'Whether the last scrape of a target succeeded - 1 for success, 0 for failure',
      },
      { id: 'b', text: 'How long the target process has been running' },
      { id: 'c', text: 'Whether the application reports itself as healthy' },
      { id: 'd', text: 'The number of instances currently running' },
    ],
    correct: ['a'],
    answer: [
      '`up` is **generated by Prometheus itself**, not by the target. It is 1 if the last scrape succeeded and 0 if it failed - connection refused, timeout, a non-200 response, unparseable output.',
      'It is the most fundamental alert you can write. `up == 0 for 5m` means "I cannot reach this thing", which covers the process being dead, the network being broken, and the metrics endpoint being broken - all cases where every other metric from that target is simply absent and therefore silently unalertable.',
      'What it does **not** tell you is whether the application is working. A process can be scraping fine while returning errors to every user. `up` is liveness from the monitoring system’s point of view, not application health.',
      'The related detail worth knowing is that when a target disappears from service discovery entirely, `up` stops existing rather than becoming 0 - so an alert on `up == 0` will not fire for a target that was deleted. `absent()` covers that case.',
    ],
    code: [
      {
        title: 'The two alerts this enables',
        language: 'yaml',
        code: `groups:
  - name: availability
    rules:
      - alert: TargetDown
        expr: up == 0
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "{{ $labels.job }} target {{ $labels.instance }} is unreachable"

      # up stops existing if the target vanishes from discovery entirely
      - alert: TargetMissing
        expr: absent(up{job="api"})
        for: 10m
        labels: { severity: critical }
        annotations:
          summary: "No targets at all are being discovered for job api"`,
      },
    ],
    traps: [
      'Assuming `up == 1` means the application is healthy.',
      'Alerting only on `up == 0` and missing the case where the target disappeared from discovery.',
      'No `for:` clause, so a single failed scrape pages someone.',
    ],
    followUps: ['What happens to `up` if a target is removed from service discovery?'],
    tags: ['up', 'alerting', 'availability', 'fundamentals'],
  },
]
