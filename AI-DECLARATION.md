---
version: "0.1.2"
level: copilot
processes:
  design: pair
  implementation: copilot
  testing: copilot
  documentation: copilot
  review: assist
  deployment: none
---

本文件基于 [AI-DECLARATION.md](https://ai-declaration.md/zh/0.1.2) 规范编写。

## Notes

- 本仓库由人类维护者设定目标与范围，负责架构决策、验收和最终审查；AI 代理（DeepSeek Harness）在明确提示下完成整项实现任务。
- Host 与浏览器源码、测试、文档和 LiteSpec 规范主要由 AI 代理生成；结果必须通过人类维护者的门禁检查与真实 DSH 页面验证后才会被接受。
- 代码审查同时包含 AI 交叉复核（由另一模型或独立代理审阅）和人类最终把关与负责。
- 提交、版本发布与插件安装由人类执行或指挥，AI 不会自动提交、推送或改变版本号。
- `deployment` 声明为 `none`：部署与发布过程没有 AI 参与。
- 这里的 `version` 是声明规范的版本，与本插件自身的发布版本无关。
