import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { usePrivacy } from '@/context/PrivacyContext';

export default function TabLayout() {
  const router = useRouter();
  const { privacyMode, togglePrivacyMode } = usePrivacy();

  const HeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 16 }}>
      <TouchableOpacity onPress={togglePrivacyMode}>
        <Feather name={privacyMode ? "eye-off" : "eye"} size={22} color="#666" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/settings')}>
        <Feather name="settings" size={22} color="#666" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#208AEF',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          borderTopColor: '#F0F0F0',
        },
        headerRight: () => <HeaderRight />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          headerTitle: 'バイト管理',
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'バイト先',
          headerTitle: 'バイト先一覧',
          tabBarIcon: ({ color }) => (
            <Feather name="briefcase" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'シフト',
          headerTitle: 'シフト管理',
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          title: '明細',
          headerTitle: '給与明細',
          tabBarIcon: ({ color }) => (
            <Feather name="file-text" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chart"
        options={{
          title: 'グラフ',
          headerTitle: '月次グラフ',
          tabBarIcon: ({ color }) => (
            <Feather name="bar-chart-2" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'ニュース',
          headerTitle: '税制ニュース',
          tabBarIcon: ({ color }) => (
            <Feather name="bell" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
