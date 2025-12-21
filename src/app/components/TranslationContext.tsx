"use client";

import React, { createContext, useContext } from "react";
import useTranslateData from "@/app/hooks/useTranslateData";

const TranslationContext = createContext<ReturnType<typeof useTranslateData> | null>(null);

export const TranslationProvider = ({ children }: { children: React.ReactNode }) => {
  const translateData = useTranslateData();
  return <TranslationContext.Provider value={translateData}>{children}</TranslationContext.Provider>;
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslationContext must be used within a TranslationProvider");
  }
  return context;
};
