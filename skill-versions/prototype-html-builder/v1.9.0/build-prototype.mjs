#!/usr/bin/env node
/**
 * build-prototype.mjs — 把声明式 JSON 规格编译成 .chao.html
 *
 * 用法：
 *   node scripts/build-prototype.mjs examples/demo-spec.json
 *   node scripts/build-prototype.mjs spec.json -o out.chao.html
 *   node scripts/build-prototype.mjs --check spec.json      # 只编译校验，不落盘
 *
 * 产物 = assets/template.chao.html（编辑器壳，含 218 个 Element Plus / Ant Design
 * SVG 图标） + 内嵌文档 JSON。所有图标都是矢量 Path2D，节点可重新着色。
 *
 * 规格顶层：
 *   { name, theme, kit, pages:[{name,bg,guides,comments,artboards:[{name,x,y,w,h,bg,nodes}]}],
 *     components:[{id,name,w,h,nodes}], tree:[...] }
 * 节点：
 *   { type:'rect|ellipse|text|icon|line|arrow|polygon|star|image|group|bool|instance', ... }
 * 详见 references/spec.md。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_GUIDE, AI_NOTICE, META_AI, AI_HINT, genAIView, embedAIBlocks } from './ai-view.mjs';

// v1.2.2：AI 协作块（GUIDE/NOTICE/meta + __ai_view 清单）随产物自动嵌入
export { AI_GUIDE, AI_NOTICE, META_AI, AI_HINT, genAIView, embedAIBlocks };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const TEMPLATE = path.join(SKILL, 'assets', 'template.chao.html');
const KIT_FILE = path.join(SKILL, 'assets', 'design-kit.json');
const ICONS_FILE = path.join(SKILL, 'assets', 'icons.json');

const NODE_TYPES = new Set(['rect', 'ellipse', 'text', 'svg', 'icon', 'line', 'arrow', 'polygon', 'star', 'image', 'group', 'bool', 'instance']);
const TRIGGERS = ['单击', '悬停', '按下', '拖拽', '滚动'];
const ACTIONS = ['打开画板', '打开弹层', '关闭弹层', '返回上一页', '切换变体'];
const ANIMS = ['无', '淡入', '左滑', '右滑', '上滑', '下滑'];
const OV_KEYS = ['fill', 'fillType', 'grad', 'gradAngle', 'gradStops', 'stroke', 'strokeW', 'sw', 'opacity',
  'radius', 'r', 'visible', 'hidden', 'locked', 'text', 'fontSize', 'fontWeight', 'color', 'letterSpacing', 'lh', 'ls', 'align',
  'icon', 'paths', 'ibv'];

let __uid = 0;
const uid = () => 'n' + (++__uid);

/* ---------------- 文本度量（与编辑器 canvas 测量近似，误差 < 2%） ---------------- */
function measureText(t) {
  const lines = String(t.text ?? '').split('\n');
  const fs = t.fontSize || 14;
  const ls = t.letterSpacing || 0;
  let w = 0;
  for (const line of lines) {
    let lw = 0;
    for (const ch of line) {
      const c = ch.codePointAt(0);
      if (c > 0x2e80) lw += fs;                         // CJK / 全角
      else if (ch === ' ') lw += fs * 0.28;
      else if (c >= 65 && c <= 90) lw += fs * 0.63;      // A-Z
      else lw += fs * 0.52;
      lw += ls;
    }
    w = Math.max(w, lw);
  }
  return { w: Math.max(1, Math.round(w)), h: Math.round(lines.length * (t.lineHeight || 1.4) * fs) };
}

