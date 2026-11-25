# 半糖 Mellow 创意工坊

创意工坊是小手机桌面上的独立应用。角色市集展示官方卡。进入小手机前需用邮箱和自设密码登录。工坊支持创作、MOD 文件上传与预览、送审、云端书架与工具箱、点赞和评论。作品通过审核后上架。评论发布即显示，评论作者和管理员可删除。

工坊底部有广场、创作和我的三个入口。广场和安装记录按角色卡、大世界、模拟器和 MOD 分类。旧角色卡和 DLC 分别进入角色卡和 MOD。角色卡、大世界和模拟器从玩家配置的创作模型生成，随后支持手动编辑或请 AI 修改。新建和送审需要角色图或封面。创作工具提供站内保存与送审。

MOD 只收作品配置文件和封面。配置文件为 UTF-8 JSON，最大 64 KB。顶层含 `title`、`summary`、可选 `endpoints`，以及 `content`。例如：

```json
{
  "title": "夜航模式",
  "summary": "给工坊加一点海蓝色",
  "content": { "version": 1, "theme_color": "#587B97" }
}
```

新上传的封面须为竖版 3:4，支持 2 MB 以内的 JPG、PNG 或 WebP。符合比例的图片直接使用原文件。其他比例由玩家选取裁切范围，确认后按选区的原像素尺寸生成无损 PNG，仍受 2 MB 限制。已有其他比例的封面继续完整显示。草稿图片和作品一起加密入库。目录返回封面可用标记，已审核封面由登录后图片接口提供。创作者可以在「我的 → 编辑主页」设置或移除头像，支持 512 KB 以内的 JPG、PNG 或 WebP。

「我的」包含个人主页、安装记录、关注列表和站内互动消息。开启某位创作者的更新提醒后，新通过审核的作品及改版会在工坊站内消息中显示。

## 数据和授权

数据库定义在 [schema.sql](schema.sql)。`works` 以 `type` 区分角色卡和 DLC。作者只编辑 `draft`，审核通过才更新 `published`。审核员只能处理实际查看的待审版本。重新编辑会回到草稿，旧审核版继续展示。移除已发布的模型地址立即生效，新增地址需要通过审核。领取记录和 DLC 启用状态存为 `installs`。聊天记录保存在本机，工坊 SQLite 只存账号、会话、投稿和安装状态。

注册时通过 SMTP 发送一次性邮箱验证码，15 分钟有效，之后使用邮箱和密码登录。密码使用独立随机盐与 scrypt 散列，登录会设置 HttpOnly Cookie。原先只使用验证码的账号通过注册流程验证同一邮箱并设置密码，原有作品和领取记录按账号保留。管理员权限由后端绑定到 `2807117538@qq.com`，该邮箱须完成验证注册。管理员可审核、按邮箱发出警告、封禁及解封账号，封禁会吊销会话。送审后审核员能看到正文。

作品草稿与发布版以 AES-256-GCM 加密入库，持久数据库必须配置稳定的 `WORKSHOP_CONTENT_KEY`。首次读取旧版本数据库时会转换已有作品正文。部署前先做数据库备份，旧备份可能仍含明文。访问密钥和数据库备份应分开存放，恢复时两者都需要。

玩家领取作品后从书架进入小手机游玩。短信、线下和番外分别使用玩家在对应模块绑定的模型 API，未绑定时使用玩家默认 API。每次请求将接口、密钥和模型交给工坊服务代发，不写入工坊数据库。完整设定由工坊服务解密并发送给所选模型服务商，不返回玩家客户端。创作者填写接口白名单后只允许所列地址；留空允许玩家自选公网 HTTPS 接口。工坊拦截明确的源文索取和回复中的原文重现，校验模型历史回复的签名。书架在客户端只持有作品引用和公开展示信息，游玩存档只含玩家输入、剧情回复和签名。首发公开试玩可使用自己的接口，接口仅收到公开试玩说明。工坊只通过公网 IPv4 连出，固定已校验的 IP，拒绝跳转和保留地址。

## API

