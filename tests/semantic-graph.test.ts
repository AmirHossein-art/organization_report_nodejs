import test from 'node:test';
import assert from 'node:assert/strict';

test('buildSemanticGraph creates project and active WBS nodes using persisted parent_id', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = {
    id: 10,
    title: 'طرح ساماندهی پایانه‌های مسافربری',
    code: 'PRJ-10',
    description: 'ساماندهی هوشمند پایانه‌های مسافربری شهرداری تهران',
    project_type: 'weekly',
  };

  // Note: explicit persisted parent_id, arbitrary code format (not dot-notation)
  const rawWbsNodes = [
    {
      id: 101,
      project_id: 10,
      parent_id: null,
      code: 'PHASE-ALPHA',
      title: 'فاز اول شناخت وضعیت موجود',
      level: 1,
      node_type: 'phase',
      deliverable_text: 'گزارش ارزیابی پایانه‌ها',
      responsible: 'معاونت فنی',
      prerequisite: null,
      sort_order: 1,
      attributes: { active: true },
    },
    {
      id: 102,
      project_id: 10,
      parent_id: 101, // persisted parent_id
      code: 'TASK-X99', // Non-dot code!
      title: 'نقشه‌برداری پایانه غرب',
      level: 2,
      node_type: 'work_package',
      deliverable_text: 'نقشه وضع موجود CAD',
      responsible: 'مهندسین مشاور',
      prerequisite: null,
      sort_order: 2,
      attributes: { active: true },
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: [],
    nextActions: [],
    kpis: [],
    reports: [],
    periods: [],
  });

  assert.equal(graph.version, 1);
  assert.equal(graph.projectId, 10);

  // Nodes check
  const projectNode = graph.nodes.find((n) => n.id === 'project-10');
  assert.ok(projectNode, 'Project node must exist with id project-10');
  assert.equal(projectNode.kind, 'project');
  assert.equal(projectNode.label, 'طرح ساماندهی پایانه‌های مسافربری');
  assert.equal(projectNode.provenance.source, 'Project');
  assert.equal(projectNode.provenance.recordId, 10);

  const parentWbsNode = graph.nodes.find((n) => n.id === 'wbs-101');
  const childWbsNode = graph.nodes.find((n) => n.id === 'wbs-102');
  assert.ok(parentWbsNode, 'WBS 101 node must exist');
  assert.ok(childWbsNode, 'WBS 102 node must exist');
  assert.equal(parentWbsNode.kind, 'wbs');
  assert.equal(childWbsNode.kind, 'wbs');
  assert.equal(childWbsNode.code, 'TASK-X99');

  // Hierarchy edge must exist based on parent_id 101 -> 102
  const hierarchyEdge = graph.edges.find(
    (e) => e.source === 'wbs-101' && e.target === 'wbs-102'
  );
  assert.ok(hierarchyEdge, 'Hierarchy edge must link wbs-101 to wbs-102 via persisted parent_id');
  assert.equal(hierarchyEdge.type, 'WBS_HIERARCHY');
  assert.equal(hierarchyEdge.epistemic, 'reference');

  // Root WBS node connected to project
  const projectContainsEdge = graph.edges.find(
    (e) => e.source === 'project-10' && e.target === 'wbs-101'
  );
  assert.ok(projectContainsEdge, 'Project must contain root WBS node wbs-101');
  assert.equal(projectContainsEdge.type, 'CONTAINS_WBS');
  assert.equal(projectContainsEdge.epistemic, 'reference');
});

