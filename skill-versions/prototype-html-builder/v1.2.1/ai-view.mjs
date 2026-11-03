/**
 * ai-view.mjs — P35 AI 友好化共享模块（v1.2.1）
 *
 * 提供：
 *   AI_GUIDE              — 静态说明注释（插入 __doc 之前，随文件保留）
 *   genAIView(doc)        — 把文档编译成逐行设计清单（#__ai_view 内容）
 *   embedAIBlocks(html, doc) — 把 GUIDE 注释 + ai_view 区块写进 HTML 文本
 *
 * 设计约定（与编辑器 master 一致）：
 *   - 所有叶子/组 x/y 一律为所在画板局部坐标；画板 x/y 为页面坐标。
 *   - fills/strokes/effects 数组优先，回落单值 fill/stroke；text 用 color。
 *   - 组件实例：group + inst（母版 id）+ ov（覆盖，键为母版节点 id）。
 *   - 省略默认值（opacity=1、strokeW=0、radius=0、fontWeight=400 等不输出）。
 */

export const AI_GUIDE = `<!-- ==================================================================
PROTOTYPE-AI-GUIDE v1（静态说明块，保存时随文件保留；勿改动本注释结构）
本文件 = 单文件高保真原型：编辑器脚本 + 内嵌设计文档（script#__doc，JSON）+ AI 视图（script#__ai_view，逐行清单）。
【给 AI 的读法】
 1) 像素级复刻设计 → 只读 #__ai_view 区块：每行一个节点，含全部精确几何与样式；坐标均为「画板局部坐标」，可直接映射 CSS，无需换算。
 2) 修改设计稿 → 读 #__doc JSON，按下文「AI 修改约定」输出新文档 JSON（不要重写整个 HTML，编辑器壳必须原样保留）。
 3) 编写需求文档 → 以 #__ai_view 的画板/图层分组与命名为结构依据。
【坐标约定】叶子与组的 x/y 一律相对所在画板左上角；画板自身 x/y 为页面坐标。rotation 单位度、顺时针、绕节点中心。
【节点类型】artboard 画板 | rect 矩形 | text 文本 | image 图片 | line 线 | group 组(容器/组件实例) | path 矢量路径 | ellipse 椭圆 | polygon 多边形(sides) | star 星形(points) | svg 图标 | arrow 箭头 | bool 布尔
【文本字段】text 文本内容 fontSize 字号 fontWeight 字重(400/500/600/700) color 颜色 align 对齐(left/center/right) lineHeight 行高 letterSpacing 字距
【填充 fills】数组自底向上叠加；项为 {type:'solid',color,opacity,on} 或 {type:'linear',angle,stops:[{color,pos,opacity}]} / {type:'radial',stops:[...]}；text 用 color 字段；旧数据回落单值 fill/stroke。
【描边 strokes】{color,width,align:center/inside/outside,style:solid/dashed/dotted,cap,join,on}；旧数据回落 stroke/strokeW/strokeAlign。
【效果 effects】{type:drop/inner/blur/bgblur, on, x,y,blur,color,opacity} 模糊类用 value；旧数据回落 effect.shadow / blur。
【圆角】radius 单值；4 角不同时用 radii:[左上,右上,右下,左下]（旧数据 rc 同序）。
【交互 proto】节点上数组 [{trigger:单击|悬停|按下|拖拽|滚动, dir:方向, action:打开画板|打开弹层|关闭弹层|返回上一页|切换变体, target:目标画板id, variant, anim:过渡动画, duration:ms, easing}]
【组件实例】group + inst:母版画板id + iid；ov:{母版节点id:{字段:值}} 为实例级覆盖；导出/复刻时须先用 ov 覆盖母版对应字段再渲染。
【AI 修改设计稿约定】输出一个与 #__doc 完全同构的 JSON：{version:1,name,theme,pages,tree}（全量最稳）。文档过大(>100KB)时可只输出变更页：[{page:<索引或页名>, artboards:[...]}]，用 apply-doc.mjs 合入或编辑器「打开 JSON」整份载入。禁止改动本注释、编辑器脚本以及两个内嵌 script 标签之外的任何 HTML 内容。
【像素级复刻建议】以 #__ai_view 为布局唯一真源逐行转译 CSS；图片用节点 src/fit；渐变、描边、阴影、圆角按字段直译；完成后以视口宽度=画板宽度自校验对齐。
================================================================== -->`;

