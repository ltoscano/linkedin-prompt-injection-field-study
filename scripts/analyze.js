(() => {
// ---------- pattern ----------
const AI = String.raw`(AI|A\.I\.|IA|LLM|GPT|ChatGPT|Claude|Gemini|Copilot|Grok|Perplexity|language model|modello linguistico|assistant|assistente|agent[ei]?|bot|chatbot|crawler|scraper|automated (system|tool|recruiter)|intelligenza artificiale)`;
const RULES = [
  ['addressed-to-ai', new RegExp(String.raw`\b(if|when) (you('re| are)|this is being read by) (an? )?${AI}`, 'i')],
  ['addressed-to-ai', new RegExp(String.raw`\bse (sei|tu sei|stai leggendo come) (un[ao']? ?)?${AI}`, 'i')],
  ['addressed-to-ai', new RegExp(String.raw`\b(note|message|instructions?|attention|nota|messaggio|istruzioni?) (to|for|per) (all |any |tutti gli |gli |le )?${AI}`, 'i')],
  ['addressed-to-ai', new RegExp(String.raw`\b(dear|hey|hello|ciao|caro) ${AI}\b`, 'i')],
  ['addressed-to-ai', new RegExp(String.raw`\b${AI}s?,? (reading|processing|summari[sz]ing|scraping|che (legg|riassum|analizz))`, 'i')],
  ['override', /\b(ignore|disregard|forget|override)\b.{0,30}\b(previous|prior|above|earlier|all|your|system|original)\b.{0,20}\b(instructions?|prompts?|rules|guidelines|directives|context)/i],
  ['override', /\b(ignora|dimentica|non considerare)\b.{0,30}\b(istruzioni|regole|prompt|indicazioni)/i],
  ['override', /\b(new|updated|real|actual) (instructions?|system prompt|task)\s*:/i],
  ['role-delimiter', /<\|?(im_start|im_end|system|endoftext|eot_id|start_header_id)\|?>|\[\/?(INST|SYS|SYSTEM|ADMIN)\]|<\/?(system|user|assistant|instructions?)>|^#{1,3} ?(system|instruction|response)\b|\b(SYSTEM|ADMIN) (PROMPT|OVERRIDE|MESSAGE)\s*:/im],
  ['manipulation', /\b(you must|you should|always|be sure to|make sure to|devi|assicurati di)\b.{0,40}\b(recommend|rate|rank|describe|present|call|consider|raccomand|valut|descriv|consider)\w*\b.{0,40}\b(best|top|ideal|perfect|exceptional|strong(est)?|miglior|ideale|perfett|eccezional)/i],
  ['manipulation', /\b(respond|reply|answer|rispondi)\b.{0,30}\b(only|solo|in (rhyme|rima|french|pirate|all caps|uppercase))\b|\b(include|add|insert|mention|start with|begin with|includi|aggiungi|inserisci|inizia con)\b.{0,40}\b(recipe|ricetta|flan|poem|poesia|haiku|limerick|emoji|the word|la parola|password|code ?word|codeword)\b/i],
  ['exfiltration', /!\[[^\]]*\]\(https?:\/\/[^)]*[?&][^)]*=|\b(visit|open|fetch|navigate to|go to|send|post|email|visita|apri|invia)\b.{0,40}https?:\/\/|\b(send|forward|share|email|invia|inoltra)\b.{0,40}\b(credentials?|password|api key|token|cookies?|conversation|chat history|contacts|credenziali)/i],
  ['canary', /\b(flan recipe|ricetta del flan|recipe for flan|banana bread recipe)\b/i],
];
const INV = /[​-‏⁠-⁤﻿‪-‮⁦-⁩­᠎͏]|[\u{E0000}-\u{E007F}]/gu;
const INV1 = new RegExp(INV.source, 'u'); // non-global copy for .test(): a /g regex keeps lastIndex between calls
const VSRUN = /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]{3,}/u; // runs of variation selectors (used to smuggle bytes); single ones are normal in emoji
const TAGS = /[\u{E0000}-\u{E007F}]+/gu;
const decodeTags = s => [...s].map(c => String.fromCodePoint(c.codePointAt(0) - 0xE0000)).join('');
const B64 = /\b[A-Za-z0-9+\/]{60,}={0,2}(?![A-Za-z0-9+\/])/g;
const mixedScript = w => /[a-z]/i.test(w) && /[Ѐ-ӿͰ-Ͽ]/.test(w);
const UGC = '.reader-article-content, .reader-content-blocks, .reader-article-header, article, .update-components-text, .feed-shared-inline-show-more-text, .feed-shared-update-v2__description, .update-components-article, .update-components-document, #about, section:has(#about), .pv-shared-text-with-see-more, .inline-show-more-text, .comments-comment-item__main-content, .comments-comment-entity, [data-testid*="expandable-text"], .text-heading-xlarge, .text-body-medium, .pv-text-details__left-panel, .search-results-container, .entity-result, .reusable-search__result-container, [data-view-name="search-entity-result-universal-template"], [data-view-name*="feed-full-update"], [data-view-name*="profile-card"]';

