/**
 * 「源语言不许同时当目标」这条规则的判据 —— 只有这一份实现。
 *
 * 源语言撞上目标时,translateCore 遇到 source === target 直接原文短路
 * (lib/translation/pipeline.ts),产出一份「译文 = 原文」的文件,还被当成功
 * 计进导出条数。
 *
 * 两种形态,各管一段:
 * · withoutSourceLanguage —— 【列表】:把源语言剔掉(多语模式跑的就是它)。
 * · collidesWithSource   —— 【单个目标】:剔不掉,只能判「撞上了没有」。
 *
 * ⚠【判据只有一处,读的是同一个值】:盘上的源语言就是唯一真相 —— 显示层
 * (选择框 / 网格 / 多语弹层)、写路径(勾目标 / 导入设置)、运行层(跑之前的
 * 校验)与导出读的都是它,谁都不许再派生第二份「生效值」。
 * 曾经派生过:读路径把撞上单选目标的组合显示成 "auto"(自动识别),盘上却留着
 * 用户自己选的那个码 —— 于是同一件事有两套真相:显示层按 auto 放行(网格里
 * 那个码还能点),写路径按具体码剔除(勾上一瞬就被静默丢掉),导出带走的又是
 * 另一个值。哪一层说了算,取决于用户先碰到哪一层。
 *
 * ⚠ 撞上了怎么办:【写入口处理一次,跑之前再拦一次】,而不是派生一个假的
 * 源语言出来顶替:
 * · 写入口:交互里改语言(useTranslationState 的 handleLanguageChange)与
 *   设置导入(importSettings)—— 导入那侧只在【单选目标真会被用到】时才处理:
 *   多语模式跑的是目标列表,那个单选目标压根不参与翻译,拿它说事会改掉用户
 *   的源语言(源语言在多语模式下是要真译的,换成自动识别会改变产物)。
 * · 跑之前:validateTranslationInputs 直接拒绝「源 == 目标」的一对 ——
 *   明确的拒绝好过悄悄产出一份与原文一模一样的文件。CLI 早就是这么做的
 *   (scripts/cli.ts 的 sameLang),网页这边曾经只靠派生值挡,派生值挡不住
 *   盘上早就存着的那种矛盾(老版本存下的、手写的设置文件)。
 *
 * ⚠ 这条规则只在【源语言是具体语种】时成立。源语言为 "auto"(自动识别)时,
 * 源要到运行时才知道 —— 那一刻才知道它是不是撞上了目标(撞上了,那一轮会
 * 产出一份与原文一模一样的文件,还记成成功)。真正的修法是运行期做一次源语言
 * 判定,那是功能不是判据;这里不猜、不拿启发式凑,边界摆在这条注释里。
 */

/** 语言码比较:大小写不敏感 —— 与 CLI 的 sameLang 同一口径(手写的设置文件里 "EN" 与 "en" 是同一个语言)。 */
const sameLang = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** 源语言为空或为 "auto"(自动识别)时,不算撞上 —— "auto" 不是某个具体语种。 */
const isConcreteSource = (source: string): boolean => Boolean(source) && source.toLowerCase() !== "auto";

/** 目标列表:把源语言剔掉(其余原样保留)。 */
export const withoutSourceLanguage = (langs: string[], source: string): string[] => (isConcreteSource(source) ? langs.filter((lang) => !sameLang(lang, source)) : langs);

/** 单个目标:撞上源语言没有? */
export const collidesWithSource = (target: string, source: string): boolean => isConcreteSource(source) && sameLang(target, source);
