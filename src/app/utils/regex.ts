// 标点符号结尾的正则表达式
export const punctuationEndRegex = /(?:[。？！…”"」\]】)）※]|\.{3,}|-{3,}|—{3,}|={3,}|＝{3,})$/;
// 以特殊字符开头的任意行，未包含括号 （(
export const specialLineStartRegex = /^(?:[【「\[“"◆※].*|-{3,}|—{3,}|={3,}|＝{3,}|第.*[章节卷])$/;

// 纯数字行的正则表达式
export const pureNumberRegex = /^\d+$/;
// 数字开头
export const numberStartRegex = /^\d+/;
// 数字结尾
export const numberEndRegex = /\d$/;

// 中文小说常用正则
// 章节标题正则
export const chapterTitleRegex =
  /^(序章|序言|引子|前言|卷首语|扉页|楔子|正文|终章|后记|附录|尾声|番外|[上中下][部册]册|第?\s{0,4}[\d〇零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+?\s{0,4}(?:章|节(?!课)|卷|集(?![合和])|幕(?![前后布])|回(?![合访忆顾应答音])|部(?![分赛游])|篇(?!张))).*/;

// 数字标题正则
export const numberTitleRegex = /^[ 　\t]{0,4}\d{1,5}([：:,.， 、_—\-]|【.{1,30}】).{0,30}$/;

// 标题严格正则：第 X 章
export const chapterPattern = /^(第?\s{0,4}[\d〇零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+?\s{0,4}章)(.*)$/;

export const novelSectionHeaderRegex = /^(?:作者|(?:内容|作品)?简介|创作|标签)[:：]?/u;
