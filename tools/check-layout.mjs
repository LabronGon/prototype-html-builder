#!/usr/bin/env node
/**
 * check-layout.mjs — 布局对齐审计（v1.7，卡片分桶降噪版）
 * 检查 .chao.html 内嵌文档的画板节点是否存在「差一点对齐」的错位。
 *
 * 分桶规则：每个节点归属「包含其中心的、name 以 卡 结尾的最小 rect」（无则归画板级桶）；
 * 对齐只在**同一桶内**比较——跨卡片/跨列的比较视为有意布局，不报。
 *
 * 规则：
 *   A 近失对齐    同桶内两节点左缘/顶缘相差 ≤TOL 但不相等（值文本的右缘不比——左对齐文本右缘天然参差）
 *   B 行高不齐    同桶内垂直显著重叠的两矩形卡高度不等
 *   C 纵距不齐    同桶内同一 x 序列相邻纵向间距不一致（差 >TOL）
 *   D 宽度不齐    同名系列（去掉尾部序号）在桶内宽度接近但不等
 *   E 列底不齐    同一列锚（顶级卡同 x）的卡序列最大底 y 相差 >8（画板内各列应底对齐）
 *   F 内容溢出    桶内节点超出所属卡右缘/下缘 >2px（贴边相等不报）
 *
 * 用法：node tools/check-layout.mjs <a.chao.html> [b...] [--tol 4] [--strict]
 *   --tol    近失判定阈值 px（默认 4；差 ≥TOL 视为有意错位不报）
 *   --strict 有任何命中即退出码 1（默认仅警告）
 */
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const tolI = args.indexOf('--tol');
const TOL = tolI >= 0 ? Number(args[tolI + 1]) || 4 : 4;
const STRICT = args.includes('--strict');
if (!files.length) { console.error('用法：node tools/check-layout.mjs <file.chao.html> [--tol 4] [--strict]'); process.exit(1); }

const near = (a, b) => a !== b && Math.abs(a - b) <= TOL;

function boxesOf(n) {
  if (n.cont && n.inst && (n.w || n.h)) return { x: n.x || 0, y: n.y || 0, w: n.w || 0, h: n.h || 0 }; // 实例用声明尺寸
  if (n.cont && n.children && n.children.length) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const w = (l) => { for (const c of l) { if (c.hidden) continue; x1 = Math.min(x1, c.x); y1 = Math.min(y1, c.y); x2 = Math.max(x2, c.x + (c.w || 0)); y2 = Math.max(y2, c.y + (c.h || 0)); w(c.children || []); } };
    w(n.children);
    return { x: n.x, y: n.y, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
  }
  return { x: n.x || 0, y: n.y || 0, w: n.w || 0, h: n.h || 0 };
}