test('archive isolation: archived WBS nodes are excluded from active nodes and dangling edges are prevented', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 20, title: 'پروژه تست آرشیو', code: 'PRJ-20' };

  const rawWbsNodes = [
    {
      id: 201,
      project_id: 20,
      parent_id: null,
      code: '1',
      title: 'بسته کاری فعال',
      attributes: { active: true },
    },
    {
      id: 202,
      project_id: 20,
      parent_id: 201,
      code: '1.1',
      title: 'بسته کاری حذف/آرشیو شده',
      attributes: { active: false }, // ARCHIVED!
    },
    {
      id: 203,
      project_id: 20,
      parent_id: 202, // Child of archived node!
      code: '1.1.1',
      title: 'بسته کاری فعال با والد آرشیوشده',
      attributes: { active: true },
    },
  ];

  const rawActivities = [
    {
      id: 501,
      project_id: 20,
      report_id: 99,
      line_number: 1,
      activity_text: 'فعالیت متصل به نود آرشیو شده',
      wbs_node_id: 202, // pointing to archived WBS
      confidence: 0.9,
      status: 'auto_confirmed',
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: rawActivities,
    nextActions: [],
    kpis: [],
  });

  // 1. Archived WBS node 202 must NOT exist in nodes
  assert.equal(graph.nodes.some((n) => n.id === 'wbs-202'), false, 'Archived node 202 must not be in active nodes');
  assert.ok(graph.nodes.some((n) => n.id === 'wbs-201'), 'Active node 201 must be in nodes');
  assert.ok(graph.nodes.some((n) => n.id === 'wbs-203'), 'Active node 203 must be in nodes');

  // 2. No edge may target or source from wbs-202
  const danglingEdge = graph.edges.find((e) => e.source === 'wbs-202' || e.target === 'wbs-202');
  assert.equal(danglingEdge, undefined, 'No dangling edge touching wbs-202 is allowed');

  // 3. Gap must be recorded for child pointing to archived parent
  const parentArchivedGap = graph.coverage.gaps.find(
    (g) => g.entityId === 203 && g.kind === 'archived_wbs_reference'
  );
  assert.ok(parentArchivedGap, 'Gap must be recorded for node 203 referencing archived parent 202');

  // 4. Gap must be recorded for activity pointing to archived node, not claiming scope creep
  const activityArchivedGap = graph.coverage.gaps.find(
    (g) => g.entityId === 501 && g.kind === 'archived_wbs_reference'
  );
  assert.ok(activityArchivedGap, 'Gap must record activity referencing archived WBS node');

  // Coverage counts
  assert.equal(graph.coverage.activeWbsCount, 2);
  assert.equal(graph.coverage.archivedWbsCount, 1);
});

test('prerequisites: exact unambiguous code creates reference edge; raw text/missing code becomes gap; cycles non-hanging', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 30, title: 'پروژه پیش‌نیازها', code: 'PRJ-30' };

  const rawWbsNodes = [
    {
      id: 301,
      project_id: 30,
      code: 'WP-1',
      title: 'بسته کاری پایه',
      attributes: { active: true },
    },
    {
      id: 302,
      project_id: 30,
      code: 'WP-2',
      title: 'بسته کاری وابسته به بسته ۱',
      prerequisite: 'WP-1', // Exact unambiguous active code
      attributes: { active: true },
    },
    {
      id: 303,
      project_id: 30,
      code: 'WP-3',
      title: 'بسته کاری با متن آزاد غیرکد',
      prerequisite: 'پس از اخذ مجوز شورای ترافیک', // Raw descriptive text, not active code
      attributes: { active: true },
    },
    {
      id: 304,
      project_id: 30,
      code: 'WP-4',
      title: 'بسته کاری با پیش‌نیاز به گره ۵',
      prerequisite: 'WP-5',
      attributes: { active: true },
    },
    {
      id: 305,
      project_id: 30,
      code: 'WP-5',
      title: 'بسته کاری ۵ با پیش‌نیاز حلقوی به گره ۴',
      prerequisite: 'WP-4', // Cycle WP-4 <-> WP-5!
      attributes: { active: true },
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: [],
    nextActions: [],
    kpis: [],
  });

  // 1. Valid exact code WP-1 -> WP-2 must create prerequisite edge
  const validPrereqEdge = graph.edges.find(
    (e) => e.source === 'wbs-301' && e.target === 'wbs-302' && e.type === 'PREREQUISITE'
  );
  assert.ok(validPrereqEdge, 'Exact code prerequisite edge from WP-1 (301) to WP-2 (302) must exist');
  assert.equal(validPrereqEdge.epistemic, 'reference');

  // 2. Raw descriptive text must NOT create edge; must record gap
  const rawTextEdge = graph.edges.find((e) => e.target === 'wbs-303' && e.type === 'PREREQUISITE');
  assert.equal(rawTextEdge, undefined, 'No prerequisite edge for raw text prerequisite');

  const rawTextGap = graph.coverage.gaps.find(
    (g) => g.entityId === 303 && g.kind === 'unresolved_prerequisite'
  );
  assert.ok(rawTextGap, 'Gap must record unresolved raw text prerequisite');
  assert.equal(rawTextGap.rawReference, 'پس از اخذ مجوز شورای ترافیک');

  // 3. Cycles must not hang or throw, edges created safely
  const cycleEdge4to5 = graph.edges.find((e) => e.source === 'wbs-304' && e.target === 'wbs-305');
  const cycleEdge5to4 = graph.edges.find((e) => e.source === 'wbs-305' && e.target === 'wbs-304');
  assert.ok(cycleEdge4to5 || cycleEdge5to4, 'At least one prerequisite edge exists without hanging');
});

