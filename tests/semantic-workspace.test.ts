import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticGraph } from '../src/semantic/strategicGraph';

export function workspaceFixture() {
  return buildSemanticGraph({
    project: { id: 1, title: 'پروژه آزمایشی', code: 'P1' },
    wbsNodes: [
      { id: 10, project_id: 1, code: 'PH', title: 'فاز طراحی', parent_id: null },
      { id: 11, project_id: 1, code: 'WP-A', title: 'نقشه اجرایی', parent_id: 10 },
      { id: 12, project_id: 1, code: 'WP-B', title: 'نصب تجهیزات', parent_id: 10, prerequisite: 'WP-A' },
    ],
    activities: [
      { id: 20, project_id: 1, report_id: 30, line_number: 1, activity_text: 'بازبینی نقشه', wbs_node_id: 11, status: 'needs_review' },
      { id: 21, project_id: 1, report_id: 30, line_number: 2, activity_text: 'هماهنگی بدون تطبیق', status: 'unmapped' },
    ],
    nextActions: [{ id: 40, project_id: 1, action_text: 'تحویل نقشه', wbs_node_id: 11, is_completed: false, is_cancelled: false }],
    kpis: [],
    reports: [{ id: 30, project_id: 1, period_id: 50, period_title: 'هفته اول' }],
    periods: [{ id: 50, title: 'هفته اول' }],
  });
}

test('evidence rows follow their WBS anchors rather than unrelated record ID order', async () => {
  const { layoutWorkspace } = await import('../src/semantic/workspace');
  const graph=workspaceFixture();
  const a=graph.nodes.find(n=>n.id==='act-20')!;
  graph.nodes=graph.nodes.filter(n=>n.kind!=='activity');
  graph.nodes.push({...a,id:'act-900',entityId:900},{...a,id:'act-1',entityId:1});
  graph.edges=graph.edges.filter(e=>e.type!=='EXECUTES'&&e.type!=='REPORTED_IN');
  graph.edges.push({id:'left',source:'act-900',target:'wbs-11',type:'EXECUTES',epistemic:'reported',provenance:{source:'ReportActivity'}},{id:'right',source:'act-1',target:'wbs-12',type:'EXECUTES',epistemic:'reported',provenance:{source:'ReportActivity'}});
  const layout=layoutWorkspace(graph.nodes,graph.edges);
  assert.ok(layout.nodes.find(n=>n.id==='act-900')!.y<layout.nodes.find(n=>n.id==='act-1')!.y);
});

test('readable framing never shrinks node text to a thumbnail; explicit fit-all remains available', async () => {
  const { frameWorkspace } = await import('../src/semantic/workspace');
  const viewport={width:360,height:560}; const bounds={width:2600,height:1000};
  const readable=frameWorkspace(bounds,viewport,{x:1200,y:300});
  assert.ok(readable.scale >= .8);
  assert.ok(Math.abs(readable.x+(1200+120)*readable.scale-viewport.width/2)<1);
  const fit=frameWorkspace(bounds,viewport,undefined,true);
  assert.ok(fit.scale*bounds.width<=viewport.width);
});

test('filters search all entity kinds with Persian normalization and keep paths; caps disclose omissions', async () => {
  const { projectWorkspace } = await import('../src/semantic/workspace');
  const graph = workspaceFixture();
  const view = projectWorkspace(graph, { query: 'نقشه اجرايي', showSources: false });
  assert.ok(view.matchedIds.includes('wbs-11'));
  assert.ok(view.nodes.some(n => n.id === 'wbs-10'));
  assert.ok(!view.nodes.some(n => n.kind === 'report' || n.kind === 'period'));
  const status = projectWorkspace(graph, { status: 'needs_review', showSources: true });
  assert.ok(status.nodes.some(n => n.id === 'act-20'));
  assert.ok(!status.nodes.some(n => n.id === 'act-21'));
  assert.equal(projectWorkspace(graph, { query: 'بی‌نتیجه' }).nodes.length, 0);
  const capped = projectWorkspace(graph, { maxNodes: 3 });
  assert.equal(capped.nodes.length, 3);
  assert.equal(capped.omittedNodes, capped.eligibleNodes - 3);
  const focusedCapped = projectWorkspace(graph, { focusId: 'act-21', maxNodes: 2 });
  assert.ok(focusedCapped.nodes.some(n => n.id === 'act-21'), 'focus cannot be lost at limit');
});

test('focus preserves ancestors, direct semantic neighbors, and activity report/period evidence without project fanout', async () => {
  const { projectWorkspace } = await import('../src/semantic/workspace');
  const view = projectWorkspace(workspaceFixture(), { focusId: 'wbs-11', showSources: true });
  const ids = new Set(view.nodes.map(n => n.id));
  for (const id of ['project-1','wbs-10','wbs-11','wbs-12','act-20','action-40','report-30','period-50']) assert.ok(ids.has(id), id);
  assert.ok(!ids.has('act-21'), 'unrelated unlinked activity is not a semantic neighbor');
});

test('workspace selects typed relationships with both endpoints and deterministic RTL placement', async () => {
  const { projectWorkspace, layoutWorkspace } = await import('../src/semantic/workspace');
  const graph = workspaceFixture();
  const view = projectWorkspace(graph, {});
  const layout = layoutWorkspace(view.nodes, view.edges);
  assert.deepEqual(layout, layoutWorkspace(view.nodes, view.edges));
  assert.ok(view.edges.some(e => e.type === 'EXECUTES'));
  assert.ok(layout.nodes.find(n => n.id === 'wbs-10')!.x > layout.nodes.find(n => n.id === 'wbs-11')!.x);
  for (const edge of view.edges) {
    assert.ok(view.nodes.some(n => n.id === edge.source));
    assert.ok(view.nodes.some(n => n.id === edge.target));
  }
  assert.ok(layout.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
