import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveUserSettings, getUserSettings, initDB } from '@/lib/db';
import type { DependentType, UserSettings } from '@/types';

type Step = 'birth_date' | 'dependent_type' | 'large_company' | 'carryover_income';

const STEPS: Step[] = ['birth_date', 'dependent_type', 'large_company', 'carryover_income'];

const STEP_TITLES: Record<Step, string> = {
  birth_date: '生年月日を入力してください',
  dependent_type: '扶養の種別を選択してください',
  large_company: '勤務先の規模を教えてください',
  carryover_income: '今年の繰越収入を入力してください',
};

const STEP_SUBTITLES: Record<Step, string> = {
  birth_date: '年齢に応じた壁を自動判定します',
  dependent_type: '適用される控除が変わります',
  large_company: '大企業の場合は106万円の壁も適用されます',
  carryover_income: '年途中でインストールした場合の既存収入額です',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // フォームの状態
  const [birthDate, setBirthDate] = useState(new Date(2004, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [dependentType, setDependentType] = useState<DependentType>('parent');
  const [largeCompany, setLargeCompany] = useState(false);
  const [carryoverIncome, setCarryoverIncome] = useState('0');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        await initDB();
        const existing = await getUserSettings();
        if (existing) {
          setIsEditing(true);
          setBirthDate(new Date(existing.birth_date));
          setDependentType(existing.dependent_type);
          setLargeCompany(existing.large_company);
          setCarryoverIncome(existing.carryover_income.toString());
        }
      } catch (e) {
        console.warn('DB not ready or error loading settings', e);
      }
    }
    load();
  }, []);

  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = async () => {
    if (isLastStep) {
      // 既存の設定からplanを取得して保持する
      const existing = await getUserSettings();
      const currentPlan = existing?.plan ?? 'free';

      const settings: UserSettings = {
        birth_date: formatDate(birthDate),
        dependent_type: dependentType,
        large_company: largeCompany,
        carryover_income: Math.max(0, parseInt(carryoverIncome, 10) || 0),
        plan: currentPlan,
      };
      await saveUserSettings(settings);
      router.replace('/(tabs)');
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* プログレスバー */}
          <View style={styles.progressContainer}>
            {STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index <= currentStepIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {/* タイトル */}
          <View style={styles.headerContainer}>
            <Text style={styles.stepLabel}>
              ステップ {currentStepIndex + 1} / {STEPS.length}
            </Text>
            <Text style={styles.title}>{STEP_TITLES[currentStep]}</Text>
            <Text style={styles.subtitle}>{STEP_SUBTITLES[currentStep]}</Text>
          </View>

          {/* フォームコンテンツ */}
          <View style={styles.formContainer}>
            {currentStep === 'birth_date' && (
              <View style={styles.dateContainer}>
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDateDisplay(birthDate)}
                    </Text>
                  </TouchableOpacity>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={birthDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    maximumDate={new Date()}
                    minimumDate={new Date(1950, 0, 1)}
                    locale="ja"
                  />
                )}
                {Platform.OS === 'ios' && (
                  <Text style={styles.dateDisplayText}>
                    {formatDateDisplay(birthDate)}
                  </Text>
                )}
              </View>
            )}

            {currentStep === 'dependent_type' && (
              <View style={styles.optionsContainer}>
                {([
                  { value: 'parent' as DependentType, label: '親の扶養', desc: '大学生・フリーターなど' },
                  { value: 'spouse' as DependentType, label: '配偶者の扶養', desc: '主婦・主夫など' },
                  { value: 'none' as DependentType, label: '扶養なし', desc: '独立して生計を立てている' },
                ]).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionCard,
                      dependentType === option.value && styles.optionCardSelected,
                    ]}
                    onPress={() => setDependentType(option.value)}
                  >
                    <View style={styles.radioOuter}>
                      {dependentType === option.value && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionLabel,
                          dependentType === option.value && styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.optionDesc}>{option.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentStep === 'large_company' && (
              <View style={styles.optionsContainer}>
                {([
                  { value: false, label: '中小企業・個人事業', desc: '従業員50人以下など' },
                  { value: true, label: '大企業', desc: '従業員51人以上（社保の106万壁あり）' },
                ]).map((option) => (
                  <TouchableOpacity
                    key={String(option.value)}
                    style={[
                      styles.optionCard,
                      largeCompany === option.value && styles.optionCardSelected,
                    ]}
                    onPress={() => setLargeCompany(option.value)}
                  >
                    <View style={styles.radioOuter}>
                      {largeCompany === option.value && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionLabel,
                          largeCompany === option.value && styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.optionDesc}>{option.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentStep === 'carryover_income' && (
              <View style={styles.incomeContainer}>
                <View style={styles.incomeInputWrapper}>
                  <Text style={styles.currencySymbol}>¥</Text>
                  <TextInput
                    style={styles.incomeInput}
                    value={carryoverIncome}
                    onChangeText={(text) => setCarryoverIncome(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#999"
                    returnKeyType="done"
                  />
                </View>
                <Text style={styles.incomeHint}>
                  今年1月1日からアプリ導入日までに得た収入の合計額を入力してください。
                  不明な場合は 0 のままで大丈夫です。
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ボタン */}
        <View style={styles.buttonContainer}>
          {currentStepIndex > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>戻る</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, currentStepIndex === 0 && styles.nextButtonFull]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {isLastStep ? (isEditing ? '保存する' : '始める') : '次へ'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

const ACCENT = '#208AEF';
const ACCENT_LIGHT = '#E6F4FE';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  // プログレス
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressDot: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: ACCENT,
  },

  // ヘッダー
  headerContainer: {
    marginBottom: 32,
  },
  stepLabel: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },

  // フォーム
  formContainer: {
    flex: 1,
  },

  // 日付
  dateContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  dateButton: {
    backgroundColor: ACCENT_LIGHT,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  dateButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: ACCENT,
  },
  dateDisplayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },

  // 選択肢
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  optionCardSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_LIGHT,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: ACCENT,
  },
  optionDesc: {
    fontSize: 13,
    color: '#888',
  },

  // 金額入力
  incomeContainer: {
    paddingVertical: 16,
  },
  incomeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#666',
    marginRight: 8,
  },
  incomeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  incomeHint: {
    marginTop: 16,
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
  },

  // ボタン
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
