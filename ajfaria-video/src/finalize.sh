#!/usr/bin/env bash
# Encode final: vídeo renderizado + mixagem (-14 LUFS / -1 dBTP, loudnorm em 2 passagens) + granulação de filme.
set -euo pipefail
cd "$(dirname "$0")"
OUT=..
MEAS=$(ffmpeg -hide_banner -i out/audio/mix.wav -af loudnorm=I=-14:TP=-1:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
val() { echo "$MEAS" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1:LRA=9:measured_I=$(val input_i):measured_TP=$(val input_tp):measured_LRA=$(val input_lra):measured_thresh=$(val input_thresh):offset=$(val target_offset):linear=true"
ffmpeg -hide_banner -y -i out/video_raw.mp4 -i out/audio/mix.wav \
  -filter_complex "[0:v]noise=c0s=4:c0f=t+u,format=yuv420p[v];[1:a]${LN},aresample=48000[a]" \
  -map "[v]" -map "[a]" -t 35 -r 30 \
  -c:v libx264 -preset slow -crf 18 -maxrate 10M -bufsize 20M -profile:v high -level 4.2 -pix_fmt yuv420p -g 60 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart \
  -metadata title="AJ Faria Transportadora — Meta Ads 35s" "$OUT/ajfaria-meta-ads-35s.mp4"
# trilha + efeitos sem a narração (para regravação/versões)
ffmpeg -hide_banner -y -i out/audio/mix_sem_locucao.wav -af "loudnorm=I=-16:TP=-1:LRA=9" -c:a aac -b:a 256k -ar 48000 "$OUT/ajfaria-trilha-e-efeitos-sem-locucao.m4a"
# capa (quadro do CTA)
ffmpeg -hide_banner -y -ss 33.5 -i "$OUT/ajfaria-meta-ads-35s.mp4" -frames:v 1 -update 1 -q:v 2 "$OUT/ajfaria-meta-ads-capa.jpg"
