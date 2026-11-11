// Minimal Chrome DevTools Protocol client, no dependencies (Node >= 22).
// usage: node cdp.mjs <url> <analyzer.js> [settleMs]
// env:   CDP_PORT        debugging port of the running Chrome (default 9250)
//        CDP_BACKGROUND  set to 1 to open the tab in background (lazy content may not load)
//        CDP_MAX_SCROLLS upper bound for the scroll loop (default 40)
import fs from 'fs';
const [,, url, analyzerPath, settleMs = '4000'] = process.argv;
if (!url || !analyzerPath) { console.error('usage: node cdp.mjs <url> <analyzer.js> [settleMs]'); process.exit(2); }
const port = process.env.CDP_PORT || '9250';
const maxScrolls = +(process.env.CDP_MAX_SCROLLS || 40);
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ver;
try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); }
catch (e) {
  console.error(`Chrome not reachable on 127.0.0.1:${port}. Start it with:\n  chrome --remote-debugging-port=${port} --user-data-dir=<dedicated profile dir>`);
  process.exit(1);
}
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const listeners = [];
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id;
  const t = setTimeout(() => { pend.delete(i); rej(new Error(`timeout waiting for ${method}`)); }, 60000);
  pend.set(i, { res: v => { clearTimeout(t); res(v); }, rej: e => { clearTimeout(t); rej(e); } });
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
// resolves true when the event arrives, false after timeoutMs
const once = (method, sessionId, timeoutMs) => new Promise(res => {
  const l = { method, sessionId, fn: () => { clearTimeout(t); res(true); } };
  const t = setTimeout(() => { listeners.splice(listeners.indexOf(l), 1); res(false); }, timeoutMs);
  listeners.push(l);
});
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method) for (const l of [...listeners]) if (l.method === m.method && (!l.sessionId || l.sessionId === m.sessionId)) { listeners.splice(listeners.indexOf(l), 1); l.fn(); }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket error')); });

let exitCode = 0;
const { targetId } = await send('Target.createTarget', { url: 'about:blank', background: process.env.CDP_BACKGROUND === '1' });
try {
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  const loaded = once('Page.loadEventFired', sessionId, 30000);
  const nav = await send('Page.navigate', { url }, sessionId);
  if (nav.errorText) throw new Error(`navigation failed: ${nav.errorText}`);
  if (!await loaded) console.error('warning: load event not seen within 30s, continuing');
  await sleep(+settleMs);
  // scroll until the page stops growing, to trigger lazy content
  let lastH = -1, still = 0;
  for (let i = 0; i < maxScrolls && still < 2; i++) {
    const r = await send('Runtime.evaluate', { expression: 'window.scrollBy(0, window.innerHeight); document.documentElement.scrollHeight', returnByValue: true }, sessionId);
    await sleep(800);
    const h = r.result.value; still = h === lastH ? still + 1 : 0; lastH = h;
  }
  const expr = fs.readFileSync(analyzerPath, 'utf8');
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error('analyzer threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  console.log(JSON.stringify(r.result.value, null, 1));
} catch (e) { console.error(String(e.message || e)); exitCode = 1; }
finally { try { await send('Target.closeTarget', { targetId }); } catch (e) {} ws.close(); }
process.exit(exitCode);
