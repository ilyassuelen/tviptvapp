import React, { useEffect, useState, useRef } from "react";
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
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const navigation = useNavigation<any>();

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
        setSearchText("");
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
    setSearchText(text);
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
        <ActivityIndicator size="large" color="#ff5722" />
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
    const title = cleanTitle(
      movie.name || movie.title || movie.stream_display_name || "Unbekannt"
    );

    return (
      <TouchableOpacity
        key={index}
        style={{
          width: 140,
          marginRight: 20,
          backgroundColor: "#111",
          borderRadius: 8,
          overflow: "hidden",
        }}
        onPress={() => navigation.navigate("MovieDetail", { movie })}
      >
        <Image
          source={{ uri: posterUri }}
          style={{
            width: "100%",
            height: 180,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
          resizeMode="cover"
        />
        <View style={{ padding: 8 }}>
          <Text
            style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ===============================
  // 🔝 HEADER
  // ===============================
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#000",
          paddingTop: Platform.OS === "ios" ? 45 : 25,
          paddingBottom: 10,
          paddingHorizontal: 14,
          zIndex: 100,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "700",
            fontFamily: "Orbitron",
          }}
        >
          Movies
        </Text>

        <TouchableOpacity onPress={toggleSearch}>
          <Ionicons
            name={searchVisible ? "close" : "search"}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>
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
                <Text style={{ color: "#ff5722", fontWeight: "600" }}>
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
              value={searchText}
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

const styles = {
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
};