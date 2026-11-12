#!/usr/bin/env node
/**
 * 采集 Element Plus / Ant Design 图标（MIT 协议），产出 assets/icons.json。
 * 用法：node scripts/fetch-icons.mjs [--check]
 * - 仅保留纯 <path> 图标，保证 Canvas Path2D 可无损绘制
 * - 统一记录 1024 网格，路径 fill-rule 单独保存
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../assets/icons.json');

const SETS = {
  ep: {
    label: 'Element Plus',
    license: 'MIT',
    url: 'https://github.com/element-plus/element-plus-icons',
    icons: [
      'search', 'edit', 'edit-pen', 'delete', 'setting', 'user', 'avatar', 'lock', 'unlock',
      'home-filled', 'menu', 'plus', 'minus', 'close', 'check', 'select', 'finished', 'remove',
      'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'back', 'right', 'top', 'bottom', 'view', 'hide',
      'more', 'more-filled', 'info-filled', 'warning-filled', 'success-filled', 'circle-check',
      'circle-close', 'circle-plus', 'question-filled', 'upload', 'download', 'upload-filled',
      'picture', 'picture-filled', 'camera', 'video-play', 'video-pause',
      'bell', 'message', 'chat-dot-square', 'chat-line-square', 'calendar', 'clock', 'timer',
      'alarm-clock', 'star', 'star-filled', 'location', 'location-filled', 'phone', 'link',
      'refresh', 'filter', 'sort', 'sort-up', 'sort-down', 'zoom-in', 'zoom-out', 'full-screen',
      'document', 'document-copy', 'copy-document', 'folder', 'folder-opened', 'files',
      'data-line', 'data-analysis', 'trend-charts', 'histogram', 'pie-chart', 'monitor', 'cpu',
      'connection', 'operation', 'tools', 'management', 'platform', 'list', 'grid', 'tickets',
      'notebook', 'memo', 'collection', 'discount', 'present', 'shopping-cart', 'goods', 'money',
      'wallet', 'credit-card', 'promotion', 'share', 'switch-button', 'office-building',
      'map-location', 'compass', 'aim', 'crop', 'magic-stick', 'key', 'stamp', 'umbrella',
      'sunny', 'moon', 'lightning', 'service', 'headset', 'trophy', 'medal', 'guide', 'rank',
      'position', 'place', 'coordinate', 'warning', 'd-arrow-left', 'd-arrow-right',
    ],
  },
  'ant-design': {
    label: 'Ant Design',
    license: 'MIT',
    url: 'https://github.com/ant-design/ant-design-icons',
    icons: [
      'home', 'setting', 'user', 'search', 'plus', 'close', 'check', 'edit', 'delete', 'bell',
      'mail', 'calendar', 'clock-circle', 'star', 'heart', 'camera', 'picture', 'upload',
      'download', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'left', 'right',
      'menu', 'menu-fold', 'menu-unfold', 'more', 'filter', 'info-circle', 'warning',
      'check-circle', 'close-circle', 'exclamation-circle', 'eye', 'lock', 'unlock', 'team',
      'dashboard', 'bar-chart', 'line-chart', 'pie-chart', 'table', 'appstore', 'layout',
      'database', 'cloud', 'sync', 'reload', 'link', 'phone', 'environment', 'safety', 'file',
      'folder', 'file-text', 'copy', 'export', 'import', 'printer', 'qrcode', 'fullscreen',
      'zoom-in', 'zoom-out', 'font-size', 'align-left', 'align-center', 'align-right', 'down',
      'up', 'plus-circle', 'minus-circle', 'logout', 'login', 'idcard', 'project', 'solution',
      'thunderbolt', 'fire', 'rocket', 'bulb', 'tool', 'build', 'experiment', 'deployment-unit',
      'cluster', 'node-index', 'partition', 'block', 'gateway', 'radar-chart', 'area-chart',
    ],
  },
};

const BATCH = 24;

async function fetchBatch(prefix, names) {
  const url = `https://api.iconify.design/${prefix}.json?icons=${names.join(',')}`;
  const res = await fetch(url, { headers: { 'user-agent': 'prototype-html-builder/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${prefix}`);
  return await res.json();
}

/** 仅接受由 <path> 组成的 body，返回 { d, eo } */
function parseBody(body) {
  const stripped = body.replace(/<path[^>]*\/?>/g, '').trim();
  if (stripped) return null; // 含 circle/rect/g/defs 等，跳过
  const paths = [];
  const re = /<path([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(body))) {
    const attrs = m[1];
    const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
    if (!d) return null;
    const eo = /fill-rule="evenodd"/.test(attrs);
    paths.push({ d, eo });
  }
  return paths.length ? paths : null;
}

async function collect(prefix, wanted) {
  const out = {};
  const missing = [];
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const json = await fetchBatch(prefix, batch);
    const aliases = json.aliases || {};
    for (const name of batch) {
      const target = aliases[name]?.parent || name;
      const icon = json.icons?.[target];
      if (!icon) { missing.push(name); continue; }
      const paths = parseBody(icon.body);
      if (!paths) { missing.push(name + '(非纯 path)'); continue; }
      out[`${prefix === 'ant-design' ? 'ant' : prefix}/${name}`] = {
        v: json.width || 1024,
        p: paths.map(x => x.d),
        ...(paths.some(x => x.eo) ? { eo: paths.map((x, idx) => (x.eo ? idx : -1)).filter(i => i >= 0) } : {}),
      };
    }
  }
  return { out, missing };
}

async function main() {
  const icons = {};
  const report = [];
  for (const [prefix, meta] of Object.entries(SETS)) {
    const { out, missing } = await collect(prefix, meta.icons);
    Object.assign(icons, out);
    report.push({ set: prefix, wanted: meta.icons.length, got: Object.keys(out).length, missing });
  }
  const data = {
    version: 1,
    grid: 1024,
    note: '图标为 Element Plus / Ant Design 官方图标（MIT）。Canvas 通过 Path2D 直接绘制 d 路径，节点仅存 icon 引用与 color。',
    sets: Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k === 'ant-design' ? 'ant' : k, {
      label: v.label, license: v.license, url: v.url,
    }])),
    icons,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 0));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`写入 ${OUT}（${Object.keys(icons).length} 个图标，${kb} KB）`);
  console.table(report.map(r => ({ set: r.set, wanted: r.wanted, got: r.got, missing: r.missing.join(', ') || '-' })));
}

main().catch(e => { console.error(e); process.exit(1); });
