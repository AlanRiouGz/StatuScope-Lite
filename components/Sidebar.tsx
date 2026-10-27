import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from '@/i18n';

export type SidebarItemKey =
  | 'dashboard'
  | 'diagnosis'
  | 'analytics';

export type SidebarActive = SidebarItemKey;

export interface SidebarNavItem {
  key: SidebarItemKey;
  label: string;
  icon: React.ReactNode;
}

export interface SidebarProps {
  active?: SidebarActive;
  onLogout?: () => void;
  links?: Partial<Record<SidebarItemKey, string>>;
  items?: SidebarNavItem[];
}

const navItems: SidebarNavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: <MaterialCommunityIcons name="view-grid-outline" size={18} color="#475569" />,
  },
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    icon: <MaterialCommunityIcons name="stethoscope" size={18} color="#475569" />,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: <Feather name="bar-chart-2" size={18} color="#475569" />,
  },
];

export function Sidebar({ active = 'dashboard', onLogout, links, items = navItems }: SidebarProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const labelForItem = (item: SidebarNavItem) => {
    if (item.label !== navItems.find((navItem) => navItem.key === item.key)?.label) {
      return item.label;
    }
    const key = item.key === 'analytics' ? 'analyticsNav' : item.key;
    return t(`layout.sidebar.${key}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandWrap}>
        <View style={styles.brandBadge}>
          <MaterialCommunityIcons name="radar" size={18} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.brandName}>StatuScope Lite</Text>
          <Text style={styles.brandSubtitle}>{t('layout.sidebar.healthcare')}</Text>
          <Text style={styles.brandSubtitle}>{t('layout.sidebar.analytics')}</Text>
        </View>
      </View>

      <View style={styles.nav}>
        {items.map((item) => {
          const isActive = active === item.key;

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              activeOpacity={0.75}
              disabled={!links?.[item.key] || isActive}
              onPress={() => {
                const targetHref = links?.[item.key];
                if (!targetHref || isActive) return;
                router.replace(targetHref as never);
              }}
            >
              <View style={styles.navIcon}>{item.icon}</View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{labelForItem(item)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.logoutWrap}>
        <TouchableOpacity style={styles.logout} activeOpacity={0.75} onPress={onLogout}>
          <Feather name="power" size={18} color="#64748B" />
          <Text style={styles.logoutLabel}>{t('layout.sidebar.logout')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 256,
    backgroundColor: '#FCFDFE',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 3, 184, 0.10)',
    paddingRight: 1,
    alignSelf: 'stretch',
    minHeight: '100%',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 23,
    paddingBottom: 24,
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0003B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: '#0003B8',
  },
  brandSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  nav: {
    flex: 1,
    padding: 16,
    paddingBottom: 88,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 3, 184, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.10)',
  },
  navIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#526174',
  },
  navLabelActive: {
    color: '#0003B8',
  },
  logoutWrap: {
    position: 'absolute',
    left: 0,
    right: 1,
    bottom: 0,
    backgroundColor: '#FCFDFE',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 16,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  logoutLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(71, 85, 105, 0.72)',
  },
});
