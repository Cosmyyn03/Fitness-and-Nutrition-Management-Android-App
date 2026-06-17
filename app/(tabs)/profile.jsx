import React, { useState, useCallback } from 'react';
import { Alert, View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, ScrollView, Animated, Easing } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';

export default function WorkoutTemplates() {
    const db = useSQLiteContext();
    const router = useRouter();
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [templateInfo, setTemplateInfo] = useState(null);
    const [showExerciseTypesModal, setShowExerciseTypesModal] = useState(false);
    const buttonScale = new Animated.Value(1);

    const exerciseTypes = [
        {
            title: "1. Weightlifting",
            description: "Aceste exerciții presupun folosirea unor greutăți externe, cum ar fi gantere, haltere sau aparate din sală. Utilizatorul poate adăuga mai multe serii pentru un exercițiu, iar pentru fiecare serie introduce greutatea folosită și numărul de repetări efectuate. Acest tip de exercițiu este orientat spre dezvoltarea forței și masei musculare.",
            icon: "fitness-center",
            color: "#5E72E4"
        },
        {
            title: "2. Cardio",
            description: "Exercițiile de tip cardio sunt menite să îmbunătățească rezistența și condiția fizică generală. În aplicație, aceste exerciții sunt înregistrate doar în funcție de durata lor, fără alte detalii precum greutăți sau serii. Exemple de astfel de exerciții includ alergarea, înotul sau mersul pe bicicletă.",
            icon: "directions-run",
            color: "#48BB78"
        },
        {
            title: "3. Bodyweight Exercise",
            description: "Acest tip de exercițiu se face folosind greutatea propriului corp, fără echipamente suplimentare. În aplicație, utilizatorul poate adăuga serii, iar pentru fiecare serie introduce doar numărul de repetări. Flotările sau genuflexiunile sunt exemple clasice de astfel de exerciții.",
            icon: "accessibility",
            color: "#ED8936"
        },
        {
            title: "4. Weighted Bodyweight Exercise",
            description: "Sunt exerciții la care se folosește greutatea corpului, dar și o greutate suplimentară. Spre exemplu, flotările cu o vestă cu greutăți sau cu o ganteră pe spate. În aplicație, utilizatorul poate introduce serii și, pentru fiecare serie, repetările și greutatea adăugată.",
            icon: "add",
            color: "#9F7AEA"
        },
        {
            title: "5. Weighted Cardio",
            description: "Acest tip de exercițiu combină mișcarea de tip cardio cu folosirea unei greutăți suplimentare. Spre deosebire de cardio-ul clasic, aici efortul este mai intens datorită greutății purtate în timpul activității. Un exemplu ar fi urcatul pe scări cu o ganteră sau un sac de greutăți în spate. În aplicație, utilizatorul poate adăuga serii, iar pentru fiecare serie introduce durata exercițiului și greutatea folosită.",
            icon: "timer",
            color: "#F56565"
        }
    ];

    const animatePress = () => {
        Animated.sequence([
            Animated.timing(buttonScale, {
                toValue: 0.95,
                duration: 100,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
            }),
            Animated.timing(buttonScale, {
                toValue: 1,
                duration: 100,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
            })
        ]).start();
    };

    const loadTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            const result = await db.getAllAsync(
                'SELECT * FROM workout_templates ORDER BY created_at DESC'
            );
            setTemplates(result);
        } catch (err) {
            console.error('Error loading templates:', err);
            Alert.alert('Error', 'Failed to load workouts');
        } finally {
            setIsLoading(false);
        }
    }, [db]);

    useFocusEffect(
        useCallback(() => {
            loadTemplates();
        }, [loadTemplates])
    );

    const loadTemplateInfo = async (templateId) => {
        try {
            setIsLoading(true);
            const templateResult = await db.getFirstAsync(
                'SELECT * FROM workout_templates WHERE id = ?',
                [templateId]
            );

            const exercisesResult = await db.getAllAsync(
                `SELECT
                     e.id as exercise_id,
                     e.name as exercise_name,
                     e.type as exercise_type,
                     e.muscles,
                     wte.type as workout_exercise_type,
                     wte.sets_json,
                     wte.duration
                 FROM workout_template_exercises wte
                          JOIN exercises e ON wte.exercise_id = e.id
                 WHERE wte.template_id = ?`,
                [templateId]
            );

            const formattedExercises = exercisesResult.map(exercise => ({
                id: exercise.exercise_id,
                name: exercise.exercise_name,
                type: exercise.exercise_type,
                muscles: exercise.muscles ? exercise.muscles.split(', ') : [],
                workoutExerciseType: exercise.workout_exercise_type,
                sets: exercise.sets_json ? JSON.parse(exercise.sets_json) : null,
                duration: exercise.duration,
            }));

            setTemplateInfo({
                ...templateResult,
                exercises: formattedExercises
            });
            setShowInfoModal(true);
        } catch (err) {
            console.error('Error loading template info:', err);
            Alert.alert('Error', 'Failed to load workouts details');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDuration = (totalSeconds) => {
        if (!totalSeconds) return '0 sec';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let parts = [];
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sec${seconds !== 1 ? 's' : ''}`);

        return parts.join(' ');
    };

    const renderExerciseDetails = (exercise) => {
        if (exercise.workoutExerciseType === 'cardio' && exercise.duration) {
            return (
                <View style={styles.exerciseDetailContainer}>
                    <View style={styles.detailRow}>
                        <MaterialIcons name="timer" size={16} color="#6c757d" />
                        <Text style={styles.exerciseDetails}>
                            Duration: {formatDuration(exercise.duration)}
                        </Text>
                    </View>
                </View>
            );
        }
        if (exercise.workoutExerciseType === 'weighted cardio' && exercise.sets) {
            return (
                <View>
                    {exercise.sets.map((set, index) => (
                        <View key={index} style={styles.setContainer}>
                            <Text style={styles.setTitle}>Set {index + 1}</Text>
                            <View style={styles.setDetails}>
                                {set.weight && (
                                    <View style={styles.detailRow}>
                                        <MaterialIcons name="fitness-center" size={16} color="#6c757d" />
                                        <Text style={styles.exerciseDetails}>
                                            Weight: {set.weight}kg
                                        </Text>
                                    </View>
                                )}
                                {set.duration && (
                                    <View style={styles.detailRow}>
                                        <MaterialIcons name="timer" size={16} color="#6c757d" />
                                        <Text style={styles.exerciseDetails}>
                                            Duration: {formatDuration(set.duration)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            );
        }

        if (
            ['weightlifting', 'weighted bodyweight exercise', 'bodyweight exercise'].includes(
                exercise.workoutExerciseType
            ) &&
            exercise.sets
        ) {
            return (
                <View>
                    <View style={styles.detailRow}>
                        <MaterialIcons name="layers" size={16} color="#6c757d" />
                        <Text style={styles.exerciseDetails}>Seturi: {exercise.sets.length}</Text>
                    </View>
                    {exercise.sets.map((set, index) => (
                        <View key={index} style={styles.setContainer}>
                            <Text style={styles.setTitle}>Set {index + 1}</Text>
                            <View style={styles.setDetails}>
                                {set.reps && (
                                    <View style={styles.detailRow}>
                                        <MaterialIcons name="repeat" size={16} color="#6c757d" />
                                        <Text style={styles.exerciseDetails}>Reps: {set.reps}</Text>
                                    </View>
                                )}
                                {(set.weight && exercise.workoutExerciseType !== 'bodyweight exercise') && (
                                    <View style={styles.detailRow}>
                                        <MaterialIcons name="fitness-center" size={16} color="#6c757d" />
                                        <Text style={styles.exerciseDetails}>
                                            Greutate: {set.weight}kg
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            );
        }

        return null;
    };

    const createNewTemplate = () => {
        animatePress();
        router.push({
            pathname: '/template-modal',
            params: { isTemplate: true }
        });
    };

    const editTemplate = (templateId) => {
        animatePress();
        router.push({
            pathname: '/template-modal',
            params: {
                templateId: templateId.toString(),
                isTemplate: true
            }
        });
    };

    const prepareUseTemplate = (template) => {
        animatePress();
        setSelectedTemplate(template);
        setShowCalendar(true);
    };

    const useTemplate = async (date) => {
        if (!selectedTemplate) return;

        try {
            const workoutResult = await db.runAsync(
                'INSERT INTO workouts (name, date) VALUES (?, ?)',
                [selectedTemplate.name, date]
            );
            const workoutId = workoutResult.lastInsertRowId;

            const templateExercises = await db.getAllAsync(
                `SELECT exercise_id, type, sets_json, duration
                 FROM workout_template_exercises
                 WHERE template_id = ?`,
                [selectedTemplate.id]
            );

            for (const exercise of templateExercises) {
                await db.runAsync(
                    'INSERT INTO workout_exercises (workout_id, exercise_id, type, sets_json, duration) VALUES (?, ?, ?, ?, ?)',
                    [
                        workoutId,
                        exercise.exercise_id,
                        exercise.type,
                        exercise.sets_json,
                        exercise.duration
                    ]
                );
            }

            Alert.alert('Success', 'Workout created!');
            router.push({
                pathname: '/workout-details',
                params: {
                    workoutId: workoutId.toString(),
                    date: date
                }
            });
        } catch (err) {
            console.error('Error creating workout from template:', err);
            Alert.alert('Error', 'Failed to create workout from template');
        } finally {
            setShowCalendar(false);
            setSelectedTemplate(null);
        }
    };

    const deleteTemplate = (templateId) => {
        animatePress();
        Alert.alert(
            'Șterge Antrenamentul',
            'Ești sigur că vrei să ștergi acest antrenament?',
            [
                { text: 'Renunță', style: 'cancel' },
                {
                    text: 'Șterge',
                    onPress: async () => {
                        try {
                            await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [templateId]);
                            loadTemplates();
                        } catch (err) {
                            console.error('Error deleting template:', err);
                            Alert.alert('Error', 'Failed to delete workout');
                        }
                    },
                    style: 'destructive',
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Exercise Types Modal */}
            <Modal
                visible={showExerciseTypesModal}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowExerciseTypesModal(false)}
            >
                <View style={styles.exerciseTypesModalContainer}>
                    <ScrollView contentContainerStyle={styles.exerciseTypesScrollContainer}>
                        <Text style={styles.exerciseTypesTitle}>Tipuri de Exerciții</Text>
                        <View style={styles.divider} />

                        {exerciseTypes.map((type, index) => (
                            <View key={index} style={[styles.exerciseTypeCard, { borderLeftColor: type.color }]}>
                                <View style={styles.exerciseTypeHeader}>
                                    <MaterialIcons name={type.icon} size={24} color={type.color} />
                                    <Text style={styles.exerciseTypeTitle}>{type.title}</Text>
                                </View>
                                <Text style={styles.exerciseTypeDescription}>{type.description}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.modalButton, styles.closeButton]}
                        onPress={() => setShowExerciseTypesModal(false)}
                    >
                        <Text style={styles.modalButtonText}>Închide</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Calendar Modal for selecting date */}
            <Modal
                visible={showCalendar}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowCalendar(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View style={[styles.modalContainer, styles.modalShadow]}>
                        <Text style={styles.modalTitle}>Selectează o dată pentru antrenament</Text>
                        <Calendar
                            onDayPress={(day) => {
                                useTemplate(day.dateString);
                            }}
                            style={styles.calendar}
                            theme={{
                                calendarBackground: '#fff',
                                selectedDayBackgroundColor: '#5E72E4',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#5E72E4',
                                arrowColor: '#5E72E4',
                                textSectionTitleColor: '#5E72E4',
                                dayTextColor: '#2d3748',
                                textDisabledColor: '#cbd5e0',
                                monthTextColor: '#5E72E4',
                                textDayFontFamily: 'Inter-Medium',
                                textMonthFontFamily: 'Inter-Bold',
                                textDayHeaderFontFamily: 'Inter-SemiBold',
                            }}
                        />
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => setShowCalendar(false)}
                        >
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            {/* Info Modal for template details */}
            <Modal
                visible={showInfoModal}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowInfoModal(false)}
            >
                <View style={styles.infoModalContainer}>
                    <ScrollView contentContainerStyle={styles.scrollContainer}>
                        {templateInfo && (
                            <>
                                <Text style={styles.infoModalTitle}>{templateInfo.name}</Text>
                                <View style={styles.divider} />

                                <Text style={styles.sectionTitle}>Exerciții</Text>
                                {templateInfo.exercises.length > 0 ? (
                                    templateInfo.exercises.map((exercise, index) => (
                                        <View key={`${exercise.id}-${index}`} style={[styles.exerciseCard, styles.cardShadow]}>
                                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                                            <View style={styles.exerciseMetaContainer}>
                                                <View style={styles.metaRow}>
                                                    <MaterialIcons name="category" size={16} color="#718096" />
                                                    <Text style={styles.metaText} numberOfLines={2}>
                                                        {exercise.workoutExerciseType || exercise.type}
                                                    </Text>
                                                </View>

                                                <View style={styles.metaRow}>
                                                    <MaterialIcons name="fitness-center" size={16} color="#718096" />
                                                    <Text style={styles.metaText}>
                                                        {exercise.muscles.length > 0 ? exercise.muscles.join(', ') : 'N/A'}
                                                    </Text>
                                                </View>
                                            </View>
                                            {renderExerciseDetails(exercise)}
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyCard}>
                                        <MaterialIcons name="error-outline" size={24} color="#a0aec0" />
                                        <Text style={styles.emptyText}>Nu sunt exerciții în acest antrenament</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.modalButton, styles.closeButton]}
                        onPress={() => setShowInfoModal(false)}
                    >
                        <Text style={styles.modalButtonText}>Închide</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                    onPress={() => setShowExerciseTypesModal(true)}
                    style={[styles.infoButton, styles.buttonShadow]}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="help-outline" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Detalii despre tipurile de exercitii</Text>
                </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 12 }}>
                <TouchableOpacity
                    onPress={createNewTemplate}
                    style={[styles.createButton, styles.buttonShadow]}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="add-circle" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Creează Antrenamente Personalizate</Text>
                </TouchableOpacity>
            </Animated.View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <MaterialIcons name="loop" size={32} color="#5E72E4" style={styles.loadingIcon} />
                    <Text style={styles.loadingText}>Se încarcă antrenamentele Personalizate...</Text>
                </View>
            ) : (
                <FlatList
                    data={templates}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <View style={[styles.templateCard, styles.cardShadow]}>
                            <View style={styles.templateHeader}>
                                <Text style={styles.templateName}>{item.name}</Text>
                                <View style={styles.buttonRow}>
                                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.useButton]}
                                            onPress={() => prepareUseTemplate(item)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialIcons name="play-arrow" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </Animated.View>
                                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.infoButton]}
                                            onPress={() => loadTemplateInfo(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialIcons name="info" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </Animated.View>
                                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.editButton]}
                                            onPress={() => editTemplate(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialIcons name="edit" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </Animated.View>
                                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => deleteTemplate(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialIcons name="delete" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </Animated.View>
                                </View>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyCard, styles.cardShadow]}>
                                <MaterialIcons name="fitness-center" size={32} color="#a0aec0" />
                                <Text style={styles.emptyText}>Nu au fost create încă antrenamente custom</Text>
                                <Text style={styles.emptySubtext}>Creează-ți primul antrenament pentru a începe</Text>
                            </View>
                        </View>
                    }
                    contentContainerStyle={templates.length === 0 && styles.listEmptyContainer}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 20,
    },
    infoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        backgroundColor: '#4299E1',

    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#5E72E4',
        borderRadius: 12,
        marginBottom: 20,
        gap: 10,
    },
    buttonText: {
        color: '#ffffff',
        fontFamily: 'Inter-SemiBold',
        fontSize: 16,
    },
    templateCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        padding: 16,
    },
    templateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    templateName: {
        fontSize: 16,
        fontFamily: 'Inter-SemiBold',
        color: '#2d3748',
        flex: 1,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    useButton: {
        backgroundColor: '#48BB78',
    },

    editButton: {
        backgroundColor: '#ED8936',
    },
    deleteButton: {
        backgroundColor: '#F56565',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
    },
    emptyText: {
        fontFamily: 'Inter-Medium',
        color: '#4a5568',
        marginTop: 12,
        fontSize: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontFamily: 'Inter-Regular',
        color: '#718096',
        marginTop: 4,
        fontSize: 14,
        textAlign: 'center',
    },
    listEmptyContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: 'Inter-Medium',
        color: '#4a5568',
        marginTop: 12,
    },
    loadingIcon: {
        animationKeyframes: {
            '0%': { transform: [{ rotate: '0deg' }] },
            '100%': { transform: [{ rotate: '360deg' }] },
        },
        animationDuration: '1000ms',
        animationIterationCount: 'infinite',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        width: '90%',
    },
    modalShadow: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Inter-Bold',
        color: '#2d3748',
        marginBottom: 16,
        textAlign: 'center',
    },
    calendar: {
        marginBottom: 20,
        borderRadius: 12,
    },
    modalButton: {
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F56565',
    },
    modalButtonText: {
        color: '#fff',
        fontFamily: 'Inter-SemiBold',
        fontSize: 16,
    },
    // Info modal styles
    infoModalContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 80,
    },
    infoModalTitle: {
        fontSize: 24,
        fontFamily: 'Inter-Bold',
        color: '#2d3748',
        marginBottom: 16,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Inter-SemiBold',
        color: '#2d3748',
        marginBottom: 12,
    },
    exerciseCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    exerciseName: {
        fontSize: 16,
        fontFamily: 'Inter-SemiBold',
        color: '#2d3748',
        marginBottom: 8,
    },
    exerciseMetaContainer: {
        marginBottom: 12,
        gap: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    metaText: {
        fontSize: 13,
        fontFamily: 'Inter-Regular',
        color: '#718096',
        flexShrink: 1,
    },
    exerciseDetailContainer: {
        marginTop: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    exerciseDetails: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
        color: '#4a5568',
    },
    setContainer: {
        marginTop: 8,
        padding: 10,
        backgroundColor: '#f7fafc',
        borderRadius: 8,
    },
    setTitle: {
        fontFamily: 'Inter-Medium',
        color: '#4a5568',
        marginBottom: 6,
    },
    setDetails: {
        gap: 8,
    },
    closeButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#5E72E4',
        borderRadius: 8,
    },
    // Exercise Types Modal styles
    exerciseTypesModalContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    exerciseTypesScrollContainer: {
        padding: 20,
        paddingBottom: 80,
    },
    exerciseTypesTitle: {
        fontSize: 24,
        fontFamily: 'Inter-Bold',
        color: '#2d3748',
        marginBottom: 16,
        textAlign: 'center',
    },
    exerciseTypeCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#5E72E4',
    },
    exerciseTypeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    exerciseTypeTitle: {
        fontSize: 18,
        fontFamily: 'Inter-SemiBold',
        color: '#2d3748',
    },
    exerciseTypeDescription: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
        color: '#4a5568',
        lineHeight: 20,
    },
    // Shadow effects
    buttonShadow: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    cardShadow: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
});