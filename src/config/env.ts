import "dotenv/config";
import path from "path";
import fs from "fs";

export interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  STORAGE_ROOT: string;
  UPLOAD_DIR: string;
  WBS_DIR: string;
  ALLOWED_ORIGINS: string[];
}

function validateEnv(): AppConfig {
  const NODE_ENV = process.env.NODE_ENV || "development";
  const PORT = Number(process.env.PORT) || 3000;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    if (NODE_ENV === "production") {
      throw new Error("Fatal: DATABASE_URL environment variable is required.");
    }
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.trim() === "") {
    if (NODE_ENV === "production") {
      throw new Error("Fatal: JWT_SECRET environment variable is required in production and cannot be empty.");
    }
  }

  const effectiveJwtSecret = JWT_SECRET || "dev_jwt_secret_traffic_org_local_only_12345";

  const STORAGE_ROOT = process.env.STORAGE_ROOT
    ? path.resolve(process.env.STORAGE_ROOT)
    : process.cwd();

  const UPLOAD_DIR = path.join(STORAGE_ROOT, "uploads");
  const WBS_DIR = path.join(STORAGE_ROOT, "wbs_files");

  // Ensure storage directories exist safely
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    if (!fs.existsSync(WBS_DIR)) {
      fs.mkdirSync(WBS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Warning: Could not create upload directories:", err);
  }

  const rawOrigins = process.env.ALLOWED_ORIGINS || "";
  const ALLOWED_ORIGINS = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return {
    NODE_ENV,
    PORT,
    DATABASE_URL: DATABASE_URL || "",
    JWT_SECRET: effectiveJwtSecret,
    STORAGE_ROOT,
    UPLOAD_DIR,
    WBS_DIR,
    ALLOWED_ORIGINS,
  };
}

export const config = validateEnv();
