import React from "react";
import {
  View, Text, Image, FlatList, TouchableOpacity,
  Platform, Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const POSTER_WIDTH = (width - 40) / 3;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle
    .replace(/^.*?-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function CategoryMoviesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { categoryName, movies } = route.params || { categoryName: "Unbekannt", movies: [] };

  const placeholder = "https://via.placeholder.com/150x200.png?text=Kein+Bild";

  const renderItem = ({ item }: { item: any }) => {
    const poster = item.stream_icon || item.movie_image || item.poster || placeholder;
    const rawTitle = item.name || item.title || item.stream_display_name || "Unbekannt";
    const title = cleanTitle(rawTitle);

    return (
      <View style={{ flex: 1 / 3, alignItems: "center", marginVertical: 8 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate("MovieDetail", { movie: item })}
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
            <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} />
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
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginLeft: 10 }}>
          {categoryName}
        </Text>
      </View>

      <FlatList
        data={movies}
        numColumns={3}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 20 }}
      />
    </View>
  );
}