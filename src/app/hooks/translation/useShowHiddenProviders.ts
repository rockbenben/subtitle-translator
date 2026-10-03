"use client";

import { useLocalStorage } from "@/app/hooks/useLocalStorage";

/**
 * 是否在服务选择器里显示 registry 标了 hidden 的 provider（成员就是 `hidden` 为真的
 * 那几条，别在这里点名；判据见 BaseProvider.hidden）。默认关 —— 这类用途受限的
 * 订阅套餐端点对网页翻译工具有官方文档载明的
 * 封号风险(开关旁挂着警告文案)。
 *
 * TranslationSettings(开关本体 + chips)与 ApiStatusBlock(服务 Select)
 * 共用这一个持久化值,两处可见性永远一致。显式打开后选中的服务即使再关掉
 * 开关也仍然可用/可见 —— 选择器会把「当前选中值」无条件保留。
 */
export const HIDDEN_PROVIDERS_STORAGE_KEY = "translation-showHiddenProviders";

export const useShowHiddenProviders = (): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] =>
  useLocalStorage<boolean>(HIDDEN_PROVIDERS_STORAGE_KEY, false);
