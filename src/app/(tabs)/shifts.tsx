import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { CurrencyInput } from '@/components/CurrencyInput';
import { usePrivacy } from '@/context/PrivacyContext';
import { getAllShifts, addShift, updateShift, deleteShift, getActiveJobs } from '@/lib/db';
import type { Shift, Job } from '@/types';

const ACCENT = '#208AEF';

function toHHMM(d: Date) {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function parseHHMMtoToday(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function ShiftsScreen() {
  const { formatYen } = usePrivacy();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  // Form state
  const [jobId, setJobId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date(new Date().setHours(10, 0, 0, 0)));
  const [endTime, setEndTime] = useState(new Date(new Date().setHours(15, 0, 0, 0)));
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [estimatedWageStr, setEstimatedWageStr] = useState('0');
  const [transportationStr, setTransportationStr] = useState('0');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const [sh, jb] = await Promise.all([getAllShifts(), getActiveJobs()]);
      setShifts(sh);
      setJobs(jb);
    } catch (e) {
      console.error(e);
    }
  }

  function openAddModal() {
    if (jobs.length === 0) {
      Alert.alert('エラー', '先に「バイト先」タブでバイト先を登録してください');
      return;
    }
    setEditingShift(null);
    setJobId(jobs[0].id);
    setDate(new Date());
    setStartTime(new Date(new Date().setHours(10, 0, 0, 0)));
    setEndTime(new Date(new Date().setHours(15, 0, 0, 0)));
    setBreakMinutes('0');
    setEstimatedWageStr('0');
    setTransportationStr('0');
    setModalVisible(true);
  }

  function openEditModal(shift: Shift) {
    setEditingShift(shift);
    setJobId(shift.job_id);
    setDate(new Date(shift.date));
    setStartTime(parseHHMMtoToday(shift.start_time));
    setEndTime(parseHHMMtoToday(shift.end_time));
    setBreakMinutes(shift.break_minutes.toString());
    setEstimatedWageStr(shift.estimated_wage.toString());
    setTransportationStr((shift.transportation_allowance || 0).toString());
    setModalVisible(true);
  }

  const calculatedWage = useMemo(() => {
    if (!jobId) return { wage: 0, trans: 0 };
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { wage: 0, trans: 0 };

    let diffMs = endTime.getTime() - startTime.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    let workMinutes = Math.floor(diffMs / 60000);
    const breakMin = parseInt(breakMinutes, 10) || 0;
    workMinutes = Math.max(0, workMinutes - breakMin);

    const baseWage = Math.round((workMinutes / 60) * job.hourly_wage);
    return { wage: baseWage, trans: job.transportation_allowance || 0 };
  }, [jobId, jobs, startTime, endTime, breakMinutes]);

  React.useEffect(() => {
    if (!editingShift) {
      setEstimatedWageStr(calculatedWage.wage.toString());
      setTransportationStr(calculatedWage.trans.toString());
    }
  }, [calculatedWage, editingShift]);

  async function handleSave() {
    if (!jobId) return;

    try {
      const shiftData = {
        job_id: jobId,
        date: date.toISOString().split('T')[0],
        start_time: toHHMM(startTime),
        end_time: toHHMM(endTime),
        break_minutes: parseInt(breakMinutes, 10) || 0,
        estimated_wage: parseInt(estimatedWageStr, 10) || 0,
        transportation_allowance: parseInt(transportationStr, 10) || 0,
      };

      if (editingShift) {
        await updateShift({ id: editingShift.id, ...shiftData });
      } else {
        await addShift(shiftData);
      }
      setModalVisible(false);
      loadData();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  }

  function confirmDelete(id: number) {
    Alert.alert('確認', 'シフトを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await deleteShift(id);
            loadData();
          } catch (e) {
            Alert.alert('エラー', '削除に失敗しました');
          }
        }
      }
    ]);
  }

  const currentMonthShifts = useMemo(() => {
    const prefix = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    return shifts
      .filter(s => s.date.startsWith(prefix))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      });
  }, [shifts, selectedYear, selectedMonth]);

  const summary = useMemo(() => {
    let wage = 0;
    let trans = 0;
    currentMonthShifts.forEach(s => {
      wage += s.estimated_wage;
      trans += s.transportation_allowance || 0;
    });
    return { wage, trans, total: wage + trans };
  }, [currentMonthShifts]);

  function changeMonth(delta: number) {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y += 1; }
    else if (m < 1) { m = 12; y -= 1; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContainer}>
        
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
            <Feather name="chevron-left" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{selectedYear}年 {selectedMonth}月</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
            <Feather name="chevron-right" size={24} color={ACCENT} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>今月（{selectedMonth}月）の見込み給与</Text>
          <Text style={styles.summaryTotal}>{formatYen(summary.total)}</Text>
          <View style={styles.summaryDetails}>
            <Text style={styles.summaryDetailText}>課税対象額（給与）: {formatYen(summary.wage)}</Text>
            <Text style={styles.summaryDetailText}>非課税（交通費）: {formatYen(summary.trans)}</Text>
          </View>
        </View>

        {currentMonthShifts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>登録されているシフトはありません</Text>
          </View>
        ) : (
          currentMonthShifts.map(shift => {
            const job = jobs.find(j => j.id === shift.job_id);
            return (
              <View key={shift.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeader}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{shift.date.replace('2026-', '')}</Text>
                    </View>
                    <Text style={styles.jobName}>{job ? job.name : '不明なバイト先'}</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <Feather name="clock" size={14} color="#666" />
                    <Text style={styles.timeText}>
                      {shift.start_time} - {shift.end_time}
                      {shift.break_minutes > 0 ? ` (休憩${shift.break_minutes}分)` : ''}
                    </Text>
                  </View>
                  <Text style={styles.wageText}>見込み: {formatYen(shift.estimated_wage + (shift.transportation_allowance || 0))}</Text>
                  {shift.transportation_allowance > 0 && (
                    <Text style={styles.wageSubText}>うち交通費: {formatYen(shift.transportation_allowance)}</Text>
                  )}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(shift)}>
                    <Feather name="edit-2" size={18} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(shift.id)}>
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
          <Text style={styles.fabText}>シフト追加</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingShift ? 'シフトの編集' : 'シフトの追加'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* バイト先選択 */}
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

            {/* 日付 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>日付</Text>
              {Platform.OS === 'android' ? (
                <>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.pickerBtnText}>{date.toISOString().split('T')[0]}</Text>
                    <Feather name="calendar" size={18} color="#666" />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="calendar"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDate(selectedDate);
                      }}
                    />
                  )}
                </>
              ) : (
                <View style={styles.iosCalendarContainer}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="inline"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) setDate(selectedDate);
                    }}
                  />
                </View>
              )}
            </View>

            {/* 時間 */}
            <View style={styles.timeGroup}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>開始時間</Text>
                <TouchableOpacity 
                  style={styles.pickerBtn} 
                  onPress={() => Platform.OS === 'ios' ? setShowTimeModal(true) : setShowStartTimePicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{toHHMM(startTime)}</Text>
                </TouchableOpacity>
                {Platform.OS === 'android' && showStartTimePicker && (
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setShowStartTimePicker(false);
                      if (selectedTime) setStartTime(selectedTime);
                    }}
                  />
                )}
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>終了時間</Text>
                <TouchableOpacity 
                  style={styles.pickerBtn} 
                  onPress={() => Platform.OS === 'ios' ? setShowTimeModal(true) : setShowEndTimePicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{toHHMM(endTime)}</Text>
                </TouchableOpacity>
                {Platform.OS === 'android' && showEndTimePicker && (
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setShowEndTimePicker(false);
                      if (selectedTime) setEndTime(selectedTime);
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>休憩時間（分）</Text>
              <TextInput
                style={styles.input}
                value={breakMinutes}
                onChangeText={setBreakMinutes}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.estimateCard}>
              <Text style={styles.estimateLabel}>見込み給与（課税対象額・手動補正可）</Text>
              <View style={styles.estimateInputContainer}>
                <Text style={styles.currencySymbol}>¥</Text>
                <CurrencyInput
                  style={styles.estimateInput}
                  value={estimatedWageStr}
                  onChangeValue={setEstimatedWageStr}
                />
              </View>
            </View>

            <View style={styles.estimateCard}>
              <Text style={styles.estimateLabel}>交通費（非課税・手動補正可）</Text>
              <View style={styles.estimateInputContainer}>
                <Text style={styles.currencySymbol}>¥</Text>
                <CurrencyInput
                  style={styles.estimateInput}
                  value={transportationStr}
                  onChangeValue={setTransportationStr}
                />
              </View>
            </View>

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* iOS Time Modal */}
      {Platform.OS === 'ios' && (
        <Modal visible={showTimeModal} animationType="slide" transparent={true}>
          <View style={styles.timeModalOverlay}>
            <View style={styles.timeModalContent}>
              <View style={styles.timeModalHeader}>
                <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                  <Text style={styles.timeModalDone}>完了</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeModalBody}>
                <View style={styles.timeModalRow}>
                  <Text style={styles.timeModalLabel}>開始時間</Text>
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="spinner"
                    themeVariant="light"
                    onChange={(e, d) => d && setStartTime(d)}
                    style={{ flex: 1, height: 120 }}
                  />
                </View>
                <View style={styles.timeModalRow}>
                  <Text style={styles.timeModalLabel}>終了時間</Text>
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="spinner"
                    themeVariant="light"
                    onChange={(e, d) => d && setEndTime(d)}
                    style={{ flex: 1, height: 120 }}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 20,
  },
  monthBtn: {
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
  monthText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
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
    marginBottom: 8,
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
    fontSize: 14,
  },
  jobName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  timeText: {
    color: '#666',
    fontSize: 14,
  },
  wageText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  wageSubText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cardActions: {
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
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F8',
    borderRadius: 12,
    padding: 16,
  },
  pickerBtnText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  timeGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  estimateCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  estimateLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  estimateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#666',
    marginRight: 4,
  },
  estimateInput: {
    fontSize: 24,
    fontWeight: '700',
    color: ACCENT,
    minWidth: 100,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
  },
  iosCalendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
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
  },
  timeModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  timeModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  timeModalDone: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
  timeModalBody: {
    padding: 16,
  },
  timeModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeModalLabel: {
    width: 80,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  }
});
