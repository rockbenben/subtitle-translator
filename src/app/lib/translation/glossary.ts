// Pure glossary helpers — no React, no storage. Term matching + prompt block.
// A glossary maps a source term to a desired target translation, bound to one
// target language. Two enforcement layers consume these helpers:
//   - buildGlossaryPromptBlock → injected into the LLM system prompt
//   - applyGlossaryToText → leak-through net replacing residual source terms

export type GlossaryTerm = { from: string; to: string; targetLang: string };
export type GlossaryPreset = { id: string; name: string; terms: GlossaryTerm[] };

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A term is complete only when it has both a source and a target. Half-filled
// editor rows (empty `to`) must never reach the prompt or the replacer — an
// empty `to` in leak-through would DELETE the source text from the output.
const isComplete = (term: GlossaryTerm): boolean => Boolean(term.from.trim() && term.to.trim());

// 词边界 guard 字符类:word 字符【减去】无词间空格的脚本(CJK/泰/老/高棉/
// 缅)。v-flag 类差集 [A--B]。为什么减:
//   - 中文译文里残留的英文 term 几乎总被 CJK 紧贴("人工智能AI助手")——
//     把 CJK 算进 word 类会让 leak-through 在主用例(zh 目标)永远不触发;
//   - 同理纯 CJK term 的邻居天然是 CJK → guard 不阻断 → 表现为子串匹配,
//     不再需要单独的"无边界脚本走裸子串"分支(混合 term "APP图标" 的
//     Latin 边因此获得 guard,不再在 "xAPP图标" 内误替换)。
// 保留:\b 是 ASCII 的(мир 会命中 мировой 内部);_ 算 word(user 不进
// user_id);guard 无条件加(lookbehind 只看邻字符,".NET" 空格后照常匹配,
// vb.NET 内被 b 阻断)。
// All consumers must compile with the `v` flag (class subtraction + \p escapes).
const WORD_EDGE_CLASS = "[[\\p{L}\\p{N}_]--[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Thai}\\p{Script=Lao}\\p{Script=Khmer}\\p{Script=Myanmar}]]";

const termPattern = (from: string): string => {
  const escaped = escapeRegExp(from);
  return `(?<!${WORD_EDGE_CLASS})${escaped}(?!${WORD_EDGE_CLASS})`;
};

// Whether a term is safe to apply as a leak-through replacement. The only real
// hazard is RE-EXPANSION: the source appears inside its own correct target, so a
// blind replace doubles it (`AI` → "AI助手" would turn a correct "AI助手" into
// "AI助手助手"). We skip a term ONLY when its own match pattern actually fires
// inside its target. That keeps the common abbreviation-expansions working —
// `Go` → "Golang" is safe because `\bGo\b` can't match inside "Golang", so the
// word boundary already protects it. `to === from` (case-only difference) is
// always safe — harmless normalization, not expansion.
const isReplaceSafe = (term: GlossaryTerm): boolean => {
  if (!isComplete(term)) return false;
  const from = term.from.trim();
  const to = term.to.trim();
  if (to.toLowerCase() === from.toLowerCase()) return true;
  return !new RegExp(termPattern(from), "iv").test(to);
};

/**
 * System-prompt fragment listing the terms (already filtered to the active
 * target language). Empty string when there are no complete terms. Includes
 * `to ⊇ from` terms — the prompt SHOULD still steer the model on them; only
 * leak-through skips them (see isReplaceSafe).
 */
export const buildGlossaryPromptBlock = (terms: GlossaryTerm[]): string => {
  const valid = terms.filter(isComplete);
  if (valid.length === 0) return "";
  const lines = valid.map((term) => `${term.from.trim()} → ${term.to.trim()}`).join("\n");
  return `\n\nGlossary — always translate these terms exactly as specified (source → target). Keep them consistent everywhere they appear:\n${lines}`;
};

