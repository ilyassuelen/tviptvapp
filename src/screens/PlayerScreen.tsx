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
  useWindowDimensions,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { TVEventHandler } from "react-native";
import { BlurView } from "expo-blur";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildStreamUrl } from "../api/xtreamApi";
import { VLCPlayer } from "react-native-vlc-media-player";

export default function PlayerScreen({ route, navigation }: any) {
  const { channels, currentIndex, session: sessionFromRoute } = route.params;
  const [session, setSession] = useState<any>(sessionFromRoute || null);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  // --- Overlay/Player States ---
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  // --- End Overlay/Player States ---
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // --- Player Ref for VLC ---
  const vlcRef = useRef<any>(null);
  // For backward compatibility (old code)
  const playerRef = vlcRef;
  const currentChannel = channels[selectedIndex];

  // Determine if this is a live channel (for overlays)
  const isLive =
    !!(
      currentChannel?.stream_type &&
      (
        currentChannel.stream_type.toLowerCase().includes("live") ||
        currentChannel.stream_type.toLowerCase().includes("tv")
      )
    );

  // 🔒 Orientation handling – lock once on mount, restore on unmount
  useEffect(() => {
    let isMounted = true;

    const lockLandscape = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        console.log("📱 Orientation → LANDSCAPE locked");
      } catch (err) {
        console.warn("⚠️ Orientation lock failed:", err);
      }
    };

    const restorePortrait = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        console.log("📱 Orientation → restored to PORTRAIT");
      } catch (err) {
        console.warn("⚠️ Orientation restore failed:", err);
      }
    };

    // Lock only once when mounted
    lockLandscape();

    return () => {
      if (isMounted) restorePortrait();
      isMounted = false;
    };
  }, []);

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




  useEffect(() => {
    (async () => {
      await startStream();
    })();
  }, [selectedIndex]);

  useEffect(() => {
    if (session && !currentUrl && !loading) {
      console.log("🔁 Session jetzt verfügbar – starte Stream erneut");
      startStream();
    }
  }, [session]);

  // 🧠 smarter Stream-Start mit alternativen Fallbacks (.mkv für Filme bevorzugen)
  const startStream = async (retryVariant = 0) => {
    setCurrentUrl(null);
    setLoading(true);
    setErrorMsg(null);

    try {
      const ch = currentChannel;
      if (!session) {
        setErrorMsg("Sitzung noch nicht geladen. Bitte neu versuchen.");
        setLoading(false);
        return;
      }

      // 🎯 URL basierend auf Stream-Typ erzeugen
      let streamUrl = await buildStreamUrl(session, ch.stream_id, ch.stream_type);

      // 📁 Dateiformate pro Kategorie
      let extensions = [".m3u8", ".mp4", ".mkv", ".ts"];
      if (
        ch.stream_type?.toLowerCase().includes("movie") ||
        ch.stream_type?.toLowerCase().includes("vod") ||
        ch.stream_type?.toLowerCase().includes("series")
      ) {
        // Für Filme und Serien sofort .mkv bevorzugen
        extensions = [".mkv", ".mp4", ".ts", ".m3u8"];
      }

      // 🔁 Varianten generieren
      const variants = extensions.map(ext =>
        streamUrl.replace(/\.(m3u8|mp4|mkv|ts)$/, ext)
      );

      const tryUrl = variants[retryVariant] || variants[0];

      console.log(`🎬 Lade Stream (Versuch ${retryVariant + 1}): ${tryUrl}`);
      setCurrentUrl(tryUrl);
      setIsPlaying(true);
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
      setIsPlaying(false);
      // Restore portrait *once* when actually leaving this screen
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      navigation.goBack();
    } catch (err) {
      console.log("⚠️ Fehler beim Zurücknavigieren:", err);
    }
  };

  // --- Overlay/Player Controls logic ---
  // Helper: format seconds to HH:MM:SS or MM:SS
  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return "00:00";
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Toggle overlay controls visibility
  const toggleControls = () => {
    if (controlsVisible) {
      setControlsVisible(false);
    } else {
      setControlsVisible(true);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  };

  // Play/Pause toggle
  const togglePlayPause = () => {
    if (vlcRef.current && vlcRef.current.pause) {
      vlcRef.current.pause(isPlaying); // passing true pauses, false plays
      setIsPlaying((prev) => !prev);
    }
  };

  // Next/Prev handlers for live
  const handlePrev = () => {
    if (isLive && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setProgress(0);
    }
  };
  const handleNext = () => {
    if (isLive && selectedIndex < channels.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setProgress(0);
    }
  };

  // Seek handler for VOD
  const handleSeek = (value: number) => {
    if (!isLive && vlcRef.current && vlcRef.current.seek) {
      vlcRef.current.seek(value);
      setProgress(value);
    }
  };

  // Listen for VLC progress updates
  useEffect(() => {
    // Reset progress/duration on channel change
    setProgress(0);
    setDuration(0);
  }, [currentUrl]);

  // --- Save to history ---
  const saveToHistory = async (item) => {
    try {
      const key = "stream_history";
      const stored = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
      const filtered = stored.filter((x) => x.stream_id !== item.stream_id);
      const updated = [item, ...filtered].slice(0, 30);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      console.log("✅ Verlauf aktualisiert:", item.name);
    } catch (err) {
      console.error("❌ Fehler beim Speichern des Verlaufs:", err);
    }
  };

  // Handler for VLC events
  const handleVlcProgress = (e: any) => {
    // e.currentTime, e.duration (in seconds)
    if (typeof e?.currentTime === "number") setProgress(e.currentTime);
    if (typeof e?.duration === "number") setDuration(e.duration);
  };

  // Hide controls after 3s when shown
  useEffect(() => {
    if (controlsVisible) {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [controlsVisible]);

  // --- Save playback to history when channel changes/unmounts ---
  useEffect(() => {
    return () => {
      if (channels && channels[selectedIndex]) {
        saveToHistory(channels[selectedIndex]);
      }
    };
  }, [selectedIndex]);

  useEffect(() => {
    const tvHandler = new TVEventHandler();
    tvHandler.enable(null, (cmp, evt) => {
      if (!evt || !evt.eventType) return;

      switch (evt.eventType) {
        case "left":
          handlePrev();
          break;
        case "right":
          handleNext();
          break;
        case "select":
          togglePlayPause();
          break;
        case "back":
        case "menu": // FireTV oder AppleTV Menü Taste
          handleBack();
          break;
        case "up":
        case "down":
          setControlsVisible(true);
          break;
      }
    });

    return () => tvHandler.disable();
  }, []);

  return (
    <View style={styles.container}>
      {/* Back Button with Blur Overlay */}
      <View style={styles.backButton}>
        <BlurView
          intensity={40}
          tint="dark"
          style={{ borderRadius: 20, overflow: "hidden" }}
        >
          <TouchableOpacity
            onPress={handleBack}
            style={{
              padding: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
        </BlurView>
      </View>
      {/* VLC Player fullscreen with overlays */}
      {currentUrl && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000",
            zIndex: 1,
          }}
        >
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={{ flex: 1 }}>
              <VLCPlayer
                ref={vlcRef}
                style={{ width: "100%", height: "100%" }}
                source={{ uri: currentUrl }}
                autoPlay
                initType="network"
                initOptions={
                  currentChannel.stream_type === "live"
                    ? [
                        "--network-caching=500",
                        "--rtsp-tcp",
                        "--avcodec-hw=any",
                      ]
                    : [
                        "--network-caching=3000",
                        "--no-drop-late-frames",
                        "--no-skip-frames",
                        "--rtsp-tcp",
                        "--avcodec-hw=any",
                      ]
                }
                onError={(err) => console.log("❌ VLC Fehler:", err)}
                onPlaying={() => console.log("▶️ VLC Stream läuft")}
                onBuffering={() => console.log("⏳ VLC lädt...")}
                onStopped={() => console.log("⏹️ VLC gestoppt")}
                onProgress={handleVlcProgress}
              />
              {/* Overlay Controls */}
              {controlsVisible && (
                <View style={styles.overlayModern}>
                  {/* Center Controls */}
                  <View style={styles.centerControls}>
                    <TouchableOpacity onPress={handlePrev} disabled={!isLive || selectedIndex === 0}>
                      <Ionicons name="play-skip-back" size={36} color="#fff" style={{ opacity: isLive && selectedIndex > 0 ? 1 : 0.3 }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={togglePlayPause}>
                      <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={48} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNext} disabled={!isLive || selectedIndex === channels.length - 1}>
                      <Ionicons name="play-skip-forward" size={36} color="#fff" style={{ opacity: isLive && selectedIndex < channels.length - 1 ? 1 : 0.3 }} />
                    </TouchableOpacity>
                  </View>
                  {/* Bottom Bar */}
                  <View style={styles.bottomBar}>
                    {isLive ? (
                      <Text style={styles.liveLabel}>● LIVE</Text>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <View
                          onLayout={(e) => {
                            const { width } = e.nativeEvent.layout;
                            setBarWidth(width);
                          }}
                          onStartShouldSetResponder={() => true}
                          onResponderGrant={(e) => {
                            if (!isLive && duration > 0 && barWidth > 0) {
                              const { locationX } = e.nativeEvent;
                              const newTime = Math.max(0, Math.min((locationX / barWidth) * duration, duration));
                              setProgress(newTime);
                            }
                          }}
                          onResponderMove={(e) => {
                            if (!isLive && duration > 0 && barWidth > 0) {
                              const { locationX } = e.nativeEvent;
                              const newTime = Math.max(0, Math.min((locationX / barWidth) * duration, duration));
                              setProgress(newTime);
                            }
                          }}
                          onResponderRelease={(e) => {
                            if (!isLive && duration > 0 && vlcRef.current && vlcRef.current.seek && barWidth > 0) {
                              const { locationX } = e.nativeEvent;
                              const newTime = Math.max(0, Math.min((locationX / barWidth) * duration, duration));
                              vlcRef.current.seek(newTime / duration);
                              setProgress(newTime);
                            }
                          }}
                        >
                          <View
                            style={{
                              height: 10,
                              backgroundColor: "#333",
                              borderRadius: 5,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${(progress / (duration || 1)) * 100}%`,
                                backgroundColor: "#E50914",
                                height: "100%",
                              }}
                            />
                          </View>
                        </View>
                        <Text style={[styles.timeLabel, { textAlign: "right", marginTop: 6 }]}>
                          {formatTime(progress)} / {formatTime(duration)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              {/* Loading/Error Overlay */}
              {loading && (
                <View style={[styles.overlay]}>
                  <ActivityIndicator color="#E50914" size="large" />
                  <Text style={{ color: "#fff", marginTop: 10 }}>Lade Stream...</Text>
                </View>
              )}
              {errorMsg && (
                <View style={[styles.overlay]}>
                  <Text style={{ color: "red" }}>{errorMsg}</Text>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  // Removed unused styles: headerRow, backHeaderBtn, splitContainer, leftPane, channelItem, channelItemSelected, channelLogo, channelName, rightPane
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  overlayModern: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 100,
  },
  centerControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 25,
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
    minHeight: 44,
  },
  liveLabel: {
    color: "#ff4040",
    fontWeight: "700",
    fontSize: 14,
  },
  timeLabel: {
    color: "#fff",
    fontSize: 13,
    marginLeft: 10,
  },
  backOverlayButton: { position: "absolute", top: 22, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 44 },
  center: { justifyContent: "center", alignItems: "center" },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
});