test('KPI links: only approved same-project active KPIs emit MEASURES edges; inactive/foreign flagged in gaps', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 40, title: 'پروژه شاخص‌ها', code: 'PRJ-40' };

  const rawKpis = [
    {
      id: 401,
      project_id: 40,
      name: 'درصد پیشرفت فیزیکی پایانه',
      unit: 'درصد',
      target_value: 100,
      baseline_value: 0,
      target_direction: 'minimum',
      is_active: true, // APPROVED ACTIVE
    },
    {
      id: 402,
      project_id: 40,
      name: 'شاخص غیرفعال / منسوخ',
      unit: 'عدد',
      target_value: 50,
      is_active: false, // INACTIVE
    },
    {
      id: 999,
      project_id: 999, // FOREIGN PROJECT KPI!
      name: 'شاخص پروژه دیگر',
      unit: 'مورد',
      is_active: true,
    },
  ];

  const rawWbsNodes = [
    {
      id: 410,
      project_id: 40,
      code: 'WBS-KPI-1',
      title: 'بسته کاری متصل به شاخص‌ها',
      attributes: { active: true },
      kpiLinks: [
        { kpi: rawKpis[0] }, // Active same-project KPI
        { kpi: rawKpis[1] }, // Inactive KPI
        { kpi: rawKpis[2] }, // Foreign KPI
      ],
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: [],
    nextActions: [],
    kpis: rawKpis,
  });

  // 1. KPI nodes created only for active same-project KPI (or active flag)
  const activeKpiNode = graph.nodes.find((n) => n.id === 'kpi-401');
  assert.ok(activeKpiNode, 'Active KPI 401 node must exist');
  assert.equal(activeKpiNode.kind, 'kpi');
  assert.equal(activeKpiNode.provenance.source, 'ProjectKpi');

  // 2. MEASURES edge must link kpi-401 to wbs-410
  const validMeasureEdge = graph.edges.find(
    (e) => e.source === 'kpi-401' && e.target === 'wbs-410' && e.type === 'MEASURES'
  );
  assert.ok(validMeasureEdge, 'Valid MEASURES edge must exist for active same-project KPI');
  assert.equal(validMeasureEdge.epistemic, 'reference');

  // 3. No MEASURES edge for inactive KPI 402 or foreign KPI 999
  const inactiveMeasureEdge = graph.edges.find((e) => e.source === 'kpi-402');
  const foreignMeasureEdge = graph.edges.find((e) => e.source === 'kpi-999');
  assert.equal(inactiveMeasureEdge, undefined, 'Inactive KPI must not emit MEASURES edge');
  assert.equal(foreignMeasureEdge, undefined, 'Foreign KPI must not emit MEASURES edge');

  // 4. Gaps recorded
  const foreignGap = graph.coverage.gaps.find(
    (g) => g.kind === 'foreign_or_inactive_kpi' && g.entityId === 999
  );
  assert.ok(foreignGap, 'Foreign KPI link must be recorded in gaps');
});

