#!/usr/bin/env node
/**
 * regen-aiview.mjs — 项目本地工具（P35b，2026-11-04）
 *
 * 对 .prototype.html 原地执行三件事（与编辑器 P35b 行为一致）：
 *   1. GUIDE 注释升级到 v1.2（实现约定最高优先：布局/视觉参考 + 开发规范优先，不逐像素硬编码；NOTICE/meta/aiHint/view 头同步）
 *   2. 用修复版生成器再生 #__ai_view：svg 图标 icon=/color=、hidden 标记、text/name/src 用 JSON 字符串字面量（多行/引号/尖括号无损）、数值保留原始精度
 *   3. 向 __doc 注入 aiHint 键（缺则加，不覆盖已有；Agent 只抽 JSON 时也能看到规范入口）
 *
 * 用法：node tools/regen-aiview.mjs <file.prototype.html> [...] [--shell <新版壳.html>]
 *   --shell  用指定编辑器壳重建目标文件（仅替换壳，完整保留其 __doc 设计数据），用于旧壳文件升级
 * 说明：skill 冻结期间的临时工具，逻辑验证后可平移至 skill ai-view.mjs。
 */
import { readFile, writeFile } from 'node:fs/promises';

/* ---------------- GUIDE v1.1（与 master sample.prototype.html 保持同步） ---------------- */
const AI_GUIDE = `<!-- ==================================================================
PROTOTYPE-AI-GUIDE v1.2（静态说明块，保存时随文件保留；勿改动本注释结构）
本文件 = 单文件高保真原型：编辑器脚本 + 内嵌设计文档（script#__doc，JSON）+ AI 视图（script#__ai_view，逐行清单）。
【实现约定（最高优先，先读本段）】
 本原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）的参考，不是逐像素代码规范。
 实现必须遵循项目既定技术栈与开发规范：Vue3/React 等标准组件、组件库与设计系统 Token、路由/状态管理、响应式与可访问性。
 用可复用组件抽象重复 UI（母版/实例 → 组件 + props/slot），禁止把 #__ai_view 逐节点翻译成绝对定位的硬编码 DOM/CSS。
 ai_view 的坐标/尺寸用于理解相对关系与间距节奏，不作强制 CSS 数值；验收 = 布局与视觉整体一致且符合开发规范，不要求像素 diff 为 0。
【给 AI 的读法】
 1) 实现界面 → 读 #__ai_view 获取布局与元素清单（每行一节点，坐标均为「画板局部坐标」）＋ #__doc 获取完整字段；按上文「实现约定」用标准组件实现。
 2) 修改设计稿 → 读 #__doc JSON，按下文「AI 修改约定」输出新文档 JSON（不要重写整个 HTML，编辑器壳必须原样保留）。
 3) 编写需求文档 → 以 #__ai_view 的画板/图层分组与命名为结构依据。
【坐标约定】叶子与组的 x/y 一律相对所在画板左上角；画板自身 x/y 为页面坐标。数值保留原始精度（可能带小数，勿取整）。rotation 单位度、顺时针、绕节点中心。path 的 pts 即画板局部坐标（n.x/y 仅作包围盒参考）。
【节点类型】artboard 画板 | rect 矩形 | text 文本 | image 图片 | line 线 | arrow 箭头 | group 组(容器/组件实例) | path 矢量路径 | ellipse 椭圆 | polygon 多边形(sides) | star 星形(points) | svg 图标(icon=名称 color=着色 paths=自定义路径数) | bool 布尔(op=union/subtract/…)
【显隐】hidden:true 为隐藏节点（默认不渲染，交互/状态切换时可显示）；locked 为锁定。
【文本字段】text 值为 JSON 字符串字面量（含 \\n、\\" 等转义，可 JSON.parse 精确还原原文，多行文本不会断行）；fontSize 字号 fontWeight 字重(400/500/600/700) color 颜色 align 对齐(left/center/right) lineHeight 行高 letterSpacing 字距
【填充 fills】数组自底向上叠加；项为 {type:'solid',color,opacity,on} 或 {type:'linear',angle,stops:[{color,pos,opacity}]} / {type:'radial',stops:[...]}；text 用 color 字段；旧数据回落单值 fill/stroke。
【描边 strokes】{color,width,align:center/inside/outside,style:solid/dashed/dotted,cap,join,on}；旧数据回落 stroke/strokeW/strokeAlign。
【效果 effects】{type:drop/inner/blur/bgblur, on, x,y,blur,color,opacity} 模糊类用 value；旧数据回落 effect.shadow / blur。
【圆角】radius 单值；4 角不同时用 radii:[左上,右上,右下,左下]。
【交互 proto】节点上数组 [{trigger:单击|悬停|按下|拖拽|滚动, dir:方向, action:打开画板|打开弹层|关闭弹层|返回上一页|切换变体, target:目标画板id, variant, anim:过渡动画, duration:ms, easing}]
【组件实例】group + inst:母版画板id + iid；ov:{子节点id:{字段:值}} 为实例级覆盖；导出/渲染时须先用 ov 覆盖母版对应字段再渲染。实现时母版→可复用组件、ov→props/slot，不要复制节点树。
【AI 修改设计稿约定】输出一个与 #__doc 完全同构的 JSON：{version:1,name,theme,pages,tree}（全量最稳）。文档过大(>100KB)时可只输出变更页：[{page:<索引或页名>, artboards:[...]}]，用 apply-doc.mjs 合入或编辑器「打开 JSON」整份载入。禁止改动本注释、编辑器脚本以及两个内嵌 script 标签之外的任何 HTML 内容。
【实现建议】以 #__ai_view 的画板/分组理解页面结构与组件边界；组件实例(inst)对应复用组件；图片用节点 src/fit；颜色/圆角/描边映射到项目设计 Token；以画板宽度作参考视口检查布局层级与对齐，不要求逐像素一致。
================================================================== -->`;

