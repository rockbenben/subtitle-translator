"use client";

import { useState, useCallback } from "react";
import { Modal, Input, Button, Flex, Space, App, Typography } from "antd";
import { useTranslations, useLocale } from "next-intl";
import { languages, LANGUAGE_PRESETS } from "@/app/lib/translation";
import { getDocUrl, isChineseLocale } from "@/app/utils/localeUtils";

const { TextArea } = Input;
const { Text, Link } = Typography;

// Extract valid language codes (excluding 'auto')
const validLanguageCodes = new Set(languages.filter((lang) => lang.value !== "auto").map((lang) => lang.value));

interface MultiLanguageSettingsModalProps {
  open: boolean;
  onClose: () => void;
  targetLanguages: string[];
  setTargetLanguages: (langs: string[]) => void;
  setMultiLanguageMode: (mode: boolean) => void;
}

/**
 * Modal for batch editing multi-language settings.
 * Input format: language codes separated by comma (English/Chinese) or space.
 * Example: en,zh,ja or en zh ja or en，zh，ja
 */
const MultiLanguageSettingsModal = ({ open, onClose, targetLanguages, setTargetLanguages, setMultiLanguageMode }: MultiLanguageSettingsModalProps) => {
  const t = useTranslations("common");
  const locale = useLocale();
  const { message } = App.useApp();

  const [inputValue, setInputValue] = useState("");

  // Sync input value when modal finishes opening (avoids set-state-in-effect and ref-during-render)
  const handleAfterOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setInputValue(targetLanguages.join(", "));
      }
    },
    [targetLanguages],
  );

  const handleApply = () => {
    // Parse input: split by comma (English/Chinese) or space
    const rawLangs = inputValue
      .replace(/，/g, ",") // Convert Chinese comma to English comma
      .split(/[\s,]+/) // Split by space or comma
      .map((lang) => lang.trim().toLowerCase())
      .filter(Boolean);

    // Empty input (nothing typed / only whitespace) → just close, don't show a
    // malformed "Unrecognized: " warning with an empty list.
    if (rawLangs.length === 0) {
      onClose();
      return;
    }

    // Partition into valid / unrecognized codes (de-duped, order-preserving).
    const uniqueLangs = [...new Set(rawLangs.filter((lang) => validLanguageCodes.has(lang)))];
    const unrecognized = [...new Set(rawLangs.filter((lang) => !validLanguageCodes.has(lang)))];

    // Nothing valid parsed out of a non-empty input — warn and keep the modal open
    // instead of silently applying an empty selection as "success".
    if (uniqueLangs.length === 0) {
      message.warning(t("unrecognizedLangCodes", { codes: unrecognized.join(", ") }));
      return;
    }

    setTargetLanguages(uniqueLangs);
    setMultiLanguageMode(true); // Always enable multi-language mode

    // Some codes were dropped — apply the valid ones but flag the rest.
    if (unrecognized.length > 0) {
      message.warning(t("ignoredLangCodes", { codes: unrecognized.join(", ") }));
    } else {
      message.success(t("settingsApplied"));
    }
    onClose();
  };

  // 语言代码对照表在 api.html,锚点随文档语言不同(中文页中文锚、英文页英文锚)。
  const langCodesUrl = getDocUrl(isChineseLocale(locale) ? "guide/translation/api.html#语言代码对照表" : "guide/translation/api.html#language-code-reference", locale);

  return (
    <Modal
      title={t("multiLangSettingsTitle")}
      open={open}
      onCancel={onClose}
      afterOpenChange={handleAfterOpenChange}
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

      {/* Quick-pick presets — append to existing input so users can stack. */}
      <Flex gap={4} wrap className="mb-2">
        {LANGUAGE_PRESETS.map((p) => (
          <Button
            key={p.key}
            size="small"
            onClick={() => {
              // Merge into the textarea: parse current → union with preset → write back.
              const existing = inputValue
                .replace(/，/g, ",")
                .split(/[\s,]+/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              const merged = [...new Set([...existing, ...p.codes])];
              setInputValue(merged.join(", "));
            }}>
            {t(p.labelKey)}
          </Button>
        ))}
      </Flex>

      <TextArea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="en, zh, ja, ko, de, fr, es"
        rows={3}
        style={{ fontFamily: "monospace" }}
        aria-label={t("multiLangSettingsTitle")}
        spellCheck={false}
      />
    </Modal>
  );
};

export default MultiLanguageSettingsModal;
