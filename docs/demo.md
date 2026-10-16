# 在线演示与部署

在线演示地址：<https://yangkao.github.io/-Self-use-only-zjuers.com---ui-remake/>

这是独立网页demo，复用0.4.0扩展UI。天气、课表、考试、作业、CC98等均为合成示例；无须账号，不读取扩展设置，也不调用学校、CC98或付费天气接口。默认搜索栏不透明度为20%。详细范围与本地启动说明见[srcs/demo/README.md](../srcs/demo/README.md)。

## GitHub Pages

1. 确保源码与`.github/workflows/deploy-demo.yml`在默认分支`main`。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 仓库 **Actions → Deploy homepage demo → Run workflow**，分支选`main`。
4. `build`和`deploy`均成功后，以部署输出的网页地址为准。首次部署前，上面的链接可能返回404。

工作流先读取必应官方元数据，再构建demo，仅将`bin/demo`发布到Pages，不发布源码目录、个人配置或扩展凭据。每次相关源码提交、手动执行，以及每日北京时间08:23的定时任务都会运行；GitHub定时任务可能延迟，不保证准点。公开仓库长期无活动可能停用定时任务，可在Actions中重新启用。

不需要添加API Key、GitHub个人令牌或账号Secrets。GitHub自动提供的工作流令牌仅获得读取源码、写入Pages部署和OIDC身份验证所需权限，不修改仓库内容和Release。

必应JSON接口不允许网页跨域读取，因此由工作流更新`bing.json`；网页直接加载官方图片并取色，保留版权文字。不把必应图片作为可再分发素材打包。构建时必应不可达会使构建失败，保留上次成功部署；访客访问时图片加载失败则使用自绘后备壁纸。

## 常见问题

- **没有Run workflow**：确认工作流已提交到`main`，仓库Actions已启用，然后刷新。
- **Pages配置报错或404**：先设置Pages来源为GitHub Actions，再重新运行；检查两项作业是否均成功，并打开部署输出URL。
- **environment保护规则阻止部署**：在Settings → Environments → github-pages允许`main`部署；如配置了人工审批，在Actions批准该次部署。
- **壁纸仍是前一天**：检查当天定时任务及必应元数据请求；可手动Run workflow重建。构建不需要提交每日元数据到main。
- **想调整demo源码**：修改`srcs/demo`，执行`python srcs/build-demo.py`；正式扩展不加载该目录。
