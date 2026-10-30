# MasterGo「AI 快搭」实现调研

> 目标：回答「AI 快搭到底怎么实现的」，并给出可复刻的最小闭环。
> 方法：① 运行期打开快搭面板并抓取 `performance` 资源与接口；② 下载并静态分析微前端包 `mg-pal.umd.js`（5.2 MB，未混淆，Vue 2.7）；③ 读取宿主 DOM 结构。
> 证据标注：**【代码】**= 包内可读实现；**【实测】**= 运行期观测；**【推断】**= 合理还原，未直接验证。
> 说明：本机为浏览器环境，未安装 MasterGo 客户端，因此**无法触发真实生成**；本文不含「一次真实生成的请求/响应报文」，凡涉及生成报文结构处均已标注推断。

---

## 1. 结论摘要

1. **AI 快搭是一个独立微前端**：`MgPalWeb`（UMD）从 `static.mastergo.com/mg-pal/static/` 加载，**直接挂载进宿主 DOM（无 iframe）**，以一个 980×790 的浮层 `.drag-scale-dialog` 呈现。【实测】
2. **它是「会话 + 任务 + 文档产物」的云端编排模型**：客户端只负责收集意图、发消息、渲染流式事件；真正的页面设计由云端 Agent 产出为 **document artifact（可版本化的设计文档）**，再由前端预览、写回画布。【代码】
3. **意图先分类再执行**：本地正则做初筛，再调 `POST /capi/v1/sessions/design-assistant-routes` 判定 `workflow = conversation | image-generation | canvas-design`，并给出 `canvas_action = create-page`。【代码】
4. **流式协议是自己实现的 SSE**：`GET /capi/v1/sessions/{id}/events?after=<seq>&follow=true&close_on_terminal=true`，用 `fetch + TextDecoder` 手工解析；若服务端返回 JSON 则退化为游标轮询。【代码】
5. **桌面端有一条本地桥**：`127.0.0.1:18180–18189` 上跑 `mastergo-local-ai-canvas-bridge`，提供 `/mg-pal/health`、`/mg-pal/connect`、`/mg-pal/session`，用 challenge 做授权，30s 租约。**没有客户端就显示「未检测到客户端」**。【代码 + 实测】
6. 「文件内快搭」与「AI 快搭（多页面）」是同一套后端，差别在 `workflow / canvas_action / page_design_source` 参数与产物落点（当前文件 vs 新项目）。

---

## 2. 分层架构

```
┌──────────────────────────────────────────────────────────────┐
│ 宿主：MasterGo 编辑器（Electron 壳 / 云端 web）                │
│  ├─ 顶栏 AI 入口（mas-ai-entry）                              │
│  ├─ 浮层容器 .drag-scale-dialog (980×790, z=100000)           │
│  │    └─ .mg-pal-host-container                               │
│  │         └─ .mg-pal-page  ← 微前端挂载点（Vue 2.7）          │
│  └─ 文档 API（全局 mg / getChangesetStore）→ 写回画布          │
└───────────────┬──────────────────────────────┬───────────────┘
                │ HTTPS / SSE                  │ HTTP 127.0.0.1
┌───────────────▼──────────────┐  ┌────────────▼──────────────────┐
│ 云端 AI 编排 (mastergo.com)   │  │ 桌面客户端本地桥 18180-18189  │
│ /capi/v1/*  /ai/api/*        │  │ /mg-pal/health|connect|session │
│ 会话/任务/产物/模板/计费       │  │ 本地技能、MCP、画布执行        │
└──────────────────────────────┘  └───────────────────────────────┘
```

---

## 3. 加载与挂载（实测）

### 3.1 资源

| 资源 | URL |
|---|---|
| 清单 | `https://static.mastergo.com/mg-pal/static/manifest.json` |
| 脚本 | `https://static.mastergo.com/mg-pal/static/mg-pal.-Wc2pAx7.umd.js`（约 5.2 MB） |
| 样式 | `https://static.mastergo.com/mg-pal/static/mg-pal.BQDJmfGv.css` |

全局导出 **`MgPalWeb`**（bundle 首行为 `var MgPalWeb=function(...)`），内部打包了 Vue 2.7、Vuex/Router 与图标库。

### 3.2 挂载形态（实测 DOM）

