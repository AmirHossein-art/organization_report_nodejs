import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Crosshair, Maximize2, Minus, Plus, X, Network, Search, FileText, AlertTriangle, CornerDownLeft } from 'lucide-react';
import type { EpistemicStatus, SemanticGraph, SemanticNode, SemanticNodeKind } from '../semantic/strategicGraph';
import { frameWorkspace, layoutWorkspace, NODE_HEIGHT, NODE_WIDTH, projectWorkspace } from '../semantic/workspace';
import { toPersianDigits } from '../dateUtils';

const kinds: Record<SemanticNodeKind,string> = { project:'پروژه', wbs:'ساختار شکست کار', activity:'فعالیت گزارش‌شده', action:'تعهد و اقدام', kpi:'شاخص مصوب', report:'گزارش منبع', period:'دوره گزارش' };
const epistemics: Record<EpistemicStatus,string> = { reference:'مرجع ثبت‌شده', reported:'اظهار گزارش‌دهنده', ai_proposed:'پیشنهاد AI · نیازمند بازبینی', human_confirmed:'اتصال تأییدشده مدیر', ai_confirmed:'تطبیق خودکار AI · نه تأیید تحویل' };
const statuses: Record<string,string> = { active:'فعال', needs_review:'نیازمند بازبینی', auto_confirmed:'تطبیق خودکار', confirmed:'تأیید مدیر', overridden:'اصلاح مدیر', unmapped:'فاقد تطبیق', pending:'باز', completed:'تکمیل گزارش‌شده', cancelled:'لغوشده', open:'باز', closed:'بسته', submitted:'ثبت‌شده', approved:'تأییدشده', draft:'پیش‌نویس' };
const fields: Record<string,string> = { title:'عنوان', code:'کد', description:'شرح پروژه', project_type:'چرخه گزارش', level:'سطح', node_type:'نوع بسته', deliverable_text:'خروجی مورد انتظار', responsible:'مسئول مرجع', duration:'مدت مرجع', start_date:'تاریخ شروع مرجع', prerequisite:'پیش‌نیاز ثبت‌شده', line_number:'خط گزارش', activity_text:'متن اصلی فعالیت', wbs_node_id:'شناسه WBS', confidence:'اطمینان مدل، نه احتمال تحقق', report_id:'شناسه گزارش', ai_reasoning:'دلیل پیشنهاد AI', audit_feedback:'بازخورد تطبیق', action_text:'متن تعهد', is_completed:'تکمیل گزارش‌شده', is_cancelled:'لغوشده', cancellation_reason:'علت لغو', cancelled_at:'زمان لغو', target_date:'موعد تعهد', user_name:'مسئول تعهد', name:'نام شاخص', unit:'واحد', baseline_value:'مقدار مبنا', target_value:'مقدار هدف', target_direction:'جهت مطلوب شاخص', period_id:'شناسه دوره', period_title:'عنوان دوره', user_full_name:'گزارش‌دهنده', submitted_at:'زمان ثبت', period_start:'شروع دوره', period_end:'پایان دوره', is_open:'دوره باز' };
const sources: Record<string,string> = { Project:'پروژه', WbsNode:'ساختار شکست کار', ReportActivity:'خط فعالیت گزارش', NextAction:'تعهد', ProjectKpi:'شاخص مصوب', KpiWbsLink:'پیوند مصوب شاخص', Report:'گزارش', ReportPeriod:'دوره گزارش' };
const tones: Record<SemanticNodeKind,string> = { project:'#0f172a', wbs:'#047857', activity:'#b45309', action:'#475569', kpi:'#0f766e', report:'#64748b', period:'#64748b' };
function displayValue(key:string, value:unknown) {
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  const translate: Record<string,string> = { monthly:'ماهانه',weekly:'هفتگی',phase:'فاز',work_package:'بسته کاری',deliverable:'تحویل‌دادنی',minimum:'هرچه بیشتر بهتر',maximum:'هرچه کمتر بهتر' };
  if (key === 'confidence') return `${toPersianDigits(Math.round(Number(value)*100))}٪`;
  return toPersianDigits(translate[String(value)] || statuses[String(value)] || String(value));
}