test('activities, reports & periods: epistemic statuses (human_confirmed, ai_confirmed, ai_proposed), report/period nodes and provenance', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 50, title: 'پروژه ارزیابی فعالیت‌ها', code: 'PRJ-50' };

  const rawWbsNodes = [
    {
      id: 501,
      project_id: 50,
      code: 'WBS-1',
      title: 'بسته کاری اصلی',
      attributes: { active: true },
    },
  ];

  const rawPeriods = [
    {
      id: 70,
      title: 'هفته اول اردیبهشت ۱۴۰۵',
      is_open: false,
    },
  ];

  const rawReports = [
    {
      id: 801,
      project_id: 50,
      period_id: 70,
      period_title: 'هفته اول اردیبهشت ۱۴۰۵',
      user_id: 5,
      user_full_name: 'مهندس رضایی',
      status: 'submitted',
    },
  ];

  const rawActivities = [
    {
      id: 601,
      project_id: 50,
      report_id: 801,
      line_number: 1,
      activity_text: 'تکمیل نقشه‌های اجرایی',
      wbs_node_id: 501,
      confidence: 0.95,
      status: 'auto_confirmed', // ai_confirmed
    },
    {
      id: 602,
      project_id: 50,
      report_id: 801,
      line_number: 2,
      activity_text: 'جلسه هماهنگی مشاوران',
      wbs_node_id: 501,
      confidence: 0.65,
      status: 'needs_review', // ai_proposed
    },
    {
      id: 603,
      project_id: 50,
      report_id: 801,
      line_number: 3,
      activity_text: 'تایید نهایی توسط مدیر',
      wbs_node_id: 501,
      confidence: 0.70,
      status: 'confirmed', // human_confirmed
    },
    {
      id: 604,
      project_id: 50,
      report_id: 801,
      line_number: 4,
      activity_text: 'اقدام متفرقه بدون بسته کاری',
      wbs_node_id: null,
      confidence: null,
      status: 'unmapped', // unmapped
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: rawActivities,
    nextActions: [],
    kpis: [],
    reports: rawReports,
    periods: rawPeriods,
  });

  // 1. Report and Period nodes exist
  const periodNode = graph.nodes.find((n) => n.id === 'period-70');
  const reportNode = graph.nodes.find((n) => n.id === 'report-801');
  assert.ok(periodNode, 'Period node period-70 must exist');
  assert.ok(reportNode, 'Report node report-801 must exist');
  assert.equal(periodNode.kind, 'period');
  assert.equal(reportNode.kind, 'report');
  assert.equal(reportNode.provenance.source, 'Report');

  // 2. Report connects to Period
  const reportPeriodEdge = graph.edges.find(
    (e) => e.source === 'report-801' && e.target === 'period-70' && e.type === 'SUBMITTED_IN'
  );
  assert.ok(reportPeriodEdge, 'Report must be connected to Period via SUBMITTED_IN');
  assert.equal(reportPeriodEdge.epistemic, 'reference');

  // 3. Activity connects to Report
  const actReportEdge = graph.edges.find(
    (e) => e.source === 'act-601' && e.target === 'report-801' && e.type === 'REPORTED_IN'
  );
  assert.ok(actReportEdge, 'Activity 601 must connect to Report 801 via REPORTED_IN');
  assert.equal(actReportEdge.epistemic, 'reported');

  // 4. Epistemic distinctions on activity-WBS edges
  const edge601 = graph.edges.find((e) => e.id === 'act-wbs-601-501');
  const edge602 = graph.edges.find((e) => e.id === 'act-wbs-602-501');
  const edge603 = graph.edges.find((e) => e.id === 'act-wbs-603-501');
  const wbsEdge604 = graph.edges.find((e) => e.source === 'act-604' && e.type === 'EXECUTES');

  assert.ok(edge601);
  assert.equal(edge601.epistemic, 'ai_confirmed', 'auto_confirmed status yields ai_confirmed epistemic');
  assert.equal(edge601.confidence, 0.95);

  assert.ok(edge602);
  assert.equal(edge602.epistemic, 'ai_proposed', 'needs_review yields ai_proposed epistemic');
  assert.equal(edge602.confidence, 0.65);

  assert.ok(edge603);
  assert.equal(edge603.epistemic, 'human_confirmed', 'confirmed yields human_confirmed epistemic');

  assert.equal(wbsEdge604, undefined, 'Unmapped activity 604 must NOT have WBS edge');

  // 5. Unmapped gap recorded
  const unmappedGap = graph.coverage.gaps.find(
    (g) => g.entityId === 604 && g.kind === 'unmapped_activity'
  );
  assert.ok(unmappedGap, 'Unmapped activity must be recorded in gaps');
});

