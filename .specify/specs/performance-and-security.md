# Feature Specification: Daily Performance & Security Engineering Strategy

**Feature Branch**: `main`  
**Created**: 2026-10-12  
**Status**: Active Architecture & Operational Playbook  
**Decisions Covered**: D34  

---

## 1. Context & Operational Objectives

The Tehran Traffic Organization reporting system serves executive leadership, departmental deputies, and operational staff. To ensure high availability, instant interactive responsiveness, and bulletproof data integrity, we establish a **Daily Performance & Security Protocol**.

This specification evaluates infrastructural scaling strategies (Docker multi-container, clustering, worker threads), database optimizations, response caching, asynchronous processing, and security hardening, accompanied by a daily measurement framework.

---

## 2. Infrastructure & Scaling Strategies: Deep Comparative Analysis

### Strategy A: Docker Multi-Container Horizontal Scaling (کانتینرهای موازی پشت لودبالانسر)
- **Concept**: Deploying 2 or more isolated Docker container replicas of the Express backend behind a Railway or Nginx HTTP load balancer.
- **Pros (مزایا)**:
  - High Availability (HA): If one container encounters an unhandled exception or crash, traffic shifts seamlessly to healthy replicas.
  - Zero-downtime rolling deploys.
- **Cons & Project-Specific Bottlenecks (معایب و چالش‌های پروژه)**:
  - **Shared Storage Dilemma**: Uploaded WBS files and report attachments currently live on local disk (`uploads/wbs/`, `uploads/`). Replicas cannot access files uploaded to other containers without network-mounted Shared Volumes (NFS / Railway Shared Volumes) or migrating to Object Storage (S3/MinIO).
  - **In-Memory Cache Desynchronization**: Currently, AI responses are cached in server RAM (`Map`). Multi-container deployment fragments this cache, resulting in duplicate expensive AI calls unless a shared cache (Postgres/Redis) is established.
  - **Overhead vs Reality**: With 10–15 concurrent organizational users, the Node.js event loop is virtually idle (CPU utilization < 3%). Concurrency bottlenecks in this system do NOT stem from HTTP connection saturation; they stem from long-running AI API calls (15–45s) and unoptimized client refetches.
- **Verdict**: Premature and counterproductive for raw speed until durable caching and shared file storage are built.

---

### Strategy B: Node.js Multi-Core Clustering (PM2 / Node.js Cluster Module)
- **Concept**: Spawning multiple worker processes on the host/container to utilize all CPU cores while sharing the single server port.
- **Pros (مزایا)**:
  - CPU-intensive tasks (such as parsing heavy 5-sheet Excel workbooks with `xlsx` or computing complex composite KPI formulas) do not block the event loop for other users.
  - Zero cloud infrastructure cost increase on Railway.
  - Automatic worker restart on crash.
- **Cons (معایب)**:
  - Multiplies RAM usage (~100MB per worker process).
  - In-memory state remains unshared between workers.
- **Verdict**: Highly beneficial once persistent caching is placed in PostgreSQL.

---

### Strategy C: PostgreSQL-Native Asynchronous Job Queuing (`pg-boss`)
- **Concept**: Decouple synchronous long-running operations (AI audits, multi-period exports, heavy Excel processing) from the Express HTTP cycle using Postgres `FOR UPDATE SKIP LOCKED`.
- **Pros (مزایا)**:
  - **Instant User Response (<100ms)**: When clicking "تحلیل هوش مصنوعی", the API immediately returns `{ job_id, status: "queued" }`. The frontend displays progress feedback while polling or receiving SSE updates.
  - Eliminates server timeouts (HTTP 504 / 502) and browser connection resets.
  - Prevents AI multi-click choke and quota exhaustion without third-party Redis infrastructure.
- **Cons (معایب)**:
  - Requires frontend progress polling / state management updates.
- **Verdict**: **Highest-impact performance boost for the project.**

---

### Strategy D: Durable Multi-Tier Caching (PostgreSQL `AiAnalysisCache` + HTTP Cache-Control)
- **Concept**: Persist expensive AI strategic audits, WBS parsed trees, and historical period metrics in Postgres tables with TTLs, paired with HTTP `ETag` and `Cache-Control` for static metadata (active project lists, open periods).
- **Pros (مزایا)**:
  - Sub-millisecond responses for previously analyzed periods.
  - Survives Railway redeployments and container restarts.
  - Slashes client data transfer by >80%.
- **Verdict**: **Mandatory for immediate implementation.**

---

## 3. Daily Security Hardening Framework

| Security Vector | Implementation Mechanism | Daily Verification Gate |
| :--- | :--- | :--- |
| **HTTP Hardening** | `helmet` middleware (CSP, HSTS, X-Content-Type-Options, X-Frame-Options) | Automated header check via `curl -I` |
| **BOLA / IDOR Defense** | Strict scoping on all `/api/reports/:id`, `/api/next-actions/:id` by role & user ID | Automated permission matrix test |
| **Brute-Force & DoS** | Tiered `express-rate-limit`: Auth (5 req/min), Uploads (10 req/min), API (120 req/min) | Rate limit trigger verification |
| **Input Sanitization** | Server-side validation via strict schemas; HTML sanitization of report text | Null byte & SQL/XSS payload fuzzing |
| **Dependency Auditing** | `npm audit --production` in CI/CD pipeline | Zero critical/high vulnerability threshold |
| **File Upload Safety** | MIME magic-byte verification, filename sanitization, disk size limits | Malformed extension & traversal checks |

---

## 4. Daily Tracking & Telemetry Metrics

Tracked in Spec Kit and Obsidian on a daily basis:
1. **API Latency P95**: Target < 250ms for operational endpoints (`GET /api/reports`, `GET /api/projects`).
2. **AI Analysis Turnaround**: Sync job kickoff < 100ms; background job completion < 25s.
3. **Database Connection Health**: Active pool connections < 15; zero leak warnings.
4. **Memory Footprint**: Node.js heap < 250MB.
5. **Security Score**: 100% clean `npm audit` and 0 unhandled BOLA vulnerabilities.
