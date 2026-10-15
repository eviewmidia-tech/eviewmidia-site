import sys, numpy as np, potrace
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter, zoom
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
x0, x1, y0, y1 = 280, 900, 115, 300
c = a[y0:y1, x0:x1]
v = np.minimum(np.minimum(c[..., 0], c[..., 1]), c[..., 2])
al = np.clip((v - 95) / (225 - 95), 0, 1)
S = 8
up = zoom(al, S, order=3)
H, W = up.shape
yy, xx = np.mgrid[0:H, 0:W]
small = (yy > (243 - y0) * S) & (xx > (440 - x0) * S)   # linha "TRANSPORTES"
big = gaussian_filter(up, S * 0.95); sm = gaussian_filter(up, S * 0.42)
f = np.where(small, sm, big)
bm = f > 0.5
bmp = potrace.Bitmap(~bm)
path = bmp.trace(turdsize=60, alphamax=1.0, opticurve=True, opttolerance=0.4)
ys, xs = np.where(bm); pad = 4 * S
minx, miny, maxx, maxy = xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad
d = []
for curve in path:
    s = curve.start_point; d.append(f"M{s.x-minx:.1f},{s.y-miny:.1f}")
    for seg in curve.segments:
        if seg.is_corner:
            d.append(f"L{seg.c.x-minx:.1f},{seg.c.y-miny:.1f}L{seg.end_point.x-minx:.1f},{seg.end_point.y-miny:.1f}")
        else:
            d.append(f"C{seg.c1.x-minx:.1f},{seg.c1.y-miny:.1f} {seg.c2.x-minx:.1f},{seg.c2.y-miny:.1f} {seg.end_point.x-minx:.1f},{seg.end_point.y-miny:.1f}")
    d.append("Z")
w, h = maxx - minx, maxy - miny
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><path fill="#fff" fill-rule="evenodd" d="{"".join(d)}"/></svg>'
open(out, 'w').write(svg); print(w, h, len(svg))
