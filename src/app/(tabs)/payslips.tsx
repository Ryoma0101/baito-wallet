import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { getAllPayslips, addPayslip, updatePayslip, deletePayslip, getActiveJobs, getAllShifts } from '@/lib/db';
import type { Payslip, Job, Shift } from '@/types';

const ACCENT = '#208AEF';

function formatYen(amount: number) {
  return `${amount.toLocaleString()}円`;
}

export default function PayslipsScreen() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);

  // Form state
  const [jobId, setJobId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [actualAmount, setActualAmount] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const [ps, jb, sh] = await Promise.all([getAllPayslips(), getActiveJobs(), getAllShifts()]);
      setPayslips(ps);
      setJobs(jb);
      setShifts(sh);
    } catch (e) {
      console.error(e);
    }
  }

  function openAddModal() {
    if (jobs.length === 0) {
      Alert.alert('エラー', '先に「バイト先」タブでバイト先を登録してください');
      return;
    }
    setEditingPayslip(null);
    setJobId(jobs[0].id);
    setYear(new Date().getFullYear().toString());
    let lastMonth = new Date().getMonth(); // 先月をデフォルトに
    let currentYear = new Date().getFullYear();
    if (lastMonth === 0) {
      lastMonth = 12;
      currentYear -= 1;
    }
    setYear(currentYear.toString());
    setMonth(lastMonth.toString());
    setActualAmount('');
    setModalVisible(true);
  }

  function openEditModal(ps: Payslip) {
    setEditingPayslip(ps);
    setJobId(ps.job_id);
    setYear(ps.year.toString());
    setMonth(ps.month.toString());
    setActualAmount(ps.actual_amount.toString());
    setModalVisible(true);
  }

  async function handleSave() {
    if (!jobId || !year || !month || !actualAmount) {
      Alert.alert('エラー', 'すべての項目を入力してください');
      return;
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const amt = parseInt(actualAmount, 10);
    
    if (isNaN(y) || isNaN(m) || isNaN(amt) || m < 1 || m > 12) {
      Alert.alert('エラー', '正しい数値を入力してください');
      return;
    }

    try {
      const data = {
        job_id: jobId,
        year: y,
        month: m,
        actual_amount: amt,
      };

      if (editingPayslip) {
        await updatePayslip({ id: editingPayslip.id, ...data });
      } else {
        await addPayslip(data);
      }
      setModalVisible(false);
      loadData();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  }

  function confirmDelete(id: number) {
    Alert.alert('確認', '明細を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await deletePayslip(id);
            loadData();
          } catch (e) {
            Alert.alert('エラー', '削除に失敗しました');
          }
        }
      }
    ]);
  }

  function getEstimatedAmount(jid: number, y: number, m: number) {
    const targetStr = `${y}-${m.toString().padStart(2, '0')}`;
    return shifts
      .filter(s => s.job_id === jid && s.date.startsWith(targetStr))
      .reduce((sum, s) => sum + s.estimated_wage, 0);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContainer}>
        {payslips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>登録されている給与明細はありません</Text>
          </View>
        ) : (
          payslips.map(ps => {
            const job = jobs.find(j => j.id === ps.job_id);
            const est = getEstimatedAmount(ps.job_id, ps.year, ps.month);
            const diff = ps.actual_amount - est;
            const diffSign = diff > 0 ? '+' : '';
            const diffColor = diff > 0 ? '#4CAF50' : diff < 0 ? '#FF3B30' : '#888';

            return (
              <View key={ps.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeader}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{ps.year}年{ps.month}月</Text>
                    </View>
                    <Text style={styles.jobName}>{job ? job.name : '不明なバイト先'}</Text>
                  </View>
                  
                  <View style={styles.amountBox}>
                    <Text style={styles.actualAmount}>実績: {formatYen(ps.actual_amount)}</Text>
                    <Text style={styles.estAmount}>見込み: {formatYen(est)}</Text>
                  </View>
                  
                  <View style={styles.diffRow}>
                    <Text style={styles.diffLabel}>差分: </Text>
                    <Text style={[styles.diffValue, { color: diffColor }]}>
                      {diffSign}{formatYen(diff)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(ps)}>
                    <Feather name="edit-2" size={18} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(ps.id)}>
                    <Feather name="trash-2" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
          <Feather name="plus" size={24} color="#FFF" />
          <Text style={styles.fabText}>明細追加</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingPayslip ? '明細の編集' : '明細の追加'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>バイト先</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jobSelectScroll}>
                {jobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobChip, jobId === job.id && styles.jobChipActive]}
                    onPress={() => setJobId(job.id)}
                  >
                    <Text style={[styles.jobChipText, jobId === job.id && styles.jobChipTextActive]}>{job.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>年 (YYYY)</Text>
                <TextInput
                  style={styles.input}
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.label}>月 (1-12)</Text>
                <TextInput
                  style={styles.input}
                  value={month}
                  onChangeText={setMonth}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>実支給額（円）</Text>
              <TextInput
                style={styles.input}
                value={actualAmount}
                onChangeText={setActualAmount}
                keyboardType="number-pad"
                placeholder="例：82000"
              />
            </View>
          </ScrollView>
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
    paddingBottom: 100,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  dateBadge: {
    backgroundColor: '#EAF4FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateBadgeText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 13,
  },
  jobName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  amountBox: {
    backgroundColor: '#F9F9F9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  actualAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  estAmount: {
    fontSize: 13,
    color: '#666',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diffLabel: {
    fontSize: 13,
    color: '#888',
  },
  diffValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingTop: 10,
  },
  actionBtn: {
    padding: 8,
    backgroundColor: '#F5F5F8',
    borderRadius: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  fabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal styles
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
  },
  saveBtnText: {
    fontSize: 16,
    color: ACCENT,
    fontWeight: '600',
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F5F8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  jobSelectScroll: {
    flexDirection: 'row',
  },
  jobChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F8',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  jobChipActive: {
    backgroundColor: '#EAF4FE',
    borderColor: ACCENT,
  },
  jobChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  jobChipTextActive: {
    color: ACCENT,
    fontWeight: '700',
  }
});
