"use client";

import { useState, useMemo } from "react";
import { Row, Col, Form, Select, Switch, Flex, Tooltip, Typography, Checkbox, Input, Button, Divider, theme } from "antd";
import { SearchOutlined, SwapOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useLanguageOptions, filterLanguageOption } from "@/app/components/languages";

const { Text } = Typography;

interface LanguageSelectorProps {
  sourceLanguage: string;
  targetLanguage: string;
  targetLanguages: string[];
  multiLanguageMode: boolean;
  handleLanguageChange: (type: "source" | "target", value: string) => void;
  handleSwapLanguages?: () => void;
  setTargetLanguages: (value: string[]) => void;
  setMultiLanguageMode: (value: boolean) => void;
}

/**
 * Shared component for source/target language selection with multi-language mode toggle.
 * Used in SubtitleTranslator, MDTranslator, and JSONTranslator.
 */
const LanguageSelector = ({ sourceLanguage, targetLanguage, targetLanguages, multiLanguageMode, handleLanguageChange, handleSwapLanguages, setTargetLanguages, setMultiLanguageMode }: LanguageSelectorProps) => {
  const t = useTranslations("common");
  const { sourceOptions, targetOptions } = useLanguageOptions();
  const [searchValue, setSearchValue] = useState("");
  const { token } = theme.useToken();

  // Filter options based on search - using same logic as source language selector
  const filteredOptions = useMemo(() => {
    if (!searchValue) return targetOptions;
    return targetOptions.filter((opt) => filterLanguageOption({ input: searchValue, option: opt }));
  }, [targetOptions, searchValue]);

  // Handle checkbox change
  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (checked) {
      setTargetLanguages([...targetLanguages, value]);
    } else {
      setTargetLanguages(targetLanguages.filter((v) => v !== value));
    }
  };

  // Select all filtered options
  const handleSelectAll = () => {
    const allValues = filteredOptions.map((opt) => opt.value);
    const newSelection = [...new Set([...targetLanguages, ...allValues])];
    setTargetLanguages(newSelection);
  };

  // Clear all selections
  const handleClearAll = () => {
    setTargetLanguages([]);
  };

  // Custom dropdown content for multi-language mode
  const dropdownRender = () => (
    <div style={{ padding: 8 }}>
      <Input prefix={<SearchOutlined />} placeholder={t("search")} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="!mb-2" allowClear />
      <Flex gap={8} className="!mb-2">
        <Button size="small" onClick={handleSelectAll}>
          {t("selectAll")}
        </Button>
        <Button size="small" onClick={handleClearAll}>
          {t("clearAll")}
        </Button>
      </Flex>
      <Divider className="!my-0" />
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {filteredOptions.map((opt) => (
            <Checkbox key={opt.value} checked={targetLanguages.includes(opt.value)} onChange={(e) => handleCheckboxChange(opt.value, e.target.checked)} className="!m-0">
              {opt.label}
            </Checkbox>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        padding: token.paddingSM,
        background: "transparent",
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}>
      <Row gutter={8} align="bottom" wrap={false}>
        <Col flex="1" style={{ minWidth: 0 }}>
          <Form.Item label={t("sourceLanguage")} className="!mb-0">
            <Select
              value={sourceLanguage}
              onChange={(e) => handleLanguageChange("source", e)}
              options={sourceOptions}
              placeholder={t("selectSourceLanguage")}
              showSearch={{
                optionFilterProp: "children",
                filterOption: (input, option) => filterLanguageOption({ input, option }),
              }}
              className="w-full"
              aria-label={t("sourceLanguage")}
            />
          </Form.Item>
        </Col>
        {handleSwapLanguages && (
          <Col flex="none" style={{ paddingBottom: 1 }}>
            <Tooltip title={`${t("sourceLanguage")} ⇄ ${t("targetLanguage")}`} placement="top">
              <Button
                type="text"
                size="small"
                icon={<SwapOutlined />}
                onClick={handleSwapLanguages}
                disabled={sourceLanguage === "auto" || multiLanguageMode}
                aria-label={`${t("sourceLanguage")} ⇄ ${t("targetLanguage")}`}
              />
            </Tooltip>
          </Col>
        )}
        <Col flex="1" style={{ minWidth: 0 }}>
          <Form.Item label={t("targetLanguage")} className="!mb-0">
            {!multiLanguageMode ? (
              <Select
                value={targetLanguage}
                onChange={(e) => handleLanguageChange("target", e)}
                options={targetOptions}
                placeholder={t("selectTargetLanguage")}
                showSearch={{
                  optionFilterProp: "children",
                  filterOption: (input, option) => filterLanguageOption({ input, option }),
                }}
                className="w-full"
                aria-label={t("targetLanguage")}
              />
            ) : (
              <Select
                open={undefined}
                value={targetLanguages.length > 0 ? `${t("selectedLanguages")} ${targetLanguages.length}` : undefined}
                placeholder={t("selectMultiTargetLanguages")}
                popupRender={dropdownRender}
                popupStyle={{ minWidth: "min(480px, 90vw)" }}
                className="w-full"
                aria-label={t("targetLanguage")}
                popupMatchSelectWidth={false}
                onOpenChange={(open) => {
                  if (!open) setSearchValue("");
                }}
              />
            )}
          </Form.Item>
        </Col>
      </Row>

      <Flex justify="end" style={{ marginTop: token.marginXS }}>
        <Tooltip title={t("multiLanguageModeTooltip")} placement="bottom">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <Switch
              size="small"
              checked={multiLanguageMode}
              onChange={(checked) => {
                // 切到多语言模式时把当前 targetLanguage 也带进 targetLanguages,
                // 避免「target=en + 开多语言 → 实际只翻 zh」的反直觉行为。这里 inline
                // 处理 (而非 wrap setMultiLanguageMode) 是为了避开 closure 陷阱:
                // MultiLanguageSettingsModal Apply 路径会同 tick 先 setTargetLanguages
                // 再 setMultiLanguageMode,若全局 wrap 会读到旧 closure 覆盖用户选择。
                if (checked && !targetLanguages.includes(targetLanguage)) {
                  setTargetLanguages([...targetLanguages, targetLanguage]);
                }
                setMultiLanguageMode(checked);
              }}
              aria-label={t("multiLanguageMode")}
            />
            <Text type="secondary">{t("multiLanguageMode")}</Text>
          </label>
        </Tooltip>
      </Flex>
    </div>
  );
};

export default LanguageSelector;
