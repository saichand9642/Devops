import type { Question } from '../../types'

/** Original practice questions for objective 5. */
export const moduleQuestions: Question[] = [
  {
    id: 'tfq-mod-1',
    domainId: 'tf-modules',
    topicId: 'tf-module-basics',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which argument of a `module` block is mandatory?',
    options: [
      { id: 'a', text: 'version' },
      { id: 'b', text: 'source' },
      { id: 'c', text: 'providers' },
      { id: 'd', text: 'name' },
    ],
    correct: ['b'],
    explanation:
      '`source` is the only required argument. `version` applies to registry sources only, and everything else is either a meta-argument or one of the module’s declared variables.',
  },
  {
    id: 'tfq-mod-2',
    domainId: 'tf-modules',
    topicId: 'tf-module-basics',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What is the state address of `aws_vpc.this` inside a module block named `network`?',
    options: [
      { id: 'a', text: 'network.aws_vpc.this' },
      { id: 'b', text: 'module.network.aws_vpc.this' },
      { id: 'c', text: 'aws_vpc.this' },
      { id: 'd', text: 'data.module.network.aws_vpc.this' },
    ],
    correct: ['b'],
    explanation:
      'Resources inside modules gain a `module.<name>.` prefix, and nested modules stack it: `module.a.module.b.aws_vpc.this`. You need this form for `state show`, `state mv` and `-target`.',
  },
  {
    id: 'tfq-mod-3',
    domainId: 'tf-modules',
    topicId: 'tf-module-basics',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'You add a `module` block and run `terraform plan`. It fails with "Module not installed". What is missing?',
    options: [
      { id: 'a', text: 'A version argument' },
      { id: 'b', text: 'terraform init' },
      { id: 'c', text: 'terraform get -update' },
      { id: 'd', text: 'A providers map' },
    ],
    correct: ['b'],
    explanation:
      'Modules are installed by `terraform init`, which is not a one-time-only command. The same applies to a new provider or a changed backend. Init is idempotent and takes a second when nothing has changed.',
  },
  {
    id: 'tfq-mod-4',
    domainId: 'tf-modules',
    topicId: 'tf-module-sources',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'beginner',
    points: 2,
    prompt: 'Why does `source = "modules/network"` fail?',
    options: [
      { id: 'a', text: 'Module directories must be named with a terraform- prefix' },
      {
        id: 'b',
        text: 'A local path must begin with ./ or ../, so this is read as a registry address',
      },
      { id: 'c', text: 'Local modules require an accompanying version argument' },
      { id: 'd', text: 'The path must be absolute' },
    ],
    correct: ['b'],
    explanation:
      'Terraform infers the source type from the string. Without a leading `./` or `../` it is treated as a registry address of the form NAMESPACE/NAME/PROVIDER - which is why the error mentions the registry and takes people longer than it should to diagnose.',
  },
  {
    id: 'tfq-mod-5',
    domainId: 'tf-modules',
    topicId: 'tf-module-sources',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'How do you pin a Git-sourced module to tag `v2.3.0`, given that `version` is not allowed?',
    options: [
      { id: 'a', text: 'Append ?ref=v2.3.0 to the source string' },
      { id: 'b', text: 'Add tag = "v2.3.0" to the module block' },
      { id: 'c', text: 'Use version = "v2.3.0" anyway - it works for Git' },
      { id: 'd', text: 'Git sources cannot be pinned' },
    ],
    correct: ['a'],
    explanation:
      'For example `git::https://github.com/acme/modules.git//database?ref=v2.3.0`. `//` selects a subdirectory and `?ref=` pins a tag, branch or commit SHA. Use a tag or SHA - a branch moves under you.',
  },
  {
    id: 'tfq-mod-6',
    domainId: 'tf-modules',
    topicId: 'tf-module-sources',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Why does editing a local module take effect immediately, while editing a Git-sourced one does not?',
    options: [
      { id: 'a', text: 'Local modules are compiled into the plan' },
      {
        id: 'b',
        text: 'Local paths are read in place, while remote sources are cached in .terraform/modules/ until init -upgrade',
      },
      { id: 'c', text: 'Git sources are read-only by design' },
      { id: 'd', text: 'Local modules skip validation' },
    ],
    correct: ['b'],
    explanation:
      'There is no cached copy of a local module to go stale. Remote sources are downloaded once and reused, which is also why editing the cached copy is pointless - the next `init -upgrade` overwrites it.',
  },
  {
    id: 'tfq-mod-7',
    domainId: 'tf-modules',
    topicId: 'tf-module-variables-and-scope',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'The root module declares `variable "environment"`. Can a child module use `var.environment`?',
    options: [
      { id: 'a', text: 'Yes - variables are inherited by child modules' },
      { id: 'b', text: 'Yes, if the module is a local path' },
      { id: 'c', text: 'No - the child must declare its own variable and the caller must pass it' },
      { id: 'd', text: 'Only inside a locals block' },
    ],
    correct: ['c'],
    explanation:
      'There is no variable inheritance in either direction, and locals never cross a module boundary at all. Fixing this requires two edits: declare `variable "environment"` in the module, and pass `environment = var.environment` in the module block.',
  },
  {
    id: 'tfq-mod-8',
    domainId: 'tf-modules',
    topicId: 'tf-module-variables-and-scope',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What DOES a child module inherit from its caller?',
    options: [
      { id: 'a', text: 'Variables and locals' },
      { id: 'b', text: 'Default provider configurations' },
      { id: 'c', text: 'Aliased provider configurations' },
      { id: 'd', text: 'Nothing at all' },
    ],
    correct: ['b'],
    explanation:
      'Default provider configurations are inherited automatically - which is why a module should never declare its own `provider` block. Aliased configurations are not inherited and must be passed with `providers = { ... }`, declared inside the module with `configuration_aliases`.',
  },
  {
    id: 'tfq-mod-9',
    domainId: 'tf-modules',
    topicId: 'tf-module-variables-and-scope',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A module reads a JSON policy file bundled in its own directory. Which path expression is correct?',
    options: [
      { id: 'a', text: 'file("${path.root}/files/policy.json")' },
      { id: 'b', text: 'file("${path.module}/files/policy.json")' },
      { id: 'c', text: 'file("${path.cwd}/files/policy.json")' },
      { id: 'd', text: 'file("./files/policy.json")' },
    ],
    correct: ['b'],
    explanation:
      '`path.module` is the directory of the module containing the expression. `path.root` resolves relative to the root module, so the file is not found whenever the module is called from elsewhere; `path.cwd` depends on where the person ran Terraform.',
  },
  {
    id: 'tfq-mod-10',
    domainId: 'tf-modules',
    topicId: 'tf-module-versioning',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Where is the resolved version of a registry module recorded?',
    options: [
      { id: 'a', text: 'In .terraform.lock.hcl, alongside provider versions' },
      { id: 'b', text: 'In .terraform/modules/modules.json, which is gitignored' },
      { id: 'c', text: 'In the state file' },
      { id: 'd', text: 'Nowhere - it is re-resolved on every command' },
    ],
    correct: ['b'],
    explanation:
      'The lock file records providers only. Module versions live in a gitignored cache, which means the version constraint in your configuration is the *only* reproducibility guarantee for modules - so pin them more narrowly than providers.',
  },
  {
    id: 'tfq-mod-11',
    domainId: 'tf-modules',
    topicId: 'tf-module-versioning',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'Two engineers share a configuration with `version = "~> 5.0"` on a registry module. Their plans differ. Why?',
    options: [
      { id: 'a', text: 'One of them has stale state' },
      {
        id: 'b',
        text: 'There is no module lock file, so each init resolved the constraint at a different time',
      },
      { id: 'c', text: 'The module registry serves different versions per region' },
      { id: 'd', text: 'One of them is in a different workspace' },
    ],
    correct: ['b'],
    explanation:
      'Both are correct according to the configuration: `~> 5.0` permits 5.1.0 and 5.8.2 alike, and nothing pins which was installed. Diagnose by comparing `.terraform/modules/modules.json`; fix by narrowing the constraint.',
  },
  {
    id: 'tfq-mod-12',
    domainId: 'tf-modules',
    topicId: 'tf-module-versioning',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Why should a reusable module declare a permissive provider constraint such as `">= 5.0, < 6.0"`?',
    options: [
      { id: 'a', text: 'Because modules cannot use the ~> operator' },
      {
        id: 'b',
        text: 'Because module and root constraints are intersected, so an exact pin makes the module unusable alongside others',
      },
      { id: 'c', text: 'Because provider constraints in modules are advisory only' },
      { id: 'd', text: 'Because the root always overrides a module’s constraint' },
    ],
    correct: ['b'],
    explanation:
      'Constraints intersect rather than override. An exact pin in a module forces every caller onto that version and conflicts with any other module pinning differently. Modules should be permissive; the root configuration and its lock file choose the specific version.',
  },
]
