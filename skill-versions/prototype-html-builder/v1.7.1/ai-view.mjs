/**
 * ai-view.mjs — P35c AI 友好化共享模块（v1.2.2）
 *
 * 提供：
 *   AI_GUIDE / AI_NOTICE / META_AI / AI_HINT — 三层规范入口常量（v1.2：实现约定最高优先）
 *   genAIView(doc)         — 文档 → 逐行布局清单（#__ai_view 内容）
 *   embedAIBlocks(html,doc)— 把 GUIDE/NOTICE/meta + ai_view 区块写进 HTML 文本
 *
 * 设计约定（与编辑器 master 一致）：
 *   - 所有叶子/组 x/y 一律为所在画板局部坐标；画板 x/y 为页面坐标；数值保留原始精度。
 *   - fills/strokes/effects 数组优先，回落单值 fill/stroke；text 用 color。
 *   - text/name/src 一律 JSON 字符串字面量（多行/引号/尖括号无损，可 JSON.parse 还原）。
 *   - svg 图标输出 icon= + color=；hidden/locked/proto 原样标注；母版/实例 → 可复用组件。
 *   - 组件实例：group + inst（母版 id）+ ov（覆盖，键为母版节点 id）。
 *   - 【实现约定】原型仅作布局/视觉参考，实现须遵循项目开发规范（Vue3 标准组件/设计系统），勿逐像素硬编码。
 */
