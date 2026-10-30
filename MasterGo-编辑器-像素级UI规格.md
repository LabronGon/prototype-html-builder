# MasterGo 编辑器 · 像素级 UI 复刻规格

> 目标：用「原生 HTML + Canvas」在 100% 缩放下 1:1 复刻 MasterGo 1.12.2 编辑器界面。
> 方法：Electron 云端编辑器运行期注入探针（`getBoundingClientRect` + `getComputedStyle`）+ CDP 分区域 3× 截图 + 像素采样。
> 基准视口：**1440 × 900 CSS px**（通过 `Emulation.setDeviceMetricsOverride` 固定，排除窗口抖动）。
> 证据截图：`screenshots/px-00-full-1440x900.png`（全图）、`px-01`~`px-10`（分区 3× 放大）。
> 标记：**【实测】**= 运行期直接读取；**【推断】**= 由实测推导、复刻时可自定。

---

## 0. 读数注意事项（必看）

1. 测量时浏览器页面缩放为 **150%**，因此 1px 边框在 `getComputedStyle` 中显示为 `0.666667px`（Chrome 把发丝线吸附到 1 个设备像素）。**CSS 里写 1px 即可**，不要写 0.667px。
2. 因此左栏实测 `281.333 = 282 − 0.667`：设计值是 **282px 宽 + 1px 右边框**。
3. 所有数值均已折算为 1440×900 下的 CSS px，可直接照抄。
4. 面板宽度是**固定值**（左 282 / 右 252），只有画布区是弹性宽度：`画布宽 = 视口宽 − 282 − 252`。在 846px 窄窗下实测画布正好 312px，验证了该公式。

---

## 1. 设计 Token 表

### 1.1 颜色【实测，按出现频次排序】

| Token | 值 | 用途 |
|---|---|---|
| `--text-primary` | `rgba(0,0,0,0.85)` | 正文、图层名、面板值 |
| `--text-strong` | `rgba(0,0,0,0.93)` | 选中态页签/页面、当前图层名 |
| `--text-secondary` | `rgba(0,0,0,0.5)` | 未选中页签、团队名、辅助说明 |
| `--text-tertiary` | `rgba(0,0,0,0.33)` | 输入框 placeholder |
| `--text-disabled` | `rgba(0,0,0,0.25)` | 禁用图标 |
| `--brand` | `rgb(54,112,247)` `#3670F7` | 分享按钮、当前工具、选中框 |
| `--brand-ai` | `rgb(54,98,236)` `#3662EC` | AI 相关按钮/图标（出现 29 次） |
| `--brand-ai-weak` | `rgba(47,99,246,0.08)` | AI 卡片浅底、AI 徽标底 |
| `--bg-panel` | `#FAFAFA` | 顶栏、左右面板底色 |
| `--bg-canvas` | `#EFEFEF` | 画布底色（像素采样确认） |
| `--bg-card` | `#FFFFFF` | 弹窗、色卡、悬浮面板 |
| `--fill-weak` | `rgba(0,0,0,0.06)` | 搜索框填充、拖拽手柄 |
| `--fill-hover` | `rgba(0,0,0,0.08)` | 图标按钮 hover 底 |
| `--line` | `rgba(0,0,0,0.06)` | 面板/控件描边 |
| `--line-soft` | `#EFEFEF` | 面板间分隔（实现为 inset 阴影） |

**实测到的边框组合**：`1px solid rgba(0,0,0,0.04)`（53 次）、`1px solid rgba(0,0,0,0.06)`（30 次）、`#EFEFEF` 1px（分隔线）。

**面板分隔线不是 border 而是 inset 阴影**：
```css
.left-bar   { box-shadow: inset -1px 0 0 #EFEFEF; }  /* 实测：rgb(239,239,239) -1px 0 0 inset */
.right-panel{ box-shadow: inset  1px 0 0 #EFEFEF; }  /* 实测：rgb(239,239,239)  1px 0 0 inset */
```

### 1.2 字体【实测】

```css
font-family: Inter, "Apple System", "SF Pro SC", "SF Pro Display", "Helvetica Neue",
             Arial, "PingFang SC", "Hiragino Sans GB", STHeiti, "Microsoft YaHei",
             "Microsoft JhengHei", "Source Han Sans SC", "Noto Sans CJK SC",
             "Source Han Sans CN", sans-serif;
```

