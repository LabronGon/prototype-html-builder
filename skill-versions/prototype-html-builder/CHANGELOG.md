# prototype-html-builder 版本变更日志

编辑器壳（`assets/template.prototype.html`）与 skill 文档的版本化记录。
壳源文件：`F:\0.WorkSpace\Project_53 prototype.html\editor-prototype\index.html`（升级壳用 `scripts/gen-template.mjs --shell <壳路径>` 重建）。

---

## v1.9.0 首版语义编组规划 + 框选语义修正（2026-11-12）

**触发**：用户反馈 2 个问题——① AI 生成第一版时没有对页面内的原型做编组规划，元素全部散乱在画板内部，要求「将元素编组完成」；② 在画板内框选一些元素时，会把整个区块都选中，而不是只把框选内的元素一起选中。

### 问题 1：首版编组规划（生成链路，五处规范入口同步）

| 层 | 落地 |
| --- | --- |
| 规范 | `SKILL.md` 硬性约束第 9 条；`design-system.md §10`（双端基线区块 / 编组树模板 / 锁定与门禁）；`spec.md §2`（`sections` / `section` DSL 两种写法） |
| 编译器 | `build-prototype.mjs` 新增 `GROUP_BASELINE`、`normalizeGrouping()`、`planGroups()`；`__doc.pageSpec.grouping`（`locked:true`）；显式 `sections` → 节点 `section` 标签 → 几何行带兜底并提示 |
| 门禁 | 新增 `scripts/check-grouping.mjs`（覆盖率 / 散落叶子 / 嵌套 / 每组子元素 / **「区块 N」无语义命名拦截**，`--strict` 交付门禁）；`validate-doc.mjs` 校验 `grouping` 结构。实测：去掉 `sections` 的自动兜底稿被 FAIL，显式规划稿 PASS |
| 合入 | `apply-doc.mjs` 保护性合并：AI 改写 `pageSpec` 漏 `grouping` 时沿用首版，禁止静默拆散编组 |
| AI 入口 | GUIDE v1.6→v1.7 新增「首版语义编组」段、AI-NOTICE 第 8 条、`meta` / `aiHint` / `pageSpecSection` 同步；新增 `groupingSection(doc)` 输出每画板编组树摘要；编辑器运行时新增 `genGroupingView()`，保存再生不丢 |

实测：`examples/demo-spec.json` 改为显式 `sections` 后，画板顶层由 10 / 15 / 6 个散落节点编译为 3 / 4 / 3 个语义区块 `group`，`check-grouping --strict` PASS。

### 问题 2：框选只选框内元素

**根因**（CDP 实测复现）：v1.8 的 `marquee` 用「相交即选」`touch()`，且组件实例容器擦到一点就整体选中；框选画板中央 576×360 会把 760×424 的「视频画面」、416×318 的「告警卡」整块选入；窄条 120×90 甚至直接选中整个 760×424 的实例容器。`allKids` 整板判定只看顶层图层是否都被框住，元素集中在画板一角时会把局部框选误判成整板。

**修复**（`editor-prototype/index.html`）：改用 `covered()` 覆盖率判定（节点须被完整框住，`IN=0.98`，2px 贴边容差；零尺寸线/箭头改为两端都在框内）；容器完整框住才整组选中，否则下钻选真正落在框内的子元素；整板选中只保留 `covered(画板)>=0.92`，去掉 `allKids`。

**实测对比**：中央 1/4 框选 `11 个大区块 → 17 个框内小元素`；左上 1/3 `9 个含大 group → 15 个框内小元素`；全板框选仍 `selCount:1 / hasArtboard:true`；画板移动仍 `moved:167 / notMoved:0`；剪贴板能力未回归。

---

## v1.8.0 首版页面规范锁定 + 编辑器交互三修（2026-11-12）

**触发**：用户反馈新版本 4 个问题——① 鼠标框住画板内全部元素时没选中画板、只选中内容，用户真正想移动的是画板；② 移动画板时部分交互热区与组件不跟随；③ 系统外复制/截图放进剪贴板后，在 `file://` 打开的产物里 Ctrl+V 完全粘不进来；④ 首次生成界面没有把页面规范定义清楚并锁定。

### 问题 1 / 2：框选与画板移动（同一根因）

| 项 | 内容 |
| --- | --- |
| 根因 | 框选只递归 `ab.children`，画板本体从不参与；且组件实例容器（`group + inst/cont`）的包围盒常比框大 2px，被判为「未完全框住」而下钻到子层——结果只搬走叶子，容器本体与挂在容器上的 `proto` 热区留在原地。实测机器狗巡检画板：框选 89 个子层，5 个实例容器/热区不动 |
| 修复① | 框选覆盖整块画板或画板内全部可见顶层图层时，**直接选中画板本体**（覆盖率 ≥0.92，含 2px 容差）；整板选中时清掉同板子层，Shift 叠加同样适用 |
| 修复② | 组件实例容器按**原子对象**选中，禁止下钻只搬子层；整组改用覆盖率判定，减少贴边拖动落空 |
| 修复③ | 画板被选中后从画板内部按下拖拽 → 挂起 `abSelPress`，单击仍选子层，拖过阈值转 `moveAb` 移动整板（此前会被内容抢选，只搬走一个子层） |
| 修复④ | 新增 `looseForBoards/moveLoose`：压在画板上的页面级自由图层（交互热区/临时组件）随画板一起移动，Esc 取消一并还原 |
| 验证 | 真实浏览器 CDP 复测：框选结果 89 子层 → **1 个画板**；拖拽后 167/167 节点整体移动（旧版 5 个热区/组件掉队） |

### 问题 3：系统剪贴板粘贴

