import type { WbsTask } from './wbsDataParser';
export interface WbsGraphNode {
  code: string; parent_code: string | null; title: string; level: number;
  node_type: string; deliverable_text: string | null; responsible: string | null;
  duration: string | null; start_date: string | null; prerequisite: string | null;
  notes: string | null; sort_order: number; attributes: Record<string, string | boolean>;
}
export function buildWbsGraph(tasks: WbsTask[]): WbsGraphNode[] {
  if (!tasks.length) throw new Error('فایل WBS فاقد فعالیت معتبر است.');
  const nodes = new Map<string, WbsGraphNode>();
  const normalize = (value:string) => value.trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
  const explicitParents = new Map(tasks.filter(t=>t.parent_code!==undefined).map(t=>[normalize(t.wbs_code), normalize(t.parent_code!)]));
  const parentOf = (value:string):string => {
    if(explicitParents.has(value)) return explicitParents.get(value)!;
    const index=Math.max(value.lastIndexOf('.'),value.lastIndexOf('-'));
    return index<0 ? '' : value.slice(0,index);
  };
  const fingerprints = new Map<string, string>();
  for (const task of tasks) {
    const code = task.wbs_code.trim().replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
    if (!task.name.trim() || !/^[\p{L}\p{N}_]+(?:[.-][\p{L}\p{N}_]+)*$/u.test(code)) throw new Error(`کد WBS نامعتبر: ${task.wbs_code}`);
    const fingerprint = JSON.stringify({...task,wbs_code:code});
    if (fingerprints.has(code)) {
      if (fingerprints.get(code) !== fingerprint) throw new Error(`کد WBS تکراری و متناقض: ${code}`);
      continue;
    }
    fingerprints.set(code,fingerprint);
    const ancestors = [code];
    let parent = parentOf(code);
    while(parent) {
      if(ancestors.includes(parent) || ancestors.length>100) throw new Error(`چرخه یا عمق نامعتبر در ساختار WBS: ${code}`);
      if(!/^[\p{L}\p{N}_]+(?:[.-][\p{L}\p{N}_]+)*$/u.test(parent)) throw new Error(`کد والد WBS نامعتبر: ${parent}`);
      ancestors.unshift(parent);
      parent=parentOf(parent);
    }
    for (let depth = 1; depth <= ancestors.length; depth++) {
      const key = ancestors[depth-1];
      const leaf = depth === ancestors.length;
      const existing = nodes.get(key);
      if (existing && !leaf) continue;
      nodes.set(key, {
        code:key, parent_code:depth > 1 ? ancestors[depth-2] : null,
        title:leaf ? task.name : `سطح ${key} (تولید خودکار؛ نیازمند بازبینی)`, level:depth,
        node_type:depth === 1 ? 'phase' : 'work_package',
        deliverable_text:leaf ? task.deliverables || null : null,
        responsible:leaf ? task.owner || null : null, duration:leaf ? task.duration || null : null,
        start_date:leaf ? task.start_date || null : null, prerequisite:leaf ? task.prerequisite || null : null,
        notes:leaf ? task.note || null : null, sort_order:0,
        attributes:{...(leaf ? task.attributes : {}),source_code:leaf ? task.wbs_code : '',source_level:leaf ? task.level : '',source_parent_code:leaf ? task.parent_code ?? '' : '', synthesized:!leaf, active:true, phase:leaf ? task.phase || '' : '', kpi_text:leaf ? task.kpi || '' : ''},
      });
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (node: WbsGraphNode, depth=0): number => {
    if(depth > 100 || visiting.has(node.code)) throw new Error(`چرخه یا عمق نامعتبر در ساختار WBS: ${node.code}`);
    if(visited.has(node.code)) return node.level;
    visiting.add(node.code);
    node.level = node.parent_code ? visit(nodes.get(node.parent_code)!, depth+1)+1 : 1;
    visiting.delete(node.code); visited.add(node.code);
    return node.level;
  };
  for(const node of nodes.values()) visit(node);
  return [...nodes.values()].sort((a,b)=>a.level-b.level || a.code.localeCompare(b.code,'en',{numeric:true})).map((n,i)=>({...n,sort_order:i}));
}
