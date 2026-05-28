import { resetAllData, saveUserSettings, addJob, addShift, addPayslip, getAllJobs } from './db';

function padDate(num: number): string {
  return num.toString().padStart(2, '0');
}

export async function seedDummyData() {
  console.log('Seeding dummy data...');
  try {
  // 1. Reset all existing data
  await resetAllData();
  
  // 2. Set user settings (e.g., 1030000 limit)
  await saveUserSettings({
    id: 1,
    birth_date: '2000-01-01',
    dependent_type: 'none',
    large_company: false,
    carryover_income: 0,
    plan: 'free',
  } as any);
  
  // 3. Create dummy jobs
  await addJob({
    name: '駅前カフェ',
    hourly_wage: 1100,
    employment_type: 'part',
    is_active: true,
    transportation_allowance: 500,
  });
  
  await addJob({
    name: 'コンビニエンスストア',
    hourly_wage: 1050,
    employment_type: 'part',
    is_active: true,
    transportation_allowance: 0,
  });
  
  const jobs = await getAllJobs();
  if (jobs.length < 2) return;
  
  const cafeId = jobs[0].id;
  const storeId = jobs[1].id;
  
  const now = new Date();
  
  // 4. Generate shifts for the past 6 months up to this month
  for (let i = 5; i >= 0; i--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth() + 1;
    
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let cafeEarnings = 0;
    let storeEarnings = 0;
    
    // Random shifts (about 12 shifts for Cafe, 8 for Store per month)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${padDate(month)}-${padDate(day)}`;
      
      // Cafe Shift (Tuesdays, Thursdays, Saturdays)
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      
      if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6) {
        // 5 hours shift
        await addShift({
          job_id: cafeId,
          date: dateStr,
          start_time: '10:00',
          end_time: '15:00',
          break_minutes: 0,
          estimated_wage: 5500, // 1100 * 5
          transportation_allowance: 500,
        });
        cafeEarnings += 5500;
      }
      
      // Store Shift (Mondays, Wednesdays)
      if (dayOfWeek === 1 || dayOfWeek === 3) {
        // 4 hours shift
        await addShift({
          job_id: storeId,
          date: dateStr,
          start_time: '17:00',
          end_time: '21:00',
          break_minutes: 0,
          estimated_wage: 4200, // 1050 * 4
          transportation_allowance: 0,
        });
        storeEarnings += 4200;
      }
    }
    
    // 5. Generate Payslips for the previous month (except current month)
    if (i > 0) {
      await addPayslip({
        job_id: cafeId,
        year,
        month,
        actual_amount: cafeEarnings + (12 * 500), // ~12 shifts * 500
        taxable_amount: cafeEarnings,
        non_taxable_amount: 12 * 500,
        image_uri: null,
      });
      
      await addPayslip({
        job_id: storeId,
        year,
        month,
        actual_amount: storeEarnings,
        taxable_amount: storeEarnings,
        non_taxable_amount: 0,
        image_uri: null,
      });
    }
  }
  
  console.log('Dummy data seeded successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  }
}
