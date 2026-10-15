# Gera assets/sp-map.json a partir da malha municipal de SP (tbrugz/geodata-br, base IBGE).
# Saída em coordenadas planas (km) centradas no estado: contorno do estado, divisas municipais e Pedreira.
import json, sys, math
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, linemerge
src, out = sys.argv[1], sys.argv[2]
fc = json.load(open(src, encoding="utf-8"))
geoms, ped = [], None
for f in fc["features"]:
    g = shape(f["geometry"]).buffer(0)
    geoms.append(g)
    if f["properties"].get("name", "").lower() == "pedreira": ped = g
state = unary_union(geoms).buffer(0.002).buffer(-0.002)
if state.geom_type == "MultiPolygon": state = max(state.geoms, key=lambda p: p.area)
minx, miny, maxx, maxy = state.bounds
lon0, lat0 = (minx + maxx) / 2, (miny + maxy) / 2
k = 111.32
def P(lon, lat): return [round((lon - lon0) * k * math.cos(math.radians(lat0)), 2), round(-(lat - lat0) * 110.57, 2)]
def ring(r): return [P(x, y) for x, y in r.coords]
st = state.simplify(0.004)
borders = linemerge(unary_union([g.boundary for g in geoms])).simplify(0.008)
lines = [ [P(x, y) for x, y in l.coords] for l in (borders.geoms if hasattr(borders, "geoms") else [borders]) ]
pd = ped.simplify(0.001)
c = ped.centroid
data = {"state": ring(st.exterior), "borders": lines,
        "pedreira": ring(pd.exterior if pd.geom_type == "Polygon" else max(pd.geoms, key=lambda p: p.area).exterior),
        "pedreiraCenter": P(c.x, c.y), "bounds": [P(minx, maxy), P(maxx, miny)]}
json.dump(data, open(out, "w"), separators=(",", ":"))
print("pts state", len(data["state"]), "border lines", len(lines), "sum pts", sum(map(len, lines)), "ped", data["pedreiraCenter"], data["bounds"])
