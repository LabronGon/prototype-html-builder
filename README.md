# prototype.html

单文件高保真原型编辑器——纯 Canvas 渲染、零外部依赖，`一个 HTML = 编辑器 + 内嵌文档`，双击即可编辑与演示。

## 功能总览

**编辑器基础**（对齐 MasterGo / Penpot 交互）

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

**v1.2.1 AI 协作（P35）**：产物内嵌 `PROTOTYPE-AI-GUIDE` 头注释（坐标约定 / 字段字典 / 交互 schema / 修改约定）与 `#__ai_view` 逐行设计清单（每节点一行精确几何样式，保存时自动再生），AI 只凭一个 HTML 即可：①像素级复刻（直读 ai_view）②修改设计稿（输出 `__doc` 同构 JSON）③编写需求文档。编辑器「打开」支持 `.json` 直接载入 AI 输出；`ProtoAPI.exportAI()` 一次导出清单 + 文档。

## AI 协作工作流

```
设计稿 HTML ──给 AI──▶ ① 像素级复刻（读 #__ai_view 转译代码）
            ├─给 AI──▶ ② 修改设计稿（AI 输出 __doc 同构 JSON → apply-doc.mjs 合回）
            └─给 AI──▶ ③ 需求文档（以 ai_view 画板/图层结构为纲）
```

```bash
# 旧原型补嵌 AI 块（可批量、原地更新）
node scripts/embed-ai-view.mjs 原型.prototype.html

# AI 改稿合入（支持全量文档 / 变更页补丁 [{page, artboards}]；合入前自动校验，合入后再生 ai_view）
node scripts/apply-doc.mjs 原型.prototype.html AI输出.json -o 新文件.html
```

约定：AI 修改设计稿输出与 `__doc` 同构的 JSON `{version:1,name,theme,pages,tree}`，**不重写 HTML、编辑器壳原样保留**；文档 >100KB 时可只输出变更页。所有节点 x/y 均为画板局部坐标，可直接映射 CSS。

## 文件结构

| 文件 | 说明 |
| --- | --- |
| `sample.prototype.html` | 编辑器 master（示例文档） |
| `editor-prototype/index.html` | 编辑器壳（内嵌 218 个 SVG 图标，与 master 同源） |
| `空白原型.prototype.html` | 空白起点文件（1 页 1 画板） |
| `选矿设备管理.prototype.html` | 实际设计文档（选矿设备管理，3 页 8 画板） |
| `skill-versions/prototype-html-builder/` | skill 版本归档（v1.0.0–v1.2.1 + CHANGELOG） |

## prototype-html-builder skill（v1.2.1）

声明式 JSON 规格编译为 `.prototype.html`，内置 Element Plus / Ant Design 图标与 27 个组件母版，产物自动嵌入 AI 协作块（GUIDE 注释 + `__ai_view` 清单）。live skill 位于 `~/.workbuddy/skills/prototype-html-builder/`。

```bash
# 规格编译 + 校验
node scripts/build-prototype.mjs spec.json -o out.prototype.html
node scripts/validate-doc.mjs out.prototype.html

# 升级编辑器壳 / 生成空白原型
node scripts/gen-template.mjs --shell <editor-prototype/index.html>
node scripts/gen-template.mjs --empty --shell <editor-prototype/index.html> -o 空白原型.prototype.html
```

版本历史见 [`skill-versions/prototype-html-builder/CHANGELOG.md`](skill-versions/prototype-html-builder/CHANGELOG.md)。

## 快捷键

`V` 选择 · `B` 画板 · `R` 矩形 · `E` 椭圆 · `L` 直线 · `T` 文本 · `A` 段落 · `C` 评论 · `P` 钢笔 · `H` 手型 · `Z` 缩放 · `Tab` 隐藏 UI · `Shift+1` 适配全部
