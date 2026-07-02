"use client";

import React, { useState, useMemo } from "react";
import { Drawer, Segmented, AutoComplete, Button, InputNumber, ColorPicker, Form, Row, Col, Typography, App, Divider } from "antd";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { ASS_STYLE_PRESETS, type AssStyleConfig, type AssLineStyle, type AssStylePreset } from "./subtitleUtils";
import { FONT_SUGGESTION_GROUPS } from "./assFonts";
import AssStylePreview from "./AssStylePreview";

const { Text } = Typography;
// 按受欢迎度排序:default(最通用)→ cinematic(经典黄)→ large(大字号)→ boxed(半透明底框)。
const PRESET_KEYS: AssStylePreset[] = ["default", "cinematic", "large", "boxed"];

interface Props {
  open: boolean;
  onClose: () => void;
  config: AssStyleConfig;
  preset: AssStylePreset | "custom";
  /** 上次自定义的配置(单独保存)—— 切到预设再切回「自定义」时恢复,不丢编辑。 */
  customStyle: AssStyleConfig;
  /** 单一回调:同时更新 config 与 preset(避免两个 setState 的时序问题)。 */
  onChange: (config: AssStyleConfig, preset: AssStylePreset | "custom") => void;
  isOriginalFirst: boolean;
  sourceLang: string;
  targetLang: string;
}

const AssStyleDrawer = ({ open, onClose, config, preset, customStyle, onChange, isOriginalFirst, sourceLang, targetLang }: Props) => {
  const t = useTranslations("SubtitleTranslator");
  const isMobile = useIsMobile();
  const { message } = App.useApp();
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  // 选段(含「自定义」)→ 切换配置;改字段 → 标记 custom(父层据此把配置存进 customStyle)。
  const selectPreset = (key: AssStylePreset | "custom") => {
    onChange(key === "custom" ? customStyle : ASS_STYLE_PRESETS[key], key);
  };
  const patchConfig = (patch: Partial<AssStyleConfig>) => {
    onChange({ ...config, ...patch }, "custom");
  };
  const patchLine = (which: "translation" | "original", patch: Partial<AssLineStyle>) => {
    onChange({ ...config, [which]: { ...config[which], ...patch } }, "custom");
  };

  const fontOptions = useMemo(
    () => [
      ...FONT_SUGGESTION_GROUPS.map((g) => ({
        label: t(`fontGroup.${g.labelKey}`),
        options: g.fonts.map((f) => ({ value: f, label: f })),
      })),
      ...(systemFonts.length ? [{ label: t("assSystemFontsGroup"), options: systemFonts.map((f) => ({ value: f, label: f })) }] : []),
    ],
    [systemFonts, t]
  );

  const readSystemFonts = async () => {
    const q = (window as unknown as { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts;
    if (!q) {
      message.info(t("assReadSystemFontsUnsupported"));
      return;
    }
    try {
      const fonts = await q();
      setSystemFonts(Array.from(new Set(fonts.map((f) => f.family))).sort());
    } catch {
      message.info(t("assReadSystemFontsUnsupported"));
    }
  };

  // ColorPicker 用 hex;config 存 hex。value 直接传 hex 字符串。
  const lineFields = (which: "translation" | "original", label: string) => {
    const s = config[which];
    return (
      <>
        <Divider plain style={{ margin: "12px 0" }}>{label}</Divider>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label={t("assFontSize")} style={{ marginBottom: 8 }}>
              <InputNumber min={10} max={200} value={s.fontSize} onChange={(v) => patchLine(which, { fontSize: v ?? s.fontSize })} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label={t("assTextColor")} style={{ marginBottom: 8 }}>
              <ColorPicker disabledAlpha value={s.textColor} onChange={(c) => patchLine(which, { textColor: c.toHexString().toUpperCase() })} />
            </Form.Item>
          </Col>
          <Col span={6}>
            {/* boxed 时 OutlineColour 即底框填充色,标签切到「底框颜色」并放开 alpha(可调透明度)。 */}
            <Form.Item label={s.boxed ? t("assBoxColor") : t("assOutlineColor")} style={{ marginBottom: 8 }}>
              <ColorPicker disabledAlpha={!s.boxed} value={s.outlineColor} onChange={(c) => patchLine(which, { outlineColor: c.toHexString().toUpperCase() })} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("assOutline")} style={{ marginBottom: 8 }}>
              <InputNumber min={0} max={10} value={s.outline} onChange={(v) => patchLine(which, { outline: v ?? s.outline })} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("assShadow")} style={{ marginBottom: 8 }}>
              <InputNumber min={0} max={10} value={s.shadow} onChange={(v) => patchLine(which, { shadow: v ?? s.shadow })} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
      </>
    );
  };

  return (
    <Drawer title={t("assStyleTitle")} open={open} onClose={onClose} size={isMobile ? "100vw" : "min(720px, 92vw)"} destroyOnHidden={false}>
      <AssStylePreview config={config} isOriginalFirst={isOriginalFirst} sourceLang={sourceLang} targetLang={targetLang} />

      <Text strong style={{ display: "block", margin: "16px 0 8px" }}>{t("assPresetLabel")}</Text>
      <Segmented
        block
        value={preset}
        onChange={(v) => selectPreset(v as AssStylePreset | "custom")}
        options={[
          ...PRESET_KEYS.map((k) => ({ label: t(`assPreset${k.charAt(0).toUpperCase()}${k.slice(1)}`), value: k })),
          { label: t("assPresetCustom"), value: "custom" },
        ]}
      />

      <Divider plain style={{ margin: "16px 0 8px" }}>{t("assGlobalGroup")}</Divider>
      <Form layout="vertical">
        <Form.Item label={t("assFontName")} style={{ marginBottom: 8 }}>
          <Row gutter={8}>
            <Col flex="auto">
              <AutoComplete
                value={config.fontName}
                onChange={(v) => patchConfig({ fontName: v })}
                options={fontOptions}
                placeholder={t("assFontPlaceholder")}
                allowClear
                filterOption={(input, option) => {
                  // fontOptions 是分组结构(组对象无 value);只按叶子项的字体名过滤。
                  const value = option && "value" in option ? String(option.value) : "";
                  return value.toLowerCase().includes(input.toLowerCase());
                }}
                style={{ width: "100%" }}
              />
            </Col>
            <Col flex="none">
              <Button onClick={readSystemFonts}>{t("assReadSystemFonts")}</Button>
            </Col>
          </Row>
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label={t("assAlignment")} style={{ marginBottom: 8 }}>
              <Segmented
                block
                value={config.alignment}
                onChange={(v) => patchConfig({ alignment: v as number })}
                options={[{ label: t("assAlignBottom"), value: 2 }, { label: t("assAlignTop"), value: 8 }]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("assMarginV")} style={{ marginBottom: 8 }}>
              <InputNumber min={0} max={500} value={config.marginV} onChange={(v) => patchConfig({ marginV: v ?? config.marginV })} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
        {lineFields("translation", t("assTranslationStyle"))}
        {lineFields("original", t("assOriginalStyle"))}
      </Form>
    </Drawer>
  );
};

export default AssStyleDrawer;
