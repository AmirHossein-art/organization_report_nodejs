import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { parseWbsWorkbook } from '../src/utils/wbsDataParser';
test('multisheet parser retains explicit parent, start date, KPI and dictionary acceptance metadata',()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR || 'C:/Users/asus/AppData/Local/hermes/cache/scratch','wbs-parser-'));
 const file=path.join(dir,'source.xlsx');
 try{
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['نام پروژه','آزمایش']]),'شناسنامه پروژه');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['کد WBS','نام فعالیت','کد والد','شاخص'],['P1-WP-1','کار','P1','شاخص الف']]),'ساختار شکست کار');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['کد WBS','معیار پذیرش خروجی','ملاحظات و ریسک‌ها','تاریخ شروع پیشنهادی','پیش‌نیازها'],['P1-WP-1','تأیید مدیر','ریسک','1405/02/01','P0']]),'فرهنگ لغات WBS');
  XLSX.writeFile(wb,file);
  const task=parseWbsWorkbook(file).tasks[0];
  assert.equal(task.parent_code,'P1');assert.equal(task.start_date,'1405/02/01');
  assert.equal(task.kpi,'شاخص الف');assert.equal(task.attributes?.['معیار پذیرش خروجی'],'تأیید مدیر');
  assert.equal(task.note,'ریسک');assert.equal(task.prerequisite,'P0');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('single-sheet parser retains explicit parent, prerequisite, and arbitrary source attributes',()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR || 'C:/Users/asus/AppData/Local/hermes/cache/scratch','wbs-parser-single-'));
 const file=path.join(dir,'single.xlsx');
 try{
  const wb=XLSX.utils.book_new();
  const rows=[
   ['عنوان پروژه: بهسازی و نوسازی معابر شهری'],
   ['کد WBS','شرح فعالیت','کد والد','پیش‌نیاز','معیار پذیرش خروجی','واحد متولی'],
   ['1.1','مطالعات پایه','','','تصویب مستندات','معاونت فنی'],
   ['1.1.1','برداشت میدانی معابر','1.1','1.1','تکمیل فرم‌های برداشت','پیمانکار مطالعات']
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'ساختار شکست جامع');
  XLSX.writeFile(wb,file);
  const parsed=parseWbsWorkbook(file);
  assert.equal(parsed.tasks.length,2);
  const task=parsed.tasks[1];
  assert.equal(task.wbs_code,'1.1.1');
  assert.equal(task.parent_code,'1.1','single-sheet parser must extract explicit parent_code');
  assert.equal(task.prerequisite,'1.1','single-sheet parser must extract prerequisite');
  assert.equal(task.attributes?.['معیار پذیرش خروجی'],'تکمیل فرم‌های برداشت','single-sheet parser must preserve arbitrary source attributes');
  assert.equal(task.attributes?.['واحد متولی'],'پیمانکار مطالعات');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('readWbsGraph rejects files exceeding 20MB via stat check without loading into memory', async () => {
 const {readWbsGraph, WbsSyncError} = await import('../src/services/wbsGraphSync');
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR || 'C:/Users/asus/AppData/Local/hermes/cache/scratch','wbs-size-'));
 const file=path.join(dir,'huge.xlsx');
 try{
  fs.writeFileSync(file, 'fake');
  fs.truncateSync(file, 21 * 1024 * 1024);
  assert.throws(() => readWbsGraph(dir, 'huge.xlsx'), (err: any) => {
   assert.ok(err instanceof WbsSyncError);
   assert.match(err.message, /بیش از حد مجاز/);
   return true;
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
