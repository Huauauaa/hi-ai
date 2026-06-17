# 算子

**算子**（operator）是流水线里最小、语义明确的变换单元：固定输入输出类型，做一件事，可单独测试、替换和组合。

矩阵乘、LayerNorm、一次 tool call、一条 map 规则 — 都是算子。区别只在跑在 GPU、Python 还是 HTTP 上。

## 算子管什么

| 层次 | 例子 | 关注点 |
| --- | --- | --- |
| **硬件 / Kernel** | GEMM、FlashAttention | 吞吐、显存、数值精度 |
| **框架 Op** | `torch.matmul`、`F.softmax` | 自动求导、算子融合、设备调度 |
| **模型块** | Attention、FFN、MoE 路由 | 结构复用、checkpoint、量化 |
| **应用 / Agent** | 搜索、写文件、调 API | 权限、超时、幂等、可观测 |
| **数据** | 过滤、聚合、embedding | Schema、延迟、回放 |

上层算子通常由下层堆出来；性能瓶颈往往在**最底层那个 hot op**，语义 bug 往往在**应用层那个 tool op**。

## 为什么要单独讲算子

1. **边界清晰** — 算子有契约（输入 shape、错误码、副作用），比「一坨脚本」好测。
2. **可组合** — 图 / DAG / Agent loop 都是算子连线；换实现不改接口。
3. **优化有靶子** — Profile 到具体 op 再动手，而不是「整体慢」。
4. **与 Harness 分工** — [Harness](/harness) 固定**评测**；算子固定**执行**。评测任务本身也是算子链：取样本 → 拼 prompt → 推理 → 打分。

## Agent 里的算子

大模型应用里，**tool / [function call](/function-calling)** 就是应用层算子：

```json
{
  "name": "search",
  "arguments": { "query": "VitePress base path" }
}
```

和矩阵乘一样，需要：

- **Schema** — 参数类型与必填项
- **实现** — 真正执行副作用的代码
- **运行时** — 超时、重试、并发上限
- **日志** — 入参、出参、耗时（注意脱敏）

Agent loop = 推理算子 + 工具算子交替，直到停止条件。调试时问「哪一步算子错了」，而不是「模型笨了」。

## 自定义算子时

框架侧（PyTorch 等）：优先用内置 op 组合；真 hot 再写 CUDA / Triton。

应用侧：

- 一个 tool 只做一件事
- 副作用算子必须幂等或带 idempotency key
- 失败要可分类：可重试 / 不可重试 / 需人工
- 单测 mock 实现，集成测走真实依赖

## 最小清单

- [ ] 每个算子有 typed 输入输出（或 JSON Schema）
- [ ] 文档写清副作用与失败模式
- [ ] 关键路径有单测；Agent tool 有 fixture 回放
- [ ] Profile / trace 能定位到算子名，不是 anonymous lambda
- [ ] 与 Harness 对齐：评测链路上的算子版本也要 pin

## 延伸阅读

- [PyTorch — Operators](https://pytorch.org/docs/stable/torch.html)
- 本站：[Function Calling](/function-calling) — 结构化工具调用
- [OpenAI — Function calling](https://platform.openai.com/docs/guides/function-calling)
- 本站：[Harness](/harness) — 评测脚手架
