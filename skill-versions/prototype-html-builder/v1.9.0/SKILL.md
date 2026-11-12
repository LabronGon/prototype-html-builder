---
name: prototype-html-builder
description: 生成 .chao.html 单文件高保真原型（内置自研画布编辑器，纯 Canvas 渲染，零外部依赖）。当用户要求"画原型 / 做高保真原型 / 生成 .chao.html / 移动端或大屏界面原型 / 带交互跳转的原型"时使用。图标一律使用 Element Plus / Ant Design 官方 SVG 路径（矢量、可重着色），组件通过母版 + 实例复用，输出文件可直接在浏览器打开编辑与演示。
---

# Prototype HTML Builder

> **版本 v1.9.0**（2026-11-12）｜版本历史见项目内 `skill-versions/prototype-html-builder/CHANGELOG.md`
> v1.9.0「首版语义编组规划 + 框选语义修正」（2026-11-12）：① AI 第一次生成界面**必须先规划编组、把元素编进语义区块 group**，而不是全部散落在画板内；`__doc.pageSpec.grouping` 首版锁定（PC 十类 / APP 七类基线区块），`check-grouping.mjs --strict` 为交付门禁，GUIDE/NOTICE/meta/aiHint/`#__ai_view` 五处规范入口同步；② 框选改为「只选框内的元素」——节点须被完整框住才选中，容器只框到一部分就下钻选子元素，不再把跨出框外的大卡片 / 大组整块选走；整板选中只在框选矩形覆盖画板 ≥92% 时触发（移动整板能力保留）。
> v1.8.0「首版页面规范锁定 + 编辑器交互三修」：① 框选整块画板的内容时直接选中画板（拖动移动整板，不再搬空内容）；② 组件实例容器按原子对象选中、压在画板上的自由图层/热区随板移动；③ Ctrl+V 支持系统剪贴板截图/图片/文本（file:// 可用，三级兜底）；④ 首次生成界面必须先声明 `platform` 并把规范写进 `__doc.pageSpec`——**PC 端以 Element Plus（ElementUI）页面规范为主，APP 端以 Android（Material 3）页面规范为主，首版输出即锁定，后续改稿/实现/追加页面沿用**。
> v1.7.1「对齐门禁补全」：`check-layout.mjs` 新增 E 列底对齐（各列内容最大底 y 差 >8 即报，嵌套子卡不参与）与 F 内容溢出（节点超出所属卡右/下缘 >2px 即报，贴边相等不报）两条规则——全面体检中发现的「三画板列底差 38–148px」「按钮溢出卡底」类问题从此可静态拦截。
> v1.7.0「布局栅格与对齐门禁」：新增 `check-layout.mjs`（近失对齐 ≤4px 漂移 / 同行不等高 / 序列间距不一致 / 系列宽度不齐 四类规则，卡片分桶降噪 + 隔断检测，`--strict` 门禁模式）；`design-system.md §8` 桌面栅格规范（24px 页边距 / 统一 gutter / 8px 纵向节奏 / 卡内边距 16 / 数值右对齐）。**硬性约束：交付前 check-layout --strict 必须 PASS**——4px 的对齐漂移比明显错位更致命。
> v1.6.0「视觉丰富度（反简陋）」：规格 DSL 新增节点级 `grad`（渐变 `{type,angle,stops}`，编译为编辑器 fills 数组）与 `shadow`（投影 `{x,y,blur,color,opacity}`，编译为 effects）两个字段——页面从纯色平面升级为层次界面；`check-slop.mjs` 升 v1.6（JSON fills 渐变同样过色相门禁）；GUIDE v1.5「默认风格基线」追加第 ⑨ 条反简陋三件套（浅灰页底 / 白卡描边+投影 / tinted 图标圆底 / 标题竖条 / 斑马纹 / 语义竖条）；`design-system.md` 新增 §7 场景化配方速查。原则：**颜色数量克制，层次与细节丰富**。
> v1.5.1「说明随 build 一次写全」：修复 build 链路静默丢弃 `notes` 的缺口——规格 DSL 的 `page/artboard/node` `notes` 现在深拷贝透传进 `__doc`（此前只有 apply-doc 后补路径支持，spec.md 承诺与实现不符）；画板缺说明时 build 输出「提示」清单；硬性约束新增第 5 条（页面/画板说明必须写全，示例 demo-spec.json 已带 notes 示范）。
> v1.5.0「风格方向与反模板」（方法论改编自 unslop @heydamir，CC BY 4.0）：规格 DSL 新增 `direction` 顶层键（product / character / world / moments / signature 五要素），编译后原样存入 `__doc`、摘要追加进 `aiHint`、`#__ai_view` 头部输出「风格方向」段；`apply-doc.mjs` 对 `direction` 保护性合并（未带沿用原值，显式 `null` 才删）；`validate-doc.mjs` 结构校验；GUIDE v1.4 新增「默认风格基线」八条（表面克制 / 一屏一 accent / 禁 slop / 圆角嵌套 / 4px 网格 / 数字纪律 / 图表一主多辅 / 模板自检），**适用边界：用户给了视觉参考图时以参考图为准**；细则见 `references/design-system.md §6`。
> v1.4.0「页面逻辑与说明」：`page/artboard/node` 可挂半结构化 `notes`（摘要 / Markdown 正文 / 条件-动作规则表 / 标签 / 来源），编辑器第 4 个 tab 人工编辑、演示模式「逻辑」抽屉查看、`#__ai_view` 文末 LOGIC 附录供 AI 一次读全；`ProtoAPI.getNotes/setNotes/listNotes/exportLogic` 精确读写，`apply-doc.mjs` 保护性合并防止 AI 改稿抹掉人工说明。
> v1.3.0 产物后缀 `.prototype.html` 全量切换为 `.chao.html`（默认输出名 / 编辑器保存名 / 打开·保存 accept / 内部资源路径 / 触发词 / 文档），不保留旧后缀兼容；文件选择器 accept 改用合法扩展名 `.html`，由 `suggestedName` 保留新后缀，规避浏览器拒绝双点扩展名。
> v1.2.2 ① AI 指引改为「布局/视觉参考 + 开发规范优先」（GUIDE v1.2）：原型只提供空间布局与 UI 元素整体效果，实现须用 Vue3/React 标准组件与项目设计系统，禁止逐节点绝对定位硬编码；② 新增头部 AI-NOTICE + `meta[name=prototype-ai]` 与 `__doc.aiHint` 三层规范入口，解决 Agent 读文件头/只抽 JSON 时漏规范；③ `#__ai_view` 生成器修复：svg 图标 `icon=`/`color=`、`hidden` 标记、text/name/src 用 JSON 字符串字面量（多行/引号无损）、数值保留原始精度、arrow/bool 补齐。
> v1.2.1 AI 协作三件套：产物内嵌 `PROTOTYPE-AI-GUIDE` 头部说明注释 + `#__ai_view` 逐行设计清单（保存/生成时自动再生），AI 只读一个 HTML 即可完成改稿/实现界面/需求文档；编辑器「打开」支持 .json 直接载入 AI 输出的文档；`ProtoAPI.exportAI()` 一次导出清单+文档。
> v1.2.0 编辑器壳升级：钢笔工具与矢量锚点编辑（拖锚点/控制柄、尖角·圆角·非对称平滑·半边圆角四种锚点类型）、钢笔顶点吸附与闭合吸附、锚点对齐参考线、形状转路径（矩形/圆/直线/多边形/星形双击即转）、线段悬停"+"加锚点、锚点右键菜单、路径拖动 bug 修复（形状与包围盒同步移动）、路径操作按钮上移顶部工具栏。
> v1.1.0 编辑器壳升级：SVG 图标兼容渲染（老文档 `type:"svg"` 图标不再丢失）、折行文本编辑防裁剪、双击左右控制点切自适应宽度、编组包围盒实时同步、下钻面包屑、深色模式补漏、画板标签明暗自适应。

