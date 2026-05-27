import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';

import { getUserSettings, getActiveJobs, getAllShifts, getAllPayslips } from '@/lib/db';
import { calcRevenue } from '@/lib/revenue';
import { usePrivacy } from '@/context/PrivacyContext';
import type { UserSettings, Job, RevenueResult } from '@/types';

const ACCENT = '#208AEF';
const ACCENT_LIGHT = '#208AEF40';
const BG = '#F5F5F8';

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

interface MonthDetail {
  month: number;
  label: string;
  amount: number;
  source: 'actual' | 'estimated';
  jobBreakdown: { job_name: string; amount: number }[];
}

interface BarDataItem {
  value: number;
  label: string;
  frontColor: string;
  onPress: () => void;
}

export default function ChartScreen() {
  const { formatYen, privacyMode } = usePrivacy();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [revenue, setRevenue] = useState<RevenueResult | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<MonthDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [hasData, setHasData] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear]),
  );

  async function loadData() {
    try {
      const [userSettings, activeJobs, allShifts, allPayslips] = await Promise.all([
        getUserSettings(),
        getActiveJobs(),
        getAllShifts(),
        getAllPayslips(),
      ]);

      if (!userSettings) return;

      setSettings(userSettings);
      setJobs(activeJobs);

      const result = calcRevenue(userSettings, activeJobs, allShifts, allPayslips, selectedYear);
      setRevenue(result);

      const anyData = result.monthly.some((m) => m.amount > 0);
      setHasData(anyData);
    } catch (_error) {
      // エラーハンドリング
    }
  }

  function getJobBreakdown(month: number): { job_name: string; amount: number }[] {
    // We need to recalculate per-job per-month from raw data
    // Since calcRevenue doesn't expose per-job-per-month breakdown,
    // we approximate using the available data
    // For a proper breakdown, we'd need access to the raw jobMonthMap
    // For now, if there's only one job we can attribute all to it
    if (!revenue) return [];

    // Simple approach: we can't get per-job-per-month from the current API.
    // Show the by_job totals only in the year summary, and for monthly detail
    // show the total amount per month.
    return [];
  }

  function buildMonthDetails(): MonthDetail[] {
    if (!revenue) return [];

    return revenue.monthly.map((m) => ({
      month: m.month,
      label: MONTH_LABELS[m.month - 1],
      amount: m.amount,
      source: m.source,
      jobBreakdown: getJobBreakdown(m.month),
    }));
  }

  function handleBarPress(detail: MonthDetail) {
    setSelectedMonth(detail);
    setModalVisible(true);
  }

  const monthDetails = buildMonthDetails();

  const maxAmount = monthDetails.reduce((max, m) => Math.max(max, m.amount), 0);
  // Round up to a nice number for the y-axis
  const yAxisMax = maxAmount > 0 ? Math.ceil(maxAmount / 10000) * 10000 : 100000;

  const barData: BarDataItem[] = monthDetails.map((detail) => ({
    value: detail.amount,
    label: detail.label,
    frontColor: detail.source === 'actual' ? ACCENT : ACCENT_LIGHT,
    onPress: () => handleBarPress(detail),
  }));

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 64; // account for padding
  const barWidth = Math.max(Math.floor(chartWidth / 12) - 12, 16);

  if (!settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 年切り替え */}
        <View style={styles.yearSwitcher}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear((y) => y - 1)}
          >
            <Feather name="chevron-left" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}年</Text>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear((y) => y + 1)}
          >
            <Feather name="chevron-right" size={24} color={ACCENT} />
          </TouchableOpacity>
        </View>

        {/* 年間合計 */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>年間合計</Text>
          <Text style={styles.totalAmount}>
            {revenue ? formatYen(revenue.annual_total) : formatYen(0)}
          </Text>
          {revenue && revenue.by_job.length > 0 && (
            <View style={styles.jobSummary}>
              {revenue.by_job.map((job) => (
                <View key={job.job_id} style={styles.jobRow}>
                  <Text style={styles.jobName}>{job.job_name}</Text>
                  <Text style={styles.jobAmount}>{formatYen(job.total)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 凡例 */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
            <Text style={styles.legendText}>実績</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ACCENT_LIGHT }]} />
            <Text style={styles.legendText}>見込み</Text>
          </View>
        </View>

        {/* グラフ */}
        {hasData ? (
          <View style={styles.chartCard}>
            <BarChart
              data={barData}
              barWidth={barWidth}
              spacing={Math.max(Math.floor(chartWidth / 12) - barWidth, 4)}
              roundedTop
              roundedBottom
              hideRules
              xAxisThickness={1}
              xAxisColor="#E0E0E0"
              yAxisThickness={0}
              yAxisTextStyle={styles.yAxisText}
              noOfSections={4}
              maxValue={yAxisMax}
              formatYLabel={(label: string) => {
                const num = parseInt(label, 10);
                if (isNaN(num)) return label;
                if (privacyMode) return '****';
                if (num >= 10000) return `${Math.floor(num / 10000)}万`;
                return `${num}`;
              }}
              xAxisLabelTextStyle={styles.xAxisLabel}
              isAnimated
              animationDuration={800}
              barBorderRadius={4}
              height={220}
              width={chartWidth}
            />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Feather name="bar-chart-2" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>データがありません</Text>
            <Text style={styles.emptyDesc}>
              シフトや給与明細を登録すると{'\n'}月別グラフが表示されます
            </Text>
          </View>
        )}

        {/* 月別リスト */}
        <View style={styles.monthListSection}>
          <Text style={styles.sectionTitle}>月別一覧</Text>
          {monthDetails.map((detail) => (
            <TouchableOpacity
              key={detail.month}
              style={styles.monthRow}
              onPress={() => handleBarPress(detail)}
            >
              <View style={styles.monthRowLeft}>
                <View
                  style={[
                    styles.monthDot,
                    {
                      backgroundColor:
                        detail.source === 'actual' ? ACCENT : ACCENT_LIGHT,
                    },
                  ]}
                />
                <Text style={styles.monthLabel}>{detail.label}</Text>
                <Text style={styles.sourceTag}>
                  {detail.amount > 0
                    ? detail.source === 'actual'
                      ? '実績'
                      : '見込み'
                    : ''}
                </Text>
              </View>
              <Text style={styles.monthAmount}>{formatYen(detail.amount)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 月詳細モーダル */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {selectedMonth && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedYear}年 {selectedMonth.label}
                </Text>
                <Text style={styles.modalAmount}>
                  {formatYen(selectedMonth.amount)}
                </Text>
                <View style={styles.modalSourceBadge}>
                  <View
                    style={[
                      styles.modalSourceDot,
                      {
                        backgroundColor:
                          selectedMonth.source === 'actual' ? ACCENT : ACCENT_LIGHT,
                      },
                    ]}
                  />
                  <Text style={styles.modalSourceText}>
                    {selectedMonth.source === 'actual' ? '実績データ' : '見込みデータ'}
                  </Text>
                </View>
                {selectedMonth.jobBreakdown.length > 0 && (
                  <View style={styles.modalJobSection}>
                    <Text style={styles.modalJobTitle}>バイト先別内訳</Text>
                    {selectedMonth.jobBreakdown.map((job, idx) => (
                      <View key={idx} style={styles.modalJobRow}>
                        <Text style={styles.modalJobName}>{job.job_name}</Text>
                        <Text style={styles.modalJobAmount}>
                          {formatYen(job.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>閉じる</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
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

  // 年切り替え
  yearSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 20,
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  yearText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // 年間合計
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  jobSummary: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  jobName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  jobAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  // 凡例
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },

  // グラフカード
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },

  yAxisText: {
    fontSize: 10,
    color: '#999',
  },
  xAxisLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },

  // 空状態
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#BBB',
    textAlign: 'center',
    lineHeight: 20,
  },

  // 月別一覧
  monthListSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  monthRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  sourceTag: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999',
  },
  monthAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  modalSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  modalSourceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalSourceText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  modalJobSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    marginBottom: 16,
  },
  modalJobTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  modalJobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalJobName: {
    fontSize: 14,
    color: '#333',
  },
  modalJobAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    backgroundColor: BG,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
  },
});
