# MasterGo 编辑器 + AI 快搭 · 复刻级技术拆解

> 目标：为使用 **原生 HTML + Canvas** 复刻「设计与原型编辑器」以及「AI 快搭」提供实现级依据。
> 范围：UI 布局 spec、交互/状态机、数据模型、协作协议、AI 生成闭环、分阶段复刻路线。
> 方法：运行期注入探针读取编辑器内部 API 与文档模型 + CDP 抓取 WebSocket/HTTP 真实流量 + 界面实测截图。
> 标记约定：**【实测】**=运行时直接读到的事实；**【推断】**=基于证据的合理还原，复刻时需自定。

---

## 0. 证据索引

| 证据 | 位置 |
|---|---|
| 编辑器界面截图 | `screenshots/07-editor.png`、`08-design-panel.png`、`09-prototype-panel.png`、`10-inspect-panel.png`、`11-resource-panel.png` |
| 菜单与快捷键截图 | `13-main-menu.png`、`14-file-menu.png`、`16-plugin-menu.png`、`15-preferences.png` |
| AI 快搭界面截图 | `screenshots/05-ai-quickbuild.png` |
| WebSocket 帧解析结果 | `%TEMP%\mg_cdp\frames.json` |
| AI 快搭接口清单 | `%TEMP%\mg_cdp\api.json` |
| 探针脚本 | `%TEMP%\mg_cdp\cdp.mjs`、`frames.mjs`、`api.mjs`、`probe.mjs` |

---

## 1. 总体架构

### 1.1 前端模块划分【实测】

编辑器页面加载的 webpack 分包名直接暴露了产品模块拓扑：

| 分包关键字 | 推断职责 |
|---|---|
| `mg-editor` | 设计编辑器主模块（画布、图层、属性面板） |
| `mg-editor-lite` | 轻量编辑器（预览/嵌入场景） |
| `mg-preview` / `mg-prototype` | 原型预览与演示运行器 |
| `mg-plugin` | 插件运行时与插件坞 |
| `mg-dev-workbench` | 开发者工作台（插件开发/调试） |
| `mg-main` / `mg-lazy` / `mg-other` | 主壳、懒加载、其他页面 |
| `mg-ai-fll-page-generation` | **AI 整页生成**（AI 快搭核心） |
| `mg-ai-text-generate-image` | AI 文生图 |
| `mg-pal-host` / `mg-pal` | **AI 快搭宿主与微前端应用** |

> 复刻启示：编辑器与 AI 生成应是**两个独立应用**，通过文档 API（`mg`）与宿主页面桥接，而不是同一 bundle 内的两个页面。

### 1.2 渲染层【实测 + 推断】

- DOM 只承担**界面外壳**（工具栏、面板、图层树、菜单），画布区域为 `<canvas>`。
- 页面内实测到 2 个 canvas：主画布 `620×703`（= 左栏 288px + 右栏 216px 之后的剩余区域），以及一个 `512×60` 的辅助 canvas（推断为标尺/缩略图或文本测量缓冲）。
- 图层树、属性面板均为普通 DOM，不随画布缩放重绘。
- 【推断】主画布使用 Canvas2D 或 WebGL 场景图渲染，按可视区域裁剪绘制；缩放用变换矩阵而非重绘布局。

【实测】主容器类名：`appmain_container`、`toolbar-container`、`left-bar__layer`、`layer_tree`、`panel_container`。

### 1.3 关键全局对象【实测】

| 全局 | 作用 |
|---|---|
| `mg` | 文档/插件 API（等价 Figma Plugin API），编辑器能力的唯一出口 |
| `mgI18n` / `mgTrans` | 国际化字典与翻译函数 |
| `getChangesetStore()` | 变更集存储（【推断】协作与撤销的共同底座） |
| `migrateStoreData` | 本地数据版本迁移 |
| `__mgToggleRequestCache` | 功能开关（toggles）缓存 |

