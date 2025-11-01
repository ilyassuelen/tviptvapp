import React, { useEffect, useState, useRef } from "react";
import { useTVEventHandler } from "react-native";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Animated,
  FlatList,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import { VLCPlayer } from "react-native-vlc-media-player";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Font from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildApiUrl } from "../api/config";
import { LinearGradient } from "expo-linear-gradient";

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle
    .replace(/^.*?-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function MoviesScreen() {
  const [loading, setLoading] = useState(true);
  const [movieCategories, setMovieCategories] = useState<any[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  // TV-Fokus-Unterstützung
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const tvEventHandler = (evt: any) => {
    if (evt && evt.eventType) {
      console.log("📺 TV-Event:", evt.eventType);
    }
  };
  useTVEventHandler(tvEventHandler);

  // Animationen
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-80)).current;

  const BACKEND_URL = buildApiUrl("/iptv/movies");

  // ===============================
  // 📦 Daten laden
  // ===============================
  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        Orbitron: require("../../assets/fonts/Prisma.ttf"),
        Bungee: require("../../assets/fonts/Bungee.ttf"),
      });
      setFontsLoaded(true);
    };

    const loadMovies = async () => {
      try {
        const saved = await AsyncStorage.getItem("iptv_session");
        if (!saved) return;
        const { serverUrl, username, password } = JSON.parse(saved);

        // 1️⃣ Kategorien laden
        const catRes = await fetch(
          `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`
        );
        const catText = await catRes.text();
        const categories = JSON.parse(catText);

        // 2️⃣ Filme laden
        const movieRes = await fetch(
          `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`
        );
        const movieText = await movieRes.text();
        const movies = JSON.parse(movieText);

        // 3️⃣ Kategorie-Map aufbauen
        const catMap: Record<string, string> = {};
        categories.forEach((c: any) => {
          catMap[c.category_id] = c.category_name;
        });

        // 4️⃣ Filme nach Kategorie gruppieren
        const grouped: Record<string, any[]> = {};
        movies.forEach((movie: any) => {
          const catName = catMap[movie.category_id] || "Unbekannt";
          if (!grouped[catName]) grouped[catName] = [];
          grouped[catName].push(movie);
        });

        const categoryList = Object.entries(grouped).map(([category_name, movies]) => ({
          category_name,
          movies,
        }));

        setMovieCategories(categoryList);
        setLoading(false);
      } catch (err) {
        console.error("❌ Fehler beim Laden der Filme:", err);
        setError("Fehler beim Laden der Filme");
        setLoading(false);
      }
    };

    loadFonts();
    loadMovies();
  }, []);

  // ===============================
  // 🔍 Suche umschalten mit Animation
  // ===============================
  const toggleSearch = () => {
    if (searchVisible) {
      // ausblenden
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSearchVisible(false);
        setSearch("");
        setSearchResults([]);
      });
    } else {
      setSearchVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // ===============================
  // 🔎 Filme durchsuchen
  // ===============================
  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    const lower = text.toLowerCase();
    const results: any[] = [];

    movieCategories.forEach((cat) => {
      cat.movies.forEach((movie: any) => {
        const rawTitle =
          movie.name || movie.title || movie.stream_display_name || "";
        if (rawTitle.toLowerCase().includes(lower)) {
          results.push(movie);
        }
      });
    });

    setSearchResults(results);
  };

  // ===============================
  // 📱 UI-Render
  // ===============================
  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Lade Filme...</Text>
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

  const placeholderImage =
    "https://via.placeholder.com/140x180.png?text=Kein+Bild";

  const renderMovie = (movie: any, index: number) => {
    const posterUri =
      movie.stream_icon || movie.movie_image || movie.poster || placeholderImage;
    // Validate posterUri (skip bad images)
    if (
      !posterUri ||
      typeof posterUri !== "string" ||
      posterUri.trim() === "" ||
      posterUri.toLowerCase().includes("no_image") ||
      posterUri.toLowerCase().includes("null") ||
      posterUri.toLowerCase().includes("missing") ||
      posterUri.endsWith(".php") ||
      posterUri.endsWith(".txt") ||
      posterUri.startsWith("http") === false
    ) {
      return null;
    }
    const title = cleanTitle(
      movie.name || movie.title || movie.stream_display_name || "Unbekannt"
    );

    // Rating-Badge-Logik
    let displayRating = null;
    if (movie.rating !== undefined && movie.rating !== null && movie.rating !== "") {
      displayRating = parseFloat(movie.rating);
    } else if (movie.rating_5based !== undefined && movie.rating_5based !== null) {
      displayRating = parseFloat(movie.rating_5based) * 2;
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
          onPress={() => navigation.navigate("MovieDetail", { movie })}
          style={[
            styles.posterContainer,
            focusedIndex === index && { borderColor: "#E50914", borderWidth: 3 },
          ]}
        >
          <Image source={{ uri: posterUri }} style={styles.posterImage} resizeMode="cover" />
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

  // ===============================
  // 🔝 HEADER
  // ===============================
  // Neue Header-Implementierung wie FavoritesScreen
  // searchVisible, setSearchVisible, search, setSearch bleiben erhalten
  // Für Konsistenz: searchText -> search, setSearchText -> setSearch
  // Wir mappen searchText <-> search, setSearchText <-> setSearch
  // (Im Original: const [searchText, setSearchText] = useState("");)
  //const [search, setSearch] = useState("");
  // searchVisible und setSearchVisible sind schon oben definiert
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
        {!searchVisible ? (
          <>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Filme</Text>
          </>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#111",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Ionicons name="search" size={18} color="#aaa" style={{ marginRight: 6 }} />
            <TextInput
              placeholder="Filme durchsuchen..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
              style={{ color: "#fff", flex: 1, fontSize: 15 }}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setSearchVisible(false); setSearch(""); }}>
              <Ionicons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 🎞️ Movie-Kategorien */}
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#000",
          paddingHorizontal: 10,
          paddingTop: Platform.OS === "ios" ? 70 : 55,
        }}
      >
        {movieCategories.map((cat, index) => (
          <View key={index} style={{ marginBottom: 25 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  color: "#ddd",
                  fontSize: 17,
                  fontWeight: "700",
                }}
              >
                {cat.category_name}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("CategoryMovies", {
                    categoryName: cat.category_name,
                    movies: cat.movies,
                  })
                }
              >
                <Text style={{ color: "#E50914", fontWeight: "600" }}>
                  Mehr ›
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cat.movies.length > 0 ? (
                cat.movies.slice(0, 10).map(renderMovie)
              ) : (
                <Text style={{ color: "#aaa" }}>Keine Filme gefunden</Text>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* 🔍 Such-Overlay */}
      {searchVisible && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            opacity: fadeAnim,
            zIndex: 200,
          }}
        >
          <TouchableWithoutFeedback onPress={toggleSearch}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          {/* Suchfeld */}
          <Animated.View
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 70 : 50,
              left: 20,
              right: 20,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <TextInput
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                borderRadius: 12,
                paddingHorizontal: 15,
                paddingVertical: 10,
                color: "#fff",
                fontSize: 16,
              }}
              placeholder="Film suchen..."
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={handleSearch}
              autoFocus
            />
          </Animated.View>

          {/* Ergebnisse */}
          <FlatList
            data={searchResults}
            keyExtractor={(_, i) => String(i)}
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 120 : 100,
              left: 20,
              right: 20,
              maxHeight: "70%",
              // 🆕 Dunkler Hintergrund für die Ergebnisliste
              backgroundColor: "rgba(20,20,20,0.95)",
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
            renderItem={({ item }) => {
              const title = cleanTitle(
                item.name || item.title || item.stream_display_name || "Unbekannt"
              );
              return (
                <TouchableOpacity
                  onPress={() => {
                    setSearchVisible(false);
                    navigation.navigate("MovieDetail", { movie: item });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Image
                    source={{
                      uri:
                        item.stream_icon ||
                        item.movie_image ||
                        item.poster ||
                        placeholderImage,
                    }}
                    style={{
                      width: 50,
                      height: 70,
                      borderRadius: 6,
                      marginRight: 12,
                    }}
                  />
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

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },


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