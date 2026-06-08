// Context-aware translation helpers for LLM-based subtitle translation

// Pre-compiled regex for marker cleanup (avoids creating RegExp objects per call).
// `TRANSLTranslate_\d+` looks like a typo but isn't — some LLMs occasionally
// emit closing tags as `[/TRANSLTranslate_5]` instead of `[/TRANSLATE_5]`
// (the model's tokenizer re-case-shifts mid-token). Match the malformed form
// so extraction recovers instead of leaving the line empty for retry.
const MARKER_CLEANUP_RE = /\[\/?(TRANSLATE(_\d+)?|TRANSLTranslate_\d+|CONTEXT)\]/gi;

/**
 * Clean translation content by removing markers
 */
export const cleanTranslatedContent = (content: string): string => {
  return content.replace(MARKER_CLEANUP_RE, "").trim();
};

// Zero-width / invisible characters that String.trim() does NOT remove (they're
// Unicode format chars, not WhiteSpace) but that render as a blank line: ZWSP
// (U+200B — a common SRT trick to force visually-empty cues), ZWNJ, ZWJ, word
// joiner, BOM/ZWNBSP. A line of only these must be treated as blank everywhere
// blankness matters (pre-fill + merge-guard blankSource) — otherwise it becomes
// a "real target" the model can only answer with an empty tag, and the merge
// guard would discard its innocent predecessor on EVERY retry round, never
// converging.
const INVISIBLE_BLANK_RE = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

/** True when the line is empty / whitespace-only / invisible-unicode-only. */
export const isBlankLine = (line: string | undefined): boolean => !(line ?? "").replace(INVISIBLE_BLANK_RE, "").trim();

/**
 * Single pre-compiled regex matches every `[TRANSLATE_N]…[/TRANSLATE_N]` (and
 * the `TRANSLTranslate` typo variant — see MARKER_CLEANUP_RE) in one pass.
 * Previously this used `new RegExp(...)` inside a loop of `expectedCount`
 * iterations: a 1000-line subtitle at batchSize=50 allocated 1000 RegExp
 * objects across the run. Now one shared instance handles all batches.
 *
 * Capture groups:
 *   $1 — line number (matched against expectedCount to bucket into results)
 *   $2 — translated content
 */
const NUMBERED_TRANSLATE_RE = /\[TRANSLATE_(\d+)\]([\s\S]*?)\[\/(?:TRANSLATE|TRANSLTranslate)_\d+\]/gi;

/**
 * Extract translated lines with numbered markers from AI response
 *
 * `sourceLines` (the batch's source slice, parallel to the slots) lets the merge
 * guard below distinguish "model failed to translate this line" from "this line
 * was never a translation target". Omitting it assumes every slot is a real
 * target (legacy behavior — fine for callers that pre-filter blank lines).
 */
export const extractTranslatedLinesWithNumbers = (response: string, expectedCount: number, sourceLines?: string[]): string[] => {
  // Initialize with empty strings to ensure consistent return type
  const results = new Array<string>(expectedCount).fill("");

  // Single-pass scan: walk every `[TRANSLATE_N]...[/TRANSLATE_N]` match and
  // bucket by the captured N. Out-of-range numbers (LLM hallucinated extras)
  // are silently dropped — caller's retry logic handles still-empty slots.
  NUMBERED_TRANSLATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let sawOneBasedOverflow = false;
  while ((match = NUMBERED_TRANSLATE_RE.exec(response)) !== null) {
    const idx = Number(match[1]);
    if (idx >= 0 && idx < expectedCount && !results[idx]) {
      results[idx] = cleanTranslatedContent(match[2].trim());
    } else if (idx === expectedCount) {
      sawOneBasedOverflow = true;
    }
  }

  // 1-based renumbering fail-safe: a tag numbered exactly expectedCount (one
  // past the last valid index) TOGETHER WITH an empty slot 0 is the signature
  // of the classic LLM habit of numbering 1..N instead of the requested
  // 0..N-1. Trusting those tags would ship EVERY line shifted one position
  // against its timestamp — silently, flagged as success, and cached. Reject
  // the response wholesale and let the retry machinery re-roll (same fail-safe
  // philosophy as the no-positional-guess rule below). A hallucinated tag N on
  // an otherwise-correct response whose slot 0 is missing for unrelated
  // reasons also lands here — rejecting costs one retry, the safe direction.
  if (expectedCount > 1 && sawOneBasedOverflow && results[0] === "") {
    return new Array<string>(expectedCount).fill("");
  }

  // Merge guard (subtitle-translator#44): a marker immediately PRECEDING a missing
  // slot is untrusted and discarded too. When subtitle lines are fragments of one
  // sentence, Gemini routinely stuffs the WHOLE sentence's translation into the
  // first line's tag and omits (or leaves empty) the following tags. Keeping that
  // merged content while the retry machinery re-translates the omitted lines
  // individually duplicates the sentence in the output — line N ends up holding
  // N..N+k's content AND N+1..N+k get their own translations again. Discarding the
  // gap-adjacent predecessor makes the whole sentence retry together as one cluster.
  //
  // "Missing" means an empty slot whose SOURCE actually had content. Blank source
  // lines (markdown paragraph separators in raw mode, ASS tag-only lines stripped
  // to "") can only ever come back empty — treating them as gaps would discard the
  // legitimate translation before EVERY blank line on EVERY retry round, until the
  // line permanently falls back to source text.
  //
  // Costs accepted: a benign single-line drop or a token-limit truncation tail now
  // re-translates ONE extra (innocent) neighbor line per gap — cheap, and correct
  // output beats saved tokens (same philosophy as the no-positional-guess rule
  // below). Works off a snapshot so the discard never cascades backwards; the
  // happy path (all markers present) is untouched.
  // isBlankLine (not bare .trim()) so invisible-unicode-only lines (ZWSP etc.)
  // count as blank here exactly like they do in the caller's pre-fill — a
  // definition mismatch would make them permanent "real targets" whose
  // inevitable empty answer kills the predecessor on every retry round.
  const blankSource = (i: number): boolean => sourceLines !== undefined && isBlankLine(sourceLines[i] ?? "x");
  const satisfied = results.map((r, i) => r !== "" || blankSource(i));
  for (let i = 1; i < expectedCount; i++) {
    if (satisfied[i]) continue;
    // Walk back across blank-source slots: a stripped ASS tag-only line can sit
    // MID-sentence, so the merged content may live in the nearest CONTENT slot
    // before the gap, not the literally adjacent (blank) one. Without the walk,
    // the blank slot "satisfies" the adjacency check and shields the merge.
    let j = i - 1;
    while (j >= 0 && blankSource(j)) j--;
    if (j >= 0 && satisfied[j]) results[j] = "";
  }

  // Fail safe, not wrong: every returned line is placed at the index named by its
  // [TRANSLATE_N] marker, so reordered-but-tagged output still maps correctly. When
  // NO marker parses (the LLM — Gemini especially — stripped the tags, wrapped the
  // reply in a code fence, or added a preamble), we must NOT guess by line position:
  // a positional split silently misaligns subtitles against their timestamps whenever
  // the model reorders lines or changes the line count. Returning empties instead lets
  // the caller's retry (window-halving, cluster retry, 10s auto-retry) and final
  // soft-fill-with-original kick in — a line left untranslated at the CORRECT timestamp
  // beats a translation at the wrong one.
  return results;
};