---

## 2. 文档与图层数据模型【实测】

### 2.1 层级

```
DOCUMENT (type: "DOCUMENT", name = 文件名)
└── PAGE × N            // 实测当前文件 3 个页面
    └── 容器节点（FRAME 等）  // 实测顶层：FRAME "充电订单明细" 1440×1024，7 个子节点
        └── 子节点 …
```

页面名称支持层级分组写法：`矿机智慧监管平台/分类 1/设备管理`（左栏「页面」树按 `/` 分组成树）。

### 2.2 节点类型【实测·mg 创建 API 全量】

`FRAME`、`COMPONENT`、`SECTION`、`LINE`、`ELLIPSE`、`RECTANGLE`、`POLYGON`、`STAR`、`TEXT`、`PEN`、`SLICE`、`CONNECTOR`、`INTELLIGENT_CONTAINER`、`PAGE`

对应 API：`mg.createFrame / createComponent / createSection / createLine / createEllipse / createRectangle / createPolygon / createStar / createText / createPen / createSlice / createConnector / createIntelligentContainer / createPage / createNodeFromSvgAsync`

> 注意 `INTELLIGENT_CONTAINER`（智能容器）是差异点：容器可承载 AI 自动布局/智能填充，复刻时可用「自动布局 Frame + 角色语义」近似。

### 2.3 节点属性全集【实测，来自节点原型链】

按模块归并（复刻时即属性面板的字段来源）：

| 分组 | 属性 |
|---|---|
| 基础 | `id`、`name`、`type`、`parent`、`children`、`removed`、`isVisible`、`isLocked`、`expanded` |
| 几何/变换 | （通过视图与选中态暴露；节点原型含 `constraints`） |
| 圆角 | `cornerRadius`、`topLeftRadius`、`topRightRadius`、`bottomLeftRadius`、`bottomRightRadius` |
| 自动布局 | `flexMode`、`flexWrap`、`itemSpacing`、`itemReverseZIndex`、`paddingTop/Right/Bottom/Left`、`mainAxisAlignItems`、`crossAxisAlignItems`、`mainAxisSizingMode`、`crossAxisSizingMode`、`crossAxisAlignContent`、`crossAxisSpacing`、`layoutPositioning`、`strokesIncludedInLayout` |
| 填充 | `fills`、`fillStyleId` |
| 描边 | `strokes`、`strokeWeight`、`strokeAlign`、`strokeTopWeight/Left/Bottom/Right`、`strokeCap`、`strokeJoin`、`strokeDashes`、`strokeStyleId`、`strokeFillStyleId`、`outlineStroke`、`strokeWidthStyleId` |
| 圆角样式 | `cornerRadiusStyleId` |
| 外观 | `opacity`、`blendMode`、`effects`、`effectStyleId` |
| 蒙版 | `isMask`、`isMaskOutline`、`isMaskVisible`、`clipsContent` |
| 布局网格 | `layoutGrids`、`gridStyleId` |
| 溢出 | `overflowDirection` |
| 原型 | `currentReaction`、`attachedConnectors` |
| 组件 | `componentPropertyReferences`、`slotInfo`、`refStyles` |
| 导出 | `exportSettings` |
| 插件数据 | `getPluginData/setPluginData`、`getSharedPluginData/setSharedPluginData` 及对应 keys/clear |

节点操作：`clone()`、`remove()`、`appendChild()`、`insertChild()`、`findAll/findOne/findChildren/findChild/findAllWithCriteria`。

**复刻建议 schema**（原生 JS，便于 Canvas 渲染）：

