"use client";

import { FloatButton } from "antd";
import { VerticalAlignTopOutlined } from "@ant-design/icons";

/**
 * Floating "back to top" button. Visible when user scrolls past the
 * viewport. AntD's FloatButton.BackTop handles scroll detection and
 * smooth-scroll on click.
 */
const BackTop = () => <FloatButton.BackTop icon={<VerticalAlignTopOutlined />} visibilityHeight={400} />;

export default BackTop;
