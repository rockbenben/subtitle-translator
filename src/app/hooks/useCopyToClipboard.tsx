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

    // Clipboard API 只在安全上下文可用 —— 内网 http:// 自部署下 navigator.clipboard
    // 直接是 undefined。此前这里只报「不支持」,复制按钮在整个内网部署里全废;
    // 退回 execCommand("copy")(已废弃但所有目标浏览器仍实现)保住这条路。
    const copyViaExecCommand = (value: string) => {
      const ta = document.createElement("textarea");
      ta.value = value;
      // 不能用 display:none —— 选区要求元素可渲染
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        return document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    };

    if (!navigator?.clipboard) {
      const ok = copyViaExecCommand(text);
      const content = ok ? (targetText ? `${targetText}${t("success")}` : t("success")) : t("unsupported");
      appMessage[ok ? "success" : "error"]({ content, key: KEY });
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
