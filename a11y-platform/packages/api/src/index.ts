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