| 项 | 内容 |
| --- | --- |
| 根因 | `Ctrl+V` 无条件 `preventDefault()` 后只调 `pasteSel()`（内部 `clipNodes`），把带 `clipboardData` 的原生 `paste` 事件一起吃掉；系统外图片/文本没有任何入口 |
| 修复 | 三级链路：① 原生 `paste` 事件读 `clipboardData`（图片 → `image` 节点、文本 → `text` 节点，输入框焦点时让位）；② keydown 后 420ms 无有效 paste 内容时用 `navigator.clipboard.read()` 兜底（`file://` 属安全上下文）；③ 右键菜单「粘贴系统剪贴板图片」。图片等解码完成后按真实像素插入（旧 `insertImage` 同步读 `naturalWidth` 会退化成 200×150），并支持拖图片入画布 |
| 验证 | A 原生 paste 图片 640×360 → 320×180 节点 / B 文本 / C 内部图层复制优先 / D `clipboard.read()` 兜底 / E Ctrl+V 键盘链路 / F 保存后规范字段不丢，6 项全 PASS |

### 问题 4：首版页面规范（PC / APP）

| 项 | 内容 |
| --- | --- |
| 规范 | 首次生成界面先声明 `platform`：**PC → Element Plus（ElementUI）页面规范**（1440×900 / 24px 页边距 / gutter 16 / 8px 节奏 / 控件 32 / 字号 14 / 圆角 6）；**APP → Android（Material 3）页面规范**（360×800dp / 16dp 边距 / 8dp 栅格 / 应用栏 56dp / 触控≥48dp / 14sp）。`design-system.md §9` 全量基线表 |
| 落位 | `build-prototype.mjs` 写 `__doc.pageSpec`（`locked:true` + 逐页端型）；`ai-view.mjs` / 编辑器壳 / `regen-aiview.mjs` 同步 GUIDE **v1.6** + NOTICE 第 7 条 + meta + `aiHint` + `#__ai_view` 的 pageSpec 段；`validate-doc.mjs` 校验结构；`apply-doc.mjs` 保护性合并且锁定态拒绝静默换端型；编辑器 `persistDoc()` 原样带回 `pageSpec`/`direction`（旧版保存会静默丢弃） |
| 强调 | SKILL.md 硬性约束 7→**8 条**，第 8 条「首版页面规范锁定」；最少可用规格示例、`demo-spec.json`、`gen-template` 模板/空模板、`机器狗巡检-spec.json` 均带 `platform`；10 份存量产物补齐 `pageSpec` |

### 同步与验收

- 编辑器壳 `editor-prototype/index.html` → `sample.chao.html` + `editor-prototype/sample.chao.html` 三份字节一致；全量 10 份产物 `regen-aiview.mjs --shell` 升级到新壳与 GUIDE v1.6。
- `consistency 9/9`、`validate-doc 10/10`、`check-slop 8/8`、`check-layout --strict PASS`、`check-wording 0`、`smoke 9×10`、幂等 regen 两次字节不变。

---

## v1.7.1 对齐门禁补全：E 列底 / F 溢出（2026-11-11）

**触发**：用户要求「再检查一下这个版本，看看还有什么别的问题」。全面体检（结构级 QA 脚本 + 截图目检）发现四类此前门禁不覆盖的问题：① 远程控制模式卡自动按钮溢出卡底 4px、姿态按钮贴卡右缘（padding 0）；② 三画板各列内容底不齐（38–148px）；③ 设备绑定 gutter 混用（左列 24 / 右列 16）；④ 记录卡纵向节奏混乱。

### 改动

| 层 | 内容 |
| --- | --- |
| `check-layout.mjs` | 新增 **E 列底对齐**（各列内容最大底 y 差 >8 报；列锚 = 顶级卡 x；嵌套子卡不参与列统计）与 **F 内容溢出**（桶内节点超出所属卡右/下缘 >2px 报；贴边相等不报）；A 顶缘加「水平区间有交叠」前置（跨区域元素同 y 不再误报）；E 的列统计扩展到非「卡」名的块级内容（提示条等） |
| 机器狗巡检 demo | 全部修复：三画板 9 列内容底统一 844（模式卡/姿态卡/安全条/记录卡/成功卡/告警卡拉伸重排，姿态按钮 168×48 两行、记录补 2 条至 5 条、成功卡改「激活完成」卡带 tinted 图标底/标题/副文/查看设备链接、表格加分页栏）；gutter 统一 16；`check-layout --strict` **0 处 PASS** |

### E/F 规则的边界（防误报）

- E 只比「列与列之间」的最大底差；同列内垂直堆叠的卡不等底是正常的。
- 嵌套子卡（如向导卡内的发现卡）不参与列统计，也不与外层卡做重叠比较。
- F 的「贴边相等」（按钮右缘 = 卡右缘）不算溢出；超过 2px 才报。

---

## v1.7.0 布局栅格与对齐门禁（2026-11-11）

**触发**：用户反馈「页面还是很简陋，而且有很多区块都没对齐」。用审计工具量化验证：机器狗巡检 demo 存在 **126 处对齐问题**（tol=4px），典型如右列标签 x 1120/1124/1132 混用、遥测值 1360/1364 漂移、卡内纵向节奏混乱（gap 12→31→10→70）。根因：节点靠手摆坐标，无栅格约束、无静态校验——「差一点对齐」视觉上比明显错位更致命。

### 改动