export const AI_GUIDE = `<!-- ==================================================================
PROTOTYPE-AI-GUIDE v1.5（静态说明块，保存时随文件保留；勿改动本注释结构）
本文件 = 单文件高保真原型：编辑器脚本 + 内嵌设计文档（script#__doc，JSON）+ AI 视图（script#__ai_view，逐行清单 + LOGIC 说明附录）。
【实现约定（最高优先，先读本段）】
 本原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）的参考，不是逐像素代码规范。
 实现必须遵循项目既定技术栈与开发规范：Vue3/React 等标准组件、组件库与设计系统 Token、路由/状态管理、响应式与可访问性。
 用可复用组件抽象重复 UI（母版/实例 → 组件 + props/slot），禁止把 #__ai_view 逐节点翻译成绝对定位的硬编码 DOM/CSS。
 ai_view 的坐标/尺寸用于理解相对关系与间距节奏，不作强制 CSS 数值；验收 = 布局与视觉整体一致且符合开发规范，不要求像素 diff 为 0。
【风格方向 direction（可选顶层键）】__doc 顶层可挂 direction:{product:产品一句话, character:[气质词 1-3 个，禁「简洁/现代/高级」类万金油], world:产品所属的物质世界, moments:[允许色彩与细节丰富的 1-2 个焦点区], signature:仅此产品会有的签名细节}。实现界面或改稿时先读它并遵循；缺失时不要凭流行趋势发明方向。
【默认风格基线（用户未给视觉参考时适用；给了参考图则以参考图为准）】① 表面克制：应用/后台的背景、卡片、边框保持中性色，世界感只进 accent、图表与 moments；② 一屏一 accent（标主操作/选中/关键数字），文本三角色（主/次/弱）；③ 禁 slop：色相渐变表面、渐变文字、彩色发光与阴影、emoji 当图标、大写加字距标签、循环动画（animate-pulse 等）、transition-all；④ 圆角嵌套：内=外−间距且≥4，控件 8–10、卡片 12–16；⑤ 间距 4px 网格、同物同尺寸、组内<组间，导航行高 32–36；⑥ 数字 tabular-nums 且全屏一种格式，mock 数据要真实（禁 [X]/123,456）；⑦ 图表一主多辅，单 accent 强调当前关注项；⑧ 模板自检：把产品名换成别家这屏还成立吗？成立=方向不够；⑨ 反简陋三件套（v1.5）：页面底用浅灰（#F5F7FA 级），白卡配描边（#E5E6EB 1px）+ 中性色低透明度投影（y2 blur8 #101828 6%，③ 禁的是彩色发光，此投影不受限），图标配主色 10% tinted 圆底，卡片标题左侧加 4px 品牌竖条，表格行斑马纹，告警/状态行左缘 3px 语义色竖条；渐变只做同色明度/透明度（hero 带、顶栏高亮线），监控/视频画面加取景框角标与扫描线，禁文字发光与跨色相。细则见 skill references/design-system.md §6/§7。
【给 AI 的读法】
 1) 实现界面 → 读 #__ai_view 获取布局与元素清单（每行一节点，坐标均为「画板局部坐标」）＋ #__doc 获取完整字段；按上文「实现约定」用标准组件实现。
 2) 修改设计稿 → 读 #__doc JSON，按下文「AI 修改约定」输出新文档 JSON（不要重写整个 HTML，编辑器壳必须原样保留）。
 3) 编写需求文档 / 理解页面逻辑 → 读 #__ai_view 末尾「=== 页面逻辑与说明（LOGIC）===」全量聚合清单，再看画板/图层分组。
 4) 精确读写说明 → 编辑器内用 ProtoAPI.getNotes / setNotes / listNotes / exportLogic；或在输出 JSON 中带 notes 字段。
【坐标约定】叶子与组的 x/y 一律相对所在画板左上角；画板自身 x/y 为页面坐标。数值保留原始精度（可能带小数，勿取整）。rotation 单位度、顺时针、绕节点中心。path 的 pts 即画板局部坐标（n.x/y 仅作包围盒参考）。
【节点类型】artboard 画板 | rect 矩形 | text 文本 | image 图片 | line 线 | arrow 箭头 | group 组(容器/组件实例) | path 矢量路径 | ellipse 椭圆 | polygon 多边形(sides) | star 星形(points) | svg 图标(icon=名称 color=着色 paths=自定义路径数) | bool 布尔(op=union/subtract/…)
【显隐】hidden:true 为隐藏节点（默认不渲染，交互/状态切换时可显示）；locked 为锁定。
【文本字段】text 值为 JSON 字符串字面量（含 \n、\" 等转义，可 JSON.parse 精确还原原文，多行文本不会断行）；fontSize 字号 fontWeight 字重(400/500/600/700) color 颜色 align 对齐(left/center/right) lineHeight 行高 letterSpacing 字距
【填充 fills】数组自底向上叠加；项为 {type:'solid',color,opacity,on} 或 {type:'linear',angle,stops:[{color,pos,opacity}]} / {type:'radial',stops:[...]}；text 用 color 字段；旧数据回落单值 fill/stroke。
【描边 strokes】{color,width,align:center/inside/outside,style:solid/dashed/dotted,cap,join,on}；旧数据回落 stroke/strokeW/strokeAlign。
【效果 effects】{type:drop/inner/blur/bgblur, on, x,y,blur,color,opacity} 模糊类用 value；旧数据回落 effect.shadow / blur。
【圆角】radius 单值；4 角不同时用 radii:[左上,右上,右下,左下]。
【交互 proto】节点上数组 [{trigger:单击|悬停|按下|拖拽|滚动, dir:方向, action:打开画板|打开弹层|关闭弹层|返回上一页|切换变体, target:目标画板id, variant, anim:过渡动画, duration:ms, easing}]
【说明 notes（v1.4）】page / artboard / 任意 node 上均可挂 notes 对象：{kind:page|component|rule, summary:一句话, body:Markdown 正文, rules:[{when:条件/触发, then:动作/结果, note:备注}], tags:[string], source:ai|human, updated:YYYY-MM-DD}。
 notes 随节点复制/删除/撤销；省略字段按空值处理；无说明的节点不写该字段。演示模式「逻辑」抽屉与 #__ai_view 的 LOGIC 段均由此生成。
【组件实例】group + inst:母版画板id + iid；ov:{子节点id:{字段:值}} 为实例级覆盖；导出/渲染时须先用 ov 覆盖母版对应字段再渲染。实现时母版→可复用组件、ov→props/slot，不要复制节点树。
【AI 修改设计稿约定】输出一个与 #__doc 完全同构的 JSON：{version:1,name,theme,pages,tree}（全量最稳）。文档过大(>100KB)时可只输出变更页：[{page:<索引或页名>, artboards:[...]}]，用 apply-doc.mjs 合入或编辑器「打开 JSON」整份载入。禁止改动本注释、编辑器脚本以及两个内嵌 script 标签之外的任何 HTML 内容。
【AI 修改说明约定】① 精确改：调用 ProtoAPI.getNotes/setNotes/listNotes/exportLogic，或输出含 notes 的同构 JSON；② 批量生成：按 LOGIC 段结构为无说明的画板/组件补 notes，source 标 'ai'；③ 不得静默删除已有说明——apply-doc.mjs 采用保护性合并，AI 输出节点未带 notes 时沿用原值，仅显式 notes:null 才删除；④ source='human' 的人工说明如需调整，应保留原语义并在 body/rules 中体现改动。
【实现建议】以 #__ai_view 的画板/分组理解页面结构与组件边界；组件实例(inst)对应复用组件；图片用节点 src/fit；颜色/圆角/描边映射到项目设计 Token；以画板宽度作参考视口检查布局层级与对齐，不要求像素一致。
================================================================== -->`;

