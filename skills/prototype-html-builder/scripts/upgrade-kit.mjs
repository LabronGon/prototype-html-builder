#!/usr/bin/env node
/**
 * upgrade-kit.mjs — 把 design-kit.json 内置母版里的"伪图标"（文本符号 / 小方块）
 * 替换为 Element Plus / Ant Design 的 SVG 图标节点（type:'svg'），并校验图标存在。
 *
 * 用法：node scripts/upgrade-kit.mjs
 * 幂等：已是 svg 的节点会被跳过，可反复执行。
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '..', 'assets', 'design-kit.json');
const ICONS = path.resolve(HERE, '..', 'assets', 'icons.json');

/** 母版 id → [节点名, svg 规格] */
const REPLACEMENTS = {
  navbar: [
    ['返回', { icon: 'ep/arrow-left', x: 12, y: 16, w: 24, h: 24, color: '#1F2329' }],
    ['更多', { icon: 'ep/more-filled', x: 335, y: 16, w: 24, h: 24, color: '#1F2329' }],
  ],
  tabbar: [
    ['图标-首页', { icon: 'ant/home', color: '#3670F7' }],
    ['图标-分类', { icon: 'ep/grid', color: '#C4CBD8' }],
    ['图标-消息', { icon: 'ep/bell', color: '#C4CBD8' }],
    ['图标-我的', { icon: 'ep/user', color: '#C4CBD8' }],
  ],
  'list-item': [['箭头', { icon: 'ep/arrow-right', x: 343, y: 20, w: 16, h: 16, color: '#86909C' }]],
  searchbar: [['镜', { icon: 'ep/search', x: 16, y: 10, w: 16, h: 16, color: '#86909C' }]],
  'cell-check': [['勾', { icon: 'ep/check', x: 18, y: 16, w: 12, h: 12, color: '#FFFFFF' }]],
  select: [['箭头', { icon: 'ep/arrow-down', x: 172, y: 10, w: 16, h: 16, color: '#86909C' }]],
  'cell-switch': [['开关图标', { icon: 'ep/check', x: 341, y: 18, w: 14, h: 14, color: '#FFFFFF', skipIfMissing: true }]],
};

const kit = JSON.parse(await readFile(KIT, 'utf8'));
const icons = JSON.parse(await readFile(ICONS, 'utf8'));
const known = new Set(Object.keys(icons.icons));

let changed = 0, skipped = 0, missing = [];
for (const m of kit.masters) {
  const rules = REPLACEMENTS[m.id];
  if (!rules) continue;
  for (const [name, spec] of rules) {
    if (!known.has(spec.icon)) { missing.push(`${m.id}/${name} → ${spec.icon}`); continue; }
    const node = findByName(m.children, name);
    if (!node) continue;
    if (node.type === 'svg' && node.icon === spec.icon) { skipped++; continue; }
    node.type = 'svg';
    node.icon = spec.icon;
    node.color = spec.color;
    if (spec.x !== undefined) node.x = spec.x;
    if (spec.y !== undefined) node.y = spec.y;
    if (spec.w !== undefined) node.w = spec.w;
    if (spec.h !== undefined) node.h = spec.h;
    delete node.text;
    delete node.fill;
    delete node.stroke;
    delete node.radius;
    changed++;
  }
}

function findByName(list, name) {
  for (const n of list || []) {
    if (n.name === name) return n;
    const hit = findByName(n.children, name);
    if (hit) return hit;
  }
  return null;
}

if (missing.length) {
  console.error('以下图标不在 icons.json 中：\n - ' + missing.join('\n - '));
  process.exit(1);
}
await writeFile(KIT, JSON.stringify(kit, null, 1), 'utf8');
console.log(`已升级母版图标：替换 ${changed} 个，已是最新 ${skipped} 个`);
