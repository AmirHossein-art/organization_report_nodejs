import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { buildWbsGraph, type WbsGraphNode } from '../utils/wbsGraph';
import { parseWbsWorkbook } from '../utils/wbsDataParser';

export class WbsSyncError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function resolveWbsPath(directory: string, filename: string): string {
  if (!filename || filename !== path.basename(filename) || /[\\/]/.test(filename)) throw new WbsSyncError('نام فایل WBS نامعتبر است.');
  return path.join(directory,filename);
}
export function readWbsGraph(directory: string, filename: string) {
  const file=resolveWbsPath(directory,filename);
  if (!fs.existsSync(file)) throw new WbsSyncError('فایل WBS مرجع در فضای ذخیره‌سازی موجود نیست.',409);
  const stat=fs.statSync(file);
  if(stat.size > 20*1024*1024) throw new WbsSyncError('حجم فایل WBS بیش از حد مجاز است.');
  const buffer=fs.readFileSync(file);
  let nodes: WbsGraphNode[];
  try {
    const data=parseWbsWorkbook(buffer);
    nodes=buildWbsGraph(data.tasks);
  } catch(error) {
    const message=error instanceof Error ? error.message : '';
    throw new WbsSyncError(/WBS|فعالیت|چرخه/.test(message) && !message.includes(directory) ? message : 'فایل اکسل WBS قابل خواندن نیست.');
  }
  if(nodes.length>10000) throw new WbsSyncError('تعداد گره‌های WBS بیش از حد مجاز است.');
  return {nodes,sha256:createHash('sha256').update(buffer).digest('hex')};
}
export async function lockWbsProject(tx: Prisma.TransactionClient, projectId: number) {
  if(!Number.isSafeInteger(projectId) || projectId<=0) throw new WbsSyncError('شناسه پروژه نامعتبر است.');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(172901, ${projectId}::integer)`;
}
export async function syncWbsNodes(tx: Prisma.TransactionClient, projectId: number, nodes: WbsGraphNode[], source: {filename: string; sha256: string}) {
  if(!nodes.length) throw new WbsSyncError('ساختار WBS فاقد گره معتبر است.');
  const existing=await tx.wbsNode.findMany({where:{project_id:projectId}});
  const existingByCode=new Map(existing.map(n=>[n.code,n]));
  const live=new Set(nodes.map(n=>n.code));
  // Removed nodes are archived, never deleted: historical KPI/report/action links survive.
  let archivedCount=0;
  for(const old of existing) if(!live.has(old.code)) {
    archivedCount++;
    const attrs=old.attributes && typeof old.attributes==='object' && !Array.isArray(old.attributes) ? old.attributes as Prisma.JsonObject : {};
    const isAlreadyArchived=attrs.active===false && old.parent_id===null;
    if(!isAlreadyArchived) {
      await tx.wbsNode.update({where:{id:old.id},data:{parent_id:null,attributes:{...attrs,active:false}}});
    }
  }
  const ids=new Map<string,number>();
  for(const node of nodes) {
    const {parent_code, ...fields}=node;
    const old=existingByCode.get(node.code);
    const previous=old?.attributes && typeof old.attributes==='object' && !Array.isArray(old.attributes) ? old.attributes as Prisma.JsonObject : {};
    const data={...fields,parent_id:parent_code ? ids.get(parent_code)! : null,attributes:{...previous,...node.attributes,source_filename:source.filename,source_sha256:source.sha256,parser_version:1}};
    if(parent_code && !data.parent_id) throw new WbsSyncError('والد گره WBS یافت نشد.');
    const saved=await tx.wbsNode.upsert({where:{project_id_code:{project_id:projectId,code:node.code}},create:{...data,project_id:projectId},update:data});
    ids.set(node.code,saved.id);
  }
  return {nodes:nodes.length,archived:archivedCount};
}
export function unlinkWbsFile(directory: string, filename: string) {
  try { const file=resolveWbsPath(directory,filename); if(fs.existsSync(file)) fs.unlinkSync(file); }
  catch(error) { console.error('WBS disk cleanup failed:', error instanceof Error ? error.message : 'unknown'); }
}

export async function applyWbsUploadInTx(
  tx: Prisma.TransactionClient,
  projectId: number,
  upload: { filename: string; originalname: string; uploaded_by: number },
  graph: { nodes: WbsGraphNode[]; sha256: string }
) {
  const synced = await syncWbsNodes(tx, projectId, graph.nodes, { filename: upload.filename, sha256: graph.sha256 });
  const submission = await tx.wbsSubmission.create({
    data: {
      project_id: projectId,
      uploaded_by: upload.uploaded_by,
      file_name: upload.originalname,
      storage_filename: upload.filename,
    },
  });
  return { graph: synced, submission };
}

export async function removeWbsInTx(tx: Prisma.TransactionClient, projectId: number) {
  const linked = await tx.wbsNode.count({
    where: {
      project_id: projectId,
      OR: [{ reportLinks: { some: {} } }, { kpiLinks: { some: {} } }, { nextActions: { some: {} } }],
    },
  });
  if (linked) {
    throw new WbsSyncError('این WBS به گزارش، شاخص یا اقدام متصل است؛ برای حفظ سوابق امکان حذف کامل ندارد. فایل را جایگزین کنید.', 409);
  }
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { wbs_storage_filename: true },
  });
  const submissions = await tx.wbsSubmission.findMany({
    where: { project_id: projectId },
    select: { storage_filename: true },
  });
  await tx.wbsNode.deleteMany({ where: { project_id: projectId } });
  await tx.wbsSubmission.deleteMany({ where: { project_id: projectId } });
  const filesToCleanup = [...new Set([
    project?.wbs_storage_filename,
    ...submissions.map(s => s.storage_filename),
  ].filter((f): f is string => !!f))];
  return { filesToCleanup };
}

export async function backfillWbsGraphs(prisma: PrismaClient, directory: string, dryRun = false) {
  const projects = await prisma.project.findMany({
    where: { OR: [{ wbs_storage_filename: { not: null } }, { wbsSubmissions: { some: {} } }] },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const results: Array<{ project_id: number; status: string; nodes?: number; archived?: number; error?: string }> = [];

  for (const project of projects) {
    const maxRetries = 3;
    let attempt = 0;
    let finished = false;

    while (attempt < maxRetries && !finished) {
      attempt++;
      try {
        // 1. Preparation outside transaction
        const current = await prisma.project.findUnique({
          where: { id: project.id },
          select: { wbs_storage_filename: true },
        });
        const latest = current?.wbs_storage_filename
          ? null
          : await prisma.wbsSubmission.findFirst({
              where: { project_id: project.id },
              orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
              select: { storage_filename: true, file_name: true },
            });
        const filename = current?.wbs_storage_filename || latest?.storage_filename;
        if (!filename) {
          results.push({ project_id: project.id, status: 'skipped' });
          finished = true;
          break;
        }

        const graph = readWbsGraph(directory, filename);
        if (dryRun) {
          results.push({ project_id: project.id, status: 'dry_run', nodes: graph.nodes.length });
          finished = true;
          break;
        }

        // 2. Lock & re-verify authoritative filename inside transaction
        const result = await prisma.$transaction(async tx => {
          await lockWbsProject(tx, project.id);
          const lockedCurrent = await tx.project.findUniqueOrThrow({
            where: { id: project.id },
            select: { wbs_storage_filename: true },
          });
          const lockedLatest = lockedCurrent.wbs_storage_filename
            ? null
            : await tx.wbsSubmission.findFirst({
                where: { project_id: project.id },
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                select: { storage_filename: true, file_name: true },
              });
          const authoritativeFilename = lockedCurrent.wbs_storage_filename || lockedLatest?.storage_filename;
          if (!authoritativeFilename) {
            return { project_id: project.id, status: 'skipped' };
          }
          if (authoritativeFilename !== filename) {
            throw new Error('CONCURRENT_REFERENCE_CHANGED');
          }
          const synced = await syncWbsNodes(tx, project.id, graph.nodes, { filename, sha256: graph.sha256 });
          if (!lockedCurrent.wbs_storage_filename && lockedLatest) {
            await tx.project.update({
              where: { id: project.id },
              data: { wbs_storage_filename: filename, wbs_file_name: lockedLatest.file_name },
            });
          }
          return { project_id: project.id, status: 'synced', ...synced };
        }, { timeout: 120000, maxWait: 15000 });

        results.push(result);
        finished = true;
      } catch (error) {
        if (error instanceof Error && error.message === 'CONCURRENT_REFERENCE_CHANGED' && attempt < maxRetries) {
          continue;
        }
        results.push({
          project_id: project.id,
          status: 'failed',
          error: error instanceof WbsSyncError ? error.message : 'ورود ساختار WBS ناموفق بود؛ فایل و اتصال دیتابیس را بررسی کنید.',
        });
        console.error(`WBS backfill failed for project ${project.id}:`, error instanceof Error ? error.message : 'unknown error');
        finished = true;
      }
    }
  }

  return { dry_run: dryRun, failed: results.filter(r => r.status === 'failed').length, results };
}

export async function replaceWbsFile(
  prisma: PrismaClient,
  directory: string,
  projectId: number,
  upload: { filename: string; originalname: string; uploaded_by: number }
) {
  let committed = false;
  try {
    const graph = readWbsGraph(directory, upload.filename);
    const result = await prisma.$transaction(async tx => {
      await lockWbsProject(tx, projectId);
      const previous = await tx.project.findUnique({ where: { id: projectId } });
      if (!previous) throw new WbsSyncError('پروژه یافت نشد.', 404);
      const synced = await applyWbsUploadInTx(tx, projectId, upload, graph);
      const project = await tx.project.update({
        where: { id: projectId },
        data: { wbs_file_name: upload.originalname, wbs_storage_filename: upload.filename },
      });
      return { project, submission: synced.submission, graph: synced.graph };
    }, { timeout: 120000, maxWait: 15000 });
    committed = true;
    return result;
  } finally {
    if (!committed) unlinkWbsFile(directory, upload.filename);
  }
}

export async function deleteWbsFile(prisma: PrismaClient, directory: string, projectId: number) {
  const result = await prisma.$transaction(async tx => {
    await lockWbsProject(tx, projectId);
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (!project) throw new WbsSyncError('پروژه یافت نشد.', 404);
    const { filesToCleanup } = await removeWbsInTx(tx, projectId);
    await tx.project.update({
      where: { id: projectId },
      data: { wbs_file_name: null, wbs_storage_filename: null },
    });
    return { filesToCleanup };
  }, { timeout: 120000, maxWait: 15000 });
  for (const filename of result.filesToCleanup) unlinkWbsFile(directory, filename);
  return { success: true };
}

