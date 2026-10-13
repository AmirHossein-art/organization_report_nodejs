import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { buildWbsGraph } from '../src/utils/wbsGraph';
import { parseWbsWorkbook } from '../src/utils/wbsDataParser';
const snapshot=process.env.WBS_TEST_SNAPSHOT;
test('real Railway WBS backfill is idempotent and parents remain in their project', {skip: !snapshot}, async () => {
 const root=path.resolve(snapshot!);
 const env=dotenv.parse(fs.readFileSync(path.join(root,'test.env')));
 const url=new URL(env.DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
 assert.equal(url.pathname,'/org_report_wbs_test_20261012');
 const pool=new pg.Pool({connectionString:url.toString()});
 const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
 try {
  const modulePath='../src/services/wbsGraphSync';
  const mod=await import(modulePath).catch(()=>({}));
  assert.equal(typeof mod.backfillWbsGraphs,'function','backfill implementation must exist');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  const expectedInvalid=new Set([4,53]);
  for(const item of manifest) {
   const parsed=parseWbsWorkbook(path.join(root,'wbs_files',item.filename));
   if(expectedInvalid.has(item.project_id)) assert.throws(()=>buildWbsGraph(parsed.tasks));
   else assert.ok(buildWbsGraph(parsed.tasks).length);
  }
  const first=await mod.backfillWbsGraphs(prisma,path.join(root,'wbs_files'));
  assert.equal(first.failed,2); assert.equal(first.results.length,manifest.length);
  assert.deepEqual(first.results.filter((r:any)=>r.status==='failed').map((r:any)=>r.project_id),[4,53]);
  const before=await prisma.wbsNode.findMany({orderBy:{id:'asc'}});
  assert.ok(before.length>0);
  const second=await mod.backfillWbsGraphs(prisma,path.join(root,'wbs_files'));
  assert.equal(second.failed,2);
  const after=await prisma.wbsNode.findMany({orderBy:{id:'asc'}});
  assert.deepEqual(after.map(n=>[n.id,n.project_id,n.code,n.parent_id]),before.map(n=>[n.id,n.project_id,n.code,n.parent_id]));
  const ids=new Map(after.map(n=>[n.id,n]));
  for(const n of after) if(n.parent_id!==null) assert.equal(ids.get(n.parent_id)?.project_id,n.project_id);
  console.log(JSON.stringify({verified_projects:first.results.length,nodes:after.length,stable_ids:true,results:first.results}));
 } finally {await prisma.$disconnect();await pool.end();}
});
test('transactional upload, rollback, archived links and guarded deletion work on PostgreSQL', {skip:!snapshot}, async()=>{
 const {replaceWbsFile,deleteWbsFile}=await import('../src/services/wbsGraphSync');
 const root=path.resolve(snapshot!);
 const url=new URL(dotenv.parse(fs.readFileSync(path.join(root,'test.env'))).DATABASE_URL);
 assert.equal(url.hostname,'localhost');assert.equal(url.pathname,'/org_report_wbs_test_20261012');
 const pool=new pg.Pool({connectionString:url.toString()});
 const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
 const XLSX=(await import('xlsx')).default;
 const directory=fs.mkdtempSync(path.join(root,'lifecycle-'));
 const project=await prisma.project.create({data:{title:'آزمون ایزوله WBS',code:`wbs-test-${Date.now()}`}});
 try{
  const user=await prisma.user.findFirstOrThrow({select:{id:true}});
  const fixture=(name:string,codes:string[])=>{
   const wb=XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['کد WBS','شرح فعالیت'],...codes.map(code=>[code,`کار ${code}`])]),'ساختار شکست');
   XLSX.writeFile(wb,path.join(directory,name));
  };
  fixture('first.xlsx',['1.1','1.2']);
  await replaceWbsFile(prisma,directory,project.id,{filename:'first.xlsx',originalname:'اول.xlsx',uploaded_by:user.id});
  const node=await prisma.wbsNode.findUniqueOrThrow({where:{project_id_code:{project_id:project.id,code:'1.2'}}});
  const kpi=await prisma.projectKpi.create({data:{project_id:project.id,name:'شاخص آزمایشی',unit:'عدد',target_direction:'minimum'}});
  const link=await prisma.kpiWbsLink.create({data:{project_kpi_id:kpi.id,wbs_node_id:node.id}});
  fixture('replacement.xlsx',['1.1']);
  await replaceWbsFile(prisma,directory,project.id,{filename:'replacement.xlsx',originalname:'دوم.xlsx',uploaded_by:user.id});
  const archived=await prisma.wbsNode.findUniqueOrThrow({where:{id:node.id}});
  assert.equal((archived.attributes as any).active,false);
  assert.equal((await prisma.kpiWbsLink.findUniqueOrThrow({where:{id:link.id}})).wbs_node_id,node.id);
  assert.ok(fs.existsSync(path.join(directory,'first.xlsx')));
  await assert.rejects(()=>deleteWbsFile(prisma,directory,project.id),/متصل/);
  assert.ok(fs.existsSync(path.join(directory,'replacement.xlsx')));
  fixture('rollback.xlsx',['2.1']);
  const before=await prisma.wbsNode.findMany({where:{project_id:project.id},orderBy:{id:'asc'}});
  await assert.rejects(()=>replaceWbsFile(prisma,directory,project.id,{filename:'rollback.xlsx',originalname:'خراب.xlsx',uploaded_by:-999}));
  assert.equal(fs.existsSync(path.join(directory,'rollback.xlsx')),false);
  assert.deepEqual(await prisma.wbsNode.findMany({where:{project_id:project.id},orderBy:{id:'asc'}}),before);
  assert.equal((await prisma.project.findUniqueOrThrow({where:{id:project.id}})).wbs_storage_filename,'replacement.xlsx');
  await prisma.kpiWbsLink.delete({where:{id:link.id}});
  await deleteWbsFile(prisma,directory,project.id);
  assert.equal(await prisma.wbsNode.count({where:{project_id:project.id}}),0);
  assert.equal(await prisma.wbsSubmission.count({where:{project_id:project.id}}),0);
  assert.equal(fs.readdirSync(directory).length,0);
 }finally{
  await prisma.project.delete({where:{id:project.id}});
  fs.rmSync(directory,{recursive:true,force:true});
  await prisma.$disconnect();await pool.end();
 }
});

