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
} from "@ant-design/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

// 排除当前项目 "subtitle-translator",
const projectCategories = {
  translate: ["json-translate", "md-translator", "aishort-translate"],
  textParser: ["text-splitter", "chinese-conversion", "novel-processor", "regex-matcher", "text-processor"],
  jsonParser: ["json-value-extractor", "json-node-edit", "json-value-transformer", "json-value-swapper", "json-node-inserter", "json-sort-classify", "json-match-update"],
  dataParser: ["data-parser/flare", "data-parser/img-prompt"],
};

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
    titleKey: "简繁转换",
    descriptionKey: "批量转换简体、台湾繁体、香港繁体和日本新字体",
    key: "chinese-conversion",
    icon: <SwapOutlined />,
    onlyzh: true,
  },
  {
    titleKey: "正则文本助手",
    descriptionKey: "集成正则匹配、排序、过滤等功能，进行文本批量处理",
    key: "regex-matcher",
    icon: <CodeOutlined />,
    onlyzh: true,
  },
  {
    titleKey: "小说文本处理",
    descriptionKey: "批量处理不规范格式的小说长文本",
    key: "novel-processor",
    icon: <FontSizeOutlined />,
    onlyzh: true,
  },
  {
    titleKey: "自用文本处理",
    descriptionKey: "自用多种规则的文本处理工具",
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
    titleKey: "AIShort 多语言翻译",
    descriptionKey: "一键翻译 ChatGPT Shortcut 13 种语言",
    key: "aishort-translate",
    icon: <GlobalOutlined />,
    onlyzh: true,
  },
];

const projectsMap = projects.reduce((acc, project) => {
  acc[project.key] = project;
  return acc;
}, {});

export const AppMenu = () => {
  const t = useTranslations();
  const locale = useLocale();
  const isChineseLocale = locale === "zh" || locale === "zh-hant";

  const createMenuItem = (projectKey) => {
    const project = projectsMap[projectKey];
    if (!project || (project.onlyzh && locale !== "zh")) {
      return null;
    }
    return {
      label: <Link href={`/${locale}/${project.key}`}>{project.onlyzh && locale === "zh" ? project.titleKey : t(project.titleKey)}</Link>,
      key: project.key,
      icon: project.icon,
    };
  };

  const generateCategoryItems = (categoryKeys) => {
    return categoryKeys.map(createMenuItem).filter(Boolean);
  };

  const otherToolsItems = [
    {
      label: (
        <a href={isChineseLocale ? "https://www.aishort.top/" : `https://www.aishort.top/${locale}`} target="_blank" rel="noopener noreferrer">
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

  if (isChineseLocale) {
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
      key: "subtitle-translator",
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
      label: <Link href={`https://tools.newzone.top/${locale}/feedback`}>{t("feedback.feedback1")}</Link>,
      key: "feedback",
    },
  ];

  return menuItems;
};