export const AI_NOTICE = `<!-- AI-NOTICE（给读取本文件的 AI/Agent，请勿删除）：
  0) 【最高优先·实现约定】本原型只提供空间布局与 UI 元素整体效果（结构/层级/间距节奏/配色/状态/交互）参考，不是逐像素代码规范。实现必须遵循项目既定技术栈与开发规范（Vue3/React 标准组件、组件库与设计系统 Token、路由/状态管理、响应式与可访问性）；用可复用组件抽象重复 UI，禁止把设计清单逐节点翻译成绝对定位的硬编码 DOM/CSS。
  1) 界面实现 → 读 script#__ai_view（逐行布局清单，坐标=画板局部坐标）＋ script#__doc（完整字段），按开发规范用标准组件实现
  2) 修改设计稿 → 不要改 HTML/壳；输出与 #__doc 同构的 JSON（{version:1,name,theme,pages,tree}），用 apply-doc.mjs 合入或编辑器「打开 JSON」载入
  3) 页面逻辑与说明 → 读 script#__ai_view 末尾 LOGIC 段（全量聚合），或 __doc 中 page/artboard/node 的 notes 字段；演示模式「逻辑」抽屉同样可见
  4) 字段字典 / 坐标约定 / 交互 schema / notes schema / 组件实例映射 → 全文搜索 PROTOTYPE-AI-GUIDE 注释（位于 #__doc 之前）
  5) __doc JSON 内的 aiHint 键是同样的提示（程序化读取用）；AI 输出节点漏写 notes 时 apply-doc.mjs 会沿用原值，不会抹掉人工说明
  6) 风格方向 → __doc.direction（product/character/world/moments/signature）；用户未给视觉参考时按 GUIDE「默认风格基线」执行，给了参考图则以参考图为准
  注意：本文件很大，直接从文件中部读起会漏规范；务必先定位 PROTOTYPE-AI-GUIDE 再动手。 -->`;

export const META_AI = "<meta name=\"prototype-ai\" content=\"AI 必读：本原型仅作空间布局与 UI 元素整体效果参考；实现须遵循项目开发规范（Vue3 等标准组件/设计系统 Token），勿逐节点硬编码绝对定位。规范见 PROTOTYPE-AI-GUIDE；#__ai_view 为布局清单 + LOGIC 页面逻辑说明附录；#__doc 为设计 JSON（改稿输出同构 JSON 用 apply-doc.mjs 合入）。\">";

export const AI_HINT = "AI 必读：本 JSON 为单文件原型的设计文档。原型仅提供空间布局与 UI 元素整体效果参考；实现须遵循项目既定开发规范（Vue3/React 标准组件、组件库与设计系统 Token、响应式与可访问性），禁止逐节点硬编码绝对定位，重复 UI 应抽象为可复用组件。界面结构→读 script#__ai_view 布局清单；页面逻辑与说明→读 LOGIC 段或 page/artboard/node 的 notes 字段（kind/summary/body/rules/tags/source/updated），可用 ProtoAPI.getNotes/setNotes 精确读写；修改设计稿→输出与本 JSON 同构的 {version:1,name,theme,pages,tree}（用 apply-doc.mjs 合入，勿改 HTML，漏写 notes 会沿用原值，漏写 direction 亦然）；风格方向→读 __doc.direction（product/character/world/moments/signature），用户未给视觉参考时按 GUIDE「默认风格基线」执行；字段字典/坐标约定/交互 schema→全文搜索 PROTOTYPE-AI-GUIDE 注释。所有叶子/组 x/y 均为画板局部坐标。";

