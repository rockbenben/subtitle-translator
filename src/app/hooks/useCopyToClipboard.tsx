import { App } from "antd";
import { useTranslations } from "next-intl";

export const useCopyToClipboard = () => {
  const t = useTranslations("CopyToClipboard");
  const { message: appMessage } = App.useApp();

  const copyToClipboard = async (text: string, targetText?: string) => {
    if (!text || text.trim() === "") {
      const warningMsg = targetText ? `${targetText}${t("empty")}` : t("empty");
      appMessage.warning(warningMsg);
      return;
    }

    if (!navigator?.clipboard) {
      appMessage.error(t("unsupported"));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const successMsg = targetText ? `${targetText}${t("success")}` : t("success");
      appMessage.success(successMsg);
    } catch (err) {
      console.error("Copy to clipboard failed: ", err);
      const errorMsg = targetText ? `${targetText}${t("failure")}` : t("failure");
      appMessage.error(errorMsg);
    }
  };

  return { copyToClipboard };
};