function auditArtboard(ab) {
  const out = [];
  const flat = [];
  // v1.9 同版口径修复：纯逻辑编组容器（非组件实例）的包围盒由子节点派生，不参与像素对齐审计
  const walk = (list) => { for (const n of list || []) { if (n.hidden) continue; if (!((n.type === 'group' || n.type === 'bool') && !n.cont && !n.inst)) flat.push(n); if (!n.cont) walk(n.children); } };
  walk(ab.children || []);

  const cards = flat.filter((n) => n.type === 'rect' && /卡$/.test(n.name || '') && (n.w || 0) >= 120 && (n.h || 0) >= 60).map((n) => ({ n, ...boxesOf(n) }));
  const bucketOf = (it) => {
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    let best = null;
    for (const c of cards) {
      if (cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h) {
        const area = c.w * c.h;
        if (!best || area < best.area) best = { ...c, area };
      }
    }
    return best ? best.n.name : '(画板级)';
  };

  const items = flat
    .filter((n) => (boxesOf(n).w || 0) >= 20 && (boxesOf(n).h || 0) >= 10 && n.type !== 'svg' && !(n.cont && n.inst && /top-bar|side-nav/.test(n.inst)))
    .map((n) => ({ n, ...boxesOf(n) }))
    .map((it) => ({ ...it, bucket: bucketOf(it) }));
  const blockers = flat
    .filter((n) => (boxesOf(n).w || 0) >= 20 && n.type !== 'svg' && !(n.cont && n.inst && /top-bar|side-nav/.test(n.inst)))
    .map((n) => ({ n, ...boxesOf(n) }))
    .map((it) => ({ ...it, bucket: bucketOf(it) }));

  const buckets = new Map();
  for (const it of items) { const arr = buckets.get(it.bucket) || []; arr.push(it); buckets.set(it.bucket, arr); }

  for (const [bucket, arr] of buckets) {
    const bkt = (list) => list.filter((it) => it.bucket === bucket);
    // A 左缘/顶缘近失（自动宽文本不比右缘；文本顶缘只在同 fontSize 间比）
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const nmA = a.n.name || a.n.id, nmB = b.n.name || b.n.id;
      if (near(a.x, b.x)) out.push(`A左缘 [${bucket}] ${nmA}(${a.x}) ↔ ${nmB}(${b.x})`);
      const horizOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0; // 顶缘只比水平区间有交叠的元素对
      if (near(a.y, b.y) && horizOverlap && Math.abs(a.h - b.h) <= TOL && (a.n.type !== 'text' || b.n.type !== 'text' || a.n.fontSize === b.n.fontSize))
        out.push(`A顶缘 [${bucket}] ${nmA}(${a.y}) ↔ ${nmB}(${b.y})`);
    }
    // B 视觉同行但不等高（限按钮/卡/chip 命名的矩形——图标底等装饰件与按钮的高度差是有意居中）
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const named = (it) => /按钮|卡$|chip$|行$/.test(it.n.name || '');
      if (a.n.type === 'rect' && b.n.type === 'rect' && named(a) && named(b) && near(a.y, b.y)) {
        const ov = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ov > 0.6 * Math.min(a.h, b.h) && Math.abs(a.h - b.h) > TOL)
          out.push(`B等高 [${bucket}] ${a.n.name}(h=${a.h}) ↔ ${b.n.name}(h=${b.h})`);
      }
    }
    // C 纵距不齐（同桶内**同类型**节点同 x 序列 ≥3 项——不同类型间的组间距允许大于行间距）
    const cols = new Map();
    for (const it of arr) {
      const kind = it.n.comp ? 'inst:' + it.n.comp : (it.n.type === 'rect' ? 'rect' : it.n.type);
      const k = kind + '@' + Math.round(it.x);
      const l = cols.get(k) || []; l.push(it); cols.set(k, l);
    }
    for (const [k, l] of cols) {
      if (l.length < 3) continue;
      const s = l.sort((p, q) => p.y - q.y);
      const gaps = s.slice(1).map((it, i) => Math.round(it.y - (s[i].y + s[i].h)));
      // 每个 gap 的隔断标志：段内夹着同桶其他节点 → 该段间距由夹层元素决定
      const segBlocked = s.slice(1).map((it, i) => {
        const segTop = s[i].y + s[i].h, segBot = it.y;
        return bkt(blockers).some((m) => m !== s[i] && m !== it && m.y >= segTop && m.y + m.h <= segBot && m.h < segBot - segTop);
      });
      for (let i = 1; i < gaps.length; i++) {
        if (!(gaps[i] >= 0 && gaps[i - 1] >= 0) || Math.abs(gaps[i] - gaps[i - 1]) <= TOL) continue;
        if (segBlocked[i] || segBlocked[i - 1]) continue; // 任一段被隔断则该组间距无对齐意义
        out.push(`C纵距 [${bucket}] ${k} 序列 gap ${gaps[i - 1]} → ${gaps[i]}`);
      }
    }
    // D 同名系列宽度不齐（仅形状节点 rect/ellipse/instance；文本 auto-width 天然不同不比）
    const byName = new Map();
    for (const it of arr) {
      if (it.n.type === 'text') continue;
      const k = (it.n.comp || it.n.name || '').replace(/\d+$/, '');
      const l = byName.get(k) || []; l.push(it); byName.set(k, l);
    }
    for (const [k, l] of byName) {
      if (l.length < 2 || /竖条|航点|航线段|腿|扫描线|取景框|地面线|滑块|灯|REC/.test(k)) continue;
      const ws = l.map((it) => Math.round(it.w));
      if (new Set(ws).size > 1 && Math.max(...ws) - Math.min(...ws) <= 40 && Math.max(...ws) >= 40)
        out.push(`D等宽 [${bucket}] ${k} 宽度 ${ws.join('/')}`);
    }
  }
  // E 列底不齐：各列（同 x 顶级卡组）的内容最大底 y，列与列之间相差 >8（嵌套子卡不参与）
  {
    let colCards = (ab.children || []).filter((n) => (n.type === 'rect' && ((/卡$/.test(n.name || '') && (n.w || 0) >= 120) || ((n.w || 0) >= 120 && (n.h || 0) >= 40))));
    colCards = colCards.filter((c) => { // 排除完全落在更大卡内的嵌套子卡
      const b = boxesOf(c);
      return !colCards.some((o) => { if (o === c) return false; const B = boxesOf(o); return B.w * B.h > b.w * b.h && b.x >= B.x && b.y >= B.y && b.x + b.w <= B.x + B.w + 0.5 && b.y + b.h <= B.y + B.h + 0.5; });
    });
    const cols = new Map();
    for (const c of colCards) { const b = boxesOf(c); const k = Math.round(b.x); const l = cols.get(k) || []; l.push({ n: c, bot: b.y + b.h }); cols.set(k, l); }
    const colBots = [...cols.entries()].map(([k, l]) => ({ k, bot: Math.max(...l.map((it) => Math.round(it.bot))) }));
    if (colBots.length >= 2) {
      const max = Math.max(...colBots.map((c) => c.bot)), min = Math.min(...colBots.map((c) => c.bot));
      if (max - min > 8)
        out.push(`E列底 [画板级] 各列内容底 ${colBots.map((c) => `x=${c.k}→${c.bot}`).join(' ')}（最大差 ${max - min}px，应底对齐）`);
    }
  }
  // F 内容溢出：桶内节点超出所属卡右缘/下缘 >2px（完全嵌套的子卡除外）
  {
    for (const card of cards) {
      const B = boxesOf(card); const X = B.x, Y = B.y, W = B.w, H = B.h;
      for (const it of items) {
        if (it.n === card.n) continue;
        if (it.bucket !== card.n.name) continue;
        if (it.x >= X && it.y >= Y && it.x + it.w <= X + W + 0.5 && it.y + it.h <= Y + H + 0.5) continue; // 未溢出
        const overR = Math.round(it.x + it.w - (X + W)), overB = Math.round(it.y + it.h - (Y + H));
        if (overR > 2) out.push(`F右溢出 [${card.n.name}] ${it.n.name || it.n.comp} 右缘超出 ${overR}px`);
        if (overB > 2) out.push(`F下溢出 [${card.n.name}] ${it.n.name || it.n.comp} 底部超出 ${overB}px`);
      }
    }
  }
  return [...new Set(out)];
}

let bad = 0;
for (const f of files) {
  const text = await readFile(f, 'utf8');
  const s = text.indexOf('id="__doc"'), a = text.indexOf('>', s) + 1, b = text.indexOf('</' + 'script>', a);
  let doc; try { doc = JSON.parse(text.slice(a, b).replace(/\\u003c/g, '<')); } catch (e) { console.log(`FAIL  ${f}（__doc 解析失败）`); bad++; continue; }
  const issues = [];
  for (const p of doc.pages || []) for (const ab of p.artboards || []) {
    if (p.comp) continue; // 组件库展示页不审
    for (const h of auditArtboard(ab)) issues.push(`${p.name}/${ab.name}: ${h}`);
  }
  if (issues.length) {
    bad++;
    console.log(`FAIL  ${f}（${issues.length} 处，tol=${TOL}）`);
    issues.forEach((h) => console.log('  ' + h));
  } else {
    console.log(`PASS  ${f}（tol=${TOL}）`);
  }
}
if (STRICT) process.exitCode = bad ? 1 : 0;
else console.log(bad ? `LAYOUT WARN（${bad}/${files.length} 文件有对齐问题）` : 'LAYOUT PASS');
