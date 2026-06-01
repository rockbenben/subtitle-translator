"use client";

import { App } from "antd";
import { useTranslations } from "next-intl";

export const useCopyToClipboard = () => {
  const t = useTranslations("CopyToClipboard");
  const { message: appMessage } = App.useApp();

  // Shared key so back-to-back copies replace the previous toast instead of
  // stacking — copy is the highest-frequency toast in the app.
  const KEY = "clipboard";

  const copyToClipboard = async (text: string, targetText?: string) => {
    if (!text || text.trim() === "") {
      const warningMsg = targetText ? `${targetText}${t("empty")}` : t("empty");
      appMessage.warning({ content: warningMsg, key: KEY });
      return;
    }

    if (!navigator?.clipboard) {
      appMessage.error({ content: t("unsupported"), key: KEY });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const successMsg = targetText ? `${targetText}${t("success")}` : t("success");
      appMessage.success({ content: successMsg, key: KEY });
    } catch (err) {
      console.error("Copy to clipboard failed: ", err);
      const errorMsg = targetText ? `${targetText}${t("failure")}` : t("failure");
      appMessage.error({ content: errorMsg, key: KEY });
    }
  };

  return { copyToClipboard };
};