/* ---------------- 内部工具 ---------------- */
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
function gradientStopsOf(f) {
  return (Array.isArray(f.stops) && f.stops.length >= 2 ? f.stops
    : [{ color: f.color || '#3670F7', pos: 0 }, { color: '#FFFFFF', pos: 1 }])
    .slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
}
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
  if (n.rotation || n.rot) s += ' rotate=' + (n.rotation ?? n.rot);
  if (n.hidden || n.visible === false) s += ' hidden'; // 编辑器模型用 hidden
  if (n.locked) s += ' locked';
  if (n.clip) s += ' clip';
  const st = strokeStr(n); if (st) s += ' ' + st;
  const ef = effectStr(n); if (ef) s += ' ' + ef;
  const pr = protoStr(n); if (pr) s += ' ' + pr;
  if (!noteEmptyView(n.notes)) s += ' note=' + aiStr(String(n.notes.summary || '').slice(0, 60));
  return s;
}
/* 字符串值一律 JSON 字面量；</ → <\/（JSON 合法转义，等价 /，避免提前闭合） */
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
    if (n.lineHeight || n.lh) s += ' lh=' + (n.lineHeight ?? n.lh);
    if (n.letterSpacing || n.ls) s += ' ls=' + (n.letterSpacing ?? n.ls);
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
    const nameOf = (mcId) => {
      let found = null;
      const find = (l) => (l || []).forEach((c) => { if (c.mc === mcId) found = c.name || c.id; find(c.children); });
      find(n.children);
      return found || '';
    };
    for (const [k, o] of Object.entries(n.ov)) {
      if (!o || !Object.keys(o).length) continue;
      out.push(ind + '    override ' + k + (nameOf(k) ? ' ' + aiStr(nameOf(k)) : '') + ': '
        + Object.entries(o).map(([f, v]) => f + '=' + JSON.stringify(v)).join(', '));
    }
  }
}
/* v1.5：风格方向附录（__doc.direction 存在时输出到 #__ai_view 头部） */
export function directionSection(doc){
  const d=doc&&doc.direction;
  if(!d||typeof d!=='object')return '';
  const arr=v=>Array.isArray(v)?v.filter(Boolean).map(String):(v?[String(v)]:[]);
  const out=['','=== 风格方向（direction）===',
    '# 实现与改稿时遵循；用户给了视觉参考时以参考图为准'];
  if(d.product)out.push('# product: '+aiStr(d.product));
  const ch=arr(d.character);if(ch.length)out.push('# character: '+JSON.stringify(ch));
  if(d.world)out.push('# world: '+aiStr(d.world));
  const mo=arr(d.moments);if(mo.length)out.push('# moments: '+JSON.stringify(mo));
  if(d.signature)out.push('# signature: '+aiStr(d.signature));
  out.push('=== /direction ===');
  return out.join('\n');
}

/* P36：#__ai_view 的 LOGIC 附录（与编辑器 genLogicView 同构） */
function noteEmptyView(nt){
  return !nt||typeof nt!=='object'
    ||(!String(nt.summary||'').trim()&&!String(nt.body||'').trim()
      &&!(Array.isArray(nt.rules)&&nt.rules.some(r=>String(r.when||'').trim()||String(r.then||'').trim()||String(r.note||'').trim()))
      &&!(Array.isArray(nt.tags)&&nt.tags.length));
}
function logicSection(doc){
  const out=['','=== 页面逻辑与说明（LOGIC）===',
    '# 每行一条：scope / 页 / 画板 / 节点 id与名称 / kind / 摘要 / 规则 / 标签 / 来源',
    '# 修改说明：输出含 notes 的 __doc 同构 JSON（apply-doc.mjs 合入）或调用 ProtoAPI.setNotes'];
  let total=0;
  ((doc&&doc.pages)||[]).forEach((p,pi)=>{
    const rows=[];
    const push=(o,ab,sc)=>{
      const nt=o&&o.notes;
      if(noteEmptyView(nt))return;
      rows.push({sc:sc,ab:(ab&&ab.name)||'',id:o.id||'',name:o.name||o.type||'页面',nt:nt});
    };
    push(p,null,'PAGE');
    (p.artboards||[]).forEach(ab=>{
      push(ab,ab,'ARTBOARD');
      const walk=l=>(l||[]).forEach(o=>{push(o,ab,'NODE');if(o.children)walk(o.children)});
      walk(ab.children);
    });
    const walkL=l=>(l||[]).forEach(o=>{push(o,null,'NODE');if(o.children)walkL(o.children)});
    walkL(p.loose);
    if(!rows.length)return;
    out.push('');out.push('## page '+pi+': '+(p.name||''));
    rows.forEach(r=>{
      total++;
      out.push('- ['+r.sc+(r.ab?' '+aiStr(r.ab):'')+'] '+r.id+' '+aiStr(r.name)
        +' kind='+(r.nt.kind||'')+' summary='+aiStr(r.nt.summary||'')
        +' tags='+JSON.stringify(r.nt.tags||[])+' source='+(r.nt.source||'human')
        +' updated='+(r.nt.updated||''));
      (Array.isArray(r.nt.rules)?r.nt.rules:[]).forEach(q=>
        out.push('    rule: '+aiStr(q.when||'')+' => '+aiStr(q.then||'')+(q.note?' ('+aiStr(q.note)+')':'')));
      const b=String(r.nt.body||'').trim();
      if(b)out.push('    body='+aiStr(b));
    });
  });
  if(!total)out.push('# （暂无说明）');
  out.push('=== /LOGIC ===');
  return out.join('\n');
}

