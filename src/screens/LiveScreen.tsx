import React from "react";
import { View, Text } from "react-native";

export default function LiveScreen() {
  return (
    <View style={style}>
      <Text style={{ color: "#fff" }}>Live Channels (bald verfügbar)</Text>
    </View>
  );
}

const style = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#000",
};