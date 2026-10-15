# Transcreve a narração oficial por trecho (entre pausas) para mapear frases -> tempos.
import sys, subprocess, numpy as np, sherpa_onnx
M, F = sys.argv[1], sys.argv[2]
cuts = [float(x) for x in sys.argv[3].split(',')]
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', F, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, dtype=np.float32)
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{M}/small-encoder.int8.onnx", decoder=f"{M}/small-decoder.int8.onnx", tokens=f"{M}/small-tokens.txt", language="pt", task="transcribe", num_threads=4)
# início da fala
env = np.abs(x); on = np.where(env > 0.02)[0]
print(f"fala começa em {on[0]/16000:.3f}s e termina em {on[-1]/16000:.3f}s")
for a, b in zip(cuts[:-1], cuts[1:]):
    s = rec.create_stream(); s.accept_waveform(16000, x[int(a*16000):int(b*16000)]); rec.decode_stream(s)
    print(f"{a:6.2f}-{b:6.2f} | {s.result.text.strip()}")
