import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { LineChart } from 'react-native-chart-kit';
import { useRoute, useNavigation } from '@react-navigation/native';
import exercisesData from '../assets/data/exercises.json';

const screenWidth = Dimensions.get("window").width;

const ExerciseprogressScreen = () => {
    const db = useSQLiteContext();
    const route = useRoute();
    const navigation = useNavigation();
    const { exerciseId, exerciseName } = route.params;
    const [exerciseHistory, setExerciseHistory] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [dates, setDates] = useState([]);
    const [exerciseType, setExerciseType] = useState(null);
    const [yAxisLabel, setYAxisLabel] = useState('');

    useEffect(() => {
        // Find the exercise in the JSON data to determine its type
        const exercise = exercisesData.exercises.find(ex => ex.id === exerciseId);
        if (exercise) {
            setExerciseType(exercise.type);
        }
        loadExerciseHistory();
    }, [exerciseId]);

    const loadExerciseHistory = async () => {
        try {
            // Get all workout sessions that include this exercise
            const results = await db.getAllAsync(`
                SELECT we.id, we.sets_json, we.duration, w.date, w.name as workout_name
                FROM workout_exercises we
                         JOIN workouts w ON we.workout_id = w.id
                WHERE we.exercise_id = ?
                ORDER BY w.date
            `, [exerciseId]);

            const history = results.map(item => {
                const sets = item.sets_json ? JSON.parse(item.sets_json) : [];
                return {
                    ...item,
                    sets,
                    averageWeight: calculateAverageWeight(sets),
                    averageReps: calculateAverageReps(sets),
                    totalDuration: item.duration || (sets.length > 0 ?
                        sets.reduce((sum, set) => sum + (set.duration || 0), 0) : 0)
                };
            });

            // Prepare data for chart based on exercise type
            let dataForChart = [];
            const datesForChart = history.map(item => item.date.split('T')[0]);
            let yLabel = '';

            const exercise = exercisesData.exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                switch (exercise.type) {
                    case 'weightlifting':
                    case 'weighted bodyweight exercise':
                        dataForChart = history.map(item => item.averageWeight);
                        yLabel = 'kg';
                        break;
                    case 'bodyweight exercise':
                        dataForChart = history.map(item => item.averageReps);
                        yLabel = 'reps';
                        break;
                    default:
                        // No chart for cardio or weighted cardio
                        break;
                }
            }

            setExerciseHistory(history);
            setChartData(dataForChart);
            setDates(datesForChart);
            setYAxisLabel(yLabel);
        } catch (error) {
            console.error('Error loading exercise history:', error);
        }
    };

    const calculateAverageWeight = (sets) => {
        if (!sets || sets.length === 0) return 0;

        const validSets = sets.filter(set => set.weight && !isNaN(set.weight));
        if (validSets.length === 0) return 0;

        const total = validSets.reduce((sum, set) => sum + parseFloat(set.weight), 0);
        return total / validSets.length;
    };

    const calculateAverageReps = (sets) => {
        if (!sets || sets.length === 0) return 0;

        const validSets = sets.filter(set => set.reps && !isNaN(set.reps));
        if (validSets.length === 0) return 0;

        const total = validSets.reduce((sum, set) => sum + parseFloat(set.reps), 0);
        return total / validSets.length;
    };

    const formatDuration = (seconds) => {
        if (!seconds) return "0 seconds";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        let result = [];
        if (hours > 0) result.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) result.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (secs > 0 || result.length === 0) result.push(`${secs} second${secs !== 1 ? 's' : ''}`);

        return result.join(', ');
    };

    const renderWorkoutSession = (item) => {
        const exercise = exercisesData.exercises.find(ex => ex.id === exerciseId);

        if (!exercise) return null;

        switch (exercise.type) {
            case 'cardio':
                return (
                    <View style={styles.sessionContainer}>
                        <Text style={styles.sessionDate}>{item.date.split('T')[0]}</Text>
                        <Text style={styles.sessionWorkout}>Numele antrenamentului din care face parte: {item.workout_name}</Text>
                        <Text style={styles.durationText}>Duration: {formatDuration(item.totalDuration)}</Text>
                    </View>
                );

            case 'weighted cardio':
                return (
                    <View style={styles.sessionContainer}>
                        <Text style={styles.sessionDate}>{item.date.split('T')[0]}</Text>
                        <Text style={styles.sessionWorkout}>Numele antrenamentului din care face parte: {item.workout_name}</Text>
                        <View style={styles.setsContainer}>
                            {item.sets.map((set, index) => (
                                <View key={index} style={styles.setItem}>
                                    <Text>Set {index + 1}: {formatDuration(set.duration)} @ {set.weight}kg</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                );

            case 'bodyweight exercise':
                return (
                    <View style={styles.sessionContainer}>
                        <Text style={styles.sessionDate}>{item.date.split('T')[0]}</Text>
                        <Text style={styles.sessionWorkout}>Numele antrenamentului din care face parte: {item.workout_name}</Text>
                        <View style={styles.setsContainer}>
                            {item.sets.map((set, index) => (
                                <View key={index} style={styles.setItem}>
                                    <Text>Set {index + 1}: {set.reps} reps</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.averageText}>Media pentru repetari: {item.averageReps.toFixed(1)}</Text>
                    </View>
                );

            case 'weightlifting':
            case 'weighted bodyweight exercise':
                return (
                    <View style={styles.sessionContainer}>
                        <Text style={styles.sessionDate}>{item.date.split('T')[0]}</Text>
                        <Text style={styles.sessionWorkout}>Numele antrenamentului din care face parte: {item.workout_name}</Text>
                        <View style={styles.setsContainer}>
                            {item.sets.map((set, index) => (
                                <View key={index} style={styles.setItem}>
                                    <Text>Set {index + 1}: {set.reps} reps @ {set.weight}kg</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.averageText}>Greutate medie: {item.averageWeight.toFixed(1)}kg</Text>
                    </View>
                );

            default:
                return null;
        }
    };

    const shouldShowChart = () => {
        return (
            (exerciseType === 'weightlifting' ||
                exerciseType === 'weighted bodyweight exercise' ||
                exerciseType === 'bodyweight exercise') &&
            chartData.length >= 2
        );
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.exerciseTitle}>{exerciseName} Progress</Text>

            {exerciseHistory.length > 0 ? (
                <>
                    {shouldShowChart() && (
                        <View style={styles.chartContainer}>
                            <LineChart
                                data={{
                                    labels: dates,
                                    datasets: [{
                                        data: chartData,
                                        color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
                                        strokeWidth: 2
                                    }]
                                }}
                                width={screenWidth - 40}
                                height={220}
                                withDots={true}
                                withShadow={false}
                                withInnerLines={false}
                                withOuterLines={false}
                                withVerticalLines={false}
                                withHorizontalLines={false}
                                withVerticalLabels={false}
                                withHorizontalLabels={false}
                                chartConfig={{
                                    backgroundColor: "#ffffff",
                                    backgroundGradientFrom: "#ffffff",
                                    backgroundGradientTo: "#ffffff",
                                    decimalPlaces: 1,
                                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                    propsForDots: {
                                        r: "4",
                                        strokeWidth: "2",
                                        stroke: "#ffa726"
                                    }
                                }}
                                bezier
                                style={{
                                    marginVertical: 8,
                                    borderRadius: 16
                                }}
                            />
                            <Text style={styles.chartLabel}>
                                {exerciseType === 'bodyweight exercise' ? 'Average Reps' : 'Greutate medie (kg)'}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.historyTitle}>Istoric antrenamente</Text>
                    {exerciseHistory.map((item, index) => (
                        <View key={index}>
                            {renderWorkoutSession(item)}
                        </View>
                    ))}
                </>
            ) : (
                <Text style={styles.noDataText}>Nu sunt disponibile date despre antrenament pentru acest exercițiu</Text>
            )}

            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backButtonText}>Înapoi la Profil</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    exerciseTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        margin: 15,
        textAlign: 'center',
    },
    chartContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    chartLabel: {
        marginTop: -20,
        marginBottom: 10,
        fontWeight: 'bold',
        color: '#4a90e2',
    },
    historyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        margin: 15,
    },
    sessionContainer: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        marginHorizontal: 15,
    },
    sessionDate: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    sessionWorkout: {
        color: '#666',
        marginBottom: 10,
    },
    setsContainer: {
        marginBottom: 10,
    },
    setItem: {
        marginBottom: 5,
    },
    averageText: {
        fontWeight: 'bold',
        color: '#4a90e2',
        marginTop: 5,
    },
    durationText: {
        fontWeight: 'bold',
        color: '#2ecc71',
    },
    noDataText: {
        textAlign: 'center',
        color: '#666',
        marginVertical: 20,
    },
    backButton: {
        backgroundColor: '#4a90e2',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        margin: 15,
    },
    backButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default ExerciseprogressScreen;