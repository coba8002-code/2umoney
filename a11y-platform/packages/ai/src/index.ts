// C1: AI 계층 — 프로바이더 추상화 + 결정론 폴백 + 보강
export type {
  LlmProvider,
  ImageContext,
  AltSuggestion,
  AssessResult,
  Rule,
} from './provider';
export { HeuristicAltProvider } from './heuristicProvider';
export {
  ClaudeAltProvider,
  createAltProvider,
  type ClaudeProviderOptions,
} from './claudeProvider';
export { enrichAltSuggestions, type EnrichOptions } from './enrich';
