import React, { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { I18nProvider } from '@/i18n';
import { DEMO_NOTICE } from '@/lib/demo/config';
import '@/global.css';

function DemoRoutes() {
  const { profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!profile && pathname !== '/login') router.replace('/login');
    if (profile && (pathname === '/login' || pathname === '/')) router.replace('/dashboard/doctor');
  }, [loading, pathname, profile, router]);
  if (loading || (!profile && pathname !== '/login')) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  return <View style={{ flex: 1 }}>
    <Text style={{ backgroundColor: '#E0E7FF', color: '#1E3A8A', padding: 8, textAlign: 'center', fontSize: 13 }}>{DEMO_NOTICE}</Text>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F5F8' } }} />
  </View>;
}

export default function RootLayout() {
  return <I18nProvider><AuthProvider><DemoRoutes /></AuthProvider></I18nProvider>;
}
