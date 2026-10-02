# 正式版本交付说明

交付日期：2026-10-02（Asia/Shanghai）。版本 **0.2.0**，以用户已通过的最终版本为基础，界面及功能文件与验收清单一致。

## 正式交付

- ZIP：`bin/release/zjuers-home-0.2.0.zip`，约126.2 MiB。
- 解压版：`bin/release/zjuers-home-0.2.0/`，共34文件，含独立的 INSTALL.md。
- 校验：`bin/release/SHA256SUMS.txt` 与 `bin/release/release-manifest.json`。
- ZIP SHA-256：`c9488e148e63395d4af991b929cf1092b9197a9aa645c199facb063669431398`。
- 原安装目录 `bin/full-preview/` 保留，正在使用的用户无需重新安装或重新配置。

正式包为解压加载方式，不提供签名CRX或商店发行。具体使用见 [install.md](install.md)。ZIP含运行所需视频、字体、图标，不含用户浏览器中的密码、Key、偏好或缓存。

## 本轮完成的整理

新增根README、正式安装说明、构建脚本及Git忽略／大文件属性。未改变已审阅产品代码；构建核对完整验收清单、33个既有运行文件、脚本语法和资源引用，再加入安装说明。ZIP内容逐文件解压校验与正式目录一致。全部72项测试通过；既有安装包、旧MVP与assets原件保留。

上传范围为根README／AGENTS／Git配置、正式源码及必要素材、测试、构建脚本和docs。assets原始资料、bin交付及历史包、temp下载与测试资料、早期验证工程和初版讨论文本留本机且由.gitignore排除。本轮没有删除文件。详细验收与接入限制见 [full-acceptance.md](full-acceptance.md)。

## 工具、依赖与权限

既有工具：Node.js v24.19.0、Python 3.14.7、Git 2.55.0.windows.4、Git LFS 3.7.1。Git凭据助手为manager；尚未取得仓库地址，未验证目标仓库的登录或写入权限。GitHub CLI未安装，现阶段不需要安装。没有新增软件、第三方依赖、插件或系统环境修改。

扩展权限：storage、tabs、webNavigation、webRequest。已验收来源域为 zjuers.com、*.qweatherapi.com、v1.hitokoto.cn、zjuam.zju.edu.cn、zdbk.zju.edu.cn、courses.zju.edu.cn、identity.zju.edu.cn、yjsy.zju.edu.cn 和公共 HTTP calendar.celechron.top。webRequest用于本扩展研究生认证回调；凭据本机local可自动读取，不是加密凭据库。默认壁纸与字体已内置。

内置视频在正式源码路径通过Git LFS管理；须在获得私有仓库地址后确认仓库权限与LFS可用情况。源码采用保留原始字节的Git属性，避免行尾转换使已验收SHA-256失配。当前没有初始化Git仓库、提交或上传。

## 当前停止点

正式打包与本轮前半段收尾完成，等待用户提供私有GitHub仓库地址。尚未宣布项目结束；远端上传核对完成后再记录仓库与提交，更新最终过程记录并停止。
