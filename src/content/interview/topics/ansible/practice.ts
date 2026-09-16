import type { InterviewQuestion } from '../../../types'

/** Templates, control flow, error handling and real-world Ansible practice. */
export const ansiblePracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-ans-21',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do Jinja2 templates work in Ansible, and what should you watch out for?',
    probing: 'Templating is where configuration is actually generated, and where subtle bugs live.',
    answer: [
      'The `template` module renders a **Jinja2** file with all the variables and facts available for that host and copies the result to the target. It is the main way configuration files are generated - one template serving every host, with the differences coming from variables.',
      'Jinja2 gives you variable substitution, conditionals, loops, filters and includes. In Ansible the most useful filters are `default()` for a fallback, `to_nice_json` and `to_nice_yaml` for structured output, `join`, and `mandatory` to fail loudly when a required variable is missing.',
      'The things to watch out for: **whitespace control**, because `{%- -%}` versus `{% %}` changes the rendered output and can produce a file with blank lines where a parser does not expect them. **Type coercion** - a variable read from an environment or an inventory file is a string, so `when: enabled` on the string `"false"` is truthy; use `| bool`. And **undefined variables**, which by default render as empty rather than failing, silently producing a broken configuration file.',
      'Two habits make templates much safer: put a **"managed by Ansible, do not edit"** header on every rendered file, and use **`validate`** on the template task so a syntactically invalid configuration fails the task instead of being installed and breaking the service on reload.',
    ],
    code: [
      {
        title: 'A template with defaults, loops and a guard',
        language: 'text',
        code: `# {{ ansible_managed }}
# Managed by Ansible - local edits will be overwritten.

worker_processes {{ nginx_worker_processes | default(ansible_facts.processor_vcpus) }};
worker_connections {{ nginx_worker_connections | default(1024) }};

{% for site in nginx_sites %}
server {
    listen {{ site.port | default(80) }};
    server_name {{ site.name | mandatory }};

    {% if site.ssl | default(false) | bool %}
    ssl_certificate     /etc/ssl/certs/{{ site.name }}.crt;
    ssl_certificate_key /etc/ssl/private/{{ site.name }}.key;
    {% endif %}

    location / {
        proxy_pass http://{{ site.upstream }};
    }
}
{% endfor %}`,
      },
      {
        title: 'Validate before installing',
        language: 'yaml',
        code: `- name: Render nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    owner: root
    group: root
    mode: '0644'
    backup: true                       # keep the previous version
    validate: 'nginx -t -c %s'         # fail the task, not the service
  notify: Reload nginx`,
        explanation:
          '%s is replaced with the temporary rendered file - the real file is only replaced if validation passes.',
      },
    ],
    traps: [
      'Undefined variables rendering as empty strings, producing a subtly broken config.',
      'String `"false"` treated as truthy - always `| bool`.',
      'No `validate`, so a template bug takes the service down on the next reload.',
      'Whitespace control producing output a strict parser rejects.',
    ],
    followUps: [
      'How do you make a missing variable fail loudly?',
      'What does `validate` protect you from?',
    ],
    tags: ['jinja2', 'templates', 'validation', 'configuration'],
  },
  {
    id: 'itv-ans-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle errors and failures in a playbook?',
    probing: 'Control flow when things go wrong, which matters for anything touching production.',
    answer: [
      'By default a failed task stops the play **for that host**, while other hosts continue. Several mechanisms change that.',
      '**`ignore_errors: true`** continues past a failure. It is blunt and usually too blunt - it hides real failures. **`failed_when`** is better: it redefines what counts as failure, so a command whose non-zero exit is expected in some cases can be evaluated properly.',
      '**`block` / `rescue` / `always`** gives you try/catch/finally. The block runs; if anything in it fails, `rescue` runs; `always` runs regardless. This is how you implement a rollback - deploy in the block, restore the previous version in `rescue`.',
      '**`any_errors_fatal: true`** stops the entire play on **all** hosts as soon as one fails, which is what you want for a coordinated operation where partial application is worse than none. **`max_fail_percentage`** is the softer version, tolerating a proportion.',
      'And **`retries` with `until`** handles the genuinely transient case - waiting for a service to come up, retrying a flaky API call - rather than failing on the first attempt.',
      'The judgement to apply: **fail loudly by default**. Every suppression should be deliberate and narrow, because a playbook that reports success while half its tasks silently failed is worse than one that stops.',
    ],
    code: [
      {
        title: 'block/rescue/always as deploy and rollback',
        language: 'yaml',
        code: `- name: Deploy with rollback
  block:
    - name: Deploy the new release
      ansible.builtin.unarchive:
        src: "app-{{ app_version }}.tar.gz"
        dest: /opt/app
        remote_src: true

    - name: Restart the service
      ansible.builtin.service:
        name: app
        state: restarted

    - name: Verify it is healthy
      ansible.builtin.uri:
        url: http://localhost:8080/healthz
        status_code: 200
      retries: 10
      delay: 3

  rescue:
    - name: Roll back to the previous release
      ansible.builtin.command: /opt/app/rollback.sh
    - name: Restart on the old version
      ansible.builtin.service:
        name: app
        state: restarted
    - name: Fail the play so CI knows
      ansible.builtin.fail:
        msg: "Deploy of {{ app_version }} failed health check - rolled back"

  always:
    - name: Always clean up the staging directory
      ansible.builtin.file:
        path: /tmp/deploy-staging
        state: absent`,
      },
      {
        title: 'failed_when rather than ignore_errors',
        language: 'yaml',
        code: `# Too blunt - hides everything
- ansible.builtin.command: /usr/local/bin/check
  ignore_errors: true

# Precise - exit 1 means "not found", which is fine here; anything else is not
- ansible.builtin.command: /usr/local/bin/check
  register: result
  failed_when: result.rc not in [0, 1]
  changed_when: false`,
      },
    ],
    traps: [
      '`ignore_errors: true` as a habit, hiding genuine failures.',
      '`rescue` that does not re-fail, so CI thinks the deploy succeeded.',
      'No `retries` on genuinely transient operations, causing flaky runs.',
      'Forgetting that a failure stops only that host by default, so a partial fleet gets the change.',
    ],
    followUps: [
      'Why should a `rescue` block usually still fail the play?',
      'When would you use `any_errors_fatal`?',
    ],
    tags: ['error handling', 'block rescue', 'rollback', 'production'],
  },
  {
    id: 'itv-ans-23',
    level: 'basic',
    kind: 'open',
    prompt: 'What are ad-hoc commands and when are they useful?',
    probing: 'A part of Ansible people often forget exists.',
    answer: [
      'An ad-hoc command runs a **single module against a set of hosts** without writing a playbook: `ansible web -m ping`, `ansible all -m command -a "uptime"`.',
      'They are genuinely useful for **investigation and one-off operations**. Checking whether a package version is consistent across a fleet, seeing which hosts are reachable, reading a file from fifty machines, or restarting a service everywhere during an incident - all faster than writing a playbook.',
      'They are also how you **test connectivity and escalation** before running anything substantial: `ansible all -m ping` and `ansible all -m command -a id --become` answer "can I reach these and can I escalate" in one step each.',
      'The discipline is that anything you will do **more than once** belongs in a playbook. An ad-hoc command leaves no record, cannot be reviewed, and is not repeatable by anyone else. Using them for changes to production is how you get undocumented configuration.',
      'For read-only investigation, though, they are exactly the right tool, and knowing them well makes incident work considerably faster.',
    ],
    code: [
      {
        title: 'Ad-hoc commands worth knowing',
        language: 'bash',
        code: `# Reachability and escalation
ansible all -m ping
ansible all -m command -a 'id' --become

# Fleet-wide investigation
ansible web -m command -a 'uptime'
ansible all -m package_facts -a 'manager=auto' | grep -A2 nginx
ansible all -m shell -a 'df -h / | tail -1'

# Read a file from every host
ansible db -m slurp -a 'src=/etc/postgresql/16/main/postgresql.conf'

# A one-off change - acceptable during an incident, not as a habit
ansible web -m service -a 'name=nginx state=restarted' --become --limit 'web[0:2]'

# Which hosts would this even target?
ansible web --list-hosts`,
      },
    ],
    traps: [
      'Making production changes ad-hoc and never writing them into a playbook.',
      'Forgetting `--limit` and acting on the whole fleet.',
      'Using `shell` where a module exists, losing idempotence and structured output.',
    ],
    followUps: ['What would you run first before a big playbook run?'],
    tags: ['ad-hoc', 'cli', 'investigation', 'fundamentals'],
  },
  {
    id: 'itv-ans-24',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'Why should you prefer a module over `shell` or `command` wherever possible?',
    probing: 'A core Ansible principle with several concrete reasons.',
    options: [
      {
        id: 'a',
        text: 'Modules are idempotent, report changed accurately, work across platforms, and return structured data - `shell` does none of that',
      },
      { id: 'b', text: 'Modules run faster than shell commands' },
      { id: 'c', text: '`shell` is deprecated and will be removed' },
      { id: 'd', text: 'Modules do not require SSH' },
    ],
    correct: ['a'],
    answer: [
      'A module **checks the current state before acting**, so it is idempotent and reports `changed` accurately. `shell` runs the command every time and always reports `changed`, so you lose the ability to tell whether anything actually happened.',
      'Modules are also **cross-platform** where it makes sense - `package` works with apt, yum, dnf and others, so one task serves several distributions - and they return **structured data** you can act on, rather than text you have to parse.',
      'And modules handle the **edge cases**: file permissions, SELinux contexts, atomic writes, backup files. A `shell` task that writes a file will get some of that wrong.',
      '`shell` and `command` are not deprecated and are sometimes genuinely necessary. When you use them, make them behave properly: `creates`/`removes` so they skip when the work is already done, `changed_when` so the change reporting is honest, and `command` rather than `shell` unless you actually need shell features like pipes or redirection - `command` avoids an entire class of quoting and injection problems.',
    ],
    code: [
      {
        title: 'Module versus shell, for the same job',
        language: 'yaml',
        code: `# Idempotent, cross-platform, accurate change reporting
- ansible.builtin.package:
    name: nginx
    state: present

# Always "changed", distribution-specific, no state checking
- ansible.builtin.shell: apt-get install -y nginx

# When shell really is needed, make it honest
- name: Rebuild the search index
  ansible.builtin.command: /usr/local/bin/reindex --full
  args:
    creates: /var/lib/app/index.lock      # skip if already done
  register: reindex
  changed_when: reindex.rc == 0`,
      },
    ],
    traps: [
      '`shell` where `command` would do, exposing you to quoting and injection issues.',
      '`shell` tasks with no `changed_when`, making every run report changes.',
      'Parsing command output with regex where a module returns structured data.',
    ],
    followUps: ['When is `shell` genuinely necessary rather than `command`?'],
    tags: ['modules', 'shell', 'idempotence', 'best practices'],
  },
  {
    id: 'itv-ans-25',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you use Ansible for application deployment rather than configuration management?',
    probing: "Orchestration, which is a different job from converging a machine's state.",
    answer: [
      'Deployment is an **orchestration** problem: a sequence of steps across several machines, with ordering and verification, rather than "make this machine look like this".',
      'The shape of a deployment playbook: take a host **out of the load balancer**, deploy the new version, **restart or reload**, **verify health**, put it **back in**, then move to the next batch. `serial` controls the batch size and `max_fail_percentage: 0` stops the rollout when a batch fails.',
      'The verification step is the one people skip and the one that matters. Without a health check between batches, a broken release rolls out to the entire fleet successfully - every task succeeded, and the application is down everywhere.',
      '`delegate_to: localhost` is the key idiom: the load balancer calls, DNS updates and API interactions run from the control node while the play targets remote hosts. `run_once: true` is its companion for something that should happen once per play rather than per host - a database migration, for instance.',
      'The honest framing, though, is that Ansible is a reasonable deployment tool for **virtual machines and bare metal**, and a poor one for containers - where the orchestrator already does rolling updates, health-gated rollout and rollback far better. Using Ansible to deploy to Kubernetes is usually a sign the boundary has been drawn in the wrong place.',
    ],
    code: [
      {
        title: 'A rolling deployment with verification',
        language: 'yaml',
        code: `- name: Rolling deploy
  hosts: role_web
  serial: 2
  max_fail_percentage: 0
  become: true

  pre_tasks:
    - name: Run the database migration once, before any host is touched
      ansible.builtin.command: /opt/app/migrate.sh
      run_once: true
      delegate_to: "{{ groups['role_web'][0] }}"

    - name: Drain from the load balancer
      ansible.builtin.uri:
        url: "https://lb.example.com/api/hosts/{{ inventory_hostname }}/drain"
        method: POST
      delegate_to: localhost

    - name: Wait for connections to finish
      ansible.builtin.wait_for:
        port: 8080
        state: drained
        timeout: 60

  tasks:
    - name: Deploy the release
      ansible.builtin.unarchive:
        src: "https://artifacts.example.com/app-{{ app_version }}.tar.gz"
        dest: /opt/app
        remote_src: true
      notify: Restart app

    - name: Apply the restart now, not at the end of the play
      ansible.builtin.meta: flush_handlers

  post_tasks:
    - name: Verify health before moving on
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/healthz"
        status_code: 200
      retries: 15
      delay: 4
      delegate_to: localhost

    - name: Return to the load balancer
      ansible.builtin.uri:
        url: "https://lb.example.com/api/hosts/{{ inventory_hostname }}/enable"
        method: POST
      delegate_to: localhost

  handlers:
    - name: Restart app
      ansible.builtin.service:
        name: app
        state: restarted`,
      },
    ],
    deeper: [
      '`meta: flush_handlers` is essential here - without it the restart happens at the end of the play, after the health check has already run against the old version.',
      '`run_once` with `delegate_to` is how you run a migration exactly once rather than per host.',
      "For containers, the orchestrator does this better. Ansible's place is the infrastructure underneath.",
    ],
    traps: [
      'No health check between batches, so a broken release deploys everywhere.',
      'Handlers not flushed, so verification runs before the restart.',
      'Migrations running from every host simultaneously.',
      'Using Ansible to deploy to Kubernetes instead of using the orchestrator.',
    ],
    followUps: [
      'Why does this need `meta: flush_handlers`?',
      'When would Ansible be the wrong deployment tool?',
    ],
    tags: ['deployment', 'orchestration', 'rolling updates', 'delegate_to', 'advanced'],
  },
  {
    id: 'itv-ans-26',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are collections, and how do you manage dependencies?',
    probing: 'The modern packaging model, which many people still have not adopted.',
    answer: [
      'Since Ansible 2.10, most modules live in **collections** rather than in Ansible itself. A collection bundles modules, plugins, roles and playbooks under a namespace - `amazon.aws`, `community.general`, `kubernetes.core`. The `ansible` package ships a large set; `ansible-core` ships almost none and you install what you need.',
      'Dependencies are declared in **`requirements.yml`** with versions, and installed with `ansible-galaxy collection install -r requirements.yml`. The same file can list role dependencies from Galaxy or from git.',
      'Pinning versions matters for the same reason it does anywhere: a collection updating underneath you can change module behaviour or remove an argument, and you find out in CI or, worse, in production. Pin, and upgrade deliberately.',
      'The **fully qualified collection name** - `ansible.builtin.package` rather than `package` - is worth using consistently. Short names still work through redirection, but the qualified form makes it unambiguous which module is being used, which matters when two collections provide something similarly named.',
      "And install collections into the **project** rather than the user's home directory, so the repository is self-contained and CI gets exactly what a developer has.",
    ],
    code: [
      {
        title: 'requirements.yml with versions pinned',
        language: 'yaml',
        code: `---
collections:
  - name: amazon.aws
    version: ">=8.0.0,<9.0.0"
  - name: community.general
    version: ">=9.0.0,<10.0.0"
  - name: kubernetes.core
    version: ">=5.0.0,<6.0.0"
  - name: community.hashi_vault
    version: ">=6.0.0,<7.0.0"

roles:
  - name: geerlingguy.postgresql
    version: 3.5.2
  - src: https://github.com/acme/ansible-role-monitoring.git
    scm: git
    version: v2.1.0`,
      },
      {
        title: 'Install into the project, and use qualified names',
        language: 'bash',
        code: `ansible-galaxy install -r requirements.yml -p ./collections

# ansible.cfg
# [defaults]
# collections_path = ./collections

# Qualified names remove all ambiguity
# ansible.builtin.package   community.general.pacman   amazon.aws.ec2_instance`,
      },
    ],
    traps: [
      'Collections installed ad-hoc on a laptop and missing in CI.',
      'Unpinned versions, so a collection update changes behaviour without a code change.',
      'Short module names that resolve differently depending on what is installed.',
    ],
    followUps: [
      'Why use fully qualified collection names?',
      'How do you make CI and a developer machine identical?',
    ],
    tags: ['collections', 'galaxy', 'dependencies', 'versioning'],
  },
  {
    id: 'itv-ans-27',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A playbook took down production because it restarted every web server at once. How would you prevent that?',
    probing: 'Learning from an incident - the answer should have layers, not just "use serial".',
    answer: [
      'The immediate cause is that Ansible operates on **all hosts in parallel by default**, so a play targeting the web group restarts every one of them simultaneously. The fix is not one setting but several layers.',
      '**`serial`** turns it into a rolling operation - a batch at a time, so at most that fraction is ever affected. With `max_fail_percentage: 0` so a failure stops the rollout rather than continuing through the fleet.',
      '**A health check between batches**, so "the batch finished" means "the batch is serving traffic", not "the tasks did not error". Without this, `serial` just breaks things more slowly.',
      '**Handlers rather than unconditional restarts**, so a run that changes nothing restarts nothing. That alone would have prevented this if the configuration was already correct.',
      '**`--check --diff` in CI** on every change, and a required review, so a playbook that would restart everything is visible before it runs.',
      '**Environment separation**: the same playbook run against staging first, automatically, with the production run gated on it succeeding.',
      'And the process point: the playbook should have been **run against staging** first. A change that reaches production without having run anywhere else is a process failure as much as a technical one, and adding `serial` without fixing that leaves the next incident to a different cause.',
    ],
    code: [
      {
        title: 'The layered fix',
        language: 'yaml',
        code: `- name: Safe rolling configuration change
  hosts: role_web
  serial: "20%"                   # never more than a fifth at once
  max_fail_percentage: 0          # stop the whole rollout on any failure
  become: true

  tasks:
    - name: Deploy configuration
      ansible.builtin.template:
        src: app.conf.j2
        dest: /etc/app/app.conf
        validate: '/usr/local/bin/app --check-config %s'
      notify: Reload app          # handler: only restarts if this CHANGED

  post_tasks:
    - name: Do not proceed until this batch is genuinely healthy
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/healthz"
        status_code: 200
      retries: 12
      delay: 5
      delegate_to: localhost

  handlers:
    - name: Reload app
      ansible.builtin.service:
        name: app
        state: reloaded           # reload, not restart - no dropped connections`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Layers that each independently prevent this',
        caption:
          'Any one of these would have reduced the blast radius; together they make it very unlikely.',
        nodes: [
          {
            label: 'Run against staging first',
            detail: 'A process control, not a technical one',
            tone: 'accent',
          },
          { label: '--check --diff in CI', detail: 'The restart is visible in review' },
          { label: 'Handlers, not unconditional restarts', detail: 'No change means no restart' },
          {
            label: 'serial + max_fail_percentage',
            detail: 'One batch, then stop on failure',
            tone: 'warning',
          },
          {
            label: 'Health check between batches',
            detail: 'Healthy, not just "no error"',
            tone: 'warning',
          },
          {
            label: 'Reload rather than restart',
            detail: 'No dropped connections',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      '`serial` can take a list - `[1, 5, "25%"]` - to start cautiously with one host, then widen once it is clearly working. That is the canary pattern.',
      'Reload instead of restart, where the service supports it, removes the disruption entirely for configuration changes.',
      '`--limit` during manual runs restricts the blast radius further; requiring it for production runs is a reasonable policy.',
    ],
    traps: [
      'Adding `serial` and stopping there, without a health check or `max_fail_percentage`.',
      'Unconditional restart tasks instead of handlers.',
      'Treating it as a technical failure only, and not fixing the process that let it reach production untested.',
    ],
    followUps: [
      'Why is `serial` alone insufficient?',
      'What does `serial: [1, 5, "25%"]` give you?',
    ],
    tags: ['scenario', 'production', 'serial', 'incident', 'safety', 'advanced'],
  },
  {
    id: 'itv-ans-28',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do conditionals and loops work in Ansible?',
    probing: 'Control flow, including the gotcha about `when` with loops.',
    answer: [
      '**`when`** is a condition evaluated per host; the task is skipped where it is false. The expression is Jinja2 but written **without** the surrounding braces - `when: ansible_facts.os_family == "Debian"`.',
      '**`loop`** repeats a task over a list, with the current value in `item`. It replaced the older `with_items` family, which still works but is no longer the recommended form.',
      'The detail that catches people: when `when` and `loop` are combined, the **condition is evaluated for each item**, not once for the whole task. That is usually what you want, and it surprises people who expect the task to be skipped entirely.',
      '`loop_control` gives you `label` to keep the output readable when looping over large objects - without it, a loop over dictionaries prints the whole structure for every iteration - and `loop_var` to rename `item` when loops are nested or when a role uses `item` for something else.',
      'The other thing worth stating: **prefer a module that accepts a list over a loop**. `package: name: [a, b, c]` is one task and one round trip; looping the same module three times is three. That is one of the largest easy performance wins in Ansible.',
    ],
    code: [
      {
        title: 'Conditionals, loops and readable output',
        language: 'yaml',
        code: `- name: Install the Debian-specific package
  ansible.builtin.package:
    name: apt-transport-https
    state: present
  when: ansible_facts.os_family == "Debian"

- name: Create application users
  ansible.builtin.user:
    name: "{{ item.name }}"
    groups: "{{ item.groups | default([]) }}"
    shell: "{{ item.shell | default('/bin/bash') }}"
  loop: "{{ app_users }}"
  loop_control:
    label: "{{ item.name }}"      # otherwise the whole dict is printed each time
  when: item.enabled | default(true) | bool    # evaluated PER ITEM

- name: Register a result and act on it
  ansible.builtin.command: /usr/local/bin/status
  register: status
  changed_when: false
  failed_when: false

- name: Only act if the previous task said so
  ansible.builtin.service:
    name: app
    state: restarted
  when: status.rc != 0`,
      },
    ],
    traps: [
      'Wrapping a `when` expression in `{{ }}`, which works but produces a warning and reads oddly.',
      'Expecting `when` with `loop` to skip the whole task.',
      'A loop over a module that accepts a list, multiplying round trips.',
      'String `"false"` being truthy without `| bool`.',
    ],
    followUps: [
      'What happens when you combine `when` with `loop`?',
      'Why is `loop_control.label` worth setting?',
    ],
    tags: ['conditionals', 'loops', 'control flow', 'performance'],
  },
  {
    id: 'itv-ans-29',
    level: 'advanced',
    kind: 'open',
    prompt: 'How does Ansible fit into a modern container-based stack?',
    probing: 'Whether you know where Ansible still adds value when the workloads are containers.',
    answer: [
      'Its role shrinks, and being clear about where it still fits is the useful answer.',
      'Where it **still earns its place**: preparing the machines underneath - bootstrapping nodes, installing the container runtime and the kubelet, applying OS hardening, configuring monitoring agents, managing kernel parameters. Anything below the orchestrator is still a fleet of Linux machines and Ansible is good at those.',
      "**Network devices and appliances** - switches, firewalls, load balancers - where an agent cannot be installed and Ansible's agentless model is the only practical option.",
      '**Orchestration across systems**: a runbook that touches a cloud API, a database, a DNS provider and a Kubernetes cluster in sequence. Ansible is a reasonable glue layer for that kind of multi-system procedure.',
      '**Legacy systems** that are not being containerised and still need managing.',
      'Where it **should not** be used: deploying workloads to Kubernetes. The orchestrator already does rolling updates, health gating and rollback better than a playbook can, and GitOps does continuous reconciliation which Ansible does not do at all. Using Ansible to `kubectl apply` is a common pattern and usually a step backwards.',
      "And **immutable infrastructure** reduces the configuration management role further: if machines are built from an image and replaced rather than configured, Ansible's job moves to **building the image** (often alongside Packer) rather than converging running machines.",
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Is Ansible the right tool here?',
        caption: 'It remains strong below the orchestrator and weak above it.',
        question: 'What are you trying to manage?',
        branches: [
          {
            condition: 'Node OS, runtime, agents, hardening',
            result: 'Ansible',
            detail: 'Still a fleet of Linux machines',
            tone: 'success',
          },
          {
            condition: 'Network devices and appliances',
            result: 'Ansible',
            detail: 'Agentless is the only option',
            tone: 'success',
          },
          {
            condition: 'Kubernetes workloads',
            result: 'GitOps, not Ansible',
            detail: 'Continuous reconciliation, health-gated rollout',
            tone: 'danger',
          },
          {
            condition: 'Building machine images',
            result: 'Packer, with Ansible as the provisioner',
            detail: 'Configure once at build, not repeatedly at runtime',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'Ansible as a Packer provisioner is a good pairing - you reuse the roles you already have, and the result is an immutable image rather than a machine that drifts.',
      'The `kubernetes.core` collection exists and works, but competes with tools designed for the job. Use it for one-off operations, not for deployment.',
      'Where Ansible is used below Kubernetes, it should still be run from CI rather than laptops, and tested with Molecule like any other code.',
    ],
    traps: [
      'Using Ansible to deploy to Kubernetes and losing reconciliation and health gating.',
      'Continuing to converge running machines when the estate has moved to immutable images.',
      'Assuming containers make Ansible irrelevant - the nodes underneath still exist.',
    ],
    followUps: [
      'Why is GitOps better than Ansible for Kubernetes workloads?',
      "How does immutable infrastructure change Ansible's role?",
    ],
    tags: ['containers', 'kubernetes', 'packer', 'boundaries', 'advanced'],
  },
  {
    id: 'itv-ans-30',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `--check` mode do, and what is its main limitation?',
    probing: 'Dry-run behaviour and knowing it is imperfect.',
    options: [
      {
        id: 'a',
        text: 'Predicts what would change without changing anything - but tasks depending on an earlier task’s result can behave differently or fail',
      },
      { id: 'b', text: 'Validates the YAML syntax only' },
      { id: 'c', text: 'Runs the playbook and rolls back at the end' },
      { id: 'd', text: 'Runs only the first task of each play' },
    ],
    correct: ['a'],
    answer: [
      '`--check` runs the playbook in **dry-run** mode: modules report whether they *would* change something without actually doing it. Combined with `--diff` it shows the actual content difference for files and templates, which makes it genuinely useful for review.',
      'The limitation is **dependent tasks**. If task one would create a directory and task two writes a file into it, then in check mode the directory does not exist and task two either fails or reports something misleading. The same applies to anything reading a value produced by an earlier task.',
      'A related gap: `command` and `shell` tasks are **skipped** in check mode by default, because Ansible cannot know whether they are safe. So a playbook whose real work happens in shell tasks tells you very little in check mode. `check_mode: false` on a read-only command makes it run anyway, which restores some of the value.',
      'So `--check` is a useful safety net and not a guarantee. It catches a lot; it does not prove the playbook will work.',
    ],
    code: [
      {
        title: 'Check mode, and letting a read-only command run in it',
        language: 'yaml',
        code: `- name: Gather the current version - safe to run even in check mode
  ansible.builtin.command: /usr/local/bin/app --version
  register: current_version
  check_mode: false           # run this even with --check
  changed_when: false

- name: Deploy the new version
  ansible.builtin.unarchive:
    src: "app-{{ app_version }}.tar.gz"
    dest: /opt/app
  when: current_version.stdout != app_version`,
      },
    ],
    traps: [
      'Treating a clean `--check` run as proof the playbook is safe.',
      'Shell-heavy playbooks where check mode reports almost nothing.',
      'Forgetting `--diff`, which is where most of the value is.',
    ],
    followUps: ['Why are `command` tasks skipped in check mode?'],
    tags: ['check mode', 'dry run', 'safety', 'fundamentals'],
  },
  {
    id: 'itv-ans-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you manage users, SSH keys and access across a fleet?',
    probing: 'A classic Ansible use case with real security consequences.',
    answer: [
      'The principle is that **access should be declarative and revocable from one place**. A user removed from the inventory should be removed from every machine on the next run - which means the playbook has to manage both presence and absence.',
      'The pattern: a list of users in group variables with their public keys and groups; a task creating users with `state: present`; and crucially a task **removing** users marked `state: absent`, so offboarding is a one-line change rather than an audit. `authorized_key` with `exclusive: true` ensures the keys on the machine are exactly the ones declared - a key added manually is removed on the next run.',
      '**Sudo access** should be granted through group membership and a managed sudoers file, with `validate: visudo -cf %s` on the template. A broken sudoers file locks everyone out of a machine, and the validation is what stops that reaching production.',
      "The honest caveat: for a fleet of any size, **centralised identity** - LDAP, an SSO provider with SSH certificates, or a cloud provider's session manager - is better than distributing keys with Ansible. Key distribution scales poorly and revocation is only as fast as your next playbook run. Ansible managing users is a reasonable answer for a small fleet and a stopgap for a large one.",
    ],
    code: [
      {
        title: 'Declarative users, with removal',
        language: 'yaml',
        code: `# group_vars/all/users.yml
fleet_users:
  - name: alice
    state: present
    groups: [sudo, developers]
    keys:
      - "ssh-ed25519 AAAAC3... alice@laptop"
  - name: bob
    state: absent            # offboarded - removed on the next run

---
- name: Manage users
  ansible.builtin.user:
    name: "{{ item.name }}"
    state: "{{ item.state }}"
    groups: "{{ item.groups | default([]) }}"
    append: false            # groups are exactly what is declared
    remove: "{{ item.state == 'absent' }}"
    shell: /bin/bash
  loop: "{{ fleet_users }}"
  loop_control: { label: "{{ item.name }}" }

- name: Manage authorized keys
  ansible.posix.authorized_key:
    user: "{{ item.name }}"
    key: "{{ item.keys | join('\\n') }}"
    exclusive: true          # removes any key not in this list
    state: present
  loop: "{{ fleet_users }}"
  loop_control: { label: "{{ item.name }}" }
  when: item.state == 'present'`,
      },
      {
        title: 'Sudoers, validated before installing',
        language: 'yaml',
        code: `- name: Deploy sudoers rule
  ansible.builtin.template:
    src: sudoers-developers.j2
    dest: /etc/sudoers.d/developers
    owner: root
    group: root
    mode: '0440'
    validate: 'visudo -cf %s'     # a broken sudoers locks everyone out
  become: true`,
      },
    ],
    traps: [
      'Only adding users and never removing them, so offboarded staff keep access.',
      '`exclusive: false` on authorized keys, so a manually added key persists forever.',
      'No `validate` on sudoers, risking a machine nobody can escalate on.',
      '`append: true` on groups, so removing someone from a group has no effect.',
    ],
    followUps: [
      'How fast can you revoke access with this approach?',
      'What would you use instead at a thousand machines?',
    ],
    tags: ['users', 'ssh keys', 'security', 'access management'],
  },
  {
    id: 'itv-ans-32',
    level: 'advanced',
    kind: 'multi',
    prompt: 'Which of these belong in a well-run Ansible setup? Select all that apply.',
    probing: 'Operational maturity across several dimensions.',
    options: [
      { id: 'a', text: 'Playbooks and roles in version control, run from CI rather than laptops' },
      {
        id: 'b',
        text: 'ansible-lint and Molecule in the pipeline, including an idempotence check',
      },
      {
        id: 'c',
        text: 'Dynamic inventory from the cloud provider, with tagging as the grouping mechanism',
      },
      { id: 'd', text: 'Secrets in plain text in group_vars, since the repository is private' },
      { id: 'e', text: 'Collections and roles pinned in requirements.yml' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Plain-text secrets in a private repository is the wrong one. A private repository is not an access control for secrets - everyone with read access has them, they are in every clone and every CI checkout, and the repository may not stay private. Vault them, or fetch them from a real secret store at runtime.',
      '**Version control and CI execution** is the foundation: playbooks run from laptops have no audit trail, no review, and no guarantee that two people run the same thing.',
      '**Lint and Molecule with an idempotence check** catches the most common real bugs - roles that report changes on every run, and roles that only work on the operating system the author used.',
      '**Dynamic inventory with tag-based grouping** keeps the inventory correct as instances come and go, which a static file cannot do in a cloud environment.',
      '**Pinned requirements** make a run reproducible. Without them, a collection update changes behaviour with no change to your code.',
      'I would add: `ansible.cfg` committed so everyone shares settings, `--check --diff` on pull requests, and `serial` plus health checks on anything touching production.',
    ],
    traps: [
      'A private repository treated as a secret store.',
      'Playbooks run from individual laptops with no record.',
      'Unpinned collections producing unreproducible runs.',
    ],
    followUps: ['Why is a private repository not sufficient for secrets?'],
    tags: ['best practices', 'operations', 'security', 'ci', 'advanced'],
  },
  {
    id: 'itv-ans-33',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is `delegate_to` and when would you use it?',
    probing: 'A specific and very useful idiom.',
    answer: [
      "`delegate_to` runs a task on a **different host** from the one currently being processed, while keeping all of that host's variables and facts in scope. `delegate_to: localhost` is the most common form - run this on the control node, for the host we are currently working on.",
      "The classic uses are things that are **about** a host but must happen **elsewhere**: taking that host out of a load balancer, updating a DNS record, creating a monitoring silence, calling a cloud API, or checking the host's health from outside rather than from the host itself.",
      'That last one matters: a health check run **on** the host only proves the process is listening locally. Run from the control node, it proves the host is reachable and serving - which is what you actually want to know before putting it back into rotation.',
      '`run_once: true` is its companion: run this task exactly once for the whole play rather than per host. Combined with `delegate_to`, it is how you run a database migration once before a rolling deployment touches any host.',
      'The variable to know is `ansible_play_hosts`, which gives the full list of hosts in the play - useful in a delegated task that needs to act on the group rather than on one member.',
    ],
    code: [
      {
        title: 'The common delegation patterns',
        language: 'yaml',
        code: `# Act on the load balancer, from the control node, about THIS host
- name: Drain from the load balancer
  ansible.builtin.uri:
    url: "https://lb/api/hosts/{{ inventory_hostname }}/drain"
    method: POST
  delegate_to: localhost

# Check health from OUTSIDE the host, which is the meaningful test
- name: Verify the host serves traffic
  ansible.builtin.uri:
    url: "http://{{ inventory_hostname }}:8080/healthz"
    status_code: 200
  retries: 10
  delay: 3
  delegate_to: localhost

# Once for the whole play, on a specific host
- name: Run the database migration
  ansible.builtin.command: /opt/app/migrate.sh
  run_once: true
  delegate_to: "{{ groups['db_primary'][0] }}"

# Gather facts from a host we are not targeting
- name: Read the database version
  ansible.builtin.command: psql --version
  delegate_to: "{{ groups['db'][0] }}"
  register: db_version
  changed_when: false`,
      },
    ],
    traps: [
      'Health checking from the host itself, which does not prove it is reachable.',
      'Forgetting `run_once`, so a delegated task runs once per host in the play - hammering an API.',
      "Assuming `delegate_to: localhost` changes which variables are in scope. It does not - you still have the original host's facts.",
    ],
    followUps: [
      'Why check health from the control node rather than on the host?',
      'What does `run_once` combined with `delegate_to` give you?',
    ],
    tags: ['delegate_to', 'run_once', 'orchestration', 'patterns'],
  },
  {
    id: 'itv-ans-34',
    level: 'basic',
    kind: 'open',
    prompt: 'What is a playbook, and what are its main parts?',
    probing: 'The most basic structural question, answered clearly.',
    answer: [
      'A playbook is a YAML file containing one or more **plays**. Each play maps a set of **hosts** to a set of **tasks**, and a playbook runs its plays in order.',
      'The parts of a play: **`hosts`** selects which inventory hosts or groups it applies to. **`become`** controls privilege escalation. **`vars`** sets variables for the play. **`pre_tasks`**, **`roles`**, **`tasks`** and **`post_tasks`** are the work, executed in that order. **`handlers`** are tasks that run only when notified.',
      'Each **task** calls one module with arguments, and should have a **`name`** describing what it does - the name is what appears in the output, and an unnamed task shows only the module, which makes a failure hard to locate.',
      'The execution model to understand is that Ansible runs **each task across all hosts before moving to the next task** - not the whole playbook per host. That is why a failure on one host leaves the others at the same point, and why `serial` exists to change it.',
    ],
    code: [
      {
        title: 'A playbook with each part labelled',
        language: 'yaml',
        code: `- name: Configure web servers            # the play
  hosts: role_web                        # who it applies to
  become: true                           # escalate to root
  vars:
    http_port: 8080

  pre_tasks:                             # before roles
    - name: Update the package cache
      ansible.builtin.apt:
        update_cache: true
        cache_valid_time: 3600
      when: ansible_facts.os_family == 'Debian'

  roles:                                 # reusable units
    - common
    - nginx

  tasks:                                 # after roles
    - name: Open the firewall port
      ansible.posix.firewalld:
        port: "{{ http_port }}/tcp"
        permanent: true
        state: enabled
      notify: Reload firewall

  post_tasks:                            # last
    - name: Verify the service responds
      ansible.builtin.uri:
        url: "http://localhost:{{ http_port }}/healthz"

  handlers:
    - name: Reload firewall
      ansible.builtin.service:
        name: firewalld
        state: reloaded`,
      },
    ],
    traps: [
      'Tasks without names, making failures hard to locate in the output.',
      'Expecting the playbook to complete on one host before starting the next.',
      '`become: true` at play level when only one task needs it.',
    ],
    followUps: ['In what order do `pre_tasks`, `roles` and `tasks` run?'],
    tags: ['playbooks', 'plays', 'structure', 'fundamentals'],
  },
  {
    id: 'itv-ans-35',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you manage a fleet of 5,000 servers with Ansible?',
    probing: 'Scale. The answer should recognise that plain ansible-playbook stops being enough.',
    answer: [
      'At that scale the questions change from "how do I write this playbook" to **execution, scheduling, and who is allowed to run what**.',
      '**Execution**: a single control node running `ansible-playbook` against 5,000 hosts, even at 100 forks, is slow and fragile - one interrupted run leaves an unknown fraction converged. The answer is either a **control plane** - AWX or Ansible Automation Platform - which gives scheduling, job history, concurrency control, RBAC and credential management, or **sharding** runs across several control nodes by inventory slice.',
      '**Inventory** must be dynamic and sourced from the truth - the cloud provider or a CMDB - with grouping derived from tags. A static inventory at this scale is wrong within hours.',
      '**Performance**: high forks, pipelining, SSH multiplexing, fact caching in Redis, and `gather_facts: false` wherever possible. Without fact caching, fact gathering alone can dominate the runtime.',
      '**Convergence**: because Ansible is push-based, drift persists between runs. At this scale that matters, so I would run a **regular scheduled convergence** - nightly, in batches - and alert on hosts reporting changes, since a host that keeps drifting is telling you something.',
      '**Blast radius**: `serial` everywhere, batched by failure domain rather than arbitrarily, with health checks between batches. A mistake applied to 5,000 machines in parallel is an outage; applied 200 at a time with verification, it is a stopped rollout.',
      'And honestly: at 5,000 machines I would ask whether **immutable infrastructure** is a better fit - build images with Packer using these same roles, and replace machines rather than converging them. Ansible then runs at image build time against one host, which removes the scale problem entirely.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Shape of a large Ansible deployment',
        caption:
          'The control plane is what makes scheduling, RBAC and job history tractable at this size.',
        root: {
          label: 'Automation platform',
          children: [
            {
              label: 'Control plane (AWX / AAP)',
              detail: 'Scheduling, RBAC, credentials, job history',
              tone: 'accent',
              children: [
                { label: 'Execution nodes', detail: 'Sharded by inventory slice', tone: 'success' },
              ],
            },
            {
              label: 'Dynamic inventory',
              detail: 'Cloud API or CMDB, grouped by tags',
              tone: 'warning',
            },
            {
              label: 'Fact cache (Redis)',
              detail: 'Avoids re-gathering across thousands of hosts',
              tone: 'muted',
            },
            {
              label: 'Git: playbooks, roles, requirements',
              detail: 'Versioned, linted, Molecule-tested',
              tone: 'success',
            },
          ],
        },
      },
    ],
    deeper: [
      'AWX gives you job history and RBAC, which at this scale is as much about knowing what was run and by whom as about running it.',
      'Sharding by failure domain rather than arbitrarily means a bad batch affects one availability zone rather than a random slice of everything.',
      'A host that reports changes on every scheduled convergence is drifting for a reason - that is a useful signal, not noise.',
      'Immutable images built with the same roles is often the better destination, with Ansible converging one build host instead of five thousand live ones.',
    ],
    traps: [
      'One control node and one enormous run, which fails partway and leaves an unknown state.',
      'Static inventory.',
      'No fact caching, so gathering dominates the runtime.',
      'Ignoring that push-based means drift between runs at a scale where drift matters.',
    ],
    followUps: [
      'How would you handle a run that fails halfway through 5,000 hosts?',
      'Would immutable infrastructure be a better answer here?',
    ],
    tags: ['scale', 'awx', 'performance', 'architecture', 'advanced'],
  },
]
