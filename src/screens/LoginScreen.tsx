import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { setXtreamConnection } from "../store";
import { normalizeBaseUrl } from "../utils/normalizeBaseUrl";
import { autoDetectXtreamUrl } from "../api/xtreamApi";

// Styles für das dunkle, schlichte UI
const styles = {
  container: { flex: 1, backgroundColor: "#181818", padding: 20 },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    marginTop: Platform.OS === "ios" ? 60 : 30,
    textAlign: "left",
  },
  modeSwitch: { flexDirection: "row", marginBottom: 20 },
  modeButton: {
    flex: 1,
    backgroundColor: "#232323",
    padding: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: "#ff5722" },
  modeText: { color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: "#232323",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#ff5722",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: { backgroundColor: "#333" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  statusLine: { color: "#aaa", marginTop: 20, textAlign: "center" },
  message: {
    marginTop: 12,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },
};

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<"xtream" | "m3u">("xtream");
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState("Warte auf Eingabe...");
  const [message, setMessage] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://m3u.best-smarter.me");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");

  // Session prüfen
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("iptv_session");
      if (saved) {
        console.log("✅ Session vorhanden – Weiterleitung zur MainTabs");
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      }
    })();
  }, []);

  // Neuer Login-Handler mit autoDetectXtreamUrl
  const handleLogin = async () => {
    if (!baseUrl || !username || !password) {
      Alert.alert("Fehler", "Bitte alle Felder ausfüllen.");
      return;
    }

    setLoading(true);
    try {
      console.log("📡 Versuche automatische Erkennung:", baseUrl);
      const session = await autoDetectXtreamUrl(baseUrl, username, password);

      if (session?.auth) {
        console.log("✅ Login erfolgreich, Session gespeichert:", session);
        await AsyncStorage.setItem("iptv_session", JSON.stringify(session));
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs" }],
        });
      } else {
        Alert.alert("Login fehlgeschlagen", "Bitte Zugangsdaten prüfen.");
      }
    } catch (err: any) {
      console.log("❌ Fehler beim Login:", err.message);
      Alert.alert("Verbindung fehlgeschlagen", "Server oder Zugangsdaten sind ungültig oder nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>🔐 IPTV Login</Text>
      {/* Umschalter */}
      <View style={styles.modeSwitch}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === "xtream" && styles.modeButtonActive,
          ]}
          onPress={() => setMode("xtream")}
        >
          <Text style={styles.modeText}>Xtream</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === "m3u" && styles.modeButtonActive,
            { marginRight: 0 },
          ]}
          onPress={() => setMode("m3u")}
        >
          <Text style={styles.modeText}>M3U</Text>
        </TouchableOpacity>
      </View>
      {mode === "xtream" ? (
        <>
          <TextInput
            placeholder="Server URL (z. B. http://deinserver.com)"
            placeholderTextColor="#777"
            style={styles.input}
            value={baseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setBaseUrl}
            onEndEditing={() => setBaseUrl((prev) => normalizeBaseUrl(prev))}
          />
          <TextInput
            placeholder="Benutzername"
            placeholderTextColor="#777"
            style={styles.input}
            value={username}
            autoCapitalize="none"
            onChangeText={setUsername}
          />
          <TextInput
            placeholder="Passwort"
            placeholderTextColor="#777"
            style={styles.input}
            secureTextEntry
            value={password}
            autoCapitalize="none"
            onChangeText={setPassword}
          />
        </>
      ) : (
        <TextInput
          placeholder="M3U-Link (komplette URL)"
          placeholderTextColor="#777"
          style={styles.input}
          value={m3uUrl}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setM3uUrl}
        />
      )}
      <TouchableOpacity
        onPress={mode === "xtream" ? handleLogin : async () => {
          setLoading(true);
          setMessage(null);
          setStatusLine("🔗 Verbinde mit Server...");
          try {
            if (!m3uUrl) {
              setMessage("❌ Bitte M3U-Link eingeben");
              setStatusLine("❌ Eingabefehler");
              return;
            }
            // M3U-Session speichern
            await AsyncStorage.setItem(
              "iptv_session",
              JSON.stringify({ m3uUrl: m3uUrl.trim() })
            );
            setMessage("✅ M3U-Link gespeichert");
            setStatusLine("✅ Login erfolgreich – lade Startseite...");
            setTimeout(() => {
              navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
            }, 1000);
          } catch (err: any) {
            console.error("❌ Fehler:", err);
            setMessage("❌ Verbindung fehlgeschlagen – bitte prüfen");
            setStatusLine("❌ Keine Verbindung");
          } finally {
            setLoading(false);
          }
        }}
        style={[
          styles.button,
          loading && styles.buttonDisabled,
        ]}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verbinden</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.statusLine}>{statusLine}</Text>
      {message && (
        <Text
          style={[
            styles.message,
            { color: message.includes("❌") ? "#ff4c4c" : "#00e676" },
          ]}
        >
          {message}
        </Text>
      )}
    </ScrollView>
  );
}