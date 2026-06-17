import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Platform } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import moment from 'moment';
import 'moment/locale/ro';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useRouter } from 'expo-router';
import Feather from 'react-native-vector-icons/Feather';

// Configure Romanian locale BEFORE component renders
LocaleConfig.locales['ro'] = {
    monthNames: [
        'Ianuarie',
        'Februarie',
        'Martie',
        'Aprilie',
        'Mai',
        'Iunie',
        'Iulie',
        'August',
        'Septembrie',
        'Octombrie',
        'Noiembrie',
        'Decembrie'
    ],
    monthNamesShort: [
        'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun',
        'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'
    ],
    dayNames: [
        'Duminică',
        'Luni',
        'Marți',
        'Miercuri',
        'Joi',
        'Vineri',
        'Sâmbătă'
    ],
    dayNamesShort: ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'], // Folosim abreviere mai scurte
};
LocaleConfig.defaultLocale = 'ro';

// Set moment.js to Romanian
moment.locale('ro');

export default function Workouts() {
    const db = useSQLiteContext();
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState('');
    const [workouts, setWorkouts] = useState([]);
    const [datesWithWorkouts, setDatesWithWorkouts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadDatesWithWorkouts = useCallback(async () => {
        try {
            setIsLoading(true);
            const result = await db.getAllAsync(
                'SELECT DISTINCT date FROM workouts ORDER BY date DESC'
            );
            setDatesWithWorkouts(result.map(item => item.date));
        } catch (err) {
            console.error('Error loading workout dates:', err);
        } finally {
            setIsLoading(false);
        }
    }, [db]);

    const loadWorkouts = useCallback(async () => {
        if (!selectedDate) {
            setWorkouts([]);
            return;
        }

        try {
            setIsLoading(true);
            const result = await db.getAllAsync(
                'SELECT id, name FROM workouts WHERE date = ? ORDER BY id DESC',
                [selectedDate]
            );
            setWorkouts(result);
        } catch (err) {
            console.error('Error loading workouts:', err);
        } finally {
            setIsLoading(false);
        }
    }, [db, selectedDate]);

    useFocusEffect(
        useCallback(() => {
            loadDatesWithWorkouts();
            loadWorkouts();
        }, [loadDatesWithWorkouts, loadWorkouts])
    );

    const markedDates = useMemo(() => {
        const marked = {};

        datesWithWorkouts.forEach(date => {
            marked[date] = {
                marked: true,
                dotColor: '#4CAF50',
                selected: date === selectedDate,
                selectedColor: '#7F1D1D',
                selectedTextColor: '#ffffff'
            };
        });

        if (selectedDate && !marked[selectedDate]) {
            marked[selectedDate] = {
                selected: true,
                selectedColor: '#7F1D1D',
                selectedTextColor: '#ffffff'
            };
        }

        return marked;
    }, [datesWithWorkouts, selectedDate]);

    const openCreateWorkout = useCallback(() => {
        if (selectedDate) {
            router.push({
                pathname: '/modal',
                params: { date: selectedDate }
            });
        }
    }, [router, selectedDate]);

    const openWorkoutDetails = useCallback((workoutId) => {
        router.push({
            pathname: '/workout-details',
            params: {
                workoutId: workoutId.toString(),
                date: selectedDate
            }
        });
    }, [router, selectedDate]);

    const handleDayPress = useCallback((day) => {
        setSelectedDate(day.dateString);
    }, []);

    const today = new Date().toISOString().split('T')[0];

    return (
        <View style={styles.container}>
            {/* Calendar Legend */}
            <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#7F1D1D' }]} />
                    <Text style={styles.legendText}>Dată selectată</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.legendText}>Antrenamente</Text>
                </View>
                <View style={styles.legendItem}>
                    <Text style={[styles.legendText, { color: '#3B82F6' }]}>Astăzi</Text>
                </View>
            </View>

            {/* Calendar */}
            <Calendar
                onDayPress={handleDayPress}
                markedDates={markedDates}
                current={today}
                style={styles.calendar}
                theme={calendarTheme}
                monthFormat={'MMMM yyyy'}
                firstDay={1} // Luni prima zi a săptămânii
                hideExtraDays={true}
            />

            {/* Create Button */}
            <TouchableOpacity
                onPress={openCreateWorkout}
                style={[
                    styles.button,
                    {
                        backgroundColor: selectedDate ? '#10B981' : '#9CA3AF',
                        opacity: selectedDate ? 1 : 0.85,
                    }
                ]}
                disabled={!selectedDate}
                activeOpacity={0.8}
            >
                <Feather
                    name="plus-circle"
                    size={24}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                />
                <Text style={styles.buttonText}>Creează Antrenament</Text>
            </TouchableOpacity>

            {/* Workout List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Se încarcă antrenamentele...</Text>
                </View>
            ) : (
                <FlatList
                    data={workouts}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.workoutCard}
                            onPress={() => openWorkoutDetails(item.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.workoutText}>🏋️ {item.name}</Text>
                            <View style={styles.workoutArrow}>
                                <Text style={styles.arrowIcon}>→</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {selectedDate ? 'Niciun antrenament pentru data selectată' : 'Selectați o dată pentru a vizualiza antrenamentele'}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const calendarTheme = {
    calendarBackground: '#FFFFFF',
    textSectionTitleColor: '#7F1D1D',
    selectedDayBackgroundColor: '#7F1D1D',
    selectedDayTextColor: '#FFFFFF',
    todayTextColor: '#3B82F6',
    dayTextColor: '#1F2937',
    textDisabledColor: '#D1D5DB',
    selectedDotColor: '#FFFFFF',
    arrowColor: '#7F1D1D',
    monthTextColor: '#7F1D1D',
    indicatorColor: '#7F1D1D',
    dotColor: '#4CAF50',
    textDayFontFamily: 'Inter-Medium',
    textMonthFontFamily: 'Inter-SemiBold',
    textDayHeaderFontFamily: 'Inter-SemiBold',
    textDayFontSize: 14,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 12,
    'stylesheet.calendar.header': {
        week: {
            marginTop: 5,
            flexDirection: 'row',
            justifyContent: 'space-between'
        }
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: 20,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 16,
        flexWrap: 'wrap',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
        marginVertical: 4,
    },
    legendDot: {
        width: 12,
        height: 12,
        marginRight: 8,
        borderRadius: 6,
    },
    legendText: {
        fontFamily: 'Inter-Medium',
        fontSize: 14,
        color: '#374151',
    },
    calendar: {
        marginBottom: 20,
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
        overflow: 'hidden',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        marginBottom: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    buttonText: {
        color: '#FFFFFF',
        fontFamily: 'Inter-SemiBold',
        fontSize: 17,
        letterSpacing: 0.7,
    },
    workoutCard: {
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    workoutText: {
        fontSize: 16,
        color: '#1F2937',
        fontFamily: 'Inter-Medium',
        flex: 1,
    },
    workoutArrow: {
        marginLeft: 10,
    },
    arrowIcon: {
        fontSize: 20,
        color: '#9CA3AF',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        textAlign: 'center',
        color: '#6B7280',
        fontFamily: 'Inter-Medium',
        fontSize: 16,
        lineHeight: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#4B5563',
        fontFamily: 'Inter-Medium',
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 20,
    },
});