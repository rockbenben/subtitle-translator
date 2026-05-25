"use client";

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

// Permissive option shape: when options are grouped (optGroups), antd passes
// DefaultOptionType which has no `name` field. Treat each match field as
// optional and defensively coerce to string.
export const filterLanguageOption = ({ input, option }: { input: string; option?: { label?: unknown; name?: unknown; value?: unknown } }) => {
  const normalizedInput = normalizeText(input);
  const normalizedLabel = normalizeText(typeof option?.label === "string" ? option.label : "");
  const normalizedName = normalizeText(typeof option?.name === "string" ? option.name : "");
  const normalizedValue = normalizeText(typeof option?.value === "string" ? option.value : "");

  return normalizedLabel.includes(normalizedInput) || normalizedName.includes(normalizedInput) || normalizedValue.includes(normalizedInput);
};
