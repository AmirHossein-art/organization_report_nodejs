import type { PrismaClient } from "@prisma/client";
import { buildSemanticGraph, type SemanticGraph } from "../semantic/strategicGraph";

export interface DecomposedActivity {
  line_number: number;
  activity_text: string;
}

export interface ActivityProposal {
  line_number: number;
  activity_text: string;
  wbs_code: string | null;
  wbs_node_id: number | null;
  confidence: number;
  status: "auto_confirmed" | "needs_review" | "unmapped" | "confirmed" | "overridden";
  ai_reasoning: string;
  audit_feedback: string;
}

export interface StrategicGraphData {
  project: {
    id: number;
    title: string;
    code: string;
  };
  nodes: {
    wbsNodes: Array<{
      id: number;
      code: string;
      title: string;
      level: number;
      node_type: string;
      deliverable_text: string | null;
      responsible: string | null;
      prerequisite: string | null;
      sort_order: number;
      active: boolean;
      kpis: Array<{ id: number; name: string; unit: string; target_value: number | null }>;
    }>;
    activities: Array<{
      id: number;
      report_id: number;
      period_title: string;
      period_id: number;
      line_number: number;
      activity_text: string;
      wbs_node_id: number | null;
      confidence: number | null;
      status: string;
      ai_reasoning: string | null;
      audit_feedback: string | null;
      created_at: string;
    }>;
    nextActions: Array<{
      id: number;
      action_text: string;
      wbs_node_id: number | null;
      target_date: string | null;
      is_completed: boolean;
      is_cancelled: boolean;
      user_name: string | null;
    }>;
    kpis: Array<{
      id: number;
      name: string;
      unit: string;
      baseline_value: number | null;
      target_value: number | null;
      target_direction: string;
    }>;
  };
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "WBS_HIERARCHY" | "EXECUTES" | "MEASURES" | "TARGETS" | "PREREQUISITE";
    status?: string;
    label?: string;
  }>;
  stats: {
    totalWbs: number;
    totalActivities: number;
    autoConfirmedActivities: number;
    needsReviewActivities: number;
    unmappedActivities: number;
    totalNextActions: number;
    totalKpis: number;
  };
  semantic?: SemanticGraph;
}

/**
 * ۱. تفکیک اتمیک متن شرح فعالیت‌ها به خطوط مستقل پاک‌سازی‌شده
 */
export function decomposeActivities(text: string): DecomposedActivity[] {
  if (!text || typeof text !== "string") return [];

  const rawLines = text.split(/\r?\n/);
  const result: DecomposedActivity[] = [];
  let lineCounter = 1;

  for (const raw of rawLines) {
    let cleaned = raw.trim();
    if (!cleaned) continue;

    // پاک‌سازی سرخط‌های عددی، نقطه‌چین‌ها، بولت‌ها و کاراکترهای نشانه‌گذاری
    cleaned = cleaned.replace(/^[\s\-\*•–—+■●▪]+/g, "").trim();
    cleaned = cleaned.replace(/^[0-9۰-۹]+[\.\-\)\s:]+/g, "").trim();

    // حذف جملات توخالی یا بسیار کوتاه کمتر از ۳ کاراکتر
    if (cleaned.length < 3) continue;

    result.push({
      line_number: lineCounter++,
      activity_text: cleaned,
    });
  }

  return result;
}

/**
 * ۲. ایجاد پرامپت دو مرحله‌ای (گذر ۱: پیشنهاد پیوند + گذر ۲: داوری و خود-پالایشی)
 */
