import React from "react";
import { View, Text } from "react-native";

export default function MoviesScreen() {
  return (
    <View style={style}>
      <Text style={{ color: "#fff" }}>Filme (bald verfügbar)</Text>
    </View>
  );
}

const style = { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" };