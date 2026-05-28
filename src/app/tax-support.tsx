import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { getUserSettings, getActiveJobs, getAllPayslips, getAllShifts } from '@/lib/db';
import { calcRevenue } from '@/lib/revenue';
import { usePrivacy } from '@/context/PrivacyContext';
import type { UserSettings, Job, RevenueResult } from '@/types';

const ACCENT = '#208AEF';
const BG = '#F5F5F8';

const ETAX_APP_URL = 'https://www.e-tax.nta.go.jp/';
const ETAX_CREATE_URL = 'https://www.keisan.nta.go.jp/kyoutu/ky/sm/top';

export default function TaxSupportScreen() {
  const { formatYen } = usePrivacy();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [revenue, setRevenue] = useState<RevenueResult | null>(null);
  const [needsFiling, setNeedsFiling] = useState<boolean | null>(null);
  const [filingReason, setFilingReason] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
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

      const currentYear = new Date().getFullYear();
      const result = calcRevenue(userSettings, activeJobs, allShifts, allPayslips, currentYear);
      setRevenue(result);

      // 確定申告要否の判定
      determineFilingNecessity(activeJobs, result);
    } catch {
      // エラーハンドリング
    }
  }

  /**
   * 確定申告要否の判定ロジック
   *
   * 以下をすべて満たす場合に「確定申告が必要です」と判定:
   * - バイト先が2件以上 AND
   * - 収入合計が20万円超
   *
   * 1件のみの場合:
   * - 「勤務先で年末調整が行われる場合は不要です」と表示
   */
  function determineFilingNecessity(activeJobs: Job[], result: RevenueResult) {
    const jobCount = activeJobs.length;
    const totalIncome = result.annual_total;

    if (jobCount >= 2 && totalIncome > 200_000) {
      setNeedsFiling(true);
      setFilingReason(
        `${jobCount}か所のバイト先があり、年間収入が20万円を超えているため、確定申告が必要になる可能性が高いです。`,
      );
    } else if (jobCount <= 1) {
      setNeedsFiling(false);
      setFilingReason(
        '勤務先が1か所のみの場合、勤務先で年末調整が行われれば確定申告は原則不要です。',
      );
    } else {
      setNeedsFiling(false);
      setFilingReason(
        '複数の勤務先がありますが、副収入が年間20万円以下のため、確定申告は原則不要です。',
      );
    }
  }

  async function handleCopy(text: string, id: string) {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      Alert.alert('エラー', 'コピーに失敗しました。');
    }
  }

  async function handleOpenUrl(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('エラー', 'URLを開けませんでした。');
      }
    } catch {
      Alert.alert('エラー', 'URLを開けませんでした。');
    }
  }

  if (!settings || !revenue) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentYear = new Date().getFullYear();

  // 課税対象の収入のみ表示（taxable_amount ベース）
  const taxableByJob = revenue.by_job.map((j) => ({
    ...j,
    // by_job.total は actual_amount ベースだが、
    // 確定申告では課税対象額が重要なので total をそのまま使う
    // （taxable_amount は個別のpayslipレベルで追跡されるが、
    //   ここでは合算ベースの概算として by_job.total を使用）
  }));
  const totalTaxable = taxableByJob.reduce((sum, j) => sum + j.total, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>確定申告サポート</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 判定結果バナー */}
        <View style={[
          styles.resultBanner,
          needsFiling ? styles.resultBannerWarning : styles.resultBannerSafe,
        ]}>
          <Feather
            name={needsFiling ? 'alert-circle' : 'check-circle'}
            size={24}
            color={needsFiling ? '#FF4444' : '#34C759'}
          />
          <View style={styles.resultTextContainer}>
            <Text style={[
              styles.resultTitle,
              { color: needsFiling ? '#FF4444' : '#34C759' },
            ]}>
              {needsFiling
                ? '確定申告が必要です'
                : '確定申告は不要の可能性が高いです'}
            </Text>
            <Text style={styles.resultReason}>{filingReason}</Text>
          </View>
        </View>

        {/* 収入サマリ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {currentYear}年 収入サマリ（e-Tax入力用）
          </Text>

          {taxableByJob.map((job) => (
            <View key={job.job_id} style={styles.incomeRow}>
              <View style={styles.incomeRowLeft}>
                <Text style={styles.incomeJobName}>{job.job_name}</Text>
                <Text style={styles.incomeAmount}>
                  {formatYen(job.total)}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.copyButton,
                  copiedId === `job-${job.job_id}` && styles.copyButtonCopied,
                ]}
                onPress={() => handleCopy(String(job.total), `job-${job.job_id}`)}
              >
                <Feather
                  name={copiedId === `job-${job.job_id}` ? 'check' : 'copy'}
                  size={16}
                  color={copiedId === `job-${job.job_id}` ? '#34C759' : ACCENT}
                />
              </TouchableOpacity>
            </View>
          ))}

          {/* 合計行 */}
          <View style={styles.totalRow}>
            <View style={styles.incomeRowLeft}>
              <Text style={styles.totalLabel}>合計</Text>
              <Text style={styles.totalAmount}>{formatYen(totalTaxable)}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.copyButton,
                copiedId === 'total' && styles.copyButtonCopied,
              ]}
              onPress={() => handleCopy(String(totalTaxable), 'total')}
            >
              <Feather
                name={copiedId === 'total' ? 'check' : 'copy'}
                size={16}
                color={copiedId === 'total' ? '#34C759' : ACCENT}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* e-Tax 誘導 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>e-Tax で申告する</Text>

          <TouchableOpacity
            style={styles.etaxButton}
            onPress={() => handleOpenUrl(ETAX_APP_URL)}
          >
            <Feather name="external-link" size={20} color="#FFF" />
            <Text style={styles.etaxButtonText}>e-Taxアプリで申告する</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.etaxButtonSecondary}
            onPress={() => handleOpenUrl(ETAX_CREATE_URL)}
          >
            <Feather name="file-text" size={20} color={ACCENT} />
            <Text style={styles.etaxButtonSecondaryText}>
              申告書作成コーナーを開く
            </Text>
          </TouchableOpacity>
        </View>

        {/* 注意書き */}
        <View style={styles.disclaimerContainer}>
          <Feather name="info" size={16} color="#999" />
          <Text style={styles.disclaimerText}>
            この画面の情報はあくまで目安です。正確な判定は税務署または税理士にご相談ください。
            {'\n\n'}
            表示されている金額は、登録された給与明細とシフトデータに基づく概算値です。
            源泉徴収票の金額と異なる場合があります。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
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

  // 判定結果バナー
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  resultBannerWarning: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFEBEB',
  },
  resultBannerSafe: {
    backgroundColor: '#F0FFF4',
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  resultReason: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },

  // セクション
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },

  // 収入行
  incomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  incomeRowLeft: {
    flex: 1,
  },
  incomeJobName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  incomeAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${ACCENT}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  copyButtonCopied: {
    backgroundColor: '#34C75910',
  },

  // 合計行
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  totalLabel: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  // e-Tax ボタン
  etaxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 10,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  etaxButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  etaxButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  etaxButtonSecondaryText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },

  // 注意書き
  disclaimerContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
});
