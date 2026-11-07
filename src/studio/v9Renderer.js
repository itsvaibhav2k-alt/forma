/**
 * Forma Studio v9 presentation renderer, ported from the supplied handoff.
 * The original geometry construction and material shading are preserved here.
 * This module contains NO solver or trial state. Geometry and selected members
 * enter through the typed adapter in v9Renderer.d.ts / ModelView.tsx.
 */
function formaSpanDimensionV5(a,b,offset,extensionGap) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<1)return '';
  const ux=dx/length,uy=dy/length;
  const da=[a[0],a[1]+offset],db=[b[0],b[1]+offset];
  const mid=[(da[0]+db[0])/2,(da[1]+db[1])/2];
  const fmt=n=>Number(n.toFixed(2));
  const line=(x1,y1,x2,y2)=>'<line x1="'+fmt(x1)+'" y1="'+fmt(y1)+'" x2="'+fmt(x2)+'" y2="'+fmt(y2)+'"/>';
  const gap=Math.min(26,length*.22);
  let out='<g data-overlay="dimensions" pointer-events="none" aria-hidden="true" fill="none" stroke="#768490" stroke-width=".85">';
  for(const p of [a,b]){
    out+=line(p[0],p[1]+extensionGap,p[0],p[1]+offset+4.5);
  }
  out+=line(da[0],da[1],mid[0]-ux*gap,mid[1]-uy*gap);
  out+=line(mid[0]+ux*gap,mid[1]+uy*gap,db[0],db[1]);
  // Conventional oblique dimension ticks, rotated along the span's projected axis.
  for(const p of [da,db]){
    const tx=2.7*(ux+uy),ty=2.7*(uy-ux);
    out+=line(p[0]-tx,p[1]-ty,p[0]+tx,p[1]+ty);
  }
  const angle=fmt(Math.atan2(dy,dx)*180/Math.PI);
  return out+'<text transform="translate('+fmt(mid[0])+' '+fmt(mid[1])+') rotate('+angle+')" y="3.5" text-anchor="middle" font-family="Instrument Sans, system-ui, sans-serif" font-size="11" font-weight="500" stroke="none" fill="#657482">240 mm</text></g>';
}

