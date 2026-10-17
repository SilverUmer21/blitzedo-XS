// Original synthesized score. No recordings, third-party music, or network requests.
export function createScore(context, duration = 12.8) {
  const rate = context.sampleRate, count = Math.ceil(rate * duration);
  const buffer = context.createBuffer(2, count, rate);
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1), speed = 12.8 / duration;
  let seed = 98123;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const add = (at, length, sample, pan = 0) => {
    const start = Math.floor(at / speed * rate), n = Math.min(count - start, Math.ceil(length / speed * rate));
    for (let k = 0; k < n; k++) {
      const t = k / rate * speed, value = sample(t, noise());
      L[start + k] += value * Math.sqrt((1 - pan) / 2);
      R[start + k] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  const hit = (at, gain = 1) => {
    add(at, 1.7, (t,n) => gain * (.46 * Math.sin(2*Math.PI*(43*t+6*(1-Math.exp(-t*17))))*Math.exp(-t*3.6) + n*.14*Math.exp(-t*27)));
    add(at, .5, (t,n) => n * gain * .10 * Math.exp(-t*12), -.18);
  };
  add(.12, 1.1, t => .075*Math.sin(t*2*Math.PI*620)*Math.exp(-t*7));
  [.82,1.00,1.18,1.38].forEach((t,i)=>add(t,.14,(s,n)=>(Math.sin(s*Math.PI*2*(360+i*170))*.06+n*.035)*Math.exp(-s*30),i%2?.7:-.7));
  hit(1.52,.6);
  for(let i=0;i<25;i++)add(1.8+i*.11,.12,(t,n)=>n*.052*Math.exp(-t*48),Math.sin(i*2.1)*.7);
  add(2.0,4.0,t=>Math.sin(t*2*Math.PI*52)*.055*Math.min(1,t)*Math.min(1,(4-t)*2));
  add(4.7,1.5,(t,n)=>n*.17*Math.pow(t/1.5,2)*Math.min(1,(1.5-t)*18));
  add(5.15,1.0,t=>Math.sin(2*Math.PI*(85*t+180*t*t))*Math.sin(t*Math.PI)*.12);
  hit(6.15,.8);
  add(6.12,1.75,(t,n)=>(n*.12+Math.sin(t*2*Math.PI*(110+170*t))*.06)*Math.sin(t/1.75*Math.PI));
  add(7.65,1.2,(t,n)=>n*.15*Math.pow(Math.sin(t/1.2*Math.PI),2));
  hit(8.85,1.4);
  [130.81,196,261.63,392].forEach((f,i)=>add(8.88,3.8,t=>Math.sin(t*Math.PI*2*f)*.065*(1-Math.exp(-t*32))*Math.exp(-t*(1.1+i*.22)),i%2?.28:-.28));
  for(let i=0;i<18;i++)add(9.1+i*.045,.08,(t,n)=>n*.05*Math.exp(-t*70),-.8+i*.09);
  for(let i=0;i<count;i++){L[i]=Math.tanh(L[i]*1.25)*.72;R[i]=Math.tanh(R[i]*1.25)*.72;}
  return buffer;
}
