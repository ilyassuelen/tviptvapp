import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  PanResponder,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height } = Dimensions.get("window");

// 🧹 Titel bereinigen
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle
    .replace(/^.*?-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isFilmLike(title: string, description?: string): boolean {
  const t = (title || "").toLowerCase();
  const d = (description || "").toLowerCase();
  const filmHints = ["film", "spielfilm", "fernsehfilm", "(film", "(fernsehfilm"];
  return filmHints.some((h) => t.includes(h) || d.includes(h));
}

// 📘 Wikipedia Summary
async function fetchSummaryByTitle(lang: "de" | "en", pageTitle: string) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.extract) return null;
  return {
    title: data.title,
    description: data.description,
    extract: data.extract,
    lang,
    wikidataId: data.wikibase_item || null,
  };
}

// 🔎 Wikipedia-Suche
async function searchWikipediaForFilm(lang: "de" | "en", query: string) {
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=6`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = (data?.pages || []) as Array<{ title: string; description?: string }>;
  const match =
    pages.find((p) => isFilmLike(p.title, p.description)) ||
    pages.find((p) => /\(.*film.*\)/i.test(p.title));
  return match?.title || pages[0]?.title || null;
}

// 🧠 Kombinierte Suche
async function fetchSmartWikipediaSummary(rawTitle: string, year?: string | number) {
  const title = cleanTitle(rawTitle);
  const y = typeof year === "number" ? String(year) : (year || "").trim();
  const deQueries = [y ? `${title} (${y})` : null, `${title} (Film)`, title].filter(Boolean) as string[];
  const enQueries = [y ? `${title} (${y} film)` : null, `${title} (film)`, title].filter(Boolean) as string[];

  for (const q of deQueries) {
    const found = await searchWikipediaForFilm("de", q);
    if (found) {
      const sum = await fetchSummaryByTitle("de", found);
      if (sum && isFilmLike(sum.title, sum.description)) return sum;
    }
  }
  for (const q of enQueries) {
    const found = await searchWikipediaForFilm("en", q);
    if (found) {
      const sum = await fetchSummaryByTitle("en", found);
      if (sum && isFilmLike(sum.title, sum.description)) return sum;
    }
  }
  return null;
}

// 🎭 Cast aus Wikidata
async function fetchCastFromWikidata(wikidataId: string) {
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
    const res = await fetch(url);
    const data = await res.json();
    const entity = data.entities[wikidataId];
    const castClaims = entity.claims?.P161;
    if (!castClaims) return [];
    const actors: Array<{ name: string; image?: string }> = [];
    for (const claim of castClaims.slice(0, 10)) {
      const actorId = claim.mainsnak?.datavalue?.value?.id;
      if (!actorId) continue;
      const actor = data.entities[actorId];
      if (!actor) continue;
      const name = actor.labels?.de?.value || actor.labels?.en?.value;
      const imageClaim = actor.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      const image = imageClaim
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageClaim)}?width=120`
        : null;
      if (name) actors.push({ name, image });
    }
    return actors;
  } catch {
    return [];
  }
}

// 🧩 Jahr & Genre
function extractFilmInfo(text?: string): { year?: string; genre?: string } {
  if (!text) return {};
  const lower = text.toLowerCase();
  const yearMatch = lower.match(/(?:jahr|year)\s+(\d{4})/);
  const year = yearMatch ? yearMatch[1] : undefined;

  const genreRegex =
    /ist\s+(?:ein|eine)?\s*(?:[a-zäöüß\-]+\s+)?((?:[a-zäöüß\-]+(?:[-\s]?[a-zäöüß\-]+)?)(?:film|thriller|drama|komödie|horror|krimi|western|abenteuer|dokumentarfilm|science[-\s]?fiction|action|romanze|biografie|fantasy))/i;
  const genreMatch = text.match(genreRegex);
  return { year, genre: genreMatch ? genreMatch[1] : undefined };
}

