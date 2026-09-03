"use client";

import type { ReactNode } from "react";
import { Flex, Tooltip, Typography } from "antd";

/**
 * 配置项行:标签 + 开关一行。整行是 <label> —— 点说明文字就能切开关,size="small" 的 Switch
 * 只有 32×18,而文字才是用户第一直觉会点的地方(design-system A5b)。
 * tooltip 包在标签上;hint 是标签下方的一行灰色说明,留在 label 外(补充说明不该变成点击区);
 * sub 表示从属缩进项。
 */
const ToggleRow = ({ label, tooltip, hint, sub, children }: { label: ReactNode; tooltip?: ReactNode; hint?: ReactNode; sub?: boolean; children: ReactNode }) => (
  <Flex vertical gap={2} style={sub ? { paddingInlineStart: 16 } : undefined}>
    <Flex component="label" className="cursor-pointer" justify="space-between" align="center" gap="small">
      {tooltip ? (
        <Tooltip title={tooltip}>
          <span>{label}</span>
        </Tooltip>
      ) : (
        <span>{label}</span>
      )}
      {children}
    </Flex>
    {hint ? (
      <Typography.Text type="secondary" className="!text-xs">
        {hint}
      </Typography.Text>
    ) : null}
  </Flex>
);

export default ToggleRow;
