// Presentation renderer copied verbatim from Forma-Studio-v9.html. Solver data is supplied by BridgeCanvas.
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

export function renderPlanarV4(svg, state) {
  const {
    load, brace, original, modified, locked, member,
    onLoad, onPick, onMember, showLabels = true
  } = state;
  const solution = modified || original;
  if (!original || !solution) return;
  const w = Math.max(160, Math.round(state.width || svg.clientWidth || 680));
  const h = Math.max(160, Math.round(state.height || 360));
  const deformation = !!locked && state.layer === 'deformation';
  const forces = !!locked && state.layer === 'forces';
  const showOriginal = state.showOriginal !== false, showModified = state.showModified !== false;
  const zoom = Number.isFinite(state.zoom) ? Math.max(.3,Math.min(8,state.zoom)) : 1;
  const margin = Math.max(24, Math.min(63, w*.075));
  // Reserve a label lane on short canvases. X and Y maintain the same scale.
  const dimensionReserve=state.showDimensions!==false ? Math.min(30,h*.12) : 0;
  const scale = Math.min((w-2*margin)/240, (h-dimensionReserve-93)/60)*zoom;
  const x = world => w/2 + (world-120)*scale + (state.panX||0);
  const y = world => (h-dimensionReserve)/2 + (11-world)*scale + 1 + (state.panY||0);
  const point = (n,m=0) => [x(n.x+n.ux*m), y(n.y+n.uy*m)];
  const round = n => Number(n.toFixed(2));
  const coord = p => p.map(round).join(',');
  const line = (a,b,attrs) => '<line x1="'+round(a[0])+'" y1="'+round(a[1])+'" x2="'+round(b[0])+'" y2="'+round(b[1])+'" '+attrs+'/>';
  const circle=(p,r,attrs)=>'<circle cx="'+round(p[0])+'" cy="'+round(p[1])+'" r="'+r+'" '+attrs+'/>';
  const path=(points,attrs)=>'<polyline points="'+points.map(coord).join(' ')+'" '+attrs+'/>';
  const text=(p,content,attrs='')=>'<text x="'+round(p[0])+'" y="'+round(p[1])+'" '+attrs+'>'+content+'</text>';
  const rect=(px,py,sw,sh,attrs='')=>'<rect x="'+round(px)+'" y="'+round(py)+'" width="'+round(sw)+'" height="'+round(sh)+'" '+attrs+'/>';
  const blue='#285e9c', gray='#6c7885', subtle='#99a4ac', zero='#a9b2ba', tension='#1a7088', compression='#a95c3a';
  const chosenPairs = [[5,1],[6,2],[2,8],[3,9]];
  const nameOf = e => e.a+'-'+e.b;
  const forceText=f=>Math.abs(f)<1e-7?'0.00 N · zero force':(f>0?'+':'−')+Math.abs(f).toFixed(2)+' N · '+(f>0?'tension':'compression');
  const plateName=deformation?'deformation':forces?'forces':'model';
  const wide=w>=640;
  const lowestY=deformation?Math.max(...[...original.nodes,...solution.nodes].map(n=>point(n,250)[1])):y(0);
  const traceTop=h-89;
  const showTrace=wide && h>=420 && locked && zoom<=1.45 && lowestY+60<traceTop;
  const typeAttr='font-family="Instrument Sans,Arial,sans-serif"';
  const tubeBase=Math.max(3.5, Math.min(11, scale*2.32));
  const outlineInk='#475864',paper='#f7f8f4';
  function techMember(a,b,body,edge,width,accent=false){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return '';
    const nx=-dy/len, ny=dx/len, sign=ny>0?-1:1;
    const lit=(p)=>[p[0]+nx*width*.26*sign,p[1]+ny*width*.26*sign];
    return line(a,b,'stroke="'+edge+'" stroke-width="'+round(width+1.25)+'" stroke-linecap="round"')+
      line(a,b,'stroke="'+body+'" stroke-width="'+round(width)+'" stroke-linecap="round"')+
      line(lit(a),lit(b),'stroke="'+(accent?'#fff0c7':'#f2f6f7')+'" stroke-opacity=".62" stroke-width="'+round(Math.max(.6,width*.13))+'" stroke-linecap="round"');
  }
  function pinPlate(p,r,loaded=false){
    const metal=loaded?'#c6dcea':'#d4dce0';
    return circle(p,r,'fill="'+metal+'" stroke="'+outlineInk+'" stroke-width="1.15"')+
      circle(p,r*.58,'fill="#f5f6f2" stroke="#7c8b92" stroke-width=".75"')+
      circle(p,r*.25,'fill="#596c77"');
  }
  let content = '';
  svg.setAttribute('data-structural-plate',plateName);
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Planar truss with pin and roller, 10 newtons at B'+load+'. '+(deformation?'Static displacements magnified 250 times.':forces?'Axial forces displayed by member.':'Pick a panel to preview a brace.'));
  svg.style.display='block';svg.style.width='100%';svg.style.height=h+'px';svg.style.touchAction='pan-y';
  content+='<g font-family="Instrument Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12" fill="#4c5e6f" shape-rendering="geometricPrecision">';

  if (state.showGrid !== false) {
    // Every line is a multiple of 20 mm from the lower left undeformed support.
    const gridStep = scale * 20, margin = 9;
    const gridLine = index => 'stroke="#718591" stroke-width="'+(index%3===0?'.9':'.6')+'" stroke-opacity="'+(index%3===0?'.18':'.095')+'"';
    content += '<g aria-hidden="true" data-planar-grid="20" pointer-events="none">';
    for (let i=Math.ceil((margin-x(0))/gridStep);i<=Math.floor((w-margin-x(0))/gridStep);i++) {
      const px=x(i*20);
      content+=line([px,margin],[px,h-margin],gridLine(i));
    }
    for (let i=Math.ceil((y(0)-(h-margin))/gridStep);i<=Math.floor((y(0)-margin)/gridStep);i++) {
      const py=y(i*20);
      content+=line([margin,py],[w-margin,py],gridLine(i));
    }
    content += '</g>';
  }
  // The contour represents member centerlines; enlarged pin circles identify actual joints.
  function supportReactions(){
    if(!locked || !showLabels)return '';
    let result='';
    for(const i of [0,4]){
      const base=point(original.nodes[i]), dir=i===0?1:-1;
      const dx=Math.min(52,Math.max(22,scale*12))*dir;
      const px=base[0]+dx, top=base[1]+11, bottom=top+19;
      const reaction=solution.reactions['B'+i].y;
      result+='<g data-reaction-joint="B'+i+'" data-reaction-n="'+reaction.toFixed(6)+'" aria-label="Vertical reaction B'+i+' '+reaction.toFixed(2)+' N">'+
        line([base[0]+dir*6,base[1]+3],[px,base[1]+3],'stroke="#64978c" stroke-dasharray="2 3" stroke-width=".8"')+
        line([px,bottom],[px,top],'stroke="#407d70" stroke-width="1.45"')+
        path([[px-3,top+5],[px,top],[px+3,top+5]],'fill="none" stroke="#407d70" stroke-width="1.45" stroke-linejoin="round"')+
        (wide?text([px+dir*6,bottom-1],reaction.toFixed(2)+' N','text-anchor="'+(dir>0?'start':'end')+'" fill="#326a60" font-size="11" paint-order="stroke" stroke="'+paper+'" stroke-width="3"'):'')+'</g>';
    }return result;
  }
  // Supports are attached to the undeformed reference coordinates.
  function supports(){
    let s='';
    [0,4].forEach((i)=>{
      const p=point(original.nodes[i]), a=p[0], b=p[1];
      const attrs='stroke="#657482" stroke-width="1.35" stroke-linejoin="round"';
      s+=path([[a,b+2],[a-8,b+14],[a+8,b+14],[a,b+2]],attrs+' fill="#e7eaeb"');
      if(i===4) for(const offset of [-4.4,4.4])s+=circle([a+offset,b+17.1],2.1,'fill="#f7f7f2" stroke="#657482" stroke-width="1.15"');
      const gy=b+(i===4?21:16);
      s+=line([a-11,gy],[a+11,gy],attrs);
      for(let j=-8;j<=10;j+=4)s+=line([a+j,gy+.4],[a+j-3,gy+3.3],'stroke="#9ca6ad" stroke-width=".85"');
      if(showLabels)s+=text([a,gy+16],i===0?'Pin':'Roller','text-anchor="middle" font-size="11" fill="#677482"');
    });
    return s;
  }
  if(state.showDimensions!==false){
    const upperLimit=h-9-y(0);
    const displayed=showModified ? solution : original;
    const sag=deformation ? Math.max(0,-displayed.nodes[load].uy*250*scale) : 0;
    const dimensionOffset=Math.min(upperLimit,Math.max(53, sag+47));
    const extensionGap=showLabels ? 43 : 28;
    content+=formaSpanDimensionV5(point(original.nodes[0]),point(original.nodes[4]),dimensionOffset,Math.min(extensionGap,dimensionOffset-4));
  }
  content+=supports();
  function drawNodes(nodes,m,fill,edge,radius){
    return nodes.map(n=>circle(point(n,m),radius,'fill="'+fill+'" stroke="'+edge+'" stroke-width="1.3"')).join('');
  }
  function drawBars(sol,m,attrs){return sol.members.map(e=>line(point(sol.nodes[e.a],m),point(sol.nodes[e.b],m),attrs(e))).join('');}
  const trussRadius=Math.max(3.8,Math.min(7.1,scale*1.68));
  const kind=e=>(e.a<5)===(e.b<5)?1.00:e.a%5===e.b%5?.79:.67;
  const selectedMember=solution.members.find(e=>nameOf(e)===member);
  if(deformation){
    // The pale frame provides a fixed reference, the two overlaid cases are static loaded solutions.
    for(const e of original.members){
      content+=techMember(point(original.nodes[e.a]),point(original.nodes[e.b]),'#e2e8e7','#c9d3d3',tubeBase*kind(e)*.65);
    }
    if(showModified){
      for(const e of solution.members){
        content+=techMember(point(solution.nodes[e.a],250),point(solution.nodes[e.b],250),
          e.extra?'#4773a0':'#638aaf',e.extra?'#264c74':'#456b92',tubeBase*kind(e)*.70);
      }
    }
    if(showOriginal)content+=drawBars(original,250,()=>'stroke="'+gray+'" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"');
    if(showOriginal)content+=drawNodes(original.nodes,250,'#f7f8f5',gray,2.5);
    if(showModified)for(const n of solution.nodes)content+=pinPlate(point(n,250),trussRadius*.78);
  }else if(forces){
    const maxForce=Math.max(1,...solution.members.map(e=>Math.abs(e.force)));
    for(const e of solution.members){
      const f=e.force, color=Math.abs(f)<1e-7?'#cbd3d5':(f>0?'#5b9ba8':'#c48d70');
      const edge=Math.abs(f)<1e-7?'#a6b4b9':(f>0?tension:compression);
      const width=Math.max(2.6,tubeBase*(.44+.58*Math.abs(f)/maxForce));
      const a=point(solution.nodes[e.a]),b=point(solution.nodes[e.b]);
      if(e===selectedMember)content+=line(a,b,'stroke="#e0b253" stroke-opacity=".52" stroke-width="'+round(width+5.5)+'" stroke-linecap="round"');
      content+=techMember(a,b,color,edge,width);
      if(f < -1e-7)content+=line(a,b,'stroke="#efd4bf" stroke-dasharray="4 5" stroke-width=".9" opacity=".85"');
    }
    for(const n of solution.nodes)content+=pinPlate(point(n),trussRadius);
  }else{
    for(const e of solution.members){
      const a=point(solution.nodes[e.a]),b=point(solution.nodes[e.b]),k=kind(e);
      content+=techMember(a,b,e.extra?'#ce9e51':k===1?'#7a8a93':'#93a2a9',e.extra?'#906b32':outlineInk,tubeBase*k,!!e.extra);
    }
    if(!locked)chosenPairs.forEach(([a,b],i)=>{
      if(brace!==i+1)content+=line(point(original.nodes[a]),point(original.nodes[b]),'stroke="#a5b4bc" stroke-opacity=".7" stroke-width="1" stroke-dasharray="3 5"');
    });
    for(const n of solution.nodes)content+=pinPlate(point(n),trussRadius);
  }
  if(showLabels && wide){
    const labelNodes=deformation?(showModified?solution:original):solution;
    for(const n of labelNodes.nodes.slice(5)){
      const v=point(n,deformation?250:0);
      content+=text([v[0],v[1]-trussRadius-7],n.id,'text-anchor="middle" font-size="10" fill="#5d707b" stroke="'+paper+'" stroke-width="3" paint-order="stroke" pointer-events="none"');
    }
  }
  content+=supportReactions();
  if(!locked)chosenPairs.forEach(([a,b],i)=>{
    const number=i+1,selected=number===brace,center=[x(30+60*i),y(0)+32];
    content+='<g data-planar-panel="'+number+'" style="cursor:pointer"><title>Preview a brace in P'+number+'</title>'+line(point(original.nodes[a]),point(original.nodes[b]),'stroke="transparent" stroke-width="17"');
    if(showLabels || selected){
      content+=rect(center[0]-17,center[1]-17,34,32,'fill="transparent"');
      if(selected)content+=rect(center[0]-14,center[1]-10,28,19,'rx="4" fill="#e5edf6"');
      content+=text([center[0],center[1]+3.2],'P'+number,'text-anchor="middle" font-size="11.5" fill="'+(selected?blue:gray)+'"');
    }
    content+='</g>';
  });
  if(forces || (deformation && showModified)){
    const m=deformation?250:0;
    for(const e of solution.members){
      const key=nameOf(e),na=solution.nodes[e.a],nb=solution.nodes[e.b];
      content+='<g data-planar-member="'+key+'" style="cursor:pointer"><title>'+na.id+'–'+nb.id+' · '+forceText(e.force)+'</title>'+line(point(na,m),point(nb,m),'stroke="transparent" stroke-width="16"')+'</g>';
    }
    const hit=solution.members.find(e=>nameOf(e)===member);
    if(hit){
      const a=point(solution.nodes[hit.a],m), b=point(solution.nodes[hit.b],m);
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      content+=circle(mid,4.3,'fill="#fffef8" stroke="'+blue+'" stroke-width="1.7" pointer-events="none"');
    }
  }
  const displayed=deformation && showModified?solution:original;
  const low=point(displayed.nodes[load],deformation?250:0);
  if(showLabels){
    for(let i=0;i<5;i++){
      if(i===load)continue; // The arrow identifier or displacement callout labels the loaded joint.
      const p=point(displayed.nodes[i],deformation?250:0);
      const endpoint=i===0||i===4;
      const tx=endpoint?p[0]+(i===0?-8:8):p[0]-5;
      const ty=p[1]+(endpoint?-6:14);
      const anchor=i===4?'start':'end';
      content+=text([tx,ty],'B'+i,'text-anchor="'+anchor+'" font-size="11" fill="#657788" stroke="#f7f7f3" stroke-width="2.8" paint-order="stroke" pointer-events="none"');
    }
  }
  const gripX=x(load*60),gripY=Math.max(17, y(40)-32);
  content+='<g data-planar-load="true" style="touch-action:none;cursor:ew-resize"><title>Drag the 10 N load to B1, B2, or B3</title>'+
    line([gripX,gripY+10],[low[0],low[1]-6],'stroke="'+blue+'" stroke-dasharray="3 4" stroke-width="1.35"')+
    path([[low[0]-3.6,low[1]-9],[low[0],low[1]-4.2],[low[0]+3.6,low[1]-9]],'stroke="'+blue+'" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="1.7"')+
    rect(gripX-29,gripY-12,58,23,'rx="5" fill="#ecf2f9" stroke="#9ab3cf" stroke-width=".9"')+
    text([gripX+4,gripY+3.7],'10 N','text-anchor="middle" font-size="11.5" fill="'+blue+'" font-weight="550"')+
    [0,1,2].map(i=>circle([gripX-18,gripY-3.2+i*3.2],.8,'fill="#7292b4"')+circle([gripX-15,gripY-3.2+i*3.2],.8,'fill="#7292b4"')).join('')+
    rect(gripX-33,gripY-18,66,37,'fill="transparent"')+'</g>';
  if(!deformation){
    content+=circle(low,4.1,'fill="#eaf2fb" stroke="'+blue+'" stroke-width="1.6" pointer-events="none"');
    if(showLabels)content+=text([low[0]+6,low[1]+15],'B'+load,'fill="'+blue+'" font-size="11"');
  }else if(showOriginal || showModified){
    const displacement=displayed.nodes[load].uy;
    const label='B'+load+' '+(showModified?'braced':'original')+' · '+Math.abs(displacement).toFixed(4)+' mm '+(displacement<=0?'↓':'↑');
    const labelWidth=144, direction=load>1?-1:1;
    const cy=Math.min(h-15,low[1]+29);
    const lx = direction>0?Math.max(6,Math.min(w-labelWidth-4,low[0]+15)):Math.max(labelWidth+4,Math.min(w-4,low[0]-15));
    content+=path([[low[0],low[1]+3],[low[0],cy-4],[lx,cy-4]],'stroke="'+blue+'" fill="none" stroke-width="1" opacity=".66" pointer-events="none"');
    content+=circle(low,4.1,'fill="#f5f9fd" stroke="'+blue+'" stroke-width="1.6" pointer-events="none"');
    content+=text([lx+direction*3,cy],label,'text-anchor="'+(direction>0?'start':'end')+'" font-size="11.5" fill="#25496f" stroke="#f7f7f3" stroke-width="3" paint-order="stroke" pointer-events="none"');
  }

  if (forces) {
    const active = solution.members.find(e => nameOf(e) === member);
    if (active) {
      const na = solution.nodes[active.a], nb = solution.nodes[active.b];
      const a = point(na), b = point(nb);
      const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
      const f = Math.abs(active.force)<1e-7 ? 0 : active.force;
      const ink = f===0 ? '#53616a' : f>0 ? tension : compression;
      const modeName = f===0 ? 'zero force' : f>0 ? 'tension' : 'compression';
      const value = (f>0 ? '+' : f<0 ? '−' : '')+Math.abs(f).toFixed(2)+' N';
      const caption = na.id+'–'+nb.id+'  '+value;
      const bw = Math.min(w-12, 16+caption.length*6.65), bh = 22;
      const clamp = (v,lo,hi) => Math.min(hi, Math.max(lo,v));
      // Prefer clear space just outside the chords. Keep the moving load handle free.
      const cx = [mid[0]-22, mid[0]+22, gripX-bw/2-39, gripX+bw/2+39];
      const cy = [y(40)-21, y(0)+47];
      let best=null;
      for (const py of cy) for (const px of cx) {
        const left = clamp(px-bw/2, 6, w-bw-6);
        const top = clamp(py-bh/2, 5, h-bh-5);
        const centerX = left+bw/2, centerY=top+bh/2;
        const gripOverlap = left < gripX+37 && left+bw > gripX-37 &&
                            top < gripY+21 && top+bh > gripY-21;
        const bridgeOverlap = top < y(0)+2 && top+bh > y(40)-2;
        const offset = Math.hypot((centerX-mid[0])*.60,centerY-mid[1]);
        const score = offset + (gripOverlap ? 1000:0)+(bridgeOverlap ? 400:0);
        if (!best || score<best.score) best={left,top,centerY,score};
      }
      const entryX=clamp(mid[0], best.left+8, best.left+bw-8);
      const entryY=best.centerY<mid[1] ? best.top+bh : best.top;
      const elbowY=entryY+(entryY<mid[1]?6:-6);
      const readable = na.id+'–'+nb.id+', '+value+', '+modeName;
      content+='<g data-overlay="member-probe" data-probe-member="'+nameOf(active)+'" data-force-state="'+modeName+'" pointer-events="none" aria-label="'+readable+'">'+
        '<title>'+readable+'</title>'+
        path([mid,[entryX,elbowY],[entryX,entryY]],'stroke="'+ink+'" stroke-width="1" opacity=".76" fill="none"')+
        circle(mid,3,'fill="#fffdf7" stroke="'+ink+'" stroke-width="1.5"')+
        rect(best.left,best.top,bw,bh,'rx="3" fill="#fffef9" stroke="'+ink+'" stroke-opacity=".45" stroke-width=".8"')+
        text([best.left+7,best.top+14.7],caption,'font-size="11.5" font-weight="600" fill="'+ink+'" style="white-space:pre;font-variant-numeric:tabular-nums"')+'</g>';
    }
  }
  // A small section title stays fixed to the sheet as the drawing is zoomed or panned.
  const topLeft=w<525?15:25, topY=w<525?19:31;
  const plateTitle=deformation?'Displacement':forces?'Member forces':'Truss elevation';
  const sheetLine=deformation?'Vertical displacement · scale ×250':forces?'Axial force · braced truss':'XY plane · four-bay model';
  content+='<g pointer-events="none" '+typeAttr+'>'+
    text([topLeft,topY],plateTitle,'fill="#293d44" font-weight="600" font-size="'+(wide?17:13)+'" letter-spacing="-.3" paint-order="stroke" stroke="'+paper+'" stroke-width="4"')+
    text([topLeft,topY+17],sheetLine,'font-size="'+(wide?11:10)+'" fill="#62757b" paint-order="stroke" stroke="'+paper+'" stroke-width="3"')+
    (wide?text([w-25,topY],solution.nodes.length+' joints  /  '+solution.members.length+' members','text-anchor="end" font-size="11" fill="#65747b" paint-order="stroke" stroke="'+paper+'" stroke-width="3"'):'')+'</g>';
  if(showTrace){
    const left=24,right=w-24,bottom=h-15,top=bottom-61;
    content+='<g data-analysis-trace="'+plateName+'" pointer-events="none">'+
      rect(left-3,top-14,right-left+6,75,'fill="#f5f7f3" fill-opacity=".97"')+
      line([left,top-13],[right,top-13],'stroke="#cdd7d2" stroke-width=".85"');
    if(deformation){
      const lx=left+160,rx=right-12,base=top+5,least=Math.max(.00001,...[...original.nodes.slice(0,5),...solution.nodes.slice(0,5)].map(v=>Math.abs(v.uy)));
      const chartPt=(n,i)=>[lx+(rx-lx)*i/4,base+31*(-n.uy)/least];
      content+=text([left,top+6],'Deck displacement','font-size="12" font-weight="580" fill="#394e55"')+
        text([left,top+25],'Vertical · millimetres','font-size="10.5" fill="#61757a"')+
        text([lx-10,base+3],'0','text-anchor="end" font-size="10" fill="#607278"')+
        text([lx-10,base+35],'−'+least.toFixed(3),'text-anchor="end" font-size="10" fill="#607278"')+
        line([lx,base],[rx,base],'stroke="#bec9c9" stroke-width=".85"');
      if(showModified)content+=path(solution.nodes.slice(0,5).map(chartPt),'stroke="#346788" stroke-width="2" fill="none"');
      if(showOriginal)content+=path(original.nodes.slice(0,5).map(chartPt),'stroke="#6a7780" stroke-width="1.5" stroke-dasharray="3 4" fill="none"');
      for(let i=0;i<5;i++){
        const n=(showModified?solution:original).nodes[i],p=chartPt(n,i);
        content+=circle(p,i===load?3.6:2.1,'fill="#fafbf7" stroke="'+(i===load?'#285c86':'#6b808c')+'" stroke-width="1.2"')+
          text([p[0],bottom-1],n.id,'text-anchor="middle" font-size="9.5" fill="#60747a"');
      }
    }else{
      const fValues=solution.members.map(e=>e.force),neg=Math.min(0,...fValues),pos=Math.max(0,...fValues);
      const lx=left+180,rx=right-12,axisY=top+21;
      const loc=f=>lx+(rx-lx)*(f-neg)/(pos-neg || 1),zeroX=loc(0);
      content+=text([left,top+6],'Member force range','font-size="12" font-weight="580" fill="#394e55"')+
        text([left,top+25],'Braced model · newtons','font-size="10.5" fill="#61757a"')+
        line([lx,axisY],[zeroX,axisY],'stroke="#b6785a" stroke-width="2.5"')+
        line([zeroX,axisY],[rx,axisY],'stroke="#4b8e9c" stroke-width="2.5"')+
        text([lx,axisY+20],'−'+Math.abs(neg).toFixed(2)+' N','font-size="10.5" fill="#8b5b44"')+
        text([rx,axisY+20],'+'+pos.toFixed(2)+' N','text-anchor="end" font-size="10.5" fill="#356d78"')+
        text([zeroX,axisY+20],'0','text-anchor="middle" font-size="10.5" fill="#64747a"');
      for(const e of solution.members){
        const fx=loc(e.force);content+=line([fx,axisY-4],[fx,axisY+4],'stroke="#516571" stroke-width=".75"');
      }
      if(selectedMember){
        const fx=loc(selectedMember.force);
        content+=path([[fx-4,axisY-11],[fx+4,axisY-11],[fx,axisY-5],[fx-4,axisY-11]],'stroke="#925e19" fill="#c59341" stroke-width=".8"');
      }
    }
    content+='</g>';
  }
  content+='</g>';
  svg.innerHTML=content;
  function target(e,key){return e.target.closest?.('[data-planar-'+key+']');}
  svg.onpointerdown=e=>{
    if(target(e,'load')){e.preventDefault();svg.setPointerCapture?.(e.pointerId);svg.dataset.planarPointer=String(e.pointerId);return;}
    const panel=target(e,'panel'),m=target(e,'member');
    if(panel&&!locked)onPick?.(Number(panel.dataset.planarPanel));else if(m&&(forces || deformation && showModified))onMember?.(m.dataset.planarMember);
  };
  function move(e){
    if(svg.dataset.planarPointer!==String(e.pointerId))return;
    const bounds=svg.getBoundingClientRect(),px=(e.clientX-bounds.left)*w/(bounds.width||w);
    const joint=Math.max(1,Math.min(3,Math.round(((px-w/2-(state.panX||0))/scale+120)/60)));
    if(joint!==load)onLoad?.(joint);
  }
  svg.onpointermove=move;svg.onpointerup=e=>{move(e);delete svg.dataset.planarPointer;};
  svg.onpointercancel=()=>{delete svg.dataset.planarPointer;};
}

