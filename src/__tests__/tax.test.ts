import { calcWalls, calcAge } from '../lib/tax';
import { DEFAULT_WALLS } from '../constants/walls';
import type { UserSettings, TaxRules } from '../types';

describe('tax.ts', () => {
  const currentYear = new Date().getFullYear(); // Typically 2026 for this test logic

  const mockRules: TaxRules = {
    version: '2026',
    updated_at: '2026-01-01',
    walls: { ...DEFAULT_WALLS },
    news: [],
  };

  const getBirthDateForAge = (age: number) => {
    return `${currentYear - age}-04-01`;
  };

  describe('calcAge', () => {
    test('12月31日時点での年齢を正しく計算する', () => {
      expect(calcAge('2007-04-01', 2026)).toBe(19);
      expect(calcAge('2003-12-31', 2026)).toBe(23);
      expect(calcAge('2004-01-01', 2026)).toBe(22);
    });
  });

  describe('calcWalls', () => {
    test('19歳・親の扶養・小企業', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(19),
        dependent_type: 'parent',
        large_company: false,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_500_000);
      expect(result.walls).toHaveLength(3);
      // 150万(社保), 159万(特定扶養), 178万(所得税)
      expect(result.walls[0].label).toBe('社会保険の扶養');
      expect(result.walls[0].amount).toBe(1_500_000);
      expect(result.walls[1].label).toBe('特定扶養控除');
      expect(result.walls[1].amount).toBe(1_590_000);
      expect(result.walls[2].label).toBe('所得税非課税枠');
      expect(result.walls[2].amount).toBe(1_780_000);
    });

    test('19歳・親の扶養・大企業', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(19),
        dependent_type: 'parent',
        large_company: true,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_060_000);
      expect(result.walls).toHaveLength(4);
      expect(result.primary_label).toBe('大企業の社保壁');
    });

    test('22歳・親の扶養（特定扶養の上限境界値）', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(22),
        dependent_type: 'parent',
        large_company: false,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_500_000);
      expect(result.walls).toContainEqual(
        expect.objectContaining({ label: '特定扶養控除', amount: 1_590_000 })
      );
    });

    test('23歳・親の扶養（一般扶養の下限境界値）', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(23),
        dependent_type: 'parent',
        large_company: false,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_300_000); // 一般社保130万
      expect(result.primary_label).toBe('社会保険の扶養');
      expect(result.walls).toContainEqual(
        expect.objectContaining({ label: '一般扶養控除', amount: 1_360_000 })
      );
    });

    test('配偶者の扶養・小企業', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(30),
        dependent_type: 'spouse',
        large_company: false,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_300_000);
      expect(result.walls).toHaveLength(3);
      expect(result.walls).toContainEqual(
        expect.objectContaining({ label: '配偶者控除満額', amount: 1_690_000 })
      );
    });

    test('配偶者の扶養・大企業', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(30),
        dependent_type: 'spouse',
        large_company: true,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_060_000);
      expect(result.walls).toHaveLength(4);
    });

    test('扶養なし', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(25),
        dependent_type: 'none',
        large_company: false, // 扶養外なら大企業でも扶養の壁は関係ないが、所得税のみ残るはず
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      expect(result.primary_wall).toBe(1_780_000);
      expect(result.walls).toHaveLength(1);
      expect(result.walls[0].label).toBe('所得税非課税枠');
    });
    
    test('扶養なし・大企業', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(25),
        dependent_type: 'none',
        large_company: true,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);
      
      // 扶養なしでも大企業なら自身の社保加入義務（106万）がある
      expect(result.primary_wall).toBe(1_060_000);
      expect(result.walls).toHaveLength(2);
      expect(result.primary_label).toBe('大企業の社保壁');
    });
  });

  describe('calcWalls: disabled_walls（リモートJSONによる壁の無効化）', () => {
    test('disabled_walls で106万円の壁（大企業）が判定から消える', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(19),
        dependent_type: 'parent',
        large_company: true,
        carryover_income: 0,
        plan: 'free',
      };
      const rulesWithDisabled: TaxRules = {
        ...mockRules,
        disabled_walls: ['social_insurance_large_company'],
      };
      const result = calcWalls(settings, rulesWithDisabled);

      // 106万の壁が消えるので、次の壁（社保の扶養150万）が primary になる
      expect(result.walls).not.toContainEqual(
        expect.objectContaining({ label: '大企業の社保壁' })
      );
      expect(result.walls).toHaveLength(3);
      expect(result.primary_wall).toBe(1_500_000);
      expect(result.primary_label).toBe('社会保険の扶養');
    });

    test('すべての壁が無効化されても income_tax のフォールバックが効きクラッシュしない', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(25),
        dependent_type: 'none',
        large_company: false,
        carryover_income: 0,
        plan: 'free',
      };
      // 'none' の唯一の壁である income_tax を無効化 → 配列が空になる
      const rulesAllDisabled: TaxRules = {
        ...mockRules,
        disabled_walls: ['income_tax'],
      };
      const result = calcWalls(settings, rulesAllDisabled);

      // フォールバックで所得税非課税枠が必ず1つ表示される
      expect(result.walls).toHaveLength(1);
      expect(result.primary_label).toBe('所得税非課税枠');
      expect(result.primary_wall).toBe(1_780_000);
    });

    test('disabled_walls が未定義でも従来どおりすべての壁が有効', () => {
      const settings: UserSettings = {
        birth_date: getBirthDateForAge(19),
        dependent_type: 'parent',
        large_company: true,
        carryover_income: 0,
        plan: 'free',
      };
      const result = calcWalls(settings, mockRules);

      expect(result.walls).toHaveLength(4);
      expect(result.walls).toContainEqual(
        expect.objectContaining({ label: '大企業の社保壁', amount: 1_060_000 })
      );
    });
  });
});
