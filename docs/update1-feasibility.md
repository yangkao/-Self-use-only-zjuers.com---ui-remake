> 历史可行性记录。最终方案已改为主题仅本机保存、不填写设备名称；参见 update1-implementation.md。临时验证工程已于正式验收后清理，结论和用户测试证据保留。

# 第一轮改进：可行性核对（2026-10-04）

## 已确认的需求
- 壁纸不复制、不长期缓存，只保存原文件路径和设备名称；路径不可用时提示并恢复内置视频。
- Edge 浏览器配色单独验证。
- 本步仅调研与临时验证，不修改正式扩展或AGENTS.md。用户现有文档改动保留。

## nightTab 视觉参数
依据本机 nightTab 7.6.0 参考源码的 src/component/state/index.js、menuContent 下 themeSetting/layoutSetting/headerSetting/bookmarkSetting/groupSetting，以及 bookmarkForm。
- 配色：界面主色相与饱和度、明暗范围、强调色HSL/RGB、随机强调色与循环速度/步长、深色/浅色/跟随系统。
- 字体：展示字体与UI字体分别配置名称、字重、正体/斜体。字体效果取决于所用字体支持。
- 背景：主题色、强调色、纯色、渐变（角度/两端颜色）、图片URL、视频URL；图片/视频模糊、灰度、缩放、强调色混合、不透明度、暗角强度/起止位置。
- 外观：圆角、阴影、遮罩不透明度/模糊、总体及搜索/书签/工具栏不透明度；布局/头部/书签底色可跟随主题或自定义，布局背景模糊、分隔线尺寸、书签边框。
- 布局：整体缩放/宽度/内边距/间距、水平或垂直排列、九宫格对齐、头部与书签顺序及区域宽度/对齐、滚动条自动/细/隐藏。
- 头部：问候/时钟/日期/搜索各自尺寸、显示与换行、排列；搜索宽度及文本对齐；日期时间显示格式。
- 分组及书签：分组名/工具栏大小与排列、书签块/列表样式、大小、悬停放大、阴影与URL显示；单书签图标/字母/图片、大小/排列/旋转/位移、独立颜色/边框/背景。
- 主题：预设与自定义主题保存/编辑。功能设置不应不加区分地纳入本项目的视觉主题。
建议本项目先采用配色、背景滤镜、字体、布局尺寸、组件透明度/圆角/阴影/边框、标题及搜索尺寸；不直接引入大书签形状、工具栏位置或打乱导航分类。

## 原站图标
直接读取 https://zjuers.com/css/style.min.css，header .logo img 使用 donghua 3.7s linear infinite，0deg到-360deg。HTML为images/ico.png静态图片；可用现有图片加CSS旋转，暂不修改标签页favicon。

## 壁纸限制与验证
https原站页面不能直接可靠读取file媒体；官方文件权限要求用户手动授权。候选方案为扩展自身媒体页面读取原文件，再验证嵌入原站后的呈现及Canvas取色。
temp/update1-wallpaper-probe/ 为独立临时扩展，保存路径、用户填写的设备标签及媒体类型，测试file权限、加载/播放、Canvas取色与重启恢复。不上传文件或读取校内凭据。node --check通过；尚未在真实Edge执行，不宣称可行性通过。
设备名称不能依赖网页自动获取Windows主机名；建议手动填写友好名称并保存本机匹配标识的方案另行确认。
测试步骤：在edge://extensions加载该临时目录；详情页开启允许访问文件URL；扩展选项输入原视频绝对路径并测试，再测试图片、浏览器重启和不存在的路径。此探针不包含正式版默认壁纸回退和弹窗。
仅证明独立扩展页成功还不足以证明原站覆盖界面可用，后续还需嵌入媒体、取色、首屏性能和大视频测试。

## 校内直达
现有parseAssignments只保留todo id/title/course_name/end_time，固定链接为学在浙大首页；Celechron参考同样未保留完整详情地址。
优先核对真实todo返回是否含URL、course_id/activity_id及条目类型；todos id不能直接认定是activity_id。不按课程名称猜测映射。
本科/研究生课表和考试当前没有已验证的独立详情网页链接；公开学校通知可证实课表查询栏目，但不能证明单课程或单考试详情可深链。需要已有登录态下的浏览器路由或脱敏接口结构验证。只查询，不执行选课/退课/提交等写操作。

## Edge配色
官方Edge API清单未提供动态浏览器主题更新接口；Chromium主题包为独立、不含JS/HTML的扩展形式。可单独测试手动应用颜色主题；不得把主题包可生成等同于自动同步可用。目前尚未实机验证安装。