test('next actions lifecycle: completed, cancelled, pending states, WBS targeting and report links', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 60, title: 'پروژه تست اقدامات آتی', code: 'PRJ-60' };

  const rawWbsNodes = [
    {
      id: 610,
      project_id: 60,
      code: 'WBS-ACT-1',
      title: 'بسته کاری اجرایی',
      attributes: { active: true },
    },
    {
      id: 611,
      project_id: 60,
      code: 'WBS-ARCHIVED',
      title: 'بسته کاری بایگانی شده',
      attributes: { active: false },
    },
  ];

  const rawNextActions = [
    {
      id: 701,
      project_id: 60,
      report_id: 88,
      action_text: 'تکمیل خرید ترانسفورماتور برق',
      wbs_node_id: 610,
      target_date: '2026-11-01',
      is_completed: true,
      is_cancelled: false,
      user_name: 'مهندس کاظمی',
    },
    {
      id: 702,
      project_id: 60,
      action_text: 'مذاکره با پیمانکار منسوخ',
      wbs_node_id: 611, // points to archived WBS!
      is_completed: false,
      is_cancelled: true,
      cancellation_reason: 'پیمانکار در مناقصه رد صلاحیت شد',
      user_name: 'مهندس محمدی',
    },
    {
      id: 703,
      project_id: 60,
      action_text: 'بررسی مجوزهای شهرداری منطقه',
      wbs_node_id: null,
      is_completed: false,
      is_cancelled: false,
      user_name: null,
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: [],
    nextActions: rawNextActions,
    kpis: [],
  });

  // 1. Action nodes created with correct lifecycle statuses
  const action701 = graph.nodes.find((n) => n.id === 'action-701');
  const action702 = graph.nodes.find((n) => n.id === 'action-702');
  const action703 = graph.nodes.find((n) => n.id === 'action-703');

  assert.ok(action701);
  assert.equal(action701.kind, 'action');
  assert.equal(action701.status, 'completed');
  assert.equal(action701.details.is_completed, true);
  assert.equal(action701.details.user_name, 'مهندس کاظمی');

  assert.ok(action702);
  assert.equal(action702.status, 'cancelled');
  assert.equal(action702.details.is_cancelled, true);
  assert.equal(action702.details.cancellation_reason, 'پیمانکار در مناقصه رد صلاحیت شد');

  assert.ok(action703);
  assert.equal(action703.status, 'pending');

  // 2. TARGETS edge to active WBS 610
  const actionWbsEdge = graph.edges.find(
    (e) => e.source === 'action-701' && e.target === 'wbs-610' && e.type === 'TARGETS'
  );
  assert.ok(actionWbsEdge, 'Action 701 must target active WBS 610');
  assert.equal(actionWbsEdge.epistemic, 'reported');

  // 3. No edge to archived WBS 611; gap recorded instead
  const archivedActionEdge = graph.edges.find((e) => e.source === 'action-702' && e.target === 'wbs-611');
  assert.equal(archivedActionEdge, undefined, 'Action must not link to archived WBS');

  const actionGap = graph.coverage.gaps.find(
    (g) => g.entityId === 702 && g.kind === 'archived_wbs_reference'
  );
  assert.ok(actionGap, 'Action referencing archived WBS must be recorded in gaps');
});

