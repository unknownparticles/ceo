# 一分钟老板 / One Minute Boss

一个可部署到 GitHub Pages 的静态 React 游戏。玩家在 60 秒内用荒诞商业决策拯救公司，AI 会生成事件、选项、后果与最终清算报告。

## 本地运行

```bash
npm install
npm run dev
```

打开页面后点击右上角 **API 设置**，至少填写 DeepSeek、MiniMax、GLM、Kimi、Gemini 中任意一个 API Key 才能开始游戏。自动模式会按以下顺序调用第一个已填写的 Key：DeepSeek → MiniMax → GLM → Kimi → Gemini，也可以手动切换供应商。

> API Key 仅保存在当前浏览器 LocalStorage 中，适合 GitHub Pages 这类纯静态部署；请不要把真实 Key 提交到仓库。

## 构建 GitHub Pages 版本

```bash
npm run build
```

构建产物位于 `dist/`。Vite 已使用相对资源路径，适合部署到 GitHub Pages 的项目子路径。

## 生成内容约束

AI 提示词会要求每轮刚好生成 3 个互不相同的答案选项；前端也会对重复选项进行兜底去重和补齐，避免同一问题出现相同答案。
