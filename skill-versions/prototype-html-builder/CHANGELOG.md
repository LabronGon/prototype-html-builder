# prototype-html-builder 版本变更日志

编辑器壳（`assets/template.prototype.html`）与 skill 文档的版本化记录。
壳源文件：`F:\0.WorkSpace\Project_53 prototype.html\editor-prototype\index.html`（升级壳用 `scripts/gen-template.mjs --shell <壳路径>` 重建）。

---

## v1.2.2（2026-11-05）

定位修正：原型是**空间布局与 UI 元素整体效果的参考**，不是逐像素代码规范；实现必须遵循项目开发规范（Vue3 等标准组件/设计系统），不得因复刻放弃标准组件库。

### AI 指引：GUIDE v1.2 + 三层可发现性

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | 实现约定（最高优先） | GUIDE 新增开篇段：原型仅作结构/层级/间距节奏/配色/状态/交互参考；实现须用 Vue3/React 标准组件 + 组件库与设计系统 Token + 路由/状态/响应式/可访问性；母版/实例→可复用组件 + props/slot；禁止逐节点绝对定位硬编码；验收非像素 diff=0 |
| 2 | 头部钩子 | 新增 `AI-NOTICE` 注释与 `<meta name="prototype-ai">`（置于 `<head>` 最前），解决 Agent 读文件头漏规范（旧 GUIDE 藏在文件中部） |
| 3 | JSON 钩子 | `__doc` 顶层新增 `aiHint` 键（`docJson` 强制注入），只抽 JSON 的 Agent/脚本也能看到规范入口 |
| 4 | 措辞清理 | 删除全部「像素级复刻 / 可直接映射 CSS / 唯一真源逐行转译 CSS / 像素复刻源」；静态 title 改「布局与 UI 设计参考」；【实现建议】改为分组→组件边界、颜色/圆角→设计 Token |

### 生成器修复（`#__ai_view` 与 `__doc` 对账无损）

| 项 | 修复 | 红外测温平台实测 |
| --- | --- | --- |
| svg 图标 | 输出 `icon=` + `color=`（此前落入矩形分支丢失） | 35/35 |
| hidden | 判断改 `n.hidden || n.visible===false`（此前只查 visible） | 36/36 |
| 文本 | text/name/src 改 JSON 字符串字面量（`\n`/引号/尖括号无损，可 JSON.parse 还原） | 多行 2/2 |
| 数值 | 几何/pts/画板坐标不再取整，保留原始精度 | 小数行 764/764 |
| 类型 | 补 arrow（dir）/bool（op）；画板名改 JSON 字符串 | — |
| proto | 保持不变（此前文档误报"全部丢失"，实测 75/75 一直在） | 75/75 |

### 工具链

- `ai-view.mjs`：新增导出 `AI_NOTICE`/`META_AI`/`AI_HINT`；GUIDE/NOTICE/meta 整块替换（CRLF 兼容、去重）；`embedAIBlocks` 归一化区间空白，**反复补嵌/保存幂等**（此前每次多 1 个换行）。
- `docJson()` 强制注入 `aiHint`；`gen-template.mjs --empty`、`apply-doc.mjs`、`embed-ai-view.mjs` 同步。
- 项目本地 `tools/regen-aiview.mjs` 新增 `--shell <新版壳>`：用今日编辑器壳重建旧文件，完整保留其 `__doc` 设计数据并自检一致性。已用于红外测温平台文件壳升级（2 页 43 画板数据 0 变化；升级前备份 `2026-11-05-红外测温平台.prototype.壳升级前备份.html`）。

### 验证

- skill：模板/空白/示例重建，`validate-doc` 全 PASS；`embed-ai-view.mjs` 连续 3 次补嵌字节数不变；`apply-doc.mjs` 全量合入 + aiHint 保留 + ai_view 再生通过。
- 编辑器：master/editor-prototype×2/空白/选矿/红外五文件 GUIDE v1.2 与工具常量一致、view 头带实现约定、旧措辞 0 残留、主脚本语法 OK。
- 无头 Chrome：master 与红外零报错；`exportAI().doc.aiHint`、`genAIView()` 头部均含新约定；`buildFile()` 产物含 aiHint + ai_view。

### 升级方式

```bash
node scripts/embed-ai-view.mjs 旧原型.prototype.html            # 补嵌 v1.2 指引 + 再生清单 + 刷新 aiHint
node scripts/apply-doc.mjs 原型.prototype.html AI输出.json        # AI 改稿合入
node scripts/validate-doc.mjs 原型.prototype.html                # 校验
```

---

## v1.2.1（2026-11-03）

AI 协作三件套：让 AI 只凭一个 HTML 完成像素级复刻 / 修改设计稿 / 需求文档编写（P35）。

### 产物新增（编辑器壳 P35）

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | `PROTOTYPE-AI-GUIDE` 头注释 | `__doc` 前静态注释（~2.7KB）：给 AI 的读法、坐标约定（全部叶子/组 x/y 为画板局部坐标）、节点类型与字段字典、交互 schema、组件实例覆盖、AI 修改约定、复刻建议 |
| 2 | `#__ai_view` 逐行清单 | `<script type="text/plain" id="__ai_view">`：每节点一行（id/名/几何/填充/描边/效果/交互/实例覆盖），编辑器保存时经 `embedAIView()` 自动再生（区域锚定，不触碰壳代码） |
| 3 | 打开 .json | 编辑器「打开」接受 `.json`：AI 输出的纯文档 JSON 直接 `applyDoc` 载入 |
| 4 | `ProtoAPI.exportAI()` | 一次返回 `{ok, ai_view, doc}`，脚本化取用 |