// Per-term compiled form: the alternation `pattern` for the combined regex, and a
// `matcher` (full-match regex) to map a matched substring back to its target.
// `from`/`to` are trimmed so a stray pasted space can't eat an adjacent character.
const compileTerm = (term: GlossaryTerm) => {
  const from = term.from.trim();
  return { from, to: term.to.trim(), pattern: termPattern(from), matcher: new RegExp(`^${escapeRegExp(from)}$`, "iu") };
};

// ICU-safety: the leak-through must never rewrite inside {...} spans. The JSON
// tool's flagship input is i18n message files; a glossary term colliding with a
// placeholder name or plural keyword ('name', 'count', 'one', 'other' — exactly
// the common UI vocabulary users put in glossaries) would corrupt ICU syntax the
// model preserved correctly (MISSING_VALUE / parse failure in the consuming
// app). Walk brace depth and apply the replacer to depth-0 segments only.
// Trade-off: translatable text nested inside plural branches is also skipped —
// the leak-through is a net, not the primary mechanism, so under-applying
// beats breaking the file. Unbalanced braces leave the tail unreplaced (same
// under-apply direction).
const replaceOutsideBraceSpans = (text: string, replaceSegment: (seg: string) => string): string => {
  if (!text.includes("{")) return replaceSegment(text);
  let out = "";
  let segStart = 0;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) {
        out += replaceSegment(text.slice(segStart, i));
        segStart = i;
      }
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        out += text.slice(segStart, i + 1);
        segStart = i + 1;
      }
    }
  }
  out += depth === 0 ? replaceSegment(text.slice(segStart)) : text.slice(segStart);
  return out;
};

/**
 * Leak-through replace: swap any glossary SOURCE term still present verbatim in
 * the translated text with its target term. Case-insensitive; Latin terms on
 * word boundaries, CJK/mixed as substrings; longest `from` first so a short term
 * can't clobber a longer one. Skips terms whose target contains the source
 * (would re-expand correct output) and incomplete terms. Only touches
 * untranslated leftovers — never rewrites already-correct translation.
 *
 * A SINGLE combined pass (one alternation regex), not a per-term loop: each
 * position in the ORIGINAL text is matched and replaced once, so a replacement's
 * output is never re-scanned by another term. That avoids cross-term chaining
 * (e.g. `AI助手 → "AI Assistant"` then `AI → 人工智能` corrupting it to
 * "人工智能 Assistant").
 */
export const applyGlossaryToText = (text: string, terms: GlossaryTerm[]): string => {
  if (!text) return text;
  const compiled = terms
    .filter(isReplaceSafe)
    .sort((a, b) => b.from.trim().length - a.from.trim().length) // longest first: alternation prefers it at a given position
    .map(compileTerm);
  if (compiled.length === 0) return text;
  // replace-unsafe 词条的精确大小写集合:匹配文本恰好等于某个【被过滤掉的】
  // unsafe 词条时,不能借其它大小写词条的 target 替换 —— 'Polish'(unsafe)
  // 与 'polish'(safe)并存时,"Polish grammar" 曾被 'polish' 的 target
  // 错误改写。
  const unsafeExact = new Set(
    terms
      .filter(isComplete)
      .filter((t) => !isReplaceSafe(t))
      .map((t) => t.from.trim()),
  );
  const combined = new RegExp(compiled.map((c) => c.pattern).join("|"), "giv");
  // Function replacer → `to` is literal (avoids $&/$1 replacement patterns) and
  // never re-scans the replaced text. Case-EXACT term wins before the
  // case-insensitive fallback: 'Polish'/'polish' style pairs are legal in the
  // drawer, and first-compiled-wins gave both casings the same (possibly
  // wrong) target.
  return replaceOutsideBraceSpans(text, (segment) =>
    segment.replace(combined, (matched) => {
      const exact = compiled.find((c) => c.from === matched);
      if (exact) return exact.to;
      if (unsafeExact.has(matched)) return matched;
      const hit = compiled.find((c) => c.matcher.test(matched));
      return hit ? hit.to : matched;
    }),
  );
};
