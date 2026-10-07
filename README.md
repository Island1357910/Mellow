# 半糖 · Mellow

一台纯前端的小手机。角色、短信和密钥都在浏览器本地，不经过自己的服务器。

## 跑起来

```bash
npm install
npm run dev
```

浏览器打开终端里的本地地址。桌面上是一台圆角手机，手机上会铺满屏幕。

## 部署到 GitHub Pages

推送到 GitHub 的 `main` 分支后，Actions 会自动构建并发布网页。

1. 代码推送到 GitHub 后，在本机运行 `npm run deploy:pages` 会把 `dist` 发布到 `gh-pages` 分支。
2. 访问 `https://<你的用户名>.github.io/<仓库名>/`（本仓库为 `https://island1357910.github.io/Mellow/`）。

若要用 GitHub Actions 自动部署，需给 `gh` 授权 `workflow` 权限后，再把 `.github/workflows/deploy.yml` 推上去，并在 **Settings → Pages** 里选 **GitHub Actions**。

本地预览生产构建：

```bash
npm run build
npx vite preview
```

第一次进来是锁屏，上滑解锁。短信里可以「载入小满」，也可以导入 SillyTavern 的 JSON / PNG 角色卡。要让角色回消息，到设置里填 OpenAI 兼容接口、Claude 或本机 Ollama。Key 用 AES-GCM 存在这台浏览器里。

## 这一版有什么

- 锁屏、桌面、应用网格、Dock、控制中心
- 马卡龙主题，另外两套低饱和主题，可导入导出
- 多身份。换身份等于换一台手机，数据分开
- 短信可以临时改用另一个身份，优先级是：手动指定 > App 默认 > 当前手机
- SillyTavern 角色卡导入，JSON 导出，8 个官方预设
- 一条短信出去，经统一的 AIAdapter 回来
- 空间规则已经写好：同一身份不能同时待在两个地方。线下页面还只展示状态

## 还没做

线下陪伴、权限矩阵、注意力、拧巴的憋着不说、主动心跳、番外的独立世界、应用市场的安装、整包导出、Service Worker。这些等这一版确认后再接。
