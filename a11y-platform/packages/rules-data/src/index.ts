import rulesJson from '../rules.json' with { type: 'json' };

export type StandardId = 'KWCAG2.2' | 'WCAG2.2';
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';
export type FixKind = 'color' | 'fontSize' | 'touchTarget' | 'ai' | 'focusStyle' | 'none';

export interface RuleDef {
  id: string;
  criterion: string;
  standard: StandardId[];
  auto: boolean;
  severity: Severity;
  fixable: FixKind;
  titleKo: string;
  titleEn: string;
  params: Record<string, number>;
}

export interface RulesData {
  version: string;
  standardLabels: Record<StandardId, string>;
  rules: RuleDef[];
}

export const rulesData = rulesJson as unknown as RulesData;

const byId = new Map<string, RuleDef>(rulesData.rules.map((r) => [r.id, r]));

export function getRule(id: string): RuleDef {
  const rule = byId.get(id);
  if (!rule) throw new Error(`Unknown ruleId: ${id}`);
  return rule;
}

export function allRules(): RuleDef[] {
  return rulesData.rules;
}

export function autoRules(): RuleDef[] {
  return rulesData.rules.filter((r) => r.auto);
}
