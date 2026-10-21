#!/usr/bin/env python3
"""Synthesises the soundtrack for the reel from the moments render.mjs recorded (<video>.events.json).

Everything is generated here with numpy: square-wave pixel ticks, stone thuds, an ember crackle, the gate's strike and a
warm closing chord. No samples, no licensed music. Usage: python3 social/audio.py out/silent.events.json out/soundtrack.wav
"""
import json
import sys

import numpy as np

SR = 44100
rng = np.random.default_rng(20261021)
ev = json.load(open(sys.argv[1]))
T = ev["timeline"]
DUR = ev["duration"] + 0.4
N = int(DUR * SR)
dry = np.zeros((2, N))
wet = np.zeros((2, N))   # reverb send


def tt(n):
    return np.arange(n) / SR


def put(buf, t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i < 0 or i >= N:
        return
    sig = sig[: N - i]
    l = gain * np.cos((pan + 1) * np.pi / 4)
    r = gain * np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(sig)] += sig * l
    buf[1, i:i + len(sig)] += sig * r


def env(n, a=0.002, d=0.1, curve=4.0):
    t = tt(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * t / d)


def square(freq, dur, duty=0.25):
    n = int(dur * SR)
    ph = (tt(n) * freq) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def sine(freq, dur, f_end=None):
    n = int(dur * SR)
    t = tt(n)
    f = freq if f_end is None else freq * (f_end / freq) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f * np.ones(n)) / SR)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    out = np.zeros_like(x)
    y = 0.0
    for i, v in enumerate(x):   # fine for short sounds
        y = (1 - a) * v + a * y
        out[i] = y
    return out


