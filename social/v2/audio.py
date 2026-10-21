#!/usr/bin/env python3
"""Soundtrack for the reel, synthesised with numpy and cut to the film's timeline (112 BPM, A minor).

No samples, no licensed music: pixel ticks, glass and bell tones, a sub boom, filtered noise whooshes, a convolution
reverb. Usage: python3 social/v2/audio.py timeline.json out.wav   (timeline.json is written by render.mjs frames)
"""
import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(1990)
tl = json.load(open(sys.argv[1]))
T = tl["T"]
DUR = tl["duration"] + 0.5
N = int(DUR * SR)
BEAT = 60 / 112
dry = np.zeros((2, N))
wet = np.zeros((2, N))


def tt(n): return np.arange(n) / SR


def put(buf, t0, sig, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[: N - i]
    buf[0, i:i + len(sig)] += sig * gain * np.cos((pan + 1) * np.pi / 4)
    buf[1, i:i + len(sig)] += sig * gain * np.sin((pan + 1) * np.pi / 4)


def env(n, a=.002, d=.1, k=5.0):
    t = tt(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-k * t / d)


def fft_filter(x, kind, fc, fc2=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    if kind == "lp": H = 1 / np.sqrt(1 + (f / fc) ** 4)
    elif kind == "hp": H = (f / fc) ** 2 / np.sqrt(1 + (f / fc) ** 4)
    else: H = (1 / np.sqrt(1 + (f / fc2) ** 4)) * ((f / fc) ** 2 / np.sqrt(1 + (f / fc) ** 4))
    return np.fft.irfft(X * H, len(x))


def sine(f, dur, f_end=None):
    n = int(dur * SR); t = tt(n)
    fr = f if f_end is None else f * (f_end / f) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(fr * np.ones(n)) / SR)


def square(f, dur, duty=.25):
    return np.where((tt(int(dur * SR)) * f) % 1.0 < duty, 1.0, -1.0)


def noise(dur): return rng.standard_normal(int(dur * SR))


def midi(m): return 440.0 * 2 ** ((m - 69) / 12)


# A minor pentatonic: A C D E G
PENT = [0, 3, 5, 7, 10]
def pnote(i, base=57): return midi(base + PENT[i % 5] + 12 * (i // 5))


def tick(t0, f, g=.12, dur=.06, duty=.25, pan=0.0, verb=.3):
    n = int(dur * SR); s = square(f, dur, duty) * env(n, .0008, dur * .55, 5)
    put(dry, t0, s, g, pan); put(wet, t0, s, g * verb, pan)


def bell(t0, f, g=.1, dur=1.6, pan=0.0, verb=.9):
    n = int(dur * SR); t = tt(n); s = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 1), (2.76, .5, .6), (5.4, .25, .35), (8.93, .12, .2)]:
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (dur * .38 * dec))
    s *= np.minimum(1, t / .002)
    put(dry, t0, s, g, pan); put(wet, t0, s, g * verb, pan)


def pluck(t0, f, g=.1, dur=.55, pan=0.0, verb=.5):
    n = int(dur * SR); t = tt(n)
    s = (np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 18) + .2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 30)) * np.exp(-t * 7)
    s *= np.minimum(1, t / .002)
    put(dry, t0, s, g, pan); put(wet, t0, s, g * verb, pan)


def kick(t0, g=.5, f0=130, f1=42, dur=.45):
    n = int(dur * SR)
    s = sine(f0, dur, f1) * env(n, .001, dur * .5, 5) + fft_filter(noise(dur), "lp", 2500) * env(n, .0005, .02, 6) * .25
    put(dry, t0, s, g)


def boom(t0, g=.8, dur=2.2, f0=70, f1=26):
    n = int(dur * SR)
    s = sine(f0, dur, f1) * env(n, .002, dur * .55, 4.5) + fft_filter(noise(dur), "lp", 600) * env(n, .001, dur * .3, 5) * .5
    put(dry, t0, s, g); put(wet, t0, s, g * .6)


