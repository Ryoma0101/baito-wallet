import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  getOfferings,
  purchaseMonthly,
  purchaseLifetime,
  restorePurchases,
} from '@/lib/purchases';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ACCENT = '#208AEF';
const GOLD = '#FF9500';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchased: () => void;
}

interface PriceInfo {
  monthlyPrice: string;
  lifetimePrice: string;
  introPrice: string | null;
}

const FEATURES = [
  {
    icon: 'trending-up' as const,
    title: '収入予測グラフ',
    desc: '年末までの収入を予測し壁を見える化',
  },
  {
    icon: 'alert-triangle' as const,
    title: 'ペース警告',
    desc: '壁を超えそうな月を事前にお知らせ',
  },
  {
    icon: 'calendar' as const,
    title: '過去のシフトが無制限',
    desc: '過去3ヶ月より前のデータも閲覧可能に',
  },
  {
    icon: 'briefcase' as const,
    title: 'バイト先登録が無制限',
    desc: '3件以上のバイト先を管理可能に',
  },
  {
    icon: 'image' as const,
    title: '給与明細に画像添付',
    desc: '明細のスクショや写真を保存可能に',
  },
];

export default function PaywallModal({ visible, onClose, onPurchased }: PaywallModalProps) {
  const router = useRouter();
  const [prices, setPrices] = useState<PriceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<'monthly' | 'lifetime' | null>(null);

  useEffect(() => {
    if (visible) {
      loadPrices();
    }
  }, [visible]);

  async function loadPrices() {
    try {
      const offerings = await getOfferings();
      if (offerings?.current) {
        const monthly = offerings.current.monthly;
        const lifetime = offerings.current.lifetime;

        setPrices({
          monthlyPrice: monthly?.product.priceString ?? '-',
          lifetimePrice: lifetime?.product.priceString ?? '-',
          introPrice: monthly?.product.introPrice?.priceString ?? null,
        });
      } else {
        setPrices({
          monthlyPrice: '-',
          lifetimePrice: '-',
          introPrice: null,
        });
      }
    } catch {
      setPrices({
        monthlyPrice: '-',
        lifetimePrice: '-',
        introPrice: null,
      });
    }
  }

  async function handlePurchaseMonthly() {
    setPurchaseTarget('monthly');
    setLoading(true);
    try {
      const success = await purchaseMonthly();
      if (success) {
        onPurchased();
        onClose();
      } else {
        Alert.alert('お知らせ', '購入処理がキャンセルされたか、現在の環境（Expo Go等）では決済がサポートされていません。');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '購入に失敗しました。';
      Alert.alert('エラー', message);
    } finally {
      setLoading(false);
      setPurchaseTarget(null);
    }
  }

  async function handlePurchaseLifetime() {
    setPurchaseTarget('lifetime');
    setLoading(true);
    try {
      const success = await purchaseLifetime();
      if (success) {
        onPurchased();
        onClose();
      } else {
        Alert.alert('お知らせ', '購入処理がキャンセルされたか、現在の環境（Expo Go等）では決済がサポートされていません。');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '購入に失敗しました。';
      Alert.alert('エラー', message);
    } finally {
      setLoading(false);
      setPurchaseTarget(null);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('復元完了', 'プレミアムプランが復元されました。');
        onPurchased();
        onClose();
      } else {
        Alert.alert('復元結果', '復元可能な購入が見つかりませんでした。');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '復元に失敗しました。';
      Alert.alert('エラー', message);
    } finally {
      setLoading(false);
    }
  }

  function handlePromoCode() {
    onClose();
    // 設定画面のプロモコード入力へ遷移
    router.push('/settings');
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* 閉じるボタン */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#999" />
          </TouchableOpacity>

          {/* ヘッダー */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="star" size={28} color="#FFF" />
            </View>
            <Text style={styles.title}>プレミアムプラン</Text>
            <Text style={styles.subtitle}>
              すべての機能をアンロックして{'\n'}収入管理をもっとスマートに
            </Text>
          </View>

          {/* 特典一覧 */}
          <View style={styles.featureList}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon} size={18} color={ACCENT} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 購入ボタン */}
          <View style={styles.buttonGroup}>
            {/* 月額 */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePurchaseMonthly}
              disabled={loading}
            >
              {loading && purchaseTarget === 'monthly' ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.primaryButtonText}>
                    月額プラン {prices?.monthlyPrice ?? '-'}
                  </Text>
                  {prices?.introPrice && (
                    <View style={styles.introBadge}>
                      <Text style={styles.introBadgeText}>
                        初月 {prices.introPrice}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* 買い切り */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePurchaseLifetime}
              disabled={loading}
            >
              {loading && purchaseTarget === 'lifetime' ? (
                <ActivityIndicator color={ACCENT} />
              ) : (
                <Text style={styles.secondaryButtonText}>
                  買い切り {prices?.lifetimePrice ?? '-'}（永久利用）
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* フッターリンク */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleRestore} disabled={loading}>
              <Text style={styles.footerLink}>購入を復元する</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>・</Text>
            <TouchableOpacity onPress={handlePromoCode}>
              <Text style={styles.footerLink}>プロモコードをお持ちの方</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },

  // ヘッダー
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },

  // 特典
  featureList: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${ACCENT}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: '#888',
  },

  // ボタン
  buttonGroup: {
    gap: 10,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  introBadge: {
    backgroundColor: '#FFFFFF30',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  introBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryButtonText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },

  // フッター
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'underline',
  },
  footerDot: {
    fontSize: 13,
    color: '#CCC',
    marginHorizontal: 6,
  },
});