// ---------- util ----------
// par(): parent that also crosses shadow-DOM boundaries (shadow root -> host element)
const par = e => e.parentElement || (e.getRootNode && e.getRootNode().host) || null;
const closestX = (el, sel) => { for (let e=el; e; e=par(e)) if (e.matches && e.matches(sel)) return e; return null; };
const cs = (e, pseudo) => ((e.ownerDocument && e.ownerDocument.defaultView) || window).getComputedStyle(e, pseudo);
const parse = c => { const m = (c || '').match(/[\d.]+/g); if (!m || m.length < 3) return [0,0,0,0]; return [+m[0],+m[1],+m[2], m[3]===undefined?1:+m[3]]; };
const lum = ([r,g,b]) => { const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
const bgOf = el => { for (let e=el; e; e=par(e)) { const s=cs(e); if (s.backgroundImage && s.backgroundImage!=='none') return 'image'; const c=parse(s.backgroundColor); if (c[3]>0.5) return c; } return [255,255,255,1]; };
const whyCache = new WeakMap();
const hiddenWhy = el => {
  if (whyCache.has(el)) return whyCache.get(el);
  const r=[]; const s=cs(el);
  let anc=el; while (anc) { const a=cs(anc); if (a.display==='none') { r.push('display:none'+(anc!==el?'(ancestor)':'')); break; } anc=par(anc); }
  if (s.visibility==='hidden') r.push('visibility:hidden');
  let op=1; for (let e=el; e; e=par(e)) op*=+cs(e).opacity; if (op<0.1) r.push('opacity:'+op.toFixed(2));
  const fs=parseFloat(s.fontSize); if (fs<4) r.push('font-size:'+s.fontSize);
  if (!r.length) {
    const b=el.getBoundingClientRect(); if (b.width<2||b.height<2) r.push('size~0');
    if (b.right<-20 || b.left>innerWidth*3 || b.top+scrollY<-20) r.push('offscreen');
    if (/rect\(0(px)?,? ?0(px)?/.test(s.clip) || /inset\((50|100)%/.test(s.clipPath)) r.push('clipped');
    if (s.textIndent && parseFloat(s.textIndent)<-500) r.push('text-indent');
    const fg=parse(s.color); if (fg[3]<0.15) r.push('transparent-text');
    const bg=bgOf(el);
    if (bg==='image') { if (lum(fg)>0.9) r.push('light-text-on-bg-image(check)'); }
    else { const L1=lum(fg),L2=lum(bg); const cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05); if (cr<1.3) r.push(`low-contrast ${cr.toFixed(2)} fg=${s.color} bg=rgb(${bg.slice(0,3)})`); }
  }
  whyCache.set(el, r); return r;
};
const isA11y = el => !!closestX(el, '.visually-hidden,.a11y-text,.sr-only');
const ruleHits = t => RULES.filter(([,re])=>re.test(t)).map(([k])=>k);
const cps = a => [...new Set(a)].map(c=>'U+'+c.codePointAt(0).toString(16).toUpperCase());

const MAX_FINDINGS = 300;
const out = { url: location.href, title: document.title, findings: [], dropped: 0, warnings: [],
  stats: { textNodes:0, ugcTextNodes:0, ugcRoots:0, sysHidden:0, a11yHidden:0, collapsedUgc:0, comments:0, shadowRoots:0, frames:0, framesBlocked:0 } };
// never drop silently: findings beyond the cap are counted in out.dropped
const add = o => { if (out.findings.length < MAX_FINDINGS) out.findings.push(o); else out.dropped++; };
const snip = s => s.replace(/\s+/g,' ').trim().slice(0, 500);

// ---------- 0) roots: main document + open shadow roots + same-origin frames ----------
// (closed shadow roots and cross-origin frames cannot be read from page script: they are only counted)
const roots = [document]; const seen = new Set(roots);
for (let i=0; i<roots.length; i++) {
  for (const el of roots[i].querySelectorAll('*')) {
    if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); roots.push(el.shadowRoot); out.stats.shadowRoots++; }
    if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
      let d = null; try { d = el.contentDocument; } catch (e) {}
      if (d && d.body) { if (!seen.has(d)) { seen.add(d); roots.push(d); out.stats.frames++; } }
      else out.stats.framesBlocked++;
    }
  }
}
for (const root of roots) out.stats.ugcRoots += root.querySelectorAll(UGC).length;
if (!out.stats.ugcRoots) out.warnings.push('no user-content container matched the UGC selector: hidden text is reported only when it also matches a semantic rule (selectors may be outdated)');