def fast_lp(x, fc):
    """One-pole lowpass applied with FFT so long signals stay quick."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 4), len(x))


def tick(t0, freq, gain=0.18, dur=0.07, duty=0.25, pan=0.0):
    n = int(dur * SR)
    put(dry, t0, square(freq, dur, duty) * env(n, 0.001, dur * 0.5, 5) * gain, 1, pan)
    put(wet, t0, square(freq, dur, duty) * env(n, 0.001, dur * 0.5, 5) * gain * 0.35, 1, pan)


def thud(t0, gain=0.5, f0=110, f1=45, dur=0.22, grit=0.25):
    n = int(dur * SR)
    body = sine(f0, dur, f1) * env(n, 0.002, dur * 0.6, 6)
    click = fast_lp(noise(dur), 1800) * env(n, 0.0005, 0.03, 6) * grit
    put(dry, t0, (body + click) * gain)


def chime(t0, freq, gain=0.14, dur=1.2, pan=0.0):
    n = int(dur * SR)
    t = tt(n)
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.01 * t) + 0.15 * np.sin(2 * np.pi * freq * 3.02 * t))
    s *= env(n, 0.003, dur * 0.45, 5)
    put(dry, t0, s * gain, 1, pan)
    put(wet, t0, s * gain * 0.9, 1, pan)


# A minor pentatonic, two and a half octaves, for anything that climbs.
BASE = 110.0
SCALE = [0, 3, 5, 7, 10]


def note(i):
    return BASE * 2 ** ((SCALE[i % 5] + 12 * (i // 5)) / 12)


# ---- the snake draws the pixel b: ticks that speed up and climb -------------------------------------------------------
t = T["snake0"] + 0.15
i = 0
while t < T["snake1"] + 0.001:
    tick(t, note(5 + min(i, 14) // 1) * (1 if i < 40 else 1), gain=0.10 + 0.07 * min(1, i / 12), duty=0.25 if i % 2 else 0.5, pan=-0.3 + 0.6 * ((i % 8) / 8))
    t += max(0.022, 0.22 * 0.84 ** i)
    i += 1
for k, d in enumerate(T["dash"]):
    tick(d, note(16 + k), 0.16, 0.06, 0.125)
chime(T["park"], 880.0, 0.12, 1.4)
chime(T["park"] + 0.02, 1318.5, 0.07, 1.4, 0.3)
thud(T["park"], 0.22, 90, 55, 0.3, 0.1)

# ---- the viewport blits open; the ember hops to the niche -------------------------------------------------------------
o0, o1 = T["open0"], T["open1"]
for s in range(9):
    ts = o0 + (o1 - o0) * s / 9
    tick(ts, 220 * 2 ** (s / 4.0) * 2, 0.08, 0.05, 0.5, pan=-0.5 + s / 8)
    n = int(0.06 * SR)
    put(dry, ts, fast_lp(noise(0.06), 4000 + s * 500) * env(n, 0.001, 0.03, 6) * 0.12)
sw = noise(o1 - o0 + 0.15)
sw = fast_lp(sw, 2500) * np.linspace(0, 1, len(sw)) ** 2 * np.exp(-3 * np.linspace(0, 1, len(sw))) * 0.18
put(dry, o0, sw)
h0, h1 = T["open0"] + 0.1, T["k0"]
for k in range(4):
    th = h0 + (h1 - h0) * (k + 1) / 4
    tick(th, [523.3, 440.0, 392.0, 329.6][k], 0.15, 0.09, 0.5)
    thud(th, 0.12, 200, 90, 0.12, 0.1)
chime(h1, 659.3, 0.10, 1.8)

# ---- the world wakes: a low bed that follows the story ----------------------------------------------------------------
t_lit = next((e["t"] for e in ev["events"] if e["type"] == "lit"), T["lit"])
bed_start = T["k0"] - 0.6
n = int((T["end0"] + 0.5 - bed_start) * SR)
tb = tt(n)
swell = np.interp(tb + bed_start, [bed_start, T["k0"] + 1.5, t_lit - 0.5, t_lit, t_lit + 2.0, T["zoom"], T["end0"], T["end0"] + 0.4], [0, 0.35, 0.5, 1.0, 0.7, 0.9, 0.9, 0])
bed = (np.sin(2 * np.pi * 55 * tb) * 0.55 + np.sin(2 * np.pi * 82.4 * tb + 0.4) * 0.28 + np.sin(2 * np.pi * 110.3 * tb) * 0.16
       + fast_lp(square(55.0, n / SR, 0.5)[:n], 220) * 0.16)
bed *= swell * (1 + 0.12 * np.sin(2 * np.pi * 0.27 * tb)) * 0.24
put(dry, bed_start, bed)
put(wet, bed_start, bed * 0.4)

# ---- Chip: every landing is a stone thud; the carried ember crackles -----------------------------------------------
for e in ev["events"]:
    if e["type"] == "land":
        big = e.get("big")
        thud(e["t"], 0.42 if big else 0.28, 120 if big else 150, 48, 0.24 if big else 0.16, 0.35)
        if not big:
            tick(e["t"] + 0.01, 1400, 0.025, 0.02, 0.25)
t_carry = T["k0"] + 2.0
t_toss = next((e["t"] for e in ev["events"] if e["type"] == "toss"), T["toss"])
tc = t_carry
while tc < t_toss:
    n = int(0.012 * SR)
    put(dry, tc, fast_lp(noise(0.012), 6000) * env(n, 0.0005, 0.006, 6) * (0.06 + 0.05 * rng.random()), 1, rng.uniform(-0.6, 0.6))
    tc += rng.exponential(0.07)

# ---- the toss, the strike, the pulse climbing the stairs ---------------------------------------------------------------
n = int(0.5 * SR)
wh = fast_lp(noise(0.5), 3000) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.14
put(dry, t_toss - 0.05, wh)
put(dry, t_toss, sine(500, 0.45, 1400) * np.sin(np.linspace(0, np.pi, int(0.45 * SR))) * 0.07)
thud(t_lit, 0.85, 80, 30, 1.6, 0.5)
n = int(1.2 * SR)
put(dry, t_lit, fast_lp(noise(1.2), 2400) * env(n, 0.002, 0.5, 5) * 0.4)
put(wet, t_lit, fast_lp(noise(1.2), 2400) * env(n, 0.002, 0.5, 5) * 0.4)
for k, f in enumerate([523.3, 659.3, 784.0, 1046.5, 1318.5]):
    chime(t_lit + 0.02 + k * 0.04, f, 0.10, 1.8, -0.5 + k * 0.25)
# the climb: the pulse reaches each tread at these fuse times (island/fuse.js), a note per tread
steps = [2.65 + (7 - i) * 0.085 for i in range(8)] + [3.245 + (3 - j) * 0.09 for j in range(4)]
for k, ft in enumerate(steps):
    tick(t_lit + (ft - 1.95), note(7 + k), 0.13, 0.09, 0.25, pan=-0.6 + 1.2 * k / len(steps))
    chime(t_lit + (ft - 1.95), note(12 + k) * 2, 0.03, 0.5, -0.6 + 1.2 * k / len(steps))

# ---- the dive and the last blit -----------------------------------------------------------------------------------------
dive0, dive1 = T["zoom"] + 0.1, T["end0"] - 0.45
n = int((dive1 - dive0) * SR)
ramp = np.linspace(0, 1, n) ** 2.2
rise = (fast_lp(noise(n / SR), 5000) * 0.25 + sine(180, n / SR, 2400) * 0.2) * ramp
put(dry, dive0, rise)
put(wet, dive0, rise * 0.5)
for s in range(8):
    tick(dive1 + 0.6 * s / 8, 330 * 2 ** (s / 4.0) * 2, 0.07, 0.04, 0.5)
e0 = T["end0"]
thud(e0 - 0.4, 0.8, 70, 28, 1.2, 0.4)
put(dry, e0 - 0.4, fast_lp(noise(0.9), 1500) * env(int(0.9 * SR), 0.002, 0.4, 5) * 0.3)
# the wordmark's pixels land one by one
for k in range(46):
    tick(e0 + 0.25 + 0.012 * k * 1.0 + rng.random() * 0.4, note(rng.integers(8, 17)), 0.05, 0.035, 0.25, rng.uniform(-0.5, 0.5))
thud(e0 + 0.75, 0.3, 120, 60, 0.2)
thud(e0 + 0.9, 0.34, 100, 50, 0.25)
tick(e0 + 1.9, note(14), 0.12, 0.08, 0.5)
# Chip hops in, waves, and hops again (the button answers)
for k, ft in enumerate([2.2 + 0.9 * (1 / 3) * (j + 0.8) for j in range(3)]):
    thud(e0 + ft, 0.18, 170, 70, 0.12)
    tick(e0 + ft, note(10 + 2 * k), 0.07, 0.07, 0.5)
thud(e0 + 4.35, 0.22, 170, 70, 0.14)
tick(e0 + 4.1, 1568.0, 0.1, 0.05, 0.5)
tick(e0 + 4.15, 2093.0, 0.1, 0.09, 0.5)
# the closing chord: A minor, soft attack, long tail
end = ev["duration"]
for f, g in [(110.0, 0.20), (164.8, 0.12), (220.0, 0.12), (261.6, 0.09), (329.6, 0.08), (440.0, 0.04)]:
    n = int((end - e0 - 0.1 + 0.4) * SR)
    t = tt(n)
    pad = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t) + 0.2 * np.sin(2 * np.pi * f * 2 * t)) * np.minimum(1, t / 0.5) * np.interp(t, [0, (end - e0), (end - e0 + 0.4)], [1, 0.8, 0])
    put(dry, e0 + 0.1, pad * g * 0.17)
    put(wet, e0 + 0.1, pad * g * 0.12)

# ---- reverb send: a short dark room ---------------------------------------------------------------------------------------
ir_n = int(1.4 * SR)
ir = rng.standard_normal((2, ir_n)) * np.exp(-3.2 * tt(ir_n) / 1.4)
ir = np.stack([fast_lp(ir[0], 3500), fast_lp(ir[1], 3000)])
rv = np.zeros((2, N))
for c in range(2):
    L = N + ir_n
    rv[c] = np.fft.irfft(np.fft.rfft(wet[c], L) * np.fft.rfft(ir[c], L), L)[:N]
mix = dry + rv * 0.22

# ---- master: soft clip, high-pass the rumble below 30 Hz, fade the tail, normalise ----------------------------------------
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix[:, -int(0.35 * SR):] *= np.linspace(1, 0, int(0.35 * SR))
mix[:, :int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
mix *= 0.89 / np.max(np.abs(mix))
pcm = (mix.T * 32767).astype("<i2")
import wave
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[2], f"{DUR:.1f}s")
