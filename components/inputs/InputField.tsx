import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

export type InputFieldType = 'text' | 'password' | 'email' | 'number';

export interface InputFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  type?: InputFieldType;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  placeholderTextColor?: string;
  labelAccessory?: React.ReactNode;
  maxLength?: number;
}

export function InputField({
  label,
  placeholder,
  value,
  type = 'text',
  leftIcon,
  rightIcon,
  hint,
  error,
  disabled = false,
  required = false,
  onChangeText,
  onFocus,
  onBlur,
  style,
  inputContainerStyle,
  inputStyle,
  labelStyle,
  placeholderTextColor,
  labelAccessory,
  maxLength,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const getBorderColor = () => {
    if (error) return '#EF4444';
    if (isFocused) return '#1D4ED8';
    return '#E5E7EB';
  };

  const getBackgroundColor = () => {
    if (disabled) return '#F9FAFB';
    return '#FFFFFF';
  };

  const handleTogglePassword = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const renderRightIcon = () => {
    if (type === 'password') {
      return (
        <TouchableOpacity onPress={handleTogglePassword} style={styles.iconButton}>
          <Feather
            name={isPasswordVisible ? 'eye' : 'eye-off'}
            size={18}
            color={disabled ? '#CBD5E1' : '#94A3B8'}
          />
        </TouchableOpacity>
      );
    }

    if (rightIcon) {
      return <View style={styles.rightIconContainer}>{rightIcon}</View>;
    }

    return null;
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, labelStyle, disabled && styles.labelDisabled]}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
          {labelAccessory ? <View style={styles.labelAccessory}>{labelAccessory}</View> : null}
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
          },
          isFocused && styles.inputFocused,
          disabled && styles.inputDisabled,
          inputContainerStyle,
        ]}
      >
        {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}
        <TextInput
          style={[styles.input, inputStyle, disabled && styles.inputTextDisabled]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? (disabled ? '#D1D5DB' : '#94A3B8')}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          secureTextEntry={type === 'password' && !isPasswordVisible}
          keyboardType={
            type === 'email' ? 'email-address' : type === 'number' ? 'numeric' : 'default'
          }
          maxLength={maxLength}
          editable={!disabled}
          autoCapitalize={type === 'email' ? 'none' : 'sentences'}
        />
        {renderRightIcon()}
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
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelAccessory: {
    marginLeft: 'auto',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  labelDisabled: {
    color: '#9CA3AF',
  },
  required: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#FFFFFF',
  },
  inputFocused: {
    borderColor: '#0003B8',
  },
  inputDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  inputTextDisabled: {
    color: '#9CA3AF',
  },
  leftIconContainer: {
    marginRight: 12,
  },
  rightIconContainer: {
    marginLeft: 12,
  },
  iconButton: {
    padding: 4,
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
