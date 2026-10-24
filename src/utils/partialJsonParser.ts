/**
 * Lightweight streaming Partial JSON parser
 * Parses incomplete JSON streams token by token by auto-closing open strings, objects and arrays.
 */
export function parsePartialJson<T = any>(rawText: string): T | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Clean markdown code blocks if any
  let cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;
  cleaned = cleaned.substring(firstBrace);

  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{" || ch === "[") {
        stack.push(ch);
      } else if (ch === "}") {
        if (stack.length && stack[stack.length - 1] === "{") stack.pop();
      } else if (ch === "]") {
        if (stack.length && stack[stack.length - 1] === "[") stack.pop();
      }
    }
  }

  let repaired = cleaned;

  if (inString) {
    repaired += '"';
  } else {
    // If ended on colon like `"key": `, give it an empty string value
    repaired = repaired.replace(/:\s*$/, ': ""');
    // If ended on a dangling comma like `[1, 2, `, remove it
    repaired = repaired.replace(/,\s*$/, "");
  }

  // Close open arrays and objects in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    const bracket = stack[i];
    if (bracket === "{") repaired += "}";
    else if (bracket === "[") repaired += "]";
  }

  try {
    return JSON.parse(repaired);
  } catch {
    // Second-pass heuristic: remove trailing incomplete key-value pair if any
    try {
      const stripped = repaired
        .replace(/,\s*"[^"]*"\s*:\s*""\s*}/g, "}")
        .replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}