export function buildDualPassLinkingPrompt(
  projectTitle: string,
  activities: DecomposedActivity[],
  wbsNodes: Array<{ id: number; code: string; title: string; level: number; deliverable_text?: string | null; prerequisite?: string | null }>
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `شما موتور تحلیل شبکه معنایی و ممیزی پروژه‌های سازمان حمل و نقل و ترافیک تهران هستید.
وظیفه شما اتصال فعالیت‌های دوره‌ای گزارش‌شده به ساختار شکست کار (WBS) با اجرای یک حلقه دو مرحله‌ای «پیشنهاد و خود-پالایشی (Reflection & Self-Audit)» است.

اصول و قواعد بدون استثنا:
۱. اصل لنگر حقیقت (Ground of Truth): ساختار WBS مرجع مطلق است. شما هرگز مجاز به ابداع کد WBS فرضی نیستید. کدهای مجاز دقیقاً در پرامپت ارائه شده‌اند.
۲. ممیزی خودکار سازگاری (Self-Audit): در گذر دوم، هر اتصال را از لحاظ انطباق با حوزه تخصصی، همخوانی با پیش‌نیازها و فاز کاری بسنجید.
۳. تعیین وضعیت (Status Resolution):
   - اگر اطمینان ≥ ۰.۸۵ و انطباق کامل با خروجی بسته کاری دارد: "auto_confirmed"
   - اگر بین دو گره WBS تردید وجود دارد یا ارتباط غیرمستقیم است: "needs_review"
   - اگر کار انجام‌شده خارج از محدوده مصوب پروژه است (کارهای متفرقه / Scope Creep): "unmapped" و کد WBS را null بگذارید.

خروجی شما باید منحصراً یک شیء JSON با کلید "proposals" باشد.`;

  const wbsCatalog = wbsNodes.map((n) => {
    const deliv = n.deliverable_text ? ` [خروجی: ${n.deliverable_text}]` : "";
    const prereq = n.prerequisite ? ` [پیش‌نیاز: ${n.prerequisite}]` : "";
    return `- کد ${n.code} (سطح ${n.level}): ${n.title}${deliv}${prereq}`;
  }).join("\n");

  const activitiesList = activities.map((a) => `${a.line_number}. ${a.activity_text}`).join("\n");

  const userPrompt = `پروژه: ${projectTitle}

لیست گره‌های WBS معتبر پروژه (Ground of Truth):
${wbsCatalog || "سند WBS فاقد گره فعال است."}

لیست فعالیت‌های ثبت‌شده در این دوره:
${activitiesList}

دستورالعمل حلقه خود-پالایشی:
۱. برای هر خط، مناسب‌ترین کد WBS را پیدا کنید.
۲. در گذر بازبینی (Audit Pass)، کد انتخابی را با خروجی و پیش‌نیازهای بسته کاری مقایسه کنید.
۳. ضریب اطمینان (confidence بین 0.0 تا 1.0)، وضعیت نهایی (auto_confirmed, needs_review, unmapped)، استدلال انتخاب گره و بازخورد ممیزی را مشخص کنید.

قالب خروجی دقیق JSON:
{
  "proposals": [
    {
      "line_number": 1,
      "activity_text": "...",
      "wbs_code": "1.2.1",
      "confidence": 0.92,
      "status": "auto_confirmed",
      "reasoning": "توضیح کوتاه استدلال انطباق",
      "audit_feedback": "تایید سازگاری در گذر دوم ممیزی"
    }
  ]
}`;

  return { systemPrompt, userPrompt };
}

/**
 * ۳. ارزیابی قطعی سمت سرور جهت تضمین عدم نفوذ کدهای ناموجود (Zero Hallucination)
 */
