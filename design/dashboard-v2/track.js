(() => {
  // 36 physical spaces; the seven starting offsets are aliases, never extra cells.
  // Curves trace the approved board silhouettes. Start cells preserve the seven
  // horse locations; the remaining circuit is divided into 29 distinct spaces.
  // Geometry follows the artwork, while numbering runs clockwise: up the left
  // curve, left-to-right across the top, then right-to-left along the start row.
  const tracks = {
    'royal-club': {
      outerStarts:[[360,609],[471,615],[579,615],[690,615],[801,615],[910,615],[1021,615],[1135,615]],
      innerStarts:[[360,544],[471,548],[579,548],[690,548],[801,548],[910,548],[1021,548],[1135,548]],
      segments:[
        ['M1135 615 C1292 615 1426 516 1426 368 C1426 225 1275 114 1100 114','M1135 548 C1249 548 1342 469 1342 368 C1342 259 1226 173 1100 173',10],
        ['M1100 114 L445 114','M1100 173 L445 173',9],
        ['M445 114 C290 114 111 225 111 368 C111 510 224 582 360 609','M445 173 C324 173 195 260 195 368 C195 470 263 538 360 544',10],
      ],
    },
    'imperial-porcelain': {
      outerStarts:[[260,620],[386,668],[494,675],[609,675],[722,675],[837,675],[954,675],[1074,675]],
      innerStarts:[[314,540],[405,579],[494,584],[609,584],[722,584],[837,584],[954,584],[1074,582]],
      segments:[
        ['M1074 675 C1258 675 1404 558 1404 407 C1404 254 1268 112 1060 112','M1074 582 C1202 582 1305 494 1305 400 C1305 284 1207 198 1060 198',10],
        ['M1060 112 L480 112','M1060 198 L480 198',9],
        ['M480 112 C284 112 132 242 132 407 C132 507 176 578 260 620','M480 198 C341 198 238 282 238 400 C238 461 269 506 314 540',10],
      ],
    },
    nocturne: {
      outerStarts:[[346,632],[465,637],[585,637],[706,637],[823,637],[939,637],[1057,637],[1175,635]],
      innerStarts:[[346,533],[465,544],[585,544],[706,544],[823,544],[939,544],[1057,544],[1175,539]],
      segments:[
        ['M1175 635 C1342 632 1454 545 1454 380 C1454 225 1310 110 1150 110','M1175 539 C1269 531 1328 468 1328 378 C1328 273 1252 199 1150 199',10],
        ['M1150 110 L405 110','M1150 199 L405 199',9],
        ['M405 110 C223 110 83 220 83 380 C83 514 185 610 346 632','M405 199 C290 199 203 278 203 378 C203 476 264 523 346 533',10],
      ],
    },
  };
  const ns='http://www.w3.org/2000/svg';
  const node=(name,attributes={},text)=>{
    const element=document.createElementNS(ns,name);
    for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));
    if(text!==undefined)element.textContent=text;
    return element;
  };
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const point=(path,fraction)=>{const p=path.getPointAtLength(path.getTotalLength()*fraction);return [p.x,p.y];};
  const board=document.querySelector('#board-scene');
  const svg=node('svg',{viewBox:'0 0 1536 1024',class:'numbered-track',role:'img','data-race-direction':'clockwise','aria-labelledby':'numbered-track-title numbered-track-description'});
  board.append(svg);

  function render(){
    const theme=document.body.dataset.theme;
    const config=tracks[theme]??tracks['royal-club'];
    svg.replaceChildren();
    svg.append(node('title',{id:'numbered-track-title'},'順時針 36 格賽道 · 第 18 格領先點'));
    svg.append(node('desc',{id:'numbered-track-description'},'順時針前進：由左下方 36／0 跨越終點線到第 1 格，沿左側向上，再由左至右經過上方第 18 格領先點，沿右側向下。起步位置 −6 至 0 與第 30 至 36 格共用位置；底排由左至右為 36／0 至 30／−6。'));
    const defs=node('defs');
    const pattern=node('pattern',{id:'finish-check',width:12,height:12,patternUnits:'userSpaceOnUse'});
    pattern.append(node('rect',{width:12,height:12,fill:'#faf4e7'}),node('path',{d:'M0 0h6v6H0zM6 6h6v6H6z',fill:'#26342d'}));
    defs.append(pattern);svg.append(defs);
    const boundaries=[], labels=[], cells=[];
    let number=29;
    for(const [outerPath,innerPath,count] of config.segments){
      const outside=node('path',{d:outerPath}),inside=node('path',{d:innerPath});
      defs.append(outside,inside);
      for(let k=0;k<count;k++){
        const outer=point(outside,k/count),inner=point(inside,k/count);
        const outerNext=point(outside,(k+1)/count),innerNext=point(inside,(k+1)/count);
        const center=mix(point(inside,(k+.5)/count),point(outside,(k+.5)/count),.55);
        boundaries.push({outer,inner});labels.push({number,center,alias:null});
        cells.push({number,outer,inner,outerNext,innerNext});number--;
      }
    }
    for(let k=0;k<7;k++){
      const outer=config.outerStarts[k],inner=config.innerStarts[k];
      const outerNext=config.outerStarts[k+1],innerNext=config.innerStarts[k+1];
      // Labels sit on the outer edge of the lane, below the horse bases.
      const center=mix(mix(inner,innerNext,.5),mix(outer,outerNext,.5),.81);
      boundaries.push({outer,inner});labels.push({number:36-k,center,alias:-k});
      cells.push({number:36-k,outer,inner,outerNext,innerNext});
    }
    const movementPoints=new Map(cells.map(cell=>[cell.number,mix(mix(cell.inner,cell.innerNext,.5),mix(cell.outer,cell.outerNext,.5),.5)]));
    // Preview motion shares the numbered circuit, including the 30/−6 aliases.
    // Fractional distances interpolate forward clockwise between adjacent cells.
    window.previewTrackPoint=(position)=>{
      const distance=Number.isFinite(position)?position:0;
      const whole=Math.floor(distance),fraction=distance-whole;
      const space=value=>((value-1)%36+36)%36+1;
      const center=mix(movementPoints.get(space(whole)),movementPoints.get(space(whole+1)),fraction);
      return {x:center[0],y:center[1]};
    };
    for(const cell of cells){
      const p=[cell.inner,cell.outer,cell.outerNext,cell.innerNext].map(p=>p.join(',')).join(' ');
      const center=movementPoints.get(cell.number);
      svg.append(node('polygon',{points:p,class:cell.number===18?'track-cell track-checkpoint-cell':'track-cell','data-cell':cell.number,'data-checkpoint':cell.number===18?'18':'','data-center-x':center[0],'data-center-y':center[1],fill:'transparent'}));
    }
    for(const [index,boundary] of boundaries.entries()){
      // The finish stripe replaces the ordinary divider between36/0 and1.
      if(index===29)continue;
      const a=mix(boundary.inner,boundary.outer,.02),b=mix(boundary.inner,boundary.outer,.98);
      svg.append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'track-divider'}));
    }
    const finish=config.outerStarts[0],finishInner=config.innerStarts[0];
    // Horse pieces render above the lane, so this divider can span its full width.
    const inside=finishInner;
    const dx=finish[0]-inside[0],dy=finish[1]-inside[1],length=Math.hypot(dx,dy);
    const nx=-dy/length*8,ny=dx/length*8;
    const checkerPoints=[[inside[0]+nx,inside[1]+ny],[finish[0]+nx,finish[1]+ny],[finish[0]-nx,finish[1]-ny],[inside[0]-nx,inside[1]-ny]];
    svg.append(node('polygon',{points:checkerPoints.map(p=>p.join(',')).join(' '),fill:'url(#finish-check)',class:'track-finish','data-between':'36,1','data-boundary-inner':finishInner.join(','),'data-boundary-outer':finish.join(',')}));
    for(const label of labels.sort((a,b)=>a.number-b.number)){
      const g=node('g',{'data-track-label':label.number,'data-start-offset':label.alias===null?'':label.alias});
      const text=node('text',{x:label.center[0],y:label.center[1]+6,class:'track-number','text-anchor':'middle'});
      text.append(node('tspan',{},String(label.number)));
      if(label.alias!==null){
        text.classList.add('track-number-start');
        text.append(node('tspan',{class:'track-start-alias'},` / ${label.alias===0?'0':'−'+Math.abs(label.alias)}`));
      }
      g.append(text);svg.append(g);
    }
    const checkpoint=cells.find(cell=>cell.number===18);
    const checkpointEdge=mix(checkpoint.inner,checkpoint.innerNext,.5);
    const checkpointMark=node('g',{class:'track-checkpoint-marker','data-checkpoint-marker':'18',transform:`translate(${checkpointEdge[0]} ${checkpointEdge[1]})`});
    checkpointMark.append(
      node('path',{d:'M0 3 L5 9 L0 15 L-5 9 Z',class:'checkpoint-diamond'}),
      node('rect',{x:-77,y:20,width:154,height:43,rx:5,class:'checkpoint-plate'}),
      node('text',{x:0,y:39,'text-anchor':'middle',class:'checkpoint-title'},'18 領先點'),
      node('text',{x:0,y:53,'text-anchor':'middle',class:'checkpoint-caption'},'CHECKPOINT 18'),
    );
    svg.append(checkpointMark);
    // Two quiet infield arrows clarify direction without covering lane labels.
    for(const arrowSpace of [5,24]){
      const cell=cells.find(cell=>cell.number===arrowSpace);
      const label=labels.find(label=>label.number===arrowSpace);
      const nextLabel=labels.find(label=>label.number===arrowSpace+1);
      const edge=mix(cell.inner,cell.innerNext,.5);
      const center=mix(edge,[768,365],.06);
      const angle=Math.atan2(nextLabel.center[1]-label.center[1],nextLabel.center[0]-label.center[0])*180/Math.PI;
      svg.append(node('path',{d:'M-15 0 H15 M7 -6 L15 0 L7 6',class:'track-direction-arrow',transform:`translate(${center[0]} ${center[1]}) rotate(${angle})`,'data-clockwise-arrow':arrowSpace}));
    }
    document.querySelector('#board-backdrop').src=`${theme}-empty-board.png`;
    window.dispatchEvent(new CustomEvent('preview-track-ready'));
  }
  new MutationObserver(render).observe(document.body,{attributes:true,attributeFilter:['data-theme']});
  render();
})();