| 层级 | size / weight / line-height | 使用位置 |
|---|---|---|
| 顶栏标题 | `13px / 600 / 23.4px`（1.8） | 团队名、文件名 |
| 标准 UI | `12px / 500 / 21.6px`（1.8） | 页签、页面名、菜单项 |
| 强调 UI | `12px / 600` | 当前页签、当前页面、面板标题、按钮 |
| 图层名 | `12px / 500 / 28px` | 图层行（行高撑满 30px 行） |
| 面板数值 | `12px / 600` | 尺寸/颜色等数值 |
| AI 大标题 | `36px / 800 / 1.2` | 快搭首页标题（AI 文档另述） |

> 字号分布实测：12px×31、13px×5、14px×5、15px×2、19px×1、22px×1、36px×1。UI 主体就是 12px。

### 1.3 圆角 / 间距 / 阴影【实测】

| Token | 值 | 用途 |
|---|---|---|
| `--r-sm` | `6px` | 按钮、图标按钮、页签容器、输入框、页面行（40 次） |
| `--r-md` | `8px` | 插件坞、插件图标块（18 次） |
| `--r-lg` | `10px` | 大弹窗（9 次） |
| `--r-xl` | `18px` | 快搭卡片 |
| `--r-pill` | `999px` | 胶囊按钮、模式开关（20 次） |
| 头像 | `50%` | — |

| 间距 | 值 |
|---|---|
| 顶栏左右内边距 | `12px / 16px` |
| 顶栏组间距 | `16px` |
| 工具栏按钮间距 | `4px` |
| 面板左右内边距 | 左栏 `6px`；右栏 `12px 左 / 6px 右` |
| 行高 | 页面行 / 图层行 / 面板行 = **30px** |
| 页签行 | **42px** |
| 顶栏 | **48px** |

阴影：
```css
--shadow-modal: 0 10px 24px rgba(0,0,0,0.20);   /* 快搭弹窗 */
--shadow-pop:   0 2px 4px rgba(0,0,0,0.16);     /* 下拉/浮层 */
--shadow-ai:    0 12px 28px rgba(47,99,246,0.08);
```

---

## 2. 整页布局（1440 × 900）

```
┌───────────────────────────────────────────────────────────────────────────────┐ y=0
│ 顶栏 nav_container  h=48  bg=#FAFAFA                                        │
│ [☰30] [团队名 / 文件名 ▾]          [工具组 555px 居中]        [头像][分享][开关][▶][18%▾] │
├──────────────┬────────────────────────────────────────────────┬───────────────┤ y=48
│ 左栏 282px   │  画布区 canvas 906×852                        │ 右栏 252px    │
│              │                                                │ x=1188        │
│ 页签 42      │  ┌──────────────┐                 ┌─────────┐  │ 页签 42       │
│ 页面头 42    │  │  画板 1440×1024│                 │插件坞 56 │  │ 设计/原型/标注│
│ 页面树 490   │  │  (18% 缩放)  │                 │  x=1120  │  │ 属性区        │
│──────────────│  └──────────────┘                 └─────────┘  │               │
│ 分拖条 6     │                                                │               │
│ 图层区 278   │                                                │ 帮助? 32      │
│  搜索 42     │                                                │ x=1390,y=850  │
│  图层列表    │                                                │               │
└──────────────┴────────────────────────────────────────────────┴───────────────┘ y=900
```

| 区域 | 位置/尺寸【实测】 | 说明 |
|---|---|---|
| `nav_container` | `0,0 1440×48` | `display:grid`，`padding:0 16px 0 12px`，`gap:16px`，bg `#FAFAFA` |
| `left-bar` | `0,48 282×852` | 固定宽 282，`border-right:1px`（渲染 0.667） |
| `middle_container` | `282,48 906×852` | 含画布 + 插件坞 |
| `right__container--box` | `1188,48 252×852` | 固定宽 252 |
| 主画布 `<canvas>` | `282,48 906×852` | 铺满 middle_container |
| `plugin-dock` | `1120,70 56×598` | 距画布右边缘 68px，距顶 70px |
| `help-icons-wrap` | `1390,850 32×32` | 视口右下角内缩 50px |