/* ---------------- 内部工具 ---------------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function fillsOf(n) {
  if (!n) return [];
  if (n.type === 'text') return n.color ? [{ color: n.color, opacity: 1, on: true }] : [];
  if (Array.isArray(n.fills)) return n.fills;
  return n.fill ? [{ color: n.fill, opacity: 1, on: true }] : [];
}

function strokesOf(n) {
  if (!n) return [];
  if (Array.isArray(n.strokes)) return n.strokes;
  return n.stroke
    ? [{ color: n.stroke, width: n.strokeW ?? 1, align: n.strokeAlign || 'center', style: 'solid', on: true }]
    : [];
}

function effectsOf(n) {
  if (Array.isArray(n.effects)) return n.effects;
  const out = [];
  if (n.effect && n.effect.shadow) out.push({ type: 'drop', ...n.effect.shadow });
  if ((n.blur || 0) > 0) out.push({ type: 'blur', on: true, value: n.blur });
  return out;
}

const opStr = (v) => (v != null && v < 1 ? '@' + Math.round(v * 100) + '%' : '');

function fillStr(n) {
  const fs = fillsOf(n).filter((f) => f.on !== false);
  if (!fs.length) return null;
  return fs.map((f) => {
    if (f.type === 'linear' || f.type === 'radial') {
      const st = (f.stops || [{ color: f.color, pos: 0 }, { color: '#FFFFFF', pos: 1 }])
        .slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
        .map((s) => s.color + '@' + Math.round((s.pos ?? 0) * 100) + '%').join(' -> ');
      return (f.type === 'linear' ? 'linear(' + Math.round(f.angle || 0) + 'deg)' : 'radial') + '(' + st + ')';
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
  if (n.rot || n.rotation) s += ' rotate=' + (n.rot ?? n.rotation);
  if (n.hidden) s += ' hidden';
  if (n.locked) s += ' locked';
  const st = strokeStr(n); if (st) s += ' ' + st;
  const ef = effectStr(n); if (ef) s += ' ' + ef;
  const pr = protoStr(n); if (pr) s += ' ' + pr;
  return s;
}

const rd = (v) => Math.round(v ?? 0);

function nodeLine(n, ind) {
  const t = n.type || 'rect';
  let s = ind + '- ' + t + ' ' + (n.id || '') + (n.name ? ' "' + n.name + '"' : '')
    + ' @' + rd(n.x) + ',' + rd(n.y) + ' ' + rd(n.w) + 'x' + rd(n.h);
  if (t === 'text') {
    s += ' text="' + esc(n.text || '') + '" font=' + n.fontSize
      + (n.fontWeight && n.fontWeight !== 400 ? '/' + n.fontWeight : '')
      + ' color=' + (n.color || '#000000');
    if (n.align) s += ' align=' + n.align;
    if (n.lineHeight) s += ' lh=' + n.lineHeight;
    if (n.letterSpacing || n.ls) s += ' ls=' + (n.letterSpacing ?? n.ls);
    if (n.valign) s += ' valign=' + n.valign;
  } else if (t === 'svg') {
    s += ' icon=' + (n.icon || '(自定义paths:' + (n.paths || []).length + ')') + ' color=' + (n.color || '#000000');
  } else if (t === 'path') {
    const f = fillStr(n); if (f) s += ' fill=' + f;
    s += ' closed=' + (n.closed ? '1' : '0')
      + ' pts=[' + (n.pts || []).map((p) => rd(p.x) + ',' + rd(p.y)).join(' ') + ' ]';
  } else if (t === 'ellipse' || t === 'polygon' || t === 'star') {
    const f = fillStr(n); if (f) s += ' fill=' + f;
    if (t === 'polygon' && n.sides) s += ' sides=' + n.sides;
    if (t === 'star' && n.points) s += ' points=' + n.points;
  } else if (t === 'line' || t === 'arrow') {
    s += ' color=' + (n.stroke || n.color || '#000000') + ' w=' + (n.strokeW ?? 1);
    if (t === 'arrow') s += ' dir=' + (n.dir || '\\');
  } else if (t === 'image') {
    s += ' src="' + esc(n.src || '') + '"' + (n.fit ? ' fit=' + n.fit : '');
  } else { // rect / artboard / bool / 其他矩形语义
    const f = fillStr(n); if (f) s += ' fill=' + f;
    if (n.op) s += ' op=' + n.op;
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
  if (n.ov && typeof n.ov === 'object') { // 实例覆盖（键=母版节点id；名字从本实例克隆树反查）
    const nameOf = (mcId) => {
      let found = null;
      const find = (l) => (l || []).forEach((c) => { if (c.mc === mcId) found = c.name || c.id; find(c.children); });
      find(n.children);
      return found || '';
    };
    for (const [k, o] of Object.entries(n.ov)) {
      if (!o || !Object.keys(o).length) continue;
      out.push(ind + '    override ' + k + (nameOf(k) ? ' "' + nameOf(k) + '"' : '') + ': '
        + Object.entries(o).map(([f, v]) => f + '=' + JSON.stringify(v)).join(', '));
    }
  }
}

/**
 * 文档 → 逐行设计清单文本。
 * @param {object} doc 编辑器文档 {name, pages:[{name,artboards}], ...}
 */
