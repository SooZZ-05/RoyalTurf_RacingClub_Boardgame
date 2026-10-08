import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({baseURL:'http://localhost:5173',viewport:{width:953,height:924}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('royal-turf-language','en'));
await page.goto('http://localhost:5173/');
await page.getByLabel('Your name').fill('Published deck QA');
await page.getByRole('button',{name:'Take a seat'}).click();
await page.locator('.connection.live').waitFor();
const code=(await page.locator('.room-code').innerText()).trim();
await page.getByRole('button',{name:/Historical horses/}).click();
await page.getByRole('checkbox',{name:/Hidden bets/}).check();
await page.getByRole('button',{name:/Start three races/}).click();
async function view(){const session=await page.evaluate(code=>JSON.parse(localStorage.getItem('royal-turf-seats-v1'))[code],code);return (await (await page.request.get(`/api/rooms/${code}/state`,{headers:{Authorization:`Bearer ${session.token}`}})).json()).view;}
let v=await view();
if(!v.edition.ready||v.edition.limitedProfiles||v.settings.deck!=='historical'||!v.horses.every(h=>h.cardId.startsWith('published-historical-')))throw Error('Production did not start the published historical deck');
for(const theme of ['royal-club','imperial-porcelain','nocturne']){
 await page.getByRole('button',{name:'Game menu'}).click();
 await page.locator(`[data-theme-option="${theme}"]`).click();
 await page.getByRole('button',{name:'Close / 關閉',exact:true}).click();
 await page.screenshot({path:`qa/published-decks/${theme}-historical.png`,fullPage:true});
}
for(let bet=0;bet<4;bet++){
 await page.waitForFunction(()=>document.querySelector('.play-chips button:not(:disabled)'));
 v=await view();const chip=v.hand.find(c=>c.value===[2,0,1,1][bet]);const action=v.legal.find(c=>c.type==='bet'&&c.chipId===chip.id);
 await page.locator(`[data-chip-id="${chip.id}"]`).click();await page.locator(`[data-horse-card="${action.horseId}"]`).click();
 await page.waitForTimeout(200);
}
v=await view();
if(JSON.stringify(v.bets.filter(b=>b.seatId===v.selfId).map(b=>b.value))!==JSON.stringify([2,0,1,1]))throw Error('Manual bet order was not committed');
await page.getByRole('button',{name:/Roll the die/}).click({timeout:20000});
await page.locator('.live-dice-reveal').waitFor();
await page.screenshot({path:'qa/published-decks/historical-die-reveal.png',fullPage:true});
await page.locator('.live-dice-reveal').waitFor({state:'detached'});
v=await view();const move=v.legal.find(c=>c.type==='move');
if(!move)throw Error('No legal horse after reveal');
await page.locator(`[data-horse-card="${move.horseId}"]`).click();
await page.waitForTimeout(2200);
v=await view();
await page.screenshot({path:'qa/published-decks/historical-after-move.png',fullPage:true});
if(errors.length)throw Error(errors.join(';'));
await fs.writeFile('qa/published-decks/live-report.json',JSON.stringify({code,edition:v.edition,deck:v.settings.deck,horses:v.horses.map(h=>({id:h.id,cardId:h.cardId,name:h.names.en,moves:h.moves,position:h.position})),manualBetOrder:[2,0,1,1],lastMove:v.lastMove,errors},null,2));
await browser.close();console.log('Live production historical deck, three themes, manual bets, dice reveal, and movement passed.');
