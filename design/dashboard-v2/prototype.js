(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const paths = {
    head: '<path d="M7 25l5-8-3-4 7-7 2-5 3 5 6 4-2 8-5-2-3 6v8H6z"/>',
    cap: '<path d="M3 22c0-10 5-17 13-17s13 7 13 17H3zm-1 2h29v4H1zm12-20V1h4v3z"/>',
    carrot: '<path d="M8 31L3 27 20 8l9 8L8 31zm14-23l2-8 4 2-3 7 6-4 2 4-7 3zm-9 9l5 3 2-2-5-3zm-6 7l4 2 2-2-4-2z"/>',
    shoe: '<path fill-rule="evenodd" d="M5 2h7v8H9v7c0 10 14 10 14 0v-7h-3V2h7v5h3v11C30 36 2 36 2 18V7h3V2zm2 14v4h3v-4H7zm15 0v4h3v-4h-3zM12 25v3h4v-3h-4z"/>',
  };
  const icon = (key) => `<svg viewBox="0 0 34 34" aria-hidden="true">${paths[key]}</svg>`;
  const labels = {head:'HORSE HEAD',cap:'JOCKEY CAP',carrot:'CARROT',shoe:'HORSESHOE'};
  const chinese = {head:'馬頭',cap:'騎師帽',carrot:'紅蘿蔔',shoe:'馬蹄鐵'};
  const themes = {
    'royal-club':{name:'皇家俱樂部',en:'ROYAL CLUB',prefix:'a',alt:'胡桃木邊框、翡翠綠內場、黃銅卡槽'},
    'imperial-porcelain':{name:'御瓷雅苑',en:'IMPERIAL PORCELAIN',prefix:'b',alt:'白瓷賽道、墨藍邊框、香檳金卡槽'},
    nocturne:{name:'夜幕賽會',en:'NOCTURNE',prefix:'c',alt:'黑曜石桌面、鉑金邊框、裝飾藝術卡槽'},
  };
  const horses = [
    {name:'白雪公主',en:'SNOW WHITE',color:'#b8afa0',moves:[1,15,8,4]},
    {name:'黑色傳說',en:'BLACK STORY',color:'#28292b',moves:[2,5,11,8]},
    {name:'赤紅地毯',en:'RED CARPET',color:'#b56f80',moves:[3,10,10,1]},
    {name:'湛藍海洋',en:'BLUE OCEAN',color:'#315d80',moves:[4,10,7,1]},
    {name:'金黃猛虎',en:'YELLOW TIGER',color:'#bc9634',moves:[5,1,1,13]},
    {name:'綠貝雷帽',en:'GREEN BERET',color:'#37715a',moves:[6,1,10,1]},
    {name:'橘子汽水',en:'ORANGENA',color:'#bc662e',moves:[7,5,3,1]},
  ];
  // Design-only hidden-bet sample: each player placed 0, 1, 1, 2 on four distinct horses.
  const players = [
    {id:'jasmine', name:'Jasmine', initial:'J', color:'#365971'},
    {id:'you', name:'你', initial:'Z', color:'#84464f'},
    {id:'arthur', name:'Arthur', initial:'A', color:'#916d3a'},
  ];
  const bets = [
    {player:'jasmine', horse:0, value:1}, {player:'jasmine', horse:3, value:2},
    {player:'jasmine', horse:4, value:0}, {player:'jasmine', horse:5, value:1},
    {player:'you', horse:0, value:0}, {player:'you', horse:2, value:1},
    {player:'you', horse:3, value:1}, {player:'you', horse:6, value:2},
    {player:'arthur', horse:0, value:2}, {player:'arthur', horse:1, value:1},
    {player:'arthur', horse:3, value:1}, {player:'arthur', horse:6, value:0},
  ];
  let betsRevealed=false, selectedWell=0;
  const playerFor = id => players.find(player => player.id===id);
  const visibleBetValue = bet => betsRevealed || bet.player==='you' ? bet.value : null;
  const chipHTML = bet => {
    const player=playerFor(bet.player), value=visibleBetValue(bet);
    return `<span class="bet-chip ${value===null?'face-down':'face-up'}" style="--bettor:${player.color}" aria-hidden="true"><b>${value===null?player.initial:value}</b>${value===null?'':`<small>${player.initial}</small>`}</span>`;
  };
  function wellHTML(horse) {
    const placed=bets.filter(bet=>bet.horse===horse);
    const summary=placed.map(bet=>`${playerFor(bet.player).name}：${visibleBetValue(bet)===null?'暗注':visibleBetValue(bet)}`).join('，');
    return `<button class="chip-well bet-well" data-bet-horse="${horse}" data-count="${placed.length}" aria-label="${horses[horse].name}下注區，${placed.length}位玩家。${summary}。查看下注"><span class="well-chips ${placed.length>3?'dense':''}">${placed.map(chipHTML).join('')}</span></button>`;
  }
  function renderBetDetails() {
    const placed=bets.filter(bet=>bet.horse===selectedWell);
    $('#bet-title').textContent=`${String(selectedWell+1).padStart(2,'0')} · ${horses[selectedWell].name}`;
    $('#bet-subtitle').textContent=`${placed.length} 位玩家已下注 · 每人一枚標記`;
    $('#bet-rows').innerHTML=players.map(player=>{
      const bet=placed.find(item=>item.player===player.id);
      const value=bet?visibleBetValue(bet):null;
      const caption=!bet?'未下注':value===null?'數值未公開':`${value} 票${value===0?' · 虛張聲勢':''}`;
      return `<div class="bet-row" style="--bettor:${player.color}"><span class="bettor-avatar">${player.initial}</span><span>${player.name}${player.id==='you'?'<small>你的下注</small>':''}</span><span class="bet-caption">${caption}</span>${bet?chipHTML(bet):'<span class="empty-bet" aria-label="沒有下注">—</span>'}</div>`;
    }).join('');
    $('#bet-mode-note').textContent=betsRevealed?'結算揭注示例：所有玩家的 0、1、2 均已翻開。':'暗注進行中：你可以查看自己的數值，其他玩家只顯示籌碼背面與玩家標記。';
    $('#reveal-bets').textContent=betsRevealed?'返回暗注預覽':'預覽結算揭注';
    $('#reveal-bets').setAttribute('aria-pressed',String(betsRevealed));
    $('#bet-nav').innerHTML=horses.map((horse,i)=>`<button data-bet-nav="${i}" class="${i===selectedWell?'selected':''}" aria-label="查看${horse.name}下注" aria-pressed="${i===selectedWell}" style="--horse:${horse.color}">${i+1}</button>`).join('');
    $$('[data-bet-nav]').forEach(button=>button.onclick=()=>{selectedWell=Number(button.dataset.betNav);renderBetDetails();});
  }
  function inspectBets(horse) {
    selectedWell=horse;renderBetDetails();
    if(!$('#bet-dialog').open)$('#bet-dialog').showModal();
  }
  $$('.scoreboard .player').forEach((element,i)=>{
    element.style.setProperty('--bettor',players[i].color);
    element.dataset.playerId=players[i].id;
  });
  let theme = 'royal-club',used = new Set(),rolled=null,lastResult=null,rollIndex=0,rolling=false,revealing=false,moving=false,paused=false,cycle=1,inspected=3,sheet='board';
  const faceHTML = (h,i) => i===3?`<span class="card-face card-front exact-source" role="img" aria-label="原始湛藍海洋04卡牌，馬頭4，騎師帽10，紅蘿蔔7，馬蹄鐵1"><span class="exact-art"></span>${rolled&&!revealing&&!used.has(i)?`<span class="exact-stat-highlight" style="--stat-index:${Object.keys(labels).indexOf(rolled)}"></span>`:''}</span>`:`<span class="card-face card-front"><span class="card-portrait"><span class="card-number">${String(i+1).padStart(2,'0')}</span></span><span class="card-horse-name">${h.name}</span><span class="card-en">${h.en}</span><span class="stats">${Object.keys(labels).map((key,j)=>`<span class="stat ${rolled===key&&!used.has(i)?'highlight':''}" data-stat="${key}">${icon(key)}<span class="stat-label">${labels[key]}</span><strong>${h.moves[j]}</strong></span>`).join('')}</span></span>`;
  function renderCards(){
    $('#cards-rail').innerHTML=horses.map((h,i)=>`<div class="card-bay ${rolled&&!revealing&&!used.has(i)?'available':''}" style="--horse:${h.color}"><div class="card-shell" style="--horse:${h.color}"><button class="horse-card ${used.has(i)?'flipped':''}" data-horse="${i}" aria-label="${i+1} ${h.name}，${used.has(i)?'已行動':rolled?'前進 '+h.moves[Object.keys(labels).indexOf(rolled)]+' 格':'等待擲骰'}" ${used.has(i)?'disabled':''}>${faceHTML(h,i)}<span class="card-face card-back"><span class="card-back-art"></span></span></button><span class="cradle-label"><b>${String(i+1).padStart(2,'0')}</b>${h.name}</span><button class="card-inspect" data-inspect="${i}" aria-label="放大${h.name}卡牌">⌕</button></div>${wellHTML(i)}${used.has(i)?'<span class="used-label">已行動</span>':''}</div>`).join('');
    $$('.horse-card').forEach(button=>button.addEventListener('click',()=>chooseHorse(Number(button.dataset.horse))));
    $$('[data-inspect]').forEach(button=>button.addEventListener('click',()=>inspect(Number(button.dataset.inspect))));
    $$('[data-bet-horse]').forEach(button=>button.onclick=()=>inspectBets(Number(button.dataset.betHorse)));
    $('#bet-preview-mode').textContent=betsRevealed?'結算揭注預覽':'暗注預覽';
  }
  function syncUI(){
    $('#roll-button').disabled=rolling||revealing||moving||!!rolled||paused;
    $('#die-button').disabled=rolling||revealing||moving||!!rolled||paused;
    document.body.dataset.dicePhase=rolling?'rolling':revealing?'revealing':moving?'moving':rolled?'selection':'ready';
    window.previewHorses.sync({selectable:rolled&&!rolling&&!revealing&&!moving&&!paused?horses.map((_,i)=>i).filter(i=>!used.has(i)):[],used:[...used]});
    $('#die-button').setAttribute('aria-label',rolling?'擲骰中':lastResult?`上次擲出${chinese[lastResult]}`:'擲骰示範');
    $('#cycle-number').textContent=cycle;
    if(rolling){$('#action-title').textContent='好運，正在落定';$('#action-subtitle').textContent='骰子落定後，選擇一匹尚未行動的馬。';$('#result-text').textContent='擲骰中…';}
    else if(revealing){$('#action-title').textContent='擲骰結果 · 全桌展示';$('#action-subtitle').textContent='看清結果後，再選擇賽馬。';$('#result-text').textContent=`擲出${chinese[rolled]}`;}
    else if(moving){$('#action-title').textContent='賽馬向前，卡牌翻面';$('#action-subtitle').textContent='已行動的馬將保留編號與彩色卡槽。';}
    else if(rolled){$('#action-title').textContent=`${chinese[rolled]} · 選擇賽馬`;$('#action-subtitle').textContent='亮起的數值，就是這次可以前進的距離。';$('#result-text').textContent=`擲出${chinese[rolled]} · 點選賽馬或卡牌`;}
    else{$('#action-title').textContent='輪到你，擲骰吧';$('#action-subtitle').textContent='讓下一步，成為致勝的一步。';$('#result-text').textContent=lastResult?`上次擲出：${chinese[lastResult]}`:'點擊骰子，開始你的回合';}
  }
  function localDelay(ms){return new Promise(resolve=>{let elapsed=0,last=performance.now();const tick=now=>{if(!paused)elapsed+=now-last;last=now;if(elapsed>=ms)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});}
  async function revealDie(result,land){
    const overlay=$('#dice-reveal'),stage=overlay.querySelector('.reveal-die-stage');
    overlay.dataset.result=result;
    overlay.querySelector('.reveal-cube').innerHTML=$('#dice').innerHTML;
    $('#reveal-symbol-name').textContent=chinese[result];
    $('#reveal-symbol-en').textContent=labels[result];
    overlay.hidden=false;
    const face={head:[0,0],cap:[0,-90],carrot:[-90,0],shoe:[90,0]}[result];
    const locate=()=>{
      const source=$('#die-button').getBoundingClientRect(),target=stage.getBoundingClientRect();
      const size=parseFloat(getComputedStyle($('#dice')).width);
      overlay.style.setProperty('--reveal-from-x',`${source.x+source.width/2-target.x-target.width/2}px`);
      overlay.style.setProperty('--reveal-from-y',`${source.y+source.height/2-target.y-target.height/2}px`);
      overlay.style.setProperty('--reveal-from-scale',String(size/target.width));
    };
    locate();
    overlay.style.setProperty('--reveal-start-x',`${land[0]}deg`);
    overlay.style.setProperty('--reveal-start-y',`${land[1]}deg`);
    overlay.style.setProperty('--reveal-face-x',`${face[0]}deg`);
    overlay.style.setProperty('--reveal-face-y',`${face[1]}deg`);
    overlay.style.setProperty('--reveal-duration','2700ms');
    $('.table-stage').inert=true;
    $('#die-button').classList.add('reveal-source-hidden');
    // Force the initial geometry before starting the shared reveal timeline.
    void overlay.offsetWidth;
    overlay.classList.add('is-active');
    $('#dice-announcement').textContent=`擲骰結果：${chinese[result]}。展示後選擇賽馬。`;
    window.addEventListener('resize',locate);
    await localDelay(2700);
    window.removeEventListener('resize',locate);
    overlay.classList.remove('is-active');overlay.hidden=true;
    $('#die-button').classList.remove('reveal-source-hidden');
    $('.table-stage').inert=false;
  }
  async function roll(){
    if(rolling||revealing||moving||rolled||paused)return;
    rolling=true;
    $('#dice-announcement').textContent='';
    const nextResult=['cap','carrot','head','shoe','head','head'][rollIndex++%6];
    const land={head:[-18,28],cap:[-18,-62],carrot:[-108,28],shoe:[72,28]}[nextResult];
    $('#dice').style.setProperty('--start-x',$('#dice').style.getPropertyValue('--land-x')||'-18deg');
    $('#dice').style.setProperty('--start-y',$('#dice').style.getPropertyValue('--land-y')||'28deg');
    $('#dice').style.setProperty('--land-x',land[0]+'deg');$('#dice').style.setProperty('--land-y',land[1]+'deg');
    $('#die-button').classList.add('rolling');syncUI();
    await localDelay(matchMedia('(prefers-reduced-motion: reduce)').matches?30:1350);
    rolled=nextResult;lastResult=nextResult;
    $('#die-button').classList.remove('rolling');rolling=false;revealing=true;syncUI();
    await revealDie(nextResult,land);
    revealing=false;renderCards();syncUI();
  }
  async function chooseHorse(i){
    if(used.has(i)||paused||rolling||revealing||moving)return;
    if(!rolled){inspect(i);return;}
    moving=true;syncUI();
    const button=$(`[data-horse="${i}"]`);
    const arrived=await window.previewHorses.move(i,horses[i].moves[Object.keys(labels).indexOf(rolled)],()=>paused);
    if(!arrived){moving=false;syncUI();return;}
    used.add(i);button.classList.add('flipped');button.disabled=true;syncUI();
    await localDelay(720);rolled=null;
    if(used.size===7){$('#action-title').textContent='新的一輪，七駒再出發';$('#action-subtitle').textContent='所有尚未完賽的賽馬卡，一起翻回正面。';await localDelay(650);used.clear();cycle++;$$('.horse-card').forEach(card=>card.classList.remove('flipped'));await localDelay(700);}
    moving=false;renderCards();syncUI();
  }
  function setTheme(id){theme=id;document.body.dataset.theme=id;$('#board-backdrop').src=`${id}-empty-board.png`;$('#board-backdrop').alt=themes[id].alt;$('#theme-name').textContent=themes[id].name;$$('.theme-choice').forEach(b=>{b.classList.toggle('selected',b.dataset.theme===id);b.setAttribute('aria-pressed',String(b.dataset.theme===id));});if($('#reference-dialog').open)showReference(sheet);}
  function toggleMenu(open){$('#game-menu').hidden=!open;$('#menu-scrim').hidden=!open;$('#menu-toggle').setAttribute('aria-expanded',String(open));}
  function setPause(value){paused=value;document.body.classList.toggle('paused',value);$('#pause-overlay').hidden=!value;$('#pause-button').innerHTML=`<span>${value?'▷':'Ⅱ'}</span><span>${value?'繼續遊戲':'暫停遊戲'}<small>全桌${value?'繼續':'暫停'} · 桌主控制</small></span><span>↗</span>`;toggleMenu(false);syncUI();if(value)$('#resume-button').focus();}
  function inspect(i){inspected=i;const h=horses[i];$('#large-card').innerHTML=`<div class="large-card" style="--horse:${h.color}">${faceHTML(h,i)}</div>`;$('#inspect-title').textContent=`${String(i+1).padStart(2,'0')} · ${h.name}`;$('#inspect-state').textContent=used.has(i)?'已行動 · 棋盤卡槽內顯示共同卡背。':'尚未行動 · 可在擲骰後選擇這匹賽馬。';$('#inspect-nav').innerHTML=horses.map((horse,j)=>`<button class="${j===i?'selected':''}" data-inspect-choice="${j}" style="--horse:${horse.color}" aria-label="查看${horse.name}">${j+1}</button>`).join('');$$('[data-inspect-choice]').forEach(b=>b.onclick=()=>inspect(Number(b.dataset.inspectChoice)));if(!$('#inspect-dialog').open)$('#inspect-dialog').showModal();}
  function showReference(kind='board'){sheet=kind;$('#reference-image').src=`../royal-turf-concepts/${themes[theme].prefix}-${sheet}.png`;$('#reference-image').alt=`${themes[theme].name}原始${sheet}設計`;$('#reference-theme').textContent=themes[theme].en;$$('[data-sheet]').forEach(b=>b.classList.toggle('selected',b.dataset.sheet===sheet));if(!$('#reference-dialog').open)$('#reference-dialog').showModal();}
  $$('.die-face').forEach(face=>face.innerHTML=icon(face.dataset.symbol));
  window.addEventListener('preview-horse-select',event=>chooseHorse(event.detail));
  $('#roll-button').onclick=roll;$('#die-button').onclick=roll;
  $('#menu-toggle').onclick=()=>toggleMenu($('#game-menu').hidden);$('#menu-close').onclick=()=>toggleMenu(false);$('#menu-scrim').onclick=()=>toggleMenu(false);
  $$('.theme-choice').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
  $('#pause-button').onclick=()=>setPause(!paused);$('#resume-button').onclick=()=>setPause(false);
  $('#inspect-blue').onclick=()=>inspect(3);
  $('#inspect-bets').onclick=()=>inspectBets(3);
  $('#reveal-bets').onclick=()=>{betsRevealed=!betsRevealed;renderCards();renderBetDetails();};
  $('#reference-button').onclick=()=>{toggleMenu(false);showReference();};
  $('#exact-specimen').onclick=()=>showReference('cards');
  $$('[data-sheet]').forEach(b=>b.onclick=()=>showReference(b.dataset.sheet));
  $$('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
  $('#exit-button').onclick=()=>{toggleMenu(false);$('#exit-dialog').showModal();};$('#cancel-exit').onclick=()=>$('#exit-dialog').close();
  $('#confirm-exit').onclick=()=>{$('#exit-dialog').close();$('#entry-overlay').hidden=false;paused=true;document.body.classList.add('paused');};
  $('#enter-preview').onclick=()=>{$('#entry-overlay').hidden=true;paused=false;document.body.classList.remove('paused');syncUI();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleMenu(false);});
  renderCards();syncUI();setTheme(theme);
})();
