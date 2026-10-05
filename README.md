# ZJUers 个人首页

个人使用的 Microsoft Edge 起始页／新标签页扩展，以 ZJUers 轻首页完整原站和原美化包为基础。当前正式版 **0.3.1**；0.3.0 已经用户审阅通过，0.3.1 按用户要求扩展 Edge 配色范围。

## 功能

- 新标签进入 zjuers.com 并应用个人界面，连接失败时替换为原生新标签。
- 紧凑导航、搜索引擎与分组折叠记忆；主次界面覆盖切换和侧边设置。
- 本机主题管理、原路径图片／视频壁纸、代表色生成整套配色、视觉参数和分时问候；独立 Edge 配色主题包生成。
- 和风天气、一言哲学名句、本科课表／考试、学在浙大作业及活动直达；有权限及有效内容时补充研究生课程。
- 缓存优先，失败及旧缓存明确标注；凭据保存在当前扩展的本机存储，不随安装包携带。

## 使用与构建

[安装与升级](docs/install.md) · [正式交付](docs/release.md) · [实施方案](docs/implementation.md) · [过程复盘](docs/review.md)

正式包位于 `bin/release/zjuers-home-0.3.1/` 和同名 ZIP。既有安装路径 `bin/release/zjuers-home-0.2.0/` 保留，但内容为 0.3.1，便于原位更新。

源码在 `srcs/extension/`；使用既有 Node.js、Python，无第三方构建依赖：

```text
node --test srcs/extension/tests/*.test.cjs srcs/extension/*.test.cjs tests/*.test.cjs
python srcs/build-release.py
```

构建先核对 `docs/full-acceptance-manifest.json`，再生成正式目录、ZIP 和哈希清单。内置视频通过 Git LFS 管理，克隆后需取得视频本体。assets 原始资料保留，不覆盖或删除。

## 验证与仓库

101 项自动测试通过；正式包逐文件与验收基线核对、ZIP 完整性及哈希检查通过。0.3.1 的 Edge 浏览器配色效果待用户实机核对。

项目仅供个人，仓库为私有。0.2.0 曾由用户上传到指定仓库，确认提交 `97d763189ee5cf254883459a4c63126d05babeea`；0.3.1 本轮未提交或上传。历史过程见 review.md。
