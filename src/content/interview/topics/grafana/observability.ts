import type { InterviewQuestion } from '../../../types'

/** Metrics, logs and traces as one system - and the standards that join them up. */
export const grafanaObservabilityQuestions: InterviewQuestion[] = [
  {
    id: 'itv-graf-25',
    level: 'basic',
    kind: 'open',
    prompt: 'What are the three pillars of observability, and what does each one actually answer?',
    probing:
      'The framing question for the whole topic. A weak answer lists three words; a good one says what each is for.',
    answer: [
      '**Metrics** are numbers over time, aggregated: request rate, error ratio, latency percentiles, memory in use. They are tiny to store and cheap to query over long ranges, which makes them what you alert on and what you graph for months. What they cannot do is tell you about one specific request - by the time it is a metric it has been aggregated with everything else.',
      '**Logs** are discrete events with detail: this request, at this moment, failed with this error code for this user. They answer "what exactly happened" once you already know roughly where and when to look. They are far more expensive per unit of information, and they cannot be scanned cheaply across a month.',
      '**Traces** are the path of one request across services, as a tree of timed spans. They answer "where did the time go" and "which hop failed" in a system where one user action touches eight services. Neither metrics nor logs can show you that shape.',
      'The way I would frame it in an interview: metrics tell you **that** something is wrong and let you alert on it, traces tell you **where**, and logs tell you **why**. A real investigation walks all three in that order.',
      'And the important caveat: three pillars standing separately are not observability, they are three data sources. What makes the difference is **correlation** - a trace ID in every log line, exemplars linking a latency histogram to a real trace, and consistent labels such as `service` and `namespace` meaning the same thing everywhere. Without that you are copying timestamps between three browser tabs.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'How an investigation actually runs',
        caption:
          'Each signal hands off to the next. Correlation is what makes the handoff possible.',
        nodes: [
          {
            label: 'Alert fires on a metric',
            detail: 'checkout error ratio above 2 percent for 5 minutes',
            tone: 'danger',
          },
          {
            label: 'Dashboard narrows it',
            detail: 'one service, one region, started at 09:14',
            arrowLabel: 'that something is wrong',
          },
          {
            label: 'Exemplar jumps to a trace',
            detail: 'a real slow request behind the p99 spike',
            arrowLabel: 'where it is wrong',
            tone: 'accent',
          },
          {
            label: 'Span shows the failing hop',
            detail: '2.3s waiting on the payments gateway',
            arrowLabel: 'which component',
            tone: 'accent',
          },
          {
            label: 'Logs for that trace id',
            detail: 'connection pool exhausted after a config change',
            arrowLabel: 'why it is wrong',
            tone: 'success',
          },
        ],
      },
    ],
    traps: [
      'Listing the three words with no sense of what each is good and bad at.',
      'Claiming logs can replace metrics. Counting log lines to get a request rate is enormously expensive.',
      'Forgetting correlation, which is the part that turns three data sources into observability.',
    ],
    followUps: [
      'Which would you add first to a service that has none of them?',
      'What is an exemplar?',
      'How do you get a trace ID into a log line?',
    ],
    tags: ['observability', 'fundamentals', 'metrics', 'logs', 'traces'],
  },
  {
    id: 'itv-graf-26',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is OpenTelemetry, and why does it matter to a platform team?',
    probing:
      'The standard that reshaped this space. They want to hear about vendor neutrality and the collector.',
    answer: [
      '**OpenTelemetry** - OTel - is a CNCF project that standardises how telemetry is produced: one set of APIs and SDKs per language for traces, metrics and logs, one wire protocol (**OTLP**), and a set of **semantic conventions** that fix the attribute names, so `service.name` and `http.response.status_code` mean the same thing everywhere.',
      'Before it, instrumentation was vendor-specific. Choosing Jaeger meant Jaeger client libraries compiled into every service; changing backend meant changing code in every service and redeploying the estate. That is a serious lock-in, and it is the problem OTel exists to remove.',
      'The piece that matters most operationally is the **OpenTelemetry Collector**: a standalone process that receives telemetry over OTLP, processes it - batching, attribute editing, redaction, filtering, tail sampling - and exports it to one or more backends. Applications send to the collector and know nothing about where the data ends up.',
      'For a platform team that is transformative. You can switch from Jaeger to Tempo, add a second backend during a migration, or start redacting a field that turned out to contain personal data, and every one of those is a collector configuration change rather than a change to forty services.',
      'The other thing worth knowing is **auto-instrumentation**. For Java, .NET, Python, Node and Go you can attach an agent - in Kubernetes, the OTel Operator injects it - and get HTTP, gRPC and database spans with no code change at all. That is usually how adoption starts: auto-instrument everything for the free baseline, then add manual spans where the business logic actually lives.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Why the collector is the important part',
        caption: 'Applications speak OTLP to one place. Everything downstream becomes config.',
        nodes: [
          {
            label: 'Services',
            detail: 'OTel SDK or auto-instrumentation - they know only OTLP',
            tone: 'accent',
          },
          {
            label: 'OTel Collector',
            detail: 'receive, batch, redact, filter, tail-sample',
            arrowLabel: 'OTLP',
            tone: 'success',
          },
          {
            label: 'Traces to Tempo',
            detail: 'or Jaeger, or a vendor - a config line',
            arrowLabel: 'export',
          },
          {
            label: 'Metrics to Prometheus',
            detail: 'remote write or a scrape endpoint',
            arrowLabel: 'export',
          },
          {
            label: 'Logs to Loki',
            detail: 'one pipeline for all three signals',
            arrowLabel: 'export',
          },
        ],
      },
    ],
    code: [
      {
        title: 'A collector that redacts, samples and fans out',
        language: 'yaml',
        explanation:
          'Every one of these behaviours would otherwise be a code change in every service.',
        code: `receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024

  # Add environment context once, centrally
  resource:
    attributes:
      - key: deployment.environment
        value: production
        action: upsert

  # Redact anything that should never reach a backend
  attributes:
    actions:
      - key: http.request.header.authorization
        action: delete
      - key: user.email
        action: delete

  # Keep every error and slow trace, 2% of the rest
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 1000 }
      - name: sample-the-rest
        type: probabilistic
        probabilistic: { sampling_percentage: 2 }

exporters:
  otlp/tempo:
    endpoint: tempo-distributor.monitoring.svc:4317
    tls: { insecure: true }
  prometheusremotewrite:
    endpoint: http://mimir.monitoring.svc/api/v1/push
  loki:
    endpoint: http://loki-gateway.monitoring.svc/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [resource, attributes, tail_sampling, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [resource, batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [resource, attributes, batch]
      exporters: [loki]`,
      },
    ],
    deeper: [
      'Tail sampling must see every span of a trace to decide, so it has to run where a whole trace lands. That means a two-tier collector - a DaemonSet agent that forwards by trace ID to a gateway deployment that samples - not a plain DaemonSet.',
      'Semantic conventions are the underrated half of OTel. Consistent attribute names are what make one dashboard work across every service, and they are stable enough now to standardise on.',
      'OTel metrics can replace a Prometheus client library, but plenty of teams keep Prometheus-native metrics and use OTel only for traces. That is a perfectly defensible position and worth saying rather than pretending OTel must own everything.',
    ],
    traps: [
      'Describing OTel as "a tracing tool". It covers all three signals and is primarily a standard.',
      'Running tail sampling on a per-node DaemonSet, where no single instance sees a whole trace.',
    ],
    followUps: [
      'What is OTLP?',
      'How does auto-instrumentation work in Kubernetes?',
      'Head sampling or tail sampling - which and why?',
    ],
    tags: ['opentelemetry', 'observability', 'collector', 'standards'],
  },
  {
    id: 'itv-graf-27',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain distributed tracing. What are spans, trace context and propagation?',
    probing:
      'Core tracing mechanics. Propagation is the part people get vague about, and it is the part that breaks.',
    answer: [
      'A **trace** is one request’s journey through your system. It is made of **spans**: each span is one unit of work - an HTTP handler, a database query, a queue publish - with a name, a start and end time, attributes, and a link to its parent span. Together they form a tree, and drawing that tree on a time axis is the waterfall view you see in Tempo or Jaeger.',
      'The identifiers are simple. A **trace ID** is shared by every span in the request. A **span ID** is unique to one span. A **parent span ID** is what builds the tree.',
      '**Propagation** is the mechanism that keeps the trace ID alive across a process boundary. When service A calls service B, it injects the trace context into the outgoing request headers, and B extracts it and continues the same trace instead of starting a new one. The standard is W3C **traceparent**, a single header carrying version, trace ID, parent span ID and flags. There is also `tracestate` for vendor data, and older formats such as B3 from Zipkin that you will still meet.',
      'Propagation is where tracing breaks in practice, and it is worth naming the three causes: a service that does not forward the header at all, so the trace splits into two unconnected halves; an asynchronous hop - a queue or a background job - where the context must be carried in the message rather than in an HTTP header and usually is not; and a proxy, gateway or service mesh that strips unknown headers.',
      'The symptom is always the same: traces that start at service C with no parent, and a waterfall that stops where the interesting part begins.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'Trace context crossing service boundaries',
        caption: 'One header carries the trace. Drop it anywhere and the trace breaks in two.',
        participants: [
          { id: 'user', label: 'Browser' },
          { id: 'gw', label: 'API gateway' },
          { id: 'checkout', label: 'Checkout' },
          { id: 'payments', label: 'Payments' },
        ],
        messages: [
          { from: 'user', to: 'gw', label: 'POST /order' },
          { from: 'gw', to: 'checkout', label: 'traceparent: 00-4bf92f35...-a1b2-01' },
          { from: 'checkout', to: 'payments', label: 'same trace id, new parent span' },
          { from: 'payments', to: 'checkout', label: '500 after 2.3s', kind: 'return' },
          { from: 'checkout', to: 'gw', label: '502', kind: 'return' },
          { from: 'gw', to: 'user', label: 'error page', kind: 'return' },
        ],
      },
    ],
    code: [
      {
        title: 'What propagation looks like on the wire, and in code',
        language: 'python',
        explanation:
          'Auto-instrumentation does the inject and extract for you over HTTP. Async hops need it done by hand.',
        code: `# The header, on the wire:
#   traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
#                ^v  ^trace id (32 hex)              ^parent span id  ^flags

from opentelemetry import trace
from opentelemetry.propagate import inject, extract

tracer = trace.get_tracer(__name__)

# --- Synchronous HTTP: instrumentation handles this automatically ----
with tracer.start_as_current_span("charge_card") as span:
    span.set_attribute("payment.provider", "stripe")
    span.set_attribute("order.id", order_id)      # never the card number
    headers = {}
    inject(headers)                                # adds traceparent
    response = httpx.post(PAYMENTS_URL, headers=headers, json=payload)


# --- Asynchronous hop: YOU must carry the context in the message -----
# This is the step teams forget, and it is why queue consumers
# show up as orphan traces.
message = {"order_id": order_id, "traceparent_carrier": {}}
inject(message["traceparent_carrier"])
queue.publish(message)

# ...and in the consumer, on the other side:
ctx = extract(message["traceparent_carrier"])
with tracer.start_as_current_span("process_order", context=ctx):
    handle(message)`,
      },
    ],
    deeper: [
      'Span attributes are where the value is. A span named "db.query" with no attributes tells you almost nothing; add the statement summary, the table and the row count and it becomes diagnostic.',
      'Span **events** and **links** cover the cases the parent-child tree cannot: an event marks a moment inside a span, and a link connects traces that are related but not nested, which is how batch and fan-out work is modelled.',
      'Record errors properly - set the span status to ERROR and call record_exception. Backends and dashboards key off span status, and a failed span left as OK is invisible to every error query.',
    ],
    traps: [
      'Forgetting propagation across queues and background jobs, which silently splits traces.',
      'Putting personal data or secrets into span attributes. Traces are stored and shared like any other telemetry.',
      'Assuming a service mesh gives you full tracing. It creates spans for the hops it proxies, but without in-process propagation the tree is still broken.',
    ],
    followUps: [
      'What is in the traceparent header?',
      'Why do traces break at a message queue?',
      'How would you find where propagation is being dropped?',
    ],
    tags: ['tracing', 'opentelemetry', 'propagation', 'observability'],
  },
  {
    id: 'itv-graf-28',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How do you correlate metrics, logs and traces in Grafana so an investigation flows between them?',
    probing:
      'The question that separates someone who has built a stack from someone who has read about one.',
    answer: [
      'Correlation is a deliberate feature you configure, not something that happens because the three data sources sit in the same Grafana. There are four mechanisms and they are worth naming individually.',
      '**Exemplars** link a metric to a trace. When a Prometheus histogram records an observation, the client can attach the trace ID of the request that produced it. Grafana then draws little diamonds on the latency graph, and clicking one opens the actual trace behind that p99 spike. This is the strongest link in the chain because it takes you from an aggregate straight to a concrete example.',
      '**Trace to logs** goes the other way. Configure the Tempo data source with the Loki data source and a label mapping, and every span gets a "Logs for this span" button that runs a LogQL query scoped to that pod and that time window - and, if the trace ID is in the log line, to that exact request.',
      '**Logs to trace** is a derived field on the Loki data source: a regex that finds the trace ID in a log line and turns it into a link to Tempo. Ten minutes of configuration, and it is the one people use most.',
      '**Consistent labels** underpin all of it. `service`, `namespace` and `cluster` must mean the same thing in Prometheus, Loki and Tempo, or none of these links can be built. Adopting the OpenTelemetry semantic conventions is the cheapest way to get that.',
      'What this adds up to in an incident: alert fires on error ratio, click the panel to see the latency spike, click an exemplar to open a slow trace, see the payments span taking 2.3 seconds, click through to the logs for that span, and read the connection-pool error. Four clicks, no timestamp copying, no context switching. That is the thing worth describing, because it is what the interviewer is really asking about.',
    ],
    code: [
      {
        title: 'Wiring the three links in data-source provisioning',
        language: 'yaml',
        explanation:
          'These three blocks are the whole feature. Most stacks have the data and have never configured them.',
        code: `apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    uid: prometheus
    jsonData:
      exemplarTraceIdDestinations:
        - name: trace_id         # the exemplar label holding the id
          datasourceUid: tempo   # where clicking a diamond goes

  - name: Loki
    type: loki
    uid: loki
    jsonData:
      derivedFields:
        # Find a trace id in the log line, make it a link to Tempo
        - name: TraceID
          matcherRegex: '"trace_id":"(\\w+)"'
          url: '\${__value.raw}'
          datasourceUid: tempo

  - name: Tempo
    type: tempo
    uid: tempo
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        spanStartTimeShift: '-5m'
        spanEndTimeShift: '5m'
        # map span attributes onto Loki stream labels
        tags:
          - key: service.name
            value: app
          - key: k8s.namespace.name
            value: namespace
        filterByTraceID: true
      tracesToMetricsV2:
        datasourceUid: prometheus
        queries:
          - name: 'Request rate for this service'
            query: 'sum(rate(http_requests_total{app="$\${__tags.app}"}[5m]))'`,
      },
      {
        title: 'Emitting exemplars from the application',
        language: 'python',
        explanation:
          'The histogram observation carries the trace ID. Without this the diamonds never appear.',
        code: `from prometheus_client import Histogram
from opentelemetry import trace

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "Request duration",
    ["method", "route", "status"],
)

def record(method, route, status, seconds):
    span = trace.get_current_span()
    ctx = span.get_span_context()

    REQUEST_DURATION.labels(method, route, status).observe(
        seconds,
        # The exemplar: a sample value with a trace id attached.
        # Prometheus must run with --enable-feature=exemplar-storage
        exemplar={"trace_id": format(ctx.trace_id, "032x")},
    )`,
      },
    ],
    deeper: [
      'Exemplar storage is off by default in Prometheus and must be enabled with a feature flag, and exemplars are only kept for recent data. People configure the Grafana side, see no diamonds, and conclude it does not work.',
      'Trace-to-logs relies on the span’s time window plus a label mapping. Widen the shift a little - a span at the boundary of a second will otherwise miss its own log lines.',
      'The single highest-value step if you can only do one: get the trace ID into every log line and add the Loki derived field. It is an afternoon of work and it changes how every incident feels.',
    ],
    traps: [
      'Assuming Grafana correlates automatically because all three data sources exist.',
      'Different label names per signal - `app` in Loki, `service` in Prometheus, `service.name` in Tempo - which makes the links unbuildable.',
    ],
    followUps: [
      'What exactly is an exemplar and how is it stored?',
      'What would you configure first with limited time?',
      'How do you get the trace ID into the log line in the first place?',
    ],
    tags: ['observability', 'correlation', 'exemplars', 'grafana'],
  },
  {
    id: 'itv-graf-29',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'Your service handles 50,000 requests per second. What is the standard approach to tracing it?',
    options: [
      { id: 'a', text: 'Trace every request - traces are cheap to store' },
      {
        id: 'b',
        text: 'Sample, keeping all errors and slow requests plus a small percentage of the rest',
      },
      { id: 'c', text: 'Turn tracing on only during incidents' },
      { id: 'd', text: 'Trace one instance of the service and extrapolate from it' },
    ],
    correct: ['b'],
    probing:
      'Whether you have thought about the cost of tracing. Full tracing at this rate is unaffordable.',
    answer: [
      'At 50,000 requests per second, with maybe ten spans each, you are producing half a million spans per second. Stored in full that is terabytes a day for data whose value is overwhelmingly concentrated in the small fraction of requests that were slow or failed.',
      'The standard approach is **tail sampling**: buffer the spans of a trace until it completes, then decide. Keep every trace with an error, every trace above a latency threshold, and a small probabilistic sample - one or two percent - of everything else so you still have a baseline of normal behaviour to compare against.',
      'The alternative, **head sampling**, decides at the first span using only the trace ID. It is far cheaper and needs no buffering, but it is blind: it throws away errors at the same rate as successes, which defeats the purpose. It is still the right choice when volume is enormous and you cannot afford the buffering.',
      'Option A is unaffordable at this rate. Option C fails because an incident is exactly when you cannot go back and trace what already happened - and turning instrumentation on under load is itself risky. Option D misunderstands tracing: a trace spans services, so tracing one instance gives you broken partial traces, not a sample.',
      'The thing to add is that **metrics stay complete**. Sampling applies to traces; you still count every request in a counter and every latency in a histogram. So your error rate and p99 are exact, and the traces are a set of worked examples behind them. That combination is what makes sampling acceptable.',
    ],
    code: [
      {
        title: 'Tail sampling policies, in priority order',
        language: 'yaml',
        explanation:
          'Policies are OR-ed: a trace matching any of them is kept. Errors and slow traces first, then a baseline.',
        code: `processors:
  tail_sampling:
    # How long to wait for all spans of a trace to arrive
    decision_wait: 10s
    num_traces: 100000

    policies:
      # 1. Always keep failures
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }

      # 2. Always keep anything slow
      - name: slow-requests
        type: latency
        latency: { threshold_ms: 500 }

      # 3. Always keep traces from a tenant under investigation
      - name: debug-tenant
        type: string_attribute
        string_attribute:
          key: tenant.id
          values: [acme-corp]

      # 4. Keep 1% of everything else as a baseline
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 1 }`,
      },
    ],
    deeper: [
      'Tail sampling needs every span of a trace in one collector instance, so the topology is: agent DaemonSet, then a load-balancing exporter that routes by trace ID, then a gateway collector that samples. Getting this wrong means traces sampled with half their spans missing.',
      'The buffer is real memory - `num_traces` multiplied by trace size held for `decision_wait`. Size the gateway for it, and watch for spans arriving after the decision window, which are dropped.',
      'Grafana Tempo’s span metrics processor generates RED metrics from 100% of spans before sampling, so you get exact rates and latencies even though only a fraction of traces are stored. That is a strong answer to "but do you not lose accuracy?".',
    ],
    traps: [
      'Head sampling at 1% and then wondering why the trace for a reported error cannot be found.',
      'Running tail sampling per node, where no instance sees a complete trace.',
    ],
    followUps: [
      'Head versus tail sampling - the trade-off?',
      'How do you keep accurate error rates while sampling traces?',
      'What topology does tail sampling require?',
    ],
    tags: ['tracing', 'sampling', 'opentelemetry', 'scale'],
  },
  {
    id: 'itv-graf-30',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain SLI, SLO and error budgets. How do they change what you alert on?',
    probing:
      'SRE fundamentals. The real test is whether you can connect them to alerting practice.',
    answer: [
      'An **SLI** is a measurement of something users care about, expressed as a ratio of good events to total events: the proportion of requests served successfully, or served in under 300 milliseconds.',
      'An **SLO** is the target for that indicator over a window: 99.9% of requests succeed over 30 days. It is a deliberate choice, and choosing less than 100% is the point - perfect reliability is impossible and, more importantly, not worth what it costs.',
      'The **error budget** is the remainder. 99.9% over 30 days permits about 43 minutes of failure. That budget is a resource the team gets to spend: burn it slowly and you can ship features quickly; burn it all and the sensible response is to stop shipping and spend the time on reliability instead. It turns an argument about risk appetite into arithmetic.',
      'The change to alerting is the significant part. Traditional alerting is threshold-based - CPU above 80%, error rate above 1% - which produces alerts that are either noise or arrive too late. SLO alerting uses **burn rate**: how fast you are consuming the budget relative to the rate that would exhaust it exactly at the window’s end.',
      'A burn rate of 1 means you will finish the month having used precisely your budget. A burn rate of 14.4 means you will exhaust a 30-day budget in two days - that is a page. A burn rate of 3 is worth a ticket, not a 3am phone call. Google’s multi-window multi-burn-rate approach then requires both a short and a long window to agree before firing, which is what removes the flapping.',
      'The practical effect is fewer, better alerts: you page when users are meaningfully affected at a meaningful rate, not when a machine is briefly busy.',
    ],
    code: [
      {
        title: 'Multi-window burn-rate alerts',
        language: 'yaml',
        explanation:
          'The short window makes it responsive; the long window stops it flapping. Both must agree.',
        code: `groups:
  - name: checkout-slo
    rules:
      # Precompute the error ratio at several windows
      - record: job:slo_errors:ratio5m
        expr: |
          sum(rate(http_requests_total{job="checkout",status=~"5.."}[5m]))
            /
          sum(rate(http_requests_total{job="checkout"}[5m]))

      - record: job:slo_errors:ratio1h
        expr: |
          sum(rate(http_requests_total{job="checkout",status=~"5.."}[1h]))
            /
          sum(rate(http_requests_total{job="checkout"}[1h]))

      # FAST burn: 14.4x eats a 30-day budget in ~2 days. Page.
      - alert: CheckoutErrorBudgetBurningFast
        expr: |
          job:slo_errors:ratio5m > (14.4 * 0.001)
            and
          job:slo_errors:ratio1h > (14.4 * 0.001)
        for: 2m
        labels: { severity: page }
        annotations:
          summary: Checkout is burning its error budget 14x too fast
          runbook_url: https://runbooks.internal/checkout-slo

      # SLOW burn: real, but it can wait for office hours. Ticket.
      - alert: CheckoutErrorBudgetBurningSlowly
        expr: job:slo_errors:ratio1h > (3 * 0.001)
        for: 15m
        labels: { severity: ticket }`,
      },
    ],
    deeper: [
      'Pick SLIs users would recognise. "The checkout page returns in under 300ms" is an SLI; "CPU below 80%" is not - users have no opinion about CPU.',
      'Grafana has a purpose-built SLO view in some editions, and Sloth or Pyrra generate the full set of recording and alerting rules from a short SLO definition. Hand-writing burn-rate rules for fifty services is not a good use of anyone’s time.',
      'The error budget only works if the organisation genuinely honours it. An SLO that is breached with no change in behaviour is a dashboard, not a policy - and saying that in an interview shows you have seen it happen.',
    ],
    traps: [
      'Setting an SLO of 100%. It leaves no budget, so every blip is a breach and the mechanism stops meaning anything.',
      'Alerting on a raw threshold and calling it an SLO alert.',
      'Measuring the SLI server-side only, when the user’s experience includes the network and the CDN.',
    ],
    followUps: [
      'Why multiple windows rather than one?',
      'What is the difference between an SLO and an SLA?',
      'How would you choose the SLI for a batch pipeline?',
    ],
    tags: ['sre', 'slo', 'alerting', 'error budget'],
  },
  {
    id: 'itv-graf-31',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'Which set of metrics does the RED method prescribe for a request-driven service?',
    options: [
      { id: 'a', text: 'Rate, Errors, Duration' },
      { id: 'b', text: 'Requests, Endpoints, Dependencies' },
      { id: 'c', text: 'Reliability, Efficiency, Durability' },
      { id: 'd', text: 'Utilisation, Saturation, Errors' },
    ],
    correct: ['a'],
    probing: 'A named framework they expect you to know, and to be able to contrast with USE.',
    answer: [
      '**RED** is Rate, Errors, Duration: how many requests per second, how many of them fail, and how long they take. It is the right starting set for anything request-driven - an HTTP API, a gRPC service, a queue consumer - because it describes what the user experiences.',
      'Option D is **USE**, which is the counterpart for resources: Utilisation, Saturation and Errors, applied to CPUs, disks, network links and memory. USE tells you whether a resource is the constraint.',
      'The two are complementary and the distinction is worth stating: RED is about **services** and what users feel; USE is about **resources** and what is running out. A service dashboard should lead with RED, with USE panels underneath to explain a RED problem.',
      '**The Four Golden Signals** from the Google SRE book are the third name in this family - latency, traffic, errors and saturation - essentially RED plus saturation.',
      'The practical payoff is standardisation. If every service exposes the same RED metrics with the same names, one templated Grafana dashboard serves the entire estate, and an on-call engineer reads an unfamiliar service the same way they read a familiar one.',
    ],
    code: [
      {
        title: 'RED in PromQL',
        language: 'text',
        explanation: 'Three queries that work for any service instrumented to the same standard.',
        code: `# RATE - requests per second, by route
sum by (route) (rate(http_requests_total{job="checkout"}[$__rate_interval]))

# ERRORS - as a ratio, which is what an SLO needs
sum(rate(http_requests_total{job="checkout",status=~"5.."}[$__rate_interval]))
  /
sum(rate(http_requests_total{job="checkout"}[$__rate_interval]))

# DURATION - p50, p95 and p99 from a histogram.
# rate the buckets first, then aggregate, then take the quantile.
histogram_quantile(0.99,
  sum by (le, route) (
    rate(http_request_duration_seconds_bucket{job="checkout"}[$__rate_interval])
  )
)

# USE, for the resource underneath
# Utilisation
avg(rate(container_cpu_usage_seconds_total{pod=~"checkout-.*"}[5m]))
# Saturation - the queue behind the resource
avg(container_memory_working_set_bytes{pod=~"checkout-.*"})
  / avg(container_spec_memory_limit_bytes{pod=~"checkout-.*"})`,
      },
    ],
    deeper: [
      'Always express errors as a **ratio**, not a count. A hundred errors per second is fine at a million requests per second and catastrophic at two hundred.',
      'Averages hide everything that matters in latency. Use histograms and quantiles - a p99 of 4 seconds with a mean of 90ms is a normal and very bad state.',
      'For a queue consumer, translate RED: rate is messages consumed, errors are messages dead-lettered, duration is processing time - and add consumer lag, which is the saturation signal that actually predicts trouble.',
    ],
    followUps: [
      'How would you apply RED to a Kafka consumer?',
      'Why is an average latency misleading?',
      'What is saturation and why does USE include it?',
    ],
    tags: ['observability', 'red', 'use', 'metrics'],
  },
  {
    id: 'itv-graf-32',
    level: 'advanced',
    kind: 'open',
    prompt:
      'You are asked to add observability to a platform that has none. What do you do first, and in what order?',
    probing:
      'Prioritisation under constraint. There is no single right answer, but there is a wrong one: everything at once.',
    answer: [
      'I would sequence it by what reduces time-to-diagnosis fastest per unit of effort, and I would resist doing all three signals at once.',
      '**First, metrics and alerting on user-visible symptoms.** Prometheus with the Kubernetes service-discovery config, kube-state-metrics and node-exporter for the infrastructure, and the RED metrics from every service. Then a small number of alerts - error ratio, latency, and "is it up" - that page a human. Until something tells you an incident is happening, nothing else matters.',
      '**Second, centralised logs.** A node agent DaemonSet into Loki, with the Kubernetes labels attached. This is the biggest single quality-of-life improvement for engineers, because it replaces looping `kubectl logs` over pods that may already be gone. I would push structured JSON logging as the standard at the same time, because retrofitting it later across forty services is painful.',
      '**Third, dashboards that follow the hierarchy** - an overview, one templated service dashboard, and deep dives only where they earn it - all provisioned from Git. Not before this point: dashboards built before you know what breaks tend to show what was easy to graph.',
      '**Fourth, traces.** OTel auto-instrumentation into Tempo, with sampling from day one. Traces have the highest setup cost and the most prerequisites, and they pay off most in systems complex enough to need them - so they come last, unless the platform is already a deep microservice call graph, in which case I would move them earlier.',
      '**Throughout, correlation.** Trace ID in every log line, the Loki derived field, and consistent `service` and `namespace` labels across all three. That work is small and almost free if done as you go, and expensive to retrofit.',
      'Two things I would do regardless of order. Write a runbook link into every alert, because an alert without a next action trains people to ignore alerts. And measure the outcome - time to detect and time to diagnose - because that is what justifies the next tranche of investment.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Sequencing by value per unit of effort',
        caption: 'Each step is useful on its own. Nothing here waits for the step after it.',
        nodes: [
          {
            label: 'Metrics and symptom alerts',
            detail: 'Prometheus, RED metrics, a handful of pages that matter',
            tone: 'success',
          },
          {
            label: 'Centralised logs',
            detail: 'agent DaemonSet into Loki, structured JSON as the standard',
            arrowLabel: 'then',
            tone: 'success',
          },
          {
            label: 'Dashboards from Git',
            detail: 'overview, templated service view, few deep dives',
            arrowLabel: 'then',
            tone: 'accent',
          },
          {
            label: 'Traces with sampling',
            detail: 'OTel auto-instrumentation into Tempo',
            arrowLabel: 'then',
            tone: 'accent',
          },
          {
            label: 'Correlation everywhere',
            detail: 'trace id in logs, exemplars, one label vocabulary',
            arrowLabel: 'as you go',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'kube-prometheus-stack gets you Prometheus, Alertmanager, Grafana, node-exporter, kube-state-metrics and a working set of alerts in one Helm release. Starting from scratch instead is weeks of work for a worse result.',
      'Agree the label vocabulary on day one - `service`, `namespace`, `cluster`, `environment` - because changing it later invalidates every dashboard and alert you have written.',
      'Budget for the ongoing cost, not just the setup. Observability commonly runs at 5 to 15 percent of infrastructure spend, and a platform with no plan for that ends up deleting data during a cost review, usually the week before an incident that needed it.',
    ],
    traps: [
      'Starting with dashboards. Pretty panels nobody alerts on do not shorten a single incident.',
      'Instrumenting everything with traces before there is a single alert.',
      'Deferring the label standard, which is the one decision that is genuinely expensive to change.',
    ],
    followUps: [
      'What would you deploy on day one specifically?',
      'How would you convince teams to adopt structured logging?',
      'What would you measure to show it worked?',
    ],
    tags: ['observability', 'platform', 'strategy', 'sre'],
  },
  {
    id: 'itv-graf-33',
    level: 'advanced',
    kind: 'open',
    prompt:
      'What is continuous profiling, and where does it fit alongside metrics, logs and traces?',
    probing:
      'A senior-level awareness question. Profiling is increasingly treated as a fourth signal.',
    answer: [
      '**Continuous profiling** samples what your code is actually executing - which functions are consuming CPU, allocating memory or holding locks - constantly, in production, at very low overhead. Grafana Pyroscope, Parca and the cloud vendors’ profilers all do this.',
      'It fills a specific gap. A trace tells you a span took 2.3 seconds; it does not tell you which function inside that span burned the time. Metrics tell you the pod is at 90% CPU; they do not say what the CPU is doing. Logs tell you nothing about either. Profiling answers "which line of code", which none of the other three can.',
      'The mechanism is statistical sampling - typically around 100 hertz, capturing a stack trace each time - which is why the overhead is a low single-digit percentage rather than the enormous cost of instrumenting every function call. Modern collectors use eBPF to do this for unmodified processes, so you get profiles with no code change and no restart.',
      'The two cases where it is transformative: a slow memory leak, where comparing today’s allocation profile against last week’s points straight at the growing call path; and a CPU regression after a release, where a differential flame graph between the two versions shows exactly what changed.',
      'Where it fits: I would treat it as the **fourth signal**, and as the last one to add. It needs the other three to tell you where to look, and its value is concentrated in performance work rather than availability. But once a platform is mature, it closes the last gap - "the request is slow and I do not know why" - and in Grafana it links from a trace span directly into the profile for that service and time window, which makes the handoff natural.',
    ],
    deeper: [
      'Flame graph literacy is the skill that makes this useful: width is time or allocation, the y-axis is stack depth, and you read plateaus rather than peaks. A differential flame graph between two releases is the highest-value view.',
      'eBPF-based profilers work on unmodified binaries but need symbols to be readable - a stripped Go or C++ binary produces a flame graph full of hexadecimal addresses. Ship symbols, or accept unreadable profiles.',
      'Profiles are large. Retention is typically days rather than months, which is fine because the questions they answer are about the recent past.',
    ],
    traps: [
      'Adding profiling before there is alerting. It answers a question you are not yet in a position to ask.',
      'Assuming it is free. A few percent CPU across a whole fleet is a real cost, worth measuring.',
    ],
    followUps: [
      'How do you read a flame graph?',
      'How would you use it to find a memory leak?',
      'How does eBPF profiling work without changing the application?',
    ],
    tags: ['profiling', 'observability', 'pyroscope', 'performance'],
  },
  {
    id: 'itv-graf-34',
    level: 'basic',
    kind: 'multi',
    prompt:
      'Which of these belong in a Grafana alert so the person woken at 3am can act? Select all that apply.',
    options: [
      { id: 'a', text: 'A summary naming the affected service and the user impact' },
      { id: 'b', text: 'A runbook link with the first diagnostic steps' },
      { id: 'c', text: 'A severity label that drives the routing policy' },
      { id: 'd', text: 'The full PromQL expression as the alert title' },
      { id: 'e', text: 'A link to the dashboard showing the failing metric' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    probing:
      'Alert quality. An alert that says "CPUHigh" and nothing else is a common and costly failure.',
    answer: [
      'The test for an alert is whether somebody half-awake, who did not build the service, can act on it. That means impact, context and a next step.',
      '**A** - the summary must say what is affected and what users experience. "Checkout is returning 5xx to customers" beats "HighErrorRate" every time, because it tells the reader whether to get out of bed.',
      '**B** - a runbook link is the single highest-value annotation. The first three diagnostic commands, written down when someone was calm, save far more time than any dashboard.',
      '**C** - the severity label is what routes it. Page for user-facing breakage, ticket for slow burns, and nothing at all for things that do not need a human.',
      '**E** - a dashboard link with the time range pre-set removes the "which dashboard was it?" step, which is genuinely where minutes go at 3am.',
      '**D** is the distractor. The query belongs in the alert rule, and it is available if needed, but as a title it is noise - the responder needs to know the impact, not the expression that detected it.',
      'The thing I would add: an alert nobody acts on should be deleted. Alerts that fire and get silenced every week train people to ignore the channel, and that is how a real page gets missed.',
    ],
    code: [
      {
        title: 'An alert somebody can actually act on',
        language: 'yaml',
        explanation:
          'Impact in the summary, numbers in the description, a runbook and a dashboard link.',
        code: `- alert: CheckoutHighErrorRate
  expr: |
    sum(rate(http_requests_total{job="checkout",status=~"5.."}[5m]))
      /
    sum(rate(http_requests_total{job="checkout"}[5m])) > 0.02
  for: 5m
  labels:
    severity: page
    team: payments
    service: checkout
  annotations:
    summary: 'Checkout is failing for customers - {{ $value | humanizePercentage }} of requests'
    description: >-
      More than 2% of checkout requests have returned 5xx for 5 minutes.
      Customers cannot complete orders. Current rate:
      {{ $value | humanizePercentage }}.
    runbook_url: https://runbooks.internal/checkout-high-error-rate
    dashboard_url: https://grafana.internal/d/checkout-svc?var-service=checkout&from=now-1h`,
      },
    ],
    traps: [
      'Alerting on causes such as CPU rather than symptoms users feel. It is the main source of alert fatigue.',
      'Naming an alert after the query rather than the impact.',
      'Keeping an alert that is silenced every week instead of deleting or fixing it.',
    ],
    followUps: [
      'How would you decide page versus ticket?',
      'What goes in a good runbook?',
      'How do you measure alert quality?',
    ],
    tags: ['alerting', 'on-call', 'grafana', 'sre'],
  },
  {
    id: 'itv-graf-35',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How does a service mesh change your observability, and what does it still not give you?',
    probing:
      'Tests whether you know the limits of infrastructure-level telemetry. Meshes are often oversold here.',
    answer: [
      'A mesh puts a proxy - Envoy in Istio, or a per-node proxy in Linkerd and Cilium - in the path of every request between services. Because every call passes through it, the mesh can emit telemetry for all of them without any application change at all.',
      'What you get for free is genuinely valuable: **RED metrics for every service-to-service edge** - request rate, error rate and latency, by source and destination - which gives you a service dependency graph you did not have to build. You also get consistent metric names across every service regardless of language, mTLS so those calls are encrypted, and spans for each proxy hop.',
      'What it does not give you is the part people assume it does. The mesh sees requests **between** processes; it has no idea what happens inside one. So it cannot tell you that the time went on a database query, a cache miss, a lock or a garbage-collection pause - it only knows the call took 2.3 seconds.',
      'More importantly, **the mesh cannot propagate trace context through your application**. It can generate a span for the hop, but if your code does not read the incoming `traceparent` header and attach it to its outgoing calls, the trace breaks at every service boundary. You get a collection of disconnected two-span traces rather than one tree. This surprises people, and it is the single most useful thing to say in answer to this question.',
      'It also gives you no business context - no order ID, no tenant, no user tier - and no visibility into anything that is not a proxied request, such as a queue consumer, a cron job or a call to an external API outside the mesh.',
      'So my position: a mesh is an excellent **complement**. Take its edge metrics and dependency graph gladly, and still instrument the applications with OpenTelemetry for in-process spans, context propagation and business attributes. Treating the mesh as a substitute for instrumentation is the mistake.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'What the mesh can and cannot see',
        caption: 'The proxy sees the edge. Everything inside the process is invisible to it.',
        root: {
          label: 'Pod',
          detail: 'one request arriving',
          children: [
            {
              label: 'Sidecar proxy',
              detail: 'sees: rate, errors, latency, source, destination, mTLS identity',
              tone: 'success',
            },
            {
              label: 'Application process',
              detail: 'the proxy sees none of the below',
              tone: 'muted',
              children: [
                {
                  label: 'Business logic and DB query',
                  detail: 'needs app instrumentation to be visible',
                  tone: 'warning',
                },
                {
                  label: 'Outgoing header propagation',
                  detail: 'the app must forward traceparent or the trace breaks',
                  tone: 'danger',
                },
              ],
            },
          ],
        },
      },
    ],
    deeper: [
      'Mesh metrics are high-cardinality by nature - source, destination, response code and route for every edge. On a large mesh this is one of the biggest contributors to Prometheus series count, and it usually needs trimming with relabel rules.',
      'eBPF-based meshes such as Cilium avoid the sidecar and its resource cost, but the observability limitation is identical: kernel-level visibility still cannot see inside the process or propagate application context.',
      'The dependency graph is the underrated feature. Knowing which services actually call which - rather than what the architecture diagram claims - is frequently the most useful thing a mesh gives you.',
    ],
    traps: [
      'Believing a mesh gives you full distributed tracing. Without in-app propagation you get disconnected hops.',
      'Dropping application instrumentation because the mesh "already does tracing".',
      'Ignoring the cardinality cost of per-edge metrics until Prometheus falls over.',
    ],
    followUps: [
      'Why exactly does the mesh need the app to forward headers?',
      'What does the mesh give you that application instrumentation cannot?',
      'How would you control the cardinality of mesh metrics?',
    ],
    tags: ['service mesh', 'observability', 'tracing', 'istio'],
  },
  {
    id: 'itv-graf-36',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you monitor a batch job or a cron job? The usual request-rate metrics do not apply.',
    probing:
      'Tests whether you can adapt the framework rather than reciting it. Batch is a genuine blind spot.',
    answer: [
      'The difficulty is that a batch job is not running when you look at it, so scraping it is unreliable - Prometheus may never see it at all. The signals also differ: nobody cares about its request rate, they care whether it ran, whether it succeeded, and whether the output is fresh.',
      'The four things I would measure: **did it run** at all within the expected interval; **did it succeed**, as an explicit exit status; **how long did it take**, so a job creeping towards its next scheduled start is visible before it collides; and **how much did it process**, because a job that succeeds having processed zero rows is usually a failure nobody noticed.',
      'For the plumbing there are two standard approaches. The **Pushgateway**: the job pushes its result metrics before exiting and Prometheus scrapes the gateway. This is the case the Pushgateway was actually designed for. The caveat is that pushed metrics persist until deleted, so a job that stops running keeps reporting its last success forever - which is why you always alert on the **timestamp**, never on the last status.',
      'The better modern option where it fits is the **Prometheus Agent or an OTLP push** to a remote-write endpoint, which avoids the Pushgateway’s staleness problem entirely. In Kubernetes, kube-state-metrics also exposes CronJob and Job state directly - last schedule time, last successful time, failed count - which covers "did it run and did it succeed" with no instrumentation in the job at all.',
      'The alert that matters most is the **freshness** one: "the last successful run was more than 26 hours ago" for a daily job. It catches the failure mode that a status-based alert cannot - the job that silently stopped being scheduled, where nothing fails because nothing runs.',
    ],
    code: [
      {
        title: 'Reporting a batch result, and alerting on absence',
        language: 'bash',
        explanation:
          'Push the completion timestamp and the row count. Alert on how long ago it was, not on the status.',
        code: `#!/usr/bin/env bash
set -euo pipefail

JOB=nightly-reconciliation
START=$(date +%s)

rows=$(run_reconciliation)           # the actual work
STATUS=$?
END=$(date +%s)

cat <<METRICS | curl -s --data-binary @- \\
  "http://pushgateway:9091/metrics/job/\${JOB}"
# TYPE batch_job_last_success_timestamp_seconds gauge
batch_job_last_success_timestamp_seconds \${END}
# TYPE batch_job_duration_seconds gauge
batch_job_duration_seconds $((END - START))
# TYPE batch_job_records_processed gauge
batch_job_records_processed \${rows}
# TYPE batch_job_last_exit_code gauge
batch_job_last_exit_code \${STATUS}
METRICS`,
      },
      {
        title: 'The alerts that actually catch batch failures',
        language: 'yaml',
        explanation: 'Freshness first. A job that stopped being scheduled never emits a failure.',
        code: `groups:
  - name: batch
    rules:
      # THE important one: it has not succeeded recently enough
      - alert: NightlyReconciliationStale
        expr: |
          time() - batch_job_last_success_timestamp_seconds{job="nightly-reconciliation"}
            > 26 * 3600
        labels: { severity: page }
        annotations:
          summary: Nightly reconciliation has not succeeded in over 26 hours

      # Succeeded, but did nothing - the silent failure
      - alert: ReconciliationProcessedNothing
        expr: batch_job_records_processed{job="nightly-reconciliation"} == 0
        labels: { severity: ticket }

      # Creeping towards its own next start time
      - alert: ReconciliationSlow
        expr: batch_job_duration_seconds{job="nightly-reconciliation"} > 3600
        labels: { severity: ticket }

      # Straight from kube-state-metrics, no instrumentation needed
      - alert: CronJobFailing
        expr: kube_job_status_failed{job_name=~"nightly-.*"} > 0
        for: 10m
        labels: { severity: ticket }`,
      },
    ],
    deeper: [
      'Pushed metrics never expire, which is exactly why the freshness alert works and a status alert does not: `last_exit_code == 0` stays true forever after the job stops running.',
      'Give the Pushgateway a grouping key per job instance where runs can overlap, or a second run will overwrite the first’s metrics.',
      'For a pipeline of dependent jobs, alert on the **end-to-end freshness of the output** rather than on each step. Users care that the report is current, not which of nine steps failed.',
    ],
    traps: [
      'Alerting on the last exit code. A job that never runs never reports a failure.',
      'Using the Pushgateway for long-running services. It is for batch jobs, and it introduces staleness everywhere else.',
      'Treating "succeeded" as "worked" when it processed zero records.',
    ],
    followUps: [
      'Why does alerting on the exit code miss the worst case?',
      'How does kube-state-metrics help with CronJobs?',
      'How would you monitor a chain of dependent jobs?',
    ],
    tags: ['monitoring', 'batch', 'prometheus', 'pushgateway'],
  },
]
