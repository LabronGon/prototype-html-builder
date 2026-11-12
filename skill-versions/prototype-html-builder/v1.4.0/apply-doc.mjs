#!/usr/bin/env node
/**
 * apply-doc.mjs — 把 AI 输出的文档 JSON 合入 .chao.html（v1.4.0）
 *
 * 这是「AI 辅助调整设计稿」闭环的落盘端：AI 读原型 HTML（#__doc + #__ai_view），
 * 输出新的文档 JSON；本脚本负责校验并合回，编辑器壳原样保留。
 *
 * 接受两种 AI 输出格式：
 *   A. 全量文档：{version:1, name?, theme?, pages:[...], tree?}      —— 整份替换
 *   B. 变更页数组：[{page:<索引或页名>, artboards:[...]}, ...]        —— 仅替换对应页的 artboards
 *
 * 用法：
 *   node scripts/apply-doc.mjs <原型.html> <AI输出.json> [-o out.html] [--check]
 *     --check  只校验不落盘
 *
 * 合入后自动再生 #__ai_view。退出码：0 = 成功；1 = 失败。
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDoc } from './validate-doc.mjs';
import { docJson, embedAIBlocks } from './build-prototype.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.resolve(HERE, '..', 'assets', 'icons.json');
const DOC_RE = /(<script type="application\/json" id="__doc">)[\s\S]*?(<\/script>)/;

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const oi = argv.indexOf('-o');
const outArg = oi >= 0 ? path.resolve(argv[oi + 1]) : null;
const pos = argv.filter((a, i) => !a.startsWith('-') && (oi < 0 || i !== oi + 1));
if (pos.length < 2) {
  console.error('用法：node scripts/apply-doc.mjs <原型.html> <AI输出.json> [-o out.html] [--check]');
  process.exit(1);
}
const [htmlPath, jsonPath] = pos;

/* ---------- 读入原型与 AI 输出 ---------- */
const html = await readFile(path.resolve(htmlPath), 'utf8');
const m = html.match(/<script type="application\/json" id="__doc">([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL  原型缺少内嵌 __doc（不是 .chao.html？）'); process.exit(1); }
let baseDoc;
try { baseDoc = JSON.parse(m[1]); } catch (e) { console.error('FAIL  原型 __doc 解析失败：' + e.message); process.exit(1); }

const raw = await readFile(path.resolve(jsonPath), 'utf8');
let ai;
try { ai = JSON.parse(raw); } catch (e) { console.error('FAIL  AI 输出不是合法 JSON：' + e.message); process.exit(1); }

/* ---------- P36 v1.4：说明字段保护性合并 ----------
   AI 重写节点时常漏写 notes；这里按 id 从原文档沿用，仅 AI 显式写 notes:null 才删除。
   page 级说明按页索引锚定（AI 改名也不丢）。 */
function indexNotes(doc){
  const map=new Map();
  const walk=n=>{
    if(!n||typeof n!=='object')return;
    if(n.id&&n.notes!==undefined)map.set(String(n.id),n.notes);
    (n.children||[]).forEach(walk);
  };
  ((doc&&doc.pages)||[]).forEach((p,pi)=>{
    if(p.notes!==undefined)map.set('page:'+pi,p.notes);
    (p.artboards||[]).forEach(walk);
    (p.loose||[]).forEach(walk);
  });
  return map;
}
function protectNotes(pagesArg,baseMap){
  const restore=n=>{
    if(!n||typeof n!=='object')return;
    if(n.notes===undefined&&n.id&&baseMap.has(String(n.id)))
      n.notes=JSON.parse(JSON.stringify(baseMap.get(String(n.id))));
    (n.children||[]).forEach(restore);
  };
  pagesArg.forEach((p,pi)=>{
    if(p.notes===undefined&&baseMap.has('page:'+pi))
      p.notes=JSON.parse(JSON.stringify(baseMap.get('page:'+pi)));
    (p.artboards||[]).forEach(restore);
    (p.loose||[]).forEach(restore);
  });
  return pagesArg;
}

/* ---------- 归一化：全量文档 / 变更页数组 ---------- */
function normalizePages(ai) {
  // 数组形式：变更页补丁
  if (Array.isArray(ai)) {
    const pages = JSON.parse(JSON.stringify(baseDoc.pages || []));
    for (const [i, patch] of ai.entries()) {
      const ref = patch.page;
      let idx = typeof ref === 'number' ? ref : pages.findIndex((p) => p.name === ref);
      if (idx < 0 || idx >= pages.length) throw new Error(`第 ${i} 个补丁引用的页面不存在：${JSON.stringify(ref)}`);
      if (!Array.isArray(patch.artboards)) throw new Error(`第 ${i} 个补丁缺 artboards 数组`);
      const keep = pages[idx];
      pages[idx] = {
        ...keep,
        artboards: patch.artboards,
        ...(patch.name ? { name: patch.name } : {}),
        ...(Array.isArray(patch.loose) ? { loose: patch.loose } : {}),
        ...(Array.isArray(patch.guides) ? { guides: patch.guides } : {}),
        ...(Array.isArray(patch.comments) ? { comments: patch.comments } : {}),
      };
    }
    return pages;
  }
  // 对象形式：全量文档
  if (!ai || typeof ai !== 'object') throw new Error('AI 输出必须是文档对象或变更页数组');
  if (ai.version !== 1) throw new Error(`version 必须为 1（收到：${ai.version}）`);
  if (!Array.isArray(ai.pages) || !ai.pages.length) throw new Error('pages 必须是非空数组');
  return ai.pages;
}

const baseNotesMap = indexNotes(baseDoc);
let merged;
try {
  const pages = protectNotes(normalizePages(ai), baseNotesMap);
  merged = {
    ...baseDoc,
    ...(!Array.isArray(ai) && ai.name !== undefined ? { name: String(ai.name) } : {}),
    ...(!Array.isArray(ai) && ai.theme ? { theme: ai.theme === 'dark' ? 'dark' : 'light' } : {}),
    pages,
    ...(!Array.isArray(ai) && Array.isArray(ai.tree) && ai.tree.length ? { tree: ai.tree } : {}),
  };
} catch (e) {
  console.error('FAIL  ' + e.message);
  process.exit(1);
}

/* ---------- 校验（复用 validate-doc 全套规则） ---------- */
const icons = JSON.parse(await readFile(ICONS, 'utf8'));
const { issues } = validateDoc(merged, new Set(Object.keys(icons.icons || {})));
if (issues.length) {
  console.error(`FAIL  合入后文档校验未通过（${issues.length} 条）：`);
  issues.slice(0, 30).forEach((x) => console.error(' - ' + x));
  if (issues.length > 30) console.error(` … 其余 ${issues.length - 30} 条省略`);
  process.exit(1);
}

/* ---------- 落盘 ---------- */
const json = docJson(merged);
if (!DOC_RE.test(html)) { console.error('FAIL  原型 __doc 容器异常'); process.exit(1); }
let out = html.replace(DOC_RE, (mm, a, b) => a + json + b);
out = embedAIBlocks(out, merged);

if (checkOnly) {
  console.log(`PASS  校验通过（未落盘）：${(merged.pages || []).length} 页 · ${out.length} 字节`);
  process.exit(0);
}
await writeFile(outArg || path.resolve(htmlPath), out, 'utf8');
const nArt = (merged.pages || []).reduce((s, p) => s + (p.artboards || []).length, 0);
console.log(`OK    已合入 ${outArg || htmlPath}`);
console.log(`  页面 ${(merged.pages || []).length} · 画板 ${nArt} · ${out.length} 字节 · __ai_view 已再生`);
console.log('  提示：编辑器重新打开该文件即可看到 AI 调整结果。');
