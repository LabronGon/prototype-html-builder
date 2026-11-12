#!/usr/bin/env node
/**
 * check-slop.mjs — 反 slop 静态门禁（v1.6）
 * 方法论改编自 unslop（Damir Sokolovsky @heydamir，CC BY 4.0），
 * 规范落点：skill references/design-system.md §6、GUIDE v1.4「默认风格基线」。
 *
 * 只做静态可检测项，命中即报（行号 + 原文截断），退出码 0/1：
 *   1 渐变文字          background-clip:text（含 -webkit-）
 *   2 循环动画          animate-pulse/ping/bounce/spin、animation:...infinite
 *   3 catch-all 过渡    transition-all / transition: all
 *   4 emoji 文本        __doc JSON 与 #__ai_view 中出现 emoji（图标必须是 SVG，硬性约束 1）
 *   5 色相跨越渐变       CSS linear-gradient 与 __doc 节点 fills 渐变，两端色相差 >60° 且双方饱和度 >20%（同色明度渐变放行）
 *   6 text-shadow 发光   出现即报（界面文本用字重与颜色分层，不用阴影）
 *
 * 用法：node tools/check-slop.mjs <a.chao.html> [b.chao.html ...]
 */
import { readFile } from 'node:fs/promises';

const files = process.argv.slice(2);
if (!files.length) { console.error('用法：node tools/check-slop.mjs <file.chao.html> [more...]'); process.exit(1); }

/* ---- 颜色解析：#hex 与 rgb/rgba → [h,s,l]（s/l 为 0-1） ---- */
function toHsl(color) {
  let r, g, b;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(color.trim());
    if (!m) return null;
    [r, g, b] = [+m[1], +m[2], +m[3]];
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60) % 360, s, l];
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u;

function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }
function clip(text, idx, n = 70) {
  const raw = text.slice(idx, idx + n).replace(/\s+/g, ' ');
  return raw.length > n ? raw + '…' : raw;
}

/* ---- 单文件扫描 ---- */
async function scan(file) {
  let text = await readFile(file, 'utf8');
  /* 挖掉规范注释区：GUIDE / AI-NOTICE 的正文里写有禁用项名字（如 transition-all），
     属于规范文本不是产物代码，必须排除，否则门禁自指误报 */
  text = text
    .replace(/<!-- =+\r?\nPROTOTYPE-AI-GUIDE[\s\S]*?={20,} *-->/g, '')
    .replace(/<!-- AI-NOTICE[\s\S]*?-->/g, '');
  const hits = [];
  const push = (rule, idx, extra = '') => hits.push(`L${lineOf(text, idx)}  [${rule}]  ${clip(text, idx)}${extra}`);

  /* 1 渐变文字 */
  for (const m of text.matchAll(/(?:-webkit-)?background-clip\s*:\s*text/gi)) push('渐变文字', m.index);

  /* 2 循环动画 */
  for (const m of text.matchAll(/animate-(?:pulse|ping|bounce|spin)\b/g)) push('循环动画', m.index);
  for (const m of text.matchAll(/animation\s*:[^;}{]*infinite/gi)) push('循环动画', m.index);

  /* 3 catch-all 过渡 */
  for (const m of text.matchAll(/transition-all|transition\s*:\s*all\b/g)) push('transition-all', m.index);

  /* 5 色相跨越渐变（同色明度/透明度渐变放行） */
  for (const m of text.matchAll(/linear-gradient\(([^)]*)\)/gi)) {
    const colors = [...m[1].matchAll(/#[0-9a-f]{3,8}|rgba?\(\s*\d+\s*[,\s]\s*\d+\s*[,\s]\s*\d+/gi)].map((x) => toHsl(x[0])).filter(Boolean);
    const solid = colors.filter(([, s]) => s > .2);
    if (solid.length >= 2) {
      const [h1] = solid[0], [h2] = solid[solid.length - 1];
      if (hueDist(h1, h2) > 60) push('色相跨越渐变', m.index, `  hue ${Math.round(h1)}° → ${Math.round(h2)}°`);
    }
  }

  /* 6 text-shadow 发光 */
  for (const m of text.matchAll(/text-shadow\s*:/gi)) push('text-shadow', m.index);

  /* 4 emoji（只查 __doc JSON 与 #__ai_view，避免误伤壳注释） */
  const zones = [];
  const dm = /<script type="application\/json" id="__doc">([\s\S]*?)<\/script>/.exec(text);
  if (dm) zones.push([dm.index, dm.index + dm[0].length]);
  const vm = /<script type="text\/plain" id="__ai_view">([\s\S]*?)<\/script>/.exec(text);
  if (vm) zones.push([vm.index, vm.index + vm[0].length]);
  for (const [a, b] of zones) {
    const zone = text.slice(a, b);
    for (const m of zone.matchAll(new RegExp(EMOJI_RE.source, 'gu')))
      hits.push(`L${lineOf(text, a + m.index)}  [emoji 文本]  ${clip(zone, Math.max(0, m.index - 20), 60)}`);
  }

  /* 5b __doc 节点 fills 渐变的色相跨越（v1.6：build 开始直出渐变，JSON 形态与 CSS 同规则） */
  if (dm) {
    try {
      const doc = JSON.parse(dm[1].replace(/\\u003c/g, '<'));
      const walkFills = (nd) => {
        if (!nd || typeof nd !== 'object') return;
        for (const f of nd.fills || []) {
          if (!f || (f.type !== 'linear' && f.type !== 'radial') || f.on === false) continue;
          const stops = (f.stops || []).filter((s) => s && s.on !== false);
          const cols = stops.map((s) => toHsl(s.color)).filter(Boolean);
          const solid = cols.filter(([, s]) => s > .2);
          if (solid.length >= 2) {
            const [h1] = solid[0], [h2] = solid[solid.length - 1];
            if (hueDist(h1, h2) > 60) hits.push(`L${lineOf(text, dm.index)}  [色相跨越渐变(JSON)]  节点 "${nd.name || nd.id}" hue ${Math.round(h1)}° → ${Math.round(h2)}°`);
          }
        }
        for (const c of nd.children || []) walkFills(c);
      };
      for (const p of doc.pages || []) for (const ab of p.artboards || []) walkFills(ab);
    } catch (e) { /* __doc 非法 JSON 由 validate-doc 负责 */ }
  }
  return hits;
}

let bad = 0;
for (const f of files) {
  const hits = await scan(f);
  if (hits.length) {
    bad++;
    console.log(`FAIL  ${f}（${hits.length} 处）`);
    hits.forEach((h) => console.log('  ' + h));
  } else {
    console.log(`PASS  ${f}`);
  }
}
console.log(bad ? `SLOP FAIL（${bad}/${files.length} 文件命中）` : 'SLOP PASS');
process.exitCode = bad ? 1 : 0;
