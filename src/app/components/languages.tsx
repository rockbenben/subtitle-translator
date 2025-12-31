import { languages } from "@/app/lib/translation";
import { useTranslations } from "next-intl";

export const useLanguageOptions = () => {
  const t = useTranslations();

  // Create source options with translations
  const sourceOptions = languages.map((language) => ({
    ...language,
    label: `${t(`languages.${language.value}`)} (${language.nativelabel})`,
  }));

  // Create target options with translations (excluding "auto")
  const targetOptions = languages
    .filter((language) => language.value !== "auto")
    .map((language) => ({
      ...language,
      label: `${t(`languages.${language.value}`)} (${language.nativelabel})`,
    }));

  return { sourceOptions, targetOptions };
};

const normalizeText = (text = "") => text.trim().toLowerCase();

export const filterLanguageOption = ({ input, option }: { input: string; option?: { label: string; name: string; value: string } }) => {
  const normalizedInput = normalizeText(input);
  const normalizedLabel = normalizeText(option?.label);
  const normalizedName = normalizeText(option?.name);
  const normalizedValue = normalizeText(option?.value);

  // 如果 label、name 或 value (language code) 包含输入的内容，则返回 true
  return normalizedLabel.includes(normalizedInput) || normalizedName.includes(normalizedInput) || normalizedValue.includes(normalizedInput);
};
