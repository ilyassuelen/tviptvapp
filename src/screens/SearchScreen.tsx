import React, { useState } from "react";
import {
  View, Text, TextInput, ScrollView, Image, TouchableOpacity, ActivityIndicator, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getXtreamInfo, setXtreamConnection } from "../store";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  const placeholderImage = "https://via.placeholder.com/140x180.png?text=Kein+Bild";
  const cleanTitle = (t: string) => t?.replace(/^.*?-\s*/i, "").replace(/\(.*?\)/g, "").trim();

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

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const info = await ensureSession();
      const base = `${info.serverUrl}/player_api.php?username=${info.username}&password=${info.password}`;

      const [vodRes, seriesRes, liveRes] = await Promise.all([
        fetch(`${base}&action=get_vod_streams`),
        fetch(`${base}&action=get_series`),
        fetch(`${base}&action=get_live_streams`),
      ]);

      const vod = await vodRes.json();
      const series = await seriesRes.json();
      const live = await liveRes.json();

      const all = [
        ...(Array.isArray(vod) ? vod.map((v) => ({ ...v, type: "movie" })) : []),
        ...(Array.isArray(series)
          ? series.map((s) => ({ ...s, type: "series" }))
          : Array.isArray(series?.series)
          ? series.series.map((s: any) => ({ ...s, type: "series" }))
          : []),
        ...(Array.isArray(live) ? live.map((l) => ({ ...l, type: "live" })) : []),
      ];

      const lower = text.toLowerCase();
      const filtered = all.filter((item) =>
        (item.name || item.title || "").toLowerCase().includes(lower)
      );

      setResults(filtered.slice(0, 50));
    } catch (err) {
      console.error("❌ Suchfehler:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: Platform.OS === "ios" ? 50 : 30 }}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", marginHorizontal: 15, marginBottom: 20,
          backgroundColor: "#111", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
        }}
      >
        <Ionicons name="search" size={20} color="#aaa" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Titel, Serie oder Sender suchen..."
          placeholderTextColor="#777"
          style={{ flex: 1, color: "#fff", fontSize: 16 }}
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#ff5722" />
          <Text style={{ color: "#fff", marginTop: 10 }}>Suche...</Text>
        </View>
      ) : results.length === 0 && query.trim() ? (
        <View style={{ alignItems: "center", marginTop: 50 }}>
          <Text style={{ color: "#999" }}>Keine Ergebnisse gefunden</Text>
        </View>
      ) : (
        <ScrollView style={{ paddingHorizontal: 10 }}>
          {results.map((item, index) => {
            const img = item.stream_icon || item.cover || item.series_image || item.movie_image || item.poster || placeholderImage;
            const title = cleanTitle(item.name || item.title || "Unbekannt");

            return (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  if (item.type === "movie") navigation.navigate("MovieDetail", { movie: item });
                  else if (item.type === "series") navigation.navigate("SeriesDetail", { serie: item });
                  else if (item.type === "live") navigation.navigate("Player", { channels: [item], currentIndex: 0 });
                }}
                style={{
                  flexDirection: "row", alignItems: "center", backgroundColor: "#111",
                  borderRadius: 8, marginBottom: 10, overflow: "hidden",
                }}
              >
                <Image source={{ uri: img }} style={{ width: 90, height: 100, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }} resizeMode="cover" />
                <View style={{ flex: 1, padding: 10 }}>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{title}</Text>
                  <Text style={{ color: "#ff5722", fontSize: 13, marginTop: 4 }}>
                    {item.type === "movie" ? "🎬 Film" : item.type === "series" ? "📺 Serie" : "🔴 Live"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}