---

## 3. 顶栏（48px）

### 3.1 左边组（`nav_menu`，x=12 起，宽 412.5）

| 元素 | 实测 | 规格 |
|---|---|---|
| 主菜单按钮 `nav_menu_svg` | `12,9 30×30` | 圆角 6，图标 **20×20**（汉堡），hover 底 `rgba(0,0,0,0.08)` |
| 文件信息 `file-info` | `48,4 224×40` | 水平 flex，`margin:0 16px 0 6px` |
| 团队名 `.name` | `48,12.3 81×23.4` | `13px/600`，色 `rgba(0,0,0,0.5)`，右侧 `padding-right:3px` |
| 团队下拉箭头 | `129,18 12×12` | 路径宽 5.2×9.3 的右向 chevron，色 0.85 |
| 分隔符 `/` | 约 x=144 | 【推断】`13px` 色 `rgba(0,0,0,0.25)`，左右各 3px 内边距 |
| 文件名 `.file-name` | `144,12.3 104×23.4` | `13px/600`，色 `rgba(0,0,0,0.85)`，超长省略 |
| 文件下拉 `v-popover` | `248,4 24×40` | 触发器 24×40；内部箭头 21×16（`file_button`） |

> 左列宽 412.5 是 grid 单元格，不是内容宽；内容实际止于 x≈272。

### 3.2 中间工具组（`toolbar-container`，555×32，居中 y=8）

外层：`display:grid; gap:4px; align-items:center`。**起点 x=440.5，终点 995.5**（视口中心 720，工具组中心 718，存在 **−2px** 偏移，复刻时用 `left:50%; translateX(-50%)` 再 `margin-left:-2px`）。

| # | 元素 | x | 尺寸 | 说明 |
|---|---|---|---|---|
| 1 | 选择/移动（active） | 440.5 | 32×32 | bg `#3670F7`，图标白 16，圆角 6 |
| 2 | 画板 F | 476.5 | 32×32 | 图标 16 |
| 3 | 矩形 | 512.5 | 32×32 | |
| 4 | 文本 T | 548.5 | 32×32 | |
| 5 | 文本段落 | 584.5 | 32×32 | |
| 6 | 椭圆 | 620.5 | 32×32 | |
| 7 | 插件 `mas-plugin-entry` | 656.5 | **30×30** | 拼图图标 |
| 8 | AI `mas-ai-entry` | 690.5 | 32×32 | 蓝色 A 标 |
| 9 | 研发模式 `ic-entry` | 726.5 | 32×32 | 立方体图标 |
| 10 | 分隔线 | 770.5 | **1×16** | `margin:0 8px`，色 `rgba(0,0,0,0.12)` |
| 11-16 | 组件/复制/连线/蒙版/链接/切片 | 783.5 → 963.5 | 32×32 ×6 | 未选中时禁用态，图标色 0.25~0.35 |

**工具按钮通用样式【实测】**
```css
.tool-btn{
  width:32px;height:32px;border-radius:6px;
  display:flex;align-items:center;justify-content:center;
  color:rgba(0,0,0,0.85);
  background:transparent;
}
.tool-btn:hover{background:rgba(0,0,0,0.08);}
.tool-btn.active{background:#3670F7;color:#fff;}
.tool-btn svg{width:16px;height:16px;}
```

### 3.3 右边组（右边界 1424，内缩 16）

| 元素 | 实测 | 规格 |
|---|---|---|
| 协作者头像 `user_list` | `1124.3,9 31.3×31.3` | 圆形 32，底色取用户名首字母；右下在线点 10px，2px 白描边 |
| 分享按钮 `m-button--highlight` | `1194,9 48×30` | bg `#3670F7`，白字 `12px/600`，圆角 **6**，无边框无阴影 |
| 开发模式开关 | `1246,9 48×30` | 轨道 bg `#E6E6E6`，圆角 **16**；滑块 24×24 白色圆（radius 122），内含 `</>` 16px；距左 3px |
| 播放（原型演示） | 图标 16，中心 x≈1330 | 透明按钮 |
| 缩放下拉 `resize` | `1354,8 70×32` | 文案 `18%` `12px/500`，右侧 8px chevron；无背景 |
| 帮助 `?` | `1390,850 32×32` | 圆形按钮 28，白底/浅描边，浮于画布右下 |

