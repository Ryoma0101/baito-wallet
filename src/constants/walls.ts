/**
 * デフォルトの税制数値（フォールバック用）
 * GitHub JSONのfetchが失敗した場合にこの値を使用する。
 * 税制変更時はこのファイルとGitHub JSONの両方を更新すること。
 */
export const DEFAULT_WALLS = {
  /** 所得税の非課税枠（2026年〜） */
  income_tax: 1_780_000,
  /** 一般扶養控除の上限 */
  dependent_general: 1_780_000,
  /** 特定扶養の最低年齢 */
  dependent_specific_age_min: 19,
  /** 特定扶養の最高年齢 */
  dependent_specific_age_max: 22,
  /** 特定扶養控除の上限 */
  dependent_specific_limit: 1_500_000,
  /** 社会保険の扶養上限（基本） */
  social_insurance_basic: 1_300_000,
  /** 社会保険の扶養上限（大企業） */
  social_insurance_large_company: 1_060_000,
  /** 住民税の非課税ライン（目安） */
  residence_tax_approx: 1_100_000,
} as const;

export type WallValues = typeof DEFAULT_WALLS;
