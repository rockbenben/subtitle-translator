// Context-aware translation helpers for LLM-based subtitle translation

// Pre-compiled regex for marker cleanup (avoids creating RegExp objects per call)
const MARKER_CLEANUP_RE = /\[\/?(TRANSLATE(_\d+)?|TRANSLTranslate_\d+|CONTEXT)\]/gi;

/**
 * Clean translation content by removing markers
 */
export const cleanTranslatedContent = (content: string): string => {
  return content.replace(MARKER_CLEANUP_RE, "").trim();
};

/**
 * Extract translated lines with numbered markers from AI response
 */
export const extractTranslatedLinesWithNumbers = (response: string, expectedCount: number): string[] => {
  // Initialize with empty strings to ensure consistent return type
  const results = new Array<string>(expectedCount).fill("");

  // Match numbered markers - single regex handles both correct and error formats
  for (let i = 0; i < expectedCount; i++) {
    const regex = new RegExp(`\\[TRANSLATE_${i}\\]([\\s\\S]*?)\\[/(?:TRANSLATE|TRANSLTranslate)_${i}\\]`, "i");
    const match = response.match(regex);
    if (match) {
      results[i] = cleanTranslatedContent(match[1].trim());
    }
  }

  const successCount = results.filter(Boolean).length;
  if (successCount > 0) {
    return results;
  }

  // Fallback: try unnumbered matching
  return extractTranslatedLines(response, expectedCount);
};

/**
 * Extract translated lines from AI response without numbered markers
 */
const UNNUMBERED_TRANSLATE_RE = /\[TRANSLATE\]([\s\S]*?)\[\/TRANSLATE\]/gi;

export const extractTranslatedLines = (response: string, expectedCount: number): string[] => {
  UNNUMBERED_TRANSLATE_RE.lastIndex = 0;
  const translateRegex = UNNUMBERED_TRANSLATE_RE;
  const matches: string[] = [];
  let match;

  while ((match = translateRegex.exec(response)) !== null) {
    matches.push(cleanTranslatedContent(match[1].trim()));
  }

  // If match count is correct, return matched results
  if (matches.length === expectedCount) {
    return matches;
  }

  // Otherwise, try splitting by lines and take first N lines, cleaning each line
  const lines = response
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, expectedCount)
    .map((line) => cleanTranslatedContent(line));

  return lines.length === expectedCount ? lines : new Array(expectedCount).fill("");
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
