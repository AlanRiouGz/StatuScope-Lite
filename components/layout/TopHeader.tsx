import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Avatar } from '../foundation/Avatar';
import { LanguageSwitcher } from '../inputs/LanguageSwitcher';

export interface TopHeaderProps {
  sectionLabel?: string;
  userName: string;
  userId?: string;
  showNotificationDot?: boolean;
  avatarText?: string;
  onProfilePress?: () => void;
  style?: ViewStyle;
}

export function TopHeader({
  sectionLabel,
  userName,
  userId,
  showNotificationDot = false,
  avatarText = 'SC',
  onProfilePress,
  style,
}: TopHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        {sectionLabel ? <Text style={styles.sectionLabel}>{sectionLabel}</Text> : null}
      </View>

      <View style={styles.rightSection}>
        <LanguageSwitcher />

        <View style={styles.divider} />

        <TouchableOpacity style={styles.profileSection} onPress={onProfilePress}>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userName}</Text>
            {userId ? <Text style={styles.userId}>{userId}</Text> : null}
          </View>
          <Avatar initials={avatarText} tone="doctor" size="md" style={styles.avatar} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    minHeight: 68,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  leftSection: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 1,
    gap: 14,
  },
  profileInfo: {
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  userId: {
    marginTop: 0,
    fontSize: 12,
    lineHeight: 16,
    color: '#94A3B8',
  },
  avatar: {
    backgroundColor: '#5FA8A2',
  },
});
