import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateFormula,
  validateFormula,
  getVariableKeyForIndex,
  formatFormulaForDisplay,
} from "../src/utils/formulaEvaluator";

test("Formula Evaluator: Basic arithmetic and precedence", () => {
  const res1 = evaluateFormula("A + B * C", { A: 2, B: 3, C: 4 });
  assert.equal(res1.success, true);
  assert.equal(res1.result, 14); // 2 + 12 = 14

  const res2 = evaluateFormula("(A + B) * C", { A: 2, B: 3, C: 4 });
  assert.equal(res2.success, true);
  assert.equal(res2.result, 20); // 5 * 4 = 20

  const res3 = evaluateFormula("100 - (A + B)", { A: 30, B: 25 });
  assert.equal(res3.success, true);
  assert.equal(res3.result, 45);
});

test("Formula Evaluator: Weighted average and percentage ratios", () => {
  // (A * 0.4) + (B * 0.6)
  const res1 = evaluateFormula("(A * 0.4) + (B * 0.6)", { A: 80, B: 90 });
  assert.equal(res1.success, true);
  assert.equal(res1.result, 86); // 32 + 54 = 86

  // (A / B) * 100
  const res2 = evaluateFormula("(A / B) * 100", { A: 45, B: 60 });
  assert.equal(res2.success, true);
  assert.equal(res2.result, 75);
});

test("Formula Evaluator: Persian numerals and symbols normalization", () => {
  const res = evaluateFormula("(A × ۰.۴) + (B × ۰.۶)", { A: 80, B: 90 });
  assert.equal(res.success, true);
  assert.equal(res.result, 86);
});

test("Formula Evaluator: Built-in functions (min, max, avg, round, abs, sqrt)", () => {
  const resMin = evaluateFormula("min(A, B, C)", { A: 12, B: 5, C: 99 });
  assert.equal(resMin.success, true);
  assert.equal(resMin.result, 5);

  const resMax = evaluateFormula("max(A, B)", { A: 12, B: 5 });
  assert.equal(resMax.success, true);
  assert.equal(resMax.result, 12);

  const resAvg = evaluateFormula("avg(A, B, C)", { A: 10, B: 20, C: 30 });
  assert.equal(resAvg.success, true);
  assert.equal(resAvg.result, 20);

  const resRound = evaluateFormula("round(A / B, 2)", { A: 10, B: 3 });
  assert.equal(resRound.success, true);
  assert.equal(resRound.result, 3.33);

  const resSqrt = evaluateFormula("sqrt(A) + abs(B)", { A: 16, B: -10 });
  assert.equal(resSqrt.success, true);
  assert.equal(resSqrt.result, 14);
});

test("Formula Evaluator: Validation checks", () => {
  // Valid formula
  const v1 = validateFormula("(A * 0.4) + (B * 0.6)", ["A", "B"]);
  assert.equal(v1.valid, true);
  assert.deepEqual(v1.usedVariables, ["A", "B"]);

  // Variable not in available list
  const v2 = validateFormula("(A * 0.4) + (C * 0.6)", ["A", "B"]);
  assert.equal(v2.valid, false);
  assert.ok(v2.error?.includes("متغیر «C»"));

  // Unbalanced parenthesis
  const v3 = validateFormula("(A + B * 2", ["A", "B"]);
  assert.equal(v3.valid, false);

  // Division by zero runtime check
  const rDivZero = evaluateFormula("A / B", { A: 10, B: 0 });
  assert.equal(rDivZero.success, false);
  assert.ok(rDivZero.error?.includes("تقسیم بر صفر"));
});

test("Formula Evaluator: Helper functions", () => {
  assert.equal(getVariableKeyForIndex(0), "A");
  assert.equal(getVariableKeyForIndex(1), "B");
  assert.equal(getVariableKeyForIndex(2), "C");

  const display = formatFormulaForDisplay("(A * 0.4) + (B * 0.6)", {
    A: "پیشرفت ایستگاه",
    B: "تکمیل ریل‌گذاری",
  });
  assert.ok(display.includes("[پیشرفت ایستگاه]"));
  assert.ok(display.includes("[تکمیل ریل‌گذاری]"));
  assert.ok(display.includes("×"));
});
