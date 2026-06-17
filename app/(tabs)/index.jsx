import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { format } from 'date-fns';
import { Path, Svg } from 'react-native-svg';

const ProfileTab = () => {
    const db = useSQLiteContext();
    const navigation = useNavigation();
    const [stats, setStats] = useState({
        totalTemplates: 0,
        totalWorkouts: 0,
        totalCaloriesLogged: 0,
        todayWorkouts: []
    });
    const [displayStats, setDisplayStats] = useState({
        totalTemplates: 0,
        totalWorkouts: 0,
        totalCaloriesLogged: 0
    });
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [exercises, setExercises] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [username, setUsername] = useState('User');
    const [isEditingName, setIsEditingName] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
    const [todayMacros, setTodayMacros] = useState({
        protein: 0,
        carbs: 0,
        fat: 0,
        calories: 0
    });

    const loadData = () => {
        loadStats();
        loadExercises();
        loadUsername();
        loadTodayMacros();
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadData();
        });
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        // Animate the stats counting up
        const animationDuration = 800; // ms
        const frameDuration = 1000 / 60; // 60 fps
        const totalFrames = Math.round(animationDuration / frameDuration);

        let frame = 0;
        const counter = setInterval(() => {
            frame++;

            const progress = frame / totalFrames;

            setDisplayStats({
                totalTemplates: Math.floor(progress * stats.totalTemplates),
                totalWorkouts: Math.floor(progress * stats.totalWorkouts),
                totalCaloriesLogged: Math.floor(progress * stats.totalCaloriesLogged)
            });

            if (frame === totalFrames) {
                clearInterval(counter);
                // Ensure final numbers are correct
                setDisplayStats({
                    totalTemplates: stats.totalTemplates,
                    totalWorkouts: stats.totalWorkouts,
                    totalCaloriesLogged: stats.totalCaloriesLogged
                });
            }
        }, frameDuration);

        return () => clearInterval(counter);
    }, [stats]);

    const loadTodayMacros = async () => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const result = await db.getAllAsync(
                `SELECT
                     SUM(protein) as protein,
                     SUM(carbs) as carbs,
                     SUM(fat) as fat,
                     SUM(calories) as calories
                 FROM food_entries
                 WHERE date = ?`,
                [today]
            );

            if (result.length > 0) {
                setTodayMacros({
                    protein: result[0].protein || 0,
                    carbs: result[0].carbs || 0,
                    fat: result[0].fat || 0,
                    calories: result[0].calories || 0
                });
            }
        } catch (error) {
            console.error('Error loading today macros:', error);
        }
    };

    const loadUsername = async () => {
        try {
            // First check if the table exists
            const tableExists = await db.getAllAsync(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'"
            );

            if (tableExists.length === 0) {
                // Table doesn't exist yet - this is definitely first launch
                setShowWelcomeMessage(true);
                await db.execAsync(`
                    CREATE TABLE IF NOT EXISTS user_settings (
                                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                 name TEXT,
                                                                 first_launch BOOLEAN DEFAULT 1
                    );
                    INSERT INTO user_settings (id, name, first_launch) VALUES (1, 'User', 1);
                `);
                return;
            }

            // Table exists - check for existing settings
            const result = await db.getAllAsync('SELECT name, first_launch FROM user_settings LIMIT 1');

            if (result.length > 0) {
                setUsername(result[0].name || 'User');
                // Show welcome message if it's first launch
                if (result[0].first_launch === 1) {
                    setShowWelcomeMessage(true);
                    // Update first_launch flag
                    await db.runAsync('UPDATE user_settings SET first_launch = 0 WHERE id = 1');
                }
            } else {
                // No settings exist yet - treat as first launch
                setShowWelcomeMessage(true);
                await db.runAsync(
                    'INSERT INTO user_settings (id, name, first_launch) VALUES (1, ?, 1)',
                    ['User']
                );
            }
        } catch (error) {
            console.error('Error loading username:', error);
            // If something went wrong, still show welcome message as fallback
            setShowWelcomeMessage(true);
        }
    };

    const saveUsername = async () => {
        try {
            await db.runAsync(
                'INSERT OR REPLACE INTO user_settings (id, name, first_launch) VALUES (1, ?, 0)',
                [newUsername || username]
            );
            setUsername(newUsername || username);
            setIsEditingName(false);
            setNewUsername('');
        } catch (error) {
            console.error('Error saving username:', error);
        }
    };

    const loadStats = async () => {
        try {
            // Reset display stats before loading new ones
            setDisplayStats({
                totalTemplates: 0,
                totalWorkouts: 0,
                totalCaloriesLogged: 0
            });

            // Ziua de astăzi in YYYY-MM-DD format
            const today = format(new Date(), 'yyyy-MM-dd');

            // Total antrenament personalizate
            const templatesResult = await db.getAllAsync('SELECT COUNT(*) as count FROM workout_templates');
            const totalTemplates = templatesResult[0].count;

            // Total antrenamente efectuate
            const workoutsResult = await db.getAllAsync('SELECT COUNT(*) as count FROM workouts');
            const totalWorkouts = workoutsResult[0].count;

            // Total calorii pentru ziua de astăzi
            const caloriesResult = await db.getAllAsync('SELECT COUNT(*) as count FROM food_entries');
            const totalCaloriesLogged = caloriesResult[0].count;

            // Total antrenament efectuate astăzi
            const todayWorkoutsResult = await db.getAllAsync(
                'SELECT id, name FROM workouts WHERE date = ? ORDER BY id DESC',
                [today]
            );

            setStats({
                totalTemplates,
                totalWorkouts,
                totalCaloriesLogged,
                todayWorkouts: todayWorkoutsResult
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadExercises = async () => {
        try {
            const results = await db.getAllAsync('SELECT id, name FROM exercises ORDER BY name');
            setExercises(results);
        } catch (error) {
            console.error('Error loading exercises:', error);
        }
    };

    const resetEverything = async () => {
        setIsResetting(true);
        try {
            // Show confirmation dialog
            Alert.alert(
                'Reset Everything',
                'Are you sure you want to reset all data? This cannot be undone.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsResetting(false)
                    },
                    {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                            // Drop all tables
                            await db.execAsync(`
                                DROP TABLE IF EXISTS workout_templates;
                                DROP TABLE IF EXISTS workout_template_exercises;
                                DROP TABLE IF EXISTS user_settings;
                                DROP TABLE IF EXISTS workouts;
                                DROP TABLE IF EXISTS workout_exercises;
                                DROP TABLE IF EXISTS food_entries;
                                DROP TABLE IF EXISTS user_settings;
                                DROP TABLE IF EXISTS exercises;
                            `);

                            // Recreate tables with initial schema
                            await db.execAsync(`
                                CREATE TABLE IF NOT EXISTS user_settings (
                                                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                             name TEXT,
                                                                             first_launch BOOLEAN DEFAULT 1
                                );

                                CREATE TABLE IF NOT EXISTS workout_templates (
                                                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                 name TEXT NOT NULL,
                                                                                 created_at TEXT DEFAULT CURRENT_TIMESTAMP
                                );

                                CREATE TABLE IF NOT EXISTS workout_template_exercises (
                                                                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                          template_id INTEGER NOT NULL,
                                                                                          exercise_id INTEGER NOT NULL,
                                                                                          type TEXT NOT NULL,
                                                                                          sets_json TEXT,
                                                                                          duration INTEGER,
                                                                                          FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
                                    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
                                    );

                                CREATE TABLE IF NOT EXISTS exercises (
                                                                         id INTEGER PRIMARY KEY,
                                                                         name TEXT,
                                                                         type TEXT,
                                                                         muscles TEXT
                                );

                                CREATE TABLE IF NOT EXISTS workouts (
                                                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                        name TEXT,
                                                                        date TEXT
                                );

                                CREATE TABLE IF NOT EXISTS workout_exercises (
                                                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                 workout_id INTEGER,
                                                                                 exercise_id INTEGER,
                                                                                 type TEXT,
                                                                                 sets_json TEXT,
                                                                                 duration INTEGER,
                                                                                 FOREIGN KEY(workout_id) REFERENCES workouts(id),
                                    FOREIGN KEY(exercise_id) REFERENCES exercises(id)
                                    );

                                CREATE TABLE IF NOT EXISTS food_entries (
                                                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                            date TEXT NOT NULL,
                                                                            food_name TEXT NOT NULL,
                                                                            calories REAL NOT NULL,
                                                                            protein REAL NOT NULL,
                                                                            carbs REAL NOT NULL,
                                                                            fat REAL NOT NULL,
                                                                            quantity REAL NOT NULL,
                                                                            unit TEXT NOT NULL
                                );
                            `);

                            // Reset username to default
                            setUsername('User');
                            setShowWelcomeMessage(true);

                            // Reload data
                            loadData();

                            // Restart the app
                            await Updates.reloadAsync();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error resetting data:', error);
        } finally {
            setIsResetting(false);
        }
    };

    const filteredExercises = exercises.filter(exercise =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderExerciseItem = ({ item }) => (
        <TouchableOpacity
            style={styles.exerciseItem}
            onPress={() => {
                setShowExerciseModal(false);
                navigation.navigate('exerciseprogress-screen', { exerciseId: item.id, exerciseName: item.name });
            }}
        >
            <Text style={styles.exerciseName}>{item.name}</Text>
        </TouchableOpacity>
    );

    const renderWorkoutItem = ({ item }) => (
        <View style={styles.workoutItem}>
            <Ionicons name="barbell-outline" size={16} color="#4a90e2" style={styles.workoutIcon} />
            <Text style={styles.workoutName}>{item.name}</Text>
        </View>
    );

    const calculateMacroPercentages = () => {
        const totalMacros = todayMacros.protein + todayMacros.carbs + todayMacros.fat;
        if (totalMacros === 0) return { protein: 0, carbs: 0, fat: 0 };

        return {
            protein: (todayMacros.protein / totalMacros) * 100,
            carbs: (todayMacros.carbs / totalMacros) * 100,
            fat: (todayMacros.fat / totalMacros) * 100
        };
    };

    const macroPercentages = calculateMacroPercentages();

    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
            {/* Welcome Message Modal */}
            <Modal
                visible={showWelcomeMessage}
                animationType="slide"
                transparent={false}
            >
                <View style={styles.welcomeModalContainer}>
                    <Text style={styles.welcomeTitle}>Bine ai venit!</Text>
                    <Text style={styles.welcomeText}>
                        Pregătește-te să îți duci călătoria fitness la un nivel superior! Aplicația noastră îți oferă acces la peste 150 de exerciții diferite din diverse categorii.
                    </Text>
                    <Text style={styles.welcomeText}>
                        Creează, planifică și personalizează rutinele tale de antrenament perfecte. Urmărește-ți progresul și rămâi motivat cu statistici detaliate.
                    </Text>
                    <Text style={styles.welcomeText}>
                        Pentru urmărirea nutriției, am integrat API-urile Nutritionix și OpenFoodFacts, făcând ușor să îți înregistrezi mesele și să monitorizezi macronutrienții.
                    </Text>
                    <Text style={styles.welcomeTip}>
                        Poți personaliza numele tău apăsând butonul de editare lângă numele de utilizator din partea de sus a ecranului.
                    </Text>
                    <TouchableOpacity
                        style={styles.welcomeButton}
                        onPress={() => setShowWelcomeMessage(false)}
                    >
                        <Text style={styles.welcomeButtonText}>Începe</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            <View style={styles.container}>
                <View style={styles.header}>
                    {isEditingName ? (
                        <View style={styles.nameEditContainer}>
                            <TextInput
                                style={styles.nameInput}
                                value={newUsername}
                                onChangeText={setNewUsername}
                                placeholder="Enter new name"
                                autoFocus
                            />
                            <TouchableOpacity onPress={saveUsername}>
                                <Ionicons name="checkmark" size={24} color="#4a90e2" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditingName(false)}>
                                <Ionicons name="close" size={24} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.nameContainer}>
                            <Text style={styles.welcomeText}>Bine ai venit, {username}!</Text>
                            <TouchableOpacity onPress={() => setIsEditingName(true)}>
                                <Ionicons name="pencil" size={20} color="#4a90e2" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{displayStats.totalTemplates}</Text>
                        <Text style={styles.statLabel}>Antrenamente Personalizate</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{displayStats.totalWorkouts}</Text>
                        <Text style={styles.statLabel}>Antrenamente efectuate</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{displayStats.totalCaloriesLogged}</Text>
                        <Text style={styles.statLabel}>Total mese înregistrate</Text>
                    </View>
                </View>

                {/* Today's Workouts Section */}
                <View style={styles.todayWorkoutsContainer}>
                    <Text style={styles.sectionTitle}>Antrenamentele de astăzi</Text>
                    {stats.todayWorkouts.length > 0 ? (
                        <FlatList
                            data={stats.todayWorkouts}
                            renderItem={renderWorkoutItem}
                            keyExtractor={item => item.id.toString()}
                            scrollEnabled={false}
                        />
                    ) : (
                        <View style={styles.emptyWorkouts}>
                            <Ionicons name="sad-outline" size={24} color="#a0aec0" />
                            <Text style={styles.emptyText}>Niciun antrenament nu a fost făcut astăzi</Text>
                        </View>
                    )}
                </View>

                {/* Today's Nutrition Section */}
                <View style={styles.nutritionContainer}>
                    <Text style={styles.sectionTitle}>Nutriția pentru ziua de azi</Text>
                    <View style={styles.nutritionSummary}>
                        <Text style={styles.caloriesText}>{todayMacros.calories.toFixed(0)} kcal</Text>

                        <View style={styles.pieChartContainer}>
                            <PieChart
                                proteinPercentage={macroPercentages.protein}
                                carbsPercentage={macroPercentages.carbs}
                                fatPercentage={macroPercentages.fat}
                            />
                            <View style={styles.macroLegend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                                    <Text style={styles.legendText}>
                                        Proteine: {todayMacros.protein.toFixed(1)}g ({macroPercentages.protein.toFixed(0)}%)
                                    </Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                                    <Text style={styles.legendText}>
                                        Carbohidrați: {todayMacros.carbs.toFixed(1)}g ({macroPercentages.carbs.toFixed(0)}%)
                                    </Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendColor, { backgroundColor: '#FF5722' }]} />
                                    <Text style={styles.legendText}>
                                        Grăsimi: {todayMacros.fat.toFixed(1)}g ({macroPercentages.fat.toFixed(0)}%)
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.trackButton}
                    onPress={() => setShowExerciseModal(true)}
                >
                    <Text style={styles.trackButtonText}>Urmărește progresul pentru exercițiu</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={resetEverything}
                    disabled={isResetting}
                >
                    {isResetting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.resetButtonText}>Resetează tot</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Exercise Selection Modal */}
            <Modal
                visible={showExerciseModal}
                animationType="slide"
                transparent={false}
            >
                <View style={styles.modalContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Caută exerciții..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />

                    <FlatList
                        data={filteredExercises}
                        renderItem={renderExerciseItem}
                        keyExtractor={item => item.id.toString()}
                        style={styles.exerciseList}
                    />

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowExerciseModal(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </ScrollView>
    );
};

const PieChart = ({ proteinPercentage, carbsPercentage, fatPercentage }) => {
    const size = 120;
    const radius = size / 2;
    const center = radius;

    // Function to calculate the path for a pie slice
    const getSlicePath = (startAngle, endAngle) => {
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

        return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    };

    // Calculate angles for each segment
    const proteinAngle = (proteinPercentage / 100) * 360;
    const carbsAngle = (carbsPercentage / 100) * 360;
    const fatAngle = (fatPercentage / 100) * 360;

    // Calculate paths for each segment
    const proteinPath = getSlicePath(0, proteinAngle);
    const carbsPath = getSlicePath(proteinAngle, proteinAngle + carbsAngle);
    const fatPath = getSlicePath(proteinAngle + carbsAngle, 360);

    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Protein segment */}
            <Path
                d={proteinPath}
                fill="#4CAF50"
                stroke="#fff"
                strokeWidth={1}
            />

            {/* Carbs segment */}
            <Path
                d={carbsPath}
                fill="#2196F3"
                stroke="#fff"
                strokeWidth={1}
            />

            {/* Fat segment */}
            <Path
                d={fatPath}
                fill="#FF5722"
                stroke="#fff"
                strokeWidth={1}
            />
        </Svg>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContentContainer: {
        padding: 20,
    },
    container: {
        flex: 1,
    },
    header: {
        marginBottom: 20,
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameInput: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#4a90e2',
        marginRight: 10,
        paddingVertical: 5,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 10,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        width: '30%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4a90e2',
    },
    statLabel: {
        fontSize: 10,
        color: '#666',
        textAlign: 'center',
        marginTop: 5,
    },
    nutritionContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    nutritionSummary: {
        alignItems: 'center',
    },
    caloriesText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#bd0c0c',
        marginBottom: 10,
    },
    pieChartContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    macroLegend: {
        flex: 1,
        marginLeft: 15,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 10,
    },
    legendText: {
        fontSize: 14,
        color: '#333',
    },
    todayWorkoutsContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    workoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    workoutIcon: {
        marginRight: 10,
    },
    workoutName: {
        fontSize: 16,
        color: '#333',
    },
    emptyWorkouts: {
        alignItems: 'center',
        paddingVertical: 15,
    },
    emptyText: {
        fontSize: 14,
        color: '#a0aec0',
        marginTop: 10,
    },
    trackButton: {
        backgroundColor: '#4a90e2',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    resetButton: {
        backgroundColor: '#e74c3c',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    trackButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    resetButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        paddingTop: 50,
    },
    searchInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
    },
    exerciseList: {
        flex: 1,
    },
    exerciseItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    exerciseName: {
        fontSize: 16,
    },
    closeButton: {
        backgroundColor: '#e74c3c',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    closeButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    welcomeModalContainer: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        justifyContent: 'center',
    },
    welcomeTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4a90e2',
        marginBottom: 20,
        textAlign: 'center',
    },

    welcomeTip: {
        fontSize: 14,
        color: '#666',
        marginTop: 20,
        marginBottom: 30,
        fontStyle: 'italic',
    },
    welcomeButton: {
        backgroundColor: '#4a90e2',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    welcomeButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default ProfileTab;