import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const issues=[],results=[];
const choices=[['cap','騎師帽','JOCKEY CAP',0],['carrot','紅蘿蔔','CARROT',2],['head','馬頭','HORSE HEAD',3],['shoe','馬蹄鐵','HORSESHOE',4]];
async function setup(width,height,theme,reducedMotion='no-preference'){
 const page=await browser.newPage({viewport:{width,height},reducedMotion});
 page.on('pageerror',e=>issues.push(e.message));
 await page.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
 await page.locator('#menu-toggle').click();
 await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
 await page.locator('#menu-close').click();
 await page.evaluate(()=>{window.phaseHistory=[];new MutationObserver(()=>window.phaseHistory.push({phase:document.body.dataset.dicePhase,at:performance.now()})).observe(document.body,{attributes:true,attributeFilter:['data-dice-phase']});});
 return page;
}
async function matrixCase(viewport,width,height,theme){
 const page=await setup(width,height,theme);
 const records=[];
 try{
  for(const [symbol,name,english,horse] of choices){
   const usedBefore=await page.locator('.horse-card.flipped').count();
   await page.locator('#roll-button').click();
   assert.equal(await page.locator('body').getAttribute('data-dice-phase'),'rolling');
   await page.waitForFunction(()=>document.body.dataset.dicePhase==='revealing');
   const started=Date.now();
   assert.ok(await page.locator('#dice-reveal').isVisible());
   assert.equal(await page.locator('#dice-reveal').getAttribute('data-result'),symbol);
   assert.equal(await page.locator('#reveal-symbol-name').textContent(),name);
   assert.equal(await page.locator('#reveal-symbol-en').textContent(),english);
   assert.ok((await page.locator('#dice-announcement').textContent()).includes(name));
   assert.equal(await page.locator('.table-stage').evaluate(e=>e.inert),true);
   assert.ok(await page.locator('#roll-button').isDisabled());
   await page.locator(`[data-horse="${horse}"]`).evaluate(e=>e.click());
   assert.equal(await page.locator('.horse-card.flipped').count(),usedBefore);
   assert.equal(await page.locator('#horse-motion').evaluate(e=>e.classList.contains('visible')),false);
   await page.waitForTimeout(Math.max(0,1050-(Date.now()-started)));
   const geometry=await page.evaluate(()=>{
    const r=e=>{const a=e.getBoundingClientRect();return{x:a.x,y:a.y,right:a.right,bottom:a.bottom,width:a.width,height:a.height};};
    const cube=document.querySelector('.reveal-cube'),matrix=new DOMMatrix(getComputedStyle(cube).transform);
    const faces=[...cube.querySelectorAll('.die-face')].map(face=>{const cm=matrix.multiply(new DOMMatrix(getComputedStyle(face).transform));return{symbol:face.dataset.symbol,normalZ:cm.m33,background:getComputedStyle(face).backgroundImage,position:getComputedStyle(face).backgroundPosition};});
    return{stage:r(document.querySelector('.reveal-die-stage')),copy:r(document.querySelector('.reveal-copy')),copyOpacity:Number(getComputedStyle(document.querySelector('.reveal-copy')).opacity),faces,front:faces.sort((a,b)=>b.normalZ-a.normalZ)[0],overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
   });
   assert.equal(geometry.front.symbol,symbol);
   assert.ok(geometry.front.normalZ>.999,'Result face points straight at the viewer');
   assert.deepEqual(geometry.faces.map(f=>f.symbol).sort(),['cap','carrot','head','head','head','shoe']);
   assert.ok(geometry.copyOpacity>.95);
   assert.equal(geometry.overflow,false);
   for(const box of [geometry.stage,geometry.copy])assert.ok(box.x>=0&&box.y>=0&&box.right<=width&&box.bottom<=height,'Reveal stays within screen');
   await page.screenshot({path:`${out}/${viewport}-${theme}-${symbol}.png`});
   await page.waitForFunction(()=>document.body.dataset.dicePhase==='selection');
   const revealDuration=Date.now()-started;
   assert.ok(revealDuration>=2500,'All viewers get a readable result hold');
   assert.ok(await page.locator('#dice-reveal').isHidden());
   assert.equal(await page.locator('.table-stage').evaluate(e=>e.inert),false);
   assert.ok((await page.locator('#action-title').textContent()).includes(name));
   const phases=await page.evaluate(()=>window.phaseHistory.slice(-3).map(e=>e.phase));
   assert.deepEqual(phases,['rolling','revealing','selection']);
   await page.locator(`[data-horse="${horse}"]`).click();
   await page.waitForFunction(()=>document.body.dataset.dicePhase==='ready');
   assert.equal(await page.locator('.horse-card.flipped').count(),usedBefore+1);
   assert.equal(await page.locator('.bet-well .bet-chip').count(),12);
   assert.ok((await page.locator('#result-text').textContent()).includes(name),'Result persists after move');
   records.push({symbol,name,revealDuration,geometry});
  }
  results.push({viewport,theme,records});
  console.log(JSON.stringify({ok:true,viewport,theme,results:records.length}));
 }finally{await page.close();}
}
try{
 // Independent themes/viewports run in small batches to keep browser timings stable.
 const cases=[];for(const [name,w,h] of [['user',953,924],['mobile',390,844]])for(const theme of ['royal-club','imperial-porcelain','nocturne'])cases.push([name,w,h,theme]);
 for(let i=0;i<cases.length;i+=2){const batch=await Promise.allSettled(cases.slice(i,i+2).map(args=>matrixCase(...args)));for(const result of batch)if(result.status==='rejected')throw result.reason;}
 const pause=await setup(953,924,'royal-club');
 await pause.locator('#roll-button').click();
 await pause.waitForFunction(()=>document.body.dataset.dicePhase==='revealing');
 await pause.waitForTimeout(1000);
 await pause.locator('#menu-toggle').click();
 await pause.locator('#pause-button').click();
 const before=await pause.locator('.reveal-cube').evaluate(e=>getComputedStyle(e).transform);
 await pause.waitForTimeout(3100);
 assert.equal(await pause.locator('body').getAttribute('data-dice-phase'),'revealing');
 assert.equal(await pause.locator('.reveal-cube').evaluate(e=>getComputedStyle(e).transform),before);
 assert.equal(await pause.locator('.table-stage').evaluate(e=>e.inert),true);
 await pause.locator('#resume-button').click();
 await pause.waitForFunction(()=>document.body.dataset.dicePhase==='selection');
 assert.equal(await pause.locator('.table-stage').evaluate(e=>e.inert),false);
 await pause.close();
 const reduced=await setup(390,844,'imperial-porcelain','reduce');
 await reduced.locator('#roll-button').click();
 await reduced.waitForFunction(()=>document.body.dataset.dicePhase==='revealing');
 const reducedStarted=Date.now();
 await reduced.waitForTimeout(1000);
 const reducedState=await reduced.evaluate(()=>({cubeAnimation:getComputedStyle(document.querySelector('.reveal-cube')).animationName,flight:getComputedStyle(document.querySelector('.reveal-flying-die')).transform,copyOpacity:Number(getComputedStyle(document.querySelector('.reveal-copy')).opacity),phase:document.body.dataset.dicePhase}));
 assert.equal(reducedState.cubeAnimation,'none');
 assert.equal(reducedState.flight,'none');
 assert.equal(reducedState.phase,'revealing');
 assert.ok(reducedState.copyOpacity>.95);
 await reduced.screenshot({path:`out/mobile-reduced-motion.png`.replace('out/',out)});
 await reduced.waitForFunction(()=>document.body.dataset.dicePhase==='selection');
 assert.ok(Date.now()-reducedStarted>=2500);
 await reduced.close();
 assert.deepEqual(issues,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({ok:true,results,pauseFreezesReveal:true,reducedMotion:reducedState,issues},null,2));
 console.log(JSON.stringify({ok:true,themes:3,viewports:2,results:24,pauseFreezesReveal:true,reducedMotionReadable:true,report:`${out}/report.json`}));
}finally{await browser.close();}