```
div.drag-scale-dialog.drag-scale-animation   fixed 980×790 @(230,30)  bg #FAFAFA  radius 10  shadow 0 10px 24px rgba(0,0,0,.2)  z 100000
└─ div.dialog-content
   └─ div.canvas-quickbuild-content
      └─ div.mg-pal-host-page            bg #F7F8FA
         └─ div.mg-pal-host-container
            └─ div.mg-pal-page.is-source-canvas   bg #fff
               └─ section.pal-home            (970×1254, 可滚动)
                  ├─ header.pal-home-nav       64 高，白底
                  └─ main.pal-home-main        x=258, 宽 914
```

**关键结论：没有 iframe。** 微前端以 UMD + 宿主 DOM 容器的方式运行，因此可以直接读宿主的登录态、Cookie、`mg` 文档 API。

弹窗几何：宽 **980**、高 **790**、水平居中（`(1440−980)/2=230`），距顶 30；`.pal-home-nav` 高 **64**；主内容左内边距 **28**（258−230），内容宽 **914**。

### 3.3 入口

顶栏 `mas-ai-entry`（蓝色 A）→ 下拉两项：

| 菜单项 | 行为 |
|---|---|
| **MasterGo AI**（Beta） | 进入 AI 会话面板（生成/编辑当前文件） |
| **AI 快搭** | 打开上图浮层，进入「多页面原型」首页 |

浮层首页（实测文案）：
- 顶部：`快搭` 品牌 + `MasterGo`；右侧 `回到旧版`、`● 未检测到客户端`、`✦ 积分`、最小化 / 全屏 / 关闭。
- 主区：徽标「AI 快搭全新升级」；标题「从生成一个页面，到搭建完整产品原型」。
- 两张卡：
  1. **新版 AI 快搭**（推荐）：一次生成多个页面 / 独立项目，持续编辑 / 适合产品方案与评审 → 主按钮「开始生成多页面」。
  2. **文件内快搭**：适合在当前文件中快速补一个单页 → 「查看使用位置」。
- 底部：「从模板开始 ⌄」。

---

## 4. 本地桥（Local AI Canvas Bridge）【代码】

这是「未检测到客户端」背后的机制，也是浏览器版无法本地生成的根本原因。

### 4.1 探测

```js
const PORT_START = 18180, PORT_END = 18189;   // 10 个端口
const HEALTH_TIMEOUT = 500;                    // 单次健康检查 500ms
const PROBE_INTERVAL = 1500;                   // 轮询间隔 1.5s
const RETRY_DELAYS  = [0, 250, 750];           // 首次连接重试
const LEASE = 30000;                           // 授权租约 30s
const LEASE_CACHE = 35000;

for (let p = 18180; p <= 18189; p++) {
  const r = await get(`http://127.0.0.1:${p}/mg-pal/health`, { timeout: 500 });
  // 期望：reason === 'OK'
  //      data.service === 'mastergo-local-ai-canvas-bridge'
  //      data.clientProtocol === 'mastergo' | 'mastergopri'
  //      data.runtimeStatus / readinessProtocol / backendReadiness
  //      data.runtimeCapabilities / mcpStatus / mcpVersion
}
```

选择规则：返回体里 `clientProtocol` 必须等于当前上下文（私有化部署为 `mastergopri`，否则 `mastergo`），首个匹配端口胜出。

### 4.2 授权与握手

```
GET  http://127.0.0.1:<port>/mg-pal/health
→    { reason:"OK", data:{ service:"mastergo-local-ai-canvas-bridge", clientProtocol, runtimeStatus, readinessProtocol, backendReadiness, runtimeCapabilities, mcpStatus, mcpVersion } }

授权页：${protocol}:///local-ai-canvas/authorize?origin=<web origin>&challenge=<nonce>&bridge_port=<port>&requester=mg-pal|mg-agent

