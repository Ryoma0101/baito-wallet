import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { CurrencyInput } from '@/components/CurrencyInput';
import { usePrivacy } from '@/context/PrivacyContext';
import { getAllPayslips, addPayslip, updatePayslip, deletePayslip, getActiveJobs, getAllShifts } from '@/lib/db';
import type { Payslip, Job, Shift } from '@/types';

const ACCENT = '#208AEF';

function isImage(uri: string | null) {
  if (!uri) return false;
  const ext = uri.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
}

export default function PayslipsScreen() {
  const { formatYen } = usePrivacy();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);

  // Form state
  const [jobId, setJobId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  
  const [grossAmount, setGrossAmount] = useState('');
  const [nonTaxableAmount, setNonTaxableAmount] = useState('0');
  const [taxableAmount, setTaxableAmount] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const handleGrossChange = (val: string) => {
    setGrossAmount(val);
    const g = parseInt(val, 10) || 0;
    const n = parseInt(nonTaxableAmount, 10) || 0;
    setTaxableAmount(Math.max(0, g - n).toString());
  };

  const handleNonTaxableChange = (val: string) => {
    setNonTaxableAmount(val);
    const g = parseInt(grossAmount, 10) || 0;
    const n = parseInt(val, 10) || 0;
    setTaxableAmount(Math.max(0, g - n).toString());
  };

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const filename = file.name || `payslip_${Date.now()}`;
      const newUri = (FileSystem.documentDirectory || '') + filename;
      await FileSystem.copyAsync({ from: file.uri, to: newUri });
      setImageUri(newUri);
    } catch (e) {
      Alert.alert('エラー', 'ファイルの選択に失敗しました');
    }
  }

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
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    setYear(currentYear.toString());
    setMonth(currentMonth.toString());
    setGrossAmount('');
    setNonTaxableAmount('0');
    setTaxableAmount('');
    setImageUri(null);
    setModalMode('add');
    setModalVisible(true);
  }

  function openViewModal(ps: Payslip) {
    setEditingPayslip(ps);
    setModalMode('view');
    setModalVisible(true);
  }

  function openEditModal(ps: Payslip) {
    setEditingPayslip(ps);
    setJobId(ps.job_id);
    setYear(ps.year.toString());
    setMonth(ps.month.toString());
    setGrossAmount(ps.actual_amount.toString());
    setNonTaxableAmount((ps.non_taxable_amount || 0).toString());
    setTaxableAmount((ps.taxable_amount || ps.actual_amount).toString());
    setImageUri(ps.image_uri || null);
    setModalMode('edit');
    setModalVisible(true);
  }

  function handleCancel() {
    if (modalMode === 'edit' && editingPayslip) {
      setModalMode('view');
    } else {
      setModalVisible(false);
    }
  }

  async function handleSave() {
    if (!jobId || !year || !month || !grossAmount) {
      Alert.alert('エラー', '必須項目（バイト先、年月、総支給額）を入力してください');
      return;
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const gross = parseInt(grossAmount, 10);
    const nonTax = parseInt(nonTaxableAmount, 10) || 0;
    const tax = parseInt(taxableAmount, 10) || 0;
    
    if (isNaN(y) || isNaN(m) || isNaN(gross) || m < 1 || m > 12) {
      Alert.alert('エラー', '正しい数値を入力してください');
      return;
    }

    try {
      const data = {
        job_id: jobId,
        year: y,
        month: m,
        actual_amount: gross,
        taxable_amount: tax,
        non_taxable_amount: nonTax,
        image_uri: imageUri,
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
            setModalVisible(false);
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

  const currentYearPayslips = useMemo(() => {
    const year = new Date().getFullYear();
    return payslips.filter(p => p.year === year);
  }, [payslips]);

  const summary = useMemo(() => {
    let actual = 0;
    let nonTax = 0;
    let tax = 0;
    currentYearPayslips.forEach((p: Payslip) => {
      actual += p.actual_amount;
      nonTax += p.non_taxable_amount || 0;
      tax += p.taxable_amount || p.actual_amount;
    });
    return { actual, nonTax, tax };
  }, [currentYearPayslips]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContainer}>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>今年（{new Date().getFullYear()}年）の給与実績</Text>
          <Text style={styles.summaryTotal}>{formatYen(summary.actual)}</Text>
          <View style={styles.summaryDetails}>
            <Text style={styles.summaryDetailText}>課税対象額: {formatYen(summary.tax)}</Text>
            <Text style={styles.summaryDetailText}>非課税（交通費）: {formatYen(summary.nonTax)}</Text>
          </View>
        </View>

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
              <TouchableOpacity key={ps.id} style={styles.card} onPress={() => openViewModal(ps)}>
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeader}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{ps.year}年{ps.month}月</Text>
                    </View>
                    <Text style={styles.jobName}>{job ? job.name : '不明なバイト先'}</Text>
                  </View>
                  <Text style={styles.amountText}>総支給: {formatYen(ps.actual_amount)}</Text>
                </View>
              </TouchableOpacity>
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
            {modalMode === 'view' ? (
              <>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelBtnText}>閉じる</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>明細の詳細</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity onPress={() => openEditModal(editingPayslip!)}>
                    <Feather name="edit-2" size={20} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(editingPayslip!.id)}>
                    <Feather name="trash-2" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelBtnText}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{modalMode === 'edit' ? '明細の編集' : '明細の追加'}</Text>
                <TouchableOpacity onPress={handleSave}>
                  <Text style={styles.saveBtnText}>保存</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <ScrollView style={styles.formContainer}>
            {modalMode === 'view' && editingPayslip ? (
              <View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>バイト先</Text>
                  <Text style={styles.viewValue}>{jobs.find(j => j.id === editingPayslip.job_id)?.name}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>年月</Text>
                  <Text style={styles.viewValue}>{editingPayslip.year}年{editingPayslip.month}月</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>総支給額</Text>
                  <Text style={styles.viewValue}>{formatYen(editingPayslip.actual_amount)}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>非課税（交通費など）</Text>
                  <Text style={styles.viewValue}>{formatYen(editingPayslip.non_taxable_amount || 0)}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>課税対象額</Text>
                  <Text style={styles.viewValue}>{formatYen(editingPayslip.taxable_amount || editingPayslip.actual_amount)}</Text>
                </View>
                
                {editingPayslip.image_uri && (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>添付ファイル</Text>
                    {isImage(editingPayslip.image_uri) ? (
                      <TouchableOpacity 
                        onPress={async () => {
                          try {
                            if (await Sharing.isAvailableAsync()) {
                              await Sharing.shareAsync(editingPayslip.image_uri!);
                            } else {
                              Alert.alert('エラー', 'この端末ではファイルを開けません');
                            }
                          } catch(e) {}
                        }}
                      >
                        <Image 
                          source={{ uri: editingPayslip.image_uri }} 
                          style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8, backgroundColor: '#EEE' }} 
                          resizeMode="contain"
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, opacity: 0.6 }}>
                          <Feather name="maximize-2" size={14} color="#666" />
                          <Text style={{ marginLeft: 4, fontSize: 12, color: '#666' }}>タップして全画面表示・共有</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.attachmentView}
                        onPress={async () => {
                          try {
                            if (await Sharing.isAvailableAsync()) {
                              await Sharing.shareAsync(editingPayslip.image_uri!);
                            } else {
                              Alert.alert('エラー', 'この端末ではファイルを開けません');
                            }
                          } catch(e) {}
                        }}
                      >
                        <Feather name="file-text" size={20} color={ACCENT} />
                        <Text style={styles.attachmentText} numberOfLines={1}>{editingPayslip.image_uri.split('/').pop()}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View>
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
              <Text style={styles.label}>総支給額（円）</Text>
              <CurrencyInput
                style={styles.input}
                value={grossAmount}
                onChangeValue={handleGrossChange}
                placeholder="例：82000"
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>非課税（交通費など）</Text>
                <CurrencyInput
                  style={styles.input}
                  value={nonTaxableAmount}
                  onChangeValue={handleNonTaxableChange}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.label}>課税対象額（自動計算）</Text>
                <View style={[styles.input, { backgroundColor: 'transparent', paddingHorizontal: 0 }]}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: ACCENT }}>
                    {taxableAmount ? `${parseInt(taxableAmount, 10).toLocaleString()} 円` : '0 円'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>明細の画像 / PDF</Text>
              {imageUri ? (
                <View style={styles.attachmentView}>
                  <Feather name="file-text" size={24} color={ACCENT} />
                  <TouchableOpacity 
                    style={{ flex: 1, marginLeft: 12 }}
                    onPress={async () => {
                      try {
                        const isAvailable = await Sharing.isAvailableAsync();
                        if (isAvailable) {
                          await Sharing.shareAsync(imageUri);
                        } else {
                          Alert.alert('エラー', 'この端末ではファイルを開けません');
                        }
                      } catch (e) {
                        Alert.alert('エラー', 'ファイルを開く際にエラーが発生しました');
                      }
                    }}
                  >
                    <Text style={styles.attachmentText} numberOfLines={1} ellipsizeMode="middle">
                      {imageUri.split('/').pop()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setImageUri(null)} style={styles.attachmentRemove}>
                    <Feather name="x" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
                  <Feather name="upload" size={20} color={ACCENT} />
                  <Text style={styles.attachBtnText}>ファイルを選択</Text>
                </TouchableOpacity>
              )}
            </View>
            
                <View style={{ height: 40 }} />
              </View>
            )}
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
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  viewRow: {
    marginBottom: 20,
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
  },
  viewLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  viewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
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
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ACCENT,
    backgroundColor: '#EAF4FE',
    gap: 8,
  },
  attachBtnText: {
    color: ACCENT,
    fontWeight: '600',
    fontSize: 15,
  },
  attachmentView: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  attachmentText: {
    fontSize: 14,
    color: ACCENT,
    textDecorationLine: 'underline',
  },
  attachmentRemove: {
    padding: 8,
  },
  badgeAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  badgeAttachmentText: {
    fontSize: 12,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EAF4FE',
  },
  summaryTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryTotal: {
    fontSize: 28,
    fontWeight: '800',
    color: ACCENT,
    marginBottom: 12,
  },
  summaryDetails: {
    backgroundColor: '#F5F5F8',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  summaryDetailText: {
    fontSize: 13,
    color: '#555',
  }
});
