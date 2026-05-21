"use client";

import React, { createContext, useContext } from "react";
import useTranslationState from "@/app/hooks/useTranslationState";

const TranslationContext = createContext<ReturnType<typeof useTranslationState> | null>(null);

export const TranslationProvider = ({ children }: { children: React.ReactNode }) => {
  const translationState = useTranslationState();
  return <TranslationContext.Provider value={translationState}>{children}</TranslationContext.Provider>;
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslationContext must be used within a TranslationProvider");
  }
  return context;
};
