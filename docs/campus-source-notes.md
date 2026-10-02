# 校内信息适配来源与限制

核对日期为 2026-10-02。通过 agent-reach 的 GitHub 研究流程核对；本机没有 `gh`，GitHub API 触发公共 IP 限流，随后从 GitHub 官方 codeload 下载 main 分支归档，并直接阅读以下原始实现。归档保留在 `temp/celechron-source.zip`，解包目录为 `temp/celechron-source/`，便于复核。没有安装或更新依赖。

## 接口证据

| 来源 | 核对内容 | 本项目处理 |
| --- | --- | --- |
| [zjuam.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/zjuServices/zjuam.dart) | CAS 登录页 execution、公钥 modulus/exponent、RSA 整数幂、表单字段；同进程合并认证；近期版本不再持久化恢复 iPlanetDirectoryPro | 原生浏览器 Cookie 管理，直接业务请求优先；认证仅在业务会话失效时建立，不读写 Cookie 内容；密码只用于本次请求 |
| [zdbk.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/zjuServices/zdbk.dart) | `kbcx/xskbcx_cxXsKb.html` POST；`kbList`；验证码标志；考试 POST `xskscx/kscx_cxXsgrksIndex.html?doType=query&queryModel.showCount=5000` | 请求真实端点；认证最多重建一次；验证码停止自动尝试；格式变化明确失败 |
| [session.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/model/session.dart) | 本科 `kcb` 的四段换行内容；`xqj`、`djj`、`skcd`、`xxq`、`dsz`、`sfqd`、`sfyjskc` | 只展示已确认本科课；地点中明确出现的校区可提取，其他地点不猜校区 |
| [ugrs_spider.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/ugrs_spider.dart) | `xnm` 是 `YYYY-YYYY`，`xqm` 为 `1\|秋`、`1\|冬`、`2\|春`、`2\|夏`；研究生课程代码 13/14/11/12；研究生考试秋冬使用 xq=12、春夏使用 xq=11 | 查询当前学年两个半学期；研究生独立失败；当前学期边界按九月学年及二月春夏查询，界面以真实安排日期筛选 |
| [courses.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/zjuServices/courses.dart) | `courses.zju.edu.cn/user/index` 登录链，identity/CAS 跳转与 HTTP 200 meta refresh；`api/todos` | 原生跟随 HTTP 跳转；受限域名内跟随 meta refresh；待办接口直接先复用业务 Cookie |
| [todo.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/model/todo.dart) | `todo_list`、`is_student`、`id`、`title`、`course_name`、`end_time` | 只保留学生待办，截止时间换算为 +08:00；无截止时间排最后；不根据这些字段推断是否提交 |
| [grs_new.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/zjuServices/grs_new.dart) | CAS service 为 `https://yjsy.zju.edu.cn/`；ticket 交给 `/dataapi/sys/cas/client/validateLogin`，返回 `result.token`；业务头 `X-Access-Token`；课表 `result.kcbMap[day][period].pyKcbjSjddVOList`；考试 `result.records` | 实现真实 token 交换与课表、考试解析；研究生只在解析到有效课程后可见；没有日期或钟点不生成占位时间 |
| [calendar_config_parser.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/calendar_config_parser.dart) 与 [time_config_service.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/http/time_config_service.dart) | 明确使用 `http://calendar.celechron.top/YYYY-YYYY-T.json`；`startEnd` 四日期、`sessionTime` 以节次作下标、`holiday`、`exchange` | 仅使用取得并校验的对应学期配置，不采用来源实现的推算日期和默认时间降级；获取失败保留节次，标记日期和时间未确定 |
| [semester.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/model/semester.dart) 与 [exam.dart](https://raw.githubusercontent.com/Celechron/Celechron/main/lib/model/exam.dart) | 半学期单双周、节假日、双向调休；本科期中 `qzkssj/qzjsmc`，期末 `kssj/jsmc` | 映射真实日期；考试周标签保留原文，不采用来源实现的 1970 日期或默认钟点 |

Celechron 仓库许可证为 [GPL-3.0](https://github.com/Celechron/Celechron/blob/main/LICENSE)。本模块依据接口字段和流程重新实现 JavaScript 适配，没有复制 Dart 代码、图片或字体；来源代码归档仅作为研究材料。对外发布时应再次核对所使用材料的许可要求。

## 浏览器认证衔接

请求必须从扩展后台发起，使用 `credentials: 'include'`，Cookie 由浏览器管理。内容脚本不应获得密码、Cookie、ticket 或 token。模块不自行存储凭据，不记录网络响应正文，不将原始异常文字返回界面。

[Chrome 扩展网络文档](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)确认有 host permissions 的扩展 service worker 可以请求外部主机。host permission 与 URL scheme 区分；HTTP 校历需单独声明。

[Fetch 响应类型说明](https://developer.mozilla.org/en-US/docs/Web/API/Response/type)说明 `redirect: 'manual'` 的重定向响应为 `opaqueredirect`，无法读取 Location。Dart 可以读取的 CAS Location 不能直接按相同方式移植到浏览器 fetch。

`CampusProvider.create({request, now, serviceCallback})` 的 `serviceCallback` 是可选的后台原生桥接接口。流程如下。

1. 合并本轮 CAS 认证后，桥接函数发起 `https://zjuam.zju.edu.cn/cas/login?service=https%3A%2F%2Fyjsy.zju.edu.cn%2F` 的 GET。必须保留浏览器 Cookie，并采用 manual redirect，不能先跟随并消耗 ticket。
2. 在后台以 `webRequest.onHeadersReceived` 或 `onBeforeRedirect` 观察该请求的重定向。过滤 URL 必须精确匹配以上 CAS service 请求，并确认发起者是本扩展后台、请求 ID 属于该次任务，避免接受其他标签页的登录跳转。
3. 接受的 Location 必须是 HTTPS，origin 为 `https://yjsy.zju.edu.cn`，pathname 为 `/`，有非空 ticket。回调 URL 只在内存中立即返回给 provider，不写存储或日志。
4. provider 立刻请求 `https://yjsy.zju.edu.cn/dataapi/sys/cas/client/validateLogin?ticket=...&service=https%3A%2F%2Fyjsy.zju.edu.cn%2F`，接受 `success === true` 和非空 `result.token`，随后只在研究生请求头中使用 token。
5. 桥接超时或 ticket 无法读取，单独显示 `GRADUATE_REDIRECT_UNAVAILABLE`。默认无桥接路径仅在自动跟随后的最终 URL 仍含有效 ticket 时尝试交换；通常可能无法完成，绝不声称已验证研究生实网登录。

需要的主机范围为 `https://zjuam.zju.edu.cn/*`、`https://zdbk.zju.edu.cn/*`、`https://courses.zju.edu.cn/*`、`https://identity.zju.edu.cn/*`、`https://yjsy.zju.edu.cn/*`、`http://calendar.celechron.top/*`。桥接还需原生 `webRequest` 权限；本模块自身不要求 `cookies` 权限。

## 校历 HTTPS 检查

公开源码明确使用 HTTP。2026-10-02 用 Web 工具请求 HTTPS 不可达；沙箱外执行 `curl.exe -I --max-time 15 https://calendar.celechron.top/2026-2027-1.json` 返回 `schannel ... SEC_E_ILLEGAL_MESSAGE`，TLS 握手失败。不能将 HTTPS 支持视为已验证。若后台仅允许 HTTPS，应明确放行无凭据的准确 HTTP 校历主机，或者展示校历不可用。不能拿来源实现中的推算日期冒充真实课表。

## 状态、测试和尚待实网验证

`courses/exams/assignments` 返回规范化 items 和 `{code,message}` warnings；抛出的 Error 含经固定文案处理的 `code`、`publicMessage`。网络错误、服务响应正文、密码、Cookie、ticket 和 token 不进入公开错误。

研究生网络故障或认证失效使用五分钟冷却后再次探测；重定向能力限制和格式变化保留本会话失败，手动 force 或 reset 后重新探测。没有依据将临时失败标为无权限。错误凭据或验证码阻止后续自动密码提交，账号页面重设/reset 后才恢复。只在实际有效课程存在时显示研究生内容。

测试命令为 `node --test tests/campus.test.cjs`。无秘密夹具覆盖校历节次、单双周和调休、校历缺失、考试未公布日期、作业截止时区、标准 RSA 小整数向量、浏览器 Cookie 复用、研究生独立失败和手动重试、token 交换、研究生考试、暂时故障冷却、错误凭据不循环和错误脱敏。

这些测试确认解析与控制流程，不代替实际学号和 Edge 的登录测试。现网验证码、identity 新认证链、SameSite Cookie 行为、研究生权限、未来学期校历发布与研究生考试分页上限仍需实际账号验证。研究生考试请求继承来源 pageSize=100；超过该上限的账号需补充分页证据后扩展。没有添加未核对的接口。

## 审查修正与课程加载（2026-10-02）

补齐字符串或数值的 401／403／901、嵌套 kickout 与认证页面识别。研究生令牌失效最多自动换取一次；持续失效进入冷却。reset 会使未完成的旧登录和令牌任务失效，防止退出后继续提交密码或恢复旧令牌。

本科同一课程的多个上课时段使用不同标识，避免合并时漏课。研究生显式周次按 semester.dart 的星期表映射，第 17 周之后以第二半学期最后一个双周星期日为基准；显式安排遵循来源中节假日和调休处理的顺序。缺失校历时只保留节次，不推算日期。

courses 支持指定 date，返回 academicTerm 和经过校验的 range；后台按学期分别缓存，使跨学期查看不会复用错误学期的数据。onPartial 回调先发布本科结果，研究生查询完成后再补入有效内容，不让研究生超时阻塞本科卡片。无本科有效日期时界面明确标记日期待确定。

24 项校内测试覆盖以上边界及回调错误传播。实际学校账号与 Edge 认证仍待用户配置后验证。
