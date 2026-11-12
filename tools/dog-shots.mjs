/* 机器狗巡检 demo 三画板效果图（演示模式） */
import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FILE = path.join(ROOT, '2026-11-11-机器狗巡检.chao.html');
const PROFILE = path.join(HERE, 'dog-shot-profile');
const PORT = 9341;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = 'file:///' + FILE.replace(/\\/g, '/').replace(/ /g, '%20');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--allow-file-access-from-files', '--window-size=1600,980', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 40000);
});
const ev = async (expr, tag = '') => {
  if (tag) console.log('STEP  ' + tag);
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) console.log('  JS ERROR: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
const shot = async name => {
  await wait(700);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(ROOT, name), Buffer.from(r.data, 'base64'));
  console.log('SHOT  ' + name);
};
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch (e) {}
    await wait(250);
  }
  const t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(x => x.type === 'page');
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  await wait(2600);
  console.log('alive: ' + await ev('1+1'));
  await ev(`(()=>{const t=document.querySelector('#toast');if(t)t.style.display='none';return true})()`);
  const names = ['设备监控', '远程控制', '设备绑定'];
  await ev(`demoStart()`, '进入演示模式');
  await wait(900);
  for (let k = 0; k < names.length; k++) {
    const idx = await ev(`(()=>{const s=demoSeq();const i=s.findIndex(ab=>ab.name===${JSON.stringify(names[k])});
      if(i<0)throw new Error('画板未找到：'+${JSON.stringify(names[k])}+' seq='+s.map(x=>x.name).join('/'));
      demoJump(i,null,false);return i})()`, `跳转 ${names[k]}`);
    await wait(900);
    await shot(`dog-0${k + 1}-${names[k]}.png`);
  }
  await ev(`demoExit()`);
  console.log('DONE');
} catch (e) {
  console.error('FATAL', e);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch (e) {}
  try { chrome.kill(); } catch (e) {}
  await wait(400);
  try { await rm(PROFILE, { recursive: true, force: true }); } catch (e) {}
}
