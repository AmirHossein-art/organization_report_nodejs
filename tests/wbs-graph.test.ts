import test from 'node:test';
import assert from 'node:assert/strict';
import type { WbsTask } from '../src/utils/wbsDataParser';
const task = (code: string, name = 'فعالیت'): WbsTask => ({wbs_code: code, name, level:'3', deliverables:'خروجی', owner:'واحد', duration:'۲ روز', start_date:'', prerequisite:'', note:''});
test('graph builder creates parents and preserves original Persian code', async () => {
  const modulePath = '../src/utils/wbsGraph';
  const mod = await import(modulePath).catch(() => ({}));
  assert.equal(typeof mod.buildWbsGraph, 'function', 'graph builder must exist');
  const nodes = mod.buildWbsGraph([task('۱.۲.۳')]);
  assert.deepEqual(nodes.map((n: any) => n.code), ['1','1.2','1.2.3']);
  assert.equal(nodes[2].parent_code, '1.2');
  assert.equal(nodes[2].attributes.source_code, '۱.۲.۳');
  assert.equal(nodes[0].attributes.synthesized, true);
});
test('graph builder rejects empty structures and conflicting duplicate codes', async () => {
  const {buildWbsGraph} = await import('../src/utils/wbsGraph');
  assert.throws(() => buildWbsGraph([]), /فعالیت/);
  assert.throws(() => buildWbsGraph([task('1.1','الف'), task('۱.۱','ب')]), /تکراری/);
  assert.throws(() => buildWbsGraph([task('-')]), /کد/);
});
test('hyphen codes have parents, Arabic digits normalize, exact duplicates deduplicate', async () => {
  const {buildWbsGraph} = await import('../src/utils/wbsGraph');
  const nodes=buildWbsGraph([task('P١-WP-٢'), task('P١-WP-٢')]);
  assert.deepEqual(nodes.map(n=>n.code), ['P1','P1-WP','P1-WP-2']);
  assert.equal(nodes[2].parent_code,'P1-WP');
});
test('explicit source parent overrides code shape and cycles are rejected', async()=>{
 const {buildWbsGraph}=await import('../src/utils/wbsGraph');
 const nodes=buildWbsGraph([{...task('P1-WP-1'),parent_code:'P1'}, {...task('P1'),parent_code:''}]);
 assert.deepEqual(nodes.map(n=>n.code),['P1','P1-WP-1']);
 assert.equal(nodes[1].parent_code,'P1');
 assert.throws(()=>buildWbsGraph([{...task('A'),parent_code:'B'},{...task('B'),parent_code:'A'}]),/چرخه/);
 const other=buildWbsGraph([{...task('A.1'),parent_code:'X.Y'},{...task('X.Y'),parent_code:''}]);
 assert.deepEqual(other.map(n=>n.code),['X.Y','A.1']);
});
test('syncWbsNodes uses Map lookup and avoids redundant updates on already-archived nodes', async () => {
 const {syncWbsNodes} = await import('../src/services/wbsGraphSync');
 const updates: any[] = [];
 const upserts: any[] = [];
 const mockTx: any = {
  wbsNode: {
   findMany: async () => [
    { id: 1, code: 'ALREADY_ARCHIVED', parent_id: null, attributes: { active: false, note: 'old' } },
    { id: 2, code: 'NOW_REMOVED', parent_id: 99, attributes: { active: true } },
    { id: 3, code: '1.1', parent_id: null, attributes: { active: true } }
   ],
   update: async (args: any) => { updates.push(args); return args; },
   upsert: async (args: any) => { upserts.push(args); return { id: 3, ...args.create }; }
  }
 };
 const activeNodes: any[] = [
  { code: '1.1', parent_code: null, title: 'کار', level: 1, node_type: 'phase', deliverable_text: null, responsible: null, duration: null, start_date: null, prerequisite: null, notes: null, sort_order: 0, attributes: { active: true } }
 ];
 const result = await syncWbsNodes(mockTx, 10, activeNodes, { filename: 'test.xlsx', sha256: 'abc' });
 assert.equal(result.nodes, 1);
 assert.equal(result.archived, 2);
 // ALREADY_ARCHIVED must NOT trigger update; only NOW_REMOVED should be updated
 assert.equal(updates.length, 1, 'should not update already-archived nodes repeatedly');
 assert.equal(updates[0].where.id, 2);
 assert.equal(updates[0].data.parent_id, null);
 assert.equal(updates[0].data.attributes.active, false);
});
