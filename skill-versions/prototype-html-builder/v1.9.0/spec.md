# 规格 DSL（build-prototype.mjs 的唯一输入格式）

产物中的文档 JSON 结构是：

```txt
{ version:1, name?, theme:'light'|'dark', direction?, pageSpec?, pages:[Page], tree:[TreeNode] }
Page    = { name, bg?, comp?, kit?, artboards:[Artboard], loose?, guides?, comments? }
Artboard= { type:'artboard', id, name, x, y, w, h, bg, children:[Node], proto? }
```

规格（spec）是它的**声明式子集**，只写人类关心的字段，id / parent / 实例快照由 builder 生成。

---

## 1. 顶层

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `name` | string | — | 文档名（顶栏面包屑、默认输出文件名） |
| `theme` | `light`/`dark` | `light` | 编辑器主题，同时决定默认文字色（`palette.text1`） |
| `kit` | boolean | `true` | 是否输出组件库页（27 个内置母版）；`false` 时不带 |
| `components` | Component[] | `[]` | 自定义组件母版（见 §6） |
| `pages` | Page[] | 必填 | 至少 1 个 |
| `tree` | TreeNode[] | 按页面顺序 | 左侧页面树的层级 |
| `direction` | Direction | — | 风格方向五要素（v1.5，可选）。见下 |
| `platform` | `pc` / `app` | `pc` | **v1.8 首版必填（建议显式）**：决定页面规范基线。PC→Element Plus（ElementUI），APP→Android Material 3 |
| `pageSpec` | object | 自动生成 | 可选覆盖，显式写 `__doc.pageSpec` 的字段（version/standard/viewport/grid/controls/token/note/locked）；不写则按 `platform` 自动补全 |
| `grouping` | object | 自动生成 | **v1.9**：可选覆盖 `__doc.pageSpec.grouping`（sections/minGroupRatio/maxTopLevelLoose/maxDepth/maxChildrenPerGroup）；首版语义编组规划，见下 |
| `pages[].platform` | `pc` / `app` | 顶层 `platform` | 单页端型覆盖；同一文档混排 PC + APP 页面时逐页声明 |

### 首版页面规范（v1.8，首版锁定）

**首次生成界面必须先定义规范再动手**：在 spec 顶层写 `platform`，build 会把规范固化进 `__doc.pageSpec`（`locked:true`），并同步进 `aiHint` / `#__ai_view` 的 pageSpec 段。第一版输出后，后续改稿、实现、追加页面都沿用同一端型与规范；`apply-doc.mjs` 拒绝在锁定状态下静默换端型。

```json
{
  "name": "设备管理平台",
  "platform": "pc",
  "pages": [{ "name": "设备监控", "artboards": [ ... ] }]
}
```

| 端型 | 规范主基线 | 参考视口 | 栅格 | 控件 |
| --- | --- | --- | --- | --- |
| `pc` | **Element Plus（ElementUI）页面规范** | 1440×900 | 24px 页边距 / gutter 16 / 8px 纵向节奏 / 卡内边距 16 | 常规控件高 32 / 主按钮 40 / 正文 14 / 圆角 6 |
| `app` | **Android（Material 3）页面规范** | 360×800dp | 16dp 页边距 / 8dp 栅格 / 4dp 基数 | 状态栏 24dp / 顶部应用栏 56dp / 底部导航 56dp / 触控目标≥48dp / 正文 14sp |

混合端型：逐页写 `pages[].platform`，`pageSpec.pages` 会逐页记录；实现时按页选用对应组件库（PC→Element Plus，APP→Material 组件）。用户给了视觉参考图时以参考图为准，但端型与锁定状态不变。细则见 `design-system.md §9`。

### Direction（风格方向）

从「产品做什么、给谁用」推导，不从流行趋势推导；适用边界见 `design-system.md §6`（**用户给了视觉参考图时以参考图为准**）。

