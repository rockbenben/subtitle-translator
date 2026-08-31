/**
 * 语言全集 + 单语言构建开关。
 *
 * ⚠ 本文件由 project_sync 铺给全部子项目 —— 改这里等于改所有站点。
 *   各仓库真正不同的只有 `defaultLocale`，那一项留在各自的 `routing.ts` 里。
 *   这段逻辑此前是【复制在 9 份 routing.ts 里】的（28 行里 20 行逐字节相同，
 *   没有任何机制保持一致）。同一个模式已经让 Navigation.tsx 漂成两个变体、
 *   让语言切换器一边派生一边硬编码 —— 所以它归到同步件这一侧。
 */

// 应用【支持】的全部语言 —— 类型上的单一事实源。
export const ALL_LOCALES = ["en", "zh", "zh-hant", "pt", "es", "hi", "ar", "fr", "de", "ja", "ko", "ru", "vi", "th", "tr", "bn", "id", "it"] as const;
export type AppLocale = (typeof ALL_LOCALES)[number];

// 单语言构建开关：scripts/buildWithLang.js 用它把本次【构建产出】收敛到一个 locale，
// 不再靠正则改写源码再还原（那套办法在组件重构后会静默失效，踩过两次）。
// 不设时就是全集 —— next dev 与常规 next build 完全不受影响。
// ⚠ 必须带 NEXT_PUBLIC_ 前缀：本文件经 routing.ts 被客户端组件 import（ui/navigation/
//   LanguageSelector 等），只有这个前缀的 process.env 会被 Next 内联进客户端 bundle。
export const buildLocale = process.env.NEXT_PUBLIC_BUILD_LOCALE as AppLocale | undefined;
if (buildLocale && !(ALL_LOCALES as readonly string[]).includes(buildLocale)) {
  throw new Error(`NEXT_PUBLIC_BUILD_LOCALE="${buildLocale}" 不在 locales 里。可用：${ALL_LOCALES.join(", ")}`);
}

// 运行时可能是子集，但【类型】保持全集的联合：类型说的是「本应用支持哪些语言」，
// 数组说的是「这次构建产出哪些」，两者本就不是一回事。这样 hasLocale()、next-intl
// 的 Locale、以及各处按 locale 收窄的判断都不受影响。
export const locales: readonly AppLocale[] = buildLocale ? [buildLocale] : ALL_LOCALES;
