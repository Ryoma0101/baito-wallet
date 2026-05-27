import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { fetchTaxRules } from '@/lib/rules';
import { getUserSettings } from '@/lib/db';
import type { TaxNews, UserSettings } from '@/types';

const ACCENT = '#208AEF';

/**
 * published_at を「〇日前」「〇ヶ月前」形式に変換する
 */
function formatRelativeDate(dateStr: string): string {
  const published = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - published.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '予定';
  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays < 30) return `${diffDays}日前`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}ヶ月前`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years}年前`;
}

/**
 * ニュースが現在のユーザー設定に該当するかチェックする
 */
function isNewsRelevant(news: TaxNews, settings: UserSettings | null): boolean {
  if (!news.target || news.target.length === 0) return true;
  if (news.target.includes('all')) return true;
  if (!settings) return false;

  for (const t of news.target) {
    if (t === 'large_company' && settings.large_company) return true;
    if (t === 'parent' && settings.dependent_type === 'parent') return true;
    if (t === 'spouse' && settings.dependent_type === 'spouse') return true;
  }
  return false;
}

export default function NewsScreen() {
  const [allNews, setAllNews] = useState<TaxNews[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedNews, setSelectedNews] = useState<TaxNews | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    setError(false);
    try {
      const [rules, userSettings] = await Promise.all([
        fetchTaxRules(),
        getUserSettings(),
      ]);
      setSettings(userSettings);

      if (rules.version === 'fallback' && rules.news.length === 0) {
        // Fetch failed and fallback has no news
        setError(true);
        setAllNews([]);
      } else {
        setAllNews(rules.news || []);
      }
    } catch (e) {
      setError(true);
      setAllNews([]);
    } finally {
      setLoading(false);
    }
  }

  // Filter news by user's settings
  const filteredNews = allNews.filter((n) => isNewsRelevant(n, settings));

  // Sort: important first, then by published_at descending
  const sortedNews = [...filteredNews].sort((a, b) => {
    if (a.important && !b.important) return -1;
    if (!a.important && b.important) return 1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContainer}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Feather name="wifi-off" size={40} color="#CCC" />
            <Text style={styles.errorText}>
              情報を取得できませんでした。{'\n'}ネットワーク接続を確認してください。
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryBtnText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : sortedNews.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="info" size={40} color="#CCC" />
            <Text style={styles.emptyText}>現在お知らせはありません</Text>
          </View>
        ) : (
          sortedNews.map((news) => (
            <TouchableOpacity
              key={news.id}
              style={[styles.card, news.important && styles.cardImportant]}
              onPress={() => setSelectedNews(news)}
            >
              <View style={styles.cardTop}>
                {news.important && (
                  <View style={styles.importantBadge}>
                    <Feather name="alert-circle" size={12} color="#FFF" />
                    <Text style={styles.importantBadgeText}>重要</Text>
                  </View>
                )}
                <Text style={styles.cardDate}>
                  {formatRelativeDate(news.published_at)}
                </Text>
              </View>
              <Text
                style={[styles.cardTitle, news.important && styles.cardTitleImportant]}
                numberOfLines={2}
              >
                {news.title}
              </Text>
              <Text style={styles.cardBody} numberOfLines={2}>
                {news.body}
              </Text>
              <View style={styles.readMore}>
                <Text style={styles.readMoreText}>続きを読む</Text>
                <Feather name="chevron-right" size={14} color={ACCENT} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={selectedNews !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedNews(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedNews(null)}>
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>ニュース詳細</Text>
            <View style={{ width: 40 }} />
          </View>
          {selectedNews && (
            <ScrollView style={styles.modalContent}>
              {selectedNews.important && (
                <View style={styles.modalImportantBanner}>
                  <Feather name="alert-circle" size={16} color="#FFF" />
                  <Text style={styles.modalImportantText}>重要なお知らせ</Text>
                </View>
              )}
              <Text style={styles.modalDate}>
                {selectedNews.published_at} ({formatRelativeDate(selectedNews.published_at)})
              </Text>
              <Text style={styles.modalTitle}>{selectedNews.title}</Text>
              <Text style={styles.modalBody}>{selectedNews.body}</Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#999',
  },
  errorText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: ACCENT,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },

  // Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardImportant: {
    borderColor: '#FF9500',
    borderWidth: 2,
    backgroundColor: '#FFFBF5',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  importantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  importantBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
    lineHeight: 24,
  },
  cardTitleImportant: {
    color: '#CC7700',
  },
  cardBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readMoreText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '500',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: 16,
    color: ACCENT,
    fontWeight: '500',
  },
  modalContent: {
    padding: 20,
  },
  modalImportantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  modalImportantText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalDate: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    lineHeight: 32,
  },
  modalBody: {
    fontSize: 16,
    color: '#333',
    lineHeight: 28,
  },
});