把一段声明式 JSON 规格编译成 `.chao.html`：**一个文件 = 编辑器 + 内嵌文档**。用浏览器打开即可编辑、缩放、演示交互，文件本身不依赖任何外部资源（图标已内嵌为矢量路径）。

## 硬性约束（9 条）

1. **图标必须是 SVG**：只能写 `{"type":"icon","icon":"ep/search"}`（或 `ant/home`）。渲染走 Canvas `Path2D`，矢量、可重新着色；禁止用文本符号（`‹ › ⋯ ▾ ✓`）或矩形拼图标。
2. **组件必须复用**：重复出现的 UI（导航栏、标签栏、卡片、列表行…）用 `{"type":"instance","comp":"navbar"}` 引用母版，只通过 `overrides` 改文案/颜色/图标。不要复制粘贴同一棵节点树。
3. **遵循 Element Plus / Ant Design 规范**：颜色、字号、间距、圆角、控件高度取自 `assets/design-kit.json`（见 `references/design-system.md`）。
4. **先定方向再动手**（v1.5）：规格带 `direction`（五要素）时按它生成；缺失时按 `design-system.md §6`「默认风格基线」执行——表面克制、一屏一 accent、禁 slop（渐变文字 / 彩色发光 / emoji 图标 / 循环动画）；**用户给了视觉参考图时以参考图为准**。
5. **说明随稿交付**（v1.5.1）：规格里**每个页面、每个画板**必须写全 `notes`（kind/summary/正文四章/规则表/tags），关键交互节点（弹层、向导、安全类控件）至少挂一条 `kind:"component"` 说明；build 会透传 spec 的 notes 并对缺失画板输出提示。不允许「先出稿、后补说明」当默认流程。
6. **反简陋三件套**（v1.6）：每个画板逐项自检——① 页面底 `#F5F7FA` 级浅灰 + 白卡分层；② 白卡带描边 `#E5E6EB 1px` + 投影 `shadow:{y:2,blur:8,opacity:0.06}`；③ 裸文字图形化（图标 tinted 圆底 / 标题品牌竖条 / 迷你趋势柱 / 斑马纹 / 语义色竖条）。渐变只做同色明度（`grad` 字段），禁文字发光。配方速查见 `design-system.md §7`。
7. **对齐过门禁**（v1.7）：坐标遵循 `design-system.md §8` 栅格（24px 页边距 / 统一 gutter / 8px 纵向节奏 / 卡内边距 16 / 同列同 x / 数值右对齐）；交付前 `node scripts/check-layout.mjs <产物> --strict` 必须 PASS——**≤4px 的近失对齐视同失误**，禁止「差不多对齐」交付。
8. **首版页面规范锁定**（v1.8）：写规格前先定端型——`platform:"pc"` → Element Plus（ElementUI）页面规范（1440×900 / 24px 页边距 / gutter 16 / 8px 纵向节奏 / 控件高 32 / 字号 14 / 圆角 6 / `design-kit.json` 色板）；`platform:"app"` → Android（Material 3）页面规范（360×800dp / 16dp 页边距 / 8dp 栅格 / 状态栏 24dp / 顶部应用栏 56dp / 底部导航 56dp / 触控目标≥48dp / 正文 14sp）。build 写入 `__doc.pageSpec`（`locked:true`）并输出进 `#__ai_view`；**第一版输出即锁定，后续改稿、实现、追加页面必须沿用同一端型与规范**，`apply-doc.mjs` 会拒绝静默切换端型。用户给了视觉参考图时以参考图为准（覆盖基线，不改端型）；细则见 `design-system.md §9`。
9. **首版语义编组规划**（v1.9）：AI 生成第一版界面时**必须先规划页面编组并把元素编组完成**——画板顶层只放「语义区块」`group`，业务元素一律归入所属区块，禁止把几十个叶子平铺在画板里。PC 基线区块：顶栏 / 侧栏导航 / 页面标题区 / 筛选·工具区 / 内容区 / 卡片区 / 表格·列表区 / 图表区 / 底栏·分页 / 弹层·浮层；APP 基线区块：状态栏 / 顶部应用栏 / 内容区 / 卡片区 / 列表区 / 底部导航 / 弹层·浮层。规格用画板级 `sections`（`[{name,children}]` 或 `["顶栏","内容区"]` + 每节点 `section` 标签）显式声明；未声明时 `build-prototype.mjs` 按几何行带自动编组并给出提示，但会产出「区块 N」这类无语义命名，`check-grouping.mjs --strict` 会直接 FAIL，逼首版显式规划。编组覆盖率 ≥80%、顶层散落叶子 ≤3、嵌套 ≤3 层、每组直接子元素 ≤12，交付前 `node scripts/check-grouping.mjs <产物> --strict` 必须 PASS。规划写入 `__doc.pageSpec.grouping`（`locked:true`）并输出进 `#__ai_view` 的「首版编组规划」段；**后续改稿、实现、追加页面沿用同一套区块命名与层级，不得拆散回平铺**，`apply-doc.mjs` 在 AI 漏写时沿用首版规划。用户给了视觉参考图时以参考图的区块划分为准（覆盖基线命名，不改端型）。细则见 `design-system.md §10`、`spec.md §2`。

