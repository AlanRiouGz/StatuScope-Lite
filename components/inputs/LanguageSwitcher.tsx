import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '@/i18n';

export function LanguageSwitcher() {
  const { language, toggleLanguage, t } = useTranslation();

  return (
    <TouchableOpacity
      accessibilityLabel={t('common.language.label')}
      activeOpacity={0.78}
      onPress={toggleLanguage}
      style={styles.button}
    >
      <Text style={styles.label}>{language === 'es' ? 'ES' : 'EN'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 42,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#0003B8',
  },
});
