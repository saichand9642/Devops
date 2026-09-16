import type { InterviewQuestion } from '../../../types'

/** Architecture, data ingestion, indexing and the SPL basics. */
export const splunkFundamentalQuestions: InterviewQuestion[] = [
  {
    id: 'itv-splunk-7',
    level: 'basic',
    kind: 'open',
    prompt: 'Explain the main Splunk components and what each one does.',
    probing: 'Architecture. Every Splunk round starts somewhere near here.',
    answer: [
      'There are four roles that matter. A **forwarder** runs on the machine producing data and sends it onward - the **universal forwarder** is a lightweight agent that just ships, while a **heavy forwarder** can parse and filter before sending.',
      'The **indexer** receives data, parses it into events, extracts the default fields, compresses it and writes it to disk in buckets. It also runs the searches against its own data.',
      'The **search head** is what users interact with. It parses a search, distributes it to the indexers, collects and merges their results, and renders dashboards and alerts. It stores no event data itself.',
      'The **deployment server** (and in larger installations a **cluster master** and **deployer**) manages configuration - pushing app and input configuration out to forwarders and indexers so they are not configured individually.',
      'The shape to remember is that **indexers do the heavy work**: they hold the data and execute the search on it. The search head coordinates. That is why scaling search performance usually means adding indexers rather than search heads.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Data path from source to search',
        caption:
          'Indexers both store and search - which is why they are what you scale for performance.',
        nodes: [
          { label: 'Source: logs, metrics, events', tone: 'accent' },
          { label: 'Universal forwarder', detail: 'Lightweight agent on the host' },
          { label: 'Indexer', detail: 'Parses, indexes, stores, and searches' },
          { label: 'Search head', detail: 'Distributes the search, merges results' },
          { label: 'User: dashboards, alerts, reports', tone: 'success' },
        ],
      },
    ],
    traps: [
      'Thinking the search head holds data. It does not - it coordinates.',
      'Adding search heads to fix slow searches when the indexers are the bottleneck.',
      'Running a heavy forwarder where a universal forwarder would do, for no benefit and more resource use.',
    ],
    followUps: [
      'Searches are slow. Would you add search heads or indexers?',
      'When would you need a heavy forwarder?',
    ],
    tags: ['architecture', 'forwarders', 'indexers', 'search heads', 'fundamentals'],
  },
  {
    id: 'itv-splunk-8',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What are index, source, sourcetype and host in Splunk?',
    probing: 'The four default fields, which every search relies on.',
    options: [
      {
        id: 'a',
        text: 'The default metadata on every event: where it is stored, the file or input it came from, its format, and the machine that produced it',
      },
      { id: 'b', text: 'Four different types of Splunk server' },
      { id: 'c', text: 'Configuration files in $SPLUNK_HOME' },
      { id: 'd', text: 'Search commands for filtering results' },
    ],
    correct: ['a'],
    answer: [
      '**index** is where the data is stored - a logical and physical partition. It is the primary lever for access control, retention and search performance, because a search restricted to one index reads far less data.',
      '**source** is the specific input the event came from: a file path, a network port, a script.',
      '**sourcetype** is the **format** - `access_combined`, `syslog`, `json`. It drives how Splunk parses the event and which field extractions apply, which makes it the most consequential of the four to get right.',
      '**host** is the machine that produced it.',
      'The practical point is that these are **indexed fields**, so filtering on them at the start of a search is dramatically faster than filtering on extracted fields later. `index=web sourcetype=access_combined` narrows the data before anything else runs; a `search` on an extracted field has to read everything first.',
    ],
    code: [
      {
        title: 'Filter on metadata first',
        language: 'text',
        code: `# Fast - narrows on indexed fields before doing any work
index=web sourcetype=access_combined host=web-01 status=500 earliest=-1h

# Slow - reads every index, then filters
status=500

# What is actually in an index?
| metadata type=sourcetypes index=web
| tstats count where index=web by sourcetype, host`,
      },
    ],
    traps: [
      'Searching without specifying an index, which reads everything you have access to.',
      'An incorrect sourcetype, so field extractions do not apply and the data looks unparsed.',
      'Too many indexes with unclear boundaries, making access control and search scoping harder.',
    ],
    followUps: ['Why is `index=` the most important part of a search?'],
    tags: ['metadata', 'sourcetype', 'index', 'fundamentals'],
  },
  {
    id: 'itv-splunk-9',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is the difference between search-time and index-time field extraction?',
    probing:
      'A genuinely important Splunk decision with irreversible consequences if you get it wrong.',
    answer: [
      '**Index-time** extraction happens when the data is written. The extracted fields are stored in the index alongside the event, which makes them fast to search - but the decision is **permanent for data already indexed**. Changing it requires re-indexing, which for months of data is usually impractical.',
      '**Search-time** extraction happens when a search runs. The raw event is parsed on the fly according to the current configuration. It costs CPU at search time, and it is **completely flexible**: change the extraction and every historical event is reinterpreted immediately, with no re-indexing.',
      "Splunk's own guidance, and the right default, is **search-time**. The flexibility is worth more than the performance in almost every case, and a badly designed index-time extraction is a very expensive mistake because the data is already written.",
      'Index-time extraction is justified narrowly: for a field used in almost every search against a very high-volume dataset, where the search-time cost is measurably significant, and where the definition is genuinely stable.',
      'The related concept is **accelerated data models** and **tstats**, which give you index-time-like performance for summarised data without the irreversibility - usually a better answer than index-time extraction when searches are slow.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Index-time or search-time extraction?',
        caption:
          'Index-time is irreversible for existing data - that asymmetry should drive the decision.',
        question: 'When should this field be extracted?',
        branches: [
          {
            condition: 'Almost always',
            result: 'Search-time',
            detail: 'Flexible, retroactive, no re-indexing',
            tone: 'success',
          },
          {
            condition: 'Very high volume, used in nearly every search, definition stable',
            result: 'Index-time, cautiously',
            detail: 'Cannot be changed for existing data',
            tone: 'warning',
          },
          {
            condition: 'Searches are slow',
            result: 'Accelerated data model + tstats',
            detail: 'Speed without the irreversibility',
            tone: 'accent',
          },
        ],
      },
    ],
    traps: [
      'Index-time extraction chosen for speed, then discovering the field definition was wrong.',
      'Assuming a configuration change applies retroactively - for index-time fields it does not.',
      'Index-time extraction of high-cardinality fields, which bloats the index significantly.',
    ],
    followUps: [
      'You defined an index-time field incorrectly six months ago. What are your options?',
      'What would you do instead if searches are slow?',
    ],
    tags: ['field extraction', 'index-time', 'search-time', 'performance'],
  },
  {
    id: 'itv-splunk-10',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does Splunk store data? Explain buckets and the data lifecycle.',
    probing: 'Storage model, which explains retention and search performance.',
    answer: [
      'Data is stored in **buckets** - directories containing the compressed raw events plus index files - and buckets move through stages as they age.',
      '**Hot** buckets are actively being written to, and there are a small number per index. When a hot bucket reaches a size or time limit it **rolls to warm**: closed, still on fast storage, still searchable. As warm buckets accumulate past a configured count they roll to **cold**, which is typically slower and cheaper storage, still searchable. Finally they are **frozen**, which by default **deletes** them - or archives them if you configure a `coldToFrozenDir`.',
      'The critical detail is that **frozen means deleted unless you configure otherwise**. Retention is set by `frozenTimePeriodInSecs` and `maxTotalDataSizeMB` per index, and whichever limit is hit first wins. Many teams discover the default behaviour when they go looking for data that has gone.',
      'This structure is why **time range is the most important search filter**. Buckets carry a time range, so a search restricted to the last hour opens a handful of buckets rather than all of them. A search over all time reads everything.',
      '**SmartStore** changes the picture in newer deployments: warm and cold data lives in object storage with a local cache, which decouples storage from compute and makes retention much cheaper.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Bucket lifecycle',
        caption:
          'Frozen deletes the data unless an archive path is configured. That default surprises people.',
        nodes: [
          { label: 'Hot', detail: 'Being written, fast storage', tone: 'accent' },
          { label: 'Warm', detail: 'Closed, searchable, fast storage' },
          { label: 'Cold', detail: 'Searchable, cheaper storage' },
          {
            label: 'Frozen',
            detail: 'DELETED by default - or archived if configured',
            tone: 'danger',
          },
        ],
      },
    ],
    traps: [
      'Assuming frozen means archived. It means deleted unless you set `coldToFrozenDir`.',
      'Retention driven by size rather than time without realising, so a traffic spike silently shortens how far back you can search.',
      'Searching over "All time" out of habit, which reads every bucket.',
    ],
    followUps: [
      'How would you keep a year of data affordably?',
      'Why does the time range matter so much for search performance?',
    ],
    tags: ['buckets', 'storage', 'retention', 'lifecycle', 'smartstore'],
  },
  {
    id: 'itv-splunk-11',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are the SPL commands you use most, and what do they do?',
    probing: 'Search language fluency.',
    answer: [
      'The core set: **`search`** (implicit at the start) filters events. **`where`** filters using expressions and can compare fields to each other, which `search` cannot. **`stats`** aggregates - `count`, `sum`, `avg`, `dc` for distinct count, `values`, `latest` - and is the workhorse of almost every useful search.',
      '**`eval`** creates or modifies fields with expressions. **`rex`** extracts fields with a regular expression at search time. **`fields`** keeps or removes fields, and using it early is one of the simplest performance improvements available.',
      '**`timechart`** is `stats` bucketed by time, which is what produces almost every graph. **`top`** and **`rare`** give quick frequency summaries. **`table`** and **`sort`** shape the output.',
      '**`transaction`** groups related events into one, which is powerful and expensive - `stats` with a `by` clause on a correlation ID is usually faster and should be preferred where it can express the same thing.',
      '**`lookup`** enriches events from a static table - mapping a host to an owner, an IP to a location - and **`tstats`** queries indexed metadata extremely fast, which is the key to making large searches performant.',
    ],
    code: [
      {
        title: 'The commands doing real work',
        language: 'text',
        code: `# Error rate by service over time
index=app sourcetype=json earliest=-24h
| eval is_error=if(status>=500, 1, 0)
| timechart span=5m sum(is_error) as errors, count as total
| eval error_rate=round(errors/total*100, 2)

# Slowest endpoints, with percentiles
index=web sourcetype=access_combined earliest=-1h
| stats count, avg(duration) as avg_ms, perc95(duration) as p95_ms by uri_path
| sort -p95_ms
| head 20

# Extract a field that is not already parsed
index=app "payment failed"
| rex field=_raw "order_id=(?<order_id>\\w+).*reason=(?<reason>[^,]+)"
| stats count by reason, order_id

# Enrich from a lookup table
index=web | lookup host_owners host OUTPUT team, oncall
| stats count by team`,
      },
    ],
    traps: [
      '`transaction` where `stats by` would do - it is far more expensive.',
      'Not using `fields` early, so every command carries fields you never use.',
      '`where` and `search` confused - `search` cannot compare two fields.',
    ],
    followUps: [
      'When would you use `transaction` rather than `stats`?',
      'Why does `fields` early improve performance?',
    ],
    tags: ['spl', 'search', 'stats', 'eval', 'fundamentals'],
  },
  {
    id: 'itv-splunk-12',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you make a slow Splunk search fast?',
    probing: 'Performance optimisation, which follows a fairly reliable set of principles.',
    answer: [
      'The governing principle is **filter as early and as narrowly as possible**, because everything downstream operates on whatever survived the previous stage.',
      '**Time range first.** It is the single biggest factor. A search over 24 hours instead of 30 days reads a small fraction of the buckets. "All time" should essentially never appear in a production search.',
      '**Index and metadata next.** `index=web sourcetype=access_combined host=web-*` uses indexed fields and eliminates data before anything is parsed. A search that omits the index reads every index you can see.',
      '**Then narrow further before transforming.** Put the most selective terms in the base search rather than in a later `where`, so the events never reach the expensive commands.',
      '**Use `fields` early** to discard what you do not need, which reduces the data carried through every subsequent command.',
      '**Prefer `stats` over `transaction`**, and prefer **`tstats`** over `stats` where the data allows - `tstats` queries indexed metadata and can be orders of magnitude faster.',
      'And structurally: **accelerate the data model** for searches that run constantly, or use a **summary index** or scheduled report so a dashboard reads a pre-computed result rather than recalculating over raw events every time someone opens it.',
      'The tool for diagnosis is the **Job Inspector**, which shows where the time actually went - how many events were scanned versus matched, and how long each command took.',
    ],
    code: [
      {
        title: 'The same search, slow and fast',
        language: 'text',
        code: `# SLOW - no index, no time bound, filters after the expensive work
sourcetype=access_combined
| eval is_error=if(status>=500,1,0)
| search host=web-01 uri_path="/checkout"
| stats sum(is_error) by uri_path

# FAST - narrow on indexed fields and time first, then transform
index=web sourcetype=access_combined host=web-01 uri_path="/checkout" earliest=-1h
| fields status, uri_path
| stats count(eval(status>=500)) as errors, count as total by uri_path`,
      },
      {
        title: 'tstats for large aggregations',
        language: 'text',
        code: `# Orders of magnitude faster - reads indexed metadata, not raw events
| tstats count where index=web earliest=-24h by _time span=1h, sourcetype

# Against an accelerated data model
| tstats summariesonly=true count from datamodel=Web.Web
  where Web.status>=500 by Web.uri_path, _time span=5m`,
      },
    ],
    traps: [
      '"All time" searches on a dashboard everyone opens.',
      'Filtering with `| search` after a transforming command rather than in the base search.',
      '`transaction` on a large dataset.',
      'Dashboards recomputing the same expensive search for every viewer instead of reading a summary.',
    ],
    followUps: [
      'What is `tstats` and why is it fast?',
      'How would you make a dashboard that many people open cheap to run?',
    ],
    tags: ['performance', 'spl', 'tstats', 'data models', 'advanced'],
  },
  {
    id: 'itv-splunk-13',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you get data into Splunk, and how would you reduce ingest volume?',
    probing: 'Licensing is volume-based, so ingest reduction is a real and recurring concern.',
    answer: [
      'The main inputs: **universal forwarders** monitoring files and directories, **HTTP Event Collector (HEC)** for applications sending events directly over HTTP, **syslog** (usually into a syslog server that writes files a forwarder reads, rather than directly into Splunk), **scripted inputs**, and cloud-native inputs for AWS, Azure and GCP.',
      'HEC is the one worth knowing for application logs - it is a token-authenticated HTTP endpoint, works well from containers and serverless functions, and avoids needing a forwarder on the host.',
      'On **reducing volume**, which matters because Splunk is licensed by daily ingest: the levers are **filtering**, **routing** and **trimming**.',
      '**Filter at the forwarder** with `props.conf` and `transforms.conf` - route events matching a pattern to `nullQueue` so they are dropped before they count against the licence. Debug-level logs, health check requests and repetitive noise are the usual candidates and often a large share of the total.',
      '**Trim the events themselves**: strip verbose fields, drop stack traces from non-error events, avoid logging entire request and response bodies.',
      '**Route by value**: send high-volume low-value data to a cheaper destination - S3, or a different tool - and keep Splunk for what is actually searched.',
      'And **measure first**: `index=_internal` licence usage by sourcetype tells you where the volume is, and it is nearly always concentrated in two or three sources.',
    ],
    code: [
      {
        title: 'Find where the volume is',
        language: 'text',
        code: `# Licence usage by sourcetype over the last week
index=_internal source=*license_usage.log type=Usage earliest=-7d
| stats sum(b) as bytes by st
| eval GB=round(bytes/1024/1024/1024, 2)
| sort -GB

# And by host, to find a single noisy machine
index=_internal source=*license_usage.log type=Usage earliest=-24h
| stats sum(b) as bytes by h
| eval GB=round(bytes/1024/1024/1024, 2) | sort -GB | head 20`,
      },
      {
        title: 'Drop noise at the forwarder, before it costs anything',
        language: 'text',
        code: `# props.conf
[access_combined]
TRANSFORMS-drop_healthchecks = drop_healthchecks

# transforms.conf
[drop_healthchecks]
REGEX = (GET /healthz|GET /ping|kube-probe)
DEST_KEY = queue
FORMAT = nullQueue`,
        explanation:
          'Events routed to nullQueue are discarded before indexing, so they never count against the licence.',
      },
    ],
    traps: [
      'Filtering at the indexer rather than the forwarder, so the data has already crossed the network.',
      'Dropping data that turns out to be needed for an investigation - filter deliberately, and document it.',
      'Ingesting everything "in case" and being surprised by the licence cost.',
    ],
    followUps: [
      'Where would you look first to find what is consuming the licence?',
      'What is the risk of aggressive filtering?',
    ],
    tags: ['ingest', 'hec', 'forwarders', 'licensing', 'cost'],
  },
  {
    id: 'itv-splunk-14',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Users report that a dashboard is timing out and searches are slow across the board. How do you investigate?',
    probing: 'Platform troubleshooting rather than a single slow query.',
    answer: [
      'First, **is it everything or one dashboard?** If one search is slow, it is a query problem; if everything is slow, it is a platform problem, and those need very different investigations.',
      'For the platform view, the **Monitoring Console** is the starting point. The things to look at: **search concurrency** against the limit - if searches are being queued or skipped, the system is saturated; **indexer CPU and I/O**; **skipped scheduled searches**, which is a clear saturation signal; and **indexing latency**, because if indexers are struggling to keep up with ingest, search suffers too.',
      'A very common cause is **too many scheduled searches**, particularly several heavy ones scheduled at the same minute. Every dashboard panel is a search, and a dashboard opened by fifty people concurrently is fifty searches. Spreading schedules and accelerating or summarising the expensive ones fixes a lot.',
      'Another is a **single badly written search** consuming resources - an "All time" search with a wildcard on a large index. The Monitoring Console shows the most expensive running searches by CPU and by events scanned.',
      'Then **capacity**: has ingest volume grown, has a new data source been added, has retention been extended so buckets cover more data? Search performance degrades gradually as data grows, and it is rarely noticed until it crosses a threshold.',
      'The fixes, in order: **fix the worst searches**, **spread scheduled search times**, **accelerate or summarise** what dashboards read, and **add indexers** if the platform is genuinely at capacity.',
    ],
    code: [
      {
        title: 'The searches that diagnose it',
        language: 'text',
        code: `# Are scheduled searches being skipped? A clear saturation signal.
index=_internal sourcetype=scheduler status=skipped earliest=-24h
| stats count by reason, savedsearch_name
| sort -count

# The most expensive searches by runtime
index=_audit action=search info=completed earliest=-24h
| stats avg(total_run_time) as avg_s, max(total_run_time) as max_s,
        sum(event_count) as events, count as runs by user, search_id
| sort -avg_s | head 20

# Search concurrency against the limit
index=_internal source=*metrics.log group=search_concurrency
| timechart span=5m max(active_hist_searches) as historical, max(active_realtime_searches) as realtime

# Indexing keeping up?
index=_internal source=*metrics.log group=queue
| timechart span=1m avg(current_size_kb) by name`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Narrowing a platform-wide slowdown',
        caption:
          'Distinguishing "one bad search" from "the platform is saturated" is the first and most important step.',
        nodes: [
          {
            label: 'One search or all of them?',
            detail: 'Query problem vs platform problem',
            tone: 'accent',
          },
          {
            label: 'Skipped scheduled searches?',
            detail: 'The clearest saturation signal',
            tone: 'warning',
          },
          { label: 'Search concurrency at the limit?', detail: 'Queuing means over capacity' },
          { label: 'Indexer CPU, I/O, queue depth', detail: 'Is ingest itself struggling?' },
          {
            label: 'Find the worst searches',
            detail: 'Usually a small number dominate',
            tone: 'warning',
          },
          { label: 'Fix searches, spread schedules, then add capacity', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Scheduled searches all set to run "every 5 minutes" default to the same minute. Spreading them with a cron schedule removes a synchronised spike.',
      'Real-time searches are extremely expensive and hold resources continuously. A few of them can degrade an entire deployment; they are almost never necessary.',
      'Dashboard panels should read from accelerated data models or summary indexes, not recompute raw searches per viewer.',
      'Adding indexers helps both search and indexing; adding search heads only helps search concurrency.',
    ],
    traps: [
      'Adding search heads when the indexers are saturated.',
      'Missing that a handful of real-time searches are consuming the platform.',
      'Optimising the dashboard that was reported while a different search is the actual cause.',
    ],
    followUps: [
      'Why are real-time searches so expensive?',
      'How would you stop a single user’s search degrading the platform?',
    ],
    tags: ['scenario', 'performance', 'troubleshooting', 'monitoring console', 'advanced'],
  },
  {
    id: 'itv-splunk-15',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these improve Splunk search performance? Select all that apply.',
    probing: 'Performance intuition, with one plausible wrong answer.',
    options: [
      { id: 'a', text: 'Restricting the time range as tightly as the question allows' },
      { id: 'b', text: 'Specifying `index=` and `sourcetype=` in the base search' },
      { id: 'c', text: 'Using `tstats` against accelerated data models instead of raw searches' },
      { id: 'd', text: 'Using real-time searches so results are always current' },
      { id: 'e', text: 'Using `fields` early to discard data you will not use' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Real-time searches are the wrong one. They are **continuously running processes** that hold resources for as long as they exist, and they are among the most expensive things you can do in Splunk. A handful of them can degrade an entire deployment. A scheduled search running every minute gives nearly the same freshness at a fraction of the cost.',
      'The others all reduce the amount of data that has to be read or carried. **Time range** determines how many buckets are opened and is the single biggest factor. **Index and sourcetype** are indexed fields, so filtering on them eliminates data before parsing.',
      '**`tstats`** reads indexed metadata rather than raw events and is frequently orders of magnitude faster, especially against an accelerated data model.',
      '**`fields` early** reduces what every subsequent command has to carry, which compounds through a long search pipeline.',
    ],
    traps: [
      'Real-time searches used for dashboards where a one-minute scheduled search would do.',
      'Assuming acceleration is free - it uses disk and CPU to maintain the summaries.',
      '`fields` placed after the expensive commands, where it saves nothing.',
    ],
    followUps: ['What is the cheaper alternative to a real-time search?'],
    tags: ['performance', 'tstats', 'real-time', 'best practices'],
  },
  {
    id: 'itv-splunk-16',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are data models and acceleration, and when are they worth it?',
    probing: 'A key performance feature and its costs.',
    answer: [
      "A **data model** is a structured, hierarchical description of a dataset - a set of fields with consistent names mapped onto events from different sources. The **Common Information Model (CIM)** is Splunk's standard set of these, which is what lets an app like Enterprise Security work across data from many vendors: they all map onto the same field names.",
      '**Acceleration** builds and maintains a summary of the data model on the indexers. Searches against the accelerated model - using `tstats` with `summariesonly=true` - read the summary rather than the raw events, which is typically **orders of magnitude faster**.',
      'It is worth it when the same aggregations are run **repeatedly** - dashboards that many people open, scheduled alerts, reports. The cost is paid once in building the summary rather than every time someone searches.',
      'The costs are real and worth stating: acceleration consumes **disk** for the summaries and **CPU on the indexers** to maintain them continuously. Accelerating many models, or one over a very long retention period, can consume a significant share of your indexing capacity - which makes everything else slower.',
      'And `summariesonly=true` returns **only** what is in the summary, so data that has not been summarised yet (recent events, or a backfill still in progress) is missing. That is a correctness trap: a dashboard can show incomplete recent data and look fine.',
    ],
    code: [
      {
        title: 'Searching an accelerated data model',
        language: 'text',
        code: `# Fast - reads the summary only
| tstats summariesonly=true count from datamodel=Web.Web
  where Web.status>=500 earliest=-24h
  by Web.uri_path, _time span=1h

# Includes non-summarised data too - slower, but complete
| tstats summariesonly=false count from datamodel=Web.Web
  where Web.status>=500 by Web.uri_path

# How much is the acceleration actually costing?
| rest /services/admin/summarization
| table title, summary.size, summary.mod_time, summary.complete`,
      },
    ],
    traps: [
      '`summariesonly=true` on a dashboard showing recent data, which silently omits events not yet summarised.',
      'Accelerating every data model, consuming indexer capacity and slowing everything down.',
      'Acceleration over a very long retention window, where the summary maintenance cost is continuous.',
    ],
    followUps: [
      'What does `summariesonly=true` risk?',
      'When would acceleration make the platform slower overall?',
    ],
    tags: ['data models', 'acceleration', 'cim', 'tstats', 'performance'],
  },
  {
    id: 'itv-splunk-17',
    level: 'basic',
    kind: 'open',
    prompt: 'How do alerts work in Splunk?',
    probing: 'Alerting basics, and the same alert-fatigue question that applies everywhere.',
    answer: [
      'An alert is a **saved search that runs on a schedule** (or in real time) with a **trigger condition** - number of results, a field value, a custom condition - and one or more **actions** when it fires: email, a webhook, a ticket, a script, or writing to a summary index.',
      'The settings that matter operationally are **throttling** and **grouping**. Without throttling, a condition that stays true fires the alert on every scheduled run - every five minutes, indefinitely. Throttling suppresses repeat notifications for a period, optionally per field value so each affected host alerts once rather than the alert firing repeatedly overall.',
      'The **trigger condition** deserves thought. "Number of results is greater than zero" is the common default and is often too sensitive - a single occurrence of something that happens occasionally will page someone. A threshold, or a condition on a computed rate, is usually better.',
      'And the same principle applies as anywhere else: **an alert should mean someone needs to act now**. Splunk makes it easy to create alerts on anything, which makes alert fatigue easy to create too. Reviewing what fired last week and whether anyone acted on it is the discipline that keeps the system useful.',
    ],
    code: [
      {
        title: 'An alert search with a sensible threshold',
        language: 'text',
        code: `index=app sourcetype=json earliest=-15m
| stats count(eval(level="ERROR")) as errors, count as total by service
| eval error_rate=round(errors/total*100, 2)
| where error_rate > 5 AND total > 100`,
        explanation:
          'The `total > 100` guard stops a quiet service with two errors out of three requests reading as 66% and paging someone.',
      },
    ],
    traps: [
      'Trigger "results > 0" on something that occasionally happens legitimately.',
      'No throttling, so an ongoing condition notifies every five minutes.',
      'No minimum-volume guard, so a low-traffic service produces alarming percentages.',
      'Alerts that fire and nobody acts on, training everyone to ignore them.',
    ],
    followUps: ['Why add a minimum volume condition to a rate-based alert?'],
    tags: ['alerts', 'scheduled searches', 'throttling', 'alert fatigue'],
  },
  {
    id: 'itv-splunk-18',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you use Splunk for security monitoring?',
    probing: "The SIEM use case, which is a large part of Splunk's market.",
    answer: [
      'The foundation is **getting the right data in and normalising it**. Authentication logs, firewall and network flows, endpoint telemetry, cloud audit trails (CloudTrail and equivalents), DNS, proxy logs, and application audit events. Normalising them onto the **Common Information Model** is what makes cross-source correlation possible - otherwise every source has its own field names and every search is bespoke.',
      'Then **detection**. Correlation searches looking for patterns: impossible travel (two logins from distant locations within an implausible interval), brute force followed by a success, privilege escalation, data exfiltration volumes, a new process on a server that has never run it, access outside normal hours.',
      '**Enterprise Security** packages this with a large library of correlation searches, risk-based alerting, and an investigation workflow. Building it from scratch is possible and is a large amount of work.',
      'The practical difficulty is **false positives**. A detection that fires fifty times a day for legitimate behaviour is worse than no detection, because analysts stop reading it. **Risk-based alerting** addresses this well: instead of alerting on each individual signal, attach a risk score to entities and alert when an entity accumulates enough risk across several signals. One unusual login is noise; an unusual login plus a privilege change plus a large data transfer from the same user is worth investigating.',
      'And **tuning is continuous work**, not a setup step. Every detection needs an owner and regular review against what it actually caught.',
    ],
    code: [
      {
        title: 'A brute-force-then-success correlation',
        language: 'text',
        code: `index=auth sourcetype=linux_secure earliest=-1h
| stats count(eval(action="failure")) as failures,
        count(eval(action="success")) as successes,
        values(src_ip) as src_ips,
        earliest(_time) as first_seen, latest(_time) as last_seen
  by user, dest
| where failures > 20 AND successes > 0
| eval window_minutes=round((last_seen-first_seen)/60, 1)
| where window_minutes < 10
| table user, dest, failures, successes, window_minutes, src_ips`,
      },
      {
        title: 'Impossible travel, using a geo lookup',
        language: 'text',
        code: `index=auth action=success earliest=-24h
| iplocation src_ip
| stats earliest(_time) as t1, latest(_time) as t2,
        earliest(Country) as c1, latest(Country) as c2,
        earliest(lat) as lat1, earliest(lon) as lon1,
        latest(lat) as lat2, latest(lon) as lon2 by user
| where c1 != c2
| eval hours=(t2-t1)/3600
| eval km=round(haversine(lat1, lon1, lat2, lon2), 0)
| eval implied_kmh=round(km/hours, 0)
| where implied_kmh > 900
| table user, c1, c2, km, hours, implied_kmh`,
      },
    ],
    deeper: [
      'CIM normalisation is the unglamorous work that makes everything else possible. Skipping it means every detection is source-specific and breaks when a vendor changes a log format.',
      'Risk-based alerting reduces volume dramatically while catching more, because it correlates weak signals rather than alerting on each.',
      'Detections need test cases. Purple-team exercises that deliberately trigger them are how you find out which ones do not actually work.',
      'Retention for security data is usually driven by compliance requirements, which may be far longer than operational needs - a cost consideration worth raising early.',
    ],
    traps: [
      'Detections with no tuning process, producing noise until they are ignored.',
      'Alerting on individual weak signals rather than correlating them.',
      'Data ingested without CIM normalisation, making cross-source correlation impractical.',
      'No process for verifying that detections still work after a log format changes.',
    ],
    followUps: [
      'How would you reduce false positives without reducing coverage?',
      'What is risk-based alerting and why does it help?',
    ],
    tags: ['security', 'siem', 'cim', 'correlation', 'enterprise security', 'advanced'],
  },
  {
    id: 'itv-splunk-19',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `| stats count by host` do?',
    probing: 'Reading SPL correctly.',
    options: [
      { id: 'a', text: 'Returns one row per distinct host with the number of events for each' },
      { id: 'b', text: 'Returns the total event count as a single number' },
      { id: 'c', text: 'Lists every event, with the host field added' },
      { id: 'd', text: 'Counts how many distinct hosts there are' },
    ],
    correct: ['a'],
    answer: [
      '`stats count by host` groups the events by the `host` field and returns **one row per distinct host** with the count for each. It is a **transforming** command - the individual events are replaced by the aggregate result.',
      'That transforming behaviour matters for what comes next: after `stats`, the raw events are gone, so you can only work with the fields `stats` produced. A `| search` after a `stats` filters the aggregate rows, not the original events.',
      'To count distinct hosts instead, you would use `stats dc(host)`. To get the overall total, `stats count` with no `by` clause.',
      'And `stats` can produce several aggregates at once, which is usually what you want: `stats count, dc(user) as users, avg(duration) as avg_ms by host`.',
    ],
    code: [
      {
        title: 'The variations',
        language: 'text',
        code: `| stats count by host                 # one row per host
| stats count                          # one row, the total
| stats dc(host) as distinct_hosts     # how many distinct hosts
| stats count, dc(user) as users, avg(duration) as avg_ms by host, status`,
      },
    ],
    traps: [
      'Expecting raw event fields to still be available after `stats`.',
      'Confusing `count` with `dc(field)`.',
      'Filtering with `| search` after `stats` and wondering why it behaves differently.',
    ],
    followUps: ['What happens to the raw events after a transforming command?'],
    tags: ['spl', 'stats', 'aggregation', 'fundamentals'],
  },
  {
    id: 'itv-splunk-20',
    level: 'advanced',
    kind: 'open',
    prompt: 'How does Splunk compare with ELK, Loki or a cloud-native logging service?',
    probing:
      'Tool judgement. A balanced answer that does not just advocate for one is what is wanted.',
    answer: [
      '**Splunk** is the most capable and the most expensive. Its strengths are a genuinely powerful search language, a mature app ecosystem, strong security tooling in Enterprise Security, and the operational maturity that comes with age. Its weakness is **cost** - licensing by daily ingest volume means growth is directly and painfully expensive, and it drives a lot of behaviour around what teams are willing to log.',
      '**ELK / OpenSearch** is open source with no ingest licence, which makes it much cheaper at volume - but you operate it. Elasticsearch cluster management is genuinely demanding: shard sizing, hot-warm architecture, rebalancing, and recovery from a red cluster are all real work. The saving is real and so is the cost in people.',
      '**Loki** takes a deliberately different approach: it indexes only **labels**, not the log content, which makes ingest and storage dramatically cheaper. The trade-off is that searching log content is a brute-force scan over the selected streams, so it is fast when your labels narrow it well and slow when they do not. It fits Kubernetes environments naturally and pairs with Prometheus and Grafana.',
      '**Cloud-native services** - CloudWatch Logs, Cloud Logging, Azure Monitor - are convenient and integrated, with no operational burden. They are generally weaker at search and analysis, and can get expensive at volume too, but for a workload already in one cloud they remove a whole class of work.',
      'How I would choose: **Splunk** where security use cases, compliance and analytical depth justify the cost. **Loki with Grafana** for a Kubernetes-centric platform where most log access is "show me the logs for this pod around this time". **ELK** where you need full-text search at volume and have the people to run it. And a **cloud service** where simplicity matters more than capability.',
      'The honest note is that many organisations end up with more than one, and the cost of that fragmentation - no single place to search, correlation done by hand - is usually underestimated.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which log platform?',
        caption: 'The decision is usually about cost and operational burden rather than features.',
        question: 'What matters most here?',
        branches: [
          {
            condition: 'Security, compliance, deep analysis',
            result: 'Splunk',
            detail: 'Most capable, most expensive',
            tone: 'accent',
          },
          {
            condition: 'Kubernetes, cost-sensitive, label-based access',
            result: 'Loki + Grafana',
            detail: 'Indexes labels only - very cheap',
            tone: 'success',
          },
          {
            condition: 'Full-text search at volume, team to operate it',
            result: 'ELK / OpenSearch',
            detail: 'No licence cost, real operational cost',
            tone: 'accent',
          },
          {
            condition: 'Simplicity, already in one cloud',
            result: 'Cloud-native service',
            detail: 'Less capable, far less work',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      "Loki's design decision - index labels, not content - is the key thing to understand about it, and it explains both its low cost and its search characteristics.",
      "Splunk's workload-based pricing options change the calculation compared with the traditional ingest licence; it is worth knowing which model an organisation is on.",
      'Whatever you choose, log volume reduction at source is the highest-leverage cost control, and it applies to all of them.',
    ],
    traps: [
      'Choosing ELK for the licence saving and underestimating the operational cost.',
      'Expecting Loki to behave like Elasticsearch for full-text search across everything.',
      'Running several platforms and paying the correlation cost in analyst time.',
    ],
    followUps: [
      'What is the key design decision behind Loki?',
      'What is the hidden cost of self-hosting ELK?',
    ],
    tags: ['comparison', 'elk', 'loki', 'cost', 'strategy', 'advanced'],
  },
]
