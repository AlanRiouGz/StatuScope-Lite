import React, { useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AssistantInputBar } from '@/components/diagnosis/AssistantInputBar';
import { FileUploadState, PatientEvaluationForm } from '@/components/diagnosis/PatientEvaluationForm';
import { Button } from '@/components/foundation/Button';
import { useAuth } from '@/contexts/AuthContext';
import { initialsFromName } from '@/lib/format';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CardBase } from '@/components/patterns/CardBase';
import { ApiError } from '@/lib/api';
import { AssistantContext, AssistantMessage, AssistantSuggestion, OutbreakSummary, } from '@/lib/diagnosisAssistant';
import { AssistantFeedbackDecision, DiagnosisEvaluation, createDiagnosisEvaluation, getCurrentDiagnosisEvaluation, submitAssistantFeedback, updateDiagnosisEvaluation, uploadDiagnosisEvaluationFile, } from '@/lib/diagnosisEvaluation';
import { InputField } from '@/components/inputs/InputField';
import { TextareaField } from '@/components/inputs/TextareaField';
import { DiagnosisDiseaseOption, searchDiagnosisDiseases } from '@/lib/diagnosisDiseases';
import { translateDiseaseName } from '@/lib/diseaseLocalization';
import { useTranslation } from '@/i18n';
const navigationLinks = {
    dashboard: '/dashboard/doctor',
    diagnosis: '/diagnosis',
    analytics: '/analytics',
} as const;
interface PickedDiagnosisFile {
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    contentBase64: string;
}
function formatBirthDateInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) {
        return digits;
    }
    if (digits.length <= 6) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
