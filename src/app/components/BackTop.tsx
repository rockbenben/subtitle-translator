"use client";

import { FloatButton } from "antd";
import { VerticalAlignTopOutlined } from "@ant-design/icons";

/**
 * Floating "back to top" button. Visible when user scrolls past the
 * viewport. AntD's FloatButton.BackTop handles scroll detection and
 * smooth-scroll on click.
 */
// aria-label is forwarded to the underlying <button>; without it antd's icon
// falls back to the raw glyph name ("vertical-align-top") for screen readers.
const BackTop = () => <FloatButton.BackTop icon={<VerticalAlignTopOutlined />} visibilityHeight={400} aria-label="Back to top" />;

export default BackTop;
