// ============================================================
// ユーザー設定
// ============================================================

/** 扶養種別 */
export type DependentType = 'parent' | 'spouse' | 'none';

/** 課金プラン */
export type PlanType = 'free' | 'premium';

/** ユーザー設定（user_settingsテーブルに対応） */
export interface UserSettings {
  birth_date: string;          // YYYY-MM-DD
  dependent_type: DependentType;
  large_company: boolean;
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
  social_insurance_basic: number;
  social_insurance_large_company: number;
  residence_tax_approx: number;
}

/** 税制ニュース */
export interface TaxNews {
  id: string;
  title: string;
  body: string;
  published_at: string;
  important: boolean;
}

/** GitHub JSONのルート構造 */
export interface TaxRules {
  version: string;
  updated_at: string;
  walls: WallValues;
  news: TaxNews[];
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
}

/** 給与明細（payslipsテーブルに対応） */
export interface Payslip {
  id: number;
  job_id: number;
  year: number;
  month: number;           // 1〜12
  actual_amount: number;
}
