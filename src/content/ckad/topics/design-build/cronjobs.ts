import type { Topic } from '../../../types'

export const cronjobs: Topic = {
  id: 'cronjobs',
  title: 'CronJobs: scheduled work',
  domainId: 'design-build',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 7,
  tags: ['cronjob', 'schedule', 'cron', 'concurrencyPolicy', 'startingDeadlineSeconds', 'suspend'],
  oneLiner:
    'Cron syntax, what happens when a run overlaps or is missed, and how to keep history without filling the namespace.',
  explanation: [
    'A **CronJob** creates a Job on a schedule. It owns Jobs; those Jobs own Pods. So a CronJob problem is diagnosed at three levels: the CronJob (did it fire?), the Job (did it complete?), the Pod (what did the container do?).',
    'The schedule is standard five-field cron: minute, hour, day-of-month, month, day-of-week. `0 2 * * *` is 02:00 every day; `*/15 * * * *` is every fifteen minutes; `0 9 * * 1-5` is 09:00 on weekdays.',
    'Three fields control behaviour when reality does not match the schedule. `concurrencyPolicy` decides what happens if the previous run is still going: `Allow` (default, run both), `Forbid` (skip the new one), `Replace` (kill the old one and start the new one).',
    '`startingDeadlineSeconds` says how late a missed run may still start - useful when the controller was down. `suspend: true` stops new Jobs being created without deleting anything.',
    'History is kept by `successfulJobsHistoryLimit` (default 3) and `failedJobsHistoryLimit` (default 1). Those defaults are why you see a handful of old Jobs and not hundreds.',
  ],
  whyItMatters: [
    'Scheduled work is one of the clearest CKAD task shapes: "create a CronJob that runs every N minutes and does X". Knowing the cron syntax and the generator makes it a one-minute task.',
    'Overlap behaviour is a real production concern. A nightly report that takes 90 minutes on a 60-minute schedule with `Allow` will pile up until the namespace runs out of quota.',
    'When a CronJob "does not work", the three-level structure tells you exactly where to look, and the LAST SCHEDULE column answers the first question immediately.',
  ],
  howItWorks: [
    'The CronJob controller checks schedules roughly every 10 seconds and creates a Job for each due time. Timing is not exact: a Job may start up to a minute or so late, and CronJobs are not suitable for second-level precision.',
    "Times are interpreted in the controller's timezone (UTC on most clusters) unless you set `spec.timeZone` to an IANA name such as `Europe/Dublin`.",
    'If more than 100 schedule times are missed (for example the controller was down for hours) without `startingDeadlineSeconds` set, the controller stops trying and records an error. Setting `startingDeadlineSeconds` bounds how far back it looks.',
    'Deleting a CronJob deletes the Jobs it created; deleting a Job deletes its Pods. `--cascade=orphan` breaks that chain if you need to.',
    "`kubectl create job <name> --from=cronjob/<cronjob>` copies the CronJob's `jobTemplate` into a standalone Job so you can run it on demand without waiting for the schedule.",
    "A CronJob's `jobTemplate.spec` accepts every Job field, so `backoffLimit`, `activeDeadlineSeconds` and `ttlSecondsAfterFinished` all apply to each scheduled run.",
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'CronJob creates a Job, which creates a Pod',
      caption:
        'Three objects, not one. When a scheduled run misbehaves, check all three: kubectl get cronjob,job,pod.',
      nodes: [
        {
          label: 'CronJob',
          detail: 'schedule: "*/5 * * * *" in the cluster timezone',
          tone: 'accent',
        },
        {
          label: 'Schedule fires',
          detail: 'Controller checks roughly every 10 seconds',
          arrowLabel: 'time matches',
          branch: {
            label: 'Missed by over 100s',
            detail: 'startingDeadlineSeconds may skip the run entirely',
          },
        },
        {
          label: 'A new Job is created',
          detail: 'Named cronjob-name-<timestamp>',
          branch: {
            label: 'concurrencyPolicy: Forbid',
            detail: 'Skipped because the previous Job is still running',
          },
        },
        { label: 'The Job creates a Pod', detail: 'Normal Job semantics apply' },
        {
          label: 'History is trimmed',
          detail: 'successfulJobsHistoryLimit: 3, failedJobsHistoryLimit: 1',
          arrowLabel: 'after completion',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'CronJob',
      apiVersion: 'batch/v1',
      purpose: 'Creates Jobs on a cron schedule.',
      fields: [
        { path: 'spec.schedule', meaning: 'Five-field cron expression.', required: true },
        {
          path: 'spec.jobTemplate.spec',
          meaning: 'A full Job spec, including its own Pod template.',
          required: true,
        },
        {
          path: 'spec.timeZone',
          meaning: 'IANA timezone name; defaults to the controller timezone (usually UTC).',
        },
        { path: 'spec.concurrencyPolicy', meaning: 'Allow (default), Forbid or Replace.' },
        { path: 'spec.startingDeadlineSeconds', meaning: 'How late a missed run may still start.' },
        { path: 'spec.suspend', meaning: 'true stops new Jobs being created.' },
        { path: 'spec.successfulJobsHistoryLimit', meaning: 'Completed Jobs retained. Default 3.' },
        { path: 'spec.failedJobsHistoryLimit', meaning: 'Failed Jobs retained. Default 1.' },
        { path: 'status.lastScheduleTime', meaning: 'When the controller last created a Job.' },
        { path: 'status.active[]', meaning: 'References to Jobs currently running.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The backup that ate the namespace',
    story: [
      'A nightly backup CronJob runs at `0 * * * *` - hourly. Data grows, and the backup starts taking 80 minutes.',
      "With the default `concurrencyPolicy: Allow`, run 2 starts while run 1 is still going. Then run 3 joins them. Within a day there are a dozen concurrent backups competing for I/O, each slower than the last, and the namespace hits its ResourceQuota so *nothing* can be created - including the application's own Pods.",
      'Two changes fixed it: `concurrencyPolicy: Forbid` so a run is skipped rather than stacked, and `activeDeadlineSeconds: 3300` in the jobTemplate so a wedged backup is killed before the next hour.',
      'They also set `startingDeadlineSeconds: 300` so a run missed during a short control-plane restart still happens, but a run missed overnight does not fire at 08:00 into a busy cluster.',
    ],
    code: [
      {
        title: 'Spotting a pile-up',
        language: 'bash',
        code: `kubectl get cronjob backup -n shop
# NAME     SCHEDULE    TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# backup   0 * * * *   <none>     False     7        4m              9d
#                                            ^ seven concurrent runs

kubectl get jobs -n shop -l app=backup
# seven Jobs, all 0/1, all still running

kubectl patch cronjob backup -n shop -p '{"spec":{"concurrencyPolicy":"Forbid"}}'
# cronjob.batch/backup patched`,
        explanation:
          'ACTIVE greater than 1 with `Allow` is the signature of an overlapping schedule. It is visible in a single `kubectl get cronjob`.',
        placeholders: ['backup', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A production-shaped CronJob',
      language: 'yaml',
      code: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
  namespace: shop
spec:
  schedule: "0 2 * * *" # 02:00 every day
  timeZone: "Europe/Dublin" # otherwise interpreted in the controller's zone
  concurrencyPolicy: Forbid # skip a run rather than overlap
  startingDeadlineSeconds: 600 # a run missed by <10 min may still start
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 3600 # a single run may not exceed one hour
      ttlSecondsAfterFinished: 86400
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: registry.example.com/shop/report:1.4.2
              command: ["/app/report", "--period=daily"]
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: db-credentials
                      key: url
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  memory: 512Mi`,
      explanation:
        'Note the nesting depth: CronJob.spec.jobTemplate.spec.template.spec.containers. Getting that wrong is the most common CronJob YAML error, which is why generating it is safer than typing it.',
      placeholders: [
        'nightly-report',
        'shop',
        'registry.example.com/shop/report:1.4.2',
        'db-credentials',
      ],
    },
    {
      title: 'Cron expressions you should recognise instantly',
      language: 'text',
      code: `*/5 * * * *     every 5 minutes
0 * * * *       every hour, on the hour
30 3 * * *      03:30 every day
0 2 * * 0       02:00 every Sunday        (0 = Sunday, 6 = Saturday)
0 9 * * 1-5     09:00 Monday to Friday
0 0 1 * *       midnight on the 1st of every month
15 */6 * * *    at :15 past every 6th hour (00:15, 06:15, 12:15, 18:15)
0 0 * * *       midnight every day        (same as @daily)

Field order:  minute  hour  day-of-month  month  day-of-week
Ranges:       0-59    0-23  1-31          1-12   0-6 (0 = Sunday)`,
      explanation:
        'Kubernetes also accepts the macros @yearly, @monthly, @weekly, @daily and @hourly, but writing the five fields is clearer and is what exam tasks use.',
    },
  ],
  imperative: [
    {
      command:
        'kubectl create cronjob nightly --image=busybox:1.36 --schedule="0 2 * * *" -n shop -- sh -c "echo report"',
      what: 'Creates a CronJob. Quote the schedule so the shell does not expand the asterisks.',
      expected: 'cronjob.batch/nightly created',
      placeholders: ['nightly', 'shop'],
    },
    {
      command:
        'kubectl create cronjob nightly --image=busybox:1.36 --schedule="*/5 * * * *" --dry-run=client -o yaml -n shop -- sh -c "echo hi" > cj.yaml',
      what: 'Generates the correctly nested CronJob manifest to extend.',
      expected: 'A file with spec.jobTemplate.spec.template.spec.containers.',
      placeholders: ['nightly', 'shop'],
    },
    {
      command: 'kubectl get cronjob -n shop',
      what: 'Schedule, suspend state, active count and last schedule time.',
      expected: 'SUSPEND False and a recent LAST SCHEDULE.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl create job run-now --from=cronjob/nightly -n shop',
      what: 'Triggers the scheduled work immediately without waiting or editing the schedule.',
      expected: 'job.batch/run-now created',
      placeholders: ['run-now', 'nightly', 'shop'],
    },
    {
      command: 'kubectl patch cronjob nightly -n shop -p \'{"spec":{"suspend":true}}\'',
      what: 'Suspends a CronJob so no new Jobs are created. Running Jobs are unaffected.',
      expected: 'cronjob.batch/nightly patched',
      placeholders: ['nightly', 'shop'],
    },
    {
      command: 'kubectl get jobs -n shop --sort-by=.metadata.creationTimestamp',
      what: 'Shows the Jobs a CronJob created, oldest first, so you can see the history limits at work.',
      expected: 'At most successfulJobsHistoryLimit completed Jobs.',
      placeholders: ['shop'],
    },
  ],
  declarative: {
    steps: [
      'Generate the skeleton with `kubectl create cronjob ... --dry-run=client -o yaml` so the nesting is right.',
      'Set `schedule`, and `timeZone` if the task names a local time.',
      'Set `concurrencyPolicy` deliberately - `Forbid` or `Replace` for anything that could overrun.',
      'Add Job-level guardrails inside `jobTemplate.spec`: `backoffLimit`, `activeDeadlineSeconds`, `ttlSecondsAfterFinished`.',
      'Apply, then verify with `LAST SCHEDULE` and the created Jobs rather than waiting and hoping.',
    ],
    code: [
      {
        title: 'Verify without waiting for the schedule',
        language: 'bash',
        code: `kubectl apply -f cronjob.yaml

# Do not wait until 02:00 - run the same template now:
kubectl create job verify --from=cronjob/nightly-report
kubectl wait --for=condition=complete job/verify --timeout=300s
kubectl logs job/verify

# Then confirm the schedule itself is registered:
kubectl get cronjob nightly-report -o jsonpath='{.spec.schedule}{" tz="}{.spec.timeZone}{"\\n"}'
# 0 2 * * * tz=Europe/Dublin`,
        placeholders: ['nightly-report'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get cronjob nightly -n shop -o wide',
      what: 'Confirms schedule, timezone, suspend state and last schedule time.',
      expected: 'The schedule you set and SUSPEND False.',
      placeholders: ['nightly', 'shop'],
    },
    {
      command: 'kubectl get cronjob nightly -n shop -o jsonpath=\'{.spec.schedule}{"\\n"}\'',
      what: 'Reads back the exact schedule string - useful when a task specifies it precisely.',
      expected: '0 2 * * *',
      placeholders: ['nightly', 'shop'],
    },
    {
      command: 'kubectl get jobs -n shop -o wide',
      what: 'Each scheduled run appears here as a Job named `<cronjob>-<timestamp>`.',
      expected: 'COMPLETIONS 1/1 for successful runs.',
      placeholders: ['shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe cronjob nightly -n shop',
      what: 'Shows the schedule, the last schedule time, active Jobs and controller events.',
      expected: 'SuccessfulCreate events naming each Job it created.',
      placeholders: ['nightly', 'shop'],
    },
    {
      command:
        'kubectl get cronjob nightly -n shop -o jsonpath=\'{.status.lastScheduleTime}{"\\n"}\'',
      what: 'Answers the first question: has it fired at all? An empty value means it never has.',
      expected: 'An RFC3339 timestamp.',
      placeholders: ['nightly', 'shop'],
    },
    {
      command: 'kubectl logs job/nightly-29123456 -n shop',
      what: 'Once you know which Job ran, read its Pod log for the actual application error.',
      expected: 'The command output.',
      placeholders: ['nightly-29123456', 'shop'],
    },
    {
      command: 'kubectl get cronjob nightly -n shop -o jsonpath=\'{.spec.suspend}{"\\n"}\'',
      what: 'The most embarrassing cause of "my CronJob never runs".',
      expected: 'false',
      placeholders: ['nightly', 'shop'],
    },
  ],
  commonMistakes: [
    'Not quoting the schedule in a shell: `--schedule=*/5 * * * *` gets mangled by glob expansion. Always `--schedule="*/5 * * * *"`.',
    'Getting the nesting wrong. It is `spec.jobTemplate.spec.template.spec.containers` - generate it rather than typing it.',
    'Leaving `concurrencyPolicy: Allow` on a job that can overrun its interval, causing a pile-up.',
    "Assuming local time. Without `spec.timeZone`, the schedule is in the controller's timezone, usually UTC.",
    'Confusing day-of-week numbering. 0 is Sunday, not Monday.',
    'Expecting to-the-second precision. The controller polls, so runs can be up to about a minute late.',
    'Forgetting a suspended CronJob is suspended, and debugging the template instead of checking `spec.suspend`.',
  ],
  examTips: [
    '`kubectl create cronjob <name> --image=<img> --schedule="<cron>" -- <cmd>` is a one-line answer to most CronJob tasks.',
    'Read the schedule requirement carefully: "every 5 minutes" is `*/5 * * * *`, "at 5 past every hour" is `5 * * * *`.',
    'If a task says "the job must not overlap", the answer is `concurrencyPolicy: Forbid`.',
    'If a task says "stop it from running without deleting it", the answer is `suspend: true`.',
    'To prove a CronJob works without waiting, `kubectl create job test --from=cronjob/<name>`.',
  ],
  summary: [
    'CronJob → Job → Pod; diagnose in that order.',
    'Five-field cron, controller timezone unless `spec.timeZone` is set, roughly-on-time not exactly-on-time.',
    '`concurrencyPolicy`: Allow / Forbid / Replace decides overlap behaviour.',
    '`startingDeadlineSeconds` bounds how late a missed run may start; `suspend` pauses creation.',
    'History limits default to 3 successful and 1 failed Job.',
  ],
  practice: [
    {
      id: 'cj-p1',
      level: 'beginner',
      prompt:
        'Write the imperative command for a CronJob `ping` that runs `busybox:1.36` every 5 minutes and echoes "ping".',
      answer:
        'kubectl create cronjob ping --image=busybox:1.36 --schedule="*/5 * * * *" -- sh -c "echo ping"',
      explanation:
        'The quotes around the schedule are essential in a shell. Verify with `kubectl get cronjob ping` and check the SCHEDULE column.',
    },
    {
      id: 'cj-p2',
      level: 'intermediate',
      prompt:
        'A backup CronJob runs hourly but sometimes takes 90 minutes. Which field do you set, to what value, and what is the alternative if the newest run matters more than the oldest?',
      answer:
        '`concurrencyPolicy: Forbid` skips the new run while the previous one is active. If the newest run matters more, use `concurrencyPolicy: Replace`, which terminates the running Job and starts the new one.',
      explanation:
        'Pair either with `activeDeadlineSeconds` in the jobTemplate so a wedged run cannot block indefinitely. `Forbid` is safer for backups (do not interrupt a write); `Replace` suits idempotent sync jobs.',
    },
    {
      id: 'cj-p3',
      level: 'advanced',
      prompt:
        'A CronJob exists, `spec.suspend` is false, but `status.lastScheduleTime` is empty and no Jobs exist. Give three plausible causes and the command to check each.',
      answer:
        "1. The schedule has not come round yet - check `kubectl get cronjob <n> -o jsonpath='{.spec.schedule}'` and compare with the current time in the controller timezone (`date -u`).\n2. The schedule is malformed or in the wrong timezone - `kubectl describe cronjob <n>` shows a parse error event.\n3. The controller could not create the Job (quota, admission, RBAC) - `kubectl describe cronjob <n>` shows FailedCreate events; also check `kubectl describe resourcequota -n <ns>`.",
      explanation:
        'The order matters: confirm it *should* have fired before investigating why it did not. An empty `lastScheduleTime` on a `0 2 * * *` CronJob created at 09:00 is completely normal.',
    },
  ],
  lab: {
    title: 'Schedule, overlap and on-demand runs',
    scenario:
      'You will create a fast-firing CronJob to see real runs within a couple of minutes, observe history limits, trigger a run manually, and demonstrate `Forbid` preventing an overlap.',
    prerequisites: ['A cluster where you can wait two or three minutes'],
    tasks: [
      { instruction: 'Create namespace `cj-lab` and set it as default.' },
      { instruction: 'Create a CronJob `beat` that runs every minute and echoes the date.' },
      { instruction: 'Wait for two runs and list the Jobs it created.' },
      { instruction: 'Read the log of the most recent run.' },
      {
        instruction:
          'Create a second CronJob `slowbeat` that runs every minute, sleeps 150 seconds, and uses concurrencyPolicy Forbid; after three minutes confirm only one Job was ever active.',
      },
      { instruction: 'Trigger `beat` manually with `--from=cronjob/beat`.' },
      { instruction: 'Suspend `beat` and confirm no new Jobs appear.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-4',
        language: 'bash',
        code: `kubectl create namespace cj-lab
kubectl config set-context --current --namespace=cj-lab

kubectl create cronjob beat --image=busybox:1.36 --schedule="* * * * *" -- sh -c 'date; echo beat'

sleep 130
kubectl get cronjob beat
# NAME   SCHEDULE    TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# beat   * * * * *   <none>     False     0        35s             2m

kubectl get jobs --sort-by=.metadata.creationTimestamp
# NAME             STATUS     COMPLETIONS   DURATION   AGE
# beat-29123456    Complete   1/1           3s         95s
# beat-29123457    Complete   1/1           3s         35s

LATEST=$(kubectl get jobs --sort-by=.metadata.creationTimestamp -o name | tail -1)
kubectl logs "$LATEST"
# Wed Sep  3 12:34:00 UTC 2026
# beat`,
      },
      {
        title: 'Step 5 - Forbid prevents overlap',
        language: 'yaml',
        code: `# slowbeat.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: slowbeat
  namespace: cj-lab
spec:
  schedule: "* * * * *" # every minute
  concurrencyPolicy: Forbid # but each run takes 150s, so runs are skipped
  successfulJobsHistoryLimit: 2
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 0
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: slow
              image: busybox:1.36
              command: ["sh", "-c", "echo start; sleep 150; echo end"]`,
      },
      {
        title: 'Step 5b - observe the skipping',
        language: 'bash',
        code: `kubectl apply -f slowbeat.yaml
sleep 180

kubectl get cronjob slowbeat
# ACTIVE is 1, never higher

kubectl get jobs -l batch.kubernetes.io/job-name --no-headers | grep slowbeat | wc -l
# 1 or 2 - far fewer than the 3 schedule ticks that passed

kubectl describe cronjob slowbeat | grep -i 'missed\\|skip\\|Events' -A4
# Events show only SuccessfulCreate for the runs that were allowed to start.`,
      },
      {
        title: 'Steps 6-8 - manual run, suspend, cleanup',
        language: 'bash',
        code: `kubectl create job manual-beat --from=cronjob/beat
kubectl wait --for=condition=complete job/manual-beat --timeout=120s
kubectl logs job/manual-beat

kubectl patch cronjob beat -p '{"spec":{"suspend":true}}'
kubectl get cronjob beat
# SUSPEND   True

BEFORE=$(kubectl get jobs --no-headers | grep -c '^beat-')
sleep 70
AFTER=$(kubectl get jobs --no-headers | grep -c '^beat-')
echo "before=$BEFORE after=$AFTER"    # identical: nothing new was created

kubectl config set-context --current --namespace=default
kubectl delete namespace cj-lab`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get cronjob beat -n cj-lab -o jsonpath=\'{.spec.suspend}{" "}{.status.lastScheduleTime}{"\\n"}\'',
        what: 'Confirms the suspend state and when it last fired.',
        expected: 'true followed by the timestamp of the final run.',
      },
      {
        command: 'kubectl get jobs -n cj-lab --no-headers | wc -l',
        what: 'Confirms history limits are capping the number of retained Jobs.',
        expected: 'A small number (around 3-5), not one per minute elapsed.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace cj-lab',
        what: 'Removes the CronJobs, Jobs and Pods.',
        expected: 'namespace "cj-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['jobs', 'workload-resources'],
  docs: [
    {
      title: 'CronJob',
      url: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/',
    },
  ],
}
