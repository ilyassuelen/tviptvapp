import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  Animated,
  TextInput,
  TouchableWithoutFeedback,
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Font from "expo-font";

const API_BASE = "http://87.106.10.34:8000";

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
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        Orbitron: require("../../assets/fonts/Prisma.ttf"),
      });
      setFontsLoaded(true);
    };

    const loadCategories = async () => {
      try {
        const res = await axios.get(`${API_BASE}/iptv/categories`);
        setCategories(res.data.categories || []);
      } catch (err: any) {
        console.error("❌ Fehler beim Laden der Kategorien:", err.response?.data || err);
        setError("Fehler beim Laden der Kategorien (404 oder keine Session)");
      } finally {
        setLoading(false);
      }
    };

    loadFonts();
    loadCategories();
  }, []);

  const loadChannels = async (categoryName: string) => {
    setLoadingChannels(true);
    try {
      const res = await axios.get(`${API_BASE}/iptv/channels`, {
        params: { category: categoryName },
      });
      setChannels(res.data.channels || []);
      setSelectedCategory(categoryName);
    } catch (err: any) {
      console.error("❌ Fehler beim Laden der Sender:", err.response?.data || err);
      setError("Fehler beim Laden der Sender (404 oder leer)");
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
        setSearchResults([]);
      });
    } else {
      setSearchVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  };

  // 🔍 Suche in Sendern
  const handleSearch = (text: string) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = text.toLowerCase();
    const filtered = channels.filter((ch) =>
      ch.name?.toLowerCase().includes(lower)
    );
    setSearchResults(filtered);
  };

  // 🕐 Ladezustand
  if (loading || !fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff5722" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Lade Kategorien...</Text>
      </View>
    );
  }

  // ⚠️ Fehleranzeige
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning" size={28} color="red" />
        <Text style={{ color: "red", marginTop: 10, textAlign: "center" }}>{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setLoading(true);
            setCategories([]);
            setSelectedCategory(null);
          }}
          style={styles.retryButton}
        >
          <Text style={{ color: "#fff" }}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 📺 Senderansicht
  if (selectedCategory) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />

        {/* HEADER analog zu MoviesScreen */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#000",
            paddingTop: Platform.OS === "ios" ? 45 : 25,
            paddingBottom: 10,
            paddingHorizontal: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => {
                setSelectedCategory(null);
                setChannels([]);
              }}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "700",
                fontFamily: "Orbitron",
              }}
            >
              {selectedCategory}
            </Text>
          </View>

          <TouchableOpacity onPress={toggleSearch}>
            <Ionicons
              name={searchVisible ? "close" : "search"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Senderliste */}
        {loadingChannels ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#ff5722" />
            <Text style={{ color: "#fff", marginTop: 10 }}>Lade Sender...</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
            data={channels}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("Player", { channels, currentIndex: index })
                }
                style={styles.channelItem}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri: item.stream_icon || "https://via.placeholder.com/60x60",
                  }}
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
          />
        )}

        {/* 🔍 Suchoverlay */}
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
                placeholder="Sender suchen..."
                placeholderTextColor="#aaa"
                value={searchText}
                onChangeText={handleSearch}
                autoFocus
              />
            </Animated.View>

            <FlatList
              data={searchResults}
              keyExtractor={(_, i) => String(i)}
              style={{
                position: "absolute",
                top: Platform.OS === "ios" ? 120 : 100,
                left: 20,
                right: 20,
                maxHeight: "70%",
                backgroundColor: "rgba(20,20,20,0.95)",
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSearchVisible(false);
                    navigation.navigate("Player", {
                      channels: [item],
                      currentIndex: 0,
                    });
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
                      uri: item.stream_icon || "https://via.placeholder.com/60x60",
                    }}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 6,
                      marginRight: 12,
                    }}
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

  // 🗂 Kategorienübersicht
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* HEADER wie MoviesScreen */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#000",
          paddingTop: Platform.OS === "ios" ? 45 : 25,
          paddingBottom: 10,
          paddingHorizontal: 14,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 19,
            fontWeight: "700",
            fontFamily: "Orbitron",
          }}
        >
          LIVE TV
        </Text>

        <TouchableOpacity onPress={toggleSearch}>
          <Ionicons
            name={searchVisible ? "close" : "search"}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
        {categories.length === 0 ? (
          <Text style={{ color: "#888", textAlign: "center", marginTop: 20 }}>
            Keine Kategorien gefunden. Bitte neu verbinden.
          </Text>
        ) : (
          categories.map((cat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.categoryItem}
              onPress={() => loadChannels(cat.category_name)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="tv-outline"
                size={22}
                color="#ff5722"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.categoryName}>{cat.category_name}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#000",
    paddingTop: Platform.OS === "ios" ? 25 : 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
  },

  splitContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#000",
    marginTop: -8,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#ff5722",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    marginHorizontal: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  categoryName: {
    color: "#ddd",
    fontSize: 15,
    fontWeight: "500",
  },
  channelItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  channelLogo: { width: 46, height: 46, borderRadius: 6, marginRight: 10 },
  channelName: {
    color: "#ddd",
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
});