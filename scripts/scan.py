"""Heuristic scan of cached HTML/JSON.  usage: python scan.py <dir produced by extract.py>"""
import json,os,re,sys,html
# invisible characters can also arrive as HTML entities (&#x200B;) or JSON escapes (\u200b): decode both before searching
def decoded(t):
    t=re.sub(r'\\u([0-9a-fA-F]{4})',lambda m:chr(int(m.group(1),16)),html.unescape(t))
    return t.encode('utf-16','surrogatepass').decode('utf-16','replace')
d=sys.argv[1]; idx=json.load(open(os.path.join(d,'index.json')))
kw=re.compile(r'(ignore (all |any )?(previous|prior|above)|disregard|system prompt|you are (an?|now) |as an ai|\bAI (agent|assistant|model)s?\b|\bLLM\b|language model|ChatGPT|Claude|Gemini|Copilot|\bagent[ie]? (AI|IA)\b|istruzion|ignora|assistente|if you are an|se sei un|prompt injection|<\|im_start\|>|\[INST\])',re.I)
inv=re.compile('[​‌‍⁠﻿‪-‮⁦-⁩]|[\U000E0000-\U000E007F]')
hid=re.compile(r'(color:\s*(#fff(fff)?|white|rgba?\(255,\s*255,\s*255)|font-size:\s*0|opacity:\s*0[;"\s]|display:\s*none|visibility:\s*hidden|left:\s*-\d{3,}px|text-indent:\s*-\d{3,})',re.I)
for e in idx:
    if not any(t in e['ct'] for t in ('html','json','plain','xml')) : continue
    t=open(os.path.join(d,e['file']),'rb').read().decode('utf-8','replace')
    k=kw.findall(t); i=inv.findall(decoded(t)); h=hid.findall(t)
    if k or i:
        print(f"{e['file']} {e['ct']} {e['date'][:25]} size={e['size']} kw={len(k)} inv={len(i)} hid={len(h)} :: {e['url'][:110]}")
