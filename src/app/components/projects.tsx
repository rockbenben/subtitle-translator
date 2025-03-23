import {
  BgColorsOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ScissorOutlined,
  FileTextOutlined,
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
} from "@ant-design/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

export const projects = [
  {
    titleKey: "tools.jsonTranslate.title",
    descriptionKey: "tools.jsonTranslate.description",
    key: "json-translate",
    icon: <TranslationOutlined />,
  },
  {
    titleKey: "tools.subtitleTranslator.title",
    descriptionKey: "tools.subtitleTranslator.description",
    key: "subtitle-translator",
    icon: <VideoCameraOutlined />,
  },
  {
    titleKey: "tools.mdTranslator.title",
    descriptionKey: "tools.mdTranslator.description",
    key: "md-translator",
    icon: <FileMarkdownOutlined />,
  },
  {
    titleKey: "tools.textSplitter.title",
    descriptionKey: "tools.textSplitter.description",
    key: "text-splitter",
    icon: <ScissorOutlined />,
  },
  {
    titleKey: "tools.chineseConversion.title",
    descriptionKey: "tools.chineseConversion.description",
    key: "chinese-conversion",
    icon: <SwapOutlined />,
    onlyzh: true,
  },
  {
    titleKey: "tools.regexMatcher.title",
    descriptionKey: "tools.regexMatcher.description",
    key: "regex-matcher",
    icon: <CodeOutlined />,
    onlyzh: true,
  },
  {
    titleKey: "tools.textProcessor.title",
    descriptionKey: "tools.textProcessor.description",
    key: "text-processor",
    icon: <ProfileOutlined />,
    onlyzh: true,
  },
  {
    titleKey: "tools.jsonValueExtractor.title",
    descriptionKey: "tools.jsonValueExtractor.description",
    key: "json-value-extractor",
    icon: <FileSearchOutlined />,
  },
  {
    titleKey: "tools.jsonNodeEdit.title",
    descriptionKey: "tools.jsonNodeEdit.description",
    key: "json-node-edit",
    icon: <EditOutlined />,
  },
  {
    titleKey: "tools.jsonValueTransformer.title",
    descriptionKey: "tools.jsonValueTransformer.description",
    key: "json-value-transformer",
    icon: <FileSyncOutlined />,
  },
  {
    titleKey: "tools.jsonValueSwapper.title",
    descriptionKey: "tools.jsonValueSwapper.description",
    key: "json-value-swapper",
    icon: <SwapOutlined />,
  },
  {
    titleKey: "tools.jsonNodeInserter.title",
    descriptionKey: "tools.jsonNodeInserter.description",
    key: "json-node-inserter",
    icon: <NodeIndexOutlined />,
  },
  {
    titleKey: "tools.jsonSortClassify.title",
    descriptionKey: "tools.jsonSortClassify.description",
    key: "json-sort-classify",
    icon: <OrderedListOutlined />,
  },
  {
    titleKey: "tools.jsonMatchUpdate.title",
    descriptionKey: "tools.jsonMatchUpdate.description",
    key: "json-match-update",
    icon: <UnorderedListOutlined />,
  },
  {
    titleKey: "tools.dataParserFlare.title",
    descriptionKey: "tools.dataParserFlare.description",
    key: "data-parser/flare",
    icon: <LinkOutlined />,
  },
  {
    titleKey: "tools.dataParserImgPrompt.title",
    descriptionKey: "tools.dataParserImgPrompt.description",
    key: "data-parser/img-prompt",
    icon: <UnorderedListOutlined />,
  },
  {
    titleKey: "tools.aishortTranslate.title",
    descriptionKey: "tools.aishortTranslate.description",
    key: "aishort-translate",
    icon: <GlobalOutlined />,
    onlyzh: true,
  },
];

export const AppMenu = () => {
  const t = useTranslations();
  const locale = useLocale();

  // Function to create translated menu item from project
  const createMenuItem = (project) => {
    // Skip items that are Chinese-only when not in Chinese locale
    if (project.onlyzh && locale !== "zh") {
      return null;
    }

    return {
      label: <Link href={`https://tools.newzone.top/${locale}/${project.key}`}>{t(project.titleKey)}</Link>,
      key: project.key,
      icon: project.icon,
    };
  };

  // Group projects by category
  // 排除当前项目 "subtitle-translator",
  const translateItems = projects
    .filter((p) => ["json-translate", "md-translator", "aishort-translate"].includes(p.key))
    .map(createMenuItem)
    .filter(Boolean);

  const textParserItems = projects
    .filter((p) => ["text-splitter", "chinese-conversion", "regex-matcher", "text-processor"].includes(p.key))
    .map(createMenuItem)
    .filter(Boolean);

  const jsonParserItems = projects
    .filter((p) => p.key.startsWith("json-") && p.key !== "json-translate")
    .map(createMenuItem)
    .filter(Boolean);

  const dataParserItems = projects
    .filter((p) => p.key.startsWith("data-parser/"))
    .map(createMenuItem)
    .filter(Boolean);

  const getAishortLink = () => {
    if (locale === "zh" || locale === "zh-hant") {
      return "https://www.aishort.top/";
    }
    return `https://www.aishort.top/${locale}`;
  };

  const otherToolsItems = [
    {
      label: (
        <a href={getAishortLink()} target="_blank" rel="noopener noreferrer">
          ChatGPT Shortcut
        </a>
      ),
      key: "aishort",
      icon: <ExperimentOutlined />,
    },
    {
      label: (
        <a href={`https://prompt.newzone.top/app/${locale}`} target="_blank" rel="noopener noreferrer">
          IMGPrompt
        </a>
      ),
      key: "IMGPrompt",
      icon: <BgColorsOutlined />,
    },
  ];

  // Only add LearnData link for non-Chinese locales
  if (locale === "zh") {
    otherToolsItems.push({
      label: (
        <a href="https://newzone.top/" target="_blank" rel="noopener noreferrer">
          LearnData 开源笔记
        </a>
      ),
      key: "LearnData",
      icon: <BookOutlined />,
    });
  }
  const menuItems = [
    {
      label: <Link href={`/${locale}`}>{t("tools.subtitleTranslator.title")}</Link>,
      key: "home",
    },
    {
      label: t("navigation.translate"),
      key: "translate",
      icon: <GlobalOutlined />,
      children: translateItems,
    },
    {
      label: t("navigation.textParser"),
      key: "textParser",
      icon: <FileTextOutlined />,
      children: textParserItems,
    },
    {
      label: t("navigation.jsonParser"),
      key: "jsonParser",
      icon: <DatabaseOutlined />,
      children: jsonParserItems,
    },
    {
      label: t("navigation.dataParser"),
      key: "dataParser",
      icon: <FileSearchOutlined />,
      children: dataParserItems,
    },
    {
      label: t("navigation.otherTools"),
      key: "otherTools",
      icon: <ToolOutlined />,
      children: otherToolsItems,
    },
    {
      label: <Link href={`https://tools.newzone.top/${locale}/feedback`}>{t("feedback.feedback1")}</Link>,
      key: "feedback",
    },
  ];

  return menuItems;
};
