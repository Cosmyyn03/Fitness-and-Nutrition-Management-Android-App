import { Button, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { Tabs } from 'expo-router';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { FontAwesome5, Fontisto } from '@expo/vector-icons';

const STYLES = ['default', 'dark-content', 'light-content'];
const TRANSITIONS = ['fade', 'slide', 'none'];

const _Layout = () => {
    return (


        <Tabs
            screenOptions={{
                tabBarShowLabel: true,
                tabBarInactiveTintColor: '#c5c5e8',
                tabBarActiveTintColor: '#bd0c0c',

                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: 'bold',
                    fontFamily: 'Helvetica Neue',
                },

                tabBarItemStyle: {
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                tabBarStyle: {
                    backgroundColor: '#18181c',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    height: 50,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    headerShown: false,
                    title: "Home",
                    tabBarIcon: () => (
                        <FontAwesome5 name="home" color={'#c5c5e8'} size={18} />
                    ),
                }}
            />

            <Tabs.Screen
                name="workouts"
                options={{
                    headerShown: false,
                    title: "Workouts",
                    tabBarIcon: () => (
                        <FontAwesome5 name="dumbbell" color={'#c5c5e8'} size={18} />
                    ),
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    headerShown: false,
                    title: "Profile",
                    tabBarIcon: () => (
                        <FontAwesome5 name="user-alt" color={'#c5c5e8'} size={18} />
                    ),
                }}
            />

            <Tabs.Screen
                name="calories"
                options={{
                    headerShown: false,
                    title: "Calories",
                    tabBarIcon: () => (
                        <Fontisto name="fire" color={'#c5c5e8'} size={18} />
                    ),
                }}
            />
        </Tabs>
    );
};

export default _Layout;

const styles = StyleSheet.create({});