| 层 | 内容 |
| --- | --- |
| `scripts/check-layout.mjs`（新） | 布局对齐审计：四类规则——A 近失对齐（左缘/顶缘 ≤TOL 不等）、B 同行不等高、C 同类序列间距不一致、D 系列宽度不齐。**降噪三件套**：① 节点按「包含其中心的最小卡片」分桶，只桶内比较；② C 规则按节点类型分组且被异类节点（细线/表格行）隔断的段不比——组间大于组内是合法设计；③ B 限按钮/卡/chip 命名、D 只比形状节点不比 auto-width 文本。`--tol` 阈值 / `--strict` 门禁模式 |
| `references/design-system.md §8` | 新增「布局栅格与对齐系统」：1440 桌面栅格表（24px 页边距 / 侧栏 200 / 统一 gutter / 卡内边距 16 / 8px 纵向节奏）、五条对齐规则（同列同 x / 数值右对齐用 align+固定 w / 行距一致 / 实例用声明尺寸 / 居中即对齐中心线）、build→check-layout→strict PASS 工作流 |
| `SKILL.md` | 升 v1.7.0；硬性约束 6→**7 条**（第 7 条「对齐过门禁」：`check-layout --strict` PASS 才能交付）；脚本表收录 check-layout |
| 实战验证 | 机器狗巡检 demo 按显式坐标表修复：metric 组件 196→184 两列成网格（1016/1216）、右列三卡纵向重排（8px 节奏）、遥测值/预计完成/航线图例/告警全部改 `align:'right'` 右对齐、速度 chips 统一 gap 12、步标对齐步骤圆、刷新图标贴右缘、标题竖条与标题同 y。**126 处 → 0 处（LAYOUT PASS）**；validate/slop/wording 门禁同步全绿 |

### 踩坑（审计工具的三个误报源，均已内化为规则）

1. auto-width 文本的**右缘**天然参差——左对齐文本只比左缘；
2. 高度不同的元素垂直居中时**顶缘天然不等**（图标底 40 vs 按钮 32）——对齐的是中心线；
3. 组间距（标题→内容）大于行间距是**合法层次**——C 规则按类型分组 + 隔断检测（段内夹细线/表格行即跳过，被隔断的 gap 不参与相邻比较）。

---

## v1.6.0 视觉丰富度 / 反简陋（2026-11-11）

**触发**：用户反馈「skill 设计的页面都太简陋了」。排查发现技术根因：编辑器壳原生支持渐变（`fills` 数组，P19）与投影（`effects`，P19），但 build 链路从未暴露——spec DSL 只有纯色 `fill`，AI 即使想画投影/渐变也写不出来，产物天然是纯色平面。

### 改动

| 层 | 内容 |
| --- | --- |
| `build-prototype.mjs` | 新增 `applyFx()`：spec 节点级 `grad`（`{type,angle,stops}` → 编辑器 `fills` 渐变数组，`fill` 保留主色兜底）与 `shadow`（`{x,y,blur,color,opacity}` → `effects` 投影，opacity 上限 0.4）；`buildNode` 出口统一挂载；instance/bool 容器跳过（避免与母版覆盖冲突） |
| `tools/check-slop.mjs` | 升 v1.6：新增规则 5b——`__doc` 内节点 `fills` 渐变与 CSS 渐变同规则（色相差 >60° 且双方饱和度 >20% 即拦），JSON 形态渐变无处遁形 |
| `references/spec.md` | 节点通用字段表新增 `grad` / `shadow` 语法与约束 |
| `references/design-system.md §7` | 新增「视觉丰富度配方（反简陋）」：三件套（浅灰页底 / 白卡描边+投影 / tinted 图标圆底+标题竖条+趋势柱）+ 8 个场景化配方速查（顶栏渐变收边 / 取景框扫描线 / 告警语义竖条 / 斑马纹 / 胶囊 chip 等）+ 与 §6 基线的边界澄清（「表面克制」指颜色数量，不是细节贫瘠；中性色卡片投影不受「禁发光」限制） |
| `SKILL.md` | 升 v1.6.0；硬性约束 5→6 条（第 6 条「反简陋三件套」逐画板自检）；脚本表更新 |
| GUIDE v1.4→v1.5 | 「默认风格基线」追加第 ⑨ 条反简陋三件套（两份副本同步：skill `ai-view.mjs` + 项目 `tools/regen-aiview.mjs`；regen 日志版本号同步 v1.5） |
| 实战验证 | 机器狗巡检 demo 富化重建：511 节点 / 33 图标；17 张白卡加描边+投影、20 处标题加品牌竖条、遥测指标组件加 tinted 图标圆底、顶栏加渐变高亮线、视频加四角取景框+扫描线、告警行加语义竖条、绑定表格斑马纹；三道门禁 + consistency 9/9 + validate/slop 10 文件全绿 |

### 同步动作

全量 10 份产物（sample / editor 两份 / 空白原型 / 选矿两份 / skill template+empty+demo / 机器狗巡检）regen 到 GUIDE v1.5 并通过一致性校验。

---

## v1.5.1 说明随 build 一次写全（2026-11-11）

**触发**：机器狗巡检 demo 交付后用户质询「为什么技能默认没有将页面的说明写完整」。排查发现真正根因不在 AI 忘写，而在技能链路缺口：`build-prototype.mjs` 全文 0 处处理 `notes`——spec.md 承诺 `page/artboard/node` 可挂 notes，但 build 时被静默丢弃，说明只能靠 apply-doc 后补或编辑器人工补写；SKILL.md 又把说明定位成「后置环节」，官方示例 demo-spec.json 自身 notes 为 0，AI 自然不会写。

### 改动

| 层 | 内容 |
| --- | --- |
| `build-prototype.mjs` | ① 新增 `pickNotes(spec, target)`：spec 的 `notes` 在 **page / artboard / node（含 instance / container）** 四个构造点深拷贝透传进 `__doc`；② 画板缺说明时 build 输出提示清单（`X页 有 N 个画板未写说明（notes）：…——交付前请补全页面逻辑说明`），仅提示不阻断 |
| `SKILL.md` | 升 v1.5.1：硬性约束 3→5 条，新增第 5 条「说明随稿交付」——每个页面、每个画板必须写全 notes（kind/summary/正文四章/规则表/tags），关键交互节点（弹层/向导/安全类控件）至少一条 `kind:"component"` 说明，禁止「先出稿后补说明」当默认流程；「读写页面逻辑」场景（原第 4 条）改为仅用于增量修订与人工复核 |
| `examples/demo-spec.json` | 页面 + 3 画板全部补上 notes 示范；重建 `demo.chao.html`（622912 字节，build 零提示） |
| 实战验证 | 机器狗巡检 demo 重建后：说明对象 7（页面 1 + 画板 3 + 组件 3：video-frame 实例 / 急停按钮 / 向导卡）、规则 27 条，全部进入 `__doc` 与 `#__ai_view` LOGIC 附录；validate / check-slop / check-wording 全绿 |