GET  /mg-pal/connect?challenge=<nonce>      // 换取 token
GET  /mg-pal/session                        // 建立会话
```

错误码（用于 UI 提示与重试策略）：

```
LOCAL_AI_CANVAS_BRIDGE_AUTH_REQUIRED
LOCAL_AI_CANVAS_BRIDGE_TOKEN_EXPIRED
LOCAL_AI_CANVAS_BRIDGE_USER_CHANGED
LOCAL_AI_CANVAS_BRIDGE_ORIGIN_MISMATCH
LOCAL_AI_CANVAS_BRIDGE_PORT_MISMATCH
LOCAL_AI_CANVAS_BRIDGE_LOGIN_REQUIRED
LOCAL_AI_CANVAS_BRIDGE_ORIGIN_DENIED
```

浏览器无客户端时提示：**「请先打开 MasterGo 客户端，再重试本地 AI 生成。」**

本地缓存键：
`mg-pal:local-ai-canvas-bridge-connection:v1`、`…-authorization-lease:v1`、`…-authorization`。

### 4.3 本地能力

- `GET /capi/v1/local-ai-canvas/status` —— 本地画布能力状态。
- `GET /capi/v1/runtime/capabilities | /components | /skills` —— 运行时能力与技能清单。
- Electron IPC：`mg-pal:list-installed-skills`、`import-local-skill`、`delete-skill` 等（本地技能安装/删除）。
- `mcpStatus / mcpVersion` 表明本地桥同时托管 **MCP** 服务端，供 Agent 调用本地工具。【推断：MCP 工具即「技能」]

> 复刻结论：若做纯 Web 产品，本地桥不是必须；它解决的是「云端 Agent 需要操作本机设计文件 / 本地素材 / 本地技能」这一场景。复刻时可省略，改为纯云端产物 + 前端应用。

---

## 5. 云端接口清单【代码提取】

### 5.1 会话与生成

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/capi/v1/sessions` | 创建会话 |
| GET | `/capi/v1/sessions` | 会话列表（分页/搜索） |
| GET | `/capi/v1/sessions/{id}/messages?cursor&limit` | 历史消息 |
| POST | `/capi/v1/sessions/{id}/messages` | **发送需求**（触发生成） |
| GET | `/capi/v1/sessions/{id}/events?after&follow&close_on_terminal&terminal_task_id` | **SSE 事件流** |
| GET | `/capi/v1/sessions/{id}/tasks` | 任务列表/结果 |
| POST | `/capi/v1/sessions/design-assistant-routes` | **意图分类** |
| GET | `/capi/v1/sessions/model-policy` | 可用模型策略 |
| GET | `/capi/v1/sessions/{id}/document-artifacts/{artifactId}` | 取产物 |
| PATCH | `/capi/v1/sessions/{id}/document-artifacts/{artifactId}` | 更新产物 `{content}` |
| POST | `/capi/v1/sessions/{id}/tasks/{taskId}/cancel` | 取消 |
| GET | `/capi/v1/public/prototype-shares/{token}/view` | 公开原型预览 |

**发消息请求体（源码可读字段）**

```json
{
  "content": "帮我做一个矿山设备管理后台，深色风格…",
  "workflow": "conversation | image-generation | canvas-design",
  "canvas_action": "create-page",
  "page_design_source": { "...": "页面设计来源（续写/风格参考）" },
  "component_libraries": [
    { "team_library_id": "…", "team_library_name": "Ant Design For AI", "user_confirmation_text": "…" }
  ]
}
```

### 5.2 模板与素材

| 路径 | 用途 |
|---|---|
| `/capi/v1/design-templates` | 设计模板（快搭首页模板区） |
| `/capi/v1/project-templates` | 项目模板 |
| `/capi/v1/conversation-templates` | 对话模板（快捷 Prompt） |
| `/capi/v1/discovery-content` / `discovery-favorites` | 发现页内容/收藏 |
| `/capi/v1/images/upload` | 参考图上传 |
| `/api/v1/kits/...` | 设计系统组件库（团队库）下载 |

### 5.3 账号与计费

| 路径 | 用途 |
|---|---|
| `/ai/api/account/subscription` | 订阅状态 |
| `/ai/api/v4/account/credit-pool` | 积分池 |
| `/ai/api/mg/prices` | 价格表 |
| `/api/v1/team/ai/available-entity` | 当前团队可用 AI 实体（打开面板时高频轮询） |

---

## 6. 生成管线（时序）

