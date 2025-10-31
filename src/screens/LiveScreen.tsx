import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator, ScrollView,
  StatusBar, StyleSheet, Platform, Animated, TextInput, TouchableWithoutFeedback
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Font from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getXtreamInfo, setXtreamConnection } from "../store";
import { VLCPlayer } from "react-native-vlc-media-player";
import { BlurView } from "expo-blur";

const API_PATH = "/player_api.php";

export default function LiveScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-80)).current;

  // Header Animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_MAX_HEIGHT = 100;
  const HEADER_MIN_HEIGHT = 65;
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;
  const TITLE_MAX_SIZE = 19;
  const TITLE_MIN_SIZE = 15;
  const TITLE_MAX_CAT_SIZE = 14;
  const TITLE_MIN_CAT_SIZE = 12;

  useEffect(() => {
    // Load fonts first, then categories
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          Orbitron: require("../../assets/fonts/Prisma.ttf"),
        });
        setFontsLoaded(true);
      } catch (err) {
        setError("Fehler beim Laden der Schriftarten.");
        setFontsLoaded(false);
      }
    };

    const loadCategories = async () => {
      try {
        const info = await ensureSession();
        const res = await axios.get(
          `${info.serverUrl}${API_PATH}`,
          {
            params: {
              username: info.username,
              password: info.password,
              action: "get_live_categories",
            },
            timeout: 10000, // Timeout after 10 seconds
          }
        );
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        // Robust error handling for network issues and timeouts
        if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
          setError("Netzwerk-Timeout beim Laden der Kategorien.");
        } else if (err.message === "Network Error") {
          setError("Netzwerkfehler beim Laden der Kategorien.");
        } else {
          console.error("❌ Fehler beim Laden der Kategorien:", err?.response?.data || err);
          setError("Fehler beim Laden der Kategorien.");
        }
      } finally {
        setLoading(false);
      }
    };

    // Sequence: load fonts first, then categories
    (async () => {
      await loadFonts();
      await loadCategories();
    })();
  }, []);

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

  const loadChannels = async (categoryIdOrName: string) => {
    setLoadingChannels(true);
    try {
      const info = await ensureSession();
      const res = await axios.get(`${info.serverUrl}${API_PATH}`, {
        // Xtream akzeptiert category_id (Zahl/String). Dein Code übergab Namen – manche Panels mappen beides.
        params: { username: info.username, password: info.password, action: "get_live_streams", category_id: categoryIdOrName }
      });
      setChannels(Array.isArray(res.data) ? res.data : []);
      setSelectedCategory(categoryIdOrName);
    } catch (err: any) {
      console.error("❌ Fehler beim Laden der Sender:", err?.response?.data || err);
      setError("Fehler beim Laden der Sender.");
    } finally {
      setLoadingChannels(false);
    }
  };

  // 🔍 Suche umschalten
  const toggleSearch = () => {
    if (searchVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -80, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setSearchVisible(false);
        setSearchText("");
      });
    } else {
      setSearchVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  };

  // 🔍 Suche in Sendern (innerhalb geladener Kategorie)
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    const lower = searchText.toLowerCase();
    return channels.filter(ch => ch.name?.toLowerCase().includes(lower));
  }, [searchText, channels]);

  // Ladezustand
  if (loading || !fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff5722" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Lade Kategorien...</Text>
      </View>
    );
  }

  // Fehler
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning" size={28} color="red" />
        <Text style={{ color: "red", marginTop: 10, textAlign: "center" }}>{error}</Text>
        <TouchableOpacity
          onPress={async () => {
            setError(null);
            setLoading(true);
            setCategories([]);
            setSelectedCategory(null);
            setChannels([]);
            await loadCategories();
          }}
          style={styles.retryButton}
        >
          <Text style={{ color: "#fff" }}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Senderansicht (wie bei dir – behalten)
  if (selectedCategory) {
    // Header Animation values
    const headerHeight = scrollY.interpolate({
      inputRange: [0, HEADER_SCROLL_DISTANCE],
      outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      extrapolate: "clamp",
    });
    const titleSize = scrollY.interpolate({
      inputRange: [0, HEADER_SCROLL_DISTANCE],
      outputRange: [TITLE_MAX_CAT_SIZE, TITLE_MIN_CAT_SIZE],
      extrapolate: "clamp",
    });
    const headerOpacity = scrollY.interpolate({
      inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
      outputRange: [1, 0.96, 0.93],
      extrapolate: "clamp",
    });
    // Interpolated background color for blur overlay: rgba(0,0,0,0) -> rgba(0,0,0,0.6)
    const headerBgColor = scrollY.interpolate({
      inputRange: [0, HEADER_SCROLL_DISTANCE],
      outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"],
      extrapolate: "clamp",
    });
    const iconSize = scrollY.interpolate({
      inputRange: [0, HEADER_SCROLL_DISTANCE],
      outputRange: [22, 20],
      extrapolate: "clamp",
    });
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        {/* Animated Header */}
        <Animated.View
          style={[
            styles.animatedHeader,
            {
              height: headerHeight,
              opacity: headerOpacity,
            },
          ]}
        >
          {/* Interpolated dark background for blur header */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: headerBgColor },
            ]}
          >
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={styles.headerContent}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory(null);
                  setChannels([]);
                }}
                style={{ marginRight: 10 }}
              >
                <Animated.View>
                  <Ionicons name="arrow-back" size={22} color="#fff" />
                </Animated.View>
              </TouchableOpacity>
              <Animated.Text
                style={{
                  color: "#fff",
                  fontSize: titleSize,
                  fontWeight: "700",
                  fontFamily: "Orbitron",
                  letterSpacing: 0.5,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedCategory}
              </Animated.Text>
            </View>
            <TouchableOpacity onPress={toggleSearch}>
              <Animated.View>
                <Ionicons name={searchVisible ? "close" : "search"} size={22} color="#fff" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </Animated.View>
        {loadingChannels ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#ff5722" />
            <Text style={{ color: "#fff", marginTop: 10 }}>Lade Sender...</Text>
          </View>
        ) : (
          <Animated.FlatList
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, paddingTop: HEADER_MAX_HEIGHT - 12 }}
            data={channels}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => {
                  const selected = channels[index];
                  const isLive =
                    selected.stream_type === "live" ||
                    selected.category_name?.toLowerCase().includes("live") ||
                    selected.stream_url?.includes("/live/");
                  navigation.navigate("Player", {
                    channels,
                    currentIndex: index,
                    streamUrl: selected.stream_url || selected.url,
                    isLive,
                  });
                }}
                style={styles.channelItem}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: item.stream_icon || "https://via.placeholder.com/60x60" }}
                  style={styles.channelLogo}
                />
                <Text style={styles.channelName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={{ color: "#aaa", textAlign: "center", marginTop: 20 }}>
                Keine Sender gefunden
              </Text>
            }
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          />
        )}
        {/* Suchoverlay wie bei dir */}
        {searchVisible && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.85)",
              opacity: fadeAnim, zIndex: 200,
            }}
          >
            <TouchableWithoutFeedback onPress={toggleSearch}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>

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
                  color: "#fff", fontSize: 16,
                }}
                placeholder="Sender suchen..."
                placeholderTextColor="#aaa"
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
            </Animated.View>

            <FlatList
              data={searchResults}
              keyExtractor={(_, i) => String(i)}
              style={{
                position: "absolute",
                top: Platform.OS === "ios" ? 120 : 100,
                left: 20, right: 20,
                maxHeight: "70%",
                backgroundColor: "rgba(20,20,20,0.95)",
                borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSearchVisible(false);
                    navigation.navigate("Player", { channels: [item], currentIndex: 0 });
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    paddingVertical: 10, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Image
                    source={{ uri: item.stream_icon || "https://via.placeholder.com/60x60" }}
                    style={{ width: 50, height: 50, borderRadius: 6, marginRight: 12 }}
                  />
                  <Text style={{ color: "#fff", fontSize: 15 }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </Animated.View>
        )}
      </SafeAreaView>
    );
  }

  // Kategorienübersicht (wie bei dir)
  // Header Animation values for overview
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });
  const titleSize = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [TITLE_MAX_SIZE, TITLE_MIN_SIZE],
    extrapolate: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.96, 0.93],
    extrapolate: "clamp",
  });
  // Interpolated background color for blur overlay: rgba(0,0,0,0) -> rgba(0,0,0,0.6)
  const headerBgColor = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"],
    extrapolate: "clamp",
  });
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      {/* Animated Header */}
      <Animated.View
        style={[
          styles.animatedHeader,
          {
            height: headerHeight,
            opacity: headerOpacity,
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: headerBgColor },
          ]}
        >
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.headerContent}>
          <Animated.Text
            style={{
              color: "#fff",
              fontSize: titleSize,
              fontWeight: "700",
              fontFamily: "Orbitron",
              letterSpacing: 1.2,
            }}
          >
            LIVE TV
          </Animated.Text>
          <TouchableOpacity onPress={toggleSearch}>
            <Ionicons name={searchVisible ? "close" : "search"} size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, paddingTop: HEADER_MAX_HEIGHT - 12 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {categories.length === 0 ? (
          <Text style={{ color: "#888", textAlign: "center", marginTop: 20 }}>
            Keine Kategorien gefunden. Bitte neu verbinden.
          </Text>
        ) : (
          categories.map((cat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.categoryItem}
              onPress={() => loadChannels(cat.category_id ?? cat.category_name)}
              activeOpacity={0.8}
            >
              <Ionicons name="tv-outline" size={22} color="#ff5722" style={{ marginRight: 10 }} />
              <Text style={styles.categoryName}>{cat.category_name}</Text>
            </TouchableOpacity>
          ))
        )}
      </Animated.ScrollView>
      {/* Suchoverlay wie bei dir */}
      {searchVisible && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            opacity: fadeAnim, zIndex: 200,
          }}
        >
          <TouchableWithoutFeedback onPress={toggleSearch}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

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
                color: "#fff", fontSize: 16,
              }}
              placeholder="Sender suchen..."
              placeholderTextColor="#aaa"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
          </Animated.View>

          <FlatList
            data={searchResults}
            keyExtractor={(_, i) => String(i)}
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 120 : 100,
              left: 20, right: 20,
              maxHeight: "70%",
              backgroundColor: "rgba(20,20,20,0.95)",
              borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setSearchVisible(false);
                  navigation.navigate("Player", { channels: [item], currentIndex: 0 });
                }}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: 10, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Image
                  source={{ uri: item.stream_icon || "https://via.placeholder.com/60x60" }}
                  style={{ width: 50, height: 50, borderRadius: 6, marginRight: 12 }}
                />
                <Text style={{ color: "#fff", fontSize: 15 }}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  animatedHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 110,
    overflow: "hidden",
    // shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 44 : 24,
  },
  retryButton: { marginTop: 16, backgroundColor: "#ff5722", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  categoryItem: {
    flexDirection: "row", alignItems: "center", marginVertical: 6, marginHorizontal: 2,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.03)",
  },
  categoryName: { color: "#ddd", fontSize: 15, fontWeight: "500" },
  channelItem: {
    flexDirection: "row", alignItems: "center", marginVertical: 5, marginHorizontal: 4,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.03)",
  },
  channelLogo: { width: 46, height: 46, borderRadius: 6, marginRight: 10 },
  channelName: { color: "#ddd", fontSize: 15, fontWeight: "500", flexShrink: 1 },
});