function formaPart(name,markup){
  return '<g data-forma-part="'+name+'">'+markup+'</g>';
}
function drawFormaJointStudy(svg, opts={}) {
  const width = Math.max(100, opts.width || 800), height = Math.max(150, opts.height || 450);
  const bay = Math.max(1,Math.min(4,opts.pick || 2));
  const model = opts.solution;
  const member = model.members.find(m=>m.extra);
  const [lower,upper] = [model.nodes[member.a],model.nodes[member.b]].sort((a,b)=>a.y-b.y);
  const low = Number(lower.id.slice(1)), high = Number(upper.id.slice(1));
  const braceAngle = Math.atan2(upper.y-lower.y, upper.x-lower.x);
  const direction=[Math.cos(braceAngle),Math.sin(braceAngle)];
  const az=(43+(opts.orbit||0))*Math.PI/180,el=.56+(opts.pitch||0)*Math.PI/180;
  const a=Math.cos(az), b=Math.sin(az)*Math.sin(el), c=0, d=-Math.cos(el), e=Math.sin(az), f=-Math.cos(az)*Math.sin(el);
  const p=(x,y,z)=>[x*a+y*c+z*e,x*b+y*d+z*f];
  const fmt=n=>Number(n.toFixed(3));
  const pointList=arr=>arr.map(v=>v.map(fmt).join(' ')).join(',');
  const id='joint'+(svg.dataset.jointStudyId||(svg.dataset.jointStudyId=String(++drawFormaJointStudy.counter)))+'_';
  const ink=n=>'url(#'+id+n+')';
  const poly=(points,fill)=>'<polygon points="'+pointList(points)+'" fill="'+fill+'" stroke="'+fill+'" stroke-width=".1" stroke-linejoin="round"/>';
  const line=(A,B,color,w,extra='')=>'<line x1="'+fmt(A[0])+'" y1="'+fmt(A[1])+'" x2="'+fmt(B[0])+'" y2="'+fmt(B[1])+'" stroke="'+color+'" stroke-width="'+w+'" '+extra+'/>';
  const path=pts=>'M'+pts.map(v=>v.map(fmt).join(' ')).join('L')+'Z';
  const circle=(x,y,r,n=42,phase=0)=>Array.from({length:n},(_,i)=>[x+r*Math.cos(phase+2*Math.PI*i/n),y+r*Math.sin(phase+2*Math.PI*i/n)]);
  const gradient=(name,colors,x2='88%',y2='100%')=>'<linearGradient id="'+id+name+'" x1="0%" y1="0%" x2="'+x2+'" y2="'+y2+'">'+colors.map(([at,value])=>'<stop offset="'+at+'%" stop-color="'+value+'"/>').join('')+'</linearGradient>';
  const gs=gradient('steel',[[0,'#eeeee6'],[13,'#c2c7c0'],[42,'#a8b1ac'],[78,'#c4c8bd'],[100,'#909a96']],'85%','47%')+
    gradient('dark',[[0,'#939b95'],[22,'#707b77'],[69,'#515b58'],[100,'#7e8780']],'74%','100%')+
    gradient('brass',[[0,'#d9c18a'],[12,'#f3dfac'],[38,'#caa565'],[60,'#b18b49'],[84,'#e6c785'],[100,'#d1b274']],'22%','100%')+
    gradient('lathe',[[0,'#737b78'],[26,'#c5cdc8'],[39,'#eff1e7'],[66,'#a8b1a9'],[100,'#626a64']],'84%','100%')+
    gradient('plastic',[[0,'#606965'],[20,'#424a46'],[80,'#383e3d'],[100,'#626864']],'80%','90%');
  const defs='<defs>'+gs+'<filter id="'+id+'blur" x="-30%" y="-180%" width="165%" height="480%"><feGaussianBlur stdDeviation="3.7"/></filter></defs>';
  const shade=(col,n)=>{
    const number=parseInt(col.slice(1),16);
    return 'rgb('+[number>>16,(number>>8)&255,number&255].map(v=>Math.max(0,Math.min(255,Math.round(v*n)))).join(',')+')';
  };
  const plane=(z,markup)=>'<g transform="matrix('+[a,b,c,d,e*z,f*z].map(fmt).join(' ')+')">'+markup+'</g>';
  const outlines=[], layers=[];
  const projectLoop=(points,z)=>points.map(([x,y])=>p(x,y,z));
  function solid(outline,holes,z,th,material){
    const toPath=path(outline)+holes.map(path).join('');
    const front=Math.cos(az)>=0?z:z+th,back=Math.cos(az)>=0?z+th:z;
    outlines.push(...projectLoop(outline,front),...projectLoop(outline,back));
    let h=plane(back,'<path d="'+toPath+'" fill="'+material.side+'" fill-rule="evenodd"/>');
    const walls=[];
    for (const [kind,ring] of [[1,outline],...holes.map(hole=>[-1,hole])]) for(let i=0;i<ring.length;i++){
      const A=ring[i],B=ring[(i+1)%ring.length],dx=B[0]-A[0],dy=B[1]-A[1];
      const N=Math.hypot(dx,dy)||1;
      const nx=dy/N*kind,ny=-dx/N*kind;
      const lit=.71+.23*ny-.17*nx;
      const depth=(A[0]+B[0])*.5*Math.sin(az)*Math.cos(el)+(A[1]+B[1])*.5*Math.sin(el);
      walls.push({depth,h:poly([p(...A,back),p(...B,back),p(...B,front),p(...A,front)],shade(material.side,lit))});
    }
    walls.sort((l,r)=>l.depth-r.depth);
    h+=walls.map(v=>v.h).join('')+plane(front,'<path d="'+toPath+'" fill="'+material.top+'" fill-rule="evenodd" stroke="'+material.edge+'" stroke-width=".23" stroke-linejoin="round"/>');
    return h;
  }
  const stroke=(d,col,sw,extra='')=>'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+sw+'" stroke-linejoin="round" '+extra+'/>';
  const rim=(x,y,r,color,w)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+w+'"/>';
  const shank={top:ink('lathe'),side:'#b8c0b8',edge:'#e1e4d9'}, steel={top:ink('steel'),side:'#a9b2a9',edge:'#ebede2'}, bronze={top:ink('brass'),side:'#c6a269',edge:'#f7e3ab'}, black={top:ink('plastic'),side:'#717b74',edge:'#939b8e'};
  const ring=(r,ri,z,th,m)=>solid(circle(0,0,r),ri?[circle(0,0,ri)]:[],z,th,m);
  function screw(x,y,r,z){
    let h=solid(circle(x,y,r,32),[],z,.55,shank);
    h+=plane(z-.03,rim(x,y,r*.82,'#eff0e3','.16')+
      '<path d="'+path(circle(x,y,r*.39,6,Math.PI/6))+'" fill="#343c36" stroke="#7c8983" stroke-width=".18"/>'+
      stroke('M'+(x-r*.18)+' '+(y-r*.26)+'l'+r*.36+' 0','#a3aaa1','.12'));
    return h;
  }
  function cheek(z,front){
    const outline=[[-14.2,-5.5],[-13,-6.8],[13,-6.8],[14.2,-5.5],[14.2,.8],[12.7,2.1],[8.0,2.8],[4.8,8.2],[3.2,10.45],[-3.2,10.45],[-4.8,8.2],[-8,2.8],[-12.7,2.1],[-14.2,.8]];
    const pockets=[circle(0,0,3.7),circle(-10,-2.2,1.22),circle(10,-2.2,1.22)];
    let h=solid(outline,pockets,z,2.5,front?steel:{top:ink('dark'),side:'#929b90',edge:'#c9cdc2'});
    const inset=outline.map(([x,y])=>[x*.968,y*.944]);
    let detail=stroke(path(inset),front?'#8b9489':'#535d54','.21');
    for (const [x,y,r] of [[0,0,4.0],[-10,-2.2,1.66],[10,-2.2,1.66]]){
      detail+=rim(x,y,r,front?'#8c968c':'#515a54','.23')+rim(x,y,r+.22,front?'#e3e5d9':'#a7b0a4','.13');
    }
    // Small counterbored fastener securing the cheek to the frame.
    h+=plane(z-.02,detail)+screw(0,7.0,1.35,z-.30);
    return h;
  }
  function brace(z){
    const u=direction[0],v=direction[1],L=45;
    const Q=(x,y)=>[x*u-y*v,x*v+y*u];
    const outline=[];
    for(let i=0;i<=18;i++){const t=Math.PI*.5+Math.PI*i/18;outline.push(Q(Math.cos(t)*6.4,Math.sin(t)*6.4));}
    for(const [x,y] of [[4.4,-5.1],[10,-3.25],[L-9,-3.25],[L-4,-4.15],[L,-4.6]])outline.push(Q(x,y));
    for(let i=1;i<=18;i++){const t=-Math.PI*.5+Math.PI*i/18;outline.push(Q(L+Math.cos(t)*4.6,Math.sin(t)*4.6));}
    for(const [x,y] of [[L-4,4.15],[L-9,3.25],[10,3.25],[4.4,5.1]])outline.push(Q(x,y));
    const E=Q(L,0),hole=circle(0,0,3.2);
    const main=solid(outline,[hole,circle(...E,2.0)],z,2.35,bronze);
    let detail=rim(0,0,4.46,'#ae8c52','.34')+rim(0,0,4.78,'#e9d5a1','.22')+rim(...E,2.76,'#957941','.22');
    const pathPoints=[[10.7,-1.62],[12.1,-2.03],[L-9.9,-2.03],[L-8.6,-1.62],[L-10,-1.1],[12.2,-1.1]].map(([x,y])=>Q(x,y));
    detail+='<path d="'+path(pathPoints)+'" fill="#997e48"/>'+stroke('M'+Q(12,-1.13).join(' ')+'L'+Q(L-10.6,-1.13).join(' '),'#f6df9f','.18');
    const tx=Q(L*.57,.75);
    let angle=Math.atan2(v,u)*180/Math.PI; if(angle>90||angle< -90)angle+=180;
    detail+='<g transform="translate('+tx.map(fmt).join(' ')+') rotate('+fmt(angle)+') scale(1 -1)"><text text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="1.22" font-weight="640" letter-spacing=".22" fill="#826a3f">FORMA  /  P0'+bay+'</text></g>';
    return Math.cos(az)>=0?main+plane(z-.05,detail):main;
  }
  layers.push(formaPart('cheek',cheek(69,false)));
  layers.push(formaPart('sleeve',ring(4.5,3.13,48.5,5.2,shank)+ring(6.0,3.13,47.65,.85,shank)));
  layers.push(formaPart('brace',brace(26)));
  layers.push(formaPart('washer',ring(6.65,3.25,4.0,1.8,black)+plane(3.98,rim(0,0,5.8,'#9ca499','.18'))));
  layers.push(formaPart('cheek',cheek(-15,true)));
  function pin(){
    let h=ring(3.0,0,-51.2,13.8,shank);
    for(let i=0;i<5;i++){
      const z=-38.7-i*.48;
      h+=ring(3.02,0,z,.17,{top:'#9fa79f',side:'#9ba69d',edge:'#b4bcb1'});
    }
    h+=ring(5.2,0,-52.5,1.35,{top:ink('dark'),side:'#818b81',edge:'#c3ccc0'});
    h+=ring(5.8,0,-54.8,2.45,shank);
    h+=plane(-54.85,rim(0,0,5.38,'#e2e7db','.18')+rim(0,0,4.95,'#929c92','.15')+rim(0,0,4.7,'#d3d8cc','.12')+
      '<path d="'+path(circle(0,0,2.2,6,Math.PI/6))+'" fill="#414a43" stroke="#d4dccd" stroke-width=".21"/>'+
      '<path d="'+path(circle(0,0,1.73,6,Math.PI/6))+'" fill="#303932"/>');
    return h;
  }
  layers.push(formaPart('pin',pin()));
  const minx=Math.min(...outlines.map(q=>q[0])),maxx=Math.max(...outlines.map(q=>q[0])),miny=Math.min(...outlines.map(q=>q[1])),maxy=Math.max(...outlines.map(q=>q[1]));
  const s=Math.min((width*(width>600?.72:.88))/(maxx-minx),(height*(width>600?.66:.66))/(maxy-miny))*(opts.zoom||1);
  const ox=width*.5-(minx+maxx)*s*.5+(opts.panX||0),oy=height*.52-(miny+maxy)*s*.5+(opts.panY||0);
  const toCanvas=([x,y])=>[x*s+ox,y*s+oy];
  const ground='<ellipse cx="'+fmt((maxx+minx)*.5)+'" cy="'+fmt(maxy+5)+'" rx="'+fmt((maxx-minx)*.48)+'" ry="2.35" fill="#454a40" opacity=".16" filter="url(#'+id+'blur)"/>';
  let artwork='<g transform="translate('+fmt(ox)+' '+fmt(oy)+') scale('+fmt(s)+')">'+'<g data-forma-ground="">'+ground+
    line(p(0,0,-58),p(0,0,77),'#96a198',Math.max(.18,.75/s),'stroke-dasharray="1.2 1.35" opacity=".65"')+'</g>'+(Math.cos(az)*Math.cos(el)>=0?layers:layers.slice().reverse()).join('')+'</g>';
  if(opts.showLabels && !svg.dataset.isolatedPart && width>570){
    const labels=[[p(0,0,-54.9),'Shoulder pin',-1,1],[p(3.3,8.6,69),'Rear cheek',1,-1]];
    for (const [target,text,side,top] of labels) {
      const pt=toCanvas(target),sideLength=Math.min(44,width*.042),elbow=[pt[0]+side*sideLength*.57,pt[1]+top*Math.min(26,height*.045)],end=[elbow[0]+side*sideLength,elbow[1]];
      artwork+='<g fill="none" stroke="#778580" stroke-width=".8"><path d="M'+pt.map(fmt).join(' ')+'L'+elbow.map(fmt).join(' ')+'L'+end.map(fmt).join(' ')+'"/></g><text x="'+fmt(end[0]+side*5)+'" y="'+fmt(end[1]+3)+'" text-anchor="'+(side<0?'end':'start')+'" fill="#566761" font-family="Instrument Sans,Arial,sans-serif" font-size="10">'+text+'</text>';
    }
  }
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Illustrative exploded joint at B'+low+', panel '+bay+'. A shoulder pin, cheek plates and spacer align with the end of the T'+high+' to B'+low+' brace.');
  svg.style.width='100%';svg.style.height=height+'px';svg.style.display='block';svg.innerHTML=defs+artwork;svg.onpointerdown=null;
}
drawFormaJointStudy.counter=0;