const AI_NOTICE = `<!-- AI-NOTICE（给读取本文件的 AI/Agent，请勿删除）：
  0) 【最高优先·实现约定】本原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）参考，不是逐像素代码规范。实现必须遵循项目既定技术栈与开发规范（Vue3/React 标准组件、组件库与设计系统 Token、路由/状态管理、响应式与可访问性）；用可复用组件抽象重复 UI，禁止把设计清单逐节点翻译成绝对定位的硬编码 DOM/CSS。
  1) 界面实现 → 读 script#__ai_view（逐行布局清单，坐标=画板局部坐标）＋ script#__doc（完整字段），按开发规范用标准组件实现
  2) 修改设计稿 → 不要改 HTML/壳；输出与 #__doc 同构的 JSON（{version:1,name,theme,pages,tree}），用 apply-doc.mjs 合入或编辑器「打开 JSON」载入
  3) 字段字典 / 坐标约定 / 交互 schema / 组件实例映射 → 全文搜索 PROTOTYPE-AI-GUIDE 注释（位于 #__doc 之前）
  4) __doc JSON 内的 aiHint 键是同样的提示（程序化读取用）
  注意：本文件很大，直接从文件中部读起会漏规范；务必先定位 PROTOTYPE-AI-GUIDE 再动手。 -->`;

const META_AI = '<meta name="prototype-ai" content="AI 必读：本原型仅作空间布局与 UI 元素整体效果参考；实现须遵循项目开发规范（Vue3 等标准组件/设计系统 Token），勿逐节点硬编码绝对定位。规范见 PROTOTYPE-AI-GUIDE；#__ai_view 为布局清单；#__doc 为设计 JSON（改稿输出同构 JSON 用 apply-doc.mjs 合入）。">';

const AI_HINT = 'AI 必读：本 JSON 为单文件原型的设计文档。原型仅提供空间布局与 UI 元素整体效果参考；实现须遵循项目既定开发规范（Vue3/React 标准组件、组件库与设计系统 Token、响应式与可访问性），禁止逐节点硬编码绝对定位，重复 UI 应抽象为可复用组件。界面结构→读 script#__ai_view 布局清单；修改设计稿→输出与本 JSON 同构的 {version:1,name,theme,pages,tree}（用 apply-doc.mjs 合入，勿改 HTML）；字段字典/坐标约定/交互 schema→全文搜索 PROTOTYPE-AI-GUIDE 注释。所有叶子/组 x/y 均为画板局部坐标。';

/* ---------------- 修复版生成器（与编辑器 P35b genAIView 同步） ---------------- */
const fillsOf = (n) => !n ? []
  : n.type === 'text' ? (n.color ? [{ color: n.color, opacity: 1, on: true }] : [])
  : Array.isArray(n.fills) ? n.fills
  : (n.fill ? [{ color: n.fill, opacity: 1, on: true }] : []);

const strokesOf = (n) => !n ? []
  : Array.isArray(n.strokes) ? n.strokes
  : (n.stroke ? [{ color: n.stroke, width: n.strokeW ?? 1, align: n.strokeAlign || 'center', style: 'solid', on: true }] : []);

