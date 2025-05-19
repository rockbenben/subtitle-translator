"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Tabs, TabsProps, Typography } from "antd";
import { VideoCameraOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import TranslationSettings from "@/app/components/TranslationSettings";
import SubtitleTranslator from "./SubtitleTranslator";
import { useTranslations, useLocale } from "next-intl";

const { Title, Paragraph } = Typography;

const ClientPage = () => {
  const tSubtitle = useTranslations("subtitle");
  const t = useTranslations("common");
  const locale = useLocale();
  const isChineseLocale = locale === "zh" || locale === "zh-hant";

  const userGuideUrl = useMemo(
    () => (isChineseLocale ? "https://docs.newzone.top/guide/translation/subtitle-translator/index.html" : "https://docs.newzone.top/en/guide/translation/subtitle-translator/index.html"),
    [isChineseLocale]
  );

  const [activeKey, setActiveKey] = useState("basic");
  const [refreshKey, setRefreshKey] = useState(Date.now());

  // Use useCallback to memoize the event handler
  const handleTabChange = useCallback((key) => {
    setActiveKey(key);
    setRefreshKey(Date.now());
  }, []);

  // Create tab components as separate constants for better readability
  const basicTab = <SubtitleTranslator key={`basic-${refreshKey}`} />;
  const advancedTab = <TranslationSettings key={`advanced-${refreshKey}`} />;

  const items: TabsProps["items"] = [
    {
      key: "basic",
      label: t("basicTab"),
      children: basicTab,
    },
    {
      key: "advanced",
      label: t("advancedTab"),
      children: advancedTab,
    },
  ];

  return (
    <>
      <Title level={3}>
        <VideoCameraOutlined /> {tSubtitle("clientTitle")}
      </Title>
      <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: "more" }}>
        <a href={userGuideUrl} target="_blank" rel="noopener noreferrer">
          <QuestionCircleOutlined /> {t("userGuide")}
        </a>{" "}
        {tSubtitle("clientDescription")} {t("privacyNotice")}
      </Paragraph>
      <Tabs activeKey={activeKey} onChange={handleTabChange} items={items} type="card" className="w-full" destroyOnHidden={true} animated={{ inkBar: true, tabPane: true }} />
    </>
  );
};

export default ClientPage;
