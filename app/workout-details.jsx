import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import exercisesData from '../assets/data/exercises';

export default function WorkoutDetails() {
    const db = useSQLiteContext();
    const router = useRouter();
    const { workoutId, date } = useLocalSearchParams();

    const [workout, setWorkout] = useState(null);
    const [workoutExercises, setWorkoutExercises] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadWorkoutDetails = async () => {
        try {
            setIsLoading(true);
            const workoutResult = await db.getFirstAsync(
                'SELECT * FROM workouts WHERE id = ?',
                [workoutId]
            );
            setWorkout(workoutResult);

            const exercisesResult = await db.getAllAsync(
                `SELECT
                     e.id as exercise_id,
                     e.name as exercise_name,
                     e.type as exercise_type,
                     e.muscles,
                     we.type as workout_exercise_type,
                     we.sets_json,
                     we.duration
                 FROM workout_exercises we
                          JOIN exercises e ON we.exercise_id = e.id
                 WHERE we.workout_id = ?`,
                [workoutId]
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

            setWorkoutExercises(formattedExercises);
        } catch (err) {
            console.error('Error loading workout details:', err);
            Alert.alert('Error', 'Failed to load workout details');
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            loadWorkoutDetails();
        }, [workoutId])
    );

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
                <View style={styles.detailsContainer}>
                    <View style={styles.metaRow}>
                        <MaterialIcons name="timer" size={16} color="#718096" />
                        <Text style={styles.metaText}>
                            Duration: {formatDuration(exercise.duration)}
                        </Text>
                    </View>
                </View>
            );
        }
        if (exercise.workoutExerciseType === 'weighted cardio' && exercise.sets) {
            return (
                <View style={styles.detailsContainer}>
                    <Text style={styles.setsTitle}>Sets</Text>
                    {exercise.sets.map((set, index) => (
                        <View key={index} style={styles.setContainer}>
                            <Text style={styles.setTitle}>Set {index + 1}</Text>
                            <View style={styles.setDetails}>
                                {set.weight && (
                                    <View style={styles.metaRow}>
                                        <MaterialIcons name="fitness-center" size={16} color="#718096" />
                                        <Text style={styles.metaText}>
                                            Weight: {set.weight}kg
                                        </Text>
                                    </View>
                                )}
                                {set.duration && (
                                    <View style={styles.metaRow}>
                                        <MaterialIcons name="timer" size={16} color="#718096" />
                                        <Text style={styles.metaText}>
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
                <View style={styles.detailsContainer}>
                    <View style={styles.metaRow}>
                        <MaterialIcons name="layers" size={16} color="#718096" />
                        <Text style={styles.metaText}>Seturi: {exercise.sets.length}</Text>
                    </View>
                    {exercise.sets.map((set, index) => (
                        <View key={index} style={styles.setContainer}>
                            <Text style={styles.setTitle}>Set {index + 1}</Text>
                            <View style={styles.setDetails}>
                                {set.reps && (
                                    <View style={styles.metaRow}>
                                        <MaterialIcons name="repeat" size={16} color="#718096" />
                                        <Text style={styles.metaText}>Reps: {set.reps}</Text>
                                    </View>
                                )}
                                {(set.weight && exercise.workoutExerciseType !== 'bodyweight exercise') && (
                                    <View style={styles.metaRow}>
                                        <MaterialIcons name="fitness-center" size={16} color="#718096" />
                                        <Text style={styles.metaText}>
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

    const handleEdit = () => {
        router.push({
            pathname: '/modal',
            params: {
                workoutId: workoutId,
                date: date,
                workoutName: workout?.name || '',
            },
        });
    };

    const handleDelete = () => {
        Alert.alert(
            'Șterge Antrenementul',
            'Ești sigur ca vrei sa ștergi acest antrenement?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    onPress: async () => {
                        try {
                            await db.runAsync('BEGIN TRANSACTION');
                            await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId]);
                            await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
                            await db.runAsync('COMMIT');
                            router.back();
                        } catch (err) {
                            await db.runAsync('ROLLBACK');
                            console.error('Error deleting workout:', err);
                            Alert.alert('Error', 'Failed to delete workout');
                        }
                    },
                    style: 'destructive',
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <MaterialIcons name="hourglass-top" size={24} color="#718096" />
                <Text style={styles.loadingText}>Se incarcă detaliile despre antrenament...</Text>
            </View>
        );
    }

    if (!workout) {
        return (
            <View style={styles.emptyContainer}>
                <MaterialIcons name="error-outline" size={24} color="#718096" />
                <Text style={styles.emptyText}>Nu a fost găsit antrenamentul</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>{workout.name}</Text>
                    <View style={styles.metaRow}>
                        <MaterialIcons name="calendar-today" size={16} color="#718096" />
                        <Text style={styles.date}>{new Date(date).toDateString()}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Exerciții</Text>
                    {workoutExercises.length > 0 ? (
                        workoutExercises.map((exercise, index) => (
                            <View key={`${exercise.id}-${index}`} style={[styles.exerciseCard, styles.cardShadow]}>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                <View style={styles.exerciseMetaContainer}>
                                    <View style={styles.metaRow}>
                                        <MaterialIcons name="category" size={16} color="#718096" />
                                        <Text style={styles.metaText}>
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
                            <Text style={styles.emptyText}>Niciun exercițiu în acest antrenament

                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.editButton]}
                    onPress={handleEdit}
                    activeOpacity={0.7}
                >
                    <Text style={styles.buttonText}>Editează</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                >
                    <Text style={styles.buttonText}>Șterge</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontFamily: 'Inter-SemiBold',
        color: '#1A202C',
        marginBottom: 4,
    },
    date: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
        color: '#718096',
        marginLeft: 4,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Inter-SemiBold',
        color: '#1A202C',
        marginBottom: 16,
    },
    exerciseCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    cardShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    exerciseName: {
        fontSize: 16,
        fontFamily: 'Inter-SemiBold',
        color: '#2D3748',
        marginBottom: 8,
    },
    exerciseMetaContainer: {
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    metaText: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
        color: '#718096',
        marginLeft: 8,
    },
    detailsContainer: {
        marginTop: 8,
    },
    setsTitle: {
        fontSize: 14,
        fontFamily: 'Inter-SemiBold',
        color: '#4A5568',
        marginBottom: 8,
    },
    setContainer: {
        backgroundColor: '#F7FAFC',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    setTitle: {
        fontSize: 14,
        fontFamily: 'Inter-Medium',
        color: '#4A5568',
        marginBottom: 6,
    },
    setDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Inter-Medium',
        color: '#A0AEC0',
        marginTop: 8,
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
    },
    loadingText: {
        fontSize: 16,
        fontFamily: 'Inter-Medium',
        color: '#718096',
        marginTop: 12,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#EDF2F7',
    },
    button: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    editButton: {
        backgroundColor: '#3182CE',
    },
    deleteButton: {
        backgroundColor: '#E53E3E',
    },
    buttonText: {
        fontSize: 16,
        fontFamily: 'Inter-SemiBold',
        color: '#FFFFFF',
    },
});