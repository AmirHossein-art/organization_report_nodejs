import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticGraph, formatSemanticGraphForPrompt } from '../src/semantic/strategicGraph';

test('AI context preserves exact arbitrary-code hierarchy and evidence report/period paths with source IDs',()=>{
  const graph=buildSemanticGraph({project:{id:1,title:'آزمایش روابط',code:'T'},
    wbsNodes:[{id:10,project_id:1,code:'PHASE-X',title:'فاز',parent_id:null},{id:11,project_id:1,code:'CUSTOM-Z',title:'خروجی',parent_id:10}],
    activities:[{id:20,project_id:1,report_id:30,line_number:1,activity_text:'شاهد اجرا',wbs_node_id:11,status:'needs_review'}],
    reports:[{id:30,project_id:1,period_id:40,period_title:'دوره نمونه'}],periods:[{id:40,title:'دوره نمونه'}],nextActions:[],kpis:[]});
  const prompt=formatSemanticGraphForPrompt(graph,{maxActivities:1});
  assert.ok(prompt.includes('wbs-10 --WBS_HIERARCHY--> wbs-11'));
  assert.ok(prompt.includes('act-20 --REPORTED_IN--> report-30'));
  assert.ok(prompt.includes('report-30 --SUBMITTED_IN--> period-40'));
  assert.ok(prompt.includes('WbsNode#11'));
  assert.ok(prompt.includes('ai_proposed'));
  const withoutActivity=formatSemanticGraphForPrompt(graph,{maxActivities:0});
  assert.ok(!withoutActivity.includes('act-20 --EXECUTES-->'));
});
