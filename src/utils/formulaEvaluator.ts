/**
 * Safe Mathematical Expression Evaluator for Composite KPIs
 * فرمول‌نویسی امن و پیشرفته برای شاخص‌های ترکیبی
 * بدون استفاده از eval() یا Function()، کاملاً ایزوله و امن
 */

export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
  usedVariables: string[];
}

export interface FormulaEvaluationResult {
  success: boolean;
  result: number | null;
  error?: string;
}

// تبدیل ارقام فارسی و عربی به انگلیسی
function normalizeNumbersAndSymbols(expr: string): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  let normalized = expr;
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i], String(i));
    normalized = normalized.replaceAll(arabicDigits[i], String(i));
  }

  // استانداردسازی عملگرهای گرافیکی و نوشتاری
  normalized = normalized
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("—", "-");

  return normalized;
}

type TokenType = "NUMBER" | "IDENT" | "OP" | "LPAREN" | "RPAREN" | "COMMA";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function tokenize(input: string): Token[] {
  const str = normalizeNumbersAndSymbols(input);
  const tokens: Token[] = [];
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      const start = i;
      let dotCount = 0;
      while (i < str.length && /[0-9.]/.test(str[i])) {
        if (str[i] === ".") {
          dotCount++;
          if (dotCount > 1) throw new Error(`عدد نامعتبر در موقعیت ${i + 1}`);
        }
        numStr += str[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr, pos: start });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      const start = i;
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        ident += str[i];
        i++;
      }
      tokens.push({ type: "IDENT", value: ident, pos: start });
      continue;
    }

    if ("+-*/%^".includes(ch)) {
      tokens.push({ type: "OP", value: ch, pos: i });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", pos: i });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", pos: i });
      i++;
      continue;
    }

    if (ch === ",") {
      tokens.push({ type: "COMMA", value: ",", pos: i });
      i++;
      continue;
    }

    throw new Error(`کاراکتر غیرمجاز «${ch}» در موقعیت ${i + 1}`);
  }

  return tokens;
}

const SUPPORTED_FUNCTIONS = new Set(["min", "max", "avg", "average", "round", "abs", "sqrt", "ceil", "floor"]);

/**
 * اعتبارسنجی نحو فرمول و استخراج متغیرهای مصرف‌شده
 */
export function validateFormula(
  formula: string,
  availableVariables?: string[]
): FormulaValidationResult {
  const trimmed = (formula || "").trim();
  if (!trimmed) {
    return { valid: false, error: "متن فرمول نمی‌تواند خالی باشد.", usedVariables: [] };
  }

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch (err: any) {
    return { valid: false, error: err.message || "خطای نحو در نشانه‌گذاری فرمول", usedVariables: [] };
  }

  if (tokens.length === 0) {
    return { valid: false, error: "فرمول فاقد هرگونه عبارت محاسباتی است.", usedVariables: [] };
  }

  const usedVariables: string[] = [];
  let parenDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "LPAREN") parenDepth++;
    if (t.type === "RPAREN") {
      parenDepth--;
      if (parenDepth < 0) {
        return { valid: false, error: `پرانتز بسته بدون پرانتز باز متناظر در موقعیت ${t.pos + 1}`, usedVariables };
      }
    }

    if (t.type === "IDENT") {
      const lower = t.value.toLowerCase();
      if (!SUPPORTED_FUNCTIONS.has(lower)) {
        const varName = t.value.toUpperCase();
        if (!usedVariables.includes(varName)) {
          usedVariables.push(varName);
        }
      }
    }
  }

  if (parenDepth !== 0) {
    return { valid: false, error: "تعداد پرانتزهای باز و بسته با هم برابر نیست.", usedVariables };
  }

  if (availableVariables && availableVariables.length > 0) {
    const upperAvailable = new Set(availableVariables.map((v) => v.toUpperCase()));
    for (const uv of usedVariables) {
      if (!upperAvailable.has(uv)) {
        return {
          valid: false,
          error: `متغیر «${uv}» در لیست شاخص‌های انتخابی این فرمول تعریف نشده است.`,
          usedVariables,
        };
      }
    }
  }

  // تست محاسبه آزمایشی با متغیرهای فرضی
  const testVars: Record<string, number> = {};
  for (const v of usedVariables) {
    testVars[v] = 10;
  }
  const evalResult = evaluateFormula(trimmed, testVars);
  if (!evalResult.success) {
    return { valid: false, error: evalResult.error || "خطای ساختاری در ارزیابی فرمول", usedVariables };
  }

  return { valid: true, usedVariables };
}

