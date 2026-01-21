"use client";

import React from "react";
import { Card, Button, Space, Input, Typography, Tooltip, Flex } from "antd";
import { CopyOutlined, DownloadOutlined, SwapOutlined, ClearOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useTextStats } from "@/app/hooks/useTextStats";

const { TextArea } = Input;
const { Paragraph } = Typography;

interface ZhResultCardProps {
  /** 结果文本（直接绑定状态） */
  value: string;
  /** 编辑回调，提供时可编辑 */
  onChange?: (value: string) => void;
  /** 复制回调 */
  onCopy: () => void;
  /** 导出回调（可选） */
  onExport?: () => void;
  /** 格式化回调（可选） */
  onFormat?: () => void;
  /** 结果→原文回调（可选） */
  onMoveToSource?: () => void;
  /** 标题（默认"处理结果"） */
  title?: string;
  /** TextArea 行数（默认 10） */
  rows?: number;
  /** 额外 className */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 中文专用结果卡片组件
 *
 * 特性：
 * - 修复光标跳转问题：可编辑时直接绑定 value，超长时自动切换只读模式
 * - 内置 useTextStats：自动显示字符/行数统计
 * - 中文本地化：硬编码中文标签
 * - 常用按钮：复制、导出、格式化、结果→原文
 */
const ZhResultCard = ({ value, onChange, onCopy, onExport, onFormat, onMoveToSource, title = "处理结果", rows = 10, className = "", style }: ZhResultCardProps) => {
  const stats = useTextStats(value);

  // 关键修复：可编辑时直接使用 value，超长时使用 displayText 并设为只读
  const isEditable = onChange && !stats.isTooLong;
  const displayValue = stats.isTooLong ? stats.displayText : value;

  return (
    <Card
      title={title}
      className={`shadow-sm ${className}`}
      style={style}
      extra={
        <Space wrap>
          {onMoveToSource && (
            <Tooltip title="将结果文本覆盖到输入框">
              <Button type="text" icon={<SwapOutlined />} onClick={onMoveToSource}>
                结果 ➔ 原文
              </Button>
            </Tooltip>
          )}
          {onFormat && (
            <Tooltip title="格式化：移除空行及首尾空格">
              <Button type="text" icon={<ClearOutlined />} onClick={onFormat}>
                格式化
              </Button>
            </Tooltip>
          )}
          <Tooltip title="复制结果">
            <Button type="text" icon={<CopyOutlined />} onClick={onCopy}>
              复制
            </Button>
          </Tooltip>
          {onExport && (
            <Tooltip title="导出为文件">
              <Button type="text" icon={<DownloadOutlined />} onClick={onExport}>
                导出
              </Button>
            </Tooltip>
          )}
        </Space>
      }>
      <TextArea value={displayValue} onChange={isEditable ? (e) => onChange(e.target.value) : undefined} rows={rows} readOnly={!isEditable} aria-label={title} />
      <Flex justify="space-between" align="center" className="mt-2">
        <div style={{ fontSize: 12 }}>
          {!isEditable && onChange && (
            <Tooltip title="文本过长，为保证页面性能已自动切换为只读模式">
              <Typography.Text type="warning">
                <InfoCircleOutlined /> 只读模式
              </Typography.Text>
            </Tooltip>
          )}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {stats.charCount} 字符 / {stats.lineCount} 行
        </Typography.Text>
      </Flex>
    </Card>
  );
};

export default ZhResultCard;
