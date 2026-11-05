# prototype.html

**自研**单文件高保真原型编辑器——纯 Canvas 渲染、零外部依赖，`一个 HTML = 编辑器 + 内嵌文档`，双击即可编辑与演示。设计规格、交互规则与验收基线均来自自研设计系统与内部实测，不以任何第三方产品作为对标或规格来源。

## 功能总览

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

**v1.2.2 AI 协作（P35/P35b/P35c）**：产物内嵌四层 AI 入口——`<head>` 的 `AI-NOTICE` + `meta[name=prototype-ai]`、`__doc.aiHint`、`PROTOTYPE-AI-GUIDE v1.2`（实现约定/坐标约定/字段字典/交互 schema/修改约定）、`#__ai_view` 逐行布局清单（保存时自动再生）。AI 只凭一个 HTML 即可：①实现界面 ②修改设计稿（输出 `__doc` 同构 JSON）③编写需求文档。编辑器「打开」支持 `.json` 直接载入 AI 输出；`ProtoAPI.exportAI()` 一次导出清单 + 文档。

> **实现约定（最高优先）**：原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）参考，**不是逐像素代码规范**。实现必须遵循项目既定开发规范（Vue3/React 标准组件、组件库与设计系统 Token、路由/状态/响应式/可访问性）；母版/实例 → 可复用组件 + props/slot；禁止把清单逐节点翻译成绝对定位硬编码 DOM/CSS。验收 = 布局与视觉整体一致且符合规范，不要求像素 diff=0。

## AI 协作工作流

```
设计稿 HTML ──给 AI──▶ ① 实现界面（读 #__ai_view 布局清单 + #__doc，按开发规范用标准组件实现）
            ├─给 AI──▶ ② 修改设计稿（AI 输出 __doc 同构 JSON → apply-doc.mjs 合回）
            └─给 AI──▶ ③ 需求文档（以 ai_view 画板/图层结构为纲）
```

```bash
# 旧原型补嵌 AI 块（可批量、原地更新；脚本位于 live skill）
node ~/.workbuddy/skills/prototype-html-builder/scripts/embed-ai-view.mjs 原型.prototype.html

# AI 改稿合入（支持全量文档 / 变更页补丁 [{page, artboards}]；合入前自动校验，合入后再生 ai_view）
node ~/.workbuddy/skills/prototype-html-builder/scripts/apply-doc.mjs 原型.prototype.html AI输出.json -o 新文件.html

# 项目本地：AI 指引 / 清单再生；--shell 可只换编辑器壳、保留全部设计数据
node tools/regen-aiview.mjs sample.prototype.html
node tools/regen-aiview.mjs --shell sample.prototype.html 目标.prototype.html
```

约定：AI 修改设计稿输出与 `__doc` 同构的 JSON `{version:1,name,theme,pages,tree}`，**不重写 HTML、编辑器壳原样保留**；文档 >100KB 时可只输出变更页。所有节点 x/y 均为画板局部坐标，仅用于理解相对层级与间距，不作为绝对定位依据。

## 文件结构

| 路径 | 说明 |
| --- | --- |
| `sample.prototype.html` | 编辑器 master（唯一真源，示例文档） |
| `editor-prototype/` | 编辑器壳 `index.html` 与同源副本 `sample.prototype.html` |
| `空白原型.prototype.html` | 空白起点文件（1 页 1 画板） |
| `选矿设备管理.prototype.html` | 实际设计文档（选矿设备管理，3 页 8 画板） |
| `docs/` | 自研验收基线、验收报告与演示证据截图 |
| `tools/regen-aiview.mjs` | AI 指引 / 清单再生工具；`--shell <新版壳>` 只换编辑器壳、保留全部设计数据 |
| `tools/check-wording.mjs` | 提交前禁用表述门禁 |
| `skill-versions/prototype-html-builder/` | skill 版本归档（v1.0.0–v1.2.2 + CHANGELOG），冻结快照 |
| `CONTRIBUTING.md` | 提交规范（目录约定、措辞、检查清单） |
| `archive/` | 本地过程性 / 历史资料，**已忽略、不入库、不删除** |

## prototype-html-builder skill（v1.2.2）

声明式 JSON 规格编译为 `.prototype.html`，内置 Element Plus / Ant Design 图标与 27 个组件母版，产物自动嵌入四层 AI 协作块（GUIDE v1.2 + NOTICE/meta + aiHint + `__ai_view` 清单）。live skill 位于 `~/.workbuddy/skills/prototype-html-builder/`。

```bash
# 规格编译 + 校验
node ~/.workbuddy/skills/prototype-html-builder/scripts/build-prototype.mjs spec.json -o out.prototype.html
node ~/.workbuddy/skills/prototype-html-builder/scripts/validate-doc.mjs out.prototype.html

# 升级编辑器壳 / 生成空白原型
node ~/.workbuddy/skills/prototype-html-builder/scripts/gen-template.mjs --shell <editor-prototype/index.html>
node ~/.workbuddy/skills/prototype-html-builder/scripts/gen-template.mjs --empty --shell <editor-prototype/index.html> -o 空白原型.prototype.html
```

版本历史见 [`skill-versions/prototype-html-builder/CHANGELOG.md`](skill-versions/prototype-html-builder/CHANGELOG.md)。

## 提交规范

```bash
node tools/check-wording.mjs   # 禁用表述扫描，必须 PASS / 0 命中
git status --short             # 复核 archive/、备份、临时文件未误入
```

自研定位、目录约定、壳与 skill 的同步要求、提交信息格式详见 [`CONTRIBUTING.md`](CONTRIBUTING.md)；验收标准见 [`docs/自研验收基线.md`](docs/自研验收基线.md)。

## 快捷键

`V` 选择 · `B` 画板 · `R` 矩形 · `E` 椭圆 · `L` 直线 · `T` 文本 · `A` 段落 · `C` 评论 · `P` 钢笔 · `H` 手型 · `Z` 缩放 · `Tab` 隐藏 UI · `Shift+1` 适配全部