```js
// 线性存储 + 索引，避免深层嵌套带来的遍历成本
const doc = {
  id, name, type: 'DOCUMENT',
  pages: [{ id, name, children: [nodeId, ...] }],
};
const nodes = {
  [id]: {
    id, type, name, parentId, childIds: [],
    x, y, w, h, rotation, // 局部坐标 + 自身变换
    visible, locked, expanded,
    fill: [{ type:'SOLID', color:[r,g,b,a], opacity, visible }],
    stroke: { color, weight, align, sides:[t,r,b,l], cap, join, dashes:[] },
    radius: [tl,tr,br,bl],
    auto: null | { mode:'HORIZONTAL', spacing, padding:[t,r,b,l], align:{main,cross}, sizing:{main,cross}, wrap },
    effects: [], mask: {isMask, clip},
    constraints: { h:'LEFT|RIGHT|CENTER|STRETCH|SCALE', v:'TOP|BOTTOM|CENTER|STRETCH|SCALE' },
    proto: { reactions:[{trigger, action, targetId, transition, duration}] },
    component: null | { componentId, props:{}, slot },
    exportSettings: [{ format:'PNG', scale:2 }],
    pluginData: {}, sharedPluginData: {},
  }
};
```

> 要点：**父节点存子 id 数组，子节点存 parentId**，图层树与画布命中测试都基于该线性表 + 空间索引（四叉树/RBush）。

### 2.4 视口模型【实测】

`mg.viewport` 暴露：`center`（视口中心的世界坐标）、`zoom`、`rulerVisible`、`layoutGridVisible`、`bound`、`layout`、`positionOnDom`、`scrollAndZoomIntoView`。

**复刻公式**：`screen = (world - center) * zoom + viewportSize/2`；反变换用于命中测试与拖拽位移换算。

---

## 3. 界面布局 spec（实测视口 1024×613，全部为 CSS px）

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 顶栏 h=48                                                                │
│ [☰ 24] [团队/文件名 …]            [工具组 —— 居中]        [协作者][分享][缩放]│
├────────────┬──────────────────────────────────────────┬──────────────────┤
│ 左栏 288px │                  画布区                   │ 右栏 216px       │
│            │  canvas 620×703                          │                  │
│ 图层|资源  │                                          │ 设计|原型|标注    │
│ 页面树     │                          [浮动图标轨道 56px] │ 属性区           │
│ 图层树     │                                          │                  │
│            │                                          │                  │
├────────────┴──────────────────────────────────────────┴──────────────────┤
│ 底部：缩放条 30% / 网格 / 右下角帮助按钮 / 插件横幅                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1 区域尺寸与类名

| 区域 | 尺寸 | 关键类名 |
|---|---|---|
| 主容器 | 全屏 | `appmain_container` |
| 顶栏 | 48px | `toolbar-container`，分组分隔 `toolbar-container-divid` |
| 左栏 | 288px（含 40px 页签行） | `left-bar__layer`、`left-bar_layers`、`layer-list`、`layer-list__container`、`layer_tree` |
| 图层搜索 | 底部吸底 | `layer_search`、`layer_search--box`、`layer_search--input`、`layer_search--mutilselector` |
| 右栏 | 216px | `panel_container`、`panel-wrap`、`panel_title` |
| 画布 | 剩余区 | 无类名 `<canvas>` |
| 浮动轨道 | 56px 宽，右侧内嵌 | 图标按钮列 |

### 3.2 顶栏工具序列【实测，从左到右】

1. `☰` 主菜单（hover 展开二级）
2. 团队名 / 文件名（可下拉，带 ▾）
3. 分隔
4. **选择/移动**（蓝底高亮 = 当前工具）
5. **画板 Frame**（F）
6. **矩形**
7. **文本**（T）
8. **组件**（菱形图标）
9. **容器/智能容器**
10. **钢笔**
11. **切片**
12. **图片**
13. **AI**（蓝色 A 图标，触发 AI 能力菜单/文件内快搭）
14. **插件**（魔方图标）
15. 分隔
16. 蒙版、裁剪、旋转等编辑动作
17. 链接（原型连线入口）
18. 右侧：协作者头像组、`分享` 主按钮、缩放比例（如 `30%`）、帮助 `?`

