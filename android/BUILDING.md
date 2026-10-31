# 半糖 Mellow Android

- 包名：`top.mymellow.app`，版本：1.0.0，最低 Android 7.0。
- `npm run build` 后运行 `npx cap sync android`，将网页和插画打入 App，使用本地 HTTPS 来源保存 IndexedDB 和密钥。
- Android 返回键先关闭控制中心、身份菜单或当前 App；在桌面返回时进入后台。
- 导入使用 Android 文件选择器；导出备份、角色、主题时打开系统分享面板，可保存到文件。
- 网页和 APK 分别保存数据。在原网页的设置中导出备份，再在 App 中导入即可迁移。

## 构建与签名

`.github/workflows/android-apk.yml` 只在 Android 发布分支生成未签名 APK，构建过程不接收签名私钥。
下载构建产物中的 APK 和官方 `apksigner.jar`，使用 `scripts/sign-android.ps1` 在本机签名和验证。

正式签名库和密码在本机 `artifacts/android-signing/`，已被 Git 忽略。应另行妥善备份该目录；以后覆盖升级必须使用同一签名库，勿公开或放进安装包。
