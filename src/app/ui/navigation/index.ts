// 主仓的 layout.tsx 直接 import "./Navigation",这个桶在主仓【零消费方】—— 别当死代码删:
// 8 个子项目自维护的 layout.tsx 从 "@/app/ui/navigation" 拿 Navigation,而 layout.tsx 不在
// 同步范围内。project_sync.py validate 的第 10 项检查会拦这类删除。
export { Navigation, default } from "./Navigation";
