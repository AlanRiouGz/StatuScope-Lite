import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

export interface TextareaFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  numberOfLines?: number;
  onChangeText?: (text: string) => void;
  style?: ViewStyle;
}

export function TextareaField({
  label,
  placeholder,
  value,
  hint,
  error,
  disabled = false,
  numberOfLines = 4,
  onChangeText,
  style,
}: TextareaFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return '#EF4444';
    if (isFocused) return '#1D4ED8';
    return '#E5E7EB';
  };

  const getBackgroundColor = () => {
    if (disabled) return '#F9FAFB';
    return '#FFFFFF';
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.textareaContainer,
          {
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
          },
          isFocused && styles.textareaFocused,
          disabled && styles.textareaDisabled,
        ]}
      >
        <TextInput
          style={[
            styles.textarea,
            disabled && styles.textareaTextDisabled,
          ]}
          placeholder={placeholder}
          placeholderTextColor={disabled ? '#D1D5DB' : '#94A3B8'}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline
          numberOfLines={numberOfLines}
          textAlignVertical="top"
          editable={!disabled}
        />
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  labelDisabled: {
    color: '#9CA3AF',
  },
  textareaContainer: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    width: '100%',
    minHeight: 120,
  },
  textareaFocused: {
    borderColor: '#0003B8',
  },
  textareaDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  textarea: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 16,
    lineHeight: 24,
  },
  textareaTextDisabled: {
    color: '#9CA3AF',
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
  },
});
