// ============================================================
// ユーザー設定
// ============================================================

/** 扶養種別 */
export type DependentType = 'parent' | 'spouse' | 'none';

/** 課金プラン */
export type PlanType = 'free' | 'premium' | 'lifetime';

/** ユーザー設定（user_settingsテーブルに対応） */
export interface UserSettings {
  birth_date: string;          // YYYY-MM-DD
  dependent_type: DependentType;
  large_company: boolean;
  is_student: boolean;         // 昼間部の学生か（106万円壁の適用除外判定用）
  carryover_income: number;    // 円
  plan: PlanType;
}

// ============================================================
// 税制ルール（GitHub JSON）
// ============================================================

/** 壁の金額・年齢条件 */
export interface WallValues {
  income_tax: number;
  dependent_general: number;
  dependent_specific_age_min: number;
  dependent_specific_age_max: number;
  dependent_specific_limit: number;
  spouse_full_deduction: number;
  social_insurance_specific: number;
  social_insurance_basic: number;
  social_insurance_large_company: number;
  residence_tax_approx: number;
}

/** ニュースの対象ユーザー種別 */
export type NewsTarget = 'all' | 'large_company' | 'parent' | 'spouse';

/** 税制ニュース */
export interface TaxNews {
  id: string;
  title: string;
  body: string;
  published_at: string;
  important: boolean;
  target: NewsTarget[];
}

/** GitHub JSONのルート構造 */
export interface TaxRules {
  version: string;
  updated_at: string;
  walls: WallValues;
  news: TaxNews[];
  promo_codes?: string[];
  /**
   * リモートJSONから壁を無効化するためのキー名の配列。
   * ここに含まれる壁キー（例: "social_insurance_large_company"）は判定結果から除外される。
   * 2026年10月の106万円の壁撤廃など、法改正時にアプリ更新なしで壁を消せるようにするためのフィールド。
   * 省略可能（存在しない場合はすべての壁が有効）。
   */
  disabled_walls?: string[];
}

// ============================================================
// 壁の判定結果
// ============================================================

/** 個別の壁情報 */
export interface WallResult {
  primary_wall: number;
  primary_label: string;
  walls: {
    label: string;
    amount: number;
    description: string;
  }[];
}

// ============================================================
// 収入集計結果
// ============================================================

export interface RevenueResult {
  annual_total: number;
  monthly: {
    year: number;
    month: number;
    amount: number;
    source: 'actual' | 'estimated';
  }[];
  by_job: {
    job_id: number;
    job_name: string;
    total: number;
  }[];
}

// ============================================================
// バイト先・シフト・給与明細
// ============================================================

/** 雇用形態 */
export type EmploymentType = 'part' | 'dispatch' | 'other';

/** バイト先（jobsテーブルに対応） */
export interface Job {
  id: number;
  name: string;
  hourly_wage: number;
  employment_type: EmploymentType;
  is_active: boolean;
  transportation_allowance: number;
}

/** シフト（shiftsテーブルに対応） */
export interface Shift {
  id: number;
  job_id: number;
  date: string;           // YYYY-MM-DD
  start_time: string;     // HH:MM
  end_time: string;       // HH:MM
  break_minutes: number;
  estimated_wage: number;
  transportation_allowance: number;
}

/** 給与明細（payslipsテーブルに対応） */
export interface Payslip {
  id: number;
  job_id: number;
  year: number;
  month: number;           // 1〜12
  actual_amount: number;
  taxable_amount: number;
  non_taxable_amount: number;
  image_uri: string | null;
}
