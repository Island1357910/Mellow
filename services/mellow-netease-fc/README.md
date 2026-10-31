# 半糖网易云账号接口：阿里云 FC 部署包

用于替换当前被网络入口拦截的 Sites 账号后端。尚未在阿里云部署或完成用户无 VPN 手机验收。

构建：在仓库根目录运行 `node scripts/build-netease-fc.mjs`。产物目录 `artifacts/netease-fc-package/` 包含 index.mjs、netease.mjs 和 LICENSE.txt；将三个文件直接压入 ZIP 根目录，不额外套一层文件夹。

本地验证：`node scripts/check-netease-fc.mjs`；真实网易云二维码验证：`node scripts/check-netease-fc.mjs --live`。后者只打印是否生成有效登录码及 waiting 状态，不打印密钥或凭据。

FC 配置：事件函数，Node.js 20，处理程序 index.handler，上传 ZIP 后部署，启用公网出站访问（代码需要访问 https://music.163.com）。HTTP 触发器使用无需 Aliyun 签名的公开入口，允许 POST / OPTIONS / GET；网易云会话仍由接口自身检查。使用默认 HTTPS 公网触发器地址即可先测试，不需要先绑定自定义域名。运行时无需安装 npm 依赖。

限制：只允许 https://mymellow.top 和 https://www.mymellow.top 来源；每个实例、每个来源 IP 每分钟最多 80 次 POST，非全局限流；只允许二维码、账号、歌单和歌曲查询，不提供任意 URL 代理；不记录请求体、Authorization 或网易云 Cookie。GET /health 提供健康检查。

函数计算按量收费。首次开通可能有试用额度，是否适用由阿里云账号和控制台确定，不能保证零费用。部署前确认费用；最小实例数设 0，先限制最大实例数并配置预算提醒，是否开启其他计费云产品由用户决定。代码内限流不是费用硬上限。

前端切换条件：从真实网页完成 CORS 预检和 qr_start / qr_check 测试后，构建变量 VITE_NETEASE_ACCOUNT_API 设置为触发器 HTTPS 地址加 /api/account。尚未通过验证前，不切换线上网页。不把旧后端会话自动转发至新接口。

官方文档：https://help.aliyun.com/zh/functioncompute/http-trigger-invoking-function-1
计费说明：https://help.aliyun.com/zh/functioncompute/billing-overview-of-fc
