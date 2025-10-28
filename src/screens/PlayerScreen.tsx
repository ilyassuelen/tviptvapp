import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Animated,
  Easing,
  ViewStyle,
} from "react-native";
import { Video, Audio } from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildStreamUrl } from "../api/xtreamApi";

export default function PlayerScreen({ route, navigation }: any) {
  const { channels, currentIndex, session: sessionFromRoute } = route.params;
  const [session, setSession] = useState<any>(sessionFromRoute || null);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<Video>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const { width: SW, height: SH } = Dimensions.get("window");

  const currentChannel = channels[selectedIndex];

  // 🔁 Falls keine Session übergeben wurde → aus AsyncStorage laden
  useEffect(() => {
    (async () => {
      if (!sessionFromRoute) {
        try {
          const saved = await AsyncStorage.getItem("iptv_session");
          if (saved) {
            const parsed = JSON.parse(saved);
            console.log("🔄 Session aus AsyncStorage geladen:", parsed);
            setSession(parsed);
          }
        } catch (err) {
          console.log("⚠️ Konnte gespeicherte Session nicht laden:", err);
        }
      }
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
        });
        await Audio.setIsEnabledAsync(true);
      })();
      return () => {
        if (videoRef.current) videoRef.current.unloadAsync().catch(() => {});
        Audio.setIsEnabledAsync(false).catch(() => {});
      };
    }, [])
  );

  useEffect(() => {
    (async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
      await startStream();
    })();
  }, [selectedIndex]);

  useEffect(() => {
    if (session && !currentUrl && !loading) {
      console.log("🔁 Session jetzt verfügbar – starte Stream erneut");
      startStream();
    }
  }, [session]);

  // 🧠 smarter Stream-Start mit alternativen Fallbacks
  const startStream = async (retryVariant = 0) => {
    try {
      setLoading(true);
      const ch = currentChannel;
      if (!session) {
        console.log("⚠️ Session noch nicht geladen – Streamstart abgebrochen");
        setErrorMsg("Sitzung noch nicht geladen. Bitte kurz warten oder neu versuchen.");
        setLoading(false);
        return;
      }

      // 🧩 Stream-URL über Xtream API bauen
      let streamUrl = await buildStreamUrl(session, ch.stream_id, ch.stream_type);

      // 🔁 Smarters-like Retry-System bei Filmen/Serien
      if (retryVariant === 1) streamUrl = streamUrl.replace(".m3u8", ".mp4");
      if (retryVariant === 2) streamUrl = streamUrl.replace(".mp4", ".ts");

      console.log(`🎬 Lade Stream (Versuch ${retryVariant + 1}): ${streamUrl}`);

      setCurrentUrl(streamUrl);
      setErrorMsg(null);

      if (videoRef.current) {
        await videoRef.current.unloadAsync().catch(() => {});
        await videoRef.current.loadAsync(
          {
            uri: streamUrl,
            headers: {
              "User-Agent": "ExoPlayerLib/2.15.1 (Linux;Android 11)",
              "Referer": streamUrl.split("/live/")[0] + "/",
              "Origin": streamUrl.split("/live/")[0],
              "Accept": "*/*",
              "Connection": "keep-alive",
            },
          },
          { shouldPlay: true, isMuted: false }
        );
      }

      setIsPlaying(true);

      const historyRaw = await AsyncStorage.getItem("stream_history");
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      const newEntry = { ...ch, stream_url: streamUrl, timestamp: Date.now() };
      const updated = [newEntry, ...history.filter((h: any) => h.name !== ch.name)].slice(0, 10);
      await AsyncStorage.setItem("stream_history", JSON.stringify(updated));
    } catch (err) {
      console.log("❌ Fehler beim Streamstart:", err);
      if (retryVariant < 2) {
        console.log("🔁 Versuche alternative URL...");
        await startStream(retryVariant + 1);
      } else {
        setErrorMsg("Stream konnte nicht geladen werden.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    try {
      if (videoRef.current) await videoRef.current.unloadAsync();
      await Audio.setIsEnabledAsync(false);
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      navigation.navigate("MainTabs", { screen: "Live" });
    } catch (err) {
      console.log("⚠️ Fehler beim Zurücknavigieren:", err);
    }
  };

  const enterFullscreen = () => {
    setIsFullscreen(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const exitFullscreen = () => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      setIsFullscreen(false);
      setShowControls(false);
    });
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    const s = await videoRef.current.getStatusAsync();
    if (s.isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const handleNextChannel = () => {
    if (channels && selectedIndex < channels.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleVideoPress = () => setShowControls((p) => !p);

  const videoStyle = {
    position: "absolute",
    left: progress.interpolate({ inputRange: [0, 1], outputRange: [SW * 0.35, 0] }),
    top: progress.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }),
    width: progress.interpolate({ inputRange: [0, 1], outputRange: [SW * 0.65, SW] }),
    height: progress.interpolate({ inputRange: [0, 1], outputRange: [SH - 100, SH] }),
    backgroundColor: "#000",
    zIndex: 5,
  } as ViewStyle;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backHeaderBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
          <Text style={{ color: "#fff", marginLeft: 6 }}>Zurück</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.splitContainer}>
        <View style={styles.leftPane}>
          <FlatList
            data={channels}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.channelItem,
                  index === selectedIndex && styles.channelItemSelected,
                ]}
                onPress={() => setSelectedIndex(index)}
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri: item.stream_icon || "https://via.placeholder.com/60x60",
                  }}
                  style={styles.channelLogo}
                />
                <Text
                  style={[
                    styles.channelName,
                    index === selectedIndex && { color: "#fff" },
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.rightPane}>
          {loading ? (
            <View style={[styles.center, { flex: 1 }]}>
              <ActivityIndicator color="#ff5722" size="large" />
              <Text style={{ color: "#fff", marginTop: 10 }}>Lade Stream...</Text>
            </View>
          ) : errorMsg ? (
            <Text style={{ color: "red" }}>{errorMsg}</Text>
          ) : null}
        </View>
      </View>

      {currentUrl && (
        <Animated.View style={videoStyle}>
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={isFullscreen ? handleVideoPress : enterFullscreen}
          >
            <Video
              ref={videoRef}
              source={{
                uri: currentUrl,
                overrideFileExtensionAndroid: "m3u8",
                headers: {
                  "User-Agent": "ExoPlayerLib/2.15.1 (Linux;Android 11)",
                  "Referer": currentUrl.split("/live/")[0] + "/",
                  "Origin": currentUrl.split("/live/")[0],
                },
              }}
              style={StyleSheet.absoluteFill}
              shouldPlay={isPlaying}
              resizeMode="contain"
              useNativeControls={false}
              onError={async (error) => {
                console.log("❌ Video-Fehler:", error);
                if (error?.error?.code === -1008 || error?.error?.code === -1002) {
                  console.log("🔁 iOS-Fehler erkannt – versuche alternative Endung...");
                  await startStream(1);
                }
              }}
            />
          </TouchableOpacity>

          {isFullscreen && showControls && (
            <View style={styles.overlay}>
              <TouchableOpacity
                style={styles.backOverlayButton}
                onPress={exitFullscreen}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>

              <View style={styles.controlsRow}>
                <TouchableOpacity onPress={togglePlayPause}>
                  <Ionicons
                    name={isPlaying ? "pause-circle" : "play-circle"}
                    size={76}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity onPress={handleNextChannel}>
                  <Ionicons
                    name="play-skip-forward-circle"
                    size={66}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
  },
  backHeaderBtn: { flexDirection: "row", alignItems: "center" },
  splitContainer: { flex: 1, flexDirection: "row", backgroundColor: "#000" },
  leftPane: {
    width: "35%",
    backgroundColor: "#0b0b0b",
    borderRightColor: "#1e1e1e",
    borderRightWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
  channelItemSelected: {
    backgroundColor: "rgba(255, 87, 34, 0.15)",
    borderLeftColor: "#ff5722",
    borderLeftWidth: 3,
  },
  channelLogo: { width: 46, height: 46, borderRadius: 6, marginRight: 10 },
  channelName: { color: "#ddd", fontSize: 15, fontWeight: "500", flexShrink: 1 },
  rightPane: { width: "65%", backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  backOverlayButton: { position: "absolute", top: 22, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 44 },
  center: { justifyContent: "center", alignItems: "center" },
});