```
用户输入需求
   │
   ├─(本地正则初筛：是否明显是「图片/生图」或「页面设计」)──┐
   │                                                      ▼
   │                         POST /capi/v1/sessions/design-assistant-routes {content}
   │                         ← { workflow, canvas_action }
   │
   ├─ POST /capi/v1/sessions               （首次）
   ├─ POST /capi/v1/sessions/{id}/messages （content + workflow + canvas_action + 组件库）
   │        └─ 返回 task_id，建立 runSessions: taskId → sessionId
   │
   ├─ GET /capi/v1/sessions/{id}/events?after=0&follow=true&close_on_terminal=true
   │        ↓ 逐条 SSE 事件（文本增量、状态、产物版本、预览）
   │   （若 Content-Type 非 event-stream → 改为 JSON 游标轮询，after=最后序号）
   │
   ├─ GET /capi/v1/sessions/{id}/tasks  → 取 task 结果（agentSessionId / taskRunId）
   ├─ GET /capi/v1/sessions/{id}/document-artifacts/{artifactId}
   │        产物 = 可版本化的设计文档（artifact.id 即 revision）
   │
   └─ 前端渲染预览 → 用户确认 → 写入画布 / 打开为新文件
```

**关键实现细节【代码】**

- 事件流是自己写的 SSE 解析器：`fetch` + `response.body.getReader()` + `TextDecoder`，按 `\n\n` 分帧、`data:` 取 JSON；有心跳/空闲超时。
- 事件游标 `after` 单调递增；`close_on_terminal=true` 让服务端在任务终态后主动断流。
- 断流后使用 `terminal_task_id` 对齐任务，避免重复消费。
- `runSessions: Map<taskId, sessionId>` 把「任务」反查回「会话」。
- 产物有 **artifact 版本**：`{ artifact: { id: <revision>, artifactId } }`；`expectedVersionId` 用于乐观并发校验（版本不符则冲突）。
- 预览模型：`generation.previews = [{ nodeId, name, kind }]`，`kind` 区分 `image` 与页面；`styleContinuationNodeIds` 记录「按某页风格继续生成」的参考节点。
- 继续生成：会自动拼一段系统语义（`"帮我继续生成新的方案" + 原始页面需求`），并强制 `canvas_action=create-page`。

---

## 7. 产物与画布的关系【代码 + 推断】

| 概念 | 含义 | 证据 |
|---|---|---|
| `session` | 一次对话上下文（可多轮） | 接口 |
| `task` | 一次生成运行（可取消） | `/tasks`、`/tasks/{id}/cancel` |
| `artifact` | 设计文档产物，带 revision | `document-artifacts` |
| `preview` | 产物中的单页预览（nodeId + 名称 + 类型） | `generation.previews` |
| `page_design_source` | 设计来源（风格/参考页） | 请求体字段 |

产物内容 `content` 的具体 schema 在客户端包中**没有暴露**（服务端返回，前端只透传/渲染）——这是本次调研唯一的关键盲区。

【推断】结合编辑器节点模型（`FRAME/TEXT/RECTANGLE…` + `fills/strokes/autoLayout`），产物极可能是**与编辑器同构的节点树 JSON**（或可无损转成节点树），理由是：
1. 预览渲染器直接复用编辑器画布；
2. 产物可「打开为独立项目」并继续编辑；
3. 支持 revision 级增量更新（PATCH content）。

---

## 8. 复刻最小闭环（可直接实现）

### 8.1 架构建议

```
前端（编辑器 + AI 面板）
   │  1. 意图分类（可只用一次 LLM function call）
   │  2. POST /ai/session/{id}/messages
   ▼
后端编排（Node）
   ├─ LLM（流式，function call）
   ├─ 页面 DSL 生成器（约束到你的节点 schema）
   ├─ SSE 推送 {type, seq, payload}
   └─ 会话/任务/产物存储（SQLite/Postgres + 对象存储）
   ▼
前端画布 SDK：applyArtifact(json) → 节点树 → 渲染
```

### 8.2 建议的产物 JSON（与编辑器节点模型对齐）

```json
{
  "schemaVersion": 1,
  "pages": [
    {
      "id": "page-1",
      "name": "设备管理",
      "width": 1440,
      "height": 1024,
      "background": "#FFFFFF",
      "root": {
        "id": "n1",
        "type": "FRAME",
        "name": "页面",
        "x": 0, "y": 0, "w": 1440, "h": 1024,
        "fills": [{ "type": "SOLID", "color": [1,1,1,1] }],
        "layout": { "mode": "VERTICAL", "gap": 16, "padding": [24,24,24,24] },
        "children": [
          {
            "id": "n2", "type": "TEXT", "name": "标题",
            "x": 24, "y": 24, "w": 400, "h": 32,
            "text": "设备管理",
            "fontSize": 24, "fontWeight": 600, "color": [0,0,0,1]
          }
        ]
      }
    }
  ]
}
```

