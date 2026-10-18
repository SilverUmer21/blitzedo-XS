// Original procedural sound design: stone, a living pixel, pressure and release.
// Seeded synthesis keeps browser playback and offline exports identical.
export function createScore(context, duration = 12.8) {
  const rate = context.sampleRate, count = Math.ceil(rate * duration), speed = 12.8 / duration;
  const buffer = context.createBuffer(2, count, rate);
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1), TAU = Math.PI * 2;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => x * x * (3 - 2 * x);
  let seed = 98123;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  // Envelopes follow the film clock; oscillators follow real seconds so the short
  // cut retains the same tonal identity instead of pitching the entire score up.
  const add = (at, length, sample, pan = 0) => {
    const start = Math.floor(at / speed * rate), n = Math.min(count - start, Math.ceil(length / speed * rate));
    for (let k = 0; k < n; k++) {
      const real = k / rate, t = real * speed, value = sample(t, noise(), real);
      const p = typeof pan === 'function' ? pan(t / length) : pan;
      L[start + k] += value * Math.sqrt((1 - p) / 2);
      R[start + k] += value * Math.sqrt((1 + p) / 2);
    }
  };
  const band = (low, high) => {
    let lo = 0, hi = 0;
    const a = 1 - Math.exp(-TAU * low / rate), b = 1 - Math.exp(-TAU * high / rate);
    return n => { lo += a * (n - lo); hi += b * (n - hi); return hi - lo; };
  };
  const tone = (at, length, frequency, gain, pan = 0) => add(at, length, (t, n, r) => {
    const attack = 1 - Math.exp(-t * 140), decay = Math.exp(-t * 2.9 / length);
    return gain * attack * decay * (Math.sin(TAU * frequency * r) + .19 * Math.sin(TAU * frequency * 2.003 * r) * Math.exp(-t * 9));
  }, pan);
  const weight = (at, gain, length = 1.2) => {
    add(at, length, (t, n, r) => gain * (1 - Math.exp(-t * 350)) * Math.exp(-t * 5 / length)
      * Math.sin(TAU * (43 * r + 2.8 * (1 - Math.exp(-r * 32)))));
    const crack = band(280, 2800);
    add(at, .19, (t, n) => crack(n) * gain * .38 * Math.exp(-t * 42));
  };
  const stone = (at, gain, pan, size = 1) => {
    const grit = band(420 / size, 5700 / size);
    add(at, .42, (t, n, r) => {
      const strike = grit(n) * .58 * Math.exp(-t * 34);
      const body = [173, 311, 487, 863].reduce((s, f, i) => s + Math.sin(TAU * f / size * r) * Math.exp(-t * (16 + i * 13)) / (2.8 + i * 2), 0);
      return gain * (strike + body) * (1 - Math.exp(-t * 1400));
    }, pan);
  };

  // A low room tone makes the first close-up feel massive before it moves.
  const earth = band(26, 125);
  add(0, 1.58, (t, n, r) => (earth(n) * .28 + Math.sin(TAU * 37 * r) * .034)
    * clamp(t / .2) * (.45 + t * .35) * clamp((1.58 - t) / .05));
  const motif = [196, 233.0819, 293.6648]; // G, B-flat, D: the pixel's signature.
  [.48, .91, 1.34].forEach((at, i) => {
    weight(at, .17 + i * .075, .36);
    stone(at, .15 + i * .055, (i - 1) * .22, 1.65 - i * .15);
    tone(at + .018, .48, motif[i], .067 + i * .012, (i - 1) * .12);
    const stress = band(850, 3900);
    add(at - .10, .18, (t, n) => stress(n) * (.05 + i * .025) * Math.sin(Math.PI * t / .18) ** 2, (1 - i) * .35);
  });

  // Fracture: one deep snap followed by separate, spatially scattered chips.
  weight(1.58, .58, 1.25);
  stone(1.58, .72, -.12, 1.25);
  stone(1.595, .31, .31, .72);
  for (let i = 0; i < 19; i++) {
    const at = 1.62 + i * .044 + (i % 3) * .013;
    stone(at, .095 * Math.exp(-i / 10), Math.sin(i * 2.37) * .82, .35 + (i % 5) * .14);
  }
  const escape = band(700, 5800);
  add(1.79, 1.35, (t, n, r) => {
    const envelope = Math.sin(Math.PI * t / 1.35) ** 1.8;
    return (escape(n) * .11 + Math.sin(TAU * (640 * r - 175 * speed * r * r)) * .027) * envelope;
  }, p => Math.sin(p * Math.PI) * .72);
  // The released matter draws together into the original studio sculpture.
  for (let i = 0; i < 12; i++) stone(2.14 + i * .083, .075 + i * .003, Math.sin(i * 2.1) * .65, .75 + i * .07);
  weight(3.13, .27, .8);
  tone(3.13, 1.2, 293.6648, .07);

  // A fuse travels up the island. Small discontinuities feel like sparking grit.
  const fuse = band(1600, 7200);
  add(3.15, 2.24, (t, n, r) => fuse(n) * .071 * Math.sin(Math.PI * t / 2.24)
    * (.55 + .45 * Math.sin(TAU * 23 * r) ** 8), p => -.38 + p * .76);
  for (let i = 0; i < 24; i++) {
    const spark = band(2400, 9700);
    add(3.22 + i * .083, .048, (t, n) => spark(n) * .045 * Math.exp(-t * 95), Math.sin(i * 2.4) * .5);
  }
  add(3.42, 2.73, (t, n, r) => {
    const rise = t / 2.73, envelope = Math.sin(Math.PI * rise / 2) * clamp((2.73 - t) / .05);
    return (Math.sin(TAU * 49 * r) * .10 + Math.sin(TAU * 73.4162 * r) * .035) * envelope;
  });
  const pressure = band(150, 2400);
  add(4.52, 1.63, (t, n, r) => {
    const q = t / 1.63;
    return (pressure(n) * .32 + Math.sin(TAU * (72 * r + 120 * speed * r * r)) * .08)
      * q ** 2.3 * clamp((1.63 - t) / .035);
  }, p => Math.sin(p * Math.PI * 2) * .22);

  // Gate entry: air is pulled past the camera, with a low pressure hit at entry.
  weight(6.15, .54, 1.25);
  const air = band(210, 6800);
  add(5.69, 1.87, (t, n, r) => {
    const q = t / 1.87, pass = Math.exp(-Math.pow((t - .48) / .36, 2));
    return (air(n) * (.14 * Math.sin(q * Math.PI) + .29 * pass)
      + Math.sin(TAU * (220 * r - 45 * speed * r * r)) * .045 * Math.sin(q * Math.PI));
  }, p => .85 - 1.7 * p);
  for (let i = 0; i < 13; i++) {
    const pass = band(1100, 6200), at = 6.27 + i * .103;
    add(at, .17, (t, n) => pass(n) * .085 * Math.sin(t / .17 * Math.PI) ** 2, i % 2 ? .8 : -.8);
  }

  // The tunnel contracts into one point. A small breath precedes the logo hit.
  const gather = band(400, 4400);
  add(7.65, 1.04, (t, n, r) => (gather(n) * .25 + Math.sin(TAU * (180 * r + 210 * speed * r * r)) * .036)
    * Math.sin(t / 1.04 * Math.PI) ** 1.7, p => .55 - p * 1.1);
  weight(8.85, .87, 1.9);
  stone(8.85, .24, 0, 2.1);
  [98, 146.8324, 233.0819, 293.6648].forEach((f, i) => tone(8.87, 3.75, f, .085, i % 2 ? .33 : -.33));
  // Same three-note gesture, now open and twice as high: the pixel found its world.
  motif.forEach((f, i) => tone(8.89 + i * .16, 2.4 - i * .12, f * 2, .095, (i - 1) * .24));
  for (let i = 0; i < 18; i++) {
    const ember = band(2700, 8000);
    add(9.13 + i * .10, .08, (t, n) => ember(n) * .028 * Math.exp(-t * 65), -.7 + i * .075);
  }

  // Short, cross-fed room reflections. High-pass the send to keep bass articulate.
  const sendL = new Float32Array(count), sendR = new Float32Array(count);
  let ll = 0, lr = 0, hl = 0, hr = 0;
  const lowA = 1 - Math.exp(-TAU * 220 / rate), highA = 1 - Math.exp(-TAU * 5600 / rate);
  for (let i = 0; i < count; i++) {
    ll += lowA * (L[i] - ll); lr += lowA * (R[i] - lr);
    hl += highA * (L[i] - hl); hr += highA * (R[i] - hr);
    sendL[i] = hl - ll; sendR[i] = hr - lr;
  }
  [.043, .071, .113, .173, .239, .317, .449].forEach((delay, tap) => {
    const offset = Math.round(delay * rate), gain = .14 * Math.exp(-tap * .29);
    for (let i = offset; i < count; i++) {
      L[i] += (tap % 2 ? sendR : sendL)[i - offset] * gain;
      R[i] += (tap % 2 ? sendL : sendR)[i - offset] * gain;
    }
  });
  let peak = 0;
  for (let i = 0; i < count; i++) {
    const fade = clamp(i / (rate * .015)) * clamp((count - 1 - i) / (rate * .38));
    const t = i / rate * speed;
    // Let the motion continue through a nearly silent breath. Restore the exact
    // existing mix just before the 8.85-second logo impact, including its tail.
    const breath = 1 - .90 * smooth(clamp((t - 7.48) / .42)) * (1 - smooth(clamp((t - 8.82) / .03)));
    L[i] = Math.tanh(L[i] * 1.42) * fade * breath; R[i] = Math.tanh(R[i] * 1.42) * fade * breath;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const gain = peak > 0 ? .89 / peak : 1;
  for (let i = 0; i < count; i++) { L[i] *= gain; R[i] *= gain; }
  return buffer;
}
