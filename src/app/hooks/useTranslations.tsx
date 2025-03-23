import { useTranslations } from "next-intl";
import { languages } from "@/app/components/languages";

export const useLanguageOptions = () => {
  const t = useTranslations();

  // Create source options with translations
  const sourceOptions = languages.map((language) => ({
    ...language,
    label: `${t(language.labelKey)} (${language.nativeLabel})`,
  }));

  // Create target options with translations (excluding "auto")
  const targetOptions = languages
    .filter((language) => language.value !== "auto")
    .map((language) => ({
      ...language,
      label: `${t(language.labelKey)} (${language.nativeLabel})`,
    }));

  return { sourceOptions, targetOptions };
};