### 踩坑

- spec 节点容器键是 `nodes`（不是 `children`，children 是 build 产物的键）；instance 引用键是 `comp`（不是 `component`，两者兼容但 spec 里写 `comp`）。
- 统计 notes 时注意：画板的 notes 在「遍历 artboard 本体」和「递归子节点」两条路径都可见，统计脚本要防重复计数。

---

## v1.5.0 风格方向与反模板（2026-11-11）

**触发**：用户引入 unslop 方法论（Damir Sokolovsky @heydamir，CC BY 4.0）评估借鉴价值。结论：现有规范管「合规」（Token / 母版 / 硬性约束）不管「个性」，unslop 的「让界面只像这个产品」恰好补上这一层。按「中量」方案落地：文档章节 + DSL 字段 + 静态门禁。

### 改动

| 层 | 内容 |
| --- | --- |
| `references/design-system.md §6` | 新增「风格方向与反模板」：五要素表（product / character / world / moments / signature，禁「简洁/现代/高级」万金油词）、默认风格基线八条（表面克制 / 一屏一 accent / 禁 slop / 圆角嵌套公式 / 4px 网格与导航密度 / 数字纪律 / 图表一主多辅 / 模板自检）、审稿九遍序（间距→颜色→图标→文案→字体→布局→细节→视觉→动效）。**适用边界写死：用户给了视觉参考图时以参考图为准**（用户工作模式是严格对照参考图还原，此规则防止 AI 擅自去改参考图风格） |
| 规格 DSL | 新增 `direction` 顶层键（全键可选；`character`/`moments` 兼容字符串或字符串数组）；`build-prototype.mjs` 归一化后存入 `__doc`，摘要追加进 `aiHint` |
| AI 三层入口 | `AI_GUIDE` v1.3→v1.4：新增【风格方向 direction】与【默认风格基线】两段；`AI_NOTICE` 加第 6 条；`AI_HINT` 加 direction 读法；`genAIView` 头部输出「=== 风格方向（direction）===」段（`directionSection`） |
| `apply-doc.mjs` | `direction` 保护性合并：AI 未带沿用原值，显式 `direction:null` 才删除（与 notes 同策略）。踩坑：`{...baseDoc}` 先展开，null 覆盖分支是空对象删不掉——必须在 merged 构造后 `delete merged.direction` |
| `validate-doc.mjs` | `direction` 结构校验（字符串 / 字符串数组），非法值在 build 与 apply-doc 两端都被拒绝 |
| `tools/check-slop.mjs`（项目） | 静态门禁六项：渐变文字（background-clip:text）、循环动画（animate-pulse/ping/bounce/spin、infinite）、transition-all、emoji 文本（只查 `__doc`/`__ai_view`）、色相跨越渐变（两端色相差 >60° 且饱和度 >20%，同色明度渐变放行）、text-shadow。**检测前挖掉 GUIDE/AI-NOTICE 注释区**——规范文本里写有禁用项名字，否则自指误报 |
| `examples/demo-spec.json` | 加 `direction` 示例并重建 demo；三处落位验证通过（`__doc.direction` / `aiHint` 摘要 / ai_view 段） |

### 顺带修复（门禁抓到的存量违规）

master 文档（sample / editor×2 共 3 份共用）内置母版「复选项」的勾是 `text:"✓"` 文本节点，违反硬性约束 1（图标必须 SVG）。替换为 `ep/check` svg 节点（14px，#FFFFFF，y 居中 15）。`design-kit.json` 本身干净，无需改。同步发现 `sample.chao.html` 作为 regen 目标时从未被再生过（此前只当壳源），其 `__ai_view` 仍含旧节点——补跑自再生。

### 验证

- direction 闭环 4 场景：未带沿用 / 显式 null 删除 / 带值覆盖 / 非法拒绝，全 PASS。
- `check-slop` 9/9 PASS；validate 9/9、consistency 9/9（hint 比较剥离 direction 摘要——仅带 direction 的文件会多这段，属预期差异）、verify-tools 10/10、smoke 9×10、check-wording 0、gen-template 重建幂等。
- 选矿 48 条说明 / 109 条规则未变；运行时异常 0。

### 未引入（明确裁剪）

unslop 的 story video（与原型工具无关）、hero scene 图像生成（dashboard 场景几乎不需要；仅落地页原型可作可选提示）、字体选型建议（单文件零依赖，Canvas 系统字体栈，字体不是变量）。

---

## v1.4.1 交互修补（2026-11-11）

**触发**：7 项使用反馈（删除偶发失效、画板尺寸、颜色历史、右栏宽度、逻辑按钮、说明编辑/预览语义、说明面板精简）。

