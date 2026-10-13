import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { backfillWbsGraphs } from '../src/services/wbsGraphSync';
const args=process.argv.slice(2);
const option=(name:string)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
dotenv.config({quiet:true});
const envFile=option('--env');
if(envFile) Object.assign(process.env,dotenv.parse(fs.readFileSync(envFile)));
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const directory=option('--wbs-dir') || path.join(process.env.STORAGE_ROOT || process.cwd(),'wbs_files');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
try {
 const result=await backfillWbsGraphs(prisma,directory,!args.includes('--apply'));
 console.log(JSON.stringify(result,null,2));
 if(result.failed) process.exitCode=1;
} catch {
 console.error('WBS backfill could not run. Confirm database schema, connectivity and storage directory.');
 process.exitCode=1;
} finally {await prisma.$disconnect();await pool.end();}
