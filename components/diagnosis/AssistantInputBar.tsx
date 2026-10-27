import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';

export interface AssistantInputBarProps {
  placeholder?: string;
  value?: string;
  showSendButton?: boolean;
  disabled?: boolean;
  onChangeText?: (text: string) => void;
  onSendPress?: () => void;
  style?: ViewStyle;
}

export function AssistantInputBar({
  placeholder = 'Ask AI for further differential diagnosis...',
  value,
  showSendButton = true,
  disabled = false,
  onChangeText,
  onSendPress,
  style,
}: AssistantInputBarProps) {
  return (
    <View style={[styles.container, disabled && styles.containerDisabled, style]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline
        scrollEnabled
        textAlignVertical="center"
      />
      {showSendButton ? (
        <TouchableOpacity
          style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
          onPress={onSendPress}
          disabled={disabled || !value}
          activeOpacity={0.75}
        >
          <Feather name="send" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    height: 52,
  },
  containerDisabled: {
    backgroundColor: '#F8FAFC',
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#0F172A',
    paddingVertical: 0,
    height: 36,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0003B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
});
