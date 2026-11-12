#!/usr/bin/env node
/**
 * validate-doc.mjs — 校验 .chao.html 的内嵌文档是否合法、图标是否全部可渲染
 *
 * 用法：
 *   node scripts/validate-doc.mjs examples/demo.chao.html
 *   node scripts/validate-doc.mjs --quiet out.chao.html
 *
 * 退出码：0 = 通过；1 = 有问题（输出逐条原因）。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.resolve(HERE, '..', 'assets', 'icons.json');

const TYPES = new Set(['artboard', 'rect', 'ellipse', 'text', 'svg', 'line', 'arrow', 'polygon', 'star', 'image', 'group', 'bool']);
const TRIGGERS = new Set(['单击', '悬停', '按下', '拖拽', '滚动']);
const ACTIONS = new Set(['打开画板', '打开弹层', '关闭弹层', '返回上一页', '切换变体']);
const ANIMS = new Set(['无', '淡入', '左滑', '右滑', '上滑', '下滑']);
const OPS = new Set(['union', 'subtract', 'intersect', 'exclude', 'mask', '']);
const NOTE_KINDS = new Set(['page', 'component', 'rule']);
const COLOR_RE = /^#([0-9a-f]{3,8})$|^rgba?\(|^transparent$|^var\(/i;

export function validateDoc(doc, iconSet) {
  const issues = [];
  const notes = [];
  let nodes = 0, icons = 0, instances = 0, protos = 0;
  const add = (m) => issues.push(m);
  const validateNotes = (nt, where) => {
    if (!nt || typeof nt !== 'object' || Array.isArray(nt)) { add(`notes 必须是对象或 null：${where}`); return; }
    if (nt.kind !== undefined && !NOTE_KINDS.has(nt.kind)) add(`notes.kind 非法：${where} ${nt.kind}`);
    for (const k of ['summary', 'body', 'source', 'updated'])
      if (nt[k] !== undefined && typeof nt[k] !== 'string') add(`notes.${k} 必须是字符串：${where}`);
    if (nt.tags !== undefined && (!Array.isArray(nt.tags) || nt.tags.some(t => typeof t !== 'string')))
      add(`notes.tags 必须是字符串数组：${where}`);
    if (nt.rules !== undefined) {
      if (!Array.isArray(nt.rules)) add(`notes.rules 必须是数组：${where}`);
      else nt.rules.forEach((r, i) => {
        if (!r || typeof r !== 'object') { add(`notes.rules[${i}] 非法：${where}`); return; }
        for (const k of ['when', 'then', 'note'])
          if (r[k] !== undefined && typeof r[k] !== 'string') add(`notes.rules[${i}].${k} 必须是字符串：${where}`);
      });
    }
  };

  if (!doc || typeof doc !== 'object') return { issues: ['__doc 不是合法 JSON 对象'], stats: {} };
  if (!Array.isArray(doc.pages) || !doc.pages.length) add('pages 为空');
  if (doc.theme && !['light', 'dark'].includes(doc.theme)) add(`theme 非法：${doc.theme}`);

  // v1.5：direction 结构校验（可选键；product/world/signature 字符串，character/moments 字符串或字符串数组）
  if (doc.direction !== undefined && doc.direction !== null) {
    const d = doc.direction;
    if (!d || typeof d !== 'object' || Array.isArray(d)) add('direction 必须是对象或 null');
    else for (const k of ['product', 'world', 'signature', 'character', 'moments']) {
      const v = d[k];
      if (v === undefined) continue;
      const ok = typeof v === 'string' ? true : (Array.isArray(v) && v.every((x) => typeof x === 'string'));
      if (!ok) add(`direction.${k} 必须是字符串或字符串数组`);
    }
  }

  // v1.8：首版页面规范（缺失只提示，不阻断旧文件；存在则校验结构）
  if (doc.pageSpec === undefined || doc.pageSpec === null) {
    notes.push('未定义 pageSpec（首版页面规范）：PC→Element Plus（ElementUI），APP→Android Material；首版请用 spec.platform 声明并锁定');
  } else {
    const s = doc.pageSpec;
    if (!s || typeof s !== 'object' || Array.isArray(s)) add('pageSpec 必须是对象或 null');
    else {
      if (s.platform !== undefined && !['pc', 'app'].includes(s.platform)) add(`pageSpec.platform 非法：${s.platform}`);
      for (const k of ['version', 'standard', 'viewport', 'grid', 'controls', 'token', 'note'])
        if (s[k] !== undefined && typeof s[k] !== 'string') add(`pageSpec.${k} 必须是字符串`);
      if (s.locked !== undefined && typeof s.locked !== 'boolean') add('pageSpec.locked 必须是布尔值');
      if (s.pages !== undefined) {
        if (!Array.isArray(s.pages)) add('pageSpec.pages 必须是数组');
        else s.pages.forEach((p, i) => {
          if (!p || typeof p !== 'object' || Array.isArray(p)) add(`pageSpec.pages[${i}] 非法`);
          else {
            if (p.name !== undefined && typeof p.name !== 'string') add(`pageSpec.pages[${i}].name 必须是字符串`);
            if (p.platform !== undefined && !['pc', 'app'].includes(p.platform)) add(`pageSpec.pages[${i}].platform 非法：${p.platform}`);
          }
        });
      }
    }
  }

  const ids = new Set();
  const abMap = new Map();
  const regId = (n, where) => {
    if (!n.id) add(`${where} 缺少 id`);
    else if (ids.has(n.id)) add(`id 重复：${n.id}（${where}）`);
    else ids.add(n.id);
  };

  // pass 1：先登记全部画板（交互 target 可能跨页/顺序在前）
  (doc.pages || []).forEach((p, pi) => {
    if (!p.name) add(`pages[${pi}] 缺 name`);
    if (p.notes !== undefined && p.notes !== null) validateNotes(p.notes, `页「${p.name}」`);
    (p.artboards || []).forEach((ab) => {
      regId(ab, `页「${p.name}」画板「${ab.name}」`);
      abMap.set(ab.id, ab);
      if (!ab.name) add(`画板缺名称（页「${p.name}」）`);
      if (!(+ab.w > 0) || !(+ab.h > 0)) add(`画板尺寸非法：${ab.name} ${ab.w}x${ab.h}`);
      if (ab.bg && !COLOR_RE.test(ab.bg)) add(`画板背景色非法：${ab.name} ${ab.bg}`);
    });
  });
  // pass 2：遍历节点
  (doc.pages || []).forEach((p) => {
    (p.artboards || []).forEach((ab) => walk(ab.children, `页「${p.name}」/画板「${ab.name}」`));
    walk(p.loose, `页「${p.name}」自由图层`);
  });

  function walk(list, where) {
    (list || []).forEach((n) => {
      nodes++;
      regId(n, `${where}/${n.name || n.type}`);
      if (!TYPES.has(n.type)) { add(`未知节点类型：${n.type}（${where}/${n.name}）`); return; }
      for (const k of ['x', 'y']) if (typeof n[k] !== 'number') add(`${n.type}「${n.name}」${k} 不是数字`);
      if (n.type !== 'artboard') {
        if (!(+n.w >= 0) || !(+n.h >= 0)) add(`${n.type}「${n.name}」尺寸非法 ${n.w}x${n.h}`);
      }
      if (n.fill && !COLOR_RE.test(n.fill)) add(`填充色非法：${n.name} ${n.fill}`);
      if (n.color && !COLOR_RE.test(n.color)) add(`颜色非法：${n.name} ${n.color}`);
      if (n.type === 'text') {
        if (typeof n.text !== 'string') add(`文本节点缺 text：${n.name}`);
        if (!(+n.fontSize > 0)) add(`字号非法：${n.name}`);
        if (n.align && !['left', 'center', 'right'].includes(n.align)) add(`对齐非法：${n.name} ${n.align}`);
      }
      if (n.type === 'svg') {
        icons++;
        if (!n.icon && !(Array.isArray(n.paths) && n.paths.length)) add(`图标节点缺 icon/paths：${n.name}`);
        if (n.icon && !(Array.isArray(n.paths) && n.paths.length) && !iconSet.has(n.icon)) {
          add(`图标未收录：${n.icon}（${where}/${n.name}）`);
        }
        if (n.paths && n.paths.some((d) => typeof d !== 'string' || !d.trim())) add(`路径非法：${n.name}`);
      }
      if (n.notes !== undefined && n.notes !== null) validateNotes(n.notes, `${where}/${n.name || n.type}`);
      if (n.type === 'bool' && !OPS.has(n.op || '')) add(`布尔运算非法：${n.name} ${n.op}`);
      if (n.cont && n.inst) instances++;
      if (n.proto) {
        if (!Array.isArray(n.proto)) add(`proto 必须是数组：${n.name}`);
        else n.proto.forEach((q, i) => {
          protos++;
          if (!TRIGGERS.has(q.trigger)) add(`交互 trigger 非法：${n.name}[${i}] ${q.trigger}`);
          if (!ACTIONS.has(q.action)) add(`交互 action 非法：${n.name}[${i}] ${q.action}`);
          if (q.anim !== undefined && !ANIMS.has(q.anim)) add(`交互 anim 非法：${n.name}[${i}] ${q.anim}`);
          if (q.action === '打开画板' || q.action === '打开弹层') {
            if (!abMap.has(q.target)) add(`交互目标画板不存在：${n.name}[${i}] → ${q.target}`);
          }
        });
      }
      walk(n.children, `${where}/${n.name || n.type}`);
    });
  }

  // 组件实例完整性
  const masters = new Map();
  (doc.pages || []).filter((p) => p.comp).forEach((p) => (p.artboards || []).forEach((a) => {
    if (a.master) masters.set(a.master, a);
  }));
  if (doc.pages && doc.pages.some((p) => p.comp) && !masters.size) notes.push('组件库页存在但没有母版（master）');
  const checkInst = (list) => (list || []).forEach((n) => {
    if (n.cont && n.inst) {
      const m = masters.get(n.inst);
      if (!m) add(`组件实例引用了不存在的母版：${n.name} → ${n.inst}`);
      else if (!n.base || !Object.keys(n.base).length) add(`组件实例缺 base 快照：${n.name}`);
      const mcCount = countMc(n.children);
      if (mcCount === 0) add(`组件实例缺 mc 绑定：${n.name}`);
      for (const k of Object.keys(n.ov || {})) {
        if (!m.children.some((c) => sameTreeHas(c, k))) add(`实例覆盖引用了未知母版节点：${n.name} → ${k}`);
      }
    }
    checkInst(n.children);
  });
  (doc.pages || []).forEach((p) => (p.artboards || []).forEach((ab) => checkInst(ab.children)));

  const stats = { pages: (doc.pages || []).length, artboards: abMap.size, nodes, icons, instances, protos, masters: masters.size };
  return { issues, notes, stats };
}

function countMc(list) {
  let c = 0;
  const walk = (l) => (l || []).forEach((n) => { if (n.mc) c++; walk(n.children); });
  walk(list);
  return c;
}

function sameTreeHas(masterNode, mcId) {
  if (masterNode.id === mcId) return true;
  return (masterNode.children || []).some((c) => sameTreeHas(c, mcId));
}

async function main() {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');
  const file = argv.find((a) => !a.startsWith('-'));
  if (!file) {
    console.error('用法：node scripts/validate-doc.mjs <file.chao.html> [--quiet]');
    process.exit(1);
  }
  const html = await readFile(path.resolve(file), 'utf8');
  const m = html.match(/<script type="application\/json" id="__doc">([\s\S]*?)<\/script>/);
  if (!m) {
    console.error('FAIL  找不到内嵌文档 <script id="__doc">');
    process.exit(1);
  }
  let doc;
  try { doc = JSON.parse(m[1]); } catch (e) {
    console.error('FAIL  __doc JSON 解析失败：' + e.message);
    process.exit(1);
  }
  const icons = JSON.parse(await readFile(ICONS, 'utf8'));
  const { issues, notes, stats } = validateDoc(doc, new Set(Object.keys(icons.icons || {})));

  // v1.2.1：AI 协作块检查（缺失降级为提示，可用 embed-ai-view.mjs 补嵌）
  const hasGuide = html.includes('PROTOTYPE-AI-GUIDE');
  const hasView = /<script type="text\/plain" id="__ai_view">[\s\S]*?<\/script>/.test(html);
  if (!hasGuide) notes.push('缺 PROTOTYPE-AI-GUIDE 注释（旧文件可运行 embed-ai-view.mjs 补嵌）');
  if (!hasView) notes.push('缺 #__ai_view 逐行清单（旧文件可运行 embed-ai-view.mjs 补嵌）');
  else {
    const vm = html.match(/<script type="text\/plain" id="__ai_view">([\s\S]*?)<\/script>/);
    if (vm && vm[1].trim().length < 20) notes.push('#__ai_view 内容为空（空文档属正常）');
  }

  if (issues.length) {
    console.error(`FAIL  ${issues.length} 个问题  ${file}`);
    issues.slice(0, 40).forEach((x) => console.error(' - ' + x));
    if (issues.length > 40) console.error(` … 其余 ${issues.length - 40} 条省略`);
    process.exit(1);
  }
  if (!quiet) {
    console.log(`PASS  ${file}`);
    console.log(`  页面 ${stats.pages} · 画板 ${stats.artboards} · 节点 ${stats.nodes} · 图标 ${stats.icons} · 实例 ${stats.instances} · 交互 ${stats.protos} · 母版 ${stats.masters} · ${html.length} 字节`);
    notes.forEach((n) => console.log('  提示：' + n));
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error('FAIL  ' + e.message); process.exit(1); });
