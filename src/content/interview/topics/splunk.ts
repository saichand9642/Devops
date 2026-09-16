import type { InterviewTopic } from '../../types'

export const splunkTopic: InterviewTopic = {
  id: 'splunk',
  title: 'Splunk & log management',
  shortTitle: 'Splunk',
  icon: '🔍',
  order: 9,
  oneLiner:
    'Indexes, SPL, forwarders, index-time versus search-time, and the performance questions that follow.',
  headlines: [
    'Splunk indexes raw machine data and lets you search it with **SPL** - a pipeline language, like a shell pipe.',
    'Architecture: **forwarders** collect, **indexers** store and search, **search heads** coordinate and present.',
    'The four fields that govern everything: `index`, `sourcetype`, `source`, `host`. Filter on them first.',
    'Index-time decisions are permanent; search-time decisions are flexible. Prefer search-time.',
    '`tstats` on accelerated data models is dramatically faster than raw search for large ranges.',
    'The single biggest performance lever is narrowing the **time range** and the **index** before anything else.',
  ],
  questions: [
    {
      id: 'itv-splunk-1',
      level: 'basic',
      kind: 'open',
      prompt: 'Explain Splunk architecture: forwarders, indexers and search heads.',
      probing:
        'Basic component knowledge. It tells them whether you have operated Splunk or only searched in it.',
      answer: [
        'A **forwarder** runs on the machine producing data and ships it onward. A **universal forwarder** is a lightweight agent that just sends raw data; a **heavy forwarder** can parse and filter before sending, which is useful for dropping noise at source or routing to different destinations.',
        'An **indexer** receives the data, parses it into events, extracts index-time fields, writes it to disk in an **index**, and searches its own data when asked. Indexers do the heavy lifting for both storage and search.',
        'A **search head** is where users run searches. It does not store data - it distributes the search to all indexers, which each search their own slice in parallel and return results, and the search head merges and presents them. That map-reduce shape is what makes Splunk scale.',
        'At scale you add clustering: an **indexer cluster** replicates data across indexers for resilience, managed by a cluster manager, and a **search head cluster** shares configuration and scheduled searches across several search heads.',
      ],
      diagrams: [
        {
          kind: 'sequence',
          title: 'What happens when you run a search',
          caption:
            'The search head distributes and merges; the indexers do the searching in parallel. That is why filtering early matters so much.',
          participants: [
            { id: 'user', label: 'You' },
            { id: 'sh', label: 'Search head' },
            { id: 'idx', label: 'Indexers' },
          ],
          messages: [
            { from: 'user', to: 'sh', label: 'index=prod error | stats count' },
            { from: 'sh', to: 'sh', label: 'parse SPL, split into map and reduce' },
            { from: 'sh', to: 'idx', label: 'distribute the map portion' },
            { from: 'idx', to: 'idx', label: 'each searches its own buckets in parallel' },
            { from: 'idx', to: 'sh', label: 'partial results', kind: 'return' },
            { from: 'sh', to: 'user', label: 'merged, final results', kind: 'return' },
          ],
        },
      ],
      deeper: [
        'Data ages through **buckets**: hot (being written, on fast disk), warm (recent, still local), cold (older, often slower storage), then frozen (deleted or archived). Retention and storage cost are controlled per index by bucket-ageing policy, which is where most Splunk cost tuning happens.',
        'Splunk Enterprise is traditionally licensed on **daily indexing volume**, which is why "drop the noise at the forwarder" is both a performance and a budget decision.',
      ],
      traps: [
        'Saying the search head stores data. It does not - it coordinates.',
        'Confusing a heavy forwarder with an indexer. A heavy forwarder parses but does not index or search.',
      ],
      followUps: [
        'What is the difference between a universal and a heavy forwarder?',
        'How does Splunk scale searching?',
        'What are hot, warm and cold buckets?',
      ],
      tags: ['architecture', 'forwarders', 'indexers'],
    },
    {
      id: 'itv-splunk-2',
      level: 'basic',
      kind: 'mcq',
      prompt: 'Which of these searches will be fastest over 30 days of data?',
      options: [
        { id: 'a', text: '`error | search index=prod sourcetype=app` ' },
        { id: 'b', text: '`index=prod sourcetype=app error | stats count by host`' },
        { id: 'c', text: '`* | where index="prod" AND like(_raw, "%error%")`' },
        { id: 'd', text: '`search * error | rex "index=(?<idx>\\w+)"`' },
      ],
      correct: ['b'],
      probing: 'SPL performance intuition: filter as early and as specifically as possible.',
      answer: [
        'Option B is correct because it puts `index`, `sourcetype` and the search term in the **first pipe**, before any command. Splunk uses those to eliminate whole buckets before reading any events.',
        'Option A searches every index for `error` first and only then filters - so it has already done the expensive work.',
        'Option C is the worst: `*` matches everything, and `where` with `like` is evaluated **per event** after retrieval, so it cannot use the index at all.',
        'Option D is similar and adds a regex over raw text on top.',
        'The principle is that everything before the first pipe is a filter Splunk can push down to the index. Everything after it operates on events already retrieved. So specify `index` always, `sourcetype` where you can, and put your search terms in the base search rather than in a later `where`.',
      ],
      code: [
        {
          title: 'Slow and fast versions of the same question',
          language: 'text',
          code: `# SLOW - searches every index, filters later
error OR failed | search index=prod | stats count by host

# FAST - index and sourcetype first, terms in the base search
index=prod sourcetype=app (error OR failed)
| stats count by host

# SLOWER still - where runs per retrieved event
index=prod | where match(_raw, "error")

# FASTER - the term filter happens at index level
index=prod error

# FASTEST for large ranges, if the data model is accelerated
| tstats count WHERE index=prod sourcetype=app BY host, _time span=1h`,
        },
      ],
      traps: [
        'Leading with `*`. It is the single most common cause of a search that never finishes.',
        'Using `where` for something that could be a base-search term. `where` is for comparing fields, not for filtering raw text.',
      ],
      followUps: [
        'What is the difference between `search` and `where`?',
        'When would you use tstats?',
        'Why does specifying the index matter so much?',
      ],
      tags: ['spl', 'performance', 'search'],
    },
    {
      id: 'itv-splunk-3',
      level: 'intermediate',
      kind: 'open',
      prompt:
        'Explain index-time versus search-time field extraction. Which do you prefer and why?',
      probing:
        'The central Splunk design decision. "Search-time by default" is the expected answer, with reasons.',
      answer: [
        '**Index-time** processing happens once, when the data is written. Index-time fields are baked into the index permanently. **Search-time** extraction happens each time you run a search, applying regexes or field definitions to the raw event.',
        'The strong default is **search-time**, for one decisive reason: it is **reversible**. If you get a field definition wrong at search time, you fix the regex and every historical search is immediately correct. If you get it wrong at index time, the data is already written - the only fix is to re-index, which for months of data is often impractical.',
        'Search-time also keeps the index smaller and indexing faster, and it lets you add new fields to old data without touching it.',
        'The case for index-time is narrow: fields you filter on in almost every search, on very large volumes, where the repeated search-time cost genuinely outweighs the loss of flexibility. And `host`, `source`, `sourcetype` and `_time` are index-time by necessity.',
        'The Splunk phrasing for this is the principle of least-work-at-index-time, and it is a good instinct: defer decisions until you know what you need.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Index-time or search-time?',
          caption:
            'Reversibility is the deciding factor. Index-time mistakes cost a re-index; search-time mistakes cost a regex edit.',
          question: 'What are you deciding?',
          branches: [
            {
              condition: 'a field you might define differently later',
              result: 'Search-time',
              detail: 'Fix the regex, and history is retroactively correct',
              tone: 'accent',
            },
            {
              condition: 'routing, filtering or dropping data',
              result: 'Index-time',
              detail: 'Must happen before it is written - and saves licence volume',
            },
            {
              condition: 'a field used in nearly every search, at huge volume',
              result: 'Index-time, deliberately',
              detail: 'Accept the loss of flexibility for the performance',
            },
            {
              condition: 'you are not sure yet',
              result: 'Search-time',
              detail: 'Defer the decision - it stays reversible',
            },
          ],
        },
      ],
      code: [
        {
          title: 'A search-time extraction, and the alternatives',
          language: 'text',
          code: `# props.conf - search-time extraction (preferred)
[app_logs]
EXTRACT-status = status=(?<http_status>\\d{3})
EXTRACT-latency = duration=(?<latency_ms>\\d+)ms

# Ad-hoc in a search - great for exploring before committing
index=prod sourcetype=app
| rex field=_raw "status=(?<http_status>\\d{3})"
| stats avg(latency_ms) BY http_status

# Index-time, used deliberately to DROP noise and save licence volume
# transforms.conf
[drop_healthchecks]
REGEX = GET /healthz
DEST_KEY = queue
FORMAT = nullQueue`,
        },
      ],
      traps: [
        'Doing index-time extraction "for performance" before measuring. You lose flexibility permanently for a gain you may not need.',
        'Forgetting that changing an index-time setting only affects **new** data.',
      ],
      followUps: [
        'What must be done at index time and cannot be deferred?',
        'How would you drop noisy events before they consume licence volume?',
        'What happens to old data if you change an extraction?',
      ],
      tags: ['indexing', 'fields', 'design'],
    },
    {
      id: 'itv-splunk-4',
      level: 'intermediate',
      kind: 'open',
      prompt:
        'Write an SPL search that finds the top 10 slowest API endpoints in the last hour, and explain each command.',
      probing:
        'Practical SPL fluency. They want to see pipeline thinking and correct use of stats.',
      answer: [
        'The pattern is: narrow the base search as hard as possible, then aggregate, then sort and limit.',
        'I would start with `index` and `sourcetype` so Splunk can skip irrelevant buckets, then constrain the time range in the base search rather than the time picker if it needs to be explicit.',
        '`stats` is the workhorse. Grouping by endpoint and computing count, average and percentiles in one command is far more efficient than several passes, because `stats` is a streaming command distributed to the indexers.',
        'I would report the **95th percentile** rather than just the average, because an average hides the tail - and the tail is what users complain about. `perc95()` gives that directly.',
        'Then `sort` with a limit, and `eval` to round the numbers so the table is readable.',
      ],
      code: [
        {
          title: 'The search, built up in stages',
          language: 'text',
          code: `index=prod sourcetype=api_access earliest=-1h latest=now
| stats count AS requests,
        avg(response_time_ms) AS avg_ms,
        perc95(response_time_ms) AS p95_ms,
        max(response_time_ms) AS max_ms
    BY endpoint
| eval avg_ms = round(avg_ms, 1), p95_ms = round(p95_ms, 1)
| sort - p95_ms
| head 10
| rename endpoint AS "Endpoint", requests AS "Requests",
         avg_ms AS "Avg (ms)", p95_ms AS "p95 (ms)", max_ms AS "Max (ms)"

# Line by line:
#   line 1  base search - index, sourcetype and time. Filters at index level.
#   stats   one pass, several aggregates, grouped by endpoint
#   eval    round for readability
#   sort -  descending by p95 (the "-" means descending)
#   head    top 10 only
#   rename  human-readable column headers`,
        },
        {
          title: 'Two variations worth knowing',
          language: 'text',
          code: `# Error RATE per endpoint, not just slowness.
# eval inside stats is how you do conditional counting.
index=prod sourcetype=api_access earliest=-1h
| stats count AS total,
        count(eval(status>=500)) AS errors
    BY endpoint
| eval error_pct = round(errors * 100.0 / total, 2)
| where total > 100                 # ignore low-traffic noise
| sort - error_pct
| head 10

# Trend over time rather than a single number
index=prod sourcetype=api_access earliest=-24h
| timechart span=15m perc95(response_time_ms) BY endpoint limit=5`,
        },
      ],
      deeper: [
        '`stats` versus `eventstats` versus `streamstats` is a common follow-up. `stats` reduces to a summary table. `eventstats` computes the aggregate and adds it to **every** event, so you can compare each event to the average. `streamstats` computes a running aggregate in order, which is how you do things like "time since the previous event for this host".',
        '`where total > 100` in the second example is a small but important habit - without it, an endpoint hit twice with one error shows as 50% error rate and tops your table.',
      ],
      traps: [
        'Reporting only the average latency. It hides exactly the tail users notice.',
        'Using `top` when you need control - `top` is convenient but `stats ... | sort | head` is explicit and composable.',
        'Forgetting to exclude low-traffic endpoints from a percentage, which makes the results meaningless.',
      ],
      followUps: [
        'What is the difference between stats, eventstats and streamstats?',
        'How would you show this as a trend rather than a snapshot?',
        'Why percentile rather than average?',
      ],
      tags: ['spl', 'stats', 'queries'],
    },
    {
      id: 'itv-splunk-5',
      level: 'advanced',
      kind: 'scenario',
      prompt: 'Searches that used to take seconds now take minutes. How do you investigate?',
      probing:
        'Performance troubleshooting with several plausible causes - a good open-ended senior question.',
      answer: [
        'I would separate three possibilities: the **search** changed, the **data** changed, or the **platform** changed.',
        'For the search, the Job Inspector is the tool. It shows exactly where time went - how many events were scanned versus matched, which commands were expensive, and crucially whether the search was **distributed** to indexers or had to run on the search head. A search that cannot be distributed - because of a non-streaming command early in the pipeline - runs single-threaded and is dramatically slower.',
        'For the data, the usual cause is **volume growth**: the same search over ten times the events takes ten times as long. A new noisy source, a change in log level, or a new application logging verbosely into a shared index will do it. `| tstats count WHERE index=* BY index, sourcetype` over the period shows what grew.',
        'For the platform, I would check indexer health - CPU, disk I/O, and whether **search concurrency** limits are being hit so searches are queueing rather than running. A cluster where scheduled searches have proliferated will starve ad-hoc ones.',
        'The fixes follow the cause: narrow the base search and move filters earlier; add or accelerate a **data model** and use `tstats`; use summary indexing for expensive recurring reports; drop noisy data at the forwarder; or add indexer capacity.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Narrowing a slow search',
          caption:
            'The Job Inspector answers most of this in a minute - scanned versus matched is the key ratio.',
          nodes: [
            {
              label: 'Open the Job Inspector',
              detail: 'Where did the time actually go?',
              tone: 'accent',
            },
            {
              label: 'Compare events scanned with events matched',
              detail: 'A huge ratio means the base search is too broad',
              branch: {
                label: 'Scanned >> matched',
                detail: 'Add index, sourcetype and terms to the base search',
              },
            },
            {
              label: 'Was the search distributed?',
              detail: 'A non-streaming command early forces it onto the search head',
              branch: {
                label: 'Not distributed',
                detail: 'Reorder so streaming commands come first',
              },
            },
            {
              label: 'Has data volume grown?',
              detail: 'tstats count BY index, sourcetype over time',
            },
            {
              label: 'Are concurrency limits being hit?',
              detail: 'Searches queueing rather than running',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The diagnostic searches',
          language: 'text',
          code: `# Which sourcetypes grew, and when?
| tstats count WHERE index=* earliest=-30d BY _time span=1d, index, sourcetype
| timechart span=1d sum(count) BY sourcetype limit=10

# Daily indexing volume by index - licence and growth
index=_internal source=*license_usage.log type=Usage
| timechart span=1d sum(b) AS bytes BY idx
| eval GB = round(bytes/1024/1024/1024, 2)

# The most expensive searches on the platform
index=_audit action=search info=completed
| stats avg(total_run_time) AS avg_s, count AS runs,
        sum(total_run_time) AS total_s BY user, search_id
| sort - total_s
| head 20

# Are scheduled searches skipping because of concurrency limits?
index=_internal sourcetype=scheduler status=skipped
| stats count BY savedsearch_name, reason`,
        },
      ],
      traps: [
        'Assuming it is the platform and asking for more hardware before looking at the search.',
        'Ignoring the scanned-versus-matched ratio, which is usually the answer.',
        'Accelerating a data model without checking that the search can actually use it.',
      ],
      followUps: [
        'What makes a search distributable?',
        'When would you use summary indexing?',
        'How would you find which team is generating the most data?',
      ],
      tags: ['scenario', 'performance', 'troubleshooting'],
    },
    {
      id: 'itv-splunk-6',
      level: 'advanced',
      kind: 'open',
      prompt: 'How would you design log collection and retention for a large platform?',
      probing:
        'Design thinking about cost, compliance and usability - not just "send everything to Splunk".',
      answer: [
        'I would start from the question of **what each log is for**, because that determines both retention and destination. Security and audit logs have a compliance-driven retention, often years. Application debug logs are useful for days. Metrics belong in Prometheus, not a log system, and traces belong in a tracing backend.',
        'For **structure**: enforce structured logging - JSON with consistent field names - at the application level. It makes search-time extraction trivial and reliable, and it is far cheaper than maintaining regexes for a hundred bespoke formats.',
        'For **index design**: separate indexes by retention requirement and by access control, not by application. That way a compliance index can keep seven years while an application debug index keeps seven days, and RBAC can restrict who sees what.',
        'For **volume and cost**: filter at the forwarder. Health-check requests, debug chatter and duplicated stack traces routinely make up a large fraction of volume and are almost never searched. Dropping them at source saves licence, storage and search time simultaneously.',
        'For **retention**: tier it. Hot and warm on fast storage for the period people actually search interactively, cold on cheaper storage, then frozen to object storage for compliance - restorable if genuinely needed but not costing search infrastructure.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'Indexes by purpose, not by application',
          caption:
            'Retention and access control are properties of the data’s purpose. Splitting by application makes both impossible to manage.',
          root: {
            label: 'Splunk indexes',
            children: [
              {
                label: 'security_audit',
                detail: 'Retention 7 years - compliance driven',
                tone: 'accent',
                children: [{ label: 'Restricted RBAC', detail: 'Security team only' }],
              },
              {
                label: 'app_prod',
                detail: 'Retention 90 days - incident investigation',
                children: [{ label: 'Structured JSON', detail: 'Consistent field names' }],
              },
              {
                label: 'app_debug',
                detail: 'Retention 7 days - high volume, low value',
                tone: 'muted',
              },
              {
                label: 'infra',
                detail: 'Retention 30 days - syslog, platform components',
              },
              {
                label: 'Dropped at the forwarder',
                detail: 'Health checks, readiness probes, known noise',
                tone: 'warning',
              },
            ],
          },
        },
      ],
      code: [
        {
          title: 'Dropping noise before it costs anything',
          language: 'text',
          code: `# --- props.conf on the heavy forwarder
[nginx_access]
TRANSFORMS-drop = drop_health_checks, drop_static_assets

# --- transforms.conf
[drop_health_checks]
REGEX = "(GET|HEAD) /(healthz|readyz|metrics)"
DEST_KEY = queue
FORMAT = nullQueue

[drop_static_assets]
REGEX = "GET /static/.*\\.(js|css|png|jpg|woff2)"
DEST_KEY = queue
FORMAT = nullQueue

# --- indexes.conf: retention by purpose
[security_audit]
frozenTimePeriodInSecs = 220752000     # 7 years
coldToFrozenDir = /mnt/archive/security

[app_debug]
frozenTimePeriodInSecs = 604800        # 7 days
maxTotalDataSizeMB = 500000`,
        },
      ],
      deeper: [
        'A point worth making in an interview: the instinct to "log everything just in case" is expensive and usually counterproductive. More volume means slower searches, higher cost, and more noise to wade through during an incident. Deciding deliberately what **not** to keep is part of the design.',
        'If cost is the driver, it is also worth naming alternatives honestly - Loki, OpenSearch or a cloud-native log service may be a better fit for high-volume low-value application logs, with Splunk reserved for security and compliance data where its analytics genuinely pay for themselves.',
      ],
      traps: [
        'Sending everything to one index with one retention. You then pay compliance retention prices for debug logs.',
        'Splitting indexes by application, which multiplies management overhead without helping retention or access control.',
        'Filtering at the indexer rather than the forwarder - the data has already crossed the network and often already counted against licence.',
      ],
      followUps: [
        'How would you decide what to drop?',
        'When would you use something other than Splunk?',
        'How do you handle a team that wants everything kept forever?',
      ],
      tags: ['design', 'retention', 'cost', 'logging'],
    },
  ],
}
