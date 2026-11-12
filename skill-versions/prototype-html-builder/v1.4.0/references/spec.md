# 规格 DSL（build-prototype.mjs 的唯一输入格式）

产物中的文档 JSON 结构是：

```txt
{ version:1, name?, theme:'light'|'dark', pages:[Page], tree:[TreeNode] }
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
