import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import XLSX from 'xlsx';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
const snapshot=process.env.WBS_TEST_SNAPSHOT;
test('legacy project CRUD paths synchronize WBS and cannot bypass linked deletion guards', {skip:!snapshot,timeout:120000},async()=>{
 const root=path.resolve(snapshot!);
 const env=dotenv.parse(fs.readFileSync(path.join(root,'test.env')));
 const url=new URL(env.DATABASE_URL);
 assert.equal(url.hostname,'localhost');assert.equal(url.pathname,'/org_report_wbs_test_20261012');
 const pool=new pg.Pool({connectionString:url.toString()});
 const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
 const secret='isolated-project-routes-test-not-production';
 const port='3318';
 const child=spawn(process.execPath,['dist/server.cjs'],{cwd:process.cwd(),env:{...process.env,...env,NODE_ENV:'production',PORT:port,JWT_SECRET:secret,STORAGE_ROOT:root},stdio:['ignore','pipe','pipe']});
 let createdId:number|undefined;
 const code=`wbs-route-${Date.now()}`;
 try {
  await new Promise<void>((resolve,reject)=>{
   let output='';const timer=setTimeout(()=>reject(new Error('Server startup timeout')),30000);
   child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited before backfill'));});
   child.stdout.on('data',data=>{output+=data.toString();if(output.includes('WBS graph backfill:')){clearTimeout(timer);resolve();}});
  });
  const manager=await prisma.user.findFirstOrThrow({where:{role:'manager',is_active:true},select:{id:true,username:true}});
  const token=jwt.sign(manager,secret,{expiresIn:'3m'});
  const request=(route:string,method:string,body:FormData)=>fetch(`http://127.0.0.1:${port}${route}`,{method,body,headers:{Authorization:`Bearer ${token}`}});
  const form=(codes:string[],title='آزمون مسیر قدیمی')=>{
   const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['کد WBS','شرح فعالیت'],...codes.map(c=>[c,`کار ${c}`])]),'ساختار شکست');
   const data=new FormData();data.set('code',code);data.set('title',title);data.set('project_type','weekly');
   data.set('wbs_file',new Blob([XLSX.write(wb,{type:'buffer',bookType:'xlsx'})]),'source.xlsx');
   return data;
  };
  const created=await request('/api/projects','POST',form(['1.1','1.2']));
  assert.equal(created.status,201);const project=await created.json();createdId=project.id;
  assert.equal(await prisma.wbsNode.count({where:{project_id:createdId}}),3,'project create must ingest WBS immediately');
  assert.equal(await prisma.wbsSubmission.count({where:{project_id:createdId}}),1);
  const node=await prisma.wbsNode.findUniqueOrThrow({where:{project_id_code:{project_id:createdId!,code:'1.2'}}});
  const kpi=await prisma.projectKpi.create({data:{project_id:createdId!,name:'شاخص آزمون',unit:'عدد',target_direction:'minimum'}});
  const link=await prisma.kpiWbsLink.create({data:{project_kpi_id:kpi.id,wbs_node_id:node.id}});
  const removed=new FormData();removed.set('remove_wbs_file','true');removed.set('title','نباید ثبت شود');
  const blocked=await request(`/api/projects/${createdId}`,'PUT',removed);
  assert.equal(blocked.status,409,'legacy project edit must enforce linked deletion guard');
  assert.equal((await prisma.project.findUniqueOrThrow({where:{id:createdId}})).title,project.title,'failed removal must roll back metadata');
  const replaced=await request(`/api/projects/${createdId}`,'PUT',form(['1.1'],'عنوان جدید'));
  assert.equal(replaced.status,200);
  assert.equal((await prisma.kpiWbsLink.findUniqueOrThrow({where:{id:link.id}})).wbs_node_id,node.id);
  assert.equal((await prisma.wbsNode.findUniqueOrThrow({where:{id:node.id}})).attributes?.['active'],false);
  await prisma.kpiWbsLink.delete({where:{id:link.id}});
  const allowed=new FormData();allowed.set('remove_wbs_file','true');
  assert.equal((await request(`/api/projects/${createdId}`,'PUT',allowed)).status,200);
  assert.equal(await prisma.wbsNode.count({where:{project_id:createdId}}),0);
  assert.equal(await prisma.wbsSubmission.count({where:{project_id:createdId}}),0);
 }finally{
  child.kill();
  const project=await prisma.project.findUnique({where:{code}});
  if(project){const subs=await prisma.wbsSubmission.findMany({where:{project_id:project.id}});for(const filename of [project.wbs_storage_filename,...subs.map(s=>s.storage_filename)])if(filename&&path.basename(filename)===filename){const file=path.join(root,'wbs_files',filename);if(fs.existsSync(file))fs.unlinkSync(file);}await prisma.project.delete({where:{id:project.id}});}
  await prisma.$disconnect();await pool.end();
 }
});