def whoosh(t0, dur, f0, f1, g=.2, pan=0.0, shape=2.0):
    """noise with a band that sweeps from f0 to f1, rising in level (shape>1) or falling (shape<1)."""
    n = int(dur * SR); out = np.zeros(n); seg = int(.06 * SR)
    win = np.hanning(seg * 2)
    for k in range(0, n, seg):
        u = k / n; fc = f0 * (f1 / f0) ** u
        chunk = noise(seg * 2 / SR)[:seg * 2]
        out[k:k + seg * 2][:n - k] += (fft_filter(chunk, "bp", fc * .6, fc * 1.8) * win)[:n - k]
    lvl = np.linspace(0, 1, n) ** shape if shape >= 1 else (1 - np.linspace(0, 1, n)) ** (1 / shape)
    s = out * lvl * 1.1
    put(dry, t0, s, g, pan); put(wet, t0, s, g * .5, pan)


def riser(t0, dur, f0, f1, g=.12):
    n = int(dur * SR); s = sine(f0, dur, f1) * (np.linspace(0, 1, n) ** 2) + .4 * sine(f0 * 1.5, dur, f1 * 1.5) * (np.linspace(0, 1, n) ** 2.4)
    put(dry, t0, s, g); put(wet, t0, s, g * .5)


def pad(t0, dur, freqs, g=.05, att=.6, rel=.8, verb=.7):
    n = int(dur * SR); t = tt(n); s = np.zeros(n)
    for f in freqs:
        for det in (1.0, 1.004, .996):
            s += np.sin(2 * np.pi * f * det * t + rng.random() * 6.28) * (1 / 3) + .15 * np.sin(2 * np.pi * f * 2 * det * t)
    e = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel)
    s *= e / len(freqs)
    put(dry, t0, s, g); put(wet, t0, s, g * verb)


A2, E3, A3, C4, E4, G4, B4 = 45, 52, 57, 60, 64, 67, 71

# ======================================================================================================================
# 0. the fall: a thin high tone and an air rush toward the floor
whoosh(0.0, T["impact"], 400, 5200, .16, 0, 2.2)
riser(0.0, T["impact"], 220, 1760, .05)
tick(.02, midi(93), .05, .08, .5)

# 1. impact: boom, glass cluster, noise burst
ti = T["impact"]
boom(ti, .95, 2.4, 78, 28)
kick(ti, .55, 150, 40, .5)
n = int(.5 * SR); put(dry, ti, fft_filter(noise(.5), "hp", 1200) * env(n, .001, .15, 5) * .3); put(wet, ti, fft_filter(noise(.5), "hp", 1200) * env(n, .001, .15, 5) * .3)
for k, m in enumerate([81, 84, 88, 91, 93]):
    bell(ti + .02 + k * .035, midi(m), .09, 1.8, -.7 + k * .35)

