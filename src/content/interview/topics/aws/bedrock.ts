import type { InterviewQuestion } from '../../../types'

/**
 * Amazon Bedrock.
 *
 * Increasingly a standard round for platform and DevOps roles, and the one
 * candidates most often answer from marketing copy. What separates a good
 * answer is knowing where the boundaries are: what Bedrock manages and what it
 * does not, what it charges for, and which features exist on the first-party
 * model APIs but not through Bedrock.
 */
export const awsBedrockQuestions: InterviewQuestion[] = [
  {
    id: 'itv-aws-61',
    level: 'basic',
    kind: 'open',
    prompt:
      'What is Amazon Bedrock, and how does it differ from SageMaker or calling a model provider directly?',
    probing:
      'The framing question. A weak answer says "AI service"; a good one says what is managed and what is not.',
    answer: [
      '**Bedrock is a managed API for foundation models.** You call an HTTP endpoint, pass a prompt, and get a completion back. There are no GPUs to provision, no model weights to host, no inference servers to scale. Several providers’ models sit behind one AWS-shaped API - Anthropic’s Claude, Amazon’s Nova, Meta’s Llama, Mistral, Cohere and others.',
      'Against **SageMaker**, the difference is who owns the infrastructure. SageMaker is a platform for building, training and hosting models: you choose instances, manage endpoints, and pay per hour whether or not anything is being served. Bedrock is serverless and pay-per-token. If you are training your own model or hosting an open-weights one you did not get from a provider, that is SageMaker. If you are consuming somebody else’s frontier model, that is Bedrock.',
      'Against **calling the provider directly** - Anthropic’s API, for instance - the differences are commercial and operational rather than technical. With Bedrock you get one AWS bill, IAM instead of a separate API key, CloudTrail auditing, VPC endpoints, and data residency inside your AWS account and region. That matters a great deal in regulated environments, and it is usually the deciding reason.',
      'What you give up is **feature latency and feature coverage**. Bedrock is a partner-operated integration, so new capabilities from the model provider appear there later than on the provider’s own API, and some never appear at all. I would always check the provider’s platform-availability documentation before promising a specific feature on Bedrock - that is the mistake people make when planning.',
      'The mental model I would offer: Bedrock is the **managed inference plane**, not an application. It gives you a model endpoint plus some optional building blocks - Knowledge Bases for retrieval, Guardrails for filtering, Agents for tool use. Everything above that is still your application to build and operate.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Bedrock, SageMaker, or the provider directly?',
        caption: 'The question is who owns the infrastructure, and what you are willing to trade.',
        question: 'What are you actually doing?',
        branches: [
          {
            condition: 'Consuming a frontier model, want AWS billing and IAM',
            result: 'Bedrock',
            detail: 'serverless, pay per token, data stays in your account and region',
            tone: 'success',
          },
          {
            condition: 'Training or hosting your own model',
            result: 'SageMaker',
            detail: 'you choose instances and manage endpoints, billed per hour',
            tone: 'accent',
          },
          {
            condition: 'Need the newest provider features on day one',
            result: 'The provider API directly',
            detail: 'partner integrations lag, and some features never arrive',
            tone: 'warning',
          },
          {
            condition: 'Strict data residency or no-internet-egress rules',
            result: 'Bedrock with VPC endpoints',
            detail: 'traffic never leaves the AWS network',
            tone: 'success',
          },
        ],
      },
    ],
    traps: [
      'Calling Bedrock "AWS’s AI model". It is a hosting and API layer for several providers’ models, most of which AWS did not build.',
      'Assuming feature parity with the model provider’s own API. It lags, sometimes permanently.',
      'Confusing it with SageMaker. Different problem, different billing model.',
    ],
    followUps: [
      'When would you use SageMaker instead?',
      'What do you give up by going through Bedrock?',
      'How is it billed?',
    ],
    tags: ['aws', 'bedrock', 'genai', 'fundamentals'],
  },
  {
    id: 'itv-aws-62',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'Explain Bedrock model IDs and cross-region inference profiles. Why do the profiles exist?',
    probing:
      'A practical detail that trips up every first deployment, and the reason behind it is a capacity story.',
    answer: [
      'A Bedrock model ID identifies a provider and a model. Anthropic’s models carry an `anthropic.` prefix - `anthropic.claude-opus-5`, for example. Other providers have their own prefixes, such as `amazon.nova-pro` or `meta.llama3-...`.',
      'Two things bite people immediately. First, **model access is opt-in per account and per region**: a brand-new account cannot invoke anything until access is requested and granted in the Bedrock console, and that is an account-level action Terraform does not do for you. Second, **not every model is in every region**, so a model ID that works in `us-east-1` may simply not exist in `eu-west-2`.',
      '**Cross-region inference profiles** solve a capacity problem. Frontier models are GPU-constrained, and a single region can run short at peak, which surfaces as throttling. An inference profile is an ID prefixed with a geography - `us.anthropic.claude-opus-5`, `eu.anthropic.claude-opus-5`, `apac....` - that lets Bedrock route your request to any region within that geography that has capacity.',
      'The practical effect is substantially higher effective throughput and far fewer `ThrottlingException`s, at no extra cost per token. For most workloads this is simply the right default, and for some newer models the profile is the **only** way to invoke them on demand.',
      'The trade-off is where inference physically happens. A request sent to the `eu.` profile stays within EU regions, but you no longer control precisely which one. If your compliance position is "this data must be processed in Frankfurt and nowhere else", a cross-region profile does not satisfy it and you need a single-region model ID and the throttling that comes with it. That is the judgement call worth stating.',
    ],
    code: [
      {
        title: 'Discovering what you can actually call',
        language: 'bash',
        explanation:
          'Model access is per-account and per-region. Always confirm before writing the ID into config.',
        code: `# Which models are available in this region?
aws bedrock list-foundation-models --region eu-west-1 \\
  --query 'modelSummaries[?contains(modelId, \`anthropic\`)].[modelId,modelName]' \\
  --output table

# Which inference profiles exist? These are the cross-region IDs.
aws bedrock list-inference-profiles --region eu-west-1 \\
  --query 'inferenceProfileSummaries[].[inferenceProfileId,status]' --output table
#   eu.anthropic.claude-opus-5     ACTIVE
#   eu.anthropic.claude-sonnet-5   ACTIVE

# Has this account been granted access? A denial here is an access
# problem, not an IAM problem - they look identical at first.
aws bedrock get-foundation-model-availability \\
  --model-id anthropic.claude-opus-5 --region eu-west-1

# Smoke test with the profile ID rather than the bare model ID
aws bedrock-runtime converse \\
  --model-id eu.anthropic.claude-opus-5 \\
  --messages '[{"role":"user","content":[{"text":"Reply with OK"}]}]' \\
  --region eu-west-1`,
      },
      {
        title: 'Granting access to exactly the models you intend',
        language: 'hcl',
        explanation:
          'A cross-region profile needs permission on the profile AND on the underlying models in each region it may route to.',
        code: `data "aws_iam_policy_document" "bedrock_invoke" {
  statement {
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      # The inference profile itself
      "arn:aws:bedrock:\${var.region}:\${var.account_id}:inference-profile/eu.anthropic.claude-opus-5",

      # AND the foundation model in every region the profile may route to.
      # Omitting these is the most common cause of a confusing AccessDenied.
      "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-opus-5",
      "arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-opus-5",
      "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-opus-5",
    ]
  }
}`,
      },
    ],
    deeper: [
      'The permission subtlety above is worth remembering: an inference profile can route to several regions, so the IAM policy must allow the foundation model ARN in each of them. A policy that only names the profile produces an `AccessDeniedException` that looks nothing like a routing problem.',
      'Model access approval is a manual, account-level step in the console. It is not in CloudFormation or Terraform, so it belongs in your account-bootstrap runbook rather than in the application pipeline.',
      'Quotas are per-model and per-region and are expressed in requests per minute and tokens per minute. Check both - hitting the token quota while well under the request quota is common with long prompts.',
    ],
    traps: [
      'Hardcoding a bare model ID and being throttled at peak when a cross-region profile would have absorbed it.',
      'Granting IAM on the profile but not on the underlying foundation models in each routed region.',
      'Assuming a model exists in every region. Availability differs considerably.',
    ],
    followUps: [
      'What does a cross-region profile cost extra?',
      'When would you deliberately not use one?',
      'How do you find out which models your account can call?',
    ],
    tags: ['aws', 'bedrock', 'genai', 'configuration'],
  },
  {
    id: 'itv-aws-63',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'You want one code path that works across Claude, Llama and Nova on Bedrock, including tool use. Which API do you use?',
    options: [
      {
        id: 'a',
        text: 'Converse / ConverseStream, which normalises the request and response shape',
      },
      { id: 'b', text: 'InvokeModel, passing each provider’s native request body' },
      { id: 'c', text: 'The SageMaker runtime endpoint for each model' },
      { id: 'd', text: 'A separate provider SDK per model, selected at runtime' },
    ],
    correct: ['a'],
    probing:
      'A design decision with a real trade-off. The interesting part is when you would choose the other one.',
    answer: [
      '**Converse** is Bedrock’s unified API. It defines one request shape - `messages`, `system`, `inferenceConfig`, `toolConfig` - and one response shape, and Bedrock translates to and from each provider’s native format. `ConverseStream` is the streaming equivalent. Swapping models becomes a configuration change rather than a rewrite, which is exactly what the question asks for.',
      '**InvokeModel** is the lower-level call: you send the provider’s own JSON body and get the provider’s own JSON back. That means a Claude request body, a Llama request body and a Nova request body are all different, and your code has to branch.',
      'So why would anyone use InvokeModel? Because **Converse exposes the common denominator**. Provider-specific features that have no equivalent elsewhere are reachable through Converse only via the `additionalModelRequestFields` escape hatch, and some are not exposed at all. Anthropic’s tool search tool, for example, is available on Bedrock through InvokeModel but not through Converse. If you are committed to one provider and want everything it offers, InvokeModel - or the provider’s own SDK pointed at Bedrock - gives you full fidelity.',
      'Option C is wrong because SageMaker is a different service entirely. Option D is closest to a reasonable alternative but it is what Converse exists to save you from, unless you deliberately want per-provider fidelity.',
      'My usual recommendation: **start with Converse** if multi-model portability or model A/B testing matters, and drop to InvokeModel or the provider SDK for the specific route that needs a feature Converse does not surface. Mixing both in one codebase is fine and common.',
    ],
    code: [
      {
        title: 'The same call, three ways',
        language: 'python',
        explanation:
          'Converse is portable. InvokeModel is provider-shaped. The provider SDK is the richest.',
        code: `import json
import boto3

brt = boto3.client("bedrock-runtime", region_name="eu-west-1")

# --- 1. Converse: one shape, any provider -------------------------
resp = brt.converse(
    modelId="eu.anthropic.claude-opus-5",   # swap for meta.llama3... unchanged
    messages=[{"role": "user", "content": [{"text": "Summarise this incident."}]}],
    system=[{"text": "You are a concise SRE assistant."}],
    inferenceConfig={"maxTokens": 4096, "temperature": 0.2},
    toolConfig={"tools": [{"toolSpec": {
        "name": "get_metric",
        "description": "Fetch a CloudWatch metric",
        "inputSchema": {"json": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        }},
    }}]},
)
print(resp["output"]["message"]["content"][0]["text"])
print(resp["usage"])          # inputTokens / outputTokens - same field names always


# --- 2. InvokeModel: the provider's own body ----------------------
raw = brt.invoke_model(
    modelId="eu.anthropic.claude-opus-5",
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": "Summarise this incident."}],
    }),
)
print(json.loads(raw["body"].read())["content"][0]["text"])


# --- 3. The provider SDK, pointed at Bedrock ----------------------
# Full first-party request surface, AWS credentials and endpoint.
from anthropic import AnthropicBedrockMantle

client = AnthropicBedrockMantle(aws_region="eu-west-1")
message = client.messages.create(
    model="anthropic.claude-opus-5",
    max_tokens=4096,
    messages=[{"role": "user", "content": "Summarise this incident."}],
)
print(message.content[0].text)`,
      },
    ],
    deeper: [
      'Converse normalises token accounting too - `usage.inputTokens` and `usage.outputTokens` mean the same thing across providers, which makes cost dashboards and per-request budgets far simpler than parsing each provider’s own usage object.',
      '`additionalModelRequestFields` is the escape hatch for provider-specific parameters within Converse. It works, but anything you put there is by definition not portable, so it undermines the reason you chose Converse.',
      'The provider SDK route (`AnthropicBedrockMantle` for Anthropic) is worth knowing about: AWS credentials and endpoint, but the provider’s full first-party request surface. It is often the best of both when you have settled on one model family.',
    ],
    traps: [
      'Assuming Converse exposes every provider feature. It exposes the intersection plus an escape hatch.',
      'Writing per-provider branching by hand when Converse already does it.',
      'Forgetting that tool use has different shapes in the two APIs - `toolConfig` in Converse, the provider’s own `tools` in InvokeModel.',
    ],
    followUps: [
      'When would you drop to InvokeModel?',
      'What is additionalModelRequestFields for?',
      'How does tool use differ between the two?',
    ],
    tags: ['aws', 'bedrock', 'api', 'genai'],
  },
  {
    id: 'itv-aws-64',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How is Bedrock priced, and what are the levers for reducing that bill?',
    probing:
      'Cost is a platform responsibility. They want the levers in order of value, not a price list.',
    answer: [
      'The default is **on-demand, per token**, priced separately for input and output tokens, with output typically several times the input rate. Every model has its own rates, and Bedrock is partner-operated so the prices are AWS’s own - they are not the model provider’s first-party rates and should be looked up on the Bedrock pricing page rather than assumed.',
      'There are three other modes worth knowing. **Batch inference** submits a job against S3 input and returns S3 output asynchronously, at roughly half the on-demand price - excellent for backfills, bulk classification and evaluation runs where latency does not matter. **Provisioned Throughput** buys dedicated capacity in model units with a time commitment, which is how you get guaranteed throughput and is required for custom fine-tuned models; it is only economic at sustained high volume. And **Marketplace models** are billed per hour of hosting rather than per token.',
      'For reducing the bill, the levers in order of value.',
      '**Prompt caching** is first and is usually the largest single win. A long system prompt, a tool catalogue or a fixed document re-sent on every request is charged in full every time unless you cache it; cached reads are dramatically cheaper. It is supported on Bedrock and it is frequently simply not switched on.',
      '**Input hygiene** comes next: sending an entire document when a retrieved passage would do, resending a whole conversation when a summary would do, or leaving debug context in the prompt. Input tokens are cheaper than output but there are usually far more of them.',
      '**Output hygiene**: cap `maxTokens` deliberately, ask for structured or terse output, and stop the model from restating the question. Output tokens are the expensive ones.',
      '**Then the trade-offs** - a smaller model for the routes that do not need a frontier one, and batch for anything asynchronous. I would put model downgrades last because they trade quality, and I would measure per completed task rather than per request: a cheaper model that needs two attempts is not cheaper.',
      'Operationally, I would turn on **model invocation logging** and per-application cost attribution from day one. Token spend is invisible until you log it, and an application with no per-feature token accounting cannot be optimised, only guessed at.',
    ],
    code: [
      {
        title: 'Caching the stable prefix',
        language: 'python',
        explanation:
          'Cache the system prompt and tool catalogue; leave the varying question after the breakpoint.',
        code: `import boto3

brt = boto3.client("bedrock-runtime", region_name="eu-west-1")

# Order matters: everything BEFORE the cache point must be byte-identical
# on every request, or the cache never hits.
resp = brt.converse(
    modelId="eu.anthropic.claude-opus-5",
    system=[
        {"text": LONG_STABLE_SYSTEM_PROMPT},   # thousands of tokens, unchanged
        {"cachePoint": {"type": "default"}},   # <- cache breakpoint
    ],
    messages=[
        # The volatile part goes AFTER the breakpoint
        {"role": "user", "content": [{"text": user_question}]},
    ],
    inferenceConfig={"maxTokens": 2048},
)

u = resp["usage"]
print(u["inputTokens"], u.get("cacheReadInputTokens"), u.get("cacheWriteInputTokens"))
# cacheReadInputTokens staying at 0 across repeated calls means something
# in the prefix is changing - a timestamp, a request id, unsorted JSON.`,
      },
      {
        title: 'Batch for anything that can wait',
        language: 'bash',
        explanation:
          'Roughly half price, asynchronous, S3 in and S3 out. Ideal for backfills and evaluations.',
        code: `aws bedrock create-model-invocation-job \\
  --job-name nightly-classification \\
  --model-id anthropic.claude-sonnet-5 \\
  --role-arn arn:aws:iam::111122223333:role/BedrockBatchRole \\
  --input-data-config '{"s3InputDataConfig":{"s3Uri":"s3://my-bucket/input/"}}' \\
  --output-data-config '{"s3OutputDataConfig":{"s3Uri":"s3://my-bucket/output/"}}'

aws bedrock get-model-invocation-job --job-identifier "$JOB_ARN" \\
  --query '{status:status,message:message}'

# Note: this is BEDROCK's own batch feature. It is not the same thing as
# the Anthropic Message Batches API, which is not available through Bedrock.`,
      },
    ],
    deeper: [
      'Bedrock pricing is set by AWS and differs from the model provider’s first-party rates. Quoting first-party prices for a Bedrock workload will be wrong - check the Bedrock pricing page for the model and region.',
      'Prompt caching has a minimum cacheable prefix length, so caching a short system prompt silently does nothing. Verify with the cache-read token count in the usage block rather than assuming.',
      'A cost dashboard broken down by feature and by model is the thing that makes all of this manageable. Tag invocations at the application level, because the AWS bill alone will tell you the total and nothing about which feature caused it.',
    ],
    traps: [
      'Reducing quality by downgrading the model before turning on caching, which is free.',
      'Assuming Bedrock charges the model provider’s published rates.',
      'Leaving `maxTokens` at a large default, so a verbose answer costs far more than the task needed.',
    ],
    followUps: [
      'What invalidates a prompt cache?',
      'When is Provisioned Throughput actually worth it?',
      'How would you attribute spend to a feature?',
    ],
    tags: ['aws', 'bedrock', 'cost', 'genai'],
  },
  {
    id: 'itv-aws-65',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain Bedrock Knowledge Bases. How does a question become a grounded answer?',
    probing: 'RAG mechanics through a managed service. They want the pipeline, both halves of it.',
    answer: [
      'A Knowledge Base is Bedrock’s managed retrieval-augmented generation. There are two phases and they run at completely different times, which is the thing to separate clearly.',
      '**Ingestion, offline.** You point the Knowledge Base at a data source - usually an S3 prefix, but also SharePoint, Confluence, Salesforce or a web crawler. Bedrock extracts the text, **chunks** it into passages, sends each chunk to an embedding model, and writes the resulting vectors plus the source text into a **vector store**. Supported stores include OpenSearch Serverless, Aurora PostgreSQL with pgvector, Pinecone, Redis Enterprise and MongoDB Atlas. This is a sync job you re-run when the source data changes - it is not live.',
      '**Query, online.** The user’s question is embedded with the same model, the vector store is searched for the nearest chunks, and those chunks are injected into the prompt with an instruction to answer only from them. The model generates an answer, and Bedrock returns **citations** pointing at the source documents.',
      'Two API shapes: `Retrieve` gives you the chunks and lets you build the prompt yourself, and `RetrieveAndGenerate` does the whole thing and hands back an answer with citations. `Retrieve` is the one I would usually choose for anything non-trivial, because it lets you control the prompt, filter results, re-rank, and mix in other context.',
      'The reason to use the managed version rather than building it is that chunking, embedding, sync orchestration and vector-store plumbing are genuinely tedious, and Knowledge Bases handles all of it including incremental sync. The reason not to is control: chunking strategy, retrieval scoring, hybrid search and re-ranking are where RAG quality is actually won, and a managed pipeline gives you fewer levers than a hand-built one.',
      'The point worth making at the end: **RAG quality is a retrieval problem far more often than a generation problem.** If the answer is wrong, the usual cause is that the right passage was never retrieved, and no amount of prompt tuning fixes that.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Knowledge Base: ingestion and query',
        caption:
          'Ingestion is a batch job. Query is a live nearest-neighbour search plus a prompt.',
        nodes: [
          {
            label: 'Source documents in S3',
            detail: 'PDFs, HTML, text - re-synced when they change',
            tone: 'accent',
          },
          {
            label: 'Chunk',
            detail: 'fixed size, semantic or hierarchical - this choice decides quality',
            arrowLabel: 'ingestion',
            tone: 'warning',
          },
          {
            label: 'Embed and store vectors',
            detail: 'OpenSearch Serverless, Aurora pgvector, Pinecone',
            arrowLabel: 'offline',
          },
          {
            label: 'User question embedded',
            detail: 'same embedding model, or the vectors are not comparable',
            arrowLabel: 'query time',
            tone: 'accent',
          },
          {
            label: 'Nearest chunks retrieved',
            detail: 'top-k by vector similarity, optionally filtered by metadata',
            arrowLabel: 'search',
          },
          {
            label: 'Chunks injected into the prompt',
            detail: 'answer only from these, and cite them',
            arrowLabel: 'ground',
            tone: 'success',
          },
          {
            label: 'Answer with citations',
            detail: 'citations are what make it auditable',
            arrowLabel: 'generate',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Retrieve versus RetrieveAndGenerate',
        language: 'python',
        explanation:
          'RetrieveAndGenerate is one call. Retrieve gives you the chunks so you own the prompt.',
        code: `import boto3

agent = boto3.client("bedrock-agent-runtime", region_name="eu-west-1")

# One call: retrieval, prompting and generation, with citations returned.
resp = agent.retrieve_and_generate(
    input={"text": "What is our incident escalation policy?"},
    retrieveAndGenerateConfiguration={
        "type": "KNOWLEDGE_BASE",
        "knowledgeBaseConfiguration": {
            "knowledgeBaseId": "KB1234567890",
            "modelArn": "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-opus-5",
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {
                    "numberOfResults": 8,
                    # Metadata filters are the underused feature here
                    "filter": {"equals": {"key": "team", "value": "platform"}},
                }
            },
        },
    },
)
print(resp["output"]["text"])
for c in resp["citations"]:
    for ref in c["retrievedReferences"]:
        print("source:", ref["location"]["s3Location"]["uri"])


# Retrieve only - you own the prompt, the filtering and the re-ranking.
# This is what I would use for anything beyond a demo.
chunks = agent.retrieve(
    knowledgeBaseId="KB1234567890",
    retrievalQuery={"text": "incident escalation policy"},
    retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": 20}},
)
for r in chunks["retrievalResults"]:
    print(round(r["score"], 3), r["content"]["text"][:80])`,
      },
    ],
    deeper: [
      'Chunking strategy is the highest-leverage decision in the whole pipeline. Fixed-size chunks split tables and procedures mid-thought; hierarchical or semantic chunking keeps a passage coherent, which is what makes the retrieved context usable.',
      'Metadata filtering is underused and very powerful: tagging chunks by team, product, environment or date and filtering at query time removes whole classes of wrong-document retrieval before scoring even happens.',
      'Re-ranking a generous candidate set - retrieve 20, re-rank, keep 5 - reliably beats retrieving 5 directly, because vector similarity alone is a coarse relevance signal.',
    ],
    traps: [
      'Expecting a Knowledge Base to update live. Ingestion is a sync job; new documents are invisible until it runs.',
      'Changing the embedding model without re-ingesting. Old and new vectors are not comparable and retrieval quietly degrades.',
      'Tuning the prompt when the real failure is that the right chunk was never retrieved.',
    ],
    followUps: [
      'How would you debug a wrong answer?',
      'Why does chunking matter so much?',
      'When would you build RAG yourself instead?',
    ],
    tags: ['aws', 'bedrock', 'rag', 'genai'],
  },
  {
    id: 'itv-aws-66',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these does a Bedrock Guardrail actually enforce? Select all that apply.',
    options: [
      { id: 'a', text: 'Content filters for hate, violence, sexual content and prompt attacks' },
      { id: 'b', text: 'Denied topics defined in natural language, such as investment advice' },
      { id: 'c', text: 'Detecting and redacting or blocking PII such as card numbers and emails' },
      { id: 'd', text: 'Contextual grounding checks that flag answers unsupported by the source' },
      { id: 'e', text: 'Guaranteeing the model never produces a factually incorrect statement' },
    ],
    correct: ['a', 'b', 'c', 'd'],
    probing:
      'Whether you know what a guardrail can and cannot promise. The last option is the one being tested.',
    answer: [
      'A Guardrail is a configurable policy layer that Bedrock applies **around** the model - it evaluates the input before the model sees it and the output before you do. It is independent of the model, so the same guardrail applies across models, and it is versioned so changes can be reviewed and rolled back.',
      '**A** - content filters cover several harm categories with configurable strength, plus prompt-attack detection aimed at jailbreak and injection attempts.',
      '**B** - denied topics are described in plain language with a few examples, which is much easier to maintain than a keyword list and catches paraphrases a word filter never would.',
      '**C** - sensitive information filters detect PII and can either block the request or redact the matched spans, with custom regex patterns alongside the built-in types.',
      '**D** - contextual grounding compares the answer against the source material you supply and scores relevance and grounding, blocking answers below a threshold. This is the practical defence against a RAG system confidently answering from outside its retrieved context.',
      '**E is the distractor, and it is the important one.** No guardrail makes a model factually correct. Grounding checks verify that an answer is supported by the passages you provided - if those passages are wrong, a well-grounded answer is confidently wrong. Guardrails reduce categories of harm and policy violation; they do not confer truthfulness.',
      'The detail worth adding: the **ApplyGuardrail** API lets you evaluate text against a guardrail without invoking a model at all. That means you can screen content from a model you host elsewhere, or check user input before it enters your pipeline, which makes the guardrail a reusable policy component rather than a Bedrock-invocation setting.',
    ],
    code: [
      {
        title: 'Applying a guardrail, and using it standalone',
        language: 'python',
        explanation:
          'Attach it to a Converse call, or evaluate text on its own with ApplyGuardrail.',
        code: `import boto3

brt = boto3.client("bedrock-runtime", region_name="eu-west-1")

# Attached to a normal invocation
resp = brt.converse(
    modelId="eu.anthropic.claude-opus-5",
    messages=[{"role": "user", "content": [{"text": user_input}]}],
    guardrailConfig={
        "guardrailIdentifier": "gr-abc123",
        "guardrailVersion": "3",          # pin the version, never use DRAFT in prod
        "trace": "enabled",               # returns WHY something was blocked
    },
)

if resp["stopReason"] == "guardrail_intervened":
    # Do not show the raw block reason to the end user - log it, return
    # a neutral message. The trace tells you which policy fired.
    print(resp.get("trace", {}).get("guardrail"))

# Standalone: screen text with no model invocation at all
check = brt.apply_guardrail(
    guardrailIdentifier="gr-abc123",
    guardrailVersion="3",
    source="INPUT",                      # or OUTPUT
    content=[{"text": {"text": user_input}}],
)
print(check["action"])                   # NONE | GUARDRAIL_INTERVENED`,
      },
    ],
    deeper: [
      'Pin the guardrail version in production. `DRAFT` changes the moment somebody edits the guardrail in the console, which means your production policy can change without a deployment.',
      'Guardrails are evaluated on both input and output and are billed per text unit in each direction, so a chatty application pays for them twice per turn. That is usually worth it, but it should be a deliberate decision.',
      'Guardrails are a defence layer, not a boundary. Anything that must not happen - a destructive action, a payment - should be enforced in your own code by authorisation checks, not by asking the model nicely and filtering the answer.',
    ],
    followUps: [
      'What is the ApplyGuardrail API for?',
      'How would you stop a RAG system answering outside its sources?',
      'Why should a guardrail version be pinned?',
    ],
    tags: ['aws', 'bedrock', 'security', 'genai'],
  },
  {
    id: 'itv-aws-67',
    level: 'advanced',
    kind: 'open',
    prompt:
      'Your security team asks where the data goes when you call Bedrock. What is your answer?',
    probing:
      'The question that decides whether Bedrock is approved at all. Precision matters more than reassurance.',
    answer: [
      'I would answer in four parts, because "is it safe" is really four separate questions.',
      '**Where the data goes.** A Bedrock invocation stays within AWS. The request goes to the Bedrock service endpoint in your chosen region, and with a **VPC interface endpoint (PrivateLink)** it never traverses the public internet at all - which is usually what the security team is actually asking. The model provider does not receive your prompts; AWS hosts the model weights and runs the inference.',
      '**Whether it is used for training.** AWS states that prompts and completions are not used to train the underlying foundation models and are not shared with model providers. That is the contractual answer, and for a regulated environment I would point the team at the AWS service terms rather than paraphrasing it - this is a question where the exact wording matters and it should be verified for the current terms rather than taken from memory.',
      '**What is retained and logged.** By default, **model invocation logging is off**. When you turn it on, full request and response bodies are written to S3 or CloudWatch Logs - in your account, under your control, and encrypted with your KMS key if you configure one. That is enormously useful for debugging and audit and it is also a new place where sensitive prompts now live, so its retention and access control need the same scrutiny as any other data store. CloudTrail separately records the API calls themselves - who invoked what, when - but not the prompt contents.',
      '**How access is controlled.** IAM, with `bedrock:InvokeModel` scoped to specific model ARNs rather than `*`. Guardrails can strip PII before it reaches the model. Custom fine-tuned models and their training data are encrypted, and can use a customer-managed KMS key.',
      'The residency caveat I would raise unprompted: **cross-region inference profiles route within a geography, not within a region.** If the requirement is that data is processed only in one named region, a profile does not satisfy it and you need a single-region model ID. That detail gets missed and it is exactly the kind of thing an auditor finds later.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'What sits where',
        caption:
          'With PrivateLink nothing leaves the AWS network. Logging is yours and is off by default.',
        root: {
          label: 'Your AWS account',
          detail: 'IAM, KMS, CloudTrail, VPC',
          children: [
            {
              label: 'VPC with a Bedrock interface endpoint',
              detail: 'PrivateLink - no internet gateway, no NAT, no public egress',
              tone: 'success',
              children: [
                {
                  label: 'Your application',
                  detail: 'calls bedrock-runtime with an IAM role, not an API key',
                  tone: 'accent',
                },
              ],
            },
            {
              label: 'Model invocation logs in S3 or CloudWatch',
              detail: 'OFF by default - full prompts once enabled, so treat as sensitive',
              tone: 'warning',
            },
            {
              label: 'CloudTrail',
              detail: 'records who invoked what and when, not the prompt contents',
              tone: 'accent',
            },
          ],
        },
      },
    ],
    code: [
      {
        title: 'Private access and scoped permissions',
        language: 'hcl',
        explanation:
          'PrivateLink plus an endpoint policy, so only approved models are reachable from the VPC.',
        code: `# Bedrock over PrivateLink - traffic never leaves the AWS network
resource "aws_vpc_endpoint" "bedrock_runtime" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.\${var.region}.bedrock-runtime"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.bedrock.id]
  private_dns_enabled = true

  # An endpoint policy is a second gate: even a role with broad IAM
  # cannot reach an unapproved model through this VPC.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
      Resource  = [
        "arn:aws:bedrock:\${var.region}::foundation-model/anthropic.claude-opus-5",
      ]
    }]
  })
}

# Invocation logging, encrypted, into a bucket you control
resource "aws_bedrock_model_invocation_logging_configuration" "this" {
  logging_config {
    embedding_data_delivery_enabled = false
    image_data_delivery_enabled     = false
    text_data_delivery_enabled      = true

    s3_config {
      bucket_name = aws_s3_bucket.bedrock_logs.id
      key_prefix  = "invocations/"
    }
  }
}`,
      },
    ],
    deeper: [
      'Enabling invocation logging creates a new sensitive data store: full prompts and completions, which may contain whatever users typed. Give it a retention policy, KMS encryption and restricted access before you turn it on, not after.',
      'An **endpoint policy** on the VPC endpoint is a genuinely useful second control. IAM says what a principal may do; the endpoint policy says what may be reached through this network path, and the two together are much harder to misconfigure than either alone.',
      'For data-residency claims, verify the current AWS service terms rather than repeating what was true last year. Terms and regional behaviour change, and this is the one area where being approximately right is not good enough.',
    ],
    traps: [
      'Saying "AWS does not train on your data" without being able to point at the terms that say so.',
      'Enabling invocation logging without treating the log bucket as sensitive.',
      'Claiming single-region residency while using a cross-region inference profile.',
    ],
    followUps: [
      'What does a VPC endpoint policy add over IAM?',
      'What exactly does CloudTrail capture for Bedrock?',
      'How would you satisfy a strict single-region requirement?',
    ],
    tags: ['aws', 'bedrock', 'security', 'compliance'],
  },
  {
    id: 'itv-aws-68',
    level: 'advanced',
    kind: 'open',
    prompt:
      'A model is not giving good answers on your domain. How do you choose between prompting, RAG, fine-tuning and continued pre-training?',
    probing:
      'The decision people get wrong most expensively. Fine-tuning is reached for far too early.',
    answer: [
      'I would work up the ladder, because the cheap options solve most cases and the expensive ones are frequently the wrong tool entirely.',
      '**Prompt engineering first.** Clear instructions, a few good examples, an explicit output format, and a system prompt that states the role and the constraints. This is free, instant to iterate on, and resolves a large share of "the model is not good at our domain" complaints - which are often really "we asked vaguely".',
      '**RAG second, and this is the usual right answer.** If the gap is **knowledge** - the model does not know your products, your runbooks, your policies, this quarter’s data - then retrieval is the fix, not training. RAG updates the instant the source document changes, it cites its sources so answers are auditable, and it costs nothing to correct a wrong fact. Fine-tuning bakes knowledge into weights where it is expensive to change and impossible to cite.',
      '**Fine-tuning third, and for a different problem.** Fine-tuning teaches **behaviour and form**, not facts: a house tone of voice, a rigid output structure, a classification task with domain-specific labels, or consistency that prompting cannot quite pin down. It needs a curated labelled dataset, it produces a model that must be served on **Provisioned Throughput** on Bedrock - so there is a standing cost rather than a per-token one - and it has to be redone when you want to move to a newer base model. That last point is what makes people regret it.',
      '**Continued pre-training last**, and rarely. It adapts a base model to an unusual domain vocabulary - specialised legal, clinical or scientific language - using large volumes of unlabelled text. It is expensive, slow, and only justified when the domain language itself is genuinely outside the base model’s distribution.',
      'The test I would apply: **is the gap knowledge or behaviour?** Knowledge gaps go to RAG. Behaviour gaps go to prompting first and fine-tuning only if prompting demonstrably cannot get there. And the combination is common and sensible - a fine-tuned model that also retrieves is normal for high-volume, narrow tasks.',
      'One more practical point: before any of this, **build an evaluation set**. Without a way to measure whether a change helped, you cannot tell fine-tuning from prompt luck, and every subsequent decision is guesswork. That is the step teams skip and then cannot explain why quality regressed.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which lever does this problem need?',
        caption: 'Knowledge gaps are retrieval problems. Fine-tuning is for behaviour.',
        question: 'What exactly is the model getting wrong?',
        branches: [
          {
            condition: 'Vague, unstructured or inconsistent answers',
            result: 'Prompt engineering',
            detail: 'free, instant, and fixes more cases than people expect',
            tone: 'success',
          },
          {
            condition: 'Does not know your data, or the data changes',
            result: 'RAG',
            detail: 'updates instantly, cites sources, cheap to correct',
            tone: 'success',
          },
          {
            condition: 'Needs a specific tone, format or label set',
            result: 'Fine-tuning',
            detail: 'needs labelled data and Provisioned Throughput to serve',
            tone: 'warning',
          },
          {
            condition: 'Domain vocabulary outside the base model entirely',
            result: 'Continued pre-training',
            detail: 'expensive, slow, rarely the right answer',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'On Bedrock a fine-tuned custom model cannot be invoked on demand - it must be served on Provisioned Throughput, which converts a variable per-token cost into a fixed commitment. That economics change is often the deciding factor and it surprises people who budgeted for fine-tuning as a one-off training cost.',
      'Fine-tuning is tied to a base model version. When a materially better base model ships, you either stay on the old one or repeat the training and re-validate - a maintenance commitment, not a one-time project.',
      'RAG and fine-tuning are complementary rather than competing. A fine-tuned model that retrieves gets consistent form and current facts; choosing between them as if they were alternatives is the framing error.',
    ],
    traps: [
      'Fine-tuning to teach facts. Those belong in retrieval, where they can be corrected and cited.',
      'Skipping the evaluation set, which makes every later comparison unmeasurable.',
      'Ignoring that a custom model on Bedrock needs Provisioned Throughput to serve.',
    ],
    followUps: [
      'Why is fine-tuning a poor way to add knowledge?',
      'What does a custom model cost to serve on Bedrock?',
      'How would you measure whether any of this helped?',
    ],
    tags: ['aws', 'bedrock', 'rag', 'fine-tuning', 'genai'],
  },
  {
    id: 'itv-aws-69',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Your Bedrock-backed feature starts returning ThrottlingException under load. Walk me through your response.',
    probing:
      'A production incident with a specific set of fixes. The order matters - some are instant, some take weeks.',
    answer: [
      'Throttling means you have exceeded a Bedrock quota, which is enforced **per model, per region, per account** and expressed both as requests per minute and tokens per minute. The first thing I would establish is which of those two you are hitting, because long prompts exhaust the token quota while well under the request quota, and the fixes differ.',
      '**Immediate mitigation, in order of how fast it takes effect.**',
      'Confirm the client is retrying properly. The AWS SDKs retry with exponential backoff, but the default `standard` mode is conservative; `adaptive` mode adds client-side rate limiting that responds to throttling, and raising `max_attempts` absorbs short spikes. Getting this right converts a user-visible error into added latency, which is a much better failure.',
      'Switch to a **cross-region inference profile** if you are not already on one. This is the single highest-value change: it routes across regions within a geography and materially raises effective throughput, at no extra per-token cost and with a one-line change to the model ID.',
      'Shed load deliberately. Queue anything asynchronous through SQS with a consumer that respects a concurrency limit, so a burst becomes a backlog rather than a wall of errors. Anything that does not need to be interactive should move to **batch inference** entirely, which does not compete with your live traffic.',
      '**Then the structural fixes.** Request a quota increase through Service Quotas - real, but it takes time and is not an incident response. Consider **Provisioned Throughput** if the load is sustained and predictable, which buys dedicated capacity in model units; it is a commitment, so it wants a genuine forecast rather than a panic. And route by need: if a cheaper model handles a portion of the traffic acceptably, moving that portion off the frontier model relieves the constrained quota directly.',
      'One thing I would look at before scaling anything: **is the traffic legitimate?** A retry storm from a client that retries on the wrong errors, or a loop calling the model per row where a batch would do, can generate the load itself. Fixing that is better than buying capacity for it.',
      'And for prevention: alert on the throttle rate and on token consumption against quota, not just on errors. Throttling starts as a trickle of retries long before it becomes an outage, and that early signal is visible in CloudWatch if anybody is looking at it.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Throttling response, fastest first',
        caption: 'The first three take minutes. The last two take days or weeks.',
        nodes: [
          {
            label: 'Confirm which quota',
            detail: 'requests per minute or tokens per minute - different fixes',
            tone: 'accent',
          },
          {
            label: 'Fix client retry behaviour',
            detail: 'adaptive mode plus more attempts turns errors into latency',
            arrowLabel: 'minutes',
            tone: 'success',
          },
          {
            label: 'Move to a cross-region profile',
            detail: 'one-line model ID change, no extra per-token cost',
            arrowLabel: 'minutes',
            tone: 'success',
          },
          {
            label: 'Queue and shed load',
            detail: 'SQS for anything async, batch inference for bulk work',
            arrowLabel: 'hours',
            tone: 'accent',
          },
          {
            label: 'Quota increase or Provisioned Throughput',
            detail: 'real fixes, but days to weeks - not incident response',
            arrowLabel: 'later',
            tone: 'warning',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Client-side resilience that actually helps',
        language: 'python',
        explanation:
          'Adaptive retry mode rate-limits the client in response to throttling rather than hammering.',
        code: `import boto3
from botocore.config import Config

# adaptive mode adds client-side rate limiting on top of exponential backoff.
brt = boto3.client(
    "bedrock-runtime",
    region_name="eu-west-1",
    config=Config(
        retries={"max_attempts": 8, "mode": "adaptive"},
        read_timeout=300,        # long generations need a generous read timeout
        connect_timeout=10,
    ),
)

# Cross-region profile: the "eu." prefix is the whole change.
MODEL = "eu.anthropic.claude-opus-5"

def ask(prompt: str) -> str:
    resp = brt.converse(
        modelId=MODEL,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 2048},
    )
    return resp["output"]["message"]["content"][0]["text"]`,
      },
      {
        title: 'See it coming',
        language: 'bash',
        explanation:
          'Throttling shows up in CloudWatch well before users notice. Alert on the rate.',
        code: `# Throttles by model - the metric to alert on
aws cloudwatch get-metric-statistics \\
  --namespace AWS/Bedrock --metric-name InvocationThrottles \\
  --dimensions Name=ModelId,Value=anthropic.claude-opus-5 \\
  --start-time "$(date -u -d '3 hours ago' +%FT%TZ)" \\
  --end-time "$(date -u +%FT%TZ)" --period 300 --statistics Sum

# Token consumption - the quota you are probably actually hitting
aws cloudwatch get-metric-statistics \\
  --namespace AWS/Bedrock --metric-name InputTokenCount \\
  --dimensions Name=ModelId,Value=anthropic.claude-opus-5 \\
  --start-time "$(date -u -d '1 hour ago' +%FT%TZ)" \\
  --end-time "$(date -u +%FT%TZ)" --period 60 --statistics Sum

# What are the quotas in this account and region?
aws service-quotas list-service-quotas --service-code bedrock \\
  --query 'Quotas[?contains(QuotaName, \`Claude\`)].[QuotaName,Value]' --output table`,
      },
    ],
    deeper: [
      'Quotas are per model, per region and per account, so a second account or a second region is itself a capacity lever - and one that many teams reach for before Provisioned Throughput, because it needs no commitment.',
      'Provisioned Throughput is sold in model units with a time commitment. It guarantees throughput but converts a variable cost into a fixed one, so it needs a forecast; buying it during an incident is how teams end up over-committed.',
      'Streaming does not reduce quota consumption, but it changes the user experience under load considerably - first tokens arrive quickly even when the full generation is slow, which buys patience while you fix the underlying capacity.',
    ],
    traps: [
      'Requesting a quota increase as the immediate response. It is the right fix and the wrong timescale.',
      'Retrying aggressively without backoff, which deepens the throttling you are trying to escape.',
      'Buying Provisioned Throughput during an incident, on peak numbers rather than sustained ones.',
    ],
    followUps: [
      'Requests per minute or tokens per minute - how would you tell?',
      'What does adaptive retry mode do differently?',
      'When is Provisioned Throughput the right call?',
    ],
    tags: ['aws', 'bedrock', 'scaling', 'incident', 'genai'],
  },
  {
    id: 'itv-aws-70',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Users report that your RAG assistant gives confidently wrong answers. How do you debug it?',
    probing:
      'The most common production GenAI failure. A good answer separates retrieval from generation before touching either.',
    answer: [
      'The first move is to find out **which half is broken**, because prompt tuning cannot fix a retrieval failure and better retrieval cannot fix a bad prompt. I would take a specific wrong answer and ask: was the correct passage retrieved at all?',
      'Calling `Retrieve` directly with the user’s question and reading the chunks answers that in a minute. Two very different worlds follow.',
      '**If the right chunk was not retrieved**, it is a retrieval problem, and the causes are well-worn. The document may never have been ingested - a failed or stale sync job, an unsupported file type, a PDF that is scanned images with no text layer. The **chunking** may have split the answer across two chunks so neither is individually relevant, which is what fixed-size chunking does to tables and procedures. The question may use vocabulary the document does not - users say "laptop broken", the policy says "hardware asset replacement" - which is exactly where pure vector search is weak and hybrid keyword-plus-vector search helps. Or `numberOfResults` is simply too small.',
      '**If the right chunk was retrieved and the answer is still wrong**, it is a generation problem. Usually the prompt does not instruct the model firmly enough to answer only from the context and to say when it cannot; sometimes conflicting chunks were retrieved - an old policy and a new one - and the model picked one; sometimes the answer is in the context but the question was ambiguous.',
      'For fixes I would go in this order. Verify ingestion actually covers the corpus. Improve **chunking** to keep semantically complete passages together, with overlap so a boundary does not sever an answer. Add **metadata filtering** so a question about one product cannot retrieve another’s documentation. Retrieve generously and **re-rank** down to a small set. Then tighten the prompt to require grounding and permit "I do not know". Finally add a **contextual grounding guardrail** so an unsupported answer is blocked rather than shown.',
      'And the thing I would insist on: build an **evaluation set** of real questions with known-correct answers and known source documents, and score both retrieval and answer quality separately. Without it every change is a vibe, regressions are invisible, and you cannot tell whether last week’s fix helped. Confidently wrong answers are a trust problem, and the way out is measurement, not intuition.',
      'Stale content deserves its own mention because it is so common: the retrieval worked perfectly and returned a document that is eighteen months out of date. Ingesting a date and filtering or down-weighting old material handles what no amount of prompt tuning will.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Split the problem before fixing it',
        caption: 'Look at the retrieved chunks first. The answer changes everything downstream.',
        question: 'Was the correct passage in the retrieved chunks?',
        branches: [
          {
            condition: 'No - and it is not in the vector store at all',
            result: 'Ingestion problem',
            detail: 'failed sync, unsupported format, scanned PDF with no text layer',
            tone: 'danger',
          },
          {
            condition: 'No - it is indexed but scored too low',
            result: 'Retrieval problem',
            detail: 'chunking, vocabulary mismatch, top-k too small, no re-ranking',
            tone: 'warning',
          },
          {
            condition: 'Yes - but the answer contradicts it',
            result: 'Generation problem',
            detail: 'prompt does not enforce grounding or allow saying I do not know',
            tone: 'warning',
          },
          {
            condition: 'Yes - but the source itself is out of date',
            result: 'Content problem',
            detail: 'no prompt fixes a stale document - filter or re-weight by date',
            tone: 'accent',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Look at what was actually retrieved',
        language: 'python',
        explanation:
          'One call separates a retrieval failure from a generation failure. Do this before anything else.',
        code: `import boto3

agent = boto3.client("bedrock-agent-runtime", region_name="eu-west-1")

def inspect(question: str, k: int = 20) -> None:
    """Print what retrieval actually returned, with scores."""
    res = agent.retrieve(
        knowledgeBaseId="KB1234567890",
        retrievalQuery={"text": question},
        retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": k}},
    )
    for i, r in enumerate(res["retrievalResults"], 1):
        src = r["location"]["s3Location"]["uri"].rsplit("/", 1)[-1]
        print(f"{i:2}. {r['score']:.3f}  {src}")
        print(f"     {r['content']['text'][:120]}...")

inspect("What is our incident escalation policy?")

# Reading this output tells you which problem you have:
#   correct doc absent entirely   -> ingestion
#   correct doc present, rank 17  -> retrieval scoring / chunking
#   correct doc at rank 1         -> generation or prompt`,
      },
      {
        title: 'A prompt that refuses to guess',
        language: 'text',
        explanation:
          'Explicit permission to say "I do not know" is the single most effective anti-hallucination instruction.',
        code: `You answer questions using ONLY the reference passages provided below.

Rules:
- If the passages do not contain the answer, say exactly:
  "I could not find that in the documentation." Do not guess, and do not
  use general knowledge to fill the gap.
- Cite the source document for every factual claim you make.
- If two passages conflict, say so and quote both rather than choosing.
- If a passage is dated and a newer one exists, prefer the newer and say
  which you used.

Reference passages:
{retrieved_chunks}

Question: {user_question}`,
      },
    ],
    deeper: [
      'Score the two halves separately in your eval set: retrieval recall ("was the right document in the top k?") and answer correctness. A single end-to-end score tells you something is wrong but never which half, which is why teams tune prompts for weeks against a retrieval bug.',
      'Hybrid search - vector similarity combined with keyword matching - is the standard fix for vocabulary mismatch, and it is where pure semantic search most often disappoints in practice.',
      'Explicitly permitting "I do not know" is disproportionately effective. A model given no acceptable way to decline will produce something, and that something is the confidently wrong answer users are complaining about.',
    ],
    traps: [
      'Tuning the prompt before looking at the retrieved chunks. Half the time the passage was never there.',
      'Assuming a document is indexed. A scanned PDF with no text layer ingests as nothing at all.',
      'Shipping changes with no evaluation set, so nobody can tell whether quality improved or regressed.',
    ],
    followUps: [
      'How would you measure retrieval quality separately?',
      'What is hybrid search and when does it help?',
      'How do you stop stale documents being returned?',
    ],
    tags: ['aws', 'bedrock', 'rag', 'troubleshooting', 'genai'],
  },
  {
    id: 'itv-aws-71',
    level: 'advanced',
    kind: 'open',
    prompt:
      'What would you monitor for a production Bedrock application, and what would you alert on?',
    probing:
      'Observability for a non-deterministic dependency. It differs from a normal service in ways worth naming.',
    answer: [
      'A Bedrock-backed feature has all the usual concerns plus three that a normal service does not have: **token cost per request**, **answer quality**, and a dependency whose latency varies with output length rather than with load.',
      '**The service metrics** come from CloudWatch under `AWS/Bedrock`: `Invocations`, `InvocationLatency`, `InvocationClientErrors`, `InvocationServerErrors`, `InvocationThrottles`, and the token counters `InputTokenCount` and `OutputTokenCount`. I would alert on throttles above zero for a sustained period, on the server-error rate, and on p99 latency - but for latency I would track it **per output length**, because a slow response to a request that generated 4,000 tokens is expected and a slow response to a 50-token answer is not.',
      '**Cost, as a first-class metric.** Tokens per request, broken down by feature and by model. This is the number that turns a surprise bill into a tracked trend, and it is also a genuine reliability signal: a sudden rise in input tokens usually means a prompt-construction bug - an unbounded conversation history, a document being included twice, retrieval returning far more than intended.',
      '**Quality**, which is the one people omit because it is hard. The proxies that work: the rate at which the model says it cannot answer, guardrail intervention rate, user feedback if you collect it, retrieval score distributions for a RAG system, and the rate of responses that hit `maxTokens` - which means truncated answers users are seeing. A periodic automated evaluation against a fixed question set is the stronger version, and it catches quality regressions from a model version change that nothing else would.',
      '**Application-level tracing** ties it together: one trace per user request covering retrieval, model invocation and any tool calls, tagged with model ID, token counts, latency and whether a guardrail fired. Without that, "the assistant is slow" is unanswerable, because you cannot tell retrieval time from generation time.',
      'And **model invocation logging** to S3 for the prompts and completions themselves - sampled rather than complete if volume or sensitivity makes full logging impractical. When somebody reports a bad answer, this is the only thing that lets you see what actually happened.',
      'The alerts I would actually page on are narrow: sustained throttling, elevated server errors, and a step change in cost per request. Quality degradation and rising truncation rates open tickets rather than waking anyone, because they need investigation rather than immediate action.',
    ],
    code: [
      {
        title: 'What to record per invocation',
        language: 'python',
        explanation:
          'Token counts and latency per feature is the minimum. Without it, cost and quality are invisible.',
        code: `import time
import boto3

brt = boto3.client("bedrock-runtime", region_name="eu-west-1")
cw = boto3.client("cloudwatch")

def invoke_tracked(feature: str, model: str, messages: list) -> dict:
    started = time.monotonic()
    resp = brt.converse(
        modelId=model,
        messages=messages,
        inferenceConfig={"maxTokens": 2048},
    )
    elapsed_ms = (time.monotonic() - started) * 1000
    usage = resp["usage"]

    cw.put_metric_data(
        Namespace="App/Bedrock",
        MetricData=[
            {
                "MetricName": name,
                "Value": value,
                "Unit": unit,
                # Dimension by FEATURE, not just by model - this is what
                # makes the cost dashboard actionable.
                "Dimensions": [
                    {"Name": "Feature", "Value": feature},
                    {"Name": "Model", "Value": model},
                ],
            }
            for name, value, unit in [
                ("InputTokens", usage["inputTokens"], "Count"),
                ("OutputTokens", usage["outputTokens"], "Count"),
                ("LatencyMs", elapsed_ms, "Milliseconds"),
                # Truncation means users are seeing cut-off answers
                ("Truncated", 1 if resp["stopReason"] == "max_tokens" else 0, "Count"),
            ]
        ],
    )
    return resp`,
      },
      {
        title: 'The alarms worth having',
        language: 'bash',
        explanation: 'Throttling and a cost step change. The rest opens tickets, not pages.',
        code: `# Sustained throttling - page
aws cloudwatch put-metric-alarm \\
  --alarm-name bedrock-throttling \\
  --namespace AWS/Bedrock --metric-name InvocationThrottles \\
  --dimensions Name=ModelId,Value=anthropic.claude-opus-5 \\
  --statistic Sum --period 300 --evaluation-periods 2 \\
  --threshold 10 --comparison-operator GreaterThanThreshold

# Cost per request stepped up - usually a prompt-construction bug
aws cloudwatch put-metric-alarm \\
  --alarm-name bedrock-input-tokens-per-request \\
  --metrics '[
    {"Id":"tokens","MetricStat":{"Metric":{"Namespace":"App/Bedrock",
      "MetricName":"InputTokens","Dimensions":[{"Name":"Feature","Value":"assistant"}]},
      "Period":300,"Stat":"Sum"},"ReturnData":false},
    {"Id":"calls","MetricStat":{"Metric":{"Namespace":"App/Bedrock",
      "MetricName":"LatencyMs","Dimensions":[{"Name":"Feature","Value":"assistant"}]},
      "Period":300,"Stat":"SampleCount"},"ReturnData":false},
    {"Id":"per_request","Expression":"tokens/calls","ReturnData":true}]' \\
  --evaluation-periods 3 --threshold 20000 \\
  --comparison-operator GreaterThanThreshold

# Answers being truncated - a ticket, not a page
#   App/Bedrock Truncated Sum > 0 sustained`,
      },
    ],
    deeper: [
      'Latency correlates with output tokens, not with load, so a raw p99 is misleading. Track time-to-first-token separately from total duration - streaming makes the first number what users actually feel.',
      'A rise in input tokens per request is one of the most useful early signals available: it almost always means a prompt-construction bug rather than a change in user behaviour, and it is invisible on a cost dashboard that only shows the monthly total.',
      'Pin the model ID including any version in configuration and treat a model change as a deployment with an evaluation run, not as a config tweak. Quality can shift underneath you otherwise, and nothing in the service metrics will show it.',
    ],
    traps: [
      'Monitoring only errors and latency. Cost and quality are the dimensions that actually go wrong.',
      'Alerting on absolute token spend rather than tokens per request, which hides a regression behind a traffic change.',
      'No prompt and response logging, so a reported bad answer cannot be investigated at all.',
    ],
    followUps: [
      'How would you measure answer quality automatically?',
      'Why track time-to-first-token separately?',
      'What would a jump in input tokens per request tell you?',
    ],
    tags: ['aws', 'bedrock', 'observability', 'genai'],
  },
  {
    id: 'itv-aws-72',
    level: 'advanced',
    kind: 'open',
    prompt:
      'You are choosing between Bedrock and calling the model provider’s API directly. How do you decide?',
    probing:
      'An architecture decision with real trade-offs. They want a reasoned position, including what Bedrock does not have.',
    answer: [
      'I would frame it as three questions: what do the compliance requirements demand, which features does the application actually need, and how much operational simplicity is the difference worth.',
      '**Where Bedrock wins.** One AWS bill and existing commercial agreements - which in a large organisation can be the entire decision. IAM roles instead of a separately managed API key, which removes a secret from your rotation burden. CloudTrail auditing and VPC endpoints, so inference traffic never leaves the AWS network. Data residency inside your account and region. And several providers behind one API, which makes model comparison genuinely easy through Converse.',
      '**Where the provider’s own API wins.** Features arrive there first, and not everything reaches the partner platforms at all. Bedrock supports the core surface well - streaming, tool use, structured outputs, prompt caching, long context, document input, token counting, extended thinking. What it does not have includes the provider-hosted server-side tools such as web search and code execution, the batch and files endpoints, and the provider’s managed agent orchestration - those are first-party only. If your design depends on one of those, the decision is made for you.',
      'That list is exactly the kind of thing that changes release to release, so the useful habit is not to memorise it but to **check the provider’s platform-availability documentation before committing to an architecture**. I have seen a project plan a feature around a capability that turned out to be first-party only, and discover it during implementation.',
      '**How I would actually decide.** In a regulated enterprise already on AWS, with requirements around data residency, private networking and consolidated billing, Bedrock is usually right, and I would design within its feature set deliberately rather than discovering the edges later. For a product that needs the newest capabilities as they ship, or that depends on server-side tools or managed agents, the provider API directly.',
      'And the option people forget: **both**. The provider SDKs can be pointed at Bedrock, so the same application code can run against either by swapping the client. That keeps the migration cost low and turns a one-way decision into a reversible one - which, given how fast this area moves, is worth quite a lot on its own.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Bedrock or the provider API?',
        caption: 'Compliance usually decides it. Feature coverage decides the rest.',
        question: 'What constrains you most?',
        branches: [
          {
            condition: 'Data residency, private networking, one AWS bill',
            result: 'Bedrock',
            detail: 'IAM, CloudTrail, VPC endpoints, no separate vendor agreement',
            tone: 'success',
          },
          {
            condition: 'Need server-side tools, batch or managed agents',
            result: 'Provider API',
            detail: 'those are first-party only - check availability before designing',
            tone: 'warning',
          },
          {
            condition: 'Want newest features on release day',
            result: 'Provider API',
            detail: 'partner integrations lag by design',
            tone: 'accent',
          },
          {
            condition: 'Unsure, and want to keep the option open',
            result: 'Provider SDK against Bedrock',
            detail: 'same code either way - swap the client to move',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Keeping the decision reversible',
        language: 'python',
        explanation:
          'The same request code against either backend. Moving is a client swap, not a rewrite.',
        code: `import os
from anthropic import Anthropic, AnthropicBedrockMantle

def make_client():
    """One switch decides where inference runs."""
    if os.environ.get("INFERENCE_BACKEND") == "bedrock":
        # AWS credentials, AWS endpoint, IAM-based auth
        return AnthropicBedrockMantle(aws_region=os.environ["AWS_REGION"]), \\
               "anthropic.claude-opus-5"        # Bedrock IDs carry the prefix
    # First-party: API key auth, newest features
    return Anthropic(), "claude-opus-5"


client, model = make_client()

# Everything below is identical on both backends.
message = client.messages.create(
    model=model,
    max_tokens=4096,
    system="You are a concise SRE assistant.",
    messages=[{"role": "user", "content": "Summarise this incident."}],
)
print(message.content[0].text)
print(message.usage.input_tokens, message.usage.output_tokens)`,
      },
    ],
    deeper: [
      'The features a partner platform lacks change with each release, so treat any specific list as perishable. Check the provider’s current platform-availability documentation at design time - that is a habit, not a fact to memorise.',
      'Model IDs differ between the two - Bedrock adds a provider prefix and cross-region profiles add a geography prefix - so the ID belongs in configuration rather than in code, whichever backend you start on.',
      'Quotas and throttling behaviour differ too. A load test against one backend does not predict the other, which matters if you plan to keep the option open.',
    ],
    traps: [
      'Assuming feature parity and designing around a capability the partner platform does not have.',
      'Treating it as irreversible. The provider SDKs support both, so the switching cost is small if you plan for it.',
      'Choosing on price alone without checking which features each side actually supports.',
    ],
    followUps: [
      'What is not available on Bedrock that is on the first-party API?',
      'How would you keep the choice reversible?',
      'When is the compliance argument decisive?',
    ],
    tags: ['aws', 'bedrock', 'architecture', 'genai'],
  },
]
