"""Trilha instrumental corporativa-cinematográfica (35 s, 90 BPM, Lá menor) + sound design.

Gera dois arquivos estéreo 48 kHz:
  music.wav — trilha (pad, baixo pulsante, arpejo, bateria discreta)
  sfx.wav   — impactos, risers, whooshes de transição, ticks tipográficos, contador, toque no botão, assinatura sonora
Todos os tempos seguem a timeline do vídeo (composition/js/main.js) e a narração (vo_timing.md).
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import soundfile as sf

SR = 48000
DUR = 35.0
N = int(SR * DUR)
BPM = 90
BEAT = 60 / BPM
B8 = BEAT / 2
BAR = BEAT * 4
rng = np.random.default_rng(7)
out_dir = sys.argv[1] if len(sys.argv) > 1 else '.'


def t_axis(n):
    return np.arange(n) / SR


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)


def env_adsr(n, a, d, s, r, total=None):
    total = total or n
    e = np.ones(n) * s
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    ai = max(ai, 1)
    e[:ai] = np.linspace(0, 1, ai)[:n]
    if ai < n:
        e[ai:ai + di] = np.linspace(1, s, di)[:max(0, min(di, n - ai))]
    if ri > 0:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e


def place(buf, sig, t0, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= len(buf):
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(buf) - i0)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    if sig.ndim == 1:
        buf[i0:i0 + n, 0] += sig[:n] * gain * l * 1.414
        buf[i0:i0 + n, 1] += sig[:n] * gain * r * 1.414
    else:
        buf[i0:i0 + n] += sig[:n] * gain


def saw_additive(freq, n, harmonics=14, detune=0.0, phase=0.0):
    t = t_axis(n)
    s = np.zeros(n)
    for k in range(1, harmonics + 1):
        if freq * k > SR * 0.42:
            break
        s += np.sin(2 * np.pi * freq * (1 + detune) * k * t + phase * k) / k
    return s * 0.6


def note(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    p, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[p] + (o - 4) * 12) / 12)


def reverb_ir(seconds=2.6, decay=3.2, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = t_axis(n)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], 1) * np.exp(-decay * t)[:, None]
    ir[:, 0] = lp(ir[:, 0], 7000)
    ir[:, 1] = lp(ir[:, 1], 7000)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0))


IR = reverb_ir()


def reverb(x, wet=0.25):
    y = np.stack([fftconvolve(x[:, c], IR[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


CHORDS = [  # i – VI – III – VII
    ('A1', ['A3', 'C4', 'E4', 'A4'], ['A4', 'C5', 'E5', 'A5']),
    ('F1', ['F3', 'A3', 'C4', 'F4'], ['F4', 'A4', 'C5', 'F5']),
    ('C2', ['G3', 'C4', 'E4', 'G4'], ['C5', 'E5', 'G5', 'C6']),
    ('G1', ['G3', 'B3', 'D4', 'G4'], ['G4', 'B4', 'D5', 'G5']),
]


def chord_at(t):
    return CHORDS[int(t // BAR) % 4]


def in_any(t, spans):
    return any(a <= t < b for a, b in spans)


# ---------------------------------------------------------------- MÚSICA
music = np.zeros((N, 2))

# pad (acordes por compasso, filtro abrindo ao longo do filme)
pad = np.zeros((N, 2))
nbars = int(np.ceil(DUR / BAR))
for b in range(nbars):
    t0 = b * BAR
    if t0 >= DUR:
        break
    _, voicing, _ = CHORDS[b % 4]
    n = int((BAR + 0.6) * SR)
    sigL, sigR = np.zeros(n), np.zeros(n)
    for v in voicing:
        f = note(v)
        sigL += saw_additive(f, n, 10, -0.0025, 0.3)
        sigR += saw_additive(f, n, 10, +0.0025, 1.1)
    e = env_adsr(n, 0.35, 0.4, 0.85, 0.6)
    place(pad, np.stack([sigL * e, sigR * e], 1), t0, 0.06)
# filtro variável: processa em blocos com corte por tempo
cut_pts = [(0, 500), (3.3, 900), (7.6, 2200), (17, 2800), (24.3, 1300), (27.3, 2400), (29.7, 1800), (33.5, 2600), (35, 1200)]
blk = int(0.05 * SR)
filtered = np.zeros_like(pad)
zi = None
from scipy.signal import sosfilt_zi
for i in range(0, N, blk):
    tt = i / SR
    fc = np.interp(tt, [p[0] for p in cut_pts], [p[1] for p in cut_pts])
    sos = butter(2, fc, 'low', fs=SR, output='sos')
    if zi is None:
        zi = np.stack([sosfilt_zi(sos) * 0 for _ in range(2)], 0)
    for c in range(2):
        filtered[i:i + blk, c], zi[c] = sosfilt(sos, pad[i:i + blk, c], zi=zi[c])
music += filtered

# baixo pulsante em colcheias (sub + harmônico leve), sustentado no CTA
bass = np.zeros(N)
t = 0.0
k = 0
while t < 29.6:
    root = note(chord_at(t)[0])
    n = int(B8 * 0.92 * SR)
    tt = t_axis(n)
    s = np.sin(2 * np.pi * root * tt) + 0.25 * np.sin(2 * np.pi * root * 2 * tt) + 0.08 * np.sin(2 * np.pi * root * 3 * tt)
    e = np.exp(-tt * 7) * 0.8 + 0.2
    e[: int(0.006 * SR)] *= np.linspace(0, 1, int(0.006 * SR))
    e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    acc = 1.0 if k % 2 == 0 else 0.72
    vol = 0.55 if t < 3.3 else 0.8 if t < 7.6 else (0.6 if 24.3 <= t < 27.3 else 1.0)
    i0 = int(t * SR)
    bass[i0:i0 + n] += (s * e * acc * vol)[: max(0, min(n, N - i0))]
    t += B8
    k += 1
for t0, nm, d in [(29.667, 'A1', 3.2), (32.0, 'F1', 1.9), (33.9, 'A1', 1.1)]:
    n = int(d * SR)
    tt = t_axis(n)
    s = (np.sin(2 * np.pi * note(nm) * tt) + 0.2 * np.sin(2 * np.pi * note(nm) * 2 * tt)) * env_adsr(n, 0.02, 0.3, 0.7, 0.5)
    place(music, s, t0, 0.15)
music += np.stack([bass, bass], 1) * 0.3

# arpejo em semicolcheias (pluck), entra na apresentação da marca
arp = np.zeros((N, 2))
pattern = [0, 1, 2, 3, 2, 1, 2, 3]
spans_arp = [(7.667, 24.0), (27.333, 29.55), (30.0, 33.6)]
t = 7.667
i = 0
S16 = BEAT / 4
while t < DUR:
    if in_any(t, spans_arp):
        f = note(chord_at(t)[2][pattern[i % 8]])
        n = int(0.32 * SR)
        tt = t_axis(n)
        s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2 * tt + 0.5) + 0.12 * np.sin(2 * np.pi * f * 3 * tt)) * np.exp(-tt * 14)
        s[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
        vel = 0.9 if i % 4 == 0 else 0.6
        g = 0.065 if t >= 30 else 0.09
        place(arp, lp(s, 4200), t, g * vel, pan=0.35 * np.sin(i * 0.9))
    t += S16
    i += 1
# eco em colcheia pontuada
d = int(BEAT * 0.75 * SR)
echo = np.zeros_like(arp)
echo[d:] += arp[:-d] * 0.35
echo[2 * d:] += arp[:-2 * d] * 0.12
music += arp + echo[:, ::-1]


# bateria
def kick(level=1.0):
    n = int(0.45 * SR)
    tt = t_axis(n)
    f = 46 + 95 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 7.5)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-tt * 260) * 0.25
    return np.tanh((s + click) * 1.4) * level


def clap(level=1.0):
    n = int(0.3 * SR)
    tt = t_axis(n)
    nz = bp(rng.standard_normal(n), 900, 5200)
    e = np.exp(-tt * 22)
    for dly in (0.0, 0.011, 0.022):
        e += np.roll(np.exp(-tt * 140), int(dly * SR)) * 0.6
    return nz * e * 0.35 * level


def hat(level=1.0, open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    tt = t_axis(n)
    return hp(rng.standard_normal(n), 7500) * np.exp(-tt * (18 if open_ else 75)) * 0.25 * level


def tom(f0, level=1.0):
    n = int(0.5 * SR)
    tt = t_axis(n)
    f = f0 * (1 + 0.5 * np.exp(-tt * 20))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 8) * level


drums = np.zeros((N, 2))
t = 0.0
step = 0
while t < DUR - 0.01:
    beat_in_bar = step % 8  # colcheias
    if in_any(t, [(3.333, 7.5), (7.667, 24.0), (27.333, 29.45)]) and beat_in_bar % 2 == 0:
        place(drums, kick(0.75 if t < 7.6 else 1.0), t, 0.55)
    if in_any(t, [(24.333, 27.2)]) and beat_in_bar in (0, 4):
        place(drums, kick(0.8), t, 0.5)
    if in_any(t, [(7.667, 24.0), (27.333, 29.45)]) and beat_in_bar in (2, 6):
        place(drums, clap(), t, 0.42, pan=0.05)
    if in_any(t, [(3.333, 7.5), (24.333, 29.45), (30.0, 33.6)]):
        place(drums, hat(0.8 if beat_in_bar % 2 else 0.5), t, 0.3, pan=0.3)
    if in_any(t, [(7.667, 24.0)]):
        place(drums, hat(0.55), t, 0.28, pan=0.3)
        place(drums, hat(0.35), t + B8 / 2, 0.28, pan=0.35)
        if beat_in_bar == 7:
            place(drums, hat(0.5, True), t, 0.25, pan=-0.25)
    t += B8
    step += 1
for t0, f0 in [(16.667, 140), (16.833, 115), (23.667, 140), (23.833, 120), (24.0, 98)]:
    place(drums, tom(f0), t0, 0.32, pan=-0.2)
music += drums

music = reverb(music, 0.18)
music = np.stack([hp(music[:, c], 30) for c in range(2)], 1)  # limpa sub-graves inaudíveis em celular

# ---------------------------------------------------------------- SOUND DESIGN
sfx = np.zeros((N, 2))


def impact(level=1.0, length=2.2):
    n = int(length * SR)
    tt = t_axis(n)
    boom = np.sin(2 * np.pi * np.cumsum(32 + 60 * np.exp(-tt * 9)) / SR) * np.exp(-tt * 2.6)
    body = lp(rng.standard_normal(n), 900) * np.exp(-tt * 9) * 0.5
    crack = hp(rng.standard_normal(n), 3000) * np.exp(-tt * 50) * 0.18
    return np.tanh((boom + body + crack) * 1.3) * level


def riser(length, level=1.0):
    n = int(length * SR)
    tt = t_axis(n)
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    blk = int(0.02 * SR)
    for i in range(0, n, blk):
        fc = 300 + (i / n) ** 2 * 9000
        out[i:i + blk] = bp(nz[max(0, i - 2048):i + blk], fc * 0.6, fc * 1.4)[-len(out[i:i + blk]):]
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (tt / tt[-1]) ** 2) / SR) * 0.15
    e = (tt / tt[-1]) ** 2.2
    return (out * 0.6 + tone) * e * level


def whoosh(length=0.45, level=1.0, up=True):
    n = int(length * SR)
    tt = t_axis(n)
    u = tt / tt[-1]
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    blk = int(0.01 * SR)
    for i in range(0, n, blk):
        x = i / n
        fc = (500 + 4500 * x) if up else (5000 - 4200 * x)
        seg = bp(nz[max(0, i - 1024):i + blk], fc * 0.5, fc * 1.5)
        out[i:i + blk] = seg[-len(out[i:i + blk]):]
    e = np.sin(np.pi * u) ** 1.5
    return out * e * level


def tick(level=1.0, f=2400):
    n = int(0.06 * SR)
    tt = t_axis(n)
    return (np.sin(2 * np.pi * f * tt) * 0.5 + hp(rng.standard_normal(n), 4000) * 0.3) * np.exp(-tt * 120) * level


def thud(level=1.0):
    n = int(0.25 * SR)
    tt = t_axis(n)
    return np.sin(2 * np.pi * np.cumsum(70 + 80 * np.exp(-tt * 40)) / SR) * np.exp(-tt * 18) * level


def bell(f, length=1.6, level=1.0):
    n = int(length * SR)
    tt = t_axis(n)
    s = np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 3) + 0.25 * np.sin(2 * np.pi * f * 3.01 * tt) * np.exp(-tt * 5)
    s *= np.exp(-tt * 2.8)
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s * level


# impactos em pontos-chave (abertura, marca, seção de valor, CTA)
place(sfx, impact(1.0, 2.6), 0.0, 0.55)
place(sfx, impact(0.9, 2.4), 7.667, 0.5)
place(sfx, impact(0.5, 1.6), 17.0, 0.32)
place(sfx, impact(0.85, 2.4), 29.667, 0.48)
# risers antes das viradas
for t0, ln, g in [(2.7, 0.633, 0.22), (6.95, 0.717, 0.28), (16.35, 0.65, 0.16), (23.6, 0.733, 0.22), (28.95, 0.717, 0.24)]:
    place(sfx, riser(ln), t0, g)
# whooshes nas transições com máscara e nos cortes direcionais
for t0, ln, g, up, pan in [(1.12, 0.42, 0.42, True, -0.4), (3.17, 0.36, 0.45, False, 0.0), (7.48, 0.4, 0.3, True, 0.0), (24.15, 0.42, 0.38, True, 0.0),
                            (27.15, 0.38, 0.4, True, 0.4), (29.5, 0.5, 0.42, True, -0.4),
                            (16.95, 0.24, 0.3, True, -0.5), (18.28, 0.24, 0.3, True, -0.5), (19.62, 0.24, 0.3, True, -0.5), (21.28, 0.24, 0.26, True, -0.5)]:
    place(sfx, whoosh(ln, 1.0, up), t0, g, pan)
# ticks tipográficos (revelação dos blocos de texto)
for t0 in [0.06, 0.6, 1.64, 2.24, 3.42, 4.74, 5.3, 6.16, 9.18, 9.95, 12.5, 13.7, 15.05, 21.4, 22.12, 22.7, 23.32, 25.22, 25.98, 27.44, 27.86, 28.5, 29.98, 30.2, 30.7]:
    place(sfx, tick(1.0, 2200), t0, 0.08, pan=0.15)
    place(sfx, thud(1.0), t0, 0.07)
# contador +16: um tick por número
def count_at(t):
    u = np.clip((t - 12.55) / (13.6 - 12.55), 0, 1)
    return int(round(16 * (1 - (1 - u) ** 4)))
prev = 0
for i in range(int(12.5 * SR), int(13.7 * SR), int(0.002 * SR)):
    c = count_at(i / SR)
    if c != prev:
        place(sfx, tick(1.0, 1800 + c * 60), i / SR, 0.06, pan=0.0)
        prev = c
place(sfx, bell(note('E5'), 1.4), 13.6, 0.05)
# marcador no mapa
place(sfx, bell(note('A5'), 1.2), 25.22, 0.045)
# toque no botão
place(sfx, tick(1.0, 1400), 32.86, 0.14)
place(sfx, thud(1.0), 32.86, 0.12)
# assinatura sonora (motivo de 3 notas + impacto suave)
for t0, nm in [(33.9, 'A4'), (34.12, 'E5'), (34.34, 'A5')]:
    place(sfx, bell(note(nm), 1.4), t0, 0.07, pan=0.0)
place(sfx, impact(0.5, 1.2), 33.9, 0.22)
sfx = reverb(sfx, 0.22)

# fade final
fade = np.ones(N)
fade[-int(0.5 * SR):] = np.linspace(1, 0, int(0.5 * SR)) ** 1.5
music *= fade[:, None]
sfx *= fade[:, None]

for name, x in [('music', music), ('sfx', sfx)]:
    pk = np.abs(x).max()
    print(name, 'peak', round(20 * np.log10(pk + 1e-9), 2), 'dBFS  rms', round(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9), 2))
    sf.write(f'{out_dir}/{name}.wav', (x / max(pk, 1e-9) * 0.5).astype(np.float32), SR, subtype='FLOAT')
