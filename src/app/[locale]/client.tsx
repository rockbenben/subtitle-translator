"use client";

import React, { useState } from "react";
import { Tabs, TabsProps, Typography } from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import TranslationSettings from "@/app/components/TranslationSettings";
import SubtitleTranslator from "./SubtitleTranslator";
import { useTranslations } from "next-intl";

const { Title, Paragraph } = Typography;

const ClientPage = () => {
  const tSubtitle = useTranslations("subtitle");
  const t = useTranslations("common");
  // 使用时间戳来强制重新渲染
  const [activeKey, setActiveKey] = useState("basic");
  const [refreshKey, setRefreshKey] = useState(Date.now());

  const handleTabChange = (key: string) => {
    setActiveKey(key);
    setRefreshKey(Date.now()); // 切换 tab 时更新 key
  };

  const items: TabsProps["items"] = [
    {
      key: "basic",
      label: t("basicTab"),
      children: <SubtitleTranslator key={`basic-${refreshKey}`} />,
    },
    {
      key: "advanced",
      label: t("advancedTab"),
      children: <TranslationSettings key={`advanced-${refreshKey}`} />,
    },
  ];

  return (
    <>
      <Title level={3}>
        <VideoCameraOutlined /> {tSubtitle("clientTitle")}
      </Title>
      <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: "more" }}>
        {tSubtitle("clientDescription")} {t("privacyNotice")}
      </Paragraph>
      <Tabs
        activeKey={activeKey}
        onChange={handleTabChange}
        items={items}
        type="card"
        className="w-full"
        destroyInactiveTabPane={true} // 销毁不活动的标签页
        animated={{ inkBar: true, tabPane: true }}
      />
    </>
  );
};

export default ClientPage;
