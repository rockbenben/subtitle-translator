"use client";

import {
  BgColorsOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ScissorOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  CodeOutlined,
  GlobalOutlined,
  BookOutlined,
  FileSearchOutlined,
  EditOutlined,
  SwapOutlined,
  FileSyncOutlined,
  NodeIndexOutlined,
  VideoCameraOutlined,
  FileMarkdownOutlined,
  TranslationOutlined,
  LinkOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
  OrderedListOutlined,
  ToolOutlined,
  MessageOutlined,
  DiffOutlined,
  MergeCellsOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { isChineseLocale } from "@/app/utils";
import { TOOL_REGISTRY, TOOL_KEYS, toolPathsByGroup, type ToolKey } from "@/app/lib/toolRegistry";

// 子项目导航：本仓库对应的工具走相对首页 `/${locale}`，其余工具指向主站。
// 工具集合 / 分组 / 标题全部从 TOOL_REGISTRY + i18n 派生 —— 不再硬编码、不再有
// onlyzh 隐藏（文本类工具均已 i18n 化，应在所有语言下显示）。
const MAIN_SITE = "https://tools.newzone.top";
// ⚠ 每个子项目只改这一行：本仓库对应工具的 path（见 TOOL_REGISTRY）。
const CURRENT_TOOL_PATH = "subtitle-translator";

/** Per-tool icon — icons are React nodes (UI-only), so they live here, not in
 *  TOOL_REGISTRY. TS enforces one entry per ToolKey. */
const TOOL_ICONS: Record<ToolKey, React.ReactNode> = {
  subtitleTranslator: <VideoCameraOutlined />,
  mdTranslator: <FileMarkdownOutlined />,
  jsonTranslate: <TranslationOutlined />,
  textSplitter: <ScissorOutlined />,
  chineseConversion: <SwapOutlined />,
  novelProcessor: <FontSizeOutlined />,
  textToolbox: <CodeOutlined />,
  textJoiner: <MergeCellsOutlined />,
  textDiff: <DiffOutlined />,
  dataBatch: <ProfileOutlined />,
  jsonValueExtractor: <FileSearchOutlined />,
  jsonNodeEdit: <EditOutlined />,
  jsonValueTransformer: <FileSyncOutlined />,
  jsonValueSwapper: <SwapOutlined />,
  jsonNodeInserter: <NodeIndexOutlined />,
  jsonSortClassify: <OrderedListOutlined />,
  jsonMatchUpdate: <UnorderedListOutlined />,
  dataParserFlare: <LinkOutlined />,
  dataParserImgPrompt: <UnorderedListOutlined />,
};

/** path → toolKey, for looking up icon / i18n title from a category path. */
const PATH_TO_KEY = TOOL_KEYS.reduce<Record<string, ToolKey>>((acc, k) => {
  acc[TOOL_REGISTRY[k].path] = k;
  return acc;
}, {});

/** UI grouping derived from TOOL_REGISTRY — single source of truth. */
const projectCategories = {
  translate: toolPathsByGroup("translate"),
  textParser: toolPathsByGroup("textParser"),
  jsonParser: toolPathsByGroup("jsonParser"),
  dataParser: toolPathsByGroup("dataParser"),
} as const;

interface ExternalTool {
  title: string;
  key: string;
  icon: React.ReactNode;
  chineseOnly?: boolean;
}

const externalTools: ExternalTool[] = [
  { title: "ChatGPT Shortcut", key: "aishort", icon: <ExperimentOutlined /> },
  { title: "Legend Talk", key: "legendtalk", icon: <MessageOutlined /> },
  { title: "IMGPrompt", key: "imgprompt", icon: <BgColorsOutlined /> },
  { title: "LearnData 开源笔记", key: "learndata", icon: <BookOutlined />, chineseOnly: true },
];

const getExternalHref = (key: string, locale: string, isChinese: boolean): string => {
  switch (key) {
    case "aishort":
      if (locale === "zh") return "https://www.aishort.top/";
      if (locale === "zh-hant") return "https://www.aishort.top/zh-Hant";
      if (locale === "id") return "https://www.aishort.top/ind";
      return `https://www.aishort.top/${locale}`;
    case "imgprompt":
      return `https://prompt.newzone.top/${locale}`;
    case "legendtalk":
      return "https://talk.newzone.top";
    case "learndata":
      return "https://newzone.top/";
    default:
      return "#";
  }
};

export const useAppMenu = () => {
  const t = useTranslations();
  const locale = useLocale();
  const isChinese = isChineseLocale(locale);

  // 当前工具 → 相对首页；其它工具 → 主站。所有工具均已 i18n，无 onlyzh 隐藏。
  const createMenuItem = (path: string) => {
    const toolKey = PATH_TO_KEY[path];
    if (!toolKey) return null;
    const href = path === CURRENT_TOOL_PATH ? `/${locale}` : `${MAIN_SITE}/${locale}/${path}`;
    return {
      label: (
        <Link href={href} prefetch={false}>
          {t(`tools.${toolKey}.title`)}
        </Link>
      ),
      key: path,
      icon: TOOL_ICONS[toolKey],
    };
  };

  // 当前工具是首页/品牌入口，不在分组里重复列出。
  const generateCategoryItems = (paths: readonly string[]) => paths.filter((p) => p !== CURRENT_TOOL_PATH).map(createMenuItem).filter(Boolean);

  const createExternalToolItem = (tool: ExternalTool) => {
    if (tool.chineseOnly && !isChinese) return null;
    return {
      label: (
        <a href={getExternalHref(tool.key, locale, isChinese)} target="_blank" rel="noopener noreferrer">
          {tool.title}
        </a>
      ),
      key: tool.key,
      icon: tool.icon,
    };
  };

  const otherToolsItems = externalTools.map(createExternalToolItem).filter(Boolean);

  const currentToolKey = PATH_TO_KEY[CURRENT_TOOL_PATH];

  const menuItems = [
    {
      label: <Link href={`/${locale}`}>{currentToolKey ? t(`tools.${currentToolKey}.title`) : t("navigation.home")}</Link>,
      key: "home",
    },
    {
      label: t("navigation.translate"),
      key: "translate",
      icon: <GlobalOutlined />,
      children: generateCategoryItems(projectCategories.translate),
    },
    {
      label: t("navigation.textParser"),
      key: "textParser",
      icon: <FileTextOutlined />,
      children: generateCategoryItems(projectCategories.textParser),
    },
    {
      label: t("navigation.jsonParser"),
      key: "jsonParser",
      icon: <DatabaseOutlined />,
      children: generateCategoryItems(projectCategories.jsonParser),
    },
    {
      label: t("navigation.dataParser"),
      key: "dataParser",
      icon: <FileSearchOutlined />,
      children: generateCategoryItems(projectCategories.dataParser),
    },
    {
      label: t("navigation.otherTools"),
      key: "otherTools",
      icon: <ToolOutlined />,
      children: otherToolsItems,
    },
    {
      label: <Link href={`${MAIN_SITE}/${locale}/feedback`}>{t("feedback.feedback1")}</Link>,
      key: "feedback",
    },
  ];

  return menuItems;
};
