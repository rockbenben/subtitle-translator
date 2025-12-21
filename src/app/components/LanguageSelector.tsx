"use client";

import { useState, useMemo } from "react";
import { Row, Col, Form, Select, Switch, Card, Flex, Tooltip, Typography, Checkbox, Input, Button, Divider } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useLanguageOptions, filterLanguageOption } from "@/app/components/languages";

const { Text } = Typography;

interface LanguageSelectorProps {
  sourceLanguage: string;
  targetLanguage: string;
  target_langs: string[];
  multiLanguageMode: boolean;
  handleLanguageChange: (type: "source" | "target", value: string) => void;
  setTarget_langs: (value: string[]) => void;
  setMultiLanguageMode: (value: boolean) => void;
}

/**
 * Shared component for source/target language selection with multi-language mode toggle.
 * Used in SubtitleTranslator, MDTranslator, and JSONTranslator.
 */
const LanguageSelector = ({ sourceLanguage, targetLanguage, target_langs, multiLanguageMode, handleLanguageChange, setTarget_langs, setMultiLanguageMode }: LanguageSelectorProps) => {
  const t = useTranslations("common");
  const { sourceOptions, targetOptions } = useLanguageOptions();
  const [searchValue, setSearchValue] = useState("");

  // Filter options based on search - using same logic as source language selector
  const filteredOptions = useMemo(() => {
    if (!searchValue) return targetOptions;
    return targetOptions.filter((opt) => filterLanguageOption({ input: searchValue, option: opt }));
  }, [targetOptions, searchValue]);

  // Handle checkbox change
  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (checked) {
      setTarget_langs([...target_langs, value]);
    } else {
      setTarget_langs(target_langs.filter((v) => v !== value));
    }
  };

  // Select all filtered options
  const handleSelectAll = () => {
    const allValues = filteredOptions.map((opt) => opt.value);
    const newSelection = [...new Set([...target_langs, ...allValues])];
    setTarget_langs(newSelection);
  };

  // Clear all selections
  const handleClearAll = () => {
    setTarget_langs([]);
  };

  // Custom dropdown content for multi-language mode
  const dropdownRender = () => (
    <div style={{ padding: 8 }}>
      <Input prefix={<SearchOutlined />} placeholder={t("search")} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} style={{ marginBottom: 8 }} allowClear />
      <Flex gap={8} style={{ marginBottom: 8 }}>
        <Button size="small" onClick={handleSelectAll}>
          {t("selectAll")}
        </Button>
        <Button size="small" onClick={handleClearAll}>
          {t("clearAll")}
        </Button>
      </Flex>
      <Divider style={{ margin: "8px 0" }} />
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {filteredOptions.map((opt) => (
            <Checkbox key={opt.value} checked={target_langs.includes(opt.value)} onChange={(e) => handleCheckboxChange(opt.value, e.target.checked)} style={{ marginInlineStart: 0 }}>
              {opt.label}
            </Checkbox>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Card size="small" styles={{ body: { padding: 12 } }}>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label={t("sourceLanguage")} style={{ marginBottom: 8 }}>
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
        <Col span={12}>
          <Form.Item label={t("targetLanguage")} style={{ marginBottom: 8 }}>
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
                value={target_langs.length > 0 ? `${t("selectedLanguages")} ${target_langs.length}` : undefined}
                placeholder={t("selectMultiTargetLanguages")}
                popupRender={dropdownRender}
                popupStyle={{ minWidth: 480 }}
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

      <Flex justify="end">
        <Tooltip title={t("multiLanguageModeTooltip")}>
          <Flex gap={6} align="center" onClick={() => setMultiLanguageMode(!multiLanguageMode)} style={{ cursor: "pointer" }}>
            <Switch size="small" checked={multiLanguageMode} onChange={setMultiLanguageMode} aria-label={t("multiLanguageMode")} />
            <Text type="secondary">{t("multiLanguageMode")}</Text>
          </Flex>
        </Tooltip>
      </Flex>
    </Card>
  );
};

export default LanguageSelector;
