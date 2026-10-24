import type { SemanticEdge, SemanticGraph, SemanticNode } from './strategicGraph';

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 112;
export interface WorkspaceOptions { focusId?: string | null; query?: string; status?: string; showSources?: boolean; maxNodes?: number; }
export interface WorkspaceView { nodes: SemanticNode[]; edges: SemanticEdge[]; matchedIds: string[]; totalNodes: number; eligibleNodes: number; omittedNodes: number; }
export interface PositionedNode extends SemanticNode { x: number; y: number; }

/** Fit-all is explicit: the default frame preserves readable node text on narrow screens. */
export function frameWorkspace(bounds: {width:number;height:number}, viewport: {width:number;height:number}, anchor?: {x:number;y:number}, fitAll=false) {
  const fit = Math.max(.02, Math.min(1.05, (viewport.width-40)/Math.max(1,bounds.width), (viewport.height-40)/Math.max(1,bounds.height)));
  const scale = fitAll ? fit : Math.max(.85,fit);
  if (anchor && !fitAll && fit < .85) return { scale, x:viewport.width/2-(anchor.x+NODE_WIDTH/2)*scale, y:viewport.height/2-(anchor.y+NODE_HEIGHT/2)*scale };
  return { scale, x:(viewport.width-bounds.width*scale)/2, y:(viewport.height-bounds.height*scale)/2 };
}

export function projectWorkspace(graph: SemanticGraph, options: WorkspaceOptions): WorkspaceView {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const normalize = (value: string) => value.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u064b-\u065f]/g, '').replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).toLocaleLowerCase().trim();
  const query = normalize(options.query || '');
  const filtered = !!query || !!options.status && options.status !== 'all';
  const matches = graph.nodes.filter(n => (!query || normalize([n.label,n.code,...Object.values(n.details)].join(' ')).includes(query)) && (!options.status || options.status === 'all' || n.status === options.status || options.status === 'confirmed' && ['auto_confirmed','overridden','confirmed'].includes(n.status || '')));
  const seeds = options.focusId && byId.has(options.focusId) ? [options.focusId] : filtered ? matches.map(n => n.id) : [];
  let selected = new Set(byId.keys());
  if (options.focusId || filtered) {
    selected = new Set(seeds);
    for (const e of graph.edges) {
      if (seeds.includes(e.source)) selected.add(e.target);
      if (seeds.includes(e.target)) selected.add(e.source);
    }
    // Follow ancestors only: expanding a root as an undirected neighborhood would leak every project record.
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of graph.edges) if (['WBS_HIERARCHY','CONTAINS_WBS'].includes(e.type) && selected.has(e.target) && !selected.has(e.source)) { selected.add(e.source); changed = true; }
    }
    for (const e of graph.edges) if (['REPORTED_IN','DEFINED_IN'].includes(e.type) && selected.has(e.source)) selected.add(e.target);
    for (const e of graph.edges) if (e.type === 'SUBMITTED_IN' && selected.has(e.source)) selected.add(e.target);
  }
  const eligible = graph.nodes.filter(n => selected.has(n.id) && (options.showSources !== false || !['report','period'].includes(n.kind)));
  const cap = Math.max(1, options.maxNodes ?? 80);
  const prioritized = [...eligible].sort((a,b) => Number(b.id === options.focusId) - Number(a.id === options.focusId) || Number(seeds.includes(b.id)) - Number(seeds.includes(a.id)));
  const kept = new Set(prioritized.slice(0,cap).map(n => n.id));
  const nodes = eligible.filter(n => kept.has(n.id));
  const ids = new Set(nodes.map(n => n.id));
  return { nodes, edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)), matchedIds: filtered ? matches.map(n => n.id) : [], totalNodes: graph.nodes.length, eligibleNodes: eligible.length, omittedNodes: eligible.length-nodes.length };
}

/** Stable RTL ranks. Only the persisted hierarchy affects WBS depth; cycles are bounded. */
export function layoutWorkspace(nodes: SemanticNode[], edges: SemanticEdge[]) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const parents = new Map(edges.filter(e => e.type === 'WBS_HIERARCHY').map(e => [e.target, e.source]));
  const rank = new Map<string, number>();
  for (const n of nodes) {
    if (n.kind === 'project') { rank.set(n.id, 0); continue; }
    if (n.kind !== 'wbs') continue;
    let depth = 1;
    let current = n.id;
    const seen = new Set([current]);
    while (parents.has(current) && byId.has(parents.get(current)!)) {
      const parent = parents.get(current)!;
      if (seen.has(parent)) break;
      seen.add(parent); current = parent; depth++;
    }
    rank.set(n.id, depth);
  }
  const maxWbsRank = Math.max(1, ...rank.values());
  const offset = { activity: 1, kpi: 1, action: 2, report: 3, period: 4 };
  for (const n of nodes) if (!rank.has(n.id)) rank.set(n.id, maxWbsRank + (offset[n.kind as keyof typeof offset] || 1));
  const columns = new Map<number, SemanticNode[]>();
  for (const n of nodes) { const r = rank.get(n.id)!; const col = columns.get(r) || []; col.push(n); columns.set(r, col); }
  const maxRank = Math.max(0, ...rank.values());
  const maxRows = Math.max(1, ...Array.from(columns.values(), c => c.length));
  const height = maxRows * 164 + 120;
  // Crossing reduction: evidence order follows its actual WBS anchors, not row IDs.
  const stableOrder = [...nodes].filter(n=>n.kind==='wbs').sort((a,b)=>Number(a.details.sort_order||0)-Number(b.details.sort_order||0)||a.entityId-b.entityId);
  const anchorOrder = new Map(stableOrder.map((n,i)=>[n.id,i]));
  for (const n of nodes.filter(n=>['activity','kpi','action'].includes(n.kind))) {
    const targets = edges.filter(e=>['EXECUTES','MEASURES','TARGETS'].includes(e.type)&&e.source===n.id).map(e=>anchorOrder.get(e.target)).filter((v):v is number=>v!==undefined);
    if(targets.length) anchorOrder.set(n.id,targets.reduce((a,b)=>a+b,0)/targets.length);
  }
  for (const kind of ['report','period']) for (const n of nodes.filter(n=>n.kind===kind)) {
    const sources=edges.filter(e=>['REPORTED_IN','DEFINED_IN','SUBMITTED_IN'].includes(e.type)&&e.target===n.id).map(e=>anchorOrder.get(e.source)).filter((v):v is number=>v!==undefined);
    if(sources.length)anchorOrder.set(n.id,sources.reduce((a,b)=>a+b,0)/sources.length);
  }
  const positioned: PositionedNode[] = [];
  for (const [r, col] of columns) {
    col.sort((a,b) => (anchorOrder.get(a.id)??Number.MAX_SAFE_INTEGER)-(anchorOrder.get(b.id)??Number.MAX_SAFE_INTEGER) || Number(a.details.sort_order || 0) - Number(b.details.sort_order || 0) || a.entityId - b.entityId || a.id.localeCompare(b.id));
    for (let i = 0; i < col.length; i++) positioned.push({ ...col[i], x: 60 + (maxRank-r) * 380, y: 60 + (height-120-col.length*164)/2 + i*164 });
  }
  return { nodes: positioned, width: (maxRank+1)*380, height };
}
