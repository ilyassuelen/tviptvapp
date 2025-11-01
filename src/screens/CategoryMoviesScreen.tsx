import React, { useState, useEffect } from "react";
import {
  View, Text, Image, FlatList, TouchableOpacity,
  Platform, Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Font from "expo-font";

const { width } = Dimensions.get("window");

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

  const [sorted, setSorted] = useState(false);
  const [displayedMovies, setDisplayedMovies] = useState(movies || []);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const handleSort = () => {
    if (sorted) {
      // Ursprüngliche Reihenfolge wiederherstellen
      setDisplayedMovies(movies);
      setSorted(false);
    } else {
      // Nach bester Bewertung sortieren
      const sortedMovies = [...displayedMovies].sort((a, b) => {
        const ratingA = parseFloat(a.rating || a.rating_5based * 2 || 0);
        const ratingB = parseFloat(b.rating || b.rating_5based * 2 || 0);
        return ratingB - ratingA;
      });
      setDisplayedMovies(sortedMovies);
      setSorted(true);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          Bungee: require("../../assets/fonts/Bungee.ttf"),
        });
        setFontsLoaded(true);
      } catch (e) {
        setFontsLoaded(true);
      }
    })();
  }, []);

  // HomeScreen-style: skip images with "no_image", .php, etc.
  function isValidImage(img: string | undefined | null) {
    if (!img) return false;
    if (img.toLowerCase().includes("no_image")) return false;
    if (img.toLowerCase().endsWith(".php")) return false;
    if (img.trim() === "") return false;
    return true;
  }

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const img =
      item.stream_icon ||
      item.movie_image ||
      item.poster ||
      "";
    const rawTitle = item.name || item.title || item.stream_display_name || "Unbekannt";
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

    // HomeScreen: skip invalid images
    if (!isValidImage(img)) {
      return null;
    }

  return (
    <TouchableOpacity
      key={index}
      activeOpacity={0.9}
      onPress={() => navigation.navigate("MovieDetail", { movie: item })}
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

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
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
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginLeft: 10 }}>
          {categoryName}
        </Text>
      </View>

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

      <FlatList
        data={displayedMovies}
        numColumns={3}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => renderItem({ item, index })}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 50 }}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 14 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = require("react-native").StyleSheet.create({
  posterContainer: {
    width: "31.5%",
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
});