import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Font from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { buildApiUrl } from "../api/config";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [language, setLanguage] = useState("DE");
  const [availableLangs, setAvailableLangs] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]); // ⬅️ NEU

  const navigation = useNavigation<any>();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const MOVIES_URL = buildApiUrl("/iptv/movies");
  const SERIES_URL = buildApiUrl("/iptv/series");

  const languageLabels: Record<string, string> = {
    DE: "Deutsch",
    TR: "Türkisch",
    FR: "Französisch",
    KU: "Kurdisch",
  };

  const getRandomItems = (arr: any[], count: number) =>
    [...arr].sort(() => 0.5 - Math.random()).slice(0, count);

  const getTodayKey = () => new Date().toISOString().split("T")[0];

  const extractYearFromTitle = (title: string) => {
    const match = title?.match(/\((\d{4})\)/);
    return match ? parseInt(match[1], 10) : null;
  };

  const detectLanguages = (data: any[]) => {
    const set = new Set<string>();
    data.forEach((item) => {
      const name = (item.name || item.title || "").toUpperCase();
      const prefix = name.split(" ")[0];
      if (/^[A-Z]{2}$/.test(prefix)) set.add(prefix);
    });
    return Array.from(set).sort();
  };

  const loadRecommendations = async (force = false, lang = language) => {
    try {
      const stored = await AsyncStorage.getItem("daily_recommendations");
      const today = getTodayKey();
      const now = new Date();
      const afterMidnight =
        now.getHours() > 0 || (now.getHours() === 0 && now.getMinutes() >= 1);

      if (!force && stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today && parsed.lang === lang && afterMidnight) {
          setMovies(parsed.movies);
          setSeries(parsed.series);
          setLoading(false);
          return;
        }
      }

      const [moviesRes, seriesRes] = await Promise.all([
          fetch(MOVIES_URL),
          fetch(SERIES_URL),
      ]);

      const moviesText = await moviesRes.text();
      const seriesText = await seriesRes.text();

      if (!moviesText || !seriesText) throw new Error("Server hat keine Daten gesendet");

      let moviesData, seriesData;
      try {
          moviesData = JSON.parse(moviesText);
          seriesData = JSON.parse(seriesText);
      } catch {
          console.error("❌ Ungültige JSON-Antwort:", moviesText.slice(0, 200), seriesText.slice(0, 200));
          throw new Error("Ungültige JSON-Antwort vom Server");
      }

      const allMovies = moviesData?.movies || [];
      const allSeries = seriesData?.series || [];

      const detected = Array.from(
        new Set([...detectLanguages(allMovies), ...detectLanguages(allSeries)])
      );
      setAvailableLangs(detected);

      const filterByLang = (arr: any[]) =>
        arr.filter((item) =>
          (item.name || item.title || "")
            .toUpperCase()
            .startsWith(lang.toUpperCase())
        );

      let filteredMovies = filterByLang(allMovies);
      let filteredSeries = filterByLang(allSeries);

      filteredMovies = filteredMovies.filter((m) => {
        const year = extractYearFromTitle(m.name || m.title || "");
        return year ? year >= 2010 : true;
      });
      filteredSeries = filteredSeries.filter((s) => {
        const year = extractYearFromTitle(s.name || s.title || "");
        return year ? year >= 2010 : true;
      });

      const selectedMovies = getRandomItems(filteredMovies, 10);
      const selectedSeries = getRandomItems(filteredSeries, 10);

      setMovies(selectedMovies);
      setSeries(selectedSeries);

      await AsyncStorage.setItem(
        "daily_recommendations",
        JSON.stringify({
          date: today,
          lang,
          movies: selectedMovies,
          series: selectedSeries,
        })
      );
    } catch (err) {
      console.error("❌ Fehler:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadHistory = async () => { // ⬅️ NEU
    try {
      const stored = await AsyncStorage.getItem("stream_history");
      if (stored) setHistory(JSON.parse(stored));
      else setHistory([]);
    } catch (err) {
      console.error("❌ Fehler beim Laden des Verlaufs:", err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    await AsyncStorage.removeItem("daily_recommendations");
    await loadRecommendations(true);

    spinAnim.stopAnimation();
    pulseAnim.stopAnimation();

    // Verlauf frisch laden
    await loadHistory(); // ⬅️ NEU
  };

  useEffect(() => {
    const init = async () => {
      await Font.loadAsync({
        BungeeInline: require("../../assets/fonts/BungeeInline.ttf"),
      });
      const savedLang = await AsyncStorage.getItem("preferred_language");
      if (savedLang) setLanguage(savedLang);
      await loadRecommendations(false, savedLang || "DE");
      await loadHistory(); // ⬅️ NEU
      setFontsLoaded(true);
    };
    init();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const reloadLanguage = async () => {
        const savedLang = await AsyncStorage.getItem("preferred_language");
        if (savedLang && savedLang !== language) {
          setLanguage(savedLang);
          setRefreshing(true);
          await loadRecommendations(true, savedLang);
        }
      };
      reloadLanguage();
      loadHistory(); // ⬅️ NEU – bei Fokus aktualisieren
    }, [language])
  );

  if (!fontsLoaded || loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff5722" />
      </View>
    );

  const placeholder = "https://via.placeholder.com/140x180.png?text=Kein+Bild";

  const cleanTitle = (t: string) =>
    t?.replace(/^.*?-\s*/i, "").replace(/\(.*?\)/g, "").trim();

  const renderItem = (item: any, i: number, type: "movie" | "serie") => {
    const img =
      item.cover ||
      item.stream_icon ||
      item.movie_image ||
      item.series_image ||
      item.poster ||
      placeholder;
    const title =
      cleanTitle(item.name || item.title || item.stream_display_name) ||
      "Unbekannt";

    return (
      <View key={i} style={{ marginRight: 22, alignItems: "center" }}>
        <Text style={styles.indexText}>{i + 1}</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate(
              type === "movie" ? "MovieDetail" : "SeriesDetail",
              type === "movie" ? { movie: item } : { serie: item }
            )
          }
          style={styles.posterContainer}
        >
          <Image source={{ uri: img }} style={styles.posterImage} resizeMode="cover" />
          <View style={{ padding: 8 }}>
            <Text style={styles.posterTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} />
        <View style={{ flexDirection: "row", gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.navigate("Search")}>
            <Ionicons name="search" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* INHALT */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 10, backgroundColor: "#000" }}>
        <Text style={styles.sectionTitle}>
          Film Empfehlungen ({languageLabels[language] || language})
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }}>
          <View style={{ flexDirection: "row" }}>
            {movies.length ? movies.map((m, i) => renderItem(m, i, "movie")) : (
              <Text style={{ color: "#aaa" }}>Keine Filme gefunden</Text>
            )}
          </View>
        </ScrollView>

        <Text style={styles.sectionTitle}>
          Serien Empfehlungen ({languageLabels[language] || language})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row" }}>
            {series.length ? series.map((s, i) => renderItem(s, i, "serie")) : (
              <Text style={{ color: "#aaa" }}>Keine Serien gefunden</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.refreshContainer}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.refreshText}>Aktualisieren</Text>
          </TouchableOpacity>
          <Text style={styles.infoText}>
            Sprache ändern unter{" "}
            <Text style={{ color: "#ff5722" }} onPress={() => navigation.navigate("Settings")}>
              Einstellungen
            </Text>
          </Text>
        </View>

        {/* 📺 Verlauf */}
        {history.length > 0 && (
          <View style={{ marginTop: 40 }}>
            <Text style={styles.sectionTitle}>Verlauf</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row" }}>
                {history.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.historyItem}
                    onPress={() =>
                      navigation.navigate("Player", {
                        channels: [item],
                        currentIndex: 0,
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: item.stream_icon || placeholder }}
                      style={styles.historyImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.historyText} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* 🌫️ Minimalistischer Blur-Ladebildschirm */}
      {refreshing && (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.overlayContent}>
            <Animated.View
              style={{
                transform: [{ rotate: spin }, { scale: pulseAnim }],
              }}
            >
              <Ionicons name="cog-outline" size={70} color="#fff" />
            </Animated.View>
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  logo: { width: 70, height: 40, resizeMode: "contain" },
  sectionTitle: { color: "#ddd", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  refreshContainer: { marginTop: 40, alignSelf: "center", alignItems: "center" },
  refreshButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  refreshText: { fontSize: 15, fontWeight: "700", color: "#000" },
  infoText: { color: "#999", fontSize: 13, marginTop: 8, textAlign: "center" },
  overlayContent: { flex: 1, alignItems: "center", justifyContent: "center" },
  indexText: {
    position: "absolute",
    top: -6,
    left: -15,
    zIndex: 10,
    fontSize: 55,
    fontFamily: "BungeeInline",
    color: "#fff",
    opacity: 0.95,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
    textShadowOffset: { width: 2, height: 2 },
  },
  posterContainer: {
    width: 140,
    backgroundColor: "#111",
    borderRadius: 8,
    overflow: "hidden",
  },
  posterImage: {
    width: "100%",
    height: 180,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  posterTitle: { color: "#fff", fontWeight: "600", fontSize: 13 },

  // ⬇️ NEU: Styles für Verlauf
  historyItem: { alignItems: "center", marginRight: 16, width: 90 },
  historyImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#111",
    marginBottom: 6,
  },
  historyText: { color: "#ccc", fontSize: 12, textAlign: "center", width: 80 },
});