> 复刻时可把 4–12 做成「工具组」，13–14 为「AI/插件组」，16–17 为「动作组」，组间用 1px 分隔线。

### 3.3 左栏

**页签行**：`图层` | `资源`（右侧带通知红点）
**资源模式**顶部再分：`组件` / `图片` / `图标` / `文本`，下接库列表：`所有团队库 ▾` / `本地` / `线框图组件` / `Ant Design For AI` / `MasterGo Design For AI`，带搜索框。
**图层模式**：「页面」区（`页面 + 搜索 Q 排序 新建 + 折叠 ⌄`）+ 页面树 + 图层树，底部固定图层搜索框，支持多选过滤。

树节点交互：变色高亮、`▾` 展开、双击重命名、拖拽改父级。

### 3.4 右栏

三个页签：`设计` / `原型` / `标注`（选中态下划线）

- **设计**：圆角 → 自动布局 → 约束（靠左固定/顶端固定）→ 固定行为 → 图层 → 填充 → 描边（内描边/颜色选集/查看全部 N 个颜色）→ 特效 → 导出
- **原型**：交互（`+` 添加）→ 固定行为（随父级滚动 / 固定）
- **标注**：位置 X/Y、尺寸 W/H、混合模式 → 内边距 → 描边（HEX/粗细多值/纯色/百分比）→ 风格 → **代码（Web/…）自动生成 CSS** → 导出
- 无选中时展示页面级属性：`如何设置封面`、`变量管理`、`画布背景色`、`标签`、`导出`

### 3.5 多选与混合值

多选不同属性的对象时，字段显示「存在不同属性值，可点击 + 号替换」，即以「混合态」呈现，编辑后统一覆盖。【实测】

### 3.6 偏好设置

`常规 / 显示效果 / 微调`：方向键步长、Shift+方向键步长、滚轮缩放、右键拖拽平移、Sketch 快捷键适配、移动测距、新建图层位置、撤销是否包含选中、客户端打开链接。【实测，见 15-preferences.png】

---

## 4. 快捷键与命令表【实测】

### 4.1 编辑

| 命令 | 快捷键 |
|---|---|
| 撤销 / 重做 | `Ctrl+Z` / `Shift+Ctrl+Z` |
| 创建副本 | `Ctrl+D` |
| 剪切 / 复制 / 粘贴 | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` |
| 删除 | `Delete` |
| 吸取颜色 | `I` |
| 全选 / 反选 | `Ctrl+A` / `Shift+Ctrl+A` |
| 删除全部参考线 | — |

### 4.2 视图

| 命令 | 快捷键 |
|---|---|
| 像素网格 / 对齐像素 | `Ctrl+'` / `Shift+Ctrl+'` |
| 像素预览 | `Shift+Ctrl+P` |
| 布局网格 | `Shift+G` |
| 评论 | `Shift+C` |
| 多人光标 | `Ctrl+Alt+\` |
| 显示切图 | `Shift+S` |
| 标尺 | `Shift+R` |
| 操作界面 | `Ctrl+\` |
| 放大 / 缩小 | `+` / `-` |
| 缩放 100% | `Ctrl+0` |
| 下一个容器 / 上一个容器 | `N` / `Shift+N` |
| 缩放到全部 / 缩放到选中 | `Shift+1` / `Shift+2` |

### 4.3 其他已知

- 打开团队库弹窗：`Ctrl+Alt+4`
- 最近使用的插件：`Ctrl+Alt+P`
- 导出所有切图：`Shift+Ctrl+E`
- 文件菜单：新建文件、导入文件、导入 HTML 到画布、创建文件副本、添加到/查看历史版本、导出所有切图、导出为 PDF、导出为 Sketch、资源使用详情、颜色配置文件

> `图层 / 文本 / 排列` 三个菜单存在（见 13-main-menu.png），但本次未逐项采集快捷键，复刻时按 Figma 习惯补齐。

---

## 5. 交互状态机（复刻可直接照此实现）

### 5.1 画布指针状态【推断，依据工具序列与行为】

```
idle ──左键按下(命中节点)──► pressing ──移动超过阈值──► dragging(移动)
  │                              │                        │
  │                              └─松开(未移动)──► selected(单选)
  ├─左键按下(空白)──► marquee(框选) ──松开──► selected(多选)
  ├─空格/中键按下──► panning ──松开──► idle
  ├─Ctrl+滚轮 / 滚轮──► zooming(以指针为锚点) ──► idle
  ├─选中后拖控制点──► resizing(8 向 + 旋转) ──► selected
  └─双击文本──► textEditing(进入 DOM 覆盖层输入)
