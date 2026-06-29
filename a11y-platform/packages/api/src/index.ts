// D: HTML/URL 검사 파이프라인 (Phase 2)
export {
  snapshotToA11yNodes,
  cssColorToHex,
  type DomSnapshot,
  type DomElementSnapshot,
} from './htmlAdapter';
export {
  scanSnapshot,
  axeToFindings,
  type ScanServiceOptions,
  type AxeViolationLike,
} from './scanService';
export {
  handleScan,
  handleFix,
  handleReport,
  type ScanRequest,
  type ApiResult,
  type FixDiffEntry,
} from './routes';
export { collectFromUrl, type CollectOptions, type CollectResult } from './collect';
export {
  collectSiteFromUrl,
  selectCrawlTargets,
  normalizeLink,
  type CrawlPlanOptions,
  type SiteCollectOptions,
  type SiteCollectResult,
  type PageCollect,
} from './crawl';
export {
  figmaFileToA11yNodes,
  figmaColorToHex,
  parseFigmaFileKey,
  type FigmaRestNode,
  type FigmaPaint,
  type FigmaColor,
} from './figmaRestAdapter';
export {
  unityExportToA11yNodes,
  unityColorToHex,
  type UnityNode,
  type UnityExport,
  type UnityColor,
  type UnityColorInput,
} from './unityAdapter';