export function genAIView(doc) {
  const out = [];
  out.push('# AI-VIEW 设计清单（自动生成，勿手改；再生：编辑器保存 / embed-ai-view.mjs / apply-doc.mjs）');
  if (doc && doc.name) out.push('doc: ' + doc.name);
  ((doc && doc.pages) || []).forEach((p, pi) => {
    out.push('');
    out.push('## page ' + pi + ': ' + (p.name || '页' + (pi + 1)));
    (p.artboards || []).forEach((ab) => {
      out.push('## artboard ' + ab.id + ' "' + (ab.name || '') + '" page=' + rd(ab.x) + ',' + rd(ab.y)
        + ' size=' + rd(ab.w) + 'x' + rd(ab.h) + (ab.bg ? ' bg=' + ab.bg : ''));
      (ab.children || []).forEach((n) => walk(n, '  ', out));
    });
  });
  return out.join('\n');
}

/**
 * 把 GUIDE 注释（缺则插）与 #__ai_view 区块（有则替换，无则插在 __doc 后）写进 HTML。
 * 采用「区域锚定」：只在 __doc 结束 到 下一个裸 <script> 之间的 HTML 区操作，
 * 绝不触碰编辑器 JS 源码（其内含 ai_view 字符串字面量，宽松正则会误伤——v1.2.1 踩坑）。
 * @param {string} html 原型 HTML 文本
 * @param {object|null} doc 文档对象；为 null 时只补 GUIDE 注释、清空 ai_view
 */
export function embedAIBlocks(html, doc) {
  // 1. GUIDE 注释：锚定真实 __doc 开标签（JS 源码里的字面量带反斜杠，不会命中）
  if (!html.includes('PROTOTYPE-AI-GUIDE')) {
    const reTag = /<script type="application\/json" id="__doc">/;
    if (reTag.test(html)) html = html.replace(reTag, AI_GUIDE + '\n$&');
  }
  // 2. 定位安全操作区：__doc 结束 → 下一个裸 <script>（主编辑器脚本）之间
  const dm = /<script type="application\/json" id="__doc">[\s\S]*?<\/script>/.exec(html);
  if (!dm) return html;
  const zoneStart = dm.index + dm[0].length;
  const nextScript = html.indexOf('<script>', zoneStart);
  const zoneEnd = nextScript === -1 ? html.length : nextScript;
  // 3. 清掉区内旧 ai_view，插入新块
  const zone = html.slice(zoneStart, zoneEnd)
    .replace(/[ \t]*<script type="text\/plain" id="__ai_view">[\s\S]*?<\/script>[ \t]*\n?/g, '');
  const view = doc ? genAIView(doc).replace(/<\/(script)/gi, '<\\/$1') : '';
  const text = '<script type="text/plain" id="__ai_view">\n' + view + '\n<\/script>';
  return html.slice(0, zoneStart) + '\n' + text + '\n' + zone + html.slice(zoneEnd);
}