/* ---------------- 节点规范化 ---------------- */
const isColor = (v) => typeof v === 'string' && (/^#([0-9a-f]{3,8})$|^rgba?\(|^transparent$|^var\(/i.test(v));
const num = (v, d) => (v === undefined || v === null ? d : +v);

function baseNode(spec, name) {
  const n = {
    id: uid(),
    type: spec.type,
    name: String(spec.name || name || ''),
    x: num(spec.x, 0),
    y: num(spec.y, 0),
    opacity: num(spec.opacity, 1),
  };
  if (spec.rot) n.rot = +spec.rot;
  if (spec.flipX) n.flipX = true;
  if (spec.flipY) n.flipY = true;
  if (spec.hidden) n.hidden = true;
  if (spec.locked) n.locked = true;
  pickNotes(spec, n);
  return n;
}

/** v1.5.1：spec 的 notes（页面/画板/节点说明）深拷贝透传 —— build 链路此前会静默丢弃 notes */
function pickNotes(spec, target) {
  if (spec && spec.notes && typeof spec.notes === 'object' && !Array.isArray(spec.notes)) {
    target.notes = JSON.parse(JSON.stringify(spec.notes));
  }
}

/** v1.6.0：视觉丰富度 —— spec 的 grad/shadow 翻译为编辑器 fills / effects
 *  grad: { type:'linear'|'radial', angle:90, stops:['#3670F7','#5B8CFF'] 或 [{color,pos,opacity}] }
 *  shadow: { x:0, y:2, blur:8, color:'#101828', opacity:0.08 }（设计约束：只用于卡片层级，不用于文字发光）
 *  注意：渐变只允许同色系明度渐变，色相跨越会被 check-slop 门禁拦截 */
function applyFx(n, spec) {
  if (!n || !spec || typeof spec !== 'object') return n;
  if (n.type === 'instance' || n.cont) return n; // 实例/布尔容器暂不透传（避免与母版覆盖冲突）
  const g = spec.grad;
  if (g && typeof g === 'object') {
    const raw = Array.isArray(g.stops) && g.stops.length >= 2 ? g.stops : [spec.fill || '#3670F7', '#FFFFFF'];
    const stops = raw.map((s, i) => {
      const pos = raw.length > 1 ? i / (raw.length - 1) : 0;
      return typeof s === 'string'
        ? { color: s, pos, opacity: 1, on: true }
        : { color: String(s.color || '#3670F7'), pos: num(s.pos, pos), opacity: num(s.opacity, 1), on: s.on !== false };
    });
    n.fills = [{ type: g.type === 'radial' ? 'radial' : 'linear', color: stops[0].color, angle: num(g.angle, 90), stops, on: true }];
  }
  const sh = spec.shadow;
  if (sh && typeof sh === 'object') {
    n.effects = [{ type: 'drop', on: true, x: num(sh.x, 0), y: num(sh.y, 2), blur: num(sh.blur, 8),
      color: isColor(sh.color) ? sh.color : '#101828', opacity: Math.min(0.4, num(sh.opacity, 0.08)) }];
  }
  return n;
}

/** DSL → 编辑器节点；返回节点（不含 parent）；v1.6.0 出口统一挂 grad/shadow */
function buildNode(spec, ctx, indexPath) {
  return applyFx(buildNodeRaw(spec, ctx, indexPath), spec);
}

function buildNodeRaw(spec, ctx, indexPath) {
  if (!spec || typeof spec !== 'object') throw new Error(`节点必须是对象（${indexPath}）`);
  const type = String(spec.type || 'rect');
  if (!NODE_TYPES.has(type)) throw new Error(`未知节点类型 "${type}"（${indexPath}）；可用：${[...NODE_TYPES].join(', ')}`);
  if (type === 'instance') return buildInstance(spec, ctx, indexPath);
  if (type === 'group' || type === 'bool') return buildContainer(spec, ctx, indexPath);

  const n = baseNode({ ...spec, type: type === 'icon' ? 'svg' : type }, type === 'icon' ? '图标' : type);
  if (type === 'icon') {
    n.type = 'svg';
    n.w = num(spec.w, num(spec.size, 24));
    n.h = num(spec.h, num(spec.size, 24));
    n.icon = String(spec.icon || '');
    n.color = isColor(spec.color) ? spec.color : ctx.palette.text1;
    if (!n.icon && !(spec.paths && spec.paths.length)) throw new Error(`icon 节点需要 icon 或 paths（${indexPath}）`);
    if (spec.paths && spec.paths.length) {
      n.paths = spec.paths.map(String);
      n.ibv = num(spec.ibv, 24);
      n.icon = spec.icon ? String(spec.icon) : '';
    }
    return n;
  }

  if (type === 'rect') {
    n.w = num(spec.w, 100); n.h = num(spec.h, 40);
    n.fill = isColor(spec.fill) ? spec.fill : (spec.fill === null ? null : ctx.palette.brand);
    n.stroke = isColor(spec.stroke) ? spec.stroke : null;
    n.strokeW = num(spec.strokeW, 0);
    n.radius = num(spec.radius, 0);
    if (Array.isArray(spec.rc)) n.rc = spec.rc.map((v) => num(v, 0));
  } else if (type === 'ellipse') {
    n.w = num(spec.w, 80); n.h = num(spec.h, 80);
    n.fill = isColor(spec.fill) ? spec.fill : ctx.palette.brand;
    n.stroke = isColor(spec.stroke) ? spec.stroke : null;
    n.strokeW = num(spec.strokeW, 0);
  } else if (type === 'text') {
    n.text = String(spec.text ?? '文本');
    n.fontSize = num(spec.fontSize, 14);
    n.fontWeight = num(spec.fontWeight, 500);
    n.color = isColor(spec.color) ? spec.color : ctx.palette.text1;
    n.align = spec.align || null;
    if (spec.valign) n.valign = spec.valign;
    if (spec.lineHeight) n.lineHeight = +spec.lineHeight;
    if (spec.letterSpacing) n.letterSpacing = +spec.letterSpacing;
    if (spec.textCase) n.textCase = spec.textCase;
    const m = measureText(n);
    n.w = n.align ? num(spec.w, m.w) : m.w;
    n.h = num(spec.h, m.h);
  } else if (type === 'line' || type === 'arrow') {
    n.w = num(spec.w, 100); n.h = num(spec.h, 2);
    n.stroke = isColor(spec.stroke) ? spec.stroke : ctx.palette.text3;
    n.strokeW = num(spec.strokeW, 1.5);
    n.dir = spec.dir === '/' ? '/' : '\\';
  } else if (type === 'polygon' || type === 'star') {
    n.w = num(spec.w, 80); n.h = num(spec.h, 80);
    n.fill = isColor(spec.fill) ? spec.fill : ctx.palette.brand;
    n.stroke = isColor(spec.stroke) ? spec.stroke : null;
    n.strokeW = num(spec.strokeW, 0);
    if (type === 'polygon') n.sides = Math.max(3, num(spec.sides, 5));
    else n.points = Math.max(5, num(spec.points, 5));
  } else if (type === 'image') {
    n.w = num(spec.w, 160); n.h = num(spec.h, 120);
    n.src = String(spec.src || '');
    if (spec.radius) n.radius = +spec.radius;
  }

  if (Array.isArray(spec.fills)) n.fills = spec.fills;
  if (Array.isArray(spec.strokes)) n.strokes = spec.strokes;
  if (Array.isArray(spec.effects)) n.effects = spec.effects;
  const p = collectProto(spec);
  if (p.length) n.proto = p;
  return n;
}

/** group / bool：子节点坐标仍为画板坐标；包围盒自动计算 */
function buildContainer(spec, ctx, indexPath) {
  const type = spec.type;
  const kids = (spec.children || []).map((c, i) => buildNode(c, ctx, `${indexPath}/${i}`));
  if (!kids.length) throw new Error(`${type} 需要 children（${indexPath}）`);
  const n = baseNode(spec, type === 'bool' ? '布尔' : '编组');
  n.type = type;
  n.children = kids;
  if (type === 'bool') n.op = spec.op || 'union';
  for (const k of kids) k.parent = n;
  const b = bbox(kids);
  n.x = b.x; n.y = b.y; n.w = b.w; n.h = b.h;
  const p = collectProto(spec);
  if (p.length) n.proto = p;
  return n;
}

function bbox(nodes) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of nodes || []) {
    x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
    x2 = Math.max(x2, n.x + (n.w || 0)); y2 = Math.max(y2, n.y + (n.h || 0));
  }
  if (!Number.isFinite(x1)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/* ---------------- 组件实例 ---------------- */
function pickOv(n) {
  const o = {};
  for (const k of OV_KEYS) if (n[k] !== undefined) o[k] = JSON.parse(JSON.stringify(n[k]));
  if (n.type === 'text') { o.w = n.w; o.h = n.h; }
  return o;
}

function cloneTree(src, parent, dx, dy) {
  const n = JSON.parse(JSON.stringify(src, (k, v) => (k === 'parent' ? undefined : v)));
  const walk = (node, par) => {
    node.id = uid();
    node.parent = par;
    node.x = num(node.x, 0) + dx;
    node.y = num(node.y, 0) + dy;
    for (const c of node.children || []) walk(c, node);
  };
  walk(n, parent);
  return n;
}

function buildInstance(spec, ctx, indexPath) {
  const compRef = String(spec.comp || spec.component || '');
  const master = ctx.masters.find((m) => m.master === compRef || m.name === compRef);
  if (!master) {
    throw new Error(`组件不存在："${compRef}"（${indexPath}）；可用：${ctx.masters.map((m) => m.master).join(', ')}`);
  }
  const x = num(spec.x, 0), y = num(spec.y, 0);
  const g = {
    id: uid(), type: 'group', cont: 1, inst: master.master, iid: 'i' + uid(),
    name: String(spec.name || master.name), x, y,
    w: num(spec.w, master.w), h: num(spec.h, master.h),
    opacity: num(spec.opacity, 1), ov: {}, base: {}, children: [],
  };
  if (spec.hidden) g.hidden = true;
  if (spec.locked) g.locked = true;
  pickNotes(spec, g);

  const originX = master._originX ?? 0, originY = master._originY ?? 0; // 母版画板内坐标 → 画板局部
  const pairs = []; // [克隆节点, 母版节点]
  master.children.forEach((c, k) => {
    const clone = cloneTree(c, g, x - originX, y - originY);
    walkPair(clone, c, (cl, src, idx) => {
      cl.mc = src.id;
      cl.kp = idx;
      g.base[src.id] = pickOv(src);
      pairs.push([cl, src]);
    });
    g.children.push(clone);
  });

  // 覆盖：按母版节点 name / mc id / 索引路径
  const ovs = spec.overrides || {};
  for (const [key, props] of Object.entries(ovs)) {
    const lenient = key.replace(/^#/, '');
    const hits = pairs.filter(([, src], i) =>
      src.name === key || src.id === key || src.id === lenient || String(i) === key);
    if (!hits.length) throw new Error(`实例覆盖找不到母版节点："${key}"（${indexPath}）`);
    for (const [cl, src] of hits) {
      const o = Object.assign({}, g.ov[src.id] || {});
      for (const [k, v] of Object.entries(props || {})) {
        if (!OV_KEYS.includes(k)) continue;
        if (k === 'color' || k === 'icon' || k === 'paths') o[k] = v;
        else o[k] = v;
      }
      if (props && 'text' in props && !cl.align) {
        // 自动宽度文本：覆盖文字后重算包围盒；固定框（align 非空）保持母版宽度
        Object.assign(o, measureText({ ...cl, text: String(props.text) }));
      }
      g.ov[src.id] = o;
      // 视觉即时：容器子层直接落覆盖值（编辑器 rebuildContainer 时以母版 + ov 重建，结果一致）
      for (const [k, v] of Object.entries(o)) cl[k] = v;
    }
  }
  const p = collectProto(spec);
  if (p.length) g.proto = p;
  return g;
}

function walkPair(clone, src, fn, idx = 0) {
  fn(clone, src, idx);
  const cs = clone.children || [], ss = src.children || [];
  for (let i = 0; i < cs.length; i++) walkPair(cs[i], ss[i], fn, i);
}

/* ---------------- 交互（proto）规范化 ---------------- */
const TRIGGER_ALIAS = { click: '单击', hover: '悬停', press: '按下', drag: '拖拽', scroll: '滚动' };

function collectProto(spec) {
  const out = [];
  if (Array.isArray(spec.proto)) out.push(...spec.proto);
  for (const [alias, trigger] of Object.entries(TRIGGER_ALIAS)) {
    const v = spec[alias];
    if (!v) continue;
    const arr = Array.isArray(v) ? v : [v];
    for (const it of arr) out.push({ ...it, trigger: it.trigger || trigger });
  }
  return out.map((p) => ({
    trigger: p.trigger || '单击',
    action: p.action || '打开画板',
    target: p.target == null ? '' : String(p.target),
    variant: p.variant == null ? '' : String(p.variant),
    dir: p.dir || '任意',
    opos: p.opos || '居中',
    ox: num(p.ox, 0), oy: num(p.oy, 0),
    dim: num(p.dim, 40),
    bdclose: p.bdclose === undefined ? true : !!p.bdclose,
    anim: p.anim || '无',
    easing: p.easing || 'ease-out',
    duration: num(p.duration, 300),
  }));
}

/* ---------------- v1.9：首版语义编组规划 ---------------- */
/* 首版生成时画板顶层只允许语义区块（group），业务元素必须归入所属区块，
   不得把几十个叶子平铺在画板里。基线随 platform 锁定，改稿/续页沿用。 */
export const GROUP_BASELINE = {
  pc: {
    sections: ['顶栏', '侧栏导航', '页面标题区', '筛选/工具区', '内容区', '卡片区', '表格/列表区', '图表区', '底栏/分页', '弹层/浮层'],
    minGroupRatio: 0.8, maxTopLevelLoose: 3, maxDepth: 3, maxChildrenPerGroup: 12,
  },
  app: {
    sections: ['状态栏', '顶部应用栏', '内容区', '卡片区', '列表区', '底部导航', '弹层/浮层'],
    minGroupRatio: 0.8, maxTopLevelLoose: 2, maxDepth: 3, maxChildrenPerGroup: 10,
  },
};

/** 编组规划写进 __doc.pageSpec.grouping；首版即锁定，后续改稿/续页沿用 */
export function normalizeGrouping(spec, platform) {
  const pl = platform === 'app' ? 'app' : 'pc';
  const b = GROUP_BASELINE[pl];
  const g = (spec && spec.pageSpec && spec.pageSpec.grouping) || (spec && spec.grouping) || {};
  return {
    version: 'v1', locked: true, mode: 'semantic', platform: pl,
    sections: Array.isArray(g.sections) && g.sections.length ? g.sections.map(String) : b.sections.slice(),
    minGroupRatio: num(g.minGroupRatio, b.minGroupRatio),
    maxTopLevelLoose: num(g.maxTopLevelLoose, b.maxTopLevelLoose),
    maxDepth: num(g.maxDepth, b.maxDepth),
    maxChildrenPerGroup: num(g.maxChildrenPerGroup, b.maxChildrenPerGroup),
  };
}

/** 把散落的顶层节点规划成语义区块：
 *  ① 画板显式 sections（推荐）→ ② 节点 section 标签 → ③ 几何行带兜底（会提示）。
 *  单个 group/bool/instance 本身就是区块，不再包一层空壳；组内子节点坐标不变，包围盒由 buildContainer 计算。 */
function planGroups(src, spec, ctx, pageName) {
  const maxLoose = ctx.grouping ? ctx.grouping.maxTopLevelLoose : 3;
  if (!src.length || src.length <= maxLoose) return { list: src, auto: 0 };
  const mk = (name, kids) => {
    if (kids.length === 1 && ['group', 'bool', 'instance'].includes(kids[0] && kids[0].type)) return kids[0];
    return { type: 'group', name: String(name), children: kids };
  };
  const bySection = (list) => {
    const m = new Map();
    for (const n of list) {
      const k = String((n && n.section) || '其他区块').trim() || '其他区块';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(n);
    }
    return [...m].map(([name, kids]) => mk(name, kids));
  };
  // ① 显式声明的编组规划（字符串数组 = 区块命名顺序，节点靠 section 标签归组）
  if (Array.isArray(spec.sections) && spec.sections.length && typeof spec.sections[0] === 'string') {
    const buckets = new Map(spec.sections.map((k) => [String(k), []]));
    for (const n of src) {
      const k = String((n && n.section) || '其他区块').trim() || '其他区块';
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(n);
    }
    const list = [...buckets].filter(([, kids]) => kids.length).map(([name, kids]) => mk(name, kids));
    const untagged = src.filter((n) => !(n && String(n.section || '').trim())).length;
    if (untagged && ctx.warnings) ctx.warnings.push(
      `画板「${spec.name || pageName}」有 ${untagged} 个节点未标 section：已归入「其他区块」，首版请逐节点标注语义分区`);
    return { list, auto: 0 };
  }
  // ①' 显式声明的编组规划（对象数组 = 每组自带 children）
  if (Array.isArray(spec.sections) && spec.sections.length) {
    const list = [], claimed = new Set();
    for (const sec of spec.sections) {
      const kids = (sec.children || sec.nodes || []).slice();
      kids.forEach((k) => claimed.add(k));
      if (kids.length) list.push(mk(sec.name || ('区块 ' + (list.length + 1)), kids));
    }
    const rest = src.filter((n) => !claimed.has(n));
    if (rest.length) list.push(...bySection(rest));
    return { list, auto: 0 };
  }
  // ② 节点自带 section 标签
  if (src.some((n) => n && typeof n === 'object' && String(n.section || '').trim()))
    return { list: bySection(src), auto: 0 };
  // ③ 兜底：按几何行带聚类，并提醒 AI 首版应显式规划语义编组
  const rows = [];
  const sorted = src.slice().sort((a, b) => (num(a.y, 0) - num(b.y, 0)) || (num(a.x, 0) - num(b.x, 0)));
  let band = null;
  for (const n of sorted) {
    const cy = num(n.y, 0) + num(n.h, 0) / 2;
    if (!band || cy - band.cy > 72) { band = { cy, kids: [] }; rows.push(band); }
    band.kids.push(n); band.cy = Math.max(band.cy, cy);
  }
  const list = rows.map((r, i) => mk('区块 ' + (i + 1), r.kids));
  if (ctx.warnings) ctx.warnings.push(
    `画板「${spec.name || pageName}」未声明 sections / section：已按几何行带自动编组为 ${list.length} 个区块（首版请显式命名语义区块）`);
  return { list, auto: list.length };
}

/* ---------------- 页面 / 画板构建 ---------------- */
function buildArtboard(spec, ctx, pageName) {
  const ab = {
    type: 'artboard', id: uid(),
    name: String(spec.name || '画板'),
    x: num(spec.x, 0), y: num(spec.y, 0),
    w: num(spec.w, 375), h: num(spec.h, 812),
    bg: isColor(spec.bg) ? spec.bg : '#FFFFFF',
    children: [],
  };
  if (spec.hidden) ab.hidden = true;
  if (spec.locked) ab.locked = true;
  pickNotes(spec, ab);
  const ctx2 = { ...ctx, ab };
  const src = spec.nodes || spec.children || [];
  /* v1.9：首版强制编组规划 —— 画板顶层放语义区块，不再散落一堆叶子 */
  const planned = planGroups(src, spec, ctx, ab.name);
  if (spec.grouping === false) planned.list = src; // 显式关闭（仅兼容特殊稿，不建议）
  for (const [i, s] of planned.list.entries()) {
    const n = buildNode(s, ctx2, `${pageName}/${ab.name}/${i}`);
    n.parent = ab;
    ab.children.push(n);
  }
  if (Array.isArray(spec.proto)) ab.proto = spec.proto;
  return ab;
}

/* ---------------- 组件库 ---------------- */
function buildKitPage(kit, customComps, ctx) {
  const page = { name: '组件库', comp: true, kit: true, artboards: [] };
  const masters = [];

  for (const [i, m] of (kit.masters || []).entries()) {
    const ab = {
      type: 'artboard', id: uid(), name: m.name, master: m.id,
      x: num(m.x, (i % 3) * 560), y: num(m.y, Math.floor(i / 3) * 320),
      w: m.w, h: m.h, bg: '#FFFFFF', children: [],
    };
    let k = 0;
    const walk = (list, parent) => {
      for (const src of list || []) {
        const n = JSON.parse(JSON.stringify(src, (k, v) => (k === 'parent' ? undefined : v)));
        n.id = uid();
        n.parent = parent;
        if (n.children) walk(n.children, n);
        parent.children.push(n);
        k++;
      }
    };
    walk(m.children, ab);
    page.artboards.push(ab);
    masters.push({ master: m.id, name: m.name, w: m.w, h: m.h, children: ab.children, _originX: 0, _originY: 0 });
  }

  let idx = page.artboards.length;
  for (const c of customComps || []) {
    const id = String(c.id || c.name);
    if (masters.some((m) => m.master === id)) throw new Error(`组件 id 重复："${id}"`);
    const ab = {
      type: 'artboard', id: uid(), name: String(c.name || id), master: id,
      x: num(c.x, (idx % 3) * 560), y: num(c.y, Math.floor(idx / 3) * 320),
      w: num(c.w, 200), h: num(c.h, 100), bg: isColor(c.bg) ? c.bg : '#FFFFFF', children: [],
    };
    const sub = { ...ctx, masters, ab };
    for (const [i, s] of (c.nodes || c.children || []).entries()) {
      const n = buildNode(s, sub, `components/${id}/${i}`);
      n.parent = ab;
      ab.children.push(n);
    }
    page.artboards.push(ab);
    masters.push({ master: id, name: ab.name, w: ab.w, h: ab.h, children: ab.children, _originX: 0, _originY: 0 });
    idx++;
  }
  return { page, masters };
}

/* ---------------- target / variant 解析 ---------------- */
function resolveTargets(pages, masters) {
  const abIndex = new Map();
  const abByPage = new Map();
  pages.forEach((p) => p.artboards.forEach((ab) => {
    abIndex.set(ab.id, ab);
    if (!abIndex.has(ab.name)) abIndex.set(ab.name, ab);
    abByPage.set(p.name + '/' + ab.name, ab);
    abByPage.set(p.name + '/' + ab.id, ab);
  }));
  const masterIndex = new Map(masters.map((m) => [m.master, m]).concat(masters.map((m) => [m.name, m])));
  const fix = (n) => {
    if (!Array.isArray(n.proto)) return;
    n.proto = n.proto.map((p) => {
      if (!TRIGGERS.includes(p.trigger)) throw new Error(`交互 trigger 非法：${p.trigger}`);
      if (!ACTIONS.includes(p.action)) throw new Error(`交互 action 非法：${p.action}`);
      if (!ANIMS.includes(p.anim)) throw new Error(`交互 anim 非法：${p.anim}`);
      const q = { ...p };
      if (p.action === '切换变体') {
        const m = masterIndex.get(p.variant);
        if (!m) throw new Error(`变体母版不存在：${p.variant}`);
        q.variant = m.master;
        q.target = '';
      } else if (p.action === '打开画板' || p.action === '打开弹层') {
        const t = abIndex.get(p.target) || abByPage.get(p.target);
        if (!t) throw new Error(`交互目标画板不存在："${p.target}"（节点 ${n.name || n.id}）`);
        q.target = t.id;
      } else {
        q.target = '';
      }
      return q;
    });
  };
  const walk = (list) => (list || []).forEach((n) => { fix(n); walk(n.children); });
  pages.forEach((p) => p.artboards.forEach((ab) => { fix(ab); walk(ab.children); walk(ab.loose); }));
}

/* ---------------- 主流程 ---------------- */
function validateIcons(page, iconSet, errors) {
  const walk = (list, where) => (list || []).forEach((n) => {
    if (n.type === 'svg' && n.icon && !(n.paths && n.paths.length) && !iconSet.has(n.icon)) {
      errors.push(`图标未收录："${n.icon}"（${where}/${n.name || '未命名'}）`);
    }
    walk(n.children, where);
  });
  const where = page.name;
  (page.artboards || []).forEach((ab) => walk(ab.children, `${where}/${ab.name}`));
  walk(page.loose, where);
}

export async function compile(spec, opts = {}) {
  const warnings = [];
  const errors = [];
  if (!spec || typeof spec !== 'object') throw new Error('规格必须是 JSON 对象');
  if (!Array.isArray(spec.pages) || !spec.pages.length) throw new Error('规格需要 pages 数组');

  /* v1.8：首版页面规范（platform）——首次生成界面必须明确端型；缺省按 PC 基线锁定并提示 */
  if (spec.platform !== undefined && !['pc', 'app', 'PC', 'APP'].includes(spec.platform))
    errors.push(`platform 只能是 "pc" 或 "app"（收到：${JSON.stringify(spec.platform)}）`);
  (spec.pages || []).forEach((p, i) => {
    if (p && p.platform !== undefined && !['pc', 'app', 'PC', 'APP'].includes(p.platform))
      errors.push(`pages[${i}].platform 只能是 "pc" 或 "app"（收到：${JSON.stringify(p.platform)}）`);
  });
  if (spec.platform === undefined)
    warnings.push('未声明 platform（首版页面规范）：已按 PC / Element Plus（ElementUI）页面规范锁定；APP 原型请显式写 "platform":"app"（Android Material 规范）');

  const kit = JSON.parse(await readFile(KIT_FILE, 'utf8'));
  const iconJson = JSON.parse(await readFile(ICONS_FILE, 'utf8'));
  const iconSet = new Set(Object.keys(iconJson.icons || {}));
  const palette = kit.palette[spec.theme === 'dark' ? 'dark' : 'light'];

  const useKit = spec.kit === undefined ? true : !!spec.kit;
  const ctx0 = { palette, masters: [], warnings };

  let kitPage = null, masters = [];
  if (useKit) {
    const r = buildKitPage(kit, spec.components || [], ctx0);
    kitPage = r.page;
    masters = r.masters;
  } else if (spec.components && spec.components.length) {
    const r = buildKitPage({ masters: [] }, spec.components, ctx0);
    kitPage = r.page;
    masters = r.masters;
  }
  /* v1.9：编组规划基线随首版端型确定，传给每个画板的 planGroups */
  const defPlat = String(spec.platform || (spec.pageSpec && spec.pageSpec.platform) || 'pc').toLowerCase() === 'app' ? 'app' : 'pc';
  const ctx = { ...ctx0, masters, grouping: normalizeGrouping(spec, defPlat) };

  const pages = [];
  const pageIndex = new Map();
  for (const [pi, ps] of spec.pages.entries()) {
    const page = {
      name: String(ps.name || ('页面 ' + (pi + 1))),
      artboards: [],
    };
    if (isColor(ps.bg)) page.bg = ps.bg;
    if (Array.isArray(ps.guides)) page.guides = ps.guides.map((g) => ({ axis: g.axis === 'y' ? 'y' : 'x', pos: num(g.pos, 0) }));
    if (Array.isArray(ps.comments)) page.comments = ps.comments.map((c) => ({ x: num(c.x, 0), y: num(c.y, 0), text: String(c.text || ''), replies: c.replies || [] }));
    if (Array.isArray(ps.loose)) page.loose = [];
    pickNotes(ps, page);
    const subs = ps.artboards && ps.artboards.length ? ps.artboards : [{ name: page.name, x: 0, y: 0, w: 1440, h: 900, nodes: ps.nodes || [] }];
    for (const as of subs) page.artboards.push(buildArtboard(as, ctx, page.name));
    // v1.5.1：画板缺说明提示（硬性约束 5 —— 交付时页面/画板说明必须写全）
    const miss = page.artboards.filter((ab) => !ab.notes).map((ab) => ab.name);
    if (miss.length) warnings.push(`${page.name} 有 ${miss.length} 个画板未写说明（notes）：${miss.join('、')}——交付前请补全页面逻辑说明`);
    pages.push(page);
    pageIndex.set(page.name, page);
  }
  if (kitPage) pages.push(kitPage);

  resolveTargets(pages, masters);

  // 图标校验
  for (const p of pages) {
    validateIcons(p, iconSet, errors);
  }
  // 结构校验（id 唯一）
  const ids = new Set();
  const dup = [];
  const scan = (list) => (list || []).forEach((n) => {
    if (ids.has(n.id)) dup.push(n.id); else ids.add(n.id);
    scan(n.children);
  });
  pages.forEach((p) => p.artboards.forEach((ab) => { if (ids.has(ab.id)) dup.push(ab.id); else ids.add(ab.id); scan(ab.children); scan(ab.loose); }));
  if (dup.length) errors.push(`节点 id 重复：${dup.slice(0, 5).join(', ')}`);
  if (errors.length) {
    const e = new Error('规格校验失败：\n - ' + errors.join('\n - '));
    e.errors = errors;
    throw e;
  }

  const tree = Array.isArray(spec.tree) && spec.tree.length
    ? spec.tree.map((t) => normalizeTree(t, pageIndex, pages))
    : pages.map((p, i) => ({ label: p.name, page: i }));

  const doc = {
    version: 1,
    ...(spec.name ? { name: String(spec.name) } : {}),
    theme: spec.theme === 'dark' ? 'dark' : 'light',
    ...(normalizeDirection(spec.direction) ? { direction: normalizeDirection(spec.direction) } : {}),
    pageSpec: normalizePageSpec(spec, pages), // v1.8：首版页面规范（首版即锁定）
    pages,
    tree,
  };
  stripParents(doc);
  return { doc, masters, warnings, stats: statsOf(doc) };
}

/** 编辑器运行时重建 parent，序列化前剔除（避免循环引用） */
function stripParents(doc) {
  const walk = (list) => (list || []).forEach((n) => {
    delete n.parent;
    for (const c of n.children || []) { delete c.parent; }
    walk(n.children);
  });
  doc.pages.forEach((p) => { p.artboards.forEach((ab) => { delete ab.parent; walk(ab.children); }); walk(p.loose); });
}

/** v1.5：风格方向归一化（product/world/signature 为字符串；character/moments 兼容字符串或字符串数组） */
export function normalizeDirection(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = {};
  for (const k of ['product', 'world', 'signature'])
    if (d[k] != null && String(d[k]).trim()) out[k] = String(d[k]).trim();
  for (const k of ['character', 'moments']) {
    if (d[k] == null) continue;
    const arr = (Array.isArray(d[k]) ? d[k] : [d[k]]).map((x) => String(x).trim()).filter(Boolean);
    if (arr.length) out[k] = arr;
  }
  return Object.keys(out).length ? out : null;
}

/* ---------------- v1.8：首版页面规范（PC=Element Plus / APP=Android Material） ---------------- */
export const PAGE_BASELINE = {
  pc: {
    standard: 'Element Plus（ElementUI）页面规范',
    viewport: '1440x900',
    grid: '24px 页边距 / 统一 gutter 16 / 8px 纵向节奏 / 卡内边距 16 / 4px 网格',
    controls: '常规控件高 32 / 主按钮 40 / 正文 14 / 圆角 6 / 描边 #E5E6EB 1px',
    token: 'assets/design-kit.json（Element Plus 色板）',
  },
  app: {
    standard: 'Android（Material 3）页面规范',
    viewport: '360x800 (dp)',
    grid: '16dp 页边距 / 8dp 栅格 / 4dp 基数 / 8dp 纵向节奏',
    controls: '状态栏 24dp / 顶部应用栏 56dp / 底部导航 56dp / 触控目标≥48dp / 正文 14sp / 圆角 4–12dp',
    token: 'Material 3 color roles + assets/design-kit.json',
  },
};

/** 规格 → __doc.pageSpec。首次生成即锁定：后续改稿 / 实现 / 追加页面沿用同一端型与规范。 */
export function normalizePageSpec(spec, pages) {
  const norm = (v) => String(v || '').toLowerCase() === 'app' ? 'app' : 'pc';
  const def = norm(spec.platform || (spec.pageSpec && spec.pageSpec.platform));
  const base = PAGE_BASELINE[def];
  const out = {
    version: 'v1',
    locked: true,
    platform: def,
    standard: base.standard,
    viewport: base.viewport,
    grid: base.grid,
    controls: base.controls,
    token: base.token,
    grouping: normalizeGrouping(spec, def), // v1.9：首版语义编组规划（首版即锁定）
    pages: (spec.pages || []).map((ps, i) => {
      const pl = norm((ps && ps.platform) || def);
      return {
        name: String((pages[i] && pages[i].name) || (ps && ps.name) || ('页面 ' + (i + 1))),
        platform: pl,
        standard: PAGE_BASELINE[pl].standard,
        viewport: PAGE_BASELINE[pl].viewport,
      };
    }),
  };
  if (spec.pageSpec && typeof spec.pageSpec === 'object') {
    for (const k of ['version', 'standard', 'viewport', 'grid', 'controls', 'token', 'note'])
      if (spec.pageSpec[k] != null) out[k] = String(spec.pageSpec[k]);
    if (spec.pageSpec.locked === false) out.locked = false;
  }
  return out;
}

/** direction 摘要 → 追加到 aiHint（无 direction 时为空串） */
export function directionHint(doc) {
  const d = doc && doc.direction;
  if (!d || typeof d !== 'object') return '';
  const j = (v) => (Array.isArray(v) ? v.join('、') : (v ? String(v) : ''));
  const parts = [];
  if (d.product) parts.push('产品=' + d.product);
  if (d.character) parts.push('气质=' + j(d.character));
  if (d.world) parts.push('世界=' + d.world);
  if (d.moments) parts.push('焦点=' + j(d.moments));
  if (d.signature) parts.push('签名=' + d.signature);
  return parts.length ? ' 风格方向：' + parts.join('；') + '（用户未给视觉参考时按 GUIDE 默认风格基线执行）。' : '';
}

/** 文档 → 可内嵌 JSON（转义 `<` 防止提前闭合；v1.2.2 强制带 aiHint；v1.5 aiHint 追加风格方向摘要） */
export function docJson(doc) {
  return JSON.stringify({ ...doc, aiHint: AI_HINT + directionHint(doc) }, (k, v) => (k === 'parent' ? undefined : v)).replace(/</g, '\\u003c');
}

function normalizeTree(t, pageIndex, pages) {
  const out = {};
  if (t.label) out.label = String(t.label);
  if (t.page !== undefined) {
    if (typeof t.page === 'number') out.page = t.page;
    else if (pageIndex.has(t.page)) out.page = pages.indexOf(pageIndex.get(t.page));
    else throw new Error(`页面树引用了不存在的页面："${t.page}"`);
  }
  if (t.open) out.open = true;
  if (t.children) out.children = t.children.map((c) => normalizeTree(c, pageIndex, pages));
  return out;
}

function statsOf(doc) {
  let nodes = 0, icons = 0, instances = 0, artboards = 0;
  const walk = (l) => (l || []).forEach((n) => { nodes++; if (n.type === 'svg') icons++; if (n.cont && n.inst) instances++; walk(n.children); });
  doc.pages.forEach((p) => p.artboards.forEach((ab) => { artboards++; walk(ab.children); }));
  return { pages: doc.pages.length, artboards, nodes, icons, instances };
}

async function main() {
  const argv = process.argv.slice(2);
  const checkOnly = argv.includes('--check');
  const oIdx = argv.indexOf('-o');
  const outArg = oIdx >= 0 ? argv[oIdx + 1] : null;
  const specPath = argv.find((a, i) => !a.startsWith('-') && (oIdx < 0 || i !== oIdx + 1));
  if (!specPath) {
    console.error('用法：node scripts/build-prototype.mjs <spec.json> [-o out.chao.html] [--check]');
    process.exit(1);
  }
  const spec = JSON.parse(await readFile(path.resolve(specPath), 'utf8'));
  const { doc, stats, warnings } = await compile(spec);

  const tpl = await readFile(TEMPLATE, 'utf8');
  const json = docJson(doc);
  let html = tpl.replace(/(<script type="application\/json" id="__doc">)[\s\S]*?(<\/script>)/, (m, a, b) => a + json + b);
  if (html.length === tpl.length) throw new Error('模板缺少 __doc 容器');
  html = embedAIBlocks(html, doc); // v1.2.1：嵌入 AI-GUIDE 注释 + __ai_view 逐行清单

  const out = outArg ? path.resolve(outArg)
    : path.join(path.dirname(path.resolve(specPath)), (spec.name || 'prototype').replace(/[\\/:*?"<>|]/g, '_') + '.chao.html');

  if (!checkOnly) {
    await writeFile(out, html, 'utf8');
  }
  console.log(`${checkOnly ? '编译通过（未落盘）' : '已生成：' + out}`);
  console.log(`  页面 ${stats.pages} · 画板 ${stats.artboards} · 节点 ${stats.nodes} · 图标 ${stats.icons} · 组件实例 ${stats.instances} · ${html.length} 字节`);
  if (warnings.length) console.log('  提示：' + warnings.join('；'));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