> 顶栏右侧**没有**「分享」文案以外的按钮；缩放只在顶栏出现，底部无状态栏。

---

## 4. 左栏（282px）

### 4.1 页签行（42px，y=48）

| 元素 | 实测 | 规格 |
|---|---|---|
| `tab_bar` | `0,48 281.3×42` | `padding:0 6px`，底边无边框 |
| `tab_container` | `6,54 84×30` | flex，`gap:12px`，`align-items:center` |
| 页签「图层」 | `6,58.2 36×21.6` | `padding:0 6px`，`12px/600`，选中色 `rgba(0,0,0,0.93)` |
| 页签「资源」 | `54,58.2 36×21.6` | 未选中色 `rgba(0,0,0,0.5)` |
| 右上通知按钮 | `245.3,54 30×30` | 图标 16，红点 6px 置右上（偏移 2,2） |

> 页签**没有**下划线指示器，仅靠字重 + 颜色区分。

### 4.2 页面区头部（42px，y=90）

| 元素 | 实测 | 规格 |
|---|---|---|
| `page_top_bar` | `0,90 281.3×42` | `padding:0 6px 0 12px` |
| 标题「页面」 | `12,100.2 24×21.6` | `12px/500`，色 0.85 |
| 页面色标按钮 | `125.3,96 30×30` | 圆角 6，图标 16 |
| 搜索 | `155.3,96 30×30` | 图标 16 |
| 排序 | `185.3,96 30×30` | 图标 16 |
| 新建页面 `left__add_page` | `215.3,96 30×30` | 图标 16 |
| 折叠 | `245.3,96 30×30` | 图标 16 |

图标按钮 hover 背景 `rgba(0,0,0,0.08)`，圆角 6。

### 4.3 页面树（固定高 490，y=132）

行规格【实测】：

```css
.page-row{
  height:30px;margin:0 6px;width:269.3px;border-radius:6px;
  display:flex;align-items:center;
  font-size:12px;line-height:18px;font-weight:500;
  color:rgba(0,0,0,0.85);
}
.page-row:hover{background:rgba(0,0,0,0.06);}
.page-row.active{font-weight:600;color:rgba(0,0,0,0.93);} /* 实测：仅加粗+加深，无背景 */
.page-row .caret{width:14px;height:14px;margin-left:17px;}  /* 每级 +18px */
.page-row .label{margin-left:3px;padding-right:6px;}
```

| 层级 | 展开箭头 x | 文本 x | 说明 |
|---|---|---|---|
| L0 | 28（`padding-left:17`） | 42 | 分组根 |
| L1 | 46 | 60 | +18 |
| L2 | 64 | 78 | +18 |

- 展开箭头：14×14，色 `rgba(0,0,0,0.57)`；展开后旋转 90°（实测展开态路径尺寸 8.9×6.2）。
- **页面行没有页面缩略图/图标**，只有箭头 + 文本。
- 当前页行：文本 `600` 权重、色 `rgba(0,0,0,0.93)`，**背景透明**（实测 `background-color: rgba(0,0,0,0)`）。

### 4.4 分拖条（6px，y=616）

`left-bar__middle_line` 281.3×6，透明；hover 时中间出现 1px 高亮线（`rgba(0,0,0,0.12)`）；拖动改变「页面树 / 图层」高度比例。页面树默认固定 **490**，图层区吃剩余高度。

### 4.5 图层区（剩余 278，y=622）

| 元素 | 实测 | 规格 |
|---|---|---|
| 搜索行 `layer_search--layout` | `0,622 281.3×42` | 上下留 6px |
| 搜索框 `layer_search--box` | `6,628 269.3×30` | 圆角 6，bg `rgba(0,0,0,0.06)`，无边框 |
| 输入框 | 内左留 12，右侧 39px 多选器 | `12px`，placeholder 色 `rgba(0,0,0,0.33)`，文案「搜索图层...」 |
| 图层列表 | `0,664 281.3×236` | 可滚动，滚动条 8px |

图层行【实测】：