```json
{
  "product": "选矿设备管理系统，给选矿厂设备员与调度用",
  "character": ["克制", "精确", "偏工业"],
  "world": "矿山与重型机械",
  "moments": ["设备台账主表", "实时监控曲线"],
  "signature": "设备状态呼吸灯"
}
```

| 键 | 类型 | 说明 |
| --- | --- | --- |
| `product` | string | 产品一句话：做什么、给谁用 |
| `character` | string 或 string[] | 2–3 个具体气质词；禁「简洁/现代/高级」类万金油 |
| `world` | string | 产品所属的物质世界，决定中性色倾向与 accent |
| `moments` | string 或 string[] | 1–2 个允许色彩与细节丰富的焦点区 |
| `signature` | string | 仅此产品会有的签名细节，全屏复用且只出现在该在的地方 |

编译后 `direction` 原样存入 `__doc` 顶层、摘要追加进 `aiHint`、`#__ai_view` 头部输出「风格方向」段；`apply-doc.mjs` 合入时 AI 未带 `direction` 沿用原值，显式 `direction:null` 才删除。全部键可选，可只填其中几项。

### TreeNode

```json
{ "label": "设备总览", "page": 0, "open": true, "children": [ ... ] }
```

`page` 可为页面索引或页面名；`open` 仅影响默认展开。

---

## 2. Page / Artboard

```json
{
  "name": "设备总览",
  "bg": "#F5F7FA",
  "guides": [{ "axis": "x", "pos": 16 }, { "axis": "y", "pos": 44 }],
  "comments": [{ "x": 120, "y": 300, "text": "这里改成下拉", "replies": [] }],
  "artboards": [
    { "name": "设备列表", "x": 0, "y": 0, "w": 375, "h": 812, "bg": "#F5F7FA", "nodes": [ ... ] }
  ]
}
```

- 画板坐标 `x/y` 是**画布世界坐标**（多画板并排时用 0 / 480 / 960… 间距）。
- 节点坐标 `x/y` 是**画板局部坐标**（原点 = 画板左上角）。
- 手机推荐 `375×812`，桌面 `1440×900`，大屏 `1440×1024`。
- 省略 `artboards` 时，`nodes` 会被放进一个默认画板（桌面 1440×900）。


### 首版编组规划（v1.9，首版锁定）

AI 第一次生成界面时**必须先规划编组并把元素编组完成**：画板顶层只放「语义区块」`group`，
业务元素归入所属区块，不允许几十个叶子平铺在画板里。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `artboards[].sections` | string[] | **推荐**：区块命名顺序。配合每个节点的 `section` 标签归组，未标标签的节点进「其他区块」并输出提示 |
| `artboards[].sections` | `{name, children}[]` | 完整形式：每组自带子节点树；`nodes` 里带 `section` 的额外节点会按标签补入 |
| `nodes[].section` | string | 语义分区标签，如 `"顶栏"` / `"卡片区"`；不写 `sections` 时也可单独用它自动编组 |
| `artboards[].grouping` | `false` | 仅特殊稿显式关闭自动编组（不建议） |

两种写法（推荐第一种，扁平节点 + 一行标签，AI 最不容易写错）：

```json
{
  "sections": ["顶栏", "筛选区", "内容卡片区", "底部导航"],
  "nodes": [
    { "type": "instance", "comp": "navbar", "section": "顶栏", "x": 0, "y": 0 },
    { "type": "rect", "name": "筛选条", "section": "筛选区", "x": 24, "y": 80, "w": 1392, "h": 40 },
    { "type": "text", "name": "卡片标题", "section": "内容卡片区", "x": 40, "y": 148, "text": "设备状态" }
  ]
}
```

```json
{
  "sections": [
    { "name": "顶栏", "children": [ { "type": "instance", "comp": "navbar", "x": 0, "y": 0 } ] },
    { "name": "内容卡片区", "children": [ { "type": "text", "text": "设备状态", "x": 40, "y": 148 } ] }
  ]
}
```

