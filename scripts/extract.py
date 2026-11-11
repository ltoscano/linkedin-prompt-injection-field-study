"""Extract and decompress entries from a Chromium "simple cache" directory.

usage: python extract.py <Cache_Data dir> <output dir> [key filter, default: linkedin]

Each `<hash>_0` file is laid out as:
  header (24 bytes) | key | stream 1 = response body | EOF record |
  stream 0 = HTTP headers | optional SHA-256 of the key | EOF record
"""
import sys, os, struct, gzip, zlib, json, re
from collections import Counter

if len(sys.argv) < 3:
    sys.exit(__doc__)
src, dst = sys.argv[1], sys.argv[2]
key_filter = sys.argv[3] if len(sys.argv) > 3 else 'linkedin'
os.makedirs(dst, exist_ok=True)
try: import brotli
except ImportError: brotli = None
try: import zstandard
except ImportError: zstandard = None

INITIAL_MAGIC = 0xfcfb6d1ba7725c30
EOF_MAGIC = struct.pack('<Q', 0xf4fa6f45970d41d8)
HDR, EOF_SIZE, FLAG_HAS_KEY_SHA256 = 24, 24, 2


def split_streams(b, klen):
    """Return (body, http_headers) or None if the file does not parse."""
    start = HDR + klen
    # structural parse: walk back from the final EOF record using its stream size
    if len(b) >= start + 2 * EOF_SIZE and b[-EOF_SIZE:-EOF_SIZE + 8] == EOF_MAGIC:
        flags, _crc, size0 = struct.unpack('<III', b[-EOF_SIZE + 8:-EOF_SIZE + 20])
        end0 = len(b) - EOF_SIZE - (32 if flags & FLAG_HAS_KEY_SHA256 else 0)
        start0 = end0 - size0
        eof1 = start0 - EOF_SIZE
        if eof1 >= start and b[eof1:eof1 + 8] == EOF_MAGIC:
            return b[start:eof1], b[start0:end0]
    # fallback: locate the EOF records by searching for the magic number
    rest = b[start:]
    pos = [m.start() for m in re.finditer(re.escape(EOF_MAGIC), rest)]
    if not pos:
        return None
    return rest[:pos[0]], (rest[pos[0] + EOF_SIZE:pos[1]] if len(pos) > 1 else b'')


idx = []; skipped = Counter()
names = os.listdir(src)
if not any(n.endswith('_0') for n in names):
    hint = ' It holds sqldb* files: this Chrome uses the SQL cache backend, which this script does not read.' if any(n.startswith('sqldb') for n in names) else ''
    sys.exit(f'no simple-cache entries (*_0) in {src}.{hint}')
for fn in sorted(os.listdir(src)):
    if not fn.endswith('_0'): continue
    b = open(os.path.join(src, fn), 'rb').read()
    if len(b) < HDR: skipped['too short'] += 1; continue
    magic, ver, klen, khash, pad = struct.unpack('<QIIII', b[:HDR])
    if magic != INITIAL_MAGIC: skipped['bad magic'] += 1; continue
    key = b[HDR:HDR + klen].decode('latin1')
    if key_filter and key_filter not in key: continue
    parts = split_streams(b, klen)
    if parts is None: skipped['no EOF record'] += 1; continue
    body, hdr = parts
    h = hdr.decode('latin1', errors='replace')
    enc = re.search(r'content-encoding:\s*([^\x00\s]+)', h, re.I)
    ct = re.search(r'content-type:\s*([^\x00;]+)', h, re.I)
    date = re.search(r'\x00date:\s*([^\x00]+)', h, re.I)
    e = enc.group(1).lower() if enc else ''
    try:
        if e == 'gzip': body = gzip.decompress(body)
        elif e == 'deflate': body = zlib.decompress(body)
        elif e == 'br' and brotli: body = brotli.decompress(body); e = 'br-decoded'  # so unbr.js skips it
        elif e == 'zstd' and zstandard: body = zstandard.ZstdDecompressor().decompressobj().decompress(body)
    except Exception:
        e += '(FAIL)'
    open(os.path.join(dst, fn), 'wb').write(body)
    idx.append(dict(file=fn, url=key.split(' ')[-1], enc=e, ct=ct.group(1).strip() if ct else '',
                    date=date.group(1).strip() if date else '', size=len(body)))
json.dump(idx, open(os.path.join(dst, 'index.json'), 'w'), indent=1)
print(len(idx), 'entries;', 'skipped:', dict(skipped))
print(Counter(i['ct'] for i in idx).most_common(15))
print(Counter(i['enc'] for i in idx))
