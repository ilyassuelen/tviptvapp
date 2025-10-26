import React from "react";
import { View, Image, Text, TouchableOpacity } from "react-native";

export default function PosterCard({ item, onPress }: { item: any; onPress: () => void; }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ width: 120, marginRight: 12 }}>
      <View style={{ width: 120, height: 180, backgroundColor: "#222", borderRadius: 8, overflow: "hidden" }}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 12, color: "#fff" }}>{item.title}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: "#bbb" }}>{(item.genres || []).join(", ")}</Text>
    </TouchableOpacity>
  );
}