import type { UserSettings, TaxRules, WallResult } from '@/types';

/**
 * 指定した年の12月31日時点での年齢を計算する
 * @param birthDateStr YYYY-MM-DD
 * @param currentYear 計算対象の年（省略時は現在年）
 */
export function calcAge(birthDateStr: string, currentYear?: number): number {
  const year = currentYear ?? new Date().getFullYear();
  const birthYear = parseInt(birthDateStr.split('-')[0], 10);
  return year - birthYear;
}

/**
 * ユーザー設定と税制ルールから、適用される壁のリストと最も低い壁（primary_wall）を算出する純粋関数。
 */
export function calcWalls(settings: UserSettings, rules: TaxRules): WallResult {
  const walls: WallResult['walls'] = [];
  const w = rules.walls;

  const age = calcAge(settings.birth_date);

  // 1. dependent_type === 'none'
  if (settings.dependent_type === 'none') {
    walls.push({
      label: '所得税非課税枠',
      amount: w.income_tax,
      description: '年収がこの額を超えると所得税が発生します',
    });
  }
  // 2. dependent_type === 'parent'
  else if (settings.dependent_type === 'parent') {
    if (age >= w.dependent_specific_age_min && age <= w.dependent_specific_age_max) {
      walls.push({
        label: '社会保険の扶養',
        amount: w.dependent_specific_limit,
        description: '社会保険の扶養から外れる上限額です',
      });
      walls.push({
        label: '特定扶養控除',
        amount: w.dependent_specific_limit,
        description: '親の特定扶養控除が受けられる上限額です',
      });
      walls.push({
        label: '所得税非課税枠',
        amount: w.income_tax,
        description: '年収がこの額を超えると所得税が発生します',
      });
    } else {
      walls.push({
        label: '社会保険の扶養',
        amount: w.social_insurance_basic,
        description: '社会保険の扶養から外れる上限額です',
      });
      walls.push({
        label: '一般扶養控除',
        amount: w.dependent_general,
        description: '親の一般扶養控除が受けられる上限額です',
      });
      walls.push({
        label: '所得税非課税枠',
        amount: w.income_tax,
        description: '年収がこの額を超えると所得税が発生します',
      });
    }
  }
  // 3. dependent_type === 'spouse'
  else if (settings.dependent_type === 'spouse') {
    walls.push({
      label: '社会保険の扶養',
      amount: w.social_insurance_basic,
      description: '配偶者の社会保険扶養から外れる上限額です',
    });
    walls.push({
      label: '配偶者控除',
      amount: w.dependent_general,
      description: '配偶者控除が受けられる上限額です',
    });
    walls.push({
      label: '所得税非課税枠',
      amount: w.income_tax,
      description: '年収がこの額を超えると所得税が発生します',
    });
  }

  // 4. large_company === true
  if (settings.large_company) {
    walls.push({
      label: '大企業の社保壁',
      amount: w.social_insurance_large_company,
      description: '大企業では106万円を超えると社会保険加入義務があります',
    });
  }

  // Sort by amount ascending to ensure deterministic order (and primary wall logic)
  walls.sort((a, b) => a.amount - b.amount);

  const primary = walls[0];

  return {
    primary_wall: primary.amount,
    primary_label: primary.label,
    walls,
  };
}