## 工作流

> 命令在 skill 根目录（本 SKILL.md 所在目录）执行；也可用脚本的绝对路径从任意目录调用。

```bash
# 1) 写规格：先声明 platform（pc=ElementUI / app=Android 规范）并规划 sections 语义编组，再参考 references/spec.md 与 examples/demo-spec.json
# 2) 编译
node scripts/build-prototype.mjs spec.json -o out.chao.html
# 3) 校验（图标存在性 / id 唯一 / 交互目标 / 实例完整性）
node scripts/validate-doc.mjs out.chao.html
# 4) 编组门禁（首版必须 PASS：画板顶层只放语义区块 group）
node scripts/check-grouping.mjs out.chao.html --strict
```

规格里 `name` 决定默认输出文件名。`--check` 只编译不落盘。

## 最少可用规格

```json
{
  "name": "示例应用",
  "platform": "pc",
  "pages": [{
    "name": "首页",
    "artboards": [{
      "name": "首页", "w": 375, "h": 812, "bg": "#F5F7FA",
      "sections": ["顶栏", "内容区"],
      "nodes": [
        { "type": "instance", "comp": "navbar", "section": "顶栏", "x": 0, "y": 44,
          "overrides": { "标题": { "text": "我的应用" } } },
        { "type": "icon", "name": "搜索", "icon": "ep/search", "section": "内容区", "size": 24, "x": 16, "y": 120 },
        { "type": "text", "text": "你好，世界", "section": "内容区", "x": 16, "y": 160, "fontSize": 20, "fontWeight": 600 }
      ]
    }]
  }]
}
```