test('coverage & truncation: deterministic tracking of DB counts, omissions and truncation flags', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 70, title: 'پروژه تست پوشش', code: 'PRJ-70' };

  // Suppose DB has 150 activities, but only 100 are loaded
  const rawActivities = Array.from({ length: 100 }, (_, i) => ({
    id: 1000 + i,
    project_id: 70,
    report_id: 50,
    line_number: i + 1,
    activity_text: `فعالیت آزمایشی شماره ${i + 1}`,
    wbs_node_id: null,
    status: 'unmapped',
  }));

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: [],
    activities: rawActivities,
    nextActions: [],
    kpis: [],
    totalDbCounts: {
      activitiesCount: 150, // 150 in DB vs 100 loaded!
      nextActionsCount: 20,
    },
  });

  assert.equal(graph.coverage.totalActivitiesInDb, 150);
  assert.equal(graph.coverage.includedActivitiesCount, 100);
  assert.equal(graph.coverage.isTruncated, true, 'isTruncated must be true when DB has more activities than included');
  assert.equal(graph.coverage.truncatedDetails?.activitiesOmitted, 50);
});

test('formatSemanticGraphForPrompt: produces epistemically grounded Persian prompt with status/provenance distinctions and guardrails', async () => {
  const { buildSemanticGraph, formatSemanticGraphForPrompt } = await import('../src/semantic/strategicGraph');

  const rawProject = {
    id: 80,
    title: 'پروژه پایانه جدید شرق',
    code: 'PRJ-EAST',
    description: 'تکمیل ابنیه و تأسیسات پایانه شرق',
    project_type: 'weekly',
  };

  const rawWbsNodes = [
    {
      id: 801,
      project_id: 80,
      code: '1.1',
      title: 'محوطه‌سازی و آسفالت',
      level: 2,
      deliverable_text: 'سطح آسفالت ۱۰ هزار مترمربع',
      responsible: 'معاونت فنی',
      prerequisite: '1.0',
      attributes: { active: true },
    },
  ];

  const rawActivities = [
    {
      id: 901,
      project_id: 80,
      report_id: 110,
      line_number: 1,
      activity_text: 'آسفالت‌ریزی رمپ ورودی پایانه',
      wbs_node_id: 801,
      confidence: 0.92,
      status: 'auto_confirmed',
    },
    {
      id: 902,
      project_id: 80,
      report_id: 110,
      line_number: 2,
      activity_text: 'خرید مصالح متفرقه',
      wbs_node_id: null,
      confidence: null,
      status: 'unmapped',
    },
  ];

  const rawNextActions = [
    {
      id: 950,
      project_id: 80,
      action_text: 'تست سیستم روشنایی محوطه',
      is_completed: false,
      is_cancelled: false,
    },
    {
      id: 951,
      project_id: 80,
      action_text: 'احداث دیوار موقت جنوبی',
      is_completed: false,
      is_cancelled: true,
      cancellation_reason: 'تغییر نقشه مصوب شهرداری',
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: rawActivities,
    nextActions: rawNextActions,
    kpis: [],
    totalDbCounts: {
      activitiesCount: 15,
      nextActionsCount: 2,
    },
  });

  const promptText = formatSemanticGraphForPrompt(graph);

  // Assertions on the prompt output
  assert.ok(promptText.includes('پروژه پایانه جدید شرق'), 'Must include project title');
  assert.ok(promptText.includes('1.1'), 'Must include WBS code');
  assert.ok(promptText.includes('آسفالت‌ریزی رمپ ورودی'), 'Must include activity text');
  assert.ok(promptText.includes('تغییر نقشه مصوب شهرداری'), 'Must include cancellation reason');

  // Epistemic guardrail checks:
  assert.ok(
    promptText.includes('عدم وجود گزارش یا فعالیت ثبت‌شده، اثبات انجام نشدن کار نیست') ||
    promptText.includes('عدم ثبت فعالیت به منزله عدم انجام کار نیست'),
    'Must include absence of evidence guardrail'
  );
  assert.ok(
    promptText.includes('خروج قطعی از محدوده') || promptText.includes('انحراف قطعی'),
    'Must include unmapped activity nuance (not automatic scope creep)'
  );
  assert.ok(
    promptText.includes('تکمیل گزارش‌شده') || promptText.includes('پذیرش قطعی تحویل‌دادنی'),
    'Must include reported completion vs deliverable acceptance guardrail'
  );
});