| # | 反馈 | 根因 / 处理 |
| --- | --- | --- |
| 1 | 选中画板或组件有时不能删除 | **真实 bug**：画布 `mousedown` 阻止默认聚焦，焦点一旦进入右栏输入框就回不来，`keydown` 开头的输入框过滤把所有快捷键（含 Delete）一起屏蔽；且键盘删除走一套与右键菜单不同的内联实现，对 `parent=null` 的 loose 节点抛 `TypeError`，`indexOf=-1` 时还会误删别的画板。修复：画布 pointerdown 主动 blur 输入控件；键盘删除统一调用 `deleteSel()`；`deleteSel` 补 locked 保护、loose 兜底、安全 indexOf、enterGroup 清理 |
| 2 | 画板不能拖拽调尺寸 | 原 `hitHandle()` 与选中框明确排除 artboard。新增 `drawAbSel / hitAbHandle / startAbResize / applyAbResize`，8 向手柄只改画板 w/h；从左上拖时按起始基准补偿子节点坐标以保持其世界位置；Esc 可还原，pointerup 入撤销历史 |
| 3 | 颜色选择要记录历史 | 全局捕获 `input[type=color]` 的 change，最近 12 色存 `localStorage`；右栏顶部常驻「最近」色板（不随属性面板重建消失），属性区内就近再挂一份；点击回填最近交互的颜色输入，填充区折叠时直接给选中节点上色 |
| 4 | 右侧设计 / 原型等面板要可调宽 | 新增 `#rsplitter`（与左栏 `#vsplitter` 对称），252–560px，宽度持久化 |
| 5 | 演示「逻辑」文字按钮改图标 | 改为 `.dbtn` + 内联 SVG 文档图标，保留 title / aria-label / 快捷键 L / 激活态 / 分享链接 |
| 6 | 「编辑 / 预览」看不懂 | 二者是「写 Markdown 源码」与「看排版结果」的切换；按钮加铅笔 / 眼睛图标与明确 tooltip，section 标题去掉「（Markdown）」 |
| 7 | 说明栏目内容精简 | 移除节点 id、AI 调用提示、统计 / 来源 / 更新文案、规则空态提示、示例 placeholder 与「模板与工具 / 显示」标题；分区改为「摘要 / 类型·标签 / 详细说明 / 业务规则」，字段标签缩短 |

**第二轮反馈 · 说明栏信息架构重构**（同日）：用户指出「预览不含业务规则」「模板 / 清空看不懂且窄栏挤压」「画布角标放底部不合理、区块排布没逻辑」。调整如下：

- 「编辑 / 预览」从「详细说明」的局部切换升级为**面板级模式**：预览渲染整条说明（摘要 + 标签 + Markdown 正文 + 业务规则编号卡片），编辑态才出现输入控件；切换前静默提交表单（`collectNoteForm(false,true)`），不写撤销历史、不误改 `source/updated`。
- 面板按两层重排：**顶部工具行** = 作用域 chip + 对象名 + 画布角标开关（视图设置）+ 编辑/预览；**下方内容区** = 摘要 / 类型·标签 / 详细说明 / 业务规则。画布角标是显示开关而非说明内容，故从底部移到顶部。
- 「页面模板 / 组件模板 / 清空」正名为**「骨架」工具行**，归入「详细说明」区（本就作用于正文）；文案缩为「页面 / 组件 / 清空」，flex 自适应 + `text-overflow` 防挤压，每按钮带说明具体作用的 tooltip。
- 「最近颜色」色板限定只在「设计」tab 显示，避免在说明 tab 顶部出现无关控件。

**第三轮反馈 · 说明栏控件与编辑手感**（同日）：用户指出「顶部对象条太丑」「类型/标签看不出用途」「摘要只有一行不好编辑」「骨架/页面/组件不像按钮且分不清」「业务规则长文本难编辑」。调整：

- 顶部对象条换成**对象卡片**：蓝色类型徽标（页 / 板 / 件）+ 对象名（加粗）+ 面包屑元信息（作用域 · 页面 · 画板）+ 左侧品牌色竖条与柔和渐变底。
- 「类型 / 标签」正名为「**分类 / 检索**」；区标题、下拉、输入框各带 tooltip 说明用途（kind 供 AI / 演示抽屉分类，tags 供搜索与 LOGIC 聚合），不常驻说明文字。
- **摘要**由单行 `input` 改为 2 行起步的 `textarea`，`resize:vertical`、52–220px，可直接拖高。
- 消除「骨架（其实是分组标签，不是按钮）/ 页面 / 组件」的混淆：改为**两个等宽按钮**「页面结构」「组件结构」（描边 + 图标方块 + hover + tooltip 写明各自插入的章节）；「清空」从这组拆出，降为详细说明区右下角的弱化文字按钮「清空本条说明」。
- **业务规则**三字段全部改为可拖高 `textarea`（条件 / 动作 2 行、备注 1 行），自动换行 + `word-break`；卡片加序号徽标与独立删除按钮，「添加规则」改为全宽虚线按钮。

**第四轮反馈 · 说明栏去误操作**（同日）：用户指出「分类和检索还是没看懂有什么作用」「点结构按钮把写好的正文替换清空了，误操作」「页面结构与组件结构为什么不能并存」「详细说明也要能拖高度」。调整：

- **分类 / 检索退出编辑区**：`notes.kind / notes.tags` 是给 AI、演示抽屉分组（`dlp-kind` / `noteKindLabel`）与搜索 / LOGIC 聚合用的元数据，人工写说明时无须理解或填写，因此从 `notesPanelHtml()` 的可编辑表单中整体移除；`collectNoteForm()` 仍以可选读取方式兼容，既不删除既有数据，也不影响 `ProtoAPI.setNotes` 与 AI 写入。改为在**预览态**用只读徽标 `.np-kind` 呈现分类 + 标签，并带 tooltip 说明用途，让「它做什么」在查看时自解释。
- **结构模板改为追加而非覆盖**：旧 `tpl(kind)` 执行 `t.n.notes = clone(NOTE_TPL[kind])`，会整条替换 `notes`（摘要、正文、规则、标签全丢）。新实现先 `collectNoteForm(false,true)` 静默提交当前输入框（含尚未触发 `change` 的正文与规则），再把模板章节 `src` 追加到 `body` 末尾：`nt.body = cur ? cur+'\n\n'+src : src`；用模板首个标题做重复检测，重复点击只 toast 提示、不叠加。
- **两套结构可并存**：「页面结构」= 用途 / 入口与前置条件 / 主流程 / 异常与边界 / 权限与数据；「组件结构」= 触发条件 / 处理规则 / 状态与反馈 / 边界情况。二者都是普通 Markdown 章节，首标题不同，可依次追加到同一份正文，互不排斥，也适用于「一个页面说明里同时交代整体流程与某个关键组件」。
- **统一拖拽手柄**：新增 `.ta-wrap` + `.note-resizer` + `bindNoteResize(root)`，摘要与详细说明共用同一个底部手柄（`52–600px`，只改 `style.height`，不写撤销历史）；两个 `textarea` 均设 `resize:none`，避免浏览器原生角标与自定义手柄两套手势打架。业务规则字段仍保留原生 `resize:vertical`。

