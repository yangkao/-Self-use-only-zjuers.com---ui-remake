# 正式版本交付说明

交付日期：2026-10-04（Asia/Shanghai）。版本 **0.3.1**；第一轮改进的 0.3.0 已获用户验收，0.3.1 按用户要求扩展 Edge 配色范围。

## 交付文件

- 解压目录：`bin/release/zjuers-home-0.3.1/`。
- ZIP：`bin/release/zjuers-home-0.3.1.zip`。
- 校验清单：`bin/release/SHA256SUMS.txt`、`bin/release/release-manifest.json`。
- 兼容原安装目录：`bin/release/zjuers-home-0.2.0/`，内容也是 0.3.1；保持该目录加载，无需重新安装。

ZIP 包含运行视频、字体、图标及安装说明，不含用户密码、API Key、浏览器偏好和缓存。交付方式为解压加载，不是商店或签名 CRX 发行。安装见 [install.md](install.md)。

## 本轮改进

本机主题卡片管理、原文件壁纸引用、整套配色生成、视觉参数、分时问候、Edge 静态配色主题导出、页脚与图标动效、作业活动直达。补齐整套主题颜色覆盖，并参照 nightTab 重设计设置内容。壁纸失效时提示并恢复内置视频及默认配色。

## 验证及限制

101 项自动测试通过；语法、manifest 引用、源码验收哈希、正式目录及 ZIP 内容逐项校验通过。0.3.1 的 Edge 浏览器配色效果待用户实机核对；AI未独立验证所有认证分支或浏览器版本。原位更新未访问浏览器凭据；用户已自行重新填入配置。

没有新增软件或第三方依赖。扩展使用 storage、tabs、webNavigation、webRequest，以及已确认的信息源域名权限；本地壁纸增加 file:///*，需用户开启文件 URL 访问。校内凭据在本机扩展 local 可自动读取，不是加密凭据库。主题只在本机保存，壁纸不复制或长期缓存。Edge 配色由用户手动加载。

## 清理与停止点

用户授权清理临时文件、无后续价值的临时文档及旧版本。保留 assets 原始资料、正式源码与测试、实施方案、来源／可行性证据、验收清单、安装说明及 review 复盘。当前安装路径保留为兼容副本。具体清理目录列于 review.md。

0.3.1 正式交付与阶段收尾完成，本轮不提交或上传 GitHub。项目后续由用户决定。

### 0.3.1 Edge 配色修订

独立 Edge 主题包（内部版本 1.1.0）增加地址栏、非活动标签、工具栏图标与文字、书签文字、隐私窗口及新标签相关颜色，并校验文字对比度。用户需从设置重新下载并手动应用生成的主题 ZIP；重新加载首页扩展本身不会替换 Edge 当前配色主题。Edge 特有区域的实际着色范围尚待实机验证。标准字段依据 Chromium 主题字段表：https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/themes/browser_theme_pack.cc 。
