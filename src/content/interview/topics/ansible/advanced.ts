import type { InterviewQuestion } from '../../../types'

/** The remaining Ansible ground: modules, filters, Windows, networking and design. */
export const ansibleAdvancedQuestions: InterviewQuestion[] = [
  {
    id: 'itv-ans-36',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are the modules you use most, and what do they replace?',
    probing: 'Practical module fluency - the answer reveals how much real work you have done.',
    answer: [
      'The ones that come up constantly: **`package`** (or `apt`/`yum` where you need distribution-specific behaviour), **`service`** and **`systemd`**, **`file`** for paths, permissions and ownership, **`copy`** for static files, **`template`** for anything with variables in it, **`lineinfile`** and **`blockinfile`** for editing files you do not own, **`user`** and **`group`**, **`git`**, **`unarchive`**, **`uri`** for HTTP calls, and **`wait_for`** for waiting on ports and files.',
      'Each replaces a shell command and adds state checking. `file: state=directory mode=0755` replaces `mkdir -p && chmod`, and unlike the shell version it reports accurately whether anything changed and gets ownership and SELinux context right.',
      '`lineinfile` deserves a specific caution. It is for making a small edit to a file that something else owns - a single setting in `/etc/ssh/sshd_config`. It is **not** a good way to build a configuration file: a sequence of `lineinfile` tasks is fragile, order-dependent and hard to reason about. If you own the file, use `template` and render the whole thing.',
      '`uri` is underrated - it is how you call APIs from a playbook, check health endpoints, and interact with load balancers, usually with `delegate_to: localhost`.',
    ],
    code: [
      {
        title: 'Modules doing what shell commands would',
        language: 'yaml',
        code: `- ansible.builtin.file:
    path: /opt/app/releases
    state: directory
    owner: app
    group: app
    mode: '0755'

- ansible.builtin.systemd:
    name: app
    state: started
    enabled: true
    daemon_reload: true

# A single setting in a file we do not own - correct use of lineinfile
- ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^#?PermitRootLogin'
    line: 'PermitRootLogin no'
    validate: '/usr/sbin/sshd -t -f %s'
  notify: Restart sshd

- ansible.builtin.wait_for:
    port: 5432
    host: "{{ db_host }}"
    timeout: 60
    delay: 5`,
      },
    ],
    traps: [
      'Building a whole config file out of `lineinfile` tasks.',
      '`lineinfile` without a `regexp`, appending a duplicate line on every run.',
      'No `validate` on `sshd_config`, risking a machine you cannot log into.',
    ],
    followUps: ['When is `lineinfile` the wrong tool?'],
    tags: ['modules', 'lineinfile', 'template', 'practical'],
  },
  {
    id: 'itv-ans-37',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are Jinja2 filters and which are worth knowing?',
    probing: 'Data manipulation in playbooks.',
    answer: [
      'Filters transform values inside a Jinja2 expression - `{{ value | filter }}`. Ansible ships the standard Jinja2 set plus a substantial number of its own.',
      'The ones I reach for constantly: **`default(x)`** for a fallback, and `default(x, true)` which also substitutes for empty strings. **`bool`** to coerce a string to a real boolean, which matters because `"false"` is truthy otherwise. **`mandatory`** to fail loudly when a required variable is missing rather than rendering empty.',
      'For collections: **`map`**, **`select`**, **`reject`**, **`selectattr`**, **`rejectattr`** for filtering lists of dictionaries; **`join`**, **`unique`**, **`flatten`**, **`difference`**, **`union`**.',
      'For output: **`to_nice_json`** and **`to_nice_yaml`** for readable structured output in templates; **`b64encode`** and **`b64decode`**; **`regex_replace`** and **`regex_search`**.',
      'And **`combine`**, which merges dictionaries - the standard way to layer a default configuration dictionary with per-environment overrides, with `recursive=true` when the structure is nested.',
    ],
    code: [
      {
        title: 'Filters doing real work',
        language: 'yaml',
        code: `- name: Layer defaults with environment overrides
  ansible.builtin.set_fact:
    app_config: "{{ app_defaults | combine(app_env_overrides, recursive=true) }}"

- name: Only the enabled services, as a comma list
  ansible.builtin.debug:
    msg: "{{ services | selectattr('enabled') | map(attribute='name') | join(', ') }}"

- name: Fail clearly if a required variable is missing
  ansible.builtin.assert:
    that:
      - app_version is defined
      - app_version | length > 0
    fail_msg: "app_version must be set"

- name: Coerce a string to a boolean properly
  ansible.builtin.service:
    name: app
    enabled: "{{ enable_at_boot | default('false') | bool }}"`,
      },
    ],
    traps: [
      'Forgetting `| bool`, so the string `"false"` is truthy.',
      '`default()` hiding a genuinely missing required variable - use `mandatory` where it matters.',
      'Long filter chains nobody can read; an intermediate `set_fact` is clearer.',
    ],
    followUps: ['Why does `"false"` behave unexpectedly without `| bool`?'],
    tags: ['jinja2', 'filters', 'data', 'templates'],
  },
  {
    id: 'itv-ans-38',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you write a custom Ansible module, and when is it justified?',
    probing: 'Extensibility, and knowing when not to.',
    answer: [
      'A module is a program - usually Python - that receives JSON arguments, does something, and prints a JSON result including whether it **changed** anything. Ansible ships `AnsibleModule` which handles argument parsing, validation, check mode and the result format.',
      'The requirements for a good module: **idempotence** - check the current state and only act if needed; **check mode support**, so `--check` reports what would happen without doing it; **accurate `changed`** reporting; and **clear failure messages**.',
      'When it is justified: you interact with an internal system that has no module, you do it in many playbooks, and the alternative is the same fragile `shell` plus `changed_when` pasted everywhere. Wrapping that in a module makes it idempotent once rather than never.',
      'When it is **not** justified - which is most of the time: a module already exists, often in `community.general` which is enormous. Or the task is a one-off, where a well-guarded `command` with `creates` and `changed_when` is perfectly adequate and much less to maintain.',
      'The middle ground worth knowing is a **filter or lookup plugin**, which is far less work than a module and often what people actually need - a custom filter to transform data, or a lookup to read from an internal source.',
    ],
    code: [
      {
        title: 'A minimal idempotent module',
        language: 'python',
        code: `#!/usr/bin/python
from ansible.module_utils.basic import AnsibleModule


def main():
    module = AnsibleModule(
        argument_spec=dict(
            name=dict(type="str", required=True),
            state=dict(type="str", default="present", choices=["present", "absent"]),
        ),
        supports_check_mode=True,          # so --check works properly
    )

    name = module.params["name"]
    want_present = module.params["state"] == "present"

    # 1. Read the CURRENT state - this is what makes it idempotent
    exists = internal_api.exists(name)

    # 2. Nothing to do?
    if exists == want_present:
        module.exit_json(changed=False, name=name)

    # 3. Check mode: report what WOULD happen, do nothing
    if module.check_mode:
        module.exit_json(changed=True, name=name)

    # 4. Act
    try:
        internal_api.create(name) if want_present else internal_api.delete(name)
    except Exception as exc:
        module.fail_json(msg="failed to update %s: %s" % (name, exc))

    module.exit_json(changed=True, name=name)


if __name__ == "__main__":
    main()`,
      },
    ],
    traps: [
      'A module that acts first and reports `changed=True` unconditionally - no better than a shell task.',
      'No check mode support, so `--check` makes real changes.',
      'Writing a module when `community.general` already has one.',
      'Modules maintained by one person who then leaves.',
    ],
    followUps: [
      'What makes a module idempotent?',
      'When would a filter plugin be a better answer than a module?',
    ],
    tags: ['custom modules', 'python', 'extensibility', 'advanced'],
  },
  {
    id: 'itv-ans-39',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `gather_facts: false` do, and when would you use it?',
    probing: 'Performance and a common gotcha.',
    options: [
      {
        id: 'a',
        text: 'Skips the fact-gathering step, making the play start faster - but `ansible_facts` variables are then unavailable',
      },
      { id: 'b', text: 'Disables logging for the play' },
      { id: 'c', text: 'Prevents variables from being read from the inventory' },
      { id: 'd', text: 'Runs the play without connecting to hosts' },
    ],
    correct: ['a'],
    answer: [
      'Fact gathering runs the `setup` module on every host at the start of a play, collecting a large amount of system information. It is genuinely slow - on a large fleet it can be a substantial share of the total runtime.',
      '`gather_facts: false` skips it, which is right for plays that do not need any `ansible_*` variables - a play that only deploys a file, restarts a service, or runs a command.',
      'The gotcha is that facts are used more often than people realise, frequently by a **role** rather than by the playbook author. A play with `gather_facts: false` that applies a role branching on `ansible_facts.os_family` fails with an undefined variable, and the cause is not obvious from the error.',
      'The middle ground is **`gather_subset`** to collect only what you need (`network` and `hardware` rather than everything), and **fact caching** so facts are gathered once and reused across runs. `gathering = smart` in `ansible.cfg` gathers only when there is nothing cached.',
    ],
    code: [
      {
        title: 'Skipping, subsetting, and gathering on demand',
        language: 'yaml',
        code: `# Nothing here needs facts
- name: Restart a service
  hosts: role_web
  gather_facts: false
  tasks:
    - ansible.builtin.service:
        name: app
        state: restarted

# Only the subsets that are actually used
- name: Configure networking
  hosts: all
  gather_facts: true
  gather_subset: ['!all', 'network']

# Or gather explicitly, partway through a play
- ansible.builtin.setup:
    gather_subset: ['hardware']`,
      },
    ],
    traps: [
      '`gather_facts: false` on a play whose roles use facts, producing undefined-variable errors.',
      'Full fact gathering on every play across hundreds of hosts.',
      'A stale fact cache making decisions on out-of-date information.',
    ],
    followUps: ['How would you get most of the speedup without losing facts?'],
    tags: ['facts', 'performance', 'gather_facts', 'fundamentals'],
  },
  {
    id: 'itv-ans-40',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you manage Windows hosts with Ansible?',
    probing: 'Cross-platform coverage, which comes up in mixed estates.',
    answer: [
      'Ansible manages Windows over **WinRM** (or SSH on recent versions) rather than plain SSH, and runs **PowerShell** modules rather than Python ones. The control node still has to be Linux or macOS - Windows is a managed node, not a control node.',
      'The modules are a separate set with a `win_` prefix in `ansible.windows` and `community.windows`: `win_package`, `win_service`, `win_feature`, `win_copy`, `win_template`, `win_updates`, `win_regedit`, `win_domain_membership`. They mirror the Linux modules conceptually but are not interchangeable - a playbook targeting both operating systems needs branching.',
      'The setup work is on the Windows side: WinRM has to be configured and listening, with a transport and authentication method chosen. **NTLM** is common inside a domain, **Kerberos** is better where available and required for delegation, and **CredSSP** exists for the double-hop problem but has real security implications.',
      'The thing people hit first is **authentication and the double-hop problem**: a WinRM session cannot by default use its credentials to authenticate onward to a third machine, so a task accessing a network share fails in a way that looks like a permissions bug. Kerberos with delegation, or CredSSP, is the answer.',
      '`win_updates` is genuinely useful - patching a Windows fleet declaratively, with reboot handling, is one of the clearer wins.',
    ],
    code: [
      {
        title: 'Windows inventory and a playbook',
        language: 'yaml',
        code: `# inventory
windows:
  hosts:
    win1.example.com:
  vars:
    ansible_connection: winrm
    ansible_winrm_transport: kerberos
    ansible_port: 5986
    ansible_winrm_server_cert_validation: validate

---
- name: Configure Windows servers
  hosts: windows
  gather_facts: true
  tasks:
    - name: Install IIS
      ansible.windows.win_feature:
        name: Web-Server
        include_management_tools: true
      register: iis

    - name: Reboot if the feature installation needs it
      ansible.windows.win_reboot:
      when: iis.reboot_required

    - name: Apply security updates
      ansible.windows.win_updates:
        category_names: [SecurityUpdates, CriticalUpdates]
        reboot: true`,
      },
    ],
    traps: [
      'Expecting Linux modules to work - `service` does not, `win_service` does.',
      'Disabling certificate validation to make WinRM connect, leaving the transport unauthenticated.',
      'The double-hop problem misdiagnosed as a permissions issue.',
      'Trying to use Windows as a control node.',
    ],
    followUps: ['What is the double-hop problem and how do you solve it?'],
    tags: ['windows', 'winrm', 'cross-platform', 'kerberos'],
  },
  {
    id: 'itv-ans-41',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you use Ansible with network devices?',
    probing: 'A domain where agentless is not just convenient but necessary.',
    answer: [
      "Network devices - switches, routers, firewalls - usually cannot run an agent, and often cannot run Python at all. Ansible's agentless model is what makes it the dominant tool here.",
      'The connection plugins differ from servers: **`network_cli`** for SSH-based CLI interaction, **`httpapi`** for REST-based devices, and **`netconf`** for NETCONF/YANG. The modules live in vendor collections - `cisco.ios`, `arista.eos`, `juniper.junos`, `fortinet.fortios` - and run **on the control node**, sending commands to the device rather than executing anything on it.',
      "The high-value patterns: **configuration backup** on a schedule, so every device's running configuration is in git and a change is visible as a diff. **Compliance checking** - assert that every device has the expected NTP servers, SNMP settings and ACLs. And **bulk change** - applying a new VLAN or ACL across a hundred switches consistently.",
      'The safety practices matter more here than almost anywhere else, because a bad change to a core switch can disconnect you from the device you are configuring. **`--check`** first, **`diff`** mode to see exactly what would change, and where the platform supports it, a **commit confirmed** or rollback timer so a change that breaks connectivity is reverted automatically.',
      '**`gather_facts: false`** is usually required, because standard fact gathering assumes a POSIX host with Python.',
    ],
    code: [
      {
        title: 'Backup and compliance across a fleet of switches',
        language: 'yaml',
        code: `- name: Network configuration management
  hosts: switches
  gather_facts: false                    # no Python on the device
  connection: ansible.netcommon.network_cli
  vars:
    ansible_network_os: cisco.ios.ios

  tasks:
    - name: Back up the running configuration
      cisco.ios.ios_config:
        backup: true
        backup_options:
          dir_path: "./backups/{{ inventory_hostname }}"
          filename: "{{ ansible_date_time.date }}.cfg"

    - name: Ensure NTP servers are correct everywhere
      cisco.ios.ios_ntp_global:
        config:
          servers:
            - server: 10.0.0.10
            - server: 10.0.0.11
        state: replaced
      register: ntp

    - name: Report any device that was non-compliant
      ansible.builtin.debug:
        msg: "{{ inventory_hostname }} NTP configuration corrected"
      when: ntp.changed`,
      },
    ],
    traps: [
      'Fact gathering enabled, which fails on devices with no Python.',
      'Applying a change that breaks your own management connection, with no rollback timer.',
      'Treating network modules as idempotent by default - some are, some are not; read the module.',
      'No backup before a change.',
    ],
    followUps: [
      'How do you protect against locking yourself out of a switch?',
      'Why does network fact gathering behave differently?',
    ],
    tags: ['network automation', 'cisco', 'network_cli', 'compliance'],
  },
  {
    id: 'itv-ans-42',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A playbook reports "changed" on every single run even though nothing is actually changing. Why does that matter and how do you fix it?',
    probing:
      'Idempotence in practice - the answer should explain why it matters before how to fix it.',
    answer: [
      'It matters because **the change report is your primary signal**. When a run legitimately reports no changes, you know the fleet matches the code. When every run reports changes, that signal is gone - a genuine unexpected change is indistinguishable from the constant noise, and nobody reads the output any more.',
      'It also means you cannot use the change count for **drift detection**, and on anything with handlers it means services restart on every run, which for production is disruptive.',
      'To find the cause, run with `--diff` and look at which tasks report changed. The usual culprits are a short list.',
      '**`command` and `shell` tasks** with no `creates`, `removes` or `changed_when` - Ansible cannot tell whether they did anything, so it always says changed.',
      '**Templates with volatile content** - a timestamp, a random value, or a dictionary rendered in an unstable order. The file differs every run even though nothing meaningful changed. Removing the timestamp, or using `| to_nice_json` on a sorted structure, fixes it.',
      '**`file` tasks setting a mode or owner** that something else immediately changes back - a service that rewrites its own configuration file, for instance.',
      '**`lineinfile` without a `regexp`**, appending a duplicate line every time.',
      'The fix in each case is to give Ansible enough information to know whether work is needed, or to remove the volatility from the content.',
    ],
    code: [
      {
        title: 'Find it, then fix it',
        language: 'bash',
        code: `# Run twice; the second run should report zero changed
ansible-playbook site.yml --diff | tee run1.log
ansible-playbook site.yml --diff | tee run2.log

grep -B2 'changed:' run2.log | head -40`,
      },
      {
        title: 'The three common causes and their fixes',
        language: 'yaml',
        code: `# 1. Unguarded command
- ansible.builtin.command: /usr/local/bin/build-index
  args:
    creates: /var/lib/app/index.db        # skip entirely if it exists

# or, when it must run:
- ansible.builtin.command: /usr/local/bin/status
  register: st
  changed_when: "'updated' in st.stdout"
  failed_when: st.rc > 1

# 2. Template with a timestamp in it - remove the volatility
#    BAD:  # generated {{ ansible_date_time.iso8601 }}
#    GOOD: # {{ ansible_managed }}

# 3. lineinfile with no regexp, appending every run
- ansible.builtin.lineinfile:
    path: /etc/security/limits.conf
    regexp: '^app\\s+soft\\s+nofile'       # without this it appends forever
    line: 'app soft nofile 65536'`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why is this task always changed?',
        caption:
          'Each cause has a specific fix; the shared theme is that Ansible cannot tell what happened.',
        question: 'What kind of task is reporting changed?',
        branches: [
          {
            condition: 'command or shell',
            result: 'Add creates/removes or changed_when',
            detail: 'Ansible has no idea what it did',
            tone: 'warning',
          },
          {
            condition: 'template or copy',
            result: 'Remove volatile content',
            detail: 'Timestamps, random values, unstable ordering',
            tone: 'warning',
          },
          {
            condition: 'lineinfile',
            result: 'Add a regexp',
            detail: 'Otherwise it appends every run',
            tone: 'danger',
          },
          {
            condition: 'file permissions',
            result: 'Something else is changing them back',
            detail: 'Usually the service itself',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      "Molecule's idempotence check runs the role twice and fails if the second run reports changes - make this a CI gate and the problem cannot ship.",
      '`ansible_managed` as a header is fine; a rendered timestamp is not, and the two are easy to confuse.',
      'A task that is always changed and also notifies a handler restarts the service on every run - check handlers specifically.',
    ],
    traps: [
      'Accepting constant changes as normal, and losing the signal entirely.',
      '`changed_when: false` applied blindly to silence it, which hides real changes too.',
      'A timestamp in a template header.',
    ],
    followUps: [
      'Why is the change report worth protecting?',
      'How would you stop this being reintroduced?',
    ],
    tags: ['scenario', 'idempotence', 'debugging', 'quality', 'advanced'],
  },
  {
    id: 'itv-ans-43',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is AWX or Ansible Automation Platform, and what does it add?',
    probing: 'The control plane, and whether you know what problems it solves.',
    answer: [
      '**AWX** is the open-source upstream of **Ansible Automation Platform**, a web-based control plane for running Ansible. Playbooks still do the work; AWX manages who runs them, when, with what credentials, and keeps a record.',
      'What it adds over `ansible-playbook` on a laptop: **RBAC**, so a team can run the playbooks relevant to them and nothing else. **Credential management**, so SSH keys and cloud credentials are stored centrally, injected at run time, and never handled by individuals. **Scheduling** for recurring convergence runs. **Job history**, so there is an audit trail of what ran, when, by whom, and what it changed. **Surveys**, which give a form-based interface so someone can run a playbook safely without knowing Ansible. And an **API**, so other systems can trigger jobs.',
      'The strongest argument is usually the combination of **audit trail and credential separation**. Playbooks run from individual machines mean the production SSH key is on those machines, and there is no record of what was run. That is uncomfortable at any scale and unacceptable in a regulated environment.',
      'The cost is another system to operate and upgrade. For a small team running playbooks from CI with secrets in the CI secret store, CI already provides most of the audit trail and credential handling, and AWX may be more than is needed.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'What AWX sits between',
        caption: 'Credentials never reach individuals, and every run is recorded.',
        root: {
          label: 'AWX / Automation Platform',
          children: [
            {
              label: 'RBAC and teams',
              detail: 'Who may run which job template',
              tone: 'accent',
            },
            {
              label: 'Credential store',
              detail: 'Injected at run time, never handled by people',
              tone: 'success',
            },
            {
              label: 'Job templates and schedules',
              detail: 'Recurring convergence, surveys, API triggers',
              tone: 'accent',
            },
            {
              label: 'Job history',
              detail: 'What ran, when, by whom, what changed',
              tone: 'success',
            },
          ],
        },
      },
    ],
    traps: [
      'Adopting AWX and still keeping playbooks outside version control - it runs from git, and should.',
      'Treating it as a replacement for testing; it runs playbooks, it does not validate them.',
      'Over-broad credential scoping, which undoes the main security benefit.',
    ],
    followUps: [
      'When would CI be sufficient instead?',
      'What is the strongest argument for a control plane?',
    ],
    tags: ['awx', 'automation platform', 'rbac', 'audit', 'operations'],
  },
  {
    id: 'itv-ans-44',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you run a playbook against a subset of hosts?',
    probing: 'Blast radius control, asked simply.',
    answer: [
      '**`--limit`** restricts the run to a subset of whatever the play targets. It accepts host names, group names, patterns and the intersection and exclusion operators, so `--limit "role_web:&env_prod"` means web servers that are also production, and `--limit "all:!web1"` means everything except that host.',
      '**`--tags`** and **`--skip-tags`** restrict which **tasks** run rather than which hosts, provided the tasks are tagged.',
      '**`--start-at-task`** resumes from a named task, which is useful after a failure partway through a long playbook.',
      'The habit worth forming is **`--list-hosts` first**. It prints exactly which hosts would be affected without running anything, and it takes a second. Running a playbook against the wrong set is one of the easier ways to cause an incident, and this removes the guesswork.',
      'For production specifically, requiring `--limit` - or a playbook that refuses to run against everything without an explicit confirmation variable - is a reasonable policy.',
    ],
    code: [
      {
        title: 'Targeting, and checking before you run',
        language: 'bash',
        code: `# Always check first
ansible-playbook site.yml --limit 'role_web:&env_prod' --list-hosts

# Patterns
ansible-playbook site.yml --limit web1.example.com
ansible-playbook site.yml --limit 'role_web:&env_prod'      # intersection
ansible-playbook site.yml --limit 'all:!db'                 # exclusion
ansible-playbook site.yml --limit 'web*'                    # wildcard

# Tasks rather than hosts
ansible-playbook site.yml --tags 'config,restart'
ansible-playbook site.yml --skip-tags 'slow'

# Resume after a failure
ansible-playbook site.yml --start-at-task 'Deploy the release'`,
      },
    ],
    traps: [
      'Forgetting `--limit` and running against the whole inventory.',
      '`--start-at-task` skipping a task that set a variable a later task needs.',
      'Tags applied inconsistently, so `--tags` silently runs nothing.',
    ],
    followUps: ['What would you run before any production playbook?'],
    tags: ['limit', 'tags', 'cli', 'safety', 'fundamentals'],
  },
  {
    id: 'itv-ans-45',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you keep playbooks maintainable as a team grows?',
    probing:
      'Codebase health for infrastructure code, which is usually held to a lower standard than application code.',
    answer: [
      'The underlying problem is that Ansible repositories are often held to a lower standard than application code - no review, no tests, no conventions - and they degrade fast once several people touch them.',
      'The practices that hold: **roles as the unit of reuse**, each with a clear single purpose, so the same logic is not reimplemented in five playbooks. **Shared roles versioned and pinned** through `requirements.yml`, so a change to a shared role does not reach everyone at once.',
      '**Conventions enforced by tooling rather than by review**: `ansible-lint` in CI with an agreed configuration, consistent naming, fully qualified module names, and every task named. A linter enforces this consistently in a way that reviewers do not.',
      '**Tests**: Molecule on every shared role, including the idempotence check, and across the operating systems the role claims to support.',
      '**Documentation that lives with the code**: a README per role with its variables and their defaults, and defaults documented in `defaults/main.yml` with comments rather than in a wiki that goes stale.',
      'And **ownership**. A repository everyone contributes to and nobody owns accumulates half-finished work. A named owner per role, or per area, is what keeps it coherent.',
      'The failure mode to watch for is the **giant `site.yml`** that does everything with tags to select parts of it. It grows until nobody can predict what a given invocation does. Separate playbooks per purpose are clearer than one playbook with twenty tags.',
    ],
    code: [
      {
        title: 'Lint configuration and a CI gate',
        language: 'yaml',
        code: `# .ansible-lint
profile: production           # the strictest built-in profile

exclude_paths:
  - .cache/
  - collections/

warn_list:
  - experimental

skip_list:
  - yaml[line-length]

---
# .github/workflows/lint.yml
- run: pip install ansible-lint
- run: ansible-lint
- run: ansible-playbook --syntax-check site.yml
- run: molecule test --all`,
      },
    ],
    deeper: [
      'The `production` ansible-lint profile enforces a lot of good practice automatically - fully qualified names, named tasks, no bare `command` where a module exists.',
      'A role README documenting every variable and its default is the single most useful piece of documentation, because variables are the interface.',
      'Treat the Ansible repository like application code: pull requests, review, CI, and a changelog for shared roles.',
    ],
    traps: [
      'One enormous `site.yml` with tags used as control flow.',
      'Conventions documented in a wiki and enforced by nobody.',
      'Shared roles with no owner and no tests.',
      'Infrastructure code exempted from review because "it is just config".',
    ],
    followUps: [
      'What does the `production` lint profile enforce?',
      'Why is one big tagged playbook a problem?',
    ],
    tags: ['maintainability', 'linting', 'conventions', 'team', 'advanced'],
  },
  {
    id: 'itv-ans-46',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is the difference between `copy` and `template`?',
    probing: 'A basic distinction, checked quickly.',
    options: [
      {
        id: 'a',
        text: '`copy` transfers a file unchanged; `template` renders it through Jinja2 with variables and facts first',
      },
      { id: 'b', text: '`copy` works on directories and `template` does not' },
      { id: 'c', text: '`template` is for binary files and `copy` for text' },
      { id: 'd', text: 'They are aliases for the same module' },
    ],
    correct: ['a'],
    answer: [
      '`copy` transfers a file from the control node to the target **byte for byte**. `template` renders the source through **Jinja2** first, substituting variables, facts and expressions, and then transfers the result.',
      'The practical rule: if the file contains **anything that varies by host or environment**, use `template`. If it is genuinely identical everywhere - a binary, a certificate, a static script - use `copy`.',
      'Both share the same file arguments: `owner`, `group`, `mode`, `backup`, and `validate`. Both are idempotent, comparing checksums and only transferring when the content differs.',
      '`copy` also has a `content` argument for writing a short literal string without a source file, which is handy for one-line files.',
    ],
    code: [
      {
        title: 'Each used for its purpose',
        language: 'yaml',
        code: `# Identical everywhere - copy
- ansible.builtin.copy:
    src: files/ca-bundle.crt
    dest: /etc/ssl/certs/internal-ca.crt
    owner: root
    mode: '0644'

# Varies by host - template
- ansible.builtin.template:
    src: templates/app.conf.j2
    dest: /etc/app/app.conf
    mode: '0640'
    backup: true
    validate: '/usr/local/bin/app --check-config %s'
  notify: Reload app

# A short literal file, no source needed
- ansible.builtin.copy:
    content: "{{ app_version }}\\n"
    dest: /opt/app/VERSION
    mode: '0644'`,
      },
    ],
    traps: [
      '`copy` on a file containing Jinja2 syntax, which is transferred literally and never rendered.',
      'Forgetting `mode`, leaving a secret file world-readable.',
      'No `validate` on a configuration file that a service will reload.',
    ],
    followUps: ['What happens if you `copy` a file containing Jinja2 syntax?'],
    tags: ['copy', 'template', 'modules', 'fundamentals'],
  },
  {
    id: 'itv-ans-47',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you use Ansible and Terraform together?',
    probing: 'The boundary between provisioning and configuration.',
    answer: [
      'The standard division is **Terraform provisions, Ansible configures**. Terraform creates the virtual machines, networks, load balancers and databases; Ansible installs and configures what runs on those machines.',
      'The connection between them is the **inventory**. Rather than having Terraform generate a static inventory file - which goes stale immediately - use a **dynamic inventory** that queries the cloud provider and groups by the tags Terraform applied. Terraform tags an instance `Role=web` and `Env=prod`; Ansible discovers it automatically on the next run. The two tools stay decoupled, which is the point.',
      'What I would **not** do is call Ansible from a Terraform provisioner. It couples the two, it runs only at create time, a failure taints the resource, and Terraform has no model of what the playbook did. If they must be sequenced, do it in the pipeline: `terraform apply`, then `ansible-playbook`, as two steps.',
      'The alternative that is often better is to remove the boundary entirely with **immutable infrastructure**: build a machine image with Packer, using the same Ansible roles at build time, and have Terraform launch instances from that image. There is then nothing to configure after creation, no configuration drift, and instances are replaced rather than converged.',
      'That is the direction I would push for anything at scale - Ansible becomes a build-time tool rather than a runtime one, which removes a whole class of problems.',
    ],
    code: [
      {
        title: 'Terraform tags, Ansible discovers',
        language: 'hcl',
        code: `resource "aws_instance" "web" {
  count         = 3
  ami           = data.aws_ami.base.id
  instance_type = "t3.medium"

  tags = {
    Name      = "web-\${count.index}"
    Role      = "web"           # becomes an Ansible group
    Env       = "prod"          # becomes an Ansible group
    ManagedBy = "ansible"       # inventory filter
  }
}`,
      },
      {
        title: 'The pipeline, as two steps rather than one coupled one',
        language: 'bash',
        code: `# 1. Provision
terraform apply -auto-approve

# 2. Wait for instances to accept SSH
ansible -i inventory/aws_ec2.yml role_web -m wait_for_connection \\
  -a 'timeout=300'

# 3. Configure - inventory discovered from tags, nothing passed between steps
ansible-playbook -i inventory/aws_ec2.yml site.yml --limit 'role_web:&env_prod'`,
      },
    ],
    traps: [
      "Calling Ansible from a Terraform `local-exec` provisioner, coupling the two and losing Terraform's model.",
      'Generating a static inventory from Terraform output, which is stale immediately.',
      'Not waiting for SSH, so the playbook fails against instances that are still booting.',
      'Managing the same resource with both tools.',
    ],
    followUps: [
      'Why not call Ansible from a Terraform provisioner?',
      'How does immutable infrastructure change this?',
    ],
    tags: ['terraform', 'integration', 'dynamic inventory', 'packer', 'advanced'],
  },
  {
    id: 'itv-ans-48',
    level: 'basic',
    kind: 'open',
    prompt: 'What does the output of a playbook run tell you?',
    probing: 'Reading output, which is how you know whether anything actually worked.',
    answer: [
      'Each task reports a status per host: **ok** (no change needed), **changed** (something was modified), **skipped** (a condition excluded it), **failed**, or **unreachable** (could not connect).',
      'The **PLAY RECAP** at the end summarises per host. The number that matters most is **changed**: on a second run of an unchanged playbook it should be **zero**. If it is not, something in the playbook is not idempotent.',
      '**unreachable** is different from **failed** and worth distinguishing - it means a connection problem, not a task problem, so the cause is SSH, credentials or the host being down rather than anything in the playbook.',
      '**ignored** appears when a task failed but had `ignore_errors: true`. A non-zero ignored count is worth looking at, because it means something failed and the playbook carried on regardless.',
      'For readability, the **`yaml` stdout callback** formats multi-line output far better than the default, and `--diff` shows the actual content changes for files and templates - which turns "changed" into "here is what changed", and is what makes the output genuinely reviewable.',
    ],
    code: [
      {
        title: 'Reading a recap',
        language: 'text',
        code: `PLAY RECAP *********************************************************
web1  : ok=12  changed=2  unreachable=0  failed=0  skipped=3  rescued=0  ignored=0
web2  : ok=12  changed=2  unreachable=0  failed=0  skipped=3  rescued=0  ignored=0
web3  : ok=0   changed=0  unreachable=1  failed=0  skipped=0  rescued=0  ignored=0
db1   : ok=8   changed=0  unreachable=0  failed=1  skipped=1  rescued=0  ignored=0

# web3 unreachable -> connectivity, not a playbook problem
# db1 failed=1      -> a task genuinely failed; the rest of the play stopped for that host
# web1/web2 changed=2 on a FIRST run is expected; on a second it is a bug`,
      },
      {
        title: 'Make the output readable',
        language: 'text',
        code: `# ansible.cfg
[defaults]
stdout_callback = yaml
display_skipped_hosts = False
callbacks_enabled = timer, profile_tasks    # find the slow tasks`,
      },
    ],
    traps: [
      'Ignoring a non-zero `changed` count on repeat runs.',
      'Treating `unreachable` as a task failure and debugging the wrong thing.',
      'A non-zero `ignored` count that nobody looks at.',
      'Running without `--diff` and having no idea what actually changed.',
    ],
    followUps: [
      'What should `changed` be on a second run, and why?',
      'What is the difference between `failed` and `unreachable`?',
    ],
    tags: ['output', 'recap', 'debugging', 'idempotence', 'fundamentals'],
  },
  {
    id: 'itv-ans-49',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle reboots in a playbook?',
    probing: 'A common operation with real pitfalls.',
    answer: [
      'The **`reboot`** module reboots the host and **waits for it to come back**, which is the part a naive `shell: reboot` gets wrong - the connection drops, the task fails, and the playbook stops.',
      'The important practice is to **reboot only when needed**. Most package managers can tell you: on Debian, `/var/run/reboot-required` exists after a kernel update; on RedHat, `needs-restarting -r` returns non-zero. Registering that and making the reboot conditional means a run that changed nothing reboots nothing.',
      'For a **fleet**, reboots must be rolled. `serial` limits how many are down at once, and a health check afterwards confirms the host is genuinely back and serving before moving on. Rebooting every machine simultaneously is the same failure as restarting every service at once.',
      'The arguments worth setting: **`post_reboot_delay`** to give services time to start before the connection test, **`reboot_timeout`** long enough for a slow machine, and **`test_command`** if the default connectivity test is not a sufficient indicator that the host is usable.',
    ],
    code: [
      {
        title: 'Reboot only if required, one batch at a time',
        language: 'yaml',
        code: `- name: Patch and reboot, safely
  hosts: all
  serial: "10%"
  max_fail_percentage: 0
  become: true

  tasks:
    - name: Apply updates
      ansible.builtin.package:
        name: '*'
        state: latest

    - name: Is a reboot actually required?
      ansible.builtin.stat:
        path: /var/run/reboot-required
      register: reboot_required

    - name: Reboot, only if needed
      ansible.builtin.reboot:
        reboot_timeout: 600
        post_reboot_delay: 30
        test_command: systemctl is-system-running --wait
      when: reboot_required.stat.exists

  post_tasks:
    - name: Confirm the application is serving before the next batch
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/healthz"
        status_code: 200
      retries: 20
      delay: 10
      delegate_to: localhost`,
      },
    ],
    traps: [
      '`shell: reboot`, which fails the task when the connection drops.',
      'Rebooting unconditionally, so every run takes the fleet down.',
      'No `serial`, rebooting everything at once.',
      'Connectivity treated as readiness - the host answers SSH long before the application is serving.',
    ],
    followUps: [
      'How do you know whether a reboot is actually needed?',
      'Why is SSH being available not the same as the host being ready?',
    ],
    tags: ['reboot', 'patching', 'serial', 'production'],
  },
  {
    id: 'itv-ans-50',
    level: 'advanced',
    kind: 'open',
    prompt: 'What are the biggest mistakes you see in Ansible codebases?',
    probing:
      'A reflective question. The answer shows how much real maintenance experience you have.',
    answer: [
      'The one I see most is **`shell` and `command` everywhere**, with no `changed_when` or `creates`. It turns Ansible into a slow way to run scripts over SSH: no idempotence, no meaningful change reporting, no cross-platform behaviour. It usually happens because someone translated an existing bash script task by task rather than rethinking it.',
      '**Not being idempotent**, which follows from the first. Once a playbook reports changes on every run, the change signal is gone and nobody reads the output.',
      '**Secrets in plain text**, justified by the repository being private. It is not an access control, and the secrets are in every clone and CI checkout.',
      '**No tests at all** - no lint, no Molecule, no idempotence check. Infrastructure code is frequently exempted from the standards applied to application code, and it degrades accordingly.',
      '**One enormous `site.yml`** with tags used as control flow, until nobody can predict what a given invocation will do.',
      '**No `serial`** on anything, so every playbook is a fleet-wide simultaneous change.',
      'And **variables scattered everywhere** - some in the inventory, some in `group_vars`, some in `vars/`, some passed with `-e` - so nobody can work out where a value comes from or which one wins.',
      'The common thread is treating Ansible as scripting rather than as code. The fix is mostly the ordinary discipline applied to any codebase: review, tests, conventions enforced by tooling, and clear ownership.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Reviewing an unfamiliar Ansible repository',
        caption: 'These four checks tell you most of what you need to know within ten minutes.',
        question: 'What would you look at first?',
        branches: [
          {
            condition: 'Run it twice - does the second run report changes?',
            result: 'Idempotence',
            detail: 'The single most revealing check',
            tone: 'danger',
          },
          {
            condition: 'grep for shell and command',
            result: 'How much is unmanaged scripting?',
            detail: 'And do they have changed_when?',
            tone: 'warning',
          },
          {
            condition: 'Is there a CI pipeline, lint, Molecule?',
            result: 'Is this treated as code?',
            tone: 'warning',
          },
          {
            condition: 'grep group_vars for anything secret-shaped',
            result: 'Secret handling',
            tone: 'danger',
          },
        ],
      },
    ],
    traps: [
      'Translating a bash script into `shell` tasks and calling it Ansible.',
      'Treating a private repository as a secret store.',
      'Infrastructure code exempted from review and testing.',
      'Tags used as control flow in one giant playbook.',
    ],
    followUps: [
      'How would you assess an unfamiliar Ansible repository quickly?',
      'Where would you start improving one?',
    ],
    tags: ['anti-patterns', 'code quality', 'review', 'maintainability', 'advanced'],
  },
]