function drawFormaModel(svg, opts = {}) {
  const width = Math.max(1, Math.round(opts.width || svg.getBoundingClientRect().width || 800));
  const height = Math.max(1, Math.round(opts.height || svg.getBoundingClientRect().height || 450));
  const selected = Math.max(0, Math.min(4, Number(opts.pick) || 0));
  const bay = selected || 2;
  const load = Math.max(1, Math.min(3, Number(opts.load) || 1));
  const lift = opts.lift === false ? 0 : typeof opts.lift === 'number' ? 30 * Math.max(0, Math.min(1, opts.lift)) : 30;
  const depth = 57;
  const angle = (39 + (opts.orbit || 0)) * Math.PI / 180;
  const elevation = .665 + (opts.pitch || 0) * Math.PI / 180;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const ce = Math.cos(elevation), se = Math.sin(elevation);
  const project = (x,y,z) => [x*ca-z*sa, -x*sa*se-y*ce-z*ca*se];
  // Use a fixed camera target and scale throughout orbit; the end elevation should look narrower.
  const homeAz=39*Math.PI/180, homeEl=.665;
  const home=(x,y,z)=>[x*Math.cos(homeAz)-z*Math.sin(homeAz),-x*Math.sin(homeAz)*Math.sin(homeEl)-y*Math.cos(homeEl)-z*Math.cos(homeAz)*Math.sin(homeEl)];
  const bounds=[];
  for(const x of [-10,250])for(const z of [-7,depth+6])for(const y of [-15,44])bounds.push(home(x,y,z));
  for(const x of [0,240])bounds.push(home(x,46,depth-2));
  for(const x of [60,180])bounds.push(home(x,61,0));
  const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const padX=width<500?15:Math.max(32,width*.072),padTop=width<500?25:24,padBottom=width<500?32:27;
  const s=Math.max(.12,Math.min((width-2*padX)/(x1-x0),(height-padTop-padBottom)/(y1-y0)))*(opts.zoom||1);
  const center=project(120,17,depth/2),reference=home(120,17,depth/2);
  const origin=[width*.5-(center[0]-reference[0]+(x0+x1)*.5)*s+(opts.panX||0),
    (height+padTop-padBottom)*.5-(center[1]-reference[1]+(y0+y1)*.5)*s+(opts.panY||0)];
  const P = (x,y,z) => {const q=project(x,y,z);return [origin[0]+q[0]*s,origin[1]+q[1]*s];};
  const fmt = n => +n.toFixed(2), pts = p => p.map(q=>q.map(fmt).join(',')).join(' ');
  const id = 'forma8_'+(svg.dataset.formaRenderId || (svg.dataset.formaRenderId=String(++drawFormaModel.id)))+'_';
  const paint = name=>'url(#'+id+name+')';
  const geometry = typeof opts.onGeometry === 'function' ? [] : null;
  const face=(v,color,extra='')=>{
    if (geometry && !extra.includes('opacity=') && !extra.includes('filter=')) geometry.push({vertices:v,color,extra});
    return '<polygon points="'+pts(v.map(p=>P(...p)))+'" fill="'+color+'" '+extra+'/>';
  };
  const ln=(a,b,c,w,o=1,extra='')=>'<path d="M'+a.map(fmt).join(' ')+'L'+b.map(fmt).join(' ')+'" fill="none" stroke="'+c+'" stroke-width="'+fmt(w)+'" opacity="'+o+'" '+extra+'/>';
  const line=(a,b,c,w,o=1,extra='')=>ln(P(...a),P(...b),c,Math.max(.35,w*s),o,extra);
  const oval=(p,rx,ry,c,extra='')=>'<ellipse cx="'+fmt(p[0])+'" cy="'+fmt(p[1])+'" rx="'+fmt(rx)+'" ry="'+fmt(ry)+'" fill="'+c+'" '+extra+'/>';
  const grad=(n,stops,x='18%',y='100%')=>'<linearGradient id="'+id+n+'" x1="0%" y1="0%" x2="'+x+'" y2="'+y+'">'+stops.map(([at,c])=>'<stop offset="'+at+'%" stop-color="'+c+'"/>').join('')+'</linearGradient>';

  const F = {
    spacer:[[0,'#a55d60'],[35,'#874047'],[70,'#743a41'],[100,'#6a333c']],
    graphite:[[0,'#292d2c'],[22,'#4b4d48'],[43,'#686a61'],[63,'#555650'],[100,'#303431']],
    dark:[[0,'#4c5356'],[19,'#414548'],[65,'#2f3438'],[100,'#1e2428']],
    silver:[[0,'#e3e7e5'],[25,'#c2cacb'],[51,'#a1acae'],[70,'#8b979a'],[100,'#aeb9b9']],
    bright:[[0,'#edeae2'],[32,'#f0f2ed'],[60,'#c6cccd'],[100,'#9fa8aa']],
    deck:[[0,'#adb5b6'],[27,'#9da7a8'],[59,'#8c989a'],[90,'#737f83'],[100,'#647073']],
    plate:[[0,'#dee3e1'],[35,'#bbc4c4'],[76,'#9da8aa'],[99,'#879497']],
    gold:[[0,'#f5e0a0'],[20,'#e2c675'],[47,'#c7a450'],[78,'#aa8437'],[100,'#cbab60']],
    pin:[[0,'#f9f6e9'],[25,'#dadccd'],[52,'#c9ccc4'],[79,'#8f9995'],[100,'#6e7874']],
    brasspin:[[0,'#f7e5a8'],[32,'#e4c776'],[70,'#b19349'],[100,'#a88a48']],
    bearing:[[0,'#c9cbbf'],[58,'#a4a99f'],[100,'#787f74']]
  };
  let defs='<defs>'+Object.entries(F).map(([name,stops])=>grad(name,stops,name==='graphite'?'85%':'30%',name==='graphite'?'60%':'100%')).join('')+
    '<filter id="'+id+'shadow" x="-50%" y="-110%" width="210%" height="350%"><feGaussianBlur stdDeviation="'+fmt(Math.max(3.5,s*3.15))+'"/></filter>'+
    '<filter id="'+id+'contact" x="-45%" y="-125%" width="195%" height="390%"><feGaussianBlur stdDeviation="'+fmt(Math.max(.65,s*.85))+'"/></filter></defs>';
  const alu=[paint('silver'),paint('bright'),'#6a7478'], charcoal=[paint('graphite'),'#73766c','#282c28'];
  const rear=[paint('silver'),'#d4d9d7','#7e898c'];
  const gold=[paint('gold'),'#f6e6aa','#977537'];
  function box(ax,bx,ay,by,az,bz,m,edge=false) {
    const x=sa>=0?ax:bx, y=se>=0?by:ay, z=ca>=0?az:bz;
    let h=face([[x,ay,az],[x,ay,bz],[x,by,bz],[x,by,az]],m[2]);
    h+=face([[ax,ay,z],[bx,ay,z],[bx,by,z],[ax,by,z]],m[0]);
    h+=face([[ax,y,az],[bx,y,az],[bx,y,bz],[ax,y,bz]],se>=0?m[1]:m[2]);
    if(edge)h+=line([ax,y,z],[bx,y,z],se>=0?'#f8faf9':'#66706e',.18,.8);
    return h;
  }
  // A real finite-width strap in a vertical plane; five surfaces meet at each joint.
  function strap(a,b,z,w,th,m,lip=false) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    let nx=-dy/len,ny=dx/len;
    if(ny<0 || (ny===0 && nx>0)){nx=-nx;ny=-ny;}
    const Q=(p,k,d)=>[p[0]+nx*k,p[1]+ny*k,d];
    const A=Q(a,w/2,z),B=Q(b,w/2,z),C=Q(b,-w/2,z),D=Q(a,-w/2,z);
    let h=face([D,C,Q(b,-w/2,z+th),Q(a,-w/2,z+th)],m[2])+
      face([A,D,Q(a,-w/2,z+th),Q(a,w/2,z+th)],m[2])+
      face([A,B,Q(b,w/2,z+th),Q(a,w/2,z+th)],m[1])+face([A,B,C,D],m[0]);
    if(lip)h+=line(Q(a,-w*.31,z),Q(b,-w*.31,z),m[2],.32,.8);
    return h+line(A,B,'#f5f8f7',.18,.72);
  }
  const nodes = opts.solution.nodes.map(node => [node.x, node.y]);
  const candidates=[[5,1],[6,2],[2,8],[3,9]], diagonals=[[0,6],[1,7],[7,3],[8,4]];
  const chosen=candidates[bay-1], jointId=chosen.find(i=>i<5);
  // Rings and socket recesses use the joint plane, including its true foreshortening.
  function turned(x,y,z,r,color,count=28,angle=0){
    const v=Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count+angle;return [x+Math.cos(a)*r,y+Math.sin(a)*r,z];});
    return face(v,color);
  }
  function fastener(x,y,z,r,warm=false) {
    const light=warm?'#f9e9b3':'#e8e9db', rim=warm?'#776239':'#666c63';
    return turned(x,y-.06,z,r*1.12,'#575d52')+
      turned(x,y,z-.03,r*1.055,light)+turned(x,y,z-.11,r*.92,rim)+
      turned(x,y,z-.15,r*.78, warm?paint('brasspin'):paint('pin'))+
      turned(x,y+.035,z-.17,r*.33,warm?'#8f743e':'#71776a',6,Math.PI/6)+
      turned(x,y-.005,z-.18,r*.255,warm?'#574424':'#41473e',6,Math.PI/6);
  }
  function railJoint(i,z,near) {
    const [x,y]=nodes[i], col=i%5,top=i>=5,sy=top?-1:1;
    const l=col===0?-3.0:-5.8,r=col===4?3.0:5.8;
    const outline=[[l+.9,-2.05],[r-.9,-2.05],[r,-1.15],[r,1.12],[Math.min(3.63,r),2.15],[1.7,4.37],[.9,4.67],[-1.03,4.67],[-1.7,4.3],[Math.max(l,-3.57),2.15],[l,1.12],[l,-1.15]];
    const poly=(d,scale=1,shift=0)=>outline.map(([u,v])=>[x+u*scale,y+v*sy*scale+shift,d]);
    let h=face(poly(z+.34,1.025,-.18),'#323930')+face(poly(z+.22,1.012),'#686e60')+face(poly(z-.16),near?'#e1e1d3':'#bdbfb3')+face(poly(z-.20,.948),near?paint('plate'):'#a9aea0');
    for(const d of [-3.95,3.95])if(d>l+.1&&d<r-.1)h+=fastener(x+d,y+.09*sy,z-.21,.63);
    if(near) h+=fastener(x,y+3.18*sy,z-.22,.53);
    h+=fastener(x,y,z-.28,near?1.95:1.36,near&&selected&&chosen.includes(i));
    return h;
  }
  // Milled link plates widen into a shoulder around the bushed end of each member.
  function linkPlate(a,b,z,centerWidth,endWidth,th,m,warm=false) {
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),u=dx/length,v=dy/length;
    const Q=(d,f,dep)=>[a[0]+u*d-v*f,a[1]+v*d+u*f,dep];
    const cw=centerWidth/2,ew=endWidth/2,k=1.12;
    const shape=[[-1.4,-cw],[-.5,-ew],[2.75,-ew],[6.2,-cw],[length-6.2,-cw],[length-2.75,-ew],[length+.5,-ew],[length+1.4,-cw],[length+1.4,cw],[length+.5,ew],[length-2.75,ew],[length-6.2,cw],[6.2,cw],[2.75,ew],[-.5,ew],[-1.4,cw]];
    const back=shape.map(([d,f])=>Q(d,f,z+th)),front=shape.map(([d,f])=>Q(d,f,z));
    let h=face(ca>=0?back:front,m[2]);
    for(let i=0;i<shape.length;i++){
      const j=(i+1)%shape.length;
      const n=shape[j][0]-shape[i][0], t=shape[j][1]-shape[i][1];
      const exposedY=-(n*u-t*v);
      h+=face([front[i],front[j],back[j],back[i]],exposedY>0?m[1]:m[2]);
    }
    h+=face(ca>=0?front:back,m[0]);
    if(ca<0)return h;
    const upper=u>=0?cw:-cw, clip=7.4;
    h+=line(Q(clip,upper*.78,z-.025),Q(length-clip,upper*.78,z-.025),warm?'#fff1b4':'#f2f1e2',.19,.85);
    if(!warm)h+=line(Q(clip,-upper*.78,z-.03),Q(length-clip,-upper*.78,z-.03),'#777e70',.24,.54);
    if(warm && length>50) {
      // A recessed center flute catches the light and leaves both screw bosses untouched.
      const g=.30;
      const f=[[8.7,0],[9.9,-g],[length*.42,-g],[length*.42+.4,0],[length*.42,g],[9.9,g]].map(([d,n])=>Q(d,n,z-.038));
      h+=face(f,'#977a3c');
      h+=line(Q(10,-g,z-.045),Q(length*.42,-g,z-.045),'#edcf80',.12,.99);
      if(s>1.7){
        const p=P(...Q(length*.68,0,z-.055)),q=P(...Q(length*.75,0,z-.055));
        let deg=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;if(deg>90||deg< -90)deg+=180;
        h+='<text transform="translate('+fmt(p[0])+' '+fmt(p[1])+') rotate('+fmt(deg)+')" fill="#6f5830" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="'+fmt(1.12*s)+'" font-weight="600" letter-spacing="'+fmt(.16*s)+'">P0'+selected+'</text>';
      }
    }
    return h;
  }
  function frame(z,near) {
    let h='';
    const m=near?alu:rear;
    for(const [a,b] of diagonals) {
      h+=linkPlate(nodes[a],nodes[b],z+2.15,2.65,4.7,2.0,m);
    }
    for(let i=0;i<5;i++) {
      h+=linkPlate(nodes[i],nodes[i+5],z+.38,3.05,5.05,3.05,near?[paint('plate'),'#e9e8dc','#727b6e']:rear);
      if(near)h+=line([i*60+.76,8,z+.35],[i*60+.76,31.5,z+.35],'#d6dace',.18,.8);
    }
    for(const y of [0,40]){
      const isTop=y===40;
      const bottom=y-(isTop?2.46:2.62),top=y+(isTop?2.52:2.72);
      // The dark inset web sits behind the two bright physical flanges; bevels turn the highlights around each end.
      h+=box(-2.55,242.55,bottom,bottom+.59,z-1.00,z+2.99,near?['#58616a','#bac4cc','#5b6670']:rear);
      h+=box(-2.45,242.45,bottom+.60,top-.43,z-.48,z+2.16,near?[paint('dark'),'#859098','#333b42']:[paint('plate'),'#aebac0','#75828b']);
      h+=box(-2.55,242.55,top-.54,top,z-.90,z+2.97,near?['#9ba9af',paint('bright'),'#7c8a90']:rear);
      if(near) {
        h+=line([-2.5,top-.08,z-1.12],[242.45,top-.08,z-1.12],'#fffdf0',.17,.88);
        h+=line([-2.36,bottom+.75,z-.49],[242.35,bottom+.75,z-.49],'#8e9588',.16,.68);
        for(const x of [60,120,180]){
          h+=line([x,top+.018,z-.75],[x,top+.018,z+4.39],'#777c70',.20,.8);
        }
      }
    }
    h=formaPart(near?'front':'rear',h);
    if(near&&selected){
      const [a,b]=chosen;
      h+=formaPart('brace',linkPlate(nodes[a],nodes[b],z-1.02,3.28,5.32,1.82,gold,true));
    }
    let hardware='';
    for(let i=0;i<10;i++)hardware+=railJoint(i,z-1.62,near);
    h+=formaPart(near?'front':'rear',hardware);
    return h;
  }
  function supports() {
    // A low tie plate locates the two machined saddles on each end of the span.
    const endPlinth = (x,y,w,near,far,c) => [
      [x-w+c,y,near],[x+w-c,y,near],[x+w,y,near+c],[x+w,y,far-c],
      [x+w-c,y,far],[x-w+c,y,far],[x-w,y,far-c],[x-w,y,near+c]
    ];
    function skin(lower,upper,front,end,top) {
      let shape='';
      for(let a=0;a<lower.length;a++){
        const b=(a+1)%lower.length,dx=lower[b][0]-lower[a][0],dz=lower[b][2]-lower[a][2];
        if(dx*ca-dz*sa<=0)continue;
        shape+=face([lower[a],lower[b],upper[b],upper[a]],Math.abs(dx)>Math.abs(dz)?front:end);
      }
      return shape+face(se>=0?upper:lower,se>=0?top:end);
    }
    function mountingScrew(x,y,z) {
      const disk=(radius,height,color,count=16,phase=0)=>face(Array.from({length:count},(_,i)=>{
        const a=phase+i*2*Math.PI/count;
        return [x+Math.cos(a)*radius,y+height,z+Math.sin(a)*radius];
      }),color);
      return disk(1.12,0,'#b5b6ac')+disk(.92,.015,'#242722')+
        disk(.75,.03,paint('pin'))+disk(.31,.04,'#343633',6,.18);
    }
    function saddle(x,z,pinned) {
      const front=z-2.85, back=z+3.2, bracket=(y,halfwidth)=>[
        [x-halfwidth,y,front],[x+halfwidth,y,front],[x+halfwidth,y,back],[x-halfwidth,y,back]
      ];
      let shape=box(x-4.75,x+4.75,-7.24,-6.55,front-.63,back+.63,[paint('plate'),'#deded3','#969a93'],true);
      if (pinned) {
        const base=bracket(-6.55,4.05), crown=bracket(-2.75,1.9);
        shape+=face([base[3],base[0],crown[0],crown[3]],'#878c84')+
          face([base[0],base[1],crown[1],crown[0]],paint('silver'))+face(crown,'#f2f0e3');
        const point=P(x,-4.45,front-.02);
        shape+=oval(point,1.12*s,.99*s,'#454945')+
          oval(P(x,-4.39,front-.07),.9*s,.8*s,paint('pin'))+
          oval(P(x,-4.4,front-.09),.34*s,.30*s,'#626761');
      } else {
        for (const d of [2.45,0,-2.45]) {
          const p=P(x+d,-5.24,front);
          shape+=box(x+d-.76,x+d+.76,-6.0,-4.46,front,back,['#727770','#c7c9c0','#767770']);
          shape+=oval(p,1.13*s,1.02*s,'#373a36')+oval(P(x+d,-5.16,front-.05),.86*s,.77*s,paint('pin'));
        }
        shape+=box(x-3.8,x+3.8,-4.03,-2.85,front-.23,back+.15,[paint('plate'),'#d3d4c7','#878c84'],true);
      }
      return shape+box(x-3.1,x+3.1,-2.85,-1.76,front+.3,back-.15,[paint('graphite'),'#a4a69d','#545953']);
    }
    let rendered='';
    for (const x of (sa>=0?[240,0]:[0,240])) {
      const base=endPlinth(x,-12.05,8.8,-5.25,depth+5.25,2.0);
      const bottom=endPlinth(x,-11.64,8.75,-5.25,depth+5.25,1.9);
      const wall=endPlinth(x,-8.15,8.65,-5.15,depth+5.15,1.9);
      const bevel=endPlinth(x,-7.43,8.0,-4.52,depth+4.52,1.65);
      rendered+=face(endPlinth(x+.95,-12.32,9.45,-5.9,depth+6.2,2.3),'#353831','opacity=".32" filter="'+paint('contact')+'"');
      rendered+=skin(base,bottom,'#292d29','#30352f','#585d54');
      rendered+=skin(bottom,wall,paint('graphite'),'#464d46','#747a70');
      rendered+=skin(wall,bevel,'#95998a','#82887c',paint('deck'));
      rendered+=line(bevel[0],bevel[1],'#e1dfd0',.115,.85)+line(bevel[6],bevel[7],'#ccd0c1',.10,.76);
      // Recess beneath the milled top, visible on the long outward face.
      rendered+=line([x-8.69,-10.42,-2.8],[x-8.69,-10.42,depth+2.9],'#222821',.32,.8);
      for (const z of [depth+1.8,-1.8])for(const d of [-5.7,5.7]){
        rendered+=mountingScrew(x+d,-7.4,z);
      }
      for (const z of (ca>=0?[depth,0]:[0,depth]))rendered+=saddle(x,z,x===0);
      if(se<0)rendered+=face(base,'#535b59');
    }
    return formaPart('supports',rendered);
  }

  function floorSystem() {
    const sides = ['#42474a','#a8aaa8','#666c6c'];
    const bright = ['#a4a7a3','#d2d3cb','#8a8f8c'];
    let h = '';
    for (let i=0; i<4; i++) {
      const a=60*i+2, b=a+56, z0=4, z1=depth-4;
      for (const [start,end] of [[[a,-3.9,z0],[b,-3.9,z1]],[[a,-4.30,z1],[b,-4.30,z0]]]) {
        h += line(start,end,'#41484a',.72) + line([start[0],start[1]+.23,start[2]], [end[0],end[1]+.23,end[2]], '#b7b9b6',.19,.91);
      }
    }
    for (let i=4; i>=0; i--) {
      const x=i*60;
      h += box(x-1.65,x+1.65,-4,-3.08,1.6,depth-.8,sides,true);
      h += box(x-.50,x+.50,-3.08,-.24,1.6,depth-.8,sides);
      h += box(x-1.72,x+1.72,-.38,.36,1.3,depth-.5,bright,true);
    }
    for (const z of [depth-4,depth*.64,depth*.36,4.45]) {
      h += box(-.15,240.15,.36,.89,z-1.12,z+1.12,sides,true);
      h += box(-.10,240.10,.89,2.18,z-.46,z+.46,sides);
      h += box(-.15,240.15,2.18,2.69,z-1.13,z+1.13,bright,true);
    }
    // Two indexed tongues and their receiving saddles remain on the frame when a panel is lifted.
    for (let i=0;i<4;i++) {
      const origin=i*60;
      for (const [x,z] of [[origin+6,4.45],[origin+54,depth-4]]) {
        h += box(x-2.15,x+2.15,2.69,3.04,z-1.56,z+1.56,sides);
        h += box(x-.81,x+.81,3.04,4.0,z-.75,z+.75,bright,true);
      }
    }
    return formaPart('floor',h);
  }

  function cassette(i, offset) {
    const start = 60*i, z0=2.2, z1=depth-1.3;
    const bottom = 2.8 + offset*.37;
    const ring = (a,b,l,r,c,y) => [
      [a+c,y,l], [b-c,y,l], [b,y,l+c], [b,y,r-c],
      [b-c,y,r], [a+c,y,r], [a,y,r-c], [a,y,l+c]
    ];
    function blank(a,b,l,r,cut,base,t,top,front,side,bevel) {
      const low=ring(a,b,l,r,cut,base), shoulder=ring(a,b,l,r,cut,base+t-.27),
            high=ring(a+.24,b-.24,l+.24,r-.24,cut-.11,base+t);
      let piece='';
      // Front and near-end facets catch separate sources in the studio.
      for(let idx=0;idx<8;idx++){
        const j=(idx+1)%8,dx=low[j][0]-low[idx][0],dz=low[j][2]-low[idx][2];
        if(dx*ca-dz*sa<=0)continue;
        const col=Math.abs(dx)===Math.abs(dz)?bevel:Math.abs(dx)>Math.abs(dz)?front:side;
        piece+=face([low[idx],low[j],shoulder[j],shoulder[idx]],col);
      }
      if(se>=0)piece+=face(shoulder,bevel)+face(high,top);
      else piece+=face(low,side);
      return piece;
    }
    const a=start+1.15, b=start+58.85;
    // From underneath the carrier and its locating strips conceal the engraving on the tread.
    if(se<0){
      const gap=offset*.63, dy=bottom+2.96+gap;
      const section=(name,markup)=>'<g data-forma-part="'+name+'">'+markup+'</g>';
      let underside=section('deck',blank(a+.72,b-.72,z0+.72,z1-.72,1.62,dy,.98,paint('deck'),'#535b59','#4e5655','#8c9896'));
      underside+=section('spacer',blank(a+1.2,b-1.2,z0+1.2,z1-1.2,1.8,bottom+1.92+gap*.49,1.02,paint('spacer'),'#79383c','#63373b','#976568'));
      let carrier=blank(a,b,z0,z1,2.12,bottom+1.12,.78,paint('silver'),'#aeb3b0','#939b98','#c8d0cb');
      carrier+=blank(a+.28,b-.28,z0+.28,z1-.28,2.1,bottom,1.22,'#5c6460','#575e59','#515854','#737c77');
      for(const z of [z0+3.5,z1-3.5])carrier+=box(a+1.5,b-1.5,bottom-.52,bottom-.03,z-.35,z+.35,['#777e78','#707873','#6b716c']);
      underside+=section('carrier',carrier);
      if(i===bay-1&&opts.onDeck)underside='<g data-deck-toggle="" style="cursor:pointer"><title>Move deck cassette P'+bay+'</title>'+underside+'</g>';
      return underside;
    }
    // The lower carrier retains full thickness along its perimeter and a relieved midsection.
    let h = '<g data-forma-part="carrier">'+blank(a+.28,b-.28,z0+.28,z1-.28,2.1,bottom,1.22,'#434745','#474b49','#343a39','#707571');
    h+=blank(a,b,z0,z1,2.12,bottom+1.12,.78,paint('silver'),'#b1b5ae','#858a85','#ecede1');
    const liftSplit=offset*.63;
    if (liftSplit) {
      // Shoulder sleeves remain with the carrier and give the separated upper sheet registration.
      for (const x of [a+3.55,b-3.55]) for(const z of [z0+3.55,z1-3.55]) {
        h+=box(x-.58,x+.58,bottom+1.9,bottom+1.9+Math.min(liftSplit,2.1),z-.58,z+.58,['#737569','#d9d9c7','#898c7c']);
      }
      // Pockets in the carrier register with the central grip on the upper cover.
      for (let j=0;j<3;j++) {
        const x=a+8+j*14.7, midY=bottom+1.93, left=z0+7,right=z1-7;
        h+=face(ring(x,x+11,left,right,1.65,midY),'#dfe0d4');
        h+=face(ring(x+.18,x+10.8,left+.25,right-.18,1.5,midY+.01),'#555d53');
        h+=face(ring(x+.75,x+10.70,left+1.22,right-.35,1.05,midY+.02),'#898e81');
      }
    }
    // Thin phenolic insert isolates the cover from its aluminum locating carrier.
    h+='</g><g data-forma-part="spacer">';
    const spacerY=bottom+1.92+liftSplit*.49;
    h+=blank(a+1.20,b-1.20,z0+1.2,z1-1.2,1.8,spacerY,1.02,paint('spacer'),'#79383c','#52262d','#b57672');
    if(liftSplit>2) {
      for (const [x,z] of [[a+3.55,z0+3.55],[b-3.55,z0+3.55],[b-3.55,z1-3.55],[a+3.55,z1-3.55]]) {
        const bore=Array.from({length:14},(_,k)=>[x+Math.cos(k*2*Math.PI/14)*.94,spacerY+1.035,z+Math.sin(k*2*Math.PI/14)*.94]);
        h+=face(bore,'#49282d');
      }
      for(const z of [z0+8,z1-8])h+=line([a+8,spacerY+1.03,z],[b-8,spacerY+1.03,z],'#bc7873',.18,.7);
    }
    h+='</g><g data-forma-part="deck">';
    const trim=bottom+2.96+liftSplit;
    h+=blank(a+.72,b-.72,z0+.72,z1-.72,1.62,trim,.98,paint('deck'),'#434747','#343a3b','#92968e');
    const y=trim+1;
    // Pocket lips and short slot bottoms are projected in the tread plane, at two distinct scales.
    const capsule=(x,z,len,r,y0,angle)=>{
      const pts=[];
      for(const end of [1,-1]) for(let k=0;k<7;k++){
        const t=-Math.PI/2+k*Math.PI/6+(end===1?0:Math.PI);
        const xx=end*len/2+Math.cos(t)*r, zz=Math.sin(t)*r;
        pts.push([x+xx*Math.cos(angle)-zz*Math.sin(angle),y0,z+xx*Math.sin(angle)+zz*Math.cos(angle)]);
      }
      return pts;
    };
    for(let j=0;j<7;j++) {
      const x=a+9+6.3*j;
      for(const [z,ang] of [[z0+9.1,1.12],[z1-9.1,-1.12]]) {
        h+=face(capsule(x,z,5.9,.69,y+.03,ang),'#c0c9c7');
        h+=face(capsule(x,z,5.67,.55,y+.04,ang),'#505a5b');
        h+=face(capsule(x+.12,z+.19,5.13,.36,y+.05,ang),'#333d3d');
      }
    }
    const serial=P(a+7.1,y+.065,(z0+z1)*.51);
    const dx=P(a+8.1,y+.065,(z0+z1)*.51), dz=P(a+7.1,y+.065,(z0+z1)*.51+1);
    const matrix=[dx[0]-serial[0],dx[1]-serial[1],serial[0]-dz[0],serial[1]-dz[1],...serial].map(fmt).join(' ');
    h+='<text transform="matrix('+matrix+')" font-family="Arial,sans-serif" font-size="1.48" letter-spacing=".22" font-weight="600" fill="#e5e6db">FORMA   /   D0'+(i+1)+'</text>';
    for(let k=0;k<4;k++){const xx=b-11+k;h+=line([xx,y+.06,(z0+z1)/2],[xx,y+.06,(z0+z1)/2+(k===0?2.3:1.0)],'#c5cdca',.24,.93);}
    // The near truss throws a tight moving shadow onto each tread.
    const clipId=id+'tread'+i;
    const floorTop=ring(a+.94,b-.94,z0+.94,z1-.94,1.65,y+.09).map(p=>P(...p));
    const shadow=(x,yy,z)=>P(x+(yy-y)*.19,y+.09,z+(yy-y)*.27);
    h+='<defs><clipPath id="'+clipId+'"><polygon points="'+pts(floorTop)+'"/></clipPath></defs><g clip-path="url(#'+clipId+')" opacity=".18" pointer-events="none">';
    h+=ln(shadow(0,40,.3),shadow(240,40,.3),'#253035',Math.max(1.1,3*s),.6);
    h+='</g>';
    // Real circular counterbores projected into the tread plane, with a hexagonal recess.
    for (const x of [a+3.55,b-3.55]) {
      for (const z of [z0+3.55,z1-3.55]) {
        const circle=(r,n,cy,phase=0)=>Array.from({length:n},(_,k)=>{
          const q=2*Math.PI*k/n+phase;
          return [x+r*Math.cos(q),cy,z+r*Math.sin(q)];
        });
        h+=face(circle(1.22,18,y+.02),'#a5a595');
        h+=face(circle(.96,16,y+.03),'#363a38');
        h+=face(circle(.75,16,y+.04),paint('pin'));
        h+=face(circle(.36,6,y+.05,.3),'#3f4440');
      }
    }
    h+='</g>';
    if (i === bay-1 && opts.onDeck) {
      return '<g data-deck-toggle="" style="cursor:pointer"><title>'+(offset?'Lower':'Lift')+' deck cassette P'+bay+'</title>'+h+'</g>';
    }
    return h;
  }

  const farFrame=ca>=0?frame(depth,false):frame(0,true);
  const nearFrame=ca>=0?frame(0,true):frame(depth,false);
  const cassettes=sa>=0?[3,2,1,0]:[0,1,2,3];
  // Paint each bay at its depth. The lifted cassette goes last when viewed from above.
  const closedDeck=cassettes.filter(i=>i!==bay-1 || !lift).map(i=>cassette(i,0)).join('');
  const raisedDeck=lift?cassette(bay-1,lift):'';
  const floor=floorSystem();
  const deckAndFloor=se>=0?floor+closedDeck+raisedDeck:raisedDeck+closedDeck+floor;
  let model=farFrame+deckAndFloor+nearFrame;
  let out=defs;

  // Project a soft contact shadow down and away from the area light.
  const ground=(x,y,z)=>P(x+6+y*.19,-13,z+4+y*.20);
  const shadows=[];
  shadows.push(face([[-4,-12,-1],[243,-12,-1],[243,-12,depth+4],[-4,-12,depth+4]],'#53564b','opacity=".18"'));
  for (const z of [1,depth]) {
    shadows.push(ln(ground(-1,40,z),ground(242,40,z),'#44483e',4.7*s,.35));
    for(const [a,b] of diagonals)shadows.push(ln(ground(...nodes[a],z),ground(...nodes[b],z),'#4a5047',2.9*s,.23));
  }
  const feet=supports(), specimen='<g id="'+id+'specimen">'+model+'</g>';
  if(se>=0)out+='<g data-forma-ground="" filter="'+paint('shadow')+'">'+shadows.join('')+'</g>'+feet+specimen;
  else out+=specimen+feet;
  const panelTop = [[60*(bay-1)+.8,2.2],[60*bay-1.1,2.2],[60*bay-1.1,depth-1.3],[60*(bay-1)+.8,depth-1.3]].map(([x,z])=>P(x,5.7+lift,z));
  function handleTop(i){
    const raw=P(60*i,63,-2.06);
    if(lift && raw[0]>=Math.min(...panelTop.map(p=>p[0]))-31 && raw[0]<=Math.max(...panelTop.map(p=>p[0]))+31){
      const deckTop=Math.min(...panelTop.map(p=>p[1]));
      raw[1]=Math.min(raw[1],deckTop-8);
    }
    raw[1]=Math.max(15,raw[1]);
    return raw;
  }
  for (const member of opts.solution.members) {
    if (member.extra && !selected) continue;
    const start = P(...nodes[member.a], -2.65), end = P(...nodes[member.b], -2.65);
    out += '<g data-forma-part="'+(member.extra?'brace':'front')+'" data-member="'+member.id+'">'+ln(start,end,'transparent',Math.max(11, s*4.4),1,'pointer-events="stroke"')+'</g>';
  }
  out+='<g data-forma-overlay="">';
  if(opts.referenceMember){
    const selectedMember=opts.referenceMember;
    const p1=P(...nodes[selectedMember.a],-2.6),p2=P(...nodes[selectedMember.b],-2.6);
    const color=opts.referenceLayer!=='forces'?'#315c85':Math.abs(selectedMember.force)<1e-7?'#65717b':selectedMember.force>0?'#276f77':'#a36138';
    const path='M'+p1.map(fmt).join(' ')+' L'+p2.map(fmt).join(' ');
    out+='<g data-reference-member="'+selectedMember.a+'-'+selectedMember.b+'" pointer-events="none"><path d="'+path+'" fill="none" stroke="#fffdf4" opacity=".94" stroke-width="5" stroke-linecap="round"/><path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2.65" stroke-linecap="round"/>';
    for(const pt of [p1,p2])out+='<circle cx="'+fmt(pt[0])+'" cy="'+fmt(pt[1])+'" r="2.5" fill="#fafbf6" stroke="'+color+'" stroke-width="1.1"/>';
    out+='</g>';
  }
  const node=nodes[load], tip=P(node[0],2,-2.06), peg=handleTop(load);
  const lineTop=Math.min(peg[1]+4,tip[1]-9);
  out+=ln([tip[0],lineTop],[tip[0],tip[1]-4.5],'#476d85',1.0,.72,'stroke-dasharray="3 4"');
  out+='<path d="M'+fmt(tip[0]-3.15)+' '+fmt(tip[1]-6.1)+' L'+fmt(tip[0])+' '+fmt(tip[1]-.7)+' L'+fmt(tip[0]+3.15)+' '+fmt(tip[1]-6.1)+'" stroke="#456e85" stroke-width="1.25" stroke-linejoin="round" fill="none"/>';
  if(lift && !opts.inspectJoint && opts.showLabels!==false && width>=660) {
    const corner=panelTop[2], x=corner[0]+16,y=corner[1]-17;
    // Suppress at the viewport edge or next to the independently draggable force handle.
    if(x+63<width-8 && y>16 && Math.hypot(x+27-peg[0],y-peg[1])>91){
      out+='<g pointer-events="none" aria-hidden="true">'+ln(corner,[x-4,y+2],'#7b898e',.72,.8)+
        '<text x="'+fmt(x)+'" y="'+fmt(y)+'" fill="#56666e" stroke="#f7f8f5" stroke-width="2.6" paint-order="stroke" font-family="Instrument Sans,system-ui,sans-serif" font-size="10">Deck panel</text></g>';
    }
  }
  if(opts.showDimensions!==false && typeof formaSpanDimensionV5==='function'){
    out+=formaSpanDimensionV5(P(0,-12,-4),P(240,-12,-4),Math.max(20,6*s+14),4);
  }
  if(!opts.locked && opts.onPick){
    let style='[data-forma-cue]{opacity:0;pointer-events:none}@media(hover:hover){[data-forma-hit]:hover>[data-forma-cue]{opacity:.7}}';
    for(let i=1;i<=4;i++)style+='svg[data-hover-panel="'+i+'"] [data-forma-hit="'+i+'"]>[data-forma-cue]{opacity:.7}';
    out+='<style>'+style+'</style>';
    candidates.forEach(([a,b],i)=>{
      const A=P(...nodes[a],-1.55),B=P(...nodes[b],-1.55);
      const cue=selected===i+1?'':ln(A,B,'#c08538',Math.max(2,s*1.45),1,'data-forma-cue=""');
      // Give each bay generous click targets while allowing orbit drag from the surrounding canvas.
      out+='<g data-panel="'+(i+1)+'" data-forma-hit="'+(i+1)+'" style="cursor:pointer">'+cue+ln(A,B,'transparent',Math.max(17,s*5.5),1,'pointer-events="stroke"')+'</g>';
    });
  }
  out+='</g>';
  const pin=P(...nodes[jointId],-1.3);
  if(opts.onJoint && selected){
    out+=oval(pin,Math.max(7,s*2.25),Math.max(7,s*2.25),'transparent','data-inspect-pin="" style="cursor:zoom-in"');
  }
  // The detail lens reuses the actual specimen geometry so its fasteners and selected brace stay registered.
  if(opts.inspectJoint && selected){
    const r=Math.max(30,Math.min(56,width*.068,height*.16)), mag=3.0;

    const solid=[];
    for(const x of [-7.7,247.7])for(const y of [-12.6,41.9])for(const z of [-3.6,depth+3.4])solid.push(P(x,y,z));
    solid.push(...panelTop);
    // Find the open area nearest the pin. This reacts to orbit, zoom and the size of the canvas.
    function convexHull(points){
      const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      function chain(arr){const h=[];for(const v of arr){while(h.length>1&&cross(h.at(-2),h.at(-1),v)<=0)h.pop();h.push(v);}return h.slice(0,-1);}
      return chain(sorted).concat(chain(sorted.reverse()));
    }
    const hull=convexHull(solid);
    function toSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
    const dx=width*.047,dy=height*.047;
    const dimY=Math.max(20,6*s+14);
    const dim0=P(0,-12,-4),dim1=P(240,-12,-4);
    const cost=p=>{
      let inside=true,gap=Infinity;
      for(let i=0;i<hull.length;i++){
        const a=hull[i],b=hull[(i+1)%hull.length];
        if((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])<0)inside=false;
        gap=Math.min(gap,toSeg(p,a,b));
      }
      if(inside)gap=-gap;
      let score=Math.max(0,r+11-gap)*19+Math.hypot(p[0]-pin[0],p[1]-pin[1]);
      if(opts.showDimensions!==false){
        score+=Math.max(0,r+10-toSeg(p,[dim0[0],dim0[1]+dimY],[dim1[0],dim1[1]+dimY]))*7;
        const mid=[(dim0[0]+dim1[0])/2,(dim0[1]+dim1[1])/2+dimY];
        score+=Math.max(0,24-toSeg(mid,pin,p))*6;
      }
      score+=Math.max(0,r+25-Math.hypot(p[0]-peg[0],p[1]-peg[1]))*5;
      return score;
    };
    let center=[r+11,r+11], best=Infinity;
    for(let x=r+11;x<=width-r-8;x+=dx)for(let y=r+11;y<=height-r-8;y+=dy){
      const c=cost([x,y]);if(c<best){center=[x,y];best=c;}
    }
    const [cx,cy]=center;
    const clip=id+'magnifier';
    out+='<defs><clipPath id="'+clip+'"><circle cx="'+fmt(cx)+'" cy="'+fmt(cy)+'" r="'+fmt(r)+'"/></clipPath></defs>';
    out+=ln(pin,[cx,cy],'#7e939f',1,.88)+oval(pin,5,5,'none','stroke="#536e7f" stroke-width=".9"');
    out+='<g pointer-events="none"><circle cx="'+fmt(cx)+'" cy="'+fmt(cy)+'" r="'+fmt(r+3)+'" fill="#f7f8f7" stroke="#a0adb2" stroke-width=".85"/>'+
      '<g clip-path="url(#'+clip+')"><rect x="'+fmt(cx-r)+'" y="'+fmt(cy-r)+'" width="'+fmt(r*2)+'" height="'+fmt(r*2)+'" fill="#e6ebec"/>'+
      '<use href="#'+id+'specimen" transform="translate('+fmt(cx-mag*pin[0])+' '+fmt(cy-mag*pin[1])+') scale('+mag+')"/></g></g>';
  }
  if (geometry) opts.onGeometry({project:P,width,height,scale:s,azimuth:angle,elevation,faces:geometry,inspectJoint:!!opts.inspectJoint});
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Four-bay tabletop truss assembly. '+(lift?'Deck cassette lifted in P'+bay+'. ':'Deck seated. ')+(selected?'Amber brace in P'+selected+'. ':'')+'10 N load at B'+load+'.');
  svg.style.width='100%';svg.style.height=height+'px';svg.style.display='block';svg.innerHTML=out;
  svg.formaActivate=e=>{
    const pinHit=e.target.closest?.('[data-inspect-pin]');
    if(pinHit){opts.onJoint?.();return;}
    if(e.target.closest?.('[data-deck-toggle]')){opts.onDeck?.();return;}
    const hit=e.target.closest?.('[data-panel]');
    if(hit&&!opts.locked)opts.onPick?.(+hit.dataset.panel);
  };
  const anchor=(p)=>({x:p[0],y:p[1]});
  const panels=[0,1,2,3].map(i=>anchor(P(30+60*i,-9.6,-3)));
  const grip=i=>{const pt=handleTop(i);return {x:pt[0],y:pt[1]-7};};
  opts.onAnchors?.({width,height,panels,load:grip(load),joints:[1,2,3].map(grip),pin:anchor(pin)});
}
drawFormaModel.id=0;
function calcAssemblyStudioPixels(g) {
  const {width,height,faces,origin,axes}=g;
  const ratio=Math.min(1,1000/width),w=Math.round(width*ratio),h=Math.round(height*ratio);
  function project(x,y,z){return [origin[0]+x*axes[0][0]+y*axes[1][0]+z*axes[2][0],origin[1]+x*axes[0][1]+y*axes[1][1]+z*axes[2][1]];}
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const sun=norm([-.40,1,-.43]),lu=norm(cross([0,1,0],sun)),lv=cross(sun,lu);
  const camera=[-Math.sin(g.azimuth)*Math.cos(g.elevation),Math.sin(g.elevation),-Math.cos(g.azimuth)*Math.cos(g.elevation)];
  const size=740,ls=2.8,lu0=630,lv0=85;
  // Rasterize a fan directly into a projected surface. Depth uses millimetres in
  // both views, keeping the normal-dependent receiver bias independent of zoom.
  function raster(p,q,r,W,H,write){
    const ax=p[0],ay=p[1],dx=q[0]-ax,dy=q[1]-ay,ex=r[0]-ax,ey=r[1]-ay,den=dx*ey-dy*ex;
    if(Math.abs(den)<.019)return;
    const xlo=Math.max(0,Math.ceil(Math.min(ax,q[0],r[0])-.5)),xhi=Math.min(W-1,Math.floor(Math.max(ax,q[0],r[0])-.5));
    const ylo=Math.max(0,Math.ceil(Math.min(ay,q[1],r[1])-.5)),yhi=Math.min(H-1,Math.floor(Math.max(ay,q[1],r[1])-.5));
    const uu=ey/den,vv=-dy/den,uY=-ex/den,vY=dx/den;
    let u0=((xlo+.5-ax)*ey-(ylo+.5-ay)*ex)/den,v0=(dx*(ylo+.5-ay)-dy*(xlo+.5-ax))/den;
    for(let y=ylo;y<=yhi;y++,u0+=uY,v0+=vY){
      for(let x=xlo,j=y*W+x,u=u0,v=v0;x<=xhi;x++,j++,u+=uu,v+=vv){
        if(u<-.00001||v<-.00001||u+v>1.00001)continue;
        write(j,u,v);
      }
    }
  }
  const triangles=[];
  for(const face of faces){
    const v=face.vertices;
    if(v.length<3 || /filter=|opacity=/.test(face.extra||''))continue;
    const p=v.map(p=>{const s=project(...p);return [s[0]*ratio,s[1]*ratio,dot(p,camera),dot(p,lu)*ls+lu0,dot(p,lv)*ls+lv0,dot(p,sun)];});
    let n=norm(cross(sub(v[1],v[0]),sub(v[v.length-1],v[0])));
    if(dot(n,camera)<0)n=n.map(k=>-k);
    const ang=dot(n,sun), side=1-Math.abs(dot(camera,n));
    const sheen=Math.max(0,n[1])*.045+side*.055;
    for(let j=1;j<p.length-1;j++)triangles.push([p[0],p[j],p[j+1],ang,sheen]);
  }
  const shadow=new Float32Array(size*size);shadow.fill(-1000);
  for (const [p,q,r] of triangles) {
    const a=p.slice(3),b=q.slice(3),c=r.slice(3),dz=b[2]-a[2],ez=c[2]-a[2];
    raster(a,b,c,size,size,(i,u,v)=>{const d=a[2]+u*dz+v*ez;if(d>shadow[i])shadow[i]=d;});
  }
  const out=new Uint8ClampedArray(w*h*4),depth=new Float32Array(w*h);depth.fill(-1000);
  for(const [p,q,r,ang,sheen] of triangles) {
    const d=q.map((n,i)=>n-p[i]),e=r.map((n,i)=>n-p[i]);
    const bias=.38+.42*(1-Math.abs(ang));
    raster(p,q,r,w,h,(i,u,v)=>{
      const height=p[2]+u*d[2]+v*e[2];
      if(height<depth[i]-.012)return;
      depth[i]=height;
      const x=Math.floor(p[3]+u*d[3]+v*e[3]),y=Math.floor(p[4]+u*d[4]+v*e[4]),z=p[5]+u*d[5]+v*e[5]+bias;
      let occ=0;
      if(x>4&&x<size-5&&y>4&&y<size-5){
        const j=y*size+x;
        for(let dy=-3;dy<=3;dy+=3)for(let dx=-3;dx<=3;dx+=3)if(shadow[j+dy*size+dx]>z)occ++;
      }
      occ/=9;
      const shade=.34*occ+.050*(1-Math.max(ang,0))-sheen*(1-occ);
      const off=i*4;
      if(shade>0){out[off]=25;out[off+1]=28;out[off+2]=24;out[off+3]=255*shade;}
      else {out[off]=255;out[off+1]=251;out[off+2]=236;out[off+3]=-255*shade;}
    });
  }
  return {width:w,height:h,data:out};
}

