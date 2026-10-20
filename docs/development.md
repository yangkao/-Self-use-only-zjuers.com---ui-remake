# 开发与构建

1.0.0 组件由 `ui/controls.*`、`ui/surfaces.css` 和 `ui/glass-surface.js` 管理；`cc98-core.js` 负责分页／字段／配额，`ui/cc98-*` 与 `ui/cc98.js` 管理共享视图状态。`palette-sampling.js` 将媒体采样与配色派生分离。

公开源码含 `srcs/demo/`、`srcs/build-demo.py`、`tests/demo.test.cjs` 和 Pages 工作流。执行 `python srcs/build-demo.py` 后，在项目根运行 `python -m http.server 8000`，访问 `/bin/demo/`。源码包内的 `srcs/build-release.py` 使用固定 ZIP 时间戳，包含扩展、演示、工作流及公开 `docs/`；不含 AI 过程文档。

## 结构

```text
srcs/extension/       扩展源码、资源和 Node 内置测试
srcs/build-release.py 无第三方依赖的发布构建
tests/               干净安装与发布边界检查
docs/                产品与开发说明
licenses/            第三方许可证
bin/release/         生成产物（不提交）
```

## 运行结构

`background.js` 使用事件监听新标签和原站主文档状态；没有 chrome_url_overrides。回退通过创建未指定 URL 的新标签并关闭失败标签，避免 Edge 对直接跳转内部页面的限制。

`boot.js`／`startup.js` 在 document_start 遮蔽原站过渡画面；`content.js` 从完整原站提取导航，挂载 Shadow DOM 中的 `ui/template.html`。样式与当前主题准备后显示，失败时解除遮蔽恢复原站。

`navigation-core.js` 区分默认内容、自定义内容和覆盖规则，为原站条目生成内部身份；`navigation-background.js` 串行保存、检查版本，跨标签广播。折叠版本冲突读取最新状态后至多重试一次，结构编辑不自动重放。

`external-background.js` 集中请求、权限约束、缓存和任务合并；`providers/` 分离学校、WebVPN 与 CC98。`external-core.js` 提供 summary／secondary／status／full 数据投影；摘要读取不触发额外天气 HTTP。组件只接收所需摘要，详情按需读取。

`ui/settings.js` 按需构建设置，配置 iframe 接近视区才加载；无修改页面关闭后释放，未保存或忙碌表单保留。秘密配置由扩展页处理，不传进原站或内容脚本。

`theme-core.js` 规范化主题；`file-handles.js` 使用 IndexedDB 保存用户授权的本机句柄；`media.js`／`media-playback.js` 控制壁纸。页面隐藏时暂停视频，返回续播；主题缩略图生成后销毁相应 iframe。

`widget-core.js` 保存组件定义，`widget-background.js` 管理真实时间与系统提醒，`ui/widgets.js` 管理展开与编辑。计时器以时间戳恢复，关闭浏览器仍继续计时。

## 测试与构建

Python 3.11+、Node.js 22+。不需要安装第三方库、不需要 Git LFS、私有素材或真实凭据。

```powershell
node --test srcs/extension/tests/*.test.cjs tests/*.test.cjs
python srcs/build-release.py
```

测试中的账号、Key、路径和数据为合成样本，不可用于登录。构建执行测试、检查 JavaScript 语法和清单引用，禁止扩展包出现媒体本体与迁移工具，验证 ZIP 与逐文件哈希。私密值模式检查覆盖全部公开源码文件，包括演示、文档、测试和工作流；文档链接检查包含根目录与演示 README。模式检查无法证明所有未知格式秘密均不存在，发布前仍需审阅实际文件清单与差异。

构建不访问网络或浏览器存储。生成扩展 ZIP、单独的源码 ZIP、SHA256SUMS 和逐文件 manifest；输出目录为 `bin/release/`。固定 ZIP 时间戳使同一源码生成的包可重复核验。

## 修改与贡献

遵守 GPL-3.0，保留第三方声明并标明改动。新增信息源需补充用户配置、请求边界、失败／空数据／缓存状态与隐私说明；不要向日志、测试夹具或导出文件加入真实凭据。不要用抓取当前浏览器配置的方式制作发布包。

开发者可以自行加载 `srcs/extension`；如需长期个人配置，请固定加载目录。公开发布不要把浏览器配置目录、真实请求报告或个人配置备份加入 Git。