> 建议强制「布局 = 自动布局优先、绝对定位兜底」，这样 AI 生成的页面可编辑性好、且易于二次调整。

### 8.3 SSE 事件建议

```js
// 服务端
res.write(`id: ${seq}\n`);
res.write(`data: ${JSON.stringify({ type, seq, payload })}\n\n`);

// 类型
type: 'task.started' | 'message.delta' | 'artifact.updated' | 'preview.ready' | 'task.failed' | 'task.done'
```

前端消费：
```js
const res = await fetch(`/ai/session/${id}/events?after=${seq}`, { headers: { Accept: 'text/event-stream' } });
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const frame = buf.slice(0, i); buf = buf.slice(i + 2);
    const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
    if (data) handle(JSON.parse(data));
  }
}
```

### 8.4 意图分类 Prompt（可直接用）

```
你是设计助手的路由器。判断用户输入属于：
- conversation：闲聊、问答、不产出页面
- image-generation：只要图片/插画/图标
- canvas-design：要生成或修改页面/界面
若为 canvas-design，再判断 canvas_action：
- create-page：从零生成新页面
- edit-node：修改已有节点（需 nodeId）
只输出 JSON：{"workflow":"...","canvas_action":"..."}
```

### 8.5 与编辑器对接

- 生成结果通过 `applyArtifact()` 写入文档：按节点树批量 `createFrame/createText/...`，包在一个 changeset 里提交（可整体撤销）。
- 流式阶段只更新「预览层」；用户点「应用」才写入正式文档。
- 若要「文件内快搭」，需要拿到当前选中节点/当前页作为上下文（对应 `page_design_source`）。

---

## 9. 未解问题与风险

1. **产物 content schema 未知**：服务端生成、前端透传，包内无解析逻辑。复刻时需自定义（见 8.2）。
2. **SSE 事件类型未捕获**：需要一次真实生成抓包（可用桌面客户端 + 代理）。
3. **模型与额度策略**：`model-policy`、`prices` 只看到接口名，未见具体规则。
4. **本地桥的真实执行面**：连接成功后 Agent 能在本机做什么（读写文件？执行脚本？）由 `runtimeCapabilities` 决定，未实测。
5. **html2design 是另一条管线**：`html2design-capture.*.js` 带 `schemaVersion=1`、`contractVersion=1`、`sha256` 与 SRI 校验，用于「导入 HTML 到画布」，不要与 AI 生成混淆。

---

## 10. 附：AI 快搭界面规格（复刻用）

| 元素 | 规格【实测】 |
|---|---|
| 浮层 | 980×790，圆角 10，bg `#FAFAFA`，阴影 `0 10px 24px rgba(0,0,0,.2)`，遮罩 `rgba(0,0,0,.32)` |
| 头部 | 高 64，白底；品牌区 x=258（左内边距 28） |
| 品牌 | logo 76×34 + 「快搭」；右侧 `MasterGo` 带三角标 |
| 头部按钮 | 「回到旧版」77×34 胶囊白底；「未检测到客户端」120×32 浅红底 + 红点；「积分」胶囊 + 蓝色星标 |
| 主内容 | x=258，宽 914，顶部 94 |
| 徽标 | 「AI 快搭全新升级」浅蓝胶囊，蓝字 |
| 标题 | 36px / 800，居中 |
| 卡片 | 914×519，白底，圆角 18 |
| 主按钮 | 蓝底白字（品牌蓝 `#3662EC`），胶囊/圆角 8 |
| 页脚 | 「从模板开始 ⌄」居中胶囊 |
| 滚动 | 内容区 970 宽（预留 10px 滚动条） |

---

## 11. 结论（给复刻者的最短路径）

1. 不要把 AI 快搭做进编辑器 bundle：做成**独立前端应用 + 宿主容器挂载**。
2. 后端只用三张表就能跑通：`session`、`task`、`artifact(revision)`。
3. 生成物统一成**节点树 JSON（带版本）**，预览与写入共用一套渲染器。
4. 流式用 SSE（带 `after` 游标 + 终态断流），断线可续。
5. 本地桥只在「必须操作本机」时才需要；纯云方案完全可以不做。