```

要点：
- **变换锚点**：缩放必须保持「指针下的世界坐标不变」。
- **吸附**：拖拽时计算与兄弟/父容器边缘的距离，显示测距标签，按阈值吸附（偏好设置「移动测距」）。
- **命中测试**：命中优先级 = 顶层可见未锁定节点 → 若是组/实例，单击选组、双击进组。
- **文本编辑**：Canvas 内不直接编辑文本，改用绝对定位的 `contenteditable`/`textarea` 覆盖层，退出时回写 `TEXT` 节点。

### 5.2 撤销栈【推断】

`getChangesetStore` 暗示以 **changeset（变更集）** 为单位记录，而非整文档快照：每条命令生成一组节点 diff（新增/删除/属性变更），撤销即逆 diff。复刻建议同名实现，便于与协同同步共用。

### 5.3 面板双向绑定【推断】

- 属性面板 → 文档：面板 `input` 触发命令（如 `setCornerRadius`），命令进 changeset，再广播刷新；
- 文档 → 面板：选中变更或协同远端变更时，面板从**选区聚合值**重算（多选混合值即由此产生）；
- 建议单向数据流：`command → store → subscribe(面板/画布/图层树)`。

---

## 6. 协作闭环【实测 + 推断】

### 6.1 传输层实测事实

编辑器通过 **WebSocket 二进制帧**做实时同步，帧格式：

```
[0..1]  magic    0x1F 0x43 ('C') = 客户端→服务端;  0x1F 0x44 ('D') = 服务端→客户端
[2..5]  长度字段  4 字节大端（示例 0x0000007F）
[6..]   payload   UTF-8 JSON（示例长度 180 字节）
```

握手/视口订阅消息体实测字段：

```json
{
  "documentID": 191172584627801,
  "pageID": "2:51861",
  "fileKey": "2:51861",
  "userID": 45935816779469,
  "topContainerIDList": ["54:17970"]
}
```

另有 4 字节控制帧：客户端 `0x0002`、服务端 `0x0003`（心跳/确认）。

【推断】`topContainerIDList` 是**当前打开页面渲染所需的顶层容器集合**，用于服务端按需推送可见树（视口内优先），而非整文档下发——这是大文件秒开的关键。

### 6.2 复刻协议设计建议

| 层 | 建议 |
|---|---|
| 传输 | WebSocket + 二进制帧（4B magic + 4B len + JSON，或直接 MessagePack/protobuf） |
| 连接 | 握手带 `docId/pageId/userId`；首帧回 `serverTime + seq` 建立基线 |
| 文档加载 | 先用 HTTP 拉「页面 + 顶层容器」快照，再用 WS 增量补齐子树（懒加载） |
| 增量同步 | 基于 changeset（与撤销栈同构）：`{seq, actorId, changes:[{nodeId, path, value}]}` |
| 冲突 | 属性级 LWW + 结构操作走服务端序；或直接采用 **Yjs/Automerge（CRDT）** 降低自研成本 |
| 在线状态 | 独立频道：`presence(selection|viewport|cursor)`，节流 30–60ms |
| 断线重连 | 记录 `lastSeq`，重连后请求 `since=lastSeq` 补差，超阈值则重新拉快照 |

### 6.3 协作产品能力【实测】

- 分享面板三页签：`分享文件 / 访问记录 / 研发交付`
- 权限：可查看（下拉可改：可编辑等）、团队内默认可见、**公开访问开关**（互联网持有链接可查看）、复制链接
- 评论：`Shift+C`、卡片注释、`多人光标`（`Ctrl+Alt+\`）
- 团队席位：`编辑席位` / `创建者` 等；成员页按职业/角色/席位筛选

---

## 7. AI 快搭（mg-pal）闭环

### 7.1 两种形态【实测，见 05-ai-quickbuild.png】

| 形态 | 定位 | 入口 |
|---|---|---|
| 新版 AI 快搭（推荐） | 从 0 到 1 生成**多页面**产品原型；独立项目空间，可持续编辑 | 工作台左侧 / 主页「AI 快搭」 |
| 文件内快搭 | 在现有文件内快速补**单个页面** | 编辑器顶栏 **MasterGo AI** → 文件内快搭 |

页面结构（实测文本）：
1. 顶部：`快搭 | MasterGo` 品牌、`回到旧版`、**`连接不可用`状态徽标**、`积分`
2. 介绍层可跳过：`AI 快搭全新升级 / 从生成一个页面，到搭建完整产品原型`
3. 两栏选择卡：`新版 AI 快搭（推荐）— 一次生成多个页面 / 独立项目 / 适合评审` 与 `文件内快搭 — 当前文件中补单页`（附「打开设计/原型文件 → 顶部 MasterGo AI → 文件内快搭」）
4. 说明：新旧版本**历史记录不互通**，旧文件不被迁移覆盖
5. `最近打开`：会话历史（空态提示）
6. `推荐模板`：分类筛选（全部…）+ 「从模板开始」，模板生成**可编辑页面与代码**

### 7.2 技术形态【实测】

- 宿主页 `/files/mg-pal` 只做壳，实际应用是独立微前端：
  `static.mastergo.com/mg-pal/static/mg-pal.BQDJmfGv.css` + `mg-pal.-Wc2pAx7.umd.js`
- 与编辑器共享的公共包：`mg-ai-fll-page-generation`、`mg-ai-text-generate-image`（说明「整页生成」「文生图」为可复用能力包）

### 7.3 「本地能力」检测机制【实测·关键】

页面加载后会对本机端口做健康探测：

```
GET http://127.0.0.1:18180/mg-pal/health
GET http://127.0.0.1:18181/mg-pal/health
…（18182–18189，共 10 个端口）
```

- 这些端口由**桌面客户端**提供（与已知的 26162 业务服务、26062 字体服务同族）。
- 探测失败即显示 `连接不可用`，并弹出引导：「先检查一次本地能力 → 在客户端菜单点『排查问题』」。
- 【推断】作用：本地承担**生成结果的渲染/预览沙箱、文件写入、隔离进程执行**等浏览器做不了的能力；也是会员/环境可信校验的一环。

### 7.4 云端接口【实测】

| 接口 | 用途推断 |
|---|---|
| `GET /capi/v1/design-templates` | 设计模板列表（快搭模板） |
| `GET /capi/v1/project-templates` | 项目级模板列表 |
| `GET /capi/v1/discovery-content` | 发现/推荐内容 |
| `GET /api/v1/team/ai/available-entity` | 团队可用 AI 额度/实体 |
| `GET /ai/api/account/subscription` | 订阅状态 |
| `POST /ai/api/v4/account/credit-pool` | 积分池/额度扣减 |
| `GET /ai/api/mg/prices` | 计费价格表 |
| `POST /api/v1/toggles`、`/api/v1/experiment/var/user` | 灰度与实验开关 |
| `POST sentry.mastergo.com/...` | 前端错误上报 |

> 生成请求本身未触发（需本地能力在线），但上述接口已足够界定「模板 → 额度校验 → 生成任务 → 结果落库」的边界。

### 7.5 生成管线【推断，按证据拼装】

```
用户输入想法 / 选模板
        │
        ├─(1) 能力预检：探测 127.0.0.1:1818x/mg-pal/health
        │        失败 → 阻断并引导客户端「排查问题」
        │
        ├─(2) 额度/权限：/api/v1/team/ai/available-entity
        │                /ai/api/account/subscription
        │                /ai/api/v4/account/credit-pool
        │
        ├─(3) 模板与上下文：/capi/v1/project-templates、/capi/v1/design-templates
        │
        ├─(4) 生成任务（服务端）：需求理解 → 信息架构/页面清单 → 逐页布局树
        │        输出不是图片，而是**结构化图层树 + 样式 + 代码**
        │        流式返回（推断 SSE 或 WS），前端逐块渲染预览
        │
        ├─(5) 落库：新建独立项目（新版）/ 追加页面（文件内快搭）
        │
        └─(6) 回填画布：调用文档 API 建节点
                 mg.createPage → mg.createFrame → createRectangle/Text/…
                 生成结果在编辑器内**完全可编辑**（非位图）