/**
 * ارزیابی و محاسبه امن مقدار نهایی فرمول بر اساس متغیرهای ارائه‌شده
 */
export function evaluateFormula(
  formula: string,
  variables: Record<string, number | null | undefined>
): FormulaEvaluationResult {
  const trimmed = (formula || "").trim();
  if (!trimmed) {
    return { success: false, result: null, error: "فرمول خالی است." };
  }

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch (err: any) {
    return { success: false, result: null, error: err.message };
  }

  if (tokens.length === 0) {
    return { success: false, result: null, error: "عبارت محاسباتی یافت نشد." };
  }

  // نرمال‌سازی نقشه متغیرها به حروف بزرگ
  const varMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(variables)) {
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      varMap[k.toUpperCase()] = Number(v);
    }
  }

  // پارسر بازگشتی به روش نزولی ساده (Recursive Descent Parser)
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(expectedType?: TokenType, expectedValue?: string): Token {
    const t = tokens[pos];
    if (!t) throw new Error("پایان غیرمنتظره فرمول");
    if (expectedType && t.type !== expectedType) {
      throw new Error(`خطای نحو در موقعیت ${t.pos + 1}: انتظار ${expectedType} می‌رفت`);
    }
    if (expectedValue && t.value !== expectedValue) {
      throw new Error(`خطای نحو در موقعیت ${t.pos + 1}: انتظار «${expectedValue}» می‌رفت`);
    }
    pos++;
    return t;
  }

  // Expression: Term (('+' | '-') Term)*
  function parseExpression(): number {
    let left = parseTerm();
    while (pos < tokens.length) {
      const next = peek();
      if (next && next.type === "OP" && (next.value === "+" || next.value === "-")) {
        consume();
        const right = parseTerm();
        if (next.value === "+") left += right;
        else left -= right;
      } else {
        break;
      }
    }
    return left;
  }

  // Term: Factor (('*' | '/' | '%') Factor)*
  function parseTerm(): number {
    let left = parsePower();
    while (pos < tokens.length) {
      const next = peek();
      if (next && next.type === "OP" && (next.value === "*" || next.value === "/" || next.value === "%")) {
        consume();
        const right = parsePower();
        if (next.value === "*") {
          left *= right;
        } else if (next.value === "/") {
          if (right === 0) {
            throw new Error("خطای تقسیم بر صفر در فرمول");
          }
          left /= right;
        } else if (next.value === "%") {
          if (right === 0) throw new Error("خطای تقسیم بر صفر در پیمانه (%)");
          left = left % right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  // Power: Factor ('^' Power)? (right-associative)
  function parsePower(): number {
    const base = parseFactor();
    const next = peek();
    if (next && next.type === "OP" && next.value === "^") {
      consume();
      const exponent = parsePower();
      return Math.pow(base, exponent);
    }
    return base;
  }

  // Factor: ('+' | '-') Factor | NUMBER | IDENT | FunctionCall | '(' Expression ')'
  function parseFactor(): number {
    const t = peek();
    if (!t) throw new Error("انتظار عدد، متغیر یا پرانتز باز می‌رفت");

    // علامت مثبت یا منفی یگانی (Unary + / -)
    if (t.type === "OP" && (t.value === "-" || t.value === "+")) {
      consume();
      const factor = parseFactor();
      return t.value === "-" ? -factor : factor;
    }

    if (t.type === "NUMBER") {
      consume();
      return Number(t.value);
    }

    if (t.type === "IDENT") {
      consume();
      const lower = t.value.toLowerCase();

      // فراخوانی توابع (e.g. min, max, avg, round, abs, sqrt)
      if (SUPPORTED_FUNCTIONS.has(lower) && peek()?.type === "LPAREN") {
        consume("LPAREN");
        const args: number[] = [];
        if (peek()?.type !== "RPAREN") {
          args.push(parseExpression());
          while (peek()?.type === "COMMA") {
            consume("COMMA");
            args.push(parseExpression());
          }
        }
        consume("RPAREN");

        switch (lower) {
          case "min":
            if (args.length === 0) throw new Error("تابع min حداقل به یک پارامتر نیاز دارد.");
            return Math.min(...args);
          case "max":
            if (args.length === 0) throw new Error("تابع max حداقل به یک پارامتر نیاز دارد.");
            return Math.max(...args);
          case "avg":
          case "average":
            if (args.length === 0) throw new Error("تابع avg حداقل به یک پارامتر نیاز دارد.");
            return args.reduce((a, b) => a + b, 0) / args.length;
          case "round":
            if (args.length === 0) throw new Error("تابع round به ورودی نیاز دارد.");
            const decimals = args[1] !== undefined ? Math.round(args[1]) : 2;
            return Number(args[0].toFixed(decimals));
          case "abs":
            if (args.length !== 1) throw new Error("تابع abs دقیقاً به یک پارامتر نیاز دارد.");
            return Math.abs(args[0]);
          case "sqrt":
            if (args.length !== 1) throw new Error("تابع sqrt دقیقاً به یک پارامتر نیاز دارد.");
            if (args[0] < 0) throw new Error("جذر عدد منفی در فرمول مجاز نیست.");
            return Math.sqrt(args[0]);
          case "ceil":
            if (args.length !== 1) throw new Error("تابع ceil به یک پارامتر نیاز دارد.");
            return Math.ceil(args[0]);
          case "floor":
            if (args.length !== 1) throw new Error("تابع floor به یک پارامتر نیاز دارد.");
            return Math.floor(args[0]);
          default:
            throw new Error(`تابع «${t.value}» پشتیبانی نمی‌شود.`);
        }
      }

      // متغیر شاخص
      const varKey = t.value.toUpperCase();
      if (!(varKey in varMap)) {
        throw new Error(`مقدار متغیر «${varKey}» برای این دوره موجود یا اندازه‌گیری نشده است.`);
      }
      return varMap[varKey];
    }

    if (t.type === "LPAREN") {
      consume("LPAREN");
      const val = parseExpression();
      consume("RPAREN");
      return val;
    }

    throw new Error(`عنصر نامعتبر «${t.value}» در موقعیت ${t.pos + 1}`);
  }

  try {
    const result = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`عبارت اضافه بعد از پایان فرمول در موقعیت ${tokens[pos].pos + 1}`);
    }
    if (isNaN(result) || !isFinite(result)) {
      return { success: false, result: null, error: "نتیجه محاسبه فرمول نامعتبر است (NaN یا بی‌نهایت)." };
    }
    return { success: true, result: Number(result.toFixed(2)) };
  } catch (err: any) {
    return { success: false, result: null, error: err.message || "خطا در ارزیابی فرمول" };
  }
}

/**
 * ایجاد برچسب متغیرها برای شاخص‌های ورودی (A, B, C, D, ...)
 */
export function getVariableKeyForIndex(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index); // A, B, C, ...
  }
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return `${first}${second}`;
}

/**
 * تبدیل فرمول به فرمت خوانا با نام شاخص‌ها جهت چاپ در گزارش‌ها
 */
export function formatFormulaForDisplay(
  formula: string | null | undefined,
  variableNameMap: Record<string, string>
): string {
  if (!formula || !formula.trim()) return "";
  let formatted = formula;
  for (const [vKey, name] of Object.entries(variableNameMap)) {
    const regex = new RegExp(`\\b${vKey}\\b`, "g");
    formatted = formatted.replace(regex, `[${name}]`);
  }
  return formatted
    .replaceAll("*", " × ")
    .replaceAll("/", " ÷ ")
    .replaceAll("-", " − ")
    .replaceAll("+", " + ");
}
