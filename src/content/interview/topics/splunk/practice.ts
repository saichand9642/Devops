import type { InterviewQuestion } from '../../../types'

/** Day-to-day Splunk practice: onboarding data, logging design and investigations. */
export const splunkPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-splunk-36',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Walk me through onboarding a new data source properly.',
    probing: 'A complete process question. Getting this right at the start avoids years of pain.',
    answer: [
      'The order matters, because several decisions are hard to change later.',
      '**Decide the index.** It drives access control, retention and search scoping. Sensitive data belongs in its own index from the start - separating it later is much harder than getting it right now.',
      '**Check Splunkbase for a technology add-on.** For almost any common product there is one, with parsing, field extractions and CIM mapping already done and maintained. Writing your own for a supported product is wasted effort.',
      '**Define the sourcetype and get timestamp parsing right.** `TIME_PREFIX`, `TIME_FORMAT`, `MAX_TIMESTAMP_LOOKAHEAD`, `TZ`, and line breaking with `LINE_BREAKER` and `SHOULD_LINEMERGE`. Timestamp and line-breaking errors are the two most common onboarding failures, and both produce data that looks subtly wrong rather than obviously broken.',
      '**Test with a sample before going to production.** Index a sample file into a test index, check the events break correctly, the timestamps are right, and the fields extract. Fixing this after months of data is indexed means re-indexing.',
      '**Filter the noise at the forwarder** before it counts against the licence - debug lines, health checks, whatever is high-volume and low-value.',
      '**Map to CIM** if it is a security-relevant source, so it works with existing detections and dashboards.',
      'And **document** the source, its retention, its owner, and what it is for - and add a **data-absence alert**, so a forwarder that stops is detected rather than discovered.',
    ],
    code: [
      {
        title: 'props.conf for a new sourcetype',
        language: 'text',
        code: `[my_app_json]
# Timestamp - get this right first
TIME_PREFIX = \\"timestamp\\":\\"
TIME_FORMAT = %Y-%m-%dT%H:%M:%S.%3N%z
MAX_TIMESTAMP_LOOKAHEAD = 40
TZ = UTC

# Line breaking - one JSON object per line
SHOULD_LINEMERGE = false
LINE_BREAKER = ([\\r\\n]+)

# Parsing
KV_MODE = json
TRUNCATE = 100000
category = Application
description = Internal application structured logs`,
      },
      {
        title: 'Test before committing to it',
        language: 'bash',
        code: `# Index a sample into a throwaway index and inspect the result
$SPLUNK_HOME/bin/splunk add oneshot /tmp/sample.log \\
  -index test -sourcetype my_app_json

# Then check: do events break correctly and are timestamps sane?
#   index=test sourcetype=my_app_json
#   | eval lag=_indextime-_time | table _time, lag, _raw
#   | head 20`,
      },
    ],
    traps: [
      'Going straight to production without testing the parsing.',
      'Wrong timezone, putting every event hours out.',
      '`SHOULD_LINEMERGE=true` on single-line data, which merges events unpredictably.',
      'No data-absence alert, so the source silently stops.',
    ],
    followUps: [
      'Which decision here is hardest to reverse?',
      'What are the two most common onboarding mistakes?',
    ],
    tags: ['onboarding', 'props.conf', 'timestamps', 'sourcetype', 'process'],
  },
  {
    id: 'itv-splunk-37',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What makes a log line good, from the perspective of someone who will search it?',
    probing: 'Logging design, which determines how useful the whole platform is.',
    answer: [
      'The single biggest improvement is **structured logging** - JSON or logfmt rather than free text. A structured line gives you fields automatically with no regex, survives format changes without breaking extractions, and can be aggregated and filtered directly.',
      'Beyond the format: **one event per line**, so line breaking is trivial. A **consistent timestamp** in ISO 8601 with a timezone. A **level** field so noise can be filtered. And a **correlation ID** on every line - the single most valuable field there is, because it turns cross-service investigation from guesswork into a join.',
      '**Context in fields, not prose**. "Order 12345 failed for user alice because payment declined" is hard to aggregate; `{"event":"order_failed","order_id":"12345","user":"alice","reason":"payment_declined"}` lets you count failures by reason in one command.',
      'What **not** to log: secrets, tokens, full request and response bodies, personal data beyond what is necessary. Logs are usually the least access-controlled system in the estate, and they are retained for a long time.',
      'And **log at the right level**. Debug logging in production is a large share of most licence bills and is almost never read. The discipline of "would anyone ever search for this" removes a lot of volume.',
    ],
    code: [
      {
        title: 'The same event, badly and well',
        language: 'text',
        code: `# Hard to search, hard to aggregate, breaks extractions when reworded
2026-09-16 14:23:01 ERROR Order 12345 failed for user alice because payment was declined

# Structured: every field is queryable, and rewording breaks nothing
{"timestamp":"2026-09-16T14:23:01.482Z","level":"ERROR","event":"order_failed",
 "order_id":"12345","user_id":"u_8f3c","reason":"payment_declined",
 "amount":49.99,"currency":"GBP","trace_id":"a1b2c3d4e5f6g7h8",
 "service":"checkout","duration_ms":842}`,
      },
      {
        title: 'What the structured version makes trivial',
        language: 'text',
        code: `index=app event=order_failed earliest=-24h
| stats count, sum(amount) as lost_revenue by reason
| sort -count

# And the whole request path, across every service
index=* trace_id="a1b2c3d4e5f6g7h8" | sort _time | table _time, service, event, duration_ms`,
      },
    ],
    traps: [
      'Free-text logs that require a regex for every question.',
      'Secrets or full request bodies in logs.',
      'Multi-line stack traces without correct line-breaking configuration.',
      'Debug level enabled in production, dominating the licence bill.',
    ],
    followUps: [
      'What is the single most valuable field to add to every log line?',
      'How would you reduce log volume without losing diagnostic value?',
    ],
    tags: ['logging', 'structured logging', 'design', 'trace id', 'cost'],
  },
  {
    id: 'itv-splunk-38',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `earliest=-24h@h` mean?',
    probing: 'Time modifiers, and specifically snapping, which people find confusing.',
    options: [
      { id: 'a', text: '24 hours ago, snapped back to the start of that hour' },
      { id: 'b', text: 'Exactly 24 hours ago, to the second' },
      { id: 'c', text: 'The last 24 hours of complete hours only' },
      { id: 'd', text: '24 hours after the start of the current hour' },
    ],
    correct: ['a'],
    answer: [
      'The `@` is a **snap**: it rounds the calculated time **down** to the nearest unit. `-24h@h` means "go back 24 hours, then snap to the start of that hour". At 14:37 that gives 14:00 yesterday, not 14:37 yesterday.',
      'Snapping matters for **consistency**. A search with `earliest=-24h` covers a slightly different window every time it runs, so a scheduled report produces slightly different numbers each run for reasons that have nothing to do with the data. Snapping to hour or day boundaries makes the window stable and the results comparable.',
      'It is also what makes **summary indexes** correct: `earliest=-1h@h latest=@h` covers exactly one complete hour with no overlap and no gap between consecutive runs. Without snapping you get double-counted or missed events at the boundaries.',
      'Other snaps: `@d` for start of day, `@w0` for start of the week on Sunday, `@mon` for start of the month. You can combine them - `-1d@d` is the start of yesterday.',
    ],
    code: [
      {
        title: 'Snapping in practice',
        language: 'text',
        code: `earliest=-24h        # rolling 24 hours, moves every second
earliest=-24h@h      # 24 hours back, snapped to the hour - stable
earliest=-1d@d latest=@d          # exactly yesterday
earliest=-1h@h latest=@h          # exactly the previous complete hour
earliest=@mon        # since the start of this month
earliest=-7d@d latest=@d          # the last seven complete days`,
      },
    ],
    traps: [
      'Unsnapped ranges in scheduled searches, producing inconsistent results run to run.',
      'Overlapping ranges in a summary index, double-counting events.',
      'Forgetting `latest` when snapping `earliest`, so the window still includes a partial current period.',
    ],
    followUps: ['Why does snapping matter for a summary index?'],
    tags: ['time modifiers', 'snapping', 'spl', 'fundamentals'],
  },
  {
    id: 'itv-splunk-39',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'You are asked to investigate a suspected data breach using Splunk. How do you approach it?',
    probing:
      'Investigation methodology under pressure, including the process discipline around evidence.',
    answer: [
      'Before searching, two things: **preserve evidence** and **confirm scope of authority**. Make sure retention will not expire the relevant data mid-investigation, and be clear who has authorised this and who should receive the findings - a breach investigation has legal and regulatory dimensions and the process matters as much as the technical work.',
      'Then establish a **timeline**, which is the backbone of any investigation. Start from whatever triggered the suspicion - an alert, a report, an anomaly - and establish a window. Then expand outwards; the initial indicator is usually not the earliest event.',
      'Then **identify the entities involved** - user accounts, source addresses, hosts, service accounts - and pivot. For each, establish what it did across every data source: authentication, file access, network connections, database queries, cloud API calls. The CIM data models make this tractable if the data is normalised.',
      'Then look for the **standard patterns**: initial access (an unusual login, a phishing click, an exposed service), persistence (a new account, a modified scheduled task, a new SSH key), privilege escalation, lateral movement (authentication from a host to hosts it never normally touches), and exfiltration (large outbound transfers, unusual destinations, access to data the account never normally reads).',
      "For **exfiltration specifically**, the useful signals are volume anomalies compared with that entity's own baseline rather than an absolute threshold, unusual destinations, and access patterns that differ from normal for that account.",
      'Throughout, **document as you go** - the searches run, what they returned, the timeline as it develops. Reconstructing an investigation afterwards from memory is unreliable and, in a regulated context, inadequate.',
      'And be honest about what the data **cannot** tell you. If a source was not logged, or retention had already expired, say so explicitly rather than inferring.',
    ],
    code: [
      {
        title: 'Timeline for one entity across every source',
        language: 'text',
        code: `index=* (user="suspect_account" OR src_ip="203.0.113.45") earliest=-30d
| eval source_type=coalesce(sourcetype, "unknown")
| table _time, index, source_type, host, user, src, dest, action, signature
| sort _time`,
      },
      {
        title: 'Exfiltration signals: volume against the entity’s own baseline',
        language: 'text',
        code: `# Outbound volume per user, compared with their own 30-day normal
index=proxy earliest=-30d
| bin _time span=1d
| stats sum(bytes_out) as daily_bytes by user, _time
| eventstats avg(daily_bytes) as mean, stdev(daily_bytes) as sd by user
| eval z=round((daily_bytes-mean)/sd, 2)
| where z > 3 AND daily_bytes > 1073741824
| table _time, user, daily_bytes, mean, z
| sort -z

# Lateral movement: hosts this account has never authenticated to before
index=auth action=success earliest=-24h
| stats values(dest) as today_hosts by user
| join user [
    search index=auth action=success earliest=-30d latest=-24h
    | stats values(dest) as normal_hosts by user
  ]
| eval new_hosts=mvfilter(NOT match(today_hosts, normal_hosts))
| where mvcount(new_hosts) > 3`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Investigation sequence',
        caption: 'Preserve evidence first - retention expiring mid-investigation cannot be undone.',
        nodes: [
          {
            label: 'Preserve evidence, confirm authority',
            detail: 'Before any searching',
            tone: 'danger',
          },
          { label: 'Establish the initial indicator and window', tone: 'accent' },
          { label: 'Identify entities: accounts, IPs, hosts' },
          { label: 'Build a timeline across every source', detail: 'CIM makes this tractable' },
          {
            label: 'Look for the standard patterns',
            detail: 'Access, persistence, lateral, exfiltration',
            tone: 'warning',
          },
          { label: 'Document throughout, state the gaps', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'The initial indicator is rarely the earliest event. Expanding the window backwards from it is usually where the actual entry point is found.',
      'Baseline comparison per entity is far more useful than absolute thresholds - what is anomalous for one account is normal for another.',
      'Note explicitly which sources were not logged or had expired. Gaps in coverage are findings in themselves and drive the improvements afterwards.',
      "Splunk Enterprise Security's investigation workbench exists for exactly this and keeps the timeline and notes together.",
    ],
    traps: [
      'Searching before confirming retention will hold the data.',
      'Anchoring on the initial indicator and not looking earlier.',
      'Inferring conclusions from absent data rather than stating the gap.',
      'No contemporaneous documentation.',
    ],
    followUps: [
      'The relevant data has already aged out. What do you do?',
      'How would you find lateral movement?',
    ],
    tags: ['scenario', 'security', 'investigation', 'forensics', 'advanced'],
  },
  {
    id: 'itv-splunk-40',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is `eventstats` and how does it differ from `stats`?',
    probing: 'A command that solves a specific class of problem elegantly.',
    answer: [
      '**`stats`** is transforming: it replaces the events with the aggregate result. After `stats count by host` you have one row per host and the original events are gone.',
      "**`eventstats`** computes the same aggregates but **adds them as fields to every original event**, keeping all the events. So after `eventstats avg(duration) as avg_duration by service`, every event still exists and now also carries its service's average.",
      "That is exactly what you need for **comparison against an aggregate** - finding events that are slower than their service's average, or transfers larger than that user's normal. With `stats` you would lose the events you wanted to identify; with `eventstats` you can filter them afterwards.",
      'The related command is **`streamstats`**, which computes a **running** aggregate in order - a cumulative total, or a moving average over the previous N events. That is what you use for detecting change over time within a stream.',
      'The cost of `eventstats` is that it holds the events in memory to annotate them, so on a very large result set it is expensive. Narrowing the search first matters more here than usual.',
    ],
    code: [
      {
        title: 'eventstats for comparison against a group aggregate',
        language: 'text',
        code: `# Requests significantly slower than normal FOR THEIR OWN endpoint
index=web earliest=-1h
| eventstats avg(duration) as avg_duration, stdev(duration) as sd by uri_path
| eval z=round((duration-avg_duration)/sd, 2)
| where z > 3
| table _time, uri_path, duration, avg_duration, z
| sort -z`,
      },
      {
        title: 'streamstats for a running calculation',
        language: 'text',
        code: `# Moving average over the previous 10 events, per host
index=metrics earliest=-2h
| sort _time
| streamstats window=10 avg(cpu_percent) as moving_avg by host
| eval spike=if(cpu_percent > moving_avg * 2, 1, 0)
| where spike=1`,
      },
    ],
    traps: [
      '`eventstats` over a very large result set, holding everything in memory.',
      'Using `stats` and then being unable to identify the individual events.',
      '`streamstats` without sorting first, giving a running calculation in arbitrary order.',
    ],
    followUps: [
      'When would `streamstats` be the right choice?',
      'Why is `eventstats` more expensive than `stats`?',
    ],
    tags: ['eventstats', 'streamstats', 'spl', 'anomaly detection'],
  },
  {
    id: 'itv-splunk-41',
    level: 'basic',
    kind: 'open',
    prompt: 'How would you find the cause of a spike in errors using Splunk?',
    probing: 'Everyday investigation, described as a method.',
    answer: [
      '**Confirm and bound the spike** first: chart the error count over time to see exactly when it started and whether it is ongoing. The start time is the single most useful fact, because it is what you correlate everything else against.',
      '**Break it down** along every dimension you have - by host, by service, by endpoint, by status code, by error message. One of them almost always concentrates: all on one host, all on one endpoint, all one specific error. That narrows the investigation enormously in one search.',
      '**Look at what changed at that time.** A deployment, a configuration change, a dependency, a traffic increase. If deployment events are in Splunk, overlaying them on the error chart answers this immediately; if not, that is worth adding.',
      '**Read the actual errors**, not just the count. The message usually says what is wrong - a connection refused, a timeout, a specific exception - and that points at the layer to look in next.',
      "**Follow it upstream**: if the errors are timeouts against a dependency, search that dependency's logs for the same window.",
      'The dimension to check that people forget is **whether it is genuinely more errors or just more traffic**. An error *count* rising with a flat error *rate* means the service is behaving normally under more load, which is a completely different problem.',
    ],
    code: [
      {
        title: 'Bound it, break it down, read it',
        language: 'text',
        code: `# 1. When did it start, and is the RATE up or just the count?
index=app level=ERROR earliest=-6h
| timechart span=5m count as errors
| join _time [ search index=app earliest=-6h | timechart span=5m count as total ]
| eval error_rate=round(errors/total*100, 2)

# 2. What concentrates?
index=app level=ERROR earliest=-2h
| stats count by host, service, error_code
| sort -count | head 20

# 3. What do the errors actually say?
index=app level=ERROR earliest=-2h
| stats count, values(host) as hosts, earliest(_time) as first by message
| sort -count | head 10
| convert ctime(first)

# 4. Was there a deployment?
index=deploy earliest=-6h | table _time, service, version, deployed_by`,
      },
    ],
    traps: [
      'Reacting to a rising error count without checking whether the rate changed.',
      'Aggregating so broadly that the concentration is hidden.',
      'Not checking for a deployment, and spending an hour on something a rollback resolves.',
      'Reading the count and never the message.',
    ],
    followUps: [
      'Errors are up but the error rate is flat. What does that mean?',
      'What would you add to make this faster next time?',
    ],
    tags: ['investigation', 'troubleshooting', 'spl', 'fundamentals'],
  },
  {
    id: 'itv-splunk-42',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you detect anomalies in Splunk without generating constant false positives?',
    probing: 'Statistical detection, and the practical problem that makes most of it useless.',
    answer: [
      'The naive approach - a fixed threshold - fails because normal varies. What is a normal request rate at 2pm on a Tuesday is a serious anomaly at 3am on a Sunday, and a threshold tuned for one is wrong for the other.',
      "The first improvement is **comparison against the entity's own baseline** rather than a global threshold. `eventstats` or `streamstats` to compute a mean and standard deviation per host, per user, per endpoint, and then flag deviations in standard deviations rather than absolute values. That handles the fact that different entities have genuinely different normals.",
      'The second is **accounting for seasonality**. Traffic has daily and weekly cycles, so comparing now against the same hour on previous days is far more meaningful than comparing against the last hour. `timewrap` makes this straightforward.',
      'Splunk also ships **`anomalydetection`** and, in the Machine Learning Toolkit, density-function and forecasting models. These are genuinely useful and are not magic - they need training on a period that is actually representative, and they need retraining as the system changes.',
      'The practical thing that determines success is **requiring corroboration**. A single statistical anomaly is noise; several correlated ones are a signal. Risk-based alerting - accumulating a score per entity across multiple weak signals and alerting on the total - reduces volume dramatically while catching more. One unusual login is not worth waking someone; an unusual login plus a privilege change plus a large transfer from the same account is.',
      'And **every detection needs an owner and a review cycle**, because the definition of normal drifts and a detection that is not tuned becomes noise within months.',
    ],
    code: [
      {
        title: 'Baseline per entity, with seasonality',
        language: 'text',
        code: `# Compare this hour against the same hour on the previous 7 days
index=web earliest=-8d
| timechart span=1h count by service
| timewrap 1d series=short
| eval baseline=(s1+s2+s3+s4+s5+s6+s7)/7
| eval deviation=round((s0-baseline)/baseline*100, 1)
| where abs(deviation) > 50`,
      },
      {
        title: 'Risk accumulation rather than alerting on each signal',
        language: 'text',
        code: `# Each weak signal contributes a score; alert on the total per entity
index=risk earliest=-24h
| stats sum(risk_score) as total_risk,
        values(risk_rule) as rules,
        dc(risk_rule) as distinct_rules by risk_object
| where total_risk > 100 AND distinct_rules >= 3
| sort -total_risk`,
        explanation:
          'Requiring several distinct rules is what separates a real signal from one noisy detection firing repeatedly.',
      },
    ],
    deeper: [
      'Standard deviation assumes a roughly normal distribution, which log data often is not. Percentile-based thresholds are frequently more robust.',
      'Seasonality matters more than most people expect - weekday versus weekend is often a bigger difference than the anomaly you are looking for.',
      'Machine learning models need retraining. A model trained before a major architecture change describes a system that no longer exists.',
      'Track the false positive rate per detection as a metric. A detection nobody has ever acted on should be removed.',
    ],
    traps: [
      'Fixed thresholds on metrics with daily and weekly cycles.',
      'Alerting on every individual statistical anomaly.',
      'Models trained on a period that included an incident, so the incident looks normal.',
      'Detections with no owner and no review, drifting into noise.',
    ],
    followUps: [
      'Why is a single statistical anomaly usually not worth alerting on?',
      'How would you handle seasonality?',
    ],
    tags: ['anomaly detection', 'baselines', 'risk-based alerting', 'mltk', 'advanced'],
  },
  {
    id: 'itv-splunk-43',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'Why is `| search foo` after a transforming command different from putting `foo` in the base search?',
    probing: 'Where filtering happens, which is the main performance lever in SPL.',
    options: [
      {
        id: 'a',
        text: 'The base search filters at the indexers before data is returned; a later `search` filters results already retrieved and processed',
      },
      { id: 'b', text: 'They are identical; SPL optimises the order automatically' },
      { id: 'c', text: '`| search` is faster because it runs on the search head' },
      { id: 'd', text: '`| search` can only filter on indexed fields' },
    ],
    correct: ['a'],
    answer: [
      'The **base search** - everything before the first pipe - is distributed to the **indexers** and filters the data there, so only matching events are returned to the search head. That is where the data volume is reduced.',
      'A `| search` later in the pipeline runs on data that has **already been read, transferred and processed**. The work has already been done; you are just discarding the result. On a large dataset that is the difference between a search that returns in seconds and one that takes minutes.',
      'The principle generalises: **push filtering as far left as possible**. Put selective terms in the base search, not in a later `where` or `search`. And after a **transforming** command like `stats`, a `| search` filters the aggregate rows rather than events - which is sometimes exactly what you want, but it is a different operation.',
      'The Job Inspector makes this visible: it shows events **scanned** versus events **matched**. A large gap between them means you are reading far more than you need.',
    ],
    code: [
      {
        title: 'The same result, very different cost',
        language: 'text',
        code: `# SLOW - reads every event in the index, then discards most of them
index=web earliest=-24h
| search status=500 host=web-01

# FAST - the indexers only return matching events
index=web status=500 host=web-01 earliest=-24h

# Legitimate use: filtering the AGGREGATE after a transforming command
index=web earliest=-24h
| stats count by uri_path
| search count > 1000`,
      },
    ],
    traps: [
      'Building searches incrementally and leaving the filters where they were added rather than moving them left.',
      'Assuming SPL reorders for you. It does not.',
      'Not checking scanned versus matched in the Job Inspector.',
    ],
    followUps: ['What does the Job Inspector tell you about this?'],
    tags: ['performance', 'spl', 'search optimisation', 'fundamentals'],
  },
  {
    id: 'itv-splunk-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you monitor application performance with Splunk?',
    probing: 'APM-style use of a log platform, and where its limits are.',
    answer: [
      'If the application logs **duration per request** along with an endpoint and a status, you can compute the whole RED picture from logs: request rate, error rate and duration percentiles, broken down by endpoint and by host.',
      'The percentile point matters: report **p95 and p99**, not averages. An average of 200 ms is compatible with a p99 of eight seconds, and the users complaining are in the tail. `perc95()` and `perc99()` in `stats` give you this directly.',
      "**Comparison against a baseline** is what makes it actionable - this endpoint's p99 today against the same hour last week, rather than an absolute threshold that is wrong for half the endpoints.",
      'Splunk also has dedicated tooling - **Observability Cloud** for metrics and tracing, and **AppDynamics** - which do this better than logs can, because they capture per-span timing across service boundaries rather than per-request duration within one service.',
      'The honest limitation: logs tell you **that** a request was slow and **which** endpoint; they do not tell you **where the time went** inside a distributed call chain. For that you need tracing. Logs are an excellent starting point and a poor substitute for a tracing system if latency attribution across services is the recurring question.',
    ],
    code: [
      {
        title: 'RED from logs, with percentiles',
        language: 'text',
        code: `index=app sourcetype=json earliest=-24h
| stats count as requests,
        count(eval(status>=500)) as errors,
        avg(duration_ms) as avg_ms,
        perc50(duration_ms) as p50,
        perc95(duration_ms) as p95,
        perc99(duration_ms) as p99
  by endpoint
| eval error_rate=round(errors/requests*100, 2)
| sort -p99
| table endpoint, requests, error_rate, p50, p95, p99`,
      },
      {
        title: 'Today against the same period last week',
        language: 'text',
        code: `index=app earliest=-8d
| timechart span=1h perc99(duration_ms) as p99 by endpoint
| timewrap 7d series=short
| eval change_pct=round((s0-s1)/s1*100, 1)
| where abs(change_pct) > 30`,
      },
    ],
    traps: [
      'Reporting averages, which hide the tail entirely.',
      'Absolute latency thresholds applied across endpoints with very different normal behaviour.',
      'Expecting logs to attribute latency across service boundaries - that needs tracing.',
      'Logging duration only on errors, so you cannot see gradual degradation.',
    ],
    followUps: ['Why p99 rather than average?', 'What can tracing tell you that logs cannot?'],
    tags: ['apm', 'performance', 'percentiles', 'red method', 'observability'],
  },
  {
    id: 'itv-splunk-45',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you approach a Splunk deployment that has grown unmanageable?',
    probing: 'Remediating an inherited mess - a realistic senior scenario.',
    answer: [
      'The symptoms are usually the same: thousands of saved searches nobody owns, dashboards that time out, a licence constantly at its limit, and no confidence that what is indexed is what is needed.',
      'I would start by **measuring rather than changing**. Licence usage by sourcetype and host - which data is the volume. Search audit logs - which searches actually run and which saved searches have never been opened. Scheduler logs - what is being skipped. `index=_audit` for which indexes anyone actually queries. That gives you a factual picture rather than opinions.',
      'The findings are usually consistent: a small number of sources dominate the volume; a large proportion of saved searches and dashboards have not been opened in months; a handful of searches consume most of the platform; and one or two indexes are ingested and never queried.',
      'Then **act in order of value and safety**. Reduce ingest on the highest-volume low-value sources - almost always the biggest single win, and reversible. Fix or accelerate the worst-performing searches. Spread scheduled search times. Then **retire** unused saved searches and dashboards, which needs communication rather than deletion by surprise.',
      'Then **establish ownership**, which is the thing that actually prevents recurrence. Every index, every scheduled search and every dashboard needs a named owner and a review date. A deployment where nobody owns anything degrades regardless of how thoroughly you clean it up.',
      'And **put controls in place**: a process for onboarding new data, search quotas per role, and monitoring of licence usage, search concurrency and skipped searches with alerts before they become problems.',
      'The honest note: this is mostly organisational work rather than technical. The searches to run are straightforward; getting agreement on what to turn off is the hard part.',
    ],
    code: [
      {
        title: 'The audit searches to start with',
        language: 'text',
        code: `# What is consuming the licence?
index=_internal source=*license_usage.log type=Usage earliest=-30d
| stats sum(b) as bytes by st | eval GB=round(bytes/1024/1024/1024,1) | sort -GB

# Saved searches that have never actually run or been opened
| rest /services/saved/searches
| table title, eai:acl.app, eai:acl.owner, cron_schedule, is_scheduled, disabled

# Which indexes does anyone actually search?
index=_audit action=search earliest=-30d
| rex field=search "index\\s*=\\s*\\"?(?<idx>[\\w_*-]+)"
| stats dc(user) as users, count as searches by idx | sort searches

# The most expensive searches on the platform
index=_audit action=search info=completed earliest=-7d
| stats sum(total_run_time) as total_s, count as runs, avg(total_run_time) as avg_s
  by savedsearch_name
| sort -total_s | head 20`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Remediation order',
        caption:
          'Measure first; the reversible, high-value changes come before anything anyone will argue about.',
        nodes: [
          {
            label: 'Measure: licence, searches, usage',
            detail: 'Facts, not opinions',
            tone: 'accent',
          },
          {
            label: 'Reduce high-volume low-value ingest',
            detail: 'Biggest win, reversible',
            tone: 'success',
          },
          { label: 'Fix or accelerate the worst searches', detail: 'A few dominate' },
          { label: 'Spread schedules', detail: 'Removes synchronised spikes' },
          {
            label: 'Retire unused content',
            detail: 'Communicate before deleting',
            tone: 'warning',
          },
          {
            label: 'Assign ownership and add controls',
            detail: 'The part that prevents recurrence',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'Disable before deleting, with a stated period before removal. It surfaces the one person who did depend on something without causing an incident.',
      'Search quotas per role prevent one user consuming the platform, and are much easier to introduce than to retrofit after an incident.',
      'A data onboarding process with a named owner and a retention decision stops the backlog regrowing.',
    ],
    traps: [
      'Deleting content without warning, breaking something someone depended on.',
      'Cleaning up without establishing ownership, so it degrades again within a year.',
      'Starting with the technically interesting work rather than the highest-volume ingest.',
    ],
    followUps: [
      'How would you retire a dashboard nobody claims to own?',
      'What stops this happening again?',
    ],
    tags: ['remediation', 'governance', 'cost', 'ownership', 'advanced'],
  },
  {
    id: 'itv-splunk-46',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the Splunk search pipeline, and why does the order of commands matter?',
    probing: 'The mental model that explains every performance answer.',
    answer: [
      'A search is a **pipeline**: each command receives the output of the previous one, transforms it, and passes it on. The `|` is exactly the Unix pipe idea.',
      'That is why order matters so much. Each stage operates on **whatever survived the previous stage**, so filtering early means every subsequent command has less to do. A `where` at the end of a long pipeline discards data that every preceding command has already processed.',
      'The commands fall into groups worth distinguishing. **Streaming** commands (`eval`, `rex`, `fields`, `where`) process events one at a time and can run **on the indexers**, in parallel. **Transforming** commands (`stats`, `chart`, `timechart`, `top`) aggregate and produce a table, and generally run on the **search head** after the indexers have returned their partial results. **Centralised streaming** commands need the full ordered result and force work onto the search head.',
      'The practical consequence: **keep as much work as possible in the streaming, indexer-side part** of the pipeline. Anything after the first transforming command runs on a single search head against the already-retrieved data, so filtering there is much less effective than filtering in the base search.',
      'The Job Inspector shows this split - how much work happened on the indexers versus the search head - which is the fastest way to understand why a search is slow.',
    ],
    code: [
      {
        title: 'Same answer, different amount of work',
        language: 'text',
        code: `# Most work on the search head, after everything has been retrieved
index=web earliest=-24h
| stats count by uri_path, status, host
| search host="web-01" status=500

# Most work on the indexers, in parallel, before anything is transferred
index=web host="web-01" status=500 earliest=-24h
| fields uri_path
| stats count by uri_path`,
      },
    ],
    traps: [
      'Filtering after a transforming command when it could have been in the base search.',
      'Not using `fields` early, so every command carries fields you never use.',
      'Assuming Splunk reorders the pipeline for you.',
    ],
    followUps: [
      'Which commands can run on the indexers?',
      'Why does work after a transforming command run on the search head?',
    ],
    tags: ['pipeline', 'spl', 'performance', 'architecture', 'fundamentals'],
  },
  {
    id: 'itv-splunk-47',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle multi-line events like stack traces?',
    probing: 'A specific and very common ingestion problem.',
    answer: [
      'By default Splunk tries to break events at line boundaries, which turns a twenty-line stack trace into twenty separate events - each useless on its own, and the actual exception separated from the context that explains it.',
      'The fix is **line breaking configuration** in `props.conf` on the indexer or heavy forwarder. The reliable approach is `SHOULD_LINEMERGE = false` with an explicit **`LINE_BREAKER`** regular expression that matches the boundary **between** events - typically the start of a new timestamped line. This is both faster and more predictable than the merging approach.',
      'The older mechanism is `SHOULD_LINEMERGE = true` with `BREAK_ONLY_BEFORE`, which merges lines until it sees a pattern. It works but is slower and harder to reason about; `LINE_BREAKER` is preferred.',
      '`TRUNCATE` matters too - the default caps event size, and a very long stack trace can be silently cut off. Raising it for sourcetypes that legitimately produce large events prevents losing the end of the trace, which is often the interesting part.',
      'The better answer, where you control the application, is to **log the stack trace as a field in a structured event** rather than as raw multi-line text. One JSON object with an `exception` field containing the trace avoids the entire problem, and makes the trace searchable as a field.',
    ],
    code: [
      {
        title: 'Line breaking for a Java stack trace',
        language: 'text',
        code: `[java_app]
SHOULD_LINEMERGE = false
# Break BEFORE a line starting with a timestamp - the captured group is the break
LINE_BREAKER = ([\\r\\n]+)(?=\\d{4}-\\d{2}-\\d{2}\\s\\d{2}:\\d{2}:\\d{2})
TIME_PREFIX = ^
TIME_FORMAT = %Y-%m-%d %H:%M:%S,%3N
MAX_TIMESTAMP_LOOKAHEAD = 25
TRUNCATE = 50000
TZ = UTC`,
      },
      {
        title: 'Better: structured, so there is no multi-line problem at all',
        language: 'text',
        code: `{"timestamp":"2026-09-16T14:23:01.482Z","level":"ERROR",
 "message":"Payment processing failed","trace_id":"a1b2c3d4",
 "exception":"java.lang.NullPointerException\\n\\tat com.example.Payment.process(Payment.java:42)\\n\\tat ...",
 "service":"checkout"}`,
      },
    ],
    traps: [
      'Default line breaking on stack traces, producing one event per line.',
      '`TRUNCATE` at the default, silently cutting off long traces.',
      'A `LINE_BREAKER` regex that matches inside the stack trace, splitting it at the wrong point.',
      'Fixing this after months of data is indexed - it requires re-indexing.',
    ],
    followUps: [
      'Why is `LINE_BREAKER` preferred over `BREAK_ONLY_BEFORE`?',
      'What is the better fix if you control the application?',
    ],
    tags: ['line breaking', 'multi-line', 'props.conf', 'ingestion'],
  },
  {
    id: 'itv-splunk-48',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these are legitimate reasons a search returns no results? Select all that apply.',
    probing: 'Systematic debugging of the most common frustration in Splunk.',
    options: [
      {
        id: 'a',
        text: 'The time range does not cover when the events were timestamped, even though they arrived recently',
      },
      { id: 'b', text: 'The user’s role does not include that index in `srchIndexesAllowed`' },
      { id: 'c', text: 'The field name or value is case-sensitive and does not match' },
      { id: 'd', text: 'A `nullQueue` transform is dropping the events before indexing' },
      { id: 'e', text: 'Splunk automatically hides results older than 30 days' },
    ],
    correct: ['a', 'b', 'c', 'd'],
    answer: [
      'There is no automatic 30-day hiding - retention is entirely configured per index, and data is available until it is frozen.',
      'The others are all real and worth checking in roughly this order. **Time range** is the most common: events backfilled by a forwarder that was down have an old `_time`, so a "last hour" search misses them entirely. Searching by `_indextime` finds them.',
      '**Permissions** produce no error, just no results, which is genuinely confusing - a user without the index in their role sees an empty result set rather than "access denied". `| rest /services/authentication/current-context` shows what the current user can actually search.',
      "**Case sensitivity** trips people constantly: **field values are case-sensitive**, field *names* are too, but the `search` command's keyword matching is not. So `status=OK` and `status=ok` are different, while a bare keyword search is not.",
      '**`nullQueue`** means the events never reached the index at all. If a forwarder is sending and the index is empty, checking props and transforms with `btool` is the step people forget.',
    ],
    code: [
      {
        title: 'Working through it',
        language: 'text',
        code: `# 1. Is anything there at all, at any time?
| tstats count where index=web by sourcetype, host

# 2. Did it arrive recently but with an old timestamp?
index=web earliest=-30d | where _indextime > relative_time(now(), "-1h") | head 10

# 3. What can this user actually search?
| rest /services/authentication/current-context
| table username, roles, srchIndexesAllowed

# 4. Case - these are different
index=web status=OK
index=web status=ok`,
      },
    ],
    traps: [
      'Assuming no results means no data, when it is permissions.',
      'Case mismatch in a field value.',
      'Not checking whether a transform is dropping the events before indexing.',
    ],
    followUps: ['Why do permissions produce empty results rather than an error?'],
    tags: ['troubleshooting', 'permissions', 'case sensitivity', 'debugging'],
  },
  {
    id: 'itv-splunk-49',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the HTTP Event Collector and when would you use it?',
    probing: 'Modern ingestion for applications and containers.',
    answer: [
      '**HEC** is an HTTP endpoint on the indexer or heavy forwarder that accepts events over JSON, authenticated with a **token**. An application, a container or a serverless function POSTs its events directly - no forwarder on the host, no file to monitor.',
      'It is the right choice when there is **no filesystem to read from or no host to install on**: containers where writing to a file and running an agent is awkward, serverless functions with no persistent host, and applications that would rather emit events than write logs.',
      'The token is what controls it: each token can pin the **index, sourcetype and source**, so the sender cannot write wherever it likes. Tokens can be revoked individually, which makes them manageable per application.',
      'The practical considerations: HEC over **HTTPS** with proper certificates, because a token in a request is a credential. A **load balancer** in front for availability, since a single indexer endpoint is a single point of failure. And the sending application needs **buffering and retry**, because if the endpoint is unavailable the events are simply lost - there is no file sitting on disk waiting to be read, which is the safety net a forwarder gives you.',
      'That last point is the main trade-off against a forwarder: a forwarder reading a file will catch up after an outage; a direct HEC sender without its own buffer will not.',
    ],
    code: [
      {
        title: 'Sending to HEC',
        language: 'bash',
        code: `curl -sS https://splunk.example.com:8088/services/collector/event \\
  -H "Authorization: Splunk 8f3c1e2a-4b5d-6e7f-8a9b-0c1d2e3f4a5b" \\
  -d '{
        "time": 1789545600,
        "host": "app-01",
        "source": "checkout-service",
        "sourcetype": "my_app_json",
        "index": "app",
        "event": {
          "level": "ERROR",
          "message": "payment declined",
          "order_id": "12345",
          "trace_id": "a1b2c3d4"
        }
      }'`,
      },
    ],
    traps: [
      'HEC over plain HTTP, exposing the token.',
      'No buffering in the sender, so events are lost when the endpoint is unavailable.',
      'One token shared by every application, so it cannot be revoked without affecting all of them.',
      'A single indexer endpoint with no load balancer.',
    ],
    followUps: [
      'What does a forwarder give you that HEC does not?',
      'How would you make HEC highly available?',
    ],
    tags: ['hec', 'ingestion', 'containers', 'tokens'],
  },
  {
    id: 'itv-splunk-50',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How would you explain the value of a log platform to someone who thinks logs are just files?',
    probing:
      'Communication. Being able to justify the investment is a genuinely useful senior skill.',
    answer: [
      'I would frame it around what changes rather than what the tool does.',
      'With logs as files, answering a question means **knowing which machine to look on**. In an environment with fifty servers and autoscaling, the machine that served the failing request may no longer exist. Centralising means the data outlives the machine, which is the precondition for everything else.',
      '**Correlation** is the second thing. A single user request touches five services; with files you would have to find and correlate five logs on five hosts by timestamp, by hand. With a platform and a correlation ID, it is one search.',
      '**Time** is the practical argument. An investigation that takes an afternoon of SSH and grep takes two minutes. Multiply that by the number of incidents and the number of engineers, and the cost comparison is usually straightforward.',
      '**Detection** is the thing files cannot do at all. You cannot alert on a pattern across a fleet by grepping files; a platform can notice a brute-force attempt spanning twenty hosts, or a gradual error rate increase, and tell you before a customer does.',
      'And **retention and audit**: logs on a host disappear with the host and with rotation. Many regulatory requirements simply cannot be met with files.',
      'The honest counterpoint I would also give: it is **not free**. There is licence or infrastructure cost, and the discipline of structured logging and sensible volume. The value comes from using it well - poorly structured logs centralised expensively are just expensive grep.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What centralisation actually changes',
        caption: 'The last two are the ones files cannot do at all, at any level of effort.',
        nodes: [
          {
            label: 'Data outlives the machine',
            detail: 'Essential once instances are ephemeral',
            tone: 'accent',
          },
          {
            label: 'Correlate across services',
            detail: 'One search rather than five SSH sessions',
          },
          { label: 'Minutes instead of an afternoon', detail: 'The practical cost argument' },
          {
            label: 'Alert on patterns across a fleet',
            detail: 'Impossible with files',
            tone: 'success',
          },
          {
            label: 'Retention and audit',
            detail: 'Often a compliance requirement',
            tone: 'success',
          },
        ],
      },
    ],
    traps: [
      'Arguing on features rather than on what becomes possible.',
      'Not acknowledging the cost, which makes the case sound naive.',
      'Ignoring that badly structured logs centralised are still badly structured.',
    ],
    followUps: [
      'What is the strongest single argument?',
      'What would you say to someone who thinks it is too expensive?',
    ],
    tags: ['communication', 'value', 'centralisation', 'fundamentals'],
  },
]
