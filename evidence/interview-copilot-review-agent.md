# 面试助手｜核查 Agent 代码节选（X44）

快照：分支 `feature/review-agent-x44`，提交 `3a3d518`（2026-10-16）。仓库为私有，此处摘录真实源码；面试时可现场打开完整分支、测试与评测记录。

需求、方案取舍和是否采用由本人确定；实现由 Codex 完成，Claude 复核代码并做揭盲前评分。下列代码依赖原应用，不能单独运行。

## 结论先说

在 30 条草稿（12 条干净、18 条人工植错）的三组盲评中，检索 Agent 没有带来质量收益，核查耗时中位数从 6.5 秒增加到 12.0 秒。因此功能保留在独立分支、默认关闭，主版本继续使用单次核查。详见网页“保留未采用的方案，说明为什么”。

## 1. 用 LangChain 定义两个 Function Calling 工具

来源：`src/main/review-agent.js`，第 49–95 行。参数用 JSON Schema 定义；计算器复用原有的数值解析器，不使用 eval。

```javascript
function createReviewTools(searchMaterials) {
  return quietRun(() => {
    const { tool } = require('@langchain/core/tools');
    return [
      tool(
        async ({ query, top_k = 5 }, config) =>
          JSON.stringify(await searchMaterials(query, top_k, config.signal)),
        {
          name: 'search_materials',
          description: '定位资料中支持个人事实的逐字原文。',
          schema: {
            type: 'object',
            properties: {
              query: { type: 'string', minLength: 1, maxLength: 200 },
              top_k: { type: 'integer', minimum: 1, maximum: 8, default: 5 },
            },
            required: ['query'],
            additionalProperties: false,
          },
        },
      ),
      tool(
        ({ expression, decimals }) => {
          try {
            return calculate(expression, decimals);
          } catch (_error) {
            return { error: '算式无效或无法计算' };
          }
        },
        {
          name: 'calculate',
          description: '执行数值算式，返回计算结果。',
          schema: {
            type: 'object',
            properties: {
              expression: { type: 'string', maxLength: 512 },
              decimals: { type: 'integer', minimum: 0, maximum: 8 },
            },
            required: ['expression'],
            additionalProperties: false,
          },
        },
      ),
    ];
  });
}

```

## 2. 手写工具循环：最多两轮工具调用，再强制收尾

来源：`src/main/review-agent.js`，第 141–176 行。用 `bindTools()` 绑定工具；没有使用 LangGraph 或 AgentExecutor，循环控制在约 30 行，便于设上限和取消。

```javascript
// Two tool rounds, followed only when necessary by a final tool_choice=none call.
async function toolLoop(model, messages, tools, signal, diagnostics) {
  const bound = model.bindTools(tools);
  for (let round = 0; round < 3; round++) {
    signal.throwIfAborted();
    const ai = await bound.invoke(messages, {
      ...quietConfig(signal),
      ...(round === 2 ? { tool_choice: 'none' } : {}),
    });
    signal.throwIfAborted();
    if (
      ai.response_metadata?.status !== 'completed' ||
      ai.response_metadata.output?.some((item) => item.status === 'incomplete')
    )
      throw Object.assign(Error('核查响应未完整完成'), { code: 'RESPONSE_INCOMPLETE' });
    diagnostics.rounds++;
    const calls = orderedCalls(ai);
    if (!calls.length) {
      const content = ai.response_metadata.output
        .filter((item) => item.type === 'message' && item.role === 'assistant')
        .at(-1)?.content;
      if (
        !content?.length ||
        content.some((part) => part.type !== 'output_text' || typeof part.text !== 'string')
      )
        throw Error('核查正文格式无效');
      return content.map((part) => part.text).join('');
    }
    if (round === 2) throw Error('核查工具轮数超限');
    // SDK v0 replays response_metadata.output verbatim, including every encrypted
    // reasoning item and malformed function call; never replace it with parsed calls.
    messages.push(ai);
    for (const [position, call] of calls.entries())
      messages.push(await executeTool(call, position, tools, signal, diagnostics));
  }
}
```

## 3. 混合检索：向量 + 关键词，用 RRF 融合

来源：`src/main/review-materials.js`，第 184–235 行。向量路为 OpenAIEmbeddings + MemoryVectorStore，关键词路复用原有词法打分；索引未就绪或 Embedding 失败时降级为关键词检索。返回的是资料逐字原文，方便后续证据校验。

```javascript
  async function search(query, topK = 5, { signal, onUsage } = {}) {
    cancelled(signal);
    if (typeof query !== 'string' || query.length < 1 || query.length > 200)
      throw new RangeError('query must contain 1–200 characters');
    if (!Number.isInteger(topK) || topK < 1 || topK > 8)
      throw new RangeError('topK must be an integer from 1 to 8');
    const lexical = keyword(query, topK);
    const fallback = () => ({
      mode: 'keyword-only',
      results: lexical.map(({ chunk, score }) => publicResult(chunk, score, ['keyword'])),
    });
    if (state !== 'ready' || !chunks.length) return fallback();
    try {
      const embeddings = createEmbeddings(signal, onUsage);
      const queryVector = await abortable(() => embeddings.embedQuery(query), signal);
      cancelled(signal);
      if (
        !validVector(queryVector) ||
        queryVector.length !== vectors.memoryVectors[0].embedding.length
      )
        throw new Error('Invalid query embedding');
      const vector = await vectors.similaritySearchVectorWithScore(queryVector, topK);
      cancelled(signal);
      // EnsembleRetriever v1 deduplicates by pageContent. Give it shared chunk IDs
      // so equal text from different sources keeps its own evidence provenance.
      const rankings = [vector.map(([doc]) => doc.id), lexical.map(({ chunk }) => chunk.id)];
      const fusion = new EnsembleRetriever({
        retrievers: rankings.map(
          (ids) =>
            new MaterialRetriever(() => ids.map((id) => ({ pageContent: id, metadata: { id } }))),
        ),
        weights: [0.5, 0.5],
        c: 60,
      });
      const fused = await fusion.invoke(query, quietConfig(signal));
      cancelled(signal);
      return {
        mode: 'hybrid',
        results: fused.slice(0, topK).map(({ pageContent: id }) => {
          const ranks = rankings.map((ids) => ids.indexOf(id));
          return publicResult(
            byId.get(id),
            ranks.reduce((sum, rank) => sum + (rank < 0 ? 0 : 0.5 / (rank + 1 + 60)), 0),
            ['vector', 'keyword'].filter((_, i) => ranks[i] >= 0),
          );
        }),
      };
    } catch (_error) {
      cancelled(signal);
      return fallback();
    }
  }
```

## 4. 只替换“发请求”这一步，原有校验全部复用

来源：`src/main/answer-review.js`，第 295–312 行。开关关闭或非 OpenAI 时走原核查；开启时只把模型请求换成 Agent，JSON 解析、修订校验、逐字证据检查和超时取消都沿用原逻辑。

```javascript
async function reviewAnswer(input) {
  if (input.options.reviewAgent !== true || input.options.provider !== 'openai')
    return reviewLegacy(input);
  let diagnostics;
  const result = await reviewLegacy({
    ...input,
    generate: async (args) => {
      const response = await input.agentGenerate({ ...args, timeoutMs: input.timeoutMs ?? 25000 });
      diagnostics = response.diagnostics;
      return response;
    },
  });
  if (!input.signal?.aborted && ['checked', 'revised', 'limited'].includes(result.status)) {
    const safe = require('./review-agent-diagnostics').copyAgentDiagnostics(diagnostics);
    if (safe) result.agent = safe;
  }
  return result;
}
```
