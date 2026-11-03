"use client";

import { useState } from "react";
import { Modal, Input, Button, Flex, Space, App, Typography, theme } from "antd";
import { useTranslations, useLocale } from "next-intl";
import { languages, LANGUAGE_PRESETS } from "@/app/lib/translation";
import { getDocUrl, isChineseLocale } from "@/app/utils/localeUtils";
import { collidesWithSource } from "@/app/utils/sourceLanguageRule";

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
  /** 当前源语言：源语言不能同时当目标（见 handleApply）。 */
  sourceLanguage: string;
}

/**
 * Modal for batch editing multi-language settings.
 * Input format: language codes separated by comma (English/Chinese) or space.
 * Example: en,zh,ja or en zh ja or en，zh，ja
 */
const MultiLanguageSettingsModal = ({ open, onClose, targetLanguages, setTargetLanguages, setMultiLanguageMode, sourceLanguage }: MultiLanguageSettingsModalProps) => {
  const t = useTranslations("common");
  const locale = useLocale();
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const [inputValue, setInputValue] = useState("");

  // 打开【瞬间】播种输入框(render-time prev-state 模式,同 ApiStatusBlock /
  // TranslateFailurePanel)。此前用 afterOpenChange:它等 ~0.3s 开启动画结束
  // 才回写 —— 期间显示上次会话的旧内容(闪烁),且动画窗口内点预设按钮的
  // 写入会被回写覆盖丢失(预设按钮就在输入框上方,一次点击即触发)。
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setInputValue(targetLanguages.join(", "));
  }

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

    // 源语言不能同时当目标：translateCore 遇到 source === target 直接原文短路
    // (lib/translation/pipeline.ts)。写入口（useTranslationState）会把它剔掉 ——
    // 但这里必须【先说清楚】：只输出了源语言一个码就点「应用」，若照旧报「设置已
    // 应用」，用户得到的是空目标列表 + 绿灯，下一次点翻译才见「至少选择一种目标
    // 语言」。剔掉哪一个，就得让用户看得见哪一个。判据与写入口同一份
    // (utils/sourceLanguageRule)。
    const sourceCodes = uniqueLangs.filter((lang) => collidesWithSource(lang, sourceLanguage));
    const applicable = uniqueLangs.filter((lang) => !collidesWithSource(lang, sourceLanguage));

    if (applicable.length === 0) {
      message.warning(t("noTargetLanguage"));
      // 说清是哪些码被丢掉了 —— 只说「没有可用的目标语言」的话,用户不知道自己
      // 刚敲的码去哪儿了:是被源语言吃掉了(自己选的码,规则不让它当目标),
      // 还是压根不认(可能拼错了)。两种被丢掉的理由都值得点名。
      if (sourceCodes.length > 0) message.warning(t("ignoredSourceLangCodes", { codes: sourceCodes.join(", ") }));
      if (unrecognized.length > 0) message.warning(t("ignoredLangCodes", { codes: unrecognized.join(", ") }));
      return;
    }

    setTargetLanguages(applicable);
    setMultiLanguageMode(true); // Always enable multi-language mode

    // Some codes were dropped — apply the valid ones but flag the rest.
    if (unrecognized.length > 0) {
      message.warning(t("ignoredLangCodes", { codes: unrecognized.join(", ") }));
    }
    if (sourceCodes.length > 0) {
      message.warning(t("ignoredSourceLangCodes", { codes: sourceCodes.join(", ") }));
    }
    if (unrecognized.length === 0 && sourceCodes.length === 0) {
      message.success(t("settingsApplied"));
    }
    onClose();
  };

  // 语言代码对照表在 api.html,锚点随文档语言不同(中文页中文锚、英文页英文锚)。
  const langCodesUrl = getDocUrl(isChineseLocale(locale) ? "guide/translation/api.html#语言代码对照表" : "guide/translation/api.html#language-code-reference", locale);

  return (
    <Modal
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span aria-hidden style={{ width: 7, height: 7, background: token.colorPrimary, display: "inline-block" }} />
          {t("multiLangSettingsTitle")}
        </span>
      }
      open={open}
      destroyOnHidden
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" onClick={handleApply}>
            {t("apply")}
          </Button>
        </Space>
      }
      width={420}>
      <Space orientation="vertical" size="middle" style={{ width: "100%", marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t("multiLangSettingsHint")}{" "}
          <Link href={langCodesUrl} target="_blank">
            {t("viewLanguageCodes")}
          </Link>
        </Text>

        {/* Quick-pick presets — append to existing input so users can stack. */}
        <Flex gap={6} wrap>
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
          style={{ fontFamily: token.fontFamilyCode, fontSize: 13 }}
          aria-label={t("multiLangSettingsTitle")}
          spellCheck={false}
        />
      </Space>
    </Modal>
  );
};

export default MultiLanguageSettingsModal;
