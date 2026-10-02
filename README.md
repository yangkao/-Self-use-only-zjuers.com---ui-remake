# ZJUers 个人首页

个人使用的 Microsoft Edge 起始页／新标签页扩展。以 **ZJUers 轻首页完整原站**和 **ZJUers 轻首页美化**为基础，在 zjuers.com 上应用个人界面。当前正式版本 **0.2.0**，2026-10-02 经用户审阅通过。

## 使用与功能

- 新建标签进入 zjuers.com，加载完整原站后应用个人界面；已识别的原站连接失败会替换为 Edge 默认新标签页。
- 导航分组、搜索引擎选择、折叠记忆、内置静音循环视频壁纸、时间与问候。
- 空白处右键进入次级界面，次级空白处左键返回；角落齿轮打开侧边设置。
- 和风天气、一言哲学名句、本科课表／考试、学在浙大作业；研究生课程仅在有权限且取得有效内容时补充。
- 信息源配置在扩展自身页面完成；主页面绘制后更新，缓存优先，失败和旧缓存明确标注。

完整安装、升级和配置步骤见 [安装说明](docs/install.md)。权限、凭据方式和已知限制见 [正式交付说明](docs/release.md)。

## 相对原站和原美化包的主要改动

- 导航改为浙大、学术、实用工具、其它／关于本站四组；删除社交娱乐，合并工具分组，精简学习栏，并按确认清单增删工具链接；保留原站链接、智能跳转及悬停说明。
- 以 nightTab 为主要视觉参考，采用紧凑导航卡片、组折叠、字体与搜索控件；青柠作为主次界面覆盖切换参考。
- 内置西行妖视频，移除必应壁纸及壁纸切换；称呼固定为 Yangkao。
- 增加次级信息页、侧边设置、课表月历、外部来源状态与缓存；校内接入参考 Celechron。

详细改动和阶段记录见 [implementation.md](docs/implementation.md)、[review.md](docs/review.md)，素材来源见 [SOURCES.md](srcs/extension/ui/media/SOURCES.md)。本项目仅用于个人，目标仓库为私有仓库。

## 目录与构建

| 路径 | 用途 |
| --- | --- |
| srcs/extension/ | 正式扩展源码及必要运行素材 |
| srcs/extension/tests/、tests/ | 自动测试 |
| srcs/build-preview.py | 重建现有安装目录 |
| srcs/build-release.py | 核对验收基线并生成正式包 |
| docs/ | 设计、接入、验收、安装与过程记录 |
| bin/release/ | 本机正式交付目录，Git忽略 |

使用既有 Node.js 与 Python，无第三方构建依赖：

```text
node --test srcs/extension/tests/*.test.cjs srcs/extension/*.test.cjs tests/campus.test.cjs
python srcs/build-release.py
```

内置视频通过 Git LFS 管理。未来从私有仓库克隆后，需取得 LFS 视频本体再构建。原始assets、历史版本、临时下载资料留在本机，不进入正式源码仓库；历史文档中的本机资料链接可能不随克隆提供。

## 验证状态

用户已确认真实数据正常显示并通过最终界面审阅。72项自动测试及交付一致性检查通过；AI浏览器未独立完成真实Edge画面验证，不将通过范围扩大为所有认证分支、学校账号或浏览器版本。后续上传记录将在取得仓库地址后补充。
