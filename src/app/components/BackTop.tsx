"use client";

import { FloatButton } from "antd";
import { VerticalAlignTopOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

/**
 * Floating "back to top" button. Visible when user scrolls past the
 * viewport. AntD's FloatButton.BackTop handles scroll detection and
 * smooth-scroll on click.
 */
// aria-label is forwarded to the underlying <button>; without it antd's icon
// falls back to the raw glyph name ("vertical-align-top") for screen readers.
// shape="square": the system is square-cornered everywhere else; the default
// circle was the only round surface on the page.
const BackTop = () => {
  const t = useTranslations();
  return <FloatButton.BackTop shape="square" icon={<VerticalAlignTopOutlined />} visibilityHeight={400} aria-label={t("common.backToTop")} />;
};

export default BackTop;
