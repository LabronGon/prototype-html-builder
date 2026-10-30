#!/usr/bin/env node
/**
 * validate-doc.mjs — 校验 .prototype.html 的内嵌文档是否合法、图标是否全部可渲染
 *
 * 用法：
 *   node scripts/validate-doc.mjs examples/demo.prototype.html
 *   node scripts/validate-doc.mjs --quiet out.prototype.html
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
const COLOR_RE = /^#([0-9a-f]{3,8})$|^rgba?\(|^transparent$|^var\(/i;

export function validateDoc(doc, iconSet) {
  const issues = [];
  const notes = [];
  let nodes = 0, icons = 0, instances = 0, protos = 0;
  const add = (m) => issues.push(m);

  if (!doc || typeof doc !== 'object') return { issues: ['__doc 不是合法 JSON 对象'], stats: {} };
  if (!Array.isArray(doc.pages) || !doc.pages.length) add('pages 为空');
  if (doc.theme && !['light', 'dark'].includes(doc.theme)) add(`theme 非法：${doc.theme}`);

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
    console.error('用法：node scripts/validate-doc.mjs <file.prototype.html> [--quiet]');
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
