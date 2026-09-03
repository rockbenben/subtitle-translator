// Translation barrel: re-exports submodules + top-level testTranslationWithTimeout /
// translateText / useTranslation orchestration.

"use client";

import type { TranslateTextParams, TranslationConfig, TranslationMethod } from "./types";
import { deriveThinkingParams } from "./registry";
import { translateCore, runReachabilityProbe } from "./pipeline";
import { translationCache } from "@/app/lib/storage/indexedDBStorage";

// Re-export everything for backwards compatibility
export * from "./types";
export * from "./registry";
export * from "./config";
export * from "./cache";
export * from "./languages-data";
export * from "./utils";
export * from "./pipeline";
export { translationServices } from "./services";
export { completeOpenAICompatUrl, RELAY_HINT_MARKER, LLM_RELAY_BASE, isValidRelayBase, usesBuiltinRelay } from "./services/shared";


/**
 * 两个「测试连接」按钮(ApiStatusBlock / TranslationSettings)的共用入口:可达性探测 + 超时控制 +
 * thinking 参数派生,一处实现。返回 { error, timedOut }:error 为原始错误【对象】而非 message ——
 * 展示层经 describeError 渲染,保留 .status 让 i18n 提示按它查键;timedOut 让调用方把中止归类为
 * "测试超时"而不是裸 abort 文案。
 *
 * 超时取调用方传入的 requestTimeoutSec —— 与正式翻译同源。原则(同 retry.ts 的 preflight gate):
 * Test 不得比它守护的翻译更严格;30s 硬编码曾让"慢速本地思考模型"(思考半分钟才出首字)测试假阴性、翻译却能跑。
 */
export const testTranslationWithTimeout = async (
  translationMethod: TranslationMethod,
  // relayBase is global (outside per-provider config) — callers merge it in so
  // the Test hits the same relay host real translation will.
  config: (TranslationConfig & { relayBase?: string }) | undefined,
  timeoutSec: number,
  systemPrompt?: string,
  userPrompt?: string,
): Promise<{ error: unknown; timedOut: boolean }> => {
  // Mirror the orchestrator's gate so the Test exercises the same wire payload
  // as actual translation (effort level — undefined = thinking off).
  const testParams: Partial<TranslateTextParams> = {
    ...(config as Partial<TranslateTextParams>),
    reasoningEffort: deriveThinkingParams(translationMethod, config),
  };
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutSec * 1000);
  try {
    await runReachabilityProbe(translationMethod, testParams, systemPrompt, userPrompt, controller.signal);
    return { error: null, timedOut };
  } catch (error) {
    console.error("Translation Test failed", error);
    return { error: error ?? new Error("Unknown test failure"), timedOut };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Translate text using the specified method (browser entry — IndexedDB cache).
 * Engine logic lives in ./pipeline (translateCore, cache-injected) so headless
 * consumers (CLI / Node server) share it without pulling IndexedDB.
 */
const translateText = async (params: TranslateTextParams): Promise<string> => translateCore(params, translationCache);

/**
 * React hook for translation
 */
export const useTranslation = () => ({
  translate: translateText,
});
