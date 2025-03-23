import { message } from "antd";
import { useTranslations } from "next-intl";

export const useCopyToClipboard = () => {
  const t = useTranslations("CopyToClipboard");

  const copyToClipboard = async (text: string, messageApi?: ReturnType<typeof message.useMessage>[0], targetText?: string) => {
    if (!text || text.trim() === "") {
      const warningMsg = targetText ? `${targetText}${t("empty")}` : t("empty");
      messageApi?.warning(warningMsg);
      return;
    }

    if (!navigator?.clipboard) {
      messageApi?.error(t("unsupported"));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const successMsg = targetText ? `${targetText}${t("success")}` : t("success");
      messageApi?.success(successMsg);
    } catch (err) {
      console.error("Copy to clipboard failed: ", err);
      const errorMsg = targetText ? `${targetText}${t("failure")}` : t("failure");
      messageApi?.error(errorMsg);
    }
  };

  return { copyToClipboard };
};
