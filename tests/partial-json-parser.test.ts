import test from "node:test";
import assert from "node:assert/strict";
import { parsePartialJson } from "../src/utils/partialJsonParser";

test("parsePartialJson handles completely closed valid JSON", () => {
  const input = `{"analysis": {"health_score": 90, "overall_status": "پایدار"}}`;
  const result = parsePartialJson(input);
  assert.deepEqual(result, {
    analysis: {
      health_score: 90,
      overall_status: "پایدار",
    },
  });
});

test("parsePartialJson repairs incomplete string inside an object", () => {
  const input = `{"analysis": {"deputy_name": "معاونت حمل‌ونقل و ترافیک`;
  const result = parsePartialJson(input);
  assert.equal(result?.analysis?.deputy_name, "معاونت حمل‌ونقل و ترافیک");
});

test("parsePartialJson repairs incomplete array of projects during streaming", () => {
  const input = `{"analysis": {
    "projects_analysis": [
      {
        "project_title": "رگولاتوری شرکت‌های فعال",
        "status": "submitted",
        "key_achievements": ["تدوین ضوابط", "ارسال به فاوا"]
      },
      {
        "project_title": "احداث خطوط بزرگراهی متغیر",
        "project_summary": "در حال هماهنگی با پلیس راهور`;

  const result = parsePartialJson(input);
  assert.ok(result?.analysis?.projects_analysis);
  assert.equal(result.analysis.projects_analysis.length, 2);

  // اولین پروژه کاملاً آماده است
  assert.equal(result.analysis.projects_analysis[0].project_title, "رگولاتوری شرکت‌های فعال");
  assert.equal(result.analysis.projects_analysis[0].status, "submitted");
  assert.equal(result.analysis.projects_analysis[0].key_achievements.length, 2);

  // دومین پروژه با متن در حال تایپ بازسازی شده است
  assert.equal(result.analysis.projects_analysis[1].project_title, "احداث خطوط بزرگراهی متغیر");
  assert.equal(result.analysis.projects_analysis[1].project_summary, "در حال هماهنگی با پلیس راهور");
});

test("parsePartialJson safely ignores trailing colons and commas", () => {
  const inputWithColon = `{"analysis": {"health_score": `;
  const res1 = parsePartialJson(inputWithColon);
  assert.ok(res1?.analysis);

  const inputWithComma = `{"analysis": {"items": [1, 2, `;
  const res2 = parsePartialJson(inputWithComma);
  assert.ok(Array.isArray(res2?.analysis?.items));
  assert.equal(res2.analysis.items.length, 2);
});

test("parsePartialJson returns null on empty or non-JSON input", () => {
  assert.equal(parsePartialJson(""), null);
  assert.equal(parsePartialJson("    "), null);
  assert.equal(parsePartialJson("Hello world without brackets"), null);
});
