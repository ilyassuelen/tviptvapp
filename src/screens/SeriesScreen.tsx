import React, { useEffect, useState, useRef } from "react";
import { useTVEventHandler } from "react-native";
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
  TextInput, Animated, FlatList, TouchableWithoutFeedback
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as Font from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getXtreamInfo, setXtreamConnection } from "../store";

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle.replace(/^.*?-\s*/i, "").replace(/\(.*?\)/g, "").replace(/\s{2,}/g, " ").trim();
}

export default function SeriesScreen() {
  const [loading, setLoading] = useState(true);
  const [seriesCategories, setSeriesCategories] = useState<any[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  // Entfernt: searchVisible, setSearchVisible, searchText, setSearchText, searchResults, setSearchResults
  const navigation = useNavigation<any>();

  const tvEventHandler = (evt: any) => {
    if (evt && evt.eventType) {
      console.log("📺 TV-Event:", evt.eventType);
    }
  };
  useTVEventHandler(tvEventHandler);

  // Entfernt: fadeAnim, slideAnim
  const API_PATH = "/player_api.php";

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        Orbitron: require("../../assets/fonts/Prisma.ttf"),
        Bungee: require("../../assets/fonts/Bungee.ttf"),
      });
      setFontsLoaded(true);
    };

    const loadSeries = async () => {
      try {
        const saved = await AsyncStorage.getItem("iptv_session");
        if (!saved) throw new Error("Keine gespeicherte Session – bitte neu einloggen.");
        const { username, password, serverUrl } = JSON.parse(saved);

        // 1️⃣ Kategorien abrufen
        const catRes = await fetch(
          `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_series_categories`
        );
        const catText = await catRes.text();
        const categories = JSON.parse(catText);

        // 2️⃣ Serien abrufen
        const seriesRes = await fetch(
          `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_series`
        );
        const seriesText = await seriesRes.text();
        const series = JSON.parse(seriesText);

        // 3️⃣ Map für Kategorie-Namen
        const catMap: Record<string, string> = {};
        categories.forEach((c: any) => {
          catMap[c.category_id] = c.category_name;
        });

        // 4️⃣ Serien nach Kategorie gruppieren
        const grouped: Record<string, any[]> = {};
        series.forEach((serie: any) => {
          const catName = catMap[serie.category_id] || "Unbekannt";
          if (!grouped[catName]) grouped[catName] = [];
          grouped[catName].push(serie);
        });

        const categoryList = Object.entries(grouped).map(([category_name, series]) => ({
          category_name,
          series,
        }));

        setSeriesCategories(categoryList);
      } catch (err) {
        console.error("❌ Fehler beim Laden der Serien:", err);
        setError("Fehler beim Laden der Serien");
      } finally {
        setLoading(false);
      }
    };

    loadFonts();
    loadSeries();
  }, []);

  const ensureSession = async () => {
    let info = getXtreamInfo();
    if (!info) {
      const saved = await AsyncStorage.getItem("iptv_session");
      if (!saved) throw new Error("Keine gespeicherte Session – bitte neu einloggen.");
      const { username, password, serverUrl } = JSON.parse(saved);
      setXtreamConnection(username, password, serverUrl);
      info = { username, password, serverUrl };
    }
    return info!;
  };

  // Entfernt: toggleSearch, handleSearch

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Lade Serien...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>{error}</Text>
      </View>
    );
  }

  const placeholderImage = "https://via.placeholder.com/140x180.png?text=Kein+Bild";

  const renderSerie = (serie: any, index: number) => {
    const img =
      serie.cover ||
      serie.stream_icon ||
      serie.series_image ||
      serie.poster ||
      placeholderImage;

    // Bildvalidierung wie im HomeScreen
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
      return null;
    }

    const title = cleanTitle(
      serie.name || serie.title || serie.stream_display_name || "Unbekannt"
    );

    // ⭐️ Rating-Badge Logik
    let displayRating = null;
    if (serie.rating !== undefined && serie.rating !== null && serie.rating !== "") {
      displayRating = parseFloat(serie.rating);
    } else if (serie.rating_5based !== undefined && serie.rating_5based !== null) {
      displayRating = parseFloat(serie.rating_5based) * 2;
    }
    if (isNaN(displayRating)) {
      displayRating = null;
    }

    return (
      <View key={index} style={{ marginRight: 18, alignItems: "center" }}>
        <TouchableOpacity
          hasTVPreferredFocus={index === 0}
          focusable={true}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(null)}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("SeriesDetail", { serie })}
          style={[
            styles.posterContainer,
            focusedIndex === index && { borderColor: "#E50914", borderWidth: 3 },
          ]}
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
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: Platform.OS === "ios" ? 50 : 30,
          paddingBottom: 10,
          paddingHorizontal: 14,
          backgroundColor: "#000",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Serien</Text>
      </View>

      {/* Kategorien */}
      <ScrollView
        style={{ flex: 1, backgroundColor: "#000", paddingHorizontal: 10, paddingTop: Platform.OS === "ios" ? 70 : 55 }}
      >
        {seriesCategories.map((cat, index) => (
          <View key={index} style={{ marginBottom: 25 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ color: "#ddd", fontSize: 17, fontWeight: "700" }}>
                {cat.category_name}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("CategorySeries", {
                  categoryName: cat.category_name, series: cat.series,
                })}
              >
                <Text style={{ color: "#E50914", fontWeight: "600" }}>Mehr ›</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cat.series.length > 0 ? (
                cat.series.slice(0, 10).map(renderSerie)
              ) : (
                <Text style={{ color: "#aaa" }}>Keine Serien gefunden</Text>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Such-Overlay entfernt */}
    </View>
  );
}

const styles = {
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  posterContainer: {
    width: 140,
    backgroundColor: "#121212",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
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
};