`sections` 即首版编组规划：build 会把画板顶层编译成「顶栏 / 内容区」两个语义区块 `group`，节点坐标原样保留、包围盒自动计算。**不要省略 `sections` / `section`**，否则编译器虽会按几何行带兜底编组，但区块命名失去语义，且 `check-grouping.mjs --strict` 会要求整改。

## 内置资源

| 资源 | 说明 |
| --- | --- |
| `assets/template.chao.html` | 编辑器壳（v1.9.0 壳），含 218 个 SVG 图标 + 27 个组件母版 + 四层 AI 协作块 |
| `assets/icons.json` | 图标源数据（`ep` 125 个 / `ant-design` 93 个，1024 网格，MIT） |
| `assets/design-kit.json` | 设计 Token + 内置组件母版（供 builder 重建组件库页） |
| `examples/demo-spec.json` | 可运行的完整示例（设备管理：2 画板 + 自定义组件 + 交互 + 页面/画板 notes 说明示范） |

## AI 协作工作流（v1.9 更新）

产物内嵌四层 AI 专用内容，**输入/输出始终是同一个 HTML 文件**：

| 块 | 位置 | 用途 |
| --- | --- | --- |
| `PROTOTYPE-AI-GUIDE v1.7` | `__doc` 前的 HTML 注释 | 给 AI 的读法、**实现约定（最高优先）**、风格方向与默认基线（九条含反简陋）、首版页面规范与语义编组规划、坐标系、字段字典、交互 schema、修改约定 |
| `AI-NOTICE` + `meta[name=prototype-ai]` | `<head>` 最前 | Agent 读文件头必经的规范入口（三层钩子的第一层） |
| `__doc.aiHint` | 设计 JSON 顶层键 | 只抽 `#__doc` 的程序/Agent 也能看到规范入口 |
| `#__ai_view` | `<script type="text/plain">` | 逐行布局清单（每节点一行：id/名/几何/填充/描边/效果/交互/实例覆盖），坐标全为画板局部；头部含 pageSpec 与 grouping 两段首版规范 |
| 同块文末 LOGIC 段 | `#__ai_view` 末尾 | 全量页面逻辑与说明聚合清单（按页/画板/节点分组，含摘要、规则、Markdown 正文、来源），AI 读一个块即可掌握业务规则 |

