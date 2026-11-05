#!/usr/bin/env node
// 提交前门禁：扫描留库文本中的第三方对标 / 历史措辞，命中即失败。
// 用法：node tools/check-wording.mjs
// 说明：CONTRIBUTING.md 是禁用词清单本身，列入白名单；archive/ 为本地归档、
//       skill-versions/ 为冻结快照，均不扫描。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 拼接构造，避免本脚本源码自身成为命中源
const BANNED = [
  'Master' + 'Go',
  'Fig' + 'ma',
  'Pen' + 'pot',
  '逆' + '向',
  '复' + '刻',
  '靠' + '拢',
  '1:1 像' + '素',
];
const RE = new RegExp(BANNED.join('|'), 'i');

const SKIP_DIRS = new Set([
  '.git', '.workbuddy', '.playwright-cli', 'archive', 'skill-versions',
  'node_modules', '.github',
]);
const ALLOW_FILES = new Set(['CONTRIBUTING.md']);
const EXTS = new Set([
  '.html', '.htm', '.md', '.markdown', '.mjs', '.js', '.cjs',
  '.css', '.json', '.txt', '.yml', '.yaml',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, out);
    } else if (EXTS.has(path.extname(e.name).toLowerCase())) {
      if (!ALLOW_FILES.has(e.name)) out.push(p);
    }
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = RE.exec(line);
    if (m) {
      hits.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: i + 1,
        word: m[0],
        text: line.trim().slice(0, 140),
      });
    }
  });
}

if (hits.length) {
  console.error(`FAIL：发现 ${hits.length} 处禁用表述\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line} [${h.word}] ${h.text}`);
  console.error('\n请按自研体系术语改写，规则见 CONTRIBUTING.md');
  process.exit(1);
}
console.log(`PASS：扫描完成，0 处禁用表述（禁用项 ${BANNED.length} 条）`);