- **组内子节点坐标仍是画板局部坐标**，不需要换算；`group` 的 `x/y/w/h` 由 `buildContainer` 用子节点包围盒自动计算。
- 已经是 `group` / `bool` / `instance` 的顶层节点本身就是区块，不再包一层空壳。
- 顶层节点数 ≤ `maxTopLevelLoose`（PC 3 / APP 2）时视为极简页，不强制编组。
- 完全未声明 `sections` / `section` 时按几何行带（y 中心间距 >72px 切带）自动编组为「区块 N」，并输出提示要求首版显式命名。
- 基线区块与门禁阈值写入 `__doc.pageSpec.grouping`（`locked:true`）：
  PC = 顶栏 / 侧栏导航 / 页面标题区 / 筛选·工具区 / 内容区 / 卡片区 / 表格·列表区 / 图表区 / 底栏·分页 / 弹层·浮层；
  APP = 状态栏 / 顶部应用栏 / 内容区 / 卡片区 / 列表区 / 底部导航 / 弹层·浮层。
- 门禁：`node scripts/check-grouping.mjs <产物> --strict` 必须 PASS（覆盖率 ≥80% / 顶层散落叶子 ≤3 / 嵌套 ≤3 层 / 每组直接子元素 ≤12）。
- **锁定语义**：后续改稿、实现、追加页面沿用同一套区块命名与层级，不得把编组拆散回平铺；`apply-doc.mjs` 在 AI 漏写 `grouping` 时沿用首版规划。

---

## 3. 节点通用字段

| 字段 | 说明 |
| --- | --- |
| `type` | `rect` / `ellipse` / `text` / `icon` / `line` / `arrow` / `polygon` / `star` / `image` / `group` / `bool` / `instance` |
| `name` | 语义名（图层名、实例覆盖键、`ProtoAPI.findNode` 引用） |
| `x`,`y`,`w`,`h` | 画板局部坐标与尺寸（text 在无 `align` 时自动测量） |
| `opacity` | 0–1，默认 1 |
| `rot` | 旋转角度（度） |
| `flipX`,`flipY` | 水平/垂直翻转 |
| `hidden`,`locked` | 隐藏 / 锁定 |
| `grad` | 渐变填充（v1.6）：`{"type":"linear","angle":90,"stops":["#3670F7","#5B8CFF"]}`，stops 兼容 `[{color,pos,opacity}]`；编译为编辑器 `fills` 数组，`fill` 保留主色兜底。**只允许同色系明度/透明度渐变**，色相跨越会被 check-slop 拦截；配方见 design-system.md §7 |
| `shadow` | 投影（v1.6）：`{"x":0,"y":2,"blur":8,"color":"#101828","opacity":0.06}`，编译为编辑器 `effects`。只用于卡片层级（opacity 上限 0.4），**禁用于文字**（发光） |
| `proto` / `click` / `hover` / `press` / `drag` / `scroll` | 交互（见 §5） |

颜色支持 `#RGB` / `#RRGGBB` / `#RRGGBBAA` / `rgba()`。

### 3.1 rect

```json
{ "type":"rect", "x":16,"y":300,"w":343,"h":44,"fill":"#3670F7","radius":8,
  "stroke":"#E5E6EB","strokeW":1,"rc":[8,8,8,8] }
```

`rc` 为四角独立圆角（左上、右上、右下、左下），优先级高于 `radius`。`fill:null` 表示无填充。

### 3.2 ellipse / polygon / star

```json
{ "type":"ellipse","w":40,"h":40,"fill":"#3670F7" }
{ "type":"polygon","w":24,"h":24,"sides":3,"fill":"#FF7D00" }
{ "type":"star","w":24,"h":24,"points":5,"fill":"#FFC53D" }
```

### 3.3 text