test('getProjectStrategicGraph: provides additive semantic property while preserving legacy payload structure', async () => {
  const { getProjectStrategicGraph } = await import('../src/services/activityGraphService');

  const mockPrisma: any = {
    project: {
      findUnique: async () => ({
        id: 90,
        title: 'پروژه تست یکپارچگی سرویس',
        code: 'PRJ-SVC',
      }),
    },
    wbsNode: {
      findMany: async () => [
        {
          id: 901,
          project_id: 90,
          parent_id: null,
          code: 'PH-1',
          title: 'فاز اول',
          level: 1,
          node_type: 'phase',
          deliverable_text: 'گزارش فاز',
          responsible: 'واحد فنی',
          prerequisite: null,
          sort_order: 1,
          attributes: { active: true },
          kpiLinks: [],
        },
        {
          id: 902,
          project_id: 90,
          parent_id: 901, // persisted parent_id
          code: 'WP-1',
          title: 'بسته کاری زیرمجموعه',
          level: 2,
          node_type: 'work_package',
          deliverable_text: 'نقشه‌ها',
          responsible: 'پیمانکار',
          prerequisite: null,
          sort_order: 2,
          attributes: { active: true },
          kpiLinks: [],
        },
      ],
      count: async () => 2,
    },
    reportActivity: {
      findMany: async () => [
        {
          id: 910,
          project_id: 90,
          report_id: 500,
          line_number: 1,
          activity_text: 'شروع عملیات خاکبرداری',
          wbs_node_id: 902,
          confidence: 0.90,
          status: 'auto_confirmed',
          ai_reasoning: 'تطبیق با بسته کاری WP-1',
          audit_feedback: 'تایید شد',
          created_at: new Date('2026-10-24'),
          report: {
            period_title: 'هفته اول مهر',
            period_id: 12,
            submitted_at: new Date('2026-10-24'),
          },
        },
      ],
      count: async () => 1,
    },
    nextAction: {
      findMany: async () => [
        {
          id: 920,
          project_id: 90,
          action_text: 'تکمیل مناقصه مرحله دوم',
          wbs_node_id: 902,
          target_date: new Date('2026-11-01'),
          is_completed: false,
          is_cancelled: false,
          user: { full_name: 'مهندس احمدی' },
        },
      ],
      count: async () => 1,
    },
    projectKpi: {
      findMany: async () => [
        {
          id: 930,
          project_id: 90,
          name: 'پیشرفت خاکی',
          unit: 'متر مکعب',
          baseline_value: 0,
          target_value: 5000,
          target_direction: 'minimum',
          is_active: true,
          sort_order: 1,
        },
      ],
      count: async () => 1,
    },
    report: {
      findMany: async () => [
        {
          id: 500,
          project_id: 90,
          period_id: 12,
          period_title: 'هفته اول مهر',
          submitted_at: new Date('2026-10-24'),
        },
      ],
      count: async () => 1,
    },
    reportPeriod: {
      findMany: async () => [
        {
          id: 12,
          title: 'هفته اول مهر',
          is_open: true,
        },
      ],
      count: async () => 1,
    },
  };

  const result = await getProjectStrategicGraph(mockPrisma, 90);
  assert.ok(result, 'Result must not be null');

  // Legacy contract preservation
  assert.ok(result.project, 'Legacy project property preserved');
  assert.ok(result.nodes.wbsNodes, 'Legacy nodes.wbsNodes preserved');
  assert.ok(result.nodes.activities, 'Legacy nodes.activities preserved');
  assert.ok(result.nodes.nextActions, 'Legacy nodes.nextActions preserved');
  assert.ok(result.nodes.kpis, 'Legacy nodes.kpis preserved');
  assert.ok(result.edges, 'Legacy edges preserved');
  assert.ok(result.stats, 'Legacy stats preserved');

  // New additive semantic contract
  assert.ok(result.semantic, 'Additive semantic property must be defined on result');
  assert.equal(result.semantic.version, 1);
  assert.equal(result.semantic.projectId, 90);
  assert.ok(result.semantic.nodes.length >= 4, 'Semantic nodes include project, wbs, activity, action');
  assert.ok(result.semantic.coverage, 'Coverage must be populated');
  assert.equal(result.semantic.coverage.isTruncated, false);
});