export function auditAndFinalizeProposals(
  activities: DecomposedActivity[],
  aiProposals: any[],
  wbsNodes: Array<{ id: number; code: string; title: string }>
): ActivityProposal[] {
  const wbsByCode = new Map(wbsNodes.map((n) => [n.code.trim(), n]));
  const proposalsByLine = new Map<number, any>();

  if (Array.isArray(aiProposals)) {
    for (const p of aiProposals) {
      if (p && typeof p.line_number === "number") {
        proposalsByLine.set(p.line_number, p);
      }
    }
  }

  const finalized: ActivityProposal[] = [];

  for (const act of activities) {
    const aiProp = proposalsByLine.get(act.line_number);

    let rawCode: string | null = (aiProp?.wbs_code || "").toString().trim() || null;
    let confidence = typeof aiProp?.confidence === "number" ? Math.max(0, Math.min(1, aiProp.confidence)) : 0.6;
    let status: ActivityProposal["status"] = "needs_review";
    let reasoning = aiProp?.reasoning || "تحلیل خودکار سامانه";
    let auditFeedback = aiProp?.audit_feedback || "";

    let matchedNode = rawCode ? wbsByCode.get(rawCode) : undefined;

    // اگر کد اعلامی هوش مصنوعی در کاتالوگ WBS موجود نبود:
    if (rawCode && !matchedNode) {
      // جستجوی تقریبی بر اساس عنوان گره‌های WBS
      const fallback = wbsNodes.find((n) => act.activity_text.includes(n.title) || n.title.includes(act.activity_text));
      if (fallback) {
        matchedNode = fallback;
        rawCode = fallback.code;
        confidence = 0.70;
        status = "needs_review";
        auditFeedback = `کد ساختگی ${aiProp?.wbs_code} در بازبینی رد شد و با گره ${fallback.code} جایگزین گردید.`;
      } else {
        matchedNode = undefined;
        rawCode = null;
        confidence = 0.3;
        status = "unmapped";
        auditFeedback = `کد نامعتبر ${aiProp?.wbs_code} توسط ممیزی رد شد؛ گره منطبقی در WBS یافت نشد.`;
      }
    } else if (matchedNode) {
      if (confidence >= 0.85 && aiProp?.status === "auto_confirmed") {
        status = "auto_confirmed";
        auditFeedback = auditFeedback || "انطباق کامل با بسته کاری تایید شد.";
      } else {
        status = "needs_review";
        auditFeedback = auditFeedback || "نیازمند بازبینی دوره‌ای مدیر.";
      }
    } else {
      status = "unmapped";
      auditFeedback = auditFeedback || "فعالیت خارج از محدوده مصوب WBS شناسایی شد.";
    }

    finalized.push({
      line_number: act.line_number,
      activity_text: act.activity_text,
      wbs_code: rawCode,
      wbs_node_id: matchedNode ? matchedNode.id : null,
      confidence,
      status,
      ai_reasoning: reasoning,
      audit_feedback: auditFeedback,
    });
  }

  return finalized;
}

/**
 * ۴. ذخیره امن و ترنزکشنال فعالیت‌های اتمیک در پایگاه داده
 */
export async function persistReportActivities(
  prisma: PrismaClient,
  reportId: number,
  projectId: number,
  proposals: ActivityProposal[]
) {
  return await prisma.$transaction(async (tx) => {
    // فعالیت‌های قبلی این گزارش را پاک می‌کنیم تا ثبت جدید جایگزین شود
    await tx.reportActivity.deleteMany({
      where: { report_id: reportId },
    });

    const created = [];
    for (const p of proposals) {
      const rec = await tx.reportActivity.create({
        data: {
          report_id: reportId,
          project_id: projectId,
          line_number: p.line_number,
          activity_text: p.activity_text,
          wbs_node_id: p.wbs_node_id,
          confidence: p.confidence,
          status: p.status,
          ai_reasoning: p.ai_reasoning,
          audit_feedback: p.audit_feedback,
        },
      });
      created.push(rec);
    }

    return created;
  });
}

export interface GetProjectStrategicGraphOptions {
  maxActivities?: number;
  maxNextActions?: number;
}

/**
 * ۵. تولید داده‌های کامل گراف استراتژیک برای کامپوننت بصری فرانت‌اند و ساختار غنی معنایی هوش مصنوعی
 */
