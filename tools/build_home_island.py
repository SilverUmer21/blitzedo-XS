"""Blender 4.3 reference study, v04: faceted masonry and red interior light.
Run: blender -b -t 8 --python tools/build_home_island.py -- --export
Add --draft to render only a small, fast review image.
"""
import bpy, math, random, os, sys
from mathutils import Vector
random.seed(2104)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for folder in ['assets/home-island','renders/home-island']:
    os.makedirs(os.path.join(ROOT,folder),exist_ok=True)
DRAFT='--draft' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,color,rough=.6,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough
    b.inputs['Specular IOR Level'].default_value=.28
    if emission:
        b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    # Subtle broad mineral variation. Detail is predominantly geometric, not sand-like bump.
    geom=n.new('ShaderNodeNewGeometry');snap=n.new('ShaderNodeVectorMath');snap.operation='SNAP';snap.inputs[1].default_value=(.065,.065,.065)
    l.new(geom.outputs['Position'],snap.inputs[0])
    noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=9;noise.inputs['Detail'].default_value=2
    l.new(snap.outputs['Vector'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*(v*.68 for v in color),1);ramp.color_ramp.elements[1].color=(*(v*1.15 for v in color),1)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],b.inputs['Base Color'])
    micro=n.new('ShaderNodeTexNoise');micro.inputs['Scale'].default_value=110;micro.inputs['Detail'].default_value=2
    l.new(geom.outputs['Position'],micro.inputs['Vector'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.006
    l.new(micro.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],b.inputs['Normal'])
    return m
stone=[mat('Charcoal %02d'%i,(v,v*.98,v*.96),.57+i*.025) for i,v in enumerate([.006,.009,.012,.016,.021])]
red=[mat('Red ceramic %02d'%i,(v,.0015,.0025),.44,.06) for i,v in enumerate([.4,.56,.7])]
inner=mat('Red portal lining',(.62,.001,.002),.48,.25)
lightmat=mat('Recessed red light',(.8,.0005,.001),.4,.85)
materials=stone+red+[inner,lightmat]
groups={}
def dark():return random.choices(range(5),[2,5,5,3,1])[0]
def meshpart(group,verts,faces,indices):
    vs,fs,ms=groups.setdefault(group,([],[],[]));off=len(vs);vs.extend(verts);fs.extend([tuple(off+i for i in f) for f in faces]);ms.extend(indices)
def box(group,loc,size,mi=None,top=None):
    if mi is None:mi=dark()
    x,y,z=loc;a,b,c=[s/2 for s in size]
    verts=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    faces=[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    meshpart(group,verts,[f[::-1] for f in faces],[mi,mi if top is None else top,mi,mi,mi,mi])

def cross(a,b,p):return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
def clip(poly,a,b,inside=True):
    out=[]
    if not poly:return out
    for p,q in zip(poly,poly[1:]+poly[:1]):
        dp=cross(a,b,p)*(1 if inside else -1);dq=cross(a,b,q)*(1 if inside else -1)
        if dp>=-1e-8:out.append(p)
        if (dp<0)!=(dq<0):
            t=dp/(dp-dq);out.append((p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t))
    return out

def intersect(poly,bound):
    for a,b in zip(bound,bound[1:]+bound[:1]):poly=clip(poly,a,b)
    return poly

def subtract(poly,hole):
    pieces=[]
    for a,b in zip(hole,hole[1:]+hole[:1]):
        outside=clip(poly,a,b,False)
        if len(outside)>2:pieces.append(outside)
        poly=clip(poly,a,b)
        if not poly:break
    return pieces

stem=[(-1.55,0),(-.5,0),(-.5,5.25),(-1.55,5.25)]
bowl=[(-.5,0),(1.42,0),(1.9,.48),(1.9,2.28),(1.79,2.61),(1.55,2.91),(1.18,3.15),(-.5,3.15)]
hole=[(-.03,.18),(.98,.18),(.98,1.89),(.87,2.14),(.62,2.36),(.32,2.36),(.08,2.14),(-.03,1.9)]

def prism(group,poly,y0,y1,mi,redtop=False,lining=False):
    # poly is CCW in X/Z; front at negative Y.
    if len(poly)<3:return
    n=len(poly);verts=[(x,y0,z) for x,z in poly]+[(x,y1,z) for x,z in poly]
    faces=[tuple(range(n)),tuple(range(n,2*n))[::-1]];ids=[mi,mi]
    for i,(a,b) in enumerate(zip(poly,poly[1:]+poly[:1])):
        faces.append((i,i+n,(i+1)%n+n,(i+1)%n));idx=mi
        if redtop and b[0]<a[0]-.01:idx=random.choice([5,6,7])
        if lining:
            mid=((a[0]+b[0])/2,(a[1]+b[1])/2)
            if any(abs(cross(c,d,mid))<1e-5 and min(c[0],d[0])-1e-5<=mid[0]<=max(c[0],d[0])+1e-5 and min(c[1],d[1])-1e-5<=mid[1]<=max(c[1],d[1])+1e-5 for c,d in zip(hole,hole[1:]+hole[:1])):idx=8
        ids.append(idx)
    meshpart(group,verts,faces,ids)
    if group=='01 Architecture':
        # Small shallow chips/panels across depth faces, including the curved shoulder.
        for i,(a,b) in enumerate(zip(poly,poly[1:]+poly[:1])):
            dx=b[0]-a[0];dz=b[1]-a[1];length=math.hypot(dx,dz)
            if length<.14:continue
            # Stable per-edge detail keeps the main seeded block layout unchanged.
            rng=random.Random(round((a[0]+4)*1931+(a[1]+2)*137+y0*977))
            if rng.random()>.55:continue
            start=rng.uniform(.1,.35);end=min(.9,start+rng.uniform(.18,.4))
            nx,nz=dz/length,-dx/length;depth=.006
            p=(a[0]+dx*start,a[1]+dz*start);q=(a[0]+dx*end,a[1]+dz*end)
            patch=[p,(p[0]+nx*depth,p[1]+nz*depth),(q[0]+nx*depth,q[1]+nz*depth),q]
            py=y0+(y1-y0)*rng.uniform(.12,.4)
            prism('02 Pixel surface relief',patch,py,min(y1-.02,py+.12),ids[i+2] if rng.random()<.6 else mi)

# Masonry clipped to architectural profiles, rather than a voxel silhouette.
for label,bound,maxz in [('stem',stem,5.25),('bowl',bowl,3.15)]:
    z=0;row=0
    while z<maxz-.001:
        h=min(random.choice([.27,.34,.42,.5]),maxz-z);x=-1.55 if label=='stem' else -.5
        maxx=-.5 if label=='stem' else 1.9
        while x<maxx-.001:
            w=min(random.choice([.34,.46,.62,.77]),maxx-x)
            rect=[(x+.002,z+.002),(x+w-.002,z+.002),(x+w-.002,z+h-.002),(x+.002,z+h-.002)]
            poly=intersect(rect,bound);parts=[poly] if label=='stem' else subtract(poly,hole)
            for depth in range(3):
                y0=-.58+depth*.39+random.uniform(-.004,.004);y1=y0+.386
                mi=dark()
                if (x<-1.35 and depth>0 and random.random()<.4) or (depth==2 and random.random()<.12):mi=random.choice([5,6])
                for part in parts:prism('01 Architecture',part,y0,y1,mi,random.random()<.48,True)
            # Low-relief pixel panels on selected front faces; they share the main mass.
            for k in range(random.randint(4,10)):
                px=x+random.random()*w;pz=z+random.random()*h;pw=random.choice([.055,.08,.12,.16]);ph=random.choice([.06,.11,.17])
                tile=intersect([(px,pz),(px+pw,pz),(px+pw,pz+ph),(px,pz+ph)],bound)
                tiles=[tile] if label=='stem' else subtract(tile,hole)
                tint=dark()
                if (x<-1.4 or x>1.6) and random.random()<.18:tint=6
                for part in tiles:prism('02 Pixel surface relief',part,-.589-random.uniform(0,.012),-.576,tint)
            x+=w
        z+=h;row+=1

# Red inset slab sits behind the aperture, with visible jambs and actual light spill.
prism('03 Portal',hole,.34,.37,8)
for iz in range(8):
    for ix in range(4):
        x=.01+ix*.235;z=.2+iz*.27
        panel=intersect([(x+.003,z+.003),(x+.232,z+.003),(x+.232,z+.267),(x+.003,z+.267)],hole)
        prism('03 Portal',panel,.325,.335,9 if ix==3 or (ix==2 and iz%3==0) else 8)
for j in range(4):
    for i in range(4):box('03 Portal',(.06+i*.25,-.9+j*.28,.13),(.246,.275,.12),6,7)

# Solid, continuous stair support with shallow red tread plates.
for i in range(11):
    x=-.17-i*.145;z=.29+i*.235
    # One solid support with shallow seams instead of stacks of tiny cubes.
    box('04 Stair masonry',(x,-.91,(z-.045)/2),(.145,.55,z-.045),dark())
    box('05 Stair red treads',(x,-.925,z),(.155,.58,.045),5,7)
    for k in range(random.randint(1,4)):
        zz=random.uniform(.12,max(.13,z-.12));box('02 Pixel surface relief',(x,-1.19,zz),(.12,.012,.1),dark())
for i in range(4):
    z=2.875+i*.18;y=-.81+i*.19
    box('04 Stair masonry',(-1.73,y,z/2),(.45,.19,z),dark())
    box('05 Stair red treads',(-1.73,y,z+.022),(.46,.196,.044),5,7)

# A thick platform with hand-shaped groups of tapering hanging rock.
for ix in range(17):
    for iy in range(12):
        x=-2.65+ix*.32;y=-1.85+iy*.32
        if (ix in [0,16] or iy in [0,11]) and random.random()<.14:continue
        redcap= random.random()<(.42 if ix in [0,1,15,16] or iy in [0,1,10,11] else .20)
        box('06 Platform',(x,y,-.13+random.uniform(-.02,.02)),(.315,.315,.32),dark(),random.choice([5,6,7]) if redcap else dark())
# Distinct overlapping clusters: large upper chunks, smaller fractured tips.
for cx,cy,length,radius in [(-2,-1.1,1.05,.5),(-1,-1.35,1.75,.6),(.15,-1.2,1.25,.55),(1.3,-1.1,1.6,.6),(2,.1,1.1,.48),(-1.5,.6,1.3,.6),(-.2,.65,1.9,.7),(1,.7,1.25,.6),(-2.2,.1,1.4,.45)]:
    for layer in range(int(length/.18)):
        t=layer*.18;extent=radius*(1-t/(length+.16))
        step=.17 if layer>3 else .25
        for ix in range(-3,4):
            for iy in range(-3,4):
                x=cx+ix*step;y=cy+iy*step
                if abs(ix*step)>extent or abs(iy*step)>extent or random.random()<.11:continue
                width=step*random.uniform(.82,1.04)
                box('07 Hanging rock',(x+random.uniform(-.02,.02),y+random.uniform(-.02,.02),-.36-t),(width,width,.19),random.choice([5,6]) if random.random()<.065 else dark())
for x,y,z,size in [(-2.5,-1.9,-1,.33),(-1.2,-2,-2,.38),(.6,-1.8,-2.4,.33),(2.4,-1.1,-1.4,.32),(2.6,.5,-.7,.26)]:
    box('08 Floating fragments',(x,y,z),(size,size,size),dark(),6)
    box('08 Floating fragments',(x+.025,y,z-size*.65),(size*.58,size*.58,size*.4),dark())

for name,(verts,faces,ids) in groups.items():
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    for m in materials:me.materials.append(m)
    for face,mi in zip(me.polygons,ids):face.material_index=mi
    bevel=ob.modifiers.new('Fine edge glints','BEVEL');bevel.width=.0035 if 'relief' in name else .006;bevel.segments=1
    ob.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')

def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,color,size,target):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;aim(o,target)
area('Top key',(0,-1,9),1100,(1,.91,.84),4,(0,0,1))
area('Soft side edge',(5,2,5),850,(1,.91,.87),3,(0,0,2))
area('Restrained frontal fill',(-4,-8,4),85,(1,.96,.93),5,(0,0,2))
d=bpy.data.lights.new('Foundation focused reveal','SPOT');d.energy=430;d.color=(1,.96,.92);d.spot_size=math.radians(65);d.spot_blend=.7;d.shadow_soft_size=1.5
o=bpy.data.objects.new('Foundation focused reveal',d);bpy.context.collection.objects.link(o);o.location=(1,-4,-2);aim(o,(0,0,-.7))
area('Red doorway spill',(.48,-.05,1.3),22,(1,.001,.002),.8,(.4,-2,.3))
scene=bpy.context.scene
world=bpy.data.worlds.new('Black studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.012,.012,.012,1);world.node_tree.nodes['Background'].inputs[1].default_value=.2;scene.world=world
bpy.ops.object.camera_add(location=(8,-18,10));cam=bpy.context.object;cam.name='Approved reference angle';aim(cam,(0,0,1.35));cam.data.type='ORTHO';cam.data.ortho_scale=9.7;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24 if DRAFT else 96;scene.cycles.use_denoising=False
scene.render.resolution_x=700 if DRAFT else 1200;scene.render.resolution_y=820 if DRAFT else 1400;scene.render.resolution_percentage=100
scene.render.film_transparent=False;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.5
scene['reference']='design/concepts/home-play-beyond-approved.png; user supplied Tripo close-ups'
scene['scope']='No character. Version 04 architecture and lighting study. Procedural materials require baking for browser export.'
if not DRAFT:bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/home-island/home-island.blend'))
scene.render.filepath=os.path.join(ROOT,'renders/home-island/island-v04-draft.png' if DRAFT else 'renders/home-island/island-v04.png');bpy.ops.render.render(write_still=True)
if '--export' in sys.argv:bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'assets/home-island/home-island.glb'),export_format='GLB',export_apply=True,export_lights=False,export_cameras=False)
if not DRAFT:
    cam.location=(6,-14,6.5);aim(cam,(.05,-.2,1.9));cam.data.ortho_scale=4.7
    scene.render.resolution_x=1100;scene.render.resolution_y=1100
    scene.render.filepath=os.path.join(ROOT,'renders/home-island/island-v04-detail.png');bpy.ops.render.render(write_still=True)
print('ISLAND_BUILD_COMPLETE')
