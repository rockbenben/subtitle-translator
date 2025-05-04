"use client";
import React, { createContext, ReactNode } from "react";

export const DataContext = createContext(null);

export function DataProvider({ children, data }: { children: ReactNode; data: any }) {
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