```json
{ "type":"text","x":16,"y":160,"text":"设备总数","fontSize":14,"fontWeight":600,
  "color":"#1F2329","lineHeight":1.4,"letterSpacing":0 }
```

- 不给 `align` → 宽度自动（按字数估算，运行时以 Canvas 精测覆盖）。
- 给 `align`（`left|center|right`）→ 固定框，需同时给 `w`；`valign`（`top|middle|bottom`）需给 `h`。
- 多行用 `\n`。

### 3.4 icon（SVG，**本 skill 强制使用**）

```json
{ "type":"icon","name":"搜索","icon":"ep/search","size":24,"color":"#1F2329" }
{ "type":"icon","name":"首页","icon":"ant/home","w":22,"h":22,"color":"#3670F7" }
```

- `size` 为快捷写法，等价 `w=h=size`；也可分别指定 `w`/`h`（等比居中）。
- `icon` 命名：`{set}/{name}`，`set ∈ {ep, ant}`。全清单见 `icons.md`。
- 自定义矢量（不依赖内置图标）：

```json
{ "type":"icon","name":"自定义","paths":["M12 2l3.1 6.3 ..."],"ibv":24,"size":24 }
```

`paths` 内是 SVG `<path d>` 字符串数组，`ibv` 是原始 viewBox 边长（默认 24）。

### 3.5 line / arrow

```json
{ "type":"arrow","x":16,"y":200,"w":200,"h":2,"stroke":"#86909C","strokeW":1.5,"dir":"\\" }
```

`dir`：`\\` = 左上→右下，`/` = 左下→右上。

### 3.6 image

```json
{ "type":"image","x":16,"y":100,"w":343,"h":160,"src":"data:image/png;base64,..." }
```

`src` 可为 data URI 或 http URL；为空时渲染灰底占位。

### 3.7 group / bool

```json
{ "type":"group","name":"设备行","children":[ ...nodes... ] }
{ "type":"bool","name":"圆角裁切","op":"mask","children":[ 内容, 遮罩形状 ] }
```

- **子节点坐标仍为画板坐标**（与编辑器一致），组没有自己的坐标系。
- 组的 `x/y/w/h` 由子节点包围盒自动计算，写值会被忽略。
- `op`：`union` / `subtract` / `intersect` / `exclude` / `mask`（mask 用最后一个子节点作遮罩）。

### 3.8 instance（组件实例）

见 §6。

---

## 4. 交互（proto）

单个交互对象：

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `trigger` | `单击`/`悬停`/`按下`/`拖拽`/滚动 | 省略时取决于便捷键 |
| `action` | `打开画板`/`打开弹层`/`关闭弹层`/`返回上一页`/`切换变体` | 必填 |
| `target` | 画板 `name` 或 id | 打开画板/弹层时必填 |
| `variant` | 母版 id 或名称 | 切换变体时必填 |
| `dir` | `任意`/`向左`/`向右`/`向上`/`向下` | 拖拽/滚动方向 |
| `opos` | `居中`/`左上`/`右上`/`底部` | 弹层位置 |
| `ox`,`oy` | number | 弹层偏移 |
| `dim` | 0–100 | 遮罩不透明度 |
| `bdclose` | boolean | 点遮罩关闭，默认 true |
| `anim` | `无`/`淡入`/`左滑`/`右滑`/`上滑`/`下滑` | 转场动画 |
| `easing`,`duration` | string / ms | 默认 `ease-out` / 300 |

两种写法等价：

```json
{ "type":"rect", "name":"按钮",
  "proto":[{"trigger":"单击","action":"打开画板","target":"设备详情","anim":"左滑"}] }

{ "type":"rect", "name":"按钮",
  "click":{"action":"打开画板","target":"设备详情","anim":"左滑"} }

{ "type":"rect", "name":"把手",
  "drag":{"action":"打开弹层","target":"设备详情","dir":"向上","opos":"底部"} }
```

