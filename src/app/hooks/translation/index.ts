// 这一层【只放浏览器专属】的翻译辅助:设置文件的导出下载与 <input type=file>
// 选择器,以及依赖 UI 文案的输入校验。
//
// ⚠ 不要再从这里转发 lib/translation 的东西。retry / contextTranslation /
// settingsSchema 都是平台无关的引擎件,与 CLI 共用;曾经为了"保持既有 import
// 路径不变"在这里 `export *` 转发它们,结果同一个符号有两条活的导入路径,
// grep 出来是两个看不出关系的家,下一个人加符号只能猜该放哪层。
// 引擎符号一律 `@/app/lib/translation/...` 直接导入。
export * from "./settings";
export * from "./validation";
