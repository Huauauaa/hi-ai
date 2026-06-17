# Function Calling

**Function Calling**（也叫 tool use / tool calling）是让大模型在对话里**输出结构化调用**的机制：模型不直接执行代码，而是返回「调哪个函数、参数是什么」；你的运行时负责校验、执行、把结果塞回上下文，再让模型继续推理。

它是 Agent 和 RAG 之外，把 LLM 接到真实系统上的最短路径。本站 [算子](/operator) 里把一次 tool call 当作应用层算子；[Harness](/harness) 里评测 Agent 时，tool 选择准确率、参数合法率、任务完成度都是核心指标。

## 一次调用长什么样

典型往返：

1. 你把**工具定义**（JSON Schema）和**用户消息**发给模型
2. 模型返回 `tool_calls`（或旧 API 的 `function_call`）
3. 你执行对应函数，把结果作为 `tool` / `function` 角色消息追加
4. 模型基于结果生成最终回复，或继续发起下一轮 tool call

```json
{
  "tool_calls": [{
    "id": "call_abc",
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{\"city\":\"上海\",\"unit\":\"celsius\"}"
    }
  }]
}
```

`arguments` 在多数 API 里是 **JSON 字符串**，解析失败是线上常见 bug，别假设模型永远合法。

## 和 Prompt 工程的区别

| 方式 | 模型输出 | 谁执行副作用 |
| --- | --- | --- |
| **纯 Prompt** | 自然语言或自拟 JSON | 你 regex / 二次解析， fragile |
| **Function Calling** | API 约束的结构化字段 | 你的 handler，schema 可校验 |
| **JSON mode** | 整段 JSON 文本 | 仍要你自己映射到函数 |

Function calling 的价值不在「模型会写 JSON」，而在**协议固定**：同一套 tool 定义可换模型、可写单测、可进 trace。

## Tool 定义要点

每个 tool 至少需要：

| 字段 | 作用 |
| --- | --- |
| **name** | 稳定标识；改名等于 breaking change |
| **description** | 模型选 tool 的主要依据，要写清何时用、何时不用 |
| **parameters** | JSON Schema：`type`、`properties`、`required`、`enum` |

```json
{
  "type": "function",
  "function": {
    "name": "search_docs",
    "description": "在内部文档库检索；用户问产品配置、API 用法时使用。不用于闲聊。",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "检索关键词" },
        "top_k": { "type": "integer", "minimum": 1, "maximum": 10, "default": 5 }
      },
      "required": ["query"]
    }
  }
}
```

实践建议：

- **一个 tool 一件事** — 和算子原则一致；`search_and_summarize_and_email` 会让模型选参和调试都变难
- **description 写负例** — 「不要用于实时股价」比堆同义词有用
- **参数尽量少** — 必填项越多，幻觉参数越多；默认值放 schema 或 handler 里

## 运行时该做什么

模型只负责「提议调用」；可靠系统要在 handler 外再包一层：

| 环节 | 建议 |
| --- | --- |
| **解析** | `JSON.parse(arguments)` 失败 → 可重试或把错误反馈给模型 |
| **校验** | 用 JSON Schema / pydantic / zod 校验，别信模型 |
| **鉴权** | tool 名到权限映射；用户 A 不能借模型调用户 B 的数据 |
| **超时与并发** | 每个 tool 独立 timeout；全局 in-flight 上限 |
| **幂等** | 写操作带 idempotency key，防止重试双写 |
| **观测** | 记录 `tool_name`、入参摘要、耗时、错误码；与 [算子](/operator) trace 对齐 |

Agent loop 伪代码：

```text
messages = [system, user]
while not done:
  response = llm.chat(messages, tools=TOOLS)
  if response.tool_calls:
    for call in response.tool_calls:
      result = run_tool(call)          # 校验 + 执行 + 脱敏
      messages.append(tool_result(call.id, result))
  else:
    return response.content            # 最终自然语言答案
```

停止条件要有：**最大轮数**、**重复调用检测**、**用户取消** — 否则模型可能无限 `search` 同一个 query。

## 常见失败模式

1. **该调不调** — description 模糊，或上下文里已有「看起来像答案」的文本；加 few-shot tool 示例或收紧 system prompt
2. **调错 tool** — 工具太多且重叠；合并、分层（先 router 再 specialist tools）或动态只暴露相关 subset
3. **参数幻觉** — 编造 id、日期、枚举值；用 `enum`、服务端查表、执行前二次确认
4. **并行 vs 顺序** — 多 tool 无依赖时可并行执行；有依赖时在 description 里写清顺序，或拆成多轮
5. **结果过长** — 直接把 10 页 HTML 塞回上下文会爆 token；截断、摘要、或分页 tool

调试顺序：先看 **trace 里哪一步 tool 错了**，再改 prompt 或 schema，最后才换模型 — 和 [Harness](/harness) 里「先固定任务再比模型」同一逻辑。

## 各家 API 差异（概念层）

| 概念 | OpenAI / 兼容栈 | Anthropic | 备注 |
| --- | --- | --- | --- |
| 工具列表 | `tools` | `tools` | 结构类似 JSON Schema |
| 模型输出 | `tool_calls[]` | `tool_use` content block | 解析代码要分 provider |
| 结果回传 | role=`tool` + `tool_call_id` | `tool_result` block | 必须和 call id 对齐 |
| 强制调用 | `tool_choice` | `tool_choice` | 评测时可强制某 tool 测参数 |

细节以各厂商文档为准；应用层抽象成「ToolDefinition + ToolCall + ToolResult」三件套，换 provider 时只改 adapter。

## 和 Benchmark / 评测

公开榜里 **Agent / 工具** 类任务（如 SWE-bench、τ-bench、BFCL）测的就是：在给定 tool 集下能否选对、传对、多步完成。自建评测至少记录：

- **Tool selection accuracy** — 该不该调、调哪个
- **Argument validity** — schema 校验通过率
- **Task success** — 端到端业务结果（不只 format 对）

这些指标应进 [Harness](/harness) 固定夹具，换模型或改 description 后回归对比。

## 最小清单

- [ ] 每个 tool 有 JSON Schema，handler 侧再次校验
- [ ] description 说明用途、边界、与其它 tool 的分工
- [ ] 执行层：超时、权限、日志、幂等（有副作用时）
- [ ] Agent loop 有最大轮数与重复调用保护
- [ ] 存原始 tool_calls 与 tool results，便于回放和 harness 回归

## 延伸阅读

- [OpenAI — Function calling](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic — Tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Berkeley Function Calling Leaderboard (BFCL)](https://gorilla.cs.berkeley.edu/leaderboard.html)
- 本站：[算子](/operator) — tool 作为应用层算子
- 本站：[Harness](/harness) — 固定评测协议