- 账号：`POST /auth/email`、`POST /auth/register`（邮箱、验证码、自设密码）、`POST /auth/login`（邮箱、密码）、`GET /auth/me`、`POST /auth/logout`。
- 账号管理：`GET /admin/accounts?email=<email>`、`POST /admin/accounts/:id`（`action` 为 `warn`、`ban` 或 `unban`，另传 `reason`）。
- 工坊：`GET /recommendations`、`GET /works?category=world&q=<关键词>&page=1`、`GET /works/:id`。分类为 `character`、`world`、`simulator` 与 `mod`，每页 20 条。
- 投稿：`GET /mine`、`POST /mine/:type`、`PUT /mine/:id`、`POST /mine/:id/submit`、`DELETE /mine/:id`。创建后返回 `id` 和 `revision`，更新提交 `{ revision, draft }`，送审提交 `{ revision }`。
- 审核：`GET /review?after=<id>`、`POST /review/:id`，决定传 `decision`、`revision`、可选 `note`。
- 领取与启用：`GET /library`、`POST /library/:id`、`PATCH /library/:id`（`{ "enabled": true }`）、`DELETE /library/:id`。
- MOD 上传与预览：`POST /mine/mod` 与 `POST /preview/dlc` 接收 `{ manifest, cover }`。前者是配置文件文本，后者是原图 Data URL。修改 MOD 使用同样的上传结构放在 `{ revision, draft }` 的 `draft` 中。已审核封面通过 `GET /works/:id/cover` 获取。
- 互动：`GET /works/:id/social`、`PUT /works/:id/social/like`、`POST /works/:id/social/comments`、`DELETE /works/:id/social/comments/:commentId`。
- 审核阅读与测试：`GET /review/:id?revision=…`、`POST /review/:id/test` 只允许审核账号访问。完整设定只发往管理员在服务器配置的 `WORKSHOP_REVIEW_ENDPOINT`，密钥和模型名分别使用 `WORKSHOP_REVIEW_KEY` 和 `WORKSHOP_REVIEW_MODEL`。首发试玩可选公网 HTTPS 的 OpenAI 兼容接口，转交独立的公开试玩说明。
- 主页和关注：`GET /profile`、`PUT /profile`（可附头像 Data URL，传 `null` 时移除）、`GET /creators/:id`、`GET /creators/:id/avatar`、`PUT /creators/:id/follow`（传 `following` 和 `reminders`）、`GET /following`。
- 站内消息：`GET /activity`、`POST /activity/read`（传收到的最新消息 `time`）。
- 游玩：`POST /play/:characterId/protected` 接收玩家配置的 `endpoint`、`key`、`model`，以及 `messages`、已启用的 `dlc` 和可选 `button: { id, index }`。三个模型配置字段必须一起提供。回复为剧情文本和绑定账号及作品的 `receipt`。对话中每条助手回复须带上原签名。生成和回复防泄露检查均使用本轮玩家所选模型。旧客户端不传模型配置时仍兼容 `WORKSHOP_PLAY_ENDPOINT`、`WORKSHOP_PLAY_KEY` 和 `WORKSHOP_PLAY_MODEL`，新客户端不依赖这些环境变量。`POST /play/:characterId` 用于首发公开试玩。
- 探活：`GET /health`。跨域浏览器请求只接受一个配置好的 HTTPS 前端来源。IP 和账号限流在单实例内生效。

## 部署到已有站点的 Vultr VPS

以下示例按仓库当前域名 `mymellow.top` 和 API 子域名 `workshop-api.mymellow.top` 编写。实际部署前用只读命令检查 VPS，并记录老项目正常访问时的状态码和页面。

```bash
sudo ss -lntp
sudo nginx -t
sudo nginx -T
docker version
docker compose version
certbot --version
free -h
df -h
```

如果 Docker 或 Compose 未安装，先核对老项目是否使用 Docker、当前防火墙与 Docker 的交互及是否已有发行版 Docker 包。按 Docker 的 Ubuntu 官方安装说明安排独立维护，并在安装后复核老站。以下步骤假定 Nginx、Docker Compose 和用于签发证书的 Certbot 已就绪。Nginx 配置示例采用 Ubuntu 常见的 `sites-available` 和 `sites-enabled`，以实际 `nginx -T` 输出为准。操作前备份当前启用的 Nginx 配置。

