import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getUserSettings, getActiveJobs, getAllShifts, getAllPayslips } from '@/lib/db';
import { fetchTaxRules } from '@/lib/rules';
import { calcWalls } from '@/lib/tax';
import { calcRevenue } from '@/lib/revenue';
import { calcForecast, ForecastResult } from '@/lib/forecast';
import { isPremium } from '@/lib/purchases';
import { usePrivacy } from '@/context/PrivacyContext';
import PaywallModal from '@/components/PaywallModal';
import type { UserSettings, Job, WallResult, TaxNews } from '@/types';

const NEWS_READ_KEY = 'read_news_ids';

const ACCENT = '#208AEF';
const BG = '#F5F5F8';

export default function HomeScreen() {
  const { formatYen, privacyMode } = usePrivacy();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [walls, setWalls] = useState<WallResult['walls']>([]);
  const [primaryWall, setPrimaryWall] = useState<{ label: string; amount: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentYearIncome, setCurrentYearIncome] = useState(0);
  const [progressAnim] = useState(new Animated.Value(0));
  const [unreadNews, setUnreadNews] = useState<TaxNews[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [premium, setPremium] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      const [userSettings, taxRules, activeJobs, allShifts, allPayslips] = await Promise.all([
        getUserSettings(),
        fetchTaxRules(),
        getActiveJobs(),
        getAllShifts(),
        getAllPayslips(),
      ]);

      if (!userSettings) return;

      setSettings(userSettings);
      setJobs(activeJobs);

      // 壁の判定
      const wallResult = calcWalls(userSettings, taxRules);
      setWalls(wallResult.walls);
      setPrimaryWall({
        label: wallResult.primary_label,
        amount: wallResult.primary_wall,
      });

      // 収入の集計
      const revenue = calcRevenue(userSettings, activeJobs, allShifts, allPayslips);
      const totalFromWork = revenue.annual_total - userSettings.carryover_income;
      setCurrentYearIncome(totalFromWork);

      // プログレスバーのアニメーション
      const totalIncome = revenue.annual_total;
      const progress = wallResult.primary_wall > 0 ? Math.min(totalIncome / wallResult.primary_wall, 1) : 0;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();

      // 予測の算出
      const currentMonth = new Date().getMonth() + 1;
      const forecastResult = calcForecast(
        revenue.monthly,
        currentMonth,
        wallResult.primary_wall,
        userSettings.carryover_income,
      );
      setForecast(forecastResult);

      // プレミアム判定
      const premiumStatus = await isPremium();
      setPremium(premiumStatus);

      // 未読ニュースの確認
      await loadUnreadNews(taxRules.news || [], userSettings);
    } catch (error) {
      // エラーハンドリング
    }
  }

  async function loadUnreadNews(news: TaxNews[], userSettings: UserSettings) {
    try {
      const readIdsRaw = await AsyncStorage.getItem(NEWS_READ_KEY);
      const readIds: string[] = readIdsRaw ? JSON.parse(readIdsRaw) : [];

      const importantUnread = news.filter((n) => {
        if (!n.important) return false;
        if (readIds.includes(n.id)) return false;
        // Check target relevance
        if (!n.target || n.target.length === 0 || n.target.includes('all')) return true;
        for (const t of n.target) {
          if (t === 'large_company' && userSettings.large_company) return true;
          if (t === 'parent' && userSettings.dependent_type === 'parent') return true;
          if (t === 'spouse' && userSettings.dependent_type === 'spouse') return true;
        }
        return false;
      });
      setUnreadNews(importantUnread);
    } catch {
      setUnreadNews([]);
    }
  }

  async function handleBannerPress() {
    // Mark all unread important news as read
    try {
      const readIdsRaw = await AsyncStorage.getItem(NEWS_READ_KEY);
      const readIds: string[] = readIdsRaw ? JSON.parse(readIdsRaw) : [];
      const newIds = unreadNews.map((n) => n.id);
      const merged = [...new Set([...readIds, ...newIds])];
      await AsyncStorage.setItem(NEWS_READ_KEY, JSON.stringify(merged));
      setUnreadNews([]);
    } catch {
      // ignore
    }
    // Navigate to news tab
    router.push('/(tabs)/news');
  }

  if (!settings || !primaryWall) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalIncome = settings.carryover_income + currentYearIncome;
  const remainingAmount = Math.max(primaryWall.amount - totalIncome, 0);
  const progressPercent = Math.min((totalIncome / primaryWall.amount) * 100, 100);

  // 平均時給の計算
  const averageHourlyWage = jobs.length > 0
    ? Math.round(jobs.reduce((sum, job) => sum + job.hourly_wage, 0) / jobs.length)
    : 0;
  const remainingHours = averageHourlyWage > 0
    ? Math.floor(remainingAmount / averageHourlyWage)
    : null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ゲージの色を残り割合で変える
  const gaugeColor =
    progressPercent >= 90 ? '#FF4444' :
    progressPercent >= 70 ? '#FF9500' :
    ACCENT;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 未読ニュースバナー */}
        {unreadNews.length > 0 && (
          <TouchableOpacity style={styles.newsBanner} onPress={handleBannerPress}>
            <View style={styles.newsBannerLeft}>
              <Feather name="bell" size={18} color="#FFF" />
              <Text style={styles.newsBannerText}>
                {unreadNews.length}件の重要なお知らせがあります
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* ペース警告バナー */}
        {!privacyMode && forecast?.overshoot_month && (
          premium ? (
            <TouchableOpacity
              style={styles.paceAlertBanner}
              onPress={() => router.push('/(tabs)/chart')}
            >
              <Feather name="alert-triangle" size={18} color="#FFF" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.paceAlertText}>
                  ⚠️ 今のペースだと{forecast.overshoot_month}月に{primaryWall?.label}を超えます
                </Text>
                {(() => {
                  const currentMonth = new Date().getMonth() + 1;
                  const remainingMonths = 12 - currentMonth;
                  const excessAmount = forecast.predicted_annual - primaryWall.amount;
                  if (excessAmount > 0 && remainingMonths > 0) {
                    // 100円単位で切り上げ
                    const reducePerMonth = Math.ceil((excessAmount / remainingMonths) / 100) * 100;
                    return (
                      <Text style={styles.paceAlertSubText}>
                        残りの月で、月あたり約 {formatYen(reducePerMonth)} ほどペースを落とす必要があります
                      </Text>
                    );
                  }
                  return null;
                })()}
              </View>
              <Feather name="chevron-right" size={16} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.paceAlertBannerFree}
              onPress={() => setPaywallVisible(true)}
            >
              <Feather name="lock" size={16} color="#FF9500" />
              <Text style={styles.paceAlertTextFree}>
                ペース警告をプレミアムプランで確認
              </Text>
              <Feather name="chevron-right" size={16} color="#FF9500" />
            </TouchableOpacity>
          )
        )}

        {/* メインカード: 残り枠 */}
        <View style={styles.mainCard}>
          <Text style={styles.mainCardLabel}>
            {primaryWall.label}まで残り
          </Text>
          <Text style={styles.mainCardAmount}>
            {formatYen(remainingAmount)}
          </Text>
          <Text style={styles.mainCardSub}>
            基準: {formatYen(primaryWall.amount)}
          </Text>

          {/* ゲージ */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeBackground}>
              <Animated.View
                style={[
                  styles.gaugeFill,
                  {
                    width: progressWidth,
                    backgroundColor: gaugeColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.gaugePercent, { color: gaugeColor }]}>
              {progressPercent.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* 残り時間換算 */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            <Feather name="clock" size={16} color="#555" />
            <Text style={[styles.infoCardTitle, { marginBottom: 0 }]}>残り時間換算</Text>
          </View>
          {remainingHours !== null ? (
            <>
              <Text style={styles.infoCardValue}>
                あと約 {remainingHours.toLocaleString()} 時間
              </Text>
              <Text style={styles.infoCardDesc}>
                平均時給 {formatYen(averageHourlyWage)} で計算
              </Text>
            </>
          ) : (
            <Text style={styles.infoCardDesc}>
              バイト先を登録すると残り時間が表示されます
            </Text>
          )}
        </View>

        {/* 壁一覧 */}
        <View style={styles.wallsSection}>
          <Text style={styles.sectionTitle}>適用される壁</Text>
          {walls.map((wall, index) => {
            const wallProgress = Math.min((totalIncome / wall.amount) * 100, 100);
            // 金額がprimaryWallと同じならハイライト
            const isLowest = wall.amount === primaryWall.amount;
            return (
              <View
                key={index}
                style={[styles.wallCard, isLowest && styles.wallCardHighlight]}
              >
                <View style={styles.wallCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isLowest && <Feather name="star" size={14} color="#FF9500" />}
                    <Text style={styles.wallName}>{wall.label}</Text>
                  </View>
                  <Text style={styles.wallAmount}>{formatYen(wall.amount)}</Text>
                </View>
                <View style={styles.miniGaugeBackground}>
                  <View
                    style={[
                      styles.miniGaugeFill,
                      { width: `${wallProgress}%` },
                    ]}
                  />
                </View>
                <Text style={styles.wallDesc}>{wall.description}</Text>
              </View>
            );
          })}
        </View>

        {/* 収入内訳 */}
        <View style={styles.breakdownSection}>
          <Text style={styles.sectionTitle}>今年の収入内訳</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>繰越収入</Text>
              <Text style={styles.breakdownValue}>
                {formatYen(settings.carryover_income)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>今年の稼ぎ</Text>
              <Text style={styles.breakdownValue}>
                {formatYen(currentYearIncome)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, styles.breakdownTotal]}>合計</Text>
              <Text style={[styles.breakdownValue, styles.breakdownTotal]}>
                {formatYen(totalIncome)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ペイウォール */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchased={() => {
          setPremium(true);
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },

  // メインカード
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  mainCardLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  mainCardAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  mainCardSub: {
    fontSize: 13,
    color: '#AAA',
    marginBottom: 20,
  },

  // ゲージ
  gaugeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gaugeBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#F0F0F3',
    borderRadius: 6,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 6,
  },
  gaugePercent: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 55,
    textAlign: 'right',
  },

  // 情報カード
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  infoCardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  infoCardDesc: {
    fontSize: 13,
    color: '#999',
  },

  // 壁セクション
  wallsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  wallCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  wallCardHighlight: {
    borderColor: ACCENT,
    borderWidth: 2,
  },
  wallCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  wallName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  wallAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
  },
  miniGaugeBackground: {
    height: 6,
    backgroundColor: '#F0F0F3',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  miniGaugeFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  wallDesc: {
    fontSize: 12,
    color: '#999',
  },

  // 収入内訳
  breakdownSection: {
    marginBottom: 24,
  },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  breakdownLabel: {
    fontSize: 15,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  breakdownTotal: {
    fontWeight: '700',
    color: '#1A1A1A',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },

  // ニュースバナー
  newsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  newsBannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  // ペース警告バナー
  paceAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  paceAlertText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  paceAlertSubText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
    lineHeight: 16,
  },
  paceAlertBannerFree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8EE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF950040',
  },
  paceAlertTextFree: {
    color: '#FF9500',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
