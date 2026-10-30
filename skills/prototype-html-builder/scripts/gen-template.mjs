#!/usr/bin/env node
/**
 * gen-template.mjs — 重建 assets/template.prototype.html
 *
 * 模板 = editor-prototype/index.html（编辑器壳，已内嵌 218 个 SVG 图标）
 *        + 由 compile() 生成的最小起点文档（含 27 个内置组件母版，kit:true）。
 *
 * 用法：node scripts/gen-template.mjs [--shell <index.html>]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, docJson } from './build-prototype.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const OUT = path.join(SKILL, 'assets', 'template.prototype.html');
const argv = process.argv.slice(2);
const si = argv.indexOf('--shell');
const SHELL = si >= 0 ? path.resolve(argv[si + 1]) : path.resolve(SKILL, '..', '..', 'editor-prototype', 'index.html');

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

const { doc, stats } = await compile(SPEC);
const shell = await readFile(SHELL, 'utf8');
const json = docJson(doc);
const html = shell.replace(/(<script type="application\/json" id="__doc">)[\s\S]*?(<\/script>)/, (m, a, b) => a + json + b);
if (html.length === shell.length) throw new Error('壳文件缺少 __doc 容器');
await writeFile(OUT, html, 'utf8');
console.log(`已重建：${OUT}`);
console.log(`  页面 ${stats.pages} · 画板 ${stats.artboards} · 节点 ${stats.nodes} · 图标 ${stats.icons} · 组件 ${doc.pages.find((p) => p.comp).artboards.length} · ${html.length} 字节`);
