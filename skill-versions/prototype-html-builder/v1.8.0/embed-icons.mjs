#!/usr/bin/env node
/**
 * embed-icons.mjs — 把 assets/icons.json 注入编辑器模板的 SVG 图标注册表
 *
 * 用法：
 *   node scripts/embed-icons.mjs                       # 默认注入 editor-prototype/index.html
 *   node scripts/embed-icons.mjs --target <file>       # 指定任意 .html
 *   node scripts/embed-icons.mjs --check               # 只校验是否已同步（CI/校验用）
 *
 * 注入位置：目标文件中 /*<SVG_ICONS>*\/ … /*<\/SVG_ICONS>*\/ 之间
 * 生成内容：const SVG_ICONS={"ep/search":{"v":1024,"p":["..."],"eo":[0]}, ...};
 *
 * 幂等：重复运行结果一致（每次按 icons.json 全量重写，不做增量合并）。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const ICONS = path.join(SKILL, 'assets', 'icons.json');
const DEFAULT_TARGET = path.resolve(SKILL, '..', '..', 'editor-prototype', 'index.html');

const OPEN = '/*<SVG_ICONS>*/';
const CLOSE = '/*</SVG_ICONS>*/';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const opt = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};

const target = opt('--target') ? path.resolve(opt('--target')) : DEFAULT_TARGET;
const checkOnly = flag('--check');

/** 生成可内联的 SVG_ICONS 字面量（紧凑、单行） */
function buildRegistry(json) {
  const parts = [];
  for (const [name, ic] of Object.entries(json.icons)) {
    const v = +ic.v || +json.grid || 1024;
    const p = JSON.stringify(ic.p || []);
    const eo = ic.eo && ic.eo.length ? `,"eo":${JSON.stringify(ic.eo)}` : '';
    parts.push(`${JSON.stringify(name)}:{"v":${v},"p":${p}${eo}}`);
  }
  return `const SVG_ICONS={${parts.join(',')}};`;
}

function splice(html, registry) {
  const i = html.indexOf(OPEN);
  const j = html.indexOf(CLOSE);
  if (i < 0 || j < 0 || j < i) {
    throw new Error(`目标文件缺少标记 ${OPEN} … ${CLOSE}`);
  }
  return html.slice(0, i + OPEN.length) + '\n' + registry + '\n' + html.slice(j);
}

function stat(html) {
  const i = html.indexOf(OPEN);
  const j = html.indexOf(CLOSE);
  if (i < 0 || j < 0) return { ok: false, reason: 'missing-markers' };
  const block = html.slice(i, j);
  const m = block.match(/const SVG_ICONS=(\{[\s\S]*\});/);
  if (!m) return { ok: false, reason: 'no-registry', size: block.length };
  try {
    const reg = JSON.parse(m[1]);
    return { ok: true, count: Object.keys(reg).length, size: m[1].length };
  } catch {
    return { ok: false, reason: 'bad-json', size: m[1].length };
  }
}

async function main() {
  if (!existsSync(ICONS)) throw new Error(`找不到图标数据：${ICONS}（先运行 scripts/fetch-icons.mjs）`);
  if (!existsSync(target)) throw new Error(`找不到目标文件：${target}`);

  const json = JSON.parse(await readFile(ICONS, 'utf8'));
  const registry = buildRegistry(json).replace(/<\//g, '<\\/');
  const html = await readFile(target, 'utf8');
  const next = splice(html, registry);

  const want = Object.keys(json.icons).length;
  if (checkOnly) {
    const cur = stat(html);
    const same = cur.ok && cur.count === want && html.length && next.length === html.length;
    console.log(`${same ? 'OK' : 'OUT-OF-SYNC'}  ${target}`);
    console.log(`  注册表：${cur.ok ? cur.count : 0} 个图标（期望 ${want}）  文件 ${html.length} 字节`);
    if (!same) process.exitCode = 1;
    return;
  }

  if (next === html) {
    console.log(`无需更新：${target}（已是最新，${want} 个图标）`);
    return;
  }
  await writeFile(target, next, 'utf8');
  console.log(`已注入：${target}`);
  console.log(`  图标 ${want} 个（${json.sets ? Object.keys(json.sets).join(' / ') : '-'}）  网格 ${json.grid || 1024}`);
  console.log(`  文件 ${html.length} → ${next.length} 字节`);
}

main().catch((e) => {
  console.error('embed-icons 失败：', e.message);
  process.exit(1);
});