**实现约定（最高优先，先于一切字段细节）**：原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）参考，**不是逐像素代码规范**。实现必须遵循项目既定技术栈与开发规范：Vue3/React 标准组件、组件库与设计系统 Token、路由/状态管理、响应式与可访问性；母版/实例 → 可复用组件 + props/slot；禁止把清单逐节点翻译成绝对定位硬编码 DOM/CSS。坐标只用于理解相对关系，验收 = 布局与视觉整体一致且符合规范，不要求像素 diff=0。

三个场景：

1. **实现界面**：把 HTML 给 AI → AI 读 `#__ai_view`（布局与组件边界）＋ `#__doc`（完整字段），按项目开发规范用标准组件实现（勿逐像素硬编码）。
2. **修改设计稿**：把 HTML 给 AI → AI 输出与 `__doc` 同构的 JSON（全量 `{version:1,name,theme,pages,tree}`；文档 >100KB 时可只输出变更页 `[{page:<索引或页名>, artboards:[...]}]`）→ `apply-doc.mjs` 合回：

   ```bash
   node scripts/apply-doc.mjs 原型.chao.html AI输出.json        # 原地合入
   node scripts/apply-doc.mjs 原型.chao.html AI输出.json -o 新.html
   ```

   合入前自动跑全套结构校验（非法 JSON / id 重复 / 交互目标缺失会被拒绝）；合入后 `__ai_view` 自动再生。也可在编辑器里「打开」该 .json 整份载入。
3. **需求文档**：把 HTML 给 AI → AI 以 `#__ai_view` 的画板/图层分组与命名为结构依据编写 PRD。
4. **读写页面逻辑**：把 HTML 给 AI → 读 `#__ai_view` 文末 LOGIC 段（或 `__doc` 中的 `notes`）→ 用 `ProtoAPI.setNotes()` 精确改写单条说明，或输出含 `notes` 的同构 JSON 批量生成；`apply-doc.mjs` 合入时未带 `notes` 的节点沿用原值，仅显式 `notes:null` 才删除。人工可在编辑器「说明」tab 与演示「逻辑」抽屉复核调整。**v1.5.1 起，首轮 build 就应把说明写进 spec（硬性约束 5），本场景只用于增量修订与人工复核，不再作为默认补写环节。**

配套工具：

```bash
node scripts/embed-ai-view.mjs 旧原型.chao.html        # 旧文件补嵌 GUIDE + ai_view（可批量）
```

编辑器内 `ProtoAPI.exportAI()` 一次返回 `{ai_view, doc}`，供脚本化取用。注意：ai_view 的嵌入/替换采用「区域锚定」（仅操作 `__doc` 与主脚本之间的 HTML 区），不要改成对全文的宽松正则——编辑器 JS 源码里含同名字符串字面量，会被误吞（v1.2.1 踩坑）。

## 文件结构

