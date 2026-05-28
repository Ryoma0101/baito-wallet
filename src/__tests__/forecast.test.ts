import { calcForecast } from '../lib/forecast';
import type { RevenueResult } from '../types';

/** ヘルパー: 月別サマリーを簡単に作る */
function makeMonthly(
  data: { month: number; amount: number; source?: 'actual' | 'estimated' }[],
): RevenueResult['monthly'] {
  const result: RevenueResult['monthly'] = [];
  for (let m = 1; m <= 12; m++) {
    const entry = data.find((d) => d.month === m);
    result.push({
      year: 2026,
      month: m,
      amount: entry?.amount ?? 0,
      source: entry?.source ?? 'estimated',
    });
  }
  return result;
}

describe('calcForecast', () => {
  describe('直近3ヶ月のデータがある場合', () => {
    test('直近3ヶ月の平均月収でペースを算出する', () => {
      const monthly = makeMonthly([
        { month: 1, amount: 100000 },
        { month: 2, amount: 120000 },
        { month: 3, amount: 80000 },
        { month: 4, amount: 110000 },
        { month: 5, amount: 90000 },
      ]);

      const result = calcForecast(monthly, 5, 1_300_000);

      // 直近3ヶ月 = 3月(80000), 4月(110000), 5月(90000)
      // 平均 = (80000 + 110000 + 90000) / 3 = 93333
      expect(result.monthly_pace).toBe(93333);

      // 6〜12月（7ヶ月）× 93333 + 1〜5月合計(500000) = 500000 + 653331 = 1153331
      expect(result.predicted_annual).toBe(
        100000 + 120000 + 80000 + 110000 + 90000 + 93333 * 7,
      );

      // 1〜5月: 実績データ
      for (let m = 1; m <= 5; m++) {
        expect(result.monthly_forecast[m - 1].is_forecast).toBe(false);
      }
      // 6〜12月: 予測データ
      for (let m = 6; m <= 12; m++) {
        expect(result.monthly_forecast[m - 1].is_forecast).toBe(true);
        expect(result.monthly_forecast[m - 1].amount).toBe(93333);
      }
    });
  });

  describe('データが1ヶ月分しかない場合', () => {
    test('その1ヶ月の月収をペースとして使う', () => {
      const monthly = makeMonthly([
        { month: 1, amount: 150000 },
      ]);

      const result = calcForecast(monthly, 1, 1_300_000);

      // ペース = 150000 / 1 = 150000
      expect(result.monthly_pace).toBe(150000);

      // 2〜12月（11ヶ月）× 150000 + 1月(150000) = 150000 + 1650000 = 1800000
      expect(result.predicted_annual).toBe(150000 + 150000 * 11);
    });
  });

  describe('データがゼロの場合', () => {
    test('ペース0で予測される', () => {
      const monthly = makeMonthly([]);

      const result = calcForecast(monthly, 3, 1_300_000);

      expect(result.monthly_pace).toBe(0);
      expect(result.predicted_annual).toBe(0);
      expect(result.overshoot_month).toBeNull();
    });
  });

  describe('壁を超えると予測される場合', () => {
    test('超える月を正しく特定する', () => {
      const monthly = makeMonthly([
        { month: 1, amount: 200000 },
        { month: 2, amount: 200000 },
        { month: 3, amount: 200000 },
      ]);

      // 壁: 130万円、ペース: 20万円/月
      // 累積: 1月=20, 2月=40, 3月=60, 4月=80, 5月=100, 6月=120, 7月=140 → 7月に超える
      const result = calcForecast(monthly, 3, 1_300_000);

      expect(result.monthly_pace).toBe(200000);
      expect(result.overshoot_month).toBe(7);
    });
  });

  describe('壁を超えないと予測される場合', () => {
    test('overshoot_month が null になる', () => {
      const monthly = makeMonthly([
        { month: 1, amount: 50000 },
        { month: 2, amount: 50000 },
        { month: 3, amount: 50000 },
      ]);

      // 壁: 130万円、ペース: 5万円/月
      // 年間: 5万 × 12 = 60万 → 超えない
      const result = calcForecast(monthly, 3, 1_300_000);

      expect(result.monthly_pace).toBe(50000);
      expect(result.overshoot_month).toBeNull();
    });
  });

  describe('繰越収入がある場合', () => {
    test('繰越分も壁超え判定に含まれる', () => {
      const monthly = makeMonthly([
        { month: 1, amount: 100000 },
        { month: 2, amount: 100000 },
        { month: 3, amount: 100000 },
      ]);

      // 繰越: 100万、ペース: 10万/月
      // 累積: 繰越100 + 1月=110 + 2月=120 + 3月=130（丁度=超えない） + 4月=140 → 4月で超える
      const result = calcForecast(monthly, 3, 1_300_000, 1_000_000);

      expect(result.overshoot_month).toBe(4);
      expect(result.predicted_annual).toBe(
        1_000_000 + 100000 * 3 + 100000 * 9,
      );
    });
  });

  describe('月の途中のデータ', () => {
    test('currentMonth が12月の場合、予測は発生しない', () => {
      const monthly = makeMonthly([
        { month: 1, amount: 100000 },
        { month: 2, amount: 100000 },
        { month: 3, amount: 100000 },
        { month: 4, amount: 100000 },
        { month: 5, amount: 100000 },
        { month: 6, amount: 100000 },
        { month: 7, amount: 100000 },
        { month: 8, amount: 100000 },
        { month: 9, amount: 100000 },
        { month: 10, amount: 100000 },
        { month: 11, amount: 100000 },
        { month: 12, amount: 100000 },
      ]);

      const result = calcForecast(monthly, 12, 1_300_000);

      // 全月が実績
      for (let m = 1; m <= 12; m++) {
        expect(result.monthly_forecast[m - 1].is_forecast).toBe(false);
      }
      expect(result.predicted_annual).toBe(1_200_000);
    });
  });
});
