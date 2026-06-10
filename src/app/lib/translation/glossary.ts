// Pure glossary helpers — no React, no storage. Term matching + prompt block.
// A glossary maps a source term to a desired target translation, bound to one
// target language. Naming follows the industry-wide source/target convention
// (DeepL glossaries, Qwen-MT terms, CAT tools). Two enforcement layers consume
// these helpers:
//   - buildGlossaryPromptBlock → injected into the LLM system prompt
//   - applyGlossaryToText → leak-through net replacing residual source terms

export type GlossaryTerm = { source: string; target: string; targetLang: string };
export type GlossaryPreset = { id: string; name: string; terms: GlossaryTerm[] };

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A term is complete only when it has both a source and a target. Half-filled
// editor rows (empty `target`) must never reach the prompt or the replacer — an
// empty `target` in leak-through would DELETE the source text from the output.
const isComplete = (term: GlossaryTerm): boolean => Boolean(term.source.trim() && term.target.trim());

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

const termPattern = (source: string): string => {
  const escaped = escapeRegExp(source);
  return `(?<!${WORD_EDGE_CLASS})${escaped}(?!${WORD_EDGE_CLASS})`;
};

// Whether a term is safe to apply as a leak-through replacement. The only real
// hazard is RE-EXPANSION: the source appears inside its own correct target, so a
// blind replace doubles it (`AI` → "AI助手" would turn a correct "AI助手" into
// "AI助手助手"). We skip a term ONLY when its own match pattern actually fires
// inside its target. That keeps the common abbreviation-expansions working —
// `Go` → "Golang" is safe because `\bGo\b` can't match inside "Golang", so the
// word boundary already protects it. `target === source` (case-only difference)
// is always safe — harmless normalization, not expansion.
const isReplaceSafe = (term: GlossaryTerm): boolean => {
  if (!isComplete(term)) return false;
  const source = term.source.trim();
  const target = term.target.trim();
  if (target.toLowerCase() === source.toLowerCase()) return true;
  return !new RegExp(termPattern(source), "iv").test(target);
};

/**
 * System-prompt fragment listing the terms (already filtered to the active
 * target language). Empty string when there are no complete terms. Includes
 * `target ⊇ source` terms — the prompt SHOULD still steer the model on them;
 * only leak-through skips them (see isReplaceSafe).
 */
export const buildGlossaryPromptBlock = (terms: GlossaryTerm[]): string => {
  const valid = terms.filter(isComplete);
  if (valid.length === 0) return "";
  const lines = valid.map((term) => `${term.source.trim()} → ${term.target.trim()}`).join("\n");
  return `\n\nGlossary — always translate these terms exactly as specified (source → target). Keep them consistent everywhere they appear:\n${lines}`;
};

// Per-term compiled form: the alternation `pattern` for the combined regex, and a
// `matcher` (full-match regex) to map a matched substring back to its target.
// `source`/`target` are trimmed so a stray pasted space can't eat an adjacent character.
const compileTerm = (term: GlossaryTerm) => {
  const source = term.source.trim();
  return { source, target: term.target.trim(), pattern: termPattern(source), matcher: new RegExp(`^${escapeRegExp(source)}$`, "iu") };
};

type CompiledGlossary = {
  // Complete terms (original refs, input order) with a boundary-guarded
  // presence regex each — shared by the prompt filter and violation check.
  complete: Array<{ term: GlossaryTerm; presence: RegExp }>;
  // Replace-safe subset compiled for the leak-through pass (longest-first).
  replaceCompiled: Array<ReturnType<typeof compileTerm>>;
  combined: RegExp | null;
  unsafeExact: Set<string>;
};

// Compile-once cache keyed on the terms array reference. Callers are expected
// to treat term arrays as immutable (React state updates already replace the
// array), so a reference is a sound identity. Without this, per-line callers
// (applyGlossaryToText runs once per subtitle line) recompile the whole regex
// set thousands of times per run.
const compiledCache = new WeakMap<GlossaryTerm[], CompiledGlossary>();

// NOTE on regex statefulness: `combined` carries /g and is now SHARED across
// calls — safe because String.prototype.replace with a global regex resets
// lastIndex itself (spec: RegExp.prototype[Symbol.replace]). `presence` and
// `matcher` are flag-stateless (no /g).
const compileGlossary = (terms: GlossaryTerm[]): CompiledGlossary => {
  const hit = compiledCache.get(terms);
  if (hit) return hit;
  const completeTerms = terms.filter(isComplete);
  const replaceCompiled = completeTerms
    .filter(isReplaceSafe)
    .sort((a, b) => b.source.trim().length - a.source.trim().length) // longest first: alternation prefers it at a given position
    .map(compileTerm);
  const built: CompiledGlossary = {
    complete: completeTerms.map((term) => ({ term, presence: new RegExp(termPattern(term.source.trim()), "iv") })),
    replaceCompiled,
    combined: replaceCompiled.length ? new RegExp(replaceCompiled.map((c) => c.pattern).join("|"), "giv") : null,
    // replace-unsafe 词条的精确大小写集合:匹配文本恰好等于某个【被过滤掉的】
    // unsafe 词条时,不能借其它大小写词条的 target 替换 —— 'Polish'(unsafe)
    // 与 'polish'(safe)并存时,"Polish grammar" 曾被 'polish' 的 target
    // 错误改写。
    unsafeExact: new Set(completeTerms.filter((t) => !isReplaceSafe(t)).map((t) => t.source.trim())),
  };
  compiledCache.set(terms, built);
  return built;
};

