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

const { height, width } = Dimensions.get("window");

// 🧹 Titel bereinigen
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unbekannt";
  return rawTitle
    .replace(/^.*?-\s*/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 🎬 Erkennung ob Serie
function isSeriesLike(title: string, description?: string): boolean {
  const t = (title || "").toLowerCase();
  const d = (description || "").toLowerCase();
  const seriesHints = ["serie", "tv-serie", "fernsehserie", "(serie", "(tv", "season"];
  return seriesHints.some((h) => t.includes(h) || d.includes(h));
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
async function searchWikipediaForSeries(lang: "de" | "en", query: string) {
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=6`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = (data?.pages || []) as Array<{ title: string; description?: string }>;
  const match =
    pages.find((p) => isSeriesLike(p.title, p.description)) ||
    pages.find((p) => /\(.*serie.*\)/i.test(p.title));
  return match?.title || pages[0]?.title || null;
}

// 🧠 Kombinierte Suche (Serien)
async function fetchSmartWikipediaSummary(rawTitle: string, year?: string | number) {
  const title = cleanTitle(rawTitle);
  const y = typeof year === "number" ? String(year) : (year || "").trim();
  const deQueries = [
    y ? `${title} (${y})` : null,
    `${title} (Fernsehserie)`,
    `${title} (Serie)`,
    title,
  ].filter(Boolean) as string[];
  const enQueries = [
    y ? `${title} (${y} TV series)` : null,
    `${title} (TV series)`,
    `${title} (series)`,
    title,
  ].filter(Boolean) as string[];

  for (const q of deQueries) {
    const found = await searchWikipediaForSeries("de", q);
    if (found) {
      const sum = await fetchSummaryByTitle("de", found);
      if (sum && isSeriesLike(sum.title, sum.description)) return sum;
    }
  }
  for (const q of enQueries) {
    const found = await searchWikipediaForSeries("en", q);
    if (found) {
      const sum = await fetchSummaryByTitle("en", found);
      if (sum && isSeriesLike(sum.title, sum.description)) return sum;
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
function extractSeriesInfo(text?: string): { year?: string; genre?: string } {
  if (!text) return {};
  const lower = text.toLowerCase();
  const yearMatch = lower.match(/(?:jahr|year)\s+(\d{4})/);
  const year = yearMatch ? yearMatch[1] : undefined;

  const genreRegex =
    /ist\s+(?:eine|ein)?\s*(?:[a-zäöüß\-]+\s+)?((?:[a-zäöüß\-]+(?:[-\s]?[a-zäöüß\-]+)?)(?:serie|komödie|drama|thriller|krimi|sci[-\s]?fi|fantasy|action|animation|abenteuer))/i;
  const genreMatch = text.match(genreRegex);
  return { year, genre: genreMatch ? genreMatch[1] : undefined };
}

// ✂️ Episodentitel bereinigen
function cleanEpisodeTitle(raw: string): string {
  if (!raw) return "Unbenannt";
  // Entferne Sprachen, Jahreszahlen und doppelte Episodeninfos
  return raw
    .replace(/^.*S\d{1,2}E\d{1,2}\s*-\s*/i, "") // Entfernt S01E01 - Präfixe
    .replace(/\b(DE|EN|FR|TR|ES)\b/gi, "") // Sprachen entfernen
    .replace(/\(\d{4}\)/g, "") // Jahreszahlen entfernen
    .replace(/[-–]{2,}/g, "-") // Doppelte Bindestriche glätten
    .replace(/\s{2,}/g, " ") // Mehrfache Leerzeichen entfernen
    .trim();
}

// 🎞 SeriesDetailScreen
export default function SeriesDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { serie } = route.params;

  const poster =
    serie.cover ||
    serie.stream_icon ||
    serie.series_image ||
    serie.poster ||
    "https://via.placeholder.com/300x450.png?text=Kein+Bild";

  const rawTitle = serie.name || serie.title || serie.stream_display_name || "Unbekannt";
  const title = cleanTitle(rawTitle);

  const [info, setInfo] = useState<{ year?: string; genre?: string }>({});
  const [descState, setDescState] = useState<{
    loading: boolean;
    text?: string | null;
    lang?: "de" | "en";
    wikidataId?: string | null;
  }>({ loading: true });
  const [cast, setCast] = useState<Array<{ name: string; image?: string }>>([]);
  const [showFull, setShowFull] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // 🆕 NEU: Tab-Bar States
  const [activeTab, setActiveTab] = useState<"episoden" | "besetzung">("episoden");
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonPickerVisible, setSeasonPickerVisible] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<Record<string, any[]>>({});
  const filteredEpisodes = allEpisodes[selectedSeason] || [];

  const animateUnderline = (index: number) => {
    Animated.spring(underlineAnim, { toValue: index, useNativeDriver: true }).start();
  };
    const panY = useRef(new Animated.Value(0)).current;
  const opacity = panY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      // Nur Swipes im Header-Bereich erlauben
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const { locationY } = evt.nativeEvent;
        const isInHeader = locationY <= height * 0.55; // Nur oberes Titelbild
        return isInHeader && gestureState.dy > 10;
      },
      onMoveShouldSetPanResponder: () => false, // Verhindert Aktivierung außerhalb des Headers
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) panY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) {
          Animated.timing(panY, {
            toValue: height,
            duration: 250,
            useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // 🟠 Favoritenstatus prüfen
  useEffect(() => {
    (async () => {
      const stored = JSON.parse((await AsyncStorage.getItem("favorites_series")) || "[]");
      setIsFavorite(stored.some((m: any) => m.name === serie.name));
    })();
  }, [serie.name]);

  // ⭐ Favorit speichern/entfernen
  const toggleFavorite = async () => {
    const key = "favorites_series";
    const stored = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
    const exists = stored.some((m: any) => m.name === serie.name);
    const newList = exists ? stored.filter((m: any) => m.name !== serie.name) : [...stored, serie];
    await AsyncStorage.setItem(key, JSON.stringify(newList));
    setIsFavorite(!exists);
  };

  // 🎞 Serien-Episoden laden
  async function loadSeriesData(seriesId: string | number) {
    try {
      const resp = await fetch("http://192.168.2.101:8000/sessions.json");
      const data = await resp.json();
      const base = data.base_url;
      const user = data.username;
      const pass = data.password;

      const url = `${base}/player_api.php?username=${user}&password=${pass}&action=get_series_info&series_id=${seriesId}`;
      console.log("📡 Lade Serieninfos von:", url);

      const res = await fetch(url);
      const json = await res.json();

      const seasonsList = json.seasons || [];
      const episodesBySeason = json.episodes || {};

      setSeasons(seasonsList);
      setAllEpisodes(episodesBySeason);

      // Standard: erste Staffel vorauswählen
      if (seasonsList.length > 0) {
        setSelectedSeason(seasonsList[0].season_number);
      }
    } catch (err) {
      console.log("❌ Fehler beim Laden der Episoden:", err);
    }
  }

  // 🎬 Trailer öffnen
  const openTrailer = async () => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} serie trailer`)}`;
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
        const extracted = extractSeriesInfo(summary.extract);
        setInfo(extracted);
        setDescState({
          loading: false,
          text: summary.extract,
          lang: summary.lang,
          wikidataId: summary.wikidataId,
        });
        let castData: any[] = [];
        if (summary.wikidataId) castData = await fetchCastFromWikidata(summary.wikidataId);
        if (active) setCast(castData);
      } else {
        setDescState({ loading: false, text: null });
      }
      if (serie.series_id) {
        await loadSeriesData(serie.series_id);
      }
    })();
    return () => {
      active = false;
    };
  }, [title]);

  const displayYear = info.year || serie.year || "Unbekannt";
  const displayGenre = info.genre || serie.genre || serie.category_name || "Unbekannt";

  return (
    <Animated.View
      style={{ flex: 1, backgroundColor: "#000", transform: [{ translateY: panY }], opacity }}
    >
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
      <ImageBackground
        source={{ uri: poster }}
        style={{ width: "100%", height: height * 0.55, justifyContent: "flex-end" }}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "rgba(0,0,0,1)"]}
          style={{
            height: "100%",
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 40,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center" }}>
            {title}
          </Text>
        </LinearGradient>
      </ImageBackground>

      {/* Hauptinhalt */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 20, marginTop: 10 }}>
        <Text style={{ color: "#bbb", fontSize: 14, marginVertical: 10, textAlign: "center" }}>
          {displayYear !== "Unbekannt" || displayGenre !== "Unbekannt"
            ? `${displayYear} • ${displayGenre}`
            : "Keine Informationen verfügbar"}
        </Text>

        {/* ▶️ / 🎞 / ⭐ */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: "#fff",
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 30,
              paddingVertical: 14,
              paddingHorizontal: 35,
            }}
            onPress={() => navigation.navigate("Player", { channels: [serie], currentIndex: 0 })}
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

          {/* ⭐ Favoriten */}
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

        {/* Beschreibung */}
        {descState.loading ? (
          <ActivityIndicator size="small" color="#ff5722" />
        ) : (
          <>
            {descState.text && (
              <>
                <Text
                  numberOfLines={showFull ? 10 : 3}
                  style={{
                    color: "#bbb",
                    fontSize: 15,
                    textAlign: "center",
                    marginBottom: 6,
                  }}
                >
                  {descState.text}
                </Text>
                {descState.text.split(" ").length > 25 && (
                  <TouchableOpacity onPress={() => setShowFull(!showFull)}>
                    <Text style={{ color: "#ff5722", fontSize: 15, textAlign: "center" }}>
                      {showFull ? "Weniger anzeigen" : "…mehr"}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ⬇️ NEU: Tab-Bar */}
            <View style={{ marginTop: 35 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  borderBottomWidth: 1,
                  borderBottomColor: "#333",
                  paddingBottom: 10,
                }}
              >
                {["episoden", "besetzung"].map((tab, i) => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => {
                      setActiveTab(tab as any);
                      animateUnderline(i);
                    }}
                  >
                    <Text
                      style={{
                        color: activeTab === tab ? "#fff" : "#777",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {tab === "episoden" ? "Episoden" : "Besetzung"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Animated.View
                style={{
                  height: 2,
                  width: width * 0.4,
                  backgroundColor: "#fff",
                  transform: [
                    {
                      translateX: underlineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [width * 0.05, width * 0.55],
                      }),
                    },
                  ],
                }}
              />

              {/* Inhalt Tabs */}
              {activeTab === "episoden" ? (
                <View style={{ marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => setSeasonPickerVisible(!seasonPickerVisible)}
                    style={{
                      backgroundColor: "#111",
                      borderRadius: 25,
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      alignSelf: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 15 }}>
                      Staffel auswählen: {selectedSeason}
                    </Text>
                  </TouchableOpacity>

                  {seasonPickerVisible && (
                    <View
                      style={{
                        backgroundColor: "#111",
                        borderRadius: 12,
                        marginTop: 10,
                        padding: 10,
                      }}
                    >
                      {seasons.length > 0
                        ? seasons.map((s) => (
                            <TouchableOpacity
                              key={s.season_number}
                              onPress={() => {
                                setSelectedSeason(s.season_number);
                                setSeasonPickerVisible(false);
                              }}
                              style={{
                                paddingVertical: 10,
                                borderBottomColor: "#222",
                                borderBottomWidth:
                                  s.season_number === seasons[seasons.length - 1].season_number ? 0 : 1,
                              }}
                            >
                              <Text style={{ color: "#fff", textAlign: "center" }}>
                                Staffel {s.season_number}
                              </Text>
                            </TouchableOpacity>
                          ))
                        : [1, 2].map((s) => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => {
                                setSelectedSeason(s);
                                setSeasonPickerVisible(false);
                              }}
                              style={{
                                paddingVertical: 10,
                                borderBottomColor: "#222",
                                borderBottomWidth: s === 2 ? 0 : 1,
                              }}
                            >
                              <Text style={{ color: "#fff", textAlign: "center" }}>
                                Staffel {s}
                              </Text>
                            </TouchableOpacity>
                          ))}
                    </View>
                  )}

                  <View style={{ marginTop: 20 }}>
                    {filteredEpisodes.length > 0 ? (
                      filteredEpisodes.map((ep, i) => (
                        <TouchableOpacity
                          key={i}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            padding: 8,
                            marginBottom: 10,
                            borderRadius: 10,
                          }}
                          onPress={() =>
                            navigation.navigate("Player", {
                              channels: [{ name: ep.title, stream_id: ep.id }],
                              currentIndex: 0,
                            })
                          }
                        >
                          <View
                            style={{
                              width: 50,
                              height: 50,
                              backgroundColor: "#222",
                              borderRadius: 8,
                              justifyContent: "center",
                              alignItems: "center",
                              marginRight: 12,
                            }}
                          >
                            <Ionicons name="play" size={22} color="#fff" />
                          </View>
                          <Text style={{ color: "#fff", fontSize: 15 }}>
                            {`S${String(selectedSeason).padStart(2, "0")}E${String(ep.episode_num).padStart(2, "0")} – ${cleanEpisodeTitle(ep.title)}`}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={{ color: "#777", textAlign: "center", marginTop: 10 }}>
                        Keine Episoden gefunden
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 20 }}>
                  {cast.length > 0 ? (
                    cast.map((actor, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        {actor.image && (
                          <Image
                            source={{ uri: actor.image }}
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 25,
                              marginRight: 12,
                            }}
                          />
                        )}
                        <Text style={{ color: "#ccc", fontSize: 16 }}>{actor.name}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: "#777", textAlign: "center", marginTop: 10 }}>
                      Keine Besetzungsdaten gefunden
                    </Text>
                  )}
                </View>
              )}
            </View>

            <Text
              style={{
                color: "#666",
                fontSize: 11,
                textAlign: "center",
                marginTop: 20,
              }}
            >
              Quelle: Wikipedia{" "}
              {descState.lang ? `(${descState.lang.toUpperCase()})` : ""} – CC BY-SA 4.0
            </Text>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}