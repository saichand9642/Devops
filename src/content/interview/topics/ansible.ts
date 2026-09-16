import type { InterviewTopic } from '../../types'

export const ansibleTopic: InterviewTopic = {
  id: 'ansible',
  title: 'Ansible',
  shortTitle: 'Ansible',
  icon: '📋',
  order: 8,
  oneLiner:
    'Agentless configuration management: playbooks, inventory, idempotence, roles, Vault and where it fits next to Terraform.',
  headlines: [
    'Agentless and push-based: Ansible connects over SSH (or WinRM) and runs modules, then removes them.',
    '**Idempotence** is the core promise - a module checks state first and reports `changed` only if it acted.',
    'Terraform **provisions** infrastructure; Ansible **configures** what is on it. They overlap but are not substitutes.',
    '`command` and `shell` are the two modules that are **not** idempotent. Everything else usually is.',
    'Roles are the unit of reuse; inventory groups are the unit of targeting.',
    'Secrets go in Ansible Vault, or better, are fetched at runtime from a real secret store.',
  ],
  questions: [
    {
      id: 'itv-ansible-1',
      level: 'basic',
      kind: 'open',
      prompt: 'What is Ansible and how does it differ from Puppet or Chef?',
      probing:
        'Architecture: agentless and push-based. It is the defining characteristic and drives most of the trade-offs.',
      answer: [
        'Ansible is a configuration management and automation tool. You write **playbooks** in YAML describing the desired state of your machines, and Ansible connects to them and makes it so.',
        'The defining difference is that it is **agentless and push-based**. There is nothing to install on the managed hosts - Ansible connects over SSH, copies a small Python module across, runs it, collects the result and deletes it. Puppet and Chef are traditionally **agent-based and pull-based**: a daemon on each node periodically fetches its catalogue from a server and applies it.',
        'Agentless is why Ansible is so easy to adopt. If you can SSH to a machine you can manage it - no bootstrapping problem, no agent to upgrade, no extra port to open, nothing to secure on every host.',
        'The trade-offs are real though. Push means **you** have to run it, so drift is not corrected automatically between runs, whereas a Puppet agent re-converges every 30 minutes. And it scales differently: pushing to 5,000 hosts over SSH is slower than 5,000 agents pulling independently.',
      ],
      deeper: [
        'Ansible uses YAML rather than a DSL, which lowers the barrier a lot but also means the "language" is really Jinja2 templating wedged into YAML. Complex conditionals get ugly, and that is usually the signal to move logic into a module or a role rather than fight it.',
        'For continuous enforcement you would run Ansible on a schedule from AWX or Ansible Automation Platform, which gets you closer to the pull model’s drift correction.',
      ],
      diagrams: [
        {
          kind: 'sequence',
          title: 'What actually happens on a task',
          caption:
            'Nothing is installed permanently. The module is copied, run, and removed - which is why there is no agent.',
          participants: [
            { id: 'ctl', label: 'Control node' },
            { id: 'ssh', label: 'SSH' },
            { id: 'host', label: 'Managed host' },
          ],
          messages: [
            { from: 'ctl', to: 'ssh', label: 'connect, using the inventory' },
            { from: 'ctl', to: 'host', label: 'gather facts (setup module)' },
            { from: 'host', to: 'ctl', label: 'OS, IPs, memory, packages', kind: 'return' },
            { from: 'ctl', to: 'host', label: 'copy the module, execute it' },
            { from: 'host', to: 'host', label: 'check state, act only if needed' },
            {
              from: 'host',
              to: 'ctl',
              label: 'JSON result: ok / changed / failed',
              kind: 'return',
            },
            { from: 'ctl', to: 'host', label: 'delete the module, disconnect' },
          ],
        },
      ],
      traps: [
        'Saying Ansible is "agentless so it needs nothing". It needs SSH access, a Python interpreter on the target, and credentials.',
        'Presenting push versus pull as one being simply better. They trade adoption ease against automatic drift correction.',
      ],
      followUps: [
        'What are the downsides of agentless?',
        'How would you correct drift between runs?',
        'How does Ansible scale to thousands of hosts?',
      ],
      tags: ['fundamentals', 'architecture', 'agentless'],
    },
    {
      id: 'itv-ansible-2',
      level: 'basic',
      kind: 'mcq',
      prompt: 'Which of these Ansible tasks is NOT idempotent?',
      options: [
        { id: 'a', text: 'ansible.builtin.package: name=nginx state=present' },
        { id: 'b', text: 'ansible.builtin.shell: echo "config" >> /etc/app.conf' },
        { id: 'c', text: 'ansible.builtin.copy: src=app.conf dest=/etc/app.conf' },
        { id: 'd', text: 'ansible.builtin.service: name=nginx state=started' },
      ],
      correct: ['b'],
      probing:
        'Idempotence is the whole promise of configuration management. `shell` with `>>` is the classic way to break it.',
      answer: [
        'Option B appends to a file every time it runs. Run the playbook three times and the line is there three times. That is the definition of not idempotent.',
        'The other three all check state first. `package` installs only if the package is absent. `copy` compares checksums and only writes if the content differs. `service` starts it only if it is not already running. Each reports `changed` only when it actually did something.',
        '`command` and `shell` are the two modules Ansible cannot make idempotent, because it has no idea what your command does. If you must use them, you make them idempotent yourself with `creates:`, `removes:` or a `when:` guard.',
        'Better still, use the right module: `lineinfile` or `blockinfile` for editing a file, `template` for generating one. There is usually a module for what you are shelling out to do.',
      ],
      code: [
        {
          title: 'Breaking it, and three ways to fix it',
          language: 'yaml',
          code: `# NOT idempotent - appends on every run
- name: Add config line
  ansible.builtin.shell: echo "max_connections=100" >> /etc/app.conf

# Fix 1: use the right module
- name: Ensure config line is present
  ansible.builtin.lineinfile:
    path: /etc/app.conf
    regexp: '^max_connections='
    line: 'max_connections=100'

# Fix 2: guard a command with creates:
- name: Extract the release once
  ansible.builtin.command: tar xzf /tmp/app.tgz -C /opt/app
  args:
    creates: /opt/app/bin/server      # skipped if this already exists

# Fix 3: generate the whole file from a template
- name: Render app config
  ansible.builtin.template:
    src: app.conf.j2
    dest: /etc/app.conf
    owner: app
    mode: '0640'
  notify: restart app                  # handler runs only on change`,
        },
      ],
      traps: [
        'Reaching for `shell` because it is familiar. It is the one thing that breaks the guarantee the tool exists to provide.',
        'Using `command` without `creates:` and assuming re-running is safe.',
      ],
      followUps: [
        'How do you make a shell task idempotent?',
        'What does "changed" actually mean in the output?',
        'What is `--check` mode for?',
      ],
      tags: ['idempotence', 'modules', 'playbooks'],
    },
    {
      id: 'itv-ansible-3',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Explain inventory, groups, and variable precedence in Ansible.',
      probing:
        'Variable precedence is where real Ansible debugging happens, and it catches people out constantly.',
      answer: [
        '**Inventory** lists the hosts you manage and organises them into **groups** - `webservers`, `databases`, `production`. A host can be in many groups, and groups can have children, so you get a hierarchy.',
        'Variables can be defined at many levels: in `group_vars/`, in `host_vars/`, in the playbook, in a role’s `defaults/` or `vars/`, on the command line with `-e`, and several more.',
        'The precedence order matters and roughly runs: role **defaults** are weakest, then inventory group vars, then inventory host vars, then playbook vars, then role **vars**, then `set_fact`, and finally `-e` **extra vars**, which beat everything.',
        'The two ends are what people actually need to remember: `defaults/main.yml` in a role is the **weakest** - which is exactly why roles put their overridable settings there - and `-e` on the command line is the **strongest** and cannot be overridden by anything.',
        'Host vars beat group vars, and a child group beats its parent. When something has an unexpected value, `ansible-inventory --host <name>` shows the resolved result, which is far faster than reasoning about the order.',
      ],
      code: [
        {
          title: 'Layout and resolution',
          language: 'yaml',
          code: `# --- inventory/production.yml
all:
  children:
    webservers:
      hosts:
        web01.example.com:
        web02.example.com:
      vars:
        app_port: 8080
    databases:
      hosts:
        db01.example.com:
      vars:
        app_port: 5432
    production:
      children:
        webservers:
        databases:
      vars:
        environment: production

# --- group_vars/webservers.yml      (group level)
# --- host_vars/web01.example.com.yml (beats the group)
# --- roles/app/defaults/main.yml     (weakest of all)

# Resolve it rather than reasoning about it:
#   ansible-inventory -i inventory/production.yml --host web01.example.com
#   ansible web01.example.com -m debug -a "var=app_port"`,
        },
        {
          title: 'Targeting with patterns',
          language: 'bash',
          code: `ansible-playbook site.yml -l webservers              # one group
ansible-playbook site.yml -l 'webservers:&production'  # intersection
ansible-playbook site.yml -l 'webservers:!web01*'      # exclusion
ansible-playbook site.yml -l web01.example.com         # one host

# Extra vars beat everything else
ansible-playbook site.yml -e "app_port=9090"`,
        },
      ],
      traps: [
        'Putting overridable settings in a role’s `vars/` instead of `defaults/`. `vars/` has high precedence, so consumers cannot override it - which is almost never what the role author intended.',
        'Defining the same variable in three places and then debugging by reading files rather than asking Ansible what it resolved to.',
      ],
      followUps: [
        'Which wins, host_vars or group_vars?',
        'Why do roles put settings in defaults rather than vars?',
        'How do you see the final value of a variable for one host?',
      ],
      tags: ['inventory', 'variables', 'precedence'],
    },
    {
      id: 'itv-ansible-4',
      level: 'intermediate',
      kind: 'open',
      prompt: 'What are roles and handlers, and how do you structure a real Ansible repository?',
      probing: 'Whether you have gone beyond a single playbook. Roles are the unit of reuse.',
      answer: [
        'A **role** packages everything needed to configure one thing - tasks, handlers, templates, files, default variables and metadata - into a standard directory layout. It is the unit of reuse and sharing, and Ansible Galaxy is full of them.',
        'A **handler** is a task that only runs when **notified**, and only **once at the end of the play** no matter how many tasks notified it. That is the mechanism for "restart nginx, but only if the config actually changed, and only once even if three tasks changed config".',
        'Handlers are what make configuration management efficient and safe: without them you either restart unconditionally on every run, or write your own change-detection logic.',
        'For structure, I would have `roles/` for reusable units, `group_vars/` and `host_vars/` for environment data, an `inventories/` directory per environment, and a thin `site.yml` at the top that just maps groups to roles. Anything complex enough to need real logic belongs in a module or a filter plugin rather than in more YAML.',
      ],
      code: [
        {
          title: 'Role layout and a handler in action',
          language: 'yaml',
          code: `# roles/nginx/
#   tasks/main.yml        handlers/main.yml
#   templates/nginx.conf.j2
#   defaults/main.yml     (overridable)
#   vars/main.yml         (high precedence - internal constants)
#   meta/main.yml         (dependencies)

# --- roles/nginx/tasks/main.yml
- name: Install nginx
  ansible.builtin.package:
    name: nginx
    state: present
  notify: restart nginx

- name: Render the config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    validate: 'nginx -t -c %s'     # refuse to write a broken config
  notify: restart nginx             # notified twice, runs ONCE

- name: Ensure nginx is enabled and running
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true

# --- roles/nginx/handlers/main.yml
- name: restart nginx
  ansible.builtin.service:
    name: nginx
    state: restarted

# --- site.yml - thin, just mapping groups to roles
- hosts: webservers
  become: true
  roles:
    - common
    - nginx
    - { role: app, app_version: "1.4.2" }`,
        },
      ],
      deeper: [
        'Two details worth knowing. **Handlers do not run if the play fails** before the end - use `--force-handlers` or `meta: flush_handlers` if you need them to run earlier. And `validate:` on `template` and `copy` is excellent practice: it runs a syntax check before the file is put in place, so you cannot write a config that breaks the service.',
      ],
      traps: [
        'Restarting a service as a normal task, so every run bounces it whether or not anything changed.',
        'Expecting a handler to run immediately. It runs at the end of the play.',
        'Putting overridable defaults in `vars/` rather than `defaults/`.',
      ],
      followUps: [
        'What happens to handlers if the play fails?',
        'How do you force a handler to run immediately?',
        'How would you share a role across teams?',
      ],
      tags: ['roles', 'handlers', 'structure'],
    },
    {
      id: 'itv-ansible-5',
      level: 'advanced',
      kind: 'open',
      prompt: 'How do Ansible and Terraform fit together? When would you use each?',
      probing: 'Tool selection and boundaries. A very common real-world design question.',
      answer: [
        'The clean division is: **Terraform provisions, Ansible configures**. Terraform creates the VPC, the instances, the load balancer and the database - things that exist or do not. Ansible then installs packages, writes configuration files and manages services **on** those instances.',
        'They have genuinely different models. Terraform is **declarative with state** - it knows what it created and computes a diff. Ansible is **procedural and stateless** - it runs tasks in order, and idempotence comes from each module checking before it acts, not from a state file.',
        'That is why Terraform is right for infrastructure: it can tell you a resource has drifted, and it can destroy what it made. Ansible has no concept of "this machine used to exist and should now be removed".',
        'In the modern container world the boundary has moved. If you are deploying containers, Ansible’s configuration role largely disappears - the container image **is** the configuration. Ansible remains valuable for the things containers do not cover: bootstrapping the hosts themselves, network appliances, databases on VMs, and one-off orchestrated operational tasks like a rolling restart or a patch campaign.',
        'I would avoid the common anti-pattern of using Terraform’s `remote-exec` provisioner to do configuration. It runs once at create time, has no idempotence, cannot be re-run, and failures leave the resource tainted. Terraform should hand off to Ansible, not try to be it.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Which tool for which job?',
          caption:
            'The boundary is "does it exist" versus "what is on it". Provisioners blur it, and that is why they are discouraged.',
          question: 'What are you changing?',
          branches: [
            {
              condition: 'cloud resources - does it exist at all',
              result: 'Terraform',
              detail: 'VPCs, instances, databases, DNS. Stateful and declarative.',
              tone: 'accent',
            },
            {
              condition: 'what is installed and configured on a host',
              result: 'Ansible',
              detail: 'Packages, config files, services, users',
            },
            {
              condition: 'a one-off operational task across many hosts',
              result: 'Ansible ad-hoc or a playbook',
              detail: 'Rolling restart, patch campaign, log collection',
            },
            {
              condition: 'configuring a container',
              result: 'Neither - the image is the config',
              detail: 'Dockerfile plus Kubernetes manifests',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Handing off cleanly',
          language: 'bash',
          explanation:
            'Terraform writes the inventory from its own state, so Ansible always targets exactly what Terraform built.',
          code: `# 1. Terraform builds the infrastructure and outputs the addresses
terraform apply

# 2. Generate the Ansible inventory FROM Terraform state - no manual list
terraform output -json web_ips \\
  | jq -r '.[] | "\\(.)"' > inventory/generated.ini

# Or use the dynamic inventory plugin, which queries the cloud directly
#   ansible-inventory -i aws_ec2.yml --graph

# 3. Ansible configures what Terraform built
ansible-playbook -i inventory/generated.ini site.yml

# The anti-pattern to avoid in Terraform:
#   provisioner "remote-exec" {
#     inline = ["apt-get install -y nginx"]
#   }
# Runs once at create time, no idempotence, cannot be re-run, and a
# failure taints the resource. Use Ansible, or bake an image with Packer.`,
        },
      ],
      traps: [
        'Using Terraform provisioners for configuration management. HashiCorp themselves call them a last resort.',
        'Using Ansible to create cloud infrastructure. It can, via modules, but it has no state so it cannot detect drift or destroy cleanly.',
      ],
      followUps: [
        'Why are Terraform provisioners discouraged?',
        'Where does Packer fit in this picture?',
        'Does Ansible still matter if everything is containerised?',
      ],
      tags: ['design', 'terraform', 'tooling', 'boundaries'],
    },
    {
      id: 'itv-ansible-6',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'You need to deploy an application update across 50 web servers with no downtime. How do you write that playbook?',
      probing:
        'Real orchestration: serial batches, load balancer coordination, and failing safely.',
      answer: [
        'The core tool is `serial`, which controls how many hosts Ansible works on at a time. Without it, Ansible runs each task across **all 50 hosts** before moving to the next task - so "stop the service" would stop all fifty simultaneously.',
        'I would use a batched rollout: `serial: [1, 5, 10]` does one host first as a canary, then batches of five, then ten. If the first host fails, the rollout stops before it has touched anything else.',
        'For each batch the sequence is: remove the host from the load balancer, wait for connections to drain, deploy, run a health check, then put it back. The load balancer steps are what make it zero-downtime, and they use `delegate_to` so they run from the control node against the load balancer rather than on the web server.',
        '`max_fail_percentage: 0` makes the play abort as soon as any host in a batch fails, rather than continuing and breaking more of the fleet.',
        'And the health check must be a real check with retries - not a `sleep`. `uri` with `retries` and `until` waits for the application to actually respond correctly before the host goes back into rotation.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'One host through the rollout',
          caption:
            'The drain and the health check are what make it zero-downtime. Without them serial just breaks things more slowly.',
          nodes: [
            {
              label: 'Take the host out of the load balancer',
              detail: 'delegate_to the LB, not the web server',
              tone: 'accent',
            },
            {
              label: 'Wait for connections to drain',
              detail: 'Poll until in-flight requests finish',
            },
            {
              label: 'Deploy the new version',
              detail: 'Then restart the service',
              branch: {
                label: 'Deploy fails',
                detail: 'Play aborts; the host stays out of rotation, not broken in it',
              },
            },
            {
              label: 'Health check with retries',
              detail: 'uri + until + retries - never a bare sleep',
              arrowLabel: 'service restarted',
            },
            {
              label: 'Return it to the load balancer',
              detail: 'Only now does it take traffic again',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'The playbook',
          language: 'yaml',
          code: `- name: Rolling application update
  hosts: webservers
  become: true

  # 1 canary, then 5, then batches of 10.
  serial: [1, 5, 10]

  # Abort the whole play the moment any host in a batch fails.
  max_fail_percentage: 0

  vars:
    app_version: "1.4.2"

  pre_tasks:
    - name: Remove from the load balancer
      community.general.haproxy:
        state: disabled
        host: "{{ inventory_hostname }}"
        backend: web-backend
        drain: true
        wait: true
      # Runs on the LB, not on the web server
      delegate_to: "{{ groups['loadbalancers'][0] }}"

  tasks:
    - name: Deploy the release
      ansible.builtin.unarchive:
        src: "https://artifacts.example.com/app-{{ app_version }}.tar.gz"
        dest: /opt/app
        remote_src: true
      notify: restart app

    - name: Apply handlers now, not at the end of the play
      ansible.builtin.meta: flush_handlers

    - name: Wait for the app to actually answer
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/health"
        status_code: 200
      register: health
      retries: 30
      delay: 2
      until: health.status == 200

  post_tasks:
    - name: Return to the load balancer
      community.general.haproxy:
        state: enabled
        host: "{{ inventory_hostname }}"
        backend: web-backend
      delegate_to: "{{ groups['loadbalancers'][0] }}"

  handlers:
    - name: restart app
      ansible.builtin.service:
        name: app
        state: restarted`,
        },
      ],
      deeper: [
        'The `meta: flush_handlers` line is easy to miss and important. Handlers normally run at the very **end** of the play - which would be after all fifty hosts. In a rolling deploy you need the restart to happen within each batch, before the health check.',
        'I would also run it with `--check --diff` against one host first, and have a documented rollback: the same playbook with the previous `app_version`.',
      ],
      traps: [
        'Omitting `serial`, so every task runs across all fifty hosts at once - which means "stop service" stops the entire fleet.',
        'Using a `pause` or `sleep` instead of a real health check.',
        'Forgetting `flush_handlers`, so the restart happens after all batches rather than within each one.',
      ],
      followUps: [
        'Why is flush_handlers needed here?',
        'How would you roll back?',
        'What does max_fail_percentage do?',
      ],
      tags: ['scenario', 'orchestration', 'rolling deploy', 'serial'],
    },
    {
      id: 'itv-ansible-7',
      level: 'advanced',
      kind: 'open',
      prompt: 'How do you handle secrets in Ansible?',
      probing: 'Security practice, and whether you know Vault’s real limitations.',
      answer: [
        '**Ansible Vault** encrypts files or individual variables with a password, so secrets can live in Git as ciphertext. `ansible-vault encrypt`, `create`, `edit` and `view` manage them, and playbooks decrypt transparently at runtime given the password.',
        'The pattern I prefer is `encrypt_string` for individual values rather than whole files, so the variable file stays readable in review - you can see which variables exist and which changed, just not their values.',
        'The honest limitations. Vault is **symmetric** - everyone who can decrypt anything can decrypt everything under that password, so there is no per-secret access control. There is **no rotation story** - changing the password means re-encrypting everything. There is **no audit trail** - you cannot tell who read a secret. And the vault password itself has to live somewhere, which is the same problem one level up.',
        'So for anything beyond a small team, I would use Vault only for low-sensitivity values and fetch real secrets **at runtime** from HashiCorp Vault, AWS Secrets Manager or similar via a lookup plugin. The secret then never sits in the repository at all, access is audited, and rotation is someone else’s solved problem.',
      ],
      code: [
        {
          title: 'Vault usage, and the runtime alternative',
          language: 'bash',
          code: `# Encrypt a single value - keeps the file reviewable
ansible-vault encrypt_string 'sup3rs3cret' --name 'db_password'

# Produces, for pasting into group_vars:
#   db_password: !vault |
#         $ANSIBLE_VAULT;1.1;AES256
#         66386439653...

ansible-vault create  group_vars/prod/secrets.yml
ansible-vault edit    group_vars/prod/secrets.yml
ansible-vault view    group_vars/prod/secrets.yml
ansible-vault rekey   group_vars/prod/secrets.yml    # change the password

# Running: never type the password interactively in CI
ansible-playbook site.yml --vault-password-file ~/.vault_pass
ansible-playbook site.yml --vault-id prod@~/.vault_pass_prod`,
        },
        {
          title: 'Fetching at runtime instead',
          language: 'yaml',
          explanation:
            'The secret never enters the repository, access is audited centrally, and rotation happens without touching Ansible.',
          code: `- name: Configure the application
  hosts: webservers
  vars:
    # Read at run time from HashiCorp Vault
    db_password: "{{ lookup('community.hashi_vault.hashi_vault',
                            'secret=secret/data/prod/db:password') }}"
  tasks:
    - name: Write the config
      ansible.builtin.template:
        src: app.conf.j2
        dest: /etc/app/app.conf
        mode: '0600'
        owner: app
      # Keep the secret out of the log and out of --diff output
      no_log: true`,
        },
      ],
      traps: [
        'Committing the vault password file. It is the key to everything.',
        'Forgetting `no_log: true` on tasks handling secrets - Ansible will happily print them in verbose output and in `--diff`.',
        'Treating Vault as a secret manager. It is file encryption; it has no access control, rotation or audit.',
      ],
      followUps: [
        'What are Ansible Vault’s limitations?',
        'Where does the vault password itself live in CI?',
        'What does no_log do, and when is it not enough?',
      ],
      tags: ['security', 'vault', 'secrets'],
    },
  ],
}
