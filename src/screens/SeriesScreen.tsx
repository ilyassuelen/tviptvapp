import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
  TextInput, Animated, FlatList, TouchableWithoutFeedback
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const API_PATH = "/player_api.php";

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({ Orbitron: require("../../assets/fonts/Prisma.ttf") });
      setFontsLoaded(true);
    };

    const loadSeries = async () => {
      try {
        const saved = await AsyncStorage.getItem("iptv_session");
        if (!saved) throw new Error("Keine gespeicherte Session – bitte neu einloggen.");
        const { username, password, serverUrl } = JSON.parse(saved);
        const res = await fetch(
            `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_series`
        );
        const text = await res.text();
        if (!text) throw new Error("Server hat keine Daten gesendet");
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error("❌ Ungültige JSON-Antwort:", text.slice(0, 200));
            throw new Error("Ungültige JSON-Antwort vom Server");
        }

        // Xtream kann als Array antworten oder als Objekt {series:[...]}
        const list: any[] = Array.isArray(raw) ? raw : (raw.series ?? []);

        const grouped: Record<string, any[]> = {};
        list.forEach((serie: any) => {
          const cat = serie.category_name || "Unbekannt";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(serie);
        });

        const categoryList = Object.entries(grouped).map(([category_name, series]) => ({
          category_name, series,
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

  const toggleSearch = () => {
    if (searchVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -80, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setSearchVisible(false);
        setSearchText("");
        setSearchResults([]);
      });
    } else {
      setSearchVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = text.toLowerCase();
    const results: any[] = [];
    seriesCategories.forEach((cat) => {
      cat.series.forEach((serie: any) => {
        const rawTitle = serie.name || serie.title || serie.stream_display_name || "";
        if (rawTitle.toLowerCase().includes(lower)) results.push(serie);
      });
    });
    setSearchResults(results);
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff5722" />
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
    const posterUri = serie.cover || serie.stream_icon || serie.series_image || serie.poster || placeholderImage;
    const title = cleanTitle(serie.name || serie.title || serie.stream_display_name || "Unbekannt");

    return (
      <TouchableOpacity
        key={index}
        style={{
          width: 140, marginRight: 20, backgroundColor: "#111",
          borderRadius: 8, overflow: "hidden",
        }}
        onPress={() => navigation.navigate("SeriesDetail", { serie })}
      >
        <Image
          source={{ uri: posterUri }}
          style={{ width: "100%", height: 180, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
          resizeMode="cover"
        />
        <View style={{ padding: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          backgroundColor: "#000", paddingTop: Platform.OS === "ios" ? 45 : 25,
          paddingBottom: 10, paddingHorizontal: 14, zIndex: 100,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", fontFamily: "Orbitron" }}>
          Series
        </Text>
        <TouchableOpacity onPress={toggleSearch}>
          <Ionicons name={searchVisible ? "close" : "search"} size={22} color="#fff" />
        </TouchableOpacity>
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
                <Text style={{ color: "#ff5722", fontWeight: "600" }}>Mehr ›</Text>
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

      {/* Such-Overlay */}
      {searchVisible && (
        <Animated.View
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)", opacity: fadeAnim, zIndex: 200,
          }}
        >
          <TouchableWithoutFeedback onPress={toggleSearch}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={{
              position: "absolute", top: Platform.OS === "ios" ? 70 : 50, left: 20, right: 20,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <TextInput
              style={{
                backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12,
                paddingHorizontal: 15, paddingVertical: 10, color: "#fff", fontSize: 16,
              }}
              placeholder="Serie suchen..."
              placeholderTextColor="#aaa"
              value={searchText}
              onChangeText={handleSearch}
              autoFocus
            />
          </Animated.View>

          <FlatList
            data={searchResults}
            keyExtractor={(_, i) => String(i)}
            style={{
              position: "absolute", top: Platform.OS === "ios" ? 120 : 100, left: 20, right: 20,
              maxHeight: "70%", backgroundColor: "rgba(20,20,20,0.95)",
              borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
            }}
            renderItem={({ item }) => {
              const title = cleanTitle(item.name || item.title || item.stream_display_name || "Unbekannt");
              const posterUri = item.cover || item.stream_icon || item.series_image || item.poster || "https://via.placeholder.com/140x180.png?text=Kein+Bild";
              return (
                <TouchableOpacity
                  onPress={() => {
                    setSearchVisible(false);
                    navigation.navigate("SeriesDetail", { serie: item });
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    paddingVertical: 10, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Image source={{ uri: posterUri }} style={{ width: 50, height: 70, borderRadius: 6, marginRight: 12 }} />
                  <Text style={{ color: "#fff", fontSize: 15 }}>{title}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = {
  center: {
    flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000",
  },
};