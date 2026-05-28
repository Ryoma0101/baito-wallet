import { DEFAULT_WALLS } from '@/constants/walls';
import type { TaxRules } from '@/types';

// ローカルの tax_rules.json をインポート（開発環境およびフォールバック用）
import localTaxRules from '../../public/tax_rules.json';

/**
 * GitHub JSONのURL
 * 税制数値の更新はこのJSONを差し替えるだけで対応できる
 */
export const TAX_RULES_URL =
  'https://raw.githubusercontent.com/Ryoma0101/baito-wallet/main/public/tax_rules.json';

/** fetchのタイムアウト時間（ミリ秒） */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * デフォルト値からフォールバック用のTaxRulesを生成する
 */
export function buildFallbackRules(): TaxRules {
  return localTaxRules as TaxRules;
}

/**
 * レスポンスJSONがTaxRules形式かどうかを検証する
 */
function isValidTaxRules(data: unknown): data is TaxRules {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== 'string') return false;
  if (typeof obj.updated_at !== 'string') return false;
  if (typeof obj.walls !== 'object' || obj.walls === null) return false;

  const walls = obj.walls as Record<string, unknown>;
  const requiredNumbers = [
    'income_tax',
    'dependent_general',
    'dependent_specific_age_min',
    'dependent_specific_age_max',
    'dependent_specific_limit',
    'spouse_full_deduction',
    'social_insurance_specific',
    'social_insurance_basic',
    'social_insurance_large_company',
    'residence_tax_approx',
  ];
  for (const key of requiredNumbers) {
    if (typeof walls[key] !== 'number') return false;
  }

  if (!Array.isArray(obj.news)) return false;
  return true;
}

/**
 * GitHubからtax_rules.jsonをfetchする。
 * 失敗時（オフライン・タイムアウト・不正JSON）はDEFAULT_WALLSのフォールバック値を返す。
 */
export async function fetchTaxRules(): Promise<TaxRules> {
  // 開発環境では常にローカルのJSONを使用する（GitHubへpushしていなくてもテスト可能にするため）
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.NODE_ENV !== 'test') {
    return localTaxRules as TaxRules;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(TAX_RULES_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return buildFallbackRules();
    }

    const data: unknown = await response.json();

    if (!isValidTaxRules(data)) {
      return buildFallbackRules();
    }

    return data;
  } catch {
    return buildFallbackRules();
  }
}
