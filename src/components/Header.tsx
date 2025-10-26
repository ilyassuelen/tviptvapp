import React from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function Header({ onSearch, onSettings }: { onSearch: () => void; onSettings: () => void; }) {
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
      <Image source={require("../../assets/logo.png")} style={{ width: 36, height: 36, borderRadius: 6 }} />
      <View style={{ flexDirection: "row", gap: 16 }}>
        <TouchableOpacity onPress={onSearch}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSettings}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}