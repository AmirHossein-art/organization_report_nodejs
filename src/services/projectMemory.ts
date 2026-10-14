import type { PrismaClient } from "@prisma/client";
import { toPersianDigits } from "../dateUtils";

export interface ProjectMemoryRecord {
  id: number;
  project_id: number;
  dna_summary: string;
  chronic_bottlenecks: string;
  reliability_notes: string;
  lessons_learned: string;
  version: number;
  attributes?: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * دریافت حافظه تکاملی پروژه از پایگاه داده (زیر ۱ میلی‌ثانیه)
 */
export async function getProjectMemory(
  prisma: PrismaClient,
  projectId: number
): Promise<ProjectMemoryRecord | null> {
  try {
    const memory = await prisma.projectMemory.findUnique({
      where: { project_id: projectId },
    });
    return memory as ProjectMemoryRecord | null;
  } catch (error) {
    console.warn(`⚠️ خطا در خواندن حافظه پروژه ${projectId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * ذخیره یا به‌روزرسانی صریح حافظه تکاملی پروژه
 */
export async function saveProjectMemory(
  prisma: PrismaClient,
  projectId: number,
  data: {
    dna_summary: string;
    chronic_bottlenecks?: string;
    reliability_notes?: string;
    lessons_learned?: string;
    version?: number;
    attributes?: any;
  }
): Promise<ProjectMemoryRecord> {
  const current = await getProjectMemory(prisma, projectId);
  const nextVersion = data.version ?? (current ? current.version + 1 : 1);

  const saved = await prisma.projectMemory.upsert({
    where: { project_id: projectId },
    create: {
      project_id: projectId,
      dna_summary: data.dna_summary.trim(),
      chronic_bottlenecks: (data.chronic_bottlenecks || "").trim(),
      reliability_notes: (data.reliability_notes || "").trim(),
      lessons_learned: (data.lessons_learned || "").trim(),
      version: nextVersion,
      attributes: data.attributes ?? (current?.attributes || null),
    },
    update: {
      dna_summary: data.dna_summary.trim(),
      chronic_bottlenecks: (data.chronic_bottlenecks || "").trim(),
      reliability_notes: (data.reliability_notes || "").trim(),
      lessons_learned: (data.lessons_learned || "").trim(),
      version: nextVersion,
      attributes: data.attributes ?? undefined,
      updated_at: new Date(),
    },
  });

  return saved as ProjectMemoryRecord;
}

/**
 * تبدیل رکورد حافظه به قالب متنی جهت تزریق مستقیم به پرامپت هوش مصنوعی
 */
export function formatProjectMemoryForPrompt(memory: ProjectMemoryRecord | null | undefined): string {
  if (!memory) return "";

  const sections: string[] = [];
  if (memory.dna_summary) {
    sections.push(`- شناخت ماهیت و بافتار پروژه (DNA): ${memory.dna_summary}`);
  }
  if (memory.chronic_bottlenecks) {
    sections.push(`- گره‌های کور و موانع مزمن ثبت‌شده: ${memory.chronic_bottlenecks}`);
  }
  if (memory.reliability_notes) {
    sections.push(`- سابقه تعهدپذیری و خوش‌قولی در ددلاین‌ها: ${memory.reliability_notes}`);
  }
  if (memory.lessons_learned) {
    sections.push(`- درس‌آموخته‌ها و تجارب انباشته راهبردی: ${memory.lessons_learned}`);
  }

  if (sections.length === 0) return "";

  return `\n🧠 **حافظه تاریخی و شناخت انباشته هوش مصنوعی از این پروژه (Living Project Dossier - نسخه ${toPersianDigits(memory.version)}):**\n${sections.join("\n")}\n`;
}

/**
 * تکامل انباشته و یادگیرنده حافظه پروژه بر اساس ممیزی دوره جدید و سوابق دیتابیس
 * کاملاً ایمن، سبک و با اجرای سریع
 */
export async function evolveProjectMemory(
  prisma: PrismaClient,
  projectId: number,
  latestAudit?: any
): Promise<ProjectMemoryRecord | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        memory: true,
        nextActions: {
          select: {
            id: true,
            action_text: true,
            is_completed: true,
            is_cancelled: true,
            target_date: true,
          },
        },
      },
    });

    if (!project) return null;

    const currentMemory = project.memory;

    // ۱. استخراج شناخت هویتی و بافتاری پروژه (DNA)
    let dnaSummary = currentMemory?.dna_summary || "";
    if (!dnaSummary) {
      dnaSummary = `پروژه «${project.title}» (کد ${project.code}) با چرخه گزارش‌دهی ${
        project.project_type === "monthly" ? "ماهانه" : "هفتگی"
      }. ${project.description || "در دست پیگیری استراتژیک در حوزه مدیریت ترافیک شهر تهران."}`;
    }

    // ۲. تحلیل الگوی وفای به عهد و خوش‌قولی ددلاین‌ها بر اساس داده‌های واقعی دیتابیس
    const allActions = project.nextActions || [];
    const activeActions = allActions.filter((a) => !a.is_cancelled);
    const completedActions = activeActions.filter((a) => a.is_completed);
    const totalCount = activeActions.length;
    const now = new Date();
    const overdueCount = activeActions.filter(
      (a) => !a.is_completed && a.target_date && new Date(a.target_date) < now
    ).length;

    let reliabilityNotes = "";
    if (totalCount > 0) {
      const completionRate = Math.round((completedActions.length / totalCount) * 100);
      reliabilityNotes = `از مجموع ${totalCount} اقدام تعریف‌شده، ${completedActions.length} اقدام تکمیل شده (نرخ وفای به عهد: ${completionRate}٪) و ${overdueCount} اقدام دارای تاخیر از موعد سررسید است.`;
    } else {
      reliabilityNotes = currentMemory?.reliability_notes || "اقدام ثبت‌شده‌ای برای سنجش آماری وفای به عهد موجود نیست.";
    }

    // ۳. انباشت موانع و گره‌های مزمن (Chronic Bottlenecks)
    const existingBottlenecks = (currentMemory?.chronic_bottlenecks || "")
      .split("\n")
      .map((s) => s.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean);

    const newBottlenecks: string[] = [];
    if (latestAudit?.wbs_structural_audit?.missing_wbs_activities) {
      for (const item of latestAudit.wbs_structural_audit.missing_wbs_activities) {
        if (typeof item === "string" && item.trim()) newBottlenecks.push(`نقص ساختار WBS: ${item.trim()}`);
      }
    }
    if (latestAudit?.kpi_strategic_audit?.blind_spots) {
      for (const bs of latestAudit.kpi_strategic_audit.blind_spots) {
        if (typeof bs === "string" && bs.trim()) newBottlenecks.push(`نقطه کور پایش: ${bs.trim()}`);
      }
    }
    if (overdueCount >= 2) {
      newBottlenecks.push(`تراکم اقدامات معوق: ${overdueCount} اقدام پس از سررسید هنوز نهایی نشده‌اند.`);
    }

    const mergedBottlenecks = Array.from(new Set([...existingBottlenecks, ...newBottlenecks])).slice(-5);
    const chronicBottlenecksText = mergedBottlenecks.map((b) => `• ${b}`).join("\n");

    // ۴. انباشت درس‌آموخته‌ها و تجارب راهبردی (Lessons Learned)
    const existingLessons = (currentMemory?.lessons_learned || "")
      .split("\n")
      .map((s) => s.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean);

    const newLessons: string[] = [];
    if (latestAudit?.strategic_alignment?.alignment_analysis) {
      newLessons.push(`تجربه انطباق: ${latestAudit.strategic_alignment.alignment_analysis}`);
    }
    if (latestAudit?.recommendations && Array.isArray(latestAudit.recommendations)) {
      for (const rec of latestAudit.recommendations.slice(0, 2)) {
        if (typeof rec === "string" && rec.trim()) newLessons.push(`درس‌آموخته: ${rec.trim()}`);
      }
    }

    const mergedLessons = Array.from(new Set([...existingLessons, ...newLessons])).slice(-5);
    const lessonsLearnedText = mergedLessons.map((l) => `• ${l}`).join("\n");

    // ۵. ذخیره پایدار حافظه تکامل‌یافته
    const saved = await saveProjectMemory(prisma, projectId, {
      dna_summary: dnaSummary,
      chronic_bottlenecks: chronicBottlenecksText,
      reliability_notes: reliabilityNotes,
      lessons_learned: lessonsLearnedText,
      version: currentMemory ? currentMemory.version + 1 : 1,
      attributes: {
        last_evolved_at: new Date().toISOString(),
        total_actions_evaluated: totalCount,
        completed_actions_count: completedActions.length,
        overdue_actions_count: overdueCount,
      },
    });

    return saved;
  } catch (error) {
    console.error(`Error evolving project memory for project ${projectId}:`, error);
    return null;
  }
}