```css
.layer-row{
  height:30px;margin:0 8px;width:265.3px;border-radius:6px;
  font-size:12px;line-height:28px;font-weight:500;
  color:rgba(0,0,0,0.93);
}
.layer-row:hover{background:rgba(0,0,0,0.06);}
.layer-row .caret{width:18px;height:18px;margin-left:1px;}   /* 内部 svg 12×12 */
.layer-row .type-icon{width:14px;height:14px;margin-left:12px;}
.layer-row .name{margin-left:3px;padding-left:3px;}
```

- 行内 x：箭头 9，类型图标 30，文字 50。
- 悬停时右侧出现显示/锁定图标按钮（24×24）【推断：DOM 中对应节点仅在 hover 时插入】。

---

## 5. 右栏（252px）

### 5.1 页签行（42px）

| 元素 | 实测 | 规格 |
|---|---|---|
| `tab_bar` | `1188,48 252×42` | `padding:0 12px 0 6px` |
| 「设计」 | `1194,48 36×42` | `padding:0 6px`，`12px/600`，色 0.93 |
| 「原型」 | `1242,48 36×42` | 色 `rgba(0,0,0,0.5)` |
| 「标注」 | `1290,48 36×42` | 色 `rgba(0,0,0,0.5)` |

> 同样**无下划线**，仅字重+颜色。页签水平间距 12px（48px 节距）。

### 5.2 面板容器

```css
.panel_container{
  position:absolute; left:1188px; top:90px; width:252px;
  padding:0 6px 90px 12px;   /* 内容区 1200..1434，宽 234 */
}
.panel-wrap{
  padding:12px 0;
  border-bottom:1px solid rgba(0,0,0,0.04);
}
```

内容区宽度 **234px**，底部留 90px 给快捷键提示。

### 5.3 无选中时的页面属性（实测顺序与尺寸）

| 区块 | 高度 | 内容 |
|---|---|---|
| 封面 | `158`（132 图 + 26 文案行） | 缩略图 **234×132**，`object-fit:cover`，**直角无圆角/无边框/无阴影**；下方右对齐「如何设置封面」`12px/600` 色 0.5，x=1362,y=242 |
| 变量管理 | 行 30 + 上下 12 | 左标题 `12px/600` 色 0.85；右侧 2 个图标（16、20） |
| 画布背景色 | 行 30 | 右侧「+」20px，色 0.5 |
| 标签 | 行 30 + 色点行 24 | 标签色点 7 个：`24×24` 容器 + `padding:5px` → 内圆 **14×14**，**节距 34.2px（间隙 10.2）**；色依次为 蓝/靛/绿/橙红/橙/紫/灰 |
| 导出 | 行 30 | 右侧「◱」「+」两个图标 |

**行样式**
```css
.panel-row{height:30px;display:flex;align-items:center;justify-content:space-between;}
.panel-row .label{font-size:12px;font-weight:600;color:rgba(0,0,0,0.85);}
.panel-row .icon{color:rgba(0,0,0,0.5);}
```

### 5.4 选中对象时的面板分组（【实测】字段来源，布局同构）

`设计`：圆角 → 自动布局 → 约束/固定 → 图层 → 填充 → 描边 → 特效 → 导出
`原型`：交互（`+` 添加）→ 固定行为
`标注`：位置 X/Y → 尺寸 W/H → 混合模式 → 内边距 → 描边 → 风格 → **代码（自动生成 CSS）** → 导出

每个分组都是 `panel-wrap`（`padding:12px 0` + 底部分隔线 1px），组标题 12/600，字段行 30px，输入框 30px 高、圆角 6、bg `rgba(0,0,0,0.06)`、数值 12/600 居中。

---

## 6. 画布区与插件坞

### 6.1 画布

| 项 | 实测/规格 |
|---|---|
| 区域 | `282,48 906×852` |
| 底色 | `#EFEFEF`（像素采样 `#EFEFEF`） |
| 画板 | 白色 `#FFFFFF`，位置随缩放/平移；当前文件画板 1440×1024，缩放 18% → 屏幕 259×184 |
| 画板标签 | 画板上方 4px，`12px`，色 `rgba(0,0,0,0.5)`；选中时 `#3670F7` |
| 画板阴影 | 【推断】`0 2px 10px rgba(0,0,0,0.12)`（Canvas 绘制，非 DOM） |
| 选中框 | 【推断】2px 实线 `#3670F7` + 8 个 8×8 白色方块控制点（1px 蓝描边） |
| 测距/吸附线 | 【推断】1px `#F24E8A` 线与 4px 圆点 |
| 滚动条 | 水平/垂直 8px，thumb `rgba(0,0,0,0.2)`，轨道透明 |
| 缩放 | 顶栏读数 `18%`；`Ctrl+滚轮` 以指针为锚点 |

