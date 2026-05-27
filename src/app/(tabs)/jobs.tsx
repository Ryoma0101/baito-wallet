import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { getAllJobs, addJob, updateJob, deleteJob } from '@/lib/db';
import type { Job } from '@/types';
import { CurrencyInput } from '@/components/CurrencyInput';

const ACCENT = '#208AEF';

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [hourlyWage, setHourlyWage] = useState('');
  const [transportationAllowance, setTransportationAllowance] = useState('0');
  const [employmentType, setEmploymentType] = useState<Job['employment_type']>('part');
  const [isActive, setIsActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [])
  );

  async function loadJobs() {
    try {
      const data = await getAllJobs();
      setJobs(data);
    } catch (e) {
      console.error(e);
    }
  }

  function openAddModal() {
    setEditingJob(null);
    setName('');
    setHourlyWage('');
    setTransportationAllowance('0');
    setEmploymentType('part');
    setIsActive(true);
    setModalVisible(true);
  }

  function openEditModal(job: Job) {
    setEditingJob(job);
    setName(job.name);
    setHourlyWage(job.hourly_wage.toString());
    setTransportationAllowance(job.transportation_allowance.toString());
    setEmploymentType(job.employment_type);
    setIsActive(job.is_active);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim() || !hourlyWage.trim()) {
      Alert.alert('エラー', '店名と時給を入力してください');
      return;
    }
    const wage = parseInt(hourlyWage, 10);
    const trans = parseInt(transportationAllowance, 10) || 0;
    if (isNaN(wage) || wage <= 0) {
      Alert.alert('エラー', '正しい時給を入力してください');
      return;
    }

    try {
      if (editingJob) {
        await updateJob({
          id: editingJob.id,
          name: name.trim(),
          hourly_wage: wage,
          employment_type: employmentType,
          is_active: isActive,
          transportation_allowance: trans,
        });
      } else {
        await addJob({
          name: name.trim(),
          hourly_wage: wage,
          employment_type: employmentType,
          is_active: isActive,
          transportation_allowance: trans,
        });
      }
      setModalVisible(false);
      loadJobs();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  }

  function confirmDelete(jobId: number) {
    Alert.alert('確認', '本当に削除しますか？\n(紐づくシフトや明細も消える可能性があります)', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await deleteJob(jobId);
            loadJobs();
          } catch (e) {
            Alert.alert('エラー', '削除に失敗しました');
          }
        }
      }
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContainer}>
        {jobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>登録されているバイト先はありません</Text>
          </View>
        ) : (
          jobs.map(job => (
            <View key={job.id} style={[styles.jobCard, !job.is_active && styles.jobCardInactive]}>
              <View style={styles.jobInfo}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobName}>{job.name}</Text>
                  {!job.is_active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>退職済</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.jobDetail}>時給: {job.hourly_wage.toLocaleString()}円</Text>
                <Text style={styles.jobDetail}>
                  雇用形態: {job.employment_type === 'part' ? 'パート・バイト' : job.employment_type === 'dispatch' ? '派遣' : 'その他'}
                </Text>
                {job.transportation_allowance > 0 && (
                  <Text style={styles.jobDetail}>交通費: {job.transportation_allowance.toLocaleString()}円 / 回</Text>
                )}
              </View>
              <View style={styles.jobActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(job)}>
                  <Feather name="edit-2" size={18} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(job.id)}>
                  <Feather name="trash-2" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
          <Feather name="plus" size={24} color="#FFF" />
          <Text style={styles.fabText}>追加</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingJob ? 'バイト先の編集' : 'バイト先の追加'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>店名・会社名</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="例：カフェ 駅前店"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>時給（円）</Text>
              <CurrencyInput
                style={styles.input}
                value={hourlyWage}
                onChangeValue={setHourlyWage}
                placeholder="例：1100"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>交通費（1出勤あたり・円）</Text>
              <CurrencyInput
                style={styles.input}
                value={transportationAllowance}
                onChangeValue={setTransportationAllowance}
                placeholder="例：500"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>雇用形態</Text>
              <View style={styles.radioGroup}>
                {(['part', 'dispatch', 'other'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.radioBtn, employmentType === type && styles.radioBtnActive]}
                    onPress={() => setEmploymentType(type)}
                  >
                    <Text style={[styles.radioText, employmentType === type && styles.radioTextActive]}>
                      {type === 'part' ? 'パート・バイト' : type === 'dispatch' ? '派遣' : 'その他'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {editingJob && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>勤務状況</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={[styles.radioBtn, isActive && styles.radioBtnActive]}
                    onPress={() => setIsActive(true)}
                  >
                    <Text style={[styles.radioText, isActive && styles.radioTextActive]}>勤務中</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.radioBtn, !isActive && styles.radioBtnActive]}
                    onPress={() => setIsActive(false)}
                  >
                    <Text style={[styles.radioText, !isActive && styles.radioTextActive]}>退職済</Text>
                  </TouchableOpacity>
                </View>
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
  jobCard: {
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
  jobCardInactive: {
    opacity: 0.6,
  },
  jobInfo: {
    flex: 1,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  jobName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  inactiveBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inactiveBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  jobDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  jobActions: {
    flexDirection: 'row',
    gap: 12,
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
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radioBtnActive: {
    backgroundColor: '#EAF4FE',
    borderColor: ACCENT,
  },
  radioText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  radioTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },
});