### skill 脚本

- 新增 `ai-view.mjs` 共享模块（`AI_GUIDE` / `genAIView(doc)` / `embedAIBlocks(html, doc)`）。
- 新增 `embed-ai-view.mjs`：旧原型批量补嵌 GUIDE + ai_view（原地更新）。
- 新增 `apply-doc.mjs`：AI 输出文档 JSON 合入原型，支持全量 `{version,pages,...}` 与变更页补丁 `[{page, artboards}]` 两种格式；合入前跑全套结构校验，落盘后自动再生 ai_view。
- `build-prototype.mjs` / `gen-template.mjs` 产物自动嵌入 AI 协作块；`validate-doc.mjs` 缺块时降级为提示。

### 验证

- 5 个原型（master / editor-prototype×2 / 空白 / 选矿）补嵌后：主脚本语法 OK、`__doc` 字节数不变、ProtoAPI/buildFile 完整、ai_view 位置正确（__doc 与主脚本之间）。
- apply-doc 双格式合入 + 非法输入拦截（页面不存在 / 画板缺 id 尺寸非法）通过。
- 无头 Chrome 冒烟：启动零报错、`exportAI()` 返回 588 行清单 + 3 页文档、`buildFile()` 产物含 ai_view 且 `__doc` 完整。

### 踩坑记录

- **AI-GUIDE 注释内禁止出现裸 `<script>` 字样**：会被解析器/正则当成块边界，把主脚本切成两段（首段报语法错误）。
- **ai_view 替换禁止全文宽松正则**：编辑器 JS 源码内含 `<script type="text/plain" id="__ai_view">` 字符串字面量（`embedAIView` 函数），`reAI` 全文匹配会从字面量处吞掉其后 ~47KB 编辑器代码（buildFile/ProtoAPI 丢失，文件变小）。修复为「区域锚定」：只在 `__doc` 结束 → 下一个裸 `<script>` 之间的 HTML 区操作。曾导致 master 与 editor-prototype 两副本损坏，已从 git 恢复重做。

### 升级方式

```bash
node scripts/embed-ai-view.mjs 旧原型.prototype.html          # 旧文件补嵌
node scripts/apply-doc.mjs 原型.prototype.html AI输出.json     # AI 改稿合入
node scripts/validate-doc.mjs 原型.prototype.html              # 校验
```

---

## v1.2.0（2026-11-03）

编辑器壳从 2026-11-03 矢量增强版重建（P33/P34/P34b 三批升级）；`gen-template.mjs` 新增 `--empty` / `-o`。

### 编辑器壳升级（源自 Project_53 P33–P34b）

| # | 升级项 | 说明 |
| --- | --- | --- |
| 1 | 钢笔工具 | 快捷键 P；单击落锚、拖拽出对称贝塞尔控制柄、Enter/Esc 收笔；`type:"path"` 节点（pts + c1/c2 控制柄 + closed），填充/描边/裁剪/阴影全兼容 |
| 2 | 矢量锚点编辑 | 双击路径或工具栏"编辑锚点"进入：拖锚点移动、拖控制柄调曲率（Alt 临时独立）；Delete 删选中锚点 |
| 3 | 锚点类型系统 | 右键锚点切换：尖角（直角）/ 圆角（对称平滑）/ 非对称平滑（共线不等长）/ 半边圆角（单侧平滑）；拖柄按类型联动 |
| 4 | 钢笔顶点吸附 | 落笔自动吸附全画布顶点（路径锚点/矩形角/椭圆四分点/线端点/多边形星形顶点，8px 半径）；悬停首锚点显示闭合提示环，点击即闭合 |
| 5 | 对齐参考线 | 拖锚点时与其他顶点 x/y 对齐吸附（4px 阈值）并绘制参考线，Alt 暂停 |
| 6 | 形状转路径 | 双击（或工具栏"转为路径"）把矩形/椭圆/直线/多边形/星形原地转为可编辑路径，保留填充描边透明度与层级；组件实例需先分离 |
| 7 | 线段加锚点 | 矢量编辑下悬停线段显示"+"（贝塞尔最近点），点击按 De Casteljau 分割插入锚点，曲线形状不变 |
| 8 | 路径拖动修复 | `translateNode` 对 path 平移 pts 并同步包围盒（此前只移 x/y 导致框动形状不动、框形分离） |
| 9 | 上下文工具栏 | 编辑锚点/闭合路径/转为路径按钮上移顶部工具栏（随选中内容显隐），右侧面板路径区块移除 |

### 文档与脚本

- `gen-template.mjs` 新增 `--empty`（生成空文档原型：1 页 1 画板、无示例内容）与 `-o <路径>`（自定义输出，默认 `assets/empty.prototype.html`）。
- 模板重建自矢量增强版壳：218 个 SVG 图标与 27 个组件母版不变；模板 515,687 字节。
- 验证：`validate-doc.mjs` 对模板与空文档原型均 PASS；两文件无头浏览器启动零报错（模板 2 页 28 画板、空白 1+内置组件库页）；矢量功能冒烟（转路径/拖动/吸附/加锚/锚点类型/闭合）全部通过。

### 升级方式

```bash
node scripts/gen-template.mjs --shell "F:\0.WorkSpace\Project_53 prototype.html\editor-prototype\index.html"
node scripts/gen-template.mjs --empty --shell "F:\0.WorkSpace\Project_53 prototype.html\editor-prototype\index.html" -o 空白原型.prototype.html
node scripts/validate-doc.mjs assets/template.prototype.html
```

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