### 6.2 插件坞（右侧浮动轨道）

```css
.plugin-dock{
  position:absolute; right:68px; top:22px;   /* 画布坐标：1440 下为 1120,70 */
  width:56px; height:598px;                  /* 高度 = 6 + 11×44 + handle 区 */
  background:rgba(255,255,255,0.5);
  backdrop-filter:blur(12px);                /* 【推断】半透明白底配模糊 */
  border-radius:8px;
  box-shadow:0 2px 12px rgba(0,0,0,0.06);    /* 【推断】 */
  z-index:5;
}
.plugin-scroll-view{padding:0 6px;height:578px;overflow:hidden;}
.plugin-box{width:44px;height:44px;padding:6px;}       /* 无间距，节距 44 */
.plugin-item{
  width:32px;height:32px;border-radius:8px;
  border:1px solid rgba(0,0,0,0.06);
  background-size:cover;
}
.plugin-dock__handle{
  width:20px;height:4px;border-radius:2px;
  background:rgba(0,0,0,0.06);
  margin:0 auto;                             /* 距底 8px */
}
```

- 实测 11 个插件位（44px 节距，从 y=76 到 y=560），第 12 个位置是拖拽手柄（y=660）。
- 图标均为 32×32 位图（`.plugin-item` 背景图），非 SVG。

### 6.3 帮助按钮

`32×32`，位于 `1390,850`（右下内缩 50px），白色圆形 + 1px `rgba(0,0,0,0.06)` 描边，`?` 16px。

---

## 7. 状态与交互规格【实测 + 推断】

| 状态 | 规格 |
|---|---|
| hover（图标按钮） | `background:rgba(0,0,0,0.08)`，圆角 6，过渡 `.12s ease` |
| hover（列表行） | `background:rgba(0,0,0,0.06)`，圆角 6 |
| active（工具） | `background:#3670F7`，图标与文字白 |
| selected（页面） | 仅字重 `600` + 文字 0.93，**无背景**（实测） |
| selected（图层） | 行内文字 0.93；选中背景 `rgba(0,0,0,0.06)`【推断】 |
| focus（输入框） | 1px `#3670F7` 内描边，bg 转白 |
| disabled | `opacity:.35`，`cursor:default` |
| 菜单/浮层 | 白底，圆角 6，`0 2px 4px rgba(0,0,0,0.16)`，内边距 4，行高 30，行 `12px/500` |
| 弹窗 | 白底，圆角 10，`0 10px 24px rgba(0,0,0,0.2)`，遮罩 `rgba(0,0,0,0.32)` |

指针状态机（画布）：

```
idle →(按下命中)→ pressing →(位移>3px)→ dragging →(松开)→ selected
idle →(按下空白)→ marquee →(松开)→ selected(多选)
Space/中键 → panning；Ctrl+滚轮 → zooming(指针锚点)
双击文本 → DOM 覆盖层编辑（textarea 绝对定位，退出回写 TEXT 节点）
```

---

## 8. 可直接落地的 HTML/CSS 骨架

```html
<div class="app">
  <header class="nav">
    <div class="nav-left">
      <button class="icon-btn menu">…</button>
      <div class="file-info">
        <span class="team">智慧选矿系统</span><span class="sep">/</span>
        <span class="file">矿山智慧监管平台</span>
        <button class="file-chevron">…</button>
      </div>
    </div>
    <div class="nav-tools">  <!-- 555px，绝对居中 -2px -->
      <button class="tool-btn active">…</button> ×6
      <button class="tool-btn sm">…</button>
      <button class="tool-btn ai">…</button>
      <button class="tool-btn">…</button>
      <i class="divider"></i>
      <button class="tool-btn" disabled>…</button> ×6
    </div>
    <div class="nav-right">
      <span class="avatar">L</span>
      <button class="btn-primary">分享</button>
      <button class="switch"><i></i></button>
      <button class="icon-btn play">…</button>
      <button class="zoom">18% <i class="chev"></i></button>
    </div>
  </header>
  <div class="body">
    <aside class="left">
      <div class="tabbar">…</div>
      <div class="page-head">…</div>
      <div class="page-tree">…</div>
      <div class="splitter"></div>
      <div class="layers">
        <div class="search"><input placeholder="搜索图层..."></div>
        <div class="layer-list">…</div>
      </div>
    </aside>
    <main class="canvas-wrap">
      <canvas id="stage"></canvas>
      <div class="plugin-dock">…</div>
      <button class="help">?</button>
    </main>
    <aside class="right">
      <div class="tabbar">…</div>
      <div class="panel">…</div>
    </aside>
  </div>
</div>
```

