"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { resolveBilingualFonts, scriptOf, type AssStyleConfig, type AssLineStyle } from "./subtitleUtils";

// 预览示例文字:按文字系统取,使预览真正展示该语言字体的渲染(而非用拉丁文字撑中文字体)。
const SAMPLE_BY_SCRIPT: Record<string, string> = {
  latin: "The quick brown fox",
  hans: "敏捷的棕色狐狸",
  hant: "敏捷的棕色狐狸",
  jp: "すばやい茶色の狐",
  kr: "빠른 갈색 여우",
  arabic: "الثعلب البني السريع",
  devanagari: "तेज़ भूरी लोमड़ी",
  thai: "สุนัขจิ้งจอกสีน้ำตาล",
};
const sampleForLang = (lang: string): string => SAMPLE_BY_SCRIPT[scriptOf(lang)] ?? SAMPLE_BY_SCRIPT.latin;

// 预览画布按此高度等比缩放 ASS 字号(ASS 基于 PlayResY=1080)。
const PREVIEW_HEIGHT = 180;
const SCALE = PREVIEW_HEIGHT / 1080;

// 用 4 向 text-shadow 近似 ASS 描边(跨浏览器,比 -webkit-text-stroke 稳)。
// hex #RRGGBB 或 #RRGGBBAA → rgba()，用于 boxed 底框背景(透明度取自 hex 的 alpha 位,
// 无 alpha 位则视为不透明)。与 ASS 的 boxFill 同源,保证预览=输出。
const hexToRgba = (hex: string): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const a = h.length >= 8 ? (parseInt(h.slice(6, 8), 16) || 0) / 255 : 1;
  return `rgba(${r},${g},${b},${a})`;
};

const outlineShadow = (color: string, width: number): string => {
  if (width <= 0) return "none";
  const w = Math.max(1, Math.round(width));
  const offsets: string[] = [];
  for (let dx = -w; dx <= w; dx++) {
    for (let dy = -w; dy <= w; dy++) {
      if (dx === 0 && dy === 0) continue;
      offsets.push(`${dx}px ${dy}px 0 ${color}`);
    }
  }
  return offsets.join(", ");
};

const lineStyle = (s: AssLineStyle, font: string): React.CSSProperties => ({
  fontFamily: font,
  fontSize: Math.round(s.fontSize * SCALE * 4), // ×4:预览画布远小于 1080,放大到可读
  color: s.textColor,
  lineHeight: 1.25,
  whiteSpace: "nowrap",
  // boxed:半透明黑底框(对应 ASS BorderStyle=3 的 &H80000000),不再画描边;
  // 其余款用 text-shadow 近似描边。
  ...(s.boxed ? { backgroundColor: hexToRgba(s.outlineColor), padding: "0 0.3em", textShadow: "none" } : { textShadow: outlineShadow(s.outlineColor, s.outline) }),
});

const AssStylePreview = ({ config, isOriginalFirst, sourceLang, targetLang }: { config: AssStyleConfig; isOriginalFirst: boolean; sourceLang: string; targetLang: string }) => {
  const t = useTranslations("SubtitleTranslator");
  const fonts = resolveBilingualFonts(sourceLang, targetLang, config.fontName);
  // 样式按角色固定:译文恒用 config.translation,原文恒用 config.original。
  const translationLine = { style: config.translation, font: fonts.translation, label: t("previewTranslation"), text: sampleForLang(targetLang) };
  const originalLine = { style: config.original, font: fonts.original, label: t("previewOriginal"), text: sampleForLang(sourceLang) };
  // isOriginalFirst 只决定谁在上面那行。
  const [top, bottom] = isOriginalFirst ? [originalLine, translationLine] : [translationLine, originalLine];

  return (
    <div
      style={{
        height: PREVIEW_HEIGHT,
        borderRadius: 8,
        background: "linear-gradient(135deg, #2b3a4a 0%, #1a2330 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        // marginV 极端值时封顶,避免把字幕挤出预览画布(预览近似,非精确定位)。
        paddingBottom: Math.min(Math.round(config.marginV * SCALE * 4), Math.round(PREVIEW_HEIGHT * 0.4)),
        gap: 4,
        overflow: "hidden",
      }}>
      <div style={lineStyle(top.style, top.font)} title={top.label}>{top.text}</div>
      <div style={lineStyle(bottom.style, bottom.font)} title={bottom.label}>{bottom.text}</div>
    </div>
  );
};

export default AssStylePreview;
