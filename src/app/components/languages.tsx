import { languages } from "@/app/lib/translation";
import { useTranslations } from "next-intl";

export const useLanguageOptions = () => {
  const t = useTranslations();

  // Create source options with translations
  const sourceOptions = languages.map((language) => ({
    ...language,
    label: `${t(language.labelkey)} (${language.nativelabel})`,
  }));

  // Create target options with translations (excluding "auto")
  const targetOptions = languages
    .filter((language) => language.value !== "auto")
    .map((language) => ({
      ...language,
      label: `${t(language.labelkey)} (${language.nativelabel})`,
    }));

  return { sourceOptions, targetOptions };
};

const normalizeText = (text = "") => text.trim().toLowerCase();

export const filterLanguageOption = ({ input, option }: { input: string; option?: { label: string; name: string } }) => {
  const normalizedInput = normalizeText(input);
  const normalizedLabel = normalizeText(option?.label);
  const normalizedName = normalizeText(option?.name);

  // 如果 label 或 name 包含输入的内容，则返回 true
  return normalizedLabel.includes(normalizedInput) || normalizedName.includes(normalizedInput);
};
