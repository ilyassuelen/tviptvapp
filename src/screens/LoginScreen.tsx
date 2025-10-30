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
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { setXtreamConnection } from "../store";

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  const [mode, setMode] = useState<"xtream" | "m3u">("xtream");
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState("Warte auf Eingabe...");
  const [message, setMessage] = useState<string | null>(null);

  // Standardwerte
  const [baseUrl, setBaseUrl] = useState("http://m3u.best-smarter.me");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");

  // 🔁 Wenn gespeicherte Session vorhanden → MainTabs öffnen
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("iptv_session");
      if (saved) {
        console.log("✅ Session vorhanden – Weiterleitung zur MainTabs");
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
      }
    })();
  }, []);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setStatusLine("🔗 Verbinde mit Server...");

      if (!baseUrl || !username || !password) {
        setMessage("❌ Bitte alle Felder ausfüllen");
        return;
      }

      // 🧠 Basis-URL aufräumen
      let cleanBase = baseUrl.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, "");
      if (!cleanBase.startsWith("http")) cleanBase = "http://" + cleanBase;

      const apiUrl = `${cleanBase}/player_api.php?username=${username}&password=${password}`;
      console.log("📡 Verbindung zu:", apiUrl);

      const res = await axios.get(apiUrl);
      const data = res.data;

      if (!data?.user_info || data.user_info.auth !== 1) {
        throw new Error("❌ Login fehlgeschlagen – bitte prüfen");
      }

      console.log("✅ Xtream Login erfolgreich:", data.user_info.username);

      // Globale Verbindung merken
      setXtreamConnection(username, password, cleanBase);

      // 💾 Session speichern
      const session = { serverUrl: cleanBase, username, password };
      await AsyncStorage.setItem("iptv_session", JSON.stringify(session));

      setMessage("✅ Verbindung erfolgreich!");
      setStatusLine("✅ Login erfolgreich – lade Startseite...");

      // 👉 Nach erfolgreichem Login direkt zur Hauptansicht
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
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#000", padding: 20 }}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 20,
          marginTop: Platform.OS === "ios" ? 60 : 30,
        }}
      >
        🔐 IPTV Login
      </Text>

      {/* Umschalter */}
      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "xtream" && styles.modeButtonActive]}
          onPress={() => setMode("xtream")}
        >
          <Text style={styles.modeText}>Xtream</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === "m3u" && styles.modeButtonActive]}
          onPress={() => setMode("m3u")}
        >
          <Text style={styles.modeText}>M3U</Text>
        </TouchableOpacity>
      </View>

      {mode === "xtream" ? (
        <>
          <TextInput
            placeholder="Base URL (z. B. http://m3u.best-smarter.me)"
            placeholderTextColor="#777"
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
          />
          <TextInput
            placeholder="Benutzername"
            placeholderTextColor="#777"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            placeholder="Passwort"
            placeholderTextColor="#777"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </>
      ) : (
        <TextInput
          placeholder="M3U-Link (komplette URL)"
          placeholderTextColor="#777"
          style={styles.input}
          value={m3uUrl}
          onChangeText={setM3uUrl}
        />
      )}

      <TouchableOpacity
        onPress={handleConnect}
        style={{
          backgroundColor: loading ? "#333" : "#ff5722",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          marginTop: 10,
        }}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verbinden</Text>}
      </TouchableOpacity>

      <Text style={{ color: "#aaa", marginTop: 20, textAlign: "center" }}>{statusLine}</Text>

      {message && (
        <Text
          style={{
            color: message.includes("❌") ? "#ff4c4c" : "#00e676",
            marginTop: 12,
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          {message}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = {
  modeButton: {
    flex: 1,
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: "#ff5722" },
  modeText: { color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: "#111",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
};