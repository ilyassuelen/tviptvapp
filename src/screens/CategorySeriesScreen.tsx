import React from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const POSTER_WIDTH = (width - 40) / 3;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

// 🧹 Titel bereinigen
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle
    .replace(/^.*?-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function CategorySeriesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { categoryName, series } = route.params || {
    categoryName: "Unbekannt",
    series: [],
  };

  const placeholder = "https://via.placeholder.com/150x200.png?text=Kein+Bild";

  const renderItem = ({ item }: { item: any }) => {
    const poster =
      item.cover ||
      item.stream_icon ||
      item.series_image ||
      item.poster ||
      placeholder;
    const rawTitle =
      item.name || item.title || item.stream_display_name || "Unbekannt";
    const title = cleanTitle(rawTitle);

    return (
      <View style={{ flex: 1 / 3, alignItems: "center", marginVertical: 8 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate("SeriesDetail", { serie: item })}
        >
          <View
            style={{
              width: POSTER_WIDTH,
              height: POSTER_HEIGHT,
              borderRadius: 10,
              overflow: "hidden",
              backgroundColor: "#111",
            }}
          >
            <Image
              source={{ uri: poster }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
          <Text
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: "600",
              textAlign: "center",
              marginTop: 6,
              width: POSTER_WIDTH - 6,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* 🔙 Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#000",
          paddingTop: Platform.OS === "ios" ? 50 : 30,
          paddingBottom: 10,
          paddingHorizontal: 14,
          borderBottomWidth: 0.4,
          borderBottomColor: "#333",
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "700",
            marginLeft: 10,
          }}
        >
          {categoryName}
        </Text>
      </View>

      {/* 🎞️ Serien-Grid */}
      <FlatList
        data={series}
        numColumns={3}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 10,
          paddingBottom: 20,
        }}
      />
    </View>
  );
}