import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, Dimensions } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useRouter } from 'expo-router';
import { Path, Svg } from 'react-native-svg';

export default function CaloriesTracker() {
    const db = useSQLiteContext();
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState('');
    const [foodEntries, setFoodEntries] = useState([]);
    const [datesWithEntries, setDatesWithEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [totalCalories, setTotalCalories] = useState(0);
    const [macros, setMacros] = useState({
        protein: 0,
        carbs: 0,
        fat: 0
    });

    const loadDatesWithEntries = useCallback(async () => {
        try {
            setIsLoading(true);
            const result = await db.getAllAsync(
                'SELECT DISTINCT date FROM food_entries ORDER BY date DESC'
            );
            setDatesWithEntries(result.map(item => item.date));
        } catch (err) {
            console.error('Error loading food entry dates:', err);
        } finally {
            setIsLoading(false);
        }
    }, [db]);

    const loadFoodEntries = useCallback(async () => {
        if (!selectedDate) {
            setFoodEntries([]);
            setTotalCalories(0);
            setMacros({ protein: 0, carbs: 0, fat: 0 });
            return;
        }

        try {
            setIsLoading(true);
            const entries = await db.getAllAsync(
                'SELECT id, food_name, calories, protein, carbs, fat, quantity, unit, food_image FROM food_entries WHERE date = ? ORDER BY id DESC',
                [selectedDate]
            );

            setFoodEntries(entries);

            // Calculate totals
            const totals = entries.reduce((acc, entry) => {
                return {
                    calories: acc.calories + entry.calories,
                    protein: acc.protein + entry.protein,
                    carbs: acc.carbs + entry.carbs,
                    fat: acc.fat + entry.fat
                };
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            setTotalCalories(totals.calories);
            setMacros({
                protein: totals.protein,
                carbs: totals.carbs,
                fat: totals.fat
            });
        } catch (err) {
            console.error('Error loading food entries:', err);
        } finally {
            setIsLoading(false);
        }
    }, [db, selectedDate]);

    useFocusEffect(
        useCallback(() => {
            loadDatesWithEntries();
            loadFoodEntries();
        }, [loadDatesWithEntries, loadFoodEntries])
    );

    const markedDates = useMemo(() => {
        const marked = {};

        // Mark dates with food entries
        datesWithEntries.forEach(date => {
            marked[date] = {
                marked: true,
                dotColor: '#FFA500',
                selected: date === selectedDate,
                selectedColor: '#bd0c0c',
                selectedTextColor: '#ffffff'
            };
        });

        // Mark selected date if it's not already marked
        if (selectedDate && !marked[selectedDate]) {
            marked[selectedDate] = {
                selected: true,
                selectedColor: '#bd0c0c',
                selectedTextColor: '#ffffff'
            };
        }

        return marked;
    }, [datesWithEntries, selectedDate]);

    const openCreateFoodEntry = useCallback(() => {
        if (selectedDate) {
            router.push({
                pathname: '/food-modal',
                params: { date: selectedDate }
            });
        }
    }, [router, selectedDate]);

    const openEditFoodEntry = useCallback((entry) => {
        if (selectedDate) {
            router.push({
                pathname: '/food-modal',
                params: {
                    date: selectedDate,
                    id: entry.id,
                    food_name: entry.food_name,
                    calories: entry.calories,
                    protein: entry.protein,
                    carbs: entry.carbs,
                    fat: entry.fat,
                    quantity: entry.quantity,
                    unit: entry.unit,
                    food_image: entry.food_image,
                    editMode: 'true',
                    focusOnWeight: 'true'
                }
            });
        }
    }, [router, selectedDate]);

    const handleDeleteEntry = useCallback(async (entryId) => {
        Alert.alert(
            'Delete Food Entry',
            'Are you sure you want to delete this food entry?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await db.runAsync('DELETE FROM food_entries WHERE id = ?', [entryId]);
                            loadFoodEntries();
                            loadDatesWithEntries();
                        } catch (err) {
                            console.error('Error deleting food entry:', err);
                        }
                    }
                }
            ]
        );
    }, [db, loadFoodEntries, loadDatesWithEntries]);

    const handleDayPress = useCallback((day) => {
        setSelectedDate(day.dateString);
    }, []);

    const calculateMacroPercentages = () => {
        const totalMacros = macros.protein + macros.carbs + macros.fat;
        if (totalMacros === 0) return { protein: 0, carbs: 0, fat: 0 };

        return {
            protein: (macros.protein / totalMacros) * 100,
            carbs: (macros.carbs / totalMacros) * 100,
            fat: (macros.fat / totalMacros) * 100
        };
    };

    const macroPercentages = calculateMacroPercentages();
    const today = new Date().toISOString().split('T')[0];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {/* Calendar Legend */}
            <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#bd0c0c' }]} />
                    <Text>Dată selectată</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FFA500' }]} />
                    <Text>Mese</Text>
                </View>
                <View style={styles.legendItem}>
                    <Text style={{ color: '#00adf5' }}>Astăzi </Text>
                </View>
            </View>

            {/* Calendar */}
            <Calendar
                onDayPress={handleDayPress}
                markedDates={markedDates}
                current={today}
                style={styles.calendar}
                theme={calendarTheme}
            />

            {/* Nutrition Summary */}
            {selectedDate && (
                <View style={styles.nutritionSummary}>
                    <Text style={styles.summaryTitle}>Macronutrienții pentru ziua selectată:
                    </Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Calorii:</Text>
                        <Text style={styles.summaryValue}>{totalCalories.toFixed(0)} kcal</Text>
                    </View>

                    {/* Macro Pie Chart */}
                    <View style={styles.pieChartContainer}>
                        <View style={styles.pieChartWrapper}>
                            <PieChart
                                proteinPercentage={macroPercentages.protein}
                                carbsPercentage={macroPercentages.carbs}
                                fatPercentage={macroPercentages.fat}
                            />
                        </View>
                        <View style={styles.pieChartLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                                <Text style={styles.legendText}>Proteine {macroPercentages.protein.toFixed(0)}%</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                                <Text style={styles.legendText}>Carbs {macroPercentages.carbs.toFixed(0)}%</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendColor, { backgroundColor: '#FF5722' }]} />
                                <Text style={styles.legendText}>Grăsimi: {macroPercentages.fat.toFixed(0)}%</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.macrosContainer}>
                        <View style={[styles.macroItem, { backgroundColor: '#4CAF50' }]}>
                            <Text style={styles.macroLabel}>Proteine</Text>
                            <Text style={styles.macroValue}>{macros.protein.toFixed(1)}g</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: '#2196F3' }]}>
                            <Text style={styles.macroLabel}>Carbs</Text>
                            <Text style={styles.macroValue}>{macros.carbs.toFixed(1)}g</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: '#FF5722' }]}>
                            <Text style={styles.macroLabel}>Grăsimi:</Text>
                            <Text style={styles.macroValue}>{macros.fat.toFixed(1)}g</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Create Button */}
            <TouchableOpacity
                onPress={openCreateFoodEntry}
                style={[
                    styles.button,
                    {
                        backgroundColor: selectedDate ? '#28a745' : '#aaa',
                        opacity: selectedDate ? 1 : 0.6
                    }
                ]}
                disabled={!selectedDate}
            >
                <Text style={styles.buttonText}>+Adăugați mese</Text>
            </TouchableOpacity>

            {/* Food Entries */}
            {isLoading ? (
                <Text style={styles.loading}>Loading...</Text>
            ) : (
                <>
                    {foodEntries.length === 0 ? (
                        <Text style={styles.empty}>
                            {selectedDate ? 'Nicio masă pentru data selectată' : 'Selectați o dată pentru a vizualiza mesele'}
                        </Text>
                    ) : (
                        foodEntries.map(item => (
                            <View key={item.id} style={styles.foodCard}>
                                <View style={styles.foodHeader}>
                                    {item.food_image && (
                                        <Image
                                            source={{ uri: item.food_image }}
                                            style={styles.foodImage}
                                            resizeMode="cover"
                                        />
                                    )}
                                    <Text style={styles.foodName}>{item.food_name}</Text>
                                    <Text style={styles.foodCalories}>{item.calories.toFixed(0)} kcal</Text>
                                </View>
                                <View style={styles.quantityRow}>
                                    <Text style={styles.foodQuantity}>{item.quantity} {item.unit}</Text>
                                    <TouchableOpacity
                                        style={styles.editQuantityButton}
                                        onPress={() => openEditFoodEntry(item)}
                                    >
                                        <Text style={styles.editQuantityButtonText}>✏️ Editează Gramajul </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.macrosRow}>
                                    <Text style={[styles.macroText, { color: '#4CAF50' }]}>P: {item.protein.toFixed(1)}g</Text>
                                    <Text style={[styles.macroText, { color: '#2196F3' }]}>C: {item.carbs.toFixed(1)}g</Text>
                                    <Text style={[styles.macroText, { color: '#FF5722' }]}>F: {item.fat.toFixed(1)}g</Text>
                                </View>
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={() => handleDeleteEntry(item.id)}
                                    >
                                        <Text style={styles.actionButtonText}>Șterge</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </>
            )}
        </ScrollView>
    );
}

const PieChart = ({ proteinPercentage, carbsPercentage, fatPercentage }) => {
    const size = 150;
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

const calendarTheme = {
    calendarBackground: '#F4F4F4FF',
    textSectionTitleColor: '#bd0c0c',
    selectedDayBackgroundColor: '#bd0c0c',
    selectedDayTextColor: '#ffffff',
    todayTextColor: '#00adf5',
    dayTextColor: '#222222',
    textDisabledColor: '#d9e1e8',
    selectedDotColor: '#ffffff',
    arrowColor: '#bd0c0c',
    monthTextColor: '#bd0c0c',
    indicatorColor: 'red',
    dotColor: '#FFA500',
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F4F4FF',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 16,
        flexWrap: 'wrap',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 8,
        marginVertical: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        marginRight: 5,
        borderRadius: 5,
    },
    calendar: {
        marginBottom: 16,
        borderRadius: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    button: {
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 16,
        elevation: 2,
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    nutritionSummary: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 16,
        color: '#666',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#bd0c0c',
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    macroItem: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    macroLabel: {
        color: '#fff',
        fontSize: 12,
    },
    macroValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    foodCard: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 8,
        elevation: 2,
    },
    foodHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    foodName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    foodCalories: {
        fontSize: 16,
        color: '#bd0c0c',
        fontWeight: 'bold',
    },
    quantityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    foodQuantity: {
        fontSize: 14,
        color: '#666',
    },
    editQuantityButton: {
        padding: 4,
        borderRadius: 4,
    },
    editQuantityButtonText: {
        color: '#2196F3',
        fontSize: 12,
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroText: {
        fontSize: 14,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
        marginLeft: 8,
    },
    deleteButton: {
        backgroundColor: '#f44336',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
    },
    empty: {
        textAlign: 'center',
        marginTop: 20,
        color: '#999',
    },
    loading: {
        textAlign: 'center',
        marginTop: 20,
        color: '#666',
    },
    foodImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 8,
    },
    pieChartContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 16,
    },
    pieChart: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pieChartBase: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pieChartSvg: {
        width: 150,
        height: 150,
        borderRadius: 75,
        overflow: 'hidden',
    },
    pieSegment: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: 75,
    },
    pieChartLegend: {
        marginLeft: 16,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 8,
    },
    legendText: {
        fontSize: 14,
        color: '#333',
    },
});