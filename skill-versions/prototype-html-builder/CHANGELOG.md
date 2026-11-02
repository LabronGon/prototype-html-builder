# prototype-html-builder 版本变更日志

编辑器壳（`assets/template.prototype.html`）与 skill 文档的版本化记录。
壳源文件：`F:\0.WorkSpace\Project_53 prototype.html\editor-prototype\index.html`（升级壳用 `scripts/gen-template.mjs --shell <壳路径>` 重建）。

---

## v1.1.0（2026-11-02）

编辑器壳从 2026-11-02 修复版重建，携带 8 项编辑器升级；skill 文档首次版本化。

### 编辑器壳升级（源自 Project_53 三批修复）

| # | 升级项 | 说明 |
| --- | --- | --- |
| 1 | SVG 图标兼容渲染 | `type:"svg"` 图标节点（Element Plus 图标名 + 自定义 paths）正式支持：画布 Path2D 渲染、属性面板"图标"区段调色、图层面板类型识别；图标缺失显示占位而非静默空白。旧文档（如红外测温平台）导入后 35 个图标全部恢复 |
| 2 | 换行文本编辑防裁剪 | 编辑覆盖层按 `align` 动态切换 `pre-wrap`，高度随内容自适应（scrollHeight 兜底），固定宽度长文本编辑不再隐藏内容 |
| 3 | 双击控制点切自适应宽度 | 双击文本框左右（e/w）中间控制点，取消固定宽度、宽度随内容自适应 |
| 4 | 属性栏方向键微调 | 数值输入框支持 ↑/↓（含小键盘）增减，Shift ×10、Alt ×0.1，行距/字距步进 0.1 |
| 5 | 编组包围盒实时同步 | 编组内子元素缩放后祖先组包围盒立即重算（此前控制点区域残留旧尺寸） |
| 6 | 下钻面包屑 + 图层联动 | 双击进组后左侧图层自动展开对应编组并高亮选中行；新增下钻路径面包屑（画布 › 组A › 组B，可点击逐级跳出）；所在编组行品牌色竖条标识 |
| 7 | 深色模式补漏 | 填充/描边条目、帮助按钮、Toast、滚动条深色适配（此前白色底） |
| 8 | 画板标签明暗自适应 | 画板名称墨色随页面画布底色明暗自动切换（深色页浅字、浅色页深字），悬停底色同步适配 |

### 文档与脚本

- SKILL.md 增加版本头与壳升级摘要；`gen-template.mjs` 支持环境变量 `PROTOTYPE_SHELL`，壳路径缺失时报错提示 `--shell` 用法。
- 模板重建自修复版壳：218 个 SVG 图标完整保留（与旧壳同源图标库），27 个组件母版不变。
- 验证：`validate-doc.mjs` 对模板与 demo 均 PASS；demo 运行时冒烟 39/39 图标解析、视口内 36 个全部渲染；旧文件导入回归（1270 节点零丢失）通过。

### 升级方式

```bash
node scripts/gen-template.mjs --shell "F:\0.WorkSpace\Project_53 prototype.html\editor-prototype\index.html"
node scripts/build-prototype.mjs examples/demo-spec.json   # 重建示例
node scripts/validate-doc.mjs examples/demo.prototype.html # 校验
```

---

## v1.0.0（基线）

初始版本：编辑器壳 + 218 个 Element Plus / Ant Design SVG 图标 + 27 个组件母版；`build-prototype.mjs`（规格编译）、`validate-doc.mjs`（校验）、`gen-template.mjs`（壳重建）、`fetch-icons.mjs` / `embed-icons.mjs`（图标集）、`upgrade-kit.mjs`（kit 图标升级）。

已知问题（v1.1.0 已修复）：老文档 `type:"svg"` 图标节点导入后画布空白（图标丢失）；换行文本编辑内容被裁剪；无自适应宽度切换手势；编组内子元素缩放后组包围盒不同步；下钻无面包屑与图层联动；深色模式填充/描边等区块白色底；浅色模式深色页画板名称不可读。