export async function getProjectStrategicGraph(
  prisma: PrismaClient,
  projectId: number,
  options?: GetProjectStrategicGraphOptions
): Promise<StrategicGraphData | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, code: true, description: true, project_type: true },
  });
  if (!project) return null;

  // ۱. گره‌های WBS
  const wbsRaw = await prisma.wbsNode.findMany({
    where: { project_id: projectId },
    include: {
      kpiLinks: {
        include: {
          kpi: {
            select: { id: true, project_id: true, name: true, unit: true, target_value: true, baseline_value: true, is_active: true },
          },
        },
      },
    },
    orderBy: [{ sort_order: "asc" }, { code: "asc" }],
  });

  const wbsNodes = wbsRaw.map((n) => {
    const attrs = (n.attributes as any) || {};
    return {
      id: n.id,
      parent_id: n.parent_id,
      code: n.code,
      title: n.title,
      level: n.level,
      node_type: n.node_type,
      deliverable_text: n.deliverable_text,
      responsible: n.responsible,
      prerequisite: n.prerequisite,
      sort_order: n.sort_order,
      active: attrs.active !== false,
      kpis: n.kpiLinks.map((kl) => kl.kpi),
    };
  });

  // ۲. فعالیت‌های اتمیک ثبت‌شده (بدون ترانکیشن مخفی؛ پشتیبانی از سقف صریح)
  const activityQuery: any = {
    where: { project_id: projectId },
    include: {
      report: {
        select: {
          id: true,
          period_title: true,
          period_id: true,
          submitted_at: true,
          user_full_name: true,
        },
      },
    },
    orderBy: [{ report_id: "desc" }, { line_number: "asc" }],
  };
  if (options?.maxActivities && Number.isSafeInteger(options.maxActivities) && options.maxActivities > 0) {
    activityQuery.take = options.maxActivities;
  }

  const activitiesRaw: any[] = await prisma.reportActivity.findMany(activityQuery);

  const activities = activitiesRaw.map((a: any) => ({
    id: a.id,
    report_id: a.report_id,
    period_title: a.report?.period_title || "",
    period_id: a.report?.period_id || 0,
    line_number: a.line_number,
    activity_text: a.activity_text,
    wbs_node_id: a.wbs_node_id,
    confidence: a.confidence,
    status: a.status,
    ai_reasoning: a.ai_reasoning,
    audit_feedback: a.audit_feedback,
    created_at: a.created_at ? (a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at)) : new Date().toISOString(),
  }));

  // ۳. اقدامات آتی باز و تکمیل‌شده (بدون ترانکیشن مخفی)
  const nextActionQuery: any = {
    where: { project_id: projectId },
    include: {
      user: { select: { full_name: true } },
    },
    orderBy: [{ is_completed: "asc" }, { target_date: "asc" }],
  };
  if (options?.maxNextActions && Number.isSafeInteger(options.maxNextActions) && options.maxNextActions > 0) {
    nextActionQuery.take = options.maxNextActions;
  }

  const nextActionsRaw: any[] = await prisma.nextAction.findMany(nextActionQuery);

  const nextActions = nextActionsRaw.map((na: any) => ({
    id: na.id,
    action_text: na.action_text,
    wbs_node_id: na.wbs_node_id,
    target_date: na.target_date ? (na.target_date instanceof Date ? na.target_date.toISOString() : String(na.target_date)) : null,
    is_completed: na.is_completed,
    is_cancelled: na.is_cancelled,
    cancellation_reason: na.cancellation_reason,
    user_name: na.user?.full_name || null,
  }));

  // ۴. شاخص‌های مصوب پروژه
  const kpisRaw = await prisma.projectKpi.findMany({
    where: { project_id: projectId, is_active: true },
    orderBy: { sort_order: "asc" },
  });

  const kpis = kpisRaw.map((k) => ({
    id: k.id,
    name: k.name,
    unit: k.unit,
    baseline_value: k.baseline_value,
    target_value: k.target_value,
    target_direction: k.target_direction,
  }));

  // گزارش‌ها و دوره‌های مرتبط با پروژه برای نگاشت کامل معنایی
  const projectReports = await prisma.report.findMany({
    where: { project_id: projectId },
    select: {
      id: true,
      project_id: true,
      period_id: true,
      period_title: true,
      user_id: true,
      user_full_name: true,
      status: true,
      submitted_at: true,
    },
    orderBy: { period_id: "desc" },
  }).catch(() => []);

  const periodIds = Array.from(new Set(projectReports.map((r: any) => r.period_id).filter(Boolean)));
  const projectPeriods = periodIds.length > 0 && prisma.reportPeriod?.findMany
    ? await prisma.reportPeriod.findMany({
        where: { id: { in: periodIds } },
        select: {
          id: true,
          title: true,
          period_start: true,
          period_end: true,
          is_open: true,
        },
      }).catch(() => [])
    : [];

  const totalActivitiesCount = typeof prisma.reportActivity?.count === "function"
    ? await prisma.reportActivity.count({ where: { project_id: projectId } }).catch(() => activitiesRaw.length)
    : activitiesRaw.length;

  const totalNextActionsCount = typeof prisma.nextAction?.count === "function"
    ? await prisma.nextAction.count({ where: { project_id: projectId } }).catch(() => nextActionsRaw.length)
    : nextActionsRaw.length;

  // ۵. ساخت یال‌های لگاسی (Edges) با اولویت parent_id معتبر و عدم فرض انحصاری dot-notation
  const edges: StrategicGraphData["edges"] = [];
  const wbsById = new Map(wbsNodes.map((n) => [n.id, n]));
  const wbsByCode = new Map(wbsNodes.map((n) => [n.code, n]));

  for (const node of wbsNodes) {
    if (!node.active) continue;

    // ۱. اولویت نخست: والد مشخص با parent_id دیتابیس
    if (node.parent_id !== null && node.parent_id !== undefined) {
      const parentNode = wbsById.get(node.parent_id);
      if (parentNode && parentNode.active) {
        edges.push({
          id: `wbs-h-${parentNode.id}-${node.id}`,
          source: `wbs-${parentNode.id}`,
          target: `wbs-${node.id}`,
          type: "WBS_HIERARCHY",
        });
      }
    } else if (node.code.includes(".")) {
      // ۲. اولویت دوم: استنتاج از کد درختی در صورت عدم ثبت parent_id
      const parts = node.code.split(".");
      const parentCode = parts.slice(0, -1).join(".");
      const parentNode = wbsByCode.get(parentCode);
      if (parentNode && parentNode.active) {
        edges.push({
          id: `wbs-h-${parentNode.id}-${node.id}`,
          source: `wbs-${parentNode.id}`,
          target: `wbs-${node.id}`,
          type: "WBS_HIERARCHY",
        });
      }
    }

    // یال پیش‌نیاز
    if (node.prerequisite) {
      const prereqNode = wbsByCode.get(node.prerequisite.trim());
      if (prereqNode && prereqNode.active) {
        edges.push({
          id: `wbs-pre-${prereqNode.id}-${node.id}`,
          source: `wbs-${prereqNode.id}`,
          target: `wbs-${node.id}`,
          type: "PREREQUISITE",
          label: "پیش‌نیاز",
        });
      }
    }

    // یال اتصال شاخص به WBS
    for (const k of node.kpis) {
      edges.push({
        id: `kpi-wbs-${k.id}-${node.id}`,
        source: `kpi-${k.id}`,
        target: `wbs-${node.id}`,
        type: "MEASURES",
      });
    }
  }

  // یال‌های فعالیت به WBS (تنها به گره‌های فعال WBS)
  for (const act of activities) {
    if (act.wbs_node_id && wbsById.get(act.wbs_node_id)?.active) {
      edges.push({
        id: `act-wbs-${act.id}-${act.wbs_node_id}`,
        source: `act-${act.id}`,
        target: `wbs-${act.wbs_node_id}`,
        type: "EXECUTES",
        status: act.status,
      });
    }
  }

  // یال‌های اقدامات آتی به WBS (تنها به گره‌های فعال WBS)
  for (const action of nextActions) {
    if (action.wbs_node_id && wbsById.get(action.wbs_node_id)?.active) {
      edges.push({
        id: `action-wbs-${action.id}-${action.wbs_node_id}`,
        source: `action-${action.id}`,
        target: `wbs-${action.wbs_node_id}`,
        type: "TARGETS",
      });
    }
  }

  // ۶. ساخت گراف معنایی مدرن و غنی (Semantic Knowledge Graph)
  const semantic = buildSemanticGraph({
    project: {
      id: project.id,
      title: project.title,
      code: project.code,
      description: project.description,
      project_type: project.project_type,
    },
    wbsNodes: wbsRaw as any,
    activities: activitiesRaw as any,
    nextActions: nextActionsRaw as any,
    kpis: kpisRaw as any,
    reports: projectReports as any,
    periods: projectPeriods as any,
    limits: options,
    totalDbCounts: {
      wbsCount: wbsRaw.length,
      activitiesCount: totalActivitiesCount,
      nextActionsCount: totalNextActionsCount,
      kpisCount: kpisRaw.length,
      reportsCount: projectReports.length,
      periodsCount: projectPeriods.length,
    },
  });

  // آمار خلاصه وضعیت
  const autoConfirmedActivities = activities.filter((a) => a.status === "auto_confirmed").length;
  const needsReviewActivities = activities.filter((a) => a.status === "needs_review").length;
  const unmappedActivities = activities.filter((a) => a.status === "unmapped").length;

  return {
    project: {
      id: project.id,
      title: project.title,
      code: project.code,
    },
    nodes: {
      wbsNodes,
      activities,
      nextActions,
      kpis,
    },
    edges,
    stats: {
      totalWbs: wbsNodes.filter((n) => n.active).length,
      totalActivities: activities.length,
      autoConfirmedActivities,
      needsReviewActivities,
      unmappedActivities,
      totalNextActions: nextActions.length,
      totalKpis: kpis.length,
    },
    semantic,
  };
}
