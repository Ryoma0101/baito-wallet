import { calcRevenue } from '../lib/revenue';
import type { UserSettings, Job, Shift, Payslip } from '../types';

describe('revenue.ts', () => {
  const currentYear = 2026;

  const baseSettings: UserSettings = {
    birth_date: '2000-01-01',
    dependent_type: 'none',
    large_company: false,
    carryover_income: 0,
    plan: 'free',
  };

  const jobs: Job[] = [
    { id: 1, name: 'カフェ', hourly_wage: 1000, employment_type: 'part', is_active: true, transportation_allowance: 0 },
    { id: 2, name: '家庭教師', hourly_wage: 2000, employment_type: 'part', is_active: true, transportation_allowance: 0 },
  ];

  test('全月shiftsのみ（明細未入力）の場合、全てestimatedになる', () => {
    const shifts: Shift[] = [
      { id: 1, job_id: 1, date: '2026-01-10', start_time: '10:00', end_time: '15:00', break_minutes: 0, estimated_wage: 5000, transportation_allowance: 0 },
      { id: 2, job_id: 2, date: '2026-02-15', start_time: '10:00', end_time: '12:00', break_minutes: 0, estimated_wage: 2200, transportation_allowance: 0 },
    ];
    const payslips: Payslip[] = [];

    const result = calcRevenue(baseSettings, jobs, shifts, payslips, currentYear);

    expect(result.annual_total).toBe(7200);
    expect(result.monthly[0].amount).toBe(5000); // 1月
    expect(result.monthly[0].source).toBe('estimated');
    expect(result.monthly[1].amount).toBe(2200); // 2月
    expect(result.monthly[1].source).toBe('estimated');
    expect(result.monthly[2].amount).toBe(0);    // 3月
    expect(result.monthly[2].source).toBe('estimated'); // 何もない月はデフォルトでestimated扱い

    expect(result.by_job.find(j => j.job_id === 1)?.total).toBe(5000);
    expect(result.by_job.find(j => j.job_id === 2)?.total).toBe(2200);
  });

  test('一部payslips・一部shifts混在の場合、payslipsが優先される', () => {
    // 1月はカフェのシフト(5000)とコンビニのシフト(2200)がある
    const shifts: Shift[] = [
      { id: 1, job_id: 1, date: '2026-01-10', start_time: '10:00', end_time: '15:00', break_minutes: 0, estimated_wage: 5000, transportation_allowance: 0 },
      { id: 2, job_id: 2, date: '2026-01-15', start_time: '10:00', end_time: '12:00', break_minutes: 0, estimated_wage: 2200, transportation_allowance: 0 },
    ];
    // しかし1月はカフェの実績(5500)が入力されている。コンビニは実績未入力。
    const payslips: Payslip[] = [
      { id: 1, job_id: 1, year: 2026, month: 1, actual_amount: 5500, taxable_amount: 5500, non_taxable_amount: 0, image_uri: null },
    ];

    const result = calcRevenue(baseSettings, jobs, shifts, payslips, currentYear);

    // カフェは実績(5500)が採用され、コンビニは見込み(2200)が採用される
    expect(result.annual_total).toBe(5500 + 2200);
    expect(result.monthly[0].amount).toBe(7700);
    expect(result.monthly[0].source).toBe('estimated'); // 混在しているので月全体としてはestimated

    expect(result.by_job.find(j => j.job_id === 1)?.total).toBe(5500);
    expect(result.by_job.find(j => j.job_id === 2)?.total).toBe(2200);
  });

  test('全月payslips入力済みの場合、全てactualになる', () => {
    const shifts: Shift[] = [
      { id: 1, job_id: 1, date: '2026-01-10', start_time: '10:00', end_time: '15:00', break_minutes: 0, estimated_wage: 5000, transportation_allowance: 0 },
    ];
    const payslips: Payslip[] = [
      { id: 1, job_id: 1, year: 2026, month: 1, actual_amount: 10000, taxable_amount: 10000, non_taxable_amount: 0, image_uri: null },
      { id: 2, job_id: 2, year: 2026, month: 1, actual_amount: 20000, taxable_amount: 20000, non_taxable_amount: 0, image_uri: null },
    ];

    const result = calcRevenue(baseSettings, jobs, shifts, payslips, currentYear);

    // シフトは無視され実績のみ合算される（10000 + 20000 = 30000）
    expect(result.monthly[0].amount).toBe(30000);
    expect(result.monthly[0].source).toBe('actual');
  });

  test('carryover_incomeが50万円の場合、年間合計に加算される', () => {
    const settingsWithCarryover: UserSettings = { ...baseSettings, carryover_income: 500_000 };
    const shifts: Shift[] = [];
    const payslips: Payslip[] = [
      { id: 1, job_id: 1, year: 2026, month: 1, actual_amount: 5000, taxable_amount: 5000, non_taxable_amount: 0, image_uri: null },
    ];

    const result = calcRevenue(settingsWithCarryover, jobs, shifts, payslips, currentYear);

    // バイト先別の合計には繰越を含めない
    expect(result.by_job.find(j => j.job_id === 1)?.total).toBe(5000);
    // 年間合計には繰越を含める
    expect(result.annual_total).toBe(505_000);
  });
});
