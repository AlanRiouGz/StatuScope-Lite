import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Sidebar, SidebarActive, SidebarItemKey, SidebarNavItem } from '@/components/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';

export interface DashboardLayoutProps {
  active?: SidebarActive;
  children: React.ReactNode;
  sectionLabel?: string;
  userName: string;
  userId?: string;
  avatarText?: string;
  onLogout?: () => void;
  links?: Partial<Record<SidebarItemKey, string>>;
  sidebarItems?: SidebarNavItem[];
}

export function DashboardLayout({
  active = 'dashboard',
  children,
  sectionLabel = 'Dashboard',
  userName,
  userId,
  avatarText,
  onLogout,
  links,
  sidebarItems,
}: DashboardLayoutProps) {
  const { height } = useWindowDimensions();

  return (
    <View style={[styles.page, { minHeight: height }]}>
      <View style={[styles.frame, { minHeight: height }]}>
        <Sidebar active={active} onLogout={onLogout} links={links} items={sidebarItems} />
        <View style={styles.mainArea}>
          <TopHeader
            sectionLabel={sectionLabel}
            userName={userName}
            userId={userId}
            avatarText={avatarText}
          />
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  frame: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F5F5F8',
  },
  mainArea: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  content: {
    flex: 1,
  },
});
