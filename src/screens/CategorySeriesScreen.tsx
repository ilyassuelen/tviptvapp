import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Platform,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Font from "expo-font";
import { LinearGradient } from "expo-linear-gradient";


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

  const [sorted, setSorted] = useState(false);
  const [displayedSeries, setDisplayedSeries] = useState(series || []);
  const [fontLoaded, setFontLoaded] = useState(false);

  // Font laden wie im HomeScreen
  useEffect(() => {
    (async () => {
      await Font.loadAsync({
        Bungee: require("../../assets/fonts/Bungee.ttf"),
      });
      setFontLoaded(true);
    })();
  }, []);

  const handleSort = () => {
    if (sorted) {
      setDisplayedSeries(series);
      setSorted(false);
    } else {
      const sortedSeries = [...displayedSeries].sort((a, b) => {
        const ratingA = parseFloat(a.rating || a.rating_5based * 2 || 0);
        const ratingB = parseFloat(b.rating || b.rating_5based * 2 || 0);
        return ratingB - ratingA;
      });
      setDisplayedSeries(sortedSeries);
      setSorted(true);
    }
  };

  // Bild-Validierung wie im HomeScreen
  function isValidImage(img: string | undefined | null): boolean {
    if (
      !img ||
      typeof img !== "string" ||
      img.trim() === "" ||
      img.toLowerCase().includes("no_image") ||
      img.toLowerCase().includes("null") ||
      img.toLowerCase().includes("missing") ||
      img.endsWith(".php") ||
      img.endsWith(".txt") ||
      img.startsWith("http") === false
    ) {
      return false;
    }
    return true;
  }

  // FlatList renderItem für einzelne Serie
  const renderItem = (item: any, index: number) => {
    // Bestes Bild nehmen
    const img =
      item.cover ||
      item.stream_icon ||
      item.series_image ||
      item.poster ||
      "";
    if (!isValidImage(img)) {
      return null;
    }
    const rawTitle =
      item.name || item.title || item.stream_display_name || "Unbekannt";
    const title = cleanTitle(rawTitle);
    let displayRating = null;
    if (item.rating !== undefined && item.rating !== null && item.rating !== "") {
      displayRating = parseFloat(item.rating);
    } else if (item.rating_5based !== undefined && item.rating_5based !== null) {
      displayRating = parseFloat(item.rating_5based) * 2;
    }
    if (isNaN(displayRating)) {
      displayRating = null;
    }
    return (
      <TouchableOpacity
        key={index}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("SeriesDetail", { serie: item })}
        style={styles.posterContainer}
      >
        <Image source={{ uri: img }} style={styles.posterImage} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.85)"]}
          style={styles.posterGradient}
        />
        <View style={styles.posterFooter}>
          <Text style={styles.posterTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {displayRating !== null && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#FFFFFF" />
            <Text style={styles.ratingText}>{displayRating.toFixed(1)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };


  if (!fontLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0A", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      {/* 🔙 Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#0A0A0A",
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

      {/* Sortier-Button */}
      <TouchableOpacity
        onPress={handleSort}
        style={{
          backgroundColor: "#222",
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignSelf: "center",
          marginBottom: 10,
        }}
      >
        <Text style={{ color: "white", fontSize: 14 }}>
          {sorted ? "Zurück zur ursprünglichen Reihenfolge" : "Sortieren nach Bewertung"}
        </Text>
      </TouchableOpacity>

      {/* 🎞️ Serien-Grid: FlatList mit 3 Spalten */}
      <FlatList
        data={displayedSeries}
        renderItem={({ item, index }) => renderItem(item, index)}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 14 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item, i) => i.toString()}
      />
    </View>
  );
}
// HomeScreen Styles übernehmen:
const styles = StyleSheet.create({
  posterContainer: {
    width: "31.5%",
    backgroundColor: "#121212",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 16,
  },
  posterImage: {
    width: "100%",
    height: 200,
  },
  posterGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  posterFooter: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  posterTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12.5,
    textAlign: "left",
  },
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ratingText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
});