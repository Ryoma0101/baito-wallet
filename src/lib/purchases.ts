import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

import { getUserSettings, updateUserPlan } from '@/lib/db';

// ============================================================
// 定数
// ============================================================

// RevenueCat パブリック API キー（本番用に差し替えること）
const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'YOUR_APPLE_API_KEY';
const REVENUECAT_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || 'YOUR_GOOGLE_API_KEY';

// RevenueCat のエンタイトルメント ID
const ENTITLEMENT_ID = 'premium';

// ============================================================
// 初期化
// ============================================================

let initialized = false;

/**
 * RevenueCat SDK を初期化する。アプリ起動時に一度だけ呼ぶこと。
 * API キーがプレースホルダーの場合は初期化をスキップする（開発中対応）。
 */
export async function initPurchases(): Promise<void> {
  if (initialized) return;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_APPLE_KEY : REVENUECAT_GOOGLE_KEY;

  // プレースホルダーのままの場合はスキップ（開発中）
  if (apiKey.startsWith('YOUR_')) {
    console.warn('[Purchases] API キーが未設定のため初期化をスキップします');
    initialized = true;
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  await Purchases.configure({ apiKey });
  initialized = true;
}

// ============================================================
// プレミアム判定
// ============================================================

/**
 * 現在のユーザーがプレミアムかどうかを判定する。
 *
 * - ローカル DB の plan が 'lifetime' の場合: 買い切り or 開発者プロモコードによる
 *   永久解除のため、RevenueCat を確認せず即 true。
 * - ローカル DB の plan が 'premium'（サブスク）の場合: 解約・失効を検知するため
 *   RevenueCat の entitlement を再検証する。
 *   - SDK 未初期化 or API キー未設定（開発環境）の場合は検証不能なので true を維持。
 *   - 取得に成功し entitlement が有効なら true。
 *   - 取得に成功したが entitlement が無効（失効）なら DB を 'free' に降格して false。
 *   - ネットワークエラー等で取得に失敗した場合は、ユーザーを不当にブロックしない
 *     ためオフライン猶予として true を維持。
 * - plan が 'free'（または未設定）の場合: RevenueCat の entitlement が有効なら
 *   DB を 'premium' に同期して true を返す。
 */
export async function isPremium(): Promise<boolean> {
  let plan: string | null = null;
  try {
    const settings = await getUserSettings();
    plan = settings?.plan ?? null;
  } catch {
    // DB未初期化の場合は無視
  }

  // 買い切り・プロモコードによる永久解除は RevenueCat を再検証しない
  if (plan === 'lifetime') {
    return true;
  }

  const revenueCatUnavailable = !initialized || REVENUECAT_APPLE_KEY.startsWith('YOUR_');

  if (plan === 'premium') {
    // サブスクは解約・失効の可能性があるため RevenueCat 側で再検証する
    if (revenueCatUnavailable) {
      // 検証不能な開発環境ではプレミアム扱いを維持
      return true;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (entitlement) {
        return true;
      }
      // 取得はできたが失効している場合は DB を降格する
      await updateUserPlan('free');
      return false;
    } catch {
      // ネットワークエラー等はオフライン猶予として true を維持
      return true;
    }
  }

  // plan が 'free' または未設定の場合、RevenueCat 側の有効な購入があれば同期する
  if (revenueCatUnavailable) {
    return false;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (entitlement) {
      // RevenueCat で有効なら DB も同期
      await updateUserPlan('premium');
      return true;
    }
  } catch {
    // ネットワークエラーなどは無視し、ローカル DB のみで判定
  }

  return false;
}

// ============================================================
// Offerings（商品情報）取得
// ============================================================

/**
 * RevenueCat の Offerings を取得する。
 * 価格表示に使用。SDK 未初期化 or エラー時は null を返す。
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!initialized || REVENUECAT_APPLE_KEY.startsWith('YOUR_')) {
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch {
    return null;
  }
}

// ============================================================
// 購入処理
// ============================================================

/**
 * 月額サブスクリプションを購入する。
 * @returns true: 購入成功、false: キャンセルまたはエラー
 * @throws 致命的エラーの場合はエラーメッセージを throw
 */
export async function purchaseMonthly(): Promise<boolean> {
  const offerings = await getOfferings();
  if (!offerings?.current) {
    throw new Error('商品情報を取得できませんでした。ネットワーク接続を確認してください。');
  }

  const monthlyPackage = offerings.current.monthly;
  if (!monthlyPackage) {
    throw new Error('月額プランが見つかりませんでした。');
  }

  return purchasePackage(monthlyPackage);
}

/**
 * 買い切り（Lifetime）を購入する。
 * @returns true: 購入成功、false: キャンセルまたはエラー
 * @throws 致命的エラーの場合はエラーメッセージを throw
 */
export async function purchaseLifetime(): Promise<boolean> {
  const offerings = await getOfferings();
  if (!offerings?.current) {
    throw new Error('商品情報を取得できませんでした。ネットワーク接続を確認してください。');
  }

  const lifetimePackage = offerings.current.lifetime;
  if (!lifetimePackage) {
    throw new Error('買い切りプランが見つかりませんでした。');
  }

  return purchasePackage(lifetimePackage);
}

/**
 * 購入復元を行う。
 * @returns true: プレミアムが復元された、false: 復元対象なし
 * @throws エラーの場合はメッセージを throw
 */
export async function restorePurchases(): Promise<boolean> {
  if (!initialized || REVENUECAT_APPLE_KEY.startsWith('YOUR_')) {
    throw new Error('課金システムが初期化されていません。アプリを再起動してください。');
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement) {
      await updateUserPlan('premium');
      return true;
    }

    return false;
  } catch (error: unknown) {
    throw new Error(mapPurchaseError(error));
  }
}

// ============================================================
// 内部ヘルパー
// ============================================================

async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement) {
      // 買い切りかサブスクかで DB に保存するプランを変える
      const isLifetime = pkg.packageType === 'LIFETIME';
      await updateUserPlan(isLifetime ? 'lifetime' : 'premium');
      return true;
    }

    return false;
  } catch (error: unknown) {
    if (isPurchaseCancelledError(error)) {
      return false;
    }
    throw new Error(mapPurchaseError(error));
  }
}

function isPurchaseCancelledError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error
  ) {
    const code = (error as { code: number }).code;
    return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
  }
  return false;
}

function mapPurchaseError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: number }).code;

    switch (code) {
      case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
        return '購入がキャンセルされました。';
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
        return 'ストアに問題が発生しました。しばらくしてからもう一度お試しください。';
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        return 'この端末では購入が許可されていません。';
      case PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR:
        return '購入情報が無効です。';
      case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        return 'この商品は現在購入できません。';
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        return 'ネットワークエラーが発生しました。接続を確認してください。';
      default:
        return `購入中にエラーが発生しました（コード: ${code}）。`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '予期せぬエラーが発生しました。';
}
