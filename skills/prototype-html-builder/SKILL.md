---
name: prototype-html-builder
description: 生成 .prototype.html 单文件高保真原型（内置自研画布编辑器，纯 Canvas 渲染，零外部依赖）。当用户要求"画原型 / 做高保真原型 / 生成 prototype.html / 移动端或大屏界面原型 / 带交互跳转的原型"时使用。图标一律使用 Element Plus / Ant Design 官方 SVG 路径（矢量、可重着色），组件通过母版 + 实例复用，输出文件可直接在浏览器打开编辑与演示。
---

# Prototype HTML Builder

把一段声明式 JSON 规格编译成 `.prototype.html`：**一个文件 = 编辑器 + 内嵌文档**。用浏览器打开即可编辑、缩放、演示交互，文件本身不依赖任何外部资源（图标已内嵌为矢量路径）。

## 三条硬性约束

1. **图标必须是 SVG**：只能写 `{"type":"icon","icon":"ep/search"}`（或 `ant/home`）。渲染走 Canvas `Path2D`，矢量、可重新着色；禁止用文本符号（`‹ › ⋯ ▾ ✓`）或矩形拼图标。
2. **组件必须复用**：重复出现的 UI（导航栏、标签栏、卡片、列表行…）用 `{"type":"instance","comp":"navbar"}` 引用母版，只通过 `overrides` 改文案/颜色/图标。不要复制粘贴同一棵节点树。
3. **遵循 Element Plus / Ant Design 规范**：颜色、字号、间距、圆角、控件高度取自 `assets/design-kit.json`（见 `references/design-system.md`）。

## 工作流

> 命令在 skill 根目录（本 SKILL.md 所在目录）执行；也可用脚本的绝对路径从任意目录调用。

```bash
# 1) 写规格（参考 references/spec.md 与 examples/demo-spec.json）
# 2) 编译
node scripts/build-prototype.mjs spec.json -o out.prototype.html
# 3) 校验（图标存在性 / id 唯一 / 交互目标 / 实例完整性）
node scripts/validate-doc.mjs out.prototype.html
```

规格里 `name` 决定默认输出文件名。`--check` 只编译不落盘。

## 最少可用规格

```json
{
  "name": "示例应用",
  "pages": [{
    "name": "首页",
    "artboards": [{
      "name": "首页", "w": 375, "h": 812, "bg": "#F5F7FA",
      "nodes": [
        { "type": "instance", "comp": "navbar", "x": 0, "y": 44,
          "overrides": { "标题": { "text": "我的应用" } } },
        { "type": "icon", "name": "搜索", "icon": "ep/search", "size": 24, "x": 16, "y": 120 },
        { "type": "text", "text": "你好，世界", "x": 16, "y": 160, "fontSize": 20, "fontWeight": 600 }
      ]
    }]
  }]
}
```

## 内置资源

| 资源 | 说明 |
| --- | --- |
| `assets/template.prototype.html` | 编辑器壳（约 486 KB），含 218 个 SVG 图标 + 27 个组件母版 |
| `assets/icons.json` | 图标源数据（`ep` 125 个 / `ant-design` 93 个，1024 网格，MIT） |
| `assets/design-kit.json` | 设计 Token + 内置组件母版（供 builder 重建组件库页） |
| `examples/demo-spec.json` | 可运行的完整示例（设备管理：2 画板 + 自定义组件 + 交互） |

## 文件结构

- 产物 = 编辑器壳 + `<script type="application/json" id="__doc">` 内的文档 JSON。
- 编辑器保存时以原始壳重建文件（`PRISTINE_HTML`），因此**只改 `__doc`，不要改壳**；要升级壳请用 `scripts/gen-template.mjs` 从 `editor-prototype/index.html` 重建模板。
- 打开产物后可继续人工精调；`window.ProtoAPI` 提供 `getDoc/addNode/updateNode/setProto/insertComp/exportPNG` 等同步接口，便于二次自动化。

## 脚本

| 脚本 | 用途 |
| --- | --- |
| `build-prototype.mjs` | 规格 → 原型文件（主入口） |
| `validate-doc.mjs` | 校验已生成文件（CI 友好，退出码 0/1） |
| `gen-template.mjs` | 由编辑器壳重建 `template.prototype.html`（壳升级时用） |
| `fetch-icons.mjs` | 从 Iconify 重新拉取 Element Plus / Ant Design 图标集 |
| `embed-icons.mjs` | 把 `icons.json` 注入编辑器壳的 `SVG_ICONS` 注册表 |
| `upgrade-kit.mjs` | 把 `design-kit.json` 中的伪图标替换为 SVG 图标节点 |

## 详细文档

- `references/spec.md` — 规格 DSL 全字段（页面 / 画板 / 节点 / 交互 / 组件 / 覆盖）
- `references/icons.md` — 图标命名、清单、自定义路径、更换图标集
- `references/design-system.md` — Element Plus / Ant Design 设计 Token 与内置母版覆盖点

## 常见错误

| 报错 | 原因 |
| --- | --- |
| `图标未收录："xx/yy"` | `icon` 名不在 `assets/icons.json`；查 `references/icons.md` 清单 |
| `组件不存在："xxx"` | `comp` 需为母版 id（如 `navbar`）或母版名称（如 `导航栏`） |
| `实例覆盖找不到母版节点："xxx"` | `overrides` 的键必须是母版内节点 `name` |
| `交互目标画板不存在` | `target` 需为画板 `name`（同页优先）或画板 id |
| `节点 id 重复` | 同一规格被手改了 id；删除自定义 `id` 让 builder 自动编号 |
