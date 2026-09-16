"use client";

import { useLocalStorage } from "@/app/hooks/useLocalStorage";

/**
 * 是否在服务选择器里显示 hidden provider(目前是 volcengine 方舟 Coding Plan、
 * alibaba 百炼 Token Plan 两个用途受限的订阅套餐端点,见 registry 的
 * BaseProvider.hidden)。默认关 —— 这些端点对网页翻译工具有官方文档载明的
 * 封号风险(开关旁挂着警告文案)。
 *
 * TranslationSettings(开关本体 + chips)与 ApiStatusBlock(服务 Select)
 * 共用这一个持久化值,两处可见性永远一致。显式打开后选中的服务即使再关掉
 * 开关也仍然可用/可见 —— 选择器会把「当前选中值」无条件保留。
 */
export const HIDDEN_PROVIDERS_STORAGE_KEY = "translation-showHiddenProviders";

export const useShowHiddenProviders = (): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] =>
  useLocalStorage<boolean>(HIDDEN_PROVIDERS_STORAGE_KEY, false);
