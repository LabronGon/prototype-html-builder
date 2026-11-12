#!/usr/bin/env node
/**
 * check-grouping.mjs — v1.9 首版语义编组门禁
 *
 * 首版生成界面必须先做编组规划：画板顶层只放「语义区块」group，
 * 业务元素归入所属区块，不得把几十个叶子平铺在画板里。
 * 规则来自 __doc.pageSpec.grouping（首版锁定，缺省用 PC/APP 基线）。
 *
 * 用法：node scripts/check-grouping.mjs <产物.chao.html> [...] [--strict] [--quiet]
 *   --strict  任一画板不达标即 FAIL(1)；不加时只输出体检报告（适合历史稿）
 *   --quiet   只输出每个文件的一行结论
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = {
  pc: { minGroupRatio: 0.8, maxTopLevelLoose: 3, maxDepth: 3, maxChildrenPerGroup: 12 },
  app: { minGroupRatio: 0.8, maxTopLevelLoose: 2, maxDepth: 3, maxChildrenPerGroup: 10 },
};

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const QUIET = argv.includes('--quiet');
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.log('用法：node scripts/check-grouping.mjs <产物.chao.html> [...] [--strict] [--quiet]');
  process.exit(0);
}

const isUnit = (n) => !!n && (n.type === 'group' || n.type === 'bool' || !!(n.inst || n.cont));
/** 几何兜底编组会产出「区块 1 / 组 2」这类无语义命名 —— 首版必须显式规划，门禁要拦住 */
const GENERIC_NAME = /^(区块|组|群组|分组|图层组|Layer|Group|Frame)\s*[-_]?\s*\d+$/i;

/** 统计一棵子树里的叶子数与最大嵌套深度 */
function treeStats(list, depth) {
  let leaves = 0, maxDepth = depth, tooWide = 0;
  for (const n of list || []) {
    const kids = Array.isArray(n.children) && n.children.length ? n.children : null;
    if (!kids) { leaves++; continue; }
    tooWide += kids.length > 24 ? 1 : 0; // 极端扁平组（只作提示，不单独判失败）
    const s = treeStats(kids, depth + 1);
    leaves += s.leaves;
    maxDepth = Math.max(maxDepth, s.maxDepth);
    tooWide += s.tooWide;
  }
  return { leaves, maxDepth, tooWide };
}

function checkDoc(doc) {
  const g = (doc.pageSpec && doc.pageSpec.grouping) || {};
  const pl = g.platform === 'app' || (doc.pageSpec && doc.pageSpec.platform) === 'app' ? 'app' : 'pc';
  const rule = { ...BASE[pl], ...g };
  const rows = [], issues = [];

  if (!doc.pageSpec || !doc.pageSpec.grouping) {
    issues.push('未声明 pageSpec.grouping（首版语义编组规划）：首版请用 sections / section 规划语义区块');
  }
  (doc.pages || []).forEach((p, pi) => {
    if (p.comp || p.kit) return; // 组件库页 / 母版画板不参与编组门禁
    (p.artboards || []).forEach((ab) => {
      if (ab.master) return;
      const tops = ab.children || [];
      const groups = tops.filter(isUnit);
      const loose = tops.filter((n) => !isUnit(n));
      let groupedLeaves = 0, maxDepth = 0, tooWide = 0;
      for (const g2 of groups) {
        const s = treeStats(g2.children || [], 1);
        groupedLeaves += Math.max(1, s.leaves); // 空组按 1 计（仍算一个区块）
        maxDepth = Math.max(maxDepth, s.maxDepth);
        tooWide += s.tooWide;
      }
      const total = groupedLeaves + loose.length;
      const ratio = total ? groupedLeaves / total : 1;
      const label = `page ${pi} / ${ab.name || '画板'}`;
      const bad = [];
      if (loose.length > rule.maxTopLevelLoose) bad.push(`顶层散落叶子 ${loose.length} > ${rule.maxTopLevelLoose}`);
      if (ratio < rule.minGroupRatio) bad.push(`编组覆盖率 ${ratio.toFixed(2)} < ${rule.minGroupRatio}`);
      if (maxDepth > rule.maxDepth) bad.push(`嵌套 ${maxDepth} > ${rule.maxDepth} 层`);
      const wide = groups.filter((n) => (n.children || []).length > rule.maxChildrenPerGroup);
      if (wide.length) bad.push(`${wide.length} 个区块的直接子元素 > ${rule.maxChildrenPerGroup}`);
      const generic = groups.filter((n) => GENERIC_NAME.test(String(n.name || '')));
      if (generic.length) bad.push(`${generic.length} 个区块用无语义命名（${generic.slice(0, 3).map((n) => n.name).join('、')}）——首版请用 sections 显式命名`);
      rows.push({ label, tops: tops.length, groups: groups.length, loose: loose.length,
        ratio, maxDepth, bad, groupNames: groups.map((n) => n.name || n.type).slice(0, 12) });
      if (bad.length) issues.push(`${label}：${bad.join('；')}`);
    });
  });
  return { rows, issues, rule, pl };
}

let failed = 0;
for (const file of files) {
  let html;
  try { html = await readFile(path.resolve(file), 'utf8'); }
  catch (e) { console.error(`FAIL  读不到文件：${file}`); failed++; continue; }
  const m = html.match(/<script[^>]*id="__doc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) { console.error(`FAIL  找不到 <script id="__doc">：${file}`); failed++; continue; }
  let doc;
  try { doc = JSON.parse(m[1]); }
  catch (e) { console.error(`FAIL  __doc JSON 解析失败：${file} ${e.message}`); failed++; continue; }

  const r = checkDoc(doc);
  const ok = !r.issues.length;
  if (!ok && STRICT) failed++;
  if (QUIET) {
    console.log(`${ok ? 'PASS' : (STRICT ? 'FAIL' : 'WARN')}  ${file}  编组基线=${r.pl}`);
    continue;
  }
  console.log(`\n=== ${file} ===`);
  console.log(`基线 ${r.pl} · 覆盖率≥${r.rule.minGroupRatio} · 顶层散落≤${r.rule.maxTopLevelLoose} · 嵌套≤${r.rule.maxDepth} 层 · 每组子元素≤${r.rule.maxChildrenPerGroup}`);
  for (const row of r.rows) {
    console.log(`  ${row.bad.length ? '✗' : '✓'} ${row.label}: 顶层 ${row.tops} · 区块 ${row.groups} · 散落 ${row.loose} · 覆盖率 ${row.ratio.toFixed(2)} · 深度 ${row.maxDepth}`);
    if (row.groupNames.length) console.log(`      区块: ${row.groupNames.join(' / ')}`);
    if (row.bad.length) row.bad.forEach((b) => console.log(`      - ${b}`));
  }
  if (r.issues.length) {
    console.log(`  ${STRICT ? 'FAIL' : '提示'}  ${r.issues.length} 项：`);
    r.issues.forEach((x) => console.log('      - ' + x));
  } else console.log('  PASS  首版语义编组规划达标');
}
if (STRICT && failed) {
  console.error(`\nGROUPING FAIL  ${failed} 个文件未过编组门禁（--strict）`);
  process.exit(1);
}
if (STRICT) console.log('\nGROUPING PASS  ' + files.length + ' 个文件');
