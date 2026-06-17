
import React from 'react';
import {  Tabs, } from 'expo-router';

import { FontAwesome5, Fontisto } from '@expo/vector-icons';




const _layout = () => {
    return (


        <Tabs initialRouteName="profile"
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
                    title: "Profil",
                    tabBarIcon: () => (<FontAwesome5 name="user-alt" color={'#c5c5e8'} size={18} />

                    ),
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    headerShown: false,
                    title: "Acasă",
                    tabBarIcon: () => (
                        <FontAwesome5 name="home" color={'#c5c5e8'} size={18} />
                    ),
                }}
            />


            <Tabs.Screen
                name="workouts"
                options={{
                    headerShown: false,
                    title: "Antrenamente",
                    tabBarIcon: () => (
                        <FontAwesome5 name="dumbbell" color={'#c5c5e8'} size={18} />
                    ),


                }}
            />



            <Tabs.Screen
                name="calories"
                options={{
                    headerShown: false,
                    title: "Nutriţie",
                    tabBarIcon: () => (
                        <Fontisto name="fire" color={'#c5c5e8'} size={18} />
                    ),
                }}
            />
        </Tabs>
    );
};

export default _layout;