**第五轮反馈 · 清空后无法再插入结构（bug）**（同日）：用户报「点『清空本条说明』后再插入页面结构，提示已存在无法插入；另一个按钮也一样」。

- **根因**：`ensureNotes(n,kind)` 是 v1.4.0 遗留设计 —— 说明为空时自动 `clone(NOTE_TPL[kind])` 预填一整套章节。第四轮把模板改成「追加章节」后，这个预填就有害了：清空 → `tpl()` 里 `collectNoteForm(false,true)` 因表单全空删掉 `notes` → 紧接着 `ensureNotes()` **又预填一套默认章节** → 判重 `cur.includes('## 用途')` 必然命中。组件结构同理（node scope 预填 `## 触发条件`），即使不命中判重，也会把章节追加到一套用户没写过的空标题后面。
- **修复**：`ensureNotes()` 改为**只建空白骨架** `{kind, summary:'', body:'', rules:[], tags:[], source, updated}`，不再预填 `NOTE_TPL`。三处调用点（表单收集、结构追加、添加规则）同时受益。该替换在 `patch.mjs` 新增第 18 处精确替换。
- **判重加固**：由「首标题命中」改为「模板前两个标题同时命中」（`heads.slice(0,2).every(h=>cur.includes(h))`）。模板插入一定带这两个标题，重复点击仍能拦住；用户自己手写单个 `## 用途` 不再被误伤。
- **顺带修**：「添加规则」按钮补 `collectNoteForm(false,true)`，避免清空后凭空冒出默认章节，也避免丢失尚未失焦的摘要 / 正文。
- **验证**：专项 CDP 扩到 27 项全 PASS（新增 6k / 6l / 6m / 6n 覆盖清空→插入），smoke 9×10、validate 9/9、consistency 9/9、verify-tools 10/10、check-wording 0；新增效果图 `v141-01h/i`。

**第六轮反馈 · 演示逻辑抽屉可拖宽**（同日）：用户要求「预览时右侧说明区域也支持左右拖动宽度」，确认目标为**演示预览模式的「页面逻辑与说明」抽屉**（非编辑器右栏、非说明 tab 输入框）。原抽屉 `width:340px` 固定，长规则与 Markdown 列表被挤成多行。

- **手柄**：抽屉左缘新增 `#dlpSplitter`（绝对定位、`cursor:col-resize`、hover / 拖拽时品牌色竖条），与编辑器右栏 `#rsplitter` 同构的 pointer 拖拽；范围 `280px – min(760px, 60% 视口宽)`，写入 `proto.logicPanelWidth`；**双击复位 340px** 并清除记忆。
- **让位联动（关键）**：`demoCamFor()` 原为 `const panelW = demo.logic ? 340 : 0`，只改 CSS 宽度会让画板被抽屉盖住。改为实时读 `lp.offsetWidth`（hidden 时兜底 340），拖动中调用 `applyDemoCam() + drawSoon()` 即时重算；刻意不用 `demoFit()`，避免把用户当前缩放重置为 1。
- 新增独立片段 `archive/v141/snip/logic-splitter.txt`，`patch.mjs` 共 20 处精确替换。

**同步与验证**：master 壳 20 处精确替换（`archive/v141/patch.mjs`，可重放），9 份原型 `--shell` 同步；专项 CDP 扩到 **30 项**全 PASS（新增 8a 手柄存在、8b 拖宽 + 让位公式 + 持久化、8c 双击复位）、9 文件 × 10 项冒烟 PASS、validate 9/9、consistency 9/9、verify-tools 10/10、check-wording 0 命中、运行时异常 0 / 控制台错误 0；`选矿设备管理.chao.html` 的 48 条说明 / 109 条规则未变。新增效果图 `v141-05-逻辑抽屉拖宽.png`（抽屉约 600px，画布自动缩小到 64% 且完整可见）。

> 8b 断言设计备注：不能用「拖宽后 `cam.x` 变小」判断让位——抽屉变宽时 `fitCam` 缩放同步变小，`cam.x` 反而会变大。正确断言是 `cam.x + 画板中心×z === (视口宽 − 抽屉实际宽)/2`，直接证明让位量取自抽屉宽度。

---

## v1.4.0 页面逻辑与说明（2026-11-11）

**触发**：新增三项能力 —— ① 对整个页面或单个组件描写逻辑与说明；② 演示预览时直接查看页面逻辑；③ 说明既便于 AI 修改、也便于人工调整。

### 方案

单一真源：`notes` 作为普通字段内嵌于 `__doc` 的 `page / artboard / node`，半结构化
`{kind, summary, body(Markdown), rules:[{when,then,note}], tags, source, updated}`。
不新增外挂文件；说明随节点复制 / 删除 / 撤销 / 保存，旧文件无 `notes` 按缺省处理。

| 层 | 实现 |
| --- | --- |
| 数据 | `notesOf / noteEmpty / hasNotes / ensureNotes / setNotesObj / collectNotes / genLogicView / mdRender`；画布角标绘制与命中共用 `noteBadgeAt` |
| 人工 | 右栏第 4 个 tab「说明」：作用域随选中对象切换、页面/组件模板、规则表增删、Markdown 编辑/预览、标签、来源标记；改动经 `snapshot()` 进撤销历史 |
| 预览 | 演示顶栏「逻辑」按钮 + `L`；右侧抽屉（当前画板/当前页面/全部页面 + 搜索 + Markdown 与规则渲染）；条目 hover 画布高亮；`demoCamFor` 为抽屉让位 340px；画布角标优先命中且屏蔽 proto 跳转；分享链接 `#demo?a=…&logic=1` |
| AI | `#__ai_view` 文末 LOGIC 附录（不新增 script 块，避免破坏区域锚定）；GUIDE v1.3 / AI-NOTICE / meta / `aiHint` 四处同步补 notes 字典与修改约定；`ProtoAPI.getNotes/setNotes/listNotes/exportLogic` + `__schema`；`apply-doc.mjs` 保护性合并；`validate-doc.mjs` 结构校验 |