export interface SemanticNetworkCanvasProps {
  graph: SemanticGraph;
  query?: string;
  status?: string;
  selectedActivityId?: number | null;
  onSelectActivity?: (id:number) => void;
  activityEditor?: ReactNode;
}

export default function SemanticNetworkCanvas({ graph, query='', status='all', selectedActivityId, onSelectActivity, activityEditor }: SemanticNetworkCanvasProps) {
  const [selectedId,setSelectedId] = useState<string | null>(null);
  const [edgeId,setEdgeId] = useState<string | null>(null);
  const [focusId,setFocusId] = useState<string | null>(null);
  const [showSources,setShowSources] = useState(false);
  const [showGaps,setShowGaps] = useState(false);
  const [limit,setLimit] = useState(80);
  const [camera,setCamera] = useState({x:0,y:0,scale:1});
  const [size,setSize] = useState({width:900,height:640});
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{x:number;y:number;cx:number;cy:number} | null>(null);
  const markerId = `semantic-${useId().replace(/:/g,'')}`;
  const view = useMemo(() => projectWorkspace(graph,{focusId,query,status,showSources,maxNodes:limit}),[graph,focusId,query,status,showSources,limit]);
  const layout = useMemo(() => layoutWorkspace(view.nodes,view.edges),[view]);
  const positioned = useMemo(() => new Map(layout.nodes.map(n => [n.id,n])),[layout]);
  const allNodes = useMemo(() => new Map(graph.nodes.map(n => [n.id,n])),[graph]);
  const selected = selectedId ? allNodes.get(selectedId) : undefined;
  const edge = edgeId ? graph.edges.find(e => e.id === edgeId) : undefined;
  const relations = graph.edges.filter(e => e.source === selectedId || e.target === selectedId);
  const selectedGaps = graph.coverage.gaps.filter(g => selected && g.entityKind === selected.kind && String(g.entityId) === String(selected.entityId));
  const fit = (all=false) => {
    const anchorId = focusId || selectedId || view.matchedIds[0] || graph.edges.find(e=>e.type==='EXECUTES')?.target || graph.nodes.find(n=>n.kind==='project')?.id;
    setCamera(frameWorkspace(layout,size,anchorId ? positioned.get(anchorId) : undefined,all));
  };
  useEffect(() => {
    const el=host.current; if (!el) return;
    const observer=new ResizeObserver(([entry]) => setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(el); return () => observer.disconnect();
  },[]);
  useEffect(()=>fit(),[layout,size.width,size.height]);
  useEffect(() => { setSelectedId(null);setEdgeId(null);setFocusId(null);setLimit(80); },[graph.projectId]);
  useEffect(() => { if (selectedActivityId && allNodes.has(`act-${selectedActivityId}`)) { setSelectedId(`act-${selectedActivityId}`);setEdgeId(null); } },[selectedActivityId,allNodes]);
  useEffect(() => { setFocusId(null); },[query,status]);
  const selectNode = (node:SemanticNode) => { setSelectedId(node.id);setEdgeId(null);if(node.kind === 'activity') onSelectActivity?.(node.entityId); };
  const reveal = (node:SemanticNode) => { selectNode(node);setFocusId(node.id); if(['report','period'].includes(node.kind)) setShowSources(true); };
  const zoom = (factor:number) => setCamera(c => { const scale=Math.max(.08,Math.min(2.5,c.scale*factor));const ratio=scale/c.scale;return {scale,x:size.width/2-(size.width/2-c.x)*ratio,y:size.height/2-(size.height/2-c.y)*ratio}; });
  const reset = () => {setFocusId(null);setSelectedId(null);setEdgeId(null);setLimit(80);};
  const nodeByGap = (kind:string,id:number|string) => graph.nodes.find(n => n.kind === kind && String(n.entityId)===String(id));

  return <section dir="rtl" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="semantic-workspace" aria-label="کاوشگر شبکه معنایی">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
      <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Network size={18}/>نقشهٔ روابط و شواهد پروژه</h3><p className="mt-1 text-xs leading-6 text-slate-500">روی گره یا رابطه کلیک کنید؛ جهت پیکان، نوع ارتباط را نشان می‌دهد، نه اثبات رابطهٔ علّی.</p></div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex max-w-full items-center gap-2"><span>رفتن به گره</span><select aria-label="رفتن به گره" value={selectedId||''} onChange={e=>{const n=allNodes.get(e.target.value);if(n)reveal(n);}} className="w-48 max-w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"><option value="">انتخاب بسته یا شاهد…</option>{graph.nodes.map(n=><option key={n.id} value={n.id}>{kinds[n.kind]} — {toPersianDigits(n.label)}</option>)}</select></label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><input type="checkbox" checked={showSources} onChange={e=>setShowSources(e.target.checked)}/>گزارش و دورهٔ منبع</label>
        <button type="button" aria-expanded={showGaps} onClick={()=>setShowGaps(v=>!v)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">شکاف‌های داده: {toPersianDigits(graph.coverage.gaps.length)}</button>
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-xs leading-6 text-slate-600" aria-live="polite">
      <span>در نقشه: {toPersianDigits(view.nodes.length)} گره از {toPersianDigits(graph.nodes.length)} گرهٔ دریافتی · {toPersianDigits(view.edges.length)} رابطه{focusId ? ' · تمرکز بر همسایگی و مسیر مرجع' : query || status!=='all' ? ' · نتایج فیلتر با زمینهٔ ارتباطی' : ' · نمای کلی'}</span>
      {focusId && <button type="button" onClick={reset} className="font-bold text-emerald-800">بازگشت به نمای کلی</button>}
      {view.omittedNodes>0 && <button type="button" onClick={()=>setLimit(n=>n+80)} className="font-bold text-amber-900">{toPersianDigits(view.omittedNodes)} گرهٔ منطبق خارج از قاب؛ نمایش بیشتر</button>}
    </div>
    {graph.coverage.isTruncated && <p className="border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">دادهٔ دریافتی بخشی از تاریخچه است؛ این شبکه نمایندهٔ کامل همهٔ سوابق نیست.</p>}
    {showGaps && <div className="max-h-56 overflow-auto border-b border-amber-200 bg-amber-50/50 p-4" aria-label="شکاف‌های داده">
      <p className="mb-3 text-xs font-semibold text-slate-700">فاقد پیوند بودن، اثبات انجام‌نشدن کار یا انحراف از محدوده نیست.</p>
      {graph.coverage.gaps.length===0 ? <p className="text-xs">در دادهٔ دریافتی شکاف ارجاعی ثبت نشده؛ این به معنی کامل بودن شواهد نیست.</p> : graph.coverage.gaps.map((g,i)=>{ const n=nodeByGap(g.entityKind,g.entityId);return <button type="button" key={`${g.kind}-${g.entityId}-${i}`} disabled={!n} onClick={()=>n&&reveal(n)} className="mb-2 block w-full rounded-lg border border-amber-100 bg-white p-3 text-right text-xs leading-6 text-slate-700 disabled:opacity-70">{toPersianDigits(g.description)}{n&&<span className="mr-2 text-emerald-800">مشاهده گره ←</span>}</button>; })}
    </div>}
    <div className="flex min-w-0 flex-col xl:flex-row">
      <div className="relative min-w-0 flex-1">
        <div ref={host} tabIndex={0} aria-label="بوم روابط؛ برای حرکت بکشید و برای بزرگ‌نمایی از دکمه‌ها استفاده کنید" onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Escape')reset();if(e.key==='+'||e.key==='=')zoom(1.2);if(e.key==='-')zoom(1/1.2);const d:Record<string,[number,number]>={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(d[e.key]){e.preventDefault();setCamera(c=>({...c,x:c.x+d[e.key][0],y:c.y+d[e.key][1]}));}}}
          className="h-[560px] w-full touch-none overflow-hidden bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:h-[680px]"
          style={{backgroundImage:'radial-gradient(#cbd5e1 1px, transparent 1px)',backgroundSize:'22px 22px'}}
          onPointerDown={e=>{ if(e.button!==0 || (e.target as Element).closest('[data-node], [data-edge]'))return;drag.current={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y};e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e=>{if(!drag.current)return;setCamera(c=>({...c,x:drag.current!.cx+e.clientX-drag.current!.x,y:drag.current!.cy+e.clientY-drag.current!.y}));}}
          onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
          {view.nodes.length===0 ? <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500"><Search className="ml-2" size={20}/>گرهی مطابق جستجو و فیلتر یافت نشد.</div> : <svg width="100%" height="100%" aria-label="روابط معنایی پروژه" data-testid="semantic-svg">
            <defs>{(['reference','reported','ai_proposed','human_confirmed','ai_confirmed'] as const).map(ep=><marker key={ep} id={`${markerId}-${ep}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={ep==='ai_proposed'?'#b45309':ep==='human_confirmed'?'#047857':'#64748b'}/></marker>)}</defs>
            <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
              {view.edges.map((e,index)=>{
                const a=positioned.get(e.source),b=positioned.get(e.target);if(!a||!b)return null;
                const sameColumn=a.x===b.x;
                const forward=b.x<a.x;
                const x1=sameColumn?a.x+NODE_WIDTH:a.x+(forward?0:NODE_WIDTH), x2=sameColumn?b.x+NODE_WIDTH:b.x+(forward?NODE_WIDTH:0);
                const y1=a.y+NODE_HEIGHT/2,y2=b.y+NODE_HEIGHT/2;
                const bend=sameColumn?Math.max(x1,x2)+65+(index%3)*28:(x1+x2)/2;
                const path=`M${x1},${y1} C${bend},${y1} ${bend},${y2} ${x2},${y2}`;
                const active=e.id===edgeId||e.source===selectedId||e.target===selectedId;
                const color=e.epistemic==='ai_proposed'?'#b45309':e.epistemic==='human_confirmed'?'#047857':'#64748b';
                return <g key={e.id} data-edge={e.id} role="button" tabIndex={0} aria-label={`${allNodes.get(e.source)?.label} ← ${e.label||e.type} ← ${allNodes.get(e.target)?.label}`} onClick={()=>{setEdgeId(e.id);setSelectedId(null);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setEdgeId(e.id);setSelectedId(null);}}} style={{cursor:'pointer',opacity:selectedId&&!active?0.45:1}}>
                  <path d={path} fill="none" stroke="transparent" strokeWidth={22}/><path d={path} fill="none" stroke={color} strokeWidth={active?3:1.6} strokeDasharray={e.epistemic==='ai_proposed'?'7 5':e.epistemic==='ai_confirmed'?'2 4':undefined} markerEnd={`url(#${markerId}-${e.epistemic})`}/>
                  <g transform={`translate(${sameColumn?bend-25:(x1+x2)/2},${(y1+y2)/2-12})`}><rect x={-80} y={-12} width={160} height={25} rx={7} fill="#f8fafc" stroke={active?color:'#e2e8f0'}/><text textAnchor="middle" y={4} fill={color} fontSize={11} style={{fontFamily:'inherit'}}>{toPersianDigits(e.label||e.type)}</text></g>
                </g>;
              })}
              {layout.nodes.map(n=>{const isSelected=n.id===selectedId;const adjacent=!selectedId||isSelected||relations.some(e=>e.source===n.id||e.target===n.id);return <foreignObject key={n.id} x={n.x} y={n.y} width={NODE_WIDTH} height={NODE_HEIGHT} style={{overflow:'visible',opacity:adjacent?1:.65}}>
                <button type="button" data-node={n.id} aria-label={`${kinds[n.kind]}: ${toPersianDigits(n.label)}`} aria-pressed={isSelected} onClick={()=>selectNode(n)} onDoubleClick={()=>reveal(n)} className="flex h-full w-full flex-col justify-between border bg-white p-3 text-right shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600" style={{borderColor:isSelected?tones[n.kind]:'#cbd5e1',borderWidth:isSelected?2:1,borderRightWidth:4,borderRightColor:tones[n.kind],borderRadius:n.kind==='project'?28:n.kind==='kpi'?20:12,boxShadow:view.matchedIds.includes(n.id)?'0 0 0 3px #a7f3d0':undefined}}>
                  <span className="flex items-center justify-between gap-2 text-[11px] font-semibold" style={{color:tones[n.kind]}}><span>{kinds[n.kind]}</span><span>{n.kind==='wbs'?toPersianDigits(n.code||''):statuses[n.status||'']||''}</span></span>
                  <span className="line-clamp-2 text-[13px] font-semibold leading-6 text-slate-900">{toPersianDigits(n.label)}</span>
                  <span className="truncate text-[10px] text-slate-500">{n.kind==='wbs'?toPersianDigits(String(n.details.deliverable_text||'خروجی مرجع ثبت نشده')):n.kind==='activity'?`گزارش ${toPersianDigits(String(n.details.report_id ?? '—'))} · خط ${toPersianDigits(String(n.details.line_number ?? '—'))}`:`${sources[n.provenance.source]||n.provenance.source} · ${toPersianDigits(n.provenance.recordId)}`}</span>
                </button>
              </foreignObject>;})}
            </g>
          </svg>}
        </div>
        <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm">
          <button type="button" title="بزرگ‌نمایی" aria-label="بزرگ‌نمایی" onClick={()=>zoom(1.25)} className="rounded-lg p-2 hover:bg-slate-100"><Plus size={17}/></button>
          <span className="min-w-12 text-center text-xs" data-testid="zoom-level">{toPersianDigits(Math.round(camera.scale*100))}٪</span>
          <button type="button" title="کوچک‌نمایی" aria-label="کوچک‌نمایی" onClick={()=>zoom(.8)} className="rounded-lg p-2 hover:bg-slate-100"><Minus size={17}/></button>
          <button type="button" title="جا دادن شبکه در قاب" aria-label="جا دادن شبکه در قاب" onClick={()=>fit(true)} className="rounded-lg p-2 hover:bg-slate-100"><Maximize2 size={17}/></button>
          <button type="button" onClick={()=>fit()} className="rounded-lg p-2 text-xs hover:bg-slate-100">اندازهٔ خوانا</button>
        </div>
        <div className="pointer-events-none absolute right-4 top-3 rounded-lg bg-white/90 px-3 py-2 text-[11px] text-slate-500">کشیدن: جابه‌جایی · دوبار کلیک: تمرکز · قاب کامل: نمای کلی</div>
      </div>
      <aside className="w-full shrink-0 border-t border-slate-200 bg-white xl:max-h-[680px] xl:w-80 xl:overflow-y-auto xl:border-r xl:border-t-0" aria-label="بازرس شواهد و روابط">
        <div className="flex items-center justify-between border-b border-slate-100 p-4"><h4 className="text-sm font-bold text-slate-800">بازرس شواهد و روابط</h4>{(selected||edge)&&<button type="button" aria-label="بستن جزئیات" onClick={()=>{setSelectedId(null);setEdgeId(null);}} className="rounded-lg p-1 hover:bg-slate-100"><X size={16}/></button>}</div>
        {!selected&&!edge ? <div className="p-5 text-xs leading-7 text-slate-500"><CornerDownLeft size={22} className="mb-3 text-emerald-600"/><p>یک بستهٔ کاری را انتخاب کنید تا شواهد اجرا، شاخص سنجش و تعهدهای متصل آن مشخص شود.</p><p className="mt-3">با انتخاب هر خط، منبع و اعتبار همان رابطه را ببینید. این نقشه گزارشِ شواهد است، نه گواه قطعی تحقق خروجی‌ها.</p></div> : null}
        {selected && <div className="space-y-4 p-4 text-xs">
          <div><span className="text-[11px] font-bold text-emerald-800">{kinds[selected.kind]}</span><h5 className="mt-2 text-sm font-bold leading-7 text-slate-900">{toPersianDigits(selected.label)}</h5><p className="mt-1 text-slate-500">منبع: {sources[selected.provenance.source]||selected.provenance.source} · رکورد {toPersianDigits(selected.provenance.recordId)}</p></div>
          <button type="button" onClick={()=>setFocusId(selected.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 p-2.5 font-semibold text-white"><Crosshair size={16}/>تمرکز بر روابط این گره</button>
          {Object.entries(selected.details).filter(([k,v])=>v!==null&&v!==''&&fields[k]).map(([k,v])=><div key={k} className="border-b border-slate-100 pb-2"><p className="mb-1 text-[11px] text-slate-400">{fields[k]}</p><p className="whitespace-pre-wrap break-words leading-6 text-slate-700">{displayValue(k,v)}</p></div>)}
          {selectedGaps.map((g,i)=><p key={i} className="rounded-lg bg-amber-50 p-3 leading-6 text-amber-900"><AlertTriangle size={14} className="mb-1"/>{toPersianDigits(g.description)}</p>)}
          <h6 className="font-bold text-slate-800">روابط ثبت‌شده ({toPersianDigits(relations.length)})</h6>
          {relations.map(e=>{const other=allNodes.get(e.source===selected.id?e.target:e.source);return <div key={e.id} className="rounded-lg border border-slate-200 p-3 leading-6"><button type="button" onClick={()=>{setEdgeId(e.id);setSelectedId(null);}} className="text-right font-semibold text-slate-700">{e.source===selected.id?'به: ':'از: '}{toPersianDigits(other?.label||'ارجاع ناموجود')}<span className="mt-1 block text-emerald-800">{toPersianDigits(e.label||e.type)}</span></button><span className="block text-[11px] text-slate-500">{epistemics[e.epistemic]}</span>{other&&<button type="button" onClick={()=>reveal(other)} className="mt-1 font-semibold text-emerald-800">دنبال‌کردن گره ←</button>}</div>;})}
          {selected.kind==='activity'&&activityEditor}
        </div>}
        {edge && <div className="space-y-4 p-4 text-xs leading-7"><span className="font-bold text-emerald-800">رابطه: {toPersianDigits(edge.label||edge.type)}</span>{[edge.source,edge.target].map((id,i)=>{const n=allNodes.get(id);return <button key={id} type="button" onClick={()=>n&&reveal(n)} className="block w-full rounded-lg border border-slate-200 p-3 text-right"><span className="block text-[11px] text-slate-400">{i===0?'مبدأ رابطه':'مقصد رابطه'}</span>{toPersianDigits(n?.label||id)}</button>;})}<p className="rounded-lg bg-slate-50 p-3">اعتبار: {epistemics[edge.epistemic]}</p><p>منبع رابطه: {sources[edge.provenance.source]||edge.provenance.source} · رکورد {toPersianDigits(edge.provenance.recordId??'نامشخص')}</p>{typeof edge.confidence==='number'&&<p>اطمینان تطبیق مدل: {toPersianDigits(Math.round(edge.confidence*100))}٪</p>}<p className="border-t border-slate-100 pt-3 text-slate-500">رابطهٔ پیشنهادی یا تکمیل گزارش‌شده، اثبات پذیرش خروجی نیست. پیش‌نیاز مرجع نیز به‌تنهایی اثبات تأخیر علّی نیست.</p></div>}
      </aside>
    </div>
    <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 px-4 py-3 text-[11px] leading-6 text-slate-500"><span>━ رابطهٔ ثبت‌شده / گزارش‌شده</span><span className="text-amber-800">┄ پیشنهاد AI، نیازمند بازبینی</span><span>┈ تطبیق خودکار AI</span><span className="text-emerald-800">━ اتصال تأیید مدیر</span><span><FileText className="ml-1 inline" size={12}/>تحلیل AI تک‌گزارش از همین قرارداد شواهد استفاده می‌کند.</span></footer>
  </section>;
}
