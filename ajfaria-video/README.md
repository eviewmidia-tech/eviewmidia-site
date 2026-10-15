# AJ Faria Transportadora — filme Meta Ads (35 s, 9:16)

Filme publicitário vertical para campanhas de geração de cotações B2B no Meta Ads.

## Entregáveis

| Arquivo | O que é |
|---|---|
| `ajfaria-meta-ads-35s.mp4` | Filme final 1080×1920, 30 fps, 35,0 s, H.264 High (~6,7 Mb/s) + AAC 256 kb/s, narração oficial mixada (−14 LUFS integrado) |
| `ajfaria-meta-ads-35s.srt` | Legendas pt-BR sincronizadas com a narração (subir no Gerenciador de Anúncios) |
| `ajfaria-trilha-e-efeitos-sem-locucao.m4a` | Trilha + sound design sem a voz (para versões / regravação) |
| `ajfaria-meta-ads-capa.jpg` | Quadro do CTA para capa/miniatura |

## Sincronização com a narração oficial

A narração oficial (ElevenLabs, voz "Roger", 35,08 s) é a referência de tempo do filme. Os tempos de cada frase
foram medidos na própria gravação (`src/audio/vo_timing.md`) e a timeline das cenas foi ancorada neles; os cortes
caem na grade de colcheias da trilha (90 BPM).

| Tempo | Narração | Imagem e tipografia |
|---|---|---|
| 0,0–3,3 | "Sua empresa precisa de uma transportadora de confiança?" | Caminhão na rodovia ao entardecer (travelling lateral, motion blur, raios de sol) → máscara diagonal → composição escura com rastros de luz; pergunta revelada em blocos, palavra a palavra |
| 3,3–7,7 | "Sua indústria ou distribuidora realiza envios frequentes de mercadorias?" | Centro de distribuição: paletes, expedição, linhas origem → destinos e caixas direcionadas às docas (2.5D) |
| 7,7–17,0 | "A AJ Faria Transportadora, sediada em Pedreira, SP, conta com mais de 16 anos de experiência…" | Logotipo revelado por máscara no ângulo do itálico + varredura de luz; caminhão em estúdio com luz de recorte; contagem "+16" que pousa em 16 junto com "dezesseis" |
| 17,0–24,3 | "Atendemos empresas… com foco em uma parceria logística de longo prazo." | Preparação (SUA OPERAÇÃO) → carregamento (SUA LOGÍSTICA) → estrada (SUAS MERCADORIAS), com cortes direcionais da esquerda para a direita → caminhão rumo ao horizonte |
| 24,3–29,7 | "Sediada em Pedreira, interior de São Paulo. Transporte de cargas para empresas." | Mapa 3D de SP (malha municipal do IBGE), marcador PEDREIRA \| SP; doca com caminhão e paletes |
| 29,7–35,0 | "Clique em Saiba Mais, consulte nossas rotas e solicite uma cotação…" | CTA: logo, "SUA EMPRESA PRECISA DE TRANSPORTE?", botão "SOLICITE UMA COTAÇÃO" (visível por 4,3 s, toque sincronizado com a fala), "CLIQUE EM SAIBA MAIS", Pedreira \| SP |

## Pontos para validar com o cliente

- **Logotipo**: vetorizado a partir da imagem enviada (`src/tools/trace_logo.py`), sem redesenho. Ao receber o arquivo
  vetorial oficial, substituir `src/composition/assets/ajfaria-logo.svg` e renderizar de novo.
- **Cor institucional**: verde `#97C93D`, estimado a partir do tom da imagem enviada. Confirmar com o manual da marca.
- **Nome**: o logotipo diz "AJ FARIA TRANSPORTES"; o briefing e a narração usam "AJ Faria Transportadora". Mantido como no briefing.
- **Caminhões**: modelos 3D genéricos, brancos e **sem** identificação da AJ Faria (o briefing proíbe identificação falsa).
  Se houver imagens reais da frota, elas podem substituir os planos de estúdio e de estrada.
- **Mapa**: as linhas que partem de Pedreira são conceituais, se dissolvem antes de qualquer destino e não indicam
  rotas nem regiões de atendimento.
- **Textos na tela**: acompanham a narração oficial (que difere do roteiro do briefing). A frase de abertura passou a ser
  a pergunta da narração; a ideia de "envios frequentes" ficou na cena 2.

## Como renderizar

Requisitos: Node 20+, ffmpeg, Python 3 com `numpy scipy soundfile`.

```bash
cd ajfaria-video/src
npm install
node render.mjs stills 0.5 9.6 31.6             # quadros de conferência em out/stills/
python3 audio/make_music.py out/audio            # trilha + sound design
python3 audio/mix.py audio/narracao-oficial.mp3 out/audio
node render.mjs video 0 35 video_raw             # ~1 h em CPU (motion blur por subamostras)
./finalize.sh                                    # encode final + trilha sem locução + capa
```

A composição (`src/composition/`) é uma página Three.js determinística: `window.renderAt(t)` desenha o quadro do
instante `t`, e o `render.mjs` captura quadro a quadro no Chromium headless, fazendo a média das subamostras
(obturador de 180°) nas tomadas rápidas.