`target` 可写画板名（推荐）或 id，builder 在编译末尾统一解析成 id；找不到会直接报错。
交互也可写在画板对象上（画板级手势）。

---

## 5. 组件：母版 + 实例

### 5.1 使用内置母版

```json
{ "type":"instance","comp":"navbar","x":0,"y":44,
  "overrides":{ "标题":{"text":"设备管理"} } }
```

`comp` 取母版 id 或母版名。内置 27 个见 `design-system.md`。
实例的 `x/y` 是画板局部坐标（组件左上角）。

### 5.2 覆盖（overrides）

键 = 母版内节点 `name`；值 = 该节点的可覆盖属性：

`fill` `stroke` `strokeW` `opacity` `radius` `text` `fontSize` `fontWeight` `color` `align` `letterSpacing` `hidden` `icon` `paths` `ibv`

```json
{ "type":"instance","comp":"device-row","x":16,"y":310,
  "overrides":{
    "名称":{"text":"1# 球磨机 MQG-2130"},
    "状态":{"text":"告警 · 温度偏高","color":"#F53F3F"},
    "图标":{"icon":"ep/warning"}
  } }
```

- 文本覆盖：母版文本为自动宽度时会重算 `w/h`；固定框（`align` 非空）保持母版宽度。
- 覆盖不复制节点：只写 `ov`，改母版后所有实例同步，只有被覆盖的属性保持差异。

### 5.3 自定义组件

```json
"components":[{
  "id":"device-row","name":"设备行","w":343,"h":64,
  "nodes":[
    {"type":"rect","name":"底","x":0,"y":0,"w":343,"h":64,"fill":"#FFFFFF","radius":8},
    {"type":"icon","name":"图标","icon":"ep/cpu","size":20,"x":22,"y":22,"color":"#3670F7"},
    {"type":"text","name":"名称","x":64,"y":13,"text":"设备名称","fontSize":14,"fontWeight":600},
    {"type":"text","name":"状态","x":64,"y":35,"text":"运行中 · 负载 72%","fontSize":12,"color":"#86909C"}
  ]
]
```

- 母版节点坐标以母版左上角为原点。
- `components` 与 `kit:true` 并存：内置 27 个在前，自定义追加在后。
- 母版会被放到"组件库"页的网格上（`comp:true, kit:true`），运行时不再注入内置母版。

---

## 6. 完整示例

见 `examples/demo-spec.json`（设备管理：两个手机画板、1 个自定义组件、17 个实例、7 条交互）。
编译命令：

```bash
node scripts/build-prototype.mjs examples/demo-spec.json -o examples/demo.chao.html
```

---

## 7. 内置文档字段（产物中可读到）

| 字段 | 位置 | 说明 |
| --- | --- | --- |
| `comp` | Page | 组件库页标记（演示模式跳过此页） |
| `kit` | Page | 外部组件库标记，阻止编辑器自举内置母版 |
| `master` | Artboard | 该画板是组件母版，值为母版 id |
| `cont`/`inst`/`iid` | 实例容器 | `cont:1` + 母版 id + 实例唯一 id |
| `mc`/`kp` | 实例子层 | 对应母版节点 id / 兄弟索引 |
| `base`/`ov` | 实例容器 | 母版属性快照 / 实例级覆盖（`{母版节点id: {props}}`） |
| `setId`/`variant` | Artboard | 变体组与变体名 |
| `loose` | Page | 画板外的自由图层 |
| `guides`/`comments` | Page | 参考线与评论 |
| `direction` | 文档顶层 | 风格方向五要素（v1.5；原样保留，摘要进 `aiHint`） |
| `aiHint` | 文档顶层 | AI 必读提示（生成时自动写入，勿手改） |
| `notes` | Page/Artboard/Node | 页面逻辑与说明（v1.4；schema 见 GUIDE） |
