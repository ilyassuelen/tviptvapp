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
  const [isFavorite, setIsFavorite] = useState(false);
  // 🔝 Top 10 by Rating
  const [topMovies, setTopMovies] = useState<any[]>([]);
  const [topSeries, setTopSeries] = useState<any[]>([]);

  const toggleFavorite = async () => {
    try {
      const key = "favorites_movies";
      const stored = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
      const exists = stored.some((m: any) => m.name === latestMovie.name);
      const newList = exists
        ? stored.filter((m: any) => m.name !== latestMovie.name)
        : [...stored, latestMovie];
      await AsyncStorage.setItem(key, JSON.stringify(newList));
      setIsFavorite(!exists);
    } catch (err) {
      console.error("❌ Fehler beim Speichern des Favoriten:", err);
    }
  };

  const navigation = useNavigation<any>();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Progress bar animation for refreshing overlay
  const progressAnim = useRef(new Animated.Value(0)).current;
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

// Neue Hilfsfunktion für gültige Poster-URL (robuster Normalizer für TMDb & CMC)
const getValidPoster = (item: any): string => {
  // Kandidatenfelder prüfen
  let raw =
    (item?.stream_icon ||
      item?.cover ||
      item?.movie_image ||
      item?.poster ||
      "") + "";

  const PLACEHOLDER = "https://via.placeholder.com/300x450.png?text=Kein+Bild";
  const EXT_RX = /\.(jpg|jpeg|png|webp)$/i;

  // 1) Quick bailouts
  if (!raw || /no_image|null|missing/i.test(raw)) {
    if (item?.tmdb && !isNaN(Number(item.tmdb))) {
      return `https://image.tmdb.org/t/p/w600_and_h900_bestv2/${item.tmdb}.jpg`;
    }
    return PLACEHOLDER;
  }

  // 2) JSON-escaped Slashes wie "http:\/\/" oder doppelte Slashes im Pfad glätten
  let url = raw
    .trim()
    // aus "http:\/\/" → "http://"
    .replace(/:\\\//g, "://")
    .replace(/\\\//g, "/");

  // 3) Fehlendes Protokoll handlen (//image.tmdb.org/...)
  if (url.startsWith("//")) {
    url = "https:" + url;
  }
  // 4) Fehlende Domain bei TMDb ergänzen (t/p/... )
  if (/^\/?t\/p\//i.test(url) || /^image\.tmdb\.org/i.test(url)) {
    // Falls nur Pfad übergeben wurde → komplette TMDb-URL bauen
    if (!/^https?:\/\//i.test(url)) {
      url = "https://image.tmdb.org/" + url.replace(/^\/+/, "");
    }
  }

  // 5) Protokoll/Host herauslösen und Pfad doppelte Slashes reduzieren (ohne '://')
  //    Beispiel: https://image.tmdb.org//t//p//w600... → https://image.tmdb.org/t/p/w600...
  const m = url.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
  if (m) {
    let host = m[1];
    let path = (m[2] || "/").replace(/\/{2,}/g, "/");

    // 6) Domain-spezifische Regeln
    const isTMDB = /image\.tmdb\.org$/i.test(host);
    const isCMC = /cmc\.best-ott\.me(?::8080)?$/i.test(host);

    // TMDb immer https
    if (isTMDB) {
      host = host.replace(/^http:\/\//i, "https://");
    }

    // CMC auf Port 8080 i.d.R. nur über http erreichbar → NICHT zwangsweise auf https heben
    if (isCMC && /:8080$/i.test(host)) {
      host = host.replace(/^https:\/\//i, "http://"); // sicherstellen, dass wir http benutzen, falls vorher https war
    }

    // 🔁 Proxy-Lösung über weserv.nl für HTTP-CMC-Server (HTTPS-Bilder über Proxy)
    if (isCMC) {
      const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(host.replace(/^https?:\/\//, "") + path)}`;
      return proxied;
    }

    url = host + path;
  }

  // 7) Wenn immer noch kein Protokoll vorhanden (sehr selten), https annehmen – außer CMC-8080
  if (!/^https?:\/\//i.test(url)) {
    if (/^cmc\.best-ott\.me(?::8080)?\//i.test(url)) {
      url = "http://" + url; // Port 8080 → http
    } else {
      url = "https://" + url;
    }
  }

  // 8) Finale Validierung: Dateiendungen
  if (!EXT_RX.test(url)) {
    // Versuche TMDb-Fallback falls vorhanden
    if (item?.tmdb && !isNaN(Number(item.tmdb))) {
      return `https://image.tmdb.org/t/p/w600_and_h900_bestv2/${item.tmdb}.jpg`;
    }
    return PLACEHOLDER;
  }

  return url;
};

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
      const hasPoster = (item: any): boolean => {
        const url = getValidPoster(item);
        return url.startsWith("http") && url.indexOf("placeholder.com") === -1;
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

      // 🔝 Bestbewertete (10.0) zufällig auswählen
      const calcRating = (item: any) => {
        if (item.rating && !isNaN(parseFloat(item.rating))) return parseFloat(item.rating);
        if (item.rating_5based && !isNaN(parseFloat(item.rating_5based))) return parseFloat(item.rating_5based) * 2;
        return 0;
      };
      const moviesWithPerfectRating = filteredMovies.filter((m) => calcRating(m) === 10.0);
      const seriesWithPerfectRating = filteredSeries.filter((s) => calcRating(s) === 10.0);
      const randomMovies = getRandomItems(moviesWithPerfectRating, Math.min(moviesWithPerfectRating.length, 10));
      const randomSeries = getRandomItems(seriesWithPerfectRating, Math.min(seriesWithPerfectRating.length, 10));
      setTopMovies(randomMovies);
      setTopSeries(randomSeries);

      // Nur echte Poster verwenden (nach dem Zufall erneut prüfen)
      const validMovies = filteredMovies.filter(m => hasPoster(m));
      const validSeries = filteredSeries.filter(s => hasPoster(s));

      // Falls weniger als 10 existieren, fülle nur mit echten auf
      const selectedMovies = getRandomItems(
        validMovies.filter((m) => hasPoster(m)),
        Math.min(validMovies.length, 10)
      );
      const selectedSeries = getRandomItems(
        validSeries.filter((s) => hasPoster(s)),
        Math.min(validSeries.length, 10)
      );

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

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem("stream_history");
      setHistory([]);
      console.log("🧹 Verlauf wurde geleert");
    } catch (err) {
      console.error("❌ Fehler beim Löschen des Verlaufs:", err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // No animation for progress bar here; handled in useEffect below
    await AsyncStorage.removeItem("daily_recommendations");
    await loadRecommendations(true);
    // Verlauf frisch laden
    await loadHistory(); // ⬅️ NEU
  };

  // Animate progress bar when refreshing starts
  useEffect(() => {
    if (refreshing) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [refreshing]);

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
          <Image source={{ uri: getValidPoster(item) }} style={styles.posterImage} resizeMode="cover" />
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
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
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
        <Animated.View
          style={[
            styles.headerOverlayDark,
            { opacity: headerBgOpacity },
          ]}
          pointerEvents="none"
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Animated.Image
            source={require("../../assets/logo.png")}
            style={[
              styles.logo,
              {
                transform: [{ scale: logoScale }],
                alignSelf: "flex-start",
              },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Search")}
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: 8,
              }}
            >
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Settings")}
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: 8,
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* INHALT */}
      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: "#000000", paddingHorizontal: 12 }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* 🎬 HERO POSTER LAYOUT */}
        {latestMovie && (
          <View style={styles.heroPosterContainer}>
            <Image
              source={{ uri: getValidPoster(latestMovie) }}
              style={styles.heroPosterImage}
              resizeMode="cover"
              blurRadius={0}
            />
            {/* Neu hinzugefügt Badge direkt über dem Filmtitel */}
            <View
              style={{
                position: "absolute",
                bottom: 180,
                alignSelf: "center",
                backgroundColor: "#E50914",
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
                zIndex: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: 13,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Neu hinzugefügt
              </Text>
            </View>
            {/* Schwarz-Verlauf nach unten */}
            <LinearGradient
              colors={[
                "rgba(0,0,0,0.0)",
                "rgba(0,0,0,0.15)",
                "rgba(0,0,0,0.45)",
                "rgba(10,10,10,0.95)",
                "#0A0A0A",
              ]}
              style={styles.heroPosterGradient}
              pointerEvents="none"
            />
            {/* Header-Overlay bleibt sichtbar */}
            {/* Action Buttons und Titel */}
            <View style={styles.heroActionContainer}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 26,
                  fontWeight: "900",
                  textAlign: "center",
                  letterSpacing: 0.5,
                  marginBottom: 18,
                  textShadowColor: "rgba(0,0,0,0.7)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 8,
                }}
                numberOfLines={2}
              >
                {cleanTitle(latestMovie.name || latestMovie.title || "")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#FFFFFF",
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 30,
                    paddingVertical: 12,
                    paddingHorizontal: 26,
                  }}
                  onPress={() => navigation.navigate("Player", { channels: [latestMovie], currentIndex: 0 })}
                >
                  <Ionicons name="play" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Abspielen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleFavorite}
                  style={{
                    backgroundColor: "#222",
                    borderRadius: 50,
                    padding: 12,
                  }}
                >
                  <Ionicons
                    name={isFavorite ? "star" : "star-outline"}
                    size={22}
                    color={isFavorite ? "#E50914" : "#fff"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        {/* Divider unter Hero */}
        <View style={styles.heroDivider} />
        <View style={{ paddingHorizontal: 12 }}>
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
        </View>

        <View style={styles.refreshContainer}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButtonOutline} activeOpacity={0.85}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.refreshTextMono}>Aktualisieren</Text>
          </TouchableOpacity>
          <Text style={styles.infoText}>
            Sprache ändern unter{" "}
            <Text style={{ color: "#fff" }} onPress={() => navigation.navigate("Settings")}>
              Einstellungen
            </Text>
          </Text>
        </View>

        {/* 📺 Verlauf */}
        {history.length > 0 && (
          <View style={{ marginTop: 40, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Verlauf</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={{ color: "#888", fontSize: 13, textDecorationLine: "underline" }}>Verlauf leeren</Text>
              </TouchableOpacity>
            </View>
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

        {/* --- Bestbewertete Filme Section --- */}
        <View style={{ marginTop: 40, paddingHorizontal: 12 }}>
          <Text style={styles.sectionTitle}>Bestbewertete Filme</Text>
          <View style={styles.sectionDivider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row" }}>
              {topMovies.length ? topMovies.map((m, i) => renderItem(m, i, "movie")) : (
                <Text style={{ color: "#aaa" }}>Keine Top-Filme gefunden</Text>
              )}
            </View>
          </ScrollView>
        </View>
        {/* --- Bestbewertete Serien Section --- */}
        <View style={{ marginTop: 40, paddingHorizontal: 12, marginBottom: 30 }}>
          <Text style={styles.sectionTitle}>Bestbewertete Serien</Text>
          <View style={styles.sectionDivider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row" }}>
              {topSeries.length ? topSeries.map((s, i) => renderItem(s, i, "serie")) : (
                <Text style={{ color: "#aaa" }}>Keine Top-Serien gefunden</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </Animated.ScrollView>

      {/* 🌫️ Minimalistischer Blur-Ladebildschirm */}
      {refreshing && (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.overlayContent}>
            {/* Animated horizontal progress bar */}
            <View style={{
              width: "80%",
              height: 8,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 8,
              overflow: "hidden",
              marginTop: 0,
              marginBottom: 0,
            }}>
              <Animated.View
                style={{
                  height: 8,
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                }}
              />
            </View>
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
    paddingTop: Platform.OS === "ios" ? 45 : 30,
    paddingHorizontal: 14,
    paddingBottom: 0,
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

  // HERO POSTER LAYOUT
  heroPosterContainer: {
    width: "100%",
    height: 400,
    minHeight: 320,
    maxHeight: 440,
    aspectRatio: undefined,
    position: "relative",
    backgroundColor: "#0A0A0A",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroPosterImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
  heroPosterGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 2,
  },
  heroActionContainer: {
    zIndex: 3,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
  },
  heroPlayButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginRight: 8,
    shadowColor: "#111",
    shadowOpacity: 0.13,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroFavoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.78)",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroDivider: {
    height: 1.2,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 22,
    marginTop: 0,
    alignSelf: "stretch",
    borderRadius: 1,
    width: "100%",
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