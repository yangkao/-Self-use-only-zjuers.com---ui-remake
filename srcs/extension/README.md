# ZJUers 个人首页 0.2.0

2026-10-02，用户通过当前版本审阅，作为本轮最终版本。安装目录保留 `bin/full-preview/`；源码在 `srcs/extension/`。安装配置见 `docs/full-preview.md`，验收边界见 `docs/full-acceptance.md`，校内来源见 `docs/campus-source-notes.md`。

## 功能

基于 zjuers.com 完整页面，包含主界面导航、搜索、折叠与偏好保存、内置视频、次级信息界面及侧边设置。新标签跳转和原站网络失败回退沿用已验收机制。外部来源包括和风天气、一言哲学名句、本科课表／考试、学在浙大作业及有权限和有效内容时的研究生补充。

凭据在扩展自身页面输入，本机 local 存储可自动读取，不进入同步、日志或普通导出，原站不能读取凭据；普通扩展存储不是加密凭据库。缓存优先、主页面绘制后更新、最多两个并发请求。来源失败与旧缓存明确显示。

## 检查与构建

测试：`node --test srcs/extension/tests/*.test.cjs srcs/extension/*.test.cjs tests/campus.test.cjs`

构建：`python srcs/build-preview.py`。检查交付 JavaScript 语法、manifest 文件引用和源码副本一致性。校验清单在 `docs/full-acceptance-manifest.json`。

权限为 storage、tabs、webNavigation、webRequest及manifest列示的来源域。没有新增第三方依赖或永久软件，来源说明在 sources.html。素材记录在 ui/media/SOURCES.md；视频、校徽与assets原件均保留。

当前通过依据为用户真实数据显示与页面审阅、72项自动测试及安装包检查。AI工具未独立完成真实Edge画面验证，不扩大为所有认证分支或浏览器环境均通过。旧MVP在bin/mvp保留。本轮收尾后停止，等待用户安排下一轮。