```

### 7.6 若自研生成器：中间表示（IR）建议

AI 输出与画布之间的契约建议固定为「页面 IR」，便于校验与二次编辑：

```json
{
  "page": { "name": "充电订单明细", "size": [1440, 1024] },
  "root": {
    "type": "FRAME", "name": "页面", "w": 1440, "h": 1024,
    "auto": { "mode": "VERTICAL", "padding": [24,24,24,24], "spacing": 16 },
    "children": [
      { "type": "FRAME", "name": "Header", "auto": {...},
        "children": [
          { "type": "TEXT", "name": "标题", "text": "充电订单明细", "style": { "fontSize": 20, "fontWeight": 600 } },
          { "type": "RECTANGLE", "name": "按钮", "radius": [6,6,6,6], "fill": [{ "type":"SOLID", "color":"#2B6CFF" }] }
        ] }
    ]
  },
  "code": { "framework": "html", "files": ["index.html", "style.css"] }
}
```

生成器侧约束：**只允许白名单节点类型与属性**（对应第 2.3 节），越界即丢弃；文本长度、层级深度、节点总数设上限。

### 7.7 计费与产品化【实测线索】

`积分`（工作台右上常驻）、`credit-pool`、`subscription`、`prices` 说明：生成按额度计费，团队维度有可用实体校验。复刻最小闭环可先做「本地配额 + 任务流水」。

---

## 8. 原型与标注（复刻细节）

- **原型**：节点属性 `currentReaction`（当前交互）+ `attachedConnectors`；右栏「交互 +」添加反应；顶部「链接」工具拖拽连线（`CONNECTOR` 节点类型）；「固定行为」= 容器内滚动时元素 `随父级滚动` 或固定；`视图 → 评论 Shift+C`、`显示切图 Shift+S`。
- **标注**：读选区几何与样式，按目标平台（Web）生成 CSS 片段：`position/left/top/width/height/opacity/box-sizing/border-*`，并支持「颜色选集 / 查看全部 N 个颜色」做设计令牌归一。
- 【推断】标注的 CSS 生成器 = 节点 → CSS 的属性映射表（绝对定位 + border 模拟内描边），可直接照此实现。

---

## 9. 复刻路线图（原生 HTML + Canvas）

### Phase 0 · 骨架（1 个 HTML 文件即可跑）
- 三栏布局（288 / 自适应 / 216）+ 顶栏 48px，CSS 变量定义主题
- 画布：`<canvas>` + `devicePixelRatio` 适配 + `requestAnimationFrame` 渲染循环
- 视口：`zoom/center`，滚轮缩放（指针锚定）、空格平移

### Phase 1 · 图元与选择
- 线性节点表 + 父链子表；节点类型先做 `FRAME / RECTANGLE / TEXT / ELLIPSE`
- 绘制顺序 = 树先序；命中测试 + 框选 + 8 向缩放/旋转控制点
- 图层树 DOM 与画布**双向高亮**；键盘 `Delete/Ctrl+D/Ctrl+Z`

### Phase 2 · 属性与样式
- 右栏「设计」面板：圆角、填充、描边、透明度、约束
- 命令模式 + changeset 撤销栈；多选混合值
- 自动布局：`flexMode + spacing + padding + align + sizing` 的布局求解（一次布局，写回 x/y/w/h）

### Phase 3 · 协作
- 自建 WS 服务：二进制帧头（4B magic + 4B len）与本文一致即可互通调试
- changeset 广播 + `since=seq` 补齐；presence（光标/选区）单独频道并节流
- 评论锚点：以 `{pageId, nodeId, 局部坐标}` 存储，缩放无关

### Phase 4 · AI 闭环
- 页面 IR（7.6）→ 节点树 → 画布（复用 `mg.create*` 同名 API 设计，方便后续接插件体系）
- 生成入口页（快搭）：模板选择 + 输入框 + 任务列表（最近打开）+ 额度显示
- 能力预检：本地 health 探测 +「连接不可用」态与修复引导
- 生成结果**可编辑**是硬指标：不得以图片回填

### Phase 5 · 交付与插件
- 导出：PNG/SVG 切片（离屏 canvas 重绘 + `exportSettings` 倍率）、PDF、Sketch（结构映射）
- 标注页签：CSS 代码生成与复制
- 插件：`mg` 式沙箱 API（`getNodeById/create*/viewport/commitUndo/showUI`）

---

## 10. 复刻要点与坑

1. **性能**：图层数上千时必须做可视裁剪 + 空间索引；避免每帧重建图层树 DOM，只做增量 patch。
2. **坐标系统一**：全链路只保留「世界坐标 + 视口变换」两层，禁止在节点里存屏幕坐标。
3. **文本**：Canvas 文本测量与浏览器排版有差异，编辑态用 DOM 覆盖、展示态用 canvas `fillText` 并缓存测量结果。
4. **撤销与协同同源**：changeset 设计一次，撤销、协同、审计三处复用，否则后期无法收敛。
5. **AI 输出必须结构化**：模板/LLM 只产 IR，禁止直接产出 HTML 塞进画布（否则不可编辑，与实测产品形态不符）。
6. **快搭与编辑器解耦**：AI 应用作为独立微前端，通过文档 API 落地，避免主编辑器包体膨胀。
7. **本地能力**：浏览器无法做的能力（写文件、隔离预览、字体）用本地服务，必须有健康探测与降级提示。
8. **多选混合值**：面板值要做「聚合 + 混合标记」，否则多选编辑会覆盖成同一值造成数据丢失。

---

## 11. 证据补记（可复现）

```bash
# 1) 启动带调试端口的浏览器（复用登录态配置目录）
msedge --remote-debugging-port=9334 --user-data-dir=%TEMP%\mg_edge_gui https://mastergo.com/file/<fileId>

# 2) 读编辑器内部文档模型
node %TEMP%\mg_cdp\cdp.mjs eval <targetId> "JSON.stringify({pages:mg.document.children.length,node:Object.getOwnPropertyNames(Object.getPrototypeOf(mg.document.children[0].children[0]))})"

# 3) 抓协作帧并解码帧头
node %TEMP%\mg_cdp\frames.mjs

# 4) 抓 AI 快搭接口
node %TEMP%\mg_cdp\api.mjs
```

> 说明：`mg` 为编辑器暴露的文档/插件 API；`mg.document` 可直接遍历 `DOCUMENT → PAGE → NODE` 并读取节点类型、尺寸与属性，因此上述结论均为运行时真实读取，而非猜测。
