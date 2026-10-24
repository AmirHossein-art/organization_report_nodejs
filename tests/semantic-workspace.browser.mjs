import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.SEMANTIC_PLAYWRIGHT_PATH || 'playwright');
const out=process.env.SEMANTIC_BROWSER_OUTPUT;
if(!out)throw new Error('Set SEMANTIC_BROWSER_OUTPUT to a scratch directory');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1536,height:1080}});
// The only network allowed is the local Vite fixture and optional font stylesheets.
await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'?route.continue():route.abort();});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:String(e)});console.error('FAIL',name,String(e));}}
const url='http://127.0.0.1:5179/tests/fixtures/semantic-workspace.html';
try{
  await page.goto(url);
  await page.locator('[data-testid="semantic-workspace"]').waitFor();
  await check('integrated canvas replaces old category lists with typed directed edges',async()=>{
    assert.ok(await page.locator('[data-node]').count()>=10);
    assert.ok(await page.locator('[data-edge] path[marker-end]').count()>=8);
    assert.equal(await page.getByText('فعالیت‌های اتمیک دوره‌ای',{exact:true}).count(),0);
    assert.equal(await page.locator('[data-edge] path[stroke-dasharray="7 5"]').count(),1);
  });
  await check('node selection and relationship inspector reveal provenance, confidence and report line',async()=>{
    await page.locator('[data-node="act-20"]').click();
    const inspector=page.getByRole('complementary',{name:'بازرس شواهد و روابط'});
    assert.match(await inspector.innerText(),/خط گزارش/);
    assert.match(await inspector.innerText(),/۶۸٪/);
    assert.match(await inspector.innerText(),/پیشنهاد AI/);
    assert.match(await inspector.innerText(),/اصلاح اتصال این فعالیت/);
  });
  await check('edge selection shows actual epistemic status and endpoint navigation',async()=>{
    await page.locator('[data-edge="act-wbs-20-11"]').click();
    const text=await page.getByRole('complementary',{name:'بازرس شواهد و روابط'}).innerText();
    assert.match(text,/مبدأ رابطه/);assert.match(text,/مقصد رابطه/);assert.match(text,/پیشنهاد AI/);
  });
  await check('source toggle shows report and period nodes; focus preserves WBS path',async()=>{
    await page.getByRole('checkbox',{name:'گزارش و دورهٔ منبع'}).check();
    assert.ok(await page.locator('[data-node="report-30"]').count());
    assert.ok(await page.locator('[data-node="period-50"]').count());
    await page.locator('[data-node="wbs-11"]').dblclick();
    await page.getByRole('button',{name:'بازگشت به نمای کلی'}).waitFor();
    assert.equal(await page.locator('[data-node="act-21"]').count(),0);
    assert.equal(await page.locator('[data-node="wbs-10"]').count(),1);
    await page.getByRole('button',{name:'بازگشت به نمای کلی'}).click();
  });
  await check('zoom controls change viewport without changing semantic records',async()=>{
    const count=await page.locator('[data-node]').count();
    const before=await page.locator('[data-testid="zoom-level"]').innerText();
    await page.getByRole('button',{name:'بزرگ‌نمایی',exact:true}).click();
    assert.notEqual(await page.locator('[data-testid="zoom-level"]').innerText(),before);
    assert.equal(await page.locator('[data-node]').count(),count);
    await page.getByRole('button',{name:'جا دادن شبکه در قاب',exact:true}).click();
  });
  await check('Persian-normalized search and empty state',async()=>{
    const search=page.getByPlaceholder('جستجو در بسته‌ها، فعالیت‌ها، شاخص‌ها و شواهد...');
    await search.fill('نقشه اجرايي');
    await page.locator('[data-node="wbs-11"]').waitFor();
    await search.fill('چیزی که در داده نیست');
    await page.getByText('گرهی مطابق جستجو و فیلتر یافت نشد.',{exact:true}).waitFor();
    await search.fill('');
  });
  await check('gap tray exposes unlinked activity and never calls it proven scope creep',async()=>{
    await page.getByRole('button',{name:/شکاف‌های داده:/}).click();
    const tray=page.getByLabel('شکاف‌های داده',{exact:true});
    assert.match(await tray.innerText(),/اثبات/);
    await tray.getByRole('button').filter({hasText:'هیچ بسته کاری'}).click();
    assert.equal(await page.locator('[data-node="act-21"]').count(),1);
    await page.getByRole('button',{name:'بازگشت به نمای کلی'}).click();
  });
  await check('activity correction uses exact existing mutation and readback refresh',async()=>{
    await page.locator('[data-node="act-20"]').click();
    await page.locator('#semantic-wbs-link').selectOption('12');
    await page.getByRole('button',{name:'ثبت اصلاح و تأیید اتصال',exact:true}).click();
    await page.locator('[data-edge="act-wbs-20-12"]').waitFor();
    assert.equal(await page.locator('[data-edge="act-wbs-20-11"]').count(),0);
    assert.ok((await page.evaluate(()=>window.__semanticTest.requests)).some(r=>r.method==='PATCH'&&r.url==='/api/report-activities/20'));
  });
  await page.screenshot({path:`${out}/semantic-desktop.png`,fullPage:true});
  await check('narrow viewport has no page horizontal overflow and inspector remains available',async()=>{
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('[data-testid="semantic-workspace"]').isVisible());
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false);
    await page.screenshot({path:`${out}/semantic-mobile.png`,fullPage:true});
    await page.setViewportSize({width:1536,height:1080});
  });
  await check('late old-project sync status cannot start stale polling after switch',async()=>{
    await page.reload();await page.locator('[data-testid="semantic-workspace"]').waitFor();
    await page.evaluate(()=>window.__semanticTest.delayOldStatus());
    const project=page.locator('select').first();
    await project.selectOption('2');
    await page.locator('[data-node="project-2"]').waitFor();
    await project.selectOption('1');
    await page.locator('[data-node="project-1"]').waitFor();
    await project.selectOption('2');
    await page.locator('[data-node="project-2"]').waitFor();
    await page.evaluate(()=>window.__semanticTest.releaseOldStatus());
    await page.waitForTimeout(150);
    assert.equal(await page.getByRole('button',{name:/در حال پردازش گزارش/}).count(),0);
    await page.waitForTimeout(3200);
    const requests=await page.evaluate(()=>window.__semanticTest.requests);
    const statuses=requests.filter(r=>r.url==='/api/projects/1/sync-status');
    assert.equal(statuses.length,2,'only initial and revisit status allowed; no stale polling');
  });
  await check('late mutation cannot hide or overwrite a newly selected project',async()=>{
    await page.reload();await page.locator('[data-testid="semantic-workspace"]').waitFor();
    await page.getByLabel('رفتن به گره',{exact:true}).selectOption('act-20');
    await page.evaluate(()=>window.__semanticTest.delayPatch());
    await page.locator('#semantic-wbs-link').selectOption('12');
    await page.getByRole('button',{name:'ثبت اصلاح و تأیید اتصال',exact:true}).click();
    await page.locator('select').first().selectOption('2');
    await page.locator('[data-node="project-2"]').waitFor();
    await page.evaluate(()=>window.__semanticTest.releasePatch());
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-node="project-2"]').count(),1);
    assert.equal(await page.getByText('پیوند فعالیت با موفقیت اصلاح شد.',{exact:true}).count(),0);
  });
  await check('no browser runtime errors',async()=>assert.deepEqual(errors,[]));
} finally {
  await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));
  await context.close();await browser.close();
}
if(results.some(r=>!r.passed))process.exitCode=1;
console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,out}));