test('disputed proposed edges vs confirmed edges: human override, ai proposed and non-existent WBS links', async () => {
  const { buildSemanticGraph } = await import('../src/semantic/strategicGraph');

  const rawProject = { id: 95, title: 'پروژه تست ممیزی پیوندها', code: 'PRJ-AUDIT' };

  const rawWbsNodes = [
    {
      id: 951,
      project_id: 95,
      code: '1.1',
      title: 'بسته کاری اصلی',
      attributes: { active: true },
    },
  ];

  const rawActivities = [
    {
      id: 961,
      project_id: 95,
      report_id: 10,
      line_number: 1,
      activity_text: 'فعالیت با پیشنهاد مشکوک هوش مصنوعی',
      wbs_node_id: 951,
      confidence: 0.55,
      status: 'needs_review', // Disputed candidate
    },
    {
      id: 962,
      project_id: 95,
      report_id: 10,
      line_number: 2,
      activity_text: 'فعالیت اصلاح و بازنویسی‌شده توسط مدیر',
      wbs_node_id: 951,
      confidence: 0.60,
      status: 'overridden', // Human overridden
      confirmed_by: 3,
    },
    {
      id: 963,
      project_id: 95,
      report_id: 10,
      line_number: 3,
      activity_text: 'فعالیت متصل به بسته کاری ناموجود',
      wbs_node_id: 88888, // Non-existent!
      confidence: 0.80,
      status: 'needs_review',
    },
  ];

  const graph = buildSemanticGraph({
    project: rawProject,
    wbsNodes: rawWbsNodes,
    activities: rawActivities,
    nextActions: [],
    kpis: [],
  });

  // 1. Disputed proposal has ai_proposed epistemic
  const edge961 = graph.edges.find((e) => e.source === 'act-961' && e.type === 'EXECUTES');
  assert.ok(edge961);
  assert.equal(edge961.epistemic, 'ai_proposed');

  // 2. Overridden has human_confirmed epistemic
  const edge962 = graph.edges.find((e) => e.source === 'act-962' && e.type === 'EXECUTES');
  assert.ok(edge962);
  assert.equal(edge962.epistemic, 'human_confirmed');

  // 3. Non-existent WBS target has NO edge and is recorded as missing link gap
  const edge963 = graph.edges.find((e) => e.source === 'act-963' && e.type === 'EXECUTES');
  assert.equal(edge963, undefined, 'Must not emit edge to non-existent WBS');

  const missingGap = graph.coverage.gaps.find(
    (g) => g.entityId === 963 && g.kind === 'missing_wbs_reference'
  );
  assert.ok(missingGap, 'Missing WBS link must be recorded as missing_wbs_reference gap');
  assert.equal(missingGap.rawReference, '88888');
});