## 参考
- https://github.com/zombieFox/nightTab/blob/main/src/component/state/index.js
- https://github.com/zombieFox/nightTab/wiki/Local-background-image
- https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support
- https://developer.chrome.com/docs/extensions/develop/ui/themes

## 下一步
先取得壁纸探针实机结果与校内直达所需的脱敏路由，再确定技术方案及视觉参数；尚未进入产品实现。


## 2026-10-04 follow-up

2026-10-04，用户确认采用建议的视觉设置。用户实机反馈：临时扩展能读取图片和视频，不存在的路径输出 File URL permission: true / Media failed; code: image error。该证据确认独立扩展页媒体加载和错误事件，不扩大为重启恢复、Canvas取色或原站嵌入通过。用户已刷新校内登录态并确认首页课表/考试可更新。AI联网工具尝试访问todos及本科入口，但不能继承Edge登录态，本轮无浏览器会话操作工具；未读取浏览器配置或提取凭据。新增temp/update1-campus-links-probe.js，用已登录页面同源GET检查todo结构，仅输出键名和必要路由字段，URL查询值不输出，正式源码未修改。仍需真实路由证据才能确定条目直达。


## 2026-10-04 campus routing scope

用户提供已登录学在浙大/api/todos只读检查结果：HTTP 200，根字段todo_list，共9条。示例条目含course_id、id、type=homework，未返回url/html_url/link/href或独立activity_id。可确认存在课程与待办编号，但尚不能仅凭此确认id就是网页作业路由编号。下一步仅需对照一条实际作业页URL验证路由。用户明确课程无独立条目、无需细化课程直达；考试同样无独立条目，按第3条上下文理解为无需细化考试直达，保留既有课程/考试链接，不再调查其单条目详情。正式源码与AGENTS.md未修改，个人课程/作业编号不写入公共测试夹具。


### Homework page route evidence

用户提供实际作业详情地址，确认网页路由形态为 https://courses.zju.edu.cn/course/{course_id}/learning-activity#/{activity_id}?view=scores。具体个人作业编号不写入项目记录。该地址的课程/条目编号未包含于此前三条接口样本，尚需与同一作业的todo记录对照，才能确认todo.id等于路由activity_id。view=scores为用户实际链接中的视图参数，不据此推断所有作业都应打开成绩视图；实施时优先核对无该参数时默认打开的内容。课程/考试直达不在本轮范围。未修改正式源码。


## 2026-10-04 embedded wallpaper and browser theme probes

用户确认实际作业的todo.id与详情URL条目编号一致，作业直达路由核对通过；默认无view=scores的页面效果留待预览验证。按用户授权继续可行性验证：临时壁纸探针升级0.0.2，在zjuers首页嵌入独立扩展iframe，仍只保存路径、设备标签和媒体类型，增加32x32 Canvas采样与平均颜色输出。新增temp/update1-edge-theme-probe/独立静态紫色浏览器主题包，用于用户手动安装验证。两个JSON及资源引用、两个JS语法检查通过；尚无实机嵌入、取色、重启和主题安装结果。静态主题可安装不等于能由正式扩展自动切换浏览器主题。正式源码、安装包与AGENTS未修改。


## 2026-10-04 user verification passed

用户实机验证：壁纸嵌入、取色、媒体显示、视频播放均正常，完全退出后重启可恢复加载；Canvas输出95,63,102与#5f3f66。该平均色仅为探针验证像素读取，不作为最终主题算法。用户明确要求依据壁纸生成整套控件主题色，保持此前默认壁纸成套配色的方式。主题生成方案为导入/指定时低分辨率采样图片或视频多个帧，提取候选主色，派生页面底色、强调色、主/次文字、搜索栏、导航卡片、次级卡片、设置面板、边框、悬停/选中状态、阴影等语义颜色，并检查文字与底色对比；可手动修改，作为主题持久保存，不播放时实时变色。视频多帧取色和最终配色算法尚未实现验证。用户确认独立Edge主题包可安装并正常改变标签栏和工具栏等控件；此结论证明静态手动主题路径，不证明功能扩展可自动安装/切换主题。已确认本轮视觉设置清单；课程/考试直达取消，作业id与路由对应通过。错误文件路径事件已验证；正式报错弹窗、默认壁纸回退及无view=scores作业页面效果留待实现审阅。未修改正式代码、AGENTS或验收基线。
