"use client";

import { useCallback, useMemo, useState } from "react";
import { Row, Col, Form, Select, Switch, Flex, Tooltip, Typography, Checkbox, Input, Button, Tag, Divider, theme } from "antd";
import type { SelectProps } from "antd";
import { SearchOutlined, SwapOutlined, CaretRightOutlined, CaretDownOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useLanguageOptions, filterLanguageOption } from "@/app/components/languages";
import { LANGUAGE_GROUPS, LANGUAGE_PRESETS } from "@/app/lib/translation";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { useRecentLanguages } from "@/app/hooks/useRecentLanguages";

const { Text } = Typography;

type LangOption = ReturnType<typeof useLanguageOptions>["targetOptions"][number];

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
 *
 * UX for 122 languages:
 * - Single-select: antd showSearch + a "Recent" optGroup pinned on top (last 5 picks)
 * - Multi-select popup: regional groups (Common / Europe / Middle East / etc.)
 *   collapsed by default except "Common"; search auto-expands; preset buttons
 *   ("Top 10 World" / "European Mainstream" / etc.) for one-tap bulk pick;
 *   selected chips above the grid let user see + remove individual picks;
 *   mobile single-column grid so long native labels don't overflow.
 */
const LanguageSelector = ({ sourceLanguage, targetLanguage, targetLanguages, multiLanguageMode, handleLanguageChange, handleSwapLanguages, setTargetLanguages, setMultiLanguageMode }: LanguageSelectorProps) => {
  const t = useTranslations("common");
  const { sourceOptions, targetOptions } = useLanguageOptions();
  const isMobile = useIsMobile();
  const { token } = theme.useToken();
  const { recentLanguages, pushRecentLanguage } = useRecentLanguages();
  const [searchValue, setSearchValue] = useState("");

  // Wrap the prop callback so single-select picks land in the recent list.
  const handleLanguagePick = (type: "source" | "target", value: string) => {
    pushRecentLanguage(value);
    handleLanguageChange(type, value);
  };

  // Build a code → LangOption lookup for O(1) access while grouping.
  const sourceByCode = useMemo(() => new Map(sourceOptions.map((o) => [o.value, o])), [sourceOptions]);
  const targetByCode = useMemo(() => new Map(targetOptions.map((o) => [o.value, o])), [targetOptions]);

  // For the single-select Selects: prepend a "Recent" optGroup when the user
  // has picked anything before. Falls back to flat list (current behavior) for
  // first-time users. Antd accepts a mixed array (options + optGroups), so the
  // wide return type is intentional.
  const buildSingleSelectOptions = useCallback(
    (options: LangOption[], byCode: Map<string, LangOption>): SelectProps["options"] => {
      if (recentLanguages.length === 0) return options;
      const recentOpts = recentLanguages.map((c) => byCode.get(c)).filter((o): o is LangOption => !!o);
      if (recentOpts.length === 0) return options;
      const recentSet = new Set(recentLanguages);
      const rest = options.filter((o) => !recentSet.has(o.value));
      return [
        { label: t("recentLanguages"), options: recentOpts },
        { label: t("langGroupCommon"), options: rest },
      ];
    },
    [recentLanguages, t],
  );
  const sourceSelectOptions = useMemo(() => buildSingleSelectOptions(sourceOptions, sourceByCode), [sourceOptions, sourceByCode, buildSingleSelectOptions]);
  const targetSelectOptions = useMemo(() => buildSingleSelectOptions(targetOptions, targetByCode), [targetOptions, targetByCode, buildSingleSelectOptions]);

  // ── Multi-select popup state ─────────────────────────────────────────────
  // Track per-group expanded state. Common is expanded by default — that's
  // the entry point for most users; the rest fold to keep the popup compact.
  // When search is active we ignore this and expand every visible group.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => ({ common: true }));

  // Filter groups + their codes based on search. Empty groups disappear so
  // the popup shrinks to just matches. Comparison uses the same predicate
  // as the single-select search (label / name / value).
  const visibleGroups = useMemo(() => {
    if (!searchValue.trim()) return LANGUAGE_GROUPS.map((g) => ({ ...g, codes: [...g.codes] }));
    return LANGUAGE_GROUPS.map((g) => ({
      ...g,
      codes: g.codes.filter((c) => {
        const opt = targetByCode.get(c);
        return opt ? filterLanguageOption({ input: searchValue, option: opt }) : false;
      }),
    })).filter((g) => g.codes.length > 0);
  }, [searchValue, targetByCode]);

  const isExpanded = (key: string) => (searchValue.trim() ? true : !!expandedGroups[key]);
  const toggleGroup = (key: string) => {
    if (searchValue.trim()) return; // disabled during search (everything is forced open)
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (checked) setTargetLanguages([...new Set([...targetLanguages, value])]);
    else setTargetLanguages(targetLanguages.filter((v) => v !== value));
  };

  const applyPreset = (codes: readonly string[]) => {
    setTargetLanguages([...new Set([...targetLanguages, ...codes])]);
  };

  const handleClearAll = () => setTargetLanguages([]);

  const selectedSet = useMemo(() => new Set(targetLanguages), [targetLanguages]);

  const popupRender = () => (
    <div
      style={{
        padding: token.paddingXS,
        minWidth: isMobile ? "min(90vw, 360px)" : 520,
        maxWidth: isMobile ? "min(95vw, 480px)" : 800,
      }}>
      <Input
        prefix={<SearchOutlined />}
        placeholder={t("search")}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        allowClear
        style={{ marginBottom: 8 }}
      />

      {/* Quick-pick presets — merge into selection (don't replace). */}
      <Flex gap={4} wrap style={{ marginBottom: 8 }}>
        {LANGUAGE_PRESETS.map((p) => (
          <Button key={p.key} size="small" onClick={() => applyPreset(p.codes)}>
            {t(p.labelKey)}
          </Button>
        ))}
        <Button size="small" onClick={handleClearAll} disabled={targetLanguages.length === 0}>
          {t("clearAll")}
        </Button>
      </Flex>

      {/* Selected chips — each removable. Caps display + count at end. */}
      {targetLanguages.length > 0 && (
        <>
          <Flex wrap gap={4} style={{ marginBottom: 8 }}>
            {targetLanguages.slice(0, 30).map((c) => {
              const opt = targetByCode.get(c);
              return (
                <Tag key={c} closable onClose={() => handleCheckboxChange(c, false)} style={{ margin: 0 }}>
                  {opt?.label ?? c}
                </Tag>
              );
            })}
            <Text type="secondary" style={{ fontSize: 12, alignSelf: "center" }}>
              {t("selectedCount", { count: targetLanguages.length })}
            </Text>
          </Flex>
          <Divider style={{ margin: "4px 0 8px" }} />
        </>
      )}

      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {visibleGroups.length === 0 && (
          <Text type="secondary" style={{ display: "block", padding: token.paddingSM, textAlign: "center" }}>
            {t("search")}: 0
          </Text>
        )}
        {visibleGroups.map((g) => {
          const expanded = isExpanded(g.key);
          const selectedInGroup = g.codes.filter((c) => selectedSet.has(c)).length;
          return (
            <div key={g.key} style={{ marginBottom: 4 }}>
              <Flex
                align="center"
                gap={4}
                onClick={() => toggleGroup(g.key)}
                style={{
                  cursor: searchValue.trim() ? "default" : "pointer",
                  padding: "4px 4px",
                  userSelect: "none",
                  background: token.colorFillTertiary,
                  borderRadius: token.borderRadiusSM,
                }}>
                {expanded ? <CaretDownOutlined style={{ fontSize: 10 }} /> : <CaretRightOutlined style={{ fontSize: 10 }} />}
                <Text strong style={{ fontSize: 12 }}>
                  {t(g.labelKey)}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedInGroup > 0 ? `${selectedInGroup}/${g.codes.length}` : g.codes.length}
                </Text>
              </Flex>
              {expanded && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                    gap: 4,
                    padding: "4px 8px",
                  }}>
                  {g.codes.map((c) => {
                    const opt = targetByCode.get(c);
                    if (!opt) return null;
                    return (
                      <Checkbox key={c} checked={selectedSet.has(c)} onChange={(e) => handleCheckboxChange(c, e.target.checked)} style={{ margin: 0 }}>
                        <Text style={{ fontSize: 13 }}>{opt.label}</Text>
                      </Checkbox>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
              onChange={(e) => handleLanguagePick("source", e)}
              options={sourceSelectOptions}
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
                onChange={(e) => handleLanguagePick("target", e)}
                options={targetSelectOptions}
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
                value={targetLanguages.length > 0 ? t("selectedCount", { count: targetLanguages.length }) : undefined}
                placeholder={t("selectMultiTargetLanguages")}
                popupRender={popupRender}
                // Lock to bottomRight: target Select sits in the right column;
                // popping leftward keeps the wide popup inside the viewport
                // regardless of where antd's auto-flip would have decided to
                // place it. Min 480/max 720 caps so long native labels can't
                // stretch the popup into the next county.
                placement="bottomRight"
                popupStyle={{
                  // Fixed widths on desktop — 800px fits 3-col grid with the
                  // longest native labels (海地克里奥尔语 / Kreyòl ayisyen) and
                  // any modern viewport ≥ 1024 holds it. Mobile uses vw-bounded
                  // since phones span 320-430px viewport.
                  minWidth: isMobile ? "min(90vw, 360px)" : 520,
                  maxWidth: isMobile ? "min(95vw, 480px)" : 800,
                }}
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
