import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { resetAllData, getUserSettings, updateUserPlan } from '@/lib/db';
import { restorePurchases, isPremium } from '@/lib/purchases';
import { redeemPromoCode } from '@/lib/promoCode';
import { fetchTaxRules } from '@/lib/rules';
import PaywallModal from '@/components/PaywallModal';
import type { PlanType } from '@/types';

const ACCENT = '#208AEF';

export default function SettingsScreen() {
  const router = useRouter();
  const [premium, setPremium] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free');
  const [paywallVisible, setPaywallVisible] = useState(false);

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  async function checkPremiumStatus() {
    try {
      const result = await isPremium();
      setPremium(result);
      const settings = await getUserSettings();
      if (settings) {
        setCurrentPlan(settings.plan);
      }
    } catch {
      // ignore
    }
  }

  const handleReset = () => {
    Alert.alert(
      'データの初期化',
      '給与、シフト、バイト先情報、および保存された画像ファイルを含め、すべてのデータを完全に削除します。よろしいですか？\n※この操作は元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllData();
              Alert.alert('完了', 'データをすべて初期化しました。', [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/onboarding');
                  },
                },
              ]);
            } catch (e) {
              Alert.alert('エラー', 'データの初期化に失敗しました。');
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    setRestoreLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        setPremium(true);
        setCurrentPlan('premium');
        Alert.alert('復元完了', 'プレミアムプランが復元されました。');
      } else {
        Alert.alert('復元結果', '復元可能な購入が見つかりませんでした。');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '復元に失敗しました。';
      Alert.alert('エラー', message);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handlePromoCode = async () => {
    if (!promoCode.trim()) {
      Alert.alert('入力エラー', 'プロモコードを入力してください。');
      return;
    }

    setPromoLoading(true);
    try {
      const rules = await fetchTaxRules();
      const valid = await redeemPromoCode(promoCode, rules);

      if (valid) {
        await updateUserPlan('lifetime');
        setPremium(true);
        setCurrentPlan('lifetime');
        setPromoCode('');
        Alert.alert('🎉 有効化完了', 'プレミアムプランが永久に有効になりました！');
      } else {
        Alert.alert('無効なコード', '入力されたプロモコードは無効です。');
      }
    } catch {
      Alert.alert('エラー', 'コードの検証に失敗しました。ネットワーク接続を確認してください。');
    } finally {
      setPromoLoading(false);
    }
  };

  const planLabel = (() => {
    switch (currentPlan) {
      case 'lifetime': return 'プレミアム（永久）';
      case 'premium': return 'プレミアム（月額）';
      default: return '無料プラン';
    }
  })();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        {/* プラン表示 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プラン</Text>
          <View style={[styles.menuItem, premium && styles.menuItemPremium]}>
            <View style={styles.menuItemLeft}>
              <Feather
                name={premium ? 'award' : 'user'}
                size={20}
                color={premium ? '#FF9500' : '#555'}
              />
              <Text style={[styles.menuItemText, premium && styles.premiumText]}>
                {planLabel}
              </Text>
            </View>
            {premium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>有効</Text>
              </View>
            )}
          </View>
        </View>

        {/* サポート機能 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>サポート機能</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              if (premium) {
                router.push('/tax-support');
              } else {
                setPaywallVisible(true);
              }
            }}
          >
            <View style={styles.menuItemLeft}>
              <Feather name="file-text" size={20} color={premium ? "#555" : "#FF9500"} />
              <Text style={styles.menuItemText}>確定申告サポート</Text>
            </View>
            {!premium && (
              <Feather name="lock" size={16} color="#FF9500" style={{ marginRight: 8 }} />
            )}
            <Feather name="chevron-right" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>

        {/* 基本設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本設定</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/onboarding')}
          >
            <View style={styles.menuItemLeft}>
              <Feather name="user" size={20} color="#555" />
              <Text style={styles.menuItemText}>基本設定を変更する</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>

        {/* 課金管理 */}
        {!premium && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>プレミアム</Text>

            {/* プロモコード */}
            <View style={styles.promoContainer}>
              <Text style={styles.promoLabel}>プロモコードを入力</Text>
              <View style={styles.promoInputRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="コードを入力..."
                  placeholderTextColor="#BBB"
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!promoLoading}
                />
                <TouchableOpacity
                  style={[styles.promoButton, promoLoading && styles.promoButtonDisabled]}
                  onPress={handlePromoCode}
                  disabled={promoLoading}
                >
                  {promoLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.promoButtonText}>適用</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* 購入復元 */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRestore}
              disabled={restoreLoading}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="refresh-cw" size={20} color="#555" />
                <Text style={styles.menuItemText}>購入を復元する</Text>
              </View>
              {restoreLoading ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Feather name="chevron-right" size={20} color="#CCC" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* データ管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>データ管理</Text>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemDanger]}
            onPress={handleReset}
          >
            <View style={styles.menuItemLeft}>
              <Feather name="trash-2" size={20} color="#FF3B30" />
              <Text style={styles.menuItemDangerText}>データを初期化する</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ペイウォール */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchased={() => {
          setPremium(true);
          setCurrentPlan('premium');
          setPaywallVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 8,
  },
  menuItemPremium: {
    borderColor: '#FF950040',
    backgroundColor: '#FFF8EE',
  },
  menuItemDanger: {
    borderColor: '#FFEBEB',
    backgroundColor: '#FFF5F5',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  premiumText: {
    color: '#FF9500',
    fontWeight: '700',
  },
  premiumBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  menuItemDangerText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },

  // プロモコード
  promoContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 8,
  },
  promoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  promoButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
  },
  promoButtonDisabled: {
    opacity: 0.6,
  },
  promoButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