// 🎬 Hauptkomponente
export default function MovieDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { movie } = route.params;

  const poster =
    movie.stream_icon ||
    movie.movie_image ||
    movie.poster ||
    "https://via.placeholder.com/300x450.png?text=Kein+Bild";

  const rawTitle = movie.name || movie.title || movie.stream_display_name || "Unbekannt";
  const title = cleanTitle(rawTitle);

  const [info, setInfo] = useState<{ year?: string; genre?: string }>({});
  const [descState, setDescState] = useState<{ loading: boolean; text?: string | null; lang?: "de" | "en"; wikidataId?: string | null }>({ loading: true });
  const [cast, setCast] = useState<Array<{ name: string; image?: string }>>([]);
  const [showFull, setShowFull] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false); // ⭐ Favoritenstatus

  const panY = useRef(new Animated.Value(0)).current;
  const opacity = panY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) panY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) {
          Animated.timing(panY, { toValue: height, duration: 250, useNativeDriver: true }).start(() => navigation.goBack());
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // 🟠 Favoritenstatus beim Öffnen prüfen
  useEffect(() => {
    (async () => {
      const stored = JSON.parse((await AsyncStorage.getItem("favorites_movies")) || "[]");
      setIsFavorite(stored.some((m: any) => m.name === movie.name));
    })();
  }, [movie.name]);

  // ⭐ Favorit speichern/entfernen
  const toggleFavorite = async () => {
    const key = "favorites_movies";
    const stored = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
    const exists = stored.some((m: any) => m.name === movie.name);
    const newList = exists ? stored.filter((m: any) => m.name !== movie.name) : [...stored, movie];
    await AsyncStorage.setItem(key, JSON.stringify(newList));
    setIsFavorite(!exists);
  };

  const openTrailer = async () => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`;
    try {
      await Linking.openURL(searchUrl);
    } catch {
      Alert.alert("Fehler", "Konnte YouTube nicht öffnen.");
    }
  };

  // 📘 Wikipedia laden
  useEffect(() => {
    let active = true;
    (async () => {
      const summary = await fetchSmartWikipediaSummary(title);
      if (!active) return;
      if (summary?.extract) {
        const extracted = extractFilmInfo(summary.extract);
        setInfo(extracted);
        setDescState({ loading: false, text: summary.extract, lang: summary.lang, wikidataId: summary.wikidataId });
        let castData: any[] = [];
        if (summary.wikidataId) castData = await fetchCastFromWikidata(summary.wikidataId);
        if (castData.length === 0) {
            castData = [];
        }
        if (summary.wikidataId) castData = await fetchCastFromWikidata(summary.wikidataId);
        if (castData.length === 0) {
          const backupCast = await fetchCastFromWikipediaHTML(summary.lang || "en", summary.title);
          castData = backupCast;
        }
        if (active) setCast(castData);
      } else {
        setDescState({ loading: false, text: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [title]);

  const displayYear = info.year || movie.year || "Unbekannt";
  const displayGenre = info.genre || movie.genre || movie.category_name || "Unbekannt";

  return (
    <Animated.View style={{ flex: 1, backgroundColor: "#000", transform: [{ translateY: panY }], opacity }} {...panResponder.panHandlers}>
      {/* 🔙 Back */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          position: "absolute",
          top: Platform.OS === "ios" ? 60 : 30,
          left: 20,
          zIndex: 10,
          backgroundColor: "rgba(0,0,0,0.4)",
          borderRadius: 20,
          padding: 6,
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 🎬 Header */}
      <ImageBackground source={{ uri: poster }} style={{ width: "100%", height: height * 0.55, justifyContent: "flex-end" }}>
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "rgba(0,0,0,1)"]}
          style={{ height: "100%", width: "100%", justifyContent: "flex-end", alignItems: "center", paddingBottom: 40 }}
        >
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center" }}>{title}</Text>
        </LinearGradient>
      </ImageBackground>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20, marginTop: 10 }}>
        <Text style={{ color: "#bbb", fontSize: 14, marginVertical: 10, textAlign: "center" }}>
          {displayYear !== "Unbekannt" || displayGenre !== "Unbekannt" ? `${displayYear} • ${displayGenre}` : "Keine Informationen verfügbar"}
        </Text>

        {/* ▶️ / 🎞 / ⭐ */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            style={{
              backgroundColor: "#fff",
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 30,
              paddingVertical: 14,
              paddingHorizontal: 35,
            }}
            onPress={() => navigation.navigate("Player", { channels: [movie], currentIndex: 0 })}
          >
            <Ionicons name="play" size={22} color="#000" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Abspielen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#ff5722",
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 30,
              paddingVertical: 14,
              paddingHorizontal: 28,
            }}
            onPress={openTrailer}
          >
            <Ionicons name="film" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Trailer</Text>
          </TouchableOpacity>

          {/* ⭐ Favoritenbutton */}
          <TouchableOpacity
            onPress={toggleFavorite}
            style={{
              backgroundColor: "#222",
              borderRadius: 50,
              padding: 14,
            }}
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={22}
              color={isFavorite ? "#ff5722" : "#fff"}
            />
          </TouchableOpacity>
        </View>

        {/* Wikipedia Beschreibung & Cast (unverändert) */}
        {descState.loading ? (
          <ActivityIndicator size="small" color="#ff5722" />
        ) : (
          <>
            {descState.text && (
              <>
                <Text numberOfLines={showFull ? 10 : 3} style={{ color: "#bbb", fontSize: 15, textAlign: "center", marginBottom: 6 }}>
                  {descState.text}
                </Text>
                {descState.text.split(" ").length > 25 && (
                  <TouchableOpacity onPress={() => setShowFull(!showFull)}>
                    <Text style={{ color: "#ff5722", fontSize: 15, textAlign: "center" }}>{showFull ? "Weniger anzeigen" : "…mehr"}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {cast.length > 0 ? (
              <View style={{ marginTop: 25 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Besetzung</Text>
                {cast.map((actor, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                    {actor.image && <Image source={{ uri: actor.image }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }} />}
                    <Text style={{ color: "#ccc", fontSize: 16 }}>{actor.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: "#777", textAlign: "center", marginTop: 15 }}>Keine Besetzungsdaten gefunden</Text>
            )}
            <Text style={{ color: "#666", fontSize: 11, textAlign: "center", marginTop: 10 }}>
              Quelle: Wikipedia {descState.lang ? `(${descState.lang.toUpperCase()})` : ""} – CC BY-SA 4.0
            </Text>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}