/**
 * 文档 → 逐行布局清单文本（像素级精确信息保留，但用途是布局/组件边界参考）。
 * @param {object} doc 编辑器文档 {name, pages:[{name,artboards}], ...}
 */
export function genAIView(doc) {
  const out = [];
  out.push('# AI-VIEW 设计清单（自动生成，勿手改；再生：编辑器保存或 embed-ai-view.mjs）');
  out.push('# 用途：空间布局与 UI 元素整体效果参考；实现须遵循项目开发规范（Vue3 标准组件/设计系统 Token），勿逐节点硬编码绝对定位，母版/实例→可复用组件。');
  if (doc && doc.name) out.push('doc: ' + doc.name);
  const dsec = directionSection(doc); if (dsec) out.push(dsec); // v1.5：风格方向
  ((doc && doc.pages) || []).forEach((p, pi) => {
    out.push('');
    out.push('## page ' + pi + ': ' + (p.name || '页' + (pi + 1)));
    (p.artboards || []).forEach((ab) => {
      out.push('## artboard ' + ab.id + ' ' + aiStr(ab.name || '') + ' page=' + (ab.x ?? 0) + ',' + (ab.y ?? 0)
        + ' size=' + (ab.w ?? 0) + 'x' + (ab.h ?? 0) + (ab.bg ? ' bg=' + ab.bg : ''));
      (ab.children || []).forEach((n) => walk(n, '  ', out));
    });
  });
  out.push(logicSection(doc)); // P36：LOGIC 说明附录
  return out.join('\n');
}

/**
 * 把 v1.2 指引（GUIDE / NOTICE / meta）与 #__ai_view 区块写进 HTML。
 * 全部采用「区域锚定 + 旧块移除再插入」，CRLF 兼容；不触碰 __doc（aiHint 由 docJson 注入）。
 * @param {string} html 原型 HTML 文本
 * @param {object|null} doc 文档对象；为 null 时只刷新指引、清空 ai_view
 */
export function embedAIBlocks(html, doc) {
  // 1. GUIDE：移除全部旧块，插到真实 __doc 开标签之前
  const reGuideG = /<!-- =+\r?\nPROTOTYPE-AI-GUIDE[\s\S]*?={20,} *-->[ \t]*\r?\n?/g;
  html = html.replace(reGuideG, '');
  const reTag = /<script type="application\/json" id="__doc">/;
  if (reTag.test(html)) html = html.replace(reTag, (m) => AI_GUIDE + '\n' + m);
  // 2. head meta + AI-NOTICE：移除旧版，统一插到 <head> 后
  html = html.replace(/<meta name="prototype-ai"[^>]*>\r?\n?/g, '')
             .replace(/<!-- AI-NOTICE[\s\S]*?-->\r?\n?/g, '');
  if (/<head>/.test(html)) html = html.replace(/<head>/, () => '<head>\n' + META_AI + '\n' + AI_NOTICE);
  // 3. ai_view：只在 __doc 结束 → 下一个裸 script 开标签之间的 HTML 区操作
  const dm = /<script type="application\/json" id="__doc">[\s\S]*?<\/script>/.exec(html);
  if (!dm) return html;
  const zs = dm.index + dm[0].length;
  const ns = html.indexOf('<script>', zs);
  const ze = ns === -1 ? html.length : ns;
  const view = doc ? genAIView(doc).replace(/<\/(script)/gi, '<\\/$1') : '';
  const block = '<script type="text/plain" id="__ai_view">\n' + view + '\n<\/script>';
  const zone = html.slice(zs, ze)
    .replace(/[ \t]*<script type="text\/plain" id="__ai_view">[\s\S]*?<\/script>[ \t]*\n?/g, '')
    .replace(/^\s*\n/, '').replace(/\s+$/, ''); // 归一化空白：反复补嵌/保存幂等
  return html.slice(0, zs) + '\n' + block + (zone ? '\n' + zone : '') + '\n' + html.slice(ze);
}
