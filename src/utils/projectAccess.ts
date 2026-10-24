/**
 * ماژول بررسی دسترسی کاربر به پروژه‌ها (Project Access Authorization)
 * 
 * بر اساس قوانین استاندارد سیستم:
 * ۱. مدیر (manager) و بیننده (viewer) دسترسی کامل به تمامی پروژه‌ها (فعال یا غیرفعال) دارند.
 * ۲. پرسنل عادی تنها در صورت فعال بودن پروژه و وجود تخصیص معتبر در جدول UserProject مجاز به دسترسی هستند.
 */

export interface ProjectAccessUser {
  id: number;
  role: string;
}

export interface ProjectAccessResult {
  allowed: boolean;
  status: 200 | 403 | 404;
  error?: string;
  project?: any;
}

export async function checkProjectAccess(
  prisma: any,
  user: ProjectAccessUser,
  projectId: number
): Promise<ProjectAccessResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return {
      allowed: false,
      status: 404,
      error: "پروژه یافت نشد.",
    };
  }

  // مدیر و بیننده مجاز به مشاهده کلیه پروژه‌ها (فعال یا غیرفعال) هستند
  if (user.role === "manager" || user.role === "viewer") {
    return {
      allowed: true,
      status: 200,
      project,
    };
  }

  // پرسنل عادی تنها مجاز به دسترسی به پروژه‌های فعال هستند
  if (!project.is_active) {
    return {
      allowed: false,
      status: 403,
      error: "این پروژه غیرفعال است.",
    };
  }

  // پرسنل عادی باید به این پروژه تخصیص داده شده باشند
  const allocation = await prisma.userProject.findUnique({
    where: {
      user_id_project_id: {
        user_id: user.id,
        project_id: projectId,
      },
    },
  });

  if (!allocation) {
    return {
      allowed: false,
      status: 403,
      error: "شما به این پروژه تخصیص داده نشده‌اید.",
    };
  }

  return {
    allowed: true,
    status: 200,
    project,
  };
}
