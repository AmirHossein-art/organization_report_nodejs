# Feature Specification: Deputy-Level AI Workspace & Self-Assessment Copilot

**Feature Branch**: `feature/deputy-ai-workspace` (Deferred / Backlog)  
**Created**: 2026-10-12  
**Status**: SPECIFIED & DEFERRED (Implementation Gated)  
**Blocker / Precondition**: Full completion, verification, and deployment of Feature `strategic-semantic-network` (D33).  

---

## 1. Feature Overview & Purpose

Currently, AI evaluation endpoints (`/api/ai/strategic-analysis`, `/api/reports/analyze-deputy`) are reserved exclusively for executive management (`requireManager`) to audit submitted reports and assess departmental performance.

In the future, the organization intends to empower departmental deputies (معاونت‌ها) with a dedicated AI Copilot and self-assessment workspace. This tool will allow deputies to inspect their ongoing projects, audit draft weekly submissions before formal submission to the director, receive automated WBS alignment advice, and query project bottlenecks interactively.

**MANDATORY ARCHITECTURAL GATE**:
Implementation of this feature is strictly **BLOCKED** until the core Strategic Semantic Network (connecting Projects, WBS tasks, Activities, and KPIs) is fully constructed, tested, and operational in production. Deploying AI to departments prior to establishing structured ground truth would result in uncontrolled hallucinations, inconsistent metrics, and operational confusion.

---

## 2. Scope & Functional Boundaries (When Activated)

### 1. Role-Based Scoping & Multi-Tenant Isolation
- A deputy user can ONLY access data belonging to their assigned organizational department (`UserProject` scope).
- Complete isolation: Under no circumstances may Deputy A query or inspect reports, KPIs, internal notes, or AI audits of Deputy B.
- Managerial reviews (`manager_comment`, executive scores, confidential strategic directives) remain strictly hidden from deputy-level AI endpoints.

### 2. Pre-Submission Self-Audit (خود-ممیزی پیش از ارسال)
- When drafting a periodic report in `SubmitReport.tsx`, deputies can invoke «ممیزی اولیه پیش‌نویس»:
  - Verifies whether reported activities map to active WBS packages.
  - Warns if mandatory project KPIs are left unmeasured.
  - Checks if past-period overdue actions have been accounted for.
  - Suggests quantifiable metric improvements to replace vague qualitative text.

### 3. Conversational Departmental Assistant (پرسش و پاسخ تعاملی)
- Natural language chat scoped strictly to the deputy's projects:
  - *"کدام بسته‌های کاری پروژه‌های من در ۳ هفته گذشته پیشرفتی نداشته‌اند؟"*
  - *"آیا اقدام آتی تعریف‌شده برای فاز ۲ با ددلاین WBS همخوانی دارد؟"*
  - *"خلاصه‌ای از مهم‌ترین ریسک‌های ثبت‌شده در پروژه‌های ترافیکی من چیست؟"*

---

## 3. Deferred Tasks & Verification Criteria

| Task ID | Component | Description | Status |
| :--- | :--- | :--- | :--- |
| **DEP-AI-01** | Architecture Gating | Enforce feature flag `ENABLE_DEPUTY_AI = false` until Core Semantic Network is ratified. | **GATED** |
| **DEP-AI-02** | Security & RBAC | Implement `/api/ai/deputy-copilot` with strict BOLA/IDOR filtering scoped to `req.user.id`. | Deferred |
| **DEP-AI-03** | UI Integration | Add interactive "دستیار هوشمند معاونت" drawer in `SubmitReport.tsx` and `MyReports.tsx`. | Deferred |
| **DEP-AI-04** | Prompt Grounding | Restrict prompts strictly to deputy's WBS sub-trees and active KPI records. | Deferred |