- 产物 = 编辑器壳 + `<script type="application/json" id="__doc">` 内的文档 JSON + `<script type="text/plain" id="__ai_view">` 逐行清单（三者由保存/生成流程自动同步）。
- 编辑器保存时以原始壳重建文件（`PRISTINE_HTML`），因此**只改 `__doc`，不要改壳**；要升级壳请用 `scripts/gen-template.mjs --shell <editor-prototype/index.html>` 重建模板（也可用环境变量 `PROTOTYPE_SHELL` 指定壳路径）。
- 打开产物后可继续人工精调；`window.ProtoAPI` 提供 `getDoc/addNode/updateNode/setProto/insertComp/exportPNG` 等同步接口，便于二次自动化。

## 脚本

| 脚本 | 用途 |
| --- | --- |
| `build-prototype.mjs` | 规格 → 原型文件（主入口；自动嵌入 GUIDE + ai_view；v1.5.1 透传 spec 的 notes 并对缺说明画板输出提示；v1.6 编译 `grad`→fills、`shadow`→effects；**v1.9 `planGroups()` 首版语义编组规划**） |
| `validate-doc.mjs` | 校验已生成文件（CI 友好，退出码 0/1；缺 GUIDE/ai_view 会提示；v1.4 `notes`、v1.5 `direction`、v1.8 `pageSpec`、**v1.9 `pageSpec.grouping`** 校验） |
| `check-layout.mjs` | 布局对齐审计（v1.7；近失对齐/等高/间距/等宽四类规则，卡片分桶降噪，`--tol` 阈值、`--strict` 门禁） |
| `check-grouping.mjs` | **v1.9 首版语义编组门禁**：编组覆盖率 / 顶层散落叶子 / 嵌套深度 / 每组直接子元素；`--strict` 交付门禁，不加则输出历史稿体检报告 |
| `gen-template.mjs` | 由编辑器壳重建 `template.chao.html`（壳升级时用）；`--empty` 生成空文档原型（1 页 1 画板），`-o` 指定输出路径 |
| `embed-ai-view.mjs` | 旧原型补嵌 AI-GUIDE 注释 + `#__ai_view`（v1.2.1；可批量，原地更新） |
| `apply-doc.mjs` | 把 AI 输出的文档 JSON 合入原型（全量或变更页补丁；校验后落盘并再生 ai_view）；v1.4 对 `notes`、v1.5 对 `direction`、v1.8 对 `pageSpec`、**v1.9 对 `pageSpec.grouping`** 做保护性合并 |
| `ai-view.mjs` | 共享模块：`AI_GUIDE v1.7` / `AI_NOTICE` / `META_AI` / `AI_HINT` / `directionSection(doc)` / `pageSpecSection(doc)` / **`groupingSection(doc)`** / `logicSection(doc)` / `genAIView(doc)` / `embedAIBlocks(html, doc)` |
| `fetch-icons.mjs` | 从 Iconify 重新拉取 Element Plus / Ant Design 图标集 |
| `embed-icons.mjs` | 把 `icons.json` 注入编辑器壳的 `SVG_ICONS` 注册表 |
| `upgrade-kit.mjs` | 把 `design-kit.json` 中的伪图标替换为 SVG 图标节点 |

## 详细文档

- `references/spec.md` — 规格 DSL 全字段（页面 / 画板 / 节点 / 交互 / 组件 / 覆盖）
- `references/icons.md` — 图标命名、清单、自定义路径、更换图标集
- `references/design-system.md` — Element Plus / Ant Design 设计 Token 与内置母版覆盖点；**§6 风格方向与反模板**（v1.5）

## 常见错误

| 报错 | 原因 |
| --- | --- |
| `图标未收录："xx/yy"` | `icon` 名不在 `assets/icons.json`；查 `references/icons.md` 清单 |
| `组件不存在："xxx"` | `comp` 需为母版 id（如 `navbar`）或母版名称（如 `导航栏`） |
| `实例覆盖找不到母版节点："xxx"` | `overrides` 的键必须是母版内节点 `name` |
| `交互目标画板不存在` | `target` 需为画板 `name`（同页优先）或画板 id |
| `节点 id 重复` | 同一规格被手改了 id；删除自定义 `id` 让 builder 自动编号 |
| `notes.kind 非法` / `notes.rules 必须是数组` | 说明字段结构错误；见 GUIDE v1.6 的【说明 notes（v1.4）】 |
