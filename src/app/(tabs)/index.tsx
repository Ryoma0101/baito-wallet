import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { getUserSettings, getActiveJobs } from '@/lib/db';
import { fetchTaxRules } from '@/lib/rules';
import type { UserSettings, WallResult, WallValues, Job } from '@/types';

const ACCENT = '#208AEF';

/**
 * ユーザー設定と壁の値から適用される壁のリストを取得する。
 * フェーズ1の簡易判定（lib/tax.tsが未実装のため）。
 * 複数の壁がある場合は最も低い壁が基準。
 */
function getApplicableWalls(
  settings: UserSettings,
  walls: WallValues,
): WallResult[] {
  const results: WallResult[] = [];

  // 所得税の壁は全員に適用
  results.push({
    name: '所得税非課税枠',
    amount: walls.income_tax,
    description: '年収がこの額を超えると所得税が発生します',
  });

  if (settings.dependent_type === 'parent') {
    // 年齢判定（簡易版: 生年月日から現在年齢を計算）
    const age = calcAge(settings.birth_date);

    if (age >= walls.dependent_specific_age_min && age <= walls.dependent_specific_age_max) {
      // 特定扶養（19〜22歳）
      results.push({
        name: '特定扶養控除',
        amount: walls.dependent_specific_limit,
        description: '親の特定扶養控除が受けられる上限額です',
      });
    } else {
      // 一般扶養
      results.push({
        name: '社会保険の扶養',
        amount: walls.social_insurance_basic,
        description: '社会保険の扶養から外れる上限額です',
      });
    }
  } else if (settings.dependent_type === 'spouse') {
    results.push({
      name: '社会保険の扶養',
      amount: walls.social_insurance_basic,
      description: '配偶者の社会保険扶養から外れる上限額です',
    });
  }

  // 大企業の106万の壁
  if (settings.large_company) {
    results.push({
      name: '大企業の社保壁',
      amount: walls.social_insurance_large_company,
      description: '大企業では106万円を超えると社会保険加入義務があります',
    });
  }

  return results;
}

function calcAge(birthDateStr: string): number {
  const today = new Date();
  const birth = new Date(birthDateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatYen(amount: number): string {
  if (amount >= 10_000) {
    const man = Math.floor(amount / 10_000);
    const remainder = amount % 10_000;
    if (remainder === 0) {
      return `${man.toLocaleString()}万円`;
    }
    return `${amount.toLocaleString()}円`;
  }
  return `${amount.toLocaleString()}円`;
}

export default function HomeScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [walls, setWalls] = useState<WallResult[]>([]);
  const [lowestWall, setLowestWall] = useState<WallResult | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [progressAnim] = useState(new Animated.Value(0));

  // フェーズ1: 今年の収入はダミー値（0）。lib/revenue.ts 実装時に置き換える
  const currentYearIncome = 0;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      const [userSettings, taxRules, activeJobs] = await Promise.all([
        getUserSettings(),
        fetchTaxRules(),
        getActiveJobs(),
      ]);

      if (!userSettings) return;

      setSettings(userSettings);
      setJobs(activeJobs);

      const applicableWalls = getApplicableWalls(userSettings, taxRules.walls);
      setWalls(applicableWalls);

      // 最も低い壁を基準にする
      const lowest = applicableWalls.reduce((min, wall) =>
        wall.amount < min.amount ? wall : min,
        applicableWalls[0],
      );
      setLowestWall(lowest);

      // プログレスバーのアニメーション
      const totalIncome = userSettings.carryover_income + currentYearIncome;
      const progress = lowest ? Math.min(totalIncome / lowest.amount, 1) : 0;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      // エラーハンドリング（フェーズ1は最小限）
    }
  }

  if (!settings || !lowestWall) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalIncome = settings.carryover_income + currentYearIncome;
  const remainingAmount = Math.max(lowestWall.amount - totalIncome, 0);
  const progressPercent = Math.min((totalIncome / lowestWall.amount) * 100, 100);

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
        {/* メインカード: 残り枠 */}
        <View style={styles.mainCard}>
          <Text style={styles.mainCardLabel}>
            {lowestWall.name}まで残り
          </Text>
          <Text style={styles.mainCardAmount}>
            {formatYen(remainingAmount)}
          </Text>
          <Text style={styles.mainCardSub}>
            基準: {formatYen(lowestWall.amount)}
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
          <Text style={styles.infoCardTitle}>⏱ 残り時間換算</Text>
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
            const isLowest = wall === lowestWall;
            return (
              <View
                key={index}
                style={[styles.wallCard, isLowest && styles.wallCardHighlight]}
              >
                <View style={styles.wallCardHeader}>
                  <Text style={styles.wallName}>
                    {isLowest ? '⭐ ' : ''}{wall.name}
                  </Text>
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
});
