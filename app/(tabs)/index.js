import {Button, Text, View} from "react-native";
import { Link } from "expo-router";
import React from "react";

export default function Index() {
  return (
    <View style={{ alignItems:'center', justifyContent: 'center', marginTop: 20 }}>
      <Text className="text-5xl text-dark-200 font-bold">Welcome!</Text>
        <Button title="Go to Workouts"/>
    </View>
  );
}
