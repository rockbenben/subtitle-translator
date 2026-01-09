"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsProps, Typography, Spin } from "antd";
import { VideoCameraOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import SubtitleTranslator from "./SubtitleTranslator";
import { useTranslations, useLocale } from "next-intl";
import { TranslationProvider } from "@/app/components/TranslationContext";
import { getUserGuideUrl } from "@/app/utils";

const TranslationSettings = dynamic(() => import("@/app/components/TranslationSettings"), {
  loading: () => (
    <div className="flex justify-center items-center py-20">
      <Spin size="large" />
    </div>
  ),
});

const { Title, Paragraph, Link } = Typography;

const ClientPage = () => {
  const tSubtitle = useTranslations("subtitle");
  const t = useTranslations("common");
  const locale = useLocale();
  const userGuideUrl = getUserGuideUrl("subtitle-translator", locale);
  // 使用时间戳来强制重新渲染
  const [activeKey, setActiveKey] = useState("basic");

  const handleTabChange = (key: string) => {
    setActiveKey(key);
  };

  const items: TabsProps["items"] = [
    {
      key: "basic",
      label: t("basicTab"),
      children: <SubtitleTranslator />,
    },
    {
      key: "advanced",
      label: t("advancedTab"),
      children: <TranslationSettings />,
    },
  ];

  return (
    <TranslationProvider>
      <Title level={3}>
        <VideoCameraOutlined /> {tSubtitle("clientTitle")}
      </Title>
      <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: "more" }}>
        <Link href={userGuideUrl} target="_blank" rel="noopener noreferrer">
          <QuestionCircleOutlined /> {t("userGuide")}
        </Link>{" "}
        {tSubtitle("clientDescription")} {t("privacyNotice")}
      </Paragraph>
      <Tabs activeKey={activeKey} onChange={handleTabChange} items={items} type="card" className="w-full" animated={{ inkBar: true, tabPane: true }} />
    </TranslationProvider>
  );
};

export default ClientPage;