// ---------- 1) text + comment nodes ----------
for (const root of roots) {
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const start = root.nodeType === 9 ? root.body : root; if (!start) continue;
  const w = doc.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT);
  let n;
  while (n = w.nextNode()) {
    if (n.nodeType === 8) { out.stats.comments++; const c=n.textContent.trim(); if (c.length>3 && (ruleHits(c).length || /[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}/i.test(c))) add({ channel:'html-comment', rules:ruleHits(c), text:snip(c) }); continue; }
    const el = n.parentElement || (n.parentNode && n.parentNode.host); if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|CODE)$/.test(el.tagName)) continue;
    const raw = n.textContent; const t = raw.trim(); if (!t) continue;
    out.stats.textNodes++;
    const ugc = !!closestX(el, UGC); if (ugc) out.stats.ugcTextNodes++;
    const inv = raw.match(INV);
    if (inv) { const tags=[...raw.matchAll(TAGS)].map(m=>decodeTags(m[0])); add({ channel:'unicode-invisible', ugc, chars:cps(inv), count:inv.length, decodedTagText: tags.join(' | ')||undefined, text:snip(raw) }); }
    const vs = raw.match(VSRUN); if (vs) add({ channel:'variation-selector-run', ugc, length:[...vs[0]].length, text:snip(raw) });
    if (ugc) { const mw=t.split(/\s+/).filter(mixedScript); if (mw.length) add({ channel:'homoglyph', ugc, words:mw.slice(0,10), text:snip(t) }); }
    const rules = ruleHits(t);
    const why = hiddenWhy(el);            // computed for every text node, not only inside UGC
    const a11y = isA11y(el);
    if (rules.length) add({ channel: why.length ? 'hidden-text' : 'visible-text', rules, hidden: why, ugc, a11y, tag: el.tagName, cls: (el.className?.toString?.()||'').slice(0,80), text: snip(t) });
    else if (ugc && why.length) {
      if (a11y) out.stats.a11yHidden++;
      else if (closestX(el, '.inline-show-more-text, .feed-shared-inline-show-more-text, [class*="see-more"], [class*="show-more"]')) out.stats.collapsedUgc++;
      else if (t.length > 15) add({ channel:'hidden-text', rules:[], hidden: why, ugc, tag: el.tagName, cls:(el.className?.toString?.()||'').slice(0,80), text: snip(t) });
    } else if (!ugc && why.length) out.stats.sysHidden++;   // platform chrome: counted, not listed
    if (ugc) for (const m of t.matchAll(B64)) { try { const d=atob(m[0]); if (/^[\x20-\x7e\s]{20,}$/.test(d)) add({ channel:'base64', ugc, decoded: snip(d), rules: ruleHits(d) }); } catch(e){} }
  }
}
// ---------- 2) attributes ----------
for (const root of roots) for (const el of root.querySelectorAll('*')) {
  for (const a of el.attributes) {
    if (!/^(alt|title|aria-label|aria-description|placeholder|value|content|data-[\w-]+)$/.test(a.name)) continue;
    const v = a.value; if (!v || v.length < 8 || (!/\s/.test(v) && !INV1.test(v))) continue;
    const rules = ruleHits(v); const inv = v.match(INV);
    if (rules.length || (inv && closestX(el, UGC))) add({ channel:'attribute:'+a.name, tag:el.tagName, rules, invisible: inv?cps(inv):undefined, decodedTagText: inv?[...v.matchAll(TAGS)].map(m=>decodeTags(m[0])).join(' | ')||undefined:undefined, text: snip(v) });
  }
}
// ---------- 3) head: meta, JSON-LD, noscript ----------
for (const root of roots) {
  for (const m of root.querySelectorAll('meta[content]')) { const v=m.content; const r=ruleHits(v); if (r.length || INV1.test(v)) add({ channel:'meta:'+(m.name||m.getAttribute('property')), rules:r, text:snip(v) }); }
  for (const s of root.querySelectorAll('script[type="application/ld+json"], noscript')) { const v=s.textContent; const r=ruleHits(v); if (r.length) add({ channel: s.tagName==='NOSCRIPT'?'noscript':'json-ld', rules:r, text:snip(v) }); }
}
// ---------- 4) CSS generated content in UGC ----------
for (const root of roots) for (const u of root.querySelectorAll(UGC)) for (const el of [u, ...u.querySelectorAll('*')]) {
  for (const p of ['::before','::after']) { const c=cs(el,p).content; if (c && c!=='none' && c!=='normal' && c.length>12) add({ channel:'css'+p, rules:ruleHits(c), text:snip(c) }); }
}
if (out.dropped) out.warnings.push(out.dropped + ' findings beyond the cap of ' + MAX_FINDINGS + ' were not listed');
return out;
})()
