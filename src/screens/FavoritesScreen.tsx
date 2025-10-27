import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// 🧹 Hilfsfunktion: Titel bereinigen
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle
    .replace(/^.*?-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(DE|GER|German|1080p|720p|4K|FULLHD)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function FavoritesScreen({ navigation }: any) {
  const [category, setCategory] = useState<"TV" | "MOVIES" | "SERIEN">("MOVIES");
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [movieFavorites, setMovieFavorites] = useState<any[]>([]);
  const [tvFavorites, setTvFavorites] = useState<any[]>([]);
  const [seriesFavorites, setSeriesFavorites] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);

  // 🔹 Favoriten aus allen Kategorien laden
  useEffect(() => {
    const loadFavorites = async () => {
      const movies = JSON.parse((await AsyncStorage.getItem("favorites_movies")) || "[]");
      const tv = JSON.parse((await AsyncStorage.getItem("favorites_tv")) || "[]");
      const series = JSON.parse((await AsyncStorage.getItem("favorites_series")) || "[]");

      setMovieFavorites(movies);
      setTvFavorites(tv);
      setSeriesFavorites(series);
      setFiltered(movies); // Standard = Movies
    };
    loadFavorites();
  }, []);

  // 🔹 Suchfunktion – durchsucht ALLE Favoriten
  useEffect(() => {
    if (!searchVisible || search.trim() === "") {
      // Wenn keine Suche aktiv, filtere nach Kategorie
      if (category === "MOVIES") setFiltered(movieFavorites);
      else if (category === "TV") setFiltered(tvFavorites);
      else setFiltered(seriesFavorites);
    } else {
      // Suche in allen Favoriten gleichzeitig
      const all = [...movieFavorites, ...tvFavorites, ...seriesFavorites];
      const results = all.filter((item) =>
        (item.name || "").toLowerCase().includes(search.toLowerCase())
      );
      setFiltered(results);
    }
  }, [search, searchVisible, category, movieFavorites, tvFavorites, seriesFavorites]);

  const renderMovie = (m: any, i: number) => (
    <TouchableOpacity
      key={i}
      style={{
        width: 140,
        marginRight: 20,
        alignItems: "center",
      }}
      onPress={() => navigation.navigate("MovieDetail", { movie: m })}
    >
      <Image
        source={{
          uri: m.poster || m.stream_icon || "https://via.placeholder.com/140x180?text=Kein+Bild",
        }}
        style={{ width: 140, height: 180, borderRadius: 8 }}
      />
      <Text
        style={{
          color: "#fff",
          fontWeight: "600",
          fontSize: 13,
          textAlign: "center",
          marginTop: 6,
          width: 130,
        }}
        numberOfLines={1}
      >
        {cleanTitle(m.name || m.title || "")}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* HEADER (wie bei MoviesScreen) */}
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
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Favoriten</Text>
            <TouchableOpacity onPress={() => setSearchVisible(true)}>
              <Ionicons name="search" size={22} color="#fff" />
            </TouchableOpacity>
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
              placeholder="Favoriten durchsuchen..."
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

      {/* Tabs */}
      {!searchVisible && (
        <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 10 }}>
          {["TV", "MOVIES", "SERIEN"].map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setCategory(t as any)}
              style={{
                backgroundColor: category === t ? "#ff5722" : "#222",
                paddingVertical: 8,
                paddingHorizontal: 20,
                borderRadius: 20,
                marginHorizontal: 4,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Inhalte / Suchergebnisse */}
      <ScrollView style={{ paddingHorizontal: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filtered.length > 0 ? (
            filtered.map(renderMovie)
          ) : (
            <Text style={{ color: "#888", marginTop: 20 }}>
              {searchVisible
                ? "Keine passenden Favoriten gefunden"
                : "Keine Favoriten in dieser Kategorie"}
            </Text>
          )}
        </ScrollView>
      </ScrollView>
    </View>
  );
}