# 2. the rain builds the b: ticks climbing the scale in 16ths, plus a dense scatter of tiny landings
t = T["rain0"] + .1
i = 0
while t < T["hero"] - .3:
    tick(t, pnote(5 + min(i, 12) // 1, 57) * 2 ** (1 if i > 5 else 0), .06 + .06 * min(1, i / 10), .06, .25 if i % 2 else .5, -.4 + .8 * ((i * 3) % 8) / 8)
    t += BEAT / 4; i += 1
for _ in range(190):
    tc = rng.uniform(T["rain0"] + .15, T["hero"] - .35) ** 1.0
    density = (tc - T["rain0"]) / (T["hero"] - T["rain0"])
    if rng.random() < .35 + .5 * density:
        n = int(.012 * SR)
        put(dry, tc, fft_filter(noise(.012), "bp", 1500, 7000) * env(n, .0004, .006, 6) * (.12 + .1 * rng.random()), 1, rng.uniform(-.8, .8))
        if rng.random() < .35: tick(tc, rng.choice([pnote(k, 69) for k in range(8)]), .03, .03, .25, rng.uniform(-.8, .8))
for k in range(4): kick(T["hero"] + k * BEAT, .0 + .22 * k / 3, 110, 45, .3)

# 3. hero: a pulse on every beat, hats on the off-beats, a riser to the strike
for k in range(int((T["strike"] - T["hero"]) / BEAT)):
    tb = T["hero"] + (k + 4) * BEAT
    if tb < T["strike"] - .25:
        kick(tb, .3, 120, 44, .35)
        n = int(.03 * SR); put(dry, tb + BEAT / 2, fft_filter(noise(.03), "hp", 6000) * env(n, .0004, .015, 6) * .12, 1, .3)
pad(T["hero"] - .3, T["strike"] - T["hero"] + .3, [midi(A2 + 12), midi(E3 + 12), midi(A3)], .07, .9, .3)
riser(T["strike"] - 1.6, 1.5, 180, 1900, .13)
whoosh(T["strike"] - 1.6, 1.5, 600, 9000, .18, 0, 2.6)
bell(T["emberUp"], midi(93), .08, 2.0, .3)

# 4. the strike: a crack, thunder, then the debris shimmer in slow motion
ts = T["strike"]
# a 90 ms hole in everything just before it, so the crack lands harder
for buf in (dry, wet):
    a, b = int((ts - .09) * SR), int(ts * SR)
    buf[:, a:b] *= np.linspace(1, .05, b - a)
n = int(.6 * SR); crack = fft_filter(noise(.6), "hp", 900) * env(n, .0004, .22, 6)
put(dry, ts, crack, .8); put(wet, ts, crack, .6)
boom(ts, 1.0, 3.0, 95, 24)
kick(ts, .7, 180, 36, .7)
for k in range(9): bell(ts + .04 + k * .05, midi(76 + 2 * k + (k % 2)), .07, 2.2, -.8 + k * .2)
whoosh(ts, 2.2, 7000, 500, .22, 0, .5)
for _ in range(130):
    tc = ts + .2 + rng.exponential(.7)
    if tc < T["reform"] + .2: bell(tc, midi(rng.choice([81, 84, 88, 91, 93, 96])), rng.uniform(.015, .04), rng.uniform(.8, 1.6), rng.uniform(-.9, .9))
pad(ts + .1, T["reform"] - ts + 1.0, [midi(A2 + 12), midi(E3 + 12), midi(A3), midi(C4), midi(E4)], .07, .5, .9)

# 5. the debris reassembles as a door: a rising swirl that resolves on the open chord
tr, td = T["reform"], T["doorDone"]
riser(tr, td - tr, 120, 1100, .1)
whoosh(tr, td - tr, 300, 6000, .15, 0, 1.8)
for k in range(24):
    tk = tr + (td - tr) * (k / 24) ** 1.3
    tick(tk, pnote(2 + k // 2, 57) * 2, .05 + .05 * k / 24, .05, .25, -.6 + 1.2 * (k % 7) / 7)
boom(td, .8, 2.4, 82, 30)
kick(td, .5, 140, 40, .5)
pad(td, 1.6, [midi(A2 + 12), midi(E3 + 12), midi(A3), midi(C4), midi(E4), midi(B4)], .09, .05, 1.0)
for k, m in enumerate([69, 72, 76, 79, 83]): bell(td + k * .06, midi(m + 12), .08, 2.2, -.6 + k * .3)

# 6. through the doorway: a tunnel whoosh into the flash
tp, tf = T["push"], T["flash"]
whoosh(tp - .1, tf - tp + .1, 250, 9000, .26, 0, 2.2)
riser(tp, tf - tp, 300, 2800, .1)
n = int(.7 * SR); fl = fft_filter(noise(.7), "hp", 500) * env(n, .001, .3, 5)
put(dry, tf, fl, .55); put(wet, tf, fl, .5)
boom(tf, .85, 2.6, 90, 30)
for k, m in enumerate([69, 76, 81, 84, 88, 93]): bell(tf + .01 + k * .03, midi(m), .1, 3.0, -.8 + k * .32)

# 7. world one (Orbit Shift): a bright, spacey bell arpeggio in 16ths
t1, t2 = T["flash"] + .15, T["w2"] - .35
seq = [0, 2, 4, 7, 9, 7, 4, 2]
k = 0
tc = t1
while tc < t2:
    bell(tc, pnote(seq[k % 8] + 5, 57) * 2, .045, 1.2, -.5 + .5 * np.sin(k), .8)
    tc += BEAT / 2; k += 1
pad(T["flash"] + .3, t2 - T["flash"], [midi(A3), midi(E4), midi(G4)], .05, .5, .8)
for q in range(int((t2 - t1) / BEAT)): kick(t1 + q * BEAT, .16, 110, 46, .3)

# 8. world two (Harvest & Hearth): warm plucks, a little major-pentatonic tune
t3 = T["w2"] - .3
whoosh(t3, .6, 500, 4000, .12, 0, 1.5)
tune = [(0, 0), (1, 2), (2, 4), (3, 2), (4, 7), (5, 4), (6, 2), (7, 0)]
for k in range(10):
    f = midi(60 + [0, 4, 7, 4, 9, 7, 4, 0, 2, 4][k]) * 1.0
    pluck(T["w2"] + .05 + k * BEAT / 2, f, .09, .6, -.4 + .08 * k)
pad(T["w2"], T["collapse"] - T["w2"] + .4, [midi(48), midi(55), midi(60), midi(64)], .07, .4, .8)
for q in range(int((T["collapse"] - T["w2"]) / BEAT)): kick(T["w2"] + q * BEAT, .14, 105, 44, .3)

# 9. collapse and the dolly zoom: tension rises, perspective flattens, then silence and one clean click
tc0, tf0, tf1 = T["collapse"], T["flat0"], T["flat1"]
riser(tc0, tf1 - tc0, 90, 2400, .14)
whoosh(tc0, tf1 - tc0, 200, 9000, .2, 0, 2.4)
for k in range(int((tf1 - tc0) / (BEAT / 2))):
    tk = tc0 + k * BEAT / 2
    kick(tk, .1 + .22 * k / ((tf1 - tc0) / (BEAT / 2)), 100, 46, .25)
for k in range(10): tick(tf0 + .1 + k * .06, pnote(10 + k, 57), .05 + .01 * k, .05, .25, rng.uniform(-.5, .5))
th = T["hand"]
for buf in (dry, wet):
    a, b = int((th - .12) * SR), int(th * SR)
    buf[:, a:b] *= np.linspace(1, 0, b - a)

# 10. the end card: a clean thunk, the wordmark's pixels, the headline hits, the button, the click
boom(th, .75, 2.4, 70, 30)
kick(th, .55, 120, 38, .5)
pad(th, 4.9, [midi(A2 + 12), midi(E3 + 12), midi(A3), midi(C4), midi(E4)], .1, .15, 1.4, .9)
for k in range(46): tick(th + .95 + rng.uniform(0, .8), pnote(int(rng.integers(8, 17)), 57), .04, .035, .25, rng.uniform(-.6, .6))
for k in range(30): tick(th + 1.25 + k * (.75 / 30), pnote(k // 2 + 5, 57) * 2, .05 + .02 * k / 30, .035, .5, -.5 + k / 30)
for dt in (1.15, 1.32): kick(th + dt, .4, 110, 44, .3); put(dry, th + dt, fft_filter(noise(.1), "lp", 900) * env(int(.1 * SR), .001, .05, 5) * .35)
whoosh(th + 1.1, .5, 400, 5000, .1, 0, 1.3)
whoosh(th + 1.95, .4, 600, 4000, .07, 0, 1.2)
for k in range(8): tick(th + 2.25 + k * .06, pnote(7 + k, 57), .05, .04, .5, .3)
tick(th + 3.5, midi(96), .1, .05, .5); tick(th + 3.53, midi(103), .08, .1, .5)
n = int(.04 * SR); put(dry, th + 3.78, fft_filter(noise(.04), "bp", 800, 5000) * env(n, .0005, .02, 6) * .25)
bell(th + 3.6, midi(81), .09, 2.4); bell(th + 3.64, midi(88), .06, 2.4, .3); bell(th + 3.68, midi(93), .05, 2.4, -.3)

# ---- reverb send: a dark room --------------------------------------------------------------------------------------
irn = int(1.8 * SR)
ir = np.stack([fft_filter(rng.standard_normal(irn) * np.exp(-3.0 * tt(irn) / 1.8), "lp", 3800), fft_filter(rng.standard_normal(irn) * np.exp(-3.0 * tt(irn) / 1.8), "lp", 3200)])
ir = ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
rv = np.zeros((2, N))
for c in range(2):
    L = N + irn
    rv[c] = np.fft.irfft(np.fft.rfft(wet[c], L) * np.fft.rfft(ir[c], L), L)[:N]
mix = dry + rv * 1.1

# ---- master -----------------------------------------------------------------------------------------------------------
print('pre-master peak', float(np.max(np.abs(mix))))
mix = np.tanh(mix * .55) / np.tanh(.55)
mix[:, -int(.5 * SR):] *= np.linspace(1, 0, int(.5 * SR))
mix *= .8 / np.max(np.abs(mix))
pcm = (mix.T * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", sys.argv[2], f"{DUR:.1f}s")
