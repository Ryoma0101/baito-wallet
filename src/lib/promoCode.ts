import * as Crypto from 'expo-crypto';

import type { TaxRules } from '@/types';

/**
 * プロモコードを検証する。
 *
 * 仕組み:
 * 1. 入力されたコードを小文字にトリムし、SHA256でハッシュ化
 * 2. tax_rules.json の promo_codes 配列（SHA256ハッシュのリスト）と照合
 * 3. 一致すれば true を返す
 *
 * これにより、JSONファイルにはハッシュのみが格納され、
 * 元のプロモコード文字列が外部に漏れることがない。
 *
 * @param code ユーザーが入力したプロモコード
 * @param rules fetchした税制ルール（promo_codes を含む）
 * @returns true: コードが有効、false: 無効
 */
export async function redeemPromoCode(
  code: string,
  rules: TaxRules,
): Promise<boolean> {
  if (!code || !code.trim()) {
    return false;
  }

  const promoCodes = rules.promo_codes;
  if (!promoCodes || promoCodes.length === 0) {
    return false;
  }

  const normalized = code.trim().toLowerCase();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized,
  );

  return promoCodes.includes(hash);
}
