import type { TranslationMethod, TranslationService } from "../types";
import { isUserSuppliedEndpoint, relayHintWouldHelp } from "../registry";
import { isNetworkError } from "@/app/utils/errorUtils";
import { CORS_HINT_MESSAGE, RELAY_HINT_MESSAGE } from "./shared";
import * as traditional from "./traditional";
import * as llm from "./llm";

/**
 * 浏览器的跨域 / 不可达失败只给一个无 status 的 `TypeError`（"Failed to
 * fetch" / "NetworkError…" / "Load failed"）—— 对用户零信息量。在这里把它改写
 * 成【下一步该做什么】,并给 retry.ts 带上不可重试的分类标记。
 *
 * 判据是「换个做法会不会有效」,不是「用户填没填地址」:
 *   ① 开中转真能改变结果 → 指他去开（relayHintWouldHelp:有那个开关、现在
 *      没开、开了真会路由到位）—— 指人去拨一个不存在或拨了也白拨
 *      的开关,比不提示更糟。
 *   ② 地址是用户自己的（自建网关 / 本地运行时）→ 中转帮不上,病因几乎总是
 *      对面没回 CORS 头（subtitle-translator#66）,或地址/服务不可达。
 *   其余（官方端点且中转已开）保持原样 → describeError 的通用 networkUnavailable。
 *
 * ② 那条是这个包装器从 llm.ts 搬到调度表的理由:旧版只包中转能力 provider,
 * 而【URL 即凭证】的那几家（llm / translategemma / milmmt）与自建 DeepLX 才是最容易
 * 撞 CORS 的 —— 它们一个都没被包。包在这里 = 每个服务都过一遍,新增 provider
 * 不需要记得补登记。
 *
 * ⚙ 已携 `errorHintKey` 的错误原样放行:抛错方比通用映射更知道该提示什么
 * （gemini 把无 CORS 头的 edge 拒绝改写成「重新生成/限制 key」）。
 */
const withNetworkHint =
  (service: TranslationService, method: string): TranslationService =>
  async (params) => {
    try {
      return await service(params);
    } catch (error) {
      if (!isNetworkError(error) || (error as { errorHintKey?: string }).errorHintKey) throw error;
      if (relayHintWouldHelp(method, params)) throw Object.assign(new Error(RELAY_HINT_MESSAGE), { errorHintKey: "errorHintRelay" });
      if (isUserSuppliedEndpoint(method, params.url)) throw Object.assign(new Error(CORS_HINT_MESSAGE), { errorHintKey: "errorHintCors" });
      throw error;
    }
  };

// Combine all translation services with type-safe keys.
// 包装发生在下方的 Object.fromEntries 里;本模块【只】导出包装后的
// `translationServices` —— 曾经还 `export *` 透出未包装的单个服务函数,
// 谁 `import { claude }` 谁就静默丢掉提示改写,已删(无消费方,grep 过)。
// 测试要常量直接去 "./llm" / "./shared" 拿。
const rawServices: Record<TranslationMethod, TranslationService> = {
  // Traditional APIs
  gtxFreeAPI: traditional.gtxFreeAPI,
  edgeFreeAPI: traditional.edgeFreeAPI,
  google: traditional.google,
  deepl: traditional.deepl,
  deeplx: traditional.deeplx,
  azure: traditional.azure,
  webgoogletranslate: traditional.webgoogletranslate,
  qwenMt: traditional.qwenMt,
  translategemma: traditional.translategemma,
  milmmt: traditional.milmmt,

  // LLM APIs — OpenAI-compatible services auto-registered from OPENAI_COMPAT_PROVIDERS
  ...llm.openAICompatServices,

  // LLM APIs — special-case providers that don't fit the OpenAI-compatible shape
  claude: llm.claude,
  gemini: llm.gemini,
  azureopenai: llm.azureopenai,
  yandex: llm.yandex,
  nvidia: llm.nvidia,
  llm: llm.llm,
};

export const translationServices = Object.fromEntries(Object.entries(rawServices).map(([method, service]) => [method, withNetworkHint(service, method)])) as Record<
  TranslationMethod,
  TranslationService
>;