/**
 * Build context-aware translation prompt — wraps the batch instructions around
 * the user's template WITHOUT consuming the ${content} placeholder: the marker
 * block (user-controlled text) is inserted LAST by getAIModelPrompt's
 * function-form replacement at the service layer. Embedding it here would (a)
 * run it through String.replace's GetSubstitution ($$ → $, LaTeX corruption)
 * and (b) expose it to the service layer's template-variable pass (a literal
 * "${fullText}" inside a subtitle line would inject the whole document).
 * @param baseUserPrompt - Base user prompt template with ${content} placeholder
 * @param batchSize - Number of lines to translate in this batch
 * @param documentType - Type of document: 'subtitle' | 'markdown' | 'generic'
 */
const CONTEXT_DESCRIPTIONS = {
  subtitle: {
    description: "part of a subtitle file",
    style: "Maintain the natural flow of dialogue and keep the same numbering in your response.",
    notes: "If a line contains only sounds/exclamations, still translate them appropriately",
  },
  markdown: {
    description: "part of a Markdown document",
    style: "Preserve ALL Markdown formatting syntax exactly as-is (**, *, [], (), #, >, -, ```, etc.). Only translate the text content, never modify the Markdown syntax or structure.",
    notes: "URLs, code blocks, and LaTeX formulas must remain unchanged. Maintain paragraph coherence across lines",
  },
  generic: {
    description: "part of a text document",
    style: "Maintain consistency, natural language flow, and preserve the original text formatting (line breaks, spacing, punctuation style).",
    notes: "Keep the original paragraph structure and any special formatting patterns",
  },
} as const;

export const buildContextPrompt = (baseUserPrompt: string, batchSize: number, documentType: "subtitle" | "markdown" | "generic" = "subtitle"): string => {
  const ctx = CONTEXT_DESCRIPTIONS[documentType];

  // Function-form replacement + the trailing literal ${content}: the actual
  // marker block is substituted by getAIModelPrompt LAST, after every template
  // variable has already been resolved (see utils.ts getAIModelPrompt).
  return baseUserPrompt.replace(
    "${content}",
    () => `Context: This is ${
      ctx.description
    }. Only translate the lines marked with [TRANSLATE_X][/TRANSLATE_X] tags (where X is the line number). Use the [CONTEXT][/CONTEXT] lines for understanding but do not translate them. ${ctx.style}

CRITICAL REQUIREMENTS:
1. You MUST translate ALL ${batchSize} lines marked with [TRANSLATE_X] tags
2. Do NOT skip any numbers from 0 to ${batchSize - 1}
3. Keep the exact format: [TRANSLATE_0]translation[/TRANSLATE_0]
4. NEVER merge lines: when one sentence spans several marked lines, translate each line's fragment separately under its own number — do NOT combine multiple lines' content into a single tag; a tag may be empty ONLY if its source line is empty
5. ${ctx.notes}

\${content}`
  );
};
