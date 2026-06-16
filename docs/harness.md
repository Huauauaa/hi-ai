# Harness

**评测 Harness**（evaluation harness）是套在模型外面的固定脚手架：数据集、提示词、指标和运行器。所有人用同一套输入、同一套打分代码做测试，版本之间的分数才有可比性。

没有 harness 时，每个团队都会重新发明 few-shot 模板、解析逻辑和聚合方式。数字会漂，论文和看板也很难复现。

## Harness 做什么

| 组件 | 作用 |
| --- | --- |
| **Tasks** | 带版本号的命名基准（如 GSM8K、MMLU） |
| **Prompts** | `doc_to_text` / `doc_to_target` — 原始样本如何变成模型输入 |
| **Model adapter** | 统一接口，对接 HF、vLLM、OpenAI、本地权重 |
| **Metrics** | 精确匹配、对数似然、自定义评分器 |
| **Runner** | 批量推理、缓存、日志、结果导出 |

Harness 管权重以外的一切：换模型，任务定义不动。

## 对 AI 工作的意义

1. **可复现** — 每次运行同一 prompt、同一后处理、同一指标。
2. **回归** — 微调或改 prompt 后，合并前重跑整套评测。
3. **对齐压力** — 榜单分数容易被「刷」；harness 加 held-out 检查能抓住「指标好看、线上翻车」。
4. **共同语言** — 「GSM8K 掉了 2 分」比「感觉变差了」有用得多。

## 参考：LM Evaluation Harness

[EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) 是事实上的开源标准栈，驱动 Hugging Face Open LLM Leaderboard，内置 60+ 学术任务。

```bash
pip install lm-eval

lm_eval --model hf \
  --model_args pretrained=meta-llama/Llama-3.2-1B \
  --tasks gsm8k \
  --device cuda:0 \
  --batch_size 8
```

任务配置在 `lm_eval/tasks/` 下的 YAML 里。加自定义任务通常是：Hugging Face 数据集、prompt 字段、指标，再加一份可 PR 的配置 — 而不是笔记本里的一次性脚本。

## 什么时候自建

适合自建 harness 的情况：

- 领域数据无法干净映射到公开基准（内部工具、专有格式）。
- 除了离线准确率，还需要**在线**信号（延迟、成本、工具调用成功率）。
- 合规要求固定的审计夹具和可签名的结果产物。

形态仍可照搬：版本化任务、不可变的 prompt 模板、单一 runner、落盘原始输出。

## 最小 Harness 清单

- [ ] 任务配置进 git（不是「表格里那份」）
- [ ] 每个任务固定模型 revision / API 版本 / temperature
- [ ] 存原始 completion，不只存汇总分
- [ ] CI 在每次变更时跑**冒烟子集**
- [ ] 写清楚：一次通过**不能**证明什么

## 延伸阅读

- [EleutherAI — Evaluating LLMs](https://www.eleuther.ai/projects/large-language-model-evaluation)
- [New task guide (lm-eval)](https://github.com/EleutherAI/lm-evaluation-harness/blob/main/docs/new_task_guide.md)
- [Mozilla — Evaluation Harness for auditing LLMs](https://www.mozillafoundation.org/en/blog/evaluation-harness-is-setting-the-benchmark-for-auditing-large-language-models/)