### 关键决策

- **保护性合并**：`apply-doc.mjs` 的变更页补丁会整块替换 `artboards`，AI 重写节点漏写 `notes` 会静默抹掉人工说明。合入前按 `id`（页面级按页索引）从原文档建索引，AI 输出未带 `notes` 时沿用原值，仅显式 `notes:null` 才删除。
- **零外部依赖**：Markdown 渲染自写极简解析器，先 `escapeHtml` 再放行白名单标签，不引入任何 CDN。
- **命中隔离**：逻辑视图开启时 `demoBadgeHit` 优先于 `demoHitNode`，避免与交互热区冲突。

### 同步范围

`sample.chao.html`（master 壳）→ `editor-prototype/` 两份 → 项目全部 `.chao.html`（`regen-aiview.mjs --shell` 只换壳、保留设计数据）→ live skill 的 `ai-view.mjs / apply-doc.mjs / validate-doc.mjs / SKILL.md` 与 `assets/`、`examples/` 四份产物 → 本归档 v1.4.0。

### 验证

- `validate-doc.mjs`：项目 5 份 + live skill 4 份，9/9 PASS。
- 无头浏览器冒烟：9 份文件 × 10 项（ProtoAPI / notes 方法 / 说明 tab / 写入说明 / LOGIC 附录 / 回显 / Markdown 预览 / 演示抽屉 / 角标与分享链接 / 退出演示），全部 PASS，运行时异常 0、控制台错误 0。
- 工具链闭环 10 项：保护性合并（全量 / 变更页补丁 / 显式删除）、LOGIC 再生、`note=` 标记、非法 notes 拒绝、regen 幂等、live skill `genAIView`、规范入口同步，全部 PASS。
- `tools/check-wording.mjs` PASS / 0 命中；主脚本语法 `new Function` 通过；`gen-template.mjs` 重建幂等。

### 体验微调与真实文档验证（同日）

以 `选矿设备管理.chao.html` 为样本，走正式 AI 改稿通道 `apply-doc.mjs` 写满说明：
3 个页面级 + 8 个画板级 + 37 个组件级 = **48 条说明 / 109 条业务规则**，`#__ai_view` 的 LOGIC 附录同步生成。

| 观察 | 调整 |
| --- | --- |
| 右栏 282px 下规则表多列挤压、输入框重叠 | `.nr-row` 改纵向卡片，每字段独立 `<label>`；模板按钮 grid 三等分 |
| 48 条说明时画布蓝色 `i` 角标过密、遮挡设计稿 | 编辑态改 `drawNoteDots()` 极小蓝点；演示态角标 18→16px 并降低不透明度 |
| 「当前画板」抽屉第一屏被页面级长文占满，画板自身逻辑需下滚 | `buildLogicPanel()` 在 board scope 下按 `cur` 优先、`pageLevel` 置底排序，页面级分组加「页面级」标签 |

微调只动 master 壳的编辑器 CSS/JS，9 份原型统一 `--shell` 换壳（设计数据 0 变化），重跑全部验证与 6 张效果图；说明数据仍为 48 条 / 109 条规则。

---

## 技能 AI 指引措辞同步（2026-11-06 · 不升版本）

**触发**：以项目 `空白原型.chao.html`（15:16 由 `tools/regen-aiview.mjs` 再生）为基准核对 skill，发现 live skill 与 v1.3.0 归档停在 15:10 版 AI 块措辞。两者编辑器壳逐字节同源，差异仅 2 行。

### 改动

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | `AI_GUIDE` 圆角行 | 删去「（旧数据 rc 同序）」，与项目基准一致；live skill `scripts/ai-view.mjs`、`skill-versions/v1.3.0/ai-view.mjs`、`v1.3.0.zip` 三处同步 |
| 2 | 产物重建 | `assets/template.chao.html`、`assets/empty.chao.html`、`examples/demo.chao.html` 各仅 1 行变化；`examples/选矿设备管理.chao.html` 与仓库同名文件字节一致，保持不动 |
| 3 | 归档例外 | 按本次要求原地更新 v1.3.0 目录与 zip，版本号不变；这是 `CONTRIBUTING.md` 归档冻结策略的一次显式例外，改前备份见 `.workbuddy/backup-samples/2026-11-06-skill-sync/` |

### 冻结未改

`genAIView` 保留 skill 修复版：`aiStr` JSON 无损转义、override 名称、头注释 `embed-ai-view.mjs`。项目 `tools/regen-aiview.mjs` 的生成器仍是旧逻辑（画板名裸引号、override 无名称），未回灌 skill，避免把 v1.2.2 已修复的无损转义带回退。因此技能产物的 `#__ai_view` 头注释与项目基准相差 1 行（工具名），属预期差异。

### 验证

- `validate-doc.mjs`：live skill 4 份产物 + 项目 5 份产物，9/9 PASS。
- `build-prototype.mjs --check` 编译通过；`tools/check-wording.mjs` PASS / 0 命中。
- `gen-template.mjs` 连续两次重建，md5 不变（幂等）。
- 无头 Chrome 冒烟 5 个文件：控制台零报错；GUIDE v1.2 / AI-NOTICE / meta / `__ai_view` / `aiHint` / `exportAI()` / canvas 全部可用；旧圆角措辞 0 残留。
- live skill 13 个脚本与文档和 v1.3.0 归档逐字节一致；zip 13 个条目与归档逐字节一致；`verify-rebuild.cjs` 通过。

---

## v1.3.0（2026-11-06）

