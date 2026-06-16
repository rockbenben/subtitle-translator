// 微博链接转换:手机端 m.weibo.cn → PC 端 weibo.com,并附带博主主页链接。
// 详情/状态页(m.weibo.cn/detail|status/...)拿不到 uid/bid:直接抓 HTML 会被新浪
// 「访客系统」反爬门拦截(返回 JS 验证页,无渲染数据)。改抓 JSON 接口
// `m.weibo.cn/statuses/show?id=<bid|mid>` —— 实测带上 `X-Requested-With` +
// `Referer: https://m.weibo.cn/` 即可绕开门,返回 {ok:1,data:{user:{id},bid}}。
// 这两个头浏览器 fetch 设不了(Referer 是禁止头、X-Requested-With 触发预检且无法
// 伪造来源),必须由代理服务端注入 —— 见 scripts/weibo-proxy-worker.js。
// 把「不需联网的纯逻辑」(id 提取 / JSON 解析)与真正的 fetch 拆开,前者单测。

// Cloudflare Worker CORS 反代(部署源 scripts/weibo-proxy-worker.js,运行于
// cors-proxy.aishort.top)。worker 仅放行微博域名,并为微博请求注入上面那两个头。
// 目标 URL 走 ?url= 查询参数,调用方需 encodeURIComponent:
// `${WEIBO_CORS_PROXY}${encodeURIComponent(targetUrl)}`。
export const WEIBO_CORS_PROXY = "https://cors-proxy.aishort.top/?url=";

// 微博移动端 JSON 接口:id 可传 bid(字母数字)或 mid(纯数字),两者都接受。
export const WEIBO_SHOW_API = "https://m.weibo.cn/statuses/show?id=";

export type WeiboConvertFailReason = "noUid" | "noUidBid" | "network" | "notWeibo";

export interface WeiboConvertResult {
  /** 原始输入链接 */
  source: string;
  /** PC 端正文链接;为空表示该输入只能得到主页(如 m.weibo.cn/u/ 链接) */
  pc: string;
  /** 博主主页链接 */
  home: string;
  ok: boolean;
  reason?: WeiboConvertFailReason;
}

// 从 weibo.com 完整链接里提 uid(结构 weibo.com/<uid>/<mid> 或 weibo.com/u/<uid>)
export const extractUidFromWeiboCom = (url: string): string | null => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "u" && parts[1]) return parts[1];
    if (parts[0] && /^\d+$/.test(parts[0])) return parts[0];
  } catch {
    /* 非法 URL → 落到 null */
  }
  return null;
};

// 不需联网即可判定的两类:m.weibo.cn/u/<uid> 主页链接、以及已是 weibo.com 的链接。
// 返回 null 表示「这是 m.weibo.cn 详情页或非微博链接」,需调用方进一步处理(抓 HTML / 判失败)。
export const convertWeiboLinkOffline = (url: string): WeiboConvertResult | null => {
  const base = { source: url, pc: "", home: "" };

  // m.weibo.cn/u/<uid>:纯字符串匹配,只能得到主页
  if (url.includes("m.weibo.cn/u/")) {
    const uidMatch = url.match(/u\/(\d+)/);
    if (uidMatch) return { ...base, home: `https://weibo.com/u/${uidMatch[1]}`, ok: true };
    return { ...base, ok: false, reason: "noUid" };
  }

  // 已是 weibo.com:正文链接照搬,能提到 uid 就补主页
  if (url.includes("weibo.com")) {
    const uid = extractUidFromWeiboCom(url);
    if (uid) return { ...base, pc: url, home: `https://weibo.com/u/${uid}`, ok: true };
    return { ...base, pc: url, ok: true };
  }

  return null;
};

// 从 m.weibo.cn 详情/状态链接里取出可喂给 statuses/show?id= 的 id(bid 或 mid 皆可)。
// 形如 /status/<id>、/detail/<id>,或 ?id=<id>;取不到返回 null。
export const extractWeiboStatusId = (url: string): string | null => {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("id");
    if (q) return q;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "status" || p === "detail");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    // 兜底:末段是纯数字 mid 或字母数字 bid(排除已知非 id 段如 u/comment)
    const last = parts[parts.length - 1];
    if (last && /^[A-Za-z0-9]+$/.test(last) && parts[0] !== "u") return last;
  } catch {
    /* 非法 URL → null */
  }
  return null;
};

// 解析 statuses/show 的 JSON 响应:{ok:1, data:{ user:{id|idstr}, bid }} → 拼链接。
// 解析失败(非 JSON / ok≠1 / 缺字段,如访客门页漏过来)统一记 noUidBid。
export const parseWeiboShowJson = (url: string, jsonText: string): WeiboConvertResult => {
  const base = { source: url, pc: "", home: "" };
  try {
    const json = JSON.parse(jsonText);
    const data = json?.data;
    // idstr 优先(避免超大 uid 的数字精度问题),退回 id。
    const uid = data?.user?.idstr ?? data?.user?.id;
    const bid = data?.bid;
    if (json?.ok === 1 && uid && bid) {
      return { ...base, pc: `https://weibo.com/${uid}/${bid}`, home: `https://weibo.com/u/${uid}`, ok: true };
    }
  } catch {
    /* 非 JSON(多半是访客门 HTML)→ noUidBid */
  }
  return { ...base, ok: false, reason: "noUidBid" };
};
