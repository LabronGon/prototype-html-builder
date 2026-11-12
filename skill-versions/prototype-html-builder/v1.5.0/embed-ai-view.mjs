#!/usr/bin/env node
/**
 * embed-ai-view.mjs — 给旧 .chao.html 补嵌 AI 协作块（v1.2.1）
 *
 * 做两件事：
 *   1. 缺少 PROTOTYPE-AI-GUIDE 注释时，插到 __doc 之前；
 *   2. 从内嵌 __doc 提取文档，重新生成 #__ai_view 逐行清单并写回。
 *
 * 用法：
 *   node scripts/embed-ai-view.mjs a.chao.html [b.chao.html ...]   # 原地更新
 *   node scripts/embed-ai-view.mjs in.html -o out.html                       # 写到新文件
 *
 * 退出码：0 = 成功；1 = 失败。
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedAIBlocks, AI_HINT } from './ai-view.mjs';

const argv = process.argv.slice(2);
const oi = argv.indexOf('-o');
const outArg = oi >= 0 ? path.resolve(argv[oi + 1]) : null;
const files = argv.filter((a, i) => !a.startsWith('-') && (oi < 0 || i !== oi + 1));
if (!files.length) {
  console.error('用法：node scripts/embed-ai-view.mjs <file.chao.html> [...] [-o out.html]');
  process.exit(1);
}
if (outArg && files.length > 1) { console.error('FAIL  -o 只能配合单个输入文件'); process.exit(1); }

let failed = 0;
for (const f of files) {
  const p = path.resolve(f);
  try {
    const html = await readFile(p, 'utf8');
    const m = html.match(/<script type="application\/json" id="__doc">([\s\S]*?)<\/script>/);
    if (!m) { console.error(`FAIL  ${p}：找不到内嵌 __doc`); failed++; continue; }
    let doc;
    try { doc = JSON.parse(m[1]); } catch (e) { console.error(`FAIL  ${p}：__doc JSON 解析失败（${e.message}）`); failed++; continue; }
    const hadGuide = html.includes('PROTOTYPE-AI-GUIDE');
    const hadView = /<script type="text\/plain" id="__ai_view">/.test(html);
    // v1.2.2：刷新 __doc.aiHint（旧文件补嵌时同样带上开发规范约定）
    doc.aiHint = AI_HINT;
    const refreshed = html.replace(/<script type="application\/json" id="__doc">[\s\S]*?<\/script>/,
      () => '<script type="application/json" id="__doc">'
        + JSON.stringify(doc).replace(/</g, '\\u003c') + '</script>');
    const out = embedAIBlocks(refreshed, doc);
    await writeFile(outArg || p, out, 'utf8');
    const abCount = (doc.pages || []).reduce((s, pg) => s + (pg.artboards || []).length, 0);
    console.log(`OK    ${path.basename(p)}  GUIDE:${hadGuide ? '已有' : '新插入'}  ai_view:${hadView ? '已再生' : '新嵌入'}  （${(doc.pages || []).length} 页 ${abCount} 画板，${out.length} 字节）${outArg ? ' → ' + path.basename(outArg) : ''}`);
  } catch (e) {
    console.error(`FAIL  ${p}：${e.message}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
