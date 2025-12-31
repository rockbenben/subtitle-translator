"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Button, Space, App, Typography } from "antd";
import { useTranslations, useLocale } from "next-intl";
import { languages } from "@/app/lib/translation";

const { TextArea } = Input;
const { Text, Link } = Typography;

// Extract valid language codes (excluding 'auto')
const validLanguageCodes = new Set(languages.filter((lang) => lang.value !== "auto").map((lang) => lang.value));

interface MultiLanguageSettingsModalProps {
  open: boolean;
  onClose: () => void;
  target_langs: string[];
  setTarget_langs: (langs: string[]) => void;
  setMultiLanguageMode: (mode: boolean) => void;
}

/**
 * Modal for batch editing multi-language settings.
 * Input format: language codes separated by comma (English/Chinese) or space.
 * Example: en,zh,ja or en zh ja or en，zh，ja
 */
const MultiLanguageSettingsModal = ({ open, onClose, target_langs, setTarget_langs, setMultiLanguageMode }: MultiLanguageSettingsModalProps) => {
  const t = useTranslations("common");
  const locale = useLocale();
  const { message } = App.useApp();

  const [inputValue, setInputValue] = useState("");

  // Update input value when modal opens
  useEffect(() => {
    if (open) {
      setInputValue(target_langs.join(", "));
    }
  }, [open, target_langs]);

  const handleApply = () => {
    // Parse input: split by comma (English/Chinese) or space
    const rawLangs = inputValue
      .replace(/，/g, ",") // Convert Chinese comma to English comma
      .split(/[\s,]+/) // Split by space or comma
      .map((lang) => lang.trim().toLowerCase())
      .filter(Boolean);

    // Filter valid language codes and remove duplicates
    const validLangs = rawLangs.filter((lang) => validLanguageCodes.has(lang));
    const uniqueLangs = [...new Set(validLangs)];

    setTarget_langs(uniqueLangs);
    setMultiLanguageMode(true); // Always enable multi-language mode

    message.success(t("settingsApplied"));
    onClose();
  };

  // Use zh for Chinese locales, en for others
  const docLocale = locale === "zh" || locale === "zh-hant" ? "zh" : "en";
  const langCodesUrl = `https://docs.newzone.top/${docLocale}/guide/translation/supported-languages.html`;

  return (
    <Modal
      title={t("multiLangSettingsTitle")}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" onClick={handleApply}>
            {t("apply")}
          </Button>
        </Space>
      }
      width={400}>
      <div className="mb-3">
        <Text type="secondary">
          {t("multiLangSettingsHint")}{" "}
          <Link href={langCodesUrl} target="_blank">
            {t("viewLanguageCodes")}
          </Link>
        </Text>
      </div>
      <TextArea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="en, zh, ja, ko, de, fr, es"
        rows={3}
        style={{ fontFamily: "monospace" }}
        aria-label={t("multiLangSettingsTitle")}
      />
    </Modal>
  );
};

export default MultiLanguageSettingsModal;
