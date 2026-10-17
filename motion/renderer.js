// Deterministic Canvas 2D film: it also runs when WebGL is unavailable.
// The approved sculpture and exact SVG wordmark remain the focal artwork.
const W=1920,H=1080,TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const phase=(t,a,b)=>clamp((t-a)/(b-a));
const smooth=x=>x*x*(3-2*x);
const out=x=>1-(1-x)**4;
const mix=(a,b,t)=>a+(b-a)*t;
const hash=i=>{const q=Math.sin(i*127.1+31.73)*43758.5453;return q-Math.floor(q);};
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Could not load '+src));i.src=src;});
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export async function createFilm(canvas,options={}){
  const loadAsset=options.loadImage||load,makeSurface=options.createCanvas||surface;
  const ctx=canvas.getContext('2d',{alpha:false});
  const [stone,wordmark]=await Promise.all([loadAsset('island/assets/sculpture-fallback-v13.webp'),loadAsset('assets/wordmark.svg')]);
  const logo=makeSurface(1360,288),lc=logo.getContext('2d',{willReadFrequently:true});
  lc.drawImage(wordmark,0,0,1360,288);
  const redLogo=makeSurface(1360,288),rl=redLogo.getContext('2d');rl.drawImage(logo,0,0);rl.globalCompositeOperation='source-in';rl.fillStyle='#ff3825';rl.fillRect(0,0,1360,288);
  const pixels=lc.getImageData(0,0,1360,288).data,dots=[];
  for(let y=0;y<288;y+=9)for(let x=0;x<1360;x+=9){const k=(y*1360+x)*4;if(pixels[k+3]>125)dots.push({x:x-680,y:y-144,n:dots.length});}
  const redMask=makeSurface(850,1008),rc=redMask.getContext('2d',{willReadFrequently:true});rc.drawImage(stone,0,0);
  const rgba=rc.getImageData(0,0,850,1008);
  for(let i=0;i<rgba.data.length;i+=4){const d=rgba.data,red=d[i]>130&&d[i]>d[i+1]*2.3;d[i]=255;d[i+1]=24;d[i+2]=8;d[i+3]=red?d[i+3]:0;}
  rc.putImageData(rgba,0,0);
  const glow=makeSurface(290,342),gc=glow.getContext('2d');gc.filter='blur(9px)';gc.drawImage(redMask,12,12,266,318);
  const shadow=makeSurface(850,1008),sc=shadow.getContext('2d');sc.drawImage(stone,0,0);sc.globalCompositeOperation='source-in';sc.fillStyle='#000';sc.fillRect(0,0,850,1008);
  const shards=Array.from({length:80},(_,i)=>({col:i%8,row:Math.floor(i/8),r:hash(i+1),s:hash(i+100)}));
  let lastChapter='';
  function rect(x,y,w,h,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;}
  function aura(x,y,r,color,alpha=1){ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(235,20,6,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.globalAlpha=1;}
  function cube(x,y,s,a=1,hot=false,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=a;ctx.fillStyle=hot?'#fff1d3':'#ee2518';ctx.fillRect(-s/2,-s/2,s,s);ctx.fillStyle=hot?'#ff5c2a':'#7b100b';ctx.beginPath();ctx.moveTo(s/2,-s/2);ctx.lineTo(s*.85,-s*.83);ctx.lineTo(s*.85,s*.15);ctx.lineTo(s/2,s/2);ctx.fill();ctx.fillStyle=hot?'#fff9eb':'#ff5234';ctx.beginPath();ctx.moveTo(-s/2,-s/2);ctx.lineTo(-s*.15,-s*.83);ctx.lineTo(s*.85,-s*.83);ctx.lineTo(s/2,-s/2);ctx.fill();ctx.restore();}
  function emberField(t,strength=1){for(let i=0;i<45;i++){const n=hash(i+130),life=(t*.17+n)%1,x=960+(hash(i+80)-.5)*850+(life-.5)*110,y=880-life*820;cube(x,y,1.8+hash(i)*3,Math.sin(life*Math.PI)*.45*strength,i%13===0);}}
  function sculpt(t){
    const build=out(phase(t,1.35,3.35)),charge=phase(t,3.5,5.7),rush=phase(t,5.44,6.2);
    const scale=.87+smooth(phase(t,3.25,5.44))*.1+Math.pow(rush,4)*19;
    const sx=-425,sy=-504,sw=850,sh=1008;
    ctx.save();ctx.translate(960,548);ctx.rotate(Math.sin(t*.5)*.008-rush*.095);
    ctx.scale(scale,scale);ctx.translate(-48*rush,-4*rush);
    aura(52,50,410,'rgba(229,25,9,.22)',build*(.35+charge*.45));
    ctx.globalAlpha=build*(.25+charge*.45);ctx.drawImage(glow,sx-40,sy-40,930,1088);ctx.globalAlpha=1;
    if(build<1){
      for(const q of shards){const b=out(phase(t,1.25+q.r*.35,2.7+q.r*.7));if(!b)continue;
        const x=q.col*sw/8,y=q.row*sh/10,dx=(q.col-3.5)*(1-b)*180,dy=(q.row-4.5)*(1-b)*120;
        ctx.save();ctx.translate(sx+x+sw/16+dx,sy+y+sh/20+dy);ctx.rotate((1-b)*(q.r-.5)*1.4);ctx.globalAlpha=b;
        ctx.drawImage(stone,x,y,sw/8,sh/10,-sw/16,-sh/20,sw/8+.5,sh/10+.5);ctx.restore();
      }
    }else{ctx.globalAlpha=1;ctx.drawImage(stone,sx,sy);}
    // A shadow passes off the stone, then a narrow light front travels through its original red surfaces.
    if(t<3.45&&build>.92){ctx.save();ctx.globalAlpha=(1-smooth(phase(t,1.8,3.45)))*.55;ctx.drawImage(shadow,sx,sy);ctx.restore();}
    const trace=phase(t,3.15,5.28),lineY=mix(660,-470,trace);
    ctx.save();ctx.beginPath();ctx.rect(-450,lineY-90,900,110);ctx.clip();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.sin(trace*Math.PI)*.7;ctx.drawImage(redMask,sx,sy);ctx.restore();
    if(charge>0)aura(38,16,65+charge*90,'rgba(255,52,12,.75)',charge*.56);
    ctx.restore();emberField(t,build);
    if(t<2.15){const p=phase(t,.62,1.65),x=mix(650,1050,p),y=540-Math.sin(p*Math.PI)*105;
      aura(x,y,85,'rgba(255,39,9,.45)',1-p*.6);
      for(let i=0;i<12;i++){const q=clamp(p-i*.014);rect(mix(650,1050,q),540-Math.sin(q*Math.PI)*105,4+q*3,4,'#ff3321',(1-i/12)*phase(t,.6,.85)*(1-phase(t,1.65,2.15)));}
      cube(x,y,12*(1-p)+4,1-phase(t,1.65,2.15),true,p*.7);
    }
  }
  function tunnel(t){
    const open=out(phase(t,6.05,6.4)),fade=1-smooth(phase(t,7.4,8.5));
    aura(960,540,650,'rgba(190,14,5,.13)',fade);ctx.save();ctx.translate(960,540);ctx.rotate(-.12+Math.sin(t)*.045);
    for(let i=0;i<160;i++){
      const z=(((hash(i+8)*70-(t-6.05)*30)%70)+70)%70+.8,p=680/z;
      const side=i%4,n=hash(i+20),x=(side<2?(side===0?-1:1)*(8+n*5):(n-.5)*24),y=(side>=2?(side===2?-1:1)*(5+hash(i+50)*3):(hash(i+66)-.5)*17);
      const px=x*p,py=y*p,s=(.1+hash(i+40)*.48)*p,a=Math.min(1,(70-z)/20)*fade*open;
      ctx.globalAlpha=a*.25;ctx.strokeStyle=i%6===0?'#ff9a64':'#d12617';ctx.lineWidth=Math.max(1,p*.025);ctx.beginPath();ctx.moveTo(px*.92,py*.92);ctx.lineTo(px*1.10,py*1.10);ctx.stroke();ctx.globalAlpha=1;
      cube(px,py,Math.min(90,s),a,i%17===0,(hash(i)-.5)*.45);
    }ctx.restore();
  }
  function reveal(t){
    const p=phase(t,7.55,8.87),hold=phase(t,8.87,10.3);
    const impact=Math.exp(-Math.max(0,t-8.87)*10)*phase(t,8.85,8.89),scale=1+impact*.065;
    ctx.save();ctx.translate(960,510);ctx.scale(scale,scale);
    if(t<9.38){for(const d of dots){
      const n=hash(d.n),q=smooth(clamp((p-n*.13)/.87)),spin=(1-q)*(.6+n)*2;
      const ox=d.x*(2.2+n*2)+Math.cos(n*TAU+spin)*620*(1-q),oy=d.y*7+Math.sin(n*TAU+spin)*740*(1-q);
      const x=mix(ox,d.x,q),y=mix(oy,d.y,q),size=mix(3+n*22,9,q);
      const visible=clamp(p*5-n*.7)*(1-phase(t,9.06,9.38));
      if(visible<=0)continue;ctx.globalAlpha=visible;ctx.fillStyle=q>.96?'#fbf5eb':n>.75?'#ffbd86':'#ed291a';ctx.fillRect(x,y,size+.5,size+.5);
    }ctx.globalAlpha=1;}
    if(t>8.92){ctx.globalAlpha=smooth(phase(t,8.92,9.30));ctx.drawImage(logo,-680,-144);ctx.globalAlpha=1;}
    // Pixel burn travels through "blit", preserving the exact wordmark underneath.
    if(t>9.1&&t<11.5){const x=mix(-700,-120,phase(t,9.1,11.5));
      ctx.save();ctx.beginPath();ctx.rect(x-12,-155,25,310);ctx.clip();ctx.globalAlpha=.8*(1-phase(t,11.1,11.5));ctx.drawImage(redLogo,-680,-144);ctx.restore();
      for(let i=0;i<22;i++){const q=(t*1.2+hash(i+200))%1,xx=x+(hash(i+80)-.5)*70,yy=-80-q*130;rect(xx,yy,2+hash(i+50)*4,3,'#f24b29',Math.sin(q*Math.PI)*.75*(1-phase(t,11.1,11.5)));}
    }
    ctx.restore();
    if(t>8.85&&t<9.35){const q=phase(t,8.85,9.35);for(let i=0;i<44;i++){const n=hash(i+580),side=i%2?-1:1;cube(960+side*(680+out(q)*(80+n*200)),500+(hash(i+660)-.5)*260,2+n*5,(1-q)*.65,i%9===0);}}
    // The hit leaves one red ember under the wordmark before the tagline resolves.
    const tag=smooth(phase(t,9.75,10.6));
    if(tag>0){ctx.save();ctx.globalAlpha=tag;ctx.fillStyle='#b9b9ad';ctx.font='400 18px "Inter Tight", Arial';ctx.textAlign='center';ctx.letterSpacing='8px';ctx.fillText('PLAY BEYOND',964,704+14*(1-tag));ctx.restore();}
    rect(956,757,8,8,'#ed2d1d',smooth(phase(t,10.6,11.2))*.9);
    if(impact>0)aura(960,520,850,'rgba(255,94,40,.14)',impact);
  }
  function draw(t){
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#050605';ctx.fillRect(0,0,W,H);
    // Fine, restrained film grain. No large background imagery or decorative scene clutter.
    aura(960,540,950,'rgba(40,36,28,.10)');
    if(t<1.35){const n=1+Math.sin(t*3)*.15,fade=1-phase(t,.8,1.35);aura(960,540,100,'rgba(255,32,10,.22)',fade);cube(960,540,13*n,fade,true,.12+t*.45);}
    if(t>.62&&t<6.23)sculpt(t);
    if(t>6.05&&t<8.5)tunnel(t);
    if(t>7.55)reveal(t);
    if(t>6.10&&t<6.32){const f=Math.sin(phase(t,6.10,6.32)*Math.PI);rect(0,0,W,H,'#fbad76',f*.16);}
    // Letterbox is deliberate; the action and logo stay within the central mobile-safe region.
    rect(0,0,W,46,'#050605');rect(0,H-46,W,46,'#050605');
    const vignette=ctx.createRadialGradient(960,540,390,960,540,1120);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#000b');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    for(let i=0;i<90;i++){const x=hash(i+Math.floor(t*15))*W,y=hash(i+290)*H;rect(x,y,1,1,'#e8dfc7',.055);}
    const chapter=t<1.5?'THE SPARK':t<5.5?'THE WORLD':t<7.6?'BEYOND':t<9.2?'BLITZEDO':'PLAY BEYOND';
    if(chapter!==lastChapter){if(options.onChapter)options.onChapter(chapter);else if(typeof document!=='undefined')document.querySelector('#chapter').textContent=chapter;lastChapter=chapter;}
  }
  function poster(){draw(3.8);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);rect(0,0,W,H,'#050605',.57);}
  return {draw,poster,dotCount:dots.length};
}
