import { useEffect, useState } from 'react';
import { Alert,View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, Keyboard } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import exercisesData from '../assets/data/exercises.json';
import { Ionicons } from '@expo/vector-icons';

export default function TemplateModal() {
    const db = useSQLiteContext();
    const router = useRouter();
    const { templateId } = useLocalSearchParams();

    const [templateName, setTemplateName] = useState('');
    const [exerciseInputs, setExerciseInputs] = useState([
        {
            exerciseId: null,
            type: '',
            sets: [{ reps: '', weight: '' }],
            duration: { hours: 0, minutes: 0, seconds: 0 }
        }
    ]);

    // Search functionality state
    const [searchQueries, setSearchQueries] = useState({});
    const [activeSearchIndex, setActiveSearchIndex] = useState(null);
    const [filteredExercises, setFilteredExercises] = useState(exercisesData.exercises);

    useEffect(() => {
        if (templateId) {
            (async () => {
                try {
                    const [template] = await db.getAllAsync(
                        "SELECT name FROM workout_templates WHERE id = ?",
                        [templateId]
                    );
                    setTemplateName(template?.name || '');

                    const exercises = await db.getAllAsync(
                        `SELECT e.*, wte.type as workout_type, wte.sets_json, wte.duration
                         FROM workout_template_exercises wte
                         JOIN exercises e ON wte.exercise_id = e.id
                         WHERE wte.template_id = ?`,
                        [templateId]
                    );

                    const inputs = exercises.map(ex => ({
                        exerciseId: ex.id,
                        type: ex.workout_type || ex.type,
                        duration: ex.duration && ex.workout_type === 'cardio' ? {
                            hours: Math.floor(ex.duration / 3600),
                            minutes: Math.floor((ex.duration % 3600) / 60),
                            seconds: ex.duration % 60
                        } : { hours: 0, minutes: 0, seconds: 0 },
                        sets: ex.sets_json && ex.workout_type !== 'cardio' ? JSON.parse(ex.sets_json) : [{ reps: '', weight: '' }]
                    }));

                    // For weighted cardio, transform the duration from sets
                    const transformedInputs = inputs.map(input => {
                        if (input.type === 'weighted cardio') {
                            return {
                                ...input,
                                sets: input.sets.map(set => ({
                                    ...set,
                                    duration: set.duration ? {
                                        hours: Math.floor(set.duration / 3600),
                                        minutes: Math.floor((set.duration % 3600) / 60),
                                        seconds: set.duration % 60
                                    } : { hours: 0, minutes: 0, seconds: 0 }
                                }))
                            };
                        }
                        return input;
                    });

                    setExerciseInputs(transformedInputs);

                    // Initialize search queries
                    const initialQueries = {};
                    transformedInputs.forEach((input, index) => {
                        if (input.exerciseId) {
                            const exercise = exercisesData.exercises.find(e => e.id === input.exerciseId);
                            initialQueries[index] = exercise ? exercise.name : '';
                        } else {
                            initialQueries[index] = '';
                        }
                    });
                    setSearchQueries(initialQueries);
                } catch (err) {
                    console.error("Error loading template:", err);
                }
            })();
        } else {
            // Initialize for new template
            setSearchQueries({ 0: '' });
        }
    }, [templateId]);

    // Filter exercises when search query changes
    useEffect(() => {
        if (activeSearchIndex !== null) {
            const query = searchQueries[activeSearchIndex] || '';
            if (query.trim() === '') {
                setFilteredExercises(exercisesData.exercises);
            } else {
                const filtered = exercisesData.exercises.filter(exercise =>
                    exercise.name.toLowerCase().includes(query.toLowerCase())
                );
                setFilteredExercises(filtered);
            }
        }
    }, [searchQueries, activeSearchIndex]);

    const addExerciseInput = () => {
        const newIndex = exerciseInputs.length;
        setExerciseInputs([...exerciseInputs, {
            exerciseId: null,
            type: '',
            sets: [{ reps: '', weight: '' }],
            duration: { hours: 0, minutes: 0, seconds: 0 }
        }]);
        setSearchQueries({...searchQueries, [newIndex]: ''});
    };

    const removeExerciseInput = (index) => {
        const updatedInputs = [...exerciseInputs];
        updatedInputs.splice(index, 1);
        setExerciseInputs(updatedInputs);

        const updatedQueries = {...searchQueries};
        delete updatedQueries[index];
        // Reindex queries
        const newQueries = {};
        updatedInputs.forEach((_, i) => {
            newQueries[i] = updatedQueries[i] || '';
        });
        setSearchQueries(newQueries);

        if (activeSearchIndex === index) {
            setActiveSearchIndex(null);
        }
    };

    const addSet = (exerciseIndex) => {
        const updatedInputs = [...exerciseInputs];
        const newSet = {
            reps: '',
            weight: '',
            ...(updatedInputs[exerciseIndex].type === 'weighted cardio' && {
                duration: { hours: 0, minutes: 0, seconds: 0 }
            })
        };
        updatedInputs[exerciseIndex].sets.push(newSet);
        setExerciseInputs(updatedInputs);
    };

    const removeSet = (exerciseIndex, setIndex) => {
        const updatedInputs = [...exerciseInputs];
        updatedInputs[exerciseIndex].sets.splice(setIndex, 1);
        setExerciseInputs(updatedInputs);
    };

    const handleExerciseChange = (index, id) => {
        const selectedExercise = exercisesData.exercises.find((ex) => ex.id === id);
        const updatedInputs = [...exerciseInputs];
        updatedInputs[index] = {
            ...updatedInputs[index],
            exerciseId: id,
            type: selectedExercise.type,
            // Initialize sets based on exercise type
            sets: selectedExercise.type === 'cardio'
                ? [{ reps: '', weight: '' }]
                : selectedExercise.type === 'weighted cardio'
                    ? [{ reps: '', weight: '', duration: { hours: 0, minutes: 0, seconds: 0 } }]
                    : [{ reps: '', weight: '' }]
        };
        setExerciseInputs(updatedInputs);

        // Update search query to show selected exercise
        setSearchQueries({...searchQueries, [index]: selectedExercise.name});
        setActiveSearchIndex(null);
        Keyboard.dismiss();
    };

    const handleSetChange = (exerciseIndex, setIndex, field, value) => {
        const updatedInputs = [...exerciseInputs];
        if (field === 'duration') {
            updatedInputs[exerciseIndex].sets[setIndex].duration = value;
        } else {
            updatedInputs[exerciseIndex].sets[setIndex][field] = value;
        }
        setExerciseInputs(updatedInputs);
    };

    const handleDurationChange = (index, duration) => {
        const updatedInputs = [...exerciseInputs];
        updatedInputs[index].duration = duration;
        setExerciseInputs(updatedInputs);
    };

    const handleSearchChange = (text, index) => {
        setSearchQueries({...searchQueries, [index]: text});
    };

    const handleSearchFocus = (index) => {
        setActiveSearchIndex(index);
    };

    const handleSubmit = async () => {
        try {
            if (!templateName) {
                Alert.alert("Workout name is required");
                return;
            }

            await db.runAsync('BEGIN TRANSACTION');

            let currentTemplateId = templateId;

            if (!currentTemplateId) {
                const result = await db.runAsync(
                    "INSERT INTO workout_templates (name) VALUES (?)",
                    [templateName]
                );
                currentTemplateId = result.lastInsertRowId;
            } else {
                await db.runAsync(
                    "UPDATE workout_templates SET name = ? WHERE id = ?",
                    [templateName, templateId]
                );
                await db.runAsync(
                    "DELETE FROM workout_template_exercises WHERE template_id = ?",
                    [templateId]
                );
            }

            for (const input of exerciseInputs) {
                const { exerciseId, type, sets, duration } = input;

                // For weighted cardio, we need to transform the duration in each set
                const transformedSets = type === 'weighted cardio'
                    ? sets.map(set => ({
                        ...set,
                        duration: set.duration ?
                            set.duration.hours * 3600 + set.duration.minutes * 60 + set.duration.seconds
                            : 0
                    }))
                    : sets;

                const setsJson = JSON.stringify(transformedSets);
                const durationInSeconds = type === 'cardio'
                    ? duration.hours * 3600 + duration.minutes * 60 + duration.seconds
                    : null;

                await db.runAsync(
                    "INSERT INTO workout_template_exercises (template_id, exercise_id, type, sets_json, duration) VALUES (?, ?, ?, ?, ?)",
                    [currentTemplateId, exerciseId, type, setsJson, durationInSeconds]
                );
            }

            await db.runAsync('COMMIT');
            router.back();
        } catch (err) {
            await db.runAsync('ROLLBACK');
            console.error("Error saving template:", err);
            Alert.alert("Error", "Acest antrenament nu are exerciții");
        }
    };

    const renderExerciseItem = ({ item, index }) => {
        const selectedExerciseName = item.exerciseId
            ? exercisesData.exercises.find(e => e.id === item.exerciseId)?.name || ''
            : '';

        return (
            <View style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseNumber}>Exercițiul {index + 1}</Text>
                    {exerciseInputs.length > 1 && (
                        <TouchableOpacity
                            onPress={() => removeExerciseInput(index)}
                            style={styles.deleteButton}
                        >
                            <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>Exercițiul</Text>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Caută exerciții..."
                            value={activeSearchIndex === index ? searchQueries[index] || '' : selectedExerciseName}
                            onChangeText={(text) => handleSearchChange(text, index)}
                            onFocus={() => handleSearchFocus(index)}
                            placeholderTextColor="#999"
                            editable={true}
                        />
                    </View>

                    {activeSearchIndex === index && (
                        <View style={styles.exerciseListContainer}>
                            <FlatList
                                data={filteredExercises}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item: exercise }) => (
                                    <TouchableOpacity
                                        style={styles.exerciseItem}
                                        onPress={() => handleExerciseChange(index, exercise.id)}
                                    >
                                        <Text style={styles.exerciseItemText}>{exercise.name}</Text>
                                    </TouchableOpacity>
                                )}
                                keyboardShouldPersistTaps="handled"
                                style={styles.exerciseList}
                            />
                        </View>
                    )}

                    {item.type === 'cardio' && (
                        <View style={styles.cardioContainer}>
                            <Text style={styles.label}>Durata</Text>
                            <View style={styles.timeInputContainer}>
                                {['hours', 'minutes', 'seconds'].map((field) => (
                                    <View style={styles.timeInputWrapper} key={field}>
                                        <Text style={styles.timeLabel}>
                                            {field.charAt(0).toUpperCase() + field.slice(1)}
                                        </Text>
                                        <TextInput
                                            style={styles.timeInput}
                                            placeholder="0"
                                            keyboardType="numeric"
                                            value={item.duration[field]?.toString() || ''}
                                            onChangeText={(text) => {
                                                const value = Math.max(0, parseInt(text) || 0);
                                                const limited = field === 'minutes' || field === 'seconds'
                                                    ? Math.min(59, value)
                                                    : value;
                                                handleDurationChange(index, {
                                                    ...item.duration,
                                                    [field]: limited
                                                });
                                            }}
                                            maxLength={2}
                                        />
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {(item.type === 'weightlifting' ||
                        item.type === 'weighted bodyweight exercise' ||
                        item.type === 'bodyweight exercise' || item.type === 'weighted cardio') && (
                        <>
                            {item.sets.map((set, setIndex) => (
                                <View key={setIndex} style={styles.setCard}>
                                    <View style={styles.setHeader}>
                                        <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                                        {item.sets.length > 1 && (
                                            <TouchableOpacity
                                                onPress={() => removeSet(index, setIndex)}
                                                style={styles.deleteSetButton}
                                            >
                                                <Ionicons name="close" size={18} color="#FF4D4D" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={styles.setInputsContainer}>
                                        <View style={styles.setInputWrapper}>
                                            {item.type !== 'weighted cardio' && (
                                                <>
                                                    <Text style={styles.setInputLabel}>Reps</Text>
                                                    <TextInput
                                                        style={styles.setInput}
                                                        placeholder="0"
                                                        keyboardType="numeric"
                                                        value={set.reps}
                                                        onChangeText={(text) => handleSetChange(index, setIndex, 'reps', text)}
                                                    />
                                                </>
                                            )}
                                        </View>

                                        {(item.type === 'weightlifting' ||
                                            item.type === 'weighted bodyweight exercise' ||
                                            item.type === 'weighted cardio') && (
                                            <View style={styles.setInputWrapper}>
                                                <Text style={styles.setInputLabel}>Greutate (kg)</Text>
                                                <TextInput
                                                    style={styles.setInput}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    value={set.weight}
                                                    onChangeText={(text) => handleSetChange(index, setIndex, 'weight', text)}
                                                />
                                            </View>
                                        )}
                                    </View>

                                    {item.type === 'weighted cardio' && (
                                        <View style={styles.cardioContainer}>
                                            <Text style={styles.label}>Durata</Text>
                                            <View style={styles.timeInputContainer}>
                                                {['hours', 'minutes', 'seconds'].map((field) => (
                                                    <View style={styles.timeInputWrapper} key={field}>
                                                        <Text style={styles.timeLabel}>
                                                            {field.charAt(0).toUpperCase() + field.slice(1)}
                                                        </Text>
                                                        <TextInput
                                                            style={styles.timeInput}
                                                            placeholder="0"
                                                            keyboardType="numeric"
                                                            value={set.duration?.[field]?.toString() || ''}
                                                            onChangeText={(text) => {
                                                                const value = Math.max(0, parseInt(text) || 0);
                                                                const limited = field === 'minutes' || field === 'seconds'
                                                                    ? Math.min(59, value)
                                                                    : value;
                                                                handleSetChange(index, setIndex, 'duration', {
                                                                    ...set.duration,
                                                                    [field]: limited
                                                                });
                                                            }}
                                                            maxLength={2}
                                                        />
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ))}
                            <TouchableOpacity
                                style={styles.addSetButton}
                                onPress={() => addSet(index)}
                            >
                                <Ionicons name="add" size={20} color="#3A86FF" />
                                <Text style={styles.addSetButtonText}>Adaugă set</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#3A86FF" />
                </TouchableOpacity>
                <Text style={styles.header}>
                    {templateId ? 'Editează antrenament personalizat ' : 'Creează antrenament personalizat'}
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Numele antrenamentului personalizat</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Numele antrenamentului "
                    value={templateName}
                    onChangeText={setTemplateName}
                    placeholderTextColor="#999"
                />
            </View>

            <Text style={styles.sectionHeader}>Exerciții</Text>

            <FlatList
                data={exerciseInputs}
                renderItem={renderExerciseItem}
                keyExtractor={(item, index) => index.toString()}
                ListFooterComponent={
                    <>
                        <TouchableOpacity
                            style={styles.addExerciseButton}
                            onPress={addExerciseInput}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                            <Text style={styles.addExerciseButtonText}>Adaugă  exercițiu</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSubmit}
                        >
                            <Text style={styles.saveButtonText}>Salvează antrenamentul personalizat</Text>
                        </TouchableOpacity>
                    </>
                }
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
            />
        </View>
    );
}

// Use the same styles as modal.jsx
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#F8F9FA'
    },
    listContent: {
        paddingBottom: 40,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24
    },
    backButton: {
        marginRight: 16,
        padding: 4
    },
    header: {
        fontSize: 24,
        fontWeight: '700',
        color: '#212529',
        fontFamily: 'System',
        letterSpacing: -0.5
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    exerciseCard: {
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden'
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    exerciseNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: '#495057',
        fontFamily: 'System',
        letterSpacing: -0.2
    },
    deleteButton: {
        padding: 4
    },
    label: {
        fontSize: 15,
        fontWeight: '500',
        color: '#495057',
        marginBottom: 8,
        fontFamily: 'System',
        letterSpacing: -0.1
    },
    input: {
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        color: '#212529',
        backgroundColor: '#F8F9FA',
        marginBottom: 12,
        fontFamily: 'System',
        lineHeight: 20
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 8,
        paddingHorizontal: 14,
        backgroundColor: '#F8F9FA',
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: '#212529',
        paddingVertical: 0,
        fontFamily: 'System',
        letterSpacing: -0.1
    },
    exerciseListContainer: {
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 8,
        backgroundColor: '#fff',
        marginTop: -10,
        marginBottom: 12,
    },
    exerciseList: {
        padding: 8,
    },
    exerciseItem: {
        height: 48,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
        justifyContent: 'center',
    },
    exerciseItemText: {
        fontSize: 16,
        color: '#212529',
        fontFamily: 'System',
        fontWeight: '500',
        letterSpacing: -0.2
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '600',
        color: '#212529',
        marginVertical: 16,
        fontFamily: 'System',
        letterSpacing: -0.3
    },
    setCard: {
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 14,
        marginBottom: 12
    },
    setHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    setLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        fontFamily: 'System',
        letterSpacing: -0.1
    },
    deleteSetButton: {
        padding: 2
    },
    setInputsContainer: {
        flexDirection: 'row',
        gap: 12
    },
    setInputWrapper: {
        flex: 1
    },
    setInputLabel: {
        fontSize: 13,
        color: '#6C757D',
        marginBottom: 6,
        fontFamily: 'System',
        fontWeight: '500'
    },
    setInput: {
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 6,
        padding: 12,
        fontSize: 15,
        color: '#212529',
        backgroundColor: '#fff',
        fontFamily: 'System'
    },
    addSetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3A86FF',
        marginTop: 8
    },
    addSetButtonText: {
        color: '#3A86FF',
        fontWeight: '600',
        marginLeft: 8,
        fontSize: 15,
        fontFamily: 'System',
        letterSpacing: -0.1
    },
    cardioContainer: {
        marginTop: 12
    },
    timeInputContainer: {
        flexDirection: 'row',
        gap: 12
    },
    timeInputWrapper: {
        flex: 1
    },
    timeLabel: {
        fontSize: 13,
        color: '#6C757D',
        marginBottom: 6,
        textAlign: 'center',
        fontFamily: 'System',
        fontWeight: '500'
    },
    timeInput: {
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 6,
        padding: 12,
        fontSize: 15,
        color: '#212529',
        backgroundColor: '#F8F9FA',
        textAlign: 'center',
        fontFamily: 'System'
    },
    addExerciseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3A86FF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16
    },
    addExerciseButtonText: {
        color: '#fff',
        fontWeight: '600',
        marginLeft: 10,
        fontSize: 16,
        fontFamily: 'System',
        letterSpacing: -0.2
    },
    saveButton: {
        backgroundColor: '#28A745',
        padding: 18,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#28A745',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 17,
        fontFamily: 'System',
        letterSpacing: -0.3
    }
});