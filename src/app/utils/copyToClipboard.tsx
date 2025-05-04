import { message } from "antd";
// for zh
export const copyToClipboard = async (text: string, messageApi?: ReturnType<typeof message.useMessage>[0], targetText?: string) => {
  // 处理空内容情况
  if (!text || text.trim() === "") {
    messageApi?.warning(targetText ? `${targetText} 内容为空，无需复制` : "目标内容为空，无需复制");
    return;
  }

  // 检查剪贴板 API 可用性
  if (!navigator?.clipboard) {
    messageApi?.error("当前浏览器不支持剪贴板操作，请尝试手动复制或使用其他浏览器");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    messageApi?.success(targetText ? `${targetText} 已复制` : "文本已复制");
  } catch (err) {
    console.error("复制到剪贴板失败：", err);
    messageApi?.error(targetText ? `${targetText} 复制失败，请手动复制` : "复制失败，请手动复制内容");
  }
};
