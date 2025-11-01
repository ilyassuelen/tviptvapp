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
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Font from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [language, setLanguage] = useState("DE");
  const [availableLangs, setAvailableLangs] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]); // ⬅️ NEU
  const [latestMovie, setLatestMovie] = useState<any | null>(null); // ⬅️ NEW

  const navigation = useNavigation<any>();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // For animated header
  const scrollY = useRef(new Animated.Value(0)).current;

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
          // Set latestMovie from stored movies if possible
          if (parsed.movies && parsed.movies.length > 0) {
            setLatestMovie(parsed.movies[0]);
          } else {
            setLatestMovie(null);
          }
          setLoading(false);
          return;
        }
      }

      // Session aus AsyncStorage holen (wie Smarters/TiviMate: direkt Xtream API)
      const sessionRaw = await AsyncStorage.getItem("iptv_session");
      if (!sessionRaw) {
          throw new Error("Keine Xtream-Session gefunden. Bitte erneut einloggen.");
      }
      const { serverUrl, username, password } = JSON.parse(sessionRaw);
      const base = (serverUrl || "").replace(/\/+$/, "");

      const vodUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`;
      const seriesUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`;

      const [moviesRes, seriesRes] = await Promise.all([
          fetch(vodUrl, { headers: { Accept: "application/json" } }),
          fetch(seriesUrl, { headers: { Accept: "application/json" } }),
      ]);

      const moviesText = await moviesRes.text();
      const seriesText = await seriesRes.text();

      if (!moviesText || !seriesText) {
          console.error("❌ Leere Antwort vom Xtream-Server:", { vodUrl, seriesUrl });
          throw new Error("Server hat keine Daten gesendet");
      }

      let moviesData, seriesData;
      try {
          moviesData = JSON.parse(moviesText);
          seriesData = JSON.parse(seriesText);
      } catch {
          console.error("❌ Ungültige JSON-Antwort:", moviesText.slice(0, 200), seriesText.slice(0, 200));
          throw new Error("Ungültige JSON-Antwort vom Server");
      }

      const allMovies = Array.isArray(moviesData) ? moviesData : moviesData.movies || [];
      const allSeries = Array.isArray(seriesData) ? seriesData : seriesData.series || [];

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

      // 🎬 Nur Einträge mit echtem Posterbild behalten (nicht leer oder null)
      const hasPoster = (item: any) => {
          const img =
          item.cover ||
          item.stream_icon ||
          item.movie_image ||
          item.series_image ||
          item.poster;

          if (!img || typeof img !== "string") return false;
          const url = img.trim().toLowerCase();
          if (
              url === "" ||
              url.includes("no_image") ||
              url.includes("null") ||
              url.includes("missing") ||
              url.startsWith("http") === false ||
              url.endsWith(".php") ||
              url.endsWith(".txt")
          ) {
              return false;
          }
          return true;
      };

      // Nur Filme/Serien mit gültigem Bild
      filteredMovies = filteredMovies.filter((m) => hasPoster(m));
      filteredSeries = filteredSeries.filter((s) => hasPoster(s));

      filteredMovies = filteredMovies.filter((m) => {
        const year = extractYearFromTitle(m.name || m.title || "");
        return year ? year >= 2005 : true;
      });
      filteredSeries = filteredSeries.filter((s) => {
        const year = extractYearFromTitle(s.name || s.title || "");
        return year ? year >= 2005 : true;
      });

      // Sort by 'added' or 'added_date' descending
      filteredMovies.sort((a, b) => {
        const aDate = parseInt(a.added || a.added_date || 0);
        const bDate = parseInt(b.added || b.added_date || 0);
        return bDate - aDate;
      });
      // Set latestMovie to first after sorting
      if (filteredMovies.length > 0) {
        setLatestMovie(filteredMovies[0]);
      } else {
        setLatestMovie(null);
      }

      // Nur echte Poster verwenden (nach dem Zufall erneut prüfen)
      const validMovies = filteredMovies.filter(m => hasPoster(m));
      const validSeries = filteredSeries.filter(s => hasPoster(s));

      // Falls weniger als 10 existieren, fülle nur mit echten auf
      const selectedMovies = getRandomItems(validMovies, Math.min(validMovies.length, 10));
      const selectedSeries = getRandomItems(validSeries, Math.min(validSeries.length, 10));

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
        Bungee: require("../../assets/fonts/Bungee.ttf"),
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
        <ActivityIndicator size="large" color="#FFFFFF" />
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
      item.poster;

    // 📊 Rating berechnen (robust)
    let displayRating = null;
    if (item.rating !== undefined && item.rating !== null && item.rating !== "") {
      displayRating = parseFloat(item.rating);
    } else if (item.rating_5based !== undefined && item.rating_5based !== null) {
      displayRating = parseFloat(item.rating_5based) * 2;
    }
    if (isNaN(displayRating)) {
      displayRating = null;
    }

    // ❌ Kein gültiges Poster? -> Überspringen
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

    const title =
      cleanTitle(item.name || item.title || item.stream_display_name) ||
      "Unbekannt";

    return (
      <View key={i} style={{ marginRight: 18, alignItems: "center" }}>
        <Text style={styles.indexText}>{i + 1}</Text>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate(
              type === "movie" ? "MovieDetail" : "SeriesDetail",
              type === "movie" ? { movie: item } : { serie: item }
            )
          }
          style={styles.posterContainer}
        >
          <Image source={{ uri: img }} style={styles.posterImage} resizeMode="cover" />
          {/* Glass gradient overlay at bottom */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.85)"]}
            style={styles.posterGradient}
          />
          {/* Title inside image footer */}
          <View style={styles.posterFooter}>
            <Text style={styles.posterTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {/* Rating badge (monochrome) */}
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

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Animated header styles
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [80, 50],
    extrapolate: "clamp",
  });
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 0.6],
    extrapolate: "clamp",
  });
  const logoScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: "clamp",
  });
  // Header overlay color
  const headerOverlayColor = headerBgOpacity.interpolate({
    inputRange: [0, 0.6],
    outputRange: [
      "rgba(0,0,0,0)",
      "rgba(0,0,0,0.6)"
    ],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <StatusBar barStyle="light-content" />
      {/* Animated Blur HEADER */}
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            backgroundColor: "transparent",
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            zIndex: 100,
            // Remove paddingBottom if needed for animation tightness
          },
        ]}
        pointerEvents="box-none"
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: headerOverlayColor,
            },
          ]}
          pointerEvents="none"
        />
        <Animated.Image
          source={require("../../assets/logo.png")}
          style={[
            styles.logo,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
        />
        <View style={{ flexDirection: "row", gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.navigate("Search")}>
            <Ionicons name="search" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* INHALT */}
      <Animated.ScrollView
        style={{ flex: 1, paddingHorizontal: 12, backgroundColor: "#0A0A0A" }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 80 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* 🎬 HERO BANNER (latestMovie) */}
        {latestMovie && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate("MovieDetail", { movie: latestMovie })}
            style={styles.heroContainer}
          >
            {/* Hero Badge oben links */}
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Neu hinzugefügt!</Text>
            </View>
            <Animated.Image
              source={{
                uri:
                  latestMovie.stream_icon ||
                  latestMovie.cover ||
                  latestMovie.movie_image,
              }}
              style={[
                styles.heroImage,
                {
                  transform: [
                    {
                      scale: scrollY.interpolate({
                        inputRange: [-150, 0, 150],
                        outputRange: [1.2, 1, 1],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="cover"
            />

            <LinearGradient
              colors={[
                "rgba(0,0,0,0.0)",
                "rgba(0,0,0,0.25)",
                "rgba(0,0,0,0.85)",
                "rgba(0,0,0,0.95)",
              ]}
              style={styles.heroOverlay}
            />

            <View style={styles.heroTextContainer}>
              <View style={styles.heroGlass}>
                <Text style={styles.heroTitle}>
                  {cleanTitle(latestMovie.name || latestMovie.title || "")}
                </Text>

                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => navigation.navigate("MovieDetail", { movie: latestMovie })}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.heroButtonText}>Jetzt ansehen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
        <Text style={styles.sectionTitle}>
          Film Empfehlungen ({languageLabels[language] || language})
        </Text>
        <View style={styles.sectionDivider} />

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
        <View style={styles.sectionDivider} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row" }}>
            {series.length ? series.map((s, i) => renderItem(s, i, "serie")) : (
              <Text style={{ color: "#aaa" }}>Keine Serien gefunden</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.refreshContainer}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButtonOutline} activeOpacity={0.85}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.refreshTextMono}>Aktualisieren</Text>
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
      </Animated.ScrollView>

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
  center: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },

  // HEADER
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  logo: { width: 74, height: 42, resizeMode: "contain" },

  // TITLES & DIVIDERS
  sectionTitle: {
    color: "#EAEAEA",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
    borderRadius: 1,
  },

  // REFRESH
  refreshContainer: { marginTop: 40, alignSelf: "center", alignItems: "center" },
  refreshButtonOutline: {
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  refreshTextMono: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.2 },
  infoText: { color: "#A1A1A1", fontSize: 13, marginTop: 10, textAlign: "center" },

  // OVERLAYS
  overlayContent: { flex: 1, alignItems: "center", justifyContent: "center" },

  // INDEX NUMBER
  indexText: {
    position: "absolute",
    top: -6,
    left: -14,
    zIndex: 10,
    fontSize: 52,
    fontFamily: "Bungee",
    color: "rgba(255,255,255,1.00)",
  },

  // POSTER CARD
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

  // RATING BADGE (mono)
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
    // Professioneller Schatten
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

  // HERO
  heroContainer: {
    width: "100%",
    height: 360,
    borderRadius: 0,
    overflow: "hidden",
    marginBottom: 35,
    backgroundColor: "#000",
  },
  heroImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  heroTextContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGlass: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#00A3FF",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    alignItems: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 12,
    textShadowColor: "rgba(255,255,255,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,163,255,0.2)",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#00A3FF",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  heroButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 8,
    letterSpacing: 0.3,
  },

  // HISTORY
  historyItem: { alignItems: "center", marginRight: 16, width: 90 },
  historyImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#131313",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  historyText: { color: "#CFCFCF", fontSize: 12, textAlign: "center", width: 80 },

  // LOADING BADGE
  ratingTextMono: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 3,
  },

  // HERO BADGE
  heroBadge: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    zIndex: 10,
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // HERO (legacy kept for safety, not used)
  heroButtonLegacy: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
});
