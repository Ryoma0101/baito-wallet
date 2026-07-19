import type { UserSettings, TaxRules, WallResult, WallValues } from '@/types';

/** 個別の壁情報（WallResult.walls の要素型） */
type Wall = WallResult['walls'][number];

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
  const walls: Wall[] = [];
  const w = rules.walls;
  // リモートJSONで無効化された壁キーの集合（省略時は空＝すべて有効）
  const disabled = new Set<string>(rules.disabled_walls ?? []);

  const age = calcAge(settings.birth_date);

  // 壁キーが disabled_walls に含まれる場合は push しない
  const pushWall = (key: keyof WallValues, wall: Wall): void => {
    if (disabled.has(key)) return;
    walls.push(wall);
  };

  // 1. dependent_type === 'none'
  if (settings.dependent_type === 'none') {
    pushWall('income_tax', {
      label: '所得税非課税枠',
      amount: w.income_tax,
      description: '年収がこの額を超えると所得税が発生します',
    });
  }
  // 2. dependent_type === 'parent'
  else if (settings.dependent_type === 'parent') {
    if (age >= w.dependent_specific_age_min && age <= w.dependent_specific_age_max) {
      pushWall('social_insurance_specific', {
        label: '社会保険の扶養',
        amount: w.social_insurance_specific,
        description: '社会保険の扶養から外れる上限額です',
      });
      pushWall('dependent_specific_limit', {
        label: '特定扶養控除',
        amount: w.dependent_specific_limit,
        description: '親の特定扶養控除が受けられる上限額です',
      });
      pushWall('income_tax', {
        label: '所得税非課税枠',
        amount: w.income_tax,
        description: '年収がこの額を超えると所得税が発生します',
      });
    } else {
      pushWall('social_insurance_basic', {
        label: '社会保険の扶養',
        amount: w.social_insurance_basic,
        description: '社会保険の扶養から外れる上限額です',
      });
      pushWall('dependent_general', {
        label: '一般扶養控除',
        amount: w.dependent_general,
        description: '親の一般扶養控除が受けられる上限額です',
      });
      pushWall('income_tax', {
        label: '所得税非課税枠',
        amount: w.income_tax,
        description: '年収がこの額を超えると所得税が発生します',
      });
    }
  }
  // 3. dependent_type === 'spouse'
  else if (settings.dependent_type === 'spouse') {
    pushWall('social_insurance_basic', {
      label: '社会保険の扶養',
      amount: w.social_insurance_basic,
      description: '配偶者の社会保険扶養から外れる上限額です',
    });
    pushWall('spouse_full_deduction', {
      label: '配偶者控除満額',
      amount: w.spouse_full_deduction,
      description: '配偶者控除が満額受けられる上限額です',
    });
    pushWall('income_tax', {
      label: '所得税非課税枠',
      amount: w.income_tax,
      description: '年収がこの額を超えると所得税が発生します',
    });
  }

  // 4. large_company === true
  if (settings.large_company) {
    pushWall('social_insurance_large_company', {
      label: '大企業の社保壁',
      amount: w.social_insurance_large_company,
      description: '大企業では106万円を超えると社会保険加入義務があります',
    });
  }

  // フォールバック: すべての壁が disabled_walls で無効化され配列が空になった場合でも
  // walls[0] でクラッシュしないよう、所得税非課税枠を必ず1つは表示する
  if (walls.length === 0) {
    walls.push({
      label: '所得税非課税枠',
      amount: w.income_tax,
      description: '年収がこの額を超えると所得税が発生します',
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
