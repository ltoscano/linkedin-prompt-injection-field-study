import json,os,sys,hashlib,shutil
from PIL import Image
d,dst=sys.argv[1],sys.argv[2]; idx=json.load(open(os.path.join(d,'index.json')))
seen={}; sel=[]; stats={'small':0,'dup':0,'bad':0}
for e in idx:
    if not e['ct'].startswith('image/') or 'svg' in e['ct']: continue
    p=os.path.join(d,e['file'])
    try: im=Image.open(p); w,h=im.size
    except Exception: stats['bad']+=1; continue
    if min(w,h)<100: stats['small']+=1; continue
    hsh=hashlib.md5(open(p,'rb').read()).hexdigest()
    if hsh in seen: stats['dup']+=1; continue
    seen[hsh]=1
    ext={'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp'}.get(e['ct'],'.img')
    shutil.copy(p,os.path.join(dst,e['file']+ext)); sel.append(dict(e,w=w,h=h,img=e['file']+ext))
json.dump(sel,open(os.path.join(dst,'sel.json'),'w'),indent=1)
print(len(sel),stats)
