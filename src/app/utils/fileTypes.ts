type FileTypeDefinition = {
  extensions: readonly string[];
  displayExtensions?: readonly string[];
};

const fileTypes = {
  text: {
    extensions: [".txt"],
  },
  markdown: {
    extensions: [".md", ".markdown", ".mdown", ".mkd", ".mkdn", ".mdwn"],
    displayExtensions: [".md", ".markdown"],
  },
  // Kept pure `.json` on purpose — strict JSON parsers (json-* tools, flare)
  // share this category and would choke on newline-delimited variants, which
  // live in `data` instead.
  json: {
    extensions: [".json"],
  },
  subtitle: {
    extensions: [".srt", ".ass", ".ssa", ".vtt", ".sbv", ".lrc"],
  },
  data: {
    extensions: [".csv", ".tsv", ".xml", ".jsonl", ".ndjson", ".rss", ".atom"],
    displayExtensions: [".csv", ".tsv", ".xml", ".jsonl"],
  },
  yaml: {
    extensions: [".yaml", ".yml"],
  },
  config: {
    extensions: [".ini", ".log", ".conf", ".cfg", ".toml", ".env", ".properties", ".editorconfig", ".hcl", ".tf"],
    displayExtensions: [".ini", ".conf", ".toml", ".env", ".log"],
  },
  web: {
    extensions: [".html", ".htm", ".css", ".scss", ".sass", ".less", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro", ".svg", ".graphql", ".gql"],
    displayExtensions: [".html", ".css", ".js", ".ts", ".tsx"],
  },
  code: {
    extensions: [".py", ".java", ".sql", ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".rb", ".php", ".sh", ".bash", ".ps1", ".bat", ".kt", ".swift", ".lua", ".pl", ".r", ".scala", ".dart", ".gradle", ".groovy", ".clj", ".ex", ".exs", ".erl", ".hs", ".jl", ".vb", ".fs", ".m", ".mm", ".zig", ".nim", ".proto", ".prisma", ".sol"],
    displayExtensions: [".py", ".java", ".go", ".rs", ".sql"],
  },
  markup: {
    extensions: [".rst", ".tex", ".adoc", ".asciidoc", ".org"],
    displayExtensions: [".rst", ".tex"],
  },
} as const satisfies Record<string, FileTypeDefinition>;

export type FileTypeCategory = keyof typeof fileTypes;

const fileTypePresets = {
  jsonText: ["text", "json"],
  markdownText: ["text", "markdown"],
  subtitle: ["subtitle"],
  flare: ["web", "json", "yaml", "text"],
  richText: ["text", "markdown", "json", "subtitle", "data", "yaml", "config", "web", "code", "markup"],
} as const satisfies Record<string, readonly FileTypeCategory[]>;

export type FileTypePreset = keyof typeof fileTypePresets;

type FileTypeLabelOptions = {
  maxVisible?: number;
  separator?: string;
  overflowText?: string;
  useAllExtensions?: boolean;
};

const defaultSeparator = ", ";

const normalizeExtension = (extension: string) => (extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`);

const formatExtensions = (extensions: string[], options: FileTypeLabelOptions = {}) => {
  const { maxVisible, separator = defaultSeparator, overflowText = "..." } = options;

  if (!maxVisible || extensions.length <= maxVisible) {
    return extensions.join(separator);
  }

  return `${extensions.slice(0, maxVisible).join(separator)}${overflowText}`;
};

export const getFileTypeConfig = (...categories: FileTypeCategory[]) => {
  const extensions: string[] = Array.from(new Set(categories.flatMap((category) => fileTypes[category].extensions)));
  const displayExtensions: string[] = Array.from(
    new Set(
      categories.flatMap((category) => {
        const definition: FileTypeDefinition = fileTypes[category];
        return definition.displayExtensions ?? definition.extensions;
      }),
    ),
  );

  return {
    categories,
    extensions,
    displayExtensions,
    accept: extensions.join(","),
    label: formatExtensions(displayExtensions),
    fullLabel: formatExtensions(extensions),
    formatLabel: (options?: FileTypeLabelOptions) => formatExtensions(options?.useAllExtensions ? extensions : displayExtensions, options),
    hasExtension: (extension: string) => extensions.includes(normalizeExtension(extension)),
  };
};

export const getFileTypePresetConfig = (preset: FileTypePreset) => getFileTypeConfig(...fileTypePresets[preset]);

export { fileTypePresets, fileTypes };