const effectsOf = (n) => Array.isArray(n.effects) ? n.effects
  : [...((n.effect && n.effect.shadow) ? [{ type: 'drop', ...n.effect.shadow }] : []),
     ...(((n.blur || 0) > 0) ? [{ type: 'blur', on: true, value: n.blur }] : [])];

const opStr = (v) => (v != null && v < 1 ? '@' + Math.round(v * 100) + '%' : '');
const gradientStopsOf = (f) => (Array.isArray(f.stops) && f.stops.length >= 2 ? f.stops
  : [{ color: f.color || '#3670F7', pos: 0 }, { color: '#FFFFFF', pos: 1 }])
  .slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));

function fillStr(n) {
  const fs = fillsOf(n).filter((f) => f.on !== false);
  if (!fs.length) return null;
  return fs.map((f) => {
    if (f.type === 'linear' || f.type === 'radial') {
      const st = gradientStopsOf(f).map((s) => s.color + '@' + Math.round((s.pos ?? 0) * 100) + '%').join(' -> ');
      return (f.type === 'linear' ? 'linear(' + (f.angle || 0) + 'deg)' : 'radial') + '(' + st + ')';
    }
    return f.color + opStr(f.opacity);
  }).join(' + ');
}
function strokeStr(n) {
  const ss = strokesOf(n).filter((s) => s.on !== false && s.color);
  if (!ss.length) return null;
  return ss.map((s) => 'stroke=' + s.color + ' w=' + (s.width ?? 1)
    + (s.align && s.align !== 'center' ? ' ' + s.align : '')
    + (s.style && s.style !== 'solid' ? ' ' + s.style : '')).join(' | ');
}
function effectStr(n) {
  const es = effectsOf(n).filter((e) => e.on !== false);
  if (!es.length) return null;
  return es.map((e) => {
    if (e.type === 'blur') return 'blur=' + e.value;
    if (e.type === 'bgblur') return 'bgblur=' + e.value;
    return (e.type === 'inner' ? 'inner-shadow' : 'shadow')
      + '(' + [e.x, e.y, e.blur].map((v) => v ?? 0).join(',') + ' ' + e.color + opStr(e.opacity) + ')';
  }).join(' | ');
}
function protoStr(n) {
  if (!Array.isArray(n.proto) || !n.proto.length) return null;
  return 'proto[' + n.proto.map((p) => {
    let t = (p.trigger || '单击') + ' -> ' + (p.action || '') + ':' + (p.target || '');
    if (p.anim && p.anim !== '无') t += ' anim=' + p.anim;
    if (p.duration) t += ' dur=' + p.duration;
    if (p.easing && p.easing !== 'ease-out') t += ' ease=' + p.easing;
    if (p.variant) t += ' variant=' + p.variant;
    if (p.dir && p.dir !== '任意') t += ' dir=' + p.dir;
    return t;
  }).join('; ') + ']';
}
function commonAttr(n) {
  let s = '';
  if (n.opacity != null && n.opacity < 1) s += ' opacity=' + n.opacity;
  if (n.rotation) s += ' rotate=' + n.rotation;
  if (n.hidden || n.visible === false) s += ' hidden';
  if (n.locked) s += ' locked';
  if (n.clip) s += ' clip';
  const st = strokeStr(n); if (st) s += ' ' + st;
  const ef = effectStr(n); if (ef) s += ' ' + ef;
  const pr = protoStr(n); if (pr) s += ' ' + pr;
  return s;
}
/* 字符串值一律 JSON 字符串字面量（\n/\"/</script 无损转义；\/ 是合法 JSON 转义，等价 /） */
const aiStr = (v) => JSON.stringify(String(v ?? '')).replace(/<\//g, '<\\/');

function nodeLine(n, ind) {
  const t = n.type || 'rect';
  let s = ind + '- ' + t + ' ' + (n.id || '') + (n.name ? ' ' + aiStr(n.name) : '')
    + ' @' + (n.x ?? 0) + ',' + (n.y ?? 0) + ' ' + (n.w ?? 0) + 'x' + (n.h ?? 0);
  if (t === 'text') {
    s += ' text=' + aiStr(n.text)
      + ' font=' + n.fontSize + (n.fontWeight && n.fontWeight !== 400 ? '/' + n.fontWeight : '')
      + ' color=' + (n.color || '#000000');
    if (n.align) s += ' align=' + n.align;
    if (n.lineHeight) s += ' lh=' + n.lineHeight;
    if (n.letterSpacing) s += ' ls=' + n.letterSpacing;
    if (n.bg) s += ' bg=' + n.bg;
  } else if (t === 'svg') {
    s += ' icon=' + (n.icon || ('(paths:' + (n.paths || []).length + ')')) + ' color=' + (n.color || '#000000');
  } else if (t === 'arrow') {
    s += ' color=' + (n.stroke || '#000000') + ' w=' + (n.strokeW ?? 1) + ' dir=' + (n.dir || '\\');
  } else if (t === 'path') {
    const f = fillStr(n); if (f) s += ' fill=' + f;
    s += ' closed=' + (n.closed ? '1' : '0')
      + ' pts=[' + (n.pts || []).map((p) => p.x + ',' + p.y).join(' ') + ' ]';
  } else if (t === 'ellipse' || t === 'polygon' || t === 'star') {
    const f = fillStr(n); if (f) s += ' fill=' + f;
    if (t === 'polygon' && n.sides) s += ' sides=' + n.sides;
    if (t === 'star' && n.points) s += ' points=' + n.points;
  } else if (t === 'line') {
    s += ' color=' + (n.color || n.stroke || '#000000') + ' w=' + (n.strokeW ?? n.width ?? 1);
  } else if (t === 'image') {
    s += ' src=' + aiStr(n.src) + (n.fit ? ' fit=' + n.fit : '');
  } else { // rect / artboard / bool / 其他矩形语义
    const f = fillStr(n); if (f) s += ' fill=' + f;
    if (n.op) s += ' op=' + n.op;
    if (n.bg && t === 'artboard') s += ' bg=' + n.bg;
    if (n.radius) s += ' r=' + n.radius;
    else if (Array.isArray(n.radii)) s += ' r=[' + n.radii.join(',') + ']';
    else if (Array.isArray(n.rc)) s += ' r=[' + n.rc.join(',') + ']';
  }
  if (t === 'group' && n.inst) s += ' [INSTANCE of ' + n.inst + (n.iid ? ' iid=' + n.iid : '') + ']';
  s += commonAttr(n);
  return s;
}
function walk(n, ind, out) {
  out.push(nodeLine(n, ind));
  if (Array.isArray(n.children)) n.children.forEach((c) => walk(c, ind + '  ', out));
  if (n.ov && typeof n.ov === 'object') {
    for (const [k, o] of Object.entries(n.ov)) {
      if (!o || !Object.keys(o).length) continue;
      out.push(ind + '    override ' + k + ': ' + Object.entries(o).map(([f, v]) => f + '=' + JSON.stringify(v)).join(', '));
    }
  }
}
function genAIViewDoc(doc, docTitle) {
  const out = [];
  out.push('# AI-VIEW 设计清单（自动生成，勿手改；再生：编辑器保存或 regen-aiview.mjs）');
  out.push('# 用途：空间布局与 UI 元素整体效果参考；实现须遵循项目开发规范（Vue3 标准组件/设计系统 Token），勿逐节点硬编码绝对定位，母版/实例→可复用组件。');
  if (docTitle) out.push('doc: ' + docTitle);
  ((doc && doc.pages) || []).forEach((p, pi) => {
    out.push('');
    out.push('## page ' + pi + ': ' + (p.name || '页' + (pi + 1)));
    (p.artboards || []).forEach((ab) => {
      out.push('## artboard ' + ab.id + ' "' + (ab.name || '') + '" page=' + (ab.x ?? 0) + ',' + (ab.y ?? 0)
        + ' size=' + (ab.w ?? 0) + 'x' + (ab.h ?? 0) + (ab.bg ? ' bg=' + ab.bg : ''));
      (ab.children || []).forEach((n) => walk(n, '  ', out));
    });
  });
  return out.join('\n');
}

/* ---------------- 主流程 ---------------- */
const DOC_RE = /<script type="application\/json" id="__doc">[\s\S]*?<\/script>/;
const AI_VIEW_BLOCK = (view) => '<script type="text/plain" id="__ai_view">\n' + view + '\n<\/script>';

function processHtml(html, label) {
  const notes = [];
  const dm = DOC_RE.exec(html);
  if (!dm) throw new Error('找不到内嵌 __doc');
  // 1. aiHint 强制刷新到当前版本（保持其余键与顺序）
  let doc;
  try { doc = JSON.parse(dm[0].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')); }
  catch (e) { throw new Error('__doc JSON 解析失败：' + e.message); }
  doc.aiHint = AI_HINT;
  const json = JSON.stringify(doc).replace(/</g, '\\u003c');
  html = html.replace(DOC_RE, () => '<script type="application/json" id="__doc">' + json + '</script>');
  notes.push('aiHint:已刷新');
  // 2. GUIDE 升级 v1.1：先移除全部旧 GUIDE 块（CRLF 兼容、防重复），再统一插到 __doc 前
  const reGuideG = /<!-- =+\r?\nPROTOTYPE-AI-GUIDE[\s\S]*?={20,} *-->[ \t]*\r?\n?/g;
  const hadGuide = reGuideG.test(html);
  if (hadGuide) { html = html.replace(reGuideG, ''); notes.push('GUIDE:v1.2'); }
  if (/<script type="application\/json" id="__doc">/.test(html)) {
    html = html.replace(/<script type="application\/json" id="__doc">/, (m) => AI_GUIDE + '\n' + m);
    if (!hadGuide) notes.push('GUIDE:新插入 v1.2');
  }
  // 3. 头部 meta + AI-NOTICE：移除全部旧版，再统一插到 <head> 后（保证措辞版本一致）
  const reMetaG = /<meta name="prototype-ai"[^>]*>\r?\n?/g;
  const reNoticeG = /<!-- AI-NOTICE[\s\S]*?-->\r?\n?/g;
  html = html.replace(reMetaG, '').replace(reNoticeG, '');
  if (/<head>/.test(html)) {
    html = html.replace(/<head>/, () => '<head>\n' + META_AI + '\n' + AI_NOTICE);
    notes.push('NOTICE/META:v1.2');
  }
  // 4. 区域锚定再生 ai_view（__doc 结束 → 下一个裸 <script> 之间）
  const dm2 = DOC_RE.exec(html);
  const zs = dm2.index + dm2[0].length;
  const ns = html.indexOf('<script>', zs);
  const ze = ns === -1 ? html.length : ns;
  const view = genAIViewDoc(doc, doc.name || '').replace(/<\/(script)/gi, '<\\/$1');
  const zone = html.slice(zs, ze)
    .replace(/[ \t]*<script type="text\/plain" id="__ai_view">[\s\S]*?<\/script>[ \t]*\n?/g, '')
    .replace(/^\s*\n/, '').replace(/\s+$/, ''); // 归一化空白：反复再生幂等
  html = html.slice(0, zs) + '\n' + AI_VIEW_BLOCK(view) + (zone ? '\n' + zone : '') + '\n' + html.slice(ze);
  return { html, notes };
}

const argv = process.argv.slice(2);
const si = argv.indexOf('--shell');
const shellPath = si >= 0 ? argv[si + 1] : null;
const files = argv.filter((a, i) => !a.startsWith('-') && (si < 0 || (i !== si && i !== si + 1)));
if (!files.length || (si >= 0 && !shellPath)) {
  console.error('用法：node tools/regen-aiview.mjs <file.prototype.html> [...] [--shell <新版壳.html>]');
  process.exit(1);
}
const DOC_TEXT = (h) => h.match(DOC_RE)[0].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');

let failed = 0;
for (const f of files) {
  try {
    const src = await readFile(f, 'utf8');
    if (!DOC_RE.test(src)) throw new Error('源文件缺少内嵌 __doc');
    let base = src;
    const notes = [];
    if (shellPath) {
      // 壳升级：只把源文件的 __doc 搬进新壳，其余（编辑器 JS/CSS）全部来自新壳
      const shell = await readFile(shellPath, 'utf8');
      if (!DOC_RE.test(shell)) throw new Error('新版壳缺少内嵌 __doc');
      const json = JSON.stringify(JSON.parse(DOC_TEXT(src))).replace(/</g, '\\u003c');
      base = shell.replace(DOC_RE, () => '<script type="application/json" id="__doc">' + json + '</script>');
      notes.push('壳升级:' + shellPath.split(/[\\/]/).pop());
    }
    const r = processHtml(base, f);
    const html = r.html;
    notes.push(...r.notes);
    // 自检 1：__doc 可解析
    const outDoc = JSON.parse(DOC_TEXT(html));
    // 自检 2：设计数据 0 变化（仅允许 aiHint 变化）
    const a = JSON.parse(DOC_TEXT(src)), b = JSON.parse(DOC_TEXT(html));
    delete a.aiHint; delete b.aiHint;
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('设计数据在重建后发生变化，已中止');
    // 自检 3：主脚本语法
    [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m) => { new Function(m[1]); });
    await writeFile(f, html, 'utf8');
    console.log(`OK    ${f}  ${notes.join(' ')}  设计数据一致  （${html.length} 字符，${(outDoc.pages || []).length} 页）`);
  } catch (e) {
    console.error(`FAIL  ${f}：${e.message}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