/** Render through an isolated SVG sink; React owns the actual DOM and events. */
export function renderV9Assembly(options) {
  const attributes = {};
  const sink = {
    dataset: { formaRenderId: options.instanceId, jointStudyId: options.instanceId,
      ...(options.isolatedPart ? { isolatedPart: options.isolatedPart } : {}) },
    style: {}, innerHTML: '',
    setAttribute(name, value) { attributes[name] = value; },
    getBoundingClientRect() { return { width: options.width, height: options.height }; },
  };
  let lighting = null;
  if (options.detail) drawFormaJointStudy(sink, options);
  else drawFormaModel(sink, { ...options, onGeometry(g) {
    const origin = g.project(0,0,0);
    const axes = [[1,0,0],[0,1,0],[0,0,1]].map(axis => g.project(...axis).map((value,index) => value-origin[index]));
    lighting = { width:g.width, height:g.height, faces:g.faces, azimuth:g.azimuth, elevation:g.elevation, origin, axes };
  } });
  return { svgInner: sink.innerHTML, viewBox: attributes.viewBox, ariaLabel: attributes['aria-label'], lighting };
}

/** Original v9 soft-shadow rasterizer runs off the main interaction thread. */
export function createV9LightingWorker() {
  const source = calcAssemblyStudioPixels.toString() + '\nself.onmessage=e=>{const pixels=calcAssemblyStudioPixels(e.data.geometry);self.postMessage({requestId:e.data.requestId,pixels},[pixels.data.buffer]);};';
  const url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
  try { return new Worker(url); } finally { URL.revokeObjectURL(url); }
}
