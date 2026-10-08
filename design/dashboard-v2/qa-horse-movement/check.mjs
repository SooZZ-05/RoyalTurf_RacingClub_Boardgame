import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const issues=[],reports=[];
const initial=[0,-1,-2,-3,-4,-5,-6];
const snapshot=page=>page.evaluate(()=>({positions:window.previewHorses.positions,pieces:[...document.querySelectorAll('.horse-piece')].map(e=>({id:Number(e.dataset.piece),position:Number(e.dataset.position),progress:Number(e.dataset.progressPosition),left:e.style.left,top:e.style.top,hop:e.style.getPropertyValue('--piece-hop'),moving:e.classList.contains('moving'),disabled:e.disabled,art:getComputedStyle(e.querySelector('.piece-art')).backgroundImage}))}));
async function setup(width,height,theme,reducedMotion='no-preference'){
 const page=await browser.newPage({viewport:{width,height},reducedMotion});
 page.on('pageerror',e=>issues.push(e.message));
 await page.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.previewHorses&&document.querySelectorAll('.horse-piece').length===7);
 await page.locator('#menu-toggle').click();
 await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
 await page.locator('#menu-close').click();
 await page.locator('#board-backdrop').evaluate(e=>e.decode());
 await page.evaluate(async()=>{const urls=[...new Set([...document.querySelectorAll('.piece-art')].map(e=>getComputedStyle(e).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]).filter(Boolean))];await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=url;})));});
 return page;
}
async function rollToSelection(page){
 const before=await snapshot(page);
 await page.locator('#roll-button').click();
 await page.waitForFunction(()=>document.body.dataset.dicePhase==='revealing');
 assert.deepEqual((await snapshot(page)).positions,before.positions,'Dice roll does not move any horse');
 await page.locator('.horse-piece[data-piece="0"]').evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 await page.waitForFunction(()=>document.body.dataset.dicePhase==='selection');
 const selection=await snapshot(page);
 assert.deepEqual(selection.positions,before.positions,'Reveal alone does not move any horse');
 const geometry=pieces=>pieces.map(({disabled,...piece})=>piece);
 assert.deepEqual(geometry(selection.pieces),geometry(before.pieces),'Reveal alone does not move any sprite');
 return await page.locator('#dice-reveal').getAttribute('data-result');
}
async function matrixCase(viewport,width,height,theme){
 const page=await setup(width,height,theme);
 try{
  const before=await snapshot(page);
  assert.deepEqual(before.positions,initial);
  assert.equal(before.pieces.length,7);
  assert.equal(await rollToSelection(page),'cap');
  await page.screenshot({path:`${out}/${viewport}-${theme}-before.png`});
  await page.evaluate(()=>{window.movementSamples=[];window.trackMove=true;const sample=()=>{if(!window.trackMove)return;const e=document.querySelector('.horse-piece[data-piece="0"]');window.movementSamples.push({p:Number(e.dataset.progressPosition),flipped:document.querySelector('[data-horse="0"]').classList.contains('flipped'),moving:e.classList.contains('moving')});requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  await page.locator('.horse-piece[data-piece="0"]').click();
  await page.waitForFunction(()=>document.querySelector('.horse-piece[data-piece="0"]').classList.contains('moving'));
  await page.waitForTimeout(350);
  const middle=await snapshot(page);
  assert.ok(middle.pieces[0].progress>0&&middle.pieces[0].progress<15);
  assert.equal(await page.locator('[data-horse="0"]').evaluate(e=>e.classList.contains('flipped')),false,'Card remains face up during travel');
  // Even direct duplicate events must not move either the same or another horse.
  await page.evaluate(()=>{document.querySelector('.horse-piece[data-piece="0"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('.horse-piece[data-piece="2"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('[data-horse="2"]').click();});
  await page.screenshot({path:`${out}/${viewport}-${theme}-moving.png`});
  if(viewport==='user'&&theme==='royal-club'){
   await page.locator('#menu-toggle').click();
   await page.locator('#pause-button').click();
   const frozen=await snapshot(page);
   await page.waitForTimeout(1900);
   assert.deepEqual(await snapshot(page),frozen,'Pause freezes the actual piece position and hop');
   assert.equal(frozen.pieces[0].moving,true);
   await page.locator('#resume-button').click();
  }
  await page.waitForFunction(()=>document.body.dataset.dicePhase==='ready');
  await page.evaluate(()=>window.trackMove=false);
  const after=await snapshot(page);
  assert.deepEqual(after.positions,[15,-1,-2,-3,-4,-5,-6]);
  assert.equal(after.pieces[0].progress,15);
  assert.equal(after.pieces[0].moving,false);
  assert.equal(await page.locator('[data-horse="0"]').evaluate(e=>e.classList.contains('flipped')),true);
  for(let id=1;id<7;id++)assert.deepEqual(after.pieces[id],before.pieces[id],`Unselected horse ${id+1} stays still`);
  const samples=await page.evaluate(()=>window.movementSamples);
  let last=0;for(const sample of samples){assert.ok(sample.p>=last-.000001,'Clockwise progress monotonically increases');assert.ok(!sample.flipped||sample.p===15,'Card flips only after arrival');last=sample.p;}
  const at=await page.evaluate(()=>window.previewTrackPoint(15));
  assert.ok(Math.abs(parseFloat(after.pieces[0].left)/100*1536-at.x)<.01);
  assert.ok(Math.abs(parseFloat(after.pieces[0].top)/100*1024-at.y)<.01);
  assert.equal(await page.locator('.bet-well .bet-chip').count(),12);
  assert.equal(await page.locator('#horse-motion.visible').count(),0,'Old abstract movement marker stays absent');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);
  assert.equal(overflow,false);
  await page.screenshot({path:`${out}/${viewport}-${theme}-after.png`});
  if(viewport==='user'&&theme==='royal-club'){
   for(const nextTheme of ['imperial-porcelain','nocturne','royal-club']){
    await page.locator('#menu-toggle').click();await page.locator(`.theme-choice[data-theme="${nextTheme}"]`).click();await page.locator('#menu-close').click();
    assert.deepEqual((await snapshot(page)).positions,after.positions,'Theme change keeps logical positions');
   }
  }
  reports.push({kind:'theme-viewport',viewport,theme,before,middle,after,sampleCount:samples.length,pauseTest:viewport==='user'&&theme==='royal-club'});
  console.log(JSON.stringify({ok:true,viewport,theme,movement:'white0→15'}));
 }finally{await page.close();}
}
try{
 const cases=[];if(!process.argv.includes('--lifecycle'))for(const [viewport,w,h] of [['user',953,924],['mobile',390,844]])for(const theme of ['royal-club','imperial-porcelain','nocturne'])cases.push([viewport,w,h,theme]);
 for(let i=0;i<cases.length;i+=2){const batch=await Promise.allSettled(cases.slice(i,i+2).map(args=>matrixCase(...args)));for(const item of batch)if(item.status==='rejected')throw item.reason;}
 const lifecycle=await setup(953,924,'royal-club','reduce');
 const initiallyUsed=await lifecycle.locator('.horse-card.flipped').count();
 const plan=initiallyUsed===2?[[0,15],[2,10],[3,4],[4,13],[6,7],[1,2],[5,1],[0,8]]:[[0,15],[1,11],[2,3],[4,13],[3,4],[5,6],[6,5],[0,8]];
 const expected=[...initial],steps=[];
 const allSamples=[];
 for(let step=0;step<plan.length;step++){
  const [horse,distance]=plan[step];
  const result=await rollToSelection(lifecycle);
  await lifecycle.evaluate(()=>{window.hopSamples=[];window.hopObserve=true;const sample=()=>{if(!window.hopObserve)return;window.hopSamples.push([...document.querySelectorAll('.horse-piece')].map(e=>e.style.getPropertyValue('--piece-hop')));requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  await lifecycle.locator(`[data-horse="${horse}"]`).click();
  await lifecycle.waitForFunction(()=>document.body.dataset.dicePhase==='ready');
  expected[horse]+=distance;
  const actual=await snapshot(lifecycle);
  assert.deepEqual(actual.positions,expected,'Every card applies its actual movement value cumulatively');
  const hops=await lifecycle.evaluate(()=>{window.hopObserve=false;return window.hopSamples;});
  assert.ok(hops.flat().every(value=>parseFloat(value)===0),'Reduced motion never hops');
  allSamples.push(...hops);
  steps.push({step:step+1,horse,result,distance,positions:actual.positions,cycle:await lifecycle.locator('#cycle-number').textContent()});
 }
 assert.equal(new Set(plan.map(p=>p[0])).size,7);
 assert.equal(await lifecycle.locator('#cycle-number').textContent(),'2');
 await lifecycle.screenshot({path:`${out}/all-seven-cycle-two-accumulated.png`});
 await rollToSelection(lifecycle);
 const collisionHitTargets=[];
 for(const horse of [2,3,5]){
  const target=await lifecycle.locator(`.horse-piece[data-piece="${horse}"]`).evaluate(e=>{
   const r=e.getBoundingClientRect();
   for(const y of [.5,.35,.65,.2,.8,.1,.9])for(const x of [.5,.35,.65,.2,.8,.1,.9]){
    const target=document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)?.closest('.horse-piece');
    if(target===e)return{x:r.width*x,y:r.height*y};
   }
   return null;
  });
  assert.ok(target,`Horse${horse+1} has an exposed individual hit target in collision`);
  await lifecycle.locator(`.horse-piece[data-piece="${horse}"]`).click({trial:true,position:target});
  collisionHitTargets.push({horse,target});
 }
 await lifecycle.screenshot({path:`${out}/collision-selectable.png`});
 reports.push({kind:'all-seven-and-repeat',initiallyUsed,steps,final:expected,reducedMotionSamples:allSamples.length,collisionHitTargets});
 await lifecycle.close();
 assert.deepEqual(issues,[]);
 await writeFile(`${out}/${process.argv.includes('--lifecycle')?'collision-report':'report'}.json`,JSON.stringify({ok:true,reports,issues},null,2));
 console.log(JSON.stringify({ok:true,themes:cases.length?3:1,viewports:cases.length?2:1,allSeven:true,accumulated:true,diceNeverMovesHorse:true,pauseFreeze:cases.length>0,reducedMotionNoHop:true,report:`${out}/${process.argv.includes('--lifecycle')?'collision-report':'report'}.json`}));
}finally{await browser.close();}