/**
 * Subset of complete terms whose SOURCE actually occurs in `text` (same
 * boundary semantics as the leak-through matcher, case-insensitive). Used to
 * keep the per-request prompt block down to the terms a request can use —
 * a 500-term glossary must not ride along on every 2-line chunk.
 */
export const filterTermsMatchingText = (terms: GlossaryTerm[], text: string): GlossaryTerm[] => {
  if (!text || terms.length === 0) return [];
  return compileGlossary(terms)
    .complete.filter(({ presence }) => presence.test(text))
    .map(({ term }) => term);
};

/**
 * Terms whose source occurs in `sourceText` but whose required target is
 * absent from `translatedText` — i.e. the model translated the term to
 * something else (the one failure mode leak-through can't fix; run AFTER
 * applyGlossaryToText so verbatim leftovers don't count). Target presence is
 * a case-insensitive substring check: CJK has no case, and demanding exact
 * case on Latin targets would burn retries on cosmetic mismatches the
 * leak-through already normalizes where it matters.
 */
export const findGlossaryViolations = (sourceText: string, translatedText: string, terms: GlossaryTerm[]): GlossaryTerm[] => {
  if (!sourceText || terms.length === 0) return [];
  const haystack = (translatedText || "").toLowerCase();
  return compileGlossary(terms)
    .complete.filter(({ term, presence }) => presence.test(sourceText) && !haystack.includes(term.target.trim().toLowerCase()))
    .map(({ term }) => term);
};

/**
 * Reinforced prompt fragment for the one-shot retry of a line that violated
 * the glossary (see findGlossaryViolations). Lists only the violated terms.
 */
export const buildStrictGlossaryPromptBlock = (terms: GlossaryTerm[]): string => {
  const valid = terms.filter(isComplete);
  if (valid.length === 0) return "";
  const lines = valid.map((term) => `${term.source.trim()} → ${term.target.trim()}`).join("\n");
  return `\n\nSTRICT GLOSSARY — the previous translation failed to apply these required terms. Every occurrence of each source term below MUST appear in the translation exactly as its specified target (source → target). Do not paraphrase or translate them any other way:\n${lines}`;
};

// Tabs/newlines are the TSV field/record separators — collapse them to a space
// so a value that contains one can't corrupt the export or the round-trip.
const cleanCell = (s: string): string => s.replace(/[\t\r\n]+/g, " ").trim();

/**
 * Parse glossary TSV content. Row shape: `source ⇥ target [⇥ targetLang]` —
 * the optional 3rd column (借鉴 DeepL 的多语言对上传格式,但我们只绑目标语言,
 * 三列即可) routes the row to that language; absent/unknown codes fall back to
 * `fallbackLang` (the drawer's selected language). Rows missing source or
 * target are dropped — a half row must never wipe an existing term's target.
 */
export const parseGlossaryTsv = (content: string, fallbackLang: string, validLangs: ReadonlySet<string>): GlossaryTerm[] =>
  content
    .split(/\r?\n/) // tolerate Windows CRLF and Unix LF
    .map((line) => line.split("\t"))
    .map((cols) => ({ source: cleanCell(cols[0] ?? ""), target: cleanCell(cols[1] ?? ""), langRaw: cleanCell(cols[2] ?? "").toLowerCase() }))
    .filter(({ source, target }) => source && target)
    .map(({ source, target, langRaw }) => ({ source, target, targetLang: validLangs.has(langRaw) ? langRaw : fallbackLang }));

/**
 * Merge imported terms into an existing list. Only languages PRESENT in the
 * import are touched: within each, imported rows overlay same-source terms
 * (trimmed, case-SENSITIVE — 'Polish'/'polish' are legal distinct pairs) and
 * collapse file-internal duplicates; untouched languages keep their rows
 * verbatim (including editor-state duplicates) — merge, don't wipe.
 */
export const mergeImportedTerms = (existing: GlossaryTerm[], imported: GlossaryTerm[]): GlossaryTerm[] => {
  const touched = new Set(imported.map((t) => t.targetLang));
  // Empty-source rows are half-filled editor drafts — they have no merge key
  // (an empty key would collapse SEPARATE drafts into one, eating a typed
  // target), so pass them through verbatim alongside untouched languages.
  // Imported rows always have a non-empty source (parseGlossaryTsv filters).
  const passthrough = existing.filter((t) => !touched.has(t.targetLang) || !t.source.trim());
  const byKey = new Map<string, GlossaryTerm>();
  const key = (t: GlossaryTerm) => `${t.targetLang}\u0000${t.source.trim()}`;
  for (const t of existing) if (touched.has(t.targetLang) && t.source.trim()) byKey.set(key(t), t);
  for (const t of imported) byKey.set(key(t), t);
  return [...passthrough, ...byKey.values()];
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
 * word boundaries, CJK/mixed as substrings; longest `source` first so a short
 * term can't clobber a longer one. Skips terms whose target contains the source
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
  if (!text || terms.length === 0) return text;
  const { replaceCompiled: compiled, combined, unsafeExact } = compileGlossary(terms);
  if (!combined) return text;
  // Function replacer → `target` is literal (avoids $&/$1 replacement patterns)
  // and never re-scans the replaced text. Case-EXACT term wins before the
  // case-insensitive fallback: 'Polish'/'polish' style pairs are legal in the
  // drawer, and first-compiled-wins gave both casings the same (possibly
  // wrong) target.
  return replaceOutsideBraceSpans(text, (segment) =>
    segment.replace(combined, (matched) => {
      const exact = compiled.find((c) => c.source === matched);
      if (exact) return exact.target;
      if (unsafeExact.has(matched)) return matched;
      const hit = compiled.find((c) => c.matcher.test(matched));
      return hit ? hit.target : matched;
    }),
  );
};
