"""OCR of the selected images, several passes per image.

usage: python ocr.py <dir produced by pick.py>

Passes:
  orig   the image as it is
  enh    global histogram equalization
  hi     only the brightest tones (>= 225) stretched to full range: white on near-white text
  lo     only the darkest tones (<= 30) stretched to full range: black on near-black text
  clahe  local contrast (CLAHE), if OpenCV is available
A global equalization alone does not reliably reveal faint text that covers a
small part of a large image; `hi`, `lo` and `clahe` are there for that.
"""
import json, os, sys, io
from PIL import Image, ImageOps
from rapidocr_onnxruntime import RapidOCR
try:
    import cv2, numpy as np
except ImportError:
    cv2 = None

HI, LO = 225, 30
HI_LUT = [0 if v < HI else round((v - HI) * 255 / (255 - HI)) for v in range(256)]
LO_LUT = [255 if v > LO else round(v * 255 / LO) for v in range(256)]


def passes(im):
    g = ImageOps.grayscale(im)
    out = {'orig': im, 'enh': ImageOps.equalize(g), 'hi': g.point(HI_LUT), 'lo': g.point(LO_LUT)}
    if cv2 is not None:
        out['clahe'] = Image.fromarray(cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8)).apply(np.asarray(g)))
    return out


if __name__ == '__main__':
    d = sys.argv[1]; sel = json.load(open(os.path.join(d, 'sel.json'))); eng = RapidOCR()

    def run(im):
        b = io.BytesIO(); im.save(b, 'PNG'); r, _ = eng(b.getvalue())
        return [(x[1], round(float(x[2]), 2)) for x in (r or [])]

    res = []
    for n, e in enumerate(sel):
        rec = dict(file=e['img'], url=e['url'], w=e['w'], h=e['h'])
        try:
            im = Image.open(os.path.join(d, e['img'])); im.seek(0); im = im.convert('RGB')
            if max(im.size) > 2000: im.thumbnail((2000, 2000))
            for name, p in passes(im).items(): rec[name] = run(p)
        except Exception as ex:
            rec['error'] = str(ex)
        res.append(rec)
        if n % 25 == 0: print(n, flush=True)
    json.dump(res, open(os.path.join(d, 'ocr.json'), 'w'), ensure_ascii=False, indent=1); print('done')
