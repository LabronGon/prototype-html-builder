# prototype.html

**自研**单文件高保真原型编辑器——纯 Canvas 渲染、零外部依赖，`一个 HTML = 编辑器 + 内嵌文档`，双击即可编辑与演示。设计规格、交互规则与验收基线均来自自研设计系统与内部实测，不以任何第三方产品作为对标或规格来源。

仓库同步维护两个远端：[GitCode](https://gitcode.com/Gon7/prototype.html)（主）与 [GitHub](https://github.com/LabronGon/prototype-html-builder)（公开镜像），同步命令见 `CONTRIBUTING.md`。

## 功能总览

**v1.9.0 首版语义编组规划 + 框选语义修正（2026-11-12）**：① AI 第一次生成界面必须先规划编组、把元素编进语义区块 `group`，而不是全部散落在画板内——`__doc.pageSpec.grouping` 首版锁定（PC 十类 / APP 七类基线区块），`build-prototype.mjs` 的 `planGroups()` 支持 `sections` 显式声明、节点 `section` 标签与几何行带兜底，`check-grouping.mjs --strict` 为交付门禁（覆盖率 ≥80% / 顶层散落叶子 ≤3 / 嵌套 ≤3 层 / 每组子元素 ≤12）；② 框选改为「只选框内的元素」：节点须被完整框住才选中，容器只框到一部分就下钻选子元素，不再把跨出框外的大卡片、大组整块选走；整板选中只在框选矩形覆盖画板 ≥92% 时触发，移动整板能力保留。GUIDE 升 v1.7、AI-NOTICE 第 8 条，meta / aiHint / `#__ai_view` 编组规划段五处同步。

**编辑器基础**（自研交互基线）

- 图层：矩形 / 椭圆 / 直线 / 箭头 / 多边形 / 星形 / 文本 / 图片 / SVG 图标 / 画板 / 编组 / 布尔
- 属性面板：填充（纯色/线性/径向渐变）、描边、圆角、效果（投影/模糊）、不透明度、对齐分布
- 组件：母版 + 实例（`inst/iid`），改母版全实例联动，可分离
- 视图：滚轮平移 / Ctrl 缩放 / 框选缩放 / 空格平移 / 标尺参考线 / 像素网格 / 深浅色主题 / 隐藏 UI
- 原型：交互热区跳转、演示模式、评论 pin
- 自动化：`window.ProtoAPI`（`getDoc/addNode/updateNode/setProto/insertComp/exportPNG…`）

**v1.1.0 八项修复**：SVG 图标兼容渲染、折行文本编辑防裁剪、双击控制点切自适应宽度、属性栏方向键微调、编组包围盒实时同步、下钻面包屑、深色模式补漏、画板标签明暗自适应。

**v1.2.0 矢量能力（P33–P34b）**

| 功能 | 操作 |
| --- | --- |
| 钢笔工具 | 快捷键 `P`；单击落锚、拖拽出对称贝塞尔柄、`Enter`/`Esc` 收笔 |
| 顶点吸附 | 落点自动吸附全画布顶点（8px）；悬停首锚点显示闭合环，点击即闭合 |
| 矢量编辑 | 双击路径进入：拖锚点 / 拖控制柄（`Alt` 临时独立）、`Delete` 删锚点 |
| 对齐参考线 | 拖锚点时与其他顶点 x/y 对齐吸附并绘制参考线 |
| 锚点类型 | 右键锚点：尖角 / 圆角（对称）/ 非对称平滑 / 半边圆角 |
| 形状转路径 | 双击矩形/圆/直线/多边形/星形 → 原地转可编辑路径 |
| 线段加锚点 | 悬停线段出现 `+`，点击按 De Casteljau 分割插入 |
| 工具栏按钮 | 编辑锚点 / 闭合路径 / 转为路径，随选中内容显隐 |

> 注意：路径渲染位置只由锚点决定，移动/微调/编组均已同步平移锚点（v1.2.0 修复框形分离 bug）。

**v1.8.0 首版页面规范锁定 + 编辑器交互三修（2026-11-12）**：① 框住画板内全部元素时直接选中画板本体，拖动移动整板（旧版只选中 89 个子层）；② 组件实例容器按原子对象选中、压在画板上的自由图层/热区随板移动（旧版 5 个热区/组件掉队）；③ Ctrl+V 支持系统剪贴板截图/图片/文本（原生 paste 事件 + `clipboard.read()` 兜底 + 右键菜单，file:// 可用）；④ 首次生成界面先声明 `platform` 并写入 `__doc.pageSpec`（`locked:true`）——**PC 端以 Element Plus（ElementUI）页面规范为主，APP 端以 Android（Material 3）页面规范为主，第一版输出即锁定，后续改稿/实现/追加页面沿用**。SKILL.md 硬性约束增至 8 条，细则见 CHANGELOG v1.8.0 与 `design-system.md §9`。

**v1.7.0 布局栅格与对齐门禁（2026-11-11）**：用户反馈「区块没对齐」，审计工具量化出 126 处对齐问题（4px 级漂移为主）。新增 `scripts/check-layout.mjs`（近失对齐/等高/间距/等宽四类规则，卡片分桶 + 类型分组 + 隔断检测三重降噪，`--strict` 门禁）；`design-system.md §8` 桌面栅格规范（24px 页边距 / 统一 gutter / 8px 纵向节奏 / 卡内边距 16 / 数值右对齐）；SKILL.md 硬性约束增至 **7 条**（对齐过门禁才能交付）。机器狗巡检 demo 按栅格修复：126 处 → **0 处 LAYOUT PASS**。细则见 CHANGELOG v1.7.0。

**v1.6.0 视觉丰富度 / 反简陋（2026-11-11）**：修复「产物简陋」的技术根因——壳原生支持渐变与投影但 DSL 从未暴露。规格 DSL 新增节点级 `grad`（同色明度渐变 → fills 数组）与 `shadow`（卡片投影 → effects）字段；`check-slop.mjs` 升 v1.6（JSON fills 渐变同样过色相门禁）；GUIDE v1.5 基线追加第 ⑨ 条反简陋三件套（浅灰页底 / 白卡描边+投影 / tinted 图标圆底 / 标题竖条 / 斑马纹 / 语义竖条）；`design-system.md` 新增 §7 场景化配方速查；SKILL.md 硬性约束增至 6 条。机器狗巡检 demo 已按新配方富化（17 卡投影描边 / 20 标题竖条 / 指标 tinted 图标 / 顶栏渐变线 / 视频取景框）。全量 10 份产物 regen 到 GUIDE v1.5，consistency 9/9、validate/slop 全绿。细则见 CHANGELOG v1.6.0。

**v1.5.1 说明随 build 一次写全（2026-11-11）**：修复 `build-prototype.mjs` 静默丢弃 spec `notes` 的链路缺口（此前 spec.md 承诺支持但 build 0 处处理，说明只能 apply-doc 后补）——`page/artboard/node/instance/container` 四构造点深拷贝透传，画板缺说明时 build 输出提示清单；SKILL.md 硬性约束增至 5 条（说明随稿交付，禁止先出稿后补说明当默认流程）；demo-spec.json 补 notes 示范。机器狗巡检 demo 已按新链路补全：页面 1 + 画板 3 + 组件 3 共 7 条说明、27 条规则。细则见 CHANGELOG v1.5.1。

**v1.5.0 风格方向与反模板（2026-11-11，方法论改编自 unslop @heydamir，CC BY 4.0）**：规格 DSL 新增 `direction` 顶层键（product / character / world / moments / signature），编译后存入 `__doc`、摘要进 `aiHint`、`#__ai_view` 头部输出方向段；`apply-doc.mjs` 保护性合并（未带沿用、显式 `null` 删除）；GUIDE 升 v1.4 增「默认风格基线」八条与审稿九遍序；新增 `tools/check-slop.mjs` 静态门禁（渐变文字 / 循环动画 / transition-all / emoji / 色相跨越渐变 / text-shadow，检测前挖掉规范注释区防自指）。**适用边界：用户给了视觉参考图时以参考图为准。** 顺带修复门禁抓到的存量违规：3 份 master 文档内置母版「复选项」的勾由 `text:"✓"` 改为 `ep/check` svg 节点。细则见 `skill-versions/prototype-html-builder/CHANGELOG.md` v1.5.0 与 skill `references/design-system.md §6`。

**v1.4.1 交互修补（7 项反馈）**

| 项 | 变化 |
| --- | --- |
| 删除 | 画布点击回收输入焦点；键盘 Delete 与右键菜单统一走 `deleteSel()`，锁定图层保护、loose 节点不报错 |
| 画板 | 选中画板出现 8 向尺寸手柄，拖拽改 W/H；从左上拖保持内容世界位置，Esc 可还原 |
| 颜色 | 所有颜色输入共用「最近使用」记录（localStorage，12 色），右栏顶部常驻色板，点击即回填 |
| 右栏 | 设计 / 原型 / 组件 / 说明共用面板可拖左缘调宽（252–560px，宽度记忆） |
| 演示 | 「逻辑」文字按钮改图标按钮，`L` 快捷键与激活态不变 |
| 说明 tab | 对象卡片 + 顶部工具行（画布角标 / 编辑·预览）与内容区分层；**预览渲染整条说明，含业务规则**；摘要与详细说明共用底部拖拽手柄调高；结构模板为「追加章节」按钮（页面 / 组件可并存，绝不覆盖已有正文）；分类与标签作为 AI / 搜索元数据移出编辑区，仅在预览以只读徽标呈现 |

**v1.4.1 第四轮（说明栏去误操作）**：「分类 / 检索」不再要求人工填写（`notes.kind / tags` 数据仍保留，供演示抽屉分组、AI 识别与搜索聚合）；「页面结构 / 组件结构」从「整条覆盖」改为**追加到正文末尾**，先静默提交当前输入再插入，两套章节可依次点击并存，同一结构重复点击不叠加；摘要与详细说明统一用 `.note-resizer` 拖拽手柄调高。

**v1.4.1 第五轮（清空后无法插入结构，bug 修复）**：`ensureNotes()` 原先在说明为空时自动预填一整套 `NOTE_TPL` 章节，导致「清空本条说明」后按钮判重误命中 `## 用途` / `## 触发条件`，或凭空多出一套没写过的空标题。改为**只建空白骨架**（`summary/body/rules/tags` 全空），章节一律由按钮主动追加；判重升级为「模板前两个标题同时命中」，避免用户自己写了单个同名标题就被误拦；「添加规则」同样补上静默提交，防止清空后冒出默认章节或丢失未失焦输入。

**v1.4.1 第六轮（演示逻辑抽屉可拖宽）**：演示预览模式右侧「页面逻辑与说明」抽屉原本固定 340px，长说明被挤窄。左缘新增 `#dlpSplitter` 拖拽手柄，宽度 **280px – min(760px, 60% 视口)** 可调，写入 `localStorage.proto.logicPanelWidth`，**双击手柄复位 340px**；`demoCamFor()` 的让位宽度由硬编码 340 改为实时读抽屉 `offsetWidth`，拖宽后画布自动缩小左移，设计稿不会被遮住，且不重置用户缩放。与编辑器右栏 `#rsplitter` 同构。

**v1.4.0 页面逻辑与说明（P36–P38）**

| 能力 | 说明 |
| --- | --- |
| 数据 | `page` / `artboard` / 任意 `node` 可挂 `notes`：`{kind, summary, body(Markdown), rules[{when,then,note}], tags, source, updated}`；随节点复制/删除/撤销/保存 |
| 人工 | 右栏第 4 个 tab「说明」：选中图层→组件说明，选中画板→画板说明，无选中→页面说明；模板一键插入、规则表增删、Markdown 编辑/预览、来源与更新时间 |
| 预览 | 演示顶栏「逻辑」按钮或 `L` 打开右侧抽屉：页面/画板/组件说明树 + 搜索 + 范围切换；条目 hover 画布高亮，画布说明角标点击定位且优先命中（不触发跳转）；分享链接可带 `&logic=1` |
| AI | `#__ai_view` 文末 LOGIC 附录聚合全量说明；GUIDE v1.3 / `aiHint` / meta 补 notes 字典；`ProtoAPI.getNotes/setNotes/listNotes/exportLogic`；`apply-doc.mjs` 保护性合并（AI 漏写 notes 沿用原值，显式 `notes:null` 才删）；`validate-doc.mjs` 结构校验 |

> 说明与布局共用同一份 `__doc`，不新增外挂文件；旧文件无 `notes` 按缺省处理，不回填脏数据。

**v1.2.2 AI 协作（P35/P35b/P35c）**：产物内嵌四层 AI 入口——`<head>` 的 `AI-NOTICE` + `meta[name=prototype-ai]`、`__doc.aiHint`、`PROTOTYPE-AI-GUIDE v1.2`（实现约定/坐标约定/字段字典/交互 schema/修改约定）、`#__ai_view` 逐行布局清单（保存时自动再生）。AI 只凭一个 HTML 即可：①实现界面 ②修改设计稿（输出 `__doc` 同构 JSON）③编写需求文档。编辑器「打开」支持 `.json` 直接载入 AI 输出；`ProtoAPI.exportAI()` 一次导出清单 + 文档。

> **实现约定（最高优先）**：原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）参考，**不是逐像素代码规范**。实现必须遵循项目既定开发规范（Vue3/React 标准组件、组件库与设计系统 Token、路由/状态/响应式/可访问性）；母版/实例 → 可复用组件 + props/slot；禁止把清单逐节点翻译成绝对定位硬编码 DOM/CSS。验收 = 布局与视觉整体一致且符合规范，不要求像素 diff=0。

## AI 协作工作流

```
设计稿 HTML ──给 AI──▶ ① 实现界面（读 #__ai_view 布局清单 + #__doc，按开发规范用标准组件实现）
            ├─给 AI──▶ ② 修改设计稿（AI 输出 __doc 同构 JSON → apply-doc.mjs 合回）
            ├─给 AI──▶ ③ 需求文档（以 ai_view 画板/图层结构为纲）
            └─给 AI──▶ ④ 读写页面逻辑（LOGIC 段 / notes → setNotes 或含 notes 的同构 JSON）
```

```bash
# 旧原型补嵌 AI 块（可批量、原地更新；脚本位于 live skill）
node ~/.workbuddy/skills/prototype-html-builder/scripts/embed-ai-view.mjs 原型.chao.html

# AI 改稿合入（支持全量文档 / 变更页补丁 [{page, artboards}]；合入前自动校验，合入后再生 ai_view）
node ~/.workbuddy/skills/prototype-html-builder/scripts/apply-doc.mjs 原型.chao.html AI输出.json -o 新文件.html

# 项目本地：AI 指引 / 清单再生；--shell 可只换编辑器壳、保留全部设计数据
node tools/regen-aiview.mjs sample.chao.html
node tools/regen-aiview.mjs --shell sample.chao.html 目标.chao.html
```

约定：AI 修改设计稿输出与 `__doc` 同构的 JSON `{version:1,name,theme,pages,tree}`，**不重写 HTML、编辑器壳原样保留**；文档 >100KB 时可只输出变更页。所有节点 x/y 均为画板局部坐标，仅用于理解相对层级与间距，不作为绝对定位依据。

## 文件结构

| 路径 | 说明 |
| --- | --- |
| `sample.chao.html` | 编辑器 master（唯一真源，示例文档） |
| `editor-prototype/` | 编辑器壳 `index.html` 与同源副本 `sample.chao.html` |
| `空白原型.chao.html` | 空白起点文件（1 页 1 画板） |
| `选矿设备管理.chao.html` | 实际设计文档（选矿设备管理，3 页 8 画板） |
| `docs/` | 自研验收基线、验收报告与演示证据截图 |
| `tools/regen-aiview.mjs` | AI 指引 / 清单再生工具；`--shell <新版壳>` 只换编辑器壳、保留全部设计数据 |
| `tools/regroup-legacy.py` | 存量稿补编组工具（几何连续段重组，零视觉变化） |
| `tools/check-wording.mjs` | 提交前禁用表述门禁 |
| `skill-versions/prototype-html-builder/` | skill 版本归档（v1.0.0–v1.3.0 + CHANGELOG），冻结快照 |
| `CONTRIBUTING.md` | 提交规范（目录约定、措辞、检查清单） |
| `archive/` | 本地过程性 / 历史资料，**已忽略、不入库、不删除** |

## prototype-html-builder skill（v1.9.0）

声明式 JSON 规格编译为 `.chao.html`，内置 Element Plus / Ant Design 图标与 27 个组件母版，产物自动嵌入四层 AI 协作块（GUIDE v1.6 + NOTICE/meta + aiHint + `__ai_view` 清单，含 pageSpec 首版规范段）。live skill 位于 `~/.workbuddy/skills/prototype-html-builder/`。

> **存量稿补编组**：v1.9.0 之前的产物若只补了 `pageSpec.grouping` 声明、节点仍是平铺散叶，用项目内 `tools/regroup-legacy.py <file>` 按几何连续段重聚成语义区块，编组门禁即达标（覆盖率 1.00、散落 0，绘制顺序与几何零变化）。

> **v1.3.0**：产物后缀由 `.prototype.html` 全量切换为 `.chao.html`（默认输出名、编辑器保存、内部资源路径、触发词、文档），不保留旧后缀兼容；文件选择器 accept 改用合法扩展名 `.html`，由 `suggestedName` 保留新后缀。

```bash
# 规格编译 + 校验
node ~/.workbuddy/skills/prototype-html-builder/scripts/build-prototype.mjs spec.json -o out.chao.html
node ~/.workbuddy/skills/prototype-html-builder/scripts/validate-doc.mjs out.chao.html

# 升级编辑器壳 / 生成空白原型
node ~/.workbuddy/skills/prototype-html-builder/scripts/gen-template.mjs --shell <editor-prototype/index.html>
node ~/.workbuddy/skills/prototype-html-builder/scripts/gen-template.mjs --empty --shell <editor-prototype/index.html> -o 空白原型.chao.html
```

版本历史见 [`skill-versions/prototype-html-builder/CHANGELOG.md`](skill-versions/prototype-html-builder/CHANGELOG.md)。

## 提交规范

```bash
node tools/check-wording.mjs   # 禁用表述扫描，必须 PASS / 0 命中
git status --short             # 复核 archive/、备份、临时文件未误入
```

自研定位、目录约定、壳与 skill 的同步要求、提交信息格式详见 [`CONTRIBUTING.md`](CONTRIBUTING.md)；验收标准见 [`docs/自研验收基线.md`](docs/自研验收基线.md)。

## 快捷键

`V` 选择 · `B` 画板 · `R` 矩形 · `E` 椭圆 · `L` 直线 · `T` 文本 · `A` 段落 · `C` 评论 · `P` 钢笔 · `H` 手型 · `Z` 缩放 · `Tab` 隐藏 UI · `Shift+1` 适配全部 · 演示中 `L` 开关逻辑抽屉
