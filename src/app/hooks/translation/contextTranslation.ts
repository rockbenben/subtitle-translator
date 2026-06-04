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
 */
export const extractTranslatedLinesWithNumbers = (response: string, expectedCount: number): string[] => {
  // Initialize with empty strings to ensure consistent return type
  const results = new Array<string>(expectedCount).fill("");

  // Single-pass scan: walk every `[TRANSLATE_N]...[/TRANSLATE_N]` match and
  // bucket by the captured N. Out-of-range numbers (LLM hallucinated extras)
  // are silently dropped — caller's retry logic handles still-empty slots.
  NUMBERED_TRANSLATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NUMBERED_TRANSLATE_RE.exec(response)) !== null) {
    const idx = Number(match[1]);
    if (idx >= 0 && idx < expectedCount && !results[idx]) {
      results[idx] = cleanTranslatedContent(match[2].trim());
    }
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
 * Build context-aware translation prompt
 * @param contextWithMarkers - Text with [TRANSLATE_X] and [CONTEXT] markers
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

export const buildContextPrompt = (contextWithMarkers: string, baseUserPrompt: string, batchSize: number, documentType: "subtitle" | "markdown" | "generic" = "subtitle"): string => {
  const ctx = CONTEXT_DESCRIPTIONS[documentType];

  return baseUserPrompt.replace(
    "${content}",
    `Context: This is ${
      ctx.description
    }. Only translate the lines marked with [TRANSLATE_X][/TRANSLATE_X] tags (where X is the line number). Use the [CONTEXT][/CONTEXT] lines for understanding but do not translate them. ${ctx.style}

CRITICAL REQUIREMENTS:
1. You MUST translate ALL ${batchSize} lines marked with [TRANSLATE_X] tags
2. Do NOT skip any numbers from 0 to ${batchSize - 1}
3. Keep the exact format: [TRANSLATE_0]translation[/TRANSLATE_0]
4. ${ctx.notes}

${contextWithMarkers}`
  );
};
