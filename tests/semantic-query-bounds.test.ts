import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectStrategicGraph } from '../src/services/activityGraphService';

test('service enforces hard query caps even when HTTP options request an enormous history', async()=>{
  const takes:number[]=[];
  const prisma={
    project:{findUnique:async()=>({id:1,title:'آزمایش سقف',code:'T'})},
    wbsNode:{findMany:async()=>[]},
    reportActivity:{findMany:async(q:any)=>{takes.push(q.take);return [];},count:async()=>1200},
    nextAction:{findMany:async(q:any)=>{takes.push(q.take);return [];},count:async()=>600},
    projectKpi:{findMany:async()=>[],count:async()=>0},
    report:{findMany:async()=>[]},
  };
  const graph=await getProjectStrategicGraph(prisma as any,1,{maxActivities:1_000_000_000,maxNextActions:1_000_000_000});
  assert.deepEqual(takes,[500,250]);
  assert.equal(graph!.semantic!.coverage.isTruncated,true);
  assert.equal(graph!.semantic!.coverage.truncatedDetails!.activitiesOmitted,1200);
  assert.equal(graph!.semantic!.coverage.truncatedDetails!.actionsOmitted,600);
});
