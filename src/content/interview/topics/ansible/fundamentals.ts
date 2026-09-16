import type { InterviewQuestion } from '../../../types'

/** Playbooks, inventory, idempotence and the execution model. */
export const ansibleFundamentalQuestions: InterviewQuestion[] = [
  {
    id: 'itv-ans-8',
    level: 'basic',
    kind: 'open',
    prompt: 'What is Ansible and how does it differ from Puppet or Chef?',
    probing: 'Positioning, and specifically the agentless and push model.',
    answer: [
      'Ansible is a configuration management and automation tool. You describe the desired state of systems in YAML **playbooks**, and Ansible connects over **SSH** (or WinRM) and makes it so.',
      'The defining difference from Puppet and Chef is that Ansible is **agentless and push-based**. There is nothing to install on the managed machines beyond SSH and Python, and the control node initiates the run. Puppet and Chef traditionally use an **agent** on each node that **pulls** its configuration from a central server on a schedule.',
      'The practical consequences: Ansible is dramatically easier to get started with - no server to build, no agents to bootstrap, no certificate infrastructure - and works on anything you can SSH to, including network devices and appliances where installing an agent is impossible.',
      'The trade-offs run the other way at scale. A pull model **self-heals continuously**; Ansible only converges when you run it, so drift persists between runs. And pushing to thousands of hosts over SSH is slower than thousands of agents pulling in parallel.',
      'That is why Ansible is often used for **orchestration and one-off changes** - deployments, patching, provisioning sequences - as much as for continuous configuration management, which is a somewhat different job from the one Puppet was built for.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Push versus pull',
        caption:
          'Agentless means nothing to bootstrap; push means nothing converges until you run it.',
        nodes: [
          { label: 'Ansible: control node', detail: 'Playbooks in git', tone: 'accent' },
          { label: 'Connects over SSH', detail: 'No agent on the target' },
          {
            label: 'Executes modules, then removes them',
            detail: 'Nothing left behind',
            tone: 'success',
          },
          {
            label: 'Puppet/Chef: agent on each node',
            detail: 'Pulls from a server every 30 min',
            tone: 'muted',
          },
          { label: 'Continuous convergence', detail: 'Drift corrected without you', tone: 'muted' },
        ],
      },
    ],
    traps: [
      'Claiming agentless means zero requirements - the target still needs Python and SSH access.',
      'Expecting Ansible to correct drift on its own. It does nothing until you run it.',
    ],
    followUps: [
      'What are the downsides of a push model?',
      'How would you get continuous convergence with Ansible?',
    ],
    tags: ['ansible', 'agentless', 'comparison', 'fundamentals'],
  },
  {
    id: 'itv-ans-9',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does it mean that Ansible modules are idempotent?',
    probing: 'The most important property of a configuration management tool.',
    options: [
      {
        id: 'a',
        text: 'Running a playbook repeatedly produces the same end state; a task that has nothing to do reports "ok" rather than changing anything',
      },
      { id: 'b', text: 'Playbooks can only be run once' },
      { id: 'c', text: 'Tasks are executed in a random order each time' },
      { id: 'd', text: 'Every task always makes a change' },
    ],
    correct: ['a'],
    answer: [
      'An idempotent module **checks the current state first** and only acts if a change is needed. `package: name=nginx state=present` installs nginx if it is missing and reports `ok` if it is already there. Running the playbook ten times has the same effect as running it once.',
      'That is what makes playbooks safe to run repeatedly - which is essential, because you rerun them constantly: after a failure, to check for drift, or on a schedule.',
      'It is also why the **changed** count in the output is meaningful. A second run of an unchanged playbook should report zero changes. If it reports changes every time, something in the playbook is **not** idempotent, and that is a bug worth fixing - usually a `command` or `shell` task with no guard.',
      '`command` and `shell` are the main sources of non-idempotence, because Ansible has no idea what the command does. They need `creates`, `removes`, or a `changed_when` condition to behave properly.',
    ],
    code: [
      {
        title: 'Idempotent, and how to fix the non-idempotent case',
        language: 'yaml',
        code: `# Idempotent by design - the module checks before acting
- name: Ensure nginx is installed
  ansible.builtin.package:
    name: nginx
    state: present

# NOT idempotent - reports "changed" on every single run
- name: Extract the release
  ansible.builtin.shell: tar xzf /tmp/app.tar.gz -C /opt/app

# Fixed: skip entirely if the result already exists
- name: Extract the release
  ansible.builtin.unarchive:
    src: /tmp/app.tar.gz
    dest: /opt/app
    creates: /opt/app/VERSION

# Or, when you must use a command, tell Ansible what "changed" means
- name: Rebuild the cache
  ansible.builtin.command: /usr/local/bin/rebuild-cache
  register: rebuild
  changed_when: "'cache rebuilt' in rebuild.stdout"`,
      },
    ],
    traps: [
      'A playbook that reports changes on every run, so real changes are invisible in the noise.',
      '`shell` tasks with no `creates` or `changed_when`.',
      'Assuming every module is idempotent - `command` and `shell` are not, by nature.',
    ],
    followUps: [
      'How would you make a `shell` task idempotent?',
      'Why does a playbook reporting changes every run matter?',
    ],
    tags: ['idempotence', 'modules', 'fundamentals', 'quality'],
  },
  {
    id: 'itv-ans-10',
    level: 'basic',
    kind: 'open',
    prompt: 'What is an inventory, and how do static and dynamic inventories differ?',
    probing: 'How Ansible knows what to manage.',
    answer: [
      'The inventory lists the hosts Ansible can manage and organises them into **groups**, which is what lets a play target "all web servers" rather than naming machines. It also holds **variables** per host and per group.',
      'A **static inventory** is a file - INI or YAML - listing hosts explicitly. Simple, version-controlled, and fine for a stable set of machines.',
      'A **dynamic inventory** queries a source at runtime: AWS EC2, Azure, GCP, VMware, a CMDB. It returns the current hosts and automatically creates groups from their tags and attributes. In any cloud environment this is essential, because instances come and go and a static file is stale the moment it is written.',
      'The pattern that works well with dynamic inventory is **tagging as grouping**: an EC2 instance tagged `Role=web` and `Env=prod` appears in groups `tag_Role_web` and `tag_Env_prod`, so the playbook targets tags rather than addresses and stays correct as the fleet changes.',
      'Group variables live in `group_vars/` and host variables in `host_vars/`, keyed by name, which keeps the inventory itself clean and makes variables reviewable as separate files.',
    ],
    code: [
      {
        title: 'Static inventory with groups and variables',
        language: 'yaml',
        code: `all:
  children:
    web:
      hosts:
        web1.example.com:
        web2.example.com:
      vars:
        http_port: 8080
    db:
      hosts:
        db1.example.com:
          postgres_role: primary
        db2.example.com:
          postgres_role: replica
    prod:
      children:
        web:
        db:`,
      },
      {
        title: 'Dynamic inventory from EC2 tags',
        language: 'yaml',
        code: `# inventory/aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - eu-west-1
filters:
  instance-state-name: running
  tag:ManagedBy: ansible
keyed_groups:
  - key: tags.Role         # tag Role=web  ->  group "role_web"
    prefix: role
  - key: tags.Env
    prefix: env
  - key: placement.availability_zone
    prefix: az
hostnames:
  - private-ip-address`,
        explanation:
          'Run `ansible-inventory -i inventory/aws_ec2.yml --graph` to see exactly what groups this produces.',
      },
    ],
    traps: [
      'A static inventory in a cloud environment, stale within a day.',
      'Variables scattered inline in the inventory rather than in `group_vars/`, making them hard to review.',
      'Group names that collide with variable names, producing confusing precedence behaviour.',
    ],
    followUps: [
      'How would you target only production web servers in one region?',
      'How do you debug which groups a host ended up in?',
    ],
    tags: ['inventory', 'dynamic inventory', 'groups', 'aws'],
  },
  {
    id: 'itv-ans-11',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are roles, and how should a playbook be structured?',
    probing: 'Organisation and reuse.',
    answer: [
      'A **role** packages everything needed for one piece of functionality - tasks, handlers, templates, files, default variables and dependencies - in a standard directory layout. Ansible knows the layout, so `roles/nginx/tasks/main.yml` is found automatically.',
      'The value is reuse and readability. A playbook becomes a short statement of intent - "apply the `common`, `nginx` and `app` roles to the web group" - and the detail lives in the roles, which can be shared across playbooks and repositories.',
      'The structure that works: a **`common` role** applied everywhere (users, packages, hardening, monitoring agent), then **service-specific roles**, with playbooks composing them per environment.',
      'Two conventions matter. **`defaults/main.yml`** holds variables intended to be overridden - it has the lowest precedence, so any inventory or playbook value wins. **`vars/main.yml`** holds values that should not normally be overridden - it has much higher precedence. Putting a tunable in `vars/` by mistake makes it unexpectedly hard to change.',
      'And roles should be **versioned** when shared. `requirements.yml` with a version per role, installed with `ansible-galaxy`, means a change to a shared role does not reach every playbook the moment it merges.',
    ],
    code: [
      {
        title: 'The role layout',
        language: 'text',
        code: `roles/
└── nginx/
    ├── defaults/main.yml      # overridable defaults - LOWEST precedence
    ├── vars/main.yml          # internal values - HIGH precedence
    ├── tasks/main.yml         # the work
    ├── handlers/main.yml      # notified handlers (restart, reload)
    ├── templates/            # Jinja2 templates - nginx.conf.j2
    ├── files/                # static files copied as-is
    ├── meta/main.yml         # dependencies on other roles
    └── molecule/             # tests`,
      },
      {
        title: 'A playbook composing roles',
        language: 'yaml',
        code: `- name: Configure web tier
  hosts: role_web
  become: true

  roles:
    - role: common
    - role: nginx
      vars:
        nginx_worker_processes: 4
    - role: app
      vars:
        app_version: "{{ release_version }}"

  post_tasks:
    - name: Verify the service answers
      ansible.builtin.uri:
        url: "http://localhost:{{ http_port }}/healthz"
        status_code: 200
      retries: 5
      delay: 3`,
      },
    ],
    traps: [
      'Putting tunable values in `vars/` where they cannot easily be overridden.',
      'Roles that assume a specific operating system without declaring it.',
      'Shared roles referenced from a branch rather than a version.',
      'One enormous role that does everything, which cannot be reused.',
    ],
    followUps: [
      'What is the difference between `defaults/` and `vars/`?',
      'How would you share a role across several repositories?',
    ],
    tags: ['roles', 'structure', 'reuse', 'galaxy'],
  },
  {
    id: 'itv-ans-12',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain handlers. Why not just restart the service in a normal task?',
    probing: 'A specific Ansible idiom with a real purpose.',
    answer: [
      'A **handler** is a task that runs only when **notified** by another task that reported `changed`, and only **once at the end of the play** regardless of how many tasks notified it.',
      'Both halves matter. **Only on change**: if the configuration file was already correct, the service is not restarted - so running the playbook on a healthy system causes no disruption at all. A plain restart task would bounce the service on every run, which for a production service is unacceptable.',
      '**Once at the end**: if five tasks each change part of the configuration, the service restarts once rather than five times. And restarting at the end means every configuration change is in place before the service reloads, rather than restarting into a half-updated state.',
      'Two details worth knowing. Handlers **do not run if the play fails** before reaching the end - which is usually correct, but means a failed play can leave configuration written and not applied. `--force-handlers` overrides that if you need it. And `meta: flush_handlers` runs pending handlers immediately, which is what you use when a later task genuinely depends on the restart having happened.',
      'Prefer **reload over restart** where the service supports it, since it applies the configuration without dropping connections.',
    ],
    code: [
      {
        title: 'Handlers notified by configuration changes',
        language: 'yaml',
        code: `tasks:
  - name: Deploy nginx configuration
    ansible.builtin.template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
      validate: 'nginx -t -c %s'      # never install a broken config
    notify: Reload nginx

  - name: Deploy site configuration
    ansible.builtin.template:
      src: site.conf.j2
      dest: /etc/nginx/conf.d/site.conf
    notify: Reload nginx              # same handler - still runs only once

handlers:
  - name: Reload nginx
    ansible.builtin.service:
      name: nginx
      state: reloaded                 # reload, not restart - no dropped connections`,
        explanation:
          'The `validate` argument runs nginx -t against the rendered file before installing it, so a syntax error fails the task instead of breaking the service.',
      },
    ],
    traps: [
      'Restarting in a normal task, so every playbook run bounces production.',
      'Expecting handlers to run when the play failed earlier.',
      'A later task depending on the restart, without `meta: flush_handlers`.',
      'Restarting where a reload would do.',
    ],
    followUps: [
      'What happens to handlers if the play fails halfway?',
      'How do you force a handler to run before a later task?',
    ],
    tags: ['handlers', 'idempotence', 'services', 'production'],
  },
  {
    id: 'itv-ans-13',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does variable precedence work in Ansible?',
    probing:
      'A genuinely complicated area, and knowing the broad order matters more than reciting all 22 levels.',
    answer: [
      'Ansible has around twenty-two precedence levels, and nobody remembers them all. What matters is the shape of it and the few that come up constantly.',
      'From lowest to highest, the ones that matter: **role defaults** (`defaults/main.yml`) are the weakest, which is the point - they exist to be overridden. Then **inventory group variables**, then **inventory host variables**, then **host facts**, then **play variables**, then **role `vars/main.yml`**, then **block and task variables**, and finally **extra variables** passed with `-e`, which beat absolutely everything.',
      'The two practical rules: **put anything intended to be tunable in `defaults/`**, so any level above can override it. And **`-e` always wins**, which makes it right for a one-off override on the command line and wrong as a routine way to pass configuration, because it silently overrides everything and leaves no record.',
      'The most common confusion is `defaults/` versus `vars/` in a role. They look similar and sit at opposite ends of the precedence range - `defaults/` is almost the weakest, `vars/` is near the strongest. Putting a tunable in `vars/` means users cannot override it from their inventory and cannot work out why.',
      '`ansible-playbook --extra-vars` and `ansible-inventory --host` are the tools for working out what a variable actually resolves to, which is usually faster than reasoning about precedence.',
    ],
    code: [
      {
        title: 'Debug what a variable actually resolves to',
        language: 'yaml',
        code: `- name: Show the resolved value and where it came from
  ansible.builtin.debug:
    msg: "app_port={{ app_port }}"

- name: Dump every variable for this host
  ansible.builtin.debug:
    var: hostvars[inventory_hostname]
  when: debug_vars | default(false) | bool`,
      },
      {
        title: 'From the command line',
        language: 'bash',
        code: `# What variables does this host end up with?
ansible-inventory -i inventory/ --host web1.example.com

# The group structure
ansible-inventory -i inventory/ --graph

# -e beats everything - use it for one-off overrides only
ansible-playbook site.yml -e "app_version=1.4.2"`,
      },
    ],
    traps: [
      'Tunables in `vars/` instead of `defaults/`, making them impossible to override.',
      "`-e` used routinely, so the real configuration is in someone's shell history.",
      'The same variable defined in several places, with nobody sure which wins.',
    ],
    followUps: [
      'Where would you put a value users should be able to override?',
      'How do you find out which value a host actually got?',
    ],
    tags: ['variables', 'precedence', 'defaults', 'debugging'],
  },
  {
    id: 'itv-ans-14',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you handle secrets in Ansible?',
    probing: 'Ansible Vault and its limits.',
    answer: [
      '**Ansible Vault** encrypts files or individual variables with a password, so encrypted content can live safely in git. `ansible-vault encrypt_string` encrypts a single value inline, which is usually better than encrypting a whole file because the surrounding variables stay readable and reviewable in a diff.',
      'The vault password itself has to come from somewhere. Options in rough order of preference: a **password file** outside the repository with restricted permissions, a **vault password script** that fetches it from a secret manager, or a prompt. In CI, the password comes from the CI secret store and is never written to disk.',
      'For **multiple environments**, vault IDs let you have separate passwords per environment, so someone with the staging password cannot decrypt production secrets.',
      'The stronger approach where available is to **not put secrets in the repository at all**: use the **HashiCorp Vault**, **AWS Secrets Manager** or similar lookup plugins to fetch secrets at runtime. Nothing encrypted is stored, rotation happens outside Ansible, and access is audited centrally.',
      'The limitation worth stating: **encrypted variables are decrypted in memory during the run**, so they can appear in output. Always set `no_log: true` on tasks handling secrets, or the value ends up in the playbook output and in any CI log that captured it.',
    ],
    code: [
      {
        title: 'Encrypting a single value inline',
        language: 'bash',
        code: `# Encrypt one value, keeping the rest of the file readable
ansible-vault encrypt_string --vault-id prod@~/.vault-prod \\
  's3cr3t-password' --name 'db_password'

# Separate passwords per environment
ansible-playbook site.yml \\
  --vault-id staging@~/.vault-staging \\
  --vault-id prod@prompt

# Edit an encrypted file in place
ansible-vault edit group_vars/prod/secrets.yml --vault-id prod@~/.vault-prod`,
      },
      {
        title: 'no_log, and fetching from a real secret store',
        language: 'yaml',
        code: `- name: Configure the database connection
  ansible.builtin.template:
    src: db.conf.j2
    dest: /etc/app/db.conf
    mode: '0600'
  no_log: true                     # otherwise the rendered secret is in the output

# Better: never store it at all, fetch at runtime
- name: Read the password from HashiCorp Vault
  ansible.builtin.set_fact:
    db_password: "{{ lookup('community.hashi_vault.vault_kv2_get',
                            'prod/db', engine_mount_point='secret').secret.password }}"
  no_log: true`,
      },
    ],
    traps: [
      'Forgetting `no_log: true`, so a secret appears in the playbook output and the CI log.',
      'The vault password committed alongside the vault.',
      'One vault password for every environment, so staging access implies production access.',
      'Encrypting whole files, making diffs unreviewable.',
    ],
    followUps: [
      'How do you stop a secret appearing in CI logs?',
      'Why is encrypting individual values better than whole files?',
    ],
    tags: ['vault', 'secrets', 'security', 'no_log'],
  },
  {
    id: 'itv-ans-15',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these make a playbook safe to run against production? Select all that apply.',
    probing: 'Operational safety - each of these prevents a specific real failure.',
    options: [
      { id: 'a', text: 'Running with `--check` and `--diff` first to preview what would change' },
      { id: 'b', text: '`serial` to roll through hosts in batches rather than all at once' },
      { id: 'c', text: '`any_errors_fatal` or `max_fail_percentage` to stop when a batch fails' },
      { id: 'd', text: 'Running with `--force-handlers` so handlers always execute' },
      { id: 'e', text: 'Health checks between batches, so a broken batch stops the rollout' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      '`--force-handlers` is not a safety measure. It makes handlers run **even when the play failed**, which usually means restarting a service with a configuration that Ansible did not finish applying. The default - handlers skipped on failure - is the safer behaviour.',
      "**`--check` with `--diff`** is a dry run showing exactly what would change. It is not perfect (tasks depending on a previous task's result can behave differently), but it catches a great deal.",
      '**`serial`** turns an all-at-once change into a rolling one, so a mistake affects a few hosts rather than the entire fleet.',
      '**`max_fail_percentage` or `any_errors_fatal`** is what makes `serial` actually protective: without it, Ansible continues to the next batch even though the first one failed, and you break everything slowly instead of quickly.',
      '**Health checks between batches** are what turn a rolling update into a safe one - verifying the service actually works before moving on, rather than assuming the tasks succeeding means the service is healthy.',
    ],
    code: [
      {
        title: 'A rolling update that stops when it breaks something',
        language: 'yaml',
        code: `- name: Rolling application update
  hosts: role_web
  serial: "25%"                  # a quarter of the fleet at a time
  max_fail_percentage: 0         # any failure in a batch stops the whole play
  become: true

  pre_tasks:
    - name: Remove from the load balancer
      ansible.builtin.uri:
        url: "http://lb/api/drain/{{ inventory_hostname }}"
        method: POST
      delegate_to: localhost

  roles:
    - app

  post_tasks:
    - name: Wait for the service to be healthy
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/healthz"
        status_code: 200
      retries: 10
      delay: 5
      delegate_to: localhost

    - name: Return to the load balancer
      ansible.builtin.uri:
        url: "http://lb/api/enable/{{ inventory_hostname }}"
        method: POST
      delegate_to: localhost`,
      },
    ],
    traps: [
      '`serial` without `max_fail_percentage`, so a failure does not stop the rollout.',
      'No health check, so a batch that started but does not work is treated as successful.',
      'Assuming `--check` is a perfect simulation - it is not, for tasks that depend on earlier results.',
    ],
    followUps: [
      'Why does `serial` alone not make a rollout safe?',
      'What are the limitations of `--check` mode?',
    ],
    tags: ['production', 'rolling updates', 'serial', 'safety', 'check mode'],
  },
  {
    id: 'itv-ans-16',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A playbook that works on your machine fails on the CI runner against the same hosts. How do you debug it?',
    probing:
      'Differential debugging for Ansible specifically, where the causes are fairly predictable.',
    answer: [
      'The causes are a fairly short list, so I would work through them in order.',
      '**SSH and authentication** first. The runner uses a different key, a different user, or has no known_hosts entry. Host key checking failing produces an error that is easy to misread as a connection problem. `ansible -m ping` against one host settles this in seconds.',
      '**Privilege escalation**: the local user may have passwordless sudo where the CI user does not, so every `become: true` task fails. Same symptom, different cause.',
      '**Collections and versions**: your machine has collections installed from months of ad-hoc work; the runner installs only what `requirements.yml` lists. A module that exists locally and not in CI produces "module not found", which people often misdiagnose as a typo.',
      '**Variables and vault**: the vault password file exists locally and not in CI, or an environment variable you rely on is not set in the runner.',
      "**Python interpreter**: the target's default Python differs, or `ansible_python_interpreter` is set locally in a config file that is not committed.",
      'The tools: `-vvv` shows the actual SSH command and the module arguments, which usually names the problem directly. And the fastest structural fix is to **run Ansible the same way in both places** - the same container image, the same `requirements.yml`, the same `ansible.cfg` committed to the repository - so there is no local state to differ.',
    ],
    code: [
      {
        title: 'Narrow it down',
        language: 'bash',
        code: `# 1. Can it connect and escalate at all?
ansible -i inventory/ role_web -m ping
ansible -i inventory/ role_web -m command -a 'id' --become

# 2. What is actually being run? -vvv shows the SSH command and module args
ansible-playbook -i inventory/ site.yml -vvv --limit web1 2>&1 | head -60

# 3. Are the collections the same?
ansible-galaxy collection list
ansible --version          # config file path, python version, collection paths

# 4. Make both environments identical
ansible-galaxy install -r requirements.yml --force`,
      },
      {
        title: 'Committed config so both sides behave the same',
        language: 'text',
        code: `# ansible.cfg - in the repository, so CI and laptop agree
[defaults]
inventory = inventory/
roles_path = roles/
collections_path = collections/
host_key_checking = True
interpreter_python = auto_silent
stdout_callback = yaml
forks = 20

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s`,
      },
    ],
    traps: [
      'Disabling host key checking to make CI work, which removes a real protection.',
      'Assuming a missing module is a typo when the collection is simply not installed.',
      'Relying on an `ansible.cfg` in your home directory that CI does not have.',
      'Different Ansible versions between laptop and runner.',
    ],
    followUps: [
      'How would you make the two environments identical?',
      'What does `-vvv` show that the normal output does not?',
    ],
    tags: ['scenario', 'troubleshooting', 'ci', 'debugging', 'advanced'],
  },
  {
    id: 'itv-ans-17',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are facts, and how do you use them?',
    probing: 'Gathering and using system information.',
    answer: [
      '**Facts** are variables Ansible discovers about each host at the start of a play - the operating system and version, network interfaces and IP addresses, memory, CPU count, mounted filesystems, and a great deal more. They are gathered by the `setup` module and available as `ansible_facts` or as top-level `ansible_*` variables.',
      'They are what lets one playbook work across different systems: branching on `ansible_facts.os_family` to use `apt` on Debian and `yum` on RedHat, or sizing a configuration value from `ansible_facts.processor_vcpus`.',
      'The cost is that **gathering facts is slow** - it runs a substantial script on every host at the start of every play. On a large fleet that is a meaningful share of the total runtime.',
      'Two ways to reduce it. **`gather_facts: false`** on plays that do not need them. And **fact caching**, which stores gathered facts (in Redis or on disk) with a TTL, so subsequent runs reuse them rather than re-gathering. On a fleet of hundreds this is a large speedup.',
      '**Custom facts** are also available: a file in `/etc/ansible/facts.d/` on the host, returning JSON or INI, appears under `ansible_local`. That is a clean way to expose information about a host that Ansible cannot discover itself - an application version, a deployment identifier.',
    ],
    code: [
      {
        title: 'Branching on facts, and gathering only what you need',
        language: 'yaml',
        code: `- name: Install the right package manager's package
  ansible.builtin.package:
    name: "{{ 'nginx' if ansible_facts.os_family == 'Debian' else 'nginx' }}"
    state: present

- name: Size workers from the actual CPU count
  ansible.builtin.lineinfile:
    path: /etc/nginx/nginx.conf
    regexp: '^worker_processes'
    line: "worker_processes {{ ansible_facts.processor_vcpus }};"

# Gather only the subsets you need - much faster than everything
- name: Minimal fact gathering
  hosts: all
  gather_facts: true
  gather_subset:
    - '!all'
    - '!min'
    - network
    - hardware`,
      },
      {
        title: 'Fact caching in ansible.cfg',
        language: 'text',
        code: `[defaults]
gathering = smart                     # gather only if not already cached
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 7200           # 2 hours`,
      },
    ],
    traps: [
      'Gathering full facts on every play across hundreds of hosts, and wondering why runs are slow.',
      'A stale fact cache producing decisions based on out-of-date information.',
      'Branching on `ansible_distribution` where `os_family` would be more robust across variants.',
    ],
    followUps: [
      'How would you speed up a playbook that runs against 500 hosts?',
      'What is the risk of fact caching?',
    ],
    tags: ['facts', 'performance', 'caching', 'conditionals'],
  },
  {
    id: 'itv-ans-18',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you make Ansible run faster against a large fleet?',
    probing: 'Performance tuning, which has a small set of high-impact levers.',
    answer: [
      'The levers, roughly in order of impact.',
      "**Forks**: the default is 5, which means Ansible manages five hosts at a time regardless of how many you have. Raising it to 25, 50 or more is usually the single biggest improvement, limited by the control node's CPU and memory and by how much load the targets can take.",
      '**Pipelining**: by default Ansible copies a module file to the target, executes it, and removes it - several SSH round trips per task. Pipelining executes the module over the existing connection without the file copy, typically cutting task time substantially. It needs `requiretty` disabled in sudoers, which is why it is off by default.',
      '**SSH multiplexing** (`ControlMaster` and `ControlPersist`) reuses one TCP connection for all tasks against a host instead of reconnecting each time. This is a large win over high-latency links.',
      '**Fact gathering**: as discussed, disable where not needed and cache otherwise.',
      '**Task design** matters as much as configuration. A loop installing twenty packages one at a time is twenty round trips; passing the list to the package module in one task is one. The same applies to `lineinfile` in a loop versus a single template.',
      'And **`strategy: free`** lets each host proceed at its own pace rather than waiting for the slowest host at each task, which helps a lot on a heterogeneous fleet - at the cost of losing the lockstep ordering that `serial` rollouts depend on.',
    ],
    code: [
      {
        title: 'The configuration that matters',
        language: 'text',
        code: `[defaults]
forks = 50                      # default is 5 - usually the biggest single win
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 7200

[ssh_connection]
pipelining = True               # fewer SSH round trips per task
ssh_args = -o ControlMaster=auto -o ControlPersist=300s -o PreferredAuthentications=publickey
control_path = /tmp/ansible-%%h-%%p-%%r`,
      },
      {
        title: 'Task design: one round trip instead of twenty',
        language: 'yaml',
        code: `# SLOW - one SSH round trip per package
- name: Install packages
  ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop: [nginx, curl, git, jq, vim, htop]

# FAST - the module accepts a list; one task, one round trip
- name: Install packages
  ansible.builtin.package:
    name: [nginx, curl, git, jq, vim, htop]
    state: present`,
      },
    ],
    traps: [
      'Raising forks so high the control node runs out of memory, or the targets are overwhelmed.',
      'Pipelining enabled while `requiretty` is set in sudoers, which breaks every task.',
      '`strategy: free` on a rollout that depends on ordering.',
      'Optimising configuration while the playbook loops over a module that accepts a list.',
    ],
    followUps: ['Why is pipelining off by default?', 'What is the risk of `strategy: free`?'],
    tags: ['performance', 'forks', 'pipelining', 'scaling', 'advanced'],
  },
  {
    id: 'itv-ans-19',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `become: true` do?',
    probing: 'Privilege escalation basics.',
    options: [
      { id: 'a', text: 'Escalates privileges on the target host - by default using sudo to root' },
      { id: 'b', text: 'Runs the task on the control node instead of the target' },
      { id: 'c', text: 'Makes the task idempotent' },
      { id: 'd', text: 'Runs the task as the SSH user explicitly' },
    ],
    correct: ['a'],
    answer: [
      '`become: true` runs the task with escalated privileges on the **target host**. The defaults are `become_method: sudo` and `become_user: root`, both of which can be changed - `become_user: postgres` to run as a service account, or `become_method: doas` on systems using that.',
      'It can be set at play level (everything escalates), task level (only that task), or block level. Setting it only where needed is better practice than escalating the whole play.',
      'The thing that runs a task on the **control node** instead is `delegate_to: localhost`, or `local_action`. Those are different and frequently confused - `delegate_to` is how you call an API, update a load balancer, or write a file locally as part of a play targeting remote hosts.',
      'A practical note: if the target needs a sudo password, `--ask-become-pass` prompts for it. In automation you want passwordless sudo for the Ansible user, scoped to what it actually needs rather than blanket `ALL`.',
    ],
    code: [
      {
        title: 'Escalation scoped to where it is needed',
        language: 'yaml',
        code: `- name: Read something as the normal user
  ansible.builtin.command: whoami
  register: normal_user

- name: Install a package as root
  ansible.builtin.package:
    name: nginx
    state: present
  become: true

- name: Run a database command as the postgres user
  ansible.builtin.command: psql -c 'SELECT 1'
  become: true
  become_user: postgres

- name: Call an API from the control node, not the target
  ansible.builtin.uri:
    url: "http://lb/api/drain/{{ inventory_hostname }}"
  delegate_to: localhost`,
      },
    ],
    traps: [
      'Setting `become: true` at play level when only two tasks need it.',
      'Confusing `become_user` with `delegate_to`.',
      'Blanket passwordless sudo for the Ansible user rather than a scoped sudoers rule.',
    ],
    followUps: ['What is the difference between `become_user` and `delegate_to`?'],
    tags: ['become', 'privilege escalation', 'sudo', 'fundamentals'],
  },
  {
    id: 'itv-ans-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you test Ansible roles and playbooks?',
    probing: 'Testing configuration management, which most teams skip.',
    answer: [
      'In layers, cheapest first.',
      '**`ansible-lint`** catches a large class of problems statically - deprecated syntax, missing names on tasks, `command` where a module exists, permissions not set on files. It should run on every commit; it takes seconds.',
      '**`--syntax-check`** validates that the playbook parses, and **`--check --diff`** does a dry run showing what would change without changing it. Useful, though imperfect for tasks that depend on earlier results.',
      '**Molecule** is the real testing framework. It creates a throwaway instance (Docker, Podman or a cloud VM), applies the role, runs **verification** assertions, and then runs the role **a second time to assert idempotence** - which is the check most likely to catch a genuine bug. Then it destroys the instance.',
      'That idempotence check is the one I would emphasise. A role that reports changes on every run is broken in a way that nothing else catches, and Molecule makes it a test failure rather than something someone might notice.',
      '**Verification** is usually done with Ansible assertions or with **Testinfra**, which lets you write Python assertions about the resulting system - is the package installed, is the service running and enabled, does the port listen, does the configuration file contain the expected line.',
      'In CI, running Molecule against several base images also verifies the role works across the operating systems it claims to support.',
    ],
    code: [
      {
        title: 'A Molecule scenario',
        language: 'yaml',
        code: `# molecule/default/molecule.yml
driver:
  name: docker
platforms:
  - name: ubuntu-2404
    image: geerlingguy/docker-ubuntu2404-ansible:latest
    pre_build_image: true
  - name: rocky-9
    image: geerlingguy/docker-rockylinux9-ansible:latest
    pre_build_image: true
provisioner:
  name: ansible
verifier:
  name: ansible`,
      },
      {
        title: 'Verification assertions',
        language: 'yaml',
        code: `# molecule/default/verify.yml
- name: Verify
  hosts: all
  gather_facts: false
  tasks:
    - name: Check the service is running and enabled
      ansible.builtin.service_facts:

    - name: Assert nginx is active
      ansible.builtin.assert:
        that:
          - ansible_facts.services['nginx.service'].state == 'running'
          - ansible_facts.services['nginx.service'].status == 'enabled'

    - name: Check the port is listening
      ansible.builtin.wait_for:
        port: 80
        timeout: 5

    - name: Check the config was rendered correctly
      ansible.builtin.slurp:
        src: /etc/nginx/nginx.conf
      register: conf
    - ansible.builtin.assert:
        that: "'worker_processes' in (conf.content | b64decode)"`,
      },
    ],
    deeper: [
      'Molecule runs the role twice and fails if the second run reports changes. That single check catches the most common real bug in Ansible roles.',
      'Testing across several base images is how you find out that your role assumed Debian.',
      'Docker-based testing cannot verify everything - systemd behaviour, kernel settings and some networking need a real VM.',
    ],
    traps: [
      'No idempotence testing, so roles that change on every run ship unnoticed.',
      'Testing only on the operating system you develop on.',
      'Assertions that check the task succeeded rather than that the system is in the intended state.',
    ],
    followUps: [
      'Why is the second Molecule run the important one?',
      'What can Docker-based testing not verify?',
    ],
    tags: ['testing', 'molecule', 'ansible-lint', 'idempotence', 'ci'],
  },
]
