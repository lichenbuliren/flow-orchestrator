---
title: 多步表单
order: 2
---

# 多步表单演示

展示更贴近真实场景的用法：

- **FlowContext meta** 跨节点共享表单数据
- **beforeEnter 钩子** 实现前置校验（姓名不能为空）
- **Action 节点** 模拟异步提交
- **动态节点跳过** 根据条件跳过步骤

填写表单后点击「下一步」，观察右侧上下文数据面板的变化。

<code src="./MultiStepForm.tsx"></code>