type TranslateFn = (key: string, params?: Record<string, string | number | null | undefined>) => string;
const OTHER_DISEASE_ID = '__other_disease__';
type LocalAlertGroup = ReturnType<typeof buildLocalAlertGroups>[number];
function formatCaseMeta(evaluation: DiagnosisEvaluation | null, t: TranslateFn): string {
    if (!evaluation) {
        return t('doctor.diagnosis.caseMeta.new');
    }
    const shortId = evaluation.id.slice(0, 8).toUpperCase();
    const startedLabel = new Date(evaluation.createdAt).toLocaleString();
    return t('doctor.diagnosis.caseMeta.saved', { id: shortId, date: startedLabel });
}
function deriveDropzoneState(isUploading: boolean, uploadError: string | null, evaluation: DiagnosisEvaluation | null): FileUploadState {
    if (uploadError)
        return 'error';
    if (isUploading)
        return 'dragging';
    if ((evaluation?.files?.length ?? 0) > 0)
        return 'uploaded';
    return 'empty';
}
async function pickDiagnosisFile(t: TranslateFn): Promise<PickedDiagnosisFile | null> {
    if (typeof document === 'undefined') {
        throw new Error(t('doctor.diagnosis.errors.webUploadOnly'));
    }
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.jpg,.jpeg,.png,.dcm,.dicom,application/pdf,image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            // The mock stores metadata only, so even large attachments stay out of memory.
            resolve({ fileName: file.name, mimeType: file.type || 'application/octet-stream',
                fileSizeBytes: file.size, contentBase64: '' });

        };
        input.click();
    });
}
function findLatestAssistantMessage(messages: AssistantMessage[]): AssistantMessage | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === 'assistant') {
            return messages[index] ?? null;
        }
    }
    return null;
}
function hasUnreviewedSuggestion(messages: AssistantMessage[]): boolean {
    return !!findLatestAssistantMessage(messages)?.suggestions?.length;
}
function formatFeedbackStatus(decision: string | null | undefined, t: TranslateFn): string | null {
    if (!decision)
        return null;
    if (decision === 'ASSISTANT_ACCEPTED')
        return t('doctor.diagnosis.feedback.status.confirmed');
    if (decision === 'ASSISTANT_REJECTED_DOCTOR_OVERRIDE')
        return t('doctor.diagnosis.feedback.status.overridden');
    if (decision === 'DOCTOR_ONLY')
        return t('doctor.diagnosis.feedback.status.doctorOnly');
    return null;
}
function formatRiskLevelLabel(riskLevel: string | null | undefined, t: TranslateFn): string {
    const normalized = riskLevel?.trim().toUpperCase();
    if (normalized === 'HIGH')
        return t('doctor.diagnosis.riskLevels.high');
    if (normalized === 'MEDIUM')
        return t('doctor.diagnosis.riskLevels.medium');
    if (normalized === 'LOW')
        return t('doctor.diagnosis.riskLevels.low');
    if (normalized === 'NONE')
        return t('doctor.diagnosis.riskLevels.none');
    return t('doctor.diagnosis.suggestions.unknown');
}
function localAlertTone(riskLevel: string | null | undefined) {
    const normalized = riskLevel?.trim().toUpperCase();
    if (normalized === 'HIGH') {
        return {
            cardBackground: '#FFF7F7',
            cardBorder: '#FECACA',
            badgeBackground: '#FFE4E6',
            badgeText: '#9F1239',
            accent: '#E11D48',
        };
    }
    if (normalized === 'MEDIUM') {
        return {
            cardBackground: '#FFFBF0',
            cardBorder: '#FED7AA',
            badgeBackground: '#FFEDD5',
            badgeText: '#9A3412',
            accent: '#EA580C',
        };
    }
    if (normalized === 'LOW') {
        return {
            cardBackground: '#F0F9FF',
            cardBorder: '#BAE6FD',
            badgeBackground: '#E0F2FE',
            badgeText: '#075985',
            accent: '#0284C7',
        };
    }
    return {
        cardBackground: '#F8FAFC',
        cardBorder: '#CBD5E1',
        badgeBackground: '#F1F5F9',
        badgeText: '#475569',
        accent: '#64748B',
    };
}
function normalizedSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function buildLocalAlertGroups(suggestions: AssistantSuggestion[], outbreaks: OutbreakSummary[], t: TranslateFn) {
    return suggestions.map((suggestion) => {
        const suggestionName = normalizedSearchText(suggestion.displayName);
        const translatedSuggestionName = normalizedSearchText(translateDiseaseName(t, suggestion.displayName));
        const relatedOutbreaks = outbreaks
            .filter((outbreak) => {
            const outbreakName = normalizedSearchText(outbreak.diseaseName);
            const translatedOutbreakName = normalizedSearchText(translateDiseaseName(t, outbreak.diseaseName));
            return outbreakName === suggestionName
                || outbreakName === translatedSuggestionName
                || translatedOutbreakName === suggestionName
                || translatedOutbreakName === translatedSuggestionName;
        })
            .sort((a, b) => b.caseCount - a.caseCount);
        const totalCases = relatedOutbreaks.reduce((sum, outbreak) => sum + outbreak.caseCount, 0);
        const municipalityRows = relatedOutbreaks
            .filter((outbreak) => outbreak.municipalityName)
            .slice(0, 5);
        const stateRows = relatedOutbreaks
            .filter((outbreak) => !outbreak.municipalityName && outbreak.stateName)
            .slice(0, 5);
        return {
            suggestion,
            relatedOutbreaks,
            totalCases,
            municipalityRows,
            stateRows,
            summary: municipalityRows.length
                ? municipalityRows
                    .map((outbreak) => `${outbreak.municipalityName} (${outbreak.caseCount})`)
                    .join(', ')
                : t('doctor.diagnosis.localAlerts.stateOnly'),
        };
    });
}
export function DoctorDiagnosis() {
    const router = useRouter();
    const { logout, profile } = useAuth();
    const { language, t } = useTranslation();
    const [evaluation, setEvaluation] = useState<DiagnosisEvaluation | null>(null);
    const [formPanelHeight, setFormPanelHeight] = useState<number | null>(null);
    const [isFinalizeExpanded, setIsFinalizeExpanded] = useState(true);
    const [patientName, setPatientName] = useState('');
    const [patientBirthDate, setPatientBirthDate] = useState('');
    const [patientSex, setPatientSex] = useState('');
    const [symptoms, setSymptoms] = useState('');
    const [assistantQuery, setAssistantQuery] = useState('');
    const [diseaseSearchQuery, setDiseaseSearchQuery] = useState('');
    const [diseaseCatalog, setDiseaseCatalog] = useState<DiagnosisDiseaseOption[]>([]);
    const [diseaseOptions, setDiseaseOptions] = useState<DiagnosisDiseaseOption[]>([]);
    const [selectedDiseaseId, setSelectedDiseaseId] = useState<string>('');
    const [selectedDiseaseName, setSelectedDiseaseName] = useState('');
    const [customDiseaseName, setCustomDiseaseName] = useState('');
    const [finalizeChoice, setFinalizeChoice] = useState<'ai' | 'catalog'>('catalog');
    const [selectedLocalAlert, setSelectedLocalAlert] = useState<LocalAlertGroup | null>(null);
    const [isDiseaseSearchEditing, setIsDiseaseSearchEditing] = useState(false);
    const [feedbackNotes, setFeedbackNotes] = useState('');
    const [chatHistory, setChatHistory] = useState<AssistantMessage[]>([]);
    const [contextUsed, setContextUsed] = useState<AssistantContext | null>(null);
    const [assistantError, setAssistantError] = useState<string | null>(null);
    const [evaluationError, setEvaluationError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
    const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);
    const isDiseaseOptionPressingRef = useRef(false);
    const diseaseSearchQueryRef = useRef(diseaseSearchQuery);
    const selectedDiseaseIdRef = useRef(selectedDiseaseId);
    const selectedDiseaseNameRef = useRef(selectedDiseaseName);
    const customDiseaseNameRef = useRef(customDiseaseName);
    useEffect(() => {
        diseaseSearchQueryRef.current = diseaseSearchQuery;
    }, [diseaseSearchQuery]);
    useEffect(() => {
        selectedDiseaseIdRef.current = selectedDiseaseId;
    }, [selectedDiseaseId]);
    useEffect(() => {
        selectedDiseaseNameRef.current = selectedDiseaseName;
    }, [selectedDiseaseName]);
    useEffect(() => {
        customDiseaseNameRef.current = customDiseaseName;
    }, [customDiseaseName]);
    useEffect(() => {
        let isActive = true;
        const hydrateExistingSession = async () => {
            try {
                const currentEvaluation = await getCurrentDiagnosisEvaluation();
                if (!isActive)
                    return;
                setEvaluation(currentEvaluation);
                setPatientName(currentEvaluation.patient.fullName ?? '');
                setPatientBirthDate(currentEvaluation.patient.birthDate ?? '');
                setPatientSex(currentEvaluation.patient.sex ?? '');
                setSymptoms(currentEvaluation.symptomsText ?? '');
            }
            catch (error) {
                if (error instanceof ApiError && error.status === 404) {
                    return;
                }
                if (!isActive)
                    return;
                setEvaluationError(error instanceof Error ? error.message : t('doctor.diagnosis.errors.restoreEvaluation'));
            }
        };
        void hydrateExistingSession();
        return () => {
            isActive = false;
        };
    }, []);
    useEffect(() => {
        let isActive = true;
        const loadDiseaseCatalog = async () => {
            try {
                const seedQueries = ['', 'a', 'e', 'i', 'o', 'u'];
                const results = await Promise.all(seedQueries.map((query) => searchDiagnosisDiseases(query, 250)));
                if (!isActive)
                    return;
                const deduped = new Map<string, DiagnosisDiseaseOption>();
                results.flat().forEach((option) => deduped.set(option.id, option));
                setDiseaseCatalog([...deduped.values()]);
            }
            catch (error) {
                if (!isActive)
                    return;
                setFeedbackError(error instanceof Error ? error.message : t('doctor.diagnosis.errors.loadDiseases'));
            }
        };
        void loadDiseaseCatalog();
        return () => {
            isActive = false;
        };
    }, [t]);
    useEffect(() => {
        const query = normalizedSearchText(diseaseSearchQuery.trim());
        const filtered = diseaseCatalog.filter((option) => {
            const localizedName = translateDiseaseName(t, option.name);
            return !query
                || normalizedSearchText(localizedName).includes(query)
                || normalizedSearchText(option.name).includes(query)
                || normalizedSearchText(option.code).includes(query);
        });
        setDiseaseOptions(filtered.sort((a, b) => translateDiseaseName(t, a.name).localeCompare(translateDiseaseName(t, b.name), language)));
    }, [diseaseCatalog, diseaseSearchQuery, language, t]);
    useEffect(() => {
        if (!selectedDiseaseId && evaluation?.finalDiagnosisLabel && !evaluation.finalDiseaseId) {
            setSelectedDiseaseId(OTHER_DISEASE_ID);
            setCustomDiseaseName(evaluation.finalDiagnosisLabel);
            setFinalizeChoice('catalog');
        }
    }, [evaluation?.finalDiagnosisLabel, evaluation?.finalDiseaseId, selectedDiseaseId]);
    useEffect(() => {
        if (!evaluation?.finalDiseaseId || selectedDiseaseId) {
            return;
        }
        setSelectedDiseaseId(evaluation.finalDiseaseId);
        setSelectedDiseaseName(evaluation.finalDiseaseName ?? evaluation.finalDiagnosisLabel ?? '');
        setDiseaseSearchQuery(evaluation.finalDiseaseName ?? evaluation.finalDiagnosisLabel ?? '');
        setFinalizeChoice('catalog');
        setFeedbackNotes(evaluation.doctorFeedbackNotes ?? '');
    }, [
        evaluation?.doctorFeedbackNotes,
        evaluation?.finalDiagnosisLabel,
        evaluation?.finalDiseaseId,
        evaluation?.finalDiseaseName,
        selectedDiseaseId,
    ]);
    useEffect(() => {
        const latestAssistantMessage = findLatestAssistantMessage(chatHistory);
        const primarySuggestion = latestAssistantMessage?.suggestions?.find((suggestion) => suggestion.primary)
            ?? latestAssistantMessage?.suggestions?.[0];
        if (!primarySuggestion?.diseaseId || selectedDiseaseId) {
            return;
        }
        setSelectedDiseaseId(primarySuggestion.diseaseId);
        setSelectedDiseaseName(primarySuggestion.displayName);
        setFinalizeChoice('ai');
    }, [chatHistory, selectedDiseaseId]);
    useEffect(() => {
        if (evaluation?.finalDecisionSource || hasUnreviewedSuggestion(chatHistory)) {
            setIsFinalizeExpanded(true);
        }
    }, [evaluation?.finalDecisionSource, chatHistory]);
    const handleBirthDateChange = (value: string) => {
        setPatientBirthDate(formatBirthDateInput(value));
    };
    const hydrateForm = (nextEvaluation: DiagnosisEvaluation) => {
        setEvaluation(nextEvaluation);
        setPatientName(nextEvaluation.patient.fullName ?? '');
        setPatientBirthDate(nextEvaluation.patient.birthDate ?? '');
        setPatientSex(nextEvaluation.patient.sex ?? '');
        setSymptoms(nextEvaluation.symptomsText ?? '');
        if (nextEvaluation.finalDiseaseId) {
            setSelectedDiseaseId(nextEvaluation.finalDiseaseId);
            setSelectedDiseaseName(nextEvaluation.finalDiseaseName ?? nextEvaluation.finalDiagnosisLabel ?? '');
            setDiseaseSearchQuery(nextEvaluation.finalDiseaseName ?? nextEvaluation.finalDiagnosisLabel ?? '');
            setFinalizeChoice('catalog');
        }
        if (nextEvaluation.doctorFeedbackNotes != null) {
            setFeedbackNotes(nextEvaluation.doctorFeedbackNotes);
        }
    };
    const persistEvaluation = async (): Promise<DiagnosisEvaluation> => {
        if (!patientName.trim()) {
            throw new Error(t('doctor.diagnosis.validation.patientNameRequired'));
        }
        if (!patientBirthDate.trim()) {
            throw new Error(t('doctor.diagnosis.validation.birthDateRequired'));
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(patientBirthDate.trim())) {
            throw new Error(t('doctor.diagnosis.validation.birthDateFormat'));
        }
        if (!patientSex.trim()) {
            throw new Error(t('doctor.diagnosis.validation.sexRequired'));
        }
        if (!symptoms.trim()) {
            throw new Error(t('doctor.diagnosis.validation.symptomsRequired'));
        }
        setIsSavingEvaluation(true);
        setEvaluationError(null);
        try {
            const payload = {
                patientFullName: patientName.trim(),
                birthDate: patientBirthDate.trim(),
                sex: patientSex,
                symptomsText: symptoms.trim(),
            };
            const updatedEvaluation = evaluation
                ? await updateDiagnosisEvaluation(evaluation.id, payload)
                : await createDiagnosisEvaluation(payload);
            hydrateForm(updatedEvaluation);
            return updatedEvaluation;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : t('doctor.diagnosis.errors.saveEvaluation');
            setEvaluationError(message);
            throw error;
        }
        finally {
            setIsSavingEvaluation(false);
        }
    };
    const handleSendPress = () => { };
    const handleSaveDraftPress = async () => {
        try {
            await persistEvaluation();
            setFeedbackSuccess('Borrador de ejemplo guardado en esta pestaña.');
        }
        catch (error) {
            setEvaluationError(error instanceof Error ? error.message : 'No se pudo guardar el ejemplo.');
        }
    };
    const handleUploadPress = async () => {
        setUploadError(null);
        try {
            const selectedFile = await pickDiagnosisFile(t);
            if (!selectedFile)
                return;
            const activeEvaluation = await persistEvaluation();
            setIsUploadingFile(true);
            const updatedEvaluation = await uploadDiagnosisEvaluationFile(activeEvaluation.id, {
                ...selectedFile,
                documentType: 'LAB_RESULT',
            });
            hydrateForm(updatedEvaluation);
        }
        catch (error) {
            setUploadError(error instanceof Error ? error.message : t('doctor.diagnosis.errors.uploadFile'));
        }
        finally {
            setIsUploadingFile(false);
        }
    };
    const handleSelectDisease = (option: DiagnosisDiseaseOption) => {
        setSelectedDiseaseId(option.id);
        setSelectedDiseaseName(option.name);
        setDiseaseSearchQuery(translateDiseaseName(t, option.name));
        setCustomDiseaseName('');
        setFinalizeChoice('catalog');
        setIsDiseaseSearchEditing(false);
        setTimeout(() => {
            isDiseaseOptionPressingRef.current = false;
        }, 0);
        setFeedbackError(null);
        setFeedbackSuccess(null);
    };
    const handleSelectOtherDisease = () => {
        setSelectedDiseaseId(OTHER_DISEASE_ID);
        setSelectedDiseaseName(t('doctor.diagnosis.finalize.otherDisease'));
        setCustomDiseaseName(diseaseSearchQuery.trim());
        setFinalizeChoice('catalog');
        setIsDiseaseSearchEditing(false);
        setTimeout(() => {
            isDiseaseOptionPressingRef.current = false;
        }, 0);
        setFeedbackError(null);
        setFeedbackSuccess(null);
    };
    const handleSubmitFeedback = async (decision: AssistantFeedbackDecision) => {
        if (!selectedDiseaseId) {
            setFeedbackError(t('doctor.diagnosis.feedback.selectDiseaseError'));
            setFeedbackSuccess(null);
            return;
        }
        if (selectedDiseaseId === OTHER_DISEASE_ID) {
            if (!customDiseaseName.trim()) {
                setFeedbackError(t('doctor.diagnosis.feedback.otherDiseaseRequired'));
                setFeedbackSuccess(null);
                return;
            }
            ;
        }
        try {
            const activeEvaluation = await persistEvaluation();
            const latestAssistantMessage = findLatestAssistantMessage(chatHistory);
            setIsSubmittingFeedback(true);
            setFeedbackError(null);
            setFeedbackSuccess(null);
            const updatedEvaluation = await submitAssistantFeedback(activeEvaluation.id, {
                finalDecisionSource: decision,
                finalDiseaseId: selectedDiseaseId === OTHER_DISEASE_ID ? undefined : selectedDiseaseId,
                finalDiagnosisLabel: selectedDiseaseId === OTHER_DISEASE_ID ? customDiseaseName.trim() : undefined,
                doctorFeedbackNotes: feedbackNotes.trim() || undefined,
                acceptedAssistantMessageId: decision === 'ASSISTANT_ACCEPTED' ? latestAssistantMessage?.id : undefined,
            });
            hydrateForm(updatedEvaluation);
            setFeedbackSuccess(decision === 'ASSISTANT_ACCEPTED'
                ? t('doctor.diagnosis.feedback.success.confirmed')
                : decision === 'ASSISTANT_REJECTED_DOCTOR_OVERRIDE'
                    ? t('doctor.diagnosis.feedback.success.overridden')
                    : t('doctor.diagnosis.feedback.success.doctorOnly'));
        }
        catch (error) {
            setFeedbackError(error instanceof Error ? error.message : t('doctor.diagnosis.errors.recordFeedback'));
            setFeedbackSuccess(null);
        }
        finally {
            setIsSubmittingFeedback(false);
        }
    };
    const latestFile = evaluation?.files?.[0] ?? null;
    const dropzoneState = deriveDropzoneState(isUploadingFile, uploadError, evaluation);
    const boundedChatHeight = formPanelHeight ?? 520;
    const feedbackStatusLabel = formatFeedbackStatus(evaluation?.finalDecisionSource, t);
    const selectedDiseaseDisplayName = translateDiseaseName(t, selectedDiseaseName);
    const submitFeedbackDecision: AssistantFeedbackDecision = 'DOCTOR_ONLY';
    const handleFormPanelLayout = (event: LayoutChangeEvent) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        setFormPanelHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    };
    return (<DashboardLayout active="diagnosis" sectionLabel={t('doctor.diagnosis.sectionLabel')} userName={profile?.fullName ?? t('doctor.diagnosis.fallbackDoctor')} userId={profile?.hospitalName ? profile.hospitalName : profile?.email} avatarText={initialsFromName(profile?.fullName)} links={navigationLinks} onLogout={async () => {
            await logout();
            router.replace('/login');
        }}>
      <ScrollView contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <View style={styles.heroStrip}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{t('doctor.diagnosis.hero.eyebrow')}</Text>
              <Text style={styles.heroTitle}>{'Evaluación de ejemplo'}</Text>
              <Text style={styles.heroDescription}>
                {'Explora el formulario con datos ficticios. Guarda cambios y registra una selección manual sin asistencia de IA.'}
              </Text>
            </View>

            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot}/>
              <Text style={styles.heroBadgeText}>
                {evaluation?.status
            ? t('doctor.diagnosis.hero.status', { status: evaluation.status.replace('_', ' ') })
            : t('doctor.diagnosis.hero.ready')}
              </Text>
            </View>
          </View>

          {evaluationError ? <Text style={styles.pageErrorText}>{evaluationError}</Text> : null}

          <View style={styles.workspace}>
            <View style={styles.formPanelWrap} onLayout={handleFormPanelLayout}>
              <PatientEvaluationForm title={t('doctor.diagnosis.form.title')} caseMeta={formatCaseMeta(evaluation, t)} patientNameLabel={t('doctor.diagnosis.form.patientName')} patientNamePlaceholder={t('doctor.diagnosis.form.patientNamePlaceholder')} birthDateLabel={t('doctor.diagnosis.form.birthDate')} sexLabel={t('doctor.diagnosis.form.sex')} sexPlaceholder={t('doctor.diagnosis.form.sexPlaceholder')} symptomsLabel={t('doctor.diagnosis.form.symptoms')} symptomsPlaceholder={t('doctor.diagnosis.form.symptomsPlaceholder')} filesLabel={t('doctor.diagnosis.form.files')} fileDescription={'Demo: solo se conserva el nombre del archivo en esta pestaña; no se envía ningún documento.'} fileBrowseLabel={t('doctor.diagnosis.form.fileBrowse')} fileUpToLabel={t('doctor.diagnosis.form.fileUpTo')} sexOptions={[
            { label: t('doctor.diagnosis.form.sexOptions.male'), value: 'male' },
            { label: t('doctor.diagnosis.form.sexOptions.female'), value: 'female' },
            { label: t('doctor.diagnosis.form.sexOptions.other'), value: 'other' },
        ]} patientNameValue={patientName} birthDateValue={patientBirthDate} sexValue={patientSex} symptomsValue={symptoms} dropzoneState={dropzoneState} uploadedFileName={latestFile?.fileName ?? undefined} dropzoneError={uploadError ?? undefined} primaryButtonLabel={(isSavingEvaluation ? 'Guardando...' : 'Guardar borrador demo')} primaryButtonDisabled={isAssistantLoading || isSavingEvaluation} secondaryButtonDisabled={isSavingEvaluation || isAssistantLoading} showSecondaryAction={false} onPatientNameChange={setPatientName} onBirthDateChange={handleBirthDateChange} onSexChange={setPatientSex} onSymptomsChange={setSymptoms} onBrowsePress={handleUploadPress} onPrimaryActionPress={handleSaveDraftPress} onSecondaryActionPress={handleSaveDraftPress} style={styles.formPanel}/>
            </View>

            <View style={styles.rightColumn}>
              <CardBase style={[styles.chatCard, { height: boundedChatHeight }]}>
                <View style={styles.chatHeader}>
                  <View style={styles.chatTitleGroup}>
                    <View style={styles.chatIconWrap}>
                      <MaterialCommunityIcons name="brain" size={18} color="#0003B8"/>
                    </View>

                    <View style={styles.chatCopy}>
                      <Text style={styles.chatTitle}>{t('doctor.diagnosis.assistant.title')}</Text>
                      <Text style={styles.chatSubtitle}>
                        {'IA deshabilitada. Puedes guardar el formulario y registrar una selección manual de ejemplo.'}
                      </Text>
                    </View>
                  </View>

                  {isAssistantLoading ? (<View style={styles.liveBadge}>
                      <View style={styles.liveBadgeDot}/>
                      <Text style={styles.liveBadgeText}>{t('doctor.diagnosis.assistant.thinking')}</Text>
                    </View>) : null}
                </View>

                <ScrollView style={styles.chatBody} contentContainerStyle={styles.chatBodyContent} showsVerticalScrollIndicator={false}>
                  {(<View style={styles.emptyState}>
                      <MaterialCommunityIcons name="stethoscope" size={24} color="#0003B8"/>
                      <Text style={styles.emptyTitle}>{'Asistente deshabilitado'}</Text>
                      <Text style={styles.emptyText}>
                        {'Esta demostración permite explorar el formulario y el catálogo. No genera diagnósticos ni respuestas de IA.'}
                      </Text>
                    </View>)}

                  {isAssistantLoading ? (<View style={styles.loadingRow}>
                      <ActivityIndicator color="#0003B8"/>
                      <Text style={styles.loadingText}>{t('doctor.diagnosis.assistant.consulting')}</Text>
                    </View>) : null}

                  {assistantError ? (<Text style={styles.errorText}>{assistantError}</Text>) : null}
                </ScrollView>

                <View style={styles.chatFooter}>
                  <AssistantInputBar value={assistantQuery} placeholder={t('doctor.diagnosis.assistant.inputPlaceholder')} onChangeText={setAssistantQuery} onSendPress={handleSendPress} disabled={true}/>

                  <View style={styles.finalizeSection}>
                    <TouchableOpacity style={styles.finalizeHeader} activeOpacity={0.82} onPress={() => setIsFinalizeExpanded((current) => !current)}>
                      <View style={styles.finalizeHeaderCopy}>
                        <Text style={styles.finalizeTitle}>{t('doctor.diagnosis.finalize.title')}</Text>
                        <Text style={styles.finalizeSubtitle}>
                          {'Selecciona una enfermedad para guardar un registro ficticio de forma manual.'}
                        </Text>
                      </View>

                      <View style={styles.finalizeHeaderMeta}>
                        {feedbackStatusLabel ? (<View style={styles.feedbackStatusChip}>
                            <Text style={styles.feedbackStatusChipText}>{feedbackStatusLabel}</Text>
                          </View>) : null}
                        {evaluation?.finalDiseaseName ? (<View style={styles.finalizedBadge}>
                            <Text style={styles.finalizedBadgeText}>{evaluation.finalDiseaseName}</Text>
                          </View>) : null}
                        <View style={styles.finalizeChevronWrap}>
                          <Feather name={isFinalizeExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B"/>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isFinalizeExpanded ? (<>
                        <View style={styles.finalizeChoiceGrid}>
                          {false}

                          <View style={[
                styles.finalizeChoiceCard,
                finalizeChoice === 'catalog' && styles.finalizeChoiceCardSelected,
            ]}>
                            <View style={styles.finalizeChoiceHeader}>
                              <Text style={styles.suggestionSummaryEyebrow}>
                                {t('doctor.diagnosis.finalize.selectAnotherDisease')}
                              </Text>
                              {finalizeChoice === 'catalog' ? (<Feather name="check-circle" size={17} color="#0003B8"/>) : null}
                            </View>

                            <InputField placeholder={t('doctor.diagnosis.finalize.searchPlaceholder')} value={diseaseSearchQuery} onChangeText={(value) => {
                setDiseaseSearchQuery(value);
                setIsDiseaseSearchEditing(true);
                setFinalizeChoice('catalog');
            }} onFocus={() => {
                if (selectedDiseaseId && !isDiseaseSearchEditing) {
                    setDiseaseSearchQuery('');
                    setIsDiseaseSearchEditing(true);
                }
            }} onBlur={() => {
                setTimeout(() => {
                    if (isDiseaseOptionPressingRef.current) {
                        return;
                    }
                    if (!diseaseSearchQueryRef.current.trim() && selectedDiseaseNameRef.current) {
                        setDiseaseSearchQuery(selectedDiseaseIdRef.current === OTHER_DISEASE_ID
                            ? customDiseaseNameRef.current
                            : translateDiseaseName(t, selectedDiseaseNameRef.current));
                        setIsDiseaseSearchEditing(false);
                    }
                }, 120);
            }} leftIcon={<Feather name="search" size={16} color="#64748B"/>} style={styles.diseaseSearchField} inputContainerStyle={styles.diseaseSearchInputContainer}/>

                            {diseaseOptions.length ? (<ScrollView style={styles.diseaseResultsList} nestedScrollEnabled>
                                {diseaseOptions.map((option, index) => {
                    const localizedName = translateDiseaseName(t, option.name);
                    return (<TouchableOpacity key={option.id} style={[
                            styles.diseaseResultRow,
                            index === diseaseOptions.length - 1 && styles.diseaseResultRowLast,
                            option.id === selectedDiseaseId && styles.diseaseResultRowSelected,
                        ]} activeOpacity={0.8} onPressIn={() => {
                            isDiseaseOptionPressingRef.current = true;
                        }} onPress={() => handleSelectDisease(option)}>
                                      <View style={styles.diseaseResultCopy}>
                                        <Text style={[
                            styles.diseaseResultName,
                            option.id === selectedDiseaseId && styles.diseaseResultNameSelected,
                        ]}>
                                          {localizedName}
                                        </Text>
                                      </View>
                                      {option.id === selectedDiseaseId ? (<Feather name="check-circle" size={16} color="#0003B8"/>) : null}
                                    </TouchableOpacity>);
                })}
                                <TouchableOpacity style={[
                    styles.diseaseResultRow,
                    styles.diseaseResultRowLast,
                    selectedDiseaseId === OTHER_DISEASE_ID && styles.diseaseResultRowSelected,
                ]} activeOpacity={0.8} onPressIn={() => {
                    isDiseaseOptionPressingRef.current = true;
                }} onPress={handleSelectOtherDisease}>
                                  <View style={styles.diseaseResultCopy}>
                                    <Text style={[
                    styles.diseaseResultName,
                    selectedDiseaseId === OTHER_DISEASE_ID && styles.diseaseResultNameSelected,
                ]}>
                                      {t('doctor.diagnosis.finalize.otherDisease')}
                                    </Text>
                                  </View>
                                  {selectedDiseaseId === OTHER_DISEASE_ID ? (<Feather name="check-circle" size={16} color="#0003B8"/>) : null}
                                </TouchableOpacity>
                              </ScrollView>) : (<TouchableOpacity style={[styles.diseaseResultRow, styles.diseaseResultRowSelected]} activeOpacity={0.8} onPressIn={() => {
                    isDiseaseOptionPressingRef.current = true;
                }} onPress={handleSelectOtherDisease}>
                                <View style={styles.diseaseResultCopy}>
                                  <Text style={styles.diseaseResultName}>{t('doctor.diagnosis.finalize.otherDisease')}</Text>
                                </View>
                              </TouchableOpacity>)}
                          </View>
                        </View>

                        {selectedDiseaseName ? (<View style={styles.selectedDiseasePill}>
                            <Text style={styles.selectedDiseaseLabel}>{t('doctor.diagnosis.finalize.selectedDisease')}</Text>
                            {selectedDiseaseId === OTHER_DISEASE_ID ? (<InputField placeholder={t('doctor.diagnosis.finalize.otherDiseasePlaceholder')} value={customDiseaseName} onChangeText={setCustomDiseaseName} style={styles.customDiseaseField} inputContainerStyle={styles.customDiseaseInputContainer}/>) : (<Text style={styles.selectedDiseaseValue}>{selectedDiseaseDisplayName}</Text>)}
                          </View>) : null}

                        <TextareaField placeholder={t('doctor.diagnosis.finalize.notesPlaceholder')} value={feedbackNotes} onChangeText={(value) => {
                setFeedbackNotes(value);
                setFeedbackSuccess(null);
            }} numberOfLines={2} style={styles.feedbackNotesField}/>

                        {isSubmittingFeedback ? (<View style={styles.feedbackInfoBanner}>
                            <ActivityIndicator size="small" color="#0003B8"/>
                            <Text style={styles.feedbackInfoText}>{t('doctor.diagnosis.feedback.saving')}</Text>
                          </View>) : null}

                        {feedbackSuccess ? (<View style={styles.feedbackSuccessBanner}>
                            <Feather name="check-circle" size={16} color="#166534"/>
                            <Text style={styles.feedbackSuccessText}>{feedbackSuccess}</Text>
                          </View>) : null}

                        {feedbackError ? <Text style={styles.errorText}>{feedbackError}</Text> : null}

                        <View style={styles.finalizeActions}>
                          <Button label={isSubmittingFeedback
                ? t('doctor.diagnosis.actions.saving')
                : t('doctor.diagnosis.finalize.saveFinal')} size="md" variant="primary" disabled={isSubmittingFeedback || isAssistantLoading || isSavingEvaluation} onPress={() => {
                void handleSubmitFeedback(submitFeedbackDecision);
            }} style={styles.doctorOnlyButton}/>
                        </View>
                      </>) : null}
                  </View>
                </View>
              </CardBase>
            </View>
          </View>
        </View>
      </ScrollView>
      <DiagnosisLocalAlertOverlay alertGroup={selectedLocalAlert} visible={selectedLocalAlert !== null} onClose={() => setSelectedLocalAlert(null)} t={t}/>
    </DashboardLayout>);
}
export default DoctorDiagnosis;
function DiagnosisLocalAlertOverlay({ alertGroup, visible, onClose, t, }: {
    alertGroup: LocalAlertGroup | null;
    visible: boolean;
    onClose: () => void;
    t: TranslateFn;
}) {
    if (!alertGroup)
        return null;
    const tone = localAlertTone(alertGroup.suggestion.localityRiskLevel);
    const diseaseName = translateDiseaseName(t, alertGroup.suggestion.displayName);
    return (<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.alertOverlay}>
        <Pressable style={styles.alertOverlayBackdrop} onPress={onClose}/>
        <CardBase style={styles.alertDialog}>
          <View style={styles.alertDialogHeader}>
            <View style={styles.alertDialogCopy}>
              <Text style={styles.alertDialogEyebrow}>{t('doctor.diagnosis.suggestions.heading')}</Text>
              <Text style={styles.alertDialogTitle}>{diseaseName}</Text>
              {alertGroup.suggestion.rationale ? (<Text style={styles.alertDialogSubtitle}>{alertGroup.suggestion.rationale}</Text>) : null}
            </View>
            <TouchableOpacity style={styles.alertDialogCloseButton} onPress={onClose} activeOpacity={0.78}>
              <Feather name="x" size={18} color="#64748B"/>
            </TouchableOpacity>
          </View>

          <View style={styles.alertDialogBody}>
            <View style={styles.alertDialogMetricsGrid}>
              <CardBase style={[styles.alertDialogMetricCard, { borderColor: `${tone.accent}24` }]}>
                <View style={[styles.alertDialogMetricAccent, { backgroundColor: tone.accent }]}/>
                <Text style={styles.alertDialogMetricLabel}>{t('doctor.diagnosis.localAlerts.totalCases')}</Text>
                <Text style={styles.alertDialogMetricValue}>
                  {t('doctor.diagnosis.localAlerts.cases', { count: alertGroup.totalCases })}
                </Text>
              </CardBase>
              <CardBase style={[styles.alertDialogMetricCard, { borderColor: `${tone.accent}24` }]}>
                <View style={[styles.alertDialogMetricAccent, { backgroundColor: tone.accent }]}/>
                <Text style={styles.alertDialogMetricLabel}>{t('doctor.diagnosis.suggestions.localityRisk')}</Text>
                <Text style={styles.alertDialogMetricValue}>
                  {formatRiskLevelLabel(alertGroup.suggestion.localityRiskLevel, t)}
                </Text>
              </CardBase>
            </View>

            <View style={styles.alertDialogInsightsSection}>
              <View style={styles.alertDialogInsightsHeader}>
                <Text style={styles.alertDialogInsightsTitle}>{t('doctor.diagnosis.localAlerts.stateDetailTitle')}</Text>
              </View>
              <View style={styles.alertDialogInsightsList}>
                {alertGroup.stateRows.length ? (alertGroup.stateRows.map((outbreak, index) => (<AlertInsightRow key={`${outbreak.diseaseName}-${outbreak.stateName}-${outbreak.caseCount}-${index}`} icon="map" color={tone.accent} label={outbreak.stateName ?? t('doctor.diagnosis.suggestions.unknown')} value={t('doctor.diagnosis.localAlerts.cases', { count: outbreak.caseCount })}/>))) : (<Text style={styles.localAlertDetailText}>{t('doctor.diagnosis.localAlerts.stateOnly')}</Text>)}
              </View>
            </View>

            <View style={styles.alertDialogInsightsSection}>
              <View style={styles.alertDialogInsightsHeader}>
                <Text style={styles.alertDialogInsightsTitle}>{t('doctor.diagnosis.localAlerts.detailTitle')}</Text>
              </View>
              <View style={styles.alertDialogInsightsList}>
                {alertGroup.municipalityRows.length ? (alertGroup.municipalityRows.map((outbreak, index) => (<AlertInsightRow key={`${outbreak.diseaseName}-${outbreak.municipalityName}-${outbreak.caseCount}-${index}`} icon="map-pin" color={tone.accent} label={outbreak.municipalityName ?? t('doctor.diagnosis.suggestions.unknown')} value={t('doctor.diagnosis.localAlerts.cases', { count: outbreak.caseCount })}/>))) : (<Text style={styles.localAlertDetailText}>{alertGroup.summary}</Text>)}
              </View>
            </View>
          </View>
        </CardBase>
      </View>
    </Modal>);
}
function AlertInsightRow({ icon, color, label, value, }: {
    icon: keyof typeof Feather.glyphMap;
    color: string;
    label: string;
    value: string;
}) {
    return (<View style={[styles.alertInsightRow, { borderColor: `${color}1F` }]}>
      <View style={[styles.alertInsightIcon, { borderColor: `${color}33`, backgroundColor: `${color}12` }]}>
        <Feather name={icon} size={16} color={color}/>
      </View>
      <View style={styles.alertInsightCopy}>
        <Text style={styles.alertInsightTitle}>{label}</Text>
        <Text style={styles.alertInsightValue}>{value}</Text>
      </View>
    </View>);
}
const styles = StyleSheet.create({
    pageScrollContent: {
        paddingBottom: 32,
    },
    contentContainer: {
        padding: 24,
    },
    heroStrip: {
        marginBottom: 24,
        paddingHorizontal: 24,
        paddingVertical: 22,
        borderRadius: 24,
        backgroundColor: '#F8FAFF',
        borderWidth: 1,
        borderColor: 'rgba(0, 3, 184, 0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000F6B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 26,
        elevation: 4,
    },
    heroCopy: {
        flex: 1,
        paddingRight: 24,
    },
    heroEyebrow: {
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: '#0003B8',
        marginBottom: 8,
    },
    heroTitle: {
        fontSize: 26,
        lineHeight: 34,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
        maxWidth: 720,
    },
    heroDescription: {
        fontSize: 15,
        lineHeight: 24,
        color: '#475569',
        maxWidth: 760,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    heroBadgeDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        backgroundColor: '#22C55E',
    },
    heroBadgeText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: '#334155',
    },
    workspace: {
        flexDirection: 'row',
        gap: 24,
        alignItems: 'stretch',
    },
    pageErrorText: {
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#FEF2F2',
        color: '#B91C1C',
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '600',
    },
    formPanelWrap: {
        width: 340,
        flexShrink: 0,
    },
    formPanel: {
        width: '100%',
    },
    rightColumn: {
        flex: 1,
        minHeight: 0,
    },
    chatCard: {
        flex: 1,
        padding: 0,
        overflow: 'hidden',
        borderRadius: 24,
        borderColor: 'rgba(148, 163, 184, 0.24)',
        shadowColor: '#000F6B',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.08,
        shadowRadius: 28,
        elevation: 5,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FCFDFF',
    },
    chatTitleGroup: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        flex: 1,
        paddingRight: 16,
    },
    chatIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 3, 184, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatCopy: {
        flex: 1,
    },
    chatTitle: {
        fontSize: 18,
        lineHeight: 26,
        fontWeight: '700',
        color: '#0F172A',
    },
    chatSubtitle: {
        marginTop: 2,
        fontSize: 13,
        lineHeight: 19,
        color: '#64748B',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    liveBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 999,
        backgroundColor: '#16A34A',
    },
    liveBadgeText: {
        fontSize: 11,
        lineHeight: 16,
        fontWeight: '700',
        color: '#15803D',
        textTransform: 'uppercase',
    },
    chatBody: {
        flex: 1,
        minHeight: 0,
        backgroundColor: '#F8FAFF',
    },
    chatBodyContent: {
        padding: 26,
        gap: 24,
        flexGrow: 1,
    },
    userBubble: {
        maxWidth: 340,
        alignSelf: 'flex-end',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 36,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center',
    },
    emptyText: {
        marginTop: 6,
        maxWidth: 420,
        fontSize: 14,
        lineHeight: 22,
        color: '#64748B',
        textAlign: 'center',
    },
    responseRow: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'flex-start',
    },
    assistantAvatar: {
        width: 38,
        height: 38,
        borderRadius: 999,
        backgroundColor: '#0003B8',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.95)',
        shadowColor: '#0003B8',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 4,
    },
    responseStack: {
        flex: 1,
        gap: 14,
    },
    responseCard: {
        borderColor: 'rgba(148, 163, 184, 0.2)',
    },
    localAlertsPanel: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        gap: 10,
    },
    localAlertsHeading: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '700',
        color: '#0003B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    localAlertCard: {
        overflow: 'hidden',
        padding: 12,
        paddingLeft: 18,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
        backgroundColor: '#FFFFFF',
    },
    localAlertCardSelected: {
        borderWidth: 2,
    },
    localAlertAccentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    localAlertTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    localAlertName: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    localAlertRiskBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    localAlertRiskText: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    localAlertRationale: {
        fontSize: 13,
        lineHeight: 19,
        color: '#334155',
    },
    localAlertSummary: {
        fontSize: 13,
        lineHeight: 18,
        color: '#475569',
    },
    localAlertDetail: {
        marginTop: 6,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        gap: 10,
    },
    localAlertDetailBlock: {
        gap: 8,
    },
    localAlertDetailTitle: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '700',
        color: '#334155',
    },
    localAlertDetailText: {
        fontSize: 13,
        lineHeight: 18,
        color: '#475569',
    },
    localAlertMunicipalityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    localAlertMunicipalityName: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        color: '#0F172A',
        fontWeight: '600',
    },
    localAlertCases: {
        fontSize: 13,
        lineHeight: 18,
        color: '#475569',
        fontWeight: '600',
    },
    alertOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
    },
    alertOverlayBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.74)',
    },
    alertDialog: {
        width: '100%',
        maxWidth: 720,
        borderRadius: 24,
        padding: 0,
        overflow: 'hidden',
    },
    alertDialogHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 18,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2F7',
    },
    alertDialogCopy: {
        flex: 1,
    },
    alertDialogEyebrow: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '800',
        color: '#1718C7',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    alertDialogTitle: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: '900',
        color: '#0F172A',
    },
    alertDialogSubtitle: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 22,
        color: '#70839B',
    },
    alertDialogCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    alertDialogBody: {
        padding: 24,
        gap: 20,
    },
    alertDialogMetricsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    alertDialogMetricCard: {
        flex: 1,
        minHeight: 82,
        borderRadius: 16,
        padding: 16,
        paddingLeft: 20,
        overflow: 'hidden',
        borderWidth: 1,
        backgroundColor: '#FFFFFF',
    },
    alertDialogMetricAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    alertDialogMetricLabel: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '800',
        color: '#8A9AAF',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 8,
    },
    alertDialogMetricValue: {
        fontSize: 18,
        lineHeight: 24,
        fontWeight: '900',
        color: '#0F172A',
    },
    alertDialogInsightsSection: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    alertDialogInsightsHeader: {
        minHeight: 56,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2F7',
        justifyContent: 'center',
    },
    alertDialogInsightsTitle: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '900',
        color: '#0F172A',
    },
    alertDialogInsightsList: {
        padding: 12,
        gap: 10,
    },
    alertInsightRow: {
        minHeight: 64,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#EEF2F7',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    alertInsightIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertInsightCopy: {
        flex: 1,
        minWidth: 0,
    },
    alertInsightTitle: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    alertInsightValue: {
        marginTop: 5,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '900',
        color: '#0F172A',
    },
    loadingRow: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    loadingText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        color: '#334155',
    },
    errorText: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
        color: '#B91C1C',
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '600',
    },
    riskRow: {
        flexDirection: 'row',
        gap: 12,
    },
    confidenceCard: {
        flex: 1,
        minHeight: 78,
    },
    riskCard: {
        flex: 1,
        minHeight: 78,
    },
    chatFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingHorizontal: 18,
        paddingVertical: 18,
        backgroundColor: '#FFFFFF',
        gap: 14,
    },
    testsCard: {
        width: '100%',
    },
    finalizeSection: {
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingTop: 14,
    },
    finalizeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
    },
    finalizeHeaderCopy: {
        flex: 1,
    },
    finalizeHeaderMeta: {
        alignItems: 'flex-end',
        gap: 8,
    },
    finalizeTitle: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '700',
        color: '#0F172A',
    },
    finalizeSubtitle: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 19,
        color: '#64748B',
        maxWidth: 560,
    },
    finalizeChevronWrap: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackStatusChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#DCFCE7',
    },
    feedbackStatusChipText: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '700',
        color: '#166534',
    },
    finalizedBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#EEF2FF',
    },
    finalizedBadgeText: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '700',
        color: '#0003B8',
    },
    diseaseSearchField: {
        marginBottom: 10,
    },
    diseaseSearchInputContainer: {
        height: 40,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    finalizeChoiceGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    finalizeChoiceCard: {
        flex: 1,
        minHeight: 206,
        padding: 12,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DCE6F5',
    },
    finalizeChoiceCardSelected: {
        borderWidth: 2,
        borderColor: '#0003B8',
        backgroundColor: '#F8FAFF',
    },
    finalizeChoiceCardDisabled: {
        opacity: 0.56,
    },
    finalizeChoiceHeader: {
        minHeight: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 8,
    },
    suggestionSummaryCard: {
        marginBottom: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: '#F8FAFF',
        borderWidth: 1,
        borderColor: '#DCE6F5',
    },
    suggestionSummaryEyebrow: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#0003B8',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    suggestionSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    suggestionSummaryName: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    suggestionSummaryConfidence: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '700',
        color: '#0003B8',
    },
    suggestionSummaryMeta: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 16,
        color: '#475569',
        fontWeight: '600',
    },
    suggestionSummaryRationale: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 18,
        color: '#334155',
    },
    selectedDiseasePill: {
        alignSelf: 'stretch',
        gap: 2,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        backgroundColor: '#F8FAFF',
        borderWidth: 1,
        borderColor: '#DCE6F5',
    },
    selectedDiseaseLabel: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    selectedDiseaseValue: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    customDiseaseField: {
        marginTop: 6,
        marginBottom: 0,
    },
    customDiseaseInputContainer: {
        height: 40,
        borderRadius: 12,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
    },
    diseaseResultsList: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        overflow: 'hidden',
        maxHeight: 154,
    },
    diseaseResultRow: {
        minHeight: 46,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        backgroundColor: '#FFFFFF',
    },
    diseaseResultRowLast: {
        borderBottomWidth: 0,
    },
    diseaseResultRowSelected: {
        backgroundColor: '#F4F7FF',
        borderLeftWidth: 4,
        borderLeftColor: '#0003B8',
    },
    diseaseResultCopy: {
        flex: 1,
    },
    diseaseResultName: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    diseaseResultNameSelected: {
        color: '#0003B8',
        fontWeight: '800',
    },
    diseaseResultCode: {
        marginTop: 2,
        fontSize: 12,
        lineHeight: 16,
        color: '#64748B',
    },
    feedbackNotesField: {
        marginBottom: 0,
    },
    feedbackInfoBanner: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    feedbackInfoText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        color: '#1E3A8A',
    },
    feedbackSuccessBanner: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    feedbackSuccessText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        color: '#166534',
    },
    finalizeActions: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#0003B8',
        backgroundColor: '#FFFFFF',
    },
    confirmButtonLabel: {
        color: '#0003B8',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
    },
    rejectButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        backgroundColor: '#E8EEF7',
        borderWidth: 0,
    },
    rejectButtonLabel: {
        color: '#334155',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
    },
    doctorOnlyButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        backgroundColor: '#0003B8',
        borderColor: '#0003B8',
    },
});
