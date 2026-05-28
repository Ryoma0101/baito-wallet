import { getAllJobs } from './db';
import { isPremium } from './purchases';

/**
 * バイト先の登録上限チェック
 * @returns プレミアムまたは登録数が2件未満の場合はtrue
 */
export async function canAddJob(): Promise<boolean> {
  const premium = await isPremium();
  if (premium) return true;
  
  const jobs = await getAllJobs();
  return jobs.length < 2;
}

/**
 * シフトの表示期間フィルター
 * @param premium プレミアム状態
 * @returns プレミアムならnull（全件）、無料なら3ヶ月前の日付からの絞り込み設定
 */
export function getShiftDateFilter(premium: boolean): { from: string } | null {
  if (premium) return null;
  
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return { from: `${year}-${month}-${day}` };
}

/**
 * 画像添付の可否チェック
 * @returns プレミアムの場合はtrue
 */
export async function canAttachImage(): Promise<boolean> {
  return await isPremium();
}
