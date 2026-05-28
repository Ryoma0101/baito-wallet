import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

import { initDB, getUserSettings } from '@/lib/db';
import { initPurchases } from '@/lib/purchases';
import { PrivacyProvider } from '@/context/PrivacyContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        await initDB();
        await initPurchases();
        const settings = await getUserSettings();

        if (!settings) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      } catch (error) {
        // DB初期化失敗時もオンボーディングへ
        router.replace('/onboarding');
      } finally {
        setIsReady(true);
      }
    }
    bootstrap();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PrivacyProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </PrivacyProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
