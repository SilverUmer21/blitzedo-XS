// Deterministic Canvas 2D film: it also runs when WebGL is unavailable.
// The approved sculpture and exact SVG wordmark remain the focal artwork.
import {blitPixels,blitSparks,wordmarkViewBox} from './wordmark-data.js';
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
  const [stone,wordmark,stoneAtlas]=await Promise.all([loadAsset('island/assets/sculpture-fallback-v13.webp'),loadAsset('motion/wordmark-base.svg'),loadAsset('island/assets/pixel-stone-v9.webp')]);
  const logo=makeSurface(1360,288),lc=logo.getContext('2d',{willReadFrequently:true});
  lc.drawImage(wordmark,0,0,1360,288);
  const pixels=lc.getImageData(0,0,1360,288).data,dots=[];
  for(let y=0;y<288;y+=9)for(let x=0;x<1360;x+=9){const k=(y*1360+x)*4;if(pixels[k+3]>125)dots.push({x:x-680,y:y-144,n:dots.length});}
  const redMask=makeSurface(850,1008),rc=redMask.getContext('2d',{willReadFrequently:true});rc.drawImage(stone,0,0);
  const rgba=rc.getImageData(0,0,850,1008);
  for(let i=0;i<rgba.data.length;i+=4){const d=rgba.data,red=d[i]>130&&d[i]>d[i+1]*2.3;d[i]=255;d[i+1]=24;d[i+2]=8;d[i+3]=red?d[i+3]:0;}
  rc.putImageData(rgba,0,0);
  const glow=makeSurface(290,342),gc=glow.getContext('2d');gc.filter='blur(9px)';gc.drawImage(redMask,12,12,266,318);
  const shadow=makeSurface(850,1008),sc=shadow.getContext('2d');sc.drawImage(stone,0,0);sc.globalCompositeOperation='source-in';sc.fillStyle='#000';sc.fillRect(0,0,850,1008);
  const shards=Array.from({length:80},(_,i)=>({col:i%8,row:Math.floor(i/8),r:hash(i+1),s:hash(i+100)}));
  // The opening is one unworked piece of the same stone as the studio island.
  // Its red seam fractures around a living pixel; the released fragments become the world.
  const block=makeSurface(720,720),bc=block.getContext('2d');
  const polygon=(c,points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
  const front=[[-210,-150],[140,-150],[140,210],[-210,210]],right=[[140,-150],[230,-230],[230,130],[140,210]],top=[[-210,-150],[-120,-230],[230,-230],[140,-150]];
  bc.translate(360,360);
  function face(points,tile,shade,origin,u,v){
    bc.save();polygon(bc,points);bc.clip();bc.save();
    bc.transform(u[0]/256,u[1]/256,v[0]/256,v[1]/256,origin[0],origin[1]);
    bc.drawImage(stoneAtlas,(tile%4)*256,Math.floor(tile/4)*256,256,256,0,0,256,256);bc.restore();
    bc.fillStyle=`rgba(0,0,0,${shade})`;bc.fillRect(-250,-260,510,510);bc.restore();
    polygon(bc,points);bc.strokeStyle='#a29e8b38';bc.lineWidth=1.3;bc.stroke();
  }
  face(front,0,.68,[-210,-150],[350,0],[0,360]);
  face(right,5,.82,[140,-150],[90,-80],[0,360]);
  face(top,8,.53,[-210,-150],[350,0],[90,-80]);
  const crackRoutes=[
    [[0,16],[-65,16],[-65,48],[-140,48],[-140,68],[-210,68]],
    [[0,16],[0,-54],[-20,-54],[-20,-150],[-3,-165],[21,-165],[55,-199],[91,-199],[125,-230]],
    [[0,16],[78,16],[78,-16],[140,-16],[168,-41],[168,-9],[203,-40],[230,-64]],
    [[0,16],[0,78],[35,78],[35,135],[70,135],[70,210]]
  ];
  function crackLines(c,progress,strength){
    for(let n=0;n<crackRoutes.length;n++){
      const points=crackRoutes[n],lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
      let left=lengths.reduce((a,b)=>a+b,0)*clamp(progress*(1-n*.025));
      c.beginPath();c.moveTo(...points[0]);
      for(let i=0;i<lengths.length&&left>0;i++){const q=Math.min(1,left/lengths[i]);c.lineTo(mix(points[i][0],points[i+1][0],q),mix(points[i][1],points[i+1][1],q));left-=lengths[i];}
      c.lineJoin='miter';c.globalAlpha=strength*.12;c.strokeStyle='#ff2a0a';c.lineWidth=19;c.stroke();
      c.globalAlpha=strength*.35;c.lineWidth=6;c.stroke();
      c.globalAlpha=strength;c.strokeStyle='#ff4524';c.lineWidth=2.4;c.stroke();
      c.globalAlpha=strength*.85;c.strokeStyle='#ffe2af';c.lineWidth=.65;c.stroke();
    }c.globalAlpha=1;
  }
  const cracked=makeSurface(720,720),cc=cracked.getContext('2d');cc.drawImage(block,0,0);cc.translate(360,360);crackLines(cc,1,.84);
  const pieces=[
    [[-210,-150],[-20,-150],[-20,-54],[0,-54],[0,16],[-65,16],[-65,48],[-140,48],[-140,68],[-210,68]],
    [[-20,-150],[140,-150],[140,-16],[78,-16],[78,16],[0,16],[0,-54],[-20,-54]],
    [[0,16],[78,16],[78,-16],[140,-16],[140,210],[70,210],[70,135],[35,135],[35,78],[0,78]],
    [[0,16],[0,78],[35,78],[35,135],[70,135],[70,210],[-210,210],[-210,68],[-140,68],[-140,48],[-65,48],[-65,16]],
    [[-210,-150],[-120,-230],[125,-230],[91,-199],[55,-199],[21,-165],[-3,-165],[-20,-150]],
    [[-20,-150],[-3,-165],[21,-165],[55,-199],[91,-199],[125,-230],[230,-230],[140,-150]],
    [[140,-150],[230,-230],[230,-64],[203,-40],[168,-9],[168,-41],[140,-16]],
    [[140,-16],[168,-41],[168,-9],[203,-40],[230,-64],[230,130],[140,210]]
  ].map((points,i)=>{
    const fragment=makeSurface(720,720),fc=fragment.getContext('2d');fc.translate(360,360);polygon(fc,points);fc.clip();fc.drawImage(cracked,-360,-360);
    const x=points.reduce((a,p)=>a+p[0],0)/points.length,y=points.reduce((a,p)=>a+p[1],0)/points.length;
    const edge=makeSurface(720,720),ec=edge.getContext('2d');ec.drawImage(fragment,0,0);ec.globalCompositeOperation='source-in';ec.fillStyle='#24201b';ec.fillRect(0,0,720,720);
    return {image:fragment,edge,x,y,n:i};
  });
  let lastChapter='';
  function rect(x,y,w,h,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;}
  function aura(x,y,r,color,alpha=1){ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(235,20,6,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.globalAlpha=1;}
  function cube(x,y,s,a=1,hot=false,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=a;ctx.fillStyle=hot?'#fff1d3':'#ee2518';ctx.fillRect(-s/2,-s/2,s,s);ctx.fillStyle=hot?'#ff5c2a':'#7b100b';ctx.beginPath();ctx.moveTo(s/2,-s/2);ctx.lineTo(s*.85,-s*.83);ctx.lineTo(s*.85,s*.15);ctx.lineTo(s/2,s/2);ctx.fill();ctx.fillStyle=hot?'#fff9eb':'#ff5234';ctx.beginPath();ctx.moveTo(-s/2,-s/2);ctx.lineTo(-s*.15,-s*.83);ctx.lineTo(s*.85,-s*.83);ctx.lineTo(s/2,-s/2);ctx.fill();ctx.restore();}
  function emberField(t,strength=1){for(let i=0;i<45;i++){const n=hash(i+130),life=(t*.17+n)%1,x=960+(hash(i+80)-.5)*850+(life-.5)*110,y=880-life*820;cube(x,y,1.8+hash(i)*3,Math.sin(life*Math.PI)*.45*strength,i%13===0);}}
  // Chunky, connected flame tongues rather than a blurred point of light.
  // The flame lives in the pixel's local space and leans against its velocity.
  function burner(x,y,size,t,alpha=1,lean=0,power=1){
    const flicker=.9+.065*Math.sin(t*39)+.045*Math.sin(t*71),tick=Math.floor(t*18);
    aura(x,y,size*4.2,'rgba(236,40,9,.30)',alpha*power*flicker);
    ctx.save();ctx.translate(x,y);ctx.rotate(lean);
    const cell=size/5;
    for(let row=16;row>=0;row--){
      const h=row/17,sway=Math.sin(row*.65-t*10)*h*.75;
      const width=(3.2*(1-h)**.65+.25)*power;
      for(let col=-4;col<=4;col++){
        const edge=Math.abs(col-sway),n=hash(col*97+row*11+tick*13);
        if(edge>width||n<.04+h*.26)continue;
        const heat=(1-h)*.70+(1-edge/4)*.30+n*.1;
        const color=heat>.88?'#ffe9b4':heat>.71?'#ff9a48':heat>.5?'#ff4524':'#ae170e';
        rect(col*cell-cell/2,-size*.32-row*cell,cell+.6,cell+.6,color,alpha*(1-h*.65)*flicker);
      }
    }
    for(let i=0;i<16;i++){
      const life=(t*(.65+hash(i+4)*.5)+hash(i+20))%1;
      const drift=(hash(i+11)-.5)*size*(1+life*2.2),height=size*(.8+life*4.4);
      const s=size*(.065+hash(i)*.08)*(1-life*.4);
      rect(Math.round(drift/cell)*cell,-Math.round(height/cell)*cell,s,s,i%4===0?'#ffc180':'#ed3821',alpha*Math.sin(life*Math.PI)*.8);
    }
    ctx.restore();
    cube(x,y,size,alpha,true,Math.sin(t*5)*.045);
    // A white center and orange side keep the pixel readable inside its flame.
    rect(x-size*.29,y-size*.29,size*.53,size*.53,'#fff9e9',alpha*.85);
  }
  function wordmarkBurn(t){
    const start=9.32,clock=t-start;
    if(clock<0)return;
    const [vx,vy,vw,vh]=wordmarkViewBox;
    const sx=1360/vw,sy=288/vh;
    ctx.save();ctx.translate(-680,-144);
    // Exact wm-glow colors, step boundaries and 0.7-second left-to-right delay.
    for(const p of blitPixels){
      const age=clock-p.p*.7;
      // Cover fractional SVG row boundaries with contiguous canvas pixels,
      // including the ivory hold, so Chrome cannot expose hairline seams.
      ctx.fillStyle=age<0||age>=.56?'#FBF5EB':age<.16?'#FF8A66':age<.36?'#E8332A':'#FF8A66';
      const x=Math.round((p.x-vx)*sx),y=Math.round((p.y-vy)*sy);
      ctx.fillRect(x,y,Math.round((p.x+p.width-vx)*sx)-x,Math.round((p.y+p.height-vy)*sy)-y);
    }
    const right=Math.max(...blitPixels.map(p=>p.x+p.width));
    for(const s of blitSparks){
      const age=clock-(s.x-vx)/(right-vx)*.7-.12;
      if(age<0||age>=s.st*.38)continue;
      const q=age/(s.st*.38),step=Math.floor(q*9)/9;
      ctx.globalAlpha=q<.105?q/.105:1-(q-.105)/.895;
      ctx.fillStyle=s.color;ctx.fillRect((s.x+s.sx*step-vx)*sx,(s.y+s.sy*step-vy)*sy,s.width*sx,s.height*sy);
    }
    ctx.restore();
  }
  function firstPixel(t){
    const pulse=at=>t<at?0:Math.exp(-(t-at)*15)*Math.sin(clamp((t-at)/.09)*Math.PI/2);
    const beat=pulse(.48)*.55+pulse(.91)*.8+pulse(1.34);
    const crack=.12*phase(t,.34,.57)+.26*phase(t,.87,1.03)+.62*phase(t,1.25,1.56);
    const release=out(phase(t,1.58,2.46)),fade=1-smooth(phase(t,2.0,2.40));
    const zoom=mix(1.38,1.06,smooth(phase(t,0,1.58))),shake=beat*3.2;
    ctx.save();ctx.translate(960+Math.sin(t*83)*shake,515+Math.cos(t*69)*shake);ctx.scale(zoom,zoom);ctx.rotate(-.025+smooth(phase(t,0,1.58))*.025);
    if(t<1.58){
      ctx.globalAlpha=smooth(phase(t,0,.18));ctx.drawImage(block,-360,-360);ctx.globalAlpha=1;
      crackLines(ctx,crack,.3+crack*.6+beat*.3);
      // Reflected fire falls across the stone before the core breaks out.
      ctx.save();polygon(ctx,[[-210,-150],[-120,-230],[230,-230],[230,130],[140,210],[-210,210]]);ctx.clip();ctx.globalCompositeOperation='screen';
      aura(0,16,180+beat*35,'rgba(255,51,13,.40)',(.45+crack*.5)*(.92+.08*Math.sin(t*41)));ctx.restore();
      burner(0,16,30+crack*16+beat*5,t,.78+crack*.22,0,.72+crack*.28);
    }else{
      for(const p of pieces){const direction=Math.atan2(p.y-16,p.x),distance=release*(180+hash(p.n+430)*130);
        ctx.save();ctx.translate(Math.cos(direction)*distance,Math.sin(direction)*distance+release*release*75);ctx.rotate((hash(p.n+20)-.5)*release*.9);ctx.globalAlpha=fade;ctx.drawImage(p.edge,-354,-354);ctx.drawImage(p.image,-360,-360);ctx.restore();
      }
      for(let i=0;i<34;i++){const a=hash(i+850)*TAU,r=(80+hash(i+860)*240)*release;const x=Math.cos(a)*r,y=16+Math.sin(a)*r+release*release*130;rect(x,y,2+hash(i)*7,2+hash(i+1)*5,i%5===0?'#ff5d2e':'#6e6a5c',fade*(1-release*.5));}
    }
    ctx.restore();
    if(t>=1.58&&t<1.94){
      const q=phase(t,1.58,1.94),r=out(q)*250;
      aura(960,532,80+r,'rgba(255,103,35,.32)',(1-q)**2);
      for(let i=0;i<24;i++){const a=i/24*TAU,s=3+hash(i)*5;rect(960+Math.cos(a)*r,532+Math.sin(a)*r*.7,s,s,i%3?'#ed3e20':'#ffc081',(1-q)*.8);}
    }
    if(t>=1.58&&t<3.32){
      const q=smooth(phase(t,1.79,3.12));
      const point=p=>{const v=1-p;return [v*v*v*960+3*v*v*p*1240+3*v*p*p*1140+p*p*p*1001,v*v*v*532+3*v*v*p*175+3*v*p*p*330+p*p*p*560];};
      for(let i=27;i>=1;i--){const p=Math.max(0,q-i*.006),[x,y]=point(p),life=1-i/28,s=3+life*9;
        rect(x+(hash(i+Math.floor(t*20))-.5)*18*(1-life),y,s,s,i<8?'#ffae61':'#d73016',life*.65*(1-phase(t,3.1,3.32)));
      }
      const [x,y]=point(q),a=1-phase(t,3.12,3.32),[nextX,nextY]=point(Math.min(1,q+.002)),[prevX,prevY]=point(Math.max(0,q-.002));
      const direction=Math.atan2(nextY-prevY,nextX-prevX)-Math.PI/2;
      burner(x,y,mix(64,18,q),t,a,direction*smooth(phase(t,1.79,2.03)));
    }
    if(t>3.08&&t<3.55)aura(1001,560,100+phase(t,3.08,3.55)*130,'rgba(255,65,16,.32)',Math.sin(phase(t,3.08,3.55)*Math.PI));
  }
  function sculpt(t){
    const build=out(phase(t,2.05,3.55)),charge=phase(t,3.5,5.7),rush=phase(t,5.44,6.2);
    const scale=.87+smooth(phase(t,3.25,5.44))*.1+Math.pow(rush,4)*19;
    const sx=-425,sy=-504,sw=850,sh=1008;
    ctx.save();ctx.translate(960,548);ctx.rotate(Math.sin(t*.5)*.008-rush*.095);
    ctx.scale(scale,scale);ctx.translate(-48*rush,-4*rush);
    aura(52,50,410,'rgba(229,25,9,.22)',build*(.35+charge*.45));
    ctx.globalAlpha=build*(.25+charge*.45);ctx.drawImage(glow,sx-40,sy-40,930,1088);ctx.globalAlpha=1;
    if(build<1){
      for(const q of shards){const b=out(phase(t,2.05+q.r*.15,3.15+q.r*.35));if(!b)continue;
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
    wordmarkBurn(t);
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
    if(t>2.05&&t<6.23)sculpt(t);
    if(t<3.55)firstPixel(t);
    if(t>6.05&&t<8.5)tunnel(t);
    if(t>7.55)reveal(t);
    if(t>6.10&&t<6.32){const f=Math.sin(phase(t,6.10,6.32)*Math.PI);rect(0,0,W,H,'#fbad76',f*.16);}
    // Letterbox is deliberate; the action and logo stay within the central mobile-safe region.
    rect(0,0,W,46,'#050605');rect(0,H-46,W,46,'#050605');
    const vignette=ctx.createRadialGradient(960,540,390,960,540,1120);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#000b');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    for(let i=0;i<90;i++){const x=hash(i+Math.floor(t*15))*W,y=hash(i+290)*H;rect(x,y,1,1,'#e8dfc7',.055);}
    const chapter=t<1.58?'THE FIRST PIXEL':t<3.15?'BREAK FREE':t<5.5?'THE WORLD':t<7.6?'BEYOND':t<9.2?'BLITZEDO':'PLAY BEYOND';
    if(chapter!==lastChapter){if(options.onChapter)options.onChapter(chapter);else if(typeof document!=='undefined')document.querySelector('#chapter').textContent=chapter;lastChapter=chapter;}
  }
  function poster(){draw(3.8);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);rect(0,0,W,H,'#050605',.57);}
  return {draw,poster,dotCount:dots.length};
}
