import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import StrategicNetworkExplorer from '../../src/views/StrategicNetworkExplorer';
import { buildSemanticGraph } from '../../src/semantic/strategicGraph';
import type { BuildSemanticGraphOptions } from '../../src/semantic/strategicGraph';
import type { Project } from '../../src/types';
import '../../src/index.css';

// Explicit test fixture, not production records or a replacement for live verification.
const data: BuildSemanticGraphOptions = {
  project:{id:1,title:'نوسازی تقاطع آزمایشی — داده ساختگی',code:'TEST-1',description:'نمونه ایزوله برای آزمون روابط، بدون اتصال به دیتابیس یا AI'},
  wbsNodes:[
    {id:10,project_id:1,parent_id:null,code:'P',title:'آماده‌سازی و اجرا',deliverable_text:'تقاطع آماده بهره‌برداری',node_type:'phase'},
    {id:11,project_id:1,parent_id:10,code:'WP-A',title:'نقشه اجرایی',deliverable_text:'نقشه مصوب',responsible:'واحد طراحی',kpiLinks:[{id:1,kpi:{id:60,project_id:1,name:'نقشه‌های مصوب',unit:'عدد',is_active:true}}]},
    {id:12,project_id:1,parent_id:10,code:'WP-B',title:'نصب تجهیزات',deliverable_text:'تجهیزات نصب‌شده',prerequisite:'WP-A'},
    {id:13,project_id:1,parent_id:10,code:'WP-C',title:'آزمایش و تحویل',prerequisite:'پس از دریافت تأییدیه ناظر'},
  ],
  activities:[
    {id:20,project_id:1,report_id:30,line_number:1,activity_text:'بازبینی نقشه اجرایی تقاطع',wbs_node_id:11,status:'needs_review',confidence:.68,ai_reasoning:'موضوع گزارش به خروجی نقشه نزدیک است؛ نیازمند بازبینی.',audit_feedback:'پیشنهاد AI، نه تأیید تحویل'},
    {id:21,project_id:1,report_id:30,line_number:2,activity_text:'جلسه هماهنگی بدون تطبیق ثبت‌شده',status:'unmapped'},
    {id:22,project_id:1,report_id:31,line_number:1,activity_text:'نصب پایه‌های تجهیزات طبق گزارش',wbs_node_id:12,status:'confirmed',confidence:.93},
  ],
  nextActions:[{id:40,project_id:1,report_id:30,action_text:'ارائه نقشه مصوب به واحد اجرا',wbs_node_id:11,is_completed:false,is_cancelled:false,user_name:'واحد طراحی'},{id:41,project_id:1,action_text:'لغو خرید اولیه با ثبت علت',wbs_node_id:12,is_completed:false,is_cancelled:true,cancellation_reason:'تغییر مشخصات مصوب'}],
  kpis:[{id:60,project_id:1,name:'نقشه‌های مصوب',unit:'عدد',target_value:5,baseline_value:0,target_direction:'minimum',is_active:true}],
  reports:[{id:30,project_id:1,period_id:50,period_title:'هفته اول',user_full_name:'گزارش‌دهنده آزمایشی'},{id:31,project_id:1,period_id:51,period_title:'هفته دوم'}],
  periods:[{id:50,title:'هفته اول',is_open:false},{id:51,title:'هفته دوم',is_open:true}],
};
const requests: Array<{url:string;method:string}> = [];
const errors: string[]=[];
window.addEventListener('error', e=>errors.push(e.message));
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
let delayedStatus: Promise<void>|null=null;
let releaseStatus: (()=>void)|null=null;
let delayedPatch: Promise<void>|null=null;
let releasePatch: (()=>void)|null=null;
const testApi = {
  requests, errors,
  delayPatch:()=>{delayedPatch=new Promise<void>(resolve=>{releasePatch=resolve;});},
  releasePatch:()=>{releasePatch?.();delayedPatch=null;},
  delayOldStatus:()=>{ delayedStatus=new Promise<void>(resolve=>{releaseStatus=resolve;}); },
  releaseOldStatus:()=>{releaseStatus?.();delayedStatus=null;},
};
Object.assign(window,{__semanticTest:testApi});

window.fetch = async (input, init) => {
  const url=String(input); const method=init?.method||'GET';requests.push({url,method});
  const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/sync-status')) {
    if(url.includes('/1/')&&delayedStatus){await delayedStatus;return respond({status:'running',processedReports:1,totalReports:99});}
    return respond({status:'idle'});
  }
  if(url.includes('/report-activities/')&&method==='PATCH') {
    if(delayedPatch) await delayedPatch;
    const id=Number(url.split('/').at(-1)); const update=JSON.parse(String(init?.body)); const activity=data.activities.find(a=>a.id===id);
    if(!activity)return respond({error:'فعالیت نمونه یافت نشد'},404);Object.assign(activity,update);return respond(activity);
  }
  if(url.endsWith('/strategic-graph')) {
    const id=Number(url.split('/')[3]);
    const raw=id===1?data:{...data,project:{id:2,title:'پروژه دوم — داده ساختگی',code:'TEST-2'},wbsNodes:[],activities:[],nextActions:[],kpis:[],reports:[],periods:[]};
    const semantic=buildSemanticGraph(raw);
    return respond({ project:raw.project, semantic,
      nodes:{wbsNodes:raw.wbsNodes.map(w=>({...w,active:true,kpis:w.kpiLinks?.map(l=>l.kpi)||[]})),activities:raw.activities.map(a=>({...a,period_title:raw.reports?.find(r=>r.id===a.report_id)?.period_title||'',period_id:raw.reports?.find(r=>r.id===a.report_id)?.period_id||0})),nextActions:raw.nextActions,kpis:raw.kpis},
      edges:semantic.edges,stats:{totalWbs:raw.wbsNodes.length,totalActivities:raw.activities.length,autoConfirmedActivities:raw.activities.filter(a=>a.status==='auto_confirmed').length,needsReviewActivities:raw.activities.filter(a=>a.status==='needs_review').length,unmappedActivities:raw.activities.filter(a=>a.status==='unmapped').length,totalNextActions:raw.nextActions.length,totalKpis:raw.kpis.length},
    });
  }
  throw new Error(`Fixture blocks unrecognized request: ${method} ${url}`);
};
function Fixture() {
  const [mounted,setMounted]=useState(true);
  return <main className="min-h-screen bg-slate-100 p-4 font-sans"><div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">آزمایش ایزوله — تمام داده‌ها ساختگی هستند؛ بدون اتصال به دیتابیس، حساب کاربری یا AI.<button type="button" onClick={()=>setMounted(v=>!v)} className="mr-4 underline">{mounted?'خارج‌شدن از نمای آزمایشی':'بازکردن نمای آزمایشی'}</button></div>{mounted&&<StrategicNetworkExplorer projects={[{id:1,title:data.project.title,code:'TEST-1'},{id:2,title:'پروژه دوم — داده ساختگی',code:'TEST-2'}] as Project[]}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
