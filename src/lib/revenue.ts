import type { UserSettings, Job, Shift, Payslip, RevenueResult } from '@/types';

/**
 * 収入を集計する純粋関数
 * - payslips（給与明細・実績）を優先
 * - 未入力の月・バイト先については、shifts（シフト・見込み）で補完
 * - 年初繰越収入も合算する
 */
export function calcRevenue(
  settings: UserSettings,
  jobs: Job[],
  shifts: Shift[],
  payslips: Payslip[],
  currentYear?: number
): RevenueResult {
  const year = currentYear ?? new Date().getFullYear();

  // job_id -> { job_name, total }
  const jobsMap = new Map<number, { job_name: string; total: number }>();
  for (const job of jobs) {
    jobsMap.set(job.id, { job_name: job.name, total: 0 });
  }

  // "job_id-month" -> { amount, source }
  const jobMonthMap = new Map<string, { amount: number; source: 'actual' | 'estimated' }>();

  // 1. payslips（実績）を先に集計
  for (const p of payslips) {
    if (p.year !== year) continue;
    const key = `${p.job_id}-${p.month}`;
    const current = jobMonthMap.get(key) || { amount: 0, source: 'actual' };
    current.amount += p.actual_amount;
    current.source = 'actual';
    jobMonthMap.set(key, current);
  }

  // 2. shifts（見込み）を実績がない部分だけ補完
  for (const s of shifts) {
    const d = new Date(s.date);
    if (d.getFullYear() !== year) continue;

    const m = d.getMonth() + 1;
    const key = `${s.job_id}-${m}`;

    // その月・そのバイト先の実績(payslip)が存在しない場合のみ加算
    if (!jobMonthMap.has(key) || jobMonthMap.get(key)!.source !== 'actual') {
      const current = jobMonthMap.get(key) || { amount: 0, source: 'estimated' };
      current.amount += s.estimated_wage;
      current.source = 'estimated'; // Ensure it's marked as estimated
      jobMonthMap.set(key, current);
    }
  }

  // 3. 全体月別集計とバイト先別集計
  const monthly: RevenueResult['monthly'] = [];
  let totalFromWork = 0;

  for (let m = 1; m <= 12; m++) {
    let monthTotal = 0;
    let allActual = true; // その月の収入データが全て実績か
    let hasAnyData = false;

    // 現在の月に関連する jobs のデータがあるか確認
    for (const job of jobs) {
      const key = `${job.id}-${m}`;
      if (jobMonthMap.has(key)) {
        hasAnyData = true;
        const entry = jobMonthMap.get(key)!;
        monthTotal += entry.amount;
        if (entry.source === 'estimated') {
          allActual = false;
        }

        const j = jobsMap.get(job.id)!;
        j.total += entry.amount;
      }
    }

    monthly.push({
      year,
      month: m,
      amount: monthTotal,
      source: hasAnyData && allActual ? 'actual' : 'estimated',
    });
  }

  const by_job: RevenueResult['by_job'] = [];
  for (const [job_id, data] of jobsMap.entries()) {
    totalFromWork += data.total;
    by_job.push({
      job_id,
      job_name: data.job_name,
      total: data.total,
    });
  }

  return {
    annual_total: totalFromWork + settings.carryover_income,
    monthly,
    by_job,
  };
}
