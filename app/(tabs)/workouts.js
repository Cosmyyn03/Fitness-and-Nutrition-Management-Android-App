import { StyleSheet, Text, View } from 'react-native';
import React, { useState } from 'react';
import { Calendar } from 'react-native-calendars';

const Workouts = () => {
    const [selected, setSelected] = useState('');


    return (
        <View style={{ backgroundColor: '#F4F4F4FF', flex: 1, padding: 10 }}>
            {/* Calendar Legend */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#bd0c0c', marginRight: 5, borderRadius: 5 }} />
                    <Text>Selected Date</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 }}>
                    <Text style={{ color: '#4FC3F7' }}>XX </Text>
                    <Text>Today</Text>
                </View>
            </View>

            {/* Calendar */}
            <Calendar
                onDayPress={(day) => {
                    console.log('selected day', day.dateString);
                    setSelected(day.dateString);
                }}
                markedDates={{
                    [selected]: {
                        selected: true,
                        selectedColor: '#bd0c0c',
                        selectedTextColor: '#ffffff',
                        disableTouchEvent: true,
                    },
                }}
                style={{
                    marginTop: 10,
                    elevation: 10,
                    margin: -10,
                }}
                theme={{
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
                    textDayFontFamily: 'Helvetica',
                    textMonthFontFamily: 'Helvetica-Bold',
                    textDayHeaderFontFamily: 'Helvetica',
                }}
            />
        </View>
    );
};

export default Workouts;

const styles = StyleSheet.create({});
