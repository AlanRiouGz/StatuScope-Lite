import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

export type FileUploadState = 'empty' | 'dragging' | 'uploaded' | 'error';

export interface FileUploadDropzoneProps {
  label?: string;
  description?: string;
  supportedFormats?: string;
  maxSizeText?: string;
  browseLabel?: string;
  upToLabel?: string;
  state?: FileUploadState;
  fileName?: string;
  error?: string;
  onBrowsePress?: () => void;
  style?: ViewStyle;
}

export function FileUploadDropzone({
  label,
  description = 'Drag and drop files or',
  supportedFormats = 'PDF, JPG, PNG',
  maxSizeText = '10MB',
  browseLabel = 'browse',
  upToLabel = 'up to',
  state = 'empty',
  fileName,
  error,
  onBrowsePress,
  style,
}: FileUploadDropzoneProps) {
  const isUploaded = state === 'uploaded' && fileName;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.container,
          state === 'dragging' && styles.containerDragging,
          state === 'uploaded' && styles.containerUploaded,
          state === 'error' && styles.containerError,
        ]}
      >
        <View style={styles.iconWrap}>
          {state === 'uploaded' ? (
            <Feather name="check-circle" size={24} color="#16A34A" />
          ) : state === 'error' ? (
            <Feather name="alert-circle" size={24} color="#DC2626" />
          ) : (
            <Feather name="upload-cloud" size={24} color="#94A3B8" />
          )}
        </View>

        {isUploaded ? (
          <Text style={styles.fileName}>{fileName}</Text>
        ) : (
          <>
            <View style={styles.browseRow}>
              <Text style={styles.description}>{description} </Text>
              <TouchableOpacity onPress={onBrowsePress} activeOpacity={0.75}>
                <Text style={styles.browseLink}>{browseLabel}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.formatText}>
              {supportedFormats} {upToLabel} {maxSizeText}
            </Text>
          </>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  container: {
    minHeight: 96,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    borderColor: '#D9E2F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  containerDragging: {
    borderColor: '#0003B8',
    backgroundColor: '#EEF2FF',
  },
  containerUploaded: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  containerError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  iconWrap: {
    marginBottom: 12,
  },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  browseLink: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#0003B8',
  },
  formatText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
    textAlign: 'center',
  },
  fileName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: '#DC2626',
  },
});
