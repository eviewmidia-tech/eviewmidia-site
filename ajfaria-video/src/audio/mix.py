"""Mixagem: narração oficial (prioridade absoluta) + trilha com ducking + sound design.

Uso: python3 mix.py narracao-oficial.mp3 out/audio
Gera out/audio/mix.wav (com locução) e out/audio/mix_sem_locucao.wav (trilha + efeitos).
A normalização final de loudness (-14 LUFS, -1 dBTP) é feita no encode (ffmpeg loudnorm).
"""
import sys, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 35.0
N = int(SR * DUR)
vo_path, d = sys.argv[1], sys.argv[2]

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', vo_path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
vo = sosfilt(butter(2, 70, 'high', fs=SR, output='sos'), vo)          # limpa graves residuais
vo_st = np.stack([vo, vo], 1)

music, _ = sf.read(f'{d}/music.wav')
sfx, _ = sf.read(f'{d}/sfx.wav')
music, sfx = music[:N], sfx[:N]

def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

# envelope de fala -> ganho de ducking suave (ataque 60 ms, liberação 350 ms)
win = int(0.04 * SR)
env = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, 'same'))
speech = (20 * np.log10(env + 1e-9) > -42).astype(float)
duck = np.empty(N)
g = 0.0
a_up, a_dn = 1 - np.exp(-1 / (0.06 * SR)), 1 - np.exp(-1 / (0.35 * SR))
for i in range(N):
    target = speech[i]
    g += (target - g) * (a_up if target > g else a_dn)
    duck[i] = g
DUCK_DB = -6.0
music_gain = 10 ** (DUCK_DB * duck / 20)

vo_level = rms_db(vo[speech > 0])
music_ref = rms_db(music)
# trilha ~11 dB abaixo da fala sem ducking (≈ -17 dB durante a fala)
mg = 10 ** ((vo_level - 11 - music_ref) / 20)
sg = mg * 1.35
mix_music = music * mg * music_gain[:, None]
mix_sfx = sfx * sg * (10 ** (-3.0 * duck / 20))[:, None]
mix = vo_st + mix_music + mix_sfx
bed = music * mg + sfx * sg

for name, x in [('mix', mix), ('mix_sem_locucao', bed)]:
    pk = np.abs(x).max()
    x = x / pk * 0.89
    sf.write(f'{d}/{name}.wav', x.astype(np.float32), SR, subtype='FLOAT')
    print(name, 'peak norm, rms', round(rms_db(x), 2))
print('fala rms', round(vo_level, 2), 'dBFS; trilha/fala', round(rms_db(mix_music[speech > 0]) - vo_level, 1), 'dB durante a fala')
