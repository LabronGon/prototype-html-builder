# 提交规范

本仓库是**自研**的单文件高保真原型编辑器及其工具链。设计规格、交互规则、验收基线均来自自研设计系统与内部实测，**不以任何第三方产品作为对标对象、规格来源或验收参照**。本规范约束此后所有新增内容与提交。

## 一、定位与措辞

| 应当使用 | 禁止使用 |
| --- | --- |
| 自研编辑器 / 自研交互基线 / 自研设计系统 / 自研验收基线 | 第三方产品品牌名、第三方版本号 |
| 布局与 UI 元素整体效果参考 | 逐像素还原、以第三方界面为基准 |
| 通用设计工具的交互习惯（确有必要时，不得作为规格来源） | 逆向、复刻、1:1 像素、对齐某产品、向某产品靠拢 |

原型产物只向 AI 提供**空间布局与 UI 元素整体效果**（结构 / 层级 / 间距节奏 / 配色 / 状态 / 交互）参考，不是逐像素代码规范。实现必须遵循项目既定开发规范（Vue3 / React 标准组件、组件库与设计系统 Token、路由与状态管理、响应式、可访问性）；母版 / 实例映射到可复用组件 + props/slot；禁止把图层清单逐节点翻译成绝对定位硬编码 DOM/CSS。验收不要求像素 diff = 0。

## 二、目录约定

| 路径 | 内容 | 入库 |
| --- | --- | --- |
| `sample.chao.html` | 编辑器 master（唯一真源） | ✅ |
| `editor-prototype/` | 编辑器壳与同源副本 | ✅ |
| `*.chao.html` | 空白起点、实际设计文档 | ✅ |
| `tools/` | 项目本地工具（AI 块再生、提交门禁） | ✅ |
| `docs/` | 自研验收报告、验收基线、演示证据截图 | ✅ |
| `skill-versions/` | skill 历史版本快照（含 zip） | ✅ 冻结 |
| `README.md` / `CONTRIBUTING.md` | 项目说明与规范 | ✅ |
| `archive/` | 本地过程性 / 历史资料（第三方调研、旧版备份、旧走查报告） | ❌ 已忽略，不删除 |
| `.workbuddy/` / `.playwright-cli/` / `*.bak` / `*.tmp.js` | 会话记忆、自动化产物、临时备份 | ❌ 已忽略 |

> `skill-versions/v*` 是发布时点的快照，**按原样冻结、不回溯改写**；本规范只约束新增内容。Git 历史不重写。

## 三、提交前检查（按顺序执行）

```bash
# 1. 禁用表述扫描，必须 PASS / 0 命中
node tools/check-wording.mjs

# 2. 原型合法性（live skill 脚本）
node ~/.workbuddy/skills/prototype-html-builder/scripts/validate-doc.mjs sample.chao.html

# 3. 复核变更范围，确认 archive/、备份、临时截图未误入
git status --short
```

另需人工确认：

- 壳一致性：master 与 `editor-prototype/` 两份副本的 `PROTOTYPE-AI-GUIDE` / `aiHint` / `#__ai_view` 头部一致。
- 浏览器冒烟：打开 master，控制台零报错，`ProtoAPI.exportAI()` 可用。
- **全部样本的运行时壳**：`空白原型.chao.html`、`选矿设备管理.chao.html`、live skill 的 `assets/` 与 `examples/` 产物，浏览器里 `ProtoAPI.exportAI()` 都必须可用。**静态 AI 块（GUIDE / aiHint / `__ai_view`）齐全 ≠ 运行时壳最新**——旧壳文件也可以被补嵌上新版静态块，两者必须分别验证；发现不一致用 `tools/regen-aiview.mjs --shell sample.chao.html <目标>` 只换壳、保留设计数据。
- 幂等：`tools/regen-aiview.mjs` 连续运行两次，文件字节数不变。

**改了编辑器壳或 AI 指引时必须同步**：

1. `sample.chao.html` → `editor-prototype/index.html` + `editor-prototype/sample.chao.html`
2. 全部 `.chao.html`（用 `tools/regen-aiview.mjs` 再生 AI 块）
3. live skill 的 `scripts/ai-view.mjs` 与 `assets/` / `examples/` 产物
4. 版本号 / CHANGELOG / `skill-versions/` 归档 —— **仅功能变更升版本，纯文案修订不升版本**

## 四、提交信息

```
<类型>：<一句话结论（含影响范围）>
```

类型：`feat` / `fix` / `refactor` / `docs` / `chore` / `test`。一条提交只做一类事；文案清理与功能改动分开提交。

## 五、历史资料处理

- 过程性材料一律放 `archive/`，**本地保留、不删除、不入库**。
- 第三方专项调研、旧版备份、以第三方为基准的走查报告属于历史研究材料，不进入版本库，也不改写为自研表述。
- 若确需引用其中的结论，须重新用自研设计系统术语表述后写入 `docs/`。

## 六、双仓库同步

| remote | 地址 | 用途 |
| --- | --- | --- |
| `origin` | `https://gitcode.com/Gon7/prototype.html` | 主仓库 |
| `github` | `https://github.com/LabronGon/prototype-html-builder` | 公开镜像 |

每次提交后**两边都要推**，避免两侧分叉：

```bash
# GitCode：清掉环境代理直连
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  git -c http.proxy= -c https.proxy= push origin main

# GitHub：走本机 7892 代理（直连会被拦截）
git -c http.proxy=http://127.0.0.1:7892 -c https.proxy=http://127.0.0.1:7892 push github main
```

> 2026-11-05 首次镜像时，GitHub 原有 `main` 是另一条分叉历史（宣传页 / 微信文章 / 旧版 Skill 打包），已先备份为远程分支 `backup/main-20261105`（`6ceb8a9`），再以 `--force-with-lease` 覆盖 `main`。需要旧物料时从该分支取回。
