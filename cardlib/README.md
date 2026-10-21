# 半糖 · 角色卡库（微信小程序 + 云开发 · 个人主体）

玩家在微信里浏览角色 → 随机答一题 → 服务端验题 → 临时链接下载 JSON / PNG / TXT（有什么下什么）。  
**答案只存在云数据库，不下发到小程序包。**

---

## 一、你要先准备的东西（一次性）

### 1. 微信小程序账号（个人主体即可）

1. 打开 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序  
2. **个人主体**可上架本工具；审核文案见 [`审核文案-个人主体.md`](./审核文案-个人主体.md)（勿写「官方 / 运营方」）  
3. 记下 **AppID**（开发 → 开发管理 → 开发设置）

### 2. 安装微信开发者工具

下载：[https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### 3. 开通云开发

1. 开发者工具打开本项目目录 `cardlib/`  
2. 填入你的 AppID  
3. 点击「云开发」→ 开通 → 创建一个环境（例如 `mellow-cards`）  
4. 记下 **环境 ID**（envId）

### 4. 配置项目

**① AppID** — 编辑 `cardlib/project.config.json`：

```json
"appid": "wx你的真实AppID"
```

⚠️ 不能是 `touristappid`（测试号无法开通云开发，会报 `cloud init error`）。

**② 云环境 ID** — 编辑 `cardlib/miniprogram/config/env.js`：

```js
module.exports = { cloudEnvId: 'mellow-cards-xxxxx' }
```

也可先留空 `''`，但在开发者工具里必须先点 **云开发** 并选中一个环境（会用当前环境）。

**③ 重新导入** — 改完 AppID 后，关闭项目，用真实 AppID **重新导入** `cardlib` 目录。

---

## 二、部署云函数（第一次）

在微信开发者工具里：

1. 右键 `cloudfunctions/listCards` → **上传并部署：云端安装依赖**  
2. 同样部署 `verifyAnswer`、`getCardDownload`  
3. 云开发控制台 → 数据库 → 新建集合：  
   - `cards`（角色信息与题目+答案）  
   - `tokens`（解锁临时凭证，可设 TTL 索引）

`tokens` 建议索引：`expireAt` 升序，方便自动清理。

---

## 三、上传一张角色卡（你日常要做的）

### 1. 在 `cardlib/cards/角色文件夹/` 放源文件

```
cards/xiaoman/
  meta.json       名字、简介、标签
  card.json       SillyTavern V2 角色卡
  questions.json  6～10 题，含 answers（仅用于上传，不会进小程序）
  card.txt        可选；不写则脚本从 card.json 自动生成
  cover.jpg       可选
  card.png        可选 PNG 底图
```

### 2. 本地打包

```powershell
cd cardlib
node scripts/prepare-upload.mjs
```

会在 `cardlib/upload-out/角色id/` 生成：

- `card.json`、`character.png`（酒馆 PNG）、`card.txt`（纯文本设定）  
- `db-record.json`（含答案，**只给你导入云数据库用**）  
- `manifest-public.json`（不含答案，可核对）

### 3. 上传到云存储

云开发控制台 → 存储 → 上传目录：

```
cards/xiaoman/cover.jpg
cards/xiaoman/card.json
cards/xiaoman/character.png
cards/xiaoman/card.txt
```

记下每个文件的 **File ID**（形如 `cloud://xxx/cards/xiaoman/card.json`）。  
没有上传的格式，`db-record.json` 里对应 `*FileId` 留空即可。

### 4. 写入云数据库 `cards` 集合

把 `db-record.json` 里的字段粘贴进一条记录，**务必填好**：

- `jsonFileId`、`pngFileId`、`txtFileId`、`coverFileId`  
- `questions[].answers` 只在数据库里，不要发到前端

文档 `_id` 建议与 `id` 一致，例如 `xiaoman`。

---

## 四、提交审核前自查

- [ ] 简介与备注使用 [`审核文案-个人主体.md`](./审核文案-个人主体.md) 中的表述（个人开发者、免费、无 UGC、无 AI 对话）  
- [ ] 小程序类目选「工具 / 信息查询」等符合内容的类目  
- [ ] 隐私协议说明：收集 openid 用于防刷、下载记录  
- [ ] 角色内容为本人整理发布、无 UGC  
- [ ] 云函数已部署，真机预览能列表 → 答题 → 下载  

---

## 五、和半糖 Mellow 的关系

- **卡库小程序**：个人维护的配套下载工具（非企业官方账号）  
- **Mellow**（mymellow.top）：用户把 JSON/PNG/TXT **导入本地** 使用  

小程序不提供 AI 对话，只做角色卡下载，审核压力相对小。

---

## 六、防盗说明（预期管理）

- ✅ 挡 casual 扒库：无公开直链、答案在云端、临时下载链接  
- ❌ 不能防止：用户下载后再转手发 JSON/PNG  

若要再加强：在 `verifyAnswer` 里加每日解锁次数、下载水印（需改 PNG 生成脚本）。
