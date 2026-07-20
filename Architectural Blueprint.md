While I cannot directly generate or attach a binary `.pdf` file through this text interface, I have structured this comprehensive architectural blueprint in a premium Markdown format.

You can instantly generate a neat, professional, print-ready PDF by copying the content below and pasting it into any Markdown editor (like VS Code, Obsidian, or an online tool like Dillinger.io), then selecting **Export to PDF** or **Print -> Save as PDF**.

---

# Architectural Blueprint: Multi-Repo Micro-App Setup

**Document Reference:** ORG-STRAT-ARCH-2026

**Target Audience:** Engineering Leads & DevOps Teams

---

## 1. Executive Architecture Overview

To support multiple organizational units with entirely divergent data models, forms, and validation criteria, this system leverages a **Multi-Repo Micro-App Architecture** behind an **Nginx Reverse Proxy**. This approach guarantees complete code, data, and repository isolation, allowing separate development teams to deploy concurrently without risking stability or introducing regression bugs into each other's environments.

### Key Architectural Concepts

* **Micro-apps:** Self-contained, independently deployable software applications running on distinct internal server ports.


* **Multi-repo Setup:** Isolation of source code control. The new organizational unit owns its Git history, dependency tree (`package.json`), and database migrations (`prisma/schema.prisma`) entirely separate from the legacy core.


* **Reverse Proxy Routing:** A single public-facing entryway (domain) distributes incoming traffic to specific internal ports based on URL paths.



---

## 2. Target Repository Directory Structure

The new unit's repository must adhere to the following ماژولار (modular) layout to align with organizational standards and maintain seamless ecosystem compatibility:

```text
new-unit-report-app/               # Independent Git Repository
├── prisma/
│   └── schema.prisma              # Isolated database schema & migrations
├── public/
│   └── logo.png                   # Dedicated unit branding assets
├── src/
│   ├── components/                # General shared UI primitives
│   ├── views/
│   │   ├── SubmitReport.tsx       # Unit-specific custom input forms
│   │   └── Dashboard.tsx          # Unit-specific metrics & oversight views
│   ├── App.tsx                    # Main view coordinator & shell layout
│   ├── types.ts                   # Static TypeScript definitions
│   └── main.tsx                   # Client entry point
├── .env                           # Environment configuration variables
├── server.ts                      # Express API engine & SPA static server
├── vite.config.ts                 # Build tool bundling configurations
└── package.json                   # Local dependency manifests

```

---

## 3. Core Technical Configurations

For the new application to coexist harmoniously on a shared production server, the following three configurations must be rigidly enforced by the incoming engineering team:

### 3.1 Environment Configuration (`.env`)

The new application must run on an isolated network port (e.g., `4000`) to avoid conflicts with the traffic app running on port `3000`.

```env
# Network Process Control
PORT=4000

# Completely Isolated Database Target
DATABASE_URL="postgresql://db_user:secure_password@localhost:5432/new_unit_db?schema=public"

```

### 3.2 Bundler Sub-path Base (`vite.config.ts`)

Because the application will be served under a sub-path (`/new-unit`), Vite must be explicitly instructed to append this base route to all compiled asset paths (JS, CSS, Images).

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/new-unit/', // Crucial: Aligns asset resolution with Nginx sub-paths
});

```

### 3.3 Backend Static Asset Server (`server.ts`)

The server routing entry script must bind correctly to the environmental port and serve production build assets mapped directly to the designated structural sub-path.

```typescript
import express from "express";
import path from "path";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 4000; // Reads port 4000 from environment[cite: 3]

app.use(express.json());

// Bind built static assets explicitly to the sub-path location
const distPath = path.join(process.cwd(), "dist");
app.use("/new-unit", express.static(distPath));

// Fallback routing to support Single Page Application (SPA) Client Routing
app.get("/new-unit/*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Micro-app running independently on http://localhost:${PORT}`);
});

```

---

## 4. Production Router Configuration (Nginx)

The Nginx configuration maps the single corporate domain into an smart gateway router, isolating the underlying server ports from the public internet.

```nginx
server {
    listen 80;
    server_name report.organization.ir; # The single unified public URL

    # 1. Core Traffic Unit (Default Gateway to Port 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. New Unit Application (Routed dynamically to Port 4000)
    location /new-unit {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Enable large file attachments up to 15MB
        client_max_body_size 15M; 
    }
}

```

---

## 5. Architectural Advantages & Safeguards

1. **Zero-Collision Deployments:** The core application and the new unit application have entirely separate CI/CD pipelines. A deployment failure or syntax error in one repo has a 0% chance of impacting the uptime of the other.
2. **Schema Freedom:** The new unit can design highly optimized PostgreSQL tables inside `schema.prisma` without needing complex polymorphic inheritances or migrations that alter your core tables.


3. **Strict Security Boundary:** Database credentials, environment tokens, and AI integration keys are entirely contained within local `.env` barriers, shielding sensitive agency resources.