```css
:root{
  --brand:#3670F7; --bg-panel:#FAFAFA; --bg-canvas:#EFEFEF;
  --text-1:rgba(0,0,0,.85); --text-2:rgba(0,0,0,.5);
  --line:#EFEFEF; --fill:rgba(0,0,0,.06); --hover:rgba(0,0,0,.08);
  --r-sm:6px; --r-md:8px; --nav-h:48px; --tab-h:42px; --row-h:30px;
}
html,body{margin:0;height:100%;overflow:hidden;
  font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif;
  font-size:12px;line-height:1.8;color:var(--text-1);}
.app{display:flex;flex-direction:column;height:100vh;}
.nav{height:48px;background:var(--bg-panel);display:flex;align-items:center;
  padding:0 16px 0 12px;gap:16px;}
.nav-tools{position:absolute;left:50%;transform:translateX(-50%);margin-left:-2px;
  display:grid;grid-auto-flow:column;gap:4px;align-items:center;}
.body{flex:1;display:flex;min-height:0;position:relative;}
.left{width:282px;background:var(--bg-panel);box-shadow:inset -1px 0 0 var(--line);
  display:flex;flex-direction:column;}
.right{width:252px;background:var(--bg-panel);box-shadow:inset 1px 0 0 var(--line);}
.canvas-wrap{flex:1;position:relative;background:var(--bg-canvas);min-width:0;}
.canvas-wrap canvas{display:block;width:100%;height:100%;}
```

> 画布容器宽度必须能压到 0（`min-width:0`），否则窄窗时布局会撑破——实测 846px 宽时画布正好 312px。

---

## 9. 复刻验收清单（逐项对比截图）

- [ ] 顶栏 48px，工具组 555px 且中心比视口中心左偏 2px
- [ ] 工具按钮 32×32 / 间距 4 / 圆角 6 / 图标 16；插件入口 30×30
- [ ] 左栏 282px，页签行 42px，页签 36×21.6，无下划线
- [ ] 页面树视口固定 490px，行 30px，左右外边距 6px，圆角 6，层级缩进 18px
- [ ] 图层行 30px，外边距 8px，箭头 18、图标 14、文字 x=50
- [ ] 搜索框 269.3×30，圆角 6，填充 `rgba(0,0,0,0.06)`
- [ ] 右栏 252px，内容区 234px（左 12 / 右 6）
- [ ] 面板行 30px，区块上下 12px + 1px `rgba(0,0,0,0.04)` 分隔
- [ ] 色点 24×24 容器 + 14×14 内圆
- [ ] 插件坞 56×598，距画布右 68、距顶 22，条目 44px 节距，图标 32 圆角 8
- [ ] 画布底色 `#EFEFEF`，画板白，选中框 `#3670F7`
- [ ] 分享按钮 48×30 圆角 6 `#3670F7`
- [ ] 面板分隔线用 `inset 0 0 0 #EFEFEF` 而非 border
- [ ] 全站字体 12/13px，行高 1.8，主色透明度 0.85/0.93

---

## 10. 与既有技术拆解文档的关系

- 本文只覆盖**视觉与尺寸**，数据模型、协作协议、快捷键、状态机细节见
  `MasterGo-编辑器与AI快搭-技术拆解.md`。
- 画布渲染（变换矩阵、命中测试、文本编辑覆盖层）沿用该文档第 2、5 章。
- AI 快搭的实现与界面规格见 `MasterGo-AI快搭-实现调研.md`。
