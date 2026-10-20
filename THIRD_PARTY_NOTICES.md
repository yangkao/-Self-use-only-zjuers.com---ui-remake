# 第三方来源与许可

本清单随源码和扩展安装包一并提供。第三方内容不因本项目采用 GPL-3.0 而自动转授与其原许可不相符的权利。

## nightTab

- 项目：https://github.com/zombieFox/nightTab
- 作者：zombieFox 及 nightTab contributors。
- 参考版本：7.6.0；许可：GNU GPL version 3，全文见 `licenses/nightTab-GPL-3.0.txt`。
- 本项目对时间／日期、搜索、设置层级和编辑交互进行了面向 ZJUers 的适配，并重新组织布局、主题变量和组件。相关实现集中在 `ui/script.js`、`ui/style.css`、`ui/navigation.*`、`ui/settings.js`、`ui/customization.*` 等文件。它们包含本项目的修改和新增，非原版 nightTab。公开整理日期：2026-10-15。
- 保留 GPL 许可及原项目来源；项目整体代码按 GPL-3.0-only 分发。此许可不表示 nightTab 作者认可本项目。

## Celechron

- 项目：https://github.com/Celechron/Celechron
- 作者：Celechron contributors；仓库 LICENSE 为 GNU GPL version 3，见 `licenses/Celechron-GPL-3.0.txt`。
- 本项目参考统一认证、课表／考试和学在浙大接入行为，编写浏览器扩展适配（`providers/campus.js` 等）。校历由 `calendar.celechron.top` 公开服务提供；不是本项目随包分发的数据。

## 字体

- Josefin Sans：Copyright 2010 The Josefin Sans Project Authors，Reserved Font Name "Josefin Sans"；SIL OFL 1.1。字体原文件及声明见 `ui/media/JosefinSans.ttf`、`JosefinSans-OFL.txt`。
- Roboto Slab：Google Fonts，Apache License 2.0；保留的原资源与许可见 `ui/media/RobotoSlab.ttf`、`RobotoSlab-LICENSE.txt`。当前 UI 不默认使用此字体。
- 中文字体、Segoe UI 等使用操作系统已安装字体，本项目不附带这些字体文件。

## 页面、图标与标识

- 基础页面与导航：https://zjuers.com/；美化参考为维护者提供的「ZJUers 轻首页美化」。不随源码发布原站完整副本或原参考扩展包。
- `ui/media/zjuers.png`、`favicon.ico` 来自 ZJUers 原站 `images/ico.png`、`images/favicon.ico`；浙江大学求是鹰来自维护者提供的校徽原图，运行时裁切换色；`assets/cc98.ico` 是 CC98 标识。
- `assets/reference-*.png` 是维护者提供的免费素材库图标截图，保留其轮廓，仅裁切／换色使用；其他线条 SVG 和天气图标由本项目绘制或按维护者参考重新实现。维护者已确认这些提供素材可用于本次发布，项目没有为未标明许可的图像另行宣称 GPL 授权。原始素材库地址与独立许可未附在提供文件中，不能将其说明为已核验的任意用途授权。
- 标识用于指示来源与导航，不表示学校、平台或原作者背书。本项目代码许可不授予相应商标权。

## GooseHyperGlass 液态玻璃渲染器

- 来自已批准的“ZJUers 轻首页美化”参考包，原项目为 GooseHyperGlass；实际复用本地 WebGL 渲染器及适配代码，不加载远程脚本，不调用包内 Siri 动画组件。
- Apache License 2.0 及具体来源、适配修改说明分别保留在 `vendor/Goose-LICENSE`、`vendor/Goose-NOTICE.md`。本项目增加了现有媒体纹理、真实控件圆角、主题视觉参数、按需调度和销毁适配。

## 运行时外部内容

Bing 每日壁纸、和风天气、一言、学校平台和 CC98 内容由各自服务运行时提供，适用各服务的条款、许可和账号权限；不作为本项目代码重新许可。用户选择的本地图片／视频属于用户本机文件，不随发布包分发。
