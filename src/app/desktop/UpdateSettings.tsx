"use client";
import { useCallback, useState } from "react";
import { App, Button, Flex, Switch } from "antd";
import { useLocale } from "next-intl";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useMounted } from "@/app/hooks/useMounted";
import ToggleRow from "@/app/components/styled/ToggleRow";
import { isTauriRuntime } from "./externalLink";
import { checkForUpdates, AUTO_UPDATE_ENABLED_KEY } from "./updater";
import { getUpdaterStrings } from "./updaterI18n";
import { useUpdatePrompt } from "./useAutoUpdate";

/**
 * 「应用更新」设置块：自动检查的开关 + 随时手动检查一次。
 *
 * 【放在哪、为什么】挂在工具页「进阶设置」面板（AdvancedTranslationSettings 的
 * children 槽位）里，而不是 API 设置抽屉：
 *  - 抽屉整个版面是「翻译 API」—— provider 芯片、密钥、端点、提示词，给一个
 *    应用级的更新开关塞进去是串味的；
 *  - 「进阶设置」这一屏本来就是通用开关的容身处（缓存、单文件模式），
 *    低频 opt-in 放这儿不跟主流程抢注意力；
 *  - 它已经有一个 children 槽位（“渲染在通用设置之前”），挂载点因此落在
 *    工具页自己身上，不必改动共享组件。
 * 挂载点在 src/app/[locale]/SubtitleTranslator.tsx（该目录不在上游同步范围内），
 * 共享组件一行没动。
 *
 * 【为什么只有桌面端看得见】网页版没有 updater，这块在浏览器里整个不渲染。
 * 判据用既有的 isTauriRuntime()（同 ExportFolderButton 的做法）；首屏还要与
 * SSR 一致（静态导出的 HTML 在 Node 里预渲染，那里没有 window），所以用
 * useMounted() 兜一道，挂载后才判断。
 *
 * 【失败怎么表现】自动检查那条路失败时保持安静（useAutoUpdate 里不弹任何东西）；
 * 手动检查是用户主动点的，失败必须说清原因 —— 静默失败等于没回答。
 * 无论哪条路，检查本身都不会把应用弄崩：插件调用包在 checkForUpdates 内部，
 * 这里再兜一层意外。
 *
 * 【“跳过此版本”对手动检查不算数】跳过按钮静音的是【自动提醒】。用户手动问
 * “有没有新版”，答案里说有新版、却因为被跳过而不吭声，就是撒谎；所以手动这条
 * 路照常弹同一个安装弹窗（弹窗里仍可再点一次“跳过此版本”）。
 *
 * 【文案在哪儿】桌面端专属文案住在同目录的 ./updaterI18n（简中 / 繁中 / 英文，
 * 其余 locale 回落英文），不进 messages/*.json —— 那些文件是上游 project_sync
 * 按命名空间派生出来的产物，桌面专属的键下一次同步就会被抹掉。本组件是这些文案
 * 的唯一消费方，而它在 src/app/desktop/ 里，所以挂载点（工具页）完全不必接触
 * 文案本身：它只 import 这个组件。
 *
 * 【为什么这个文件在 src/app/desktop/】上游 project_sync 的 overwrite 模式会删掉
 * 目标目录里源目录没有的孤儿文件，桌面端专属文件放共享目录会被静默删掉；
 * src/app/desktop/ 不在任何同步规则范围内，是这块的安全区。
 */
const UpdateSettings = () => {
  const locale = useLocale();
  const t = getUpdaterStrings(locale);
  const { message } = App.useApp();
  const [enabled, setEnabled] = useLocalStorage<boolean>(AUTO_UPDATE_ENABLED_KEY, false);
  const [checking, setChecking] = useState(false);
  const confirm = useUpdatePrompt();

  const mounted = useMounted();
  const available = mounted && isTauriRuntime();

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const r = await checkForUpdates();
      if (r.error) {
        message.error(t.checkFailed(r.error));
        return;
      }
      if (r.hasUpdate && r.update) {
        message.info(t.available(r.update.version));
        confirm(r.update);
        return;
      }
      message.success(t.upToDate);
    } catch (e) {
      // checkForUpdates 自己接住了插件抛的错；这一层只是不让任何意外掀翻设置面板。
      console.error("Update check failed:", e);
      message.error(t.checkFailed(String(e)));
    } finally {
      setChecking(false);
    }
  }, [confirm, message, t]);

  if (!available) return null;

  return (
    <Flex vertical gap="small">
      <ToggleRow label={t.autoUpdateLabel} tooltip={t.autoUpdateTooltip}>
        <Switch size="small" checked={enabled} onChange={(checked) => setEnabled(checked)} aria-label={t.autoUpdateLabel} />
      </ToggleRow>
      {/* 按钮不跟开关挤在同一行：手动检查是一次性动作，与“要不要自动查”是两件事。 */}
      <div>
        <Button size="small" onClick={checkNow} loading={checking}>
          {t.checkNow}
        </Button>
      </div>
    </Flex>
  );
};

export default UpdateSettings;
