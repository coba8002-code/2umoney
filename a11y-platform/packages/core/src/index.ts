// 공개 API — 플랫폼 독립 접근성 코어
export * from './types';
export { hexToRgb, rgbToHex, relLuminance, contrastRatio, isLargeText } from './color/contrast';
export { nearestPassingColor, type NearestColorResult } from './color/nearestPassingColor';
export { scanNodes, summarize, flatten, type ScanOptions } from './engine';
export { autoRuleRegistry } from './rules';
export { buildReport, reportToJson, reportToText, type A11yReport, type ReportBreakdown } from './report';
export { allRules, autoRules, getRule, rulesData, type RuleDef } from '@app/rules-data';
