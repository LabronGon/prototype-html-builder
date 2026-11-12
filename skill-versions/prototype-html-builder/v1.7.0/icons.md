# 图标规范与清单

## 1. 为什么必须是 SVG

原型产物里的图标是 `type:'svg'` 节点，渲染时用 Canvas `Path2D` 填充官方图标路径：

- 矢量：任意缩放不糊，导出 PNG 清晰；
- 可重着色：改 `color` 即整枚图标换色（无需多套切图）；
- 单色路径 + 透明背景：可直接放在按钮、标签栏、列表行里；
- 离线：218 个图标已内嵌在 `template.chao.html` 的 `SVG_ICONS` 注册表，不联网。

禁止用文本符号（`‹` `›` `⋯` `▾` `✓`）或矩形拼图标——它们在缩放、换色、导出时都会失真。

## 2. 命名

```json
{ "type":"icon", "icon":"ep/search" }
```

`{set}/{name}`：

| set | 来源 | 网格 | 风格 |
| --- | --- | --- | --- |
| `ep` | Element Plus Icons（MIT） | 1024 | 线性描边转填充，24px 视觉 |
| `ant` | Ant Design Icons（MIT） | 1024 | 线性/填充，24px 视觉 |

名称一律小写连字符（`ep/arrow-left`、`ant/bar-chart`）。写错会直接编译失败，并提示可用清单。

## 3. 常用清单

### Element Plus（`ep/`，125 个）

- **导航 / 操作**：`arrow-left` `arrow-right` `arrow-up` `arrow-down` `back` `right` `top` `bottom` `d-arrow-left` `d-arrow-right` `menu` `more` `more-filled` `close` `plus` `minus` `check` `select` `finished` `remove` `refresh` `sort` `sort-up` `sort-down` `filter` `switch-button` `full-screen` `zoom-in` `zoom-out` `aim` `crop` `magic-stick` `guide` `compass` `position` `place` `coordinate`
- **状态 / 提示**：`info-filled` `warning` `warning-filled` `success-filled` `circle-check` `circle-close` `circle-plus` `question-filled` `star` `star-filled` `trophy` `medal` `rank` `stamp` `umbrella`
- **文件 / 数据**：`document` `document-copy` `copy-document` `folder` `folder-opened` `files` `data-line` `data-analysis` `trend-charts` `histogram` `pie-chart` `list` `grid` `tickets` `notebook` `memo` `collection` `operation` `management` `platform`
- **设备 / 工业**：`monitor` `cpu` `connection` `tools` `setting` `key` `lock` `unlock` `link` `share` `lightning` `sunny` `moon` `alarm-clock` `clock` `timer` `calendar`
- **用户 / 社交**：`user` `avatar` `phone` `message` `chat-dot-square` `chat-line-square` `bell` `service` `headset` `present` `promotion` `discount` `shopping-cart` `goods` `money` `wallet` `credit-card`
- **媒体 / 其他**：`picture` `picture-filled` `camera` `video-play` `video-pause` `upload` `upload-filled` `download` `view` `hide` `edit` `edit-pen` `delete` `copy` `document` `office-building` `map-location` `location` `location-filled` `home-filled` `switch-button`

### Ant Design（`ant/`，93 个）

- **通用**：`home` `setting` `user` `search` `plus` `close` `check` `edit` `delete` `bell` `mail` `calendar` `clock-circle` `star` `heart` `camera` `picture` `upload` `download` `eye` `lock` `unlock` `team` `logout` `login` `idcard`
- **方向**：`arrow-up` `arrow-down` `arrow-left` `arrow-right` `left` `right` `down` `up`
- **导航 / 布局**：`menu` `menu-fold` `menu-unfold` `more` `filter` `appstore` `layout` `project` `dashboard` `table` `file` `folder` `file-text` `copy` `export` `import` `printer` `qrcode` `fullscreen` `zoom-in` `zoom-out` `font-size` `align-left` `align-center` `align-right`
- **状态**：`info-circle` `warning` `check-circle` `close-circle` `exclamation-circle` `plus-circle` `minus-circle` `sync` `reload` `link` `phone`
- **图表 / 工业**：`bar-chart` `line-chart` `pie-chart` `radar-chart` `area-chart` `database` `cloud` `cluster` `node-index` `partition` `block` `gateway` `deployment-unit` `build` `tool` `experiment` `safety` `thunderbolt` `fire` `rocket` `bulb` `solution`

> 需要"某图标存在吗"的精确答案：查 `assets/icons.json` 的 `icons` 键，或直接编译——未收录会报错并列出全部可用项。

## 4. 尺寸与配色

| 场景 | 尺寸 | 颜色 |
| --- | --- | --- |
| 标签栏 / 底部导航 | 22–24 | 选中 `brand`，未选 `text4` |
| 导航栏动作 | 20–24 | `text1` |
| 列表行左侧 | 20（容器 40 圆角 8 + `brandBg` 底） | `brand` |
| 行尾箭头 | 14–16 | `text4` |
| 行内状态 / 元信息 | 14–16 | `text3` |
| 按钮内图标 | 16 | 与按钮文字同色 |

光学对齐：图标与文字并排时，图标盒子取 `fontSize` 的整数倍（如 14px 字配 16px 图标），水平间距 4–8px。

## 5. 自定义 SVG 路径

不必扩充图标集，直接给路径：

```json
{ "type":"icon","name":"无人机","size":24,
  "paths":["M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"],
  "ibv":24 }
```

- `paths` 为 `<path d>` 数组；`ibv` 是原始 viewBox 边长（24 / 1024 等），builder 会等比缩放并居中。
- 需要 `fill-rule:evenodd` 的镂空图形，可给 `eo:[0,2]`（对应路径索引）。
- 路径必须是**纯填充**（不要 `stroke`），否则不同缩放级别下线宽不一致。

## 6. 扩充 / 更换图标集

```bash
# 1) 编辑 SETS 里的图标名
# 2) 重新拉取（Iconify API，MIT 许可）
node scripts/fetch-icons.mjs
# 3) 注入编辑器壳
node scripts/embed-icons.mjs --target ../../editor-prototype/index.html
# 4) 重建模板
node scripts/gen-template.mjs
```

`fetch-icons.mjs` 只保留纯 `<path>` 的图标；含 `<circle>`、`<rect>` 等复合图形的图标会被跳过并打印提示。
