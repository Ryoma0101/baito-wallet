import type { RevenueResult } from '@/types';

// ============================================================
// 型定義
// ============================================================

export interface MonthlyForecastItem {
  month: number;
  amount: number;
  is_forecast: boolean; // true=予測値、false=実績/見込み
}

export interface ForecastResult {
  /** 予測年間収入 */
  predicted_annual: number;
  /** 何月に壁を超えるか（1〜12 or null=超えない） */
  overshoot_month: number | null;
  /** 月別予測（グラフ用） */
  monthly_forecast: MonthlyForecastItem[];
  /** 予測に使用した月収ペース */
  monthly_pace: number;
}

// ============================================================
// 予測ロジック
// ============================================================

/**
 * 直近の収入データから年末までの収入を予測する純粋関数。
 *
 * 予測方法:
 * 1. currentMonth 以前のデータから月収ペースを算出
 *    - 直近3ヶ月のデータがある場合 → その3ヶ月の平均月収
 *    - 3ヶ月未満しかない場合 → データがある全期間の平均月収
 *    - データが0の場合 → ペース 0
 * 2. currentMonth+1 〜 12月を予測値として埋める
 * 3. 累積合計が壁を超える月を特定する
 *
 * @param monthlySummary calcRevenue() で得た monthly 配列
 * @param currentMonth   現在の月（1〜12）
 * @param primaryWall    超えてはいけない壁の金額
 * @param carryoverIncome 年初繰越収入
 */
export function calcForecast(
  monthlySummary: RevenueResult['monthly'],
  currentMonth: number,
  primaryWall: number,
  carryoverIncome: number = 0,
): ForecastResult {
  // 1. currentMonth 以前の月データを取得
  const pastMonths = monthlySummary.filter(
    (m) => m.month <= currentMonth && m.amount > 0,
  );

  // 2. 月収ペースの算出
  let monthlyPace = 0;

  if (pastMonths.length >= 3) {
    // 直近3ヶ月の平均
    const recent = pastMonths
      .sort((a, b) => b.month - a.month)
      .slice(0, 3);
    const sum = recent.reduce((acc, m) => acc + m.amount, 0);
    monthlyPace = Math.round(sum / recent.length);
  } else if (pastMonths.length > 0) {
    // 全期間の平均
    const sum = pastMonths.reduce((acc, m) => acc + m.amount, 0);
    monthlyPace = Math.round(sum / pastMonths.length);
  }

  // 3. 月別予測を構築
  const monthlyForecast: MonthlyForecastItem[] = [];
  let runningTotal = carryoverIncome;
  let overshootMonth: number | null = null;

  for (let m = 1; m <= 12; m++) {
    const existing = monthlySummary.find((entry) => entry.month === m);

    if (m <= currentMonth && existing) {
      // 実績/見込みデータがある月
      monthlyForecast.push({
        month: m,
        amount: existing.amount,
        is_forecast: false,
      });
      runningTotal += existing.amount;
    } else {
      // 未来の月 → 予測値
      monthlyForecast.push({
        month: m,
        amount: monthlyPace,
        is_forecast: true,
      });
      runningTotal += monthlyPace;
    }

    // 壁超え判定
    if (overshootMonth === null && runningTotal > primaryWall) {
      overshootMonth = m;
    }
  }

  return {
    predicted_annual: runningTotal,
    overshoot_month: overshootMonth,
    monthly_forecast: monthlyForecast,
    monthly_pace: monthlyPace,
  };
}