1. 把本目录放到服务器独立目录，例如 `/opt/mellow-workshop`。在 DNS 添加 API 子域的 A 记录，指向 VPS 公网 IPv4。初次验证使用 DNS 直连，在现有防火墙允许的 Web 入口上复用 80/443。无需向公网开放工坊容器端口。
2. 在项目目录以 `umask 077` 创建 `.env`，按 `.env.example` 填写实际 HTTPS 前端来源、SMTP 凭据与发件地址、管理员邮箱、VPS 的**所有公网 IPv4**。用 `openssl rand -hex 32` 生成并妥善保存 `WORKSHOP_CONTENT_KEY`。将同机公网出口和其他禁止访问的基础设施 IPv4 加入阻断列表。确认 `WORKSHOP_HOST_PORT` 空闲，换端口时同步改 Nginx 样例。
3. 启动并验证本机服务：

   ```bash
   docker compose -p mellow-workshop config --quiet
   docker compose -p mellow-workshop up -d --build
   docker compose -p mellow-workshop ps
   curl -fsS http://127.0.0.1:18787/health
   sudo ss -lntp
   ```

   确认端口只监听在 `127.0.0.1`。Compose 为应用分配独立持久卷、0.5 核和 256 MB 内存上限。若旧 Docker 版本无法保证回环发布端口的网络隔离，先从外部验证容器端口不可达，再上线。
4. 如果尚无 API 子域证书，新建独立 HTTP 虚拟主机，只启用样例第一段 80 配置，把 `location /` 暂设为 `return 404;`。创建 `/var/www/mellow-workshop-acme`，确认静态挑战路径可通过公网读取。执行 `sudo nginx -t && sudo systemctl reload nginx`，再执行：

   ```bash
   sudo certbot certonly --webroot -w /var/www/mellow-workshop-acme -d workshop-api.mymellow.top
   ```

   签发成功后将此虚拟主机替换为完整的 [nginx-workshop.conf](nginx-workshop.conf)。确认文件启用后再次执行 `sudo nginx -t && sudo systemctl reload nginx`。配置由 Nginx 用实际连接 IP 覆盖 `X-Forwarded-For`，供工坊限流使用。若以后放到 CDN 后面，先按照可信代理来源配置 Nginx 真实 IP。证书续签沿用服务器已有的 Certbot 调度，确认续签成功会 reload Nginx。
5. 验证新域名及 CORS，然后复查老项目。确认新的 OPTIONS 返回 204 和预期的 `Access-Control-Allow-Origin`，用其他 Origin 再验证 403。

   ```bash
   curl -fsS https://workshop-api.mymellow.top/health
   curl -i -X OPTIONS https://workshop-api.mymellow.top/auth/email \
     -H 'Origin: https://mymellow.top' \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: content-type'
   ```
6. 先确认账号服务已能真实发送验证码，再在静态前端的构建环境设置 `VITE_WORKSHOP_API=https://workshop-api.mymellow.top` 并用现有发布流程重新构建。整个小手机依赖账号服务。Cookie 需要同站 HTTPS 子域，测试环境可将两端都放在 `localhost` 的不同端口。请在独立浏览器会话分别验收管理员、作者和其他玩家。覆盖密码登录、封禁、审核、收藏、评论、DLC 启停，以及作者测试与普通玩家无法调用受保护作品。

### 回滚和备份

停止发布时先关闭前端构建开关并重新发布静态站。在 VPS 仅停 `docker compose -p mellow-workshop stop` 这一项目，撤下新子域的启用配置并执行 Nginx 检查与 reload。保留数据库卷。老项目相关容器、站点配置和证书照常运行。

SQLite 使用 WAL。备份时用 SQLite 在线备份接口，或在工坊停机时备份完整数据卷。备份包含邮箱和全部投稿，请放在受限存储。公开前用两个账号做权限复验。

## 本地验证

后端需 Node.js 24，执行 `npm ci` 和 `npm test`。测试使用模拟 SMTP，并验证账号管理、审核、正文隔离、DLC 预览和白名单。联调可在本目录设置 `FRONTEND_ORIGIN=http://localhost:5173`、SMTP 和审核邮箱后运行 `npm start`，在仓库根目录以 `VITE_WORKSHOP_API=http://localhost:8787` 启动前端。需要保存测试数据时，配置 `DATABASE_PATH` 和 `WORKSHOP_CONTENT_KEY`。