产物后缀全量切换：`.prototype.html` → `.chao.html`，**不保留旧后缀兼容**。属于行为变更（默认输出名、编辑器保存、文件识别均改变），故升版本。

### 改动

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | 默认输出名 | `build-prototype.mjs` 无 `-o` 时输出 `<spec.name>.chao.html`；skill 触发词、脚本用法提示同步 |
| 2 | 编辑器保存 | 回退名 `未命名原型.chao.html`、新建名、下载后缀 `+'.chao.html'`、打开/保存 accept、导出去后缀正则 `/\.(chao\.)?html?$/i` |
| 3 | 内部资源路径 | `assets/template.chao.html`、`assets/empty.chao.html`、`examples/demo.chao.html`、`examples/选矿设备管理.chao.html`；`gen-template.mjs` 默认输出路径同步 |
| 4 | 全量同步 | 项目 4 个产物 + `editor-prototype/index.html` + 全部内嵌壳副本，共 28 个文件、约 230 处字面；README / CONTRIBUTING / docs / tools 命令示例同步 |
| 5 | 文件选择器修复 | `showOpenFilePicker` / `showSaveFilePicker` 的 accept 由双点扩展名改为合法的 `.html`，靠 `suggestedName` 保留 `.chao.html`；规避 Chrome File System Access API 拒绝非法扩展名 |
| 6 | 活测试脚本 | `.workbuddy/smoke.cjs`、`verify-rebuild.cjs` 的产物路径同步 |

### 冻结未改

`skill-versions/v*` 归档与 zip、`.workbuddy/backup-samples/`、`idempotent-test.html`、`archive/*.corrupted.bak`、memory 历史日志、远端仓库名 `gitcode.com/Gon7/prototype.html`、工作区目录名。均为历史快照或外部引用，按 `CONTRIBUTING.md` 冻结策略不回溯改写。

### 验证

- `build-prototype.mjs --check` 通过；无 `-o` 实际生成 `选矿设备管理.chao.html`。
- `gen-template.mjs` 空文档 / 常规模板重建成功；`validate-doc.mjs` 11 个文件全 PASS。
- 9 个 HTML 主脚本 `new Function` 语法通过，`__doc` / `__ai_view` 标记齐全，运行时范围旧后缀 0 残留。
- 项目 `verify-rebuild.cjs`、`smoke.cjs`（无头 Chrome）通过：设计数据一致、壳同源、控制台零报错、`ProtoAPI.exportAI()` 可用。
- `tools/check-wording.mjs` PASS，0 命中。

### 升级方式

旧 `.prototype.html` 产物仍可作为普通 HTML 打开，但编辑器保存会落成 `.chao.html`。建议批量重命名后继续编辑；无 `-o` 编译默认即新后缀。

---

## 样本壳升级（2026-11-05 · 不升版本）

**发现**：`空白原型.prototype.html`、`选矿设备管理.prototype.html`、live skill `examples/选矿设备管理.prototype.html` 共 3 份仍是旧编辑器壳——静态 AI 块（GUIDE v1.2 / AI-NOTICE / meta / aiHint / `__ai_view`）已事后补嵌，但运行时 `ProtoAPI.exportAI()` 不存在，保存时也会把 AI 块退回旧常量。与红外测温平台此前遇到的壳遗留同源。`validate-doc.mjs` 只校验文档、不校验编辑器壳，因此该问题只能靠浏览器冒烟发现。

**处理**：`tools/regen-aiview.mjs --shell sample.prototype.html <目标>` 只换壳、`__doc` 设计数据原样保留；重建前备份至 `.workbuddy/backup-samples/`。

**验证**：设计数据逐字段一致（忽略刷新的 aiHint）；三份新文件编辑器壳与 master 完全同源；`exportAI()` 由 0→1；浏览器零报错且 `exportAI().doc.aiHint` 可用；`__ai_view` 空白 6 行 / 选矿 927 行（103 条交互）保持；`validate-doc` PASS；门禁 0 命中；连续三次再生字节一致；live skill 选矿示例与仓库版本字节一致。版本号保持 v1.2.2（未改功能）。

**规范补充**：`CONTRIBUTING.md` 提交前检查新增「全部样本的运行时壳」一项，明确静态 AI 块齐全不等于运行时壳最新。

---

## 仓库级文案规范化（2026-11-05 · 不升版本）

定位统一为**自研**：仓库内第三方对标、逆向类措辞全部改为自研体系术语（自研编辑器 / 自研交互基线 / 自研设计系统 / 自研验收基线）。

- **改写范围**：`sample.prototype.html`、`editor-prototype/` 两份同源副本、空白原型、选矿设备管理原型、`tools/regen-aiview.mjs`、`docs/测试验收报告.html`、`README.md`；共 7 个文件 282 处 + 收尾 6 处。
- **live skill 同步**：`scripts/ai-view.mjs`、`SKILL.md`、`assets/`、`examples/` 共 6 个文件 220 处 + 收尾 6 处；AI 场景名统一为「改稿 / 实现界面 / 需求文档」，GUIDE 技术措辞「导出/渲染时」统一。**功能与 GUIDE 结构不变，版本号保持 v1.2.2**。
- **文件整理**：第三方专项调研、以第三方为基准的历史走查、旧版备份、损坏备份移入本地 `archive/`（不删除、不入库）；自研验收报告与演示证据收进 `docs/`。
- **新增**：`CONTRIBUTING.md`（提交规范）、`docs/自研验收基线.md`、`tools/check-wording.mjs`（提交前禁用表述门禁）、`archive/README.md`。
- **冻结策略**：`skill-versions/v*` 与 zip 为发布时点快照，按原样保留、不回溯改写；Git 历史不重写。
- **验证**：门禁 0 命中；`validate-doc` 三份原型 exit=0；三份编辑器壳字节一致；AI 块再生连续两次字节一致且与 master 差异 0；浏览器冒烟控制台零报错。

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
