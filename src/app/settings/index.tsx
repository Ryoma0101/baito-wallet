import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { resetAllData } from '@/lib/db';

const ACCENT = '#208AEF';

export default function SettingsScreen() {
  const router = useRouter();

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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        
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
  menuItemDangerText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
