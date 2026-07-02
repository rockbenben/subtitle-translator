// 字体建议(AutoComplete options)。labelKey = i18n 键后缀(SubtitleTranslator.fontGroup.*)。
// 用户仍可输入列表外任意字体名;字体最终在播放机器上必须存在才生效。
export interface FontGroup {
  labelKey: string;
  fonts: string[];
}

export const FONT_SUGGESTION_GROUPS: FontGroup[] = [
  { labelKey: "broad", fonts: ["Noto Sans", "Noto Sans CJK SC", "Arial"] },
  { labelKey: "zhHans", fonts: ["Microsoft YaHei", "Source Han Sans SC", "SimHei", "SimSun"] },
  { labelKey: "zhHant", fonts: ["Microsoft JhengHei", "Noto Sans TC", "PMingLiU"] },
  { labelKey: "japanese", fonts: ["Yu Gothic", "Meiryo", "Noto Sans JP"] },
  { labelKey: "korean", fonts: ["Malgun Gothic", "Noto Sans KR"] },
  { labelKey: "arabic", fonts: ["Noto Sans Arabic", "Arial"] },
  { labelKey: "devanagari", fonts: ["Nirmala UI", "Noto Sans Devanagari"] },
  { labelKey: "thai", fonts: ["Leelawadee UI", "Noto Sans Thai"] },
  { labelKey: "latin", fonts: ["Arial", "Roboto", "Noto Sans"] },
];
