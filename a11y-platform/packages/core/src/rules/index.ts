import type { Rule } from '../types';
import { contrastTextRule, contrastNonTextRule } from './contrast';
import { targetSizeRule, textSizeRule } from './size';
import { imgAltRule, controlLabelRule, focusVisibleRule } from './semantic';
import { lineHeightRule, letterSpacingRule } from './textSpacing';
import { linkIdentifiableRule } from './link';

/** 자동 판정 per-node 룰 레지스트리 (heading.structure 는 문서순서 의존 → engine 후처리) */
export const autoRuleRegistry: Rule[] = [
  contrastTextRule,
  contrastNonTextRule,
  imgAltRule,
  controlLabelRule,
  targetSizeRule,
  textSizeRule,
  focusVisibleRule,
  lineHeightRule,
  letterSpacingRule,
  linkIdentifiableRule,
];

export {
  contrastTextRule,
  contrastNonTextRule,
  targetSizeRule,
  textSizeRule,
  imgAltRule,
  controlLabelRule,
  focusVisibleRule,
  lineHeightRule,
  letterSpacingRule,
  linkIdentifiableRule,
};
export { headingStructureFindings } from './heading';
