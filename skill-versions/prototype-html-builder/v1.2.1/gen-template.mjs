#!/usr/bin/env node
/**
 * gen-template.mjs — 重建 assets/template.prototype.html
 *
 * 模板 = editor-prototype/index.html（编辑器壳，已内嵌 218 个 SVG 图标）
 *        + 由 compile() 生成的最小起点文档（含 27 个内置组件母版，kit:true）。
 *
 * 用法：node scripts/gen-template.mjs [--shell <index.html>] [--empty] [-o <输出路径>]
 *   --empty  生成空文档原型（仅 1 页 1 画板，无示例内容；v1.2.0 新增）
 *   -o       指定输出路径（默认：--empty 时 assets/empty.prototype.html，否则 assets/template.prototype.html）
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, docJson, embedAIBlocks } from './build-prototype.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const OUT = path.join(SKILL, 'assets', 'template.prototype.html');
const argv = process.argv.slice(2);
const si = argv.indexOf('--shell');
const SHELL = si >= 0 ? path.resolve(argv[si + 1])
  : (process.env.PROTOTYPE_SHELL ? path.resolve(process.env.PROTOTYPE_SHELL)
    : path.resolve(SKILL, '..', '..', 'editor-prototype', 'index.html'));
const EMPTY = argv.includes('--empty'); // v1.2.0：空文档模式
const oi = argv.indexOf('-o');
const OUT_PATH = oi >= 0 ? path.resolve(argv[oi + 1])
  : (EMPTY ? path.join(SKILL, 'assets', 'empty.prototype.html') : OUT);

/* v1.2.0：--empty 空文档（1 页 1 画板，无示例内容），结构与编辑器 bootDoc 兼容 */
const EMPTY_DOC = {
  version: 1, name: '空白原型', theme: 'light',
  pages: [{ name: '页面 1', artboards: [
    { type: 'artboard', id: 'n1', name: '画板 1', x: 0, y: 0, w: 1440, h: 900, bg: '#FFFFFF', children: [] },
  ]}],
  tree: [{ label: '页面 1', page: 0 }],
};

const SPEC = {
  name: '原型模板',
  theme: 'light',
  kit: true,
  pages: [{
    name: '页面 1',
    artboards: [{
      name: '画板 1', x: 0, y: 0, w: 1440, h: 900, bg: '#FFFFFF',
      nodes: [
        { type: 'text', name: '标题', text: '你的原型从这里开始', x: 48, y: 96, fontSize: 32, fontWeight: 700, color: '#1F2329' },
        { type: 'text', name: '说明', text: '组件库页含 27 个 Element Plus / Ant Design 规范的组件母版，所有图标均为 SVG。', x: 48, y: 148, fontSize: 14, fontWeight: 400, color: '#4E5969' },
        { type: 'icon', name: '示例图标', icon: 'ep/magic-stick', size: 24, x: 48, y: 196, color: '#3670F7' },
        { type: 'rect', name: '示例按钮', x: 88, y: 190, w: 120, h: 40, fill: '#3670F7', radius: 6 },
        { type: 'text', name: '按钮文字', text: '开始设计', x: 88, y: 200, w: 120, h: 20, align: 'center', fontSize: 14, fontWeight: 600, color: '#FFFFFF' },
      ],
    }],
  }],
};

const { doc, stats } = EMPTY ? { doc: null, stats: null } : await compile(SPEC);
let shell;
try { shell = await readFile(SHELL, 'utf8'); }
catch { throw new Error(`找不到编辑器壳：${SHELL}（用 --shell <index.html> 指定，或设置环境变量 PROTOTYPE_SHELL）`); }
const json = EMPTY ? JSON.stringify(EMPTY_DOC) : docJson(doc);
let html = shell.replace(/(<script type="application\/json" id="__doc">)[\s\S]*?(<\/script>)/, (m, a, b) => a + json + b);
if (html.length === shell.length) throw new Error('壳文件缺少 __doc 容器');
html = embedAIBlocks(html, EMPTY ? EMPTY_DOC : doc); // v1.2.1：AI-GUIDE 注释 + __ai_view
await writeFile(OUT_PATH, html, 'utf8');
if (EMPTY) {
  console.log(`已生成空白原型：${OUT_PATH}`);
  console.log(`  空文档（1 页 1 画板）· 壳 ${html.length} 字节`);
} else {
  console.log(`已重建：${OUT_PATH}`);
  console.log(`  页面 ${stats.pages} · 画板 ${stats.artboards} · 节点 ${stats.nodes} · 图标 ${stats.icons} · 组件 ${doc.pages.find((p) => p.comp).artboards.length} · ${html.length} 字节`);
}
