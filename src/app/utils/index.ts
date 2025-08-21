import {
  splitTextIntoLines,
  cleanLines,
  truncate,
  getTextStats,
  splitParagraph,
  toHalfWidth,
  filterLines,
  removeAdjacentDuplicateLines,
  normalizeNewlines,
  dedupeLines,
  compressNewlines,
} from "./textUtils";
import { copyToClipboard } from "./copyToClipboard";
import { downloadFile } from "./fileUtils";
import { DataContext, DataProvider } from "./DataContext";
import { preprocessJson, stripJsonWrapper } from "./jsonUtils";
import { loadFromLocalStorage, saveToLocalStorage } from "./localStorageUtils";

export {
  splitTextIntoLines,
  cleanLines,
  truncate,
  getTextStats,
  splitParagraph,
  toHalfWidth,
  filterLines,
  removeAdjacentDuplicateLines,
  normalizeNewlines,
  dedupeLines,
  compressNewlines,
  copyToClipboard,
  downloadFile,
  DataContext,
  DataProvider,
  preprocessJson,
  stripJsonWrapper,
  loadFromLocalStorage,
  saveToLocalStorage,
};
