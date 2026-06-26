import type { Rule } from '../types';
import { contrastTextRule, contrastNonTextRule } from './contrast';
import { targetSizeRule, textSizeRule } from './size';
import { imgAltRule, controlLabelRule, focusVisibleRule } from './semantic';

/** Phase 1 자동 판정 룰 레지스트리 (heading.structure 는 HTML 전용=Phase 2) */
export const autoRuleRegistry: Rule[] = [
  contrastTextRule,
  contrastNonTextRule,
  imgAltRule,
  controlLabelRule,
  targetSizeRule,
  textSizeRule,
  focusVisibleRule,
];

export {
  contrastTextRule,
  contrastNonTextRule,
  targetSizeRule,
  textSizeRule,
  imgAltRule,
  controlLabelRule,
  focusVisibleRule,
};
