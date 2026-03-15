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
  json: {
    extensions: [".json"],
  },
  subtitle: {
    extensions: [".srt", ".ass", ".vtt", ".lrc"],
  },
  data: {
    extensions: [".csv", ".tsv", ".xml"],
  },
  yaml: {
    extensions: [".yaml", ".yml"],
  },
  config: {
    extensions: [".ini", ".log"],
  },
  web: {
    extensions: [".html", ".css", ".js"],
  },
  code: {
    extensions: [".py", ".java", ".sql"],
  },
} as const satisfies Record<string, FileTypeDefinition>;

export type FileTypeCategory = keyof typeof fileTypes;

const fileTypePresets = {
  jsonText: ["text", "json"],
  markdownText: ["text", "markdown"],
  subtitle: ["subtitle"],
  flare: ["web", "json", "yaml", "text"],
  richText: ["text", "markdown", "json", "subtitle", "data", "yaml", "config", "web", "code"],
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
